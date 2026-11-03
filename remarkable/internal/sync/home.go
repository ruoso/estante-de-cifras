package sync

// Reading the home book by its own format (docs/home-book-format.md): the
// shelf from shelf.json (§4.2) and each song's reading state from songs.json
// (§4.5) — files the format defines, not music. The instrument files go to the
// bundle untouched (§4.3, §4.4, §4.6; Decision 1). Nothing here fails on a
// malformed file: what does not read is absent (§2.1).

import (
	"bytes"
	"encoding/json"
	"math"
	"regexp"
	"sort"

	"golang.org/x/text/unicode/norm"
)

// The home book's files this package reads (format §2.1).
const (
	shelfFile         = "shelf.json"
	songsFile         = "songs.json"
	instrumentsFile   = "instruments.json"
	preferencesFile   = "preferences.json"
	shapesFile        = "shapes.json"
	defaultShapesFile = "shapes-default-cache.json"
)

// homeFiles are the home book's files as read at main; an absent file is nil.
type homeFiles map[string][]byte

// ShelfBook is one book on the shelf, in shelf order: its id and, when live,
// the person's label for it, the role the account was granted and the
// owner's name (format §4.2). No link: where a book is fetched from is sync's.
type ShelfBook struct {
	ID    string
	Label string
	Role  string
	Owner string
}

// shelfEntry is a shelf book with what sync needs of it.
type shelfEntry struct {
	ShelfBook
	link     string
	position *float64
}

// SongState is a song's saved reading state (format §4.5): its transposition
// (0 when absent) and the variation in use per tuning.
type SongState struct {
	Transposition int
	Variation     map[string]string
}

// instantRE is a §3 instant.
var instantRE = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`)

// register reads raw as a §3 register — an object whose keys are exactly
// value and at, at a well-formed instant — and answers its value and whether
// it is live (a register, and not a tombstone).
func register(raw json.RawMessage) (json.RawMessage, bool) {
	var obj map[string]json.RawMessage
	if json.Unmarshal(raw, &obj) != nil || len(obj) != 2 {
		return nil, false
	}
	value, okV := obj["value"]
	atRaw, okA := obj["at"]
	if !okV || !okA {
		return nil, false
	}
	var at string
	if json.Unmarshal(atRaw, &at) != nil || !instantRE.MatchString(at) {
		return nil, false
	}
	if bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
		return nil, false
	}
	return value, true
}

// liveString is a live register's value when it is a non-empty string.
func liveString(raw json.RawMessage) (string, bool) {
	v, ok := register(raw)
	if !ok {
		return "", false
	}
	var s string
	if json.Unmarshal(v, &s) != nil || s == "" {
		return "", false
	}
	return s, true
}

// asMap reads raw as a JSON object; anything else is empty (§2.1).
func asMap(raw []byte) map[string]json.RawMessage {
	var m map[string]json.RawMessage
	if json.Unmarshal(raw, &m) != nil {
		return map[string]json.RawMessage{}
	}
	return m
}

// readAuthorName reads preferences.json's authorName (format §4.1): the
// account's name, "" when absent, tombstoned or not a string.
func readAuthorName(raw []byte) string {
	name, _ := liveString(asMap(raw)["authorName"])
	return name
}

// readShelf reads shelf.json: every books.<id> with a live link string, in
// ascending live position, a book without one last, ties by id — the web
// app's fill order (format §4.2). Local books (never cloned, design §5.2),
// tombstoned and link-less entries are left out.
func readShelf(raw []byte) []shelfEntry {
	books := asMap(asMap(raw)["books"])
	out := make([]shelfEntry, 0, len(books))
	for id, node := range books {
		fields := asMap(node)
		link, ok := liveString(fields["link"])
		if !ok {
			continue
		}
		e := shelfEntry{ShelfBook: ShelfBook{ID: id}, link: link}
		e.Label, _ = liveString(fields["label"])
		e.Role, _ = liveString(fields["role"])
		e.Owner, _ = liveString(fields["owner"])
		if v, ok := register(fields["position"]); ok {
			var p float64
			if json.Unmarshal(v, &p) == nil {
				e.position = &p
			}
		}
		out = append(out, e)
	}
	sort.Slice(out, func(i, j int) bool {
		a, b := out[i], out[j]
		switch {
		case a.position != nil && b.position != nil && *a.position != *b.position:
			return *a.position < *b.position
		case a.position != nil && b.position == nil:
			return true
		case a.position == nil && b.position != nil:
			return false
		}
		return a.ID < b.ID
	})
	return out
}

// readSongs reads songs.json keyed by NFC song ref (format §2.3, §4.5): a
// transposition only when an integer, each tuning's variation only when a
// live string; tombstones and anything else absent.
func readSongs(raw []byte) map[string]SongState {
	out := map[string]SongState{}
	for ref, node := range asMap(raw) {
		fields := asMap(node)
		var st SongState
		if v, ok := register(fields["transposition"]); ok {
			if n, ok := integer(v); ok {
				st.Transposition = n
			}
		}
		for tuning, r := range asMap(fields["variation"]) {
			if id, ok := liveString(r); ok {
				if st.Variation == nil {
					st.Variation = map[string]string{}
				}
				st.Variation[norm.NFC.String(tuning)] = id
			}
		}
		if st.Transposition == 0 && st.Variation == nil {
			continue
		}
		out[norm.NFC.String(ref)] = st
	}
	return out
}

// integer reads a JSON number that is an integer (a string, or a fraction,
// is not one).
func integer(v json.RawMessage) (int, bool) {
	var f float64
	t := bytes.TrimSpace(v)
	if len(t) == 0 || t[0] == '"' || json.Unmarshal(t, &f) != nil {
		return 0, false
	}
	if f != math.Trunc(f) || f < math.MinInt32 || f > math.MaxInt32 {
		return 0, false
	}
	return int(f), true
}

// emptyObject is how an absent file crosses to the bundle (§2.1).
var emptyObject = json.RawMessage("{}")

// objectOrEmpty is the file's bytes when they are a JSON object, else {}: a
// malformed file reads as absent.
func objectOrEmpty(raw []byte) json.RawMessage {
	t := bytes.TrimSpace(raw)
	if len(t) == 0 || t[0] != '{' || !json.Valid(t) {
		return emptyObject
	}
	return json.RawMessage(raw)
}

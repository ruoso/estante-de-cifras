package hook

// canonical.go is the canonical-form layer the binary composes after the "what a
// book may hold" layer (hook.contents) accepts and before the account-and-book
// byte-cap layer (hook.limits) (workflow 14 §"Canonical form" L49-82, enforced
// by §"What the service checks" L102-104 "and — for songs and setlists — that it
// is canonical"; DIRECTION §3.6). It is the first hook code to import cifra.md
// for Go: the service never needs to understand a song except to check that a
// push holds canonical ones, "which the Go implementation does in the hook"
// (DIRECTION §3.6 L288-291).
//
// By the time it runs, the refs layer has accepted exactly one fast-forward
// refs/heads/main update, the stowaways layer has shown no object the new head
// does not reach, and the contents layer has shown every reachable blob is a
// regular-file UTF-8 blob at an allowed path within the size cap. So for the one
// accepted new head it walks the same introduced history contents walks and, for
// every blob contents classified as a song, a setlist or the root README,
// refuses the whole push unless each is canonical:
//
//   - a *.cifra.md song is canonical under an accepted form (current or, for a
//     grace window, the previous one): cifra.FormOf(bytes) returns (form, true);
//   - a *.setlist.md setlist is canonical under an accepted form:
//     cifra.SetlistFormOf(bytes) returns (form, true);
//   - the root README.md is held to the six text rules (UTF-8 no BOM, LF only,
//     NFC, no tabs, exactly one final newline) plus no conflict-marker line —
//     README is not a song and gets no song/setlist form (workflow 14 L72);
//   - a conflict-marker line is refused wherever it appears (DIRECTION §2.2
//     L95-97; spec §11.12.3). For songs and setlists this is already inside
//     FormOf/SetlistFormOf; for README the hook applies it natively.
//
// Canonicity is decided by cifra.md for Go, never re-derived here: FormOf /
// SetlistFormOf are the §9.1 parse-write-compare check with the UTF-8 and
// marker gates, and they agree with the app's JS because both pass the shared
// corpus (DIRECTION §3.6 L293-300). The hook asks the form registry (the
// disjunction over AcceptedForms), not IsCanonical alone, so the day a second
// form ships it accepts the previous one for the grace window with no hook
// change (DIRECTION §3.6 L302-306: "the Go hook carries both"). .gitattributes
// is already held to its exact app bytes by contents; canonical does not
// re-check it. A real git failure (distinct from a clean non-canonical refusal)
// is returned as an error, which main maps to a refusal — never accept something
// it could not verify. No blob bytes ever reach a log — a refusal names only the
// structural fault and the path the pusher chose (DIRECTION §3.3).

import (
	"bytes"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"

	cifra "github.com/ruoso/cifra.md/go"
)

// conflictMarkers are git's four conflict markers (DIRECTION §2.2; spec
// §11.12.3). The hook holds its own copy for the README check — a product rule,
// not a cifra.md spec construct the library exports (isMarkerLine is unexported
// there), consistent with the hook holding its own .gitattributes constant
// (DIRECTION §3.6 L288-291, the app and service share no code).
var conflictMarkers = [4]string{"<<<<<<<", "=======", ">>>>>>>", "|||||||"}

// isMarkerLine reports a line that is, or begins with and a space follows, one
// of git's four conflict markers (spec §11.12.3). line is a prepared line (the
// §1.3 text layer, cifra.Prepare).
func isMarkerLine(line string) bool {
	for _, m := range conflictMarkers {
		if line == m || strings.HasPrefix(line, m+" ") {
			return true
		}
	}
	return false
}

// hasMarkerLine reports whether content holds a conflict-marker line, after the
// §1.3 text layer (cifra.Prepare — UTF-8 validate, strip U+FEFF, NFC, split,
// tabs→space, trim trailing U+0020). Non-UTF-8 content has no prepared lines (it
// is refused for its encoding, not for a marker).
func hasMarkerLine(content []byte) bool {
	lines, err := cifra.Prepare(content)
	if err != nil {
		return false
	}
	for _, ln := range lines {
		if isMarkerLine(ln) {
			return true
		}
	}
	return false
}

// canonicalReason frames one refusal reason: the ref, the offending path (which
// the pusher chose), and the structural fault — never the blob bytes, the marker
// line's text, or the mismatching README bytes (no song text in logs; DIRECTION
// §3.3).
func canonicalReason(path, detail string) string {
	return fmt.Sprintf("refs/heads/main: %s %s; refused", path, detail)
}

// blobReason returns the refusal reason for one classified blob, or "" when it
// is acceptable. form is the form-checker for a song or setlist (cifra.FormOf /
// cifra.SetlistFormOf in production; a synthetic disjunction in tests, to
// exercise the current-or-previous rule without inventing a second published
// form); it is unused for a README, which is checked natively against the text
// rules. This is the pure per-blob decision, isolated from the git walk so the
// dual-form rule and every README rule are unit-testable.
func blobReason(kind blobKind, path string, content []byte, form func([]byte) (cifra.Form, bool)) string {
	switch kind {
	case kindSong, kindSetlist:
		if _, ok := form(content); ok {
			// Canonical under an accepted form (FormOf already applied the UTF-8
			// and marker gates): accepted.
			return ""
		}
		// Refused — name the most specific fault. (Contents already validated
		// UTF-8, so the non-UTF-8 branch is defensive; the marker branch gives a
		// clearer reason than the bare non-canonical one.)
		switch {
		case !utf8.Valid(content):
			return canonicalReason(path, "is not valid UTF-8 text")
		case hasMarkerLine(content):
			return canonicalReason(path, "holds a conflict marker")
		default:
			return canonicalReason(path, "is not in canonical form")
		}
	case kindReadme:
		return readmeReason(path, content)
	default:
		// Not a kind canonical reasons about (contents owns path/mode/size and
		// the .gitattributes bytes); accept.
		return ""
	}
}

// readmeReason holds the root README.md to the six text rules (workflow 14
// L64-65, L72) plus no conflict-marker line (DIRECTION §2.2; spec §11.12.3),
// returning the first broken rule or "" when clean. A README is not a song and
// goes through no cifra.md song/setlist parser (workflow 14 L72; hook.canonical
// Decision): the rules are a product rule the hook owns in Go. The reason names
// which rule, never the mismatching bytes.
func readmeReason(path string, content []byte) string {
	switch {
	case !utf8.Valid(content):
		return canonicalReason(path, "is not valid UTF-8 text")
	case bytes.Contains(content, []byte(string(rune(0xFEFF)))):
		return canonicalReason(path, "has a byte-order mark")
	case bytes.IndexByte(content, '\r') >= 0:
		return canonicalReason(path, "has a carriage return (only LF line endings are allowed)")
	case bytes.IndexByte(content, '\t') >= 0:
		return canonicalReason(path, "has a tab")
	case !norm.NFC.IsNormal(content):
		return canonicalReason(path, "is not in NFC (Unicode normalisation)")
	case !bytes.HasSuffix(content, []byte("\n")):
		return canonicalReason(path, "is missing its final newline")
	case bytes.HasSuffix(content, []byte("\n\n")):
		return canonicalReason(path, "has an extra final newline")
	case hasMarkerLine(content):
		return canonicalReason(path, "holds a conflict marker")
	default:
		return ""
	}
}

// Canonical is the canonical-form layer the binary composes: for the one
// accepted, non-deletion refs/heads/main update it reaches from the new head and
// refuses the push if any song, setlist or root README the introduced history
// reaches is not canonical. It returns one refusal reason per fault (an empty
// slice accepts) or an error for a real git failure, which main maps to a
// refusal. repoDir is the bare repository the git commands run in (empty =
// inherit the hook's cwd, which git sets to the bare repo). Canonicity is decided
// by the production form registry (cifra.FormOf / cifra.SetlistFormOf).
func Canonical(updates []RefUpdate, repoDir string) (reasons []string, err error) {
	return canonical(updates, repoDir, cifra.FormOf, cifra.SetlistFormOf)
}

// canonical is Canonical with the song and setlist form-checkers injected, so
// the dual-form rule can be exercised in a unit test with a synthetic
// two-form checker. Production passes cifra.FormOf / cifra.SetlistFormOf.
func canonical(updates []RefUpdate, repoDir string, songForm, setlistForm func([]byte) (cifra.Form, bool)) (reasons []string, err error) {
	newHead, ok := acceptedMainHead(updates)
	if !ok {
		// No accepted non-deletion refs/heads/main update to reach from. main runs
		// this layer only after the contents layer accepted exactly such an
		// update, so this is a defensive no-op.
		return nil, nil
	}

	// Walk the introduced commits (the same set hook.contents walks) and ls-tree
	// each, collecting every unique (sha, path) song / setlist / README blob —
	// the kinds canonical reasons about. A blob is read once per path it is
	// introduced at (so a refusal can name the path), de-duplicated across
	// commits.
	commits, err := introducedCommits(repoDir, newHead)
	if err != nil {
		return nil, err
	}
	type blobRef struct {
		kind blobKind
		path string
		sha  string
	}
	var blobs []blobRef
	seen := make(map[string]struct{})
	for _, commit := range commits {
		entries, err := lsTree(repoDir, commit)
		if err != nil {
			return nil, err
		}
		for _, e := range entries {
			kind := classifyPath(e.Path)
			if kind != kindSong && kind != kindSetlist && kind != kindReadme {
				continue
			}
			key := e.SHA + " " + e.Path
			if _, done := seen[key]; done {
				continue
			}
			seen[key] = struct{}{}
			blobs = append(blobs, blobRef{kind: kind, path: e.Path, sha: e.SHA})
		}
	}

	for _, b := range blobs {
		content, err := catFileBlob(repoDir, b.sha)
		if err != nil {
			return nil, err
		}
		var form func([]byte) (cifra.Form, bool)
		switch b.kind {
		case kindSong:
			form = songForm
		case kindSetlist:
			form = setlistForm
		}
		if reason := blobReason(b.kind, b.path, content, form); reason != "" {
			reasons = append(reasons, reason)
		}
	}

	// Deterministic, de-duplicated output (reasons are gathered from a map-ordered
	// walk; two paths sharing one non-canonical blob each get their own reason).
	sort.Strings(reasons)
	return dedupe(reasons), nil
}

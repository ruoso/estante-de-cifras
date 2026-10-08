package hook

// home_book.go is the validator the binary runs in place of the "what a book may
// hold" (hook.contents) and canonical-form (hook.canonical) layers when the book
// is a home book — the per-user settings repository whose files are JSON, not
// songs (docs/home-book-format.md §1, §8; DIRECTION §2.1, §3.2). The home book
// moves over the same git-over-HTTP as a songbook, so the shared guards still
// run for it: the ref/fast-forward layer (hook.refs), the no-stowaway layer
// (hook.stowaways) and the byte-cap layer (hook.limits) are unconditional. Only
// the middle — "what a book may hold" and "canonical form" — is replaced here.
//
// The service recognises a book's kind from the registry (never from the repo's
// contents, which is "fragile and spoofable") and forwards it as
// ESTANTE_BOOK_KIND; main dispatches on it (IsHomeBook). An absent or
// unrecognised kind is treated as a songbook — the stricter path — so a
// misconfigured push fails closed rather than letting JSON through unvalidated
// (docs/home-book-format.md §8 lines 496-500; the design Decision).
//
// For the one accepted, non-deletion refs/heads/main new head, HomeBook examines
// every blob the introduced history reaches — not only the tip (§8) — with the
// same git readers hook.contents uses (introducedCommits/lsTree/catFileBlob), and
// refuses the whole push unless each blob satisfies the §8 whitelist:
//
//   - its path is one of the seven root files of §2.1 (the five *.json settings
//     files, a root README.md, a root .gitattributes): no folder, no other file;
//   - a *.cifra.md / *.setlist.md is refused with its own reason — songs and
//     setlists belong in a songbook, not the home book;
//   - its tree-entry mode is a regular file (no symlink, submodule or executable);
//   - a settings *.json file is well-formed JSON in the canonical form of §6 and
//     obeys the register envelope of §3;
//   - the root README.md / .gitattributes are the exact bytes of §2.2;
//   - no blob is over the 256 KB per-file cap (§8; the same maxBlobBytes as a
//     songbook, so hook.contents' withinSizeLimit carries over).
//
// The canonical JSON form (§6) is implemented fresh in Go here: the home book is
// the app's own format, not a cifra.md format, and the app and the service share
// no code (DIRECTION §3.6), so this validator shares nothing with the app's JS
// writer. Both implement §6 against the document and agree because they are
// checked by the conformance corpus, never because code crosses the boundary.
// The check is the §6 fixed point: parse the blob, re-emit in canonical form, and
// refuse if a byte differs. A real git failure (distinct from a clean refusal) is
// returned as an error, which main maps to a refusal — never accept something it
// could not verify. No settings value, label, link or song ref ever reaches a log
// (DIRECTION §3.3; §8 line 494, §9 line 513); a refusal names only the path the
// pusher chose and the structural aspect that failed.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"golang.org/x/text/unicode/norm"
)

// The ESTANTE_BOOK_KIND env the service forwards (service/internal/server/git.go
// pushEnv), read with os.LookupEnv as hook.limits reads its byte figures. Only
// kindHome selects the home-book validator; every other value — including the
// songbook default, an absent env and an unrecognised one — stays on the songbook
// path (fail closed: settings JSON is validated as settings only when the service
// explicitly says so).
const (
	envBookKind = "ESTANTE_BOOK_KIND"
	kindHome    = "home"
)

// IsHomeBook reports whether the service forwarded a home-book kind, selecting
// the home-book validator over the songbook contents/canonical layers. lookup is
// os.LookupEnv in the binary, a map in tests (mirroring hook.limits readLimitEnv).
func IsHomeBook(lookup func(string) (string, bool)) bool {
	v, ok := lookup(envBookKind)
	return ok && v == kindHome
}

// The five settings files a home book may hold, all at the root (§2.1). The two
// fixed-name files (README.md, .gitattributes) reuse the hook.contents constants
// readmeName/gitattributesName, held to the home book's own §2.2 bytes below.
var homeSettingsFiles = map[string]struct{}{
	"preferences.json": {},
	"shelf.json":       {},
	"instruments.json": {},
	"shapes.json":      {},
	"songs.json":       {},
}

// expectedHomeReadme is the exact bytes a home book's README.md holds (§2.2 lines
// 106-112: UTF-8, LF, one trailing newline). It titles the repository for a
// person opening it in a git tool. The app writes these same bytes; the agreement
// is held by a test and the end-to-end flow, not by sharing code (DIRECTION §3.6).
const expectedHomeReadme = "# Home book\n" +
	"\n" +
	"This repository holds one person's Estante de Cifras settings. Its files are\n" +
	"JSON that merge key by key, the later change winning; it is written and merged\n" +
	"by the app, not edited by hand. The format is docs/home-book-format.md in the\n" +
	"estante-de-cifras repository.\n"

// expectedHomeGitattributes is the exact bytes a home book's .gitattributes holds
// (§2.2 lines 116-119). It differs from a songbook's (contents.go
// expectedGitattributes): a home book merges *.json as binary, not with the cifra
// driver, because the app computes the JSON merge itself and never lets git merge
// its settings files (§2.2 lines 121-126).
const expectedHomeGitattributes = "* text=auto eol=lf\n" +
	"*.json merge=binary\n"

// homeKind classifies a tree-entry path against the home book's §8 whitelist.
type homeKind int

const (
	homeDisallowed    homeKind = iota // a path the home book's §8 whitelist rejects
	homeSettings                      // one of the five *.json settings files at the root
	homeReadme                        // a root README.md
	homeGitattributes                 // a root .gitattributes
	homeSongOrSetlist                 // a *.cifra.md / *.setlist.md — refused with its own reason
)

// classifyHomePath decides a path against the home book's allowed kinds (§2.1,
// §8). Everything lives at the root; a path in a folder is disallowed. A
// *.cifra.md / *.setlist.md at any depth is classified as a song or setlist so it
// gets its own refusal ("belongs in a songbook"). A path with an empty, "." or
// ".." component is disallowed (defensive — git's own trees never hold these).
func classifyHomePath(path string) homeKind {
	if path == "" {
		return homeDisallowed
	}
	comps := strings.Split(path, "/")
	for _, c := range comps {
		if c == "" || c == "." || c == ".." {
			return homeDisallowed
		}
	}
	name := comps[len(comps)-1]
	// A song or setlist is named for the pusher at any depth, so the "belongs in a
	// songbook" reason is given rather than the bare "not an allowed path".
	if strings.HasSuffix(name, songSuffix) && len(name) > len(songSuffix) {
		return homeSongOrSetlist
	}
	if strings.HasSuffix(name, setlistSuffix) && len(name) > len(setlistSuffix) {
		return homeSongOrSetlist
	}
	// Every other home-book file is at the root.
	if len(comps) != 1 {
		return homeDisallowed
	}
	if _, ok := homeSettingsFiles[name]; ok {
		return homeSettings
	}
	switch name {
	case readmeName:
		return homeReadme
	case gitattributesName:
		return homeGitattributes
	default:
		return homeDisallowed
	}
}

// HomeBook is the home-book validator the binary composes in place of
// hook.contents and hook.canonical when ESTANTE_BOOK_KIND is "home". For the one
// accepted, non-deletion refs/heads/main update it reaches from the new head and
// refuses the push if any blob the introduced history reaches breaks the §8
// whitelist (path, mode, size, canonical JSON, the §2.2 bytes). It returns one
// refusal reason per fault (an empty slice accepts) or an error for a real git
// failure, which main maps to a refusal. repoDir is the bare repository the git
// commands run in (empty = inherit the hook's cwd, which git sets to the bare
// repo).
func HomeBook(updates []RefUpdate, repoDir string) (reasons []string, err error) {
	newHead, ok := acceptedMainHead(updates)
	if !ok {
		// No accepted non-deletion refs/heads/main update to reach from. main runs
		// this layer only after the refs and stowaways layers accepted exactly such
		// an update, so this is a defensive no-op.
		return nil, nil
	}

	// Pass 1 — the introduced blob paths and modes, walking the same introduced
	// history hook.contents walks (ls-tree -r each new commit), de-duplicating
	// identical (mode, sha, path) tuples. The path and mode faults are gathered
	// here; the content kinds (settings, README, .gitattributes) are remembered
	// for the content pass.
	commits, err := introducedCommits(repoDir, newHead)
	if err != nil {
		return nil, err
	}
	type blobRef struct {
		kind homeKind
		path string
		sha  string
	}
	var blobs []blobRef
	seen := make(map[string]struct{})
	sha2path := make(map[string]string)
	for _, commit := range commits {
		entries, err := lsTree(repoDir, commit)
		if err != nil {
			return nil, err
		}
		for _, e := range entries {
			key := e.Mode + " " + e.SHA + " " + e.Path
			if _, done := seen[key]; done {
				continue
			}
			seen[key] = struct{}{}
			if _, had := sha2path[e.SHA]; !had {
				sha2path[e.SHA] = e.Path
			}
			if !modeAllowed(e.Mode) {
				reasons = append(reasons, reasonBadMode(e.Path, modeDescription(e.Mode)))
				continue
			}
			kind := classifyHomePath(e.Path)
			switch kind {
			case homeDisallowed:
				reasons = append(reasons, reasonDisallowedHomePath(e.Path))
				continue
			case homeSongOrSetlist:
				reasons = append(reasons, reasonSongInHomeBook(e.Path))
				continue
			}
			if _, tooLong := overLongComponent(e.Path); tooLong {
				reasons = append(reasons, reasonOverLongComponent(e.Path))
				continue
			}
			blobs = append(blobs, blobRef{kind: kind, path: e.Path, sha: e.SHA})
		}
	}

	// Pass 2 — the introduced objects' type and size, the same read hook.contents
	// and hook.limits share (rev-list --objects → cat-file --batch-check). The
	// 256 KB per-file cap of §8 is the songbook's maxBlobBytes, so withinSizeLimit
	// carries over unchanged, with the carrier (tree/commit) guards too.
	objs, err := introducedObjects(repoDir, newHead)
	if err != nil {
		return nil, err
	}
	for _, o := range objs {
		if withinSizeLimit(o.Type, o.Size) {
			continue
		}
		switch o.Type {
		case "blob":
			reasons = append(reasons, reasonOverSizeBlob(blobLabel(o.SHA, sha2path), o.Size))
		default:
			reasons = append(reasons, reasonOverSizeObject(o.Type, o.Size))
		}
	}

	// Pass 3 — blob content. Read each settings / README / .gitattributes blob once
	// and hold it to its §8 rule. Content is read with `git cat-file blob`, never
	// parsed by hand.
	for _, b := range blobs {
		content, err := catFileBlob(repoDir, b.sha)
		if err != nil {
			return nil, err
		}
		if reason := homeBlobReason(b.kind, b.path, content); reason != "" {
			reasons = append(reasons, reason)
		}
	}

	// Deterministic, de-duplicated output (reasons are gathered from map walks).
	sort.Strings(reasons)
	return dedupe(reasons), nil
}

// homeBlobReason is the pure per-blob decision for the content kinds — isolated
// from the git walk so every §6/§3/§2.2 rule is unit-testable without git. It
// returns "" when the blob is acceptable, else the refusal reason. The song,
// disallowed-path and mode faults are decided at the tree-entry stage (they are
// path/mode properties); for those kinds this returns "".
func homeBlobReason(kind homeKind, path string, content []byte) string {
	switch kind {
	case homeSettings:
		return settingsReason(path, content)
	case homeReadme:
		if !bytes.Equal(content, []byte(expectedHomeReadme)) {
			return homeReason(path, "does not hold exactly the home-book README.md the app writes")
		}
		return ""
	case homeGitattributes:
		if !bytes.Equal(content, []byte(expectedHomeGitattributes)) {
			return homeReason(path, "does not hold exactly the home-book .gitattributes the app writes")
		}
		return ""
	default:
		return ""
	}
}

// settingsReason holds one settings *.json file to §8: well-formed JSON, the §3
// register envelope, and the canonical form of §6 (the fixed-point check — parse,
// re-emit, compare bytes). It returns "" when canonical, else the refusal naming
// the path and the structural aspect — never a settings value, a key, or the
// mismatching bytes (§8 line 494; DIRECTION §3.3).
func settingsReason(path string, content []byte) string {
	canonical, detail := canonicalizeSettings(content)
	if detail != "" {
		return homeReason(path, detail)
	}
	if !bytes.Equal(content, canonical) {
		return homeReason(path, "is not in canonical form")
	}
	return ""
}

// bom is the UTF-8 byte-order mark (U+FEFF), forbidden anywhere in a canonical
// home-book file (§6.3).
var bom = []byte{0xEF, 0xBB, 0xBF}

// canonicalizeSettings parses a settings blob, validates the §3 envelope, and
// re-emits it in the canonical form of §6, returning (canonicalBytes, "") on
// success or (nil, detail) when the blob is not well-formed JSON, not an object
// at its root, or breaks the envelope. The detail names only the structural fault
// (no settings content). It is the §6 fixed point: the caller compares the
// re-emitted bytes to the original, so a non-canonical scalar form, key order,
// indentation, CRLF, non-NFC text or a missing/extra trailing newline all surface
// as a byte difference even though the parse succeeds.
func canonicalizeSettings(content []byte) (canonical []byte, detail string) {
	if bytes.HasPrefix(content, bom) {
		return nil, "has a byte-order mark"
	}
	dec := json.NewDecoder(bytes.NewReader(content))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, "is not well-formed JSON"
	}
	// A settings file holds exactly one JSON value; trailing tokens are malformed.
	if dec.More() {
		return nil, "is not well-formed JSON"
	}
	// Each settings file is a map at its root (§4); a scalar or array root is not a
	// home-book settings file.
	if _, ok := v.(map[string]any); !ok {
		return nil, "is not a JSON object at its root"
	}
	if d := envelopeDetail(v); d != "" {
		return nil, d
	}
	var buf bytes.Buffer
	if err := emitCanonical(&buf, v, 0); err != nil {
		// A number the §6.2 emitter cannot render (non-finite) — JSON itself cannot
		// carry one, so this is defensive.
		return nil, "is not well-formed JSON"
	}
	buf.WriteByte('\n')
	return buf.Bytes(), ""
}

// instantRe is the §3 well-formed instant: a UTC ISO-8601 time to exactly three
// fractional digits and a literal Z. The format defines "well-formed" by this
// shape (not by calendar validity), so the regex is the whole check.
var instantRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`)

// envelopeDetail validates the §3 register envelope over v, returning "" when
// every object is a well-formed register or map and a structural detail
// otherwise. It is the envelope walk, distinct from canonicalisation: it stops at
// a register and never walks its (possibly opaque) value, so an opaque value that
// happens to carry value/at keys is safe (§3 lines 174-176). An object whose keys
// are exactly {value, at} with a well-formed `at` string is a register; any other
// object is a map, and every member of a map must itself be a register or a map —
// a bare scalar or array member is "neither a register nor a map" (§1.2, §5.2).
// In this format a map key is never literally "value" or "at" (those appear only
// inside a register, which is not walked), so an object carrying one but not a
// clean register is a malformed register, not a map.
func envelopeDetail(v any) string {
	obj, ok := v.(map[string]any)
	if !ok {
		// A map member that is not an object at all (a bare scalar or array where a
		// register or map was required).
		return "has a value that is neither a register nor a map"
	}
	atRaw, hasAt := obj["at"]
	_, hasValue := obj["value"]
	if hasAt || hasValue {
		// Intended as a register. It is well-formed only with exactly the two keys
		// and a well-formed `at`.
		if !(hasAt && hasValue && len(obj) == 2) {
			return "has a malformed register envelope"
		}
		at, isStr := atRaw.(string)
		if !isStr || !instantRe.MatchString(at) {
			return "has a register with a malformed timestamp"
		}
		// A valid register: its value is opaque and is not walked (§3).
		return ""
	}
	// A map: every member must itself be a register or a map.
	for _, mv := range obj {
		if d := envelopeDetail(mv); d != "" {
			return d
		}
	}
	return ""
}

// emitCanonical writes v to buf in the canonical form of §6 (sorted object
// members at every depth, §6.2 scalars, NFC text, the §6.3 pretty-print bytes) at
// the given indentation depth. It recurses into everything — including an opaque
// register value — because §6.1 canonicalises opaque values too (the one place
// the canonicalisation walk differs from the envelope walk, which stops at a
// register). The trailing newline is the caller's.
func emitCanonical(buf *bytes.Buffer, v any, depth int) error {
	switch t := v.(type) {
	case map[string]any:
		return emitObject(buf, t, depth)
	case []any:
		return emitArray(buf, t, depth)
	case string:
		emitString(buf, t)
		return nil
	case json.Number:
		return emitNumber(buf, t)
	case bool:
		if t {
			buf.WriteString("true")
		} else {
			buf.WriteString("false")
		}
		return nil
	case nil:
		buf.WriteString("null")
		return nil
	default:
		return fmt.Errorf("unexpected JSON value of type %T", v)
	}
}

// emitObject writes an object with its members sorted by the Unicode code points
// of the member name (§6.1). Go string order is byte order, which for UTF-8 is
// code-point order, so sort.Strings gives the §6.1 order (and `at` sorts before
// `value` within a register). An empty object is "{}" (§6.3).
func emitObject(buf *bytes.Buffer, m map[string]any, depth int) error {
	if len(m) == 0 {
		buf.WriteString("{}")
		return nil
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	buf.WriteString("{\n")
	for i, k := range keys {
		writeIndent(buf, depth+1)
		emitString(buf, k)
		buf.WriteString(": ")
		if err := emitCanonical(buf, m[k], depth+1); err != nil {
			return err
		}
		if i < len(keys)-1 {
			buf.WriteString(",\n")
		} else {
			buf.WriteString("\n")
		}
	}
	writeIndent(buf, depth)
	buf.WriteString("}")
	return nil
}

// emitArray writes an array keeping its element order (§6.1: an ordered opaque
// value is meaningful in order and is not sorted), one element per line. An empty
// array is "[]".
func emitArray(buf *bytes.Buffer, a []any, depth int) error {
	if len(a) == 0 {
		buf.WriteString("[]")
		return nil
	}
	buf.WriteString("[\n")
	for i, e := range a {
		writeIndent(buf, depth+1)
		if err := emitCanonical(buf, e, depth+1); err != nil {
			return err
		}
		if i < len(a)-1 {
			buf.WriteString(",\n")
		} else {
			buf.WriteString("\n")
		}
	}
	writeIndent(buf, depth)
	buf.WriteString("]")
	return nil
}

// emitString writes a JSON string in the §6.2 form: NFC-normalised, escaping only
// what JSON requires — `"`, `\`, and U+0000–U+001F — with the short escapes where
// they exist and lowercase `\u00xx` otherwise; every other character, including
// every non-ASCII one, is emitted literally as UTF-8, and `/` is never escaped.
// Normalising here makes a non-NFC input differ from its re-emission, so the
// fixed-point compare refuses it (§6.3).
func emitString(buf *bytes.Buffer, s string) {
	buf.WriteByte('"')
	for _, r := range norm.NFC.String(s) {
		switch r {
		case '"':
			buf.WriteString(`\"`)
		case '\\':
			buf.WriteString(`\\`)
		case '\b':
			buf.WriteString(`\b`)
		case '\f':
			buf.WriteString(`\f`)
		case '\n':
			buf.WriteString(`\n`)
		case '\r':
			buf.WriteString(`\r`)
		case '\t':
			buf.WriteString(`\t`)
		default:
			if r < 0x20 {
				fmt.Fprintf(buf, `\u%04x`, r)
			} else {
				buf.WriteRune(r)
			}
		}
	}
	buf.WriteByte('"')
}

// emitNumber writes a number in the §6.2 form: the shortest decimal that
// round-trips to the same IEEE-754 double (the form JavaScript's
// Number.prototype.toString produces for the small integers and
// exactly-representable decimals this format uses), with no exponent, no leading
// `+` or zeros, and no trailing fractional zeros. 'f' with precision -1 is the
// shortest fixed-notation round-trip, so "2.0" re-emits as "2" and a
// non-canonical scalar form surfaces in the fixed-point compare.
func emitNumber(buf *bytes.Buffer, n json.Number) error {
	f, err := strconv.ParseFloat(string(n), 64)
	if err != nil {
		return err
	}
	if math.IsInf(f, 0) || math.IsNaN(f) {
		return fmt.Errorf("non-finite number")
	}
	buf.WriteString(strconv.FormatFloat(f, 'f', -1, 64))
	return nil
}

// writeIndent writes depth levels of two-space indentation (§6.3).
func writeIndent(buf *bytes.Buffer, depth int) {
	for i := 0; i < depth; i++ {
		buf.WriteString("  ")
	}
}

// The home-book validator's refusal formatters, each routing through refusal for
// the shared "<subject>: <fault>; refused" grammar (hook.messages). None carries
// a settings value, a key, a label, a link, a song ref or the mismatching bytes —
// only the path the pusher chose and the structural aspect that failed (§8 line
// 494; DIRECTION §3.3).

// homeReason frames one refusal: the ref, the offending path, and the structural
// detail. The canonical/envelope/§2.2 faults all go through here.
func homeReason(path, detail string) string {
	return refusal(MainRef, path+" "+detail)
}

// reasonDisallowedHomePath: a path that is not one of the home book's seven §2.1
// files (a folder, another file).
func reasonDisallowedHomePath(path string) string {
	return refusal(MainRef, fmt.Sprintf(
		"%s is not an allowed path for a home book (only preferences.json, shelf.json, instruments.json, shapes.json, songs.json, a root README.md, and a root .gitattributes)",
		path))
}

// reasonSongInHomeBook: a *.cifra.md / *.setlist.md pushed to a home book — a
// song or setlist belongs in a songbook, not here (§8).
func reasonSongInHomeBook(path string) string {
	return refusal(MainRef, fmt.Sprintf(
		"%s is a song or setlist, which belongs in a songbook, not the home book", path))
}

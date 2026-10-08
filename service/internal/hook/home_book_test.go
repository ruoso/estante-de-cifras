package hook

// Unit tests for the home-book validator (hook.home_book), pure and git-free:
// they drive the per-path/per-blob decision (classifyHomePath, homeBlobReason,
// settingsReason) directly, the way canonical_test.go drives blobReason. The
// binary-level walk (introducedCommits/lsTree/catFileBlob, the 256 KB cap over a
// real pack) is exercised in cmd/pre-receive/home_book_test.go against the real
// built hook.
//
// Pins docs/home-book-format.md §8 (allowed kinds and validation), §2.1 (the
// seven root files), §2.2 (the exact README.md/.gitattributes bytes), §3 (the
// register envelope), §6 (canonical form); DIRECTION §2.1, §3.3 (no settings
// content in logs).

import (
	"bytes"
	"strings"
	"testing"
)

// canonicalPreferences is the canonical form (§6) of a one-register
// preferences.json: object members sorted at every depth (`at` before `value`),
// two-space indent, one trailing LF. Hand-spelled, not emitter-produced, so the
// test pins the actual bytes §6.3 fixes rather than whatever the emitter emits.
const canonicalPreferences = "{\n" +
	"  \"theme\": {\n" +
	"    \"at\": \"2026-10-05T14:30:00.000Z\",\n" +
	"    \"value\": \"palco\"\n" +
	"  }\n" +
	"}\n"

// canonicalOpaqueRegister is a canonical instruments.json whose register value is
// opaque and itself carries `value`/`at` keys with a NON-instant `at` (§3 lines
// 174-176). It must be accepted: the envelope walk stops at the register and
// never validates the opaque value, so the non-instant inner `at` is not a fault.
// Canonicalisation, by contrast, does recurse into the opaque value to sort its
// keys (§6.1) — both walks are exercised at once.
const canonicalOpaqueRegister = "{\n" +
	"  \"violao\": {\n" +
	"    \"definition\": {\n" +
	"      \"at\": \"2026-10-05T14:30:00.000Z\",\n" +
	"      \"value\": {\n" +
	"        \"at\": \"not-an-instant\",\n" +
	"        \"value\": 5\n" +
	"      }\n" +
	"    }\n" +
	"  }\n" +
	"}\n"

// TestClassifyHomePath pins the §2.1/§8 whitelist: the five settings files and the
// two fixed-name files at the root, a song/setlist flagged as such, everything
// else disallowed.
func TestClassifyHomePath(t *testing.T) {
	cases := []struct {
		path string
		want homeKind
	}{
		{"preferences.json", homeSettings},
		{"shelf.json", homeSettings},
		{"instruments.json", homeSettings},
		{"shapes.json", homeSettings},
		{"songs.json", homeSettings},
		{"README.md", homeReadme},
		{".gitattributes", homeGitattributes},
		{"cancao.cifra.md", homeSongOrSetlist},
		{"abertura.setlist.md", homeSongOrSetlist},
		{"pasta/cancao.cifra.md", homeSongOrSetlist}, // a song in a folder is still a song
		{"notas.txt", homeDisallowed},
		{"preferences.json.bak", homeDisallowed},
		{"pasta/preferences.json", homeDisallowed}, // settings only at the root
		{"sub/README.md", homeDisallowed},          // the fixed names only at the root
		{"", homeDisallowed},
		{".cifra.md", homeDisallowed}, // no stem before the suffix: not a song
	}
	for _, c := range cases {
		if got := classifyHomePath(c.path); got != c.want {
			t.Errorf("classifyHomePath(%q) = %d, want %d", c.path, got, c.want)
		}
	}
}

// TestHomeSettingsCanonicalAccepted pins that a well-formed canonical settings
// file is accepted (settingsReason == "") — the §6 fixed point. Pins §6, §3.
func TestHomeSettingsCanonicalAccepted(t *testing.T) {
	for _, c := range []struct {
		name    string
		content string
	}{
		{"preferences", canonicalPreferences},
		{"opaque register value with value/at keys", canonicalOpaqueRegister},
		{"empty map", "{}\n"},
	} {
		if r := settingsReason(c.name+".json", []byte(c.content)); r != "" {
			t.Errorf("%s: a canonical settings file should be accepted, got refusal %q", c.name, r)
		}
	}
}

// TestHomeSettingsNonCanonicalRefused pins each distinct non-canonical fault (§6):
// keys out of order, a non-canonical scalar, CRLF, a BOM, no trailing newline,
// not-well-formed JSON, a non-object root. Each names the path and a structural
// aspect only. Pins §6, §6.2, §6.3.
func TestHomeSettingsNonCanonicalRefused(t *testing.T) {
	// value before at — a valid register, but not in canonical key order.
	keysOutOfOrder := "{\n" +
		"  \"theme\": {\n" +
		"    \"value\": \"palco\",\n" +
		"    \"at\": \"2026-10-05T14:30:00.000Z\"\n" +
		"  }\n" +
		"}\n"
	// a numeric register value written 2.0 — not the shortest round-trip (§6.2).
	wrongScalar := "{\n" +
		"  \"transposition\": {\n" +
		"    \"at\": \"2026-10-05T14:30:00.000Z\",\n" +
		"    \"value\": 2.0\n" +
		"  }\n" +
		"}\n"
	crlf := strings.ReplaceAll(canonicalPreferences, "\n", "\r\n")
	withBOM := "\xef\xbb\xbf" + canonicalPreferences // a leading UTF-8 byte-order mark
	noTrailingNewline := strings.TrimSuffix(canonicalPreferences, "\n")

	cases := []struct {
		name    string
		path    string
		content string
		want    string
	}{
		{"keys out of order", "preferences.json", keysOutOfOrder, "not in canonical form"},
		{"wrong scalar form", "songs.json", wrongScalar, "not in canonical form"},
		{"CRLF line endings", "preferences.json", crlf, "not in canonical form"},
		{"a byte-order mark", "preferences.json", withBOM, "byte-order mark"},
		{"no trailing newline", "preferences.json", noTrailingNewline, "not in canonical form"},
		{"not well-formed JSON", "shelf.json", "{\n  \"theme\": \n", "not well-formed JSON"},
		{"a non-object root", "shelf.json", "[]\n", "not a JSON object"},
	}
	for _, c := range cases {
		r := settingsReason(c.path, []byte(c.content))
		if r == "" || !strings.Contains(r, c.want) || !strings.Contains(r, c.path) {
			t.Errorf("%s: settingsReason(%q) = %q; want a refusal naming %q and %q",
				c.name, c.path, r, c.want, c.path)
		}
	}
}

// TestHomeSettingsEnvelopeRefused pins the §3 envelope faults: an object that is
// neither a register nor a map, a register missing value or at, and a malformed
// at. Pins §3, §5.2.
func TestHomeSettingsEnvelopeRefused(t *testing.T) {
	// A map member that is a bare scalar, not a register or a map.
	neither := "{\n  \"theme\": \"palco\"\n}\n"
	// A register-shaped object missing `value`.
	missingValue := "{\n  \"theme\": {\n    \"at\": \"2026-10-05T14:30:00.000Z\"\n  }\n}\n"
	// Keys {value, at} but `at` is not a well-formed instant.
	malformedAt := "{\n  \"theme\": {\n    \"at\": \"nope\",\n    \"value\": \"palco\"\n  }\n}\n"

	cases := []struct {
		name    string
		content string
		want    string
	}{
		{"neither register nor map", neither, "neither a register nor a map"},
		{"register missing a key", missingValue, "malformed register"},
		{"malformed timestamp", malformedAt, "malformed timestamp"},
	}
	for _, c := range cases {
		r := settingsReason("songs.json", []byte(c.content))
		if r == "" || !strings.Contains(r, c.want) || !strings.Contains(r, "songs.json") {
			t.Errorf("%s: settingsReason = %q; want a refusal naming %q and the path", c.name, r, c.want)
		}
	}
}

// TestHomeSongOrSetlistRefused pins that a *.cifra.md / *.setlist.md pushed to a
// home book is refused with its own reason — it belongs in a songbook (§8).
func TestHomeSongOrSetlistRefused(t *testing.T) {
	for _, path := range []string{"cancao.cifra.md", "abertura.setlist.md"} {
		r := reasonSongInHomeBook(path)
		if !strings.Contains(r, "song or setlist") || !strings.Contains(r, path) {
			t.Errorf("reasonSongInHomeBook(%q) = %q; want it to name the path and 'song or setlist'", path, r)
		}
	}
}

// TestHomeDisallowedPathRefused pins the refusal for a path outside the §2.1
// whitelist (a stray file, a folder).
func TestHomeDisallowedPathRefused(t *testing.T) {
	r := reasonDisallowedHomePath("notas.txt")
	if !strings.Contains(r, "not an allowed path") || !strings.Contains(r, "notas.txt") {
		t.Errorf("reasonDisallowedHomePath = %q; want it to name the path and 'not an allowed path'", r)
	}
}

// TestHomeReadmeAndGitattributesBytes pins the exact §2.2 bytes: the app's exact
// README.md/.gitattributes accepted, any other bytes refused naming only the
// path. The home book's .gitattributes differs from a songbook's (merge=binary,
// not the cifra driver).
func TestHomeReadmeAndGitattributesBytes(t *testing.T) {
	if r := homeBlobReason(homeReadme, "README.md", []byte(expectedHomeReadme)); r != "" {
		t.Errorf("the exact §2.2 README.md should be accepted, got %q", r)
	}
	if r := homeBlobReason(homeGitattributes, ".gitattributes", []byte(expectedHomeGitattributes)); r != "" {
		t.Errorf("the exact §2.2 .gitattributes should be accepted, got %q", r)
	}
	if r := homeBlobReason(homeReadme, "README.md", []byte("# Not the home book\n")); r == "" ||
		!strings.Contains(r, "README.md") || !strings.Contains(r, "does not hold exactly") {
		t.Errorf("a wrong README.md should be refused naming the path, got %q", r)
	}
	// A songbook's .gitattributes bytes are not a home book's.
	if r := homeBlobReason(homeGitattributes, ".gitattributes", []byte(expectedGitattributes)); r == "" ||
		!strings.Contains(r, ".gitattributes") || !strings.Contains(r, "does not hold exactly") {
		t.Errorf("a songbook .gitattributes should be refused in a home book, got %q", r)
	}
}

// TestHomeBookPerFileCap pins that the home-book layer applies the same 256 KB
// per-file cap as a songbook (§8: "the 256 KB of workflow 14 applies"): the
// shared withinSizeLimit/maxBlobBytes carry over, and the over-size refusal names
// the path and the limit. The real pack walk is exercised in the behavior test.
func TestHomeBookPerFileCap(t *testing.T) {
	if !withinSizeLimit("blob", maxBlobBytes) {
		t.Errorf("a blob of exactly maxBlobBytes should be within the cap")
	}
	if withinSizeLimit("blob", maxBlobBytes+1) {
		t.Errorf("a blob of maxBlobBytes+1 should be over the cap")
	}
	r := reasonOverSizeBlob("preferences.json", maxBlobBytes+1)
	if !strings.Contains(r, "preferences.json") || !strings.Contains(r, "per-file limit") {
		t.Errorf("reasonOverSizeBlob = %q; want it to name the path and the per-file limit", r)
	}
}

// TestHomeRefusalNamesFaultNotContent pins DIRECTION §3.3 / §8 line 494: a refusal
// names the path and the aspect, never a settings value. A secret planted as a
// setting's value never appears in the refusal.
func TestHomeRefusalNamesFaultNotContent(t *testing.T) {
	const secret = "SEGREDO-DO-VALOR-DE-CONFIGURACAO-12345"
	// A non-canonical settings file (value before at) carrying the secret as its
	// value — refused for the key order, but the value must not leak.
	content := "{\n  \"theme\": {\n    \"value\": \"" + secret + "\",\n    \"at\": \"2026-10-05T14:30:00.000Z\"\n  }\n}\n"
	r := settingsReason("preferences.json", []byte(content))
	if r == "" {
		t.Fatal("the non-canonical settings file should be refused")
	}
	if strings.Contains(r, secret) {
		t.Errorf("refusal %q leaked the settings value %q", r, secret)
	}
	if !strings.Contains(r, "preferences.json") || !strings.Contains(r, "not in canonical form") {
		t.Errorf("refusal %q should name the path and the aspect", r)
	}
}

// TestIsHomeBook pins the kind gate: only "home" selects the home-book validator;
// an absent or unrecognised kind stays on the songbook path (fail closed).
func TestIsHomeBook(t *testing.T) {
	cases := []struct {
		env  map[string]string
		want bool
	}{
		{map[string]string{"ESTANTE_BOOK_KIND": "home"}, true},
		{map[string]string{"ESTANTE_BOOK_KIND": "songbook"}, false},
		{map[string]string{"ESTANTE_BOOK_KIND": "nonsense"}, false},
		{map[string]string{}, false},
	}
	for _, c := range cases {
		lookup := func(k string) (string, bool) { v, ok := c.env[k]; return v, ok }
		if got := IsHomeBook(lookup); got != c.want {
			t.Errorf("IsHomeBook(%v) = %v, want %v", c.env, got, c.want)
		}
	}
}

// TestHomeCanonicalEmitterIsFixedPoint pins the §6 fixed-point property on the
// emitter itself: canonicalising a canonical file changes nothing (the bytes the
// validator compares against are the input's own).
func TestHomeCanonicalEmitterIsFixedPoint(t *testing.T) {
	for _, src := range []string{canonicalPreferences, canonicalOpaqueRegister, "{}\n"} {
		canon, detail := canonicalizeSettings([]byte(src))
		if detail != "" {
			t.Fatalf("canonicalizeSettings(%q) failed: %s", src, detail)
		}
		if !bytes.Equal(canon, []byte(src)) {
			t.Errorf("canonical form is not a fixed point:\n got %q\nwant %q", canon, src)
		}
	}
}

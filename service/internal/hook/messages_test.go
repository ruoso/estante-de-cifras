package hook

// messages_test.go is the refusal catalogue: one message per refusal the hook
// can produce, driven through its pure reason-producer and held to the single
// contract hook.messages establishes. It asserts, per distinct reason:
//
//   - the grammar — "<subject>: <fault>; refused", the subject refs/heads/main
//     except the ref-name rule, which names the offending ref;
//   - that it names its fault (the expected substring) and subject;
//   - that the account-quota reason names the pushing user (ESTANTE_USER); and
//   - the cross-cutting invariant: a crafted song body, a conflict-marker line's
//     text, and a mismatching README's bytes, fed through the producers, never
//     appear in the emitted message.
//
// No git, no DB — every producer here is pure (the reachability walk, the
// stack-over-HTTP path and the fail-closed emission are the behavior, e2e and
// cmd levels). Pins workflow 14 L92-93 ("refused whole, naming what failed")
// and DIRECTION §3.6 L346 (names the user); the standing "no song text in logs"
// rule (DIRECTION §3.3), generalised across the whole matrix.

import (
	"strings"
	"testing"

	cifra "github.com/ruoso/cifra.md/go"
)

// Secrets that must never leak into a refusal — purpose-written filler, never
// copyrighted words: a song's lyric bytes, the text a conflict marker carries,
// and a README's title bytes. Each is fed through a producer below; the
// catalogue asserts none reaches the emitted message.
const (
	songSecret   = "SegredoDoVersoCantadoAqui"
	markerSecret = "nossa-versao-SEGREDO-do-merge"
	readmeSecret = "TituloSecretoDoReadme"
)

// splitRefusal checks the shared grammar — got is "<subject>: <fault>; refused"
// — and returns the fault so the caller can assert on what it names. A fault
// that is empty, or that itself carries a second "; refused", fails.
func splitRefusal(t *testing.T, name, got, subject string) string {
	t.Helper()
	prefix := subject + ": "
	if !strings.HasPrefix(got, prefix) {
		t.Errorf("%s: message %q does not start with subject %q", name, got, prefix)
	}
	if !strings.HasSuffix(got, "; refused") {
		t.Errorf("%s: message %q does not end '; refused'", name, got)
	}
	fault := strings.TrimSuffix(strings.TrimPrefix(got, prefix), "; refused")
	if strings.TrimSpace(fault) == "" {
		t.Errorf("%s: message %q names no fault", name, got)
	}
	if strings.Contains(fault, "; refused") {
		t.Errorf("%s: message %q has a doubled '; refused'", name, got)
	}
	return fault
}

func TestRefusalCatalogue(t *testing.T) {
	// A non-canonical song fed the lyric secret: parses or not, it is not
	// canonical, so blobReason refuses it "not in canonical form" without echoing
	// its bytes. The ### subsection the writer normalises to ## makes it
	// non-canonical; the secret rides as a lyric line.
	nonCanonicalSong := []byte("# Cancao de Teste\n\n### A\n```\nC | G\n```\n" + songSecret + "\n")
	if _, ok := cifra.FormOf(nonCanonicalSong); ok {
		t.Fatalf("non-canonical song fixture must not be canonical")
	}
	// A song carrying a conflict marker whose text is the secret.
	markedSong := []byte("# Com Conflito\n\n## A\n```\nC | G\n```\n<<<<<<< " + markerSecret + "\n")
	// A README breaking a text rule (a tab) with the secret as its heading.
	readmeTab := []byte("# " + readmeSecret + "\n\n\tindentado\n")

	// A path component past the 255-byte limit.
	longComponent := "pasta/" + strings.Repeat("a", maxNameBytes+1) + ".cifra.md"

	cases := []struct {
		name     string
		got      string
		subject  string
		wantSubs []string // fault substrings that name what failed
	}{
		// --- refs (hook.refs) ---
		{
			name:     "refs: wrong ref names the offending ref",
			got:      refusalOf(CheckStructure(RefUpdate{Old: "1111111111111111111111111111111111111111", New: "2222222222222222222222222222222222222222", Ref: "refs/tags/v1"})),
			subject:  "refs/tags/v1",
			wantSubs: []string{"only refs/heads/main"},
		},
		{
			name:     "refs: deletion",
			got:      refusalOf(CheckStructure(RefUpdate{Old: "1111111111111111111111111111111111111111", New: ZeroSHA, Ref: MainRef})),
			subject:  MainRef,
			wantSubs: []string{"deleting the branch"},
		},
		{
			// The non-fast-forward reason refs.go emits (line 130): produced through
			// the production grammar helper with its exact fault, so the catalogue
			// holds it to the contract. The real push drives it at the behavior
			// (cmd) and e2e levels.
			name:     "refs: non-fast-forward",
			got:      refusal(MainRef, "non-fast-forward update (history rewrite) is not allowed"),
			subject:  MainRef,
			wantSubs: []string{"non-fast-forward"},
		},

		// --- stowaways (hook.stowaways) ---
		{
			name:     "stowaways: one surplus object",
			got:      StowawayReason(objSet("c", "t", "b", "s"), objSet("c", "t", "b"), nil),
			subject:  MainRef,
			wantSubs: []string{"1 object", "stowaway"},
		},
		{
			name:     "stowaways: several surplus objects",
			got:      StowawayReason(objSet("c", "t", "b", "s", "s2", "had"), objSet("c", "t", "b"), objSet("had")),
			subject:  MainRef,
			wantSubs: []string{"2 object", "stowaway"},
		},

		// --- contents (hook.contents) ---
		{
			name:     "contents: bad mode (symlink)",
			got:      reasonBadMode("link.cifra.md", modeDescription("120000")),
			subject:  MainRef,
			wantSubs: []string{"link.cifra.md", "symlink"},
		},
		{
			name:     "contents: disallowed path",
			got:      reasonDisallowedPath("notas.txt"),
			subject:  MainRef,
			wantSubs: []string{"notas.txt", "not an allowed path"},
		},
		{
			name:     "contents: over-long component",
			got:      reasonOverLongComponent(longComponent),
			subject:  MainRef,
			wantSubs: []string{"path component longer than"},
		},
		{
			name:     "contents: over-size blob",
			got:      reasonOverSizeBlob("grande.cifra.md", 300*1024),
			subject:  MainRef,
			wantSubs: []string{"grande.cifra.md", "per-file limit"},
		},
		{
			name:     "contents: over-size carrier object",
			got:      reasonOverSizeObject("commit", 200*1024),
			subject:  MainRef,
			wantSubs: []string{"commit object", "reasonable-size limit"},
		},
		{
			name:     "contents: non-UTF-8",
			got:      reasonNonUTF8("binario.cifra.md"),
			subject:  MainRef,
			wantSubs: []string{"binario.cifra.md", "not valid UTF-8"},
		},
		{
			name:     "contents: wrong .gitattributes",
			got:      reasonWrongGitattributes(".gitattributes"),
			subject:  MainRef,
			wantSubs: []string{".gitattributes", "does not hold exactly"},
		},

		// --- canonical (hook.canonical) ---
		{
			name:     "canonical: song not canonical",
			got:      blobReason(kindSong, "cancao.cifra.md", nonCanonicalSong, cifra.FormOf),
			subject:  MainRef,
			wantSubs: []string{"cancao.cifra.md", "not in canonical form"},
		},
		{
			name:     "canonical: conflict marker",
			got:      blobReason(kindSong, "conflito.cifra.md", markedSong, cifra.FormOf),
			subject:  MainRef,
			wantSubs: []string{"conflito.cifra.md", "conflict marker"},
		},
		{
			name:     "canonical: README byte-order mark",
			got:      readmeReason("README.md", []byte(string(rune(0xFEFF))+"# Readme\n")),
			subject:  MainRef,
			wantSubs: []string{"README.md", "byte-order mark"},
		},
		{
			name:     "canonical: README carriage return",
			got:      readmeReason("README.md", []byte("# Readme\r\n")),
			subject:  MainRef,
			wantSubs: []string{"README.md", "carriage return"},
		},
		{
			name:     "canonical: README tab",
			got:      readmeReason("README.md", readmeTab),
			subject:  MainRef,
			wantSubs: []string{"README.md", "has a tab"},
		},
		{
			name:     "canonical: README not NFC",
			got:      readmeReason("README.md", []byte("# Café\n")),
			subject:  MainRef,
			wantSubs: []string{"README.md", "NFC"},
		},
		{
			name:     "canonical: README missing final newline",
			got:      readmeReason("README.md", []byte("# Readme")),
			subject:  MainRef,
			wantSubs: []string{"README.md", "final newline"},
		},
		{
			name:     "canonical: README extra final newline",
			got:      readmeReason("README.md", []byte("# Readme\n\n")),
			subject:  MainRef,
			wantSubs: []string{"README.md", "extra final newline"},
		},
		{
			name:     "canonical: README conflict marker",
			got:      readmeReason("README.md", []byte("# Readme\n>>>>>>> "+markerSecret+"\n")),
			subject:  MainRef,
			wantSubs: []string{"README.md", "conflict marker"},
		},

		// --- limits (hook.limits) ---
		{
			name:     "limits: per-book cap",
			got:      firstReason(t, decideLimits(maxBookBytes-1024, 10*1024*1024, 1025, "acc-book")),
			subject:  MainRef,
			wantSubs: []string{"per-book limit", "50 MB"},
		},
		{
			name:     "limits: per-account cap names the user",
			got:      firstReason(t, decideLimits(0, 1000, 2000, "acc-quota-7")),
			subject:  MainRef,
			wantSubs: []string{"account", "storage limit", "acc-quota-7"},
		},
	}

	// Every secret fed through a producer above must stay out of every message.
	secrets := []string{songSecret, markerSecret, readmeSecret}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if c.got == "" {
				t.Fatalf("%s: producer returned no refusal", c.name)
			}
			splitRefusal(t, c.name, c.got, c.subject)
			for _, sub := range c.wantSubs {
				if !strings.Contains(c.got, sub) {
					t.Errorf("%s: message %q does not name %q", c.name, c.got, sub)
				}
			}
			for _, secret := range secrets {
				if strings.Contains(c.got, secret) {
					t.Errorf("%s: message %q leaked song/file content %q", c.name, c.got, secret)
				}
			}
		})
	}
}

// refusalOf drops CheckStructure's needsAncestry (irrelevant to the catalogue)
// and returns just the reason; the table's empty-string guard flags an
// unexpected acceptance.
func refusalOf(reason string, _ bool) string {
	return reason
}

// firstReason returns the single reason a one-cap decideLimits produced, failing
// the test if the producer did not return exactly one.
func firstReason(t *testing.T, reasons []string) string {
	t.Helper()
	if len(reasons) != 1 {
		t.Fatalf("want exactly one refusal, got %v", reasons)
	}
	return reasons[0]
}

// objSet builds the object-id set StowawayReason takes (the ids are opaque here
// — only the count is ever reported).
func objSet(ids ...string) map[string]struct{} {
	s := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		s[id] = struct{}{}
	}
	return s
}

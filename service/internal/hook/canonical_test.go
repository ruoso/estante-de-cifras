package hook

// Unit test for the canonical-form layer's per-blob decision (blobReason),
// isolated from the git walk. No git, no DB. It decides a song, a setlist or the
// root README blob the way hook.Canonical does, so every case is cheap to pin
// here (the reachability walk and the stack-over-HTTP path are the behavior and
// e2e levels). Canonicity is decided by cifra.md for Go, so a canonical fixture
// is produced by the Go writer itself (Write(Parse)) rather than hand-spelled.
//
// Pins workflow 14 §"Canonical form" (docs/workflows/14-file-view.md:51-82) and
// the §"What the service checks" canonical clause (L102-104); DIRECTION §2.2
// L95-97, §3.3 (no song text in logs), §3.6 L302-306 (current-or-previous form);
// spec §8.1, §8.4.1, §9.1 L61-62, §10.9, §11.12.3.

import (
	"bytes"
	"strings"
	"testing"

	cifra "github.com/ruoso/cifra.md/go"
)

// mustCanonicalSong returns the canonical bytes of a purpose-written song (never
// copyrighted words), produced by the Go writer so it is canonical by
// construction — the fixed point §9.1 checks.
func mustCanonicalSong(t *testing.T, src string) []byte {
	t.Helper()
	model, err := cifra.Parse([]byte(src))
	if err != nil {
		t.Fatalf("parse song fixture: %v", err)
	}
	out, err := cifra.Write(model)
	if err != nil {
		t.Fatalf("write song fixture: %v", err)
	}
	if _, ok := cifra.FormOf(out); !ok {
		t.Fatalf("song fixture is not canonical after Write(Parse)")
	}
	return out
}

// mustCanonicalSetlist is mustCanonicalSong for a setlist (spec §10.9).
func mustCanonicalSetlist(t *testing.T, src string) []byte {
	t.Helper()
	model, err := cifra.ParseSetlist([]byte(src))
	if err != nil {
		t.Fatalf("parse setlist fixture: %v", err)
	}
	out, err := cifra.WriteSetlist(model)
	if err != nil {
		t.Fatalf("write setlist fixture: %v", err)
	}
	if _, ok := cifra.SetlistFormOf(out); !ok {
		t.Fatalf("setlist fixture is not canonical after WriteSetlist(ParseSetlist)")
	}
	return out
}

// TestBlobReasonSong pins song canonicity (workflow 14 L51-53, L102; spec §8.1,
// §9.1 L61-62, §11.12.3): a canonical song accepted; a non-canonical one, a
// non-UTF-8 one, and one holding each of git's four conflict-marker lines
// refused.
func TestBlobReasonSong(t *testing.T) {
	canonical := mustCanonicalSong(t, "# Afinacao de Teste\n\n## A\n```\nC | G7 | C | F\n```\n")
	if r := blobReason(kindSong, "afinacao.cifra.md", canonical, cifra.FormOf); r != "" {
		t.Errorf("canonical song: want accepted, got refusal %q", r)
	}

	// Parses fine but is not canonical (a ### subsection the writer normalises to
	// ##, and irregular bar spacing) — purpose-written filler, never real words.
	nonCanonical := []byte("# Afinacao de Teste\n\n### A\n```\n  C  |  G7 | C |F\n```\n")
	if _, ok := cifra.FormOf(nonCanonical); ok {
		t.Fatalf("non-canonical fixture must not be canonical")
	}
	if r := blobReason(kindSong, "afinacao.cifra.md", nonCanonical, cifra.FormOf); r == "" ||
		!strings.Contains(r, "not in canonical form") || !strings.Contains(r, "afinacao.cifra.md") {
		t.Errorf("non-canonical song: want refusal naming path and 'not in canonical form', got %q", r)
	}

	nonUTF8 := []byte{'#', ' ', 'X', '\n', 0xc3, 0x28, '\n'}
	if r := blobReason(kindSong, "invalida.cifra.md", nonUTF8, cifra.FormOf); r == "" {
		t.Errorf("non-UTF-8 song: want refusal, got accepted")
	}

	for _, m := range []string{"<<<<<<<", "=======", ">>>>>>>", "|||||||"} {
		marked := []byte("# Com Conflito\n\n## A\n```\nC | G\n```\n" + m + " ours\n")
		r := blobReason(kindSong, "conflito.cifra.md", marked, cifra.FormOf)
		if r == "" || !strings.Contains(r, "conflict marker") || !strings.Contains(r, "conflito.cifra.md") {
			t.Errorf("marked song (%q): want 'conflict marker' refusal naming path, got %q", m, r)
		}
	}
}

// TestBlobReasonSetlist pins setlist canonicity (workflow 14 L63; spec §10.9):
// a canonical setlist accepted; a non-canonical one refused; a marked one
// refused.
func TestBlobReasonSetlist(t *testing.T) {
	canonical := mustCanonicalSetlist(t, "# Show de Teste\n\n1. [Primeira](primeira.cifra.md)\n2. [Segunda](segunda.cifra.md)\n")
	if r := blobReason(kindSetlist, "show.setlist.md", canonical, cifra.SetlistFormOf); r != "" {
		t.Errorf("canonical setlist: want accepted, got refusal %q", r)
	}

	// Non-canonical numbering (5)/3./2), renumbered to 1./2./3. by the writer) —
	// purpose-written filler.
	nonCanonical := []byte("5) [Primeira](primeira.cifra.md)\n   3. [Segunda](segunda.cifra.md)\n2)    [Terceira](terceira.cifra.md)\n")
	if _, ok := cifra.SetlistFormOf(nonCanonical); ok {
		t.Fatalf("non-canonical setlist fixture must not be canonical")
	}
	if r := blobReason(kindSetlist, "show.setlist.md", nonCanonical, cifra.SetlistFormOf); r == "" ||
		!strings.Contains(r, "not in canonical form") || !strings.Contains(r, "show.setlist.md") {
		t.Errorf("non-canonical setlist: want refusal naming path, got %q", r)
	}

	marked := []byte("# Show\n\n1. [A](a.cifra.md)\n<<<<<<< ours\n")
	if r := blobReason(kindSetlist, "show.setlist.md", marked, cifra.SetlistFormOf); r == "" ||
		!strings.Contains(r, "conflict marker") {
		t.Errorf("marked setlist: want 'conflict marker' refusal, got %q", r)
	}
}

// TestBlobReasonDualForm pins the current-or-previous-form rule (workflow 14
// L77-82; DIRECTION §3.6 L302-306) with a synthetic two-form checker — the shape
// cifra_go.versions proves with. The shipped registry holds exactly one form, so
// the dual-form behaviour is exercised here with an injected checker rather than
// at the behavior level with an invented published form. The synthetic previous
// form is a CRLF variant of a canonical song (LF is a fixed text rule; a faithful
// model of a text-rule form change).
func TestBlobReasonDualForm(t *testing.T) {
	canonical := mustCanonicalSong(t, "# Dupla Forma\n\n## A\n```\nC | G7 | C | F\n```\n")
	crlf := bytes.ReplaceAll(canonical, []byte("\n"), []byte("\r\n"))

	// current = cifra.FormOf (the real current-form check); previous "0-crlf" =
	// canonical except for CRLF line endings, recognised only there.
	synthetic := func(text []byte) (cifra.Form, bool) {
		if f, ok := cifra.FormOf(text); ok {
			return f, true
		}
		lf := bytes.ReplaceAll(text, []byte("\r\n"), []byte("\n"))
		if !bytes.Equal(lf, text) {
			if _, ok := cifra.FormOf(lf); ok {
				return cifra.Form("0-crlf"), true
			}
		}
		return "", false
	}

	// A text canonical only under the previous form is accepted …
	if r := blobReason(kindSong, "dupla.cifra.md", crlf, synthetic); r != "" {
		t.Errorf("previous-form (CRLF) song: want accepted, got refusal %q", r)
	}
	// … and one canonical under the current form is accepted …
	if r := blobReason(kindSong, "dupla.cifra.md", canonical, synthetic); r != "" {
		t.Errorf("current-form song: want accepted, got refusal %q", r)
	}
	// … while one canonical under neither is refused.
	nonCanonical := []byte("# Dupla Forma\n\n### A\n```\n  C |G\n```\n")
	if _, ok := synthetic(nonCanonical); ok {
		t.Fatalf("neither-form fixture must be in no form")
	}
	if r := blobReason(kindSong, "dupla.cifra.md", nonCanonical, synthetic); r == "" {
		t.Errorf("neither-form song: want refusal, got accepted")
	}
	// A marked or non-UTF-8 text is refused under the synthetic registry too.
	marked := []byte("# Dupla Forma\n\n## A\n```\nC | G\n```\n<<<<<<< ours\n")
	if r := blobReason(kindSong, "dupla.cifra.md", marked, synthetic); r == "" ||
		!strings.Contains(r, "conflict marker") {
		t.Errorf("marked song under synthetic registry: want 'conflict marker' refusal, got %q", r)
	}
	if r := blobReason(kindSong, "dupla.cifra.md", []byte{0xff, 0xfe}, synthetic); r == "" {
		t.Errorf("non-UTF-8 song under synthetic registry: want refusal, got accepted")
	}
}

// TestReadmeRules pins the root README text rules (workflow 14 L64-65, L72;
// spec §8.4.1, §11.12.3): a clean README accepted; a byte-order mark, a CR, a
// tab, a non-NFC sequence, a missing final newline, an extra final newline, and
// a conflict-marker line each refused, naming which rule and the path, never the
// bytes.
func TestReadmeRules(t *testing.T) {
	if r := blobReason(kindReadme, "README.md", []byte("# A Test Songbook\n"), nil); r != "" {
		t.Errorf("clean README: want accepted, got refusal %q", r)
	}

	cases := []struct {
		name    string
		content []byte
		want    string
	}{
		{"byte-order mark", append([]byte(string(rune(0xFEFF))), "# Songbook\n"...), "byte-order mark"},
		{"carriage return", []byte("# Songbook\r\n"), "carriage return"},
		{"tab", []byte("#\tSongbook\n"), "tab"},
		{"not NFC", []byte("# Café\n"), "NFC"}, // "Cafe" + combining acute = NFD, not NFC
		{"missing final newline", []byte("# Songbook"), "final newline"},
		{"extra final newline", []byte("# Songbook\n\n"), "final newline"},
		{"conflict marker", []byte("# Songbook\n<<<<<<< ours\n"), "conflict marker"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := blobReason(kindReadme, "README.md", c.content, nil)
			if r == "" || !strings.Contains(r, c.want) || !strings.Contains(r, "README.md") {
				t.Errorf("README with %s: want refusal naming %q and path, got %q", c.name, c.want, r)
			}
		})
	}
}

// TestRefusalNamesFaultNotBytes pins DIRECTION §3.3 (no song text in logs): a
// refused marked song's reason names the path and the fault but never the marker
// line's text nor the blob bytes.
func TestRefusalNamesFaultNotBytes(t *testing.T) {
	secret := "SEGREDO-DENTRO-DO-CONFLITO-98765"
	marked := []byte("# Com Conflito\n\n## A\n```\nC | G\n```\n<<<<<<< " + secret + "\n")
	r := blobReason(kindSong, "conflito.cifra.md", marked, cifra.FormOf)
	if r == "" {
		t.Fatal("marked song should be refused")
	}
	if strings.Contains(r, secret) {
		t.Errorf("refusal must not contain the marker line text; got %q", r)
	}
	if !strings.Contains(r, "conflito.cifra.md") || !strings.Contains(r, "conflict marker") {
		t.Errorf("refusal should name the path and the fault; got %q", r)
	}
}

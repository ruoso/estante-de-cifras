package cifra

// Unit tests for the form-aware canonicality surface (versions.go): the registry
// dispatch and the production song/setlist surfaces. Pins DIRECTION §3.6
// "Versions" and workflow 14 §Canonical form — the "current or previous"
// disjunction and reporting which form a text is in. The corpus harness never
// calls these; like IsCanonical, they are unit-tested on corpus texts.

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

// TestFormOfDualForm drives the unexported formOf dispatch against a synthetic
// two-form registry, the case the .tji names: "a text canonical only under the
// previous form passes the previous check and fails the current one, and the
// reverse." The synthetic previous form is a CRLF variant of a canonical song —
// a faithful model of a text-rule form change, since LF is a fixed text rule
// (workflow 14 §Canonical form lines 64-65).
func TestFormOfDualForm(t *testing.T) {
	canonical, err := os.ReadFile(filepath.Join("..", "corpus", "01-minimal-chart", "canonical.cifra.md"))
	if err != nil {
		t.Fatal(err)
	}
	input, err := os.ReadFile(filepath.Join("..", "corpus", "01-minimal-chart", "input.cifra.md"))
	if err != nil {
		t.Fatal(err)
	}

	// prevCheck recognises a song canonical except for CRLF line endings: it is
	// canonical under the "previous" (CRLF) form, never under the current one.
	prevCheck := func(text []byte) bool {
		return bytes.Contains(text, []byte("\r\n")) && isCanonical(bytes.ReplaceAll(text, []byte("\r\n"), []byte("\n")))
	}
	const prevForm = Form("0-crlf")
	forms := []formCheck{
		{CurrentForm, isCanonical},
		{prevForm, prevCheck},
	}

	crlf := bytes.ReplaceAll(canonical, []byte("\n"), []byte("\r\n"))

	// The LF canonical passes the current check, fails the previous one.
	if got, ok := formOf(forms, canonical); !ok || got != CurrentForm {
		t.Errorf("formOf(LF canonical) = (%q, %v), want (%q, true)", got, ok, CurrentForm)
	}
	// Its CRLF variant passes the previous check, fails the current one ("and
	// the reverse").
	if got, ok := formOf(forms, crlf); !ok || got != prevForm {
		t.Errorf("formOf(CRLF variant) = (%q, %v), want (%q, true)", got, ok, prevForm)
	}
	// A non-canonical input / marked text / non-UTF-8 text is in no form.
	for name, text := range map[string][]byte{
		"non-canonical input": input,
		"marked text":         []byte("## A\n```\nC\n```\n<<<<<<< ours\n"),
		"non-UTF-8":           []byte("# T\n\xff\n"),
	} {
		if got, ok := formOf(forms, text); ok || got != "" {
			t.Errorf("formOf(%s) = (%q, %v), want (%q, false)", name, got, ok, "")
		}
	}
}

// TestFormOfSong pins the production song surface: AcceptedForms, and FormOf on
// a canonical corpus song, its non-canonical input, a marked text and a
// non-UTF-8 text.
func TestFormOfSong(t *testing.T) {
	canonical, err := os.ReadFile(filepath.Join("..", "corpus", "01-minimal-chart", "canonical.cifra.md"))
	if err != nil {
		t.Fatal(err)
	}
	input, err := os.ReadFile(filepath.Join("..", "corpus", "01-minimal-chart", "input.cifra.md"))
	if err != nil {
		t.Fatal(err)
	}

	if forms := AcceptedForms(); len(forms) != 1 || forms[0] != CurrentForm {
		t.Errorf("AcceptedForms() = %v, want [%q]", forms, CurrentForm)
	}
	if got, ok := FormOf(canonical); !ok || got != CurrentForm {
		t.Errorf("FormOf(canonical.cifra.md) = (%q, %v), want (%q, true)", got, ok, CurrentForm)
	}
	for name, text := range map[string][]byte{
		"input.cifra.md": input,
		"marked text":    []byte("## A\n```\nC\n```\n<<<<<<< ours\n"),
		"non-UTF-8":      []byte("# T\n\xff\n"),
	} {
		if got, ok := FormOf(text); ok || got != "" {
			t.Errorf("FormOf(%s) = (%q, %v), want (%q, false)", name, got, ok, "")
		}
	}
}

// TestFormOfSetlist pins the production setlist surface: IsCanonicalSetlist and
// SetlistFormOf, the setlist half of hook.canonical's "every song and setlist …
// canonical under the current or the previous form." The .tji names
// 35-setlist-minimal, whose input equals its canonical; its canonical gives the
// true case, and 40-setlist-renumbering's input (genuinely non-canonical:
// `5)`/`3.`/`2)` renumbered to `1.`/`2.`/`3.`) gives the false case.
func TestFormOfSetlist(t *testing.T) {
	canonical, err := os.ReadFile(filepath.Join("..", "corpus", "35-setlist-minimal", "canonical.setlist.md"))
	if err != nil {
		t.Fatal(err)
	}
	input, err := os.ReadFile(filepath.Join("..", "corpus", "40-setlist-renumbering", "input.setlist.md"))
	if err != nil {
		t.Fatal(err)
	}
	marked := []byte("# T\n\n1. [A](a.cifra.md)\n<<<<<<< ours\n")
	nonUTF8 := []byte("# T\n\xff\n")

	if !IsCanonicalSetlist(canonical) {
		t.Error("IsCanonicalSetlist(canonical.setlist.md) = false, want true")
	}
	if IsCanonicalSetlist(input) {
		t.Error("IsCanonicalSetlist(non-canonical input) = true, want false")
	}
	if IsCanonicalSetlist(marked) {
		t.Error("IsCanonicalSetlist(marked setlist) = true, want false")
	}
	if IsCanonicalSetlist(nonUTF8) {
		t.Error("IsCanonicalSetlist(non-UTF-8 setlist) = true, want false")
	}

	if got, ok := SetlistFormOf(canonical); !ok || got != CurrentForm {
		t.Errorf("SetlistFormOf(canonical.setlist.md) = (%q, %v), want (%q, true)", got, ok, CurrentForm)
	}
	if got, ok := SetlistFormOf(input); ok || got != "" {
		t.Errorf("SetlistFormOf(non-canonical input) = (%q, %v), want (%q, false)", got, ok, "")
	}
}

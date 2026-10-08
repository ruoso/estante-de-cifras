package cifra

// Unit tests for §4 words: the §4.2 sung/lyric/annotation classification, the
// `words` property override, chord-to-word attachment, and the `>` forced marker.
// Purpose-written songs; agreement with the reference and JS twin is by the
// corpus, not shared code. (The §4.5 layout convergence has its own file.)

import "testing"

func TestChordsOverProseMakeDocumentSung(t *testing.T) {
	m := parseSong(t, "## Verse\n```\nG       D\nWhen I saw you now\n```\n")
	if !obool(m, "sung") {
		t.Fatal("a chord line over a prose line should make the document sung (§4.2)")
	}
	if at, ok := oint(m, "sungAt"); !ok || at != 4 {
		t.Errorf("sungAt = %d (ok=%v), want 4", at, ok)
	}
	line := musicLinesOf(sectionAt(m, 0))[0].(*Object)
	if objString(line, "kind") != "sung" {
		t.Fatalf("line kind = %q, want sung", objString(line, "kind"))
	}
	// Each chord carries its attached words (§4.4).
	var withWords int
	for _, mEl := range objArray(line, "measures") {
		for _, itEl := range objArray(mEl.(*Object), "items") {
			it := itEl.(*Object)
			if objString(it, "type") == "chord" && objString(it, "words") != "" {
				withWords++
			}
		}
	}
	if withWords == 0 {
		t.Error("expected chords with attached words on a sung line")
	}
}

func TestWordsPropertyNoForcesNotSung(t *testing.T) {
	m := parseSong(t, "- words: no\n## Verse\n```\nG       D\nWhen I saw you now\n```\n")
	if obool(m, "sung") {
		t.Error("`words: no` must make the document not sung (§4.2)")
	}
	if at, _ := m.Get("sungAt"); at != nil {
		t.Errorf("sungAt = %v, want nil when not sung", at)
	}
}

func TestWordsPropertyYesForcesSung(t *testing.T) {
	m := parseSong(t, "- words: yes\n## Verse\n```\nJust singing along here\n```\n")
	if !obool(m, "sung") {
		t.Error("`words: yes` must make the document sung (§4.2)")
	}
	line := musicLinesOf(sectionAt(m, 0))[0].(*Object)
	if objString(line, "kind") != "lyric" {
		t.Errorf("a prose line with no chords above it is a lyric, got %q", objString(line, "kind"))
	}
}

func TestAnnotationLine(t *testing.T) {
	m := parseSong(t, "## Verse\n```\n// play softly\nG D\n```\n")
	lines := musicLinesOf(sectionAt(m, 0))
	first := lines[0].(*Object)
	if objString(first, "kind") != "annotation" {
		t.Fatalf("first line kind = %q, want annotation", objString(first, "kind"))
	}
	if objString(first, "text") != "play softly" {
		t.Errorf("annotation text = %q, want %q", objString(first, "text"), "play softly")
	}
}

func TestForcedMarkerMakesSungLineForced(t *testing.T) {
	m := parseSong(t, "## Verse\n```\nG       D\n>When I saw you now\n```\n")
	if !obool(m, "sung") {
		t.Fatal("a `>` forced line should make the document sung")
	}
	line := musicLinesOf(sectionAt(m, 0))[0].(*Object)
	if objString(line, "kind") != "sung" {
		t.Fatalf("line kind = %q, want sung", objString(line, "kind"))
	}
	if !obool(line, "forced") {
		t.Error("a sung line whose words were forced with `>` should have forced: true")
	}
}

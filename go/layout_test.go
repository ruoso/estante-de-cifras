package cifra

// Unit tests for §4.5 sung-line layout convergence: words pushed so every chord
// stays over its character, the division of words between chords (§4.4), the
// `forced` branch when the laid-out words would no longer read as words, and the
// misread detection the leading-`,` guard keys off (§8.5.4). The reader lays a
// sung line out exactly as canonical form writes it, so reading a document and
// reading its canonical form give the same sung lines; the corpus pins that
// byte-for-byte (entries 13, 28, 33, 34). Purpose-written songs here; agreement
// is by the corpus, not shared code.

import (
	"strings"
	"testing"
)

// sungLineItems flattens a sung line's items to (type, key, column, words).
type sungItem struct {
	typ, key, words string
	column          int
}

func sungItemsOf(line *Object) []sungItem {
	var out []sungItem
	for _, mEl := range objArray(line, "measures") {
		for _, itEl := range objArray(mEl.(*Object), "items") {
			it := itEl.(*Object)
			col, _ := oint(it, "column")
			out = append(out, sungItem{
				typ:    objString(it, "type"),
				key:    objString(it, "key"),
				words:  objString(it, "words"),
				column: col,
			})
		}
	}
	return out
}

func firstSung(t *testing.T, m Model) *Object {
	t.Helper()
	for _, sEl := range songSections(m) {
		for _, lEl := range musicLinesOf(sEl.(*Object)) {
			if objString(lEl.(*Object), "kind") == "sung" {
				return lEl.(*Object)
			}
		}
	}
	t.Fatal("no sung line")
	return nil
}

func TestSungLinePushesWordsKeepingChordsOverCharacters(t *testing.T) {
	// Mirrors corpus 34-pushed-words line 1: brackets, a lead, chords pushed so
	// each stays over its character.
	m := parseSong(t, "## Verse\n```\n(G   D)    Em\nWhen I first saw you\n```\n")
	line := firstSung(t, m)
	if obool(line, "forced") {
		t.Error("line should not be forced")
	}
	got := sungItemsOf(line)
	want := []sungItem{
		{typ: "lead", column: 0, words: "W"},
		{typ: "mark", column: 0},
		{typ: "chord", key: "G", column: 2, words: "hen "},
		{typ: "chord", key: "D", column: 6, words: "I firs"},
		{typ: "mark", column: 8},
		{typ: "chord", key: "Em", column: 12, words: "t saw you"},
	}
	if len(got) != len(want) {
		t.Fatalf("items = %+v, want %+v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("item %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestWordDivisionReconstructsUnpaddedWords(t *testing.T) {
	// §4.4/§4.5: concatenating the lead and each attached item's words, in column
	// order, reproduces the words line with its padding removed.
	cases := []struct {
		src       string
		wordsLine string
	}{
		{"## V\n```\n(G   D)    Em\nWhen I first saw you\n```\n", "When I first saw you"},
		{"## V\n```\n( G     D\nW____hen I was\n```\n", "W____hen I was"},
	}
	for _, c := range cases {
		line := firstSung(t, parseSong(t, c.src))
		var b strings.Builder
		for _, it := range sungItemsOf(line) {
			switch it.typ {
			case "lead", "chord", "nochord", "repeat":
				b.WriteString(it.words)
			}
		}
		unpadded, _ := unpad(c.wordsLine)
		if b.String() != string(unpadded) {
			t.Errorf("reconstructed %q, want %q", b.String(), string(unpadded))
		}
	}
}

func TestForcedWhenLaidWordsWouldNotReadAsWords(t *testing.T) {
	// Mirrors corpus 34 Chorus: "A_m Em la" reads as prose, but once the `_`
	// padding is removed the laid-out words "Am Em la" no longer read as words,
	// so the line becomes forced and is shifted right by one.
	m := parseSong(t, "## Chorus\n```\nG\nA_m Em la\n```\n")
	line := firstSung(t, m)
	if !obool(line, "forced") {
		t.Fatal("line should be forced")
	}
	got := sungItemsOf(line)
	if len(got) != 1 || got[0].typ != "chord" || got[0].key != "G" || got[0].column != 1 || got[0].words != "Am Em la" {
		t.Errorf("items = %+v, want one chord G at column 1 with words \"Am Em la\"", got)
	}
}

func TestMisreadDetection(t *testing.T) {
	// The leading-`,` guard fires when a laid-out chord line would be misread as
	// a heading, an annotation or words (§8.5.4).
	cases := []struct {
		text string
		want bool
	}{
		{"// an annotation", true},
		{"[Intro] C", true},
		{"> forced", true},
		{"Verse: C G", true}, // label heading over a chord run
		{"G C D", false},     // a plain chord line
		{"[2] C", false},     // a bracket holding only digits is not a heading
	}
	for _, c := range cases {
		if got := misread(c.text, "brazilian"); got != c.want {
			t.Errorf("misread(%q) = %v, want %v", c.text, got, c.want)
		}
	}
}

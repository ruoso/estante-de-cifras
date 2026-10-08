package cifra

// Unit tests for §6 tunings and §7 voicings: tuning parsing and identity, voicing
// blocks, fret strings and fingerings (§7.5/§7.5.1), the key correspondence that
// resolves a chart occurrence to its shape (§7.6), voicings ordered by symbol then
// index (§7.7/§8.4.6), and block notes. Purpose-written songs; agreement with the
// reference and the JS twin is by the corpus, not shared code.

import "testing"

const voicingsSong = "## Song\n```\nCm | A | Cm\n```\n\n---\n\n" +
	"## Voicings: E2 A2 D3 G3 B3 E4\n" +
	"- Cm[2]: 8-10-10-8-8-8\n" +
	"- A: x02220 (--123-)\n" +
	"- Cm: x35543\n" +
	"Tune down a step.\n"

func blocksOf(m Model) []*Object {
	var out []*Object
	for _, b := range objArray(m, "blocks") {
		out = append(out, b.(*Object))
	}
	return out
}

func voicingKeys(block *Object) []string {
	out := []string{}
	for _, vEl := range objArray(block, "voicings") {
		out = append(out, objString(vEl.(*Object), "key"))
	}
	return out
}

func voicingByKey(block *Object, key string) *Object {
	for _, vEl := range objArray(block, "voicings") {
		v := vEl.(*Object)
		if objString(v, "key") == key {
			return v
		}
	}
	return nil
}

func fretsEqual(got []any, want []any) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range want {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}

func TestTuningParsedWithIdentity(t *testing.T) {
	blocks := blocksOf(parseSong(t, voicingsSong))
	if len(blocks) != 1 {
		t.Fatalf("blocks = %d, want 1", len(blocks))
	}
	tn := oobj(blocks[0], "tuning")
	if objString(tn, "text") != "E2 A2 D3 G3 B3 E4" {
		t.Errorf("tuning text = %q", objString(tn, "text"))
	}
	if n := len(objArray(tn, "pitches")); n != 6 {
		t.Errorf("pitches = %d, want 6", n)
	}
	if objString(tn, "id") != "40 45 50 55 59 64" {
		t.Errorf("tuning id = %q, want sounding-pitch identity (§6.3)", objString(tn, "id"))
	}
	if objString(blocks[0], "label") != "" {
		t.Errorf("label = %q, want empty (a `Voicings:` heading has no variation name)", objString(blocks[0], "label"))
	}
}

func TestVoicingsOrderedBySymbolThenIndex(t *testing.T) {
	blocks := blocksOf(parseSong(t, voicingsSong))
	got := voicingKeys(blocks[0])
	want := []string{"A", "Cm", "Cm[2]"} // §7.7/§8.4.6, from input order Cm[2], A, Cm
	if len(got) != len(want) {
		t.Fatalf("voicing keys = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("voicing keys = %v, want %v", got, want)
		}
	}
}

func TestFretsAndFingers(t *testing.T) {
	block := blocksOf(parseSong(t, voicingsSong))[0]
	a := voicingByKey(block, "A")
	if !fretsEqual(objArray(a, "frets"), []any{"x", 0, 2, 2, 2, 0}) {
		t.Errorf("A frets = %v", objArray(a, "frets"))
	}
	if !fretsEqual(objArray(a, "fingers"), []any{nil, nil, 1, 2, 3, nil}) {
		t.Errorf("A fingers = %v (§7.5.1)", objArray(a, "fingers"))
	}
	cm := voicingByKey(block, "Cm")
	if !fretsEqual(objArray(cm, "frets"), []any{"x", 3, 5, 5, 4, 3}) {
		t.Errorf("Cm frets = %v", objArray(cm, "frets"))
	}
	if cm.Has("fingers") {
		t.Error("Cm has no fingering and should omit the fingers field")
	}
}

func TestWideFretStringHyphenated(t *testing.T) {
	// §7.5: a fret reaching 10 is written hyphenated, each fret its own number.
	block := blocksOf(parseSong(t, voicingsSong))[0]
	cm2 := voicingByKey(block, "Cm[2]")
	if !fretsEqual(objArray(cm2, "frets"), []any{8, 10, 10, 8, 8, 8}) {
		t.Errorf("Cm[2] frets = %v, want [8 10 10 8 8 8]", objArray(cm2, "frets"))
	}
}

func TestVoicingKeysResolveChartOccurrences(t *testing.T) {
	// §7.6: a chart occurrence resolves to a shape by its footnote key. The two
	// Cm occurrences become Cm and Cm[2]; each has a voicing with the same key.
	m := parseSong(t, voicingsSong)
	line := musicLinesOf(sectionAt(m, 0))[0].(*Object)
	chartKeys := chordKeys(line)
	want := []string{"Cm", "A", "Cm[2]"}
	if len(chartKeys) != len(want) {
		t.Fatalf("chart chord keys = %v, want %v", chartKeys, want)
	}
	block := blocksOf(m)[0]
	for _, k := range chartKeys {
		if voicingByKey(block, k) == nil {
			t.Errorf("chart occurrence %q has no voicing to resolve to", k)
		}
	}
}

func TestBlockNotesKept(t *testing.T) {
	block := blocksOf(parseSong(t, voicingsSong))[0]
	notes := objArray(block, "notes")
	if len(notes) != 1 || notes[0] != "Tune down a step." {
		t.Errorf("block notes = %v, want [\"Tune down a step.\"]", notes)
	}
}

func TestUkuleleTuningFourStrings(t *testing.T) {
	m := parseSong(t, "## S\n```\nC\n```\n\n---\n\n## Voicings: G4 C4 E4 A4\n- C: 0003\n")
	block := blocksOf(m)[0]
	tn := oobj(block, "tuning")
	if n := len(objArray(tn, "pitches")); n != 4 {
		t.Errorf("ukulele pitches = %d, want 4", n)
	}
	if !fretsEqual(objArray(voicingByKey(block, "C"), "frets"), []any{0, 0, 0, 3}) {
		t.Errorf("C frets = %v", objArray(voicingByKey(block, "C"), "frets"))
	}
}

package cifra

// Unit tests for scientific pitch notation and note names (spec §5.1.1, §6.1),
// on purpose-written inputs. Ported in behaviour from the reference's pitch
// tests and mirrored on the corpus — agreement is by the corpus, not shared code.

import "testing"

func TestParseNoteRootGrammar(t *testing.T) {
	cases := []struct {
		text   string
		letter string
		acc    int
	}{
		{"C", "C", 0},
		{"F#", "F", 1},
		{"Bb", "B", -1},
		{"Ebb", "E", -2},
		{"G##", "G", 2},
		{"A♯", "A", 1},
		{"D♭", "D", -1},
	}
	for _, c := range cases {
		n, err := parseNote(c.text)
		if err != nil {
			t.Errorf("parseNote(%q): %v", c.text, err)
			continue
		}
		if n.letter != c.letter || n.accidental != c.acc {
			t.Errorf("parseNote(%q) = {%s %d}, want {%s %d}", c.text, n.letter, n.accidental, c.letter, c.acc)
		}
	}
}

func TestParseNoteRejectsNonNotes(t *testing.T) {
	for _, bad := range []string{"H", "c", "", "C#b", "1"} {
		if _, err := parseNote(bad); err == nil {
			t.Errorf("parseNote(%q) should fail", bad)
		}
	}
}

func TestParsePitchScientific(t *testing.T) {
	cases := []struct {
		text   string
		letter string
		acc    int
		octave int
	}{
		{"E2", "E", 0, 2},
		{"F#3", "F", 1, 3},
		{"Bb1", "B", -1, 1},
		{"C-1", "C", 0, -1},
		{"g4", "G", 0, 4}, // §6.1: the letter is uppercased
	}
	for _, c := range cases {
		p, err := parsePitch(c.text)
		if err != nil {
			t.Errorf("parsePitch(%q): %v", c.text, err)
			continue
		}
		if p.note.letter != c.letter || p.note.accidental != c.acc || p.octave != c.octave {
			t.Errorf("parsePitch(%q) = {%s %d oct %d}, want {%s %d oct %d}",
				c.text, p.note.letter, p.note.accidental, p.octave, c.letter, c.acc, c.octave)
		}
	}
}

func TestMidiAccidentalAppliesToNumber(t *testing.T) {
	// C4 = 60; Cb4 is one semitone below, 59 (§6.1).
	c4, _ := parsePitch("C4")
	if got := midi(c4); got != 60 {
		t.Errorf("midi(C4) = %d, want 60", got)
	}
	cb4, _ := parsePitch("Cb4")
	if got := midi(cb4); got != 59 {
		t.Errorf("midi(Cb4) = %d, want 59", got)
	}
}

func TestCanonicalPitchTextUppercasesLetter(t *testing.T) {
	if got := canonicalPitchText("f#3"); got != "F#3" {
		t.Errorf("canonicalPitchText(f#3) = %q, want F#3", got)
	}
}

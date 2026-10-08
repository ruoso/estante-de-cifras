package cifra

// Unit tests for the §5 chord grammar and canonical model: root/bass/body, the
// §5.2 model, the three dialects and the four ambiguities (§5.6), and §5.4 errors
// reported-and-kept as unknown tokens. Purpose-written symbols; agreement with
// the reference and JS twin is by the corpus, not shared code.

import (
	"fmt"
	"strings"
	"testing"
)

// chordDesc is a compact, readable summary of a parsed chord:
// "root|quality|ext,ext|bass", or "nil" when the symbol is unreadable.
func chordDesc(symbol, dialect string) string {
	r := parseChord(symbol, dialect)
	if r.chord == nil {
		return "nil"
	}
	root := oobj(r.chord, "root")
	exts := []string{}
	for _, eEl := range objArray(r.chord, "extensions") {
		e := eEl.(*Object)
		d, _ := oint(e, "degree")
		a, _ := oint(e, "alter")
		exts = append(exts, fmt.Sprintf("%d:%d", d, a))
	}
	bass := "-"
	if b := oobj(r.chord, "bass"); b != nil {
		bass = noteDesc(b)
	}
	return noteDesc(root) + "|" + objString(r.chord, "quality") + "|" + strings.Join(exts, ",") + "|" + bass
}

func noteDesc(n *Object) string {
	acc, _ := oint(n, "accidental")
	return formatNote(note{letter: objString(n, "letter"), accidental: acc})
}

func TestChordBodyGrammar(t *testing.T) {
	cases := []struct {
		symbol, dialect, want string
	}{
		{"Dm", "brazilian", "D|minor||-"},
		{"G7", "brazilian", "G|major|7:-1|-"},
		{"C", "brazilian", "C|major||-"},
		{"Bb", "brazilian", "Bb|major||-"},     // §5.1.1 flat root
		{"C/E", "brazilian", "C|major||E"},     // §5.1.2 bass note
		{"G+", "brazilian", "G|aug||-"},        // leading + is augmented (§5.3.1)
		{"C7M", "brazilian", "C|major|7:0|-"},  // major seventh
		{"Cø", "brazilian", "C|dim|7:-1|-"},    // half-diminished
		{"Cm7b5", "brazilian", "C|dim|7:-1|-"}, // folds into dim (§5.2.1)
		{"Csus2", "brazilian", "C|sus2||-"},
		{"C4", "brazilian", "C|sus4||-"},  // bare 4 with nothing else is sus4
		{"C5", "brazilian", "C|power||-"}, // power chord
		{"C6", "brazilian", "C|major|6:0|-"},
		{"Cadd9", "brazilian", "C|major|9:0|-"},
	}
	for _, c := range cases {
		if got := chordDesc(c.symbol, c.dialect); got != c.want {
			t.Errorf("chordDesc(%q, %q) = %q, want %q", c.symbol, c.dialect, got, c.want)
		}
	}
}

func TestChordDialectsAndAmbiguities(t *testing.T) {
	// The four §5.6 ambiguous spellings read differently by dialect.
	cases := []struct {
		symbol, dialect, wantChord, ambKind, ambChosen, ambAlt string
	}{
		{"C9", "brazilian", "C|major|9:0|-", "bareNine", "add", "dominant"},
		{"C9", "american", "C|major|7:-1,9:0|-", "bareNine", "dominant", "add"},
		{"C7+", "brazilian", "C|major|7:0|-", "sevenPlus", "majorSeventh", "dominantSharpFive"},
		{"C7+", "american", "C|aug|7:-1|-", "sevenPlus", "dominantSharpFive", "majorSeventh"},
		{"C°", "brazilian", "C|dim|7:-2|-", "degreeSign", "diminishedSeventh", "diminishedTriad"},
		{"C7(4)", "brazilian", "C|sus4|7:-1|-", "bareFour", "suspended", "added"},
		{"C7(4)", "american", "C|major|4:0,7:-1|-", "bareFour", "added", "suspended"},
	}
	for _, c := range cases {
		if got := chordDesc(c.symbol, c.dialect); got != c.wantChord {
			t.Errorf("chordDesc(%q, %q) = %q, want %q", c.symbol, c.dialect, got, c.wantChord)
		}
		_, ambs, _ := ParseChord(c.symbol, c.dialect)
		if len(ambs) != 1 {
			t.Errorf("ParseChord(%q, %q): %d ambiguities, want 1", c.symbol, c.dialect, len(ambs))
			continue
		}
		a := ambs[0].(*Object)
		if objString(a, "kind") != c.ambKind || objString(a, "chosen") != c.ambChosen || objString(a, "alternative") != c.ambAlt {
			t.Errorf("ParseChord(%q, %q) ambiguity = {%s %s %s}, want {%s %s %s}",
				c.symbol, c.dialect, objString(a, "kind"), objString(a, "chosen"), objString(a, "alternative"),
				c.ambKind, c.ambChosen, c.ambAlt)
		}
	}
}

func TestUnambiguousChordHasNoAmbiguities(t *testing.T) {
	_, ambs, _ := ParseChord("Dm", "brazilian")
	if len(ambs) != 0 {
		t.Errorf("ParseChord(Dm) ambiguities = %v, want none", ambs)
	}
}

func TestChordErrorsReportedAndKept(t *testing.T) {
	// §5.4: an invalid symbol is unreadable (chord == nil, with errors), and the
	// chart reader keeps it as an unknown token (§2.9) rather than dropping it.
	for _, bad := range []string{"H7", "Zzz", "C#b9#"} {
		r := parseChord(bad, "brazilian")
		if r.chord != nil {
			t.Errorf("parseChord(%q) should be unreadable", bad)
		}
		if len(r.errors) == 0 {
			t.Errorf("parseChord(%q) should report an error", bad)
		}
		it := classifyCore(bad, "brazilian")
		if objString(it, "type") != "unknown" || objString(it, "text") != bad {
			t.Errorf("classifyCore(%q) = %v, want unknown token kept", bad, it)
		}
	}
}

func TestUnknownDialectFailsClosed(t *testing.T) {
	r := parseChord("C", "klingon")
	if r.chord != nil || len(r.errors) == 0 {
		t.Errorf("parseChord with unknown dialect should fail: %+v", r)
	}
}

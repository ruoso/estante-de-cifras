package cifra

// Unit tests for §8.4: the canonical serialiser, one case per construct it
// writes, ported from the reference's reference/tests/test_writer.py. Each case
// parses a purpose-written document, writes it, and checks the bytes are what §8.4
// requires; `canon` also checks that canonicalising is a fixed point and that
// the canonical text reads back as the canonical model (§8.1). The reader is the
// other half, so these stand on Parse — exactly as the reference writes
// `write(parse(text))`. Agreement with the reference and the JS twin is by the
// corpus, byte for byte, not shared code (DIRECTION §3.6).

import (
	"strings"
	"testing"
)

// chartDoc wraps chart lines in a section fence — the shortest well-formed
// document (conftest.chart).
func chartDoc(text string) string {
	return "## A\n```\n" + text + "\n```\n"
}

// fenced wraps a body in a fence under a heading.
func fenced(body, heading string) string {
	return heading + "\n```\n" + body + "\n```\n"
}

// stripDump is a model's one-way serialisation without the two fields that
// describe a text, not a model (the harness's check 6 strips the same).
func stripDump(m Model) string {
	return string(Encode(m.Without("diagnostics", "sungAt")))
}

// canon parses, writes, and checks the write is a fixed point and that the
// canonical text reads back as the canonical model (§8.1). It returns the
// canonical text. Mirrors the reference's `roundtrip`/`canon`.
func canonSong(t *testing.T, text string) string {
	t.Helper()
	doc := parseSong(t, text)
	out, err := Write(doc)
	if err != nil {
		t.Fatalf("Write(%q): %v", text, err)
	}
	again := parseSong(t, string(out))
	cdoc, err := Canonical(doc)
	if err != nil {
		t.Fatalf("Canonical(%q): %v", text, err)
	}
	if stripDump(again) != stripDump(cdoc) {
		t.Errorf("canon(%q): reparse of the canonical text != canonical model\n out = %q", text, out)
	}
	out2, err := Write(again)
	if err != nil {
		t.Fatalf("Write(again) for %q: %v", text, err)
	}
	if string(out2) != string(out) {
		t.Errorf("canon(%q): not a fixed point\n once = %q\n twice = %q", text, out, out2)
	}
	return string(out)
}

func wantCanon(t *testing.T, text, want string) {
	t.Helper()
	if got := canonSong(t, text); got != want {
		t.Errorf("canon(%q) = %q, want %q", text, got, want)
	}
}

// --- §8.4.4 the chord line ---------------------------------------------------

func TestWriteChordLine(t *testing.T) {
	cases := []struct{ in, out string }{
		{chartDoc("  C   Am |F   G  "), "## A\n```\nC Am | F G\n```\n"},                                            // single spaces and bars
		{chartDoc("| C | G ||"), "## A\n```\n| C | G ||\n```\n"},                                                   // leading and closing bars
		{chartDoc("C || G"), "## A\n```\nC || G\n```\n"},                                                           // double bar
		{chartDoc("|: C | G :|"), "## A\n```\n|: C | G :|\n```\n"},                                                 // repeat marks
		{chartDoc("( C | G ) 3x"), "## A\n```\n( C | G ) x3\n```\n"},                                               // count in x form
		{chartDoc("(C G)"), "## A\n```\n( C G )\n```\n"},                                                           // brackets
		{chartDoc("|: Dm | G7 |1. C | A7 :|2. C | C |"), "## A\n```\n|: Dm | G7 | 1. C | A7 :| 2. C | C |\n```\n"}, // endings
		{chartDoc("|: C | G7:| F"), "## A\n```\n|: C | G7 :| F\n```\n"},                                            // close mark against a chord
		{chartDoc("@9 Dm | G7 | @17 Em"), "## A\n```\n@9 Dm | G7 | @17 Em\n```\n"},                                 // anchors
		{chartDoc("@9\nDm | G7"), "## A\n```\n@9 Dm | G7\n```\n"},                                                  // anchor-only line moves to next bar
		{chartDoc("C | % | fine | (solo)"), "## A\n```\nC | % | fine | (solo)\n```\n"},                             // unknown tokens and repeat signs
		{chartDoc("( C | G ) (2x)"), "## A\n```\n( C | G ) x2\n```\n"},                                             // cifra count becomes x form
		{chartDoc("C | G bis"), "## A\n```\nC | G x2\n```\n"},                                                      // bis becomes x2
		{chartDoc("nc | NC | n.c. | C"), "## A\n```\nN.C. | N.C. | N.C. | C\n```\n"},                               // no-chord canonical
		{chartDoc("C | G 2x"), "## A\n```\nC | G x2\n```\n"},                                                       // line count
	}
	for _, c := range cases {
		wantCanon(t, c.in, c.out)
	}
}

func TestWriteBeatsRunsAndAnnotations(t *testing.T) {
	// §8.4.4: beat runs and a `// ` annotation written back in place.
	text := "C / / / | G . . .\nG D Em C\n// repete\n"
	wantCanon(t, chartDoc(text), "## A\n```\n"+text+"```\n")
}

func TestWriteHeadingCountAndAnchor(t *testing.T) {
	// §8.4.3: a heading's count and anchor are written anchor-then-count.
	wantCanon(t, "## Refrão (2x)\n```\nC\n```\n", "## Refrão x2\n```\nC\n```\n")
	wantCanon(t, "## A x2 @9\n```\nC | G\n```\n", "## A @9 x2\n```\nC | G\n```\n")
}

// --- §8.4.5 sung lines -------------------------------------------------------

func TestWriteSungLines(t *testing.T) {
	keep := []string{
		"G           D\nWhen I first saw you",  // columns kept
		"        G\nOh when I first",           // lead words
		"G             D\n> A tarde era clara", // a forced line
		"G\nla la\n\nsecond verse\n> A\nC | G", // lyric lines and breaks
		"G      | D\nWhen I   saw you",         // bars on a sung line
	}
	for _, body := range keep {
		wantCanon(t, chartDoc(body), "## A\n```\n"+body+"\n```\n")
	}
}

// --- §8.4.1–§8.4.3 structure, fences and metadata ----------------------------

func TestWriteStructure(t *testing.T) {
	cases := []struct{ in, out string }{
		{"#  Title  \n-  artist :  Me \n\n```\nC\n```\n", "# Title\n- artist: Me\n\n```\nC\n```\n"},        // metadata then one blank line
		{"### A\n```\nC\n```\n", "## A\n```\nC\n```\n"},                                                    // heading levels become 2
		{"## A\n\nslowly\n\n```\nC\n```\n\nthen faster\n", "## A\nslowly\n\n```\nC\n```\n\nthen faster\n"}, // notes kept in place
		{"## A\n## B\n```\nC\n```\n", "## A\n\n## B\n```\nC\n```\n"},                                       // empty section kept
		{"## A @9\n```\nDm\n```\n", "## A @9\n```\nDm\n```\n"},                                             // heading anchor
	}
	for _, c := range cases {
		wantCanon(t, c.in, c.out)
	}
}

func TestWriteCifraHeadingsShareOneFence(t *testing.T) {
	// §8.4.3: bracket/label headings share one music fence and carry a leading
	// chord line onto the heading line.
	text := "```\n[Intro]  G   D\n\n[Verse]\nG     D\nla la la\nRefrão:  C G\n```\n"
	want := "```\n[Intro] G D\n\n[Verse]\nG     D\nla la la\n\nRefrão: C G\n```\n"
	wantCanon(t, text, want)
}

func TestWriteVerbatimFence(t *testing.T) {
	// §8.4.3: a verbatim fence keeps its info string and contents unchanged.
	text := "## A\n```tab\ne|--0--|\n```\n\n```\nC\n```\n"
	wantCanon(t, text, text)
}

// --- §8.4.6 the voicings part ------------------------------------------------

func TestWriteVoicingsSortedAndSingleSpaced(t *testing.T) {
	text := "```\nG | C | Cm | Cm[2]\n```\n---\n## voicings : E2,A2,D3,G3,B3,E4\n-   G:320003\n- Cm[2] : 8-10-10-8-8-8\n- C: x32010\n"
	want := "```\nG | C | Cm | Cm[2]\n```\n\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- C: x32010\n- Cm[2]: 8-10-10-8-8-8\n- G: 320003\n"
	wantCanon(t, text, want)
}

func TestWriteBlocksOrderedByFirstTuningDefaultFirst(t *testing.T) {
	text := "```\nC\n```\n---\n## Hard: G4 C4 E4 A4\n- C: 5433\n## Voicings: E2 A2 D3 G3 B3 E4\n- C: x32010\n## Voicings: G4 C4 E4 A4\n- C: 0003\n"
	out := canonSong(t, text)
	g := strings.Index(out, "## Voicings: G4")
	hard := strings.Index(out, "## Hard")
	e := strings.Index(out, "## Voicings: E2")
	if !(g >= 0 && g < hard && hard < e) {
		t.Errorf("block order wrong: G4=%d Hard=%d E2=%d in %q", g, hard, e, out)
	}
}

func TestWriteVoicingProblemsDropped(t *testing.T) {
	text := "```\nC\n```\n---\n## Voicings: E2 A2 D3 G3 B3 E4\n- C: x32010\n- G: nope\n"
	out, err := Write(parseSong(t, text))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(out), "nope") {
		t.Errorf("a problem voicing was written: %q", out)
	}
}

func TestWriteEmptyBlocksAreHeadings(t *testing.T) {
	text := "```\nC\n```\n---\n## Voicings: E2 A2\n## Simple: E2 A2\n"
	wantCanon(t, text, "```\nC\n```\n\n---\n\n## Voicings: E2 A2\n\n## Simple: E2 A2\n")
}

func TestWriteNoBlocksNoRule(t *testing.T) {
	wantCanon(t, "```\nC\n```\n---\n", "```\nC\n```\n")
}

func TestWriteNotesInBlocksFollowItems(t *testing.T) {
	text := "```\nC\n```\n---\n## Voicings: E2 A2\nuse a pick\n- C: 32\n"
	wantCanon(t, text, "```\nC\n```\n\n---\n\n## Voicings: E2 A2\n- C: 32\nuse a pick\n")
}

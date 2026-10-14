package cifra

// Unit tests for §8.1/§8.2/§8.3: the canonical form, one case per rule the
// writer follows, plus the marked-text refusal (§8.1) and IsCanonical (§9.1).
// Ported from the reference's reference/tests/test_canonical.py on
// purpose-written models and texts; `canonSong` (write_test.go) checks each is a
// fixed point that reads back as the canonical model. The §8.3 footnote
// invariants and the sung-line re-layout are cross-checked by corpus entries
// 24-footnote-invariants and 34-pushed-words. Agreement with the reference and
// the JS twin is by the corpus, not shared code (DIRECTION §3.6).

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const guitar = "E2 A2 D3 G3 B3 E4"

// voiced is an empty guitar voicings block appended after a chart, as the
// reference's VOICED.
const voiced = "\n---\n\n## Voicings: " + guitar + "\n"

// --- model navigation helpers ------------------------------------------------

func bodyLine(t *testing.T, m Model, li int) *Object {
	t.Helper()
	lines := musicLinesOf(sectionAt(m, 0))
	return lines[li].(*Object)
}

func measureAt(line *Object, mi int) *Object { return objArray(line, "measures")[mi].(*Object) }
func itemAt(m *Object, ii int) *Object       { return objArray(m, "items")[ii].(*Object) }

// --- §8.4 step 1: the text ---------------------------------------------------

func TestCanonText(t *testing.T) {
	cases := []struct{ in, out string }{
		{"\ufeff# T\r\n\r## A\r```\rC\r\n```", "# T\n\n## A\n```\nC\n```\n"}, // BOM, CRLF and lone CR
		{"\ufeff\ufeff# T\n", "# T\n"},                                       // every BOM removed
		{"\n\ufeffhello\n", "hello\n"},                                       // BOM mid-document
		{"- a: x\ufeffy\n", "- a: xy\n"},                                     // BOM inside a value
		{"# T  \n\n## A  \nnotes   \n\n```tab  \ne|--0--|   \n```   \n", "# T\n\n## A\nnotes\n\n```tab\ne|--0--|\n```\n"}, // trailing spaces
		{"## A\n```\nG\tD\nWhen\tI saw\n```\n\tindented note\n", "## A\n```\nG D\nWhen I saw\n```\n\n indented note\n"},   // tabs become one space
		{"# Cafe\u0301\n", "# Caf\u00e9\n"},       // NFC
		{"- a: \u00a0x\n", "- a: \u00a0x\n"},      // a no-break space is a character
		{"- a:\u00a0x\n", ""},                     // no space after the colon: not a property
		{"", ""},                                  // the empty document is the empty file
		{"\ufeff\n  \n\t\n", ""},                  // whitespace-only is empty
		{chartDoc("C") + "\n\n\n", chartDoc("C")}, // one final newline
		{"```\nC\n```", "```\nC\n```\n"},          // a missing final newline is added
	}
	for _, c := range cases {
		wantCanon(t, c.in, c.out)
	}
}

func TestCanonNFCKeepsChordsOverTheirSyllables(t *testing.T) {
	text := chartDoc("     G\nCafe\u0301 com leite")
	m := parseSong(t, text)
	items := objArray(measureAt(bodyLine(t, m, 0), 0), "items")
	if objString(items[0].(*Object), "words") != "Caf\u00e9 " || objString(items[1].(*Object), "words") != "com leite" {
		t.Errorf("words = %q / %q", objString(items[0].(*Object), "words"), objString(items[1].(*Object), "words"))
	}
	wantCanon(t, text, chartDoc("     G\nCaf\u00e9 com leite"))
}

func TestCanonNoBreakSpaceIsAnUnknownToken(t *testing.T) {
	m := parseSong(t, chartDoc("C\u00a0| G"))
	var items []*Object
	for _, mEl := range objArray(bodyLine(t, m, 0), "measures") {
		for _, itEl := range objArray(mEl.(*Object), "items") {
			items = append(items, itEl.(*Object))
		}
	}
	if objString(items[0], "type") != "unknown" || objString(items[0], "text") != "C\u00a0" {
		t.Errorf("first item = %q/%q, want unknown C+nbsp", objString(items[0], "type"), objString(items[0], "text"))
	}
}

func TestCanonNotUTF8IsRefused(t *testing.T) {
	if _, err := Parse([]byte("# T\n\xff\n")); err == nil {
		t.Fatal("Parse of non-UTF-8 returned no error")
	}
}

// --- §8.4 step 2: metadata ---------------------------------------------------

func TestCanonMetadata(t *testing.T) {
	cases := []struct{ in, out string }{
		{"\n\n#   My   Song  \n\n* Artist :  Someone  \n\n+ notation: american\n\n\n## A\n```\nC\n```\n",
			"# My Song\n- artist: Someone\n- notation: american\n\n" + chartDoc("C")}, // title, properties then one blank line
		{"#  Only  \n\n\n", "# Only\n"},                  // title only
		{"#\n- a: 1\n", "- a: 1\n"},                      // empty title dropped
		{"- B: 1\n- a: 2\n- b: 3\n", "- b: 3\n- a: 2\n"}, // keys lower-cased, first position, last value
		{"- a:\n- b:    \n", "- a:\n- b:\n"},             // empty value
	}
	for _, c := range cases {
		wantCanon(t, c.in, c.out)
	}
}

func TestCanonNonPropertiesDropped(t *testing.T) {
	doc := parseSong(t, "- https://example.com\n- not a property\n-\n- a: 1\n")
	out, err := Write(doc)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != "- a: 1\n" {
		t.Errorf("out = %q, want %q", out, "- a: 1\n")
	}
}

func TestCanonNeverAddsAProperty(t *testing.T) {
	// C7+ is ambiguous (§5.6), but copying the author's symbol is not emitting
	// one: canonicalising does not declare `notation`.
	wantCanon(t, chartDoc("C7+"), chartDoc("C7+"))
}

// --- §8.4 step 3: the chart --------------------------------------------------

func TestCanonChart(t *testing.T) {
	cases := []struct{ in, out string }{
		{chartDoc("  C   Am |F   G  ||"), chartDoc("C Am | F G ||")}, // items and bars one space apart
		{chartDoc("|:G|D:| x3"), chartDoc("|: G | D :| x3")},         // a close mark then a count
		{chartDoc("|: Am | Dm :|| 2x"), chartDoc("|: Am | Dm :|| x2")},
		{chartDoc("C |:"), chartDoc("C |:")}, // marks against bars
		{chartDoc("||: F :||: G :||"), chartDoc("||: F :||: G :||")},
		{chartDoc("x2 :| ) ||: C"), chartDoc("x2 :| ) ||: C")},
		{chartDoc("C ||| G"), chartDoc("C || G")},                         // bar-line spellings
		{chartDoc("(C G) (2x) | Am bis"), chartDoc("( C G ) x2 | Am x2")}, // counts, endings, marks placed
		{chartDoc("|: Dm |1. C :|2. G |"), chartDoc("|: Dm | 1. C :| 2. G |")},
		{chartDoc("nc, | n.c.; | C,"), chartDoc("N.C. | N.C. | C")}, // no-chord and punctuation
		{chartDoc("Dm @9 | G7"), chartDoc("@9 Dm | G7")},            // the anchor first in its measure
		{chartDoc("@9\nDm"), chartDoc("@9 Dm")},
		{chartDoc("C | wobble | (solo) | Cm [2]"), chartDoc("C | wobble | (solo) | Cm [2]")}, // unknown tokens kept
		{chartDoc("  //repete\n//"), chartDoc("// repete\n//")},                              // annotations
	}
	for _, c := range cases {
		wantCanon(t, c.in, c.out)
	}
}

func TestCanonGuardedLines(t *testing.T) {
	// The leading `,` was punctuation, dropped on reading; written back without
	// it the line would be a forced line, an annotation or a heading (§8.4.4).
	for _, line := range []string{", >x C", ", //x", ", [x] C", ", Tom: C"} {
		wantCanon(t, chartDoc(line), chartDoc(", "+line[2:]))
	}
}

func TestCanonBracketAndLabelHeadingsKeepTheirFirstChordLine(t *testing.T) {
	text := "```\n[Intro]\nG D\n\n[Verse] (2x)\nC | G\nRefrão:\n\nC G\n```\n"
	wantCanon(t, text, "```\n[Intro] G D\n\n[Verse x2] C | G\n\nRefrão: C G\n```\n")
}

func TestCanonCountAloneNotJoinedToBracketHeading(t *testing.T) {
	wantCanon(t, "```\n[A]\nx2\n```\n", "```\n[A]\nx2\n```\n")
}

func TestCanonUnknownTokensNotJoinedToLabel(t *testing.T) {
	wantCanon(t, "```\nIntro:\nC wobble\n```\n", "```\nIntro:\nC wobble\n```\n")
}

func TestCanonBlankLinesInFences(t *testing.T) {
	wantCanon(t, chartDoc("\n\nC | G\n\n\n\nAm | F\n\n"), chartDoc("C | G\n\nAm | F")) // runs collapse, ends dropped
	wantCanon(t, chartDoc("C | G\n| |\nAm | F"), chartDoc("C | G\n\nAm | F"))          // a line of bars alone reads as blank
}

func TestCanonBlankLineKeepsAChordLineFromTheWords(t *testing.T) {
	text := chartDoc("G           D\nWhen I first saw you\nC  G\n\nnot under the chords")
	out := canonSong(t, text)
	want := chartDoc("G           D\nWhen I first saw you\nC G\n\nnot under the chords")
	if out != want {
		t.Fatalf("out = %q, want %q", out, want)
	}
	var kinds []string
	for _, lEl := range musicLinesOf(sectionAt(parseSong(t, out), 0)) {
		kinds = append(kinds, objString(lEl.(*Object), "kind"))
	}
	if strings.Join(kinds, ",") != "sung,chart,break,lyric" {
		t.Errorf("kinds = %v", kinds)
	}
}

func TestCanonBlankLineKeepsAChartFromBecomingSung(t *testing.T) {
	out := canonSong(t, chartDoc("C | G\n\nla la"))
	if obool(parseSong(t, out), "sung") {
		t.Error("the document should not be sung")
	}
	if out != chartDoc("C | G\n\nla la") {
		t.Errorf("out = %q", out)
	}
}

// --- fences ------------------------------------------------------------------

func TestCanonFences(t *testing.T) {
	cases := []struct{ in, out string }{
		{"~~~ CIFRA \nC\n~~~~\n", "```\nC\n```\n"},                                     // a music fence is bare
		{"```  Tab  \ne|--0--|\n```\n", "```tab\ne|--0--|\n```\n"},                     // info string trimmed and lower-cased
		{"````tab\n```\ne|--0--|\n```\n````\n", "````tab\n```\ne|--0--|\n```\n````\n"}, // verbatim long enough
		{"~~~tab\n``` x\n  `````\n~~~\n", "``````tab\n``` x\n  `````\n``````\n"},
		{"~~~\n```\n~~~\n", "````\n```\n````\n"},                                                       // music fence long enough
		{"~~~ a`b\ntext\n~~~\n", "~~~a`b\ntext\n~~~\n"},                                                // info with a backtick takes tildes
		{"```tab\n\n  e|--0--|\n\n\n  B|--1--|\n```\n", "```tab\n\n  e|--0--|\n\n\n  B|--1--|\n```\n"}, // verbatim keeps leading spaces and blank lines
		{"## A\n```\n```\n", "## A\n```\n```\n"},                                                       // empty fence kept
		{"## A\n```\n\n[B]\nC\n```\n", "## A\n\n```\n[B] C\n```\n"},                                    // a fence that opens with a heading belongs to it
	}
	for _, c := range cases {
		wantCanon(t, c.in, c.out)
	}
}

func TestCanonUnclosedFence(t *testing.T) {
	doc := parseSong(t, "## A\n```tab\ne|--0--|\n\nB|--1--|\n\n\n")
	out, err := Write(doc)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != "## A\n```tab\ne|--0--|\n\nB|--1--|\n```\n" {
		t.Errorf("out = %q", out)
	}
	wantCanon(t, "## A\n```\nC | G\n## not a heading\n\n", chartDoc("C | G\n## not a heading"))
}

// --- structural lines and headings -------------------------------------------

func TestCanonStructuralLines(t *testing.T) {
	text := "   # T\n   - a: 1\n\n   ## A\n   ```\nC\n   ```\n\n   ---\n\n   ## Voicings: E2 A2\n   - C: 32\n"
	wantCanon(t, text, "# T\n- a: 1\n\n## A\n```\nC\n```\n\n---\n\n## Voicings: E2 A2\n- C: 32\n")
	wantCanon(t, "## A\n    ## not a heading\n", "## A\n    ## not a heading\n") // four spaces is notes
}

func TestCanonHeadings(t *testing.T) {
	cases := []struct{ in, out string }{
		{"####   Verse    One  ###\n", "## Verse One\n"},         // level, text, closing sequence
		{"##Verse\n", "##Verse\n"},                               // no space after the hashes: notes
		{"## C# # #\n```\nG\n```\n", "## C# # #\n```\nG\n```\n"}, // text that ends like a closing sequence
		{"####### x\n", "####### x\n"},                           // seven hashes is notes
		{"## Chorus (2x) @9\n", "## Chorus @9 x2\n"},             // anchor then count
		{"## bis\n", "## bis\n"},
		{"## ##\n```\nC\n```\n", "##\n```\nC\n```\n"}, // empty heading
	}
	for _, c := range cases {
		wantCanon(t, c.in, c.out)
	}
}

func TestCanonHeadingThenPartThenOneBlankLine(t *testing.T) {
	text := "## A\n\n\nslowly\n\n\n\n```\nC\n```\n\n\n\nthen faster\n\n\nand more\n## B\n"
	wantCanon(t, text, "## A\nslowly\n\n```\nC\n```\n\nthen faster\n\nand more\n\n## B\n")
}

func TestCanonNotesLeadingSpacesKept(t *testing.T) {
	wantCanon(t, "## A\n  two\n      code\n", "## A\n  two\n      code\n")
}

// --- §8.3 the footnote invariants --------------------------------------------

func TestCanonFootnoteIndexZeroAndLeadingZeros(t *testing.T) {
	m := parseSong(t, chartDoc("Cm[0] | Cm[02] | Cm[1]"))
	if got := strings.Join(chordKeys(bodyLine(t, m, 0)), ","); got != "Cm,Cm[2],Cm" {
		t.Errorf("keys = %s", got)
	}
	wantCanon(t, chartDoc("Cm[0] | Cm[02] | Cm[1]"), chartDoc("Cm | Cm[2] | Cm"))
}

func TestCanonFootnoteInvariants(t *testing.T) {
	cases := []struct{ in, out string }{
		// I1: an unused key dropped from every block.
		{chartDoc("C") + voiced + "- C: x32010\n- G: 320003\n- C[2]: x35553\n",
			chartDoc("C") + voiced + "- C: x32010\n"},
		// I2: used indices renumbered from use, in the chart and the block.
		{chartDoc("Cm | Cm[3]") + voiced + "- Cm: x35543\n- Cm[2]: 5333xx\n- Cm[3]: 8-10-10-8-8-8\n",
			chartDoc("Cm | Cm[2]") + voiced + "- Cm: x35543\n- Cm[2]: 8-10-10-8-8-8\n"},
		// I3: two indices no block tells apart merge into the lower.
		{chartDoc("D | D[2]") + voiced + "- D: xx0232\n- D[2]: xx0232\n\n## Easy: " + guitar + "\n- D: xx0232\n- D[2]: xx0232\n",
			chartDoc("D | D") + voiced + "- D: xx0232\n\n## Easy: " + guitar + "\n- D: xx0232\n"},
		// I3: a block that tells them apart keeps them apart.
		{chartDoc("D | D[2]") + voiced + "- D: xx0232\n- D[2]: xx0232\n\n## Voicings: G4 C4 E4 A4\n- D: 2220\n- D[2]: 7655\n",
			chartDoc("D | D[2]") + voiced + "- D: xx0232\n- D[2]: xx0232\n\n## Voicings: G4 C4 E4 A4\n- D: 2220\n- D[2]: 7655\n"},
		// I3: a block with only one of the two tells them apart.
		{chartDoc("D | D[2]") + voiced + "- D: xx0232\n- D[2]: xx0232\n\n## Voicings: G4 C4 E4 A4\n- D: 2220\n",
			chartDoc("D | D[2]") + voiced + "- D: xx0232\n- D[2]: xx0232\n\n## Voicings: G4 C4 E4 A4\n- D: 2220\n"},
		// I3: fingering is part of the shape.
		{chartDoc("D | D[2]") + voiced + "- D: xx0232 (- - - 1 3 2)\n- D[2]: xx0232 (- - - 1 2 3)\n",
			chartDoc("D | D[2]") + voiced + "- D: xx0232 (- - - 1 3 2)\n- D[2]: xx0232 (- - - 1 2 3)\n"},
		// No blocks, no merge.
		{chartDoc("D | D[2]"), chartDoc("D | D[2]")},
	}
	for _, c := range cases {
		wantCanon(t, c.in, c.out)
	}
}

func TestCanonFootnoteI2OnASungLineKeepsColumns(t *testing.T) {
	wantCanon(t, chartDoc("Cm[3]  G     Cm\nquando eu te vi passar"),
		chartDoc("Cm[2]  G     Cm\nquando eu te vi passar"))
	wantCanon(t, chartDoc("Cm[2] G     Cm[3]\nquando eu te vi passar")+voiced+"- Cm[2]: x35543\n",
		chartDoc("Cm    G     Cm[2]\nquando eu te vi passar")+voiced+"- Cm: x35543\n")
}

func TestCanonBlockEmptiedStaysAsItsHeading(t *testing.T) {
	wantCanon(t, chartDoc("C")+voiced+"- G: 320003\n", chartDoc("C")+strings.TrimRight(voiced, "\n")+"\n")
}

// --- §8.4 step 4: voicings ---------------------------------------------------

func TestCanonVoicingsTuningSpelling(t *testing.T) {
	out := canonSong(t, chartDoc("C")+"\n---\n\n## Voicings:  e♭2,a2 , D3,g3 B3  e4\n- C: x32010\n")
	if !strings.Contains(out, "## Voicings: E♭2 A2 D3 G3 B3 E4\n") {
		t.Errorf("tuning spelling not canonical: %q", out)
	}
}

func TestCanonVoicings(t *testing.T) {
	cases := []struct{ in, out string }{
		{chartDoc("C | G") + "\n---\n\n## Voicings: Eb2 A2\n- C: 32\n## Voicings: D#2 A2\n- G: 10\n",
			chartDoc("C | G") + "\n---\n\n## Voicings: Eb2 A2\n- C: 32\n- G: 10\n"}, // merged blocks take the first spelling
		{chartDoc("C") + "\n---\n\n## Up   the  neck : E2 A2\n- C: 32\n## up the neck: E2 A2\n- C: 55\n## VOICINGS: E2 A2\n",
			chartDoc("C") + "\n---\n\n## Voicings: E2 A2\n\n## Up the neck: E2 A2\n- C: 32\n\n## up the neck: E2 A2\n- C: 55\n"}, // label trimmed/collapsed, case kept
		{"---\n## Voicings: E2 A2\n", "---\n\n## Voicings: E2 A2\n"}, // rule first when alone
		{chartDoc("C") + "\n---\n", chartDoc("C")},                   // no blocks, no rule
		// a key an unknown token uses is kept.
		{chartDoc("C | Cx7(#11b13)") + voiced + "- C: x32010\n- Cx7(#11b13): x3x330\n- N.C.: xxxxxx\n",
			chartDoc("C | Cx7(#11b13)") + voiced + "- C: x32010\n- Cx7(#11b13): x3x330\n"},
		// Appendix A legacy forms are not converted: a `key = frets` line is notes.
		{chartDoc("C") + voiced + "C = x32010\n", chartDoc("C") + voiced + "C = x32010\n"},
	}
	for _, c := range cases {
		wantCanon(t, c.in, c.out)
	}
}

func TestCanonVoicingsWhatCanonicalisingDrops(t *testing.T) {
	text := chartDoc("C") + "\n---\nbefore any block\n- C: 32\n## Voicings: E2 A2\n- C: 32\nnote   \n\n- G 32\n---\n- D: nope\n"
	out, err := Write(parseSong(t, text))
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != chartDoc("C")+"\n---\n\n## Voicings: E2 A2\n- C: 32\nnote\n" {
		t.Errorf("out = %q", out)
	}
}

func TestCanonVoicingItemsSortByCodePoint(t *testing.T) {
	// U+FF0B sorts before U+1D12B by code point (and by UTF-8 byte order, which
	// agrees), the opposite of a UTF-16 code-unit sort.
	text := chartDoc("X\U0001d12b | X\uff0b | A\u266d | Am | A") + voiced
	text += "- X\U0001d12b: x32010\n- X\uff0b: x32010\n- A\u266d: x32010\n- Am: x02210\n- A: x02220\n"
	out := canonSong(t, text)
	tail := "- A: x02220\n- Am: x02210\n- A\u266d: x32010\n- X\uff0b: x32010\n- X\U0001d12b: x32010\n"
	if !strings.HasSuffix(out, tail) {
		t.Errorf("voicing order wrong:\n got %q\n want suffix %q", out, tail)
	}
}

// --- §4.5, §8.4.5 sung lines -------------------------------------------------

func TestCanonSungLines(t *testing.T) {
	cases := []struct{ in, out string }{
		{chartDoc("G           D\nWhen I first saw you"), chartDoc("G           D\nWhen I first saw you")}, // columns kept
		{chartDoc("Cm[1] (2x)  G\nla la la la la la"), chartDoc("Cm    x2    G\nla la la la la la")},       // a token that shrinks
		{chartDoc("nc    G\nla la la la"), chartDoc("N.C.  G\nla la la la")},                               // a token that grows, room to spare
		{chartDoc("nc G\nla la la la"), chartDoc("N.C. G\nla   la la la")},                                 // no room: the words move
		{chartDoc("(G   D)  Em\nla la la la la"), chartDoc("( G   D ) Em\nl_a la la la la")},               // only a bar line touches
		{chartDoc("G|D    :|\nla la la la la"), chartDoc("G|D    :|\nla la la la la")},
		{chartDoc("(nc  )\nla la la la"), chartDoc("( N.C. )\nl_a la la la")},
		{chartDoc("@9 G     D\nla la la la"), chartDoc("@9 G     D\nla la la la")},                                           // anchor keeps its column
		{chartDoc("        G\nOh when I first\n    D\n    la la"), chartDoc("        G\nOh when I first\n    D\n    la la")}, // lead words
		{chartDoc("G             D\n>  A tarde era clara"), chartDoc("G             D\n>  A tarde era clara")},               // forced line
		{chartDoc("C | G\n\n  > A"), chartDoc("C | G\n\n>   A")},
		{chartDoc(", >x  |  C\noh my words are here"), chartDoc(", >x  |  C\noh my words are here")}, // the guard on a sung chord line
	}
	for _, c := range cases {
		wantCanon(t, c.in, c.out)
	}
}

// --- §8.3 lines 148–150: a marker that changes width re-lays-out the line -----

func TestCanonI2GrowthPushesTheWords(t *testing.T) {
	// An edit leaves Cm[3] where Cm was; I2 makes it Cm[2], wider than the gap
	// after it, and canonical() lays the line out again (§8.3 lines 148–150).
	doc := parseSong(t, chartDoc("Cm G    Cm\nQuando eu te vi")+voiced+"- Cm: x35543\n")
	it := itemAt(measureAt(bodyLine(t, doc, 0), 0), 0)
	it.Set("index", 3)
	it.Set("key", "Cm[3]")
	out, err := Write(doc)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(string(out), chartDoc("Cm[2] G    Cm\nQua___ndo eu te vi")) {
		t.Errorf("out = %q", out)
	}
	cdoc, _ := Canonical(doc)
	if stripDump(parseSong(t, string(out))) != stripDump(cdoc) {
		t.Error("reparse of the canonical text != canonical model")
	}
	// canonicalising twice is the same as once.
	cc, _ := Canonical(cdoc)
	if string(Encode(cc)) != string(Encode(cdoc)) {
		t.Error("canonical is not idempotent")
	}
}

// --- §2.8, §8.4.5: a bar anchor on a sung line keeps its column ---------------

func TestCanonSungAnchorsWrittenBackWhereWritten(t *testing.T) {
	words := "When I first saw you walking down"
	cases := []struct{ chords, want string }{
		{"@12 G|D", "@12 G|D"},
		{"| @5 G   | D   | Em  |", "| @5 G   | D   | Em |"}, // the closing bar line has no column
		{"@5 G       D", "@5 G       D"},
		{"|@5 G|@6 D", "|@5 G|@6 D"},       // touching a bar line
		{"(@5 G   D )", "(@5 G   D )"},     // touching a `(` before it
		{"G  @5) D", "G  @5) D"},           // touching a `)` after it
		{"G    D @5  Em", "G    D @5  Em"}, // anywhere in its measure
	}
	for _, c := range cases {
		wantCanon(t, chartDoc(c.chords+"\n"+words), chartDoc(c.want+"\n"+words))
	}
}

func TestCanonAnchorColumnOnAChordGoesAfterIt(t *testing.T) {
	words := "When I first saw you walking down"
	doc := parseSong(t, chartDoc("@5 G       D\n"+words))
	measureAt(bodyLine(t, doc, 0), 0).Set("anchorColumn", 3)
	out, err := Write(doc)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != chartDoc("   G @5    D\n"+words) {
		t.Errorf("out = %q", out)
	}
	// the written form is itself canonical.
	again, _ := Write(parseSong(t, string(out)))
	if string(again) != string(out) {
		t.Error("not a fixed point")
	}
}

func TestCanonBracketsOnBothSidesNeverTouchedAtOnce(t *testing.T) {
	words := "When I first saw you walking down"
	doc := parseSong(t, chartDoc("( @5 ) G\n"+words))
	m := measureAt(bodyLine(t, doc, 0), 0)
	itemAt(m, 2).Set("column", 3) // the `)` moved against the anchor
	m.Set("anchorColumn", 1)      // and the anchor against the `(`
	out, err := Write(doc)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != chartDoc("(@5 )  G\n"+words) {
		t.Errorf("out = %q", out)
	}
}

// --- §4.5: the words are pushed, never a chord -------------------------------

// sung canonicalises one sung line and returns its two canonical lines, after
// checking that the model read from the input is the model read from its
// canonical text (every chord over the same character).
func sung(t *testing.T, chords, words string) []string {
	t.Helper()
	text := chartDoc(chords + "\n" + words)
	out := canonSong(t, text)
	if stripDump(parseSong(t, text)) != stripDump(parseSong(t, out)) {
		t.Errorf("sung(%q,%q): parse(input) != parse(canonical)\n out = %q", chords, words, out)
	}
	body := strings.SplitN(strings.SplitN(out, "```\n", 2)[1], "\n", 3)
	return []string{body[0], body[1]}
}

func TestCanonPushedWords(t *testing.T) {
	cases := []struct {
		chords, words, l1, l2 string
	}{
		{"(G   D)", "When I first saw you", "( G   D )", "W_hen I first saw you"},
		{"(G   D)  Em", "la la la la la", "( G   D ) Em", "l_a la la la la"},
		{"((G  D", "  when I", "( ( G  D", "    when I"},
		{"nc G", "la la la la", "N.C. G", "la   la la la"},
		{"(G", "When I saw", "( G", "W_hen I saw"},
		{"((G", "When I saw", "( ( G", "Wh__en I saw"},
		{"(G (D", "Quando eu", "( G ( D", "Q_uan_do eu"},
		{"((G ((D", "Quantos eu", "( ( G ( ( D", "Qu__anto__s eu"},
		{"( G   D )", "W_hen I first saw you", "( G   D )", "W_hen I first saw you"},
		{"( G ( D", "Q_uan_do eu", "( G ( D", "Q_uan_do eu"},
		{"( G", "W____hen I", "( G", "W_hen I"}, // excess padding removed
		{"G", "W__hen I", "G", "When I"},
		{"((G", "Wh_en I saw", "( ( G", "Wh__en I saw"}, // missing padding added
		{"(G", "W___hen I", "( G", "W_hen I"},
		{"(G (D", "Q_u___a_ndo eu", "( G ( D", "Q_u___ando eu"},
		{"G   D", "la _x_ la", "G   D", "la _x_ la"}, // underscores that touch a space are words
		{"(G", "_x y", "( G", "_ x y"},
		{"G", "x_ y", "G", "x_ y"},
		{"nc G", "Quando eu", "N.C. G", "Qua__ndo eu"}, // a growing token pushes the words
		{"G       D    Em    nc", "When I saw", "G       D    Em    N.C.", "When I saw"},
		{"nc D    Em", "When I", "N.C. D    Em", "Whe__n I"},
		{"(G       D", "When I", "( G       D", "W_hen I"},
		{"(G\tD", "Cafe\u0301 \t com \t ", "( G D", "C_af\u00e9   com"}, // tabs, NFC, trailing spaces come first
		{"(G   D", "> A tarde era", "( G   D", ">  A tarde era"},        // forced words stay forced
	}
	for _, c := range cases {
		got := sung(t, c.chords, c.words)
		if got[0] != c.l1 || got[1] != c.l2 {
			t.Errorf("sung(%q,%q) = %q, want [%q %q]", c.chords, c.words, got, c.l1, c.l2)
		}
	}
}

func TestCanonWordsThatWouldNoLongerReadAsWordsAreForced(t *testing.T) {
	// Without its padding `A_m Em la` is `Am Em la`, which reads as chords.
	wantCanon(t, "- words: yes\n\n"+chartDoc("G\nA_m Em la"), "- words: yes\n\n"+chartDoc(" G\n>Am Em la"))
}

func TestCanonUnderscoresAreWordsOnLinesThatAreNotSung(t *testing.T) {
	text := chartDoc("G   D\nla la la\n\nsnake_case words here")
	out := canonSong(t, text)
	if out != text {
		t.Errorf("out = %q", out)
	}
	line := musicLinesOf(sectionAt(parseSong(t, text), 0))[2].(*Object)
	if objString(line, "text") != "snake_case words here" {
		t.Errorf("lyric text = %q", objString(line, "text"))
	}
}

func TestCanonCarriedAnchorWithNoRoomPushesTheWords(t *testing.T) {
	text := chartDoc("@9\nG|D\nWhen I first")
	wantCanon(t, text, chartDoc("G @9 | D\nWh_____en I first"))
}

// --- serialising a model that was not read -----------------------------------

func TestCanonSectionCreatedFromTheModel(t *testing.T) {
	doc := parseSong(t, "# T\n")
	srcLine := musicLinesOf(sectionAt(parseSong(t, chartDoc("C  Am |F")), 0))
	part := NewObject()
	part.Set("type", "music")
	part.Set("lines", append([]any{}, srcLine...))
	sec := NewObject()
	sec.Set("name", "New")
	sec.Set("heading", "markdown")
	sec.Set("anchor", nil)
	sec.Set("body", []any{part})
	sec.Set("groups", []any{})
	doc.Set("sections", append(objArray(doc, "sections"), sec))
	out, err := Write(doc)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != "# T\n\n## New\n```\nC Am | F\n```\n" {
		t.Errorf("out = %q", out)
	}
}

// --- bars numbered from 1: zero is never an anchor, a count or an ending ------

func TestCanonZero(t *testing.T) {
	canonSong(t, chartDoc("@0 C | G")) // a bar anchor zero is an unknown token
	canonSong(t, chartDoc("C | G x0")) // a count zero is not a count
}

// --- §8.1 the marked-text refusal --------------------------------------------

func TestWriteRefusesAMarkedText(t *testing.T) {
	// A reader keeps a line of git's conflict markers as notes and reports
	// marker-line; the writer refuses to save such a model. No song corpus entry
	// triggers it, so it is pinned here on a purpose-written model.
	marked := "## A\nslowly\n<<<<<<< ours\n\n```\nC\n```\n"
	doc := parseSong(t, marked)
	hasMarkerDiag := false
	for _, dEl := range objArray(doc, "diagnostics") {
		if objString(dEl.(*Object), "code") == "marker-line" {
			hasMarkerDiag = true
		}
	}
	if !hasMarkerDiag {
		t.Error("the reader did not report marker-line")
	}
	_, err := Write(doc)
	mte, ok := err.(*MarkedTextError)
	if !ok {
		t.Fatalf("Write returned %v, want *MarkedTextError", err)
	}
	if mte.Line != 3 || mte.Text != "<<<<<<< ours" {
		t.Errorf("MarkedTextError = {Line:%d Text:%q}, want {3 %q}", mte.Line, mte.Text, "<<<<<<< ours")
	}
}

// --- §9.1 IsCanonical --------------------------------------------------------

func TestIsCanonical(t *testing.T) {
	// The three `is canonical` cases the .tji names, pinned on a corpus text and
	// its non-canonical input, a marked text, and a non-UTF-8 byte string. The
	// corpus harness drives Write/Canonical directly and never calls IsCanonical.
	canonical, err := os.ReadFile(filepath.Join("..", "corpus", "01-minimal-chart", "canonical.cifra.md"))
	if err != nil {
		t.Fatal(err)
	}
	input, err := os.ReadFile(filepath.Join("..", "corpus", "01-minimal-chart", "input.cifra.md"))
	if err != nil {
		t.Fatal(err)
	}
	if !IsCanonical(canonical) {
		t.Error("IsCanonical(canonical.cifra.md) = false, want true")
	}
	if IsCanonical(input) {
		t.Error("IsCanonical(input.cifra.md) = true, want false")
	}
	if IsCanonical([]byte("## A\n```\nC\n```\n<<<<<<< ours\n")) {
		t.Error("IsCanonical(marked text) = true, want false")
	}
	if IsCanonical([]byte("# T\n\xff\n")) {
		t.Error("IsCanonical(non-UTF-8) = true, want false")
	}
}

package cifra

// Unit tests for §1: title and properties, headings, sections, fences and notes,
// and §9.2 (unknown properties kept). These also define the shared song-reader
// test helpers. Purpose-written documents; agreement with the reference and the
// JS twin is by the corpus, not shared code.

import "testing"

// --- shared helpers (used by the other reader test files) --------------------

func parseSong(t *testing.T, src string) Model {
	t.Helper()
	m, err := Parse([]byte(src))
	if err != nil {
		t.Fatalf("Parse(%q): %v", src, err)
	}
	return m
}

func songSections(m Model) []any { return objArray(m, "sections") }

func sectionAt(m Model, i int) *Object { return songSections(m)[i].(*Object) }

func firstMusic(sec *Object) *Object {
	for _, pEl := range objArray(sec, "body") {
		p := pEl.(*Object)
		if objString(p, "type") == "music" {
			return p
		}
	}
	return nil
}

func musicLinesOf(sec *Object) []any {
	if p := firstMusic(sec); p != nil {
		return objArray(p, "lines")
	}
	return nil
}

// chordKeys lists the footnote keys of the chord items of a chart/sung line, in
// document order across its measures.
func chordKeys(line *Object) []string {
	var out []string
	for _, mEl := range objArray(line, "measures") {
		for _, itEl := range objArray(mEl.(*Object), "items") {
			it := itEl.(*Object)
			if objString(it, "type") == "chord" {
				out = append(out, objString(it, "key"))
			}
		}
	}
	return out
}

func lineKinds(lines []any) []string {
	out := []string{}
	for _, l := range lines {
		out = append(out, objString(l.(*Object), "kind"))
	}
	return out
}

func diagObjs(m Model) []*Object {
	out := []*Object{}
	for _, d := range objArray(m, "diagnostics") {
		out = append(out, d.(*Object))
	}
	return out
}

func diagMessageAt(m Model, code string) (string, int, bool) {
	for _, d := range diagObjs(m) {
		if objString(d, "code") == code {
			ln, _ := oint(d, "line")
			return objString(d, "message"), ln, true
		}
	}
	return "", 0, false
}

func propPairs(m Model) []string {
	out := []string{}
	for _, pEl := range objArray(m, "properties") {
		p := pEl.(*Object)
		out = append(out, objString(p, "key")+"="+objString(p, "value"))
	}
	return out
}

// --- §1.4.1 title ------------------------------------------------------------

func TestTitleFromLevelOneHeading(t *testing.T) {
	m := parseSong(t, "# Blues in D\n\n```\nDm | G7\n```\n")
	if v, _ := m.Get("title"); v != "Blues in D" {
		t.Errorf("title = %v, want %q", v, "Blues in D")
	}
}

func TestEmptyHeadingIsNoTitle(t *testing.T) {
	m := parseSong(t, "#\n\n```\nDm\n```\n")
	if v, _ := m.Get("title"); v != nil {
		t.Errorf("title = %v, want nil (an empty title is no title, §1.4.1)", v)
	}
}

// --- §1.4.2 properties -------------------------------------------------------

func TestPropertiesKeepOrderAndCase(t *testing.T) {
	m := parseSong(t, "# S\n- Key: C\n- capo: 2\n")
	got := propPairs(m)
	want := []string{"key=C", "capo=2"} // key lowercased, order of first appearance kept
	if len(got) != len(want) {
		t.Fatalf("properties = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("properties = %v, want %v", got, want)
		}
	}
}

func TestUnknownPropertyIsKept(t *testing.T) {
	// §9.2: a reader keeps unknown properties rather than dropping them.
	m := parseSong(t, "# S\n- arranger: Someone\n")
	found := false
	for _, p := range propPairs(m) {
		if p == "arranger=Someone" {
			found = true
		}
	}
	if !found {
		t.Errorf("unknown property not kept: %v", propPairs(m))
	}
}

func TestDuplicatePropertyReportedLastWins(t *testing.T) {
	m := parseSong(t, "# S\n- key: C\n- key: D\n")
	if got := propPairs(m); len(got) != 1 || got[0] != "key=D" {
		t.Errorf("properties = %v, want [key=D]", got)
	}
	if _, _, ok := diagMessageAt(m, "duplicate-property"); !ok {
		t.Error("expected duplicate-property diagnostic")
	}
}

// --- §1.7 headings and §1.8 sections -----------------------------------------

func TestMarkdownHeadingsMakeSections(t *testing.T) {
	m := parseSong(t, "## Intro\n\n```\nDm\n```\n\n## Verse\n\n```\nG7\n```\n")
	secs := songSections(m)
	if len(secs) != 2 {
		t.Fatalf("sections = %d, want 2", len(secs))
	}
	if n := objString(secs[0].(*Object), "name"); n != "Intro" {
		t.Errorf("section 0 name = %q, want Intro", n)
	}
	if h := objString(secs[0].(*Object), "heading"); h != "markdown" {
		t.Errorf("section 0 heading = %q, want markdown", h)
	}
	if n := objString(secs[1].(*Object), "name"); n != "Verse" {
		t.Errorf("section 1 name = %q, want Verse", n)
	}
}

func TestMusicWithNoHeadingKeepsNullHeadingSection(t *testing.T) {
	m := parseSong(t, "```\nDm | G7\n```\n")
	sec := sectionAt(m, 0)
	if h, _ := sec.Get("heading"); h != nil {
		t.Errorf("implicit first section heading = %v, want nil", h)
	}
	keys := chordKeys(musicLinesOf(sec)[0].(*Object))
	if len(keys) != 2 || keys[0] != "Dm" || keys[1] != "G7" {
		t.Errorf("chord keys = %v, want [Dm G7]", keys)
	}
}

// --- §1.9 fences and notes ---------------------------------------------------

func TestNotesParagraphKept(t *testing.T) {
	m := parseSong(t, "## Intro\n\nJust a note about the arrangement.\n")
	sec := sectionAt(m, 0)
	var notes *Object
	for _, pEl := range objArray(sec, "body") {
		if objString(pEl.(*Object), "type") == "notes" {
			notes = pEl.(*Object)
		}
	}
	if notes == nil {
		t.Fatal("no notes part")
	}
	if objString(notes, "text") != "Just a note about the arrangement." {
		t.Errorf("notes text = %q", objString(notes, "text"))
	}
}

func TestVerbatimFenceKeepsInfoAndText(t *testing.T) {
	m := parseSong(t, "## Tab\n\n```text\ne|--0--|\n```\n")
	sec := sectionAt(m, 0)
	var verb *Object
	for _, pEl := range objArray(sec, "body") {
		if objString(pEl.(*Object), "type") == "verbatim" {
			verb = pEl.(*Object)
		}
	}
	if verb == nil {
		t.Fatal("no verbatim part")
	}
	if objString(verb, "info") != "text" {
		t.Errorf("verbatim info = %q, want text", objString(verb, "info"))
	}
	if objString(verb, "text") != "e|--0--|" {
		t.Errorf("verbatim text = %q", objString(verb, "text"))
	}
}

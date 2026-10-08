package cifra

// Unit tests for §2 (the chart): chord lines and runs, measures and bar lines,
// items, several chords per measure, N.C., bar anchors and numbering, and §2.9
// (unknown tokens kept, never diagnosed). Purpose-written charts; agreement with
// the reference and the JS twin is by the corpus, not shared code.

import "testing"

func firstChartLine(t *testing.T, src string) *Object {
	t.Helper()
	lines := musicLinesOf(sectionAt(parseSong(t, src), 0))
	if len(lines) == 0 {
		t.Fatalf("no music lines for %q", src)
	}
	return lines[0].(*Object)
}

func measuresOf(line *Object) []*Object {
	var out []*Object
	for _, mEl := range objArray(line, "measures") {
		out = append(out, mEl.(*Object))
	}
	return out
}

func itemTypes(me *Object) []string {
	out := []string{}
	for _, itEl := range objArray(me, "items") {
		out = append(out, objString(itEl.(*Object), "type"))
	}
	return out
}

func TestBarLinesMakeMeasures(t *testing.T) {
	line := firstChartLine(t, "```\nDm | G7 | C\n```\n")
	ms := measuresOf(line)
	if len(ms) != 3 {
		t.Fatalf("measures = %d, want 3", len(ms))
	}
	if b, _ := ms[0].Get("bar"); b != nil {
		t.Errorf("measure 0 bar = %v, want nil", b)
	}
	if objString(ms[1], "bar") != "|" {
		t.Errorf("measure 1 bar = %q, want |", objString(ms[1], "bar"))
	}
}

func TestChartNumbersBarsFromOne(t *testing.T) {
	line := firstChartLine(t, "```\nDm | G7 | C\n```\n")
	for i, me := range measuresOf(line) {
		n, _ := oint(me, "number")
		if n != i+1 {
			t.Errorf("measure %d number = %d, want %d", i, n, i+1)
		}
		if obool(me, "stated") {
			t.Errorf("measure %d stated = true, want false", i)
		}
	}
}

func TestRunLineHasNoBars(t *testing.T) {
	line := firstChartLine(t, "```\nG D Em C\n```\n")
	if !obool(line, "run") {
		t.Error("a chord run with no bar lines should have run: true")
	}
	if keys := chordKeys(line); len(keys) != 4 {
		t.Errorf("run chord keys = %v, want 4", keys)
	}
	// A run is not bar-numbered.
	if measuresOf(line)[0].Has("number") {
		t.Error("a run measure should not be numbered")
	}
}

func TestSeveralChordsPerMeasure(t *testing.T) {
	line := firstChartLine(t, "```\nDm G7 | C\n```\n")
	ms := measuresOf(line)
	if got := len(objArray(ms[0], "items")); got != 2 {
		t.Errorf("measure 0 items = %d, want 2 (several chords per measure, §2.5)", got)
	}
}

func TestNoChordItem(t *testing.T) {
	line := firstChartLine(t, "```\nN.C. | G7\n```\n")
	if types := itemTypes(measuresOf(line)[0]); len(types) != 1 || types[0] != "nochord" {
		t.Errorf("measure 0 items = %v, want [nochord] (§2.6)", types)
	}
}

func TestDoubleBarLine(t *testing.T) {
	line := firstChartLine(t, "```\nDm || G7\n```\n")
	if objString(measuresOf(line)[1], "bar") != "||" {
		t.Errorf("measure 1 bar = %q, want ||", objString(measuresOf(line)[1], "bar"))
	}
}

func TestCloseBar(t *testing.T) {
	line := firstChartLine(t, "```\nDm | G7 |\n```\n")
	if cb, _ := line.Get("closeBar"); cb != "|" {
		t.Errorf("closeBar = %v, want |", cb)
	}
}

func TestBarAnchorNumbersFromAnchor(t *testing.T) {
	line := firstChartLine(t, "```\n@5 Dm | G7\n```\n")
	ms := measuresOf(line)
	if a, _ := oint(ms[0], "anchor"); a != 5 {
		t.Errorf("measure 0 anchor = %d, want 5 (§2.8)", a)
	}
	if n, _ := oint(ms[0], "number"); n != 5 {
		t.Errorf("measure 0 number = %d, want 5", n)
	}
	if !obool(ms[0], "stated") {
		t.Error("measure 0 stated = false, want true (a stated anchor)")
	}
	if n, _ := oint(ms[1], "number"); n != 6 {
		t.Errorf("measure 1 number = %d, want 6", n)
	}
}

func TestUnknownTokenKeptNotDiagnosed(t *testing.T) {
	// §2.9: an unknown token is kept as an unknown item, never diagnosed.
	m := parseSong(t, "```\nDm Zzz G7\n```\n")
	line := musicLinesOf(sectionAt(m, 0))[0].(*Object)
	var unknownText string
	found := false
	for _, me := range measuresOf(line) {
		for _, itEl := range objArray(me, "items") {
			it := itEl.(*Object)
			if objString(it, "type") == "unknown" {
				found = true
				unknownText = objString(it, "text")
			}
		}
	}
	if !found || unknownText != "Zzz" {
		t.Errorf("unknown token not kept (text=%q)", unknownText)
	}
	if len(diagObjs(m)) != 0 {
		t.Errorf("unknown token should not be diagnosed, got %d diagnostics", len(diagObjs(m)))
	}
}

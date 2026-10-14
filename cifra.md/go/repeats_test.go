package cifra

// Unit tests for §3: repeat items (§2.7) and §3.2 repeat-group pairing (bracket
// groups, repeat signs, counts and endings). Purpose-written charts; agreement
// with the reference and the JS twin is by the corpus, not shared code.

import "testing"

func groupsOf(m Model) []*Object {
	var out []*Object
	for _, g := range objArray(sectionAt(m, 0), "groups") {
		out = append(out, g.(*Object))
	}
	return out
}

func TestRepeatItemKept(t *testing.T) {
	line := firstChartLine(t, "```\nDm | % | G7 | %\n```\n")
	ms := measuresOf(line)
	for _, i := range []int{1, 3} {
		if types := itemTypes(ms[i]); len(types) != 1 || types[0] != "repeat" {
			t.Errorf("measure %d items = %v, want [repeat] (§2.7)", i, types)
		}
	}
}

func TestBracketGroupWithCount(t *testing.T) {
	m := parseSong(t, "```\n( Gm C7 | F Dm ) x3\n```\n")
	groups := groupsOf(m)
	if len(groups) != 1 {
		t.Fatalf("groups = %d, want 1", len(groups))
	}
	if c, _ := oint(groups[0], "count"); c != 3 {
		t.Errorf("group count = %d, want 3", c)
	}
	if !groups[0].Has("countItem") {
		t.Error("a group whose count came from a trailing count keeps countItem")
	}
}

func TestRepeatSignGroupDefaultsToTwo(t *testing.T) {
	m := parseSong(t, "```\n||: C | G :||\n```\n")
	groups := groupsOf(m)
	if len(groups) != 1 {
		t.Fatalf("groups = %d, want 1", len(groups))
	}
	if c, _ := oint(groups[0], "count"); c != 2 {
		t.Errorf("group count = %d, want 2 (default, §3.2)", c)
	}
	if n := len(objArray(groups[0], "endings")); n != 0 {
		t.Errorf("endings = %d, want 0", n)
	}
}

func TestGroupWithEndings(t *testing.T) {
	m := parseSong(t, "```\n|: Dm | G7 | 1. C | A7 :| 2. C | C |\n```\n")
	groups := groupsOf(m)
	if len(groups) != 1 {
		t.Fatalf("groups = %d, want 1", len(groups))
	}
	g := groups[0]
	endings := objArray(g, "endings")
	if len(endings) != 2 {
		t.Fatalf("endings = %d, want 2", len(endings))
	}
	for i, eEl := range endings {
		if n, _ := oint(eEl.(*Object), "number"); n != i+1 {
			t.Errorf("ending %d number = %d, want %d", i, n, i+1)
		}
	}
	// A group with endings takes its count from them (max number).
	if c, _ := oint(g, "count"); c != 2 {
		t.Errorf("group count = %d, want 2 (from endings)", c)
	}
}

func TestGroupPositionsBindToItems(t *testing.T) {
	m := parseSong(t, "```\n( Dm | G7 )\n```\n")
	groups := groupsOf(m)
	if len(groups) != 1 {
		t.Fatalf("groups = %d, want 1", len(groups))
	}
	open := oobj(groups[0], "open")
	closePos := oobj(groups[0], "close")
	if open == nil || closePos == nil {
		t.Fatal("group missing open/close positions")
	}
	// Both marks sit on the same part and line (§3.2).
	op, _ := oint(open, "part")
	cp, _ := oint(closePos, "part")
	if op != cp {
		t.Errorf("open part %d != close part %d", op, cp)
	}
}

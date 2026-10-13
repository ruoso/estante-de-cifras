package cifra

// Unit tests of the setlist merge (spec §11.13) on tiny purpose-written
// setlists (invented titles and paths, no lyrics). They pin the entries keyed
// list, items by reference and occurrence (a song played twice), the setlist
// conflict kinds (title, property, item, text, entry, notes), the identity
// members of the JSON (item/occurrence/after), and the §11.3 properties on
// invented setlists. The full matrix is pinned by the corpus battery.

import "testing"

// §11.13 — the §11.3 properties on invented setlists exercising entries, items
// by reference and occurrence, reorders and notes.
func TestSetlistInvariants(t *testing.T) {
	twice := "# Set\n\n1. [Alpha](alpha.cifra.md)\n2. [Beta](beta.cifra.md)\n3. [Alpha](alpha.cifra.md)\n"
	notes := "# Set\n\n1. [Alpha](alpha.cifra.md)\n\nsecond half\n\n2. [Beta](beta.cifra.md)\n"
	cases := []struct {
		name               string
		base, ours, theirs string
	}{
		{"song played twice, independent edits (items by occurrence)",
			twice,
			"# Set\n\n1. [Alpha](alpha.cifra.md)\n   - key: D\n2. [Alpha](alpha.cifra.md)\n3. [Beta](beta.cifra.md)\n4. [Alpha](alpha.cifra.md)\n",
			"# Set\n\n1. [Alpha](alpha.cifra.md)\n2. [Beta](beta.cifra.md)\n3. [Alpha](alpha.cifra.md)\n   - note: to close\n"},
		{"notes block edited on one side",
			notes,
			"# Set\n\n1. [Alpha](alpha.cifra.md)\n\nsecond half, after a break\n\n2. [Beta](beta.cifra.md)\n",
			notes},
		{"title and property apart",
			"# Set\n- place: Hall\n\n1. [Alpha](alpha.cifra.md)\n",
			"# Set\n- place: Hall, upstairs\n\n1. [Alpha](alpha.cifra.md)\n",
			"# Set\n- place: Hall\n\n1. [Beta](beta.cifra.md)\n"},
	}
	for _, c := range cases {
		checkInvariants(t, c.name, true, bz(c.base), bz(c.ours), bz(c.theirs))
	}
}

// §11.13 — the setlist conflict kinds and their identity members.
func TestSetlistConflicts(t *testing.T) {
	// title two values -> a `title` conflict.
	o := mergeOut(t, true, bz("# Alpha\n\n1. [X](x.cifra.md)\n"), bz("# Beta\n\n1. [X](x.cifra.md)\n"), bz("# Gamma\n\n1. [X](x.cifra.md)\n"))
	if findConflict(o, "title") == nil {
		t.Errorf("setlist title two values: want a title conflict, got %v", o.Conflicts)
	}

	// a property changed differently -> a `property` conflict.
	o = mergeOut(t, true, bz("# Set\n- place: Hall\n\n1. [X](x.cifra.md)\n"), bz("# Set\n- place: Bar\n\n1. [X](x.cifra.md)\n"), bz("# Set\n- place: Club\n\n1. [X](x.cifra.md)\n"))
	if c := findConflict(o, "property"); c == nil || c["key"] != "place" {
		t.Errorf("setlist property two values: want a property conflict on place, got %v", o.Conflicts)
	}

	// an item's link text changed differently -> a `text` conflict.
	o = mergeOut(t, true, bz("# Set\n\n1. [Alpha](alpha.cifra.md)\n"), bz("# Set\n\n1. [Alpha one](alpha.cifra.md)\n"), bz("# Set\n\n1. [Alpha two](alpha.cifra.md)\n"))
	if c := findConflict(o, "text"); c == nil || c["item"] != "alpha.cifra.md" {
		t.Errorf("setlist text conflict: want a text conflict on alpha.cifra.md, got %v", o.Conflicts)
	}

	// a song removed on one side and changed on the other -> an `item` conflict
	// (corpus/merge/25 shape).
	o = mergeOut(t, true,
		bz("# Set\n\n1. [X](x.cifra.md)\n2. [Beta](beta.cifra.md)\n   - key: D\n3. [Z](z.cifra.md)\n"),
		bz("# Set\n\n1. [X](x.cifra.md)\n2. [Z](z.cifra.md)\n"),
		bz("# Set\n\n1. [X](x.cifra.md)\n2. [Beta](beta.cifra.md)\n   - key: E\n3. [Z](z.cifra.md)\n"))
	if c := findConflict(o, "item"); c == nil || c["item"] != "beta.cifra.md" {
		t.Errorf("setlist item conflict: want an item conflict on beta.cifra.md, got %v", o.Conflicts)
	}

	// both change an entry (key) of the second occurrence of a song differently
	// -> an `entry` conflict carrying item and occurrence (§11.13).
	o = mergeOut(t, true,
		bz("# Set\n\n1. [Alpha](alpha.cifra.md)\n2. [Alpha](alpha.cifra.md)\n"),
		bz("# Set\n\n1. [Alpha](alpha.cifra.md)\n2. [Alpha](alpha.cifra.md)\n   - key: D\n"),
		bz("# Set\n\n1. [Alpha](alpha.cifra.md)\n2. [Alpha](alpha.cifra.md)\n   - key: E\n"))
	c := findConflict(o, "entry")
	if c == nil || c["key"] != "key" || c["item"] != "alpha.cifra.md" {
		t.Fatalf("setlist entry conflict: want an entry conflict on alpha.cifra.md key, got %v", o.Conflicts)
	}
	if occ, _ := c["occurrence"].(int); occ != 2 {
		t.Errorf("setlist entry conflict: occurrence = %v, want 2", c["occurrence"])
	}

	// a notes block after an item, changed differently -> a `notes` conflict
	// identified by the item it follows (`after`).
	o = mergeOut(t, true,
		bz("# Set\n\n1. [Alpha](alpha.cifra.md)\n\nbase notes\n\n2. [Beta](beta.cifra.md)\n"),
		bz("# Set\n\n1. [Alpha](alpha.cifra.md)\n\nour notes\n\n2. [Beta](beta.cifra.md)\n"),
		bz("# Set\n\n1. [Alpha](alpha.cifra.md)\n\ntheir notes\n\n2. [Beta](beta.cifra.md)\n"))
	if c := findConflict(o, "notes"); c == nil || c["after"] != "alpha.cifra.md" {
		t.Errorf("setlist notes conflict: want a notes conflict after alpha.cifra.md, got %v", o.Conflicts)
	}
}

// §11.13 — a conflicted setlist's marked text resolves to a marker-free
// canonical setlist by either side, and MergeOutputs maps it to the setlist file
// set.
func TestSetlistResolveAndOutputs(t *testing.T) {
	o := mergeOut(t, true, bz("# Set\n\n1. [Alpha](alpha.cifra.md)\n"), bz("# Set\n\n1. [Alpha one](alpha.cifra.md)\n"), bz("# Set\n\n1. [Alpha two](alpha.cifra.md)\n"))
	if o.Marked == nil {
		t.Fatal("a setlist text conflict should produce a marked text")
	}
	for _, side := range []string{"ours", "theirs"} {
		res, _ := ResolveMarked([]byte(*o.Marked), side)
		if len(MarkerLines(res)) != 0 {
			t.Errorf("resolve %s left a marker line:\n%s", side, res)
		}
		txt := canonicaliseSetlistText(string(res))
		if canonicaliseSetlistText(txt) != txt {
			t.Errorf("resolve %s is not a canonical fixed point", side)
		}
	}
	files, _ := MergeOutputs(o, true)
	if _, ok := files["conflicts.json"]; !ok {
		t.Errorf("MergeOutputs(setlist): missing conflicts.json")
	}
	if _, ok := files["marked.setlist.md"]; !ok {
		t.Errorf("MergeOutputs(setlist): a conflict with a region writes marked.setlist.md")
	}

	// a clean setlist merge writes result.setlist.md.
	clean := mergeOut(t, true, bz("# Set\n\n1. [Alpha](alpha.cifra.md)\n"), bz("# Set\n\n1. [Alpha](alpha.cifra.md)\n   - key: D\n"), bz("# Set\n\n1. [Alpha](alpha.cifra.md)\n"))
	files, _ = MergeOutputs(clean, true)
	if _, ok := files["result.setlist.md"]; !ok {
		t.Errorf("MergeOutputs(setlist clean): missing result.setlist.md")
	}
}

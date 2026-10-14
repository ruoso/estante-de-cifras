package cifra

// Unit tests of the song merge (spec §11), chapter 11 section by section, on
// tiny purpose-written songs (never a real song). Byte-level comparisons go
// through serialize/Encode, never reflect.DeepEqual on models. The exhaustive
// footnote-marker and voicing matrix of §11.9/§11.10 is pinned by the corpus
// battery (internal/corpus); these tests pin the method, the whole-files table,
// the value/metadata and reading conflicts, the conflict model and JSON, and the
// §11.3 properties (determinism, result-canonical, unchanged-side, resolution)
// on invented songs covering sequences, the chart, voicings and footnotes.

import (
	"bytes"
	"strings"
	"testing"
	"unicode/utf8"
)

func bz(s string) []byte { return []byte(s) }

func mergeOut(t *testing.T, setlist bool, base, ours, theirs []byte) Outcome {
	t.Helper()
	o, err := Merge(base, ours, theirs, setlist)
	if err != nil {
		t.Fatalf("Merge returned an error: %v", err)
	}
	return o
}

func digest(t *testing.T, o Outcome) string {
	t.Helper()
	var b strings.Builder
	b.WriteString(o.Kind())
	if o.Result != nil {
		b.WriteString("|R:" + *o.Result)
	}
	if o.Marked != nil {
		b.WriteString("|M:" + *o.Marked)
	}
	cj, _ := ConflictsJSON(o)
	b.WriteString("|C:" + string(cj))
	return b.String()
}

// checkInvariants pins the §11.3 properties computable per triple: determinism,
// a clean result is canonical, the unchanged-side identities (§11.16 perm), and
// resolving a marked text by either side gives a marker-free canonical fixed
// point (§11.12.4). It runs for both songs and setlists.
func checkInvariants(t *testing.T, name string, setlist bool, base, ours, theirs []byte) {
	t.Helper()
	canon := canonicalSongText
	if setlist {
		canon = canonicaliseSetlistText
	}
	o := mergeOut(t, setlist, base, ours, theirs)
	if d1, d2 := digest(t, o), digest(t, mergeOut(t, setlist, base, ours, theirs)); d1 != d2 {
		t.Errorf("%s: merge is not deterministic", name)
	}
	if o.Result != nil && canon(*o.Result) != *o.Result {
		t.Errorf("%s: a clean result is not canonical (§11.11)", name)
	}
	var inputs [][]byte
	for _, in := range [][]byte{base, ours, theirs} {
		if in == nil || !utf8.Valid(in) || len(MarkerLines(in)) > 0 {
			continue
		}
		inputs = append(inputs, in)
	}
	for _, b := range inputs {
		for _, x := range inputs {
			want := canon(string(x))
			for _, trip := range [][3][]byte{{b, x, x}, {b, b, x}, {b, x, b}} {
				r := mergeOut(t, setlist, trip[0], trip[1], trip[2])
				got := ""
				if r.Result != nil {
					got = *r.Result
				}
				if got != want {
					t.Errorf("%s: unchanged-side identity failed (§11.3)", name)
				}
			}
		}
	}
	if o.Marked != nil {
		for _, side := range []string{"ours", "theirs"} {
			res, _ := ResolveMarked([]byte(*o.Marked), side)
			if len(MarkerLines(res)) > 0 {
				t.Errorf("%s: resolving by %s left a marker line (§11.12.4)", name, side)
			}
			txt := canon(string(res))
			if canon(txt) != txt {
				t.Errorf("%s: resolving by %s is not a canonical fixed point", name, side)
			}
		}
	}
}

// §11.4 — whole files: the absence table, not-UTF-8, marked inputs,
// delete-vs-change, and the fixed case order.
func TestWholeFiles(t *testing.T) {
	S := bz("# T\n\n## A\n\nC\n")
	S2 := bz("# T\n\n## A\n\nD\n")

	cases := []struct {
		name               string
		base, ours, theirs []byte
		wantKind           string
	}{
		{"base only -> deleted", S, nil, nil, "deleted"},
		{"no base, ours only -> result", nil, S, nil, "result"},
		{"no base, theirs only -> result", nil, nil, S, "result"},
		{"no base, both alike -> result", nil, S, S, "result"},
		{"nothing -> deleted", nil, nil, nil, "deleted"},
		{"theirs == base, ours gone -> deleted", S, nil, S, "deleted"},
		{"ours == base, theirs gone -> deleted", S, S, nil, "deleted"},
		{"all three alike -> result", S, S, S, "result"},
	}
	for _, c := range cases {
		o := mergeOut(t, false, c.base, c.ours, c.theirs)
		if o.Kind() != c.wantKind {
			t.Errorf("%s: kind = %q, want %q", c.name, o.Kind(), c.wantKind)
		}
	}
	// no base, ours only -> the canonical of ours
	if o := mergeOut(t, false, nil, S, nil); o.Result == nil || *o.Result != canonicalSongText(string(S)) {
		t.Errorf("no base ours-only: result is not canonical ours")
	}

	// not-UTF-8: a `file` conflict naming the unreadable side, not rewritten.
	bad := append(append([]byte{}, S...), 0xff, 0xfe)
	o := mergeOut(t, false, S, bad, S2)
	if o.Kind() != "conflicts" || o.Conflicts[0]["kind"] != "file" {
		t.Fatalf("not-UTF-8: want a file conflict, got %v", o.Conflicts)
	}
	if u, _ := o.Conflicts[0]["unreadable"].([]any); len(u) != 1 || u[0] != "ours" {
		t.Errorf("not-UTF-8: unreadable = %v, want [ours]", o.Conflicts[0]["unreadable"])
	}
	if o.Marked != nil || o.Result != nil {
		t.Errorf("not-UTF-8: nothing is written (no result, no marked)")
	}

	// a marked input is never merged: `unresolved`, ours kept byte for byte.
	markedOurs := bz("# T\n\n## A\n\n<<<<<<< ours\nC\n=======\nD\n>>>>>>> theirs\n")
	o = mergeOut(t, false, S, markedOurs, S2)
	if o.Kind() != "conflicts" || o.Conflicts[0]["kind"] != "unresolved" {
		t.Fatalf("marked input: want an unresolved conflict, got %v", o.Conflicts)
	}
	if ln, _ := o.Conflicts[0]["ours"].(int); ln != 5 {
		t.Errorf("marked input: first marker line = %v, want 5", o.Conflicts[0]["ours"])
	}
	if kept, _ := o.Kept.([]byte); !bytes.Equal(kept, markedOurs) {
		t.Errorf("marked input: ours is not kept byte for byte")
	}
	if o.Marked != nil {
		t.Errorf("marked input: there is no marked text")
	}

	// a git-written marker set (with |||||||) on theirs is detected too.
	gitMarked := bz("# T\n\n## A\n\n<<<<<<< HEAD\nC\n||||||| base\nC\n=======\nD\n>>>>>>> branch\n")
	o = mergeOut(t, false, S, S2, gitMarked)
	if o.Conflicts[0]["kind"] != "unresolved" || o.Conflicts[0]["theirs"] == nil {
		t.Errorf("git-written markers: want an unresolved conflict naming theirs, got %v", o.Conflicts)
	}

	// delete-vs-change: a `file` conflict naming the deleting side, no marked.
	o = mergeOut(t, false, S, nil, S2)
	if o.Conflicts[0]["kind"] != "file" || o.Conflicts[0]["deleted"] != "ours" || o.Marked != nil {
		t.Errorf("delete-vs-change (ours gone): got %v", o.Conflicts)
	}
	if kept, _ := o.Kept.(string); kept != canonicalSongText(string(S2)) {
		t.Errorf("delete-vs-change: kept is not the changed side's canonical text")
	}
	o = mergeOut(t, false, S, S2, nil)
	if o.Conflicts[0]["kind"] != "file" || o.Conflicts[0]["deleted"] != "theirs" {
		t.Errorf("delete-vs-change (theirs gone): got %v", o.Conflicts)
	}

	// the fixed case order: not-UTF-8 is decided before a marked input.
	o = mergeOut(t, false, S, bad, markedOurs)
	if o.Conflicts[0]["kind"] != "file" {
		t.Errorf("case order: a not-UTF-8 side must win over a marked side, got %v", o.Conflicts)
	}
}

// §11.3, §11.5, §11.8, §11.10, §11.11 — the merge's properties on invented
// songs that exercise sequences, the chart, voicings and footnote markers.
func TestMergeInvariants(t *testing.T) {
	foot := "## A\n```\nCm | F7 | Cm[2] | G7\nCm | F7 | Cm | G7\n```\n\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- Cm: x35543\n- Cm[2]: 8-10-10-8-8-8\n- F7: 131211\n- G7: 320001\n"
	cases := []struct {
		name               string
		base, ours, theirs string
	}{
		{"independent sections (§11.5, §11.8.2)",
			"# S\n\n## V\n\nC G\n\n## C\n\nF C\n",
			"# S\n\n## V\n\nC D\n\n## C\n\nF C\n",
			"# S\n\n## V\n\nC G\n\n## C\n\nF Am\n"},
		{"same line two changes (§11.12)",
			"# S\n\n## V\n\nC G\n",
			"# S\n\n## V\n\nC D\n",
			"# S\n\n## V\n\nC E\n"},
		{"a section renamed on one side (§11.8.2)",
			"# S\n\n## A\n\nC\n\n## B\n\nG\n",
			"# S\n\n## Intro\n\nC\n\n## B\n\nG\n",
			"# S\n\n## A\n\nC\n\n## B\n\nAm\n"},
		{"properties added apart (§11.7.1)",
			"# S\n\n## A\n\nC\n",
			"# S\n- capo: 2\n\n## A\n\nC\n",
			"# S\n- key: C\n\n## A\n\nC\n"},
		{"voicings edited apart (§11.10)",
			foot,
			strings.Replace(foot, "- G7: 320001", "- G7: 353433", 1),
			strings.Replace(foot, "- F7: 131211", "- F7: 131200", 1)},
		{"footnote markers, chart edited apart (§11.9)",
			foot,
			strings.Replace(foot, "Cm | F7 | Cm[2] | G7\nCm | F7 | Cm | G7", "Cm | F7 | Cm[2] | G7\nCm | F7 | Cm | G7\nCm | G7", 1),
			foot},
	}
	for _, c := range cases {
		checkInvariants(t, c.name, false, bz(c.base), bz(c.ours), bz(c.theirs))
	}
}

// §11.6, §11.7 — values and metadata: the title and properties merged per
// value, with conflicts where the two sides disagree.
func TestMetadataConflicts(t *testing.T) {
	// title two values -> a `title` conflict.
	o := mergeOut(t, false, bz("# A\n\n## V\n\nC\n"), bz("# B\n\n## V\n\nC\n"), bz("# C\n\n## V\n\nC\n"))
	if o.Kind() != "conflicts" || o.Conflicts[0]["kind"] != "title" {
		t.Fatalf("title two values: want a title conflict, got %v", o.Conflicts)
	}
	if o.Conflicts[0]["base"] != "A" || o.Conflicts[0]["ours"] != "B" || o.Conflicts[0]["theirs"] != "C" {
		t.Errorf("title conflict members = %v", o.Conflicts[0])
	}

	// one side changes a property's value, the other does not -> result keeps
	// the change (independent); both change it differently -> a `property`
	// conflict.
	base := bz("# S\n- capo: 1\n\n## V\n\nC\n")
	o = mergeOut(t, false, base, bz("# S\n- capo: 2\n\n## V\n\nC\n"), base)
	if o.Kind() != "result" {
		t.Errorf("one-sided property change should merge cleanly, got %s", o.Kind())
	}
	o = mergeOut(t, false, base, bz("# S\n- capo: 2\n\n## V\n\nC\n"), bz("# S\n- capo: 3\n\n## V\n\nC\n"))
	if o.Kind() != "conflicts" || o.Conflicts[0]["kind"] != "property" || o.Conflicts[0]["key"] != "capo" {
		t.Errorf("property two values: want a property conflict on capo, got %v", o.Conflicts)
	}
}

// §11.7.2 — reading conflicts: one side changes `notation` or `words` under
// music the other side wrote.
func TestReadingConflicts(t *testing.T) {
	// notation (corpus/merge/22 shape): ours sets notation=american, theirs adds
	// a line with C7+, which reads differently between dialects.
	o := mergeOut(t, false,
		bz("# Tarde\n- artist: Nobody\n\n## A\n```\nC | Am | Dm | G7\n```\n"),
		bz("# Tarde\n- artist: Nobody\n- notation: american\n\n## A\n```\nC | Am | Dm | G7\n```\n"),
		bz("# Tarde\n- artist: Nobody\n\n## A\n```\nC | Am | Dm | G7\nC7+ | Am | Dm | G7\n```\n"))
	if o.Kind() != "conflicts" {
		t.Fatalf("reading-notation: want conflicts, got %s", o.Kind())
	}
	c := findConflict(o, "reading")
	if c == nil || c["key"] != "notation" || c["changed"] != "ours" {
		t.Fatalf("reading-notation: want a notation reading conflict changed by ours, got %v", o.Conflicts)
	}
	if syms, _ := c["symbols"].([]any); len(syms) != 1 || syms[0] != "C7+" {
		t.Errorf("reading-notation: symbols = %v, want [C7+]", c["symbols"])
	}

	// words (corpus/merge/41 shape): ours sets words=no, theirs adds lyrics.
	o = mergeOut(t, false,
		bz("# Song\n- words: yes\n\n## Verse\n```\nC       G\nla la la la\n```\n"),
		bz("# Song\n- words: no\n\n## Verse\n```\nC       G\nla la la la\n```\n"),
		bz("# Song\n- words: yes\n\n## Verse\n```\nC       G\nla la la la\nAm | F\n```\n"))
	c = findConflict(o, "reading")
	if c == nil || c["key"] != "words" || c["changed"] != "ours" {
		t.Fatalf("reading-words: want a words reading conflict changed by ours, got %v", o.Conflicts)
	}
}

func findConflict(o Outcome, kind string) map[string]any {
	for _, c := range o.Conflicts {
		if c["kind"] == kind {
			return c
		}
	}
	return nil
}

// §11.12.5 — the conflicts JSON: member presence and order, two-space indent,
// final newline, byte for byte against a crafted object.
func TestConflictsJSON(t *testing.T) {
	o := mergeOut(t, false, bz("# A\n\n## V\n\nC\n"), bz("# B\n\n## V\n\nC\n"), bz("# C\n\n## V\n\nC\n"))
	got, _ := ConflictsJSON(o)
	want := "{\n  \"conflicts\": [\n    {\n      \"kind\": \"title\",\n      \"line\": 1,\n      \"base\": \"A\",\n      \"ours\": \"B\",\n      \"theirs\": \"C\"\n    }\n  ]\n}\n"
	if string(got) != want {
		t.Errorf("ConflictsJSON mismatch\n got: %q\nwant: %q", got, want)
	}
	// MergeOutputs maps the outcome to the file set.
	files, _ := MergeOutputs(o, false)
	if _, ok := files["conflicts.json"]; !ok {
		t.Errorf("MergeOutputs: missing conflicts.json, got keys %v", keysOf(files))
	}
	if _, ok := files["marked.cifra.md"]; !ok {
		t.Errorf("MergeOutputs: a conflict with a region writes marked.cifra.md")
	}
}

func keysOf(m map[string][]byte) []string {
	var out []string
	for k := range m {
		out = append(out, k)
	}
	return out
}

// §11.12.4 — resolving the marked text by ours and by theirs each gives a
// marker-free canonical text that is a fixed point.
func TestResolveMarked(t *testing.T) {
	o := mergeOut(t, false, bz("# S\n\n## V\n\nC G\n"), bz("# S\n\n## V\n\nC D\n"), bz("# S\n\n## V\n\nC E\n"))
	if o.Marked == nil {
		t.Fatal("same-line conflict should produce a marked text")
	}
	for _, side := range []string{"ours", "theirs"} {
		res, _ := ResolveMarked([]byte(*o.Marked), side)
		if len(MarkerLines(res)) != 0 {
			t.Errorf("resolve %s left a marker line:\n%s", side, res)
		}
		txt := canonicalSongText(string(res))
		if canonicalSongText(txt) != txt {
			t.Errorf("resolve %s is not a canonical fixed point", side)
		}
	}
}

// §11.8.1 — masked text: a chord's symbol stands in for its key, so changing a
// footnote index alone (Cm vs Cm[2]) is not a line change — the lines still
// match and merge cleanly.
func TestMaskedText(t *testing.T) {
	base := "## A\n```\nCm | Cm\n```\n\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- Cm: x35543\n"
	// ours re-voices the second Cm as Cm[2]; the masked text is unchanged, so a
	// one-sided change on theirs elsewhere does not collide with it.
	ours := "## A\n```\nCm | Cm[2]\n```\n\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- Cm: x35543\n- Cm[2]: 8-10-10-8-8-8\n"
	o := mergeOut(t, false, bz(base), bz(ours), bz(base))
	if o.Kind() != "result" {
		t.Errorf("a re-index (masked text unchanged) on one side should merge cleanly, got %s\n%v", o.Kind(), o.Conflicts)
	}
}

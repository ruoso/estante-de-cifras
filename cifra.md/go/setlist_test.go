package cifra

// Unit tests for the §10 setlist reader and the §10.9 canonical writer on
// purpose-written setlists, ported from reference/tests/test_setlists.py and
// mirroring js/test/setlist.test.js — agreement is by the corpus, not shared
// code. Grouped by spec subsection as subtests, with the enumerable cases as
// table tests (cifra_go.setlists refinement, unit level). All setlists and the
// songs they name are invented for the purpose.

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"
)

// --- helpers -----------------------------------------------------------------

func parse(t *testing.T, src string) Model {
	t.Helper()
	m, err := ParseSetlist([]byte(src))
	if err != nil {
		t.Fatalf("ParseSetlist(%q): %v", src, err)
	}
	return m
}

// canon is the canonical text of a setlist source: read it, write it back.
func canon(t *testing.T, src string) string {
	t.Helper()
	b, err := WriteSetlist(parse(t, src))
	if err != nil {
		t.Fatalf("WriteSetlist: %v", err)
	}
	return string(b)
}

func diagCodes(m Model) []string {
	out := []string{}
	for _, d := range objArray(m, "diagnostics") {
		out = append(out, objString(d.(*Object), "code"))
	}
	return out
}

func body(m Model) []any { return objArray(m, "body") }

func bodyAt(m Model, i int) *Object { return body(m)[i].(*Object) }

func itemNumbers(m Model) []string {
	out := []string{}
	for _, el := range body(m) {
		o := el.(*Object)
		if v, ok := o.Get("number"); ok {
			out = append(out, fmt.Sprint(v))
		}
	}
	return out
}

func notesLinesOf(o *Object) []string {
	out := []string{}
	for _, ln := range objArray(o, "lines") {
		out = append(out, ln.(string))
	}
	return out
}

// entryPairs renders an item or the model's entries as "type/key=value" or
// "type/text" strings, a compact shape to compare against expectations.
func entryPairs(entries []any) []string {
	out := []string{}
	for _, e := range entries {
		o := e.(*Object)
		if objString(o, "type") == "property" {
			out = append(out, "property/"+objString(o, "key")+"="+objString(o, "value"))
		} else {
			out = append(out, "unrecognised/"+objString(o, "text"))
		}
	}
	return out
}

// --- structure and classification (§10.3, §10.3.1–§10.3.4) -------------------

func TestStructureAndClassification(t *testing.T) {
	t.Run("numbers are positions, ) accepted, out of order renumbered", func(t *testing.T) {
		m := parse(t, "7. [A](a.cifra.md)\n7) [B](b.cifra.md)\n1. [C](c.cifra.md)\n")
		if got := itemNumbers(m); !reflect.DeepEqual(got, []string{"1", "2", "3"}) {
			t.Errorf("numbers = %v, want [1 2 3]", got)
		}
	})

	t.Run("four spaces before a number is notes", func(t *testing.T) {
		m := parse(t, "1. [A](a.cifra.md)\n    2. [B](b.cifra.md)\n")
		if got := notesLinesOf(bodyAt(m, 1)); !reflect.DeepEqual(got, []string{"    2. [B](b.cifra.md)"}) {
			t.Errorf("notes = %q", got)
		}
	})

	t.Run("a bullet after a notes line is notes", func(t *testing.T) {
		m := parse(t, "1. [A](a.cifra.md)\nsome notes\n- a list in the notes\n")
		if got := notesLinesOf(bodyAt(m, 1)); !reflect.DeepEqual(got, []string{"some notes", "- a list in the notes"}) {
			t.Errorf("notes = %q", got)
		}
		if got := entryPairs(objArray(bodyAt(m, 0), "entries")); len(got) != 0 {
			t.Errorf("item entries = %v, want none", got)
		}
	})

	t.Run("a fence in the notes hides items", func(t *testing.T) {
		m := parse(t, "```\n1. [A](a.cifra.md)\n\n- key: D\n```\n2. [B](b.cifra.md)\n")
		want := []string{"```", "1. [A](a.cifra.md)", "", "- key: D", "```"}
		if got := notesLinesOf(bodyAt(m, 0)); !reflect.DeepEqual(got, want) {
			t.Errorf("notes = %q, want %q", got, want)
		}
		if n, _ := bodyAt(m, 1).Get("number"); fmt.Sprint(n) != "1" {
			t.Errorf("item after fence numbered %v, want 1", n)
		}
	})

	t.Run("an unclosed fence runs to the end and is reported", func(t *testing.T) {
		m := parse(t, "1. [A](a.cifra.md)\n~~~\n2. [B](b.cifra.md)\n\n")
		if got := notesLinesOf(bodyAt(m, 1)); !reflect.DeepEqual(got, []string{"~~~", "2. [B](b.cifra.md)"}) {
			t.Errorf("notes = %q", got)
		}
		if got := diagCodes(m); !reflect.DeepEqual(got, []string{"unclosed-fence"}) {
			t.Errorf("diagnostics = %v, want [unclosed-fence]", got)
		}
	})

	t.Run("a notes block splits a run with numbering continuing", func(t *testing.T) {
		src := "1. [A](a.cifra.md)\n\nbreak\n\n2. [B](b.cifra.md)\n"
		m := parse(t, src)
		if got := itemNumbers(m); !reflect.DeepEqual(got, []string{"1", "2"}) {
			t.Errorf("numbers = %v, want [1 2]", got)
		}
		// Canonical form keeps the split and continues the numbering.
		want := "1. [A](a.cifra.md)\n\nbreak\n\n2. [B](b.cifra.md)\n"
		if got := canon(t, src); got != want {
			t.Errorf("canon = %q, want %q", got, want)
		}
	})

	t.Run("notes keep leading spaces and inner blank lines", func(t *testing.T) {
		src := "1. [A](a.cifra.md)\n\n  indented\n\n\nmore\n\n2. [B](b.cifra.md)\n"
		m := parse(t, src)
		if got := notesLinesOf(bodyAt(m, 1)); !reflect.DeepEqual(got, []string{"  indented", "", "", "more"}) {
			t.Errorf("notes = %q", got)
		}
		if got := canon(t, src); got != src {
			t.Errorf("canon = %q, want %q", got, src)
		}
	})
}

// --- title and properties (§10.3.1, §10.6) -----------------------------------

func TestTitleAndProperties(t *testing.T) {
	t.Run("an empty title is no title", func(t *testing.T) {
		m := parse(t, "#\n1. [A](a.cifra.md)\n")
		if v, _ := m.Get("title"); v != nil {
			t.Errorf("title = %v, want nil", v)
		}
	})

	t.Run("a level-1 heading is the title", func(t *testing.T) {
		m := parse(t, "# Set\n1. [A](a.cifra.md)\n")
		if got := objString(m, "title"); got != "Set" {
			t.Errorf("title = %q, want Set", got)
		}
	})

	t.Run("properties follow the title with blank lines between", func(t *testing.T) {
		m := parse(t, "# T\n\n- date: today\n\n- Place: here\n- loose\n\n1. [A](a.cifra.md)\n")
		want := []string{"property/date=today", "property/place=here", "unrecognised/loose"}
		if got := entryPairs(objArray(m, "properties")); !reflect.DeepEqual(got, want) {
			t.Errorf("properties = %v, want %v", got, want)
		}
		if got := diagCodes(m); !reflect.DeepEqual(got, []string{"unrecognised-entry"}) {
			t.Errorf("diagnostics = %v", got)
		}
	})

	t.Run("properties with no title", func(t *testing.T) {
		m := parse(t, "- a: 1\n\n1. [A](a.cifra.md)\n")
		if v, _ := m.Get("title"); v != nil {
			t.Errorf("title = %v, want nil", v)
		}
		if got := entryPairs(objArray(m, "properties")); !reflect.DeepEqual(got, []string{"property/a=1"}) {
			t.Errorf("properties = %v", got)
		}
	})

	t.Run("a repeated key keeps its first place and last value", func(t *testing.T) {
		m := parse(t, "1. [A](a.cifra.md)\n   - note: x\n   - key: D\n   - note: y\n")
		want := []string{"property/note=y", "property/key=D"}
		if got := entryPairs(objArray(bodyAt(m, 0), "entries")); !reflect.DeepEqual(got, want) {
			t.Errorf("entries = %v, want %v", got, want)
		}
		if got := diagCodes(m); !reflect.DeepEqual(got, []string{"duplicate-key"}) {
			t.Errorf("diagnostics = %v", got)
		}
	})

	t.Run("a value may be empty", func(t *testing.T) {
		m := parse(t, "- date:\n\n1. [A](a.cifra.md)\n")
		if got := entryPairs(objArray(m, "properties")); !reflect.DeepEqual(got, []string{"property/date="}) {
			t.Errorf("properties = %v, want [property/date=]", got)
		}
	})

	t.Run("the space after the colon is required", func(t *testing.T) {
		m := parse(t, "- date:today\n\n1. [A](a.cifra.md)\n")
		if got := entryPairs(objArray(m, "properties")); !reflect.DeepEqual(got, []string{"unrecognised/date:today"}) {
			t.Errorf("properties = %v, want [unrecognised/date:today]", got)
		}
	})
}

// --- links and unlinked items (§10.4, §10.4.1, §10.3.2) ----------------------

func TestLinksAndUnlinkedItems(t *testing.T) {
	t.Run("a song link reads its text and path", func(t *testing.T) {
		m := parse(t, "1. [Opening Tune](songs/opening.cifra.md)\n")
		o := bodyAt(m, 0)
		if objString(o, "type") != "song" || objString(o, "text") != "Opening Tune" || objString(o, "path") != "songs/opening.cifra.md" {
			t.Errorf("song = %+v", o)
		}
	})

	t.Run("unlinked contents are kept, reported and counted", func(t *testing.T) {
		contents := []string{
			`[A](a.cifra.md "A")`,  // a link with a title
			"[A][a]",               // a reference link
			"![A](a.cifra.md)",     // an image
			"<a.cifra.md>",         // an autolink
			"[A](a.cifra.md) live", // trailing text
			"",                     // empty
			"just text",            // plain text
			"[A](a b.cifra.md)",    // a space in the destination
		}
		for _, content := range contents {
			m := parse(t, "1. "+content+"\n")
			o := bodyAt(m, 0)
			if objString(o, "type") != "unlinked" || objString(o, "content") != content {
				t.Errorf("%q: item = %+v, want unlinked with that content", content, o)
			}
			if n, _ := o.Get("number"); fmt.Sprint(n) != "1" {
				t.Errorf("%q: number %v, want 1", content, n)
			}
		}
	})

	t.Run("the link text is kept as written", func(t *testing.T) {
		src := "1. [A \\] [b] *c*](a.cifra.md)\n"
		m := parse(t, src)
		if got := objString(bodyAt(m, 0), "text"); got != `A \] [b] *c*` {
			t.Errorf("text = %q", got)
		}
		if got := canon(t, src); got != src {
			t.Errorf("canon = %q, want %q", got, src)
		}
	})
}

// --- item entries (§10.7, §10.9.2) -------------------------------------------

func TestItemEntries(t *testing.T) {
	t.Run("key, note and an application-defined key kept and written key→note→rest", func(t *testing.T) {
		src := "1. [A](a.cifra.md)\n- singer: Ana\n      - note: n\n - other\n  - key: E\n"
		want := "1. [A](a.cifra.md)\n   - key: E\n   - note: n\n   - singer: Ana\n   - other\n"
		if got := canon(t, src); got != want {
			t.Errorf("canon = %q, want %q", got, want)
		}
	})

	t.Run("entry indentation follows the number", func(t *testing.T) {
		src := ""
		for n := 1; n <= 10; n++ {
			src += fmt.Sprintf("%d. [S%d](s%d.cifra.md)\n", n, n, n)
		}
		src += "- key: D\n"
		out := canon(t, src)
		if want := "10. [S10](s10.cifra.md)\n    - key: D\n"; !hasSuffix(out, want) {
			t.Errorf("canon tail = %q, want suffix %q", out, want)
		}
	})
}

// --- the key property (§10.7.1) ----------------------------------------------

func TestKeyProperty(t *testing.T) {
	t.Run("valid keys report no diagnostic", func(t *testing.T) {
		for _, k := range []string{"C", "G", "Am", "F#", "Bb", "C♯", "A♭m", "Em"} {
			m := parse(t, "1. [A](a.cifra.md)\n   - key: "+k+"\n")
			if got := diagCodes(m); len(got) != 0 {
				t.Errorf("key %q reported %v, want none", k, got)
			}
		}
	})

	t.Run("a bad key is reported, kept and written back", func(t *testing.T) {
		m := parse(t, "1. [A](a.cifra.md)\n   - key: H\n")
		if got := diagCodes(m); !reflect.DeepEqual(got, []string{"bad-key"}) {
			t.Errorf("diagnostics = %v, want [bad-key]", got)
		}
		out := canon(t, "1. [A](a.cifra.md)\n   - key: H\n")
		if !hasSuffix(out, "- key: H\n") {
			t.Errorf("canon = %q, want it to keep `- key: H`", out)
		}
	})
}

// --- paths (§10.5, §10.9.2) --------------------------------------------------

func TestPaths(t *testing.T) {
	t.Run("successes", func(t *testing.T) {
		cases := []struct{ dest, path string }{
			{"a.cifra.md", "a.cifra.md"},
			{"./bossa/../a.cifra.md", "a.cifra.md"},          // dot-segments removed
			{"../../a.cifra.md", "../../a.cifra.md"},         // a leading ..
			{"<a b.cifra.md>", "a b.cifra.md"},               // a bracketed destination
			{"a%20b.cifra.md", "a b.cifra.md"},               // percent-decoding
			{"%2E%2E/a.cifra.md", "../a.cifra.md"},           // decoded dot-dot
			{"can%C3%A7%C3%A3o.cifra.md", "canção.cifra.md"}, // UTF-8 percent bytes
			{"a\\(1\\).cifra.md", "a(1).cifra.md"},           // backslash-escaped parens
			{"a(1).cifra.md", "a(1).cifra.md"},               // balanced parens
		}
		for _, c := range cases {
			path, reason := songPath(c.dest)
			if path != c.path || reason != "" {
				t.Errorf("songPath(%q) = (%q, %q), want (%q, \"\")", c.dest, path, reason, c.path)
			}
		}
	})

	t.Run("failures at their named step", func(t *testing.T) {
		cases := []struct{ dest, step string }{
			{"https://example.com/a.cifra.md", "step 2"},
			{"C:/a.cifra.md", "step 2"},
			{"a.cifra.md#verse", "step 2"},
			{"a.cifra.md?x", "step 2"},
			{"/a.cifra.md", "step 2"},
			{"a//b.cifra.md", "step 3"},
			{"bossa/", "step 3"},
			{"%FF.cifra.md", "step 4"},
			{"a%2Fb.cifra.md", "step 4"},
			{"a/..", "step 5"},
			{"a.md", "step 6"},
			{".cifra.md", "step 6"},
			{"A.Cifra.md", "step 6"},
		}
		for _, c := range cases {
			path, reason := songPath(c.dest)
			if path != "" || !hasPrefix(reason, c.step) {
				t.Errorf("songPath(%q) = (%q, %q), want a failure at %q", c.dest, path, reason, c.step)
			}
		}
	})

	t.Run("a non-escape backslash is reported", func(t *testing.T) {
		// A backslash that is not a Markdown escape survives into the path; the
		// reader keeps the item as a song and reports it (§10.5, §10.3.2).
		m := parse(t, "1. [A](a\\b.cifra.md)\n")
		o := bodyAt(m, 0)
		if objString(o, "type") != "song" || objString(o, "path") != `a\b.cifra.md` {
			t.Errorf("item = %+v, want song with path a\\b.cifra.md", o)
		}
		if got := diagCodes(m); !reflect.DeepEqual(got, []string{"backslash-in-path"}) {
			t.Errorf("diagnostics = %v, want [backslash-in-path]", got)
		}
	})

	t.Run("a failed path is reported with its step", func(t *testing.T) {
		m := parse(t, "1. [A](https://example.com/a.cifra.md)\n")
		if objString(bodyAt(m, 0), "type") != "unlinked" {
			t.Errorf("item should be unlinked")
		}
		if codes := diagCodes(m); !reflect.DeepEqual(codes, []string{"bad-path"}) {
			t.Errorf("diagnostics = %v, want [bad-path]", codes)
		}
		msg := objString(objArray(m, "diagnostics")[0].(*Object), "message")
		if !contains(msg, "step 2") {
			t.Errorf("message = %q, want it to name step 2", msg)
		}
	})

	t.Run("writePath round-trips, including the non-ASCII-after-percent case", func(t *testing.T) {
		cases := []struct{ path, written string }{
			{"a b.cifra.md", "a%20b.cifra.md"},
			{"a&b (1):x.cifra.md", "a%26b%20%281%29%3Ax.cifra.md"},
			{"canção.cifra.md", "canção.cifra.md"},
			{"<\u0301.cifra.md", "%3C%CC%81.cifra.md"}, // an accent after a decoded byte
			{"-._~!$'*+,;=@.cifra.md", "-._~!$'*+,;=@.cifra.md"},
			{"../x/y.cifra.md", "../x/y.cifra.md"},
		}
		for _, c := range cases {
			if got := writePath(c.path); got != c.written {
				t.Errorf("writePath(%q) = %q, want %q", c.path, got, c.written)
			}
			path, reason := songPath(c.written)
			if path != c.path || reason != "" {
				t.Errorf("songPath(%q) = (%q, %q), want (%q, \"\")", c.written, path, reason, c.path)
			}
		}
	})
}

// --- the canonical writer (§10.9) --------------------------------------------

func TestCanonicalWriter(t *testing.T) {
	t.Run("the §10.9.4 worked example", func(t *testing.T) {
		src := "#   Thursday\n\n" +
			"3) [Minimal](./minimal.cifra.md)\n" +
			"     - Note: count in slowly\n" +
			"     - KEY: E\n" +
			"1)   [Tarde Clara](<with-words.cifra.md>)\n\n" +
			"Second set.\n" +
			"7. [Repeats](songs/../repeats.cifra.md \"Repeats\")\n"
		want := "# Thursday\n\n" +
			"1. [Minimal](minimal.cifra.md)\n" +
			"   - key: E\n" +
			"   - note: count in slowly\n" +
			"2. [Tarde Clara](with-words.cifra.md)\n\n" +
			"Second set.\n\n" +
			"3. [Repeats](songs/../repeats.cifra.md \"Repeats\")\n"
		if got := canon(t, src); got != want {
			t.Errorf("canon = %q, want %q", got, want)
		}
		if got := diagCodes(parse(t, src)); !reflect.DeepEqual(got, []string{"unlinked-item"}) {
			t.Errorf("diagnostics = %v, want [unlinked-item]", got)
		}
	})

	t.Run("the empty setlist is the empty file", func(t *testing.T) {
		if got := canon(t, ""); got != "" {
			t.Errorf("canon(\"\") = %q, want empty", got)
		}
		if got := canon(t, "\n\n"); got != "" {
			t.Errorf("canon(blank lines) = %q, want empty", got)
		}
		if got := canon(t, "#\n"); got != "" {
			t.Errorf("canon(bare #) = %q, want empty", got)
		}
	})

	t.Run("canonical form is a fixed point", func(t *testing.T) {
		src := "# T\n- a: 1\n\n1. [A](a.cifra.md)\n   - key: D\n\nnotes\n\n2. b\n"
		once := canon(t, src)
		if once != src {
			t.Errorf("canon = %q, want %q", once, src)
		}
		if twice := canon(t, once); twice != src {
			t.Errorf("canon∘canon = %q, want %q", twice, src)
		}
	})

	t.Run("the example setlists are canonical", func(t *testing.T) {
		_, thisFile, _, _ := runtime.Caller(0)
		examples := filepath.Join(filepath.Dir(thisFile), "..", "examples")
		matches, err := filepath.Glob(filepath.Join(examples, "*.setlist.md"))
		if err != nil {
			t.Fatalf("glob: %v", err)
		}
		if len(matches) == 0 {
			t.Fatalf("no example setlists found under %s", examples)
		}
		for _, path := range matches {
			data, err := os.ReadFile(path)
			if err != nil {
				t.Fatalf("read %s: %v", path, err)
			}
			if got := canon(t, string(data)); got != string(data) {
				t.Errorf("%s is not canonical: canon differs", filepath.Base(path))
			}
		}
	})
}

// --- CanonicalSetlist, model→model (§10.9) -----------------------------------

func TestCanonicalSetlistModel(t *testing.T) {
	// A model read from a non-canonical source: a repeated key and out-of-order
	// entries. CanonicalSetlist reorders and collapses them, and equals
	// read-after-write — the same canonicalisation corpus check 6 pins.
	src := "1. [A](a.cifra.md)\n   - note: x\n   - singer: Ana\n   - key: D\n   - note: y\n"
	model := parse(t, src)
	got, err := CanonicalSetlist(model)
	if err != nil {
		t.Fatalf("CanonicalSetlist: %v", err)
	}
	entries := objArray(bodyAt(got, 0), "entries")
	want := []string{"property/key=D", "property/note=y", "property/singer=Ana"}
	if pairs := entryPairs(entries); !reflect.DeepEqual(pairs, want) {
		t.Errorf("canonical entries = %v, want %v", pairs, want)
	}
	// read-after-write equivalence: CanonicalSetlist(model) == Parse(Write(model)).
	writeBack, _ := WriteSetlist(model)
	readBack, _ := ParseSetlist(writeBack)
	if !reflect.DeepEqual(Encode(got), Encode(readBack)) {
		t.Errorf("CanonicalSetlist differs from read-after-write")
	}
}

// small string helpers, to keep the intent of each assertion legible.
func hasSuffix(s, suffix string) bool {
	return len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix
}
func hasPrefix(s, prefix string) bool { return len(s) >= len(prefix) && s[:len(prefix)] == prefix }
func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

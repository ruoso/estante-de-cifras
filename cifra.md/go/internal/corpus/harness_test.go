package corpus

// Unit tests of the corpus harness itself (the .tji's "unit" level): that
// discovery enumerates exactly the corpus's entries (pins corpus.py lines
// 50–61 and corpus/README.md lines 19–21), that a planted mismatch is caught —
// including that Dump compares bytes in key order and emits non-ASCII raw — and
// that the ledger's stale-id guard holds. Fixtures are tiny synthetic entries
// with invented text, never a real song.

import (
	"errors"
	"os"
	"path/filepath"
	"sort"
	"testing"

	cifra "github.com/ruoso/cifra.md/go"
)

// --- test impls -----------------------------------------------------------

var errNotUsed = errors.New("operation not used by this check")

// noImpl satisfies Impl with operations that error; a fake embeds it and
// overrides only the operations its checks exercise.
type noImpl struct{}

func (noImpl) Parse([]byte) (cifra.Model, error)          { return nil, errNotUsed }
func (noImpl) Write(cifra.Model) ([]byte, error)          { return nil, errNotUsed }
func (noImpl) Canonical(cifra.Model) (cifra.Model, error) { return nil, errNotUsed }
func (noImpl) ParseSetlist([]byte) (cifra.Model, error)   { return nil, errNotUsed }
func (noImpl) WriteSetlist(cifra.Model) ([]byte, error)   { return nil, errNotUsed }
func (noImpl) CanonicalSetlist(cifra.Model) (cifra.Model, error) {
	return nil, errNotUsed
}
func (noImpl) Merge(_, _, _ []byte, _ bool) (cifra.Outcome, error) {
	return cifra.Outcome{}, errNotUsed
}
func (noImpl) MergeOutputs(cifra.Outcome, bool) (map[string][]byte, error) {
	return nil, errNotUsed
}
func (noImpl) ResolveMarked([]byte, string) ([]byte, error) { return nil, errNotUsed }
func (noImpl) Prepare([]byte) ([]string, error)             { return nil, errNotUsed }
func (noImpl) ParseChord(string, string) (cifra.Model, []any, []string) {
	return nil, nil, []string{"not used"}
}
func (noImpl) Dialects() map[string]map[string]string { return cifra.DIALECTS }

// --- helpers --------------------------------------------------------------

func obj(pairs ...any) cifra.Model {
	o := cifra.NewObject()
	for i := 0; i < len(pairs); i += 2 {
		o.Set(pairs[i].(string), pairs[i+1])
	}
	return o
}

func findCheck(t *testing.T, checks []Check, id string) Check {
	t.Helper()
	for _, c := range checks {
		if c.ID == id {
			return c
		}
	}
	t.Fatalf("no check with id %q (have %v)", id, ids(checks))
	return Check{}
}

func ids(checks []Check) []string {
	out := make([]string, len(checks))
	for i, c := range checks {
		out[i] = c.ID
	}
	return out
}

func write(t *testing.T, dir, name string, data []byte) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
		t.Fatal(err)
	}
}

// --- discovery ------------------------------------------------------------

func TestDiscoverEnumeratesEveryEntry(t *testing.T) {
	corpusDir := CorpusDir()
	d, err := Discover(corpusDir)
	if err != nil {
		t.Fatal(err)
	}

	// Classification of a few known entries.
	kinds := map[string]string{}
	for _, e := range d.Reading {
		kinds[e.Name] = e.Kind
	}
	for name, want := range map[string]string{
		"01-minimal-chart":      "song",
		"35-setlist-minimal":    "setlist",
		"47-setlist-text-layer": "setlist",
	} {
		if kinds[name] != want {
			t.Errorf("reading entry %s: kind = %q, want %q", name, kinds[name], want)
		}
	}
	if _, ok := kinds["merge"]; ok {
		t.Errorf("merge/ was discovered as a reading entry")
	}

	// Independent re-walk: Discover must find every reading entry present,
	// classified by input extension, so a newly added entry cannot be missed.
	ents, err := os.ReadDir(corpusDir)
	if err != nil {
		t.Fatal(err)
	}
	var wantReading []string
	for _, e := range ents {
		if !e.IsDir() || e.Name() == "merge" {
			continue
		}
		if fileExists(filepath.Join(corpusDir, e.Name(), "input.cifra.md")) ||
			fileExists(filepath.Join(corpusDir, e.Name(), "input.setlist.md")) {
			wantReading = append(wantReading, e.Name())
		}
	}
	sort.Strings(wantReading)
	var gotReading []string
	for _, e := range d.Reading {
		gotReading = append(gotReading, e.Name)
	}
	if !equalStrings(gotReading, wantReading) {
		t.Errorf("reading entries = %v, want %v", gotReading, wantReading)
	}
	if !sort.StringsAreSorted(gotReading) {
		t.Errorf("reading entries are not sorted: %v", gotReading)
	}

	// Merge entries: every subdirectory of corpus/merge/, sorted.
	var gotMerge []string
	for _, e := range d.Merge {
		gotMerge = append(gotMerge, e.Name)
	}
	if !sort.StringsAreSorted(gotMerge) {
		t.Errorf("merge entries are not sorted: %v", gotMerge)
	}
	for _, name := range []string{"01-different-sections", "37-file-not-utf8"} {
		if !contains(gotMerge, name) {
			t.Errorf("merge entries missing %s", name)
		}
	}
	ents, err = os.ReadDir(filepath.Join(corpusDir, "merge"))
	if err != nil {
		t.Fatal(err)
	}
	var wantMerge []string
	for _, e := range ents {
		if e.IsDir() {
			wantMerge = append(wantMerge, e.Name())
		}
	}
	sort.Strings(wantMerge)
	if !equalStrings(gotMerge, wantMerge) {
		t.Errorf("merge entries = %v, want %v", gotMerge, wantMerge)
	}
}

// --- planted reading mismatch ---------------------------------------------

// readingFake answers a synthetic reading entry exactly: parse maps the input
// text to its stored model and the canonical text to its, write returns the
// canonical text, and canonical returns a model that strips to the parsed one.
type readingFake struct {
	noImpl
	inputText, canonicalText []byte
	inputParsed, parsed      cifra.Model
	canonicalModel           cifra.Model
}

func (f readingFake) Parse(src []byte) (cifra.Model, error) {
	switch {
	case string(src) == string(f.inputText):
		return f.inputParsed, nil
	case string(src) == string(f.canonicalText):
		return f.parsed, nil
	}
	return nil, errors.New("unexpected parse input")
}
func (f readingFake) Write(cifra.Model) ([]byte, error)          { return f.canonicalText, nil }
func (f readingFake) Canonical(cifra.Model) (cifra.Model, error) { return f.canonicalModel, nil }

// The /tl check exercises the real text layer against the entry's canonical
// bytes, so the fake forwards to it (the planted canonical text is clean).
func (readingFake) Prepare(src []byte) ([]string, error) { return cifra.Prepare(src) }

func plantReadingEntry(t *testing.T) (ReadingEntry, readingFake) {
	t.Helper()
	dir := t.TempDir()
	// A tiny synthetic song: invented text, a non-ASCII title to prove Dump
	// emits it raw, and diagnostics/sungAt only on the uncanonical input so
	// check 6's strip is exercised.
	inputText := []byte("# Café\n\nx y z\n")
	canonicalText := []byte("# Café\n")
	inputParsed := obj("title", "Café", "diagnostics", []any{"spacing"}, "sungAt", mustNum("3"))
	parsed := obj("title", "Café", "diagnostics", []any{})
	// Canonical(input) carries the text-describing fields the parsed model
	// lacks; check 6 strips them, so it must still match.
	canonicalModel := obj("title", "Café", "sungAt", mustNum("9"), "diagnostics", []any{"x"})

	write(t, dir, "input.cifra.md", inputText)
	write(t, dir, "canonical.cifra.md", canonicalText)
	write(t, dir, "input.parsed.json", Dump(inputParsed))
	write(t, dir, "parsed.json", Dump(parsed))

	entry := ReadingEntry{Name: "synthetic", Dir: dir, Kind: "song"}
	fake := readingFake{
		inputText: inputText, canonicalText: canonicalText,
		inputParsed: inputParsed, parsed: parsed, canonicalModel: canonicalModel,
	}
	return entry, fake
}

func TestPlantedReadingEntryMatches(t *testing.T) {
	entry, fake := plantReadingEntry(t)
	for _, c := range ReadingChecks(entry, fake) {
		if err := c.Run(); err != nil {
			t.Errorf("%s should pass on a matching entry: %v", c.ID, err)
		}
	}
}

func TestPlantedReadingOneByteDifferenceFails(t *testing.T) {
	// An extra byte in input.parsed.json makes only check 1 report failure.
	entry, fake := plantReadingEntry(t)
	write(t, entry.Dir, "input.parsed.json", append(Dump(fake.inputParsed), ' '))
	if err := findCheck(t, ReadingChecks(entry, fake), "synthetic/1").Run(); err == nil {
		t.Error("check 1 should fail when input.parsed.json has an extra byte")
	}

	// An extra byte in the canonical text makes check 2 report failure.
	entry2, fake2 := plantReadingEntry(t)
	write(t, entry2.Dir, "canonical.cifra.md", append([]byte(nil), append(fake2.canonicalText, '!')...))
	if err := findCheck(t, ReadingChecks(entry2, fake2), "synthetic/2").Run(); err == nil {
		t.Error("check 2 should fail when canonical.cifra.md has an extra byte")
	}
}

func TestPlantedReadingReorderedKeysFailsCheck1(t *testing.T) {
	// A model whose top-level keys are reordered must fail check 1: the harness
	// compares Dump bytes in key order, not a deep-equal.
	entry, fake := plantReadingEntry(t)
	reordered := obj("diagnostics", []any{"spacing"}, "title", "Café", "sungAt", mustNum("3"))
	fake.inputParsed = reordered
	err := findCheck(t, ReadingChecks(entry, fake), "synthetic/1").Run()
	if err == nil {
		t.Error("check 1 should fail when the model's keys are reordered")
	}
}

// --- planted merge mismatch (forward) -------------------------------------

type forwardFake struct {
	noImpl
	files map[string][]byte
}

// forwardFake drives only the forward (/1) check: Merge is a no-op and
// MergeOutputs returns the planted file map, so /1 compares those bytes to the
// entry's stored files. The /2–/perm checks are built but not run by these
// tests (findCheck selects "merge/synthetic/1").
func (f forwardFake) Merge(_, _, _ []byte, _ bool) (cifra.Outcome, error) {
	return cifra.Outcome{}, nil
}
func (f forwardFake) MergeOutputs(_ cifra.Outcome, _ bool) (map[string][]byte, error) {
	return f.files, nil
}

func plantMergeEntry(t *testing.T, stored map[string][]byte) MergeEntry {
	t.Helper()
	dir := t.TempDir()
	write(t, dir, "base.cifra.md", []byte("# A\n\nx\n"))
	write(t, dir, "ours.cifra.md", []byte("# A\n\nx y\n"))
	write(t, dir, "theirs.cifra.md", []byte("# A\n\nx z\n"))
	for name, data := range stored {
		write(t, dir, name, data)
	}
	return MergeEntry{Name: "synthetic", Dir: dir}
}

func TestPlantedMergeForward(t *testing.T) {
	result := []byte("# A\n\nx y z\n")

	t.Run("matching passes", func(t *testing.T) {
		entry := plantMergeEntry(t, map[string][]byte{"result.cifra.md": result})
		fake := forwardFake{files: map[string][]byte{"result.cifra.md": result}}
		if err := findCheck(t, MergeChecks(entry, fake), "merge/synthetic/1").Run(); err != nil {
			t.Errorf("forward check should pass: %v", err)
		}
	})

	t.Run("wrong byte fails", func(t *testing.T) {
		entry := plantMergeEntry(t, map[string][]byte{"result.cifra.md": result})
		fake := forwardFake{files: map[string][]byte{"result.cifra.md": append(append([]byte(nil), result...), '!')}}
		if err := findCheck(t, MergeChecks(entry, fake), "merge/synthetic/1").Run(); err == nil {
			t.Error("forward check should fail when a produced file differs by a byte")
		}
	})

	t.Run("produced file the entry lacks fails", func(t *testing.T) {
		entry := plantMergeEntry(t, map[string][]byte{"result.cifra.md": result})
		fake := forwardFake{files: map[string][]byte{"conflicts.json": []byte("{}\n")}}
		if err := findCheck(t, MergeChecks(entry, fake), "merge/synthetic/1").Run(); err == nil {
			t.Error("forward check should fail when the merge produces a file the entry does not have")
		}
	})

	t.Run("stored output the merge did not produce fails", func(t *testing.T) {
		entry := plantMergeEntry(t, map[string][]byte{
			"result.cifra.md": result,
			"marked.cifra.md": []byte("<<<<<<< ours\n"),
		})
		fake := forwardFake{files: map[string][]byte{"result.cifra.md": result}}
		if err := findCheck(t, MergeChecks(entry, fake), "merge/synthetic/1").Run(); err == nil {
			t.Error("forward check should fail when the entry stores an output the merge did not produce")
		}
	})
}

// --- ledger guard ---------------------------------------------------------

func TestStaleLedgerIds(t *testing.T) {
	checkIDs := map[string]bool{"01-minimal-chart/1": true, "merge/01-different-sections/1": true}
	stale := StaleLedgerIds([]string{"01-minimal-chart/1", "gone/9"}, checkIDs)
	if !equalStrings(stale, []string{"gone/9"}) {
		t.Errorf("stale = %v, want [gone/9]", stale)
	}
	if clean := StaleLedgerIds([]string{"01-minimal-chart/1"}, checkIDs); len(clean) != 0 {
		t.Errorf("a clean ledger should have no stale ids, got %v", clean)
	}
}

// --- Dump pins json.dumps against real corpus bytes -----------------------

func TestDumpMatchesCorpusJSON(t *testing.T) {
	// The harness's Dump must reproduce the corpus's json.dumps serialisation
	// byte for byte (two-space indent, key order, non-ASCII raw, final newline),
	// which is what checks 1 and 3 compare models against.
	corpusDir := CorpusDir()
	for _, rel := range []string{
		"01-minimal-chart/input.parsed.json",
		"35-setlist-minimal/input.parsed.json",
		"merge/26-marked-ours/conflicts.json",
	} {
		data, err := os.ReadFile(filepath.Join(corpusDir, rel))
		if err != nil {
			t.Fatal(err)
		}
		model, err := cifra.DecodeModel(data)
		if err != nil {
			t.Fatalf("%s: %v", rel, err)
		}
		if got := Dump(model); string(got) != string(data) {
			t.Errorf("%s: Dump does not reproduce the stored JSON (%d vs %d bytes)", rel, len(got), len(data))
		}
	}
}

// --- small helpers --------------------------------------------------------

func mustNum(s string) any {
	m, err := cifra.DecodeModel([]byte(`{"n":` + s + `}`))
	if err != nil {
		panic(err)
	}
	v, _ := m.Get("n")
	return v
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func contains(s []string, v string) bool {
	for _, x := range s {
		if x == v {
			return true
		}
	}
	return false
}

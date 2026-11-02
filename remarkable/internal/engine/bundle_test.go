package engine

// integration — the built device bundle in goja (reader.engine;
// docs/remarkable-reader.md §9 "the built bundle loaded in goja"). It reads
// app/dist/device and the fixtures app/dist-test/device/*.default-shapes.json,
// which `npm run build` in app/ writes; each fixture holds the Worker's fill
// for its book and the same bundle's answers under Node, the oracle goja must
// match (§4 "no port"). A missing build fails rather than skips: the gate
// always builds the app first.

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"testing"
)

const (
	appDir     = "../../../app"
	bundleDir  = appDir + "/dist/device"
	fixtureDir = appDir + "/dist-test/device"
)

type fixture struct {
	Book     string          `json:"book"`
	Salt     string          `json:"salt"`
	Entry    json.RawMessage `json:"entry"`
	Songs    []string        `json:"songs"`
	Table    json.RawMessage `json:"table"`
	Setlist  string          `json:"setlist"`
	Expected struct {
		Load    json.RawMessage              `json:"load"`
		Sheets  map[string][]json.RawMessage `json:"sheets"`
		Held    Held                         `json:"held"`
		Setlist json.RawMessage              `json:"setlist"`
	} `json:"expected"`
}

func readFixture(t *testing.T, name string) fixture {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(fixtureDir, name))
	if err != nil {
		t.Fatalf("%v — run npm run build in app/", err)
	}
	var f fixture
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return f
}

func (f fixture) text(t *testing.T, song string) string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(appDir, f.Book, song))
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

func openBuilt(t *testing.T) *Engine {
	t.Helper()
	if _, err := os.Stat(filepath.Join(bundleDir, ManifestFile)); err != nil {
		t.Fatalf("%v — run npm run build in app/", err)
	}
	e, err := Open(bundleDir)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { e.Close() })
	return e
}

// sameJSON compares two JSON texts as values.
func sameJSON(t *testing.T, got, want []byte) bool {
	t.Helper()
	var g, w any
	if err := json.Unmarshal(got, &g); err != nil {
		t.Fatalf("got: %v", err)
	}
	if err := json.Unmarshal(want, &w); err != nil {
		t.Fatalf("want: %v", err)
	}
	return reflect.DeepEqual(g, w)
}

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// TestBuiltBundleOpens pins that the built bundle opens: its manifest speaks
// host API 1 under the fixture's salt, and estante.salt agrees (Open checks
// it).
func TestBuiltBundleOpens(t *testing.T) {
	f := readFixture(t, "example-book.default-shapes.json")
	e := openBuilt(t)
	m := e.Manifest()
	if m.HostAPI != 1 {
		t.Errorf("manifest hostApi %d, want 1", m.HostAPI)
	}
	if m.Salt != f.Salt {
		t.Errorf("manifest salt %q, fixture's %q", m.Salt, f.Salt)
	}
	if m.Bundle.Path == "" || len(m.Bundle.SHA256) != 64 {
		t.Errorf("manifest bundle %+v", m.Bundle)
	}
}

// twelveKeys reads every song of a fixture book at all twelve keys in goja
// and holds each answer to the Node oracle's: the note's "no misses at all
// twelve keys" and §4.1, and §4's "no port".
func twelveKeys(t *testing.T, name string) {
	f := readFixture(t, name)
	e := openBuilt(t)
	ctx := context.Background()
	loaded, err := e.Load(ctx, f.Entry, f.Table)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if !sameJSON(t, mustJSON(t, loaded), f.Expected.Load) {
		t.Errorf("Load %s, Node %s", mustJSON(t, loaded), f.Expected.Load)
	}
	var table struct {
		Shapes map[string]json.RawMessage `json:"shapes"`
	}
	if err := json.Unmarshal(f.Table, &table); err != nil {
		t.Fatal(err)
	}
	if loaded.Held != len(table.Shapes) || loaded.Held == 0 {
		t.Errorf("Load held %d, table holds %d", loaded.Held, len(table.Shapes))
	}

	for i, song := range f.Songs {
		text := f.text(t, song)
		expected := f.Expected.Sheets[song]
		if len(expected) != 12 {
			t.Fatalf("song %d: the oracle holds %d keys", i, len(expected))
		}
		for k := range 12 {
			t.Run("song"+strconv.Itoa(i)+"/offset"+strconv.Itoa(k), func(t *testing.T) {
				got, err := e.Sheet(ctx, text, k, SheetOptions{})
				if err != nil {
					t.Fatalf("Sheet: %v", err)
				}
				if got.Offset != k {
					t.Errorf("offset %d", got.Offset)
				}
				for _, s := range got.Shapes {
					if s.Pending {
						t.Errorf("shape %q pending", s.Key)
					}
				}
				if raw := mustJSON(t, got); !sameJSON(t, raw, expected[k]) {
					t.Errorf("goja and Node read differently:\n goja %s\n node %s", raw, expected[k])
				}
			})
		}
	}

	misses, err := e.Misses(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(misses) != 0 {
		t.Errorf("%d misses, want none", len(misses))
	}
	held, err := e.Held(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if held != f.Expected.Held {
		t.Errorf("Held %+v, Node %+v", held, f.Expected.Held)
	}
}

func TestExampleBookTwelveKeys(t *testing.T) { twelveKeys(t, "example-book.default-shapes.json") }

func TestChorosTwelveKeys(t *testing.T) { twelveKeys(t, "choros.default-shapes.json") }

// TestEveryHostCall pins "every host call answered" and — since the engine
// adds no globals — "nothing missing from the polyfills".
func TestEveryHostCall(t *testing.T) {
	f := readFixture(t, "example-book.default-shapes.json")
	e := openBuilt(t)
	ctx := context.Background()
	if _, err := e.Load(ctx, f.Entry, f.Table); err != nil {
		t.Fatalf("Load: %v", err)
	}

	// Workflow 12 §The key: a song written in C asked for in D reads at +2.
	const inC = "# Test in C\n- key: C\n\n```\nC | F | G | C\n```\n"
	got, err := e.Sheet(ctx, inC, 0, SheetOptions{TargetKey: "D"})
	if err != nil {
		t.Fatalf("Sheet: %v", err)
	}
	if got.Offset != 2 || got.KeyNote != nil || got.Key.Named == nil || *got.Key.Named != "D" {
		t.Errorf("target key D: offset %d, keyNote %v, named %v", got.Offset, got.KeyNote, got.Key.Named)
	}

	set, err := e.Setlist(ctx, f.text(t, f.Setlist), f.Setlist, f.Songs)
	if err != nil {
		t.Fatalf("Setlist: %v", err)
	}
	if len(set.Items) == 0 || !sameJSON(t, mustJSON(t, set), f.Expected.Setlist) {
		t.Errorf("Setlist %s, Node %s", mustJSON(t, set), f.Expected.Setlist)
	}

	if m, err := e.Misses(ctx); err != nil || len(m) != 0 {
		t.Errorf("Misses %v, %v", m, err)
	}
	if h, err := e.Held(ctx); err != nil || h.Songs != 1 {
		t.Errorf("Held %+v, %v", h, err)
	}

	// With no table every default is pending, and each chord is queued once.
	if _, err := e.Load(ctx, f.Entry, nil); err != nil {
		t.Fatalf("Load without a table: %v", err)
	}
	pending := map[string]bool{}
	for _, song := range f.Songs {
		sheet, err := e.Sheet(ctx, f.text(t, song), 2, SheetOptions{})
		if err != nil {
			t.Fatalf("Sheet: %v", err)
		}
		for _, s := range sheet.Shapes {
			if s.Source == "default" {
				t.Errorf("shape %q resolved with no table", s.Key)
			}
			if s.Pending {
				pending[s.Symbol] = true
			}
		}
	}
	if len(pending) == 0 {
		t.Fatal("nothing pending with no table")
	}
	misses, err := e.Misses(ctx)
	if err != nil {
		t.Fatal(err)
	}
	chords := map[string]bool{}
	symbols := map[string]bool{}
	for _, m := range misses {
		if chords[m.Chord] {
			t.Errorf("chord %q queued twice", m.Chord)
		}
		chords[m.Chord] = true
		symbols[m.Symbol] = true
	}
	if !reflect.DeepEqual(symbols, pending) {
		t.Errorf("queued %v, pending %v", symbols, pending)
	}
	if h, err := e.Held(ctx); err != nil || h.Misses != len(misses) || h.Rebuilt != 0 {
		t.Errorf("Held %+v, %v, with %d misses", h, err, len(misses))
	}

	// A text that is not UTF-8 is unreadable (cifra.md §1.3 step 1).
	if _, err := e.Sheet(ctx, "\xff\xfe# Test\n", 0, SheetOptions{}); !errors.Is(err, ErrUnreadable) {
		t.Errorf("unreadable text: %v, want ErrUnreadable", err)
	}
}

func diagrams(s Sheet) map[string]string {
	out := map[string]string{}
	for _, sh := range s.Shapes {
		out[sh.Key] = string(sh.Diagram)
	}
	return out
}

func defaultSymbols(s Sheet) map[string]bool {
	out := map[string]bool{}
	for _, sh := range s.Shapes {
		if sh.Source == "default" {
			out[sh.Symbol] = true
		}
	}
	return out
}

// TestMemoReturnsSameRebuiltShape pins the note's "the memo returns the same
// rebuilt shape" through the real bundle (§4 "In memory, never re-derived"):
// a second read at a key rebuilds nothing, and only a real change of
// instrument or table — not a same-table Load — clears the memo.
func TestMemoReturnsSameRebuiltShape(t *testing.T) {
	choros := readFixture(t, "choros.default-shapes.json")
	example := readFixture(t, "example-book.default-shapes.json")
	e := openBuilt(t)
	ctx := context.Background()
	if _, err := e.Load(ctx, choros.Entry, choros.Table); err != nil {
		t.Fatal(err)
	}
	text := choros.text(t, choros.Songs[0])

	first, err := e.Sheet(ctx, text, 5, SheetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	after5, err := e.Held(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if after5.Rebuilt == 0 || after5.Songs != 1 {
		t.Fatalf("after one read: %+v", after5)
	}

	again, err := e.Sheet(ctx, text, 5, SheetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(diagrams(again), diagrams(first)) {
		t.Error("the second read's diagram models differ from the first's")
	}
	if h, _ := e.Held(ctx); h != after5 {
		t.Errorf("second read at the same key: %+v, want %+v", h, after5)
	}

	at6, err := e.Sheet(ctx, text, 6, SheetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	seen := defaultSymbols(first)
	fresh := 0
	for s := range defaultSymbols(at6) {
		if !seen[s] {
			fresh++
		}
	}
	after6, _ := e.Held(ctx)
	if grew := after6.Rebuilt - after5.Rebuilt; grew < 0 || grew > fresh {
		t.Errorf("offset 6 rebuilt %d, at most %d chords are new to it", grew, fresh)
	}
	if after6.Songs != 1 {
		t.Errorf("songs %d after reading one song", after6.Songs)
	}

	if _, err := e.Load(ctx, choros.Entry, choros.Table); err != nil {
		t.Fatal(err)
	}
	if h, _ := e.Held(ctx); h != after6 {
		t.Errorf("a same-table Load changed the session: %+v, want %+v", h, after6)
	}

	if _, err := e.Load(ctx, example.Entry, example.Table); err != nil {
		t.Fatal(err)
	}
	if h, _ := e.Held(ctx); h != (Held{}) {
		t.Errorf("a different table kept the session: %+v", h)
	}
}

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

// TestExampleBookKeyChoices pins the key grid's names in the built bundle
// (reader.song_screen; design §6 105 key.choices): every example-book song
// read at each of the twelve offsets carries twelve choices, one for each
// offset −5…+6, each named, and the same at every offset.
func TestExampleBookKeyChoices(t *testing.T) {
	f := readFixture(t, "example-book.default-shapes.json")
	e := openBuilt(t)
	ctx := context.Background()
	if _, err := e.Load(ctx, f.Entry, f.Table); err != nil {
		t.Fatalf("Load: %v", err)
	}
	for i, song := range f.Songs {
		text := f.text(t, song)
		var first []KeyChoice
		for k := range 12 {
			got, err := e.Sheet(ctx, text, k, SheetOptions{})
			if err != nil {
				t.Fatalf("song %d offset %d: %v", i, k, err)
			}
			c := got.Key.Choices
			if len(c) != 12 {
				t.Fatalf("song %d offset %d: %d choices, want 12", i, k, len(c))
			}
			seen := map[int]bool{}
			for _, ch := range c {
				if ch.Offset < -5 || ch.Offset > 6 || seen[ch.Offset] || ch.Name == "" {
					t.Errorf("song %d offset %d: choice %+v", i, k, ch)
				}
				seen[ch.Offset] = true
			}
			if first == nil {
				first = c
			} else if !reflect.DeepEqual(c, first) {
				t.Errorf("song %d: choices at offset %d differ from offset 0", i, k)
			}
		}
	}
}

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

// TestSheetCarriesFretsAndTuning pins what reader.backend_views needs of a
// sheet (design §4 host API, §6 105): every resolved shape of the example
// book carries its frets, the sheet names the tuning of the Load it was read
// on, and a saved transposition is named as Key.Saved by the rule of Named.
func TestSheetCarriesFretsAndTuning(t *testing.T) {
	f := readFixture(t, "example-book.default-shapes.json")
	e := openBuilt(t)
	ctx := context.Background()
	loaded, err := e.Load(ctx, f.Entry, f.Table)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if loaded.TuningID == "" {
		t.Fatal("Load named no tuning")
	}
	for i, song := range f.Songs {
		text := f.text(t, song)
		for _, k := range []int{0, 5} {
			got, err := e.Sheet(ctx, text, k, SheetOptions{})
			if err != nil {
				t.Fatalf("song %d at %d: %v", i, k, err)
			}
			if got.TuningID != loaded.TuningID {
				t.Errorf("song %d at %d: tuning %q, Load's %q", i, k, got.TuningID, loaded.TuningID)
			}
			if len(got.Shapes) == 0 {
				t.Errorf("song %d at %d: no shapes", i, k)
			}
			for _, s := range got.Shapes {
				if !s.Pending && s.Frets == "" {
					t.Errorf("song %d at %d: shape %q has no frets", i, k, s.Key)
				}
			}
			if got.Key.Saved != nil {
				t.Errorf("song %d at %d: saved %q with no saved offset", i, k, *got.Key.Saved)
			}
		}
		three := 3
		saved, err := e.Sheet(ctx, text, 0, SheetOptions{SavedOffset: &three})
		if err != nil {
			t.Fatal(err)
		}
		at3, err := e.Sheet(ctx, text, 3, SheetOptions{})
		if err != nil {
			t.Fatal(err)
		}
		if at3.Key.Named == nil || saved.Key.Saved == nil || *saved.Key.Saved != *at3.Key.Named {
			t.Errorf("song %d: saved %v, named at 3 %v", i, saved.Key.Saved, at3.Key.Named)
		}
	}
}

// TestSetlistRows pins the setlist screen's rows (design §4 host API, §6
// 106): a link to a song the book lacks is listed in Rows, in its place,
// marked Missing, while Items and Missing are as before.
func TestSetlistRows(t *testing.T) {
	f := readFixture(t, "example-book.default-shapes.json")
	e := openBuilt(t)
	ctx := context.Background()
	present := []string{}
	for _, s := range f.Songs {
		if s != "the-ferry-line.cifra.md" {
			present = append(present, s)
		}
	}
	set, err := e.Setlist(ctx, f.text(t, f.Setlist), f.Setlist, present)
	if err != nil {
		t.Fatalf("Setlist: %v", err)
	}
	if set.Missing != 1 || len(set.Items) != 2 {
		t.Errorf("items %d, missing %d; want 2 and 1", len(set.Items), set.Missing)
	}
	if len(set.Rows) != 3 {
		t.Fatalf("%d rows, want 3", len(set.Rows))
	}
	for i, r := range set.Rows {
		if r.At != i || r.Path == nil {
			t.Errorf("row %d: %+v", i, r)
			continue
		}
		want := *r.Path == "the-ferry-line.cifra.md"
		if r.Missing != want {
			t.Errorf("row %d (%s): missing %v, want %v", i, *r.Path, r.Missing, want)
		}
	}
	if set.Rows[2].Key == nil || *set.Rows[2].Key != "A" {
		t.Errorf("row 2 key %v, want A", set.Rows[2].Key)
	}
}

// tableWithout is a fixture's §4.6 table with one chord's entry removed.
func tableWithout(t *testing.T, raw json.RawMessage, chord string) json.RawMessage {
	t.Helper()
	var table map[string]json.RawMessage
	if err := json.Unmarshal(raw, &table); err != nil {
		t.Fatal(err)
	}
	var shapes map[string]json.RawMessage
	if err := json.Unmarshal(table["shapes"], &shapes); err != nil {
		t.Fatal(err)
	}
	if _, ok := shapes[chord]; !ok {
		t.Fatalf("the table holds no %q", chord)
	}
	delete(shapes, chord)
	table["shapes"] = mustJSON(t, shapes)
	return mustJSON(t, table)
}

// TestFillQueuedMissOnce pins §4.1's background search through the real
// bundle (reader.missed_shapes): a chord the table lacks reads pending and is
// queued; Fill searches it and keeps the answer in the session, so the next
// Sheet draws the shape the full table gives, and a second Fill searches
// nothing.
func TestFillQueuedMissOnce(t *testing.T) {
	f := readFixture(t, "example-book.default-shapes.json")
	e := openBuilt(t)
	ctx := context.Background()
	const song = "walking-to-the-market.cifra.md"
	text := f.text(t, song)

	// The full table's sheet, and the chord key of one default in it.
	if _, err := e.Load(ctx, f.Entry, f.Table); err != nil {
		t.Fatal(err)
	}
	full, err := e.Sheet(ctx, text, 2, SheetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.Load(ctx, f.Entry, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := e.Sheet(ctx, text, 2, SheetOptions{}); err != nil {
		t.Fatal(err)
	}
	all, err := e.Misses(ctx)
	if err != nil || len(all) == 0 {
		t.Fatalf("Misses with no table: %v, %v", all, err)
	}
	missing := all[0]

	if _, err := e.Load(ctx, f.Entry, tableWithout(t, f.Table, missing.Chord)); err != nil {
		t.Fatal(err)
	}
	before, err := e.Sheet(ctx, text, 2, SheetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	var pending []string
	for _, s := range before.Shapes {
		if s.Pending {
			pending = append(pending, s.Symbol)
		}
	}
	if !reflect.DeepEqual(pending, []string{missing.Symbol}) {
		t.Fatalf("pending %v, want [%s]", pending, missing.Symbol)
	}
	if m, err := e.Misses(ctx); err != nil || len(m) != 1 || m[0] != missing {
		t.Fatalf("Misses %+v, %v, want [%+v]", m, err, missing)
	}

	got, err := e.Fill(ctx, missing.Chord)
	if err != nil {
		t.Fatalf("Fill: %v", err)
	}
	if got != (Filled{Chord: missing.Chord, Searched: true, Found: true}) {
		t.Errorf("Fill %+v, want searched and found", got)
	}
	if h, err := e.Held(ctx); err != nil || h.Misses != 0 {
		t.Errorf("Held %+v, %v, want no misses", h, err)
	}
	after, err := e.Sheet(ctx, text, 2, SheetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !sameJSON(t, mustJSON(t, after.Shapes), mustJSON(t, full.Shapes)) {
		t.Errorf("shapes after the fill %s, full table's %s", mustJSON(t, after.Shapes), mustJSON(t, full.Shapes))
	}

	again, err := e.Fill(ctx, missing.Chord)
	if err != nil || again != (Filled{Chord: missing.Chord}) {
		t.Errorf("second Fill %+v, %v, want not searched", again, err)
	}
}

// TestChosenUnbuildableUnvoiced pins reader.bundle_chosen_unbuildable_pending
// (docs/remarkable-reader.md §4.1 "A chord the song voices is never a miss";
// cifra.md §7.6): choro-long's voicing block chooses `Gm6: 3x2333`, which no
// hand can make, so the built bundle reads Gm6 as unvoiced from the first read
// — not a shape, not a pending place, not a queued miss.
func TestChosenUnbuildableUnvoiced(t *testing.T) {
	choros := readFixture(t, "choros.default-shapes.json")
	raw, err := os.ReadFile("../../qml/tests/fixtures/songs/choro-long.cifra.md")
	if err != nil {
		t.Fatal(err)
	}
	e := openBuilt(t)
	ctx := context.Background()
	if _, err := e.Load(ctx, choros.Entry, choros.Table); err != nil {
		t.Fatal(err)
	}
	sheet, err := e.Sheet(ctx, string(raw), 0, SheetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	unvoiced := false
	for _, k := range sheet.Unvoiced {
		if k == "Gm6" {
			unvoiced = true
		}
	}
	if !unvoiced {
		t.Errorf("Gm6 not under unvoiced: %v", sheet.Unvoiced)
	}
	for _, s := range sheet.Shapes {
		if s.Key == "Gm6" || s.Symbol == "Gm6" {
			t.Errorf("Gm6 has a place in the strip: %+v", s)
		}
	}
	misses, err := e.Misses(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range misses {
		if m.Symbol == "Gm6" {
			t.Errorf("Gm6 queued as a miss: %+v", m)
		}
	}
}

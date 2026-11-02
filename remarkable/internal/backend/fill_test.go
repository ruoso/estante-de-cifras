package backend

// unit — the background search for missed shapes (reader.missed_shapes;
// docs/remarkable-reader.md §4.1, §6 108 shapes; workflow 19 rules 1 and 5):
// Serve over the real socket pair, the views fixture's store and book, and a
// built bundle of its own loaded with the example book's table less one chord,
// A — the chord Walking to the Market has first when read two semitones up.
// An engine wrapper counts the fills and, where a test needs it, holds the
// first one.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	gosync "sync"
	"testing"
	"time"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/protocol"
)

const missedSymbol = "A" // Walking to the Market's first default at +2

// missedChord is the table key of missedSymbol, asked of the bundle itself.
var missed struct {
	once  gosync.Once
	chord string
	table json.RawMessage
	entry json.RawMessage
	err   error
}

// missingEngine opens the built bundle, loaded with the example book's entry
// and its table less missedSymbol's entry, closed when the test ends.
func missingEngine(t *testing.T) *engine.Engine {
	t.Helper()
	builtEngine(t) // fails the test when the build is missing
	missed.once.Do(func() {
		raw, err := os.ReadFile(fixtureFile)
		if err != nil {
			missed.err = err
			return
		}
		var fx struct {
			Entry json.RawMessage `json:"entry"`
			Table struct {
				Fingerprint string                     `json:"fingerprint"`
				Shapes      map[string]json.RawMessage `json:"shapes"`
			} `json:"table"`
		}
		if missed.err = json.Unmarshal(raw, &fx); missed.err != nil {
			return
		}
		// The chord's key: what the bundle queues for it with no table.
		e, err := engine.Open(bundleDir)
		if err != nil {
			missed.err = err
			return
		}
		defer e.Close()
		ctx := context.Background()
		if _, missed.err = e.Load(ctx, fx.Entry, nil); missed.err != nil {
			return
		}
		if _, missed.err = e.Sheet(ctx, exampleTextRaw(walking), 2, engine.SheetOptions{}); missed.err != nil {
			return
		}
		ms, err := e.Misses(ctx)
		if err != nil {
			missed.err = err
			return
		}
		for _, m := range ms {
			if m.Symbol == missedSymbol {
				missed.chord = m.Chord
			}
		}
		if _, ok := fx.Table.Shapes[missed.chord]; missed.chord == "" || !ok {
			missed.err = errors.New("the example table holds no A")
			return
		}
		delete(fx.Table.Shapes, missed.chord)
		missed.table, missed.err = json.Marshal(fx.Table)
		missed.entry = fx.Entry
	})
	if missed.err != nil {
		t.Fatalf("%v — run npm run build in app/", missed.err)
	}
	e, err := engine.Open(bundleDir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { e.Close() })
	if _, err := e.Load(context.Background(), missed.entry, missed.table); err != nil {
		t.Fatal(err)
	}
	return e
}

func exampleTextRaw(name string) string {
	raw, err := os.ReadFile(filepath.Join(exampleBook, name))
	if err != nil {
		return ""
	}
	return string(raw)
}

// fillProbe wraps the engine: it counts fills, and can hold the first one.
type fillProbe struct {
	Engine
	mu       gosync.Mutex
	calls    int
	searched int
	sheets   int
	// hold, when set, is the first Fill instead of the engine's: it runs
	// once the first Fill is asked for, and answers for it.
	hold func(ctx context.Context) (engine.Filled, error)
	// asked is closed when the first Fill is asked for; returned receives
	// after each Fill returns.
	asked    chan struct{}
	returned chan struct{}
}

func newFillProbe(e Engine) *fillProbe {
	return &fillProbe{Engine: e, asked: make(chan struct{}), returned: make(chan struct{}, 16)}
}

func (p *fillProbe) Sheet(ctx context.Context, text string, offset int, opts engine.SheetOptions) (engine.Sheet, error) {
	p.mu.Lock()
	p.sheets++
	p.mu.Unlock()
	return p.Engine.Sheet(ctx, text, offset, opts)
}

func (p *fillProbe) Fill(ctx context.Context, chord string) (engine.Filled, error) {
	p.mu.Lock()
	p.calls++
	first := p.calls == 1
	p.mu.Unlock()
	var got engine.Filled
	var err error
	if first {
		close(p.asked)
	}
	if first && p.hold != nil {
		got, err = p.hold(ctx)
	} else {
		got, err = p.Engine.Fill(ctx, chord)
	}
	p.mu.Lock()
	if err == nil && got.Searched {
		p.searched++
	}
	p.mu.Unlock()
	p.returned <- struct{}{}
	return got, err
}

func (p *fillProbe) counts() (calls, searched, sheets int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.calls, p.searched, p.sheets
}

func waitFor(t *testing.T, ch <-chan struct{}, what string) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(10 * time.Second):
		t.Fatalf("timed out waiting for %s", what)
	}
}

// shapeOf is the sheet's shape for symbol.
func shapeOf(t *testing.T, shapes []protocol.SheetShape, symbol string) protocol.SheetShape {
	t.Helper()
	for _, sh := range shapes {
		if sh.Symbol == symbol {
			return sh
		}
	}
	t.Fatalf("no shape %q in %d shapes", symbol, len(shapes))
	return protocol.SheetShape{}
}

// TestMissSearchedOnceAndKept pins §4.1 end to end: a song opened with a chord
// the table lacks comes with its place empty, the chord is searched once in
// the background and sent as 108 (the shape the full table gives), and the
// same song opened again carries the shape and searches nothing.
func TestMissSearchedOnceAndKept(t *testing.T) {
	f := newViewsFixture(t)
	probe := newFillProbe(missingEngine(t))
	s := f.serve(t, probe)

	sheet := s.openSong(t, walking, map[string]any{"offset": 2})
	a := shapeOf(t, sheet.Shapes, missedSymbol)
	if !isNull(a.Model) || a.Frets != nil {
		t.Fatalf("A in the 105: model %s frets %v, want an empty place", a.Model, a.Frets)
	}

	var found protocol.Shapes
	s.expect(t, protocol.TypeShapes, &found)
	if found.BookID != testBook || found.Path != walking || found.Offset != sheet.Offset || found.TuningID != sheet.TuningID {
		t.Errorf("108 for %s %s %d %q, want the sheet's %s %s %d %q",
			found.BookID, found.Path, found.Offset, found.TuningID, testBook, walking, sheet.Offset, sheet.TuningID)
	}
	if len(found.Shapes) != len(sheet.Shapes) {
		t.Fatalf("108 carries %d shapes, the sheet %d", len(found.Shapes), len(sheet.Shapes))
	}
	got := shapeOf(t, found.Shapes, missedSymbol)
	full, err := builtEngine(t).Sheet(context.Background(), exampleText(t, walking), 2, engine.SheetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	var want engine.Shape
	for _, sh := range full.Shapes {
		if sh.Symbol == missedSymbol {
			want = sh
		}
	}
	if isNull(got.Model) || got.Frets == nil || *got.Frets != want.Frets || !jsonEqual(t, got.Model, want.Diagram) || got.Hidden {
		t.Errorf("A in the 108: frets %v model %s hidden %v, want the full table's %s %s",
			got.Frets, got.Model, got.Hidden, want.Frets, want.Diagram)
	}
	if _, searched, _ := probe.counts(); searched != 1 {
		t.Errorf("%d searches, want 1", searched)
	}

	again := s.openSong(t, walking, map[string]any{"offset": 2})
	if sh := shapeOf(t, again.Shapes, missedSymbol); isNull(sh.Model) || sh.Frets == nil || *sh.Frets != want.Frets {
		t.Errorf("A opened again: frets %v model %s, want the shape", sh.Frets, sh.Model)
	}
	s.peer.silent()
	if _, searched, _ := probe.counts(); searched != 1 {
		t.Errorf("%d searches after opening again, want 1", searched)
	}
}

func jsonEqual(t *testing.T, a, b []byte) bool {
	t.Helper()
	var x, y any
	if json.Unmarshal(a, &x) != nil || json.Unmarshal(b, &y) != nil {
		return false
	}
	ja, _ := json.Marshal(x)
	jb, _ := json.Marshal(y)
	return string(ja) == string(jb)
}

// TestFillYieldsToKey pins workflow 19 rule 1 over §4.1's lower lane: a key
// chosen while a search runs is answered with its 105 at once — the search
// yields (preempted, as the engine's lane preempts it) — and the chord is
// filled after it.
func TestFillYieldsToKey(t *testing.T) {
	f := newViewsFixture(t)
	probe := newFillProbe(missingEngine(t))
	// The first fill searches until a reading call preempts it.
	sheetsAtStart := make(chan int, 1)
	probe.hold = func(ctx context.Context) (engine.Filled, error) {
		_, _, before := probe.counts()
		sheetsAtStart <- before
		for {
			if _, _, n := probe.counts(); n > before {
				return engine.Filled{}, engine.ErrPreempted
			}
			select {
			case <-ctx.Done():
				return engine.Filled{}, ctx.Err()
			case <-time.After(5 * time.Millisecond):
			}
		}
	}
	s := f.serve(t, probe)

	s.openSong(t, walking, map[string]any{"offset": 2})
	waitFor(t, probe.asked, "the first fill")
	<-sheetsAtStart
	s.send(t, protocol.TypeKey, map[string]any{"offset": 2})
	keyed := s.sheet(t)
	if keyed.Offset != 2 || !isNull(shapeOf(t, keyed.Shapes, missedSymbol).Model) {
		t.Errorf("the key's 105: offset %d, A %s; want offset 2 with A still empty",
			keyed.Offset, shapeOf(t, keyed.Shapes, missedSymbol).Model)
	}
	var found protocol.Shapes
	s.expect(t, protocol.TypeShapes, &found)
	if isNull(shapeOf(t, found.Shapes, missedSymbol).Model) || found.Offset != 2 {
		t.Errorf("the 108 after the key: offset %d, A %s", found.Offset, shapeOf(t, found.Shapes, missedSymbol).Model)
	}
	if calls, searched, _ := probe.counts(); calls != 2 || searched != 1 {
		t.Errorf("%d fills, %d searched; want 2 (one preempted) and 1", calls, searched)
	}
}

// TestFoundAfterLeavingSendsNothing pins §6 108: a fill that ends after the
// song is left sends nothing; the next open carries the shape in its 105.
func TestFoundAfterLeavingSendsNothing(t *testing.T) {
	f := newViewsFixture(t)
	probe := newFillProbe(missingEngine(t))
	release := make(chan struct{})
	probe.hold = func(ctx context.Context) (engine.Filled, error) {
		select {
		case <-release:
		case <-ctx.Done():
			return engine.Filled{}, ctx.Err()
		}
		return probe.Engine.Fill(ctx, missed.chord)
	}
	s := f.serve(t, probe)

	s.openSong(t, walking, map[string]any{"offset": 2})
	waitFor(t, probe.asked, "the first fill")
	s.send(t, protocol.TypeOpen, map[string]any{"view": "book", "bookId": testBook})
	var book protocol.Book
	s.expect(t, protocol.TypeBook, &book)
	close(release)
	waitFor(t, probe.returned, "the fill to end")
	s.peer.silent()
	if _, searched, _ := probe.counts(); searched != 1 {
		t.Errorf("%d searches, want 1", searched)
	}
	sheet := s.openSong(t, walking, map[string]any{"offset": 2})
	if isNull(shapeOf(t, sheet.Shapes, missedSymbol).Model) {
		t.Error("A still empty in the next open's 105")
	}
}

// treeDigest is every file under root, by path, as its bytes' hash.
func treeDigest(t *testing.T, root string) map[string]string {
	t.Helper()
	out := map[string]string{}
	err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(root, p)
		if d.IsDir() {
			out[rel+"/"] = "dir"
			return nil
		}
		raw, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		sum := sha256.Sum256(raw)
		out[rel] = hex.EncodeToString(sum[:])
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// TestFillWritesNothing pins §4.1 "It never writes the home book" and the
// device's read-only rule (workflow 19): the store — its home clone and book
// clones included — is byte for byte the same after a fill, and no sync pass
// (which is what pushes) was asked for.
func TestFillWritesNothing(t *testing.T) {
	f := newViewsFixture(t)
	probe := newFillProbe(missingEngine(t))
	release := make(chan struct{})
	probe.hold = func(ctx context.Context) (engine.Filled, error) {
		select {
		case <-release:
		case <-ctx.Done():
			return engine.Filled{}, ctx.Err()
		}
		return probe.Engine.Fill(ctx, missed.chord)
	}
	s := f.serve(t, probe)

	s.openSong(t, walking, map[string]any{"offset": 2})
	waitFor(t, probe.asked, "the first fill")
	before := treeDigest(t, f.root)
	_, triggers := s.syncer.counts()
	close(release)
	var found protocol.Shapes
	s.expect(t, protocol.TypeShapes, &found)
	after := treeDigest(t, f.root)
	if len(before) != len(after) {
		t.Errorf("%d files before the fill, %d after", len(before), len(after))
	}
	for p, h := range before {
		if after[p] != h {
			t.Errorf("%s changed by the fill", p)
		}
	}
	if _, now := s.syncer.counts(); now != triggers {
		t.Errorf("the fill asked for %d sync passes, want none", now-triggers)
	}
}

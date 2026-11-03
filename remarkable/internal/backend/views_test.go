package backend

// unit — the views (reader.backend_views; docs/remarkable-reader.md §3.2, §6
// "What the backend answers"; workflow 19). Each test runs Serve over the real
// SOCK_SEQPACKET pair(t), with a real store in a temporary directory holding a
// book and a home book written here with go-git, the real sync snapshot over
// that store (sync.New(st, nil, …).Snapshot(), which reads disk only) handed
// out by the fake syncer, and the real engine: the built device bundle,
// loaded with the example book's entry and table. A missing build fails, and
// never skips ("run npm run build in app/"). The songs are app/example-book's,
// written for the project; with-a-gap.setlist.md is written for these tests.

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	gosync "sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/filemode"
	"github.com/go-git/go-git/v5/plumbing/object"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/protocol"
	"estantedecifras.app/remarkable/internal/store"
	"estantedecifras.app/remarkable/internal/sync"
)

const (
	appDir      = "../../../app"
	bundleDir   = appDir + "/dist/device"
	fixtureFile = appDir + "/dist-test/device/example-book.default-shapes.json"
	exampleBook = appDir + "/example-book"

	testBook    = "bk-test"
	noClone     = "bk-not-cloned"
	testLabel   = "Songs for the porch"
	testVersion = "0.9.0-test"

	walking  = "walking-to-the-market.cifra.md"
	ferry    = "the-ferry-line.cifra.md"
	morning  = "morning-on-the-porch.cifra.md"
	shortSet = "a-short-set.setlist.md"
	withGap  = "with-a-gap.setlist.md"
)

// withAGap links the three songs, one absent song (with a key and a note)
// and one unlinked item; written for these tests.
const withAGap = `# With a Gap

1. [Morning on the Porch](morning-on-the-porch.cifra.md)
2. [Lost Song](lost-song.cifra.md)
   - key: D
   - note: bring the capo
3. [The Ferry Line](the-ferry-line.cifra.md)
4. A tune still to be written
   - note: hum it for now
5. [Walking to the Market](walking-to-the-market.cifra.md)
`

// --- the engine: the built bundle, opened once ---

var built struct {
	once   gosync.Once
	e      *engine.Engine
	tuning string
	err    error
}

func builtEngine(t *testing.T) *engine.Engine {
	t.Helper()
	built.once.Do(func() {
		if _, err := os.Stat(filepath.Join(bundleDir, engine.ManifestFile)); err != nil {
			built.err = err
			return
		}
		raw, err := os.ReadFile(fixtureFile)
		if err != nil {
			built.err = err
			return
		}
		var fx struct {
			Entry json.RawMessage `json:"entry"`
			Table json.RawMessage `json:"table"`
		}
		if built.err = json.Unmarshal(raw, &fx); built.err != nil {
			return
		}
		if built.e, built.err = engine.Open(bundleDir); built.err != nil {
			return
		}
		l, err := built.e.Load(context.Background(), fx.Entry, fx.Table)
		built.err, built.tuning = err, l.TuningID
	})
	if built.err != nil {
		t.Fatalf("%v — run npm run build in app/", built.err)
	}
	return built.e
}

// --- the fixture book and home book, committed with go-git ---

func exampleText(t *testing.T, name string) string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(exampleBook, name))
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

// commit commits files as the whole tree of a new commit on refs/heads/main
// of the bare repository at dir (made when absent), and answers its hash.
func commit(t *testing.T, dir string, files map[string]string) string {
	t.Helper()
	repo, err := git.PlainOpen(dir)
	if err != nil {
		os.RemoveAll(dir) // the store makes home/ empty
		if repo, err = git.PlainInit(dir, true); err != nil {
			t.Fatal(err)
		}
		main := plumbing.ReferenceName("refs/heads/main")
		if err := repo.Storer.SetReference(plumbing.NewSymbolicReference(plumbing.HEAD, main)); err != nil {
			t.Fatal(err)
		}
	}
	put := func(o interface {
		Encode(plumbing.EncodedObject) error
	}) plumbing.Hash {
		obj := repo.Storer.NewEncodedObject()
		if err := o.Encode(obj); err != nil {
			t.Fatal(err)
		}
		h, err := repo.Storer.SetEncodedObject(obj)
		if err != nil {
			t.Fatal(err)
		}
		return h
	}
	names := make([]string, 0, len(files))
	for n := range files {
		names = append(names, n)
	}
	sort.Strings(names)
	tree := &object.Tree{}
	for _, n := range names {
		blob := repo.Storer.NewEncodedObject()
		blob.SetType(plumbing.BlobObject)
		w, _ := blob.Writer()
		w.Write([]byte(files[n]))
		w.Close()
		h, err := repo.Storer.SetEncodedObject(blob)
		if err != nil {
			t.Fatal(err)
		}
		tree.Entries = append(tree.Entries, object.TreeEntry{Name: n, Mode: filemode.Regular, Hash: h})
	}
	sig := object.Signature{Name: "Test", Email: "test@example.org", When: time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)}
	c := &object.Commit{Author: sig, Committer: sig, Message: "test\n", TreeHash: put(tree)}
	if ref, err := repo.Reference("refs/heads/main", true); err == nil {
		c.ParentHashes = []plumbing.Hash{ref.Hash()}
	}
	h := put(c)
	if err := repo.Storer.SetReference(plumbing.NewHashReference("refs/heads/main", h)); err != nil {
		t.Fatal(err)
	}
	return h.String()
}

func reg(v any) map[string]any { return map[string]any{"at": "2026-10-06T12:00:00.000Z", "value": v} }

// homeFiles is the home book: shelf.json with the test book (labelled) and a
// book with no clone, and songs.json with The Ferry Line at transposition 3
// and a variation for a tuning no fixture holds. Without the test book when
// shelved is false.
func homeFiles(t *testing.T, shelved bool) map[string]string {
	t.Helper()
	books := map[string]any{
		noClone: map[string]any{"link": reg("https://example.test/git/" + noClone), "position": reg(2)},
	}
	if shelved {
		books[testBook] = map[string]any{
			"link": reg("https://example.test/git/" + testBook), "position": reg(1), "label": reg(testLabel),
		}
	}
	songs := map[string]any{
		testBook + "/" + ferry: map[string]any{
			"transposition": reg(3),
			"variation":     map[string]any{"62 67 71 74": reg("Up the neck")},
		},
	}
	return map[string]string{"shelf.json": mustMarshal(t, map[string]any{"books": books}), "songs.json": mustMarshal(t, songs)}
}

func mustMarshal(t *testing.T, v any) string {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

// viewsFixture is a store at root with the book and the home book on disk.
type viewsFixture struct {
	root string
	st   *store.Store
	book map[string]string
}

func newViewsFixture(t *testing.T) *viewsFixture {
	t.Helper()
	root := t.TempDir()
	st, err := store.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	f := &viewsFixture{root: root, st: st, book: map[string]string{withGap: withAGap}}
	for _, n := range []string{walking, ferry, morning, shortSet} {
		f.book[n] = exampleText(t, n)
	}
	f.commitBook(t)
	commit(t, st.HomeDir(), homeFiles(t, true))
	// A paired reader: unpaired, every open is answered with the empty
	// shelf (reader.pairing Constraint 8).
	if err := st.SetSession(store.Session{Origin: "https://example.test", Token: "t"}); err != nil {
		t.Fatal(err)
	}
	return f
}

func (f *viewsFixture) commitBook(t *testing.T) {
	t.Helper()
	dir, err := f.st.BookDir(testBook)
	if err != nil {
		t.Fatal(err)
	}
	commit(t, dir, f.book)
}

// snapshot is the real snapshot of what the store holds now.
func (f *viewsFixture) snapshot() *sync.Snapshot {
	return sync.New(f.st, nil, sync.Options{}).Snapshot()
}

// reopen opens the store again on the same root (a restart).
func (f *viewsFixture) reopen(t *testing.T) {
	t.Helper()
	st, err := store.Open(f.root)
	if err != nil {
		t.Fatal(err)
	}
	f.st = st
}

// viewsServe is one Serve over the fixture.
type viewsServe struct {
	peer   *peer
	syncer *fakeSyncer
	relay  *Relay
	parses *atomic.Int64
	stop   func()
}

func (f *viewsFixture) serve(t *testing.T, eng Engine) *viewsServe {
	t.Helper()
	conn, p := pair(t)
	s := &viewsServe{peer: p, syncer: newFakeSyncer(), relay: NewRelay(), parses: &atomic.Int64{}}
	s.syncer.snap = f.snapshot()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	deps := Deps{
		Store: f.st, Syncer: s.syncer, Relay: s.relay, Engine: eng, Version: testVersion,
		onParse: func() { s.parses.Add(1) },
	}
	go func() { done <- Serve(ctx, conn, deps) }()
	s.stop = gosync.OnceFunc(func() {
		cancel()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Error("Serve did not return after its context ended")
		}
	})
	t.Cleanup(s.stop)
	select {
	case <-s.syncer.started:
	case <-time.After(5 * time.Second):
		t.Fatal("Serve did not start the syncer's Run")
	}
	return s
}

// send writes one message to the backend as JSON.
func (s *viewsServe) send(t *testing.T, typ int32, v any) {
	t.Helper()
	s.peer.send(typ, mustMarshal(t, v))
}

// expect reads one message, fails unless it is typ, and decodes it into v.
func (s *viewsServe) expect(t *testing.T, typ int32, v any) {
	t.Helper()
	f := s.peer.recv()
	if f.typ != typ {
		t.Fatalf("got message %d %.120s, want %d", f.typ, f.payload, typ)
	}
	if err := json.Unmarshal(f.payload, v); err != nil {
		t.Fatalf("message %d: %v", typ, err)
	}
}

func (s *viewsServe) openSong(t *testing.T, path string, extra map[string]any) protocol.Sheet {
	t.Helper()
	o := map[string]any{"view": "song", "bookId": testBook, "path": path}
	for k, v := range extra {
		o[k] = v
	}
	s.send(t, protocol.TypeOpen, o)
	var sheet protocol.Sheet
	s.expect(t, protocol.TypeSheet, &sheet)
	return sheet
}

func (s *viewsServe) sheet(t *testing.T) protocol.Sheet {
	t.Helper()
	var sheet protocol.Sheet
	s.expect(t, protocol.TypeSheet, &sheet)
	return sheet
}

// ahead reads one message and fails unless it is a 109 ahead (reader.play).
func (s *viewsServe) ahead(t *testing.T) protocol.Sheet {
	t.Helper()
	var sheet protocol.Sheet
	s.expect(t, protocol.TypeAhead, &sheet)
	return sheet
}

// played is the open of a song played from setlist at item at.
func played(setlist string, at int) map[string]any {
	return map[string]any{"play": map[string]any{"setlist": setlist, "at": at}}
}

func strp(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

// namedAt is the engine's own name for a song's key at offset — the oracle,
// so the test keeps no music rule either.
func namedAt(t *testing.T, text string, offset int) string {
	t.Helper()
	s, err := builtEngine(t).Sheet(context.Background(), text, offset, engine.SheetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	return strp(s.Key.Named)
}

// --- the tests ---

// TestOpenShelf pins design §6 103 and workflow 19 §The shelf: the book with
// its label and its counts; a shelf entry without a clone is not listed.
func TestOpenShelf(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	s.send(t, protocol.TypeOpen, map[string]any{"view": "shelf"})
	var shelf protocol.Shelf
	s.expect(t, protocol.TypeShelf, &shelf)
	want := []protocol.ShelfBook{{BookID: testBook, Title: testLabel, Songs: 3, Setlists: 2}}
	if len(shelf.Books) != 1 || shelf.Books[0] != want[0] {
		t.Errorf("shelf %+v, want %+v", shelf.Books, want)
	}
	s.peer.silent()
}

// TestOpenBook pins workflow 19 §A book and the web app's browse order: the
// setlists by path with their counts (song and unlinked items), then the
// songs by path with their titles and artists.
func TestOpenBook(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	s.send(t, protocol.TypeOpen, map[string]any{"view": "book", "bookId": testBook})
	var book protocol.Book
	s.expect(t, protocol.TypeBook, &book)
	if book.BookID != testBook || book.Title != testLabel {
		t.Errorf("book %q %q", book.BookID, book.Title)
	}
	wantSets := []protocol.BookSetlist{
		{Path: shortSet, Title: "A Short Set", Songs: 3},
		{Path: withGap, Title: "With a Gap", Songs: 5},
	}
	if mustMarshal(t, book.Setlists) != mustMarshal(t, wantSets) {
		t.Errorf("setlists %+v, want %+v", book.Setlists, wantSets)
	}
	wantSongs := []protocol.BookSong{
		{Path: morning, Title: "Morning on the Porch", Artist: ""},
		{Path: ferry, Title: "The Ferry Line", Artist: ""},
		{Path: walking, Title: "Walking to the Market", Artist: ""},
	}
	if mustMarshal(t, book.Songs) != mustMarshal(t, wantSongs) {
		t.Errorf("songs %+v, want %+v", book.Songs, wantSongs)
	}
}

// TestBookListingMemoised pins Decision 1: the listing is read once per
// (book, head) — a second opening at the same head parses nothing — and a new
// head is read again.
func TestBookListingMemoised(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	var book protocol.Book
	s.send(t, protocol.TypeOpen, map[string]any{"view": "book", "bookId": testBook})
	s.expect(t, protocol.TypeBook, &book)
	first := s.parses.Load()
	if first != 5 {
		t.Fatalf("%d files parsed, want the 5 songs and setlists", first)
	}
	s.send(t, protocol.TypeOpen, map[string]any{"view": "shelf"})
	s.expect(t, protocol.TypeShelf, &protocol.Shelf{})
	s.send(t, protocol.TypeOpen, map[string]any{"view": "book", "bookId": testBook})
	s.expect(t, protocol.TypeBook, &book)
	if n := s.parses.Load(); n != first {
		t.Errorf("a second opening at the same head parsed %d files", n-first)
	}

	f.book[walking] = strings.Replace(f.book[walking], "# Walking to the Market", "# Walking to the Market Again", 1)
	f.commitBook(t)
	s.syncer.setSnapshot(f.snapshot())
	s.send(t, protocol.TypeOpen, map[string]any{"view": "book", "bookId": testBook})
	s.expect(t, protocol.TypeBook, &book)
	if n := s.parses.Load(); n != 2*first {
		t.Errorf("a new head parsed %d files, want %d", n-first, first)
	}
	if book.Songs[2].Title != "Walking to the Market Again" {
		t.Errorf("new head's title %q", book.Songs[2].Title)
	}
}

// TestOpenSongAsWritten pins design §6 105 and workflow 19 §A song: the song
// at its written key, the engine's rows byte for byte, the tuning of the
// Load, every shape with its chord, frets and model, none hidden.
func TestOpenSongAsWritten(t *testing.T) {
	f := newViewsFixture(t)
	e := builtEngine(t)
	s := f.serve(t, e)
	got := s.openSong(t, walking, nil)
	if strp(got.Key.Written) != "G" || strp(got.Key.Named) != "G" || got.Key.Saved != nil || got.Offset != 0 {
		t.Errorf("key %s/%s/%s at %d, want G/G/<nil> at 0", strp(got.Key.Written), strp(got.Key.Named), strp(got.Key.Saved), got.Offset)
	}
	if got.Title != "Walking to the Market" || got.Artist != "" || got.BookID != testBook || got.Path != walking {
		t.Errorf("sheet %q %q %q %q", got.Title, got.Artist, got.BookID, got.Path)
	}
	want, err := e.Sheet(context.Background(), f.book[walking], 0, engine.SheetOptions{Preferences: f.snapshot().Preferences()})
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got.Rows, want.Rows) {
		t.Error("rows differ from the engine's")
	}
	if got.TuningID != built.tuning || got.TuningID == "" {
		t.Errorf("tuning %q, Load's %q", got.TuningID, built.tuning)
	}
	if len(got.Shapes) == 0 || len(got.Shapes) != len(want.Shapes) {
		t.Fatalf("%d shapes, engine's %d", len(got.Shapes), len(want.Shapes))
	}
	// The key grid's names are the engine's, carried through (reader.song_screen;
	// design §6 105 key.choices).
	if len(got.Key.Choices) != 12 || len(got.Key.Choices) != len(want.Key.Choices) {
		t.Errorf("%d key choices, engine's %d", len(got.Key.Choices), len(want.Key.Choices))
	}
	for i, c := range got.Key.Choices {
		if i < len(want.Key.Choices) && (c.Name != want.Key.Choices[i].Name || c.Offset != want.Key.Choices[i].Offset) {
			t.Errorf("key choice %d: %+v, engine's %+v", i, c, want.Key.Choices[i])
		}
	}
	for i, sh := range got.Shapes {
		if sh.Chord != want.Shapes[i].Key || sh.Frets == nil || *sh.Frets == "" ||
			len(sh.Model) == 0 || string(sh.Model) == "null" || sh.Hidden {
			t.Errorf("shape %d: %+v", i, sh)
		}
	}
}

// TestOpenSongAtSavedKey pins design §5.4 and workflow 19 *Your key*: a song
// with a saved transposition opens at it, and key.saved names it.
func TestOpenSongAtSavedKey(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	got := s.openSong(t, ferry, nil)
	want := namedAt(t, f.book[ferry], 3)
	if got.Offset != 3 || strp(got.Key.Saved) != want || strp(got.Key.Named) != want {
		t.Errorf("offset %d, saved %s, named %s; want 3 and %s", got.Offset, strp(got.Key.Saved), strp(got.Key.Named), want)
	}
	if want == namedAt(t, f.book[ferry], 0) {
		t.Fatal("the saved key names the key as written")
	}
}

// TestKeyKeptAcrossARestart pins design §5.4 and protocol Decision 4: a key
// chosen is kept in the store across a restart, and As written ({offset:null})
// reads at the saved transposition again.
func TestKeyKeptAcrossARestart(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	s.openSong(t, ferry, nil)
	s.send(t, protocol.TypeKey, map[string]any{"offset": 5})
	if got := s.sheet(t); got.Offset != 5 {
		t.Errorf("key 5 answered offset %d", got.Offset)
	}
	s.stop()

	f.reopen(t)
	s = f.serve(t, builtEngine(t))
	if got := s.openSong(t, ferry, nil); got.Offset != 5 {
		t.Errorf("after a restart, offset %d, want 5", got.Offset)
	}
	s.send(t, protocol.TypeKey, map[string]any{"offset": nil})
	if got := s.sheet(t); got.Offset != 3 {
		t.Errorf("As written answered offset %d, want the saved 3", got.Offset)
	}
	if _, ok := f.st.Key(testBook, ferry); ok {
		t.Error("As written kept a key")
	}
}

// TestOpenOffsetIsOneOff pins Constraint 2: an open's offset is for that
// answer only.
func TestOpenOffsetIsOneOff(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	if got := s.openSong(t, ferry, map[string]any{"offset": 7}); got.Offset != 7 {
		t.Errorf("open at 7 read at %d", got.Offset)
	}
	if got := s.openSong(t, ferry, nil); got.Offset != 3 {
		t.Errorf("a later open read at %d, want the saved 3", got.Offset)
	}
	if got := s.openSong(t, walking, map[string]any{"offset": 7}); got.Offset != 7 {
		t.Errorf("open at 7 read at %d", got.Offset)
	}
	if got := s.openSong(t, walking, nil); got.Offset != 0 {
		t.Errorf("a later open read at %d, want 0", got.Offset)
	}
	if _, ok := f.st.Key(testBook, walking); ok {
		t.Error("a one-off offset was kept")
	}
}

// TestHiddenVoicingMarkedInNextSheet pins workflow 19 L222–239 and store
// Decision 5: a voicing hidden is named by its tuning, chord and frets, is
// hidden in every song, shown again on showShape, and counted in Settings.
func TestHiddenVoicingMarkedInNextSheet(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))

	// A voicing two songs share: the same chord, the same frets.
	first := s.openSong(t, walking, nil)
	var other string
	var shared protocol.SheetShape
	for _, name := range []string{morning, ferry} {
		sheet := s.openSong(t, name, nil)
		for _, a := range first.Shapes {
			for _, b := range sheet.Shapes {
				if shared.Frets == nil && a.Frets != nil && b.Frets != nil && a.Chord == b.Chord && *a.Frets == *b.Frets {
					shared, other = a, name
				}
			}
		}
	}
	if shared.Frets == nil {
		t.Fatal("no voicing shared between the example songs")
	}
	s.openSong(t, walking, nil)

	v := protocol.HideShape{TuningID: first.TuningID, Chord: shared.Chord, Frets: *shared.Frets}
	s.send(t, protocol.TypeHideShape, v)
	got := s.sheet(t)
	for _, sh := range got.Shapes {
		want := sh.Chord == shared.Chord && sh.Frets != nil && *sh.Frets == *shared.Frets
		if sh.Hidden != want {
			t.Errorf("shape %s %s hidden %v, want %v", sh.Chord, strp(sh.Frets), sh.Hidden, want)
		}
	}

	again := s.openSong(t, other, nil)
	found := false
	for _, sh := range again.Shapes {
		if sh.Chord == shared.Chord && sh.Frets != nil && *sh.Frets == *shared.Frets {
			found = true
			if !sh.Hidden {
				t.Error("the voicing is not hidden in the other song")
			}
		} else if sh.Hidden {
			t.Errorf("shape %s hidden in the other song", sh.Chord)
		}
	}
	if !found {
		t.Fatal("the other song lost the shared voicing")
	}

	s.send(t, protocol.TypeShowShape, protocol.ShowShape(v))
	for _, sh := range s.sheet(t).Shapes {
		if sh.Hidden {
			t.Errorf("shape %s still hidden after showShape", sh.Chord)
		}
	}

	var settings protocol.Settings
	s.send(t, protocol.TypeOpen, map[string]any{"view": "settings"})
	s.expect(t, protocol.TypeSettings, &settings)
	s.send(t, protocol.TypeHideShape, v)
	s.expect(t, protocol.TypeSettings, &settings)
	if settings.HiddenShapes != 1 {
		t.Errorf("hideShape from settings: hiddenShapes %d, want 1", settings.HiddenShapes)
	}
	s.send(t, protocol.TypeShowAllShapes, map[string]any{})
	s.expect(t, protocol.TypeSettings, &settings)
	if settings.HiddenShapes != 0 {
		t.Errorf("showAllShapes: hiddenShapes %d, want 0", settings.HiddenShapes)
	}
}

// TestShapesShownAnswersState pins Decision 8: shapesShown is kept and
// answered with 101 state.
func TestShapesShownAnswersState(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	s.openSong(t, walking, nil)
	s.send(t, protocol.TypeShapesShown, map[string]any{"shown": false})
	got, _ := s.peer.state()
	if got.ShapesShown {
		t.Error("state says shapes shown")
	}
	if f.st.ShapesShown() {
		t.Error("the store says shapes shown")
	}
	s.peer.silent()
}

// TestOpenSetlistWithMissing pins workflow 19 §A setlist and protocol
// Decision 5: every item in order, the absent song and the unlinked item
// missing with their key and note as written; place is kept, answered with
// nothing, and carried as at on the next opening.
func TestOpenSetlistWithMissing(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	open := map[string]any{"view": "setlist", "bookId": testBook, "path": withGap}
	s.send(t, protocol.TypeOpen, open)
	var set protocol.Setlist
	s.expect(t, protocol.TypeSetlist, &set)
	d, capo, hum := "D", "bring the capo", "hum it for now"
	want := []protocol.SetlistItem{
		{Path: morning, Title: "Morning on the Porch"},
		{Path: "lost-song.cifra.md", Title: "Lost Song", Key: &d, Note: &capo, Missing: true},
		{Path: ferry, Title: "The Ferry Line"},
		{Path: "", Title: "A tune still to be written", Note: &hum, Missing: true},
		{Path: walking, Title: "Walking to the Market"},
	}
	if set.Title != "With a Gap" || set.At != nil || mustMarshal(t, set.Items) != mustMarshal(t, want) {
		t.Errorf("setlist %q at %v items %s,\n want %s", set.Title, set.At, mustMarshal(t, set.Items), mustMarshal(t, want))
	}
	if strings.Contains(string(mustMarshal(t, set)), `"offset"`) {
		t.Error("an item carries an offset")
	}

	s.send(t, protocol.TypePlace, protocol.Place{BookID: testBook, Setlist: withGap, At: 2})
	s.peer.silent()
	s.send(t, protocol.TypeOpen, open)
	s.expect(t, protocol.TypeSetlist, &set)
	if set.At == nil || *set.At != 2 {
		t.Errorf("reopened at %v, want 2", set.At)
	}
}

// TestPlaySheet pins workflow 19 L297–305 and workflow 12 §The key: a played
// song reads at the setlist's key, with its place, the count of playable
// items and the next one.
func TestPlaySheet(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	got := s.openSong(t, walking, map[string]any{"play": map[string]any{"setlist": shortSet, "at": 2}})
	if got.Offset != 2 || strp(got.Key.Named) != "A" {
		t.Errorf("played at %d in %s, want 2 in A", got.Offset, strp(got.Key.Named))
	}
	if got.Play == nil || *got.Play != (protocol.SheetPlay{Setlist: shortSet, At: 2, Of: 3}) {
		t.Errorf("play %+v, want a-short-set 2 of 3, no next", got.Play)
	}
	s.ahead(t) // the previous item, read ahead (reader.play)

	got = s.openSong(t, morning, map[string]any{"play": map[string]any{"setlist": shortSet, "at": 0}})
	s.ahead(t) // the next item
	if got.Play == nil || got.Play.At != 0 || got.Play.Of != 3 || got.Play.Next == nil {
		t.Fatalf("play %+v", got.Play)
	}
	if n := got.Play.Next; n.Title != "The Ferry Line" || n.Key != nil || n.Note != nil {
		t.Errorf("next %+v, want The Ferry Line with no key and no note", n)
	}
}

// TestPlayKeepsItsVersion pins workflow 19 L313–315: a setlist being played
// keeps the version it started with until Back.
func TestPlayKeepsItsVersion(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	play := func(at int) map[string]any {
		return map[string]any{"play": map[string]any{"setlist": shortSet, "at": at}}
	}
	s.openSong(t, morning, play(0))
	s.ahead(t) // reader.play: the next item, read ahead

	f.book[ferry] = strings.Replace(f.book[ferry], "# The Ferry Line", "# The Ferry Line, Revised", 1)
	f.commitBook(t)
	s.syncer.setSnapshot(f.snapshot())

	if got := s.openSong(t, ferry, play(1)); got.Title != "The Ferry Line" {
		t.Errorf("while playing, read %q, want the version Play started with", got.Title)
	}
	s.ahead(t)
	s.ahead(t)
	s.send(t, protocol.TypeOpen, map[string]any{"view": "setlist", "bookId": testBook, "path": shortSet})
	s.expect(t, protocol.TypeSetlist, &protocol.Setlist{})
	if got := s.openSong(t, ferry, play(1)); got.Title != "The Ferry Line, Revised" {
		t.Errorf("after Back, read %q, want the new version", got.Title)
	}
}

// TestSongFromAGoneBookUntilBack pins workflow 19 L316–317 and sync's Hold:
// a song open from a book gone stays readable until Back, the hold is
// released once on leaving, and the gone book then answers the shelf.
func TestSongFromAGoneBookUntilBack(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	s.openSong(t, walking, nil)

	commit(t, f.st.HomeDir(), homeFiles(t, false))
	s.syncer.setSnapshot(f.snapshot())
	if s.syncer.Snapshot().Book(testBook) != nil {
		t.Fatal("the new snapshot still has the book")
	}

	s.send(t, protocol.TypeKey, map[string]any{"offset": 1})
	if got := s.sheet(t); got.Offset != 1 || got.Path != walking {
		t.Errorf("key on the gone book's song: %s at %d", got.Path, got.Offset)
	}
	if got := s.openSong(t, ferry, nil); got.Path != ferry || got.Title != "The Ferry Line" {
		t.Errorf("another song of the gone book: %q", got.Title)
	}
	if h, r := s.syncer.held(testBook); h != 1 || r != 0 {
		t.Errorf("holds %d, releases %d while reading; want 1, 0", h, r)
	}

	s.send(t, protocol.TypeOpen, map[string]any{"view": "shelf"})
	var shelf protocol.Shelf
	s.expect(t, protocol.TypeShelf, &shelf)
	if len(shelf.Books) != 0 {
		t.Errorf("shelf %+v, want no book", shelf.Books)
	}
	if h, r := s.syncer.held(testBook); h != 1 || r != 1 {
		t.Errorf("holds %d, releases %d after Back; want 1, 1", h, r)
	}

	s.send(t, protocol.TypeOpen, map[string]any{"view": "song", "bookId": testBook, "path": walking})
	s.expect(t, protocol.TypeShelf, &shelf)
	if h, r := s.syncer.held(testBook); h != r {
		t.Errorf("holds %d, releases %d; want every hold released", h, r)
	}
}

// TestUnanswerableOpenFallsBack pins Constraints 7 and 8: the nearest view
// that can be answered — an absent song its book, an unknown book the shelf,
// and with no engine a song or a setlist its book, while shelf, book and
// settings still answer.
func TestUnanswerableOpenFallsBack(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	var book protocol.Book
	s.send(t, protocol.TypeOpen, map[string]any{"view": "song", "bookId": testBook, "path": "absent.cifra.md"})
	s.expect(t, protocol.TypeBook, &book)
	if book.BookID != testBook {
		t.Errorf("fell back to book %q", book.BookID)
	}
	s.send(t, protocol.TypeOpen, map[string]any{"view": "setlist", "bookId": testBook, "path": "absent.setlist.md"})
	s.expect(t, protocol.TypeBook, &book)
	s.send(t, protocol.TypeOpen, map[string]any{"view": "book", "bookId": "bk-unknown"})
	s.expect(t, protocol.TypeShelf, &protocol.Shelf{})
	s.send(t, protocol.TypeOpen, map[string]any{"view": "song", "bookId": "bk-unknown", "path": walking})
	s.expect(t, protocol.TypeShelf, &protocol.Shelf{})
	s.stop()

	s = f.serve(t, nil)
	s.send(t, protocol.TypeOpen, map[string]any{"view": "song", "bookId": testBook, "path": walking})
	s.expect(t, protocol.TypeBook, &book)
	s.send(t, protocol.TypeOpen, map[string]any{"view": "setlist", "bookId": testBook, "path": shortSet})
	s.expect(t, protocol.TypeBook, &book)
	if len(book.Songs) != 3 || len(book.Setlists) != 2 {
		t.Errorf("book with no engine: %d songs, %d setlists", len(book.Songs), len(book.Setlists))
	}
	var shelf protocol.Shelf
	s.send(t, protocol.TypeOpen, map[string]any{"view": "shelf"})
	s.expect(t, protocol.TypeShelf, &shelf)
	if len(shelf.Books) != 1 {
		t.Errorf("shelf with no engine: %+v", shelf.Books)
	}
	s.send(t, protocol.TypeOpen, map[string]any{"view": "book", "bookId": testBook})
	s.expect(t, protocol.TypeBook, &book)
	s.send(t, protocol.TypeOpen, map[string]any{"view": "settings"})
	s.expect(t, protocol.TypeSettings, &protocol.Settings{})
}

// TestOpenSettings pins workflow 19 L149–152: the account paired with, the
// reader's version and the hidden count.
func TestOpenSettings(t *testing.T) {
	f := newViewsFixture(t)
	must(t, f.st.SetSession(store.Session{Origin: "https://example.test", Token: "t", Account: "reader@example.org"}))
	must(t, f.st.Hide(store.Voicing{TuningID: "40 45 50 55 59 64", Chord: "C:", Frets: "x32010"}))
	s := f.serve(t, builtEngine(t))
	s.send(t, protocol.TypeOpen, map[string]any{"view": "settings"})
	var got protocol.Settings
	s.expect(t, protocol.TypeSettings, &got)
	want := protocol.Settings{Account: "reader@example.org", Version: testVersion, HiddenShapes: 1, ChordNames: "written", AccountChordNames: "written"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("settings %+v, want %+v", got, want)
	}
}

// TestNothingLogged pins Constraint 9 (design §10): the views log nothing —
// no title, no song text — whatever they answer.
func TestNothingLogged(t *testing.T) {
	var buf bytes.Buffer
	saved := log.Writer()
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(saved) })

	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	s.send(t, protocol.TypeOpen, map[string]any{"view": "shelf"})
	s.expect(t, protocol.TypeShelf, &protocol.Shelf{})
	s.send(t, protocol.TypeOpen, map[string]any{"view": "book", "bookId": testBook})
	s.expect(t, protocol.TypeBook, &protocol.Book{})
	s.openSong(t, walking, nil)
	s.send(t, protocol.TypeKey, map[string]any{"offset": 4})
	s.sheet(t)
	s.send(t, protocol.TypeOpen, map[string]any{"view": "setlist", "bookId": testBook, "path": withGap})
	s.expect(t, protocol.TypeSetlist, &protocol.Setlist{})
	s.openSong(t, ferry, map[string]any{"play": map[string]any{"setlist": shortSet, "at": 1}})
	// reader.play: the neighbours read ahead, then a place moving the open
	// song and reading its neighbours ahead, log nothing either.
	s.ahead(t)
	s.ahead(t)
	s.send(t, protocol.TypePlace, protocol.Place{BookID: testBook, Setlist: shortSet, At: 2})
	s.ahead(t)
	s.send(t, protocol.TypeOpen, map[string]any{"view": "song", "bookId": testBook, "path": "absent.cifra.md"})
	s.expect(t, protocol.TypeBook, &protocol.Book{})
	s.stop()

	if buf.Len() != 0 {
		t.Errorf("the views logged %d bytes", buf.Len())
	}
	for _, words := range []string{"Walking to the Market", "The Ferry Line", "With a Gap", "Lost Song", "A Short Set", shortSet} {
		if strings.Contains(buf.String(), words) {
			t.Errorf("the log names %q", words)
		}
	}
}

// --- reader.play ---

// TestPlaySendsNeighboursAhead pins workflow 19 §A setlist ("the songs on
// either side … are read ahead") and rule 9: a played open answers its 105,
// then the next playable item's sheet as 109, then the previous one's, each
// with play and at the setlist's key, exactly as an open of it would answer;
// at the first item only the next is sent, at the last only the previous.
func TestPlaySendsNeighboursAhead(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	got := s.openSong(t, ferry, played(shortSet, 1))
	if got.Path != ferry || got.Play == nil || got.Play.At != 1 {
		t.Fatalf("opened %s play %+v", got.Path, got.Play)
	}
	next, prev := s.ahead(t), s.ahead(t)
	if next.Path != walking || next.Play == nil || next.Play.At != 2 || next.Play.Of != 3 || next.Play.Next != nil {
		t.Errorf("next ahead %s play %+v, want walking at 2 of 3, no next", next.Path, next.Play)
	}
	// At the setlist's key: Walking to the Market is in G, the set says A.
	if next.Offset != 2 || strp(next.Key.Named) != "A" {
		t.Errorf("next ahead at %d in %s, want 2 in A", next.Offset, strp(next.Key.Named))
	}
	if prev.Path != morning || prev.Play == nil || prev.Play.At != 0 || prev.Play.Next == nil ||
		prev.Play.Next.Title != "The Ferry Line" {
		t.Errorf("previous ahead %s play %+v, want morning at 0, next The Ferry Line", prev.Path, prev.Play)
	}
	s.peer.silent()

	// Exactly what an open of the item answers (a 105's payload).
	if open := s.openSong(t, walking, played(shortSet, 2)); mustMarshal(t, open) != mustMarshal(t, next) {
		t.Errorf("109 for item 2 differs from its 105:\n 109 %s\n 105 %s", mustMarshal(t, next), mustMarshal(t, open))
	}
	// The last item: only the previous.
	if a := s.ahead(t); a.Path != ferry || a.Play == nil || a.Play.At != 1 {
		t.Errorf("at the last item, ahead %s play %+v, want the ferry at 1", a.Path, a.Play)
	}
	s.peer.silent()

	// The first item: only the next.
	s.openSong(t, morning, played(shortSet, 0))
	if a := s.ahead(t); a.Path != ferry || a.Play == nil || a.Play.At != 1 {
		t.Errorf("at the first item, ahead %s play %+v, want the ferry at 1", a.Path, a.Play)
	}
	s.peer.silent()

	// A song not played reads nothing ahead.
	s.openSong(t, ferry, nil)
	s.peer.silent()
}

// TestPlayAheadSkipsMissing pins cifra.md §10.8.2 and workflow 12: the
// neighbours read ahead are the nearest playable items — the absent song and
// the unlinked item are never read ahead.
func TestPlayAheadSkipsMissing(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	got := s.openSong(t, ferry, played(withGap, 2))
	if got.Play == nil || got.Play.At != 2 || got.Play.Of != 3 {
		t.Fatalf("play %+v, want with-a-gap 2 of 3", got.Play)
	}
	next, prev := s.ahead(t), s.ahead(t)
	if next.Path != walking || next.Play == nil || next.Play.At != 4 {
		t.Errorf("next ahead %s play %+v, want walking at 4", next.Path, next.Play)
	}
	if prev.Path != morning || prev.Play == nil || prev.Play.At != 0 {
		t.Errorf("previous ahead %s play %+v, want morning at 0", prev.Path, prev.Play)
	}
	s.peer.silent()
}

// TestPlaceMovesOpenSong pins design §6 11 place as amended (reader.play
// Decision 2): a place at another item of the setlist being played makes it
// the open song — a key then redraws that song — and sends its neighbours
// ahead; a place at the open item answers nothing; a place while not playing
// is only stored.
func TestPlaceMovesOpenSong(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	s.openSong(t, ferry, played(shortSet, 1))
	s.ahead(t)
	s.ahead(t)

	s.send(t, protocol.TypePlace, protocol.Place{BookID: testBook, Setlist: shortSet, At: 2})
	// Walking to the Market's neighbours: only the previous, the ferry.
	if a := s.ahead(t); a.Path != ferry || a.Play == nil || a.Play.At != 1 {
		t.Errorf("after the move, ahead %s play %+v, want the ferry at 1", a.Path, a.Play)
	}
	s.peer.silent()

	s.send(t, protocol.TypeKey, map[string]any{"offset": 4})
	got := s.sheet(t)
	if got.Path != walking || got.Offset != 4 || got.Play == nil || got.Play.At != 2 {
		t.Errorf("key after the move redrew %s at %d play %+v, want walking at 4, item 2", got.Path, got.Offset, got.Play)
	}
	s.peer.silent()

	// The open item: stored, nothing answered.
	s.send(t, protocol.TypePlace, protocol.Place{BookID: testBook, Setlist: shortSet, At: 2})
	s.peer.silent()

	// Not playing: only stored.
	s.openSong(t, morning, nil)
	s.send(t, protocol.TypePlace, protocol.Place{BookID: testBook, Setlist: shortSet, At: 0})
	s.peer.silent()
	s.send(t, protocol.TypeKey, map[string]any{"offset": 1})
	if got := s.sheet(t); got.Path != morning {
		t.Errorf("a place while not playing moved the open song to %s", got.Path)
	}
	var set protocol.Setlist
	s.send(t, protocol.TypeOpen, map[string]any{"view": "setlist", "bookId": testBook, "path": shortSet})
	s.expect(t, protocol.TypeSetlist, &set)
	if set.At == nil || *set.At != 0 {
		t.Errorf("place kept %v, want 0", set.At)
	}
}

// TestPlayAheadKeepsItsVersion pins workflow 19 §When something has changed:
// a sync between the start of Play and a place still reads the neighbours —
// and the song the place moves to — from the version Play started with.
func TestPlayAheadKeepsItsVersion(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, builtEngine(t))
	s.openSong(t, morning, played(shortSet, 0))
	s.ahead(t)

	f.book[ferry] = strings.Replace(f.book[ferry], "# The Ferry Line", "# The Ferry Line, Revised", 1)
	f.book[walking] = strings.Replace(f.book[walking], "# Walking to the Market", "# Walking to the Market, Revised", 1)
	f.commitBook(t)
	s.syncer.setSnapshot(f.snapshot())

	s.send(t, protocol.TypePlace, protocol.Place{BookID: testBook, Setlist: shortSet, At: 1})
	next, prev := s.ahead(t), s.ahead(t)
	if next.Title != "Walking to the Market" || prev.Title != "Morning on the Porch" {
		t.Errorf("while playing, read ahead %q and %q, want the version Play started with", next.Title, prev.Title)
	}
	s.send(t, protocol.TypeKey, map[string]any{"offset": 2})
	if got := s.sheet(t); got.Path != ferry || got.Title != "The Ferry Line" {
		t.Errorf("the moved song read %s %q, want the ferry as Play started with it", got.Path, got.Title)
	}
}

// --- choosing an instrument and a variation (workflow 19 §Settings, §A song) ---

// ownEngine is the built bundle opened afresh with the example book's
// instrument loaded: a test that loads another must not change the shared one.
func ownEngine(t *testing.T) *engine.Engine {
	t.Helper()
	builtEngine(t) // the build exists, or fail as it says
	raw, err := os.ReadFile(fixtureFile)
	if err != nil {
		t.Fatal(err)
	}
	var fx struct {
		Entry json.RawMessage `json:"entry"`
		Table json.RawMessage `json:"table"`
	}
	if err := json.Unmarshal(raw, &fx); err != nil {
		t.Fatal(err)
	}
	e, err := engine.Open(bundleDir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { e.Close() })
	if _, err := e.Load(context.Background(), fx.Entry, fx.Table); err != nil {
		t.Fatal(err)
	}
	return e
}

// withUke is an instruments.json with one ukulele beside the standard guitar.
const withUke = `{"u1":{"definition":{"at":"2026-10-06T12:00:00.000Z","value":{"catalogId":"ukulele","label":"My uke","tuning":"G4 C4 E4 A4","fretCount":15}}}}`

// serveChoosing serves f with eng and a syncer that loads instruments on it
// from instruments.json, as the real one does, having loaded once.
func (f *viewsFixture) serveChoosing(t *testing.T, eng *engine.Engine, instruments string) *viewsServe {
	t.Helper()
	s := f.serve(t, eng)
	s.syncer.mu.Lock()
	s.syncer.engine, s.syncer.instruments, s.syncer.loadStore = eng, json.RawMessage(instruments), f.st
	s.syncer.mu.Unlock()
	if err := s.syncer.ReloadInstrument(context.Background()); err != nil {
		t.Fatal(err)
	}
	return s
}

// TestChooseInstrument pins workflow 19 §Settings: Settings lists the
// account's instruments, the one read with and the account's own; one chosen
// (12) is kept on this reader, loaded, and answered as the settings again;
// songs then read in its tuning; the account's own (null) follows the
// account again.
func TestChooseInstrument(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serveChoosing(t, ownEngine(t), withUke)
	guitar := s.syncer.Roster().InUseID

	s.send(t, protocol.TypeOpen, map[string]any{"view": "settings"})
	var got protocol.Settings
	s.expect(t, protocol.TypeSettings, &got)
	if len(got.Instruments) != 2 || got.Instruments[1] != (protocol.SettingsInstrument{ID: "u1", Name: "My uke"}) {
		t.Fatalf("instruments %+v, want the guitar and My uke", got.Instruments)
	}
	if got.Instrument != guitar || got.AccountInstrument != guitar || got.InstrumentChosen {
		t.Errorf("read %q, account's %q, chosen %v; want the guitar, not chosen", got.Instrument, got.AccountInstrument, got.InstrumentChosen)
	}

	s.send(t, protocol.TypeInstrument, map[string]any{"id": "u1"})
	got = protocol.Settings{}
	s.expect(t, protocol.TypeSettings, &got)
	if got.Instrument != "u1" || got.AccountInstrument != guitar || !got.InstrumentChosen {
		t.Errorf("after choosing: read %q, account's %q, chosen %v; want u1, the guitar, chosen", got.Instrument, got.AccountInstrument, got.InstrumentChosen)
	}
	if f.st.Instrument() != "u1" {
		t.Errorf("the store keeps %q, want u1", f.st.Instrument())
	}
	if sheet := s.openSong(t, walking, nil); sheet.TuningID != "67 60 64 69" {
		t.Errorf("a song read after choosing the uke is in tuning %q, want the uke's", sheet.TuningID)
	}

	s.send(t, protocol.TypeOpen, map[string]any{"view": "settings"})
	s.expect(t, protocol.TypeSettings, &got)
	s.send(t, protocol.TypeInstrument, map[string]any{"id": nil})
	got = protocol.Settings{}
	s.expect(t, protocol.TypeSettings, &got)
	if got.Instrument != guitar || got.InstrumentChosen || f.st.Instrument() != "" {
		t.Errorf("the account's again: read %q, chosen %v, kept %q", got.Instrument, got.InstrumentChosen, f.st.Instrument())
	}
}

// TestNoInstrumentChoiceWithOne pins workflow 19 §Settings: with one
// instrument there is nothing to choose, and Settings lists none.
func TestNoInstrumentChoiceWithOne(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serveChoosing(t, ownEngine(t), `{}`)
	s.send(t, protocol.TypeOpen, map[string]any{"view": "settings"})
	var got protocol.Settings
	s.expect(t, protocol.TypeSettings, &got)
	if len(got.Instruments) != 0 || got.Instrument != "" {
		t.Errorf("one instrument: %+v, want no choice", got)
	}
}

// twoWays is a song with two variations for the standard tuning.
const twoWays = "# Two Ways\n- key: C\n\n```\nC | G | C\n```\n\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- C: x32010\n- G: 320003\n\n## High: E2 A2 D3 G3 B3 E4\n- C: x35553\n- G: 355433\n"

const twoWaysPath = "two-ways.cifra.md"

func framesOf(sheet protocol.Sheet) []string {
	var out []string
	for _, sh := range sheet.Shapes {
		if sh.Frets != nil {
			out = append(out, *sh.Frets)
		}
	}
	return out
}

// TestChooseVariation pins workflow 19 §A song: a song with two variations
// for its tuning lists them and the one read; one chosen (13) is kept on this
// reader for the song and tuning, and redraws the song with it; null follows
// the account's again; transposed, they are still listed.
func TestChooseVariation(t *testing.T) {
	f := newViewsFixture(t)
	f.book[twoWaysPath] = twoWays
	f.commitBook(t)
	s := f.serve(t, ownEngine(t))

	got := s.openSong(t, twoWaysPath, nil)
	if !reflect.DeepEqual(got.Variations, []string{"", "High"}) || got.Variation == nil || *got.Variation != "" || got.VariationChosen {
		t.Fatalf("variations %q, variation %v, chosen %v; want ['' High], '', not chosen", got.Variations, got.Variation, got.VariationChosen)
	}
	if !reflect.DeepEqual(framesOf(got), []string{"x32010", "320003"}) {
		t.Errorf("the default's shapes %v", framesOf(got))
	}

	s.send(t, protocol.TypeVariation, map[string]any{"variation": "High"})
	got = s.sheet(t)
	if got.Variation == nil || *got.Variation != "High" || !got.VariationChosen {
		t.Errorf("after choosing High: %v, chosen %v", got.Variation, got.VariationChosen)
	}
	if !reflect.DeepEqual(framesOf(got), []string{"x35553", "355433"}) {
		t.Errorf("High's shapes %v", framesOf(got))
	}
	if v, ok := f.st.Variation(testBook, twoWaysPath, got.TuningID); !ok || v != "High" {
		t.Errorf("the store keeps %q %v, want High", v, ok)
	}
	// Kept: opened again, it reads High.
	if again := s.openSong(t, twoWaysPath, nil); again.Variation == nil || *again.Variation != "High" {
		t.Errorf("opened again: %v, want High", again.Variation)
	}

	// Transposed, still listed (the frontend keeps the button's room and
	// offers the choice at the written key only).
	s.send(t, protocol.TypeKey, map[string]any{"offset": 2})
	if tr := s.sheet(t); len(tr.Variations) != 2 || tr.Offset != 2 {
		t.Errorf("transposed: %q at %d, want both listed at 2", tr.Variations, tr.Offset)
	}
	s.send(t, protocol.TypeKey, map[string]any{"offset": nil})
	s.sheet(t)

	s.send(t, protocol.TypeVariation, map[string]any{"variation": nil})
	got = s.sheet(t)
	if got.Variation == nil || *got.Variation != "" || got.VariationChosen {
		t.Errorf("the account's again: %v, chosen %v", got.Variation, got.VariationChosen)
	}
	if _, ok := f.st.Variation(testBook, twoWaysPath, got.TuningID); ok {
		t.Error("null kept a variation")
	}
}

// TestAccountVariationRead pins that, with none chosen here, the account's
// variation (songs.json) is the one read, and not marked chosen.
func TestAccountVariationRead(t *testing.T) {
	f := newViewsFixture(t)
	f.book[twoWaysPath] = twoWays
	f.commitBook(t)
	home := homeFiles(t, true)
	home["songs.json"] = mustMarshal(t, map[string]any{
		testBook + "/" + twoWaysPath: map[string]any{"variation": map[string]any{"40 45 50 55 59 64": reg("High")}},
	})
	commit(t, f.st.HomeDir(), home)
	s := f.serve(t, ownEngine(t))
	got := s.openSong(t, twoWaysPath, nil)
	if got.Variation == nil || *got.Variation != "High" || got.VariationChosen {
		t.Errorf("the account's High: %v, chosen %v", got.Variation, got.VariationChosen)
	}
}

// asVoiced is a song whose C is voiced with E in the bass: as voiced, C/E.
const asVoiced = "# As Voiced\n- key: C\n\n```\nC | G | C\n```\n\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- C: 032010\n- G: 320003\n"

const asVoicedPath = "as-voiced.cifra.md"

func symbolsOf(sheet protocol.Sheet) []string {
	var out []string
	for _, sh := range sheet.Shapes {
		out = append(out, sh.Symbol)
	}
	return out
}

// TestChooseChordNames pins workflow 19 §Settings: Settings says how the
// chart names its chords — the account's, until one is chosen here (14),
// kept on this reader and read by every song after; null follows the account
// again.
func TestChooseChordNames(t *testing.T) {
	f := newViewsFixture(t)
	f.book[asVoicedPath] = asVoiced
	f.commitBook(t)
	s := f.serve(t, ownEngine(t))

	s.send(t, protocol.TypeOpen, map[string]any{"view": "settings"})
	got := protocol.Settings{}
	s.expect(t, protocol.TypeSettings, &got)
	if got.ChordNames != "written" || got.ChordNamesChosen {
		t.Errorf("before: %q chosen %v, want the account's written", got.ChordNames, got.ChordNamesChosen)
	}
	if sheet := s.openSong(t, asVoicedPath, nil); !reflect.DeepEqual(symbolsOf(sheet), []string{"C", "G"}) {
		t.Errorf("as written: %v", symbolsOf(sheet))
	}

	s.send(t, protocol.TypeChordNames, map[string]any{"value": "voiced"})
	got = protocol.Settings{}
	s.expect(t, protocol.TypeSettings, &got)
	if got.ChordNames != "voiced" || !got.ChordNamesChosen || f.st.ChordNames() != "voiced" {
		t.Errorf("after choosing voiced: %q chosen %v kept %q", got.ChordNames, got.ChordNamesChosen, f.st.ChordNames())
	}
	sheet := s.openSong(t, asVoicedPath, nil)
	if !reflect.DeepEqual(symbolsOf(sheet), []string{"C/E", "G"}) {
		t.Errorf("as voiced: %v, want C/E and G", symbolsOf(sheet))
	}
	if !strings.Contains(string(sheet.Rows), `"C/E"`) {
		t.Errorf("the rows do not name C as voiced: %s", sheet.Rows)
	}

	s.send(t, protocol.TypeChordNames, map[string]any{"value": nil})
	got = protocol.Settings{}
	s.expect(t, protocol.TypeSettings, &got)
	if got.ChordNames != "written" || got.ChordNamesChosen || f.st.ChordNames() != "" {
		t.Errorf("the account's again: %q chosen %v kept %q", got.ChordNames, got.ChordNamesChosen, f.st.ChordNames())
	}
}

// TestAccountChordNamesRead pins that the account's chordNames is read with
// none chosen here, and a choice here wins over it.
func TestAccountChordNamesRead(t *testing.T) {
	f := newViewsFixture(t)
	f.book[asVoicedPath] = asVoiced
	f.commitBook(t)
	home := homeFiles(t, true)
	home["preferences.json"] = mustMarshal(t, map[string]any{"chordNames": reg("voiced")})
	commit(t, f.st.HomeDir(), home)
	s := f.serve(t, ownEngine(t))
	s.send(t, protocol.TypeOpen, map[string]any{"view": "settings"})
	got := protocol.Settings{}
	s.expect(t, protocol.TypeSettings, &got)
	if got.ChordNames != "voiced" || got.ChordNamesChosen {
		t.Errorf("the account's voiced: %q chosen %v", got.ChordNames, got.ChordNamesChosen)
	}
	if sheet := s.openSong(t, asVoicedPath, nil); symbolsOf(sheet)[0] != "C/E" {
		t.Errorf("the account's voiced read %v", symbolsOf(sheet))
	}
	s.send(t, protocol.TypeChordNames, map[string]any{"value": "written"})
	s.expect(t, protocol.TypeSettings, &protocol.Settings{})
	if sheet := s.openSong(t, asVoicedPath, nil); symbolsOf(sheet)[0] != "C" {
		t.Errorf("written chosen over the account's voiced read %v", symbolsOf(sheet))
	}
}

// TestChooseTextSize pins workflow 19 §Settings: a text size chosen (15) is
// kept on this reader and answered with the state, which carries it; null is
// the standard again.
func TestChooseTextSize(t *testing.T) {
	f := newViewsFixture(t)
	s := f.serve(t, ownEngine(t))
	s.send(t, protocol.TypeTextSize, map[string]any{"value": 11})
	var st protocol.State
	s.expect(t, protocol.TypeState, &st)
	if st.TextSize != 11 || f.st.TextSize() != 11 {
		t.Errorf("state text size %d, kept %d; want 11", st.TextSize, f.st.TextSize())
	}
	s.send(t, protocol.TypeTextSize, map[string]any{"value": nil})
	st = protocol.State{}
	s.expect(t, protocol.TypeState, &st)
	if st.TextSize != 0 || f.st.TextSize() != 0 {
		t.Errorf("the standard again: state %d, kept %d", st.TextSize, f.st.TextSize())
	}
}

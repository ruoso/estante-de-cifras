package sync

// behavior — one pass against the fake service: real git http-backend serving
// bare repositories the git CLI made, the two API reads computed from their
// heads (reader.sync; docs/remarkable-reader.md §3.2, §5.2, §5.3; workflow 19
// §When something has changed). The fake fails every test on a receive-pack
// request or a request without the cookie.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/store"
	"estantedecifras.app/remarkable/internal/update"
)

const (
	bookA = "book-a"
	bookB = "book-b"
)

var (
	songOne = song("Lanterns on the Pier", "C | F | G | C")
	songTwo = song("A Road of Small Stones", "Am | F | C | G")
)

// twoBooks sets up the service with two pushed books listed on the shelf, B
// before A.
func twoBooks(t *testing.T, f *fakeService) (headA, headB string) {
	t.Helper()
	f.newRepo(bookA)
	f.newRepo(bookB)
	headA = f.push(bookA, map[string]string{"lanterns.cifra.md": songOne})
	headB = f.push(bookB, map[string]string{"songs/road.cifra.md": songTwo})
	f.push(f.homeID, map[string]string{shelfFile: shelfJSON(
		shelfBook{id: bookA, link: f.url(bookA), position: 2, label: "Quarta"},
		shelfBook{id: bookB, link: f.url(bookB), position: 1, label: "Sexta"},
	)})
	return headA, headB
}

func bookDir(t *testing.T, s *Syncer, id string) string {
	t.Helper()
	dir, err := s.st.BookDir(id)
	if err != nil {
		t.Fatal(err)
	}
	return dir
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func readAt(t *testing.T, sn *Snapshot, id, path string) string {
	t.Helper()
	b := sn.Book(id)
	if b == nil {
		t.Fatalf("snapshot has no book %s", id)
	}
	raw, err := b.Read(path)
	if err != nil {
		t.Fatalf("read %s in %s: %v", path, id, err)
	}
	return string(raw)
}

// TestFirstPassClonesHomeAndShelf pins design §5.2: the home book and every
// shelf book come down, the shelf in its order, a song readable.
func TestFirstPassClonesHomeAndShelf(t *testing.T) {
	f := newFakeService(t)
	headA, headB := twoBooks(t, f)
	s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
	res := mustPass(t, s)

	if res.Home.Status != Cloned || headStr(res.Home) != f.head(f.homeID) {
		t.Errorf("home: %+v, want cloned at %s", res.Home, f.head(f.homeID))
	}
	wantStatus(t, res, bookA, Cloned)
	wantStatus(t, res, bookB, Cloned)
	if headStr(res.Books[bookA]) != headA || headStr(res.Books[bookB]) != headB {
		t.Errorf("heads %+v, want %s %s", res.Books, headA, headB)
	}
	for _, id := range []string{bookA, bookB} {
		if !isClone(bookDir(t, s, id)) {
			t.Errorf("no clone under books/%s", id)
		}
	}
	sn := s.Snapshot()
	shelf := sn.Shelf()
	if len(shelf) != 2 || shelf[0].ID != bookB || shelf[1].ID != bookA || shelf[0].Label != "Sexta" {
		t.Errorf("shelf %+v, want B (Sexta) then A", shelf)
	}
	if got := readAt(t, sn, bookB, "songs/road.cifra.md"); got != songTwo {
		t.Errorf("read %q", got)
	}
	paths, err := sn.Book(bookB).Paths()
	if err != nil || len(paths) != 1 || paths[0] != "songs/road.cifra.md" {
		t.Errorf("paths %v %v", paths, err)
	}
	if sn.Book(bookA).Head() != headA {
		t.Errorf("snapshot head %s, want %s", sn.Book(bookA).Head(), headA)
	}
	if last, ok := s.st.LastSync(); !ok || last.IsZero() {
		t.Error("no last sync kept")
	}
}

// TestSecondPassFetchesOnlyWhatMoved pins design §5.3: one change check for
// the shelf, and git requests only for the book that moved and the home book.
func TestSecondPassFetchesOnlyWhatMoved(t *testing.T) {
	f := newFakeService(t)
	_, headB := twoBooks(t, f)
	s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
	mustPass(t, s)

	newA := f.push(bookA, map[string]string{"second.cifra.md": songTwo})
	f.reset()
	res := mustPass(t, s)
	wantStatus(t, res, bookA, Fetched)
	wantStatus(t, res, bookB, Unchanged)
	if headStr(res.Books[bookA]) != newA || headStr(res.Books[bookB]) != headB {
		t.Errorf("heads %+v", res.Books)
	}
	if res.Home.Status != Unchanged {
		t.Errorf("home %s, want unchanged", res.Home.Status)
	}
	if n := f.count("/api/shelf/change-check"); n != 1 {
		t.Errorf("%d change checks, want 1", n)
	}
	if n := len(f.requestsFor(bookA)); n == 0 {
		t.Error("no upload-pack request for the book that moved")
	}
	if n := len(f.requestsFor(f.homeID)); n == 0 {
		t.Error("no request for the home book")
	}
	if got := f.requestsFor(bookB); len(got) != 0 {
		t.Errorf("requests for the book that did not move: %+v", got)
	}
	if got := readAt(t, s.Snapshot(), bookA, "second.cifra.md"); got != songTwo {
		t.Errorf("read %q", got)
	}
}

// TestNeverPushes pins design §3.2 "Never a push": a pass after a clone was
// made dirty by hand sends no receive-pack (the fake's check) and leaves the
// remote's refs as they were; and the package's code names neither the
// receive-pack service nor go-git's push.
func TestNeverPushes(t *testing.T) {
	f := newFakeService(t)
	headA, _ := twoBooks(t, f)
	s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
	mustPass(t, s)

	// A commit made in the clone by hand, on main.
	dir := bookDir(t, s, bookA)
	wc := t.TempDir()
	runGit(t, wc, "clone", "-q", dir, "w")
	w := filepath.Join(wc, "w")
	if err := os.WriteFile(filepath.Join(w, "local.cifra.md"), []byte(songTwo), 0o644); err != nil {
		t.Fatal(err)
	}
	runGit(t, w, "add", "-A")
	runGit(t, w, "commit", "-q", "-m", "local")
	runGit(t, w, "push", "-q", "origin", "main")

	f.push(bookA, map[string]string{"remote.cifra.md": songOne})
	remoteHead := f.head(bookA)
	mustPass(t, s)
	if f.head(bookA) != remoteHead {
		t.Errorf("the remote moved: %s, was %s", f.head(bookA), remoteHead)
	}
	if headA == remoteHead {
		t.Fatal("the remote did not move in the test")
	}

	files, _ := filepath.Glob("*.go")
	for _, name := range files {
		if strings.HasSuffix(name, "_test.go") {
			continue
		}
		raw, err := os.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		for _, forbidden := range []string{"receive-pack", "ReceivePack", ".Push(", "PushContext", "PushOptions"} {
			if strings.Contains(string(raw), forbidden) {
				t.Errorf("%s names %q", name, forbidden)
			}
		}
	}
}

// TestSnapshotKeepsItsVersion pins workflow 19 §When something has changed
// and design §5.3: a snapshot reads the version it was made from, after a
// later pass fetched a new one.
func TestSnapshotKeepsItsVersion(t *testing.T) {
	f := newFakeService(t)
	twoBooks(t, f)
	s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
	mustPass(t, s)
	old := s.Snapshot()
	changed := song("Lanterns on the Pier", "C | Am | F | G")
	f.push(bookA, map[string]string{"lanterns.cifra.md": changed})
	res := mustPass(t, s)
	wantStatus(t, res, bookA, Fetched)

	if got := readAt(t, old, bookA, "lanterns.cifra.md"); got != songOne {
		t.Errorf("the old snapshot reads %q, want the old text", got)
	}
	if got := readAt(t, s.Snapshot(), bookA, "lanterns.cifra.md"); got != changed {
		t.Errorf("the new snapshot reads %q, want the new text", got)
	}
	if old.Book(bookA).Head() == s.Snapshot().Book(bookA).Head() {
		t.Error("the snapshots share a head")
	}
}

// TestGoneBookLeavesTheShelf pins workflow 19 §When something has changed:
// gone leaves the next snapshot and its clone goes — unless held, then on
// the first pass after release.
func TestGoneBookLeavesTheShelf(t *testing.T) {
	f := newFakeService(t)
	twoBooks(t, f)
	s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
	mustPass(t, s)

	f.setGone(bookA, true)
	res := mustPass(t, s)
	wantStatus(t, res, bookA, Gone)
	if s.Snapshot().Book(bookA) != nil {
		t.Error("the gone book is in the snapshot")
	}
	for _, b := range s.Snapshot().Shelf() {
		if b.ID == bookA {
			t.Error("the gone book is on the shelf")
		}
	}
	if exists(bookDir(t, s, bookA)) {
		t.Error("the gone book's clone stayed")
	}

	// Held: B goes too, but its clone stays while a screen reads it.
	old := s.Snapshot()
	release := s.Hold(bookB)
	f.setGone(bookB, true)
	mustPass(t, s)
	if s.Snapshot().Book(bookB) != nil {
		t.Error("the held gone book is in the new snapshot")
	}
	if !exists(bookDir(t, s, bookB)) {
		t.Fatal("the held book's clone went")
	}
	if got := readAt(t, old, bookB, "songs/road.cifra.md"); got != songTwo {
		t.Errorf("the held book reads %q", got)
	}
	release()
	release() // idempotent
	if !exists(bookDir(t, s, bookB)) {
		t.Error("the clone went on release, before a pass")
	}
	mustPass(t, s)
	if exists(bookDir(t, s, bookB)) {
		t.Error("the released book's clone stayed after the next pass")
	}
}

// TestTombstonedShelfEntryLeaves pins format §4.2: an entry whose link is
// tombstoned leaves the shelf, and its clone goes.
func TestTombstonedShelfEntryLeaves(t *testing.T) {
	f := newFakeService(t)
	twoBooks(t, f)
	s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
	mustPass(t, s)
	f.push(f.homeID, map[string]string{shelfFile: shelfJSON(
		shelfBook{id: bookA, link: nil, position: 2},
		shelfBook{id: bookB, link: f.url(bookB), position: 1},
	)})
	res := mustPass(t, s)
	wantStatus(t, res, bookA, Gone)
	if shelf := s.Snapshot().Shelf(); len(shelf) != 1 || shelf[0].ID != bookB {
		t.Errorf("shelf %+v, want B only", shelf)
	}
	if exists(bookDir(t, s, bookA)) {
		t.Error("the tombstoned book's clone stayed")
	}
}

// TestEmptyBookWaits pins step 5: a book with no main is empty, with no
// directory, and is asked for again only when the check says it changed.
func TestEmptyBookWaits(t *testing.T) {
	f := newFakeService(t)
	f.newRepo(bookA)
	f.push(f.homeID, map[string]string{shelfFile: shelfJSON(shelfBook{id: bookA, link: f.url(bookA), position: 1})})
	s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
	res := mustPass(t, s)
	wantStatus(t, res, bookA, Empty)
	if res.Books[bookA].Head != nil {
		t.Errorf("empty book head %v", *res.Books[bookA].Head)
	}
	if exists(bookDir(t, s, bookA)) {
		t.Error("an empty book left a directory")
	}
	if tmps, _ := filepath.Glob(filepath.Join(s.st.Root(), "books", tmpClonePrefix+"*")); len(tmps) != 0 {
		t.Errorf("temporaries left: %v", tmps)
	}

	f.reset()
	res = mustPass(t, s)
	wantStatus(t, res, bookA, Empty)
	if got := f.requestsFor(bookA); len(got) != 0 {
		t.Errorf("an empty book was asked for again before it changed: %+v", got)
	}

	head := f.push(bookA, map[string]string{"lanterns.cifra.md": songOne})
	res = mustPass(t, s)
	wantStatus(t, res, bookA, Cloned)
	if headStr(res.Books[bookA]) != head {
		t.Errorf("head %s, want %s", headStr(res.Books[bookA]), head)
	}
	if got := readAt(t, s.Snapshot(), bookA, "lanterns.cifra.md"); got != songOne {
		t.Errorf("read %q", got)
	}
}

// TestEmptyHomeBook pins step 3: a home book with no main reads as every
// file {} — an empty shelf, and the standard guitar loaded (the built bundle
// decides).
func TestEmptyHomeBook(t *testing.T) {
	f := newFakeService(t)
	eng := &recordingEngine{inner: openBuiltEngine(t)}
	s := newTestSyncer(t, f, newTestStore(t, f), eng)
	res := mustPass(t, s)
	if res.Home.Status != Empty {
		t.Errorf("home %s, want empty", res.Home.Status)
	}
	if len(s.Snapshot().Shelf()) != 0 || len(res.Books) != 0 {
		t.Errorf("shelf %+v books %+v, want none", s.Snapshot().Shelf(), res.Books)
	}
	if string(s.Snapshot().Preferences()) != "{}" {
		t.Errorf("preferences %s, want {}", s.Snapshot().Preferences())
	}
	if len(eng.loaded) != 1 {
		t.Fatalf("%d loads, want 1", len(eng.loaded))
	}
	if got := eng.loaded[0]; got.TuningID != "40 45 50 55 59 64" || got.Held != 0 {
		t.Errorf("loaded %+v, want the standard guitar with no table", got)
	}
	var entry struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(eng.entries[0], &entry); err != nil || entry.ID != "standard" {
		t.Errorf("entry %s, want the standard guitar", eng.entries[0])
	}
}

// recordingEngine is the real engine, recording what was loaded.
type recordingEngine struct {
	inner   *engine.Engine
	entries []json.RawMessage
	loaded  []engine.Loaded
}

func (r *recordingEngine) Instrument(ctx context.Context, files engine.InstrumentFiles) (engine.Instrument, error) {
	return r.inner.Instrument(ctx, files)
}

func (r *recordingEngine) Load(ctx context.Context, entry, table json.RawMessage) (engine.Loaded, error) {
	l, err := r.inner.Load(ctx, entry, table)
	r.entries = append(r.entries, entry)
	r.loaded = append(r.loaded, l)
	return l, err
}

// TestOfflineChangesNothing pins DIRECTION's offline first: the service
// unreachable, the pass is offline and leaves the clones and the snapshot.
func TestOfflineChangesNothing(t *testing.T) {
	f := newFakeService(t)
	headA, _ := twoBooks(t, f)
	s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
	mustPass(t, s)
	before := s.Snapshot()
	last, _ := s.st.LastSync()

	f.srv.Close()
	_, err := s.Pass(context.Background())
	if !errors.Is(err, errOffline) {
		t.Fatalf("Pass: %v, want offline", err)
	}
	if s.Snapshot() != before {
		t.Error("the snapshot changed")
	}
	if headOf(bookDir(t, s, bookA)).String() != headA {
		t.Error("a clone changed")
	}
	if got, _ := s.st.LastSync(); !got.Equal(last) {
		t.Errorf("last sync %v, was %v", got, last)
	}
	if got := readAt(t, s.Snapshot(), bookA, "lanterns.cifra.md"); got != songOne {
		t.Errorf("read %q", got)
	}
}

// TestRefusedSessionForgetsTheDevice pins workflow 19 §Pairing (signed out
// from the account) and design §5.1, as reader.pairing Constraint 8 and
// Decision 6 settle it: a 401 ends the pass signedOut and forgets the device
// — the session, the state, the home book and every book no screen holds go
// at once, with the snapshot; a held book stays readable until let go, then
// goes too. (It replaces reader.sync's "nothing is removed", which left
// signing out to this task.)
func TestRefusedSessionForgetsTheDevice(t *testing.T) {
	f := newFakeService(t)
	twoBooks(t, f)
	var statuses []Status
	st := newTestStore(t, f)
	s := newTestSyncer(t, f, st, newFakeEngine())
	s.opts.OnStatus = func(x Status) { statuses = append(statuses, x) }
	mustPass(t, s)
	if err := st.SetShapesShown(false); err != nil {
		t.Fatal(err)
	}
	dirA, dirB := bookDir(t, s, bookA), bookDir(t, s, bookB)
	release := s.Hold(bookA) // the song on screen is book A's

	f.setUnauthorized(true)
	_, err := s.Pass(context.Background())
	if !errors.Is(err, errSignedOut) {
		t.Fatalf("Pass: %v, want signed out", err)
	}
	if last := statuses[len(statuses)-1]; last.Error != ErrorSignedOut || last.Syncing {
		t.Errorf("status %+v, want signedOut", last)
	}
	if _, ok := st.Session(); ok {
		t.Error("the session was kept")
	}
	if _, err := os.Stat(filepath.Join(st.Root(), "session.json")); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("session.json kept: %v", err)
	}
	if !st.ShapesShown() {
		t.Error("the reader's state was kept")
	}
	if entries, _ := os.ReadDir(st.HomeDir()); len(entries) != 0 {
		t.Errorf("home/ kept %d entries", len(entries))
	}
	if exists(dirB) {
		t.Error("the unheld book was kept")
	}
	if !isClone(dirA) {
		t.Error("the held book was removed while a screen holds it")
	}
	if sn := s.Snapshot(); len(sn.Shelf()) != 0 || sn.Book(bookA) != nil {
		t.Error("the snapshot still has the account's books")
	}

	release()
	if exists(dirA) {
		t.Error("the held book stayed after it was let go")
	}
	if ids, _ := st.BookIDs(); len(ids) != 0 {
		t.Errorf("books %v remain", ids)
	}
	// Unpaired, the next pass sends nothing.
	f.reset()
	if _, err := s.Pass(context.Background()); !errors.Is(err, ErrNotPaired) {
		t.Errorf("Pass after the refusal: %v, want not paired", err)
	}
	if n := len(f.all()); n != 0 {
		t.Errorf("%d requests after the refusal", n)
	}
}

// TestSignOutCancelsThePassInFlight pins workflow 19 §The shelf (Sign out)
// and reader.pairing Constraint 7: Sign out cancels a pass in flight and
// waits for it, ends the session with the service (with the cookie), and
// clears the store of the account but the bundle, and the snapshot.
func TestSignOutCancelsThePassInFlight(t *testing.T) {
	f := newFakeService(t)
	twoBooks(t, f)
	st := newTestStore(t, f)
	s := newTestSyncer(t, f, st, newFakeEngine())
	mustPass(t, s)

	stalled := f.setStall()
	passed := make(chan error, 1)
	go func() {
		_, err := s.Pass(context.Background())
		passed <- err
	}()
	select {
	case <-stalled:
	case <-time.After(5 * time.Second):
		t.Fatal("the pass did not reach the service")
	}

	start := time.Now()
	if err := s.SignOut(context.Background()); err != nil {
		t.Fatalf("SignOut: %v", err)
	}
	if d := time.Since(start); d > SignOutTimeout {
		t.Errorf("SignOut took %v", d)
	}
	select {
	case err := <-passed:
		if err == nil {
			t.Error("the pass in flight finished as if not cancelled")
		}
	default:
		t.Fatal("SignOut returned before the pass in flight ended")
	}
	if n := f.signoutCount(); n != 1 {
		t.Errorf("signout called %d times, want 1", n)
	}
	if _, ok := st.Session(); ok {
		t.Error("still paired")
	}
	if ids, _ := st.BookIDs(); len(ids) != 0 {
		t.Errorf("books %v kept", ids)
	}
	if entries, _ := os.ReadDir(st.HomeDir()); len(entries) != 0 {
		t.Errorf("home/ kept %d entries", len(entries))
	}
	if len(s.Snapshot().Shelf()) != 0 {
		t.Error("the snapshot kept the shelf")
	}
	// The cleanup's check: every request, signout's among them, carried the
	// cookie.
}

// TestAccountFromAuthorName pins device_pairing Decision 10 and
// reader.pairing Constraint 10: each pass that reads the home book sets the
// session's account to preferences.json's authorName — and writes nothing
// when it is unchanged.
func TestAccountFromAuthorName(t *testing.T) {
	f := newFakeService(t)
	twoBooks(t, f)
	prefs := func(name string) string {
		raw, _ := json.Marshal(map[string]any{"authorName": reg(name)})
		return string(raw) + "\n"
	}
	f.push(f.homeID, map[string]string{preferencesFile: prefs("Marina Souza")})
	st := newTestStore(t, f)
	s := newTestSyncer(t, f, st, nil)
	mustPass(t, s)
	sess, _ := st.Session()
	if sess.Account != "Marina Souza" {
		t.Fatalf("account %q, want the home book's authorName", sess.Account)
	}
	if sess.Token != testToken || sess.Origin != f.srv.URL {
		t.Errorf("the session's other fields changed: %+v", sess.Origin)
	}
	path := filepath.Join(st.Root(), "session.json")
	before, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	mustPass(t, s)
	after, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if !os.SameFile(before, after) {
		t.Error("session.json rewritten with the account unchanged")
	}

	f.push(f.homeID, map[string]string{preferencesFile: prefs("Marina S.")})
	mustPass(t, s)
	if sess, _ := st.Session(); sess.Account != "Marina S." {
		t.Errorf("account %q after the name changed", sess.Account)
	}
}

// TestInterruptedCloneLeavesNoBook pins atomic clones: an upload-pack answer
// cut mid-pack leaves no books/<id> and no temporary; the next pass clones.
func TestInterruptedCloneLeavesNoBook(t *testing.T) {
	f := newFakeService(t)
	headA, _ := twoBooks(t, f)
	s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
	f.setCut(bookA, true)
	res := mustPass(t, s)
	wantStatus(t, res, bookA, Failed)
	wantStatus(t, res, bookB, Cloned)
	if exists(bookDir(t, s, bookA)) {
		t.Error("an interrupted clone left books/" + bookA)
	}
	if tmps, _ := filepath.Glob(filepath.Join(s.st.Root(), "books", tmpClonePrefix+"*")); len(tmps) != 0 {
		t.Errorf("temporaries left: %v", tmps)
	}
	if s.Snapshot().Book(bookA) != nil {
		t.Error("the snapshot has the interrupted book")
	}

	f.setCut(bookA, false)
	res = mustPass(t, s)
	wantStatus(t, res, bookA, Cloned)
	if headStr(res.Books[bookA]) != headA {
		t.Errorf("head %s, want %s", headStr(res.Books[bookA]), headA)
	}
}

// TestStaleTemporariesRemoved pins atomic clones: a pass removes the
// .tmp-clone-* a crash left.
func TestStaleTemporariesRemoved(t *testing.T) {
	f := newFakeService(t)
	st := newTestStore(t, f)
	stale := []string{
		filepath.Join(st.Root(), tmpClonePrefix+"home"),
		filepath.Join(st.Root(), "books", tmpClonePrefix+bookA),
	}
	for _, d := range stale {
		if err := os.MkdirAll(d, 0o700); err != nil {
			t.Fatal(err)
		}
	}
	s := newTestSyncer(t, f, st, newFakeEngine())
	mustPass(t, s)
	for _, d := range stale {
		if exists(d) {
			t.Errorf("%s stayed", filepath.Base(d))
		}
	}
}

// TestInstrumentLoadedOnHomeChange pins step 4: a changed preferences.json
// gives one Load, an unchanged home book none.
func TestInstrumentLoadedOnHomeChange(t *testing.T) {
	f := newFakeService(t)
	twoBooks(t, f)
	eng := newFakeEngine()
	s := newTestSyncer(t, f, newTestStore(t, f), eng)
	mustPass(t, s)
	if n := eng.loadCount(); n != 1 {
		t.Fatalf("first pass: %d loads, want 1", n)
	}
	mustPass(t, s)
	if n := eng.loadCount(); n != 1 {
		t.Errorf("an unchanged home book loaded again: %d loads", n)
	}
	f.push(f.homeID, map[string]string{preferencesFile: `{
  "diagramHanded": {
    "at": "2026-10-07T12:00:00.000Z",
    "value": "left"
  }
}
`})
	mustPass(t, s)
	if n := eng.loadCount(); n != 2 {
		t.Errorf("a changed preferences.json: %d loads, want 2", n)
	}
	if !strings.Contains(string(s.Snapshot().Preferences()), `"left"`) {
		t.Errorf("snapshot preferences %s", s.Snapshot().Preferences())
	}
}

// openBuiltEngine opens the app's built device bundle (the gate builds the
// app before the reader; a missing build fails).
func openBuiltEngine(t *testing.T) *engine.Engine {
	t.Helper()
	dir := "../../../app/dist/device"
	if _, err := os.Stat(filepath.Join(dir, engine.ManifestFile)); err != nil {
		t.Fatalf("%v — run npm run build in app/", err)
	}
	e, err := engine.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { e.Close() })
	return e
}

// --- the self-update at the end of a pass (reader.self_update) ---

// newUpdatingSyncer is newTestSyncer with the self-update on, and its
// statuses recorded.
func newUpdatingSyncer(t *testing.T, f *fakeService, st *store.Store, statuses *[]Status) *Syncer {
	t.Helper()
	return New(st, newFakeEngine(), Options{
		HTTPClient: f.srv.Client(),
		Now:        func() time.Time { return time.Date(2026, 11, 1, 14, 32, 0, 0, time.UTC) },
		Online:     func() bool { return true },
		OnStatus:   func(s Status) { *statuses = append(*statuses, s) },
		Update:     &update.Updater{Store: st},
	})
}

// TestPassStagesTheServedBundle pins constraint 7 and design §8: a pass
// fetches the books, then reads /device/ — without the cookie, which the fake
// checks — and stages the served bundle beside its manifest as served.
func TestPassStagesTheServedBundle(t *testing.T) {
	f := newFakeService(t)
	twoBooks(t, f)
	manifest, sha := f.serveBundle([]byte("globalThis.x = 1;\n"), []byte("rcc"))
	st := newTestStore(t, f)
	var statuses []Status
	s := newUpdatingSyncer(t, f, st, &statuses)
	mustPass(t, s)

	dir, ok := st.StagedBundleDir()
	if !ok {
		t.Fatal("no bundle staged")
	}
	if raw, err := os.ReadFile(filepath.Join(dir, engine.ManifestFile)); err != nil || string(raw) != string(manifest) {
		t.Errorf("staged manifest %q (%v), want the served bytes", raw, err)
	}
	if got := update.BundleSHA(dir); got != sha {
		t.Errorf("staged bundle %s, want %s", got, sha)
	}
	reqs := f.all()
	lastBook, firstDevice := -1, -1
	for i, r := range reqs {
		if strings.HasPrefix(r.Path, "/device/") {
			if firstDevice < 0 {
				firstDevice = i
			}
		} else {
			lastBook = i
		}
	}
	if firstDevice < 0 || firstDevice < lastBook {
		t.Errorf("requests %+v: /device/ read before the books were fetched", reqs)
	}
	if reqs[firstDevice].Path != "/device/manifest.json" {
		t.Errorf("first /device/ request %s, want the manifest", reqs[firstDevice].Path)
	}
}

// TestDeviceFailureChangesNothingThePassReports pins constraint 7: a /device/
// that fails (a 500, a bad hash) leaves the pass's Status and lastSync as
// without it — online, no error, the pass's time — and stages nothing.
func TestDeviceFailureChangesNothingThePassReports(t *testing.T) {
	for _, tc := range []struct {
		name  string
		spoil func(f *fakeService)
	}{
		{"a 500", func(f *fakeService) { f.setDeviceStatus(500) }},
		{"a bad hash", func(f *fakeService) {
			f.setDevice("bundle."+sha256Hex([]byte("globalThis.x = 1;\n"))[:8]+".js", []byte("globalThis.x = 2;\n"))
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newFakeService(t)
			twoBooks(t, f)
			f.serveBundle([]byte("globalThis.x = 1;\n"), []byte("rcc"))
			tc.spoil(f)

			// Without the update, for comparison.
			var plain []Status
			ps := newUpdatingSyncer(t, f, newTestStore(t, f), &plain)
			ps.opts.Update = nil
			mustPass(t, ps)

			st := newTestStore(t, f)
			var statuses []Status
			s := newUpdatingSyncer(t, f, st, &statuses)
			if _, err := s.Pass(context.Background()); err != nil {
				t.Fatalf("Pass: %v, want no error", err)
			}
			if len(statuses) != len(plain) || statuses[len(statuses)-1] != plain[len(plain)-1] {
				t.Errorf("statuses %+v, want as without the update %+v", statuses, plain)
			}
			end := statuses[len(statuses)-1]
			if !end.Online || end.Error != "" || end.Syncing {
				t.Errorf("end status %+v, want online with no error", end)
			}
			if last, ok := st.LastSync(); !ok || !last.Equal(end.LastSync) {
				t.Errorf("lastSync %v %v, want %v", last, ok, end.LastSync)
			}
			if _, staged := st.StagedBundleDir(); staged {
				t.Error("a failed /device/ staged a bundle")
			}
		})
	}
}

func sha256Hex(b []byte) string {
	s := sha256.Sum256(b)
	return hex.EncodeToString(s[:])
}

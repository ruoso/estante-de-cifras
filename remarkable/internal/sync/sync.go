// Package sync is the reader's sync (docs/remarkable-reader.md §3.2, §5): with
// the session in the store, it fetches the account's home book and every book
// on its shelf into the store with go-git, and never pushes. It reads the home
// book by its own format — the shelf, each song's saved transposition and
// variation, the preferences — hands the instrument files to the bundle, which
// chooses the instrument and its table, and loads them into the engine. Each
// book is cloned the first time it is seen; after that one change check for
// the whole shelf says which books moved, and only those are fetched.
//
// What the screens read is an immutable Snapshot, so a sync never changes the
// song on screen; a book no longer shared leaves the next snapshot, and its
// clone goes once no screen holds it.
//
// Read-only toward the account: the only requests are GET
// /api/account/home-book, POST /api/shelf/change-check (a read, by the
// contract) and git upload-pack, all to the session's one origin — and, when
// the person signs the device out, POST /api/auth/signout, which ends this
// device's own session (reader.pairing).
//
// A session the service refuses (401) is forgotten: the session, the state,
// the home book and every clone no screen holds go at once, the held ones
// when let go, and the pass ends signedOut (reader.pairing Decision 6). The package
// logs nothing; its errors name a step and a book's id, never a token, a link,
// a label or a song's words (§10).
package sync

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	gosync "sync"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/store"
)

// ErrNotPaired is Pass's answer when the store holds no session.
var ErrNotPaired = errors.New("sync: not paired")

// What a pass did with the home book and with each book (Result).
const (
	Cloned    = "cloned"
	Fetched   = "fetched"
	Unchanged = "unchanged"
	Gone      = "gone"
	Empty     = "empty"
	Refused   = "refused"
	Failed    = "failed"
)

// The word codes Status.Error carries (protocol State.error).
const (
	ErrorOffline   = "offline"
	ErrorSignedOut = "signedOut"
)

// tmpClonePrefix names a clone being made, renamed into place when whole.
const tmpClonePrefix = ".tmp-clone-"

// homeBookID is how Result and errors name the home book.
const homeBookID = "home"

// changeCheckMax is the contract's most books in one change check.
const changeCheckMax = 500

// SignOutTimeout bounds asking the service to end the session at sign out:
// offline or slow, the device signs out all the same (reader.pairing
// Decision 5).
const SignOutTimeout = 5 * time.Second

// Engine is what sync needs of the engine: the bundle's choice of instrument
// and table, and loading them (engine.Engine satisfies it).
type Engine interface {
	Instrument(ctx context.Context, files engine.InstrumentFiles) (engine.Instrument, error)
	Load(ctx context.Context, entry, table json.RawMessage) (engine.Loaded, error)
}

// Status is the reader's sync status, the shelf's sync line (workflow 19 §The
// shelf): syncing, whether the service was reachable, when the last sync
// finished (zero before the first), and an error word.
type Status struct {
	Syncing  bool
	Online   bool
	LastSync time.Time
	Error    string
}

// Options are a Syncer's collaborators; every one has a default.
type Options struct {
	// HTTPClient makes every request, the API's and git's.
	HTTPClient *http.Client
	// Now is the clock.
	Now func() time.Time
	// Online says whether the device is on Wi-Fi, for the periodic pass.
	Online func() bool
	// OnStatus is told when a pass begins and how it ended.
	OnStatus func(Status)
}

// BookResult is what a pass did with one book, and the head it has now
// (nil when none).
type BookResult struct {
	Status string  `json:"status"`
	Head   *string `json:"head"`
}

// Result is what a pass did: ids, statuses and heads, nothing else.
type Result struct {
	Home  BookResult            `json:"home"`
	Books map[string]BookResult `json:"books"`
}

// Syncer syncs one store. Its methods are safe from any goroutine; passes run
// one at a time.
type Syncer struct {
	st   *store.Store
	eng  Engine
	opts Options

	passMu gosync.Mutex // one pass at a time

	mu         gosync.Mutex
	snap       *Snapshot
	holds      map[string]int
	gone       map[string]bool // reported gone, until a check says changed
	empty      map[string]bool // found empty, until a check says changed
	loadDigest string          // the instrument files last loaded
	online     bool
	// cancelPass cancels the pass in flight (nil when none); signingOut
	// counts sign-outs waiting for passMu, during which no pass begins.
	cancelPass context.CancelFunc
	signingOut int

	// The schedule (schedule.go) and its test seams.
	trigger   chan struct{}
	newTicker func(time.Duration) (<-chan time.Time, func())
	pass      func(context.Context) (Result, error)

	// signOutTimeout is SignOutTimeout (a test seam).
	signOutTimeout time.Duration
}

// New makes a Syncer for st, loading instruments into eng (which may be nil:
// then nothing is loaded). Its first snapshot is what is already on disk, so
// the screens have the last sync's books before any pass.
func New(st *store.Store, eng Engine, opts Options) *Syncer {
	if opts.HTTPClient == nil {
		opts.HTTPClient = &http.Client{}
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if opts.Online == nil {
		opts.Online = wlanUp
	}
	s := &Syncer{
		st: st, eng: eng, opts: opts,
		holds:          map[string]int{},
		gone:           map[string]bool{},
		empty:          map[string]bool{},
		trigger:        make(chan struct{}, 1),
		signOutTimeout: SignOutTimeout,
		newTicker: func(d time.Duration) (<-chan time.Time, func()) {
			t := time.NewTicker(d)
			return t.C, t.Stop
		},
	}
	s.pass = s.Pass
	s.snap = s.diskSnapshot()
	return s
}

// wlanUp reads whether the reMarkable's Wi-Fi interface is up.
func wlanUp() bool {
	raw, err := os.ReadFile("/sys/class/net/wlan0/operstate")
	return err == nil && strings.TrimSpace(string(raw)) == "up"
}

// Snapshot is the last pass's snapshot.
func (s *Syncer) Snapshot() *Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.snap
}

// Hold keeps bookID's clone on disk until release is called, while a screen
// reads it (workflow 19: "a song open from it stays readable until Back").
// release is idempotent. Released once the device is no longer paired (its
// session refused while a screen held the book), the clone goes with the
// last hold (reader.pairing Decision 6).
func (s *Syncer) Hold(bookID string) (release func()) {
	s.mu.Lock()
	s.holds[bookID]++
	s.mu.Unlock()
	var once gosync.Once
	return func() {
		once.Do(func() {
			s.mu.Lock()
			defer s.mu.Unlock()
			if s.holds[bookID]--; s.holds[bookID] > 0 {
				return
			}
			delete(s.holds, bookID)
			if _, paired := s.st.Session(); !paired {
				// Nothing to report: the next pass, or the next sign out,
				// removes what this could not.
				_ = s.st.RemoveBook(bookID)
			}
		})
	}
}

// forget forgets the device after the service refused its session: the
// session, the state, the home book and every clone no screen holds, and the
// snapshot. Under mu, so no hold is taken between the list of the held books
// and their removal.
func (s *Syncer) forget() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	held := make([]string, 0, len(s.holds))
	for id := range s.holds {
		held = append(held, id)
	}
	err := s.st.SignOutKeeping(held)
	s.resetLocked()
	return err
}

// resetLocked drops what the syncer knows of the account: the snapshot and
// the books reported gone or empty.
func (s *Syncer) resetLocked() {
	s.snap = emptySnapshot()
	s.gone = map[string]bool{}
	s.empty = map[string]bool{}
}

// SignOut signs the device out (workflow 19 §The shelf, Sign out): it
// cancels the pass in flight and waits for it, asks the service to end the
// session (POST /api/auth/signout, bounded by SignOutTimeout — offline or
// refused, the device signs out all the same), then clears the store of the
// account (the bundle kept) and drops the snapshot. Its error is the store's
// only.
func (s *Syncer) SignOut(ctx context.Context) error {
	s.mu.Lock()
	s.signingOut++
	if s.cancelPass != nil {
		s.cancelPass()
	}
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		s.signingOut--
		s.mu.Unlock()
	}()
	s.passMu.Lock()
	defer s.passMu.Unlock()

	if sess, ok := s.st.Session(); ok {
		if origin, err := parseOrigin(sess.Origin); err == nil {
			cctx, cancel := context.WithTimeout(ctx, s.signOutTimeout)
			a := &api{client: s.opts.HTTPClient, origin: origin, token: sess.Token}
			_ = a.signOut(cctx)
			cancel()
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	err := s.st.SignOut()
	s.resetLocked()
	return err
}

func (s *Syncer) status(st Status) {
	if s.opts.OnStatus != nil {
		s.opts.OnStatus(st)
	}
}

func (s *Syncer) lastSync() time.Time {
	t, _ := s.st.LastSync()
	return t
}

// Pass runs one pass (see the package comment): ErrNotPaired without a
// session, nothing sent; an error wrapping the step otherwise. A pass that
// cannot reach the service changes nothing on disk and keeps the snapshot.
func (s *Syncer) Pass(ctx context.Context) (Result, error) {
	s.passMu.Lock()
	defer s.passMu.Unlock()
	sess, ok := s.st.Session()
	if !ok {
		return Result{}, ErrNotPaired
	}
	origin, err := parseOrigin(sess.Origin)
	if err != nil {
		return Result{}, err
	}
	s.mu.Lock()
	if s.signingOut > 0 {
		// A sign out waits for passMu: this pass gives way.
		s.mu.Unlock()
		return Result{}, ErrNotPaired
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	s.cancelPass = cancel
	online := s.online
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		s.cancelPass = nil
		s.mu.Unlock()
	}()
	s.status(Status{Syncing: true, Online: online, LastSync: s.lastSync()})

	res, err := s.run(ctx, origin, sess.Token)

	end := Status{Online: true, LastSync: s.lastSync()}
	switch {
	case errors.Is(err, errSignedOut):
		end.Error = ErrorSignedOut
		if ferr := s.forget(); ferr != nil {
			err = errors.Join(err, ferr)
		}
	case errors.Is(err, errOffline), errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		end.Online, end.Error = false, ErrorOffline
	}
	s.mu.Lock()
	s.online = end.Online
	s.mu.Unlock()
	s.status(end)
	return res, err
}

// run is a pass's body.
func (s *Syncer) run(ctx context.Context, origin *url.URL, token string) (Result, error) {
	a := &api{client: s.opts.HTTPClient, origin: origin, token: token}
	g := newGitClient(s.opts.HTTPClient, token)
	root := s.st.Root()
	booksDir := filepath.Join(root, "books")
	removeStale(root)
	removeStale(booksDir)

	hb, err := a.getHomeBook(ctx)
	if err != nil {
		return Result{}, err
	}
	res := Result{Books: map[string]BookResult{}}

	// The home book: not in the change check, fetched every pass (Decision 5).
	homeDir := s.st.HomeDir()
	if u, ok := sameOrigin(origin, hb.GitURL); ok {
		res.Home = s.syncRepo(ctx, g, homeBookID, homeDir, filepath.Join(root, tmpClonePrefix+homeBookID), u)
	} else {
		res.Home = result(Refused, headOf(homeDir))
	}
	home := readHome(homeDir)
	shelf := readShelf(home[shelfFile])
	instrErr := s.loadInstrument(ctx, home)
	if !headOf(homeDir).IsZero() {
		if err := s.setAccount(readAuthorName(home[preferencesFile])); err != nil {
			return Result{}, err
		}
	}

	// One change check for the whole shelf.
	local := make(map[string]plumbing.Hash, len(shelf))
	dirs := make(map[string]string, len(shelf))
	heads := make([]shelfHead, 0, len(shelf))
	for _, e := range shelf {
		dir, err := s.st.BookDir(e.ID)
		if err != nil {
			continue // an id that is no safe directory name: refused below
		}
		dirs[e.ID] = dir
		h := headOf(dir)
		local[e.ID] = h
		sh := shelfHead{BookID: e.ID}
		if !h.IsZero() {
			hs := h.String()
			sh.Head = &hs
		}
		heads = append(heads, sh)
	}
	changes := map[string]bookChange{}
	for i := 0; i < len(heads); i += changeCheckMax {
		part, err := a.changeCheck(ctx, heads[i:min(i+changeCheckMax, len(heads))])
		if err != nil {
			return Result{}, err
		}
		for id, c := range part {
			changes[id] = c
		}
	}

	var kept []shelfEntry
	for _, e := range shelf {
		c, reported := changes[e.ID]
		changed := reported && c.Status == "changed"
		s.mu.Lock()
		if reported && c.Status == "gone" {
			s.gone[e.ID] = true
		}
		if changed {
			delete(s.gone, e.ID)
			delete(s.empty, e.ID)
		}
		gone, empty := s.gone[e.ID], s.empty[e.ID]
		s.mu.Unlock()
		if gone {
			res.Books[e.ID] = result(Gone, plumbing.ZeroHash)
			continue
		}
		dir, safe := dirs[e.ID]
		u, same := sameOrigin(origin, e.link)
		if !safe || !same {
			res.Books[e.ID] = result(Refused, local[e.ID])
			kept = append(kept, e)
			continue
		}
		h := local[e.ID]
		switch {
		case h.IsZero() && empty && !changed:
			res.Books[e.ID] = result(Empty, plumbing.ZeroHash)
		case h.IsZero() || (changed && c.Head != h.String()):
			r := s.syncRepo(ctx, g, e.ID, dir, filepath.Join(booksDir, tmpClonePrefix+e.ID), u)
			if r.Status == Empty {
				s.mu.Lock()
				s.empty[e.ID] = true
				s.mu.Unlock()
			}
			res.Books[e.ID] = r
		default:
			res.Books[e.ID] = result(Unchanged, h)
		}
		kept = append(kept, e)
	}

	// Clones of books no longer on the shelf go, unless a screen holds one.
	onShelf := make(map[string]bool, len(kept))
	for _, e := range kept {
		onShelf[e.ID] = true
	}
	ids, err := s.st.BookIDs()
	if err != nil {
		return res, fmt.Errorf("sync: remove: %w", err)
	}
	s.mu.Lock()
	for _, id := range ids {
		if onShelf[id] {
			continue
		}
		if _, ok := res.Books[id]; !ok {
			res.Books[id] = result(Gone, plumbing.ZeroHash)
		}
		if s.holds[id] > 0 {
			continue
		}
		if err := s.st.RemoveBook(id); err != nil {
			s.mu.Unlock()
			return res, fmt.Errorf("sync: remove %s: %w", id, err)
		}
	}
	s.mu.Unlock()

	snap := s.makeSnapshot(home, kept)
	s.mu.Lock()
	s.snap = snap
	s.mu.Unlock()
	if err := s.st.SetLastSync(s.opts.Now()); err != nil {
		return res, err
	}
	return res, instrErr
}

// setAccount keeps name as the session's account — what Settings says it is
// paired with (device_pairing Decision 10) — when it differs; no write
// otherwise.
func (s *Syncer) setAccount(name string) error {
	sess, ok := s.st.Session()
	if !ok || sess.Account == name {
		return nil
	}
	sess.Account = name
	if err := s.st.SetSession(sess); err != nil {
		return fmt.Errorf("sync: account: %w", err)
	}
	return nil
}

func result(status string, head plumbing.Hash) BookResult {
	r := BookResult{Status: status}
	if !head.IsZero() {
		h := head.String()
		r.Head = &h
	}
	return r
}

// syncRepo brings the repository at dir up to date with u: cloned into tmp
// and renamed into place when whole if absent, else fetched in place. A
// failure leaves what was there.
func (s *Syncer) syncRepo(ctx context.Context, g *gitClient, id, dir, tmp string, u *url.URL) BookResult {
	if isClone(dir) {
		repo, err := git.PlainOpen(dir)
		if err != nil {
			return result(Failed, plumbing.ZeroHash)
		}
		before, _ := localHead(repo)
		head, err := g.fetchMain(ctx, repo, u)
		switch {
		case errors.Is(err, errEmpty), err == nil && head == before:
			return result(Unchanged, before)
		case err != nil:
			return result(Failed, before)
		}
		return result(Fetched, head)
	}
	os.RemoveAll(tmp)
	head, err := s.clone(ctx, g, tmp, u)
	if err != nil {
		os.RemoveAll(tmp)
		if errors.Is(err, errEmpty) {
			return result(Empty, plumbing.ZeroHash)
		}
		return result(Failed, plumbing.ZeroHash)
	}
	// The store makes home/ empty at Open; an empty directory gives way.
	os.Remove(dir)
	if err := os.Rename(tmp, dir); err != nil {
		os.RemoveAll(tmp)
		return result(Failed, plumbing.ZeroHash)
	}
	return result(Cloned, head)
}

func (s *Syncer) clone(ctx context.Context, g *gitClient, tmp string, u *url.URL) (plumbing.Hash, error) {
	if err := os.MkdirAll(filepath.Dir(tmp), 0o700); err != nil {
		return plumbing.ZeroHash, err
	}
	repo, err := initBare(tmp)
	if err != nil {
		return plumbing.ZeroHash, err
	}
	return g.fetchMain(ctx, repo, u)
}

// removeStale removes the clones a pass left unfinished in dir.
func removeStale(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), tmpClonePrefix) {
			os.RemoveAll(filepath.Join(dir, e.Name()))
		}
	}
}

// readHome reads the home book's files at main; an empty home book (no
// clone, no main) reads as every file absent.
func readHome(dir string) homeFiles {
	files := homeFiles{}
	head := headOf(dir)
	if head.IsZero() {
		return files
	}
	tree, err := treeAt(dir, head)
	if err != nil {
		return files
	}
	for _, name := range []string{shelfFile, songsFile, instrumentsFile, preferencesFile, shapesFile, defaultShapesFile} {
		if raw, err := readBlob(tree, name); err == nil {
			files[name] = raw
		}
	}
	return files
}

// instrumentFiles are the four files the bundle chooses from, absent or
// malformed as {}.
func instrumentFiles(home homeFiles) engine.InstrumentFiles {
	return engine.InstrumentFiles{
		Instruments:   objectOrEmpty(home[instrumentsFile]),
		Preferences:   objectOrEmpty(home[preferencesFile]),
		Shapes:        objectOrEmpty(home[shapesFile]),
		DefaultShapes: objectOrEmpty(home[defaultShapesFile]),
	}
}

// loadInstrument asks the bundle for the instrument and its table and loads
// them — only when the four files differ from those last loaded, so an
// unchanged home book loads nothing.
func (s *Syncer) loadInstrument(ctx context.Context, home homeFiles) error {
	if s.eng == nil {
		return nil
	}
	files := instrumentFiles(home)
	h := sha256.New()
	for _, raw := range []json.RawMessage{files.Instruments, files.Preferences, files.Shapes, files.DefaultShapes} {
		fmt.Fprintf(h, "%d:", len(raw))
		h.Write(raw)
	}
	digest := hex.EncodeToString(h.Sum(nil))
	s.mu.Lock()
	same := digest == s.loadDigest
	s.mu.Unlock()
	if same {
		return nil
	}
	in, err := s.eng.Instrument(ctx, files)
	if err != nil {
		return fmt.Errorf("sync: instrument: %w", err)
	}
	if _, err := s.eng.Load(ctx, in.Entry, in.Table); err != nil {
		return fmt.Errorf("sync: instrument: %w", err)
	}
	s.mu.Lock()
	s.loadDigest = digest
	s.mu.Unlock()
	return nil
}

// makeSnapshot builds the snapshot of a home book read and its shelf.
func (s *Syncer) makeSnapshot(home homeFiles, shelf []shelfEntry) *Snapshot {
	sn := emptySnapshot()
	sn.songs = readSongs(home[songsFile])
	sn.prefs = objectOrEmpty(home[preferencesFile])
	for _, e := range shelf {
		sn.shelf = append(sn.shelf, e.ShelfBook)
		dir, err := s.st.BookDir(e.ID)
		if err != nil {
			continue
		}
		if h := headOf(dir); !h.IsZero() {
			sn.books[e.ID] = newBook(e.ID, dir, h)
		}
	}
	return sn
}

// diskSnapshot is the snapshot of what the store already holds.
func (s *Syncer) diskSnapshot() *Snapshot {
	home := readHome(s.st.HomeDir())
	return s.makeSnapshot(home, readShelf(home[shelfFile]))
}

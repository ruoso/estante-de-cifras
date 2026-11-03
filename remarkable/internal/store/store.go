// Package store is the reader's one place on disk: the directory under root's
// home that holds the session the device syncs with, the books' clones, the
// app's bundle slots and the reader's own small state (docs/remarkable-reader.md
// §3.2, §5.4, §8, §10).
//
// It holds no git, no HTTP and no music, and never writes to the account. It
// logs nothing; its errors name a file's role and the operation, never a
// stored value or the session token. Every file it writes goes through one
// atomic helper, so a crash or power loss mid-write leaves the previous file.
package store

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// DefaultRoot is where the reader keeps its files on the reMarkable (§3.2).
const DefaultRoot = "/home/root/.local/share/estante"

// The layout under the root.
const (
	sessionFile = "session.json"
	stateFile   = "state.json"
	homeDir     = "home"
	booksDir    = "books"
	bundleDir   = "bundle"
	// tmpPrefix marks a temporary: ignored by every read, removed by Open.
	tmpPrefix = ".tmp-"
)

// The modes the store gives what it makes: directories private to root, and
// the session and state files readable by root alone (§10).
const (
	dirMode  fs.FileMode = 0o700
	fileMode fs.FileMode = 0o600
)

// The store's refusals, for errors.Is.
var (
	// ErrBadID: a book id or a bundle file name that is not a local path.
	ErrBadID = errors.New("store: not a local path element")
	// ErrNoPrevious: a rollback with no last good bundle to return to.
	ErrNoPrevious = errors.New("store: no previous bundle")
	// ErrNoStaged: a promote with no staged bundle.
	ErrNoStaged = errors.New("store: no staged bundle")
)

// Store is the reader's directory. One per process; safe for concurrent use.
type Store struct {
	root string

	mu      sync.Mutex
	session *Session
	state   state
}

// Open makes the root (0700) when absent, removes stray temporaries, reads the
// session and the state, and recovers the bundle slots from an interrupted
// promote or rollback.
func Open(root string) (*Store, error) {
	if err := os.MkdirAll(root, dirMode); err != nil {
		return nil, fmt.Errorf("store: open root: %w", err)
	}
	if err := os.Chmod(root, dirMode); err != nil {
		return nil, fmt.Errorf("store: open root: %w", err)
	}
	if err := removeTemporaries(root); err != nil {
		return nil, fmt.Errorf("store: open root: %w", err)
	}
	s := &Store{root: root}
	if err := s.makeDirs(); err != nil {
		return nil, err
	}
	if err := s.recoverBundle(); err != nil {
		return nil, err
	}
	s.session = readSession(filepath.Join(root, sessionFile))
	s.state = readState(filepath.Join(root, stateFile))
	return s, nil
}

// Root is the directory the store owns.
func (s *Store) Root() string { return s.root }

// makeDirs makes the directories of the layout, each 0700.
func (s *Store) makeDirs() error {
	for _, d := range []string{homeDir, booksDir, bundleDir} {
		if err := os.MkdirAll(filepath.Join(s.root, d), dirMode); err != nil {
			return fmt.Errorf("store: make %s: %w", d, err)
		}
	}
	return nil
}

// HomeDir is where the home book's clone lives. Sync owns what is inside.
func (s *Store) HomeDir() string { return filepath.Join(s.root, homeDir) }

// BookDir is where the clone of the book bookID lives; it makes the parent,
// and refuses an id that is not a single local path element with ErrBadID.
func (s *Store) BookDir(bookID string) (string, error) {
	if !validID(bookID) {
		return "", fmt.Errorf("store: book dir: %w", ErrBadID)
	}
	parent := filepath.Join(s.root, booksDir)
	if err := os.MkdirAll(parent, dirMode); err != nil {
		return "", fmt.Errorf("store: book dir: %w", err)
	}
	return filepath.Join(parent, bookID), nil
}

// BookIDs lists the books whose clones are present, sorted — for sync to drop
// a book no longer shared.
func (s *Store) BookIDs() ([]string, error) {
	entries, err := os.ReadDir(filepath.Join(s.root, booksDir))
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("store: list books: %w", err)
	}
	var ids []string
	for _, e := range entries {
		if e.IsDir() && validID(e.Name()) && !strings.HasPrefix(e.Name(), tmpPrefix) {
			ids = append(ids, e.Name())
		}
	}
	sort.Strings(ids)
	return ids, nil
}

// RemoveBook removes the clone of the book bookID; absent is not an error.
func (s *Store) RemoveBook(bookID string) error {
	dir, err := s.BookDir(bookID)
	if err != nil {
		return err
	}
	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("store: remove book: %w", err)
	}
	return nil
}

// SignOut clears the device of the account: the session, the clones and the
// reader's state go; the bundle slots — the app's code, not the account's —
// stay (§2.1 step 6; workflow 19 §The shelf).
func (s *Store) SignOut() error { return s.SignOutKeeping(nil) }

// SignOutKeeping is SignOut, except that the clones of the books in keep —
// the ones a screen holds open — stay until the caller removes them
// (RemoveBook) once let go (reader.pairing Decision 6: a session the service
// refuses, with a song on screen).
func (s *Store) SignOutKeeping(keep []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, f := range []string{sessionFile, stateFile} {
		if err := os.Remove(filepath.Join(s.root, f)); err != nil && !errors.Is(err, fs.ErrNotExist) {
			return fmt.Errorf("store: sign out: %w", err)
		}
	}
	s.session = nil
	s.state = newState()
	if err := os.RemoveAll(filepath.Join(s.root, homeDir)); err != nil {
		return fmt.Errorf("store: sign out: %w", err)
	}
	if err := s.removeBooksExcept(keep); err != nil {
		return err
	}
	if err := s.makeDirs(); err != nil {
		return err
	}
	if err := syncDir(s.root); err != nil {
		return fmt.Errorf("store: sign out: %w", err)
	}
	return nil
}

// removeBooksExcept removes books/ whole, or — when keep names any — every
// entry of it but the kept clones.
func (s *Store) removeBooksExcept(keep []string) error {
	dir := filepath.Join(s.root, booksDir)
	if len(keep) == 0 {
		if err := os.RemoveAll(dir); err != nil {
			return fmt.Errorf("store: sign out: %w", err)
		}
		return nil
	}
	kept := make(map[string]bool, len(keep))
	for _, id := range keep {
		if validID(id) {
			kept[id] = true
		}
	}
	entries, err := os.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("store: sign out: %w", err)
	}
	for _, e := range entries {
		if kept[e.Name()] {
			continue
		}
		if err := os.RemoveAll(filepath.Join(dir, e.Name())); err != nil {
			return fmt.Errorf("store: sign out: %w", err)
		}
	}
	return syncDir(dir)
}

// validID reports whether id is one local path element, safe as a directory
// name under the root (Decision 9).
func validID(id string) bool {
	return id != "" && id != "." && id != ".." &&
		!strings.ContainsAny(id, `/\`) && filepath.IsLocal(id)
}

// removeTemporaries removes the .tmp-* entries a crash left in dir.
func removeTemporaries(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), tmpPrefix) {
			if err := os.RemoveAll(filepath.Join(dir, e.Name())); err != nil {
				return err
			}
		}
	}
	return nil
}

// The seams the torn-write test replaces (Decision 11).
var (
	writeData  = func(f *os.File, b []byte) (int, error) { return f.Write(b) }
	renameFile = os.Rename
)

// writeAtomic replaces dir/name with data: a temporary in the same directory,
// given the final mode before any byte is written, synced, closed, renamed
// over the target, then the directory synced. On any failure the temporary is
// removed and the previous file is left untouched. role names the file in the
// error, which never carries data.
func writeAtomic(dir, name string, data []byte, mode fs.FileMode, role string) (err error) {
	f, err := os.CreateTemp(dir, tmpPrefix+"*")
	if err != nil {
		return fmt.Errorf("store: write %s: %w", role, err)
	}
	tmp := f.Name()
	defer func() {
		if err != nil {
			f.Close()
			os.Remove(tmp)
			err = fmt.Errorf("store: write %s: %w", role, err)
		}
	}()
	if err = f.Chmod(mode); err != nil {
		return err
	}
	if _, err = writeData(f, data); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = renameFile(tmp, filepath.Join(dir, name)); err != nil {
		return err
	}
	return syncDir(dir)
}

// syncDir makes a rename in dir durable.
func syncDir(dir string) error {
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

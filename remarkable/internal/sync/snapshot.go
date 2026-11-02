package sync

// What the screens read (Decision 3): an immutable snapshot of one pass — the
// shelf, the songs' reading state, the preferences, and each book at the head
// the pass left it at. A later pass makes a new snapshot and never changes an
// earlier one: a fetch moves main and adds objects, but the snapshot keeps the
// commit it was made from, and the bare clone never prunes, so the song on
// screen keeps its version (workflow 19 §When something has changed).

import (
	"encoding/json"
	"errors"
	gosync "sync"

	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"golang.org/x/text/unicode/norm"
)

// ErrNoBook is Book.Read's answer when the book's clone is gone (removed
// while no screen held it).
var ErrNoBook = errors.New("sync: book unreadable")

// Snapshot is one pass's view of the shelf. Its methods are safe from any
// goroutine; nothing a later pass does changes what it answers.
type Snapshot struct {
	shelf []ShelfBook
	songs map[string]SongState
	prefs json.RawMessage
	books map[string]*Book
}

func emptySnapshot() *Snapshot {
	return &Snapshot{songs: map[string]SongState{}, prefs: emptyObject, books: map[string]*Book{}}
}

// Shelf is the books in shelf order.
func (sn *Snapshot) Shelf() []ShelfBook {
	return append([]ShelfBook(nil), sn.shelf...)
}

// Songs is the saved reading state of the song ref `<book-id>/<path>`
// (format §2.3, §4.5), found by its NFC form; false when none is saved.
func (sn *Snapshot) Songs(ref string) (SongState, bool) {
	st, ok := sn.songs[norm.NFC.String(ref)]
	if !ok {
		return SongState{}, false
	}
	c := SongState{Transposition: st.Transposition}
	if st.Variation != nil {
		c.Variation = make(map[string]string, len(st.Variation))
		for k, v := range st.Variation {
			c.Variation[k] = v
		}
	}
	return c, true
}

// Preferences is preferences.json's map as read, raw, for the engine's sheet
// ({} when absent).
func (sn *Snapshot) Preferences() json.RawMessage {
	return append(json.RawMessage(nil), sn.prefs...)
}

// Book is the book bookID at the snapshot's head, nil when the snapshot has
// none of it (not on the shelf, or no clone yet).
func (sn *Snapshot) Book(bookID string) *Book {
	return sn.books[bookID]
}

// Book is one book's clone read at one commit.
type Book struct {
	id   string
	dir  string
	head plumbing.Hash

	mu   gosync.Mutex
	tree *object.Tree
}

func newBook(id, dir string, head plumbing.Hash) *Book {
	return &Book{id: id, dir: dir, head: head}
}

// ID is the book's id.
func (b *Book) ID() string { return b.id }

// Head is the commit the snapshot reads the book at.
func (b *Book) Head() string { return b.head.String() }

// treeLocked opens the tree at the head once.
func (b *Book) treeLocked() (*object.Tree, error) {
	if b.tree != nil {
		return b.tree, nil
	}
	t, err := treeAt(b.dir, b.head)
	if err != nil {
		return nil, ErrNoBook
	}
	b.tree = t
	return t, nil
}

// Paths lists every blob path at the head, sorted.
func (b *Book) Paths() ([]string, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	t, err := b.treeLocked()
	if err != nil {
		return nil, err
	}
	paths, err := blobPaths(t)
	if err != nil {
		return nil, ErrNoBook
	}
	return paths, nil
}

// Read reads the file at path at the head.
func (b *Book) Read(path string) ([]byte, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	t, err := b.treeLocked()
	if err != nil {
		return nil, err
	}
	raw, err := readBlob(t, path)
	if errors.Is(err, object.ErrFileNotFound) {
		return nil, err
	}
	if err != nil {
		return nil, ErrNoBook
	}
	return raw, nil
}

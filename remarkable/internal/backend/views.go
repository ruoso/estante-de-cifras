package backend

// The views (reader.backend_views; docs/remarkable-reader.md §3.2, §6 "What
// the backend answers"): each open is answered with its view, read from the
// last sync's snapshot, the engine and the store; the person's choices at the
// stand (a key, the place in a setlist, a voicing hidden or shown, shapes
// shown) are kept in the store and answered with what they redraw.
//
// All the music — keys, offsets, key names, shapes, frets, diagram models,
// a setlist's items and keys — is the engine's (the web app's own code in
// goja); nothing here keeps a music rule. The book screen's listing (titles,
// artists, setlist titles and counts) is read with cifra.md's Go
// implementation, the format's, memoised per (book, head).
//
// The views run on Serve's loop goroutine, one message at a time, and log
// nothing: paths and titles travel only in the payloads to the frontend.

import (
	"context"
	"errors"
	"sort"
	"strings"

	cifra "github.com/ruoso/cifra.md/go"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/protocol"
	"estantedecifras.app/remarkable/internal/store"
	"estantedecifras.app/remarkable/internal/sync"
)

// Engine is what the views need of the engine (*engine.Engine satisfies it):
// a song's sheet and a setlist's items.
type Engine interface {
	Sheet(ctx context.Context, text string, offset int, opts engine.SheetOptions) (engine.Sheet, error)
	Setlist(ctx context.Context, text, setlistPath string, bookPaths []string) (engine.Setlist, error)
}

// The file kinds a book holds (the web app's search index: songs are
// *.cifra.md, setlists *.setlist.md).
const (
	songSuffix    = ".cifra.md"
	setlistSuffix = ".setlist.md"
)

// errNoView is an open (or a redraw) that cannot be answered as asked; the
// views then answer the nearest view that can be (Constraint 8).
var errNoView = errors.New("backend: view unanswerable")

// views is the views' state: the current context (the book on screen, its
// snapshot and hold, the open song) and the book listings read so far.
type views struct {
	ctx   context.Context
	conn  *protocol.Conn
	relay *Relay
	st    *store.Store
	sync  Syncer
	eng   Engine
	ver   string
	// onParse is told of each file the book listing parses (a test seam).
	onParse func()

	cur      *viewContext
	listings map[listingKey]listing
}

// viewContext is the view on screen within one book: the snapshot it was read
// from, the hold on its clone, and the open song when there is one.
type viewContext struct {
	bookID  string
	snap    *sync.Snapshot
	release func()
	song    *openSong
	// playing is the setlist being played whose version (snap) is kept until
	// an open leaves Play; "" when not playing.
	playing string
}

// openSong is the song on screen: its path, the open's one-off offset (nil
// when none), the Play it was opened in (nil when none), and whether that
// Play's target key still applies (a key chosen during Play drops it).
type openSong struct {
	path      string
	oneOff    *int
	play      *protocol.PlayAt
	useTarget bool
}

type listingKey struct{ bookID, head string }

// listing is a book's songs and setlists, sorted by path.
type listing struct {
	songs    []protocol.BookSong
	setlists []protocol.BookSetlist
}

func newViews(ctx context.Context, conn *protocol.Conn, relay *Relay, b Deps) *views {
	return &views{
		ctx: ctx, conn: conn, relay: relay,
		st: b.Store, sync: b.Syncer, eng: b.Engine, ver: b.Version,
		onParse:  b.onParse,
		listings: map[listingKey]listing{},
	}
}

// close releases the hold of the view on screen, when there is one.
func (v *views) close() { v.leave() }

// leave drops the current context, releasing its hold exactly once.
func (v *views) leave() {
	if v.cur != nil {
		v.cur.release()
		v.cur = nil
	}
}

// handle answers one view message. It returns only the connection's errors;
// anything else answers the nearest view, or nothing.
func (v *views) handle(m protocol.Message) error {
	switch m := m.(type) {
	case protocol.Open:
		return v.open(m)
	case protocol.Key:
		return v.key(m)
	case protocol.HideShape:
		return v.voicing(func() error { return v.st.Hide(store.Voicing(m)) })
	case protocol.ShowShape:
		return v.voicing(func() error { return v.st.Show(store.Voicing(m)) })
	case protocol.ShowAllShapes:
		return v.voicing(v.st.ShowAll)
	case protocol.ShapesShown:
		if v.st.SetShapesShown(m.Shown) != nil {
			return nil
		}
		return v.relay.sendState(v.conn)
	case protocol.Place:
		// Kept so Back returns to it; the frontend already shows the song.
		_ = v.st.SetPlace(m.BookID, m.Setlist, m.At)
		return nil
	}
	return nil
}

// --- open ---

func (v *views) open(o protocol.Open) error {
	switch o.View {
	case protocol.ViewShelf:
		v.leave()
		return v.conn.Write(v.shelf())
	case protocol.ViewSettings:
		v.leave()
		return v.conn.Write(v.settings())
	case protocol.ViewBook, protocol.ViewSong, protocol.ViewSetlist:
	default:
		return nil
	}
	if o.BookID == "" {
		return v.answerShelf()
	}
	playing := o.View == protocol.ViewSong && o.Play != nil
	snap := v.enter(o.BookID, playing, o)
	if snap == nil {
		return v.answerShelf()
	}
	switch o.View {
	case protocol.ViewSong:
		v.cur.song = &openSong{path: o.Path, oneOff: o.Offset, play: o.Play, useTarget: o.Play != nil}
		if playing {
			v.cur.playing = o.Play.Setlist
		}
		sheet, err := v.sheet()
		if err != nil {
			return v.answerBook()
		}
		return v.conn.Write(sheet)
	case protocol.ViewSetlist:
		set, err := v.setlist(o.Path)
		if err != nil {
			return v.answerBook()
		}
		return v.conn.Write(set)
	}
	return v.answerBook()
}

// enter makes bookID the current context for an open and answers the
// snapshot to read it from (nil when no snapshot has the book): the latest,
// taken under a hold — except the held one while playing the same setlist
// (Play keeps its version until Back), or when only the held one still has
// the book (a song from a book gone stays readable until Back).
func (v *views) enter(bookID string, playing bool, o protocol.Open) *sync.Snapshot {
	cur := v.cur
	if cur != nil && cur.bookID == bookID {
		cur.song = nil
		if playing && cur.playing != "" && cur.playing == o.Play.Setlist {
			return cur.snap
		}
		cur.playing = ""
		if latest := v.sync.Snapshot(); latest != nil && latest.Book(bookID) != nil {
			cur.snap = latest
		}
		// Otherwise the held snapshot, which has the book.
		return cur.snap
	}
	release := v.sync.Hold(bookID)
	latest := v.sync.Snapshot()
	v.leave()
	if latest == nil || latest.Book(bookID) == nil {
		release()
		return nil
	}
	v.cur = &viewContext{bookID: bookID, snap: latest, release: release}
	return latest
}

// answerBook answers the current context's book, else the shelf.
func (v *views) answerBook() error {
	if v.cur != nil {
		v.cur.song, v.cur.playing = nil, ""
		if b, err := v.book(); err == nil {
			return v.conn.Write(b)
		}
	}
	return v.answerShelf()
}

// answerShelf leaves the current context and answers the shelf.
func (v *views) answerShelf() error {
	v.leave()
	return v.conn.Write(v.shelf())
}

// --- the shelf, a book, settings ---

// shelf is 103: each book on the latest shelf that has a clone, in shelf
// order, with its label and its counts of songs and setlists (no file
// parsed).
func (v *views) shelf() protocol.Shelf {
	out := protocol.Shelf{Books: []protocol.ShelfBook{}}
	snap := v.sync.Snapshot()
	if snap == nil {
		return out
	}
	for _, sb := range snap.Shelf() {
		b := snap.Book(sb.ID)
		if b == nil {
			continue
		}
		paths, err := b.Paths()
		if err != nil {
			continue
		}
		e := protocol.ShelfBook{BookID: sb.ID, Title: sb.Label}
		for _, p := range paths {
			switch {
			case strings.HasSuffix(p, songSuffix):
				e.Songs++
			case strings.HasSuffix(p, setlistSuffix):
				e.Setlists++
			}
		}
		out.Books = append(out.Books, e)
	}
	return out
}

// settings is 107: the account paired with, the reader's version, and how
// many voicings are hidden.
func (v *views) settings() protocol.Settings {
	sess, _ := v.st.Session()
	return protocol.Settings{Account: sess.Account, Version: v.ver, HiddenShapes: v.st.HiddenCount()}
}

// label is bookID's shelf label in snap ("" when none: the frontend words
// Untitled book).
func label(snap *sync.Snapshot, bookID string) string {
	for _, sb := range snap.Shelf() {
		if sb.ID == bookID {
			return sb.Label
		}
	}
	return ""
}

// book is 104 for the current context: its setlists, then its songs, each by
// path, with the titles and artists read with cifra.md/go.
func (v *views) book() (protocol.Book, error) {
	c := v.cur
	b := c.snap.Book(c.bookID)
	if b == nil {
		return protocol.Book{}, errNoView
	}
	l, err := v.listing(b)
	if err != nil {
		return protocol.Book{}, err
	}
	return protocol.Book{
		BookID:   c.bookID,
		Title:    label(c.snap, c.bookID),
		Songs:    append([]protocol.BookSong{}, l.songs...),
		Setlists: append([]protocol.BookSetlist{}, l.setlists...),
	}, nil
}

// listing reads a book's listing at its head, once per (book, head).
func (v *views) listing(b *sync.Book) (listing, error) {
	key := listingKey{b.ID(), b.Head()}
	if l, ok := v.listings[key]; ok {
		return l, nil
	}
	paths, err := b.Paths()
	if err != nil {
		return listing{}, errNoView
	}
	// Code point by code point, as the web app's book page lists them; for
	// UTF-8, byte order is code point order.
	sort.Strings(paths)
	l := listing{songs: []protocol.BookSong{}, setlists: []protocol.BookSetlist{}}
	for _, p := range paths {
		switch {
		case strings.HasSuffix(p, songSuffix):
			s := protocol.BookSong{Path: p}
			if raw, err := b.Read(p); err == nil {
				s.Title, s.Artist = v.songHeader(raw)
			}
			l.songs = append(l.songs, s)
		case strings.HasSuffix(p, setlistSuffix):
			s := protocol.BookSetlist{Path: p}
			if raw, err := b.Read(p); err == nil {
				s.Title, s.Songs = v.setlistHeader(raw)
			}
			l.setlists = append(l.setlists, s)
		}
	}
	v.listings[key] = l
	return l, nil
}

func (v *views) parsed() {
	if v.onParse != nil {
		v.onParse()
	}
}

// songHeader is a song's title and its artist property ("" when absent or
// unreadable).
func (v *views) songHeader(raw []byte) (title, artist string) {
	v.parsed()
	m, err := cifra.Parse(raw)
	if err != nil || m == nil {
		return "", ""
	}
	title = str(m, "title")
	if props, ok := m.Get("properties"); ok {
		list, _ := props.([]any)
		for _, p := range list {
			if o, ok := p.(*cifra.Object); ok && str(o, "key") == "artist" {
				artist = str(o, "value")
				break
			}
		}
	}
	return title, artist
}

// setlistHeader is a setlist's title and its count of song and unlinked items
// (the web app's setlist list).
func (v *views) setlistHeader(raw []byte) (title string, songs int) {
	v.parsed()
	m, err := cifra.ParseSetlist(raw)
	if err != nil || m == nil {
		return "", 0
	}
	if body, ok := m.Get("body"); ok {
		list, _ := body.([]any)
		for _, el := range list {
			if o, ok := el.(*cifra.Object); ok {
				if t := str(o, "type"); t == "song" || t == "unlinked" {
					songs++
				}
			}
		}
	}
	return str(m, "title"), songs
}

// str is o's string field name, or "".
func str(o *cifra.Object, name string) string {
	v, _ := o.Get(name)
	s, _ := v.(string)
	return s
}

// --- a song ---

// sheet is 105 for the open song of the current context, read from its
// snapshot.
func (v *views) sheet() (protocol.Sheet, error) {
	c := v.cur
	if c == nil || c.song == nil || v.eng == nil {
		return protocol.Sheet{}, errNoView
	}
	b := c.snap.Book(c.bookID)
	if b == nil {
		return protocol.Sheet{}, errNoView
	}
	song := c.song
	raw, err := b.Read(song.path)
	if err != nil {
		return protocol.Sheet{}, errNoView
	}

	// The song's offset (Constraint 2): the open's one-off, else the device's
	// key, else the account's saved transposition, else as written; played,
	// at the setlist's key (the bundle reads a keyless song at this offset,
	// with the key as a note).
	offset := 0
	opts := engine.SheetOptions{Preferences: c.snap.Preferences()}
	if saved, ok := c.snap.Songs(c.bookID + "/" + song.path); ok {
		offset = saved.Transposition
		t := saved.Transposition
		opts.SavedOffset = &t
		opts.Variations = saved.Variation
	}
	if k, ok := v.st.Key(c.bookID, song.path); ok {
		offset = k
	}
	var play *protocol.SheetPlay
	if song.play != nil {
		target, p, err := v.play(b, *song.play)
		if err == nil {
			play = p
			if song.useTarget && song.oneOff == nil {
				opts.TargetKey = target
			}
		}
	}
	if song.oneOff != nil {
		offset = *song.oneOff
	}

	s, err := v.eng.Sheet(v.ctx, string(raw), offset, opts)
	if err != nil {
		return protocol.Sheet{}, errNoView
	}
	out := protocol.Sheet{
		BookID:   c.bookID,
		Path:     song.path,
		Title:    deref(s.Title),
		Artist:   deref(s.Artist),
		Key:      protocol.SheetKey{Written: s.Key.Written, Named: s.Key.Named, Saved: s.Key.Saved, Choices: keyChoices(s.Key.Choices)},
		Offset:   s.Offset,
		TuningID: s.TuningID,
		Rows:     s.Rows,
		Shapes:   make([]protocol.SheetShape, 0, len(s.Shapes)),
		Notes:    s.Notes,
		KeyNote:  s.KeyNote,
		Play:     play,
	}
	for _, sh := range s.Shapes {
		if sh.Pending {
			// Its place kept in the strip, drawn empty (§4.1).
			out.Shapes = append(out.Shapes, protocol.SheetShape{Chord: sh.Key, Symbol: sh.Symbol, Model: nullJSON})
			continue
		}
		frets := sh.Frets
		out.Shapes = append(out.Shapes, protocol.SheetShape{
			Chord:  sh.Key,
			Symbol: sh.Symbol,
			Frets:  &frets,
			Model:  sh.Diagram,
			Hidden: v.st.Hidden(store.Voicing{TuningID: s.TuningID, Chord: sh.Key, Frets: frets}),
		})
	}
	return out, nil
}

var nullJSON = []byte("null")

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// play reads the setlist a song is played from (from the same snapshot) and
// answers the item's key, the target, and the sheet's play: the item, how
// many are playable, and the next playable item.
func (v *views) play(b *sync.Book, at protocol.PlayAt) (string, *protocol.SheetPlay, error) {
	raw, err := b.Read(at.Setlist)
	if err != nil {
		return "", nil, errNoView
	}
	paths, err := b.Paths()
	if err != nil {
		return "", nil, errNoView
	}
	set, err := v.eng.Setlist(v.ctx, string(raw), at.Setlist, paths)
	if err != nil {
		return "", nil, errNoView
	}
	for i, it := range set.Items {
		if it.At != at.At {
			continue
		}
		p := &protocol.SheetPlay{Setlist: at.Setlist, At: at.At, Of: len(set.Items)}
		if i+1 < len(set.Items) {
			n := set.Items[i+1]
			p.Next = &protocol.NextItem{Title: n.Title, Key: n.Key, Note: n.Note}
		}
		return deref(it.Key), p, nil
	}
	return "", nil, errNoView
}

// --- a setlist ---

// setlist is 106: every item in order, as the engine lists it, and the place
// kept for Back.
func (v *views) setlist(path string) (protocol.Setlist, error) {
	c := v.cur
	if v.eng == nil {
		return protocol.Setlist{}, errNoView
	}
	b := c.snap.Book(c.bookID)
	if b == nil {
		return protocol.Setlist{}, errNoView
	}
	raw, err := b.Read(path)
	if err != nil {
		return protocol.Setlist{}, errNoView
	}
	paths, err := b.Paths()
	if err != nil {
		return protocol.Setlist{}, errNoView
	}
	set, err := v.eng.Setlist(v.ctx, string(raw), path, paths)
	if err != nil {
		return protocol.Setlist{}, errNoView
	}
	out := protocol.Setlist{
		BookID: c.bookID,
		Path:   path,
		Title:  deref(set.Title),
		Items:  make([]protocol.SetlistItem, 0, len(set.Rows)),
	}
	for _, r := range set.Rows {
		out.Items = append(out.Items, protocol.SetlistItem{
			Path: deref(r.Path), Title: r.Title, Key: r.Key, Note: r.Note, Missing: r.Missing,
		})
	}
	if at, ok := v.st.Place(c.bookID, path); ok {
		out.At = &at
	}
	return out, nil
}

// --- the choices at the stand ---

// key keeps the key chosen for the open song and answers it redrawn from the
// same snapshot; the open's one-off offset and Play's target no longer apply.
func (v *views) key(k protocol.Key) error {
	c := v.cur
	if c == nil || c.song == nil {
		return nil
	}
	if v.st.SetKey(c.bookID, c.song.path, k.Offset) != nil {
		return nil
	}
	c.song.oneOff, c.song.useTarget = nil, false
	return v.redraw()
}

// voicing applies a hide or show and answers the redrawn sheet when a song is
// on screen, else settings.
func (v *views) voicing(apply func() error) error {
	if apply() != nil {
		return nil
	}
	if v.cur == nil || v.cur.song == nil {
		return v.conn.Write(v.settings())
	}
	return v.redraw()
}

// redraw answers the open song again from its snapshot, or the nearest view.
func (v *views) redraw() error {
	sheet, err := v.sheet()
	if err != nil {
		return v.answerBook()
	}
	return v.conn.Write(sheet)
}

// keyChoices carries the engine's key grid through unchanged (design §6 105
// `key.choices`), an empty list rather than null when there are none.
func keyChoices(in []engine.KeyChoice) []protocol.KeyChoice {
	out := make([]protocol.KeyChoice, 0, len(in))
	for _, c := range in {
		out = append(out, protocol.KeyChoice{Name: c.Name, Offset: c.Offset})
	}
	return out
}

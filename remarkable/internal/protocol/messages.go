package protocol

// The reader's message table (docs/remarkable-reader.md §6): one Go type per
// row, its JSON field names exactly as §6 writes them. Rows, notes and a
// shape's diagram model are json.RawMessage, passed through untouched — the
// frontend draws chartRows exactly as the web app's chart receives them.

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
)

// The message types of §6. 1–15 go to the backend, 101–109 to the frontend.
const (
	TypeHello         int32 = 1
	TypeOpen          int32 = 2
	TypeKey           int32 = 3
	TypeSync          int32 = 4
	TypePair          int32 = 5
	TypeSignOut       int32 = 6
	TypeHideShape     int32 = 7
	TypeShowShape     int32 = 8
	TypeShowAllShapes int32 = 9
	TypeShapesShown   int32 = 10
	TypePlace         int32 = 11
	TypeInstrument    int32 = 12
	TypeVariation     int32 = 13
	TypeChordNames    int32 = 14
	TypeTextSize      int32 = 15

	TypeState    int32 = 101
	TypePairing  int32 = 102
	TypeShelf    int32 = 103
	TypeBook     int32 = 104
	TypeSheet    int32 = 105
	TypeSetlist  int32 = 106
	TypeSettings int32 = 107
	TypeShapes   int32 = 108
	TypeAhead    int32 = 109
)

// Message is one value of the table, or one of AppLoad's system messages.
type Message interface {
	Type() int32
}

// --- AppLoad's system messages ---

// Terminate is AppLoad's −1: the backend is to stop (payload "close").
type Terminate struct{}

// Attached is AppLoad's −2: a frontend attached; Frontends is how many are
// attached now.
type Attached struct{ Frontends int }

// Detached is AppLoad's −3: a frontend detached; Frontends is how many are
// still attached.
type Detached struct{ Frontends int }

func (Terminate) Type() int32 { return TypeTerminate }
func (Attached) Type() int32  { return TypeAttached }
func (Detached) Type() int32  { return TypeDetached }

// --- To the backend ---

// Hello (1): the frontend attached; the backend answers with State.
type Hello struct {
	// Screens is the frontend's own build stamp (its build.js), "" for
	// screens not built by tools/appfolder.
	Screens string `json:"screens,omitempty"`
}

// The views Open asks for.
const (
	ViewShelf    = "shelf"
	ViewBook     = "book"
	ViewSong     = "song"
	ViewSetlist  = "setlist"
	ViewSettings = "settings"
)

// Open (2) asks for a view. BookID for book, song and setlist; Path for song
// and setlist; Offset (optional) and Play (optional) for a song.
type Open struct {
	View   string  `json:"view"`
	BookID string  `json:"bookId,omitempty"`
	Path   string  `json:"path,omitempty"`
	Offset *int    `json:"offset,omitempty"`
	Play   *PlayAt `json:"play,omitempty"`
}

// PlayAt is the setlist a song is opened playing (its path in the book) and
// the item's index.
type PlayAt struct {
	Setlist string `json:"setlist"`
	At      int    `json:"at"`
}

// Key (3) chooses a key for the open song; a nil Offset ({"offset":null}) is
// As written chosen, the device's choice forgotten.
type Key struct {
	Offset *int `json:"offset"`
}

// Sync (4): Sync now.
type Sync struct{}

// Pair (5): begin pairing, or Get a new code.
type Pair struct{}

// SignOut (6).
type SignOut struct{}

// Voicing names a voicing to hide or show: the tuning, the chord's identity
// (the engine's Shape.key) and the frets — the frets, not the spelling.
type Voicing struct {
	TuningID string `json:"tuningId"`
	Chord    string `json:"chord"`
	Frets    string `json:"frets"`
}

// HideShape (7): hide this voicing in every song.
type HideShape Voicing

// ShowShape (8): show one hidden voicing again.
type ShowShape Voicing

// ShowAllShapes (9): Show all again.
type ShowAllShapes struct{}

// ShapesShown (10): Hide shapes / Show shapes, for every song.
type ShapesShown struct {
	Shown bool `json:"shown"`
}

// Place (11): the setlist item being played, kept so Back returns to it;
// while playing that setlist, an item other than the open song becomes the
// open song, and its neighbours are sent as Ahead (reader.play).
type Place struct {
	BookID  string `json:"bookId"`
	Setlist string `json:"setlist"`
	At      int    `json:"at"`
}

// Instrument (12): read with this instrument (an id the 107 settings
// listed), on this reader only; nil follows the account's in use again
// (workflow 19 §Settings).
type Instrument struct {
	ID *string `json:"id"`
}

// Variation (13): read the open song with this variation of its tuning (one
// the 105 sheet listed; "" the unnamed block), on this reader only; nil
// follows the account's (songs.json) again (workflow 19 §A song).
type Variation struct {
	Variation *string `json:"variation"`
}

func (Instrument) Type() int32 { return TypeInstrument }
func (Variation) Type() int32  { return TypeVariation }

// ChordNames (14): name the chart's chords "written" or "voiced", on this
// reader only; nil follows the account's chordNames again (workflow 19
// §Settings).
type ChordNames struct {
	Value *string `json:"value"`
}

func (ChordNames) Type() int32 { return TypeChordNames }

// TextSize (15): the chart's text size in points (one the reader offers), on
// this reader only; nil is the standard again (workflow 19 §Settings).
// Answered with 101, whose textSize the frontend lays its screens out at.
type TextSize struct {
	Value *int `json:"value"`
}

func (TextSize) Type() int32 { return TypeTextSize }

func (Hello) Type() int32         { return TypeHello }
func (Open) Type() int32          { return TypeOpen }
func (Key) Type() int32           { return TypeKey }
func (Sync) Type() int32          { return TypeSync }
func (Pair) Type() int32          { return TypePair }
func (SignOut) Type() int32       { return TypeSignOut }
func (HideShape) Type() int32     { return TypeHideShape }
func (ShowShape) Type() int32     { return TypeShowShape }
func (ShowAllShapes) Type() int32 { return TypeShowAllShapes }
func (ShapesShown) Type() int32   { return TypeShapesShown }
func (Place) Type() int32         { return TypePlace }

// --- To the frontend ---

// The word codes State.Error carries; the words the person reads are the
// frontend's.
const (
	ErrorOffline   = "offline"
	ErrorSignedOut = "signedOut"
)

// State (101): the reader's status. LastSync is an RFC 3339 time, or nil
// before the first sync.
type State struct {
	Paired      bool    `json:"paired"`
	Syncing     bool    `json:"syncing"`
	Online      bool    `json:"online"`
	LastSync    *string `json:"lastSync"`
	ShapesShown bool    `json:"shapesShown"`
	Error       string  `json:"error,omitempty"`
	// TextSize is the chart's text size in points chosen on this reader, 0
	// for the standard (the frontend lays its screens out at it).
	TextSize int `json:"textSize,omitempty"`
	// Screens is the build stamp of the screens in the AppLoad folder (its
	// manifest.json): a frontend whose own differs is a stale cache, and
	// reloads AppLoad's list and relaunches. "" when unknown, or when a
	// reload did not bring them (design §8).
	Screens string `json:"screens,omitempty"`
}

// Pairing (102): the code to enter, its address and when it expires; or
// Expired; or Offline.
type Pairing struct {
	Code      string `json:"code,omitempty"`
	URL       string `json:"url,omitempty"`
	ExpiresAt string `json:"expiresAt,omitempty"`
	Expired   bool   `json:"expired,omitempty"`
	Offline   bool   `json:"offline,omitempty"`
}

// Shelf (103): the books, in shelf order.
type Shelf struct {
	Books []ShelfBook `json:"books"`
}

// ShelfBook is one book on the shelf, with its counts of songs and setlists.
type ShelfBook struct {
	BookID   string `json:"bookId"`
	Title    string `json:"title"`
	Songs    int    `json:"songs"`
	Setlists int    `json:"setlists"`
}

// Book (104): a book's songs and setlists.
type Book struct {
	BookID   string        `json:"bookId"`
	Title    string        `json:"title"`
	Songs    []BookSong    `json:"songs"`
	Setlists []BookSetlist `json:"setlists"`
}

// BookSong is one song of a book.
type BookSong struct {
	Path   string `json:"path"`
	Title  string `json:"title"`
	Artist string `json:"artist"`
}

// BookSetlist is one setlist of a book, with its count of songs.
type BookSetlist struct {
	Path  string `json:"path"`
	Title string `json:"title"`
	Songs int    `json:"songs"`
}

// Sheet (105): one song read at one key. Shapes carries every shape of the
// song, each marked Hidden or not: the frontend lays the pages out.
type Sheet struct {
	BookID   string          `json:"bookId"`
	Path     string          `json:"path"`
	Title    string          `json:"title"`
	Artist   string          `json:"artist"`
	Key      SheetKey        `json:"key"`
	Offset   int             `json:"offset"`
	TuningID string          `json:"tuningId"`
	Rows     json.RawMessage `json:"rows"`
	Shapes   []SheetShape    `json:"shapes"`
	Notes    json.RawMessage `json:"notes"`
	KeyNote  *string         `json:"keyNote"`
	Play     *SheetPlay      `json:"play,omitempty"`
	// The song's variations for TuningID ("" the unnamed block) and the one
	// read; VariationChosen when this reader chose it (else it is the
	// account's, or the first). None for a song with fewer than two.
	Variations      []string `json:"variations,omitempty"`
	Variation       *string  `json:"variation,omitempty"`
	VariationChosen bool     `json:"variationChosen,omitempty"`
}

// SheetKey is the song's key as written, as named now, the account's saved
// key (songs.json) when it has one, and the key grid's twelve choices, in the
// order the grid draws them (empty for a song with no chords). A keyless song
// has no written key.
type SheetKey struct {
	Written *string     `json:"written"`
	Named   *string     `json:"named"`
	Saved   *string     `json:"saved"`
	Choices []KeyChoice `json:"choices"`
}

// KeyChoice is one key of the grid: its name and the offset `3 key` sends
// for it.
type KeyChoice struct {
	Name   string `json:"name"`
	Offset int    `json:"offset"`
}

// SheetShape is one shape of the strip: the chord's identity, its symbol, its
// frets, its diagram model (raw, §7) and whether it is hidden. A chord the
// cache did not hold keeps its place with Frets nil and Model null (§4.1).
type SheetShape struct {
	Chord  string          `json:"chord"`
	Symbol string          `json:"symbol"`
	Frets  *string         `json:"frets"`
	Model  json.RawMessage `json:"model"`
	Hidden bool            `json:"hidden"`
}

// SheetPlay is a played song's place: the setlist, the item's index, how many
// items, and the next item (nil at the last).
type SheetPlay struct {
	Setlist string    `json:"setlist"`
	At      int       `json:"at"`
	Of      int       `json:"of"`
	Next    *NextItem `json:"next"`
}

// NextItem is the item after the playing one: its title, key and note.
type NextItem struct {
	Title string  `json:"title"`
	Key   *string `json:"key"`
	Note  *string `json:"note"`
}

// Setlist (106): a setlist's items, and At, the item last played, for Back.
type Setlist struct {
	BookID string        `json:"bookId"`
	Path   string        `json:"path"`
	Title  string        `json:"title"`
	Items  []SetlistItem `json:"items"`
	At     *int          `json:"at,omitempty"`
}

// SetlistItem is one item of a setlist, every item listed in order: its song
// (Path "" for an unlinked item), its title, its own key and note properties
// as written, and whether it is missing (an unlinked item, or a song the book
// lacks).
type SetlistItem struct {
	Path    string  `json:"path"`
	Title   string  `json:"title"`
	Key     *string `json:"key"`
	Note    *string `json:"note"`
	Missing bool    `json:"missing"`
}

// Settings (107): the account paired with, the reader's version, how many
// voicings are hidden, and whether the site serves a hostApi newer than this
// backend speaks (design §8: *Update the reader on your reMarkable*).
//
// Instruments are the account's instruments to choose from (workflow 19
// §Settings), Instrument the one read with now, AccountInstrument the
// account's own in use, and InstrumentChosen whether this reader chose one
// (else it follows the account's).
type Settings struct {
	Account           string               `json:"account"`
	Version           string               `json:"version"`
	HiddenShapes      int                  `json:"hiddenShapes"`
	UpdateReader      bool                 `json:"updateReader"`
	Instruments       []SettingsInstrument `json:"instruments,omitempty"`
	Instrument        string               `json:"instrument,omitempty"`
	AccountInstrument string               `json:"accountInstrument,omitempty"`
	InstrumentChosen  bool                 `json:"instrumentChosen,omitempty"`
	// ChordNames is how the chart names its chords now, "written" or
	// "voiced", ChordNamesChosen whether this reader chose it (else it is
	// the account's), and AccountChordNames the account's own.
	ChordNames        string `json:"chordNames"`
	ChordNamesChosen  bool   `json:"chordNamesChosen,omitempty"`
	AccountChordNames string `json:"accountChordNames,omitempty"`
}

// SettingsInstrument is one instrument to choose: its id and its name.
type SettingsInstrument struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Shapes (108): the open song's shapes as its sheet would now carry them,
// sent when the background search (§4.1) filled a place the last sheet left
// empty. BookID, Path, Offset and TuningID name the sheet it belongs to; the
// frontend fills its matching empty places for the pages it has yet to draw,
// and redraws nothing (workflow 19 rule 5).
type Shapes struct {
	BookID   string       `json:"bookId"`
	Path     string       `json:"path"`
	Offset   int          `json:"offset"`
	TuningID string       `json:"tuningId"`
	Shapes   []SheetShape `json:"shapes"`
}

// Ahead (109): a Sheet's payload, with Play, for the next or the previous
// playable item of the setlist being played, read ahead (reader.play;
// workflow 19 rule 9). The frontend holds it, never shows it until a turn
// reaches it; it never changes the backend's open song.
type Ahead Sheet

func (State) Type() int32    { return TypeState }
func (Pairing) Type() int32  { return TypePairing }
func (Shelf) Type() int32    { return TypeShelf }
func (Book) Type() int32     { return TypeBook }
func (Sheet) Type() int32    { return TypeSheet }
func (Setlist) Type() int32  { return TypeSetlist }
func (Settings) Type() int32 { return TypeSettings }
func (Shapes) Type() int32   { return TypeShapes }
func (Ahead) Type() int32    { return TypeAhead }

// --- Encoding ---

// names names each type in errors.
var names = map[int32]string{
	TypeTerminate: "terminate", TypeAttached: "attached", TypeDetached: "detached",
	TypeHello: "hello", TypeOpen: "open", TypeKey: "key", TypeSync: "sync",
	TypePair: "pair", TypeSignOut: "signOut", TypeHideShape: "hideShape",
	TypeShowShape: "showShape", TypeShowAllShapes: "showAllShapes",
	TypeShapesShown: "shapesShown", TypePlace: "place",
	TypeInstrument: "instrument", TypeVariation: "variation", TypeChordNames: "chordNames", TypeTextSize: "textSize",
	TypeState: "state", TypePairing: "pairing", TypeShelf: "shelf",
	TypeBook: "book", TypeSheet: "sheet", TypeSetlist: "setlist",
	TypeSettings: "settings", TypeShapes: "shapes", TypeAhead: "ahead",
}

func decodeJSON[T Message](f Frame) (Message, error) {
	var v T
	if err := json.Unmarshal(f.Payload, &v); err != nil {
		return nil, newPayloadError(f.Type, err)
	}
	return v, nil
}

func decodeCount(f Frame) (int, error) {
	n, err := strconv.Atoi(string(f.Payload))
	if err != nil || n < 0 {
		return 0, &PayloadError{Type: f.Type, Class: "count"}
	}
	return n, nil
}

var decoders = map[int32]func(Frame) (Message, error){
	TypeTerminate: func(Frame) (Message, error) { return Terminate{}, nil },
	TypeAttached: func(f Frame) (Message, error) {
		n, err := decodeCount(f)
		if err != nil {
			return nil, err
		}
		return Attached{Frontends: n}, nil
	},
	TypeDetached: func(f Frame) (Message, error) {
		n, err := decodeCount(f)
		if err != nil {
			return nil, err
		}
		return Detached{Frontends: n}, nil
	},
	TypeHello:         decodeJSON[Hello],
	TypeOpen:          decodeJSON[Open],
	TypeKey:           decodeJSON[Key],
	TypeSync:          decodeJSON[Sync],
	TypePair:          decodeJSON[Pair],
	TypeSignOut:       decodeJSON[SignOut],
	TypeHideShape:     decodeJSON[HideShape],
	TypeShowShape:     decodeJSON[ShowShape],
	TypeShowAllShapes: decodeJSON[ShowAllShapes],
	TypeShapesShown:   decodeJSON[ShapesShown],
	TypePlace:         decodeJSON[Place],
	TypeInstrument:    decodeJSON[Instrument],
	TypeVariation:     decodeJSON[Variation],
	TypeChordNames:    decodeJSON[ChordNames],
	TypeTextSize:      decodeJSON[TextSize],
	TypeState:         decodeJSON[State],
	TypePairing:       decodeJSON[Pairing],
	TypeShelf:         decodeJSON[Shelf],
	TypeBook:          decodeJSON[Book],
	TypeSheet:         decodeJSON[Sheet],
	TypeSetlist:       decodeJSON[Setlist],
	TypeSettings:      decodeJSON[Settings],
	TypeShapes:        decodeJSON[Shapes],
	TypeAhead:         decodeJSON[Ahead],
}

// Decode turns a frame into its message. A type not in the table is
// ErrUnknownType; a payload not valid for its type is a *PayloadError.
// Unknown JSON fields are ignored.
func Decode(f Frame) (Message, error) {
	dec, ok := decoders[f.Type]
	if !ok {
		return nil, fmt.Errorf("%w: %d", ErrUnknownType, f.Type)
	}
	return dec(f)
}

// Encode turns a message into its frame: AppLoad's system messages as their
// plain payloads, the table's as JSON (raw values byte for byte, nothing
// HTML-escaped).
func Encode(m Message) (Frame, error) {
	switch v := m.(type) {
	case nil:
		return Frame{}, errors.New("protocol: encode: no message")
	case Terminate:
		return Frame{Type: TypeTerminate, Payload: []byte("close")}, nil
	case Attached:
		return Frame{Type: TypeAttached, Payload: []byte(strconv.Itoa(v.Frontends))}, nil
	case Detached:
		return Frame{Type: TypeDetached, Payload: []byte(strconv.Itoa(v.Frontends))}, nil
	}
	if _, ok := decoders[m.Type()]; !ok {
		return Frame{}, fmt.Errorf("%w: %d", ErrUnknownType, m.Type())
	}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(m); err != nil {
		// json's own error names a Go type or a raw value's position, not the
		// value; classify it all the same, to keep payload bytes out.
		return Frame{}, newPayloadError(m.Type(), err)
	}
	return Frame{Type: m.Type(), Payload: bytes.TrimSuffix(buf.Bytes(), []byte("\n"))}, nil
}

// PayloadError is a payload not valid for its type. It names the type and the
// class of the problem — "syntax", "type" (a value of the wrong kind, with
// the field), "count" (an AppLoad count not a number) or "json" — and the
// byte offset where JSON reported it, never the payload's bytes.
type PayloadError struct {
	Type   int32
	Class  string
	Field  string
	Offset int64
}

func newPayloadError(t int32, err error) *PayloadError {
	pe := &PayloadError{Type: t, Class: "json"}
	var se *json.SyntaxError
	var te *json.UnmarshalTypeError
	switch {
	case errors.As(err, &se):
		pe.Class, pe.Offset = "syntax", se.Offset
	case errors.As(err, &te):
		pe.Class, pe.Offset, pe.Field = "type", te.Offset, te.Field
	case err.Error() == "unexpected end of JSON input":
		pe.Class = "syntax"
	}
	return pe
}

func (e *PayloadError) Error() string {
	name := names[e.Type]
	if name == "" {
		name = "unknown"
	}
	msg := fmt.Sprintf("protocol: payload of message %d (%s) is not valid: %s error", e.Type, name, e.Class)
	if e.Field != "" {
		msg += " in field " + strconv.Quote(e.Field)
	}
	if e.Offset > 0 {
		msg += fmt.Sprintf(" at byte %d", e.Offset)
	}
	return msg
}

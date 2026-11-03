package protocol

// unit — the reader's message table (reader.protocol; docs/remarkable-reader.md
// §6 as amended by this task, §10). The song here was written for the purpose.

import (
	"bytes"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
)

func ptr[T any](v T) *T { return &v }

// Raw values as the bundle writes them: compact JSON, with characters that
// encoding/json would HTML-escape or re-encode if it touched them.
var (
	rawRows  = []byte(`[{"kind":"section","name":"Refrão"},{"kind":"sung","segments":[{"chord":"D","words":"Lá vem a <maré> & o sol"}]}]`)
	rawNotes = []byte(`[{"text":"Capo 2 — devagar & leve"}]`)
	rawModel = []byte(`{"strings":6,"frets":[-1,4,5,3,2,0],"base":1,"label":"C7M"}`)
)

func sampleSheet() Sheet {
	return Sheet{
		BookID: "b1", Path: "a.cifra.md", Title: "Maré Mansa", Artist: "Grupo da Praça",
		// The key grid's choices ride along (reader.song_screen; §6 105
		// key.choices), in the grid's order.
		Key: SheetKey{Written: ptr("C"), Named: ptr("D"), Saved: ptr("D"), Choices: []KeyChoice{
			{Name: "C", Offset: 0}, {Name: "Db", Offset: 1}, {Name: "D", Offset: 2}, {Name: "Eb", Offset: 3},
			{Name: "E", Offset: 4}, {Name: "F", Offset: 5}, {Name: "Gb", Offset: 6}, {Name: "G", Offset: -5},
			{Name: "Ab", Offset: -4}, {Name: "A", Offset: -3}, {Name: "Bb", Offset: -2}, {Name: "B", Offset: -1},
		}},
		Offset:   2,
		TuningID: "40 45 50 55 59 64",
		Rows:     rawRows,
		Shapes: []SheetShape{
			{Chord: "C:maj7", Symbol: "C7M", Frets: ptr("x45320"), Model: rawModel, Hidden: true},
			{Chord: "D:", Symbol: "D", Frets: ptr("xx0232"), Model: rawModel},
			// A pending chord keeps its place: no frets, no model (§4.1).
			{Chord: "F#:dim7", Symbol: "F#°", Frets: nil, Model: json.RawMessage("null")},
		},
		Notes:   rawNotes,
		KeyNote: nil,
		Play:    &SheetPlay{Setlist: "gig.setlist.md", At: 2, Of: 12, Next: nil},
	}
}

// every is one value of each type of the amended §6, its fields filled.
func every() []Message {
	return []Message{
		Hello{},
		Open{View: ViewSong, BookID: "b1", Path: "a.cifra.md", Offset: ptr(2), Play: &PlayAt{Setlist: "gig.setlist.md", At: 3}},
		Key{Offset: ptr(-3)},
		Sync{},
		Pair{},
		SignOut{},
		HideShape{TuningID: "guitar-standard", Chord: "C:maj7", Frets: "x45320"},
		ShowShape{TuningID: "guitar-standard", Chord: "C:maj7", Frets: "x45320"},
		ShowAllShapes{},
		ShapesShown{Shown: false},
		Place{BookID: "b1", Setlist: "gig.setlist.md", At: 3},
		State{Paired: true, Syncing: false, Online: false, LastSync: ptr("2026-11-01T09:10:00Z"), ShapesShown: true, Error: ErrorOffline},
		Pairing{Code: "K7QX-2M", URL: "https://estantedecifras.app/pair", ExpiresAt: "2026-11-01T14:42:00Z"},
		Shelf{Books: []ShelfBook{{BookID: "b1", Title: "Roda de sábado", Songs: 32, Setlists: 4}}},
		Book{BookID: "b1", Title: "Roda de sábado",
			Songs:    []BookSong{{Path: "a.cifra.md", Title: "Maré Mansa", Artist: "Grupo da Praça"}},
			Setlists: []BookSetlist{{Path: "gig.setlist.md", Title: "Sábado", Songs: 12}}},
		sampleSheet(),
		Setlist{BookID: "b1", Path: "gig.setlist.md", Title: "Sábado", At: ptr(2), Items: []SetlistItem{
			{Path: "a.cifra.md", Title: "Maré Mansa", Key: ptr("D"), Note: ptr("devagar")},
			{Path: "gone.cifra.md", Title: "gone", Key: ptr("E"), Note: ptr("se der"), Missing: true},
			{Path: "", Title: "a tocar ainda", Missing: true},
		}},
		Settings{Account: "ana@example.org", Version: "0.7.0", HiddenShapes: 11},
		// reader.missed_shapes: a background search filled a place (§4.1).
		Shapes{BookID: "b1", Path: "a.cifra.md", Offset: 2, TuningID: "40 45 50 55 59 64", Shapes: []SheetShape{
			{Chord: "C:maj7", Symbol: "C7M", Frets: ptr("x45320"), Model: rawModel, Hidden: true},
			{Chord: "F#:dim7", Symbol: "F#°", Frets: ptr("2x121x"), Model: rawModel},
			{Chord: "B:7", Symbol: "B7", Frets: nil, Model: json.RawMessage("null")},
		}},
		// reader.play: a neighbour read ahead, a 105's payload with play.
		Ahead(sampleSheet()),
	}
}

// Pins design §6 row by row: each message, written on one end, comes out
// equal on the other.
func TestEachMessageRoundTrips(t *testing.T) {
	c, p := pair(t, 0)
	other := wrap(t, p.fd) // the peer's end, wrapped too, for Next
	seen := map[int32]bool{}
	for _, m := range every() {
		seen[m.Type()] = true
		if err := c.Write(m); err != nil {
			t.Fatalf("Write %T: %v", m, err)
		}
		got, err := other.Next()
		if err != nil {
			t.Fatalf("Next for %T: %v", m, err)
		}
		if !reflect.DeepEqual(got, m) {
			t.Fatalf("%T round trip:\n got %#v\nwant %#v", m, got, m)
		}
	}
	for typ := range names {
		if typ > 0 && !seen[typ] {
			t.Errorf("type %d (%s) has no round-trip case", typ, names[typ])
		}
	}
}

// Pins §6's field names: each type's JSON as §6's table writes it, so a field
// renamed in Go fails here before the QML sees it.
func TestWireNames(t *testing.T) {
	cases := []struct {
		m    Message
		want string
	}{
		{Hello{}, `{}`},
		{Open{View: ViewShelf}, `{"view":"shelf"}`},
		{Open{View: ViewBook, BookID: "b1"}, `{"view":"book","bookId":"b1"}`},
		{Open{View: ViewSong, BookID: "b1", Path: "a.cifra.md", Offset: ptr(2), Play: &PlayAt{Setlist: "gig.setlist.md", At: 3}},
			`{"view":"song","bookId":"b1","path":"a.cifra.md","offset":2,"play":{"setlist":"gig.setlist.md","at":3}}`},
		{Open{View: ViewSong, BookID: "b1", Path: "a.cifra.md", Offset: ptr(0)}, `{"view":"song","bookId":"b1","path":"a.cifra.md","offset":0}`},
		{Open{View: ViewSetlist, BookID: "b1", Path: "gig.setlist.md"}, `{"view":"setlist","bookId":"b1","path":"gig.setlist.md"}`},
		{Open{View: ViewSettings}, `{"view":"settings"}`},
		{Key{Offset: ptr(2)}, `{"offset":2}`},
		{Key{Offset: nil}, `{"offset":null}`},
		{Sync{}, `{}`},
		{Pair{}, `{}`},
		{SignOut{}, `{}`},
		{HideShape{TuningID: "guitar-standard", Chord: "C:maj7", Frets: "x45320"}, `{"tuningId":"guitar-standard","chord":"C:maj7","frets":"x45320"}`},
		{ShowShape{TuningID: "guitar-standard", Chord: "C:maj7", Frets: "x45320"}, `{"tuningId":"guitar-standard","chord":"C:maj7","frets":"x45320"}`},
		{ShowAllShapes{}, `{}`},
		{ShapesShown{Shown: true}, `{"shown":true}`},
		{Place{BookID: "b1", Setlist: "gig.setlist.md", At: 3}, `{"bookId":"b1","setlist":"gig.setlist.md","at":3}`},
		{State{Paired: true, Online: true, LastSync: nil, ShapesShown: true}, `{"paired":true,"syncing":false,"online":true,"lastSync":null,"shapesShown":true}`},
		{State{Paired: false, LastSync: ptr("2026-11-01T09:10:00Z"), Error: ErrorSignedOut}, `{"paired":false,"syncing":false,"online":false,"lastSync":"2026-11-01T09:10:00Z","shapesShown":false,"error":"signedOut"}`},
		{Pairing{Code: "K7QX-2M", URL: "https://estantedecifras.app/pair", ExpiresAt: "2026-11-01T14:42:00Z"}, `{"code":"K7QX-2M","url":"https://estantedecifras.app/pair","expiresAt":"2026-11-01T14:42:00Z"}`},
		{Pairing{Expired: true}, `{"expired":true}`},
		{Pairing{Offline: true}, `{"offline":true}`},
		{Shelf{Books: []ShelfBook{{BookID: "b1", Title: "Roda", Songs: 32, Setlists: 4}}}, `{"books":[{"bookId":"b1","title":"Roda","songs":32,"setlists":4}]}`},
		{Book{BookID: "b1", Title: "Roda", Songs: []BookSong{{Path: "a.cifra.md", Title: "Maré", Artist: "Grupo"}}, Setlists: []BookSetlist{{Path: "gig.setlist.md", Title: "Sábado", Songs: 12}}},
			`{"bookId":"b1","title":"Roda","songs":[{"path":"a.cifra.md","title":"Maré","artist":"Grupo"}],"setlists":[{"path":"gig.setlist.md","title":"Sábado","songs":12}]}`},
		{Sheet{BookID: "b1", Path: "a.cifra.md", Title: "Maré", Artist: "Grupo",
			Key:    SheetKey{Written: ptr("C"), Named: ptr("D"), Saved: ptr("D"), Choices: []KeyChoice{{Name: "C", Offset: 0}, {Name: "Db", Offset: 1}}},
			Offset: 2, TuningID: "40 45 50 55 59 64", Rows: []byte(`[]`),
			Shapes: []SheetShape{
				{Chord: "C:maj7", Symbol: "C7M", Frets: ptr("x45320"), Model: []byte(`{}`), Hidden: true},
				{Chord: "F#:dim7", Symbol: "F#°", Frets: nil, Model: nil},
			},
			Notes: []byte(`[]`), KeyNote: nil,
			Play: &SheetPlay{Setlist: "gig.setlist.md", At: 11, Of: 12, Next: nil}},
			`{"bookId":"b1","path":"a.cifra.md","title":"Maré","artist":"Grupo","key":{"written":"C","named":"D","saved":"D","choices":[{"name":"C","offset":0},{"name":"Db","offset":1}]},"offset":2,"tuningId":"40 45 50 55 59 64","rows":[],"shapes":[{"chord":"C:maj7","symbol":"C7M","frets":"x45320","model":{},"hidden":true},{"chord":"F#:dim7","symbol":"F#°","frets":null,"model":null,"hidden":false}],"notes":[],"keyNote":null,"play":{"setlist":"gig.setlist.md","at":11,"of":12,"next":null}}`},
		{Sheet{BookID: "b1", Path: "a.cifra.md", Title: "Maré", Artist: "",
			Key: SheetKey{Choices: []KeyChoice{}}, Rows: []byte(`[]`), Shapes: []SheetShape{}, Notes: []byte(`[]`), KeyNote: ptr("named by its last chord")},
			`{"bookId":"b1","path":"a.cifra.md","title":"Maré","artist":"","key":{"written":null,"named":null,"saved":null,"choices":[]},"offset":0,"tuningId":"","rows":[],"shapes":[],"notes":[],"keyNote":"named by its last chord"}`},
		{sheetWithNext(), `{"bookId":"","path":"","title":"","artist":"","key":{"written":null,"named":null,"saved":null,"choices":[]},"offset":0,"tuningId":"","rows":[],"shapes":[],"notes":[],"keyNote":null,"play":{"setlist":"gig.setlist.md","at":2,"of":12,"next":{"title":"Asa","key":"G","note":"capo 2"}}}`},
		{Setlist{BookID: "b1", Path: "gig.setlist.md", Title: "Sábado", Items: []SetlistItem{
			{Path: "a.cifra.md", Title: "Maré", Key: ptr("D"), Note: ptr("devagar")},
			{Path: "gone.cifra.md", Title: "gone", Missing: true}}, At: ptr(0)},
			`{"bookId":"b1","path":"gig.setlist.md","title":"Sábado","items":[{"path":"a.cifra.md","title":"Maré","key":"D","note":"devagar","missing":false},{"path":"gone.cifra.md","title":"gone","key":null,"note":null,"missing":true}],"at":0}`},
		{Setlist{BookID: "b1", Path: "gig.setlist.md", Title: "Sábado", Items: []SetlistItem{}}, `{"bookId":"b1","path":"gig.setlist.md","title":"Sábado","items":[]}`},
		{Settings{Account: "ana@example.org", Version: "0.7.0", HiddenShapes: 11}, `{"account":"ana@example.org","version":"0.7.0","hiddenShapes":11,"updateReader":false}`},
		{Settings{Account: "ana@example.org", Version: "0.7.0", HiddenShapes: 11, UpdateReader: true}, `{"account":"ana@example.org","version":"0.7.0","hiddenShapes":11,"updateReader":true}`},
		// §6 108 shapes (reader.missed_shapes).
		{Shapes{BookID: "b1", Path: "a.cifra.md", Offset: 2, TuningID: "40 45 50 55 59 64", Shapes: []SheetShape{
			{Chord: "F#:dim7", Symbol: "F#°", Frets: ptr("2x121x"), Model: []byte(`{}`)},
			{Chord: "B:7", Symbol: "B7", Frets: nil, Model: nil}}},
			`{"bookId":"b1","path":"a.cifra.md","offset":2,"tuningId":"40 45 50 55 59 64","shapes":[{"chord":"F#:dim7","symbol":"F#°","frets":"2x121x","model":{},"hidden":false},{"chord":"B:7","symbol":"B7","frets":null,"model":null,"hidden":false}]}`},
		// §6 109 ahead (reader.play): exactly a 105's payload, with play.
		{Ahead(sheetWithNext()), `{"bookId":"","path":"","title":"","artist":"","key":{"written":null,"named":null,"saved":null,"choices":[]},"offset":0,"tuningId":"","rows":[],"shapes":[],"notes":[],"keyNote":null,"play":{"setlist":"gig.setlist.md","at":2,"of":12,"next":{"title":"Asa","key":"G","note":"capo 2"}}}`},
	}
	for _, tc := range cases {
		f, err := Encode(tc.m)
		if err != nil {
			t.Fatalf("Encode %T: %v", tc.m, err)
		}
		if f.Type != tc.m.Type() {
			t.Errorf("Encode %T: type %d, want %d", tc.m, f.Type, tc.m.Type())
		}
		if string(f.Payload) != tc.want {
			t.Errorf("Encode %T:\n got %s\nwant %s", tc.m, f.Payload, tc.want)
		}
	}
}

// sheetWithNext is a sheet played with a next item, for TestWireNames.
func sheetWithNext() Sheet {
	return Sheet{Key: SheetKey{Choices: []KeyChoice{}}, Rows: []byte(`[]`), Shapes: []SheetShape{}, Notes: []byte(`[]`),
		Play: &SheetPlay{Setlist: "gig.setlist.md", At: 2, Of: 12, Next: &NextItem{Title: "Asa", Key: ptr("G"), Note: ptr("capo 2")}}}
}

// Pins §6 "chartRows exactly as the web app's chart receives them": rows,
// notes and model pass through byte for byte, nothing re-encoded or escaped.
func TestRawPassThrough(t *testing.T) {
	f, err := Encode(sampleSheet())
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}
	for _, raw := range [][]byte{rawRows, rawNotes, rawModel} {
		if !bytes.Contains(f.Payload, raw) {
			t.Errorf("payload does not carry %s byte for byte", raw)
		}
	}
	m, err := Decode(f)
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	s := m.(Sheet)
	if !bytes.Equal(s.Rows, rawRows) || !bytes.Equal(s.Notes, rawNotes) || !bytes.Equal(s.Shapes[0].Model, rawModel) {
		t.Fatalf("raw values changed:\nrows  %s\nnotes %s\nmodel %s", s.Rows, s.Notes, s.Shapes[0].Model)
	}
	// Decoding keeps the bytes as they came, whitespace included.
	spaced := []byte(`{"bookId":"b1","path":"p","title":"t","artist":"a","key":{},"offset":0,"rows": [ {"kind" : "empty"} ],"shapes":[],"notes":[ ],"keyNote":null}`)
	m, err = Decode(Frame{Type: TypeSheet, Payload: spaced})
	if err != nil {
		t.Fatalf("Decode spaced: %v", err)
	}
	if got := string(m.(Sheet).Rows); got != `[ {"kind" : "empty"} ]` {
		t.Fatalf("rows %q, want them as received", got)
	}
}

// Pins the note's "a type the other side does not know ignored".
func TestUnknownTypeIgnored(t *testing.T) {
	c, p := pair(t, 0)
	p.message(TypeHello, `{}`)
	p.message(42, `{"later":1}`)
	p.message(999, `x`)
	p.record(header(43, 0))
	p.message(TypeSync, `{}`)
	for _, want := range []Message{Hello{}, Sync{}} {
		m, err := c.Next()
		if err != nil || m != want {
			t.Fatalf("Next: %#v %v, want %#v", m, err, want)
		}
	}
	if _, err := Decode(Frame{Type: 42, Payload: []byte(`{}`)}); !errors.Is(err, ErrUnknownType) {
		t.Fatalf("Decode of 42: %v, want ErrUnknownType", err)
	}
}

// Pins §6's "and a field they do not know".
func TestUnknownFieldIgnored(t *testing.T) {
	m, err := Decode(Frame{Type: TypeHello, Payload: []byte(`{"later":true}`)})
	if err != nil || m != (Hello{}) {
		t.Fatalf("hello: %#v %v", m, err)
	}
	m, err = Decode(Frame{Type: TypeOpen, Payload: []byte(`{"view":"book","bookId":"b1","zoom":{"level":2}}`)})
	if err != nil || !reflect.DeepEqual(m, Open{View: ViewBook, BookID: "b1"}) {
		t.Fatalf("open: %#v %v", m, err)
	}
}

// Pins design §10, no song text in a log: a payload that fails to parse
// yields an error naming the type, none of the payload's words, and the
// connection goes on.
func TestMalformedPayloadSaysNoWords(t *testing.T) {
	line := "Lá vem a maré mansa beijar a areia"
	cases := []string{
		`{"view":` + line,
		`{"view":"` + line,
		`{"view":"song","offset":"` + line + `"}`,
	}
	for _, payload := range cases {
		c, p := pair(t, 0)
		p.message(TypeOpen, payload)
		p.message(TypeSync, `{}`)
		_, err := c.Next()
		var pe *PayloadError
		if !errors.As(err, &pe) || pe.Type != TypeOpen {
			t.Fatalf("Next: %v, want a *PayloadError for type 2", err)
		}
		msg := err.Error()
		for _, w := range strings.Fields(line) {
			if len(w) >= 3 && strings.Contains(msg, w) {
				t.Fatalf("error %q carries the payload's word %q", msg, w)
			}
		}
		if !strings.Contains(msg, "2") || !strings.Contains(msg, "open") {
			t.Fatalf("error %q does not name the type", msg)
		}
		m, err := c.Next()
		if err != nil || m != (Sync{}) {
			t.Fatalf("Next after the bad payload: %#v %v, want sync", m, err)
		}
	}
}

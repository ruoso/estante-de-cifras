package store

// unit — the reader's own state, each mutation persisted and read back after
// a restart (reader.store; docs/remarkable-reader.md §5.4, §6; workflow 19
// §A song).

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestKeyRoundTripsAcrossRestart pins workflow 19 §A song "until another is
// chosen or As written" and design §5.4, §6 key: nil forgets the choice.
func TestKeyRoundTripsAcrossRestart(t *testing.T) {
	s, root := newStore(t)
	if _, ok := s.Key("b1", "songs/one.cifra.md"); ok {
		t.Fatal("a fresh store has a key chosen")
	}
	if err := s.SetKey("b1", "songs/one.cifra.md", intp(-3)); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if off, ok := s.Key("b1", "songs/one.cifra.md"); !ok || off != -3 {
		t.Errorf("after restart: %d %v, want -3 true", off, ok)
	}
	if _, ok := s.Key("b1", "songs/two.cifra.md"); ok {
		t.Error("another song has a key")
	}
	if _, ok := s.Key("b2", "songs/one.cifra.md"); ok {
		t.Error("the same path in another book has a key")
	}
	if err := s.SetKey("b1", "songs/one.cifra.md", intp(2)); err != nil {
		t.Fatal(err)
	}
	if off, _ := s.Key("b1", "songs/one.cifra.md"); off != 2 {
		t.Errorf("another key chosen: %d, want 2", off)
	}
	if err := s.SetKey("b1", "songs/one.cifra.md", nil); err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Key("b1", "songs/one.cifra.md"); ok {
		t.Error("As written did not forget the key")
	}
	s = openStore(t, root)
	if _, ok := s.Key("b1", "songs/one.cifra.md"); ok {
		t.Error("As written did not forget the key across a restart")
	}
}

// TestPlaceRoundTripsAcrossRestart pins design §6 place and setlist.at: one
// place per setlist.
func TestPlaceRoundTripsAcrossRestart(t *testing.T) {
	s, root := newStore(t)
	if _, ok := s.Place("b1", "sets/sunday.cifra.md"); ok {
		t.Fatal("a fresh store has a place")
	}
	if err := s.SetPlace("b1", "sets/sunday.cifra.md", 3); err != nil {
		t.Fatal(err)
	}
	if err := s.SetPlace("b1", "sets/friday.cifra.md", 0); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if at, ok := s.Place("b1", "sets/sunday.cifra.md"); !ok || at != 3 {
		t.Errorf("sunday: %d %v, want 3 true", at, ok)
	}
	if at, ok := s.Place("b1", "sets/friday.cifra.md"); !ok || at != 0 {
		t.Errorf("friday: %d %v, want 0 true", at, ok)
	}
	if err := s.SetPlace("b1", "sets/sunday.cifra.md", 4); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if at, _ := s.Place("b1", "sets/sunday.cifra.md"); at != 4 {
		t.Errorf("sunday moved on: %d, want 4", at)
	}
	if at, _ := s.Place("b1", "sets/friday.cifra.md"); at != 0 {
		t.Errorf("friday changed with sunday: %d, want 0", at)
	}
}

// TestShapesShownRoundTripsAcrossRestart pins workflow 19 §A song Hide
// shapes, kept for every song: shown by default.
func TestShapesShownRoundTripsAcrossRestart(t *testing.T) {
	s, root := newStore(t)
	if !s.ShapesShown() {
		t.Fatal("shapes hidden by default")
	}
	if err := s.SetShapesShown(false); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if s.ShapesShown() {
		t.Error("Hide shapes lost across a restart")
	}
	if err := s.SetShapesShown(true); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if !s.ShapesShown() {
		t.Error("Show shapes lost across a restart")
	}
}

// TestHiddenVoicingsRoundTripAcrossRestart pins hide, count, show one and
// show all (design §6 hideShape, showShape, showAllShapes,
// settings.hiddenShapes).
func TestHiddenVoicingsRoundTripAcrossRestart(t *testing.T) {
	s, root := newStore(t)
	g := Voicing{TuningID: "guitar-standard", Chord: "G", Frets: "320003"}
	c := Voicing{TuningID: "guitar-standard", Chord: "C", Frets: "x32010"}
	for _, v := range []Voicing{g, c, g} {
		if err := s.Hide(v); err != nil {
			t.Fatal(err)
		}
	}
	if n := s.HiddenCount(); n != 2 {
		t.Errorf("hiding twice: count %d, want 2", n)
	}
	s = openStore(t, root)
	if !s.Hidden(g) || !s.Hidden(c) || s.HiddenCount() != 2 {
		t.Errorf("after restart: g %v c %v count %d", s.Hidden(g), s.Hidden(c), s.HiddenCount())
	}
	if err := s.Show(g); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if s.Hidden(g) || !s.Hidden(c) || s.HiddenCount() != 1 {
		t.Errorf("after show one: g %v c %v count %d", s.Hidden(g), s.Hidden(c), s.HiddenCount())
	}
	if err := s.Hide(g); err != nil {
		t.Fatal(err)
	}
	if err := s.ShowAll(); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if s.Hidden(g) || s.Hidden(c) || s.HiddenCount() != 0 {
		t.Errorf("after show all: g %v c %v count %d", s.Hidden(g), s.Hidden(c), s.HiddenCount())
	}
}

// TestHiddenMatchesFretsNotName pins workflow 19 §A song "this chord in this
// voicing on this tuning: the frets, not the name".
func TestHiddenMatchesFretsNotName(t *testing.T) {
	s, _ := newStore(t)
	v := Voicing{TuningID: "guitar-standard", Chord: "C", Frets: "x32010"}
	if err := s.Hide(v); err != nil {
		t.Fatal(err)
	}
	if !s.Hidden(v) {
		t.Fatal("the hidden voicing is not hidden")
	}
	others := []Voicing{
		{TuningID: "guitar-standard", Chord: "C", Frets: "x35553"},
		{TuningID: "guitar-dadgad", Chord: "C", Frets: "x32010"},
		{TuningID: "guitar-standard", Chord: "Am", Frets: "x32010"},
	}
	for _, o := range others {
		if s.Hidden(o) {
			t.Errorf("%+v hidden by %+v", o, v)
		}
	}
}

// TestUnreadableStateReadsAsDefaults pins Decision 8: a garbage or
// future-version state.json reads as the defaults; the next mutation writes a
// good file.
func TestUnreadableStateReadsAsDefaults(t *testing.T) {
	for name, content := range map[string]string{
		"garbage":   "{not json",
		"version 2": `{"version":2,"keys":{"b1":{"s":1}},"shapesHidden":true,"hidden":[{"tuningId":"t","chord":"C","frets":"x32010"}]}`,
	} {
		t.Run(name, func(t *testing.T) {
			root := filepath.Join(t.TempDir(), "estante")
			if err := os.MkdirAll(root, 0o700); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(root, stateFile), []byte(content), 0o600); err != nil {
				t.Fatal(err)
			}
			s := openStore(t, root)
			if _, ok := s.Key("b1", "s"); ok {
				t.Error("a key read from an unreadable file")
			}
			if !s.ShapesShown() || s.HiddenCount() != 0 {
				t.Errorf("not the defaults: shown %v hidden %d", s.ShapesShown(), s.HiddenCount())
			}
			if err := s.SetPlace("b1", "set", 1); err != nil {
				t.Fatal(err)
			}
			s = openStore(t, root)
			if at, ok := s.Place("b1", "set"); !ok || at != 1 {
				t.Errorf("the next mutation did not write a good file: %d %v", at, ok)
			}
		})
	}
}

// TestUnknownStateFieldsIgnored pins the versioned, tolerant JSON: a newer
// reader's extra field does not break this one.
func TestUnknownStateFieldsIgnored(t *testing.T) {
	root := filepath.Join(t.TempDir(), "estante")
	if err := os.MkdirAll(root, 0o700); err != nil {
		t.Fatal(err)
	}
	content := `{"version":1,"keys":{"b1":{"s":5}},"places":{"b1":{"set":2}},"shapesHidden":true,` +
		`"hidden":[{"tuningId":"t","chord":"C","frets":"x32010","since":"x"}],"zoom":1.5}`
	if err := os.WriteFile(filepath.Join(root, stateFile), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	s := openStore(t, root)
	if off, ok := s.Key("b1", "s"); !ok || off != 5 {
		t.Errorf("key: %d %v", off, ok)
	}
	if at, ok := s.Place("b1", "set"); !ok || at != 2 {
		t.Errorf("place: %d %v", at, ok)
	}
	if s.ShapesShown() {
		t.Error("shapesHidden not read")
	}
	if !s.Hidden(Voicing{TuningID: "t", Chord: "C", Frets: "x32010"}) {
		t.Error("hidden voicing not read")
	}
}

// TestLastSyncRoundTripsAcrossRestart pins reader.sync Decision 12 and
// workflow 19 §The shelf: when the last sync finished is kept in state.json,
// so *Not connected — showing what was synced at 09:10* holds after a
// restart.
func TestLastSyncRoundTripsAcrossRestart(t *testing.T) {
	s, root := newStore(t)
	if _, ok := s.LastSync(); ok {
		t.Fatal("a fresh store has a last sync")
	}
	first := time.Date(2026, 11, 1, 9, 10, 0, 0, time.UTC)
	if err := s.SetLastSync(first); err != nil {
		t.Fatal(err)
	}
	if err := s.SetKey("b1", "song", intp(2)); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if got, ok := s.LastSync(); !ok || !got.Equal(first) {
		t.Errorf("after restart: %v %v, want %v true", got, ok, first)
	}
	if off, ok := s.Key("b1", "song"); !ok || off != 2 {
		t.Errorf("the key was lost beside the last sync: %d %v", off, ok)
	}
	later := first.Add(5*time.Hour + 22*time.Minute)
	if err := s.SetLastSync(later); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if got, _ := s.LastSync(); !got.Equal(later) {
		t.Errorf("after a later sync and a restart: %v, want %v", got, later)
	}
}

// TestInstrumentRoundTripsAcrossRestart pins workflow 19 §Settings: the
// instrument chosen here stays on this reader; "" follows the account again.
func TestInstrumentRoundTripsAcrossRestart(t *testing.T) {
	s, root := newStore(t)
	if got := s.Instrument(); got != "" {
		t.Fatalf("a fresh store has instrument %q chosen", got)
	}
	if err := s.SetInstrument("cavaquinho-1"); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if got := s.Instrument(); got != "cavaquinho-1" {
		t.Errorf("after restart: %q, want cavaquinho-1", got)
	}
	if err := s.SetInstrument(""); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if got := s.Instrument(); got != "" {
		t.Errorf("the account's did not stand again across a restart: %q", got)
	}
}

// TestVariationRoundTripsAcrossRestart pins workflow 19 §A song: a variation
// chosen here is per song and per tuning, and nil forgets it (” is the
// unnamed block, a choice like any other).
func TestVariationRoundTripsAcrossRestart(t *testing.T) {
	s, root := newStore(t)
	const song, guitar, uke = "songs/one.cifra.md", "40 45 50 55 59 64", "67 60 64 69"
	if _, ok := s.Variation("b1", song, guitar); ok {
		t.Fatal("a fresh store has a variation chosen")
	}
	high, unnamed := "High", ""
	if err := s.SetVariation("b1", song, guitar, &high); err != nil {
		t.Fatal(err)
	}
	if err := s.SetVariation("b1", song, uke, &unnamed); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if v, ok := s.Variation("b1", song, guitar); !ok || v != "High" {
		t.Errorf("after restart, guitar: %q %v, want High true", v, ok)
	}
	if v, ok := s.Variation("b1", song, uke); !ok || v != "" {
		t.Errorf("after restart, uke: %q %v, want the unnamed block, true", v, ok)
	}
	for _, other := range [][2]string{{"b1", "songs/two.cifra.md"}, {"b2", song}} {
		if _, ok := s.Variation(other[0], other[1], guitar); ok {
			t.Errorf("%v has a variation", other)
		}
	}
	if err := s.SetVariation("b1", song, guitar, nil); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if _, ok := s.Variation("b1", song, guitar); ok {
		t.Error("nil did not forget the guitar's variation across a restart")
	}
	if _, ok := s.Variation("b1", song, uke); !ok {
		t.Error("forgetting the guitar's forgot the uke's")
	}
}

// TestChordNamesRoundTripsAcrossRestart pins workflow 19 §Settings: how the
// chart names its chords, chosen here, stays on this reader; "" follows the
// account again; anything but written or voiced is refused.
func TestChordNamesRoundTripsAcrossRestart(t *testing.T) {
	s, root := newStore(t)
	if got := s.ChordNames(); got != "" {
		t.Fatalf("a fresh store names chords %q", got)
	}
	if err := s.SetChordNames("voiced"); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if got := s.ChordNames(); got != "voiced" {
		t.Errorf("after restart: %q, want voiced", got)
	}
	if err := s.SetChordNames("sideways"); err == nil {
		t.Error("an unknown naming was kept")
	}
	if err := s.SetChordNames(""); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if got := s.ChordNames(); got != "" {
		t.Errorf("the account's did not stand again: %q", got)
	}
}

package store

// unit — the reader's own state, each mutation persisted and read back after
// a restart (reader.store; docs/remarkable-reader.md §5.4, §6; workflow 19
// §A song).

import (
	"os"
	"path/filepath"
	"testing"
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

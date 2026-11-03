package store

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"time"
)

// Voicing names a hidden voicing: the tuning, the chord as the engine keys it
// (spelling-independent) and the frets. Matched by all three exactly — the
// frets, not the name (workflow 19 §A song; protocol Voicing).
type Voicing struct {
	TuningID string `json:"tuningId"`
	Chord    string `json:"chord"`
	Frets    string `json:"frets"`
}

// stateVersion is the one version of state.json this reader writes and reads.
const stateVersion = 1

// state is the reader's own state (§5.4): the key chosen per song, the place
// per setlist, whether shapes are shown, the voicings hidden, and when the
// last sync finished (reader.sync).
type state struct {
	keys         map[string]map[string]int // bookId → song path → offset
	places       map[string]map[string]int // bookId → setlist path → item index
	shapesHidden bool
	hidden       map[Voicing]struct{}
	lastSync     time.Time                               // zero before the first sync
	instrument   string                                  // the instrument chosen here; "" follows the account
	chordNames   string                                  // "written" or "voiced" chosen here; "" follows the account
	textSize     int                                     // the chart\'s text size in points chosen here; 0 the standard
	variations   map[string]map[string]map[string]string // bookId → song path → tuning id → variation
}

type stateJSON struct {
	Version      int                                     `json:"version"`
	Keys         map[string]map[string]int               `json:"keys,omitempty"`
	Places       map[string]map[string]int               `json:"places,omitempty"`
	ShapesHidden bool                                    `json:"shapesHidden,omitempty"`
	Hidden       []Voicing                               `json:"hidden,omitempty"`
	LastSync     *time.Time                              `json:"lastSync,omitempty"`
	Instrument   string                                  `json:"instrument,omitempty"`
	ChordNames   string                                  `json:"chordNames,omitempty"`
	TextSize     int                                     `json:"textSize,omitempty"`
	Variations   map[string]map[string]map[string]string `json:"variations,omitempty"`
}

func newState() state {
	return state{
		keys:       map[string]map[string]int{},
		places:     map[string]map[string]int{},
		hidden:     map[Voicing]struct{}{},
		variations: map[string]map[string]map[string]string{},
	}
}

func copyVariations(m map[string]map[string]map[string]string) map[string]map[string]map[string]string {
	c := make(map[string]map[string]map[string]string, len(m))
	for b, songs := range m {
		cs := make(map[string]map[string]string, len(songs))
		for p, byTuning := range songs {
			ct := make(map[string]string, len(byTuning))
			for t, v := range byTuning {
				ct[t] = v
			}
			if len(ct) > 0 {
				cs[p] = ct
			}
		}
		if len(cs) > 0 {
			c[b] = cs
		}
	}
	return c
}

// clone copies st, so a mutation is applied to the copy and kept only once
// the copy is on disk.
func (st state) clone() state {
	c := newState()
	for b, m := range st.keys {
		c.keys[b] = copyMap(m)
	}
	for b, m := range st.places {
		c.places[b] = copyMap(m)
	}
	c.shapesHidden = st.shapesHidden
	for v := range st.hidden {
		c.hidden[v] = struct{}{}
	}
	c.lastSync = st.lastSync
	c.instrument = st.instrument
	c.chordNames = st.chordNames
	c.textSize = st.textSize
	c.variations = copyVariations(st.variations)
	return c
}

func copyMap(m map[string]int) map[string]int {
	c := make(map[string]int, len(m))
	for k, v := range m {
		c[k] = v
	}
	return c
}

// readState reads path; anything unreadable, or of another version, reads as
// the defaults (Decision 8). Unknown fields are ignored.
func readState(path string) state {
	st := newState()
	raw, err := os.ReadFile(path)
	if err != nil {
		return st
	}
	var j stateJSON
	if json.Unmarshal(raw, &j) != nil || j.Version != stateVersion {
		return st
	}
	for b, m := range j.Keys {
		if len(m) > 0 {
			st.keys[b] = copyMap(m)
		}
	}
	for b, m := range j.Places {
		if len(m) > 0 {
			st.places[b] = copyMap(m)
		}
	}
	st.shapesHidden = j.ShapesHidden
	for _, v := range j.Hidden {
		st.hidden[v] = struct{}{}
	}
	if j.LastSync != nil {
		st.lastSync = *j.LastSync
	}
	st.instrument = j.Instrument
	if validTextSize(j.TextSize) {
		st.textSize = j.TextSize
	}
	if j.ChordNames == "written" || j.ChordNames == "voiced" {
		st.chordNames = j.ChordNames
	}
	st.variations = copyVariations(j.Variations)
	return st
}

func (st state) encode() ([]byte, error) {
	j := stateJSON{Version: stateVersion, Keys: st.keys, Places: st.places, ShapesHidden: st.shapesHidden,
		Instrument: st.instrument, ChordNames: st.chordNames, TextSize: st.textSize}
	if len(st.variations) > 0 {
		j.Variations = st.variations
	}
	if !st.lastSync.IsZero() {
		t := st.lastSync
		j.LastSync = &t
	}
	for v := range st.hidden {
		j.Hidden = append(j.Hidden, v)
	}
	sort.Slice(j.Hidden, func(a, b int) bool {
		x, y := j.Hidden[a], j.Hidden[b]
		if x.TuningID != y.TuningID {
			return x.TuningID < y.TuningID
		}
		if x.Chord != y.Chord {
			return x.Chord < y.Chord
		}
		return x.Frets < y.Frets
	})
	return json.Marshal(j)
}

// mutate applies change to a copy of the state, writes the copy whole and
// atomically, and keeps it only when it is on disk.
func (s *Store) mutate(change func(st *state)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := s.state.clone()
	change(&next)
	raw, err := next.encode()
	if err != nil {
		return fmt.Errorf("store: encode state: %w", err)
	}
	if err := writeAtomic(s.root, stateFile, raw, fileMode, "state"); err != nil {
		return err
	}
	s.state = next
	return nil
}

// Key is the key chosen on this device for the song at path in bookID, as an
// offset; false when none is chosen (the song opens at its saved key).
func (s *Store) Key(bookID, path string) (offset int, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	offset, ok = s.state.keys[bookID][path]
	return offset, ok
}

// SetKey keeps the key chosen for a song; nil is As written chosen, which
// forgets the device's choice (protocol Key; design §5.4, §6).
func (s *Store) SetKey(bookID, path string, offset *int) error {
	return s.mutate(func(st *state) { setIn(st.keys, bookID, path, offset) })
}

// Instrument is the instrument chosen on this reader (workflow 19
// §Settings), "" when none is: the account's in use is read then.
func (s *Store) Instrument() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state.instrument
}

// SetInstrument keeps the instrument chosen here; "" forgets the choice, so
// the account's in use is followed again.
func (s *Store) SetInstrument(id string) error {
	return s.mutate(func(st *state) { st.instrument = id })
}

// TextSizes are the chart's text sizes the reader offers, in points
// (workflow 19 §Settings; the frontend's chart/metrics.js textSizes); 14 is
// the standard.
var TextSizes = []int{9, 10, 11, 12, 13, 14, 16, 18}

func validTextSize(pt int) bool {
	for _, s := range TextSizes {
		if s == pt {
			return true
		}
	}
	return false
}

// TextSize is the chart's text size chosen on this reader, in points; 0 when
// none is, and the standard is read.
func (s *Store) TextSize() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state.textSize
}

// SetTextSize keeps the chart's text size; 0 forgets the choice. A size not
// offered is refused.
func (s *Store) SetTextSize(pt int) error {
	if pt != 0 && !validTextSize(pt) {
		return fmt.Errorf("store: text size: %w", ErrBadID)
	}
	return s.mutate(func(st *state) { st.textSize = pt })
}

// ChordNames is how this reader names the chart's chords, "written" or
// "voiced" (workflow 19 §Settings); "" when none is chosen and the account's
// chordNames preference is read.
func (s *Store) ChordNames() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state.chordNames
}

// SetChordNames keeps how the chart names its chords here; "" forgets the
// choice. Anything but "written" or "voiced" is refused.
func (s *Store) SetChordNames(names string) error {
	if names != "" && names != "written" && names != "voiced" {
		return fmt.Errorf("store: chord names: %w", ErrBadID)
	}
	return s.mutate(func(st *state) { st.chordNames = names })
}

// Variation is the variation chosen on this reader for a song in one tuning
// (workflow 19 §A song); false when none is, and the account's (songs.json)
// is read.
func (s *Store) Variation(bookID, path, tuningID string) (variation string, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	variation, ok = s.state.variations[bookID][path][tuningID]
	return variation, ok
}

// Variations is every variation chosen on this reader for a song, by tuning
// id (nil when none is).
func (s *Store) Variations(bookID, path string) map[string]string {
	s.mu.Lock()
	defer s.mu.Unlock()
	byTuning := s.state.variations[bookID][path]
	if len(byTuning) == 0 {
		return nil
	}
	out := make(map[string]string, len(byTuning))
	for t, v := range byTuning {
		out[t] = v
	}
	return out
}

// SetVariation keeps the variation chosen for a song in one tuning; nil
// forgets the choice.
func (s *Store) SetVariation(bookID, path, tuningID string, variation *string) error {
	return s.mutate(func(st *state) {
		songs := st.variations[bookID]
		if variation == nil {
			delete(songs[path], tuningID)
			if len(songs[path]) == 0 {
				delete(songs, path)
			}
			if len(songs) == 0 {
				delete(st.variations, bookID)
			}
			return
		}
		if songs == nil {
			songs = map[string]map[string]string{}
			st.variations[bookID] = songs
		}
		if songs[path] == nil {
			songs[path] = map[string]string{}
		}
		songs[path][tuningID] = *variation
	})
}

// Place is the item being played in the setlist at path in bookID; false when
// none is kept.
func (s *Store) Place(bookID, setlist string) (at int, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	at, ok = s.state.places[bookID][setlist]
	return at, ok
}

// SetPlace keeps the place in one setlist (protocol Place, design §6).
func (s *Store) SetPlace(bookID, setlist string, at int) error {
	return s.mutate(func(st *state) { setIn(st.places, bookID, setlist, &at) })
}

func setIn(m map[string]map[string]int, bookID, path string, v *int) {
	if v == nil {
		delete(m[bookID], path)
		if len(m[bookID]) == 0 {
			delete(m, bookID)
		}
		return
	}
	if m[bookID] == nil {
		m[bookID] = map[string]int{}
	}
	m[bookID][path] = *v
}

// ShapesShown is whether shapes are shown, for every song; true when never set.
func (s *Store) ShapesShown() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return !s.state.shapesHidden
}

// SetShapesShown keeps Hide shapes / Show shapes (workflow 19 §A song).
func (s *Store) SetShapesShown(shown bool) error {
	return s.mutate(func(st *state) { st.shapesHidden = !shown })
}

// Hidden reports whether v is hidden.
func (s *Store) Hidden(v Voicing) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.state.hidden[v]
	return ok
}

// HiddenCount is how many voicings are hidden, for Settings.
func (s *Store) HiddenCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.state.hidden)
}

// Hide hides v in every song; hiding it again changes nothing.
func (s *Store) Hide(v Voicing) error {
	return s.mutate(func(st *state) { st.hidden[v] = struct{}{} })
}

// Show shows one hidden voicing again.
func (s *Store) Show(v Voicing) error {
	return s.mutate(func(st *state) { delete(st.hidden, v) })
}

// ShowAll shows every hidden voicing again.
func (s *Store) ShowAll() error {
	return s.mutate(func(st *state) { st.hidden = map[Voicing]struct{}{} })
}

// LastSync is when the last sync finished, false before the first (the
// shelf's *Synced at 14:32*, *Not connected — showing what was synced at
// 09:10*, across a restart too; workflow 19 §The shelf).
func (s *Store) LastSync() (time.Time, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state.lastSync, !s.state.lastSync.IsZero()
}

// SetLastSync keeps when a sync finished.
func (s *Store) SetLastSync(t time.Time) error {
	return s.mutate(func(st *state) { st.lastSync = t })
}

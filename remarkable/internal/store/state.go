package store

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
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
// per setlist, whether shapes are shown, and the voicings hidden.
type state struct {
	keys         map[string]map[string]int // bookId → song path → offset
	places       map[string]map[string]int // bookId → setlist path → item index
	shapesHidden bool
	hidden       map[Voicing]struct{}
}

type stateJSON struct {
	Version      int                       `json:"version"`
	Keys         map[string]map[string]int `json:"keys,omitempty"`
	Places       map[string]map[string]int `json:"places,omitempty"`
	ShapesHidden bool                      `json:"shapesHidden,omitempty"`
	Hidden       []Voicing                 `json:"hidden,omitempty"`
}

func newState() state {
	return state{
		keys:   map[string]map[string]int{},
		places: map[string]map[string]int{},
		hidden: map[Voicing]struct{}{},
	}
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
	return st
}

func (st state) encode() ([]byte, error) {
	j := stateJSON{Version: stateVersion, Keys: st.keys, Places: st.places, ShapesHidden: st.shapesHidden}
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

package backend

// The filler (reader.missed_shapes; docs/remarkable-reader.md §4.1): the
// background search for the chords the default-shape table did not hold. One
// goroutine, started by Serve and ended with it, sleeps until the views nudge
// it — after a sheet with an empty place — and then fills the engine's queued
// misses one at a time, in queue order, on the engine's lower lane, so a
// reading call never waits behind a search. After each search it tells Serve's
// loop, which lets the views send what it filled (108 shapes).
//
// It searches only what is queued, holds no view state, and writes nothing:
// what it finds lives in the bundle session's cache until the next Load that
// reloads. It logs nothing — no chord, no song.

import (
	"context"
	"errors"

	"estantedecifras.app/remarkable/internal/engine"
)

// filler runs the background search over an engine.
type filler struct {
	eng Engine
	// nudges holds at most one pending nudge: a nudge while one is pending
	// is dropped (the round it starts reads the whole queue anyway).
	nudges chan struct{}
	// found holds at most one pending event for Serve's loop: the views read
	// the open song again on it, which sees every search done before it.
	found chan struct{}
}

func newFiller(eng Engine) *filler {
	return &filler{eng: eng, nudges: make(chan struct{}, 1), found: make(chan struct{}, 1)}
}

// nudge asks for a round; it never blocks.
func (f *filler) nudge() {
	select {
	case f.nudges <- struct{}{}:
	default:
	}
}

// run sleeps until nudged and fills the queue on each nudge, until ctx ends.
func (f *filler) run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-f.nudges:
		}
		f.round(ctx)
	}
}

// round fills the queued misses in order until none is left to try: a fill a
// reading call preempted starts again from the queue (the miss is still
// first); a fill that failed otherwise is skipped until the next nudge.
func (f *filler) round(ctx context.Context) {
	skip := map[string]bool{}
	for ctx.Err() == nil {
		misses, err := f.eng.Misses(ctx)
		if err != nil {
			return
		}
		chord, ok := "", false
		for _, m := range misses {
			if !skip[m.Chord] {
				chord, ok = m.Chord, true
				break
			}
		}
		if !ok {
			return
		}
		got, err := f.eng.Fill(ctx, chord)
		switch {
		case errors.Is(err, engine.ErrPreempted):
			continue
		case err != nil:
			skip[chord] = true
			continue
		case !got.Searched:
			// No longer queued (a Load cleared it); never loop on it.
			skip[chord] = true
			continue
		}
		select {
		case f.found <- struct{}{}:
		default:
		}
	}
}

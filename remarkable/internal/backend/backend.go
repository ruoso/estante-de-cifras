// Package backend is the reader's message loop (docs/remarkable-reader.md §3.2,
// §6): what estante-reader does once AppLoad has started it as the app
// folder's backend/entry and it has dialled the socket. It runs the sync
// schedule (§5.3), answers each hello with the reader's state, sends a fresh
// state whenever the sync status changes, triggers a sync when a frontend
// attaches or asks for one, and ends on AppLoad's terminate or when the
// socket closes.
//
// The views — open, key, place and the shapes' messages — are answered in
// views.go (reader.backend_views); pair and signOut in pairing.go
// (reader.pairing), the poll running off the loop and its news reaching the
// views on it. The
// background search for the shapes the table did not hold is fill.go's
// (reader.missed_shapes): its news reaches the views on this loop. A staged
// bundle is switched to in update.go (reader.self_update): on a frontend's
// attach, before its hello is answered, or at the end of a pass when no
// engine is loaded.
package backend

import (
	"context"
	"errors"
	"io"
	gosync "sync"
	"time"

	pairing "estantedecifras.app/remarkable/internal/pair"
	"estantedecifras.app/remarkable/internal/protocol"
	"estantedecifras.app/remarkable/internal/store"
	"estantedecifras.app/remarkable/internal/sync"
)

// Syncer is the sync schedule Serve runs (*sync.Syncer satisfies it): Run
// passes until its context ends, Trigger asks for one more pass, Snapshot is
// the last pass's snapshot the views read, Hold keeps a book's clone on disk
// while a view reads it, SignOut signs the device out (reader.pairing), and
// UseEngine loads the instrument on a new bundle's engine and, when it loads,
// adopts it (reader.self_update).
type Syncer interface {
	Run(ctx context.Context)
	Trigger()
	Snapshot() *sync.Snapshot
	Hold(bookID string) (release func())
	SignOut(ctx context.Context) error
	UseEngine(ctx context.Context, eng sync.Engine) error
	// Roster is what the last instrument load offered to choose from;
	// ReloadInstrument loads again after one is chosen here (workflow 19
	// §Settings).
	Roster() sync.Roster
	ReloadInstrument(ctx context.Context) error
}

// Updates is a release staged by the self-update, waiting to be swapped in.
type Updates interface {
	Ready() bool
	Swap() error
}

// Deps are Serve's collaborators.
type Deps struct {
	// Store is the device's store: the session, the last sync, the shapes'
	// switch.
	Store *store.Store
	// Syncer is the schedule; Serve starts its Run and calls its Trigger.
	Syncer Syncer
	// Relay carries the syncer's statuses to the connection: its StatusFunc
	// is the syncer's sync.Options.OnStatus. Nil: no status but the first.
	Relay *Relay
	// Now is the clock (time.Now when nil).
	Now func() time.Time
	// Engine computes the music the views show; nil when no bundle is
	// installed or it failed to open (then songs and setlists answer their
	// book). Never a typed-nil pointer. When a staged bundle is switched to,
	// the one it replaces is closed when it has a Close method.
	Engine Engine
	// Version is the reader's version, which Settings names.
	Version string
	// Pair begins and polls a pairing with the service at its Origin, which
	// the session it brings is kept for (reader.pairing). Nil: a pair is
	// answered as an expired code.
	Pair *pairing.Client
	// Updates is the self-update's staged release (design §8): once one is
	// ready and no frontend is attached, Serve swaps it in and returns, so
	// the next launch runs it. Nil: no self-update.
	Updates Updates

	// onParse is told of each file the book listing parses (tests only).
	onParse func()
}

// Relay holds the last sync status and, while Serve runs, the connection a
// fresh state is written to on each status. It is made before the syncer,
// whose OnStatus is its StatusFunc, and handed to Serve in Deps.
type Relay struct {
	mu     gosync.Mutex
	status *sync.Status
	conn   *protocol.Conn
	st     *store.Store
	// firstPass: a pairing was approved and its first pass has not ended —
	// states say not paired until it does (reader.pairing Decision 2).
	firstPass bool
	// passEnded holds at most one pending "a pass ended" for Serve's loop,
	// which switches to a staged bundle then when no engine is loaded
	// (reader.self_update Decision 5).
	passEnded chan struct{}
}

// NewRelay makes a Relay with no status yet.
func NewRelay() *Relay { return &Relay{passEnded: make(chan struct{}, 1)} }

// StatusFunc is the function to give sync.Options.OnStatus: it keeps the
// status and, while connected, writes the state it makes.
func (r *Relay) StatusFunc() func(sync.Status) {
	return func(s sync.Status) {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.status = &s
		if !s.Syncing {
			// The first pass after an approval ended, done or failed: the
			// reader reports itself paired from this state on.
			r.firstPass = false
			select {
			case r.passEnded <- struct{}{}:
			default:
			}
		}
		if r.conn != nil {
			// A failed write ends the connection, which Serve's loop reads.
			_ = r.conn.Write(r.stateLocked())
		}
	}
}

// attach makes conn the connection statuses are written to, reading the
// store st; detach (conn nil) stops it.
func (r *Relay) attach(conn *protocol.Conn, st *store.Store) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.conn, r.st = conn, st
}

// sendState writes the state now to conn, under the lock statuses write
// under, so states reach the frontend in the order they were made.
func (r *Relay) sendState(conn *protocol.Conn) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return conn.Write(r.stateLocked())
}

// approved marks a pairing approved: the earlier status (a refusal's
// error among it) is forgotten, and states say not paired until the first
// pass ends.
func (r *Relay) approved() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.status, r.firstPass = nil, true
}

// unapproved undoes approved, for a session the store could not keep.
func (r *Relay) unapproved() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.firstPass = false
}

// clearError forgets the last status's error: a refusal's signedOut is kept
// until the next pairing begins.
func (r *Relay) clearError() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.status != nil {
		st := *r.status
		st.Error = ""
		r.status = &st
	}
}

// reset forgets the last status: after a sign out, the state is not paired
// with no error.
func (r *Relay) reset() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.status, r.firstPass = nil, false
}

// stateLocked builds the state (design §6, 101 state): paired, shapesShown
// and lastSync from the store; syncing, online and error from the last
// status, or not syncing, online and no error before any.
func (r *Relay) stateLocked() protocol.State {
	s := protocol.State{Online: true, ShapesShown: true}
	if r.st != nil {
		_, s.Paired = r.st.Session()
		s.Paired = s.Paired && !r.firstPass
		s.ShapesShown = r.st.ShapesShown()
		s.TextSize = r.st.TextSize()
		if t, ok := r.st.LastSync(); ok {
			v := t.Format(time.RFC3339)
			s.LastSync = &v
		}
	}
	if r.status != nil {
		s.Syncing = r.status.Syncing
		s.Online = r.status.Online
		s.Error = r.status.Error
	}
	return s
}

// Serve runs the loop over conn until AppLoad's terminate, the socket's
// close, or ctx's end. It starts b.Syncer's Run first (the pass at backend
// start, §5.3) and, on returning, cancels it, waits for it, and closes conn.
// Terminate and the socket's close return nil; ctx's end returns its error;
// a broken connection returns the protocol's error, which names no payload.
//
// The socket is read in its own goroutine, and the loop selects over its
// messages and the filler's news, so the views run on the loop's goroutine
// alone.
func Serve(ctx context.Context, conn *protocol.Conn, b Deps) error {
	relay := b.Relay
	if relay == nil {
		relay = NewRelay()
	}
	relay.attach(conn, b.Store)
	defer relay.attach(nil, nil)

	syncCtx, cancelSync := context.WithCancel(ctx)
	ran := make(chan struct{})
	go func() {
		defer close(ran)
		b.Syncer.Run(syncCtx)
	}()
	// ctx's end unblocks Next by closing conn.
	stop := context.AfterFunc(ctx, func() { conn.Close() })
	v := newViews(ctx, conn, relay, b)
	defer v.close()

	// The filler, with the engine (none without one); started again with
	// each bundle switched to.
	fill := startFiller(ctx, v, b.Engine)
	sw := &switcher{ctx: ctx, st: b.Store, syncer: b.Syncer}
	defer sw.closeOpened()

	// The socket's reader: each message, or its error, handed to the loop.
	type incoming struct {
		m   protocol.Message
		err error
	}
	msgs := make(chan incoming)
	done := make(chan struct{})
	read := make(chan struct{})
	go func() {
		defer close(read)
		for {
			m, err := conn.Next()
			select {
			case msgs <- incoming{m, err}:
			case <-done:
				return
			}
			var pe *protocol.PayloadError
			if err != nil && !errors.As(err, &pe) {
				return
			}
		}
	}()

	defer func() {
		stop()
		cancelSync()
		fill.stop()
		close(done)
		conn.Close()
		<-ran
		<-read
	}()

	// How many frontends AppLoad says are attached (its −2 and −3).
	frontends := 0
	for {
		var in incoming
		select {
		case in = <-msgs:
		case n := <-v.pairCh:
			if err := v.pairingNews(n); err != nil {
				return err
			}
			continue
		case <-fill.found:
			if err := v.found(); err != nil {
				return err
			}
			continue
		case <-relay.passEnded:
			// The first bundle: with none loaded, nothing on screen depends
			// on one (Decision 5).
			if v.eng == nil {
				fill = sw.switchBundle(v, fill)
			}
			if swapped(b.Updates, frontends) {
				return nil
			}
			continue
		}
		m, err := in.m, in.err
		var pe *protocol.PayloadError
		switch {
		case errors.As(err, &pe):
			continue // that message is lost; the connection is not
		case errors.Is(err, io.EOF):
			return nil
		case errors.Is(err, protocol.ErrClosed) && ctx.Err() != nil:
			return ctx.Err()
		case err != nil:
			return err
		}
		switch m.(type) {
		case protocol.Terminate:
			return nil
		case protocol.Hello:
			if err := relay.sendState(conn); err != nil {
				return err
			}
		case protocol.Attached:
			frontends = m.(protocol.Attached).Frontends
			// Before this frontend's hello and opens are answered, and
			// never a redraw (workflow 19 rule 5).
			fill = sw.switchBundle(v, fill)
			b.Syncer.Trigger()
		case protocol.Sync:
			b.Syncer.Trigger()
		case protocol.Detached:
			// The schedule goes on without a frontend — unless a release is
			// staged: with none attached it is swapped in, and the backend
			// ends so the next launch runs it.
			frontends = m.(protocol.Detached).Frontends
			if swapped(b.Updates, frontends) {
				return nil
			}
		default:
			if err := v.handle(m); err != nil {
				return err
			}
		}
	}
}

// swapped swaps a staged release in when no frontend is attached, and
// reports whether it did (the backend then ends). A swap that fails leaves
// the folder as it was, and the backend runs on.
func swapped(u Updates, frontends int) bool {
	if u == nil || frontends > 0 || !u.Ready() {
		return false
	}
	return u.Swap() == nil
}

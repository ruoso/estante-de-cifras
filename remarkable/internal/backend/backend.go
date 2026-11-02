// Package backend is the reader's message loop (docs/remarkable-reader.md §3.2,
// §6): what estante-reader does once AppLoad has started it as the app
// folder's backend/entry and it has dialled the socket. It runs the sync
// schedule (§5.3), answers each hello with the reader's state, sends a fresh
// state whenever the sync status changes, triggers a sync when a frontend
// attaches or asks for one, and ends on AppLoad's terminate or when the
// socket closes.
//
// The views — open, key, place and the shapes' messages — are answered in
// views.go (reader.backend_views); signOut and pair are reader.pairing's. The
// background search for the shapes the table did not hold is fill.go's
// (reader.missed_shapes): its news reaches the views on this loop.
package backend

import (
	"context"
	"errors"
	"io"
	gosync "sync"
	"time"

	"estantedecifras.app/remarkable/internal/protocol"
	"estantedecifras.app/remarkable/internal/store"
	"estantedecifras.app/remarkable/internal/sync"
)

// Syncer is the sync schedule Serve runs (*sync.Syncer satisfies it): Run
// passes until its context ends, Trigger asks for one more pass, Snapshot is
// the last pass's snapshot the views read, and Hold keeps a book's clone on
// disk while a view reads it.
type Syncer interface {
	Run(ctx context.Context)
	Trigger()
	Snapshot() *sync.Snapshot
	Hold(bookID string) (release func())
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
	// book). Never a typed-nil pointer.
	Engine Engine
	// Version is the reader's version, which Settings names.
	Version string

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
}

// NewRelay makes a Relay with no status yet.
func NewRelay() *Relay { return &Relay{} }

// StatusFunc is the function to give sync.Options.OnStatus: it keeps the
// status and, while connected, writes the state it makes.
func (r *Relay) StatusFunc() func(sync.Status) {
	return func(s sync.Status) {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.status = &s
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

// stateLocked builds the state (design §6, 101 state): paired, shapesShown
// and lastSync from the store; syncing, online and error from the last
// status, or not syncing, online and no error before any.
func (r *Relay) stateLocked() protocol.State {
	s := protocol.State{Online: true, ShapesShown: true}
	if r.st != nil {
		_, s.Paired = r.st.Session()
		s.ShapesShown = r.st.ShapesShown()
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

	// The filler, with the engine (none without one).
	fillCtx, cancelFill := context.WithCancel(ctx)
	filled := make(chan struct{})
	var found <-chan struct{}
	if b.Engine != nil {
		f := newFiller(b.Engine)
		v.nudge, found = f.nudge, f.found
		go func() {
			defer close(filled)
			f.run(fillCtx)
		}()
	} else {
		close(filled)
	}

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
		cancelFill()
		close(done)
		conn.Close()
		<-ran
		<-filled
		<-read
	}()

	for {
		var in incoming
		select {
		case in = <-msgs:
		case <-found:
			if err := v.found(); err != nil {
				return err
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
		case protocol.Attached, protocol.Sync:
			b.Syncer.Trigger()
		case protocol.Detached:
			// The schedule goes on without a frontend.
		default:
			if err := v.handle(m); err != nil {
				return err
			}
		}
	}
}

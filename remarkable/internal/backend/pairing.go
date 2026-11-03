package backend

// Pairing and signing out (reader.pairing; docs/remarkable-reader.md §5.1 *On
// the device*, §6 `5 pair`, `6 signOut`, `102 pairing`; workflow 19
// §Pairing, §The shelf).
//
// `5 pair` on an unpaired reader begins a pairing in its own goroutine: the
// begin, then the poll every three seconds with the poll token, which lives
// in that goroutine alone and goes with it. Its news — the code, then how it
// ended — reaches the views on the loop's goroutine, where the code is
// answered as one `102`, and nothing more is sent until the pairing ends
// (rule 5): `102 {expired:true}`, `102 {offline:true}`, or — approved — the
// session kept and the first sync triggered, the relay reporting the reader
// paired when that pass ends (Decision 2). A new `5 pair` (*Get a new code*)
// stops the one in progress first, so its token is never polled again.
//
// `6 signOut` signs the device out through the syncer — the pass in flight
// cancelled, the service asked within its bound, the store cleared but the
// bundle — and answers the state, not paired, with no error.
//
// Nothing here logs; no code, token or session is in an error.

import (
	"context"
	"errors"
	"time"

	pairing "estantedecifras.app/remarkable/internal/pair"
	"estantedecifras.app/remarkable/internal/protocol"
	"estantedecifras.app/remarkable/internal/store"
)

// pairNews is the pairing goroutine's news for the loop: the code to show,
// or how it ended — a session, or an error.
type pairNews struct {
	gen     int
	code    *pairing.Code
	session string
	err     error
}

// pair answers `5 pair`: the state when already paired (nothing begun);
// otherwise any pairing in progress is stopped and a new one begun.
func (v *views) pair() error {
	if _, paired := v.st.Session(); paired {
		return v.relay.sendState(v.conn)
	}
	v.stopPairing()
	// A refusal's signedOut is kept until the next pairing begins.
	v.relay.clearError()
	if v.pairer == nil {
		return v.conn.Write(protocol.Pairing{Expired: true})
	}
	ctx, cancel := context.WithCancel(v.ctx)
	v.pairGen++
	v.pairCancel = cancel
	gen, client, out := v.pairGen, v.pairer, v.pairCh
	v.pairRunning.Add(1)
	go func() {
		defer v.pairRunning.Done()
		runPairing(ctx, client, gen, out)
	}()
	return nil
}

// runPairing begins, tells the code, waits, and tells how it ended. The
// Pairing — the poll token — is this goroutine's alone.
func runPairing(ctx context.Context, c *pairing.Client, gen int, out chan<- pairNews) {
	tell := func(n pairNews) bool {
		select {
		case out <- n:
			return true
		case <-ctx.Done():
			return false
		}
	}
	p, err := c.Begin(ctx)
	if err != nil {
		tell(pairNews{gen: gen, err: err})
		return
	}
	code := p.Code()
	if !tell(pairNews{gen: gen, code: &code}) {
		return
	}
	session, err := c.Wait(ctx, p)
	tell(pairNews{gen: gen, session: session, err: err})
}

// stopPairing cancels the pairing in progress, if any, and waits for its
// goroutine to end: its token is dropped with it.
func (v *views) stopPairing() {
	if v.pairCancel != nil {
		v.pairCancel()
		v.pairCancel = nil
	}
	v.pairRunning.Wait()
}

// pairingNews answers the pairing's news on the loop: the code as `102`;
// an end as `102` expired or offline; an approval by keeping the session and
// triggering the first sync. News of a pairing stopped since is dropped.
func (v *views) pairingNews(n pairNews) error {
	if n.gen != v.pairGen || v.pairCancel == nil {
		return nil
	}
	if n.code != nil {
		return v.conn.Write(protocol.Pairing{Code: n.code.Code, URL: n.code.URL, ExpiresAt: n.code.ExpiresAt})
	}
	v.pairCancel()
	v.pairCancel = nil
	switch {
	case errors.Is(n.err, pairing.ErrOffline):
		return v.conn.Write(protocol.Pairing{Offline: true})
	case n.err != nil && v.ctx.Err() != nil:
		return nil // Serve is ending
	case n.err != nil:
		return v.conn.Write(protocol.Pairing{Expired: true})
	}
	// Approved: states say not paired until the first pass ends.
	v.relay.approved()
	if err := v.st.SetSession(store.Session{
		Origin:   pairing.OriginString(v.pairer.Origin),
		Token:    n.session,
		PairedAt: time.Now().UTC(),
	}); err != nil {
		v.relay.unapproved()
		return v.conn.Write(protocol.Pairing{Expired: true})
	}
	v.listings = map[listingKey]listing{}
	v.sync.Trigger()
	return nil
}

// signOut answers `6 signOut`: the view stays on screen while the syncer
// signs the device out (bounded: SignOut waits on the network for a few
// seconds at most), then the state — not paired, no error.
func (v *views) signOut() error {
	v.stopPairing()
	v.leave()
	v.listings = map[listingKey]listing{}
	// The store's failure leaves what it could not remove; the state says
	// what the store holds.
	_ = v.sync.SignOut(v.ctx)
	v.relay.reset()
	return v.relay.sendState(v.conn)
}

package backend

// Switching to a staged bundle (reader.self_update constraint 9;
// docs/remarkable-reader.md §8): on a frontend's attach, before its hello and
// opens are answered, and at the end of a pass when no engine is loaded. The
// bundle is promoted, opened and has the instrument in use loaded in it by the
// syncer (UseEngine); any step failing rolls it back and refuses it, and the
// engine that was running goes on. When all succeed the views and the filler
// are handed the new engine here, on Serve's goroutine, and the old one is
// closed once none of them holds it. Switching sends nothing: the screen on
// view is never redrawn by it (workflow 19 rule 5).

import (
	"context"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/store"
	"estantedecifras.app/remarkable/internal/sync"
	"estantedecifras.app/remarkable/internal/update"
)

// fillRun is one filler's run over one engine.
type fillRun struct {
	found  <-chan struct{}
	cancel context.CancelFunc
	done   chan struct{}
}

// startFiller starts the filler over eng and hands the views its nudge; with
// no engine there is no filler and no nudge.
func startFiller(ctx context.Context, v *views, eng Engine) *fillRun {
	r := &fillRun{done: make(chan struct{})}
	if eng == nil {
		v.nudge = nil
		r.cancel = func() {}
		close(r.done)
		return r
	}
	fctx, cancel := context.WithCancel(ctx)
	f := newFiller(eng)
	v.nudge, r.found, r.cancel = f.nudge, f.found, cancel
	go func() {
		defer close(r.done)
		f.run(fctx)
	}()
	return r
}

// stop ends the run and waits for it.
func (r *fillRun) stop() {
	r.cancel()
	<-r.done
}

// switcher switches bundles for one Serve.
type switcher struct {
	ctx    context.Context
	st     *store.Store
	syncer Syncer
	// opened is the engine this Serve opened and has in use (nil when the
	// one in use is Deps.Engine, which its owner closes).
	opened *engine.Engine
}

// switchBundle switches to the staged bundle, when there is one and it opens;
// it answers the filler run now in use.
func (sw *switcher) switchBundle(v *views, fill *fillRun) *fillRun {
	if sw.st == nil {
		return fill
	}
	if _, staged := sw.st.StagedBundleDir(); !staged {
		return fill
	}
	eng, err := update.Switch(sw.st, func(e *engine.Engine) error {
		return sw.syncer.UseEngine(sw.ctx, sync.Engine(e))
	})
	if err != nil {
		// Rolled back and refused: the engine that was running goes on.
		return fill
	}
	fill.stop()
	old := v.eng
	v.eng = eng
	next := startFiller(sw.ctx, v, eng)
	if old != nil {
		if c, ok := old.(interface{ Close() error }); ok {
			c.Close()
		}
	}
	sw.opened = eng
	return next
}

// closeOpened closes the engine this Serve opened, once Serve is done with it.
func (sw *switcher) closeOpened() {
	if sw.opened != nil {
		sw.opened.Close()
	}
}

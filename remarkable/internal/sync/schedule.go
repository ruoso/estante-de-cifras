package sync

// When a pass runs (design §5.3): at backend start, when the frontend
// attaches and on *Sync* (the backend calls Trigger for both), and every
// fifteen minutes while the device is on Wi-Fi. At most one pass runs, and a
// trigger during a pass makes at most one more after it.

import (
	"context"
	"time"
)

// Interval is the periodic pass's period, while Online.
const Interval = 15 * time.Minute

// passTimeout bounds one pass run by the schedule.
const passTimeout = 10 * time.Minute

// Run passes until ctx ends: once at start, once after each Trigger
// (coalesced), and on each Interval tick while Online.
func (s *Syncer) Run(ctx context.Context) {
	tick, stop := s.newTicker(Interval)
	defer stop()
	s.runPass(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.trigger:
			s.runPass(ctx)
		case <-tick:
			if s.opts.Online() {
				s.runPass(ctx)
			}
		}
	}
}

// Trigger asks for a pass. Never blocks: triggers that arrive while one is
// already pending are one trigger.
func (s *Syncer) Trigger() {
	select {
	case s.trigger <- struct{}{}:
	default:
	}
}

func (s *Syncer) runPass(ctx context.Context) {
	if ctx.Err() != nil {
		return
	}
	pctx, cancel := context.WithTimeout(ctx, passTimeout)
	defer cancel()
	// The outcome reaches the screens through OnStatus and the snapshot.
	_, _ = s.pass(pctx)
}

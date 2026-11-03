package update

// Switching to a staged bundle and keeping the last good one (constraints 9
// and 10; Decision 3): promote, open, have the instrument load in it — and,
// when any step fails, roll back to the bundle that was running and remember
// the failed one as refused, so no later check fetches it again.

import (
	"errors"
	"fmt"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/store"
)

// ErrNoStaged is Switch's answer when nothing is staged.
var ErrNoStaged = errors.New("update: switch: nothing staged")

// Switch promotes the staged bundle, opens it, and hands it to ready (which
// loads the instrument in use on it, and adopts it when that succeeds). When
// any step fails the bundle is rolled back and refused, and the error says
// which step; the engine that was running is the caller's to keep.
func Switch(st *store.Store, ready func(*engine.Engine) error) (*engine.Engine, error) {
	if _, ok := st.StagedBundleDir(); !ok {
		return nil, ErrNoStaged
	}
	if err := st.PromoteBundle(); err != nil {
		return nil, fmt.Errorf("update: switch: promote: %w", err)
	}
	dir, _ := st.BundleDir()
	sha := BundleSHA(dir)
	e, err := engine.Open(dir)
	if err != nil {
		return nil, errors.Join(fmt.Errorf("update: switch: open: %w", err), refuse(st, sha))
	}
	if err := ready(e); err != nil {
		e.Close()
		return nil, errors.Join(fmt.Errorf("update: switch: instrument: %w", err), refuse(st, sha))
	}
	return e, nil
}

// refuse rolls the current bundle back to the previous one and remembers the
// current one's SHA-256 as refused. With no previous the refused bundle stays
// current (nothing better is on disk) and opens as none.
func refuse(st *store.Store, sha string) error {
	var errs []error
	if sha != "" {
		if err := st.RefuseBundle(sha); err != nil {
			errs = append(errs, err)
		}
	}
	if err := st.RollbackBundle(); err != nil && !errors.Is(err, store.ErrNoPrevious) {
		errs = append(errs, err)
	}
	return errors.Join(errs...)
}

// OpenCurrent opens bundle/current at backend start (constraint 10): one that
// does not open is rolled back and refused, again, until one opens or there is
// no previous. It answers nil when no bundle opens (the backend then runs
// with no engine).
func OpenCurrent(st *store.Store) *engine.Engine {
	for {
		dir, ok := st.BundleDir()
		if !ok {
			return nil
		}
		e, err := engine.Open(dir)
		if err == nil {
			return e
		}
		sha := BundleSHA(dir)
		if sha != "" {
			_ = st.RefuseBundle(sha)
		}
		if st.RollbackBundle() != nil {
			return nil
		}
	}
}

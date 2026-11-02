package sync

// unit — when a pass runs (reader.sync; docs/remarkable-reader.md §5.3): at
// start, on each Trigger, every fifteen minutes while online, at most one
// running and one pending; and the status the shelf's sync line reads around
// a pass (workflow 19 §The shelf). The clock — the ticker — is injected.

import (
	"context"
	"errors"
	gosync "sync"
	"testing"
	"time"
)

// scheduled is a Syncer whose passes are counted, each blocking until the
// test lets it finish, and whose ticker the test drives.
type scheduled struct {
	s       *Syncer
	tick    chan time.Time
	period  chan time.Duration
	started chan int      // the pass number, as each begins
	finish  chan struct{} // one send lets one pass finish
	online  bool
	mu      gosync.Mutex
	stop    func()
}

func newScheduled(t *testing.T) *scheduled {
	t.Helper()
	sc := &scheduled{
		tick:    make(chan time.Time),
		period:  make(chan time.Duration, 1),
		started: make(chan int, 16),
		finish:  make(chan struct{}),
	}
	n := 0
	s := &Syncer{trigger: make(chan struct{}, 1)}
	s.opts.Online = func() bool { sc.mu.Lock(); defer sc.mu.Unlock(); return sc.online }
	s.newTicker = func(d time.Duration) (<-chan time.Time, func()) {
		sc.period <- d
		return sc.tick, func() {}
	}
	s.pass = func(ctx context.Context) (Result, error) {
		n++
		sc.started <- n
		select {
		case <-sc.finish:
		case <-ctx.Done():
		}
		return Result{}, nil
	}
	sc.s = s
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()
	sc.stop = func() { cancel(); <-done }
	t.Cleanup(sc.stop)
	return sc
}

func (sc *scheduled) setOnline(v bool) { sc.mu.Lock(); sc.online = v; sc.mu.Unlock() }

// wantStart waits for pass number n to begin.
func (sc *scheduled) wantStart(t *testing.T, n int) {
	t.Helper()
	select {
	case got := <-sc.started:
		if got != n {
			t.Fatalf("pass %d began, want %d", got, n)
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("pass %d never began", n)
	}
}

// wantNoStart checks no pass begins for a while.
func (sc *scheduled) wantNoStart(t *testing.T) {
	t.Helper()
	select {
	case got := <-sc.started:
		t.Fatalf("pass %d began, want none", got)
	case <-time.After(100 * time.Millisecond):
	}
}

func (sc *scheduled) finishOne(t *testing.T) {
	t.Helper()
	select {
	case sc.finish <- struct{}{}:
	case <-time.After(5 * time.Second):
		t.Fatal("no pass to finish")
	}
}

// TestPassAtStartAndOnTrigger pins §5.3: a pass at backend start, and one on
// each trigger (attach, Sync).
func TestPassAtStartAndOnTrigger(t *testing.T) {
	sc := newScheduled(t)
	sc.wantStart(t, 1)
	sc.finishOne(t)
	sc.wantNoStart(t)
	sc.s.Trigger()
	sc.wantStart(t, 2)
	sc.finishOne(t)
	sc.s.Trigger()
	sc.wantStart(t, 3)
	sc.finishOne(t)
	sc.wantNoStart(t)
}

// TestEveryFifteenMinutesOnlyOnline pins §5.3: the periodic pass is every
// fifteen minutes, and only while the device is on Wi-Fi.
func TestEveryFifteenMinutesOnlyOnline(t *testing.T) {
	sc := newScheduled(t)
	if d := <-sc.period; d != 15*time.Minute {
		t.Errorf("period %v, want 15m", d)
	}
	sc.wantStart(t, 1)
	sc.finishOne(t)

	sc.setOnline(false)
	sc.tick <- time.Now()
	sc.wantNoStart(t)

	sc.setOnline(true)
	sc.tick <- time.Now()
	sc.wantStart(t, 2)
	sc.finishOne(t)
	sc.wantNoStart(t)
}

// TestTriggersCoalesce pins "one pass at a time": three triggers during a
// pass make one more pass after it.
func TestTriggersCoalesce(t *testing.T) {
	sc := newScheduled(t)
	sc.wantStart(t, 1)
	sc.s.Trigger()
	sc.s.Trigger()
	sc.s.Trigger()
	sc.finishOne(t)
	sc.wantStart(t, 2)
	sc.finishOne(t)
	sc.wantNoStart(t)
}

// TestPassesNeverOverlap pins that Pass itself runs one at a time, called
// from anywhere.
func TestPassesNeverOverlap(t *testing.T) {
	f := newFakeService(t)
	twoBooks(t, f)
	s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
	var mu gosync.Mutex
	running, most := 0, 0
	s.opts.OnStatus = func(st Status) {
		mu.Lock()
		defer mu.Unlock()
		if st.Syncing {
			running++
		} else {
			running--
		}
		most = max(most, running)
	}
	var wg gosync.WaitGroup
	for range 3 {
		wg.Add(1)
		go func() { defer wg.Done(); s.Pass(context.Background()) }()
	}
	wg.Wait()
	if most != 1 {
		t.Errorf("%d passes ran at once", most)
	}
}

// TestStatusAroundAPass pins workflow 19 §The shelf's two changes of the
// sync line: Syncing when a pass begins, and its outcome when it ends —
// LastSync on success; offline, with the previous LastSync, when the service
// cannot be reached.
func TestStatusAroundAPass(t *testing.T) {
	f := newFakeService(t)
	twoBooks(t, f)
	st := newTestStore(t, f)
	var statuses []Status
	now := time.Date(2026, 11, 1, 14, 32, 0, 0, time.UTC)
	s := New(st, newFakeEngine(), Options{
		HTTPClient: f.srv.Client(),
		Now:        func() time.Time { return now },
		OnStatus:   func(x Status) { statuses = append(statuses, x) },
	})
	mustPass(t, s)
	if len(statuses) != 2 {
		t.Fatalf("statuses %+v, want two", statuses)
	}
	if !statuses[0].Syncing || !statuses[0].LastSync.IsZero() {
		t.Errorf("begin %+v, want syncing with no last sync", statuses[0])
	}
	if end := statuses[1]; end.Syncing || !end.Online || !end.LastSync.Equal(now) || end.Error != "" {
		t.Errorf("end %+v, want online, synced at %v", end, now)
	}

	statuses = nil
	first := now
	now = now.Add(time.Hour)
	f.srv.Close()
	if _, err := s.Pass(context.Background()); !errors.Is(err, errOffline) {
		t.Fatalf("Pass: %v, want offline", err)
	}
	if len(statuses) != 2 || !statuses[0].Syncing || !statuses[0].LastSync.Equal(first) {
		t.Fatalf("statuses %+v", statuses)
	}
	if end := statuses[1]; end.Syncing || end.Online || end.Error != ErrorOffline || !end.LastSync.Equal(first) {
		t.Errorf("end %+v, want offline showing the sync at %v", end, first)
	}
}

// TestNotPairedSendsNothing pins step 1: no session, ErrNotPaired, nothing
// sent.
func TestNotPairedSendsNothing(t *testing.T) {
	f := newFakeService(t)
	st := newTestStore(t, f)
	if err := st.ClearSession(); err != nil {
		t.Fatal(err)
	}
	s := newTestSyncer(t, f, st, newFakeEngine())
	if _, err := s.Pass(context.Background()); !errors.Is(err, ErrNotPaired) {
		t.Errorf("Pass: %v, want ErrNotPaired", err)
	}
	if n := len(f.all()); n != 0 {
		t.Errorf("%d requests without a session", n)
	}
}

// TestRunLoadsInstrumentFromDisk pins Constraint 6 of reader.backend_views
// (DIRECTION offline first): with a home book on disk and the service
// unreachable, Run loads the instrument once, before its first pass — which
// fails offline and loads nothing.
func TestRunLoadsInstrumentFromDisk(t *testing.T) {
	f := newFakeService(t)
	twoBooks(t, f)
	st := newTestStore(t, f)
	mustPass(t, newTestSyncer(t, f, st, newFakeEngine()))
	f.srv.Close()

	eng := newFakeEngine()
	type seen struct {
		status Status
		loads  int
	}
	statuses := make(chan seen, 8)
	s := New(st, eng, Options{
		HTTPClient: f.srv.Client(),
		Online:     func() bool { return true },
		OnStatus:   func(x Status) { statuses <- seen{x, eng.loadCount()} },
	})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })

	next := func() seen {
		t.Helper()
		select {
		case x := <-statuses:
			return x
		case <-time.After(10 * time.Second):
			t.Fatal("no status from the first pass")
		}
		return seen{}
	}
	if begin := next(); !begin.status.Syncing || begin.loads != 1 {
		t.Fatalf("pass began %+v with %d loads, want syncing with 1 load before it", begin.status, begin.loads)
	}
	if end := next(); end.status.Error != ErrorOffline || end.loads != 1 {
		t.Fatalf("pass ended %+v with %d loads, want offline with 1", end.status, end.loads)
	}
	eng.mu.Lock()
	defer eng.mu.Unlock()
	if got := len(eng.files); got != 1 {
		t.Errorf("%d instrument choices, want 1", got)
	}
	if string(eng.loads[0][0]) != string(eng.answer.Entry) {
		t.Errorf("loaded %s, want the bundle's choice", eng.loads[0][0])
	}
}

// TestRunWithNoHomeBookLoadsNothing pins Constraint 6's other half: nothing on
// disk, nothing loaded before the pass.
func TestRunWithNoHomeBookLoadsNothing(t *testing.T) {
	f := newFakeService(t)
	st := newTestStore(t, f)
	f.srv.Close()
	eng := newFakeEngine()
	ended := make(chan int, 4)
	s := New(st, eng, Options{
		HTTPClient: f.srv.Client(),
		Online:     func() bool { return true },
		OnStatus: func(x Status) {
			if !x.Syncing {
				ended <- eng.loadCount()
			}
		},
	})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
	select {
	case n := <-ended:
		if n != 0 {
			t.Errorf("%d loads with no home book on disk", n)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the first pass never ended")
	}
}

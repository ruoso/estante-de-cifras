package backend

// unit — the backend's message loop (reader.app_folder; docs/remarkable-reader.md
// §5.3, §6). Each test runs Serve over a real SOCK_SEQPACKET socketpair: one
// end a protocol.Conn, the other a raw peer playing AppLoad's side (which
// alone may send the system messages −1, −2, −3), with a real store in a
// temporary directory and a fake syncer recording Run and Trigger.

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net"
	"os"
	gosync "sync"
	"syscall"
	"testing"
	"time"

	"estantedecifras.app/remarkable/internal/protocol"
	"estantedecifras.app/remarkable/internal/store"
	"estantedecifras.app/remarkable/internal/sync"
)

// fakeSyncer records Run (and the context it was given) and Trigger, answers
// Snapshot with the snapshot the test sets, and counts each book's holds and
// each call of their releases (not idempotent here, so a second release of
// one hold shows).
type fakeSyncer struct {
	mu       gosync.Mutex
	runs     int
	triggers int
	runCtx   context.Context
	started  chan struct{}
	ended    chan struct{}
	trigged  chan struct{}
	snap     *sync.Snapshot
	holds    map[string]int
	releases map[string]int
}

func newFakeSyncer() *fakeSyncer {
	return &fakeSyncer{
		started:  make(chan struct{}),
		ended:    make(chan struct{}),
		trigged:  make(chan struct{}, 16),
		holds:    map[string]int{},
		releases: map[string]int{},
	}
}

func (f *fakeSyncer) Snapshot() *sync.Snapshot {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.snap
}

func (f *fakeSyncer) setSnapshot(sn *sync.Snapshot) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.snap = sn
}

func (f *fakeSyncer) Hold(bookID string) func() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.holds[bookID]++
	return func() {
		f.mu.Lock()
		defer f.mu.Unlock()
		f.releases[bookID]++
	}
}

// held is bookID's holds and releases so far.
func (f *fakeSyncer) held(bookID string) (holds, releases int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.holds[bookID], f.releases[bookID]
}

func (f *fakeSyncer) Run(ctx context.Context) {
	f.mu.Lock()
	f.runs++
	f.runCtx = ctx
	f.mu.Unlock()
	close(f.started)
	<-ctx.Done()
	close(f.ended)
}

func (f *fakeSyncer) Trigger() {
	f.mu.Lock()
	f.triggers++
	f.mu.Unlock()
	f.trigged <- struct{}{}
}

func (f *fakeSyncer) counts() (runs, triggers int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.runs, f.triggers
}

// peer is AppLoad's end of the socket: a raw fd.
type peer struct {
	t  *testing.T
	fd int
}

type frame struct {
	typ     int32
	payload []byte
}

// send writes one message as AppLoad does: a header record, then the payload
// record when there is one.
func (p *peer) send(typ int32, payload string) {
	p.t.Helper()
	hdr := make([]byte, 8)
	binary.NativeEndian.PutUint32(hdr[0:4], uint32(typ))
	binary.NativeEndian.PutUint32(hdr[4:8], uint32(len(payload)))
	if _, err := syscall.Write(p.fd, hdr); err != nil {
		p.t.Fatalf("peer send header: %v", err)
	}
	if len(payload) > 0 {
		if _, err := syscall.Write(p.fd, []byte(payload)); err != nil {
			p.t.Fatalf("peer send payload: %v", err)
		}
	}
}

// recv reads one message, failing the test after the socket's timeout.
func (p *peer) recv() frame {
	p.t.Helper()
	f, err := p.tryRecv()
	if err != nil {
		p.t.Fatalf("peer recv: %v", err)
	}
	return f
}

// read is syscall.Read, retried when a signal (the Go runtime's preemption
// among them) interrupts it.
func read(fd int, buf []byte) (int, error) {
	for {
		n, err := syscall.Read(fd, buf)
		if err != syscall.EINTR {
			return n, err
		}
	}
}

func (p *peer) tryRecv() (frame, error) {
	hdr := make([]byte, 8)
	n, err := read(p.fd, hdr)
	if err != nil {
		return frame{}, err
	}
	if n != 8 {
		return frame{}, errors.New("short header")
	}
	f := frame{typ: int32(binary.NativeEndian.Uint32(hdr[0:4]))}
	size := int(binary.NativeEndian.Uint32(hdr[4:8]))
	if size > 0 {
		f.payload = make([]byte, size)
		if n, err = read(p.fd, f.payload); err != nil {
			return frame{}, err
		}
		f.payload = f.payload[:n]
	}
	return f, nil
}

// silent asserts nothing arrives within a short while.
func (p *peer) silent() {
	p.t.Helper()
	tv := syscall.NsecToTimeval(int64(200 * time.Millisecond))
	syscall.SetsockoptTimeval(p.fd, syscall.SOL_SOCKET, syscall.SO_RCVTIMEO, &tv)
	defer p.timeout(5 * time.Second)
	if f, err := p.tryRecv(); err == nil {
		p.t.Fatalf("got message %d %s, want none", f.typ, f.payload)
	}
}

func (p *peer) timeout(d time.Duration) {
	tv := syscall.NsecToTimeval(int64(d))
	if err := syscall.SetsockoptTimeval(p.fd, syscall.SOL_SOCKET, syscall.SO_RCVTIMEO, &tv); err != nil {
		p.t.Fatalf("set SO_RCVTIMEO: %v", err)
	}
}

// state reads one message and decodes it as a state, also as a raw map so a
// test can see which keys it carries.
func (p *peer) state() (protocol.State, map[string]any) {
	p.t.Helper()
	f := p.recv()
	if f.typ != protocol.TypeState {
		p.t.Fatalf("got message %d, want %d state", f.typ, protocol.TypeState)
	}
	var s protocol.State
	var raw map[string]any
	if err := json.Unmarshal(f.payload, &s); err != nil {
		p.t.Fatalf("state payload: %v", err)
	}
	if err := json.Unmarshal(f.payload, &raw); err != nil {
		p.t.Fatalf("state payload: %v", err)
	}
	return s, raw
}

// served is one Serve running over a socketpair.
type served struct {
	peer   *peer
	syncer *fakeSyncer
	relay  *Relay
	store  *store.Store
	done   chan error
}

func pair(t *testing.T) (*protocol.Conn, *peer) {
	t.Helper()
	fds, err := syscall.Socketpair(syscall.AF_UNIX, syscall.SOCK_SEQPACKET|syscall.SOCK_CLOEXEC, 0)
	if err != nil {
		t.Fatalf("socketpair: %v", err)
	}
	f := os.NewFile(uintptr(fds[0]), "conn")
	fc, err := net.FileConn(f)
	f.Close()
	if err != nil {
		t.Fatalf("FileConn: %v", err)
	}
	c, err := protocol.NewConn(fc.(*net.UnixConn))
	if err != nil {
		t.Fatalf("NewConn: %v", err)
	}
	p := &peer{t: t, fd: fds[1]}
	p.timeout(5 * time.Second)
	t.Cleanup(func() { c.Close(); syscall.Close(p.fd) })
	return c, p
}

// serve starts Serve over a fresh socketpair, with the store at a temporary
// root prepared by setup (when not nil).
func serve(t *testing.T, setup func(*store.Store)) *served {
	t.Helper()
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	if setup != nil {
		setup(st)
	}
	conn, p := pair(t)
	s := &served{peer: p, syncer: newFakeSyncer(), relay: NewRelay(), store: st, done: make(chan error, 1)}
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		s.done <- Serve(ctx, conn, Deps{Store: st, Syncer: s.syncer, Relay: s.relay})
	}()
	t.Cleanup(func() {
		cancel()
		select {
		case <-s.done:
		case <-time.After(5 * time.Second):
			t.Error("Serve did not return after its context ended")
		}
	})
	select {
	case <-s.syncer.started:
	case <-time.After(5 * time.Second):
		t.Fatal("Serve did not start the syncer's Run")
	}
	return s
}

func (s *served) returned(t *testing.T) error {
	t.Helper()
	select {
	case err := <-s.done:
		s.done <- err // for the cleanup
		return err
	case <-time.After(5 * time.Second):
		t.Fatal("Serve did not return")
		return nil
	}
}

// Design §6 `1 hello` → `101 state`: an empty store is not paired, not
// syncing, online, never synced, shapes shown, and carries no error key.
func TestHelloAnsweredWithState(t *testing.T) {
	s := serve(t, nil)
	s.peer.send(protocol.TypeHello, "{}")
	got, raw := s.peer.state()
	want := protocol.State{Paired: false, Syncing: false, Online: true, LastSync: nil, ShapesShown: true}
	if got != want {
		t.Errorf("state = %+v, want %+v", got, want)
	}
	if v, ok := raw["lastSync"]; !ok || v != nil {
		t.Errorf("lastSync = %v (present %v), want null", v, ok)
	}
	if _, ok := raw["error"]; ok {
		t.Errorf("state carries an error key: %v", raw)
	}
	s.peer.silent() // exactly one answer
}

// Design §5.4, §6: paired, lastSync and shapesShown are the store's.
func TestStateReadsTheStore(t *testing.T) {
	synced := time.Date(2026, 10, 30, 14, 32, 0, 0, time.UTC)
	s := serve(t, func(st *store.Store) {
		must(t, st.SetSession(store.Session{Origin: "https://example.test", Token: "t", PairedAt: synced}))
		must(t, st.SetLastSync(synced))
		must(t, st.SetShapesShown(false))
	})
	s.peer.send(protocol.TypeHello, "{}")
	got, _ := s.peer.state()
	if !got.Paired {
		t.Error("paired = false, want true")
	}
	if got.ShapesShown {
		t.Error("shapesShown = true, want false")
	}
	if got.LastSync == nil {
		t.Fatal("lastSync = null")
	}
	parsed, err := time.Parse(time.RFC3339, *got.LastSync)
	if err != nil || !parsed.Equal(synced) {
		t.Errorf("lastSync = %q, want %s as RFC 3339", *got.LastSync, synced.Format(time.RFC3339))
	}
}

// Design §5.3; workflow 19 §The shelf, the line that changes by itself: each
// sync status is written as a fresh state, in order.
func TestStatusSentAsState(t *testing.T) {
	s := serve(t, nil)
	s.peer.send(protocol.TypeHello, "{}")
	s.peer.state()

	status := s.relay.StatusFunc()
	status(sync.Status{Syncing: true, Online: true})
	status(sync.Status{Online: false, Error: sync.ErrorOffline})

	first, _ := s.peer.state()
	if !first.Syncing || !first.Online || first.Error != "" {
		t.Errorf("first state = %+v, want syncing, online, no error", first)
	}
	second, _ := s.peer.state()
	if second.Syncing || second.Online || second.Error != protocol.ErrorOffline {
		t.Errorf("second state = %+v, want not syncing, offline, error offline", second)
	}

	// A later hello reads the last status.
	s.peer.send(protocol.TypeHello, "{}")
	again, _ := s.peer.state()
	if again != second {
		t.Errorf("hello after the statuses = %+v, want %+v", again, second)
	}
}

// Design §5.3: a pass when a frontend attaches (−2) and on Sync now (4 sync),
// none when one detaches (−3); Run started once, at Serve.
func TestAttachAndSyncTrigger(t *testing.T) {
	s := serve(t, nil)
	s.peer.send(protocol.TypeAttached, "1")
	s.peer.send(protocol.TypeSync, "{}")
	s.peer.send(protocol.TypeDetached, "0")
	for range 2 {
		select {
		case <-s.syncer.trigged:
		case <-time.After(5 * time.Second):
			t.Fatal("trigger not called")
		}
	}
	// The detach was read before this hello's answer.
	s.peer.send(protocol.TypeHello, "{}")
	s.peer.state()
	runs, triggers := s.syncer.counts()
	if runs != 1 || triggers != 2 {
		t.Errorf("runs, triggers = %d, %d; want 1, 2", runs, triggers)
	}
}

// Design §6, AppLoad's terminate (−1 close): Serve returns nil and cancels
// the context the syncer runs under.
func TestTerminateEndsServe(t *testing.T) {
	s := serve(t, nil)
	s.peer.send(protocol.TypeTerminate, "close")
	if err := s.returned(t); err != nil {
		t.Errorf("Serve = %v, want nil", err)
	}
	select {
	case <-s.syncer.ended:
	case <-time.After(5 * time.Second):
		t.Fatal("the syncer's context was not cancelled")
	}
	s.syncer.mu.Lock()
	defer s.syncer.mu.Unlock()
	if s.syncer.runCtx.Err() == nil {
		t.Error("Run's context not cancelled")
	}
}

// The peer closing the socket ends Serve with nil.
func TestPeerCloseEndsServe(t *testing.T) {
	s := serve(t, nil)
	syscall.Close(s.peer.fd)
	s.peer.fd = -1
	if err := s.returned(t); err != nil {
		t.Errorf("Serve = %v, want nil", err)
	}
}

// Design §6: an unknown type and a malformed payload — an open's among them —
// get no answer, and the loop goes on: a following hello is still answered.
// (An open is answered now: reader.backend_views, views_test.go.)
func TestOtherMessagesIgnored(t *testing.T) {
	s := serve(t, nil)
	s.peer.send(77, "{}")
	s.peer.send(protocol.TypeOpen, `{"view":`)
	s.peer.send(protocol.TypeHello, "{not json")
	s.peer.silent()
	s.peer.send(protocol.TypeHello, "{}")
	s.peer.state()
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

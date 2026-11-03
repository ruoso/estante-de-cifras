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
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	gosync "sync"
	"syscall"
	"testing"
	"time"

	pairing "estantedecifras.app/remarkable/internal/pair"
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
	signOuts int
	store    *store.Store
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

// SignOut signs the store out, as the syncer does, and counts the call.
func (f *fakeSyncer) SignOut(ctx context.Context) error {
	f.mu.Lock()
	f.signOuts++
	st := f.store
	f.snap = nil
	f.mu.Unlock()
	if st != nil {
		return st.SignOut()
	}
	return nil
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

// --- pairing and signing out (reader.pairing) ---

const pairedSession = "session-from-the-pairing-0123456789"

// pairService is a fake of the service for pair and signout: each begin
// gives the next poll token, each poll answers that token's status as the
// test sets it ("pending" until then), and each signout records its cookie.
// Everything else is 404, which the real syncer reads as offline.
type pairService struct {
	srv *httptest.Server

	mu        gosync.Mutex
	beginCode int // 201 unless set
	begins    int
	status    map[string]string
	polls     map[string]int
	signouts  []string
}

func newPairService(t *testing.T) *pairService {
	t.Helper()
	f := &pairService{beginCode: http.StatusCreated, status: map[string]string{}, polls: map[string]int{}}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/devices/pair/begin", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		code := f.beginCode
		f.begins++
		n := f.begins
		f.mu.Unlock()
		if code != http.StatusCreated {
			http.Error(w, `{"code":"rate_limited","message":"slow down"}`, code)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{
			"code": fmt.Sprintf("KQ7-4T%c", 'A'+rune(n)), "url": "https://estantedecifras.app/pair",
			"pollToken": fmt.Sprintf("poll-token-%d", n), "expiresAt": "2026-11-02T14:42:00Z",
		})
	})
	mux.HandleFunc("POST /api/devices/pair/poll", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			PollToken string `json:"pollToken"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		f.mu.Lock()
		f.polls[body.PollToken]++
		st := f.status[body.PollToken]
		if st == "approved" {
			// Delivered once.
			f.status[body.PollToken] = "delivered"
		}
		f.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		switch st {
		case "approved":
			json.NewEncoder(w).Encode(map[string]string{"status": "approved", "session": pairedSession})
		case "expired":
			json.NewEncoder(w).Encode(map[string]string{"status": "expired"})
		case "delivered":
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"code":"pair_token_unknown","message":"no such pairing"}`))
		default:
			json.NewEncoder(w).Encode(map[string]string{"status": "pending"})
		}
	})
	mux.HandleFunc("POST /api/auth/signout", func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie("estante_session")
		f.mu.Lock()
		if err == nil {
			f.signouts = append(f.signouts, c.Value)
		} else {
			f.signouts = append(f.signouts, "")
		}
		f.mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	})
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

func (f *pairService) set(token, status string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.status[token] = status
}

func (f *pairService) pollsOf(token string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.polls[token]
}

func (f *pairService) beginCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.begins
}

func (f *pairService) signedOut() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.signouts...)
}

// client is a pair client for f polling every few milliseconds.
func (f *pairService) client(t *testing.T) *pairing.Client {
	t.Helper()
	origin, err := pairing.ParseOrigin(f.srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	return &pairing.Client{Origin: origin, HTTP: f.srv.Client(), Interval: 5 * time.Millisecond}
}

// waitUntil polls cond until it holds, failing the test after five seconds.
func waitUntil(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(2 * time.Millisecond)
	}
}

// servePairing starts Serve over a fresh socketpair with st, syncer and the
// pair client.
func servePairing(t *testing.T, st *store.Store, syncer Syncer, client *pairing.Client) (*peer, *Relay) {
	t.Helper()
	conn, p := pair(t)
	relay := NewRelay()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- Serve(ctx, conn, Deps{Store: st, Syncer: syncer, Relay: relay, Pair: client})
	}()
	t.Cleanup(func() {
		cancel()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Error("Serve did not return after its context ended")
		}
	})
	return p, relay
}

func openStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return st
}

// pairingMsg reads one message as a 102, also raw.
func (p *peer) pairingMsg() (protocol.Pairing, map[string]any) {
	p.t.Helper()
	f := p.recv()
	if f.typ != protocol.TypePairing {
		p.t.Fatalf("got message %d %s, want %d pairing", f.typ, f.payload, protocol.TypePairing)
	}
	var got protocol.Pairing
	var raw map[string]any
	if err := json.Unmarshal(f.payload, &got); err != nil {
		p.t.Fatal(err)
	}
	json.Unmarshal(f.payload, &raw)
	return got, raw
}

// Design §6 `5 pair` → `102`, workflow 19 §Pairing (the page stays still,
// rule 5): one `102` with the code, its address and its end — no poll token
// — then nothing while the poll goes on; the end of the pairing is the next
// message.
func TestPairAnswersTheCodeThenNothingUntilItEnds(t *testing.T) {
	f := newPairService(t)
	syncer := newFakeSyncer()
	p, _ := servePairing(t, openStore(t), syncer, f.client(t))
	p.send(protocol.TypePair, "{}")
	got, raw := p.pairingMsg()
	want := protocol.Pairing{Code: "KQ7-4TB", URL: "https://estantedecifras.app/pair", ExpiresAt: "2026-11-02T14:42:00Z"}
	if got != want {
		t.Errorf("102 %+v, want %+v", got, want)
	}
	if len(raw) != 3 {
		t.Errorf("102 carries %v, want code, url and expiresAt only", raw)
	}
	waitUntil(t, "several polls", func() bool { return f.pollsOf("poll-token-1") >= 5 })
	p.silent()
	f.set("poll-token-1", "expired")
	if got, _ := p.pairingMsg(); !got.Expired {
		t.Errorf("102 %+v, want expired", got)
	}
}

// §5.1 *On the device*, Decision 2: approved, the session is kept (0600,
// for the pairing's origin) and the first sync triggered; the states that
// sync writes say not paired, the one ending it paired; the next `open
// shelf` is answered from that pass's snapshot.
func TestPairApprovedSyncsBeforePaired(t *testing.T) {
	f := newPairService(t)
	fx := newViewsFixture(t)
	must(t, fx.st.ClearSession())
	synced := fx.snapshot()
	syncer := newFakeSyncer()
	p, relay := servePairing(t, fx.st, syncer, f.client(t))
	select {
	case <-syncer.started:
	case <-time.After(5 * time.Second):
		t.Fatal("Run not started")
	}
	p.send(protocol.TypeHello, "{}")
	if s, _ := p.state(); s.Paired {
		t.Fatal("paired before pairing")
	}
	p.send(protocol.TypePair, "{}")
	p.pairingMsg()
	f.set("poll-token-1", "approved")
	select {
	case <-syncer.trigged:
	case <-time.After(5 * time.Second):
		t.Fatal("the first sync was not triggered")
	}
	sess, ok := fx.st.Session()
	if !ok || sess.Token != pairedSession || sess.Origin != f.srv.URL || sess.PairedAt.IsZero() {
		t.Fatalf("session %v kept as %+v", ok, sess.Origin)
	}
	info, err := os.Stat(filepath.Join(fx.st.Root(), "session.json"))
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("session.json %v, mode %v", err, info)
	}

	status := relay.StatusFunc()
	status(sync.Status{Syncing: true, Online: true})
	if s, _ := p.state(); s.Paired || !s.Syncing {
		t.Errorf("state during the first pass %+v, want not paired, syncing", s)
	}
	p.send(protocol.TypeHello, "{}")
	if s, _ := p.state(); s.Paired {
		t.Errorf("hello during the first pass answered paired")
	}
	syncer.setSnapshot(synced)
	status(sync.Status{Online: true})
	if s, raw := p.state(); !s.Paired || s.Syncing {
		t.Errorf("state ending the first pass %+v, want paired", s)
	} else if _, ok := raw["error"]; ok {
		t.Errorf("state carries an error: %v", raw)
	}
	p.send(protocol.TypeOpen, `{"view":"shelf"}`)
	fr := p.recv()
	var shelf protocol.Shelf
	if fr.typ != protocol.TypeShelf || json.Unmarshal(fr.payload, &shelf) != nil {
		t.Fatalf("got %d %s, want the shelf", fr.typ, fr.payload)
	}
	if len(shelf.Books) != 1 || shelf.Books[0].BookID != testBook {
		t.Errorf("shelf %+v, want the synced book", shelf.Books)
	}
	p.silent()
}

// Workflow 19 §Pairing: the code expired is `102 {expired:true}`; so is a
// begin the service refuses (Decision 4); no network, `102 {offline:true}`.
func TestPairExpired(t *testing.T) {
	f := newPairService(t)
	p, _ := servePairing(t, openStore(t), newFakeSyncer(), f.client(t))
	p.send(protocol.TypePair, "{}")
	p.pairingMsg()
	f.set("poll-token-1", "expired")
	if got, raw := p.pairingMsg(); !got.Expired || len(raw) != 1 {
		t.Errorf("102 %v, want {expired:true}", raw)
	}

	f.mu.Lock()
	f.beginCode = http.StatusTooManyRequests
	f.mu.Unlock()
	p.send(protocol.TypePair, "{}")
	if got, raw := p.pairingMsg(); !got.Expired || len(raw) != 1 {
		t.Errorf("102 for a refused begin %v, want {expired:true}", raw)
	}

	f.srv.Close()
	p.send(protocol.TypePair, "{}")
	if got, raw := p.pairingMsg(); !got.Offline || len(raw) != 1 {
		t.Errorf("102 with no network %v, want {offline:true}", raw)
	}
}

// Constraint 2, workflow 19 §Pairing (*Get a new code*): a new `5 pair`
// stops the pairing in progress — its token is never polled again — and
// answers the new code.
func TestGetANewCodeDropsTheOldPoll(t *testing.T) {
	f := newPairService(t)
	p, _ := servePairing(t, openStore(t), newFakeSyncer(), f.client(t))
	p.send(protocol.TypePair, "{}")
	first, _ := p.pairingMsg()
	waitUntil(t, "the first token's polls", func() bool { return f.pollsOf("poll-token-1") >= 2 })
	p.send(protocol.TypePair, "{}")
	second, _ := p.pairingMsg()
	if second.Code == first.Code || second.Code == "" {
		t.Errorf("new code %q, first %q", second.Code, first.Code)
	}
	waitUntil(t, "the second token's polls", func() bool { return f.pollsOf("poll-token-2") >= 3 })
	old := f.pollsOf("poll-token-1")
	waitUntil(t, "more polls", func() bool { return f.pollsOf("poll-token-2") >= 10 })
	if n := f.pollsOf("poll-token-1"); n != old {
		t.Errorf("the first token was polled again: %d → %d", old, n)
	}
	// The first token approved now pairs nothing.
	f.set("poll-token-1", "approved")
	p.silent()
	f.set("poll-token-2", "approved")
	waitUntil(t, "the second pairing to end", func() bool {
		f.mu.Lock()
		defer f.mu.Unlock()
		return f.status["poll-token-2"] == "delivered"
	})
}

// Constraint 4: `5 pair` while paired answers the state and begins nothing.
func TestPairWhilePairedAnswersState(t *testing.T) {
	f := newPairService(t)
	st := openStore(t)
	must(t, st.SetSession(store.Session{Origin: f.srv.URL, Token: "t"}))
	p, _ := servePairing(t, st, newFakeSyncer(), f.client(t))
	p.send(protocol.TypePair, "{}")
	if s, _ := p.state(); !s.Paired {
		t.Errorf("state %+v, want paired", s)
	}
	p.silent()
	if n := f.beginCount(); n != 0 {
		t.Errorf("%d begins while paired", n)
	}
}

// A store paired with f, with a home book, a clone and an installed bundle.
func pairedStore(t *testing.T, origin, token string) *store.Store {
	t.Helper()
	st := openStore(t)
	must(t, st.SetSession(store.Session{Origin: origin, Token: token, Account: "Marina Souza"}))
	must(t, st.SetShapesShown(false))
	must(t, os.WriteFile(filepath.Join(st.HomeDir(), "shelf.json"), []byte("{}"), 0o600))
	dir, err := st.BookDir("b1")
	must(t, err)
	must(t, os.MkdirAll(filepath.Join(dir, "objects"), 0o700))
	must(t, st.StageBundle(map[string][]byte{"manifest.json": []byte("{}")}))
	must(t, st.PromoteBundle())
	return st
}

func wantSignedOut(t *testing.T, st *store.Store) {
	t.Helper()
	if _, ok := st.Session(); ok {
		t.Error("still paired")
	}
	if ids, _ := st.BookIDs(); len(ids) != 0 {
		t.Errorf("books kept: %v", ids)
	}
	if entries, _ := os.ReadDir(st.HomeDir()); len(entries) != 0 {
		t.Errorf("home/ kept %d entries", len(entries))
	}
	if !st.ShapesShown() {
		t.Error("the reader's state kept")
	}
	if d, ok := st.BundleDir(); !ok {
		t.Error("the bundle was removed")
	} else if _, err := os.Stat(filepath.Join(d, "manifest.json")); err != nil {
		t.Errorf("the bundle's manifest: %v", err)
	}
}

// Workflow 19 §The shelf (Sign out), design §6 `6 signOut`, Constraint 7:
// with the real syncer, Sign out ends the session with the service (the
// cookie sent), leaves the store empty but the bundle, and answers `101`
// not paired with no error.
func TestSignOutClearsTheDevice(t *testing.T) {
	f := newPairService(t)
	st := pairedStore(t, f.srv.URL, "device-token-0123")
	syncer := sync.New(st, nil, sync.Options{HTTPClient: f.srv.Client(), Online: func() bool { return true }})
	p, _ := servePairing(t, st, syncer, f.client(t))
	p.send(protocol.TypeSignOut, "{}")
	s, raw := p.state()
	if s.Paired {
		t.Errorf("state %+v, want not paired", s)
	}
	if _, ok := raw["error"]; ok {
		t.Errorf("state after the person's own sign out carries an error: %v", raw)
	}
	if got := f.signedOut(); len(got) != 1 || got[0] != "device-token-0123" {
		t.Errorf("signout called with %q, want once with the session's cookie", got)
	}
	wantSignedOut(t, st)
	if len(syncer.Snapshot().Shelf()) != 0 {
		t.Error("the snapshot kept the shelf")
	}
}

// Decision 5 (offline first): the service unreachable, the device signs out
// all the same, within the bound.
func TestSignOutOfflineStillSignsOut(t *testing.T) {
	f := newPairService(t)
	origin := f.srv.URL
	f.srv.Close()
	st := pairedStore(t, origin, "device-token-0123")
	syncer := sync.New(st, nil, sync.Options{Online: func() bool { return false }})
	p, _ := servePairing(t, st, syncer, f.client(t))
	start := time.Now()
	p.send(protocol.TypeSignOut, "{}")
	s, raw := p.state()
	if d := time.Since(start); d > sync.SignOutTimeout+time.Second {
		t.Errorf("signed out after %v", d)
	}
	if s.Paired {
		t.Errorf("state %+v, want not paired", s)
	}
	if _, ok := raw["error"]; ok {
		t.Errorf("state carries an error: %v", raw)
	}
	wantSignedOut(t, st)
}

// Constraint 8: unpaired — a session refused, or signed out — every open is
// answered with the empty shelf, which the frontend draws as Not paired.
func TestOpenUnpairedAnswersEmptyShelf(t *testing.T) {
	fx := newViewsFixture(t)
	must(t, fx.st.ClearSession())
	syncer := newFakeSyncer()
	syncer.snap = fx.snapshot()
	p, _ := servePairing(t, fx.st, syncer, nil)
	for _, open := range []string{
		`{"view":"shelf"}`,
		`{"view":"book","bookId":"` + testBook + `"}`,
		`{"view":"song","bookId":"` + testBook + `","path":"` + walking + `"}`,
		`{"view":"settings"}`,
	} {
		p.send(protocol.TypeOpen, open)
		fr := p.recv()
		if fr.typ != protocol.TypeShelf || string(fr.payload) != `{"books":[]}` {
			t.Errorf("open %s answered %d %s, want 103 {\"books\":[]}", open, fr.typ, fr.payload)
		}
	}
	if h, _ := syncer.held(testBook); h != 0 {
		t.Errorf("an unpaired open held the book %d times", h)
	}
}

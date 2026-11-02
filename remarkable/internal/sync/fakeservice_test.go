package sync

// The behavior tests' service (reader.sync Decision 9): an httptest server
// serving bare repositories made by the git CLI in t.TempDir() through real
// `git http-backend` (net/http/cgi), plus /api/account/home-book and
// /api/shelf/change-check computed from those repositories' heads. It records
// every request, and in t.Cleanup fails the test on any git-receive-pack
// request or any request without the session cookie (design §3.2 "Never a
// push", §10).

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cgi"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	gosync "sync"
	"testing"
	"time"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/store"
)

const testToken = "tok-0123456789-secret-session"

type fakeRequest struct {
	Method string
	Path   string
	Query  string
	Cookie bool
}

type fakeService struct {
	t      *testing.T
	srv    *httptest.Server
	root   string // GIT_PROJECT_ROOT: one bare repository per id
	work   string // the git CLI's working copies
	homeID string

	mu           gosync.Mutex
	requests     []fakeRequest
	gone         map[string]bool
	cut          map[string]bool // ids whose upload-pack answer is cut mid-pack
	unauthorized bool
}

// gitEnv keeps the git CLI away from the user's and the system's config.
func gitEnv() []string {
	return []string{
		"GIT_CONFIG_NOSYSTEM=1", "GIT_CONFIG_GLOBAL=/dev/null",
		"GIT_AUTHOR_NAME=Estante Test", "GIT_AUTHOR_EMAIL=test@estante.test",
		"GIT_COMMITTER_NAME=Estante Test", "GIT_COMMITTER_EMAIL=test@estante.test",
	}
}

func runGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), gitEnv()...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return strings.TrimSpace(string(out))
}

func newFakeService(t *testing.T) *fakeService { return startFake(t, false) }

// newTLSFakeService serves https, for the scheme half of the origin check.
func newTLSFakeService(t *testing.T) *fakeService { return startFake(t, true) }

func startFake(t *testing.T, tls bool) *fakeService {
	t.Helper()
	gitPath, err := exec.LookPath("git")
	if err != nil {
		t.Fatalf("git not found: %v", err)
	}
	f := &fakeService{
		t: t, root: t.TempDir(), work: t.TempDir(), homeID: "home-0001",
		gone: map[string]bool{}, cut: map[string]bool{},
	}
	backend := &cgi.Handler{
		Path: gitPath, Args: []string{"http-backend"}, Root: "/git",
		Env: append([]string{"GIT_PROJECT_ROOT=" + f.root, "GIT_HTTP_EXPORT_ALL=1"}, gitEnv()...),
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/account/home-book", f.homeBook)
	mux.HandleFunc("POST /api/shelf/change-check", f.changeCheck)
	mux.HandleFunc("/git/", func(w http.ResponseWriter, r *http.Request) { f.git(backend, w, r) })
	record := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(cookieName)
		f.mu.Lock()
		f.requests = append(f.requests, fakeRequest{
			Method: r.Method, Path: r.URL.Path, Query: r.URL.RawQuery,
			Cookie: err == nil && c.Value == testToken,
		})
		f.mu.Unlock()
		mux.ServeHTTP(w, r)
	})
	if tls {
		f.srv = httptest.NewTLSServer(record)
	} else {
		f.srv = httptest.NewServer(record)
	}
	f.newRepo(f.homeID)
	t.Cleanup(func() {
		f.srv.Close()
		for _, r := range f.all() {
			if strings.Contains(r.Path, "git-receive-pack") || strings.Contains(r.Query, "git-receive-pack") {
				t.Errorf("the reader asked for receive-pack: %s %s?%s", r.Method, r.Path, r.Query)
			}
			if !r.Cookie {
				t.Errorf("a request without the session cookie: %s %s", r.Method, r.Path)
			}
		}
	})
	return f
}

func (f *fakeService) homeBook(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	unauthorized := f.unauthorized
	f.mu.Unlock()
	if unauthorized {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	writeJSON(w, map[string]string{"id": f.homeID, "gitUrl": f.url(f.homeID)})
}

func (f *fakeService) changeCheck(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Books []struct {
			BookID string  `json:"bookId"`
			Head   *string `json:"head"`
		} `json:"books"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	f.mu.Lock()
	unauthorized := f.unauthorized
	f.mu.Unlock()
	if unauthorized {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	books := []map[string]string{}
	for _, b := range req.Books {
		f.mu.Lock()
		gone := f.gone[b.BookID]
		f.mu.Unlock()
		if gone {
			books = append(books, map[string]string{"bookId": b.BookID, "status": "gone"})
			continue
		}
		head := f.head(b.BookID)
		if head == "" {
			continue
		}
		if b.Head == nil || *b.Head != head {
			books = append(books, map[string]string{"bookId": b.BookID, "status": "changed", "head": head})
		}
	}
	writeJSON(w, map[string]any{"books": books})
}

func (f *fakeService) git(backend http.Handler, w http.ResponseWriter, r *http.Request) {
	id, _, _ := strings.Cut(strings.TrimPrefix(r.URL.Path, "/git/"), "/")
	f.mu.Lock()
	cut := f.cut[id] && strings.HasSuffix(r.URL.Path, "/git-upload-pack")
	f.mu.Unlock()
	if !cut {
		backend.ServeHTTP(w, r)
		return
	}
	// The upload-pack answer, cut mid-pack: half its bytes, then the
	// connection dropped.
	rec := httptest.NewRecorder()
	backend.ServeHTTP(rec, r)
	for k, v := range rec.Header() {
		w.Header()[k] = v
	}
	w.WriteHeader(rec.Code)
	body := rec.Body.Bytes()
	w.Write(body[:len(body)/2])
	if fl, ok := w.(http.Flusher); ok {
		fl.Flush()
	}
	panic(http.ErrAbortHandler)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func (f *fakeService) all() []fakeRequest {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]fakeRequest(nil), f.requests...)
}

// reset forgets the requests so far.
func (f *fakeService) reset() {
	f.mu.Lock()
	f.requests = nil
	f.mu.Unlock()
}

// requestsFor are the git requests for the repository id.
func (f *fakeService) requestsFor(id string) []fakeRequest {
	var out []fakeRequest
	for _, r := range f.all() {
		if strings.HasPrefix(r.Path, "/git/"+id+"/") {
			out = append(out, r)
		}
	}
	return out
}

func (f *fakeService) count(path string) int {
	n := 0
	for _, r := range f.all() {
		if r.Path == path {
			n++
		}
	}
	return n
}

func (f *fakeService) url(id string) string { return f.srv.URL + "/git/" + id }

// newRepo makes an empty bare repository id, and its working copy.
func (f *fakeService) newRepo(id string) {
	f.t.Helper()
	runGit(f.t, f.root, "init", "-q", "--bare", "-b", "main", id)
	wc := filepath.Join(f.work, id)
	runGit(f.t, f.work, "init", "-q", "-b", "main", id)
	runGit(f.t, wc, "remote", "add", "origin", filepath.Join(f.root, id))
}

// push commits files (path → content; "" removes the path) to id's main with
// the git CLI over the filesystem, and answers the new head.
func (f *fakeService) push(id string, files map[string]string) string {
	f.t.Helper()
	wc := filepath.Join(f.work, id)
	paths := make([]string, 0, len(files))
	for p := range files {
		paths = append(paths, p)
	}
	sort.Strings(paths)
	for _, p := range paths {
		full := filepath.Join(wc, p)
		if files[p] == "" {
			os.Remove(full)
			continue
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			f.t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(files[p]), 0o644); err != nil {
			f.t.Fatal(err)
		}
	}
	runGit(f.t, wc, "add", "-A")
	runGit(f.t, wc, "commit", "-q", "--allow-empty", "-m", "a change")
	runGit(f.t, wc, "push", "-q", "origin", "main")
	return runGit(f.t, wc, "rev-parse", "HEAD")
}

// head is id's main on the service, "" when it has none.
func (f *fakeService) head(id string) string {
	dir := filepath.Join(f.root, id)
	if _, err := os.Stat(dir); err != nil {
		return ""
	}
	cmd := exec.Command("git", "--git-dir", dir, "rev-parse", "--verify", "-q", "refs/heads/main")
	cmd.Env = append(os.Environ(), gitEnv()...)
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func (f *fakeService) setGone(id string, gone bool) {
	f.mu.Lock()
	f.gone[id] = gone
	f.mu.Unlock()
}

func (f *fakeService) setCut(id string, cut bool) {
	f.mu.Lock()
	f.cut[id] = cut
	f.mu.Unlock()
}

func (f *fakeService) setUnauthorized(v bool) {
	f.mu.Lock()
	f.unauthorized = v
	f.mu.Unlock()
}

// --- the home book's files, written for the tests ---

const testAt = "2026-10-06T12:00:00.000Z"

func reg(v any) map[string]any { return map[string]any{"at": testAt, "value": v} }

// shelfBook is one books.<id> entry of a test shelf.json.
type shelfBook struct {
	id       string
	link     any // a string, or nil for a tombstone
	position any // a number, or nil for none
	label    string
}

func shelfJSON(books ...shelfBook) string {
	m := map[string]any{}
	for _, b := range books {
		e := map[string]any{"link": reg(b.link)}
		if b.position != nil {
			e["position"] = reg(b.position)
		}
		if b.label != "" {
			e["label"] = reg(b.label)
		}
		m[b.id] = e
	}
	raw, _ := json.MarshalIndent(map[string]any{"books": m}, "", "  ")
	return string(raw) + "\n"
}

// --- the syncer under test ---

// newTestStore opens a store paired with f.
func newTestStore(t *testing.T, f *fakeService) *store.Store {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "estante"))
	if err != nil {
		t.Fatal(err)
	}
	if err := st.SetSession(store.Session{Origin: f.srv.URL, Token: testToken}); err != nil {
		t.Fatal(err)
	}
	return st
}

func newTestSyncer(t *testing.T, f *fakeService, st *store.Store, eng Engine) *Syncer {
	t.Helper()
	return New(st, eng, Options{
		HTTPClient: f.srv.Client(),
		Now:        func() time.Time { return time.Date(2026, 11, 1, 14, 32, 0, 0, time.UTC) },
		Online:     func() bool { return true },
	})
}

func mustPass(t *testing.T, s *Syncer) Result {
	t.Helper()
	res, err := s.Pass(context.Background())
	if err != nil {
		t.Fatalf("Pass: %v", err)
	}
	return res
}

func headStr(r BookResult) string {
	if r.Head == nil {
		return ""
	}
	return *r.Head
}

func wantStatus(t *testing.T, res Result, id, status string) {
	t.Helper()
	got, ok := res.Books[id]
	if !ok {
		t.Errorf("%s: not in the result %+v", id, res.Books)
		return
	}
	if got.Status != status {
		t.Errorf("%s: %s, want %s", id, got.Status, status)
	}
}

// fakeEngine records what it is asked.
type fakeEngine struct {
	mu     gosync.Mutex
	files  []engine.InstrumentFiles
	loads  [][2]json.RawMessage
	answer engine.Instrument
}

func newFakeEngine() *fakeEngine {
	salt := "defaults-test"
	return &fakeEngine{answer: engine.Instrument{
		Entry: json.RawMessage(`{"id":"standard"}`),
		Table: json.RawMessage(`{"fingerprint":"f","shapes":{}}`),
		Salt:  &salt,
	}}
}

func (e *fakeEngine) Instrument(_ context.Context, files engine.InstrumentFiles) (engine.Instrument, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.files = append(e.files, files)
	return e.answer, nil
}

func (e *fakeEngine) Load(_ context.Context, entry, table json.RawMessage) (engine.Loaded, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.loads = append(e.loads, [2]json.RawMessage{entry, table})
	return engine.Loaded{}, nil
}

func (e *fakeEngine) loadCount() int {
	e.mu.Lock()
	defer e.mu.Unlock()
	return len(e.loads)
}

// song is a song written for these tests.
func song(title, chords string) string {
	return fmt.Sprintf("# %s\n- key: C\n\n```\n%s\n```\n", title, chords)
}

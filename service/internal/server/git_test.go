package server

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	apicontract "estantedecifras.app/api"
	"estantedecifras.app/service/internal/admin"
	"estantedecifras.app/service/internal/book"
	"estantedecifras.app/service/internal/passkey"
	"estantedecifras.app/service/internal/session"
	"estantedecifras.app/service/internal/webauthntest"
)

// This file carries both the pure unit tests for the git-over-HTTP framing (the
// service header encoder, the Git-Protocol validator, the gzip/size-cap body
// wrapper, the ESTANTE_* environment builder — no DB, no git) and the behavior
// tests that drive the real handlers through httptest against the compose
// Postgres (ESTANTE_TEST_DATABASE_URL) and a real git on a t.TempDir() books
// root, with the host git CLI as the client. A standalone `go test` with the
// DSN unset runs the unit tests and skips the behavior tests (newGitEnv →
// migratedServerSchema → envDSN). It pins workflow 14 and the contract
// (api/openapi.yaml /git/{bookId}/…) and DIRECTION §3.6.
//
// A sample song is written for the purpose (never someone else's words), kept
// tiny; it is round-tripped through the real wire, never logged.
const sampleSongName = "marcha-do-teste.cifra.md"
const sampleSongBody = "# Marcha do Teste\n\n```cifra\n[C]Um dois [G]tres quatro\n[F]Cinco seis [C]sete\n```\n"

// ---------------------------------------------------------------------------
// unit — pure framing (no DB, no git)
// ---------------------------------------------------------------------------

// TestServiceHeader pins the service header encoder: "# service=<service>\n" as
// a correctly length-prefixed pkt-line followed by a flush pkt. Pins DIRECTION
// §3.6 lines 325–327; contract lines 607–615.
func TestServiceHeader(t *testing.T) {
	cases := map[string]string{
		svcUploadPack:  "001e# service=git-upload-pack\n0000",
		svcReceivePack: "001f# service=git-receive-pack\n0000",
	}
	for service, want := range cases {
		if got := string(serviceHeader(service)); got != want {
			t.Errorf("serviceHeader(%q) = %q, want %q", service, got, want)
		}
	}
	// The length prefix counts itself and is exactly four hex digits.
	if got := pktLine("x"); got != "0005x" {
		t.Errorf("pktLine(%q) = %q, want 0005x", "x", got)
	}
}

// TestSanitizeGitProtocol pins Git-Protocol → GIT_PROTOCOL validation: a valid
// version=2 passes through, an injection-shaped or malformed value is dropped,
// and an absent header is not set. Pins DIRECTION §3.6 lines 331–333; contract
// lines 750–759; Constraint 4.
func TestSanitizeGitProtocol(t *testing.T) {
	pass := []string{"version=2", "version=2:agent=git/2.40", "version=0"}
	for _, v := range pass {
		if got, ok := sanitizeGitProtocol(v); !ok || got != v {
			t.Errorf("sanitizeGitProtocol(%q) = (%q, %v), want (%q, true)", v, got, ok, v)
		}
	}
	drop := []string{
		"",                        // absent
		"version=2\nGIT_DIR=/etc", // a newline would inject a second variable
		"version=2 extra",         // whitespace
		"version=2;rm -rf /",      // a shell metacharacter
		strings.Repeat("a", 201),  // over-long
	}
	for _, v := range drop {
		if got, ok := sanitizeGitProtocol(v); ok {
			t.Errorf("sanitizeGitProtocol(%q) = (%q, true), want ok=false", v, got)
		}
	}
	// gitProtocolEnv returns nil for an absent/malformed header, a single
	// GIT_PROTOCOL for a valid one.
	r := httptest.NewRequest(http.MethodGet, "/git/x/info/refs", nil)
	if env := gitProtocolEnv(r); env != nil {
		t.Errorf("gitProtocolEnv with no header = %v, want nil", env)
	}
	r.Header.Set("Git-Protocol", "version=2")
	if env := gitProtocolEnv(r); len(env) != 1 || env[0] != "GIT_PROTOCOL=version=2" {
		t.Errorf("gitProtocolEnv = %v, want [GIT_PROTOCOL=version=2]", env)
	}
}

// TestGitRequestBodyGzip pins the gzip reader: a gzip-wrapped body decodes to
// the original bytes under the cap, and a non-gzip Content-Encoding is rejected.
// Pins DIRECTION §3.6 line 333; contract lines 631–633; Constraints 5, 6.
func TestGitRequestBodyGzip(t *testing.T) {
	api := &APIDeps{GitMaxBodyBytes: 1 << 20}
	original := []byte("0032want 1234567890123456789012345678901234567890\n00000009done\n")

	var gz bytes.Buffer
	zw := gzip.NewWriter(&gz)
	if _, err := zw.Write(original); err != nil {
		t.Fatalf("gzip write: %v", err)
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("gzip close: %v", err)
	}

	rec := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/git/x/git-upload-pack", bytes.NewReader(gz.Bytes()))
	r.Header.Set("Content-Encoding", "gzip")
	reader, ok := gitRequestBody(rec, r, api)
	if !ok {
		t.Fatalf("gitRequestBody rejected a valid gzip body: %d", rec.Code)
	}
	got, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("reading decompressed body: %v", err)
	}
	if !bytes.Equal(got, original) {
		t.Errorf("decompressed body = %q, want %q", got, original)
	}

	// An unsupported Content-Encoding is a 400, not passed to git.
	rec2 := httptest.NewRecorder()
	r2 := httptest.NewRequest(http.MethodPost, "/git/x/git-upload-pack", strings.NewReader("hi"))
	r2.Header.Set("Content-Encoding", "br")
	if _, ok := gitRequestBody(rec2, r2, api); ok || rec2.Code != http.StatusBadRequest {
		t.Errorf("gitRequestBody with Content-Encoding br = ok %v status %d, want ok=false 400", ok, rec2.Code)
	}
}

// TestPushEnv pins the ESTANTE_* environment builder: the exact KEY=VALUE set
// the hook inherits, in order. Pins DIRECTION §3.6 lines 342–346; the task note;
// cmd/pre-receive/README.md:5-6; Decision "the names are fixed here".
func TestPushEnv(t *testing.T) {
	got := pushEnv("acc-1", "book-2", roleOwner, "songbook", 1000, 50)
	want := []string{
		"ESTANTE_USER=acc-1",
		"ESTANTE_BOOK=book-2",
		"ESTANTE_ROLE=owner",
		"ESTANTE_BOOK_KIND=songbook",
		"ESTANTE_ACCOUNT_BYTES_REMAINING=1000",
		"ESTANTE_BOOK_BYTES=50",
	}
	if len(got) != len(want) {
		t.Fatalf("pushEnv = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("pushEnv[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

// ---------------------------------------------------------------------------
// behavior — real handlers, real Postgres, real git (CLI as the client)
// ---------------------------------------------------------------------------

// gitEnv is a passkey env (for accounts and sessions) whose server carries the
// git routes, a throwaway books volume and a throwaway hooks directory. The
// *APIDeps is exposed so a test can drive a deliberately tiny deadline or cap.
type gitEnv struct {
	*passkeyEnv
	booksRoot string
	hooksDir  string
	api       *APIDeps
}

func newGitEnv(t *testing.T) *gitEnv {
	t.Helper()
	pool := migratedServerSchema(t)

	rp, err := passkey.New(passkey.Config{
		RPID:        testPkRPID,
		RPOrigins:   []string{testPkOrigin},
		StateSecret: []byte("behavior-test-webauthn-state-secret"),
	})
	if err != nil {
		t.Fatalf("passkey.New: %v", err)
	}
	contract, err := apicontract.Load()
	if err != nil {
		t.Fatalf("apicontract.Load: %v", err)
	}

	booksRoot := t.TempDir()
	hooksDir := t.TempDir() // empty: git runs no hook, so pushes are accepted
	var logBuf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logBuf, nil))
	api := &APIDeps{
		DB:              pool,
		Passkeys:        rp,
		PublicBaseURL:   testPkOrigin,
		BooksRoot:       booksRoot,
		HooksDir:        hooksDir,
		GitDeadline:     30 * time.Second,
		GitMaxBodyBytes: 128 * 1024 * 1024,
	}
	h, err := Handler(logger, newTestAppRoot(t), pool, api)
	if err != nil {
		t.Fatalf("Handler: %v", err)
	}
	ts := httptest.NewServer(h)
	t.Cleanup(ts.Close)

	pe := &passkeyEnv{pool: pool, server: ts, auth: webauthntest.New(testPkOrigin), contract: contract, logBuf: &logBuf}
	return &gitEnv{passkeyEnv: pe, booksRoot: booksRoot, hooksDir: hooksDir, api: api}
}

func (e *gitEnv) gitURL(id string) string { return e.server.URL + "/git/" + id }

func (e *gitEnv) repoPath(id string) string { return filepath.Join(e.booksRoot, id+".git") }

// createBook POSTs /api/books with the session cookie and returns the decoded
// book, asserting 201 (the Books handler makes the row and the empty bare repo).
func (e *gitEnv) createBook(t *testing.T, cookie, title string) bookJSON {
	t.Helper()
	resp, body := e.do(t, http.MethodPost, "/api/books", cookie, []byte(`{"title":`+mustQuote(title)+`}`))
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create %q: status = %d, want 201; body=%s", title, resp.StatusCode, body)
	}
	var b bookJSON
	if err := json.Unmarshal(body, &b); err != nil {
		t.Fatalf("decoding book: %v", err)
	}
	return b
}

func (e *gitEnv) insertMembership(t *testing.T, bookID, accountID, role string) {
	t.Helper()
	if _, err := e.pool.Exec(context.Background(),
		`INSERT INTO memberships (book_id, account_id, role) VALUES ($1, $2, $3)`, bookID, accountID, role); err != nil {
		t.Fatalf("insert membership: %v", err)
	}
}

func (e *gitEnv) setSize(t *testing.T, bookID string, size int64) {
	t.Helper()
	if _, err := e.pool.Exec(context.Background(), `UPDATE books SET size_bytes = $2 WHERE id = $1`, bookID, size); err != nil {
		t.Fatalf("set size: %v", err)
	}
}

func (e *gitEnv) softDelete(t *testing.T, bookID string) {
	t.Helper()
	if _, err := e.pool.Exec(context.Background(), `UPDATE books SET deleted_at = now() WHERE id = $1`, bookID); err != nil {
		t.Fatalf("soft delete: %v", err)
	}
}

// setKind sets a book's repository kind directly in Postgres (as setSize sets
// size_bytes), so a test can make a book a home book without a provisioning flow
// — the column this task adds (0003_book_kind.sql).
func (e *gitEnv) setKind(t *testing.T, bookID, kind string) {
	t.Helper()
	if _, err := e.pool.Exec(context.Background(), `UPDATE books SET kind = $2 WHERE id = $1`, bookID, kind); err != nil {
		t.Fatalf("set kind: %v", err)
	}
}

func (e *gitEnv) sizeBytes(t *testing.T, bookID string) int64 {
	t.Helper()
	var n int64
	if err := e.pool.QueryRow(context.Background(), `SELECT size_bytes FROM books WHERE id = $1`, bookID).Scan(&n); err != nil {
		t.Fatalf("read size_bytes: %v", err)
	}
	return n
}

// gitc runs the host git CLI with an argument array, carrying the session cookie
// as an HTTP header via -c http.extraHeader (the device's own path — the cookie
// is set Secure, so it is supplied explicitly, not read from a jar over
// httptest's plain HTTP). It returns combined output and the error.
func gitc(t *testing.T, dir, cookie string, args ...string) (string, error) {
	t.Helper()
	full := make([]string, 0, len(args)+2)
	if cookie != "" {
		full = append(full, "-c", "http.extraHeader=Cookie: "+session.CookieName+"="+cookie)
	}
	full = append(full, args...)
	cmd := exec.Command("git", full...)
	if dir != "" {
		cmd.Dir = dir
	}
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0")
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func gitIdentity(t *testing.T, dir string) {
	t.Helper()
	gitRun(t, dir, "config", "user.email", "beh@estante.test")
	gitRun(t, dir, "config", "user.name", "Behavior Test")
	gitRun(t, dir, "config", "commit.gpgsign", "false")
}

// cloneCommitPush clones the book's current state over HTTP, adds a commit with
// the given file and content, and pushes it back over HTTP — a real device
// round-trip through the handlers. It fast-forwards from whatever is already
// there (an empty book clones to an empty work tree). Returns the pushed sha.
func (e *gitEnv) cloneCommitPush(t *testing.T, cookie, bookID, filename, content, msg string) string {
	t.Helper()
	work := t.TempDir()
	url := e.gitURL(bookID)
	if out, err := gitc(t, "", cookie, "clone", "-q", url, work); err != nil {
		t.Fatalf("clone for push: %v\n%s", err, out)
	}
	gitIdentity(t, work)
	if err := os.WriteFile(filepath.Join(work, filename), []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", filename, err)
	}
	gitRun(t, work, "add", filename)
	gitRun(t, work, "commit", "-q", "-m", msg)
	if out, err := gitc(t, work, cookie, "push", "-q", "origin", "HEAD:refs/heads/main"); err != nil {
		t.Fatalf("push: %v\n%s", err, out)
	}
	return headRev(t, e.repoPath(bookID))
}

// gitReq makes a raw request to a git route with arbitrary headers and body (for
// the gzip, media-type and refusal assertions the CLI cannot drive).
func (e *gitEnv) gitReq(t *testing.T, method, path, cookie string, headers map[string]string, body []byte) (*http.Response, []byte) {
	t.Helper()
	var r io.Reader
	if body != nil {
		r = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, e.server.URL+path, r)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if cookie != "" {
		req.AddCookie(&http.Cookie{Name: session.CookieName, Value: cookie})
	}
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	data, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		t.Fatalf("reading body: %v", err)
	}
	return resp, data
}

// TestGitCloneFetchPush pins the headline behavior: a member clones and fetches,
// an editor and the owner push, and the advertisement carries the right
// application/x-git-* media types with the service header first. Pins contract
// lines 586–696; DIRECTION §3.6 lines 324–330.
func TestGitCloneFetchPush(t *testing.T) {
	e := newGitEnv(t)
	ownerID, ownerCookie := e.registerNewAccount(t)
	_ = ownerID
	b := e.createBook(t, ownerCookie, "Round Trip")

	// The owner pushes the first commit; it lands in the bare repo.
	head1 := e.cloneCommitPush(t, ownerCookie, b.ID, sampleSongName, sampleSongBody, "first")
	if head1 != headRev(t, e.repoPath(b.ID)) {
		t.Fatalf("owner push did not land")
	}

	// A member clones and reads the song back.
	clone1 := t.TempDir()
	if out, err := gitc(t, "", ownerCookie, "clone", "-q", e.gitURL(b.ID), clone1); err != nil {
		t.Fatalf("clone: %v\n%s", err, out)
	}
	if got, err := os.ReadFile(filepath.Join(clone1, sampleSongName)); err != nil || string(got) != sampleSongBody {
		t.Fatalf("cloned song = %q err=%v, want the pushed body", got, err)
	}

	// An editor (a second account with a membership) pushes a later commit.
	editorID, editorCookie := e.registerNewAccount(t)
	e.insertMembership(t, b.ID, editorID, roleEditor)
	head2 := e.cloneCommitPush(t, editorCookie, b.ID, "segundo.cifra.md", "# Segundo\n\n```cifra\n[Am]Teste\n```\n", "second")
	if head2 == head1 {
		t.Fatalf("editor push did not advance the head")
	}

	// The first clone fetches the later commit.
	if out, err := gitc(t, clone1, ownerCookie, "fetch", "-q", "origin"); err != nil {
		t.Fatalf("fetch: %v\n%s", err, out)
	}
	if got := strings.TrimSpace(mustOutput(t, clone1, "rev-parse", "refs/remotes/origin/main")); got != head2 {
		t.Errorf("fetched origin/main = %s, want %s", got, head2)
	}

	// The advertisement media types and the service header, both services.
	for _, svc := range []string{svcUploadPack, svcReceivePack} {
		resp, body := e.gitReq(t, http.MethodGet, "/git/"+b.ID+"/info/refs?service="+svc, ownerCookie, nil, nil)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("info/refs %s: status %d, want 200", svc, resp.StatusCode)
		}
		if ct := resp.Header.Get("Content-Type"); ct != "application/x-git-"+gitSubcommand(svc)+"-advertisement" {
			t.Errorf("info/refs %s Content-Type = %q", svc, ct)
		}
		if !bytes.HasPrefix(body, serviceHeader(svc)) {
			t.Errorf("info/refs %s body does not start with the service header", svc)
		}
	}
}

// TestGitGzipBody pins that a git-upload-pack POST sent Content-Encoding: gzip
// is decompressed and served — exercised with a real upload-pack request built
// by hand against a seeded head. Pins DIRECTION §3.6 line 333; contract lines
// 631–633.
func TestGitGzipBody(t *testing.T) {
	e := newGitEnv(t)
	_, cookie := e.registerNewAccount(t)
	b := e.createBook(t, cookie, "Gzip Book")
	seedREADME(t, e.repoPath(b.ID), "Gzip Book")
	sha := headRev(t, e.repoPath(b.ID))

	// A minimal protocol-v0 fetch request (no Git-Protocol header, so git serves
	// v0): want <sha>, flush, done.
	req := pktLine("want "+sha+"\n") + "0000" + pktLine("done\n")
	var gz bytes.Buffer
	zw := gzip.NewWriter(&gz)
	if _, err := zw.Write([]byte(req)); err != nil {
		t.Fatalf("gzip write: %v", err)
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("gzip close: %v", err)
	}

	resp, body := e.gitReq(t, http.MethodPost, "/git/"+b.ID+"/git-upload-pack", cookie, map[string]string{
		"Content-Type":     "application/x-git-upload-pack-request",
		"Content-Encoding": "gzip",
	}, gz.Bytes())
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("gzip upload-pack: status %d, want 200; body=%q", resp.StatusCode, body)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "application/x-git-upload-pack-result" {
		t.Errorf("Content-Type = %q, want application/x-git-upload-pack-result", ct)
	}
	if !bytes.Contains(body, []byte("PACK")) {
		t.Errorf("upload-pack result does not contain a packfile; body=%q", body)
	}
}

// TestGitProtocolV2 pins that info/refs and git-upload-pack with
// Git-Protocol: version=2 negotiate and transfer — driven by the git CLI with
// protocol.version=2, which sets the header on both requests. Pins DIRECTION
// §3.6 lines 331–332.
func TestGitProtocolV2(t *testing.T) {
	e := newGitEnv(t)
	_, cookie := e.registerNewAccount(t)
	b := e.createBook(t, cookie, "V2 Book")
	head1 := e.cloneCommitPush(t, cookie, b.ID, sampleSongName, sampleSongBody, "first")

	// A v2 clone: info/refs and git-upload-pack both carry Git-Protocol: version=2.
	dest := t.TempDir()
	if out, err := gitc(t, "", cookie, "-c", "protocol.version=2", "clone", "-q", e.gitURL(b.ID), dest); err != nil {
		t.Fatalf("v2 clone: %v\n%s", err, out)
	}
	if got, err := os.ReadFile(filepath.Join(dest, sampleSongName)); err != nil || string(got) != sampleSongBody {
		t.Fatalf("v2-cloned song = %q err=%v", got, err)
	}

	// A v2 fetch of a later commit.
	head2 := e.cloneCommitPush(t, cookie, b.ID, "mais.cifra.md", "# Mais\n\n```cifra\n[D]Teste\n```\n", "second")
	if head2 == head1 {
		t.Fatalf("second push did not advance the head")
	}
	if out, err := gitc(t, dest, cookie, "-c", "protocol.version=2", "fetch", "-q", "origin"); err != nil {
		t.Fatalf("v2 fetch: %v\n%s", err, out)
	}
	if got := strings.TrimSpace(mustOutput(t, dest, "rev-parse", "refs/remotes/origin/main")); got != head2 {
		t.Errorf("v2-fetched origin/main = %s, want %s", got, head2)
	}
}

// TestGitClientDisconnectMidPushKillsGit pins that a client that disconnects
// while receive-pack is reading the request is cancelled — git is killed, no
// *.lock remains, the head is unchanged, and a subsequent normal push succeeds.
// Pins DIRECTION §3.6 line 348; the task note.
func TestGitClientDisconnectMidPushKillsGit(t *testing.T) {
	e := newGitEnv(t)
	_, cookie := e.registerNewAccount(t)
	b := e.createBook(t, cookie, "Disconnect Book")
	head0 := e.cloneCommitPush(t, cookie, b.ID, sampleSongName, sampleSongBody, "first")

	// Open a receive-pack POST whose body never completes — receive-pack blocks
	// reading its command list — then cut the connection.
	ctx, cancel := context.WithCancel(context.Background())
	pr, pw := io.Pipe()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.server.URL+"/git/"+b.ID+"/git-receive-pack", pr)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-git-receive-pack-request")
	req.AddCookie(&http.Cookie{Name: session.CookieName, Value: cookie})
	done := make(chan struct{})
	go func() {
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			resp.Body.Close()
		}
		close(done)
	}()
	// A partial pkt-line header: receive-pack waits for the rest.
	if _, err := pw.Write([]byte("0012")); err != nil {
		t.Fatalf("write partial: %v", err)
	}
	time.Sleep(100 * time.Millisecond)
	cancel()
	_ = pw.CloseWithError(context.Canceled)
	<-done

	// The repository is left clean: no stale lock, the head unchanged.
	deadline := time.Now().Add(3 * time.Second)
	for hasLockFiles(t, e.repoPath(b.ID)) && time.Now().Before(deadline) {
		time.Sleep(50 * time.Millisecond)
	}
	if hasLockFiles(t, e.repoPath(b.ID)) {
		t.Errorf("a *.lock remains under the repo after a disconnected push")
	}
	if h := headRev(t, e.repoPath(b.ID)); h != head0 {
		t.Errorf("head moved on a disconnected push: %s != %s", h, head0)
	}

	// A subsequent normal push succeeds.
	head1 := e.cloneCommitPush(t, cookie, b.ID, "depois.cifra.md", "# Depois\n\n```cifra\n[E]Teste\n```\n", "after")
	if head1 == head0 {
		t.Errorf("a normal push after a disconnect did not advance the head")
	}
}

// TestGitSizeCapAndDeadline pins the two request controls: a body over the cap
// is 413 before git is spawned, and a request under a deliberately tiny deadline
// is killed with the repository left intact. Pins DIRECTION §3.6 line 348;
// contract lines 800–808; Constraints 6, 7.
func TestGitSizeCapAndDeadline(t *testing.T) {
	// The cap: a declared body over the configured cap is 413, git not spawned.
	capEnv := newGitEnv(t)
	capEnv.api.GitMaxBodyBytes = 100
	_, capCookie := capEnv.registerNewAccount(t)
	capBook := capEnv.createBook(t, capCookie, "Cap Book")
	resp, _ := capEnv.gitReq(t, http.MethodPost, "/git/"+capBook.ID+"/git-upload-pack", capCookie, map[string]string{
		"Content-Type": "application/x-git-upload-pack-request",
	}, bytes.Repeat([]byte("x"), 500))
	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Errorf("over-cap body: status %d, want 413", resp.StatusCode)
	}

	// The deadline: seed with a normal deadline, then drive a push under a tiny
	// deadline — it is killed, the repository untouched — and a normal push after
	// (deadline restored) succeeds.
	e := newGitEnv(t)
	_, cookie := e.registerNewAccount(t)
	b := e.createBook(t, cookie, "Deadline Book")
	head0 := e.cloneCommitPush(t, cookie, b.ID, sampleSongName, sampleSongBody, "first")

	e.api.GitDeadline = time.Millisecond
	work := t.TempDir()
	if out, err := gitc(t, "", cookie, "clone", "-q", e.gitURL(b.ID), work); err != nil {
		// A clone under a 1ms deadline may itself be killed; either way nothing is
		// written. If the clone did succeed, press on to the push below.
		t.Logf("clone under tiny deadline failed as expected: %v\n%s", err, out)
		work = ""
	}
	if work != "" {
		gitIdentity(t, work)
		_ = os.WriteFile(filepath.Join(work, "x.cifra.md"), []byte("# X\n\n```cifra\n[C]A\n```\n"), 0o644)
		gitRun(t, work, "add", "x.cifra.md")
		gitRun(t, work, "commit", "-q", "-m", "x")
		if out, err := gitc(t, work, cookie, "push", "-q", "origin", "HEAD:refs/heads/main"); err == nil {
			t.Errorf("push under a 1ms deadline unexpectedly succeeded:\n%s", out)
		}
	}
	if h := headRev(t, e.repoPath(b.ID)); h != head0 {
		t.Errorf("head moved under a deadlined push: %s != %s", h, head0)
	}
	if hasLockFiles(t, e.repoPath(b.ID)) {
		t.Errorf("a *.lock remains after a deadlined push")
	}

	e.api.GitDeadline = 30 * time.Second
	head1 := e.cloneCommitPush(t, cookie, b.ID, "ok.cifra.md", "# OK\n\n```cifra\n[G]A\n```\n", "ok")
	if head1 == head0 {
		t.Errorf("a normal push after a deadline did not advance the head")
	}
}

// TestGitPreGitRefusals pins the pre-git refusals, each validated against the
// contract: no session → 401, a non-member and a soft-deleted book → 404
// (indistinguishable), a reader on git-receive-pack → 403, an over-quota account
// → 413 — each before git starts. Pins contract lines 616–623, 651–656,
// 689–696, 768–808; DIRECTION §3.3 lines 175–182, §3.6 lines 336–341.
func TestGitPreGitRefusals(t *testing.T) {
	e := newGitEnv(t)
	ownerID, ownerCookie := e.registerNewAccount(t)
	_ = ownerID
	b := e.createBook(t, ownerCookie, "Refusals Book")

	// No session → 401.
	resp, body := e.gitReq(t, http.MethodGet, "/git/"+b.ID+"/info/refs?service=git-upload-pack", "", nil, nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("no session: status %d, want 401", resp.StatusCode)
	}
	if err := e.contract.Validate("gitInfoRefs", apicontract.Response, "401", body); err != nil {
		t.Errorf("401 body does not conform: %v", err)
	}

	// A non-member → 404.
	_, strangerCookie := e.registerNewAccount(t)
	nmResp, nmBody := e.gitReq(t, http.MethodGet, "/git/"+b.ID+"/info/refs?service=git-upload-pack", strangerCookie, nil, nil)
	if nmResp.StatusCode != http.StatusNotFound {
		t.Errorf("non-member: status %d, want 404", nmResp.StatusCode)
	}
	if err := e.contract.Validate("gitInfoRefs", apicontract.Response, "404", nmBody); err != nil {
		t.Errorf("404 body does not conform: %v", err)
	}

	// A soft-deleted book → 404, indistinguishable from the non-member answer.
	del := e.createBook(t, ownerCookie, "Doomed Book")
	e.softDelete(t, del.ID)
	delResp, delBody := e.gitReq(t, http.MethodGet, "/git/"+del.ID+"/info/refs?service=git-upload-pack", ownerCookie, nil, nil)
	if delResp.StatusCode != http.StatusNotFound {
		t.Errorf("soft-deleted: status %d, want 404", delResp.StatusCode)
	}
	if !bytes.Equal(delBody, nmBody) {
		t.Errorf("soft-deleted body %q differs from non-member body %q (must be indistinguishable)", delBody, nmBody)
	}

	// A reader pushing → 403 (on both the push advertisement and the POST).
	readerID, readerCookie := e.registerNewAccount(t)
	e.insertMembership(t, b.ID, readerID, roleReader)
	readerCases := []struct {
		op, method, path string
		hdr              map[string]string
	}{
		{"gitInfoRefs", http.MethodGet, "/git/" + b.ID + "/info/refs?service=git-receive-pack", nil},
		{"gitReceivePack", http.MethodPost, "/git/" + b.ID + "/git-receive-pack", map[string]string{"Content-Type": "application/x-git-receive-pack-request"}},
	}
	for _, rc := range readerCases {
		rResp, rBody := e.gitReq(t, rc.method, rc.path, readerCookie, rc.hdr, []byte{})
		if rResp.StatusCode != http.StatusForbidden {
			t.Errorf("reader %s %s: status %d, want 403; body=%q", rc.method, rc.path, rResp.StatusCode, rBody)
		}
		if err := e.contract.Validate(rc.op, apicontract.Response, "403", rBody); err != nil {
			t.Errorf("403 body for %s does not conform: %v", rc.path, err)
		}
	}

	// An owning account already at its byte cap → 413, before git starts.
	e.setSize(t, b.ID, maxBytesPerAccount)
	qResp, qBody := e.gitReq(t, http.MethodPost, "/git/"+b.ID+"/git-receive-pack", ownerCookie, map[string]string{
		"Content-Type": "application/x-git-receive-pack-request",
	}, []byte{})
	if qResp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Errorf("over-quota push: status %d, want 413", qResp.StatusCode)
	}
	if err := e.contract.Validate("gitReceivePack", apicontract.Response, "413", qBody); err != nil {
		t.Errorf("413 body does not conform: %v", err)
	}
}

// TestTakenDownGitRefusal pins the one branch service.admin adds to the git gate:
// after admin.TakeDown records its notice, a taken-down book's owner and members
// are refused 403 taken_down carrying the reason — on info/refs (clone and push
// advertisements) and the git-receive-pack POST alike — while a non-member keeps
// the undifferentiated 404 that never confirms a private book to a stranger. Pins
// the task note ("each action against Postgres and git, the owner's notice
// recorded"); workflow 10 lines 103-106; DIRECTION §3.6 lines 338-341; the
// contract git routes + the taken_down response.
func TestTakenDownGitRefusal(t *testing.T) {
	e := newGitEnv(t)
	ownerID, ownerCookie := e.registerNewAccount(t)
	_ = ownerID
	b := e.createBook(t, ownerCookie, "Taken Down Book")

	memberID, memberCookie := e.registerNewAccount(t)
	e.insertMembership(t, b.ID, memberID, roleEditor)

	const reason = "Copyright notice: takedown request 2026-10."
	if err := admin.TakeDown(context.Background(), e.pool, b.ID, reason); err != nil {
		t.Fatalf("admin.TakeDown: %v", err)
	}
	// The notice is recorded (the record behind "the owner is told why").
	var notices int
	if err := e.pool.QueryRow(context.Background(),
		`SELECT count(*) FROM book_notices WHERE book_id = $1 AND action = 'take_down'`, b.ID).Scan(&notices); err != nil {
		t.Fatalf("count notices: %v", err)
	}
	if notices != 1 {
		t.Fatalf("book_notices rows = %d, want 1", notices)
	}

	// An insider (owner or member) is refused 403 taken_down carrying the reason,
	// on every git route: the upload-pack advertisement (clone/fetch), the
	// receive-pack advertisement (push), and the receive-pack POST (push).
	insiderCases := []struct {
		op, method, path string
		hdr              map[string]string
	}{
		{"gitInfoRefs", http.MethodGet, "/git/" + b.ID + "/info/refs?service=git-upload-pack", nil},
		{"gitInfoRefs", http.MethodGet, "/git/" + b.ID + "/info/refs?service=git-receive-pack", nil},
		{"gitReceivePack", http.MethodPost, "/git/" + b.ID + "/git-receive-pack", map[string]string{"Content-Type": "application/x-git-receive-pack-request"}},
		{"gitUploadPack", http.MethodPost, "/git/" + b.ID + "/git-upload-pack", map[string]string{"Content-Type": "application/x-git-upload-pack-request"}},
	}
	for _, who := range []struct{ name, cookie string }{{"owner", ownerCookie}, {"member", memberCookie}} {
		for _, c := range insiderCases {
			resp, body := e.gitReq(t, c.method, c.path, who.cookie, c.hdr, []byte{})
			if resp.StatusCode != http.StatusForbidden {
				t.Errorf("%s %s %s: status %d, want 403; body=%q", who.name, c.method, c.path, resp.StatusCode, body)
				continue
			}
			if err := e.contract.Validate(c.op, apicontract.Response, "403", body); err != nil {
				t.Errorf("%s %s 403 body does not conform: %v", who.name, c.path, err)
			}
			var er errorBody
			if err := json.Unmarshal(body, &er); err != nil {
				t.Errorf("%s %s: decode body: %v", who.name, c.path, err)
				continue
			}
			if er.Code != "taken_down" {
				t.Errorf("%s %s: code = %q, want taken_down", who.name, c.path, er.Code)
			}
			if !strings.Contains(er.Message, reason) {
				t.Errorf("%s %s: message %q does not carry the reason %q", who.name, c.path, er.Message, reason)
			}
		}
	}

	// A stranger (non-member) still gets the undifferentiated 404 — never the
	// reason, never a confirmation the book exists.
	_, strangerCookie := e.registerNewAccount(t)
	sResp, sBody := e.gitReq(t, http.MethodGet, "/git/"+b.ID+"/info/refs?service=git-upload-pack", strangerCookie, nil, nil)
	if sResp.StatusCode != http.StatusNotFound {
		t.Errorf("stranger: status %d, want 404", sResp.StatusCode)
	}
	if err := e.contract.Validate("gitInfoRefs", apicontract.Response, "404", sBody); err != nil {
		t.Errorf("stranger 404 body does not conform: %v", err)
	}
	var sErr errorBody
	if err := json.Unmarshal(sBody, &sErr); err == nil && strings.Contains(sErr.Message, reason) {
		t.Errorf("stranger body leaked the take-down reason: %q", sErr.Message)
	}
}

// TestGitPushEnvironmentAndSizeRefresh pins that a push spawns git receive-pack
// with the ESTANTE_* environment and the hooks path set (asserted via a
// recording hook in the configured hooks directory), and that books.size_bytes
// is refreshed to the post-push on-disk size. Pins DIRECTION §3.6 lines 342–346;
// workflow 14 line 111; 0001_registry.sql:88.
func TestGitPushEnvironmentAndSizeRefresh(t *testing.T) {
	e := newGitEnv(t)
	ownerID, cookie := e.registerNewAccount(t)
	b := e.createBook(t, cookie, "Hooked Book")

	// A recording pre-receive hook: it writes its ESTANTE_* environment to a file
	// and accepts the push (reads stdin, exits 0). git finds it via core.hooksPath.
	out := filepath.Join(t.TempDir(), "hookenv")
	script := "#!/bin/sh\nenv | grep '^ESTANTE_' > '" + out + "'\ncat > /dev/null\nexit 0\n"
	if err := os.WriteFile(filepath.Join(e.hooksDir, "pre-receive"), []byte(script), 0o755); err != nil {
		t.Fatalf("write hook: %v", err)
	}

	e.cloneCommitPush(t, cookie, b.ID, sampleSongName, sampleSongBody, "first")

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatalf("the hook did not run (no env file): %v", err)
	}
	env := string(data)
	for _, want := range []string{
		"ESTANTE_USER=" + ownerID,
		"ESTANTE_BOOK=" + b.ID,
		"ESTANTE_ROLE=owner",
		"ESTANTE_BOOK_KIND=songbook",
	} {
		if !strings.Contains(env, want) {
			t.Errorf("hook environment missing %q; got:\n%s", want, env)
		}
	}
	for _, key := range []string{"ESTANTE_ACCOUNT_BYTES_REMAINING=", "ESTANTE_BOOK_BYTES="} {
		if !strings.Contains(env, key) {
			t.Errorf("hook environment missing %q; got:\n%s", key, env)
		}
	}

	// size_bytes is refreshed to the on-disk footprint after the push.
	store := book.Store{Root: e.booksRoot}
	onDisk, err := store.Size(b.ID)
	if err != nil {
		t.Fatalf("Size: %v", err)
	}
	if onDisk <= 0 {
		t.Fatalf("on-disk size = %d, want > 0 after a push", onDisk)
	}
	if got := e.sizeBytes(t, b.ID); got != onDisk {
		t.Errorf("books.size_bytes = %d, want the on-disk size %d", got, onDisk)
	}
}

// canonicalHomePrefs is a canonical §6 preferences.json (object members sorted,
// two-space indent, one trailing LF) — the body a home book brings online.
const canonicalHomePrefs = "{\n" +
	"  \"theme\": {\n" +
	"    \"at\": \"2026-10-05T14:30:00.000Z\",\n" +
	"    \"value\": \"palco\"\n" +
	"  }\n" +
	"}\n"

// installRealHook builds the real pre-receive binary (hook.home_book and all the
// other layers, with cifra.md for Go) into the env's hooks directory, so a push
// is validated by the shipped hook rather than git's bare guards. git finds it
// via core.hooksPath (api.HooksDir).
func installRealHook(t *testing.T, hooksDir string) {
	t.Helper()
	bin := filepath.Join(hooksDir, "pre-receive")
	cmd := exec.Command("go", "build", "-o", bin, "estantedecifras.app/service/cmd/pre-receive")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("go build pre-receive: %v\n%s", err, out)
	}
}

// TestReceivePackKindForwarding pins the service→hook kind forwarding: the
// service reads a book's kind and sets ESTANTE_BOOK_KIND on receive-pack, so the
// real hook validates a home book as settings and a songbook as songs. A
// kind='home' book accepts a canonical home-book push and refuses a song; a
// kind='songbook' book refuses a settings *.json. Pins docs/home-book-format.md
// §8 lines 496-500 (the TestReceivePackGuards model, now with the real hook).
func TestReceivePackKindForwarding(t *testing.T) {
	t.Run("a home book accepts canonical settings and refuses a song", func(t *testing.T) {
		e := newGitEnv(t)
		installRealHook(t, e.hooksDir)
		_, cookie := e.registerNewAccount(t)
		b := e.createBook(t, cookie, "Home Book")
		e.setKind(t, b.ID, "home")

		work := t.TempDir()
		url := e.gitURL(b.ID)
		if out, err := gitc(t, "", cookie, "clone", "-q", url, work); err != nil {
			t.Fatalf("clone for push: %v\n%s", err, out)
		}
		gitIdentity(t, work)

		// A canonical home-book push is accepted.
		if err := os.WriteFile(filepath.Join(work, "preferences.json"), []byte(canonicalHomePrefs), 0o644); err != nil {
			t.Fatalf("write preferences.json: %v", err)
		}
		gitRun(t, work, "add", ".")
		gitRun(t, work, "commit", "-q", "-m", "home online")
		if out, err := gitc(t, work, cookie, "push", "-q", "origin", "HEAD:refs/heads/main"); err != nil {
			t.Fatalf("a canonical home-book push should be accepted: %v\n%s", err, out)
		}

		// A song pushed to the same home book is refused, the reason on git's channel.
		if err := os.WriteFile(filepath.Join(work, "cancao.cifra.md"), []byte(sampleSongBody), 0o644); err != nil {
			t.Fatalf("write song: %v", err)
		}
		gitRun(t, work, "add", ".")
		gitRun(t, work, "commit", "-q", "-m", "a song in the home book")
		out, err := gitc(t, work, cookie, "push", "-q", "origin", "HEAD:refs/heads/main")
		if err == nil {
			t.Fatalf("a song pushed to a home book should be refused:\n%s", out)
		}
		if !strings.Contains(out, "remote:") || !strings.Contains(out, "song or setlist") {
			t.Errorf("the hook's reason should reach the client on git's channel; got:\n%s", out)
		}
	})

	t.Run("a songbook refuses a settings file", func(t *testing.T) {
		e := newGitEnv(t)
		installRealHook(t, e.hooksDir)
		_, cookie := e.registerNewAccount(t)
		b := e.createBook(t, cookie, "Songbook") // kind defaults to 'songbook'

		work := t.TempDir()
		url := e.gitURL(b.ID)
		if out, err := gitc(t, "", cookie, "clone", "-q", url, work); err != nil {
			t.Fatalf("clone for push: %v\n%s", err, out)
		}
		gitIdentity(t, work)
		if err := os.WriteFile(filepath.Join(work, "preferences.json"), []byte(canonicalHomePrefs), 0o644); err != nil {
			t.Fatalf("write preferences.json: %v", err)
		}
		gitRun(t, work, "add", ".")
		gitRun(t, work, "commit", "-q", "-m", "settings in a songbook")
		out, err := gitc(t, work, cookie, "push", "-q", "origin", "HEAD:refs/heads/main")
		if err == nil {
			t.Fatalf("a settings file pushed to a songbook should be refused:\n%s", out)
		}
		if !strings.Contains(out, "remote:") || !strings.Contains(out, "not an allowed path for a songbook") {
			t.Errorf("the songbook path should refuse a settings file; got:\n%s", out)
		}
	})
}

// TestReceivePackGuards pins that the service spawns git receive-pack with the
// two git-level push guards it sets via -c: receive.maxInputSize (git refuses an
// over-size pack before the hook runs) and receive.fsckObjects (git refuses a
// malformed object). The book's hooks directory is empty here, so only git's own
// guards act — proving the service sets the flags (the cmd/pre-receive git-config
// behavior test proves git enforces them). Pins workflow 14 lines 109–110 and
// DIRECTION §3.6 lines 347–348 ("a size cap before git reads a byte").
func TestReceivePackGuards(t *testing.T) {
	t.Run("receive.maxInputSize refuses an over-size pack", func(t *testing.T) {
		e := newGitEnv(t)
		e.api.ReceiveMaxInputSize = 512 // tiny: no real pack fits under it
		_, cookie := e.registerNewAccount(t)
		b := e.createBook(t, cookie, "Max Input Size")

		work := t.TempDir()
		url := e.gitURL(b.ID)
		if out, err := gitc(t, "", cookie, "clone", "-q", url, work); err != nil {
			t.Fatalf("clone for push: %v\n%s", err, out)
		}
		gitIdentity(t, work)
		// Purpose-written filler large enough that the pack exceeds the cap.
		var body strings.Builder
		body.WriteString("# Filler\n\n```cifra\n")
		for i := 0; i < 2000; i++ {
			fmt.Fprintf(&body, "[C]linha de preenchimento numero %d pra engordar o pacote\n", i)
		}
		body.WriteString("```\n")
		if err := os.WriteFile(filepath.Join(work, "filler.cifra.md"), []byte(body.String()), 0o644); err != nil {
			t.Fatalf("write filler: %v", err)
		}
		gitRun(t, work, "add", ".")
		gitRun(t, work, "commit", "-q", "-m", "filler")
		out, err := gitc(t, work, cookie, "push", "-q", "origin", "HEAD:refs/heads/main")
		if err == nil {
			t.Fatalf("an over-size pack should be refused by receive.maxInputSize:\n%s", out)
		}
		if !strings.Contains(out, "maximum allowed size") {
			t.Errorf("git should name the pack-size limit on its own channel; got:\n%s", out)
		}
	})

	t.Run("receive.fsckObjects refuses a malformed object", func(t *testing.T) {
		e := newGitEnv(t)
		_, cookie := e.registerNewAccount(t)
		b := e.createBook(t, cookie, "Fsck Objects")

		work := t.TempDir()
		url := e.gitURL(b.ID)
		if out, err := gitc(t, "", cookie, "clone", "-q", url, work); err != nil {
			t.Fatalf("clone for push: %v\n%s", err, out)
		}
		gitIdentity(t, work)
		// A valid commit first, for a real tree the malformed commit references.
		if err := os.WriteFile(filepath.Join(work, sampleSongName), []byte(sampleSongBody), 0o644); err != nil {
			t.Fatalf("write song: %v", err)
		}
		gitRun(t, work, "add", ".")
		gitRun(t, work, "commit", "-q", "-m", "base")
		tree := strings.TrimSpace(mustOutput(t, work, "rev-parse", "HEAD^{tree}"))
		// A commit object missing its author line — a known fsck violation
		// (missingAuthor). hash-object --literally stores it despite the fault so
		// it can be offered; receive.fsckObjects is what rejects it on the server.
		malformed := "tree " + tree +
			"\ncommitter Estante Test <t@estante.test> 1700000000 +0000\n\nmalformed: no author line\n"
		malformedFile := filepath.Join(t.TempDir(), "malformed")
		if err := os.WriteFile(malformedFile, []byte(malformed), 0o644); err != nil {
			t.Fatalf("write malformed: %v", err)
		}
		bad := strings.TrimSpace(mustOutput(t, work, "hash-object", "-t", "commit", "-w", "--literally", malformedFile))
		gitRun(t, work, "update-ref", "refs/heads/main", bad)
		out, err := gitc(t, work, cookie, "push", "-q", "origin", "main:refs/heads/main")
		if err == nil {
			t.Fatalf("a malformed object should be refused by receive.fsckObjects:\n%s", out)
		}
		if !strings.Contains(out, "missingAuthor") && !strings.Contains(out, "fsck") {
			t.Errorf("git should name the malformed-object fault on its own channel; got:\n%s", out)
		}
	})
}

// --- small shared helpers --------------------------------------------------

func mustOutput(t *testing.T, barePathOrWork string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = barePathOrWork
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0")
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("git %s in %s: %v", strings.Join(args, " "), barePathOrWork, err)
	}
	return string(out)
}

func hasLockFiles(t *testing.T, barePath string) bool {
	t.Helper()
	found := false
	_ = filepath.WalkDir(barePath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if !d.IsDir() && strings.HasSuffix(path, ".lock") {
			found = true
		}
		return nil
	})
	return found
}

package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	apicontract "estantedecifras.app/api"
	"estantedecifras.app/service/internal/session"
)

// These behavior tests pin the read-only scope of a paired reMarkable's
// session (reader.device_pairing Constraints 7, 8; docs/remarkable-reader.md
// §5.1–5.3, §10): with a session delivered by pairing, against a real book the
// account owns (newGitEnv, the real pre-receive hook, real git as the client),
// it reads — clone, fetch, the change check, the home book, the device list —
// and is refused, 403 read_only, a push and every API write, changing nothing.
// A full passkey session passes the same guard untouched. A standalone `go
// test` with the DSN unset skips (migratedServerSchema → envDSN).

// readerSong is a canonical song written for these tests, so the real hook
// accepts the owner's pushes.
const readerSong = "# Ponte do Leitor\n\n```\n[C] Luz do cais\n```\n"

// readOnlyEnv is a git env with a passkey owner, a book holding one pushed
// song, and a paired reader session of the owner's account.
type readOnlyEnv struct {
	*gitEnv
	ownerID, owner, reader string
	book                   bookJSON
	head                   string
}

func newReadOnlyEnv(t *testing.T) *readOnlyEnv {
	t.Helper()
	e := newGitEnv(t)
	e.api.InvitationSecret = []byte(testInvitationSecret)
	installRealHook(t, e.hooksDir)
	ownerID, owner := e.registerNewAccount(t)
	b := e.createBook(t, owner, "Livro do Leitor")
	head := e.cloneCommitPush(t, owner, b.ID, "marcha.cifra.md", readerSong, "first song")
	reader := e.pairDevice(t, owner)
	return &readOnlyEnv{gitEnv: e, ownerID: ownerID, owner: owner, reader: reader, book: b, head: head}
}

// TestReadOnlyAllowsReads pins §5.2–5.3: a reader session clones and fetches
// over upload-pack, runs the change check, reads its home book and the
// device list.
func TestReadOnlyAllowsReads(t *testing.T) {
	e := newReadOnlyEnv(t)

	work := t.TempDir()
	if out, err := gitc(t, "", e.reader, "clone", "-q", e.gitURL(e.book.ID), work); err != nil {
		t.Fatalf("reader clone: %v\n%s", err, out)
	}
	if got := strings.TrimSpace(mustOutput(t, work, "rev-parse", "HEAD")); got != e.head {
		t.Errorf("reader cloned %s, want %s", got, e.head)
	}
	moved := e.cloneCommitPush(t, e.owner, e.book.ID, "segunda.cifra.md", readerSong, "second song")
	if out, err := gitc(t, work, e.reader, "fetch", "-q", "origin"); err != nil {
		t.Fatalf("reader fetch: %v\n%s", err, out)
	}
	if got := strings.TrimSpace(mustOutput(t, work, "rev-parse", "origin/main")); got != moved {
		t.Errorf("reader fetched %s, want %s", got, moved)
	}

	resp, body := e.do(t, http.MethodPost, "/api/shelf/change-check", e.reader, ccBody(t, headEntry(e.book.ID, e.head)))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("change-check: %d %s, want 200", resp.StatusCode, body)
	}
	e.validate(t, "changeCheck", resp, body)
	var cc changeCheckResponse
	if err := json.Unmarshal(body, &cc); err != nil {
		t.Fatal(err)
	}
	if c, ok := changeByID(cc, e.book.ID); !ok || c.Head == nil || *c.Head != moved {
		t.Errorf("change-check for the moved book = %+v, want head %s", c, moved)
	}

	e.getHomeBook(t, e.reader)

	resp, body = e.do(t, http.MethodGet, "/api/account/sessions", e.reader, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("listSessions: %d %s, want 200", resp.StatusCode, body)
	}
	e.validate(t, "listSessions", resp, body)
}

// TestReadOnlyRefusesPush pins §5.1 "the service refuses a git push": the
// push advertisement and a hand-made receive-pack are 403, a real git push
// fails, the book's ref is unmoved — and authorizePush refuses it with the
// guard bypassed (Constraint 8).
func TestReadOnlyRefusesPush(t *testing.T) {
	e := newReadOnlyEnv(t)

	resp, body := e.gitReq(t, http.MethodGet, "/git/"+e.book.ID+"/info/refs?service=git-receive-pack", e.reader, nil, nil)
	wantError(t, "push advertisement", resp, body, http.StatusForbidden, "read_only")
	e.validate(t, "gitInfoRefs", resp, body)
	resp, body = e.gitReq(t, http.MethodPost, "/git/"+e.book.ID+"/git-receive-pack", e.reader,
		map[string]string{"Content-Type": "application/x-git-receive-pack-request"}, []byte{})
	wantError(t, "receive-pack", resp, body, http.StatusForbidden, "read_only")
	e.validate(t, "gitReceivePack", resp, body)

	work := t.TempDir()
	if out, err := gitc(t, "", e.reader, "clone", "-q", e.gitURL(e.book.ID), work); err != nil {
		t.Fatalf("reader clone: %v\n%s", err, out)
	}
	gitIdentity(t, work)
	if err := os.WriteFile(filepath.Join(work, "nova.cifra.md"), []byte(readerSong), 0o644); err != nil {
		t.Fatal(err)
	}
	gitRun(t, work, "add", ".")
	gitRun(t, work, "commit", "-q", "-m", "from the reader")
	if out, err := gitc(t, work, e.reader, "push", "-q", "origin", "HEAD:refs/heads/main"); err == nil {
		t.Fatalf("a reader-session push was accepted:\n%s", out)
	}
	if got := headRev(t, e.repoPath(e.book.ID)); got != e.head {
		t.Errorf("the book moved to %s, want it unmoved at %s", got, e.head)
	}

	// The guard bypassed: the receive-pack handler alone still refuses.
	req := httptest.NewRequest(http.MethodPost, "/git/"+e.book.ID+"/git-receive-pack", nil)
	req.SetPathValue("bookId", e.book.ID)
	req.Header.Set("Content-Type", "application/x-git-receive-pack-request")
	req.AddCookie(&http.Cookie{Name: session.CookieName, Value: e.reader})
	rec := httptest.NewRecorder()
	handleGitReceivePack(e.api).ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("receive-pack without the guard: status %d, want 403; body=%s", rec.Code, rec.Body.Bytes())
	}
	if err := e.contract.Validate("gitReceivePack", apicontract.Response, "403", rec.Body.Bytes()); err != nil {
		t.Errorf("unguarded 403 does not conform: %v", err)
	}
	if got := headRev(t, e.repoPath(e.book.ID)); got != e.head {
		t.Errorf("the book moved to %s, want it unmoved", got)
	}
}

// TestReadOnlyRefusesWrites pins §5.1 "any write it makes": 403 read_only on
// a spread of API writes, contract-validated, and nothing changed.
func TestReadOnlyRefusesWrites(t *testing.T) {
	e := newReadOnlyEnv(t)
	ownerSession := e.owner
	pending := e.beginPairing(t, "")

	before := map[string]int{
		"books":       e.countRows(t, `SELECT count(*) FROM books WHERE deleted_at IS NULL`),
		"sessions":    e.countRows(t, `SELECT count(*) FROM sessions WHERE revoked_at IS NULL`),
		"accounts":    e.countRows(t, `SELECT count(*) FROM accounts`),
		"invitations": e.countRows(t, `SELECT count(*) FROM invitations`),
		"approved":    e.countRows(t, `SELECT count(*) FROM device_pairings WHERE approved_at IS NOT NULL`),
	}

	for _, c := range []struct {
		op, method, path string
		body             []byte
	}{
		{"createBook", http.MethodPost, "/api/books", []byte(`{"title":"Do Leitor"}`)},
		{"revokeSession", http.MethodDelete, "/api/account/sessions/" + ownerSession, nil},
		{"approveDevicePairing", http.MethodPost, "/api/devices/pair/approve", []byte(`{"code":` + mustQuote(pending.Code) + `}`)},
		{"deleteAccount", http.MethodDelete, "/api/account", []byte(`{"confirm":"someone@example.test"}`)},
		{"createInvitation", http.MethodPost, "/api/books/" + e.book.ID + "/invitations", []byte(`{"role":"reader"}`)},
	} {
		resp, body := e.do(t, c.method, c.path, e.reader, c.body)
		wantError(t, c.op, resp, body, http.StatusForbidden, "read_only")
		e.validate(t, c.op, resp, body)
	}

	after := map[string]int{
		"books":       e.countRows(t, `SELECT count(*) FROM books WHERE deleted_at IS NULL`),
		"sessions":    e.countRows(t, `SELECT count(*) FROM sessions WHERE revoked_at IS NULL`),
		"accounts":    e.countRows(t, `SELECT count(*) FROM accounts`),
		"invitations": e.countRows(t, `SELECT count(*) FROM invitations`),
		"approved":    e.countRows(t, `SELECT count(*) FROM device_pairings WHERE approved_at IS NOT NULL`),
	}
	for k, v := range before {
		if after[k] != v {
			t.Errorf("%s changed from %d to %d under a read-only session", k, v, after[k])
		}
	}
}

// TestReadOnlySignsItselfOut pins reader.pairing's "Sign out ends the session
// with the service" (Decision 3): signOut 204, then 401.
func TestReadOnlySignsItselfOut(t *testing.T) {
	e := newReadOnlyEnv(t)
	if resp, body := e.do(t, http.MethodPost, "/api/auth/signout", e.reader, nil); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("signOut: %d %s, want 204", resp.StatusCode, body)
	}
	resp, body := e.do(t, http.MethodGet, "/api/account/home-book", e.reader, nil)
	wantError(t, "home-book after sign-out", resp, body, http.StatusUnauthorized, "unauthorized")
}

// TestFullSessionUnaffected pins no regression: a passkey session passes the
// guard on the same writes, and pushes.
func TestFullSessionUnaffected(t *testing.T) {
	e := newReadOnlyEnv(t)
	if resp, body := e.do(t, http.MethodPost, "/api/books", e.owner, []byte(`{"title":"Outro"}`)); resp.StatusCode != http.StatusCreated {
		t.Errorf("createBook: %d %s, want 201", resp.StatusCode, body)
	}
	if resp, body := e.do(t, http.MethodPost, "/api/books/"+e.book.ID+"/invitations", e.owner, []byte(`{"role":"reader"}`)); resp.StatusCode != http.StatusCreated {
		t.Errorf("createInvitation: %d %s, want 201", resp.StatusCode, body)
	}
	p := e.beginPairing(t, "")
	if resp, body := e.approvePair(t, e.owner, p.Code); resp.StatusCode != http.StatusNoContent {
		t.Errorf("approve: %d %s, want 204", resp.StatusCode, body)
	}
	if resp, body := e.do(t, http.MethodDelete, "/api/account/sessions/"+e.reader, e.owner, nil); resp.StatusCode != http.StatusNoContent {
		t.Errorf("revokeSession: %d %s, want 204", resp.StatusCode, body)
	}
	moved := e.cloneCommitPush(t, e.owner, e.book.ID, "terceira.cifra.md", readerSong, "owner push")
	if moved == e.head {
		t.Error("the owner's push did not move the book")
	}
}

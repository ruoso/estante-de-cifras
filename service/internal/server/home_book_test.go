package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	apicontract "estantedecifras.app/api"
	"estantedecifras.app/service/internal/session"
)

// These behavior tests drive GET /api/account/home-book and the Books and
// sharing routes it is kept out of through httptest against the compose Postgres
// (ESTANTE_TEST_DATABASE_URL) and real git on a t.TempDir() books root, with the
// passkey ceremony standing in for a sign-in. They pin service.home_book: one
// home book per account (kind 'home'), made empty on the first request and the
// same one ever after, invisible to the Books API, refused to another account,
// validated by the hook as a home book, and deleted with the account
// (docs/home-book-format.md §1, §8; workflows 1, 13, 17). Every response is
// validated against the contract (api/openapi.yaml getHomeBook). A standalone
// `go test` with the DSN unset skips (migratedServerSchema → envDSN).

// The exact §2.2 README and .gitattributes a home book holds
// (docs/home-book-format.md lines 106-119), written here as the app writes them —
// held in agreement with the hook by this test, not by shared code.
const (
	homeBookReadme = "# Home book\n" +
		"\n" +
		"This repository holds one person's Estante de Cifras settings. Its files are\n" +
		"JSON that merge key by key, the later change winning; it is written and merged\n" +
		"by the app, not edited by hand. The format is docs/home-book-format.md in the\n" +
		"estante-de-cifras repository.\n"
	homeBookGitattributes = "* text=auto eol=lf\n*.json merge=binary\n"
)

// getHomeBook GETs /api/account/home-book with the session cookie, asserting 200
// and contract conformance, and returns the decoded home book.
func (e *passkeyEnv) getHomeBook(t *testing.T, cookie string) homeBookJSON {
	t.Helper()
	resp, body := e.do(t, http.MethodGet, "/api/account/home-book", cookie, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("getHomeBook: status = %d, want 200; body=%s", resp.StatusCode, body)
	}
	if err := e.contract.Validate("getHomeBook", apicontract.Response, "200", body); err != nil {
		t.Errorf("getHomeBook response does not conform: %v", err)
	}
	var hb homeBookJSON
	if err := json.Unmarshal(body, &hb); err != nil {
		t.Fatalf("decoding home book: %v", err)
	}
	return hb
}

// TestHomeBookProvisionedOnce pins the note's "provisioned once, idempotent;
// kind home" (docs/home-book-format.md §1, §8 lines 496-500): the first request
// makes one kind='home' row owned by the caller and an empty bare repository (no
// main — the device pushes the first commit), and every later request, from
// this session or another of the same account, answers the same one.
func TestHomeBookProvisionedOnce(t *testing.T) {
	e := newBooksEnv(t)
	accountID, cookie := e.registerNewAccount(t)

	hb := e.getHomeBook(t, cookie)
	if want := testPkOrigin + "/git/" + hb.ID; hb.GitURL != want {
		t.Errorf("gitUrl = %q, want %q", hb.GitURL, want)
	}
	if n := e.countRows(t, `SELECT count(*) FROM books WHERE owner_id = $1 AND kind = 'home'`, accountID); n != 1 {
		t.Fatalf("home book rows = %d, want 1", n)
	}
	if n := e.countRows(t, `SELECT count(*) FROM books WHERE id = $1 AND owner_id = $2 AND kind = 'home'`, hb.ID, accountID); n != 1 {
		t.Errorf("the returned id is not the account's kind='home' row")
	}

	// An empty bare repository: bare, and no main yet.
	path := e.repoPath(hb.ID)
	if out := strings.TrimSpace(mustOutput(t, path, "rev-parse", "--is-bare-repository")); out != "true" {
		t.Errorf("%s is-bare-repository = %q, want true", path, out)
	}
	if err := exec.Command("git", "-C", path, "rev-parse", "--verify", "--quiet", "refs/heads/main").Run(); err == nil {
		t.Errorf("a fresh home book has a main ref; the service must seed no commit")
	}

	// Again from the same session, and from a second session of the account.
	if again := e.getHomeBook(t, cookie); again != hb {
		t.Errorf("second GET = %+v, want %+v", again, hb)
	}
	secondCookie := e.authenticateWithUA(t, "Second Device")
	if secondCookie == "" || secondCookie == cookie {
		t.Fatalf("expected a distinct second session cookie")
	}
	if other := e.getHomeBook(t, secondCookie); other != hb {
		t.Errorf("GET from a second session = %+v, want %+v", other, hb)
	}
	if n := e.countRows(t, `SELECT count(*) FROM books WHERE owner_id = $1 AND kind = 'home'`, accountID); n != 1 {
		t.Errorf("home book rows after three GETs = %d, want 1", n)
	}
}

// TestHomeBookConcurrentFirstRequests pins Constraint 2 (the partial unique
// index of migration 0005): N first requests racing for one account all answer
// the same id, with one row and one repository.
func TestHomeBookConcurrentFirstRequests(t *testing.T) {
	e := newBooksEnv(t)
	accountID, cookie := e.registerNewAccount(t)

	const n = 8
	type result struct {
		status int
		body   []byte
		err    error
	}
	results := make([]result, n)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			req, err := http.NewRequest(http.MethodGet, e.server.URL+"/api/account/home-book", nil)
			if err != nil {
				results[i].err = err
				return
			}
			req.AddCookie(&http.Cookie{Name: session.CookieName, Value: cookie})
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				results[i].err = err
				return
			}
			defer resp.Body.Close()
			results[i].status = resp.StatusCode
			results[i].body, results[i].err = io.ReadAll(resp.Body)
		}(i)
	}
	close(start)
	wg.Wait()

	ids := map[string]bool{}
	for i, r := range results {
		if r.err != nil {
			t.Fatalf("request %d: %v", i, r.err)
		}
		if r.status != http.StatusOK {
			t.Fatalf("request %d: status = %d, want 200; body=%s", i, r.status, r.body)
		}
		if err := e.contract.Validate("getHomeBook", apicontract.Response, "200", r.body); err != nil {
			t.Errorf("request %d does not conform: %v", i, err)
		}
		var hb homeBookJSON
		if err := json.Unmarshal(r.body, &hb); err != nil {
			t.Fatalf("request %d: decoding: %v", i, err)
		}
		ids[hb.ID] = true
	}
	if len(ids) != 1 {
		t.Fatalf("concurrent first requests answered %d different ids, want 1: %v", len(ids), ids)
	}
	if c := e.countRows(t, `SELECT count(*) FROM books WHERE owner_id = $1 AND kind = 'home'`, accountID); c != 1 {
		t.Errorf("home book rows = %d, want 1", c)
	}
	repos, err := filepath.Glob(filepath.Join(e.booksRoot, "*.git"))
	if err != nil {
		t.Fatalf("listing repositories: %v", err)
	}
	if len(repos) != 1 {
		t.Errorf("repositories on the volume = %d (%v), want 1", len(repos), repos)
	}
}

// TestHomeBookAbsentFromBookList pins the note's "absent from the songbook list"
// and Constraint 8: listBooks returns the account's songbook and not its home
// book, and the home book does not count toward the 100-book cap — a create at
// 99 songbooks plus the home book still succeeds.
func TestHomeBookAbsentFromBookList(t *testing.T) {
	e := newBooksEnv(t)
	accountID, cookie := e.registerNewAccount(t)

	hb := e.getHomeBook(t, cookie)
	song := e.createBook(t, cookie, "Cancioneiro")

	list := e.listBooks(t, cookie)
	if len(list.Books) != 1 || list.Books[0].ID != song.ID {
		t.Errorf("listBooks = %+v, want only the songbook %s", list.Books, song.ID)
	}
	if _, ok := bookByID(list, hb.ID); ok {
		t.Errorf("listBooks lists the home book %s", hb.ID)
	}

	// 98 more songbooks: 99 owned songbooks and the home book.
	if _, err := e.pool.Exec(context.Background(),
		`INSERT INTO books (owner_id) SELECT $1::uuid FROM generate_series(1, 98)`, accountID); err != nil {
		t.Fatalf("seeding 98 books: %v", err)
	}
	resp, body := e.do(t, http.MethodPost, "/api/books", cookie, []byte(`{"title":"The Hundredth"}`))
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("100th songbook beside the home book: status = %d, want 201; body=%s", resp.StatusCode, body)
	}
	if err := e.contract.Validate("createBook", apicontract.Response, "201", body); err != nil {
		t.Errorf("createBook response does not conform: %v", err)
	}
}

// TestHomeBookNotShareable pins the note's "not shareable"
// (docs/home-book-format.md lines 18-23: "no invitations, no members beyond the
// one owner") and DIRECTION §3.6's home book bullet: on the Books and sharing
// routes the home book is no such book, even to its owner — createInvitation,
// listInvitations, listMembers, deleteBook and forkBook all answer 404, the row
// stays and no invitation is made. An invitation onto a home book put there by
// hand is refused on accept as unknown (the accept transaction's defence in
// depth).
func TestHomeBookNotShareable(t *testing.T) {
	e := newBooksEnv(t)
	accountID, cookie := e.registerNewAccount(t)
	hb := e.getHomeBook(t, cookie)

	for _, c := range []struct {
		op     string
		method string
		path   string
		body   []byte
	}{
		{"createInvitation", http.MethodPost, "/api/books/" + hb.ID + "/invitations", []byte(`{"role":"editor"}`)},
		{"listInvitations", http.MethodGet, "/api/books/" + hb.ID + "/invitations", nil},
		{"listMembers", http.MethodGet, "/api/books/" + hb.ID + "/members", nil},
		{"deleteBook", http.MethodDelete, "/api/books/" + hb.ID, nil},
		{"forkBook", http.MethodPost, "/api/books/" + hb.ID + "/fork", nil},
	} {
		resp, body := e.do(t, c.method, c.path, cookie, c.body)
		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("%s on the home book: status = %d, want 404; body=%s", c.op, resp.StatusCode, body)
			continue
		}
		if err := e.contract.Validate(c.op, apicontract.Response, "404", body); err != nil {
			t.Errorf("%s 404 does not conform: %v", c.op, err)
		}
	}

	if n := e.countRows(t, `SELECT count(*) FROM books WHERE id = $1 AND owner_id = $2 AND kind = 'home' AND deleted_at IS NULL`, hb.ID, accountID); n != 1 {
		t.Errorf("the home book row was touched (live rows = %d, want 1)", n)
	}
	if _, err := os.Stat(e.repoPath(hb.ID)); err != nil {
		t.Errorf("the home book repository is gone: %v", err)
	}
	if n := e.countRows(t, `SELECT count(*) FROM invitations WHERE book_id = $1`, hb.ID); n != 0 {
		t.Errorf("invitations on the home book = %d, want 0", n)
	}
	if n := e.countRows(t, `SELECT count(*) FROM books WHERE original_book_id = $1`, hb.ID); n != 0 {
		t.Errorf("forks of the home book = %d, want 0", n)
	}

	// Defence in depth: an invitation onto the home book (which no route mints)
	// is refused on accept as unknown, and makes no membership.
	const raw = "home-book-invitation-token"
	if _, err := e.pool.Exec(context.Background(),
		`INSERT INTO invitations (book_id, token, role) VALUES ($1, $2, 'editor')`, hb.ID, hashToken(raw)); err != nil {
		t.Fatalf("insert invitation: %v", err)
	}
	_, otherCookie := e.registerNewAccount(t)
	resp, body := e.do(t, http.MethodPost, "/api/invitations/"+raw+"/accept", otherCookie, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("accepting an invitation onto a home book: status = %d, want 404; body=%s", resp.StatusCode, body)
	} else if err := e.contract.Validate("acceptInvitation", apicontract.Response, "404", body); err != nil {
		t.Errorf("acceptInvitation 404 does not conform: %v", err)
	}
	if n := e.countRows(t, `SELECT count(*) FROM memberships WHERE book_id = $1`, hb.ID); n != 0 {
		t.Errorf("memberships on the home book = %d, want 0", n)
	}
}

// TestHomeBookAnotherAccountRefused pins the note's "another account refused"
// (DIRECTION §3.3 lines 175-178): account B's info/refs and git-upload-pack on
// A's home book are 404, the same body as an unknown id, and B's own request
// gives B a different home book.
func TestHomeBookAnotherAccountRefused(t *testing.T) {
	e := newGitEnv(t)
	_, aCookie := e.registerNewAccount(t)
	aHome := e.getHomeBook(t, aCookie)
	_, bCookie := e.registerNewAccount(t)

	const unknown = "00000000-0000-4000-8000-000000000000"
	for _, c := range []struct {
		op      string
		method  string
		suffix  string
		headers map[string]string
	}{
		{"gitInfoRefs", http.MethodGet, "/info/refs?service=git-upload-pack", nil},
		{"gitUploadPack", http.MethodPost, "/git-upload-pack", map[string]string{"Content-Type": "application/x-git-upload-pack-request"}},
	} {
		resp, body := e.gitReq(t, c.method, "/git/"+aHome.ID+c.suffix, bCookie, c.headers, nil)
		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("%s by another account: status = %d, want 404", c.op, resp.StatusCode)
			continue
		}
		if err := e.contract.Validate(c.op, apicontract.Response, "404", body); err != nil {
			t.Errorf("%s 404 does not conform: %v", c.op, err)
		}
		_, unknownBody := e.gitReq(t, c.method, "/git/"+unknown+c.suffix, bCookie, c.headers, nil)
		if string(body) != string(unknownBody) {
			t.Errorf("%s: another account's home book body %q differs from an unknown id's %q", c.op, body, unknownBody)
		}
	}

	bHome := e.getHomeBook(t, bCookie)
	if bHome.ID == aHome.ID {
		t.Errorf("account B was given account A's home book %s", aHome.ID)
	}
}

// TestHomeBookPushThroughHook pins the kind reaching the hook from provisioning,
// not from a hand UPDATE (docs/home-book-format.md §8): with the real
// pre-receive hook, the owner pushes a canonical home book (the §2.2 README and
// .gitattributes and a canonical preferences.json) to the provisioned gitUrl and
// it is accepted; a song pushed there is refused.
func TestHomeBookPushThroughHook(t *testing.T) {
	e := newGitEnv(t)
	installRealHook(t, e.hooksDir)
	_, cookie := e.registerNewAccount(t)
	hb := e.getHomeBook(t, cookie)

	// The contract's gitUrl is on the public origin; the test server listens
	// elsewhere, so the same /git/<id> path is reached on it.
	if !strings.HasSuffix(hb.GitURL, "/git/"+hb.ID) {
		t.Fatalf("gitUrl %q does not name /git/%s", hb.GitURL, hb.ID)
	}
	url := e.gitURL(hb.ID)

	work := t.TempDir()
	if out, err := gitc(t, "", cookie, "clone", "-q", url, work); err != nil {
		t.Fatalf("clone the empty home book: %v\n%s", err, out)
	}
	gitIdentity(t, work)
	for name, content := range map[string]string{
		"README.md":        homeBookReadme,
		".gitattributes":   homeBookGitattributes,
		"preferences.json": canonicalHomePrefs,
	} {
		if err := os.WriteFile(filepath.Join(work, name), []byte(content), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}
	gitRun(t, work, "add", ".")
	gitRun(t, work, "commit", "-q", "-m", "home online")
	if out, err := gitc(t, work, cookie, "push", "-q", "origin", "HEAD:refs/heads/main"); err != nil {
		t.Fatalf("a canonical home-book push to the provisioned home book should be accepted: %v\n%s", err, out)
	}
	if got, want := headRev(t, e.repoPath(hb.ID)), strings.TrimSpace(mustOutput(t, work, "rev-parse", "HEAD")); got != want {
		t.Errorf("home book main = %s, want the pushed %s", got, want)
	}

	if err := os.WriteFile(filepath.Join(work, "cancao.cifra.md"), []byte(sampleSongBody), 0o644); err != nil {
		t.Fatalf("write song: %v", err)
	}
	gitRun(t, work, "add", ".")
	gitRun(t, work, "commit", "-q", "-m", "a song in the home book")
	out, err := gitc(t, work, cookie, "push", "-q", "origin", "HEAD:refs/heads/main")
	if err == nil {
		t.Fatalf("a song pushed to the home book should be refused:\n%s", out)
	}
	if !strings.Contains(out, "remote:") || !strings.Contains(out, "song or setlist") {
		t.Errorf("the hook should refuse the song as a home book; got:\n%s", out)
	}
}

// TestHomeBookDeletedWithAccount pins the note's "deleted with the account"
// (workflow 17 lines 160-162): after deleteAccount, the home book's row and its
// repository are gone.
func TestHomeBookDeletedWithAccount(t *testing.T) {
	e := newBooksEnv(t)
	accountID, cookie := e.registerNewAccount(t)
	const email = "home-owner@example.test"
	e.setEmail(t, accountID, email)
	hb := e.getHomeBook(t, cookie)
	if _, err := os.Stat(e.repoPath(hb.ID)); err != nil {
		t.Fatalf("the home book repository was not made: %v", err)
	}

	resp, body := e.do(t, http.MethodDelete, "/api/account", cookie, []byte(`{"confirm":`+mustQuote(email)+`}`))
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("deleteAccount: status = %d, want 204; body=%s", resp.StatusCode, body)
	}
	if n := e.countRows(t, `SELECT count(*) FROM books WHERE id = $1`, hb.ID); n != 0 {
		t.Errorf("home book rows after deleting the account = %d, want 0", n)
	}
	if _, err := os.Stat(e.repoPath(hb.ID)); !os.IsNotExist(err) {
		t.Errorf("home book repository still on disk (err=%v), want removed", err)
	}
}

// TestHomeBookNoSession pins the getHomeBook contract's 401: no session, no home
// book, and nothing provisioned.
func TestHomeBookNoSession(t *testing.T) {
	e := newBooksEnv(t)
	before := e.countRows(t, `SELECT count(*) FROM books WHERE kind = 'home'`)
	resp, body := e.do(t, http.MethodGet, "/api/account/home-book", "", nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("no session: status = %d, want 401; body=%s", resp.StatusCode, body)
	}
	if err := e.contract.Validate("getHomeBook", apicontract.Response, "401", body); err != nil {
		t.Errorf("getHomeBook 401 does not conform: %v", err)
	}
	if after := e.countRows(t, `SELECT count(*) FROM books WHERE kind = 'home'`); after != before {
		t.Errorf("a request with no session provisioned a home book (%d → %d)", before, after)
	}
}

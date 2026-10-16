package server

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	apicontract "estantedecifras.app/api"
	"estantedecifras.app/service/internal/book"
	"estantedecifras.app/service/internal/passkey"
	"estantedecifras.app/service/internal/webauthntest"
)

// These behavior tests drive the real Books handlers through httptest against
// the compose Postgres (ESTANTE_TEST_DATABASE_URL) and a real git on a
// t.TempDir() books root, with the passkey ceremony standing in for a sign-in
// (the only landed path to a session). They pin workflows 7, 11 and 14 and the
// contract (api/openapi.yaml): create a row and a bare repo, list owned/shared/
// forked books with titles read from the README, owner-only delete, fork with
// full history and a single-level original, and the per-account quotas. A
// standalone `go test` with the DSN unset skips (migratedServerSchema → envDSN).
//
// Titles are seeded by pushing a README.md straight into the bare repo with
// local git, since git over HTTP is downstream (service.git_http): the
// title-from-README path is exercised here, not over the wire.

// booksEnv is a passkey env (for creating accounts and sessions) whose server
// also carries the books routes and a throwaway books volume.
type booksEnv struct {
	*passkeyEnv
	booksRoot string
}

func newBooksEnv(t *testing.T) *booksEnv {
	t.Helper()
	return newBooksEnvWith(t, nil)
}

// newBooksEnvWith builds a books env, applying tweak to the APIDeps before the
// handler is wired. newBooksEnv passes nil; the rate-limit behavior tests pass a
// tweak that sets a tiny-window Limiter and TrustedProxies.
func newBooksEnvWith(t *testing.T, tweak func(*APIDeps)) *booksEnv {
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
	var logBuf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logBuf, nil))
	api := &APIDeps{DB: pool, Passkeys: rp, PublicBaseURL: testPkOrigin, BooksRoot: booksRoot, InvitationSecret: []byte(testInvitationSecret)}
	if tweak != nil {
		tweak(api)
	}
	h, err := Handler(logger, newTestAppRoot(t), pool, api)
	if err != nil {
		t.Fatalf("Handler: %v", err)
	}
	ts := httptest.NewServer(h)
	t.Cleanup(ts.Close)

	pe := &passkeyEnv{
		pool:     pool,
		server:   ts,
		auth:     webauthntest.New(testPkOrigin),
		contract: contract,
		logBuf:   &logBuf,
	}
	return &booksEnv{passkeyEnv: pe, booksRoot: booksRoot}
}

// repoPath is the on-disk bare-repo path the handlers derive for a book id.
func (e *booksEnv) repoPath(id string) string {
	return filepath.Join(e.booksRoot, id+".git")
}

func (e *booksEnv) insertAccount(t *testing.T) string {
	t.Helper()
	var id string
	if err := e.pool.QueryRow(context.Background(), `INSERT INTO accounts DEFAULT VALUES RETURNING id`).Scan(&id); err != nil {
		t.Fatalf("insert account: %v", err)
	}
	return id
}

func (e *booksEnv) insertBook(t *testing.T, ownerID string) string {
	t.Helper()
	var id string
	if err := e.pool.QueryRow(context.Background(), `INSERT INTO books (owner_id) VALUES ($1) RETURNING id`, ownerID).Scan(&id); err != nil {
		t.Fatalf("insert book: %v", err)
	}
	return id
}

func (e *booksEnv) insertMembership(t *testing.T, bookID, accountID, role string) {
	t.Helper()
	if _, err := e.pool.Exec(context.Background(),
		`INSERT INTO memberships (book_id, account_id, role) VALUES ($1, $2, $3)`, bookID, accountID, role); err != nil {
		t.Fatalf("insert membership: %v", err)
	}
}

func (e *booksEnv) setSize(t *testing.T, bookID string, size int64) {
	t.Helper()
	if _, err := e.pool.Exec(context.Background(), `UPDATE books SET size_bytes = $2 WHERE id = $1`, bookID, size); err != nil {
		t.Fatalf("set size: %v", err)
	}
}

// createBook POSTs /api/books with the session cookie and returns the decoded
// book, asserting 201 and contract conformance.
func (e *booksEnv) createBook(t *testing.T, cookie, title string) bookJSON {
	t.Helper()
	resp, body := e.do(t, http.MethodPost, "/api/books", cookie, []byte(`{"title":`+mustQuote(title)+`}`))
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create %q: status = %d, want 201; body=%s", title, resp.StatusCode, body)
	}
	if err := e.contract.Validate("createBook", apicontract.Response, "201", body); err != nil {
		t.Errorf("createBook response does not conform: %v", err)
	}
	var b bookJSON
	if err := json.Unmarshal(body, &b); err != nil {
		t.Fatalf("decoding book: %v", err)
	}
	return b
}

func (e *booksEnv) listBooks(t *testing.T, cookie string) bookListJSON {
	t.Helper()
	resp, body := e.do(t, http.MethodGet, "/api/books", cookie, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("list: status = %d, want 200; body=%s", resp.StatusCode, body)
	}
	if err := e.contract.Validate("listBooks", apicontract.Response, "200", body); err != nil {
		t.Errorf("listBooks response does not conform: %v", err)
	}
	var l bookListJSON
	if err := json.Unmarshal(body, &l); err != nil {
		t.Fatalf("decoding book list: %v", err)
	}
	return l
}

func bookByID(list bookListJSON, id string) (bookJSON, bool) {
	for _, b := range list.Books {
		if b.ID == id {
			return b, true
		}
	}
	return bookJSON{}, false
}

// TestCreateBookMakesRowAndRepo pins acceptance #1 (workflow 7 lines 46-48;
// contract createBook): a create inserts a private owned row and an empty bare
// repository, returns 201 with the echoed title and gitUrl; an empty title is
// 400; no session is 401.
func TestCreateBookMakesRowAndRepo(t *testing.T) {
	e := newBooksEnv(t)
	accountID, cookie := e.registerNewAccount(t)

	b := e.createBook(t, cookie, "Choros de Pixinguinha")
	if b.Title != "Choros de Pixinguinha" {
		t.Errorf("title = %q, want the echoed request title", b.Title)
	}
	if b.Role != "owner" {
		t.Errorf("role = %q, want owner", b.Role)
	}
	if b.Visibility != "private" {
		t.Errorf("visibility = %q, want private", b.Visibility)
	}
	if want := testPkOrigin + "/git/" + b.ID; b.GitURL != want {
		t.Errorf("gitUrl = %q, want %q", b.GitURL, want)
	}
	if b.Original != nil {
		t.Errorf("original = %+v, want nil for a first-party book", b.Original)
	}

	if n := e.countRows(t, `SELECT count(*) FROM books WHERE id = $1 AND owner_id = $2 AND visibility = 'private' AND deleted_at IS NULL`, b.ID, accountID); n != 1 {
		t.Errorf("owned private rows for the new book = %d, want 1", n)
	}
	if info, err := os.Stat(e.repoPath(b.ID)); err != nil || !info.IsDir() {
		t.Errorf("bare repo dir %s: stat err=%v isDir=%v, want a directory", e.repoPath(b.ID), err, info != nil && info.IsDir())
	}
	if _, err := os.Stat(filepath.Join(e.repoPath(b.ID), "HEAD")); err != nil {
		t.Errorf("bare repo HEAD: %v, want it to exist (git init --bare)", err)
	}

	// Empty title -> 400.
	if resp, _ := e.do(t, http.MethodPost, "/api/books", cookie, []byte(`{"title":""}`)); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("create with empty title: status = %d, want 400", resp.StatusCode)
	}
	// No session -> 401.
	if resp, _ := e.do(t, http.MethodPost, "/api/books", "", []byte(`{"title":"No Session"}`)); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("create with no session: status = %d, want 401", resp.StatusCode)
	}
}

// TestListBooksReturnsOwnedSharedAndForks pins acceptance #2 (DIRECTION §2.1;
// contract listBooks): the list carries owned, shared and forked books with
// their roles and titles read from the README, a fork's single-level original,
// and the placeholder for a book with no commit.
func TestListBooksReturnsOwnedSharedAndForks(t *testing.T) {
	e := newBooksEnv(t)
	ownerID, ownerCookie := e.registerNewAccount(t)

	owned := e.createBook(t, ownerCookie, "Owned Choros")
	seedREADME(t, e.repoPath(owned.ID), "Owned Choros")

	// A book owned by a second account, shared with the first via a membership
	// (no sharing API yet — service.sharing is downstream).
	_, otherCookie := e.registerNewAccount(t)
	shared := e.createBook(t, otherCookie, "Shared Songs")
	seedREADME(t, e.repoPath(shared.ID), "Shared Songs")
	e.insertMembership(t, shared.ID, ownerID, "reader")

	// A fork of the owned book (copies its repo, so its README carries over).
	fork := e.forkBook(t, ownerCookie, owned.ID)

	// An empty book with no commit yet -> placeholder title.
	empty := e.createBook(t, ownerCookie, "This Shelf-Local Title Is Not In Git Yet")

	list := e.listBooks(t, ownerCookie)

	if b, ok := bookByID(list, owned.ID); !ok || b.Role != "owner" || b.Title != "Owned Choros" {
		t.Errorf("owned book in list = %+v (ok=%v), want role owner title %q", b, ok, "Owned Choros")
	}
	if b, ok := bookByID(list, shared.ID); !ok || b.Role != "reader" || b.Title != "Shared Songs" {
		t.Errorf("shared book in list = %+v (ok=%v), want role reader title %q", b, ok, "Shared Songs")
	}
	if b, ok := bookByID(list, fork.ID); !ok {
		t.Errorf("fork missing from list")
	} else {
		if b.Role != "owner" {
			t.Errorf("fork role = %q, want owner", b.Role)
		}
		if b.Original == nil || b.Original.BookID != owned.ID {
			t.Errorf("fork original = %+v, want bookId %q", b.Original, owned.ID)
		} else if b.Original.Title == nil || *b.Original.Title != "Owned Choros" {
			t.Errorf("fork original title = %v, want %q", b.Original.Title, "Owned Choros")
		}
	}
	if b, ok := bookByID(list, empty.ID); !ok || b.Title != book.PlaceholderTitle {
		t.Errorf("empty book title = %q (ok=%v), want placeholder %q", b.Title, ok, book.PlaceholderTitle)
	}

	// No session -> 401.
	if resp, _ := e.do(t, http.MethodGet, "/api/books", "", nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("list with no session: status = %d, want 401", resp.StatusCode)
	}
}

// TestListBooksOwnerName pins books.owner_name AC1 (workflow 10 §Leaving a
// book, §Who sees whom; DIRECTION §3.3): an editor and a reader of a book whose
// owner set an authorName in their home book see it as ownerName; the owner's
// own listing carries none; a book whose owner has no home book, or a home book
// with no name, lists without the field and the list is still 200. Every
// response is validated against the contract by the listBooks helper.
func TestListBooksOwnerName(t *testing.T) {
	e := newBooksEnv(t)
	_, anaCookie := e.registerNewAccount(t)
	e.seedHomeBookName(t, anaCookie,
		`{"authorName":{"value":"Ana Lima","at":"2026-10-05T14:29:12.500Z"}}`+"\n")
	named := e.createBook(t, anaCookie, "Choros da Ana")
	seedREADME(t, e.repoPath(named.ID), "Choros da Ana")
	named2 := e.createBook(t, anaCookie, "Valsas da Ana")

	// A second owner with no home book at all, and a third whose home book holds
	// no name.
	_, noHomeCookie := e.registerNewAccount(t)
	noHome := e.createBook(t, noHomeCookie, "Sem Casa")
	_, noNameCookie := e.registerNewAccount(t)
	e.seedHomeBookName(t, noNameCookie,
		`{"theme":{"value":"palco","at":"2026-10-05T14:29:12.500Z"}}`+"\n")
	noName := e.createBook(t, noNameCookie, "Sem Nome")

	editorID, editorCookie := e.registerNewAccount(t)
	readerID, readerCookie := e.registerNewAccount(t)
	e.insertMembership(t, named.ID, editorID, "editor")
	e.insertMembership(t, named2.ID, editorID, "reader")
	e.insertMembership(t, named.ID, readerID, "reader")
	e.insertMembership(t, noHome.ID, readerID, "reader")
	e.insertMembership(t, noName.ID, readerID, "editor")

	editorList := e.listBooks(t, editorCookie)
	for _, id := range []string{named.ID, named2.ID} {
		if b, ok := bookByID(editorList, id); !ok || b.OwnerName != "Ana Lima" {
			t.Errorf("editor's listing of %s: ownerName = %q (ok=%v), want %q", id, b.OwnerName, ok, "Ana Lima")
		}
	}

	readerList := e.listBooks(t, readerCookie)
	if b, ok := bookByID(readerList, named.ID); !ok || b.OwnerName != "Ana Lima" {
		t.Errorf("reader's listing: ownerName = %q (ok=%v), want %q", b.OwnerName, ok, "Ana Lima")
	}
	if b, ok := bookByID(readerList, noHome.ID); !ok || b.OwnerName != "" {
		t.Errorf("owner with no home book: ownerName = %q (ok=%v), want absent", b.OwnerName, ok)
	}
	if b, ok := bookByID(readerList, noName.ID); !ok || b.OwnerName != "" {
		t.Errorf("owner with no name: ownerName = %q (ok=%v), want absent", b.OwnerName, ok)
	}

	// The owner's own listing never carries the field — on the wire, not just
	// decoded empty.
	resp, body := e.do(t, http.MethodGet, "/api/books", anaCookie, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("owner list: status = %d, want 200", resp.StatusCode)
	}
	if bytes.Contains(body, []byte("ownerName")) {
		t.Errorf("owner's own listing carries ownerName: %s", body)
	}
	if b, ok := bookByID(e.listBooks(t, anaCookie), named.ID); !ok || b.OwnerName != "" {
		t.Errorf("owner's listing: ownerName = %q (ok=%v), want absent", b.OwnerName, ok)
	}

	// The name is user-chosen text: it never reaches the logs.
	if strings.Contains(e.logBuf.String(), "Ana Lima") {
		t.Errorf("the owner's name appears in the service log")
	}
}

// TestDeleteBook pins acceptance #3 (workflow 7 lines 136-137; DIRECTION §3.6
// lines 337-340; contract deleteBook): the owner's delete sets deleted_at,
// removes the directory and drops the book from a later list; a non-owner
// member is 403, a non-member 404, and no session 401.
func TestDeleteBook(t *testing.T) {
	e := newBooksEnv(t)
	_, ownerCookie := e.registerNewAccount(t)
	b := e.createBook(t, ownerCookie, "To Be Deleted")

	// A second account: first a non-member (404), then a member (403).
	memberID, memberCookie := e.registerNewAccount(t)
	if resp, _ := e.do(t, http.MethodDelete, "/api/books/"+b.ID, memberCookie, nil); resp.StatusCode != http.StatusNotFound {
		t.Errorf("non-member delete: status = %d, want 404", resp.StatusCode)
	}
	e.insertMembership(t, b.ID, memberID, "editor")
	if resp, _ := e.do(t, http.MethodDelete, "/api/books/"+b.ID, memberCookie, nil); resp.StatusCode != http.StatusForbidden {
		t.Errorf("non-owner member delete: status = %d, want 403", resp.StatusCode)
	}

	// No session -> 401.
	if resp, _ := e.do(t, http.MethodDelete, "/api/books/"+b.ID, "", nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("delete with no session: status = %d, want 401", resp.StatusCode)
	}

	// Owner delete -> 204.
	resp, _ := e.do(t, http.MethodDelete, "/api/books/"+b.ID, ownerCookie, nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("owner delete: status = %d, want 204", resp.StatusCode)
	}
	if n := e.countRows(t, `SELECT count(*) FROM books WHERE id = $1 AND deleted_at IS NOT NULL`, b.ID); n != 1 {
		t.Errorf("deleted_at set rows = %d, want 1", n)
	}
	if _, err := os.Stat(e.repoPath(b.ID)); !os.IsNotExist(err) {
		t.Errorf("bare repo dir after delete: stat err=%v, want not-exist", err)
	}
	if _, ok := bookByID(e.listBooks(t, ownerCookie), b.ID); ok {
		t.Errorf("deleted book still present in list")
	}
}

// TestForkBook pins acceptance #4 (workflow 11 lines 18-39, 51-54; contract
// forkBook): a fork of a seeded source copies the full history and size_bytes,
// sets original_book_id, survives the source's deletion, a fork of a fork points
// at its immediate parent, and a non-member fork is 404.
func TestForkBook(t *testing.T) {
	e := newBooksEnv(t)
	_, ownerCookie := e.registerNewAccount(t)

	src := e.createBook(t, ownerCookie, "Source")
	seedREADME(t, e.repoPath(src.ID), "Source Book")
	e.setSize(t, src.ID, 4096)
	srcHead := headRev(t, e.repoPath(src.ID))

	// A non-member fork of the source is 404 (never confirming a private book).
	_, strangerCookie := e.registerNewAccount(t)
	if resp, _ := e.do(t, http.MethodPost, "/api/books/"+src.ID+"/fork", strangerCookie, nil); resp.StatusCode != http.StatusNotFound {
		t.Errorf("non-member fork: status = %d, want 404", resp.StatusCode)
	}

	f1 := e.forkBook(t, ownerCookie, src.ID)
	if f1.Role != "owner" || f1.Title != "Source Book" {
		t.Errorf("fork = role %q title %q, want owner / %q", f1.Role, f1.Title, "Source Book")
	}
	if f1.Original == nil || f1.Original.BookID != src.ID {
		t.Fatalf("fork original = %+v, want bookId %q", f1.Original, src.ID)
	}
	if f1.Original.Title == nil || *f1.Original.Title != "Source Book" {
		t.Errorf("fork original title = %v, want %q", f1.Original.Title, "Source Book")
	}
	if got := headRev(t, e.repoPath(f1.ID)); got != srcHead {
		t.Errorf("fork head = %q, want the source's %q (full history copied)", got, srcHead)
	}
	if n := e.countRows(t, `SELECT count(*) FROM books WHERE id = $1 AND original_book_id = $2 AND size_bytes = 4096`, f1.ID, src.ID); n != 1 {
		t.Errorf("fork row with original_book_id and copied size_bytes = %d, want 1", n)
	}

	// A fork of the fork points at its immediate parent, not the first original.
	f2 := e.forkBook(t, ownerCookie, f1.ID)
	if f2.Original == nil || f2.Original.BookID != f1.ID {
		t.Errorf("fork-of-fork original = %+v, want bookId %q (immediate parent)", f2.Original, f1.ID)
	}

	// Delete the source: the fork is untouched and keeps its whole history.
	if resp, _ := e.do(t, http.MethodDelete, "/api/books/"+src.ID, ownerCookie, nil); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete source: status = %d, want 204", resp.StatusCode)
	}
	if got := headRev(t, e.repoPath(f1.ID)); got != srcHead {
		t.Errorf("fork head after source delete = %q, want %q (independent copy)", got, srcHead)
	}
	// The fork still lists, its original's bookId retained but its title omitted
	// now that the source is gone.
	if b, ok := bookByID(e.listBooks(t, ownerCookie), f1.ID); !ok {
		t.Errorf("fork missing after source delete")
	} else if b.Original == nil || b.Original.BookID != src.ID {
		t.Errorf("fork original after source delete = %+v, want retained bookId %q", b.Original, src.ID)
	} else if b.Original.Title != nil {
		t.Errorf("fork original title after source delete = %v, want omitted", *b.Original.Title)
	}
}

// TestBookQuotas pins acceptance #1/#4 quota refusals (workflow 14 lines 39-48;
// contract TooLarge): the 101st create is 413, and a fork that would carry the
// owner past 200 MB is 413.
func TestBookQuotas(t *testing.T) {
	e := newBooksEnv(t)
	accountID, cookie := e.registerNewAccount(t)

	// 100 owned books already; the 101st create is refused.
	if _, err := e.pool.Exec(context.Background(),
		`INSERT INTO books (owner_id) SELECT $1::uuid FROM generate_series(1, 100)`, accountID); err != nil {
		t.Fatalf("seeding 100 books: %v", err)
	}
	if resp, body := e.do(t, http.MethodPost, "/api/books", cookie, []byte(`{"title":"One Too Many"}`)); resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Errorf("101st create: status = %d, want 413; body=%s", resp.StatusCode, body)
	}

	// A fork that would carry the caller past 200 MB is refused. The caller owns
	// 199 MB; the source (2 MB, owned by another account and shared) would push
	// the total to 201 MB.
	forkerID, forkerCookie := e.registerNewAccount(t)
	big := e.insertBook(t, forkerID)
	e.setSize(t, big, 199*1024*1024)

	sourceOwner := e.insertAccount(t)
	source := e.insertBook(t, sourceOwner)
	e.setSize(t, source, 2*1024*1024)
	e.insertMembership(t, source, forkerID, "editor")

	if resp, body := e.do(t, http.MethodPost, "/api/books/"+source+"/fork", forkerCookie, nil); resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Errorf("over-200MB fork: status = %d, want 413; body=%s", resp.StatusCode, body)
	}
}

// forkBook POSTs a fork and returns the decoded book, asserting 201 and
// contract conformance.
func (e *booksEnv) forkBook(t *testing.T, cookie, srcID string) bookJSON {
	t.Helper()
	resp, body := e.do(t, http.MethodPost, "/api/books/"+srcID+"/fork", cookie, nil)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("fork %s: status = %d, want 201; body=%s", srcID, resp.StatusCode, body)
	}
	if err := e.contract.Validate("forkBook", apicontract.Response, "201", body); err != nil {
		t.Errorf("forkBook response does not conform: %v", err)
	}
	var b bookJSON
	if err := json.Unmarshal(body, &b); err != nil {
		t.Fatalf("decoding fork: %v", err)
	}
	return b
}

// seedREADME pushes a README.md with the given title as its level-1 heading
// straight into the bare repo with local git — the stand-in for the app's first
// push while git over HTTP is downstream (service.git_http).
func seedREADME(t *testing.T, barePath, title string) {
	t.Helper()
	work := t.TempDir()
	gitRun(t, work, "init", "-q", "-b", "main")
	gitRun(t, work, "config", "user.email", "seed@estante.test")
	gitRun(t, work, "config", "user.name", "Seed Author")
	gitRun(t, work, "config", "commit.gpgsign", "false")
	if err := os.WriteFile(filepath.Join(work, "README.md"), []byte("# "+title+"\n"), 0o644); err != nil {
		t.Fatalf("write README: %v", err)
	}
	gitRun(t, work, "add", "README.md")
	gitRun(t, work, "commit", "-q", "-m", "seed")
	gitRun(t, work, "push", "-q", barePath, "main:refs/heads/main")
}

// seedHomeBookName provisions the account's home book (getHomeBook) and pushes
// a first commit with a preferences.json holding prefs, straight into the bare
// repo with the git CLI (books.owner_name: the owner's authorName,
// docs/home-book-format.md §4.1).
func (e *booksEnv) seedHomeBookName(t *testing.T, cookie, prefs string) {
	t.Helper()
	hb := e.getHomeBook(t, cookie)
	work := t.TempDir()
	gitRun(t, work, "init", "-q", "-b", "main")
	gitRun(t, work, "config", "user.email", "seed@estante.test")
	gitRun(t, work, "config", "user.name", "Seed Author")
	gitRun(t, work, "config", "commit.gpgsign", "false")
	if err := os.WriteFile(filepath.Join(work, "preferences.json"), []byte(prefs), 0o644); err != nil {
		t.Fatalf("write preferences.json: %v", err)
	}
	gitRun(t, work, "add", "preferences.json")
	gitRun(t, work, "commit", "-q", "-m", "seed home book")
	gitRun(t, work, "push", "-q", e.repoPath(hb.ID), "main:refs/heads/main")
}

func headRev(t *testing.T, barePath string) string {
	t.Helper()
	cmd := exec.Command("git", "--git-dir", barePath, "rev-parse", "refs/heads/main")
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0")
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("rev-parse %s: %v", barePath, err)
	}
	return strings.TrimSpace(string(out))
}

func gitRun(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %s: %v: %s", strings.Join(args, " "), err, out)
	}
}

func mustQuote(s string) string {
	b, err := json.Marshal(s)
	if err != nil {
		panic(err)
	}
	return string(b)
}

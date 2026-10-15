package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	apicontract "estantedecifras.app/api"
)

// These behavior tests drive the real change-check handler through httptest
// against the compose Postgres (ESTANTE_TEST_DATABASE_URL) and real git on a
// t.TempDir() books root, built on newBooksEnv (the passkey ceremony mints the
// sessions). They pin workflow 8 (§When it runs L21-24, §Losing access L64-69),
// DIRECTION §3.3 (L175-178, L194-196) and the changeCheck contract
// (api/openapi.yaml): a shelf of moved and unmoved books answered with the ones
// with news, a first-push (device head null) book, a book the caller lost
// access to (gone), the never-confirm guarantee, and the request/auth edges.
// Every 200 response is validated against api/openapi.yaml via apicontract.
// A standalone `go test` with the DSN unset skips (migratedServerSchema).

// changeCheck POSTs /api/shelf/change-check with the session cookie and returns
// the raw response plus, for a 200, the decoded body validated against the
// contract.
func (e *booksEnv) changeCheck(t *testing.T, cookie string, body []byte) (*http.Response, changeCheckResponse) {
	t.Helper()
	resp, raw := e.do(t, http.MethodPost, "/api/shelf/change-check", cookie, body)
	var out changeCheckResponse
	if resp.StatusCode == http.StatusOK {
		if err := e.contract.Validate("changeCheck", apicontract.Response, "200", raw); err != nil {
			t.Errorf("changeCheck response does not conform: %v", err)
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			t.Fatalf("decoding change-check: %v", err)
		}
	}
	return resp, out
}

func changeByID(out changeCheckResponse, id string) (shelfBookChange, bool) {
	for _, b := range out.Books {
		if b.BookID == id {
			return b, true
		}
	}
	return shelfBookChange{}, false
}

// ccBody builds a ChangeCheckRequest body from per-book entries; headEntry and
// nullHeadEntry make the two kinds of book.
func ccBody(t *testing.T, books ...map[string]any) []byte {
	t.Helper()
	if books == nil {
		books = []map[string]any{}
	}
	return mustJSON(t, map[string]any{"books": books})
}

func headEntry(id, sha string) map[string]any { return map[string]any{"bookId": id, "head": sha} }
func nullHeadEntry(id string) map[string]any  { return map[string]any{"bookId": id, "head": nil} }

// advanceBook clones the bare repo, lands one more commit on main and pushes it,
// moving the book's head — the "a book moved past the device's head" precondition.
func advanceBook(t *testing.T, barePath string) {
	t.Helper()
	parent := t.TempDir()
	clone := filepath.Join(parent, "wc")
	gitRun(t, parent, "clone", "-q", barePath, clone)
	gitRun(t, clone, "config", "user.email", "seed@estante.test")
	gitRun(t, clone, "config", "user.name", "Seed Author")
	gitRun(t, clone, "config", "commit.gpgsign", "false")
	if err := os.WriteFile(filepath.Join(clone, "mais.cifra.md"), []byte("# Mais uma\n"), 0o644); err != nil {
		t.Fatalf("write song: %v", err)
	}
	gitRun(t, clone, "add", "mais.cifra.md")
	gitRun(t, clone, "commit", "-q", "-m", "advance")
	gitRun(t, clone, "push", "-q", "origin", "main")
}

// TestChangeCheckMovedAndUnmoved pins the note's "a shelf with moved and unmoved
// books answered with one ref read each", workflow 8 §When it runs (L21-24),
// DIRECTION §3.3 (L194-196) and the changeCheck contract: a book pushed past the
// device's head comes back changed with the new head; a book at the device's
// head is omitted. Each accessible book is read once — structurally, one
// ResolveHead per unique accessible id (service.change_check Constraint 2).
func TestChangeCheckMovedAndUnmoved(t *testing.T) {
	e := newBooksEnv(t)
	_, cookie := e.registerNewAccount(t)

	moved := e.createBook(t, cookie, "Moved Book")
	seedREADME(t, e.repoPath(moved.ID), "Moved Book")
	movedHead0 := headRev(t, e.repoPath(moved.ID))

	still := e.createBook(t, cookie, "Still Book")
	seedREADME(t, e.repoPath(still.ID), "Still Book")
	stillHead := headRev(t, e.repoPath(still.ID))

	// The moved book gets one more commit after the device recorded movedHead0.
	advanceBook(t, e.repoPath(moved.ID))
	movedHead1 := headRev(t, e.repoPath(moved.ID))
	if movedHead1 == movedHead0 {
		t.Fatalf("advanceBook did not move the head")
	}

	_, out := e.changeCheck(t, cookie, ccBody(t,
		headEntry(moved.ID, movedHead0),
		headEntry(still.ID, stillHead),
	))

	if c, ok := changeByID(out, moved.ID); !ok {
		t.Errorf("moved book missing from the change check, want changed")
	} else {
		if c.Status != "changed" {
			t.Errorf("moved book status = %q, want changed", c.Status)
		}
		if c.Head == nil || *c.Head != movedHead1 {
			t.Errorf("moved book head = %v, want the new head %q", c.Head, movedHead1)
		}
	}
	if _, ok := changeByID(out, still.ID); ok {
		t.Errorf("unmoved book present in the change check, want omitted")
	}
}

// TestChangeCheckFirstPush pins ShelfBookHead.head null semantics (contract
// L1068-1072): a book first pushed since the device cloned it — the device holds
// head null, the book now has a main — comes back changed with the new head. An
// empty book (no main yet) the device holds null for is omitted (nothing to
// report — Constraint 4).
func TestChangeCheckFirstPush(t *testing.T) {
	e := newBooksEnv(t)
	_, cookie := e.registerNewAccount(t)

	pushed := e.createBook(t, cookie, "First Pushed")
	seedREADME(t, e.repoPath(pushed.ID), "First Pushed")
	pushedHead := headRev(t, e.repoPath(pushed.ID))

	// An empty book with no commit yet: the device holds null, nothing to report.
	empty := e.createBook(t, cookie, "Still Empty")

	_, out := e.changeCheck(t, cookie, ccBody(t,
		nullHeadEntry(pushed.ID),
		nullHeadEntry(empty.ID),
	))

	if c, ok := changeByID(out, pushed.ID); !ok {
		t.Errorf("first-pushed book missing, want changed")
	} else if c.Status != "changed" || c.Head == nil || *c.Head != pushedHead {
		t.Errorf("first-pushed book = %+v (head %v), want changed with %q", c, c.Head, pushedHead)
	}
	if _, ok := changeByID(out, empty.ID); ok {
		t.Errorf("empty book with null head present, want omitted")
	}
}

// TestChangeCheckLostAccess pins the note's "a book the user lost access to",
// workflow 8 §Losing access (L64-69) and ShelfBookChange gone (contract
// L1092-1094): a book whose membership row was deleted, a soft-deleted book, and
// a taken-down book — each one the device still holds a head for — all come back
// gone, carrying no head.
func TestChangeCheckLostAccess(t *testing.T) {
	e := newBooksEnv(t)
	_, ownerCookie := e.registerNewAccount(t)

	// A book shared with a member, then the membership is removed.
	shared := e.createBook(t, ownerCookie, "Shared Then Removed")
	seedREADME(t, e.repoPath(shared.ID), "Shared Then Removed")
	sharedHead := headRev(t, e.repoPath(shared.ID))
	memberID, memberCookie := e.registerNewAccount(t)
	e.insertMembership(t, shared.ID, memberID, "reader")
	if _, err := e.pool.Exec(context.Background(),
		`DELETE FROM memberships WHERE book_id = $1 AND account_id = $2`, shared.ID, memberID); err != nil {
		t.Fatalf("remove membership: %v", err)
	}
	_, out := e.changeCheck(t, memberCookie, ccBody(t, headEntry(shared.ID, sharedHead)))
	if c, ok := changeByID(out, shared.ID); !ok || c.Status != "gone" || c.Head != nil {
		t.Errorf("removed-member book = %+v (ok=%v), want gone with no head", c, ok)
	}

	// The owner's own book, soft-deleted: inaccessible even to the owner.
	deleted := e.createBook(t, ownerCookie, "Soft Deleted")
	seedREADME(t, e.repoPath(deleted.ID), "Soft Deleted")
	deletedHead := headRev(t, e.repoPath(deleted.ID))
	if _, err := e.pool.Exec(context.Background(),
		`UPDATE books SET deleted_at = now() WHERE id = $1`, deleted.ID); err != nil {
		t.Fatalf("soft-delete book: %v", err)
	}

	// A taken-down book the owner holds.
	takenDown := e.createBook(t, ownerCookie, "Taken Down")
	seedREADME(t, e.repoPath(takenDown.ID), "Taken Down")
	takenDownHead := headRev(t, e.repoPath(takenDown.ID))
	if _, err := e.pool.Exec(context.Background(),
		`UPDATE books SET taken_down_reason = 'dmca' WHERE id = $1`, takenDown.ID); err != nil {
		t.Fatalf("take down book: %v", err)
	}

	_, out = e.changeCheck(t, ownerCookie, ccBody(t,
		headEntry(deleted.ID, deletedHead),
		headEntry(takenDown.ID, takenDownHead),
	))
	if c, ok := changeByID(out, deleted.ID); !ok || c.Status != "gone" || c.Head != nil {
		t.Errorf("soft-deleted book = %+v (ok=%v), want gone with no head", c, ok)
	}
	if c, ok := changeByID(out, takenDown.ID); !ok || c.Status != "gone" || c.Head != nil {
		t.Errorf("taken-down book = %+v (ok=%v), want gone with no head", c, ok)
	}
}

// TestChangeCheckNeverConfirm pins the contract's "never confirms a private book
// exists" (L385-387) and DIRECTION §3.3 (L175-178): a live book the caller is not
// a member of, and a random unknown id, are answered identically — both omitted
// with a null head, both gone with a non-null head. The gone/omit choice follows
// the caller's own supplied head, not server state, so a real private book and a
// nonexistent id are indistinguishable (service.change_check Decision).
func TestChangeCheckNeverConfirm(t *testing.T) {
	e := newBooksEnv(t)
	_, ownerCookie := e.registerNewAccount(t)

	// A live private book owned by someone else; the caller is not a member.
	private := e.createBook(t, ownerCookie, "Private Book")
	seedREADME(t, e.repoPath(private.ID), "Private Book")

	_, strangerCookie := e.registerNewAccount(t)
	unknownID := "11111111-1111-1111-1111-111111111111"
	someHead := strings.Repeat("a", 40)

	// Null head: both omitted and indistinguishable.
	_, out := e.changeCheck(t, strangerCookie, ccBody(t,
		nullHeadEntry(private.ID),
		nullHeadEntry(unknownID),
	))
	if _, ok := changeByID(out, private.ID); ok {
		t.Errorf("private book with null head present, want omitted (never confirmed)")
	}
	if _, ok := changeByID(out, unknownID); ok {
		t.Errorf("unknown id with null head present, want omitted")
	}

	// Non-null head: both gone and indistinguishable.
	_, out = e.changeCheck(t, strangerCookie, ccBody(t,
		headEntry(private.ID, someHead),
		headEntry(unknownID, someHead),
	))
	priv, privOK := changeByID(out, private.ID)
	unk, unkOK := changeByID(out, unknownID)
	if !privOK || !unkOK {
		t.Fatalf("private=%v unknown=%v present, want both gone", privOK, unkOK)
	}
	if priv.Status != "gone" || priv.Head != nil {
		t.Errorf("private book with head = %+v, want gone with no head", priv)
	}
	if unk.Status != "gone" || unk.Head != nil {
		t.Errorf("unknown id with head = %+v, want gone with no head", unk)
	}
	// Indistinguishable: the two entries carry the same shape.
	if priv.Status != unk.Status {
		t.Errorf("private (%q) and unknown (%q) distinguishable, want identical", priv.Status, unk.Status)
	}
}

// TestChangeCheckRequestAndAuthEdges pins the changeCheck responses (contract
// L394-404) and ChangeCheckRequest (L1074-1083): no session is 401; a malformed
// body, an unknown field, an over-500 list and a head that is not a GitSha are
// 400; an empty books array answers {books: []}.
func TestChangeCheckRequestAndAuthEdges(t *testing.T) {
	e := newBooksEnv(t)
	_, cookie := e.registerNewAccount(t)
	validID := "11111111-1111-1111-1111-111111111111"

	// No session -> 401.
	if resp, _ := e.do(t, http.MethodPost, "/api/shelf/change-check", "", ccBody(t)); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("no session: status = %d, want 401", resp.StatusCode)
	}

	// Not an object / not JSON -> 400.
	if resp, _ := e.do(t, http.MethodPost, "/api/shelf/change-check", cookie, []byte("not json")); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("malformed body: status = %d, want 400", resp.StatusCode)
	}
	// An unknown field (additionalProperties: false) -> 400.
	if resp, _ := e.do(t, http.MethodPost, "/api/shelf/change-check", cookie, []byte(`{"books":[],"extra":1}`)); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("unknown field: status = %d, want 400", resp.StatusCode)
	}
	// A per-book unknown field -> 400.
	if resp, _ := e.do(t, http.MethodPost, "/api/shelf/change-check", cookie,
		[]byte(`{"books":[{"bookId":"`+validID+`","head":null,"junk":1}]}`)); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("per-book unknown field: status = %d, want 400", resp.StatusCode)
	}
	// A head that is not a GitSha -> 400.
	if resp, _ := e.do(t, http.MethodPost, "/api/shelf/change-check", cookie,
		[]byte(`{"books":[{"bookId":"`+validID+`","head":"not-a-sha"}]}`)); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("bad head: status = %d, want 400", resp.StatusCode)
	}
	// More than 500 books -> 400.
	over := make([]map[string]any, 501)
	for i := range over {
		over[i] = nullHeadEntry(validID)
	}
	if resp, _ := e.do(t, http.MethodPost, "/api/shelf/change-check", cookie, ccBody(t, over...)); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("over-500 list: status = %d, want 400", resp.StatusCode)
	}

	// An empty books array is valid -> {books: []}.
	resp, out := e.changeCheck(t, cookie, ccBody(t))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("empty books: status = %d, want 200", resp.StatusCode)
	}
	if len(out.Books) != 0 {
		t.Errorf("empty books answer = %+v, want no books", out.Books)
	}
}

// saveOn lands one save (a non-merge commit adding the named song) on a bare
// repository's main — a member saving and pushing.
func saveOn(t *testing.T, barePath, song string) {
	t.Helper()
	parent := t.TempDir()
	clone := filepath.Join(parent, "wc")
	gitRun(t, parent, "clone", "-q", barePath, clone)
	gitRun(t, clone, "config", "user.email", "seed@estante.test")
	gitRun(t, clone, "config", "user.name", "Seed Author")
	gitRun(t, clone, "config", "commit.gpgsign", "false")
	if err := os.WriteFile(filepath.Join(clone, song), []byte("# "+song+"\n"), 0o644); err != nil {
		t.Fatalf("write song: %v", err)
	}
	gitRun(t, clone, "add", song)
	gitRun(t, clone, "commit", "-q", "-m", "save "+song)
	gitRun(t, clone, "push", "-q", "origin", "main")
}

// bringInto merges the original's main into the fork's main with a merge commit
// and pushes it — what a bring-in does (workflow 11 lines 47-48).
func bringInto(t *testing.T, originalBare, forkBare string) {
	t.Helper()
	parent := t.TempDir()
	clone := filepath.Join(parent, "wc")
	gitRun(t, parent, "clone", "-q", forkBare, clone)
	gitRun(t, clone, "config", "user.email", "seed@estante.test")
	gitRun(t, clone, "config", "user.name", "Seed Author")
	gitRun(t, clone, "config", "commit.gpgsign", "false")
	gitRun(t, clone, "fetch", "-q", originalBare, "main:refs/remotes/original/main")
	gitRun(t, clone, "merge", "-q", "--no-ff", "-m", "Bring in", "refs/remotes/original/main")
	gitRun(t, clone, "push", "-q", "origin", "main")
}

// forkSetup makes Ana's book with a first commit, shares it with Bia as reader
// and has Bia fork it over HTTP (workflow 11 §Making a copy).
func forkSetup(t *testing.T, e *booksEnv) (anaCookie, original, biaID, biaCookie, fork string) {
	t.Helper()
	_, anaCookie = e.registerNewAccount(t)
	src := e.createBook(t, anaCookie, "Choros de Teste")
	seedREADME(t, e.repoPath(src.ID), "Choros de Teste")
	biaID, biaCookie = e.registerNewAccount(t)
	e.insertMembership(t, src.ID, biaID, "reader")
	f := e.forkBook(t, biaCookie, src.ID)
	return anaCookie, src.ID, biaID, biaCookie, f.ID
}

func (e *booksEnv) exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := e.pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
}

// TestChangeCheckForkOriginalNewSaves pins workflow 11 lines 46-48 and
// sync.fork_follow AC1: a fork in step with an original that advanced two saves
// answers {status: unchanged, originalNewSaves: 2}; the fork having moved too
// answers changed with its head and the count; once the fork's main includes
// them the fork is omitted.
func TestChangeCheckForkOriginalNewSaves(t *testing.T) {
	e := newBooksEnv(t)
	_, original, _, biaCookie, fork := forkSetup(t, e)
	forkHead := headRev(t, e.repoPath(fork))

	// In step, nothing new on the original: omitted.
	_, out := e.changeCheck(t, biaCookie, ccBody(t, headEntry(fork, forkHead)))
	if c, ok := changeByID(out, fork); ok {
		t.Errorf("fresh fork = %+v, want omitted", c)
	}

	saveOn(t, e.repoPath(original), "carinhoso.cifra.md")
	saveOn(t, e.repoPath(original), "lamentos.cifra.md")
	_, out = e.changeCheck(t, biaCookie, ccBody(t, headEntry(fork, forkHead)))
	c, ok := changeByID(out, fork)
	if !ok || c.Status != "unchanged" || c.Head != nil || c.OriginalNewSaves != 2 || c.OriginalGone {
		t.Errorf("original two saves ahead = %+v (ok=%v), want unchanged, no head, originalNewSaves 2", c, ok)
	}

	// The fork itself moves too: changed with its new head, and still the count.
	saveOn(t, e.repoPath(fork), "minha.cifra.md")
	forkHead1 := headRev(t, e.repoPath(fork))
	_, out = e.changeCheck(t, biaCookie, ccBody(t, headEntry(fork, forkHead)))
	c, ok = changeByID(out, fork)
	if !ok || c.Status != "changed" || c.Head == nil || *c.Head != forkHead1 || c.OriginalNewSaves != 2 {
		t.Errorf("fork and original both moved = %+v (ok=%v), want changed at %q with originalNewSaves 2", c, ok, forkHead1)
	}

	// Brought in: the fork's main includes them, so nothing more to report.
	bringInto(t, e.repoPath(original), e.repoPath(fork))
	forkHead2 := headRev(t, e.repoPath(fork))
	_, out = e.changeCheck(t, biaCookie, ccBody(t, headEntry(fork, forkHead2)))
	if c, ok := changeByID(out, fork); ok {
		t.Errorf("after the bring-in = %+v, want omitted", c)
	}
}

// TestChangeCheckForkOriginalGone pins workflow 11 lines 51-54 and Constraint 4:
// the caller removed from the original, the original soft-deleted, taken down,
// and its row gone (original_book_id nulled, as its owner's account deletion
// does) each answer originalGone: true — alike — while the fork itself is not
// gone.
func TestChangeCheckForkOriginalGone(t *testing.T) {
	e := newBooksEnv(t)
	_, original, biaID, biaCookie, fork := forkSetup(t, e)
	forkHead := headRev(t, e.repoPath(fork))

	wantGone := func(cause string) {
		t.Helper()
		_, out := e.changeCheck(t, biaCookie, ccBody(t, headEntry(fork, forkHead)))
		c, ok := changeByID(out, fork)
		if !ok || c.Status != "unchanged" || !c.OriginalGone || c.OriginalNewSaves != 0 || c.Head != nil {
			t.Errorf("%s: fork = %+v (ok=%v), want unchanged with originalGone and no count", cause, c, ok)
		}
	}

	// The original advanced, so a count would show were it not gone.
	saveOn(t, e.repoPath(original), "carinhoso.cifra.md")

	e.exec(t, `DELETE FROM memberships WHERE book_id = $1 AND account_id = $2`, original, biaID)
	wantGone("removed from the original")
	e.insertMembership(t, original, biaID, "reader")

	e.exec(t, `UPDATE books SET deleted_at = now() WHERE id = $1`, original)
	wantGone("original deleted")
	e.exec(t, `UPDATE books SET deleted_at = NULL WHERE id = $1`, original)

	e.exec(t, `UPDATE books SET taken_down_reason = 'dmca' WHERE id = $1`, original)
	wantGone("original taken down")
	e.exec(t, `UPDATE books SET taken_down_reason = NULL WHERE id = $1`, original)

	// Sanity: restored, the fork counts again.
	_, out := e.changeCheck(t, biaCookie, ccBody(t, headEntry(fork, forkHead)))
	if c, ok := changeByID(out, fork); !ok || c.OriginalNewSaves != 1 || c.OriginalGone {
		t.Errorf("restored original = %+v (ok=%v), want originalNewSaves 1", c, ok)
	}

	e.exec(t, `UPDATE books SET original_book_id = NULL WHERE id = $1`, fork)
	wantGone("original's row gone")
}

// TestChangeCheckForkOfForkOneStep pins workflow 11 lines 37-38: a fork of a
// fork follows one step only — it reports its own original's saves, never its
// grand-original's.
func TestChangeCheckForkOfForkOneStep(t *testing.T) {
	e := newBooksEnv(t)
	_, grand, _, biaCookie, middle := forkSetup(t, e)
	middleHead := headRev(t, e.repoPath(middle))
	carlaID, carlaCookie := e.registerNewAccount(t)
	e.insertMembership(t, middle, carlaID, "reader")
	leaf := e.forkBook(t, carlaCookie, middle).ID
	leafHead := headRev(t, e.repoPath(leaf))

	// The grand-original advances two saves; the middle fork does not.
	saveOn(t, e.repoPath(grand), "carinhoso.cifra.md")
	saveOn(t, e.repoPath(grand), "lamentos.cifra.md")

	_, out := e.changeCheck(t, carlaCookie, ccBody(t, headEntry(leaf, leafHead)))
	if c, ok := changeByID(out, leaf); ok {
		t.Errorf("fork of a fork whose original did not move = %+v, want omitted (one step only)", c)
	}
	_, out = e.changeCheck(t, biaCookie, ccBody(t, headEntry(middle, middleHead)))
	if c, ok := changeByID(out, middle); !ok || c.OriginalNewSaves != 2 {
		t.Errorf("middle fork = %+v (ok=%v), want originalNewSaves 2", c, ok)
	}

	// Its own original saves once: that, and only that, is counted.
	saveOn(t, e.repoPath(middle), "minha.cifra.md")
	_, out = e.changeCheck(t, carlaCookie, ccBody(t, headEntry(leaf, leafHead)))
	if c, ok := changeByID(out, leaf); !ok || c.Status != "unchanged" || c.OriginalNewSaves != 1 {
		t.Errorf("fork of a fork = %+v (ok=%v), want unchanged with originalNewSaves 1", c, ok)
	}
}

// TestChangeCheckNotAFork pins Constraint 4: a plain book never carries a fork
// field, and a fork the caller cannot access is answered exactly as any book —
// gone, with no fork field — even when its original advanced or went away.
func TestChangeCheckNotAFork(t *testing.T) {
	e := newBooksEnv(t)
	anaCookie, original, _, biaCookie, fork := forkSetup(t, e)

	plain := e.createBook(t, anaCookie, "Plain Book")
	seedREADME(t, e.repoPath(plain.ID), "Plain Book")
	plainHead := headRev(t, e.repoPath(plain.ID))
	saveOn(t, e.repoPath(plain.ID), "carinhoso.cifra.md")
	resp, raw := e.do(t, http.MethodPost, "/api/shelf/change-check", anaCookie,
		ccBody(t, headEntry(plain.ID, plainHead), headEntry(original, headRev(t, e.repoPath(original)))))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("change check: status = %d", resp.StatusCode)
	}
	if strings.Contains(string(raw), "originalNewSaves") || strings.Contains(string(raw), "originalGone") {
		t.Errorf("plain books carry a fork field: %s", raw)
	}

	// Carla was a member of Bia's fork and is removed; the original advances.
	carlaID, carlaCookie := e.registerNewAccount(t)
	e.insertMembership(t, fork, carlaID, "reader")
	forkHead := headRev(t, e.repoPath(fork))
	e.exec(t, `DELETE FROM memberships WHERE book_id = $1 AND account_id = $2`, fork, carlaID)
	saveOn(t, e.repoPath(original), "lamentos.cifra.md")
	_, out := e.changeCheck(t, carlaCookie, ccBody(t, headEntry(fork, forkHead)))
	if c, ok := changeByID(out, fork); !ok || c.Status != "gone" || c.OriginalNewSaves != 0 || c.OriginalGone {
		t.Errorf("inaccessible fork = %+v (ok=%v), want gone with no fork field", c, ok)
	}

	// The fork itself deleted by Bia, its original also gone: still just gone.
	e.exec(t, `UPDATE books SET deleted_at = now() WHERE id = $1`, original)
	e.exec(t, `UPDATE books SET deleted_at = now() WHERE id = $1`, fork)
	_, out = e.changeCheck(t, biaCookie, ccBody(t, headEntry(fork, forkHead)))
	if c, ok := changeByID(out, fork); !ok || c.Status != "gone" || c.OriginalNewSaves != 0 || c.OriginalGone {
		t.Errorf("deleted fork = %+v (ok=%v), want gone with no fork field", c, ok)
	}
}

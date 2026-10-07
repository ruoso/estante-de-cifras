package server

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"estantedecifras.app/service/internal/book"
	"estantedecifras.app/service/internal/session"
)

// This file implements the Books API (api/openapi.yaml /api/books and
// /api/books/{bookId}[/fork]; workflows 7, 11, 14): the registry-and-volume
// operations behind a book's life. Each handler opens with the inline
// session.Resolve gate (no book without an account — DIRECTION §3.3); a book
// the caller neither owns nor is a member of is 404, never 403, so a private
// book is not confirmed to a stranger (api/openapi.yaml NotFound). The title
// lives in git, not Postgres (DIRECTION §2.1): listBooks reads it from each
// book's README, createBook echoes the requested title. The registry row and
// the bare repository move together — create and fork write both with rollback
// on a half-failure, delete retires both (service.books Constraints).

// Per-account quotas, code constants rather than schema (workflow 14 lines
// 39-48; service.books Constraints). Forks count against the caller like any
// book. The per-file and per-book checks and the push-time enforcement are the
// hook's (service.git_http), not this task's.
const (
	maxBooksPerAccount       = 100
	maxBytesPerAccount int64 = 200 * 1024 * 1024 // 200 MB, history included
	maxTitleRunes            = 200
)

// originalJSON is a fork's single-level original (api/openapi.yaml Original).
// Title is "the original's title as the fork last knew it" — derived live from
// the original's README and omitted when the original is gone or inaccessible
// (service.books Decision).
type originalJSON struct {
	BookID string  `json:"bookId"`
	Title  *string `json:"title,omitempty"`
}

// bookJSON is one book in the Books API (api/openapi.yaml Book). Original is
// present (non-null) only when the book is a fork, so it is omitted for a
// first-party book.
type bookJSON struct {
	ID         string        `json:"id"`
	Title      string        `json:"title"`
	Role       string        `json:"role"`
	Visibility string        `json:"visibility"`
	GitURL     string        `json:"gitUrl"`
	Original   *originalJSON `json:"original,omitempty"`
}

type bookListJSON struct {
	Books []bookJSON `json:"books"`
}

// gitURL is a book's git remote URL — <PublicBaseURL>/git/<id> — the address a
// device clones and pushes once git over HTTP exists (service.git_http). It is
// the service's URL, not the app-facing …/b/{book} link (api/openapi.yaml Book).
func gitURL(base, id string) string {
	return strings.TrimRight(base, "/") + "/git/" + id
}

// handleCreateBook implements POST /api/books (createBook, workflow 7): insert a
// private books row owned by the caller and create an empty bare repository,
// returning the book with its echoed title and git URL. The row and the
// repository are written in one logical operation — git init runs inside the
// open transaction, and a filesystem failure rolls the row back and removes any
// partial directory, so there is never a row without a repository or the
// reverse (service.books Constraints).
func handleCreateBook(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not create the book.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		var req struct {
			Title string `json:"title"`
		}
		if err := decodeStrict(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}
		if strings.TrimSpace(req.Title) == "" {
			writeError(w, http.StatusBadRequest, "bad_request", "A book needs a title.")
			return
		}
		if utf8.RuneCountInString(req.Title) > maxTitleRunes {
			writeError(w, http.StatusBadRequest, "bad_request", "That title is too long.")
			return
		}

		store := book.Store{Root: api.BooksRoot}

		tx, err := api.DB.Begin(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not create the book.")
			return
		}
		defer tx.Rollback(ctx)

		count, _, err := ownedUsage(ctx, tx, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not create the book.")
			return
		}
		if count >= maxBooksPerAccount {
			writeError(w, http.StatusRequestEntityTooLarge, "too_large", "You have reached the limit of 100 books.")
			return
		}

		var id string
		if err := tx.QueryRow(ctx, `INSERT INTO books (owner_id) VALUES ($1) RETURNING id`, accountID).Scan(&id); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not create the book.")
			return
		}

		// The volume step inside the open transaction: on failure the row is
		// rolled back (deferred) and the partial directory removed, so the
		// registry and the volume stay consistent.
		if err := store.InitBare(ctx, id); err != nil {
			_ = store.Remove(id)
			writeError(w, http.StatusInternalServerError, "internal", "Could not create the book.")
			return
		}
		if err := tx.Commit(ctx); err != nil {
			_ = store.Remove(id)
			writeError(w, http.StatusInternalServerError, "internal", "Could not create the book.")
			return
		}

		writeJSON(w, http.StatusCreated, bookJSON{
			ID:         id,
			Title:      req.Title, // echoed: the repository is empty at this instant
			Role:       "owner",
			Visibility: "private",
			GitURL:     gitURL(api.PublicBaseURL, id),
		})
	}
}

// handleListBooks implements GET /api/books (listBooks): the caller's owned
// books (forks included), and the books shared with it through memberships,
// each with its role, its git URL and a title read from its README. A fork
// carries its single-level original (api/openapi.yaml BookList; DIRECTION §2.1).
func handleListBooks(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list the books.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		// Owned books carry role 'owner'; shared books carry the membership
		// role. The owner is never a membership row (schema), so the CASE never
		// collides. Deleted books are omitted.
		rows, err := api.DB.Query(ctx, `
			SELECT b.id, b.original_book_id,
			       CASE WHEN b.owner_id = $1 THEN 'owner' ELSE m.role::text END AS role
			FROM books b
			LEFT JOIN memberships m ON m.book_id = b.id AND m.account_id = $1
			WHERE b.deleted_at IS NULL AND (b.owner_id = $1 OR m.account_id = $1)
			ORDER BY b.created_at`, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list the books.")
			return
		}
		defer rows.Close()

		store := book.Store{Root: api.BooksRoot}
		list := bookListJSON{Books: []bookJSON{}}
		for rows.Next() {
			var id, role string
			var originalID *string
			if err := rows.Scan(&id, &originalID, &role); err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not list the books.")
				return
			}
			// One git read per book for the title (≤100 books; the same order of
			// cost as the change check's one ref per book — service.books
			// Decision). A book with no commit or no heading falls back to the
			// placeholder so the required field is non-empty.
			title, found := store.ReadTitle(ctx, id)
			if !found {
				title = book.PlaceholderTitle
			}
			bj := bookJSON{
				ID:         id,
				Title:      title,
				Role:       role,
				Visibility: "private",
				GitURL:     gitURL(api.PublicBaseURL, id),
			}
			if originalID != nil {
				bj.Original = &originalJSON{BookID: *originalID}
				if ot, ok := store.ReadTitle(ctx, *originalID); ok {
					bj.Original.Title = &ot
				}
			}
			list.Books = append(list.Books, bj)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list the books.")
			return
		}

		writeJSON(w, http.StatusOK, list)
	}
}

// handleDeleteBook implements DELETE /api/books/{bookId} (deleteBook, workflow
// 7): owner-only. It soft-deletes the row (deleted_at, which alone suffices to
// refuse all future access and free quota — DIRECTION §3.6 lines 337-340) and
// then removes the bare repository to reclaim disk. A member who is not the
// owner is 403; a non-member or unknown id is 404 (never confirming a private
// book to a stranger).
func handleDeleteBook(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not delete the book.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		bookID := r.PathValue("bookId")
		if !isUUID(bookID) {
			writeError(w, http.StatusNotFound, "not_found", "No such book.")
			return
		}

		var ownerID string
		err = api.DB.QueryRow(ctx, `SELECT owner_id FROM books WHERE id = $1 AND deleted_at IS NULL`, bookID).Scan(&ownerID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not_found", "No such book.")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not delete the book.")
			return
		}
		if ownerID != accountID {
			// A member who is not the owner lacks the role for this action (403);
			// a non-member is told the book does not exist (404).
			member, err := isMember(ctx, api.DB, bookID, accountID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not delete the book.")
				return
			}
			if member {
				writeError(w, http.StatusForbidden, "forbidden", "Only the book's owner can delete it.")
				return
			}
			writeError(w, http.StatusNotFound, "not_found", "No such book.")
			return
		}

		tag, err := api.DB.Exec(ctx, `UPDATE books SET deleted_at = now() WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, bookID, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not delete the book.")
			return
		}
		if tag.RowsAffected() == 0 {
			// Lost a race with a concurrent delete; the book is already gone.
			writeError(w, http.StatusNotFound, "not_found", "No such book.")
			return
		}

		// deleted_at is now authoritative — the book is refused everywhere and
		// counts against no quota — so the directory removal is best-effort: a
		// failure leaves an orphaned directory, not an accessible book.
		store := book.Store{Root: api.BooksRoot}
		_ = store.Remove(bookID)

		w.WriteHeader(http.StatusNoContent)
	}
}

// handleForkBook implements POST /api/books/{bookId}/fork (forkBook, workflow
// 11): any member of the source may fork it. It copies the repository with all
// its history to a new id on the volume, inserts a books row owned by the caller
// with original_book_id set and size_bytes copied from the source, and returns
// the fork with its original. The quota is checked before git starts; the clone
// runs inside the open transaction with rollback and directory removal on a
// half-failure (service.books Constraints).
func handleForkBook(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not fork the book.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		srcID := r.PathValue("bookId")
		if !isUUID(srcID) {
			writeError(w, http.StatusNotFound, "not_found", "No such book.")
			return
		}

		var srcOwner string
		var srcSize int64
		err = api.DB.QueryRow(ctx, `SELECT owner_id, size_bytes FROM books WHERE id = $1 AND deleted_at IS NULL`, srcID).Scan(&srcOwner, &srcSize)
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not_found", "No such book.")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not fork the book.")
			return
		}
		if srcOwner != accountID {
			// Any member may fork a book they can open; a non-member is told the
			// book does not exist (never confirming a private book to a stranger).
			member, err := isMember(ctx, api.DB, srcID, accountID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not fork the book.")
				return
			}
			if !member {
				writeError(w, http.StatusNotFound, "not_found", "No such book.")
				return
			}
		}

		store := book.Store{Root: api.BooksRoot}

		tx, err := api.DB.Begin(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not fork the book.")
			return
		}
		defer tx.Rollback(ctx)

		// Quota counts the caller's own live books and bytes, plus the source's
		// size the fork would carry; refused before git starts (workflow 14).
		count, sum, err := ownedUsage(ctx, tx, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not fork the book.")
			return
		}
		if count+1 > maxBooksPerAccount {
			writeError(w, http.StatusRequestEntityTooLarge, "too_large", "You have reached the limit of 100 books.")
			return
		}
		if sum+srcSize > maxBytesPerAccount {
			writeError(w, http.StatusRequestEntityTooLarge, "too_large", "This fork would put you over your 200 MB limit.")
			return
		}

		var newID string
		if err := tx.QueryRow(ctx,
			`INSERT INTO books (owner_id, original_book_id, size_bytes) VALUES ($1, $2, $3) RETURNING id`,
			accountID, srcID, srcSize).Scan(&newID); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not fork the book.")
			return
		}

		if err := store.Fork(ctx, srcID, newID); err != nil {
			_ = store.Remove(newID)
			writeError(w, http.StatusInternalServerError, "internal", "Could not fork the book.")
			return
		}
		if err := tx.Commit(ctx); err != nil {
			_ = store.Remove(newID)
			writeError(w, http.StatusInternalServerError, "internal", "Could not fork the book.")
			return
		}

		// The fork's own title is read from its freshly copied repository; the
		// original's title is derived live from the source, omitted if the source
		// is gone or inaccessible.
		title, found := store.ReadTitle(ctx, newID)
		if !found {
			title = book.PlaceholderTitle
		}
		original := &originalJSON{BookID: srcID}
		if ot, ok := store.ReadTitle(ctx, srcID); ok {
			original.Title = &ot
		}

		writeJSON(w, http.StatusCreated, bookJSON{
			ID:         newID,
			Title:      title,
			Role:       "owner",
			Visibility: "private",
			GitURL:     gitURL(api.PublicBaseURL, newID),
			Original:   original,
		})
	}
}

// querier is the subset of the pool/transaction surface the book helpers need,
// so they work equally against api.DB and an open transaction.
type querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// ownedUsage returns the count and total size_bytes of the account's live
// (non-deleted) owned books — the quota inputs for create and fork (workflow 14;
// deleted books count against no quota, DIRECTION §3.6).
func ownedUsage(ctx context.Context, q querier, accountID string) (count int, sum int64, err error) {
	err = q.QueryRow(ctx,
		`SELECT count(*), COALESCE(sum(size_bytes), 0) FROM books WHERE owner_id = $1 AND deleted_at IS NULL`,
		accountID).Scan(&count, &sum)
	return count, sum, err
}

// isMember reports whether the account has a membership row on the book (editor
// or reader). The owner is never a membership row (schema), so a caller who is
// the owner is handled by the owner check before this is reached.
func isMember(ctx context.Context, q querier, bookID, accountID string) (bool, error) {
	var one int
	err := q.QueryRow(ctx, `SELECT 1 FROM memberships WHERE book_id = $1 AND account_id = $2`, bookID, accountID).Scan(&one)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

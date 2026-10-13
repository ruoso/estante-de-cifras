package server

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"

	"estantedecifras.app/service/internal/book"
	"estantedecifras.app/service/internal/session"
)

// handleDeleteAccount deletes the signed-in account everywhere (account.leaving,
// workflow 17). It is the one write the app makes that waits for a connection; on
// its 204 the device forgets the account (the Worker teardown, main-thread side).
//
// The confirmation is the account's own email, typed by the user and sent in the
// body (Decision 4): the server compares it to the stored email and never echoes
// the address (the EmailLinkRequest precedent; DIRECTION §3.3 metadata-only).
//
// The cascade is the schema's own `ON DELETE CASCADE` (Decision 1): a single
// `DELETE FROM accounts WHERE id = $1` removes the account's sessions, passkeys,
// memberships, email-login-links and book-notices, and the books it owns — which
// in turn cascade their own memberships, invitations, joins and notices. A fork of
// a deleted book survives with `original_book_id` nulled (`ON DELETE SET NULL`).
// The only non-SQL work is reclaiming the owned books' bare repositories from
// disk, so the owned book ids are collected inside the transaction before the
// delete and `book.Store.Remove` is called best-effort on each after it commits
// (idempotent `os.RemoveAll`, exactly as handleDeleteBook treats it — Decision 2:
// a failed removal orphans a repo no DB row points to, so git-over-HTTP 404s it
// anyway; it is a GC concern, never an access leak). The handler logs nothing
// itself — LogRequests records method/path/status only.
func handleDeleteAccount(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not delete the account.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		var req struct {
			Confirm string `json:"confirm"`
		}
		if err := decodeStrict(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "Could not read the request.")
			return
		}

		// The account's email is the thing only its owner knows (account_screen
		// Decision 5: no endpoint returns it). Compare here; a NULL email (a
		// passkey-only account with nothing to type-match) can never match, so
		// the confirm fails closed rather than erroring — graceful degradation
		// (refinement Open questions). The address is never put in the response.
		var email *string
		switch err := api.DB.QueryRow(ctx, `SELECT email FROM accounts WHERE id = $1`, accountID).Scan(&email); {
		case errors.Is(err, pgx.ErrNoRows):
			// The session resolved but the row is gone (a concurrent delete):
			// nothing to delete, and no address to reveal.
			writeError(w, http.StatusBadRequest, "confirm_mismatch", "That is not the email on this account.")
			return
		case err != nil:
			writeError(w, http.StatusInternalServerError, "internal", "Could not delete the account.")
			return
		}
		if email == nil || !strings.EqualFold(strings.TrimSpace(req.Confirm), strings.TrimSpace(*email)) {
			writeError(w, http.StatusBadRequest, "confirm_mismatch", "That is not the email on this account.")
			return
		}

		// Collect the owned books' ids, then delete the account — atomically, so
		// the id list matches exactly the repositories the cascade removed.
		tx, err := api.DB.Begin(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not delete the account.")
			return
		}
		defer tx.Rollback(ctx)

		rows, err := tx.Query(ctx, `SELECT id FROM books WHERE owner_id = $1`, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not delete the account.")
			return
		}
		var ownedBookIDs []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				writeError(w, http.StatusInternalServerError, "internal", "Could not delete the account.")
				return
			}
			ownedBookIDs = append(ownedBookIDs, id)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not delete the account.")
			return
		}

		if _, err := tx.Exec(ctx, `DELETE FROM accounts WHERE id = $1`, accountID); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not delete the account.")
			return
		}
		if err := tx.Commit(ctx); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not delete the account.")
			return
		}

		// The DB is authoritative now; reclaim each owned book's bare repository
		// best-effort (Decision 2). RemoveAll is idempotent, so an already-removed
		// (soft-deleted) book's missing directory is not an error.
		store := book.Store{Root: api.BooksRoot}
		for _, id := range ownedBookIDs {
			_ = store.Remove(id)
		}

		session.ClearCookie(w)
		w.WriteHeader(http.StatusNoContent)
	}
}

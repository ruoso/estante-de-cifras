package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/jackc/pgx/v5"

	"estantedecifras.app/service/internal/book"
	"estantedecifras.app/service/internal/passkey"
	"estantedecifras.app/service/internal/session"
)

// handleDeleteAccount deletes the signed-in account everywhere (account.leaving,
// workflow 17). It is the one write the app makes that waits for a connection; on
// its 204 the device forgets the account (the Worker teardown, main-thread side).
//
// The confirmation is one of two (service.recovery_email; workflow 17 §An
// account with no email). For an account with a confirmed email it is that
// email, typed by the user and sent in the body (Decision 4): the server
// compares it to the stored email and never echoes the address (the
// EmailLinkRequest precedent; DIRECTION §3.3 metadata-only). For an account
// without one it is a fresh passkey assertion answering the challenge of
// handleBeginDeleteAccountPasskey, its state sealed for deletion and good for
// passkey.StateTTL, validated against the session's own account.
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
			Confirm *string            `json:"confirm"`
			Passkey *deletePasskeyBody `json:"passkey"`
		}
		if err := decodeStrict(r, &req); err != nil || (req.Confirm == nil) == (req.Passkey == nil) {
			writeError(w, http.StatusBadRequest, "bad_request", "Could not read the request.")
			return
		}

		// The account's confirmed email decides which confirmation it gives
		// (workflow 17 §An account with no email): with one, the typed email; with
		// none — a pending, unconfirmed address does not count — a fresh passkey
		// assertion. Neither is accepted for the other kind of account. The
		// address is never put in the response.
		var email *string
		switch err := api.DB.QueryRow(ctx, `SELECT email FROM accounts WHERE id = $1`, accountID).Scan(&email); {
		case errors.Is(err, pgx.ErrNoRows):
			// The session resolved but the row is gone (a concurrent delete):
			// nothing to delete, and no address to reveal.
			writeConfirmMismatch(w)
			return
		case err != nil:
			writeError(w, http.StatusInternalServerError, "internal", "Could not delete the account.")
			return
		}
		if req.Confirm != nil {
			// The account's email is the thing only its owner knows. A NULL email
			// (a passkey-only account) can never match, so the typed confirm fails
			// closed rather than erroring.
			if email == nil || !strings.EqualFold(strings.TrimSpace(*req.Confirm), strings.TrimSpace(*email)) {
				writeConfirmMismatch(w)
				return
			}
		} else {
			if email != nil {
				writeConfirmMismatch(w)
				return
			}
			if !api.passkeyConfirmsDeletion(r, accountID, req.Passkey) {
				writeError(w, http.StatusBadRequest, "passkey_refused", "That passkey did not confirm the deletion.")
				return
			}
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

// deletePasskeyBody is DeleteAccountPasskey (api/openapi.yaml): the deletion
// begin's state and the WebAuthn assertion answering its challenge.
type deletePasskeyBody struct {
	State      string          `json:"state"`
	Credential json.RawMessage `json:"credential"`
}

// writeConfirmMismatch writes the 400 for a confirmation that is not this
// account's: a wrong typed email, a typed email on an account with none, or a
// passkey confirm on an account that has one. It names no address.
func writeConfirmMismatch(w http.ResponseWriter) {
	writeError(w, http.StatusBadRequest, "confirm_mismatch", "That is not the email on this account.")
}

// passkeyConfirmsDeletion reports whether body is a valid passkey confirm of
// deleting accountID: a state sealed for deletion and still within
// passkey.StateTTL, answered by one of this account's own passkeys with a good
// signature. A state begun for sign-in or registration, a stale one, a
// credential not on the account, or a bad signature is false. go-webauthn's
// ValidateLogin checks the state's user handle against the account and the
// asserted credential against the account's credentials.
func (api *APIDeps) passkeyConfirmsDeletion(r *http.Request, accountID string, body *deletePasskeyBody) bool {
	if api.Passkeys == nil || body.State == "" || len(body.Credential) == 0 {
		return false
	}
	sessionData, err := api.Passkeys.OpenFor(passkey.PurposeDeleteAccount, body.State, time.Now())
	if err != nil {
		return false
	}
	parsed, err := protocol.ParseCredentialRequestResponseBytes(body.Credential)
	if err != nil {
		return false
	}
	email, rows, err := api.loadAccountAndPasskeys(r.Context(), accountID)
	if err != nil {
		return false
	}
	user, err := passkey.UserFor(accountID, email, rows)
	if err != nil {
		return false
	}
	_, err = api.Passkeys.WebAuthn().ValidateLogin(user, *sessionData, parsed)
	return err == nil
}

// handleBeginDeleteAccountPasskey implements POST /api/account/delete/begin
// (beginDeleteAccountPasskey): for a signed-in account with no confirmed
// email, a non-discoverable assertion request listing the account's own
// passkeys (allowCredentials, so the browser offers only them — refinement
// Decision *The passkey confirm rides in the DELETE body*), its state sealed
// for deletion. 200, 401 without a session, 400 confirm_by_email for an
// account that confirms by typing its email.
func handleBeginDeleteAccountPasskey(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not begin the passkey confirm.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		var confirmed *string
		if err := api.DB.QueryRow(ctx, `SELECT email FROM accounts WHERE id = $1`, accountID).Scan(&confirmed); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not begin the passkey confirm.")
			return
		}
		if confirmed != nil {
			writeError(w, http.StatusBadRequest, "confirm_by_email", "This account confirms its deletion by its email.")
			return
		}

		email, rows, err := api.loadAccountAndPasskeys(ctx, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not begin the passkey confirm.")
			return
		}
		user, err := passkey.UserFor(accountID, email, rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not begin the passkey confirm.")
			return
		}
		assertion, sessionData, err := api.Passkeys.WebAuthn().BeginLogin(user)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "Could not begin the passkey confirm.")
			return
		}
		state, err := api.Passkeys.SealFor(passkey.PurposeDeleteAccount, sessionData, time.Now())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not begin the passkey confirm.")
			return
		}
		writeJSON(w, http.StatusOK, credentialBeginResponse{PublicKey: assertion.Response, State: state})
	}
}

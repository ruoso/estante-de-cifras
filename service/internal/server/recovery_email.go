package server

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"estantedecifras.app/service/internal/emaillink"
	"estantedecifras.app/service/internal/ratelimit"
	"estantedecifras.app/service/internal/recoveryemail"
	"estantedecifras.app/service/internal/session"
)

// The recovery email (workflow 13 §The recovery email; api/openapi.yaml
// getRecoveryEmail, requestRecoveryEmail, confirmRecoveryEmail). A signed-in
// owner reads their confirmed and pending address and asks for a verification
// link; whoever holds the link confirms it, which writes accounts.email then
// and only then (verify, then write). The token is the emailed sign-in link's
// own format (emaillink, ESTANTE_LINK_SECRET, fifteen minutes) and its row
// lives in recovery_email_links, a table a sign-in redeem never reads, so a
// verification link can never sign anyone in.
//
// The address is never logged and never put in an error body; only its owner
// reads it back. The token is never logged: the confirm carries it in the body,
// and the app page it is mailed to (/recovery-email/<token>) has the segment
// redacted by LogRequests.

// recoveryEmailJSON is the RecoveryEmail body (api/openapi.yaml).
type recoveryEmailJSON struct {
	Email   *string `json:"email"`
	Pending *string `json:"pending"`
}

// handleGetRecoveryEmail implements GET /api/account/recovery-email: the
// account's confirmed address and the address of its latest unconsumed
// verification link — expired or not, so the app keeps saying *waiting for you
// to confirm* with **send again** (refinement Decision). 200 or 401.
func handleGetRecoveryEmail(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not read the recovery email.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		var out recoveryEmailJSON
		if err := api.DB.QueryRow(ctx, `SELECT email FROM accounts WHERE id = $1`, accountID).Scan(&out.Email); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not read the recovery email.")
			return
		}
		var pending string
		switch err := api.DB.QueryRow(ctx,
			`SELECT address FROM recovery_email_links
			 WHERE account_id = $1 AND consumed_at IS NULL
			 ORDER BY created_at DESC LIMIT 1`, accountID).Scan(&pending); {
		case errors.Is(err, pgx.ErrNoRows):
		case err != nil:
			writeError(w, http.StatusInternalServerError, "internal", "Could not read the recovery email.")
			return
		default:
			out.Pending = &pending
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// handleRequestRecoveryEmail implements POST /api/account/recovery-email: mint
// a verification link for the address and mail it. It answers 202 for every
// well-formed address — free, held by another account, or the account's own —
// so it never reveals who holds an address; only the confirm may say so
// (Constraint 2). accounts.email is not touched (Constraint 1). The new link
// replaces the account's earlier unconsumed ones. 400 malformed, 401, 429.
func handleRequestRecoveryEmail(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not send the verification link.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		var body struct {
			Email string `json:"email"`
		}
		if err := decodeStrict(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}
		address, err := recoveryemail.Normalize(body.Email)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}

		// Per account and per address (DIRECTION §3.3), atomically; the 429 comes
		// before anything about who holds the address is read, so it is as
		// account-oblivious as the 202, and it mails nothing (Constraint 10).
		if !rateAllowAll(w, api.Limiter,
			ratelimit.Key{Rule: ratelimit.RecoveryEmailAccount, Key: accountID},
			ratelimit.Key{Rule: ratelimit.RecoveryEmailAddr, Key: address},
		) {
			return
		}

		id, err := emaillink.NewID()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not send the verification link.")
			return
		}
		tx, err := api.DB.Begin(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not send the verification link.")
			return
		}
		defer tx.Rollback(ctx)
		// A new request replaces the old: the earlier unconsumed links stop
		// working, so only the latest mail confirms (refinement acceptance).
		if _, err := tx.Exec(ctx,
			`DELETE FROM recovery_email_links WHERE account_id = $1 AND consumed_at IS NULL`, accountID); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not send the verification link.")
			return
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO recovery_email_links (id, account_id, address, expires_at) VALUES ($1, $2, $3, $4)`,
			id, accountID, address, time.Now().Add(emaillink.LinkLifetime)); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not send the verification link.")
			return
		}
		if err := tx.Commit(ctx); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not send the verification link.")
			return
		}

		link := strings.TrimRight(api.PublicBaseURL, "/") + "/recovery-email/" + emaillink.Mint(id, api.LinkSecret)
		if api.Mailer == nil || api.Mailer.SendRecoveryEmailLink(ctx, address, link) != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not send the verification link.")
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}
}

// handleConfirmRecoveryEmail implements POST /api/recovery-email/confirm: open
// a verification link. It needs no session, sets no cookie and starts none
// (Constraint 3), and answers nothing about the account: 204 on success, one
// 400 link_invalid for a tampered, unknown, expired or used token, 409
// address_taken when another account holds the address. Refusals count against
// the per-IP sign-in failure cap, checked first, as a refused redeem does.
//
// The decision and the write are one transaction: the link row and its account
// are locked, recoveryemail.Decide rules, and on a confirm the row is consumed
// and accounts.email written together; Taken rolls back, leaving the link as it
// was. After the commit a confirmed change mails the old address its link-less
// notice, best effort — a failed send is logged as metadata only and does not
// fail the 204.
func handleConfirmRecoveryEmail(api *APIDeps, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r, api.TrustedProxies)
		if !rateCheck(w, api.Limiter, ratelimit.SignIn, ip) {
			return
		}
		invalid := func() {
			rateRecordFailure(api.Limiter, ratelimit.SignIn, ip)
			writeError(w, http.StatusBadRequest, "link_invalid", "That link is not valid. It may have expired or been used.")
		}
		const failed = "Could not confirm the recovery email."

		var body struct {
			Token string `json:"token"`
		}
		if err := decodeStrict(r, &body); err != nil || body.Token == "" {
			invalid()
			return
		}
		id, ok := emaillink.Parse(body.Token, api.LinkSecret)
		if !ok {
			invalid()
			return
		}

		ctx := r.Context()
		tx, err := api.DB.Begin(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", failed)
			return
		}
		defer tx.Rollback(ctx)

		var (
			row       recoveryemail.Row
			accountID string
			current   *string
		)
		err = tx.QueryRow(ctx,
			`SELECT l.address, l.expires_at, l.consumed_at, l.account_id, a.email
			 FROM recovery_email_links l JOIN accounts a ON a.id = l.account_id
			 WHERE l.id = $1
			 FOR UPDATE`, id).Scan(&row.Address, &row.ExpiresAt, &row.ConsumedAt, &accountID, &current)
		if errors.Is(err, pgx.ErrNoRows) {
			invalid()
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", failed)
			return
		}

		var heldByOther bool
		if err := tx.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM accounts WHERE lower(email) = $1 AND id <> $2)`,
			row.Address, accountID).Scan(&heldByOther); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", failed)
			return
		}

		currentEmail := ""
		if current != nil {
			currentEmail = *current
		}
		outcome := recoveryemail.Decide(row, time.Now(), heldByOther, currentEmail)
		switch outcome {
		case recoveryemail.Expired, recoveryemail.Consumed:
			invalid()
			return
		case recoveryemail.Taken:
			rateRecordFailure(api.Limiter, ratelimit.SignIn, ip)
			writeAddressTaken(w)
			return
		}

		if _, err := tx.Exec(ctx, `UPDATE recovery_email_links SET consumed_at = now() WHERE id = $1`, id); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", failed)
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE accounts SET email = $1 WHERE id = $2`, row.Address, accountID); err != nil {
			// The UNIQUE constraint is the backstop for a concurrent confirm of
			// the same address by another account (Constraint 5).
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
				rateRecordFailure(api.Limiter, ratelimit.SignIn, ip)
				writeAddressTaken(w)
				return
			}
			writeError(w, http.StatusInternalServerError, "internal", failed)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", failed)
			return
		}

		if outcome == recoveryemail.ConfirmChange && api.Mailer != nil {
			if err := api.Mailer.SendRecoveryEmailChanged(ctx, currentEmail); err != nil {
				// Metadata only: neither address nor the transport's error text,
				// which may quote an address back.
				logger.LogAttrs(ctx, slog.LevelWarn, "recovery email change notice not sent")
			}
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// writeAddressTaken writes the 409 for an address another account holds. The
// body names no address (Error never carries one).
func writeAddressTaken(w http.ResponseWriter) {
	writeError(w, http.StatusConflict, "address_taken", "That address is already the recovery email of another account.")
}

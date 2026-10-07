package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"estantedecifras.app/service/internal/emaillink"
	mailer "estantedecifras.app/service/internal/mail"
	"estantedecifras.app/service/internal/passkey"
	"estantedecifras.app/service/internal/session"
)

// APIDeps carries the collaborators the sign-in API handlers need beyond the
// mux frame: the Postgres pool they read accounts and write links, passkeys and
// sessions against, the Mailer that posts the sign-in link, the HMAC secret the
// emailed token is signed with, the public origin the mailed link is built on,
// and the passkey relying party the passkey handlers run WebAuthn through.
// Handler registers the sign-in routes only when it is given (nil for the
// skeleton and the app/health behavior tests, which exercise no /api route).
type APIDeps struct {
	DB            *pgxpool.Pool
	Mailer        mailer.Mailer
	LinkSecret    []byte
	PublicBaseURL string
	Passkeys      *passkey.RP
	// BooksRoot is the volume directory the per-book bare repositories live
	// under; the book handlers derive each repository's path from it and the
	// book id (service.books; DIRECTION §3.3).
	BooksRoot string
	// HooksDir is the directory git is pointed at via core.hooksPath on every
	// push, so the pre-receive hook (once the hook stream lands) runs from one
	// place for every repo (service.git_http). Empty falls back to
	// config.DefaultHooksDir.
	HooksDir string
	// GitDeadline bounds a single git-over-HTTP invocation; a request that
	// outlives it is killed and the repository left intact (service.git_http).
	// Zero falls back to config.DefaultGitDeadline.
	GitDeadline time.Duration
	// GitMaxBodyBytes caps a git-over-HTTP request body before git reads a byte
	// (service.git_http). Zero falls back to config.DefaultGitMaxBodyBytes.
	GitMaxBodyBytes int64
	// ReceiveMaxInputSize caps the bytes of a single push's pack git will index
	// (receive.maxInputSize), set on the receive-pack the service spawns so an
	// over-size pack is refused before the hook runs (hook.limits). Zero falls
	// back to config.DefaultReceiveMaxInputSize.
	ReceiveMaxInputSize int64
}

// handleRequestEmailLink implements POST /api/auth/email/request
// (requestEmailLink): the WebAuthn fallback and recovery path of workflow 13.
// It answers 202 for any syntactically valid address and 400 for a malformed
// body. Only when an account holds the address does it mint a signed,
// 15-minute, single-use token, store it in email_login_links, and mail the
// link — the account-exists and no-account cases are indistinguishable to the
// caller, so the response never reveals who has an account (api/openapi.yaml
// lines 169–185). The address is kept to the request body and never echoed in
// an error.
func handleRequestEmailLink(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Email string `json:"email"`
		}
		if err := decodeStrict(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}
		addr, err := mail.ParseAddress(body.Email)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}
		email := strings.ToLower(addr.Address)

		// Everything below the 202 is best-effort for an account that exists;
		// the caller sees the same 202 either way. A genuine infrastructure
		// failure (not attacker-controlled, and only reachable when the account
		// exists) is a 500 so ops sees it, carrying no address or token.
		if err := api.mintAndSend(r.Context(), email); err != nil {
			if errors.Is(err, errNoAccount) {
				w.WriteHeader(http.StatusAccepted)
				return
			}
			writeError(w, http.StatusInternalServerError, "internal", "Could not send the sign-in link.")
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}
}

// errNoAccount signals that no account holds the address, so no link is minted
// or mailed — the no-account branch of requestEmailLink.
var errNoAccount = errors.New("no account for address")

// mintAndSend looks up the account for email and, when one exists, mints a
// signed single-use token, stores its row, and mails the link. It returns
// errNoAccount when the address has no account (the indistinguishable branch),
// or a wrapped error on a genuine failure.
func (api *APIDeps) mintAndSend(ctx context.Context, email string) error {
	var accountID string
	err := api.DB.QueryRow(ctx, `SELECT id FROM accounts WHERE lower(email) = $1`, email).Scan(&accountID)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNoAccount
	}
	if err != nil {
		return err
	}

	id, err := emaillink.NewID()
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(emaillink.LinkLifetime)
	if _, err := api.DB.Exec(ctx,
		`INSERT INTO email_login_links (id, account_id, expires_at) VALUES ($1, $2, $3)`,
		id, accountID, expiresAt); err != nil {
		return err
	}

	token := emaillink.Mint(id, api.LinkSecret)
	link := strings.TrimRight(api.PublicBaseURL, "/") + "/sign-in/" + token
	return api.Mailer.SendSignInLink(ctx, email, link)
}

// handleRedeemEmailLink implements POST /api/auth/email/redeem
// (redeemEmailLink). It verifies the token's signature, then consumes it with
// one atomic UPDATE that is also the expiry and single-use guard; on success it
// starts a session (sets the estante_session cookie) and returns the Account
// (api/openapi.yaml lines 187–209). A tampered, expired, reused or unknown
// token is refused 401 with no session set. The contract defines only 200 and
// 401 for this route, so every non-success — including a malformed body — is a
// 401; no address or token reaches a log.
func handleRedeemEmailLink(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Token string `json:"token"`
		}
		if err := decodeStrict(r, &body); err != nil || body.Token == "" {
			writeUnauthorized(w)
			return
		}

		id, ok := emaillink.Parse(body.Token, api.LinkSecret)
		if !ok {
			writeUnauthorized(w)
			return
		}

		// One atomic statement is the single-use and expiry enforcement: it
		// consumes the row only if it is unconsumed and unexpired, returning the
		// account. Zero rows — unknown id, already consumed, or expired — is the
		// 401, so a second redeem of the same token never reaches Issue and only
		// one session is ever minted (refinement Decisions).
		var accountID string
		err := api.DB.QueryRow(r.Context(),
			`UPDATE email_login_links SET consumed_at = now()
			 WHERE id = $1 AND consumed_at IS NULL AND expires_at > now()
			 RETURNING account_id`, id).Scan(&accountID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeUnauthorized(w)
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not redeem the sign-in link.")
			return
		}

		if err := session.Issue(r.Context(), api.DB, accountID, r, w); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not start a session.")
			return
		}

		writeJSON(w, http.StatusOK, struct {
			ID string `json:"id"`
		}{ID: accountID})
	}
}

// writeUnauthorized writes the 401 the contract defines for redeem — a generic
// refusal carrying no token or address.
func writeUnauthorized(w http.ResponseWriter) {
	writeError(w, http.StatusUnauthorized, "unauthorized", "That sign-in link is not valid.")
}

// decodeStrict decodes a small JSON request body into v, rejecting unknown
// fields (the contract's additionalProperties: false) and any trailing data,
// with a modest size cap so a hostile body cannot exhaust memory.
func decodeStrict(r *http.Request, v any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, 64*1024))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return err
	}
	if dec.More() {
		return errors.New("unexpected trailing data in request body")
	}
	return nil
}

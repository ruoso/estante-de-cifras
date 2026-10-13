package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"estantedecifras.app/service/internal/passkey"
	"estantedecifras.app/service/internal/ratelimit"
	"estantedecifras.app/service/internal/session"
)

// The passkey sign-in handlers (workflow 13; api/openapi.yaml /api/auth/passkey/*
// and /api/account/passkeys). They run standard WebAuthn through go-webauthn
// (the internal/passkey relying party), carry the transient begin→finish
// challenge in a signed, short-lived state token rather than a server-side
// store (refinement Decision 3), and map credentials onto the passkeys table
// with no migration (Decision 2). First-run account creation lives here: a
// register/finish with no session creates the account (email NULL) and starts
// a session (Decision 7).
//
// The no-secret-in-logs rule holds throughout (DIRECTION §3.3): a credential, a
// challenge, a state token, a credential id, a public key and an account id are
// never logged nor echoed in an Error body. Error messages are fixed,
// caller-chosen strings. The status set is exactly what each operation defines:
// register is 200/400, authenticate is 200/401 (so every non-success there —
// malformed body, unknown credential, bad assertion, stale state — is a 401, as
// redeemEmailLink does), the account routes are 200/204/401/404.

// pgUniqueViolation is Postgres' SQLSTATE for a unique-constraint violation,
// which a duplicate credential_id raises (passkeys.credential_id is UNIQUE).
const pgUniqueViolation = "23505"

// credentialCreationResponse is the begin response the contract defines:
// the standard WebAuthn publicKey options plus the opaque state handle
// (CredentialCreationOptions/CredentialRequestOptions, api/openapi.yaml:870-901).
type credentialBeginResponse struct {
	PublicKey any    `json:"publicKey"`
	State     string `json:"state"`
}

// handleRegisterPasskeyBegin implements POST /api/auth/passkey/register/begin
// (registerPasskeyBegin, api/openapi.yaml:62-88). With no session it returns
// options for a fresh account handle; with a session it returns options for the
// signed-in account, excluding its existing credentials. The user handle is the
// account UUID bytes, minted now for a new account so it is stable across
// begin→finish (refinement Decision 7). It answers 200 or 400.
func handleRegisterPasskeyBegin(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// The optional label is carried to finish in PasskeyFinishRequest, not
		// used here; the body is decoded only to reject a malformed one.
		var body struct {
			Label *string `json:"label"`
		}
		if err := decodeOptional(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}

		ctx := r.Context()
		user, opts, err := api.registrationUser(ctx, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not begin passkey registration.")
			return
		}

		creation, sessionData, err := api.Passkeys.WebAuthn().BeginRegistration(user, opts...)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "Could not begin passkey registration.")
			return
		}
		state, err := api.Passkeys.Seal(sessionData, time.Now())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not begin passkey registration.")
			return
		}
		writeJSON(w, http.StatusOK, credentialBeginResponse{PublicKey: creation.Response, State: state})
	}
}

// registrationUser builds the webauthn.User a register/begin ceremony is for,
// and the registration options. A signed-in caller registers an additional
// passkey on their account — the account's existing credentials go into
// excludeCredentials so the same authenticator is not enrolled twice (workflow
// 13 lines 24, 73). A caller with no session registers the first passkey of a
// brand-new account, whose UUID is minted now (refinement Decision 7).
func (api *APIDeps) registrationUser(ctx context.Context, r *http.Request) (*passkey.User, []webauthn.RegistrationOption, error) {
	accountID, ok, err := session.Resolve(ctx, api.DB, r)
	if err != nil {
		return nil, nil, err
	}
	if !ok {
		user, err := passkey.UserFor(passkey.NewAccountID(), "", nil)
		return user, nil, err
	}

	email, rows, err := api.loadAccountAndPasskeys(ctx, accountID)
	if err != nil {
		return nil, nil, err
	}
	user, err := passkey.UserFor(accountID, email, rows)
	if err != nil {
		return nil, nil, err
	}
	opts := []webauthn.RegistrationOption{
		webauthn.WithExclusions(webauthn.Credentials(user.Creds).CredentialDescriptors()),
	}
	return user, opts, nil
}

// handleRegisterPasskeyFinish implements POST /api/auth/passkey/register/finish
// (registerPasskeyFinish, api/openapi.yaml:90-115). It verifies the attestation
// and the state, then — with no session — creates the account (email NULL),
// inserts the passkey and starts a session; with a session it adds the passkey
// to that account. A duplicate credential is refused. It answers 200 or 400.
func handleRegisterPasskeyFinish(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body passkeyFinishBody
		if err := decodeStrict(r, &body); err != nil || body.State == "" || len(body.Credential) == 0 {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}

		sessionData, err := api.Passkeys.Open(body.State, time.Now())
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The registration could not be completed.")
			return
		}

		parsed, err := protocol.ParseCredentialCreationResponseBytes(body.Credential)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The registration could not be completed.")
			return
		}

		// The account the credential binds to is the state's user handle. For a
		// signed-in caller this is their account (set at begin); for a new account
		// it is the handle minted at begin, and the accounts row is created here
		// under that id so the handle and the stored account always agree
		// (refinement Decision 7).
		accountID, err := passkey.AccountIDFromHandle(sessionData.UserID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The registration could not be completed.")
			return
		}
		user, err := passkey.UserFor(accountID, "", nil)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "The registration could not be completed.")
			return
		}

		credential, err := api.Passkeys.WebAuthn().CreateCredential(user, *sessionData, parsed)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The registration could not be completed.")
			return
		}
		row := passkey.NewRow(accountID, credential, body.Label)

		ctx := r.Context()
		_, signedIn, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "The registration could not be completed.")
			return
		}

		if signedIn {
			// Add the passkey to the already-signed-in account; no new session.
			if dup, err := insertPasskey(ctx, api.DB, row); err != nil {
				if dup {
					writeError(w, http.StatusBadRequest, "bad_request", "That passkey is already registered.")
					return
				}
				writeError(w, http.StatusInternalServerError, "internal", "The registration could not be completed.")
				return
			}
			writeAccount(w, accountID)
			return
		}

		// First-run account creation: the account, its first passkey and the
		// session are written together, so a failed step leaves nothing behind.
		if err := api.createAccountWithPasskey(ctx, accountID, row, r, w); err != nil {
			if errors.Is(err, errDuplicateCredential) {
				writeError(w, http.StatusBadRequest, "bad_request", "That passkey is already registered.")
				return
			}
			writeError(w, http.StatusInternalServerError, "internal", "The registration could not be completed.")
			return
		}
		writeAccount(w, accountID)
	}
}

// handleAuthenticatePasskeyBegin implements POST
// /api/auth/passkey/authenticate/begin (authenticatePasskeyBegin,
// api/openapi.yaml:117-138). Discoverable sign-in sends no username: the
// authenticator offers the account. It returns the request options and an
// opaque state, 200 or 400.
func handleAuthenticatePasskeyBegin(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// The body is empty (PasskeyAuthenticateBeginRequest, api:903-907); decode
		// only to reject a malformed one.
		var body struct{}
		if err := decodeOptional(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}

		assertion, sessionData, err := api.Passkeys.WebAuthn().BeginDiscoverableLogin()
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "Could not begin passkey sign-in.")
			return
		}
		state, err := api.Passkeys.Seal(sessionData, time.Now())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not begin passkey sign-in.")
			return
		}
		writeJSON(w, http.StatusOK, credentialBeginResponse{PublicKey: assertion.Response, State: state})
	}
}

// handleAuthenticatePasskeyFinish implements POST
// /api/auth/passkey/authenticate/finish (authenticatePasskeyFinish,
// api/openapi.yaml:140-162). It verifies the assertion against the stored
// credential, advances the sign count, updates last_used_at and starts a
// session. The contract defines only 200 and 401, so every non-success — an
// unknown credential, a bad signature, a stale state, a malformed body — is a
// 401 with no session set.
func handleAuthenticatePasskeyFinish(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Sign-in attempts are rate-limited per client IP, failures only. The
		// check runs first, before any WebAuthn work (service.rate_limits
		// Constraint 5); each 401 below records against it, a successful sign-in
		// never does (Decision 3).
		ip := clientIP(r, api.TrustedProxies)
		if !rateCheck(w, api.Limiter, ratelimit.SignIn, ip) {
			return
		}
		fail := func() {
			rateRecordFailure(api.Limiter, ratelimit.SignIn, ip)
			writeUnauthorized(w)
		}

		var body passkeyFinishBody
		if err := decodeStrict(r, &body); err != nil || body.State == "" || len(body.Credential) == 0 {
			fail()
			return
		}

		sessionData, err := api.Passkeys.Open(body.State, time.Now())
		if err != nil {
			fail()
			return
		}

		parsed, err := protocol.ParseCredentialRequestResponseBytes(body.Credential)
		if err != nil {
			fail()
			return
		}

		ctx := r.Context()
		// The discoverable-login handler maps the authenticator-offered user
		// handle to the account and its credentials; go-webauthn then finds the
		// asserted credential within them and verifies the signature. An unknown
		// credential (none of the account's, or no such account) makes it return
		// a nil user / not-found, which surfaces as the 401 below.
		var resolvedAccountID string
		handler := func(_, userHandle []byte) (webauthn.User, error) {
			accountID, hErr := passkey.AccountIDFromHandle(userHandle)
			if hErr != nil {
				return nil, hErr
			}
			email, rows, hErr := api.loadAccountAndPasskeys(ctx, accountID)
			if hErr != nil {
				return nil, hErr
			}
			resolvedAccountID = accountID
			return passkey.UserFor(accountID, email, rows)
		}

		credential, err := api.Passkeys.WebAuthn().ValidateDiscoverableLogin(handler, *sessionData, parsed)
		if err != nil || resolvedAccountID == "" {
			fail()
			return
		}

		// Advance the sign count and stamp last_used_at for the credential that
		// just signed in (a cloned-authenticator signal and the "last used"
		// the account screen shows, workflow 13).
		if _, err := api.DB.Exec(ctx,
			`UPDATE passkeys SET sign_count = $1, last_used_at = now() WHERE credential_id = $2`,
			int64(credential.Authenticator.SignCount), credential.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not complete passkey sign-in.")
			return
		}

		if err := session.Issue(ctx, api.DB, resolvedAccountID, r, w); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not start a session.")
			return
		}
		writeAccount(w, resolvedAccountID)
	}
}

// handleListPasskeys implements GET /api/account/passkeys (listPasskeys,
// api/openapi.yaml:255-268): the signed-in account's passkeys. 200 or 401.
func handleListPasskeys(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list passkeys.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		rows, err := api.DB.Query(ctx,
			`SELECT id, label, created_at, last_used_at
			 FROM passkeys WHERE account_id = $1 ORDER BY created_at`, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list passkeys.")
			return
		}
		defer rows.Close()

		list := passkeyList{Passkeys: []passkeyJSON{}}
		for rows.Next() {
			var (
				id         string
				label      *string
				createdAt  time.Time
				lastUsedAt *time.Time
			)
			if err := rows.Scan(&id, &label, &createdAt, &lastUsedAt); err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not list passkeys.")
				return
			}
			pk := passkeyJSON{ID: id, Label: label, CreatedAt: createdAt.UTC().Format(time.RFC3339Nano)}
			if lastUsedAt != nil {
				s := lastUsedAt.UTC().Format(time.RFC3339Nano)
				pk.LastUsedAt = &s
			}
			list.Passkeys = append(list.Passkeys, pk)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list passkeys.")
			return
		}
		writeJSON(w, http.StatusOK, list)
	}
}

// handleRemovePasskey implements DELETE /api/account/passkeys/{passkeyId}
// (removePasskey, api/openapi.yaml:270-283): remove one of the caller's own
// passkeys. 204, 401 without a session, or 404 for an id not on the account.
func handleRemovePasskey(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not remove the passkey.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		passkeyID := r.PathValue("passkeyId")
		// The delete is scoped to the caller's account, so a passkey on another
		// account is a 404, never touched. An id that is not a uuid can match no
		// row, so it is a 404 too, not a cast error.
		if !isUUID(passkeyID) {
			writeError(w, http.StatusNotFound, "not_found", "No such passkey.")
			return
		}
		tag, err := api.DB.Exec(ctx,
			`DELETE FROM passkeys WHERE id = $1 AND account_id = $2`, passkeyID, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not remove the passkey.")
			return
		}
		if tag.RowsAffected() == 0 {
			writeError(w, http.StatusNotFound, "not_found", "No such passkey.")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// --- shared request/response shapes and DB helpers --------------------------

// passkeyFinishBody is the PasskeyFinishRequest the register and authenticate
// finish routes share (api/openapi.yaml:909-925): the state handle to open, the
// opaque WebAuthn credential JSON (passed through to go-webauthn), and an
// optional label for a newly registered passkey.
type passkeyFinishBody struct {
	State      string          `json:"state"`
	Credential json.RawMessage `json:"credential"`
	Label      *string         `json:"label"`
}

type passkeyJSON struct {
	ID         string  `json:"id"`
	Label      *string `json:"label,omitempty"`
	CreatedAt  string  `json:"createdAt"`
	LastUsedAt *string `json:"lastUsedAt,omitempty"`
}

type passkeyList struct {
	Passkeys []passkeyJSON `json:"passkeys"`
}

// writeAccount writes the 200 Account body (api/openapi.yaml:852-859).
func writeAccount(w http.ResponseWriter, accountID string) {
	writeJSON(w, http.StatusOK, struct {
		ID string `json:"id"`
	}{ID: accountID})
}

// loadAccountAndPasskeys reads an account's recovery email (empty when NULL)
// and its stored passkey rows, for building the webauthn.User adapter. A
// missing account yields an empty email and no rows (so a stale user handle
// resolves to a user with no credentials, which fails the ceremony).
func (api *APIDeps) loadAccountAndPasskeys(ctx context.Context, accountID string) (email string, rows []passkey.Row, err error) {
	var dbEmail *string
	err = api.DB.QueryRow(ctx, `SELECT email FROM accounts WHERE id = $1`, accountID).Scan(&dbEmail)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, nil
	}
	if err != nil {
		return "", nil, err
	}
	if dbEmail != nil {
		email = *dbEmail
	}

	q, err := api.DB.Query(ctx,
		`SELECT id, credential_id, public_key, sign_count, aaguid,
		        coalesce(transports, '{}'), backup_eligible, backup_state
		 FROM passkeys WHERE account_id = $1 ORDER BY created_at`, accountID)
	if err != nil {
		return "", nil, err
	}
	defer q.Close()
	for q.Next() {
		var row passkey.Row
		row.AccountID = accountID
		if err := q.Scan(&row.ID, &row.CredentialID, &row.PublicKey, &row.SignCount,
			&row.AAGUID, &row.Transports, &row.BackupEligible, &row.BackupState); err != nil {
			return "", nil, err
		}
		rows = append(rows, row)
	}
	if err := q.Err(); err != nil {
		return "", nil, err
	}
	return email, rows, nil
}

// insertPasskey inserts one passkeys row, reporting a duplicate credential
// (the unique credential_id) as dup == true so the caller can answer the right
// status. Any other error is returned as-is.
func insertPasskey(ctx context.Context, db interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}, row passkey.Row) (dup bool, err error) {
	_, err = db.Exec(ctx,
		`INSERT INTO passkeys
		   (account_id, credential_id, public_key, sign_count, aaguid, transports, backup_eligible, backup_state, label)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		row.AccountID, row.CredentialID, row.PublicKey, row.SignCount, row.AAGUID,
		row.Transports, row.BackupEligible, row.BackupState, row.Label)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return true, err
		}
		return false, err
	}
	return false, nil
}

// errDuplicateCredential marks a first-run account creation that failed because
// the credential is already registered, so the handler can answer 400.
var errDuplicateCredential = errors.New("duplicate credential")

// createAccountWithPasskey creates a brand-new account (email NULL), inserts
// its first passkey and starts a session, all in one transaction so a failed
// step leaves nothing behind (refinement Decision 7). The account id is the one
// minted at begin and carried in the state, so the WebAuthn user handle always
// matches the stored account.
func (api *APIDeps) createAccountWithPasskey(ctx context.Context, accountID string, row passkey.Row, r *http.Request, w http.ResponseWriter) error {
	tx, err := api.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `INSERT INTO accounts (id) VALUES ($1)`, accountID); err != nil {
		return err
	}
	if dup, err := insertPasskey(ctx, tx, row); err != nil {
		if dup {
			return errDuplicateCredential
		}
		return err
	}
	if err := session.Issue(ctx, tx, accountID, r, w); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// decodeOptional decodes a small, optional JSON body into v: an empty body is
// accepted (v is left at its zero value), a present body is decoded strictly
// (unknown fields and trailing data rejected). The begin routes take an
// optional body, so "no body" must be a success, not a 400.
func decodeOptional(r *http.Request, v any) error {
	data, err := io.ReadAll(io.LimitReader(r.Body, 64*1024))
	if err != nil {
		return err
	}
	if len(bytes.TrimSpace(data)) == 0 {
		return nil
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return err
	}
	if dec.More() {
		return errors.New("unexpected trailing data in request body")
	}
	return nil
}

// isUUID reports whether s is a canonical UUID, so a path parameter that cannot
// match a uuid primary key is answered 404 rather than sent to Postgres as a
// cast error.
func isUUID(s string) bool {
	_, err := passkey.HandleFromAccountID(s)
	return err == nil
}

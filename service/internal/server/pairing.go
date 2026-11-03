package server

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"estantedecifras.app/service/internal/pairing"
	"estantedecifras.app/service/internal/ratelimit"
	"estantedecifras.app/service/internal/session"
)

// Pairing a device the way a television is paired (reader.device_pairing;
// docs/remarkable-reader.md §5.1; workflow 13 §Pairing a reMarkable;
// api/openapi.yaml /api/devices/pair/*). A device with no session begins a
// pairing and is given a short code, the address to type it at, a poll token
// and an expiry; a signed-in person approves the code, which mints a
// read-only session of their account; the device, polling with the token only
// it holds, receives that session once.
//
// Secrets: the code, the poll token and the session id travel only in JSON
// bodies (no new path carries one, so LogRequests needs no redactor), are
// never logged nor put in an error message, and the code and the token are
// stored only as SHA-256 hex (Constraint 5).

// A code is approvable for ten minutes after begin, and an approved pairing
// stays deliverable for ten minutes after approval (Constraint 3): the
// "interval '10 minutes'" in begin's INSERT and poll's SELECT, on the
// database's clock.

// pairBeginAttempts bounds the retries on a code collision at begin.
const pairBeginAttempts = 5

type devicePairingJSON struct {
	Code      string `json:"code"`
	URL       string `json:"url"`
	PollToken string `json:"pollToken"`
	ExpiresAt string `json:"expiresAt"`
}

type devicePairingPollJSON struct {
	Status  string `json:"status"`
	Session string `json:"session,omitempty"`
}

// pairURL is the address a code is typed at: the public base, plus /pair.
// The host is kept as it is, www. included: the bare estantedecifras.app's
// forwarding (at the registrar) answers only its root and 404s every path, so
// a shorter address without www. would not open the page (Constraint 10 as
// first written dropped it; DIRECTION §3.3).
func pairURL(base string) string {
	u, err := url.Parse(strings.TrimRight(base, "/"))
	if err != nil || u.Host == "" {
		return strings.TrimRight(base, "/") + "/pair"
	}
	u.Path = "/pair"
	u.RawQuery = ""
	u.Fragment = ""
	return u.String()
}

// newPollToken draws 256 random bits as the poll token, base64url.
func newPollToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// handleBeginDevicePairing implements POST /api/devices/pair/begin
// (beginDevicePairing): no session. 201 with the code, the address, the poll
// token and the expiry; 429 past the per-IP cap.
func handleBeginDevicePairing(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !rateAllow(w, api.Limiter, ratelimit.PairBegin, clientIP(r, api.TrustedProxies)) {
			return
		}
		ctx := r.Context()

		// Housekeeping: one DELETE per begin drops pairings a day past their
		// expiry (Constraint 11; no background job).
		if _, err := api.DB.Exec(ctx,
			`DELETE FROM device_pairings WHERE expires_at < now() - interval '1 day'`); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not begin the pairing.")
			return
		}

		token, err := newPollToken()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not begin the pairing.")
			return
		}
		for attempt := 0; attempt < pairBeginAttempts; attempt++ {
			raw, err := pairing.Generate()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not begin the pairing.")
				return
			}
			var expiresAt time.Time
			err = api.DB.QueryRow(ctx,
				`INSERT INTO device_pairings (code_hash, poll_token_hash, expires_at)
				 VALUES ($1, $2, now() + interval '10 minutes')
				 RETURNING expires_at`,
				hashToken(raw), hashToken(token)).Scan(&expiresAt)
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
				// A code collision (or, vanishingly, a token one): draw again.
				continue
			}
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not begin the pairing.")
				return
			}
			writeJSON(w, http.StatusCreated, devicePairingJSON{
				Code:      pairing.Format(raw),
				URL:       pairURL(api.PublicBaseURL),
				PollToken: token,
				ExpiresAt: expiresAt.UTC().Format(time.RFC3339),
			})
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "Could not begin the pairing.")
	}
}

// errPair* are approve's four answers apart from success (pair_design: told
// apart, workflow 13 L404–416).
var (
	errPairUnknown = errors.New("pair code unknown")
	errPairExpired = errors.New("pair code expired")
	errPairUsed    = errors.New("pair code used")
)

// handleApproveDevicePairing implements POST /api/devices/pair/approve
// (approveDevicePairing): a signed-in session approves a code for its
// account. 204; 404 pair_code_unknown, 410 pair_code_expired, 409
// pair_code_used; 401 without a session; 429 past the per-account failure cap.
func handleApproveDevicePairing(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not approve the code.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}
		// Checked before, recorded only on a failure, as sign-in is.
		if !rateCheck(w, api.Limiter, ratelimit.PairApprove, accountID) {
			return
		}
		var body struct {
			Code string `json:"code"`
		}
		if err := decodeStrict(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}

		err = api.approvePairing(ctx, body.Code, accountID)
		switch {
		case err == nil:
			w.WriteHeader(http.StatusNoContent)
		case errors.Is(err, errPairUnknown):
			rateRecordFailure(api.Limiter, ratelimit.PairApprove, accountID)
			writeError(w, http.StatusNotFound, "pair_code_unknown", "No reMarkable is showing that code.")
		case errors.Is(err, errPairExpired):
			rateRecordFailure(api.Limiter, ratelimit.PairApprove, accountID)
			writeError(w, http.StatusGone, "pair_code_expired", "That code has run out.")
		case errors.Is(err, errPairUsed):
			rateRecordFailure(api.Limiter, ratelimit.PairApprove, accountID)
			writeError(w, http.StatusConflict, "pair_code_used", "That code has already been used.")
		default:
			writeError(w, http.StatusInternalServerError, "internal", "Could not approve the code.")
		}
	}
}

// approvePairing is approve's one transaction (Constraint 4): the pairing is
// selected by its code's hash FOR UPDATE, so of two concurrent approvals one
// mints the session and the other finds it approved — used.
func (api *APIDeps) approvePairing(ctx context.Context, typed, accountID string) error {
	raw, ok := pairing.Normalize(typed)
	if !ok {
		return errPairUnknown
	}
	tx, err := api.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		id               string
		approved, expire bool
	)
	err = tx.QueryRow(ctx,
		`SELECT id, approved_at IS NOT NULL, expires_at <= now()
		 FROM device_pairings WHERE code_hash = $1 FOR UPDATE`, hashToken(raw)).Scan(&id, &approved, &expire)
	if errors.Is(err, pgx.ErrNoRows) {
		return errPairUnknown
	}
	if err != nil {
		return err
	}
	if approved {
		return errPairUsed
	}
	if expire {
		return errPairExpired
	}
	sessionID, err := session.IssueReadOnly(ctx, tx, accountID, session.KindRemarkable)
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE device_pairings SET approved_by = $2, approved_at = now(), session_id = $3 WHERE id = $1`,
		id, accountID, sessionID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// handlePollDevicePairing implements POST /api/devices/pair/poll
// (pollDevicePairing): no session; the poll token in the body. 200 pending,
// expired, or — once — approved with the session; 404 pair_token_unknown for
// a token never given out or already delivered (Decision 7); 429.
func handlePollDevicePairing(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !rateAllow(w, api.Limiter, ratelimit.PairPoll, clientIP(r, api.TrustedProxies)) {
			return
		}
		var body struct {
			PollToken string `json:"pollToken"`
		}
		if err := decodeStrict(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}
		res, err := api.pollPairing(r.Context(), body.PollToken)
		if errors.Is(err, errPairUnknown) {
			writeError(w, http.StatusNotFound, "pair_token_unknown", "No such pairing.")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not read the pairing.")
			return
		}
		writeJSON(w, http.StatusOK, res)
	}
}

// pollPairing is poll's one transaction (Constraint 3). Unapproved: pending
// until the code's expiry, then expired. Approved and undelivered: within ten
// minutes of approval the session is delivered and the row marked delivered
// (so the next poll is unknown); past that — or if the session was signed out
// meanwhile — expired, revoking the undelivered session in the same
// transaction.
func (api *APIDeps) pollPairing(ctx context.Context, token string) (devicePairingPollJSON, error) {
	if token == "" {
		return devicePairingPollJSON{}, errPairUnknown
	}
	tx, err := api.DB.Begin(ctx)
	if err != nil {
		return devicePairingPollJSON{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		id                               string
		approved, delivered, codeExpired bool
		deliveryExpired, sessionLive     bool
		sessionID                        *string
	)
	err = tx.QueryRow(ctx,
		`SELECT p.id, p.approved_at IS NOT NULL, p.delivered_at IS NOT NULL,
		        p.expires_at <= now(),
		        p.approved_at IS NOT NULL AND p.approved_at + interval '10 minutes' <= now(),
		        p.session_id, s.id IS NOT NULL AND s.revoked_at IS NULL
		 FROM device_pairings p
		 LEFT JOIN sessions s ON s.id = p.session_id
		 WHERE p.poll_token_hash = $1
		 FOR UPDATE OF p`, hashToken(token)).
		Scan(&id, &approved, &delivered, &codeExpired, &deliveryExpired, &sessionID, &sessionLive)
	if errors.Is(err, pgx.ErrNoRows) {
		return devicePairingPollJSON{}, errPairUnknown
	}
	if err != nil {
		return devicePairingPollJSON{}, err
	}
	switch {
	case delivered:
		return devicePairingPollJSON{}, errPairUnknown
	case !approved && codeExpired:
		return devicePairingPollJSON{Status: "expired"}, nil
	case !approved:
		return devicePairingPollJSON{Status: "pending"}, nil
	case deliveryExpired || !sessionLive || sessionID == nil:
		if sessionID != nil {
			if _, err := tx.Exec(ctx,
				`UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, *sessionID); err != nil {
				return devicePairingPollJSON{}, err
			}
		}
		if err := tx.Commit(ctx); err != nil {
			return devicePairingPollJSON{}, err
		}
		return devicePairingPollJSON{Status: "expired"}, nil
	}
	if _, err := tx.Exec(ctx,
		`UPDATE device_pairings SET delivered_at = now() WHERE id = $1`, id); err != nil {
		return devicePairingPollJSON{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return devicePairingPollJSON{}, err
	}
	return devicePairingPollJSON{Status: "approved", Session: *sessionID}, nil
}

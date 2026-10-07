// Package session mints a signed-in device's session: it inserts a sessions
// row in Postgres and writes the estante_session cookie (DIRECTION §3.3 lines
// 170–171, 184 — sessions in Postgres, one origin, a cookie that simply flows).
// It is the smallest correct version of the session seam: service.email_links
// is the first sign-in path to land, before service.passkeys and
// service.sessions, so it owns Issue; service.passkeys reuses it and
// service.sessions builds the account-screen management (list devices,
// last-used, revoke) on the same table and the same Issue (refinement
// Decisions).
package session

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CookieName is the session cookie's name, fixed by the contract's
// sessionCookie security scheme (api/openapi.yaml lines 700–707).
const CookieName = "estante_session"

// Execer is the slice of a pgx pool or transaction Issue needs: a single
// INSERT ... RETURNING. Both *pgxpool.Pool and pgx.Tx satisfy it, so a caller
// can mint a session on the pool directly or inside its own transaction.
type Execer interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Issue inserts a sessions row for accountID and sets the estante_session
// cookie on w. The cookie is HttpOnly (no script can read the session),
// Secure (sent only over TLS, one origin), SameSite=Lax and Path=/ — the
// attributes service.sessions' note already fixes, so nothing is re-litigated
// (refinement Decisions). Its value is the new session's id; revocation is
// enforced lazily at the device's next request (workflow 13), which
// service.sessions adds — the row is never deleted to sign out.
//
// Issue writes only the cookie header (not yet flushed), so a caller may still
// choose its response status afterward. The cookie's value is a server-assigned
// identifier, never logged.
func Issue(ctx context.Context, db Execer, accountID string, w http.ResponseWriter) error {
	var id string
	if err := db.QueryRow(ctx,
		`INSERT INTO sessions (account_id) VALUES ($1) RETURNING id`,
		accountID).Scan(&id); err != nil {
		return fmt.Errorf("session: inserting a session row: %w", err)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    id,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

// Resolve is the minimal session-read seam the authenticated routes need: it
// reads the estante_session cookie, selects the account for a non-revoked
// sessions row and bumps its last_used_at, all in one atomic statement. An
// absent, malformed, unknown or revoked session is simply "not signed in"
// (ok == false, err == nil); err is non-nil only on a genuine infrastructure
// failure. Revocation is enforced lazily here, at the device's next request
// (workflow 13): a revoked row matches no WHERE clause and never resolves.
//
// Issue writes the session and nothing read it yet; Resolve is the first
// reader, mirroring how service.email_links introduced Issue before
// service.sessions, which extends this seam with device listing, last-used
// display, revocation and signOut (package doc; refinement Decision 9). The
// account id it returns is server-assigned and never logged.
func Resolve(ctx context.Context, db Execer, r *http.Request) (accountID string, ok bool, err error) {
	c, cErr := r.Cookie(CookieName)
	if cErr != nil || c.Value == "" {
		return "", false, nil
	}
	// The sessions.id column is a uuid; a cookie value that is not a uuid can
	// never match a row, so it is rejected here rather than sent to Postgres as
	// a cast error that would masquerade as an infrastructure failure.
	if _, pErr := uuid.Parse(c.Value); pErr != nil {
		return "", false, nil
	}

	err = db.QueryRow(ctx,
		`UPDATE sessions SET last_used_at = now()
		 WHERE id = $1 AND revoked_at IS NULL
		 RETURNING account_id`, c.Value).Scan(&accountID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("session: resolving a session: %w", err)
	}
	return accountID, true, nil
}

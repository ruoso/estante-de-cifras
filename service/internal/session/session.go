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
	"fmt"
	"net/http"

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

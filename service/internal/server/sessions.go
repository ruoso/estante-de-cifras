package server

import (
	"net/http"
	"time"

	"estantedecifras.app/service/internal/session"
)

// The account-screen session handlers (workflow 13 §The account screen,
// §Signing out; api/openapi.yaml /api/auth/signout and /api/account/sessions):
// sign out of this device, list the signed-in devices, and sign one out from
// another. A "device" is a sessions row (service.schema: no devices table), so
// signing one out is revoking that row — lazily, never deleting it, so a lost
// phone's session stops working at its next request (refinement Decisions 2, 7,
// 8). There is no session middleware; each handler resolves the session inline,
// as the passkey list/remove handlers do, and answers 401 without one.
//
// The no-session-value-in-logs rule holds throughout (DIRECTION §3.3): the
// cookie, the session id and the account id are never logged nor echoed in an
// error body. Statuses are exactly what the contract defines: signOut 204/401,
// listSessions 200/401, revokeSession 204/401/404.

// handleSignOut implements POST /api/auth/signout (signOut, api/openapi.yaml:211):
// it revokes the current session and clears the cookie, so sign-out ends the
// session even if a copied cookie lingers (refinement Decision 2). 204, or 401
// without a session.
func handleSignOut(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not sign out.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		// Resolve validated the cookie (it resolved the account), so its value is
		// the current session's id (refinement Decision 5). Revoking the row makes
		// sign-out effective even if the cookie is cached; clearing the cookie
		// drops it from this browser.
		c, _ := r.Cookie(session.CookieName)
		if _, err := session.Revoke(ctx, api.DB, c.Value, accountID); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not sign out.")
			return
		}
		session.ClearCookie(w)
		w.WriteHeader(http.StatusNoContent)
	}
}

// handleListSessions implements GET /api/account/sessions (listSessions,
// api/openapi.yaml:222): the account's non-revoked sessions, most-recently-used
// first, each with when it was last used, the current flag and a device label
// when known. 200 or 401.
func handleListSessions(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list sessions.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		// The request's own session id, to mark exactly one row current
		// (refinement Decision 5); Resolve already validated the cookie.
		c, _ := r.Cookie(session.CookieName)
		currentID := c.Value

		// A revoked session is no longer a signed-in device, so it drops off the
		// list; most-recently-used first puts the current device near the top
		// (refinement Decision 6). Resolve just bumped the current session's
		// last_used_at, so it sorts first.
		rows, err := api.DB.Query(ctx,
			`SELECT id, device, last_used_at
			 FROM sessions
			 WHERE account_id = $1 AND revoked_at IS NULL
			 ORDER BY last_used_at DESC`, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list sessions.")
			return
		}
		defer rows.Close()

		list := sessionList{Sessions: []sessionJSON{}}
		for rows.Next() {
			var (
				id         string
				device     *string
				lastUsedAt time.Time
			)
			if err := rows.Scan(&id, &device, &lastUsedAt); err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not list sessions.")
				return
			}
			s := sessionJSON{
				ID:         id,
				Current:    id == currentID,
				LastUsedAt: lastUsedAt.UTC().Format(time.RFC3339Nano),
			}
			if device != nil && *device != "" {
				s.Device = device
			}
			list.Sessions = append(list.Sessions, s)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list sessions.")
			return
		}
		writeJSON(w, http.StatusOK, list)
	}
}

// handleRevokeSession implements DELETE /api/account/sessions/{sessionId}
// (revokeSession, api/openapi.yaml:237): sign one of the account's own devices
// out from another. 204, 401 without a session, or 404 for an id that is not
// one of the account's live sessions — a wrong account, unknown, malformed or
// already-revoked id is all 404, never a signal that another account's session
// exists (refinement Decision 7). Revoking one's own current session is
// permitted; the cookie is not cleared (that is signOut's job).
func handleRevokeSession(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not sign the device out.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		sessionID := r.PathValue("sessionId")
		// An id that is not a uuid can match no row, so it is a 404 rather than a
		// cast error sent to Postgres.
		if !isUUID(sessionID) {
			writeError(w, http.StatusNotFound, "not_found", "No such session.")
			return
		}
		revoked, err := session.Revoke(ctx, api.DB, sessionID, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not sign the device out.")
			return
		}
		if !revoked {
			writeError(w, http.StatusNotFound, "not_found", "No such session.")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// sessionJSON is the contract's Session (api/openapi.yaml:946): id, current and
// lastUsedAt are always present; device is omitted when no label was derived
// ("when known").
type sessionJSON struct {
	ID         string  `json:"id"`
	Current    bool    `json:"current"`
	LastUsedAt string  `json:"lastUsedAt"`
	Device     *string `json:"device,omitempty"`
}

type sessionList struct {
	Sessions []sessionJSON `json:"sessions"`
}

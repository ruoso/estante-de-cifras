package server

import (
	"net/http"
	"strings"

	"estantedecifras.app/service/internal/session"
)

// ReadOnly wraps h with the read-only guard (reader.device_pairing Constraint
// 7, Decision 1; docs/remarkable-reader.md §5.1, §10): a session read-only by
// scope — a paired reMarkable's — is refused, 403 read_only, every request
// that could change something. It is deny by default: everything is refused
// to a read-only session except the short allowlist of reads (readOnlyAllowed),
// so a write route added later is refused to the reader without anyone
// remembering to.
//
// The session is looked up only for a request the guard would refuse, so a
// GET costs nothing; a request with no cookie, an unknown or revoked one, or a
// full session passes untouched (the handler then answers as it always has).
func ReadOnly(db session.Execer, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if readOnlyAllowed(r) {
			h.ServeHTTP(w, r)
			return
		}
		if c, err := r.Cookie(session.CookieName); err != nil || c.Value == "" {
			h.ServeHTTP(w, r)
			return
		}
		readOnly, err := session.IsReadOnly(r.Context(), db, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not serve the request.")
			return
		}
		if readOnly {
			writeReadOnly(w)
			return
		}
		h.ServeHTTP(w, r)
	})
}

// writeReadOnly is the guard's refusal, the contract's ReadOnly response (and,
// on a git route, its GitForbidden): an Error with code read_only.
func writeReadOnly(w http.ResponseWriter) {
	writeError(w, http.StatusForbidden, "read_only", "This device only reads; it cannot change anything.")
}

// readOnlyAllowed is the guard's allowlist: what a read-only session may do.
// GET and HEAD, save the push advertisement; the shelf change check and a
// fetch, which are POSTs that read; signing itself out (Decision 3); and the
// two pairing calls a device makes, which read no session.
func readOnlyAllowed(r *http.Request) bool {
	p := r.URL.Path
	switch r.Method {
	case http.MethodGet, http.MethodHead:
		if strings.HasPrefix(p, "/git/") && strings.HasSuffix(p, "/info/refs") &&
			r.URL.Query().Get("service") == svcReceivePack {
			return false
		}
		return true
	case http.MethodPost:
		switch p {
		case "/api/shelf/change-check", "/api/auth/signout",
			"/api/devices/pair/begin", "/api/devices/pair/poll":
			return true
		}
		if strings.HasPrefix(p, "/git/") && strings.HasSuffix(p, "/git-upload-pack") &&
			strings.Count(p, "/") == 3 {
			return true
		}
	}
	return false
}

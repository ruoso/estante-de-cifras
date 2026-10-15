package server

import (
	"log/slog"
	"net/http"
	"path"
	"strings"
	"time"
)

// statusRecorder wraps http.ResponseWriter to capture the status code the
// handler writes, so LogRequests can record it. It records nothing drawn from
// the response body — only the status line.
type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (r *statusRecorder) WriteHeader(code int) {
	if !r.wroteHeader {
		r.status = code
		r.wroteHeader = true
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	// A handler that writes a body without calling WriteHeader implies 200,
	// just as net/http does.
	r.wroteHeader = true
	return r.ResponseWriter.Write(b)
}

// LogRequests wraps h so that every request emits exactly one structured log
// line carrying method, path, status and duration — and nothing else. No part
// of a request or response body, and no header value (Authorization, Cookie)
// or query string (which can carry an email or a token), is ever read into
// the line: the standing "no song text in logs" rule made concrete at the
// HTTP edge (DIRECTION §3.3). The line is built field by field, so a body is
// structurally impossible to log by accident. Later handlers add fields (the
// authenticated user id, the book id) but never a body.
func LogRequests(logger *slog.Logger, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}

		h.ServeHTTP(rec, r)

		logger.LogAttrs(r.Context(), slog.LevelInfo, "request",
			slog.String("method", r.Method),
			// The path only — never RawQuery, which can carry a token or an email
			// address — with the invitation accept route's secret token redacted
			// (it is carried in the path, api/openapi.yaml
			// /api/invitations/{token}/accept, and must never be logged —
			// service.sharing Constraints; DIRECTION §3.3).
			// The app pages an emailed link opens carry their token in the path
			// too (/sign-in/<token>, /recovery-email/<token> — linkRoutes),
			// redacted alike. Both match on the path the router sees, so a
			// non-clean form (//sign-in/<token>, answered with a 301) is caught.
			slog.String("path", redactLinkToken(redactInvitationToken(r.URL.Path))),
			slog.Int("status", rec.status),
			slog.Duration("duration", time.Since(start)),
		)
	})
}

// redactInvitationToken replaces the secret token segment of the invitation
// accept route (/api/invitations/{token}/accept) with a placeholder, so the raw
// token — the invitation's capability — never reaches a log line. It matches on
// path.Clean of p — the shape ServeMux routes (and 301s a non-clean path to) —
// so //api/invitations/<token>/accept is redacted too. Any other path is
// returned unchanged, raw.
func redactInvitationToken(p string) string {
	const prefix = "/api/invitations/"
	const suffix = "/accept"
	c := path.Clean(p)
	if !strings.HasPrefix(c, prefix) || !strings.HasSuffix(c, suffix) {
		return p
	}
	mid := c[len(prefix) : len(c)-len(suffix)]
	if mid == "" || strings.Contains(mid, "/") {
		return p // not the single-segment {token} shape
	}
	return prefix + "{token}" + suffix
}

// redactLinkToken replaces everything after the route of an emailed-link app
// page (/sign-in/<token>, /recovery-email/<token> — the routes in linkRoutes,
// the same list the shell fallback serves) with a placeholder, so a link's
// token never reaches a log line (workflow 13 "never logged";
// service.recovery_email Constraint 6). It matches on the path as the router
// cleans it: empty and "." segments are dropped and ".." pops, and the path is
// redacted as soon as the cleaned path so far is /<route>/<segment> — so a
// trailing slash, //sign-in/<token>, /x/../sign-in/<token> and even
// /sign-in/<token>/.. all log as /sign-in/{token}. Any other path is returned
// unchanged, raw.
func redactLinkToken(p string) string {
	var stack []string
	for _, seg := range strings.Split(p, "/") {
		switch seg {
		case "", ".":
			continue
		case "..":
			if len(stack) > 0 {
				stack = stack[:len(stack)-1]
			}
			continue
		}
		if len(stack) == 1 {
			for _, route := range linkRoutes {
				if stack[0] == route {
					return "/" + route + "/{token}"
				}
			}
		}
		stack = append(stack, seg)
	}
	return p
}

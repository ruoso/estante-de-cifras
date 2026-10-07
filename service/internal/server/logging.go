package server

import (
	"log/slog"
	"net/http"
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
			slog.String("path", redactInvitationToken(r.URL.Path)),
			slog.Int("status", rec.status),
			slog.Duration("duration", time.Since(start)),
		)
	})
}

// redactInvitationToken replaces the secret token segment of the invitation
// accept route (/api/invitations/{token}/accept) with a placeholder, so the raw
// token — the invitation's capability — never reaches a log line. Any other
// path is returned unchanged.
func redactInvitationToken(path string) string {
	const prefix = "/api/invitations/"
	const suffix = "/accept"
	if !strings.HasPrefix(path, prefix) || !strings.HasSuffix(path, suffix) {
		return path
	}
	mid := path[len(prefix) : len(path)-len(suffix)]
	if mid == "" || strings.Contains(mid, "/") {
		return path // not the single-segment {token} shape
	}
	return prefix + "{token}" + suffix
}

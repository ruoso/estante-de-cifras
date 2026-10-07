package server

import (
	"context"
	"net/http"
	"time"
)

// healthzBody is the fixed body GET /healthz returns. The check does no I/O —
// liveness is "the process is up and serving", exactly what a container
// healthcheck (foundation.compose) and the e2e smoke test (foundation.e2e_api)
// need. It stays I/O-free deliberately: coupling liveness to Postgres would let
// a database blip flap the container (service.schema Decisions). Readiness —
// "can we reach Postgres" — is GET /readyz below, layered on this liveness
// check.
const healthzBody = "ok\n"

// readyBody and notReadyBody are the fixed bodies GET /readyz returns. Readiness
// is carried by the status code and a word, never colour or a bare code
// (accessibility): 200 "ready", 503 "not ready".
const (
	readyBody    = "ready\n"
	notReadyBody = "not ready\n"
)

// readyTimeout bounds the readiness ping so /readyz answers promptly even when
// Postgres is wedged rather than cleanly down — a hung probe is as useless to
// ops as a wrong one.
const readyTimeout = 2 * time.Second

// handleHealthz answers GET /healthz with 200 and healthzBody.
// Unauthenticated and side-effect-free.
func handleHealthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(healthzBody))
}

// handleReadyz answers GET /readyz by pinging the backing store: 200 "ready"
// when the pool reaches Postgres, 503 "not ready" when it cannot, so the stack
// and ops can tell the service is wired to its database (service.schema). It is
// unauthenticated and read-only. The ping error is deliberately not written to
// the body or logged here — it can name the host, and the metadata-only
// request log (LogRequests) already records the 503; no DSN or credential
// reaches a log (refinement Constraints).
func handleReadyz(ready Pinger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), readyTimeout)
		defer cancel()

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		if ready == nil || ready.Ping(ctx) != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(notReadyBody))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(readyBody))
	}
}

package server

import "net/http"

// healthzBody is the fixed body GET /healthz returns. The check does no I/O —
// the skeleton has no database or volume yet — so it answers purely that the
// process is up and serving, exactly what a container healthcheck
// (foundation.compose) and the e2e smoke test (foundation.e2e_api) need. A
// readiness check that touches Postgres is service.schema's to add later,
// layered on this liveness check.
const healthzBody = "ok\n"

// handleHealthz answers GET /healthz with 200 and healthzBody.
// Unauthenticated and side-effect-free.
func handleHealthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(healthzBody))
}

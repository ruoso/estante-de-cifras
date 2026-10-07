package server

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// failPinger is a Pinger that is never reachable — the readiness stub for the
// 503 path, so that path is exercised even by a standalone `go test` with no
// database (the real-pool half below skips without the DSN).
type failPinger struct{}

func (failPinger) Ping(context.Context) error { return errors.New("store unreachable") }

// handlerWith builds the real Handler against a fixture app-root and the given
// Pinger, discarding logs.
func handlerWith(t *testing.T, ready Pinger) http.Handler {
	t.Helper()
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	h, err := Handler(logger, newTestAppRoot(t), ready, nil)
	if err != nil {
		t.Fatalf("Handler: %v", err)
	}
	return h
}

// TestReadyzReportsUnreachableStore pins the 503 half of the readiness check
// (service.schema; the check health.go parked) without a database: a Pinger
// that fails makes GET /readyz answer 503 "not ready", while GET /healthz stays
// 200 and I/O-free regardless (DIRECTION §3.3; /healthz is liveness, /readyz is
// readiness — Decisions).
func TestReadyzReportsUnreachableStore(t *testing.T) {
	ts := httptest.NewServer(handlerWith(t, failPinger{}))
	defer ts.Close()

	resp, body := get(t, ts.URL, "/readyz")
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("GET /readyz status = %d, want 503 when the store is unreachable", resp.StatusCode)
	}
	if strings.TrimSpace(body) != "not ready" {
		t.Errorf("GET /readyz body = %q, want \"not ready\"", body)
	}

	resp, body = get(t, ts.URL, "/healthz")
	if resp.StatusCode != http.StatusOK || strings.TrimSpace(body) != "ok" {
		t.Errorf("GET /healthz = %d %q with an unreachable store, want 200 ok (liveness is I/O-free)", resp.StatusCode, body)
	}
}

// TestReadyzAgainstRealPostgres pins the 200 half against a reachable pool and
// the 503 half once it is closed, through httptest with a real pgxpool — the
// readiness check against the compose Postgres (ESTANTE_TEST_DATABASE_URL). It
// skips without the DSN so a standalone `go test` stays green.
func TestReadyzAgainstRealPostgres(t *testing.T) {
	dsn := os.Getenv("ESTANTE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("ESTANTE_TEST_DATABASE_URL is unset; this behavior test needs the compose Postgres (scripts/gate provides it)")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	// Closed explicitly below to drive the 503 path; a second Close is a no-op.
	defer pool.Close()

	ts := httptest.NewServer(handlerWith(t, pool))
	defer ts.Close()

	resp, body := get(t, ts.URL, "/readyz")
	if resp.StatusCode != http.StatusOK {
		t.Errorf("GET /readyz status = %d, want 200 against a reachable pool", resp.StatusCode)
	}
	if strings.TrimSpace(body) != "ready" {
		t.Errorf("GET /readyz body = %q, want \"ready\"", body)
	}

	pool.Close()

	resp, body = get(t, ts.URL, "/readyz")
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("GET /readyz status = %d, want 503 once the pool is closed", resp.StatusCode)
	}
	if strings.TrimSpace(body) != "not ready" {
		t.Errorf("GET /readyz body = %q, want \"not ready\"", body)
	}
}

package server

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestHealthzThroughRealHandler pins the .tji note's "the health check
// through httptest" and DIRECTION §3.6's net/http: it assembles the real
// handler (mux + logging middleware + /healthz) and, through httptest, makes
// GET /healthz and asserts 200, the fixed body, and that exactly one
// metadata-only line was logged.
func TestHealthzThroughRealHandler(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	h, err := Handler(logger, newTestAppRoot(t), okPinger{}, nil)
	if err != nil {
		t.Fatalf("Handler: %v", err)
	}
	ts := httptest.NewServer(h)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatalf("GET /healthz: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if string(body) != healthzBody {
		t.Errorf("body = %q, want %q", body, healthzBody)
	}

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 1 {
		t.Fatalf("want exactly one log line, got %d:\n%s", len(lines), buf.String())
	}

	var entry map[string]any
	if err := json.Unmarshal([]byte(lines[0]), &entry); err != nil {
		t.Fatalf("log line is not valid JSON: %v", err)
	}
	if entry["method"] != http.MethodGet || entry["path"] != "/healthz" {
		t.Errorf("logged %v %v, want GET /healthz", entry["method"], entry["path"])
	}
	if got, ok := entry["status"].(float64); !ok || int(got) != http.StatusOK {
		t.Errorf("status = %v, want 200", entry["status"])
	}
}

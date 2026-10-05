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

// TestLogRequestsLogsMetadataOnlyNeverBodyOrSecret pins the "log the
// metadata, never a body or a secret" rule (DIRECTION §3.3; the .tji note's
// "the log line carries method, path, status and duration and never a body").
// The request carries a song-like body written for this fixture — never
// someone else's words — plus Authorization/Cookie headers and an email in
// the query string; none of them may appear in the logged line.
func TestLogRequestsLogsMetadataOnlyNeverBodyOrSecret(t *testing.T) {
	const songBody = "Minha canção de teste\nDó Sol Lá Fá\nversinho inventado só pra prova\n"
	const authToken = "Bearer sekrit-token-abc123"
	const cookieValue = "session=do-not-log-me"
	const email = "cantora@example.test"

	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	stub := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body) // drain as a real handler would
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("a response body that must also stay out of the log"))
	})

	req := httptest.NewRequest(http.MethodPost, "/songs?email="+email, strings.NewReader(songBody))
	req.Header.Set("Authorization", authToken)
	req.Header.Set("Cookie", cookieValue)
	rec := httptest.NewRecorder()

	LogRequests(logger, stub).ServeHTTP(rec, req)

	line := strings.TrimSpace(buf.String())
	if strings.Contains(line, "\n") {
		t.Fatalf("want exactly one log line, got more:\n%s", line)
	}

	var entry map[string]any
	if err := json.Unmarshal([]byte(line), &entry); err != nil {
		t.Fatalf("log line is not valid JSON: %v\n%s", err, line)
	}

	if entry["method"] != http.MethodPost {
		t.Errorf("method = %v, want POST", entry["method"])
	}
	if entry["path"] != "/songs" {
		t.Errorf("path = %v, want /songs (no query string)", entry["path"])
	}
	if got, ok := entry["status"].(float64); !ok || int(got) != http.StatusCreated {
		t.Errorf("status = %v, want 201", entry["status"])
	}
	if _, ok := entry["duration"]; !ok {
		t.Error("line carries no duration")
	}

	for _, secret := range []string{
		songBody,
		"sekrit-token-abc123",
		"do-not-log-me",
		email,
		"email=",      // the query string as a whole
		"response body", // the stub's response body
	} {
		if strings.Contains(line, secret) {
			t.Errorf("log line leaked %q:\n%s", secret, line)
		}
	}
}

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
		"email=",        // the query string as a whole
		"response body", // the stub's response body
	} {
		if strings.Contains(line, secret) {
			t.Errorf("log line leaked %q:\n%s", secret, line)
		}
	}
}

// TestRedactLinkToken pins workflow 13 "never logged", service.recovery_email
// Constraint 6 and DIRECTION §3.3 as LogRequests cites it: every path under an
// emailed-link route (linkRoutes) — with a trailing slash, below it, or in a
// non-clean form the router 301s — logs as /<route>/{token}; every other path
// is logged unchanged, raw.
func TestRedactLinkToken(t *testing.T) {
	const tok = "c2lnbi1pbi1pZA.c2lnbmF0dXJlLWhhbGY"
	redacted := []struct{ in, want string }{
		{"/sign-in/" + tok, "/sign-in/{token}"},
		{"/sign-in/" + tok + "/", "/sign-in/{token}"},
		{"/sign-in/" + tok + "/x", "/sign-in/{token}"},
		{"/recovery-email/" + tok, "/recovery-email/{token}"},
		{"/recovery-email/" + tok + "/", "/recovery-email/{token}"},
		{"/recovery-email/" + tok + "/x", "/recovery-email/{token}"},
		{"//sign-in/" + tok, "/sign-in/{token}"},
		{"/./sign-in/" + tok, "/sign-in/{token}"},
		{"/b/../sign-in/" + tok, "/sign-in/{token}"},
		{"/sign-in/" + tok + "/..", "/sign-in/{token}"},
	}
	for _, c := range redacted {
		got := redactLinkToken(c.in)
		if got != c.want {
			t.Errorf("redactLinkToken(%q) = %q, want %q", c.in, got, c.want)
		}
		if strings.Contains(got, tok) {
			t.Errorf("redactLinkToken(%q) leaked the token: %q", c.in, got)
		}
	}
	for _, p := range []string{
		"/sign-in", "/sign-in/", "/signin/" + tok, "/sign-in-help/" + tok,
		"/api/auth/email/redeem", "/b/abc", "/healthz",
	} {
		if got := redactLinkToken(p); got != p {
			t.Errorf("redactLinkToken(%q) = %q, want it unchanged", p, got)
		}
	}
	// One list of link routes (Constraint 3): every route the shell serves as
	// a link page is redacted by construction.
	for _, route := range linkRoutes {
		in := "/" + route + "/" + tok
		if got, want := redactLinkToken(in), "/"+route+"/{token}"; got != want {
			t.Errorf("redactLinkToken(%q) = %q, want %q", in, got, want)
		}
	}
}

// TestLogRequestsRedactsLinkToken pins the wiring at the HTTP edge: a sign-in
// link page opened with a trailing slash produces exactly one metadata line
// whose path is /sign-in/{token}, with no token in it.
func TestLogRequestsRedactsLinkToken(t *testing.T) {
	const tok = "c2lnbi1pbi1pZA.c2lnbmF0dXJlLWhhbGY"
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	stub := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/sign-in/"+tok+"/", nil)
	LogRequests(logger, stub).ServeHTTP(httptest.NewRecorder(), req)

	line := strings.TrimSpace(buf.String())
	if strings.Contains(line, "\n") {
		t.Fatalf("want exactly one log line, got more:\n%s", line)
	}
	if strings.Contains(line, tok) {
		t.Errorf("the log line contains the token:\n%s", line)
	}
	var entry map[string]any
	if err := json.Unmarshal([]byte(line), &entry); err != nil {
		t.Fatalf("log line is not valid JSON: %v\n%s", err, line)
	}
	if entry["path"] != "/sign-in/{token}" {
		t.Errorf("path = %v, want /sign-in/{token}", entry["path"])
	}
}

package server

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// testShell is a tiny purpose-written app shell standing in for the built
// index.html; it carries a marker the SPA-fallback cases assert on. It is the
// service's own fixture, not the app's bundle — this package serves bytes and
// shares no code with the app (DIRECTION §3.6 line 288).
const testShell = "<!doctype html><html><body><div id=\"root\" data-shell=\"estante-test\"></div></body></html>\n"

// the hashed asset's filename in the fixture, standing in for Vite's
// content-hashed assets/index-<hash>.js.
const testAsset = "assets/app-abc123.js"

// newTestAppRoot writes a minimal app-root fixture (the files service.serve_app
// must serve: the shell, a hashed asset, the service worker, a workbox chunk
// and the manifest) to a temp dir and returns its path. Shared by the app and
// health behavior tests, both of which build the real Handler against it.
func newTestAppRoot(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	write := func(name, content string) {
		full := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatalf("mkdir for %s: %v", name, err)
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}
	write("index.html", testShell)
	write(testAsset, "export const x = 1;\n")
	write("sw.js", "/* service worker */\n")
	write("workbox-deadbeef.js", "/* workbox runtime */\n")
	write("manifest.webmanifest", `{"name":"Estante de Cifras"}`)
	write("icon-192.png", "\x89PNG\r\n\x1a\n fixture icon bytes")
	return dir
}

// newTestHandler builds the real Handler against a fresh fixture app-root,
// discarding the log output. It fails the test if Handler errors (a built
// fixture always has index.html).
func newTestHandler(t *testing.T) http.Handler {
	t.Helper()
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	h, err := Handler(logger, newTestAppRoot(t))
	if err != nil {
		t.Fatalf("Handler: %v", err)
	}
	return h
}

// get makes a GET against the test server and returns the response with its
// body already read as a string.
func get(t *testing.T, base, path string) (*http.Response, string) {
	t.Helper()
	resp, err := http.Get(base + path)
	if err != nil {
		t.Fatalf("GET %s: %v", path, err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	return resp, string(body)
}

// TestAppServedAtRoot pins "the built app at the root" (DIRECTION §3.3 lines
// 159–160) and the SPA fallback for the app's own /b/{book} deep links
// (api/openapi.yaml:30-36): GET / is the shell, and GET /b/demo is the same
// shell with 200.
func TestAppServedAtRoot(t *testing.T) {
	ts := httptest.NewServer(newTestHandler(t))
	defer ts.Close()

	resp, body := get(t, ts.URL, "/")
	if resp.StatusCode != http.StatusOK {
		t.Errorf("GET / status = %d, want 200", resp.StatusCode)
	}
	if body != testShell {
		t.Errorf("GET / body = %q, want the fixture shell", body)
	}

	resp, body = get(t, ts.URL, "/b/demo")
	if resp.StatusCode != http.StatusOK {
		t.Errorf("GET /b/demo status = %d, want 200 (SPA fallback)", resp.StatusCode)
	}
	if body != testShell {
		t.Errorf("GET /b/demo body = %q, want the fixture shell (SPA fallback)", body)
	}
}

// TestApiNamespaceBesideApp pins "the API beneath" (DIRECTION §3.3 line 170,
// one origin): GET /api/not-a-route 404s (no handler yet) but still carries the
// origin-wide noindex header, and GET /healthz still answers 200 beside the
// app — proving the app handler at / neither swallows the /api namespace nor
// the /healthz route.
func TestApiNamespaceBesideApp(t *testing.T) {
	ts := httptest.NewServer(newTestHandler(t))
	defer ts.Close()

	resp, _ := get(t, ts.URL, "/api/not-a-route")
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("GET /api/not-a-route status = %d, want 404", resp.StatusCode)
	}
	if got := resp.Header.Get("X-Robots-Tag"); got != "noindex" {
		t.Errorf("GET /api/not-a-route X-Robots-Tag = %q, want noindex", got)
	}

	resp, body := get(t, ts.URL, "/healthz")
	if resp.StatusCode != http.StatusOK {
		t.Errorf("GET /healthz status = %d, want 200", resp.StatusCode)
	}
	if strings.TrimSpace(body) != "ok" {
		t.Errorf("GET /healthz body = %q, want ok", body)
	}
}

// TestCacheHeaders pins the PWA update story (vite.config.js:36-69): the
// service worker and shell revalidate while the content-hashed bundle is
// immutable, and the manifest carries its explicit content type.
func TestCacheHeaders(t *testing.T) {
	ts := httptest.NewServer(newTestHandler(t))
	defer ts.Close()

	for _, path := range []string{"/sw.js", "/"} {
		resp, _ := get(t, ts.URL, path)
		if got := resp.Header.Get("Cache-Control"); got != cacheRevalidate {
			t.Errorf("GET %s Cache-Control = %q, want %q", path, got, cacheRevalidate)
		}
	}

	resp, _ := get(t, ts.URL, "/"+testAsset)
	if got := resp.Header.Get("Cache-Control"); got != cacheImmutable {
		t.Errorf("GET /%s Cache-Control = %q, want %q", testAsset, got, cacheImmutable)
	}

	resp, _ = get(t, ts.URL, "/manifest.webmanifest")
	if got := resp.Header.Get("Cache-Control"); got != cacheRevalidate {
		t.Errorf("GET /manifest.webmanifest Cache-Control = %q, want %q", got, cacheRevalidate)
	}
	if got := resp.Header.Get("Content-Type"); got != "application/manifest+json" {
		t.Errorf("GET /manifest.webmanifest Content-Type = %q, want application/manifest+json", got)
	}
}

// TestIconContentType pins that a PWA icon served at the dist root carries an
// image content type (shell.pwa: the browser's install UI and the e2e-web
// installable check need image/png, not octet-stream) and revalidates with the
// shell, since it is served under its own un-fingerprinted name.
func TestIconContentType(t *testing.T) {
	ts := httptest.NewServer(newTestHandler(t))
	defer ts.Close()

	resp, _ := get(t, ts.URL, "/icon-192.png")
	if resp.StatusCode != http.StatusOK {
		t.Errorf("GET /icon-192.png status = %d, want 200", resp.StatusCode)
	}
	if got := resp.Header.Get("Content-Type"); got != "image/png" {
		t.Errorf("GET /icon-192.png Content-Type = %q, want image/png", got)
	}
	if got := resp.Header.Get("Cache-Control"); got != cacheRevalidate {
		t.Errorf("GET /icon-192.png Cache-Control = %q, want %q", got, cacheRevalidate)
	}
}

// TestNoIndexOnEveryResponse pins DIRECTION §3.3 line 180: X-Robots-Tag:
// noindex on every response — the shell, /healthz, a hashed asset, and the
// /api 404 — proving the policy is origin-wide, not per-handler.
func TestNoIndexOnEveryResponse(t *testing.T) {
	ts := httptest.NewServer(newTestHandler(t))
	defer ts.Close()

	for _, path := range []string{"/", "/healthz", "/" + testAsset, "/api/not-a-route"} {
		resp, _ := get(t, ts.URL, path)
		if got := resp.Header.Get("X-Robots-Tag"); got != "noindex" {
			t.Errorf("GET %s X-Robots-Tag = %q, want noindex", path, got)
		}
	}
}

// TestMissingAssetIs404 pins that a missing asset fails loudly rather than
// being masked as the HTML shell (service.serve_app Constraints, SPA
// fallback): a path under assets/ and a path that names a file with an
// extension both 404 when absent, while a bare navigation falls back.
func TestMissingAssetIs404(t *testing.T) {
	ts := httptest.NewServer(newTestHandler(t))
	defer ts.Close()

	for _, path := range []string{"/assets/missing-deadbeef.js", "/favicon.ico"} {
		resp, body := get(t, ts.URL, path)
		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("GET %s status = %d, want 404", path, resp.StatusCode)
		}
		if strings.Contains(body, "data-shell") {
			t.Errorf("GET %s returned the HTML shell, want a 404", path)
		}
	}
}

// TestFailFastOnMissingBundle pins the missing-bundle requirement: building the
// handler against an app-root with no index.html returns an error, not a
// booting server.
func TestFailFastOnMissingBundle(t *testing.T) {
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	empty := t.TempDir()
	if _, err := Handler(logger, empty); err == nil {
		t.Fatal("Handler against an app-root with no index.html: want error, got nil")
	}
}

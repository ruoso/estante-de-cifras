package server

import (
	"bytes"
	"fmt"
	"io/fs"
	"net/http"
	"path"
	"strings"
	"time"
)

// Cache-Control policies for the served bundle. The registration entry
// (sw.js), the shell (index.html, and the SPA-fallback response) and the
// manifest must revalidate so a deploy's new service worker and shell reach
// installed clients; the content-hashed bundle (assets/* and workbox-*.js) is
// safe to cache for a year because Vite fingerprints those filenames
// (vite.config.js; service.serve_app Decisions).
const (
	cacheRevalidate = "no-cache"
	cacheImmutable  = "public, max-age=31536000, immutable"
)

// appHandler serves the built PWA from a directory on disk (os.DirFS over the
// configured app-root, default /srv/app where the Dockerfile placed app/dist).
// It reads the app's bytes only — it never imports or builds the app — keeping
// the share-no-code boundary (DIRECTION §3.6 line 288). stdlib only: no
// go:embed of the bundle, no third-party file server.
type appHandler struct {
	fsys fs.FS
}

// newAppHandler opens the app-root and fails fast if it has no index.html, so
// a misbuilt image dies loudly at start-up rather than booting to serve 404s
// (service.serve_app Constraints).
func newAppHandler(fsys fs.FS) (*appHandler, error) {
	info, err := fs.Stat(fsys, "index.html")
	if err != nil {
		return nil, fmt.Errorf("server: app root has no index.html (is the PWA built into the image?): %w", err)
	}
	if info.IsDir() {
		return nil, fmt.Errorf("server: app root's index.html is a directory, not the app shell")
	}
	return &appHandler{fsys: fsys}, nil
}

// reservedPrefixes are the origin's non-app namespaces (api/openapi.yaml:30-36):
// the JSON API beneath /api and git's smart HTTP beneath /git. A path under one
// of these is never the app's — the later service.* tasks (service.schema,
// service.books, service.git_http, …) register handlers for them, winning over
// the catch-all / by ServeMux's longest-prefix match. Until then such a path
// 404s rather than falling back to the shell, so the app at / never swallows
// the API and git namespaces (DIRECTION §3.3 line 170, one origin).
var reservedPrefixes = []string{"/api", "/git"}

// linkRoutes are the app's own emailed-link routes: the sign-in link
// (/sign-in/<token>) and the recovery-email confirm link
// (/recovery-email/<token>). Their token is base64url(id).base64url(hmac)
// (internal/emaillink), so it holds a dot that path.Ext reads as an extension.
// A path under one of these is always a navigation, so a device that has never
// loaded the app (no service worker yet) still boots the shell from the link
// (workflow 13 L48, "on any device"). An explicit allowlist rather than a
// looser extension rule, so a missing asset elsewhere still 404s
// (account.recovery_email Decisions §1). The same list drives the request log's
// redaction (redactLinkToken, logging.go): a path served as a link page never
// has its token logged.
var linkRoutes = []string{"sign-in", "recovery-email"}

// ServeHTTP serves a real file when the path resolves to one, and otherwise
// either falls back to the app shell (a navigation such as the app's own
// /b/{book} deep links — so the single-page app boots and client-routes) or
// 404s (a path in a reserved namespace, a missing asset under assets/, or any
// path that names a file with an extension — so a broken asset, or a route
// that belongs to the API or git, fails loudly rather than being masked as the
// HTML shell). service.serve_app Constraints (SPA fallback).
func (a *appHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if isReserved(r.URL.Path) {
		http.NotFound(w, r)
		return
	}
	name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
	if name == "" {
		a.serveFile(w, r, "index.html")
		return
	}
	if a.isFile(name) {
		a.serveFile(w, r, name)
		return
	}
	if isAssetRequest(name) {
		http.NotFound(w, r)
		return
	}
	a.serveFile(w, r, "index.html")
}

// isFile reports whether name resolves to a real, non-directory file in the
// bundle. An invalid path (fs.Stat rejects one that escapes the root) reads as
// "not a file", so a traversal attempt falls through to the asset/navigation
// decision and ultimately 404s.
func (a *appHandler) isFile(name string) bool {
	info, err := fs.Stat(a.fsys, name)
	return err == nil && !info.IsDir()
}

// serveFile writes name from the bundle with its explicit content type and
// cache policy. The whole file is read into memory (the bundle's files are
// small) and handed to http.ServeContent, which honours the already-set
// Content-Type and handles conditional requests. A read failure (a missing
// index.html at fallback time) is a 404.
func (a *appHandler) serveFile(w http.ResponseWriter, r *http.Request, name string) {
	data, err := fs.ReadFile(a.fsys, name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	modTime := time.Time{}
	if info, err := fs.Stat(a.fsys, name); err == nil {
		modTime = info.ModTime()
	}
	w.Header().Set("Content-Type", contentType(name))
	w.Header().Set("Cache-Control", cacheControl(name))
	http.ServeContent(w, r, name, modTime, bytes.NewReader(data))
}

// isReserved reports whether a request path lies in a non-app namespace (/api
// or /git, exactly or as a prefix), which the app handler declines so those
// namespaces never fall back to the shell.
func isReserved(urlPath string) bool {
	for _, prefix := range reservedPrefixes {
		if urlPath == prefix || strings.HasPrefix(urlPath, prefix+"/") {
			return true
		}
	}
	return false
}

// isAssetRequest reports whether a path that did not resolve to a real file
// should 404 rather than fall back to the shell: a path under assets/, or any
// path that names a file with an extension. A navigation (no extension, not
// under assets/, or any path under an emailed-link route) falls back to
// index.html instead.
func isAssetRequest(name string) bool {
	if isLinkRoute(name) {
		return false
	}
	return strings.HasPrefix(name, "assets/") || path.Ext(name) != ""
}

// isLinkRoute reports whether a bundle-relative path lies beneath one of the
// app's emailed-link routes (a first segment in linkRoutes, with a token
// after it).
func isLinkRoute(name string) bool {
	for _, route := range linkRoutes {
		if strings.HasPrefix(name, route+"/") {
			return true
		}
	}
	return false
}

// contentType returns the explicit Content-Type for a bundle path. Go's mime
// table does not know .webmanifest, and the service worker files must be
// JavaScript; both are set here rather than left to content sniffing
// (service.serve_app Constraints, correct content types).
func contentType(name string) string {
	switch {
	case strings.HasSuffix(name, ".webmanifest"):
		return "application/manifest+json"
	case strings.HasSuffix(name, ".js"):
		return "text/javascript; charset=utf-8"
	case strings.HasSuffix(name, ".css"):
		return "text/css; charset=utf-8"
	case strings.HasSuffix(name, ".html"):
		return "text/html; charset=utf-8"
	case strings.HasSuffix(name, ".json"):
		return "application/json"
	case strings.HasSuffix(name, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(name, ".png"):
		// The PWA's manifest icons and the favicon/apple-touch icon, served at
		// the dist root by fixed name (app/public/, shell.pwa). Go's mime table
		// knows .png, but the content type is pinned here with the rest so the
		// bundle's types are not left to content sniffing.
		return "image/png"
	}
	return "application/octet-stream"
}

// cacheControl returns the Cache-Control policy for a bundle path: immutable
// for the content-hashed bundle (assets/* and workbox-*.js), revalidate for
// everything else (the shell, the service worker, the manifest, and the
// SPA-fallback response, all served under their own un-fingerprinted names).
func cacheControl(name string) string {
	base := path.Base(name)
	if strings.HasPrefix(name, "assets/") ||
		(strings.HasPrefix(base, "workbox-") && strings.HasSuffix(base, ".js")) {
		return cacheImmutable
	}
	return cacheRevalidate
}

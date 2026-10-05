package server

import "net/http"

// NoIndex wraps h so every response carries X-Robots-Tag: noindex. DIRECTION
// §3.3 (line 180): "nothing the service serves is indexed by search engines
// (noindex)." Set as a top-level middleware, before the mux dispatches, so the
// header lands on every response the service makes — the app shell, the static
// assets, /healthz, every 404, and every /api and /git route a later task adds
// — and no route can ship without it by accident. A response header (not a
// <meta> tag) covers assets, the API and git too, and never touches the app's
// built index.html (editing which would breach share-no-code; service.serve_app
// Decisions).
func NoIndex(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Robots-Tag", "noindex")
		h.ServeHTTP(w, r)
	})
}

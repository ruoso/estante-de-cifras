// Package server assembles the service's HTTP handler: a net/http.ServeMux
// with the routes the skeleton serves, the request-logging middleware that
// refuses bodies, and the health handler. Later service.* tasks register
// their own routes on the mux; this package is the frame they hang on.
package server

import (
	"log/slog"
	"net/http"
)

// Handler builds the service's HTTP handler: a standard-library ServeMux
// (method-and-path patterns, no third-party router — DIRECTION §3.6) behind
// the request-logging middleware. Later service.* tasks register their routes
// on a mux assembled the same way.
func Handler(logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealthz)
	return LogRequests(logger, mux)
}

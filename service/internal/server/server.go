// Package server assembles the service's HTTP handler: a net/http.ServeMux
// serving the built PWA at / with the health handler beside it, beneath the
// origin-wide noindex and request-logging middlewares. Later service.* tasks
// register their own /api and /git routes on the mux; this package is the
// frame they hang on, and the origin-wide policies they inherit.
package server

import (
	"context"
	"log/slog"
	"net/http"
	"os"
)

// Pinger reports whether the service's backing store is reachable. The pgxpool
// the service opens (internal/db) satisfies it, so the server package stays
// free of a direct Postgres dependency — it knows only that readiness is "can
// we reach the store" (DIRECTION §3.6, the component boundary).
type Pinger interface {
	Ping(ctx context.Context) error
}

// Handler builds the service's HTTP handler: a standard-library ServeMux
// (method-and-path patterns, no third-party router — DIRECTION §3.6) serving
// the built PWA at / with the liveness and readiness checks beside it, beneath
// two origin-wide middlewares — X-Robots-Tag: noindex on every response, then
// request logging. The app is read from appRoot on disk (service.serve_app);
// Handler fails fast if that directory has no index.html. ready is pinged by
// GET /readyz; it is the Postgres pool in production. Later service.* tasks
// register their /api and /git routes on a mux assembled the same way —
// ServeMux's longest-prefix match lets those win over the app's / while every
// response still inherits the noindex policy.
//
// api carries the collaborators the sign-in endpoints need (the pool, the
// Mailer, the signing secret, the public origin). It is nil for the skeleton
// and the app/health behavior tests, which exercise no /api route; when it is
// given, Handler registers the emailed sign-in link endpoints
// (service.email_links).
func Handler(logger *slog.Logger, appRoot string, ready Pinger, api *APIDeps) (http.Handler, error) {
	app, err := newAppHandler(os.DirFS(appRoot))
	if err != nil {
		return nil, err
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealthz)
	mux.HandleFunc("GET /readyz", handleReadyz(ready))
	if api != nil {
		// The emailed sign-in link: request one, redeem it into a session
		// (workflow 13; api/openapi.yaml /api/auth/email/*).
		mux.HandleFunc("POST /api/auth/email/request", handleRequestEmailLink(api))
		mux.HandleFunc("POST /api/auth/email/redeem", handleRedeemEmailLink(api))
		// Passkeys: register and sign in with a passkey, and the account's
		// passkey list (workflow 13; api/openapi.yaml /api/auth/passkey/* and
		// /api/account/passkeys). Registered only when the relying party is wired.
		if api.Passkeys != nil {
			mux.HandleFunc("POST /api/auth/passkey/register/begin", handleRegisterPasskeyBegin(api))
			mux.HandleFunc("POST /api/auth/passkey/register/finish", handleRegisterPasskeyFinish(api))
			mux.HandleFunc("POST /api/auth/passkey/authenticate/begin", handleAuthenticatePasskeyBegin(api))
			mux.HandleFunc("POST /api/auth/passkey/authenticate/finish", handleAuthenticatePasskeyFinish(api))
			mux.HandleFunc("GET /api/account/passkeys", handleListPasskeys(api))
			mux.HandleFunc("DELETE /api/account/passkeys/{passkeyId}", handleRemovePasskey(api))
		}
	}
	// The app at /: ServeMux routes everything not matched by a more specific
	// pattern (GET /healthz and /readyz now; /api/… and /git/… later) to the
	// PWA, which serves a real asset or falls back to the shell for a
	// client-side route.
	mux.Handle("/", app)

	return LogRequests(logger, NoIndex(mux)), nil
}

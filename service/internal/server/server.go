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
		// The account-screen session management: sign out of this device, list
		// the signed-in devices, and sign one out from another (workflow 13;
		// api/openapi.yaml /api/auth/signout and /api/account/sessions). These
		// need only the pool and the session seam, not the passkey relying
		// party, so they are routed whenever the API is wired.
		mux.HandleFunc("POST /api/auth/signout", handleSignOut(api))
		mux.HandleFunc("GET /api/account/sessions", handleListSessions(api))
		mux.HandleFunc("DELETE /api/account/sessions/{sessionId}", handleRevokeSession(api))
		// Books: create, list, delete and fork a book — a registry row plus a
		// bare repository on the volume (workflows 7, 11; api/openapi.yaml
		// /api/books and /api/books/{bookId}[/fork]). These need only the pool and
		// the books volume, so they are routed whenever the API is wired
		// (service.books).
		mux.HandleFunc("GET /api/books", handleListBooks(api))
		mux.HandleFunc("POST /api/books", handleCreateBook(api))
		mux.HandleFunc("DELETE /api/books/{bookId}", handleDeleteBook(api))
		mux.HandleFunc("POST /api/books/{bookId}/fork", handleForkBook(api))
		// The shelf change check: one batched request carrying each shelf book's
		// id and the head the device has, answered with only the books that moved
		// or the caller can no longer access (workflow 8; DIRECTION §3.3;
		// api/openapi.yaml /api/shelf/change-check). It reads one ref per
		// accessible book and changes no state, so it needs only the pool and the
		// books volume (service.change_check).
		mux.HandleFunc("POST /api/shelf/change-check", handleChangeCheck(api))
		// Sharing: a book's members and invitations (workflow 10; api/openapi.yaml
		// /api/books/{bookId}/members[/{userId}], /invitations[/{invitationId}]
		// and /api/invitations/{token}/accept). These move registry rows and
		// compose the shareable link; they need only the pool and the books
		// volume (for the accepted book's README title), so they are routed
		// whenever the API is wired (service.sharing).
		mux.HandleFunc("GET /api/books/{bookId}/members", handleListMembers(api))
		mux.HandleFunc("PATCH /api/books/{bookId}/members/{userId}", handleChangeMemberRole(api))
		mux.HandleFunc("DELETE /api/books/{bookId}/members/{userId}", handleRemoveMember(api))
		mux.HandleFunc("GET /api/books/{bookId}/invitations", handleListInvitations(api))
		mux.HandleFunc("POST /api/books/{bookId}/invitations", handleCreateInvitation(api))
		mux.HandleFunc("DELETE /api/books/{bookId}/invitations/{invitationId}", handleWithdrawInvitation(api))
		mux.HandleFunc("POST /api/invitations/{token}/accept", handleAcceptInvitation(api))
		// Git over HTTP: the service speaks git's smart HTTP protocol itself for
		// the three routes under /git/{bookId} — the ref advertisement and the two
		// stateless-rpc commands (workflow 14; api/openapi.yaml /git/{bookId}/…).
		// They authenticate the session and the membership and refuse before git
		// starts, then stream to and from git (service.git_http). Explicit
		// patterns win over the "/" SPA catch-all; an unmatched /git path still
		// 404s via app.go's reserved namespace.
		mux.HandleFunc("GET /git/{bookId}/info/refs", handleGitInfoRefs(api))
		mux.HandleFunc("POST /git/{bookId}/git-upload-pack", handleGitUploadPack(api))
		mux.HandleFunc("POST /git/{bookId}/git-receive-pack", handleGitReceivePack(api))
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

package server

import (
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"estantedecifras.app/service/internal/book"
	"estantedecifras.app/service/internal/config"
	"estantedecifras.app/service/internal/session"
)

// This file implements git over HTTP (api/openapi.yaml /git/{bookId}/…;
// DIRECTION §3.6 "Git over HTTP"; workflow 14). The service speaks git's smart
// HTTP protocol itself — three routes framing the two commands it means to run,
// never git http-backend and CGI (service.git_http Decisions). Around git, the
// service owns the HTTP: it authenticates the session and the book membership
// and refuses with a clear status before git is ever spawned; it passes the
// client's Git-Protocol header through as GIT_PROTOCOL so protocol v2 works; it
// decompresses a Content-Encoding: gzip body; it caps the body and bounds each
// invocation with a deadline; it kills git when the client goes away; and on a
// push it sets the ESTANTE_* environment the pre-receive hook inherits and
// points git at the hooks directory, then refreshes the book's size_bytes. The
// protocol, the packs, ref locking, the quarantine and the hook stay git's own.
//
// The pure framing helpers (the service header encoder, the Git-Protocol
// validator, the gzip/size-cap body wrapper, the ESTANTE_* environment builder)
// are plain functions unit-tested without a DB or git; the act of spawning git
// and streaming to/from it is book.Store.Serve (service.git_http Decision).

// The two git smart-HTTP services, as the ?service= query value and the
// GitService enum name them (api/openapi.yaml GitService). The git subcommand
// drops the "git-" prefix; the media types use the subcommand.
const (
	svcUploadPack  = "git-upload-pack"
	svcReceivePack = "git-receive-pack"

	roleOwner  = "owner"
	roleEditor = "editor"
	roleReader = "reader"
)

// handleGitInfoRefs implements GET /git/{bookId}/info/refs?service=… (gitInfoRefs):
// it runs the named git command with --stateless-rpc --advertise-refs and writes
// the service header — "# service=…" as a pkt-line, then a flush — before git's
// output. A fetch advertisement needs any member; a push advertisement needs an
// editor or the owner (a reader is 403) and refuses an over-quota account (413),
// all before git starts.
func handleGitInfoRefs(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		bookID := r.PathValue("bookId")
		service := r.URL.Query().Get("service")
		if service != svcUploadPack && service != svcReceivePack {
			// Only the two smart services are served; no dumb-HTTP fallback
			// (service.git_http Constraint 11).
			writeError(w, http.StatusNotFound, "not_found", "No such git service.")
			return
		}
		_, access, ok := gitAuthorize(w, r, api, bookID)
		if !ok {
			return
		}
		if service == svcReceivePack {
			if _, ok := api.authorizePush(w, r, access); !ok {
				return
			}
		}

		ctx, cancel := context.WithTimeout(r.Context(), api.gitDeadline())
		defer cancel()

		w.Header().Set("Content-Type", "application/x-git-"+gitSubcommand(service)+"-advertisement")
		w.Header().Set("Cache-Control", "no-cache")
		w.WriteHeader(http.StatusOK)
		// The service header is written unconditionally, before git's output and
		// before any protocol v2 advertisement (service.git_http Constraint 3).
		_, _ = w.Write(serviceHeader(service))

		store := book.Store{Root: api.BooksRoot}
		_ = store.Serve(ctx, bookID, book.GitStream{
			Service:       gitSubcommand(service),
			AdvertiseRefs: true,
			Stdout:        w,
			Env:           gitProtocolEnv(r),
		})
		// The header and 200 are already committed; a mid-stream failure (a kill
		// or a git error) leaves the client a truncated advertisement to retry.
		// Nothing is logged as content.
	}
}

// handleGitUploadPack implements POST /git/{bookId}/git-upload-pack
// (gitUploadPack): git upload-pack --stateless-rpc, the request body piped in
// and git's stdout streamed back. Any member may fetch.
func handleGitUploadPack(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		bookID := r.PathValue("bookId")
		if _, _, ok := gitAuthorize(w, r, api, bookID); !ok {
			return
		}
		body, ok := gitRequestBody(w, r, api)
		if !ok {
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), api.gitDeadline())
		defer cancel()

		w.Header().Set("Content-Type", "application/x-git-upload-pack-result")
		w.Header().Set("Cache-Control", "no-cache")

		store := book.Store{Root: api.BooksRoot}
		_ = store.Serve(ctx, bookID, book.GitStream{
			Service: "upload-pack",
			Stdin:   body,
			Stdout:  w,
			Env:     gitProtocolEnv(r),
		})
	}
}

// handleGitReceivePack implements POST /git/{bookId}/git-receive-pack
// (gitReceivePack): git receive-pack --stateless-rpc pointed at the hooks
// directory and carrying the ESTANTE_* environment the pre-receive hook
// inherits, the request body piped in and git's stdout streamed back. An editor
// or the owner may push; a reader is 403; an over-quota owning account is 413 —
// all before git starts. After a push git accepts, the book's recorded on-disk
// size is refreshed so the account quota stays live. A hook (or git) content
// refusal is not an HTTP error — it is carried in git's own channel inside the
// 200 result body (service.git_http Decision; contract lines 664–669).
func handleGitReceivePack(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		bookID := r.PathValue("bookId")
		accountID, access, ok := gitAuthorize(w, r, api, bookID)
		if !ok {
			return
		}
		// The push gate — reader → 403, over-quota owning account → 413 — also
		// yields the live remaining account quota the hook is handed.
		remaining, ok := api.authorizePush(w, r, access)
		if !ok {
			return
		}

		body, ok := gitRequestBody(w, r, api)
		if !ok {
			return
		}

		env := pushEnv(accountID, bookID, access.role, remaining, access.sizeBytes)
		env = append(env, gitProtocolEnv(r)...)

		ctx, cancel := context.WithTimeout(r.Context(), api.gitDeadline())
		defer cancel()

		w.Header().Set("Content-Type", "application/x-git-receive-pack-result")
		w.Header().Set("Cache-Control", "no-cache")

		store := book.Store{Root: api.BooksRoot}
		if serveErr := store.Serve(ctx, bookID, book.GitStream{
			Service:  "receive-pack",
			Stdin:    body,
			Stdout:   w,
			Env:      env,
			HooksDir: api.hooksDir(),
		}); serveErr != nil {
			// A deadlined, killed or failed push changes nothing — git's
			// quarantine left the repository untouched — so size_bytes is not
			// refreshed. The client retries at the next sync (offline-first).
			return
		}

		// The push landed: refresh the recorded on-disk size so the account quota
		// (and the remaining headroom the next push hands the hook) reflects
		// reality (service.git_http Constraint 9). Best effort — a stat or write
		// failure must not turn an accepted push into an error the client sees.
		if size, err := store.Size(bookID); err == nil {
			_, _ = api.DB.Exec(r.Context(), `UPDATE books SET size_bytes = $2 WHERE id = $1`, bookID, size)
		}
	}
}

// gitAuthorize runs the shared pre-git gate: resolve the session (401 if none),
// reject a non-UUID id (404), then resolve the caller's role on a live book
// (404 if there is no such book or the caller is not a member — the two answered
// alike). It returns the account id and the access when the caller passes, and
// writes the refusal and returns ok=false otherwise. Git is never spawned on a
// refusal (DIRECTION §3.6 lines 338–340).
func gitAuthorize(w http.ResponseWriter, r *http.Request, api *APIDeps, bookID string) (string, bookAccess, bool) {
	ctx := r.Context()
	accountID, ok, err := session.Resolve(ctx, api.DB, r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not serve the repository.")
		return "", bookAccess{}, false
	}
	if !ok {
		writeUnauthorized(w)
		return "", bookAccess{}, false
	}
	if !isUUID(bookID) {
		writeError(w, http.StatusNotFound, "not_found", "No such book.")
		return "", bookAccess{}, false
	}
	access, found, err := resolveBookAccess(ctx, api.DB, bookID, accountID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not serve the repository.")
		return "", bookAccess{}, false
	}
	if !found {
		writeError(w, http.StatusNotFound, "not_found", "No such book.")
		return "", bookAccess{}, false
	}
	return accountID, access, true
}

// authorizePush is the extra gate a push request passes beyond membership: a
// reader is 403 (a member whose role is insufficient), and an owning account
// already at its byte cap is 413 — both before git starts. On success it
// returns the owning account's remaining quota (the value the hook is handed as
// ESTANTE_ACCOUNT_BYTES_REMAINING). It writes the refusal and returns ok=false
// when the caller does not pass.
func (api *APIDeps) authorizePush(w http.ResponseWriter, r *http.Request, access bookAccess) (int64, bool) {
	if access.role == roleReader {
		writeError(w, http.StatusForbidden, "forbidden", "A reader cannot push to this book.")
		return 0, false
	}
	remaining, err := api.accountRemainingBytes(r.Context(), access.ownerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not serve the repository.")
		return 0, false
	}
	if remaining <= 0 {
		writeError(w, http.StatusRequestEntityTooLarge, "too_large", "The account is over its storage limit.")
		return 0, false
	}
	return remaining, true
}

// accountRemainingBytes is the owning account's quota headroom — the 200 MB cap
// minus its live owned size_bytes sum, floored at 0. It is the value the gate
// refuses a push on when it is zero and the one the hook is handed as
// ESTANTE_ACCOUNT_BYTES_REMAINING. The quota is always the owner's, since forks
// count against the forker (workflow 14; ownedUsage over owner_id).
func (api *APIDeps) accountRemainingBytes(ctx context.Context, ownerID string) (int64, error) {
	_, sum, err := ownedUsage(ctx, api.DB, ownerID)
	if err != nil {
		return 0, err
	}
	if remaining := maxBytesPerAccount - sum; remaining > 0 {
		return remaining, nil
	}
	return 0, nil
}

// gitRequestBody wraps the request body with the size cap and, when the client
// sent Content-Encoding: gzip, a gzip reader on top — so git reads the
// decompressed bytes while the cap bounds the compressed bytes read off the
// socket (service.git_http Constraints 5, 6). A body whose declared length is
// over the cap is a 413 before git is spawned; an unsupported Content-Encoding
// is a 400. It returns ok=false when it has already answered.
func gitRequestBody(w http.ResponseWriter, r *http.Request, api *APIDeps) (io.Reader, bool) {
	maxBody := api.gitMaxBody()
	if r.ContentLength > maxBody {
		writeError(w, http.StatusRequestEntityTooLarge, "too_large", "That request is too large.")
		return nil, false
	}
	var reader io.Reader = http.MaxBytesReader(w, r.Body, maxBody)
	switch enc := strings.TrimSpace(r.Header.Get("Content-Encoding")); enc {
	case "", "identity":
		// Unwrapped: git reads the body as sent.
	case "gzip":
		gz, err := gzip.NewReader(reader)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body was not valid gzip.")
			return nil, false
		}
		reader = gz
	default:
		writeError(w, http.StatusBadRequest, "bad_request", "Unsupported Content-Encoding.")
		return nil, false
	}
	return reader, true
}

// gitSubcommand drops the "git-" prefix from a service name, yielding the git
// subcommand ("upload-pack"/"receive-pack") and the media-type stem.
func gitSubcommand(service string) string {
	return strings.TrimPrefix(service, "git-")
}

// serviceHeader is the smart-HTTP service header for an info/refs advertisement:
// "# service=<service>\n" as a pkt-line (a 4-hex length prefix counting itself),
// then a flush pkt. It is written before git's --advertise-refs output
// (DIRECTION §3.6 lines 325–327; contract lines 607–615).
func serviceHeader(service string) []byte {
	return []byte(pktLine("# service="+service+"\n") + "0000")
}

// pktLine encodes s as a git pkt-line: a 4-hex-digit length prefix (counting
// the 4 prefix bytes themselves) followed by the payload.
func pktLine(s string) string {
	return fmt.Sprintf("%04x%s", len(s)+4, s)
}

// gitProtocolRe is the restricted shape a Git-Protocol header value must match
// to be passed through: a ":"-separated list of key[=value] tokens over
// letters, digits and a few punctuation characters (e.g. "version=2"). It admits
// no whitespace, newline or shell metacharacter, so the value cannot inject a
// second environment variable or a command (service.git_http Constraint 4).
var gitProtocolRe = regexp.MustCompile(`^[A-Za-z0-9=:/._,+-]+$`)

// sanitizeGitProtocol returns the Git-Protocol value to pass through as
// GIT_PROTOCOL and whether it is safe to pass at all. An empty, over-long or
// malformed/injection-shaped value is dropped (ok=false), never set.
func sanitizeGitProtocol(v string) (string, bool) {
	if v == "" || len(v) > 200 {
		return "", false
	}
	if !gitProtocolRe.MatchString(v) {
		return "", false
	}
	return v, true
}

// gitProtocolEnv is the GIT_PROTOCOL environment the request's Git-Protocol
// header yields, or nil when the header is absent or malformed (so protocol v2
// works without ever injecting a crafted value).
func gitProtocolEnv(r *http.Request) []string {
	if v, ok := sanitizeGitProtocol(r.Header.Get("Git-Protocol")); ok {
		return []string{"GIT_PROTOCOL=" + v}
	}
	return nil
}

// pushEnv is the ESTANTE_* environment the service sets on the git receive-pack
// it spawns, which the pre-receive hook inherits so it checks limits with no
// database connection of its own (DIRECTION §3.6 lines 342–346; service.git_http
// Decision — the names are the git_http↔hook contract). The quota is the
// owner's, accountBytesRemaining already floored at 0; bookBytes is the book's
// current recorded size, so the hook can compute a push's net growth against the
// remaining account quota and the per-book cap.
func pushEnv(accountID, bookID, role string, accountBytesRemaining, bookBytes int64) []string {
	return []string{
		"ESTANTE_USER=" + accountID,
		"ESTANTE_BOOK=" + bookID,
		"ESTANTE_ROLE=" + role,
		"ESTANTE_ACCOUNT_BYTES_REMAINING=" + strconv.FormatInt(accountBytesRemaining, 10),
		"ESTANTE_BOOK_BYTES=" + strconv.FormatInt(bookBytes, 10),
	}
}

// gitDeadline, gitMaxBody and hooksDir fall back to the config defaults when the
// APIDeps field is unset, so a handler built from a partial APIDeps (a test) is
// never given a zero deadline (which would expire immediately) or a zero cap.
func (api *APIDeps) gitDeadline() time.Duration {
	if api.GitDeadline > 0 {
		return api.GitDeadline
	}
	return config.DefaultGitDeadline
}

func (api *APIDeps) gitMaxBody() int64 {
	if api.GitMaxBodyBytes > 0 {
		return api.GitMaxBodyBytes
	}
	return config.DefaultGitMaxBodyBytes
}

func (api *APIDeps) hooksDir() string {
	if api.HooksDir != "" {
		return api.HooksDir
	}
	return config.DefaultHooksDir
}

// access-refused.js — the Worker's one authority on whether a git-over-HTTP
// refusal means the device has lost access to a book (sync.lost_access).
//
// The service authorises every git request before git starts (DIRECTION §3.3
// L338-341: "a request with no access … refused by the service with a clear
// message, git never spawned"). Its status ladder is deliberate
// (service/internal/server/git.go:208,217,231): a request from someone who is no
// longer a member — or for a book that does not exist — is refused 404, while a
// reader who tries to push is refused 403 (still a member). This module reads an
// isomorphic-git HTTP error and says whether it is the 404 lost-access refusal.
//
// Only a 404 is lost access. A 403 (a reader push — still a member), a missing
// response (offline — a thrown `fetch` carries no HTTP status) and any 5xx (the
// service faltered, not a refusal) are NOT lost access: those stay on the
// engine's existing silent-retry path, offline-first (Constraints 1-2). Keeping
// this decision in one pure function makes the engine branch a one-liner and the
// 404-vs-403 boundary unit-testable without a refusing git remote.
//
// Pure, framework-free, Worker-only ESM. Logs nothing (standing rule): it reads
// a status code, never a body.

/**
 * Does this error mean the device has lost access to the book — a definite
 * git-over-HTTP 404 refusal from the service's authorisation gate?
 *
 * isomorphic-git throws an `HttpError` for a non-2xx git response, carrying the
 * HTTP status under `err.data.statusCode` (isomorphic-git 1.x). A 404 is the
 * service's "not a member / no such book" refusal → lost access. A 403 (reader
 * push), a missing status (offline — a thrown `fetch`), and any other status
 * (5xx, a surprise) are NOT lost access.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isAccessRefused(err) {
  return err?.data?.statusCode === 404;
}

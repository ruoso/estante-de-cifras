// access-refused.js — the Worker's one authority on whether a git-over-HTTP
// refusal means the device has lost access to a book (sync.lost_access).
//
// The service authorises every git request before git starts (DIRECTION §3.3
// L338-341: "a request with no access … refused by the service with a clear
// message, git never spawned"). Its status ladder is deliberate
// (service/internal/server/git.go:208,217,231): a request from someone who is no
// longer a member — or for a book that does not exist — is refused 404, while a
// reader who tries to push is refused 403 (still a member). This module reads an
// isomorphic-git HTTP error and says whether it is the 404 lost-access refusal,
// and — a sibling classifier, `takenDownReason` (books.notice_surface) — whether
// it is instead the service's `403 taken_down` refusal, returning the operator's
// copyright-notice reason. The two never overlap: 404 is lost access, the
// taken-down 403 is a distinct halt that still means the caller is a member.
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

/**
 * The operator's take-down reason, when this error is the service's
 * `403 taken_down` refusal (books.notice_surface; service.admin) — otherwise
 * `null`. A take-down is a *distinct* halt from lost access: the caller is still
 * a member, but the service removed the book for a copyright notice (workflow 10
 * §A copyright notice; DIRECTION §3.6), refusing its owner and members git with
 * `403` whose JSON body is `{ code: 'taken_down', message: 'This book has been
 * taken down: <reason>' }` (service/internal/server/git.go:232). A stranger gets
 * a plain 404 and learns nothing, so the reason is book-scoped and authenticated
 * — it rides only on the git refusal, never the change-check.
 *
 * isomorphic-git's `HttpError` carries the stringified response body under
 * `err.data.response` (isomorphic-git 1.x). This reads that body's `code`/
 * `message` — a status line, never song text, logged nowhere (standing rule). It
 * returns `null` for anything that is not the take-down 403: a reader-push 403
 * with no/other body, a 404 (that is `isAccessRefused`'s lost access), a 5xx, a
 * missing response (offline — a thrown `fetch` carries no body), a malformed
 * body, or `null`/`undefined`. So the two classifiers never overlap.
 *
 * @param {unknown} err
 * @returns {string|null}
 */
export function takenDownReason(err) {
  if (err?.data?.statusCode !== 403) return null;
  const { response } = err.data;
  if (typeof response !== 'string') return null;
  let body;
  try {
    body = JSON.parse(response);
  } catch {
    return null;
  }
  if (body?.code !== 'taken_down') return null;
  return typeof body.message === 'string' ? body.message : null;
}

/**
 * Is this error the service's permanent refusal of a READER's push — `403`
 * whose JSON body code is `forbidden` (service/internal/server/git.go:276,
 * `authorizePush`)? It is how a lowered editor learns they can no longer save to
 * a book (books.fork Constraint 6; workflow 10 L83-85): still a member, so the
 * book is still fetched and read, but its unpushed saves can no longer go to it.
 * The engine classifies it `cannot_save` and stops retrying the push.
 *
 * Only that exact refusal counts. A `403 taken_down` (that is `takenDownReason`),
 * a `404` (lost access — `isAccessRefused`), a missing response (offline), a 5xx,
 * a `403` with no or another body: all false. The three classifiers never
 * overlap. Reads the body's `code` only, never logs it (standing rule).
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function readerPushRefused(err) {
  if (err?.data?.statusCode !== 403) return false;
  const { response } = err.data;
  if (typeof response !== 'string') return false;
  try {
    return JSON.parse(response)?.code === 'forbidden';
  } catch {
    return false;
  }
}

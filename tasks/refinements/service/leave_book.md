# service.leave_book — A member leaves a book

## TaskJuggler

[`tasks/30-service.tji:97-102`](../../30-service.tji), `task service.leave_book`
("A member leaves a book"). `depends !sharing, design.leave_book`, and so also
the parent `service` task's foundation dependencies. Downstream:
`books.leave` (`tasks/65-books.tji:108-113`, `depends !online,
service.leave_book, design.leave_book`) builds the *Leave this book* verb, its
confirmation and the *Mine on Estante* row's **Leave** on the endpoint this
task adds.

## Effort estimate

`1d` (from the `.tji`). One contract operation, one handler of a dozen lines
on the existing `resolveBookAccess` seam, one route, behavior tests beside
`TestRemoveMember` and one e2e-api case. No migration, no new runtime
dependency, no configuration.

## Repository

**estante-de-cifras.** Not a cifra.md task (the note does not start with
`cifra.md:`). Service and contract only; the app side is `books.leave`.
Directories:

- `api/openapi.yaml` — extended **first** (the note): the new path and
  operation.
- `service/internal/server/` — `sharing.go` (the handler), `server.go` (the
  route), `sharing_test.go` and `home_book_test.go` (behavior).
- `e2e/api/sharing.test.js` — the e2e-api case.

## Inherited dependencies

All **settled**:

- **`service.sharing`** (Done, `tasks/refinements/service/sharing.md`) —
  `memberships` (`service/internal/db/migrations/0001_registry.sql:96-106`, PK
  `(book_id, account_id)`; the owner has no row), `invitation_joins` (:130-138),
  the owner's `handleRemoveMember` (`service/internal/server/sharing.go:770-803`),
  `requireOwner` (:182-219), the accept transaction that re-admits a former
  member (`sharing.go:599` membership `ON CONFLICT DO NOTHING`, :606-607 joins
  `ON CONFLICT DO NOTHING`, :614-615 a use spent only when a membership was
  inserted), and the decisions: a non-member is **404, never 403**
  (`sharing.md:312-315`), removals are **lazy** — access is re-read on every
  request (`sharing.md:361-370`, Decision :560-569), `invitation_joins` stay as
  history (`sharing.md:361-370`).
- **`design.leave_book`** (Done, `tasks/refinements/design/leave_book.md`) —
  workflow 10 §Leaving a book and the board `docs/mockups/Leave-book.dc.html`.
  It leaves the endpoint to this task (`design/leave_book.md:41-42`) and names
  this task's tests as the pins for "the owner refused" and "a member leaves /
  can no longer clone" (`:152-170`, `:200-204`).
- Also relied on: `service.books` for `resolveBookAccess`
  (`service/internal/server/books.go:483-502`) and `handleListBooks`
  (`books.go:166`, query :183-190); `service.change_check` for the shelf's
  `gone` (`shelf.go:248-260`); `service.git_http` for `gitAuthorize`
  (`git.go:192-235`), which re-reads access per request.

## What this task is

A member — reader or editor — ends their own membership of a book with one
request, `DELETE /api/books/{bookId}/membership`, without asking the owner.
The effect is exactly the owner's remove: the membership row goes, so at the
next request the book is absent from their `GET /api/books` (and so from
*Mine on Estante*), reported `gone` by the change check on their other
devices, and refused (404) to their clone, fetch and push; the owner's people
list no longer shows them and the count against the fifty drops by one. The
owner cannot leave (409). A non-member, a stranger, a deleted or taken-down
book, or the home book is 404. Coming back is an ordinary invitation.

## Why it needs to be done

No self-remove path exists: `removeMember` is owner only (`requireOwner`,
`sharing.go:780`), so a member's only way out of one book today is deleting
their whole account (workflow 17). Workflow 10 §Leaving a book
(`docs/workflows/10-share.md:87-143`) and DIRECTION §3.6 The API
(`docs/DIRECTION.md:393-396`, "a member leaving a book of their own accord")
promise it. `books.leave` cannot start until the endpoint exists — its order
of operations ("the membership ends on the service first; only then is the
book removed from this device", `10-share.md:119-120`) needs a call that
answers *left* or *did not leave*.

## Inputs / context

- **Workflow 10 §Leaving a book** (`docs/workflows/10-share.md:87-133`) — who
  (:89 reader or editor, without asking the owner), what it does (:119-125: no
  clone, fetch or push; gone from *Mine on Estante*; *no longer shared with
  you* on other devices at next sync; the owner's people screen drops them,
  count down by one; the owner not notified), needs a connection (:127-130),
  coming back by invitation counted against the fifty (:132-133).
  §Edge cases (:135-143): an owner cannot leave (:140-141); already removed —
  nothing to leave (:142-143). §Removing someone (:77-85) — the effect leaving
  matches. §Who sees whom (:73-75).
- **DIRECTION §3.3** (`docs/DIRECTION.md:176-186`) — every book request needs
  a session and a membership; at most fifty people. **§3.6 The API**
  (`DIRECTION.md:393-399`) — the Sharing line naming leaving; git for members
  only, by session. **§6** (`DIRECTION.md:593-599`) — Leaving one shared book,
  decided and drawn.
- **Contract today** (`api/openapi.yaml`): non-member policy :21-25; global
  `sessionCookie` security :54-55; `listBooks` :464-480; `listMembers`
  :594-615; `removeMember` :648-666 (the shape to mirror); parameters `BookId`
  :908; responses `Unauthorized` :966, `NotFound` :993, `Conflict` :1002;
  `Error` :1047-1061; `acceptInvitation` :742- ("no prior membership").
- **Seams**: `handleRemoveMember` (`sharing.go:770-803`, the delete at :791);
  `requireOwner` (:182-219, the 401/404 ladder to reuse in shape);
  `resolveBookAccess` + `bookAccess` (`books.go:464`, :483-502, filters deleted
  and taken-down books and yields `kind` and `role`); `isUUID`; `writeError`
  (`respond.go:28`); `writeUnauthorized` (`email_links.go:223`); routes
  `server.go:96-98`; request logging `logging.go:42` (method, path, status —
  the path carries only a book id).
- **Test seams**: `newBooksEnv` (`books_test.go:42`), `registerNewAccount`
  (`passkeys_test.go:138`), `do` (:83), `countRows` (:112), `createBook`
  (`books_test.go:131`), `listBooks` (:147), `bookByID` (:163),
  `insertMembership` (:114); `createInvitation` (`sharing_test.go:134`),
  `tokenFromURL` (:152), `acceptInvitation` (:164); `changeCheck`/`ccBody`/
  `headEntry`/`changeByID`/`seedREADME`/`headRev` as `TestChangeCheckLostAccess`
  uses them (`shelf_test.go:165-182`); `TestHomeBookNotShareable`'s op table
  (`home_book_test.go:219-240`); `e.contract.Validate`. e2e:
  `e2e/api/sharing.test.js` local helpers (`registerNewAccount` :29,
  `createBook` :44, `createInvitation` :50, `acceptInvitation` :57,
  `tokenFromUrl` :63, `gitEndpoint` :69, `findBook` :73, `tempDir` :77-87),
  `lib/git.js` (`GitCli.cloneHTTP` :107, `IsoGit.clone` :197), the refused-clone
  pattern of `git.test.js:179-203`.

## Constraints / requirements

1. **Contract first.** `api/openapi.yaml` gains the operation before the
   handler; every response in the behavior tests is validated with
   `e.contract.Validate("leaveBook", …)`.
2. **Only the caller's own membership.** The request names no account: the
   session's account is the one that leaves. Nothing else changes — no other
   member, no invitation, no `invitation_joins` row (the owner's *who joined*
   is history, `sharing.md:361-370`), no session, no repository byte.
3. **The owner cannot leave** (`10-share.md:140-141`): 409 `owner_cannot_leave`,
   nothing changed.
4. **No disclosure** (`openapi.yaml:21-25`, `sharing.md:312-315`): no session
   is 401; a malformed id, an unknown book, a book the caller is not a member
   of (never was, or already removed — `10-share.md:142-143`), a deleted or
   taken-down book, and the account's home book are all 404 `not_found`, alike.
5. **The effect matches the owner's remove** (the note; `10-share.md:119-125`),
   lazily — the next `listBooks`, change check and git request see it, by the
   existing per-request access reads; nothing in flight is interrupted.
6. **Coming back is an invitation** (`10-share.md:132-133`): a still-valid
   invitation — even the one they joined by — admits them again and spends a
   use, counted against the fifty, through the unchanged accept.
7. **Nothing logged beyond request metadata** — no handler log line is added;
   the generic request log holds method, path (a book id) and status.
8. **No notification** of the owner (`10-share.md:124-125`).

## Acceptance criteria

### Behavior delivered

**Contract** (`api/openapi.yaml`, tag `Sharing`, after `removeMember`):

- `DELETE /api/books/{bookId}/membership` — operationId `leaveBook`, summary
  "Leave a book: end the caller's own membership (reader or editor, workflow
  10 §Leaving a book)". Description: takes effect at the caller's next
  request, as a removal does; the owner cannot leave; the home book is not a
  book here (404). Parameter `BookId`. Responses `204` (left), `401`
  `Unauthorized`, `404` `NotFound`, `409` `Conflict` (code
  `owner_cannot_leave`).

**Service**:

- `handleLeaveBook(api)` in `sharing.go`: `session.Resolve` (401 via
  `writeUnauthorized`); `isUUID(bookId)` else 404; `resolveBookAccess(book,
  account)` — not found or `kind == "home"` → 404 `not_found` "No such book.";
  `role == "owner"` → 409 `owner_cannot_leave` "The owner cannot leave the
  book."; else `DELETE FROM memberships WHERE book_id = $1 AND account_id =
  $2`, `RowsAffected() == 0` (a concurrent remove) → 404, else 204. A doc
  comment naming workflow 10 §Leaving a book and the lazy-removal decision.
- `server.go`: `mux.HandleFunc("DELETE /api/books/{bookId}/membership",
  handleLeaveBook(api))` beside the member routes (:96-98).

### Tests, by level

The note names **behavior** and **e2e-api**; no unit level — the handler has
no pure rule to isolate (the decision is one `role` comparison on
`resolveBookAccess`'s result, pinned by the behavior cases).

**behavior** (`service/internal/server/`, httptest, real Postgres, every
`leaveBook` response validated with `e.contract.Validate`)

- `sharing_test.go` (extended):
  - `TestLeaveBook` — an owner's book with an editor and a reader
    (`insertMembership`) and a seeded repository (`seedREADME`, `headRev`).
    The editor leaves → 204; its membership row is gone (`countRows`), the
    reader's and the owner's access untouched; the editor's `listBooks` omits
    the book; the editor's change check with the book's head says `gone` with
    no head; the owner's `listMembers` no longer lists the editor and `count`
    dropped by one. The reader leaves likewise → 204. *Pins:* workflow 10
    §Leaving a book :89, :119-125 (no longer offered, the count drops); the
    `.tji` "a member leaves".
  - `TestLeaveBookOwnerRefused` — the owner's `DELETE …/membership` → 409
    `owner_cannot_leave`; the book still in the owner's `listBooks`, the
    members' rows unchanged. *Pins:* workflow 10 §Edge cases :140-141; the
    `.tji` "the owner refused".
  - `TestLeaveBookNonMember404` — a stranger's leave → 404; the same member's
    second leave after leaving → 404 (`10-share.md:142-143`); a malformed
    `bookId` → 404; an unknown UUID → 404; a soft-deleted and a taken-down
    book the caller was a member of → 404; no cookie → 401. All bodies
    `not_found` alike. *Pins:* the `.tji` "a non-member 404";
    `openapi.yaml:21-25`.
  - `TestLeaveBookThenRejoin` — a member joins by `createInvitation` +
    `acceptInvitation` (`uses_remaining` 2), leaves, accepts the same token
    again → 200; the book is back in their `listBooks`, the invitation's uses
    spent to 0, its `invitation_joins` still one row for them. *Pins:*
    workflow 10 :132-133 (coming back is an invitation, counted).
- `home_book_test.go` (extended) — `TestHomeBookNotShareable`'s op table gains
  `{"leaveBook", DELETE, "/api/books/<home>/membership"}` → 404, validated.
  *Pins:* DIRECTION §3.6 (the home book is never shared).

**e2e-api** (`e2e/api/sharing.test.js`, the compose stack, real git)

- *a member who leaves can no longer clone, and the owner cannot leave* — the
  owner registers, creates a book, pushes a first commit (`GitCli`, as the
  first case at :90 does), invites as reader; a second account accepts and
  clones it (`GitCli.cloneHTTP`) → succeeds. The member's `DELETE
  /api/books/<id>/membership` → 204. Then: `findBook` on the member's
  `GET /api/books` is absent; the member's
  `GET /git/<id>/info/refs?service=git-upload-pack` → 404; a fresh
  `GitCli.cloneHTTP` and an `IsoGit.clone` with the member's cookie both
  reject; the owner's `GET /api/books/<id>/members` no longer lists the member;
  a second leave → 404; the owner's own leave → 409 with code
  `owner_cannot_leave`. *Pins:* the `.tji` e2e-api ("joins by invitation,
  leaves, and can no longer clone"); workflow 10 §Leaving a book :121-122,
  §Edge cases :140-141.

Every prerequisite already exists (all `complete 100`): accounts by passkey
(`service.passkeys`, the e2e `registerNewAccount`), books and git over HTTP
(`service.books`, `service.git_http`), invitations and accept
(`service.sharing`), the change check (`service.change_check`), the harness
(`foundation.e2e_api`). The second device is the git CLI / isomorphic-git
acting as the member.

No deferred follow-ups; no tech debt. The app side is the existing
`books.leave`.

## Decisions

### Its own path, `DELETE /api/books/{bookId}/membership`

**Chosen:** a self-addressed resource with no account id, operationId
`leaveBook`. **Rejected:** widening `removeMember` to allow `userId == caller`
— it would mix two authorisations in one handler (owner-removes-anyone vs
member-removes-self), the app would have to know and send its own account id,
and the owner targeting themselves would stay the existing 404 "No such
member" instead of a refusal the app can word; a `POST …/leave` verb — the
action is the deletion of one resource (the caller's membership), and
`DELETE` is idempotent in effect as the second call's 404 shows.

### The owner gets 409 `owner_cannot_leave`

**Chosen:** 409 `Conflict` with a code. **Rejected:** 403 — the contract's
`Forbidden` means "a member but role insufficient" (`openapi.yaml:972`), and
the owner's role is the highest; the refusal is about the book's state (it
needs its one owner, `design/leave_book.md` Decision rejecting orphaning), which
is what `Conflict` describes. 404 — the owner plainly is in the book, and the
app must tell *you own this* from *you are not in it*.

### Taken-down and deleted books answer 404, not `taken_down`

**Chosen:** reuse `resolveBookAccess`, which hides both. **Rejected:**
`gitAuthorize`'s insider `taken_down` 403 — a member of a taken-down book
already sees it `gone` on the change check and has nothing to leave; a
special case adds a branch for no user-visible difference.

### No handler log line, no audit record

**Chosen:** the generic request log only, as `handleRemoveMember` does.
**Rejected:** an audit row like `admin.RemoveMembers`'s notice
(`service/internal/admin/admin.go:120`) — that records an operator's
copyright action with a reason; a person leaving is their own choice, and the
owner's people screen already shows the result. `invitation_joins` stays as
history, so *who joined* still shows they once joined, consistent with the
owner's remove.

### No design delta

DIRECTION §3.6 (`DIRECTION.md:393-396`) and workflow 10 §Leaving a book
already promise the endpoint and its effect; this task only gives it a
contract shape, which lives in `api/openapi.yaml`.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- api/openapi.yaml: `leaveBook` (`DELETE /api/books/{bookId}/membership`; 204, 401, 404, 409 `owner_cannot_leave`); the shared Conflict response now names the owner trying to leave.
- service/internal/server/sharing.go: `handleLeaveBook` drops only the caller's own membership; the owner is refused (409), a non-member, malformed/unknown id, deleted or taken-down book, the home book, or a concurrent remove get 404.
- service/internal/server/server.go: route registered beside the member routes.
- Behavior: service/internal/server/sharing_test.go (`TestLeaveBook`, `TestLeaveBookOwnerRefused`, `TestLeaveBookNonMember404`, `TestLeaveBookThenRejoin`); service/internal/server/home_book_test.go adds a `leaveBook` row to `TestHomeBookNotShareable`.
- e2e-api: e2e/api/sharing.test.js — after leaving, the member's info/refs is 404 and git CLI and isomorphic-git clones fail; the owner's leave is 409.
- No unit level (scoped out), no corpus entries, no tech debt.


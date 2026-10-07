# service.change_check — The shelf change check

## TaskJuggler

[`tasks/30-service.tji:50`](../../30-service.tji) — `task change_check "The
shelf change check"`, under `task service`. `effort 1d`, `allocate team`,
`depends !git_http`. Through the parent `task service` it also inherits
`foundation.service_skeleton`, `foundation.api_contract` and
`foundation.e2e_api`.

Downstream, `sync.engine` (`tasks/45-sync.tji:8`, `depends
service.change_check`) runs this endpoint first on every sync so it fetches
only the books that moved; `sync.states` and `sync.lost_access` turn its
`gone` answer into the shelf's *no longer shared with you* mark (workflow 8).

## Effort estimate

**1d.** One handler, one new git read, no new table and no new contract. The
work is small because the two load-bearing seams already exist — the registry
access check (`resolveBookAccess`, `service.books`) and exec'ing git from Go
(`service.books` / `service.git_http`). The genuinely new pieces are:

- **One batched read handler.** Decode a list of `{bookId, head}`, resolve
  access for the whole list, and read one ref per accessible book, returning
  only the books with news.
- **A "resolve the head SHA" git read.** The `book` package can read a blob
  (`ReadTitle`) and stream git over HTTP (`Serve`), but nothing yet resolves
  `refs/heads/main` to a SHA. This task adds that one-ref read.

## Repository

**estante-de-cifras.** The note does not start with `cifra.md:`. No cifra.md
work: the service never parses a song here — it reads one ref name to a SHA,
nothing more. The app and the service **share no code** (DIRECTION §3.6 line
288); only the HTTP contract in `api/` and the format bind them.

Directories/files that change:

- `service/internal/server/shelf.go` — `handleChangeCheck(api *APIDeps)
  http.HandlerFunc` (new).
- `service/internal/server/shelf_test.go` — behavior tests (new).
- `service/internal/book/book.go` — a new `(s Store) ResolveHead(ctx, id)
  (sha string, ok bool, err error)` reading `refs/heads/main`, modelled on
  `ReadTitle` over the existing `runGit` seam.
- `service/internal/server/server.go` — register `POST
  /api/shelf/change-check` inside the existing `if api != nil` block.
- `e2e/api/change-check.test.js` — e2e-api black-box test (new).

**No new migration.** Every column this task reads — `books.owner_id`,
`books.deleted_at`, `books.taken_down_reason`, `memberships.role` — already
exists (`service/internal/db/migrations/0001_registry.sql`), and
`resolveBookAccess` already queries them.

**No new `APIDeps` field.** The handler needs only the DB and the books
volume root, both already on `APIDeps` (`DB`, `BooksRoot`;
`service/internal/server/email_links.go:29`).

**No new contract.** `POST /api/shelf/change-check` (`changeCheck`) and its
schemas are already in `api/openapi.yaml` (written by
`foundation.api_contract`); this task implements the Go handler for the
already-contracted operation. No `api/` edit.

## Inherited dependencies

- **`service.git_http`** *(settled, Done)* — the immediate predecessor. This
  task reuses its repo-path seam (`book.Store{Root: api.BooksRoot}`,
  `(s Store) Path(id)`; `service/internal/book/book.go:52-63`) and the
  hardened `runGit` exec wrapper (`book.go:253-263`,
  `GIT_CONFIG_NOSYSTEM=1` / `GIT_TERMINAL_PROMPT=0`, argument arrays, never a
  shell). git_http's refinement itself names this task as the consumer of
  that seam ("reads one ref per book; it reuses this task's repo-path and git
  seam").
- **`service.books`** *(settled, Done)* — the registry access seam.
  `resolveBookAccess(ctx, q, bookID, accountID) (bookAccess, bool, error)`
  (`service/internal/server/books.go:453-472`): one query, `CASE WHEN
  b.owner_id = $2 THEN 'owner' ELSE m.role::text END` over a **live** book
  (`deleted_at IS NULL AND taken_down_reason IS NULL`), `found=false` when the
  caller is neither owner nor member or the book is not live. `isUUID`
  (`passkeys.go:540`), `book_role` enum is `('editor','reader')` only — the
  owner is `books.owner_id`, never a `memberships` row
  (`0001_registry.sql:26,100-106`).
- **`service.sessions`** *(settled, Done)* — `session.Resolve(ctx, db, r)
  (accountID string, ok bool, err error)` (`service/internal/session/session.go:128`),
  read inline as the handler's first line; the `estante_session` cookie; no
  middleware, no context key. `writeUnauthorized(w)` on `!ok`.
- **`foundation.api_contract`** *(settled, Done)* — `POST
  /api/shelf/change-check` and its schemas, fixed, implemented here not
  designed. `apicontract.Load()` (`api/validate.go`) for response validation
  in tests.
- **`foundation.e2e_api`** *(settled, Done)* — the `e2e/api/` harness:
  `HttpClient` (`e2e/api/lib/http.js`), `registerNewAccount` (the passkey
  ceremony), `GitCli` / `IsoGit` (`e2e/api/lib/git.js`), `connect`
  (`e2e/api/lib/db.js`) to seed a membership directly (no sharing API is
  needed by this task).

**Pending (downstream, not a blocker):** `sync.engine` and `sync.lost_access`
consume the `changed` and `gone` answers; `sync.fork_follow` owns the fork
fields this task intentionally leaves unset (see Decisions).

## What this task is

One batched HTTP endpoint so a device, each time it syncs, learns in a single
round-trip which of the books on its shelf have moved — and fetches only
those, instead of a fetch per book.

- **`POST /api/shelf/change-check` (`changeCheck`)** — the body carries each
  shelf book's id and the head this device currently has (`{books:
  [{bookId, head|null}]}`, up to 500). The response names only the books with
  news: a book whose `refs/heads/main` differs from the device's head is
  `changed` with its new `head`; a book the caller can no longer access (and
  holds a head for) is `gone`; a book with nothing to report is omitted. The
  endpoint answers `200` even for books the caller cannot see — per-book
  access is carried in the body, never as an HTTP status (contract responses
  are `200` / `400` / `401` only).

## Why it needs to be done

Sync runs often — on open, on foreground, when the network returns, after
every save, and every five minutes while open (workflow 8 §When it runs,
L13-19). Without the change check, each run would spend a git fetch on every
book on the shelf just to discover most have not moved. DIRECTION §3.3
(L194-196) makes this the service's job: "It also answers *has this book
changed?* by reading one ref off the disk, so a client spends a fetch only on
a book that did." Workflow 8 (L21-24) depends on it directly: "Each run begins
with one request asking the service which books on the shelf have changed
(DIRECTION §3.3), and fetches only those." `sync.engine` cannot run its
fetch/merge/push loop economically until this endpoint exists; `sync.states`
and `sync.lost_access` cannot surface *no longer shared with you* without its
`gone` answer.

## Inputs / context

**The task note** (`tasks/30-service.tji:54`, verbatim):

> "One request for a whole shelf, each book with the head the device has,
> answered with the books that moved; one ref read per book. Workflow 8.
> Tests: behavior (a shelf with moved and unmoved books answered with one ref
> read each; a book the user lost access to); e2e-api (a push from one client,
> then the change check from another sees that book move and no other)."

**Workflow 8** (`docs/workflows/08-sync.md`):

- §When it runs (L11-24) — the triggers and "one request asking the service
  which books on the shelf have changed … and fetches only those." Nothing
  runs while the app is closed.
- §What the shelf says (L26-38) — the per-book states, including *no longer
  shared with you* (L34); "in step" is the synced state.
- §Losing access (L64-69) — "A request refused because the user is no longer
  a member turns the book into *no longer shared with you*: readable as it
  is, never synced again." This endpoint's `gone` is how the device learns it
  through routine sync, before it attempts a doomed fetch.

**DIRECTION** (`docs/DIRECTION.md`):

- §3.3 The one server (L153-222) — the change-check mechanism (L194-196: "by
  reading one ref off the disk"); one origin, session cookie (L170-173); no
  book reachable without an account and a membership (L175-178); random book
  ids on a volume at `/data/books/<id>.git` (L184-187).
- §3.4 (L231-232) — "a ref read for the change check" is named again as the
  per-book cost the single instance is sized for.
- §3.6 #### The API (L365-366) — the contract item: "one request for a whole
  shelf, each book with the head the device has, answered with the books that
  moved (workflow 8)." §3.6 line 288 — the app and the service share no code.

**The contract** (`api/openapi.yaml`):

- `POST /api/shelf/change-check` (`changeCheck`, L375-404): request
  `ChangeCheckRequest`, `200` `ChangeCheckResponse`, plus `400` BadRequest and
  `401` Unauthorized — and nothing else. The description (L380-387) draws the
  gone/absent line: "a book the caller is no longer a member of … Books with
  nothing to report are omitted. A book id the caller cannot see is simply
  absent from the response — the change check never confirms a private book
  exists."
- `ShelfBookHead` (L1060-1072): `{bookId: Id, head: GitSha|null}`, "the head
  the device has, or null when it has nothing yet."
- `ChangeCheckRequest` (L1074-1083): `{books: [ShelfBookHead]}`, `maxItems:
  500`, `additionalProperties: false`.
- `ShelfBookChange` (L1085-1109): required `[bookId, status]`; `status` enum
  `[changed, unchanged, gone]`; optional `head: GitSha`, `originalNewSaves:
  integer(min 1)`, `originalGone: boolean`.
- `ChangeCheckResponse` (L1111-1120): `{books: [ShelfBookChange]}` — only the
  books with news.
- `GitSha` (L845-848): `^[0-9a-f]{40}([0-9a-f]{24})?$`. Session scheme
  `sessionCookie` = `estante_session` (L700-707).

**The schema** (`service/internal/db/migrations/0001_registry.sql`):
`books` with `owner_id`, `original_book_id` (`ON DELETE SET NULL`),
`deleted_at`, `taken_down_reason` (L83-92); `memberships` with no soft-delete
column — a removal is a hard row delete (L100-106).

**Code seams to reuse:**

- `resolveBookAccess` / `bookAccess` / `isUUID`
  (`service/internal/server/books.go:439-472`, `passkeys.go:540`).
- `book.Store{Root}`, `Path`, `runGit`, `ReadTitle`
  (`service/internal/book/book.go:44-63,100-110,253-263`).
- `session.Resolve` (`service/internal/session/session.go:128`);
  `writeJSON` / `writeError` (`respond.go:20-30`); `writeUnauthorized` /
  `decodeStrict` (`email_links.go:184,191`).
- Route registration and middleware (`server.go`, the `if api != nil` block;
  `LogRequests(logger, NoIndex(mux))`).

**Test precedents:** behavior — `newBooksEnv(t)` (`books_test.go:42-78`, real
accounts + sessions via the WebAuthn software authenticator, a `t.TempDir()`
books root, `httptest`), `migratedServerSchema(t)` with `t.Skip` on an unset
`ESTANTE_TEST_DATABASE_URL`, `seedREADME` / `gitRun` (`books_test.go:414-448`),
responses validated via `apicontract.Load()`. e2e-api — `books.test.js` (a
second `HttpClient` for a second account, a membership seeded through
`lib/db.js`) and `git.test.js` (`GitCli` / `IsoGit` HTTP clone/fetch/push with
a cookie).

**Standing rules in scope:** *no book without an account* — every request
carries a session; a book the caller cannot access is never confirmed (below).
*No song text or secrets in logs* — `LogRequests` already logs method, path,
status and duration only; the handler logs nothing else, and a SHA is never
treated as content. *Offline first* — this endpoint is the cheap probe that
lets the offline-first Worker avoid needless fetches; it is read-only and
changes no state. Canonical form and accessibility are not in scope (no song
is parsed, no UI is rendered).

## Constraints / requirements

1. **Authenticate, then answer in the body — never leak existence through a
   status.** `session.Resolve` first; `!ok` → `401`. Every other outcome is
   `200` (or `400` for a malformed body). A book the caller cannot access is
   not a `404`; its fate is a per-book entry (or omission) in the `200` body.
   This is why the contract gives the endpoint only `200` / `400` / `401`.
2. **One ref read per accessible book.** For each requested book the caller
   can access, read `refs/heads/main` to a SHA exactly once
   (`ResolveHead` → `git --git-dir <path> rev-parse --verify
   refs/heads/main`, via `runGit`). No `git log`, no object walk, no second
   ref — the note and DIRECTION §3.3/§3.4 size the instance on one ref read
   per book.
3. **Resolve access over the whole list in one registry query.** With a
   500-item cap, do not issue 500 separate `resolveBookAccess` round-trips:
   run one query resolving owner/member access and liveness for all requested
   ids (the same `CASE` / join / `deleted_at IS NULL AND taken_down_reason IS
   NULL` predicate as `resolveBookAccess`, over `id = ANY($ids)`), then the
   one ref read per accessible book. A non-UUID id is dropped before the query
   (`isUUID`).
4. **Status derivation**, per requested book (`deviceHead` = the body's
   `head`):
   - accessible, `ResolveHead` ok, `sha != deviceHead` (including
     `deviceHead` null) → `changed`, `head = sha`.
   - accessible, `ResolveHead` ok, `sha == deviceHead` → omitted.
   - accessible, no `refs/heads/main` yet (empty book), `deviceHead` null →
     omitted (nothing to report). With a non-null `deviceHead` → omitted (a
     degenerate claim the book cannot satisfy; nothing truthful to report).
   - not accessible (not a member, or book deleted / taken down), `deviceHead`
     non-null → `gone`.
   - not accessible, `deviceHead` null → omitted.
   - the `unchanged` status and the `originalNewSaves` / `originalGone` fields
     are never emitted by this task (see Decisions).
5. **Request validation.** `decodeStrict` into a struct matching
   `ChangeCheckRequest` (`additionalProperties: false`); a body that is not an
   object, a missing `books`, more than 500 items, a `head` that is neither
   `null` nor a well-formed `GitSha`, or an unknown field → `400` BadRequest.
   An empty `books` array is valid and answers `{books: []}`.
6. **The response is contract-exact.** `{books: [ShelfBookChange]}`,
   `additionalProperties: false`, `changed` entries carry a `head` matching
   `GitSha`, `gone` entries carry none. Validated against `api/openapi.yaml`
   in tests via `apicontract`.
7. **Read-only.** The endpoint changes no registry row and no repository; it
   never spawns `receive-pack` and runs no hook.
8. **No song text or secrets in logs.** Method, path, status and duration
   only (`LogRequests`); never a book id, a device head, or a resolved SHA as
   a logged field.

## Acceptance criteria

**Behavior delivered.** A device posts its whole shelf — each book with the
head it has — in one request, and gets back only the books with news: the ones
whose `main` moved (with the new head), and the ones it can no longer access
(`gone`). Everything in step, and everything the caller cannot see without
already holding it, is omitted. The endpoint reads exactly one ref per
accessible book and never confirms a book the caller cannot access exists.

**Tests the task lands with, by level.** (The note names behavior and
e2e-api. No unit level: the only pure step is a SHA-string comparison, fully
exercised by the behavior tests against real git — see Decisions.)

- **behavior** — `service/internal/server/shelf_test.go`, the real
  `server.Handler` through `httptest` against Postgres from compose
  (`migratedServerSchema`, `t.Skip` on an unset `ESTANTE_TEST_DATABASE_URL`)
  and real git on a `t.TempDir()` books root, built on `newBooksEnv`; every
  response validated against `api/openapi.yaml` via `apicontract.Load()`:
  - a shelf of moved and unmoved books — a book pushed past the device's head
    comes back `changed` with the new head; a book at the device's head is
    omitted; each accessible book is read once. *Pins:* the note's "a shelf
    with moved and unmoved books answered with one ref read each", workflow 8
    §When it runs (L21-24), DIRECTION §3.3 (L194-196), the `changeCheck`
    contract.
  - a book first pushed since the device cloned it (device `head: null`,
    book now has a `main`) → `changed`. *Pins:* `ShelfBookHead.head` null
    semantics (contract L1068-1072).
  - a book the caller lost access to — a member removed from the book (its
    `memberships` row deleted) that the device still holds a head for →
    `gone`; and a book soft-deleted (`deleted_at`) / taken down
    (`taken_down_reason`) the caller held → `gone`. *Pins:* the note's "a
    book the user lost access to", workflow 8 §Losing access (L64-69),
    `ShelfBookChange` `gone` (contract L1092-1094).
  - never-confirm — a live book the caller is not a member of, and a random
    unknown id, each with `head: null` → both omitted and indistinguishable;
    the same two ids with a non-null head → both `gone` and
    indistinguishable (the gone/omit choice follows the caller's own supplied
    head, not server state). *Pins:* the contract's "never confirms a private
    book exists" (L385-387), DIRECTION §3.3 (L175-178).
  - request and auth edges — no session → `401`; a malformed body, an
    over-500 list, and a `head` that is not a `GitSha` → `400`; an empty
    `books` → `{books: []}`. *Pins:* the `changeCheck` responses (contract
    L394-404), `ChangeCheckRequest` (L1074-1083).
- **e2e-api** — `e2e/api/change-check.test.js`, black-box over the compose
  stack: account A creates a book and shares it with account B (membership
  seeded via `lib/db.js`, as `books.test.js` does — no sharing API is needed
  here); B clones it (`GitCli`/`IsoGit`) and records its head, and A also owns
  a second, untouched book B holds. A pushes a commit to the first book; B's
  `POST /api/shelf/change-check` for both books returns the pushed book
  `changed` with the new head and omits the untouched one. *Pins:* the note's
  "a push from one client, then the change check from another sees that book
  move and no other", workflow 8 §When it runs, DIRECTION §3.3.

**Deferred follow-ups — fork-following is not this task's.** The contract's
optional `originalNewSaves` / `originalGone` fields and the `unchanged` status
(a fork reported only because its original advanced) are **out of scope by the
note**, which scopes this task to "one ref read per book" and workflow 8;
fork-following needs a second repository's ref and a commit count. That
behavior is already a WBS leaf — `sync.fork_follow` ("Following an original",
`tasks/45-sync.tji:44`, workflow 11). This task emits only `changed` and
`gone`; the fork fields stay unset (optional in the schema, so the response is
contract-valid). No new task is registered here. One boundary question for the
human queue (see the return summary): `sync.fork_follow` sits in the device
area and does not currently depend on `service.change_check`, yet a forker may
not be a member of the original and so cannot read it from the device — only
the service can. Whether `fork_follow` therefore needs to extend this
service-side endpoint is a task-boundary judgment, surfaced for the parking
lot rather than encoded as an audit task.

## Decisions

- **Gone vs. absent is decided by the caller's own supplied head, not by
  server state.** *Chosen:* for a book the caller cannot access
  (`resolveBookAccess` `found=false` — not a member, or deleted / taken
  down), report `gone` when the device sent a non-null `head`, and omit it
  when the device sent `head: null`. *Rejected:* (a) always `gone` for an
  inaccessible book — literally contradicts the contract's "simply absent"
  clause; (b) always omit — then a device that lost access learns nothing
  through routine sync (the change check would say "no news", so no fetch is
  attempted, so the git `404` never happens), breaking workflow 8 §Losing
  access; (c) a `memberships` tombstone to tell "removed" from "never a
  member" — a new column and write path for a distinction the request already
  carries. *Rationale:* a device only lists books it actually holds, and it
  holds a non-null head exactly for a book it cloned — i.e. one it was a
  member of; so a non-null head + no access is precisely "no longer shared
  with you" → `gone`, and a null head is the just-added-or-never-synced case →
  omit. This honors both contract clauses at once and **leaks nothing**: the
  gone/omit branch depends only on the client's supplied head, so a
  nonexistent id and a real private book the caller cannot see are always
  answered identically (both `gone` with a head, both omitted without one).
  **No contract delta.**
- **One batched registry query, then one ref read per accessible book.**
  *Chosen:* resolve access for all requested ids in a single query reusing the
  `resolveBookAccess` predicate over `id = ANY($ids)`, then `ResolveHead` once
  per accessible book. *Rejected:* a `resolveBookAccess` call per id — up to
  500 DB round-trips for one endpoint call, against the single instance
  DIRECTION §3.4 sizes for "a ref read for the change check". *Rationale:* the
  note's budget is one ref read per book, not one DB round-trip per book;
  `listBooks` already resolves a whole shelf in one query. The ref read stays
  per-book because each lives in its own repository. **No delta.**
- **A new `ResolveHead` on `book.Store`, beside `ReadTitle`.** *Chosen:* add
  `(s Store) ResolveHead(ctx, id) (sha string, ok bool, err error)` running
  `rev-parse --verify refs/heads/main` through the existing `runGit`; `ok=false`
  for a book with no `main` yet. *Rejected:* a standalone git-read package —
  the `book` package is already the git/volume seam, and git_http's refinement
  established that seam packages wrap a stateful external resource, which this
  read belongs to; a new package would only add indirection. *Rationale:*
  smallest reuse of the hardened `runGit` (arg arrays, `GIT_CONFIG_NOSYSTEM`,
  no shell). **No delta.**
- **No unit level.** *Chosen:* land behavior + e2e-api, the levels the note
  names. *Rejected:* adding a unit test for the status-derivation step.
  *Rationale:* the derivation is a SHA-string equality plus an access flag;
  there is no pure module with logic worth isolating (unlike git_http's
  pkt-line encoder or gzip reader), and it is fully exercised by the behavior
  tests against real git and Postgres. Not a dropped level — the note names
  only behavior and e2e-api. **No delta.**
- **The endpoint is read-only and status-free about access.** *Chosen:* every
  authenticated call is `200` (or `400`); per-book access lives in the body.
  *Rejected:* a `404`/`403` for an inaccessible book. *Rationale:* a batched
  request spans many books with mixed access; a single HTTP status cannot
  express that, and the contract gives the endpoint only `200`/`400`/`401`.
  **No delta.**

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `service/internal/book/book.go` — added `(s Store) ResolveHead(ctx, id) (sha string, ok bool, err error)`: one `git rev-parse --verify refs/heads/main` through the existing `runGit` seam; `ok=false` for an empty book.
- `service/internal/server/shelf.go` (new) — `handleChangeCheck`: session gate → `decodeStrict` + validation (≤500, head null|GitSha, strict fields) → one batched registry query over `id = ANY(ids)` using the `resolveBookAccess` predicate → one `ResolveHead` per accessible book → `changed`/`gone`/omit per the Decision table.
- `service/internal/server/server.go` — registered `POST /api/shelf/change-check` in the `if api != nil` block.
- `service/internal/server/shelf_test.go` (new) — behavior tests: moved/unmoved shelf; first-push (null head) + empty-book omit; lost-access (membership removed, soft-deleted, taken-down → `gone`); never-confirm (private book vs unknown id, indistinguishable under null and non-null head); request/auth edges (401, malformed/unknown-field/over-500/bad-head → 400, empty → `{books:[]}`). Every 200 validated via `apicontract.Load()`.
- `e2e/api/change-check.test.js` (new) — e2e-api: A shares two books with B (membership via `lib/db.js`); B clones both; A pushes to one; B's change check returns it `changed` with the new head and omits the other. Test: "a push from one client, then the change check from another sees that book move and no other".

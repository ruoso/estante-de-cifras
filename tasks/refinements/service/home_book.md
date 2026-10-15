# service.home_book — The account's home book on the service

## TaskJuggler

[`tasks/30-service.tji:96`](../../30-service.tji) — `task home_book "The
account's home book on the service"`, under `task service`. `effort 1d`,
`allocate team`, `depends !books, !git_http, hook.home_book`. Through the
parent `task service` it also inherits `foundation.service_skeleton`,
`foundation.api_contract` and `foundation.e2e_api`.

Downstream, `account.new_device` (`tasks/70-account.tji:25`, `depends …
service.home_book`) attaches the home book to the remote this task exposes on
sign-in, and clones it first on a new device (workflow 13).

## Effort estimate

**1d.** The git side already handles a `kind='home'` book end to end:
`resolveBookAccess` returns `kind` (`service/internal/server/books.go:473-492`),
`pushEnv` forwards it as `ESTANTE_BOOK_KIND` (`service/internal/server/git.go:398-406`),
and the hook validates a home-book push (`service/cmd/pre-receive/main.go:84`,
`service/internal/hook/home_book.go`). The account-delete cascade already
removes every owned book, row and repository
(`service/internal/server/account.go:86-122`). What is new:

- **One migration** — a partial unique index, one home book per account.
- **One get-or-provision handler** and its contract operation.
- **Keeping the home book out of the Books and sharing surface** — the list
  filters it; delete, fork, members and invitations answer `404` for it.

## Repository

**estante-de-cifras.** The note does not start with `cifra.md:`; no format
work. The app and the service share no code (DIRECTION §3.6); only `api/`
binds them.

Files that change:

- `api/openapi.yaml` — **first**: a new path `/api/account/home-book` with
  `get` `operationId: getHomeBook` (tag `Sign-in`), responses `200`
  (`HomeBook`), `401`; a new schema `HomeBook`
  (`additionalProperties: false`, `required: [id, gitUrl]`, `id` → `Id`,
  `gitUrl` `format: uri`); and a sentence on `listBooks`, `deleteBook`,
  `forkBook` and the members/invitations operations saying the home book is
  not a book there (answered as `404`, NotFound's "no such resource").
- `service/internal/db/migrations/0005_one_home_book.sql` (new) —
  `CREATE UNIQUE INDEX books_one_home_per_owner ON books (owner_id) WHERE kind = 'home';`
- `service/internal/server/home_book.go` (new) — `handleGetHomeBook(api *APIDeps) http.HandlerFunc`.
- `service/internal/server/server.go` — register `GET /api/account/home-book`
  in the `if api != nil` block, beside the other `/api/account` routes
  (`server.go:59`).
- `service/internal/server/books.go` — `handleListBooks` query (`:182-188`)
  gains `AND b.kind = 'songbook'`; `handleDeleteBook` (`:242`) and
  `handleForkBook` (`:315`) answer `404` when `access.kind == "home"`;
  `ownedUsage` (`:442-447`) counts only songbooks in the book count (bytes
  still counted over every owned book — see Decisions).
- `service/internal/server/sharing.go` — `requireOwner` (`:182-215`) and the
  members-list access check (`:669`) answer `404` for a home book, which
  closes create/list/withdraw invitation and list/patch/remove member; the
  accept transaction (`acceptInvitationTx`, `:521`, its `SELECT owner_id …
  FOR UPDATE` at `:547`) also reads `kind` and refuses a home book as an
  unknown invitation, defence in depth.
- `service/internal/server/home_book_test.go` (new) — behavior tests.
- `e2e/api/home-book.test.js` (new) — e2e-api.

## Inherited dependencies

- `service.books` — **settled** (`complete 100`): `InitBare`, `gitURL`,
  the registry/volume move-together rule, `resolveBookAccess`.
- `service.git_http` — **settled**: `/git/{bookId}` smart HTTP, owner access
  without a membership row, `ESTANTE_*` forwarding.
- `hook.home_book` — **settled**: the `kind` column (migration 0003),
  `ESTANTE_BOOK_KIND`, the home-book validator (`docs/home-book-format.md` §8).
- `foundation.api_contract`, `foundation.e2e_api` — **settled**: `apicontract`
  validation in Go; the e2e harness (`HttpClient`, `Authenticator`, `GitCli`,
  `IsoGit`, `lib/db.js`).

## What this task is

Give every account exactly one home book on the service and tell a signed-in
device where it is. `GET /api/account/home-book` answers `{id, gitUrl}`; on
the account's first call it creates the registry row (`kind='home'`) and an
empty bare repository, and every later call — from any device, concurrently
or not — returns the same one. The home book is otherwise invisible to the
Books API: never listed, never deletable, forkable or shareable on its own,
and removed only with the account.

## Why it needs to be done

`books.kind` allows `'home'` and the hook validates a home-book push, but
nothing creates a home book or names its URL, so the app's home-book sync
(`app/src/worker/home-book.js` `sync`, `:251-333`, fetching and pushing
`origin`) has no remote. `account.new_device` is blocked on it (the
2026-10-14 parking-lot triage that created this leaf). Workflow 13 orders a
new device's sign-in: "The **home book** first" (`docs/workflows/13-new-device.md:31-36`),
then the shelf fills from the shelf list the home book carries (`:38-43`).

## Inputs / context

- **DIRECTION §3.2** (`docs/DIRECTION.md:136-151`): the home book is "a
  repository like any other but committed automatically", a settings
  repository with its own allowed kinds.
- **DIRECTION §3.3** (`:175-187`): no book without a session and a membership;
  one bare repo per book at `/data/books/<id>.git`.
- **DIRECTION §3.6 The API** (`:370-392`) — extended by this task's delta (see
  Decisions).
- **`docs/home-book-format.md`** §1 (`:18-23`): moves over the same git over
  HTTP, "starts local with no remote and gains one when the user signs in",
  "private to one account — `noindex`, no invitations, no members beyond the
  one owner"; §2.3 (`:138-142`) a hosted book's id is the service's; §8
  (`:496-500`) the service recognises the kind from the registry.
- **Workflow 1** (`docs/workflows/01-first-run.md:83-86`), **workflow 13**
  (`:31-43`, `:59-62` a device used before signing in merges its local home
  book key by key), **workflow 17** (`docs/workflows/17-leaving.md:125-126`,
  `:160-162` — the home book removed with the account).
- **Predecessor refinements**: `tasks/refinements/design/home_book_format.md`
  (Decision L312-319: tagged as its own kind, no bespoke settings endpoint);
  `tasks/refinements/hook/home_book.md` (L289-293: tests seeded the kind by
  SQL, "no provisioning flow required"); `tasks/refinements/service/books.md`
  (L246-250 `404` never `403` to a stranger; L251-256 registry and volume move
  together; L370-382 the service creates an empty repo and the app pushes the
  first commit); `tasks/refinements/service/sharing.md` (L350-358 idempotent
  transactions with `ON CONFLICT … DO NOTHING`).
- **Code seams**: `book.Store.InitBare` (`service/internal/book/book.go:70-77`),
  `gitURL(base, id)` (`books.go:66-68`), the create transaction
  (`books.go:133-146`), `session.Resolve` (`service/internal/session/session.go:128`).
- **Test seams**: `newBooksEnv` / `registerNewAccount` / `insertBook` /
  `insertMembership` (`service/internal/server/books_test.go:50-131`,
  `passkeys_test.go:138`); `newGitEnv`, `installRealHook`, `gitc`,
  `canonicalHomePrefs` (`git_test.go:178-331`, `:811-844`); e2e
  `registerNewAccount` (`e2e/api/git.test.js:33`), `signInViaEmail`
  (`e2e/api/sessions.test.js:47-61`), `seedAccount` (`lib/db.js`), `GitCli`
  `pushHTTP` / `IsoGit` `clone` (`e2e/api/lib/git.js:120,197`), the home-book
  README/.gitattributes bytes (`e2e/api/git.test.js:431-438`).

## Constraints / requirements

1. **Contract first.** `api/openapi.yaml` gains `getHomeBook` and `HomeBook`
   before the handler; every response in the behavior tests is validated
   with `apicontract.Load()`; statuses are exactly those declared.
2. **Exactly one per account, race-safe.** The partial unique index is the
   guarantee, not the handler. Provisioning is one transaction:
   `INSERT INTO books (owner_id, kind) VALUES ($1, 'home') ON CONFLICT (owner_id) WHERE kind = 'home' DO NOTHING RETURNING id`;
   if a row came back, `InitBare(id)` inside the transaction (on failure
   `Remove(id)` and roll back, as `handleCreateBook` does), then commit; if
   none came back, `SELECT id FROM books WHERE owner_id = $1 AND kind = 'home'`.
   A concurrent second request blocks on the index until the first commits,
   then reads its row — never a row without a repository.
3. **Empty, like any new book.** The service seeds no commit; the device
   pushes its local home book (workflow 1: it "starts local"), exactly as
   `books.md` L370-382 decided for songbooks.
4. **Session required.** No session → `401`. The endpoint names only the
   caller's own home book; there is no path parameter, so no other account's
   home book can be asked for.
5. **Not a songbook.** `listBooks` omits it; `deleteBook`, `forkBook`, every
   `/api/books/{bookId}/members…` and `/invitations…` route answer `404` for
   it, even to its owner (NotFound's "no such resource" — on the Books API
   it is not one). Git routes and the change check keep treating it as the
   owner's book (it must sync).
6. **Owner only on git.** No membership row is ever made for a home book;
   `resolveBookAccess` already admits the owner and refuses everyone else
   with `404`.
7. **Deleted with the account.** No new code: `books.owner_id … ON DELETE
   CASCADE` and the repo-removal loop in `handleDeleteAccount` cover it; a
   test pins it.
8. **Not throttled, not capped by the book count.** Provisioning creates at
   most one row ever per account, so it neither spends `ratelimit.BookCreate`
   nor counts against the 100-book cap; its bytes still count toward the
   account's 200 MB (workflow 14) through the existing push path.
9. **No song text or settings in logs** — the handler logs request metadata
   only (DIRECTION §3.3).
10. **`noindex`** — inherited from the service's response headers; nothing
    new.

## Acceptance criteria

**Behavior delivered.** A signed-in device calls `GET /api/account/home-book`
and gets `{id, gitUrl}` for its account's home book, created empty on the
first call and identical on every call after, from any session of that
account. It pushes its local home book there through the hook, and another
device of the same account clones the same bytes. The home book never
appears in `GET /api/books`, cannot be deleted, forked or shared through the
Books API, is invisible to another account, and is gone when the account is
deleted.

**Tests the task lands with, by level.** (The note names behavior and
e2e-api. No unit level — see Decisions.)

- **behavior** — `service/internal/server/home_book_test.go`, the real
  `server.Handler` through `httptest` against Postgres from compose
  (`migratedServerSchema`, `t.Skip` on an unset `ESTANTE_TEST_DATABASE_URL`)
  and real git on a `t.TempDir()` books root (`newBooksEnv`); every response
  validated with `apicontract.Load()`:
  - `TestHomeBookProvisionedOnce` — the first `GET` returns `200` `HomeBook`
    whose `gitUrl` is `<PublicBaseURL>/git/<id>`; the registry holds one row
    with `kind = 'home'` and that owner, and `<BooksRoot>/<id>.git` is a bare
    repository with no `main`; a second `GET` (and a `GET` from a second
    session of the same account) returns the same id with still one row.
    *Pins:* the note's "provisioned once, idempotent; kind home",
    `docs/home-book-format.md` §1, §8 (`:496-500`).
  - `TestHomeBookConcurrentFirstRequests` — N concurrent first `GET`s for one
    account all return the same id; one row, one repository. *Pins:*
    Constraint 2 (the partial unique index).
  - `TestHomeBookAbsentFromBookList` — an account with one songbook and its
    home book: `listBooks` returns the songbook only; and `createBook` still
    succeeds at 99 owned songbooks plus the home book. *Pins:* the note's
    "absent from the songbook list", Constraint 8.
  - `TestHomeBookNotShareable` — its owner's `createInvitation`,
    `listInvitations`, `listMembers`, `deleteBook` and `forkBook` on the home
    book's id each answer `404`; the row is untouched and no invitation row
    exists. *Pins:* the note's "not shareable",
    `docs/home-book-format.md:18-23` ("no invitations, no members beyond the
    one owner"), DIRECTION §3.6 (delta).
  - `TestHomeBookAnotherAccountRefused` — account B's `info/refs`,
    `git-upload-pack` on A's home book are `404`, the same as an unknown id;
    B's own `GET` gives B a different home book. *Pins:* the note's "another
    account refused", DIRECTION §3.3 (`:175-178`).
  - `TestHomeBookPushThroughHook` — with `installRealHook`, the owner pushes
    the canonical README, `.gitattributes` and `preferences.json`
    (`canonicalHomePrefs`) to the provisioned `gitUrl` with the git CLI and it
    is accepted; a song file pushed there is refused. *Pins:* the kind
    reaching the hook from provisioning, not from a hand `UPDATE`
    (`docs/home-book-format.md` §8).
  - `TestHomeBookDeletedWithAccount` — after `deleteAccount`, the row and
    `<id>.git` are gone. *Pins:* the note's "deleted with the account",
    workflow 17 (`:160-162`).
  - `TestHomeBookNoSession` — no cookie → `401`. *Pins:* the `getHomeBook`
    contract.
- **e2e-api** — `e2e/api/home-book.test.js`, black-box over the compose
  stack: an account registered by passkey (`registerNewAccount` +
  `Authenticator`) calls `GET /api/account/home-book` twice (same id); it
  pushes a canonical home book (README, `.gitattributes`,
  `preferences.json`) with `GitCli.pushHTTP` to `gitUrl`, accepted by the
  hook; `GET /api/books` does not list it. The account's email is set via
  `lib/db.js` and a **second session** of the same account is made with
  `signInViaEmail` (as `sessions.test.js` does); its `GET` returns the same
  id and `IsoGit.clone` with its cookie reads the same `preferences.json`
  bytes and the same head. A second account's clone of that `gitUrl` is
  refused. *Pins:* the note's "a signed-in client gets its home book, pushes
  settings through the hook, a second session clones the same bytes",
  workflow 13 (`:31-36`).

Each test above is driven by what already exists: sessions (`service.sessions`,
the passkey and email-link ceremonies), the hook (`hook.home_book`), git over
HTTP (`service.git_http`), account deletion (`DELETE /api/account`), and the
e2e harness. No UI flow is needed.

**Deferred follow-ups.** None registered. The app-side use — attaching
`gitUrl` as `origin` on `/books/home`, keeping the service id beside the
reserved local id `'home'` and sending that id in the change check — is
`account.new_device`'s work (its note: "Attach the home book to its service
remote (service.home_book) on sign-in").

## Decisions

- **A dedicated `GET /api/account/home-book`, provisioning lazily.**
  *Chosen:* one account-scoped resource that always exists conceptually and
  is materialised on first read. *Rejected:* (a) a field on the sign-in
  responses (`Account`) — the email-link redeem and both passkey finishes
  would all have to provision, and a device already signed in (a session
  from before this task) would have no way to ask; (b) a separate `POST` to
  create plus `GET` to read — two calls and a "not yet" state for one fact
  that has a single right answer; (c) provisioning on account creation — the
  existing accounts would have none, and it adds a repository to every
  registration that never syncs. *Rationale:* the result of the `GET` is the
  same on every call, so it stays safe and idempotent in effect; one call
  site in the app. **Delta:** `docs/DIRECTION.md` §3.6 The API gains a "home
  book" bullet.
- **A partial unique index, not a column on `accounts`.** *Chosen:*
  `UNIQUE (owner_id) WHERE kind = 'home'` plus `INSERT … ON CONFLICT DO
  NOTHING`. *Rejected:* an `accounts.home_book_id` column — a second source
  of truth for what `books.kind` already says, and a cycle between the two
  tables. The index makes "exactly one" a database fact and follows the
  `ON CONFLICT` pattern of `service.sharing`.
- **The home book is `404` on the Books and sharing routes, even to its
  owner.** *Chosen:* treat it as no such book there. *Rejected:* `403` — the
  contract's Forbidden is "the role is insufficient", which is not the case
  for the owner, and `deleteBook`'s `403` would invite a UI to offer it; a new
  `409 code: home_book` — a new refusal the app never needs, since it never
  addresses the home book by those routes. *Rationale:* every one of those
  operations already declares `404`; no new status, and the home book stays
  out of the songbook surface entirely (`docs/home-book-format.md:18-23`).
- **Excluded from the 100-book count, included in the 200 MB.** *Chosen:*
  `ownedUsage`'s count filters `kind = 'songbook'`; its byte sum does not.
  *Rejected:* counting it in both — an account at 100 songbooks could not
  get a home book; excluding it from both — an unbounded side channel for
  bytes. Settings files are small (256 KB cap per file, seven files,
  `docs/home-book-format.md` §8), so the bytes barely move the cap.
- **No server-seeded first commit.** The home book "starts local"
  (workflow 1); a server commit would make the device's first push a
  non-fast-forward, the reason `service.books` rejected seeding
  (`books.md` L370-382).
- **No unit level.** The handler is one SQL transaction and one `InitBare`;
  there is no pure logic to isolate, and the behavior tests exercise it
  against real Postgres and git (the `service.change_check` precedent). Not a
  dropped level — the note names behavior and e2e-api only.
- **The change check keeps the home book.** `accessibleBooks`
  (`shelf.go:187-199`) is left as is: the home book is the owner's
  accessible repository and syncs through the same check (workflow 8,
  `:71-76`).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- `api/openapi.yaml`: `GET /api/account/home-book` (`getHomeBook`) and the `HomeBook` schema, with notes on the Books and sharing operations that the home book answers `404` there.
- `service/internal/db/migrations/0005_one_home_book.sql`: partial unique index, one `kind='home'` book per owner.
- `service/internal/server/home_book.go`, `server.go`: get-or-provision handler (one transaction, empty bare repo) registered beside the other account routes.
- `service/internal/server/books.go`, `sharing.go`: the list filters songbooks; delete, fork, members and invitations (and accepting one) refuse a home book; it does not count toward the 100-book limit, its bytes still count toward the 200 MB.
- `docs/DIRECTION.md` §3.6: the home book bullet.
- Tests: behavior in `service/internal/server/home_book_test.go` (all eight named cases); e2e-api in `e2e/api/home-book.test.js`. No unit level, per Decisions.
- No tech-debt follow-up.

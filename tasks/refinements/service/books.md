# service.books — Books: create, list, delete, fork

## TaskJuggler

[`tasks/30-service.tji:36`](../../30-service.tji) — `task books "Books: create,
list, delete, fork"`, under `task service`. `effort 3d`, `allocate team`,
`depends !sessions`. Through the parent `task service` it also inherits
`foundation.service_skeleton`, `foundation.api_contract` and
`foundation.e2e_api`.

Downstream, `service.git_http` (`tasks/30-service.tji:42`, `depends !books`),
`service.change_check` (`:48`, `depends !git_http`) and `service.sharing`
(`:54`, `depends !books`) all build on the registry rows and the bare
repositories this task creates.

## Effort estimate

**3d.** The HTTP surface is four small handlers, but the weight is in three
things new to the service:

- **Running git from Go for the first time.** No service code shells out to
  git yet (`service.git_http` and the hook come after this task). This task
  introduces the seam: creating a bare repository, copying one for a fork,
  and reading a blob out of one for a title — all by exec'ing the host `git`
  binary with argument arrays, no shell.
- **A book's title lives in git, not Postgres.** The `books` table has no
  `title` column by design (DIRECTION §2.1). `listBooks` must derive each
  title from the book's `README.md`, and `createBook`/`forkBook` must behave
  sensibly for a book whose first commit has not landed yet.
- **The filesystem and the registry must stay consistent.** A row without
  its repository, or a repository without its row, is a defect; create and
  fork write both, and delete retires both, with rollback on a half-failure.

## Repository

**estante-de-cifras.** No cifra.md work: the service never parses a song for
this task — it reads a README's first heading as bytes, nothing more. The app
and the service **share no code** (DIRECTION §3.6 line 288); only the HTTP
contract in `api/` and the format bind them.

Directories/files that change:

- `service/internal/server/books.go` — the four handlers (new).
- `service/internal/server/books_test.go` — behavior tests (new).
- `service/internal/book/` — a new package for the git/volume seam: repository
  path from id, `git init --bare`, fork-copy, README-title read, directory
  removal, and the pure helpers (new).
- `service/internal/book/*_test.go` — unit tests for the pure helpers (new).
- `service/internal/config/config.go` — add the books-volume root
  (`ESTANTE_BOOKS_ROOT`, default `/data/books`); extend `config_test.go`.
- `service/internal/server/email_links.go` — extend the `APIDeps` struct with
  `BooksRoot` (and nothing else); `service/cmd/service/main.go` fills it from
  config.
- `service/internal/server/server.go` — register the four routes inside the
  existing `if api != nil` block.
- `e2e/api/books.test.js` — e2e-api black-box tests (new).
- `compose.yaml` / `scripts/gate` — a writable books volume for the stack if
  one is not already mounted; no new service.

**No new migration.** Every table this task touches — `books`, `memberships`
— already ships in `service/internal/db/migrations/0001_registry.sql`
(`service.schema`). This task only reads and writes rows.

## Inherited dependencies

- **`service.schema`** (Done, 2026-10-07) — the registry. `books`
  (`0001_registry.sql:83-94`): `id uuid` PK (random `gen_random_uuid()`, the
  volume path is derived from it, not stored), `owner_id NOT NULL REFERENCES
  accounts`, `visibility` CHECK'd to `'private'`, `original_book_id REFERENCES
  books ON DELETE SET NULL` (the single-level fork original), `size_bytes`
  (the quota input, default 0, maintained downstream by the push path),
  `created_at`, `deleted_at`, `taken_down_reason`. `memberships`
  (`:100-106`): composite PK `(book_id, account_id)`, `role book_role`
  (`editor`/`reader` only — **the owner is never a membership row**). The
  schema comment at `:73-82` records the `/data/books/<id>.git` convention and
  the lifecycle this task fills. *(settled)*
- **`service.sessions`** (Done, 2026-10-07) — the account gate.
  `session.Resolve(ctx, db, r)` (`service/internal/session/session.go:128`)
  reads the `estante_session` cookie and returns the signed-in account id, or
  `ok == false` for not-signed-in. There is **no middleware and no context
  key**: each handler calls `Resolve` inline, exactly as
  `handleRevokeSession` does (`service/internal/server/sessions.go:128-158`).
  This is the "no book without an account" gate every handler here opens with.
  *(settled)*
- **`service.passkeys`** (Done, 2026-10-07) — reached transitively through
  `!sessions`; contributes the `isUUID` helper (`passkeys.go:540`) and the
  `apicontract` response-validation pattern. *(settled)*
- **`foundation.api_contract`** (Done) — the book operations and schemas in
  `api/openapi.yaml` are already fixed; this task implements them, it does not
  design them. *(settled)*
- **`foundation.e2e_api`** (Done) — the `e2e/api/` harness, its `HttpClient`
  cookie jar, `seedAccount`, the Mailpit reader and `GitCli`/`IsoGit`
  wrappers. *(settled)*
- **`service.git_http`** — *Pending (downstream, not a blocker).* Git over
  HTTP does not exist when this task lands, so no device can push to a book
  yet. This shapes the tests (below): the title-from-README path is exercised
  at behavior level by seeding a bare repo directly, not over HTTP.

## What this task is

The four registry-and-volume operations behind a book's life, as
`api/openapi.yaml` already declares them:

- **`POST /api/books` (`createBook`)** — insert a `books` row owned by the
  caller, private, and create an **empty** bare repository at
  `/data/books/<id>.git`. Return the book's id, its git remote URL, and the
  title echoed from the request. The app pushes the first commit (a `README.md`
  and a `.gitattributes`, workflow 14 lines 174-178) itself, once git over
  HTTP exists.
- **`GET /api/books` (`listBooks`)** — the account's books: those it owns,
  those shared with it (its `memberships`), and its forks. Each carries its
  role, its git URL, each fork its single-level `original`, and a title read
  from the book's `README.md` at `refs/heads/main`.
- **`DELETE /api/books/{bookId}` (`deleteBook`)** — owner only. Mark the row
  deleted (`deleted_at`) and remove the bare repository from the volume. A
  member who is not the owner is refused; a non-member is told the book does
  not exist.
- **`POST /api/books/{bookId}/fork` (`forkBook`)** — any member of a book may
  fork it. Copy the repository with all its history to a new id on the same
  volume, insert a `books` row owned by the caller with `original_book_id` set
  to the source, and return it as a book with its `original`.

Per-account quotas (100 books, 200 MB, forks included — workflow 14 lines
39-48) are checked at create and fork and refused with `413`.

## Why it needs to be done

A book is the unit everything else in the service operates on: git over HTTP
serves one (`service.git_http`), the change check reads one ref per book
(`service.change_check`), sharing invites people into one (`service.sharing`),
the hook checks a push into one (workflow 14). None of them can exist until a
book can be created, listed, forked and deleted — this task is the first to
turn a `books` row and a bare repository into a thing a signed-in account
owns. It realises the "Books" line of the API (DIRECTION §3.6 lines 360-364)
and the server side of workflow 7 (*Put online*) and workflow 11 (fork).

## Inputs / context

**The task note** (`tasks/30-service.tji:40`): "Bare repositories on the volume
at /data/books/<id>.git, random ids, owner-only delete (type the name), fork
as a copy on the volume, per-account limits (100 books, 200 MB). Workflows 7,
11, 14. Tests: behavior (…); e2e-api (…)."

**Workflows:**

- `docs/workflows/07-add-a-book.md` — *Putting a book online* (lines 46-52):
  *Put online* "creates the book on Estante, adds it as the remote, and
  pushes. … It goes online private: only its owner can open it." A link names
  the book, not its git URL, "which is the service's business" (lines 42-43).
  *Removing a book, and deleting one* (lines 128-137): "Remove from my shelf
  deletes the local clone only"; "Delete the book, only for its owner, deletes
  it from Estante for everyone, and asks for the book's name to be typed."
  (The type-the-name confirmation is the app's; the API carries no name — see
  Decisions.)
- `docs/workflows/11-fork.md` — *What a fork is* (lines 18-39): "The user's
  own copy of the book, with all its history, which remembers the book it came
  from as its original." "On Estante, private: the service copies the
  repository on its volume." "A fork of a fork is allowed. Its original is the
  book it was forked from, not the first one; nothing follows more than one
  step." *Following the original* (lines 51-54): when the original goes away,
  "the fork is untouched. It has the whole history up to the last time it
  followed the original." *The original's owner* (lines 57-60): "told nothing
  in the first pass, and sees nothing of forks."
- `docs/workflows/14-file-view.md` — *Limits* (lines 39-44): "256 KB per
  file; 50 MB per book, with its history; 100 books and 200 MB per account,
  forks included, with creating books rate-limited." *What a new book starts
  with* (lines 174-178): "A README.md holding its title as a level-1 heading
  … and a .gitattributes that names the cifra merge driver." (The file-level
  checks and the per-book/per-account enforcement at push time are the hook's,
  `service.git_http`; this task owns only the create/fork pre-checks.)

**DIRECTION:**

- §2 (lines 37-38): "A book is a collection of songs, and a book is a git
  repository." §2.1 (line 74): "A book's title is the level-1 heading of its
  README, or the repository name."
- §3.3 (lines 184-204): Postgres holds the registry; "A volume holds one bare
  git repository per book, `/data/books/<id>.git`." "Forks (workflow 11) are
  copies on the same volume." (lines 175-178): "No book is reachable without
  an account … Every request for a book needs a session and a membership."
- §3.6 (lines 337-340): a deleted book is "refused by the service with a clear
  message, git never spawned" — the `deleted_at` the git path reads is set
  here. (lines 360-364): the Books API. (line 288): app and service share no
  code.

**The contract** (`api/openapi.yaml`):

- `GET /api/books` `listBooks` → `200 BookList`, `401` (`:289-302`).
- `POST /api/books` `createBook` → body `CreateBookRequest`, `201 Book`,
  `400`, `401`, `413` (`:303-328`); "Returns the book's id and its git remote
  URL. The book goes online private."
- `DELETE /api/books/{bookId}` `deleteBook` → `204`, `401`, `403`, `404`
  (`:330-345`) — no request body.
- `POST /api/books/{bookId}/fork` `forkBook` → `201 Book`, `401`, `404`,
  `413` (`:347-369`); "Any member may fork a book they can open; the caller
  becomes the fork's owner."
- Schemas: `Book` required `[id, title, role, visibility, gitUrl]`, optional
  `original` (`:1013-1036`); `BookList { books: [Book] }` (`:1038-1046`);
  `CreateBookRequest` required `[title]`, `title` 1–200 chars (`:1048-1056`);
  `Original` required `[bookId]`, optional `title` "the original's title as
  the fork last knew it" (`:1001-1011`); `Role` enum `[owner, editor, reader]`
  (`:835-838`).
- Shared responses: `NotFound` (`:782-790`, deliberately conflates "no such
  book" with "not a member" so a private book is not confirmed to a stranger);
  `Forbidden` (403); `TooLarge` (413, the quota refusal, `:800-808`); `Error`
  `{code, message}` only, never song text, email, token or id (`:819-833`).
  `sessionCookie` scheme = `estante_session` (`:700-707`); `BookId` path param
  (`:710-714`).

**The schema** (`service/internal/db/migrations/0001_registry.sql`): `books`
`:83-94`, `memberships` `:100-106`, the lifecycle comment `:73-82`.

**Code seams to reuse:**

- `session.Resolve` (`session.go:128`); `Issue`/`Revoke` not needed here.
- `APIDeps` struct (`service/internal/server/email_links.go:29`); constructed
  in `service/cmd/service/main.go:92-98`. Add one field, `BooksRoot string`.
- Response helpers: `writeJSON`/`writeError` (`respond.go:20,28`),
  `writeUnauthorized` (`email_links.go:168`), `decodeStrict` (`email_links.go:175`),
  `isUUID` (`passkeys.go:540`). Path params via `r.PathValue("bookId")`.
- Route registration inside `if api != nil` in `server.go:46-71`; the app
  catch-all `mux.Handle("/", app)` stays last (`:77`), and `/api` is already a
  reserved prefix that never falls through to the SPA (`app.go:54`).
- Config: `Load` and the `ESTANTE_*` namespace, `DefaultAppRoot`
  (`config.go:22`) as the pattern for a defaulted path.
- `apicontract` response validation, as the passkeys/sessions behavior tests
  use it.

**Test precedents:** `service/internal/server/email_links_test.go:102-134`
(`migratedServerSchema(t)` — a throwaway Postgres schema per test, `t.Skip`
when `ESTANTE_TEST_DATABASE_URL` is unset); `migrate_test.go` seed helpers
(`insertAccount`, `insertBook`). e2e-api: `e2e/api/lib/http.js` (`HttpClient`
cookie jar), `e2e/api/lib/db.js` (`seedAccount`), `e2e/api/lib/git.js`
(`GitCli` — `git init --bare -b main`, the server-side bare-repo model),
`e2e/api/sessions.test.js:47-61` (`signInViaEmail` — the way a test gets a
session cookie before calling `/api/books`).

**Standing rules in scope:** no book without an account (every handler gates on
`session.Resolve`); no song text or secrets in logs (log the operation and the
book id only, never a title, README or path contents — DIRECTION §3.3);
canonical form is not this task's concern (the hook's); accessibility is not in
scope (no UI here).

## Constraints / requirements

- **No book without an account.** Every handler calls `session.Resolve`
  first; `ok == false` → `401` via `writeUnauthorized`. A book the caller
  neither owns nor is a member of is `404`, never `403` (don't confirm a
  private book to a stranger — `api/openapi.yaml:782-790`). `403` is reserved
  for a member who lacks the role for the action (a non-owner deleting).
- **The registry and the volume move together.** Create and fork insert the
  `books` row and create the repository directory in one logical operation; if
  the filesystem step fails, the row is rolled back and any partial directory
  removed, so there is never a row without a repository or the reverse. Delete
  sets `deleted_at` first (which alone suffices to refuse all future access and
  to free quota) and then removes the directory.
- **Random, opaque ids.** The id is the `gen_random_uuid()` the row gets; the
  volume path is `filepath.Join(BooksRoot, id+".git")`. Ids never encode the
  owner, the title or anything guessable. `BooksRoot` comes from config, never
  a request, and the id is validated as a UUID before it is ever joined into a
  path, so a request cannot escape the volume root.
- **The title comes from git, not the registry** (DIRECTION §2.1). `books` has
  no `title` column and this task adds none. `listBooks` reads `README.md` at
  `refs/heads/main`; `createBook` echoes the requested title into its response
  (the repository is still empty at that instant).
- **Quotas are code constants** (not schema): 100 books and 200 MB per account,
  forks included (workflow 14 lines 42-43). Checked by counting and summing
  the caller's live books (`WHERE owner_id = $1 AND deleted_at IS NULL`) inside
  the creating transaction; over either limit → `413 TooLarge`. The per-file
  and per-book checks and the push-time enforcement are the hook's, not this
  task's.
- **One binary, standard library.** `net/http.ServeMux` with Go 1.22
  method+pattern routes; `pgx` with plain SQL (no ORM); git by `os/exec` of the
  host binary with argument arrays and `GIT_CONFIG_NOSYSTEM=1` /
  `GIT_TERMINAL_PROMPT=0`, never a shell string. The app shares none of this.
- **Contract-first.** Request bodies decoded with `decodeStrict`; every
  response validated against `api/openapi.yaml` in the behavior tests; statuses
  are exactly the set each operation declares, and any other failure collapses
  to the one error status the operation allows.
- **No song text or secrets in logs.** Log method, book id and outcome;
  never a title, a README, repository bytes or a path's contents.

## Acceptance criteria

**Behavior delivered:**

1. **Create.** `POST /api/books` with `{title}` by a signed-in account inserts
   a private `books` row owned by the caller and creates an empty bare
   repository (`git init --bare -b main`) at `/data/books/<id>.git`; returns
   `201` with `{id, title (echoed), role: "owner", visibility: "private",
   gitUrl}`, where `gitUrl` is `<PublicBaseURL>/git/<id>`. Over the 100-book
   quota → `413`; a missing or empty title → `400`; not signed in → `401`. A
   filesystem failure rolls the row back.
2. **List.** `GET /api/books` returns the caller's owned books, shared books
   (from `memberships`, with role `editor`/`reader`) and forks, each with its
   `gitUrl` and a `title` read from `README.md` at `refs/heads/main`; a fork
   carries `original: {bookId, title?}`. A book with no commit yet, or no
   level-1 heading, falls back to a non-empty placeholder title. Not signed in
   → `401`. Deleted books are omitted.
3. **Delete.** `DELETE /api/books/{bookId}` by the owner sets `deleted_at` and
   removes the repository directory; returns `204`. A member who is not the
   owner → `403`; a non-member or unknown id → `404`; not signed in → `401`.
   The deleted book then counts against no quota and is absent from `listBooks`.
4. **Fork.** `POST /api/books/{bookId}/fork` by any member of the source copies
   the repository with all its history to a new id on the volume
   (`git clone --bare --no-hardlinks`), inserts a `books` row owned by the
   caller with `original_book_id` set and `size_bytes` copied from the source,
   and returns `201` with the new book and its `original`. A non-member or
   unknown source → `404`; over the caller's 100-book or 200-MB quota (counting
   the source's size) → `413`; not signed in → `401`.

**Tests the task lands with, by level.** The note names **behavior** and
**e2e-api**; this refinement adds a **unit** level for the pure helpers the new
`service/internal/book` package introduces (a genuine, independently testable
module — path building and README-title parsing), which the policy permits.

- **unit** — `service/internal/book/*_test.go` (`go test`, no DB, no network):
  - `repoPath(root, id)` joins `BooksRoot` and `<id>.git` and refuses a
    non-UUID id (no path escape). *Pins:* the `/data/books/<id>.git` convention
    and the opaque-random-id rule (task note; DIRECTION §3.3 lines 186-187).
  - `titleFromREADME(bytes)` returns the first level-1 heading, trims it, and
    falls back to a non-empty placeholder when there is none. *Pins:*
    DIRECTION §2.1 line 74.
- **behavior** — `service/internal/server/books_test.go` (`httptest` + real
  Postgres via `migratedServerSchema`, real git on a `t.TempDir()` books root;
  `t.Skip` without `ESTANTE_TEST_DATABASE_URL`). Each response validated
  against `api/openapi.yaml`:
  - create makes a row and a bare repo, returns `201` with the echoed title and
    `gitUrl`; empty title → `400`; no session → `401`. *Pins:* workflow 7
    lines 46-48; contract `:303-328`.
  - list returns owned, shared and forked books with roles; title is read from
    a `README.md` **seeded directly into the bare repo** via local git (since
    git-over-HTTP is downstream); a repo with no commit falls back. *Pins:*
    DIRECTION §2.1; contract `:289-302, :1013-1046`.
  - delete by the owner `204`s, sets `deleted_at`, removes the directory, and
    drops the book from a later list; a non-owner member → `403`; a non-member
    → `404`. *Pins:* workflow 7 lines 136-137; DIRECTION §3.6 lines 337-340;
    contract `:330-345`.
  - fork of a seeded source copies the full history (the fork's `main` matches
    the source's head), sets `original_book_id` and copies `size_bytes`; a
    fork survives the source's deletion; a fork of a fork points at its
    immediate parent; a non-member fork → `404`. *Pins:* workflow 11 lines
    18-39, 51-54; contract `:347-369`.
  - quota: the 101st create → `413`; a fork that would carry the owner past
    200 MB → `413`. *Pins:* workflow 14 lines 39-48; contract `:800-808`.
- **e2e-api** — `e2e/api/books.test.js` (black-box over HTTP against the
  compose stack; a session via `signInViaEmail`):
  - create, then list sees the new private book owned by the caller with a
    `gitUrl`; fork it and list sees the fork with its `original`; delete it and
    list no longer shows it. *Pins:* workflows 7 and 11; contract `:289-369`.
  - a second account's delete of the first's book is refused (`403` as a
    member, `404` as a non-member), and an over-quota create is refused
    (`413`). *Pins:* owner-only delete and the per-account limit (task note;
    DIRECTION §3.3 lines 175-178; workflow 14 lines 42-43).
  - (Pushing to a created book is **not** exercised here: git over HTTP is
    `service.git_http`, downstream of this task. The title-from-README path is
    pinned at behavior level by seeding the bare repo directly.)

**No deferred follow-ups.** The downstream tasks that build on this
(`service.git_http` for the smart-HTTP transport and the push-time per-file,
per-book and per-account enforcement; `service.change_check`; `service.sharing`
for members, invitations and the fifty-person cap; `service.admin` for
take-down) are existing WBS leaves, already wired through `depends !books` /
`!git_http` / `!sharing` — this is ordering, not deferral. The quota constants,
the git-over-HTTP transport and the hook environment are consumed-but-not-owned
here by explicit design (Decisions). No tech debt registered.

## Decisions

- **The service creates an empty bare repository; the app pushes the first
  commit.** *Chosen:* `createBook` runs `git init --bare -b main` and nothing
  more; the `README.md` (title as level-1 heading) and `.gitattributes`
  (workflow 14 lines 174-178) arrive in the app's first push once git over
  HTTP exists. *Rejected:* the service seeding the initial commit itself. A new
  book is a local repository the user may already have edited before going
  online (workflow 7 line 25), and *Put online* "adds it as the remote, and
  pushes" (line 47) — a server-seeded commit would be an unrelated history the
  app's first push could not fast-forward onto, forcing a spurious merge of two
  "new book" roots. The service owning only the empty repository keeps the
  book's history single-rooted and the app the sole author of content. No
  DIRECTION delta.
- **The title is derived from git, echoed on create, with a placeholder
  fallback.** *Chosen:* `listBooks` reads `README.md` at `refs/heads/main`
  (one `git` read per book, ≤100 books, the same order of cost as the change
  check's one ref per book); `createBook` echoes the request title because the
  repository is empty at that instant; a book with no commit or no heading
  falls back to a non-empty placeholder so the required field is always
  present. *Rejected:* adding a `title` column. DIRECTION §2.1 makes the README
  the single source of truth, the schema deliberately omits the column, and a
  column would drift from the README on every push. The creating device shows
  its own shelf-local title anyway (workflow 7 lines 16-18), so the placeholder
  is only ever seen for a foreign account's empty, unpushed book — a narrow
  window. No delta.
- **`original.title` is derived live, not snapshotted.** *Chosen:* populate the
  optional `Original.title` by reading the original book's current README
  heading when the original still exists; omit it when the original is gone or
  inaccessible. *Rejected:* a stored "last known" title column — there is none,
  the field is optional, and the app keeps its own shelf label ("from Ana's
  Choros", workflow 11 line 30), so the server need not persist a snapshot. No
  delta.
- **Delete is a soft delete plus a directory removal.** *Chosen:* set
  `deleted_at` (and leave the row, so the id is never reused and the git path
  can refuse with a reason — DIRECTION §3.6 lines 337-340), then remove the
  bare repository to reclaim disk. Quota already ignores deleted books
  (`deleted_at IS NULL`). *Rejected:* a hard `DELETE` of the row. The schema's
  `deleted_at`/`taken_down_reason` columns exist precisely so the git layer can
  tell a client why a book is gone; a hard delete throws that away and would
  also cascade memberships and invitations silently. Forks are unaffected
  either way — they are independent copies, and `original_book_id ON DELETE SET
  NULL` plus the soft-delete refusal both yield workflow 11's "the original is
  no longer shared with you." No delta.
- **The type-the-name confirmation stays in the app.** *Chosen:* `deleteBook`
  takes no request body; the owner typing the book's name (workflow 7 line 137)
  is an app-side guard against an accidental click, and the contract carries no
  name (`:330-345`). *Rejected:* a confirmation field in the API — it would put
  a book's title into a request the service would have to compare against git
  content, for no security gain (the session already proves ownership). No
  delta.
- **Fork copies with `git clone --bare --no-hardlinks`.** *Chosen:* a full,
  independent copy of all history (workflow 11 line 19) that survives the
  source's later deletion and directory removal (lines 51-54). *Rejected:*
  hardlinked objects (`git clone --bare` default / local optimisation) — they
  share inodes with the source, so the "independent copy" guarantee gets
  fragile exactly when the source is deleted. The copies are small text
  repositories; an independent copy is worth the bytes. No delta.
- **A new `service/internal/book` package, not git calls inline in the
  handler.** *Chosen:* isolate the volume/git seam (path building, init, fork,
  title read, removal) so the pure parts get unit tests and the handler stays
  about HTTP and SQL, matching how `session`, `passkey` and `emaillink` are
  split out. *Rejected:* exec'ing git from inside `books.go` — it would make
  the pure path/title logic untestable without a DB and a volume. No delta.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `service/internal/book/book.go` — new package: `repoPath` (UUID-gated path building), `InitBare`, `ForkBare`, `TitleFromREADME`, `RemoveRepo`.
- `service/internal/book/book_test.go` — unit tests for the pure helpers (path convention, title parsing with placeholder fallback).
- `service/internal/server/books.go` — four handlers: `createBook`, `listBooks`, `deleteBook`, `forkBook`; per-account quota checks (100 books, 200 MB); contract-first with `decodeStrict` and `apicontract` response validation.
- `service/internal/server/books_test.go` — behavior tests via `httptest` + real Postgres + real git on `t.TempDir()`; covers create/list/delete/fork, quota refusals (413×2), and all error statuses (400/401/403/404).
- `e2e/api/books.test.js` — black-box e2e-api tests: create→list→fork→delete; stranger 404, member 403, 401, over-quota 413.
- `service/internal/config/config.go` + `config_test.go` — added `BooksRoot`/`ESTANTE_BOOKS_ROOT`, default `/data/books`.
- `service/internal/server/email_links.go` — extended `APIDeps` with `BooksRoot string`.
- `service/cmd/service/main.go` — fills `BooksRoot` from config.
- `service/internal/server/server.go` — registered four routes inside the `if api != nil` block.
- `compose.yaml` — explicit `ESTANTE_BOOKS_ROOT` env var and books volume comment.

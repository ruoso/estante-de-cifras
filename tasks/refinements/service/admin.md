# service.admin — Admin actions for a notice

## TaskJuggler

[`tasks/30-service.tji:70`](../../30-service.tji) — `task admin "Admin actions
for a notice"`, under `task service`. `effort 1d`, `allocate team`,
`depends !sharing`. Through the parent `task service` it also inherits
`foundation.service_skeleton`, `foundation.api_contract` and
`foundation.e2e_api`.

## Effort estimate

**1d.** Three blunt book-level operations over tables that already exist, a
small pure package behind a thin command, one new table, and one focused change
to the git gate. The weight is in two places, not the SQL:

- **Surfacing the take-down reason on the git refusal.** Today a taken-down
  book resolves as inaccessible and is refused `404` — indistinguishable from a
  non-member or a deleted book (`service.git_http` Decision). This task adds the
  one branch that tells a taken-down book's **owner and members** why, while a
  stranger still learns nothing.
- **Recording the notice.** "The owner is told why" needs a durable carrier, and
  none exists yet; this task adds a one-table audit record every admin action
  writes, with its reason.

The three mutations themselves (set `taken_down_reason`; withdraw every live
invitation; delete every membership) are a few SQL statements each, inside a
transaction with the notice insert.

## Repository

**estante-de-cifras**, `service/` only. No cifra.md work: the admin tool never
parses a song — it moves registry rows and a book-lifecycle flag. The app and
the service **share no code** (DIRECTION §3.6 line 288); the admin tool is not
an app feature at all (workflow 10 line 106 — "a process written down in the
terms, not a feature of the app").

Directories/files that change:

- `service/internal/db/migrations/0004_book_notices.sql` — the notices table
  (new; picked up automatically by the `//go:embed migrations/*.sql` migrator,
  `service/internal/db/migrations.go:28`).
- `service/internal/admin/admin.go` — the three operations as testable
  functions over a `querier` (new package).
- `service/internal/admin/admin_test.go` — behavior tests against real Postgres
  (new).
- `service/cmd/estante-admin/main.go` — the operator entry point: parse a
  subcommand, a book id and a `--reason`, open the pool from the environment,
  run the operation (new).
- `service/cmd/estante-admin/args.go` + `args_test.go` — the pure argument
  parser and its unit tests (new).
- `service/internal/server/git.go` — one branch in `gitAuthorize`: a taken-down
  book's owner/member is refused `403 taken_down` carrying the reason, a
  stranger still `404`.
- `service/internal/server/git_test.go` — behavior tests for that refusal (new
  cases).
- `e2e/api/admin.test.js` — e2e-api black-box tests (new).
- `api/openapi.yaml` — document the git routes' `403 taken_down` refusal (a
  response addition; the admin operations themselves have no HTTP surface).
- `Dockerfile` — build and ship `/usr/local/bin/estante-admin` beside the
  service, so the operator can run it inside the production container.

**New table, no change to an existing migration.** `0004_book_notices.sql` is
additive; the `taken_down_reason`, `memberships` and `invitations` columns this
task writes already ship in `0001_registry.sql`.

**No new config.** The command reads `ESTANTE_DATABASE_URL` through the same
`config.Load` the service uses (`service/internal/config/config.go`); the git
change adds no config.

## Inherited dependencies

- **`service.sharing`** (Done, 2026-10-07) — the members-and-invitations seam
  this task operates on bluntly:
  - `memberships` (`0001_registry.sql:100-106`), removal is a row `DELETE`;
    `invitations.withdrawn_at` (`:116-126`), withdrawal sets it and keeps those
    who joined; `invitation_joins` (`:133-138`) is history, left untouched.
  - the owner-facing per-item operations `withdrawInvitation` and `removeMember`
    (`service/internal/server/sharing.go`) are the per-item precedent; this
    task's admin forms are the book-level "all of them" blunt instruments, and
    reuse the same column writes. *(settled)*
- **`service.books`** (Done, 2026-10-07) — the book-lifecycle seam:
  - the `books` table with `taken_down_reason text` (`0001_registry.sql:91`),
    whose schema comment already states these columns "carry the lifecycle the
    git refusal reads before git starts" (`:80-82`).
  - `resolveBookAccess` (`service/internal/server/books.go:453-472`), whose SQL
    is guarded by `deleted_at IS NULL AND taken_down_reason IS NULL` (`:466-467`)
    — so a taken-down book already resolves `found=false`. The **404-vs-403
    ladder** (`books.go:263-277`) and the `querier` interface (`:420`) this task
    reuses. *(settled)*
- **`service.git_http`** (Done, 2026-10-07) — *not a blocker (it is `complete
  100`); the gate this task extends.* `gitAuthorize`
  (`service/internal/server/git.go:196-221`) is the single chokepoint for all
  three git routes — info/refs (`:65`), upload-pack (`:104`) and receive-pack
  (`:140`). It calls `resolveBookAccess` (`:211`) and, on `found=false`, writes
  `404 "No such book."` (`:216-219`). This task adds the taken-down-insider
  branch before that `404`. git_http's standing decision — "404, not 403, for a
  non-member or a removed book; 403 only for a wrong role" — is preserved: only
  a current owner/member of a *taken-down* book sees the reason.
- **`service.change_check`** (Done) — *not a blocker.* The shelf change check
  already answers a taken-down book `gone`, with no reason
  (`service/internal/server/shelf.go:168-199`; `shelf_test.go:198` sets
  `taken_down_reason` and asserts `gone`). This task does not change that; the
  reason surfaces through the git refusal, not the change check.
- **`foundation.api_contract`** (Done) — the git routes exist in
  `api/openapi.yaml`; this task adds one refusal response to them. There are no
  admin operations in the contract, and none are added (the admin tool is a CLI,
  not an API). *(settled)*
- **`foundation.e2e_api`** (Done) — the `e2e/api/` harness: `registerNewAccount`
  (`e2e/api/books.test.js:25`), the second-`HttpClient` pattern, the git clients
  `GitCli`/`IsoGit` with `cloneHTTP`/`pushHTTP`/`fetchHTTP` carrying a cookie
  (`e2e/api/lib/git.js`), and the narrow Postgres seam `connect()`
  (`e2e/api/lib/db.js`) whose stated purpose is "to seed a precondition that no
  landed endpoint yet provides" — exactly the operator effect this task's e2e
  reproduces. *(settled)*

## What this task is

The operator's three moderation actions behind workflow 10's *A copyright
notice*, delivered as a server-side command run by the operator (not an app
feature, not a public endpoint), each recording a durable notice of why:

- **Take a book down** — set `books.taken_down_reason` to the operator's reason.
  The book stops being reachable for everyone (its repository stays on the
  volume); its owner and members learn why at their next git request, and the
  book shows `gone` on every shelf.
- **Withdraw a book's invitations** — set `withdrawn_at` on every one of the
  book's invitations that is not already withdrawn. Nobody new joins through any
  of them; those who joined stay members.
- **Remove a book's members** — delete every `memberships` row of the book. The
  book becomes private to its owner again; each removed member loses access at
  their next request (`resolveBookAccess` miss) and sees "no longer shared with
  you" on their shelf (workflow 8).

Each action writes a `book_notices` row — the action, its reason, the book and
its owner, and the time — the durable record behind "the owner is told why".
And the git gate gains the one branch that turns a taken-down book's refusal,
for its owner and members, from a bare `404` into a `403` carrying the reason.

## Why it needs to be done

DIRECTION §3.3 (lines 208-211) names, as an obligation of hosting users' data,
"a way to handle a copyright notice — books with words in them are copyrighted
text." Workflow 10 (lines 103-106) turns that into the three operator actions.
`service.sharing` built the owner's own controls (invite, withdraw, remove) and
`service.books` the lifecycle columns (`deleted_at`, `taken_down_reason`), but
nothing yet lets the operator act on a book it does not own, and nothing records
or conveys the reason. This task is the last service-side piece of workflow 10:
the operational tool for a notice, and the reason reaching the book's people.
It is a downstream leaf — nothing in the WBS waits on it.

## Inputs / context

**The task note** (`tasks/30-service.tji:74`): "Withdraw a book's invitations,
remove its members, or take it down, with the owner told why. Workflow 10.
Tests: behavior (each action against Postgres and git, the owner's notice
recorded); e2e-api (a taken-down book refuses clone and push with its reason;
withdrawn invitations no longer accepted)."

**Workflow** — `docs/workflows/10-share.md` §A copyright notice (lines 101-106,
amended by this task — see Decisions): "The service can withdraw a book's
invitations, remove its members, or take the book down altogether, by an admin
action, and the owner is told why. This is a process written down in the terms,
not a feature of the app." The amendment this task carries specifies the
unstated carrier (the operator command, the recorded notice, the reason on the
git refusal). Supporting mechanics it builds on: withdrawal keeps those who
joined (lines 52-53); removal takes effect "at their next request", the shelf
showing "no longer shared with you" (lines 77-81, workflow 8 §Losing access,
lines 64-69).

**DIRECTION:**

- §3.3 (lines 208-211): the copyright-notice obligation, above.
- §3.6 component table (lines 281-286, amended by this task): the admin tool is
  added as a Go operator command in `service/cmd/estante-admin`.
- §3.6 Git over HTTP (lines 318-345, amended): "Authentication and refusals are
  all its own, before git starts. A request with no access, a book over quota, a
  book deleted: refused by the service with a clear message, git never spawned."
  A book taken down joins that list, its reason returned to the book's owner and
  members (line ~340).

**The schema** (`service/internal/db/migrations/0001_registry.sql`): `books`
with `taken_down_reason text` (`:83-92`, reason column `:91`); `memberships`
(`:100-106`, composite PK, `ON DELETE CASCADE`); `invitations` with
`withdrawn_at timestamptz` (`:116-126`); `invitation_joins` (`:133-138`). The
migrator embeds `migrations/*.sql` and applies them in lexical order
(`migrations.go:28-29, :39-42`), so `0004_book_notices.sql` is picked up with no
runner change.

**Code seams to reuse:** `gitAuthorize` (`git.go:196-221`) and its
`resolveBookAccess` call (`:211`); the `querier` interface and the 404-vs-403
ladder (`books.go:420, :263-277`); `writeError` (`respond.go:28`);
`config.Load(os.LookupEnv)` and the pool/migrate frame of
`service/cmd/service/main.go`; `pgx` with plain SQL in a transaction.

**Test precedents:** `service/internal/server/books_test.go:42-78`
(`newBooksEnv(t)` — real accounts and sessions via the software authenticator, a
`t.TempDir()` books root, `httptest.NewServer`); `email_links_test.go:102-143`
(`migratedServerSchema`/`envDSN`, `t.Skip` without `ESTANTE_TEST_DATABASE_URL`);
`books_test.go:414-448` (`seedREADME`/`gitRun`); `git_test.go` (the refusal
cases over `httptest` + real git, the reason on git's channel, `:779-790`);
`migrate_test.go` (`insertAccount`/`insertBook`). e2e-api:
`e2e/api/books.test.js:25` (`registerNewAccount`), the second-`HttpClient`
pattern, `e2e/api/lib/git.js` (`GitCli`/`IsoGit`), `e2e/api/lib/db.js`
(`connect()`), `e2e/api/sharing.test.js` (invite→accept→clone/push precedent).

**Standing rules in scope:** **No song text or secrets in logs** — the command
logs the action, the book id and the outcome; the operator's reason is legal
text, not song text or a secret, and lives in the `book_notices` table (a table,
not a log). **No book without an account / membership** — a taken-down book is
refused everyone; the reason is shown only to a book's owner and members, never
to a stranger (the never-confirm guarantee holds). **Canonical form** and
**offline-first** are not this task's concern (no song parsing, no client
state). **Accessibility** is not this task's concern (no UI — the surfacing of a
notice in the app is out of scope; see Acceptance criteria).

## Constraints / requirements

- **The admin actions are an operator command, not an endpoint and not an app
  feature.** `service/cmd/estante-admin <action> <bookId> --reason "<text>"`,
  run inside the service container with the service's own environment
  (`ESTANTE_DATABASE_URL`, `ESTANTE_BOOKS_ROOT`). There is **no HTTP surface**
  for these actions: adding one would need an operator-authentication model that
  DIRECTION does not describe and would expose a moderation surface on the public
  origin. The three subcommands are `take-down`, `withdraw-invitations`,
  `remove-members`; each requires a non-empty `--reason`; an unknown action, a
  non-UUID or unknown `bookId`, or a missing reason exits non-zero with a message
  on stderr and changes nothing.
- **Each action is one transaction, and records a notice.** The mutation and the
  `book_notices` insert commit together, so a notice without its effect (or an
  effect without its notice) is impossible. The notice captures `book_id`, the
  owner id read from `books.owner_id` at action time, the `action`, the `reason`,
  and `created_at`.
  - `take-down`: `UPDATE books SET taken_down_reason = $reason WHERE id = $book
    AND deleted_at IS NULL` (a deleted book is already gone — refuse with a
    message, write nothing); then the notice.
  - `withdraw-invitations`: `UPDATE invitations SET withdrawn_at = now() WHERE
    book_id = $book AND withdrawn_at IS NULL`; then the notice. Idempotent — a
    re-run withdraws nothing new but still records the notice only if it changed
    rows (Decisions).
  - `remove-members`: `DELETE FROM memberships WHERE book_id = $book`; then the
    notice. `invitation_joins` rows are left untouched (history, workflow 10 line
    52). The owner is never a membership row, so ownership is unaffected.
- **A taken-down book's git refusal carries the reason to its owner and
  members.** In `gitAuthorize`, when `resolveBookAccess` returns `found=false`,
  look up whether the book exists, has `taken_down_reason` set, and the caller is
  its owner or holds a membership row. If so, refuse **`403` with `code:
  "taken_down"`** and the reason in the message, for info/refs, upload-pack and
  receive-pack alike (so clone, fetch and push all carry it). Otherwise the
  existing `404 "No such book."` stands — a stranger, a removed member, or a
  deleted book learns nothing. Git is never spawned (DIRECTION §3.6 lines
  338-341). The lookup is one query; membership is not filtered by
  `taken_down_reason` (take-down does not remove memberships).
- **The reason is shown only to insiders.** The take-down reason reaches a book's
  owner and current members (who already know the book exists and had access),
  never a stranger. This is why the branch checks owner/membership before
  returning the reason, and why a stranger keeps the undifferentiated `404`.
- **Surfacing the notice in the app is out of scope.** Workflow 10 (line 106)
  frames the notice as a terms process, "not a feature of the app"; the app's
  losing-access surface (workflow 8 §Losing access, `BookDetail.jsx`) shows the
  generic "no longer shared with you", not an operator reason, and building an
  in-app notice inbox is the deferred "telling people" channel (workflow 10
  *Later*). This task records the notice durably and conveys the take-down reason
  over git; it does not add an app surface.
- **One binary, standard library, contract-first.** `pgx` with plain SQL in a
  transaction; the git refusal uses the existing `writeError`; the `403
  taken_down` response is added to the git routes in `api/openapi.yaml` and the
  git behavior tests assert the declared status.
- **No song text or secrets in logs.** The command logs the action, book id and
  outcome only. The reason is stored in `book_notices`, not logged.

## Acceptance criteria

**Behavior delivered:**

1. **Take a book down.** `estante-admin take-down <bookId> --reason "<text>"`
   sets `books.taken_down_reason`, records a `book_notices` row (`action =
   take_down`, the reason, the owner), and exits zero. The book then refuses
   every git request: its owner and members get `403 taken_down` carrying the
   reason on clone, fetch and push; a stranger gets `404`. A non-UUID/unknown
   book, a deleted book, or a missing reason changes nothing and exits non-zero.
2. **Withdraw a book's invitations.** `estante-admin withdraw-invitations
   <bookId> --reason "<text>"` sets `withdrawn_at` on every not-yet-withdrawn
   invitation of the book and records a `book_notices` row (`action =
   withdraw_invitations`). A later accept of any of those tokens → `409
   invitation_withdrawn`; those who already joined keep access.
3. **Remove a book's members.** `estante-admin remove-members <bookId> --reason
   "<text>"` deletes every membership of the book and records a `book_notices`
   row (`action = remove_members`). Each former member then resolves as
   inaccessible (`resolveBookAccess` miss → their next `listBooks` omits the
   book, their next push is refused by git), while `invitation_joins` history and
   the owner are untouched.

**Tests the task lands with, by level.** The note names **behavior** and
**e2e-api**; this refinement adds a **unit** level for the pure argument parser
(a sliver that otherwise only `main` would touch), so the command's wiring is
pinned without a `main`.

- **unit** — `service/cmd/estante-admin/args_test.go` (`go test`, no DB):
  - `parseArgs(["take-down", "<uuid>", "--reason", "x"])` → the action, book id
    and reason; the three valid actions parse; an unknown action, a missing
    book id, a non-UUID book id, and a missing/empty `--reason` each return an
    error. *Pins:* the command contract (Constraints §1); the `book_notices`
    `action` CHECK (migration `0004`).
- **behavior** — `service/internal/admin/admin_test.go` (`httptest`-free Go,
  `migratedServerSchema` real Postgres, `t.Skip` without
  `ESTANTE_TEST_DATABASE_URL`) and new cases in
  `service/internal/server/git_test.go` (`httptest` + real git):
  - **take-down records and gates.** Seed an owner, a book, a member; run
    `admin.TakeDown`; assert `taken_down_reason` is set and a `book_notices` row
    with `action = take_down`, the reason and the owner exists; then over
    `httptest` + real git the owner's and the member's info/refs and
    git-receive-pack get `403 taken_down` with the reason, while a non-member
    gets `404`. A deleted book and a missing reason are refused with no write.
    *Pins:* task note ("each action against Postgres and git, the owner's notice
    recorded"); workflow 10 lines 103-106; DIRECTION §3.6 git refusals
    (lines 338-341); contract git routes + the `taken_down` response.
  - **withdraw-invitations records and stops joins.** Seed an owner, a book, two
    live invitations, one already-joined member; run `admin.WithdrawInvitations`;
    assert both invitations now have `withdrawn_at`, a `book_notices` row
    (`withdraw_invitations`) exists, and (through the sharing accept path) a new
    accept of either token → `409 invitation_withdrawn` while the joined member
    keeps their membership. *Pins:* workflow 10 lines 52-53, 103-106;
    `invitations.withdrawn_at` (`0001:125`).
  - **remove-members records and clears access.** Seed an owner, a book, an
    editor and a reader; run `admin.RemoveMembers`; assert both membership rows
    are gone, a `book_notices` row (`remove_members`) exists, the
    `invitation_joins` rows survive, and `resolveBookAccess` now misses for each
    former member while the owner still resolves as owner. *Pins:* workflow 10
    lines 77-81, 103-106; `memberships` (`0001:100-106`).
- **e2e-api** — `e2e/api/admin.test.js` (black-box over the compose stack;
  accounts via `registerNewAccount`, git via `GitCli`/`IsoGit` with each
  client's `cookieHeader()`; the operator effect seeded through
  `e2e/api/lib/db.js connect()`, the sanctioned seam for a precondition no
  endpoint provides — see Decisions):
  - **a taken-down book refuses clone and push with its reason.** An owner
    creates and pushes a book, a second account accepts an editor invitation and
    clones it; the operator effect is applied (`UPDATE books SET
    taken_down_reason`); then the owner's and the editor's clone and push are both
    refused `403` carrying the reason, while a third, non-member account's clone
    is refused `404`. *Pins:* task note e2e; workflow 10 lines 103-106; DIRECTION
    §3.6 lines 338-341; contract `taken_down` response.
  - **withdrawn invitations no longer accepted.** An owner creates an editor
    invitation; the operator effect is applied (all invitations withdrawn); a
    fresh account's accept of that token → `409 invitation_withdrawn`, and an
    already-joined member keeps access (its `listBooks` still shows the book).
    *Pins:* task note e2e; workflow 10 lines 52-53.

**Deferred follow-up (closer registers in WBS).** One concrete, agent-
implementable piece is deferred:

- **`books.notice_surface`** — *app work, ~2d, estante-de-cifras `app/`.* A
  book-detail notice that shows the owner/members the operator's recorded reason
  when a book is taken down: the Worker's sync engine maps the git `403
  taken_down` to a distinct halted state carrying the reason, and `BookDetail.jsx`
  renders it (a `role="status"` notice, distinct from the generic "no longer
  shared with you") beside the existing Download card. `depends sync.lost_access,
  service.admin`. Milestone: the same milestone that carries the losing-access
  surface (the books/sync app milestone, M4-adjacent — the closer wires it where
  `sync.lost_access` sits). *Tests: behavior (`BookDetail` renders the taken-down
  notice with the reason, axe clean; the sync engine's `403 taken_down`
  classification — `access-refused.js`); e2e-web (a taken-down book shows its
  reason on phone, tablet and computer, axe on the screen).* This is a genuine
  app surface, not an "audit" task; it is deferred because workflow 10 frames the
  notice as a terms process and the app surface is additive to the service record
  this task lands. **Not deferred:** every test for what *this* task delivers (the
  command, the record, the git reason) lands here.

The broader "actively telling people a book changed / someone tried" channel
(workflow 10 *Later*) remains a product/UX decision spanning app and service,
surfaced for the parking lot, not a WBS leaf.

## Decisions

- **The admin actions are a server-side command, not a public endpoint.**
  *Chosen:* a `service/cmd/estante-admin` binary the operator runs inside the
  service container with the service's own environment; the operation logic in a
  testable `service/internal/admin` package. *Rejected:* an `/api/admin/*` HTTP
  endpoint — it would require an operator-authentication model (an admin account
  flag, an admin session) that nothing in DIRECTION describes, and would put a
  moderation surface on the public origin; workflow 10 (line 106) says this is
  "not a feature of the app." *Rejected:* the operator editing Postgres by hand
  with no tool — the actions must be atomic with the notice record and the
  take-down must pair with the git-reason surfacing, which raw `UPDATE`s would not
  guarantee or test. *Design delta:* DIRECTION §3.6's component table gains the
  admin tool (a new row), and the Dockerfile ships the binary.
- **"The owner is told why" is a durable `book_notices` record, plus the reason
  on the take-down git refusal.** *Chosen:* a new `book_notices` table every
  action writes (book, owner, action, reason, time), and, for take-down, the
  reason returned over git to the book's owner and members. *Rejected:* reusing
  `taken_down_reason` alone — it covers only take-down, leaving withdraw and
  remove with nowhere to record their reason, and the note's test is "the owner's
  notice recorded" for *each* action. *Rejected:* building an in-app notice inbox
  now — workflow 10 defers active "telling people" to *Later* and frames the
  notice as a terms process; the durable record is the task's obligation, the app
  surface is deferred (`books.notice_surface`). The reason is legal text, stored
  in a table, never logged (the "no secrets in logs" rule is about tokens and
  song text, not an operator's recorded reason). *Design delta:* workflow 10 §A
  copyright notice gains the carrier specification.
- **A taken-down book's reason is shown to its owner and members, a stranger
  still gets `404`.** *Chosen:* add one branch in `gitAuthorize` after the
  `resolveBookAccess` miss — if the book exists, is taken down, and the caller is
  owner or member, refuse `403 taken_down` with the reason; else the existing
  `404`. *Rejected:* returning the reason to everyone — that would confirm a
  private book's existence (and its take-down) to a stranger, breaking the
  never-confirm guarantee (`service.git_http`; 404-vs-403 ladder). *Rejected:*
  leaving the bare `404` for everyone — the note requires the refusal to carry
  "its reason", and the owner/members are precisely who the terms process must
  reach. *Rejected:* carrying the reason on the change-check `gone` answer instead
  — the change check deliberately leaks nothing from server state (it answers from
  the caller's supplied head), so the reason belongs on the git refusal, which is
  already authenticated and book-scoped. *Design delta:* DIRECTION §3.6's git-
  refusal list gains the taken-down case; `api/openapi.yaml` gains the `403
  taken_down` response on the git routes.
- **`withdraw-invitations` and `remove-members` are book-level, not per-item.*
  *Chosen:* the admin forms act on *all* of a book's invitations / members at
  once — the blunt instruments a notice calls for, matching workflow 10's plural
  "its invitations" / "its members". *Rejected:* per-item admin variants — the
  owner already has per-item controls (`service.sharing`); the operator's job in a
  copyright notice is to stop the sharing wholesale, and a per-item operator tool
  would add surface without a use. No delta.
- **The git repository is left on the volume on take-down; take-down is a flag.**
  *Chosen:* set `taken_down_reason` and leave `/data/books/<id>.git` in place,
  so a take-down is reversible by the operator (clearing the flag by hand) and no
  data is destroyed by a moderation action that may be contested. *Rejected:*
  deleting the repository — destructive, irreversible, and beyond what "take the
  book down" (make it unreachable) requires; deletion is the owner's own
  `DELETE /api/books/{bookId}`. No restore command is built (clearing one column
  is a direct, rarely-used operator edit, not a WBS task). No delta.
- **The operation logic is a small `service/internal/admin` package behind a thin
  command.** *Chosen:* the three operations as functions over a `querier`, unit-
  and behavior-testable without a `main`; `cmd/estante-admin` only parses
  arguments and opens the pool. *Rejected:* putting the logic in `cmd` directly —
  a `main` is awkward to test against real Postgres; the package split lets the
  behavior tests exercise the real operations and keeps the untested sliver to
  `main`'s `os.Exit` wrapper (the arg parser is pure and unit-tested). *Rejected:*
  a new `service/internal/server` handler file (the sharing/change-check pattern)
  — there is no HTTP handler here, so the server package is the wrong home. No
  delta.
- **The e2e-api test drives the operator effect through `lib/db.js`, not the
  binary.** *Chosen:* the e2e seeds the taken-down / all-withdrawn state via the
  sanctioned `connect()` Postgres seam (`e2e/api/lib/db.js`, whose purpose is "to
  seed a precondition that no landed endpoint yet provides"), then asserts the
  stack's observable refusals — the valuable integration (the git `403 taken_down`
  reason over the real stack, a withdrawn accept → `409`). *Rejected:* shelling
  `docker compose exec service estante-admin …` from the Node harness — it would
  couple the black-box suite to the random compose project name `scripts/gate`
  sets and to docker internals, a fragile new capability; the binary's own logic
  (the exact rows and notice it writes) is fully pinned by the Go behavior tests
  against real Postgres, and its argument wiring by the unit test. No delta.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- `service/internal/db/migrations/0004_book_notices.sql` — new `book_notices` table (book, owner, action, reason, created_at); `action` CHECK constrains to the three valid values.
- `service/internal/admin/admin.go` — new `admin` package: `TakeDown`, `WithdrawInvitations`, `RemoveMembers`; each atomic with its `book_notices` insert; deleted/already-taken-down books and missing reasons refused before any write.
- `service/cmd/estante-admin/main.go` + `args.go` — new operator CLI; pure argument parser in `args.go` unit-tested without a DB.
- `service/cmd/estante-admin/args_test.go` + `service/internal/admin/admin_test.go` — unit tests (three actions parse, invalid inputs refused) and behavior tests against real Postgres (each operation records, idempotency, refused states).
- `service/internal/server/git.go` — `gitAuthorize` taken-down-insider branch: owner or member of a taken-down book → `403 taken_down` with reason; stranger keeps `404`.
- `service/internal/server/git_test.go` — new `TestTakenDownGitRefusal` cases over `httptest` + real git: owner and member get `403`, non-member gets `404`.
- `api/openapi.yaml` — `GitForbidden` response schema; `403` added to info/refs, upload-pack and receive-pack routes.
- `Dockerfile` — builds and ships `estante-admin` beside the service binary.
- `docs/DIRECTION.md` + `docs/workflows/10-share.md` — design deltas: admin tool in §3.6 component table; taken-down git refusal in §3.6; carrier specification in workflow 10 §A copyright notice.
- `e2e/api/admin.test.js` — two e2e-api tests: taken-down book refuses clone/push with reason (owner + member `403`, stranger `404`); withdrawn invitations no longer accepted (`409`), joined member keeps access.

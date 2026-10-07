# service.schema — Postgres schema and migrations

## TaskJuggler

[`tasks/30-service.tji`](../../30-service.tji), `task service.schema`
("Postgres schema and migrations"). No explicit `depends`; it inherits the
parent `service` task's dependencies (`foundation.service_skeleton`,
`foundation.api_contract`, `foundation.e2e_api`). It is the first child of
`service` and every other service task depends on it, directly
(`service.passkeys`, `service.email_links`, `service.books`) or transitively.

## Effort estimate

`2d` (from the `.tji`). The relational model itself is not large — nine
tables — but it is load-bearing: it fixes the names, keys and constraints
that the eight downstream service tasks write against, so the effort is in
getting the shapes and the invariants right against the API contract and the
workflows, plus the net-new plumbing this task introduces to the service for
the first time: the `pgx` dependency, a connection pool, an embedded
forward-only migrator, the DSN config seam, and a Postgres-backed readiness
check. The behavior tests run against real Postgres from compose.

## Repository

**estante-de-cifras.** Directories:

- `service/` — the Go changes: a new `internal/db` package (the `pgxpool`
  owner, the embedded migrator, and the versioned `.sql` migrations under
  `internal/db/migrations/`); one new `Config` field for the DSN
  (`internal/config/config.go`); the pool constructed and migrated at
  start-up in `cmd/service/main.go`; a `/readyz` readiness handler in
  `internal/server/` threaded the pool.
- `e2e/api/` — one new black-box spec proving the real image connected to
  Postgres and migrated at start-up (`/readyz`).
- `compose.yaml` — one line: pass `ESTANTE_DATABASE_URL` to the `service`
  container so its start-up migration runs against the stack's Postgres (the
  compose block already stands up Postgres and the `service` `depends_on` it
  healthy; only the env wiring is missing).

Not a cifra.md task (the note does not start with `cifra.md:`). The app and
the service **share no code** (DIRECTION §3.6 line 288); nothing in this task
is visible to the app except through the API contract the downstream tasks
implement.

## Inherited dependencies

All three predecessors are **settled** (Done, 2026-10-05):

- **`foundation.service_skeleton`** (settled) — the module and the seams this
  task extends. The Go module is `estantedecifras.app/service`, `go 1.25`,
  **stdlib-only with no `go.sum`** today
  ([`service/go.mod`](../../../service/go.mod)) — this task adds the service's
  first third-party dependency. `Config` is a typed struct built by a pure
  `Load(lookup)` in
  [`service/internal/config/config.go`](../../../service/internal/config/config.go);
  its doc comment (lines 24–27) already reserves **"the Postgres DSN in
  `service.schema`"** as the field this task adds, and `ESTANTE_*` (lines
  36–38) is the service's own env namespace. `cmd/service/main.go`'s `run()`
  (lines 34–77) is where the pool is constructed and migrations applied
  before `ListenAndServe`. `server.Handler(logger, appRoot)`
  ([`service/internal/server/server.go:23-37`](../../../service/internal/server/server.go))
  is the frame the readiness route hangs on; `internal/server/health.go`'s
  doc comment parks **"a readiness check that touches Postgres"** for exactly
  this task. The request-logging middleware logs metadata only — this task
  must keep it so (no DSN, no song text, nothing).
- **`foundation.api_contract`** (settled) — the domain the schema must match,
  byte for byte. [`api/openapi.yaml`](../../../api/openapi.yaml) fixes:
  `Role` = `[owner, editor, reader]` (lines 835–838) and `InvitableRole` =
  `[editor, reader]` (lines 840–843); `ExpiryChoice` =
  `[day, week, month, until-withdrawn]`, default a week (lines 1155–1158); an
  `Invitation` with a role, an expiry, an optional `useLimit` (minimum 1,
  unlimited when absent), the set of `joined` and a `joinedCount ≥ 0`, and a
  `withdrawn` flag (lines 1173–1220); a `Book` created private with an
  optional single-level `Original` (lines 1001–1037); a `Session` with
  `lastUsedAt` and a derived `current` flag (lines 946–962); a `Passkey` with
  a `label`, `createdAt`, `lastUsedAt` (lines 973–988); opaque server-assigned
  `Id`s (lines 814–817); the members count is "besides the owner", shown "37
  of 50" (lines 416–418). Membership rule: non-member → `404` (existence not
  leaked), insufficient role → `403` (lines 774–797); a full/expired/exhausted/
  withdrawn invitation → `409` (line 557). The service later imports `api/`'s
  Go validator; the schema just has to agree with these shapes.
- **`foundation.e2e_api`** (settled) — the harness the `/readyz` spec lives in
  (Node + Vitest, plain ESM, `*.test.js` under
  [`e2e/api/`](../../../e2e/api/), `new HttpClient()` against
  `ESTANTE_E2E_BASE_URL` with a cookie jar; model
  [`e2e/api/health.test.js`](../../../e2e/api/health.test.js)). It does **not**
  touch Postgres directly — that is the Go behavior tests' job, via
  `ESTANTE_TEST_DATABASE_URL`, which `scripts/gate` exports (line 255) from the
  compose stack it brings up before the service's `go test` runs (gate lines
  330–347).

## What this task is

The service's first contact with Postgres: it adds `pgx`, a connection pool,
and an embedded forward-only migrator, then writes the versioned SQL
migrations that create the whole registry the one server keeps in Postgres —
**accounts, passkeys, sessions (the signed-in devices), books, memberships
with roles, invitations with an expiry and a use-limit, who joined through
each, and the per-book byte accounting the quotas are computed from** — with
the constraints the downstream service tasks rely on built in: one membership
per person per book, an invitation's remaining uses never below zero, the
foreign keys that make "no book without an account" a schema fact. The DSN
comes from `ESTANTE_DATABASE_URL`; migrations are applied at start-up (and by
tests against a scratch schema); a `/readyz` route pings the pool so the stack
and ops can tell the service is wired to its database.

## Why it needs to be done

Every other `service.*` task persists something: `service.passkeys` stores
credentials and signs people in, `service.books` creates and forks
repositories owned by accounts, `service.sharing` invites and admits members,
`service.git_http` checks a session and a membership before it runs git. They
all depend on `!schema` (directly or through `!books`/`!sessions`). The schema
is the shared ground they stand on; defined once here, with the invariants
pinned, each downstream task writes behavior against existing tables instead of
shipping its own ad-hoc DDL and re-deciding the same keys. It is also where the
service first learns to talk to Postgres at all — the pool, the migrator and
the DSN config are plumbing every later task consumes.

## Inputs / context

Governing documents (the `.tji` note lists the entities; DIRECTION §3.3 is the
north star, DIRECTION §3.6 fixes the tooling, and workflows 7, 10, 11, 13 and
14 fix the rules):

- **DIRECTION §3.3, the registry** —
  [`docs/DIRECTION.md:184-185`](../../../docs/DIRECTION.md): "**Postgres** holds
  **accounts, sessions and passkeys**, and the **book registry**: each book's
  **owner, its members and their roles, and its invitations**." The volume, not
  Postgres, holds book content: one bare repo per book at `/data/books/<id>.git`
  (lines 186–187); git objects are deliberately **not** in Postgres (§3.5 lines
  267–271). Hard rules: no book reachable without an account and **at most
  fifty people besides the owner** (lines 175–176); every book request needs a
  session and a membership, no anonymous read (lines 176–178); `noindex` on
  everything (lines 178–179). An account is recognised in git history by a
  per-user no-reply address `<user-id>@users.estantedecifras.app`, never the
  real email (lines 164–171). The service refuses before git starts on no
  access, a book over quota, or a **deleted** book (§3.6 lines 337–340) — so a
  book carries a lifecycle state. The hook is handed `ESTANTE_USER`,
  `ESTANTE_BOOK`, `ESTANTE_ROLE` and **what the account has left of its limits**
  (§3.6 lines 341–345) — the service computes those from this schema.
- **DIRECTION §3.6, the tooling** —
  [`docs/DIRECTION.md:313-315`](../../../docs/DIRECTION.md): "`net/http`; **`pgx`
  for Postgres**; `go-webauthn` for passkeys." So `pgx` is already the
  constitution's choice — adding it is implementing DIRECTION, not a new
  dependency decision. The API surface (lines 359–371) maps 1:1 to these
  tables.
- **DIRECTION §3.4, one instance** —
  [`docs/DIRECTION.md:226-229`](../../../docs/DIRECTION.md): a volume belongs to
  one instance; repositories have one owner. The service is a single instance,
  so a forward-only migrator run at start-up has no concurrent-migrator problem.
- **Workflow 10 (share)** — [`docs/workflows/10-share.md`](../../../docs/workflows/10-share.md):
  three roles, **owner** (one per book), **editor**, **reader** (lines 63–69);
  **at most fifty members besides the owner**, "the service enforces the count,
  not the app" (lines 28–39); invitations are by link not email — "the service
  holds nobody's address before they have agreed" (lines 41–45); each has an
  expiry chosen at creation (day, a week by default, month, or until withdrawn,
  lines 49–50) and an optional limit on uses down to one (lines 50–51); the
  owner sees **who joined through each invitation** and can withdraw it — no one
  new joins, existing members stay (lines 52–53); accepting puts the book on the
  joiner's shelf (lines 59–61); removal and role-lowering take effect at the
  member's **next request** (lines 78–85); who-sees-whom (lines 72–75).
- **Workflow 13 (new device / sign-in)** —
  [`docs/workflows/13-new-device.md`](../../../docs/workflows/13-new-device.md):
  several passkeys per account, listed and removable (line 73); **signed-in
  devices**, each with when it was last used, and sign out for any of them —
  a revoked session stops working at its **next request** (lines 69–72);
  emailed sign-in links are the fallback and recovery path (lines 25–27). The
  **shelf** lives in the home book (git), not Postgres (lines 38–43); working
  copies never travel (lines 53–55).
- **Workflows 7 & 11 (books, fork)** —
  [`docs/workflows/07-add-a-book.md`](../../../docs/workflows/07-add-a-book.md)
  and [`docs/workflows/11-fork.md`](../../../docs/workflows/11-fork.md): a book
  has a stable opaque id behind the app link `…/b/<book>` (07 lines 40–43); it
  goes online **private**, owner-only (07 lines 46–52); delete is owner-only (07
  lines 128–138); a fork is a copy on the same volume that **remembers its
  single-level original** — nothing follows more than one step, and the original
  may go away without touching the fork (11 lines 33–39, 51–54).
- **Workflow 14 (what a push may hold)** —
  [`docs/workflows/14-file-view.md`](../../../docs/workflows/14-file-view.md),
  "Limits" (lines 39–48): **256 KB per file, 50 MB per book with its history,
  100 books and 200 MB per account (forks included)**; the hook checks "the
  limits above, for the book and for its owner's account" (line 111). These are
  the quota figures DIRECTION refers to abstractly; they are constants in code,
  and this schema stores the inputs they are checked against (per-book size,
  ownership).

Service and infrastructure seams (real paths):

- [`service/go.mod`](../../../service/go.mod) — stdlib-only; this task adds
  `github.com/jackc/pgx/v5`. A `go.sum` appears for the first time (see the
  memory note on lockfiles + network: `go mod download` may need network the
  sandbox blocks; vendor or pre-populate the module cache if so).
- [`service/internal/config/config.go:24-40`](../../../service/internal/config/config.go)
  — the `Config` seam; add `DatabaseURL string` read from
  `ESTANTE_DATABASE_URL`.
- [`service/cmd/service/main.go:34-77`](../../../service/cmd/service/main.go) —
  `run()`; construct the pool, `Migrate`, pass the pool to `Handler`, close the
  pool on shutdown.
- [`service/internal/server/server.go:23-37`](../../../service/internal/server/server.go)
  — `Handler`; add the pool parameter and register `GET /readyz`.
- [`compose.yaml:19-38`](../../../compose.yaml) — the `postgres` service
  (`postgres:17-alpine`, creds `estante/estante/estante`, loopback port);
  [`compose.yaml:55-91`](../../../compose.yaml) — the `service` container,
  already `depends_on: postgres: service_healthy`, lacking only the DSN env.
- [`scripts/gate:247-267`](../../../scripts/gate) — `stack_up`; line 255 exports
  `ESTANTE_TEST_DATABASE_URL=postgres://estante:estante@127.0.0.1:<port>/estante?sslmode=disable`;
  lines 330–347 run the service's `go test` with the stack up.
- [`Dockerfile:39-68`](../../../Dockerfile) — the service build stage and
  `ENTRYPOINT ["service"]`; the binary migrates on start, so the deployed image
  needs no migration step of its own.

## Constraints / requirements

- **`pgx` is the client; no ORM.** DIRECTION §3.6 line 313 names `pgx`. Use
  `pgxpool` for the pool. No ORM, no query builder — plain SQL, matching the
  skeleton's "nothing unusual" posture.
- **Forward-only, embedded, versioned migrations.** Numbered `.sql` files under
  `service/internal/db/migrations/` (e.g. `0001_registry.sql`), embedded with
  `//go:embed`, applied in lexical order inside a transaction each, tracked by a
  `schema_migrations` table (version, applied_at). No down migrations (DIRECTION
  §3.4, one instance; recovery is restore-from-backup, §3.4 lines 236–239). The
  migrator operates in the connection's current schema/`search_path` so a test
  can run it into a throwaway schema.
- **Migrate at start-up.** `run()` applies all pending migrations before the
  server accepts traffic and fails fast if they error (the skeleton's fail-fast
  rule). On the single instance this is race-free.
- **The schema stores identity and the registry only — never song text.** All
  song and setlist content, and all history, live in the git repositories on
  the volume (DIRECTION §3.3 lines 186–187, §3.5 lines 267–271). Postgres holds
  no book content, no commit messages, no working copies, no shelf, no device
  sync heads (the device supplies its head per request; workflow 8, DIRECTION
  lines 364–365). This upholds **no song text in logs/stores** and keeps storage
  replaceable.
- **"No book without an account" is a foreign key.** `books.owner_id`,
  `memberships.account_id`, `sessions.account_id`, `passkeys.account_id`,
  `invitations.book_id` are all `NOT NULL` references, so an orphaned book or a
  bookless membership cannot exist.
- **The invariants the note names, as constraints.** One membership per person
  per book → `UNIQUE (book_id, account_id)` on `memberships`. An invitation's
  remaining uses never below zero → `CHECK (uses_remaining IS NULL OR
  uses_remaining >= 0)` on `invitations`. Role columns are a Postgres `enum`
  (or `TEXT` + `CHECK`) matching the API's `Role`/`InvitableRole` exactly.
- **Match the API contract exactly.** Enums, nullability and the owner/member
  split must agree with `api/openapi.yaml` so the downstream handlers need no
  schema surprises.
- **`ESTANTE_*` namespace, one origin.** The DSN env var is
  `ESTANTE_DATABASE_URL`; `compose.yaml` passes it to the `service` container.
  No CORS, no new origin.
- **Keep logging metadata-only.** The pool, the migrator and the readiness
  handler log no DSN, no credentials, no query text with data.

## The tables

Nine tables in the first migration (the exact column spellings are the
implementer's within these shapes; the keys, enums and constraints are fixed):

1. **`accounts`** — opaque `id` PK (the `<user-id>` of the authoring address,
   DIRECTION §3.3 lines 164–165); `email` (unique when present, nullable — the
   address the sign-in/recovery link is mailed to, workflow 13; invitees are not
   stored until they accept, workflow 10 lines 44–45); `created_at`.
2. **`passkeys`** — `id` PK; `account_id` → `accounts` (cascade); the standard
   WebAuthn credential columns `go-webauthn` needs (`credential_id` unique,
   `public_key`, `sign_count`, `aaguid`, `transports`, backup flags); `label`;
   `created_at`; `last_used_at`. Several per account.
3. **`sessions`** (the signed-in devices) — `id` PK; `account_id` → `accounts`
   (cascade); `created_at`; `last_used_at`; `revoked_at` (nullable). A row is
   one signed-in device; revocation sets `revoked_at` and is enforced lazily at
   the device's next request (workflow 13 lines 69–72).
4. **`books`** — opaque `id` PK (random; the volume path `/data/books/<id>.git`
   is derived, DIRECTION lines 186–187); `owner_id` → `accounts`; `visibility`
   (`private` today, API `Book.visibility` line 1026); `original_book_id` →
   `books` (nullable, single-level fork original, workflow 11 lines 37–39);
   `size_bytes` (the book's size with history, the input to the per-book and
   per-account quotas; maintained by the push path in `service.git_http`/the
   hook); `created_at`; `deleted_at` and `taken_down_reason` (nullable — the
   deleted/taken-down lifecycle the git refusal reads, DIRECTION §3.6 lines
   337–340, workflow 10 lines 103–106).
5. **`memberships`** — `book_id` → `books` (cascade); `account_id` → `accounts`;
   `role` enum `editor`/`reader` (the owner is `books.owner_id`, not a
   membership row — see Decisions); `created_at`; `UNIQUE (book_id, account_id)`.
6. **`invitations`** — opaque `id` PK; a separate secret `token` (hashed, unique)
   that the accept link carries (API `InvitationToken` param vs the `id`);
   `book_id` → `books` (cascade); `role` enum `editor`/`reader` (`InvitableRole`);
   `expiry` enum `day`/`week`/`month`/`until-withdrawn` and the resolved
   `expires_at` (nullable for until-withdrawn); `uses_remaining` (nullable =
   unlimited, `CHECK >= 0`); `created_at`; `withdrawn_at` (nullable).
7. **`invitation_joins`** — `invitation_id` → `invitations` (cascade);
   `account_id` → `accounts`; `joined_at`; `UNIQUE (invitation_id, account_id)`.
   Records who joined through each invitation (workflow 10 lines 52–53); the
   owner's "who joined" list reads it.
8. **`email_login_links`** — *created by `service.email_links`, not here.* Left
   out deliberately (the note does not list it); the versioned migrator this
   task builds is what lets that task add its own `0002_email_links.sql`. Noted
   so the omission is a decision, not a gap.
9. **`schema_migrations`** — the migrator's own bookkeeping (`version`,
   `applied_at`).

(Quotas are not a table: the limits — 256 KB/file, 50 MB/book, 100 books and
200 MB/account, forks included, workflow 14 lines 39–48 — are code constants;
the schema stores the inputs they check against, `books.size_bytes` and
`books.owner_id`, which the service aggregates per owner and hands the hook as
remaining-limit env, DIRECTION §3.6 lines 341–345.)

## Acceptance criteria

**Behavior delivered:** the service connects to Postgres with a `pgxpool` built
from `ESTANTE_DATABASE_URL`; on start-up it applies every pending embedded
migration, in order, idempotently, and refuses to serve if one fails; a fresh
database taken from empty to the latest migration has all nine tables with the
owner/member split, the role and expiry enums, the single-level fork original,
the book lifecycle columns and the byte-accounting column; the invariants hold
at the database — a duplicate membership is rejected, an invitation's remaining
uses cannot go below zero, a bookless membership or ownerless book cannot be
inserted; `GET /readyz` returns `200` when the pool reaches Postgres and `503`
when it cannot; `GET /healthz` stays a pure, I/O-free liveness check; no DSN,
credential or song text reaches a log.

**Tests the task lands with, by level.** (The note names only behavior; a
`unit` level is added for the pure migrator and the new `Config` field, and one
`e2e-api` assertion proves the real image migrates at start-up — both
sharpenings, see Decisions.)

- **unit** (`go test`, no database):
  - `service/internal/db/migrations_test.go` (new) — the embedded migration
    set is non-empty, strictly increasing and well-named, and the planner
    selects exactly the pending versions given a recorded set. *Pins:* the
    forward-only versioned-migrations decision and the `.tji` "versioned
    migrations".
  - `service/internal/config/config_test.go` (extended) — `ESTANTE_DATABASE_URL`
    is read into `Config.DatabaseURL`; empty/unset handled like the other vars.
    *Pins:* the DSN config seam (`config.go:24-27`), DIRECTION §3.6 line 313.
- **behavior** (`go test` against compose Postgres via
  `ESTANTE_TEST_DATABASE_URL`; each test migrates into a freshly-created,
  uniquely-named schema and drops it, so every run is empty→latest and runs are
  isolated; `t.Skip` when the DSN is unset so a standalone `go test` stays
  green):
  - `service/internal/db/migrate_test.go` (new):
    - **every migration, empty to latest** — a scratch schema migrated from
      nothing to HEAD, then a second `Migrate` is a no-op (idempotent); all nine
      tables and the enums exist. *Pins:* the `.tji` "every migration applied
      from empty to the latest", DIRECTION §3.3 lines 184–185.
    - **one membership per person per book** — a second `memberships` row for
      the same `(book_id, account_id)` is rejected. *Pins:* the `.tji`
      constraint, workflow 10 lines 28–39.
    - **invitation uses never below zero** — `uses_remaining` cannot be set/
      decremented below `0`; `NULL` means unlimited. *Pins:* the `.tji`
      constraint, workflow 10 lines 50–51; API `Invitation.useLimit` (line 1185),
      `joinedCount ≥ 0` (lines 1215–1220).
    - **no book without an account** — a `books` row with no `owner_id`, and a
      `memberships`/`invitations` row for a missing book or account, are all
      rejected by the foreign keys. *Pins:* DIRECTION §3.3 lines 175–178.
    - **the registry shape** — the owner is `books.owner_id` and not a
      `memberships` row; `role` accepts only the enum values; a single-level
      `original_book_id` resolves and may be set `NULL` without deleting the
      fork. *Pins:* API `Role`/`InvitableRole` (lines 835–843), `Original`
      (lines 1001–1012); workflow 11 lines 37–39.
  - `service/internal/server/ready_test.go` (new) — `GET /readyz` is `200`
    against a reachable pool and `503` against a closed one (httptest with a
    real pool); `/healthz` unchanged and I/O-free. *Pins:* the readiness check
    the skeleton parked here (`health.go`), DIRECTION §3.3.
- **e2e-api** (`e2e/api/`, against the compose stack):
  - `e2e/api/ready.test.js` (new) — `GET /readyz` → `200` against the live
    image, proving the deployed binary read `ESTANTE_DATABASE_URL`, reached the
    stack's Postgres and applied its migrations at start-up. *Pins:* DIRECTION
    §3.3 (one server, Postgres beside it) and the migrate-at-start-up decision;
    exercises the `compose.yaml` DSN wiring.

**No deferred follow-ups.** `service.email_links` adds its own
`email_login_links` migration; `service.books`, `service.sharing`,
`service.git_http` and the sign-in tasks implement behavior against the tables
created here and add a versioned migration only if they need a new column —
that is the WBS order, not a deferral. The fifty-member cap is enforced by
`service.sharing` (workflow 10 line 34, "the service enforces the count"); this
task gives it the `UNIQUE` constraint and the cheap per-book count it needs. The
quota figures are enforced by the hook with the remaining-limit env the service
computes (`service.git_http`); this task stores their inputs. No tech debt
registered.

## Decisions

- **A small in-house embedded migrator, not a migration library.** *Chosen:*
  numbered `.sql` files embedded via `//go:embed`, applied in order in
  transactions, tracked by `schema_migrations`; `pgx` is the only new
  dependency, the image needs no migration CLI, and start-up migration is a
  dozen lines. *Rejected:* `golang-migrate`/`goose`/`tern` — a second runtime
  (or build-time CLI) dependency and more surface than forward-only embedded SQL
  on a single instance warrants. This is a mechanism within the `.tji`'s
  "versioned migrations" and DIRECTION §3.4's single instance — **no DIRECTION
  delta.**
- **Forward-only; no down migrations.** *Chosen:* roll forward; recover by
  restoring the Postgres backup (DIRECTION §3.4 lines 236–239). *Rejected:*
  paired up/down migrations — down migrations on production data are rarely the
  real recovery path and double the surface. No delta.
- **The owner is `books.owner_id`, not a `memberships` row.** *Chosen:*
  `memberships` holds only editors and readers, so the fifty-member cap is a
  plain count of `memberships` per book ("members besides the owner", DIRECTION
  §3.3 lines 175–176, API lines 416–418), and ownership is a single non-null
  column. The API's `Role` enum still includes `owner` for the members listing,
  which the handler assembles from `books.owner_id`. *Rejected:* an owner
  `memberships` row — it would make the cap an off-by-one and allow the
  contradiction of a book with no owner-membership. No delta.
- **Sessions are the signed-in devices; no separate `devices` table.**
  *Chosen:* one `sessions` row per signed-in device, carrying `last_used_at` and
  `revoked_at` — exactly what the API's `Session` list surfaces (lines 946–962)
  and workflow 13 describes (lines 69–72). *Rejected:* a `devices` table a
  session points at — nothing references a device independently of its session
  in the first pass; the `.tji`'s "devices" is this `sessions` row. If a durable
  device identity is ever needed it is an additive migration in the task that
  needs it. No delta.
- **`pgx` is added here, and it is not a design delta.** DIRECTION §3.6 line 313
  already names `pgx` as the Postgres client; adding it realizes the
  constitution. The DSN env var `ESTANTE_DATABASE_URL` sits in the existing
  `ESTANTE_*` namespace. No delta.
- **A `/readyz` route, with `/healthz` left as liveness.** *Chosen:* a separate
  readiness probe that pings the pool — the skeleton's `health.go` explicitly
  parked a Postgres-touching check for this task — while `/healthz` stays I/O-
  free so the container's liveness/healthcheck never flaps on a database blip.
  The added `e2e-api` assertion then proves migrations ran in the real image.
  *Rejected:* making `/healthz` itself ping Postgres — couples liveness to a
  dependency, an anti-pattern. A mechanism choice, no delta.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `service/internal/db/migrations.go`, `service/internal/db/migrate.go`, `service/internal/db/pool.go` — the embedded migrator, pool constructor, and migration runner; `//go:embed migrations/*.sql` loads the versioned SQL at build time.
- `service/internal/db/migrations/0001_registry.sql` — the nine-table registry: `accounts`, `passkeys`, `sessions`, `books`, `memberships`, `invitations`, `invitation_joins`, `email_login_links` (placeholder for `service.email_links`), `schema_migrations`; with the role and expiry enums, the `UNIQUE (book_id, account_id)` on `memberships`, the `CHECK (uses_remaining IS NULL OR uses_remaining >= 0)` on `invitations`, and the FK cascade chain.
- `service/go.mod` — adds `github.com/jackc/pgx/v5`; `service/go.sum` (first lockfile for the service).
- `service/internal/config/config.go` — `DatabaseURL string` field read from `ESTANTE_DATABASE_URL`.
- `service/cmd/service/main.go` — opens the pgxpool, calls `db.Migrate` before `ListenAndServe`, defers pool close.
- `service/internal/server/server.go` — `Pinger` interface parameter, `GET /readyz` registered.
- `service/internal/server/health.go` — `handleReadyz` returning `200`/`503` on pool ping; `/healthz` unchanged and I/O-free.
- `compose.yaml` — `ESTANTE_DATABASE_URL` env var wired into the `service` container.
- `Dockerfile` — `go.sum` added to the copy step for the service build stage.
- Tests — unit: `service/internal/db/migrations_test.go` (non-empty, strictly increasing, planner); `service/internal/config/config_test.go` (two DSN cases); behavior: `service/internal/db/migrate_test.go` (empty→latest+idempotent, membership uniqueness, uses≥0, FK "no book without account", registry shape); `service/internal/server/ready_test.go` (503 closed pool + real-pool 200→503); e2e-api: `e2e/api/ready.test.js` (live `/readyz` → 200 against compose stack).

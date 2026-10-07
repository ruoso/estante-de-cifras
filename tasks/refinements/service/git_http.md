# service.git_http — Git over HTTP

## TaskJuggler

[`tasks/30-service.tji`](../../30-service.tji) — `task git_http "Git over HTTP"`:

```
task git_http "Git over HTTP" {
  effort 4d
  allocate team
  depends !books
  note "git upload-pack / receive-pack --stateless-rpc framed by the service: …"
}
```

`depends !books` — the one declared predecessor. The git/volume seam and the
registry rows this task reads were built there.

## Effort estimate

**4d.** The heaviest service task after `books`. It is the first handler that
streams to and from a subprocess in both directions, the first to manage its
own per-request deadline and client-disconnect kill (the rest of the service
is request/response JSON), and it owns the hand-off surface to the push hook
(the `ESTANTE_*` environment and the hooks-path wiring). The pure framing is
small — the service header pkt-line, the `Git-Protocol` pass-through, the
gzip reader, the environment builder — but the behavior and e2e matrix
(clone, fetch, push, protocol v2, gzip, disconnect, deadline, the size cap,
and four pre-git refusals) is wide, and each case is exercised with real git
on both sides (the git CLI and isomorphic-git).

## Repository

**estante-de-cifras.** Not a cifra.md task: the service never reads a song
here — it frames git's own protocol and spawns git, which owns the packs, ref
locking, the quarantine and the hook (DIRECTION §3.6 lines 335–336). The app
and the service still share no code (DIRECTION §3.6 line 288); the only
contract crossed is `api/openapi.yaml`'s Git paths and git's wire protocol.

Directories that change:

- `service/internal/server/` — a new `git.go` (the three handlers, the
  session+role gate, the pre-git refusals, the pure framing helpers) and its
  `git_test.go`; one new route block in `server.go`; a combined role helper
  beside `isMember` in `books.go`.
- `service/internal/book/` — a streaming exec method on `Store` (serve a
  stateless-rpc command against a book's repo), beside the buffered `runGit`.
- `service/internal/config/` — the git deadline, the request-body cap, and the
  hooks directory, in the `ESTANTE_*` namespace.
- `e2e/api/` — a `git.test.js` extended (or added beside the harness
  smoke test) for clone/fetch/push over HTTP with a session, protocol v2, and
  a non-member refusal.

## Inherited dependencies

- **`service.books`** *(settled, Done)* — the git/volume seam: `book.Store`
  (`service/internal/book/book.go:40-42`), `repoPath`/`Path` deriving
  `/data/books/<id>.git` from a UUID-validated id
  (`book.go:48-59`), the hardened git runner `runGit`
  (`book.go:144-154`, `exec.CommandContext` + `GIT_CONFIG_NOSYSTEM=1` +
  `GIT_TERMINAL_PROMPT=0`, never a shell), the `books`/`memberships` registry
  and the `size_bytes` column
  (`service/internal/db/migrations/0001_registry.sql:83-106`), the quota
  constants (`service/internal/server/books.go:31-35`,
  `maxBooksPerAccount = 100`, `maxBytesPerAccount = 200 MB`), `isMember`
  (`books.go:437-447`), `ownedUsage` (`books.go:427-432`), and the
  `<PublicBaseURL>/git/<id>` URL already advertised by `gitURL`
  (`books.go:62-67`).
- **`service.serve_app`** *(settled, Done)* — the mux and the two origin-wide
  wrappers this task registers into and inherits: `Handler` building
  `http.NewServeMux` (`service/internal/server/server.go:39,45`), `NoIndex`
  and `LogRequests` (`server.go:88`), and the `/git` reserved namespace that
  404s today until this task registers real routes
  (`service/internal/server/app.go:54,116`).
- **`service.passkeys` / `service.sessions` / `service.email_links`**
  *(settled, Done, transitively via `books`→`sessions`)* — the session seam
  `session.Resolve(ctx, db, r) → (accountID, ok, err)`
  (`service/internal/session/session.go:128-151`) and the `APIDeps` struct
  this task extends (`service/internal/server/email_links.go:29-39`).
- **`foundation.e2e_api`, `foundation.compose`** *(settled; prerequisites of
  the e2e level, present in the tree)* — the harness at `e2e/api/` with its
  git clients `GitCli` and `IsoGit` (`e2e/api/lib/git.js:37,90`, HTTP
  clone/fetch/push with a cookie at `:132-141`), the HTTP client and the
  sign-in helper (`e2e/api/lib/http.js`, `e2e/api/sessions.test.js:47-61`),
  and the compose stack `scripts/gate` brings up (the service image with git,
  Postgres at `ESTANTE_TEST_DATABASE_URL`, the mail catcher). The `IsoGit`
  helper's own comment notes clone-over-HTTP-with-a-session lands with this
  task (`e2e/api/lib/git.js:128-131`).

- **Pending (downstream, not a blocker):**
  - **`service.hook` (the pre-receive stream, `tasks/35-hook.tji`)** depends
    on this task. It consumes the `ESTANTE_*` environment and the hooks-path
    this task sets, and its binary fills `service/cmd/pre-receive/` (today a
    README only, `service/cmd/pre-receive/README.md:5-6`). This task delivers
    the mechanism and unit-tests the environment it produces; the hook's
    content checks and their integration land there.
  - **`service.change_check`** (`depends !git_http`) reads one ref per book;
    it reuses this task's repo-path and git seam.
  - The **app's sync Worker** (`sync.*`) clones, fetches and pushes to these
    endpoints with isomorphic-git; the `gitUrl` it already receives from
    `books` resolves here.

## What this task is

The service speaks git's smart HTTP protocol itself — the way Gitea, Forgejo
and GitLab do, not through `git http-backend` and CGI (DIRECTION §3.6 lines
320–322). Three routes under `/git/{bookId}`:

- **`GET …/info/refs?service=git-upload-pack|git-receive-pack`** runs that git
  command with `--stateless-rpc --advertise-refs`, writing the service header
  — `# service=…` as a pkt-line, then a flush pkt — before git's output.
- **`POST …/git-upload-pack`** and **`POST …/git-receive-pack`** run the same
  command with `--stateless-rpc`, the request body piped to git's stdin and
  git's stdout streamed back.

Around git, the service owns the HTTP: it authenticates the session and the
book membership and refuses with a clear status *before git is ever spawned*;
it passes the client's `Git-Protocol` header through to git as `GIT_PROTOCOL`
so protocol v2 works; it decompresses a `Content-Encoding: gzip` request body
on the way in; it caps the request body and sets a deadline before git reads a
byte; it kills git when the client goes away; and — for a push — it sets the
`ESTANTE_*` environment the pre-receive hook inherits and points git at the
hooks directory, then refreshes the book's `size_bytes` after a push that
succeeds. The protocol, the packs, ref locking, the quarantine and running the
hook stay git's own (DIRECTION §3.6 lines 335–336).

## Why it needs to be done

This is the only way a device moves a book to or from Estante. `books`
advertises a `gitUrl` for every book, but nothing answers it yet: `/git/…`
404s (`app.go:116`). Until these routes exist, a created book cannot receive
its first commit (the app pushes the README and `.gitattributes`, not the
service — `book.go:62-64`), no shelf can sync, no book can be cloned or forked
across devices, and the push hook has nothing to run inside. Every task in the
`hook` stream, `service.change_check`, and the app's whole sync path
(`sync.*`) sit behind it. It is the seam named throughout the codebase as
"downstream, when git over HTTP exists" (`book.go:63`, `books_test.go:30-33`,
`e2e/api/lib/git.js:128-131`).

## Inputs / context

**The task note** (`tasks/30-service.tji:42`): "git upload-pack /
receive-pack --stateless-rpc framed by the service: service header,
Git-Protocol to GIT_PROTOCOL, gzip bodies, size cap, deadline, kill on
disconnect, refusals before git starts, ESTANTE_* environment for the hook.
DIRECTION §3.6 Git over HTTP."

**DIRECTION** ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md)):

- **§3.6 "Git over HTTP"** (lines 318–354) — the normative shape: the two
  endpoints and what each runs (lines 324–330), `Git-Protocol`→`GIT_PROTOCOL`
  and gzip in (lines 331–333), what the service gains by framing git itself —
  authentication and refusals before git starts, the hook knowing who is
  pushing through an inherited environment, a size cap/deadline/kill, and
  nothing hidden (lines 336–351), and "about two hundred lines of framing,
  tested for gzip bodies, protocol v2, and a client that disconnects
  mid-push" (lines 353–354).
- **§3.3 "The one server"** (lines 175–204) — no book without a session and a
  membership, `noindex` on everything (lines 175–182); the volume holds one
  bare repo per book at `/data/books/<id>.git` (lines 186–187); the service
  runs git's own `upload-pack`/`receive-pack` and a `pre-receive` hook checks
  every push (lines 191–198); "The git server is git" — every part of the
  protocol works, two pushes race through git's own ref locking (lines
  200–204).
- **§3.4** (lines 224–234) — single instance; offline-first means a push
  during a deploy is retried at the next sync, not an outage.

**Workflow 14** ([`docs/workflows/14-file-view.md`](../../../docs/workflows/14-file-view.md)):

- **§"Limits"** (lines 38–47) — 256 KB/file, 50 MB/book with history,
  100 books and 200 MB/account (forks included). The account caps are the
  quota inputs this task passes to the hook and refreshes after a push; the
  per-file/per-book caps are the hook's to enforce.
- **§"Canonical form"** (lines 49–82) — the service accepts the previous
  canonical form "for a while" after a spec change (lines 80–82); the hook,
  not this task, decides canonicality.
- **§"What the service checks"** (lines 84–113) — the pre-receive hook runs
  "by git itself on objects still held in quarantine" (lines 89–90); "A push
  that fails any check is refused whole, naming what failed, and its objects
  never reach the repository" (lines 91–92) — this is how a *content* refusal
  reaches the client, through git's own channel, not an HTTP status; git's own
  guards `receive.fsckObjects` and `receive.maxInputSize` cap a single push
  (lines 109–110); the limits apply for the book and the owning account
  (line 111); a local never-pushed book is held to all of it when put online
  (line 113).

**The contract** ([`api/openapi.yaml`](../../../api/openapi.yaml)):

- The Git intro (lines 580–584): the bodies are git's opaque media types and
  are **not** schema-validated; push-content refusals come back inside the
  `git-receive-pack` result body, not as HTTP status codes.
- `gitInfoRefs` (lines 586–623): `service=git-upload-pack` needs a member,
  `service=git-receive-pack` needs an editor or the owner; 200 is the
  `application/x-git-{service}-advertisement` media type; 401/403/404/413 are
  the pre-git refusals.
- `gitUploadPack` (lines 625–656): needs a member; gzip body decompressed;
  200 is `application/x-git-upload-pack-result`; 401/404/413.
- `gitReceivePack` (lines 658–696): needs an editor or the owner; every push
  runs the hook; a hook refusal is carried in git's own channel inside the
  200 result body; the service's pre-git refusals (no access, over quota,
  deleted) are 401/403/404/413 before git is spawned.
- The `Git-Protocol` header parameter (lines 750–759); the status bodies —
  `Unauthorized` (401, lines 768–773), `Forbidden` (403, a member whose role
  is insufficient, lines 774–781), `NotFound` (404, no such resource *or* not
  a member — answered alike so a private book is never confirmed to a
  stranger, lines 782–790), `TooLarge` (413, over a size or quota limit before
  git starts, lines 800–808); `GitService` enum (lines 1242–1245) and
  `GitPayload` opaque body (lines 1247–1252).

**Code seams to reuse:**

- The mux and middleware: `server.Handler` (`server.go:39,45`), routes
  registered as `mux.HandleFunc("METHOD /path", …)` (`server.go:66-69`), the
  `/git` namespace reserved and 404-ing until now (`app.go:54,116`), the
  `return LogRequests(logger, NoIndex(mux))` wrap (`server.go:88`).
- The session gate, inline, no middleware: `session.Resolve(ctx, db, r)`
  called as a handler's first line (`session.go:128-151`;
  precedent `books.go:79,161,237,310`); `ok == false` → 401 via
  `writeUnauthorized` (`email_links.go:168`).
- Role resolution: owner from `books.owner_id`, otherwise `memberships.role`
  (`editor`/`reader`) — the `CASE` in `listBooks` (`books.go:174-180`),
  `isMember` (`books.go:437-447`), the `book_role` enum
  (`0001_registry.sql:26`, owner is not an enum value). No single "the
  caller's role on this book" helper exists yet — this task adds one.
- The git/volume seam: `book.Store{Root: api.BooksRoot}`, `Store.Path(id)`
  (`book.go:57-59`), the hardened runner `runGit` (`book.go:144-154`) —
  followed, but extended to stream (today it buffers stdout).
- Config: `config.Load` (`config.go:107`), `ESTANTE_BOOKS_ROOT`→`BooksRoot`
  (`config.go:29,114-116`), the `ESTANTE_*` namespace for new vars
  (`config.go:46-47`); `APIDeps` (`email_links.go:29-39`) extended for the new
  fields. The `http.Server` sets no per-request timeouts
  (`service/cmd/service/main.go:106-109`), so this handler manages its own
  deadline, as the start-up code does with `context.WithTimeout` (`main.go:69`).
- The hook's expectation: it "inherits the environment the service sets on
  `git receive-pack` and keeps no database connection of its own"
  (`service/cmd/pre-receive/README.md:5-6`).

**Test precedents:**

- Behavior: `newBooksEnv(t)` (`books_test.go:42-78`) — a `passkeyEnv` (real
  accounts and sessions via the WebAuthn ceremony, `internal/webauthntest`)
  plus a `t.TempDir()` books root, a real `APIDeps`, and
  `httptest.NewServer`; `migratedServerSchema(t)` and `envDSN(t)`
  (`email_links_test.go:102-143`, a throwaway schema on the compose Postgres,
  `t.Skip` when `ESTANTE_TEST_DATABASE_URL` is unset); the HTTP helper
  `(e).do(t, method, path, cookie, body)` (`passkeys_test.go:83`); real-git
  seeding `seedREADME`/`gitRun` (`books_test.go:414-448`). The comment at
  `books_test.go:30-33` marks the stand-in this task replaces with real
  clone/push over the wire.
- e2e-api: `GitCli` and `IsoGit` (`e2e/api/lib/git.js`), HTTP clone/fetch/push
  with a cookie (`:132-141`), `signInViaEmail` (`sessions.test.js:47-61`), the
  existing harness smoke test `e2e/api/git.test.js`.

**Standing rules that bind here:** no book without an account (every route
gates on `session.Resolve` then a membership; a stranger gets 404, never a
confirmation); no song text, commit messages, or secrets in logs (git's stdout
is streamed, never logged; `stderr` is folded into an error as `runGit`
already does, `book.go`; the request log stays method/path/status/duration
only, `LogRequests`); `noindex` on every response (inherited via `NoIndex`);
offline-first (a killed or deadlined push is simply retried at the next sync).

## Constraints / requirements

1. **Three routes, registered on the mux**, matching the contract's
   operations and methods exactly: `GET /git/{bookId}/info/refs`,
   `POST /git/{bookId}/git-upload-pack`, `POST /git/{bookId}/git-receive-pack`.
   `{bookId}` via `r.PathValue`. Explicit patterns win over the `/` SPA
   catch-all; paths under `/git/…` that match no pattern keep 404-ing
   (`app.go:116`).
2. **Authenticate, then authorize, before git starts.** `session.Resolve`
   first; `ok == false` → **401**. Then resolve the caller's role on the book
   in one query (owner / editor / reader / none, over a live, non-deleted
   book). Not a member, or no such live book, or a deleted/taken-down book →
   **404** (the three answered alike, never confirming a private or removed
   book — contract lines 782–790; `deleted_at`/`taken_down_reason`, DIRECTION
   §3.6 lines 337–340). A reader on `git-receive-pack` / `info/refs?service=
   git-receive-pack` → **403**. A push whose owning account is already at its
   byte cap → **413**, before git is spawned. Only then is git run.
3. **The service header.** For `info/refs`, write `# service=<service>` as a
   pkt-line (4-hex length prefix including the 4 bytes and the trailing LF)
   then a `0000` flush pkt, before streaming git's `--advertise-refs` output.
   Content-Type `application/x-git-<service>-advertisement`; `Cache-Control:
   no-cache`. The header is written unconditionally, including for a protocol
   v2 advertisement.
4. **`Git-Protocol` → `GIT_PROTOCOL`.** The request header value is validated
   against a safe shape (a `key[=value]` list over a restricted charset, e.g.
   `version=2`) and, if present and valid, set as `GIT_PROTOCOL` in git's
   environment; an absent or malformed header is simply not passed (no env
   injection). Protocol v2 fetch works through this for both `info/refs` and
   `git-upload-pack`.
5. **gzip in.** A request body with `Content-Encoding: gzip` is wrapped in a
   `gzip.Reader` before being piped to git's stdin; any other encoding is an
   error. Decompression happens under the body cap (the cap bounds the
   *compressed* bytes read from the socket).
6. **Size cap before git reads a byte.** The request body is read through a
   cap (`http.MaxBytesReader` or equivalent) from a config field; exceeding it
   → **413** with git never spawned (or killed if the overrun is detected mid
   stream). The cap is generous enough for a full-book push (≥ the 50 MB book
   limit plus protocol overhead); the fine-grained per-push limit is git's
   `receive.maxInputSize` and the hook's, not this cap.
7. **Deadline and kill-on-disconnect.** Each git invocation runs under a
   context carrying a configurable deadline *and* derived from `r.Context()`,
   so (a) a request that outlives the deadline and (b) a client that
   disconnects mid-stream both cancel the context, which kills the git process
   — in its own process group, so no child outlives it — and leaves the bare
   repository intact (git's quarantine and ref-lock model mean an interrupted
   `receive-pack` lands nothing and leaves no stale `*.lock`). A subsequent
   normal push to the same book succeeds.
8. **The `ESTANTE_*` environment for the hook** (push only). The service sets,
   on the `git receive-pack` it spawns, the environment the pre-receive hook
   inherits — the identified account, the target book, the caller's role, and
   the owning account's remaining quota — so the hook checks limits with no
   database connection of its own (DIRECTION §3.6 lines 342–346;
   `cmd/pre-receive/README.md:5-6`). The variable set is a shared contract with
   the hook stream (see Decisions). git is pointed at the hooks directory via a
   config-driven `core.hooksPath`; when no hook binary is present (as before
   the hook stream lands, and in the test environment) git runs no hook and the
   push is accepted — exactly the behavior this task's own tests rely on.
9. **Refresh `size_bytes` after a successful push.** After `git receive-pack`
   exits 0, the service recomputes the bare repository's on-disk size and
   writes it to `books.size_bytes` (`0001_registry.sql:88`), so the account
   quota (and the remaining quota passed to the hook on the next push)
   reflects reality. A failed, deadlined or disconnected push changes nothing.
10. **Stream, don't buffer.** git's stdout is copied to the response as it is
    produced (a fetch result or a large advertisement must not be held whole in
    memory); the request body is piped to git's stdin as it arrives. The
    existing buffered `runGit` is kept for the short commands (`init`, `clone`,
    `cat-file`); a new streaming method serves the stateless-rpc commands.
11. **Share no code, hide nothing.** No `http-backend`, no `REMOTE_USER`, no
    dumb-HTTP or export rules — only the two commands the service means to run,
    spawned with the hardened environment `runGit` already uses
    (`GIT_CONFIG_NOSYSTEM=1`, `GIT_TERMINAL_PROMPT=0`), plus `GIT_PROTOCOL`,
    `core.hooksPath` and `ESTANTE_*` where they apply (DIRECTION §3.6 lines
    348–351).

## Acceptance criteria

**Behavior delivered.** A member of a book can clone and fetch it over HTTP
with a session cookie (the git CLI and isomorphic-git alike); an editor or the
owner can push; a protocol v2 fetch works; a gzip-compressed request body is
accepted. Before git is spawned, a request with no session is 401, a
non-member or a deleted book is 404, a reader pushing is 403, and an
over-quota account is 413. A client that disconnects mid-push, or a push that
outlives the deadline, kills git and leaves the repository clean. A successful
push updates the book's recorded size, and spawns `git receive-pack` with the
`ESTANTE_*` environment and the hooks path set so the hook — once the hook
stream lands — runs knowing who pushed and what the account has left. The
mux still serves the app at `/` and the JSON API beneath, with `noindex` on
every git response.

**Tests the task lands with, by level.**

- **unit** (`service/internal/server/git_test.go`, pure, no DB/git):
  - the **service header** encoder — `# service=git-upload-pack` /
    `git-receive-pack` produced as a correctly length-prefixed pkt-line
    followed by a flush pkt. *Pins:* DIRECTION §3.6 lines 325–327; contract
    lines 607–615.
  - **`Git-Protocol` → `GIT_PROTOCOL`** — a valid `version=2` passed through,
    a malformed/injection-shaped value dropped, an absent header not set.
    *Pins:* DIRECTION §3.6 lines 331–333; contract lines 750–759.
  - the **gzip reader** — a gzip-wrapped body decodes to the original bytes; a
    non-gzip `Content-Encoding` is rejected. *Pins:* DIRECTION §3.6 line 333;
    contract lines 631–633.
  - the **`ESTANTE_*` environment builder** — given (account, book, role,
    owning-account bytes remaining, book bytes), the exact `KEY=VALUE` set the
    hook inherits. *Pins:* DIRECTION §3.6 lines 342–346; task note;
    `cmd/pre-receive/README.md:5-6`.
- **behavior** (`service/internal/server/git_test.go`, `httptest` + real
  Postgres via `ESTANTE_TEST_DATABASE_URL` + real git on a `t.TempDir()` books
  root, built on `newBooksEnv`):
  - **clone, fetch and push** — a member clones a seeded book and fetches a
    later commit; an editor and the owner push and the new head lands in the
    bare repo; responses carry the right `application/x-git-*` media types.
    *Pins:* contract lines 586–696; DIRECTION §3.6 lines 324–330.
  - **a gzip body** — a `git-upload-pack` (and/or `git-receive-pack`) POST sent
    `Content-Encoding: gzip` succeeds. *Pins:* DIRECTION §3.6 line 333.
  - **a protocol v2 fetch** — `info/refs` and `git-upload-pack` with
    `Git-Protocol: version=2` negotiate and transfer. *Pins:* DIRECTION §3.6
    lines 331–332.
  - **a client disconnecting mid-push kills git and leaves no lock** — the
    request is cancelled mid-stream; the git process is gone, no `*.lock`
    remains under the repo, the head is unchanged, and a subsequent normal push
    succeeds. *Pins:* DIRECTION §3.6 line 348; task note.
  - **the size cap and the deadline** — a body over the configured cap → 413
    with git not spawned; a request under a deliberately tiny configured
    deadline is killed and the repository left intact. *Pins:* DIRECTION §3.6
    line 348; contract lines 800–808.
  - **the pre-git refusals** — no session → 401; a non-member and a
    soft-deleted book → 404 (indistinguishable); a reader on `git-receive-pack`
    → 403; an owning account already at its byte cap → 413 — each before git
    starts, each validated against `api/openapi.yaml` via `apicontract`.
    *Pins:* contract lines 616–623, 651–656, 689–696, 768–808; DIRECTION §3.3
    lines 175–182, §3.6 lines 336–341.
  - **the push environment is set** — a push spawns `git receive-pack` with the
    `ESTANTE_*` variables present and the hooks path configured (asserted via a
    recording stub placed in the configured hooks directory for this test),
    and `books.size_bytes` is refreshed to the post-push on-disk size. *Pins:*
    DIRECTION §3.6 lines 342–346; workflow 14 line 111;
    `0001_registry.sql:88`.
- **e2e-api** (`e2e/api/git.test.js`, black-box against the compose stack):
  - **the git CLI and isomorphic-git clone, fetch and push** against the stack
    with a real session (sign in via `signInViaEmail`, create a book, push its
    first commit, clone it from a second working copy, fetch a later commit).
    *Pins:* DIRECTION §3.6 lines 320–330; contract Git paths.
  - **a protocol v2 fetch from the CLI** (`-c protocol.version=2`) succeeds.
    *Pins:* DIRECTION §3.6 lines 331–332.
  - **a non-member is refused** — a second account with no membership gets 404
    on clone and push. *Pins:* contract lines 782–790; DIRECTION §3.3 lines
    175–182.

**No deferred follow-ups.** The hook's content/canonical/limit checks are
already their own WBS leaves (`tasks/35-hook.tji`), which `depend
service.git_http`; this task delivers only the framing, the pre-git refusals,
the `ESTANTE_*` environment and hooks-path mechanism they consume, and the
`size_bytes` refresh that makes the account quota live. The per-file (256 KB)
and per-book (50 MB) caps are the hook's to enforce (workflow 14 lines 40–41,
109–111) and are not introduced here. Nothing this task needs is deferred, and
every named test lands with it.

## Decisions

**The three routes and the pure framing live in a new `internal/server/git.go`;
the streaming subprocess seam is a method on `book.Store`.** *Chosen:* the HTTP
framing, the session+role gate and the pre-git refusals sit with the other
handlers in `internal/server` (they need `APIDeps`, the registry and the
session seam); the pure helpers (pkt-line header, `Git-Protocol` validation,
gzip wrap, environment builder) are plain functions in the same file,
unit-tested without a DB or git; the act of spawning git and streaming to/from
it is added to `book.Store` beside `runGit`, since that package already owns
"exec the host git against a book's repo" (`book.go:144-154`). *Rejected:* a
standalone `internal/gitproto`/`internal/githttp` package — the pure surface is
~100 lines and has one call site; a package per handler is not the house
pattern (the seam packages `book`, `session`, `passkey` wrap *stateful external
resources*, which the framing is not). *Rationale:* reuse the one git-exec
seam, keep the pure parts unit-testable in place, add no package for one call
site. No DIRECTION delta.

**A single combined role query gates every git request.** *Chosen:* one helper
beside `isMember` returning the caller's role over a live book —
`owner` (from `books.owner_id`), else `editor`/`reader` (from `memberships`),
else not-a-member — with a `deleted_at IS NULL` guard, mirroring the `listBooks`
`CASE` (`books.go:174-180`). Reads map to: any role passes `upload-pack`;
`owner`/`editor` pass `receive-pack`; `reader` → 403; none / deleted → 404.
*Rejected:* calling `isMember` plus a separate owner lookup plus a role read
per request (three round-trips, and it still would not distinguish editor from
reader for the 403). *Rationale:* one query, one source of truth, and it
produces the `ESTANTE_ROLE` value the hook needs in the same read. No delta.

**404, not 403, for a non-member or a removed book; 403 only for a wrong role.**
*Chosen:* follow the contract's `NotFound` rule exactly (lines 782–790) — a
caller who is not a member of the book, a book that does not exist, and a
soft-deleted/taken-down book are answered alike with 404, so the API never
confirms a private book to a stranger (DIRECTION §3.3 lines 175–182). 403 is
reserved for a member whose role is insufficient (a reader pushing). *Rejected:*
403 for a non-member — it confirms the book exists. *Rationale:* the standing
"no book without an account / nothing leaks a private book" rule; consistency
with `books` delete/fork. No delta.

**`core.hooksPath` is set per invocation from config; the hook is not installed
per repo.** *Chosen:* spawn `git -c core.hooksPath=<dir> receive-pack
--stateless-rpc <path>`, with `<dir>` a config field (`ESTANTE_*` namespace,
e.g. `ESTANTE_HOOKS_DIR`) pointing at one directory in the image where the
hook stream drops the `pre-receive` binary. *Rejected:* copying/symlinking the
hook into every repo's `hooks/` at `InitBare`/`Fork` time — `InitBare` and
`Fork` already shipped (`book.go:65-89`) and forks and existing repos would
miss it; a per-repo copy also drifts from the binary in the image on deploy.
*Rationale:* one directory, applied uniformly to every repo (existing, forked,
future) with no per-repo state, updated with the image; when the directory has
no binary (today, and in behavior tests) git simply runs no hook and the push
is accepted, which is what this task's push tests need. No delta — the hooks
path is an implementation of DIRECTION §3.6's "the hook inherits the
environment of the `git receive-pack` that runs it."

**The `ESTANTE_*` push environment — the names are fixed here, as the producer.**
*Chosen:* the service sets, on `git receive-pack`: `ESTANTE_USER` (the pushing
account's id), `ESTANTE_BOOK` (the book id), `ESTANTE_ROLE` (`owner`/`editor`),
`ESTANTE_ACCOUNT_BYTES_REMAINING` (the *owning* account's 200 MB minus its live
owned `size_bytes` sum, floored at 0), and `ESTANTE_BOOK_BYTES` (the book's
current `size_bytes`, so the hook can compute a push's net growth against the
remaining account quota and against the 50 MB/book cap). *Rejected:* giving the
hook a database connection (DIRECTION §3.6 line 345 and
`cmd/pre-receive/README.md:5-6` say it has none); passing only the ids and
letting the hook recompute (it cannot — no DB); passing the per-file/per-book
constants (the hook carries those itself from workflow 14). *Rationale:* the
quota is the *owner's* (forks count against the forker — workflow 14 lines
42–43; `ownedUsage` over `owner_id`, `books.go:427-432`), the hook needs only
what it cannot derive, and these five values let `service.hook`'s `refs`,
`limits` and `messages` leaves do their work with no new seam. The set is
additive: `service.hook.home_book` will later add a repository-kind variable
(`tasks/35-hook.tji`) — the mechanism accommodates it. No delta; the names are
the git_http↔hook contract this refinement records.

**`size_bytes` is refreshed by this task, by an on-disk walk, after a
successful push.** *Chosen:* after `git receive-pack` exits 0, sum the regular
files under the bare repo directory and write the total to `books.size_bytes`.
*Rejected:* leaving it at the fork-copied/zero value `books` set — then the
account quota and the remaining-quota passed to the hook never move, and the
200 MB cap is dead; `git count-objects -v` — it counts object storage but
misses the full on-disk footprint ("50 MB per book, with its history",
workflow 14 line 41); updating from within the hook — the hook has no DB.
*Rationale:* `books` explicitly left `size_bytes` "maintained by the push path
downstream" (`books.go` / schema `0001_registry.sql:88`); this task *is* the
push path. A directory walk needs no extra tool and matches the limit's "with
its history" meaning. No delta.

**A content refusal by the hook is not an HTTP error.** *Chosen:* a push that
git (or the hook) rejects is still a 200 whose `git-receive-pack` result body
carries git's own report-status with the reason; only the service's own
pre-git refusals are HTTP status codes. *Rejected:* translating a hook refusal
into a 4xx — the client is a git client reading git's channel, and the contract
fixes this (lines 582–584, 664–669, 681–684). *Rationale:* the clients
(the git CLI, isomorphic-git) surface git's channel to the user; workflow 14
lines 91–92 ("refused whole, naming what failed") is delivered through it. No
delta.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `service/internal/server/git.go` (new): three HTTP handlers (`GET /git/{bookId}/info/refs`, `POST /git/{bookId}/git-upload-pack`, `POST /git/{bookId}/git-receive-pack`), the session+role gate, the pre-git refusals (401/403/404/413), and pure framing helpers (pkt-line service header, `Git-Protocol` validation, gzip reader wrap, `ESTANTE_*` environment builder).
- `service/internal/server/git_test.go` (new): unit tests (`TestServiceHeader`, `TestSanitizeGitProtocol`, `TestGitRequestBodyGzip`, `TestPushEnv`) and behavior tests (`TestGitCloneFetchPush`, `TestGitGzipBody`, `TestGitProtocolV2`, `TestGitClientDisconnectMidPushKillsGit`, `TestGitSizeCapAndDeadline`, `TestGitPreGitRefusals`, `TestGitPushEnvironmentAndSizeRefresh`) via `httptest` + real Postgres + real git.
- `service/internal/server/books.go`: new combined role-query helper returning owner/editor/reader/none over a live book; `APIDeps` extended with git config fields.
- `service/internal/server/server.go`: three git routes registered on the mux.
- `service/internal/server/email_links.go`: `APIDeps` struct extended with `HooksDir` field.
- `service/internal/book/book.go`: streaming `Serve` method (pipes request body to git stdin, streams git stdout to response) and `Size` method (on-disk directory walk); the buffered `runGit` is unchanged.
- `service/internal/config/config.go` + `config_test.go`: `ESTANTE_GIT_BODY_LIMIT_BYTES`, `ESTANTE_GIT_DEADLINE`, `ESTANTE_HOOKS_DIR` config fields with defaults, override, and rejection tests.
- `service/cmd/service/main.go`: git config fields wired into `APIDeps`.
- `Dockerfile`: `/srv/hooks` directory added as the default hooks path.
- `e2e/api/lib/git.js`: `GitCli` and `IsoGit` helpers extended with cookie-auth HTTP clone/fetch/push.
- `e2e/api/git.test.js` (new/extended): CLI and isomorphic-git clone/fetch/push with a session, protocol v2 CLI fetch, non-member 404.

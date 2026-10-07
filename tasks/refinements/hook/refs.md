# hook.refs — Refs and history

## TaskJuggler

[`tasks/35-hook.tji`](../../35-hook.tji) → `task hook` → `task refs`.

## Effort

1d.

## Repository

**estante-de-cifras.** The pre-receive hook is a Go binary in this
repository (DIRECTION §3.6, component table L284: "**The hook** | Go | this
repository, `service/cmd/pre-receive`"). The note does not start with
`cifra.md:`, so no work lands in the sibling repository for this task.

Directories touched:

- `service/cmd/pre-receive/` — the hook binary's `main` package (today holds
  only `README.md`; this task writes `main.go`).
- `service/internal/hook/` — new package holding the check logic the binary
  wires together, so the checks are unit-testable without building a binary
  and the later hook subtasks (`stowaways`, `contents`, `canonical`,
  `limits`) add their checks here.
- `Dockerfile` — add the `./cmd/pre-receive` build and copy the resulting
  `pre-receive` binary into the image's hooks dir (`/srv/hooks`), so the
  compose stack actually runs the hook.
- `e2e/api/git.test.js` — the e2e-api case.

## Inherited dependencies

- **`service.git_http`** — *settled* (refinement
  [`tasks/refinements/service/git_http.md`](../service/git_http.md), Done
  2026-10-07). It delivers everything the hook plugs into: the service
  speaks git's smart HTTP itself and spawns `git receive-pack` with
  `-c core.hooksPath=<dir>` pointing every push at one shared hooks
  directory (`book.GitStream` / `book.Store.Serve`, `service/internal/book/book.go:177-184`,
  `:195`, `:203-205`); the directory defaults to `config.DefaultHooksDir =
  "/srv/hooks"` (`service/internal/config/config.go:38`, overridable via
  `ESTANTE_HOOKS_DIR`); and the service sets the `ESTANTE_*` push
  environment on the receive-pack process (`service/internal/server/git.go:349-355`,
  `pushEnv`). git itself owns the protocol, packs, ref locking, quarantine
  and running the hook (DIRECTION §3.6 L335). Today the hooks dir is empty,
  so git runs no hook and every structurally valid push is accepted
  (`Dockerfile:89-94`); this task drops the real binary there.
- **`foundation.e2e_api`** — *settled*. The black-box harness at `e2e/api/`
  (Vitest, ESM) runs against the compose stack brought up by `scripts/gate`
  (`stack_up`, `scripts/gate:247`). It already drives real git clients —
  `GitCli` (host `git` CLI, cookie-authed HTTP push/fetch) and `IsoGit`
  (isomorphic-git) in `e2e/api/lib/git.js` — against live book endpoints
  (`e2e/api/git.test.js`). This task adds a refusal case to that file.

No `depends !<sibling>` within `hook`: `refs` is the **first** hook subtask,
and every other (`stowaways`, `contents`, …) depends on `!refs`. So this
task also establishes the hook's skeleton — the stdin parse loop, the
accept/refuse exit convention, the stderr message channel, and the Dockerfile
wiring — on which the rest build.

## What this task is

Write the `pre-receive` hook binary and give it its first layer of checks:
the ones about **refs and history**. git invokes the hook once per push,
feeding it one line per ref update on stdin —
`<old-sha> SP <new-sha> SP <ref-name> LF` — with the pushed objects held in
quarantine. The hook reads every line and refuses the whole push (a non-zero
exit, a message on stderr that git relays to the client) unless each ref
update satisfies:

- **One ref.** The ref is exactly `refs/heads/main`. Any other branch, any
  `refs/tags/*`, any `refs/notes/*`, anything else — refused.
- **No deletion.** The new value is not the all-zero sha (a delete of
  `main`) — refused.
- **Fast-forward only.** For an update to an existing `main`, the old value
  is an ancestor of the new value. A non-fast-forward (a force-push / history
  rewrite) is refused. The first push that *creates* `main` (old value is
  all-zeros) is accepted — that is how a book comes online.

A push whose ref updates all pass this layer exits 0 and git proceeds (in
this task, to acceptance, since no later check exists yet).

## Why it needs to be done

Workflow 14 §"What the service checks" (`docs/workflows/14-file-view.md:84-113`)
is explicit that the app keeping to the rules is not what guarantees them:
"a push can carry … other refs, tags, or history rewritten to hide what it
held. So the `pre-receive` hook … checks all of it" (L86-92). DIRECTION §3.3
L196-198 names it "a Go program of its own". The service deliberately ships
without this check today — `git_http` built the whole seam (env, hooks path,
quarantine, refusal channel) but left the hooks dir empty on purpose. Until
the binary exists, any member who can push can set tags and notes, push side
branches, delete or rewrite `main`, and so swap what the book holds behind
the app's back. `hook.refs` closes the "One ref." and "Fast-forward only."
bullets; the five later hook subtasks (object reachability, allowed
contents, canonical form, limits, refusal-message consistency) each add their
bullet on top of the skeleton this task lands.

## Inputs / context

Normative:

- `docs/workflows/14-file-view.md:84-113` — §"What the service checks". The
  two bullets in scope: **"One ref."** (L94-95) "Only `refs/heads/main` may
  be updated: no other branch, no tags, no notes, no deleting it."; **"Fast-forward
  only."** (L96-97) "History is never rewritten (workflow 6), and a rewrite
  is also a way to swap what a book holds." L113: "A local book never pushed
  is held to all of this when it is put online."
- `docs/DIRECTION.md` §3.3 L196-198 (the hook is a Go program of its own,
  checking every push against what a book may hold, canonical form, and the
  limits — workflow 14); §3.3 L186-187 (one bare repo per book at
  `/data/books/<id>.git`); §3.6 component table L284 (the hook at
  `service/cmd/pre-receive`); §3.6 "Git over HTTP" L318-354, especially L335
  ("the quarantine and running the hook stay git's own"), L341 ("What the
  hook refuses still reaches the client through git's own channel"), L342-346
  (the `ESTANTE_*` environment); §3.6 "Repositories" L374-399 (the image
  carries git and the hook; `compose.yaml` brings them up).

Seams this task extends (from `git_http`, settled):

- `service/internal/book/book.go:177-184` `GitStream` (field `HooksDir
  string` — "core.hooksPath, set only for a push"); `:195` `Store.Serve`
  (spawns `git [-c core.hooksPath=<dir>] <service> --stateless-rpc …`, cwd =
  the bare repo, env = hardened base + `ESTANTE_*`, own process group).
- `service/internal/server/git.go:349-355` `pushEnv` and `:375-380`
  `hooksDir()` — the `ESTANTE_*` contract the service sets and the hooks
  directory it points git at. For `refs` the contents of that env are not
  read (the checks are structural); the binary tolerates its presence. The
  env is `ESTANTE_USER`, `ESTANTE_BOOK`, `ESTANTE_ROLE`,
  `ESTANTE_ACCOUNT_BYTES_REMAINING`, `ESTANTE_BOOK_BYTES` (fixed by
  `git_http`, `tasks/refinements/service/git_http.md:474-491`; later subtasks
  read them).
- `service/internal/config/config.go:38` `DefaultHooksDir = "/srv/hooks"`.
- `Dockerfile:66-67` (the Go build stage builds `./cmd/service` only, with a
  comment that the hook area adds `./cmd/pre-receive` when it has a `main.go`);
  `Dockerfile:94` (`mkdir -p /srv/hooks`).
- `service/internal/server/git_test.go:663-712`
  (`TestGitPushEnvironmentAndSizeRefresh`) — the existing pattern that drops
  a shell `pre-receive` script into a temp hooks dir and pushes through the
  handlers; the template for installing a hook binary in a test.
- `e2e/api/lib/git.js` — `GitCli.pushHTTP` / `IsoGit.push` (cookie-authed
  smart-HTTP push); `e2e/api/git.test.js` — the existing clone/fetch/push
  cases through the live stack (none exercise a refusal yet).

## Constraints / requirements

- **The hook is the guarantee, not the app.** It runs on quarantined objects
  and refuses the whole push on any failure; refused objects never reach the
  repository (workflow 14 L90-92). It exits 0 to accept, non-zero to refuse;
  it writes each refusal reason to **stderr**, which git relays to the client
  (prefixed `remote:`) and which `git_http` passes back through git's own
  channel to the git CLI and isomorphic-git (DIRECTION §3.6 L341). Refusal is
  **not** an HTTP error — it rides inside the 200 receive-pack result body.
- **No database.** The hook keeps no DB connection of its own (DIRECTION §3.6
  L342-346; `service/cmd/pre-receive/README.md`). `refs` needs no account
  data at all.
- **No song text, no secrets in logs.** A refusal names the structural fault
  (the offending ref, "deletion", "non-fast-forward") — never object contents.
  `refs` touches no song text; this is trivially satisfied here but holds for
  the shared message channel.
- **The app and the service (and the hook) share no code** beyond the API
  contract and the format (DIRECTION §3.6 L288-291). `refs` adds no
  cross-repository dependency; it does not yet link cifra.md-for-Go (that
  arrives with `hook.canonical`).
- **Fast-forward ancestry is read through git.** The hook execs the host
  `git` (present in the image) for the ancestry test —
  `git merge-base --is-ancestor <old> <new>` — run inside the bare repo. The
  incoming objects are visible because git, during pre-receive, exposes the
  quarantine as an object source to commands the hook runs (it inherits
  `GIT_QUARANTINE_PATH` / the alternate object dir). Do not reimplement
  ancestry; do not read the DB.
- **Read all of stdin.** git sends every ref-update line; the hook consumes
  them all and evaluates each, then exits once. If more than one ref update
  fails, name each on stderr; a single failure refuses the whole push.
- Not applicable to this task, recorded so the closer can see they were
  considered: accessibility (no UI), offline-first (server-side), "no book
  without an account" and canonical form (enforced elsewhere — membership in
  the service before git is spawned; canonical form in `hook.canonical`).

## Acceptance criteria

**Behavior delivered.** A `pre-receive` binary installed in a book's bare
repository (via `core.hooksPath`, exactly as `git_http` runs it) accepts a
fast-forward push to `refs/heads/main` and the initial push that creates it,
and refuses — whole, with a readable reason on git's channel — any push that
updates any other ref, sets a tag or a note, deletes `main`, or is a
non-fast-forward to `main`. The binary is built into the image and dropped at
`/srv/hooks/pre-receive`, so the compose stack runs it.

**Tests, by level** (the note names behavior and e2e-api; unit is added for
the pure ref-classification logic — see Decisions):

- **unit** — `service/internal/hook/refs_test.go` (Go, no git, no DB): the
  pure classifier over parsed `(old, new, ref)` triples — `refs/heads/main`
  is the only accepted ref name; `refs/tags/*`, `refs/notes/*` and any other
  `refs/heads/*` are rejected by name; the all-zero new value is a deletion;
  the all-zero old value is a creation (ancestry not required). Also the
  stdin parser: well-formed lines split into triples, a malformed line is an
  error. Pins workflow 14 "One ref." (L94-95) and the no-deletion clause.
- **behavior** — `service/cmd/pre-receive/refs_test.go` (Go; builds the
  binary with `go build` into a temp dir named `pre-receive`, installs it via
  `core.hooksPath`, seeds a bare repo with an initial `main`, then drives the
  host `git` CLI as a local push against it): a tag push refused; a note push
  (`refs/notes/commits`) refused; another branch (`refs/heads/draft`)
  refused; a deletion of `main` refused; a non-fast-forward (forced) update
  to `main` refused; a fast-forward update to `main` accepted; the initial
  creation of `main` accepted. Each refusal's stderr names what failed. Pins
  workflow 14 "One ref." (L94-95) and "Fast-forward only." (L96-97). No
  Postgres: the hook has no DB, so — unlike a service handler — its behavior
  test needs none (this is why it does not reuse the `newGitEnv` httptest
  harness; see Decisions). No axe (not UI).
- **e2e-api** — `e2e/api/git.test.js`, new cases in a "hook: refs
  (hook.refs)" describe: against the compose stack, a member clones a book,
  commits, pushes a fast-forward to `main` (accepted), then force-pushes a
  rewritten history (`GitCli.pushHTTP` with `--force`) and the stack refuses
  it, the reason read as the git CLI presents it (`remote:` line). Pins
  workflow 14 "Fast-forward only." and DIRECTION §3.6 L341 (the refusal
  reaches the client through git's own channel). This is also the first case
  that proves the hook is actually built into and run by the image.

Fixtures use a song written for the purpose
(`e2e/api/fixtures/the-tuning-song.cifra.md` and `fixtures/songs.js` already
exist); any new commit content is purpose-written, never copyrighted words.

No follow-up work is deferred by this task.

## Decisions

- **The check logic lives in `service/internal/hook/`, with
  `service/cmd/pre-receive/main.go` a thin entry point.** `main` reads stdin
  and the environment, calls the package, and maps its result to an exit code
  and stderr. *Why:* it keeps the checks unit-testable as plain functions
  (go-test of a `main` package is awkward), and it gives the five later hook
  subtasks a single place to add their checks — each is one more function the
  binary composes, matching how `git_http` kept pure framing helpers beside
  the stateful seam. *Alternative rejected:* everything in `package main`
  under `cmd/pre-receive` — fewer files, but every check would be reachable
  only by building and running the binary, pushing all coverage to the
  slower behavior level.
- **Install by `core.hooksPath`, not per-repo copy.** The binary is dropped
  once into the image's hooks dir and `git receive-pack` is pointed at it per
  push. This is already decided and built by `git_http`
  (`tasks/refinements/service/git_http.md:459-472`); `refs` only supplies the
  binary and the Dockerfile lines that put it there. *Why:* a per-repo
  `hooks/pre-receive` would be missed by existing repos and by forks
  (`book.Store` fork is a bare clone) and would drift from the image.
- **Fast-forward is decided with `git merge-base --is-ancestor`, execed
  against the quarantine.** *Why:* git already knows ancestry and already
  exposes the incoming objects to the hook; reimplementing a commit walk
  would duplicate git and risk disagreeing with it. *Alternative rejected:*
  parsing `rev-list` output by hand — more code, same answer.
- **A unit level is added (the note lists only behavior and e2e-api).** The
  ref-name allowlist and the zero-sha deletion/creation detection are pure
  string logic with several cases; unit-pinning them is cheap and follows the
  `git_test.go` precedent of unit-testing the pure hook-contract helpers
  (`TestPushEnv`). No named level is dropped. The ancestry test stays at the
  behavior level because it needs real git and real objects.
- **Behavior tests drive a local git push, not the HTTP stack.** git
  `receive-pack` sets up the quarantine and runs the hook identically whether
  invoked locally or over smart HTTP, and the hook's entire contract is stdin
  + env + quarantine; a local push reproduces all of it without a server or
  Postgres. The through-the-stack path is covered once, at the e2e-api level.
  *Why:* keeps the hook's behavior test focused on the hook and off the
  server harness; faster and with no DB dependency.
- **`refs` emits readable stderr messages now; `hook.messages` owns the
  unified contract.** Each refusal here names its fault in plain text so the
  behavior and e2e-api tests can assert it. The cross-cutting consistency of
  the whole refusal matrix (one message per refusal, read identically by the
  git CLI, isomorphic-git and the app) is `hook.messages`, which depends on
  all checks having landed. `refs` does not pre-empt that; it lands sensible
  messages the later task may normalize.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- Created `service/internal/hook/refs.go`: stdin parser, pure ref/sha classifier, ancestry check via `git merge-base --is-ancestor`, and `Refs` orchestrator that reads all updates and returns combined errors.
- Created `service/cmd/pre-receive/main.go`: thin entry point that wires stdin → `hook.Refs` → exit code + stderr messages.
- Created `service/internal/hook/refs_test.go`: unit tests `TestCheckStructure` (ref name allowlist, deletion/creation detection) and `TestParseUpdates` (stdin parse, malformed-line error).
- Created `service/cmd/pre-receive/refs_test.go`: behavior test `TestPreReceiveRefs` — builds the binary into a temp dir, installs via `core.hooksPath`, seeds a bare repo, drives the host `git` CLI: tag/note/branch/deletion/non-fast-forward each refused (stderr reasons asserted); fast-forward and initial creation accepted.
- Edited `Dockerfile`: added `./cmd/pre-receive` to the Go build stage and copied the `pre-receive` binary to `/srv/hooks/pre-receive` so the compose stack runs the hook.
- Edited `e2e/api/lib/git.js`: added `{force}` option to `GitCli.pushHTTP` to enable `--force` pushes in test scenarios.
- Edited `e2e/api/git.test.js`: added "hook: refs (hook.refs)" describe — member clones, commits, fast-forward push accepted, then force-push refused with `remote:` reason line; proves the hook is built into and run by the image.
- Edited `service/cmd/pre-receive/README.md`: expanded with the actual command-line interface and environment docs.
- Fix (fixer attempt 1): narrowed `.dockerignore` exclusion from `service/cmd/pre-receive` directory to `service/cmd/pre-receive/README.md`, so `main.go` reaches the Docker build context.

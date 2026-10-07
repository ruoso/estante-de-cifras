# hook.limits — Limits

## TaskJuggler

[`tasks/35-hook.tji`](../../35-hook.tji) → `task hook` → `task limits`.

## Effort

1d.

## Repository

**estante-de-cifras.** The pre-receive hook is a Go binary in this
repository (DIRECTION §3.6 component table L284: "**The hook** | Go | this
repository, `service/cmd/pre-receive`"). The note does not start with
`cifra.md:`, so no work lands in the sibling repository. Unlike the three
earlier hook subtasks this one also touches the **service** side: git's own
push guards (`receive.maxInputSize`, `receive.fsckObjects`) are git config the
service sets on the `git receive-pack` it spawns, not hook code — so the task
spans the hook package and the service's git plumbing.

Directories touched:

- `service/internal/hook/` — new `limits.go` adds the byte-limit check as a
  function in `package hook`, beside `refs.go`, `stowaways.go` and
  `contents.go`, so the binary composes one more check (hook.refs /
  hook.stowaways / hook.contents Decision; DIRECTION §3.6). It is the **first**
  hook check that reads the `ESTANTE_*` push environment (the three earlier
  checks are structural and read none — recorded in each of their refinements:
  "the account-limit subtask `hook.limits` reads them").
- `service/internal/hook/limits_test.go` — unit tests (pure env parsing,
  net-growth summing, and the accept/refuse arithmetic).
- `service/cmd/pre-receive/main.go` — edit `run()` to compose the new check
  after the contents layer accepts.
- `service/cmd/pre-receive/limits_test.go` — behavior test (the real binary in
  a real bare repository, driven with the host `git`): the hook's per-book and
  per-account caps, plus git's own guards set as the service sets them.
- `service/internal/book/book.go` — `Store.Serve` adds `-c
  receive.maxInputSize=<n>` and `-c receive.fsckObjects=true` to the
  `git receive-pack` invocation on a push, beside the existing `-c
  core.hooksPath` (book.go:200-210).
- `service/internal/config/config.go` — a `ReceiveMaxInputSize` config value
  (default, overridable via `ESTANTE_RECEIVE_MAX_INPUT_SIZE`), modelled on the
  existing `GitMaxBodyBytes` field (config.go:47-51, parse block ~:182-189).
- `service/internal/server/git.go` — thread the configured value into the
  `GitStream` the receive-pack handler builds (`handleGitReceivePack`,
  git.go:156-172).
- `service/internal/server/git_test.go` — service behavior test that the
  spawned receive-pack actually carries the two `-c` guards.
- `e2e/api/git.test.js` — the e2e-api case (a push over the account's quota,
  size set in Postgres, refused by the stack).

No Dockerfile change: `hook.refs` already builds `./cmd/pre-receive` and
installs the binary at `/srv/hooks/pre-receive` (`Dockerfile:89-94`); this task
only adds code the existing binary links, plus `-c` flags on an existing spawn.

## Inherited dependencies

- **`hook.contents`** — *settled* (refinement
  [`tasks/refinements/hook/contents.md`](contents.md), Done 2026-10-07), itself
  built on **`hook.stowaways`** and **`hook.refs`** (both Done 2026-10-07).
  Together they established everything this task builds on:
  - the hook skeleton — `ParseUpdates` (the stdin parse loop,
    `service/internal/hook/refs.go:41`), the `RefUpdate` type (`refs.go:30-34`),
    `MainRef = "refs/heads/main"` (`refs.go:25`), and the accept/refuse
    convention (exit 0 / non-zero, each reason on stderr prefixed
    `pre-receive: ` and relayed through git's channel,
    `service/cmd/pre-receive/main.go` `run()`/`refuse()`);
  - the sequential-layer composition seam — `main.run()` runs `Refs`, then (only
    if it accepted) `Stowaways`, then (only if it accepted) `Contents`; this task
    adds one more call, run only if contents accepted;
  - the exec-git-against-the-quarantine pattern — `runGit(repoDir, env,
    args...)` (`stowaways.go:257`), `envWithout` (`:281`), and the accepted new
    head `acceptedMainHead(updates)` (`stowaways.go:192`), reused directly;
  - **the introduced-objects size seam this task reuses directly** —
    `contents.go`'s `introducedObjects` (`git rev-list --objects <new> --not
    --all` piped to `git cat-file --batch-check='%(objectname) %(objecttype)
    %(objectsize)'`, contents.go:~474-497) already yields every object the new
    head reaches that the repository did not already have, each with its byte
    size, parsed into `objectInfo{SHA, Type, Size}`. Summing `Size` over that
    set *is* the push's net byte growth, so `limits` needs no new git read;
  - the behavior-test harness — `buildHook`, `newBook`, `git`/`mustGit`,
    `gitEnv`, `writeSong`, `assertRefused` in
    `service/cmd/pre-receive/refs_test.go` (a local push to a bare repo with the
    binary installed via `core.hooksPath`, no server, no Postgres), reused as-is.
- Transitively **`service.git_http`** and **`foundation.e2e_api`** — *settled*
  through the refs/stowaways/contents chain:
  - the `ESTANTE_*` push-environment contract this task reads is already set by
    the service in `pushEnv` (`service/internal/server/git.go:348-356`):
    `ESTANTE_USER`, `ESTANTE_BOOK`, `ESTANTE_ROLE`, `ESTANTE_ACCOUNT_BYTES_REMAINING`
    and `ESTANTE_BOOK_BYTES`, pinned by `TestPushEnv` (git_test.go:139-150);
  - the service already pre-gates a push: a reader → 403 and an owning account
    whose quota headroom is already ≤ 0 → 413, both before git starts
    (`authorizePush`, git.go:228-243); after an accepted push it refreshes
    `books.size_bytes` from `store.Size` so the quota stays live (git.go:179-185);
  - the black-box harness at `e2e/api/` drives real git clients (`GitCli`,
    `IsoGit` in `e2e/api/lib/git.js`) against the compose stack, with direct
    Postgres access via `connect()` in `e2e/api/lib/db.js`
    (`ESTANTE_TEST_DATABASE_URL`).

`limits` `depends !contents`. It does **not** depend on `hook.canonical` (a
sibling that also `depends !contents`, not yet landed); the two are independent
and either may land first. `hook.messages` (`depends !canonical, !limits`)
later normalizes the whole refusal matrix across git CLI, isomorphic-git and the
app; `limits` emits readable reasons now but does not try to unify them.

## What this task is

The two remaining bullets of workflow 14 §"What the service checks"
(`docs/workflows/14-file-view.md:109-111`): **git's own guards** —
"`receive.fsckObjects` for malformed objects, and `receive.maxInputSize` to cap
a single push" — and **the limits** — "for the book and for its owner's
account", i.e. the §Limits list L40-43 (the 50 MB-per-book and 200 MB /
100-books-per-account caps; the 256 KB-per-file cap is already `hook.contents`).
It has two parts:

1. **A new hook check layer** (`service/internal/hook/limits.go`,
   `Limits(updates []RefUpdate, repoDir string) (reasons []string, err error)`,
   composed by `main.run()` after `Contents` accepts). For the one accepted
   `refs/heads/main` update, it:
   - reads `ESTANTE_BOOK_BYTES` (the book's current recorded on-disk size) and
     `ESTANTE_ACCOUNT_BYTES_REMAINING` (the owner's quota headroom, already
     floored at 0 by the service) from the environment;
   - computes the push's **net byte growth** — the sum of the introduced
     objects' sizes (`introducedObjects`, reused from `contents.go`): the bytes
     the new head reaches that the repository did not already have;
   - refuses the whole push if the book would exceed **50 MB**
     (`ESTANTE_BOOK_BYTES + growth > 50·1024·1024`) or if the growth would
     exceed the account's remaining quota (`growth > ESTANTE_ACCOUNT_BYTES_REMAINING`),
     naming which limit and the user, never any file content.
2. **Git's own push guards**, set by the service on the receive-pack it spawns
   (`Store.Serve`, book.go:200-210, beside the existing `-c core.hooksPath`):
   `-c receive.fsckObjects=true` (git refuses a malformed/corrupt object during
   index-pack) and `-c receive.maxInputSize=<n>` (git refuses a pack larger than
   `n` bytes). These are enforced by git itself, before the pre-receive hook
   runs, and git's refusal rides back through the same channel as the hook's.

## Why it needs to be done

Workflow 14 §Limits (L45-47) is explicit that what passes every other check is
*text*, and a song's notes are free text, so the limits "are what keep text
from becoming the storage instead: bounded by size, since it cannot be by
content without hurting real songs." The earlier hook subtasks bound *what* a
blob may be (kind, mode, encoding, 256 KB per file) but not *how much* a book or
an account may hold: without this task a member who can push could grow a book,
or an account's books, without bound — the exact "service becoming file storage
nobody meant to offer" the workflow opens on (L10-14). The service pre-gates
only the coarse cases (a reader; an account *already* at its cap); it cannot see,
before git runs, whether *this* push tips the book past 50 MB or the account
past its remaining headroom — that needs the push's byte growth, which only the
hook (on the quarantined objects) can measure. git's own guards close the
orthogonal gap the hook cannot: a malformed object (which git must not even
index) and a single pack large enough to be a denial-of-service before any hook
runs. This is the last substantive check; `hook.messages` then normalizes how
every refusal reads.

## Inputs / context

Normative:

- `docs/workflows/14-file-view.md:38-47` — §"### Limits". The caps: "**256 KB**
  per file" (L40, `hook.contents`); "**50 MB** per book, with its history"
  (L41, this task); "**100 books and 200 MB** per account, forks included, with
  creating books rate-limited" (L42-43 — the 200 MB account cap this task's
  per-account check enforces at push time; the 100-books cap and create
  rate-limiting are the service's, `service/internal/server/books.go`, not the
  hook's). Rationale L45-47.
- `docs/workflows/14-file-view.md:84-113` — §"What the service checks". The two
  bullets in scope: **"Git's own guards"** (L109-110) — "`receive.fsckObjects`
  for malformed objects, and `receive.maxInputSize` to cap a single push";
  **"The limits"** (L111) — "above, for the book and for its owner's account".
  The framing L86-92: a push that fails any check is refused whole, naming what
  failed, and its objects never reach the repository. L113: a local book never
  pushed is held to all of this when put online.
- `docs/DIRECTION.md` §3.3 L196-198 (the hook "checks every push against what a
  book may hold, its canonical form, and the limits per book and per account");
  §3.6 "Git over HTTP" L338-341 (authentication and the coarse refusals —
  no access, over quota, deleted — are the service's own, before git starts;
  "What the hook refuses still reaches the client through git's own channel");
  §3.6 **L342-346** — the hook environment contract: "It inherits the
  environment of the `git receive-pack` that runs it, so the service sets
  `ESTANTE_USER`, `ESTANTE_BOOK`, `ESTANTE_ROLE` and what the account has left
  of its limits. **The hook checks a push against the account's limits with no
  database connection of its own**, and names the user in its messages."
  §3.6 L347-348 (the service also imposes "a size cap before git reads a byte, a
  deadline, and the git process killed when the client goes away").

Seams this task extends (settled):

- `service/internal/hook/contents.go` — `introducedObjects` (`git rev-list
  --objects <new> --not --all` → `git cat-file --batch-check='%(objectname)
  %(objecttype) %(objectsize)'`, ~:474-497), `objectInfo{SHA, Type, Size}`, and
  `parseBatchCheck`: the introduced-set-with-sizes read `limits` sums over.
  contents.go:57-58 names this task: "The hard per-push cap is git's
  `receive.maxInputSize` … (a hook.limits concern)".
- `service/internal/hook/stowaways.go:192` `acceptedMainHead(updates)`,
  `:257` `runGit`, `:281` `envWithout` — reused directly.
- `service/cmd/pre-receive/main.go` `run()` — the sequential composition this
  task adds a call to; `refuse()` for the stderr channel.
- `service/internal/server/git.go:348-356` `pushEnv` — the `ESTANTE_*` contract.
  Header comment L345-347: "bookBytes is the book's current recorded size, so
  the hook can compute a push's net growth against the remaining account quota
  and the per-book cap" — the explicit design intent this task realizes.
  `authorizePush` (:228-243), `accountRemainingBytes` (:250-259, `maxBytesPerAccount
  - ownedUsage`, floored at 0), the size refresh (:179-185).
- `service/internal/server/books.go:33` `maxBytesPerAccount int64 = 200 * 1024 *
  1024` ("200 MB, history included"); `ownedUsage` (:424-432) sums
  `books.size_bytes` over the owner's non-deleted books. **No per-book 50 MB
  constant exists yet** — this task adds one in `package hook`.
- `service/internal/book/book.go:195-237` `Store.Serve` — the receive-pack
  spawn; `-c core.hooksPath` injected on a push at :200-210; `Size`
  (:245-271, the `du`-style WalkDir written to `books.size_bytes`); `InitBare`
  (:69-76, `git init --bare -b main`, sets **no** `receive.*` config today);
  `Fork` (:82-93).
- `service/internal/config/config.go:47-51` `DefaultGitMaxBodyBytes int64 = 128 *
  1024 * 1024` — the HTTP body cap, "well above the 50 MB per-book limit plus
  protocol overhead; the fine-grained per-push limit is git's
  `receive.maxInputSize` and the hook's, not this cap." The field-and-env
  pattern `ReceiveMaxInputSize` follows.
- `service/internal/server/git_test.go` — `TestPushEnv` (:139-150),
  `TestGitPushEnvironmentAndSizeRefresh` (:664+, a recording hook dumps
  `ESTANTE_*`), the over-quota 413 at :646-656 (`e.setSize(t, b.ID,
  maxBytesPerAccount)`): the service-test precedent.
- `e2e/api/git.test.js` — the non-fast-forward refusal (~:208) and crafted-pack
  stowaway refusal (~:247) precedents; `connect()` from `e2e/api/lib/db.js` for
  the size-in-Postgres setup.

Git quarantine mechanics (git ≥ 2.13 receive-pack): during pre-receive git
points the object directory at the quarantine and lists the real store in the
alternates, so `git rev-list`/`cat-file` against the new head see new and
pre-existing objects together, and `--not --all` excludes what the repository
already had — exactly the net-growth set (workflow 14 L98-101; DIRECTION §3.6
L335). `receive.fsckObjects` and `receive.maxInputSize` act *earlier*, while git
unpacks/indexes the incoming pack into the quarantine, so a malformed object or
an over-size pack is refused before the hook is ever invoked.

## Constraints / requirements

- **The hook is the guarantee, not the app.** `Limits` runs on quarantined
  objects and refuses the whole push on any exceeded cap; refused objects never
  reach the repository. It exits 0 to accept, non-zero to refuse, writing each
  reason to stderr, which git relays prefixed `remote:` (DIRECTION §3.6 L341).
  Refusal rides inside the 200 receive-pack result body, not an HTTP error.
- **No database connection in the hook.** `Limits` reads the two byte figures
  only from `ESTANTE_ACCOUNT_BYTES_REMAINING` and `ESTANTE_BOOK_BYTES` in the
  inherited environment, never Postgres (DIRECTION §3.6 L342-346). The service
  owns the DB: it computes the owner's remaining quota and the book's recorded
  size and forwards them; the hook only arithmetic.
- **Delegate object knowledge to git; reimplement nothing.** The push's byte
  growth is the sum of `introducedObjects`' sizes, read with `git rev-list` /
  `git cat-file --batch-check` as `contents` already execs them; do not `du` the
  quarantine, parse packs, or walk `objects/` by hand (the `contents`/`stowaways`
  precedent).
- **Fail closed.** A missing or non-numeric `ESTANTE_BOOK_BYTES` /
  `ESTANTE_ACCOUNT_BYTES_REMAINING`, or a failure of any git command the check
  runs, is a **refusal**, not an acceptance — the hook refuses what it cannot
  verify, naming only the structural fault (mirrors `main.go`'s handling of a
  `Contents`/`Stowaways` error). The service always sets both vars, so a missing
  value is a contract violation, not a user input.
- **Conservative accounting.** Summed object sizes are git's *inflated* content
  sizes; the on-disk footprint (`books.size_bytes`, packed/compressed) is no
  larger, so `ESTANTE_BOOK_BYTES + growth` over-estimates the true post-push
  on-disk size and the cap refuses, if anything, slightly early. For an
  abuse-prevention cap on a generous limit (50 MB of text) that bias is correct
  (see Decisions); a push is never wrongly *accepted*.
- **Git's guards are config on the spawn, uniform across every push.** The two
  `-c receive.*` flags go on the receive-pack invocation in `Store.Serve`, where
  `-c core.hooksPath` already is, not in each repo's config at `InitBare`/`Fork`
  — so no repository (however created, including forks and repos predating the
  change) can be missing them, and they cannot drift (see Decisions).
- **No song text, no secrets in logs.** A refusal names the limit that was
  exceeded and may name the pushing user (DIRECTION §3.6 L346 — the pusher's own
  id, relayed only to the pusher), never a path's bytes, a commit message, a
  blob's content, or another account's data. The byte figures are the user's own.
- **Canonical form over preserving content** — not this task's concern (bytes,
  not spelling). **Accessibility / offline-first** — not applicable (server-side,
  no UI). **No book without an account** — already enforced by the service before
  git is spawned (`gitAuthorize`/`authorizePush`). Recorded so the closer sees
  each standing rule was considered.

## Acceptance criteria

**Behavior delivered.** The `pre-receive` binary, installed in a book's bare
repository the way `git_http` runs it, refuses — whole, with a readable reason
on git's channel — a push whose net byte growth would take the book over 50 MB
(given its `ESTANTE_BOOK_BYTES`) or over the account's `ESTANTE_ACCOUNT_BYTES_REMAINING`,
and accepts a push that stays within both; it runs only after the refs,
stowaways and contents layers accept. The service spawns `git receive-pack` with
`-c receive.fsckObjects=true` and `-c receive.maxInputSize=<configured>` so git
itself refuses a malformed object or an over-size pack before the hook runs,
with the refusal reaching the client through git's own channel. Over the full
stack, a push whose growth exceeds an account's remaining quota (its size set in
Postgres) is refused.

**Tests, by level** (the note names behavior and e2e-api; a **unit** level is
added for the pure arithmetic and parsing, following the refs/stowaways/contents
precedent — see Decisions):

- **unit** — `service/internal/hook/limits_test.go` (Go, no git, no DB): the
  pure parts of the check.
  - **env parsing** — a well-formed `ESTANTE_BOOK_BYTES` /
    `ESTANTE_ACCOUNT_BYTES_REMAINING` parsed; a missing or non-numeric value is
    an error (fail closed). Pins DIRECTION §3.6 L342-346 and the fail-closed rule.
  - **net-growth summing** — the parser over `git cat-file --batch-check` output
    and the sum of `objectInfo.Size` (reusing `parseBatchCheck`); a malformed
    line is an error.
  - **the decision function** — given `(bookBytes, accountRemaining, growth)`:
    within both caps → accept; `bookBytes + growth` one byte over 50 MB → refuse
    naming the book limit; `growth` one byte over `accountRemaining` → refuse
    naming the account limit; exactly at each cap → accept (boundary). Pins
    workflow 14 L41, L42-43.
- **behavior** — `service/cmd/pre-receive/limits_test.go` (Go, `package main`;
  reuses `buildHook`/`newBook`/`git`/`mustGit`/`gitEnv`/`writeSong`/`assertRefused`
  from the refs behavior test; the push env carries the `ESTANTE_*` figures the
  test sets, the way the service would):
  - **a book over 50 MB refused** — `ESTANTE_BOOK_BYTES` set near 50 MB and a
    push whose growth crosses it (purpose-written filler song content, never
    copyrighted words); refused, stderr naming the per-book limit.
  - **a push over the account's remaining quota refused** —
    `ESTANTE_ACCOUNT_BYTES_REMAINING` set small and a push whose growth exceeds
    it; refused, stderr naming the account limit.
  - **a push within both caps accepted** — `ESTANTE_BOOK_BYTES` / remaining
    generous, a small push; accepted (the check does not refuse a normal push).
  - **`receive.maxInputSize` refused** — the bare repo configured with a tiny
    `receive.maxInputSize` (as the service sets via `-c`) and a larger pack
    pushed; git refuses, the refusal reaching the client (pins that the
    configured guard bites).
  - **a corrupt object caught by fsck refused** — the bare repo configured with
    `receive.fsckObjects=true` and a push carrying a malformed object (a crafted
    receive-pack, borrowing `stowaways_test.go`'s `packObjects`/`receivePack`
    helpers, or a tree/commit with a known fsck violation); git refuses.

  No Postgres, no axe. Pins workflow 14 L41, L42-43, L109-110.
- **behavior (service wiring)** — `service/internal/server/git_test.go` (Go,
  `package server`, httptest against real git): a test
  (`TestReceivePackGuards`, beside `TestGitPushEnvironmentAndSizeRefresh`) that a
  push to the handler, with `ReceiveMaxInputSize` configured tiny, is refused by
  git for exceeding `receive.maxInputSize`, and a push carrying a malformed
  object is refused by `receive.fsckObjects` — proving the service actually
  spawns receive-pack with the two `-c` guards (the git-config behavior test
  above proves git enforces them; this proves the service sets them). Pins
  workflow 14 L109-110 and the DIRECTION §3.6 L347-348 "size cap before git
  reads a byte" promise at the receive-pack layer.
- **e2e-api** — `e2e/api/git.test.js` (Vitest, ESM, against the compose stack):
  register an account, create a book, set the book's `size_bytes` in Postgres
  (`connect()` from `e2e/api/lib/db.js`) to leave a small positive quota
  headroom, then push (via `GitCli`/`IsoGit`) a growth exceeding it; the stack
  refuses through git's own channel (the hook's reason relayed as `remote:`
  inside the 200 receive-pack result). This exercises the hook's per-account
  check over HTTP end-to-end — distinct from the service's pre-git 413 when
  headroom is already ≤ 0 (pinned in `git_test.go`). Pins workflow 14 L42-43,
  L111 and DIRECTION §3.6 L342-346.

Fixtures use songs written for the purpose (`writeSong`,
`e2e/api/fixtures/`); all oversize content is purpose-written filler, never
copyrighted words. No follow-up work is deferred by this task.

## Decisions

- **Two parts: a hook check plus service-set git config.** The 50 MB-per-book
  and per-account byte caps need the push's growth, measurable only on the
  quarantined objects, so they are a hook check (`limits.go`). `receive.fsckObjects`
  and `receive.maxInputSize` are enforced by git *before* the hook runs (during
  index-pack), so they cannot be hook code; they are config the service sets on
  the receive-pack spawn. Workflow 14 lists all four under "What the service
  checks", so one task carries both. *Why:* each guard lands at the layer that
  can enforce it. *Alternative rejected:* doing the per-push size cap in the hook
  alone and dropping `receive.maxInputSize` — leaves git unpacking an arbitrarily
  large pack into the quarantine before any hook runs, a DoS the hook cannot
  prevent.
- **Measure growth by summing `introducedObjects`' sizes (reuse the `contents`
  seam), not by `du` of the quarantine.** `git rev-list --objects <new> --not
  --all` → `git cat-file --batch-check` already gives every net-new object with
  its size in `contents.go`; summing is a pure function. *Why:* pure git
  delegation (the standing hook rule), reuses a unit-tested helper, no filesystem
  walking. The sizes are inflated content sizes; since the on-disk footprint is
  no larger, `ESTANTE_BOOK_BYTES + growth` over-estimates the true post-push size
  and the cap errs toward refusing a borderline push — the correct bias for an
  abuse guard on a limit (50 MB of text) no real songbook approaches, and a push
  is never wrongly accepted. *Alternative rejected:* `du` the `GIT_QUARANTINE_PATH`
  — closer to `ESTANTE_BOOK_BYTES`'s on-disk units but a filesystem walk the hook
  otherwise never does, and the quarantine's loose/thin-pack form is not the
  final packed form either, so it is no more accurate.
- **`Limits` runs after `Contents` accepts, in the sequential pipeline.** Like
  the earlier layers it needs the one accepted `refs/heads/main` new head and
  presupposes no stowaways (so the reachable set *is* the push); if an earlier
  layer refused there is no head to measure against. Ordering relative to
  `canonical` (the other post-`contents` sibling) does not matter — both must
  pass — so `limits` composes after `contents` and `canonical`, when it lands,
  composes independently. *Why:* keeps each layer's precondition clear; follows
  the established pattern. *Alternative rejected:* run every check and
  concatenate reasons — would special-case the no-valid-head case for no gain.
- **The two `-c receive.*` guards go on the receive-pack spawn in `Store.Serve`,
  not in repo config at `InitBare`/`Fork`.** `Serve` already injects `-c
  core.hooksPath` on every push; adding the two flags there makes them uniform
  across every repository and every push regardless of how the repo was created,
  with no drift and no migration of existing repos. *Why:* one seam, no repo can
  be missing the guard. *Alternative rejected:* `git config receive.maxInputSize
  …` at `InitBare`/`Fork` — repos created before the change (and any future
  creation path that forgets) would lack it.
- **`receive.maxInputSize` is a configurable service value
  (`ESTANTE_RECEIVE_MAX_INPUT_SIZE`), defaulting to 64 MB; the per-book 50 MB cap
  is a `package hook` constant.** The git-level pack cap only needs to sit above
  the largest legitimate push (a fresh ~50 MB book, compressed well under that)
  and below the 128 MB HTTP body cap; 64 MB does. Making it configurable lets the
  behavior and service tests set it tiny to exercise the refusal (an un-overridable
  64 MB default is impractical to exceed in a test), mirroring
  `ESTANTE_GIT_MAX_BODY_BYTES`. The semantic 50 MB-per-book limit is a separate
  concern the hook owns, so it is a constant in `limits.go` (`maxBookBytes int64 =
  50 * 1024 * 1024`), not shared with the service — the two numbers need not and
  do not agree. `receive.fsckObjects` is always `true` (no value to tune). *Why:*
  config where a test needs a knob, a constant where the spec fixes the number.
  *Alternative rejected:* a single shared 50 MB constant imported across the
  `hook` and `server`/`book` packages — couples packages for two unrelated
  numbers (a semantic content cap vs. a coarse pack-byte DoS guard).
- **A unit level is added though the note names only behavior and e2e-api.** The
  env parsing, the size summing and the accept/refuse arithmetic are pure
  functions with clear boundaries (at-cap vs. one-over); unit-pinning them is
  cheap and follows the refs/stowaways/contents precedent (each added a unit
  level for its pure logic). The env-reading, the real `git` object reads and the
  git-config guards stay at the behavior level because they need a real binary,
  real objects and a real quarantine/receive-pack. No level the note names is
  dropped.
- **The e2e-api case drives the hook's per-account check, not the pre-git 413.**
  The service's 413 for an account already at ≤ 0 headroom is pinned server-side
  (`git_test.go`); the new value this task's e2e adds is a push that git *does*
  run (positive headroom) whose growth the **hook** refuses, reaching the client
  through git's channel over HTTP — the path no earlier test covers. *Why:*
  proportionate — one e2e that exercises the net-new end-to-end path. *Alternative
  rejected:* an e2e for `receive.maxInputSize` too — the behavior and service
  tests already pin that guard at both the git and the service-wiring layer;
  a third over-HTTP run would duplicate for no coverage.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `service/internal/hook/limits.go` (new): `Limits` layer — reads `ESTANTE_BOOK_BYTES` and `ESTANTE_ACCOUNT_BYTES_REMAINING`, sums introduced-object sizes via `introducedObjects`/`parseBatchCheck` from `contents.go`, refuses if the book would exceed 50 MB or growth exceeds the account's remaining quota; fail-closed on missing/non-numeric env vars or git command failure.
- `service/cmd/pre-receive/main.go`: `run()` composes `Limits` as the final step after `Contents` accepts.
- `service/internal/book/book.go`: `Store.Serve` adds `-c receive.fsckObjects=true` and `-c receive.maxInputSize=<n>` to the `git receive-pack` spawn, beside `-c core.hooksPath`; `GitStream.MaxInputSize` field added.
- `service/internal/config/config.go`: `ReceiveMaxInputSize` config field (default 64 MB, `ESTANTE_RECEIVE_MAX_INPUT_SIZE` env override).
- `service/internal/server/email_links.go`, `service/internal/server/git.go`: `APIDeps` field + `receiveMaxInputSize()` helper + thread into `GitStream`; `service/cmd/service/main.go` wires the config value.
- `service/cmd/pre-receive/refs_test.go`: `gitEnv()` now carries the `ESTANTE_*` vars the service always sets; `gitEnvLimits` helper for limit tests.
- `service/internal/config/config_test.go`: new `ReceiveMaxInputSize` field case.
- `service/internal/hook/limits_test.go` (new): unit tests — env parsing (well-formed/fail-closed), net-growth summing (reusing `parseBatchCheck`), decision function (boundary, per-book, per-account).
- `service/cmd/pre-receive/limits_test.go` (new): behavior tests — per-book cap refused, per-account cap refused, within-caps accepted, `receive.maxInputSize` refused, corrupt object refused by `fsckObjects`.
- `service/internal/server/git_test.go`: `TestReceivePackGuards` — service spawns receive-pack with both `-c` guards and git enforces them.
- `e2e/api/git.test.js`: e2e-api case — push over account quota (set in Postgres) refused through git's channel over HTTP.

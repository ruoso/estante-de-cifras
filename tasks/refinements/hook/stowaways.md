# hook.stowaways — No stowaways

## TaskJuggler

[`tasks/35-hook.tji`](../../35-hook.tji) → `task hook` → `task stowaways`.

## Effort

2d.

## Repository

**estante-de-cifras.** The pre-receive hook is a Go binary in this
repository (DIRECTION §3.6 component table L284: "**The hook** | Go | this
repository, `service/cmd/pre-receive`"). The note does not start with
`cifra.md:`, so no work lands in the sibling repository for this task.

Directories touched:

- `service/internal/hook/` — new `stowaways.go` adds the reachability check
  as a function in `package hook`, beside `refs.go`, so the binary composes
  one more check (hook.refs Decision; DIRECTION §3.6).
- `service/cmd/pre-receive/main.go` — edit `run()` to compose the new check
  after the refs-and-history layer accepts.
- `service/internal/hook/stowaways_test.go` — the unit test (pure parsing
  and set logic).
- `service/cmd/pre-receive/stowaways_test.go` — the behavior test (the real
  binary installed in a real bare repository, driven with the host `git`).
- `e2e/api/git.test.js` (and a helper in `e2e/api/lib/git.js`) — the
  e2e-api crafted-pack refusal case.

No Dockerfile change: `hook.refs` already builds `./cmd/pre-receive` and
installs the binary at `/srv/hooks/pre-receive`
(`Dockerfile:72-73`, `:89-94`); this task only adds code the existing binary
links.

## Inherited dependencies

- **`hook.refs`** — *settled* (refinement
  [`tasks/refinements/hook/refs.md`](refs.md), Done 2026-10-07). It
  established everything this task builds on:
  - the hook skeleton — `ParseUpdates` (the stdin parse loop,
    `service/internal/hook/refs.go:41-58`), the accept/refuse convention
    (exit 0 / non-zero, each reason on stderr relayed through git's channel,
    `service/cmd/pre-receive/main.go:26-50`), and the `RefUpdate` type
    (`refs.go:30-34`);
  - the exec-git-against-the-quarantine pattern — `IsAncestor`
    (`refs.go:89-105`) execs `git` in the bare repo and relies on git
    exposing the quarantine to the hook's child commands through the
    inherited environment (`refs.go:83-88`); the stowaways check follows the
    same pattern with `git rev-list --objects` and `git cat-file`;
  - the composition seam — `main.run()` calls the checks in `package hook`
    and maps their combined result to the exit code and stderr
    (`main.go:26-50`); this task adds one more call;
  - the behavior-test harness — `buildHook`, `newBook`, `git`/`mustGit`,
    `writeSong`, `assertRefused` in
    `service/cmd/pre-receive/refs_test.go` (a local push to a bare repo with
    the binary installed via `core.hooksPath`, no server, no Postgres);
  - the e2e refusal pattern — the "hook: refs (hook.refs)" describe in
    `e2e/api/git.test.js` (~L201-244) asserts a refusal through git's own
    channel (the relayed `remote:` output, L238-242).
- Transitively **`service.git_http`** and **`foundation.e2e_api`** —
  *settled* through `hook.refs`: the service spawns `git receive-pack` with
  `-c core.hooksPath=/srv/hooks` so git owns the quarantine and runs the hook
  (DIRECTION §3.6 L335), and the black-box harness at `e2e/api/` drives real
  git clients against the compose stack.

`stowaways` is the **second** hook subtask (`depends !refs`). The four later
ones — `contents`, `canonical`, `limits`, `messages` — add their checks on
top of the same skeleton.

## What this task is

The "No stowaways" check (workflow 14 §"What the service checks", third
bullet). git invokes the pre-receive hook with the pushed objects held in a
**quarantine** — a temporary object directory git creates for each push and
only migrates into the repository if the hook accepts. The refs-and-history
layer (`hook.refs`) already confines the push to one fast-forward update of
`refs/heads/main`; this layer checks that the push carries **no objects the
new `main` does not refer to**. git's own connectivity check only verifies
that everything *needed* to reach the new head is present — it says nothing
about *extra* objects riding along in the pack. A crafted pack can smuggle
objects no commit references (future-referenced blobs, hidden history, raw
file storage) into the object store; the hook lists every object in the
quarantine, compares it with what the new head reaches, and refuses the whole
push if even one object is surplus.

Concretely, for the accepted `refs/heads/main` update (new value `<new>`, the
one update that survived the refs layer):

- **Introduced set** — `git rev-list --objects <new> --not --all`: the
  objects reachable from the new head that the repository did not already
  have. This is workflow 14's "`rev-list --objects` from the new head,
  excluding what the repository already had".
- **Quarantined set** — every object physically present in the quarantine
  (the objects the push brought), enumerated with
  `git cat-file --batch-all-objects --batch-check='%(objectname)'` run with
  the object directory pointed at the quarantine and alternates cleared, so
  the main store is excluded.
- A quarantined object that is **not** in the introduced set is a stowaway —
  unless the repository already had it (a redundant re-send, which "excluding
  what the repository already had" permits). One real stowaway refuses the
  whole push, naming the fault on git's channel.

## Why it needs to be done

Workflow 14 is explicit that checking the latest commit's files is not enough
(`docs/workflows/14-file-view.md:86-92`): "a push can carry objects no commit
refers to, other refs, tags, or history rewritten to hide what it held. So
the `pre-receive` hook, run by git itself on objects still held in quarantine
(DIRECTION §3.3), checks all of it." The "No stowaways" bullet
(L98-101) is the object-reachability layer: "Every object the push brought
must be reachable from the new commits … One object more, and the push is
refused." Without it, a member who can push could add unreachable objects to
a book's repository — using it as raw storage, or planting objects a later
ref move could expose — behind the app's back. `hook.refs` closed the "One
ref." and "Fast-forward only." bullets; `hook.contents` (the next subtask,
`depends !stowaways`) then checks every **blob reachable from a new commit**,
which only means anything once this layer guarantees there are no unreachable
objects hiding in the pack. The same no-stowaway guard is reused by the home
book (`docs/home-book-format.md:492`), validated in the separate task
`hook.home_book`.

## Inputs / context

Normative:

- `docs/workflows/14-file-view.md:84-113` — §"What the service checks". The
  bullet in scope, **"No stowaways."** (L98-101) verbatim: "Every object the
  push brought must be reachable from the new commits: the objects in
  quarantine are listed and compared with `rev-list --objects` from the new
  head, excluding what the repository already had. One object more, and the
  push is refused." Framing at L86-92 (why the latest commit is not enough;
  the quarantine; a failing push refused whole, naming what failed, its
  objects never reaching the repository). L113: a local book never pushed is
  held to all of this when it is put online.
- `docs/DIRECTION.md` §3.3 L196-198 (the hook is "a Go program of its own,
  checks every push against what a book may hold…"); §3.3 L186-187 (one bare
  repo per book at `/data/books/<id>.git`); §3.6 component table L284 (the
  hook at `service/cmd/pre-receive`); §3.6 "Git over HTTP" L335-336 ("The
  protocol, the packs, ref locking, the quarantine and running the hook stay
  git's own"), L341 ("What the hook refuses still reaches the client through
  git's own channel"), L342-346 (the hook has no database connection of its
  own; it inherits the `git receive-pack` environment).

Seams this task extends (from `hook.refs`, settled):

- `service/internal/hook/refs.go:89-105` `IsAncestor` — the exec-git pattern
  to copy (`exec.Command("git", …)`, `cmd.Dir = repoDir`, exit-code
  handling, no DB); `:115-134` `Refs` — the orchestrator shape (collect
  reasons, return a real git failure as `err`); `:21` `ZeroSHA`, `:25`
  `MainRef`, `:30-34` `RefUpdate`.
- `service/cmd/pre-receive/main.go:26-50` `run()` — reads stdin and (now)
  the environment, composes the checks, maps the result to exit code +
  stderr. The ancestry check is run with repoDir `""` (inherit the hook's
  cwd, which git sets to the bare repo, `main.go:33-34`).
- `service/cmd/pre-receive/refs_test.go` — `buildHook` (`go build` the binary
  named exactly `pre-receive` into a temp dir), `newBook` (`git init --bare
  -b main`, `core.hooksPath`, a work repo, an initial `main`), `git`/`mustGit`
  with a hardened `gitEnv` (`GIT_CONFIG_NOSYSTEM=1`, fixed identity),
  `writeSong`, `assertRefused` (push failed, output has `remote:` and the
  reason substring). Reusable from `package main`.
- `e2e/api/git.test.js` — `registerNewAccount`, `createBook`, `gitEndpoint`,
  the "hook: refs (hook.refs)" describe and its `remote:`-relayed refusal
  assertion (L238-242); `e2e/api/lib/git.js` — `GitCli.pushHTTP` (cookie via
  `-c http.extraHeader`), `IsoGit.push`, `makeTempDir`; `e2e/api/lib/http.js`
  `HttpClient` (`postJson`, raw body POST, cookie jar);
  `e2e/api/fixtures/songs.js` `sampleSong`.
- `service/internal/server/git.go:348-356` `pushEnv` — the `ESTANTE_*`
  contract (`ESTANTE_USER`, `ESTANTE_BOOK`, `ESTANTE_ROLE`,
  `ESTANTE_ACCOUNT_BYTES_REMAINING`, `ESTANTE_BOOK_BYTES`). `stowaways` does
  **not** read these (the check is structural, over objects, not accounts);
  the account-limit subtask `hook.limits` reads them. Recorded so the closer
  sees the contract was considered.

Git quarantine mechanics this task depends on (git ≥ 2.13 receive-pack):

- git stages a push's objects in a quarantine directory and sets
  `GIT_QUARANTINE_PATH` to it in the pre-receive hook's environment; it also
  points `GIT_OBJECT_DIRECTORY` at the quarantine and lists the real store in
  `GIT_ALTERNATE_OBJECT_DIRECTORIES`, so the hook's child git commands read
  the incoming objects and the existing ones together. If the hook accepts,
  git migrates the quarantine into the repository; if it refuses, the objects
  are discarded (workflow 14 L90-92; DIRECTION §3.6 L335).

## Constraints / requirements

- **The hook is the guarantee, not the app.** It runs on quarantined objects
  and refuses the whole push on any surplus object; refused objects never
  reach the repository (workflow 14 L90-92). It exits 0 to accept, non-zero
  to refuse, writing each refusal reason to stderr, which git relays to the
  client prefixed `remote:` (DIRECTION §3.6 L341). Refusal rides inside the
  200 receive-pack result body, not an HTTP error.
- **Physically enumerate the quarantine, do not re-walk reachability for it.**
  The point of the check is to catch objects that are *present but
  unreachable*; a reachability walk alone would never see them. The
  quarantined set is read from the quarantine directory itself (via
  `cat-file --batch-all-objects` with the object directory set to
  `GIT_QUARANTINE_PATH` and `GIT_ALTERNATE_OBJECT_DIRECTORIES` cleared, so the
  main store's objects are not counted), then compared with the
  reachability-derived introduced set.
- **Delegate object knowledge to git; reimplement nothing.** Reachability is
  read with `git rev-list --objects`, enumeration with `git cat-file`,
  already-had with `git cat-file -e` — execed in the bare repo exactly as
  `IsAncestor` execs `git merge-base` (`refs.go:89-105`). Do not parse pack
  files or walk `objects/` by hand; do not read the DB (DIRECTION §3.6
  L342-346).
- **A real git failure is a refusal, not an acceptance.** If any git command
  used by the check fails (a broken object, a git error — distinct from a
  clean "no stowaways" result), the hook refuses the push rather than accept
  something it could not verify, naming only the structural fault — never
  object contents. This mirrors `main.go:36-42`.
- **No song text, no secrets in logs.** A refusal names the fault and the
  count of surplus objects. Object ids are content-addressed SHAs (not song
  text) and may appear; no blob contents, commit messages, or account data
  are logged.
- **No account data.** `stowaways` reads no `ESTANTE_*` value and keeps no DB
  connection; it needs only the quarantine, the bare repo, and the new head.
- **The app and the service and the hook share no code** beyond the API
  contract and the format (DIRECTION §3.6 L288-291). `stowaways` adds no
  cross-repository dependency; it does not link cifra.md-for-Go (that arrives
  with `hook.canonical`).
- Not applicable to this task, recorded so the closer sees they were
  considered: accessibility and offline-first (no UI, server-side);
  canonical form (enforced in `hook.canonical`); "no book without an account"
  (membership is enforced in the service before git is spawned).

## Acceptance criteria

**Behavior delivered.** The `pre-receive` binary, installed in a book's bare
repository the way `git_http` runs it, accepts a push whose quarantine holds
only objects reachable from the new `refs/heads/main` (including a normal
fast-forward that reuses objects the repository already had), and refuses —
whole, with a readable reason on git's channel — any push whose pack carries
even one object unreachable from the new head. The check runs only after the
refs-and-history layer has accepted (so there is a valid, single new head to
reach from).

**Tests, by level** (the note names behavior and e2e-api; a unit level is
added for the pure parsing and set logic — see Decisions):

- **unit** — `service/internal/hook/stowaways_test.go` (Go, no git, no DB):
  the pure parts of the check. (1) parsing `git rev-list --objects` output —
  lines of `<sha>`, `<sha> SP <path>`, and blank lines — into an
  object-name set keyed on the first field; (2) parsing
  `cat-file --batch-check='%(objectname)'` output (one sha per line) into a
  set; (3) the stowaway determination given three sets — quarantined minus
  introduced minus already-had — returning a refusal reason naming the count
  when the surplus is non-empty and nothing when it is empty. Pins workflow
  14 "No stowaways" (L98-101): "one object more … refused" as pure set logic,
  and "excluding what the repository already had".
- **behavior** — `service/cmd/pre-receive/stowaways_test.go` (Go; reuses
  `buildHook`/`newBook`/`git`/`assertRefused` from the refs behavior test):
  - **a crafted pack with a stowaway refused** — seed a bare repo with an
    initial `main` and the hook installed; in a work repo build the
    fast-forward commit for `main` and a purpose-written **unreachable**
    object (a blob written with `git hash-object -w`, or an orphan commit on
    a temp ref later deleted); build a pack holding the new head's objects
    **plus** the unreachable object with `git pack-objects` fed an explicit
    object list; deliver it to the bare repo's `git receive-pack` through a
    hand-built pkt-line request (one `<old> SP <new> SP refs/heads/main`
    command line, a flush, then the pack) so the objects land in a real
    quarantine; assert the hook refuses, stderr naming the surplus/stowaway
    fault.
  - **a push reusing objects the repository already had accepted** — a normal
    fast-forward `git push` (a thin pack whose base objects the repo already
    holds): the quarantine carries only the introduced objects, all reachable
    from the new head; accepted.

  No Postgres (the hook has no DB). No axe (not UI). Pins workflow 14 "No
  stowaways" (L98-101), both the refusal and the accepted-reuse clause.
- **e2e-api** — `e2e/api/git.test.js`, a new "hook: stowaways
  (hook.stowaways)" describe against the compose stack: a member registers,
  creates a book, and pushes an initial `main` (accepted); then a **crafted
  pack carrying an object unreachable from the new head** is POSTed to the
  book's `git-receive-pack` endpoint with the session cookie (a helper in
  `e2e/api/lib/git.js` shells out to the host `git pack-objects` to build the
  pack and frames the receive-pack request), and the stack refuses it, the
  reason read through git's own channel (the `remote:` line inside the
  report-status body). Pins workflow 14 "No stowaways" and DIRECTION §3.6
  L341 (the refusal reaches the client through git's own channel), and proves
  the stowaway check is actually built into and run by the image.

Fixtures use songs written for the purpose
(`e2e/api/fixtures/the-tuning-song.cifra.md`, `fixtures/songs.js`, and
`writeSong` in the behavior tests); any crafted stowaway content is
purpose-written, never copyrighted words.

No follow-up work is deferred by this task. (The behavior-test helpers may be
factored out of `refs_test.go` into a shared `_test.go` file as a trivial
inline refactor — not a WBS leaf.)

## Decisions

- **The check lives in `service/internal/hook/stowaways.go`, composed by
  `main.run()` after the refs layer.** A new function (e.g. `Stowaways(updates
  []RefUpdate, repoDir, quarantinePath string) (reasons []string, err
  error)`) sits beside `Refs`, and `main` runs it only when `Refs` returned
  no reasons and no error. *Why:* it keeps the pure parts unit-testable and
  matches the one-function-per-check design `hook.refs` set up (`refs.go:1-7`
  package doc). *Alternative rejected:* inline in `package main` — pushes all
  coverage to the slower behavior level.
- **Run stowaways only after refs accepts (sequential layers), not merged
  into one reason list.** The reachability check presupposes exactly one
  accepted, non-deletion `refs/heads/main` update to reach from; if the refs
  layer refused (a tag, a deletion, a non-fast-forward), the push is refused
  already and there is no meaningful "new head". *Why:* avoids computing
  reachability against a head that will not be set, and keeps each layer's
  precondition clear. *Alternative rejected:* always run every check and
  concatenate reasons — it would have to special-case the no-valid-head case
  anyway, for no gain. (The later subtasks `contents`/`canonical` likewise
  presuppose an accepted head and chain the same way.)
- **The comparison is `rev-list --objects <new> --not --all` versus the
  physically-enumerated quarantine, with already-had objects allowed.** This
  is workflow 14's "`rev-list --objects` from the new head, excluding what the
  repository already had", read literally: the introduced set is the
  reachable delta, and a quarantined object outside it is a stowaway unless
  the repository already had it. The already-had allowance (a `git cat-file
  -e` against the pre-existing store — `GIT_OBJECT_DIRECTORY` = the bare
  repo's `objects`, alternates and quarantine cleared) is the realization of
  "excluding what the repository already had"; it keeps a redundant re-send
  of an existing object (a client that builds non-thin packs) from being a
  false stowaway, while a genuine unreachable object still refuses.
  *Alternative considered:* compare the quarantine against the **full**
  reachable set `git rev-list --objects <new>` (no `--not`, no already-had
  step) — behaviorally near-identical for every legitimate push (all reused
  objects in a fast-forward are reachable from the new head) and one fewer
  git invocation, but it departs from the note's prescribed form and would
  walk the new head's entire history on every push rather than only the
  delta. The prescribed `--not --all` delta is bounded by the push size and
  matches the normative wording, so it is chosen.
- **Enumerate the quarantine with `cat-file --batch-all-objects`, alternates
  cleared, not a filesystem walk.** Running `git cat-file --batch-all-objects
  --batch-check='%(objectname)'` with `GIT_OBJECT_DIRECTORY` set to
  `GIT_QUARANTINE_PATH` and `GIT_ALTERNATE_OBJECT_DIRECTORIES=""` lists every
  object physically in the quarantine (loose and packed) and nothing from the
  main store. *Why:* git already knows how to read both loose and packed
  objects; a hand-rolled walk of `objects/??/` plus `pack/*.idx` would
  duplicate git and drift. *Alternative rejected:* walking the quarantine
  directory and parsing pack indexes by hand — more code, same answer, and
  fragile across git's object-storage formats.
- **The quarantine path comes from `GIT_QUARANTINE_PATH`, falling back to
  `GIT_OBJECT_DIRECTORY`.** git sets both to the quarantine for the
  pre-receive hook; `GIT_QUARANTINE_PATH` is the explicit marker. If neither
  is set (quarantine somehow disabled), the hook cannot distinguish new
  objects from old and **refuses** the push rather than accept unverified —
  consistent with the "a git failure is a refusal" constraint.
- **A unit level is added (the note lists only behavior and e2e-api).** The
  output parsing and the three-set difference are pure logic with several
  cases; unit-pinning them is cheap and follows the `refs` precedent of
  unit-testing the pure hook helpers. The reachability and enumeration
  themselves stay at the behavior level because they need real git, a real
  quarantine, and real objects. No named level is dropped.
- **The crafted pack is delivered through `git receive-pack`, the honest
  reproduction of a misbehaving client.** A well-behaved client's
  `pack-objects` only ever sends reachable objects, so a plain `git push`
  cannot produce a stowaway; the test builds the pack with an explicit object
  list and frames a receive-pack request so the extra object reaches a real
  quarantine and the real hook. *Why:* it exercises exactly the attack the
  check defends against — git's own connectivity check passes such a pack
  (it verifies only that needed objects are present), which is why the hook
  is needed at all. The e2e-api case does the same over HTTP against the
  stack.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `service/internal/hook/stowaways.go` — new `Stowaways()` function in `package hook`; enumerates the quarantine with `git cat-file --batch-all-objects`, computes the introduced set with `git rev-list --objects <new> --not --all`, applies the already-had allowance, and returns a refusal reason naming the surplus count when any stowaway is found.
- `service/internal/hook/stowaways_test.go` — unit tests: rev-list parsing, cat-file parsing, and the three-set `StowawayReason` determination (accept, already-had re-send excused, one-more refused with count, several counted).
- `service/cmd/pre-receive/main.go` — `run()` composes `hook.Stowaways` after `hook.Refs` accepts; added `refute` helper and quarantine-path resolution from `GIT_QUARANTINE_PATH` / `GIT_OBJECT_DIRECTORY`.
- `service/cmd/pre-receive/stowaways_test.go` — behavior tests: crafted pack with a stowaway (hand-framed `git receive-pack` pkt-line request) refused whole with reason on git's channel; normal fast-forward reusing existing objects accepted.
- `e2e/api/lib/git.js` — helpers `revParse`, `hashObject`, `buildCraftedReceivePack`, `demuxReceivePack`, `pktLine`, `spawnGit` for constructing a crafted stowaway pack and framing the receive-pack request over HTTP.
- `e2e/api/git.test.js` — "hook: stowaways (hook.stowaways)" describe: crafted pack POSTed to `git-receive-pack`; `ng refs/heads/main` on band 1 and the hook reason relayed on side-band band 2 inside a 200; fresh clone still at the old head.

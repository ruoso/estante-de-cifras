# hook.contents — What a book may hold

## TaskJuggler

[`tasks/35-hook.tji`](../../35-hook.tji) → `task hook` → `task contents`.

## Effort

2d.

## Repository

**estante-de-cifras.** The pre-receive hook is a Go binary in this
repository (DIRECTION §3.6 component table L284: "**The hook** | Go | this
repository, `service/cmd/pre-receive`"). The note does not start with
`cifra.md:`, so no work lands in the sibling repository for this task. In
particular, this task links **no** cifra.md-for-Go — it checks a blob's
*path, mode, encoding and size*, not its canonical form; the canonical check
(and the cifra.md-for-Go dependency) is the next subtask, `hook.canonical`.

Directories touched:

- `service/internal/hook/` — new `contents.go` adds the allowed-contents
  check as a function in `package hook`, beside `refs.go` and `stowaways.go`,
  so the binary composes one more check (hook.refs / hook.stowaways Decision;
  DIRECTION §3.6). It adds the first object-reading helper the hook has for
  *blob mode, size and content* (none exists today — see Inputs).
- `service/internal/hook/contents_test.go` — the unit test (pure path/kind,
  mode, UTF-8, size and `.gitattributes`-byte logic, plus the output
  parsers).
- `service/cmd/pre-receive/main.go` — edit `run()` to compose the new check
  after the stowaways layer accepts.
- `service/cmd/pre-receive/contents_test.go` — the behavior test (the real
  binary installed in a real bare repository, driven with the host `git`).

No Dockerfile change: `hook.refs` already builds `./cmd/pre-receive` and
installs the binary at `/srv/hooks/pre-receive`
(`Dockerfile` build stage and `:89-94`); this task only adds code the
existing binary links.

## Inherited dependencies

- **`hook.stowaways`** — *settled* (refinement
  [`tasks/refinements/hook/stowaways.md`](stowaways.md), Done 2026-10-07),
  itself built on **`hook.refs`** (Done 2026-10-07). Together they established
  everything this task builds on:
  - the hook skeleton — `ParseUpdates` (the stdin parse loop,
    `service/internal/hook/refs.go:41`), the `RefUpdate` type
    (`refs.go:30-34`), `ZeroSHA` (`refs.go:21`), `MainRef = "refs/heads/main"`
    (`refs.go:25`), and the accept/refuse convention (exit 0 / non-zero, each
    reason on stderr relayed through git's channel, `service/cmd/pre-receive/main.go:27`,
    `refuse()` at `:72`);
  - the sequential-layer composition seam — `main.run()` runs `hook.Refs`,
    then (only if it accepted) `hook.Stowaways`; this task adds one more call,
    run only if stowaways accepted (`main.go:27-70`);
  - the exec-git-against-the-quarantine pattern — `runGit(repoDir, env,
    args...)` and `envWithout(base, keys...)` (`stowaways.go:257`, `:281`),
    `revListObjects` (`git rev-list --objects <new> --not --all`,
    `stowaways.go:206`), `quarantineObjects` (`stowaways.go:220`), and the
    already-accepted new head `acceptedMainHead(updates)` (`stowaways.go:192`),
    all of which this task reuses or mirrors;
  - the three-set pure-logic precedent — `StowawayReason` / `surplusObjects`
    (`stowaways.go:94`, `:108`) and its parsers `parseFirstField`
    (`stowaways.go:62`), unit-tested in `stowaways_test.go`;
  - the behavior-test harness — `buildHook`, `newBook`, `git`/`mustGit`,
    `gitEnv`, `writeSong`, `assertRefused` in
    `service/cmd/pre-receive/refs_test.go` (a local push to a bare repo with
    the binary installed via `core.hooksPath`, no server, no Postgres), and
    the crafted-object helpers `packObjects`/`receivePack`/`pktLine` in
    `stowaways_test.go` (not needed here — a well-behaved `git push` suffices
    to introduce a disallowed file).
- Transitively **`service.git_http`** and **`foundation.e2e_api`** —
  *settled* through the refs/stowaways chain: the service spawns `git
  receive-pack` with `-c core.hooksPath=/srv/hooks` so git owns the quarantine
  and runs the hook (DIRECTION §3.6 L335), and the black-box harness at
  `e2e/api/` drives real git clients against the compose stack.

`contents` is the **third** hook subtask (`depends !stowaways`). It
presupposes the refs layer (one fast-forward `refs/heads/main` update) and the
stowaways layer (no object present that the new head does not reach), so
"every blob reachable from a new commit" is a well-defined, fully-present set
by the time this check runs. The two later subtasks `canonical` (`depends
!contents`) and `limits` (`depends !contents`) add their checks on top.

## What this task is

The "what a book may hold" check (workflow 14 §"What a book may hold",
L16–47, enforced by §"What the service checks" bullets L102–108). For the one
accepted `refs/heads/main` update (new value `<new>`), the hook examines
**every blob reachable from a new commit** — the introduced history, not only
the tip commit — and refuses the whole push unless each blob satisfies the
songbook's rules:

- **Path against the allowed kinds** (workflow 14 L24–28): `*.cifra.md` songs
  and `*.setlist.md` setlists in **any folder**; `README.md` at the **root**
  only; `.gitattributes` at the **root** only, and only when its bytes are
  exactly what the app writes (below). Anything else — a `LICENSE`, a
  `notes.txt`, a `.cifra.md` in no folder vs. a bare `cifra.md`, a `README.md`
  in a subfolder, a `.gitattributes` in a subfolder — is a disallowed path and
  refuses the push.
- **Mode: regular files only** (workflow 14 L30): a blob's tree-entry mode
  must be `100644`. An executable (`100755`), a symlink (`120000`) and a
  submodule / gitlink (`160000`) are each refused — "no symlinks, no
  submodules, nothing executable".
- **Encoding: UTF-8** (workflow 14 L30–31): every file's bytes are valid
  UTF-8. (The stricter text rules — no BOM, LF, one final newline, NFC, no
  tabs — and canonical song/setlist form belong to `hook.canonical`; this
  layer checks only that the bytes decode as UTF-8.)
- **Size: at most 256 KB per file** (workflow 14 L31, L40): a blob over the
  per-file cap is refused.
- **`.gitattributes` exactly as the app writes it** (workflow 14 L28, L73):
  the root `.gitattributes`, if present, must equal the songbook bytes the app
  scaffolds — `*.cifra.md merge=cifra` / `*.setlist.md merge=cifra` with one
  trailing LF (`app/src/worker/books.js:33-35`). Any other `.gitattributes`
  content is refused.

Alongside the blobs, the structural guard rails on the carrier objects
(workflow 14 L105–108):

- **Every tree** of reasonable size with entry names of reasonable length
  (regular files and folders only — a consequence of the mode rule plus
  rejecting any tree entry that is itself neither a regular-file blob nor a
  subtree).
- **Every commit** object of reasonable size, "so that commit messages are
  not the storage instead" (L107–108).

Concretely, against the accepted new head `<new>`:

- **Introduced objects, with type and size** — `git rev-list --objects <new>
  --not --all` gives every object the new head reaches that the repository did
  not already have; `git cat-file --batch-check='%(objectname) %(objecttype)
  %(objectsize)'` fed that list classifies each as blob / tree / commit and
  gives its byte size. This drives the blob 256 KB cap and the tree/commit
  reasonable-size guard.
- **Introduced blob paths and modes** — walk the introduced commits (`git
  rev-list <new> --not --all`) and `git ls-tree -r <commit>` each, collecting
  the unique `(mode, sha, path)` tree entries. Each entry's mode and path are
  checked; this is what sees a disallowed path or a non-`100644` mode wherever
  it occurs in the introduced history, not only at the tip.
- **Blob content** — for the unique blob shas (and specifically the
  `.gitattributes` entry), `git cat-file blob <sha>` / `git cat-file --batch`
  reads the bytes; the hook validates UTF-8 and, for `.gitattributes`,
  byte-equality with the expected songbook content.

One failing blob, mode, path, oversize object or wrong-content
`.gitattributes` refuses the whole push, naming the fault (and the offending
path — a content-addressed path, not song text) on git's channel.

## Why it needs to be done

Workflow 14 is explicit that the app keeping to the rules is not what
guarantees them (`docs/workflows/14-file-view.md:86-92`): the hook, run by git
on quarantined objects, "checks all of it", and checking only the latest
commit is not enough. `hook.refs` closed "One ref." and "Fast-forward only.";
`hook.stowaways` closed "No stowaways." so that the set of objects reachable
from the new head is exactly what the push holds — nothing extra, nothing
missing. This task closes "Every blob reachable from a new commit" and the
"Every tree" / "Every commit" guard rails (L102–108): without it, a member who
can push could put arbitrary files (a `LICENSE`, raw non-song storage), binary
or non-UTF-8 content, symlinks or submodules, oversize blobs, or commit
messages used as storage into a book's repository behind the app's back —
exactly what "what a book may hold" (L16–47) forbids. It is also the
precondition the next subtask depends on: `hook.canonical` (`depends
!contents`) checks that each **song and setlist** blob is canonical, which is
only meaningful once this layer has established that the reachable blobs are
UTF-8 text at allowed paths within the size cap.

## Inputs / context

Normative:

- `docs/workflows/14-file-view.md:16-47` — §"What a book may hold". The
  allowed kinds (L24–28): `*.cifra.md` / `*.setlist.md` in any folder,
  `README.md` at the root, `.gitattributes` at the root "exactly as the app
  writes it (below)". The per-file rules (L30–32): "Only regular files: no
  symlinks, no submodules, nothing executable. Each file is UTF-8 text of at
  most **256 KB**." The exclusion (L34–36): "No `LICENSE`, or any other file
  saying on what terms a book is shared." §"### Limits" L40: "**256 KB** per
  file" (the 50 MB per-book and per-account limits, L41–43, are `hook.limits`,
  not this task).
- `docs/workflows/14-file-view.md:84-113` — §"What the service checks". The
  bullets in scope: **"Every blob reachable from a new commit"** (L102–104)
  "is checked, not only those in its last one: its path against what a book
  may hold, its mode, its size, its encoding, and — for songs and setlists —
  that it is canonical" (the canonical clause is `hook.canonical`); **"Every
  tree"** (L105–106) "regular files and folders only, names of reasonable
  length"; **"Every commit"** (L107–108) "a message and author of reasonable
  size, so that commit messages are not the storage instead". L109–111 ("Git's
  own guards" and "The limits") are `hook.limits`. L113: a local book never
  pushed is held to all of this when put online.
- `docs/workflows/14-file-view.md:72-73` — §"Canonical form" names
  `.gitattributes` "must be exactly what the app writes" (the exact-bytes
  acceptance this task enforces; the README text rules and song/setlist
  canonical form at L64–72 are `hook.canonical`).
- `app/src/worker/books.js:33-35` — `GITATTRIBUTES_BYTES`, the exact songbook
  `.gitattributes` the app scaffolds: the two lines `*.cifra.md merge=cifra`
  and `*.setlist.md merge=cifra` with one trailing LF (comment L29–32: "UTF-8,
  LF, one trailing newline — the §6.3 text rules … the home book uses
  different bytes"). This is the byte string the hook holds its own copy of
  (see Decisions — the app and the service share no code).
- `docs/DIRECTION.md` §3.3 L196-198 (the hook "checks every push against what
  a book may hold, its canonical form, and the limits … (workflow 14)"); §3.6
  component table L284 (the hook at `service/cmd/pre-receive`); §3.6 L288-291
  (the app and the service share no code — the service understands a song only
  to check a push, "which the Go implementation does in the hook"); §3.6
  L302-306 (versions — the Go hook carries current and previous canonical
  form; not read by this task); §3.6 "Git over HTTP" L335 ("the quarantine and
  running the hook stay git's own"), L341 ("What the hook refuses still reaches
  the client through git's own channel"), L342-346 (the hook has no database
  connection; it inherits the `git receive-pack` environment).

Seams this task extends (from `hook.refs` / `hook.stowaways`, settled):

- `service/internal/hook/stowaways.go:206` `revListObjects` — the
  `git rev-list --objects <new> --not --all` introduced-set read to mirror for
  the type/size pass; `:220` `quarantineObjects` and `:237`
  `objectInMainStore` — the `cat-file` exec patterns to model the new
  blob-content/`batch-check` helper on; `:257` `runGit(repoDir, env, args...)`
  and `:281` `envWithout` — the shared exec helpers (reused directly); `:192`
  `acceptedMainHead(updates)` — the one accepted non-deletion `refs/heads/main`
  new value to check from (reused directly); `:62` `parseFirstField` and the
  1 MiB scanner-buffer convention — the parser precedent.
- `service/internal/hook/refs.go:30-34` `RefUpdate`; `:41` `ParseUpdates`;
  `:21` `ZeroSHA`; `:25` `MainRef` — the stdin contract and types.
- `service/cmd/pre-receive/main.go:27` `run()` (composes the checks, maps the
  result to exit code + stderr), `:52-55` (the `GIT_QUARANTINE_PATH` /
  `GIT_OBJECT_DIRECTORY` read — not needed by this task, which reads reachable
  objects via the inherited env like `revListObjects`), `:72` `refuse()`.
- `service/cmd/pre-receive/refs_test.go:24` `buildHook`, `:38` `gitEnv`, `:50`
  `git`, `:60` `mustGit`, `:73` `newBook`, `:96` `writeSong`, `:162`
  `assertRefused` — the behavior-test harness, reused from `package main`.
- `service/internal/server/git.go:348` `pushEnv` — the `ESTANTE_*` contract.
  `contents` does **not** read these (the check is structural, over objects,
  not accounts); the account/book-size subtask `hook.limits` reads them.
  Recorded so the closer sees the contract was considered.

Git quarantine mechanics this task relies on (git ≥ 2.13 receive-pack):
during pre-receive, git points `GIT_OBJECT_DIRECTORY` at the quarantine and
lists the real store in `GIT_ALTERNATE_OBJECT_DIRECTORIES`, so the hook's
child `git` commands read the incoming objects and the existing ones together;
`git rev-list`/`ls-tree`/`cat-file` against the new head therefore see every
reachable blob whether it is new or pre-existing (workflow 14 L89–92; DIRECTION
§3.6 L335). This task does **not** need to repoint the object directory the way
`quarantineObjects` does — it reads reachability from the new head, not the raw
quarantine contents.

## Constraints / requirements

- **The hook is the guarantee, not the app.** It runs on quarantined objects
  and refuses the whole push on any disallowed blob, mode, path, oversize
  object or wrong `.gitattributes`; refused objects never reach the repository
  (workflow 14 L90–92). It exits 0 to accept, non-zero to refuse, writing each
  refusal reason to stderr, which git relays to the client prefixed `remote:`
  (DIRECTION §3.6 L341). Refusal rides inside the 200 receive-pack result body,
  not an HTTP error.
- **Check all reachable blobs, not only the tip.** The set is the introduced
  history (`git rev-list <new> --not --all`); a disallowed path, mode or oversize
  blob anywhere in a new commit refuses the push, even if the tip no longer
  shows it (workflow 14 L86–88, L102). The mode and path of a blob come from
  the tree entries that reach it, not from a single rev-list path annotation
  (see Decisions).
- **Delegate object knowledge to git; reimplement nothing.** Reachability is
  read with `git rev-list`, tree entries with `git ls-tree`, type/size with
  `git cat-file --batch-check`, content with `git cat-file blob` / `--batch` —
  execed in the bare repo exactly as `revListObjects`/`quarantineObjects` exec
  `git` (`stowaways.go:206`, `:220`). Do not parse pack files or walk
  `objects/` by hand; do not read the DB (DIRECTION §3.6 L342-346).
- **A real git failure is a refusal, not an acceptance.** If any git command
  the check runs fails (a broken object, a git error — distinct from a clean
  "all blobs allowed" result), the hook refuses the push rather than accept
  something it could not verify, naming only the structural fault — never
  object contents. This mirrors `main.go`'s handling of a `Stowaways`/`Refs`
  error.
- **Encoding vs. canonical.** This layer checks that each file's bytes are
  valid UTF-8. The stricter §"Canonical form" text rules (no BOM, LF, one
  final newline, NFC, no tabs) and the song/setlist canonical form are
  `hook.canonical`'s; a well-formed-UTF-8 but non-canonical song passes
  `contents` and is refused by `canonical`. This keeps `contents` free of any
  cifra.md-for-Go dependency.
- **The `.gitattributes` bytes are duplicated, not shared.** The app and the
  service (and the hook) share no code beyond the API contract and the format
  (DIRECTION §3.6 L288-291). The hook holds its own copy of the expected
  songbook `.gitattributes` bytes (a Go constant), matching
  `app/src/worker/books.js:33-35` byte-for-byte; the agreement is held by a
  test and by the end-to-end flow where an app-created book's `.gitattributes`
  is pushed through the real hook (see Decisions), not by importing JS.
- **No song text, no secrets in logs.** A refusal names the fault and the
  offending path. A repository path is content the pusher chose for the file,
  not the song's words; the path and object ids (content-addressed SHAs) may
  appear, but no blob contents, commit messages, or account data are logged.
  (A refused `.gitattributes` names the path, not the mismatching bytes.)
- **No account data.** `contents` reads no `ESTANTE_*` value and keeps no DB
  connection; it needs only the bare repo and the accepted new head. The
  50 MB / per-account limits (workflow 14 L41–43) and git's own guards
  (L109–110) are `hook.limits`.
- Not applicable to this task, recorded so the closer sees they were
  considered: accessibility and offline-first (no UI, server-side); canonical
  form (enforced in `hook.canonical`); "no book without an account" (membership
  is enforced in the service before git is spawned).

## Acceptance criteria

**Behavior delivered.** The `pre-receive` binary, installed in a book's bare
repository the way `git_http` runs it, accepts a push whose new commits
introduce only allowed songbook files — `*.cifra.md` / `*.setlist.md` in any
folder, a root `README.md`, and a root `.gitattributes` holding exactly the
app's songbook bytes — each a regular-file (`100644`) UTF-8 blob at most 256 KB,
with trees and commits of reasonable size; and refuses — whole, with a readable
reason on git's channel — any push a new commit of which introduces a
disallowed path (including a subfolder `README.md`/`.gitattributes` and a
`LICENSE`), a non-`100644` mode (symlink, submodule, executable), non-UTF-8
bytes, a blob over 256 KB, a `.gitattributes` whose bytes differ from the app's,
or an unreasonably large tree/commit object. The check runs only after the
refs-and-history and no-stowaways layers have accepted.

**Tests, by level** (the note names unit and behavior; see Decisions for why no
e2e-api level is added):

- **unit** — `service/internal/hook/contents_test.go` (Go, no git, no DB): the
  pure parts of the check.
  - **path/kind classifier** — `*.cifra.md` and `*.setlist.md` at the root and
    in nested folders accepted; `README.md` and `.gitattributes` at the root
    accepted by path; `README.md`/`.gitattributes` in a subfolder, `LICENSE`,
    `notes.txt`, a bare `cifra.md` (no stem), a `*.cifra.md.bak`, and an empty
    or `..`-bearing path refused. Pins workflow 14 L24–28, L34–36.
  - **mode classifier** — `100644` accepted; `100755` (executable), `120000`
    (symlink), `160000` (gitlink/submodule) refused. Pins workflow 14 L30.
  - **UTF-8 check** — valid UTF-8 accepted; an invalid byte sequence refused.
    Pins workflow 14 L30–31.
  - **size check** — a blob at the 256 KB cap accepted, one byte over refused.
    Pins workflow 14 L31, L40.
  - **`.gitattributes` bytes** — the exact expected songbook bytes accepted; a
    byte-different `.gitattributes` refused; the expected constant equals
    `app/src/worker/books.js` `GITATTRIBUTES_BYTES`. Pins workflow 14 L28, L73.
  - **tree/commit reasonable size** — a tree/commit object within the guard-rail
    bound accepted, one over refused; an over-long path component refused. Pins
    workflow 14 L105–108.
  - **parsers** — `git ls-tree -r` output (`<mode> SP <type> SP <sha> TAB
    <path>`) and `git cat-file --batch-check='%(objectname) %(objecttype)
    %(objectsize)'` output parsed into typed entries (mirroring
    `parseFirstField`, `stowaways.go:62`); a malformed line is an error.
- **behavior** — `service/cmd/pre-receive/contents_test.go` (Go; reuses
  `buildHook`/`newBook`/`git`/`mustGit`/`gitEnv`/`writeSong`/`assertRefused`
  from the refs behavior test; a plain `git push` introduces each case — no
  crafted pack needed):
  - **a disallowed path refused** — a commit adding `LICENSE` (and, as table
    rows, `notes.txt`, a subfolder `README.md`, a subfolder `.gitattributes`);
    each refused, stderr naming the path.
  - **a symlink refused** — a tracked symlink (tree mode `120000`); refused.
  - **a non-UTF-8 file refused** — a `*.cifra.md` whose bytes are invalid UTF-8
    (purpose-written); refused.
  - **a file over 256 KB refused** — a `*.cifra.md` padded past the cap
    (purpose-written filler, never copyrighted words); refused.
  - **an executable file refused** — a `*.cifra.md` committed with mode
    `100755`; refused. (A submodule/gitlink case is included if it can be set
    up with the host `git` in the harness; otherwise the `160000` mode is left
    to the unit classifier, noted in the test.)
  - **`.gitattributes` as the app writes it accepted** — a push whose root
    `.gitattributes` holds exactly the app's songbook bytes, with
    `*.cifra.md`/`*.setlist.md` songs and setlists in root and nested folders
    and a root `README.md`, all `100644` UTF-8 under the cap; accepted.
  - **a byte-different `.gitattributes` refused** — same push but a tampered
    `.gitattributes`; refused.

  No Postgres (the hook has no DB). No axe (not UI). Pins workflow 14
  L24–32 (what a book may hold) and L102–108 (blob path/mode/size/encoding,
  tree/commit size).

Fixtures use songs written for the purpose (`writeSong` and the existing
`e2e/api/fixtures/the-tuning-song.cifra.md` / `fixtures/songs.js`); any oversize
or non-UTF-8 content is purpose-written filler, never copyrighted words.

No follow-up work is deferred by this task. (The behavior-test helpers already
shared between `refs_test.go` and `stowaways_test.go` are reused as-is; any
further factoring is a trivial inline refactor, not a WBS leaf.)

## Decisions

- **The check lives in `service/internal/hook/contents.go`, composed by
  `main.run()` after the stowaways layer.** A new function — e.g.
  `Contents(updates []RefUpdate, repoDir string) (reasons []string, err
  error)` — sits beside `Refs` and `Stowaways`, and `main` runs it only when
  `Stowaways` returned no reasons and no error. *Why:* it keeps the pure parts
  (path/kind, mode, UTF-8, size, `.gitattributes` bytes, parsers)
  unit-testable and matches the one-function-per-check design the hook
  skeleton set up. *Alternative rejected:* inline in `package main` — pushes
  all coverage to the slower behavior level.
- **Run `contents` only after stowaways accepts (sequential layers).** Like
  `stowaways`, the blob walk presupposes exactly one accepted non-deletion
  `refs/heads/main` new head to reach from, and presupposes the pack carries no
  unreachable objects (so the reachable set *is* what the push holds). If an
  earlier layer refused, there is no meaningful head and the push is refused
  already. *Why:* keeps each layer's precondition clear; avoids walking against
  a head that will not be set. *Alternative rejected:* always run every check
  and concatenate reasons — it would special-case the no-valid-head case for no
  gain.
- **Enumerate `(mode, sha, path)` by walking introduced commits with `git
  ls-tree -r`, not by the `rev-list --objects` path annotation.** `git rev-list
  --objects` lists each object once with a single path and no mode, so a blob
  that appears at both an allowed and a disallowed path (or a content that is
  also reachable at an allowed path) could be validated against the wrong
  path, and symlink/executable/submodule modes are invisible to it. Walking
  the introduced commits (`git rev-list <new> --not --all`) and `git ls-tree -r
  <commit>` each, then de-duplicating identical `(mode, sha, path)` tuples,
  sees every reachable path with its mode. *Why:* the hook is a security
  guarantee; it must see every path/mode a blob is introduced at. The cost is
  bounded by the push — the introduced history only, and `receive.maxInputSize`
  (a `hook.limits` concern) caps a single push. *Alternative rejected:* trust
  the `rev-list --objects` annotation (one git invocation fewer) — it can miss a
  disallowed path and cannot see mode, defeating the check.
- **Blob size and the tree/commit reasonable-size guard come from `git
  cat-file --batch-check` over the introduced objects; content and UTF-8 from
  `git cat-file` blob reads.** `--batch-check='%(objectname) %(objecttype)
  %(objectsize)'` over `git rev-list --objects <new> --not --all` classifies
  and sizes every introduced object in one pass (blob 256 KB cap; tree/commit
  reasonable size); the blob *content* (UTF-8 and the `.gitattributes` bytes)
  is read only for the unique blob shas with `git cat-file --batch` / `git
  cat-file blob`. *Why:* git already reads loose and packed objects; a
  hand-rolled reader would duplicate git and drift (the `stowaways` precedent).
  *Alternative rejected:* reading every blob's full content to measure size —
  wasteful when `batch-check` gives the size without the bytes.
- **The hook holds its own copy of the expected songbook `.gitattributes`
  bytes; it does not import the app's constant.** A Go constant in
  `contents.go` equals `app/src/worker/books.js:33-35`
  (`*.cifra.md merge=cifra\n*.setlist.md merge=cifra\n`) byte-for-byte. *Why:*
  DIRECTION §3.6 L288-291 — the app and the service share no code; the format
  and the API contract are the only shared surfaces, and `.gitattributes`
  content is neither. The agreement is *checked, not shared*: the hook's unit
  test pins the constant, and the end-to-end flow where an app-created book is
  published pushes the app's real `.gitattributes` through the real hook (owned
  by the sync/books e2e-web journeys), so a divergence fails there. *Alternative
  rejected:* a build-time step that copies the JS literal into Go — a shared-code
  coupling the direction forbids, for two bytes that change ~never.
- **`contents` enforces the `.gitattributes` exact bytes; `canonical` owns the
  README text rules and song/setlist canonical form.** Workflow 14 names
  `.gitattributes` "exactly as the app writes it" under *both* "what a book may
  hold" (L28) and "Canonical form" (L73); this task's note lists it among the
  allowed kinds, so the exact-bytes acceptance lands here. The README text
  rules (L72) and the song/setlist canonical check (L102 "that it is
  canonical") stay with `hook.canonical`, which links cifra.md-for-Go.
  *Why:* keeps `contents` dependency-free of the format library and gives each
  subtask one coherent concern.
- **No e2e-api level is added (the note names only unit and behavior).** The
  hook-is-built-into-and-run-by-the-image path is already proven at e2e-api by
  `hook.refs` (a force-push refused through the stack) and `hook.stowaways` (a
  crafted pack refused through the stack), and the next subtask `hook.canonical`
  adds an e2e-api case (isomorphic-git pushing a non-canonical song refused by
  the stack) that exercises a *content-level* refusal reaching the client
  through git's own channel over HTTP. A third content-level e2e-api here would
  duplicate that for no added coverage; the behavior test fully exercises the
  check against a real quarantine and a real `git push`. *Why:* proportionate
  testing — the behavior level is where blob path/mode/encoding/size is cheaply
  and exhaustively pinned; the stack integration is covered by siblings. No
  level the note names is dropped.
- **A unit level is kept as the note names it, pinning the pure logic.** The
  path/kind, mode, UTF-8, size and `.gitattributes`-bytes rules and the ls-tree
  / cat-file parsers are pure functions with many cases; unit-pinning them is
  cheap and follows the `refs`/`stowaways` precedent. The reachability walk and
  object reads themselves stay at the behavior level because they need real
  git, real objects and a real quarantine.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `service/internal/hook/contents.go` — new `Contents()` function (path/kind classifier, mode check, UTF-8 validation, 256 KB blob cap, tree/commit reasonable-size + path-component guard, `.gitattributes` exact-bytes check); delegates to `git rev-list`/`ls-tree -r`/`cat-file --batch-check`/`cat-file blob`; sits beside `Refs`/`Stowaways` in `package hook`.
- `service/cmd/pre-receive/main.go` — `run()` composes `Contents` after stowaways accepts; a git failure refuses the push.
- `service/internal/hook/contents_test.go` — unit tests: `TestClassifyPath`, `TestModeAllowed`, `TestValidUTF8`, `TestWithinSizeLimit`, `TestOverLongComponent`, `TestGitattributesMatch` (including constant equality with `app/src/worker/books.js` `GITATTRIBUTES_BYTES`), `TestParseLsTree`, `TestParseBatchCheck`.
- `service/cmd/pre-receive/contents_test.go` — behavior test `TestPreReceiveContents`: allowed full set accepted; disallowed paths (LICENSE, notes.txt, subfolder README.md/.gitattributes); symlink; executable; submodule/gitlink (set up with host git); non-UTF-8; >256 KB; app `.gitattributes` accepted; tampered `.gitattributes` refused.

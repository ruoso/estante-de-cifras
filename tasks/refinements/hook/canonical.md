# hook.canonical — Canonical form

## TaskJuggler

[`tasks/35-hook.tji`](../../35-hook.tji) → `task hook` → `task canonical`.

## Effort

2d.

## Repository

**estante-de-cifras** (the hook binary and its tests), with a **build-time
dependency on cifra.md** (the `go/` module, consumed, not modified). The
pre-receive hook is a Go binary in this repository (DIRECTION §3.6 component
table L284: "**The hook** | Go | this repository, `service/cmd/pre-receive`").
The note does **not** start with `cifra.md:`, so no source lands in the
sibling repository: this task *uses* cifra.md for Go — the reader, canonical
writer, setlist writer and form layer already built by `cifra_go.writer`,
`cifra_go.setlists` and `cifra_go.versions` — to decide whether a pushed song
or setlist is canonical. DIRECTION §3.6 L288–291: "the service never needs to
understand a song except to check that a push holds canonical ones, **which
the Go implementation does in the hook.**"

Directories touched:

- `service/internal/hook/` — new `canonical.go` adds the canonical-form check
  as a function in `package hook`, beside `refs.go`, `stowaways.go`,
  `contents.go` and `limits.go`, so the binary composes one more check
  (hook.refs / hook.stowaways / hook.contents Decision; DIRECTION §3.6). This
  is the **first** hook code to import cifra.md for Go.
- `service/internal/hook/canonical_test.go` — the unit test (the per-blob
  canonical decision over songs, setlists and README.md, with an injected
  synthetic form registry for the current-or-previous rule).
- `service/cmd/pre-receive/main.go` — edit `run()` to compose the new check
  after the contents layer accepts (before limits).
- `service/cmd/pre-receive/canonical_test.go` — the behavior test (the real
  binary installed in a real bare repository, driven with the host `git`).
- `service/go.mod` / `service/go.sum` — add `require
  github.com/ruoso/cifra.md/go` plus a `replace … => ../../cifra.md/go`
  (mirroring the existing `estantedecifras.app/api => ../api` replace at
  `go.mod:40`), and the `Dockerfile` build stage copies the cifra.md `go/`
  source into the image so `go build ./cmd/pre-receive` links it (see
  Decisions — the one Dockerfile change this subtask carries).
- `e2e/api/git.test.js` — the e2e-api case (isomorphic-git pushing a
  non-canonical song, refused by the stack).

## Inherited dependencies

- **`hook.contents`** — *settled* (refinement
  [`tasks/refinements/hook/contents.md`](contents.md), Done 2026-10-07),
  itself built on **`hook.stowaways`** and **`hook.refs`** (both Done
  2026-10-07). Together they established everything this task builds on:
  - the hook skeleton — `ParseUpdates` (`service/internal/hook/refs.go:41`),
    the `RefUpdate` type (`refs.go:30-34`), `ZeroSHA` (`refs.go:21`),
    `MainRef = "refs/heads/main"` (`refs.go:25`), and the accept/refuse
    convention (exit 0 / non-zero, each reason on stderr prefixed
    `pre-receive: ` and relayed through git's channel —
    `service/cmd/pre-receive/main.go` `run()` and `refuse()`);
  - the sequential-layer composition seam — `main.run()` runs `hook.Refs`,
    then (only if it accepted) `hook.Stowaways`, then `hook.Contents`, then
    `hook.Limits`; this task adds one more call, run only if `Contents`
    accepted;
  - the exec-git-against-the-quarantine helpers this task reuses **directly** —
    `runGit(repoDir, env, args...)` (`stowaways.go:257`), `acceptedMainHead(updates)`
    (`stowaways.go:192`), and from `contents.go` the introduced-object reads:
    `introducedCommits` (`contents.go:439`, `git rev-list <new> --not --all`),
    `lsTree` (`contents.go:462`, `git -c core.quotePath=false ls-tree -r
    <commit>` → `treeEntry{Mode,Type,SHA,Path}`), `catFileBlob`
    (`contents.go:503`, `git cat-file blob <sha>`), and the `classifyPath`
    kinds (`contents.go:132`: `kindSong` / `kindSetlist` / `kindReadme` /
    `kindGitattributes` / `kindDisallowed`);
  - the behavior-test harness — `buildHook`, `newBook`, `git`/`mustGit`,
    `gitEnv`/`gitEnvLimits`, `writeSong`, `assertRefused` in
    `service/cmd/pre-receive/refs_test.go` (a local push to a bare repo with
    the binary installed via `core.hooksPath`, no server, no Postgres), and
    `writeAt` from `contents_test.go` (writes a file at an arbitrary path).
- **`cifra_go.writer`** — *settled* (refinement
  [`tasks/refinements/cifra_go/writer.md`](../cifra_go/writer.md), Done, cifra.md
  `d5dd57b`): the canonical writer and the song canonicity predicate. Exported
  in package `cifra` (`github.com/ruoso/cifra.md/go`): `Parse(src []byte)
  (Model, error)`, `Write(model Model) ([]byte, error)` (returns
  `*MarkedTextError` for a conflict-marker text), `IsCanonical(text []byte)
  bool` (the §9.1 check: non-UTF-8 → false, a marker line → false, else
  `Write(Parse(text)) == text`).
- **`cifra_go.setlists`** — *settled* (refinement
  [`tasks/refinements/cifra_go/setlists.md`](../cifra_go/setlists.md), Done,
  cifra.md `839d8c9`): `ParseSetlist`, `WriteSetlist`, `CanonicalSetlist` for
  the setlist canonical form (spec §10.9).
- **`cifra_go.versions`** — *settled* (refinement
  [`tasks/refinements/cifra_go/versions.md`](../cifra_go/versions.md), Done,
  cifra.md `07a72e3`): the form-aware surface this task calls —
  `type Form string`, `const CurrentForm Form = "1"`, `AcceptedForms() []Form`,
  `FormOf(text []byte) (Form, bool)` (the accepted form a **song**'s bytes are
  canonical in, current first, or `("", false)` when none), `SetlistFormOf(text
  []byte) (Form, bool)` (the setlist counterpart), and `IsCanonicalSetlist(text
  []byte) bool`. Each checker already applies the UTF-8 and marker-line gates,
  so a `false` / `("", false)` return already covers non-UTF-8, marked text and
  non-canonical text.
- Transitively **`service.git_http`** and **`foundation.e2e_api`** — *settled*
  through the refs/stowaways/contents chain: the service spawns `git
  receive-pack` with `-c core.hooksPath=/srv/hooks` so git owns the quarantine
  and runs the hook (DIRECTION §3.6 L335), and the black-box harness at
  `e2e/api/` drives real git clients (the git CLI and isomorphic-git) against
  the compose stack, reading a hook refusal off side-band band 2 with
  `demuxReceivePack` (`e2e/api/lib/git.js`).

`canonical` is the **fourth** hook subtask (`depends !contents`). It
presupposes the refs layer (one fast-forward `refs/heads/main` update), the
stowaways layer (no object the new head does not reach), and the contents
layer (every reachable blob is a regular-file UTF-8 blob at an allowed path
within the size cap). So by the time this check runs, "every song and setlist
in a new commit" is a well-defined set of UTF-8 blobs at known kinds, and the
only remaining question is the canonical one.

## What this task is

The canonical-form check (workflow 14 §"Canonical form", L49–82, enforced by
§"What the service checks" bullet L102–104: "for songs and setlists — that it
is canonical"). For the one accepted `refs/heads/main` update (new value
`<new>`), the hook examines **every blob reachable from a new commit** — the
introduced history, the same set `hook.contents` walks — and, for the blobs
`contents` classified as songs, setlists or the root README, refuses the whole
push unless each is in canonical form:

- **Each `*.cifra.md` song** is canonical under an accepted form — current or
  (for a grace window) the previous one: `cifra.FormOf(bytes)` returns
  `(form, true)`. A song that is non-canonical, holds a git conflict-marker
  line, or is not UTF-8 returns `("", false)` and refuses the push.
- **Each `*.setlist.md` setlist** is canonical under an accepted form:
  `cifra.SetlistFormOf(bytes)` returns `(form, true)`, else the push is
  refused.
- **The root `README.md`** is held to the **text rules** (workflow 14 L64–65,
  L72): UTF-8 with no BOM, LF line endings only (no CR), NFC, no tabs, and
  exactly one final newline — and holds no conflict-marker line. README is
  *not* a song and gets no song/setlist canonical form; only the text rules
  plus the marker-line refusal.
- **Marker lines are refused wherever they appear** (DIRECTION §2.2 L95–97; spec
  §11.12.3): a line that is, or begins with and a space follows, one of git's
  four conflict markers `<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`. For songs
  and setlists this is already inside `FormOf`/`SetlistFormOf`; for README the
  hook applies it alongside the text rules. "A text holding them is never
  canonical, so it is never saved or pushed."

`.gitattributes` is already held to its exact app bytes by `hook.contents`
(contents Decision; workflow 14 L73) — `canonical` does not re-check it. Any
disallowed path, non-UTF-8 blob or oversize blob was already refused by
`contents`, so `canonical` only ever sees UTF-8 song / setlist / README blobs.

Concretely, against the accepted new head `<new>`, reusing the contents seam:
walk `introducedCommits(repoDir, newHead)` and `lsTree` each to get the
`(mode, sha, path)` tree entries, `classifyPath` each path, and for every
unique song / setlist / README blob sha read its bytes with `catFileBlob` and
run the matching checker. One non-canonical or marked song or setlist, or a
README violating a text rule or holding a marker, refuses the whole push,
naming the fault and the path (never the bytes) on git's channel.

## Why it needs to be done

Workflow 14 §"Canonical form" (L49–55, as corrected by this task — see
Decisions) is the project's load-bearing promise: "**The app canonicalizes
every song and setlist when saving, and the service refuses any commit holding
one that is not canonical.**" The app canonicalizes, but the app is not what
guarantees it (L86: "The app keeps to the rules, but it is not what guarantees
them"); a member who pushes with a plain git client, a tampered app, or a
merge gone wrong could otherwise land non-canonical or conflict-marked text in
a shared book. This is the subtask that makes the canonical rule a *guarantee*
rather than an app convention, closing the one still-open clause of workflow 14
§"What the service checks" — bullet L102–104's "and — for songs and setlists —
that it is canonical", which `hook.contents` explicitly deferred here.

It is also what makes canonical form a cross-implementation invariant in
practice: the app writes with cifra.md for JavaScript, the hook checks with
cifra.md for Go, and the two cannot disagree because both are held to the
shared corpus byte for byte (DIRECTION §3.6 L293–300). A song the JS app calls
canonical the Go hook must also accept — proven by the corpus in
`cifra_go.*`, relied on here.

Downstream, `hook.messages` (`depends !canonical, !limits`) normalises every
refusal reason — including this task's — into one client-readable matrix;
`hook.home_book` (`depends … !canonical`) reuses the "canonical, in a profile's
form, no markers" shape to validate a home-book settings push against its own
allowed kinds. Both need this check in place first.

## Inputs / context

Normative:

- `docs/workflows/14-file-view.md:49-82` — §"Canonical form". "**The app
  canonicalizes every song and setlist when saving, and the service refuses any
  commit holding one that is not canonical.** A file is canonical when writing
  it back from what was read changes nothing" (L51–53). The text rules "are
  fixed here: UTF-8 with no BOM, LF, exactly one final newline, NFC, no tabs"
  (L64–65). "**`README.md`** is not a song, but is held to the text rules"
  (L72). **When the canonical form changes** (L77–82): "only new commits are
  checked … The service accepts the previous form as well as the current one
  for a while, so a device that has been offline across the change still
  syncs." (L53–55 is the implementation-naming sentence this task corrects —
  see Decisions / design delta.)
- `docs/workflows/14-file-view.md:102-104` — §"What the service checks", the
  bullet in scope: "**Every blob reachable from a new commit** is checked, not
  only those in its last one: its path against what a book may hold, its mode,
  its size, its encoding, **and — for songs and setlists — that it is
  canonical**." (Path/mode/size/encoding are `hook.contents`; the canonical
  clause is this task.) Refusal behaviour L89–92: refused "whole, naming what
  failed", objects never reach the repository.
- `docs/DIRECTION.md` §2.2 L95–97 — "a text holding them [git's conflict
  markers] is never canonical, so it is never saved or pushed"; L83–84 — sync
  merges are "canonicalised first (cifra.md §8), and the result is canonical"
  (a merged commit is checked like any other). §3.3 L196–198 — the hook "checks
  every push against what a book may hold, its canonical form, and the
  limits". §3.6 component table L284 (the hook at `service/cmd/pre-receive`);
  L288–291 (the app and the service share no code; the service understands a
  song only to check a push, "which the Go implementation does in the hook");
  L293–300 (implementations agree because they are checked against the corpus,
  not shared); **§3.6 "Versions." L302–306** — "When the canonical form
  changes, the service accepts the previous form as well as the current one for
  a while (workflow 14), so **the Go hook carries both**; the app carries only
  the current one"; "Git over HTTP" L335 (the quarantine and running the hook
  stay git's own), L341 (a refusal reaches the client through git's own
  channel), L342–346 (the hook has no database connection).
- `/home/ruoso/devel/cifra.md/spec/8-normalisation.md` §8.1 L8–37 — the song
  canonical form: "Every document has exactly one **canonical form**" (unique),
  "A document is canonical exactly when canonicalising it changes nothing,
  which is how a program checks one" (fixed point), "It depends on the text
  alone" (checkable file-by-file), "It holds no marker line … it is never
  canonical, whatever this section would make of its lines". §8.4.1 L158–176 —
  the canonical text rules.
- `/home/ruoso/devel/cifra.md/spec/9-conformance.md` §9.1 L61–62 — the check:
  "A writer that checks whether a document is canonical does so by
  canonicalising it and comparing." (Parse → canonical-write → compare, after
  the UTF-8 and marker gates.) Conformance is by capability profiles; the spec
  carries no document version token.
- `/home/ruoso/devel/cifra.md/spec/10-setlists.md` §10.9 L420–562 — the
  setlist canonical form, "defined completely, byte for byte … A program can
  decide whether a setlist is canonical from its text alone, without the songs
  it names" (L27–30, L430–432). §10.9.1 the text rules; §10.9.3 L546–561 a
  link's text is not refreshed (canonicity never depends on the named songs).
- `/home/ruoso/devel/cifra.md/spec/11-merge.md` §11.12.3 L1035–1056 — the
  marker-line definition: "A **marker line** is a line, after the text layer
  of §1.3, that is `<<<<<<<`, `=======`, `>>>>>>>` or `|||||||`, either alone or
  followed by a space and anything … A program that checks whether a text is
  canonical, such as a hook that guards a book, MUST find a marked text not
  canonical." Note **four** markers (including `|||||||`).

The cifra.md Go surface this task calls (package `cifra`,
`github.com/ruoso/cifra.md/go`; settled by `cifra_go.*`):

- `go/versions.go` — `FormOf(text []byte) (Form, bool)` (L79),
  `SetlistFormOf(text []byte) (Form, bool)` (L85), `AcceptedForms() []Form`
  (L53), `type Form string` (L21), `const CurrentForm Form = "1"` (L26). The
  registries `songForms` / `setlistForms` hold exactly one entry today
  (`CurrentForm`), newest first; a future form change prepends `"2"` and keeps
  `"1"` as the previous — a one-entry data edit, no hook change.
- `go/write.go` — `IsCanonical(text []byte) bool` (the current-form song
  checker, wrapped by `FormOf`), `type MarkedTextError struct { Line int; Text
  string }`. `go/setlist.go` — `IsCanonicalSetlist`, wrapped by
  `SetlistFormOf`. `go/text.go` — `Prepare(data []byte) ([]string, error)` (the
  §1.3 text layer: UTF-8 validate, strip U+FEFF, NFC, split lines, tabs→space,
  trim trailing U+0020) and `type NotUTF8Error`. (`isMarkerLine` is
  **unexported**; the README marker check is the hook's own — see Decisions.)
- `Merge` / `MergeOutputs` are stubs returning `ErrNotImplemented` (a future
  `cifra_go.merge` task) — **not** used here; a merged commit is checked as
  plain canonical text like any other, per workflow 14 L74–75.

Seams this task extends (from `hook.contents`, settled):

- `service/internal/hook/contents.go:439` `introducedCommits(repoDir, newHead)`,
  `:462` `lsTree(repoDir, commit)` (→ `[]treeEntry{Mode,Type,SHA,Path}`), `:503`
  `catFileBlob(repoDir, sha)`, `:132` `classifyPath` (the `kindSong` /
  `kindSetlist` / `kindReadme` kinds), `:292` `Contents` (the composed check to
  run after); `service/internal/hook/stowaways.go:192` `acceptedMainHead`,
  `:257` `runGit`.
- `service/cmd/pre-receive/main.go` `run()` — composes the checks; this task
  inserts `hook.Canonical` after `Contents` accepts and before `Limits`, with
  the same `err` → "could not verify" → exit 1 and `reasons` → `refuse`
  handling.
- `service/cmd/pre-receive/refs_test.go` `buildHook`/`newBook`/`git`/`mustGit`/
  `gitEnv`/`gitEnvLimits`/`writeSong`/`assertRefused`; `contents_test.go`
  `writeAt` — the behavior-test harness reused from `package main`.
- `e2e/api/git.test.js` ("git over HTTP"), `e2e/api/lib/git.js` `IsoGit`
  (`push({url,cookie,ref})`) and `demuxReceivePack` (band 2 = relayed hook
  stderr), `e2e/api/fixtures/songs.js` — the e2e-api harness.
- `service/go.mod:40` `replace estantedecifras.app/api => ../api` — the
  relative-replace precedent this task mirrors for cifra.md; `Dockerfile`
  build stage (`hook.refs` built `./cmd/pre-receive` and copied the binary to
  `/srv/hooks/pre-receive`) — the build to extend so cifra.md `go/` is present.

## Constraints / requirements

- **The hook is the guarantee, not the app.** It runs on quarantined objects
  and refuses the whole push on any non-canonical / marked song or setlist, or
  any README that breaks a text rule; refused objects never reach the
  repository (workflow 14 L89–92). It exits 0 to accept, non-zero to refuse,
  writing each reason to stderr prefixed `pre-receive: `, which git relays to
  the client prefixed `remote:` (DIRECTION §3.6 L341). Refusal rides inside the
  200 receive-pack result body, not an HTTP error.
- **Check all reachable song/setlist/README blobs, not only the tip.** The set
  is the introduced history (`introducedCommits`), exactly as `contents` walks
  it; a non-canonical song anywhere in a new commit refuses the push, even if
  the tip no longer shows it (workflow 14 L86–88, L102). Run only after
  `Contents` accepts, so every blob seen is already a UTF-8 regular file at an
  allowed path within the size cap (sequential layers).
- **Decide canonicity with cifra.md for Go; reimplement nothing of the format.**
  A song is checked with `cifra.FormOf`, a setlist with `cifra.SetlistFormOf`;
  these *are* the §9.1 parse-write-compare check with the UTF-8 and marker
  gates. The hook does not re-derive canonical form, parse chords, or scan for
  song-level markers itself — the format library owns that, and it agrees with
  the app's JS because both pass the corpus (DIRECTION §3.6 L293–300). The hook
  shares no code with the app (the format and the API are the only shared
  surfaces); it *imports the Go format library*, which is exactly the sharing
  the direction intends ("which the Go implementation does in the hook", §3.6
  L291).
- **Current or previous form, via the form layer.** Acceptance is `FormOf` /
  `SetlistFormOf` returning `ok == true` — the disjunction over
  `AcceptedForms()` (DIRECTION §3.6 L302–306: "the Go hook carries both").
  Today the registry holds one form; the hook asks the registry, so the day a
  form is added the hook accepts the previous one for the grace window with no
  hook change. The hook must **not** hard-code `IsCanonical` / `CurrentForm`
  alone, which would reject a previous-form song the moment a second form
  ships.
- **README is held to the text rules, not to a song/setlist form.** The six
  text rules (UTF-8 no BOM, LF only, NFC, no tabs, exactly one final newline)
  plus no marker line. These are a product rule fixed in workflow 14 L64–65,
  L72 — not a cifra.md spec construct — so the hook owns the README check in Go
  (like it owns its `.gitattributes` constant); see Decisions.
- **A real git or library failure is a refusal, not an acceptance.** If a git
  command fails, or `cifra.Parse` returns an unexpected error the checker does
  not already fold into `false`, the hook refuses rather than accept something
  it could not verify, naming only the structural fault — never object
  contents. This mirrors `main.go`'s handling of a `Contents`/`Stowaways`
  error. (`FormOf`/`SetlistFormOf` return a bool, not an error, so the normal
  non-canonical path is a clean refusal reason, not a verify failure.)
- **No song text, no secrets in logs.** A refusal names the fault ("not in
  canonical form", "holds a conflict marker", "not valid UTF-8 / not LF / has a
  byte-order mark / not NFC / has a tab / missing or extra final newline") and
  the offending path (content the pusher chose, not the song's words). It never
  logs blob bytes — in particular never the marker line's text, nor the
  mismatching README bytes, nor a `*MarkedTextError`'s `.Text`. A line number
  (metadata) may be named; the bytes may not. (DIRECTION §3.3 "no song text in
  logs"; the `contents` precedent.)
- **No account data.** `canonical` reads no `ESTANTE_*` value and keeps no DB
  connection; it needs only the bare repo and the accepted new head. Per-book /
  per-account limits and git's own guards are `hook.limits`.
- **Canonical form over preserving content.** The whole point: a non-canonical
  spelling is refused, not tidied or preserved. The hook never rewrites a blob;
  it accepts or refuses. (The app canonicalises on save; the hook only checks.)
- Not applicable to this task, recorded so the closer sees they were
  considered: accessibility and offline-first (no UI, server-side); "no book
  without an account" (membership is enforced in the service before git is
  spawned).

## Acceptance criteria

**Behavior delivered.** The `pre-receive` binary, installed in a book's bare
repository the way `git_http` runs it, accepts a push whose new commits
introduce only **canonical** songs and setlists (under an accepted form) and a
root `README.md` that obeys the text rules; and refuses — whole, with a
readable reason on git's channel — any push a new commit of which introduces a
non-canonical `*.cifra.md` song, a non-canonical `*.setlist.md` setlist, any
song/setlist/README holding a git conflict-marker line, or a `README.md` that
breaks a text rule (a byte-order mark, a CR, a tab, a non-NFC sequence, or a
missing/extra final newline). The check runs only after the refs, no-stowaways
and contents layers have accepted, and canonicity is decided by cifra.md for
Go (`FormOf` / `SetlistFormOf`), the current-or-previous-form disjunction the
registry defines.

**Tests, by level** (the note names unit, behavior and e2e-api):

- **unit** — `service/internal/hook/canonical_test.go` (Go, no git, no DB): the
  per-blob canonical decision, isolated from the git walk. The decision helper
  takes the form-checker as a parameter (a `func([]byte) (cifra.Form, bool)`),
  so the dual-form rule can be exercised without inventing a second published
  form (see Decisions).
  - **song canonicity** — a canonical song (a corpus-style `canonical.cifra.md`
    body, purpose-written) accepted; a non-canonical one (unsorted voicings /
    stray blank lines) refused; a non-UTF-8 song refused; a song holding a
    `<<<<<<<` / `=======` / `>>>>>>>` / `|||||||` marker line refused. Pins
    workflow 14 L51–53, L102; spec §8.1, §9.1 L61–62; §11.12.3.
  - **setlist canonicity** — a canonical setlist accepted; a non-canonical one
    refused; a marked setlist refused. Pins workflow 14 L63 (the setlist's own
    canonical form); spec §10.9.
  - **current-or-previous form** — with an injected synthetic two-form checker
    (`[]formCheck{{CurrentForm, isCanonical}, {Form("0-crlf"), prevCheck}}`, the
    shape `cifra_go.versions` proves with): a text canonical only under the
    previous form **accepted**; a text canonical only under the current form
    accepted; a text canonical under neither refused; a marked / non-UTF-8 text
    refused. Pins workflow 14 L77–82; DIRECTION §3.6 L302–306.
  - **README text rules** — a README obeying all six rules (and marker-free)
    accepted; one with a byte-order mark, one with a CRLF, one with a tab, one
    not in NFC, one with no final newline, one with two final newlines, and one
    holding a marker line — each refused, naming which rule. Pins workflow 14
    L64–65, L72; spec §8.4.1 (the text-rule shape); §11.12.3 (marker).
  - **refusal reasons name the fault and path, never the bytes** — a refused
    marked song's reason contains neither the marker line text nor the blob
    bytes (no song text in logs). Pins DIRECTION §3.3.
- **behavior** — `service/cmd/pre-receive/canonical_test.go` (Go; reuses
  `buildHook`/`newBook`/`git`/`mustGit`/`gitEnv`/`gitEnvLimits`/`writeSong`/
  `assertRefused` from the refs behavior test and `writeAt` from the contents
  behavior test; a plain `git push` introduces each case — no crafted pack
  needed). The built binary carries the real one-form registry.
  - **a canonical song accepted** — a push whose new commit adds a canonical
    `*.cifra.md` (and a canonical `*.setlist.md`, and a text-rule-clean root
    `README.md`); accepted. Pins workflow 14 L51–53.
  - **a non-canonical song refused** — same push but the song has unsorted
    voicings / stray blank lines (purpose-written, parses fine, not canonical);
    refused, stderr naming the path and "not in canonical form". Pins workflow
    14 L102; spec §8.1, §9.1.
  - **a marked file refused** — a `*.cifra.md` holding a `<<<<<<<` conflict
    marker line (and, as a table row, a marked `*.setlist.md`); refused, stderr
    naming the path and "conflict marker", never the line text. Pins DIRECTION
    §2.2 L95–97; spec §11.12.3.
  - **a non-canonical setlist refused** — a `*.setlist.md` whose body is not in
    canonical order; refused. Pins spec §10.9.
  - **README held to the text rules** — a root `README.md` with a tab (and, as
    table rows, a byte-order mark and a missing final newline); each refused,
    stderr naming the path and the broken rule; a clean README accepted. Pins
    workflow 14 L64–65, L72.

  Note on "a song in the previous form accepted" (the note lists it under
  behavior): the shipped binary's registry has exactly **one** form, so no
  real song can be "in the previous form" at the behavior level; this case is
  pinned at the **unit** level with a synthetic previous form instead (see
  Decisions). No level the note names is dropped; the single-form acceptance is
  the behavior-level positive case.

  No Postgres (the hook has no DB). No axe (not UI).
- **e2e-api** — `e2e/api/git.test.js`, describe `"hook: canonical
  (hook.canonical)"` (Vitest, ESM, against the compose stack via `scripts/gate`
  `stack_up`): using a session cookie and a book the account owns (the "git
  over HTTP" setup the refs / stowaways / limits e2e cases already use), the
  app's git client **isomorphic-git** (`IsoGit.push`) pushes a commit adding a
  non-canonical `*.cifra.md`; the push is refused by the stack, and
  `demuxReceivePack` band 1 shows `ng refs/heads/main` while band 2 carries the
  hook's "not in canonical form" reason — proving a content-level canonical
  refusal reaches the app's own client through git's own channel over HTTP, and
  that the hook (with cifra.md for Go) is actually built into and run by the
  image. Pins workflow 14 L51–53, L89–92; DIRECTION §3.6 L341.

Fixtures use songs and setlists written for the purpose (`writeSong`, a new
purpose-written non-canonical fixture, `e2e/api/fixtures/songs.js`); the
non-canonical and marked bodies are crafted filler, never copyrighted words.

No follow-up work is deferred by this task. (`hook.messages` normalises the
refusal matrix and `hook.home_book` reuses the canonical shape; both already
exist as WBS leaves that depend on `canonical`.)

## Decisions

- **The check lives in `service/internal/hook/canonical.go`, composed by
  `main.run()` after the contents layer and before limits.** A new function
  `Canonical(updates []RefUpdate, repoDir string) (reasons []string, err
  error)` sits beside `Refs` / `Stowaways` / `Contents` / `Limits`, and `main`
  runs it only when `Contents` returned no reasons and no error. *Why:* matches
  the one-function-per-check design the hook skeleton set up (hook.refs
  Decision) and keeps the per-blob decision unit-testable. Placing it after
  `contents` means every blob it sees is already a UTF-8 regular file at an
  allowed path within the cap, so `canonical` reasons only about canonicity.
  *Order vs. limits:* before `Limits` — a push whose content is invalid should
  be refused for that fault regardless of size headroom, and `canonical`'s
  object reads are the same reads `contents` just did (cheap, cached by git's
  object layer); limits stays last as the cheapest, most mechanical gate.
  *Alternative rejected:* inline in `package main` — pushes all coverage to the
  slower behavior level.
- **Decide canonicity through the form layer (`FormOf` / `SetlistFormOf`), not
  `IsCanonical` / `IsCanonicalSetlist` directly.** DIRECTION §3.6 L302–306
  requires the hook to carry the current *and* previous forms; `FormOf` is the
  disjunction over `AcceptedForms()`, so calling it keeps the hook correct the
  day a second form ships — a pure data edit in `go/versions.go`, no hook
  change. The single-form checkers would silently reject a valid previous-form
  document after a form change. *Why:* the versions seam exists precisely so the
  hook asks "any accepted form?" rather than "the current form?". *Alternative
  rejected:* call `IsCanonical`/`IsCanonicalSetlist` — simpler today, wrong the
  moment the form evolves, defeating the whole point of `cifra_go.versions`.
- **"A song in the previous form accepted" is a unit case with a synthetic
  previous form, not a behavior case.** The shipped registry holds exactly one
  form (`cifra_go.versions` decided not to invent a second published form, as
  that would be an unfounded format change). So the dual-form behaviour cannot
  be exercised by the built binary against real data. To pin it honestly, the
  per-blob decision helper takes its form-checker as a parameter (defaulting in
  `main.go`/`Canonical` to `cifra.FormOf` / `cifra.SetlistFormOf`), and the unit
  test injects the same synthetic two-form list `cifra_go.versions` used
  (`{CurrentForm, isCanonical}, {Form("0-crlf"), prevCheck}`) to assert a
  previous-form-only text is accepted and a neither-form text refused. The
  behavior and e2e levels exercise the single shipped form. *Why:* delivers the
  note's named case where it can actually run, mirrors the predecessor's own
  test strategy, and keeps the hook faithful to "current or previous" without a
  fake format version in production. *Alternative rejected:* ship a second
  real form so the behavior test can push a previous-form song — an unfounded
  change to the format, forbidden by the standing rules. *Alternative
  rejected:* drop the previous-form case — it is a named test; relocating it
  with rationale is not dropping it.
- **README is checked natively in the hook against the text rules; it does not
  go through a cifra.md song/setlist parser.** A README is not a song (workflow
  14 L72). The six text rules (UTF-8 no BOM, LF only, NFC, no tabs, one final
  newline) plus no marker line are a *product* rule fixed in workflow 14
  L64–65, not a cifra.md spec construct, so the hook holds the check in Go —
  consistent with it holding its own `.gitattributes` constant (contents
  Decision; DIRECTION §3.6 L288–291, share no code). The NFC check uses
  `golang.org/x/text/unicode/norm` (already in the module graph via cifra.md).
  *Why:* `cifra.Prepare` *normalises* a text (it does not report a fixed-point
  violation) and enforces none of "exactly one final newline", so it cannot
  answer "is this README already canonical?" directly; and there is no corpus
  for READMEs. A short native check, one rule per branch, each unit-pinned, is
  the honest and testable form. *Alternative rejected:* reassemble
  `Prepare(bytes)` and compare to the input — conflates Prepare's
  line-normalisation semantics (trailing-space trimming, blank-run rules) with
  the six README rules and still misses the final-newline rule; the agreement
  that matters (the app writes a clean README) is held by the books/sync e2e
  journeys, not by sharing Prepare.
- **Marker-line refusal applies to README as well as songs and setlists.** For
  songs/setlists it is already inside `FormOf`/`SetlistFormOf`; for README the
  hook applies its own four-marker check (`<<<<<<<`, `=======`, `>>>>>>>`,
  `|||||||`, each alone or followed by a space) after the text-layer prep. *Why:*
  DIRECTION §2.2 L95–97 and spec §11.12.3 — "a text holding them is never
  canonical, so it is never saved or pushed", and the note's "marker lines
  refused" is unqualified. A README is a text a merge can mark just as a song
  is. *Alternative rejected:* refuse markers only in songs/setlists — would let
  a conflict-marked README through, contradicting §2.2.
- **Wire cifra.md for Go into the service module with a relative `replace`,
  mirroring the `api` module, and copy its source in the Dockerfile.**
  `service/go.mod` gains `require github.com/ruoso/cifra.md/go` and `replace
  github.com/ruoso/cifra.md/go => ../../cifra.md/go` (the same relative-sibling
  pattern as `estantedecifras.app/api => ../api` at `go.mod:40`), and the
  `Dockerfile` build stage copies the cifra.md `go/` tree alongside `service/`
  so `go build ./cmd/pre-receive` resolves the replace in the image. *Why:* the
  two repositories are co-located working trees (DIRECTION §3.6 names cifra.md's
  `go/` as "the hook's"); a relative replace is the established in-repo
  mechanism, keeps the build hermetic, and adds no module-registry dependency.
  This is "checked, not shared" at the right grain — the hook *imports* the Go
  format library (intended by §3.6 L291), it does not duplicate or transpile
  it. *Alternative rejected:* a `go.work` file — convenient for local dev but
  not used by `go build` in a reproducible image build the same way, and the
  repo already standardised on relative `replace`. *Alternative rejected:*
  vendoring a copy of cifra.md `go/` into the service — drifts from the source
  of truth and defeats "held to the corpus".
- **Correct workflow 14's canonical-library sentence (design delta, same
  commit).** Workflow 14 L53–55 said "The same library — the cifra.md JS
  library — decides it in the app and on the service"; DIRECTION §3.6 is
  explicit that the service/hook is Go using **cifra.md for Go**, and that
  implementations agree because they are *checked against the corpus, not
  shared* (L288–300). This task is the one wiring the Go library into the hook,
  so it corrects the sentence to "The app decides it with cifra.md for
  JavaScript and the service decides it with cifra.md for Go (DIRECTION §3.6);
  the two cannot disagree about what canonical is, because every implementation
  is held to the shared corpus byte for byte." *Why:* a governing document must
  not misname the component this task implements; the fix is corrective, not a
  behaviour change. *Alternative rejected:* leave the slip and note it only in
  the refinement — the constitution would stay wrong about the hook's language.
- **A unit level is added/kept as the note names it, pinning the per-blob
  decision; the git walk stays at the behavior level.** The decision over a
  song / setlist / README blob (including the dual-form rule via the injected
  checker and every README rule) is pure and has many cases — cheap to pin at
  unit, following the `refs`/`stowaways`/`contents` precedent. The reachability
  walk and object reads need real git, a real quarantine and the built binary,
  so they live at behavior; and the stack-over-HTTP path is pinned at e2e-api
  with isomorphic-git (the app's own client), as the note requires.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-08.

- Created `service/internal/hook/canonical.go` — the `Canonical(updates, repoDir)` function and supporting `blobReason`/`readmeReason` helpers and marker-line check, deciding canonicity via `cifra.FormOf` / `cifra.SetlistFormOf` and the hook's own six-rule README check.
- Wired into `service/cmd/pre-receive/main.go` `run()` — inserted after `Contents` accepts, before `Limits`.
- Added cifra.md-for-Go build dependency: `service/go.mod` (require + relative `replace`), `Dockerfile` (copy the `cifra-md-go` context at the replace target), `compose.yaml` (`cifra-md-go` build context).
- Applied design delta to `docs/workflows/14-file-view.md` — corrected L53–55 to name cifra.md for JavaScript (app) vs. cifra.md for Go (hook) as independent implementations agreed by corpus.
- Canonicalized stale predecessor fixtures across `service/cmd/pre-receive/refs_test.go`, `contents_test.go`, `stowaways_test.go`, `limits_test.go`, `e2e/api/git.test.js`, `e2e/api/change-check.test.js`, `e2e/api/sharing.test.js` (` ```cifra ` → ` ``` `, `[C]x` → `[C] x`, setlist blank-line); added `onMessage` forwarding to `e2e/api/lib/git.js`.
- Canonicalized e2e-web Playwright fixtures in `e2e/web/tests/edit-in-place.spec.js` and `e2e/web/tests/read-in-place.spec.js` (dropped trailing `''` from `SONG_V1`/`BRIDGE` arrays producing non-canonical trailing blank lines).
- Unit tests: `service/internal/hook/canonical_test.go` — song canonicity, setlist canonicity, dual-form via synthetic two-form injected checker, all six README rules, no-bytes-in-reasons.
- Behavior tests: `service/cmd/pre-receive/canonical_test.go` — canonical accept; non-canonical song/setlist; marked song+setlist; README text rules + clean accept.
- e2e-api: `e2e/api/git.test.js` `describe('hook: canonical (hook.canonical)')` — isomorphic-git pushing a non-canonical song refused by the compose stack.

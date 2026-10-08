# hook.messages — Refusal messages

## TaskJuggler

[`tasks/35-hook.tji`](../../35-hook.tji) → `task hook` → `task messages`.

## Effort

1d.

## Repository

**estante-de-cifras.** The pre-receive hook is a Go binary in this
repository (DIRECTION §3.6 component table L284: "**The hook** | Go | this
repository, `service/cmd/pre-receive`"). The note does not start with
`cifra.md:`, so no work lands in the sibling repository. This is the
cross-cutting subtask: it does not add a new check — the five layers already
refuse everything they must — it makes the refusal *messages* those five
layers produce one coherent, tested contract, and it proves that contract
over the whole matrix against the running stack.

Directories touched:

- `service/internal/hook/messages.go` — a new, small, pure home for the
  refusal-message grammar: one helper (`refusal(subject, fault string)`) that
  every check's reason is built from, so the one shape
  `refs/heads/main: <fault>; refused` lives in a single place (today
  `canonical.go` already has a local `canonicalReason`; this generalises that
  precedent across the matrix). No new runtime type (see Decisions).
- `service/internal/hook/refs.go` — align the three reason strings
  (`refs.go:69,72,130`) to the shared grammar; they predate the convention the
  later checks settled on and are the only ones that do not end `; refused`.
- `service/internal/hook/contents.go` — lift the inline `fmt.Sprintf` reasons
  (`contents.go:330,336,342,369,373,390,402`) into named pure formatters that
  call `refusal(...)`, so the unit catalogue can enumerate every contents
  message deterministically (no wording change beyond the shared grammar).
- `service/internal/hook/limits.go` — read `ESTANTE_USER` and name the pushing
  user in the two cap reasons (`limits.go:90-97`), honouring DIRECTION §3.6
  L346 ("names the user in its messages") on the one fault that is the user's.
- `service/internal/hook/messages_test.go` — the unit catalogue: one message
  per refusal, each naming what failed, none carrying song text.
- `service/cmd/pre-receive/main.go` — route the six fail-closed
  "could not verify …" lines (`main.go:33,44,64,80,97,114`) through one helper
  so they share the grammar and no longer interpolate the raw git error into
  the client channel (see Decisions); keep `refuse()` as the single emission
  point.
- `service/cmd/pre-receive/messages_test.go` — the emission contract (one
  `pre-receive: `-prefixed LF line per reason; the fail-closed shape; non-zero
  exit).
- `e2e/api/messages.test.js` — the e2e-api refusal matrix, each message read as
  both the git CLI and isomorphic-git present it (the first e2e coverage of the
  contents refusals, which `hook.contents` landed with behavior tests only).

No Dockerfile change: `hook.refs` already builds `./cmd/pre-receive` and
installs the binary at `/srv/hooks/pre-receive` (`Dockerfile:85,105-106`); this
task only changes strings the existing binary links and the tests over them.
Predecessor tests that assert a now-adjusted exact substring are updated in the
same task and must still pass (most assert loose fault substrings — `remote:` +
"not in canonical form" / "per-book limit" / "stowaway" / "non-fast-forward" —
which survive unchanged).

## Inherited dependencies

- **`hook.canonical`** — *settled* (refinement
  [`tasks/refinements/hook/canonical.md`](canonical.md), Done 2026-10-08).
- **`hook.limits`** — *settled* (refinement
  [`tasks/refinements/hook/limits.md`](limits.md), Done 2026-10-07).

  Together with their own predecessors — `hook.contents`
  ([`contents.md`](contents.md), Done 2026-10-07), `hook.stowaways`
  ([`stowaways.md`](stowaways.md), Done 2026-10-07) and `hook.refs`
  ([`refs.md`](refs.md), Done 2026-10-07) — these settled everything this task
  consolidates:
  - **the full refusal matrix exists.** Every refusal the hook can produce is
    already produced, as a `[]string` reason, by one of the five checks:
    `Refs` (wrong ref / deletion / non-fast-forward, `refs.go:69,72,130`),
    `Stowaways` (surplus-object count, `stowaways.go:99-102`), `Contents`
    (disallowed path, bad mode, over-long component, over-size blob, over-size
    carrier, non-UTF-8, wrong `.gitattributes`, `contents.go:330-403`),
    `Canonical` (song/setlist not canonical, conflict marker, each README
    text-rule, via `canonicalReason`, `canonical.go:96-158`) and `Limits`
    (per-book cap, per-account cap, `limits.go:90-97`);
  - **the emission seam.** `service/cmd/pre-receive/main.go` `run()` composes
    the five checks in order, stops at the first failing layer, and `refuse()`
    writes each reason to stderr prefixed `pre-receive: ` (`main.go:125-130`);
    git relays it to the client prefixed `remote:` and the fail-closed
    git-failure refusals go out the same stderr (`main.go:33,44,64,80,97,114`);
  - **the channel, proven both ways.** `hook.canonical`'s e2e-api case reads a
    refusal off isomorphic-git's side-band band 2 (`IsoGit.push({onMessage})` /
    `demuxReceivePack`, `e2e/api/lib/git.js`), `hook.refs`/`hook.limits` read it
    off the git CLI's `remote:` lines, and `hook.stowaways` added
    `buildCraftedReceivePack` + `demuxReceivePack` to the harness. This task's
    matrix test reuses all of it.
  - **each predecessor explicitly ceded wording here.** `refs.md` Decision
    (L264-270): "`refs` emits readable stderr messages now; **`hook.messages`
    owns the unified contract** … one message per refusal, read identically by
    the git CLI, isomorphic-git and the app." `canonical.md` L179-183 and
    `limits.md` L155 say the same ("`hook.messages` then normalizes how every
    refusal reads").
- Transitively **`service.git_http`** (the service speaks git's smart HTTP and
  installs the hook) and **`foundation.e2e_api`** (the `e2e/api/` harness) are
  *settled* — the five hook e2e-api cases in `e2e/api/git.test.js` run against
  the stack today, so the harness, a passkey-minted session, a book created
  through the API and both git clients are all in place to drive this task's
  matrix (no new dependency needed).

## What this task is

The five checks each already refuse what they must and name a fault, but they
were written one at a time and their messages were never held to a single
contract: `refs`'s three strings predate the `…; refused` grammar the later
checks converged on, the six fail-closed "could not verify …" lines have their
own shape and splice the raw git error into the client channel, nothing yet
names the pushing user though DIRECTION §3.6 L346 says the hook does, and no
test holds the *whole* matrix to "one message per refusal, naming what failed,
and nothing of the song," nor reads every refusal as *both* clients present it.
This task closes all of that: it makes every refusal — the five checks' faults
and the fail-closed cases — read as one line, `pre-receive: refs/heads/main:
<fault>; refused`, naming what failed (and the user, for the account-quota
fault), carrying no song text, and reaching the git CLI (`remote:` lines) and
isomorphic-git (side-band band 2) identically; and it pins the matrix with a
unit catalogue and an e2e-api both-clients test.

## Why it needs to be done

Workflow 14 (L92-93) promises a push that fails any check is "**refused whole,
naming what failed**," and DIRECTION §3.6 L341 that "**what the hook refuses
still reaches the client through git's own channel**" — the channel both
isomorphic-git (the app's Worker, §3.7 L418-420) and the git CLI read. The
predecessors landed sensible strings and deferred the cross-cutting guarantee
here, so until this task there is: no single enforcement that a message never
leaks a song's bytes (each check asserts its own, loosely); no guarantee the
matrix reads uniformly across the two clients; no coverage at all of the
`contents` refusals end-to-end; and DIRECTION §3.6 L346 ("names the user")
unmet. It is the last hook subtask, and the one that turns a pile of
independent strings into a contract.

## Inputs / context

Normative:

- **Workflow 14 §"What the service checks"**
  ([`docs/workflows/14-file-view.md`](../../../docs/workflows/14-file-view.md)
  L85-114), especially L92-93: a failing push is "refused whole, naming what
  failed, and its objects never reach the repository." No verbatim refusal copy
  is fixed by the workflow — it fixes the *behaviour* (whole refusal, named
  fault), which this task turns into the concrete grammar.
- **DIRECTION §3.6 "Git over HTTP"**
  ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) L318-354):
  - L338-341 — the service refuses before git "with a clear message"; "What the
    hook refuses still reaches the client through git's own channel" (the
    git protocol / side-band, not an HTTP error);
  - L342-346 — the hook inherits `ESTANTE_USER`/`ESTANTE_BOOK`/`ESTANTE_ROLE`
    and the account's remaining limits, "checks a push against the account's
    limits with no database connection of its own, and **names the user in its
    messages**";
  - L288-291 — "**The app and the service share no code**, only the HTTP API
    and the format": the app reads a hook refusal off git's own channel the way
    the git CLI does, never a private side protocol (bounds Decision 1).
- **DIRECTION §3.7** (L418-425) — the app's Web Worker owns git (isomorphic-git)
  and feeds the main thread by messages; a push outcome reaches the UI as a
  Worker message. How the app *renders* a refusal is sync/shell work, not this
  task (Decision 5).
- The **standing rule "no song text in logs"** (project rules; `canonical.md`
  L334-341 already fixed the per-condition wording and the "never the bytes"
  rule for the canonical layer) — generalised here to the whole matrix.

Seams this task extends:

- `service/cmd/pre-receive/main.go` `run()`/`refuse()` — the emission point
  (`main.go:30-130`).
- The five checks' reason producers in `service/internal/hook/` —
  `CheckStructure`/`Refs` (`refs.go`), the stowaway surplus reason
  (`stowaways.go`), the contents reasons (`contents.go:330-403`), `canonicalReason`/
  `blobReason`/`readmeReason` (`canonical.go:96-158`), `decideLimits`
  (`limits.go:79-97`).
- The e2e harness — `GitCli`, `IsoGit` (with `onMessage`), `demuxReceivePack`,
  `buildCraftedReceivePack` in `e2e/api/lib/git.js`; the per-check describes in
  `e2e/api/git.test.js` as precedent.

## Constraints / requirements

- **The hook is the guarantee, not the app; this task does not relax it.** No
  check accepts anything it refused before; the stop-at-first-failing-layer
  composition and the all-faults-within-a-layer reporting are unchanged. Only
  the *text* of a refusal, and the enforcement over it, change.
- **One grammar for every refusal:** `pre-receive: refs/heads/main: <fault>;
  refused`, one line per reason, LF-terminated, written to stderr (git adds the
  `remote:` prefix). The subject is `refs/heads/main` except the ref-name rule,
  which names the offending ref (`refs/tags/v1: …`) because the offending ref
  *is* what failed. The fail-closed cases share the shape: `pre-receive:
  refs/heads/main: could not verify <aspect>; refused`.
- **Every refusal names what failed and nothing of the song.** Allowed in a
  message: ref names, the file path the pusher chose, object SHAs, counts, byte
  figures, limit figures, line numbers, and the pusher's own user id. Never:
  blob bytes, a marker line's text, a commit message, the mismatching
  `README`/`.gitattributes` bytes, a `*MarkedTextError`'s `.Text`, or any other
  account's data. This is the matrix-wide invariant the unit catalogue asserts.
- **The account-quota refusal names the pushing user** (`ESTANTE_USER`),
  relayed only to the pusher (its own push), per DIRECTION §3.6 L346. Other
  faults stay subject-focused (Decision 4).
- **Fail-closed messages carry no raw git error.** A verification failure is a
  server fault of no use to the pusher and the git stderr could carry a path or
  id; the message names only the aspect and refuses (Decision 3).
- **Readable by both clients, over git's own channel.** The hook writes plain
  stderr — no side-band code of its own; git frames it. The contract is purely
  the text, and that it survives both the git CLI's `remote:` rendering and
  isomorphic-git's band-2 `onMessage`. Proven e2e both ways.
- **No central machine-readable reason protocol** between hook and app: the app
  reads the human-readable line off git's channel as the git CLI does
  (DIRECTION §3.6 L288-291, L341); the API contract is HTTP + the format, not
  hook stderr (Decision 1).
- Standing rules not in play, so the closer sees they were weighed:
  **offline-first** and **accessibility** are app concerns — the hook has no UI
  and no IndexedDB; **no book without an account** is enforced by the service
  before git is spawned (DIRECTION §3.6 L338-340), not by the hook; **canonical
  form over preserving content** is `hook.canonical`'s, unchanged here.

## Acceptance criteria

**Behavior delivered.** Every refusal the hook can produce — the `refs` faults
(wrong ref, deletion, non-fast-forward), the `stowaways` surplus, the
`contents` faults (disallowed path, bad mode, over-long component, over-size
blob, over-size carrier object, non-UTF-8, wrong `.gitattributes`), the
`canonical` faults (song/setlist not canonical, conflict marker, each README
text-rule) and the `limits` faults (per-book cap, per-account cap naming the
user), plus the six fail-closed "could not verify <aspect>" cases — is emitted
as one `pre-receive: refs/heads/main: <fault>; refused` line (the ref-name rule
names the offending ref), relayed on git's channel, naming what failed and
nothing of the song, and reaches the git CLI (as `remote:` lines) and
isomorphic-git (side-band band 2) identically.

**Tests, by level** (the note names unit and e2e-api):

- **unit** — `service/internal/hook/messages_test.go`: the refusal catalogue.
  A table drives every pure reason-producer across the five checks
  (`CheckStructure` for the three refs faults; the stowaway surplus reason for
  one-more and several; each extracted `contents` formatter; `blobReason`/
  `readmeReason` for each canonical and README fault; `decideLimits` for each
  cap) and asserts, per distinct reason: it matches the grammar
  (`refs/heads/main: … ; refused`, or the offending ref for the ref-name rule);
  it names its fault and subject (the expected substring); the account-quota
  reason names `ESTANTE_USER`; and — the cross-cutting assertion — a crafted
  song body, a conflict-marker line's text, and a mismatching `README`/
  `.gitattributes`'s bytes, fed through the producers, never appear in the
  emitted message. Pins workflow 14 L92-93 ("naming what failed") and DIRECTION
  §3.6 L346 (names the user).
- **unit** — `service/cmd/pre-receive/messages_test.go`: the emission contract.
  `refuse([...reasons])` writes exactly one `pre-receive: `-prefixed,
  LF-terminated line per reason and returns the non-zero exit; the fail-closed
  path emits `pre-receive: refs/heads/main: could not verify <aspect>; refused`
  for each of the five aspects (and the stdin parse error) with no raw git
  error spliced in. Pins DIRECTION §3.6 L341 (the refusal reaches the client on
  git's own channel) and the "name only what failed" rule for fail-closed.
- **e2e-api** — `e2e/api/messages.test.js`: the whole refusal matrix against the
  compose stack. For each refusal a well-behaved client can trigger — refs
  non-fast-forward; a disallowed path, a symlink, an over-size file, a
  non-UTF-8 file, a wrong `.gitattributes`; a non-canonical song, a
  conflict-marker file, a README text-rule break; an over-book-cap and an
  over-account-quota push — the test pushes once with the **git CLI** (`GitCli`,
  reading the reason off `error.stderr`'s `remote:` lines) and once with
  **isomorphic-git** (`IsoGit.push({onMessage})` / `demuxReceivePack` band 2,
  with `ng refs/heads/main` on band 1), asserting the same fault phrase on both
  channels and that no song text appears in either; the stowaway surplus (only
  a crafted pack can carry it) is driven by the raw framed POST +
  `buildCraftedReceivePack`/`demuxReceivePack`, as `hook.stowaways` established.
  Sessions via the passkey ceremony, books via the API, purpose-written songs
  only — never copyrighted words. Pins workflow 14 §"What the service checks"
  (L85-114) and DIRECTION §3.6 L341. This is also the first e2e coverage of the
  `contents` refusals (hook.contents landed behavior-only).

All three run in `scripts/gate` (Go unit + the e2e-api harness against the
compose stack); the closer confirms each named file ran, not skipped.

## Decisions

- **No central `Reason` type; a shared grammar helper over per-check pure
  formatters.** This task adds `refusal(subject, fault string)` in
  `service/internal/hook/messages.go` and routes every check's reason through
  it (generalising `canonical.go`'s existing `canonicalReason`), rather than a
  `Reason{Code, Args}` value emitted as structured text. *Why:* reasons are
  templated from runtime data (paths, counts, byte figures), so a registry of
  literal messages does not fit; the contract that matters is a consistent,
  human-readable grammar read by three clients, not a code; the helper has
  exactly the call sites that already exist (the simpler abstraction).
  *Alternative rejected:* a structured, parseable reason code for the app —
  DIRECTION §3.6 L288-291/L341 say the app reads the hook's refusal off git's
  own channel the way the git CLI does; a private hook→app protocol would be a
  new contract outside the API/format boundary the two components share, and
  nothing in the design asks the app to machine-parse a refusal.
- **One grammar: `pre-receive: refs/heads/main: <fault>; refused`.** *Why:* four
  of the five checks already converge on `refs/heads/main: <fault>; refused`;
  this aligns `refs`'s three (which predate it) and the six fail-closed lines so
  the matrix reads uniformly across clients — the task's whole purpose and the
  predecessors' explicit hand-off (`refs.md` Decision L264-270). *Alternative
  rejected:* leave each check's wording independent — defeats the contract.
- **Fail-closed messages drop the raw git error.** The client message names only
  the aspect ("could not verify canonical form") and refuses. *Why:* a
  verification failure is a server-side fault of no use to the pusher, and the
  raw git stderr (`%v`, currently spliced at `main.go:44` etc.) could carry a
  path or object id into the client channel. *Alternative rejected:* keep `%v`
  — a content-leak surface and noise, against "name only what failed." (The hook
  has no separate operator-log channel by design — its stderr *is* the client
  channel — so richer server-side diagnostics are not in scope and not newly
  lost here.)
- **Only the account-quota refusal names the user.** *Why:* DIRECTION §3.6 L346
  ("names the user in its messages") lands minimally on the one fault that is
  the user's — their account quota — relayed only to the pusher.
  *Alternatives rejected:* name the user in every message (noise; the user id is
  opaque and irrelevant to a path or canonical fault) / name the user in none
  (ignores L346).
- **The app's UI surfacing of a refusal is out of scope.** This task guarantees
  the message is present and readable on git's channel *by isomorphic-git* (what
  the app's Worker uses) — its e2e proves exactly that. How the app renders a
  refused push to the user (a sync-error surface) is governed by workflow 8 and
  DIRECTION §3.7 L421-425 and belongs to the sync/shell stream, not the hook.
  This is not a deferral of any test this task owes — the hook's tests are the
  hook's, and a future app-surfacing task carries its own when that screen is
  designed; it is simply a different component's work, not invented or deferred
  here.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-08.

- `service/internal/hook/messages.go` (new): `refusal(subject, fault string)` helper — the single home for the `refs/heads/main: <fault>; refused` grammar — and exported `FailClosed(aspect string)` for the six fail-closed cases.
- `service/internal/hook/refs.go`: three reason strings aligned to the shared `refusal(...)` grammar (were `…: refused` variants without the `refs/heads/main:` subject prefix).
- `service/internal/hook/canonical.go`: `canonicalReason` re-routed to `refusal(...)`, `fmt` import dropped.
- `service/internal/hook/contents.go`: seven inline `fmt.Sprintf` reason strings lifted into named pure formatters (`reasonDisallowedPath`, `reasonBadMode`, etc.) each calling `refusal(...)`.
- `service/internal/hook/limits.go`: reads `ESTANTE_USER` from the environment; account-quota reason names the pushing user per DIRECTION §3.6 L346.
- `service/internal/hook/limits_test.go`: `decideLimits` call sites updated to match the new signature.
- `service/internal/hook/messages_test.go` (new): unit catalogue — grammar check, fault substring, account-quota names user, no-song-text invariant for every reason producer.
- `service/cmd/pre-receive/main.go`: six fail-closed lines routed through `hook.FailClosed(aspect)` via an injectable `refuseTo(w, …)` sink; raw git error dropped from the client channel.
- `service/cmd/pre-receive/messages_test.go` (new): emission contract — one `pre-receive:`-prefixed LF line per reason, non-zero exit, six fail-closed aspects, no raw error.
- `e2e/api/lib/git.js`: additive `force` option on `IsoGit.push` (needed for non-ff iso pushes in the matrix).
- `e2e/api/messages.test.js` (new): 12-case e2e-api refusal matrix — every refusal driven on both git CLI and isomorphic-git, same fault phrase both channels, no song text; stowaway via crafted pack.

# home_book — Validate a home-book push

## TaskJuggler

[`tasks/35-hook.tji`](../../35-hook.tji) → `task hook` → `task home_book`.

## Effort

2d (as estimated in the `.tji`).

## Repository

estante-de-cifras only. The home book is the app's own personal-state
format, owned here, not a cifra.md format — "nothing in the cifra.md
repository defines or reads them" (`docs/home-book-format.md:13-14`). The
work lands in:

- `service/internal/hook/` — the new home-book validator (a pure
  `package hook` function) and its unit tests.
- `service/cmd/pre-receive/main.go` — the dispatch branch that reads the
  repository kind and runs the home-book validator in place of the songbook
  `Contents`/`Canonical` checks.
- `service/internal/server/git.go` and `service/internal/db/migrations/` —
  the service recognising a book's kind and forwarding it to the hook
  through `ESTANTE_*`.
- `e2e/api/` — the isomorphic-git home-book journey against the compose
  stack.

## Inherited dependencies

Settled (all `complete 100`):

- **`design.home_book_format`** — the format document
  [`docs/home-book-format.md`](../../../docs/home-book-format.md) that this
  task validates against; its §8 is normative here. Its Decision "The home
  book collides with the songbook rule" named this task and its shape:
  recognise the home book as its own repository kind in the registry,
  forward that kind through the `ESTANTE_*` env, and have the hook validate
  settings instead of songs — never sniff a repo's contents.
- **`hook.contents`** — the songbook "what a book may hold" layer this task
  branches away from, and the seam-donor for the git readers
  (`introducedCommits`, `lsTree`, `catFileBlob`), the path classifier
  (`classifyPath`), the 256 KB per-file cap, the mode/UTF-8 helpers and the
  `.gitattributes` byte comparison.
- **`hook.canonical`** — the songbook canonical-form layer, and the model
  for a per-blob canonical check that writes-back-and-compares, for the
  marker-line refusal, and for injecting a form-checker so the pure unit
  tests need no git.

Via the parent `task hook`: **`service.git_http`** (the service runs
`git receive-pack` with `ESTANTE_*` set and the hook installed) and
**`foundation.e2e_api`** (the `e2e/api/` harness). Both complete.

## What this task is

The home book moves over the same git-over-HTTP as any book, but it is a
**settings repository, not a songbook** (`docs/home-book-format.md:28-31`;
DIRECTION §2.1). Its files are JSON, so the songbook pre-receive checks
(`hook.contents`: only `*.cifra.md`/`*.setlist.md`/`README.md`/
`.gitattributes`; `hook.canonical`: every song canonical) would refuse a
perfectly valid home-book push. This task stands up two things:

1. **The service recognises a book's kind** — songbook or home book — from
   the registry (not from the repo's contents) and **forwards it to the
   pre-receive hook** through the `ESTANTE_*` environment it already passes
   on a push.
2. **The hook branches on that kind.** For a home book it bypasses the
   songbook `Contents`/`Canonical` checks and instead enforces
   `docs/home-book-format.md §8`: only the seven root files of §2.1, no
   songs or setlists, every settings file well-formed JSON in the canonical
   form of §3/§5/§6, `README.md`/`.gitattributes` the exact bytes of §2.2,
   the 256 KB per-file cap. The ref/history, no-stowaway and limit guards
   still apply to a home book as to any repository, and no settings content
   is ever logged.

## Why it needs to be done

`storage.home_book` makes the app write and merge the home book and push it
to the service; `account.sign_in`/`account.new_device` give the home book a
remote and sync it across a person's devices. Without this task every such
push is refused by the songbook hook — the home book could never go online.
The design refinement deferred exactly this enforcement to `hook.home_book`
and wired it into **M3 ("Estante online", `tasks/99-milestones.tji:30-33`)**,
whose promise is "sign in … sync across one person's devices". It is the
validator half of the `docs/home-book-format.md` conformance pair
(`§9`): `storage.home_book` is the writer/merger and pins §3/§5/§6;
`hook.home_book` is the validator and pins §8.

## Inputs / context

### Normative

- **`docs/home-book-format.md §8` (lines 472-500)** — "Allowed kinds and
  validation": the whitelist the validator enforces, what a push is refused
  for, that the ref/fast-forward/no-stowaway/limit guards still apply, and
  "The service recognises the account's home book as its own repository kind
  and forwards that kind to the hook through the `ESTANTE_*` environment it
  already passes (`service.git_http`); the hook is not left to guess a
  repository's kind from its contents."
- **`docs/home-book-format.md`** — §1 (lines 16-53: a settings repository,
  not a songbook; the three actors incl. the **validator**), §2.1 (76-98:
  the seven root files, regular/UTF-8/LF only), §2.2 (99-127: the exact
  `README.md` and `.gitattributes` bytes), §3 (153-182: the register
  envelope — an object is a register iff its keys are exactly `value` and
  `at` with `at` a well-formed instant; a register's `value` is never
  walked), §5.2 (354-359: register/map mismatch under one key is malformed),
  §6 (380-444: canonical form — unique, a fixed point checked by writing
  back and comparing; §6.1 sorts every object's members at every depth incl.
  opaque values; §6.2 numbers/strings; §6.3 the bytes), §9 (502-519:
  conformance — "A **validator** MUST enforce §8 and MUST log no file
  content").
- **DIRECTION** §2.1 (`docs/DIRECTION.md:57-72`: the "and nothing else" rule
  is a songbook's; the home book's allowed kinds are its own), §3.2
  (136-151: personal state lives in a home book, a settings repository),
  §3.3 (153-198: the one server, `noindex`, no anonymous read, the
  pre-receive hook checks every push; logs request metadata only), §3.6
  (374-404: components and repositories; the hook is `service/cmd/pre-receive`,
  links cifra.md for Go, holds no DB connection).
- **Workflow 8** (`docs/workflows/08-sync.md:71-76`) — "The home book": its
  files are JSON, merge key by key, the later change winning; it never
  reaches a conflict (workflow 9).

### Seams this task extends

- **Dispatch** — `service/cmd/pre-receive/main.go` `run()` composes the
  layers sequentially (`Refs` → `Stowaways` → `Contents` → `Canonical` →
  `Limits`); each layer is `Func(updates []RefUpdate, repoDir string)
  (reasons []string, err error)` and a non-empty `reasons` or any `err`
  refuses the whole push, fail-closed. The home-book branch goes here,
  between `Stowaways` and `Limits`, selected by the repository-kind env.
- **Hook env** — `service/internal/server/git.go` `pushEnv` (line 349)
  builds `ESTANTE_USER`/`ESTANTE_BOOK`/`ESTANTE_ROLE`/
  `ESTANTE_ACCOUNT_BYTES_REMAINING`/`ESTANTE_BOOK_BYTES`;
  `handleGitReceivePack` (line 137) calls it. Only `hook.limits`
  (`service/internal/hook/limits.go`) reads env today, via `os.LookupEnv`.
  A new `ESTANTE_BOOK_KIND` is added here.
- **Registry** — `service/internal/db/migrations/0001_registry.sql` `books`
  table (lines 83-92) has no `kind` column; `bookAccess`/`resolveBookAccess`
  in `service/internal/server/books.go` carry owner, role and `size_bytes`.
  A migration adds the column; `resolveBookAccess` reads it;
  `handleGitReceivePack` passes it to `pushEnv`.
- **Git readers / classifier** — `service/internal/hook/contents.go`:
  `introducedCommits` (:481), `lsTree` (:504), `introducedObjects` (:516),
  `catFileBlob` (:545), `classifyPath` (:132), `modeAllowed`/`modeDescription`
  (:161/:167), `withinSizeLimit`/`maxBlobBytes` (:183/:53), `validUTF8`
  (:210), `expectedGitattributes`/`gitattributesMatch` (:74/:216),
  `acceptedMainHead` (`stowaways.go:192`). The home-book check reuses these.
- **Canonical model** — `service/internal/hook/canonical.go`:
  `readmeReason` (:142, the six §6.3-style text rules) and the marker-line
  helpers (`conflictMarkers`/`isMarkerLine`/`hasMarkerLine`, :60/:65/:78);
  the injected-form-checker pattern (`canonical(... songForm, setlistForm)`)
  that keeps the unit tests git-free.
- **Refusal grammar** — `service/internal/hook/messages.go`: `refusal(subject,
  fault)` → `"<subject>: <fault>; refused"` (:32) and `FailClosed(aspect)`
  (:44). `main.go` `refuse`/`refuseTo` (:124-136) write one `remote:` line
  per reason. Every home-book refusal routes through these and names only
  the path/aspect, never a settings value.

### Tests

- **unit** — `service/internal/hook/<check>_test.go` (pure, no git/DB).
- **behavior** — `service/cmd/pre-receive/<check>_test.go` (the real built
  binary in a bare repo, driven by the host `git` CLI; helpers
  `buildHook`/`gitEnv`/`gitEnvLimits`/`newBook`/`writeSong`/`writeAt`/
  `assertRefused` in `refs_test.go`/`contents_test.go`), and
  `service/internal/server/git_test.go` (Go httptest against real git +
  Postgres from compose, the model for `TestReceivePackGuards`).
- **e2e-api** — `e2e/api/*.test.js` (Vitest/ESM against the compose stack):
  `GitCli`/`IsoGit` in `e2e/api/lib/git.js` (`IsoGit.push({url, cookie, ref,
  onMessage})` surfaces the relayed refusal), `registerNewAccount` +
  `Authenticator` + `createBook` + `connect` (direct Postgres) in
  `e2e/api/git.test.js`.

## Constraints / requirements

- **The kind comes from the registry, never from contents.** The hook must
  not inspect the tree to decide whether a repo is a home book — that is
  "fragile and spoofable" (design Decision). It reads the kind the service
  forwarded. If the kind env is absent or unrecognised, the hook treats the
  repository as a **songbook** (the stricter path): a home book is validated
  as settings only when the service explicitly says so, so a misconfigured
  push fails closed rather than letting JSON through.
- **Branch, don't duplicate.** The ref/history guard (`Refs`), the
  no-stowaway guard (`Stowaways`) and the limit guard (`Limits`) run for a
  home book exactly as for a songbook. Only the middle — "what a book may
  hold" and "canonical form" — is replaced. The home-book validator checks
  every blob reachable from the new commit(s), not only the tip (§8), using
  the same `introducedCommits`/`lsTree`/`catFileBlob` readers.
- **§8 whitelist, exactly.** A home-book push is refused whole if it carries:
  any path other than the seven root files of §2.1; any folder, symlink,
  submodule, non-regular or executable file; a `*.cifra.md`/`*.setlist.md`;
  a settings file that is not well-formed JSON in canonical form (§6) or that
  breaks the §3 envelope; a `README.md`/`.gitattributes` that is not the
  exact §2.2 bytes; a file over 256 KB.
- **Canonical JSON is estante's own, in Go, checked not shared.** The
  home-book canonical form (§6) is implemented fresh in Go for the hook; it
  is **not** cifra.md (the home book is not a cifra.md format) and shares no
  code with the app's JS writer in `storage.home_book`. Both implement §6
  against the document and agree because they are checked, never because code
  crosses the boundary (DIRECTION §3.6). The check is write-back-and-compare:
  parse the blob as JSON, re-emit in canonical form (sort every object's
  members at every depth, §6.2 scalars, NFC, §6.3 bytes), and refuse if a
  byte differs — the fixed-point test of §6.
- **Two distinct walks over the JSON.** Canonicalisation recurses into
  everything, including an opaque register `value`, to sort its keys (§6.1).
  The **envelope** validation (§3) does the opposite: an object whose keys
  are exactly `value` and `at` with a well-formed `at` is a register and its
  `value` is **not** walked (an opaque value may legitimately contain
  `value`/`at` keys, §3 lines 174-176); every other object is a map and is
  recursed. The validator refuses a register missing `value` or `at`, a
  malformed `at`, or an object that is neither (§3, §5.2).
- **No song text, no settings content in logs** (DIRECTION §3.3;
  `docs/home-book-format.md:49`, §8 line 494, §9 line 513). A refusal names
  the offending path and the aspect that failed ("not canonical", "not an
  allowed path", "not a well-formed register") — never a settings value, a
  label, a link, a song ref, or the mismatching bytes. Every message routes
  through `hook.messages` `refusal(...)`.
- **The service and the hook share no code with the app** beyond the API
  contract and the format (DIRECTION §3.6). The hook holds no DB connection;
  the kind reaches it only through the env the service set.
- **Fail-closed throughout** (the hook's standing rule): any git error, a
  broken env contract or an unverifiable condition is a refusal via
  `FailClosed(aspect)`, never a silent accept and never the raw git error.
- **One ESTANTE_ var, matching the existing shape.** The kind is forwarded
  as `ESTANTE_BOOK_KIND` with values `songbook` (the default the migration
  gives every existing row) and `home`, read via `os.LookupEnv` as
  `hook.limits` reads its byte figures.

## Acceptance criteria

### Behavior delivered

- The `books` registry carries a `kind` (`songbook` default, `home`), the
  service forwards it as `ESTANTE_BOOK_KIND` on every push, and the hook
  dispatch runs the home-book validator in place of `Contents`/`Canonical`
  when the kind is `home`.
- A valid home-book push — the seven root files, canonical JSON, the exact
  `README.md`/`.gitattributes` — is accepted.
- A home-book push is refused, whole and named, for: a `*.cifra.md` or
  `*.setlist.md`; any other disallowed path, a folder, a symlink, a
  non-regular/executable file; a non-canonical settings file; a settings
  file that breaks the §3 envelope; a wrong `README.md`/`.gitattributes`; a
  file over 256 KB.
- A songbook push is unaffected: a `*.json` settings file pushed to a
  songbook is still refused by `hook.contents` (the branch is home-book
  only).
- The ref, no-stowaway and limit guards still apply to a home book; no
  settings content appears in any log line.

### Tests, by level

- **unit** — `service/internal/hook/home_book_test.go`: the pure home-book
  validator over synthetic trees (git-free, via the injected-form-checker
  pattern of `canonical.go`) — a well-formed canonical settings file
  accepted; a `*.cifra.md`/`*.setlist.md` refused; a non-canonical settings
  file refused (keys out of order, wrong scalar form, CRLF, a BOM, no
  trailing newline — each a distinct case); a file that breaks the §3
  envelope refused (an object neither register nor map, a register missing
  `value`/`at`, a malformed `at`); a register with an opaque `value`
  containing `value`/`at` keys accepted (envelope not walked into `value`,
  §3); a wrong `README.md`/`.gitattributes` refused and the exact §2.2 bytes
  accepted; a file over 256 KB refused. Pins `docs/home-book-format.md §8,
  §2.1, §2.2, §3, §6`. Also a refusal-message unit case: each refusal routes
  through `refusal(...)` and names the path/aspect only, no settings value
  (§8 line 494, DIRECTION §3.3).
- **behavior** — `service/cmd/pre-receive/home_book_test.go`: the real hook
  binary in a bare repo, driven by the git CLI with `gitEnvLimits` extended
  to set `ESTANTE_BOOK_KIND=home` — a canonical home-book push accepted; a
  song pushed to a home book refused; a non-canonical settings file refused;
  with `ESTANTE_BOOK_KIND` unset/`songbook`, a settings `*.json` refused by
  the songbook path (the branch is kind-gated). Pins the dispatch decision
  (§8, DIRECTION §2.1). And `service/internal/server/git_test.go` (Go
  httptest against real git + Postgres from compose): the service reads a
  book's `kind` and sets `ESTANTE_BOOK_KIND` on `receive-pack` — a
  `kind='home'` book accepts a canonical home-book push and refuses a song;
  a `kind='songbook'` book refuses a settings file. Pins the service→hook
  forwarding (§8 lines 496-500, the `TestReceivePackGuards` model).
- **e2e-api** — `e2e/api/git.test.js` (a new `describe('hook: home book')`,
  mirroring `hook: canonical`/`hook: limits`): `registerNewAccount` →
  `createBook` → `connect()` sets that book's `kind='home'` in Postgres
  (as the limits e2e sets `size_bytes`) → `IsoGit.push({... onMessage})`
  pushes a canonical home book through the compose stack and it is accepted;
  pushing a `*.cifra.md` to the home book is refused and the relayed
  `remote:` refusal read off the side-band names the path. One disallowed
  songbook case already covered by `messages.test.js` stays there. Pins §8
  end-to-end through the real stack and isomorphic-git (the app's own
  client), harness `foundation.e2e_api`.

All three levels are driveable today: the unit and binary-behavior tests
need only this task's own validator and env; the httptest and e2e-api tests
seed a `kind='home'` registry row directly (the column this task adds) and
mint a session via the existing `registerNewAccount`/`Authenticator`
helpers — no home-book provisioning flow is required to drive them.

## Decisions

- **Recognise the kind in the registry; forward it as `ESTANTE_BOOK_KIND`.**
  *Why:* the design refinement settled it (Decision "The home book collides
  with the songbook rule") and §8 states it; the hook already takes its
  whole world from `ESTANTE_*` and holds no DB connection, so a new env var
  read via `os.LookupEnv` (as `hook.limits` reads its figures) is the
  established seam. A `kind` column on `books` (default `songbook`) is the
  smallest registry change and leaves every existing row a songbook.
  *Alternative rejected:* the hook sniffing the tree to guess the kind —
  fragile and spoofable (a crafted songbook could pose as a home book, or a
  home book be mis-read), explicitly rejected in the design.
- **A dispatch branch in `run()`, not a new top-level check that
  self-skips.** *Why:* the home-book validator *replaces* `Contents` and
  `Canonical` rather than adding to them; a single branch keyed on the kind
  keeps the composition legible — `Refs` → `Stowaways` → (`Contents` →
  `Canonical` | `HomeBook`) → `Limits` — and keeps the shared guards
  unconditional. *Alternative rejected:* making `Contents`/`Canonical`
  themselves kind-aware and no-op for a home book — scatters the kind across
  three checks and risks a songbook rule silently going quiet.
- **Unknown/absent kind ⇒ songbook (fail-closed).** *Why:* settings JSON is
  accepted only when the service explicitly says "home"; a dropped or
  mis-set env then refuses the JSON under the songbook rules rather than
  letting it through unvalidated, matching the hook's fail-closed stance.
  *Alternative rejected:* defaulting to home on an unknown kind — would let a
  songbook be pushed JSON if the env were ever lost.
- **Canonical JSON implemented fresh in Go, checked against the document.**
  *Why:* the home book is the app's format, not cifra.md (so no cifra.md
  reuse), and the app↔service boundary shares no code (DIRECTION §3.6); both
  the JS writer and this Go validator implement §6 and agree because the
  corpus of fixtures and the format document hold them to the same bytes.
  The write-back-and-compare check is exactly the §6 fixed-point definition,
  so the validator needs no schema knowledge beyond the §3 envelope.
  *Alternative rejected:* sharing a canonicaliser across the app and the
  hook — forbidden by the no-shared-code rule, and the two run in different
  languages anyway.
- **The envelope walk stops at registers; canonicalisation does not.**
  *Why:* §3 forbids walking a register's `value` (an opaque value may hold
  `value`/`at` keys), but §6.1 canonicalises opaque values too; two walks
  keep each rule exact. *Alternative rejected:* one walk — would either
  mis-classify an opaque object as a register or fail to canonicalise it.
- **256 KB per-file cap reused; no separate home-book size rule.** *Why:*
  §8 says "the 256 KB of workflow 14 applies; a home book is far smaller",
  so the existing `maxBlobBytes` constant and `withinSizeLimit` helper carry
  over unchanged; whole-book and account quotas stay with `hook.limits`.
- **No design delta.** *Why:* DIRECTION §2.1/§3.2 already carve the home book
  out of the songbook rule, and `docs/home-book-format.md §8` already fixes
  the validation; the `kind` column and the env var name are implementation
  seams, not designed behaviour, so nothing in the constitution needs
  amending.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-08.

- `service/internal/db/migrations/0003_book_kind.sql` (new): `books.kind` column, default `songbook`, CHECK constraint `{songbook, home}`.
- `service/internal/server/books.go`: `bookAccess.kind` field; `resolveBookAccess` reads it from the `books` table.
- `service/internal/server/git.go`: `pushEnv` forwards `ESTANTE_BOOK_KIND`; `git_test.go` adds `TestReceivePackKindForwarding` and `TestPushEnv` updates.
- `service/internal/hook/home_book.go` (new): `IsHomeBook`, `HomeBook` validator — §8 whitelist, §3 envelope walk stopping at registers, §6 fresh-in-Go canonical write-back-and-compare, §2.2 exact bytes, 256 KB cap; all refusals via `refusal(...)`, no settings content logged.
- `service/cmd/pre-receive/main.go`: kind-gated dispatch — `ESTANTE_BOOK_KIND=home` runs `HomeBook`; absent/unknown kind ⇒ songbook (fail-closed).
- Unit tests: `service/internal/hook/home_book_test.go` (classify, canonical accept/reject, envelope, §2.2 bytes, 256 KB cap, no-leak, fixed-point, kind gate) + 7 catalogue rows in `messages_test.go`.
- Behavior tests: `service/cmd/pre-receive/home_book_test.go` (real binary, `ESTANTE_BOOK_KIND=home`, accept/song/non-canonical/oversize/kind-gated) + `service/internal/server/git_test.go` `TestReceivePackKindForwarding` (real hook, Postgres; home accepts settings/refuses song, songbook refuses settings).
- e2e-api: `e2e/api/git.test.js` new `describe('hook: home book (hook.home_book)')` — isomorphic-git through the compose stack, `kind='home'` via `connect()`, canonical home book accepted, song refused with path on git's channel.

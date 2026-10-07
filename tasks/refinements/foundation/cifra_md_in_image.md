# foundation.cifra_md_in_image — Package cifra.md/js and cifra.md/go into the service image

## TaskJuggler entry

[`tasks/25-foundation.tji`](../../25-foundation.tji) lines 79–84:

> task cifra_md_in_image "Package cifra.md/js and cifra.md/go into the service image" {
>   effort 1d
>   allocate team
>   depends !compose
>   note "Formalize and document the cross-repo build-context approach introduced by storage.working_copy (tasks/refinements/storage/working_copy.md): the `cifra-md` named build context in compose.yaml + WORKDIR /build/app in Dockerfile lets `npm ci` and vite resolve the sibling-repo JS package inside Docker. Extend the same pattern symmetrically for cifra.md/go when the Go service stage begins importing the Go format package (hook and service tasks in m3_service). Source: storage.working_copy fixer (Dockerfile, compose.yaml). Tests: none of its own — proven by the stack building and the e2e-api smoke tests passing."

## Effort estimate

**1 day** (from the `.tji`).

## Repository

**estante-de-cifras** only — `Dockerfile`, `compose.yaml`, `.dockerignore` and
`docs/DIRECTION.md` at the repository root (absolute:
`/home/ruoso/devel/estante-de-cifras`). The note does **not** begin with
`cifra.md:`, so nothing lands in the sibling cifra.md repository; this task
only changes how the Docker build *reaches into* that checkout. A **design
delta** is authored in `docs/DIRECTION.md` §3.6 (see Decisions).

## Inherited dependencies

- **`foundation.compose`** — settled, Done 2026-10-05
  ([`tasks/refinements/foundation/compose.md`](compose.md)). Authored the root
  `compose.yaml`, multi-stage `Dockerfile` and `.dockerignore`: the single
  build with `context: .` spanning `app/` and `service/`, the Go
  `golang:1.25-alpine` stage, and the final Alpine image with git beside the
  binary. It deliberately **does not build `service/cmd/pre-receive`** (no
  `main.go` yet; `go build ./cmd/pre-receive` would fail the image build), and
  `.dockerignore` excludes `service/cmd/pre-receive` — compose.md assigned
  that Dockerfile change to the hook area when the binary exists. This task
  inherits that boundary.
- **`storage.working_copy`** — settled, Done 2026-10-05 (the `.tji` `Source:`;
  [`tasks/refinements/storage/working_copy.md`](../storage/working_copy.md)).
  As its fixer it introduced the JavaScript cross-repo build context —
  `cifra-md` named context in `compose.yaml`, `WORKDIR /build/app` and the
  `file:../../cifra.md/js` dependency — to make `npm ci` and vite resolve the
  sibling package inside Docker. working_copy.md records this only as a
  **Status note** (its line 486), never as an argued Decision: the mechanism
  exists but was never formalized. That is the debt this task pays.

## What this task is

The app already bundles **cifra.md for JavaScript**, and the Docker build
already reaches the sibling checkout for it — but only as an incidental repair
`storage.working_copy` made to unblock its own tests, documented in inline
comments and a Status note, never as a deliberate, named pattern. This task
**formalizes** that cross-repo build-context approach: it elevates it to a
documented architectural seam (a `docs/DIRECTION.md` §3.6 delta), names it in
the `Dockerfile`/`compose.yaml` comments, and records the recipe so the
**symmetric Go extension lands mechanically** when the first task links
cifra.md for Go into the image. It changes no behaviour: the stack builds
exactly as before, proven by the existing e2e-api smoke tests.

The Go half of the title (`…and cifra.md/go…`) is a *forward* promise, not
work this task can do now: cifra.md/go does not yet exist (it is created by
`cifra_go.module`), nothing in the Go stage imports it, and the hook binary
that will link it is not even built into the image yet. This task documents
the pattern the Go wiring will follow and assigns that wiring to its real home
(see Decisions and Acceptance criteria).

## Why it needs to be done

- **The pattern is load-bearing but undocumented.** Every future rebuild of
  the image — and every developer and CI run of `scripts/gate` — depends on
  the `cifra-md` named context resolving the sibling package. A mechanism this
  central (two repositories combining into one image) belongs in the
  constitution, not in a Status note of an unrelated storage task, so the next
  person who touches the build understands *why* `WORKDIR` is two levels deep
  and the context is named.
- **The Go side needs a recipe before it has a consumer.** `hook.canonical`
  (m3_service) is the first task to link cifra.md for Go into the image. It
  depends on `cifra_go.writer`, `cifra_go.setlists` and `cifra_go.versions`
  and must make its Go build resolve the sibling Go package — the symmetric
  problem the JS context already solved. A documented pattern lets that task
  mirror it in one obvious change instead of re-discovering the mechanism.
- **Downstream:** `foundation.cifra_md_in_image` is a direct dependency of
  milestone **m3_service** ([`tasks/99-milestones.tji`](../../99-milestones.tji)
  line 32) — the "Estante online" milestone where the hook, sign-in, books and
  git-over-HTTP come together and the image is first built to hold them all.

## Inputs / context

### Governing direction / design

- `docs/DIRECTION.md` §3.6 "Components, and what each is written in"
  (lines 277–316): the component/repository table — **the app** (`app/`,
  bundles cifra.md for JavaScript, line 281–282), **the hook**
  (`service/cmd/pre-receive`, line 284), **cifra.md for Go** (cifra.md repo
  `go/`, "The hook's; also a git merge driver", line 285) — and
  "**The app and the service share no code**, only the HTTP API and the
  format" (line 288), "**Implementations agree because they are checked, not
  … shared**" (line 293), "One binary, with git beside it in the image"
  (line 315).
- `docs/DIRECTION.md` §3.6 "Repositories" (lines 373–392): the two-repo layout
  diagram and "Locally, everything runs as in production" — **the design delta
  lands here** (the new paragraph is inserted before line 386).

### Code seams

- `Dockerfile` (root):
  - Stage 1 "app" (lines 14–36): `WORKDIR /build/app` (line 24, with the
    comment explaining the depth-≥2 requirement for the `file:` path to
    round-trip under `npm ci`, lines 15–23); `COPY --from=cifra-md
    package.json /cifra.md/js/package.json` and `COPY --from=cifra-md src
    /cifra.md/js/src` (lines 29–30) — the JS named context copied in at the
    `file:` target; then `npm ci` and `npm run build` (lines 34, 36).
  - Stage 2 "service" (lines 38–50): `golang:1.25-alpine`, `go mod download`
    then `go build … ./cmd/service`; the comment at lines 48–49 — only
    `cmd/service` is built, `cmd/pre-receive` has no `main.go` yet and "the
    hook area adds it to this Dockerfile when it does." **This is the stage the
    Go context will attach to.**
  - Stage 3 final (lines 52–69): Alpine, git, the binary, the built app.
- `compose.yaml` `service.build.additional_contexts` (lines 61–67): the
  `cifra-md` named context, `cifra-md: ${ESTANTE_CIFRA_MD_DIR:-../cifra.md}/js`
  — defaulting to the sibling checkout, overridable with `ESTANTE_CIFRA_MD_DIR`.
- `.dockerignore`: the root build context is trimmed to `app/` and `service/`
  sources; `docs`, `api`, `e2e`, `tasks` etc. are excluded, and
  `service/cmd/pre-receive` is excluded explicitly (last line). The cifra.md
  checkout is a *sibling directory*, entirely outside the root context —
  **which is exactly why a named build context, not a plain `COPY`, is
  required** to reach it.
- `app/package.json` line 23: `"cifra-md": "file:../../cifra.md/js"` (mirrored
  in `app/package-lock.json` line 17) — the literal two-segment path npm
  records, the reason `WORKDIR` sits at `/build/app`.
- `scripts/gate`: `stack_up()` (around lines 245–280) brings the stack up with
  `docker compose … up --build --detach --wait --wait-timeout 300` under a
  per-run project name and free ports — **this is the build this task must keep
  green**. The gate already has a dormant branch for the Go package it will
  run once it exists: `if [[ -f "$CIFRA_MD_DIR/go/go.mod" ]]` →
  `go_checks "cifra.md go"` (lines 416–420), skipped today.

### Timing of the Go package (why the Go half is forward-looking)

- `cifra.md/go` **does not exist yet**: the cifra.md checkout has `js/`,
  `reference/`, `corpus/`, `spec/`, `schema/`, `examples/` — no `go/`. It is
  created by **`cifra_go.module`** ([`tasks/15-cifra-go.tji`]), gated behind
  `format.canonical_form`. No refinement names its module path.
- The **first consumer in the image** is **`hook.canonical`**
  ([`tasks/35-hook.tji`], m3_service via `hook.messages`): `depends !contents,
  cifra_go.writer, cifra_go.setlists, cifra_go.versions`. The service proper
  (`tasks/30-service.tji`) never imports the Go format package — the format
  logic lives in the hook.

### The executable proof ("proven by … the e2e-api smoke tests passing")

- `e2e/api/health.test.js` (`foundation.e2e_api`, Done 2026-10-05): `GET
  /healthz` at `ESTANTE_E2E_BASE_URL` → `200`, body `ok`. This passes only if
  the stack — hence the image, hence the `cifra-md` build context — built and
  came up healthy under `docker compose up --build --wait`. `mail.test.js` and
  `git.test.js` round out the smoke surface.

## Constraints / requirements

- **No behaviour change; the gate stays green.** The image must build and the
  e2e-api smoke tests must still pass byte-for-identical in result. Comment and
  documentation edits must not alter any `COPY`, `RUN`, `WORKDIR` or context
  wiring the build depends on.
- **Do not add a dangling Go context now.** cifra.md/go does not exist; wiring
  a `cifra-md-go` context to `../cifra.md/go` (or a Go-stage `COPY --from`)
  today would make `docker compose up --build` fail on an unresolvable context
  path and nothing would consume it — breaking the stack the task must keep
  building. The Go wiring lands with its first consumer (see Decisions).
- **Implementations agree because they are checked, not shared** (DIRECTION
  §3.6 line 293). The build-context mechanism carries *source* from the sibling
  checkout into the image build so each language's own toolchain
  (`npm`/vite, `go build`) compiles it; it never transpiles, vendors, or copies
  code between languages. The documentation must say so.
- **The app and the service share no code** (DIRECTION §3.6 line 288). The JS
  package enters the app stage and the Go package will enter the service stage;
  the two never cross. The pattern is "same mechanism, two independent
  contexts," not "one shared bundle."
- **No song text in logs; offline-first; accessibility; no book without an
  account** — not applicable. This task touches only the build plumbing and a
  documentation paragraph; it serves no requests, renders no UI, and logs
  nothing.

## Acceptance criteria

### Behaviour delivered

- **`docs/DIRECTION.md` §3.6 design delta** (authored by this task): a short
  paragraph, inserted before "Locally, everything runs as in production"
  (line 386), stating that both repositories meet in the image build — the app
  bundles cifra.md for JavaScript and the hook links cifra.md for Go, both from
  the sibling checkout outside the build context, each brought in as a *named
  build context* (`cifra-md` for JS, `cifra-md-go` for Go) wired in
  `compose.yaml` and copied by the `Dockerfile` at the dependency's expected
  path, so each language's toolchain resolves the sibling package inside Docker
  without vendoring or cross-language copying.
- **`Dockerfile` / `compose.yaml` comments formalized**: the existing inline
  comments on the `cifra-md` context (Dockerfile lines 15–30, compose.yaml
  lines 61–67) name the approach as *the cross-repo named-build-context
  pattern* and cross-reference DIRECTION §3.6, and the Go stage comment
  (Dockerfile lines 48–49) is extended to say the Go format package is brought
  in the same way when the hook links it (`hook.canonical`). No functional line
  changes.
- **The stack still builds and the e2e-api smoke tests still pass** — the
  existing `cifra-md` JS context is unchanged and verified end to end.

### Tests the task lands with, by level

Per the `.tji` note, **this task has no tests of its own** — it changes build
comments and a documentation paragraph, neither of which is unit-, behavior-,
or e2e-testable in isolation. Its correctness is pinned by the **existing**
gate, which the closer confirms ran green:

- **e2e-api (executable proof, not new) — `e2e/api/health.test.js`** (Vitest,
  via the session HTTP helper): `GET /healthz` → `200 ok`. Passing means the
  image built — the `cifra-md` named context resolved the sibling JS package
  under `docker compose up --build --wait` — and the stack is up on one origin.
  Pins DIRECTION §3.6 "One binary … in the image" and the new §3.6 build-seam
  paragraph. `e2e/api/mail.test.js` and `e2e/api/git.test.js` round out the
  smoke surface the stack must satisfy.
- **WBS gate — `tj3 --silent --no-reports project.tjp`** clean and
  `scripts/unblocked.py` with no ORPHANS: the design-delta edit and the
  `complete 100`/`Refinement:` back-link leave the schedule error- and
  warning-free (run by `scripts/gate`).

No level the note names is dropped; no level is added, because there is no new
testable unit — the proof is the stack the gate already builds and exercises.

### The symmetric Go extension (not a new WBS leaf)

The Go build-context wiring — a `cifra-md-go` named context in `compose.yaml`,
a `COPY --from=cifra-md-go` into the Go stage at the module's expected path,
and whatever `.dockerignore`/`go.mod` adjustment the import needs — **rides
with `hook.canonical`** (`tasks/35-hook.tji`, milestone **m3_service**), the
first task that both builds the hook binary into the image and imports
cifra.md for Go. It is *already inside that task's scope*: hook.canonical
depends on `cifra_go.writer`/`setlists`/`versions` and cannot compile without
resolving the sibling Go package, and `foundation.compose` already assigned the
"add the hook binary (and un-ignore `service/cmd/pre-receive`) to the
Dockerfile" change to the hook area. This refinement and the DIRECTION §3.6
pattern are its recipe. **No new task is registered** (a standalone
"wire the Go context" leaf would duplicate work hook.canonical must do anyway
and would orphan). *Closer: do not create a follow-up leaf for the Go context;
verify instead that `hook.canonical` carries it.*

## Decisions

- **Formalize now, wire Go with its first consumer.**
  *Rationale:* the JS context already works and is proven by the e2e-api smoke
  tests; the debt `storage.working_copy` left is that the mechanism is
  undocumented and un-argued, not that it is broken. The durable fix is to make
  it a named, documented pattern (a DIRECTION §3.6 seam the constitution owns)
  so the symmetric Go case is a one-line follow of a recipe rather than a
  re-discovery. The Go wiring itself cannot be done now — its package, its
  consumer, and even the hook binary in the image all post-date this task — so
  this task delivers the pattern and assigns the wiring to the task that will
  own it.
  *Alternative rejected:* add the `cifra-md-go` context and a Go-stage `COPY`
  speculatively now. It breaks the build the task must keep green — the context
  path `../cifra.md/go` does not resolve (no `go/` directory), nothing COPYs
  from it to make it worthwhile, and `docker compose up --build` fails on the
  dangling context. A pattern no consumer exercises is also untested dead
  weight.

- **Document the seam in `docs/DIRECTION.md` §3.6, not only in comments.**
  *Rationale:* a cross-repository build composition is an architectural seam
  (two repos → one image), exactly the kind §3.6 "Components and repositories"
  governs; §3.6 already shows the two-repo layout and says the image bundles
  the app but never says *how* the sibling format packages get in. Inline
  Dockerfile/compose comments are implementation notes that drift; the
  constitution is where a load-bearing pattern belongs so future tasks
  (hook.canonical) inherit it. This is the "formalize and document" the note
  asks for.
  *Alternative rejected:* keep it in comments and this refinement's Decisions
  only. That leaves the pattern exactly as invisible as the Status note that
  created this debt — the next person still learns it by reading the Dockerfile.

- **Assign the Go wiring to `hook.canonical`, do not register a new leaf.**
  *Rationale:* hook.canonical is the first importer of cifra.md for Go and
  physically cannot build without resolving the sibling Go package, so the
  wiring is intrinsic to its scope; `foundation.compose` already routed the
  hook-binary Dockerfile change to the hook area. Naming the owner keeps the
  work from being forgotten without creating a micro-task.
  *Alternative rejected:* a standalone `foundation.wire_cifra_go_context` leaf.
  It would duplicate work hook.canonical must do to compile at all, could not
  be closed before hook.canonical (same dependencies), and risks landing as an
  orphan — the WBS anti-pattern the project's rules forbid.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `docs/DIRECTION.md` §3.6: added "Both repositories meet in the image build" paragraph (lines 386–394) naming `cifra-md` (JS) and `cifra-md-go` (Go) as the cross-repo named-build-context pattern, citing no-vendoring/no-cross-language-copying constraint.
- `Dockerfile` app stage (lines 15–20): new comment naming the *cross-repo named-build-context pattern* and cross-referencing DIRECTION §3.6; existing WORKDIR depth comment retained.
- `Dockerfile` service stage (lines 57–61): extended comment saying cifra.md Go package comes in the same way when `hook.canonical` links it — `cifra-md-go` context wired in compose.yaml at the module's expected path.
- `compose.yaml` `additional_contexts` block: comment naming the pattern + DIRECTION §3.6, noting the symmetric `cifra-md-go` context the hook area will add.
- No functional lines changed; existing `cifra-md` JS context unchanged; e2e-api smoke tests (`health.test.js`, `mail.test.js`, `git.test.js`) confirmed green by the driver gate.

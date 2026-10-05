# foundation.api_contract — API contract

## TaskJuggler entry

`task api_contract` in [`tasks/25-foundation.tji`](../../25-foundation.tji)
(lines 35–40), under `task foundation`. Its note: *"api/: sign-in, books,
the shelf change check, sharing and invitations, git — both sides tested
against it. DIRECTION §3.6 The API. Tests: unit (the contract document
validates; the small helper both sides' tests use to check a request or
response against it, tested on a conforming and a non-conforming sample)."*
The area file's header states the stream's purpose, naming this task
explicitly: *"The monorepo, its tooling, **the API contract**, running
everything locally as in production, CI, and the two end-to-end harnesses
every later task's e2e tests are written in."*
([`tasks/25-foundation.tji`](../../25-foundation.tji) lines 1–5).

## Effort estimate

**2 days** (from the `.tji`).

## Repository

**estante-de-cifras** (`/home/ruoso/devel/estante-de-cifras`), the `api/`
directory only. This task turns the placeholder slot reserved by
[`foundation.monorepo`](monorepo.md) (`api/README.md`, naming what lands and
the owning task) into the written-down HTTP API contract plus a thin
validation helper per language, each self-contained in `api/`. It touches no
other directory: it writes no `app/` code, no `service/` code and no
endpoint — the service and the app *implement* this contract in their own
tasks; this task only *states* it and gives both sides a way to check
themselves against it. The task's note does **not** begin with `cifra.md:`,
so nothing lands in the cifra.md repository.

No design delta is authored. DIRECTION §3.6 *The API*
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 342–358) already
names the five areas the contract covers and the rule that *"both sides
[are] tested against it"*; this task realises that specification without
amending it (§Decisions).

## Inherited dependencies

- **`foundation.monorepo` — settled.** Complete (`complete 100`,
  [`tasks/25-foundation.tji`](../../25-foundation.tji) lines 10–15); its
  refinement is [`foundation/monorepo.md`](monorepo.md). It reserved `api/`
  with a placeholder `README.md` that names this task as the one that fills
  the slot ([`api/README.md`](../../../api/README.md)), and established the
  component boundary this contract embodies — *"The app and the service
  share no code, only the HTTP API and the format"*
  ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) line 275). This task's
  `depends !monorepo` is its only declared dependency
  ([`tasks/25-foundation.tji`](../../25-foundation.tji) line 38).
- **`bootstrap.architecture` / `bootstrap.direction` — settled** (through
  the `foundation` parent, [`tasks/25-foundation.tji`](../../25-foundation.tji)
  line 8). They wrote DIRECTION §3.3–3.7, including §3.6 *The API* and *Git
  over HTTP*, which this contract turns into a document.

This task is a sibling of `app_tooling`, `service_skeleton` and `compose`,
which also carry `depends !monorepo`
([`tasks/25-foundation.tji`](../../25-foundation.tji) lines 20, 32, 44).
Downstream, the service stream depends on it: `service.*` is gated on it
(`task service { depends foundation.service_skeleton, foundation.api_contract,
foundation.e2e_api }`, [`tasks/30-service.tji`](../../30-service.tji) line 7).
The contract is deliberately kept **self-contained in `api/`** so it can land
whether or not `app_tooling` or `service_skeleton` have landed yet — it does
not reach into `app/` or `service/` for its own tests (§Decisions).

## What this task is

This task writes the HTTP API contract down once, in `api/`, as a single
OpenAPI 3.1 document, and ships a small validation helper in each of the two
languages that consume the API — JavaScript for the app and Go for the
service — so both sides can check a request or a response against the
contract in their own tests. The contract covers the five areas DIRECTION
§3.6 *The API* names: **signing in** (passkey register and authenticate, the
emailed sign-in link, sign-out, the signed-in devices and the passkeys),
**books** (the user's own listed, creating one empty and private, deleting
one, forking one), **the shelf change check** (one request for the whole
shelf, each book with the head the device has, answered with the books that
moved), **sharing and invitations** (members listed and their roles changed
or removed; invitations made with a role, an expiry and a use-limit, listed
with who joined, withdrawn, accepted, up to fifty people per book), and
**git over HTTP** (smart HTTP per book, reads for members, pushes for editors
and the owner). The git endpoints are described at the HTTP envelope — method,
path, auth, content types, status codes and the service's pre-git refusals —
with their bodies left as git's own opaque media types, because git owns the
pack framing (DIRECTION §3.6 *Git over HTTP*). It writes no endpoint and no
client: the contract is a document, and the helpers are validators over it.

## Why it needs to be done

The API is one of exactly two things the app and the service share — *"only
the HTTP API and the format"* ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md)
line 275) — and they share no code, so the only way the two independently
written sides can agree is to be *"tested against it"* (§3.6 line 344), the
same way the cifra.md implementations agree by being held to the corpus
rather than by sharing code. Writing the contract down first, before either
side implements it, gives `service.*` (which depends on it,
[`tasks/30-service.tji`](../../30-service.tji) line 7) and the app a fixed
target, and gives both a reusable helper so every endpoint task can assert its
traffic conforms without re-deriving the shapes. The contract is the seam the
whole client/server split is built on; stating it once keeps the two sides
from drifting.

## Inputs / context

- **DIRECTION §3.6 *The API*** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 342–358: the five
  areas verbatim and *"Written down as a contract, `api/`, and both sides
  tested against it"*. The authoritative enumeration of what the contract
  covers, including the role rule for git — *"Reads for every member; pushes
  for editors and the owner, and every push through the hook"* (line 358).
- **DIRECTION §3.6 *Git over HTTP*** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 304–340: the three
  git endpoints (`GET …/info/refs?service=…`, `POST …/git-upload-pack`, `POST
  …/git-receive-pack`), the `Git-Protocol` → `GIT_PROTOCOL` pass-through, gzip
  request bodies, and that *"Authentication and refusals are all its own,
  before git starts"* — a request with no access, a book over quota, a book
  deleted, refused by the service with git never spawned (lines 323–327). The
  contract pins this HTTP envelope; git owns the body.
- **DIRECTION §3.6 components table and boundary** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 266–275: the app is
  JavaScript, the service and hook are Go, and *"The app and the service share
  no code, only the HTTP API and the format."* This is why the helper is two
  thin validators over one document, not one shared library (§Decisions).
- **DIRECTION §3.3 *The one server*** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 140–209: one origin
  at `estantedecifras.app` (API beneath the app, *"no CORS, a session cookie
  that simply flows"*, line 157–158); the service *"answers has this book
  changed? by reading one ref off the disk, so a client spends a fetch only on
  a book that did"* (lines 182–183) — the change-check's semantics; the
  fifty-people and no-anonymous-read rule (lines 162–169).
- **DIRECTION §3.1 Sync / §3.2 Personal state** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 121–138: *"Fetch,
  merge, push, retried when the push races another"* and the home book (a git
  repository like any other) that carries the shelf and personal state — all
  moved over git over HTTP, not bespoke endpoints.
- **Workflow 13 — new device / sign-in**
  ([`docs/workflows/13-new-device.md`](../../../docs/workflows/13-new-device.md)):
  passkey register and authenticate are *"standard WebAuthn"* (each a
  begin/finish pair); the **emailed link** is the only non-WebAuthn path and
  the account-recovery path (lines 25–27); the account screen lists
  signed-in devices with last-used and signs any out, and lists and removes
  passkeys (lines 69–73); a revoked session *"stops working at its next
  request"* (lazy enforcement, lines 71–72). Device pairing by QR is deferred
  (lines 84–89).
- **Workflow 10 — share**
  ([`docs/workflows/10-share.md`](../../../docs/workflows/10-share.md)):
  roles owner / editor / reader (lines 63–70); *"at most fifty members"* per
  book, readers and editors together, enforced by the service, shown as *"37
  of 50"* (lines 28–39); invitations by link with a role, an expiry (*"a day,
  a week (the default), a month, or until withdrawn"*) and an optional
  use-limit *"down to one"*, multi-use by default, listed with who joined,
  withdrawn without removing existing members (lines 41–61); accepting
  requires a session and refuses when expired, exhausted, withdrawn or the
  book is full (lines 58–61, 36–39); members-list is role-filtered — the owner
  sees everyone and every invitation, members see owner and editors but not
  other readers (lines 72–75); remove and lower-role are owner-only and take
  effect *"at their next request"* (lines 77–85). Approving each joiner and
  editor-invites are deferred (lines 108–117).
- **Workflow 14 — file view / what a push may hold**
  ([`docs/workflows/14-file-view.md`](../../../docs/workflows/14-file-view.md)):
  the pre-receive hook's acceptance rules — one ref (`refs/heads/main`),
  fast-forward only, no stowaway objects, allowed paths and modes, 256 KB per
  file, canonical songs and setlists — and *"A push that fails any check is
  refused whole, naming what failed, and its objects never reach the
  repository"* (lines 79–116); the limits (256 KB/file, 50 MB/book with
  history, 100 books and 200 MB/account, create rate-limited, lines 33–42).
  The contract references these as the push refusals that come back through
  git's own channel, not as HTTP status codes.
- **Workflow 07 — add a book**
  ([`docs/workflows/07-add-a-book.md`](../../../docs/workflows/07-add-a-book.md)):
  *"Mine on Estante"* lists the user's books not yet on this shelf (lines
  22–33); *Put online* creates the book on Estante, *"goes online private:
  only its owner can open it"*, adds it as the remote and pushes (lines
  45–52); delete is owner-only (lines 128–138); download and upload are built
  from the local clone client-side, so no server operation beyond create and a
  normal push. The app link is *"`…/b/<book>`"*, *"not its git URL, which is
  the service's business"* (lines 39–43) — two distinct URL namespaces.
- **Workflow 08 — sync**
  ([`docs/workflows/08-sync.md`](../../../docs/workflows/08-sync.md)): each
  run begins with *"one request asking the service which books on the shelf
  have changed (DIRECTION §3.3), and fetches only those"* (lines 12–25) — the
  change-check is one batched request over the whole shelf; a push that loses a
  race is rejected and retried up to three times (lines 59–63); a request
  refused because the user is no longer a member turns the book into *"no
  longer shared with you"* (lines 65–70).
- **Workflow 11 — fork**
  ([`docs/workflows/11-fork.md`](../../../docs/workflows/11-fork.md)): a fork
  is a server-side repository copy, private, owned by the caller, remembering
  its **original** single-level (lines 18–39); the shelf reports how far the
  original has advanced — *"Ana's Choros has 3 new saves"* — which rides on the
  change check (lines 41–55); when the original goes away the follow-state
  returns a gone signal without touching the fork (lines 49–55).
- **`scripts/gate`** — [`scripts/gate`](../../../scripts/gate): `npm_checks`
  (lines 151–165, lint/test/build each when its script exists, `test` excused
  only until the first test file exists) and `go_checks` (lines 171–189, vet /
  test / build) are the two reusable check routines; the gate runs them for
  `app/` (lines 292–296) and `service/` (lines 311–315) but has **no `api/`
  branch yet** — this task adds one so `api/`'s unit tests run (§Constraints).
- **Style precedent** — [`foundation/monorepo.md`](monorepo.md) and
  [`foundation/app_tooling.md`](app_tooling.md), the sibling foundation
  refinements, for section shape and the rationale/alternative Decisions form.

## Constraints / requirements

- **One contract document, OpenAPI 3.1, in `api/`.** The contract is
  `api/openapi.yaml`, a single OpenAPI 3.1 document whose component schemas are
  JSON Schema (2020-12, which OpenAPI 3.1 adopts). Every operation carries an
  `operationId`; every request body and JSON response has a named schema;
  every book-scoped operation declares the session-cookie security
  requirement. YAML is the readable source of truth (§Decisions).
- **The five areas, fully.** The contract covers sign-in, books, the shelf
  change check, sharing and invitations, and git over HTTP, as enumerated in
  DIRECTION §3.6 *The API* and detailed by workflows 13, 07/11, 08, 10 and 14.
  No area may be stubbed to "later": each is implementable now as a *written*
  contract even where its endpoint is implemented by a later task.
- **Git endpoints at the envelope, not the body.** The three git routes
  (`GET …/git/info/refs`, `POST …/git/git-upload-pack`, `POST
  …/git/git-receive-pack`) are described with their methods, auth (member
  reads; editor/owner pushes), content types (git's `application/x-git-*`
  media types), the `Git-Protocol` header and the service's pre-git refusals
  as HTTP status codes; their request/response bodies are declared as opaque
  binary, **not** schema-validated, because git owns the pack framing
  (DIRECTION §3.6 *Git over HTTP*, lines 304–340). Push-content refusals
  (workflow 14) come back through git's own channel and are documented as such,
  not as HTTP codes.
- **One validation helper per language, both in `api/`.** Because the app
  (JavaScript) and the service (Go) *"share no code"* (DIRECTION §3.6 line
  275), the helper is two thin validators over the one document — a JS helper
  (an `api/` npm package) and a Go helper (an `api/` Go module). Each loads the
  contract and checks a given payload against the schema the contract names for
  an operation and direction (request, or response by status), returning a
  clear pass/fail with the schema errors. "Small" is the bar: a selector plus a
  standard JSON-Schema validation, not a bespoke validator (§Decisions).
- **The gate runs `api/`'s unit tests.** `scripts/gate` gains an `api/` branch
  that runs `npm_checks` over `api/` (the JS helper's Vitest) and `go_checks`
  over `api/` (the Go helper's `go test`), mirroring the existing `app/` and
  `service/` branches ([`scripts/gate`](../../../scripts/gate) lines 292–296,
  311–315). Without this the closer cannot see the named unit tests run, and
  the contract's tests would be invisible to the single source of green.
- **No song text, no secrets, in error shapes.** Error responses carry a
  machine-readable code and a short human message and **never** song text, a
  commit message, an email address or a token — consistent with the standing
  rule that the service logs and now surfaces request metadata only
  ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.3, the structured
  logging rule carried by `foundation.service_skeleton`). The emailed-link
  request takes an address but the contract keeps it to the request body, never
  an error echo.
- **No book without an account.** Every book-, share- and git-scoped operation
  requires a session and a membership; the contract marks them with the
  session-cookie security requirement and documents the refusal for a missing
  session and for a non-member. The only operations without a prior session are
  the sign-in begin/finish and email-link request/redeem, and accepting an
  invitation (which itself requires signing in first, workflow 10 lines 58–61).
  Nothing the contract describes is an anonymous read or a bearer link that
  opens a book to whoever holds it ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md)
  lines 162–169).
- **One origin, session cookie.** The contract is served beneath the app on
  one origin (DIRECTION §3.3 lines 157–158): a session **cookie**, no CORS,
  no bearer tokens in headers. The app-facing book link `…/b/<book>` is the
  app's own routing and is **not** part of this API contract; the API and git
  URLs are (workflow 07 lines 39–43).
- **Standing rules — which apply.** *No song text in logs / errors* and *no
  book without an account* apply, as above. *Canonical form over preserving
  content* applies only indirectly: the contract documents that push
  canonicality is enforced by the hook through git's channel (workflow 14), not
  by an HTTP schema. *Offline first* shapes the surface — the change check is
  **one** batched request, not per-book polling (workflow 08), and git carries
  the data — but the contract itself is network shapes, called when there is a
  network. *Accessibility* does not apply: this task renders no UI (§Decisions).

## Acceptance criteria

**Behaviour delivered.** The HTTP API contract is written down once in `api/`
and both sides have a way to check themselves against it, committed in
estante-de-cifras. Concretely:

- `api/openapi.yaml` is a valid OpenAPI 3.1 document covering all five areas
  with named request/response schemas for the JSON operations and the git
  endpoints described at the envelope:
  - **Sign-in** — passkey register begin/finish and authenticate begin/finish;
    email-link request and redeem; sign-out; list and revoke sessions; list and
    remove passkeys (workflow 13).
  - **Books** — list the user's own; create one empty and private (returns the
    book id and its git remote URL, caller becomes owner); delete (owner only);
    fork (server-side copy, records the single-level original) (workflows 07,
    11).
  - **Change check** — one request carrying, per shelf book, its id and the head
    the device has; the response names the books that moved with their new head,
    a fork's original advance as a new-saves count, and a gone / no-longer-a-
    member signal (workflows 08, 11; DIRECTION §3.3 lines 182–183).
  - **Sharing and invitations** — members listed role-filtered by caller, role
    changed and member removed (owner only); invitations created with a role,
    an expiry enum {day, week=default, month, until-withdrawn} and an optional
    use-limit (min 1), listed with who joined, withdrawn, and accepted, with the
    full / expired / exhausted / withdrawn refusals and the fifty-member cap
    (workflow 10).
  - **Git over HTTP** — `info/refs`, `git-upload-pack`, `git-receive-pack` per
    book, member reads and editor/owner pushes, with the pre-git refusals as
    status codes and push-content refusals through git's channel (DIRECTION
    §3.6 *Git over HTTP*; workflow 14).
- `api/` ships a JS validation helper and a Go validation helper, each loading
  the contract and validating a payload against a named operation/direction.
- `scripts/gate` runs `api/`'s JS and Go checks; the gate is green over the new
  `api/` content (`tj3 --silent --no-reports` clean, `scripts/unblocked.py`
  clean).

**Tests the task lands with, by level.** The `.tji` note names **unit** only,
and both unit concerns it lists land here, named, run by the gate's new `api/`
branch (not skipped). No other level is dropped: this task delivers a document
and two validators, not a running endpoint, so there is no behavior, e2e-api
or e2e-web surface to pin here (see the closing note).

- **unit — `api/openapi.test.js`** (Vitest): pins that the contract document
  validates — `api/openapi.yaml` parses and conforms to the OpenAPI 3.1
  specification (via a standard OpenAPI parser/validator), every `$ref`
  resolves, and every operation has an `operationId` — the JavaScript side of
  the note's *"the contract document validates"*. This is the first test file
  in `api/`'s JS package, flipping the gate's new `api/` JS `test` branch from
  *"no test files yet"* ([`scripts/gate`](../../../scripts/gate) line 159) to a
  live run.
- **unit — `api/validate.test.js`** (Vitest): pins that the JS helper passes a
  **conforming** sample and rejects a **non-conforming** sample for
  representative operations (e.g. a well-formed vs. malformed create-book
  request, and a conforming vs. malformed change-check response), returning the
  schema errors on failure — the note's *"the small helper … tested on a
  conforming and a non-conforming sample"* on the app's side.
- **unit — `api/contract_test.go`** (`go test`, package `apicontract`): pins
  that the contract document validates under the Go loader (kin-openapi): it
  loads `api/openapi.yaml`, validates the document, and resolves every `$ref` —
  the Go side of *"the contract document validates"*, proving the one document
  is consumable by both languages.
- **unit — `api/validate_test.go`** (`go test`): pins that the Go helper passes
  a conforming sample and rejects a non-conforming sample for the same
  representative operations — the note's helper test on the service's side.

*Why no behavior / e2e-api / e2e-web here.* This task writes the contract and
the validators; it stands up no endpoint and no screen. The endpoints are
implemented by the `service.*` tasks, which depend on this one
([`tasks/30-service.tji`](../../30-service.tji) line 7) and which land their
own **behavior** tests (Go handlers through `httptest`) and **e2e-api** journeys
— each using *this* helper to assert its traffic conforms to the contract. The
app's screens land their **behavior** and **e2e-web** tests likewise. Pinning a
live endpoint here would test code this task does not write; the right division
is that the contract is unit-tested for validity and consumability now, and
every endpoint is tested against it as it lands.

**Deferred work.** None registered. The per-endpoint conformance checks are
not deferred follow-ups: they are part of the `service.*` and app tasks that
already exist in the WBS and depend on this contract, and they carry their own
tests by the standing rule. This task defers nothing of its own.

## Decisions

- **The contract is a single OpenAPI 3.1 document (`api/openapi.yaml`), YAML as
  the source of truth.** *Rationale:* OpenAPI 3.1 describes operations —
  method, path, auth, content type, status codes — not just payload shapes,
  which is what *"both sides tested against it"* needs (the contract says which
  schema applies to which request and which response), and its component
  schemas are JSON Schema 2020-12, so the same shapes validate in any language;
  YAML keeps a five-area contract readable in review, and both ecosystems'
  loaders read it. *Alternative rejected:* bare JSON Schema files with a
  hand-written index of which schema belongs to which route — it re-invents the
  operation layer OpenAPI already standardises and gives the helpers no shared
  vocabulary for "request of operation X" vs. "response of X at status 409".
- **The helper is two thin validators over one document, not one shared
  library.** *Rationale:* DIRECTION §3.6 line 275 forbids the app and the
  service sharing code; the shared thing is the *contract* (language-neutral
  data), and each side needs only a small selector-plus-JSON-Schema-validate
  over it — the JS helper on ajv-class validation through a standard OpenAPI
  parser, the Go helper on `getkin/kin-openapi`. Both are *"the small helper"*
  of the note, realised per language because code is not shared, exactly as the
  cifra.md implementations are per language and agree by being checked against
  one artifact. *Alternative rejected:* a single validator (e.g. a Node CLI the
  Go tests shell out to, or a WASM build) both sides call — it makes the service
  depend on a JavaScript runtime at test time, couples the two sides through an
  executable rather than through data, and is the opposite of the "checked, not
  shared" principle.
- **`api/` is self-contained: its own npm package and Go module, with its own
  tests, and the gate learns an `api/` branch.** *Rationale:* `api_contract`
  depends only on `!monorepo` ([`tasks/25-foundation.tji`](../../25-foundation.tji)
  line 38), so it must be landable before `app_tooling` or `service_skeleton`;
  putting the helpers and their tests in `app/` or `service/` would create an
  undeclared dependency on those tasks and split the contract across
  directories. Keeping both validators in `api/` and teaching `scripts/gate` to
  run `api/`'s JS and Go checks (mirroring the `app/` and `service/` branches,
  gate lines 292–296, 311–315) keeps the task self-contained and its tests
  visible to the single source of green. The service and app later *import*
  `api/`'s helper — permitted, because `api/` is the HTTP API, the one thing
  they are allowed to share. *Alternative rejected:* leaving the Go helper for a
  `service_skeleton`-adjacent task — it would drop a level the note names ("both
  sides … tested") and couple this task's completion to the service's module
  existing.
- **Git endpoints are pinned at the HTTP envelope; their bodies stay opaque.**
  *Rationale:* DIRECTION §3.6 *Git over HTTP* is explicit that the protocol, the
  packs and ref locking stay git's own and the service owns only the framing and
  the refusals before git starts (lines 321–337); the contract therefore fixes
  the routes, auth, content types, the `Git-Protocol` pass-through and the
  pre-git status codes, and declares the bodies as git's `application/x-git-*`
  binary, not schema-validated. Push-content refusals (workflow 14) are
  documented as coming through git's own channel. *Alternative rejected:*
  attempting to schema the pkt-line / pack bodies — git owns that framing, a
  schema would be wrong the first time git's negotiation varied, and nothing on
  either side validates pack bytes against a contract.
- **HTTP status codes are assigned by the contract; non-members get 404, not
  403.** *Rationale:* no workflow names a numeric code, so the contract decides
  them: 401 for a missing/invalid session, **404 for a book the caller is not a
  member of** (so the API never confirms a private book exists to a non-member —
  the no-anonymous-read, `noindex` stance of §3.3 lines 162–169), 403 for a
  member whose role is insufficient (a reader pushing), 409 for a state refusal
  (invitation full / expired / exhausted / withdrawn, with a machine-readable
  reason), 413 for an over-size or over-quota request before git. *Alternative
  rejected:* 403 for every non-member — it leaks that a book exists at that id,
  which the privacy rule forbids.
- **No design delta.** *Rationale:* DIRECTION §3.6 *The API* and *Git over
  HTTP* already name the five areas, the git endpoints and the "both sides
  tested against it" rule, and the workflows settle the roles, limits and
  refusals the contract encodes; writing the contract changes no designed
  behaviour and opens no new seam (the shared-contract seam is already in
  DIRECTION §3.6). The OpenAPI tooling and the two validators are `api/`'s own
  dev dependencies, not the service's (whose dependency list, §3.6 line
  300–302, is unchanged) nor the app's, so they amend nothing in DIRECTION or a
  workflow.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `api/openapi.yaml` — OpenAPI 3.1 document covering all five areas (sign-in, books, change-check, sharing/invitations, git over HTTP) with named request/response schemas for all JSON operations and envelope-only descriptions for the three git routes.
- `api/validate.js` — thin JS validation helper (npm package in `api/`) loading the contract and checking a payload against the named operation/direction schema.
- `api/validate.go` — thin Go validation helper (Go module `estantedecifras.app/api`) mirroring the JS helper using kin-openapi.
- `api/package.json`, `api/package-lock.json`, `api/go.mod`, `api/go.sum` — package manifests for the two self-contained validators.
- `api/openapi.test.js` — Vitest: contract parses as valid OpenAPI 3.1, every `$ref` resolves, every operationId is unique, all five areas tagged; 5 tests pass.
- `api/validate.test.js` — Vitest: JS helper passes conforming and rejects non-conforming create-book request and change-check response; 9 tests pass.
- `api/contract_test.go` — Go: loads document, validates, resolves `$ref`s.
- `api/validate_test.go` — Go: helper passes conforming and rejects non-conforming samples; 7 Go tests pass.
- `api/README.md` — updated from placeholder to contract description.
- `scripts/gate` — new `api/` branch running `npm_checks` (JS Vitest) and `go_checks` (Go vet/test/build) over `api/`, mirroring the `app/` and `service/` branches.

# books.notice_surface — Show the take-down reason in BookDetail

## TaskJuggler entry

Defined in [`tasks/65-books.tji`](../../65-books.tji):

```
task notice_surface "Show the take-down reason in BookDetail" {
  effort 2d
  allocate team
  depends sync.lost_access, service.admin
  note "Sync engine maps the git `403 taken_down` to a distinct halted state
        carrying the reason; BookDetail.jsx renders the operator's reason
        (role=status notice) beside the existing Download card. Source of debt:
        tasks/refinements/service/admin.md (service.admin). Governing: workflow 10
        §A copyright notice; DIRECTION §3.6. Tests: behavior (BookDetail renders
        the taken-down notice with the reason, axe clean; sync engine `403
        taken_down` classification in access-refused.js); e2e-web (a taken-down
        book shows its reason on phone, tablet and computer; axe)."
}
```

In plain language: the service can take a book down for a copyright notice, and
the operator records a reason. The service already refuses git to the book's
owner and members with that reason — a `403` whose JSON body is
`{code: "taken_down", message: "This book has been taken down: <reason>"}`
(`service.admin`). But the app does not yet read it: the Worker's sync engine
treats only a `404` as a halt (`gone`), and a taken-down book shows the generic
*no longer shared with you* notice with no reason. This task closes that gap. The
Worker classifies the `403 taken_down` refusal into a **distinct halted state**
(`taken_down`) carrying the operator's message, and `BookDetail` renders that
message in a `role="status"` notice beside the existing Download card, distinct
from the lost-access notice.

## Effort estimate

**2d** (as scoped in the `.tji`), allocated `team`. The two days are: a new pure
classifier in `access-refused.js` that recognises the `taken_down` 403 body and
extracts its message; a new `taken_down` phase threaded through the engine
(including a git **probe on the change-check `gone` path** — see Decision 1), the
protocol enum, the reducer fold (whitelisting a new `reason` field) and
`sync-display`; a new notice card in `BookDetail.jsx` with one new i18n title key
across the four locales; and the named unit, behavior and e2e-web tests. No
service change, no API-contract change, no format work.

## Repository

**estante-de-cifras only**, `app/` (Worker + view) and the `e2e/web/` harness.
Files touched:

- `app/src/worker/access-refused.js` and its unit test `…/access-refused.test.js`
- `app/src/worker/sync-engine.js` and its unit test `…/sync-engine.test.js`
- `app/src/worker/protocol.js` (SYNC phase enum doc) and
  `app/src/worker/reducer.js` (SYNC fold + slice doc)
- `app/src/sync-display.js` and its unit test `…/sync-display.test.js`
- `app/src/books/BookDetail.jsx` and its behavior test
  `…/BookDetail.behavior.test.jsx`
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` (one new title key)
- `e2e/web/lib/db.js` (a `takeDownBook` seam) and a new spec
  `e2e/web/tests/notice-surface.spec.js`

No cifra.md change: the format is untouched. **No service or `api/` change** — the
service already returns the `403 taken_down` with its reason (shipped by
`service.admin`); this task only consumes it (see Decision 5).

## Inherited dependencies

- **`sync.lost_access`** (`depends sync.lost_access`) — **settled.** Done
  (`complete 100`). It built the Worker's one lost-access authority
  `app/src/worker/access-refused.js` (`isAccessRefused(err)` → true only for a
  `404`), the engine's three `isAccessRefused` → `emitFact(bookId, 'gone')`
  branches, the `gone` phase through `protocol.js`/`reducer.js`/`sync-display.js`,
  and the `isGone` notice card in `BookDetail.jsx` with the *no longer shared with
  you* copy beside the Download card. This task extends every one of those seams
  for a second, distinct halted state. See
  [`sync/lost_access.md`](../sync/lost_access.md).
- **`service.admin`** (`depends service.admin`) — **settled.** Done
  (`complete 100`). It built `service/cmd/estante-admin take-down`, the
  `books.taken_down_reason` column, and the `gitAuthorize` branch
  (`service/internal/server/git.go:220-236`) that refuses an owner/member of a
  taken-down book with `403` `code: "taken_down"` and the reason on info/refs,
  upload-pack and receive-pack (so clone, fetch and push all carry it); a
  stranger still gets `404`. It explicitly deferred the app surface to **this
  task** (named `books.notice_surface` in its Decisions). See
  [`service/admin.md`](../service/admin.md).

Both dependencies are `complete 100`, so both named test journeys are drivable
today (see Acceptance criteria → *driving*). No pending dependencies. This task
is the last leaf `milestones.m4_together` depends on
([`tasks/99-milestones.tji`](../../99-milestones.tji)); it is already wired into
that milestone's `depends`.

## What this task is

Two layers, the same `taken_down` fact flowing from one to the other.

**The Worker** learns *why* a book is unreachable. The service's change-check
answers only `gone` for a taken-down book — `accessibleBooks` excludes
`taken_down_reason IS NOT NULL` alongside non-members and deleted books
(`service/internal/server/shelf.go:189-199`), so a taken-down book and a book the
device was removed from are indistinguishable at the change-check. The reason is
**book-scoped and authenticated**: it rides only on the git refusal
(`service.admin` Decision). So the engine must do a git request to recover it. A
new pure classifier `takenDownReason(err)` reads the isomorphic-git `HttpError`
body (`err.data.response`, the stringified JSON — isomorphic-git 1.x
`index.cjs:4015-4018`) and returns the `taken_down` message, or `null`. The
engine emits a new `taken_down` phase carrying that message as `reason`.

**The view** shows it. `BookDetail.jsx` reads the live `sync` slice; when the
phase is `taken_down` it renders a notice card carrying the operator's message in
a `role="status"` region, beside the existing Download card, distinct from the
`gone` (*no longer shared with you*) card. On the shelf, a taken-down book keeps
reading *no longer shared with you* like any gone book (workflow 10: "shows as
gone on every shelf (workflow 8)") — only the book detail carries the reason.

## Why it needs to be done

`service.admin` made take-down observable end-to-end at the git layer (pinned by
`e2e/api/admin.test.js`), but a person using the app would see their book go
quietly *no longer shared with you* with no explanation — the same as being
removed from someone else's book. Workflow 10 §A copyright notice promises *the
owner is told why*; DIRECTION §3.6 promises the reason is "returned to the book's
owner and members." The record exists and the git channel carries it; this task
is the app surface that turns that record into the sentence the owner reads. It
has no downstream dependents of its own — it completes the M4 *Together*
milestone's copyright-notice story.

## Inputs / context

- **Workflow 10 §A copyright notice**
  ([`docs/workflows/10-share.md:102-115`](../../../docs/workflows/10-share.md)):
  the operator action records a reason durably against the book ("the record
  behind *the owner is told why*"); a taken-down book's repository stays in place
  but is unreachable — "its owner and members are refused git with that reason (a
  stranger, as always, learns nothing), and the book shows as gone on every shelf
  (workflow 8). Surfacing that reason inside the app is a later addition over the
  record the service keeps." This task is that later addition. The workflow
  specifies behaviour, not literal UI copy (see Decision 4).
- **DIRECTION §3.6** (`docs/DIRECTION.md:339-345`): "A book taken down for a
  copyright notice (workflow 10) is refused the same way, its reason returned to
  the book's owner and members, a stranger told only that there is no such book."
  Also §3.6 (`:288-291`): the app and the service share no code, only the HTTP API
  and the format.
- **The service seam (already shipped, `service.admin`):**
  - `service/internal/server/git.go:220-236` — `gitAuthorize` refuses an
    owner/member of a taken-down book with
    `writeError(w, 403, "taken_down", "This book has been taken down: "+reason)`;
    a stranger / removed member / deleted book gets `404`.
  - `service/internal/server/respond.go:12-30` — the error JSON body shape:
    `{code, message}`.
  - `service/internal/server/shelf.go:189-199` — `accessibleBooks` excludes
    `taken_down_reason IS NOT NULL`, so the change-check answers `gone` (with **no
    reason**) for a taken-down book; `shelf_test.go` pins that a taken-down book
    reports `gone`.
  - `books.taken_down_reason` column ships in `0001_registry.sql`.
- **The Worker seams (`sync.lost_access`):**
  - `app/src/worker/access-refused.js:35-37` — `isAccessRefused(err)` returns
    `err?.data?.statusCode === 404`. Pure, logs nothing; its header is emphatic
    that a `403` is a reader-push (still a member) and NOT lost access.
  - `app/src/worker/sync-engine.js` — `import { isAccessRefused }` at `:51`; the
    three `if (isAccessRefused(err)) { emitFact(bookId, 'gone'); return; }`
    catch sites: a lost-race retry fetch (`:509-512`), the push refusal
    (`:550-553`), and the `syncSongbook` fetch (`:608-611`). The change-check
    `gone` branch `if (change?.status === 'gone') { emitFact(bookId, 'gone');
    return; }` (`:574-578`) — the branch that **short-circuits before any git
    request**, so it is where the probe must go (Decision 1). `emitFact(bookId,
    phase, extra = {})` builds `{ bookId, phase, at, ...extra }`. The home-book
    gone branch `syncHomeBook` (`:655-657`) is left untouched (the home book is
    personal state, never a hosted/taken-down book — DIRECTION §3.2).
  - `app/src/worker/protocol.js:439-445` — `EventKind.SYNC` fact and the phase
    enum doc `'syncing' | 'in_step' | 'saves_waiting' | 'offline' | 'needs_you' |
    'gone'`.
  - `app/src/worker/reducer.js:464-484` — the `case EventKind.SYNC` fold
    whitelists `{ phase, savesWaiting, lastInStep, at }` (a new `reason` field is
    dropped unless added); whole-entry replace, so an omitted field resets. Slice
    doc at `reducer.js:125-133`.
  - `app/src/sync-display.js:28` (`OUT_OF_STEP` set) and `:67-97`
    (`syncDisplayFor` switch, `case 'gone'` → `{ word: t('books.noLongerShared'),
    cls: 'conflict dot', dot: true }`).
- **The view seam (`sync.lost_access` / `books.online`):**
  - `app/src/books/BookDetail.jsx:219` `const sync = useSlice(store, 'sync');`;
    `:236` `const isGone = sync?.[bookId]?.phase === 'gone';`; `:328-343` the
    `isGone` lost-access card (`role="status"` body at `:334`); `:345-352` the
    Download card (the task's anchor — "beside the existing Download card").
  - i18n: `app/src/i18n/locales/en.js:72` `noLongerShared`, `:92-93`
    `lostAccessTitle`/`lostAccessBody`; mirror keys in `pt-BR.js`, `es-419.js`,
    `it.js` (~lines 85-97).
- **The isomorphic-git error shape:**
  `app/node_modules/isomorphic-git/index.cjs:4015-4018` — `HttpError`'s
  `this.data = { statusCode, statusMessage, response }`; `response` is the
  stringified body (`:9718-9720` for upload-pack/info-refs, `:9792-9794` for
  receive-pack). `isomorphic-git@^1.43.0`.
- **Tests to extend / add:**
  - `app/src/worker/access-refused.test.js` — pure vitest; `httpError(statusCode)`
    helper builds `err.data = { statusCode, statusMessage }` (needs a `response`
    body added for the taken-down cases).
  - `app/src/worker/sync-engine.test.js` — the engine's unit suite.
  - `app/src/sync-display.test.js` — the sync-word unit suite.
  - `app/src/books/BookDetail.behavior.test.jsx` — Testing Library + jsdom +
    `checkWcag21aa` from `../a11y/axe.js`; `emit(event(EventKind.SYNC, { bookId,
    phase, … }))` seeds the slice; the `gone` test at `:144-179` and its negative
    at `:181-189` are the pattern to mirror. Renders inside `ThemeRoot` so RAC
    overlays portal into `.est` ([[rac-overlays-portal-outside-est-theme-root]]).
  - `e2e/web/lib/db.js` — the Postgres seam (`postgres(required(
    'ESTANTE_TEST_DATABASE_URL'), { max: 1 })`), exports `seedAccount`,
    `fillBookToCapacity`; a `takeDownBook(bookId, reason)` helper mirrors
    `fillBookToCapacity`.
  - `e2e/web/tests/lost-access.spec.js` — the template: sign in via CDP virtual
    authenticator, make a local book, put it online, seed a song over smart HTTP
    with the owner cookie, assert the detail notice across the three viewports
    with `analyzeWcag21aa`.

## Constraints / requirements

- **Consume the service, do not change it.** The `403 taken_down` with its reason
  is the shipped contract (`service.admin`; `api/openapi.yaml` `GitForbidden`).
  This task reads it; it adds no endpoint, changes no status code, and does not
  touch `service/` or `api/`. The app and the service share no code (DIRECTION
  §3.6 L288-291).
- **Worker owns the data; the view only reads a slice.** The classification and
  the new phase live in `app/src/worker/`; `BookDetail.jsx` learns the state only
  through the `sync` reducer slice, exactly as it reads `gone` today (DIRECTION
  §3.7). The classifier is a pure, framework-free, Worker-only module.
- **The reason is operator metadata, not song text, and nothing is logged.** The
  classifier reads the refusal body's `code`/`message` (a status line, never song
  text); it logs nothing, holding the no-song-text-in-logs rule. The message is
  rendered to the owner/member it was returned to — book-scoped, behind a session
  (no book without an account).
- **A distinct halted state, not an overloaded `gone`.** The note requires a
  *distinct* halted state. `taken_down` is a sibling of `gone`, not `gone` with an
  optional reason (Decision 2). On the shelf both read the same *no longer shared
  with you* word (workflow 10: "shows as gone on every shelf"); only BookDetail
  distinguishes them.
- **Accessibility.** The notice is a React Aria `role="status"` live region (the
  same pattern as the existing lost-access body and put-online error), status
  carried by a word never colour alone; the card is keyboard-reachable; axe clean
  at WCAG 2.1 AA.
- **Offline-first; nothing destroyed.** The git probe runs only on the
  change-check `gone` path, which fires only when the device reached the service
  this pass (an offline pass never reports `gone`); a taken-down book keeps its
  working copy and any unpushed commits exactly as the `gone` path does today —
  the book stays locally readable and downloadable. No save or push is attempted
  against a taken-down book.

## Acceptance criteria

### Behavior delivered

1. **The classifier.** `access-refused.js` gains
   `takenDownReason(err)`: for an isomorphic-git `HttpError` with
   `err.data.statusCode === 403` whose `err.data.response` parses as JSON with
   `code === 'taken_down'`, it returns the `message` string; for anything else (a
   reader-push `403` with no/other body, a `404`, a `5xx`, a missing response /
   offline, a malformed body, `null`/`undefined`) it returns `null`.
   `isAccessRefused` is unchanged (still `404`-only), so the two classifiers do
   not overlap. The module stays pure and logs nothing.
2. **The engine recovers and carries the reason.** On the `syncSongbook`
   change-check `gone` branch (`sync-engine.js:574-578`), instead of emitting
   `gone` directly, the engine probes the book with `fetchBook(bookId)`; if the
   thrown error yields a non-null `takenDownReason(err)`, it emits
   `emitFact(bookId, 'taken_down', { reason })`, otherwise it emits `gone` (a
   `404`, or any other outcome, remains plain lost access). At the three direct
   git catch sites (`:509`, `:550`, `:608`), the engine checks
   `takenDownReason(err)` **before** `isAccessRefused(err)`, emitting `taken_down`
   with the reason when it matches — so a book taken down mid-pass is classified
   there too. In every case the unpushed commits and working tree are kept, as on
   the `gone` path. `syncHomeBook` is untouched.
3. **The phase flows through to the slice.** `protocol.js` adds `taken_down` to
   the documented SYNC phase enum; `reducer.js` adds `reason` to the `case
   EventKind.SYNC` field whitelist (`reason: message.payload?.reason ?? null`) and
   to the slice doc — a non-`taken_down` phase resets `reason` to `null` by the
   existing whole-entry replace.
4. **The shelf treats it as gone.** `sync-display.js` adds `taken_down` to
   `OUT_OF_STEP` and a `case 'taken_down'` to `syncDisplayFor` returning the same
   word/badge as `gone` (`t('books.noLongerShared')`, `cls: 'conflict dot'`, `dot:
   true`) so the shelf and the header out-of-step mark are unchanged (workflow 10:
   gone on every shelf).
5. **BookDetail renders the reason.** `BookDetail.jsx` derives `isTakenDown =
   sync?.[bookId]?.phase === 'taken_down'` and `takenDownReason =
   sync?.[bookId]?.reason`. When `isTakenDown`, it renders a notice card — a
   localized title `t('books.takenDownTitle')` and a `role="status"` paragraph
   showing `takenDownReason` verbatim — immediately beside the Download card,
   mutually exclusive with the `isGone` card (a book is one or the other). The
   book stays readable and downloadable; no fork offer is shown (a copyright
   take-down is not a *make it your own* case — Decision 3).
6. **i18n.** One new key `books.takenDownTitle` is added to `en`, `pt-BR`,
   `es-419` and `it`. No new body key: the body is the service's message,
   rendered verbatim (Decision 4).

### Tests, by level

The `.tji` note names **behavior** (BookDetail notice + the classifier) and
**e2e-web**. It is kept in full and sharpened; a **unit** level is added for the
pure modules the task adds to — the note folds "the sync engine `403 taken_down`
classification in access-refused.js" into its behaviour clause, but
`access-refused.js`, `sync-engine.js`'s phase mapping and `sync-display.js` are
pure functions whose natural and existing level is unit (a pure module gets unit
tests — the testing policy). This adds a level, it drops none.

- **unit — `app/src/worker/access-refused.test.js`** (extend `httpError` to accept
  a `response` body): `takenDownReason(err)` returns the message for a `403` whose
  body is `{code:'taken_down', message:'This book has been taken down: …'}`;
  returns `null` for a reader-push `403` (no body / body without `code`), a `404`,
  a `5xx`, a missing response (offline), a malformed `response` string, and
  `null`/`undefined`; `isAccessRefused` still `true` only for `404` and `false`
  for the taken-down `403` (the two do not overlap). Pins the `403 taken_down`
  contract (`service.admin`; git.go:232) and DIRECTION §3.6.
- **unit — `app/src/worker/sync-engine.test.js`**: a book the change-check reports
  `gone` whose probe fetch throws a `taken_down` `403` is emitted `taken_down`
  with the reason, its unpushed work kept; the same path with a `404` probe is
  emitted `gone`; a push/fetch refused `taken_down` mid-pass (the direct catch
  sites) is emitted `taken_down`, and a reader-push `403` still falls through to
  `saves_waiting`. Pins workflow 10 §A copyright notice, DIRECTION §3.6, and
  reuses the existing engine `gone` cases as the pattern.
- **unit — `app/src/sync-display.test.js`**: `taken_down` yields the gone shelf
  word (`books.noLongerShared`, `conflict dot`) and counts in `anyOutOfStep`. Pins
  workflow 10 L113 ("gone on every shelf").
- **behavior — `app/src/books/BookDetail.behavior.test.jsx`** (mirror the `gone`
  test at `:144-179`): with the `sync` slice seeded `{ phase:'taken_down',
  reason:'<a purpose-written reason>' }`, BookDetail renders the taken-down notice
  — the localized title and the reason verbatim in a `role="status"` region —
  beside the Download card; it does **not** render the *no longer shared with you*
  card nor a fork offer; Download stays reachable; axe clean at WCAG 2.1 AA. A
  negative case: a book in any non-`taken_down` phase shows no taken-down notice.
  Pins the note's behavior clause, workflow 10 §A copyright notice, DIRECTION §3.6,
  and the word-not-colour / live-region rule.
- **e2e-web — `e2e/web/tests/notice-surface.spec.js`** (phone, tablet, computer;
  new `takeDownBook(bookId, reason)` in `e2e/web/lib/db.js`): a signed-in device
  puts its own book online and seeds a purpose-written song; the book is taken
  down through the db seam (`UPDATE books SET taken_down_reason = $reason` —
  mirroring `e2e/api/admin.test.js:119-125`, the operator effect no endpoint
  provides); the device syncs and the book's detail shows the operator's reason in
  the notice beside Download; axe clean on each of the three viewports. Pins the
  note's e2e clause, workflow 10 §A copyright notice, DIRECTION §3.6.

Fixtures — book name, song and take-down reason — are written for the purpose,
never anyone's copyrighted words or a real notice. The closer confirms every
named test above exists and ran (not skipped) in the gate's output.

No tech-debt is deferred: the task delivers its behavior and its tests in full.
The broader "actively telling people a book was taken down" channel that workflow
10 marks *Later* stays out of scope and is not a WBS task (it needs a product and
legal decision — see Open questions).

## Decisions

1. **Recover the reason by probing git on the change-check `gone` path, not by
   changing the change-check.** *Chosen.* The change-check deliberately answers
   `gone` with no reason — the reason is book-scoped and authenticated, carried
   only on the git refusal (`service.admin` Decision; `shelf.go:189-199`). Because
   `syncSongbook` short-circuits at the `gone` branch (`:574-578`) before any git
   request, a taken-down book with no local changes would otherwise never meet the
   `403` and its reason would never surface. So on that branch the engine does one
   `fetchBook` probe to disambiguate `taken_down` (a `403` with the reason) from
   plain `gone` (a `404`). *Rejected:* teaching the change-check to return the
   reason — it would widen a shared contract (`api/`, `service/`) that
   `service.admin` deliberately kept reason-free and would leak the reason onto a
   bulk, less-authenticated surface; the git refusal is the one book-scoped
   channel DIRECTION §3.6 names. *Cost accepted:* an already-halted book does one
   extra `info/refs` advertisement per sync pass while online; this is consistent
   with `sync.lost_access`'s "no new durable halted state" (the halt is re-derived
   each pass), and the advertisement is cheap. A durable "already classified"
   memory to skip the re-probe is deliberately not built (it is the same shape as
   the re-derived `gone` and would be premature).
2. **A distinct `taken_down` phase, not `gone` + an optional reason.** *Chosen* —
   the note asks for a *distinct halted state*, and the two are semantically
   different: `gone` is "you are no longer a member"; `taken_down` is "you are
   still a member, but the service removed the book for a notice." A distinct phase
   lets `BookDetail` branch on a clear state rather than on presence-of-reason, and
   keeps the lost-access and take-down notices cleanly mutually exclusive.
   *Rejected:* overloading `gone` with a `reason` field — it conflates two
   situations and makes every `gone` reader test for a reason.
3. **No fork offer on the taken-down notice.** *Chosen* — *make this book your own*
   is the escape from losing access to someone else's book (workflow 8 / W11);
   offering to fork a book the service took down for a copyright notice would
   invite re-publishing the very content under notice. The taken-down card carries
   the reason and leaves Download available (the universal card — the user may
   still export their local copy), but no fork. *Rejected:* reusing the `isGone`
   card's fork button — wrong affordance for a copyright take-down.
4. **Render the service's `message` verbatim under a localized title; add no
   localized body.** *Chosen* — the operator's reason is free-text in whatever
   language the operator wrote and is inherently not localizable; the service
   returns it already framed (`"This book has been taken down: <reason>"`). The
   app frames it with a localized card title (`books.takenDownTitle`) and shows the
   message as the `role="status"` body. This keeps the task app-only and avoids a
   fragile prefix-strip. *Rejected:* adding a structured raw-`reason` field to the
   `GitForbidden` contract so the app could build a fully-localized frame — a
   cross-repo `service/` + `api/` change for a rare legal event whose core text is
   unlocalizable anyway; the residual (an English frame sentence for non-English
   locales) is recorded under Open questions for product, not encoded as a task.
   *Rejected:* a localized body key that re-states the reason — doubly redundant
   with the server's already-framed message.
5. **No design delta.** *Chosen* — every change is implementation within seams
   that DIRECTION §3.6-3.7, workflow 10 §A copyright notice, `sync.lost_access` and
   `service.admin` already define: a sibling classifier, a sibling halted phase, a
   reused `role="status"` card, one i18n title. Workflow 10 already names "surfacing
   that reason inside the app" as the planned later addition this task is; no
   governing document needs amending. No new runtime dependency, no new seam, no
   format change.

## Open questions

- Workflow 10 marks "actively telling people" a book was taken down (beyond
  surfacing the reason on the book detail) as a *Later* concern. Whether and how
  the app should proactively notify (versus showing the reason when the owner
  opens the book, as this task does) is a product-and-legal judgement, not
  agent-implementable work — surfaced for the parking lot, not scoped here.
- The service frames the reason in English (`"This book has been taken down:
  …"`); for non-English locales that frame sentence is not translated (the reason
  text itself never is). Fully localizing the frame would require a structured
  `reason` field on the `GitForbidden` contract (a `service.admin`/`api/` change);
  deferred to product's call on whether the rare-event wart is worth the cross-repo
  change — surfaced for the parking lot, not scoped here.

## Status

**Done** — 2026-10-13.

- `app/src/worker/access-refused.js`: added `takenDownReason(err)` classifier that parses `err.data.response` JSON for `code:'taken_down'` and returns the `message`, returning `null` for all other inputs; `isAccessRefused` unchanged (404-only; no overlap).
- `app/src/worker/sync-engine.js`: change-check `gone` branch now probes with `fetchBook(bookId)` to disambiguate; three direct git catch sites check `takenDownReason` before `isAccessRefused`; all emit `taken_down` with `{reason}` when matched.
- `app/src/worker/protocol.js` + `app/src/worker/reducer.js`: `taken_down` added to SYNC phase enum doc; `reason` field whitelisted in `case EventKind.SYNC` fold (resets to `null` on non-`taken_down` phase via whole-entry replace).
- `app/src/sync-display.js`: `taken_down` added to `OUT_OF_STEP` set and a `case 'taken_down'` returning the same word/badge as `gone`.
- `app/src/books/BookDetail.jsx`: `isTakenDown` / `takenDownReason` derived from `sync` slice; renders a notice card (localized title + `role="status"` paragraph with verbatim reason) beside Download, mutually exclusive with the `isGone` card; no fork offer.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: `books.takenDownTitle` key added in all four locales.
- `e2e/web/lib/db.js`: `takeDownBook(bookId, reason)` helper added (UPDATE books SET taken_down_reason); `e2e/web/tests/notice-surface.spec.js` (new): phone/tablet/computer viewports, axe at WCAG 2.1 AA.
- Tests written: unit (`access-refused.test.js`, `sync-engine.test.js`, `sync-display.test.js`); behavior (`BookDetail.behavior.test.jsx`); e2e-web (`notice-surface.spec.js`, all 3 viewports).

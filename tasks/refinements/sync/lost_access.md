# sync.lost_access — Losing access

## TaskJuggler

[`tasks/45-sync.tji:48`](../../45-sync.tji) — `task lost_access "Losing
access"`, under `task sync`. `effort 1d`, `allocate team`, `depends !engine,
service.sharing, foundation.e2e_web, books.add_by_link`. Through the parent
`task sync` it also inherits `storage.working_copy`, `cifra_js.merge` and
`foundation.e2e_api`.

The `.tji` note:

> Refused for not being a member: no longer shared with you, readable, never
> synced; unsaved saves kept, fork or download offered. Workflow 8. Tests:
> behavior (a refusal for not being a member marks the book, keeps unsaved
> saves, stops syncing); e2e-web (the owner removes a member on the stack;
> the member's device shows no longer shared with you, the song still
> readable, fork and download offered; axe).

Downstream, `books.fork` ("Make it my own", [`tasks/65-books.tji:44`](../../65-books.tji))
lists **losing access** as one of its three ways in and owns the end-to-end
*make it my own after losing access* journey (workflow 11). This task builds
the losing-access **surface** that `books.fork` wires its fork action into;
see Decisions.

## Effort estimate

**1d.** The hard parts already exist. The `gone` fact flows end-to-end today
(`sync.engine`, Done 2026-10-07): the change-check reports `gone`, the engine
emits it and stops the book, and `sync.states` (Done) renders the shelf badge
*no longer shared with you*. Book-level **Download** is built and wired
(`books.online`, Done). The e2e removal seam exists (`share.spec.js` already
removes a member and polls the removed device to the `gone` badge). This task
is the thin layer on top: the book-detail notice and the two escape offers
for a `gone` book, one small engine hardening so a definite git-over-HTTP
404 is treated as lost access (not a silent retry), new i18n copy, and the
named tests. No new screens, no new service work, no new format work.

## Repository

**estante-de-cifras**, app only. The note does not start with `cifra.md:`.
The notice and offers render in the existing per-book detail screen (the view
is the only layer that knows React — DIRECTION §3.7 L426–428); the one engine
change is framework-free ESM in the Worker (the Worker owns git, the working
copy and the index — §3.7 L418–420). No cifra.md change, no service change —
the app and the service share no code (DIRECTION §3.6), and the membership
cause of losing access is the service's business already (`service.sharing`,
Done); the device only reacts to being refused.

Directories / files that change:

- `app/src/worker/sync-engine.js` (edit) — classify a definite git-over-HTTP
  **404** on fetch or push (the service's "non-member / no book" refusal,
  `service/internal/server/git.go:208,217`) as lost access: emit `gone` and
  stop the book, the same halt the change-check `gone` already drives
  (:556–562, :630–633). A **403** on push (an editor lowered to *reader* —
  still a member) is **not** lost access and stays on the existing
  `saves_waiting` path (see Decisions). Today any non-lost-race error on
  push becomes `saves_waiting` (:539) and a fetch error is swallowed
  (:688–692), so a removed member caught mid-pass would retry forever
  instead of halting.
- `app/src/worker/access-refused.js` (new) — a pure classifier
  `isAccessRefused(err) → boolean`: true for an isomorphic-git HTTP error
  whose status is 404 (no membership), false for 403 (reader), for a missing
  response (offline), and for 5xx. The only lost-access authority in the
  Worker; keeps the engine branch a one-liner and the logic unit-testable
  without a refusing git remote.
- `app/src/worker/access-refused.test.js` (new) — the unit level for the
  classifier.
- `app/src/worker/sync-engine.test.js` (edit) — one unit case: a book with
  unpushed commits goes `gone` on a 404 refusal, keeps those commits, and
  stops; a 403 push does not go `gone`. Extends the existing `gone` case
  (:118–130).
- `app/src/books/BookDetail.jsx` (edit) — when the book's live `sync` phase
  is `gone`, render a *no longer shared with you* notice card above the
  existing Download card (reading the phase from the reducer `sync` slice,
  the same source `sync.states` uses), and render the **Make this book your
  own** (fork) offer beside Download. The Download card is already present
  and functional (:312–319); the fork offer dispatches the fork entry
  (`books.fork` owns the handler — see Decisions).
- `app/src/books/BookDetail.behavior.test.jsx` (new or extend) — the
  view behavior level (the notice, readable, both offers, axe).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` (edit) — add
  `books.lostAccessTitle` and `books.lostAccessBody`; reuse the existing
  `books.download` (:89) and `books.makeYourOwn` (:436). The i18n parity test
  (`i18n.test.js`) requires each key in every locale.
- `app/src/worker/protocol.js` (edit, only if needed) — define the fork
  command kind the offer dispatches, if `books.fork` has not already; the
  handler is `books.fork`'s.
- `e2e/web/tests/lost-access.spec.js` (new) — the e2e-web level, reusing
  `share.spec.js`'s hosted-book + membership-removal seam.

## Inherited dependencies

- **`sync.engine`** (`tasks/45-sync.tji:8`, Done 2026-10-07) — the self-driving
  fetch→merge→push loop. It already emits `EventKind.SYNC { bookId, phase, … }`
  with `phase ∈ syncing | in_step | saves_waiting | offline | needs_you |
  gone` into the reducer `sync` slice (`app/src/worker/reducer.js:125–133,
  :464–484`), and on a change-check `gone` it emits `gone` and stops the book
  (`app/src/worker/sync-engine.js:556–562, :630–633`; engine refinement AC7).
  Offline-first: a failed change-check, fetch or push never rolls back a
  commit and never surfaces an error (engine refinement constraints; module
  header L25–27). This task adds the one missing classification (a 404 git
  refusal is lost access, not a retryable failure) on top of that rule and
  renders what the engine leaves as a bare fact.
- **`service.sharing`** (`tasks/30-service.tji:57`, Done) — members,
  invitations, roles, and **removal**. Removal is a hard row delete on
  `memberships` (no soft-delete); after it, the change-check answers `gone`
  for that book (`service/internal/server/shelf.go`), and the git endpoints
  answer 404 for a non-member (`service/internal/server/git.go:208,217`) and
  403 for a reader push (:231). This task consumes those refusals; it never
  tracks or enforces membership itself (the cap and all enforcement are the
  service's — `books.add_by_link` refinement).
- **`books.add_by_link`** (`tasks/65-books.tji:30`, Done) — joining a book by
  invitation. Membership lives on the shelf register's `role` field
  (`shelf.books[serviceId] = { label, link, position, role }`); a hosted book
  is cloned into `bookDir(serviceId)`. This is the membership model the task
  reacts to, and it drives the e2e: a second account accepts an invitation
  and clones as editor. Transitively it carries `books.online` (Done), so the
  Download seam is present.
- **`foundation.e2e_web`** (`tasks/25-foundation.tji:72`, Done) — the
  Playwright harness against the compose stack, the three viewports
  (`lib/devices.js`), axe (`lib/axe.js`), offline (`lib/offline.js`),
  two-context/two-account and passkey sign-in helpers, Mailpit and Postgres
  seeding. The e2e lands here.

## What this task is

When the owner removes someone from a book (or lowers them below membership,
or the book is deleted or taken down), the device learns it the next time it
asks the service — the change-check answers `gone`, or a direct git request
is refused. Workflow 8 §Losing access: the book turns *no longer shared with
you* — **readable as it is, never synced again**; the saves not yet pushed
are kept, and the book **offers a fork or the download** so nothing the user
wrote is lost. The shelf already carries the mark (`sync.states`). This task
builds the fuller surface `sync.states` deferred to it: the book-detail
notice that explains the state, the confirmation that the book is still fully
readable, the two escape offers, and the one engine change that makes a
direct 404 refusal halt the book the same way the change-check `gone` does.

## Why it needs to be done

Losing access is the one sync outcome that ends a book's life on the device
without the user doing anything, and the only one where their un-uploaded
work can be stranded. Without this surface a `gone` book shows only a terse
shelf badge: the user is not told the book is still theirs to read, and has
no prompt to rescue unpushed saves before they are forgotten. `sync.states`
explicitly handed the readable/fork/download affordances to this task
(`states.md` Decision on the `gone` badge), and `sync.engine` handed it the
rendering of the `gone` fact (engine AC7). It closes workflow 8's last
unbuilt section.

## Inputs / context

### Normative design

- **`docs/workflows/08-sync.md:64–69`** — §Losing access, the normative text:
  "A request refused because the user is no longer a member turns the book
  into *no longer shared with you*: readable as it is, never synced again.
  Saves not yet pushed are kept, and the book offers a fork or the download
  (workflow 10)." Also `:26–38` §What the shelf says — the state list
  (`:34` *no longer shared with you*) and the one header *quiet mark*.
- **`docs/workflows/10-share.md:79–85`** — the sharing-side cause: removal
  "takes effect at their next request to the service… What is on their
  device stays; it cannot be recalled. The book becomes *no longer shared
  with you* on their shelf." An editor lowered to reader, or removed, with
  unpushed saves "is told those saves can no longer go to the book, and is
  offered a fork (workflow 11) or the download (workflow 7)."
- **`docs/workflows/11-fork.md:10–15`** — §Ways in: "**Losing access** with
  saves not yet pushed (workflows 8, 10)" is one of fork's three entry
  points. `:19–24` — a fork is the user's own copy with all its history,
  carrying the working copy and unsaved edits over.
- **`docs/workflows/07-add-a-book.md:54–62`** — §Downloading a book: Download
  saves the repository as it is on the device (`.git` + working tree, unsaved
  changes included), the service remote stripped.
- **DIRECTION §3.3 L338–341** — "Authentication and refusals are all its own,
  before git starts. A request with no access… refused by the service with a
  clear message, git never spawned." This is the refusal this task reacts to.
  **L175–178** — every request for a book needs a session and a membership;
  no anonymous read. **L213–217** — any book can be downloaded as a zip (the
  anti-lock-in guarantee the Download offer honours). **§3.1 L129–134** —
  sync is fetch/merge/push with unsaved work merged under edits.
- **`docs/mockups/W11-fork.dc.html:163–194`** — the offer surface precedent:
  a *no longer shared with you* notice, with **Download** and a **Fork**
  action carrying a one-line description, and the shelf badge (`:183`). The
  W11 board draws the "original went away" variant; the member-removed
  surface is the same, minus the "stops following" language.
- **`docs/mockups/W08-sync.dc.html:243`** — the shelf row in the `no longer
  shared with you` state.
- **`docs/mockups/README.md:26`** — "Every status badge carries a word, never
  colour alone" (the standing UI rule cited by every sync surface).

### Code seams this extends

- `app/src/worker/sync-engine.js:556–562, :630–633` — where `gone` is emitted
  from a change-check answer; `:489–545` (`pushWithRetry`) and `:688–692`
  (per-book `try/catch`) where a refusal currently becomes `saves_waiting` or
  is swallowed; `:166–207` derive ahead-count / dirty-tree.
- `app/src/worker/git-http.js:72–116` — the HTTP client that carries the
  status code the classifier reads (it does not throw on non-2xx;
  isomorphic-git turns status into typed errors downstream).
- `app/src/worker/reducer.js:125–133, :464–484` — the `sync` slice the view
  reads the `gone` phase from.
- `app/src/sync-display.js:91–92` — `gone → "no longer shared with you"`
  (`books.noLongerShared`, `.badge.conflict.dot`); `anyOutOfStep` includes
  `gone` (`:28`). The shelf mark is done; do not duplicate it.
- `app/src/books/BookDetail.jsx:224–331` — the per-book detail: the role
  chips (`canSaveFor`), the Download card (`:312–319`, dispatches
  `CommandKind.DOWNLOAD_BOOK`, reply `EventKind.BOOK_DOWNLOAD` saved as a
  zip at `:60–67, :244–247`), the Remove card with its `savesWaiting` count
  (`:321–331`, `removeLoss` copy). `savesWaiting` is already read from
  `sync?.[bookId]?.savesWaiting` (`:225`) — the unpushed count is in hand.
- `app/src/worker/online.js:203–221` — `download({ bookId })` zips the repo
  (history + working tree, unsaved included) and strips the remote; wired by
  `app/src/worker/logic.js:1475–1483` (`DOWNLOAD_BOOK`). Functional today.
- `app/src/i18n/locales/en.js:72` (`noLongerShared`), `:89` (`download`),
  `:431–436` (`cannotSaveTitle/Body`, `makeYourOwn` — the "Make this book
  your own" copy, added speculatively for fork's entry points).

### Test harness / support

- `app/src/worker/sync-engine.test.js:118–130` — the existing "stops syncing
  a gone book and emits gone" unit case (fake `changeCheck.check` returning
  `status:'gone'`); the pattern the new unit case extends.
- `app/src/test/git-http-remote.js`, `app/src/test/{loopback,web-locks}.js`,
  `fake-indexeddb` — the Worker behavior harness (a real local smart-HTTP
  remote; no 403/404 refusal mode — not needed here, the engine behavior is
  driven through the change-check `gone` stub as the existing case does).
- `e2e/web/tests/share.spec.js:200–306` — the hosted-book + member-removal
  seam: `putBookOnline` (`:91`), `bookFromApi` (`:104`), an invitation
  accepted by a second account via `openDevice` (`lib/devices.js`), the
  owner's removal, and the removed device polled via `reloadAndSync` to the
  `no longer shared with you` badge (`:305`). The lost-access e2e reuses it.
- `e2e/web/tests/sync-states.spec.js:12–32` — notes there is no in-browser
  path to seed a hosted syncing book except the share.spec seam; this task
  uses that seam.

## Constraints / requirements

1. **The device reacts; it never tracks membership.** Loss of access is
   learned only from the service — a change-check `gone` answer, or a 404 on
   fetch/push. The app never counts members or anticipates removal (DIRECTION
   §3.3; `add_by_link.md`). No new durable per-book state store is added; the
   `gone` phase stays the in-memory/derived fact it is today.
2. **Offline-first is preserved.** Only a *definite* service refusal halts a
   book. A 404 (no membership) → `gone`. A missing response (offline), a 5xx,
   and the lost-race path stay exactly as they are: silent, retried, no error
   shown, no commit rolled back (DIRECTION §3.4 L233–234; engine module
   header L25–27).
3. **Nothing is destroyed on `gone`.** Saves not yet pushed (local commits
   ahead of origin) and unsaved working-copy edits are kept untouched; the
   book remains fully readable offline. The `gone` halt must not fetch,
   merge, push, reset or prune.
4. **Canonical form, and marked text, are unaffected.** This task writes no
   song content; it neither saves nor pushes. (The project's canonical-form
   rule bites only on save/push, which a `gone` book no longer does.)
5. **Accessibility (DIRECTION, standing rule).** The notice and both offers
   are React Aria Components, keyboard-reachable, axe-clean at WCAG 2.1 AA;
   the state is carried by the word *no longer shared with you*, never colour
   (`mockups/README.md:26`). The notice uses `role="status"` like the
   detail's other status copy (`BookDetail.jsx:301`).
6. **No song text in logs.** Nothing new is logged; the refusal carries only
   a book id and a status.
7. **No book without an account** is not loosened: a `gone` book is read from
   the local clone only; it makes no further authenticated request for the
   book's content.

## Acceptance criteria

The task delivers:

1. A git-over-HTTP **404** refusal on fetch or push marks the book `gone`,
   stops syncing it, and keeps its unpushed commits and working-copy edits —
   the same halt the change-check `gone` already drives. A **403** on push
   (reader) does not mark the book `gone`.
2. Opening a `gone` book shows, on its detail screen, a **no longer shared
   with you** notice: the book is readable as it is and will not sync again,
   its copy, history and songs are all here.
3. The `gone` book's songs still open and read normally (nothing blocks the
   local read; no save/push is attempted).
4. The book offers **Download** (functional — the existing zip of the repo as
   it is on the device) and **Make this book your own** (the fork offer; its
   action is `books.fork`'s — see Decisions).
5. New i18n copy `books.lostAccessTitle` / `books.lostAccessBody` in all four
   locales; `books.download` and `books.makeYourOwn` reused.

### Tests it lands with (the note names behavior and e2e-web)

- **unit** — `app/src/worker/access-refused.test.js`: `isAccessRefused`
  returns true for a 404 git-http error, false for 403, for a missing
  response (offline) and for 5xx. Pins DIRECTION §3.3 L338–341 (refusals
  before git) and the git.go status ladder (404 non-member vs 403 reader).
  _Added beyond the note's named levels: the 404-vs-403 boundary is a pure
  decision and gets a unit test; a pure module gets unit tests (testing
  policy). It does not replace the behavior level below._
- **unit** — `app/src/worker/sync-engine.test.js` (added case): a book with
  unpushed commits, on a 404 refusal, goes `gone`, keeps the commits and
  stops; a 403 push does not go `gone`. Pins workflow 8 L66–69 and engine
  AC7.
- **behavior** — `app/src/books/BookDetail.behavior.test.jsx`: with the
  reducer `sync` slice set to `gone`, the detail shows the *no longer shared
  with you* notice, the book is readable (songs reachable), and both
  **Download** and **Make this book your own** are offered — present,
  labelled, keyboard-reachable, each state carried by a word; axe clean at
  WCAG 2.1 AA. Pins workflow 8 L66–69, `states.md` badge decision, the W11
  board surface.
- **e2e-web** — `e2e/web/tests/lost-access.spec.js`, on phone, tablet and
  computer: an invitation is created on the stack (`service.sharing`) and
  accepted by a second account as **editor** (`books.add_by_link`); the
  member's device clones and makes a save it has not pushed; the membership
  is removed via the service (`share.spec.js`'s removal seam, driven by the
  owner or the API — not a dependency on the owner UI); the member's device
  syncs and shows **no longer shared with you**; the song still opens and
  reads; the book-detail offers **Download** (which produces a zip) and
  **Make this book your own**; axe clean on every screen touched, on every
  viewport. Pins workflow 8, DIRECTION §3.3, `states.md`.
  _The fork-offer control is asserted present and reachable (offered), not
  clicked through to a completed fork; the completed lost-access→fork
  journey is `books.fork`'s e2e ("make it my own after losing access")._

Test songs are written for the purpose (standing rule); no copyrighted
words.

No tech-debt follow-up is deferred from this task: Download is built, the
fork action is an existing WBS leaf (`books.fork`), and the reader-push-403
surface is governed by workflow 10 §A reader who wants to change something
(`books.fork`'s "saving where one cannot" entry). See Open questions for the
one boundary flagged for human review.

## Decisions

- **The fork *offer* is this task's; the fork *action* is `books.fork`'s.**
  *Chosen:* `sync.lost_access` renders the losing-access surface and both
  escape offers (Download wired here, "Make this book your own" present and
  reachable), and `books.fork` delivers the fork machinery and wires the
  offer's action, owning the end-to-end *make it my own after losing access*
  journey. *Rejected:* (a) building the whole fork feature here — it is a
  net-new 2d leaf (service repo-copy endpoint, Worker module, command/event,
  shelf "from X's book") that `books.fork` already owns and that depends on
  `sync.fork_follow`; folding it in would blow the 1d estimate and duplicate
  a planned task. (b) Omitting the fork offer and leaving only Download — the
  note requires the e2e to assert "fork and download offered", and
  `states.md` assigned the fork/download affordances to this task.
  *Rationale:* this is the division both notes already describe —
  `states.md` ("`sync.lost_access` owns the … affordances") and
  `books.fork` ("offered by … losing access"). It keeps the task at 1d, adds
  no cycle (this task does not depend on `books.fork`), and makes the offer a
  clean seam: this task ships the control, `books.fork` ships the handler and
  the completion test. The WBS ordering consequence — `books.fork` should
  depend on `sync.lost_access` so its losing-access journey has this surface
  — is flagged in the return summary for the orchestrator.
- **A 404 is lost access; a 403 is not.** *Chosen:* classify only a definite
  git-over-HTTP 404 (the service's non-member / no-book refusal) as `gone`;
  leave a 403 push (an editor lowered to *reader*, still a member) on the
  existing `saves_waiting` path. *Rejected:* treating any git refusal as
  lost access — a reader is still a member, the book still syncs reads, and
  turning it `gone` would wrongly stop its sync and mislabel it. *Rationale:*
  `git.go` returns 404 for a non-member and 403 for a reader push; the
  workflow-8 trigger is precisely "no longer a *member*". The
  reader-with-unpushed-saves case (workflow 10 L83–85) is a distinct surface
  governed by `books.fork`'s "saving where one cannot" entry, not this task.
- **Engine hardening, not a redesign of detection.** *Chosen:* keep the
  change-check `gone` as the primary detection (it runs first every pass and
  already halts removed books before any fetch), and add the 404 fetch/push
  classification only as the fallback for a removal caught mid-pass or on a
  direct request. *Rejected:* routing all lost-access detection through the
  git endpoints — redundant with the change-check and more fragile.
  *Rationale:* minimal, correctness-complete change; realises workflow 8's
  generic "a request refused" for both request kinds without reworking the
  engine.
- **No new durable state.** *Chosen:* read the `gone` phase from the live
  reducer `sync` slice, as the shelf badge does. *Rejected:* persisting a
  per-book lost-access flag in IndexedDB — none exists today, sync state is
  deliberately in-memory/derived (`sync-engine.js` header L32–33), and a
  reload simply re-derives `gone` from the next change-check. *Rationale:*
  reuses the settled state model; adds no store.
- **The notice lives on the book detail, not the song reader.** *Chosen:* the
  explanatory notice and the escape offers render on the per-book detail
  (`BookDetail.jsx`), where Download and the role chips already live; the
  reader stays plainly readable with no new chrome. *Rejected:* a banner on
  every song of a `gone` book — noisy, and workflow 8 frames the offer as
  "the book offers", i.e. book-level. *Rationale:* matches the W11 board
  (the offer is a book-level surface) and the shelf badge already signals the
  state everywhere the book is listed.

## Open questions

(none — all decided.)

One boundary is surfaced for the orchestrator's parking lot, not encoded as
scope: when an **editor is lowered to reader** (still a member) with commits
already made but not pushed, a push now 403s and the engine keeps it on
`saves_waiting`, retrying a push that can never succeed. Workflow 10 L83–85
says that user "is told those saves can no longer go to the book, and is
offered a fork or the download". Whether that surface is `books.fork`'s
"saving where one cannot" entry or a small distinct engine/UI change is a
product-judgment call best made when `books.fork` is scheduled; this task
deliberately leaves the 403 path unchanged.

## Status

**Done** — 2026-10-13.

- `app/src/worker/access-refused.js` (new) — pure classifier `isAccessRefused(err) → boolean`: true for a 404 git-http error, false for 403, missing response, or 5xx; the one lost-access authority in the Worker.
- `app/src/worker/access-refused.test.js` (new) — 5 unit tests: 404 → true; 403, offline, 5xx → false.
- `app/src/worker/sync-engine.js` (edit) — classifies a definite 404 on fetch or push as `gone` (same halt the change-check `gone` drives); a 403 push stays on `saves_waiting`.
- `app/src/worker/sync-engine.test.js` (edit) — two new unit cases: 404 push on a book with unpushed commits goes `gone` and keeps them; 403 push stays `saves_waiting`.
- `app/src/worker/protocol.js` (edit) — `CommandKind.FORK_BOOK` seam for the fork offer.
- `app/src/books/BookDetail.jsx` (edit) — when `sync` phase is `gone`, renders a *no longer shared with you* notice (`role="status"`) and the fork offer alongside the existing Download card.
- `app/src/books/BookDetail.behavior.test.jsx` (edit) — 8 behavior tests (gone notice present, readable, both offers keyboard-reachable, axe; negative case).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` (edit) — `books.lostAccessTitle` / `books.lostAccessBody` in all four locales; `saveSheet.makeYourOwn` reused (the key lives there, not `books.makeYourOwn`).
- `e2e/web/tests/lost-access.spec.js` (new) — e2e-web on phone, tablet and computer: owner removes editor via API seam; member's device shows *no longer shared with you*; song readable; Download and fork offered; axe on all three viewports.

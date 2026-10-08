# sync.states — States on the shelf

## TaskJuggler

[`tasks/45-sync.tji:21`](../../45-sync.tji) — `task states "States on the
shelf"`, under `task sync`. `effort 1d`, `allocate team`, `depends !engine,
foundation.e2e_web`. Through the parent `task sync` it also inherits
`storage.working_copy`, `cifra_js.merge` and `foundation.e2e_api`.

Downstream, `sync.read_in_place` `depends !states` (a song open while a sync
changes it reuses the per-book state atom this task settles); and the
orchestrator asked this task to settle the state-atom shape so
`sync.unsaved` and `sync.lost_access` build on it without re-guessing.

## Effort estimate

**1d.** The engine already emits every fact (`sync.engine`, Done 2026-10-07);
the shelf already draws a render-when-present badge slot (`books.shelf`
Decision 5). This task is the thin layer between them: a pure derivation from
the engine's six `phase` values to the four workflow-8 display words, wired
into the Books screen's existing slot, plus the header *quiet mark* and the
*Sync now* control the mockup draws. The one new seam is *offline since* —
the engine leaves `lastInStep` unset, and this task fills it in (a few lines
in the Worker, held in memory). No new screens; the badge, the classes and
the copy pattern all exist.

## Repository

**estante-de-cifras**, app only. The note does not start with `cifra.md:`. The
derivation module is framework-free ESM on the main thread (the view mirrors
the Worker through the store — DIRECTION §3.7 L421–425); the rendering is in
the existing Books screen (the only layer that knows React — §3.7 L426–428);
one small Worker change completes the `lastInStep` fact. No cifra.md change,
no service change. The app and the service share no code (DIRECTION §3.6).

Directories / files that change:

- `app/src/sync-display.js` (new) — the pure derivation. `syncDisplayFor(entry,
  { t, now }) → { kind, word, cls, dot, count?, since? } | null` (null ⇒ *in
  step*, render nothing) and `anyOutOfStep(syncSlice) → boolean` for the
  header mark. Framework-free; the only sync-word authority on the main
  thread.
- `app/src/sync-display.test.js` (new) — the unit level ("deriving each
  state").
- `app/src/books/BooksScreen.jsx` — read the reducer `sync` slice
  (`useSlice(store, 'sync')`) keyed by `bookId`, feed the per-book entry
  through `syncDisplayFor` into the existing `SyncBadge` slot (:101–113,
  :132); add the header *quiet mark* (`anyOutOfStep`) and the *Sync now*
  button (sends `CommandKind.SYNC { reason: 'sync-now' }`).
- `app/src/books/book-display.js` — retire the placeholder `syncStateFor`
  (:65–87, which read a never-populated `book.sync.value` on the *shelf*
  slice); its callers now read the real `sync` slice through
  `sync-display.js`.
- `app/src/books/BooksScreen.behavior.test.jsx` — extend with the behavior
  level (marks rendered, each carried by a word; axe).
- `app/src/books/books.css` — only if the header mark / *Sync now* row needs
  layout glue; the `.badge*` classes already exist in `theme.css`.
- `app/src/worker/sync-engine.js` — track the last *in_step* instant per book
  (in memory) and set `lastInStep` on the `offline` / `saves_waiting` facts it
  emits; the reducer field (reducer.js:125–133, :448–468) and the protocol
  comment (protocol.js:317–330) already reserve it.
- `app/src/worker/sync-engine.test.js` — one added unit case for the
  `lastInStep` fact.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — add `books.offline`,
  `books.offlineUnknown`, `books.noLongerShared`, `books.syncNow`,
  `books.notInStep`; the i18n parity test (`i18n.test.js`) requires the key in
  every locale.
- `e2e/web/tests/sync-states.spec.js` (new) — the e2e-web level.

## Inherited dependencies

Settled:

- **`sync.engine`** — Done 2026-10-07. Emits `EventKind.SYNC { bookId, phase,
  savesWaiting?, lastInStep?, at }` into a `sync` reducer slice keyed by
  `bookId`; `phase ∈ syncing | in_step | saves_waiting | offline | needs_you
  | gone` (protocol.js:317–330). The engine deliberately ships *facts, not the
  display word* — "that is `sync.states`" (engine.md Decisions L366–371). It
  reserves `lastInStep` but never sets it; "durable 'when last in step' is
  derivable and belongs to `sync.states`" (engine.md L378–381). `CommandKind.SYNC
  { reason }` is coalesced by the Worker's scheduler; *Sync now* reuses it with
  `reason: 'sync-now'` (engine.md L340–343; protocol.js:38–47).
- **`storage.shelf_surface`** — Done 2026-10-06. The `shelf` slice carries each
  book's `label`, `link`, `position` (shared) and `title`, `position`
  (local-only). It does **not** carry sync-state — that is the separate `sync`
  slice. `books.shelf` composes the row from `shelf.label` + browse-derived
  counts + this task's sync word.
- **`books.shelf`** — the Books screen (the "managing them is a screen of its
  own" destination, DIRECTION §4 L449–453). Its Decision 5
  (`tasks/refinements/books/shelf.md:372–377`) renders a labelled sync-state
  badge "when the slice carries a sync-state for it, and nothing when in step …
  The live source is `sync.states`"; this task is that live source (shelf.md
  L499–500).
- **`foundation.e2e_web`** — the Playwright harness at `e2e/web/` on the compose
  stack, with `lib/offline.js`, `lib/axe.js` and `lib/devices.js` (phone /
  tablet / computer). `tests/offline.spec.js` and `tests/books.spec.js` are
  working templates.

## What this task is

The layer that turns the engine's raw per-book sync facts into what a person
reads on the shelf. For each book the Worker reports a `phase`; this task maps
it to the one word workflow 8 prescribes — *syncing*, *N saves waiting to go
up*, *offline since …*, *needs you*, *no longer shared with you* — shown only
when the book is not *in step*, and nothing when it is. It adds the single
*quiet mark* in the Books header that appears whenever any book is out of
step, and the *Sync now* control the mockup draws there. It also completes the
*offline since {time}* fact the engine left open: the Worker remembers when a
book was last in step and reports it, so *offline* can say since when.

The derivation is a pure module — a state atom any surface can render — so the
song-screen surfaces that `sync.unsaved`, `sync.read_in_place` and
`sync.lost_access` own can consume the same atom without re-deriving the word.

## Why it needs to be done

The engine is the single source of sync truth, but nothing reads its `sync`
slice: today the Books screen renders a placeholder (`syncStateFor` over a
`book.sync.value` register that `shelf_surface` never populates, with a stale
three-word vocabulary `syncing | unsaved | conflict`). So sync runs invisibly
— a person has no way to see that saves are waiting, that a book is offline, or
that one *needs you*, and no way to ask for a sync now. This task lights the
slot `books.shelf` drew (Decision 5) with the real engine facts and the
correct workflow-8 words, and settles the state-atom shape the remaining
`sync.*` UI leaves build on.

## Inputs / context

Normative:

- **`docs/workflows/08-sync.md`** — "What the shelf says" (L26–38): each book
  has one state, *shown only when it is not* in step (L28); the five states —
  *syncing* (L30), *N saves waiting to go up* — offline or unreachable (L31),
  *offline*, with when the book was last in step (L32), *needs you* — a
  conflict (L33), *no longer shared with you* (L34); the header shows *one
  quiet mark when any book is not in step, and nothing otherwise* (L36–37);
  *Sync now* is on the book-management screen, and pulling down on search does
  the same (L37–38). A lost race leaves the book *syncing* (L59–62). Losing
  access turns the book *no longer shared with you* (L65–69).
- **`docs/DIRECTION.md`** — §3.7 the Worker owns the data and the interface
  mirrors it through store slices read with `useSyncExternalStore`, "only what
  shows it moves" (L418–425); the view is the only React layer (L426–428); §4
  the three destinations, Books being where books are managed (L447–453); §1
  offline first (a failed sync surfaces no error; the state simply says so).
- **`docs/mockups/README.md:26`** — "Every status badge carries a word, never
  colour alone." The binding accessibility rule for every state here.
- **`docs/mockups/W08-sync.dc.html`** — the shelf drawn with states. Phone
  Books header with the sync mark (`svg role="img" aria-label="Some books are
  not in step"`, `var(--ink-2)`) and the *Sync now* button (L29–35); per-book
  `<sc-if b.hasState>` badge (L42, L48 "Books in step say nothing"); desktop
  side pane the same (L160–174). The canonical word+class render data
  (L239–242): `syncing` (no class), `2 saves waiting to go up` (`unsaved`),
  `offline since 09:40` (no class), `needs you` (`conflict dot`).
- **`docs/mockups/theme.css:175–197`** — the badge classes: `.badge` neutral
  (surface-2 / ink-2 — *syncing*, *offline since …*), `.badge.unsaved`
  (*N saves waiting to go up*), `.badge.conflict` (*needs you*, *no longer
  shared with you*), `.badge.dot::before` the 7px dot modifier, `.badges` the
  wrap container.
- **`docs/mockups/GUIDE.md:36`** ("Status (always a word)") and **:106** (the
  sync and offline/cloud-off SVG paths for the header mark).
- **`tasks/refinements/books/shelf.md`** — the row anatomy and the
  render-when-present slot (L234–261, L372–377, L499–500).

Code seams:

- `app/src/worker/protocol.js:317–330` — `EventKind.SYNC { bookId, phase,
  savesWaiting?, lastInStep?, at }`, the six phases, "a word (never colour
  alone)"; `:38–47` `CommandKind.SYNC { reason }`, `reason` includes
  `'sync-now'`.
- `app/src/worker/reducer.js:125–133` — `sync: {}` keyed by `bookId`, each
  entry `{ phase, savesWaiting, lastInStep, at }`, per-book referential
  stability; `:448–468` the whole-entry-replace fold (an omitted field
  resets, does not linger).
- `app/src/worker/sync-engine.js:271–273` — `emitFact(bookId, phase, …extra)`;
  emit sites `:286–415`. `in_step` carries `at` only; `offline` /
  `saves_waiting` carry no `lastInStep` today — the gap this task fills.
  `logic.js:511` wires `emit → EventKind.SYNC`; `logic.js:1064–1075` the
  `CommandKind.SYNC` handler (`scheduler.trigger()`, fire-and-forget).
- `app/src/worker/useStore.js:15–21` — `useSlice(store, name)` over
  `useSyncExternalStore`; `store.js` the store; the hook a shelf indicator
  uses: `useSlice(store, 'sync')`.
- `app/src/books/BooksScreen.jsx:280–281` (`useSlice(store, 'shelf')`,
  `orderedBooks`), `:101–113` `SyncBadge`, `:119–148` `BookRow`, `:325–346`
  the list; `app/src/books/book-display.js:65–87` the placeholder
  `syncStateFor` to retire.
- `app/src/sync-triggers.js:29–48`, `app/src/main.jsx:36` — the existing
  automatic `SYNC` senders (`'foreground'`, `'online'`); the precedent for a
  `'sync-now'` send from a control.
- `app/src/i18n/locales/en.js` `books` block — `syncing`, `savesWaiting`
  (`{ one, other }` plural by `count`), `needsYou` already present; the new
  keys join them in all four locales.

Test harness:

- `e2e/web/tests/offline.spec.js`, `e2e/web/lib/offline.js` — going offline and
  back on the stack; `e2e/web/lib/axe.js`, `e2e/web/lib/devices.js` — axe and
  the three viewports.
- `app/src/books/BooksScreen.behavior.test.jsx`, `book-display.test.js` — the
  Testing-Library + store-double pattern to extend.

## Constraints / requirements

- **The engine owns the facts; this task owns the word.** The derivation reads
  the `sync` slice and the one new `lastInStep` fact; it invents no sync state
  and stores none of its own. The Worker stays the single source of sync truth
  (engine.md L366–371; DIRECTION §3.7).
- **Status by a word, never colour alone** (mockups README:26). Every state is
  a word in a `<span class="badge …">`; the class only adds colour, the header
  mark is an `svg role="img"` with an `aria-label`. Testing Library queries by
  text, axe passes at WCAG 2.1 AA.
- **Shown only when not in step.** `in_step` renders nothing on the book;
  the header mark and `anyOutOfStep` are false when every book is in step
  (workflow 8 L28, L36; mockup L48).
- **Songbooks only.** The home book (`HOME_BOOK_ID = 'home'`) emits sync facts
  too, but it is personal state, not a shelf book; the per-book badges and
  `anyOutOfStep` consider shelf books only and exclude `home` (DIRECTION §3.2;
  workflow 8 "each book" = the shelf).
- **Offline first.** A book being offline, unreachable or out of step is a
  calm statement of fact, never an error dialog; *Sync now* fires a trigger and
  returns immediately (the scheduler coalesces); nothing blocks on the network
  (DIRECTION §1).
- **Keyboard and RAC.** *Sync now* is a React Aria `Button` on the keyboard
  path; the header mark is non-interactive. Overlays, if any, honour the `.est`
  portal container ([[rac-overlays-portal-outside-est-theme-root]]).
- **No new runtime dependency, no new IndexedDB store, no migration.**
  `lastInStep` is held in Worker memory and emitted, matching the engine's "no
  status table" decision (engine.md L378–381).
- **No song text, no secrets in any log** — unchanged; this task adds no
  logging.

## Acceptance criteria

The task delivers:

1. **Each state derived to its workflow-8 word.** `syncDisplayFor` maps
   `in_step → null`; `syncing → "syncing"` (`.badge`); `saves_waiting →
   "{count} save(s) waiting to go up"` (`.badge.unsaved`, plural by count);
   `offline → "offline since {time}"` when `lastInStep` is known, else
   `"offline"` (`.badge`); `needs_you → "needs you"` (`.badge.conflict.dot`);
   `gone → "no longer shared with you"` (`.badge.conflict.dot`) (workflow 8
   L28–34; mockup L239–242; theme.css L175–197).
2. **The quiet mark.** The Books header shows one mark (the sync SVG,
   `aria-label` *Some books are not in step*) when any shelf book is not in
   step, and nothing when all are (`anyOutOfStep`, excluding `home`; workflow
   8 L36–37; mockup L29–35).
3. **Sync now.** A React Aria `Button` in the Books header sends
   `CommandKind.SYNC { reason: 'sync-now' }` and returns at once (workflow 8
   L37; engine.md L340–343; mockup L33–35, L164).
4. **Offline since {time}.** The Worker remembers the last *in_step* instant
   per book and sets it as `lastInStep` on `offline` / `saves_waiting` facts;
   before any in-step this session it is null and the book reads plain
   *offline* (engine.md L378–381; workflow 8 L32).
5. **Wired to the live slice.** The Books screen reads the reducer `sync`
   slice keyed by `bookId` (not the retired `book.sync.value` placeholder) and
   renders the badge render-when-present (books.shelf Decision 5; DIRECTION
   §3.7).

Tests it lands with (the note names unit, behavior, e2e-web):

- **unit — `app/src/sync-display.test.js`** ("deriving each state"): each of
  the six phases maps to the word + class + dot above; `in_step` → null;
  `saves_waiting` picks singular vs plural by `count` (1 vs 2); `offline`
  reads "offline since HH:MM" with a known `lastInStep` and "offline" without;
  `gone` → "no longer shared with you"; `anyOutOfStep` is true iff some
  non-`home` book is out of step and false when all in step. Pins workflow 8
  L28–37, mockup L239–242, theme.css L175–197.
- **unit — `app/src/worker/sync-engine.test.js`** (one added case): an
  `offline` (and `saves_waiting`) fact emitted after an `in_step` carries
  `lastInStep` equal to that in-step instant, and `null` when the book was
  never in step this session. Pins engine.md L378–381 / workflow 8 L32.
- **behavior — `app/src/books/BooksScreen.behavior.test.jsx`** (Testing
  Library + store double, with an axe check): with a `sync` slice carrying a
  different phase per book, the shelf renders each state's word (queried by
  text, not colour); an `in_step` book shows no badge; the header mark is
  present (by its `aria-label`) when any book is out of step and absent when
  all are in step; *Sync now* is reachable by keyboard and sends
  `CommandKind.SYNC { reason: 'sync-now' }`; axe clean at WCAG 2.1 AA. Pins
  workflow 8 L28–37, README:26, books.shelf Decision 5, DIRECTION §3.7.
- **e2e-web — `e2e/web/tests/sync-states.spec.js`** (Playwright, phone /
  tablet / computer, against the compose stack): a device with a hosted book
  goes offline (`lib/offline.js`); the shelf shows *offline since …* / *N
  saves waiting to go up* and the header quiet mark; the network returns and a
  sync runs; the states clear to in step (no badge, no header mark); *Sync
  now* fires a pass; axe clean on the shelf in each state on every viewport.
  Pins workflow 8 L28–38; DIRECTION §1, §3.7. Songs written for the purpose.

## Decisions

- **One pure derivation module (`sync-display.js`), rendered by the shelf.**
  *Chosen:* a framework-free `syncDisplayFor` + `anyOutOfStep` on the main
  thread, unit-tested in isolation, consumed by the Books screen (and later by
  the song-screen surfaces). Matches the engine's split — "the engine ships
  facts, the shelf ships presentation" — and `books.shelf` Decision 5's
  render-when-present slot. *Rejected:* deriving the word in the engine (the
  engine explicitly declined it, engine.md L369–371); deriving it inline in the
  JSX (not reusable by the song screen, and the note's unit level is "deriving
  each state", which wants a pure function).
- **A structured state atom, not a formatted string.** *Chosen:* return
  `{ kind, word, cls, dot, count?, since? } | null` so `sync.unsaved`,
  `sync.read_in_place` and `sync.lost_access` can render the same atom on the
  song screen (and extend `kind`) without re-deriving. *Rejected:* returning
  the finished `<span>` or a bare string — forces each surface to re-parse the
  class/dot and blocks the atom's reuse the orchestrator asked to settle.
- **`lastInStep` completed in the Worker, held in memory.** *Chosen:* the
  engine remembers the last `in_step` instant per book and attaches it to
  `offline` / `saves_waiting` facts; the reducer field and protocol comment
  already reserve it, so the derivation stays pure over the slice. Keeps the
  Worker the single source of sync truth. *Rejected:* a main-thread
  accumulator watching the slice — splits sync truth off the data owner and
  makes "deriving each state" a stateful, not pure, test; a durable
  last-in-step store — a new IndexedDB table the engine already rejected
  (engine.md L378–381). The cost is that a cold open while offline, never
  having reached in step this session, shows plain *offline* without a time —
  honest, and the next reachable pass restores the timestamp.
- **The quiet mark and *Sync now* live in the Books header, as drawn.**
  *Chosen:* both render in the Books-destination header (mockup W08 L29–35,
  L160–174), owned by `books.shelf`. *Rejected:* a cross-destination
  app-chrome mark visible from Search — not drawn anywhere, and introducing it
  would be an undrawn design addition in a 1d task; the mockup places the mark
  on the shelf.
- **Pull-to-refresh on search is deferred.** *Chosen:* this task ships the
  drawn, keyboard-accessible *Sync now* button; the equivalent pull-down
  gesture on the Search screen (workflow 8 L37–38) is a separate touch
  interaction with no keyboard analogue and its own e2e. Deferred to
  `sync.pull_to_refresh` (closer registers in WBS). *Rejected:* building the
  gesture here — it widens a 1d task into touch-gesture handling and a second
  e2e surface without sharing code with the button.
- **The song-screen sync rendering stays with the tasks that own those
  surfaces.** *Chosen:* this task delivers the shared state atom and the shelf
  rendering; the song appbar's sync/merge surfaces (*unsaved changes*, the
  *updated by …* notice) are drawn for and owned by `sync.unsaved` and
  `sync.read_in_place`, which consume this atom. *Rejected:* rendering a sync
  badge in the song appbar here — the only song-screen sync surfaces the
  mockup draws belong to those tasks (W08 tablet L93–102); adding another would
  overlap and be undrawn. The orchestrator's ask — "settle the shape so
  `sync.unsaved` and `sync.lost_access` can build on it" — is met by the atom,
  not by this task rendering their surfaces.
- **"no longer shared with you" uses `.badge.conflict.dot`.** *Chosen:* the
  `gone` phase is an attention state like *needs you*; theme.css offers
  `{unsaved, conflict, ok, voiced}` and conflict's colour fits, the word
  carries the meaning (README:26). *Rejected:* a new badge class — unneeded;
  the word, not the colour, is normative, and `sync.lost_access` owns the
  fuller losing-access affordances (readable / fork / download) on top of this
  mark.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- `app/src/sync-display.js` (new) — pure `syncDisplayFor(entry, { t, now })` derivation and `anyOutOfStep(syncSlice)` for the header mark; framework-free, the sole main-thread sync-word authority.
- `app/src/sync-display.test.js` (new) — unit tests for all six phases, null for `in_step`, singular/plural `saves_waiting`, `offline` with and without `lastInStep`, `anyOutOfStep` true/false.
- `app/src/books/BooksScreen.jsx` — reads `useSlice(store, 'sync')` keyed by `bookId`, feeds each entry through `syncDisplayFor` into the `SyncBadge` slot; adds header quiet mark (`anyOutOfStep`) and *Sync now* button (`CommandKind.SYNC { reason: 'sync-now' }`).
- `app/src/books/book-display.js` — retired the placeholder `syncStateFor` (`book.sync.value` register never populated by `shelf_surface`).
- `app/src/books/book-display.test.js` — updated to match retirement of `syncStateFor`.
- `app/src/books/BooksScreen.behavior.test.jsx` — extended with behavior tests: each phase's word rendered, `in_step` shows no badge, header mark present/absent by `anyOutOfStep`, *Sync now* keyboard-reachable and fires `CommandKind.SYNC`, axe-clean.
- `app/src/books/books.css` — layout glue for header mark and *Sync now* row.
- `app/src/worker/sync-engine.js` — tracks last `in_step` instant per book in memory; sets `lastInStep` on `offline`/`saves_waiting` facts.
- `app/src/worker/sync-engine.test.js` — added unit case: `offline`/`saves_waiting` after `in_step` carries the timestamp; null when book was never in step.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — added `books.offline`, `books.offlineUnknown`, `books.noLongerShared`, `books.syncNow`, `books.notInStep`.
- `e2e/web/tests/sync-states.spec.js` (new) — e2e-web: in-step shelf shows no badge / no header mark (axe-clean on all three viewports); *Sync now* keyboard-reachable and fires a Worker round-trip returning with no error dialog.
- Hosted-book positive journey (offline→online state transitions) surfaced as seam-gated follow-up `sync.states_e2e_hosted` (depends on `books.add_by_link`).

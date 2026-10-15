# shell.routing_rename_across_reload — A fork's new book id reaches history entries from before a reload

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) — `task routing_rename_across_reload`
(lines 71–76), under `shell`; a dependency of `milestones.m5_complete`
(`tasks/99-milestones.tji:44`).

## Effort estimate

1d.

## Repository

The app only: `app/src/shell/` (a new `book-renames.js` and its unit test,
`use-place-history.js`, the routing behavior test) and `e2e/web/tests/`
(`routing.spec.js`). Nothing under `cifra.md/`, `service/` or `api/`.

## Inherited dependencies

- `shell.routing` — **settled** (complete 2026-10-15,
  `tasks/refinements/shell/routing.md` §Status). It built
  `usePlaceHistory`, its in-memory `renameBook`, and registered this task as
  its fixer-1 follow-up.
- Not in `depends` but needed to drive the e2e journey, all **complete**:
  `books.fork` (the make-it-your-own sheet, `BOOK_FORKED`), `books.add_by_link`
  (Bia joins through an invitation), `books.online` and `account.sign_in`
  (Ana's hosted book, `hostedBookWithSong`).

## What this task is

When a book's id changes under an open place — a fork (`BOOK_FORKED`) or a
put-online (`BOOK_ONLINE`) — `usePlaceHistory.renameBook` replaces the current
history entry with the new id's address and remembers *old id → new id* so
that an older entry, when Back lands on it, is read as naming the new id.
That memory is a `useRef(new Map())`
(`app/src/shell/use-place-history.js:91-94`): a reload empties it, while the
browser keeps the older entries whose `history.state` still names the old id.
Back after a fork and a reload then lands on an address for a book no longer
on this device and shows the not-here screen ("This link doesn’t open a
book") instead of the fork. This task persists the rename record for the
life of the tab's session history (`sessionStorage`), reads it back when the
hook mounts, and so makes Back land on the fork across a reload.

## Why it needs to be done

DIRECTION §3.7 "The address follows where you are" (`docs/DIRECTION.md:475-482`)
promises that a reload and the browser's or Android's back land where the
person was; workflow 7 §Links to books (`docs/workflows/07-add-a-book.md:45-48`)
says "Reloading, bookmarking or going back lands there again". A person who
forks a book they read (workflow 11) or puts their own book online
(workflow 7 §Putting a book online), reloads, and presses Back today meets a
screen saying the link does not open a book — for a book that is right there
on their shelf under its new id. It is the last gap in `shell.routing`'s
rename handling and a dependency of M5.

## Inputs / context

- `app/src/shell/use-place-history.js`
  - `:26-28` the header's promise for `renameBook`.
  - `:51-62` `renamePlace(place, rename)` — the pure id rewrite of a place.
  - `:91-94` `renamesRef` — the in-memory record this task persists.
  - `:142-190` the `popstate` handler: `:148-156` resolves an id through the
    record (a chain, with a cycle guard), `:157-165` rewrites the landed
    entry's `history.state` when the id changed.
  - `:202-213` `renameBook(previousBookId, bookId)` — sets the record
    (`set(previous, new)`, `delete(new)`), forces the next change to replace,
    and rewrites the in-memory `stackRef`.
- `app/src/shell/AppShell.jsx:528-557` — `followBookId` calls `renameBook` on
  `BOOK_FORKED` and `BOOK_ONLINE`; `:263` boots from `bootEntry`; `:491-497`
  the hook's wiring.
- `app/src/shell/AppShell.routing.behavior.test.jsx` — `:80-93` the
  `beforeEach`/`afterEach` (URL reset, `matchMedia`), `:56-63` `traverse`
  (await the popstate), `:237-247` *a fork or put-online follows the address*,
  `:249-262` *back after a fork lands on the fork, not the book it left* —
  the same scenario without a reload, the template for the new cases;
  `:277` the axe case's shape.
- `e2e/web/tests/routing.spec.js` — the routing journeys on the three
  viewports; `e2e/web/tests/fork.spec.js:110-154` — *saving where one cannot*,
  the real-UI fork path this task's journey reuses;
  `e2e/web/lib/journeys-fork.js` (`biaJoins`, `forkSheetTitle`),
  `e2e/web/lib/journeys-share.js:45` (`hostedBookWithSong`),
  `e2e/web/lib/journeys.js:237` (`scopeToBook`), `openSongInEditor`,
  `gotoTab`; `e2e/web/lib/journeys-edit.js` (`addSection`).
- `app/src/shell/NotHere.jsx` — the not-here *book* state the bug lands on.
- `tasks/refinements/shell/routing.md` — Decision 5 (History API under the
  app's own module; the URL is view state, the Worker never sees it),
  Decision 8 (`BOOK_ONLINE` follows like a fork), §Constraints "A reload
  honours the URL only".

## Constraints / requirements

- **The record is view state, on the main thread.** It lives in
  `sessionStorage` (book ids only), next to the History API it complements;
  the Worker never sees it and IndexedDB is not touched (DIRECTION §3.7, the
  standing *offline first* rule — the main thread never touches IndexedDB).
- **Scope matches the session history.** `sessionStorage` is per tab and
  survives a reload, exactly as the tab's history entries do; a new tab starts
  with neither. Nothing is persisted across tabs or devices.
- **The record holds book ids only** — never a title, a path, song text or a
  token.
- **Storage failure degrades to today's behavior, never a crash.** Reading
  (absent, malformed JSON, wrong shape) yields an empty record; reading or
  writing that throws (storage disabled, quota, `SecurityError`) is caught,
  and the in-memory record keeps working for the session.
- **Semantics unchanged.** The record keeps `renameBook`'s rule
  (`set(previous, new)`, then `delete(new)`), and resolution follows a chain
  with the existing cycle guard. The current entry is still replaced, never
  pushed; layers are still never reopened by `popstate`.
- **The reload skip still applies.** The landed-entry rewrite and the
  dead-same-address skip (`use-place-history.js:166-184`) see the renamed
  place, as they do without a reload.
- **Accessibility.** No new UI; the screen Back lands on (the fork's songs) is
  axe-clean at WCAG 2.1 AA.
- Test songs and book names are written for the purpose (the fixtures already
  in the routing and fork tests).

## Acceptance criteria

**Behavior delivered.** In one tab: open a book's songs, open a song in it,
fork the book (or put it online), reload, press Back (in-app or the
browser's) — the app lands on the fork's songs at `/b/<fork id>`, the scope
chip naming the book, never the not-here screen; the entry is rewritten to
the fork's address. The same holds after any number of reloads, and for a
chain of renames (fork, then put-online of something else, or fork then
fork again).

**Implementation.**

1. `app/src/shell/book-renames.js` — a small pure module over a
   `Storage`-like object (injected, so tests pass a fake):
   - `readRenames(storage)` → a `Map` of old id → new id from one key
     (`estante.bookRenames`, a JSON array of `[old, new]` pairs); empty on
     absent, malformed or non-string entries, or on a throw.
   - `recordRename(map, previousBookId, bookId)` → applies
     `set(previous, new)` / `delete(new)` (the rule moved out of
     `renameBook`).
   - `writeRenames(storage, map)` → writes the key; a throw is swallowed.
   - `resolveBookId(map, id)` → the chain walk with the cycle guard (moved
     out of the `popstate` handler).
2. `use-place-history.js` — `renamesRef` initialised from
   `readRenames(sessionStorage)` (guarded when `sessionStorage` is
   undefined); `renameBook` records and writes; `popstate` resolves through
   `resolveBookId`. The header comment (`:26-28`) says the record outlives a
   reload.

**Tests, by level.**

- **unit** — `app/src/shell/book-renames.test.js` (Vitest, a fake storage
  object):
  - *the rename record read back after a simulated reload*: record
    `b1 → fork-1` and write it; a fresh `readRenames` on the same storage
    resolves `b1` to `fork-1` (the task's `Tests:` clause; DIRECTION §3.7
    "The address follows where you are").
  - a chain `b1 → fork-1 → sr_x` resolves `b1` to `sr_x`; a cycle
    (`a → b`, `b → a` via a hand-written value) terminates.
  - `recordRename` drops a record whose old id is the new id
    (`renameBook`'s `delete(new)`).
  - absent key, malformed JSON, a non-array, and pairs that are not two
    strings → an empty map; a storage whose `getItem`/`setItem` throws →
    empty map and no throw.
- **behavior** — `app/src/shell/AppShell.routing.behavior.test.jsx`, with
  `sessionStorage.clear()` added to its `beforeEach` (and to
  `AppShell.behavior.test.jsx`'s, so no record leaks between files' cases):
  - *back after a fork and a reload lands on the fork, not not-here*: boot at
    `/b/b1`, open the song from search, emit `BOOK_FORKED`
    (`b1 → fork-1`) and the shelf with the fork only; `cleanup()` and render a
    fresh `AppShell` on a fresh store (the reload: same `location`, same
    `history`, same `sessionStorage`), emit the shelf; Back → `location`
    is `/b/fork-1`, the searchbox shows, no "doesn’t open a book" heading;
    axe (`checkWcag21aa`) clean on the landed screen. Pins DIRECTION §3.7,
    workflow 7 §Links to books L45–48.
  - *back after a put-online and a reload lands on the new id*: the same with
    `BOOK_ONLINE` (`b1 → sr_online`) — `routing.md` Decision 8.
  - The existing *back after a fork lands on the fork* (`:249`) keeps
    passing unchanged (no reload).
- **e2e-web** — `e2e/web/tests/routing.spec.js`, new test *back after a fork
  and a reload lands on the fork*, on phone, tablet and computer (the
  harness's three projects), through the real UI only:
  `hostedBookWithSong(page, BOOK, SONG)` for Ana; `biaJoins(browser, page,
  { role: 'Reader', … })`; on Bia's page: `gotoTab('Search')`,
  `scopeToBook` (URL `/b/<original>`, kept), `openSongInEditor`,
  `addSection`, Save → the cannot-save sheet → *Make it my own* → the save
  form's Save (the steps of `fork.spec.js:121-135`); the URL now names a
  different book id. `bia.page.reload()` — the song is still open; then
  `goBack()` → URL matches `/b/<id>` and is not the original's, the scope
  chip shows the book, no "This link doesn’t open a book" heading; axe on
  that screen. Book and song names written for the test; `test.setTimeout`
  as `fork.spec.js` does. Pins DIRECTION §3.7, workflow 7 §Links to books,
  workflow 11 (the fork takes the original's place). The three existing
  routing journeys keep passing.

Every test above runs in the gate (`app` Vitest, `e2e/web` Playwright); none
is deferred.

## Decisions

1. **`sessionStorage`, one key, book ids only.** The record must live exactly
   as long as the tab's session history: `sessionStorage` is the browser
   store with that lifetime (per tab, survives reload, copied on tab
   duplication along with the history). *Rejected:* carrying the record in
   every entry's `history.state` — entries written before the rename never
   carry it, and an entry landed on without a rename is not rewritten, so a
   reload on such an entry would lose the record again; making it reliable
   means rewriting every landed entry. *Rejected:* `localStorage` — it
   outlives the session history and is shared across tabs, so it would
   rewrite ids for histories that never saw the rename. *Rejected:* resolving
   an old id through the Worker (a fork knows its original) — it would make
   the URL something the Worker sees (against `routing.md` Decision 5), does
   not cover put-online, and widens a session-history fix into a durable
   address-redirect feature nobody has decided.
2. **A pure `book-renames.js` module with injected storage.** The task's unit
   test reads the record back after a simulated reload; that is a pure
   function over a storage object, so it lives apart from the hook (as
   `place.js` does for addresses). The chain walk moves there with the record
   so the two cannot drift.
3. **The boot place is not passed through the record.** A rename replaces the
   current entry (`forceReplaceRef`), and `popstate` rewrites any entry it
   lands on, so a reload never starts on an entry of this session that still
   names the old id. An address typed or bookmarked with an old id is
   workflow 7's not-here case, unchanged.
4. **No pruning.** A session sees a handful of forks or put-onlines at most;
   the record dies with the tab. A size cap would add a rule with nothing to
   pin it.
5. **The e2e journey forks through *Save* in a reader's book, not the book
   detail's Fork card.** That path naturally leaves an older entry naming the
   original (`/b/<original>`) below the song, which is exactly what Back
   after the reload must resolve; the Fork card starts from the Books tab,
   whose entries do not name the book. Put-online gets behavior coverage
   only: the hook path is identical (`followBookId` handles both events), and
   the note names the fork for e2e.
6. **No design delta.** DIRECTION §3.7 and workflow 7 already promise that
   going back lands where the person was; this task makes the code keep that
   promise across a reload.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- app/src/shell/book-renames.js: pure module over an injected Storage (`readRenames`, `recordRename`, `writeRenames`, `resolveBookId`), one `sessionStorage` key of old→new book-id pairs; failures degrade to an empty record.
- app/src/shell/use-place-history.js: the rename record is read from `sessionStorage` on mount, written by `renameBook`, and `popstate` resolves ids through `resolveBookId`; Back after a fork or put-online and a reload lands on the new id.
- app/src/shell/book-renames.test.js (unit, 13 tests): read back after a simulated reload, chain, cycle, `delete(new)` rule, absent/malformed/wrong-shape input, throwing storage.
- app/src/shell/AppShell.routing.behavior.test.jsx (behavior): back after a fork and a reload, and after a put-online and a reload, each with axe; `sessionStorage.clear()` added to the `beforeEach` here and in app/src/shell/AppShell.behavior.test.jsx.
- e2e/web/tests/routing.spec.js (e2e-web): back after a fork and a reload lands on the fork, passed on phone, tablet and computer, with axe.
- No tech-debt follow-up; no milestone change (m5_complete still has other open dependencies).

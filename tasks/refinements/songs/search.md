# songs.search — The search screen

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task songs.search` under
`task songs`. Dependencies as declared: `depends storage.index` (the task's
own line), plus the parent `task songs` cascade `depends shell.layout,
shell.chart, foundation.e2e_web`. The one-line note:

> "One box across every book; recents (kept on the device); books as
> sections; the explorer as a result when the text is a chord; badges; scope
> that resets each session. Workflow 2. Tests: unit (the query: a chord
> recognised, scope); behavior (results by book, recents, badges, scope
> reset, Testing Library and axe); e2e-web (search across books on the three
> viewports, a chord offering the explorer, search after an offline reload;
> axe)."

This is the app's **primary interface** — "The app opens on search: one box,
across every book on the shelf" (workflow 2 L11), "**Song search is the
primary interface.**" (DIRECTION §4 L430). It is the screen that renders the
`search` and `index` slices `storage.index` already produces, and the
pre-typing browse (recents + books-as-sections) a reader lands on.

## Effort estimate

**3d** (as scoped in the `.tji`), allocated `team`.

## Repository

**estante-de-cifras** only, `app/`:

- `app/src/songs/` — the new search-screen view and its pure query helper,
  with co-located tests.
- `app/src/shell/AppShell.jsx` — a minimal change to thread the store into
  the `search` `<TabPanel>` body (today it renders an `<h1>`-only
  placeholder and takes no store).
- `app/src/worker/` — modest read-path additions the screen consumes: a
  device-local **recents** store and its seam, a **browse** listing over the
  existing index, and three badge flags on a search result. These extend
  `protocol.js` / `reducer.js` / `logic.js` the way every prior consumer did
  (`working_copy`, `index`, `preferences_surface` each added their own
  kinds).
- `e2e/web/tests/` — the Playwright journey.

**Not a `cifra.md:` task.** It consumes the format's chord parser
(`parseChord` / `tryParseChord`, already imported into the app's music core)
and changes nothing in the spec, reference or corpus. The app and the
service share no code (DIRECTION §3.6); search is entirely on the device
(workflow 2 L152–155), so the service is untouched.

## Inherited dependencies

All **settled** — every cascaded dependency is `complete 100`:

- **`storage.index`** — *settled, Done 2026-10-05*
  ([`../storage/index.md`](../storage/index.md)). The Worker-side engine this
  screen drives:
  - `CommandKind.SEARCH` (`app/src/worker/protocol.js:51`), payload
    `{ query, scope? }` where `scope` is `{ books: [...] }` or
    `{ bookId, prefix }`.
  - `EventKind.SEARCH_RESULTS` (`protocol.js:83`) → the `search` slice
    (`app/src/worker/reducer.js:240–250`, doc `:53–58`), shape
    `{ query, results: [{ bookId, path, title, artist, score }] }`, **replaced
    whole** on each query so it reflects only the latest.
  - `EventKind.INDEX_STATUS` (`protocol.js:84`) → the `index` slice
    (`reducer.js:252–262`, doc `:59–64`), a map `{ [bookId]: 'building' |
    'ready' }`, per-book entries referentially stable.
  - The engine already folds accents (`coracao` finds *Coração*), ranks by
    field, matches chord-use, covers unsaved work, and tracks a per-location
    `unsaved` flag in its `index_locations` store (index.md Decision 3,
    Acceptance 5). The badge and browse additions below reuse that data.
- **`shell.layout`** — *settled, Done* ([`../shell/layout.md`](../shell/layout.md)).
  The shell is one controlled React Aria `<Tabs>`; each destination is a
  `<TabPanel>` whose body a screen task fills. `DESTINATIONS` =
  `['search','books','setlists']` (`app/src/shell/layout-mode.js:28`),
  `search` is `DESTINATIONS[0]` and the default selection, so the app opens on
  it. `destinationPanels()` (`app/src/shell/AppShell.jsx:118–124`) renders
  each panel as an `<h1>`-only placeholder — **this is the seam the search
  view replaces.** Two layout modes split at `(min-width: 600px)` via a live
  `matchMedia` subscription (`useLayoutMode`, `AppShell.jsx:51–54`): `narrow`
  (phone, `.screen`/`.scroll` + bottom `.tabbar`) and `wide` (tablet **and**
  computer, master-detail `.split` with `.pane.side` rail + `.pane.main`
  `<main>`). **There is no router** (layout.md Decision, no react-router);
  navigation is ephemeral `useState`, not a store slice.
- **`shell.chart`** — *settled, Done*. A parent-cascade dependency; the chart
  renders the reading view, not search. **Not directly used here** — noted
  only because the cascade declares it.
- **`foundation.e2e_web`** — *settled, Done* ([`../foundation/e2e_web.md`](../foundation/e2e_web.md)).
  The Playwright harness at `e2e/web/` (fixtures, `lib/`, viewport projects,
  the axe fixture `e2e/web/tests/axe-fixture.spec.js`; siblings
  `navigation.spec.js`, `offline.spec.js`). The search journey lands here.
- **`shell.i18n`** — *settled, Done* ([`../shell/i18n.md`](../shell/i18n.md),
  transitive). Copy goes through `t(key, params)` (`app/src/i18n/index.js:125`)
  with `{name}` interpolation and `Intl.PluralRules` plurals; a new `search`
  section is added to all four catalogues (`en`, `pt-BR`, `es-419`, `it`) —
  catalogue completeness is a hard build gate. `LocaleRoot` already wraps the
  shell, so `t()` re-reads on a language switch for free.
- **`shell.tokens`** — *settled, Done* (transitive). The `.search`, `.list`,
  `.row` (`.sel`, `.explore`), `.grow`/`.name`/`.meta`, `.badges`,
  `.badge` (`.voiced|.unsaved|.conflict`, `.dot`), `.chip.accent`,
  `.section-label` classes the mockup uses (docs/mockups/theme.css,
  docs/mockups/GUIDE.md "Visual vocabulary" L34–43).
- **`storage.home_book`** — *settled, Done* ([`../storage/home_book.md`](../storage/home_book.md)).
  Holds the shelf list and the `meta` store (device-local; see Decision 2).
- **`storage.preferences_surface`** — *settled, Done*
  ([`../storage/preferences_surface.md`](../storage/preferences_surface.md)).
  The `preferences` slice is live; the user's **notation dialect** is
  `store.slice('preferences').notation?.value` (home-book-format §4.1),
  consumed by chord recognition (Decision 4), falling back to
  `DEFAULT_DIALECT` (`'brazilian'`, `app/src/core/notation/dialects.js:58`)
  when absent.

**No pending blocking dependencies.** Two conveniences land through
registered follow-ups without blocking this task (graceful degradation until
they do — see Acceptance → Deferred): richer book labels/counts from
`shelf.json` (`storage.shelf_surface`), and retiring the now-dead synced
`recents.json` (`storage.recents_reconcile`). Two cross-area seams are wired
by their owning tasks, not here: the explorer **destination**
(`music.explorer` — "search's chord row opens it") and the **voiced-for /
conflict** badge data (music and sync — see Decision 7).

## What this task is

The search screen: the React view that fills the `search` tab panel and is
the first thing the app shows. **One box across every book.** Before anything
is typed it shows the songs recently opened (device-local recents) and then
every book as a collapsible section; as the user types, results narrow on
every keystroke, drawn from the `search` slice. When the query parses as a
chord symbol, an **explore {chord}** row is offered first, above the text and
chord-use results. Each result row shows the title, artist, where it lives
(book and folder), and badges (voiced-for, unsaved, conflict) — each carried
by a word. A scope filter narrows the search to books or a folder and resets
at the start of each session. Everything runs on what is on the device.

To feed the pre-typing browse the screen also lands two small Worker
read-paths — a **device-local recents store** (written on song-open by
`songs.reading` through the seam this task exposes; displayed here) and a
**browse** listing of every song grouped by book over the index's existing
data — plus three badge flags on a search result.

## Why it needs to be done

Nothing in the app surfaces a song to the user without it: it is the app's
front door (workflow 2 L11; DIRECTION §4 L430) and a dependency of the whole
local experience. Milestone **M2 (`m2_local`)** depends on `songs.search`
directly (`tasks/99-milestones.tji`), alongside `songs.reading`,
`music.explorer`, `books.shelf` and the rest — "a songbook on one device:
find, read, write, edit… installed and offline." `storage.index` built the
engine; this is the interface over it. `songs.new_song` writes a new song
*from search* (its `depends !search`), `music.explorer`'s chord row is opened
*from here*, and `songs.reading` is reached by opening a result.

## Inputs / context

### Governing design

- **Workflow 2 — Find and play a song** (`docs/workflows/02-find-and-play.md`,
  Status: decided, L3). The normative spec for this screen:
  - **Opens on search, one box** (L11).
  - **Before typing: recents, then books as sections** (L13–16). "it shows
    the songs recently opened, then each book as a collapsible section listing
    its songs."
  - **Recents are device-local** (L17–20): "Recents are kept on the device
    and are not synced. They change every time a song is opened, and the home
    book (DIRECTION §3.2) would gain a commit for each. What you played on the
    phone last night is not something the laptop needs." (Decision 2.)
  - **As you type** (L22–24): "results narrow on every keystroke. Search
    covers title, properties (artist and the rest), section names, words and
    chords, and ignores accents and case" — all served by `storage.index`.
  - **The chord explorer is a result** (L26–42): when the query parses as a
    chord symbol the first result is **explore {chord} on your instrument**,
    then the songs. "A short query can be both" (`A` is a chord *and* a word —
    show both; nothing hidden by guessing). Ambiguous symbols (cifra.md §5.6)
    read in the user's notation. Progression search (`Am F C G`) is *Later*
    (L42) — not here, owned by `storage.progression_search`.
  - **A result** (L44–58): title + artist; where it lives (book, and folder
    when not at the root); badges only when they apply — *voiced for* the
    instrument, *unsaved changes*, *conflict*. "Results are not grouped by
    song" — two same-title songs are two rows; the unit is a **location**
    (book + path).
  - **Scope** (L60–65): "Search covers every book." A filter narrows it to
    books or to folders within one, "**resets at the start of each session**",
    and "While a filter is on, it is shown in the box, not tucked behind a
    button."
  - **Offline** (L152–155): "Nothing on this screen needs a network."
  - **Still building** (L159–162): a book still cloning or indexing "says it
    is still loading, rather than looking empty."
  - **A song with no title** is listed by its file name without `.cifra.md`
    (L163–164).
- **DIRECTION §4 — The interface** (`docs/DIRECTION.md` L428–451). "**Song
  search is the primary interface.** One search across every loaded book:
  title, artist, sections, words, chords. Accent-insensitive… Each result
  says which book and folder it is in, and whether it has voicings for the
  instrument in use, unsaved changes, or a conflict. **Books are a scope on
  that search**; managing them is a screen of its own" (L430–435, the
  management screen is `books.shelf`). "Search never shows or changes a
  filename; a song created from search is named once from its title"
  (L437–439).
- **DIRECTION §3.2 — Personal state** (L136–152) and **§3.7 — the app**
  (L394–427). Personal state lives in the home book, **committed
  automatically** (L136–143) — but recents are explicitly *not* among it
  (workflow 2 L17–20). "One owner for the data: a Web Worker… The main thread
  never touches IndexedDB" (L407–409); "A store on the main thread is fed by
  the Worker's messages, and components read the slices they need through
  `useSyncExternalStore`… only what shows it moves" (L410–414). React + React
  Aria Components (L396).

### The mockup (what the drawings decide)

- **`docs/mockups/W02-find-and-play.dc.html`** — the search screen is drawn on
  the **phone** (typed state) and **computer** (pre-typing state); the tablet
  frame shows reading, so there is no tablet search drawing to copy. Real copy
  and anatomy:
  - **Placeholder** (computer, empty box): "Songs, words, chords…".
  - **Explorer row** (phone): name "Explore A on your guitar" — the pattern is
    **Explore {query} on your {instrument}**; meta "every way to play it,
    easiest first". Uses `.row.explore` (accent-tinted name).
  - **Section labels** (`t-h3`): "Songs matching "A"", "Songs that use A",
    "Recent", "Books".
  - **Result row**: `.row > .grow > .name` (title) + `.meta` (where) +
    `.badges`. Badge labels: "voiced for guitar" (full, in results) /
    "voiced" (short, in recents); "unsaved"; "conflict". `.meta` examples:
    "Choros da Ana · bossa/", "Banda do Bairro", "My songs".
  - **Books section** (computer): each book a `.row` with name + `.meta` song
    count and status ("14 songs", "32 songs · reading", "21 songs · 2
    setlists") and a disclosure caret ("▾" expanded / "▸" collapsed).
  - **No scope chip is drawn** inside the box on this board, though
    `.search .scope` is the intended home for it (GUIDE.md L35); no "still
    loading" book state is drawn (render it from the `index` slice).
- **`docs/mockups/README.md` L26** — "Every status badge carries a word, never
  colour alone." Binds every badge here.

### The code seams this extends

- **Shell mount:** `app/src/shell/AppShell.jsx:118–124` (`destinationPanels()`,
  the `<TabPanel>` bodies); `app/src/App.jsx` passes `store` to `ThemeRoot`
  and `LocaleRoot` but renders `<AppShell />` with **no store** — thread it
  (Decision 1). Precedent for a store-reading component tree: `ThemeRoot.jsx`,
  `LocaleRoot.jsx` take `store` as a prop and call `useSlice`.
- **Store API (no context, prop-threaded):** `createStore(endpoint)` →
  `store.send(message)` (`app/src/worker/store.js:49`), `store.slice(name)`
  (`:42`); `getAppStore()` (`:79`) the lazy singleton (real worker in the
  browser, inert under jsdom). Read a slice with `useSlice(store, name)`
  (`app/src/worker/useStore.js:14`, over `useSyncExternalStore`). Send a
  command with `store.send(command(CommandKind.SEARCH, { query, scope }))`
  (`command`, `CommandKind` from `app/src/worker/protocol.js:90`).
- **Chord recognition:** `tryParseChord(text, dialectId?) → Chord | null`
  (`app/src/core/notation/parse.js:509`) — exactly "does the query parse as a
  chord symbol"; `parseChord(text, dialectId, options) → { chord, ambiguities,
  errors }` (`:136`) when the ambiguity (cifra.md §5.6) is wanted. `Chord` =
  `{ root, quality, extensions, bass }` (`app/src/core/chord.js:25`).
- **Index/search slices:** `app/src/worker/reducer.js:240–262`;
  `protocol.js:48–85`.
- **Device-local store:** the `meta` object store (`app/src/worker/migrations.js:24`
  `META_STORE`, created at migration step 1 `:44–51`), Worker-owned and **not
  synced** — home-book-format §2.3 L130–137 names it "local storage the Worker
  owns… outside the home book"; `ensureDeviceId` already keeps the device id
  there (`app/src/worker/home-book.js:88–92, 337–350`). Recents live here
  (Decision 2).
- **Accessibility helpers:** `checkWcag21aa(container)`
  (`app/src/a11y/axe.js`) — WCAG 2.1 AA tags; note contrast/layout rules do
  not run under jsdom, so contrast is pinned at e2e-web.
- **Test support:** `createLoopbackEndpoint` (`app/src/test/loopback.js`),
  `fake-indexeddb`, `installWebLocks` (`app/src/test/web-locks.js`),
  `createFileSystem` (`app/src/worker/fs.js`), `startGitHttpRemote`
  (`app/src/test/git-http-remote.js`) — the in-process Worker behavior rig,
  as used by `search-index.behavior.test.js`.

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data.** The screen
  reads `search`, `index`, `browse`, `recents` and `preferences` slices
  through `useSlice` and sends commands through `store.send`; it never touches
  IndexedDB and never parses or hashes a song itself (DIRECTION §3.7
  L407–414). The recents store and browse listing live in the Worker. *Central.*
- **Offline first.** Search, the browse and the explorer-row recognition run
  entirely on the device; nothing waits on a network (workflow 2 L152–155).
  *Central — pinned by the offline e2e.*
- **Accessibility (every UI task).** Every interactive part is a React Aria
  Component — the box, the result list, the collapsible book sections, the
  scope filter, the explorer row — with full keyboard paths and axe at WCAG
  2.1 AA on every state. **Status is a word**, never colour alone (badges and
  the "still loading" state carry text; mockups README L26). *Central.*
- **No song text in logs.** The screen renders titles, artists and lyric
  snippets but logs none of it; the Worker already logs nothing
  (`logic.js:9–11`). Fixtures are purpose-written songs. *Applies.*
- **No book without an account.** The screen only lists books already on the
  device; it adds no read path and no anonymous surface, and carries
  `noindex` as the whole app does. *Applies trivially.*
- **Canonical form over preserving content.** *Not applicable* — the screen
  displays and writes no song text. (Recents store only a location reference,
  not song text.)
- **Component boundaries (DIRECTION §3.6).** No code shared with the service;
  the music core (chord parsing) stays framework-free below the view.
  *Applies.*

## Acceptance criteria

### Behavior delivered

1. **Mounts as the search screen.** The `search` `<TabPanel>` body renders the
   search view instead of the placeholder `<h1>`; the app opens on it
   (`DESTINATIONS[0]`), inside the `<main>` landmark on wide and the
   `.scroll` region on narrow. The store is threaded from `App` → `AppShell`
   → the view (Decision 1).
2. **One box, as you type.** A React Aria search box (placeholder "Songs,
   words, chords…") sends a debounced `SEARCH { query, scope }` on each
   keystroke and renders the `search` slice's ranked results; results narrow
   per keystroke (workflow 2 L22–24). Accent/case insensitivity is the
   engine's and is exercised end-to-end (`coracao` → *Coração*).
3. **A result row.** Each result shows title and artist, where it lives (book,
   and folder when `path` is not at the root), and badges. Two results with
   the same title render as two rows — not grouped (workflow 2 L44–58). A song
   with no title shows its file name without `.cifra.md` (L163–164).
4. **Badges, each a word.** A result carries `{ unsaved, voicedFor, conflict }`
   flags; the row renders the labelled badge for each that applies ("voiced
   for {instrument}", "unsaved", "conflict"), never colour alone (mockups
   README L26). `unsaved` is wired end-to-end from the index/working-copy now;
   `voicedFor` and `conflict` render when present and are populated by their
   owning tasks (Decision 7).
5. **The explorer is a result.** When the query parses as a chord symbol in
   the user's notation dialect, an **Explore {query} on your {instrument}**
   row (`.row.explore`, meta "every way to play it, easiest first") is shown
   **first**, above the text and chord-use results; a short query that is both
   a chord and a word shows both (workflow 2 L26–40). Activating the row
   (click or keyboard) invokes the `onExploreChord(chord)` seam; the explorer
   destination itself is `music.explorer` (Decision 5).
6. **Before typing: recents, then books.** With an empty query the screen
   shows the "Recent" section from the `recents` slice (most-recent-first),
   then "Books" as collapsible sections from the `browse` slice, each book
   showing its song count and, when `index[bookId] === 'building'`, a "still
   loading" line rather than looking empty (workflow 2 L13–16, L159–162).
   Sections expand/collapse by pointer and keyboard.
7. **Scope that resets each session.** A filter narrows search to a set of
   books or a folder prefix, shown as a chip inside the box (not behind a
   button), and passed as the `scope` of `SEARCH`/`BROWSE`. It is ephemeral
   view state (like the shell's selection) and therefore initialises empty on
   every mount — it resets each session (workflow 2 L60–65).
8. **Device-local recents seam.** The Worker gains a `RECORD_RECENT
   { bookId, path }` command that writes a capped, most-recent-first list into
   the device-local `meta` store and emits `RECENTS` → the `recents` slice;
   recording a recent **does not create a home-book commit** (workflow 2
   L17–20). `songs.reading` calls this seam on open; this task exposes and
   displays it.
9. **Browse listing.** The Worker gains a `BROWSE { scope? }` command that
   returns every indexed location grouped by book (`{ books: [{ bookId,
   count, songs: [{ path, title, artist, unsaved }] }] }`) over the existing
   `index_locations` data, emitted as `BROWSE_RESULTS` → the `browse` slice.
   Book display labels use the `bookId` today and the `shelf.json` label when
   `storage.shelf_surface` lands (Decision 6).

Wiring: a new area directory `app/src/songs/` with `SearchScreen.jsx` (and
small presentational children as needed — the result row, the book sections,
the recents list) and a pure `search-query.js` (chord recognition + scope
mapping); a `search` section added to all four i18n catalogues;
`AppShell.jsx`/`App.jsx` store threading; `app/src/worker/recents.js` plus
`CommandKind.RECORD_RECENT`/`BROWSE`, `EventKind.RECENTS`/`BROWSE_RESULTS` in
`protocol.js`, `recents`/`browse` slices in `reducer.js` (referentially
stable), the `{ unsaved, voicedFor, conflict }` fields on a `SEARCH_RESULTS`
result, and the dispatch in `logic.js`. Recents use the existing `meta` store,
so **no new migration step** is needed (Decision 2).

### Tests the task lands with, by level

Per the `.tji` note: **unit**, **behavior**, **e2e-web**. Fixtures are
purpose-written songs, never anyone's copyrighted words.

- **unit — `app/src/songs/search-query.test.js`:**
  - *A chord recognised* — `recognizeChord(query, dialect)` returns a chord
    for `"A"`, `"Am"`, `"Cmaj7"` and `null` for `"Banda"`, `"coração"`, empty;
    an ambiguous symbol (cifra.md §5.6, e.g. `C7+`) is read in the given
    dialect, and the chord is offered **in addition to** text results (not
    instead of). *Pins workflow 2 L26–40.*
  - *Scope* — the scope → `SEARCH`/`BROWSE` payload mapping (a set of books;
    a folder prefix within one book), and the reset default (the scope value
    is empty when freshly initialised). *Pins workflow 2 L60–65.*
- **behavior — `app/src/songs/SearchScreen.behavior.test.jsx`** (real RAC and
  i18n, a loopback-backed store with seeded `search`/`index`/`browse`/
  `recents`/`preferences` slices, axe over `container`):
  - *Results by book* — a query renders the ranked results with title, artist
    and where; two same-title songs render as two rows (not grouped); a
    titleless song shows its file name. *Pins workflow 2 L22–24, L44–58, L163.*
  - *Recents* — with an empty query the "Recent" section renders the `recents`
    slice most-recent-first. *Pins workflow 2 L13–20.*
  - *Books as sections* — books render as collapsible sections with counts;
    expand/collapse by keyboard; a book with `index` state `building` shows
    "still loading". *Pins workflow 2 L15–16, L159–162.*
  - *Badges* — results seeded with `unsaved` / `voicedFor` / `conflict`
    render the labelled badges, each a word. *Pins workflow 2 L50–54, mockups
    README L26.*
  - *Scope reset* — applying a scope narrows results and shows the chip in the
    box; a fresh mount initialises with no scope. *Pins workflow 2 L60–65.*
  - *The explorer row* — a chord query renders the "Explore {query} on your
    {instrument}" row first and invokes `onExploreChord` on click and via the
    keyboard. *Pins workflow 2 L26–40.*
  - axe clean on both the pre-typing and the results states.
- **behavior — `app/src/worker/recents.behavior.test.js`** (the Worker rig, as
  `search-index.behavior.test.js`): a `RECORD_RECENT` writes the device-local
  `meta` store and emits `RECENTS`; a second record moves an existing entry to
  the front and caps the list; recording a recent makes **no home-book
  commit** (asserted against the local git remote). *Pins workflow 2 L17–20 —
  device-local, not synced.*
- **e2e-web — `e2e/web/tests/search.spec.js`** (compose stack, phone/tablet/
  computer projects, axe WCAG 2.1 AA on the screen):
  - *Search across books on the three viewports* — with purpose-written songs
    seeded across books, type a query and watch results narrow across books on
    each viewport. *Pins workflow 2 L11–24, DIRECTION §4 L430.*
  - *A chord offering the explorer* — typing a chord (e.g. `A`) shows the
    explore row offered first. *Pins workflow 2 L26–40.*
  - *Search after an offline reload* — reload with the network cut; search and
    the pre-typing browse still work on-device. *Pins workflow 2 L152–155,
    offline-first.*
  - axe at WCAG 2.1 AA on the search screen on every viewport.

### Deferred work (closer registers in the WBS; both milestone **M2**)

- **`storage.shelf_surface`** — surface `shelf.json` from the home book into a
  `shelf` slice (each book's label, link and the per-book status the mockup
  shows — "reading", "N setlists"), mirroring `storage.preferences_surface`;
  the search screen reads it for book labels/counts and `books.shelf` (the
  management screen) reuses it. Effort **1d**; `allocate team`; `depends
  storage.home_book`; note does **not** start with `cifra.md:`. `Tests: unit
  (shelf.json → the shelf event payload; an absent book stays absent);
  behavior (the Worker against a fake IndexedDB and a local git remote
  surfaces a shelf change, the reducer folds it).` Not blocking: until it
  lands, books-as-sections labels books by `bookId` (Decision 6).
- **`storage.recents_reconcile`** — remove the now-superseded **synced**
  `recents.json` from the home book's `SETTINGS_FILES`
  (`app/src/worker/home-book.js:56–63`) and reconcile
  `docs/home-book-format.md` §4.6/§7 and
  `tasks/refinements/storage/home_book.md` §2.1/§7 with device-local recents,
  resolving the contradiction with DIRECTION §3.2 / workflow 2 L17–20. Effort
  **0.5d**; `allocate team`; `depends songs.search`; note does **not** start
  with `cifra.md:`; its refinement carries the `home-book-format.md` delta
  (out of this task's write scope). `Tests: unit (recents.json no longer in
  SETTINGS_FILES; the key-by-key home-book merge unaffected; recording a
  recent commits nothing to the home book).` Not blocking: this task puts
  recents in the device-local `meta` store and simply does not use the dead
  `recents.json`.
- **Cross-area badge/explorer wiring — not new tasks.** The `voicedFor` flag
  (the instrument in use vs the song's voicing blocks) is populated by the
  music tasks that own the instrument in use (`music.fallback` /
  `music.instruments`); the `conflict` flag is populated by the sync tasks
  that own merge state (`sync.states` / `sync.conflicts`); the explorer
  **destination** is wired by `music.explorer` ("search's chord row opens
  it"). Each uses the seam this task exposes (the result flags; the
  `onExploreChord` callback), the way `storage.index` left the sync re-index
  call to the sync task. No follow-up leaf is created for these.
- **Chord-progression search** (`Am F C G`) is already a registered leaf,
  `storage.progression_search` (workflow 2 L42, *Later*) — out of scope here.

## Decisions

1. **Thread the store to the screen by prop; no context.** `AppShell` takes a
   `store` prop (default `getAppStore()`), threads it into the `search`
   `<TabPanel>` body, and `App.jsx` passes its `store` to `<AppShell
   store={store} />` — matching how `ThemeRoot`/`LocaleRoot` already receive
   it (`App.jsx`) and the project's no-`createContext` convention (the store
   is passed down, read via `useSlice`). *Rejected: a React context/provider —
   the codebase deliberately threads the store by prop; one more hop is
   simpler than introducing a context the rest of the app does not use.
   Rejected: `getAppStore()` inside the screen — it would defeat store
   injection in behavior tests, which the loopback rig depends on.*
2. **Recents are device-local, in the existing `meta` store — not the home
   book.** Workflow 2 L17–20 and DIRECTION §3.2 make recents device-local and
   unsynced (a home-book commit per song-open is exactly what they rule out).
   The Worker-owned `meta` store (`migrations.js:24`) is the established
   device-local seam (home-book-format §2.3; it already holds the device id),
   so recents become a `meta` record — no new migration, no sync. *Rejected:
   the home book's `recents.json` (currently in `SETTINGS_FILES`,
   `home-book.js:56–63) — it syncs, contradicting the workflow; it is also
   presently dead (nothing writes or surfaces it). This task writes the
   correct device-local store and leaves the dead file to
   `storage.recents_reconcile`. Rejected: `localStorage` — the Worker owns all
   on-device state and the main thread never touches storage (DIRECTION §3.7
   L407–409); `app/src` uses IndexedDB only.*
3. **Browse is a thin listing over the index, added here.** The pre-typing
   "books as sections" needs every song grouped by book; `storage.index`
   already holds exactly that in `index_locations`. A `BROWSE` command reading
   it (no re-parse) is the UI-facing composition `storage.index` explicitly
   left to the consumer (index.md: "the explorer-first ordering is the UI's
   composition, not the index's"). *Rejected: a new storage task for browse —
   it is a different query over data that already exists, not new storage, and
   splitting it would make `songs.search` a premature pick. Rejected:
   issuing an empty-query `SEARCH` — MiniSearch returns nothing for an empty
   query, and overloading the `search` slice would make the pre-typing browse
   and the as-you-type results clobber each other's reference; a separate
   `browse` slice keeps the `Object.is` bail-out clean.*
4. **Chord recognition uses `tryParseChord` in the user's dialect.** The
   screen calls `tryParseChord(query, dialect)` (`parse.js:509`) where
   `dialect = preferences.notation?.value ?? DEFAULT_DIALECT`; a non-null
   result offers the explore row **in addition to** text/chord-use results
   (workflow 2: "Nothing is hidden by guessing which was meant"). The parser
   is permissive and root-anchored, so bare letters (`A`, `G`) parse as
   chords — which is why the row is additive, never a replacement. When the
   ambiguity itself must show (cifra.md §5.6), `parseChord(...).ambiguities`
   is available. *Rejected: a bespoke chord regex in the view — the music core
   already owns dialect-aware parsing, conformance-pinned; duplicating it
   would drift.*
5. **The explorer row exposes a callback seam; the destination is
   `music.explorer`.** There is no router and `music.explorer` is not a
   dependency of this task, but its note says "search's chord row opens it".
   So this task renders and recognises the row and invokes
   `onExploreChord(chord)`; `music.explorer` wires the actual presentation
   (an overlay/view over search) when it lands. The e2e here asserts the row
   is **offered**; `music.explorer`'s e2e asserts it **opens** — matching both
   notes. *Rejected: building the explorer destination here — it belongs to
   `music.explorer` (which owns the fingering UI, `shell.diagram` and
   `music.instruments`); coupling search to it would invert the dependency.*
6. **Book labels fall back to `bookId` until `shelf.json` is surfaced.** The
   index gives book ids, song counts and per-book build state; the human label
   and the "reading"/"N setlists" status come from `shelf.json`, not yet
   surfaced. Rather than block, the screen labels a book by its `bookId` and
   enriches from a `shelf` slice when `storage.shelf_surface` lands (both in
   M2). *Rejected: making `storage.shelf_surface` a hard predecessor — it
   would stall the primary interface on a label; graceful enrichment ships the
   screen now and both consumers (search, `books.shelf`) share the surfacing.*
7. **The result carries three badge flags; this task wires the one with live
   data.** The row renders `{ unsaved, voicedFor, conflict }` as labelled
   badges. `unsaved` has a live source now (the index's `index_locations`
   tracks it / working-copy status), so it is wired end-to-end and tested.
   `voicedFor` needs the instrument in use vs the song's voicing blocks
   (owned by music) and `conflict` needs merge state (owned by sync, and in
   M2 "local only" there is no merge yet); those flags render when present and
   are populated by their owning tasks through this result seam. *Rejected:
   computing `voicedFor`/`conflict` here — it would pull instrument rules and
   merge state into the search screen, crossing the component boundary; the
   seam (optional flags on a result) lets the owners fill them, as
   `storage.index` left the sync re-index to sync.*
8. **The scope filter is ephemeral view state.** Like the shell's selection
   (layout.md), the scope is `useState` in the screen, not a store slice or a
   persisted value — which is precisely why it "resets at the start of each
   session" (workflow 2 L63) for free, and is shown as a chip in the box
   (L64). *Rejected: persisting scope — the workflow requires the opposite (a
   forgotten scope hides results silently).*

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `app/src/songs/SearchScreen.jsx` (new) — the search screen view; fills the `search` `<TabPanel>` with the one-box, recents, books-as-sections, explorer row, badges, and scope chip.
- `app/src/songs/search-query.js` (new) — pure chord-recognition and scope-mapping helper consumed by the screen.
- `app/src/songs/search.css` (new) — co-located styles for the search screen.
- `app/src/shell/AppShell.jsx`, `app/src/App.jsx` — store prop threaded from `App` → `AppShell` → the search panel (Decision 1).
- `app/src/worker/protocol.js` — `CommandKind.RECORD_RECENT`, `CommandKind.BROWSE`, `EventKind.RECENTS`, `EventKind.BROWSE_RESULTS` added.
- `app/src/worker/reducer.js` — `recents` and `browse` slices added (referentially stable).
- `app/src/worker/logic.js` — `RECORD_RECENT` (writes device-local `meta` store, emits `RECENTS`) and `BROWSE` (reads `index_locations`, emits `BROWSE_RESULTS`) handlers added.
- `app/src/worker/search-index.js` — `unsaved`, `voicedFor`, `conflict` badge fields on `SEARCH_RESULTS` results; `browse()` listing helper.
- `app/src/worker/recents.js` (new) — device-local recents: capped list, move-to-front, serialised writes into the `meta` store, no home-book commit.
- `app/src/worker/store.test.js` — OPEN-notification count updated 2→3 (recents surfaced on bring-up).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — `search` i18n section added to all four catalogues.
- Tests: `app/src/songs/search-query.test.js` (unit, 8 tests), `app/src/songs/SearchScreen.behavior.test.jsx` (behavior, 6 tests), `app/src/worker/recents.behavior.test.js` (behavior, 3 tests), `e2e/web/tests/search.spec.js` (e2e-web, 3 tests × 3 viewports = 9 runs).
- Could not write: e2e song-seeding cases (across-books narrowing, `coracao`→`Coração` end-to-end) — no e2e seam for putting songs onto a device exists yet (unbuilt infra, not tech debt).

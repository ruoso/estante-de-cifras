# books.play — Playing through

## TaskJuggler

[`tasks/65-books.tji`](../../65-books.tji), `task play` ("Playing through")
inside `task books`:

```
task play "Playing through" {
  effort 2d
  allocate team
  depends !setlists, music.transpose
  note "Full screen in the setlist's key, swipe, edge tap or pedal keys,
  screen kept awake, next song's title, sync waiting. Workflow 12.
  Tests: behavior (swipe, edge tap and pedal keys; the setlist's key; the
  next title; axe); e2e-web (play a setlist through on the three viewports,
  the screen kept awake asked for, sync waiting until the end; axe)."
}
```

`!setlists` is the same-parent sibling shorthand for
[`books.setlists`](./setlists.md).

## Effort estimate

2d (`allocate team`), unchanged from the `.tji`. The format reader, the
canonical setlist model, the per-item resolution, the chart renderer and the
transposition engine all already exist; the weight here is a single new
full-screen view, the small pure glue that turns a setlist's **target key**
into a semitone offset, a main-thread Wake Lock adapter, and the
three-viewport journey with its hosted sync-waiting leg.

## Repository

**estante-de-cifras** only, the app (`app/src/`) and the e2e-web harness. The
note does not start with `cifra.md:`; nothing lands in
`/home/ruoso/devel/cifra.md`, in `service/` or in `api/`. **No design delta**
— workflow 12 §Playing through and §The key, and the W12 board, settle the
behavior; this refinement turns them into a work order. Directories touched:

- `app/src/books/SetlistPlay.jsx` — **new**: the full-screen performance
  surface (the W12 phone "playing through" screen), mounted by the shell.
- `app/src/books/setlist-play.js` — **new**: the pure glue — target-key →
  semitone offset, the playable-item list (missing items skipped), next/prev
  navigation, the next-song title.
- `app/src/books/setlist-play.test.js` — **new**: unit tests for that glue.
- `app/src/books/SetlistPlay.behavior.test.jsx` — **new**: the behavior test.
- `app/src/books/wake-lock.js` — **new**: the non-component main-thread Wake
  Lock adapter (the `sync-triggers.js` precedent).
- `app/src/books/play.css` — **new**: co-located styles (or reuse the
  existing `.reading-fullscreen*` rules in `app/src/songs/reading.css`).
- `app/src/shell/AppShell.jsx` — **edit**: a new `playingSetlist` ephemeral
  full-screen host, wired from `SetlistView`'s already-drawn `onPlay` seam.
- `app/src/App.jsx` — **edit (optional)**: a `#dev/play?book=&path=` hash
  mount for the harness, the `ReadingDev`/`SetlistsDev` pattern.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — **edit**: a new `play`
  copy section (en is the source of truth; catalogue completeness is a build
  gate).
- `e2e/web/tests/setlist-play.spec.js` — **new**: the Playwright journey.

**No new Worker command, no reducer change, no cifra.md change** (see
Decisions): the player reads the setlist text and each song's text through
the existing `OPEN_SOURCE`, reads the user's own remembered transposition
through the existing `OPEN_SONG`/`song` slice, and composes the pure music
core in the view, exactly as the reading surface does.

## Inherited dependencies

Both **settled** (`complete 100`):

- **[`books.setlists`](./setlists.md)** (Done 2026-10-13) — the setlist
  surface and its seams:
  - `app/src/books/SetlistView.jsx` already draws a **`onPlay({ bookId,
    path })` prop seam** (`:133`), raised from the body `.btn primary block`
    **Play** (`:300`), the "More" menu `play` item (`:284`) and the wide
    **Play** button (`:477`), i18n `play` label — but **AppShell does not
    pass it** (the `<SetlistView>` render at `AppShell.jsx:747-755`), so Play
    is a no-op awaiting this task (the header comment at `SetlistView.jsx:6`:
    "Play is a seam (`onPlay`) this task draws but does not wire — books.play
    owns the player"). This is the symmetric mirror of reading's
    `onAddToSetlist`; this task is the host that mounts the player.
  - `app/src/books/setlist-display.js` — the pure resolution this task
    consumes: `setlistRows(model, setlistPath, bookPaths)` (`:75`) →
    `{ at, number, title, path, resolvedPath, folder, key, note, missing }`
    per row; `resolveItemPath(setlistPath, itemPath)` (`:27`) joins the
    folder-relative link to a book-root path (collapsing `..`; memory
    *setlist-item-path-is-folder-relative*), `bookFileSet(entries)` (`:59`)
    is the book's file set that marks an item **missing**.
  - The setlist's live text crosses through `OPEN_SOURCE` → `source` slice →
    `parseSetlist` (from `cifra-md`), the pattern `SetlistView` already uses
    (`SetlistView.jsx:156`).
- **[`music.transpose`](../music/transpose.md)** (Done 2026-10-06) — the pure
  transposition engine `transpose(model, semitones, { dialect })`
  (`app/src/core/transpose.js:168`): a new model whose chord symbols are
  re-rooted by a **signed semitone offset** and spelled in one consistent
  spelling, the input left untouched, `0` returning the written key.
  `transposedKeyName(key, semitones, dialect)` (`transpose.js:198`) and
  `transposeStatus(key, offset, dialect)` (`app/src/songs/reading-view.js:22`)
  name the destination key. **There is no target-key → offset helper** — the
  engine takes an interval; this task adds the pure `playKeyOffset` that
  computes it from the song's written `key` to the setlist's target `key`
  (see Decisions). `transpositionOf(songsModel, songRef)`
  (`app/src/worker/songs.js`) reads the user's own remembered offset for an
  item that carries no setlist key.

**Drivers complete but outside this task's `depends`** (they satisfy the
test-driving rule by being `complete 100`, not by a `depends` edge; no `.tji`
edit is made, per the `books.setlists` / `books.upload_ui` precedent):

- **the bundled example book** (`app/example-book/`) ships songs and a real
  sample setlist `a-short-set.setlist.md`, seeded through the first-run
  way-in — the local setlist the e2e plays through.
- **[`sync.read_in_place`](../sync/read_in_place.md)** (Done 2026-10-08) —
  established that `OPEN_SOURCE` is a one-shot, **demand-driven** read: the
  sync engine does not push `SOURCE`, so a slice holds the bytes last
  requested until the view re-requests (its Decision 2). "Sync waiting" falls
  out of that principle here (Decision 2 below); this task reuses the
  principle, adds no sync code, and subscribes to no `MERGED` event.
- **[`books.online`](./online.md)** (Done) — a device puts its own book
  online; its in-browser put-online flow and reusable harness
  (`e2e/web/tests/online.spec.js`) stand up the **hosted** book the
  sync-waiting e2e needs.
- **[`account.sign_in`](../account/sign_in.md)** (Done) — the passkey
  sign-in that gives the device a session, the precondition for putting a
  book online.
- **[`foundation.e2e_web`](../foundation/e2e_web.md)** — the Playwright
  harness `e2e/web/` (three viewport projects, `lib/axe.js`,
  `lib/devices.js`, `lib/offline.js`), reached through the `books` parent's
  `depends foundation.e2e_web`; `e2e/web/tests/read-in-place.spec.js` is the
  reusable two-device pattern (a Node `git` CLI clones with the device's own
  session cookie and pushes a new version, over smart HTTP).

## What this task is

The **play-through**: from an opened setlist, **Play** enters a chrome-free
full-screen surface that shows the songs one at a time, in order, each in the
setlist's key, and performs:

- **Next and previous** by swiping, by tapping the edges of the screen, by
  the on-screen edge buttons, or by a page-turner pedal (pedals send the keys
  a keyboard does, so the arrow and page keys drive it);
- **the screen kept awake** while playing (the Wake Lock API);
- **the setlist's key** applied as a read-time transposition over each song
  (view only, never the song), with the current key shown and the written
  key named when they differ;
- **missing items skipped** (an item whose link points at nothing is not
  played);
- **the next song's title** shown at the end of each one;
- **sync waiting**: the song on screen does not move mid-performance; the
  latest version shows the next time a song is loaded (on navigation, or
  after the user stops).

It is purely a new view, its pure glue, a Wake Lock adapter, the i18n copy,
and the three-viewport e2e journey. The setlist format, the per-item
resolution, the transposition engine, the song/setlist reads and the build
story all already exist.

## Why it needs to be done

`SetlistView`'s `onPlay` seam dangles (`SetlistView.jsx:133`, unwired at
`AppShell.jsx:747-755`); the whole build story of workflow 12
([`books.setlists`](./setlists.md)) exists so a setlist can be *played*, and
`books.play` is the one surface that does it. It closes workflow 12's
§Playing through and the W12 phone "playing through" board, and it is the
last in-app consumer of [`music.transpose`](../music/transpose.md)'s engine
for the setlist's band-agreed key. It is a leaf — `books.play` is one of
milestone `m5_whole`'s dependencies (`tasks/99-milestones.tji:44`); nothing
depends on it.

## Inputs / context

### Normative design

- **Workflow 12** `docs/workflows/12-setlists.md`:
  - §Playing through (L63-76) — the governing section. "*Play* goes through
    the songs one at a time, full screen." (L65). **Next and previous** "by
    swiping, by tapping the edges of the screen, or by a page-turner pedal.
    Pedals send the keys a keyboard does, so the arrow and page keys are
    enough." (L66-69). **"The screen is kept awake** while playing (the Wake
    Lock API)." (L70). **"Sync waits** until playing stops (workflow 8)."
    (L71). **"The next song's title** is shown at the end of each one." (L72).
    "Each person plays on their own instrument … the setlist says nothing
    about instruments" (L74-76) — the player is the performance chart, not a
    shapes surface.
  - §The key (L44-54) — the per-item `key` "transposes it for reading
    (workflow 2), **over the user's own remembered transposition**; outside
    the setlist, the user's own applies again." (L49-51). "It is a **target
    key**, not an interval, so it reads the same whatever key the song is
    written in. **To know the interval it needs the song's own `key`
    property; when the song has none, the setlist's `key` is shown as a note
    instead.**" (L52-54). The key is the band's, in the shared setlist file,
    not anyone's home book (L46-47).
  - §Songs moved, renamed or deleted (L78-85) — a link that points at nothing
    "shows as *missing* in the setlist, **is skipped when playing**, and
    offers to be pointed at a song." (L83-85). The missing-marking and
    repoint are the setlist surface's ([`books.setlists`](./setlists.md)); the
    player only **skips**.
- **Workflow 8** `docs/workflows/08-sync.md` §A song open while it changes:
  "**Being read full screen**, it waits, and updates when the user leaves it.
  The middle of a performance is the worst moment for a song to move."
  (L53-54). The clean-merge-without-asking context (L42-45). The mechanism is
  [`sync.read_in_place`](../sync/read_in_place.md)'s full-screen defer, reused
  in principle here.
- **Mockup board** `docs/mockups/W12-setlists.dc.html` (canvas.json: "12.
  Setlists"), the **Phone · playing through** screen (L70-102) — the real
  states and copy this task renders:
  - app bar: a `.btn icon` **Stop playing** (`aria-label="Stop playing"`, an
    ✕, L73); the current song title (`t-h2`, L75); a `t-small` status
    *"{i} of {n} · screen kept awake"* (L76); a `.chip accent` *"In {key}"*
    (L78) when the song is transposed;
  - body: a `t-small` *"Setlist key {key} · written in {songKey}"* (L81); the
    `.chart` of chords over syllables (L82-91); a `.card pad` **Next** panel —
    *"Next"* (`t-h3`), *"{number}. {title}"* (`t-h2`), the item's *"Note:
    {note}"* when it has one (L92-96);
  - a centred `t-small` hint *"Swipe, tap an edge, or use a pedal"* (L98);
  - absolutely-positioned edge `.btn icon` **Previous song** / **Next song**
    (`aria-label`, L100-101).
  - board subtitle (L20): "Play goes through it one song at a time, full
    screen, in the setlist's key, skipping any song that has gone missing."
  - Status is carried by a **word** on every badge/chip, never colour alone
    (`docs/mockups/README.md:26`): *screen kept awake*, *In {key}*.
- **DIRECTION.md** §3.7 (L415-445) — the app: the music core and cifra.md JS
  "know nothing of React; the view is the only layer that does" (L415-417);
  the Worker owns git/working-copy/index, the main thread never touches
  IndexedDB (L418-420); "The middle of a performance is the worst moment for
  anything to move" (L454). §3.2 (L136-151) — personal state (a song's
  remembered transposition) lives in the home book; the setlist `key` is the
  **band's**, not personal (cross-reference workflow 12 §The key). §4
  (L462-478) — song search and the reading view, the surfaces Play is *not*
  on (Play is on the opened setlist).

### Code seams (all exist, verified on disk)

- **The `onPlay` seam** — `app/src/books/SetlistView.jsx:133` (`onPlay`
  default), raised at `:284`, `:300`, `:477`; unwired at
  `app/src/shell/AppShell.jsx:747-755`.
- **The shell's ephemeral hosts** — `AppShell.jsx` holds `openSong`
  (`setOpenSong`), `openSetlist` (`setOpenSetlist`, `:335`), `addingToSetlist`,
  share/history/arrange hosts — each an early full-screen `return`; this task
  adds `playingSetlist`. No router; `App.jsx` has a read-once `useHashRoute`
  for deep links only.
- **Per-item resolution** — `app/src/books/setlist-display.js`
  `setlistRows`/`resolveItemPath`/`bookFileSet` (above).
- **Song text + reading state** — `OPEN_SOURCE { bookId, path }`
  (`app/src/worker/protocol.js` `CommandKind.OPEN_SOURCE`) → `SOURCE` event →
  `source` slice keyed `[bookId][path].text` (read `source?.[bookId]?.[path]
  ?.text`); `parse(text, dialect)` from `cifra-md`; `OPEN_SONG` → `song` slice
  → `transpositionOf` for the user's own remembered offset;
  `app/src/books/use-load-song.js` `useLoadSong(store, bookId, path, title)`
  is the OPEN_SOURCE + H1-title helper.
- **The chart** — `app/src/chart/Chart.jsx` `Chart({ model, size, label, … })`
  (`:203`); the reading surface renders `<Chart model={transpose(model, n,
  …)} …>`. The player renders the same way.
- **The transposition engine + naming** — `app/src/core/transpose.js`
  `transpose` (`:168`), `transposedKeyName` (`:198`);
  `app/src/songs/reading-view.js` `transposeStatus` (`:22`). Key/pitch
  primitives for the new offset helper: `app/src/core/pitch.js` `parseNote`
  (`:53`), `pitchClass` (`:66`), `interval` (`:81`), `transposeNote` (`:113`);
  the setlist key format is validated by `KEY_RE = /^[A-G](?:#|b|♯|♭)?m?$/`
  (`SetlistView.jsx:52`).
- **The full-screen precedent** — `app/src/songs/SongReading.jsx` `fullScreen`
  `useState` (`:135`), `leaveFullScreen` (`:204`), the chrome-free
  `.reading-fullscreen` branch (`:448-457`) with a keyboard-reachable exit and
  a `.scroll` container; `app/src/songs/reading.css:151-188`.
- **The main-thread adapter precedent** — `app/src/sync-triggers.js`
  `createSyncTriggers(store, { doc, win })`: a thin, non-React DOM adapter
  (visibilitychange/online listeners). The Wake Lock adapter follows this
  shape, not an inline component effect.
- **Theming / overlays** — `app/src/theme/ThemeRoot.jsx` wraps the app in
  react-aria `UNSAFE_PortalProvider` (`getContainer` → the `.est` root), so
  any RAC overlay resolves tokens automatically (memory
  *rac-overlays-portal-outside-est-theme-root*); the player uses no modal.

### Test harness

- Behavior (React): `*.behavior.test.jsx`, jsdom, loopback store
  (`createLoopbackEndpoint(createLogic)`, `app/src/test/loopback.js`) →
  `createStore`, Testing Library, real RAC + i18n, axe via `checkWcag21aa`
  (`app/src/a11y/axe.js`). jsdom has no layout (so swipe/visual guarantees are
  e2e), and **no `navigator.wakeLock`** — the Wake Lock request is driven
  through an injected adapter and observed by a spy. Project memory
  *codemirror-jsdom-getclientrects* is not engaged (no CM6 here).
- Unit: `*.test.js` beside source, vitest.
- e2e-web: `e2e/web/tests/*.spec.js`, Playwright over the compose stack,
  three viewport projects auto-run, axe WCAG 2.1 AA on each screen; helpers in
  `e2e/web/lib/`; `online.spec.js` (put-online harness) and
  `read-in-place.spec.js` (two-device git-CLI push) are the reusable patterns
  for the sync-waiting leg.

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data**
  (DIRECTION §3.7). The player composes the setlist and song models itself
  from working-copy text (`OPEN_SOURCE` → `source` slice →
  `parseSetlist`/`parse`) and the user's own offset from the `song` slice; it
  touches neither IndexedDB nor git, and adds **no Worker command**. The pure
  glue (`setlist-play.js`) is framework-free, imports only `setlist-display`,
  the music core and `cifra-md`.
- **View only, never the song.** The setlist's target key is applied by
  `transpose(model, offset, …)` at read time; it is **never written** as the
  song's remembered transposition (that register is personal and the setlist
  key is the band's — workflow 12 §The key L46-47, DIRECTION §3.2). The player
  issues no `SET_TRANSPOSITION`, no `WRITE`, no `SAVE`. The stored song,
  search and history are untouched (canonical form is not reached).
- **Canonical form over preserving content.** The player reads canonical
  saved songs and setlists; it writes nothing, so the rule is satisfied by not
  engaging it.
- **Offline first.** Playing, navigating and the Wake Lock are entirely
  local; nothing on this surface waits on the network (DIRECTION §3.4). Sync
  continues in the Worker in the background; the player simply does not
  re-surface the song on screen until the user moves (Decision 2).
- **Accessibility** (WCAG 2.1 AA, every state): every control is a React Aria
  Component with a keyboard path and an accessible name — **Stop playing**,
  **Previous song** and **Next song** `Button`s (the keyboard/AT navigation
  path); the pedal is the arrow and page keys bound on the surface; swipe and
  edge-tap are pointer/touch enhancements over the *same* next/prev actions,
  not a separate affordance. A `role="status"`/polite live region announces
  the position (*{i} of {n}*) and the next title as songs change. Status is a
  **word** (*screen kept awake*, *In {key}*), never colour alone
  (`mockups/README.md:26`). The full-screen surface must not trap focus
  irrecoverably — Stop (and Escape) leave it. axe clean on each state and
  viewport.
- **No book without an account** is not engaged by the local play-through
  (the example book is on the device). The hosted **sync-waiting** e2e leg
  does use a session (sign in → put online), driven by the complete
  `account.sign_in` / `books.online` harness.
- **No song text in logs; fixtures are purpose-written.** The player logs
  nothing; test songs and setlists are written for the purpose, never
  anyone's copyrighted words.

## Acceptance criteria

### Behavior delivered

1. **Play enters the player.** `SetlistView`'s `onPlay({ bookId, path })` is
   wired through `AppShell` to a new `playingSetlist` full-screen host
   mounting `SetlistPlay`; **Stop playing** (and Escape) returns to the
   setlist.
2. **The songs, in order, missing skipped.** The player reads the setlist
   text, resolves `setlistRows`, and plays the **linked** items in order;
   **missing/unlinked items are skipped** (workflow 12 §Songs moved L83-85).
   The app bar shows the current title and *{i} of {n} · screen kept awake*;
   the body shows the chart; a **Next** card shows the next item's number,
   title and note (workflow 12 §Playing through L72; W12 board L92-96).
3. **The setlist's key.** For an item with a `key` and a song that has a
   written `key` property, the chart is transposed to the target key
   (`playKeyOffset(songKey, itemKey)` → `transpose(model, offset, …)`), the
   `.chip accent` *In {key}* and the *Setlist key {key} · written in
   {songKey}* line shown (W12 board L78, L81). For an item with a `key` but a
   song **without** a written key, the setlist key is shown **as a note** and
   the chart is **not** transposed (workflow 12 §The key L52-54). For an item
   with **no** key, the song reads under the user's **own remembered
   transposition** (`song` slice → `transpositionOf`), and outside the
   setlist the user's own still applies (workflow 12 §The key L49-51). The
   transposition is **view-only** — never persisted.
4. **Navigation.** Next/previous by the on-screen edge **Buttons**, by the
   **arrow and page keys** (pedal), by **edge-tap** and by **swipe**; the
   bound keys are the arrow and page keys (workflow 12 L66-69). At the ends,
   navigation stops (no wrap); the position and next-title live region
   updates.
5. **Screen kept awake.** On entering the player a Wake Lock (`screen`) is
   **requested**, re-acquired on return to visibility, and **released** on
   Stop/unmount; the *screen kept awake* status word is shown. Absent the API
   (older browsers) the request is a graceful no-op.
6. **Sync waits until playing stops.** The song on screen is loaded once when
   it becomes current and is **not re-surfaced** while it stays on screen; a
   background merge that lands during play does not move the displayed chart.
   The latest version shows the next time a song is loaded — on navigation to
   it, or after Stop (workflow 12 §Playing through L71; workflow 8 L53-54).

### Tests, by level

The note names **behavior** and **e2e-web**; both land here. A **unit** level
is added for the new pure glue (a pure module gets unit tests — testing
policy; see Decision 8). No named level is dropped.

- **unit — `app/src/books/setlist-play.test.js`** (the new pure
  `setlist-play.js`):
  - *target key → offset:* `playKeyOffset('G', 'A')` → `+2`;
    `playKeyOffset('C', 'Db')` → a one-semitone offset; **`null`** when the
    song has no written key or either key is unparseable (so the caller
    shows the setlist key as a note, untransposed). *Pins* workflow 12 §The
    key L52-54.
  - *the playable list:* building the ordered list from `setlistRows`
    **excludes missing and unlinked items**; a setlist whose middle item is
    missing plays the rest in order. *Pins* workflow 12 §Songs moved L83-85.
  - *navigation:* next/prev over the playable list clamps at the ends (no
    wrap); the index maps to the right item when missing items sit between.
  - *the next title:* the next item's number + title + note derived from the
    playable list for the **Next** card. *Pins* workflow 12 §Playing through
    L72.
- **behavior (React) — `app/src/books/SetlistPlay.behavior.test.jsx`**
  (loopback store, seeded `source`/`song` slices, an injected Wake Lock
  adapter spy, real RAC + i18n, axe):
  - the player opens on the first linked song; a song written in G with an
    item key A renders **transposed** with the *In A* chip and *Setlist key A
    · written in G* (AC 3; W12 L78/L81); a song with **no** written key and
    an item key shows the setlist key **as a note, untransposed** (AC 3,
    workflow 12 §The key L52-54); an item with **no** key renders under the
    seeded remembered transposition (AC 3, §The key L49-51);
  - **next and previous by the edge Buttons and by the arrow and page keys**
    (ArrowRight/PageDown → next, ArrowLeft/PageUp → previous), the **Next**
    card showing the next title + note, a **missing item skipped** (AC 2, 4;
    workflow 12 §Playing through, §Songs moved);
  - the Wake Lock adapter's `request('screen')` is called on open and
    **released** on Stop; the *screen kept awake* word renders (AC 5);
  - axe clean on the player (default, transposed, note-only states). *Pins*
    the `.tji` behavior clause ("swipe, edge tap and pedal keys; the setlist's
    key; the next title; axe") — swipe/edge-tap being pointer gestures over
    the same actions, pinned at e2e; here the keyboard and button paths are
    driven (memory *rac-button-keydown-plus-click-cancels-press*: one gesture
    per control).
- **e2e-web — `e2e/web/tests/setlist-play.spec.js`** (phone, tablet,
  computer; axe WCAG 2.1 AA on each screen):
  - **play a setlist through** on all three viewports: open the example
    book's `a-short-set.setlist.md`, Play, go **next** by swipe (touch
    viewports), by **edge-tap**, and by the **arrow/page keys** (computer);
    go **previous**; the **next-song title** shown; a **missing** item (made
    by deleting a referenced song in the file view) **skipped**; axe on the
    player (workflow 12 §Playing through L65-72, §Songs moved L83-85);
  - **the screen kept awake asked for**: an `addInitScript` stubs
    `navigator.wakeLock` to record `request('screen')`; entering the player
    calls it, Stop releases it (workflow 12 L70);
  - **sync waiting until the end** (the hosted leg, reusing `online.spec.js` +
    the `read-in-place.spec.js` two-device pattern): the device signs in
    (passkey), makes a local book, puts it online; the second device (the host
    `git` CLI, same session cookie) seeds a setlist and its songs and later
    **pushes a new version of the song on screen**; while playing, a sync
    (a real `online` event) lands the merge into the working copy but the
    displayed chart **does not change**; after **Stop**, re-opening the song
    shows the new version (workflow 12 §Playing through L71; workflow 8
    L53-54). *This leg is the only one needing a hosted book — its drivers
    (`books.online`, `account.sign_in`) are complete.*

All named tests land in this task and run (not skipped) in `scripts/gate`.

### Deferred work (closer registers in the WBS)

- **(none).** The behavior and e2e-web levels the note names, plus the added
  unit level, all land here. No follow-up leaf is created: the player's
  scope (full screen, navigation, key, next title, wake lock, sync waiting)
  is wholly delivered. A page-turner **capo** or richer pedal mapping is not
  in workflow 12 and is not invented here.

## Decisions

1. **No new Worker command — the player is a pure view over existing reads.**
   *Chosen:* the player reads the setlist and each song through the existing
   `OPEN_SOURCE`, the user's own offset through the existing `OPEN_SONG`/`song`
   slice, parses and transposes in the view, and renders `Chart` — adding no
   `CommandKind`, no reducer slice. *Rationale:* playing is ephemeral view
   state (like full-screen reading), persists nothing, and every datum it
   needs already crosses the boundary; this matches the reading surface's
   "the view composes the music core; the Worker surfaces state, not a
   prepared model" (reading.md) and keeps the Worker surface flat. *Rejected:*
   an `OPEN_SETLIST_PLAY`/prepared-play-model command (duplicates the reads,
   couples the Worker to a view model for nothing to persist).
2. **"Sync waits" = load-once-per-song; no pause, no `MERGED` subscription.**
   *Chosen:* the player issues `OPEN_SOURCE` for a song **once**, when it
   becomes current, and does not re-request it while it stays on screen;
   because `OPEN_SOURCE` is demand-driven and the engine does not push
   `SOURCE` ([`sync.read_in_place`](../sync/read_in_place.md) Decision 2), the
   displayed bytes are frozen until the user navigates or stops — so "waiting"
   is simply *not re-requesting yet*. *Rationale:* it delivers workflow 8's
   full-screen defer with zero new sync machinery, and sync (fetch/merge/push)
   keeps running in the Worker as workflow 8 requires (only the *display*
   waits). The next load — navigation or Stop → re-open — shows the merged
   version ("updates when the user leaves it", workflow 8 L53). *Rejected:* a
   Worker-side sync pause (puts a view concern — is the player open? — in the
   Worker, which cannot know it; read_in_place Decision 3 already rejected
   this); subscribing to `EventKind.MERGED` to actively defer (unnecessary —
   not re-requesting already defers, and the player holds no open-song slice
   to re-surface into).
3. **The setlist's target key is turned into a semitone offset in a new pure
   helper and applied through the existing engine; view-only.** *Chosen:* a
   new `playKeyOffset(songKey, targetKey)` in `app/src/books/setlist-play.js`
   computes the signed semitone offset from the song's written `key` to the
   setlist item's target `key` (via `parseNote`/`pitchClass`,
   `app/src/core/pitch.js:53,66`), returning `null` when the song has no
   written key; the player calls `transpose(model, offset, { dialect })`, and
   spelling follows the engine's established rule (by the transposed tonic's
   fewest accidentals — music.transpose). It is **never** persisted as the
   song's remembered transposition. *Rationale:* the engine takes an interval,
   not a target key (there is no inverse helper); the smallest honest addition
   is the key→offset glue, and reusing `transpose` keeps one spelling
   authority. The key is the band's and view-only (workflow 12 §The key
   L46-47, DIRECTION §3.2). *Rejected:* threading the target key's own
   spelling through `transpose` (a `music.transpose` API change for marginal
   spelling fidelity — e.g. a target written `C#` rendering as `Db`); writing
   the setlist key as the song's transposition (it is not personal, and that
   would leak the band's key into the home book).
4. **When the song has no written key, show the setlist key as a note,
   untransposed; when the item has no key, apply the user's own remembered
   transposition.** *Chosen:* exactly workflow 12 §The key L49-54 — a target
   key needs the song's own `key` to find the interval; without it the key is
   informative only (shown, not applied); an item with no key falls through to
   the user's own remembered offset "over" which the setlist key would
   otherwise sit. *Rationale:* it is the workflow's literal rule and the
   engine's `null`-offset path makes it a clean branch. *Rejected:* guessing a
   key from the chords (out of scope, and the workflow says "shown as a note
   instead").
5. **Navigation: the edge Buttons are the keyboard/AT path; swipe and
   edge-tap are enhancements over the same actions.** *Chosen:* **Previous
   song** / **Next song** RAC `Button`s (the board's `aria-label`ed edge
   buttons) and the arrow/page keys bound on the surface are the tested,
   accessible navigation; swipe and edge-region tap are pointer/touch
   gestures that call the identical next/prev handlers, pinned at e2e.
   *Rationale:* a page-turner pedal "sends the keys a keyboard does" (workflow
   12 L68-69), so key bindings *are* the pedal support, and the buttons give
   the keyboard/AT path the gestures cannot; this mirrors
   [`books.setlists`](./setlists.md) Decision 5 (remove button is the path,
   swipe is the enhancement). *Rejected:* swipe/edge-tap as the only
   navigation (fails keyboard/AT); a bespoke pedal protocol (pedals already
   emit keys).
6. **Wake Lock via a non-component main-thread adapter, re-acquired on
   visibility, graceful when absent.** *Chosen:* `app/src/books/wake-lock.js`
   `createWakeLock({ nav })` with `request()`/`release()`, held while the
   player is mounted and re-requested on `visibilitychange` (the lock drops
   when the tab backgrounds); injected into the component so the behavior test
   can spy it, following `sync-triggers.js`. *Rationale:* keeps a platform
   concern out of the view and testable under jsdom (which has no
   `navigator.wakeLock`); a missing API is a no-op, not an error. *Rejected:*
   an inline `useEffect` touching `navigator.wakeLock` directly (mixes
   platform and view, hard to assert).
7. **The player is a chart-only full-screen surface — no shapes panel.**
   *Chosen:* render only the chord chart over the words (the W12 play board,
   L80-97), reusing the `.reading-fullscreen` chrome-free pattern; shapes and
   the voicing picker stay on the reading surface. *Rationale:* workflow 12
   L74-76 — the setlist says nothing about instruments; each person already
   has their voicing from the reading view; the player is the performance
   chart. *Rejected:* rendering shapes/diagrams in the player (not drawn; it
   would reopen the voicing surface the player deliberately omits).
8. **Add a unit level for the new pure glue; keep the named behavior and
   e2e-web.** *Chosen:* the note names behavior + e2e-web; this task adds
   `setlist-play.test.js` for the genuinely new pure functions (key→offset,
   playable list, navigation clamp, next title). *Rationale:* a pure module
   gets unit tests (testing policy), and these functions are cheaper and
   sharper to pin at unit than only through the rendered player; no named
   level is dropped. *Rejected:* pinning the key→offset only through the chart
   (coarser, and a `null`-offset branch is awkward to observe in a render).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- `app/src/books/setlist-play.js` — new pure glue: `playKeyOffset`, `playableItems`, `clampIndex`, `nextItem`
- `app/src/books/wake-lock.js` — new main-thread Wake Lock adapter (`createWakeLock({ nav })`)
- `app/src/books/SetlistPlay.jsx` — new full-screen player component (Stop, navigation buttons, key chip, next-title card, live region)
- `app/src/books/play.css` — new co-located styles for the player surface
- `app/src/books/setlist-play.test.js` — 17 unit tests: key→offset, playable list (missing skipped), nav clamp, next title
- `app/src/books/SetlistPlay.behavior.test.jsx` — 9 behavior tests: transposed/note-only/own-transposition key states, edge-button + arrow/page-key nav, Wake Lock request/release + status word, Escape, axe on three states
- `e2e/web/tests/setlist-play.spec.js` — 3 e2e-web tests per viewport (play-through, wake-lock stub, sync-waiting hosted leg)
- `app/src/shell/AppShell.jsx` — `playingSetlist` full-screen host wired to `SetlistView onPlay`
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — new `play` copy section

# shell.dev_mount_open — Every app mount brings the Worker up

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 89–94, task
`shell.dev_mount_open` ("Every app mount brings the Worker up"), under
`task shell` (which `depends foundation.app_tooling, foundation.e2e_web`). It
`depends !layout`, and sits in the polish milestone
(`tasks/99-milestones.tji` line 44). The note, verbatim:

> The Worker's OPEN command — which surfaces preferences, theme and
> instruments — is sent only from AppShell's mount effect
> (app/src/shell/AppShell.jsx:403-405). A cold boot or reload straight into a
> #dev/* mount (App.jsx ~176-192) never mounts AppShell, so preferences stay
> empty and, e.g., the save sheet asks 'Your name' again although authorName is
> durably in the home book. Users always boot through AppShell, and e2e specs
> may not use dev mounts (e2e/web/eslint.config.js), so it bites only a
> developer on a dev route — where it looks like a durability failure of the
> name. Move the open effect up into App (ensureOpen is memoised, the store a
> singleton). Source: tasks/parking-lot.md 2026-10-14 (SET_IDENTITY_NAME
> author-name durability). Tests: behavior (App mounting a dev route sends OPEN
> once); e2e-web (name set, the app reloaded, Save does not ask for the name —
> the durability the parking-lot entry asked about, through the real UI).

The parking-lot entry it came from ("2026-10-06 — `SET_IDENTITY_NAME`
author-name durability through a real-browser reload") was removed by the
triage commit `799f87d` when this leaf was made; it suggested exactly the
e2e scenario named here (name set → reload → edit → Save → "Your name"
absent). The line numbers in the note have drifted: the effect is now at
`AppShell.jsx:404-416`.

## Effort estimate

**0.5 day** (from the `.tji`). One effect moved from `AppShell` to `App`
with its comment, three behavior cases in `App.test.jsx`, one e2e-web case.

## Repository

**estante-de-cifras only** — `app/src/App.jsx`, `app/src/shell/AppShell.jsx`,
`app/src/App.test.jsx`, and `e2e/web/tests/save-sheet.spec.js`. Not format
work (the note does not start with `cifra.md:`); nothing touches the
service, the API or cifra.md.

**No design delta.** DIRECTION §3.7 already says the Worker owns the data
and the view only sends commands; which component sends OPEN is an
implementation detail inside the view, and nothing a user sees changes.

## Inherited dependencies

Settled (all `complete 100`):

- `shell.layout` — `App` → `ThemeRoot` → `LocaleRoot` → (`AppShell` or a
  `#dev/*` mount), and AppShell's mount effect that sends OPEN.
- `songs.editor` — the `#dev/editor?book=…&path=…` mount
  (`app/src/editor/EditorDev.jsx`), which opens the real `SaveSheet` for a
  concrete song (`EditorDev.jsx:60-80`).
- `songs.save_sheet` — the sheet's "Your name" field, asked only when the
  home book holds no `authorName` (`SaveSheet.jsx:83-84`), and
  `SET_IDENTITY_NAME`, which writes it durably and flushes
  (`worker/logic.js:1079-1102`).
- `books.example_book` (via `openExampleBook`) — the local example book
  under the reserved id `local-example-book`
  (`app/src/worker/example-book.js:36`) with `morning-on-the-porch.cifra.md`.

Pending: none.

## What this task is

Move the one `useEffect(() => { store.open?.(); }, [store])` that brings the
Worker up from `AppShell` into `App`, so every mount the app can boot into —
the shell, or any `#dev/*` mount — sends OPEN, and the `preferences`, shelf,
instrument and recents slices are surfaced no matter which surface the page
loaded on. AppShell stops sending it.

## Why it needs to be done

OPEN is what makes the Worker post READY and surface the home book's
preferences (`logic.js:910-953`). `ThemeRoot`, `LocaleRoot` and `SaveSheet`
all read the `preferences` slice; without OPEN it stays `{}`, so a reload
into a dev mount renders with the default theme and language and the save
sheet asks for a name the home book already holds. People always boot
through the shell, so no user sees it, and e2e specs may not use dev mounts
at all (`e2e/web/eslint.config.js`: specs reach screens through the real
UI). It bites a developer working on a dev route by hand, where it looks
like a durability failure of `SET_IDENTITY_NAME` (which is how it reached
the parking lot). Putting the
bring-up at the root also makes it independent of `LocaleRoot`'s remount on
a language change (`App.jsx:147-149`), which today remounts AppShell and
re-sends OPEN.

## Inputs / context

- `app/src/App.jsx:151-207` — `App`: `useHashRoute()` (95-102, re-renders on
  `hashchange`), the boot-token captures and their `replaceState` effect
  (158-170), and the mount choice (172-200): `ChartGallery`, `EditorDev`,
  `HistoryDev`, `ReadingDev`, `ArrangeDev`, `WizardDev`, `FilesDev`,
  `SetlistsDev`, else `AppShell`.
- `app/src/shell/AppShell.jsx:404-416` — the effect and its comment
  (idempotent in the Worker; the store a singleton; the inert jsdom store has
  `open()` too). `AppShell.jsx:226` defaults `store = getAppStore()`.
- `app/src/worker/store.js:73-76` — `open()` posts
  `command(CommandKind.OPEN)`; not memoised on the main thread.
  `store.js:95-103` — `getAppStore()`, the lazy singleton (a Worker store, or
  an inert `createStore({ postMessage() {} })` where there is no `Worker`).
- `app/src/worker/logic.js:343-346` (`ensureOpen` memoises `dbPromise`),
  `910-953` (`handleOpen`: READY, then the surfaced slices, the index sweep,
  the sync scheduler), `960-962` (the OPEN case). A second OPEN is harmless:
  DB, fs and index hydration are memoised, persistence is asked once
  (`worker/fs.behavior.test.js:56-68`), the scheduler's `start()` is a no-op
  when running (`sync-scheduler.js:141-144`); it only re-posts the slices and
  triggers one coalesced sync pass.
- `app/src/songs/SaveSheet.jsx:83-84` (`needsName = !preferences?.authorName?.value`),
  `99-103` (`SET_IDENTITY_NAME` on confirm), `134` (the field).
- `app/src/main.jsx:41-43` — the app renders under `StrictMode`; `main.jsx:36`
  calls only `createSyncTriggers(getAppStore())` and does not open.
- `app/src/songs/FirstRun.behavior.test.jsx:17-23` — the recording-store
  pattern (`createStore({ postMessage: (m) => sent.push(m) })`).
- `app/src/App.test.jsx` — the existing App behavior cases (theme root,
  navigation shell, default destination, axe).
- `e2e/web/tests/save-sheet.spec.js:108-127` — 'the first save asks for a
  name and the second does not' (same session, no reload); its helpers
  `openExampleBook`, `openSongInEditor` (`e2e/web/lib/journeys.js`),
  `addSection`, `openSaveSheet` (`e2e/web/lib/journeys-edit.js`).
- Workflow 4 §The save sheet — the name is asked once, then kept.

## Constraints / requirements

- **One sender.** OPEN is sent from `App` only; the AppShell effect is
  removed (not duplicated), and its comment moves with it, updated to say
  why the root owns it (every mount, including `#dev/*`, and above
  `LocaleRoot`'s remount).
- **Once per mount of App.** The effect depends on `[store]` only, so a
  `hashchange` re-render (`useHashRoute`) or a language-change remount of
  `LocaleRoot`'s subtree sends no further OPEN. StrictMode's dev-only
  double-invoke may still post twice, as it does today; the Worker is
  idempotent (Decision 2).
- **Offline first / the Worker owns the data** (DIRECTION §3.7): the main
  thread still only posts a command; nothing new touches IndexedDB, and
  nothing waits on the network.
- Components rendered without `App` (behavior tests that mount `AppShell`
  directly — `AppShell.behavior.test.jsx`, `NewSong.behavior.test.jsx`) do
  not rely on AppShell's OPEN today (neither asserts it); they must stay
  green unchanged.
- No user-visible change: no copy, no layout, nothing for axe to newly find.

## Acceptance criteria

Behavior: a cold boot or reload straight into any `#dev/*` mount brings the
Worker up — READY and the preferences slice arrive — exactly as a boot into
the shell does; the shell route still sends OPEN; AppShell no longer sends
it.

Tests, by level:

- **behavior** — `app/src/App.test.jsx`, a new `describe('App brings the
  Worker up')` rendering `<App store={store} />` over the recording store of
  `FirstRun.behavior.test.jsx:17-23` (no StrictMode), with `location.hash`
  set before render and reset in `afterEach`:
  - 'a boot into a dev mount sends OPEN once' — hash `#dev/chart` (no store
    consumer, so OPEN can only come from App) and `#dev/files?book=b&path=`
    (a store-consuming mount), each: exactly one `CommandKind.OPEN` in
    `sent`. Pins the note's behavior test.
  - 'a boot into the shell sends OPEN once' — no hash: exactly one OPEN
    (the move loses nothing; AppShell no longer adds a second).
  - 'a hash change does not open again' — boot at no hash, then set
    `location.hash = '#dev/chart'` and dispatch `hashchange` inside `act`:
    still exactly one OPEN.
  The existing axe case keeps the root axe-clean.
- **e2e-web** — `e2e/web/tests/save-sheet.spec.js`, new case 'a name kept in
  the home book is not asked again after a reload', on the harness's three
  viewport projects: `openExampleBook`, open Morning on the Porch in the
  editor, `addSection`, save through the sheet filling "Your name"; then
  `page.reload()` (a cold boot back into the shell), open Morning in the
  editor again through the real UI, make an edit, press Save: the sheet shows
  **no** "Your name" textbox (`toHaveCount(0)`), axe-clean on the sheet, and
  Save closes it. Pins workflow 4 §The save sheet (asked once, then kept)
  across a reload — the durability the parking-lot entry asked about. It
  does not exercise this task's move (the shell route sent OPEN before it
  too): the dev-mount bring-up is the behavior cases' to pin, since the e2e
  lint rule keeps dev mounts out of specs.

Nothing deferred.

## Decisions

1. **Move the effect to `App`, rather than add `store.open()` to each dev
   mount.** The note settles it, and it is the one place every mount passes
   through — eight dev mounts today, more as surfaces stand up, each of
   which would otherwise have to remember. Keeping the effect in AppShell as
   well would make the shell route post OPEN twice for no gain.
2. **Do not memoise `open()` on the main thread.** The Worker is already
   idempotent (`ensureOpen`, the scheduler, persistence asked once — pinned
   by `fs.behavior.test.js:56-68`), and the only double post left is
   StrictMode's dev-only effect re-run. A main-thread guard would also break
   the Worker-backed behavior tests that call `store.open()` on purpose to
   reopen a fresh Worker over the same store (e.g.
   `save-preview.behavior.test.js:154-171`). The behavior tests render
   without StrictMode, so "exactly one OPEN" is a meaningful assertion.
3. **The effect sits in `App` itself, above `ThemeRoot`/`LocaleRoot`**, not in
   a new wrapper component: it is one line with one call site, and placing
   it above `LocaleRoot` is what stops the language-change remount from
   re-opening.
4. **The e2e case lives in `save-sheet.spec.js`**, beside the same-session
   name case it extends, instead of a new spec: it pins the same workflow
   promise across a reload. It reloads into the shell, not a `#dev/*` mount:
   the e2e lint rule keeps dev mounts out of specs, and the bug this task
   fixes reaches no user. (Revised 2026-10-15: the first version reloaded
   into `#dev/editor`, which the gate's lint rejected; the dev-mount
   bring-up is pinned by the behavior cases instead.)

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- `app/src/App.jsx`: the Worker bring-up (`store.open()`) moved here from `AppShell`'s mount effect, with its comment; it runs once per App mount, above `LocaleRoot`, so a hash change or a language change does not re-send it.
- `app/src/shell/AppShell.jsx`: no longer sends OPEN.
- `app/src/App.test.jsx`: `describe('App brings the Worker up')` — a boot into a dev mount (`#dev/chart`, `#dev/files?…`) sends OPEN once, a boot into the shell sends OPEN once, a hash change does not open again.
- `e2e/web/tests/save-sheet.spec.js`: 'a name kept in the home book is not asked again after a reload', on the three viewports, with axe.
- The first implementation's e2e case reloaded into `#dev/editor` and failed the gate's lint (no `#dev/*` in specs); the refinement was revised to reload into the shell (Decision 4).

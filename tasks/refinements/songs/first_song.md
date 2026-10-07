# songs.first_song — Playing on guitar — change?

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task first_song` under `task songs`
(`tasks/60-songs.tji:22-27`). Dependencies as declared:

```
depends !reading, music.instruments
```

and the parent cascade `task songs depends shell.layout, shell.chart,
foundation.e2e_web`. The one-line note:

> "The one-time prompt the first time a song is opened. Workflow 1. Tests:
> behavior (the prompt once, axe); e2e-web (the first song opened asks, the
> second does not)."

Not a `cifra.md:` task.

## Effort estimate

0.5d. A small, bounded feature on a host that already exists: one inline
banner in the reading view, one new Worker command writing a single
preferences register (mirroring an existing one), and two levels of test.

## Repository

estante-de-cifras only. The app (`app/src/`): the reading view
(`app/src/songs/`), the Worker protocol and preference write-path
(`app/src/worker/`), and the e2e-web harness (`e2e/web/`). No cifra.md work.
No design delta (see Decision 6).

## Inherited dependencies

- **`songs.reading`** — *settled, Done 2026 (see
  [`reading.md`](reading.md)).* Built the reading view
  `app/src/songs/SongReading.jsx` (`export default function SongReading`,
  the only React layer for reading), the ephemeral "which song is open"
  state in the shell, and the `song`/`instruments`/`preferences` slices the
  view reads. It already mounts `<InstrumentChip>` in the reading header and
  holds `const [instrumentsOpen, setInstrumentsOpen] = useState(false)`
  driving `<InstrumentsOverlay>` — so the "Change instrument" path this task
  needs is already wired.
- **`music.instruments`** — *settled, Done (see
  [`../music/instruments.md`](../music/instruments.md)).* Built the
  `instruments` slice and its Worker projection (`app/src/worker/instruments.js`),
  the `instrumentInUse` preference register (**absent means the standard
  guitar** — `fromCatalog('6guitar','Standard')`, nothing stored), the
  `USE_INSTRUMENT` command that writes it, and `InstrumentChip` /
  `InstrumentsOverlay`. Adding the first instrument sets it in use; switching
  is explicit, one tap.
- Parent cascade `shell.layout`, `shell.chart`, `foundation.e2e_web` — all
  settled (the reading view and the e2e-web harness exist and ship tests).

## What this task is

The first time any song is opened on a fresh install, the reading view shows
a one-time inline notice — **"Playing on guitar — change?"** — with a *Change
instrument* button and a *Keep guitar and dismiss* control. It is the moment
the instrument-in-use first becomes visible (the song shows its shapes), so
it is the moment to ask. Dismissing it, or changing the instrument, means it
is never shown again. The task is the banner, the durable "answered" flag,
and the small Worker command that persists it.

## Why it needs to be done

Explore Chords made the instrument the app's identity and set it up before
anything else; Estante puts the song first, so the instrument defaults to a
standard guitar and the one moment it is surfaced is the first reading view
(workflow 1 §The instrument). Without this prompt a new user never learns the
chart's shapes are for a guitar they can change — the default would be silent.
It depends on `songs.reading` for its host and `music.instruments` for the
instrument-in-use seam it reads and (via *Change instrument*) edits. It has no
downstream consumers; it is a leaf.

## Inputs / context

### Governing design

- **Workflow 1 §The instrument** (`docs/workflows/01-first-run.md:60-71`):
  the instrument defaults to a standard guitar shown as a header chip; "**The
  first time a song is opened**, the reading view says *playing on guitar —
  change?* once … Dismissing it, or changing the instrument, means it is not
  asked again."
- **DIRECTION §3.2 Personal state** (`docs/DIRECTION.md:136-152`): which
  instrument is in use, and preferences generally, live in the **home book**,
  committed automatically — "explicit save is for what the user authors, not
  for preferences." The home book is local from the first minute and gains a
  remote on sign-in.
- **DIRECTION §3.7 The app** (`docs/DIRECTION.md:394-435`): React with React
  Aria Components; one data owner, the Web Worker (the main thread never
  touches IndexedDB); the view mirrors the Worker through slices read with
  `useSyncExternalStore`.
- **home-book-format §4.1 `preferences.json`** (`docs/home-book-format.md:189-214`):
  a flat map of singleton preference registers `{ value, at }`; a register
  that is absent carries its own meaning (theme absent → automatic; authorName
  absent → ask once at the first save). The key list is descriptive.

### The mockup (what the drawings decide)

- **W01, the tablet board** (`docs/mockups/W01-first-run.dc.html:93-108`):
  the prompt is an inline `notice accent` strip at the top of the reading
  view's scroll body — **"Playing on guitar** — change?"**, a `btn` labelled
  *Change instrument*, and an icon `btn` with `aria-label="Keep guitar and
  dismiss"` (an ✕). It sits above the chart, not over it; the app bar,
  instrument chip and chart stay visible and reachable behind nothing. The
  board-sub (`:20`) states "The instrument is asked about once, the first
  time a song shows it."

### The code seams this extends

- **`app/src/songs/SongReading.jsx`** — the host. `SongReading` already reads
  the `instruments` slice (via `<InstrumentChip>` / `inUseEntry`) and the
  `preferences` slice (`preferences?.notation?.value`), and already owns
  `instrumentsOpen` state + `<InstrumentsOverlay>`. The banner is new markup
  in its scroll body; *Change instrument* calls the existing
  `setInstrumentsOpen(true)`.
- **`app/src/instruments/InstrumentChip.jsx`** — `inUseEntry(slice)` picks the
  in-use entry else the standard-guitar fallback; `displayLabel(entry)` is the
  label. The banner's gate reuses "is the in-use instrument the implicit
  standard guitar?" — i.e. `preferences.instrumentInUse` absent.
- **`app/src/worker/preferences.js`** — `surfacePreferences(model)` projects
  preferences.json registers into the `preferences` slice (drops non-registers).
  A new `instrumentPromptSeen` register surfaces through it with no projection
  change.
- **`app/src/worker/protocol.js`** — `CommandKind` and `EventKind`. The
  `SET_IDENTITY_NAME` command (`:136-142`) is the exact precedent: it writes
  one `authorName` register into preferences.json, auto-commits locally, never
  pushes, and re-surfaces `PREFERENCES` "so the first save is the only one
  that asks." `USE_INSTRUMENT` (`:167-168`) writes `instrumentInUse` the same
  way. The new command for this task is modelled on both.
- **`app/src/worker/logic.js`** — the command handlers; `SET_IDENTITY_NAME`'s
  write path (around `:760-777`) and `USE_INSTRUMENT`'s (around `:1334-1345`,
  `changes: [{ path: ['instrumentInUse'], value: id }]`) are the templates for
  the new write.
- **`app/src/theme/ThemeRoot.jsx`** — mounts react-aria `UNSAFE_PortalProvider`
  at the `.est` token root app-wide, so any RAC control the banner uses is
  themed and labelled with no per-component portal wiring.

## Constraints / requirements

- **View/Worker boundary (DIRECTION §3.7).** The banner is view-only React.
  "Which song is open" and the banner's presence are computed from slices +
  ephemeral `useState`, never a new store slice. The main thread never touches
  IndexedDB or git; it reads the `preferences`/`instruments` slices and writes
  through `store.send(command(...))`.
- **Personal state in the home book, auto-committed, never pushed (DIRECTION
  §3.2).** The "answered" flag is a preference: the Worker writes it to
  preferences.json, canonicalises, commits locally under the device identity,
  and does **not** push — exactly as `SET_IDENTITY_NAME` and `USE_INSTRUMENT`
  do. The home book is provisioned locally if it does not yet exist.
- **Offline first.** Dismissing (or changing) works with no network: the write
  is a local commit; a push, if the home book has a remote, rides the normal
  sync, never blocking the dismiss.
- **Accessibility.** The banner is built from React Aria Components (a
  `Button` pair), reachable and operable by keyboard; axe at WCAG 2.1 AA on
  the reading screen with the banner present. Status is carried by the words
  ("Playing on guitar — change?", the ✕'s `aria-label` "Keep guitar and
  dismiss"), never colour alone.
- **Not a modal.** The banner is an inline notice in the scroll body (mockup
  `notice accent`); it must not aria-hide the shell chrome or chart behind a
  scrim (project memory: an open RAC Modal aria-hides background content).
- **No song text in logs or in the command.** The new command carries only the
  device commit identity and the boolean — no song text, no path.
- **No regression.** The reading view's existing axe-clean state and its
  behavior tests stay green with the banner added.

## Acceptance criteria

### Behavior delivered

1. On a fresh install, opening the **first** song shows the inline notice
   "Playing on guitar — change?" with a *Change instrument* button and a
   *Keep guitar and dismiss* (✕) control, above the chart, in the reading
   view (workflow 1 §The instrument; mockup W01 `:104-108`).
2. Activating **Keep guitar and dismiss** removes the notice and records the
   prompt as answered; it is never shown again — on this song, any later song,
   or after a reload.
3. Activating **Change instrument** opens the existing instruments overlay and
   records the prompt as answered; whether or not the user completes a change,
   the notice is not shown again.
4. The notice never appears when an instrument other than the implicit
   standard guitar is already in use (`instrumentInUse` present) — the user
   has already chosen (instruments.md: adding the first instrument sets it in
   use), and the copy is fixed to "guitar".
5. The flag lives in the home book preferences (`preferences.json`), so it
   follows the user across devices: a user who settled their instrument on one
   device is not re-asked on the next (workflow 1; DIRECTION §3.2).

### Tests the task lands with, by level

- **behavior — `app/src/songs/SongReading.behavior.test.jsx`** (extends the
  existing reading-view suite; real RAC + i18n, a loopback-backed store with
  seeded slices, axe over `container`):
  - *The prompt on first open* — with `instrumentInUse` and
    `instrumentPromptSeen` both absent, the notice renders with its text, the
    *Change instrument* button and the *Keep guitar and dismiss* control; axe
    clean. *Pins workflow 1 §The instrument (L66-71), mockup W01 `:104-108`.*
  - *Dismiss keeps guitar and never asks again* — activating the ✕ sends
    `MARK_INSTRUMENT_PROMPT_SEEN`; after the `PREFERENCES` re-surface with the
    register set, the notice is gone and a freshly opened second song shows no
    notice. *Pins "Dismissing it … means it is not asked again" (workflow 1).*
  - *Change instrument opens the overlay and marks it seen* — activating
    *Change instrument* opens `<InstrumentsOverlay>` (`instrumentsOpen` true)
    and sends `MARK_INSTRUMENT_PROMPT_SEEN`. *Pins "changing the instrument
    means it is not asked again" (workflow 1).*
  - *No prompt when a non-default instrument is in use* — with `instrumentInUse`
    present, the notice never renders. *Pins AC 4 / the fixed "guitar" copy.*
  - *No prompt once seen* — with `instrumentPromptSeen` present, no notice.
  - *Keyboard* — the dismiss and change controls are reachable and operable by
    keyboard (RAC `Button`s). *Pins the §3.7 accessibility rule.*
- **behavior — `app/src/worker/instrument-prompt.behavior.test.js`** (new; the
  in-process Worker rig — loopback + fake-indexeddb + `installWebLocks`,
  provisioning a local home book):
  - *The command writes one register* — `MARK_INSTRUMENT_PROMPT_SEEN` writes
    `instrumentPromptSeen` into `preferences.json` under the book lock,
    canonical, and re-emits `PREFERENCES` with the register set. *Pins
    home-book-format §4.1 register semantics.*
  - *Auto-committed, never pushed* — the write makes one local commit on the
    home book and no push, even with a remote configured. *Pins DIRECTION §3.2
    (preferences auto-commit; explicit save/push is for authored content).*
  - *Provisions a local home book when absent* — on a brand-new profile the
    command creates the local home book before writing. *Pins workflow 1 §The
    home book.*
- **e2e-web — `e2e/web/tests/first-run.spec.js`** (extends the workflow-1
  journey; compose stack, phone / tablet / computer projects, axe at WCAG 2.1
  AA):
  - *The first song asks, the second does not* — on a fresh profile open the
    first song: the "Playing on guitar — change?" notice shows; dismiss it;
    open a second song: no notice. Across the three viewports; axe on the
    reading screen with the notice present. *Pins the .tji note's e2e clause
    and workflow 1 §The instrument.*
  - *Dismissal survives a reload* — after dismissing, reload the app and open a
    song: still no notice (persisted in the home book). *Pins AC 2 durability /
    DIRECTION §3.2.*

The note names behavior and e2e-web; this refinement keeps both and does not
add a unit level — the show/hide is a two-register absence check fully
exercised through the view behavior test, and the Worker write is a
single-register change exercised through the Worker behavior test (Decision 7).

### Deferred work (closer registers in the WBS)

(none) — the *Change instrument* destination is the instruments overlay
already owned by `music.instruments` and already mounted in the reading view;
this task adds no new seam and no follow-up leaf.

## Decisions

1. **The "answered" flag is a home-book preference register
   `instrumentPromptSeen` (follows the user).** *Chosen:* the instrument in use
   is personal home-book state that follows the user across devices (DIRECTION
   §3.2); its acknowledgement should too, and the `authorName` ask-once
   precedent stores its answer in preferences.json. *Rejected:* the device-local
   `meta` store (where recents live) — it would re-nag on every new device even
   after the user settled their instrument, which the home-book store avoids.
   *Also rejected:* storing no flag and treating "`instrumentInUse` was written"
   as the sole suppressor — it fails the keep-guitar-and-dismiss path, which
   writes no instrument.
2. **The banner shows iff `instrumentInUse` is absent (implicit standard
   guitar) AND `instrumentPromptSeen` is absent.** *Chosen:* the copy is fixed
   to "guitar" (workflow 1, mockup W01), and a user who already set up an
   instrument has already chosen (instruments.md: the first instrument added is
   set in use), so there is nothing to ask. *Rejected:* a generic "Playing on
   {instrument} — change?" for any in-use instrument — it contradicts the fixed
   copy and would ask a user who has already decided.
3. **Both banner controls mark the prompt answered; *Change instrument* also
   opens the existing overlay.** *Chosen:* engaging with the question answers
   it, so opening the picker and backing out does not bring the banner back —
   the gentler, less-naggy reading of "asked once." *Rejected:* marking it
   answered only on a completed instrument change — it would re-show the banner
   whenever the user opens the picker and cancels.
4. **The prompt is an inline RAC notice banner in the reading view's scroll
   body, not a modal.** *Chosen:* the mockup draws an inline `notice accent`
   strip; a dismissible once-nudge should not seize focus or hide the chart.
   *Rejected:* a RAC `Modal`/`alertdialog` — it would aria-hide the shell
   chrome and chart behind a scrim (project memory) and demand a focus trap,
   far too heavy for this.
5. **A dedicated Worker command `MARK_INSTRUMENT_PROMPT_SEEN`
   (`'mark_instrument_prompt_seen'`), payload `{ author }`, written on the model
   of `SET_IDENTITY_NAME`.** It writes `changes: [{ path:
   ['instrumentPromptSeen'], value: true }]` into preferences.json, provisions a
   local home book if absent, auto-commits locally, never pushes, and
   re-surfaces `PREFERENCES`. *Rejected:* a generic `SET_PREFERENCE` command —
   none exists; the codebase uses one explicit command per preference write
   (`USE_INSTRUMENT`, `SET_IDENTITY_NAME`), keeping each handler's intent clear.
6. **No design delta; no `home-book-format.md` edit.** *Chosen:* the behavior
   is already fully designed in workflow 1 §The instrument and drawn in mockup
   W01; the new register rides the generic key-by-key register merge, the
   validator is kind-based not key-based, and §4.1's key list is descriptive —
   the precedent `music.instruments` set when it added `instrumentInUse` without
   amending the format. *Rejected:* amending `home-book-format.md` §4.1 — it is
   outside this refinement's file scope and unnecessary, the format being open
   to new preference keys by design.
7. **No unit level added.** *Chosen:* the note names behavior + e2e-web; the
   only pure logic is a trivial two-register absence predicate (covered by the
   view behavior test) and a one-register write (covered by the Worker behavior
   test). *Rejected:* a standalone unit test for the predicate — it would pin
   nothing the behavior tests do not, against the "proportionate" guidance.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-07.

- New `MARK_INSTRUMENT_PROMPT_SEEN` command in `app/src/worker/protocol.js`; handler in `app/src/worker/logic.js` writes `instrumentPromptSeen` register, provisions local home book, auto-commits, re-surfaces `PREFERENCES`, never pushes.
- Inline `notice accent` banner in `app/src/songs/SongReading.jsx` + `app/src/songs/reading.css`: renders when both `instrumentInUse` and `instrumentPromptSeen` are absent; *Keep guitar and dismiss* (✕) and *Change instrument* buttons both mark seen; *Change instrument* also opens the existing instruments overlay.
- i18n keys added across all four locale files: `app/src/i18n/locales/{en,pt-BR,it,es-419}.js`.
- Behavior tests (view) in `app/src/songs/SongReading.behavior.test.jsx`: 6 new cases covering first-open/axe, dismiss→second-song clean, change-opens-overlay+marks-seen, no-prompt-when-in-use, no-prompt-once-seen, keyboard reachability.
- Behavior tests (worker) in `app/src/worker/instrument-prompt.behavior.test.js` (new file): 3 cases — register write + PREFERENCES re-surface + reload durability; provisions home book when absent; auto-commit/no-push with remote configured.
- e2e-web tests in `e2e/web/tests/first-run.spec.js`: 2 new cases — first-song-asks/second-does-not (3 viewports, axe); dismissal survives reload.

# shell.display_preferences — Density and chord-diagram display

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 92–97, `task display_preferences`
("Density and chord-diagram display") inside `task shell`.

Note: _"As design.display_preferences decides: density and the diagram's
left-handed mirror and horizontal neck as home-book preferences, chosen on the
account screen, applied by ThemeRoot (density class) and ChordBox (mirror,
orientation) in the explorer and the picker. Source: tasks/parking-lot.md
2026-10-14. Tests: unit (ChordBox geometry mirrored and rotated; preference
defaults); behavior (choosing each re-renders; axe in each density and
orientation); e2e-web (a preference chosen, kept across a reload, on the three
viewports; axe)."_

## Effort estimate

2 days (`tasks/50-shell.tji:93`).

## Repository

**estante-de-cifras** only, nothing under `cifra.md/`. All in `app/` and
`e2e/web/`:

- `app/src/theme/resolve.js` — `resolveDensity`, `resolveDiagramDisplay`, the
  value sets.
- `app/src/theme/ThemeRoot.jsx` — density from the preferences slice; provides
  the diagram display context.
- `app/src/theme/display-context.js` — new: the React context carrying
  `{ handed, orientation }`.
- `app/src/diagram/ChordDiagram.jsx`, `app/src/diagram/chord-diagram.js`,
  `app/src/diagram/diagram.css` — read the context, pass the options to the
  renderer, lay out a horizontal neck.
- `app/src/worker/protocol.js`, `app/src/worker/logic.js` — three commands.
- `app/src/account/AccountScreen.jsx`, `app/src/account/account.css` — the
  Density and Chord diagrams groups.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the copy.
- `e2e/web/lib/journeys-account.js` — `chooseDensity`, `chooseDiagramHand`,
  `chooseDiagramNeck`.
- Tests named under Acceptance criteria.

`app/src/render/*` is not edited: the carried renderer already draws both
options. No design delta — `design.display_preferences` wrote every document
edit this task implements.

## Inherited dependencies

All **settled** (`complete 100`):

- **`shell.tokens`** ([`tokens.md`](tokens.md)) — `ThemeRoot` applies
  `est theme-<applied> density-<density>`, with density fixed at
  `comfortable` because no register existed (tokens.md Decision, lines
  339–348; Status line 381). This task replaces the fixed value.
- **`shell.diagram`** ([`diagram.md`](diagram.md)) — `ChordDiagram`
  (`app/src/diagram/ChordDiagram.jsx:33`) wraps the carried renderer and
  forwards only `size` (L35). The renderer already takes
  `{ orientation, handed }` (`app/src/render/diagram.js:28-32`
  `DEFAULT_OPTIONS`; mirror applied once in `diagramModel`, L41 and the
  `display` mapping; `renderDiagram` dispatches `orientation === 'horizontal'`
  to `renderNeck`, `app/src/render/index.js:48-71`, both in the cache key).
- **`design.display_preferences`**
  ([`../design/display_preferences.md`](../design/display_preferences.md)) —
  the registers, copy, placement and board. Governing for this task.
- **`storage.preferences_surface`**
  ([`../storage/preferences_surface.md`](../storage/preferences_surface.md)) —
  `surfacePreferences` (`app/src/worker/preferences.js:31`) passes every
  well-formed `{value, at}` register through by shape, not by key, and injects
  no defaults; the reducer replaces the `preferences` slice wholesale
  (`app/src/worker/reducer.js:409-414`). New registers therefore surface with
  no change there.
- **`account.account_screen`**
  ([`../account/account_screen.md`](../account/account_screen.md)) — the
  Preferences section (`app/src/account/AccountScreen.jsx:430-461`), the
  `PickerRow` radio with the word *Selected* (L168-187), and the per-register
  Worker command template `SET_THEME` / `SET_LANGUAGE`
  (`app/src/worker/protocol.js:256-268`; `app/src/worker/logic.js:1749-1799`).

The e2e prerequisites all exist: the account screen (`openAccount`,
`e2e/web/lib/journeys-account.js:31`; `chooseTheme` L178 as the template), the
explorer (`openExplorerFor`, `e2e/web/lib/journeys-core.js:146`, from
`music.explorer`), the in-song picker (`enterArrange` L35 and `arrangeChord`
L47 in `journeys-core.js`, as `e2e/web/tests/arrange.spec.js:37-49` reaches the
picker dialog, from `songs.arrange`), the example book (`openExampleBook`,
`openSongFromSearch` in `e2e/web/lib/journeys.js`) and `startApp`
(`journeys.js:26`) for the reload. No sign-in is needed: preferences are
writable before sign-in (workflow 13 §The account screen), and the reload
journey is one device.

## What this task is

Three new choices on the account screen's Preferences section, between Theme
and Language: **Density** (Compact / Comfortable / Roomy) and **Chord
diagrams** — **Hand** (Right-handed / Left-handed) and **Neck** (Vertical /
Horizontal) — each a labelled radio group, with a live sample. Each choice is
written to the home book's `preferences.json` as its own register
(`density`, `diagramHanded`, `diagramOrientation`), synced like theme and
language. `ThemeRoot` applies the chosen density class to the app root;
every `ChordDiagram` in the app draws mirrored and/or as a horizontal neck as
chosen — the explorer and the in-song picker named by the note, and every
other caller, as the design decided (design Decision 4).

## Why it needs to be done

`design.display_preferences` decided and drew the three preferences and
edited home-book-format §4.1, workflows 1, 13 and 16 and DIRECTION §3.2/§6;
those documents now promise behavior the app does not have (the Theme-picker
board's Density and Chord diagrams groups; workflow 16 §How diagrams are drawn
retired the *Out of scope* bullet). Density has been a render axis locked at
comfortable since `shell.tokens`; the left-handed / horizontal toggles Explore
Chords offered were parked by `music.explorer` (explorer.md lines 412–414).
It is the last dependency on milestone M5's list for these two parking-lot
items (`tasks/99-milestones.tji:44`). `account.preferences_layout` (pending)
then re-lays the whole Preferences section as the board draws it.

## Inputs / context

- **home-book-format §4.1** (`docs/home-book-format.md` L189–233): the
  registers — `density` `"compact" | "comfortable" | "roomy"`, absent =
  comfortable (L218–221); `diagramHanded` `"right" | "left"`, absent = right
  (L222–224); `diagramOrientation` `"vertical" | "horizontal"`, absent =
  vertical (L225–228); choosing the default again writes the tombstone; an
  unknown value reads as the default and is left as it is (L230–233).
- **Workflow 1 §Density** (`docs/workflows/01-first-run.md` L120–141): the
  three choices in words with a one-line description and a live sample;
  *Selected* marks the chosen one; at once on every screen, nothing waits on
  the network; synced; changes spacing and the chart's size, never the chart.
- **Workflow 16 §How diagrams are drawn**
  (`docs/workflows/16-chord-explorer.md` L193–228): Hand — left-handed is the
  strings in opposite order, on the vertical box an exact mirror (L199–202);
  Neck — horizontal is nut at the left, frets to the right, lowest string at
  the top, at the bottom when left-handed, as `app/src/render/neck.js` draws
  it (L203–206); chosen in Preferences with one live diagram (L208–214);
  applies to every chord diagram (L216–221); the accessible name
  (`describeFingering`), the starting fret and *your shape*/*default* are
  unchanged (L223–228).
- **Workflow 13 §The account screen** (`docs/workflows/13-new-device.md`
  L136–146): the order theme, density, chord diagrams, language; chosen
  marked by a word; present and writable before sign-in.
- **DIRECTION** §3.2 (pointer at L139) and §6 *Display preferences* (L613–).
- **Board**: `docs/mockups/Theme-picker.dc.html` — copy in its script
  L446–500: `DENS` L449–453 (Compact "Smaller, more in view" / "Tighter
  spacing, a smaller chart — more of a song in view"; Comfortable "The
  default"; Roomy "Larger, read from further" / "Looser spacing, a larger
  chart — read from further away"), `HAND` L458–461 ("Right-handed" / "The
  default · lowest string on the left"; "Left-handed" / "Mirrored · lowest
  string on the right"), `NECK` L462–465 ("Vertical" / "The default · the nut
  at the top"; "Horizontal" / "The nut at the left, frets to the right"); the
  caption "Changes how a shape is drawn, never which shapes are found. Every
  diagram follows it." (L78, L155); the density sample chip — a chart line
  drawn at the option's `--chart-size` (15/17/19px), aria-hidden; the diagram
  sample C `x32010`. Group headings *Density*, *Chord diagrams*; sub-labels
  *Hand*, *Neck*. The board gives English copy only.
- **Tokens**: `app/src/theme/theme.css:274-276` — `.est.density-compact
  { --u: 6px; --chart-size: 15px }`, `-comfortable { --u: 8px }`, `-roomy
  { --u: 10px; --chart-size: 19px }`.
- **Code seams**:
  - `app/src/theme/resolve.js:14-39` — `THEMES`, `CHOSEN_THEMES`,
    `DENSITIES` (L23), `DEFAULT_DENSITY` (L24, with the "no chooser, no
    persistence" comment L20–22 this task retires), `resolveTheme`,
    `themeClasses` (L37–39).
  - `app/src/theme/ThemeRoot.jsx:60-70` — `ThemeRoot({ store, density =
    DEFAULT_DENSITY, children })`, reads `useSlice(store,'preferences')` (L61).
    Mounted in `app/src/App.jsx:197-229` with no density prop.
  - `app/src/diagram/ChordDiagram.jsx:33-39`, `chord-diagram.js:55`
    `diagramSvg`. Callers: `music/FingeringGroups.jsx:46` (used by the
    explorer, `music/ChordExplorer.jsx:204,223`, and the in-song picker,
    `songs/SongArrange.jsx:459`), `songs/SongArrange.jsx:348`,
    `songs/SongReading.jsx:423`, `songs/SongWizard.jsx:349`,
    `songs/SongConflict.jsx:110`, `music/EnterShape.jsx:134`,
    `instruments/MyShapes.jsx:40`.
  - The renderer's SVG root carries `ec-diagram-vertical` /
    `ec-diagram-horizontal` (`render/chord-box.js:161`, `render/neck.js:102`);
    click targets map display strings back to logical strings
    (`render/chord-box.js:136-140`).
  - Worker: `case SET_THEME` (`logic.js:1749-1776`): validate, default →
    `null`, `home.ensureLocal` → `home.set({ bookId: HOME_BOOK_ID, file:
    'preferences.json', changes: [{ path: ['theme'], value }], author })` →
    `surfaceHomeBookPreferences()` (L970–976) → `ensureFs().flush()`.
  - Account screen: `THEME_OPTIONS` L77–82, `PickerRow` L168–187, choosers
    L280–303, `preferencesRegion` L430–461.
  - i18n: `account:` block in `app/src/i18n/locales/en.js` L676–705; parity
    across the four locales checked by `i18n.test.js`.
- **Existing tests this task extends**: `app/src/render/render.test.js` (L92
  "left-handed rendering is an exact mirror", L117 "horizontal neck"),
  `app/src/diagram/chord-diagram.test.js`,
  `app/src/diagram/ChordDiagram.behavior.test.jsx`,
  `app/src/theme/resolve.test.js`, `app/src/theme/ThemeRoot.test.jsx` (L80–95,
  density × theme with the `density` prop), `app/src/App.test.jsx:19-24`,
  `app/src/account/AccountScreen.behavior.test.jsx` (`renderAccount` L134 in a
  real `ThemeRoot` over a loopback Worker; round trip L198),
  `app/src/worker/preferences-theme-language.behavior.test.js`,
  `e2e/web/tests/account-screen.spec.js:53-77` (theme kept across a reload).

## Constraints / requirements

- **The registers are home-book-format §4.1's**, by name and value set:
  `density`, `diagramHanded`, `diagramOrientation`. Choosing the default
  (Comfortable, Right-handed, Vertical) writes the tombstone `{ value: null,
  at }`, never the literal default (design Decision 3; account_screen.md
  Decision 3). Absent, tombstone and the default value are one state.
- **An unknown value reads as the default and is never rewritten** (§4.1
  L230–233): the resolvers map anything outside the value set to the default;
  the account screen then marks the default *Selected*; nothing writes until
  the user chooses.
- **Defaults live in the resolvers, never in the data**
  (preferences_surface.md Decision 5): `surfacePreferences` and the reducer are
  not changed.
- **Writes follow the per-register command template**, one Worker command per
  register, each validating its value at the boundary (throw → ERROR event, no
  write), auto-committed to the home book, never pushed by the command itself;
  sync carries it (account_screen.md Decision 2). The view never touches
  IndexedDB (DIRECTION §3.7); it only `store.send`s and reads the slice — no
  optimistic local state (account_screen.md lines 264–268).
- **Display only.** Density changes `--u` and `--chart-size` via the root
  class, nothing else: no chord moves off its syllable, nothing is hidden
  (workflow 1 L138–141). Hand and neck change only how a shape is drawn: not
  which shapes are found, their order, grouping, shorthand, the accessible
  name, the starting fret, the kind word, or the shape recorded when a shape
  is entered (workflow 16 L223–228).
- **Every `ChordDiagram` follows the choice** (workflow 16 L216–221; design
  Decision 4) — not only the explorer and picker the note names — without
  threading props through the eight call sites.
- **`app/src/render/*` and `app/src/core/*` are not edited** (diagram.md
  lines 176–180); the options they already take are used.
- **Accessibility**: each group a labelled React Aria `RadioGroup` (`Density`,
  `Hand`, `Neck`, the latter two under a *Chord diagrams* heading), the chosen
  row marked by the word *Selected*, keyboard arrow paths as RAC gives them;
  the density sample chips aria-hidden (decoration — the description carries
  the meaning); the live diagram sample keeps its `describeFingering`
  accessible name. axe WCAG 2.1 AA clean in every density and in each
  hand × neck pair.
- **Order and copy** as the board: Theme, Density, Chord diagrams, Language;
  the board's English copy, translated into pt-BR, es-419 and it with key
  parity.
- **Offline first**: choosing applies at once from the re-surfaced
  `PREFERENCES` event, which follows a local commit; nothing waits on the
  network.
- Test fixtures use songs written for the purpose (the example book's), never
  anyone else's words.

## Acceptance criteria

### Behavior delivered

1. **Resolvers** (`app/src/theme/resolve.js`): `DENSITIES` stays;
   `HANDS = ['right','left']`, `ORIENTATIONS = ['vertical','horizontal']`;
   `resolveDensity(value)` → the value if in `DENSITIES`, else
   `'comfortable'`; `resolveDiagramDisplay(preferences)` →
   `{ handed, orientation }`, each the register's value if in its set, else
   `'right'` / `'vertical'`. The L20–22 "no chooser, no persistence" comment
   is replaced.
2. **ThemeRoot** reads `density` from the preferences slice through
   `resolveDensity` and drops its `density` prop (the root class now comes
   from data); it provides `DiagramDisplayContext`
   (`app/src/theme/display-context.js`, default value `{ handed: 'right',
   orientation: 'vertical' }`) with `resolveDiagramDisplay(preferences)`,
   memoised on the two values.
3. **ChordDiagram** reads the context and merges `{ handed, orientation }`
   into the renderer options with `size`; the host gains a modifier
   `chord-diagram--horizontal` when horizontal (so `diagram.css` can lay out
   the wider neck without overflowing a phone row) and
   `chord-diagram--left` when left-handed. A diagram rendered outside a
   `ThemeRoot` (existing isolated tests) draws the defaults.
4. **Worker commands** `SET_DENSITY {density}`, `SET_DIAGRAM_HANDED
   {handed}`, `SET_DIAGRAM_ORIENTATION {orientation}` in `protocol.js` beside
   `SET_THEME`, each in `logic.js` on the `SET_THEME` template: validated
   against `DENSITIES` / `HANDS` / `ORIENTATIONS` (else `'invalid density'`,
   `'invalid hand'`, `'invalid orientation'`), the default written as
   `null`, the register written to `preferences.json`, the preferences
   re-surfaced, the store flushed.
5. **Account screen**: between the Theme and Language groups, a **Density**
   `RadioGroup` (three `PickerRow`s: name, description, an aria-hidden
   sample chip — one chart line drawn at that option's `--chart-size` —
   *Selected*) and a **Chord diagrams** group holding a **Hand** and a
   **Neck** `RadioGroup` (two rows each, name + description + *Selected*),
   one live `ChordDiagram` sample of C `x32010` on standard-tuned guitar
   (drawn by the same context, so it follows the choice at once), and the
   caption. Phone vs tablet/computer copy (short vs long descriptions) as the
   board; the two-column computer layout is `account.preferences_layout`'s,
   not this task's.
6. **Copy** in all four locales under the `account:` block: `density`,
   `densityCompact`/`Meta`, `densityComfortable`/`Meta`, `densityRoomy`/`Meta`
   (short and long), `diagrams`, `diagramHand`, `diagramHandRight`/`Meta`,
   `diagramHandLeft`/`Meta`, `diagramNeck`, `diagramNeckVertical`/`Meta`,
   `diagramNeckHorizontal`/`Meta`, `diagramsNote`.

### Tests, by level

- **unit — `app/src/theme/resolve.test.js`** (Vitest, extended): the
  preference defaults — `resolveDensity` of absent, `null` (tombstone),
  `'comfortable'` and an unknown `'huge'` → `'comfortable'`, of `'compact'` and
  `'roomy'` → themselves; `resolveDiagramDisplay` of `{}`, tombstones and
  unknown values → `{ handed: 'right', orientation: 'vertical' }`, of `left` /
  `horizontal` → themselves, each register independent of the other.
  *Pins:* home-book-format §4.1 L218–233.
- **unit — `app/src/diagram/chord-diagram.test.js`** (Vitest, extended): the
  geometry mirrored and rotated as the app asks for it — `diagramSvg` of a
  fixture fingering with `{ handed: 'left' }` puts the lowest string's marker
  at the mirrored x of the right-handed drawing (positions read from
  `diagramModel`, the vertical mirror exact); with `{ orientation:
  'horizontal' }` the root is `ec-diagram-horizontal` with the nut at the left
  and the lowest string at the top; with both, the lowest string at the
  bottom; the `aria-label` identical across all four pairs.
  *Pins:* workflow 16 L199–206, L223–228. (`render/render.test.js` L92/L117
  already pin the renderer itself and stay as they are.)
- **behavior — `app/src/diagram/ChordDiagram.behavior.test.jsx`** (extended):
  rendered inside a `DiagramDisplayContext` provider, each hand × neck pair
  draws the matching SVG root class and host modifiers, keeps its accessible
  name and kind word, axe-clean in each of the four; rendered with no
  provider, the defaults. *Pins:* workflow 16 L216–228.
- **behavior — `app/src/theme/ThemeRoot.test.jsx`** (L80–95 reworked from the
  `density` prop to the data): for each density × theme, a store whose
  preferences hold that `density` register renders `est theme-<x>
  density-<y>`, axe-clean; an absent, tombstoned and unknown `density` render
  `density-comfortable`; a store changing `diagramHanded` re-renders a child
  `ChordDiagram` mirrored. `App.test.jsx:19-24` keeps asserting
  `density-comfortable` on first run. *Pins:* workflow 1 §Density;
  home-book-format §4.1.
- **behavior — `app/src/worker/preferences-display.behavior.test.js`** (new,
  on the `preferences-theme-language.behavior.test.js` pattern: the Worker
  against a fake IndexedDB): `SET_DENSITY roomy`, `SET_DIAGRAM_HANDED left`,
  `SET_DIAGRAM_ORIENTATION horizontal` each commit one register to the home
  book's `preferences.json` and re-emit `PREFERENCES` carrying it; choosing
  `comfortable` / `right` / `vertical` afterwards writes `{ value: null }`;
  an invalid value emits ERROR and writes nothing; two registers set in turn
  both survive (separate registers, design Decision 1). *Pins:*
  home-book-format §4.1; account_screen.md Decision 2–3.
- **behavior — `app/src/account/AccountScreen.behavior.test.jsx`**
  (extended, `renderAccount` in a real `ThemeRoot` over the loopback Worker):
  the Density, Hand and Neck radio groups present by name between Theme and
  Language, defaults marked *Selected* on a fresh home book; choosing Roomy
  re-renders the root `density-roomy` and moves *Selected*; choosing
  Left-handed then Horizontal re-renders the sample diagram mirrored and as a
  horizontal neck; axe-clean in each density (compact, comfortable, roomy)
  and in each orientation. *Pins:* workflow 1 §Density; workflow 13 §The
  account screen L136–146; workflow 16 L208–214; Theme-picker board.
- **behavior — `app/src/music/ChordExplorer.behavior.test.jsx`** (extended;
  it already renders in a `ThemeRoot`): with `diagramOrientation: horizontal`
  and `diagramHanded: left` in the store, every candidate diagram draws
  `ec-diagram-horizontal` in a `chord-diagram--left` host, the candidates'
  order, grouping and accessible names unchanged from the default render;
  axe-clean. *Pins:* workflow 16 L216–228 (the explorer and the in-song picker
  share `FingeringGroups`).
- **unit — `app/src/i18n/i18n.test.js`** (existing): key parity over the new
  keys in the four locales.
- **e2e-web — `e2e/web/tests/display-preferences.spec.js`** (new; phone,
  tablet and computer projects; real UI only, through new
  `chooseDensity` / `chooseDiagramHand` / `chooseDiagramNeck` helpers in
  `e2e/web/lib/journeys-account.js` on the `chooseTheme` pattern):
  1. *Density kept across a reload*: `startApp` → `openAccount` → choose
     Roomy → `div.est` has `density-roomy`, Roomy marked *Selected*,
     `checkA11y()` → `startApp` again → still `density-roomy` and *Selected*;
     choose Comfortable → back to `density-comfortable`; `checkA11y()`.
     *Pins:* workflow 1 §Density; home-book-format §4.1.
  2. *Diagram display kept across a reload, in the explorer and the picker*:
     `openAccount` → choose Left-handed and Horizontal → the account sample
     is `.ec-diagram-horizontal` inside `.chord-diagram--left`, `checkA11y()` →
     `startApp` (reload) → `openExplorerFor(page, 'C')` → every candidate
     diagram `.ec-diagram-horizontal` in a `.chord-diagram--left` host,
     `checkA11y()` → `openExampleBook` / `openSongFromSearch` →
     `enterArrange` → `arrangeChord(page).click()` → the picker dialog's
     diagrams the same, `checkA11y()`. *Pins:* workflow 16 §How diagrams are
     drawn; the note's "in the explorer and the picker".

No test level is dropped. No test is deferred.

### Deferred work / graph notes

None. The board's two-column computer layout and compact rows are
`account.preferences_layout` (already in the WBS, pending, depends only on
`account.account_screen`); this task adds its groups in the current
one-column screen, and that task lays them out with the rest.

## Decisions

1. **ChordDiagram learns hand and neck from a React context ThemeRoot
   provides, not from props at each call site or a store read in
   ChordDiagram.**
   *Rationale:* ThemeRoot already reads the preferences slice and is the one
   place that turns registers into how the app looks; a context reaches all
   eight callers (design acceptance 7) with no prop threading, and
   `ChordDiagram` stays store-free so its isolated tests keep working (the
   context's default is the defaults).
   *Rejected:* `ChordDiagram` calling `useSlice(store, …)` — none of its
   callers pass a store, so it would need one threaded everywhere or a
   global; props from each caller — eight edits that can drift, and a new
   caller would forget them.
2. **Density comes from the data; the `density` prop on ThemeRoot goes.**
   *Rationale:* one source of truth; the prop existed only because no
   register did (tokens.md Decision lines 339–348). Tests set density
   through the store, as the app does.
   *Rejected:* keeping the prop as an override — a second path no caller
   uses.
3. **Three commands, one per register, on the `SET_THEME` template.**
   *Rationale:* account_screen.md Decision 2 rejected a generic
   `SET_PREFERENCE` because it loses per-key validation; three small cases
   keep the boundary check and the tombstone-on-default rule beside each
   value set.
   *Rejected:* a single `SET_DIAGRAM_DISPLAY {handed, orientation}` — the
   design keeps them as separate registers so two devices changing one each
   both survive (design Decision 1); one command writing both would re-stamp
   the untouched one.
4. **Host modifier classes `chord-diagram--left` / `--horizontal`.**
   *Rationale:* `diagram.css` needs to size a horizontal neck (wider than
   tall) inside the existing grids, and the e2e journey needs a real-UI
   observable for the mirror (the SVG root carries orientation but not hand).
   *Rejected:* editing the renderer to emit a handed class — `app/src/render/*`
   stays untouched (diagram.md lines 176–180).
5. **EnterShape's per-string controls keep their order and numbering.**
   *Rationale:* the shape is entered on a list of per-string controls named
   by string number (`music/EnterShape.jsx:84-94`), not by tapping the
   diagram; only its preview diagram follows the preference. Workflow 16's
   "taps land on the string drawn" is already true of the renderer's click
   targets, which map back to logical strings (`render/chord-box.js:136-140`),
   for whenever a surface makes the diagram tappable. The recorded shape is
   unchanged either way.
   *Rejected:* reversing the controls when left-handed — the controls are
   labelled by string number, and reordering them would make a keyboard and
   screen-reader path differ by preference with no spoken difference.
6. **The diagram sample is C `x32010` on a guitar**, as the board draws it;
   the density sample is one chart line at each option's `--chart-size`,
   aria-hidden.
   *Rationale:* the board's samples; a fixed, known shape shows the mirror
   unambiguously.
7. **Translations of the board's English copy are the implementer's,** in
   the voice of the existing `account:` strings (the board gives English
   only).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- Resolvers `HANDS`, `ORIENTATIONS`, `resolveDensity`, `resolveDiagramDisplay` in `app/src/theme/resolve.js`; `ThemeRoot` (`app/src/theme/ThemeRoot.jsx`) takes density from the preferences slice (the `density` prop is gone) and provides `DiagramDisplayContext` (`app/src/theme/display-context.js`).
- `ChordDiagram` (`app/src/diagram/ChordDiagram.jsx`, `diagram.css`) reads the context, passes `{ handed, orientation }` to the renderer and adds `chord-diagram--left` / `chord-diagram--horizontal`; every caller follows with no change.
- Worker commands `SET_DENSITY`, `SET_DIAGRAM_HANDED`, `SET_DIAGRAM_ORIENTATION` in `app/src/worker/protocol.js` and `logic.js`, on the `SET_THEME` template (default written as a tombstone, invalid value is an ERROR).
- Account screen Density and Chord diagrams (Hand, Neck) groups with a live sample between Theme and Language: `app/src/account/AccountScreen.jsx`, `account.css`; copy in the four `app/src/i18n/locales/*.js`.
- Unit: `app/src/theme/resolve.test.js`, `app/src/diagram/chord-diagram.test.js`. Behavior: `ChordDiagram.behavior.test.jsx`, `ThemeRoot.test.jsx`, `AccountScreen.behavior.test.jsx`, `ChordExplorer.behavior.test.jsx`, new `app/src/worker/preferences-display.behavior.test.js`.
- e2e-web: new `e2e/web/tests/display-preferences.spec.js` with helpers `chooseDensity`, `chooseDiagramHand`, `chooseDiagramNeck` in `e2e/web/lib/journeys-account.js`.
- No follow-up tasks; the two-column layout stays with `account.preferences_layout`.

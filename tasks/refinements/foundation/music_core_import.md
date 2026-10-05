# foundation.music_core_import — Bring the music core over, with its history

## TaskJuggler entry

`task music_core_import` in [`tasks/25-foundation.tji`](../../25-foundation.tji)
(lines 23–28), under `task foundation`. Its one line there: *"git filter-repo
of Explore Chords' src/core (minus song.js) and src/render into app/src/core,
tests passing; the DESIGN sections that explain it. DIRECTION §5, §5.1. Tests:
unit (Explore Chords' own core and render tests, carried over with their
history and passing under app/'s Vitest)."* The area header states the
stream's purpose: *"The monorepo, its tooling, the API contract, running
everything locally as in production, CI, and the two end-to-end harnesses
every later task's e2e tests are written in."*
([`tasks/25-foundation.tji`](../../25-foundation.tji) lines 1–5).

## Effort estimate

**1 day** (from the `.tji`). The work is mostly mechanical — a history-
preserving `git filter-repo` graft and a small fixup that severs the one
excluded dependency — plus proving the carried test suite green under `app/`'s
Vitest.

## Repository

**estante-de-cifras** (`/home/ruoso/devel/estante-de-cifras`), the `app/`
directory only, with **Explore Chords** (`/home/ruoso/devel/explore-chords`)
as the read-only carry-over source. The note does not start with `cifra.md:`,
so no cifra.md work lands. This task adds, under `app/src/`, the parser-free
music core and renderer carried from Explore Chords **with their git history**:
`app/src/core/` and `app/src/render/`, plus the two supporting modules they
import (`app/src/data/instruments.js`, `app/src/i18n/`), and a design doc
holding the Explore Chords `DESIGN.md` sections that explain them. No other
`app/` code is touched (the `app_tooling` scaffold — `App.jsx`, `main.jsx`,
`a11y/`, `test/` — stays as is), and nothing in `service/`, `api/` or `e2e/`
moves.

A **design delta** rides with this task:
[`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §5 and §5.1 are amended (see
§Decisions) because §5's premise — that *"`src/core/` except `song.js` …
Pure, storage-free … Carried over as is"* — is not accurate: parts of
`src/core/` consume the parsed-song model and so cannot be carried self-
contained ahead of the rewritten parser, and the core also imports an
instrument-catalogue module and i18n that §5 did not list.

## Inherited dependencies

- **`foundation.app_tooling` — settled.** Complete (`complete 100`,
  [`tasks/25-foundation.tji`](../../25-foundation.tji) lines 16–21; refinement
  [`app_tooling.md`](app_tooling.md)). It made `app/` a real plain-JavaScript
  ESM package (`"type": "module"`), with Vitest running in jsdom
  (`app/vite.config.js` `test` block: `environment: 'jsdom'`,
  `setupFiles: ['./src/test/setup.js']`, `include:
  'src/**/*.{test,spec}.{js,jsx}'`), ESLint flat config over `**/*.{js,jsx}`,
  and the gate's `estante app` lint/test/build branch live. It **named this
  task** as the music-core carry-over and explicitly drew `app/src/core`,
  `app/src/render` as *its* deliverable, reserved not created
  ([`app_tooling.md`](app_tooling.md) "Deferred work"). It also decided the
  app is **plain JavaScript, not TypeScript**, *specifically so the imported
  core needs no `allowJs` bridge* — the decision that makes this import a
  drop-in.
- **`foundation.monorepo` — settled** (via `app_tooling`): reserved `app/`
  and the repository tree (DIRECTION §3.6).
- **`bootstrap.architecture` / the direction — settled** (via `foundation`
  → `bootstrap.architecture`,
  [`tasks/25-foundation.tji`](../../25-foundation.tji) line 8): the source of
  DIRECTION §5 (what comes over from Explore Chords) and §3.7 (framework-free
  below the view).

Downstream, the whole **`music`** stream depends on this task
([`tasks/55-music.tji`](../../55-music.tji) line 7): instruments, the chord
explorer, shape fallback, transposition and the voicing wizard are *"the
music core from Explore Chords put to work"*. The deferred, parser-coupled
remainder of the carry-over (below) lands inside that stream, against
cifra.md for JavaScript.

## What this task is

Explore Chords' music core and chord-diagram renderer are pure JavaScript,
already written and tested; the app does not rewrite them, it **adopts** them —
with their history, because (DIRECTION §5.1) *"the commit messages are where
many of its decisions are explained."* This task runs a history-preserving
`git filter-repo` of Explore Chords limited to the music core's files, lands
them under `app/src/`, severs the one dependency that must not come over (the
song parser `song.js`, which is being rewritten as cifra.md for JavaScript),
and proves the carried unit tests pass under `app/`'s Vitest. It also copies
the sections of Explore Chords' `DESIGN.md` that explain the core into a
design doc beside it.

The investigation behind this refinement found that *"`src/core/` except
`song.js`"* is **not** a clean, self-contained unit, so the task draws the
cut precisely:

- **Carried now (parser-free primitives, green):** `pitch`, `chord`,
  `fingers`, `fretstring`, `errors`, `heuristics`, `score`, `search`,
  `instrument`, `chart-layout`, the `notation/` dialect parser, and
  `voicings.js`'s `defaultVoicing` / `unvoiceableKeys` — plus all of
  `src/render/` (the chord-box, neck and diagram SVG), and the two supporting
  modules these import: `src/data/instruments.js` (the instrument catalogue,
  pure data) and `src/i18n/` (the renderer's accessible labels).
- **Excluded (the rewritten parser):** `song.js` and `song.test.js` — the
  cifra parser/document model, replaced by cifra.md for JavaScript.
- **Deferred to the `music` stream (the parser-coupled layer):**
  `voicing-plan/`, `song-analysis.js`, and `voicings.js`'s two document-
  adapters `resolveSongVoicings` / `applySavedVoicings`. Each takes a *parsed
  song* as input, so it cannot run or be tested without the parser; each
  carries over, with its tests, when cifra.md for JavaScript is wired in
  (`music.wizard`, `music.fallback`).

## Why it needs to be done

The entire `music` stream — instruments and voicing rules, the chord
explorer, where a chord's shape comes from, transposing, the wizard — is the
Explore Chords core *"put to work"* ([`tasks/55-music.tji`](../../55-music.tji)
lines 1–7), and the song view renders chords through the carried diagram code
(DIRECTION §3.7, *"Charts are drawn by the app"*, and §4). None of that can
start until the core is in the tree, framework-free, and green. Doing it as a
`git filter-repo` rather than a copy keeps the decision record: the heuristics,
the scoring weights, the enharmonic-spelling rules each carry the commits that
explain them, so a later reader of `app/src/core` can `git log` the reasoning
(DIRECTION §5.1). Severing `song.js` here — not later — keeps the app from
ever shipping two parsers: the spec-divergent Explore Chords one (Appendix B
lists ~15 deviations) never enters `app/`, and every parsed-song consumer is
wired to cifra.md for JavaScript from its first commit.

## Inputs / context

- **The `.tji` note and its Tests clause** —
  [`tasks/25-foundation.tji`](../../25-foundation.tji) line 27: the
  filter-repo scope, the `song.js` exclusion, the DESIGN sections, and the
  single **unit** level this task lands with (*"Explore Chords' own core and
  render tests, carried over with their history and passing under app/'s
  Vitest"*).
- **DIRECTION §5 — What comes over from Explore Chords** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 439–470 (as amended
  by this task's delta). Bullet 1 is the carry-over list; §5.1 (lines 460–470)
  is *"No migration"* and the `git filter-repo` / DESIGN-sections instruction.
- **DIRECTION §3.7 — Framework-free below the view** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 402–404: *"The music
  core from Explore Chords and cifra.md for JavaScript know nothing of React;
  the view is the only layer that does."* The carried modules must import no
  React and no view code.
- **DIRECTION §3.6 — components and the repository tree** —
  [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 360–379, and the
  boundary *"The app and the service share no code, only the HTTP API and the
  format."* The carried core lives entirely under `app/src/`.
- **Explore Chords, the source** (`/home/ruoso/devel/explore-chords`,
  v0.15.0, ESM, Vite, Vitest 5):
  - `src/core/` — flat modules plus `notation/` (`dialects.js`, `format.js`,
    `parse.js`, `notation.test.js`) and `voicing-plan/` (`candidates.js`,
    `index.js`, `shape.js`, `index.test.js`). Tests sit **beside** the
    modules as `*.test.js`.
  - `src/render/` — `chord-box.js`, `diagram.js`, `index.js`, `neck.js`,
    `render.test.js`, and `__snapshots__/render.test.js.snap` (the Vitest
    snapshot the render test asserts against — it must travel with
    `render.test.js`).
  - `src/core/song.js` (~50 KB) and `src/core/song.test.js` — **excluded**.
    `voicings.js:23` runtime-imports `parseSong, voicingsFor, setVoicingForKey`
    from it; `song-analysis.js`, `chart-layout.js` and `voicing-plan/index.js`
    reference it in **JSDoc `@type` comments only** (no runtime edge).
  - The two cross-directory runtime imports that would dangle after a filter:
    `src/core/instrument.js:16` → `../data/instruments.js` (the `CATALOG`
    constant, 8 instruments, **no imports of its own**), and
    `src/render/diagram.js:15` → `../i18n/index.js` (`t`, `ordinal`, used to
    build the diagram's `aria-label` and the visible "voiced as" label).
  - `docs/DESIGN.md` — §2.10 "The voicing wizard", §2.11 "Entering a shape by
    hand", §4 "The music core" (pitch, chord, instrument, notation), §5
    "Fingering search" (generate → assign → score), §6 "Rendering" (geometry
    → SVG, accessibility). The sections §5.1 names to carry over.
- **The destination package** — [`app_tooling.md`](app_tooling.md) and
  `app/vite.config.js`: Vitest in jsdom, `include:
  'src/**/*.{test,spec}.{js,jsx}'` (so `app/src/**/*.test.js` is picked up
  with no config change), ESLint flat config over `**/*.{js,jsx}`, ESM
  throughout. The gate runs the app via `CI=true npm run test` →
  `vitest run` ([`scripts/gate`](../../../scripts/gate) `npm_checks "estante
  app"`).
- **Where the deferred layer lands** —
  [`tasks/55-music.tji`](../../55-music.tji): `music.wizard` (lines 33–38,
  *"Explore Chords' planners … Explore Chords' planners' tests carried over"*,
  `depends … cifra_js.editing`) is the home of `voicing-plan/`; `music.fallback`
  (lines 21–26, *"The song's choice, then my shape, then the app's default"*,
  `depends … cifra_js.reader`) is the home of `resolveSongVoicings` /
  `applySavedVoicings` and `song-analysis.js`. Both already depend
  (transitively) on this task and on a cifra.md-for-JavaScript parser.
- **Style precedent** — [`app_tooling.md`](app_tooling.md), the direct
  predecessor and the house template.

## Constraints / requirements

- **History is preserved.** The core and renderer arrive via `git
  filter-repo` + an unrelated-history merge, not a copy — `git log
  --follow app/src/core/<file>` reaches the Explore Chords commits (DIRECTION
  §5.1). A plain copy that discards history does **not** satisfy the note.
- **`song.js` never enters `app/`.** The parser is cifra.md for JavaScript;
  the spec-divergent Explore Chords parser (Appendix B) must not be carried,
  transpiled or shimmed. Severing its one runtime importer (`voicings.js`,
  via removing the two document-adapters) is part of this task.
- **Framework-free below the view** (DIRECTION §3.7 lines 402–404). Every
  carried module stays pure JavaScript importing no React and no view code;
  nothing under `app/src/core`, `app/src/render`, `app/src/data`,
  `app/src/i18n` imports from `app/src/App.jsx` or `react*`. The layout is
  preserved as in Explore Chords (`core/` and `render/` as siblings under
  `app/src/`), so every relative import in the carried code resolves
  unchanged — the note's shorthand *"into app/src/core"* is read as "under
  `app/src/`, keeping the `core`/`render` split", which is also how
  [`app_tooling.md`](app_tooling.md) and DIRECTION §3.7 name them.
- **The core is self-contained after the carry.** The two cross-directory
  imports are satisfied by carrying the modules they point at
  (`src/data/instruments.js`, `src/i18n/`) in the same graft — not by stubs —
  so the renderer's accessible labels and the instrument model keep producing
  exactly the bytes their tests and snapshot already assert.
- **Accessibility is preserved, not re-derived.** The carried `diagram.js`
  builds the chord diagram's `aria-label` from i18n; carrying `src/i18n/`
  keeps that text intact. This task renders no React component, so there is
  no axe/behavior check here — the diagram's a11y is exercised when the view
  renders it (`shell.diagram`, `music.explorer`, with axe at the e2e-web
  level). Status-by-word-not-colour is a view concern, not reached here.
- **No song text, no copyrighted words.** The carried tests use Explore
  Chords' own purpose-written fixtures (short chord progressions like
  `C | G | Am`), never anyone's lyrics; nothing new is authored here.
- **The gate stays green and now runs the carried tests.** After this lands,
  [`scripts/gate`](../../../scripts/gate) over estante-de-cifras passes:
  `tj3` silent, `scripts/unblocked.py` clean, and `estante app` running
  `lint`, `test` (the carried tests, not skipped) and `build` green under
  `CI=true`. Any filter-repo / merge step runs with bounded parallelism (the
  gate's rule and the user's standing machine rule); `git filter-repo` is
  single-process regardless.
- **ESM, matching the package.** The carried modules are ESM `import`/`export`
  (Explore Chords and `app/` are both `"type": "module"`); no CJS `require`
  enters. ESLint's flat config already covers `**/*.{js,jsx}`, so the carried
  `.js` is linted; the carry must land lint-clean (Explore Chords lints clean,
  and the one source edit — removing two functions and an import — keeps it
  so).

## Acceptance criteria

**Behaviour delivered.** The parser-free music core and chord-diagram
renderer are present under `app/src/`, carried with history, self-contained,
and framework-free:

- `git log --follow` on a carried file (e.g. `app/src/core/pitch.js`,
  `app/src/render/diagram.js`) reaches its Explore Chords commits — the
  history came over, not just the bytes.
- The carried tree is self-contained: `app/src/core/instrument.js` resolves
  `../data/instruments.js` (carried to `app/src/data/instruments.js`) and
  `app/src/render/diagram.js` resolves `../i18n/index.js` (carried to
  `app/src/i18n/`); no import dangles, and `song.js` is absent.
- `app/src/core/voicings.js` exports `defaultVoicing` and `unvoiceableKeys`
  only; its `./song.js` import and the two document-adapters
  (`resolveSongVoicings`, `applySavedVoicings`) are removed (deferred, below).
- `npm run lint` and `npm run build` in `app/` stay green; nothing under
  `app/src/core|render|data|i18n` imports React or view code.
- [`app/src/core/DESIGN.md`](../../../app/src/core/DESIGN.md) holds Explore
  Chords' `DESIGN.md` §§2.10, 2.11, 4, 5, 6 (the music-core explanation §5.1
  names), noting which sections describe modules deferred to the `music`
  stream.

**Tests the task lands with, by level.** The note names **unit** only — the
carried Vitest suites, run by the gate via `CI=true npm run test`
(`vitest run`), all green (not skipped), each pinning behaviour the Explore
Chords core already specified:

- **unit — `app/src/core/pitch.test.js`**: pitch/pitch-class and enharmonic
  spelling (DESIGN §4.1).
- **unit — `app/src/core/chord.test.js`**: the chord model, bass note,
  intervals (DESIGN §4.2, §4.5).
- **unit — `app/src/core/notation/notation.test.js`**: the one-parser-many-
  dialects chord notation (DESIGN §4.4).
- **unit — `app/src/core/instrument.test.js`**: the instrument model over the
  carried `CATALOG` (DESIGN §4.3) — proves `app/src/data/instruments.js` came
  with it.
- **unit — `app/src/core/search.test.js`**: fingering generation, required-
  tone check, finger assignment, scoring, truncation (DESIGN §5).
- **unit — `app/src/core/chart-layout.test.js`**: chart geometry (chords
  stacked over syllables).
- **unit — `app/src/core/voicings.test.js`** (trimmed): the `defaultVoicing`
  / `unvoiceableKeys` cases (the parser-free voicing primitive) — the cases
  that built fixtures with the excluded parser are removed with the adapters
  they tested.
- **unit — `app/src/render/render.test.js`** (+ `__snapshots__/render.test.js.snap`):
  the chord-box / neck / diagram SVG and the diagram's accessible label
  (DESIGN §6) — proves `app/src/i18n/` came with it and the snapshot still
  matches byte for byte.
- Any `app/src/i18n/*.test.js` carried with the i18n module run and stay
  green (bonus coverage the graft brings; they pin the `t`/`ordinal` the
  renderer depends on).

*Why no behavior/e2e-api/e2e-web here.* The task adds pure modules, no React
component, no endpoint and no screen a user journeys through; the note names
unit only. These modules get their behavior/e2e coverage where the view and
the service put them to work (the `shell`, `songs`, `music` streams, with axe
at the e2e-web level).

**Deferred work — carried by existing `music`-stream tasks, no new leaf.**
The parser-coupled layer cannot be carried self-contained ahead of cifra.md
for JavaScript; it lands, with its Explore Chords history and tests rewired to
the new parser, in tasks that already exist and already depend on both this
import and a parser:

- **`music.wizard`** ([`tasks/55-music.tji`](../../55-music.tji) lines 33–38,
  `depends … cifra_js.editing`) carries `voicing-plan/` (its note already
  says *"Explore Chords' planners … tests carried over"*) and the
  `applySavedVoicings` text round-trip.
- **`music.fallback`** ([`tasks/55-music.tji`](../../55-music.tji) lines 21–26,
  `depends … cifra_js.reader`) carries `resolveSongVoicings` (its note is
  *"The song's choice, then my shape, then the app's default"*) and
  `song-analysis.js`.

No new WBS task is registered: the homes exist and are correctly wired. The
closer need only confirm those two notes still anticipate the carry; the
orchestrator is alerted in this task's return summary. (No test is deferred:
every test this task delivers — the parser-free suite above — lands here;
the parser-coupled tests belong to the modules they test, which are not part
of this task.)

## Decisions

- **Cut the carry at the ParsedSong boundary, not at `song.js` alone.**
  *Rationale:* the note and DIRECTION §5 say *"`src/core/` except `song.js`"*
  is pure and carries as-is, but it is not: `voicings.js`'s
  `resolveSongVoicings`/`applySavedVoicings`, `song-analysis.js` and
  `voicing-plan/` all take a *parsed song* as input, and their tests build
  that input with the excluded `parseSong`. The genuinely pure, storage-free
  core is everything *below* the parsed-song model — pitch, chords, notation,
  search, scoring, diagrams, and `defaultVoicing`. Carrying exactly that now
  gives a self-contained, green core; the parsed-song consumers land with the
  parser that feeds them (cifra.md for JavaScript), where they are wired and
  tested against real parse output. *Alternatives rejected:* **(a) carry
  `song.js` too** — ships a second, spec-divergent parser into `app/`, exactly
  what DIRECTION §5 forbids; **(b) hand-author `ParsedSong` literal fixtures**
  so the coupled tests run without a parser — brittle (they must mirror
  cifra.md-for-JS output that is not wired yet, and would silently drift), and
  it cannot save `applySavedVoicings`, which round-trips song *text* through
  `parseSong`/`setVoicingForKey` and has no non-parser form; **(c) carry the
  coupled modules but skip their tests** — forbidden (no skipped tests; no
  untested carried code). The boundary cut is the only option that is green
  now, parser-honest, and loses no history.
- **The deferred layer lands in the existing `music.wizard` /
  `music.fallback`, not a new task.** *Rationale:* those tasks already own
  exactly this behaviour (the planner; the song's-choice→my-shape→default
  resolution), already depend on this import, and already depend on a cifra.md
  parser (`cifra_js.editing`, `cifra_js.reader`); `music.wizard`'s note
  already says the planners' tests carry over. Registering a new leaf would
  duplicate them. *Alternative rejected:* a standalone
  `music.core_import_finish` leaf — an orphan next to tasks that already do
  the work.
- **Carry `src/data/instruments.js` and `src/i18n/` in the same graft, not as
  stubs.** *Rationale:* `instrument.js` needs the `CATALOG` and `diagram.js`
  needs `t`/`ordinal` for its accessible label at runtime; carrying the real
  modules keeps `instrument.test.js` and `render.test.js` (and its snapshot)
  green byte-for-byte, and the catalogue is pure data while the i18n is the
  renderer's import-closure. DIRECTION §5 already says i18n comes over; this
  is simply where the renderer's slice of it first lands. *Alternative
  rejected:* stub `t`/`ordinal` and the catalogue — changes the rendered
  bytes, breaks the carried snapshot, and would have to be unpicked when the
  real i18n arrives.
- **Preserve the `core`/`render` layout under `app/src/`
  (`--path-rename src/:app/src/`).** *Rationale:* keeping the directory shape
  identical means every relative import in the carried code (`render` →
  `../core`, `core/instrument` → `../data`, `render/diagram` → `../i18n`)
  resolves with no edits — truly *"carried over as is"*. *Alternative
  rejected:* flattening everything under `app/src/core/` to match the note's
  literal *"into app/src/core"* — forces path edits across the renderer and
  contradicts how DIRECTION §3.7 and `app_tooling` name `core` and `render`
  as siblings.
- **One source edit only: remove `voicings.js`'s two document-adapters and
  its `./song.js` import, and trim their tests.** *Rationale:* `voicings.js`
  is the single file that mixes a pure primitive (`defaultVoicing`) with
  parser-coupled adapters; the minimal change that makes the carry self-
  contained is to drop the adapters (deferred to `music.fallback`/`.wizard`)
  and the test cases that exercised them, leaving the primitive and its three
  tests. `song-analysis.js` and `voicing-plan/` are whole-file deferrals, so
  they are simply left out of the graft. *Alternative rejected:* editing
  `song-analysis.js` to strip its JSDoc `@type` references to `song.js` and
  carrying it now — it still has no parser to build its test fixtures, so it
  would arrive untested; defer the whole module instead.
- **Design delta to DIRECTION §5 / §5.1.** *Rationale:* this task deviates
  from §5 as written (it defers "the voicing planner" rather than carrying it
  "as is", and §5 omitted the catalogue and i18n the core imports), so the
  constitution is amended in the same commit: §5 bullet 1 now distinguishes
  the parser-free primitives (carried now, with the catalogue and i18n) from
  the song-document-coupled parts (carried with the music stream, against the
  rewritten parser), and §5.1 states the filter-repo path set and exclusions.
  *Alternative rejected:* leaving §5 untouched and only noting the divergence
  in this refinement — the refinement is not the constitution; a future
  reader of §5 would otherwise expect the planner here.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- Carried via history-preserving `git filter-repo` + staged `--allow-unrelated-histories` merge: `app/src/core/` (pitch, chord, fingers, fretstring, errors, heuristics, score, search, instrument, chart-layout, voicings, `notation/`), `app/src/render/` (chord-box, diagram, index, neck) + `__snapshots__/render.test.js.snap`, `app/src/data/instruments.js`, `app/src/i18n/` (index.js, i18n.test.js, locales/en.js, es-419.js, it.js, pt-BR.js).
- `app/src/core/voicings.js` trimmed to `defaultVoicing`/`unvoiceableKeys` — `./song.js` import and two document-adapters (`resolveSongVoicings`, `applySavedVoicings`) removed; `voicings.test.js` trimmed to match (3 tests remaining).
- `app/src/core/DESIGN.md` created — holds Explore Chords' DESIGN §§2.10, 2.11, 4, 5, 6, with notes on deferred modules (`voicing-plan/`, `song-analysis.js`, the two adapters).
- `docs/DIRECTION.md` §5/§5.1 amended: parser-free primitives (carried now, with catalogue and i18n) distinguished from parser-coupled parts (deferred to `music` stream).
- Unit tests: 9 files / 386 tests total (alongside 2 pre-existing app tests) — all green under `CI=true npm run test` (Vitest).
- Deferred carry confirmed in existing WBS: `music.wizard` (carries `voicing-plan/` + `applySavedVoicings`) and `music.fallback` (carries `resolveSongVoicings` + `song-analysis.js`) already depend on this task and cifra.md parsers — no new leaf needed.

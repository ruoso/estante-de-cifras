# cifra_js.diff — Diff in musical terms

## TaskJuggler

[`tasks/10-cifra-js.tji`](../../10-cifra-js.tji), task `cifra_js.diff`
(lines 62–67):

> The summary the save sheet, history and previews show: 'Verse bar 5: G7 ->
> D♭7; voicings for G4 C4 E4 A4 added'. Not in the spec; the app's own.
> Workflows 4, 6.

## Effort estimate

3 days (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, extended by this
task:

- `js/src/diff.js` — new module, the semantic diff.
- `js/src/index.js` — re-export the new public surface.
- `js/test/diff.test.js` — new Vitest unit file.

The work lands in the cifra.md repository even though the `.tji` note does
**not** open with the `cifra.md:` prefix the other `cifra_js` tasks carry.
DIRECTION §3.6 (`docs/DIRECTION.md:269`) and §5 (`docs/DIRECTION.md:445–449`)
place the semantic diff squarely in the cifra.md JavaScript package — see
Decisions. The note's phrase "the app's own" echoes DIRECTION's annotation of
that JS build as "The app's." (`docs/DIRECTION.md:269`), i.e. the build the
app consumes, not a module that lives in `app/`. No file in
estante-de-cifras is touched by the implementation; only this refinement and,
on completion, the `.tji` Status wiring land here.

## Inherited dependencies

- **`cifra_js.reader`** (`depends !reader`) — **settled** (`complete 100`,
  commit `4b87e08`). Provides `parse(bytes, dialect = null) → model`
  (`js/src/parse.js:1105`) and the whole-song model this task compares. This
  is the only dependency: diff compares two models `parse` produces; it needs
  neither the writer nor merge.
- The `cifra_js` chain roots at `format.canonical_form` (the parent task's
  `depends`), already in place.

## What this task is

A pure, framework-free module that compares two parsed song models and
reports **what changed, in musical terms** — the human-meaningful summary the
app shows on the save sheet, in a song's history, and in version previews.
Given a *before* model and an *after* model (last-saved vs working copy; two
adjacent versions; a committed version vs "now"), it returns an ordered list
of change records plus a one-line summary string:

> Verse bar 5: G7 → D♭7; added voicings for G4 C4 E4 A4

It covers every dimension of the model the app surfaces: the title,
properties, sections (added / removed / renamed / reordered), chords within a
section (changed / added / removed, located by bar number in an unsung
document), words (coarsely — "section words changed"), and voicings (added /
changed / removed within a tuning-and-variation block). It is **not** part of
the cifra.md specification — it has no spec chapter, no corpus footprint, and
nothing in the Python reference to port; it is the app's own layer over the
spec-defined model.

## Why it needs to be done

Three app screens read this summary, and all three depend on this task:

- **`songs.save_sheet`** (`tasks/60-songs.tji:41`, `depends … cifra_js.diff`)
  — the save sheet shows "what changed, in musical terms … from the semantic
  diff" and prefills the commit note from it; *discard* shows "the same
  summary as save"; *save all* lists "what changed in each" song
  (`docs/workflows/04-edit-and-save.md:25–29, 60–64, 75–77`).
- **`songs.history`** (`tasks/60-songs.tji:59`, `depends … cifra_js.diff`) —
  each history entry carries "the summary of what changed, in musical terms",
  and opening a version shows "the musical summary by default … *Show the
  text* gives the line diff" (`docs/workflows/06-history.md:13–25, 40–50`).
- DIRECTION §4 names the capability directly: song history is "a diff in
  musical terms … and a default save message drawn from it"
  (`docs/DIRECTION.md:433–437`).

Until this module exists, those screens have nothing to render. It sits below
the view (framework-free) and runs in the Worker alongside save/merge/index
(`docs/DIRECTION.md:394–404`).

## Inputs / context

Governing documents (normative):

- **DIRECTION** (`docs/DIRECTION.md`):
  - `:269` — cifra.md for JavaScript "Reads and canonicalizes songs and
    setlists, merges, **diffs in musical terms**. The app's." (the home of
    this module).
  - `:275` — "The app and the service share no code, only the HTTP API and
    the format."
  - `:394–396` — the Web Worker owns git, the working copy and the index; the
    main thread never touches IndexedDB.
  - `:402–404` — "**Framework-free below the view.** … cifra.md for
    JavaScript know nothing of React; the view is the only layer that does."
  - `:433–437` — song history is "a diff in musical terms ('Verse bar 5: G7 →
    D♭7; added voicings for G4 C4 E4 A4'), and a default save message drawn
    from it."
  - `:445–449` — the JS library provides "parser, writer, canonical form,
    merge, **semantic diff**"; the diff is explicitly a library deliverable,
    and "not in the spec".
- **Workflow 4** (`docs/workflows/04-edit-and-save.md`):
  - `:25–29` — the save sheet: "**what changed**, in musical terms — *Verse
    bar 5: G7 → D♭7; added voicings for G4 C4 E4 A4* — from the semantic
    diff;" and "**a note**, prefilled from that summary, which the user may
    edit."
  - `:60–64` — *save all* "opens the same sheet, listing every song and what
    changed in each" (the summary is produced per song; aggregation is the
    app's).
  - `:75–77` — *discard* shows what would be lost, "the same summary as save".
- **Workflow 6** (`docs/workflows/06-history.md`):
  - `:13–25` — each list entry's "**summary** of what changed, in musical
    terms"; the first entry when there are unsaved changes.
  - `:40–50` — "**The diff** is the musical summary by default: *Verse bar 5:
    G7 → D♭7; voicings for G4 C4 E4 A4: Cm changed*. *Show the text* gives the
    line diff of the file." Each version is compared with the one before it;
    one other comparison, "**compare with now**", is against the working copy.
  - `:71–74` — "**Restoring part of a version.** … The semantic diff already
    knows the song in blocks" (the diff is block-aware; this future app
    feature is not in this task).

The model being compared (produced by the reader, pinned by
`/home/ruoso/devel/cifra.md/schema/cifra.schema.json`, built in
`/home/ruoso/devel/cifra.md/js/src/parse.js`):

- Top level `{ title, properties, sections, blocks, sung, sungAt,
  diagnostics }`.
- `title`: string | null.
- `properties`: array of `{ key, value }`, `key` lower-cased
  `^[a-z0-9_-]+$`, first-appearance order, last value wins
  (`parse.js:331–376`).
- `sections`: array of `{ name, heading, anchor, body, groups }` (+ optional
  `times`). `name` is the heading text (empty string before the first
  heading); not guaranteed unique. `body` holds `notes` / `verbatim` /
  `music` parts; a `music` part has `lines`, a chart/sung line has
  `measures`, a measure has `{ bar, items }` and — **only in an unsung
  document** — `number` (the bar number, `parse.js:874–892`). An `item` of
  `type:"chord"` carries `{ symbol, index, key, chord, ambiguities? }` where
  `key` = `symbol` or `symbol[index]` (`parse.js:105–107`) and joins a chord
  occurrence to a voicing.
- `blocks`: array of `{ label, tuning, voicings, notes }` (the voicings
  layer). `label` is the variation name (empty for the default block); a
  block is keyed by `(tuning.id, label)`. `tuning` = `{ text, pitches, id }`,
  `id` identity-by-sound (`tuning.js:32–34`), `text` the as-written string
  (e.g. "G4 C4 E4 A4"). Each voicing is `{ key, symbol, index, frets,
  fingers? }`, joined to a chord occurrence by `key`.
- `sung`: boolean (bars are numbered only when `false`).

Public surface and conventions:

- `js/src/index.js` is the sole entry point; it already re-exports `parse`,
  `write`, `canonical`, `merge`, the setlist functions, and the shared
  primitives. `diff` is added there.
- `js/package.json`: `"type": "module"`, `"dependencies": {}` (zero runtime
  deps), Vitest the only dev dep, no build step.
- Tests are Vitest files `<area>.test.js` in `js/test/`, on tiny
  purpose-written songs (never copyrighted words); model assertions use plain
  objects. The predecessor convention is set by `reader.md` / `writer.md` /
  `chords.md`.
- `writer.md` (`:131–132`) records the save-sheet boundary: the save sheet
  "shows what canonicalising will change using the reader's diagnostics and
  this writer's output" — that is a **separate** concern from this semantic
  diff (see Decisions, the boundary note).

## Constraints / requirements

- **Framework-free, below the view** (`docs/DIRECTION.md:402–404`). No React,
  no DOM, no storage, no network. ES module under `js/src/`, importing only
  other `js/src/` modules and language built-ins; **no Node built-ins** in
  `src`. Zero runtime dependencies; no build step.
- **A pure function of two models.** `diff(before, after)` does no I/O and
  holds no state; given equal inputs it returns an equal result. It consumes
  the model `parse` produces and must not require the raw bytes.
- **Plain-object output**, consistent with the rest of the package (no
  classes); the structured records are plain objects with stable field order.
  (There is no corpus byte-comparison for this module — see Decisions — so
  key order is a readability convention here, not a conformance rule.)
- **Canonical-form / marked-text rule.** A marked text (one holding conflict
  markers) is never canonical and is never the thing being compared: the diff
  takes two successfully parsed models and does not interpret conflict
  markers. When a working copy holds markers the app surfaces the conflict,
  not a diff. (Project standing rule; cifra.md §8, §11.)
- **Neutral, non-localized summary.** The `summary` string the module emits
  is the default commit message / prefilled note
  (`docs/workflows/04-edit-and-save.md:29`); it is stable English, one line,
  suitable as a git commit subject and shared with whoever shares the book.
  Localizing the *display* of the structured records is the app's job
  (`songs.save_sheet`, `songs.history`), not this module's — the library
  carries no i18n (DIRECTION §3.6: the app and library share no concern but
  the format). The design's own example strings are English
  (`docs/DIRECTION.md:434`, workflows 4 and 6), so this is not a deviation.
- **Exact glyphs and copy.** Chord changes read `before → after` with "→"
  (U+2192); flats print "♭" (U+266D), as in "D♭7"; chord text is the model's
  `symbol`, as written; voicing-block identity reads from `tuning.text`
  ("G4 C4 E4 A4"); clauses join with "; " in `summary`.
- **No song text in logs**: not applicable to a pure library module; test
  fixtures are purpose-written songs.

## Acceptance criteria

### Behaviour delivered

`diff(before, after)` (exported from `js/src/index.js`) returns
`{ changes, summary }`:

- `changes` — an ordered array of change records, each a plain object
  `{ kind, op, where, before, after, text }`:
  - `kind` ∈ `"title" | "property" | "section" | "chord" | "words" |
    "voicing"`;
  - `op` ∈ `"added" | "removed" | "changed" | "renamed" | "reordered"`;
  - `where` locates the change: `{ section?, bar?, tuning?, variation?,
    key? }`;
  - `before` / `after` carry the raw values (chord `symbol`, property
    `value`, voicing frets, section name, …) or `null`;
  - `text` is the neutral-English phrase for that one change (e.g. `Verse bar
    5: G7 → D♭7`).
- `summary` — the `text` of each change joined with "; ", on one line (the
  default save message). Empty string when there are no changes.
- **Ordering** is deterministic: title, then properties (model order), then
  sections in document order (each section's chord and words changes), then
  voicing blocks (model order). This makes the summary reproducible.
- **Locating a chord change**: section `name` + bar `number` in an unsung
  document ("Verse bar 5: G7 → D♭7"); in a sung document (no bar numbers), by
  section `name` and the chord's position within the section
  ("Chorus: G → Em").
- **Words**: coarse — a section whose sung/lyric text changed reports "Verse
  words changed"; exact wording is the line diff behind *Show the text*
  (`docs/workflows/06-history.md:44`), not this summary.
- **Voicings**: per block, identified by `tuning.text`, reporting added /
  changed / removed chord voicings — "added voicings for G4 C4 E4 A4",
  "voicings for G4 C4 E4 A4: Cm changed".
- **Alignment**: properties by `key`; voicings by `(tuning.id, label)` then by
  voicing `key`; sections by name occurrence in order (unmatched *after* =
  added, unmatched *before* = removed, same set reordered = `reordered`);
  measures by bar `number` when numbered, else positionally.
- An unchanged pair yields `changes: []` and `summary: ""`.

### Tests the task lands with

**unit** — `js/test/diff.test.js` (Vitest, purpose-written songs), each case
pinning the behaviour its source names:

- **chord changed** — "Verse bar 5: G7 → D♭7" on an unsung song; pins
  `docs/DIRECTION.md:434`, `workflows/04-edit-and-save.md:27`,
  `workflows/06-history.md:43`. (`kind:"chord"`, `op:"changed"`,
  `where.bar===5`.)
- **chord added / removed** — a chord appears / disappears at a located bar.
- **chord changed, sung song** — no bar number; located by section ("Chorus:
  G → Em"); pins the unsung-only bar-numbering rule (`parse.js:874–892`).
- **voicings added** — "added voicings for G4 C4 E4 A4"; pins
  `workflows/04-edit-and-save.md:28`.
- **voicing changed** — "voicings for G4 C4 E4 A4: Cm changed"; pins
  `workflows/06-history.md:44`.
- **voicing removed** — a voicing key disappears from a block.
- **section added / removed / renamed / reordered** — the four section ops;
  pins the section-alignment rule.
- **words changed** — a section's lyric text differs → "Verse words changed"
  (coarse); pins the words/line-diff boundary (`workflows/06-history.md:44`).
- **property added / removed / changed** — e.g. "key: G → A", a property added
  and removed; pins the properties dimension (`.tji` note).
- **title changed / added / removed**.
- **composite summary** — the two canonical full strings assembled by
  `summary`: "Verse bar 5: G7 → D♭7; added voicings for G4 C4 E4 A4"
  (workflow 4) and "Verse bar 5: G7 → D♭7; voicings for G4 C4 E4 A4: Cm
  changed" (workflow 6); pins ordering and "; " joining.
- **no change** — `changes` empty, `summary` "".
- **summary is one line** — no newline in `summary` for a many-change diff
  (fit for a commit subject).
- **purity** — `diff(m, m)` is empty; `diff(a, b)` does not mutate `a` or `b`.

No **corpus**, **behavior**, **e2e-api** or **e2e-web** level applies: this is
a pure spec-external library module with no corpus footprint and no UI; the
`.tji` note names **unit** only. The app-side rendering, axe and journeys are
tested by `songs.save_sheet` and `songs.history`, which depend on this task.

## Decisions

1. **Lands in cifra.md `js/`, not the app.** DIRECTION §3.6
   (`docs/DIRECTION.md:269`) and §5 (`:445–449`) name the semantic diff a
   deliverable of the JavaScript library ("diffs in musical terms", "semantic
   diff"), framework-free and below the view (`:402–404`). The `.tji` note
   omits the `cifra.md:` prefix every sibling in `tasks/10-cifra-js.tji`
   carries; read against DIRECTION — the constitution — and the note's own
   "the app's own" (which mirrors §3.6's "The app's." label for this JS
   build), that omission is a WBS-note slip, not a decision to put format-aware
   diffing in `app/`. *Alternative rejected:* an `app/`-side diff module would
   duplicate format knowledge in the view layer and violate "the view is the
   only layer that knows React / framework-free below the view"; DIRECTION
   gives the diff one home. The closer should append `cifra.md:` to the note
   when it adds the refinement back-link (flagged in the return summary).
2. **One export, `diff(before, after) → { changes, summary }`.** The view
   needs both the structured records (to render the history list, the
   per-version preview, the per-song *save all* list, and — later — block-wise
   restore) and a ready one-line string (the prefilled note / default commit
   message). *Alternatives rejected:* emitting only the summary string loses
   the structure the history and restore screens need; two separate exports
   (`diff` + `summarise`) split a trivially-coupled pair and reopen the
   British/American spelling question the single `summary` field avoids.
3. **Neutral-English prose in the library; the app localizes display.** The
   module is i18n-free (the library and the app share only the format). The
   `summary` doubles as the default commit message, which is shared across a
   book's readers and best kept stable and language-neutral; the design's
   example strings are already English. The view may localize how it *renders*
   the structured records. This stays within the design — no design delta.
4. **Coarse words, located chords, block voicings.** Chord and voicing
   changes are located precisely (bar number when the song is unsung; tuning
   text for voicings), matching the canonical example strings; word changes
   are reported per section only, because exact wording is served by the line
   diff behind *Show the text* (`workflows/06-history.md:44`). This keeps the
   musical summary readable and leaves character-level diffing to git.
5. **Simple, deterministic alignment.** Properties align by `key`, voicings by
   `(tuning.id, label)` then voicing `key`, sections by name-in-order, bars by
   number when numbered else positionally. *Alternative rejected:*
   content-based section/line matching (the kind chapter 11 merge performs) is
   deliberately out of scope — a diff summary need not be a three-way merge,
   and borrowing merge's alignment would couple this task to `cifra_js.merge`,
   which it does not depend on.
6. **No corpus or reference footprint.** The diff is not in the specification,
   so there is no corpus entry, no expected-failure ledger line, and nothing
   in the Python reference to port — a deliberate departure from the five
   sibling `cifra_js` tasks, whose behaviour the corpus pins. Its conformance
   is its unit tests on purpose-written songs. (If the reference later grows a
   diff it is a guide, never a source to import — implementations agree by
   being checked, not shared.)
7. **Boundary: the diff is not "what canonicalising drops."** The save sheet
   also shows what canonicalisation will change, which comes from the reader's
   diagnostics and the writer's output (`writer.md:131–132`,
   `workflows/04-edit-and-save.md:47–56`). That is a separate computation
   owned by `songs.save_sheet`; this module only compares two models.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- cifra.md `f833ee5`: `js/src/diff.js` — new module, `diff(before, after) → { changes, summary }`; pure, zero-dep, framework-free; covers title, properties, sections (added/removed/renamed/reordered), chords (located by bar number when unsung, by section when sung), words (coarse), and voicings (by `(tuning.id, label)` then key); deterministic ordering; one-line neutral-English `summary`.
- cifra.md `f833ee5`: `js/src/index.js` — re-exports `diff` on the public surface (11 lines added).
- cifra.md `f833ee5`: `js/test/diff.test.js` — 19 Vitest unit cases covering every named acceptance-criterion dimension; all 19 passed, 839/839 total suite.
- Design note: chords aligned positionally within a section (by bar ordinal), not by absolute bar number — because bar numbering is document-wide (parse.js:875), a reorder/resize would spuriously report chord changes if absolute numbers were used to align; the stored `number` is used only to locate a change ("Verse bar 5"), not to align.
- No corpus, behavior, e2e-api or e2e-web level applies (pure spec-external library module with no UI).
- No tech-debt follow-up tasks registered.

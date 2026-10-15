# songs.save_gate_dropped_section — Block a save that would drop a section after the rule

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task save_gate_dropped_section`
under `task songs` (`tasks/60-songs.tji:92-97`). Dependencies as declared:
`depends !save_sheet, !editor_section_after_voicings`, plus the parent
`task songs` cascade (`shell.layout`, `shell.chart`, `foundation.e2e_web`).
Wired into milestone **`milestones.m5_complete`**
(`tasks/99-milestones.tji:44`). The note:

> "A hand-typed `---` above a section, or a `## Section` typed below the
> voicings rule, is reported by the reader (bad-block-heading;
> spec/7-voicings.md §7.2) but canonicalise drops it silently on save. Add the
> diagnostic(s) for content below the rule that the writer drops to
> SAVE_BLOCKERS (app/src/editor/SongEditor.jsx), so the save sheet blocks with
> the reader's message (move the rule below it) instead of losing the lines.
> Source: tasks/parking-lot.md 2026-10-14 (Extend the save gate). Tests: unit
> (which diagnostics block); behavior (a section typed after the rule blocks
> the save with the message; moving the rule unblocks and the save round-trips
> it; axe)."

## Effort estimate

**0.5d**, allocated `team`. One small pure module extracted from the editor,
one new stop message in four locales, a workflow paragraph, two levels of test.

## Repository

**estante-de-cifras** only — `app/src/editor/`, `app/src/i18n/locales/`, and
the design delta in `docs/workflows/04-edit-and-save.md`:

- `app/src/editor/save-blockers.js` *(new)* — the pure save gate: which
  diagnostics stop a save, for which path, and which stop message each shows.
- `app/src/editor/save-blockers.test.js` *(new)* — the unit test.
- `app/src/editor/SongEditor.jsx` — drops its local `SAVE_BLOCKERS`
  (`:54-58`), filters through the new module (`:349-352`) and picks the stop
  message from it (`:407-414`).
- `app/src/editor/SongEditor.behavior.test.jsx` — one added case.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — one new key
  `editor.source.afterRuleStop` beside `voicingStop`/`markerStop`
  (`en.js:1574-1576`, `pt-BR.js:1419-1421`, `es-419.js:1419-1421`,
  `it.js:1420-1422`).
- `docs/workflows/04-edit-and-save.md` §Normalising — the design delta
  (already written with this refinement; Decision 5).

**Not a `cifra.md:` task.** It consumes the reader's existing diagnostics
(`cifra-md` `parse`) and changes nothing in the spec, reference, corpus or the
JS/Go implementations. No Worker change, no new dependency.

## Inherited dependencies

- **`songs.save_sheet`** — *settled* ([`save_sheet.md`](save_sheet.md)). It
  established the pre-save gate in the editor: `SAVE_BLOCKERS =
  {'bad-voicing','marker-line'}`, checked on Save before `onSave` hands over to
  the sheet (`save_sheet.md:37`, `:128`, `:215-219`); the Worker's
  `canonicaliseFile` refusal on a marked text stays the backstop.
- **`songs.editor_section_after_voicings`** — *settled, Done 2026-10-06*
  ([`editor_section_after_voicings.md`](editor_section_after_voicings.md)).
  It made **Add section** insert above the rule and recorded, under "Deferred /
  out of scope", that a *hand-typed* section after a rule is still dropped
  silently because `bad-block-heading` is not among `SAVE_BLOCKERS` — the gap
  this task closes. Its behavior case
  (`SongEditor.behavior.test.jsx:102`) is the round-trip pattern
  (`write(parse(buffer))` keeps the heading) this task reuses.
- **`songs.editor`** — *settled* ([`editor.md`](editor.md)). The editor's
  Decision 3 (the editor's own save stop, keyed on diagnostic codes) and
  Decision 8 (reuse `cifra-md`'s reader, no second grammar) govern here.
- Parent cascade (`shell.layout`, `shell.chart`, `foundation.e2e_web`) —
  settled, not used beyond the editor surface.

No pending blocking dependency. Every test named below is driven by the
editor's behavior rig (`makeStore` + `emit(SOURCE)`), which exists.

## What this task is

A cifra.md song is two parts split by the first rule (`---`): the chart above,
the voicings part below (spec §1.5–1.6). Below the rule a heading names a
voicings block and needs a tuning; one without (`## Refrão`) or with a
non-tuning after its colon (`## Coda: devagar`, `## Voicings: cavaquinho`) is
reported as `bad-block-heading`, and the lines under it up to the next heading
are not read (spec §7.2). Text or a voicing item before the first block
heading is reported as `notes-outside-block` / `item-outside-block` (spec §7.4).
The canonical writer drops all of it (spec §8.2). The editor's save gate stops
only on `bad-voicing` and `marker-line`, so a user who types `---` between two
sections out of Markdown habit — or types a new section at the bottom of an
arranged song — saves and silently loses those lines.

This task extends the gate: those three diagnostics stop the save too, with a
message naming the line, saying it comes after the rule, that a section of the
song belongs above it (move the rule below it), and that a voicings heading
needs a tuning. Moving the rule (or fixing the heading) clears the stop and the
save keeps the section.

## Why it needs to be done

Silent loss of the user's hand-typed work on save — exactly what workflow 4
§Normalising promises the app will not do for a voicing line ("Rather than lose
it, such a line stops the save"). The reader already words the warning (spec
§7.2 makes it a MUST); only the gate ignores it. Source:
`tasks/parking-lot.md` 2026-10-14 ("Extend the save gate"), after
`songs.editor_section_after_voicings` fixed the Add-section half. Leaf task of
M5 (`m5_complete`); nothing depends on it.

## Inputs / context

### The gate today

- `app/src/editor/SongEditor.jsx:54-58` — `SAVE_BLOCKERS = new Set(['bad-voicing',
  'marker-line'])`, commented against Decision 3 and workflow 4 §Normalising.
- `SongEditor.jsx:349-352` — `blockers = parsed.diagnostics.filter((d) =>
  SAVE_BLOCKERS.has(d.code))`; `parsed = parse(text, dialect)` (`:348`).
- `SongEditor.jsx:387-405` — `onSavePress`: with blockers, sets
  `saveError = { line, code }` of the first (diagnostics are sorted by line)
  and returns without calling `onSave`.
- `SongEditor.jsx:407-414` — `showStop` and the `stopMessage` ternary
  (`markerStop` for `marker-line`, else `voicingStop`); rendered at `:477-480`
  as `<div className="notice conflict est-editor-notice" role="alert">` with
  `<b>{t('editor.source.notSaved')}</b> {stopMessage}` — status carried by
  words.
- Hosts: `SongEditor` is mounted by `EditSongHost.jsx`, `NewSongHost.jsx` and
  `app/src/files/RawEditorHost.jsx` — the file view's raw editor over **any**
  file (README.md, `*.setlist.md`, `.gitattributes`), not only songs.
- The Worker's writer choice: `app/src/worker/canonicalise.js:68-89`
  `canonicaliseFile(path, input)` — a `*.setlist.md` path goes through the
  setlist writer; **every other path** through the song writer `write(parse())`
  (`:30` "Anything else is a song"). Called from `working-copy.js:144` for every
  path in a save.

### The reader's diagnostics (cifra-md, `cifra.md/js/src/parse.js`)

- `bad-block-heading` — `:546` (a heading after the rule with no colon, empty
  label or empty tuning: "…comes after the rule, where a heading is a voicings
  block and needs a tuning… If it is a section of the song, move the rule below
  it; the lines under it are not read") and `:560` (text after the colon is not
  a tuning). Both return `skipping = true`: the lines under it are not read.
- `item-outside-block` — `:583` ("a voicing before any block heading; not kept").
- `notes-outside-block` — `:635` ("text in the voicings part before any block;
  not kept").
- Not blockers (nothing of the user's is lost, or out of scope): `extra-rule`
  (`:532`, a second rule — the rule itself carries no content), `duplicate-block`
  (merged, not dropped), `bad-fingering` (`:618`, the voicing is kept, only its
  fingering goes).

### The format

- `cifra.md/spec/1-document.md` §1.5 (`:154-171`), §1.6 (`:173-189`) — the two
  parts; the first rule outside a fence ends the chart.
- `cifra.md/spec/7-voicings.md` §7.2 (`:33-80`, the MUSTs at `:56-64`) — a
  heading after the rule needs a tuning; the report must say a section belongs
  before the rule.
- `cifra.md/spec/7-voicings.md` §7.4 (`:139-141`) — "anything in the voicings
  part before its first block heading" is reported and not kept.
- `cifra.md/spec/8-normalisation.md` §8.2 (`:90-97`) — the voicings part
  "drops what a reader skips: problem items, bad fingerings, lines before the
  first block…".
- Corpus witnesses: `cifra.md/corpus/29-voicings-part/` (what canonicalising
  drops after the rule), `cifra.md/corpus/11-diagnostics/input.parsed.json`
  (carries `bad-block-heading`).

### The workflow

- `docs/workflows/04-edit-and-save.md` §Normalising (`:54-70` after the delta)
  — "A voicing line the parser could not read is one normalising would drop…
  such a line stops the save, with a message pointing at it." Extended by this
  task's delta to anything else after the rule normalising would drop
  (Decision 5).

## Constraints / requirements

- **Canonical form over preserving content.** The fix does not teach the writer
  to keep a section after the rule; it stops the save so the user moves it to
  where canonical form keeps it. The Worker's `save` stays the canonicalising
  authority; no Worker change.
- **Reuse the reader, no second grammar** (editor Decision 8). The gate keys on
  the reader's diagnostic codes; it does not re-scan the text for rules or
  headings.
- **The gate describes the writer that will run.** A dropped-content code only
  stops a save of a file the Worker writes with the song writer — every path
  but `*.setlist.md` (`canonicalise.js:70`), including a new song with no path
  yet. `marker-line` keeps stopping every file (Decision 3).
- **Accessibility.** No new control. The stop is the existing `role="alert"`
  notice with "Not saved." plus a message carrying the line number as text;
  axe at WCAG 2.1 AA stays clean on the stopped editor. Keyboard path
  unchanged (Save is a RAC `Button`).
- **i18n.** The new message ships in all four locales the app carries (`en`,
  `pt-BR`, `es-419`, `it`), translated, in the voice of `voicingStop`.
- **No song text in logs; purpose-written fixtures.** The gate logs nothing;
  test songs are written for the purpose (Portuguese titles as the existing
  cases, e.g. "Tarde Clara").
- **Offline first.** The gate is a synchronous check over the local buffer; no
  network.

## Acceptance criteria

### Behavior delivered

1. **A section typed after the rule stops the save.** A song whose chart is
   followed by `---` and then `## Refrão` (no tuning) with a fence under it:
   pressing **Save** does not hand over to the save sheet (`onSave` not called);
   the alert shows "Not saved." and the after-rule message naming the heading's
   line number. *Pins workflow 4 §Normalising (delta), spec §7.2.*
2. **A heading with a non-tuning after its colon stops it too** (`## Coda:
   devagar`, `## Voicings: cavaquinho` after the rule), with the same message.
   *Pins spec §7.2 (`:56-59`).*
3. **Text or a voicing before the first block stops it** (`notes-outside-block`,
   `item-outside-block`), with the same message. *Pins spec §7.4, §8.2.*
4. **Moving the rule clears the stop and the save keeps the section.** Once the
   `---` is moved below the section (the section now in the chart), the alert
   is gone, Save calls `onSave`, and the canonical text of the buffer
   (`write(parse(buffer))`, as the Worker's save writes it) contains the
   section's heading and its lines. *Pins the note's round-trip clause; spec
   §1.6, §8.2.*
5. **Unchanged:** `bad-voicing` keeps `voicingStop`; `marker-line` keeps
   `markerStop` on every file; `extra-rule`, `duplicate-block`, `bad-fingering`,
   `unclosed-fence`, `unfenced-music` do not stop a save; a clean song with a
   voicings appendix saves.
6. **Not on a setlist.** The three new codes do not stop a save of a
   `*.setlist.md` path (the setlist writer has no voicings part).

Wiring: `app/src/editor/save-blockers.js` exports `saveBlockers(diagnostics,
path)` → the blocking diagnostics in line order, and `stopMessageKey(code)` →
`'editor.source.markerStop' | 'editor.source.voicingStop' |
'editor.source.afterRuleStop'`. `SongEditor` calls both; its local
`SAVE_BLOCKERS` goes. New key `editor.source.afterRuleStop` (en: "Line {line}
comes after the rule, where only voicing blocks are kept, and saving would drop
it. If it is part of the song, move the rule below it; a voicings heading needs
a tuning, like ## Voicings: E2 A2 D3 G3 B3 E4.") in the four locales.

### Tests the task lands with, by level

Per the note: **unit** and **behavior**.

- **unit — `app/src/editor/save-blockers.test.js`** (*which diagnostics
  block*), over purpose-written songs run through `cifra-md`'s `parse`:
  - a section (`## Refrão` + fence) after `---` → one blocker,
    `bad-block-heading`, at the heading's line; `stopMessageKey` →
    `afterRuleStop` (spec §7.2);
  - `## Coda: devagar` and `## Voicings: cavaquinho` after the rule → blocked,
    `bad-block-heading` (spec §7.2 `:56-59`);
  - a note line, and a `- G: 320003` item, between the rule and the first
    `## Voicings: E2 A2 D3 G3 B3 E4` → blocked (`notes-outside-block`,
    `item-outside-block`; spec §7.4);
  - an unreadable voicing → `bad-voicing`, `voicingStop`; a marker line →
    `marker-line`, `markerStop` (no regression, workflow 4 §Normalising);
  - a second rule, a duplicate block, a bad fingering, an unclosed fence →
    no blocker;
  - a clean song with a voicings appendix → no blocker;
  - the section-after-rule song under a `x.setlist.md` path → no blocker; under
    `x.cifra.md` and under no path (a new song) → blocked; a marker line under
    `x.setlist.md` → blocked (Decision 3);
  - with a bad voicing on an earlier line than a bad heading, the first blocker
    is the earlier one (line order).
- **behavior — `app/src/editor/SongEditor.behavior.test.jsx`**, added case
  *"stops the save on a section typed after the rule, and saves it once the
  rule moves below it"* (the existing rig: `makeStore`, `emit(SOURCE)` with a
  purpose-written song, `layoutMode="wide"`, `onSave` spy, axe over
  `container`): Save → `onSave` not called, `role="alert"` has
  `t('editor.source.notSaved')`, the after-rule message and the heading's line
  number, axe clean (`checkWcag21aa`); then a dispatch moving the `---` line
  below the section → alert gone, Save → `onSave` called once, and
  `write(parse(buffer))` contains `## Refrão` and its fence line. *Pins the
  note's behavior clause; workflow 4 §Normalising (delta); spec §7.2, §8.2.*
  The existing stop cases (`:204` bad voicing, `:262` marker) keep passing.

No e2e level: the note names none (Decision 4).

### Deferred (closer registers in WBS)

- **`books.save_readme_verbatim`** — 0.5d, not `cifra.md:`, milestone
  `m5_complete`. *"The Worker's save writes README.md and .gitattributes through
  the song writer (`app/src/worker/canonicalise.js:30,76-79` treats every
  non-setlist path as a song), so a README with a `---` above a `## Heading`
  loses the lines under it and runs of blank lines are collapsed — but the hook
  holds README.md only to the text rules (hook.canonical). Save
  README.md and .gitattributes as written (UTF-8 checked, marker lines
  refused), and narrow the editor's after-rule save gate
  (`app/src/editor/save-blockers.js`) to `*.cifra.md` paths and new songs.
  Tests: unit (canonicaliseFile keeps a README with a rule and headings byte
  for byte; refuses a marker line); behavior (a README saved through
  working-copy.js save commits its bytes unchanged; the raw editor saves a
  README with `---` / `## Usage` without the after-rule stop; axe)."*
  Until it lands, this task's gate stops such a README save with the
  after-rule message — honest, since saving would drop those lines today.

## Decisions

1. **Block `bad-block-heading`, `notes-outside-block` and `item-outside-block`
   — every code for content after the rule the writer drops.** The note asks
   for "the diagnostic(s) for content below the rule that the writer drops";
   those are exactly the three the reader emits in `voicingsLine` for lines
   that do not survive (§7.2, §7.4, §8.2). A hand-typed `---` directly above an
   unheaded fence produces `notes-outside-block`, not `bad-block-heading`, so
   blocking only the heading code would leave the same loss open. *Rejected:
   `bad-block-heading` alone — misses that case. Rejected: also `extra-rule`,
   `bad-fingering`, `duplicate-block` — a rule carries no content, a bad
   fingering keeps its voicing, a duplicate block is merged; stopping on them
   blocks saves that lose nothing the user wrote as music.*
2. **One new message for all three, worded from the reader's.** The reader's
   own text is English-only and per-variant; the app shows a localised message
   with the line number, as `voicingStop` does. One message covers both fixes
   (move the rule below a section; give a voicings heading a tuning), because
   the gate cannot know which the user meant — the same reason spec §7.2 asks
   the reader to name both. *Rejected: showing `d.message` raw — English in
   every locale. Rejected: a message per code — three strings for one remedy.*
3. **The dropped-content codes stop only files the song writer writes.**
   `SongEditor` is also the file view's raw editor; the Worker writes
   `*.setlist.md` with the setlist writer, which has no voicings part, so these
   codes describe no drop there. The predicate mirrors `canonicaliseFile`'s
   dispatch (`canonicalise.js:70`) rather than "is a song", because the gate's
   promise is "saving would drop this" and today the song writer also runs on
   README.md — so README with `---`/`## Usage` is stopped, truthfully, until
   `books.save_readme_verbatim` changes the Worker and narrows the predicate.
   `marker-line` stays on every path (a marked text is never saved, spec §8.1).
   `bad-voicing` is left as it is (every path) — out of this task's scope.
   *Rejected: gating every path — would stop a setlist save for a drop that
   does not happen. Rejected: songs only now — would let a README save
   silently lose lines in the meantime.*
4. **No e2e level.** The note names unit and behavior. The gate is a pure
   function of the parsed buffer and the path, fully pinned by the unit cases,
   and the stop's rendering, a11y and unblocking by the behavior case; the
   existing editor/save e2e journeys already drive Save through the real UI on
   the three viewports. A journey typing a rule into CodeMirror would add
   compose-stack cost without pinning anything the behavior test does not.
5. **Design delta: workflow 4 §Normalising.** The workflow named only "a
   voicing line the parser could not read" as a save stop; this task makes the
   app stop on more, which is a change to what the workflow says the app does.
   `docs/workflows/04-edit-and-save.md` §Normalising gains one paragraph (the
   heading with no tuning and the lines under it, text before the first block;
   the message's two remedies). It rides in the closer's commit. No spec change:
   the format already reports and drops these (spec §7.2, §7.4, §8.2).
6. **Extract the gate into `save-blockers.js`.** The note's unit level needs a
   pure seam, and the editor already keeps its pure helpers beside it
   (`section-insert.js`, `fence-paste.js`). *Rejected: unit-testing through the
   component — that is the behavior level.*

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- `app/src/editor/save-blockers.js` (new): the pure save gate. `saveBlockers(diagnostics, path)` returns the blocking diagnostics in line order; `stopMessageKey(code)` picks the stop message. `bad-block-heading`, `notes-outside-block` and `item-outside-block` block every path but `*.setlist.md`; `bad-voicing` and `marker-line` keep blocking every path.
- `app/src/editor/SongEditor.jsx`: the local `SAVE_BLOCKERS` is gone; the editor calls the new module.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: new key `editor.source.afterRuleStop`, naming the line, the rule, and both remedies (move the rule below the section; give a voicings heading a tuning).
- `docs/workflows/04-edit-and-save.md` §Normalising: the design delta (Decision 5).
- Tests: `app/src/editor/save-blockers.test.js` (unit, 8 cases) and the added case in `app/src/editor/SongEditor.behavior.test.jsx` (a section typed after the rule stops the save with the message and axe clean; moving the rule below it saves and keeps `## Refrão`). No e2e level (Decision 4).
- Follow-up registered: `books.save_readme_verbatim` (`tasks/65-books.tji`, wired into `m5_complete`).


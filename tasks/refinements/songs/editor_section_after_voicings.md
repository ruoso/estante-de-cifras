# songs.editor_section_after_voicings — Place Add section in the song body, not after the voicings appendix

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task editor_section_after_voicings`
under `task songs` (`tasks/60-songs.tji:48-53`). Dependencies as declared:
`depends !editor` (the sibling `songs.editor`), plus the parent `task songs`
cascade `depends shell.layout, shell.chart, foundation.e2e_web`. The one-line
note:

> "The editor's Add section button inserts at document end; on a song with a
> voicings appendix (--- / ## Voicings:) the new section lands after the
> separator and is silently dropped by canonicalise at save — the user loses
> the edit without warning. Fix: insert the new section above the first ---
> that opens the appendix. Source of debt: tasks/refinements/songs/save_sheet.md
> (songs.save_sheet). Tests: unit (insert above the appendix separator);
> behavior (Add section in a song with voicings: the section lands in the body
> and a save round-trips it)."

## Effort estimate

**0.5d** (as scoped in the `.tji`), allocated `team`. A targeted bug fix: one
new pure helper, one call-site change in the editor, two levels of test.

## Repository

**estante-de-cifras** only — `app/src/editor/`:

- `app/src/editor/section-insert.js` *(new)* — a pure helper
  `sectionInsertPos(text)` returning the character offset at which a new
  section must be inserted: before the first rule that opens the voicings part,
  or at document end when there is none.
- `app/src/editor/SongEditor.jsx` — `addSection` (`:251-263`) computes its
  insertion position from the new helper instead of `view.state.doc.length`.
- `app/src/editor/section-insert.test.js` *(new)* — the unit test.
- `app/src/editor/SongEditor.behavior.test.jsx` — one added behavior test (Add
  section on a song with a voicings appendix).

**Not a `cifra.md:` task** (the note does not start with `cifra.md:`). It
consumes the format's JavaScript library (`cifra-md`: `fenceOpen`,
`closesFence`, `canonical`) and changes nothing in the spec, reference or
corpus. No i18n change (no new copy), no Worker change (the insertion is a
view-side buffer edit), no new dependency.

## Inherited dependencies

- **`songs.editor`** — *settled, Done 2026-10-06*
  ([`editor.md`](editor.md)). This task fixes a defect in `addSection`, the
  Add-section command that editor shipped. editor's acceptance criterion 4
  specified the button "inserts a `## ` heading and an empty fence pair **at
  the end**" (editor.md AC 4, Decision — the `addSection` seam at
  `app/src/editor/SongEditor.jsx:251-263`). "At the end" is exactly the defect
  this task corrects. editor Decision 8 ("the syntax layer reuses `cifra-md`'s
  own primitives, not a new grammar") governs how the fix recognises the
  appendix boundary (reuse `fenceOpen`/`closesFence`, Decision 1 below).
- **`songs.save_sheet`** — *settled, Done 2026-10-06*
  ([`save_sheet.md`](save_sheet.md)). The **source of this debt**: save_sheet
  registered `songs.editor_section_after_voicings` (0.5d) as tech debt, wired to
  milestone **m2_local** (`save_sheet.md:437`). The save that must round-trip
  the new section is save_sheet's Save path, which canonicalises through the
  Worker (`working-copy.js` `save` → `canonicaliseFile` → the cifra.md writer).
- **Parent cascade `shell.layout`, `shell.chart`, `foundation.e2e_web`** — all
  settled (transitive through editor). Not directly used here beyond the editor
  surface editor already stood up.

No pending blocking dependencies.

## What this task is

The editor's **Add section** button appends a new `## ` heading and an empty
music fence at the current end of the document. When the song has a **voicings
appendix** — the trailing part a `---` rule opens, holding `## Voicings:`
blocks — "the end of the document" is *inside the appendix*, after the rule. A
cifra.md document is two parts split by the first rule: everything before it is
the **chart** (the song: sections, chords and lyrics in fences, notes),
everything after it is the **voicings part** (spec §1.5). After the rule a `##`
heading is read as a voicing-block heading, not a section, and a heading with no
`: <tuning>` is an error the reader reports and the canonical writer **drops**
(spec §7.2, §8.2). So the appended section — `## ` + a fence — is discarded the
next time the song is saved, and because the editor's save gate does not block
on that diagnostic, the user is never told: they add a section, type into it,
save, and the section is gone.

The fix is to compute the insertion point as the **end of the chart** — the
offset just before the first rule that opens the voicings part — so the new
section lands in the body, where it survives canonicalisation. When the song has
no appendix (no rule), the insertion point is still the document end, unchanged.

## Why it needs to be done

It is a correctness defect in a shipped feature: Add section silently loses the
user's work on any song that has been arranged for an instrument (every such
song carries a voicings appendix). It belongs to milestone **M2 (`m2_local`)** —
"a songbook on one device: find, read, write, edit… offline" — the milestone
save_sheet wired it to (`save_sheet.md:437`). No downstream task depends on it;
it is a leaf closing a hole in `songs.editor`.

## Inputs / context

### The defect, in code

- **`app/src/editor/SongEditor.jsx:251-263`** — `addSection`:
  ```js
  const addSection = () => {
    const view = viewRef.current;
    if (!view) return;
    const docStr = view.state.doc.toString();
    const end = docStr.length;                       // ← always document end
    const trailing = /\n*$/.exec(docStr)[0].length;
    const sep = end === 0 ? '' : '\n'.repeat(Math.max(0, 2 - trailing));
    const head = `${sep}## \n\`\`\`\n`;
    const insert = `${head}\n\`\`\``;
    const cursor = end + head.length;
    view.dispatch({ changes: { from: end, insert }, selection: { anchor: cursor }, scrollIntoView: true });
    view.focus();
  };
  ```
  `end = docStr.length` is the only thing that must change: the insert position
  (and the trailing-newline accounting that pads a blank line before the
  heading) must be taken at the end of the chart, not the end of the document.
- The editor already knows how to find the boundary for colouring:
  **`app/src/editor/cifra-syntax.js:93-132`** tracks fence state with
  `fenceOpen`/`closesFence` (cifra-md primitives) and flips `inVoicings` on the
  first thematic break found **outside a fence** (`:128-132`). The fix needs the
  same boundary, computed as a character offset. (Note: `cifra-syntax.js`'s
  `THEMATIC_BREAK` at `:44` is the broad CommonMark break `[-*_]`; the
  chart/voicings boundary the parser and canonical writer use is the narrower
  **rule** — hyphens only — see Decision 2.)

### The format (cifra.md spec — the behaviour the fix must honour, not code to translate)

- **The two parts** — `spec/1-document.md` §1.5 (`:154-168`): "After the
  metadata, the document is two parts: 1. The **chart**: every line up to the
  first rule. 2. The **voicings part**: every line after it… A heading in the
  chart names a section; a heading in the voicings part names a voicing block.
  This is the only thing the rule does."
- **The rule** — `spec/1-document.md` §1.6 (`:173-189`): "The rule is a line
  consisting of three or more `-` characters and nothing else, after up to three
  spaces (§1.3)… **The first rule in the document, outside any fence (§1.9),
  ends the chart.** A later rule divides nothing… A line of hyphens inside a
  fence is not a rule." This is exactly where the new section must go: *above*
  the first rule.
- **A heading after the rule is a voicings block, and a mis-placed section is
  dropped** — `spec/7-voicings.md` §7.2 (`:56-65`): a heading after the rule
  "needs a tuning"; if it has no colon it is an error, and the reader's report
  "MUST say that a heading after the rule is read as a voicings block, that the
  lines under it are not read, and that a section belongs before the rule,
  because the likeliest cause is a `---` written between two sections out of
  Markdown habit (§1.6)." §7.4 (`:140-141`): "anything in the voicings part
  before its first block heading" is "reported and not kept."
- **Canonicalise drops it** — `spec/8-normalisation.md` §8.2 "The voicings
  part" (`:90-97`): "Drops what a reader skips: problem items, bad fingerings,
  lines before the first block and every rule after the first… Writes blocks,
  items and tunings in canonical order." The appended `## ` + fence is "lines
  before the first block" / a bad block heading, and is dropped on save.
- **Corpus witness** — `corpus/29-voicings-part/` ("What canonicalising drops
  after the rule"): `input.cifra.md` places stray notes and a bare list item
  after the rule before the first block; `canonical.cifra.md` shows them gone.
  This is the format-level proof that content wrongly placed after the rule does
  not survive a save.

### The library seams the fix uses

- **`cifra-md`** (local link `file:../../cifra.md/js`, entry `js/src/index.js`):
  - `fenceOpen(line)` (`js/src/markdown.js:64`), `closesFence(line, fence)`
    (`:76`) — re-exported; the reader's own fence recognition, so the helper
    skips a line of hyphens that sits *inside* a fence (spec §1.6: "A line of
    hyphens inside a fence is not a rule"). The same primitives
    `cifra-syntax.js` already imports (`cifra-syntax.js:13-21`).
  - `canonical(text)` / `isCanonical` (`js/src/write.js`, re-exported; listed
    among editor's seams, editor.md "code seams") — the save-side authority; the
    round-trip test canonicalises the produced buffer to prove the section
    survives.
  - The parser's boundary definition (for reference, not imported): `js/src/parse.js:30`
    `const RULE = /^ {0,3}-{3,}$/;`, flipped into the voicings part at
    `parse.js:498-502` (`if (RULE.test(raw)) { inVoicings = true; … }`). The
    editor's helper mirrors this regex locally (Decision 2).
- **Workflow / direction (unchanged by this fix):** workflow 3 §The editor
  (`docs/workflows/03-write-a-new-song.md` L77): "**Add section** writes a
  heading and a fence, and puts the cursor inside." — it never says "at the
  end"; inserting in the body satisfies it. DIRECTION §3.7
  (`docs/DIRECTION.md:418-420`) names CodeMirror 6 as the editor. No design
  document changes (Decision 4).

## Constraints / requirements

- **Canonical form over preserving content — the fix serves it, not fights
  it.** The fix does not teach the editor to preserve a section placed after the
  rule; it places the section where canonical form keeps it (in the chart). The
  Worker's `save` remains the single canonicalising authority (DIRECTION §3.6;
  editor Constraint "Canonical form over preserving content, and the save
  refusal are the Worker's"). *Central.*
- **The view is the only React layer; the Worker owns the data.** The fix is a
  buffer edit in the view (a CodeMirror transaction); it touches no IndexedDB,
  git or the book lock, and adds no Worker command. *Applies.*
- **Reuse cifra-md's own primitives, not a new grammar** (editor Decision 8).
  Fence recognition comes from `fenceOpen`/`closesFence`; the rule regex is the
  literal spec §1.6 definition kept local to the editor, the way
  `cifra-syntax.js` already keeps `THEMATIC_BREAK`/`LIST_ITEM` local
  (`cifra-syntax.js:44-48`). No second parser of the format (Decision 1, 2).
- **Accessibility.** No UI change — the same single "Add section" button
  (`SongEditor.jsx:311-313`), same keyboard path; the behavior test keeps its
  axe check green. Nothing new to colour-code. *Applies (no regression).*
- **No song text in logs.** Unchanged — the fix logs nothing; fixtures are
  purpose-written songs. *Applies.*
- **Offline first.** The insertion is local buffer work; the edit persists via
  the existing debounced `WRITE`; the round-trip happens at save. No network.
  *Applies.*

## Acceptance criteria

### Behavior delivered

1. **Add section on a song with a voicings appendix lands in the body.** Given a
   buffer whose chart is followed by `---` and one or more `## Voicings:` blocks,
   pressing **Add section** inserts the `## ` heading + empty fence **before the
   rule** (at the end of the chart), with the cursor on the empty line inside the
   new fence, and a blank line separating the new section from both the preceding
   content and the following rule. *Pins spec §1.5/§1.6, workflow 3 §The editor
   L77.*
2. **The new section survives a save.** The buffer produced in (1), run through
   the canonical writer (as the Worker's save does), **retains** the new section
   heading — it is not dropped. Contrast: the pre-fix buffer (section appended
   after the rule) loses it to canonicalise (spec §8.2; `corpus/29-voicings-part`).
   *Pins the defect's resolution.*
3. **No appendix → unchanged.** On a song or template with no rule, Add section
   still inserts at document end, exactly as before. *Pins the no-regression
   path (editor AC 4).*
4. **A rule inside a fence is not the boundary.** A `---` (or longer hyphen run)
   that sits inside a music or verbatim fence does not count as the appendix
   opener; the helper tracks fence state and ignores it (spec §1.6 "A line of
   hyphens inside a fence is not a rule"). *Pins fence-aware boundary detection.*
5. **The first rule wins.** When more than one rule line is present, the
   insertion point is before the **first** one outside a fence (a later rule
   "divides nothing", spec §1.6). *Pins §1.6.*

Wiring: `sectionInsertPos(text)` in `app/src/editor/section-insert.js`;
`addSection` in `SongEditor.jsx` computes `from` (and the trailing-newline
padding) from it.

### Tests the task lands with, by level

Per the `.tji` note: **unit** and **behavior**. (No e2e: the note names none,
and the fix is a pure insertion-point computation fully exercised at unit +
behavior; editor's existing `e2e/web/tests/editor.spec.js` already drives Add
section on the three viewports. See Decision 3.) Fixtures are purpose-written
songs, never anyone's copyrighted words.

- **unit — `app/src/editor/section-insert.test.js`** (*insert above the appendix
  separator*): `sectionInsertPos(text)` returns
  - the offset at the start of the first `---` line (net of the blank line
    before it) for a song with a chart + `---` + `## Voicings:` appendix;
  - `text.length` for a song with no rule;
  - `text.length` (not the in-fence hyphen line) for a song whose only line of
    hyphens sits inside a ```` ``` ```` or ```` ```tab ```` fence;
  - the offset before the **first** rule when two `---` lines are present;
  - the offset for a rule written with up to three leading spaces (`  ---`) and
    for a longer run (`----`) (spec §1.3/§1.6).
  *Pins spec §1.5/§1.6; the parser boundary `parse.js:30`.*
- **behavior — `app/src/editor/SongEditor.behavior.test.jsx`** (added case,
  real RAC + i18n, loopback store seeded with a `source` slice holding a
  song-with-voicings fixture, axe over `container`):
  - *Add section in a song with voicings* — mount the editor on the fixture,
    activate **Add section** (by keyboard, as the existing add-section case at
    `:67`), and assert the new `## ` heading appears **before** the `---`/`##
    Voicings:` line in the buffer, cursor in the empty fence; then assert
    `canonical(buffer)` **still contains** the new section heading (the save
    round-trips it). *Pins the note's behavior clause; spec §8.2.*
  - The existing add-section case (no appendix) continues to pass unchanged
    (section appended at end). axe remains clean (no UI change).
  *Pins workflow 4 §Normalising's "don't lose hand-typed work" principle applied
  to Add section; the note's behavior clause.*

### Deferred / out of scope

- **A manually-typed section after a hand-typed rule is still silently dropped.**
  If a user types a `---` and then a `## ` section heading themselves (rather
  than via Add section), the reader reports it (`spec/7-voicings.md` §7.2;
  `js/src/parse.js:548-549`) but that diagnostic is **not** among the editor's
  `SAVE_BLOCKERS` (`{'bad-voicing','marker-line'}`, `SongEditor.jsx:48`), so the
  save still drops it without warning. This task fixes the Add-section button
  (the note's explicit scope — "Fix: insert the new section above the first
  ---"), not the save gate. Whether to extend the voicing-stop gate to also
  block a dropped-section-after-rule is a product-scope judgment surfaced to the
  parking lot (see return summary); it is **not** registered as a WBS leaf.

## Decisions

1. **The fix is a view-side insertion-point computation, not a Worker or format
   change.** The defect is purely *where* the button inserts; the Worker's save
   (canonicalise → commit → push) is already correct — it drops a mis-placed
   section exactly as the spec says it must. So the fix lives in the view, in a
   small pure helper beside `fence-paste.js`, reusing `cifra-md`'s
   `fenceOpen`/`closesFence` for fence state (editor Decision 8). *Rejected:
   changing canonicalise to preserve a section placed after the rule — that
   would violate "canonical form over preserving content" and contradict spec
   §8.2 / `corpus/29-voicings-part`; the section is genuinely mis-placed, and the
   right answer is to place it correctly, not to rewrite the format's rules.*
2. **The boundary is the parser's rule (hyphens only, `^ {0,3}-{3,}$`), not the
   broad CommonMark thematic break.** The chart/voicings split that
   canonicalise acts on is defined by the **rule** — three or more hyphens and
   nothing else (spec §1.6; `js/src/parse.js:30`). `cifra-syntax.js`'s
   `THEMATIC_BREAK` (`:44`) matches `-`, `*` or `_` for colouring, but a `***`
   or `___` line is *not* the voicings boundary and inserting before it would be
   wrong. The helper therefore uses the hyphens-only rule regex, kept local to
   the editor and commented against spec §1.6 — the same pattern
   `cifra-syntax.js` already uses for its own line regexes (`:44-48`). *Rejected:
   reusing the broad `THEMATIC_BREAK` — it would misidentify the boundary on a
   `*`/`_` break. Rejected: exporting a `RULE`/`isRule` primitive from
   `cifra-md` — `RULE` is a one-line regex local to `parse.js`; exporting it
   would be a cross-repo change to the format package (spec + corpus + both
   implementations move together) far out of proportion to a 0.5d app bug fix,
   and the editor already keeps equivalent regexes local.*
3. **No e2e test; unit + behavior as the note names.** The fix is a pure
   offset computation and a buffer edit, fully pinned by the unit test (the
   boundary cases) and the behavior test (the button on a real song, round-trip
   through `canonical`). editor's `e2e/web/tests/editor.spec.js` already exercises
   Add section on phone/tablet/computer; a dedicated e2e for this edge would add
   compose-stack cost without pinning anything the behavior test does not.
   *Rejected: adding an e2e case — disproportionate; the note names only unit and
   behavior, and no level the task needs is missing.*
4. **No design delta.** The fix makes the editor conform to existing governing
   documents: spec §1.5/§1.6/§8.2 (the format), and workflow 3 §The editor L77
   ("Add section writes a heading and a fence, and puts the cursor inside" —
   silent on position). editor.md's acceptance criterion 4 said "at the end";
   that was the defect, and a refinement's Acceptance section is the historical
   record of why its task existed, not a governing document — so it is not
   amended. Nothing in DIRECTION, a workflow or the spec is wrong; only the code
   was. *Rejected: editing editor.md AC 4 — refinement Acceptance sections are
   not amended after the fact (README task-completion ritual: "Don't edit the
   prior sections").*

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- Created `app/src/editor/section-insert.js`: pure `sectionInsertPos(text)` helper; scans lines tracking fence state via `fenceOpen`/`closesFence` (cifra-md primitives) and returns the offset before the first `---` rule outside a fence, or `text.length` when no rule exists.
- Created `app/src/editor/section-insert.test.js`: 10 unit cases covering end-of-chart offset, no-rule → doc end, hyphen line inside `` ``` ``/```` ```tab ```` fences ignored, first-of-two rules wins, leading-spaces and longer-run rules, multi-blank back-up, no-blank case, empty buffer.
- Edited `app/src/editor/SongEditor.jsx`: `addSection` now computes `from` via `sectionInsertPos` instead of `docStr.length`; trailing-newline padding accounts for the blank line before the rule when an appendix follows.
- Edited `app/src/editor/SongEditor.behavior.test.jsx`: added behavior case — Add section on a song with voicings lands before `---`/`## Voicings:`, cursor in the empty fence, blank line before the rule; `write(parse(buffer))` retains the section heading; pre-fix append-at-end buffer does not (axe clean). Existing no-appendix case unchanged.

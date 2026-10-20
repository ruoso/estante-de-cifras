# Refinement — `songs.format_help`

## TaskJuggler

[`tasks/60-songs.tji`](../../60-songs.tji), `task format_help "The song format
explained in the editor"` (line 207). The note, in short:

> As design.format_help decides: a format help popup reachable from the song
> editor, in plain words with copyable examples, and the hint from the editor
> when what was typed looks like another format. […] Tests: behavior (the popup
> opens from the editor and returns focus, examples insert or copy, the hint on
> bracket chords; axe); e2e-web (the help opened while writing a new song on
> the three viewports; axe).

## Effort estimate

1d, as the `.tji` gives it. The copy is already decided (English pinned in
workflow 3), the bracket notice already exists (`songs.unknown_tokens_loud`),
and Insert reuses *Add section*'s placement. The work is one dialog with two
presentations, the notice's second and third cases and *Show me how*, the
translations into three locales, and the tests. If it runs over, it is the
translations' examples (each must read clean — Constraint 3).

## Repository

estante-de-cifras, **not** `cifra.md/` (the note does not start with
`cifra.md:`). Files:

- `app/src/editor/format-help.js` — **new**, pure: the eight topics' ids and
  actions, and the example insertion.
- `app/src/editor/FormatHelp.jsx` — **new**: the *Writing a song* dialog (sheet
  on a phone, popover on a tablet and computer).
- `app/src/editor/section-insert.js` — gains `sectionInsertion(text, block)`,
  the padding `addSection` does inline today, so *Add section* and *Insert*
  share it.
- `app/src/editor/unknown-words.js` — gains the notice's two other cases.
- `app/src/editor/SongEditor.jsx` — *Help* in the editor bar, the notice
  generalised to three cases with *Show me how*.
- `app/src/editor/editor.css` — the help's layout (only `var(--…)` tokens).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — new keys; the stale
  `editor.help` object removed (Decision 7).
- `docs/workflows/03-write-a-new-song.md` §Help with the format — delta
  **written with this refinement** (focus goes back to the opener; a refused
  copy; Decision 5, Decision 6).
- Tests: `app/src/editor/format-help.test.js` (new),
  `app/src/editor/unknown-words.test.js`,
  `app/src/editor/section-insert.test.js`,
  `app/src/editor/SongEditor.behavior.test.jsx`,
  `app/src/editor/FormatHelp.behavior.test.jsx` (new),
  `e2e/web/tests/format-help.spec.js` (new).

No `cifra.md/`, `service/` or `api/` change.

## Inherited dependencies

Settled (`complete 100`):

- `design.format_help` — workflow 3 §Help with the format (L104-235) and §When
  it looks like another format (L236-265), workflow 4 §Editing (L25-31),
  DIRECTION §6 *Help with the format*, the board
  `docs/mockups/Format-help.dc.html`, and *Help* drawn into the W03/W04 editor
  bars. Refinement `tasks/refinements/design/format_help.md`.
- `songs.render_notes` — notes and verbatim parts drawn in the preview, so the
  *Notes* example (topic 7) and a song written outside the fence read in the
  preview as the help says (`app/src/chart/layout.js`, `Chart.jsx`).
- `songs.unknown_tokens_loud` (not in `depends`, but landed): the
  chord-in-brackets notice, its cursor-left-the-line timing and its dismiss
  (`SongEditor.jsx:395-401`, `:532-545`), `chordBracketHeadings`
  (`unknown-words.js:69`), the `.est-unknown` marks and the save sheet's
  *Save anyway*. Its Decision 5 leaves *Show me how* and the notice's other
  cases to this task.
- `songs.editor`, `songs.editor_chrome`, `shell.portal_provider` (every RAC
  overlay portals inside `.est`, `app/src/theme/ThemeRoot.jsx:82`).

Pending: none. Downstream: milestone M3 (`tasks/99-milestones.tji:32`).

## What this task is

Build what `design.format_help` decided. A *Help* button (question-mark icon
and its word) in the song editor's own bar opens **Writing a song**: one
scrolling page of eight short topics, each a heading, a sentence or two and an
example in the editor's monospaced face; the parts' examples carry **Insert**,
the title and the voicings **Copy**. On a phone it is a bottom sheet; on a
tablet and computer a panel hanging from *Help*, over the preview. And the
editor's notice that what was typed looks like another format grows from one
case to the workflow's two (chords in brackets — as a part name or inside
notes — and chords outside the music), each with **Show me how**, which opens
the help at the topic that answers it. All copy in the four locales.

## Why it needs to be done

The usability review of 2026-10-19 (M1) watched a writer type `[Am]Teste
[G]linha` and get a blank preview: the editor says nothing about the marks the
format asks for (workflow 3 §The editor, L56-62). `songs.unknown_tokens_loud`
now says *that* something looks wrong; this task says *how* it is written. It
is one of M3's leaves.

## Inputs / context

- **Workflow 3** `docs/workflows/03-write-a-new-song.md`: §The editor
  (L80-83, *Help* is one of the editor's helps); §Pasting a cifra (L101-102);
  §Help with the format (L104-235) — where *Help* sits, the surface per
  device, the intro line, the eight topics with their **pinned English copy
  and examples** (L118-211), Insert/Copy (L213-220), closing and focus
  (L222-227, as amended here), what is translated (L229-235); §When it looks
  like another format (L236-265) — the two cases and their notice copy, one at
  a time, bracket first, timing, dismissal, never a stop or a rewrite.
- **Workflow 4** `docs/workflows/04-edit-and-save.md` §Editing (L25-31): the
  same help and notice when editing a saved song.
- **DIRECTION** §6 *Help with the format* bullet; §3.7 (CodeMirror 6 is the
  source editor); §4 (accessibility).
- **Board** `docs/mockups/Format-help.dc.html`: Phone 1 (L24-75 — the bar
  *Text | Preview* + *Help*, the bracket notice with *Show me how* and an
  icon-only dismiss), Phone 2 (L76-120 — the sheet with a grip, *Writing a
  song*, close, topic 3 with *Insert*), Tablet in pt-BR (L121-183 — the panel
  *Escrevendo uma música*, topics 1-2, *Copiar* / *Inserir*; its texts are a
  starting point for the pt-BR keys), Computer (L184-254 — the
  chords-outside-the-music notice, the panel open from *Show me how* hanging
  from *Help*, `aria-expanded` on *Help*, L197). The design refinement's
  Status records the Computer deviation: a song with any fence is never
  checked for unfenced music.
- **The format** (for the examples and the triggers): `cifra.md/spec/1-document.md`
  §1.7.2 (bracket heading), §1.9 (fences, notes, `//`, `~~~`, and the
  MUST-report for an unfenced chart); `cifra.md/spec/2-chart.md` §2.9;
  `cifra.md/spec/7-voicings.md` §7.3 (`Voicings` is the default label). The JS
  reader: `unfencedCheck` (`cifra.md/js/src/parse.js:729-747`) reports
  `{code: "unfenced-music", line, message, text}` once, only when the song has
  no music fence (`:694`); `unknownTokens` (from `cifra-md`).
- **The app today**:
  - `app/src/editor/SongEditor.jsx`: the editor bar `.est-editor-bar`
    (L487-518), the *Text | Preview* `ToggleButtonGroup` on narrow (L489-499),
    `.est-editor-bar-actions` with *Add section* and *Save*, each hidden when
    the host draws it (L504-516); `mode = layoutMode ?? useLayoutMode()`
    (L107-108; `'narrow'` below `WIDE_QUERY` `(min-width: 600px)`,
    `app/src/shell/layout-mode.js:22`); the paste notice (L520-530); the
    bracket notice and its `bracketDismissed`, `cursorLine`, `pastedLines`
    state (L121-123, L395-401, L532-545); `addSection` and its padding
    (L412-435); `viewRef` (L153); `parsed` (L388); `song = isSongPath(path)`.
  - `app/src/editor/section-insert.js:38` `sectionInsertPos(text)`.
  - `app/src/editor/unknown-words.js`: `isSongPath` (L22), `unknownMarks`
    (L42), `chordBracketHeadings(text) → {line, name}[]` (L69).
  - `app/src/songs/EditorChrome.jsx`: the phone's app bar Back · title · Save
    (L56-70) and bottom bar *Add section* · *Discard* (L78-86) — *Help* adds
    nothing there (editor_chrome.md Constraint 3).
  - Overlay precedents: `app/src/songs/SaveSheet.jsx:489-501` (`ModalOverlay
    .scrim` + `Modal .sheet` + `Dialog`, `grip`); the transpose popover
    `app/src/songs/SongReading.jsx:417-439` (`DialogTrigger > Button +
    Popover className="popover" > Dialog`); a `card` surface
    (`SongReading.jsx:499`; memory: a bare Popover renders see-through).
  - Clipboard precedent: `app/src/books/sharing-parts.jsx:121-122`
    (`navigator.clipboard?.writeText` guarded).
  - i18n: `editor.source.*` at `app/src/i18n/locales/en.js:1915-1936`; the
    stale `editor.help` object (`en.js:1978-…`, Explore Chords' syntax —
    `# Verse`, `Solo:`, `> A`, `@9` — read by nothing in `app/src`);
    structured copy read with `tr(key)` (`app/src/i18n/index.js:109`,
    precedent `SongWizard.jsx:301`); the parity test
    `app/src/i18n/i18n.test.js:46` (every locale has every English leaf,
    placeholders checked at L55).
  - Tests: `app/src/editor/SongEditor.behavior.test.jsx` (the
    `getClientRects` stubs L22-31, `open`/`mountSong` helpers, the bracket
    cases L721-790, `checkWcag21aa`); `e2e/web/tests/unknown-tokens.spec.js`
    (the real-UI way into a new song's editor: *Write a song*, `.cm-content`,
    `keyboard.insertText`); `e2e/web/lib/axe.js` (`checkA11y`, both themes);
    projects `phone`/`tablet`/`computer` (`e2e/web/playwright.config.js:39-42`).
- Predecessor refinements: `tasks/refinements/design/format_help.md` (its
  Decisions are the design), `tasks/refinements/songs/unknown_tokens_loud.md`
  (Decisions 2, 5, 6), `tasks/refinements/songs/editor_chrome.md` (bars per
  device).

## Constraints / requirements

1. **The workflow's copy, verbatim in English.** The intro, the eight
   topics' headings, sentences and examples, *Insert*, *Copy*, *Copied*, the
   notice texts and *Show me how* are workflow 3's words exactly. Topics are
   numbered in their headings as the board draws them (*3. Chords over
   words*).
2. **Translations** into pt-BR, es-419 and it: sentences, part names and sung
   words translated; never `#`, `##`, the backticks, `~~~`, `|`, `%`, `|:`,
   `:|`, `x3`, `1.`, `2.`, `[ ]`, `//`, `---`, the chord symbols, the tuning,
   or `Voicings` (workflow 3 L229-235; cifra.md §7.3).
3. **Every example in every locale reads as its topic says**: no diagnostic,
   no unknown token, the same chords as the English example in the same
   order; topics 2-3 sung; topic 6's part named by its translated *Chorus*;
   topic 8's voicings under the default label. Pinned by a unit test over
   every locale (Acceptance, unit).
4. **Canonical form wins; nothing is rewritten.** The notice never edits the
   text; *Insert* adds an example the writer then owns, as one CodeMirror
   transaction (one undo takes it back) at `sectionInsertPos` — never at the
   cursor, never inside a fence, never after the voicings rule. The save stays
   as workflow 4 has it; the notice never stops it.
5. **Songs only.** *Help* and the notice exist when `song` is true (a
   `*.cifra.md` path or a new song); the file view's raw editor of a README or
   setlist shows neither (workflow 3 L107-109; unknown_tokens_loud Decision 6).
6. **Placement.** *Help* is in `.est-editor-bar`, always drawn by the editor
   (never published to the host like `addSectionRef`): on a phone beside *Text
   | Preview*, on a tablet and computer beside *Add section*. Nothing is added
   to `EditorChrome`'s bars.
7. **Accessibility.** *Help* is a RAC `Button` with its word (the icon
   `aria-hidden`), `aria-expanded` while open. The help is a RAC `Dialog`
   named by its `Heading` *Writing a song*, each topic a `<section>` labelled
   by an `h3`, each example a `<pre>` in `--font-code` (selectable text). Each
   action names its topic: *Insert the Bars example*, *Copy the Title and
   details example* (`aria-label`, visible word *Insert* / *Copy*); *Copied*
   and the copy failure are announced (`role="status"` on the button's live
   text or a status line). Escape and the close button close it; on a phone
   the sheet also closes on the scrim, on a tablet/computer the popover on an
   outside press. The notice stays `role="status"`, words not colour; *Show me
   how* is a RAC `Button`; the dismiss keeps its `aria-label`. axe WCAG 2.1 AA
   on every state, in both themes in e2e.
8. **Offline first.** The help is bundled copy; nothing it does touches the
   network or the Worker.
9. **Overlays portal inside `.est`** (already app-wide via
   `UNSAFE_PortalProvider`); the popover carries a surface class (`card`) so it
   is not see-through.
10. **Fixtures** are the help's own purpose-written examples (*Moonlit Road*,
    *The Porch Band*) and purpose-written test songs; no one else's words.

## Acceptance criteria

### Behavior delivered

1. **`app/src/editor/format-help.js`** (pure, no React):
   - `FORMAT_TOPICS` — the eight topics in order, `{ id, action }`:
     `title` (copy), `parts`, `chords`, `bars`, `repeats`, `bracketNames`,
     `notes` (insert), `voicings` (copy).
   - `exampleInsertion(text, example) → { from, insert, cursor }` — built on
     `sectionInsertion` (below): `from = sectionInsertPos(text)`, the example
     padded by a blank line on each side as *Add section* pads, `cursor` the
     end of the example itself (before any trailing padding).
   - `section-insert.js` gains `sectionInsertion(text, block) → { from,
     insert, offset }` (the padding now inline in `SongEditor.addSection`,
     L421-430, returning where `block` starts in `insert`); `addSection` calls
     it with its empty heading-and-fence block, behaving exactly as before.
2. **The notice's cases**, in `unknown-words.js`:
   - `bracketChordsInNotes(text) → {line}[]` — lines **outside** any fence
     (and not a `#` heading or a list item) holding a bracketed chord
     immediately followed by a letter (`[G]Walk`), the name a chord in the
     song's dialect (`isChord`, as `chordBracketHeadings`). `[Chorus]Walk`,
     `[G] walk` and `[G]` alone are not flagged.
   - `unfencedChordsLine(parsed) → line | null` — the `line` of the reader's
     `unfenced-music` diagnostic.
   - `formatHint({ text, parsed, cursorLine, pastedLines, dismissed }) →
     { kind: 'bracket' | 'unfenced', line, topic } | null` — one notice at a
     time, chords in brackets first (headings and notes together, the first
     line that counts), then chords outside the music; a line counts when the
     cursor is not on it or it was pasted; `dismissed` is a set of kinds;
     `topic` is `chords` for bracket, `parts` for unfenced (workflow 3
     L244-252).
3. **The editor** (`SongEditor.jsx`), for a song only:
   - *Help* in the bar as Constraint 6. Pressing it opens the help at its
     top; it closes as Constraint 7; focus returns to the opener.
   - The notice shows `formatHint`'s case: the bracket copy (the existing
     `editor.source.bracketChords`) or the new `editor.source.unfencedChords`
     — en: *Line {line} looks like chords, but it is outside the music, so it
     is kept as a note. Music goes between two lines of three backticks.* —
     each with **Show me how** (`editor.source.showMeHow`) and the dismiss.
     Dismissing sends away that case for the rest of this editing (Decision
     4). *Show me how* opens the help at the case's topic, its heading
     focused.
   - *Insert* dispatches `exampleInsertion` as one transaction (`selection`
     at `cursor`, `scrollIntoView`), closes the help and focuses the text.
     *Copy* calls `navigator.clipboard.writeText(example)`; on success the
     button says *Copied* (about two seconds, then back to *Copy*); with no
     clipboard or a refusal it says *Could not copy — select the example
     instead*. The help stays open on Copy.
4. **`FormatHelp.jsx`**: `presentation` from the editor's `mode` —
   `'narrow'` → `ModalOverlay .scrim` + `Modal .sheet` (with the grip) +
   `Dialog`, as SaveSheet does; otherwise a `Popover` (`triggerRef` = *Help*,
   `placement="bottom end"`, `className="popover card est-format-help"`, a max
   height with its own scroll) + `Dialog`. The same content in both: heading,
   close button, intro, the eight topics. Opened from *Show me how* the popover
   still hangs from *Help* (board Computer, L197).
5. **Copy** (all four locales), under `editor.formatHelp`: `open` (*Help*),
   `title` (*Writing a song*), `intro`, `close` (*Close*), `insert`,
   `insertLabel` (*Insert the {topic} example*), `copy`, `copyLabel` (*Copy
   the {topic} example*), `copied`, `copyFailed`, and `topics.<id>.{heading,
   text, example}` for the eight ids; under `editor.source`: `showMeHow`,
   `unfencedChords` (`{line}`). The `editor.help` object is removed from every
   locale.

### Tests the task lands with, by level

Per the note: **behavior** and **e2e-web**; plus **unit** for the pure
modules this adds.

- **unit — `app/src/editor/format-help.test.js`**:
  *"every locale's examples read as their topic says"* — for `en`, `pt-BR`,
  `es-419`, `it` and every topic: `parse(example)` has no diagnostics and
  `unknownTokens(example)` is `[]`; the chord symbols read are the English
  example's, in order; `parts` and `chords` are sung; `bracketNames` opens a
  section named by that locale's word for *Chorus* (bracket heading);
  `voicings` yields voicings under the default label (Constraint 3; workflow 3
  L229-235; cifra.md §7.3). *"the English copy is the workflow's"* — the en
  intro, the eight headings and examples equal workflow 3 L118-211 (literal
  strings in the test). *"Insert lands where Add section does"* —
  `exampleInsertion` on an empty text, on a song ending in a fence, and on a
  song with a voicings appendix: `from` is before the `---`, the result
  parses with the example as its own section and the voicings kept; `cursor`
  is the end of the example (Constraint 4).
- **unit — `app/src/editor/section-insert.test.js`**, added:
  `sectionInsertion` pads as `addSection` did — at the start (no lead), after
  text ending in one newline (one more), before an appendix (a blank line
  after).
- **unit — `app/src/editor/unknown-words.test.js`**, added:
  `bracketChordsInNotes` — `[G]Walk the road` outside a fence flagged at its
  line; `[Chorus]Walk`, `[G] walk`, `[G]` alone, the same line inside a fence,
  a `## [G]Walk` heading not flagged; the song's dialect decides as for
  `chordBracketHeadings`. `formatHint` — bracket before unfenced in one text;
  the cursor's line does not count until it leaves, a pasted line counts at
  once; a dismissed kind yields the other; an unfenced `G | C | D` under `##
  Intro` with no fence → `{kind:'unfenced', line, topic:'parts'}`, and none
  once any fence exists (spec §1.9; workflow 3 L236-265).
- **behavior — `app/src/editor/FormatHelp.behavior.test.jsx`** (new):
  *"a sheet on a phone, a popover elsewhere"* — `presentation` narrow renders
  the `.sheet` with a grip, wide the `.popover.card`; both a dialog named
  *Writing a song* with eight `h3` topics in order; axe clean in each.
  *"Copy says Copied, or that it could not"* — a stubbed
  `navigator.clipboard.writeText` receives the title example and the button
  reads *Copied*; with `navigator.clipboard` deleted it reads *Could not copy
  — select the example instead*; the help stays open. *"opens at a topic"* —
  `topic="chords"`: the *3. Chords over words* heading has focus. *"in
  pt-BR"* — the heading *Escrevendo uma música*, *Inserir*, *Copiar*, the
  examples' marks untouched. (Workflow 3 §Help with the format; board Phone 2,
  Tablet.)
- **behavior — `app/src/editor/SongEditor.behavior.test.jsx`**, added cases:
  *"Help opens the help and Escape returns focus to Help"* — a song: *Help*
  in the bar (narrow beside *Text | Preview*, wide beside *Add section*),
  `aria-expanded` true while open, Escape → closed, focus on *Help*; axe clean
  with it open. *"Insert puts the Bars example where Add section would, and
  one undo removes it"* — a song with a voicings appendix: *Insert the Bars
  example* → the text holds `## Intro` + the fence + `G | % | C | D` before
  `---`, the help closed, the cursor at the example's end, focus in the
  editor; `undo(view)` → the text as before. *"Show me how opens the help at
  Chords over words"* — `emit(SOURCE)` with `[Am]Teste [G]linha` fenced: the
  notice's *Show me how* → the dialog open, *3. Chords over words* focused;
  close → focus back on *Show me how*. *"chords outside the music"* — a song
  `## Intro` / `G | C | D` with no fence: the notice reads the
  `unfencedChords` copy naming the line, *Show me how* opens at *2. Parts and
  the music fence*; dismiss → gone; a bracket line then added still raises
  the bracket notice. *"bracket chords in notes"* — `[G]Walk the road` outside
  a fence raises the bracket notice. *"a README has no Help"* —
  `path="README.md"`: no *Help*, no notice. The existing bracket cases
  (L721-790) keep passing. (Workflow 3 §Help with the format, §When it looks
  like another format; workflow 4 §Editing.)
- **e2e-web — `e2e/web/tests/format-help.spec.js`**, on phone, tablet and
  computer, through the real UI only (no `#dev/*`, no injected state, no
  clipboard permission): *"the help opened while writing a new song"* —
  `startApp`, *Write a song*, the editor's *Help* → the dialog *Writing a
  song* visible (a sheet on phone, a panel on tablet/computer), `checkA11y`
  on it; *Insert the Bars example* → the dialog gone and `.cm-content` holds
  `G | % | C | D`; then clear the text and type (`keyboard.insertText`, as
  `unknown-tokens.spec.js`) a fence holding `[Am]Walk the road` and move to
  the next line → the bracket notice; *Show me how* → the dialog open with
  *3. Chords over words* in view; Escape → closed, *Show me how* focused;
  `checkA11y` on the editor with the notice. (The note's e2e clause; workflow
  3 §Help with the format, §When it looks like another format; board
  Format-help Phone 1-2, Tablet, Computer.)

Every test is driven by what exists: the new-song editor (`songs.new_song`),
a local book, no account and no network. No test needs a `#dev/*` mount.

### Deferred

(none.)

## Decisions

1. **One `formatHint` over three detectors, extending the existing notice.**
   unknown_tokens_loud's notice already carries the bracket copy, timing and
   dismissal; this task generalises its state to the case shown and adds *Show
   me how*. *Rejected: a second notice component beside it* — workflow 3 says
   one notice at a time, bracket first, which one function decides and tests.
2. **The unfenced case reads the reader's diagnostic.** `unfenced-music` is the
   format's own MUST-report (§1.9), already computed in `parsed`. *Rejected:
   re-detecting chord lines in the app* — a second grammar
   (unknown_tokens_loud Decision 1). Consequence, as the reader has it: a song
   with any music fence is not checked (the design refinement's Status).
3. **The notes bracket case is a narrow app check.** Workflow 3 names it ("in
   notes, a chord in brackets followed at once by a letter"); the reader
   reports nothing there (notes are free text). A scan of non-fenced,
   non-heading lines for `\[name\]\p{L}` with `isChord(name)` is the smallest
   check that catches ChordPro and nothing a note normally holds. *Rejected:
   flagging any bracket outside a fence* — `[Chorus]` in a note is a word.
4. **Dismissal is per case.** Dismissing *chords in brackets* does not silence
   *chords outside the music*: they are different mistakes with different
   answers, and workflow 3's "sends it away" names the notice the writer saw.
   *Rejected: one dismissal for all* — would hide the second mistake unseen.
5. **Focus goes back to the opener** (design delta, workflow 3 L222-227).
   RAC restores focus to what had it before opening; from the notice that is
   *Show me how*, still there because the case is. *Rejected: forcing focus to
   Help* — a jump the user did not make, fighting RAC's FocusScope. The
   popover still hangs from *Help*, as the board draws it.
6. **A refused copy says so** (design delta, same paragraph). The clipboard
   can be absent or refused; *Copy* that silently does nothing would be a
   button lying. The example is plain selectable text as the fallback.
   *Rejected: hiding Copy without a clipboard* — the title and voicings would
   have no action at all.
7. **The stale `editor.help` copy is removed, not reused.** It describes
   Explore Chords' syntax (`# Verse` as a section, `Solo:`, `> A`, `@9`), is
   read by nothing, and contradicts the help this task ships; keeping it beside
   `editor.formatHelp` invites the wrong one being wired. The parity test
   keeps the four locales in step.
8. **Structured topics keyed by id, read with `tr`.** Keys per topic
   (`topics.<id>.heading`) rather than an array keep the parity test's leaves
   named and a missing translation readable. *Rejected: examples outside i18n*
   — part names and sung words are translated (workflow 3).
9. **`sectionInsertion` is extracted, not duplicated.** *Insert* and *Add
   section* place a part by the same rule (design Decision *Insert for the
   parts*); one pure function makes that a tested fact. *Rejected: Insert at
   the cursor* — the design refused it.
10. **The phone/wide split follows the editor's `mode`.** The editor already
    knows `narrow` (below 600px) — the phone, where the toggle shows. The hosts
    use the same split for SaveSheet. *Rejected: a third, computer-only
    presentation* — the design draws the same panel on tablet and computer.
11. **e2e does not exercise Copy.** Granting clipboard permission is
    context set-up outside the real UI; Copy's success and refusal are pinned
    in behavior with a stubbed clipboard. The e2e level carries the
    user-visible promise the note names — the help opened while writing a
    new song, Insert, and *Show me how* — on all three viewports.

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-20.

- The pure modules: `app/src/editor/format-help.js` (the eight topics, `exampleInsertion`) and `sectionInsertion` extracted into `app/src/editor/section-insert.js`, so *Insert* and *Add section* place a part by one rule.
- The notice's cases in `app/src/editor/unknown-words.js`: `bracketChordsInNotes`, `unfencedChordsLine`, `formatHint` (bracket first, then chords outside the music; dismissed per case).
- `app/src/editor/FormatHelp.jsx` — *Writing a song*: a sheet on a phone, a `card` popover hanging from *Help* on a tablet and computer; *Insert* / *Copy* with *Copied* and a refused-copy message. `app/src/editor/SongEditor.jsx` gains *Help* in the editor bar and the generalised notice with *Show me how*; layout in `app/src/editor/editor.css`.
- Copy in four locales (`app/src/i18n/locales/{en,pt-BR,es-419,it}.js`): `editor.formatHelp.*`, `editor.source.showMeHow`, `editor.source.unfencedChords`; the stale `editor.help` removed. `docs/workflows/03-write-a-new-song.md` §Help with the format carries the design delta (focus back to the opener; a refused copy).
- Tests: unit `app/src/editor/format-help.test.js` (every locale's examples read clean), `section-insert.test.js`, `unknown-words.test.js`; behavior `app/src/editor/FormatHelp.behavior.test.jsx` and new cases in `SongEditor.behavior.test.jsx`; e2e-web `e2e/web/tests/format-help.spec.js`.
- Deviations: "(workflow 5)" left out of topic 8's on-screen sentence; *Insert* isolates its undo step (`isolateHistory`); the close button calls `onClose` directly because a standalone RAC Popover does not hand the Dialog its `close`.
- Tech debt: none.

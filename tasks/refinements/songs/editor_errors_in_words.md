# songs.editor_errors_in_words — A line the editor marks red says why

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) — `task editor_errors_in_words`
(lines 263-268), in milestone `m3_service`
([`tasks/99-milestones.tji`](../../99-milestones.tji) line 32).

## Effort estimate

1d. Design and build in one task: a workflow delta (written with this
refinement), a drawing on the editor board, and the app change.

## Repository

Not under `cifra.md/`. The work lands in:

- `app/src/editor/` — a new pure module `diagnostic-words.js` (and its test),
  `fence-paste.js` (a second pure transform), `source-extensions.js` (the line
  notes), `SongEditor.jsx` (the live line, the offer, the wrap notice),
  `editor.css`;
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the new keys;
- `docs/mockups/W04-edit-and-save.dc.html` and `docs/mockups/canvas.json` —
  the drawing;
- `e2e/web/tests/editor-errors.spec.js` — new.

Design delta (written with this refinement; it rides in the closer's commit):
`docs/workflows/04-edit-and-save.md` §Editing, the two new paragraphs at
L33-54; `docs/workflows/03-write-a-new-song.md` §When it looks like another
format, the *Chords outside the music* bullet (the sentence about **Put it in
the music**) and the "does not rewrite the text unasked" sentence (L265-267).

## Inherited dependencies

- `songs.unknown_tokens_loud` — **settled** (Done 2026-10-20). It added the
  unknown-word marks (`est-unknown`, a wavy underline with a `title`) and
  the bracket notice. It also set the rule this task keeps: a typed line
  counts once the cursor has left it.
- `songs.format_help` — **settled** (Done 2026-10-20). It added the *Help*
  panel and `formatHint`, which fires on `unfenced-music` and shows the notice
  with **Show me how** and dismiss (`SongEditor.jsx` L623-643). This task adds
  the offer to that notice.
- Reaching back: `songs.editor` (Done 2026-10-06). It built the line classifier
  `classifyLines`, the paste-into-a-fence transform `fencePaste` with its
  **Undo** notice, and CodeMirror 6 with no lint package.

## What this task is

Today a line the reader reports turns red, and nothing says why. The red is
a line class: `est-err`, set from `parse().diagnostics` in
`app/src/editor/cifra-syntax.js` L69-80 and styled at `editor.css` L158. That
is status carried by colour alone.

This task gives every reported line its words, in two places:

- **On screen:** a note right under the line, saying in the user's language
  what is wrong.
- **For a screen reader:** a live line that speaks the same words once, when
  the cursor arrives on the line.

It also gives the commonest case its fix. When the reported line is chords
outside the music (`unfenced-music`, cifra.md §1.9), the existing notice
offers **Put it in the music**. That fences the line's paragraph in one
undoable step, and a notice with **Undo** then says so, the way a paste does.

## Why it needs to be done

A teacher overwrote the new-song template, which removed its fence. His bar
line `| Am7 | D7 | Gm7 | C7 |` turned red. Nothing on screen said why, and only
*Help* told him about the fence. The existing notice waits for the cursor to
leave the line, and it sits above the text, away from where he was looking.
(Source: persona exploration 2026-10-20.)

The design's standing rule is that status is carried by a word, never by
colour alone (`docs/mockups/README.md` L26; `theme.css` L178; GUIDE.md L36).
A red line breaks that rule for every user, and a screen reader user gets no
signal at all. This task is part of `m3_service`'s polish set.

## Inputs / context

- **Workflow 4 §Editing** (`docs/workflows/04-edit-and-save.md` L9-54): the
  delta at L33-54 is normative for this task.
- **Workflow 3:**
  - §When it looks like another format (`docs/workflows/03-write-a-new-song.md`
    L241-270): the two notices, their timing, and "never stops a save".
  - §Pasting a cifra (L96-107): the paste wrap and its **Undo** message, which
    the new wrap notice mirrors.
- **cifra.md:**
  - §1.9 Fences and notes (`cifra.md/spec/1-document.md` L311, L371-375): a
    chart with no fence whose notes would read as chords is reported, naming
    the **first** such line. A chart with any fence is not checked.
  - §0 (`0-overview.md` L172-173): a diagnostic is `{code, message, line,
    text?}`. The codes are stable and pinned by the corpus (e.g.
    `corpus/19-unfenced-paste/parsed.json`). The `message` is English only.
- **Diagnostic codes `cifra.md/js/src/parse.js` emits** (`diag()` L329-333):
  - `duplicate-property`, `bad-property`, `marker-line`, `bad-notation`,
    `heading-looks-like-key`, `unclosed-fence`, `extra-rule`
  - `bad-block-heading`, `duplicate-block`, `item-outside-block`,
    `bad-voicing`, `bad-fingering`, `notes-outside-block`, `unfenced-music`
  - `stray-mark`, `ending-outside-group`, `count-out-of-place`,
    `unclosed-group`, `bad-ending-sequence`, `count-with-endings`,
    `repeat-without-previous`, `repeat-beside-items`
- **App seams:**
  - `app/src/editor/cifra-syntax.js` L69-80: `reportedLines`. A `marker-line`
    becomes `mk`, and every other reported line becomes `err`.
  - `app/src/editor/source-extensions.js`:
    - L25-36: `buildDecorations`.
    - L41-63: `unknownMarksField`, the pattern a second StateField follows.
    - L75-101: `sourceExtensions`. It is shared by `SongEditor.jsx` L285 and
      `MarkedTextEditor.jsx` L35.
  - `app/src/editor/fence-paste.js` L55-80: `fencePaste`, plus the
    `fenceOpen`/`closesFence` scan.
  - `app/src/editor/unknown-words.js` L170-206: `unfencedChordsLine` and
    `formatHint`.
  - `app/src/editor/SongEditor.jsx`:
    - L138: `pasteNotice` state.
    - L144 and L302: `cursorLine`.
    - L243-274: the paste handler.
    - L417-430: `parsed` and `hint`.
    - L468: `isolateHistory` for *Insert*.
    - L479-485: `undoPaste`.
    - L611-643: the paste notice and the hint notice.
  - `app/src/editor/editor.css` L158: `.est .cm-line.est-err`.
  - `app/src/editor/template.js` L34-47: the template, whose `## Intro` fence
    is what the teacher removed.
  - `app/src/i18n/locales/en.js` L1958 onward: `editor.source.*`. Relevant
    keys are `pasteFenced` (L1969), `undo` (L1968), `showMeHow` (L1984) and
    `unfencedChords` (L1985).
- **Board:** `docs/mockups/W04-edit-and-save.dc.html`. Its editor lines are
  data `{cls, text}` (L43, L116, L184). Its only error line is the bad voicing
  `- Em: 02200` (L261), drawn in the computer frame under the save-stop
  notice (L178-181). It is registered in `docs/mockups/canvas.json` L48-53.
  GUIDE.md L25, L38 and L40 cover the editor line classes and notices.
- **e2e helpers:**
  - `e2e/web/lib/journeys.js`: `startApp` L26.
  - `e2e/web/lib/journeys-edit.js`: `replaceSong(page, text)` L20, which
    selects all, deletes and calls `insertText`.
  - New songs open with the inline "Write a song" pattern that
    `unknown-tokens.spec.js` and `format-help.spec.js` use.

## Constraints / requirements

1. **The words come from the diagnostic's `code`, never its `message`.** The
   reader's `message` is English and belongs to the implementation. The app
   maps `code` to `editor.diagnostic.<code>` in all four locales. A code it
   does not know falls back to `editor.diagnostic.other` ("the format cannot
   read this line as written"), so a new code in cifra.md never shows an
   empty note.
2. **One source of truth for which lines are marked.** A note is drawn for
   exactly the lines `classifyLines` classes `err`, from the same
   `parse().diagnostics`. A `mk` line (conflict marker) gets no note: its
   words are the conflict notice's and workflow 11's. When several
   diagnostics share a line, the first one names it.
3. **The note is words only, inside the text's flow.**
   - It is a CodeMirror block widget placed after the reported line, with
     class `est-line-note`.
   - Its text is `editor.source.lineNote` = "Line {line}: {words}".
   - It carries `aria-hidden="true"`, so the textbox's content is not doubled
     for a screen reader.
   - It holds no control. A button inside the `contenteditable` textbox
     would fail axe `nested-interactive` and would break the editor's single
     tab stop.
   - The note is shown as soon as the line is reported, with no wait for the
     cursor to leave. The red already shows at once, and red with no words
     on the line being typed is the defect.
   - Colour comes from tokens only (`--conflict`, `--ink-2`; never
     hard-coded). The words carry the meaning.
4. **The notes live in the shared extension set.** `sourceExtensions` gains
   `lineNote: (diagnostic) => string`, so every host that colours a line red
   also says why: the song editor, the raw editor, and the conflict
   resolver's *edit* view (`MarkedTextEditor`). The notes are recomputed on
   every doc change, like `unknownMarksField`.
5. **The screen reader hears the words when the cursor reaches the line.**
   - `SongEditor` keeps a visually hidden `role="status"`
     (`aria-live="polite"`) region outside the CodeMirror view.
   - When the cursor moves onto a different line that is reported, the
     region is set to that line's note. When the cursor moves to an
     unreported line, it is cleared.
   - Typing on the same line does not re-announce. Only a change of line, or
     the line's first diagnostic code changing, sets the region.
6. **Put it in the music** is a RAC `Button` on the existing `unfenced`
   notice, beside **Show me how**, with key `editor.source.putInMusic`.
   - The notice's timing is unchanged (workflow 3: the line counts once the
     cursor has left it, or at once if pasted). Only its contents grow.
   - The transform is a pure `fenceAround(text, line)` in `fence-paste.js`.
     - It takes the paragraph containing `line`: the contiguous run of lines
       up to (not including) a blank line, a `#` heading, a `- key:` list
       item, a thematic break, or a fence delimiter.
     - It returns `{ from, to, insert }` that puts "```" lines around that
       run.
   - The editor dispatches the transform as one transaction with
     `isolateHistory.of('full')` and `userEvent: 'input'`, so one undo
     reverses exactly it. The cursor stays on the same text, now inside the
     fence, and focus returns to the editor.
   - The `unfenced` notice then gives way to a wrap notice:
     `editor.source.lineFenced` = "Line {line} is now inside the music, so it
     reads as chords." It has **Undo** (`editor.source.undo`), in the same
     `notice accent … role="status"` shape as the paste notice.
   - The wrap notice and the paste notice share one state:
     `pasteNotice` becomes `wrapNotice = { kind: 'paste', titled } | { kind:
     'line', line } | null`. It shares one Undo handler and is cleared by
     the next edit, as today (L236-239).
7. **Canonical form is unaffected.** The wrap only adds fence lines the
   writer asked for. Nothing here preserves non-canonical spelling, and the
   save path is unchanged. Nothing here stops a save: the save blockers
   (`save-blockers.js`) are untouched.
8. **Accessibility.**
   - RAC for every control.
   - Keyboard path: from the editor, Tab reaches the notice's buttons.
   - axe clean at WCAG 2.1 AA on the editor with a note shown, with the
     notice and its offer, and with the wrap notice.
9. **Tests use songs written for the purpose.** For example, a song titled
   *Rascunho* with the bar line `| Am7 | D7 | Gm7 | C7 |`, which is
   chords only.

## Acceptance criteria

**Behavior delivered** (workflow 4 §Editing L33-54; workflow 3 §When it looks
like another format):

1. Every line the editor marks `err` has, directly below it, a note "Line N:
   …" in the user's language. It appears and disappears with the diagnostic.
2. A screen reader hears that note once, when the cursor reaches the line.
3. When the reported line is chords outside the music, the notice offers
   **Put it in the music**. That fences the line's paragraph, and the chart
   then reads it as bars in the preview.
4. A wrap notice with **Undo** follows, and Undo (or one Mod-z) restores the
   text exactly.
5. The English words for the codes a teacher meets are these. Each code below
   gets the same meaning in the other three locales:
   - `unfenced-music`: "this reads as chords, but it is outside the music, so
     it is kept as a note."
   - `bad-voicing`: "a voicing that can't be read."
   - `unclosed-fence`: "the music opened here is never closed with a line of
     three backticks."
   - `notes-outside-block`, `item-outside-block`: "after the rule, only
     voicing blocks are kept."
   - `repeat-without-previous`: "a repeat with no bar before it to repeat."
   - `bad-notation`: "a notation the app does not know; the song is read as
     Brazilian."
   - Every other code: a short plain sentence of the same kind, chosen by the
     implementer. `other` is the fallback.

**Board** (the design half). `docs/mockups/W04-edit-and-save.dc.html` draws
the decision:

- **Computer frame:** the `- Em: 02200` error line is followed by its line
  note, "Line 23: a voicing that can't be read."
- **New phone frame,** labelled "the template overwritten: a bar line outside
  the music says why, and offers to put it in". It shows:
  - the bar line `| Am7 | D7 | Gm7 | C7 |` in `err`;
  - its note under it;
  - the `.notice accent` with **Put it in the music**, **Show me how** and
    dismiss.

GUIDE.md's editor line classes gain `.err-note`, drawn with tokens. Its
`canvas.json` entry is resized for the extra frame.

**Tests, by level:**

- **unit**
  - `app/src/editor/diagnostic-words.test.js` (new) pins Constraint 1:
    - "every locale words every diagnostic code": each code in
      `DIAGNOSTIC_CODES` (the frozen list above, exported by
      `diagnostic-words.js`) has `editor.diagnostic.<code>` in en, pt-BR,
      es-419 and it, plus `other`;
    - "an unknown code falls back to other";
    - "the note names the first diagnostic on a line": two diagnostics on one
      line, with a `marker-line` yielding no note.
  - `app/src/editor/fence-paste.test.js` gains `describe('fenceAround')`
    (Constraint 6):
    - "fences a lone bar line";
    - "fences the paragraph, stopping at a blank line, a heading and a
      property";
    - "the result parses with no unfenced-music and the line reads as bars":
      `parse()` of the output has a part with measures.
- **behavior**: `app/src/editor/SongEditor.behavior.test.jsx` gains
  `describe('— a marked line says why')`. It uses the jsdom
  `getClientRects` stub the file already uses.
  - "a reported line carries its note in words": a fenceless song with a bar
    line has an `.est-line-note` reading "Line 3: this reads as chords, …"
    directly after that `.cm-line`, `aria-hidden`. The note goes when the line
    is fenced by hand. (Workflow 4 §Editing; spec §1.9.)
  - "the note reaches assistive technology when the cursor arrives":
    - moving the cursor onto the line sets the hidden status region to the
      note;
    - typing on the line does not change it;
    - moving away clears it.
  - "a bad voicing's note is in pt-BR" (Constraint 1, locale).
  - "Put it in the music fences the paragraph and Undo reverts it":
    - with the cursor moved off the line, the notice shows the button;
    - pressing it fences the paragraph, the line is no longer `est-err`, and
      the wrap notice reads "Line 3 is now inside the music…";
    - **Undo** restores the original text byte for byte;
    - a second run, reverted with `undo(view)` (one Mod-z), gives the same
      text.
    (Workflow 4 §Editing; workflow 3 §When it looks like another format.)
  - "a marker line has no note" (Constraint 2).
  - axe clean in each of these states: note shown, notice with offer, wrap
    notice.
- **e2e-web**: `e2e/web/tests/editor-errors.spec.js` (new), test 'the
  template overwritten with a bare bar line says why and puts it in the
  music', on phone, tablet and computer.
  1. `startApp`, then "Write a song".
  2. `replaceSong` with "# Rascunho\n\n| Am7 | D7 | Gm7 | C7 |".
  3. Assert the `.est-line-note` reads "Line 3: …outside the music…".
  4. Move the cursor to line 1 (Control+Home). The notice shows **Put it in
     the music**.
  5. axe.
  6. Press the button. The line is no longer marked, the preview draws bars,
     and the wrap notice is shown.
  7. axe.
  8. Press **Undo**. The note is back.

  This pins workflow 4 §Editing and workflow 3 §When it looks like another
  format, mockup W04. It needs only the local app; every helper exists.

## Decisions

1. **A block widget under the line, not a lint tooltip or gutter marker.**
   - `@codemirror/lint` would be a new dependency. Its words appear on hover
     or on a gutter icon, neither of which is "where the person is looking"
     on a phone with no hover.
   - A `title` attribute (the unknown-word pattern) is invisible to touch and
     to most screen readers.
   - A block widget is always visible, right below the line, at every width.
     It costs one StateField in the shared set.
2. **The screen reader path is a live region outside the textbox, not the
   widget.** Text inside a `contenteditable` textbox is read as if it were
   the song, or not at all, depending on the reader. Hiding the widget and
   announcing on arrival gives one clean announcement. Rejected: an
   `aria-describedby` on the content element, because it describes the whole
   textbox, not a line, and would have to change on every cursor move.
3. **The offer lives on the notice, not on the line.** A control inside the
   textbox fails axe `nested-interactive` and breaks the editor's one tab
   stop. Rendering RAC through portals into widgets would be a new seam for
   one button. The notice is already the place the workflow gives this case,
   and its RAC buttons are one Tab away.
4. **The notice's timing stays; the note's does not.** The notice waits for
   the cursor to leave the line, so it does not flash during `[A`
   (workflow 3, decided). That timing is kept. The note shows at once,
   because the red already does, and the defect is red with no words on the
   line being typed.
5. **Offer only where the reader reports.** §1.9 checks only a chart with no
   fence. In a fenced chart, a chord-looking line between parts is a
   legitimate note. Offering there would need an app-side grammar that
   disagrees with the reader, which `cifra-syntax.js` L1-7 rules out.
   Because the reader names only the first such line, one press fences that
   paragraph. The chart is then fenced, and the rest reads as notes, as the
   format says. Rejected: fencing every chord-looking paragraph at once.
   That would rewrite text the writer may mean as notes.
6. **Wrap the paragraph, not just the line.** Chords over words are two
   lines, and fencing only the chord line would split them. The paragraph is
   the unit a paste is wrapped in too.
7. **Words by code in the app, not the reader's English message.** The
   `message` is not localised and is not part of the conformance contract.
   The `code` is pinned by the corpus. Rejected: adding localised messages
   to cifra.md, which would be a format change for an app concern.
8. **The notes go in every host of `sourceExtensions`.** The conflict
   resolver's edit view and the raw editor colour lines red too. Giving them
   the words costs nothing extra and keeps the rule everywhere. `mk` lines
   are excluded: the conflict notice and workflow 11 carry their words.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-21.

- `app/src/editor/diagnostic-words.js` (new, with `diagnostic-words.test.js`): maps a diagnostic `code` to `editor.diagnostic.<code>`, falling back to `editor.diagnostic.other`; notes fall on exactly the lines `classifyLines` marks `err`.
- `app/src/editor/source-extensions.js`, `cifra-syntax.js`, `editor.css`, `SongEditor.jsx`, `MarkedTextEditor.jsx`: a "Line N: …" note under every red line (song editor, raw editor, conflict edit view) and a live region that speaks it once when the cursor reaches the line.
- `app/src/editor/fence-paste.js` (`fenceAround`, tested in `fence-paste.test.js`) and `SongEditor.jsx`: **Put it in the music** on the unfenced-chords notice fences the paragraph in one undoable step; a wrap notice with **Undo** follows.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: the `editor.diagnostic.*` keys in all four languages; `app/src/theme/theme.css` for the note style.
- Tests: behavior in `app/src/editor/SongEditor.behavior.test.jsx` (`a marked line says why`, axe in each state; two existing assertions now exclude the new live region); e2e-web in `e2e/web/tests/editor-errors.spec.js` on phone, tablet and computer.
- Design: `docs/mockups/W04-edit-and-save.dc.html` (new phone frame 5), `canvas.json`, `GUIDE.md`, `theme.css`, `e2e/web/lib/mockup-frames.json` (frame added by hand); `docs/workflows/03-write-a-new-song.md` and `04-edit-and-save.md` carry the decided delta.
- Not covered: the notices sit above the editor, so Tab from the text reaches the editor's other controls first; the notice buttons need Shift+Tab.

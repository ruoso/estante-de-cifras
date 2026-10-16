# sync.conflicts_editing — Editing a conflict in the source editor, with people's names

## TaskJuggler entry

[`tasks/45-sync.tji`](../../45-sync.tji), lines 90-95:

> Workflow 9 (Settling one, Edit): Edit opens the marked text in a plain
> textarea, not the workflow-3 source editor with line numbers and marker
> highlighting; the markers read ours/theirs where the board says
> yours/Ana's; the bar conflict's title says A bar you both changed where the
> board names it (Primeira parte, bar 5). Source: UI pairwise audit
> 2026-10-14 (e2e mockup() screenshots vs rendered boards, audit/out). Tests:
> behavior (Edit mounts the source editor on the marked text; the bar named;
> axe); e2e-web (a conflict edited and saved, mockup W09#3).

`depends !conflicts`. `sync.conflicts` is `complete 100`.
Milestone: M5 (`tasks/99-milestones.tji:44`).

## Effort estimate

1d (from the `.tji`). The Worker does not change. The work is three things:

- one extraction from `SongEditor.jsx`, so the conflict screen can mount the
  same CodeMirror setup;
- one pure relabelling function;
- one pure function that names the place of a chart conflict.

There is also copy in four locales and the tests.

## Repository

Not cifra.md. The work lands in `app/` and `e2e/web/`:

- `app/src/editor/source-extensions.js` (new). This is the CodeMirror
  extension set the song editor builds today: line numbers, the active
  line, history, keymaps, the cifra syntax field, the aria label and
  tabindex. `app/src/editor/SongEditor.jsx` is rewired to use it, with no
  change in behavior.
- `app/src/editor/MarkedTextEditor.jsx` (new). The source editor over a
  marked text that lives in memory, not in the working copy.
- `app/src/songs/conflict-text.js` (new, pure). It has two functions:
  - `labelMarkers(marked, { yours, theirs })`;
  - `conflictPlace(model, item)`.
- `app/src/songs/SongConflict.jsx`, `app/src/songs/song-conflict.css`. The
  edit view mounts the editor, gets *Go to line N*, and the title names the
  place.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`. The copy.
- Tests:
  - `app/src/songs/conflict-text.test.js` (new);
  - `app/src/songs/SongConflict.behavior.test.jsx`;
  - `app/src/editor/SongEditor.behavior.test.jsx`, which must stay green
    and is not edited;
  - `e2e/web/tests/conflicts.spec.js`.

**Design delta:** `docs/workflows/09-conflicts.md` §Settling one, the *edit*
bullet. It now says three things:

- the marker lines name the sides as the screen does
  (`<<<<<<< yours`, `>>>>>>> Ana's`);
- the editor numbers its lines and colours the marker lines;
- the refusal's *Go to line N* puts the cursor on the marker line.

Before this, the workflow gave the markers bare. The W09 board (frame 3)
already drew all three, so the delta writes down what the board decided. It
rides in this task's commit.

## Inherited dependencies

- **sync.conflicts** (settled, Done 2026-10-13,
  `tasks/refinements/sync/conflicts.md`). It delivered:
  - the conflict model;
  - the per-song resolver `SongConflict`;
  - the Worker's `RESOLVE_CONFLICT` with `choice: 'edit'`, which runs
    `canonicaliseFile` and refuses a marked text with `SAVE_REFUSED
    { reason: 'marked', line }` (`app/src/worker/conflicts.js:543-556`);
  - the e2e spec.

  Its AC3 (conflicts.md:326-327) and its Decision at :406-412 put *edit* "in
  the editor … in CodeMirror". What shipped is a React Aria `TextArea`
  (`SongConflict.jsx:256-262`). No decision records that choice and no
  deferral registers it, so this task completes that AC rather than
  superseding a decision. Two things are kept as they are:
  - the Worker contract (the user's text goes out on `RESOLVE_CONFLICT`, and
    the refusal comes back on `SAVE_REFUSED`);
  - the *Reading the markers* legend.
- **sync.keep_both** (settled, Done 2026-10-13). It is not touched. The
  keep-both choice stays on voicing steps only.
- **sync.conflicts_polish** is a sibling, not a dependency, and is still open.
  It owns three things this task does not touch:
  - the two chord diagrams beside each choice;
  - the IN CONFLICT row indent;
  - the computer layout without the shell sidebar.

  Both tasks edit `SongConflict.jsx`, in different regions: this task edits
  the edit view and the heading, and conflicts_polish edits the side cards.

## What this task is

The resolver's *Edit* (workflow 9 §Settling one) is brought into line with
the W09 board, frame 3:

1. **The source editor, not a textarea.** *Edit* mounts the CodeMirror
   source editor of workflow 3 (DIRECTION §3.7, "the source editor is
   CodeMirror 6 … conflict markers"). It shows:
   - line numbers;
   - the cifra syntax colouring;
   - marker lines coloured `mk`, which `cifra-syntax.js` already classifies
     (`isMarkerLine`, L127);
   - the active line highlighted.

   Its content is the song's marked text, held in memory. Nothing is
   written to the working copy until the Worker accepts the save, the same
   as today.
2. **People's names on the markers.** The marked text the format writes
   (`<<<<<<< ours`, `>>>>>>> theirs`; cifra.md §11.12.2) is shown with the
   labels renamed: `<<<<<<< yours` and `>>>>>>> Ana’s`. The incoming
   author's name comes from `song.author`, as on the *Ana’s* side card. With
   no author, the label is `theirs`.
3. **Go to line N.** When a save is refused, the notice reads as today and
   gains a *Go to line {line}* button. The button moves the cursor to that
   line, scrolls it into view and focuses the editor (W09#3 L158).
4. **The bar named.** A chart conflict is titled by where it is: *Primeira
   parte, bar 5* (W09#1 L42, W09#2 L134). The old title, *A bar you both
   changed*, is kept only as the fallback.

## Why it needs to be done

Workflow 9 makes *edit* the path that covers every case the other choices do
not. DIRECTION §3.7 names CodeMirror as the surface where conflict markers
are edited. The UI pairwise audit of 2026-10-14 (e2e `mockup()` screenshots
against the rendered boards) found three differences on W09#1 and #3:

- a plain textarea where the board has numbered, coloured lines;
- `ours`/`theirs` on the markers where the board has *yours*/*Ana's*;
- a generic title where the board names the bar.

A user who has to find line 10 in an unnumbered textarea is left with
"points at it" as an empty promise. The task closes a gap in M5.

## Inputs / context

**Workflow and direction**

- `docs/workflows/09-conflicts.md` §Settling one (L47 on). The *edit* bullet
  is amended by this task's delta. L15 gives the "bar 5" example.
- `docs/DIRECTION.md` §2.2, L94-97: the edit option writes git's markers,
  and a marked text is never canonical, so it is never saved or pushed.
- `docs/DIRECTION.md` §3.7, L468-470: the source editor is CodeMirror 6,
  with conflict markers.
- `docs/DIRECTION.md` §4, L513: musical-terms naming in the style *Verse
  bar 5: G7 → D♭7*.
- `docs/screen-reader.md` L301-305: raw markers live only in the monospace
  source editor and are read verbatim.
- cifra.md `spec/11-merge.md`:
  - §11.12.2 (L978-1013): the marked text, labelled `ours`/`theirs`;
  - §11.12.3 (L1037-1047): a marker line is `<<<<<<<`, `=======`,
    `>>>>>>>` or `|||||||`, alone or followed by a space and anything. A
    writer refuses to save one and points at the first.

**The board.** `docs/mockups/W09-conflicts.dc.html`. Frames are numbered by
`e2e/web/lib/mockup-frames.json:249-271`.

- Frame 1 (phone), L42-43:
  - the title is *Primeira parte, bar 5*;
  - the subline is *You and Ana both changed this bar.*
- Frame 2 (phone), L134: *Settled so far* lists *Primeira parte, bar 5*.
- Frame 3 (tablet), "Edit chosen":
  - notice, L158-159: *Not saved. Line 10 is still a conflict marker. …*
    with *Go to line 10*;
  - editor, L162-163 and L284-308: a 36px line-number column in `--ink-2`.
    The marker lines `<<<<<<< yours`, `=======` and `>>>>>>> Ana's` carry
    class `mk`; the pointed-at line also carries `cur`;
  - legend card, L167-173.
- `docs/mockups/theme.css:250-256`:
  - `.editor .mk` uses `--unsaved-soft` / `--unsaved`;
  - `.editor .cur` uses `--accent-soft`.
- Not in scope: the *Preview* button in the frame-3 app bar (Decision 5).

**Code**

- `app/src/songs/SongConflict.jsx`:
  - `describe(item, author)` (L130-163). The chart and sections kinds always
    return `chartTitleFallback` (L153-157).
  - The edit view (L245-279): `TextField`/`TextArea` (L256-262), the legend
    (L263-271), Save and Cancel (L271-272).
  - `openEdit`/`saveEdit` (L225-233). `saveEdit` sends `RESOLVE_CONFLICT
    { choice: 'edit', text }`.
  - The `SAVE_REFUSED` listener (L188-192).
  - `previewModel = snippetModel(resolveMarked(song.marked, 'ours'))` (L196)
    and `markedAddresses` (L79-94), which match ours's lines to chart rows.
- `app/src/editor/SongEditor.jsx`:
  - `buildDecorations` (L88-99);
  - the extension list (L249-277), which this task extracts;
  - load and persist through `OPEN_SOURCE`/`WRITE`. That is why the conflict
    view cannot mount `SongEditor` itself.
- `app/src/editor/cifra-syntax.js`: `classifyLines`, with `isMarkerLine` →
  `mk` at L127.
- `app/src/editor/editor.css` (~L162): `.est .cm-line.est-mk`.
- `app/src/chart/layout.js`:
  - `chartRows(model)` (L203-217) gives section rows `{ type: 'section',
    name }`;
  - bars rows carry `measures` and `numbers[i].number` (L157-166), which is
    the reader's running bar number from `numberBars`
    (`cifra.md/js/src/parse.js:874`, cifra.md §2.8).
- `app/src/worker/conflicts.js`:
  - `incomingAuthor` (L184-193) is the source of `song.author`;
  - `resolveRegionByOrdinal` (L48-75) runs on the Worker's own
    `song.marked`, never on the user's edited text, so it is unaffected.
- `cifra.md/js/src/text.js:17-19`: marker-line detection by prefix. This is
  why a relabelled marker is still refused.
- Copy:
  - `app/src/i18n/locales/en.js:1132-1135` (`chartTitle: '{section}'`,
    unused; `chartTitleFallback`);
  - L1181-1191 (`editTitle`, `editHelp`, `editTextLabel`, `editRefused`, the
    marker legend);
  - the same keys in `pt-BR.js` L1012-1055, `es-419.js` L1013-1056 and
    `it.js` L1012-1055.

**Tests already standing**

- `app/src/songs/SongConflict.behavior.test.jsx`:
  - the `MARKED` fixture (L32-41) has section *Primeira parte*, and the
    region's ours line `C | G7 | F | F` against theirs `C | G7 | D7 | F`
    differs at the third measure of the second line, which is bar 7;
  - the edit test is at L124.
- `e2e/web/tests/conflicts.spec.js`:
  - the fixtures are at L38-46: section `## Parte`, `C | G | Am | Dm`
    against `C | G | Am | E7`, so bar 4; author `Ana`;
  - `openResolver` is at L131;
  - the edit test is at L204-231. It currently uses `toHaveValue`/`fill` on
    the textarea and calls `mockup(page, 'W09-conflicts', 3)`.
- The `e2e/web/lib/journeys-sync.js` `replaceLine` (L66) edits a CodeMirror
  line through the keyboard. Its idiom is click `.cm-content`, then Home,
  Shift+End, then `insertText`.

## Constraints / requirements

- **The Worker is unchanged.** It still owns the merge session, the
  validation (`canonicaliseFile`) and the commit. The view sends only the
  edited text. The main thread touches no IndexedDB, and the marked text is
  never written to the working copy (DIRECTION §2.2).
- **A marked text is never saved.** Relabelled markers are still marker
  lines (cifra.md §11.12.3), so the Worker's refusal and its line number
  hold unchanged. Relabelling is line for line, so the line numbers match.
- **Relabel only the format's own marker lines.** Only a whole line equal to
  `<<<<<<< ours` or `>>>>>>> theirs` is changed. `=======` and every other
  line stay byte for byte. In the author's name, any run of whitespace,
  newlines included, becomes one space, so a label can never split a line.
- **No song text in logs.** The new modules log nothing.
- **Accessibility:**
  - The editor's contenteditable keeps the accessible name *The song’s text,
    with the conflict markers* (`editTextLabel`) and is in the tab order
    (`tabindex 0`, as in `SongEditor`).
  - Tab is not trapped: the editor uses no `indentWithTab`.
  - *Go to line N* is a React Aria `Button`.
  - The refusal stays `role="alert"`.
  - Marker lines are carried by their text, not only by their colour.
  - axe is clean at WCAG 2.1 AA.
- **Four locales.** Every new key is added to `en`, `pt-BR`, `es-419` and
  `it`.
- **`SongEditor` behaves exactly as before.** The extraction changes no
  extension, order or attribute. Its behavior suite is the regression check.
- **Fixtures** are songs written for the purpose, as the existing ones are.

## Acceptance criteria

### Behavior delivered

1. **`source-extensions.js`** exports
   `sourceExtensions({ label, onDocChange })`. It returns, in today's order:
   - `lineNumbers()`, `highlightActiveLine()`, `history()`;
   - the default and history keymaps;
   - the syntax `StateField` over `buildDecorations`, which moves here from
     `SongEditor.jsx`;
   - `contentAttributes` `{ 'aria-label': label, tabindex: '0' }`;
   - an update listener that calls `onDocChange(update)` when the document
     changes.

   `SongEditor` builds its view from it, plus its own paste handler and its
   own `ExternalLoad` and `WRITE` logic in `onDocChange`.
2. **`MarkedTextEditor`** has the props
   `{ initialText, label, onChange, viewRef }`. It creates one `EditorView`
   on mount from `sourceExtensions` and calls `onChange(text)` on each edit.
   The host reaches the view through `viewRef`, which *Go to line* needs.
   It has no WRITE, no OPEN_SOURCE and no store.
3. **`labelMarkers(marked, { yours, theirs })`**, pure:
   - `<<<<<<< ours` becomes `<<<<<<< {yours}`;
   - `>>>>>>> theirs` becomes `>>>>>>> {theirs}`;
   - all other lines are untouched;
   - the line count is unchanged.
4. **`conflictPlace(model, item)`**, pure, over the ours model (the
   `previewModel` already built) and a conflict item. It returns
   `{ section, bars }` or `null`:
   - For `chart`:
     - find the consecutive bars rows of the model whose `rowText` equals
       `item.ours` lines, in `chartRows` order;
     - `section` is the name of the nearest section row before them;
     - `bars` holds the running bar numbers (`numbers[i].number`) of the
       measures in those rows that differ from theirs, compared position
       by position against `item.theirs` line i split on ` | `. A measure
       beyond the end of theirs's line or lines counts as differing.
   - For `sections`, or a chart region with no numbered differing measure
     (a run row, a sung song, a region that only adds lines on theirs):
     `{ section, bars: [] }`.
   - An unnamed section, or a region not found in the model: `null`.
5. **The title.** `describe` takes the place for `chart` and `sections`:
   - with no bars: `songConflict.chartTitle` → *{section}*;
   - one bar: new `chartTitleBar` → *{section}, bar {bar}*;
   - two bars: new `chartTitleBars` → *{section}, bars {first} and
     {second}*;
   - three or more: new `chartTitleBarRange` → *{section}, bars
     {first}–{last}*;
   - `null` place: `chartTitleFallback`, as today.

   The subline is unchanged. Any list of settled conflicts built from
   `describe` follows the new title.

   pt-BR uses *compasso / compassos*, es-419 *compás / compases*, it
   *battuta / battute*.
6. **The edit view:**
   - The heading is unchanged.
   - When a save is refused, the `role="alert"` notice shows `editRefused`
     followed by a `Button` with new key `editGoToLine` → *Go to line
     {line}*. Pressing it dispatches a selection at the start of that line
     with `scrollIntoView`, then focuses the view.
   - `MarkedTextEditor` takes the textarea's place.
   - The legend stays, and so do Save and Cancel.
   - The editor's initial text is `labelMarkers(song.marked, { yours:
     t('songConflict.markerYours'), theirs: author ? t('songConflict.markerTheirs',
     { author }) : t('songConflict.markerTheirsFallback') })`. The new keys
     are, in en: `yours`, `{author}’s` and `theirs`. Each locale words them
     as its side-card labels do.
   - Save sends the editor's current text, exactly as `saveEdit` does today.
   - `editing` keeps the text across a refusal. The editor is not remounted,
     so its undo history is kept.
   - `song-conflict.css` drops the `.est-conflict-editor` textarea rule. It
     gives the CodeMirror host a bounded height that scrolls. The colours
     come from `editor.css` (`est-mk`, the active line); no new colour is
     added.

### Tests, by level

**unit**

`app/src/songs/conflict-text.test.js` (new):

- *"labelMarkers renames only the format's own marker lines (sync.conflicts_editing;
  workflow 9 §Settling one; cifra.md §11.12.2-3)"*:
  - the two labelled lines are renamed;
  - `=======`, a line `<<<<<<< ours extra` and the body lines are untouched;
  - the line count is equal;
  - a name holding a newline becomes one line;
  - every output marker line still satisfies `isMarkerLine`.
- *"conflictPlace names the section and the differing bar (W09#1 L42)"*.
  The fixture is a two-line section *Primeira parte*, `F | F | C7 | C7`
  then `Db7 | C7 | F | F` (ours) against `G7 | C7 | F | F` (theirs), so
  `{ section: 'Primeira parte', bars: [5] }`. Also:
  - two differing measures give two bars;
  - an anchored section (`numberBars` anchor) uses the stated numbers;
  - a theirs line shorter than ours counts the extra measures.
- *"conflictPlace falls back"*:
  - a `sections` item gives `{ section, bars: [] }`;
  - a run row gives `bars: []`;
  - an unnamed section gives `null`;
  - a region missing from the model gives `null`.

**behavior**

`app/src/songs/SongConflict.behavior.test.jsx`. Remember to stub
`Range.getClientRects` for CodeMirror under jsdom, as
`SongEditor.behavior.test.jsx` does.

- *"titles a chart conflict by its section and bar (sync.conflicts_editing;
  W09#1 L42)"*:
  - with `MARKED`, the step-1 heading is *Primeira parte, bar 7*;
  - no *A bar you both changed*;
  - axe clean.
- *"falls back to A bar you both changed when the region has no named
  section"*: a `MARKED` variant with no `##` heading.
- The edit test (L124) is rewritten as *"Edit mounts the source editor on
  the marked text, markers named for the people, and a refused save goes to
  the line (sync.conflicts_editing; W09#3 L158-163, L284-308; workflow 9
  §Settling one)"*:
  - after *Edit*, a `textbox` named *The song’s text, with the conflict
    markers* is a `.cm-content` inside a `.cm-editor`;
  - `.cm-lineNumbers` is present;
  - its text holds `<<<<<<< yours` and `>>>>>>> Ana’s`, and not
    `<<<<<<< ours` or `>>>>>>> theirs`;
  - those lines carry `est-mk`;
  - axe clean;
  - Save sends `RESOLVE_CONFLICT { choice: 'edit' }`, and its `text` equals
    `labelMarkers(MARKED, …)`;
  - `SAVE_REFUSED { line: 4 }` shows the alert *Line 4 is still a conflict
    marker* and a *Go to line 4* button;
  - pressing it puts the editor's selection head on line 4, and the
    editor's content has focus;
  - axe clean again.
- *"with no author, the theirs marker reads theirs"*: `author: null`, so the
  text holds `>>>>>>> theirs`.

`app/src/editor/SongEditor.behavior.test.jsx` is not edited. It must stay
green over the extraction.

**e2e-web** (phone, tablet and computer projects; axe on every state touched)

`e2e/web/tests/conflicts.spec.js`:

- `openResolver` additionally asserts the heading *Parte, bar 4*. This pins
  W09#1 L42 on every conflict test that opens the resolver.
- The edit test (L204), rewritten:
  - after *Edit*, the `textbox` named `/text, with the conflict markers/i`
    is visible, with the line numbers (`.cm-lineNumbers`) visible;
  - the editor contains `<<<<<<< yours` and `>>>>>>> Ana’s`;
  - `mockup(page, 'W09-conflicts', 3)`, then axe;
  - *Save*, then *is still a conflict marker* and *Go to line N* are
    visible. Press *Go to line N*, then axe;
  - the edit goes through the real UI. Read the lines from `.cm-line`, drop
    the marker lines and `BAR_ANA`, then click into the editor, press
    ControlOrMeta+A and `keyboard.insertText` the result;
  - *Save*, then `expectSettledWithBar(page, BAR_OWNER)`.

  This pins workflow 9 §Settling one (as amended), W09#3 and cifra.md
  §11.12.3. It uses no `#dev` mount, injected state or synthetic events.

No test level the note names is dropped. A unit level is added for the two
pure functions. Nothing is deferred and there is no new WBS leaf. Tech debt:
none.

## Decisions

1. **The CodeMirror extension set is extracted and shared. `SongEditor` is
   not mounted.**
   - `SongEditor` is bound to the working copy (`OPEN_SOURCE`, a debounced
     `WRITE`, `SAVE`, merge notices). A marked text must never reach the
     working copy (DIRECTION §2.2).
   - *Rejected:* a "detached" mode on `SongEditor`. It would add a flag
     through a component that already has eleven props, with three branches
     to gate.
   - *Rejected:* a separate copy of the CodeMirror setup in the conflict
     view. The two editors would drift on line numbers, colouring and
     accessibility, which is the drift this task exists to fix.
2. **Markers are relabelled in the view, at display time. The format and the
   Worker are unchanged.**
   - cifra.md §11.12.2 fixes `ours`/`theirs` for the marked text the merge
     writes and the corpus holds. §11.12.3 makes any label a marker line.
   - The relabelled text exists only in the editor buffer. It is never saved
     (a marker line is refused), and the Worker's own `resolveMarked` and
     `resolveRegionByOrdinal` keep running on its unrelabelled
     `song.marked`.
   - So this is not a format change, and no spec chapter, corpus entry or
     reference change is needed.
   - *Rejected:* a label option on cifra.md `merge`. That would be a format
     change across three implementations and the corpus, for a display
     concern, and the spec's open question at L2449-2452 keeps the labels
     fixed.
   - *Rejected:* relabelling in the Worker's `CONFLICTS` payload. Keep mine
     and take theirs read `song.marked` through `resolveMarked`, which
     matches the exact `ours`/`theirs` lines.
3. **The bar is named from the ours model, with the reader's running bar
   numbers.**
   - The number the title shows is the one the reading view and the screen
     reader use (cifra.md §2.8; `layout.js` `numbers`). Anchors are
     honoured, and the same bar is never called two different numbers.
   - The model is the `previewModel` the screen already parses, and the
     matching follows `markedAddresses`.
   - *Rejected:* bar numbers counted per section. The board's *bar 5* is
     ambiguous between the two counts, and the song's own numbering is the
     one the rest of the app speaks.
   - *Rejected:* putting the place on the Worker's conflict model. That
     model "parses nothing" by design (`conflict-model.js` header).
4. **Go to line is in scope.** The workflow promises that *Save* "points at
   it", and the board draws *Go to line 10*. In CodeMirror this is one
   dispatch, and it is what turns the line number into something a user can
   act on.
5. **The frame-3 *Preview* button is out of scope.** The note names three
   differences (the editor, the labels, the title), and the audit raised
   only those. The resolver already shows the musical sides. A preview of a
   marked text has no canonical parse to render (DIRECTION §2.2), so it
   would need a design call of its own about what to draw.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-16.

- The conflict screen's Edit opens the song editor's code editor (numbered lines, coloured marker lines) over the marked text: app/src/editor/MarkedTextEditor.jsx, with the setup shared from the new app/src/editor/source-extensions.js; app/src/editor/SongEditor.jsx now builds from the same setup.
- Marker lines are named for the people (`<<<<<<< yours`, `>>>>>>> Ana’s`, or `theirs` with no author), and a refused save offers Go to line N: app/src/songs/conflict-text.js, app/src/songs/SongConflict.jsx, app/src/songs/song-conflict.css.
- A chart conflict is titled by where it is (e.g. Primeira parte, bar 7), falling back to A bar you both changed.
- Copy in four locales: app/src/i18n/locales/{en,pt-BR,es-419,it}.js; workflow 9 delta in docs/workflows/09-conflicts.md.
- Tests: unit app/src/songs/conflict-text.test.js; behavior app/src/songs/SongConflict.behavior.test.jsx (with axe); e2e-web e2e/web/tests/conflicts.spec.js (edit through CodeMirror, mockup W09#3, axe).
- Tech-debt follow-up: none.

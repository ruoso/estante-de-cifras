# songs.editor_chrome — The editor host as drawn

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) — `songs.editor_chrome`, lines 147-151:

> From the W03 and W04 boards: on a phone the editor header truncates the
> title to a letter and carries Discard changes, where the board has the title
> and Save; the header keeps Untitled song after the first heading already
> names the song; the unsaved strip (unsaved changes · Kept on this device) is
> missing; on a computer the editor is one column without the board's unsaved
> list and save panel, and the first-save sheet is a bottom sheet where the
> board centres a dialog; the no-match search state lacks the paste hint
> (workflow 3 Ways in). Source: UI pairwise audit 2026-10-14 (e2e mockup()
> screenshots vs rendered boards, audit/out). Tests: behavior (the title
> follows the heading; the unsaved strip; axe); e2e-web (writing and editing
> on the three viewports, mockup W03#1-4, W04#1-4).

`depends !editor, !new_song, !save_sheet`. Milestone: M5
(`tasks/99-milestones.tji:44`).

## Effort estimate

2d.

## Repository

The app and its e2e harness. Nothing lands under `cifra.md/`:

- `app/src/songs/EditorChrome.jsx` (new) and `app/src/songs/editor-chrome.css`
  (new): the one header, unsaved strip and phone bottom bar both hosts draw.
- `app/src/songs/EditSongHost.jsx`, `app/src/songs/NewSongHost.jsx`: use it;
  the computer's Unsaved pane and save panel (EditSongHost).
- `app/src/songs/UnsavedPane.jsx` (new), `app/src/songs/unsaved-list.js`
  (new, pure): the computer's *Unsaved* list.
- `app/src/editor/SongEditor.jsx`: `onTitleChange`, a host-owned Save
  (`saveRef`, no Save in its own bar), `onWrite`, `showPreview`.
- `app/src/songs/SaveSheet.jsx`, `app/src/songs/save-sheet.css`: a
  `presentation` of `'sheet' | 'dialog' | 'panel'`, and a `revision` that
  refreshes the preview.
- `app/src/songs/SearchScreen.jsx`, `app/src/songs/search.css`: the no-match
  state as W03#1 draws it.
- `app/src/shell/layout-mode.js`: `EDITOR_WIDE_QUERY`.
- `app/src/i18n/locales/{en,es-419,it,pt-BR}.js`: the new copy (below).
- `app/src/editor/EditorDev.jsx`: follows the editor's new props, so
  `#dev/editor` keeps working.
- Tests: the files named under Acceptance criteria, and the journeys in
  `e2e/web/lib/journeys.js` / `journeys-edit.js` that find the save surface.

**Design delta:** `docs/workflows/04-edit-and-save.md` §Editing (the phone's
*unsaved changes · Kept on this device* line; the header names the song by
its title as the text has it now) and §Saving (where the save sits on each
device; the computer's list of unsaved songs). It rides in this task's
commit. See Decision 1.

## Inherited dependencies

Settled:

- **`songs.editor`** (complete): `SongEditor.jsx` — the CodeMirror buffer,
  Add section and Save in `.est-editor-bar` (`SongEditor.jsx:428-435`), the
  save gate (`onSavePress`, L387-398: a blocker shows the *Not saved* stop and
  calls nothing), the Text | Preview toggle on narrow (L413-424), the preview
  beside the text on wide, `parse(text)` in the view (L347),
  `onUnsavedChange` (L318-327) and `flushRef` (L241). Decision 10: the editor
  owns Save's gate, the host owns what Save does. See
  `tasks/refinements/songs/editor.md`.
- **`songs.new_song`** (complete): `NewSongHost.jsx`, `WhichBook.jsx` (*In
  {book}* · *Change book*), the no-match *Create “{query}”* row
  (`SearchScreen.jsx` ~L612-629), `NAME_AND_SAVE`. Decision 6 left the W03#4
  first-save dialog to `songs.save_sheet`, which built it as a sheet. See
  `tasks/refinements/songs/new_song.md`.
- **`songs.save_sheet`** (complete): `SaveSheet.jsx` (`<ModalOverlay
  className="scrim"> <Modal className="sheet est-save-sheet">` on every
  device, L273-302; `SaveForm` L45-…, the note `null` until typed, L86),
  `DiscardConfirm.jsx` (`scrim center` + `Modal className="dialog"`, L64),
  the author-name field, the fork offer (`canSave`/`onMakeYourOwn`). See
  `tasks/refinements/songs/save_sheet.md`.
- Landed, not in `depends`, and to be kept green:
  - **`songs.discard_summary`**: the host flushes through `flushRef` before
    Discard's confirm. Its Decision 3 left Discard in the app bar to this
    task.
  - **`shell.narrow_fit`**: `expectFits` (`e2e/web/lib/fit.js:38`); its
    Decision 5 wraps Add section + Save as a unit on the phone and left
    "Save to a bottom bar with Discard (W14#2)" to this task;
    `e2e/web/tests/narrow-fit.spec.js` states 5-6 (the raw editor from the
    file view and from Edit) stay green. A song's title may ellipsize — a
    user-length string — but only after the buttons fit, never to a letter.
  - **`shell.header_chrome`** Decision 8: deep screens keep their own
    `.appbar` without the wordmark.
  - **`sync.in_place_notices`**: today's `edit-song-unsaved-strip` on the
    phone (`EditSongHost.jsx:87,92`), which this task replaces.
  - **`songs.reading_chrome`, `songs.transpose_chrome`**: the precedent for
    a board-driven chrome task: one 1080px line for the computer, the
    `installWidths` matchMedia stub, `mockup()` per frame then `checkA11y()`.

Pending: none.

## What this task is

Make the two editor hosts — editing a saved song (`EditSongHost`) and
writing a new one (`NewSongHost`) — look and behave as the W03 and W04
boards draw them, on phone, tablet and computer:

- **one header**, from one component both hosts use: on a phone *Back ·
  title · Save*, with the unsaved mark on a strip of its own (*unsaved
  changes · Kept on this device*) and *Add section* and *Discard changes* in a
  bottom bar; on a tablet and a computer *Back · title · unsaved changes ·
  Discard changes · Save*;
- **the title follows the text**: the header names the song by its `#`
  heading as typed, falling back to the host's title only while the text has
  none;
- **the save surface per device**: a bottom sheet on a phone, a centred
  dialog on a tablet and for a new song's first save on a computer, and on a
  computer an inline panel beside the song for a saved song;
- **the computer's Unsaved pane**: every song with unsaved changes across the
  shelf, the one being edited selected, each a step away;
- **the no-match search state** as W03#1 draws it: *No songs match*, what was
  searched, the Create row, and the paste hint.

## Why it needs to be done

The UI pairwise audit (2026-10-14) compared the e2e `mockup()` screenshots
with the boards: the phone header holds Back, title, badge and *Discard
changes*, which squeezes the title to one letter and hides Save in the
editor's own toolbar; a new song keeps *Untitled song* after its heading
names it; the computer draws one column where the board has three; and the
first save is a bottom sheet on a 1280px screen. Workflow 4 promises the
song shows *unsaved changes* in its own header (§Editing), and workflow 3
treats pasting as a way in of its own (§Ways in L15-17) — the no-match state
is where that is said. `songs.discard_summary` (Decision 3) and
`shell.narrow_fit` (Decision 5) both left the host's chrome to this task.
M5 depends on it.

## Inputs / context

- **Workflow 3** `docs/workflows/03-write-a-new-song.md`: §Ways in L8-17
  (from search when nothing matched; pasting a way in of its own); §The song
  before its first save L19-30 (safe from the first keystroke, *unsaved*
  badge; the book above the editor); Discard deletes the file, after asking
  (L52); the first save (L97-102).
- **Workflow 4** `docs/workflows/04-edit-and-save.md`: §Editing L9-21 (the
  song shows *unsaved changes* in its own header; leaving asks nothing);
  §Saving L23-… (the sheet: what changed and a note); §Discarding; §A book
  the user cannot push to. Edited by this task (Decision 1).
- **W03 board** `docs/mockups/W03-write-a-new-song.dc.html` (frames from
  `e2e/web/lib/mockup-frames.json` L97-122: #1-2 phone, #3 tablet, #4
  computer):
  - W03#1 L28-54: search with no match — h2 *No songs match* (L40);
    *Searched titles, artists, sections, words and chords in My songs, Choros
    da Ana and Banda do Bairro.* (L41); the Create row, *A new song in My
    songs* (L44); *Or paste a whole song, copied from anywhere, into a new
    one.* (L46), plain text.
  - W03#2 L56-82: app bar Back · *Garota de Ipanema* · *unsaved*; *In My
    songs* · *Change book*; Text | Preview; bottom bar Add section · Save.
  - W03#3 L89-130 (tablet): app bar Back · title · *unsaved* · Add section ·
    Save; the book strip; the paste notice with Undo; a preview card beside.
  - W03#4 L136-198 (computer): app bar Back · title · *unsaved* · Discard ·
    Save; the book strip; text and preview split; the first save a **centred
    dialog** (`scrim center` › `.dialog`, L176-197): *Save “Coração de
    Estrada”*, Book, File name (read-only, *Named once, from the title…*),
    Note, *Keep editing* · *Save*.
- **W04 board** `docs/mockups/W04-edit-and-save.dc.html` (frames
  `mockup-frames.json` L123-146):
  - W04#1 L28-52 (phone): app bar Back · *Tarde Clara* · **Save**; the strip
    on `--unsaved-soft` (L35-38): badge *unsaved changes* and *Kept on this
    device*; Text | Preview; bottom bar *Add section* · *Discard changes*
    (L47-50).
  - W04#2 L54-95 (phone): the save as a **bottom sheet** with a grip.
  - W04#3 L102-148 (tablet): app bar Back · title · *unsaved changes* ·
    *Discard changes* · Save (L104-110), no strip; preview card beside;
    Discard's centred dialog.
  - W04#4 L154-208 (computer): app bar title · *unsaved changes* · *Discard
    changes* · Save (L156-161, no Back); three columns — a 300px *Unsaved*
    pane (L163-176: rows name, meta *book* or *book · folder/*, badge
    *unsaved*, the current one `.sel`; a *Saving Carinhoso* fork card), the
    editor with the *Not saved* voicing stop (L178-184), and a 360px **inline
    save panel** (L186-207: *Save Tarde Clara*, the name field, *What
    changed*, Note, a full-width Save). No preview while the panel is open.
- **Code today:**
  - `app/src/songs/EditSongHost.jsx:82-91` — app bar Back · `songTitle ||
    path` (static, L74) · badge (not on phone) · *Discard changes*
    (`saveSheet.discard`); the phone strip L92; `SaveSheet` L106-116;
    `DiscardConfirm` L117-125.
  - `app/src/songs/NewSongHost.jsx:70-79` — app bar Back · `songTitle ||
    t('newSong.untitled')` (set once from the query, L74) · *unsaved* ·
    *Discard changes*; `WhichBook` L80; `SaveSheet isNew` L97-106.
  - `app/src/editor/SongEditor.jsx` — `parsed = useMemo(() => parse(text))`
    L347; `onSavePress` L387-398; `.est-editor-bar-actions` L428-435.
  - `app/src/theme/theme.css:288-289` (`.appbar`, `.appbar .title`
    ellipsis), L363-369 (`.scrim`, `.scrim.center`, `.sheet`, `.dialog`).
  - `app/src/songs/SearchScreen.jsx:578-635` — the no-match state: h2
    `search.matching` *Songs matching “{query}”*, the Create row, then
    `search.empty` *No songs match “{query}”.* as a `role="status"` line.
  - `app/src/worker/reducer.js:83-89` — the `browse` slice: `{ books: [{
    bookId, count, songs: [{ path, title, artist, unsaved }] }] }`, filled by
    `BROWSE` (`SearchScreen.jsx:471-475`).
  - `app/src/shell/layout-mode.js:22` `WIDE_QUERY` (600px); the 1080px
    per-screen computer lines L36-63 (`READING_ACTIONS_WIDE_QUERY`, …).
  - `app/src/shell/AppShell.jsx:1178-1206` mounts the hosts;
    `onEdit` (L1293) sets `editingSong`.
- **Tests today:** `app/src/songs/EditSongHost.behavior.test.jsx` (unsaved
  mark per mode L173-179), `NewSong.behavior.test.jsx`,
  `SaveSheet.behavior.test.jsx`, `editor/SongEditor.behavior.test.jsx`,
  `SearchScreen.behavior.test.jsx`; the `installWidths` stub
  (`SongReading.behavior.test.jsx:42`). e2e: `new-song.spec.js` (L78 frames
  W03 1-2), `editor.spec.js` (W03 2-4, W04 4), `edit-and-save.spec.js` (W04
  1-4), `save-sheet.spec.js` (W04 1-3); `mockup(page, board, index, { note
  })` at `e2e/web/lib/mockup.js:45`; journeys `openExampleBook`
  (`journeys.js:55`), `openSongFromSearch` (L227), `openSongInEditor`
  (L261), `typeAtEndOfLine` (L268), `settleEdits` (L279),
  `saveThroughSheet` (L288, clicks the first *Save* then works in
  `getByRole('dialog')`), `replaceSong`/`openSaveSheet`/`confirmSheet`
  (`journeys-edit.js:20,28,37`), `createSongFromSearch`
  (`journeys-core.js:156`).

## Constraints / requirements

1. **One chrome, both hosts.** `EditorChrome` renders the header, the phone
   strip and the phone bottom bar from props (`title`, `unsaved`,
   `onBack`, `onSave`, `onDiscard`, `onAddSection`, `layout`); the hosts
   keep their own state (save open, discard open, reload key). No second
   copy of the header in either host.
2. **Save keeps its gate.** Save moves out of `SongEditor`'s bar into the
   header, but the gate stays the editor's (editor Decision 10):
   `SongEditor` publishes `saveRef.current = onSavePress` (as it publishes
   `flushRef`), and when the host passes `saveRef` the editor draws no Save
   of its own. The header's Save calls `saveRef.current()`; a blocker shows
   the *Not saved* stop and opens nothing. The panel's own Save (computer)
   goes through the same gate before it confirms.
3. **Add section stays the editor's.** On tablet and computer it stays in
   `.est-editor-bar`; on the phone the host's bottom bar calls it through
   `addSectionRef` (published like `flushRef`), so the phone's editor bar
   holds only Text | Preview.
4. **The title follows the text.** `SongEditor` reports `onTitleChange(
   parsed.title)` whenever the parsed title changes (including on mount);
   the host shows that title, else `songTitle`, else `newSong.untitled`
   (new song) or the path (saved song). Discard's confirm and the save
   surface take the same title as their hint. The file is never renamed
   (DIRECTION §4; workflow 3 L37-41) — only the header follows.
5. **The phone fits.** On the 412px phone the app bar holds Back, the title
   and Save, and *Discard changes* is never in it; a drawn title (the
   fixtures' two- and three-word titles) shows whole — `expectFits` with the
   title as a sentence. A long user title may ellipsize, never pushing Save
   out.
6. **The unsaved strip** (phone only): `role="status"`, the badge *unsaved
   changes* (`editor.unsaved`) and *Kept on this device*
   (`editor.keptOnDevice`) in `.t-small`, on `--unsaved-soft`; present while
   unsaved and gone when saved or discarded. A new song is unsaved from the
   start, so it shows the strip from the start, above `WhichBook`. On tablet
   and computer the badge is in the app bar and there is no strip. The
   status is a word, never colour alone.
7. **Save surface per device**, chosen by the host from two queries —
   `WIDE_QUERY` (600px) and the new `EDITOR_WIDE_QUERY` (`(min-width:
   1080px)`, commented like its 1080px siblings):
   - phone: `presentation="sheet"` — today's bottom sheet (W04#2);
   - tablet, and a new song's first save on a computer:
     `presentation="dialog"` — `ModalOverlay className="scrim center"` ›
     `Modal className="dialog"` (W03#4; DiscardConfirm's shape);
   - a saved song on a computer: `presentation="panel"` — no overlay; a
     360px `<section aria-labelledby>` beside the editor, headed *Save
     {title}*, holding the same `SaveForm` (name field when asked, what
     changed, note, Save; or the fork offer when `canSave` is false). Opening
     it moves focus to its heading; Escape inside it closes it and returns
     focus to the header's Save; a successful save or a Discard closes it.
     While it is open the editor stays editable and the preview pane is
     hidden (`SongEditor showPreview={false}`), as W04#4 draws.
8. **The panel follows the text.** `SongEditor` calls `onWrite()` after each
   debounced `WRITE` it sends; the host bumps a `revision`, and `SaveForm`
   re-sends `PREVIEW_SAVE` on a new `revision`. An untouched note (`note ===
   null`, `SaveSheet.jsx:86`) follows the new summary; a typed note is kept
   (workflow 4 §Saving, as edited).
9. **The Unsaved pane** (saved song on a computer only): a 300px
   `pane side` headed *Unsaved* (`editor.unsavedList`), a RAC `GridList`
   (Decision 5) of the rows `unsavedRows(browse, shelf, current)` gives —
   title, meta *{book}* or *{book} · {folder}/*, badge *unsaved* — the song
   being edited first and selected. The host sends `BROWSE` on mount (as
   `SearchScreen` does) so the slice is filled. Choosing a row calls the
   host's `onEdit({ bookId, path, title })`, AppShell's existing seam; the
   edit in progress is already in the working copy, so switching asks
   nothing (workflow 4 §Editing). A RAC `GridList` items object carries
   `id` + `row`, never a domain `key` field.
10. **No-match search**: h2 *No songs match* (`search.noMatch`), then
    *Searched titles, artists, sections, words and chords in {books}.*
    (`search.searchedIn`, the books in the scope as a list — `Intl.ListFormat`
    in the active locale), the Create row as today, and *Or paste a whole
    song, copied from anywhere, into a new one.* (`search.pasteHint`) as
    plain text. The `role="status"` announcement stays (the h2 is not
    announced on its own); it reads `search.empty` as today.
11. **Copy**, new keys in `en`, `es-419`, `it`, `pt-BR` (translated, not
    copied): `editor.keptOnDevice` *Kept on this device*;
    `editor.unsavedList` *Unsaved*; `search.noMatch` *No songs match*;
    `search.searchedIn` *Searched titles, artists, sections, words and chords
    in {books}.*; `search.pasteHint` *Or paste a whole song, copied from
    anywhere, into a new one.*; `saveSheet.keepEditing` *Keep editing* (the
    dialog's cancel, W03#4) if no existing key reads so —
    `DiscardConfirm`'s is reused when one does. `i18n.test.js` keeps the
    locales in step.
12. **Accessibility:** every control a RAC `Button`/`GridList`; the header's
    Save, Discard and the panel reachable by keyboard in reading order; the
    panel a labelled region, not a dialog; axe WCAG 2.1 AA clean on each
    state below. On the computer the board draws no Back; the app keeps it
    (Decision 4).
13. **Offline first, no song text in logs**: nothing here touches the
    network; all of it is view state over slices the Worker already
    publishes. Fixtures are songs written for the purpose (the example book,
    and titles invented here).
14. Kept green: `narrow-fit.spec.js` states 5-6; every spec that saves
    through `saveThroughSheet`/`openSaveSheet`/`confirmSheet` — the journeys
    find the save surface as `getByRole('dialog')` *or* the region named
    `/^Save /`, whichever opened, and click Save inside it.

## Acceptance criteria

### Behavior delivered

1. **Phone** (below 600px), both hosts: app bar *Back · {title} · Save*;
   the strip *unsaved changes · Kept on this device* while unsaved; the
   editor bar Text | Preview; a bottom bar *Add section · Discard changes*;
   Save opens the bottom sheet. (W04#1-2; W03#2 — see Decision 2.)
2. **Tablet** (600-1079px), both hosts: app bar *Back · {title} · unsaved
   changes · Discard changes · Save*; the editor bar Add section; the preview
   beside the text; Save opens a centred dialog; Discard's centred dialog as
   today. (W04#3, W03#3.)
3. **Computer** (1080px and up): a new song as on the tablet, with the first
   save in a centred dialog (W03#4). A saved song in three columns: the
   *Unsaved* pane, the editor (with its preview while the panel is closed),
   and on Save the inline panel; the panel's summary follows the text;
   choosing another unsaved song opens it in the editor. (W04#4.)
4. **The title follows the heading** in both hosts, on every device: typing
   `# Maré Mansa` into a new song's template replaces *Untitled song* (or the
   query) in the header, the save surface's heading and Discard's question;
   editing a saved song's heading renames it in the header; a text with no
   heading falls back as Constraint 4 says.
5. **No-match search** as W03#1, on every device.
6. `docs/workflows/04-edit-and-save.md` carries the delta (Decision 1).

### Tests, by level

**unit**

- `app/src/songs/unsaved-list.test.js` — `unsavedRows(browse, shelf,
  current)`: only `unsaved` songs; the current song first and marked
  current even when the index has not caught up with it yet; the rest in
  shelf order then title; meta *{book}* at a book's root and *{book} ·
  {folder}/* below it; a book no longer on the shelf is left out. *Pins:*
  W04#4 L163-168; workflow 4 §Saving (as edited).

**behavior** — with the `installWidths` matchMedia stub (lifted from
`SongReading.behavior.test.jsx:42` into a shared test helper if two files
need it) and `checkWcag21aa` on what renders:

- `app/src/songs/EditSongHost.behavior.test.jsx`, new block *"the editor
  chrome as drawn"*:
  - *"phone: Save in the header, the unsaved strip, Discard below"* — the
    banner holds *Back*, the title, *Save*, and no *Discard changes*; no
    strip before an edit; after an edit through `editorRef` a `status` with
    *unsaved changes* and *Kept on this device*; the bottom bar holds *Add
    section* and *Discard changes*; Save opens a `.sheet`; axe. *Pins:*
    W04#1 L28-52, W04#2 L75-94; workflow 4 §Editing (as edited). (Replaces
    L173-179.)
  - *"the title follows the heading"* — mount on a song whose heading is
    `# Tarde Clara` with a stale `songTitle`; the header reads *Tarde Clara*;
    replace the heading with `# Tarde Clara Nova` — the header, then the
    opened save surface's heading, read the new title; remove the heading —
    the header falls back to `songTitle`. *Pins:* the `.tji` note; workflow 4
    §Editing (as edited).
  - *"tablet: everything in the header, the save a centred dialog"* — the
    banner holds title, *unsaved changes*, *Discard changes*, *Save* in that
    order; the editor bar holds *Add section* and no *Save*; Save opens a
    `.dialog` under `.scrim.center`; axe. *Pins:* W04#3 L104-110.
  - *"computer: the Unsaved pane and the save panel"* — with a `browse`
    slice holding the current song and one other unsaved song in another
    book's folder: the region *Unsaved* lists both, current first and
    selected, the other with *{book} · {folder}/*; choosing it calls
    `onEdit` with its `{ bookId, path, title }`; Save opens a region named
    *Save {title}* — no `dialog` role — with focus on its heading, while the
    editor stays focusable and the preview is gone; an edit after it opened
    re-sends `PREVIEW_SAVE` and an untouched note follows the new summary, a
    typed note is kept; the panel's Save sends `SAVE` with the note; Escape
    in the panel closes it and focus returns to the header's *Save*; axe with
    the panel open. *Pins:* W04#4 L162-207; workflow 4 §Saving (as edited).
  - *"Save in the header keeps the editor's gate"* — a text with an
    unreadable voicing: the header's Save shows the *Not saved* stop and
    opens no sheet, dialog or panel; on the computer the open panel's Save
    does the same. *Pins:* editor Decision 10; W04#4 L178-184.
- `app/src/songs/NewSong.behavior.test.jsx`, new cases:
  - *"the header follows the first heading"* — a new song started with no
    title shows *Untitled song*; typing `# Maré Mansa` into the template's
    heading makes the header *Maré Mansa*; Discard's question names it;
    axe. *Pins:* the `.tji` note; W03#3 L91-97.
  - *"the first save is a sheet on the phone and a centred dialog on the
    tablet and the computer"* — for each width, Save opens `.sheet` (phone)
    or `.dialog` under `.scrim.center` (tablet, computer); the phone shows
    the unsaved strip from the start, above *In My songs*; axe. *Pins:*
    W03#2 L56-82, W03#4 L176-197.
- `app/src/editor/SongEditor.behavior.test.jsx`, new cases: *"reports the
  parsed title as it changes"* (`onTitleChange` on mount and after an edit
  to the heading, `null` once the heading is gone); *"a host-owned Save"*
  (with `saveRef`/`addSectionRef` the bar draws no Save, `saveRef.current()`
  runs the gate and calls `onSave` only when clean, `addSectionRef.current()`
  inserts a section; `onWrite` fires after a debounced write;
  `showPreview={false}` hides the wide preview). *Pins:* editor Decision 10;
  Constraints 2-4, 8.
- `app/src/songs/SaveSheet.behavior.test.jsx`, new case *"one form, three
  presentations"*: `presentation="sheet"` renders `.sheet` with a grip,
  `"dialog"` a `.dialog` in `.scrim.center`, `"panel"` a labelled region
  without an overlay; each with what changed, the note and Save; axe on each.
  *Pins:* workflow 4 §Saving (as edited); W03#4, W04#2, W04#4.
- `app/src/songs/SearchScreen.behavior.test.jsx`, new case *"nothing
  matched: what was searched, Create, and the paste hint"* — a query with no
  result over two books: the h2 *No songs match*; *Searched titles, artists,
  sections, words and chords in {A} and {B}.*; the Create row; *Or paste a
  whole song, copied from anywhere, into a new one.*; the status line still
  announces; axe. *Pins:* W03#1 L40-46; workflow 3 §Ways in L15-17.

**e2e-web** — on the phone, tablet and computer projects, through the real
UI only:

- `e2e/web/tests/edit-and-save.spec.js`, new test *"the editor chrome as
  drawn: the header, the unsaved strip and where the save sits"*:
  `openExampleBook`, `openSongInEditor` on a song of the example book,
  `typeAtEndOfLine`, `settleEdits`; then
  - phone: the banner has *Save* and the song's title whole (`expectFits`
    with the title as a sentence), no *Discard changes*; the strip shows
    *unsaved changes* and *Kept on this device*; *Discard changes* and *Add
    section* below the editor; `mockup(page, 'W04-edit-and-save', 1)`; Save
    → the sheet, `mockup(page, 'W04-edit-and-save', 2)`;
  - tablet: the banner has *unsaved changes*, *Discard changes*, *Save*;
    *Discard changes* → the centred dialog, `mockup(page,
    'W04-edit-and-save', 3)`, *Keep editing*; Save → a dialog;
  - computer: the *Unsaved* region lists the song, selected; Save → the
    region *Save {title}* beside the editor (its box right of the editor's
    right edge, not overlapping it); `mockup(page, 'W04-edit-and-save', 4,
    { note: 'the save panel' })`;
  - all three: change the heading line to a new title → the header shows it;
    confirm the save; the strip/badge is gone; `checkA11y()` with the save
    surface open and after.
  *Pins:* W04#1-4; workflow 4 §Editing, §Saving (as edited).
- `e2e/web/tests/edit-and-save.spec.js`, new test *"on a computer, the
  Unsaved pane moves between two unsaved songs"* (asserted on the computer
  project; on phone and tablet the test checks there is no *Unsaved* region,
  so it runs, not skips, on all three): edit two songs of the example book, leaving each
  unsaved; in the second's editor the pane lists both; choose the first →
  its editor opens with its edit still there; `checkA11y()`. *Pins:* W04#4
  L163-168.
- `e2e/web/tests/new-song.spec.js` L78 test, extended: the no-match state
  shows *No songs match*, the searched-in line and the paste hint before
  `mockup(page, 'W03-write-a-new-song', 1)`; after *Create*, the header
  carries the query as title, with *Save* in the banner (phone) and the
  unsaved strip, `mockup(…, 2)`; `checkA11y()`. *Pins:* W03#1-2; workflow 3
  §Ways in.
- `e2e/web/tests/new-song.spec.js`, new test *"the header follows the first
  heading, and the first save is a dialog on tablet and computer"*: Create
  from a no-match query, `replaceSong` with a song written here whose heading
  is `# Maré Mansa` → the header reads *Maré Mansa* on every project; on the
  tablet `mockup(page, 'W03-write-a-new-song', 3, { note: 'header follows
  the heading' })`; Save → a `.sheet` on the phone, a centred dialog on the
  tablet and computer, `mockup(page, 'W03-write-a-new-song', 4)` on the
  computer with the dialog open; confirm; the song is found by search under
  *Maré Mansa*; `checkA11y()` with the dialog open. *Pins:* W03#3-4;
  workflow 3 §The first save.
- The frames already captured keep being captured, now showing the new
  chrome: `editor.spec.js:57,70,91,137`, `save-sheet.spec.js:31,39,70`,
  `edit-and-save.spec.js:32,37,38,71`; `new-song.spec.js:43`'s
  `typeAndSave` frame hook is either given a caller or removed (no dead
  frame). The journeys that save (Constraint 14) are updated in
  `e2e/web/lib/journeys.js` / `journeys-edit.js`, so every spec that saves
  stays green on all three projects; `narrow-fit.spec.js` states 5-6 stay
  green.

No test level is dropped. Deferred, with its own tests, to
**`songs.first_save_fields`** (closer registers in WBS; 0.5d; not
`cifra.md:`; M5): *"The first-save dialog names the book and the file — W03#4
draws Book and a read-only File name ('Named once, from the title. Changing
the title later edits its heading, not the file.'); SAVE_PREVIEW for a new
song carries the filename NAME_AND_SAVE would take (deriveSongFilename with
the folder's collision suffix), and the dialog shows it with the book. Tests:
unit (the Worker's preview filename, with a collision); behavior (the dialog
shows Book and File name, the name follows the title); e2e-web (W03#4 with
the fields)."* `depends songs.editor_chrome`.

## Decisions

1. **A design delta in workflow 4, not just a board reading.** Workflow 4
   says *Save opens a short sheet* and the song shows *unsaved changes* in its
   header; the boards place the save in three ways and add *Kept on this
   device* and the computer's unsaved list. Those are decisions the boards
   carry but no workflow states, and this task makes the app depend on them,
   so §Editing and §Saving now say them. The alternative — leaving the
   workflow saying *sheet* while the computer shows a panel — would make the
   next audit read the panel as a defect.
2. **One phone chrome for both hosts, W04#1's.** W03#2 puts Save in the
   bottom bar and the badge in the app bar, with no Discard; W04#1 puts Save
   in the app bar, the mark on its own strip and *Discard changes* below.
   A new song needs Discard too (workflow 3 L52), which W03#2 has no place
   for, and one header for both hosts is what the note asks (*the editor
   header… where the board has the title and Save*). So W03#2's frame will
   differ in where Save sits; the tablet and computer frames of both boards
   already agree.
3. **The computer's saved-song save is a panel; everything else modal.**
   W04#4 draws a panel and W03#4 a centred dialog on the same screen size.
   They differ for a reason: a saved song's panel sits beside the text the
   user may still fix (W04#4 draws a stopped save being fixed), while a new
   song's first save is a one-time naming step. Following both is cheaper
   than a reconciliation, and the shared `SaveForm` keeps one form. The
   tablet, where neither board draws a save, follows its own Discard dialog
   (W04#3). The rejected alternative — a centred dialog for every save on a
   computer — is the one-column look the audit flagged.
4. **The computer keeps Back.** W04#4 draws none, but the Unsaved pane only
   reaches unsaved songs; without Back the way out of the editor is the
   browser. Back costs one icon in a 1280px bar.
5. **The Unsaved list is a GridList of rows that open, fed by `browse`.**
   The search screen's browse slice already carries `unsaved` per song in
   every book, so no Worker command is added. Rows are navigation with one
   action, as the search rows are; a GridList gives arrow-key movement and a
   selected state without a role="list" of buttons (axe's
   aria-required-children). The fork card the board draws in the pane
   (*Saving Carinhoso*) is the save surface's existing fork offer, so it
   shows in the panel, where the save is — not as a second copy in the pane.
6. **The title is reported by the editor, not re-parsed by the host.** The
   editor already parses the buffer for the preview and the gate (L347); an
   `onTitleChange` from that parse costs nothing and keeps the view the only
   parser of the live buffer. The rejected alternative — the Worker
   reporting the title on each WRITE — adds a round trip to a keystroke.
7. **Save's gate stays in the editor, published through a ref.** Moving
   `onSavePress` into the host would split the gate from the blockers it
   reads; `saveRef` follows the `flushRef` seam `songs.discard_summary`
   established.
8. **One 1080px line, named for the editor.** `EDITOR_WIDE_QUERY` joins the
   per-screen 1080px constants (`layout-mode.js:36-63`): 300 (pane) + ~420
   (text) + 360 (panel) needs the computer's width; the 712px tablet takes
   the dialog. A named constant per screen is the pattern those constants
   set.
9. **The first-save Book and File name fields are deferred** to
   `songs.first_save_fields`: the File name must be the one the Worker will
   take, with its collision suffix, which needs `SAVE_PREVIEW` to carry it —
   a Worker change of its own. This task delivers the dialog's presentation
   the note names; the deferred task fills the two fields W03#4 adds.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-18.

- One header, strip and phone bottom bar for both hosts: `app/src/songs/EditorChrome.jsx`, `app/src/songs/editor-chrome.css`; used by `EditSongHost.jsx` and `NewSongHost.jsx`. The header title follows the song's `#` heading (`onTitleChange` from `app/src/editor/SongEditor.jsx`, which also publishes `saveRef`/`addSectionRef`, `onWrite` and `showPreview`).
- Save surface per device: `app/src/songs/SaveSheet.jsx` and `save-sheet.css` take `presentation` of sheet, dialog or panel and a `revision`; `app/src/shell/layout-mode.js` gains `EDITOR_WIDE_QUERY` (1080px), wired in `app/src/shell/AppShell.jsx`.
- The computer's *Unsaved* pane: `app/src/songs/UnsavedPane.jsx` and the pure `app/src/songs/unsaved-list.js`.
- The no-match search state as W03#1: `app/src/songs/SearchScreen.jsx`, `search.css`; copy in `app/src/i18n/locales/{en,es-419,it,pt-BR}.js`.
- Design delta in `docs/workflows/04-edit-and-save.md`. One deviation from W04#4: the inline panel has a quiet Cancel under its Save so a mouse user can close it.
- Tests: unit `unsaved-list.test.js`; behavior in `EditSongHost`, `NewSong`, `SongEditor`, `SaveSheet`, `SearchScreen` (shared `app/src/test/widths.js`); e2e-web `edit-and-save.spec.js` (2 new), `new-song.spec.js` (1 new, 1 extended), with journeys updated (`e2e/web/lib/journeys*.js`) and locators in `search`, `editor`, `fork`, `routing`, `conflicts` specs.
- Deferred: `songs.first_save_fields` (Book and File name in the first-save dialog), registered in `tasks/60-songs.tji` and wired into M5.

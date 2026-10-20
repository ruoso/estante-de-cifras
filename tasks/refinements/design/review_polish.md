# Refinement — `design.review_polish`

## TaskJuggler

[`tasks/20-design.tji`](../../20-design.tji), `task review_polish "Polish from
the usability review"` (line 99). The note, in short:

> Decide and draw, from the usability review 2026-10-19: (1) the book detail
> order — Share where W07 puts it (the app bar), Delete set apart at the end,
> not under Share; (2) plain words for the Download card, the upload preview
> .gitattributes line and the setlist raw pane *any git host*, git terms kept
> only in the file view, and a save-sheet caption for a local book that does
> not promise sharing; (3) the search screen book section header on a phone,
> its plus, Save all and filter beside the row, never drawn; (4) an empty song
> and an empty section in the reading view, with Edit; (5) the song ⋯ menu
> grouped, its duplication of the toolbar kept as decided; and from the
> persona exploration 2026-10-19: (6) the shape language a teacher did not
> understand; (7) one wording for the fifty-person limit; (8) Put online runs
> with no confirmation and nothing says students cannot see the book until it
> is online; (9) a setlist made from Add to setlist opens its editor saying
> unsaved changes before anything was changed (true: it is not saved yet) and
> editing has no Done; (10) in the editor Preview the text box crowds the
> preview on a phone. Copy in the four locales. Workflows 2, 4, 5, 7, 10, 12.
> Tests: none — design deliverable (workflow edits and the W02, W07 and
> reading boards).

## Effort estimate

1d as the `.tji` gives it. Every decision and every English string is pinned
here (Decisions, and the copy table under *The new copy*); what is left is
writing them into the workflows and drawing them. Ten small items, most of
them a paragraph and a string; the drawing is one new board and in-place edits
to W07, W02 and W12. If it runs over, it is the new board.

## Repository

estante-de-cifras, **not** `cifra.md/` (the note does not start with
`cifra.md:`). Files (all the implementer's):

- `docs/workflows/07-add-a-book.md` — §A book's songs, the detail paragraph
  (L89-98): the new order (item 1); §Putting a book online (L127-133): the
  confirmation and what it says (items 7, 8); §Downloading a book (L136-142)
  and §Uploading a book (L146-): the plain words (item 2).
- `docs/workflows/02-find-and-play.md` — §Scope (L60-73) or §The search
  screen (L9-25): the book section header (item 3); §Reading a song (L74-103):
  the empty song and section (item 4) and the grouped ⋯ menu (item 5);
  §Where a chord's shape comes from (L104-126): the shapes caption and the
  no-voicings notice in the new words (item 6).
- `docs/workflows/01-first-run.md` L98-101 — the instrument prompt's new words
  (item 6; the prompt is defined there, so it changes there).
- `docs/workflows/04-edit-and-save.md` — §Save pushes (L82-94): the caption
  for a local book (item 2).
- `docs/workflows/03-write-a-new-song.md` — §The editor (L78-79): when text
  and preview sit side by side (item 10). Workflow 4 §Editing already defers
  to it.
- `docs/workflows/10-share.md` — §At most fifty people per book (L27-39): the
  one UI wording (item 7).
- `docs/workflows/12-setlists.md` — §Building one (L56-67): the never-saved
  setlist and *Done* (item 9); §The file: the raw pane's line (item 2).
- `docs/workflows/05-arrange-for-an-instrument.md` — only if its words for the
  marks change; under Decision *The marks keep their word* they do not, so it
  is untouched.
- `docs/mockups/Review-polish.dc.html` — **new** board (the states no board
  draws).
- `docs/mockups/W07-add-a-book.dc.html` — Computer frame (L178-250) in place:
  the order and the separated end group; the Download card's new body (L216).
- `docs/mockups/W02-find-and-play.dc.html` — Phone 2 (reading) in place: the
  shapes caption in the new words.
- `docs/mockups/W12-setlists.dc.html` — Computer editor (L158-) in place:
  *Done* in its bar.
- `docs/mockups/canvas.json` — the new board registered (the closer;
  `docs/mockups/GUIDE.md:14` tells a board writer not to edit it).
- `docs/DIRECTION.md` §6 — a *Polish from the usability review* bullet; §7
  unchanged, no new workflow.

No code, no `api/` change, no locale file: the builds (Why, below) change the
strings in all four locales.

## Inherited dependencies

- Settled: `design.book_row_songs` (the detail opened by *Manage* from a
  book's songs, workflow 7 L89-98), `design.format_help` (the editor bar's
  *Help*, which item 10 must keep beside *Text | Preview*), `design.leave_book`
  and `design.w07_remove_board` (Leave and Remove, their confirmations — this
  task moves them, not changes them), `songs.reading_chrome` (Decision 2: every
  action stays in ⋯ on every device; the inline buttons are shortcuts).
- No pending dependency: the `.tji` block has no `depends`.

## What this task is

Ten small decisions from two passes over the deployed app on 2026-10-19 — a
usability review (findings M11, M12, L4, M4, M13, L6, L7) and a persona
exploration (a first-time teacher) — written into the workflows they belong
to and drawn where a board shows the screen. Each is a gap the workflows left
open or a wording that did not land with a real person; none changes what the
app does with a book.

## Why it needs to be done

Five build tasks wait on it and implement "as design.review_polish
decides/draws": `books.detail_as_drawn` (item 1, `tasks/65-books.tji:206`),
`shell.plain_language` (item 2, `tasks/50-shell.tji:140`),
`songs.search_book_head_narrow` (item 3, `tasks/60-songs.tji:215`),
`songs.empty_states` (item 4, `:221`), `songs.menu_grouping` (item 5, `:227`),
all in `milestones.m5_complete`. Items 6-10 have no build task yet; this
refinement names them (Acceptance criteria 9) so the closer registers them.

## Inputs / context

- **The book detail today**: `app/src/books/BookDetail.jsx:448-456` app bar
  (Back, title, Rename — no Share); body 458-653: chips, original-gone, Put
  online (local, 491-506), lost access, can't save, taken down, Download
  (555-562), Files (564-576), Fork (non-owner hosted, 578-587), Remove
  (589-601), Leave (member, 603-627), a Share card (owner hosted or member,
  629-644), Delete (owner hosted, 646-652). Put online sends `PUT_ONLINE` at
  once, no dialog (429-432).
- **W07 Computer** (`docs/mockups/W07-add-a-book.dc.html:178-250`): app bar
  Back · title · Rename · spacer · **Share** (206); cards Download | Files
  (214-225), Remove | Delete (226-237); the delete dialog (238-250). No Put
  online, Fork or Leave drawn (an owner's hosted book).
- **Workflow 7** L89-98 (the detail, its acts "as they are drawn": put online,
  notices, Download, Files, then fork, remove, leave, share and delete);
  L127-133 (Put online goes private, "at most fifty"); L136-142 (Download);
  L210-221 (Remove, Delete).
- **Strings** (`app/src/i18n/locales/en.js`; pt-BR.js, es-419.js, it.js
  beside it): `books.putOnlineBody` 196-197 (*at most 50*), `books.download`
  213, `books.downloadBody` 214-215, `books.shareBody` 263 (*up to fifty*),
  `books.uploadLeftOutBody` 88-89 (names .gitattributes; used at
  `app/src/books/UploadPreview.jsx:364`), `setlists.relativeNote` 542 (*any
  git host*; `app/src/books/SetlistView.jsx:537`), `saveSheet.pushCaption`
  1105-1106 (unconditional, `app/src/songs/SaveSheet.jsx:326`),
  `reading.shapesCaption` 1631 (`SongReading.jsx:497`), `reading.noVoicings`
  1652-1653 (`SongReading.jsx:711`), `reading.instrumentPrompt` 1657 with
  1658-1659 (`SongReading.jsx:637-639`), `setlists.unsaved` 523,
  `setlists.done` 512 (defined, unused), `editor.nothingYet` 2077 (defined,
  unused). `fileView.holds` 1390-1391 names .gitattributes and stays — the
  file view is where git terms belong (workflow 14).
- **Search book section**: `app/src/songs/SearchScreen.jsx:325-370` — the
  `book-head` holds the bordered disclosure trigger (caret, name, meta), the
  44px plus (341-348, `newSong.inThisBook`), *Save all* (354-362, when the
  book has unsaved songs) and the 44px filter (364-370,
  `search.scopeToBook`); `app/src/songs/search.css:137-210`. W02 never draws
  a book section on a phone (its computer rail, L163-168, is the shelf).
- **Reading view**: `app/src/songs/SongReading.jsx:509-539` (the sheet: Chart,
  then shapes) — nothing for an empty song or section; `app/src/chart/Chart.jsx`
  draws a section as its name only (119-120). The new-song template
  (`app/src/editor/template.js`) saves untouched as a title, `artist`,
  `notation`, `## Intro` and an empty fence — the case the review met.
- **⋯ menu** (`SongReading.jsx:588-621`): Edit, History, Add to setlist,
  Print, Share, Show the file, Arrange for {instrument} (not while
  transposed), Full screen. `tasks/refinements/songs/reading_chrome.md`
  Decision 2 (L336-350): the menu holds everything on every device.
- **Shapes**: `docs/mockups/README.md:26` (defaults hollow, your shapes in the
  chord colour, the song's own in ink; every badge carries a word); workflow
  2 L104-126 (marks *your shape*, *default*); workflow 1 L98-101 (*playing on
  guitar — change?*).
- **Fifty**: workflow 10 L27-39 (*37 of 50* in the sharing screen), W10
  board `37 of 50`, `50 of 50`.
- **Setlists**: `app/src/books/AddToSetlist.jsx:120-135, 180-192` (New
  setlist… creates and closes; nothing opens); `SetlistView.jsx:202` (a `new`
  working-tree file counts as unsaved), 548-573 (the edit bar: icon Back that
  leaves editing, title, badge, Add song, Play, Discard, Save — no *Done*);
  W12 Computer editor (L158-167). Workflow 12 L56-67 says nothing on leaving
  the editor.
- **Editor**: `app/src/editor/SongEditor.jsx:512-544, 659` — the split is
  chosen by the shell's breakpoint (`app/src/shell/layout-mode.js:22`,
  `(min-width: 600px)`): below it *Text | Preview* shows one pane; above it
  both side by side whatever the editor's own width. W03 tablet draws the
  preview as a 340px card beside the text (L88-120).
- **Boards**: `docs/mockups/GUIDE.md` (two phones 390×844, tablet 820×1180,
  computer 1280×800; board root 3208×1500); `canvas.json` boards on the 1620
  y stride.

## Constraints / requirements

- Workflows decide and boards draw what the workflows say, in real copy
  (DIRECTION §4; GUIDE.md). Only `var(--…)` tokens; status in words, never
  colour alone.
- Every control the builds will make is a React Aria Component with a
  keyboard path; the grouped menu uses RAC `Section` + `Header` + `Separator`
  so each group is named for a screen reader.
- Git terms (*repository*, *git*, *.gitattributes*, *remote*) stay only in the
  file view (workflow 14) and in Download's own behaviour, not its words.
- The changes keep what is decided: the ⋯ menu still holds every action on
  every device (`reading_chrome` Decision 2); Leave and Remove keep their
  confirmations (`leave_book`, `w07_remove_board`); Put online still goes
  private (workflow 7 L129); one kind of unsaved change (workflow 4 L19-23).
- Offline first: the Put online confirmation is a local dialog; offline it
  still opens and its button gives today's *You’re offline* failure.
- English is pinned here; the builds translate into pt-BR, es-419 and it
  (Decision *English pinned, the builds translate*).

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause: "none
— design deliverable (workflow edits and the W02, W07 and reading boards)").
Acceptance is what the workflow documents decide, what the boards show, and
the DIRECTION delta — concrete enough that each build's named tests can be
written against them.

1. **Workflow 7 decides** (§A book's songs, the detail paragraph L89-98):
   - **Share is in the detail's app bar**, at its right end, beside *Rename*,
     for whoever today gets the Share card (a hosted book's owner, or a
     member); it opens the same sharing screen (owner) or people screen
     (member). A local book has no Share there — its Put online card says how
     (item 8). The Share card goes; its two body lines go with it.
   - The body, top to bottom: the chips; the state cards (put online, original
     gone, lost access, can't save, taken down); **Download**; **Files**;
     **Fork**; then, after a separator, the **closing group**: *Remove from my
     shelf*, *Leave this book*, and last *Delete the book* in its danger
     style. The separator is a rule with space above it, not a heading.
   - On a phone the app bar is Back · title · Rename as an icon (accessible
     name *Rename {book}*) · Share as a word; on a tablet and a computer
     Rename keeps its word.
   - Pins `books.detail_as_drawn`'s "the order and the separation, Share
     reachable, keyboard path" — tab order follows the drawn order: Back,
     Rename, Share, then the body.
2. **Plain words** (workflow 7 §Downloading, §Uploading; workflow 12 §The
   file; workflow 4 §Save pushes), the copy in *The new copy* below:
   Download's body, the upload preview's *Left out* line, the setlist raw
   pane's line, and the save sheet's caption chosen by where the book lives —
   a local book's caption says it stays on this device; a hosted book's is
   today's. Pins `shell.plain_language`'s "the local-book save caption
   differs from a hosted one".
3. **Workflow 2 decides the book section header** (§Scope or §The search
   screen): on every device the header is the bordered row (caret, name, meta)
   with the plus and the filter beside it — two 44px icons; **Save all leaves
   the header** for a line of its own under it, above the songs and outside
   the disclosure panel so it shows with the section collapsed: *{count} songs
   with unsaved changes* and the **Save all** button at its end. Pins
   `songs.search_book_head_narrow`'s "the actions reachable at narrow width"
   and "nothing clipped at 390px".
4. **Workflow 2 decides the empty states** (§Reading a song):
   - **An empty song** — no section holds a bar, a sung line or a note, and
     nothing outside a section (the untouched template is one): in place of
     the chart, a notice *Nothing written in this song yet.* with **Edit**
     (opening the editor, as the toolbar's Edit does). Its section names are
     not drawn; the shapes section is absent, as it is with no chords.
   - **An empty section** in a song that has others: under its name, a muted
     line *Nothing written here yet.* — no button (one Edit per section would
     repeat the toolbar's).
   - Pins `songs.empty_states`'s "an empty song and an empty section, Edit
     reachable".
5. **Workflow 2 decides the ⋯ menu's groups** (§Reading a song), each a named
   group with a visible small header, separated, in this order:
   - **This song** — Edit, Arrange for {instrument} (still left out while
     transposed), History, Show the file;
   - **Take it along** — Add to setlist, Share, Print;
   - **View** — Full screen.
   Every action stays on every device; the toolbar shortcuts are unchanged.
   Pins `songs.menu_grouping`'s "groups named for a screen reader, keyboard
   order".
6. **Shape words** (workflow 2 §Where a chord's shape comes from; workflow 1
   L98-101): the shapes caption, the no-voicings notice and the instrument
   prompt in the words of *The new copy*. The marks on each diagram keep
   their words (*your shape*, *default*).
7. **The fifty, and Put online** (workflow 7 §Putting a book online, workflow
   10 §At most fifty): every screen says **up to 50 people** (digits, as the
   sharing screen's *37 of 50*); workflow prose may keep *fifty*. **Put
   online on the book detail asks first**: a dialog *Put {book} online?*,
   body as in *The new copy*, **Cancel** and **Put online** (focus on Cancel
   when it opens, back on the card's button when it closes). The local book's
   card says nobody else can see it yet. The share panel's *Put it online to
   invite people* (`ShareNeedsOnline.jsx`) stays one press — its sentence is
   the explanation, and the press is the person's answer to it.
8. **Workflow 12 decides** (§Building one): a setlist that has **never been
   saved** reads **not saved yet** where an edited one reads *unsaved
   changes* — in its badge, in the setlist list and in the editor bar; it is
   the same unsaved change underneath (workflow 4 L19-23), named for what it
   is. Creating one from *Add to setlist* still opens nothing. The editor bar's
   icon-only Back becomes **Done**, a word, in the same place: it leaves
   editing for the setlist's read view keeping every change (as leaving any
   unsaved change asks nothing, workflow 4 L15-17); Save and Discard are
   unchanged.
9. **Workflow 3 decides** (§The editor, L78-79): **text and preview sit side
   by side only when the editor itself is at least 640px wide** (a text of at
   least 280px beside the 340px preview the boards draw, and the gap);
   narrower, whatever the device, it is *Text | Preview*, one at a time, with
   *Help* beside it. The phone in its normal hold already is; a phone turned
   sideways, or a narrow window on a computer, now is too.
10. **The new board** `docs/mockups/Review-polish.dc.html`, drawn to GUIDE.md:
    `.board-head` *Workflows 2, 7 & 12 · Polish from the usability review*,
    sub-line *A book section's Save all on its own line, an empty song, Put
    online asking first, and the song menu in groups.* Frames:
    - **Phone 1 · a book section with unsaved songs** — search with an empty
      box, the section *Ensaios* (bordered row: caret, *Ensaios*, *12 songs*;
      the plus; the filter), under it *2 songs with unsaved changes* with
      **Save all**, then its songs, two with the *unsaved* badge; a second
      section collapsed below. Nothing past the card edge.
    - **Phone 2 · an untouched song** — the reading view of *Untitled song*
      in *My songs*: app bar, the notice *Nothing written in this song yet.*
      with **Edit**, the bottom bar.
    - **Tablet · Put online, asking** — a local book's detail (*Choros da
      turma*, chip *On this device*) with the Put online card in its new
      words, and over it the dialog *Put Choros da turma online?* with its
      body, **Cancel** and **Put online**; no Share in the app bar (a local
      book).
    - **Computer · the song menu in groups** — a song read on the computer,
      its *Refrão* section empty with *Nothing written here yet.* under its
      name, and the ⋯ menu open in its `card` surface: *This song* (Edit,
      Arrange for guitar, History, Show the file), *Take it along* (Add to
      setlist, Share, Print), *View* (Full screen), headers small, separators
      between.
    Songs on the board are written for it (no one else's words).
11. **Boards in place**: W07 Computer — the app bar keeps Share; Download |
    Files; Fork is not drawn (owner); a rule; then Remove | Delete, Delete
    last; Download's body in the new words. W02 Phone 2 — the shapes caption
    in the new words. W12 Computer editor — **Done** where the back icon is.
12. **Registration**: `boards["Review-polish.dc.html"] { x: 0, w: 3208, h:
    1500, title: "2, 7 & 12. Polish from the usability review" }` at the next
    free `y` on the 1620 stride after Format-help (42300), appended to
    `order` — by the closer. The `tasks/parking-lot.md` boards-to-republish
    entry gets an *Updated* line naming W02, W07, W12 and the new board — by
    the closer.
13. **DIRECTION §6** gains a *Polish from the usability review* bullet in the
    shape of its neighbours (decided in workflows 1, 2, 3, 4, 7, 10, 12;
    drawn on the new board and W02, W07, W12; one line per item; *No new
    workflow.*). §7 unchanged.
14. **No code tests, and none deferred.** The builds' named tests (the five
    existing tasks', and the four below) are the handshake, not a deferral.
15. **Deferred follow-ups** (closer registers in WBS; milestone
    `milestones.m5_complete`; each depends `design.review_polish`; none
    starts with `cifra.md:`):
    - `songs.shape_words`, 0.5d — "Item 6 of design.review_polish: the
      reading view's shapes caption, its no-voicings notice and the
      first-open instrument prompt in the words it pins
      (`reading.shapesCaption`, `reading.noVoicings`,
      `reading.instrumentPrompt` and its two buttons), in the four locales;
      the per-diagram marks unchanged. Workflows 1, 2. Tests: unit (the
      locales carry every key); behavior (SongReading: the caption with a
      default and a chosen shape, the notice on a song with no voicings, the
      prompt and its two answers; axe)."
    - `books.put_online_confirm`, 0.5d — "Items 7 and 8 of
      design.review_polish: Put online on the book detail opens a
      confirmation (Put {book} online?, what private means, up to 50 people;
      Cancel focused; focus back on the card's button), the local book's card
      says nobody else can see it yet, and every screen says up to 50 people
      (books.putOnlineBody, books.shareBody's successor, the sharing screen's
      hint), in the four locales; the share panel's Put it online stays one
      press. Workflows 7, 10. Tests: behavior (BookDetail: Cancel sends
      nothing, Put online sends PUT_ONLINE, offline the failure line; axe);
      e2e-web (a local book put online through the dialog on phone, tablet
      and computer, then Share in the app bar; axe; the existing put-online
      journey in e2e/web/lib updated to pass the dialog)."
    - `books.setlist_done`, 0.5d — "Item 9 of design.review_polish: a setlist
      never saved reads not saved yet (badge, setlist list, editor bar)
      instead of unsaved changes, and the setlist editor's icon-only Back
      becomes Done, leaving editing with every change kept; four locales.
      Workflow 12. Tests: behavior (SetlistView: a new setlist's badge, an
      edited saved one's, Done keeps the change and returns focus to Edit;
      axe); e2e-web (a setlist made from Add to setlist, opened, edited, Done,
      then saved, on phone, tablet and computer; axe)."
    - `songs.editor_split_width`, 0.5d — "Item 10 of design.review_polish: the
      song editor puts text and preview side by side only when its own width
      is at least 640px, else Text | Preview with Help beside it, whatever
      the shell's layout. Workflow 3 §The editor. Tests: behavior
      (SongEditor: below and above 640px of editor width, the toggle and the
      split, focus kept on switching; axe); e2e-web (the editor on phone,
      tablet and computer, and on the phone at 844×390 via the viewport, never
      side by side under 640px; axe)."

### The new copy

| Where | Copy |
|---|---|
| `books.downloadBody` | A zip of this book as it is on this device: every song and setlist with its whole history, and unsaved changes as they are. Upload it to bring the book back. |
| `books.uploadLeftOutBody` | A book holds songs, setlists and its README, so these stay behind. |
| `setlists.relativeNote` | The links start from {folder}, so they keep working wherever the book’s files are copied. |
| save sheet caption, local book (new key) | Saved on this device. Only you can see it until the book is put online. |
| save sheet caption, hosted book | unchanged: Saving shares this version with whoever shares the book; with no network, at the next sync. |
| search, under a book's header (new, plural) | {count} song with unsaved changes / {count} songs with unsaved changes · **Save all** |
| reading, empty song (new) | Nothing written in this song yet. · **Edit** |
| reading, empty section (new) | Nothing written here yet. |
| ⋯ menu group headers (new) | This song · Take it along · View |
| `reading.shapesCaption` | In ink: the song’s own shape. In colour: a shape you chose. In outline, marked default: the app’s suggestion. |
| `reading.noVoicings` | This song doesn’t say yet how to play its chords on {instrument}, so each chord shows its easiest shape. · **Arrange for {instrument}** |
| `reading.instrumentPrompt` and its buttons | Chord shapes shown for guitar. · **Change instrument** · **Keep guitar** |
| `books.putOnlineBody` | Only on this device: nobody else can see it. Put it online to invite people — up to 50. |
| Share's hint (was `books.shareBody`, now the sharing screen's) | Invite people to read or edit this book — up to 50 people. |
| Put online dialog (new) | **Put {book} online?** It goes to Estante private: only you can open it. Nobody else sees it until you invite them from Share — up to 50 people. · **Cancel** · **Put online** |
| setlist, never saved (new) | not saved yet |
| setlist editor bar | **Done** (`setlists.done`, already defined) |

## Decisions

### Share moves to the app bar; the closing group ends with Delete

**Chosen:** Share in the app bar as W07 draws it; Remove, Leave and Delete
together after a separator, Delete last. **Rejected:** (a) keeping a Share
card and only adding space before Delete — the board already put Share in the
bar, and a card for the act most people come for buries it under Fork and
Remove; (b) a *Danger zone* heading — Remove and Leave are not dangerous to
anyone but this device and this person, and a heading over three cards is
noise where a rule and space set them apart; (c) Delete alone after the rule
— Remove and Leave would then sit between Fork and the rule as ordinary acts,
and they end the book's presence too.

### Save all gets its own line, on every device

**Chosen:** one layout: row + plus + filter, Save all on a line under it with
the count. **Rejected:** (a) a phone-only layout — the count says what Save all
will save, which helps on a computer too, and one layout is one test; (b)
moving Save all into the disclosure panel — it would hide with the section
collapsed; (c) folding plus and filter into a ⋯ — two 44px icons fit beside
the row at 370px (≈266px left for it); it was the third action that broke it.

### An empty song replaces the chart; an empty section gets a line

**Chosen:** the song-level notice with Edit, and a muted line per empty
section with no button. **Rejected:** a per-section Edit (repeats the
toolbar's for every section, and Edit opens the whole text anyway); reusing
`editor.nothingYet` (*Nothing written yet.*) — it is defined but unused and
says nothing of where; the builds may drop it.

### Three named groups in the menu, the toolbar untouched

**Chosen:** *This song* / *Take it along* / *View*, with visible headers.
**Rejected:** separators without headers — the note asks for groups named for
a screen reader, and a visible header is what a sighted person gets of the
same name; four or more groups — Full screen alone is already one; removing
toolbar duplicates — `reading_chrome` Decision 2 keeps the menu the same
everywhere.

### The marks keep their word

**Chosen:** the caption explains the three looks with the mark's word in it
(*marked default*); *your shape* and *default* stay as they are in workflows
2, 5 and 16 and on every board. **Rejected:** renaming *default* to
*suggested* — the persona did not stumble on the mark but on *Hollow* and the
unexplained caption; a rename touches three workflows, the explorer and the
arrange view for a word that was not the problem.

### Up to 50, in digits

**Chosen:** *up to 50 people* on every screen. **Rejected:** *fifty* in words
— the sharing screen counts *37 of 50* and *50 of 50*, so the limit in digits
reads as the same number, and digits need no translation; *at most* — *up to*
reads as an allowance, which is what an invitation is.

### Put online asks on the detail, not in the share panel

**Chosen:** a confirmation where Put online is pressed cold (the book detail);
none in the share panel, where the person pressed Share and is told the book
must go online first. **Rejected:** no confirmation (the finding: it ran
before the teacher knew what it meant, and it creates a book on a server);
confirming in both places (a second question on top of a sentence the person
just answered by pressing).

### *Not saved yet* names the new setlist; *Done* leaves editing

**Chosen:** a different badge word for a file never saved, the same unsaved
change underneath; Done replacing the icon-only Back. **Rejected:** saving the
setlist on create (workflow 12 L61: every change is an edit, saved like any
other — and saving is where a hosted book's change reaches others, which
needs the save sheet); opening the editor on create (the person was adding a
song to it from a song, and stays there); a Done beside Back (two ways out
doing the same thing).

### The editor splits by its own width

**Chosen:** 640px of editor width, independent of the shell's 600px
breakpoint. **Rejected:** moving the shell breakpoint (it governs the tab bar
and the sidebar, not the editor); a fixed device rule (the crowding came from
a wide-layout window too narrow for two panes; the editor's own width is what
decides whether two fit). The review's exact viewport was not recorded; this
rule covers any width under the two panes' minimum.

### English pinned, the builds translate

**Chosen:** this task pins English; each build writes pt-BR, es-419 and it.
**Rejected:** four-locale tables here — the precedent of every design
refinement (`format_help`, `sign_in_two_doors`), and the builds' unit test
(the locales carry every key) is what checks the translations exist.

### The workflow deltas are the implementer's

**Chosen:** this refinement pins every decision and string; the implementer
writes them into the workflows with the boards. **Rejected:** writing the
deltas with the refinement as `format_help` did — ten items across seven
workflows would make this document a second copy of them; the workflows are
where the decisions live once written.

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-20.

- The ten decisions are written into `docs/workflows/01-first-run.md`, `02-find-and-play.md`, `03-write-a-new-song.md`, `04-edit-and-save.md`, `07-add-a-book.md`, `10-share.md` and `12-setlists.md`.
- `docs/DIRECTION.md` §6 gains a *Polish from the usability review* bullet; §7 unchanged.
- New board `docs/mockups/Review-polish.dc.html`, registered in `docs/mockups/canvas.json` at y 43920.
- Boards edited in place: `W07-add-a-book.dc.html` (rule before Remove | Delete, Download and left-out lines), `W02-find-and-play.dc.html` (shapes caption on the Tablet frame, no-voicings notice), `W12-setlists.dc.html` (*Done*, raw-pane line).
- Copy-only consistency changes in `W01-first-run.dc.html`, `Remove-from-shelf.dc.html`, `Leave-book.dc.html` and `Open-a-book.dc.html`.
- Follow-ups registered in `milestones.m5_complete`: `songs.shape_words`, `songs.editor_split_width` (`tasks/60-songs.tji`), `books.put_online_confirm`, `books.setlist_done` (`tasks/65-books.tji`).
- Parking lot: item 10's 640px rule is inferred, since the review did not record the viewport; boards to republish.


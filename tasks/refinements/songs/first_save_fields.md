# songs.first_save_fields — The first-save dialog names the book and the file

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) L154-159, `task first_save_fields`
in `songs`:

> W03#4 draws Book and a read-only File name (Named once, from the title.
> Changing the title later edits its heading, not the file.) in the first-save
> dialog; SAVE_PREVIEW for a new song must carry the filename NAME_AND_SAVE
> would take (deriveSongFilename with the folder's collision suffix), and the
> dialog shows it with the book. Source-of-debt:
> tasks/refinements/songs/editor_chrome.md (Decision 9; workflow 3 The first
> save; W03 board frame 4). Tests: unit (the Worker's preview filename, with a
> collision); behavior (the dialog shows Book and File name, the name follows
> the title); e2e-web (W03#4 with the fields).

## Effort estimate

0.5d.

## Repository

The estante-de-cifras tree, not `cifra.md/`: `app/src/songs/`
(`song-filename.js`, `SaveSheet.jsx`, `NewSongHost.jsx`), `app/src/worker/`
(`logic.js`, `protocol.js` comment), `app/src/i18n/locales/` (four locales),
and `e2e/web/tests/new-song.spec.js`. Design delta in
`docs/workflows/03-write-a-new-song.md` §The first save (written with this
refinement).

## Inherited dependencies

- `songs.editor_chrome` — **settled** (complete 100). It built the first save
  as a centred dialog on tablet and computer and a sheet on the phone
  (`presentation` on `SaveSheet`), and deferred the two fields here
  (Decision 9).
- Transitively settled: `songs.new_song` (NEW_SONG / NAME_AND_SAVE,
  `deriveSongFilename`, Decision 1: the module sits under `songs/` so both the
  Worker and the view reach it), `songs.save_sheet` (PREVIEW_SAVE /
  SAVE_PREVIEW, the *Name this song* prompt for a title-less song, acceptance
  7), `books.file_view` (the file view, used by nothing new here).

## What this task is

When a new song is saved for the first time, the save sheet/dialog shows,
above the note, two read-only fields as W03#4 draws them: **Book** — the book
the song goes into — and **File name** — the exact file name the Worker will
give it, including the `-2`, `-3` collision suffix when the folder already
holds that name — with the hint *Named once, from the title. Changing the
title later edits its heading, not the file.* To make the shown name the one
the save takes, the Worker's SAVE_PREVIEW reply carries, for a never-saved
path, the name NAME_AND_SAVE would take, and both are computed by one pure
function.

## Why it needs to be done

Workflow 3 §Its file name says a new song is named once, at the first save,
and never renamed afterwards (DIRECTION §4) — the first save is the only
moment the user can see the name before it is fixed. W03#4 draws it; the app
shows neither the book nor the name. `songs.editor_chrome` Decision 9 left it
here because the name must come from the Worker, which alone has the folder
listing. M5 (`tasks/99-milestones.tji` L44) depends on it.

## Inputs / context

- **Workflow 3** `docs/workflows/03-write-a-new-song.md`: §Which book L25-33
  (the book shown above the editor, changeable until the first save; a book
  the user cannot push to is never offered); §Its file name L35-48 (named at
  the first save, from the title as it is then; ASCII fold; *a name taken in
  the same folder gains `-2`, `-3`*); §The first save L97-107, with this
  task's delta L104-107.
- **W03 board** `docs/mockups/W03-write-a-new-song.dc.html` L176-197 (frame 4,
  `e2e/web/lib/mockup-frames.json` L117-120, *the first save names the
  file*): heading *Save “Coração de Estrada”*; field **Book** (`.input`
  showing *My songs* ▾, L179-182); field **File name** — `.input t-mono` on
  `--surface-2` (read-only look), `coracao-de-estrada.cifra.md`, with
  `t-small` *Named once, from the title. Changing the title later edits its
  heading, not the file.* (L183-187); **Note** (L188-191); *Keep editing* ·
  *Save*.
- **DIRECTION §4** L446-448 — the app never renames a song's file.
- `app/src/songs/song-filename.js` — `slugify`, `deriveSongFilename(title,
  existing)` (L56-82); its unit tests `app/src/songs/song-filename.test.js`
  L10-56.
- `app/src/worker/logic.js`:
  - `folderNames(bookId, folder)` L961-971 (the folder listing);
  - PREVIEW_SAVE handler L1784-1793 — calls `ensureSavePreview().preview()`
    and posts SAVE_PREVIEW `{ bookId, previews }`;
  - NAME_AND_SAVE handler L3210-3237 — parses the working copy's title, falls
    back to the prompted `title`, computes the collision set as *the folder's
    names minus the placeholder itself* (L3229-3236) and `toPath =
    prefix + deriveSongFilename(title, names)`.
- `app/src/worker/save-preview.js` L33-110 — `createSavePreview`; a preview
  entry is `{ path, title, changes, summary, isNew }` (L86-92).
- `app/src/worker/protocol.js` L242-248 (PREVIEW_SAVE) and L612-619
  (SAVE_PREVIEW) — the payload comments to update.
- `app/src/songs/SaveSheet.jsx`: `SaveForm` L54 (props `bookId, isNew,
  fromPath, titleHint`), `needsSongName` L92, the *Name this song* field
  L152-158, *What changed* L160; `SaveSheet` takes a `bookLabel` prop (L321)
  that only the make-it-your-own body uses (L249).
- `app/src/songs/NewSongHost.jsx` L93-102 — renders `SaveSheet` for a new
  song without `bookLabel`; `WhichBook` (`app/src/songs/WhichBook.jsx` L46-48)
  names the book with `bookLabelFor(shelf, bookId)` from
  `app/src/songs/first-run.js`.
- `app/src/i18n/locales/en.js` L1009-1024 (`saveSheet.*`, incl.
  `songNameHelp` *Used for its title and its file name.*), and `es-419.js`,
  `it.js`, `pt-BR.js`.
- Tests to extend: `app/src/worker/save-preview.behavior.test.js` (L88-121,
  PREVIEW_SAVE), `app/src/worker/new-song.behavior.test.js` (L198-236,
  NAME_AND_SAVE), `app/src/songs/SaveSheet.behavior.test.jsx` (L124-185, the
  never-saved cases), `e2e/web/tests/new-song.spec.js` L189-223 (*the header
  follows the first heading, and the first save is a dialog on tablet and
  computer*, which captures W03#4 at L214).
- Predecessor refinement `tasks/refinements/songs/editor_chrome.md`
  (Decision 3: the first save on a computer is a centred dialog; Decision 9).

## Constraints / requirements

1. **One computation of the name.** The file name the preview shows and the
   one NAME_AND_SAVE takes come from the same pure function — a new
   `firstSaveName({ fromPath, title, folderNames })` in
   `app/src/songs/song-filename.js` returning `{ path, fileName, taken }`,
   where `taken` is `folderNames` minus the placeholder's own name and
   `fileName = deriveSongFilename(title, taken)`. NAME_AND_SAVE's inline
   computation (logic.js L3229-3237) is replaced by a call to it; PREVIEW_SAVE
   calls it too. Behavior of NAME_AND_SAVE does not change.
2. **SAVE_PREVIEW carries it, for never-saved paths only.** In the
   PREVIEW_SAVE handler, after `preview()`, each entry with `isNew: true`
   gains `fileName` (the bare name, e.g. `mare-mansa-2.cifra.md`) and `taken`
   (the collision set, an array of names). Saved songs' entries are unchanged
   — `save-preview.js` stays a pure HEAD/working-copy diff reader. The read
   happens under the same Worker command; still no commit, no push.
3. **The name follows the title.** The dialog shows
   `deriveSongFilename(songName, taken)` while the *Name this song* prompt is
   in use (a title-less song) and the user has typed into it — so the name
   updates per keystroke without a Worker round trip, as `song-filename.js`'s
   both-sides design intends (new_song Decision 1) — and `preview.fileName`
   otherwise. With an empty prompt, it shows `preview.fileName` (the
   `untitled[-N]` name the Worker would take).
4. **Book is the target book's shelf label**, `bookLabelFor(shelf, bookId)`,
   passed by `NewSongHost` as `bookLabel` (the existing `SaveSheet` prop).
   Both fields are **read-only** and shown only for `isNew`; a saved song's
   sheet/panel is unchanged.
5. **Field order as W03#4:** (the author-name prompt and *Name this song*
   when needed), **Book**, **File name** with its hint, *What changed*, Note,
   actions. The existing *What changed* rows stay (workflow 4 §Saving: every
   save shows what changed) — see Decision 4.
6. **Accessibility.** Each field is labelled and reachable by assistive tech:
   a read-only RAC `TextField` (`isReadOnly`) with `Label` and `Input`, the
   hint as its `Text slot="description"`, so the name is announced with its
   label and hint; the file name is in `t-mono`, read-only look on
   `--surface-2` as drawn. axe clean at WCAG 2.1 AA on sheet and dialog.
7. **Copy in four locales**: `saveSheet.bookLabel` (*Book*),
   `saveSheet.fileNameLabel` (*File name*), `saveSheet.fileNameHelp` (*Named
   once, from the title. Changing the title later edits its heading, not the
   file.*) in `en`, `es-419`, `it`, `pt-BR`. The file name itself is never
   translated.
8. **Standing rules.** The preview logs nothing (no title, no names — song
   text); the main thread never touches IndexedDB (the view only renders what
   SAVE_PREVIEW returns and runs the pure fold); offline the preview works as
   before (a local read).

## Acceptance criteria

Behavior: opening the first save of a new song shows *Book* with the book's
name and *File name* with the exact name the save gives the file — `-2` when
the folder holds that name already — and the hint; typing a name into *Name
this song* changes the file name as typed; after saving, the file has that
name.

Tests, by level:

- **unit** — `app/src/songs/song-filename.test.js`, new `describe('firstSaveName')`:
  - *"names a root song from its title, ignoring its own placeholder"* —
    `{ fromPath: 'untitled.cifra.md', title: 'Maré Mansa', folderNames:
    ['untitled.cifra.md'] }` → `fileName 'mare-mansa.cifra.md'`, `path` the
    same, `taken []`. *Pins:* workflow 3 §Its file name L37-45.
  - *"suffixes a name taken in the same folder"* — folder holds
    `mare-mansa.cifra.md` → `mare-mansa-2.cifra.md`; holding `-2` too →
    `-3`. *Pins:* workflow 3 L48.
  - *"keeps the folder prefix"* — `fromPath 'ensaios/untitled-2.cifra.md'` →
    `path 'ensaios/mare-mansa.cifra.md'`. *Pins:* workflow 3 L32-33.
  - *"a title whose slug is the placeholder's gains no suffix against it"* —
    `fromPath 'untitled.cifra.md'`, title `''` → `untitled.cifra.md`.
- **behavior (Worker)** — `app/src/worker/save-preview.behavior.test.js`, new
  `it('a never-saved song's preview carries the file name the first save will take, with the folder's suffix')`:
  commit a song `mare-mansa.cifra.md` at the book root (write, SAVE), then
  NEW_SONG, WRITE a purpose-written song `# Maré Mansa` to the
  placeholder, PREVIEW_SAVE → the entry has `isNew: true`, `fileName
  'mare-mansa-2.cifra.md'` and `taken` containing `mare-mansa.cifra.md`; a
  saved path's entry has no `fileName`; then NAME_AND_SAVE → SAVED `path`
  equals the previewed `fileName`. *Pins:* the note's *SAVE_PREVIEW carries
  the filename NAME_AND_SAVE would take*; workflow 3 L48. The existing
  `new-song.behavior.test.js` NAME_AND_SAVE tests stay green over the
  refactor (Constraint 1).
- **behavior (view)** — `app/src/songs/SaveSheet.behavior.test.jsx`:
  - *"a new song's first save shows Book and the previewed File name, with
    the hint"* — `isNew`, `bookLabel 'My songs'`, SAVE_PREVIEW with
    `fileName 'tarde-clara-2.cifra.md'` → textbox *Book* reads *My songs*,
    textbox *File name* reads `tarde-clara-2.cifra.md`, both read-only, the
    hint is the field's description; axe clean. *Pins:* W03#4 L179-187.
  - *"the file name follows the typed name"* — title-less preview (`title
    ''`, `fileName 'untitled.cifra.md'`, `taken ['mare-mansa.cifra.md']`):
    *File name* reads `untitled.cifra.md`; type *Maré Mansa* into *Name this
    song* → `mare-mansa-2.cifra.md`. *Pins:* the note's *the name follows
    the title*; `saveSheet.songNameHelp`.
  - *"a saved song's save shows neither field"* — the existing SAVE case
    asserts no *Book* / *File name* textbox. *Pins:* Constraint 4.
- **e2e-web** — `e2e/web/tests/new-song.spec.js`:
  - the existing test at L189 (*the header follows the first heading, and the
    first save is a dialog on tablet and computer*), extended: with the
    dialog open, *Book* reads *My songs* and *File name* reads
    `mare-mansa.cifra.md` with the hint, **before** `mockup(page,
    'W03-write-a-new-song', 4)`, so frame 4 shows the fields; `checkA11y()`
    already runs with the dialog open. Three viewports. *Pins:* W03#4;
    workflow 3 §The first save.
  - new test *"a second song with a taken title is named with -2"*: through
    the real UI, Create from search, write a song headed `# Maré Mansa`,
    save; Create again, the same heading, Save → *File name* reads
    `mare-mansa-2.cifra.md`; save; both are found by search under *Maré
    Mansa*; `checkA11y()` with the dialog open. Three viewports. Driven by
    existing journeys (`startApp`, `replaceSong` in `e2e/web/lib/`); *My
    songs* is a local book, so no service prerequisite. *Pins:* workflow 3
    L48.

No level the note names is dropped. Nothing is deferred.

## Decisions

1. **The preview carries `taken` as well as `fileName`.** The note asks for
   the name NAME_AND_SAVE would take; for a title-less song that name follows
   what the user types into *Name this song*, which lives only in the view.
   Rejected: re-sending PREVIEW_SAVE with the typed title on each keystroke
   (a Worker round trip and a full diff per keystroke, for one string), or
   showing a stale `untitled.cifra.md` while the help text says the typed
   name becomes the file name. Handing the view the collision set and the
   shared pure fold keeps it exact with no round trip — the reason
   `song-filename.js` sits under `songs/` (new_song Decision 1).
2. **One pure `firstSaveName` both commands call**, rather than the PREVIEW
   handler copying NAME_AND_SAVE's placeholder-exclusion logic. The two
   names agree by construction, and the behavior test checks they do.
3. **Book is shown, not chosen, in the dialog.** W03#4 draws a ▾ on the
   field; workflow 3 §Which book puts the choice on the line above the editor
   (`WhichBook`, *Change book*), and changing the book re-targets the
   placeholder and remounts the editor — not something to do under an open
   modal. A second picker would be two controls for one choice. The delta in
   workflow 3 L104-107 says so, so the board's ▾ is read as the field's look,
   not a second control.
4. **The *What changed* rows stay in the first save.** W03#4 draws none, but
   workflow 4 §Saving promises every save says what changed, and the
   all-added summary is what the note prefill is built from. Removing it is a
   change to designed behavior this task does not need.
5. **The fields are added in `SaveForm`, not a new component**: two
   read-only fields for one case (`isNew`) in the one form all three
   presentations share (editor_chrome Decision 3), so the phone sheet gets
   them too — the board draws only the computer, and one form keeps one
   behavior.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-18.

- `app/src/songs/song-filename.js`: pure `firstSaveName`, the one function giving both PREVIEW_SAVE and NAME_AND_SAVE the file name (deriveSongFilename plus the folder's `-2`, `-3` suffix); unit cases in `song-filename.test.js`.
- `app/src/worker/logic.js`, `protocol.js`: SAVE_PREVIEW for a never-saved song carries the file name and the folder's taken names; NAME_AND_SAVE saves under the previewed name. Behavior test in `app/src/worker/save-preview.behavior.test.js`.
- `app/src/songs/SaveSheet.jsx`, `save-sheet.css`, `NewSongHost.jsx`: read-only Book and File name with the hint on the phone sheet and the dialog; the name follows the title typed into *Name this song*. Behavior tests (with axe) in `SaveSheet.behavior.test.jsx`.
- `app/src/i18n/locales/{en,es-419,it,pt-BR}.js`: the new labels and hint.
- `e2e/web/tests/new-song.spec.js`: W03#4 with the fields, and a second song with a taken title named with `-2`, on phone, tablet and computer with axe.
- `docs/workflows/03-write-a-new-song.md` §The first save: design delta.
- No tech-debt follow-ups.

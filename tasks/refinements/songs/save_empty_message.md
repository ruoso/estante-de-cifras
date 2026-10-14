# songs.save_empty_message — A save with no musical summary commits instead of hanging

## TaskJuggler entry

`task save_empty_message` in [`tasks/60-songs.tji`](../../60-songs.tji)
(lines 98–103), under `task songs`, `depends !save_sheet, books.file_view`.
Wired into `milestones.m5_complete` (`tasks/99-milestones.tji` line 44). The `.tji`
note, verbatim:

> "Saving a non-song file (README.md, .gitattributes), an unchanged song, or
> a song whose note the user cleared sends an empty message — the note is
> prefilled from the musical diff summary (app/src/songs/save-note.js:20),
> which is empty there — and isomorphic-git's commit throws
> (app/src/worker/working-copy.js:168, :236 nameAndSave). The Worker answers
> a generic ERROR the save sheet does not listen for, so the sheet stays open
> with no feedback. Reproduced on all three viewports by a raw edit of
> README.md in the file view and by restoring README.md from history. Fix: a
> non-empty default message in the Worker save path (e.g. naming the paths),
> and the save sheet surfaces a command failure instead of staying silently
> open. Source: tasks/parking-lot.md 2026-10-14 (Non-song/no-change file
> restore+save). Tests: unit (the default message); behavior (a blank note
> commits; a failed save shows its error; axe); e2e-web (README.md edited in
> the file view and saved, the sheet closes, on the three viewports; axe)."

The parking-lot entry it came from (*2026-10-06 — Non-song/no-change file
restore+save leaves the save sheet open*) was triaged into this leaf by commit
`799f87d`.

## Effort estimate

**0.5 day** (from the `.tji`). `allocate team`.

## Repository

**estante-de-cifras** only, in `app/` and `e2e/web/`:

- `app/src/songs/save-note.js` + `save-note.test.js` — a pure
  `defaultSaveMessage(paths)` beside `buildSaveNote`, and `buildSaveNote`
  falling back to it per preview when a summary is empty.
- `app/src/worker/logic.js` — the `SAVE` and `NAME_AND_SAVE` cases: a blank
  (empty or whitespace-only) note becomes the default; a throw inside either
  save answers `SAVE_REFUSED {reason: 'failed'}` instead of falling through to
  the generic `ERROR`.
- `app/src/songs/SaveSheet.jsx` — the refusal alert gains the `'failed'`
  reason's copy.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — one new key,
  `saveSheet.failed`.
- `app/src/worker/working-copy.behavior.test.js` (extend),
  `app/src/songs/SaveSheet.behavior.test.jsx` (extend).
- `e2e/web/tests/file-view.spec.js` (extend).

Not a `cifra.md:` task; nothing in the format changes.

**Design delta (same commit).**
[`docs/workflows/04-edit-and-save.md`](../../../docs/workflows/04-edit-and-save.md)
§Saving gains one paragraph (after the two-bullet list, before *Confirming
commits the one file…*): with no musical summary the note is prefilled with
*Update README.md* (the file it saves); a cleared note commits with that same
line; a save that cannot be made says *Not saved* on the sheet and keeps the
changes. Workflow 4 previously said only "a note, prefilled from that
summary", which left the empty-summary case undecided — the gap this task
closes.

## Inherited dependencies

- **`songs.save_sheet` — settled** (`complete 100`, `tasks/60-songs.tji`
  line 46; [`save_sheet.md`](./save_sheet.md)). Delivers `SaveSheet.jsx`,
  `buildSaveNote`, `PREVIEW_SAVE`/`SAVE_PREVIEW`, the `SAVE_REFUSED` alert,
  and Decisions 3 (the note is the diff's neutral English, not localized) and
  5 (`NAME_AND_SAVE` takes an optional `message`, absent → *Add {title}*).
- **`books.file_view` — settled** (`complete 100`, `tasks/65-books.tji`
  line 81; [`../books/file_view.md`](../books/file_view.md)). Delivers the
  file view, its raw editor for `README.md`, the book's history with
  per-file restore, and `e2e/web/tests/file-view.spec.js` with the
  `seedExampleBook` / `fileRow` / `backToTree` / `confirmSave` helpers.

Every test named below is driven by what these two deliver plus the example
book, which already holds a `README.md` (`app/example-book/README.md`,
`app/src/worker/example-book.js:28`). No account, hosted book or second
device is involved — the failure is local to the commit.

## What this task is

Make every save produce a commit message, and make a save that fails say so.
Today the save sheet prefills its note from the musical diff's summary; for
a file that is not a song (`README.md`), or a save with no musical change,
that summary is `''`, and a user may also clear the note by hand. The empty
string reaches isomorphic-git's `commit`, which throws
`MissingParameterError('message')` when `!message`
(`app/node_modules/isomorphic-git/index.js:6435-6437`). The throw escapes the
`SAVE` case to the Worker's catch-all, which posts a generic
`ERROR {code: 'command_failed'}` (`app/src/worker/logic.js:2460-2468`) that
the sheet never hears, so it stays open, silent. This task (1) gives the save
a default message naming the paths it saves, both prefilled on the sheet and
enforced in the Worker, and (2) turns any throw inside a save into a
`SAVE_REFUSED` the sheet already listens for, shown with a *Not saved* line.

## Why it needs to be done

Workflow 14 promises that a raw edit or a restore in the file view is "saved
like any other (workflow 4)" (`docs/workflows/14-file-view.md` L149-158), and
`README.md` is the one non-song text file every book has (L27, L177). As it
stands, a user who edits the book's README or restores it from the log can
never save it — and is not told. The same hang hits a song saved with its
note cleared. It is in `milestones.m5_complete`'s `depends`, so M5 does not close without
it.

## Inputs / context

- **Workflow 4 §Saving** (`docs/workflows/04-edit-and-save.md`, the note
  bullet and the new paragraph added by this task's delta) — the note
  prefilled from the summary, a save never without a message, *Not saved* on
  failure.
- **Workflow 3 §The first save** (`docs/workflows/03-write-a-new-song.md`
  L99) — the precedent default message *Add {title}*, implemented at
  `app/src/worker/logic.js:2203` as `message: note || \`Add ${title ||
  'untitled'}\``.
- **Workflow 14** (`docs/workflows/14-file-view.md`) L73 (`README.md` is not
  a song but is held to the text rules), L149-158 (edit, then save like any
  other; several files in one commit).
- `app/src/songs/save-note.js:17-28` — `buildSaveNote(previews)`; L20 returns
  `list[0]?.summary ?? ''`. Unit tests in `save-note.test.js` L9, L14, L25,
  L34.
- `app/src/worker/save-preview.js:31` — each preview is `{path, title,
  changes, summary, isNew}`; the `path` is what the fallback names.
- `app/src/worker/logic.js` — `SAVE` case L974-1030 (destructures `message:
  note`, calls `ensureWorkingCopy().save({…, message: note, …})` at ~L988,
  posts `SAVE_REFUSED` at ~L996); `NAME_AND_SAVE` ~L2180-2215 (the `Add
  {title}` fallback, `SAVE_REFUSED` at ~L2208); the catch-all `ERROR` at
  L2460-2468.
- `app/src/worker/working-copy.js:123-189` (`save`) and `:202-255`
  (`nameAndSave`) — both pass `message` straight to `gitCommit` (L168,
  L236). Unchanged by this task (Decision 2).
- `app/src/worker/reducer.js:218-236` — `SAVE_REFUSED` sets
  `save[bookId] = {status: 'refused', path, reason, line, marker}`; a new
  reason value passes through unchanged.
- `app/src/songs/SaveSheet.jsx` — `defaultNote = buildSaveNote(previews)`
  (L79), `noteValue = note ?? defaultNote` (L90), `confirm()` (L96-118) sends
  `SAVE`/`NAME_AND_SAVE` with `message: noteValue`, `SAVED` closes (L67-69),
  `SAVE_REFUSED` sets `refused` (L70-72), the alert at L170-176 (`notice
  conflict est-save-refused`, `role="alert"`).
- `app/src/i18n/locales/en.js` L668-693 — `saveSheet.refused`,
  `saveSheet.refusedMerge`; the same keys in `pt-BR.js`, `es-419.js`, `it.js`
  (~L603).
- `app/src/files/FileView.jsx` — `onEditorSave` (L131-137) and `RESTORED`
  (L96-100) both open `SaveSheet` for one path; L298-308 renders it.
- `app/src/books/UploadPreview.jsx:164-172` — the one component that
  attributes a generic `ERROR` to its own command via in-flight refs
  (rejected as the pattern here, Decision 3).
- Tests to extend: `app/src/worker/working-copy.behavior.test.js` (the
  in-process `createWorkerLogic` rig over fake IndexedDB, real git; cases
  L205 one-file SAVE, L449 refused marked text);
  `app/src/songs/SaveSheet.behavior.test.jsx` (store double `makeStore()`
  L30-36, `preview()` L50, `withName()` L77; refusal case L80);
  `e2e/web/tests/file-view.spec.js` (helpers L36-92; the restore test
  L148-183).

## Constraints / requirements

- **The note is the commit message, neutral English, not localized**
  (save_sheet Decision 3). The default is too: *Update README.md*, the same
  on every device and locale.
- **The Worker owns the commit** (DIRECTION §3.7): the Worker's fallback is
  the guarantee; the sheet's prefill only shows the user what it will be.
  `defaultSaveMessage` is a pure function in `app/src/songs/save-note.js`,
  imported by the Worker the way `logic.js` already imports
  `../songs/song-filename.js` (L46) — one definition, two call sites.
- **No song text in logs.** The failure path posts an event; it does not
  `console` the error, the note, or the path's content. The `SAVE_REFUSED`
  payload carries `bookId`, `path` and `reason` only — not `err.message`.
- **A failed save leaves the working copy as it was** (offline-first: nothing
  the user typed is lost); the sheet stays open with Save enabled, so a
  second confirm retries.
- **Accessibility**: the failure is a word (*Not saved…*) in the existing
  `role="alert"` paragraph, never colour alone; no new interactive control.
- **Canonical form is untouched**: the save still canonicalises every path
  before committing; this task changes only the message and the failure
  report.

## Acceptance criteria

### Behavior delivered

1. `defaultSaveMessage(paths)` returns `Update <path>` for one path and
   `Update <path>, <path>, …` for several (book-relative paths as given,
   in the given order); for no paths, `Update`.
2. `buildSaveNote(previews)` never returns `''` for one or more previews:
   - one preview with an empty summary → `defaultSaveMessage([path])`;
   - in *save all*, an entry whose summary is empty contributes
     `Update <path>` (no title prefix); entries with a summary are unchanged
     (`Title: summary`);
   - no previews → `''` (unchanged; the sheet has nothing to save).
3. The Worker's `SAVE` commits with the note when it has non-whitespace
   content, else with `defaultSaveMessage(paths)`. `NAME_AND_SAVE`'s existing
   *Add {title}* fallback also treats a whitespace-only note as blank.
4. Any throw inside the `SAVE` or `NAME_AND_SAVE` case (after the
   merge-in-progress check) is caught there and answered with
   `SAVE_REFUSED {bookId, path: paths[0] ?? fromPath ?? null, reason:
   'failed', marker: null, line: null}`, not the generic `ERROR`.
5. The save sheet shows, for `reason: 'failed'`, *"Not saved. Something went
   wrong writing it to this device. Your changes are still here — save
   again."* (`saveSheet.failed`, translated in all four locales), keeps the
   sheet open, and Save stays enabled; a second confirm sends the command
   again.
6. Editing `README.md` in the file view and saving closes the sheet and
   commits *Update README.md*; restoring `README.md` from the book's history
   and saving does the same (the parking-lot reproductions).

### Tests the task lands with, by level

- **unit** — `app/src/songs/save-note.test.js` (extend):
  - `defaultSaveMessage` — one path → `Update README.md`; several paths →
    comma-joined in order (workflow 4 §Saving, the new paragraph);
  - `buildSaveNote` — a single preview with an empty summary (`README.md`)
    → `Update README.md`; *save all* mixing a song with a summary and a
    `README.md` with none → `Title: summary; Update README.md`; the existing
    "no previews → empty note" case stays green.
- **behavior** — `app/src/worker/working-copy.behavior.test.js` (extend,
  the in-process Worker over fake IndexedDB and real git):
  - *"SAVE with a blank note commits with Update <path> (workflow 4
    §Saving)"* — edit `README.md` in a seeded book, `SAVE` with `message:
    ''`, expect `SAVED` and HEAD's commit message `Update README.md`; again
    with `message: '   '` on a song, expect `Update <song path>`;
  - *"a SAVE that throws answers SAVE_REFUSED failed, not ERROR (workflow 4
    §Saving)"* — drive a save that throws inside the case without a
    test-only seam: a `SAVE` naming a bookId with no repository on the device
    (or, if that path does not throw in the real code, a path that is a
    directory in the book); expect `SAVE_REFUSED` with `reason: 'failed'` and
    no `ERROR` event; the working copy unchanged.
- **behavior** — `app/src/songs/SaveSheet.behavior.test.jsx` (extend,
  Testing Library + axe):
  - *"a save with no musical summary prefills Update <path> and sends it"* —
    `SAVE_PREVIEW` for `README.md` with `summary: ''`; the note field reads
    `Update README.md`; confirm sends `SAVE` with that message;
  - *"a cleared note still sends SAVE"* — clear the note, confirm, `SAVE` is
    sent (the Worker supplies the default; Save is not disabled by a blank
    note);
  - *"a failed save says Not saved and stays open for another try"* — emit
    `SAVE_REFUSED {reason: 'failed'}`; the `role="alert"` reads the
    `saveSheet.failed` copy, the dialog stays, Save is enabled, a second
    click sends `SAVE` again; axe clean on the sheet with the alert.
- **e2e-web** — `e2e/web/tests/file-view.spec.js` (extend; runs on the
  phone, tablet and computer projects; axe via the `checkA11y` fixture):
  - *"README.md edited in the raw editor and saved closes the sheet and
    commits Update README.md"* — `seedExampleBook`, open the file view, open
    `README.md`, type a line into the raw editor, Save; the note reads
    `Update README.md`; `checkA11y()` on the open sheet; `confirmSave` (the
    sheet hides); the book's history lists a version *Update README.md*
    (workflow 14 L149-158; workflow 4 §Saving);
  - *"README.md restored from the book's history and saved closes the
    sheet"* — after the edit above, open History, the oldest commit, *Restore
    this version* on the `README.md` row, `confirmSave` (the sheet hides)
    (workflow 14 L169-173).

### Deferred work

(none — the task is complete as scoped.)

## Decisions

1. **Default message: `Update <paths>`, neutral English, shown in the note
   and enforced in the Worker.** It names what the commit carries, in the
   form git hosts use for a one-file web edit, and mirrors workflow 3's *Add
   {title}*. Prefilling it on the sheet means the user sees the message they
   are about to keep; the Worker fallback covers a cleared note and any other
   caller. *Rejected:* a fallback only in the Worker (the sheet would show an
   empty note that is not what is committed); disabling Save on a blank note
   (makes the user write a message for a README typo, against workflow 4's
   two-tap save); localizing it (save_sheet Decision 3 — commit messages are
   shared across locales); using the title instead of the path (a README's
   or `.gitattributes`'s title is not what changed; the path is unambiguous
   for every kind).
2. **The fallback lives in `logic.js`, not in `working-copy.js`.** The
   command handler is where `NAME_AND_SAVE`'s *Add {title}* already lives;
   keeping both defaults beside each other keeps the working copy a plain
   "commit with this message" layer. *Rejected:* defaulting inside
   `working-copy.save` — splits the two defaults across layers.
3. **Failures answer `SAVE_REFUSED {reason: 'failed'}`, caught in the
   case.** The sheet, the reducer and the alert already handle
   `SAVE_REFUSED` keyed by `bookId`; a new reason is one branch of copy.
   *Rejected:* making the sheet listen to the generic `ERROR` (it carries no
   command kind or book, so the sheet would have to guess with in-flight refs
   as `UploadPreview` does — and would misattribute an unrelated command's
   failure); a new `SAVE_FAILED` event kind (a second event, reducer branch
   and listener for what is, to the user, the same *not saved* outcome).
4. **The failure copy does not show the error text.** The user cannot act on
   isomorphic-git's message, and the payload stays free of anything a log
   could leak. The copy says what matters: not saved, changes kept, try
   again.
5. **`.gitattributes` and *an unchanged song* need no separate path.** Both
   reach the same empty summary → same default; the e2e journey uses
   `README.md` because the example book has one and the reproduction named
   it.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-14.

- `app/src/songs/save-note.js`: pure `defaultSaveMessage(paths)`; `buildSaveNote` falls back to it per empty summary (tests in `save-note.test.js`).
- `app/src/worker/logic.js`: `SAVE`/`NAME_AND_SAVE` treat a blank note as the default and answer a throw with `SAVE_REFUSED {reason: 'failed'}` instead of `ERROR`.
- `app/src/songs/SaveSheet.jsx` and `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: the `saveSheet.failed` "Not saved" alert; the sheet stays open and can retry.
- Behavior: `app/src/worker/working-copy.behavior.test.js`, `app/src/songs/SaveSheet.behavior.test.jsx` (with axe).
- e2e-web: `e2e/web/tests/file-view.spec.js` (README.md edit and restore, saved; phone, tablet, computer; axe).
- Design delta: `docs/workflows/04-edit-and-save.md` §Saving.
- No tech debt.

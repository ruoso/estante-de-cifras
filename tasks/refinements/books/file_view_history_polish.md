# books.file_view_history_polish — The file view's history and rename as drawn

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task file_view_history_polish` (L170-175):

> From W14: the rename dialog does not list the links it will update (workflow
> 14 rename keeps setlists pointing at the song); the computer history detail
> has no commit heading or message line. Source: UI pairwise audit 2026-10-14
> (e2e mockup() screenshots vs rendered boards, audit/out). Tests: behavior
> (rename lists the setlists it updates; the commit heading; axe); e2e-web
> (mockup W14#3-4).

Milestone: listed in `tasks/99-milestones.tji` L44 with the other UI-audit polish tasks.

## Effort estimate

1d. The work is:

- a pure `linksTo` in `setlist-links.js` (sharing its position-finding with `relinkSetlists`), and its unit cases;
- one read-only Worker command, `FILE_LINKS`, with its working-copy read and a Worker behavior case;
- the rename dialog listing those links, and the commit detail gaining its heading, message body and full date;
- one new copy key in four locales;
- extensions to the existing behavior and e2e-web tests.

## Repository

The work lands in **estante-de-cifras**, not under `cifra.md/`:

- `app/src/worker/setlist-links.js`, `app/src/worker/setlist-links.test.js`
- `app/src/worker/working-copy.js`, `app/src/worker/logic.js`, `app/src/worker/protocol.js`, `app/src/worker/file-ops.behavior.test.js`
- `app/src/files/FileView.jsx`, `app/src/files/RenameFileDialog.jsx`, `app/src/files/BookHistory.jsx`, `app/src/files/CommitDiff.jsx`, `app/src/files/file-view.css`, `app/src/files/FileView.behavior.test.jsx`
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`
- `e2e/web/tests/file-view.spec.js`

There is **no design delta**. Workflow 14 (rename updates the links to a song in the book's setlists; history shows each commit's message, author, date, hash and files) and the W14 board (tablet #3, computer #4) already decide everything here. The task makes the app match them.

## Inherited dependencies

- `books.file_view`: **settled** (`complete 100`, `tasks/refinements/books/file_view.md`). It delivered `FileView.jsx`, `RenameFileDialog.jsx`, `BookHistory.jsx`, `CommitDiff.jsx`, `MOVE_FILE` with the setlist relink (`relinkSetlists`, Decision 2), `COMMIT_DIFF` (Decision 4) and `file-view.spec.js`.
- Also settled, though not in `depends`: `books.setlists` (the setlist format round-trip the relink uses), `songs.history` (`LineDiffView`, and the `est-history-detail-head` pattern in `SongHistory.jsx` L505-510).
- `books.file_view_create_menu` (pending, also from the W14 audit) touches the tree's New menu and the phone's file header, not the rename dialog or the history. The two tasks do not overlap.

## What this task is

The audit put the e2e captures of W14#3 and W14#4 next to the board and found two gaps.

**1. The rename dialog does not say which links it updates.** W14 tablet #3 (`docs/mockups/W14-file-view.dc.html` L133-153) draws, under the name field, an accent notice: bold **"Links to it are updated in the same save"**, then one mono line per link, `gigs/ensaio-de-quinta.setlist.md · item 3` (L144-147). The app's notice (`RenameFileDialog.jsx` L83-87) is the bold sentence only, shown for every rename: a song no setlist links to, and even a setlist, which relinks nothing (`working-copy.js` L338-341). Nothing computes the links before the rename: `relinkSetlists` (`setlist-links.js` L42-67) finds the matching item positions but only returns rewritten texts, and only inside `move`.

This task lists, in the dialog, each setlist item that links to the song being renamed, as `<setlist path> · item <n>`, and shows the notice only when there is at least one.

**2. The open commit has no heading.** W14 computer #4 (L199-226) draws the open commit with the commit's message as its heading (`h2.t-h1`, *"Tarde Clara: Em → Em7 in the first part"*, L201), then the line *"Rafael Lima · 2 October 2026, 21:14 · a41c9e2 · 2 files"* (L202), then the per-file diffs. The app's `CommitDiff` (L15-37) starts at the meta line, and `BookHistory`'s `dateLabel` (L21-30) gives day and month only.

This task gives the open commit its heading (the message's first line), the rest of the message under it when the message has more lines, and the board's full date and time in the meta line, on every width (the phone's one-at-a-time detail renders the same `CommitDiff`).

## Why it needs to be done

The 2026-10-14 pairwise audit found W14#3 without the links and W14#4 without the commit's heading.

Workflow 14 L151-153 makes rename the one place that rewrites other files of the book for you: a person renaming a song should see which setlists will change before they confirm, not discover a rewritten setlist in the save sheet. A sentence promising "links are updated" over a song with no links, or over a setlist, says something untrue.

Workflow 14 L169-172 says each commit shows its message. In the open commit, the message is what says which change this is; without it the detail pane reads as an anonymous diff.

This is one of the M5 polish leaves in `tasks/99-milestones.tji` L44. No later task depends on it.

## Inputs / context

- **Workflow 14, `docs/workflows/14-file-view.md`:**
  - L151-153: "**Rename** and **move**, which update the links to a song in the book's setlists (workflow 12). A name keeps its kind…"
  - L157-158: each is a change to the working copy, saved like any other.
  - L169-172: every commit, newest first, merges marked; "Each shows its message, author, date, a short hash, and the files it touched."
  - L174-176: opening one shows each file's line diff, with *restore this version*.
  - L137-138: laid out for a wide screen first, one pane at a time on a phone.
- **Board W14, `docs/mockups/W14-file-view.dc.html`:**
  - tablet #3, L90-155; the rename dialog L133-153: heading *Rename song* (L135), label *Name, in mpb/* (L137), the pinned suffix (L140), the hint (L142), the accent notice L144-147 (bold sentence, then `gigs/ensaio-de-quinta.setlist.md · item 3` in mono, L146), *Cancel* / *Rename* (L149-150).
  - computer #4, L157-231 (data L322-350): the open commit's `h2.t-h1` heading L201, the `t-small` meta line L202 with the hash in mono, per-file path + *Restore this version* + diff L207-218, the restore caption L226.
- **Frame numbering:** `e2e/web/lib/mockup-frames.json` L380-403: W14 #3 is the tablet, #4 the desktop. `mockup(page, board, index, { note })` is in `e2e/web/lib/mockup.js`; it captures only in the project whose device matches the frame, and only with `ESTANTE_E2E_MOCKUPS` set.
- **DIRECTION §4** (`docs/DIRECTION.md` L507-510): the file view shows the book as git sees it, "the book's log with the files each commit touched, and plain line diffs. Renaming, moving and deleting files happen only here." §3.7: the Worker owns the working copy; the main thread never touches IndexedDB.
- **`app/src/worker/setlist-links.js`:**
  - `resolveToBookRoot(dirSegments, relPath)` L17-29 (a setlist item's path is relative to the setlist's own folder and may hold `..`);
  - `relinkSetlists({ setlists, fromPath, toPath })` L42-67; the 0-based `positions` loop at L48-57 counts `song` and `unlinked` items in document order and matches only `song` items.
- **`app/src/worker/working-copy.js`:** `readSetlists(dir)` L297-309 (every `*.setlist.md` still in the working tree, with its text); `move()` L318-353 under `locks.withLock`.
- **`app/src/worker/logic.js`:** `MOVE_FILE` L2024-2043, `COMMIT_DIFF` L2058-2064 — the shape of a local, offline read command (destructure payload, call the working-copy/history module, post one event).
- **`app/src/worker/protocol.js`:** the file-view commands documented at L292-305 (`BOOK_TREE`, `MOVE_FILE`, `DELETE_FILE`, `COMMIT_DIFF`), the events at L616-628 (`TREE`, `FILE_MOVED`, `FILE_DELETED`, `COMMIT_DIFF`, transient, no slice).
- **`app/src/files/FileView.jsx`:** `rename = { path, kind }` state (L62), `doRename` → `MOVE_FILE` (L148-150), `FILE_MOVED` handling (L108-113), the dialog mount (L332-337).
- **`app/src/files/RenameFileDialog.jsx`:** props `{ isOpen, onClose, file, onRename }` (L14), `RenameForm` (L48), the notice L83-87. CSS `.file-rename-*` in `app/src/files/file-view.css` L59-88 (`.file-rename-notice` at L84).
- **`app/src/files/BookHistory.jsx`:** `subjectOf` L17-19, `dateLabel` L21-30, `openEntry` (the log entry with `message`, `short`, `author`, `timestamp`, `files`) L133-136, `meta` L137-144, `diffPane` → `<CommitDiff meta files onRestore>` L183-194, wide split L196-209, narrow detail L213-222.
- **`app/src/files/CommitDiff.jsx`:** `{ meta, files, onRestore }` L15; the meta paragraph L18.
- **Precedent:** `app/src/songs/SongHistory.jsx` L505-510, a detail header of the version's note plus a `t-small` who · when line.
- **Copy, `app/src/i18n/locales/en.js`:** the `fileView` block L1250-1287: `linkNotice` L1264, `commitMeta` L1280 (`'{author} · {date} · {hash} · {files}'`), `commitFiles`, `emptyCommit`. pt-BR, es-419 and it carry the same keys.
- **Existing tests:**
  - `app/src/worker/setlist-links.test.js` (four cases, L20-61);
  - `app/src/worker/file-ops.behavior.test.js`: MOVE_FILE with relink (L250-295), cross-kind refusal (L296), COMMIT_DIFF (L360);
  - `app/src/files/FileView.behavior.test.jsx`: the store double `makeStore()` (L36-42, `sent` and `emit`), `renderView` (L44-50, `mode="wide"`), `seedTree` (L52); rename (L103-125, asserts only the sentence); history (L211-280, `BOOK_LOG` seeded with *Edit Valsa* and a merge, no heading assertion);
  - `e2e/web/tests/file-view.spec.js`: test 1 (L67-125) renames *the-ferry-line.cifra.md* to `ferry-crossing`, asserting the sentence and capturing W14#3 (L95-104); test 2 (L127-163) opens the oldest commit and captures W14#4 (L159).
- **Fixture:** `app/example-book/a-short-set.setlist.md` — item 2 is `[The Ferry Line](the-ferry-line.cifra.md)`, so renaming that song in e2e lists `a-short-set.setlist.md · item 2`. The bundled book's single commit is made with the message *Open example book* (`app/src/worker/example-book.js` L117), the oldest commit test 2 opens.

## Constraints / requirements

- **One rule for which items link to a song.** The positions the dialog lists and the positions `move` rewrites come from the same pure function, so what the dialog promises is what the save does. `relinkSetlists` is refactored to call it; its four existing unit cases stay green unchanged.
- **The item number is the reader's.** `item` is 1-based, counting every item of the setlist (`song` and `unlinked`) in document order — the number the setlist shows (`1.`, `2.`, …), as the board's `item 3` reads.
- **Paths are book-root.** The listed setlist path is its book-root path (`gigs/ensaio-de-quinta.setlist.md`), as the board draws; an item's link is resolved against its setlist's folder before comparing (memory: setlist item paths are folder-relative).
- **The Worker owns the read.** The view asks the Worker (`FILE_LINKS`); it never reads setlist text itself. The read takes the book's lock (so it does not interleave with a write or a move), writes nothing and posts one event. Local and offline, like `BOOK_TREE`.
- **Only songs have links.** The view sends `FILE_LINKS` only when the dialog opens on a song. A setlist rename shows no notice (a moved setlist relinks nothing, `working-copy.js` L338-341).
- **The notice appears only with links.** When the reply lists at least one item, the notice shows the bold sentence and one line per item; when it lists none, there is no notice. Until the reply arrives, no notice (the read is local; a flash of a wrong "no links" state is avoided by not drawing one). The dialog does not wait on the reply: *Rename* is enabled throughout, and `move` relinks whatever links exist when it runs.
- **The commit heading is the message.** The open commit's heading is its subject (the message's first line), as a level-2 heading with the board's `t-h1` style. If the message has more lines, the rest (trimmed, blank-line runs kept as paragraphs) follows as `t-small`-or-body text under the heading, before the meta line. A merge's heading is its message too (*Merge*, as the board's row reads); the merge badge stays in the list.
- **The full date.** The meta line keeps `fileView.commitMeta`'s order, with the date formatted in the current locale as day, long month, year, hour and minute (the board's *2 October 2026, 21:14*), and the hash in mono as the board draws. The list rows keep their short day-month date.
- **The heading on every width.** `CommitDiff` renders the heading and body, so the wide pane and the narrow one-at-a-time detail both carry them.
- **Accessibility.** The link lines are a plain list inside the notice (`ul`, not RAC-interactive: nothing in it is pressable); the dialog keeps its `Heading slot="title"`; the commit heading is a real `h2` so the open commit is reachable by heading navigation. axe stays clean at WCAG 2.1 AA in every new state. Nothing is carried by colour.
- **No song text in logs.** The new command logs nothing of a setlist's text or of the commit message.
- **Copy.** One new key, `fileView.linkItem: '{path} · item {item}'`, in all four locales (pt-BR *"{path} · item {item}"*, es-419 *"{path} · elemento {item}"*, it *"{path} · voce {item}"*). The heading and body are the commit's own text; no other new copy.

## Acceptance criteria

### Behavior delivered

1. **The rename dialog lists the links it will update.** Opening *Rename* on a song that setlists link to shows the accent notice: **Links to it are updated in the same save**, then one mono line per linking item, `<setlist path> · item <n>`, in path order then item order (W14 tablet #3 L144-147). Renaming then rewrites exactly those items (unchanged `move`).
2. **No promise without links.** Renaming a song no setlist links to, or a setlist, shows no link notice.
3. **The open commit has its heading.** Opening a commit in the book's history shows its message's first line as a heading, any further lines of the message under it, then *author · 2 October 2026, 21:14 · hash · n files*, then the per-file diffs (W14 computer #4 L201-202), on the wide pane and on the phone's detail alike.

### Tests, by level

The note names **behavior** and **e2e-web**. A **unit** level is added for the pure `linksTo` (Decision 1), and the Worker side of `FILE_LINKS` gets a **behavior** case in the Worker harness. No level is dropped.

- **unit — `app/src/worker/setlist-links.test.js`**, a new `linksTo` describe, with setlists written for the purpose:
  - *a song linked from two setlists*: returns `[{ setlist, item }]` for each, book-root setlist paths, 1-based items;
  - *folder-relative links*: a setlist in `gigs/` linking `../mpb/valsa.cifra.md` matches `mpb/valsa.cifra.md`; a same-named song in another folder does not match;
  - *unlinked items count*: in a setlist whose first item is unlinked, the linked song is `item 2`;
  - *the same song twice in one setlist*: both items are listed;
  - *no links*: `[]`;
  - the four existing `relinkSetlists` cases pass unchanged (the shared position rule).

  *Pins:* workflow 14 L151-153; workflow 12 (an item's link is relative to its setlist's folder).
- **behavior (Worker) — `app/src/worker/file-ops.behavior.test.js`**, a new case beside MOVE_FILE: in a working copy holding `mpb/valsa.cifra.md` and `gigs/ensaio.setlist.md` linking it as item 3 (and a deleted-but-unsaved setlist linking it too), `FILE_LINKS { bookId, path: 'mpb/valsa.cifra.md' }` replies `FILE_LINKS { bookId, path, links: [{ setlist: 'gigs/ensaio.setlist.md', item: 3 }] }` — the deleted setlist skipped — and the working tree's status is unchanged (nothing written). *Pins:* workflow 14 L151-158.
- **behavior — `app/src/files/FileView.behavior.test.jsx`:**
  - the rename case (L103) is extended: opening *Rename* on a song sends `file_links` with its path; after `emit(FILE_LINKS …)` with two items, the dialog holds the sentence and the lines *gigs/ensaio.setlist.md · item 3* and *gigs/ferias.setlist.md · item 1*; axe on that state; submit still sends `move_file`;
  - *a song with no links shows no notice*: `FILE_LINKS` with `links: []` → the sentence is absent;
  - *a setlist rename shows no notice*: no `file_links` is sent and the sentence is absent;
  - the history case (L211) is extended: after opening *Edit Valsa*, `getByRole('heading', { level: 2, name: 'Edit Valsa' })` is present, the meta line holds the year of the commit's timestamp and its short hash; a commit seeded with a two-line message (*Edit Valsa* + a body line) shows the body under the heading and only the first line in the heading; axe on the open commit;
  - *the heading on narrow*: rendered with `mode="narrow"`, opening a commit shows the same heading above the diff.

  *Pins:* W14 tablet #3 L144-147; W14 computer #4 L201-202; workflow 14 L169-172.
- **e2e-web — `e2e/web/tests/file-view.spec.js`**, through the real UI only, on phone, tablet and computer:
  - test 1, *"the file view: a new song, a raw edit and a rename saved together; axe-clean"* (L67): with the rename dialog open on *the-ferry-line.cifra.md*, it asserts the sentence **and** the line *a-short-set.setlist.md · item 2* within the dialog; `checkA11y()` stays on that state; the capture becomes `mockup(page, 'W14-file-view', 3, { note: 'links listed' })`;
  - test 1 also opens *Rename* on *a-short-set.setlist.md* and asserts there is no link sentence, then cancels (a setlist relinks nothing);
  - test 2, *"restoring an earlier version from the book's history saves it as a new version"* (L127): after opening the oldest commit, it asserts `getByRole('heading', { name: 'Open example book' })` is visible and the meta line holds a four-digit year; `checkA11y()` stays; the capture becomes `mockup(page, 'W14-file-view', 4, { note: 'commit heading' })`.

  *Pins:* W14#3, W14#4; workflow 14 L151-153, L169-172.

**Drivability.** Every case is driven by what already exists: the bundled example book (its setlist links *The Ferry Line* as item 2; its one commit is *Open example book*), the journeys `openExampleBook`, `openFiles`, `fileRow`, `backToTree`, `openFilesHistory` and `confirmSaveSheet`, the FileView store double, and the Worker's file-ops harness. No hosted book, second device or sign-in is needed.

No test is deferred, and there is no deferred WBS leaf.

## Decisions

1. **A pure `linksTo({ setlists, path })` in `setlist-links.js`, shared with `relinkSetlists`.**
   - *Rationale:* the dialog must list exactly what the save will rewrite. One function deciding which items link to a song, called by both the dry read and the move, makes that true by construction, and unit-tests without a working copy (as `relinkSetlists` does, `file_view.md` Decision 2).
   - *Rejected:* making `relinkSetlists` also return positions and calling it as a dry run: it would build and write canonical texts it then discards, and a "relink" called to read is a misleading seam.
2. **A read-only Worker command, `FILE_LINKS { bookId, path }` → event `FILE_LINKS { bookId, path, links: [{ setlist, item }] }`, sent when the dialog opens.**
   - *Rationale:* the Worker owns the working copy (DIRECTION §3.7); the view cannot read setlist text. This follows the existing file-view reads (`BOOK_TREE`, `COMMIT_DIFF`): a transient event, folded into the view's local state, no reducer slice.
   - *Rejected:* computing the links in the view from `LIST_SETLISTS` — it carries titles and counts, not item links, and widening it would ship every setlist's items to every Setlists screen. *Rejected:* returning the updated setlists in `FILE_MOVED` — that tells the person after the fact; the board shows them before *Rename*.
3. **Show the notice only when there is a link; never wait on the reply.**
   - *Rationale:* the board draws the notice with its link, and a promise to update links that do not exist is untrue. The read is local and fast; the dialog stays usable meanwhile, and `move` relinks what exists at the time it runs whatever the dialog drew.
   - *Rejected:* a "no setlist links to it" line — the board draws no such state, and workflow 14 does not ask for one.
4. **The heading is the subject; the rest of the message follows.**
   - *Rationale:* the board's heading is the message (a one-line message). A git message's first line is its subject (`subjectOf` already reads it so for the rows); a long body as a heading would break the pane. Showing the rest under it keeps workflow 14's "shows its message" whole.
   - *Rejected:* the full message as the heading; a separate "Message" label (the board draws none).
5. **The heading lives in `CommitDiff`, from props `BookHistory` already has.**
   - *Rationale:* `openEntry.message` is in hand (L133-136), and `CommitDiff` is the one detail both widths render, so the phone gets the heading for free. No Worker change.
6. **Full date in the meta line only.**
   - *Rationale:* the board's rows read *2 Oct*, its detail *2 October 2026, 21:14*. Two formats, each where drawn, via `Intl.DateTimeFormat` in the current locale. Tests pin the year and the hash, not a locale-exact string.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-16.

- The rename dialog lists the setlist items it will relink, from a new read-only Worker command `FILE_LINKS` (app/src/worker/{protocol,logic,working-copy}.js, app/src/files/{FileView,RenameFileDialog}.jsx); it shows no notice when nothing links.
- A pure `linksTo` shares its position rule with `relinkSetlists` (app/src/worker/setlist-links.js).
- An open commit is headed by its message's first line, the rest of the message below, then a meta line with the full date and the hash in mono, on every width (app/src/files/{BookHistory,CommitDiff}.jsx, file-view.css); one string added to the four locales (app/src/i18n/locales/).
- Unit: app/src/worker/setlist-links.test.js (`linksTo` describe). Behavior: app/src/worker/file-ops.behavior.test.js (FILE_LINKS), app/src/files/FileView.behavior.test.jsx (rename links, no-notice cases, commit heading, axe).
- e2e-web: e2e/web/tests/file-view.spec.js (W14#3 and W14#4 captures) ran on phone, tablet and computer in the gate.
- No tech-debt follow-ups.

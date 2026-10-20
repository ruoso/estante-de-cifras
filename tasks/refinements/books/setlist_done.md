# Refinement — `books.setlist_done`

## TaskJuggler

[`tasks/65-books.tji`](../../65-books.tji), `task setlist_done "A new setlist
says not saved yet, and editing has Done"` (line 239). The note:

> Item 9 of design.review_polish: a setlist never saved reads not saved yet
> (badge, setlist list, editor bar) instead of unsaved changes, and the setlist
> editor's icon-only Back becomes Done, leaving editing with every change kept;
> four locales. Workflow 12. Source: persona exploration 2026-10-19. Tests:
> behavior (SetlistView: a new setlist's badge, an edited saved one's, Done
> keeps the change and returns focus to Edit; axe); e2e-web (a setlist made
> from Add to setlist, opened, edited, Done, then saved, on phone, tablet and
> computer; axe). Refinement: tasks/refinements/design/review_polish.md

The note's back-link names the design refinement that decided the item; this
document is the build's own refinement. The closer points the note at
`tasks/refinements/books/setlist_done.md`.

## Effort estimate

0.5d, as the `.tji` gives it. Copy and the edit bar are small; the one piece
of plumbing is the status word on the Setlists destination's rows, which the
Worker's list does not carry today (Decision 2).

## Repository

This repository, not `cifra.md/` (the note does not start with `cifra.md:`):

- `app/src/books/SetlistView.jsx`, `app/src/books/SetlistsScreen.jsx`,
  `app/src/books/setlist.css`;
- `app/src/worker/setlist-list.js`, its wiring in `app/src/worker/logic.js`
  (LIST_SETLISTS, ~L2196-2214), the SETLISTS payload comment in
  `app/src/worker/protocol.js` (~L672-679);
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`;
- tests: `app/src/books/SetlistView.behavior.test.jsx`,
  `app/src/books/SetlistsScreen.behavior.test.jsx`,
  `app/src/worker/setlist-list.test.js`, `e2e/web/tests/setlists.spec.js`,
  and the existing e2e specs whose words change (Constraint 6);
- design delta (already written with this refinement):
  `docs/workflows/12-setlists.md` §Building one.

## Inherited dependencies

- `design.review_polish` — **settled** (`complete 100`). Item 9 decided the
  words and the Done; workflow 12 §Building one (L67-81) and the W12 Computer
  editor (`docs/mockups/W12-setlists.dc.html:158-164`, *Done* in the bar) carry
  them.
- Already in place, not in `depends` but complete: `books.setlists` (the
  editor, the read view, the destination), `books.setlists_resilient` (the
  lock-free list), `books.setlist_chrome`, `shell.narrow_fit` (the edit bar's
  two groups), the e2e-web harness and its setlist journeys
  (`e2e/web/lib/journeys-files.js:170-250`).

## What this task is

A setlist made from *Add to setlist* exists only as a new file in the working
tree until its first save. Today its editor bar says *unsaved changes* the
moment it opens, before the person changed anything, and nothing else says
anything at all. This task names the state for what it is — **not saved yet**
— wherever a setlist's status shows: under its title in the read view, on its
row in the Setlists destination, and in the editor bar; a saved setlist with
edits keeps *unsaved changes* in those same places. And the editor bar's
icon-only Back becomes **Done**, a word, in the same place: it returns to the
read view keeping every change, with focus on *Edit*.

## Why it needs to be done

A teacher in the persona exploration (2026-10-19) made a setlist from a song,
opened it, and was told it had unsaved changes she had not made; the editor
then offered only a back arrow, which read as "throw this away". Workflow 12
now decides both (review_polish item 9). It is the last setlist item of the
review in `milestones.m5_complete`.

## Inputs / context

- **Workflow 12 §Building one** (`docs/workflows/12-setlists.md:61-81`): *not
  saved yet* until the first save, where an edited setlist reads *unsaved
  changes*, in its badge, in the list of setlists and in the editor's bar;
  *Done* where the icon-only Back was, keeping every change; Save and Discard
  unchanged; Done the one way out. Workflow 4 (one kind of unsaved change;
  leaving asks nothing).
- **Design refinement**: `tasks/refinements/design/review_polish.md`
  acceptance item 8 (L266-275), *The new copy* (`not saved yet`; **Done** is
  `setlists.done`, already defined), Decision *Not saved yet names the new
  setlist; Done leaves editing*.
- **Board**: W12 Computer editor, `docs/mockups/W12-setlists.dc.html:158-164`
  — `<button class="btn">Done</button>` first in the bar, the
  `badge unsaved dot` in the actions.
- **The read view** `app/src/books/SetlistView.jsx:297-397`: `.setlist-head`
  (title `h2`, the `t-small` meta line *book · folder · N songs*, L303-308) —
  no status today; the app bar's *Edit* (`btn quiet`, L364-366, on every
  mode) and the ⋯ menu's Edit (L379-384); *Point it at a song* also enters
  editing (L345-349).
- **The status** `SetlistView.jsx:202`: `unsaved = touched || status ===
  'unsaved' || status === 'new'`, from the `tree` slice (BOOK_TREE). Book-tree
  status rules: `app/src/worker/book-tree.js:57-80` (head 0 → `new`, workdir 2
  → `unsaved`, under the book lock, `statusMatrix`).
- **The edit bar** `SetlistView.jsx:546-573`: `.setlist-bar-head` with the
  icon Back (`setlists.back`, L550-552) calling `setEditing(false)`; actions:
  badge (`setlists.unsaved`, L559), Add song, Play, Discard (when unsaved),
  Save. `setlist.css:42-91` (the bar's groups, the comment on the badge).
- **The destination** `app/src/books/SetlistsScreen.jsx:81-101`: rows are RAC
  `Button`s with name and *book · N songs* meta; no status. The list comes from
  `listSetlists` (`app/src/worker/setlist-list.js:47-76`), a lock-free
  `readdir` walk returning `{ bookId, path, title, count }`, gated per book by
  `hasCommits` (`logic.js:1306-1313`, `resolveRef('main')`, no lock).
  `books.setlists_resilient` Decision 1 (`tasks/refinements/books/setlists_resilient.md:281-292`):
  the list stays lock-free and statusMatrix-free.
- **Strings**: `app/src/i18n/locales/en.js` `setlists` block L498-562 —
  `back` 507, `done` 512 (*Done*, unused), `unsaved` 523 (*unsaved changes*);
  pt-BR/es-419/it at L466-520 (`done` 478, `unsaved` 488). Parity test:
  `app/src/i18n/i18n.test.js:46`.
- **Tests that exist**: `SetlistView.behavior.test.jsx` — `makeStore`
  (L69-115, loopback endpoint + real store; tree entries `{path, status}`),
  L437 *shows the unsaved word after an edit, which Save clears*, L763 the
  bar's order (asserts `Back` in the head at L778 and a focus order starting
  `Back` at L794); `SetlistsScreen.behavior.test.jsx` (fixed `SETLISTS` at
  L40); `setlist-list.test.js` (lightning-fs + isomorphic-git `makeBook`,
  L59-70). e2e: `setlists.spec.js` (L53 build-and-save, and the
  `unsaved changes` checks at L86/89, 137/139, 167/169, 224/226, 261/263),
  `setlists-resilient.spec.js:39`, `narrow-fixes.spec.js:162-215` (badge text
  L175, `Back` in the bar L211). Journeys: `addToNewSetlist` (L197),
  `addToNewSetlistFromSong` (L210), `openSetlist` (L170, matches the row by a
  regex on its name), `editSetlist` (L236).

## Constraints / requirements

1. **One rule for the word.** A setlist whose path the working copy reports
   `new` (never committed) reads `setlists.notSavedYet` — *not saved yet* —
   and keeps reading it after edits until saved; one reported `unsaved` (or
   touched in this editor while not `new`) reads `setlists.unsaved` —
   *unsaved changes*; a clean one shows no word. Same rule in all three
   places. Same badge styling (`badge unsaved dot`): it is the same change
   underneath (workflow 4); the word, not a colour, carries the difference.
2. **Read view**: the badge sits in `.setlist-head` with the meta line (as the
   workflow 12 delta places it), never in the app bar.
3. **Destination rows**: the word is part of the row's content (so a screen
   reader hears it in the row button's name), after the meta line or as a
   `.badges` span; `openSetlist`'s regex still matches by title. The Worker
   gives each row a `status: 'new' | 'unsaved' | null`.
4. **Lock-free list kept** (`setlists_resilient` Decision 1): the status comes
   without the book lock and without a book-wide `statusMatrix` — per
   setlist, by reading the path's blob at `main` (absent → `new`; present and
   differing from the working file's text → `unsaved`; equal → `null`),
   through a callback the Worker injects as it injects `hasCommits`, so
   `setlist-list.js` stays framework-free and logs nothing. A read that throws
   leaves that row's status `null`, never drops the row or the book.
5. **Done**: a RAC `Button` with the visible word `setlists.done` (no
   `aria-label`), first in `.setlist-bar-head` where the icon was; it calls
   the same leave-editing path (the WRITEs already happened — every change is
   kept; nothing is saved, discarded or asked). On return the read view's
   app-bar **Edit** button receives focus, whichever way editing was entered.
   Save and Discard are unchanged. The read view's own Back (`setlists.back`,
   L290, L360) is unchanged.
6. **Existing tests move with the words**, never weakened: every e2e and
   behavior assertion of *unsaved changes* on a setlist that was never saved
   becomes *not saved yet*; "hidden after Save" checks assert the word that
   was showing; `Back` in the setlist edit bar becomes `Done` (behavior
   L778/L794, `narrow-fixes.spec.js:211`). `narrow-fixes` keeps its geometry
   checks on whichever word is showing.
7. **Four locales**: `setlists.notSavedYet` in en, pt-BR, es-419 and it
   (en: *not saved yet*); `setlists.done` already exists in all four. Keep the
   `setlists.back` key (still used by the read view and the loading view).
8. Accessibility: RAC for every control; axe WCAG 2.1 AA on the read view,
   the editor and the destination; status in words.
9. The Done button and badge fit the edit bar's two-group layout
   (`shell.narrow_fit`): head group = Done + titles; the computer bar stays one
   row (W12).

## Acceptance criteria

Behavior delivered: Constraints 1-9 — *not saved yet* on a never-saved
setlist in the read view, the Setlists destination and the editor bar;
*unsaved changes* on an edited saved one in the same places; *Done* leaving
editing with every change kept and focus on *Edit*; four locales.

Tests, by level:

- **unit** — `app/src/worker/setlist-list.test.js`: new case *rows carry the
  setlist's status: new for a file never committed, unsaved for one changed
  since main, null when clean (books.setlist_done Constraint 4)* (a book with
  one committed setlist edited in the working tree, one committed and clean,
  one written and not committed); and *a status read that throws leaves the
  row listed with status null* (setlists_resilient Constraint 2 kept).
  `app/src/i18n/i18n.test.js` (existing parity test) covers the new key in
  all four locales.
- **behavior** — `app/src/books/SetlistView.behavior.test.jsx`:
  - *a never-saved setlist reads "not saved yet" in its read view and in the
    editor bar, and no "unsaved changes", before and after an edit* (tree
    entry `status: 'new'`; workflow 12 §Building one);
  - *a saved setlist reads nothing until edited, then "unsaved changes" in
    the editor bar and, after Done, under its title* (entry `status: null`,
    then a Key edit);
  - *Done keeps the change: back in the read view the edited key shows, no
    SAVE or DISCARD was sent, and focus is on Edit; axe clean on both views*
    (workflow 12 *Done leaves editing*; workflow 4);
  - the existing L763 test updated: the head starts with the *Done* button
    (no `Back` in the edit bar), focus order starts *Done*.
  `app/src/books/SetlistsScreen.behavior.test.jsx`: *a row reads "not saved
  yet" for a new setlist, "unsaved changes" for an edited one, and nothing
  for a clean one; the word is in the row button's name; axe clean* (the
  fixture's `SETLISTS` gains `status`).
- **e2e-web** — `e2e/web/tests/setlists.spec.js`, new test *a setlist made
  from Add to setlist says not saved yet until saved, and Done leaves editing
  keeping the change (workflow 12 §Building one)*, on phone, tablet and
  computer: `seedExample`, `addToNewSetlist`; the Setlists destination row
  reads *not saved yet* (axe); `openSetlist` — the read view reads *not saved
  yet* and no *unsaved changes* (axe); `editSetlist`, the bar reads *not saved
  yet*; fill a Key; press **Done** — the read view shows the key, still *not
  saved yet*, *Edit* focused; Edit again, the key is still there; **Save** —
  the word is gone in the editor, Done, the read view and the destination
  row show no status (axe on each screen). Then a Note edit on the saved
  setlist reads *unsaved changes* in the bar. The existing setlist specs are
  updated per Constraint 6 and still run.

## Decisions

### 1. The word follows the working copy's `new`, not "has it been touched"

**Chosen:** `new` → *not saved yet*, whatever has been edited since;
otherwise unsaved → *unsaved changes*. **Rejected:** showing *unsaved
changes* once a new setlist is edited — the setlist is still not saved at all
and Save still writes its first version; switching words mid-edit says the
state changed when it did not. The design's "until its first save" says the
same.

### 2. The destination's status from a per-setlist blob read, lock-free

**Chosen:** the Worker injects a `statusOf(bookId, path, text)` that reads the
path's blob at `main` (isomorphic-git `readBlob` with `filepath`, no lock, as
`hasCommits` reads `main`) and compares it to the text the walk already read.
**Rejected:** (a) `BOOK_TREE` for every book from the destination — takes
each book's lock and a full `statusMatrix`, exactly what
`setlists_resilient` Decision 1 removed; (b) the list's `statusMatrix` with
`filepaths` — still the index and lock path; (c) no word on the list — the
workflow names the list as one of the three places. A re-list mid-checkout
may read a stale word, the cost Decision 1 already accepts; `SAVED` re-lists.

### 3. The read view's badge under the title

**Chosen:** with the meta line in `.setlist-head`, written into workflow 12 as
the delta. **Rejected:** the app bar (crowds Back, title, Edit, Share, ⋯ on a
phone); no badge in the read view — the read view is where the person lands
from the list, and the persona's confusion began on opening the setlist.

### 4. Done focuses Edit

**Chosen:** the app bar's Edit button, the control that reopens what Done
closed, on every mode. **Rejected:** the ⋯ trigger when editing came from the
menu, or the missing-item notice — the note asks for Edit, and one target is
one test; the notice may be gone after a repoint.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- A never-saved setlist reads *not saved yet* (an edited saved one *unsaved changes*) in the read view badge, on its Setlists row and in the editor bar: app/src/books/SetlistView.jsx, app/src/books/SetlistsScreen.jsx, app/src/books/setlist.css.
- The row status comes from a lock-free read of the file at `main` (absent → new; differing → unsaved), injected as a callback: app/src/worker/setlist-list.js, app/src/worker/logic.js, app/src/worker/protocol.js. A throwing read leaves the row listed with `status: null`.
- The editor's icon Back is now **Done**: keeps every change, focus on Edit.
- Four locales (`setlists.notSavedYet`): app/src/i18n/locales/{en,pt-BR,es-419,it}.js; design delta in docs/workflows/12-setlists.md.
- Tests: unit app/src/worker/setlist-list.test.js; behavior SetlistView.behavior.test.jsx, SetlistsScreen.behavior.test.jsx, app/src/worker/setlist.behavior.test.js; e2e-web e2e/web/tests/setlists.spec.js (new journey on phone, tablet, computer, with axe) and words updated in setlists-resilient.spec.js and narrow-fixes.spec.js.
- Tech-debt follow-up: none.

# Refinement — `design.book_row_songs`

## TaskJuggler

[`tasks/20-design.tji`](../../20-design.tji), `task book_row_songs "A book on
the shelf opens on its songs"` (line 87). The note, in short:

> Decided 2026-10-19 (launch smoke test): pressing a book in the
> book-management screen opens its songs — search scoped to that book, the
> address workflow 7 already gives it (…/b/<book>, L52-54) — not its
> management detail; today the row opens the detail and its one visible
> button is Files (app/src/books/BooksScreen.jsx:195-219) […]. The row carries
> one action: managing the book (where it lives, put online, share, download,
> make it my own, remove — BookDetail) is reached from the book once open, an
> entry to its detail on the book's songs view (decided 2026-10-19), and Files
> moves off the row into that detail […]. Decide the detail entry's form, name
> and place on the book's songs view, what the row shows of its songs (a
> count?), what a book that needs you (workflow 9) opens on, and how it lays
> out on a tablet and a computer. Workflows 7 (The book-management screen),
> 14 (The view: where it is reached), 2 if the scoped search changes. Tests:
> none — design deliverable (workflow 7 and 14 edits and the W07 and W14
> boards).

## Effort estimate

0.5d as the `.tji` gives it. The workflow text is written with this
refinement (the deltas below); what is left is the drawing — one new
supplementary board and one W07 frame redrawn, plus W07 Phone 1's rows
touched (Decision *A supplementary board, W07 touched in place, W14 not
redrawn*). If it runs over, it is the board.

## Repository

estante-de-cifras, **not** `cifra.md/` (the note does not start with
`cifra.md:`). Files:

- `docs/workflows/07-add-a-book.md` — edited (delta, **written with this
  refinement**): §The book-management screen gains the song count, the
  row's one action, and the one-column tablet/computer layout (L14-38); new
  §A book's songs (L58-95): the book bar, *Manage*, the two notices (*needs
  you* → **Settle**, a fork's new saves → **Bring them in**), the detail as a
  layer with **Rename** and **Files**.
- `docs/workflows/14-file-view.md` — edited (delta, **written with this
  refinement**): §The view, *Where it is reached* (L132-135).
- `docs/workflows/02-find-and-play.md` — edited (delta, **written with this
  refinement**): §Scope (L65-72) — the row opens the same place as the
  address; the bar while the scope is one book.
- `docs/workflows/09-conflicts.md` — edited (delta, **written with this
  refinement**): §Meeting one (L31-33) — what pressing a book that needs you
  opens.
- `docs/DIRECTION.md` — §6 (delta, **written with this refinement**): a new
  *Opening a book* bullet (L640-648). §7 unchanged: no new workflow.
- `docs/mockups/Open-a-book.dc.html` — **new** board (the implementer).
- `docs/mockups/W07-add-a-book.dc.html` — Phone 1's rows and the Computer
  frame redrawn in place (the implementer).
- `docs/mockups/canvas.json` — the new board registered (the closer, per the
  refinements' precedent; GUIDE.md tells a board writer not to edit it).

No code, no `api/` change, no locale file: the build is
`books.row_opens_songs` (`tasks/65-books.tji:185-190`), which implements this
"as design.book_row_songs decides" and translates the new copy.

## Inherited dependencies

The task has no `depends` in the WBS. What it builds on is settled
(`complete 100`): the shelf and its book detail (`books.shelf`), the file
view (`books.file_view`), the book address `…/b/<book>` and scoped search
(workflow 7 §Links to books, workflow 2 §Scope, `app/src/shell/place.js`),
conflicts (workflow 9, `BookConflicts.jsx`), and the fork's bring-in
(workflow 11).

Downstream: `books.row_opens_songs` (depends on this,
`tasks/65-books.tji:188`), then `books.detail_as_drawn`
(`tasks/65-books.tji:203-207`, which reorders the detail as
`design.review_polish` draws it), and milestone M3
(`tasks/99-milestones.tji:32` lists `books.row_opens_songs`).

## What this task is

Decide, in workflows 7, 14, 2 and 9, and draw: pressing a book on the
book-management screen opens its songs (scoped search at `…/b/<book>`), the
row's only action, and the row says how many songs the book holds; the
book's songs view carries a bar naming the book with a **Manage** button that
opens the book's detail; the detail gains **Rename** and **Files** (moved off
the row); a book that needs you opens on its songs with a **Settle** notice;
and how all of it lays out on a phone, a tablet and a computer.

## Why it needs to be done

The launch smoke test (2026-10-19) found the Books tab's only visible way
into a book was *Files*. Today the row (`app/src/books/BooksScreen.jsx:183-250`)
is a `Button.row.book-open` that opens the management detail
(`openBookDetail`, :912-919), beside a visible **Files** button (:213-219,
which opens the full-screen file view via the shell's `openBook`,
`app/src/shell/AppShell.jsx:938-946`), a rename pencil (:220) and a fork's
**Bring them in** (:234-247). So from where books are listed, the plain way
into a book's songs is missing, and the advanced one (workflow 14 says
"advanced users find it, and others never need to") is the default. Workflow
7 never said what pressing a row does, and workflow 14 put *files* "on each
book in the book-management screen" (L132), which is how the button got
there.

## Inputs / context

- **Workflow 7** `docs/workflows/07-add-a-book.md` — §The book-management
  screen (L12-56 after the delta; before it the row listed title, where it
  lives, can save, sync state, L14-21); §Links to books: `…/b/<book>` "is
  search scoped to that book — its songs" (L108-110 after the delta, the
  note's L52-54).
- **Workflow 2** `docs/workflows/02-find-and-play.md` §Scope (L60-72): the
  scope shown in the box; a session from a book's address opens on its
  songs. §The search screen (L13-15): each book a collapsible section; §Edge
  cases (L172-174 before the delta): a book still loading says so.
- **Workflow 14** `docs/workflows/14-file-view.md` §The view (L130-139).
- **Workflow 9** `docs/workflows/09-conflicts.md` §Meeting one (L25-33), §Leaving
  one (L86-): "A conflict can wait indefinitely."
- **Workflow 8** `docs/workflows/08-sync.md` §What the shelf says (L26-37):
  one state per book, *needs you* among them; *Sync now* on the
  book-management screen (L37).
- **The app as built:**
  - `app/src/books/BooksScreen.jsx` — `BookRow` :183-250 (meta `{where} ·
    {role}` :189-193, `SyncBadge` :140-149, fill line and bar :201-233);
    `openBookDetail` :906-919 (a *needs you* book goes to conflicts); wide
    split `.split.books-split` with `books.pickBook` :1054-1071 (only at
    `BOOKS_WIDE_QUERY`, 1080px, `app/src/shell/layout-mode.js:36`); narrow
    detail replaces the list :1073.
  - `app/src/books/BookDetail.jsx` — ephemeral state, not a route; back
    button only narrow (:358-367); sections in order :366-558 (chips, put
    online, lost access, can't save, taken down, Download, Fork, Remove,
    Leave, Share, Delete); no Files, no rename, no song count.
  - `app/src/shell/place.js:7-17` — addresses: `/`, `/books`, `/setlists`,
    `/b/<book>`, `/b/<book>/<path>`; book detail, Files and conflicts are not
    addresses. `bookOfScope` :66-71 maps `{bookId}` and `{books:[id]}` to the
    place's book.
  - `app/src/songs/SearchScreen.jsx` — scope chip in the box :557-567 with ✕
    *Clear filter*; `BookSection` header :283-372 (name, `search.songCount` or
    `search.stillLoading`, **+**, **Save all**, the *Search only in {book}*
    filter :346-352); the per-book count comes from the `browse` slice
    (`app/src/worker/reducer.js:397-401`, `app/src/worker/search-index.js:579-593`).
  - Conflicts: `BookConflicts.jsx`, embedded as the Books content when wide,
    full screen on a phone (`AppShell.jsx:1142-1162`); copy
    `bookConflicts.needsYou` *"{count} songs need you."* (`en.js:1275-1278`).
  - Copy reused (`app/src/i18n/locales/en.js`): `books.onDevice`,
    `books.onEstante`, `books.canSave`, `books.reader`, `books.needsYou`,
    `books.originalNewSaves`, `books.bringIn`/`bringInLabel`,
    `books.renameLabel`/`renameTitle`/`renameField`, `search.songCount`,
    `search.stillLoading`, `fileView.filesEntry`/`filesFor` (:1309-1311).
- **Boards:**
  - `docs/mockups/W07-add-a-book.dc.html` — Phone 1 the shelf rows L36-45
    (data L252-257), Phone 2 the *Add a book* sheet L58-103, Tablet the upload
    preview L110-173, Computer the `.split` with the detail L179-244 (detail
    L199-228, Delete dialog L230-243). No Files anywhere.
  - `docs/mockups/W14-file-view.dc.html` — every frame starts inside Files or
    History with Back (Phone 1 L28-64, Phone 2 L66-86, Tablet L93-154,
    Computer L160-); no frame draws the entry point.
  - `docs/mockups/W10-share.dc.html:169` — the only scoped search drawn: the
    computer side pane with the `.scope` chip *Choros da Ana* and the book's
    songs below (L171-176). The precedent for the book's songs on a computer.
  - `e2e/web/lib/mockup-frames.json:195-217` (W07) and `:381-` (W14) — the
    frame subjects e2e captures compare against, by index.
  - `docs/mockups/GUIDE.md` — 3208×1500, two phones, a tablet, a computer;
    cast; `var(--…)` tokens only; board writers do not edit `canvas.json`.
- **Precedent refinements:** `tasks/refinements/design/sign_in_two_doors.md`
  (deltas written with the refinement; a supplementary board rather than
  replacing captured frames), `w07_remove_board.md` (a W07 supplementary
  board; the 1620 y-stride).

## Constraints / requirements

- Draw in the app's words: shipped copy verbatim where it exists (list
  above); the new copy is exactly the strings in Decision *The new copy*.
- Status by a word, never colour alone: the sync state, *still loading*,
  *needs you* and the new-saves line are words; the bar's notice is a
  `.notice` with text.
- Every control is a real button (React Aria in the build): the row one
  button, **Manage**, **Settle**, **Bring them in**, **Rename**, **Files**,
  Back. Keyboard: the row is one tab stop; on the book's songs the bar's
  buttons come before the results in reading order.
- Offline first: opening a book's songs and its detail need no network
  (the index and the shelf are local); acts on the detail that need the
  service already say so (Leave offline, Put online offline).
- No book without an account and no new address: the detail stays out of
  the address (reload lands on `…/b/<book>`), as `place.js` already decides.
- Cast songs, no lyrics, the GUIDE cast (Ana, *Choros da Ana*, *Banda do
  Bairro*, *My songs*, *Exercícios de violão*).
- The board follows GUIDE (3208×1500, two phones, tablet, computer,
  `var(--…)` tokens only, so the Palco tweak draws it in Palco's).
- W07's four frames keep the subjects their e2e `mockup()` captures name
  (`mockup-frames.json:195-217`).

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause is
*"none — design deliverable (workflow 7 and 14 edits and the W07 and W14
boards)"*). Acceptance is what the workflow documents decide, what the
boards show, and the DIRECTION delta — concrete enough that
`books.row_opens_songs`'s named tests (its note: behavior for the row opening
the scoped search, the detail entry opening the detail, Files from the
detail, keyboard paths, axe; e2e-web for a book's songs opened from Books and
a song played from there, the detail reached from the book's songs and Files
from the detail, on three viewports, axe, mockup W07 and W14) can be written
against them.

1. **Workflow 7 decides** (written with this refinement; the implementer
   keeps board and text in step):
   - **the row** (§The book-management screen, L14-38): title, where it
     lives, can save, *{count} songs* or *still loading*, sync state, and the
     fork's new-saves words; **pressing it opens the book's songs** at
     `…/b/<book>`, the row's one action — no Files, no rename pencil, no
     Bring them in on the row — *pins "the row opens the scoped search" and
     the e2e "a book's songs opened from the Books tab"*;
   - **one list on every width**: no split, no *Pick a book* pane;
   - **the book's songs** (§A book's songs, L58-85): the scope chip in the
     box, and a bar with the title, meta line, sync state in words and
     **Manage** (accessible name *Manage {book}*), shown whenever the scope is
     one book or a folder in it (address, row, or *Search only in {book}*),
     kept while typing, gone when the scope is cleared — *pins "its detail
     entry opens the detail" and the e2e "the detail reached from the book's
     songs"*;
   - **a book that needs you opens on its songs**, with the notice
     *{count} songs need you.* and **Settle**, opening its conflicts; songs in
     conflict keep their badge;
   - **a fork's new saves**: the notice *{original} has {count} new saves.*
     with **Bring them in**, in the same bar;
   - **the detail** (L86-95): a layer over the book's songs — full screen
     with *Back to {book}* on a phone, the main pane beside the side pane on
     a tablet and a computer; not an address; **Rename** in its title;
     **Files** with the line *Every file in the book, as it is stored.*,
     placed after Download; removing or leaving returns to Books — *pins
     "Files reached from the detail"*.
2. **Workflow 14** §The view (L132-135): reached by **Files** on a book's
   detail (via *Manage*) and *show the file*; Back returns to where it was
   opened from.
3. **Workflow 2** §Scope (L65-72) and **workflow 9** §Meeting one (L31-33):
   the cross-references above.
4. **The new board** `docs/mockups/Open-a-book.dc.html` — `.board-head`
   *Workflow 7 · Opening a book*, a one- or two-sentence `board-sub`:
   - **Phone 1 · the shelf, then a book's songs** — Books with the four cast
     books; each row `.name`, `.meta` *On Estante · can save · 14 songs*
     (Exercícios de violão *On this device · 6 songs*; Banda do Bairro its
     `.badge` *2 saves waiting to go up*; Choros da Ana *needs you*), ▸; no
     Files, no pencil; the tab bar with Books current.
   - **Phone 2 · My songs open** — the search box holding the `.scope` chip
     *My songs* with ✕, the bar (*My songs*, *On Estante · can save · 14
     songs*, **Manage**), then the book's songs with folder meta.
   - **Tablet · a book that needs you** — side pane: the box with the
     *Choros da Ana* chip, the bar with *needs you* in words and the
     `.notice` *2 songs need you.* **Settle**, the songs with two carrying the
     *conflict* `.badge`; main pane: a song open (*Lamentos* as cast title,
     chart only).
   - **Computer · the detail, and Files** — side pane: *Banda do Bairro*'s
     songs with its bar; main pane: the detail (appbar *Banda do Bairro* with
     **Rename** and the Back icon *Back to Banda do Bairro*; chips; Download
     card; **Files** card with its line and **Files** button; Remove from my
     shelf card), the order otherwise as W07's computer frame draws it.
5. **W07 in place:** Phone 1's rows gain the song count and lose nothing
   else (they already draw no Files); the Computer frame (*a book's detail,
   and deleting it from Estante*) redrawn as the detail in the main pane over
   the book's songs in the side pane (no Books list beside it), with Rename
   and the Files card; its Delete dialog unchanged. Phone 2 and Tablet
   unchanged.
6. Status in words (`.badge`, `.notice` text), never colour alone; only
   `var(--…)` tokens.
7. **Registration:** `boards["Open-a-book.dc.html"] = { x: 0, y: 39680, w:
   3208, h: 1500, title: "7. Opening a book" }`, appended to `order` — by
   the closer (the next free y on the 1620 stride after Sign-in at 38060).
8. **DIRECTION** (written with this refinement; same commit): §6 gains the
   *Opening a book* bullet. §7 unchanged.
9. **Republish:** `tasks/parking-lot.md`'s boards-to-republish entry gets an
   *Updated* line naming Open-a-book and W07 (the closer).
10. **No code tests, and none deferred.** The tests belong to
    `books.row_opens_songs`, named above as the handshake, not a deferral.
    No deferred WBS follow-up: `books.row_opens_songs` already exists and
    carries the build.

## Decisions

### The entry is a labelled bar above the book's songs, not a section-header icon

**Chosen:** while the scope is one book (or a folder in it), a bar between
the box and the results names the book, its state, and **Manage**.
**Rejected:** a ⋯ or gear on the `BookSection` header beside +, Save all and
the filter — that header is already crowded on a phone (`design.review_polish`
item 3 is drawing it) and an icon alone names nothing; a *Manage* entry in
the scope chip — the chip is the filter and its ✕, and overloading it hides
the way in. The bar also gives the place where the book's state is said in
words once the row is gone from view.

### The new copy

| Where | Copy |
|---|---|
| Book bar button / its accessible name | **Manage** / *Manage {book}* |
| Needs-you notice / its button / accessible name | *{count} songs need you.* (shipped `bookConflicts.needsYou`) / **Settle** / *Settle conflicts in {book}* |
| Detail back (phone) | *Back to {book}* |
| Detail title button | **Rename** (accessible name the shipped *Rename {name}*) |
| Files card / its line / button | **Files** / *Every file in the book, as it is stored.* / **Files** (accessible name the shipped *Files in {name}*) |
| Row meta | *{where} · {role} · {count} songs*, or *… · still loading* (shipped strings) |

Everything else on the bar and the detail is shipped copy.

### Named *Manage*, accessible name *Manage {book}*

**Chosen:** one short verb, the same word the workflow calls the screen
(the book-*management* screen), fitting a phone bar. **Rejected:** *Book
details* (the detail is mostly acts, not details), *Settings* (nothing there
is a setting), *About this book* (reads as information only).

### The detail is a layer over the book's songs, not a Books-tab state

**Chosen:** *Manage* opens the detail where a song would open — full screen
on a phone, the main pane on a tablet and a computer (as W10's computer
frame draws a scoped search in the side pane with the song in the main
pane). **Rejected:** jumping to the Books tab with the book selected in the
split — it moves the person across destinations for one press, and once the
row opens songs the split's detail pane would only ever say *Pick a book*.
So the Books screen is one list at every width.

### The row carries the song count from the index

**Chosen:** *{count} songs* in the meta line, *still loading* while the
index builds — the same words and source as the book's section in search
(`search.songCount`, the `browse` slice). **Rejected:** no count (the row
then says nothing about what pressing it opens); a count of every file
(that is the file view's business).

### A book that needs you opens on its songs, with Settle

**Chosen:** one rule for the press; the conflicts one press away in a
notice that says how many. **Rejected:** opening straight into the conflicts
as today (`BooksScreen.jsx:912-919`) — workflow 9 says a conflict can wait
and the song shows the user's own version so it can be played mid-lesson;
sending a person who came to play into a resolver makes the row's meaning
depend on state.

### Rename and Bring them in leave the row too

**Chosen:** the note's "the row carries one action" taken at its word:
Rename goes to the detail's title (it is shelf management), Bring them in to
the book's bar (it is about the book's songs, and the words stay on the row
as status). **Rejected:** keeping the pencil and the bring-in button on the
row — two more tab stops per row, and the same ambiguity the smoke test
found.

### Files sits after Download in the detail

**Chosen:** both are the book as files; `books.detail_as_drawn` /
`design.review_polish` reorder the rest (Share to the app bar, Delete apart)
and inherit Files where it is. **Rejected:** Files in the app bar — that is
where W07 puts Share, and Files is the advanced act, not the headline one.

### A supplementary board, W07 touched in place, W14 not redrawn

**Chosen:** a new `Open-a-book.dc.html` for the row, the book's songs, the
needs-you notice and the detail with Files; on W07, Phone 1's rows gain the
count and the Computer frame's detail moves over the book's songs, both
keeping their captured subjects. **Rejected:** replacing W07 frames — each is
an e2e `mockup()` capture subject by index (`mockup-frames.json:195-217`);
redrawing W14 — none of its frames draws the entry point (each starts inside
Files or History with Back), so the new entry is drawn where the detail is.
The note's "W14 board" is honoured by workflow 14's text and the new board's
Files card. Precedent: Remove-from-shelf, Sign-in.

## Open questions

(none — all decided.)

Surfaced for the parking lot (human product judgment, not WBS tasks):

- **The word *Manage*.** Chosen as above; the human may prefer another word
  for the button before it is translated.

## Status

_pending implementation_

## Status

**Done** — 2026-10-20.

- Workflow text: `docs/workflows/07-add-a-book.md` (song count, the row's one action, new §A book's songs with *Manage*, the two notices, the detail as a layer with **Rename** and **Files**), `docs/workflows/14-file-view.md` (where the view is reached), `docs/workflows/02-find-and-play.md` (§Scope), `docs/workflows/09-conflicts.md` (§Meeting one), `docs/DIRECTION.md` §6 (*Opening a book*).
- New board `docs/mockups/Open-a-book.dc.html`: phone shelf rows with counts and state in words; *My songs* open with the scope chip and **Manage**; tablet *Choros da Ana* needing you (**Settle**); computer side pane plus detail with **Files**.
- `docs/mockups/W07-add-a-book.dc.html`: Phone 1's rows gain song counts; the Computer frame is redrawn as scoped songs beside the detail.
- On the new board *Choros da Ana* reads *can save*, not *reader* (a book that needs you must be savable); W07 still shows *reader*.
- Registered in `docs/mockups/canvas.json` (y 39680); parking-lot canvas-republish entry updated. Build is `books.row_opens_songs`.
- No tests: design task, acceptance is the workflow text and the boards.

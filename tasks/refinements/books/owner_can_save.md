# books.owner_can_save — A book one owns can be saved to everywhere

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task owner_can_save` (lines
198-203), in milestone `m3_service` (`tasks/99-milestones.tji:32`).

## Effort estimate

1d.

## Repository

The app only: `app/src/books/` (`book-display.js`, `AddToSetlist.jsx`),
`app/src/i18n/locales/*.js`, their tests beside them, and an e2e-web spec
plus one journey under `e2e/web/`. Nothing under `cifra.md/`, `service/`
or `api/`.

## Inherited dependencies

- `books.setlists` — **settled** (`complete 100`): Add to setlist, the New
  setlist… name dialog, Decision 7 (a new setlist goes in the song's own
  book when savable, else *My songs*).
- `books.online` — **settled** (`complete 100`): put-online writes the
  shelf entry with `role: 'owner'` (`app/src/worker/logic.js:2587`); fork
  does the same (`logic.js:2703`).
- Used by the e2e journey, already complete: `account.sign_in` (a signed-in
  device), and the `hostedBookWithSong` journey
  (`e2e/web/lib/journeys-share.js:50`).

## What this task is

Two usability findings (2026-10-19 review, H3 and H4). **H3:** `canSaveFor`
knows only `editor` and `reader`, so a book the signed-in person put online
or forked — role `owner` — reads as *unknown*: it is dropped from Add to
setlist, Which book, the upload targets and a search section's new-song
affordance, and its shelf row shows no *can save* word. Owner counts as
can-save. **H4:** in Add to setlist, the New setlist… name field is not
focused when the dialog opens, so typing is lost; Create closes the dialog
even when there is no book to put the setlist in, so nothing happens and
nothing says why; and *My songs* is found by matching its display title,
which breaks when the user renames it or the UI language differs from the
title it was made with. Focus the field, say why when there is no target
(and never close silently), and find *My songs* by id.

## Why it needs to be done

Every signed-in user who puts a book online loses the ability to add to its
setlists, start songs in it from Which book, or upload into it — the common
path for anyone using Estante with an account. It is an M3 (Estante online)
blocker. Downstream, `books.setlist_picker_fixes` and
`books.setlist_invitation` work in the same picker and assume owner books
are offered.

## Inputs / context

- `app/src/books/book-display.js:47-63` — `canSaveFor(kind, book)`:
  `local` → true; shared `editor` → true, `reader` → false, else `null`.
  `bookMetaFor` (:74-84) renders *can save* / *can't save here* from it —
  the Books role chip and the bar above a book's songs.
- Callers that gate on `canSaveFor(...) === true` and so drop owner books
  today: `app/src/books/AddToSetlist.jsx:69-77`,
  `app/src/songs/WhichBook.jsx:54`, `app/src/books/UploadPreview.jsx:72`,
  `app/src/songs/SearchScreen.jsx:114-118` (`canWriteTo`). `FileView.jsx:47`
  uses `!== false` and already treats owner as savable — no change.
- `docs/home-book-format.md:278-281` — a shelf entry's `role` is `"owner"`,
  `"editor"` or `"reader"`, a hint for the shelf, never an authority.
- `docs/workflows/07-add-a-book.md:19` — every shelf row says whether the
  user **can save** to it. `docs/workflows/03-write-a-new-song.md:25-28`
  §Which book — a book the user cannot push to is not offered (so one they
  can, including their own, is). `docs/workflows/12-setlists.md:36-42,56-61`
  — Add to setlist chooses the setlist or makes a new one; a multi-book
  setlist lives in *My songs*.
- `app/src/books/AddToSetlist.jsx`: `naming` state (:53), New setlist… row
  (:173-178), `homeBookId` by title (:85-91), `chosen`/`targetName`
  (:95-102), the target paragraph rendered even with `book: null`
  (:205-210), `createNew` returning silently with no target (:114-128),
  `NewSetlistDialog` (:245-292) with the unfocused `Input` (:273) and the
  unconditional `close()` after `onCreate` (:265-266).
- *My songs* identity: on this device it is the local book
  `local-my-songs` (`app/src/worker/my-songs.js:30`, `MY_SONGS_ID`); once
  put online, the shelf's `mySongs` register names the shared book id
  (`docs/home-book-format.md:325-332`), passed through to the view's shelf
  slice (`app/src/worker/shelf.js:119,135`). The view does not import Worker
  modules; it repeats the constant, as `LeaveDialogs.jsx:54-56` does for
  the home book.
- Predecessor: `tasks/refinements/books/setlists.md` Decision 7
  (:479-483).
- Tests today: AddToSetlist in `app/src/books/SetlistView.behavior.test.jsx`
  (`describe('AddToSetlist dialog')` :295, local-only `SHELF` :284); Which
  book in `app/src/songs/NewSong.behavior.test.jsx` (`describe('which
  book')` :145, `SHELF` :57 with editor/reader books); upload targets in
  `app/src/books/UploadPreview.behavior.test.jsx` (synthetic `model()`
  :217); shelf meta in `app/src/books/BooksScreen.behavior.test.jsx`
  (owner fixtures :503, :588); `canSaveFor` unit tests in
  `app/src/books/book-display.test.js:46-58`. e2e:
  `e2e/web/tests/setlists.spec.js` (local, from Search), journeys
  `addToNewSetlist` (`e2e/web/lib/journeys-files.js:192`),
  `hostedBookWithSong` (`journeys-share.js:50`), `openSongFromSearch`
  (`journeys.js:280`). The reading view's *Add to setlist* button uses the
  `en.js:1623` string.

## Constraints / requirements

1. `canSaveFor('shared', { role: owner })` returns `true`. `editor` true,
   `reader` false, absent/unknown role `null` — unchanged. The role stays
   a hint (home-book-format §4.2): the service still decides on push; this
   only stops the app hiding a book the user can write.
2. Every surface gated on `canSaveFor` offers an owner book with no change
   at the call site except where a call site re-derives the role itself
   (none should remain).
3. *My songs* is found by id, never by title: a pure `mySongsIdFor(shelf)`
   in `book-display.js` returns `shelf.mySongs.value` when that id is a
   visible entry of `shelf.books`, else `'local-my-songs'` when that is a
   visible entry of `shelf.local`, else `null`. `AddToSetlist` uses it and
   then requires the id to be savable.
4. In the New setlist… name dialog the name field has focus on open
   (`autoFocus` on the RAC `Input`, which React Aria honours on mount).
5. The name dialog closes only once the setlist has a target book. When
   there is none (the song's book is not savable and no savable *My songs*
   is on the shelf), the dialog says why in words —
   `setlists.newSetlistNoBook`: *This song's book is read-only and My songs
   isn't on this device, so there is no book to keep a new setlist in.* —
   shows no name field and no Create, and offers only Cancel, which takes
   focus. `createNew` reports whether it sent (`true`/`false`) and the
   dialog calls `close()` only on `true`. The key lands in all four locales
   (`en`, `pt-BR`, `es-419`, `it`).
6. The picker's target paragraph (:205-210) renders only when there is a
   target name — never *… in null*.
7. Accessibility: the notice is a `role="status"` paragraph inside the
   dialog; the dialog's keyboard path (open with Enter on New setlist…,
   type, Enter creates; Escape cancels) holds; axe clean at WCAG 2.1 AA.
8. Offline first and Worker ownership unchanged: the fix is view-side; the
   `ADD_TO_SETLIST` command and its Worker handling are untouched.

## Acceptance criteria

Behavior: a person signed in, with a book they put online, sees it as *On
Estante · can save* on the shelf, and it is offered by Add to setlist (its
setlists, and as the target of a new one), Which book, the upload targets
and a search section's new-song affordance. The New setlist… field takes
typing at once; Create always either makes the setlist or the dialog says
why there is nowhere to keep it.

Tests, by level:

- **unit** — `app/src/books/book-display.test.js`:
  - `canSaveFor('shared', { role: reg('owner') })` is `true`, beside the
    existing editor/reader/absent cases (workflow 7 L19-20,
    home-book-format §4.2).
  - `bookMetaFor('shared', owner book, …)` reads *On Estante · can save · …*
    (workflow 7 L19).
  - `mySongsIdFor`: the `mySongs` register's id when that shared book is on
    the shelf; `'local-my-songs'` when only the local one is; `null` when
    neither; a removed (invisible) entry ignored; a book *labelled* "My
    songs" with another id is **not** chosen (Constraint 3).
- **behavior**, each with an axe check of what it renders:
  - `app/src/books/SetlistView.behavior.test.jsx` (`AddToSetlist dialog`),
    over a shelf with an owner-role shared book `srv-own` holding a
    setlist:
    - its setlist is listed and Add sends `ADD_TO_SETLIST` with
      `targetBookId: 'srv-own'` (workflow 12 §Building one);
    - New setlist… from a song in `srv-own` sends `targetBookId: 'srv-own'`
      (setlists Decision 7);
    - the name field has focus on open, and typing then Enter creates
      (Constraint 4);
    - from a reader-role book's song with *My songs* online under a
      `mySongs` register and **relabelled** "Cantos", the new setlist goes to
      that id (Constraint 3);
    - from a reader-role book's song with no *My songs* on the shelf, the
      dialog shows `setlists.newSetlistNoBook`, no field, no Create, sends
      no command and stays open until Cancel; the picker shows no target
      paragraph (Constraints 5-6).
  - `app/src/songs/NewSong.behavior.test.jsx` (`which book`): an
    owner-role shared book is offered in Which book beside the editor one;
    the reader book still is not (workflow 3 §Which book).
  - `app/src/books/UploadPreview.behavior.test.jsx`: with an owner-role
    shared book on the shelf (the synthetic `model()` seam, :217), it is
    offered as a Merge-into target.
  - `app/src/songs/SearchScreen.behavior.test.jsx`: an owner-role book's
    section offers the new-song affordance (`canWriteTo`, workflow 3 L28).
  - `app/src/books/BooksScreen.behavior.test.jsx`: an owner-role row's meta
    reads *On Estante · can save · …*; existing owner-fixture assertions
    (:503, :588) updated to carry the word (workflow 7 L19).
- **e2e-web** — `e2e/web/tests/owner-can-save.spec.js`, on phone, tablet
  and computer (every project):
  - *a book put online, then a song added to a new setlist in it from the
    song view*: `hostedBookWithSong` (sign in, make a book, write a song,
    put it online); the shelf row reads *can save*; open the song
    (`openSongFromSearch`), press *Add to setlist* in the reading view, the
    picker lists the book as the new setlist's book, New setlist…, type the
    name **without clicking the field** (pins the focus), Create; the
    setlist then opens from that book's Setlists and holds the song
    (workflow 12 §Building one, workflow 7 L19). Axe on the picker, the
    name dialog and the shelf.
  - A new journey `addToNewSetlistFromSong(page, title, setlistName)` in
    `e2e/web/lib/journeys-files.js` beside `addToNewSetlist`: real UI only
    (the reading view's button, the dialog, keyboard typing).

## Decisions

1. **Owner is can-save in `canSaveFor`, not at each call site.** One
   function is the seam every surface already reads (books.shelf Decision
   5); fixing it there fixes all five surfaces and the role chip. A
   `canSave` flag written on the shelf entry was rejected: it would
   duplicate the role and need a home-book format change.
2. **Unknown role stays `null`.** Treating any non-reader as savable would
   have hidden the next unknown role the same way in reverse (offering a
   book the service would refuse). Only the three documented roles get a
   word.
3. **My songs by id through a view-side helper.** The `mySongs` register
   and `local-my-songs` are the only identities the format gives it
   (home-book-format §4.2); a label is the user's words. The view repeats
   the constant rather than importing `worker/my-songs.js`, following
   `LeaveDialogs.jsx:54-56` (the view never imports Worker modules,
   DIRECTION §3.7).
4. **No target: say why in the name dialog, not disable the row.** A
   disabled New setlist… with no reason is the same silence H4 reports;
   opening the dialog to a plain sentence and a Cancel tells the user what
   is missing. Hiding the row was rejected for the same reason. No
   alternative target (another savable book) is chosen silently — that
   would contradict setlists Decision 7 and workflow 12 L41-42.
5. **No design delta.** Workflow 7 L19, workflow 3 §Which book and workflow
   12 already say an owned book can be saved to; the code fell short of
   them.
6. **e2e journey from the reading view, in its own spec.** The note asks
   for the song view; `setlists.spec.js` runs unsigned from Search, so a
   signed-in, hosted-book journey would change its setup — a separate spec
   keeps both readable.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- app/src/books/book-display.js: `canSaveFor` counts the owner role as can-save (so `bookMetaFor` reads *can save*), and `mySongsIdFor` finds *My songs* by id, not title; tests in book-display.test.js.
- app/src/books/AddToSetlist.jsx: the New setlist… field is focused on open (autoFocus on the RAC `TextField`, with a reasoned eslint-disable); with no book to keep the setlist in, the dialog says why (`setlists.newSetlistNoBook`), offers only Cancel and never closes on its own; no target line without a book name.
- app/src/songs/SearchScreen.jsx (comment only) and app/src/i18n/locales/{en,pt-BR,es-419,it}.js: the new string.
- Behavior (each with axe): SetlistView, NewSong, UploadPreview, SearchScreen and BooksScreen behavior tests under app/src/books/ and app/src/songs/.
- e2e-web: e2e/web/tests/owner-can-save.spec.js with the journey `addToNewSetlistFromSong` in e2e/web/lib/journeys-files.js, on phone, tablet and computer.
- e2e/web/tests/add-by-link.spec.js: the workflow 7 row-meta assertion now pins *can save* on an owner row.

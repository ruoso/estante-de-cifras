# books.book_page — A book opens on a page of its own

## TaskJuggler entry

`books.book_page` in [`tasks/65-books.tji`](../../65-books.tji) ("A book
opens on a page of its own"), a `depends` of `milestones.m5_complete` in
`tasks/99-milestones.tji`.

## Effort estimate

1d — design and build in one task. The design is a rewritten section of
workflow 7 (§A book's page) and a paragraph of workflow 2 (§Scope), redrawn on
the Open-a-book board. The build is one new screen, a routing change (the
book's address moves from Search to Books), and the bar leaving the search
screen. No Worker, service or API change.

## Repository

estante-de-cifras, not `cifra.md/`:

- `app/src/books/BookSongs.jsx`, `book-songs.css` — **new**: the book's page
- `app/src/songs/song-rows.jsx` — **new**: `SongRow`, `SetlistRow`, `Badges`,
  `canWriteTo` and the glyphs, moved out of `SearchScreen.jsx` so both
  screens draw the same rows; a null `bookLabel` leaves the book off a row
- `app/src/songs/SearchScreen.jsx` — the bar, *Manage*/*Settle* and the
  bring-in screen leave it; a scope is a filter only
- `app/src/books/BookBar.jsx` — `headingLevel` (1 on the page), and
  `onNewSong`: New song and Manage in one row at the card's foot
- `app/src/shell/place.js` — `/b/<book>` is `{ tab: 'books', book }`
- `app/src/shell/AppShell.jsx` — `bookPage` (and its typed query) beside the
  scope; the row, NotHere's *Open {book}'s songs*, fork and put-online follow
  it; the computer's detail split shows the page beside the detail
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — `books.backToBooks`,
  `books.page*`
- `docs/workflows/07-add-a-book.md`, `02-find-and-play.md`,
  `03-write-a-new-song.md` (and the §A book's page references in 09, 10, 14),
  `docs/DIRECTION.md` §3.7 and §6, `docs/mockups/Open-a-book.dc.html`,
  `e2e/web/lib/mockup-frames.json` (the board's labels)

## What this task is

The owner made a new book on the deployed app, pressed it, and landed on the
search screen: the Search tab lit, the global search box with the book as a
chip, a *Recent* list, a *Books* heading over one collapsible section, and
*New song* only as a small plus on that section's header. It read as a search
page, not the book, with no plain way to add one more song.

Pressing a book now opens the book's page, on Books, at `…/b/<book>`:
*‹ Books*; the book's card (title as the page's h1, meta, sync word, the
needs-you and new-saves notices, and at its foot **New song** beside
*Manage*); *Save all*
when songs are unsaved; *Search in this book*; and every song as one flat
list. An empty book says *No songs in this book yet.*, and a book still being
read says so in words.

## Decisions

1. **The page lives on Books, not Search.** The book's address is a Books
   place, so the Books tab stays lit and Back from a song returns to the page.
   A song address now carries `{ tab: 'books', book }` beneath it.
2. **A search scope is a filter only.** No address and no bar: the funnel on
   a book's section in Search still narrows Search, and the scope still
   follows a save, but neither touches the URL or history any more.
3. **The Books tab pressed from another destination opens the shelf.** A tab
   means the top of that tab; the page is left by its own *Books*.
4. **The whole page scrolls** (shell.full_height): the bar, New song and the
   field scroll away with the songs, so a short phone still has room for the
   list. The tab bar stays.
5. **Beside the detail on a computer**, the page shows no *Books*: the
   detail's *Back to {book}* is the way back there.
6. **New song sits in the card, beside Manage**, the filled button first: a
   full-width button of its own cost a row of songs on a phone. The card is
   only on the page; the shelf rows (`BookRow`) keep their one action.
   **Manage stays a word**: what is behind it — Share, Put online, Rename,
   Files, Delete — is more than a gear says.
7. **Search within the book** uses the same SEARCH/BROWSE commands scoped to
   `{ books: [bookId] }`; nothing matching offers *Create "{query}"* in this
   book, not in My songs.

## Tests

- unit: `app/src/shell/place.test.js`
- behavior: `app/src/books/BookSongs.behavior.test.jsx` (new),
  `BookBar.behavior.test.jsx`, `app/src/shell/AppShell.behavior.test.jsx`,
  `AppShell.routing.behavior.test.jsx`, `NotHere.behavior.test.jsx`,
  `app/src/songs/SearchScreen.behavior.test.jsx`
- e2e-web: `open-a-book.spec.js` (plus a new empty book's page and its New
  song), `routing.spec.js`, `search-scope.spec.js`, `full-height.spec.js`,
  and `gotoTab` in `e2e/web/lib/journeys.js` steps out of a book's page

## Status

**Done** — 2026-10-23. The canvas artifact needs republishing for the redrawn
Open-a-book board (parking lot).

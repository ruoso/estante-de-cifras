# shell.routing — The URL follows where you are

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 64–69, task `shell.routing`
("The URL follows where you are"), under `task shell`. It `depends !layout,
books.add_by_link` and sits in the polish milestone
(`tasks/99-milestones.tji` line 44). The note, verbatim:

> Sync the active destination and deep screens (a book, a song, a setlist) to
> the URL so browser and Android back work and a place can be bookmarked or
> reloaded; book invitation links (books.add_by_link) keep working through it.
> Opening a URL for something not on this device lands on a clear not-here
> state, never a crash. Source: tasks/parking-lot.md 2026-10-14 (Shell URL /
> deep-link routing). Tests: unit (URL ↔ location both ways); behavior
> (navigating updates the URL, back returns, a deep URL opens its screen; axe);
> e2e-web (a song opened, reloaded and still open; back from a song to its book
> on the three viewports; axe).

The parking-lot entry (added 2026-10-05 by the closer for `shell.layout`,
removed in the 2026-10-14 triage `799f87d` that wired this leaf) asked whether
the shell should sync its destination to the URL, and parked it because doing
so then "would pre-decide deep navigation for songs, books and the file view".
`books.share` Decision 2 later took the boot-only reading of `/b/<book>/<path>`
and rejected bidirectional sync for the same reason. The WBS now asks for it;
this refinement decides the deep navigation that was waiting.

## Effort estimate

**2 days** (from the `.tji`). Roughly: half a day for the pure place ↔ URL
module and its unit tests; a day for the history hook, lifting the search
scope into `AppShell`, routing every full-screen Back through it, and the
not-here surface with its behavior tests; half a day for the one-line service
fix with its Go and e2e-api cases and the e2e-web spec.

## Repository

**estante-de-cifras only.** Not format work — the note does not start with
`cifra.md:`. The work lands in:

- `app/src/shell/` — new `place.js` (+ `place.test.js`), new
  `use-place-history.js`, new `NotHere.jsx` (+ `NotHere.behavior.test.jsx`),
  `AppShell.jsx`, a new `AppShell.routing.behavior.test.jsx`.
- `app/src/App.jsx` — the boot captures stop wiping the URL to `/` where a
  place follows (below).
- `app/src/books/book-route.js` — a book-only parse/build beside the existing
  `/b/<book>/<path>` ones (+ `book-route.test.js` cases).
- `app/src/songs/SearchScreen.jsx` — the scope becomes controllable.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the `notHere.*` keys.
- `service/internal/server/app.go` (+ `app_test.go`) — `/b/…` paths with a
  dotted last segment fall back to the shell.
- `e2e/api/app.test.js`, `e2e/web/tests/routing.spec.js` (new),
  `e2e/web/tests/share.spec.js` (the `test.fixme` at line 202 un-fixmed),
  `e2e/web/lib/journeys.js` (one helper).

**Design delta (rides in this task's commit):**

- `docs/DIRECTION.md` §3.7 line 475, new bullet *"The address follows where
  you are"*: which places are addresses, that the screens over them are
  history steps but not addresses, and that it is the History API under the
  app's own module, not a routing library (`shell.layout` rejected a router as
  a new runtime dependency — layout.md Decisions; this keeps that).
- `docs/workflows/07-add-a-book.md` §Links to books, from line 45: what
  `…/b/<book>` and `…/b/<book>/<path>` open, and the two not-here states.
- `docs/workflows/02-find-and-play.md` §Scope, line 65: the one exception to
  "the scope resets at the start of each session" — a session that starts
  from a book's address opens scoped to that book.

## Inherited dependencies

Settled (all `complete 100`):

- `shell.layout` — the controlled RAC `Tabs` over `DESTINATIONS`
  (`app/src/shell/layout-mode.js`; `AppShell.jsx:237`
  `useState(DESTINATIONS[0])`), and its Decision that navigation is ephemeral
  view state in `AppShell`, not a Worker slice — kept: the URL is view state
  too.
- `books.add_by_link` — `/i/<token>` captured once at boot
  (`app/src/account/invitation-route.js`, `App.jsx:189`), the invited flow
  in `AppShell.jsx:444-453`, `BOOK_CLONED` landing (`AppShell.jsx:480-489`),
  the worded refusals (`InvitedScreen.jsx:77`, `invited.deadTitle` /
  `deadBody`, `en.js:535-537`).
- `books.share` — `bootBookSong` / `bookSongRoute` / `bookSongPath` and the
  invitation `#<path>` anchor (`app/src/books/book-route.js`; `App.jsx:192-199`;
  `AppShell.jsx:455-465`), the member address `…/b/<book>/<path>` built in
  `SharingScreen.jsx:397,439`.
- `foundation.e2e_web`, `foundation.e2e_api` — the harnesses; `startApp(page,
  path)` (`e2e/web/lib/journeys.js:26`) already takes a path,
  `openSongFromSearch` (`journeys.js:216`), `openExampleBook`
  (`journeys.js:46`), `SONG` (`journeys-core.js:10`); `share.spec.js`'s
  `hostedBookWithSong`, `shareSongAddress`, `openDevice`, `signedInDevice`.
- `books.setlists`, `songs.search`, `songs.reading` — the screens a place
  opens.

Pending: none. Every test named below is driven by what exists: the example
book (`openExampleBook`) for the reload and back journeys; the existing
`share.spec.js` helpers (hosted book, second signed-in account) for the
non-member case.

## What this task is

Make the address bar say where the person is, and make the browser's back —
and Android's, in the installed PWA and the Play TWA (DIRECTION §8) — step
back through what they did, instead of leaving the app. A **place** is the
destination tab, the book the search is scoped to, and the open song or
setlist; it has an address (`/`, `/books`, `/setlists`, `/b/<book>`,
`/b/<book>/<path>`), and reloading or bookmarking that address returns to it.
The full-screen surfaces over a place (editor, history, file view, arrange,
wizard, explorer, account, conflicts, setlist play) push a history step with
the same address, so back closes them as their own Back button does. An
address for a book not on this device, or for a song or setlist no longer in
a book that is, opens a plain not-here screen — never the empty reading view
`share.spec.js:202` records today.

## Why it needs to be done

Today nothing writes the URL except `App.jsx:195-199`'s
`history.replaceState(null, '', '/')`, and nothing listens for `popstate`:
Android's back from a song closes the app, a reload always lands on search,
and the member address `books.share` hands out works only as a boot-time
open with no membership check (the `test.fixme` at `share.spec.js:202`).
A fresh device opening `…/b/<book>/<song>.cifra.md` gets a 404 from the
service, because `isAssetRequest` (`service/internal/server/app.go:143-148`)
reads the `.md` as a missing asset — the existing e2e only passes because a
service worker already controls the page (`share.spec.js:195`).

Downstream: every later screen task inherits a back button that works, and
`books.share`'s promise "for someone already a member, the link is just the
song's address" (workflow 10 §Sharing a song) holds on any device.

## Inputs / context

- **DIRECTION** §3.7 (L437–), the Worker owns the data and the view mirrors
  it; the new bullet at L475 (this task's delta). §3.3 L171–183: one origin;
  no link opens a book to whoever holds it; `noindex`. §4 L481–486: "Song
  search is the primary interface. Books are a scope on that search" — the
  reason `/b/<book>` is search scoped to the book. §8 L655–660: the TWA loads
  the live site, so Android back is the browser's back.
- **Workflow 1** §Invited L46–66: an invitation opens the app on the book; *a
  book's plain address opened by someone who is not a member* "cannot be
  cloned. The app says the link does not open the book, and suggests asking
  whoever sent it for a new one … It does not say whose book it is."
- **Workflow 2** L12 "The app opens on search"; §Scope L60–67 (and the
  delta at L65).
- **Workflow 7** §Links to books L39–60 (with the delta from L45).
- **Workflow 10** §Sharing a song L150–158: the member address
  `…/b/<book>/<path>`; the invitation `#<path>` anchor.
- **Workflow 12** L83–85: a setlist's link to a missing song reads *missing*
  — the precedent for the item not-here copy.
- **Workflow 16** L26–27, L182, L191: back from the explorer returns to search
  "with it still typed" — the search query stays in memory, untouched by
  history.
- **Code seams.**
  - `app/src/shell/AppShell.jsx`: navigation slots L237–361 (`selected`,
    `account`, `editing`, `editingSong`, `openFile`, `exploring`, `openSong`,
    `history`, `arranging`, `wizard`, `conflictsBook`, `songConflict`,
    `openSetlist`, `playingSetlist`, …); the render if-chain L553–870; every
    surface's `onBack` (L676, 696, 709, 725, 743, 764, 797, 851, 866); the
    fork follower L370–388; boot effects L444–465; `BOOK_CLONED` L480–489.
  - `app/src/App.jsx:96-103` `useHashRoute` (the `#dev/*` mounts — hash
    space, untouched), L109–146 boot readers, L178–199 captures and the
    `replaceState('/')`.
  - `app/src/books/book-route.js` (`bookSongRoute`, `bookSongPath`,
    `songAnchorFromHash`, `invitationSongLink`) and `book-route.test.js`.
  - `app/src/songs/SearchScreen.jsx:426` `const [scope, setScope] =
    useState(INITIAL_SCOPE)`; `search-query.js:44-50` — a scope is `null`,
    `{ books: [...] }`, `{ bookId }` or `{ bookId, prefix }`; the per-book
    *Search only in {book}* button (`SearchScreen.jsx:352-354`,
    `en.js:337`).
  - `app/src/books/setlist-display.js:55-66` `bookFileSet(entries)` — the
    present paths of a book from the `tree` slice (BOOK_TREE), `deleted`
    excluded; the predicate the not-here check reuses.
  - `app/src/books/BookDetail.jsx:272` — the only `BOOK_ONLINE` listener
    (AppShell does not follow a put-online's id change).
  - `app/vite.config.js:37-54` — workbox `navigateFallback: '/index.html'`,
    so once installed any deep address reloads offline.
  - `service/internal/server/app.go:54-67` (`reservedPrefixes`,
    `linkRoutes`), `:76-95` `ServeHTTP`, `:143-160` `isAssetRequest` /
    `isLinkRoute`; `app_test.go:84-107` `TestAppServedAtRoot` (pins `GET
    /b/demo`); `logging_test.go:84-124` (asserts `/b/abc` is logged
    unchanged — `linkRoutes` also drives log redaction).
  - `e2e/api/app.test.js:27` 'GET /b/anything returns the same shell'.
  - `e2e/web/eslint.config.js` — specs go through the real UI only.

## Constraints / requirements

- **Offline first** (*Central*). Resolving an address needs only the shelf
  and the book's tree, both from the Worker; nothing waits on the network.
  An installed app reloads any address offline (`navigateFallback`).
- **The Worker owns the data** (*Applies*). The URL and `history.state` are
  view state in `AppShell`; no new store slice, no new Worker command (the
  not-here check uses `shelf` and BOOK_TREE → `tree`, both existing).
- **No book without an account** (*Central*). A `/b/<book>` address for a
  book not on this device opens nothing and says nothing about the book
  (workflow 1 L61–66): no title, no owner, no request to the service to
  find out. The app cannot tell "not a member" from "a book of yours not yet
  added here", and must not try. `noindex` is unchanged (origin-wide).
- **Accessibility** (*Central*). Not-here is a full-screen surface built like
  the others: an appbar Back (RAC `Button`), an `h1`/`h2` heading carrying
  the state in words, RAC `Button`s for its actions; focus moves to the
  heading on arrival; axe clean at WCAG 2.1 AA. Moving between places keeps
  the focus behaviour each surface already has.
- **Dev mounts untouched.** `#dev/*` lives in the hash; `place.js` reads and
  writes the pathname only, and the place hook is mounted inside `AppShell`,
  never under a dev mount.
- **No song text in logs** (*Applies*). The service change only widens which
  paths fall back to the shell; it does not touch the request log (the
  existing `logging_test.go` assertion that `/b/abc` is logged as is stays).
- **Canonical form** — *Scoped out*: nothing is written.

## Acceptance criteria

### Behavior delivered

1. **Places and their addresses** (`app/src/shell/place.js`, pure):
   - `/` ↔ `{ tab: 'search' }`; `/books` ↔ `{ tab: 'books' }`;
     `/setlists` ↔ `{ tab: 'setlists' }`.
   - `/b/<book>` ↔ `{ tab: 'search', book }` — search scoped to that one
     book (scope `{ bookId }`). Other scopes (several books, a folder) are not
     addresses: the URL stays at the tab's.
   - `/b/<book>/<path>` ↔ a song (`{ …, song: { bookId, path } }`), or a
     setlist when `path` ends in `.setlist.md` (`{ tab: 'setlists', setlist:
     { bookId, path } }`). With both a song and a setlist open (a song opened
     from a setlist), the URL is the song's.
   - Booting from `/b/<book>/<song path>` also sets the scope to that book, so
     the song's Back lands on the book's songs (workflow 2 §Scope delta).
   - Any other path parses to `null` and the app opens on search with the URL
     replaced by `/`. `/i/…`, `/sign-in/…`, `/recovery-email/…` stay App.jsx's
     boot captures; after capture the URL is replaced by the place the flow
     lands on (`/` until it lands; the invited song anchor's song address once
     `BOOK_CLONED` opens it), never left holding a token.
   - Segments are percent-encoded/decoded through `book-route.js`'s existing
     helpers, extended with `bookPath(bookId)` / a book-only parse.
2. **History** (`app/src/shell/use-place-history.js`, used by `AppShell`):
   - The entry's `history.state` is `{ place, layers, depth }`; `layers` is
     the list of open full-screen surface kinds over the place (`editor`,
     `newSong`, `history`, `files`, `arrange`, `wizard`, `explorer`,
     `account`, `conflicts`, `songConflict`, `play`).
   - Opening a song or setlist, scoping search to a book, and opening a layer
     **push** an entry (depth + 1). Switching tabs **replaces** the entry.
     Modals and dialogs (sharing, add to setlist, the instrument picker,
     restored-save) push nothing — RAC closes them on Escape.
   - Every surface's in-app Back goes through one `back(close)`: when
     `history.state.depth > 0` it calls `history.back()` and lets `popstate`
     apply the previous entry; otherwise it runs `close` and replaces the
     entry with the resulting place. So the in-app Back and the system back
     never disagree.
   - `popstate` applies the entry: the place's slots (`selected`, scope,
     `openSong`, `openSetlist`) are set from it, and every layer not in the
     entry's `layers` is closed by the same setter its Back uses (the editor's
     unsaved edit stays in the working copy, `AppShell.jsx:717-718`). A
     layer is never *re*opened by `popstate` (forward onto a layer entry lands
     on its place) — a closed editor or wizard is not resurrected from
     history.
   - A reload honours the URL only: the place is parsed from the pathname,
     `layers` is dropped and the entry replaced (depth kept, so back still
     walks the earlier entries).
   - A book's id changing under an open place — `BOOK_FORKED` (already
     followed, L377–388) and now `BOOK_ONLINE` (added to the same follower)
     — replaces the current entry with the new id's address.
3. **Not here.** Applying a place from an address (boot or `popstate`) that
   names a book or an item is resolved before its surface mounts, once the
   `shelf` slice has its first value:
   - the book is not on the shelf → `NotHere` *book* state: heading "This
     link doesn’t open a book" (the invited dead link's words), body "It isn’t
     on this device. If you were invited, ask whoever sent it for a new
     invitation; if it’s yours on Estante, add it from Books.", actions *Go
     to Books* (tab `books`) and Back (to `/`). Names nothing about the book.
   - the book is here but the path is not in `bookFileSet` of its tree
     (BOOK_TREE → `tree`) → `NotHere` *item* state: heading "This song isn’t
     in {book}" / "This setlist isn’t in {book}", body "It may have been
     renamed, moved or deleted.", action *Open {book}’s songs* (`/b/<book>`).
   - The URL stays at the address while not-here shows (a reload after adding
     the book resolves again). While resolving, the shell's destination shows;
     no empty reading view ever mounts.
   - Opens from inside the app (a search result, a setlist row) skip the
     check — they come from the index or the tree.
   - The `notHere.*` keys exist in all four locales.
4. **The service serves deep addresses.** `isAssetRequest` exempts paths
   under `b/` (a new `appRoutes = []string{"b"}` beside `linkRoutes`, not
   added to `linkRoutes`, so log redaction is unchanged): `GET
   /b/<book>/<folder>/<name>.cifra.md` returns the shell with 200 on a device
   with no service worker. A missing `/assets/x.js` or a dotted path outside
   `b/` still 404s.

### Tests, by level

**unit**
- `app/src/shell/place.test.js` — URL ↔ place both ways: `/`, `/books`,
  `/setlists`, `/b/<id>`, `/b/<id>/<folder>/<song>.cifra.md`,
  `/b/<id>/<name>.setlist.md`; round-trip `placeFromUrl(urlFromPlace(p))` for
  each; percent-encoded ids and path segments (spaces, accents); a song over
  a setlist yields the song's URL; unknown paths (`/x`, `/b/`, `/books/x`)
  → `null`; a song address's place carries the book scope. Pins DIRECTION
  §3.7 L475, workflow 7 §Links to books L45–50.
- `app/src/books/book-route.test.js` — new cases for the book-only parse and
  build (`/b/<id>` with and without trailing slash; encoded id). Pins
  workflow 7 L41.
- `service/internal/server/app_test.go` `TestAppServedAtRoot` — extended:
  `GET /b/demo/choro/x.cifra.md` and `GET /b/demo/y.setlist.md` → 200, the
  fixture shell; a new `TestAppDottedPathOutsideBStill404s` — `GET
  /assets/missing.js` and `GET /x.cifra.md` → 404. Pins
  service.serve_app's SPA-fallback constraint, workflow 10 §Sharing a song.

**behavior**
- `app/src/shell/AppShell.routing.behavior.test.jsx` (the fake Worker port
  and store `AppShell.behavior.test.jsx` uses, a seeded shelf and tree):
  - 'opening a song pushes its address' — a search result opens; `location.pathname`
    is `/b/<id>/<path>` and `history.length` grew.
  - 'back returns to the place before' — after the song, `history.back()`
    (await `popstate`) shows search again at `/`.
  - 'the in-app Back walks history' — the song's Back button calls back; the
    URL is the previous entry's.
  - 'switching tabs replaces, not pushes' — `history.length` unchanged,
    pathname `/books`.
  - 'a layer is a history step with the same address' — opening the editor
    from the song pushes with the same pathname; back closes the editor and
    leaves the song open.
  - 'forward does not reopen a closed layer'.
  - 'a deep URL opens its screen' — booting at `/b/<id>/<path>` shows the
    song (`group` named for it) with the book scope set; booting at
    `/b/<id>/<name>.setlist.md` shows the setlist; booting at `/b/<id>` shows
    search with the scope chip for the book.
  - 'a fork or put-online follows the address' — `BOOK_FORKED` and
    `BOOK_ONLINE` replace the pathname with the new id.
  - 'an invitation link ends on the song address' — boot at `/i/<tok>#<path>`,
    `BOOK_CLONED` → pathname `/b/<id>/<path>`, no token left in the URL.
  - axe on the shell after a deep boot.
  Pins workflow 7 §Links to books, workflow 1 §Invited, DIRECTION §3.7 L475.
- `app/src/shell/NotHere.behavior.test.jsx`:
  - 'a book not on this device names nothing about it' — boot at
    `/b/unknown/x.cifra.md`: the heading "This link doesn’t open a book", no
    reading view, no book title or id in the rendered text; *Go to Books*
    selects the Books tab.
  - 'a song no longer in the book says so and offers the book' — book on the
    shelf, path absent from the tree (and one present only as `deleted`):
    "This song isn’t in {book}"; *Open {book}’s songs* lands at `/b/<id>`.
  - 'a setlist no longer in the book' — the setlist wording.
  - axe clean on each state.
  Pins workflow 7 L52–60, workflow 1 L61–66, workflow 12 L83–85.

**e2e-api**
- `e2e/api/app.test.js` — new case 'GET /b/<book>/<path>.cifra.md returns the
  same shell (SPA fallback)': 200 and the body equal to `GET /`'s. Pins the
  service change against the real image (the note names no e2e-api level;
  added because the fix is the service's).

**e2e-web** — `e2e/web/tests/routing.spec.js`, on phone, tablet and computer:
- 'a song opened, reloaded and still open' — `openExampleBook`, then
  `openSongFromSearch(page, SONG.search, SONG.title)`; the URL matches
  `/\/b\/[^/]+\/.+\.cifra\.md$/`; `page.reload()`; the song's `group` is
  visible again; axe.
- 'back from a song to its book' — from search, *Search only in {book}* on
  the example book (new helper `scopeToBook(page, bookTitle)` in
  `lib/journeys.js`), URL `/b/<id>`; open the song from the scoped results;
  `page.goBack()`; the URL is `/b/<id>`, the scope chip for the book shows,
  the song is gone; axe on both screens.
- 'back closes the editor before the song' — open the song, *Edit*;
  `page.goBack()` shows the reading view at the same address; another
  `goBack()` returns to search.
- `e2e/web/tests/share.spec.js` — the `test.fixme` at line 202 'a non-member
  opening a book address gets the "does not open" state' is un-fixmed and
  passes unchanged (its assertions match the not-here book heading).
  Pins workflow 1 L61–66, DIRECTION §3.3 L176–183.

## Decisions

1. **`/b/<book>` is search scoped to the book, not the book's detail.**
   *Chosen*: DIRECTION §4 makes books a scope on search, and the person a
   teacher sends `…/b/<book>` to wants the songs (workflow 7). The book
   detail (`BookDetail.jsx`) is management — remove, fork, put online — and
   lists no songs, so "back from a song to its book" could not land there.
   *Rejected*: the file view (`openBook` → `FileView`) — an editing surface,
   and its open file is internal state; the Books tab's detail — see above.
   The search scope is lifted into `AppShell` (like `searchQuery` already is)
   so a place can set it.
2. **Only one-book scope is an address; the query is never one.** Folder and
   multi-book scopes, and the typed query, stay in memory. Workflow 2 resets
   the scope each session so a forgotten filter cannot hide results; an
   address the person chose (a link, a bookmark) is the narrow exception,
   written into workflow 2 §Scope (delta). Putting the query in the URL would
   make search state survive reloads, which workflow 2 does not ask for.
3. **Surfaces over a place are history steps, not addresses.** *Chosen*:
   Android back must close the editor or history before leaving the song, so
   each layer pushes an entry; but an editor, a wizard or a history view is
   not something to bookmark or reopen from a link, and reopening one by
   `popstate` (forward) could resurrect a closed new-song editor. *Rejected*:
   addresses for every surface (`/b/<id>/<path>/edit`, `/history`…) — bakes
   every surface's state into a URL contract for no user promise; and no
   history steps for layers — back from the editor would drop the song too.
4. **Tab switches replace.** The three destinations are siblings; making each
   a step would turn back into a tour of the tab bar. Back from a destination
   leaves the app (or returns to what came before it), as the platform's tab
   apps do.
5. **The History API under the app's own module, no router library.**
   `shell.layout` rejected a routing library as a new runtime dependency; the
   places are five shapes, one pure module and one hook cover them, and the
   render stays the existing if-chain. Recorded in DIRECTION §3.7 (delta).
6. **Not-here is decided on the device, from the shelf and the tree.**
   *Chosen*: offline first, and workflow 1 forbids telling the holder
   anything about a book that is not theirs. *Rejected*: asking the service
   (`GET /api/books/{id}`) whether the account is a member, to offer "add it"
   — it needs the network, and its `404` deliberately conflates "no such
   book" with "not a member" (`books.share` refinement L168–170) so it would
   not help; the copy instead points a member at *Add a book → mine on
   Estante*. The heading reuses the dead-invitation words so both dead ends
   read alike.
7. **The service exempts `b/` from the asset rule with its own list.**
   Adding `b` to `linkRoutes` would also redact `/b/…` in the request log,
   which `logging_test.go` pins as logged unchanged; a separate `appRoutes`
   keeps that decision and changes only the fallback.
8. **`BOOK_ONLINE` joins the fork follower.** A put-online changes the book's
   id (`protocol.js:460-463`); without following it, the open place's
   address would name a local id that no longer resolves. An address
   bookmarked before the put-online shows not-here — accepted: the book
   shows on the shelf under its new id.
9. **The boot captures replace the URL with the landed place, not `/`.**
   Tokens still never linger (account.sign_in Decision 4, add_by_link AC1);
   the landed place is what the address bar should show.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-15.

- Places and addresses: `app/src/shell/place.js` (pure URL ↔ place, `/`, `/books`, `/setlists`, `/b/<book>`, `/b/<book>/<path>`), with `app/src/books/book-route.js` extended by the book-only parse and build; unit tests in `app/src/shell/place.test.js` and `app/src/books/book-route.test.js`.
- History: `app/src/shell/use-place-history.js` (push for songs, setlists, book scope and layers; replace for tab switches; one `back`; `renameBook` for fork/put-online; a reload skips dead same-address steps), wired into `app/src/shell/AppShell.jsx` and `app/src/App.jsx`; search scope lifted into the shell (`app/src/songs/SearchScreen.jsx`). The shell's `<main>` is `aria-busy` while an address resolves.
- Not-here state: `app/src/shell/NotHere.jsx` (book and item states) with `notHere.*` keys in `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Service: `service/internal/server/app.go` serves `/b/…` addresses with a dotted last segment as the shell (log redaction unchanged); `app_test.go` extended (`TestAppServedAtRoot`, new `TestAppDottedPathOutsideBStill404s`).
- Behavior tests: `app/src/shell/AppShell.routing.behavior.test.jsx` (14), `app/src/shell/NotHere.behavior.test.jsx` (5), `beforeEach` URL reset in `AppShell.behavior.test.jsx`; add-by-link clone wait lengthened in `app/src/worker/add-by-link.behavior.test.js`.
- e2e: `e2e/api/app.test.js` (SPA fallback for `.cifra.md`), `e2e/web/tests/routing.spec.js` (3 tests on phone, tablet, computer), `share.spec.js` un-fixmed, `scopeToBook` and `openSongFromSearch` in `e2e/web/lib/journeys.js`.
- Design delta kept: `docs/DIRECTION.md`, `docs/workflows/02-find-and-play.md`, `07-add-a-book.md`.
- Follow-ups registered: `shell.routing_rename_across_reload`, `shell.routing_reload_scope_step`.

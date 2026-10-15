# books.owner_name — The owner's name on a shared book

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji) — `task owner_name "The owner's name on a shared book"`
(line 122), under `books`. Milestone: `milestones.m5_complete`
(`tasks/99-milestones.tji:44`).

## Effort estimate

1d. The task touches four places: one optional field in the contract, one git read in
the service, one shelf register and the copy in the app. Each change is small.

## Repository

Not `cifra.md:`. The work lands in this repository:

- `api/`: `openapi.yaml`, the `Book` schema.
- `service/`: `internal/book/book.go` and `internal/server/{books,sharing}.go`, with
  their tests.
- `app/`: `src/worker/` (`books-client.js`, `logic.js`), `src/books/`
  (`mine-on-estante.js`, `BookDetail.jsx`, `LeaveDialog.jsx`, `BooksScreen.jsx`) and
  `src/i18n/locales/*.js`.
- `docs/`: `home-book-format.md` §4.2 (the new `owner` register) and the
  DIRECTION §3.3 delta, which this refinement already wrote.
- Tests: `e2e/api/` and `e2e/web/`.

## Inherited dependencies

- `books.leave`: settled (`complete 100`). It shipped `LeaveDialog.jsx`, the Leave
  card in `BookDetail.jsx` and the *Mine on Estante* row's Leave. The copy reads
  *The owner can invite you again*, and its Decision 5
  (`tasks/refinements/books/leave.md:396-409`) registered this task to name the
  owner.
- Settled, needed to drive the tests:
  - `books.online`, `books.add_by_link`, `service.sharing`: a hosted book, and a
    member who joined by invitation.
  - `account.sign_in`: the home book is attached and pushed on sign-in.
  - `service.home_book`: the owner's home book on the service.
  - `foundation.e2e_api`, `foundation.e2e_web`: the e2e harnesses.

## What this task is

A member of a shared book sees who shares it with them.

1. The API's `Book` gains an optional `ownerName`. The service fills it, for a caller
   who is not the owner, from the owner's name: the `authorName` register in the
   owner's home book (`preferences.json`). The field is absent when the owner never
   set a name.
2. The Worker keeps that name on the shelf in a new `owner` register.
   - It writes the register when a member's book comes onto the shelf, by
     invitation or from *Mine on Estante*.
   - It refreshes the register when *Mine on Estante* lists the account's books.
3. Book management reads the name in two places:
   - the role chip reads *On Estante · shared by Ana*;
   - the Leave confirmation says *Ana can invite you again*. This applies on the
     book and on the *Mine on Estante* row.

Workflow 10 and the Leave-book board draw both.

When no name is known, the chip reads *On Estante · shared* and the sentence keeps
*The owner can invite you again*.

## Why it needs to be done

`books.leave` shipped the copy with a known gap from what was drawn (its Decision 5).

- Workflow 10 §Leaving a book (`docs/workflows/10-share.md:103-105`) says the
  confirmation "names the book and its owner".
- The Leave-book board draws *shared by Ana* and *Ana can invite you again*.

The chip also matters on its own. Today a member's book reads *On Estante ·
private* (`BookDetail.jsx:370-372`), which is wrong for a book someone shared with
you.

`books.share_people` (W10, people named and not shown as raw ids) is a separate
task. It can reuse the service-side seam this task adds, `Store.ReadAuthorName`,
for `Member.displayName`. This task does not fill that field.

## Inputs / context

**Governing:**

- Workflow 10 §Leaving a book, `docs/workflows/10-share.md:87-144`:
  - L103-105: the confirmation names the owner;
  - L116-117: from *Mine on Estante*, the sentence alone.
- Workflow 10 §Who sees whom, `docs/workflows/10-share.md:71-75`: "Members see who
  the owner and the editors are — their names are in the history anyway". This is
  why the name may reach every member.
- `docs/mockups/Leave-book.dc.html`:
  - L36 `On Estante · shared by Ana` (reader, phone);
  - L96 `On Estante · shared by Marina Costa` (editor, tablet);
  - L73 and L122, the on-device sentence ending *Ana / Marina Costa can invite you
    again.*;
  - L198, the *Mine on Estante* sentence;
  - L166-167, the owner's chips *On Estante · private* / *You own it*, which are
    unchanged.
- DIRECTION §3.3 (`docs/DIRECTION.md:164-176`): commits are authored with the
  no-reply address, and **the delta below**.
- `docs/home-book-format.md`:
  - §4.1 (L213-217), `authorName`: "the author's display name, as it will appear in
    a song's history";
  - §4.2 (L236-290), `shelf.json` `books.<id>` registers.

**Predecessor:** `tasks/refinements/books/leave.md`. Decision 5 (L396-409) and the
deferred-task note (L349-361).

**Earlier decision this task revisits:** `tasks/refinements/service/sharing.md:577-584`,
"No display name is stored or returned", rejected an `accounts.name` column. This
task still stores no name on the service. It reads the name the owner already
publishes in their history (Decision 1).

**Seams:**

*Contract*

- `api/openapi.yaml:1359-1382`, `Book`: `additionalProperties: false`, required
  `[id, title, role, visibility, gitUrl]`, optional `original`.
- Other operations that return `Book`: `listBooks` (L464-480), `createBook`,
  `forkBook` and `acceptInvitation`.
- `Member.displayName` (L1487-1489) is the precedent for an optional name.

*Service*

- `service/internal/server/books.go`:
  - L162-236, `handleListBooks`. The SQL is at L183-190. It needs `b.owner_id`
    added.
  - L49-56, `bookJSON`.
  - ~L415-430, the fork path.
- `service/internal/server/sharing.go`:
  - L623-650, `composeBookJSON`, used by accept at L466-479;
  - L117-123, the comment on why `displayName` is unset.
- `service/internal/book/book.go:96-106`, `ReadTitle` (`cat-file -p
  refs/heads/main:README.md`). This is the model for the new read.
- Home book: `books.kind = 'home'`, unique per `owner_id`
  (`service/internal/db/migrations/0005_one_home_book.sql:16`).
- Tests:
  - `service/internal/server/books_test.go:147-155`. The `listBooks` helper
    validates every response against the contract.
  - `books_test.go:221`, `TestListBooksReturnsOwnedSharedAndForks`.
  - `sharing_test.go:397`, `TestAcceptInvitation`.

*App*

- `app/src/worker/books-client.js:37-47`, the `Book` JSDoc typedef, and L122-129,
  `list()`.
- `app/src/worker/logic.js`:
  - L913-951, `cloneOntoShelf`. It is shared by ADD_BY_LINK (L2304) and ADD_MINE
    (L2338).
  - L2354-2379, LIST_MINE.
- `app/src/books/mine-on-estante.js:45-70`, `booksNotOnShelf`. It maps
  `{ id, label, gitUrl, role }`.
- `app/src/worker/shelf.js`. The projection is generic over registers, so a new
  `owner` register flows through it unchanged.
- `app/src/books/BookDetail.jsx`:
  - L370-380, the chips;
  - L264, the role;
  - L492-516, the Leave card.
- `app/src/books/LeaveDialog.jsx:114-117`, the sentence. It is also used from
  `BooksScreen.jsx:48` (the *Mine on Estante* row).
- `app/src/i18n/locales/en.js`:
  - L101 `onEstante`, L161 `private`;
  - L213-215 `leaveTitle` / `leaveSentence` / `leaveSentenceRemote`.
  - `pt-BR.js`, `es-419.js` and `it.js` have the same keys.

*Tests to extend*

- `app/src/books/BookDetail.behavior.test.jsx`:
  - L77, the Estante chips;
  - L506 onward, the `Leave this book` describe.
- `app/src/books/MineOnEstante.behavior.test.jsx`.
- `app/src/worker/add-by-link.behavior.test.js`.
- `app/src/worker/books-client.test.js`.
- `e2e/api/sharing.test.js` (L92, L199) and `e2e/api/home-book.test.js:131`, which
  shows how to push a home book with git.
- `e2e/web/tests/leave-book.spec.js`:
  - `ownerAndReader` (L32-40);
  - L55, leave from book management;
  - L98, leave from the *Mine on Estante* row.
- Helpers in `e2e/web/lib/journeys-share.js`:
  - `hostedBookWithSong` (L45) saves through the sheet as *Marina Souza*
    (`writeSongInBook` L23, `saveThroughSheet`), which writes the owner's
    `authorName`;
  - `inviteThroughShare`, `acceptInvitation`.

## Constraints / requirements

- **The contract first.** `api/openapi.yaml` gains the field before the service emits
  it. `additionalProperties: false` makes every Go handler test that validates a
  response fail otherwise.
- **The service stores no name** (DIRECTION §3.3 as amended):
  - no migration and no `accounts` column;
  - the name is read from the owner's home book at request time;
  - the name is never logged, like a title or a label (standing rule: no song text,
    and by extension no user-chosen strings, in logs).
- **Only members are told.** `ownerName` is present only when:
  - the caller's role is `editor` or `reader`; and
  - the owner's home book holds a non-tombstoned, non-empty `authorName` string.

  Consequences:

  - It is never present on `createBook` or `forkBook`, where the caller is the
    owner.
  - It is never present on an owner's own listing.
  - It is present on `acceptInvitation`, through `composeBookJSON`, so the joiner's
    first shelf write carries it.
- **One read per owner per request.** `handleListBooks` caches the name by
  `owner_id` within the request: a member of five books of one owner costs one
  `cat-file`. A missing home book, no `main`, unparsable JSON or an absent or
  tombstoned register all mean "no name". None of them is ever an error for the
  list.
- **Offline first.** The chip and the confirmation read the shelf register, never
  the network. The *Mine on Estante* row reads the listing it already holds.
- **Canonical home book.** The `owner` register is a §3 register `{value, at}`,
  written through the existing shelf write path so the hook accepts it (the
  hook checks canonical form, not a key list). `docs/home-book-format.md` §4.2
  documents it. Like `role`, it is a hint for display and never an authority.
- **Copy and i18n.** New keys in all four locales:
  - `books.sharedBy` = `shared by {owner}`;
  - `books.shared` = `shared`;
  - `books.leaveSentenceNamed` and `books.leaveSentenceRemoteNamed`. These are the
    existing two sentences with `{owner} can invite you again.`
  - The unnamed sentences stay as the fallback.
- **Accessibility.** The chip is text, so the name is a word and not a colour. The
  dialog stays a React Aria `Modal`/`Dialog`, and is axe clean at WCAG 2.1 AA.

## Acceptance criteria

**Behavior delivered**

1. `GET /api/books`, as a reader or editor of a book whose owner has set an
   `authorName`, returns that book with `ownerName: "<authorName>"`. Without a name
   the field is absent. As the owner, the field is absent.
2. `POST` accept-invitation returns the `Book` with `ownerName` on the same terms.
3. A book that comes onto the shelf by invitation or from *Mine on Estante* is written
   with an `owner` register when the `Book`/row carries a name. LIST_MINE refreshes
   the `owner` register of every on-shelf book in the listing whose name differs.
4. BookDetail, for a hosted book whose role is not `owner`:
   - with a name, the chip reads *On Estante · shared by Ana*;
   - without one, *On Estante · shared*;
   - the owner's chips are unchanged (*On Estante · private*, *You own it*).
5. The Leave confirmation reads *… Ana can invite you again.* both on the book and on
   the *Mine on Estante* row, with the name from the register or the row. Without a
   name it keeps *The owner can invite you again.*
6. `docs/home-book-format.md` §4.2 lists the `owner` register: the owner's name as
   the service last gave it, a display hint only.

**Tests, by level**

The note's `Tests:` clause, sharpened.

- **unit**
  - `service/internal/book/book_test.go` — `TestReadAuthorName`. It runs against
    real git repos in a temp dir and covers:
    - a home book with `authorName` gives the name;
    - a tombstone, an absent key, no `main`, no `preferences.json` and malformed
      JSON each give `ok=false`.

    Pins home-book-format §4.1 and §5.3.
  - `api/validate.test.js` — a `listBooks` 200 `RESPONSE` describe: a `Book` with
    `ownerName` passes, one without it passes, and a non-string `ownerName` is
    rejected. Pins the contract shape.
  - `app/src/books/mine-on-estante.test.js` — `booksNotOnShelf`: the row carries `ownerName` through, and is absent when
    the `Book` has none.
- **behavior**
  - `service/internal/server/books_test.go` — `TestListBooksOwnerName`. Every
    response goes through the contract validation in the `listBooks` helper. It
    covers:
    - an owner whose home book holds `authorName` (pushed with the git CLI);
    - an editor and a reader each see `ownerName`;
    - the owner's own listing has none;
    - a second owner with no home book or no name: field absent, list still 200.
  - `service/internal/server/sharing_test.go` — `TestAcceptInvitation` asserts
    `ownerName` on the accept 200 (workflow 10 §Leaving a book; DIRECTION §3.3).
  - `app/src/worker/add-by-link.behavior.test.js` — accepting a `Book` with
    `ownerName` writes the shelf `owner` register.
  - In the same file or `MineOnEstante.behavior.test.jsx`: ADD_MINE writes the
    register, and LIST_MINE refreshes it for an on-shelf book. Pins
    home-book-format §4.2.
  - `app/src/books/BookDetail.behavior.test.jsx`:
    - a reader's book with `owner` "Ana" shows *On Estante · shared by Ana*;
    - without a name it shows *On Estante · shared*;
    - the owner's chips are unchanged;
    - the Leave confirmation reads *Ana can invite you again.*;
    - axe clean.

    Pins the Leave-book board L36/L73 and workflow 10 L103-105.
  - `app/src/books/MineOnEstante.behavior.test.jsx` — a row with `ownerName` "Ana"
    leads to a confirmation reading *You will no longer open or sync it, on any of
    your devices. Ana can invite you again.*; axe clean. Pins board L198 and
    workflow 10 L116-117.
- **e2e-api**
  - `e2e/api/sharing.test.js` — "a member's listBooks carries the owner's name":
    1. the owner signs in and pushes a home book with `preferences.json`
       `authorName` (the git CLI, as `home-book.test.js` does);
    2. the owner creates a book and invites;
    3. a second account accepts. The accept response and the second account's
       `GET /api/books` carry `ownerName`, and the owner's own listing does not.
- **e2e-web**
  - `e2e/web/tests/leave-book.spec.js`. `ownerAndReader` already makes the owner
    save as *Marina Souza* (`hostedBookWithSong` → `writeSongInBook` →
    `saveThroughSheet`), which pushes the owner's home book on sync. The cases:
    - the L55 case is extended: the reader's book management shows *On Estante ·
      shared by Marina Souza*, and the Leave confirmation reads *Marina Souza can
      invite you again.*;
    - the L98 *Mine on Estante* case is extended: the row's confirmation names
      *Marina Souza*.

    Both run on phone, tablet and computer, with axe on book management and the
    dialog.

    If the owner's home book has not reached the service by the time the reader
    accepts, the journey waits for the owner's sync through the UI before sending
    the invitation (the owner's sync indicator reads saved/up to date). It never
    injects state.

No follow-up task is deferred.

## Decisions

1. **The name comes from the owner's home book `authorName`, read by the service. The
   service stores no name.**
   - Chosen:
     - `Store.ReadAuthorName(ctx, homeBookID)` does `cat-file -p
       refs/heads/main:preferences.json` and reads `authorName.value`;
     - the handler finds the home book by `owner_id` and `kind = 'home'`.
   - Rationale:
     - It is the one name the person chose (workflow 4 §Who made the change).
     - It is already in the history of every book they save to, so telling that
       book's members discloses nothing new (workflow 10 §Who sees whom: "their
       names are in the history anyway").
     - It needs no new write path, no migration and no UI to set a name.
   - Rejected, an `accounts.display_name` column: it needs an endpoint and a UI to
     set it, plus a sync from `authorName`. That is a second copy of the same fact,
     and `service.sharing` already rejected it because no workflow collects a name.
   - Rejected, scanning the shared book's own history for the owner's no-reply
     address: it is a `git log` per book per list. It finds nothing when the owner
     never committed under their account, and *Mine on Estante* rows (not cloned)
     still need the service to answer.
   - Design delta: DIRECTION §3.3 (`docs/DIRECTION.md`, the paragraph after the
     no-reply address) now says the service stores no name and reads `authorName`
     to tell a book's members who shares it.
2. **`ownerName` only for a non-owner caller, and optional.**
   - The owner knows their own name, and `createBook`/`forkBook` would pay a git read
     for nothing.
   - An absent field keeps every existing response valid, which matches the
     `Member.displayName` precedent.
   - Rejected, a required nullable field: it adds a read on every owner-side
     response and is a breaking shape change for no gain.
3. **The app keeps the name in a new shelf `owner` register, written on arrival and
   refreshed by LIST_MINE.**
   - The chip and the confirmation must render offline, so the name has to be on
     the device. The shelf entry is where `role` already lives as a display hint.
   - The shelf projection (`shelf.js`) and the hook's canonical check are generic
     over registers, so nothing else changes.
   - Rejected:
     - a separate per-device cache, which would not follow the account to its
       other devices;
     - refreshing on every book sync, which is a per-book API call where sync is
       pure git today.
   - What is accepted: a name changed later, or a book that reached the shelf
     before this task, shows *shared* until the next *Mine on Estante* listing.
     That is a display hint going stale, never wrong access.
4. **The fallback is *shared*, not *private*, on a member's book.** The current
   *On Estante · private* is wrong for a member, whatever the name. A member's book
   is shared by definition, and the board draws *private* only for the owner.
5. **Separate named sentences, not a substituted "{owner}" in one string.** The
   four locales put the owner in different grammatical places. The unnamed sentences
   stay as the fallback, so translators see two whole sentences, not a fragment.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- api/openapi.yaml, api/validate.test.js: `Book` gains an optional `ownerName`; the contract test pins a `listBooks` response carrying it.
- service/internal/book/book.go (`ReadAuthorName`), service/internal/server/{books,sharing}.go: the service reads the owner's home-book `authorName` (`preferences.json`) for a non-owner caller in `listBooks` and `acceptInvitation`; absent when the owner set none. No name is stored on the service.
- app/src/worker/{books-client,logic,protocol}.js: the shelf keeps the name in a new `owner` register, written when a member's book comes onto the shelf (invitation, *Mine on Estante*) and refreshed when *Mine on Estante* lists.
- app/src/books/{BookDetail,BooksScreen,LeaveDialog}.jsx, mine-on-estante.js, app/src/i18n/locales/{en,es-419,it,pt-BR}.js: the role chip reads *On Estante · shared by {owner}*, the Leave confirmations read *{owner} can invite you again*; with no name known, *shared* and *The owner can invite you again*.
- docs/home-book-format.md (§4.2 `owner` register), docs/DIRECTION.md (§3.3 delta).
- Tests: unit `book_test.go` TestReadAuthorName, `mine-on-estante.test.js`; behavior `books_test.go` TestListBooksOwnerName, `sharing_test.go` TestAcceptInvitation, `add-by-link.behavior.test.js`, `BookDetail.behavior.test.jsx`, `MineOnEstante.behavior.test.jsx`; e2e-api `e2e/api/sharing.test.js`; e2e-web `e2e/web/tests/leave-book.spec.js` (helper `ownerNameOnService` in `e2e/web/lib/journeys-share.js`).
- Fixer changes: `app/src/worker/leave.behavior.test.js` (waits on INDEX_STATUS events instead of re-sending SEARCH) and `e2e/api/lib/git.js` (no stdin pipe without input; EPIPE on stdin ignored).
- Deviation: the e2e-web journey seeds the owner's `authorName` onto the service through a fixture (git CLI push of `preferences.json`), because the web app does not yet push its home book (`account.new_device`); the joiner's chip and both confirmations are driven through the real UI.

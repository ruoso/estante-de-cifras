# books.leave — Leave this book

## TaskJuggler entry

Defined in [`tasks/65-books.tji`](../../65-books.tji) (L108-113):

```
task leave "Leave this book" {
  effort 1d
  allocate team
  depends !online, service.leave_book, design.leave_book
  note "As design.leave_book decides: the Leave verb in book management for a
        member, its confirmation with unsaved changes and unpushed saves
        counted, then the book removed from this device and Mine on Estante no
        longer offering it. Source: tasks/parking-lot.md 2026-10-14. Tests:
        behavior (the verb shown to members and not owners; the confirmation;
        axe); e2e-web (a member leaves on the stack and the book is gone from
        the shelf and from Mine on Estante; axe)."
}
```

In plain language: a reader or an editor of a shared book can now end their own
membership from the app. Book management gets a **Leave this book** card below
*Remove from my shelf*, shown only to a member. Its confirmation counts what this
device would lose. When the person confirms, the Worker calls the service's
`leaveBook` first, then removes the clone exactly as *Remove from my shelf* does.
The book is gone from the shelf, and *Mine on Estante* no longer offers it. A
*Mine on Estante* row also offers **Leave**, so a book already removed from this
shelf can be left without adding it back. Leaving needs a connection; offline,
the verb says so and nothing changes.

## Effort estimate

**1d**, allocated `team`, as scoped. The day covers:

- a new `leave(bookId)` method on the Worker's `books-client.js`;
- one new Worker command (`LEAVE_BOOK`) that reuses the `REMOVE_BOOK` teardown;
- two new events (`BOOK_LEFT`, `LEAVE_FAILED`) and the reducer fold that drops a
  left book from the `mine` slice;
- the `LeaveDialog` and the Leave card in `BookDetail.jsx`, and a Leave button on
  each `MineList` row;
- the i18n keys in the four locales;
- the named tests.

There is no service change, no API-contract change and no format work.
`service.leave_book` landed the endpoint.

## Repository

**This repository only, not `cifra.md/`.** The work lands in `app/` and in the
`e2e/web/` harness:

- `app/src/worker/books-client.js` (+ `books-client.test.js`)
- `app/src/worker/protocol.js`, `app/src/worker/logic.js`, `app/src/worker/reducer.js`
- `app/src/books/BookDetail.jsx` (+ `BookDetail.behavior.test.jsx`)
- `app/src/books/BooksScreen.jsx` (`MineList`) (+ `MineOnEstante.behavior.test.jsx`)
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`
- a new Worker behavior test, `app/src/worker/leave-book.behavior.test.js`
- a new e2e-web spec, `e2e/web/tests/leave-book.spec.js`

## Inherited dependencies

All are settled (`complete 100`):

- **`books.online`** — book management (`BookDetail.jsx`); *Remove from my shelf*
  and its `REMOVE_BOOK` teardown; the service-first-then-local shape of
  `DELETE_BOOK`. See [online.md](online.md).
- **`service.leave_book`** — `DELETE /api/books/{bookId}/membership`
  (`leaveBook`) at `api/openapi.yaml:668-692`, with these answers:
  - `204` left;
  - `401` no session;
  - `404` not a member, or the home book (also deleted and taken-down books);
  - `409` `owner_cannot_leave`.

  The leave takes effect at the caller's next request. The book is then absent
  from `listBooks`, answered `gone` on the change check, and refused to git. The
  handler is `service/internal/server/sharing.go:805-860`. See
  [../service/leave_book.md](../service/leave_book.md).
- **`design.leave_book`** — workflow 10 §Leaving a book
  (`docs/workflows/10-share.md:87-144`) and the board
  `docs/mockups/Leave-book.dc.html`. See
  [../design/leave_book.md](../design/leave_book.md).

Transitively settled, and reused here:

- `books.add_by_link` — *Mine on Estante* and invitations;
- `books.fork` — the *Make it my own* sheet;
- `sync.lost_access` — the `gone` phase on the person's other devices;
- `account.sign_out` — the per-book survey `SURVEY_SIGN_OUT`.

## What this task is

The app half of leaving one shared book, built as workflow 10 §Leaving a book
decides and the Leave-book board draws.

1. **The verb.** In `BookDetail`, a *Leave this book* card sits below the *Remove
   from my shelf* card. Its body reads *Stop following it on all your devices.*
   (board L103-106), and its button is a danger button.
   - It is shown only when the book is hosted (not local), is not the home book,
     and has a role of `reader` or `editor`.
   - It is not shown when the book's sync phase is `gone` (already removed by the
     owner: "there is nothing to leave", workflow 10 L141-143) or `taken_down`
     (Decision 6).
   - An owner sees *Delete the book* in that place, as today.
2. **The confirmation** is a RAC `AlertDialog` titled *Leave {book}?* with the
   sentence *You will no longer open or sync it, on any of your devices, and it
   is removed from this one. The owner can invite you again.* (owner name:
   Decision 5). It counts what would be lost, as workflow 10 L106-113 has it:
   - **unsaved changes** — *{n} songs with unsaved changes will be lost*, with
     the song titles as the board lists them;
   - **saves not yet pushed** (an editor) — *{n} saves have not reached the book
     and never will*, with **Make it my own first** and **Download first** beside
     **Leave the book**:
     - *Make it my own first* closes the dialog and opens the existing
       `MakeYourOwn` sheet;
     - *Download first* sends `DOWNLOAD_BOOK` and leaves the dialog open.
   - With nothing to lose, the dialog shows only the sentence, **Leave the book**
     and **Cancel**. There is no typed name.
3. **From Mine on Estante.** Each `MineList` row offers **Leave** beside
   **Add**, as on the board's computer panel (L143). It opens the same dialog
   without counts and without the "removed from this one" clause (board L192:
   *You will no longer open or sync it, on any of your devices. The owner can
   invite you again.*).
4. **What it does.** The view sends `LEAVE_BOOK {bookId, author}` to the Worker.
   - The Worker calls `booksClient.leave(bookId)`.
   - On `204`, or on `404` (Decision 3), it runs the same teardown as
     `REMOVE_BOOK`, provided the book is on this shelf:
     - remove the clone under the book's lock;
     - tombstone the shelf registers;
     - drop the book from the search index;
     - flush.
   - It then replies `BOOK_LEFT {bookId}`. The reducer drops the book from the
     `mine` slice. `BookDetail` closes on it, as it does on `BOOK_REMOVED`.
   - On a network failure, a `401` or a `409`, nothing local is touched, and the
     Worker replies `LEAVE_FAILED {bookId, reason: 'network' | 'refused'}`. The
     dialog stays open and says *You did not leave {book}. You are still a
     member.* (the state the design left undrawn; Decision 7).
5. **Offline.** While `useOnline()` is false, the card's button is disabled. The
   card body reads *Leaving needs a connection. Nothing has changed; you are
   still a member.* (board L192), as a `role="status"` line. *Mine on Estante*
   already needs the network to list, so its rows need no separate offline copy.

## Why it needs to be done

Until now, a member's only exits were *Remove from my shelf* and deleting the
whole account:

- *Remove from my shelf* keeps the membership, so *Mine on Estante* offers the
  book back (workflow 7 L132-137).
- Deleting the account (workflow 17) is far more than leaving one book.

The parking-lot entry of 2026-10-14 raised the gap. `design.leave_book` decided
the fix and `service.leave_book` built the endpoint; this task is the last piece,
and `milestones.m5_complete` depends on it.

## Inputs / context

**Governing:**

- `docs/workflows/10-share.md:87-144` §Leaving a book:
  - where the verb sits: L95-101;
  - the confirmation and its counts: L103-117;
  - service first, then the device: L119-125;
  - needs a connection, and the failure state: L127-130;
  - edge cases: L135-143.
- `docs/workflows/07-add-a-book.md:132-137` — Remove is not leaving.
- `docs/workflows/08-sync.md:64` §Losing access — what the person's other devices
  see. Nothing to build there: `sync.lost_access` already turns a `gone` change
  check into *no longer shared with you*.
- `docs/DIRECTION.md`:
  - L393-396 (§3.6 the API, Sharing);
  - L593-599 (§6, leaving one shared book).
- `docs/mockups/Leave-book.dc.html`:
  - reader phone, the verb cards and the dialog with unsaved changes: L26, L72-77,
    L103-106;
  - editor tablet, saves not pushed, the fork and the download: L87, L121-134;
  - computer, after leaving and *Mine on Estante* with Leave: L143;
  - the row dialog and the offline inset: L192.
- `api/openapi.yaml:668-692` — `leaveBook`; L1029-1033, the Conflict response.

**Seams this task extends:**

- `app/src/books/BookDetail.jsx`:
  - the role and phases: L213-242;
  - the event hooks `BOOK_REMOVED` → `onBack`: L269-271;
  - the command senders: L277-288;
  - `RemoveDialog`: L90-141, the shape the `LeaveDialog` follows;
  - the Remove card: L423-433;
  - the Delete card: L449-455;
  - the `MakeYourOwn` sheet: L253, L284, L460.
- `app/src/worker/logic.js`:
  - `REMOVE_BOOK` (the teardown to factor out and share): L2015-2051;
  - `DELETE_BOOK` (service first, then local): L2053-2083;
  - `SURVEY_SIGN_OUT` (per-book `unsavedSongs` and `savesWaiting`): L2086-2135;
  - `LIST_MINE`: L2315-2342;
  - `ensureBooksClient`: L538.
- `app/src/worker/books-client.js` — `remove` at L136 is the pattern for
  `leave`.
- `app/src/worker/protocol.js` — the command docs and enum at L106-126.
- `app/src/worker/reducer.js` — the `mine` slice at L138-143 and L596.
- `app/src/books/BooksScreen.jsx` — `MineList` at L284-340, rendered at L472;
  `LIST_MINE` and `ADD_MINE` at L623-630.
- `app/src/account/use-online.js` — `useOnline()`, reused.
- `app/src/account/SignOutDialog.jsx:92` and `LeaveDialogs.jsx:153` — the two
  existing consumers of `SIGN_OUT_SURVEY`.

**Tests to model on:**

- `app/src/books/BookDetail.behavior.test.jsx` — `makeStore` at L21-27; the
  `memberShelf` and `hostedShelf` fixtures at L38-58; the Remove-loss test at
  L127.
- `app/src/books/MineOnEstante.behavior.test.jsx`.
- `app/src/worker/online.behavior.test.js` and `books.behavior.test.js` — Worker
  behavior tests against fake IndexedDB and a loopback service.
- `e2e/web/tests/lost-access.spec.js:43` — an owner and a member on two devices.
- `e2e/web/tests/add-by-link.spec.js:250` — *Mine on Estante*, inline.

**e2e journeys:**

- `e2e/web/lib/journeys-share.js` — `hostedBookWithSong` L45,
  `inviteThroughShare` L116, `acceptInvitation` L128.
- `e2e/web/lib/devices.js:11` — `openDevice`.
- `e2e/web/lib/journeys.js` — `enableVirtualAuthenticator` L65, `syncNow` L194;
  `context.setOffline` as `networkBlip` (L171) uses it.
- `e2e/web/lib/journeys-sync.js:71` — `openBookRow`.
- `e2e/web/lib/axe.js` — `analyzeWcag21aa`.

## Constraints / requirements

1. **Service first, then the device** (workflow 10 L119-120). The Worker never
   tears down the clone before the service answers `204` or `404`. A refused or
   unreachable leave leaves the shelf, the clone, the index and the sync state
   exactly as they were.
2. **The Worker owns the data and the network call.** The main thread sends
   `LEAVE_BOOK` and never calls the service for this or touches IndexedDB. This
   matches `DELETE_BOOK`; the main-thread `sharing-client.js` stays the owner's
   people screen (Decision 1).
3. **One teardown.** The local removal is the `REMOVE_BOOK` code path, factored
   into a helper that both commands call. It is not a copy.
4. **Members only.** The card is never rendered for an owner, a local book, the
   home book, a `gone` book or a `taken_down` book. The *Mine on Estante* Leave
   is offered only on rows whose `role` is not `owner`. The service's `409`
   still guards the owner case.
5. **Counts come from the Worker.** The dialog sends `SURVEY_SIGN_OUT` when it
   opens and reads this book's entry (`unsavedSongs`, `savesWaiting`) from the
   `SIGN_OUT_SURVEY` reply (Decision 2). The *Leave the book* button is pressable
   before the survey arrives; the counts appear when it does.
6. **Accessibility.**
   - RAC `Button`, `Modal` and `AlertDialog` throughout.
   - The confirmation's danger action is labelled by its word, *Leave the book*,
     not by colour.
   - The failure line and the offline line are `role="status"` text.
   - Keyboard: Escape cancels; focus returns to the card's button.
   - The dialog renders inside the `.est` portal container
     (memory: RAC overlays portal outside the theme root).
   - axe at WCAG 2.1 AA in every behavior test that renders a new surface, and
     on every e2e screen.
7. **Copy.** Every new string is an i18n key in all four locales (`en`, `pt-BR`,
   `es-419`, `it`), with plural forms for the counts as `books.removeLoss` has
   them (`en.js:187`).
8. **No song text in logs.** The Worker logs nothing new.
9. **Test fixtures** use the songs the existing journeys write for the purpose.

## Acceptance criteria

**Behavior delivered:** items 1-5 of *What this task is*. After a leave on the
stack:

- the book is not on the leaver's shelf;
- the Add-a-book sheet's *Mine on Estante* does not list it;
- the leaver's git access is refused (pinned at the service by `service.leave_book`).

**Tests, by level:**

- **unit** (an addition: a pure client method gets its unit test) —
  `app/src/worker/books-client.test.js`, new cases for `leave(bookId)`:
  - it sends `DELETE /api/books/{id}/membership` with credentials and resolves
    on `204`;
  - it throws an error whose `.status` is `404`, `409` or `401`;
  - a thrown fetch surfaces as a network error.

  Pins `api/openapi.yaml:668-692`.
- **behavior (Worker)** — `app/src/worker/leave-book.behavior.test.js`, against
  fake IndexedDB, a local git remote and a loopback `fetch` standing in for the
  service:
  - (a) a member's book on the shelf: `LEAVE_BOOK` calls the endpoint, then the
    clone is gone, the shelf registers are tombstoned, the book is out of the
    search index, and `BOOK_LEFT` is emitted;
  - (b) a `404` is treated as left: same result (Decision 3);
  - (c) a network failure, a `401` and a `409` each emit `LEAVE_FAILED`; the
    clone, the shelf entry and the unpushed commit are untouched (workflow 10
    L119-120, L128-130);
  - (d) a book not on this shelf (the *Mine on Estante* case): the endpoint is
    called, `BOOK_LEFT` is emitted, and nothing local is touched;
  - (e) the reducer folds `BOOK_LEFT` by dropping the book from the `mine` slice.
- **behavior (view)** — `app/src/books/BookDetail.behavior.test.jsx`, new cases:
  - the *Leave this book* card is shown to a reader and to an editor. It is not
    shown to an owner (who sees Delete), a local book, a `gone` book or a
    `taken_down` book (workflow 10 L95-101, L141-143);
  - the confirmation with nothing to lose shows the sentence, *Leave the book*
    and *Cancel*, and no typed name (L114-116);
  - with a survey entry of 2 unsaved songs and 3 saves waiting:
    - both counts are shown (L106-113);
    - *Make it my own first* opens the fork sheet;
    - *Download first* sends `DOWNLOAD_BOOK`;
  - *Leave the book* sends `LEAVE_BOOK {bookId}`;
  - `BOOK_LEFT` calls `onBack`;
  - `LEAVE_FAILED` keeps the dialog open with *You did not leave …* (L128-130);
  - offline (an `offline` event dispatched on `globalThis`): the button is
    disabled and the card says *Leaving needs a connection* (L127-128);
  - Escape cancels and sends nothing;
  - axe clean on the card, on the dialog with counts, and on the failure state.
- **behavior (view)** — `app/src/books/MineOnEstante.behavior.test.jsx`, new
  cases:
  - a reader's row offers *Leave*;
  - the dialog is the sentence alone, with no counts and no "removed from this
    one" (L116-117; board L192);
  - confirming sends `LEAVE_BOOK`;
  - on `BOOK_LEFT` the row is gone;
  - axe clean.
- **e2e-web** — `e2e/web/tests/leave-book.spec.js`, run on the phone, tablet and
  computer projects. Each case uses an owner device (`hostedBookWithSong`,
  `inviteThroughShare`) and a joiner made with `openDevice`,
  `enableVirtualAuthenticator` and `acceptInvitation`. All through the real UI:
  1. **A reader leaves from book management.**
     - The joiner opens the book (`openBookRow`) and sees *Leave this book*.
     - They confirm. The book's row is gone from the shelf.
     - They open Add a book: *Mine on Estante* does not list the book.
     - The owner opens Share: the joiner is no longer listed.
     - axe on book management and on the open confirmation (workflow 10
       L119-125).
  2. **Leaving from Mine on Estante.**
     - The joiner removes the book from the shelf (*Remove from my shelf*).
     - *Mine on Estante* lists it with *Leave*. The joiner leaves from the row,
       and the row is gone.
     - After reopening the sheet, the book is still not listed.
     - axe on the sheet and the dialog (L99-101, L116-117).
  3. **Offline, then online.**
     - The joiner's context goes offline (`context.setOffline(true)`). The card
       says *Leaving needs a connection* and the button is disabled. The book is
       still on the shelf.
     - Back online, the leave goes through (L127-128).
     - axe on the offline card.

  The owner's own book management shows *Delete the book* and no *Leave this
  book*. That is asserted in case 1 on the owner's page, so the "not owners" half
  is also pinned end to end.

**Deferred (closer registers in WBS):**

- **`books.owner_name`** — 1d, area `books`, not `cifra.md:`, milestone
  `milestones.m5_complete`. Note: "The Book in `listBooks` carries the owner's
  display name (`api/openapi.yaml` first, then the service's `GET /api/books`);
  the Worker keeps it in the shelf register; BookDetail's role chip reads *On
  Estante · shared by {owner}* and the Leave confirmation names the owner (*{owner}
  can invite you again*), as the Leave-book board and workflow 10 §Leaving a book
  draw it. Source: tasks/refinements/books/leave.md Decision 5. Tests: unit (the
  contract shape); behavior (the service lists the owner's name, Go httptest;
  BookDetail's chip and the Leave confirmation name the owner; axe); e2e-api
  (a member's listBooks carries the owner's name); e2e-web (a joiner sees *shared
  by {owner}* and the named confirmation; axe)." It depends on `books.leave`.

## Decisions

1. **The Worker calls the endpoint; the main thread does not.** The alternative
   was a `leave()` method on the main-thread `sharing-client.js`, followed by
   `REMOVE_BOOK`. That would split one act across two threads. A tab closed
   between the two calls would leave a non-member holding a clone that sync then
   marks `gone`, and the main thread would hold a network write that belongs
   next to the data. `DELETE_BOOK` already does service-then-local in the Worker
   (`logic.js:2053-2083`). Leaving copies that shape, and Constraint 1 then holds
   by construction.
2. **The counts reuse `SURVEY_SIGN_OUT`; there is no new survey command.** It
   already returns, per book on this shelf, `unsavedSongs` (from the live index)
   and `savesWaiting` (from `countCommitsAhead`). It is a read with no teardown.
   The dialog filters the reply to its book.
   - The alternative was a new `SURVEY_BOOK {bookId}` command. It would be a
     second implementation of the same counts, for a 1d task.
   - `RemoveDialog` only counts `savesWaiting` from the sync slice. Workflow 10
     asks for unsaved changes too, and the survey is the one existing source of
     both.
   - The name stays as it is. Renaming the command is churn that two other
     dialogs would feel.
3. **A `404` from `leaveBook` counts as left.** The service answers `404` when
   the membership is already gone, for example when the owner removed the person
   a moment earlier (`sharing.go`, `RowsAffected()==0`). The person asked for
   the book to be gone and confirmed losing this device's copy. Refusing would
   leave them holding a book they no longer belong to, with a message that makes
   no sense. A `409` (the owner) and a `401` (signed out) are real refusals, and
   leave everything as it was.
4. **One success event, `BOOK_LEFT`; no reuse of `BOOK_REMOVED`.** `BookDetail`
   closes on either. The reducer folds `BOOK_LEFT` by dropping the book from the
   `mine` slice, so the *Mine on Estante* row disappears without a second
   `LIST_MINE` round trip. `BOOK_REMOVED` must not do that: a removed book is
   offered again in *Mine on Estante*.
5. **The owner's name is not shown yet; the copy says "The owner".** Workflow 10
   and the board name the owner (*Ana can invite you again*). Nothing in the
   app knows it: the API's `Book` (`api/openapi.yaml:1359-1382`) carries no owner
   name, and the shelf register holds only label, link, position and role.
   Adding it is a contract change, a service change and an app change. That does
   not fit a 1d app task, and the board's *shared by Ana* chip on book
   management, which is not built either, needs the same field. So this task
   ships the sentence with *The owner*, translated, and registers
   `books.owner_name` to carry the name through and use it in both places.
   - The rejected alternative was to fold the contract change in here. That
     would make this task span `api/`, `service/` and `app/`, and the task would
     need an e2e-api level as well.
   - This is a known, temporary departure from the drawn copy, not a design
     change, so there is no design delta.
6. **A taken-down book offers no Leave.** The service answers `404` to every
   member of a taken-down book, and its copy is kept for the download
   (`books.notice_surface`). Leaving would only delete that copy, which *Remove
   from my shelf* already does honestly. The workflow is silent on this; hiding
   the verb is the reading that destroys nothing by surprise.
7. **The refused or interrupted state, which was not drawn.** The dialog stays
   open. A `role="status"` line reads *You did not leave {book}. You are still a
   member.* The buttons stay, so the person can retry or cancel. This is workflow
   10 L129-130's sentence ("the confirmation says it did not leave") in the same
   register as the offline line the board does draw. No board change: the design
   refinement already records this gap.
8. **Offline disables the button, rather than letting the press fail.** The
   board draws the offline copy on the verb card itself (L192), and *Leaving
   needs a connection* reads as a precondition, not as an error. The press-then-
   fail alternative would send a doomed command. Reusing `useOnline()` from
   `app/src/account/` follows how the account screen gates its network-only
   actions.
9. **The test levels are unit + behavior + e2e-web; there is no e2e-api level.**
   The note names behavior and e2e-web. A unit level is added for the pure
   client method. There is no e2e-api level because this task adds no endpoint:
   `leaveBook` is pinned black-box by `service.leave_book`'s
   `e2e/api/sharing.test.js`, and the e2e-web case asserts the user-visible
   effect on the stack.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-15.

- app/src/books/LeaveDialog.jsx: the shared confirmation (counts of unsaved songs and unpushed saves, *Make it my own first* / *Download first*, *Leave the book*, failure line), used by book management and *Mine on Estante*.
- app/src/books/BookDetail.jsx, BooksScreen.jsx: the *Leave this book* card for readers and editors (not owners, local, gone or taken-down books; disabled offline with *Leaving needs a connection*); *Leave* on each *Mine on Estante* row.
- app/src/worker/{books-client,logic,protocol,reducer}.js: `leave(bookId)`, `LEAVE_BOOK` (service first, 404 counts as left; local teardown shared with `REMOVE_BOOK` via `removeFromShelf`), `BOOK_LEFT` / `LEAVE_FAILED`, `unsavedTitles` added to the sign-out survey records.
- app/src/i18n/locales/{en,pt-BR,es-419,it}.js: the Leave copy.
- Tests: unit `app/src/worker/books-client.test.js`; behavior `app/src/worker/leave-book.behavior.test.js`, `app/src/books/BookDetail.behavior.test.jsx`, `app/src/books/MineOnEstante.behavior.test.jsx` (axe); e2e-web `e2e/web/tests/leave-book.spec.js` on phone, tablet and computer (axe).
- app/src/test/git-http-remote.js: the shared test git server's `stop()` now closes keep-alive connections at once (a fixer change; it removed a 5 s timeout in an unrelated test under load).
- Deferred: `books.owner_name` registered in tasks/65-books.tji and wired to `milestones.m5_complete`.

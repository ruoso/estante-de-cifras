# books.fork — Make it my own

## TaskJuggler

[`tasks/65-books.tji`](../../65-books.tji), `task books.fork`
("Make it my own").

## Effort estimate

2d (from the `.tji`). This is tight. The task wires one Worker command, one
sheet and two shelf lines, and it also takes the engine's permanent push 403
(Decision 1). The service is untouched, and every seam it fills already exists
as a named stub (`FORK_BOOK`, `onMakeYourOwn`, `recordOriginal`).

## Repository

**estante-de-cifras**, the app only:

- `app/src/worker/`: a new `fork.js`, plus `logic.js`, `sync-engine.js`,
  `access-refused.js`, `protocol.js`, `reducer.js` and `books-client.js`.
- `app/src/books/`: `BookDetail.jsx`, `BooksScreen.jsx`, `book-display.js`,
  and a new `MakeYourOwn.jsx`.
- `app/src/songs/`: `SaveSheet.jsx`, `EditSongHost.jsx`, `SearchScreen.jsx`.
- `app/src/shell/AppShell.jsx`, `app/src/files/FileView.jsx`,
  `app/src/sync-display.js`, and the four `app/src/i18n/locales/*.js`.
- The e2e harness `e2e/web/`.

Nothing lands in cifra.md, `service/` or `api/`. `POST /api/books/{bookId}/fork`
and `POST /api/books` both exist and are used as shipped.

Design delta: `docs/workflows/11-fork.md`, which now covers §Ways in *Lowered
to reader* (L15-18), §What a fork is *When the original can no longer be
opened* (L41-46) and *Making a fork needs the network* (L48-50).

## Inherited dependencies

All **settled** (`complete 100`):

- **books.online** (`tasks/refinements/books/online.md`) gives this task:
  - put-online's create-then-push and the relocation of a working copy to a
    new book id (`app/src/worker/online.js:149-161`, `putOnline`);
  - the per-book cards on `BookDetail.jsx`;
  - the online_reindex obligation, under which a book's search entries move
    with its id.
- **sync.fork_follow** (`tasks/refinements/sync/fork_follow.md`) gives:
  - the device's record of the original, `shelf.json`
    `books[<forkId>].original = {bookId, title, link, followedAt, goneAt?}`,
    written whole by `recordOriginal` (`app/src/worker/logic.js:694-710`). Its
    comment says "books.fork calls it when it makes a fork", but nothing calls
    it yet;
  - `EventKind.ORIGINAL {bookId, newSaves, gone}` and the reducer's
    `originals` slice (`reducer.js:152-156`).

  It hands this task the shelf's *from …* line, the *… has N new saves* line,
  the *original no longer shared* badge (L401-403), and the permanent push
  403 (L446-454).
- **sync.lost_access** (`tasks/refinements/sync/lost_access.md`) gives:
  - the `gone` phase;
  - the *no longer shared with you* card on `BookDetail.jsx:303-323`, whose
    **Make this book your own** button sends `CommandKind.FORK_BOOK`
    (`:248-249`). No Worker handler exists for it yet.

  Its Decision (L332-351) says "the fork *offer* is this task's [lost_access];
  the fork *action* is `books.fork`'s", together with the completed
  lost-access → fork journey.
- **service.books** (`tasks/refinements/service/books.md`): `forkBook`
  (`api/openapi.yaml:411-433`; handler `service/internal/server/books.go:312-435`).
  - Any member, readers included, may fork.
  - A non-member or the home book gets `404`.
  - Over the 100-book / 200 MB limits gets `413`.
  - Success is `201 Book` with `original:{bookId,title?}`.

Also relied on (complete): **service.sharing** and **books.share**
(invitations, *Make reader*, *Remove* in the Share dialog), **books.add_by_link**
(a second account joins), and **books.upload_ui**.

## What this task is

Making a book the user's own, from all its ways in (workflow 11 §Ways in):

1. **Saving where one cannot.** Save in a book the user cannot push to now
   shows the W11 board's sheet (#1), *This book is someone else's — make it
   your own?*.
   - **Make it my own** forks the book, and the user's unsaved edits carry
     over into the fork.
   - A **lowered editor** whose saves are already committed meets the same
     entry after the save. The push is refused, so the book says *those saves
     can no longer go to it* and offers the fork or the download.
2. **Losing access.** The *no longer shared with you* card's offer now
   actually makes the fork.
3. **Deliberately.** A **Fork** card on the book-management detail of any
   hosted book the user does not own.

The fork replaces the original on the shelf: one entry, the same label, *from
{original}* beneath it. When the original's new saves are counted, the shelf
line reads *{original} has N new saves*. Once the original is gone, the badge
reads *original no longer shared*.

## Why it needs to be done

- The teacher–student loop (DIRECTION §2 L44-47) needs it: a reader cannot
  keep their own arrangement of a shared book without a fork.
- Three shipped surfaces already offer *Make this book your own* and do
  nothing:
  - `SaveSheet.jsx:243`, where `onMakeYourOwn` defaults to a no-op;
  - `BookDetail.jsx:319`, which sends a `FORK_BOOK` nobody handles;
  - the sharing roster's "To change it, make it your own" (`en.js:176`).
- An editor lowered to reader with unpushed saves is retried forever on
  *saves waiting* (`sync-engine.js:620-623`; parking lot 2026-10-14). Workflow
  10 L83-85 promises they are told and offered a way out.
- Downstream, **books.bring_in** (`depends !fork`) adds *Bring them in* to the
  shelf line this task draws. **m4_together** (`tasks/99-milestones.tji:38`)
  closes on both.

## Inputs / context

- **Workflow 11** `docs/workflows/11-fork.md`:
  - §Ways in L10-19;
  - §What a fork is L21-50: it replaces the original L27-30; it is named as
    the original was, *from Ana's Choros* L32-34; where it lives L36-39;
    the delta at L41-50;
  - §Following the original L55-70: never automatic; the shelf says *Ana's
    Choros has 3 new saves* L61-62; the original going away L66-70.
- **Workflow 4** `docs/workflows/04-edit-and-save.md:86-91` §A book the user
  cannot push to: the user can edit; *Save* explains and offers to make it
  theirs; until then the changes stay unsaved.
- **Workflow 8** `docs/workflows/08-sync.md:64-69` §Losing access: readable,
  never synced, unpushed saves kept, fork or download offered.
- **Workflow 10** `docs/workflows/10-share.md:79-85`: removed or lowered with
  unpushed saves → told those saves can no longer go, offered fork or
  download. L87-89: a reader who wants to change something.
- **W11 board** `docs/mockups/W11-fork.dc.html`. Frames are listed in
  `e2e/web/lib/mockup-frames.json:309-331`.
  - **#1, phone**, the sheet (:49-63): *This book is Ana's — make it your own?*
    and *You can read Choros da Ana, but not save to it. Making it your own
    gives you:*, with three points (`forkPoints` :235-238). Small print: *Your
    copy goes on Estante, private to you. You can share it, with its own limit
    of 50 people.* Buttons: **Make it my own** / **Not now**.
  - **#2, phone**, the shelf after forking (:68-97): the row *Choros da Ana* /
    *from Ana's Choros* / *32 songs · on Estante*, a notice *Ana's Choros has
    3 new saves.* with *Bring them in* (books.bring_in's), and the footnote
    *it took the place of Ana's on your shelf* (:88).
  - **#4, computer**: the row badge *original no longer shared* (:153); the
    history entry *Made your own from Ana's Choros* (:256); the ⋯ menu's
    **Fork**, *Your own copy of Banda do Bairro, with its history, that keeps
    following it.* (:189-196).
- **DIRECTION**: §2 L44-47 (forks, teacher–student); §3.3 L213-214 (forks
  are copies on the volume); §3.5 L379 (the Books API forks); §6 L556-561 (a
  departed book offers a fork or download).
- **Contract** `api/openapi.yaml`: `forkBook` :411-433; `Book` :1150-1172;
  `Original` :1138-1148; `createBook` (books.online's).
- **Home-book format** `docs/home-book-format.md:229-258`: the `role` register
  is "a hint for the shelf, never an authority"; the `original` register.
- **Seams**, all in `app/src/`:

  | What | Where |
  | --- | --- |
  | `FORK_BOOK {bookId, author}` declaration | `worker/protocol.js:140-149` |
  | The command switch, which has no `FORK_BOOK` case | `worker/logic.js:1024-2590` |
  | put-online / remove / add-by-link handlers | `logic.js:1766`, `:1868`, `:2118` |
  | `cloneOntoShelf`, the shelf-register write pattern | `logic.js:870-907` |
  | `readOriginals` / `recordOriginal` | `logic.js:681-710` |
  | The push catch order (taken_down → 404 gone → `saves_waiting`) | `worker/sync-engine.js:598-623` |
  | The retry fetch | `sync-engine.js:549-568` |
  | Gone classification | `worker/access-refused.js:38-75` |
  | The reader push refusal, `403 {code:'forbidden'}` | `service/internal/server/git.go:276` |
  | The taken-down refusal | `git.go:232` |
  | Badge words | `sync-display.js:101-105` |
  | `canSaveFor` | `books/book-display.js:57-61` |
  | `BookRow` meta | `BooksScreen.jsx:167-198` |
  | `BookDetail` cards | `:280-382` |
  | Taken-down card, with no fork offer (notice_surface Decision 3) | `BookDetail.jsx:325-339` |
  | The `canSave === false` branch | `songs/SaveSheet.jsx:196-249` |
  | `canSave` passed only here | `files/FileView.jsx:298-308` |
  | Plain `SaveSheet` with no `canSave` | `EditSongHost.jsx:66`, `SearchScreen.jsx:688`, `AppShell.jsx:644` |
  | Copy | `i18n/locales/en.js:114`, `:134-136`, `:176`, `:700-706` |

- **e2e helpers** (real UI):
  - `e2e/web/lib/journeys-share.js`: `hostedBookWithSong`,
    `inviteThroughShare`, `acceptInvitation`, `openSharing`,
    `removeFirstMember`, `addSectionAndSave`.
  - `e2e/web/lib/journeys.js`: `openSongInEditor`, `syncNow`,
    `waitUntilSearchable`, `openSongFromSearch`.
  - *Make reader*, inline in `e2e/web/tests/share.spec.js:113-121`.
  - Templates: `lost-access.spec.js` for removal before an unpushed save, and
    `share.spec.js` for two contexts.
  - `e2e/web/lib/mockup.js:45` for the board frames.

## Constraints / requirements

1. **The Worker owns the fork.** The view only sends `FORK_BOOK` and renders
   the `BOOK_FORKED` / `FORK_FAILED` replies. The main thread never touches
   IndexedDB.
2. **Two ways to make the copy, chosen by the service's answer:**
   - **`POST /api/books/{id}/fork` first.** On `201`, the device relocates its
     working copy to the fork's id and points `origin` at the fork's `gitUrl`.
     The ordinary sync engine then fetches the fork (identical to the
     original's server head), merges, and pushes any local commits. There is
     no fork-specific push.
   - **On `404`** (no longer a member, or the original deleted), the device
     creates the book with `POST /api/books` and pushes its own history:
     put-online's path (`online.js:161`), the empty bare repo accepting a
     first push. Following has already ended, so `recordOriginal` writes
     `goneAt` at once (workflow 11 L41-46).
3. **The fork replaces the original on the shelf in one home-book write**
   (workflow 11 L27-30):
   - the original's registers are cleared, as *remove* does (`logic.js:1890`);
   - the fork's are written: `label` = the original's label, `link`, the same
     `position`, `role: owner`;
   - then `recordOriginal({bookId: forkId, original: {bookId: originalId, title, link: originalLink, followedAt: now, goneAt?}})`.

   The original's working-copy directory is gone after the relocation, and its
   search entries are dropped and re-indexed under the fork's id. Each song
   shows once in search.
4. **Unsaved edits and unpushed commits carry over untouched.**
   - The working tree moves with the directory.
   - The index's live `unsaved` flags follow the id (`[[reconcile-resets-unsaved-on-reload]]`).
   - Nothing is reset, merged away or lost if the fork fails part-way. A
     failure before relocation leaves the original exactly as it was. A
     created-but-unpushed fork (path 2) is retried by the engine like any
     book with saves waiting.
5. **One commit marks it**: *Made your own from {original title}* (board
   :256). It is a no-change commit the device makes on the fork after the
   relocation, pushed with the next sync. No song text goes in it. The hook
   checks changed files and sees none.
6. **The permanent push 403.** A push refused `403` whose body code is
   `forbidden` (`git.go:276`, a reader's push) is classified as permanent:
   - the book's phase becomes **`cannot_save`**, carrying `savesWaiting`, and
     it is not retried this session;
   - its fetches go on, since a reader can still read;
   - the shelf `role` register is rewritten to `reader`, a hint that follows
     what the service said, so the next *Save* opens the fork sheet;
   - unpushed commits are kept.

   `taken_down` is still checked first, and a `404` is still `gone`. Like
   `gone`, the phase is not durable: re-derived by the next push after a
   reload (lost_access's no-durable-state decision).
7. **Every save sheet knows whether it can save.** `EditSongHost`, the
   search screen's *save all* and the shell's restored-save sheet pass
   `canSave={canSaveFor(...)}` as `FileView` already does. Each wires
   `onMakeYourOwn`.
8. **Offline first, and honest about it.** Making a fork needs the service
   (workflow 11 L48-50, delta).
   - Offline, the sheet says plainly that making it your own needs the
     network, and nothing changes. The edits stay unsaved, and the saves stay
     waiting.
   - `413` says the account's limit is reached, in words and with no song
     text.
   - Errors carry `{code, message}` only.
9. **Accessibility.**
   - React Aria Components throughout: the sheet is a RAC `Modal` / `Dialog`
     portalled inside `.est` (`[[rac-overlays-portal-outside-est-theme-root]]`),
     and a busy state is announced in a `role="status"` region.
   - Keyboard paths through **Make it my own** / **Not now** / **Fork**.
   - axe clean at WCAG 2.1 AA.
   - Every state is carried by a word: *from {original}*, *{original} has N
     new saves*, *original no longer shared*, *can't save here*.
10. **No song text in logs.** Fixtures use songs written for the purpose.
11. **No book without an account.** Only a signed-in device sees the offer
    enabled. A local book (*My songs*, a never-online book) is the user's own
    already and offers no fork. Neither does a taken-down book
    (notice_surface Decision 3), nor a book the user owns.

## Acceptance criteria

### Behavior delivered

1. **Saving where one cannot.**
   - In a reader's book, *Save* from the song editor, the file view or *save
     all* opens the cannot-save sheet with the board #1 copy:
     - title *{book} is someone else's — make it your own?*;
     - the body *You can read {book}, but not save to it…*;
     - the three points;
     - the small print;
     - **Make it my own** / **Not now**.
   - **Make it my own** sends `FORK_BOOK`, shows the busy word, and on
     `BOOK_FORKED` turns into the ordinary save form for the same paths in the
     fork. The editor host, file view and search scope follow the new id, so
     the save lands in the fork.
   - **Not now** leaves the edits unsaved and marked.
2. **Lowered to reader.**
   - A book whose push is refused `403 forbidden` shows *can't save here* on
     the shelf.
   - Its detail card reads *{N} saves can no longer go to {book}: you can read
     it, but no longer save to it.*, with **Make this book your own** and
     **Download**.
   - Making it its own carries those commits to the fork, where the engine
     pushes them.
3. **Losing access.** The *no longer shared with you* card's **Make this book
   your own** opens the same sheet. Its points drop *It keeps following …*,
   since following has already ended. Confirming makes the fork by path 2,
   and the unpushed saves arrive on Estante in the user's own book.
4. **Deliberately.** A **Fork** card sits on the detail of a hosted book the
   user does not own (reader or editor), between Download and Remove. It
   reads *Your own copy of {book}, with its history, that keeps following
   it.* (board :194) and opens the same sheet.
5. **The shelf.**
   - One row for the fork, the original's label, with a meta line *from
     {original title}*.
   - When `originals[forkId].newSaves > 0`, a line *{original} has N new
     saves.* appears, without the *Bring them in* button (Decision 5).
   - When `goneAt` is set, the badge reads *original no longer shared*.
   - The footnote *{book} is your own now: it took the place of {original}'s
     on your shelf* shows once, on `BOOK_FORKED` (board :88).
6. **Failures.**
   - Offline: *Making it your own needs the network.*
   - `413`: *This would put you over your limit on Estante.*
   - Either way, nothing on the device changes.

### Tests, by level

**unit**
- `app/src/worker/access-refused.test.js`, which grows. `readerPushRefused(err)`
  is true for `403 {code:'forbidden'}`, and false for `403 taken_down`, `404`,
  offline and `5xx`. This pins workflow 10 L83-85 and the classification of
  Constraint 6.
- `app/src/worker/sync-engine.test.js`, which grows:
  - a `403 forbidden` push on a book with unpushed commits emits `cannot_save
    {savesWaiting}`, keeps the commits, and writes `role: reader`;
  - the next pass does not push it again;
  - a `403 taken_down` is still `taken_down`, and a `404` still `gone`.
- `app/src/sync-display.test.js`: `cannot_save` → *can't save here* (a word,
  never colour alone; README "Decisions" :26).
- `app/src/books/book-display.test.js`: the shelf meta line *from {original}*;
  the *N new saves* line, with its singular; *original no longer shared* when
  `goneAt` is set. Board #2 and #4 :153.

**behavior**
- `app/src/worker/fork.behavior.test.js` (new). It runs against a fake
  IndexedDB, local bare git remotes standing in for the original and the
  fork, and an injected books client.
  - Service-copy path:
    - unsaved edits carried into `bookDir(forkId)`;
    - an unpushed commit pushed to the fork by the next sync;
    - the shelf's original registers cleared and the fork's written with
      `original {bookId, title, link, followedAt}`;
    - search finds the song once, under the fork's id;
    - the *Made your own from …* commit is on the fork.

    Workflow 11 L27-34 and Constraints 2-5.
  - `404` → create-and-push path: the fork holds the device's history,
    unpushed commit included, and `goneAt` is set. Workflow 11 L41-46.
  - `413` and offline: `FORK_FAILED {code}`, and the original's directory,
    shelf entry and unsaved flags are unchanged. Constraint 8.
  - A fork of a fork records its immediate parent. Workflow 11 §A fork of a
    fork.
- `app/src/books/MakeYourOwn.behavior.test.jsx` (new):
  - the board #1 copy and its three points;
  - the lost-access variant without the following point;
  - **Make it my own** sends `FORK_BOOK`, and the busy word sits in
    `role="status"`;
  - the offline and `413` replies said in words;
  - keyboard: Tab to both buttons, Enter/Space;
  - axe.
- `app/src/songs/SaveSheet.behavior.test.jsx`, which grows. In a reader's
  book the sheet offers the fork. After `BOOK_FORKED` it shows the save form
  for the fork's id, and the `SAVE` goes to the fork. Workflow 4 §A book the
  user cannot push to; axe.
- `app/src/songs/EditSongHost.behavior.test.jsx` (new). Edit →
  Save in a reader's book opens the fork offer, not the save form.
  Constraint 7.
- `app/src/books/BookDetail.behavior.test.jsx`, which grows:
  - the `gone` card's offer opens the sheet;
  - the `cannot_save` card, with its count, Make this book your own and
    Download (workflow 10 L83-85);
  - the **Fork** card shown for a reader's and an editor's hosted book, and
    not for an owned, local, home or taken-down book;
  - axe on each.
- `app/src/books/BooksScreen.behavior.test.jsx`, which grows:
  - the fork's row with *from {original}*;
  - the *N new saves* line driven by an `ORIGINAL` event;
  - the *original no longer shared* badge;
  - one row, not two;
  - the post-fork footnote;
  - axe.

**e2e-web**: `e2e/web/tests/fork.spec.js` (new). It runs on phone, tablet and
computer, against the stack, with real UI only. Ana is the `page`; Bia is a
second context joined through an invitation (`inviteThroughShare` +
`acceptInvitation`). Book and song are written for the test.

1. **Deliberately, then a new save of the original counted.** Ana invites
   Bia as Reader.
   - Bia: Books → the book → **Fork** → **Make it my own**. The shelf shows
     one row with *from {book}*, and search shows the song once.
   - Ana edits and saves her book (`addSectionAndSave`). Bia's *Sync now*
     → *{book} has 1 new save.*

   axe on the sheet and the shelf; `mockup(page,'W11-fork',2)`. Workflow 11
   §Ways in, §What a fork is, §Following the original.
2. **Saving where one cannot.** Ana invites Bia as Reader.
   - Bia: song → Edit → a section → Save → the sheet asks *make it your own?*;
     axe; `mockup(page,'W11-fork',1)`.
   - **Make it my own** → the save form → Save. Bia's song carries the
     section and the shelf row reads *from {book}*.
   - Ana's song does not have it after her sync.

   Workflow 4 L86-91.
3. **After losing access.** This uses lost-access.spec's ordering. Ana
   invites Bia as Editor, then removes her. Bia saves an unpushed section.
   - *Sync now* → *no longer shared with you* → the book → **Make this book
     your own** → **Make it my own**.
   - The row reads *from {book}* with *original no longer shared*.
   - After a sync the row reads *synced*, the section is in the song, and
     Bia's books list (an API read) shows the fork owned by Bia.

   axe. Workflow 8 L64-69, workflow 11 L41-46.
4. **Lowered to reader with a save not yet pushed.** Ana invites Bia as
   Editor, then lowers her with *Make reader* in the Share dialog. Bia, whose
   shelf still says editor, saves a section.
   - *Sync now* → *can't save here* → the book reads *1 save can no longer go
     to {book}* → **Make this book your own** → **Make it my own**.
   - After a sync the fork reads *synced* with the section in it.

   axe. Workflow 10 L83-85; the parking-lot question (Decision 1).

Every case is driven by complete tasks: a hosted book (books.online), a
second account (books.add_by_link), *Make reader* / *Remove* (books.share),
the change-check count (sync.fork_follow), and Sync now (sync.engine).

No e2e-api: the service is unchanged, and `e2e/api/books.test.js` and
`e2e/api/fork-follow.test.js` already pin the fork endpoint and the counting.

## Decisions

1. **The lowered editor's permanent 403 is this task's *saving where one
   cannot* entry. It is not a separate engine task.**
   - *Chosen:* classify `403 forbidden` as `cannot_save` in the push catch,
     and offer the fork from there. The workflow 11 delta adds it to §Ways in.
   - *Rejected:* a distinct `sync.*` leaf. Its only user-visible outcome is
     this task's offer, and splitting it would ship either a detector with
     nothing to offer or an offer that is never reached. This answers the
     parking-lot question (2026-10-14) and both predecessors' hand-offs
     (fork_follow L446-454, lost_access L390-398).
   - *Rejected:* treating it as `gone`. The user is still a member; fetches
     work, and the book keeps updating while they decide.
2. **After losing access, the device puts its own copy online. The service is
   not asked to fork for a non-member.**
   - *Chosen:* try `forkBook`; on `404`, `createBook` and push the local
     history.
   - *Rejected:* letting a former member fork on the service. It would hand
     them commits made after their removal, and reopen access the owner
     withdrew ("it cannot be recalled" covers only what is on their device,
     workflow 10 L79-81).
   - *Rejected:* always create-and-push. The service would not know it is a
     fork (`is_fork`, `original_book_id`), so the change check could never
     count the original's new saves, and every fork would push its whole
     history from a phone.
   - This needed the delta in workflow 11 L41-46. DIRECTION §3.3 L213
     ("copies on the same volume") stays true of every fork made while the
     original can be opened.
3. **The service-copy path re-uses the sync engine; there is no
   fork-specific push.** After relocation and the `origin` switch, the fork
   is an ordinary hosted book with local commits ahead or behind. The engine's
   fetch, cifra-aware merge and push already do the right thing, including the
   conflict hand-off. The alternative, a fork-time push, would be a second
   path to drift.
4. **The sheet's copy names the book, not its owner.**
   - The board's *This book is Ana's* needs the owner's name, which neither
     `Book` nor the shelf carries. The title becomes *{book} is someone else's
     — make it your own?*, consistent with the shipped `cannotSaveBody`.
   - *Rejected:* adding an owner's name to the `Book` schema. It is a contract
     change for one sentence, and members' names are deliberately limited on
     the device (workflow 10).
5. **The *N new saves* line ships without *Bring them in*.** The action and
   its screen are `books.bring_in`'s (`depends !fork`; its note consumes
   `PREVIEW_BRING_IN`). This task draws the count so its e2e can pin "a new
   save of the original counted". A button that opened nothing would be a dead
   control.
6. **The deliberate entry is a card on the book detail, not a ⋯ row menu.**
   The app has no per-row menu; every book action is a `BookDetail` card
   (books.online). The board's copy is kept: **Fork** and its subtext (:194).
   *Rejected:* adding a row menu for one action.
7. **A *Made your own from {original}* commit** marks the fork's history, as
   the board draws at :256. It is a no-change commit, so canonical form and
   the hook are unaffected. *Rejected:* no commit. History would not show
   when the book became the user's, and the lost-access path would have no
   commit of the user's to tell the two apart.
8. **`cannot_save` rewrites the `role` hint to `reader`.** The register is "a
   hint, never an authority" (home-book-format L251). Writing what the
   service just said makes every later save, on every device of the account,
   open the fork sheet instead of committing again. *Rejected:* leaving it
   `editor`. Later saves would keep committing and pile up behind a push that
   cannot succeed.
9. **No e2e-api level.** The note names none, and no service or contract
   change lands. The two fork paths are black-boxed in e2e-web through the
   real UI.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- Worker: `app/src/worker/fork.js` (the fork: service copy, or after a 404 the device creates the book and pushes its own history; unsaved edits and unpushed saves carried over; a *Made your own from …* commit), with `logic.js`, `sync-engine.js`, `access-refused.js` (`readerPushRefused`: a `403 forbidden` push becomes `cannot_save`, keeping the commits), `online.js` (`relocate`), `books-client.js` (`fork`), `protocol.js`, `reducer.js` (on `BOOK_FORKED` rows under the original's id point at the fork).
- Views: `app/src/books/MakeYourOwn.jsx` and `make-your-own.css` (the board #1 sheet, with the lost-access variant, busy word, offline and 413 replies); `BookDetail.jsx` (the cannot-save card and the Fork card), `BooksScreen.jsx` and `book-display.js` (one row, *from …*, *N new saves*, *original no longer shared*, the footnote); `songs/SaveSheet.jsx`, `save-sheet.css`, `EditSongHost.jsx`, `SearchScreen.jsx`, `shell/AppShell.jsx`, `sync-display.js` (*can't save here*), and the four `i18n/locales/*.js`.
- Open question answered: the permanent 403 is an engine change (`cannot_save`) that feeds the same Make it my own entry as saving where one cannot.
- Fixed on the way: isomorphic-git `commit({ref:'main'})` wrote a stray `.git/main`; the fork passes `refs/heads/main`.
- Unit: `access-refused.test.js`, `sync-engine.test.js`, `sync-display.test.js`, `book-display.test.js`, `reducer.test.js`, `books-client.test.js`.
- Behavior: `app/src/worker/fork.behavior.test.js`, `app/src/books/MakeYourOwn.behavior.test.jsx`, `app/src/songs/EditSongHost.behavior.test.jsx`, and the grown `SaveSheet`, `BookDetail` and `BooksScreen` behavior tests.
- e2e-web: `e2e/web/tests/fork.spec.js` (four journeys on phone, tablet and computer). No e2e-api, as scoped.
- Design delta: `docs/workflows/11-fork.md`.

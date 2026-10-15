# books.remove_counts_unsaved — Remove from my shelf counts unsaved songs

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji) — `books.remove_counts_unsaved`
("Remove from my shelf counts unsaved songs"), in milestone
`milestones.m5_complete` (`tasks/99-milestones.tji:44`).

## Effort estimate

0.5d.

## Repository

The work happens in this repository, outside `cifra.md/`. The note does not start with `cifra.md:`.

- `app/src/books/` — `BookDetail.jsx` (the `RemoveDialog`) and `BookDetail.behavior.test.jsx`.
- `app/src/i18n/locales/` — one new key in each of `en.js`, `pt-BR.js`, `es-419.js` and `it.js`.
- `e2e/web/` — `tests/online.spec.js`. It also moves the `editSong` helper out of `tests/sign-out.spec.js` into `lib/journeys-files.js` (Decision 6).

The task needs no Worker, protocol, service or API change.

## Inherited dependencies

All of them are settled.

- `books.online` (`complete 100`) built the Remove card and its `RemoveDialog` (`app/src/books/BookDetail.jsx:88-142`). That dialog warns of saves waiting (read from the `SYNC` slice) and of the device-only book being gone for good. It does not count unsaved songs. Refinement: `tasks/refinements/books/online.md`.
- `design.w07_remove_board` (`complete 100`) drew `docs/mockups/Remove-from-shelf.dc.html` and registered this task as the one line of that board the app does not show yet (`tasks/refinements/design/w07_remove_board.md:51-53, 158-166, 194-207`).
- Already complete and relied on, though not in `depends`:
  - `books.leave` — the `LeaveDialog` pattern this task copies. Its Decision 2 is "the counts reuse `SURVEY_SIGN_OUT`" (`tasks/refinements/books/leave.md:373`).
  - `account.sign_out` — `SURVEY_SIGN_OUT` itself, which already returns `unsavedSongs` and `unsavedTitles` for each book.
  - The editor and the live `unsaved` index flag. The e2e journey uses them through the real UI.

## What this task is

On a hosted book, the *Remove "{book}" from this device?* confirmation also counts the songs whose changes were never saved, and names them. It shows **1 song with unsaved changes will be lost** · *Rua do Porto* above the line about saves not yet on Estante, as the Remove-from-shelf board draws it.

When the dialog opens, it asks the Worker for `SURVEY_SIGN_OUT`. From the reply it keeps the entry for this book, exactly as `LeaveDialog` does. The device-only case (*gone for good, Download first*) does not change.

## Why it needs to be done

Workflow 7 §Removing a book (`docs/workflows/07-add-a-book.md:148-149`) says Remove, "with unsaved changes or saves not yet pushed, … says what would be lost and asks". Workflow 10 L106 says Leave counts loss "as *Remove from my shelf* counts it". Leave already counts unsaved songs; Remove does not. So today the app:

- under-warns on Remove: a hosted book in step with an unsaved edit gets the plain one-liner, and the edit is silently lost;
- breaks the workflow-10 parity.

The board `docs/mockups/Remove-from-shelf.dc.html:72-82` draws the missing line. `milestones.m5_complete` waits on this task.

## Inputs / context

- **Workflows**
  - `docs/workflows/07-add-a-book.md:144-155` — §Removing a book, and deleting one. L148-149 is the loss warning; L150-151 is the device-only case.
  - `docs/workflows/10-share.md:106-112` — "What would be lost is counted, as *Remove from my shelf* counts it": L108 is *2 songs with unsaved changes will be lost*; L109-112 are the saves not pushed.
- **Board** — `docs/mockups/Remove-from-shelf.dc.html`
  - Phone 1 (L26-38): a book on Estante with an unsaved song and saves waiting.
  - Phone 2 (L72-82): the dialog has one `.notice.unsaved` (column, gap 8px). It holds:
    - L75: the warning icon and **1 song with unsaved changes will be lost** · Rua do Porto;
    - L76: *This device has 2 saves not yet on Estante; removing this copy loses them. The book stays on Estante.*
    - The buttons are Cancel and Remove from my shelf (danger). There is no Download.
  - Tablet (L90-128): the device-only case, unchanged.
- **Seams**
  - `app/src/books/BookDetail.jsx`:
    - `RemoveDialog` at L88-142, with its body choice at L94-98;
    - `savesWaiting` from the `SYNC` slice at L224;
    - the Remove card at L442-451.
  - `app/src/books/LeaveDialog.jsx` — the pattern to copy:
    - `WarnIcon` at L29-35;
    - the `SIGN_OUT_SURVEY` listener with `books.find((b) => b.id === bookId)` at L62-65;
    - the survey sent on open at L77-84;
    - the values with defaults at L94-96;
    - the unsaved notice line at L119-127.
  - `app/src/worker/logic.js` (around L2119-2179, `case CommandKind.SURVEY_SIGN_OUT`) — the reply for each book is `{ id, title, kind, savesWaiting, unsavedSongs, unsavedTitles, … }`. Titles come from `s.title || s.path`. This holds for both shared and local books.
  - `app/src/worker/protocol.js:124-133, 500-507` — `SURVEY_SIGN_OUT` has payload `{}` and is a read with no teardown. Its reply is `SIGN_OUT_SURVEY { books }`.
  - `app/src/i18n/locales/en.js`:
    - L186-196 hold `books.remove*`;
    - L189-191 hold `books.removeLoss` (plural);
    - L212-214 hold `books.leaveUnsaved`, whose copy is the board's line.
- **Tests**
  - `app/src/books/BookDetail.behavior.test.jsx`:
    - `makeStore()` at L21-27; `hostedShelf()` at L44-49;
    - the Remove test at L127 (seeds `SYNC savesWaiting: 2`);
    - the device-only Remove test at L344;
    - the Leave `survey` helper at L453 and the count test at L525.
  - `e2e/web/tests/online.spec.js:59-80` — the device-only Remove journey.
  - `e2e/web/tests/sign-out.spec.js` — makes an unsaved edit through the real UI:
    - header L15-17: the `unsaved` flag is live-only, so no reload;
    - `editSong` at L52-57;
    - `openFileInFiles` and `leaveFiles` used at L125-127 and L42-46.
  - `e2e/web/lib/journeys-share.js:45` — `hostedBookWithSong(page, bookTitle, songTitle)`. It makes the song through the editor and puts the book online.
  - `e2e/web/lib/journeys-files.js:39` — `leaveFiles`.

## Constraints / requirements

1. **Counts come from the Worker.** When the dialog opens on a hosted book, `RemoveDialog` sends `SURVEY_SIGN_OUT {}` and keeps the entry whose `id` is this book from `SIGN_OUT_SURVEY`. The main thread reads nothing itself (DIRECTION §3.7: the Worker owns the index).
2. **Hosted book, what is shown.** Everything sits in one `.notice.unsaved` block, column direction, gap 8 (board L73-77). Its first line depends on whether unsaved songs exist:
   - `unsavedSongs > 0`: the first line is the warning icon, then **`books.removeUnsaved`** in bold, then ` · ` and the titles joined by `, `.
   - `unsavedSongs == 0`: the dialog is exactly as today. That means `removeLoss` when saves are waiting, else the plain `removeBody`.

   The second line depends on saves waiting:
   - saves waiting > 0: the existing `books.removeLoss` text;
   - no saves waiting: `books.removeBody` (Decision 3).
3. **Saves waiting.** Use the survey's `savesWaiting` once the reply has arrived. Until then, use the `SYNC` slice's (Decision 2).
4. **Device-only book unchanged.** It sends no survey and keeps `removeGone` and Download (workflow 7 L150-151; board tablet).
5. **The confirm is never blocked on the survey.** *Remove from my shelf* can be pressed before the reply arrives, as in Leave (leave.md Constraint 5). Offline first: the survey is a local read.
6. **Accessibility.**
   - RAC throughout.
   - The warning is carried by the words: the icon is `aria-hidden`.
   - axe passes at WCAG 2.1 AA on the dialog.
   - The dialog keeps its current `role="dialog"` (Decision 4).
7. **Copy.** Add `books.removeUnsaved` to all four locales, with plural forms `one`/`other`. In `en` it is *{count} song with unsaved changes will be lost* / *{count} songs with unsaved changes will be lost*. The other locales take the wording of their own `books.leaveUnsaved`.
8. **No song text in logs; test fixtures are written for the purpose.** Song and book names are invented, as in the existing tests.

## Acceptance criteria

Behavior: a hosted book's Remove confirmation counts its unsaved songs and names them, beside the saves waiting. A device-only book's confirmation is unchanged.

**behavior** — `app/src/books/BookDetail.behavior.test.jsx` (fake store, emitted events). Each case pins workflow 7 L148-149 and Remove-from-shelf L72-82:

- (a) *"Remove counts unsaved songs and names them for a hosted book"*:
  - setup: `hostedShelf()` with the `srv-1` entry `{ unsavedSongs: 1, unsavedTitles: ['Rua do Porto'], savesWaiting: 0 }` in the reply, plus a decoy `other` book with unsaved songs;
  - opening the dialog sends `SURVEY_SIGN_OUT`;
  - emit `SIGN_OUT_SURVEY`;
  - the dialog shows *1 song with unsaved changes will be lost* and *Rua do Porto*, and the `removeBody` line;
  - the decoy's titles are absent;
  - axe passes.
- (b) *"Remove shows unsaved songs beside saves waiting"*:
  - setup: the reply has `{ unsavedSongs: 2, unsavedTitles: ['Valsa Nova','Samba Curto'], savesWaiting: 2 }`;
  - both lines show, *2 songs with unsaved changes will be lost* · *Valsa Nova, Samba Curto* above *2 saves not yet on Estante*;
  - no Download button;
  - axe passes.
- (c) The existing *"Remove warns of unpushed saves for a hosted book"* (L127) still passes with only the `SYNC` event and no survey reply (Constraint 3). The confirm is pressable before the reply arrives, and sends `REMOVE_BOOK` (Constraint 5).
- (d) The existing device-only test (L344) is unchanged and still passes. Add an assertion that a local book's dialog sends no `SURVEY_SIGN_OUT` (Constraint 4).

**e2e-web** — `e2e/web/tests/online.spec.js`, new case *"remove a hosted book with an unsaved song: the confirmation names it (workflow 7 L148-149)"*. It runs on the phone, tablet and computer projects, through the real UI only:

1. `hostedBookWithSong(page, 'Banda do Bairro', 'Rua do Porto')`.
2. Open the song with `openFileInFiles` and make an edit without saving, using the shared `editSong`.
3. `leaveFiles`, staying in the same session with no reload (the `unsaved` flag is live-only).
4. Open the book's detail from the Books list.
5. Press *Remove from my shelf*. The dialog shows *1 song with unsaved changes will be lost* and *Rua do Porto*.
6. `checkA11y()` on the dialog.
7. Confirm. The book's row is gone from the shelf.

`e2e/web/tests/sign-out.spec.js` keeps passing with `editSong` imported from `lib/journeys-files.js`.

No deferred follow-ups.

## Decisions

1. **Reuse `SURVEY_SIGN_OUT` and filter on the client. No new Remove survey and no `bookId` argument.** This is the same call books.leave made in its Decision 2. The survey already returns per-book `unsavedSongs` and `unsavedTitles`, and one survey path keeps Remove, Leave and sign-out counting the same thing (workflow 10 L106: "as Remove counts it").
   - Rejected: a per-book filter argument. It saves a shelf-sized read that is cheap and local, at the cost of a protocol change that would serve one caller.
2. **The survey's `savesWaiting` wins once it arrives; the `SYNC` slice covers the time before.** The task note says to read both counts from the survey, like Leave. Keeping the `SYNC` value as the value before the reply means the dialog never flashes a "nothing to lose" body on a book whose badge already says saves are waiting, and the existing L127 test stays valid.
   - Rejected: only the survey. It shows the plain body until the reply arrives.
   - Rejected: only `SYNC`. It disagrees with Leave's source.
3. **Unsaved songs but no saves waiting: the second line is `removeBody`.** The board draws only the case where both apply. *Deletes this device's copy only. The book stays on Estante.* is the shipped in-step line and is true here. It tells the person the loss is only the unsaved edits.
   - Rejected: dropping the second line. That would lose the reassurance that the book stays on Estante.
4. **The dialog keeps `role="dialog"`, though the board marks it `alertdialog`.** The task is the count. Changing the role would change the existing queries in the behavior test (L136, L350) and in `online.spec.js:74` and `leave-book.spec.js:108`, beyond this task's half-day. Playwright's `getByRole('dialog')` does not match `alertdialog`. Accessibility is already met: the dialog is labelled, modal, and axe-clean. This is surfaced for the parking lot, not registered as a task.
5. **A new key, `books.removeUnsaved`, instead of reusing `books.leaveUnsaved`.** The words are the same today, but each dialog's copy is owned by its own verb. A `leave*` key inside the Remove dialog would invite a Leave-only edit to change Remove's wording.
6. **Move `editSong` from `sign-out.spec.js` into `e2e/web/lib/journeys-files.js`.** Two specs now need "make an unsaved edit through the real UI". The journeys files are where real-UI paths live, and copying the helper would let the two drift apart.
7. **`WarnIcon`:** export the one in `LeaveDialog.jsx` and import it in `BookDetail.jsx`. Do not add a fourth private copy. `RecoveryEmailRegion` and `SongArrange` each keep their own copy; folding them in is out of scope.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- `app/src/books/BookDetail.jsx`: when opened on a hosted book, `RemoveDialog` sends `SURVEY_SIGN_OUT`, keeps this book's entry, and shows **N songs with unsaved changes will be lost** · titles in one `.notice.unsaved` block above `removeLoss` (or `removeBody` when no saves wait). Until the reply arrives it uses the `SYNC` saves-waiting count; the confirm never waits on the survey. A device-only book's dialog is unchanged and sends no survey.
- `app/src/books/LeaveDialog.jsx`: `WarnIcon` exported and reused (Decision 7).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: new plural key `books.removeUnsaved`.
- `app/src/books/BookDetail.behavior.test.jsx`: cases (a) and (b) added; (c) and (d) extended on the existing hosted and device-only Remove tests. Axe passes.
- `e2e/web/tests/online.spec.js`: new case "remove a hosted book with an unsaved song: the confirmation names it", on phone, tablet and computer (phone and tablet passed on retry #1 in the gate; see parking lot).
- `e2e/web/lib/journeys-files.js`: `editSong` moved in from `e2e/web/tests/sign-out.spec.js`, which now imports it (Decision 6).
- Parked for the human: the `alertdialog` role (Decision 4) and the first-attempt e2e flake (`tasks/parking-lot.md`, 2026-10-15).


# books.setlist_picker_fixes — The setlist song picker and the invitation Done

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task setlist_picker_fixes`
(lines 219-224), in milestone `m3_service` (`tasks/99-milestones.tji:32`).

## Effort estimate

0.5d.

## Repository

The app only:

- `app/src/books/SetlistView.jsx` (the picker) and `app/src/books/setlist-display.js` (a new pure helper).
- `app/src/shell/AppShell.jsx`, `app/src/shell/use-place-history.js` or `app/src/books/NewInvitation.jsx`, only where the Done tests catch a cause (Constraint 4).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Tests beside each of those files.
- `e2e/web/tests/setlists.spec.js`, `e2e/web/tests/share.spec.js` and `e2e/web/lib/journeys-files.js` (one helper).

The task also carries design deltas in `docs/workflows/12-setlists.md` (§Building one) and `docs/workflows/10-share.md` (**Where it sits**). Nothing lands under `cifra.md/`, `service/` or `api/`.

## Inherited dependencies

- `books.setlists` is **settled** (`complete 100`). It gives us:
  - the setlist editor and its `InBookPicker`;
  - `setlistRows` / `resolveItemPath` (book-root `resolvedPath` per row);
  - the e2e setlist helpers.
- `books.share_people` is **settled** (`complete 100`). It gives us the Share sheet, the people screen and the New invitation screen and dialog. These are AppShell state with Back through `closers` (share_people Decision 6).
- Used, already complete:
  - `shell.routing`: `use-place-history.js`, surfaces as history steps (routing Decision 3).
  - `books.online`: a hosted book.
  - `account.sign_in`: a signed-in device.
  - The e2e helpers `hostedBookWithSong`, `openShareSheet`, `openSharing`, `createInvitationIn` and `finishInvite` (`e2e/web/lib/journeys-share.js`), plus `seedExample`, `openSetlist` and `editSetlist` (`e2e/web/lib/journeys-files.js:170`, `:236`).

## What this task is

This task fixes two small faults a persona run found.

**1. The setlist picker does not mark songs already in the setlist.** *Add song* in a setlist being edited lists every song in the book matching the search, including songs already in the setlist (Corcovado showed as addable while it was item 1). The picker now marks each song already there in words, *Already in this setlist · 1* (its places in the list). The song can still be added again.

**2. Done on a made invitation goes to the wrong place.** Done, reached from Share on a book, landed the person on the Setlists destination (`/setlists`) instead of back on the book. Done must return to where the invitation was made from: the book's detail (phone sheet → *Invite people*) or the people screen (*New invitation* there). It never goes anywhere else.

## Why it needs to be done

Both were found in the persona exploration of 2026-10-19 (guitar-teacher agents driving the app on a local stack). The first invites a duplicate nobody meant. The second throws a person out of the book they were sharing, in the middle of the first sharing journey.

`books.setlist_invitation` depends on this task. It adds Share on a setlist using the same invitation screens, so their Done must already return correctly.

## Inputs / context

- **Workflow 12** (`docs/workflows/12-setlists.md`):
  - L25-26: a numbered list, one item per song.
  - §Building one, L58-61, extended by this task's delta.
  - Nothing in the workflow forbids a song appearing twice.
- **Workflow 10** (`docs/workflows/10-share.md`): **Where it sits**, L84-90, extended by this task's delta. The phone's sheet leads to the people screen and to a new invitation, each its own screen. On a tablet or computer, a new invitation is a dialog over the people screen.
- **The picker** (`app/src/books/SetlistView.jsx`):
  - `InBookPicker` is at L72-128, with props `{store, bookId, onPick, onCancel, titleText, confirmLabel}`.
  - It searches with `SEARCH {query, scope:{books:[bookId]}}` (L81-85) and filters the `search` slice to this book (L75-79).
  - Result rows are RAC `Button`s with `aria-pressed`. Each shows the title and the book-root `r.path` as meta (L96-110).
  - Add song uses it at L433-442, opened from the editor's app bar (L483-485). Repoint uses it at L423-431.
  - `rows = setlistRows(current, path, present)` is at L155-158.
  - `addPicked` is at L213-220 and turns the book-root path into a setlist-relative one (`pathFromSetlistToSong`).
- **Path resolution** (`app/src/books/setlist-display.js`): `resolveItemPath` is at L27-38. `setlistRows` is at L75-114, and each row has `{number, resolvedPath, …}`. `resolvedPath` is book-root, or null for an unlinked item. Remember that an item's `path` is folder-relative and may hold `..` (memory: setlist item.path is folder-relative). Always compare `resolvedPath`, never `item.path`.
- **The invitation screen** (`app/src/books/NewInvitation.jsx`):
  - `CreatedLink` is at L196-215, with Done at L209.
  - `FormOrLink` is at L239-258.
  - `NewInvitationScreen` (phone) is at L264-288. Its Done is wired as `onDone={onBack}` (L283), so it is the same handler as the app bar's Back.
  - `NewInvitationDialog` (wide) is at L294-314, with `onDone={onClose}`.
- **The shell** (`app/src/shell/AppShell.jsx`):
  - Sharing state is at L415-422.
  - `layers` is at L486-501 (`'people'`, `'newInvitation'`), and `closers` at L505-539 (`newInvitation: () => setNewInvitation(null)`, L521).
  - The phone screen is wired at L1278-1285: `onBack={() => back(closers.newInvitation)}`.
  - The sheet over the detail is at L1339-1350, where `onNewInvitation` sets `shareSheet` to null and sets `newInvitation`.
  - `framed(sharingScreen)` is at L1300.
- **The routing hook** (`app/src/shell/use-place-history.js`):
  - The reconcile effect is at L148-179. A layer added pushes an entry. A layer closed *not* through `back` steps back if the entry below is what is now shown, and otherwise replaces the current entry.
  - `back(close)` is at L218-226. At depth > 0 it calls `history.back()` blindly, wherever that lands.
- **Reproduction attempts while writing this (2026-10-20; throwaway cases, not kept).** None of the paths below reproduces the fault in jsdom (AppShell behavior):
  - narrow sheet → *Invite people* → Create link → Done returns to `/b/<book>` with `layers: ['bookDetail']`;
  - narrow *Members* → people → New invitation → Create link → Done returns to the people screen, and its Back then returns to the book;
  - wide dialog Done leaves the people screen showing;
  - a local book put online from its detail (`BOOK_ONLINE` renames the entries), then Share → *Invite people* → Create link → Done, returns to `/b/<service id>` with `layers: ['bookDetail']`.

  A real-browser attempt against the explore stack (the persona seed, `hostedBookWithSong`) timed out in setup and gave no answer.
- **Remaining candidates.**
  - `back()` calls `history.back()` at depth > 0 whatever the browser holds below. The reconcile effect's step-back trusts `stackRef` the same way. If an entry was skipped (`hold`, `pendingPopRef`, `forceReplaceRef`) or came from outside the session's stack, Done can land on it.
  - The persona's own driving (playwright-cli, browser back between steps).
- **Tests to extend:**
  - `app/src/books/SetlistView.behavior.test.jsx`: L218-230 "adds a song from the in-book search", and `checkWcag21aa` at L14.
  - `app/src/books/setlist-display.test.js`.
  - `app/src/books/NewInvitation.behavior.test.jsx`: L54-86, where Done expects `onBack`.
  - `app/src/shell/AppShell.routing.behavior.test.jsx`: "AppShell share surfaces", L732+, with the `openBookDetail` helper at L773-779.
  - `e2e/web/tests/setlists.spec.js`: the `gigNight` helper (a two-song setlist open in the editor).
  - `e2e/web/tests/share.spec.js`: L72+, the two-person journey, `onPhone` at L48.
- **Predecessor refinements:**
  - `tasks/refinements/books/setlists.md`;
  - `share_people.md` Decision 6 (surfaces are AppShell state, no route);
  - `tasks/refinements/shell/routing.md` Decisions 3-5 (surfaces are history steps, tab switches replace entries, no router library).

## Constraints / requirements

1. **The picker knows the setlist.** `InBookPicker` gains an optional `inSetlist` prop, a `Map` from book-root path to an ascending array of item numbers. SetlistView builds it from the *current, unsaved* rows, so a song added a moment ago is marked too.
   - A new pure helper does the building: `placesBySong(rows)` in `setlist-display.js`. It keys by `resolvedPath`, skips null `resolvedPath`, and orders numbers ascending.
   - Both use sites pass it. On a repoint, a missing item's own path is never a search result, so only present songs are marked.
2. **The mark is a word.** A marked row carries *Already in this setlist · {places}* (places joined `, `) inside the row button, so it is part of the button's accessible name. No colour-only state. The `aria-pressed` selection is unchanged. Copy goes in all four locales: `setlists.alreadyIn`, interpolating `{places}`.
3. **Still addable.** A marked row can be picked and Added like any other. The item is appended as today (`addPicked`), written canonically through `addSong`.
4. **Done returns to where the invitation was made from, on every path.** That means the book detail (phone sheet → *Invite people*), the people screen (phone *Members* → New invitation, and the wide dialog), and the book detail after a put-online made from it. The tests below pin each path, in jsdom and in a real browser.
   - **Work order, test first:** write the e2e-web case and the AppShell behavior cases before touching the wiring.
   - **If any of them fails**, fix the cause where it lies: AppShell's wiring, or the push/step-back logic in `use-place-history.js`. Add a behavior case (or a `use-place-history` unit case) that fails before the fix and names the cause. The cause goes in the Status block.
   - **If all pass on the three viewports**, the existing wiring (Done = `back(closers.newInvitation)` on the phone, `onClose` on the dialog) stays. The task lands the pins, and the Status block records that the persona's report did not reproduce through the real UI. Do not change the wiring speculatively: splitting Done from Back gives the same result on every path above (Decision 2).
5. **No routing change for Back.** The system back and the app bar's Back keep routing Decision 3's history-step semantics, whatever the fix.
6. **Accessibility.**
   - The marked row is a React Aria `Button` whose name includes the mark.
   - After Done on the phone, focus lands on the restored surface: the book detail's Share button, or the people screen's heading. This follows the existing `framed` focus behavior; check it, don't add a new mechanism.
   - axe at WCAG 2.1 AA on the picker with a marked row, and on the screen Done returns to.
7. **Fixtures.** Test songs are the ones the specs already write for the purpose (`seedExample`'s songs, `share.spec.js`'s *Roda de rua*).

## Acceptance criteria

**Behavior.**
- *Add song* in a setlist being edited marks every song already in it, in words, with its places. It still lets the person add a marked song.
- Done on a made invitation returns to the book detail when the invitation was made from the phone's sheet, and to the people screen when it was made from there. It never returns to another destination, on phone, tablet and computer.
- Workflow 12 §Building one and workflow 10 **Where it sits** record both (the deltas below).

**Tests, by level:**

- **unit**, `app/src/books/setlist-display.test.js`, `placesBySong`:
  - a song at items 1 and 3 maps to `[1, 3]`;
  - an item linked through `..` keys by its book-root `resolvedPath`;
  - an unlinked item is skipped;
  - an empty setlist gives an empty map.

  Pins workflow 12 L25-26 and the folder-relative item path.
- **behavior**, `app/src/books/SetlistView.behavior.test.jsx`:
  - *Add song* with a search matching a song already in the setlist, plus one that isn't. The first row's name includes *Already in this setlist · 1*; the other row has no mark. axe clean with the picker open (Constraints 1-2, workflow 12 §Building one).
  - Picking the marked song and pressing Add appends a second item linking the same song in the last WRITE (Constraint 3).
  - A song added in this edit, before Save, is marked when *Add song* opens again (Constraint 1, current rows).
- **behavior**, `app/src/shell/AppShell.routing.behavior.test.jsx` ("AppShell share surfaces"):
  - Narrow: book detail → Share sheet → *Invite people* → Create link → Done. The book detail is shown with its Share button, `location.pathname` is `/b/<book>`, `history.state.layers` equals `['bookDetail']`, and the Setlists tab is not selected. axe clean.
  - Narrow: *Members* → people → New invitation → Create link → Done. The people screen is shown and `layers` equals `['bookDetail', 'people']`. Its Back then returns to the book detail.
  - Narrow: a local book's detail → Put online (`BOOK_ONLINE` local → service id) → Share → *Invite people* → Create link → Done. The book detail is shown at `/b/<service id>`, with the Setlists tab not selected.
  - Wide: people screen → New invitation dialog → Create link → Done. The dialog closes, the people screen is shown, and `history.state` is unchanged.

  All four pin workflow 10 **Where it sits** and its delta (Constraint 4).
- **e2e-web**, `e2e/web/tests/setlists.spec.js`, new case "Add song in the editor marks a song already in the setlist":
  - On phone, tablet and computer: `seedExample`, then `gigNight` (a two-song setlist in the editor).
  - *Add song* (a new helper `addSongInEditor(page, query)` in `e2e/web/lib/journeys-files.js` clicks the app bar's Add song and fills *Search for a song*). Searching *Morning* shows its row with *Already in this setlist · 1*, then `checkA11y`.
  - Add it, and the list now has three items with *Morning on the Porch* at 1 and 3. Save.

  Pins workflow 12 §Building one. Real UI only.
- **e2e-web**, `e2e/web/tests/share.spec.js`, new case "Done on a made invitation returns to the book":
  - On phone, tablet and computer: `hostedBookWithSong`.
  - On the phone, `openShareSheet` → *Invite people* → `createInvitationIn` → `finishInvite`. The book detail is visible (its Share button), the URL has no `/setlists`, and `checkA11y`.
  - On tablet and computer, `openSharing` → `createInvitationIn` → `finishInvite`. The people screen is visible, then `closeSharing` returns to the book detail, then `checkA11y`.

  Pins workflow 10 **Where it sits** and the delta. Real UI only.

No e2e-api: the task calls no endpoint it does not already call.

## Decisions

1. **Mark the songs, don't leave them out.** A song already in the setlist stays in the results with a word saying so, and stays addable.
   - Leaving it out makes a search for *Corcovado* answer *No songs found* about a song that is plainly in the book. That would be confusing, and it would read as a bug of its own.
   - Workflow 12 and the format allow a song twice, for a reprise or a closing reprise of the opener, so forbidding it would invent a rule.
   - Alternative: mark it *and* disable it. Rejected for the same reason.
   - The mark gives the places, so the person sees *where* it already is.
2. **Pin first; fix only a reproduced cause.** None of the four paths reproduced the persona's `/setlists` in jsdom (Inputs).
   - Considered: a speculative fix that splits Done from Back and closes the layer by state, leaving the reconcile effect to step back or replace. Rejected: the effect's step-back trusts the same in-memory stack `back()` does, so it gives the same result on every path tried. It would change the code without a failing test to show it fixes anything.
   - Considered: a guard in `back()` against unknown entries below. Rejected: it changes routing Decision 3 for every surface on a guess.
   - The task therefore writes the real-UI e2e on three viewports and the behavior cases first, and fixes what they catch.
   - If nothing fails, the tests land as the guard against the regression, and the unreproduced report is recorded (Status, and the parking lot via the closer) rather than encoded as a re-examination task.
3. **One picker, marks in both uses.** The repoint picker shares `InBookPicker`, so it shows the marks too. They are as true there, and a missing item's own target never appears as a result. Alternative: a prop to suppress them on repoint. Rejected as a flag with no reader.
4. **Add to setlist (from a song) is not changed.** That dialog chooses a *setlist* for one song. Whether it should name the setlists already holding the song is a different surface, not what the persona found. The note scopes the editor's picker only.
5. **No board change.** W12 draws no Add-song picker (only the repoint panel, `docs/mockups/W12-setlists.dc.html` L205-216), and the mark is a line of row meta in the same style. W10's frames are unchanged because Done lands on surfaces already drawn. The workflow deltas word both.

### Design delta

These are written with this refinement and ride in the closer's commit.

- `docs/workflows/12-setlists.md` §Building one gets a new paragraph. *Add song* in a setlist being edited searches the setlist's book. A song already in the setlist is still listed and says so in words, *Already in this setlist · 1* with its places. It can still be added again, since a setlist may come back to a song.
- `docs/workflows/10-share.md` **Where it sits** gets a closing sentence. *Done*, once a new invitation's link is made, returns to where it was made from: the book's people screen, or the book itself from the phone's sheet. It never goes to another destination.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- The setlist picker marks songs already in the setlist: `placesBySong(rows)` in `app/src/books/setlist-display.js`, used by both Add song and Repoint in `app/src/books/SetlistView.jsx`; a marked row reads *Already in this setlist · {places}* inside its button and can still be added. Copy in `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Done on a made invitation did not reproduce: the new Done cases pass in jsdom and in a real browser on phone, tablet and computer, so the Done wiring (`app/src/shell/AppShell.jsx`, `NewInvitation.jsx`) is unchanged and no cause was found; the persona's report is parked in `tasks/parking-lot.md`.
- Unit: `app/src/books/setlist-display.test.js` (`placesBySong`).
- Behavior: `app/src/books/SetlistView.behavior.test.jsx` (mark shown, axe clean, marked song still added, song added before Save marked); `app/src/shell/AppShell.routing.behavior.test.jsx` (Done on the narrow sheet, narrow Members then Back, after put-online, wide dialog).
- e2e-web, on all three viewports: `e2e/web/tests/setlists.spec.js` "Add song in the editor marks a song already in the setlist" and `e2e/web/tests/share.spec.js` "Done on a made invitation returns to the book"; new helper `addSongInEditor` in `e2e/web/lib/journeys-files.js`.
- Design deltas recorded in `docs/workflows/12-setlists.md` and `docs/workflows/10-share.md`.
- Also fixed a flaky help-panel test (`app/src/editor/SongEditor.behavior.test.jsx`, `escapeFromHelp()` waits for focus inside the help before Escape).
- Follow-up registered: `shell.surface_restore_focus` (focus onto the restored screen after a full-screen layer closes on the phone); the Done tests pin where it lands, not focus.

# shell.surface_restore_focus — Focus lands on the restored screen when a full-screen layer closes

## TaskJuggler entry

`tasks/50-shell.tji`, `task surface_restore_focus` (L153-158), under `shell`. It is wired into `milestones.m3_service` (`tasks/99-milestones.tji` L32).

## Effort estimate

0.5d.

## Repository

The work lands in the app and its e2e harness only:

- `app/src/shell/AppShell.jsx`: the closers set a one-shot return flag, and the restored surfaces receive it.
- `app/src/books/BookDetail.jsx`: focuses its Share button when the flag is set.
- `app/src/books/PeopleScreen.jsx`: focuses its title heading when the flag is set.
- Tests: `app/src/shell/AppShell.routing.behavior.test.jsx`, `app/src/books/BookDetail.behavior.test.jsx`, `app/src/books/PeopleScreen.behavior.test.jsx`, `e2e/web/tests/share.spec.js`.

Nothing lands under `cifra.md/`, `service/` or `api/`. There is no design delta.

## Inherited dependencies

- `shell.narrow_fixes` — settled (`complete 100`). It is the WBS ordering predecessor and touches none of these files' focus behavior.
- `books.setlist_picker_fixes` — settled (complete 2026-10-20). It is the source of this task. Its Constraint 6 asked for focus on the restored surface after Done on the phone, "following the existing `framed` focus behavior". Its Status records that its Done tests pin *where* Done lands, not focus, and registers this task.
- `books.share_people`, `shell.routing` — settled. The sharing screens are AppShell state closed through `closers`, and they are history steps (routing Decisions 3-5).

## What this task is

On a phone, the book's two sharing screens, *people* and *New invitation*, are each a full screen. While one is up, the screen beneath is unmounted (`AppShell.jsx` L1317 returns `framed(sharingScreen)` alone). When the person presses *Done* on a made invitation, or *Back*, the screen beneath mounts again with fresh nodes, and focus falls to `<body>`. A keyboard or screen-reader user is then dropped at the top of the document with nothing announced.

This task moves focus onto the restored screen:

- **the book detail's *Share* button**, when the book detail comes back. That happens after *Done* on an invitation made from the phone's sheet, and after *Back* from the people screen.
- **the people screen's title heading**, when the people screen comes back. That happens after *Done* on an invitation made from it.

It uses the shell's one existing re-mount focus seam, the wizard's `wizardReturn` flag, and adds no new mechanism.

## Why it needs to be done

- WCAG 2.4.3 Focus Order. DIRECTION §3.7 L450-455 chose React Aria for "dialogs that hold focus".
- RAC restores focus to a trigger only for overlays it manages, such as Modals and Popovers. A full-screen layer that replaces the shell's tree is outside RAC's reach, so the shell has to do it.
- The wide layouts already get this from RAC: the New invitation *dialog*'s Done returns focus to its trigger.
- `books.setlist_picker_fixes` deferred this explicitly. It is part of `milestones.m3_service`.

## Inputs / context

- **The note's governing document.** Workflow 10 **Where it sits** (`docs/workflows/10-share.md` L84-95):
  - On a phone, the sheet leads to the people screen and to a new invitation, each a screen of its own.
  - *Done* returns to where the invitation was made from.
  - The workflow says nothing about focus. This task adds the accessible half of "returns to".
- **"framed's focus handling".** `framed` (`AppShell.jsx` L901-906) is only a wrapper for the recovery-banner frame and holds no focus logic. The existing mechanism the note means is the shell's re-mount focus flag:
  - `wizardReturn` state, `AppShell.jsx` L443-446.
  - The wizard closer sets it only when arrange will re-mount (L543-548).
  - It is passed as `autoFocusWizard` / `onWizardFocusReturned` (L1439-1479).
  - `SongArrange.jsx` L140-153 honors it on mount, focusing the Run-the-wizard button, and then clears it.
  - Its test is `app/src/songs/SongWizard.behavior.test.jsx` L426-427.
- **The sharing state.**
  - The sharing state is at `AppShell.jsx` L415-422 (`shareSheet`, `people`, `newInvitation`).
  - `closers.people` and `closers.newInvitation` are at L533-534.
  - The sharing screens are built at L1286-1317. `NewInvitationScreen` takes `onBack={() => back(closers.newInvitation)}`, and `PeopleScreen` takes `onBack={() => back(closers.people)}`.
  - `shareBook` (L984-987) opens the sheet on a phone and the people screen on wide. `openPeopleFrom` (L989-994) closes any sheet and opens people.
  - The book detail is built at L1336-1350 (`onShare={shareBook}`). The phone sheet's *Invite people* is at L1361-1364.
  - Every close, whether the app bar's Back, Done (wired to the same `onBack`, `NewInvitation.jsx` L283) or the system back, reaches the closer, through `back()` or through `popstate`'s reconcile (`app/src/shell/use-place-history.js` L148-179, L218-226).
- **The targets.**
  - The *Share* button is in `BookDetail.jsx` L611-623, a RAC `Button` in the Share card. The card renders for an owner of a hosted book, or for a member who is offered Leave. `isOwner` / `isLocal` are read synchronously from the `shelf` slice (L321-332).
  - The people screen's title is in `PeopleScreen.jsx` L346-353, `<h1 className="title" id="est-people-title">`, which is the section's `aria-labelledby`. The same file already focuses a heading programmatically: `membersHeading` with `tabIndex={-1}`, L208, L274, L288.
- **Existing tests to extend.**
  - `app/src/shell/AppShell.routing.behavior.test.jsx` "AppShell share surfaces" (L752+):
    - "narrow: Share on a book opens the sheet; Members opens the people screen full-screen; Back returns to the book" (L801)
    - "narrow: Done on an invitation made from the Share sheet …" (L891)
    - "narrow: Done on an invitation made from the people screen returns to it; its Back returns to the book" (L912)
    - "wide: Share on a book opens the people screen" (L822)
  - `e2e/web/tests/share.spec.js` "Done on a made invitation returns to the book" (L209-233), with `onPhone` at L55.
  - The helpers are in `e2e/web/lib/journeys-share.js`: `openShareSheet` L158, `openSharing` L167, `closeSharing` L178, `createInvitationIn` L195, `finishInvite` L214. The fixture `hostedBookWithSong` is already used by the spec.
- **Predecessor refinements.**
  - `tasks/refinements/books/setlist_picker_fixes.md`: Constraint 6, and Status (last bullet).
  - `share_people.md` Decision 6: surfaces are AppShell state.
  - `tasks/refinements/shell/routing.md` Decisions 3-5.
- **Memory notes that apply.**
  - A RAC Modal aria-hides the shell chrome, so assert focus only once the overlay is closed.
  - Use one gesture per press in behavior tests: click, or keyDown+keyUp, never both.

## Constraints / requirements

1. **One flag, set by the closers.** AppShell gains `shareReturn` state, modelled on `wizardReturn`. It is `null`, `'book'` or `'people'`.
   - Set it in the closers, not in the buttons, so every way of closing gets it: the app bar's Back, Done and the system back.
   - `closers.newInvitation` sets `'people'` when `people` is still open. Otherwise it sets `'book'` when `bookDetail` is open with no `openSong` and no `openSetlist`.
   - `closers.people` sets `'book'` under the same book-detail condition.
   - In every other case the closer leaves the flag `null`. The wizard closer's `if (arranging)` guard is the precedent: a flag is never left for a surface that will not mount.
2. **The restored surface honors it once.**
   - `BookDetail` takes `autoFocusShare` / `onShareFocusReturned`. `PeopleScreen` takes `autoFocusTitle` / `onTitleFocusReturned`.
   - Each focuses its target, then calls the callback, which clears the flag.
   - Each guards on its target's ref being present, as `SongArrange` does. In `BookDetail` the effect depends on the flag and on whether the Share card renders, so a Share card that appears a render later still gets focus. It still runs at most once.
   - The props default to `false` / no-op, so every other caller is unchanged.
3. **The heading becomes programmatically focusable.** `PeopleScreen`'s `<h1 id="est-people-title">` gets `tabIndex={-1}`, as `membersHeading` has. It does not enter the tab order.
4. **The wide paths.**
   - Back from the people screen on a tablet or a computer goes through the same closer and re-mounts the book detail the same way. Its *Share* gets focus too, with no extra code.
   - The New invitation dialog's Done keeps RAC's own focus restore, which returns focus to *New invitation*. Its `onClose` does not go through `closers.newInvitation`, so the flag is never set there.
5. **No routing change.** `back()`, the reconcile effect and the history entries are untouched (routing Decision 3). Where Done lands stays as `books.setlist_picker_fixes` pinned it.
6. **Accessibility.** The focus targets are a RAC `Button` and a heading named by the screen's title. axe at WCAG 2.1 AA runs on each restored screen. Every state is still carried by words, so this task makes no visual change.
7. **Fixtures.** Use the books and songs the existing specs already write for the purpose: `hostedBookWithSong`'s book, and the AppShell test's `OWNED` shelf.

## Acceptance criteria

**Behavior delivered.** On a phone, focus lands on the restored screen in three cases:

- Closing the New invitation screen made from the sheet focuses the book detail's *Share*.
- Closing the New invitation screen made from the people screen focuses that screen's title heading.
- Closing the people screen focuses the book detail's *Share*.

Each close counts, whether by *Done*, *Back* or the system back. On a tablet or a computer, Back from the people screen focuses *Share* too. Nothing else moves focus.

**Tests.**

- **behavior**, `app/src/shell/AppShell.routing.behavior.test.jsx` ("AppShell share surfaces"):
  - Extend "narrow: Done on an invitation made from the Share sheet returns to the book detail …" (L891). After Done, `document.activeElement` is the `Share` button, and axe stays clean as it is today. This pins workflow 10 **Where it sits** and Constraints 1-2.
  - Extend "narrow: Done on an invitation made from the people screen returns to it; its Back returns to the book" (L912):
    - after Done, `document.activeElement` is the people region's level-1 heading `${BOOK_LABEL} · People`;
    - after its Back, it is the `Share` button.

    This pins Constraints 1-3.
  - New: "narrow: the system back from the people screen focuses Share on the restored book detail". It goes Members → people, then `history.back()` through the existing `traverse` helper. `document.activeElement` is `Share`. This pins Constraint 1: the flag is set in the closer, so popstate gets it too.
  - New: "wide: Back from the people screen focuses Share on the book detail; the New invitation dialog's Done leaves focus on New invitation". This pins Constraint 4.
  - New: "narrow: Back from a people screen opened over a song leaves no pending focus". It opens the song's Share sheet → *Members*, presses Back, then opens the book detail later. Focus stays where the press left it and does not jump to Share. This pins Constraint 1's guard.
- **behavior**, `app/src/books/BookDetail.behavior.test.jsx`, new case "autoFocusShare focuses Share once and reports it". It renders with `autoFocusShare` for an owned hosted book. Share is focused and `onShareFocusReturned` is called once. Without the prop, nothing is focused. axe is clean. This pins Constraint 2.
- **behavior**, `app/src/books/PeopleScreen.behavior.test.jsx`, new case "autoFocusTitle focuses the screen's heading, which stays out of the tab order". The heading is focused, the callback is called once, `tabIndex` is `-1`, and axe is clean. This pins Constraints 2-3.
- **e2e-web**, `e2e/web/tests/share.spec.js`, new case "focus lands on the restored screen when a sharing screen closes". It uses `hostedBookWithSong` on all three projects.
  - On the phone:
    - `openShareSheet` → `createInvitationIn(sheet)` → `finishInvite`, then `expect(share).toBeFocused()`;
    - `openSharing` (through *Members*) → `createInvitationIn(people)` → `finishInvite`, then `expect(people.getByRole('heading', { level: 1 })).toBeFocused()`;
    - `closeSharing`, then `expect(share).toBeFocused()`;
    - `checkA11y` on each restored screen.
  - On tablet and computer: `openSharing` → `closeSharing`, then `expect(share).toBeFocused()`, then `checkA11y`.

  This pins workflow 10 **Where it sits** and Constraints 1-4. It runs through the real UI only: helper clicks, with no `#dev/*` mount, no injected state and no synthetic events.

There is no unit level: the change is component wiring with no pure module. There is no e2e-api: no endpoint is touched.

**Deferred.** One follow-up is deferred to `shell.surface_restore_focus_song` (0.5d, app work, the note does **not** start with `cifra.md:`; milestone `milestones.m3_service`; the closer registers it in the WBS). The task is "Focus lands on the song's or setlist's Share when the people screen opened from it closes":

- The people screen can be opened from a song's or a setlist's share (*Members* / *Manage*, `AppShell.jsx` L1517, L1531, L1604, L1619). Back from it re-mounts the reading view or the setlist, so focus is lost.
- The follow-up gives `SongReading` and `SetlistView` the same one-shot prop for their *Share* control, and extends `shareReturn` with `'song'` / `'setlist'`.
- Its tests: behavior in AppShell for both, axe; e2e-web in `share.spec.js`'s song and setlist share cases on the phone, asserting `toBeFocused()`.

## Decisions

1. **Reuse the `wizardReturn` pattern. It is what "framed's focus handling" can only mean.** `framed` has no focus code, and the shell's one re-mount focus seam is the wizard's one-shot flag.
   - Considered: a generic "focus the restored surface's first heading" effect in `framed` or in `use-place-history`. Rejected: that is a new mechanism, which the note forbids. It would also fire on every surface change, including the first mount and tab switches, and steal focus from places that manage their own.
   - Considered: keeping the book detail mounted and hidden under the sharing screen, so RAC-style restore works on the old node. Rejected: it changes the render tree that `setlist_picker_fixes` and `setlist_invitation` just pinned, and hidden-but-mounted screens complicate axe and `aria-hidden`.
2. **Set the flag in the closers, not in the Done and Back handlers.** The closers are where every way out converges, including the system back through popstate. Setting it there is the only way the hardware back on Android gets the same result. The wizard does the same.
3. **The targets are the ones the note names: *Share* for the book detail, the title heading for the people screen.**
   - *Share* is the control that started the journey, so it matches RAC's own return-to-trigger on wide.
   - For the people screen the note and `setlist_picker_fixes` Constraint 6 name the heading.
   - Considered: *New invitation* as the people-screen target, which is the trigger. Rejected: the governing note names the heading. The heading also lets a screen reader announce *which* screen it is back on, and the just-made invitation is listed below it.
4. **The wide Back gets it too, at no cost.** On tablet and computer, Back from the people screen re-mounts the book detail through the same closer. Limiting the flag to the phone would need a mode check that only takes away a fix. The note's "on the phone" describes where the report came from, not a limit.
5. **A song's or setlist's people screen is a follow-up, not this task.** The note names the book detail and the people screen. Song and setlist restores need props threaded into two more components (`SongReading`, `SetlistView`), each with its own share surface. That is a separate 0.5d unit with its own tests (`shell.surface_restore_focus_song`, above). Until it lands, Constraint 1's guard makes sure this task's flag never fires on a later, unrelated book-detail mount.
6. **No design delta.** Workflow 10 already says *Done* and *Back* return to the screen beneath. Focus is how that return is made accessible, which is implementation of the standing accessibility rule, not a product change. No board draws focus.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-20.

- `app/src/shell/AppShell.jsx`: one-shot `shareReturn` flag (`'book'` / `'people'`) set by the `people` and `newInvitation` closers (and cleared by the `bookDetail` closer), so Back, Done and the system back all get it; the routing loop passes the layers being kept to each closer so New invitation does not leave the flag on a people screen closing in the same step. No change to `back()` or history entries.
- `app/src/books/BookDetail.jsx`: `autoFocusShare` / `onShareFocusReturned` focus Share once, even when the Share card renders a render later.
- `app/src/books/PeopleScreen.jsx`: `autoFocusTitle` / `onTitleFocusReturned`; the `<h1>` gets `tabIndex={-1}`.
- behavior: `AppShell.routing.behavior.test.jsx` (two narrow Done cases extended; system back, wide Back and no-pending-focus cases new), `BookDetail.behavior.test.jsx`, `PeopleScreen.behavior.test.jsx`.
- e2e-web: `e2e/web/tests/share.spec.js` "focus lands on the restored screen when a sharing screen closes", on phone, tablet and computer, axe on each restored screen.
- Tech debt registered: `shell.surface_restore_focus_song` in `tasks/50-shell.tji`, wired into `milestones.m3_service`.

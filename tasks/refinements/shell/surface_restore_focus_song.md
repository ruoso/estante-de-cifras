# shell.surface_restore_focus_song — Focus lands on the song's or setlist's Share when the people screen opened from it closes

## TaskJuggler entry

`tasks/50-shell.tji`, `task surface_restore_focus_song` (L160-165), under `shell`. It depends on `shell.surface_restore_focus` and is wired into `milestones.m3_service` (`tasks/99-milestones.tji` L32).

## Effort estimate

0.5d.

## Repository

The work lands in the app and its e2e harness only:

- `app/src/shell/AppShell.jsx`: `shareReturn` gains `'song'` and `'setlist'`, and the reading view and the setlist receive it.
- `app/src/songs/SongReading.jsx`: focuses its share opener when the flag is set.
- `app/src/books/SetlistView.jsx`: the same.
- Tests: `app/src/shell/AppShell.routing.behavior.test.jsx`, `app/src/songs/SongReading.behavior.test.jsx`, `app/src/books/SetlistView.behavior.test.jsx`, `e2e/web/tests/share.spec.js`.

Nothing lands under `cifra.md/`, `service/` or `api/`. There is no design delta.

## Inherited dependencies

- `shell.surface_restore_focus` — settled (complete 2026-10-20, commit f1c0f70). It built the one-shot `shareReturn` flag, set by the `people` and `newInvitation` closers, and the `autoFocusShare` / `onShareFocusReturned` pair on `BookDetail`. Its Decision 5 deferred this task, and its Constraint 1 guard (`shareReturnFor` returns `null` when a song or setlist is open) is what this task replaces with real targets.
- `books.share_people`, `books.setlist_invitation`, `shell.routing`, `shell.narrow_fit` — settled. Respectively: sharing surfaces are AppShell state; a setlist's share is its own state (`sharingSetlist`); the people screen is a history layer; on the phone and the tablet the song's Share lives in More (narrow_fit Decision 7).

Every fixture and helper the tests need already exists: `hostedBookWithSong`, `addToNewSetlistFromSong`, `openSetlist`, `shareSetlist`, `closeSharing` in `e2e/web/lib/`, and `openSetlistAt`, `openSongFromSearch`, `traverse`, `wide` in the AppShell behavior test.

## What this task is

From a song or a setlist, *Share* opens the sheet (phone) or the panel beside it (tablet, computer). Its *Members* row (sheet) or *Manage* (panel) opens the book's people screen. While that screen is up, the reading view or the setlist is unmounted (`AppShell.jsx` L1347 returns `framed(sharingScreen)` alone, on every layout). When the person presses *Back*, or uses the system back, the song or setlist mounts again with fresh nodes and focus falls to `<body>`.

This task moves focus onto the control that opened the share on the restored screen — its **share opener**:

- the reading view: the app bar's *Share* on the computer; *More* on the tablet and the phone, where Share is a menu item (`SongReading.jsx` L572-603, L757-759);
- the setlist: the app bar's *Share* on wide; *More* on narrow (`SetlistView.jsx` L347-369).

It extends the predecessor's flag and adds no new mechanism.

## Why it needs to be done

- WCAG 2.4.3 Focus Order; DIRECTION §3.7 chose React Aria for "dialogs that hold focus". A full-screen layer that replaces the shell's tree is outside RAC's focus restore, so the shell has to do it.
- The predecessor fixed this for the book detail and registered this half explicitly. It is part of `milestones.m3_service`.

## Inputs / context

- **Governing document.** Workflow 10 **Where it sits** (`docs/workflows/10-share.md` L84-94): "*Share* on a song or a setlist is a panel beside it on a tablet or a computer, and the same sheet on a phone" (L88-89), and *Done* returns "to where it was made from … the song or setlist whose *Share* made it" (L90-93). It says nothing about focus; this task is the accessible half of "returns to".
- **The predecessor's seam** (`app/src/shell/AppShell.jsx`):
  - `shareReturn` state, L423-427 (`null | 'book' | 'people'`).
  - `stays`, L525; `shareReturnFor(kept, { fromInvitation })`, L530-534 — returns `'people'`, `'book'` only with `!openSong && !openSetlist`, else `null`.
  - `closers.bookDetail` clears the flag (L542-545); `closers.people` (L553-556) and `closers.newInvitation` (L557-562) set it from `shareReturnFor`.
  - `applyEntry` passes the kept layers to each closer (L599-614), then `applyPlace` sets `openSong` / `openSetlist` from the entry (L593-594). `openSong` and `openSetlist` are place state, not layers.
  - Consumers: `PeopleScreen` L1340-1341, `BookDetail` L1381-1382.
  - Render-time clearing precedent: `if (sharingSetlist && !sameItem(sharingSetlist, openSetlist)) setSharingSetlist(null);` (L633-635).
- **How the people screen is reached from a song or setlist.** `openPeopleFrom` (L1017-1022) closes `shareSheet`, `sharing` and `sharingSetlist` and opens `people`. It is the sheet's `onOpenPeople` and the panel's `onManage`: song L1537-1564, setlist L1618-1654. Invitations from a song or setlist are made inline in the sheet or panel (`ShareSheet.jsx` L196-225), so `newInvitation` is reached only from the people screen's own *New invitation*; its Done already returns focus to the people title (`'people'`).
- **Where the surfaces render.** `SongReading` at L1569-1584 (`onShare={setSharing}`); `SetlistView` at L1655-1666 (`onShare={setSharingSetlist}`), framed alone on wide (L1667), inside the Setlists tab panel on narrow (L1196-1198). When a song is open over a setlist, the song renders (L1526 comes before L1655).
- **The targets.**
  - `SongReading.jsx`: More trigger `Button className="btn icon" aria-label="More" data-share-return=""` (L574), in every layout; computer app-bar `Button … data-share-return=""` *Share* (L757-759). There are no focus props today.
  - `SetlistView.jsx`: wide-only app-bar *Share* with `data-share-return` (L347-351); More trigger (L353), always rendered, no `data-share-return`. No focus props today.
  - `SongSharePanel.jsx` L37, L59-66 already returns focus to `[data-share-return]` when the panel closes in place. That covers the panel, not a re-mount.
- **The pattern to copy.** `BookDetail.jsx` L309-312, L323-324, L389-397: `autoFocusShare = false, onShareFocusReturned = () => {}`, and an effect on `[autoFocusShare, offersShare]` that focuses the ref and calls the callback, so a target that renders a render later still gets focus, at most once. `SongArrange.jsx` L140-154 is the mount-only original.
- **Existing tests to extend** (`app/src/shell/AppShell.routing.behavior.test.jsx`, "AppShell share surfaces", L752+):
  - L998 "narrow: Back from a people screen opened over a song leaves no pending focus";
  - L1269 "wide: a setlist's Share → Manage shows the people screen over the setlist; its Back returns to the setlist at its address";
  - helpers `wide(computer)` L783, `traverse` L79-85, `openSetlistAt` L1225, `setlistScreen` L1234.
  - `app/src/songs/SongReading.behavior.test.jsx` L670 describe ("full screen, print, add to setlist, share"); `app/src/books/SetlistView.behavior.test.jsx` L189 describe ("Share (workflow 12 §Sharing one)").
- **e2e** (`e2e/web/tests/share.spec.js`): `shareSong` L300; "share from a song: …" L316 (wide already opens Manage, L355-359); "share from a setlist: …" L370 (Done → Close on phone, L409-418); the predecessor's focus case L240; `onPhone` L56. Helpers in `e2e/web/lib/journeys-share.js`: `closeSharing` L178, `shareSetlist` L274-298.
- **Memory notes that apply.** An open RAC Modal aria-hides shell chrome — assert focus only once the sheet is closed; one gesture per press in behavior tests.

## Constraints / requirements

1. **The closers set the new values.** `shareReturnFor` gains, after the `'people'` branch and before `'book'`:
   - `'song'` when `openSong` is set;
   - else `'setlist'` when `openSetlist` is set;
   - else `'book'` as today (its `!openSong && !openSetlist` condition becomes implied by the order).
   The song wins over a setlist beneath it because the song is what renders (L1526 before L1655). The flag is still set only in the closers, so Back, Done and the system back all get it.
2. **A flag never waits for a surface that will not mount.** Because `openSong` / `openSetlist` are place state that `applyPlace` may change after the closers run, AppShell clears the flag at render time, beside the L633-635 precedent: `'song'` when no song is open, `'setlist'` when no setlist is open or a song is open over it. The existing `closers.bookDetail` clear stays.
3. **The restored surface honors it once.** `SongReading` and `SetlistView` each take `autoFocusShare = false` / `onShareFocusReturned = () => {}`, the same names as `BookDetail`. Each holds a ref on its share opener for the layout it is drawing (Constraint 4), focuses it, then calls the callback, which clears the flag. As in `BookDetail`, the effect depends on the flag and on the opener being rendered, so an opener that appears after the song's text loads still gets focus; it runs at most once. AppShell passes `autoFocusShare={shareReturn === 'song'}` to `SongReading` and `autoFocusShare={shareReturn === 'setlist'}` to `SetlistView`, each with `onShareFocusReturned={() => setShareReturn(null)}`. Every other caller is unchanged.
4. **The share opener is the control that opened Share in that layout.**
   - `SongReading`: computer → app-bar *Share*; tablet and phone → *More*.
   - `SetlistView`: wide → app-bar *Share*; narrow → *More*.
   A menu item inside a closed menu cannot hold focus, and *More* is what RAC's own restore returns to when the menu closes.
5. **Every layout gets it.** On tablet and computer, *Manage* from the panel goes through the same `people` closer and re-mounts the song or setlist the same way (predecessor Decision 4). The panel was closed by `openPeopleFrom`, so it does not reopen.
6. **No routing change.** `back()`, `applyEntry`, `openPeopleFrom` and the history entries are untouched. Where Back lands stays as pinned today (L1269, `share.spec.js` L370).
7. **Accessibility.** Each target is a RAC `Button` with a word for a name (*Share*, *More*). axe at WCAG 2.1 AA runs on each restored screen. There is no visual change.
8. **Fixtures.** Use the songs and setlists the existing tests already write for the purpose: the AppShell test's `SONG_TITLE` ("Tarde Clara") and `SETLIST_TITLE`, and `share.spec.js`'s `hostedBookWithSong` book and its *Lesson 3* setlist.

## Acceptance criteria

**Behavior delivered.** When the people screen opened from a song's or a setlist's share closes — by *Back* or the system back, on any layout — focus lands on that song's or setlist's share opener: *More* on the phone (and the tablet for a song), the app bar's *Share* on the computer (and the tablet for a setlist). After *Done* on an invitation made from that people screen, focus still lands on its title, as today; its Back then lands on the share opener. Nothing else moves focus, and no flag is left for a later mount.

**Tests.**

- **behavior**, `app/src/shell/AppShell.routing.behavior.test.jsx` ("AppShell share surfaces"):
  - Extend L998, renamed "narrow: Back from a people screen opened over a song focuses its More, and leaves no pending focus". After Back, `document.activeElement` is the reading view's *More* (`getAllByRole('button', { name: 'More' })[0]`), and axe is clean; the existing tail (off the song, then Books → Manage, Share not focused) stays. Pins Constraints 1-4 and the predecessor's guard.
  - New "narrow: Done on an invitation made from a song's people screen returns to its title; Back then focuses the song's More". Song → More → Share → Members → *New invitation* → Create link → Done: the people region's level-1 heading is focused; Back: *More* is focused. Pins Constraint 1's order (`'people'` before `'song'`).
  - New "wide: Back from a people screen opened from a song's panel focuses Share on the computer and More on the tablet". `wide(true)` then `wide(false)`: app-bar Share → panel Manage → people → Back. Pins Constraints 4-5.
  - New "narrow: a setlist's More → Share → Members → the system back focuses the setlist's More (axe clean)". `openSetlistAt` on narrow; `traverse(() => history.back())` from the people screen. Pins Constraint 1 in the closer (popstate gets it) and Constraint 4.
  - Extend L1269: after Back, `document.activeElement` is the setlist's app-bar *Share* (`within(setlistScreen()).getByRole('button', { name: 'Share', exact: true })`). Pins Constraints 4-5.
- **behavior**, `app/src/songs/SongReading.behavior.test.jsx`, new case "autoFocusShare focuses the share opener once: More when narrow, Share on the computer". It checks the callback is called once, that nothing is focused without the prop, and that axe is clean. Pins Constraints 3-4.
- **behavior**, `app/src/books/SetlistView.behavior.test.jsx`, new case "autoFocusShare focuses the share opener once: More when narrow, Share when wide". It checks the same: callback once, nothing focused without the prop, axe clean. Pins Constraints 3-4.
- **e2e-web**, `e2e/web/tests/share.spec.js`, on phone, tablet and computer, through the real UI only:
  - Extend "share from a song: …" (L316). After the joiner's block:
    - on the phone, the sheet is still open on its summary: press its *Members* row, then `closeSharing`, then `expect(page.getByRole('button', { name: 'More', exact: true }).first()).toBeFocused()`;
    - on wide, after the existing Manage: `closeSharing`, then `toBeFocused()` on *Share* on the computer and on *More* on the tablet;
    - `analyzeBothThemes` is empty on the restored song.
  - Extend "share from a setlist: …" (L370). After the joiner's block:
    - on the phone, `shareSetlist(page)` → the sheet's *Members* → `closeSharing`, then the setlist's *More* (`.setlist-screen`) is focused;
    - on wide, the panel's *Manage* → `closeSharing`, then the setlist app bar's *Share* is focused;
    - `analyzeBothThemes` is empty on the restored setlist.
  These pin workflow 10 **Where it sits** and Constraints 1-5. They use helper clicks only: no `#dev/*` mount, no injected state, no synthetic events.

There is no unit level: the change is component wiring with no pure module. There is no e2e-api: no endpoint is touched.

**Deferred.** Nothing.

## Decisions

1. **The target is the share opener, not literally "Share".** On the phone (and the tablet for a song), *Share* is a menu item. It does not exist in the DOM once the menu is closed, so it cannot hold focus. *More* is the control the person pressed, and what RAC restores to when a menu closes. Both are already marked `data-share-return` in `SongReading`, which `SongSharePanel` uses for the same purpose.
   - Considered: reopening the More menu with Share focused. Rejected: that restores a transient popover the person had already left, and it is a new mechanism.
   - Considered: focusing the song's title or the setlist's heading, as the people screen does. Rejected: the note names Share. Also, for a book detail the predecessor chose the trigger over a heading.
2. **Extend `shareReturnFor` and keep a string flag.** The note asks for `'song'` and `'setlist'` on the same flag. The closers cannot see which song the popped entry will open: `applyPlace` runs after them. So the guard against a stale flag is a render-time clear when no matching surface is open (Constraint 2), modelled on the `sharingSetlist` clear beside it.
   - Considered: storing the item (`{ to, bookId, path }`) and matching it with `sameItem`. Rejected: it changes the shape the predecessor's consumers read. And a pop that lands on a *different* song (a multi-step history jump) still restores a reading view, whose share opener is a correct place for focus.
3. **Song before setlist.** A song opened from a setlist renders over it (L1526 before L1655), so the song is the surface that re-mounts. Setting `'setlist'` there would leave a flag for a surface that is not drawn.
4. **All layouts, as the predecessor did.** The same closer re-mounts the surface on wide. Limiting the flag to the phone would need a mode check that only takes away the fix (predecessor Decision 4). The note's "on the phone" says where the report came from.
5. **Extend the existing e2e cases rather than add one.** The song and setlist share cases already build the hosted book, the setlist and the share surface. Building a setlist again in a new case would double its setup cost (the setlist case runs to 45 s) and pin nothing new. The note names exactly these cases.
6. **No design delta.** Workflow 10 already says Back returns to the song or setlist. Focus is the accessible half of that, under the standing accessibility rule. No board draws focus.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- `app/src/shell/AppShell.jsx`: `shareReturn` gains `'song'` and `'setlist'` (after `'people'`, before `'book'`); a flag is dropped at render time when its screen is not open; the flag and `onShareFocusReturned` are passed to `SongReading` and `SetlistView`.
- `app/src/songs/SongReading.jsx`: `autoFocusShare` / `onShareFocusReturned`; focuses the share opener once (app-bar Share on the computer, More otherwise).
- `app/src/books/SetlistView.jsx`: the same (app-bar Share on wide, More on narrow).
- behavior: `app/src/shell/AppShell.routing.behavior.test.jsx` (two extended cases, three new), `app/src/songs/SongReading.behavior.test.jsx` and `app/src/books/SetlistView.behavior.test.jsx` (one new case each).
- e2e-web: `e2e/web/tests/share.spec.js`, "share from a song" and "share from a setlist" extended with focus and axe checks on phone, tablet and computer.
- No routing change, no design delta, no tech-debt follow-up.

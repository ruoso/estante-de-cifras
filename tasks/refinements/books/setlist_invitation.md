# books.setlist_invitation — An invitation that opens on a setlist

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task setlist_invitation`
(lines 226-231), in milestone `m3_service` (`tasks/99-milestones.tji:32`).

## Effort estimate

1d.

## Repository

The app only:

- `app/src/books/SetlistView.jsx` (Share on the read view, a `sidePanel` seam).
- `app/src/books/SongSharePanel.jsx` and `app/src/books/ShareSheet.jsx` (a
  setlist mode beside the song mode).
- `app/src/shell/AppShell.jsx` (the setlist-share state and wiring, the
  setlist anchor on `BOOK_CLONED`, the people screen over an open setlist).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Tests beside each of those files.
- `e2e/web/tests/share.spec.js` and `e2e/web/lib/journeys-share.js` (one
  helper).
- The board `docs/mockups/W12-setlists.dc.html`.

The task carries design deltas, written with this refinement:
`docs/workflows/10-share.md` (**Where it sits**, and §Sharing a song, now
§Sharing a song or a setlist) and `docs/workflows/12-setlists.md` (a new
§Sharing one). Nothing lands under `cifra.md/`, `service/` or `api/`.

## Inherited dependencies

- `books.setlists` — **settled** (`complete 100`). It gives us `SetlistView`
  (read view and editor), the Setlists destination, and the e2e setlist
  helpers.
- `books.share_people` — **settled** (`complete 100`). It gives us the song's
  Share: `SongSharePanel` beside the chart on wide, `ShareSheet` in song mode
  on narrow, both mounted from `AppShell` (share_people Decision 6), and
  `useCreateInvitation`, which appends a path to the `/i/<token>` link.
- `books.setlist_picker_fixes` — **settled** (`complete 100`). It pinned
  that Done on a made invitation returns to where it was made from, and
  recorded it in workflow 10 **Where it sits**. Its parked report — *Done on a
  made invitation landing on /setlists did not reproduce* (`tasks/parking-lot.md`
  2026-10-20) — is accounted for here (Constraint 6), not re-parked.
- Used, already complete:
  - `books.share` — the `/i/<token>#<path>` anchor (share Decision 2),
    `invitationSongLink`, `songAnchorFromHash`, `bookSongPath`
    (`app/src/books/book-route.js:76-95`).
  - `books.share_needs_online` — `ShareNeedsOnline` (its Constraint 9 made it
    reusable for this task), and `sharingFacts(bookId).isLocal`.
  - `books.setlist_chrome` — opening a setlist selects the Setlists tab
    (`openSetlistOnTab`); the setlist is a full-screen early return on wide.
  - `shell.routing` — `/b/<book>/<path>` opens a setlist when the path ends
    in `.setlist.md` (`app/src/shell/place.js:27-48`).
  - `books.online`, `account.sign_in`, `books.add_by_link`, `service.sharing`
    — a hosted book, a signed-in device, a second account accepting an
    invitation.
  - e2e helpers: `hostedBookWithSong`, `finishInvite`, `acceptInvitation`
    (`e2e/web/lib/journeys-share.js:50`, `:214`, `:233`);
    `openSongFromSearch`, `syncNow` (`e2e/web/lib/journeys.js`);
    `addToNewSetlistFromSong`, `openSetlist`, `saveAllChanges`
    (`e2e/web/lib/journeys-files.js:210`, `:170`, `:153`); `openDevice`
    (`e2e/web/lib/devices.js`); `enableVirtualAuthenticator`.

Every test named below is driven by these; nothing is missing.

## What this task is

A teacher wanted students to see this week's lesson, a setlist. Sharing is per
book, so the only way was to put the whole book online and invite people to
all of it, and the invitation landed them on the shelf, not on the lesson.

This task adds **Share on a setlist**, the twin of Share on a song:

- It makes the book's ordinary invitation, with the setlist's path appended
  as the client-only `#<path>` fragment. Once accepted, the app opens **the
  setlist**, on the Setlists tab, at its address.
- For someone already a member it gives the setlist's address,
  `…/b/<book>/<path>`, which already opens setlists.
- The people invited still join the whole book. The surface says so in a
  line.
- It sits on the setlist being read: the *More* menu on a phone (the Share
  sheet), and an app-bar button on a tablet or computer (a panel beside the
  list).
- On a book only on this device it shows `ShareNeedsOnline`, as on a song.

Today an accepted invitation carrying a setlist path would be opened as a
**song** (`AppShell.jsx:758-760` always calls `setOpenSong`). This task makes
the anchor open what it names.

## Why it needs to be done

Found in the persona exploration of 2026-10-19 (guitar-teacher agents driving
the app on a local stack), and decided the same day (the `.tji` note).
A lesson setlist is the natural thing a teacher sends a class. Without this,
the teacher has to explain where to find it after joining. It is the last
open leaf in `m3_service` besides `shell.narrow_fixes`.

## Inputs / context

- **Workflow 10** (`docs/workflows/10-share.md`):
  - L84-94 **Where it sits**: song Share is a panel on wide, the sheet on a
    phone; Done returns to where the invitation was made from. Extended by
    this task's delta.
  - L168-198 §Sharing a song (now §Sharing a song or a setlist): the
    invitation opens on the song; a member gets the address; there is no
    sharing one song apart from its book; a local book offers Put online.
    Extended by this task's delta.
- **Workflow 12** (`docs/workflows/12-setlists.md`): L33-34 opening a setlist
  lists its songs; the new §Sharing one (this task's delta).
- **Workflow 7** `docs/workflows/07-add-a-book.md` L111-125: `…/b/<book>/<path>`
  is a song **or a setlist**; an address for something not here opens a plain
  screen (`app/src/shell/NotHere.jsx`).
- **DIRECTION** §3.3 L188-195 (no book reachable without an account, no link
  that opens a book to whoever holds it); §3.7 L492-494 (the address follows
  where you are: an open song or setlist is `/b/<book>/<path>`).
- **Board W10** (`docs/mockups/W10-share.dc.html`): the computer's song Share
  panel L161-226 (the panel `div` L201-224: header, intro, *For people already
  in the book*, the address, *Invite someone to this song*, role, expiry,
  Create link, People N of 50, Manage). The phone's Share sheet pattern
  L44-49. **Board W12** (`docs/mockups/W12-setlists.dc.html`): the phone
  setlist view L28-67 (app bar Back, title, quiet Edit, More); no Share drawn
  yet.
- **The code:**
  - `app/src/books/book-route.js`: `songAnchorFromHash` L76-82,
    `bookSongPath` L86-88, `invitationSongLink` L93-95. All path-generic.
  - `app/src/books/NewInvitation.jsx:219-230` `useCreateInvitation({client,
    bookId, songPath, onCreated})`: `setLink(songPath ?
    invitationSongLink(invitation.url, songPath) : invitation.url)`.
  - `app/src/books/SongSharePanel.jsx`: props L34-48; heading
    `sharing.shareTitle` L76-78; `isLocal ? <ShareNeedsOnline> :
    <HostedSongShare>` L83-106; `HostedSongShare` L112+ (`songShareIntro`,
    `SongAddress`, `songInvite`, `songInviteBody`).
  - `app/src/books/ShareSheet.jsx`: `SongAddress` L58-70; song mode by
    `songPath` L74-124; `HostedShareBody` L143-244 (the inline song invite,
    `songInviting`, `CreatedLink` Done resets it).
  - `app/src/i18n/locales/en.js`: `sharing.shareTitle` L279, `songInvite`
    L369, `songShareIntro` L372-373, `songInviteBody` L377, `songForMembers`
    / `songForMembersBody` / `songAddressLabel` L444-446.
  - `app/src/books/SetlistView.jsx`: props L134-141 (`store, bookId, path,
    mode, onBack, onPlay`); the read view's app bar L278-302 with the More
    `MenuTrigger` (`edit`, `play`, `onAction` L292-296); the editor's app bar
    L489-508 and its `sidePane` split L509.
  - `app/src/songs/SongReading.jsx`: the pattern to copy — `onShare` L157,
    `sidePanel` L165, the More item L586, the wide toolbar Share button L757
    with `data-share-return`, the panel laid out at L719-723 (`.reading-with-panel`)
    and on narrow at L819.
  - `app/src/shell/AppShell.jsx`:
    - `openSetlist` state L460; `followBookId` moves it on `BOOK_ONLINE` (L638);
    - `BOOK_CLONED` L750-761 (the anchor → `setOpenSong`);
    - `sharingFacts` L946-958 (`title`, `role`, `isLocal`); `openPeopleFrom`
      L966;
    - `openSetlistOnTab` L1069-1072;
    - `sharingScreen` L1277-1299, and the wide early return L1300 `if
      (sharingScreen && (openSong || bookDetail)) return framed(sharingScreen)`
      — it does **not** include an open setlist;
    - `songShare` L1485-1517 (the model to copy); the setlist mount
      L1569-1578, `framed(setlistView)` on wide.
  - `app/src/App.jsx:132-139` `bootInviteSongAnchor`; `:185`, `:222`.
- **Tests to extend:**
  - `app/src/books/book-route.test.js`;
  - `app/src/books/SongSharePanel.behavior.test.jsx`,
    `app/src/books/ShareSheet.behavior.test.jsx` (the `makeClient(routes)`
    loopback in `app/src/books/sharing-fixtures.js:18-39` records calls);
  - `app/src/books/SetlistView.behavior.test.jsx`;
  - `app/src/shell/AppShell.routing.behavior.test.jsx`: L546-555 "an invitation
    link ends on the song address" (the precedent), L456 "a deep URL opens its
    screen — a setlist", "AppShell share surfaces" (L732+, the Done cases from
    setlist_picker_fixes);
  - `e2e/web/tests/share.spec.js:279-327` "share from a song: the member
    address, and an invitation that opens on the song" (the precedent, with
    its local `shareSong` helper L263).
- **Predecessor refinements:** `tasks/refinements/books/share.md` Decision 2;
  `share_people.md` Decision 6 and Constraint 9; `share_needs_online.md`
  Constraint 9; `setlist_picker_fixes.md` Constraint 4 and Decision 2;
  `setlist_chrome.md` Decisions 2-4.

## Constraints / requirements

1. **One invitation, as for a song.** Share on a setlist makes the ordinary
   `POST /invitations` invitation (no contract change) through
   `useCreateInvitation` with the setlist's book-root path; the link is
   `invitationSongLink(url, path)`, `/i/<token>#<encoded path>`. The fragment
   never reaches the server. The members line gives `bookSongPath(bookId,
   path)`, the setlist's address.
2. **The surfaces gain a setlist mode, not new components.** `SongSharePanel`
   and `ShareSheet` take `itemKind: 'song' | 'setlist'` (default `'song'`)
   beside `songPath`/`songTitle`, which hold the setlist's path and title in
   setlist mode. Only the copy changes with the kind:
   - heading `Share {name}` (unchanged; the surface keeps the setlist's name
     as its accessible name);
   - intro `sharing.setlistShareIntro`: *A setlist is shared with its book,
     {book}. Everyone you invite joins {book}; the link opens it on
     {setlist}.* — the line workflow 10 asks for;
   - `sharing.setlistInvite` *Invite someone to this setlist*;
     `sharing.setlistInviteBody` *The invitation brings them into {book}, and
     opens on {setlist} once they've signed in.*;
   - `sharing.setlistAddressLabel` *Setlist address* (the members line
     `songForMembersBody` already reads generically).
   Copy in all four locales. The local-book branch (`ShareNeedsOnline`) is
   unchanged and shared.
3. **Where Share sits on the setlist** (workflow 12 §Sharing one):
   - The **read view** only. The editor has no Share (Decision 4).
   - A `share` item in the read view's More menu, on every mode, calling a
     new `onShare({bookId, path})` prop.
   - On wide, also a **Share** button in the read view's app bar, marked
     `data-share-return` as the song's is.
   - A new `sidePanel` render prop, `({title}) => node`. On wide the read view
     lays it beside the list (a split like the song's `.reading-with-panel`);
     on narrow it renders it in place (the sheet is its own overlay).
4. **AppShell owns the state.** A new `sharingSetlist` `{bookId, path}`
   state, separate from the song's `sharing` (so a song opened from the
   setlist never inherits it). It is cleared when the setlist closes or
   another opens, and `followBookId` moves it on `BOOK_ONLINE` as it moves
   `openSetlist`, so a put-online from the surface turns it into the owner's
   setlist share. `setlistShare` is built like `songShare` (L1485-1517) from
   `sharingFacts`, with `itemKind="setlist"`, `onManage`/`onOpenPeople` →
   `openPeopleFrom(bookId)`, `onSignIn` → `setSignIn({})`.
5. **The anchor opens what it names.** On `BOOK_CLONED`, an
   `inviteSongAnchor` for which `isSetlistPath` is true opens the setlist
   through `openSetlistOnTab({bookId, path})` (Setlists tab selected, a pushed
   step); any other path opens the song as today. The address ends on
   `/b/<book>/<path>`, never on the token. (The prop keeps its name — it is
   the invitation's item anchor; renaming it is churn with no reader.)
6. **The people screen over an open setlist, and Done.** On wide, Manage from
   the setlist panel opens the people screen; L1300's condition gains
   `openSetlist`, so the people screen is framed over the setlist as over a
   song. Done on an invitation made from the setlist's Share returns to the
   setlist — its address `/b/<book>/<path>.setlist.md`, the Setlists tab
   selected — and never to the bare `/setlists` destination or the book.
   This is the shape the parked report (*Done … landing on /setlists*) would
   take here; the tests below pin it through the real UI. If any of them
   fails, fix the cause where it lies (setlist_picker_fixes Constraint 4's
   rule) and name it in the Status block.
7. **Offline first.** Opening Share makes no call on a local book
   (`ShareNeedsOnline`). On a hosted book, the surface loads members and
   invitations as the song's does; offline it shows the existing `LoadState`.
8. **Accessibility.** React Aria `Button`/`MenuItem`; the panel is a
   `complementary` region named *Share {setlist}*, focus to its heading on
   open and back to Share on close; the sheet a `dialog` of the same name;
   the joins-the-whole-book line is text. axe WCAG 2.1 AA on the panel, the
   sheet, the local state, and the setlist a joiner lands on.
9. **No book without an account.** Nothing new is reachable: the setlist
   address opens only for members (`NotHere` otherwise); the invitation is
   the book's.
10. **Fixtures** are songs and setlists written for the purpose
    (`share.spec.js`'s *Roda de rua* in *Choros da Ana*; a setlist *Lesson 3*).

## Acceptance criteria

**Behavior.** On a setlist in a book on Estante, Share (More menu; app-bar
button on a tablet or computer) opens the sheet on a phone and a panel beside
the list wider. It gives a member the setlist's address and lets the owner
make an invitation whose link carries the setlist's path. Someone accepting it
lands on the setlist, on the Setlists tab, at its address. Done after making
the link returns to the setlist. On a book only on this device the surface
offers Put online. Workflows 10 and 12 record it (the deltas below), and W12
draws it.

**Tests, by level:**

- **unit**, `app/src/books/book-route.test.js`:
  - `invitationSongLink(url, 'lessons/lesson 3.setlist.md')` →
    `…#lessons/lesson%203.setlist.md` (slash kept, segment encoded), and
    `songAnchorFromHash` of it gives the path back.

  Pins share Decision 2 for a setlist path.
- **behavior**, `app/src/books/SongSharePanel.behavior.test.jsx`, new
  `describe('Share on a setlist, wide (workflow 10 §Sharing a song or a setlist)')`:
  - owner, `itemKind="setlist"`: the region *Share Lesson 3*; the line
    *Everyone you invite joins Choros da Ana; the link opens it on Lesson 3.*;
    the *Setlist address* field holds `<origin>/b/<book>/lessons/lesson-3.setlist.md`;
    *Invite someone to this setlist* → Create link → the link field ends in
    `#lessons/lesson-3.setlist.md`, and the recorded `createInvitation` body
    carries no path (the fragment is client-only); axe clean;
  - reader: the address and no invite; axe clean;
  - local book (`isLocal`, `makeClient({})`): the needs-online body under
    *Share Lesson 3* and zero recorded calls.
- **behavior**, `app/src/books/ShareSheet.behavior.test.jsx`, new
  `describe('a setlist’s Share sheet on a phone')`: the same three cases on
  the sheet (the `dialog` *Share Lesson 3*; *Invite someone to this setlist*
  → Create link → link with the fragment; Done returns to the sheet's
  summary); axe clean.
- **behavior**, `app/src/books/SetlistView.behavior.test.jsx`:
  - narrow: the More menu has *Share*; choosing it calls `onShare({bookId,
    path})`; no app-bar Share button;
  - wide: the app bar has *Share*, pressing it calls `onShare`; a `sidePanel`
    renders beside the list (the list still visible, not aria-hidden); axe
    clean with the panel open;
  - the editor (after Edit) offers no Share.

  Pins workflow 12 §Sharing one (Constraint 3).
- **behavior**, `app/src/shell/AppShell.routing.behavior.test.jsx`:
  - "an invitation link ends on the setlist address": `/i/tok-secret#lessons/lesson-3.setlist.md`,
    `inviteSongAnchor` set, `SHELF`, `BOOK_CLONED` → `location.pathname` is
    `/b/<book>/lessons/lesson-3.setlist.md`, the Setlists tab selected, the
    setlist's heading shown, no `tok-secret` in the URL (Constraint 5;
    workflow 10 §Sharing a song or a setlist). The song case beside it stays
    green.
  - narrow, in "AppShell share surfaces": open setlist → More → Share → the
    sheet → *Invite someone to this setlist* → Create link → Done → Close:
    the setlist is shown at its address, the Setlists tab selected, never
    `/setlists` (Constraint 6; workflow 10 **Where it sits**).
  - wide: open setlist → Share → Manage → the people screen is shown over the
    setlist; its Back returns to the setlist at its address (Constraint 6).
  - wide, a local book: the setlist panel shows the needs-online body; after
    `BOOK_ONLINE` (local → service id) the panel is the owner's setlist share
    under the new id (Constraint 4, `followBookId`).
- **e2e-web**, `e2e/web/tests/share.spec.js`, new test "share from a setlist:
  the member address, and an invitation that opens on the setlist", on phone,
  tablet and computer:
  - `hostedBookWithSong(page, BOOK, SONG_TITLE)`; `openSongFromSearch`;
    `addToNewSetlistFromSong(page, SONG_TITLE, 'Lesson 3')`; save the new
    setlist through the real UI (the book's file view, `saveAllChanges`) so
    it reaches the book; `openSetlist(page, 'Lesson 3')`.
  - A new helper `shareSetlist(page)` in `e2e/web/lib/journeys-share.js`
    (More → Share on the phone; the app-bar Share wider) returns
    `{surface, address}`. The surface is the `dialog` (phone) or the
    `complementary` region (wider) named *Share Lesson 3*; wider, the
    setlist's list is still visible and there is no dialog. The
    joins-the-whole-book line is visible. `address` matches
    `/\/b\/[^/]+\/.+\.setlist\.md$/`. axe (`analyzeBothThemes`) clean.
  - *Invite someone to this setlist* (phone) → Create link: the link has
    `/i/` and `#…setlist.md`. `finishInvite`. The setlist is still shown and
    the URL path ends in `.setlist.md`, not `/setlists` (Constraint 6).
  - A second account on a fresh device (`openDevice`,
    `enableVirtualAuthenticator`, `acceptInvitation`) lands on the setlist:
    its level-2 heading *Lesson 3* and *Roda de rua* in its list, the URL on
    its address; axe clean there. Then `goto(address)` opens the same
    setlist for the member.

  Pins workflow 10 §Sharing a song or a setlist, workflow 12 §Sharing one,
  workflow 10 **Where it sits**. Real UI only.
- **Board.** `docs/mockups/W12-setlists.dc.html` draws Share on the setlist:
  the phone's More with *Share*, the Share sheet over the setlist (*Share Bar
  do Zé, 10 October*, the address, the joins-the-whole-book line, *Invite
  someone to this setlist*), and on the computer the app-bar Share with the
  panel beside the list, in W10 #4's shape (`W10-share.dc.html` L201-224).
  The board's size stays registered in `docs/mockups/canvas.json` (grow its
  `h` there if the new frames need it).

No e2e-api: the task calls no endpoint it does not already call.

## Decisions

1. **The fragment, as for a song.** The setlist path rides the same
   client-only `#<path>` fragment (share Decision 2), read once at boot and
   applied on `BOOK_CLONED`. *Rejected:* carrying the setlist on the
   invitation server-side — a contract change (`CreateInvitationRequest` is
   `additionalProperties: false`) for something only the inviter's client
   needs, and the note decides the fragment.
2. **A setlist mode on the existing surfaces, not new ones.** The song panel
   and sheet already hold the address, the invite, the people line and the
   local-book branch; only words differ. *Rejected:* `SetlistSharePanel` /
   `SetlistShareSheet` — a copy of two components whose behaviour must stay
   identical (Done, focus return, local branch). *Rejected:* renaming
   `songPath`/`songTitle`/`inviteSongAnchor` to item-neutral names — churn
   across tests and call sites with no behaviour change; a comment says they
   name the shared item.
3. **The anchor decides by the path.** `isSetlistPath` (`place.js`) already
   decides song vs setlist for every address; the anchor uses the same test,
   so an invitation and an address can never disagree. *Rejected:* a second
   fragment shape (`#setlist:<path>`) — two encodings of one thing.
4. **Share on the read view only.** A setlist is shared as it is in the book;
   the editor is for changing it, and its app bar is full on a phone
   (Add song, Play, Discard, Save). Share on a song is likewise on the
   reading view, not the editor. A setlist with unsaved changes is shared
   as the book holds it (workflow 12 §Sharing one); the invitation still
   works, and the change reaches the invited once saved and synced.
   *Rejected:* refusing Share until the setlist is saved — a rule no other
   share has, and it would block a teacher sharing last week's lesson while
   editing this week's.
5. **Separate state from the song's share.** `sharingSetlist` is not the
   song's `sharing`: a song opened over a setlist (a song row tapped) must
   not show the setlist's panel, and closing the setlist must close its
   share. *Rejected:* one `sharing` state keyed by path kind — the song view
   reads `sharing` today and would need guarding at every read.
6. **Done is pinned, not rewired.** Following setlist_picker_fixes
   Decision 2, the existing wiring (the sheet's inline invite resets on Done;
   the people screen's Done is `back(closers.newInvitation)`) is expected to
   return to the setlist. The tests pin it in jsdom and in a real browser on
   three viewports; the parked report is answered by them for this path and
   is not re-parked.

### Design delta

Written with this refinement; they ride in the closer's commit.

- `docs/workflows/10-share.md` **Where it sits**: *Share* on a song **or a
  setlist** is a panel beside it on wide and the sheet on a phone; Done
  returns to the song or setlist whose Share made the invitation.
- `docs/workflows/10-share.md` §Sharing a song → §**Sharing a song or a
  setlist**: a setlist is shared the same way — the book's invitation,
  opening on the setlist; members get its address; the invited join the
  whole book and the surface says so in a line; the local-book paragraph
  covers a setlist too.
- `docs/workflows/12-setlists.md`: a new §**Sharing one** — why (the lesson),
  that it shares the book, where Share sits (More on a phone, app bar wider),
  the local book, and that a change not yet saved reaches the invited once
  saved and synced.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-20.

- Share on a setlist's read view: a *Share* item in More on a phone and an app-bar button on a tablet or computer, in `app/src/books/SetlistView.jsx` (with a `sidePanel` seam) and `app/src/books/setlist.css`.
- A setlist mode (`itemKind="setlist"`) on the existing song share surfaces, `app/src/books/SongSharePanel.jsx` (panel beside the list) and `app/src/books/ShareSheet.jsx` (phone sheet): the setlist address for members, an invitation whose link carries `#<setlist path>`, a line saying everyone invited joins the whole book, and `ShareNeedsOnline` on a book only on this device.
- `app/src/shell/AppShell.jsx`: setlist-share state and wiring; an accepted invitation opens the setlist on the Setlists tab at its address; the people screen opens over an open setlist; Done returns to the setlist.
- Strings in `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Tests: `app/src/books/book-route.test.js` (unit); behavior in `SongSharePanel`, `ShareSheet`, `SetlistView` and `AppShell.routing` `.behavior.test.jsx` (the popover-surface case now expects More = Edit, Play, Share); e2e-web `e2e/web/tests/share.spec.js` with the new helper `shareSetlist` in `e2e/web/lib/journeys-share.js`, green on phone, tablet and computer.
- Design: `docs/workflows/10-share.md`, `docs/workflows/12-setlists.md`, board `docs/mockups/W12-setlists.dc.html` and `docs/mockups/canvas.json` (W12 height 1500 → 2500, boards below moved down 1000); the canvas needs republishing (parking lot).
- No tech-debt follow-ups.

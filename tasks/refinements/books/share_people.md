# books.share_people — Sharing names people, and reads as drawn

## TaskJuggler entry

[`tasks/65-books.tji` L149-154](../../65-books.tji), `books.share_people`:

> The Share sheet lists a member, and who joined through an invitation, by raw
> account id (1813458e-...) where the W10 board names them (workflow 10:
> members listed). Name people by their display name (the service's
> members/invitations responses carry it, or the contract gains it). Also from
> W10: the new invitation lacks the room-left callout, invitations lack Copy
> link, the owner's people screen and a song's share are sheets where the board
> draws a screen and a side panel. Source: UI pairwise audit 2026-10-14 (e2e
> mockup() screenshots vs rendered boards, audit/out). Tests: behavior (names,
> not ids; Copy link; axe); e2e-api (members and invitations carry names);
> e2e-web (two people, the owner sees the other by name; mockup W10#1-6).

Milestone: `milestones.m5_complete` (`tasks/99-milestones.tji` L44).

## Effort estimate

2d (as the WBS has it). One service change (names on two responses, a
re-derivable invitation link), one app change (the sharing surface split into
the four places the board draws), and the tests at four levels.

## Repository

Not under `cifra.md/`. The work lands in:

- `service/internal/server/` — `sharing.go` (names on members and joiners, the
  derived invitation token and the owner's `url`), `books.go` (the existing
  `ownerNames` reader, reused for any account), `server.go`/`app.go` (the new
  secret threaded into the handlers); `service/internal/config/config.go`
  (`ESTANTE_INVITATION_SECRET`); `compose.yaml` (its dev value).
- `api/openapi.yaml` — descriptions only (`Member.displayName`,
  `Joiner.displayName`, `Invitation.url`); no field is added or removed.
- `app/src/books/` — the sharing surface (`SharingScreen.jsx` split, below),
  `sharing.css`, a new pure `people.js`; `app/src/books/BookDetail.jsx` and
  `app/src/shell/AppShell.jsx` (where each surface mounts);
  `app/src/songs/SongReading.jsx` (room for the side panel on wide);
  `app/src/i18n/locales/{en,es-419,it,pt-BR}.js`.
- Tests: `service/internal/server/sharing_test.go`,
  `service/internal/config/config_test.go`, `e2e/api/sharing.test.js`,
  `app/src/books/*.test.js(x)`, `app/src/shell/AppShell.routing.behavior.test.jsx`,
  `e2e/web/tests/share.spec.js`, `e2e/web/lib/journeys-share.js`.

**Design delta (rides in this task's commit):**

- `docs/DIRECTION.md` §3.3 (the sentence on names, ~L173-177): the service
  reads a person's name from their home book to name them to those workflow 10
  §Who sees whom lets see them — the owner to members (as before), every member
  and every joiner to the owner, the editors to the members — and to no one
  else. It still stores no name.
- `docs/workflows/10-share.md`: §Invitations gains the bullet that the owner can
  copy an open invitation's link again, from any device; §Who sees whom gains
  how a person is named (their `authorName`, else *Unnamed reader* / *Unnamed
  editor*, never an id) and **Where it sits** (phone sheet → people screen and
  new-invitation screen; tablet/computer people screen with a new-invitation
  dialog; a song's share a side panel on tablet/computer, the sheet on phone).

## Inherited dependencies

All settled (`complete 100`):

- `books.share` — the sharing surface this task reshapes
  (`app/src/books/SharingScreen.jsx`, `sharing-client.js`, `book-route.js`,
  `share.spec.js`, `journeys-share.js`).
- `service.sharing` — members, invitations, the cap, who-sees-whom
  (`service/internal/server/sharing.go`).
- Transitively: `books.add_by_link` (a second person joining through `/i/…`,
  `acceptInvitation` in `journeys-share.js`), `books.online` (a hosted book,
  `hostedBookWithSong`), `books.owner_name` (`Store.ReadAuthorName`,
  `ownerNames`, the `ownerNameOnService` e2e fixture).

Driving every named test:

| Test needs | Provided by |
|---|---|
| a hosted book and a second account joining it | `books.online`, `books.add_by_link` (`hostedBookWithSong`, `inviteThroughShare`, `acceptInvitation` in `e2e/web/lib/journeys-share.js`) |
| a person's `authorName` on the service | `books.owner_name`: `ownerNameOnService(page, name)` (`journeys-share.js` L80-111) seeds the signed-in account's home book with the git CLI — it works for the joiner's page as for the owner's; Go: `seedHomeBookName` (`books_test.go` L509); e2e-api: the git-CLI home-book push of `sharing.test.js` L276-300 |
| a full book | `service.sharing`/`books.add_by_link`: `seedMembers` (`sharing_test.go` L189), `fillBookToCapacity` (`e2e/web/lib/db.js`) |
| the real clipboard | `context.grantPermissions(['clipboard-read','clipboard-write'])`, as `e2e/web/tests/editor.spec.js` L65 does |

Nothing is missing.

## What this task is

The audit (2026-10-14) found four gaps between the shipped sharing surface and
the W10 board. This task closes them:

1. **People are named, never an account id.** The service fills
   `Member.displayName` and `Joiner.displayName` with the name the person gives
   their saves (`authorName` in their home book), within who-sees-whom. The app
   shows that name; someone with none reads *Unnamed reader* / *Unnamed
   editor* (a joiner who is no longer a member: *Someone unnamed*).
2. **An open invitation's link can be copied again.** The owner's
   `listInvitations` carries `url` for every invitation that can still let
   someone in, and each such invitation card has **Copy link**.
3. **The new invitation carries the room-left callout** (W10 #2).
4. **The surfaces sit where the board draws them**: phone — the Share sheet
   (#1) leading to the people screen and the New invitation screen (#2);
   tablet and computer — the people screen (#3, #5) with removal as a centred
   dialog; a song's share on tablet/computer — a side panel beside the chart
   (#4); a member's view (#6) in the same places the owner's would be.

## Why it needs to be done

Workflow 10 §Who sees whom has the owner see "every member with their role,
and every invitation with who joined through it" — a list of UUIDs is not
seeing who. The audit's finding: `memberLabel = (m) => m.displayName ||
m.userId` (`app/src/books/SharingScreen.jsx` L82) falls through to the id on
every row, because `service.sharing` decided "no display name is stored or
returned" (`memberJSON` comment, `sharing.go` L117-124; `joinerJSON` L134-137
has no name at all). It also makes the typed-name remove confirm ask the owner
to type a UUID (`RemoveMemberDialog` L96-138). `books.owner_name` since built
the seam (`Store.ReadAuthorName`, `ownerNames` in `books.go` L62-89) and named
this task as its second consumer.

Workflow 10 §Invitations has one link sent to a whole class; a teacher whose
next student arrives a week later has, today, no way to send it again but to
withdraw it and make another (`books.share` Decision 6) — and the board (#3)
draws Copy link on the invitation card. The rest is the board: the callout,
and a sheet everywhere (`SharingScreen.jsx` L603-604, `sharing.css` has no
media query) where #3-#6 draw a screen and a panel.

It is in M5 ("The first pass, complete"); nothing downstream depends on it.

## Inputs / context

**Governing documents**

- `docs/workflows/10-share.md` — §At most fifty people per book (L27-38: *37
  of 50*), §Invitations (L40-60, and the new copy-again bullet), §Who sees whom
  (L74-, and the new naming and **Where it sits** paragraphs), §Removing
  someone (takes effect at their next request; what is on their device stays),
  §Sharing a song (the invitation opens on the song; members get
  `…/b/<book>/<path>`).
- `docs/DIRECTION.md` §3.3 (~L165-177, names; L181-187, no book without an
  account, fifty people), §3.6 The API (L398-401, Sharing), §3.7 (L446-448,
  sheets and dialogs through React Aria).
- `docs/mockups/W10-share.dc.html` (canvas.json L90-95), frames as
  `e2e/web/lib/mockup-frames.json` indexes them (#1-2 phone, #3 tablet, #4-6
  desktop):
  - **#1** (L26-68) phone bottom sheet "Share Choros da Ana": "Only people you
    invite can open this book, each with their own account."; "People" **37 of
    50**, bar, "Room for 13 more."; a row "Members" / "You, 1 editor, 36
    readers" ›; "Invitations" rows "Reader invitation · 2 Oct" / "open until 9
    Oct · 36 joined" ›, "Editor invitation · 28 Sep" / "1 use, used · Marina
    Costa joined" ›; primary "Invite people".
  - **#2** (L70-104) phone screen "New invitation": Reader/Editor segmented,
    Expires list, "Limit how many can use it", the accent callout "Choros da
    Ana has room for **13 more** people. Once it has 50, this link stops
    letting anyone in.", "You'll see who joins through it, and can withdraw it
    at any time.", footer "Create link".
  - **#3** (L110-158, data L293-300) tablet screen "Choros da Ana · People",
    primary "New invitation"; card "37 of 50 people" / "besides you · room for
    13 more" / bar / "Only the people listed here can open Choros da Ana. When
    it has 50, invitations stop letting anyone in."; Members — "Ana (you)" /
    "owns this book" / Owner badge; "Marina Costa" / "through the editor
    invitation of 28 Sep" / "Editor ▾" / Remove; four readers; "Show 32 more
    readers"; Invitations cards — title, state badge (*open* / *used up*),
    terms, "**Joined through it:** 36 people: Joana Lima, Rafael Souza, Beatriz
    Alves, Lucas Pereira and 32 more", **Copy link**, Withdraw; footer
    "Withdrawing an invitation stops anyone new joining through it. Those who
    joined stay members."; the dialog "Remove Lucas Pereira?" with Cancel and
    "Remove Lucas".
  - **#4** (L163-227) computer, a 400px side panel beside Carinhoso, no scrim:
    "Share Carinhoso" ✕; "A song is shared with its book, Choros da Ana. …";
    "For people already in the book" / "Members open Carinhoso at its
    address." read-only address + Copy; "Invite someone to this song" / "The
    invitation brings them into Choros da Ana, and opens on Carinhoso once
    they've signed in." Reader/Editor, "Expires in a week · no limit on uses"
    Change, "Create link"; "People" 37 of 50, bar, "1 editor, 36 readers · 2
    invitations", Manage.
  - **#5** (L230-241) the people screen full: badge *Full*, "50 of 50 people"
    / "no room left", the conflict notice, "Review members".
  - **#6** (L242-254) a member's "Choros da Ana · Sharing", chip "You're a
    reader", "Shared with you by Ana. … Other readers aren't listed.", Ana /
    "shares this book" / Owner, Marina Costa / "saves to this book" / Editor.
- `docs/mockups/README.md` "Decisions the drawings carry" — status badges carry
  a word, never colour alone.

**Predecessor refinements**

- `tasks/refinements/books/share.md` — Decision 1 (main-thread
  `sharing-client.js`, not the Worker), Decision 3 (ids, names parked — revised
  here), Decision 4 (full screen narrow / master-detail wide — planned, built
  as a sheet; realised here), Decision 5 (the app shows the count, never
  enforces it), Decision 6 (link shown once — revised here).
- `tasks/refinements/service/sharing.md` — the token is 32 random bytes stored
  as its SHA-256; "No display name is stored or returned"; the cap at accept.
- `tasks/refinements/books/owner_name.md` — `Store.ReadAuthorName`
  (`service/internal/book/book.go` L114-142), `ownerNames` (`books.go`
  L62-89, keyed by account id, one read per account per request), "the
  service stores no name"; the e2e fixture `ownerNameOnService`.

**Code seams**

- Service: `handleListMembers` (`sharing.go` L663; owner prepended,
  `visibleMembers` L102 filters), `handleListInvitations` (L307; joiners per
  invitation from `invitation_joins` L347), `handleCreateInvitation` (L229;
  token at L272, `invitationURL` L298), `acceptInvitationTx` (L524, looks the
  token up by hash). Tables: `invitations` (`0001_registry.sql` L116-126, `id
  uuid DEFAULT gen_random_uuid()`, `token text UNIQUE` — the hash),
  `invitation_joins` (L133-138). Config: `LinkSecret` / `ESTANTE_LINK_SECRET`
  (`config.go` L146-151, L255-261: required, no insecure default) is the
  pattern; `compose.yaml` L84 its dev value.
- Contract: `Member` (`openapi.yaml` L1486-1497, optional `displayName`),
  `Joiner` (L1523-1533, optional `displayName`, `joinedAt`), `Invitation`
  (L1549-1585, optional `url`).
- App: `SharingScreen.jsx` (634 lines: `MemberRow` L144-188,
  `RemoveMemberDialog` L96-138, `InvitationRow` L209-215, `InviteForm`
  L238-313, `CreatedLink` L318-346, `copyToClipboard` L87-91, count and room
  L441-470, song share L523-536, the sheet L603-604); mounted from
  `BookDetail.jsx` L527-534/L557-563 and `AppShell.jsx` L333-337/L969-995
  (over `SongReading`, which raises `onShare` from `SongReading.jsx` L533,
  L690). Layout: `useLayoutMode()` (`AppShell.jsx` L86) over `WIDE_QUERY =
  '(min-width: 600px)'` (`app/src/shell/layout-mode.js`); a full screen over
  the shell is `FileView` (`AppShell.jsx` ~L878-882, with `back(closers.…)`,
  `closers` L417); sheet-on-narrow / centred-on-wide is
  `SongArrange.jsx` L407-417; the reading split is `.split.reading-split`
  (`SongReading.jsx` L665, L709).
- Tests today: `SharingScreen.behavior.test.jsx` (11 cases; L97 asserts `/1
  person · u2/` — the id), `sharing-client.test.js`, `sharing_test.go`
  (`TestListMembersWhoSeesWhom` L537, `TestListInvitations` L276,
  `TestCreateInvitation` L207, `TestInvitationTokenHash` L64),
  `e2e/api/sharing.test.js`, `e2e/web/tests/share.spec.js` (L52 two-person
  journey, L165 share from a song; `mockup(page,'W10-share',n)` at L65, L69,
  L111, L175, L179, L184).

## Constraints / requirements

1. **The service still stores no name** (DIRECTION §3.3). Names are read at
   request time from each person's home book through the existing `ownerNames`
   reader (renamed `accountNames` or kept, the implementer's call), one read
   per account per request; a missing home book, an unset or unreadable name is
   no `displayName` — never an error, never logged.
2. **Names follow who-sees-whom exactly.** The owner's `listMembers` names
   every member; a member's names the owner and the editors only (they are the
   only ones `visibleMembers` returns). `Joiner.displayName` appears only in
   `listInvitations`, which is owner-only. No other response gains a name.
3. **Never an account id on screen.** No rendering path falls back to
   `userId`. The fallback is a word by role: *Unnamed reader*, *Unnamed
   editor*; a joiner no longer a member, *Someone unnamed*.
4. **The invitation link is re-derivable, not stored.** The token for a new
   invitation is `base64url(HMAC-SHA256(ESTANTE_INVITATION_SECRET,
   invitation id))`; the row keeps only its SHA-256, as now, and accept still
   looks up by the hash. The id is generated before the insert (`SELECT
   gen_random_uuid()`, or in Go), so token and id land in one insert. The
   owner's `listInvitations` carries `url` for an invitation that is not
   withdrawn, not expired and not used up **and** whose derived token hashes to
   the stored one — so an invitation made before this task, or under a rotated
   secret, carries no `url` and simply offers no Copy link (it still works for
   whoever holds it). `ESTANTE_INVITATION_SECRET` is required at start-up with
   no insecure default, single-purpose (never `LinkSecret`), its dev value in
   `compose.yaml`; it is never logged.
5. **No token in logs**, as now (`redactInvitationToken`); the list response
   is not logged.
6. **Layout follows the board, keyed on `mode`** (`'narrow'` < 600px ≤
   `'wide'`):
   - *Share on a book*, narrow: the **Share sheet** (#1, a RAC Modal sheet).
     Its Members row and each Invitations row open the **people screen**;
     *Invite people* opens the **New invitation screen** (#2). Both screens
     are full screens over the shell, mounted from `AppShell` as `FileView` is,
     with Back through `closers`.
   - *Share on a book*, wide: the **people screen** directly (#3/#5); its *New
     invitation* opens the same form as a centred dialog (`scrim center`, the
     `SongArrange` precedent); Remove is a centred `alertdialog` (#3).
   - *Share on a song*, wide: a **side panel** (#4) inside the reading view's
     split, beside the chart — not a Modal: no scrim, the chart stays
     reachable and not `aria-hidden`; a `complementary` region labelled "Share
     <song>", focus moves to its heading on open and back to Share on close
     (✕ or Escape). *Manage* opens the people screen.
   - *Share on a song*, narrow: the sheet with the song's content (the address
     for members, *Invite someone to this song* for the owner), as today.
   - A member's *Share* opens the same places, with what a member sees (#6:
     "You're a reader"/"You're an editor", the owner and editors listed, "Other
     readers aren't listed."; no counts beyond what `listMembers` gives, no
     controls).
7. **Copy is drawn as on the board, in whole sentences** per locale (four
   locales), and pronoun-free: the remove dialog reads *Remove {name}?* /
   *{name} joined through your {role} invitation of {date}. Removing them takes
   effect the next time their app reaches Estante; the other members are not
   affected.* / *What is already on their device stays there. It can't be
   recalled. The book will have room for {n} more.* with **Cancel** and
   **Remove {name}** — the board's "him/his" is not carried (a person's
   pronouns are not known). For someone unnamed, *Remove this reader?* /
   *Remove this editor?* and **Remove**.
8. **Who joined through it** lists up to four names then "and {n} more"; the
   people screen lists the owner, the editors, and the first readers (up to
   four) with *Show {n} more readers* as a disclosure (#3). A member's meta
   line names the invitation they joined through (*through the reader
   invitation of 2 Oct*), found in the app from the owner's invitations list
   (`joined[].userId`, latest `joinedAt`) — no contract change; with none
   found, the role line alone.
9. **Copy link** writes the URL with `navigator.clipboard.writeText` and says
   so in a word — the button reads *Copied* (announced through a polite live
   region) — and on failure says *Couldn't copy* and shows the link in a
   read-only field to select by hand. A song's invitation link copied from a
   song's panel carries the song fragment (`invitationSongLink`); a listed
   invitation's Copy link copies the book link.
10. **The room-left callout** on the New invitation form (#2), in the accent
    notice: *{book} has room for {n} more people. Once it has 50, this link
    stops letting anyone in.*; on a full book the conflict notice *{book} is
    full. This link won't let anyone in until you remove someone.* — and
    *Create link* stays enabled (the service allows it; `books.share`
    Decision 5).
11. **Accessibility**: React Aria Components for every control (sheet, dialog,
    alertdialog, disclosure, segmented role `RadioGroup`, `MenuTrigger` role
    menu, buttons); every overlay portaled inside `.est` (RAC overlays portal
    outside the theme root otherwise); state badges carry a word (*open*,
    *used up*, *withdrawn*, *expired*, *Full*); axe clean at WCAG 2.1 AA.
12. **Boundaries**: the sharing calls stay on the main thread
    (`sharing-client.js`, `books.share` Decision 1); the app and service share
    nothing but `api/openapi.yaml`.
13. **Fixtures** use people and songs written for the purpose (Ana, Bia
    Rocha, Choros da Ana, Roda de rua — as the existing spec does).

## Acceptance criteria

### Behavior delivered

- The owner's people list and every invitation's *Joined through it* name each
  person by their `authorName`; nobody is shown by id.
- Each open invitation has **Copy link**, on any device of the owner.
- The New invitation form says how much room the book has.
- Phone: Share sheet → people screen / New invitation screen; tablet and
  computer: people screen with a dialog; a song's share is a side panel on
  wide.
- Remove confirms as drawn, without a typed name.

### Tests, by level

**unit**

- Go, `service/internal/server/sharing_test.go`:
  `TestInvitationTokenDerived` — the derived token is stable for one id and
  secret, differs across ids and across secrets, and its hash is what the row
  stores. *Pins:* Constraint 4.
- Go, `service/internal/config/config_test.go`: a case that a missing or empty
  `ESTANTE_INVITATION_SECRET` fails start-up, and a set one is read. *Pins:*
  Constraint 4.
- Vitest, `app/src/books/people.test.js` (new pure module `people.js`):
  `personLabel` (name, else *Unnamed reader/editor*, never the id),
  `memberSummary` ("You, 1 editor, 36 readers", singular/plural),
  `joinedSummary` (≤ 4 names, "and {n} more"), `joinedThrough` (the latest
  invitation whose `joined` holds the member), `roomLeft`. *Pins:* workflow 10
  §Who sees whom, §At most fifty; W10 #1, #3.

**behavior**

- Go, `sharing_test.go` (httptest, compose Postgres, real git, sessions by the
  passkey ceremony, names by `seedHomeBookName`, responses through
  `e.contract.Validate`):
  - `TestListMembersNames` — the owner's list carries every named member's
    `displayName` and omits it for one with no name; a reader's list carries
    the owner's and the editor's names and no reader at all. *Pins:* workflow
    10 §Who sees whom; DIRECTION §3.3 (delta).
  - `TestListInvitationsJoinerNames` — `joined[].displayName` for a named
    joiner, absent for an unnamed one, kept for one since removed. *Pins:*
    workflow 10 §Invitations ("who has joined through it").
  - `TestListInvitationsURL` — the owner's list carries, for an open
    invitation, the same `url` the create returned, and accepting through it
    joins; no `url` on a withdrawn, an expired and a used-up invitation, nor on
    one whose stored hash does not match the derivation (a row seeded with a
    random token). *Pins:* workflow 10 §Invitations (copy-again, delta);
    Constraint 4.
  - the existing `TestCreateInvitation`, `TestAcceptInvitation`,
    `TestListInvitations`, `TestListMembersWhoSeesWhom` stay green with the
    derived token.
- Vitest + Testing Library + axe, `app/src/books/` (the cases of
  `SharingScreen.behavior.test.jsx` move into these files as the component is
  split; none is dropped; the `/1 person · u2/` assertion becomes a name):
  - `ShareSheet.behavior.test.jsx` — #1: "37 of 50", "Room for 13 more.", the
    Members row "You, 1 editor, 36 readers" opening the people screen,
    invitation rows "open until …· N joined" / "1 use, used · Marina Costa
    joined", *Invite people*; a song's sheet (owner: invite to this song;
    member: the address with Copy). axe on each.
  - `PeopleScreen.behavior.test.jsx` — #3: names and meta lines ("Ana (you)" /
    "owns this book", "through the editor invitation of 28 Sep"), *Unnamed
    reader* for a member without a name and no id anywhere in the rendered
    text (asserted with a UUID pattern); *Show N more readers*; invitation
    cards with state badges and *Joined through it: … and N more*; **Copy
    link** on an open invitation writes the listed `url` to a stubbed
    `navigator.clipboard` and reads *Copied*; no Copy link on a withdrawn one
    nor on one without `url`; a failed write shows *Couldn't copy* and the link
    field; change role; withdraw; Remove — the dialog's sentences and **Remove
    Bia Rocha**, no text field, the member gone and the count down; the full
    book (#5: *Full*, "50 of 50 people", the notice); the member's view (#6:
    "You're a reader", the owner and editor named, "Other readers aren't
    listed.", no controls). axe on each state, the dialog open.
  - `NewInvitation.behavior.test.jsx` — #2: the room callout "Choros da Ana has
    room for 13 more people. …"; the full-book notice with *Create link*
    still enabled; role, expiry, use limit; the created link with Copy. axe.
  - `SongSharePanel.behavior.test.jsx` — #4: a `complementary` region "Share
    <song>", focus to its heading on open and back to Share on close and on
    Escape; the member address + Copy; invite to this song carries `#<path>`;
    the People summary "1 editor, 36 readers · 2 invitations" with *Manage*.
    axe.
- `app/src/shell/AppShell.routing.behavior.test.jsx` (new
  "AppShell share surfaces" cases): narrow, Share on a book opens the sheet,
  Members opens the people screen full-screen and Back returns to the book;
  wide, Share on a book opens the people screen; wide, Share on a song opens
  the panel with the reading view still present and not `aria-hidden`.
  *Pins:* workflow 10 §Who sees whom **Where it sits** (delta).
- `sharing-client.test.js` stays green (no request shape changes).

**e2e-api** — `e2e/api/sharing.test.js`, new case "members and invitations
carry the names people gave their saves, and the owner copies an open
invitation's link again": the owner and a second account each push a home book
with an `authorName` (the git-CLI push of the existing `ownerName` case); the
owner invites, the second accepts; the owner's `listMembers` names the member,
`listInvitations` names the joiner and carries `url` equal to the create's; a
third account accepts through that listed `url`; after withdraw, `url` is
gone; the member's `listMembers` names the owner only (no reader). *Pins:*
workflow 10 §Who sees whom, §Invitations; DIRECTION §3.3 (delta).

**e2e-web** — `e2e/web/tests/share.spec.js`, on phone, tablet and computer,
axe at WCAG 2.1 AA on every surface:

- the existing two-person journey (L52), changed: after the joiner makes an
  account, `ownerNameOnService(joiner.page, 'Bia Rocha')` gives them a name;
  the owner's people screen then lists **Bia Rocha** (and *Joined through it:
  Bia Rocha*), and no account id appears; the role change and Withdraw as now;
  Remove confirms with **Remove Bia Rocha** (no typed name —
  `removeFirstMember` in `journeys-share.js` updated). On the phone the path is
  sheet → Members → people screen; on tablet and computer Share opens the
  people screen. `mockup(page,'W10-share',1)` on the sheet,
  `,2` on the New invitation screen with the room callout, `,3` on the people
  screen with the remove dialog open.
- new test "the owner copies an open invitation's link again, and a third
  person joins through it": `context.grantPermissions(['clipboard-read',
  'clipboard-write'])`; the owner presses Copy link on the open invitation,
  reads *Copied*, and the copied text (read with
  `navigator.clipboard.readText()`) opened in a fresh device lets that person
  join; after Withdraw the card offers no Copy link. *Pins:* workflow 10
  §Invitations (delta).
- the share-from-a-song test (L165), changed: on computer and tablet Share
  opens the side panel beside the chart (the chart heading still visible),
  `mockup(page,'W10-share',4)`; *Manage* opens the people screen; on phone the
  sheet as now.
- `mockup(page,'W10-share',5)` on the people screen of a book filled with
  `fillBookToCapacity` (the add-by-link full-book fixture), *Full* and "50 of
  50 people"; `mockup(page,'W10-share',6)` on the joiner's Share, "You're an
  editor"/"You're a reader" and the owner named.

No test level is dropped. No test is deferred. No deferred WBS leaf.

## Decisions

1. **Names come from home books, read per request (DIRECTION §3.3 delta).**
   *Rationale:* it is the seam `books.owner_name` built and named this task as
   its consumer; the name already travels in every book the person saves to;
   the service still stores none. A list costs at most 51 `cat-file` reads,
   cached per account within the request — bounded by the cap.
   *Rejected:* a `display_name` column on `accounts` (`service.sharing`'s
   reason stands: no workflow collects a name apart from `authorName`, and a
   second name would drift from the one in the history); deriving names from
   git authorship in the book (a reader never commits).
2. **Unnamed people read by role, never by id** (workflow 10 delta).
   *Rationale:* an id is meaningless and leaks an internal key; the meta line
   (*through the reader invitation of 2 Oct*) still tells two unnamed people
   apart. *Rejected:* a shortened id ("1813…"), an email (the service holds a
   recovery email for some accounts, but workflow 10 sends invitations
   precisely so that no address is involved).
3. **The link is derived from the id by HMAC, not stored** (revises
   `books.share` Decision 6, workflow 10 delta). *Rationale:* the board draws
   Copy link, a class link is sent more than once, and the owner may be on
   another device than the one that made it; deriving keeps the database
   holding only hashes, so a database read alone still opens no book; a
   mismatching hash (old rows, rotated secret) degrades to "no Copy link"
   rather than a wrong link. *Rejected:* storing the raw token (a database
   leak opens every book); encrypting it in a column (a key and a ciphertext
   to manage for the same property); keeping the link only on the device that
   made it (the Worker would have to keep a secret per invitation, and the
   owner's other devices still could not copy it); "withdraw and make another"
   (breaks *who joined through it* into many cards for one class).
4. **Copy link only while the invitation can admit someone.** The board's #3
   draws it on the *used up* card too; a link that admits nobody is not worth
   copying, and workflow 10's new bullet says so. *Rejected:* drawing it on
   every card.
5. **Remove without a typed name, as #3 draws.** *Rationale:* removing is
   reversible by an invitation and touches no data (the same reasoning as
   workflow 10 §Leaving a book's "There is no typed name"); typing a name the
   owner may not have was the bug. *Rejected:* keeping the typed-name confirm
   of `books.share`.
6. **Surfaces by `mode`, mounted from `AppShell`** (workflow 10 delta **Where
   it sits**). The people and New invitation screens become `AppShell` state
   (like `openFile`), raised by `BookDetail` and by the sheet, so a screen
   replaces the shell as FileView does; the song panel is drawn inside
   `SongReading`'s split, not a Modal, because #4 draws it beside the chart
   with no scrim. `SharingScreen.jsx` is split into `ShareSheet.jsx`,
   `PeopleScreen.jsx`, `NewInvitation.jsx`, `SongSharePanel.jsx` over the
   shared `people.js` helpers and the existing client. *Rejected:* one
   component switching on mode inside a Modal (cannot be a full screen nor a
   non-modal panel); a new route/URL for the people screen (ephemeral view
   state, `books.share` Decision 4 and the shell's no-router stance).
   New invitation on wide is a centred dialog: the board does not draw it on
   wide, and `SongArrange` is the precedent for sheet-narrow / centred-wide.
7. **"Joined through" is computed in the app** from the owner's invitation
   list. *Rationale:* the owner already fetches it; no contract change.
   *Rejected:* a `Member.invitationId` field.
8. **Pronoun-free copy.** The board's "Removing him… his device" is rewritten
   with *them/their*: the app does not know anyone's pronouns.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-16.

- People are named by their saved name, never an account id: `app/src/books/people.js` (with `people.test.js`), shared pieces in `app/src/books/sharing-parts.jsx`, member/joiner names in `service/internal/server/sharing.go` and `books.go`.
- Open invitations can be copied again: the token is derived from the invitation id with `ESTANTE_INVITATION_SECRET` (`service/internal/server/email_links.go`, `service/internal/config/config.go`, `service/cmd/service/main.go`, `compose.yaml`); `api/openapi.yaml` description text updated.
- Layout as W10: `ShareSheet.jsx` → `PeopleScreen.jsx` / `NewInvitation.jsx` on phone, dialogs on tablet and computer, `SongSharePanel.jsx` side panel on wide; wired in `BookDetail.jsx`, `BooksScreen.jsx`, `shell/AppShell.jsx`, `songs/SongReading.jsx`, with `sharing.css`, `shell.css`, `reading.css` and the four locales. The old `SharingScreen.jsx` and its test are removed.
- New invitations show the room-left callout; Remove no longer asks for a typed name.
- Tests: Go `TestInvitationTokenDerived`, `TestLoadInvitationSecret`, `TestListMembersNames`, `TestListInvitationsJoinerNames`, `TestListInvitationsURL`; Vitest `{ShareSheet,PeopleScreen,NewInvitation,SongSharePanel}.behavior.test.jsx` and AppShell share-surface cases; e2e-api `e2e/api/sharing.test.js`; e2e-web `e2e/web/tests/share.spec.js` (plus `add-by-link`, `fork` specs and `e2e/web/lib/journeys-*.js` adjusted).
- `TestListInvitations` now asserts the listed `url`, and the listed `useLimit` is the owner's cap (keeps the contract's `minimum: 1`).

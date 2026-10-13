# share — Sharing a book: people, invitations, and the member's view

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task books.share "Sharing"`:

> People 37 of 50, invitations with role, expiry and uses, who joined,
> withdraw, remove, a full book; share from a song; the member's view.
> Workflow 10. Tests: behavior (people n of 50, invitations with role,
> expiry and uses, who joined, withdraw, remove, a full book, the member's
> view; axe); e2e-web (the two-device journey on the stack: the owner
> invites, a second person joins in another browser context, both edit and
> sync to a clean merge; withdraw and remove; axe).

`depends !online, service.sharing, !add_by_link`.

## Effort estimate

3d (from the `.tji`).

## Repository

**estante-de-cifras**, the app only (`app/`, plus e2e in `e2e/web/`). Not a
cifra.md task — the note does not start with `cifra.md:`. The app and the
service share no code (DIRECTION §3.6 L288–291): this task consumes the
already-built `Sharing` HTTP contract in [`api/openapi.yaml`](../../../api/openapi.yaml)
and adds no server or format code.

## Inherited dependencies

- **`books.online`** — *settled, Done.* Hands over: a hosted book on the
  shelf, living at `git.bookDir(serviceId)` = `/books/<serviceId>` with
  `shelf.books[<serviceId>] = {label, link, position, role}` and the on-disk
  id equal to the service id (`app/src/worker/online.js`, shelf model
  `app/src/worker/home-book.js` / `app/src/worker/shelf.js`); the per-book
  management screen **`BookDetail`** (`app/src/books/BookDetail.jsx`), where
  `role = book?.role?.value` and `isOwner = isLocal || role === 'owner'`
  (`BookDetail.jsx:220-221`) and the owner-only Delete card is gated on
  `isOwner && !isLocal` (`BookDetail.jsx:333`) — the seam an owner-only
  "Share" card sits beside. `visibility` is always `private`; put-online
  never shares — opening a book up is this task.
- **`service.sharing`** — *settled, Done (2026-10-07).* Hands over the seven
  `Sharing` endpoints over `memberships` / `invitations` / `invitation_joins`
  (server impl `service/internal/server/sharing.go`,
  [`tasks/refinements/service/sharing.md`](../service/sharing.md)), pinned
  black-box by `e2e/api/sharing.test.js`. The exact contract this task binds
  to is under *Inputs / the API contract* below. The 50-person cap, the
  who-sees-whom filtering, and the full-book refusal are all enforced
  server-side; the app never counts or enforces.
- **`books.add_by_link`** — *settled, Done.* Hands over the **joining** side
  this task's invitations feed: the `/i/<token>` boot route
  (`app/src/account/invitation-route.js` `invitationToken` :20, `fromLink`
  :39; captured once in `app/src/App.jsx:107-109,135-139` and threaded to
  `AppShell`), the generic account-first `InvitedScreen`
  (`app/src/account/InvitedScreen.jsx`), the `ADD_BY_LINK` Worker command and
  `cloneHosted` helper (`app/src/worker/add-by-link.js`) that calls
  `booksClient.accept(token)` → clone → shelf register `role` → reindex →
  emit `BOOK_CLONED`, and the typed-refusal / no-leak rule for a dead or full
  link. This task owns the **creation** side (making, listing and withdrawing
  invitations, the members list, role selection, share-from-a-song) that
  `add_by_link.md:289-295` explicitly scoped out.

**Graph note for the closer (not a new task; the orchestrator/closer own the
WBS shape).** The e2e two-device journey edits a song on both devices and
syncs to a clean merge. That edit/save/merge capability is already shipped
and `complete 100` — `songs.editor`, `songs.save_sheet`, `songs.edit_in_place`
(editor open while sync merges under it), and the merge itself via
`sync.engine` (a dependency of `books.online`). These are honest edges of the
e2e scenario, not missing prerequisites; no `depends` change is needed.

## What this task is

The owner's view and controls for sharing a hosted book, and the roster a
plain member sees. Concretely:

1. An owner-only **Sharing** surface, reached from `BookDetail` and from a
   song's share affordance, showing **people N of 50** with the room
   remaining, the **members** list (role-grouped, worded role chips), and the
   book's **invitations**.
2. **Making an invitation**: a role (reader or editor), an expiry (a day, a
   week by default, a month, or until withdrawn) and an optional limit on
   uses; the resulting link is shown once, with a copy affordance.
3. **Managing invitations**: each with its role, expiry, uses remaining and
   who joined through it; **withdraw** (nobody new joins, those who joined
   stay).
4. **Managing members**: change a member's role, **remove** a member (a
   typed-name confirm), and the owner's full-book state when the count reaches
   fifty.
5. **Sharing a song**: a share affordance on a song that, for the owner,
   makes an invitation that opens on that song once accepted, and, for a
   member, copies the song's plain address `…/b/<book>/<path>`; and the
   boot-time deep-link consumer that opens that address.
6. **The member's view**: the same surface for a non-owner member, role-
   filtered (owner and editors only, never the other readers), with the count
   but no owner controls.

## Why it needs to be done

Sharing is the whole point of putting a book online: `books.online` makes a
book hosted and private, and this task is the only way a second person is
ever admitted to it. It is the owner-side complement of `books.add_by_link`
(which can accept an invitation but cannot make one) and the last leaf of the
book-collaboration arc before `books.fork`. It is the app face of the
already-built `service.sharing` registry — without it the sharing endpoints
have no caller in the app, and a book can only ever be read by its owner.

## Inputs / context

### Normative / governing design

- **Workflow 10**, [`docs/workflows/10-share.md`](../../../docs/workflows/10-share.md)
  (Status: decided):
  - §Who can open a book (L9–25): private start, account + membership for
    every request, reader vs editor, a reader's push refused.
  - §At most fifty people per book (L27–38): the count is **members besides
    the owner, readers and editors together**; the owner sees it as *37 of 50*
    (L30); per book, not per invitation; the service enforces it, not the app
    (L34).
  - §Invitations (L40–60): by **link, not email** (L42–44); one invitation
    reusable by many; a role per invitation; expiry **a day, a week (the
    default), a month, or until withdrawn** (L49–51); an **optional limit on
    uses, down to one** (L50–51); the owner sees who joined through each and
    can **withdraw** it — "nobody new joins, and those who joined stay members"
    (L52–53); a forwarded link admits anyone up to the limit, the "who joined"
    list is how the owner notices, removing is the remedy (L54–56).
  - §Roles (L62–69): **Owner** (one; shares, invites, removes, deletes),
    **Editor** (saves), **Reader** (reads, keeps on shelf); **"Only the owner
    invites, in the first pass."** (L69).
  - §Who sees whom (L71–75): the owner sees every member with their role and
    every invitation with who joined; a member sees who the owner and the
    editors are (names are in history anyway) but **not the other readers**.
  - §Removing someone, or lowering their role (L77–85): takes effect at their
    next request; what is on their device stays and cannot be recalled; the
    removed person's shelf shows *no longer shared with you* (workflow 8); an
    editor lowered or removed with unpushed saves is told those saves can no
    longer go to the book and is offered a fork (workflow 11) or the download
    (workflow 7).
  - §A reader who wants to change something (L87–90): a reader's edits stay
    unsaved on their device (workflow 4); *save* offers to make the book their
    own (fork, workflow 11) — that offer belongs to `books.fork`, not here.
  - §Sharing a song (L92–101): *Share* on a song shares its book; the
    invitation it makes opens on that song once accepted; for an existing
    member the link is just the song's address `…/b/<book>/<path>` (L95–96);
    no sharing one song apart from its book; Explore Chords' in-link song
    payload is **not** carried over (L99–100).
  - §A copyright notice (L103–106): admin takedown is a terms process, a
    separate server task (`service.admin`), **not** an app feature — scoped
    out.
  - §Later (L108–118): approving each joiner, handing over ownership, editors
    who invite, forks inheriting limits, actively telling people a book
    changed — all **scoped out**; the first pass leans on the shelf sync state
    (workflow 8).
- **DIRECTION** [`docs/DIRECTION.md`](../../../docs/DIRECTION.md): §3.3 L175–198
  (no book without an account; at most fifty people besides the owner; the
  registry holds owners, members, roles and invitations; `noindex`); §3.6
  L288–291 (the app and the service share no code, only the HTTP API and the
  format) and L369–372 (the `Sharing` API group); §3.7 L405–446 (React + React
  Aria Components; the Worker owns git, the working copy and the index, the
  main thread never touches IndexedDB; the view reads slices via
  `useSyncExternalStore`); §4 L447–454 (managing books is a screen of its own —
  §4 says nothing of a sharing screen, which lives in §3.3 and workflow 10).

### The API contract

All under [`api/openapi.yaml`](../../../api/openapi.yaml); tag `Sharing`
(L44–45). Auth is the same-origin session cookie `sessionCookie`
(`estante_session`, L700–707) — `credentials: 'include'` carries it, no
Authorization header. A `404` (`NotFound`, L782–790) deliberately conflates
"no such book" and "not a member" so a private book is never confirmed to a
stranger; a `403` (`Forbidden`, L774–781) is a signed-in member doing an
owner-only action; `401` is no session. Every schema is
`additionalProperties: false`.

- **Create an invitation** — `POST /api/books/{bookId}/invitations`
  (`createInvitation`, L501–527), owner only. Body `CreateInvitationRequest`
  (L1173–1185): `role` **(required)**, `InvitableRole` enum `[editor, reader]`
  (L840–843); `expiry` optional, `ExpiryChoice` enum
  `[day, week, month, until-withdrawn]` (L1155–1158), default a week;
  `useLimit` optional integer `minimum: 1`, unlimited when absent. `201` →
  `Invitation` **with its `url`** — the only time the raw token is ever
  returned (stored server-side as a SHA-256 hash; unrecoverable afterward).
  Creating on a full book is allowed; it just admits nobody until room is made.
- **List invitations** — `GET /api/books/{bookId}/invitations`
  (`listInvitations`, L481–500), owner only. `200` → `InvitationList`
  (L1225–1233). Each `Invitation` here **omits `url`**.
- **Withdraw an invitation** — `DELETE /api/books/{bookId}/invitations/{invitationId}`
  (`withdrawInvitation`, L529–546), owner only. `204`.
- **List members** — `GET /api/books/{bookId}/members` (`listMembers`,
  L410–431), any member (no `403`; a stranger gets `404`). `200` → `MemberList`
  (L1137–1153): `members` (array of `Member`), `count` (integer, members
  besides the owner), `limit` (integer, **`const: 50`**). Role-filtered
  server-side: an **owner** sees everyone (themselves as `owner`, all editors
  and readers); a **non-owner member** sees only the owner and the editors —
  reader identities are omitted. `count`/`limit` are the true numbers for
  every caller.
- **Change a member's role** — `PATCH /api/books/{bookId}/members/{userId}`
  (`changeMemberRole`, L433–462), owner only. Body `ChangeMemberRoleRequest`
  (L1235–1242): `role` **(required)** `InvitableRole`. `200` → `Member`. Lazy
  (effective at the member's next request).
- **Remove a member** — `DELETE /api/books/{bookId}/members/{userId}`
  (`removeMember`, L463–480), owner only. `204`. Lazy.
- **Accept an invitation** — `POST /api/invitations/{token}/accept`
  (`acceptInvitation`, L548–573). The **joiner's** endpoint, already consumed
  by `books.add_by_link` via `booksClient.accept`; this task does not call it,
  only feeds it the links it mints.

Schemas: `Member` (L1124–1135): required `userId` (`Id`), `role` (`Role` enum
`[owner, editor, reader]`, L835–838), optional `displayName` **currently left
unset by the service**. `Invitation` (L1187–1223): required `id`, `role`,
`expiry`, `createdAt`, `joined` (array of `Joiner`, L1160–1171), `joinedCount`,
`withdrawn`; optional `url` (uri, create only), `expiresAt`
(`[string, null]` date-time; `null` for `until-withdrawn`), `useLimit`
(`[integer, null]`; `null` = unlimited; reflects the remaining uses tracked
server-side). `Error` (L819–833): `{code, message}` only — never song text, a
commit message, an email or a token. The invitation link is
`<PublicBaseURL>/i/<raw-token>`.

### The mockups

[`docs/mockups/W10-share.dc.html`](../../../docs/mockups/W10-share.dc.html)
("10. Share"; `canvas.json` at y=17000) — the only sharing board. Board sub
(L20): *"A book on Estante starts private, and nobody opens it without an
account. Its owner invites people by link, as readers or editors, up to fifty
per book; the owner sees who joined through each invitation, and can remove
anyone alone."* Scenes:

- **Phone** (L26): Ana's share surface as a bottom **sheet** titled "Share
  Choros da Ana" — a People section ("**37 of 50**", a `.bar` at 74%, "Room
  for 13 more."), a **Members** row ("You, 1 editor, 36 readers"), an
  **Invitations** list, a primary **"Invite people"** button; the appbar
  carries a Share icon (`aria-label="Share"`, L34).
- **Tablet** (L110): the owner's people screen at 37 of 50 — members, with
  Remove actions and Owner / Editor / Reader roles.
- **Computer** (L163): **share-on-a-song** — an invitation that opens on that
  song, plus its plain address for members.
- **Computer, later** (L228): the book **full** as the owner sees it, and the
  book's sharing as a plain **member** sees it (role-filtered).

Status is a word, never colour alone
([`docs/mockups/README.md:26`](../../../docs/mockups/README.md)); role and
state chips carry their word, matching `BookDetail`'s existing `chip`/`badge`
anatomy from [`docs/mockups/theme.css`](../../../docs/mockups/theme.css)
(`.row`/`.list`/`.name`/`.meta`/`.badge`/`.chip`/`.sheet`/`.dialog`/`.btn`
`.primary`/`.quiet`/`.danger`).

### The code seams this extends

- **API client.** `books.online` put the `/api/books` client in the Worker
  (`app/src/worker/books-client.js`, `createBooksClient` :46–104, methods
  `create`/`list`/`remove`/`accept` :143) because each of those calls is
  followed by a git/index mutation. The main thread already owns a
  service client that is **not** about data ownership — the passkey/auth
  client `app/src/account/auth-client.js` (`createAuthClient`, a `postJson`
  helper, same same-origin `credentials: 'include'` pattern). See Decision 1.
- **Where the surface hangs.** `BookDetail.jsx` (owner-only card beside the
  Delete card, gate `isOwner && !isLocal` :333; opened from `BooksScreen`
  `openBookDetail` :558, rendered :566); and the song view's toolbar share
  seam — `AppShell.jsx:543-545` comments that the song reading toolbar's share
  is "books.share's", rendered but wired by this task. Song reading render
  `AppShell.jsx:549-562`.
- **Navigation is view-state, not a router.** `AppShell.jsx`: `selected`
  destination tab :185, `openSong` = `{bookId, path}` or null :236–240,
  `openFile` :224. On `BOOK_CLONED` the shell does `setInvited(null);
  setSelected('books')` and comments at :361–365 that "the reader's deep-link
  into a specific song is books.share's, scoped out here." Boot path routes are
  parsed once in `App.jsx` (`/sign-in/<token>` :98–100, `/i/<token>` :107–109)
  then the URL is cleaned with `history.replaceState` :135–139. There is **no**
  `/b/...` route today.
- **Open a song by (bookId, path).** The seam exists: `setOpenSong({bookId,
  path})` → `SongReading` (`app/src/songs/SongReading.jsx`, props `bookId`/
  `path` :113–114), which self-resolves via `OPEN_SOURCE`/`OPEN_SONG`
  (:129–133) — no index lookup, no search selection (the `#dev/reading?book=&
  path=` mount proves it). A `/b/<bookId>/<path>` boot consumer mirrors the
  `/i/<token>` pattern and seeds `openSong`.
- **React Aria + portal.** Every interactive part is a React Aria Component
  with a keyboard path and accessible name; destructive confirms use
  `DialogTrigger` → `ModalOverlay className="scrim center"` → `Modal` → `Dialog`
  (`BookDetail.jsx`; `DeleteDialog` :151 gates its button on an exact
  typed-name match — the pattern for "remove member"). Overlays portal into the
  `.est` theme root via the app-wide `UNSAFE_PortalProvider` in
  `app/src/theme/ThemeRoot.jsx:67` — do not re-plumb a container
  (`[[rac-overlays-portal-outside-est-theme-root]]`, resolved by
  `shell.portal_provider`).
- **Copy.** All strings via `t('...')` from `app/src/i18n/index.js`
  (`books.*`). Axe via `app/src/a11y/axe.js` `checkWcag21aa` :21.

### Test harness

Behavior (React): `createLoopbackEndpoint(createLogic)`
(`app/src/test/loopback.js`) → `createStore`, Testing Library, real RAC +
i18n, rendered inside `<ThemeRoot store={store}>`, axe via `checkWcag21aa`; a
sharing surface that calls the service injects a `fetch` double. e2e-web:
`e2e/web/tests/<name>.spec.js` against the compose stack, three viewport
projects (phone/tablet/computer) auto-run, axe (`e2e/web/lib/axe.js`
`checkA11y`) on every screen; sign-in via the CDP virtual authenticator
(`e2e/web/tests/account-sign-in.spec.js`), a second device via
`e2e/web/lib/devices.js` `openDevice`, Postgres/account seeding via
`e2e/web/lib/db.js` (`seedAccount`, `fillBookToCapacity`). The server
endpoints are already pinned black-box by `e2e/api/sharing.test.js`.

## Constraints / requirements

- **No book without an account** *(Central).* Every call carries the session
  cookie; the owner-only endpoints answer `403`/`404` to anyone else, the
  sharing surface is owner-gated in the UI, and `noindex` already covers every
  served page. The app never reveals a private book to a non-member — the
  generic `404` is honoured.
- **The service owns the count and the cap** *(Central).* The app shows
  `count`/`limit` from `listMembers` ("N of 50", room remaining) and never
  enforces fifty itself; the 51st join is refused server-side at accept
  (DIRECTION §3.3 L175–182; workflow 10 L34). The owner's full-book state is
  "make room by removing someone"; there is no active "someone tried" notice
  (workflow §Later).
- **Owner-only, in the first pass** *(Central).* Only the owner invites,
  withdraws, changes roles and removes (workflow 10 L69). Editors and readers
  get the read-only member's view. Editors-who-invite and handing over
  ownership are §Later — scoped out.
- **No song text, no secrets in logs or errors** *(Applies).* The sharing
  client logs nothing — no ids, titles, tokens, session or book content — and
  surfaces refusals as typed, status-bearing errors carrying only
  `code`/status for the view to word (mirroring `books-client.js`). The
  invitation link is shown in the UI but never logged.
- **Accessibility** *(Applies).* React Aria Components throughout, full
  keyboard paths, axe at WCAG 2.1 AA on every screen and overlay; role and
  state carried by a word, never colour alone; the destructive remove is a
  typed-name confirm.
- **Component boundary** *(Applies).* The app and the service share no code
  (DIRECTION §3.6); this task touches only `app/` and `e2e/web/`, calling the
  `api/` contract. The view is the only layer that knows React.
- **Offline-first — scoped** *(Scoped out, with reason).* Sharing management
  is inherently online: inviting, withdrawing, changing a role and removing all
  act on the server registry, which has no local projection — like sign-in
  (`auth-client.js`), these calls need the network, and the UI words a "needs
  connection" state rather than queueing. The book's content and the user's
  edits stay offline-first through the Worker, untouched by this task; a
  member's `role` register on the shelf is written only by the Worker on
  clone/put-online, not here.
- **Canonical form; fork/takedown out of scope** *(Scoped out).* This task
  writes no song or setlist, so canonical-form rules do not bear on it. The
  fork offer a removed/lowered editor is given (workflow 10 L85) is
  `books.fork`; admin takedown is `service.admin`. This task shows the member's
  resulting shelf state (*no longer shared with you*, surfaced by the existing
  shelf sync, workflow 8) but does not build fork or takedown.

## Acceptance criteria

### Behavior delivered

1. An owner opening the **Sharing** surface on a hosted book sees **N of 50**
   with the room remaining, a role-grouped members list (You/owner, editors,
   readers) with worded role chips, and the book's invitations.
2. The owner **makes an invitation**: chooses reader or editor, an expiry
   (default a week), optionally a limit on uses (down to one); the link is
   shown once with a copy affordance and a note that it will not be shown
   again.
3. Each invitation shows its role, expiry, uses remaining and who joined
   through it; the owner **withdraws** one and no one new can join, while those
   who joined remain.
4. The owner **changes a member's role** and **removes** a member (a
   typed-name confirm); the removed member's shelf shows *no longer shared with
   you* at their next sync.
5. At fifty members the owner sees a **full** state inviting them to make room
   by removing someone; no app-side block is imposed on creating an invitation.
6. **Sharing a song**: for the owner, a song's share makes an invitation that
   opens on that song once accepted (the `/i/<token>` link carries the song
   path as a client-only fragment); for a member, it copies the song's address
   `/b/<bookId>/<path>`; opening such an address deep-links to the song.
7. **The member's view**: a non-owner member sees the owner and editors and
   the count, never the other readers, and gets no invite/withdraw/role/remove
   controls.

### Tests, by level

The `.tji` names **behavior** and **e2e-web**. Both are delivered below.
**unit** is added for the two genuinely-pure new modules (a proportionate
sharpening — no named level is dropped). **e2e-api is not named and does not
apply**: the `Sharing` endpoints are already pinned black-box by
`service.sharing`'s `e2e/api/sharing.test.js`; this task adds no server code.
Fixtures are purpose-written songs and books, never anyone's copyrighted words.

- **unit — `app/src/books/sharing-client.test.js`**: the six calls build the
  correct method, path and body (`createInvitation` role/expiry/useLimit;
  `changeMemberRole` role; the member/invitation `GET`s; the two `DELETE`s),
  parse `MemberList`/`InvitationList`/`Invitation`, and surface `401`/`403`/
  `404`/`409` as typed status-bearing errors carrying only `code`/status; the
  client logs nothing. *Pins `api/openapi.yaml` L410–546, L1124–1233; DIRECTION
  §3.6; the no-logs rule.*
- **unit — `app/src/books/book-route.test.js`**: `/b/<bookId>/<path>` parses to
  `{bookId, path}` (including a path with slashes) and non-matches return null;
  the `/i/<token>#<path>` fragment yields the song anchor; a bare `/i/<token>`
  yields none. *Pins workflow 10 L95–96 (the `…/b/<book>/<path>` address) and
  L92–94 (the song-opening invitation).*
- **behavior — `app/src/books/SharingScreen.behavior.test.jsx`** (fetch double
  for the `Sharing` endpoints; rendered in `<ThemeRoot>`; axe on every state):
  - the owner view — **N of 50** and room remaining, members grouped with
    worded role chips, invitations listed with role, expiry, uses remaining and
    who joined. *Pins workflow 10 L27–38, L40–60, L62–75; W10 board L26/L110.*
  - make an invitation — reader/editor, expiry default a week, optional use
    limit; the link shown once with a copy affordance. *Pins workflow 10
    L40–60; `createInvitation` 201 `url`.*
  - withdraw an invitation; change a role; remove a member via the typed-name
    confirm. *Pins workflow 10 L52–53, L77–85; `withdraw`/`changeMemberRole`/
    `removeMember`.*
  - the **full book** owner state at count 50. *Pins workflow 10 L32–34; W10
    board L228.*
  - the **member's view** — a non-owner member (role-filtered `MemberList`:
    owner + editors only) sees the count and no owner controls, and no reader
    identities. *Pins workflow 10 L71–75; `listMembers` filtering; W10 board
    L228.*
  - share-from-a-song — with a song anchor, the invitation link carries
    `#<path>` and the member link is `/b/<bookId>/<path>`. *Pins workflow 10
    L92–101.*
  - axe (WCAG 2.1 AA) clean on each of the above rendered states.
- **e2e-web — `e2e/web/tests/share.spec.js`** (compose stack, phone/tablet/
  computer projects auto-run, `checkA11y` on every screen/overlay): the
  two-device journey —
  1. the owner (seeded account) has a hosted book, opens Sharing, creates an
     **editor** invitation, copies its link;
  2. a second browser context (`openDevice`) opens `/i/<token>`, signs in via
     the virtual authenticator, joins as editor (the `add_by_link` screen),
     and the book lands on their shelf;
  3. both edit a song and sync to a **clean merge**;
  4. the owner's Sharing now reads **1 of 50** and shows who joined through the
     invitation;
  5. the owner **withdraws** the invitation (the joined member stays);
  6. the owner **removes** the member; the removed member's next sync is
     refused and their shelf shows *no longer shared with you*;
  7. share-from-a-song — the owner shares a song, and on the computer the
     member link `/b/<bookId>/<path>` opens that song in the reading view.
  - *Pins workflow 10 L9–101; the two-device collaboration of `sync.engine`;
    the deep-link decision below.* Axe on every sharing screen and overlay,
    three viewports.

## Decisions

1. **The sharing-management client runs on the main thread, not through the
   Worker.** New module `app/src/books/sharing-client.js`
   (`createSharingClient({fetch})`), mirroring `app/src/account/auth-client.js`:
   same-origin `credentials: 'include'`, a `postJson`-style helper, typed
   status-bearing errors, logs nothing. *Chosen* because list-members,
   list/create/withdraw-invitation and change-role/remove-member touch **no**
   Worker-owned data (git, the working copy, the search index) and have no
   local projection — they are request/response server-registry state, like
   sign-in. *Rejected:* extending the Worker's `books-client.js`. That client
   lives in the Worker precisely because `create`/`accept`/`remove` each have a
   git/index follow-on (push, clone, reindex); sharing-management has none, so
   routing six read/write pairs through the Worker protocol adds latency and
   surface for no ownership benefit. The split is principled: Worker-side for
   calls with a git/index mutation, main-thread for pure registry calls.
2. **Deep links are consumed at boot; the song anchor rides a client-only URL
   fragment.** A new boot route `/b/<bookId>/<path>` is parsed once in
   `App.jsx` (mirroring `/i/<token>` and `/sign-in/<token>`: parse, clean the
   URL with `history.replaceState`, hand the result to `AppShell` as a boot
   prop that seeds `openSong`). A song's share makes the ordinary
   `POST /invitations` invitation and appends the song path to the returned
   `/i/<token>` link as a fragment `#<path>`; on `BOOK_CLONED` the app reads the
   fragment and opens that path in the freshly cloned book. *Chosen* because the
   open-song-by-`{bookId, path}` seam already exists (`setOpenSong` →
   `SongReading`), the fragment is never sent to the server (no contract
   change — `CreateInvitationRequest` is `additionalProperties: false`), and
   `…/b/<book>/<path>` is exactly the address workflow 10 L95–96 specifies.
   This **resolves the parked question** "Shell URL / deep-link routing"
   (`tasks/parking-lot.md` 2026-10-05), which deferred the routing call to this
   task. *Rejected:* full bidirectional destination↔URL sync (browser-back and
   bookmarkable tabs) — the parking-lot note itself warns this would prematurely
   bake deep navigation for every destination; read-on-boot consumption of the
   two designed link shapes is all workflow 10 needs, and destinations stay
   in-memory view-state. *Also rejected:* carrying the song server-side in the
   invitation — needless contract change, and Explore Chords' in-link song
   payload is explicitly not brought over (workflow 10 L99–100).
3. **Members and joiners are identified by their opaque `userId`, with worded
   role chips and the board's role-grouped counts** ("You, 1 editor, 36
   readers"); no friendly display name in the first pass, because the service
   returns `displayName` unset by design. *Chosen* as the honest reflection of
   the contract; the roster still carries role by word, and remove/role-change
   operate per `userId`. *Rejected:* deriving names from git commit authorship —
   it would couple the roster to history parsing and surface authored-commit
   identity into a list the workflow does not ask to carry names in (workflow
   10 L73–74 notes names live in history, not that the roster shows them). The
   product question of whether to show a chosen member name is surfaced to the
   parking lot, not encoded as a WBS task.
4. **The Sharing surface hangs off `BookDetail` and the song toolbar, full-
   screen over the shell on narrow and master-detail on wide**, reusing the
   existing overlay-mounting, the app-wide `.est` portal provider, RAC
   `Modal`/`Dialog`, and the typed-name confirm (`DeleteDialog` pattern) for
   remove. *Chosen* to match the sibling `BookDetail` surfaces exactly (no new
   shell seam). *Rejected:* a new top-level destination tab for sharing — it is
   a per-book action, not a peer of search/books/setlists.
5. **The app shows the count, never enforces the cap; the full-book state is
   "make room by removing someone".** *Chosen* per workflow 10 L34 and
   DIRECTION §3.3: `listMembers` gives `count`/`limit`, and the server refuses
   the 51st at accept, race-safe. *Rejected:* an app-side guard that blocks
   creating an invitation on a full book — the service deliberately allows it
   (it admits nobody until room is made), and a client-side count would race.
6. **The invitation link is shown exactly once, at creation.** The UI presents
   the `url` from the `201` with a copy affordance and makes clear it will not
   be shown again; to re-share, the owner withdraws and makes a new one.
   *Chosen* because the service returns `url` only on create and stores only a
   hash. *Rejected:* a "show link again" affordance — the raw token is
   unrecoverable by design.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- `app/src/books/sharing-client.js` — new main-thread `Sharing` REST client
  (`createSharingClient`) mirroring `auth-client.js`: six calls (list/create
  invitation, list/change-role/remove member, withdraw invitation), typed
  status-bearing errors (`401`/`403`/`404`/`409`), logs nothing.
- `app/src/books/book-route.js` — parse `/b/<bookId>/<path>` → `{bookId,
  path}` and the `/i/<token>#<path>` fragment → song anchor; build both
  shapes.
- `app/src/books/SharingScreen.jsx` + `sharing.css` — full owner surface:
  N of 50, role-grouped members, invitations with role/expiry/uses/who-joined,
  make/withdraw/change-role/typed-name-remove, full-book state, member's
  read-only view, share-from-a-song (`#<path>` invitation + `/b/` member
  address).
- `app/src/books/BookDetail.jsx` — owner-only Share card beside Delete.
- `app/src/shell/AppShell.jsx` — `onShare` wired to the reading-view toolbar,
  `/b/<bookId>/<path>` boot-seed for `openSong`, `#<path>` consumed on
  `BOOK_CLONED`.
- `app/src/App.jsx` — `/b/` boot route parsed at startup, URL cleaned with
  `history.replaceState`.
- `app/src/i18n/locales/{en,es-419,it,pt-BR}.js` — full `books.share*` /
  `sharing.*` string tables (four locales).
- Tests: unit (`sharing-client.test.js` 15 tests; `book-route.test.js` 12
  tests); behavior (`SharingScreen.behavior.test.jsx` 11 tests, axe on every
  state); e2e-web (`share.spec.js` — two-device journey on phone/tablet/
  computer, all green).
- Resolves the parked question "Shell URL / deep-link routing"
  (`tasks/parking-lot.md` 2026-10-05): `/b/<bookId>/<path>` is the boot
  consumer for the member deep-link shape from workflow 10 L95–96.

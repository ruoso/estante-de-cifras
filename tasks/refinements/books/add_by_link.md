# books.add_by_link — Add by invitation and mine on Estante

## TaskJuggler entry

Defined in [`tasks/65-books.tji`](../../65-books.tji), task `books.add_by_link`:

> **Add by invitation and mine on Estante** — "An invitation always asks for
> an account first, then clones as reader or editor; a dead or full link
> telling nothing about whose book; the user's books not yet on this shelf.
> Workflows 1, 7. Tests: behavior (the account-first prompt, a dead or full
> link that says nothing of whose book; axe); e2e-web (a second account opens
> an invitation from the stack, signs in, clones as reader and as editor; a
> withdrawn and a full link; axe)."

`depends !online, service.sharing`.

## Effort estimate

**2 days** (unchanged from the `.tji`). The service already enforces the hard
parts (accept, the four refusals, the fifty-person cap); this task is the app
side — a boot route, one reused sign-in surface, one new Worker command that
accepts-then-clones, and the "mine on Estante" list.

## Repository

**estante-de-cifras**, app only. Directories:

- `app/src/` — a `/i/<token>` boot route, the invited screen, the account-first
  gate (reusing the existing `SignIn` surface), a new Worker command that
  accepts an invitation and clones the book, the books-client's accept call,
  and the "mine on Estante" list under the Add-a-book sheet.
- `e2e/web/` — the Playwright journey against the compose stack.

**Not a cifra.md task** — no spec, reference, corpus, `js/` or `go/` change.
The service-side invitation endpoints, token validation and the fifty-person
cap already landed in `service.sharing`; this task consumes them over the HTTP
contract and shares no code with the service (DIRECTION §3.6, L288–291).

**Design delta (same commit):** `docs/workflows/01-first-run.md` §Invited is
amended so the pre-account invited screen names neither the book nor its owner
— the service reveals nothing about a book, alive or dead, without a session,
so the book's name and role appear only after sign-in and accept. This
corrects the W01 board, which draws the title and role before sign-in (not
achievable under the account-first rule with no peek endpoint — see
Decision 1).

## Inherited dependencies

- **`books.online`** — *settled, Done 2026-10-08.* Gives the seams this task
  mirrors and extends: `putOnline` in `app/src/worker/online.js` (the
  accept-then-write-shelf-then-index shape), the `PUT_ONLINE` handler in
  `app/src/worker/logic.js:1248–1330` (shelf-register write via `home.set(...
  shelf.json ...)`, `surfaceHomeBookShelf()`, `indexOneBook(serviceId)`), the
  `/api/books` client `app/src/worker/books-client.js` (`list`, typed
  errors, `credentials:'include'`, logs nothing), `EventKind.BOOK_REFUSED`,
  and the on-disk invariant that a hosted book lives at `bookDir(serviceId)`
  and registers under `shelf.books[serviceId]` with a `role` register
  (`role: owner` for put-online; this task writes `reader`/`editor`). Its
  `online_reindex` obligation (`indexOneBook` after a book's dir changes)
  applies here: a freshly cloned book must be indexed before its event emits.
- **`service.sharing`** — *settled, Done 2026-10-07.* Built the one endpoint
  this task calls to join a book — `POST /api/invitations/{token}/accept`
  (`acceptInvitation`) — returning `200 Book {id, title, role, visibility,
  gitUrl}`, the four `409` refusals (`invitation_withdrawn`,
  `invitation_expired`, `invitation_exhausted`, `book_full`), `404` for an
  unknown token, `401` for no session, and the race-safe fifty-person cap
  enforced inside the accept transaction. The link shape is
  `<PublicBaseURL>/i/<raw-token>`.

Settled seams this leans on, already complete (not in the `.tji` `depends`
because each is `complete 100`; see the graph note for the closer):

- **`account.sign_in`** — *Done 2026-10-07.* The full-screen `SignIn` surface
  (`app/src/account/SignIn.jsx`) with an `intent` prop (`'create'` |
  `'signIn'`), passkey register/authenticate and the emailed-link fallback,
  mounted by `AppShell` with an early return and an `onSignedIn(account)`
  seam. `SignIn.jsx:96` already says *"books.add_by_link's invited door will
  open 'create'"*. The `estante_session` cookie it mints is visible to the
  Worker's `fetch` (same origin), so the Worker's accept and clone carry it
  with no extra plumbing.
- **`storage.home_book` / `storage.shelf_surface`** — *Done 2026-10-05/06*
  (via `books.online`). `shelf.json`, `home.set`, `surfaceShelf`, the
  `EventKind.SHELF` slice and the role word on the shelf row.
- **`foundation.e2e_web`** — the `e2e/web/` Playwright harness, Mailpit reader
  (`lib/mail.js`), Postgres seeding (`lib/db.js`), second-context device
  (`lib/devices.js`), and the CDP virtual-authenticator sign-in pattern
  (`e2e/web/tests/account-sign-in.spec.js`).

**Graph note for the closer (not a new task).** `books.add_by_link` also
honestly depends on **`account.sign_in`** (it reuses the `SignIn` surface and
needs a session before the clone). Both are already `complete 100`, so the
schedule is unaffected; consider adding `account.sign_in` to this task's
`depends` for an honest edge. Do not add it on my account — the closer/
orchestrator own the WBS shape.

## What this task is

The app side of joining a shared book:

1. **The invitation link.** Opening `<origin>/i/<token>` boots the app on an
   invited flow. The app tries to accept; a `401` means no account yet, so it
   shows the invited screen — generic, naming only that it is an invitation to
   a book on Estante — with the account-first prompt (*Make an account* / *I
   have an account: sign in*). After sign-in it retries the accept.
2. **Accept and clone.** On a `200 Book` the Worker clones the book over
   git-over-HTTP into `bookDir(serviceId)`, writes a `shelf.books[serviceId]`
   entry with the granted `role` (`reader` or `editor`), indexes it, and the
   app opens it on its song list. The role is the invitation's; the joiner
   does not choose it.
3. **A dead or full link.** A withdrawn, expired or exhausted invitation, or a
   book's plain address opened by a non-member (`409 invitation_*` / `404`),
   shows *"This link doesn't open a book"*. A full book (`409 book_full`)
   shows *"This book is full"*. Neither reveals the book's title or owner.
4. **Mine on Estante.** Under the Add-a-book sheet, once signed in, the
   account's books that are not yet on this device's shelf are listed and can
   be added (cloned onto the shelf), computed as the diff of `GET /api/books`
   minus the local shelf.

## Why it needs to be done

It closes the collaborator's door into a book. `service.sharing` built the
endpoints but nothing consumes them from a device; `books.online` can put a
book online and `books.share` (which `depends !add_by_link`) will build the
owner's invitation UI, but a person invited to a book has no way in until this
lands. It is the second device's and the collaborator's only path onto a
shelf, so `books.share`'s two-device journey and `sync.conflicts` /
`sync.lost_access` (which `depends books.add_by_link`) all build on it. It is
also the only task that builds "mine on Estante", which `account.new_device`
and `books.share` reference but neither owns.

## Inputs / context

### Governing / normative design

- **Workflow 1 §Invited** — `docs/workflows/01-first-run.md:42–58`. "An
  invitation … always asks the person to sign in, or to make an account first
  … since no book can be read without one. Then the book is cloned, as the
  reader or editor the invitation makes them" (L44–48); the dead/full-link
  rule "It does not say whose book it is: a dead link should tell its holder
  nothing about the book" (L53–58). Amended by this task's design delta (the
  pre-account screen is generic).
- **Workflow 7 §The book-management screen** — `docs/workflows/07-add-a-book.md:13–33`,
  the four Add-a-book ways, including "By link: Paste a link to a book on
  Estante" (L27–28) and "Mine on Estante: once signed in, the user's books
  that are not on this shelf yet" (L28–29); "Cloning shows its progress and
  can be cancelled" (L33).
- **Workflow 10 §At most fifty / §Invitations / §Roles** —
  `docs/workflows/10-share.md:28–39, 41–61, 63–69`. "When the book is full, an
  invitation stops admitting anyone … The service enforces the count, not the
  app" (L32–34). Role is set by the owner on the invitation; the joiner
  arrives as reader or editor (L63–67). Cross-reference only — the owner's
  invitation UI is `books.share`.
- **DIRECTION §3.1 Sync** (L127–134), **§3.2 Personal state** (L136–151),
  **§3.6 Components / The API / Git over HTTP** (L279–373), **§3.7 The app**
  (L405–445), **§4 The interface** (L447–466). The Worker owns git, the
  working copy and the index and does every clone; the main thread never
  touches IndexedDB and mirrors the Worker through messages (§3.7 L418–425).
  The app and service share no code, only the HTTP API (§3.6 L288–291). A
  clone is a network git fetch through the one service (§3.1 L133–134) — the
  shell is offline-first but cloning a shared book needs the network.

### The contract

- `api/openapi.yaml`:
  - `POST /api/invitations/{token}/accept` — `acceptInvitation`,
    `openapi.yaml:548–573`. `200 Book`; `401`; `404`; `409` with `code ∈
    {invitation_withdrawn, invitation_expired, invitation_exhausted,
    book_full}` (L553–558). Requires a session, no prior membership.
  - `Book` schema — `openapi.yaml:1013–1036`: required `id, title, role,
    visibility, gitUrl`; `role` is `Role` (`owner|editor|reader`, L838);
    `gitUrl` is the clone URL (`<PublicBaseURL>/git/<id>`, L1028–1031).
  - `GET /api/books` — `listBooks`, `openapi.yaml:289–301` → `BookList`
    (the "mine on Estante" source; each `Book` carries `role` and `gitUrl`).
  - `Error` / Conflict response — `openapi.yaml:791–833`: `{code, message}`
    only, "Never carries song text, a commit message, an email address or a
    token"; `NotFound` conflates unknown and not-a-member so a private book is
    never confirmed to a non-member (L782–790). **No `GET /api/invitations/
    {token}` peek endpoint exists** — accept is the only way to learn a book's
    title and role, and it is side-effecting (records a join, decrements a
    use).

### The mockups

- `docs/mockups/W01-first-run.dc.html` — the invited screen (L62–87; note:
  its pre-sign-in title+role are superseded by this task's design delta, which
  makes the pre-account screen generic), the dead-link dialog "This link
  doesn't open a book" (L175–180), the full-book dialog "This book is full"
  (L186–191). Copy for the account-first buttons and the full/dead bodies is
  taken verbatim from this board.
- `docs/mockups/W07-add-a-book.dc.html` — the Add-a-book sheet (L78–95): "By
  link" (L85), "Mine on Estante — Your books that are not on this shelf yet.
  Sign in to see them." (L90–93).
- `docs/mockups/README.md` §Decisions the drawings carry (L23–26): every
  status badge carries a word, never colour alone — the dead/full states and
  the cloning/role words obey this.

### The code seams this extends

- **Boot route.** `app/src/App.jsx:93–125` captures `/sign-in/<token>` at
  mount (`bootRedeemToken`, parsed by `app/src/account/sign-in-route.js:14–22`,
  cleaned with `history.replaceState`) and threads it to `AppShell` as
  `redeemToken`. Add a sibling `invitationToken(pathname)` parser for
  `^/i/([^/?#]+)/?$`, captured the same way and threaded to `AppShell`.
- **The account-first gate.** `app/src/shell/AppShell.jsx:347–353, 189–190`
  mounts `SignIn` full-screen with an early return; state
  `signIn={intent, token}`; `SignIn.jsx:93–100` the `intent`/`redeemToken`
  props; `onSignedIn(account)` at `AppShell.jsx:352`. The first-run "Add by
  link" placeholder is `app/src/songs/FirstRun.jsx:143–147` (`onAddBook`),
  wired to navigate to Books at `AppShell.jsx:155` today.
- **The clone.** `app/src/worker/git.js` — `createGitLayer({fs,http})`
  exposes `clone({dir, url, onProgress})` (`git.js:88–90`) and `bookDir(id)` →
  `/books/<id>` (`git.js:67–69`); `app/src/worker/git-http.js`
  (`createGitHttpClient`, `credentials:'include'`, `git-http.js:93–94`).
- **The books-client.** `app/src/worker/books-client.js:46–104` —
  `createBooksClient` with `list` (GET `/api/books`), typed status-bearing
  errors, `credentials:'include'`, logs nothing. Extend with
  `accept(token)` → `POST /api/invitations/{token}/accept`, returning the
  `Book` or throwing a typed error carrying the `409` `code` / `404` / `401`.
- **Dispatch.** `app/src/worker/protocol.js` — `command`/`event` builders and
  the open `CommandKind`/`EventKind` enums (`:23–27, 227–234`); add
  `CommandKind.ADD_BY_LINK` and `CommandKind.ADD_MINE` (+ `LIST_MINE` for the
  list), and `EventKind.BOOK_CLONED` / reuse `EventKind.BOOK_REFUSED` /
  `EventKind.NEED_ACCOUNT`. `app/src/worker/logic.js` — the `handle()` switch;
  model the handler on `PUT_ONLINE` (`logic.js:1248–1330`):
  `books.accept(token)` → `git.clone({dir: bookDir(id), url: gitUrl})` →
  `home.set(... shelf.books[id] = {label, link: gitUrl, position, role} ...)`
  → `surfaceHomeBookShelf()` → `indexOneBook(id)` → emit `BOOK_CLONED`.
- **The shelf.** `app/src/worker/shelf.js` (`surfaceShelf`),
  `app/src/books/book-display.js` (`titleFor`, `whereFor`, `canSaveFor`,
  `orderedBooks`), `app/src/sync-display.js` (`syncDisplayFor`),
  `app/src/books/BooksScreen.jsx` (`AddBookSheet` at `:253–322`, whose comment
  at `:248–252` reserves "By link / Mine on Estante" for this task). A hosted
  book with `role: reader` renders "reader" / read-only; `role: editor`
  renders "can save".

### Test harness / support

- Behavior (vitest + jsdom): `*.behavior.test.jsx` (UI) / `*.behavior.test.js`
  (Worker), beside sources. axe helper `app/src/a11y/axe.js`
  (`checkWcag21aa`). The fake-IndexedDB + loopback + real-git-remote rig is
  `app/src/worker/shelf-surface.behavior.test.jsx:1–70` (`createFileSystem`,
  `createGitLayer`, `createGitHttpClient`, `createLoopbackEndpoint`,
  `startGitHttpRemote`, `installWebLocks`); `app/src/worker/online.behavior.test.js`
  is the closest sibling. React-Aria overlays portal through
  `UNSAFE_PortalProvider` in `app/src/theme/ThemeRoot.jsx` (into `.est`) —
  no per-screen container needed.
- e2e-web: `e2e/web/tests/*.spec.js`, `e2e/web/lib/` (`axe.js` `checkA11y`,
  `env.js`, `mail.js` `waitForMessageTo`/`extractSignInLink`, `db.js`
  `seedAccount`, `devices.js` `openDevice`). Sign-in via the CDP virtual
  authenticator (`account-sign-in.spec.js`); put-online journey
  (`online.spec.js`). Seed an owner, a book and an invitation via the e2e HTTP
  client / Postgres exactly as `e2e/api/sharing.test.js` does (the owner's
  invitation UI is `books.share`, not built — so invitations are seeded via
  the API, not driven through a UI here).

## Constraints / requirements

- **No book without an account.** The flow is strictly account-first: no
  clone without a session, enforced by the service (`401` on accept, `404` on
  a non-member git request). The invited screen offers an account before any
  book content is reached. *Central.*
- **A dead or full link reveals nothing about the book.** The app surfaces
  only the generic worded messages, keyed off the machine-readable `code`;
  the `409`/`404` body carries no title, id or owner, and the app never
  displays one. A withdrawn/expired/exhausted invitation and a non-member
  request are deliberately indistinguishable ("This link doesn't open a
  book"); a full book is distinguished only to tell the person to ask the
  owner ("This book is full"). *Central.*
- **The role is the invitation's.** The joiner never chooses reader vs editor;
  the app writes the `role` from the accept `Book` onto the shelf register and
  renders it as a word (never colour alone). *Applies.*
- **Worker owns the data.** The accept call, the clone, the shelf-register
  write and the index update all run in the Worker; the main thread parses the
  route, shows the invited screen and the refusal/progress, and routes to the
  opened book, driven only by events. The Worker's `fetch` carries the
  same-origin `estante_session` cookie the main-thread sign-in minted.
  *Applies.*
- **Offline-first, but a clone needs the network.** The invited flow and
  "mine on Estante" are network operations; the clone shows cancellable
  progress (workflow 7 L33) via a clone event, and a failed/cancelled clone
  leaves no half-book on the shelf (the shelf register is written only after
  the clone lands, mirroring `PUT_ONLINE`). *Applies.*
- **No song text in logs.** The books-client and git-http client log nothing;
  typed errors carry a status/`code`, never a book's content. *Applies.*
- **Canonical form / fixtures.** Test books are purpose-written songs, never
  anyone's copyrighted words. *Applies.*
- **The fifty-person cap is the service's.** The app neither counts nor
  enforces; it only surfaces the `book_full` refusal. *Scoped out (service).*
- **Opening on the invitation's song.** The `Book` contract carries no
  deep-link to "the song the invitation was made from"; the app opens on the
  song list. The share-from-a-song deep link is `books.share`'s (its note:
  "share from a song"), not a new task. *Scoped out.*
- **The owner's invitation UI is `books.share`.** Making, listing and
  withdrawing invitations and the members list are out of scope here; this
  task only joins. *Scoped out.*

## Acceptance criteria

### Behavior delivered

1. **The invited boot route.** `<origin>/i/<token>` boots the invited flow and
   the URL is cleaned to `/`. A signed-in device accepts and clones straight
   away; a signed-out device sees the invited screen first.
2. **The account-first prompt.** The invited screen is generic (names only "a
   book on Estante", never the title or owner) and offers *Make an account* /
   *I have an account: sign in*, opening the existing `SignIn` surface
   (`create` / `signIn` intent). After sign-in the accept is retried
   (idempotent on repeat).
3. **Clone as reader or editor.** A `200 Book` clones into `bookDir(serviceId)`,
   writes `shelf.books[serviceId]` with the granted `role`, indexes the book,
   and opens it on its song list; the shelf row shows the right word
   ("reader" / read-only, or "can save") and "On Estante".
4. **Dead and full links.** `409 invitation_{withdrawn,expired,exhausted}` and
   `404` show "This link doesn't open a book"; `409 book_full` shows "This
   book is full"; neither names the book or owner.
5. **Mine on Estante.** Once signed in, the Add-a-book sheet lists the
   account's books not yet on this device's shelf (the `listBooks`-minus-shelf
   diff), each addable (cloned) onto the shelf; "Sign in to see them" when not
   signed in.

### Tests, by level

The `.tji` names **behavior** and **e2e-web**. I add a small **unit** level
for the one genuinely-pure new module (the mine-on-Estante diff) — a
proportionate sharpening, not a dropped level; no named level is dropped.
**e2e-api is not named and does not apply**: the accept/clone/full-book/
withdrawn paths are already pinned at e2e-api by `service.sharing`
(`e2e/api/sharing.test.js`, Done); this app task's end-to-end surface is the
browser journey (e2e-web).

- **unit** — `app/src/books/mine-on-estante.test.js` (new): the pure
  `booksNotOnShelf(listBooks, shelf, deviceId)` diff — a book already on the
  shelf (as `shelf.books[id]` or cloned locally) is excluded; an account book
  absent from the shelf is included with its `role` and `gitUrl`; a
  tombstoned shelf entry counts as absent. Pins workflow 7 §Add-a-book "Mine
  on Estante".
- **behavior (UI)** — `app/src/account/InvitedScreen.behavior.test.jsx`
  (new): the generic invited screen shows the account-first prompt and names
  neither book nor owner (workflow 1 §Invited, as amended); the dead-link
  message "This link doesn't open a book" and the full-link message "This book
  is full" each render from the matching refused reason and reveal nothing
  about the book (workflow 1 §Invited L53–58); the *Make an account* / *sign
  in* buttons open the `SignIn` surface. axe clean (`checkWcag21aa`).
- **behavior (UI)** — `app/src/books/MineOnEstante.behavior.test.jsx` (new):
  the Add-a-book sheet's "Mine on Estante" lists the account's off-shelf books
  from a stubbed `listBooks`, shows "Sign in to see them" when signed out, and
  an add triggers the clone command (workflow 7 §Add-a-book). axe clean.
- **behavior (Worker)** — `app/src/worker/add-by-link.behavior.test.js`
  (new), against `startGitHttpRemote()` + `fake-indexeddb` + a loopback accept
  endpoint (`createLoopbackEndpoint`, pattern from
  `online.behavior.test.js`): an `ADD_BY_LINK` whose loopback accept returns a
  `Book {role: editor, gitUrl}` clones the seeded remote into
  `bookDir(serviceId)`, writes `shelf.books[serviceId]` with `role: editor`,
  indexes it (search finds a purpose-written seeded song), and emits
  `BOOK_CLONED`; a `reader` accept writes `role: reader`; an accept answering
  `401` emits `NEED_ACCOUNT` and writes no shelf entry; `409 book_full` and
  `409 invitation_withdrawn` / `404` emit `BOOK_REFUSED` with the mapped
  reason and leave the shelf unchanged. Pins workflow 1 §Invited, the
  `online_reindex` obligation (`books.online`), and the accept contract
  (`openapi.yaml:548–573`).
- **e2e-web** — `e2e/web/tests/add-by-link.spec.js` (new), against the compose
  stack, on phone, tablet and computer viewports, axe (`checkA11y`) on every
  screen touched. Setup seeds an owner account, a book put online, and
  invitations (one reader, one editor, one later withdrawn, plus a book seeded
  to fifty members via `lib/db.js`) through the e2e HTTP client / Postgres as
  `e2e/api/sharing.test.js` does; the invitation URLs come from the
  `createInvitation` responses. Cases:
  - a **second account** opens the editor invitation's `/i/<token>`, is asked
    for an account first, registers a passkey (virtual authenticator), the
    book clones onto its shelf showing "can save"; it opens on its song list
    (workflow 1 §Invited, workflow 7);
  - the same second account opens the **reader** invitation, clones a book
    showing "reader" / read-only;
  - a **withdrawn** link shows "This link doesn't open a book" and a **full**
    book shows "This book is full", neither naming the book (workflow 1
    §Invited L53–58);
  - **Mine on Estante**: a second browser context for the owner account (a
    fresh shelf, signed in via the emailed-link fallback —
    `extractSignInLink`, since a passkey is authenticator-bound) lists the
    owner's online book under Mine on Estante and adds it onto that shelf
    (workflow 7 §Add-a-book). Driven by `account.sign_in` + `books.online`,
    both Done.
  - axe clean on the invited screen, each refusal, and the Add-a-book sheet.

An `/i/<token>` link extractor (or passing the `createInvitation` URL
directly) is added to the e2e setup; `lib/mail.js`'s `extractSignInLink`
matches `/sign-in/<token>` only.

## Decisions

1. **The pre-account invited screen is generic; the book's identity appears
   only after accept.** *Chosen:* show, before sign-in, only "an invitation to
   a book on Estante" and the account-first prompt; the title and role appear
   after a `200 Book` (on the shelf and the opened book). *Rejected: draw the
   title and role before sign-in (the W01 board).* There is no peek endpoint
   (`api/openapi.yaml` has no `GET /api/invitations/{token}`), and the only
   title-bearing endpoint, `acceptInvitation`, requires a session and is
   side-effecting. Decisively, a link cannot be told from a dead or full one
   without a session + accept, so a pre-account title would leak a dead link's
   book identity — violating "a dead link should tell its holder nothing about
   the book" (workflow 1 §Invited). *Rejected: add a side-effect-free peek
   endpoint.* That is service work outside this app task's scope and named
   test levels (behavior + e2e-web, no e2e-api), and a peek that hands a
   private book's title to any link-holder weakens "no book without an
   account". The design delta amends workflow 1 accordingly.
2. **The accept's `401` is the account-first gate — no separate session
   probe.** *Chosen:* the Worker's `ADD_BY_LINK` always attempts accept; a
   `401` emits `NEED_ACCOUNT`, the main thread shows the invited screen +
   `SignIn`, and on `onSignedIn` re-sends `ADD_BY_LINK` (accept is idempotent
   on repeat, so no double join or double use). *Rejected: a boot
   `GET /api/account` probe to decide whether to prompt.* It adds a round trip
   and a code path the `401` already gives for free, and a signed-in user
   skips the prompt entirely (straight to clone). A `401` accept has no side
   effect, so trying-first is safe.
3. **Accept-then-clone lives in one Worker command, reusing the put-online
   shape.** *Chosen:* `CommandKind.ADD_BY_LINK` in `logic.js` does
   `books.accept(token)` → `git.clone` → shelf-register write → `indexOneBook`
   → `BOOK_CLONED`, mirroring `PUT_ONLINE` (`logic.js:1248–1330`); a shared
   `cloneHosted({id, gitUrl, title, role})` helper (new
   `app/src/worker/add-by-link.js`, sibling to `online.js`) is reused by
   `ADD_MINE`. *Rejected: accept on the main thread, clone in the Worker, two
   coordinating messages.* Splitting the accept from the clone straddles the
   Worker-owns-data boundary and complicates the refusal/progress event flow;
   the cookie is visible to the Worker regardless. *Rejected: reuse the
   sync-engine's `SYNC` command.* The sync engine keeps already-remote books
   in step and has no fresh-clone path; a new hosted clone is its own command.
4. **The shelf register is written only after the clone lands.** *Chosen:*
   like put-online, write `shelf.books[serviceId]` after `git.clone`
   succeeds, so a failed or cancelled clone leaves no half-book; index before
   emitting so the live session's search is consistent (the `online_reindex`
   rule). *Rejected: optimistic shelf entry with a "cloning" placeholder
   register.* It risks a stranded entry on failure and duplicates the progress
   signal the clone event already carries.
5. **Mine on Estante is a client-side diff of `listBooks` minus the local
   shelf.** *Chosen:* `GET /api/books` gives the account's books with `role`
   and `gitUrl`; exclude those already on this device's shelf (hosted
   `shelf.books[id]` or a local clone), add the rest via the same
   `cloneHosted` helper (no accept needed — already a member). *Rejected: a
   dedicated "books not on this device" endpoint.* The service has no
   per-device state; the diff is the device's own knowledge. A pure
   `booksNotOnShelf` module makes it unit-testable.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-12.

- Boot route: `app/src/App.jsx` captures `/i/<token>` at mount and threads `invitationToken` to `AppShell`.
- Invited screen: `app/src/account/InvitedScreen.jsx` + `account.css` — generic (names only "a book on Estante"), account-first prompt, dead/full-link messages; parsed from `app/src/account/invitation-route.js`.
- Worker: `app/src/worker/protocol.js` (ADD_BY_LINK / ADD_MINE / LIST_MINE commands; BOOK_CLONED / NEED_ACCOUNT / BOOK_REFUSED / MINE events), `books-client.js` (accept), `add-by-link.js` (new — `cloneHosted`), `logic.js` (three handlers + `cloneOntoShelf` / `refusedReason`), `reducer.js` (mine slice).
- App shell: `app/src/shell/AppShell.jsx` (invited flow), `app/src/books/BooksScreen.jsx` + `books.css` (By-link / Mine-on-Estante sheet sections).
- Mine-on-Estante: `app/src/books/mine-on-estante.js` (pure `booksNotOnShelf` diff).
- i18n: `app/src/i18n/locales/en.js`, `es-419.js`, `it.js`, `pt-BR.js`.
- Design delta: `docs/workflows/01-first-run.md` §Invited amended — pre-account screen is generic (no title/owner before sign-in).
- e2e helper: `e2e/web/lib/db.js` (`fillBookToCapacity`).
- Tests: unit (`books/mine-on-estante.test.js`, `account/invitation-route.test.js`); behavior UI (`account/InvitedScreen.behavior.test.jsx`, `books/MineOnEstante.behavior.test.jsx`); behavior Worker (`worker/add-by-link.behavior.test.js`); e2e-web (`e2e/web/tests/add-by-link.spec.js` — editor+reader join, withdrawn+full refusals, Mine-on-Estante; axe on all three viewports).

# account.leaving — Leaving

## TaskJuggler entry

`tasks/70-account.tji` lines 42–47, `task leaving "Leaving"` under
`task account`. `depends design.leaving, !account_screen, service.books,
books.share`. Back-link target for the completion note:
`Refinement: tasks/refinements/account/leaving.md`.

## Effort estimate

**2d** (unchanged from the `.tji`). The work is in three pieces that each
reuse an existing seam: the **Leaving Estante** region appended to the
account screen (a day's view work across two dialogs with axe), a small new
`DELETE /api/account` handler whose cascade is almost entirely the schema's
existing `ON DELETE CASCADE` (half a day plus its Go and e2e-api tests), and
a Worker teardown that is the sign-out remove-branch minus its network step.
Nothing here is a new abstraction; the budget is tests and copy across four
locales, not new mechanism.

## Repository

**estante-de-cifras** only. Directories:

- `app/` — the Leaving Estante region and its two dialogs, the `deleteAccount`
  auth-client call, the Worker leave-teardown command, four-locale strings,
  styles.
- `service/` — the `handleDeleteAccount` handler and its route.
- `api/` — the `DELETE /api/account` operation in the contract.

Not a cifra.md task (the `.tji` note does not start with `cifra.md:`); the
format is untouched.

## Inherited dependencies

All settled.

- **design.leaving** (Done 2026-10-13) — decided and drew workflow 17
  (`docs/workflows/17-leaving.md`, `Status: decided`) and its board
  (`docs/mockups/W17-leaving.dc.html`), and made the DIRECTION deltas (§6
  Leaving flipped to decided-and-drawn, §7 added workflow 17, §3.6 Signing-in
  bullet names "deleting the account (workflow 17)"). This task **builds**
  what that task decided; no further design edit rides with it (see
  Decisions §8).
- **account.account_screen** (Done 2026-10-13) — `app/src/account/AccountScreen.jsx`
  with the **Preferences**, **Signed-in devices** and **Passkeys** regions, the
  header account affordance and the `account` AppShell surface state, and
  `app/src/account/auth-client.js` with `listSessions` / `revokeSession` /
  `listPasskeys` / `removePasskey` and the `not_found` `AuthError` kind. The
  Leaving Estante region appends **below Passkeys** in the signed-in branch of
  that screen. It also settled that **no endpoint returns the account's email**
  and the identity shows `preferences.authorName` or a neutral "signed in"
  (its Decision 5) — which this task's type-the-email confirm honours by
  checking server-side (Decisions §4).
- **account.sign_out** (Done 2026-10-13, transitive via `!account_screen`) —
  `app/src/worker/sign-out.js` with the `SURVEY_SIGN_OUT` point-in-time survey
  (per-book unsaved-song count and saves-not-pushed count, plus an only-here
  flag) and the `removeChanges` remove-branch teardown (drop clones, tombstone
  shelf registers, drop index entries), and `app/src/books/download-zip.js` +
  the Worker `DOWNLOAD_BOOK` command (per-book zip of the git repo). The
  warnings this task counts and the device teardown both reuse these.
- **service.books** (Done) — the `books` table with `deleted_at` soft-delete
  and `owner_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE`,
  `handleDeleteBook` (`service/internal/server/books.go:234`) with its
  soft-delete `UPDATE books SET deleted_at = now()` (`:279`) + best-effort
  `book.Store.Remove` (`:293`), and git-over-HTTP's refusal of a soft-deleted
  book as an undifferentiated 404. The account cascade reuses this repo-removal
  mechanism.
- **books.share** (Done) — the `memberships` and `invitations` tables (both
  `ON DELETE CASCADE` off `accounts.id` / `books.id`), `handleListMembers`
  (`service/internal/server/sharing.go:642`) for the "shared with N people"
  count, and the invite/accept lifecycle the e2e-api test drives to put a
  member in an owned book.
- **foundation.e2e_api / foundation.e2e_web** (Done, transitive — the account
  tree depends `foundation.e2e_web`, and `service.books` / `books.share` carry
  `foundation.e2e_api`). The harnesses `e2e/api/` and `e2e/web/` already run;
  the new tests land in them, never a parallel harness.

## What this task is

Build **workflow 17, Leaving**: a **Leaving Estante** region at the foot of
the account screen (signed-in only, below Passkeys) holding exactly two
affordances in order — **Take your data out** and **Delete my account**.

- **Take your data out** is a local, offline, repeatable copy. It lists every
  book the account can reach — books it **owns**, books it is a **member** of,
  and the **home book** — each with a **Download**, plus a **Download
  everything** that runs the per-book download over the whole list. Each
  download is workflow 7's per-book zip of the git repository exactly, read
  from the device clone, unsaved changes included. It touches nothing on the
  server and ends no membership.
- **Delete my account** is terminal and is **the one action in the app that
  waits for a connection**. A type-the-email confirm dialog states in words
  what deletion does, shows the blast radius (who loses access, and work only
  on this device), offers the download first, and on confirm makes a single
  `DELETE /api/account` call. The server cascade removes the account, its
  sessions and passkeys, drops its memberships and withdraws its invitations,
  and soft-deletes and removes the bare repositories of the books it owns — so
  a book whose owner leaves is **deleted for everyone** (members see *no longer
  shared with you*, their local copy kept with unpushed saves, a fork or
  download offered). A book the leaver is only a member of is untouched but for
  their own membership. After the 204, the Worker removes the account's books
  and the home book from the device and the session ends.

## Why it needs to be done

It is the last question the account asks — *end the account everywhere* — and
the one thing none of the per-book flows covers: what happens to a book whose
owner leaves (workflow 17 §Framing, lines 5–19; DIRECTION §6 lines 534–543).
Milestone `m5_everything` (`tasks/99-milestones.tji` line 44) depends on it. It
is a leaf — nothing depends on it downstream — so its value is entirely the
user-facing capability and the server cascade it introduces. The
`DELETE /api/account` endpoint it adds is the account-deletion capability
DIRECTION §3.6 (lines 364–367) already names as part of the API; this task is
where it lands.

## Inputs / context

Governing documents are **normative** — the refinement turns their promises
into a work order, it does not redesign them.

- **Workflow 17** — `docs/workflows/17-leaving.md`:
  - §Where leaving lives (lines 21–29) — the Leaving Estante region, foot of
    the account screen, below Passkeys, signed-in only; two affordances,
    data-out first.
  - §Taking your data out (lines 31–48) — the book list (owned, member, home),
    per-book Download + Download everything; local, offline, per-book zip of
    the git repo; no server endpoint; a read-only book downloads the same way.
  - §Deleting the account (lines 50–66) — the type-the-name confirm (the
    account's name is its email), the stated blast radius, the "take your data
    out first" link, the word-not-colour danger label.
  - §The warnings, counted (lines 68–83) — **who loses access** (per owned
    book shared with others, from `listMembers`, copy *"Banda do Bairro ·
    shared with 12 people — they will lose access"*) and **work only on this
    device** (per book, from the sign-out survey, copy *"My songs · 1 save not
    yet pushed"*, *"Banda do Bairro · unsaved changes in 2 songs"*).
  - §What happens to books others are members of (lines 85–113) — owned book
    deleted for everyone; member-only book untouched but for the leaver's
    membership; forks already made untouched; why delete rather than hand on.
  - §The cascade, and the one endpoint (lines 115–136) — `DELETE /api/account`,
    the four cascade steps, then the Worker device teardown.
  - §Offline (lines 138–149) — data-out works offline; delete needs a
    connection.
  - §Edge cases (lines 151–165) and §Later (lines 167–183).
- **Mockup** — `docs/mockups/W17-leaving.dc.html` (the single board,
  `canvas.json` lines 153–159): Phone 1 the Leaving Estante region; Phone 2
  take-your-data-out offline; Tablet a member's *no longer shared with you*
  shelf; Computer the delete-account confirm dialog with the counted warnings,
  the willHappen list, and the type-your-email field. Real copy is quoted in
  Acceptance criteria below.
- **DIRECTION.md**:
  - §6 Leaving (lines 534–543) — the decided-and-drawn summary.
  - §3.3 The one server (lines 153–222) — one owner per book (lines 184–185),
    at most fifty members (lines 175–176), a book downloadable as a zip of its
    git repository (lines 214–215), metadata-only logging, per-user no-reply
    commit authorship.
  - §3.6 The API (lines 360–377) — account deletion with the cascade over owned
    books (lines 364–367); book delete owner-only (line 368); git over HTTP
    refusing a deleted book (lines 319–358).
  - §3.7 The app (lines 410–450) — the Worker owns git, the working copy and
    the index and does every clone, fetch, merge, save and index update (lines
    423–425); the view is the only layer that knows React.
- **Code seams**:
  - `api/openapi.yaml` — `deleteBook` (lines 330–332), `revokeSession` (line
    239), `listMembers` (lines 411–412); `Account` schema is `required: [id]`
    only (lines 867–875); `EmailLinkRequest` (lines 942–950) is the precedent
    for an email **kept to the request body, never echoed**; `Error` (lines
    834–848) and the reusable responses `BadRequest` / `Unauthorized` /
    `NotFound` (lines 763–823).
  - `service/internal/server/server.go` (routes, lines 58–110) — where
    `DELETE /api/account` registers; `/api` is a reserved prefix (`app.go:54`).
  - `service/internal/server/books.go:234` `handleDeleteBook`, soft-delete
    `UPDATE` (`:279`), `book.Store.Remove` (`:293`); `book.Store.Remove`
    itself (`service/internal/book/book.go:141`) and `repoPath` (`:53`,
    `<BooksRoot>/<id>.git`).
  - `service/internal/session/session.go` — `CookieName = "estante_session"`
    (`:25`), `Resolve` (`:128`), `Revoke` (`:74`), `ClearCookie` (`:94`).
  - `service/internal/server/sessions.go:28` `handleSignOut` (the
    resolve-then-204 shape to mirror).
  - `service/internal/server/sharing.go:642` `handleListMembers` (count),
    `:759` `handleRemoveMember`, `:375` `handleWithdrawInvitation`.
  - `service/internal/admin/admin.go:166` `inTx` — the Begin/Commit/Rollback
    transaction pattern for a multi-step cascade.
  - `service/internal/db/migrations/0001_registry.sql` — `accounts` (lines
    37–41), `passkeys` (46–59), `sessions` (64–71), `books` with `deleted_at`
    (83–94), `memberships` (100–106), `invitations` (116–128),
    `invitation_joins` (133–138); every `account_id` / `owner_id` is
    `ON DELETE CASCADE`, and `books.original_book_id` is `ON DELETE SET NULL`.
  - `app/src/account/AccountScreen.jsx` (the region appends below Passkeys),
    `app/src/account/SignOutDialog.jsx` (the dialog pattern),
    `app/src/account/auth-client.js` (gains `deleteAccount`),
    `app/src/worker/sign-out.js` (`SURVEY_SIGN_OUT`, `removeChanges`),
    `app/src/books/download-zip.js` + the Worker `DOWNLOAD_BOOK` command,
    `app/src/worker/protocol.js` (new leave command/event), the type-the-name
    confirm pattern from book delete, `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`,
    `app/src/account/account.css`.
- **E2E harness** — `e2e/api/lib/{http,authenticator,db,git,mail,env}.js`;
  `e2e/api/sharing.test.js` (register → create → push → invite → accept
  lifecycle, the closest model); `e2e/web/lib/{axe,devices,mail,db}.js` and
  `enableVirtualAuthenticator` / `hasSessionCookie` from
  `e2e/web/tests/account-sign-in.spec.js`.

## Constraints / requirements

1. **Component boundaries (DIRECTION §3.6–3.7).** The app and the service
   share no code; only the API contract (`api/`) binds them. The view is the
   only layer that knows React; it dispatches to and reads slices from the
   Worker, which owns IndexedDB, git and the index. The device teardown (remove
   the account's books and the home book) is a Worker command, never a
   main-thread IndexedDB touch.
2. **Deleting is the one action that waits for a connection.** This inverts
   sign-out's ordering: sign-out tears down locally first and POSTs best-effort
   after (its Decision 4). Here the `DELETE /api/account` call comes **first**
   and the Worker device teardown runs only after a 204 — a terminal
   cross-user action must not fire unattended from a device that has since gone
   away (workflow 17 §Offline, lines 138–149).
3. **Take your data out is purely local and offline.** It reads device clones
   via `DOWNLOAD_BOOK` / `download-zip.js`; nothing waits on the network; it
   changes nothing on the server and ends no membership. A combined server
   archive is explicitly rejected (workflow 17 §Taking your data out) — one zip
   per book.
4. **Canonical form / preserving content.** The zip is the git repository as it
   stands on the device (history and working tree, unsaved changes included) —
   a verbatim repo copy, not a re-serialisation, so the standing
   "canonical-form over preserving content" rule does not bear on it; no song
   text is parsed or rewritten.
5. **Accessibility (every UI part).** React Aria Components for every
   interactive element; the delete confirm is a RAC modal; keyboard paths; axe
   at WCAG 2.1 AA on every rendered state. Danger is carried by a **word**
   ("Delete my account", "no longer shared with you", "this cannot be undone"),
   never colour alone. Known gotchas to carry: give RAC overlays a portal
   container inside `.est` ([[rac-overlays-portal-outside-est-theme-root]]); an
   open modal aria-hides shell chrome, so assert chrome only once closed
   ([[rac-modal-aria-hides-shell-chrome]]); one gesture per RAC button press in
   behavior tests ([[rac-button-keydown-plus-click-cancels-press]]); hold an
   injected Worker client in a `useRef` in any load effect
   ([[load-effect-client-needs-useref]]).
6. **No song text or email in logs; metadata only (DIRECTION §3.3).** The
   `DELETE /api/account` handler logs request metadata only — never the typed
   confirmation email, never book contents. The confirmation email is kept to
   the request body and never echoed in an error (the `EmailLinkRequest`
   precedent).
7. **No book without an account; the 50-member cap stands (DIRECTION §3.3).**
   The region is shown only when signed in — there is no account to leave
   otherwise. The cascade respects one-owner-per-book: an owned book is deleted
   for everyone (the ownership model's supported policy), never orphaned or
   silently transferred.
8. **i18n.** Every new string lands in all four locales
   (`en`, `pt-BR`, `es-419`, `it`), held by `app/src/i18n/i18n.test.js`'s parity
   test. Navigation stays AppShell view-state (no router); the store is threaded
   by prop, never context.

## Acceptance criteria

### Behavior delivered

- A **Leaving Estante** region renders at the foot of the account screen, below
  Passkeys, **only when signed in**, with heading *"Leaving Estante"*, the copy
  *"Take a copy of everything you hold here, then end your account if you want
  to."*, and two affordances in order: **Take your data out** and the danger
  **Delete my account** (`W17-leaving.dc.html` Phone 1).
- **Take your data out** opens a surface listing every reachable book (owned,
  member, home) each with a **Download**, and a **Download everything** above
  them; each Download dispatches `DOWNLOAD_BOOK` and yields the per-book zip
  (reusing `download-zip.js`). It works offline — when offline it still
  downloads and shows the notice *"Your books are on this phone, so downloads
  work here. Deleting your account needs a connection."* (Phone 2).
- **Delete my account** opens a terminal RAC modal (`W17-leaving.dc.html`
  Computer) that:
  - leads *"When you delete your account:"* and lists, in words:
    *"Your account, every session and every passkey are removed."*,
    *"The books you own are deleted for everyone who shares them."*,
    *"Your access to books other people own ends."*,
    *"Your books and home book are removed from this computer."*;
  - shows, under *"Books you own — deleted for everyone:"*, one counted line
    per owned book shared with others — *"Banda do Bairro · shared with 12
    people — they will lose access"* (count from `listMembers`) — and an
    owned book nobody else shares as *"My songs · only you — deleted"*;
  - shows, under *"Only on this computer — take it first:"*, per-book unsaved
    and not-yet-pushed counts from `SURVEY_SIGN_OUT` — *"Banda do Bairro ·
    unsaved changes in 2 songs"*, *"My songs · 1 save not yet pushed"* — with a
    **Take your data out first** link;
  - has a field labelled *"Type your email address to confirm:"* and a **Delete
    my account** danger action that stays disabled until the field is non-empty
    and the device is online; offline it is disabled with *"Needs a connection
    — available once you are back online."*;
  - states *"This cannot be undone."* in words.
- On confirm, the app calls `deleteAccount(confirmEmail)` →
  `DELETE /api/account`; on 204 the Worker runs the device teardown (remove the
  account's books and the home book, reusing the sign-out remove branch) and
  the session ends, returning the device to its first-run/not-signed-in state.
  A wrong email returns 400 and the dialog stays open with a `role="alert"`
  word (never colour) and the real address never shown.
- Server cascade (`DELETE /api/account`, workflow 17 §cascade): in one
  transaction, collect the ids of the account's live owned books, then
  `DELETE FROM accounts WHERE id = $1` — the schema's `ON DELETE CASCADE`
  removes its sessions, passkeys, memberships, the books it owns and their
  memberships/invitations/joins/notices, and its email-login-links; forks of a
  deleted book survive with `original_book_id` nulled (`ON DELETE SET NULL`).
  After commit, best-effort `book.Store.Remove` on each collected owned book
  removes its bare repo; the session cookie is cleared; 204. A member's next
  request to a deleted owned book is an undifferentiated 404 (git never
  spawned) — the client renders *no longer shared with you* (workflow 8,
  already built). A book the deleted account was only a member of is untouched
  but for that one membership row.

### Tests, by level

The `.tji` names **behavior; e2e-api; e2e-web**. A **unit** level is added for
the pure predicates (precedent: sign_in and sign_out each added unit for their
pure shapes). All named tests land in this task and run — not skipped — in
`scripts/gate`.

- **unit** — `app/src/account/leave.test.js` (new, pure, no DOM): the
  delete-enable predicate (non-empty field ∧ online); the warnings aggregator
  that merges `SURVEY_SIGN_OUT` per-book counts with per-owned-book
  `listMembers` counts into the "who loses access" and "only on this device"
  lists, including the "only you — deleted" vs "shared with N people" branch
  and the member-only/home-book cases. Pins workflow 17 §The warnings, counted
  (lines 68–83) and §What happens to books others are members of (lines
  85–113).
- **unit** — `service/internal/server/account_test.go` may host small helper
  tests; the cascade itself is exercised at behavior (below).
- **behavior (view)** — extend `app/src/account/AccountScreen.behavior.test.jsx`:
  the Leaving Estante region present only when signed in and absent in the
  not-signed-in card; the two affordances in order; axe clean. Plus
  `app/src/account/LeaveDialogs.behavior.test.jsx` (new, RTL + real React Aria
  + real i18n + loopback store): take-your-data-out lists owned/member/home
  books with Download + Download everything and dispatches `DOWNLOAD_BOOK`; the
  delete modal renders the willHappen list, the counted "shared with N —
  they will lose access" lines (loopback `listMembers`) and the "only on this
  computer" counts (loopback `SURVEY_SIGN_OUT`), the type-the-email gating, the
  download-first link, the offline-disabled state with its note, and on confirm
  dispatches `deleteAccount` then the Worker teardown; a 400 mismatch keeps the
  modal open with a `role="alert"`; axe clean on every state. Request/response
  shapes checked **structurally** against `api/openapi.yaml`, not by importing
  `api/validate.js` ([[api-validate-js-breaks-under-vite]]). Pins workflow 17
  §Where leaving lives / §Taking your data out / §Deleting / §The warnings and
  mockup `W17-leaving.dc.html`.
- **behavior (Worker)** — `app/src/worker/leave.behavior.test.js` (new, against
  fake-indexeddb + a local git remote): the leave teardown removes the
  account's shared books, the local books and the home book (clones dropped,
  shelf registers tombstoned, index entries dropped), reusing the sign-out
  remove branch; take-your-data-out's `DOWNLOAD_BOOK` yields a zip while the
  network is down. Pins DIRECTION §3.2/§3.7 and workflow 17 §Offline / §cascade
  device-teardown.
- **e2e-api** — `e2e/api/account.test.js` (new, modelled on `sharing.test.js`):
  register owner A by passkey; A creates and pushes a book (`GitCli`/`IsoGit`
  from `lib/git.js`); register account B; A invites, B accepts (B is a member
  of A's book); B creates and pushes a book of their own and invites A, A
  accepts (A is a member of B's book); A forks A's own... — then
  `DELETE /api/account` as A with the correct email → 204, and assert against
  the stack: A's session no longer resolves (401 on `listSessions`); A's owned
  book's git endpoint 404s for B (`lib/git` clone refused) and is absent from
  B's `listBooks`; B's book is untouched and B still owns it, with A's
  membership row gone; the `accounts`/`sessions`/`passkeys`/owned-`books`/
  `memberships`/`invitations` rows for A are gone (via `lib/db` `connect()`); a
  prior fork of A's owned book survives with `original_book_id` nulled. A wrong
  email → 400 and nothing deleted; an unauthenticated call → 401. Pins workflow
  17 §cascade (lines 115–136) and §books-others-are-members-of (lines 85–113),
  DIRECTION §3.3/§3.6.
- **e2e-web** — `e2e/web/tests/leaving.spec.js` (new, phone/tablet/computer,
  `@axe-core/playwright` at WCAG 2.1 AA): sign in with a virtual authenticator;
  open Account; the Leaving Estante region; **Take your data out** triggers a
  download for the home book and My songs (assert the Playwright download
  event), axe on the surface; then **Delete my account** — type the email,
  confirm, and assert the device returns signed-out to its first-run state with
  the account's books removed, axe on the dialog. An **offline** variant: take
  your data out still downloads; Delete my account is disabled with the
  "Needs a connection" note. Reuses `e2e/web/lib/{axe,devices,mail,db}.js` and
  `enableVirtualAuthenticator` / `hasSessionCookie`. Pins workflow 17 §Taking
  your data out / §Deleting / §Offline.

### Deferred work (closer registers in WBS)

Two items from workflow 17 §Later are already surfaced to the parking lot by
design.leaving and remain human-judgment / product decisions, not
agent-implementable leaves — they are **not** re-registered here:

- **Handing ownership of a book to a successor instead of deleting it**
  (workflow 10 §Later) — a product decision (who inherits), parking lot.
- **Leaving one shared book without deleting the account** (a self-remove
  verb; there is no self-remove endpoint today) — a separate small design
  decision, parking lot.

A **single combined archive** (one zip for all books) is a convenience noted as
*Later* in the workflow and needs no new endpoint; it is not scoped here and
not registered — if wanted later it is a small app-only follow-up
(`account.combined_archive`, ~1d, app/, Tests: behavior + e2e-web), but the
current per-book download fully satisfies "take your data out", so no task is
created now.

No test is deferred: every level above lands in this task.

## Decisions

1. **The cascade is the schema's existing `ON DELETE CASCADE`, plus
   best-effort repo removal — no new migration.** Every child of `accounts`
   (`passkeys`, `sessions`, `books.owner_id`, `memberships`, `invitation_joins`,
   `email_login_links`, `book_notices.owner_id`) is already
   `ON DELETE CASCADE`, and `books.id` cascades to its own
   memberships/invitations/joins/notices; `books.original_book_id` is
   `ON DELETE SET NULL` so a fork survives its original's deletion. A single
   `DELETE FROM accounts WHERE id = $1` therefore removes every row the workflow
   lists. The only non-SQL work is removing owned books' bare repos from disk,
   so the handler collects the live owned book ids inside the transaction
   before the delete, then calls `book.Store.Remove` on each after commit
   (idempotent `os.RemoveAll`, best-effort — exactly as `handleDeleteBook`
   treats it).
   *Why:* reuses the schema and `book.Store.Remove` already in place; no new
   migration (`0005_*.sql`) to add and pin. *Rejected:* a bespoke multi-step
   delete that soft-deletes each owned book (`UPDATE ... deleted_at`) before
   deleting the account — the workflow's §cascade describes "soft-deleted …
   reusing deleteBook's mechanism", but because the account-row delete cascades
   the book rows out of existence, a prior per-book `deleted_at` is overwritten
   and changes no observable state (a member sees a 404 either way, forks
   survive either way). The account-row cascade is the stronger, simpler form
   with the identical member-facing result, so no user-observable behavior
   deviates and no design delta is needed.
2. **Repo removal is best-effort after the transaction commits.** If a
   `book.Store.Remove` fails, the bare repo is orphaned on disk but no DB row
   points to it, so git-over-HTTP 404s it anyway (`resolveBookAccess` finds no
   row); it is a GC concern, never a correctness or access leak.
   *Why:* matches `handleDeleteBook`, where `deleted_at`/row absence is
   authoritative and `Remove` is cleanup. *Rejected:* removing repos inside the
   transaction — filesystem work is not transactional and a failed `RemoveAll`
   would roll back a delete the user confirmed.
3. **Delete is network-first; the Worker device teardown runs only after a
   204 — the inverse of sign-out.** Sign-out tears down locally first because
   it must not block on the network (its Decision 4); leaving is the opposite —
   the server cascade is the terminal cross-user act and must complete before
   the device forgets the account, and the action is explicitly the one that
   waits for a connection.
   *Why:* workflow 17 §Offline, §cascade. *Rejected:* firing teardown first
   like sign-out — it would leave the device account-free while the account
   still exists server-side if the connection never came, contradicting
   "deleting the account needs a connection."
4. **The type-the-email confirm is verified server-side; the app never learns
   the address.** The dialog asks the user to type their email (a thing only
   they know) and sends it in the `DELETE /api/account` request body
   (`{ "confirm": "<email>" }`); the server compares it to the account's email
   and returns 400 on mismatch, never echoing the address — exactly the
   `EmailLinkRequest` pattern ("kept to this request body; never echoed").
   *Why:* honours workflow 17's type-the-name guard **and** account_screen's
   Decision 5 that no endpoint returns the email and the app never displays it;
   reuses an existing contract pattern. *Rejected:* adding a `GET /api/account`
   that returns the email so the client can display and locally gate the
   button — that reverses account_screen Decision 5 and the privacy stance
   (no endpoint returns the email) for a friction affordance the server can
   enforce; the client gating on a non-empty field plus a server check keeps
   the deliberateness without the client ever holding the address.
5. **One `DELETE /api/account` endpoint, registered beside the other
   `/api/account` and auth routes, built as a transactional handler modelled on
   `admin.inTx`.** It resolves the session for the account id, verifies the
   confirmation, runs the cascade in one transaction, clears the cookie and
   returns 204; 400 on confirmation mismatch, 401 unauthenticated.
   *Why:* the API (DIRECTION §3.6) already names account deletion; the admin
   cascade is the in-repo precedent for a transactional multi-step delete.
   *Rejected:* driving the cascade from several existing endpoints client-side
   (revoke each session, delete each book) — not atomic, racy, and the app and
   service must not share the cascade logic; the server owns it behind one call.
6. **Take your data out stays client-local with per-book zips; no server
   export endpoint.** The device already holds every book as a clone; a
   server-side archive would duplicate data the browser has and add an endpoint
   for nothing. *Why:* workflow 17 §Taking your data out; reuses
   `download-zip.js` / `DOWNLOAD_BOOK`. *Rejected:* a server export route and a
   single combined archive (the latter noted *Later*, not needed now).
7. **The device teardown reuses the sign-out remove branch (`removeChanges`),
   not a new teardown.** Leaving removes the account's books and the home book
   from the device — the same sweep sign-out's default "remove" branch runs,
   minus its `POST /api/auth/signout` (the account is already gone server-side).
   A new Worker command (`LEAVE` / `DELETE_ACCOUNT` in `protocol.js`) invokes
   that sweep after the 204. *Why:* one teardown implementation, already tested.
   *Rejected:* a second parallel teardown path.
8. **No design delta rides with this task.** design.leaving already made the
   DIRECTION §6/§7/§3.6 edits and decided workflow 17 to its screens and
   copy. Adding the `DELETE /api/account` operation to `api/openapi.yaml` (and
   its `validate.js`/`validate.go`/contract-test updates) is implementation of
   the contract, not an amendment to a governing document. Every choice here
   realises workflow 17, DIRECTION §3.3/§3.6/§3.7 and the mockup; nothing
   deviates from them, changes the format, or adds a runtime dependency.

## Open questions

(none — all decided.) One implementer check, not a design question: confirm the
sign-in flow guarantees every account has a non-null `email` (the column is
nullable); if a passkey-only account can exist without one, the server
confirmation must degrade gracefully (the dialog would have nothing to
type-match). This is surfaced to the parking lot in the return summary rather
than encoded as a task.

## Status

**Done** — 2026-10-13.

- `api/openapi.yaml` — `DELETE /api/account` operation (`deleteAccount`) + `DeleteAccountRequest` schema (40 lines added).
- `service/internal/server/account.go` (new) — `handleDeleteAccount`: resolve session → verify email confirmation → collect owned live book ids → `DELETE FROM accounts` cascade in a transaction → best-effort `book.Store.Remove` per owned book → clear cookie → 204; 400 on mismatch, 401 unauthenticated.
- `service/internal/server/server.go` — route wired for `DELETE /api/account`.
- `app/src/account/leave.js` (new) — pure predicates: delete-enable predicate (non-empty field ∧ online), warnings aggregator merging `SURVEY_SIGN_OUT` counts with `listMembers` counts into "who loses access" and "only on this device" lists.
- `app/src/account/LeaveDialogs.jsx` (new) — take-your-data-out surface and the terminal RAC delete-account modal: willHappen list, counted warnings, type-the-email gating, offline-disabled state with note, download-first link.
- `app/src/account/AccountScreen.jsx` — Leaving Estante region below Passkeys; `sharingClient` prop threaded in.
- `app/src/account/auth-client.js` — `deleteAccount(confirmEmail)` + `mismatch` `AuthError` kind.
- `app/src/account/account.css` — styles for the Leaving Estante region (41 lines added).
- `app/src/worker/protocol.js` — `LEAVE_ESTANTE` command and `LEFT_ESTANTE` event.
- `app/src/worker/logic.js` — `LEAVE_ESTANTE` handler (remove-branch sweep including home book) + `DOWNLOAD_BOOK` guard ensuring the home book is provisioned before zipping.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — all four locales updated with Leaving Estante strings.
- Tests: unit (`app/src/account/leave.test.js` 10 tests; `service/internal/server/account_test.go` Go package); behavior (`AccountScreen.behavior.test.jsx` 15 tests, `LeaveDialogs.behavior.test.jsx` 5 tests, `leave.behavior.test.js` worker 2 tests); e2e-api (`e2e/api/account.test.js` 1 test); e2e-web (`e2e/web/tests/leaving.spec.js` — 2 tests × phone/tablet/computer).

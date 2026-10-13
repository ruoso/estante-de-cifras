# account.sign_out — Signing out

## TaskJuggler entry

[`tasks/70-account.tji`](../../70-account.tji), `task account.sign_out`
("Signing out"). `depends !account_screen`.

Note (verbatim): *"Remove this account's books (default) or keep them as
local books, with unsaved changes and unpushed saves counted. Workflow 13.
Tests: behavior (the choice with unsaved changes and unpushed saves counted;
axe); e2e-web (sign out removing the books, and keeping them as local books;
axe)."*

## Effort estimate

1d (`allocate team`), as the `.tji` fixes it. The weight is one new dialog in
the already-built account screen (the `onSignOut` seam `account_screen` left
for this task), one new auth-client method (`signOut`, a one-line POST), the
`AppShell` wiring that opens the dialog, and two new Worker commands — a
survey that counts a sign-out's local-only work and an action that removes or
keeps the books. Almost everything is reuse: the dialog follows `BookDetail`'s
`RemoveDialog` and the account screen's existing per-row confirm; the remove
branch reuses the `REMOVE_BOOK` handler body; the counts reuse
`sync-engine.js`'s `countAhead` and the index's `unsaved` locations; the
download reuses `DOWNLOAD_BOOK`; the home-book writes reuse `home.set`. The
genuinely new code is the keep-as-local migration (the inverse of put-online's
shelf-register move) and the survey aggregation — which keeps it to one day.

## Repository

**estante-de-cifras.** App work: the `.tji` note does not start with
`cifra.md:`. Directories touched:

- `app/src/account/` — the sign-out dialog and the `signOut` auth-client
  method; the `onSignOut` seam filled.
- `app/src/shell/AppShell.jsx` — passing `onSignOut` to `AccountScreen` and
  orchestrating the surface return to the not-signed-in state.
- `app/src/worker/` — the `SURVEY_SIGN_OUT` and `SIGN_OUT` commands and their
  events in `protocol.js`, their handlers in `logic.js`, the keep-as-local
  shelf migration (new) beside the existing put-online one.
- `app/src/i18n/locales/` — the dialog's copy in all four locales.
- `e2e/web/tests/` — the end-to-end journey.

The only contract across the component boundary is `api/openapi.yaml`
(`POST /api/auth/signout`, already defined, lines 211–220); DIRECTION §3.6
line 289 — "The app and the service share no code, only the HTTP API and the
format."

## Inherited dependencies

- **`account.account_screen`** (Done 2026-10-13,
  [`account_screen.md`](account_screen.md)) — the direct predecessor (`!`).
  It built `app/src/account/AccountScreen.jsx` with the **Signed-in devices**
  region, rendered the current device's sign-out control
  (`AccountScreen.jsx:463–466`, label `account.signOutThis`), and deliberately
  left its action as the `onSignOut` prop seam (`AccountScreen.jsx:261`,
  default no-op) for this task — mirroring how `first_run` shipped the
  `onSignIn` seam `sign_in` filled (account_screen.md:107–114, Decision 4). It
  distinguished the two sign-outs: per-device "Sign out" for **other** devices
  calls `revokeSession` (`AccountScreen.jsx:467–478`); the **current** device's
  control delegates to `onSignOut` and is this task's whole subject
  (account_screen.md:285–290). It also added `app/src/account/auth-client.js`'s
  session methods and noted `POST /api/auth/signout` is "not consumed here — it
  is `account.sign_out`'s" (account_screen.md:254–255). The dialog itself is
  already drawn in the mockup `docs/mockups/W13-new-device.dc.html`
  (account_screen.md:179–181).

- **`account.sign_in`** (Done, [`sign_in.md`](sign_in.md)) — settled the
  session model this task ends: `estante_session`, `HttpOnly`/`Secure`/
  `SameSite=Lax`, set by the service and **never read by the app**; "signed in"
  is known only from a response, no token stored (sign_in.md:242–249). It
  settled `createAuthClient({ fetch })` in `app/src/account/auth-client.js`
  with `postJson`/`accountOf` and a typed `AuthError`, and that WebAuthn/auth
  calls run on the main thread and cross no Worker boundary
  (sign_in.md:220–224, Decision 1). It assigned `POST /api/auth/signout` to
  this task (sign_in.md:78). The cookie reaches the Worker's git through
  `git-http.js`'s `credentials: 'include'` with no app plumbing
  (sign_in.md:221–224).

Settled context relied on but not a direct predecessor: **`books.online`**
(Done, [`books/online.md`](../books/online.md)) — put-online, remove and
download; its `REMOVE_BOOK`/`DOWNLOAD_BOOK` commands (`protocol.js:114,113`,
`logic.js:1555–1591`, `online.js:231,203`) and its `BookDetail` `RemoveDialog`
with the saves-not-pushed count (`BookDetail.jsx:101–152`) are the exact seams
reused here; its `PUT_ONLINE` shelf-register migration (`logic.js:1506–1518`)
is the pattern the keep-as-local migration inverts. **`sync.engine`** — the
`countAhead`/`localAhead`/`treeDirty` helpers in `sync-engine.js` and the
`sync[bookId].savesWaiting` slice. **`foundation.e2e_web`** (Done) — the
Playwright harness with the three viewport projects and the axe fixture.

## What this task is

Fill the current device's sign-out action. When the signed-in user chooses
"Sign out of this \<device\>" on the account screen, a dialog asks how to leave
the account on **this** device:

- **Remove this account's books from this \<device\>** — the default, for a
  borrowed or shared device: the account's shared books and this device's local
  books are removed from this device.
- **Keep them here** — as local books no longer synced: the account's shared
  books become local books on the shelf, the already-local books stay, and
  nothing is removed.

Either way, before acting, the dialog counts and warns about work that is only
on this device — unsaved changes and saves not yet pushed, per book — and a
book that is only on this device (a local book, or any book whose content is
not on Estante) offers a download before it is removed. On confirm, the Worker
performs the local teardown, then the app calls `POST /api/auth/signout` to
clear the session, and the surface returns to the not-signed-in state.

This is the **current-device** sign-out only — leaving the account on this
device. Revoking **another** device's session from the signed-in-devices list
is already `account_screen`'s (`revokeSession`); it is not touched here
(workflow 13 lines 77–79; account_screen.md:285–290).

## Why it needs to be done

Workflow 13 frames sign-out as "the same question asked the other way: what on
this device is the account's" (lines 6–8). `sign_in` opened the door and
`account_screen` drew the sign-out control but left its action a no-op; without
this task the control does nothing (`AppShell.jsx:520–529` does not even pass
`onSignOut`), and a user cannot cleanly leave an account — the central need on
a borrowed or shared device. It is the last leaf of workflow 13's steady-state
account management before `leaving` (account deletion). Downstream,
`account.new_device`'s re-author and home-book attach are the symmetric
forward direction; this task's teardown is their mirror.

## Inputs / context

Governing design:

- **Workflow 13 §Signing out** —
  [`docs/workflows/13-new-device.md:82–88`](../../../docs/workflows/13-new-device.md):
  *"Signing out asks whether to **remove this account's books from this
  device** — the default, for a borrowed or shared device — or **keep them**,
  as local books no longer synced. Either way, saves not yet pushed and unsaved
  changes are counted and warned about first, and a book that is only on this
  device is never removed without the download being offered."* Also §Unsaved
  changes (lines 53–55: the working copy belongs to a device; nothing travels)
  and the §Later deferral (line 96: "unsaved changes on another device" is
  explicitly out of scope — the count is of this device's work only).

- **The mockup** —
  [`docs/mockups/W13-new-device.dc.html:174–197`](../../../docs/mockups/W13-new-device.dc.html):
  the sign-out dialog, drawn with real copy. Title *"Sign out of this
  computer?"* (line 176); two radio cards, *"Remove this account's books from
  this computer / For a borrowed or shared computer."* selected by default
  (lines 178–181) and *"Keep them here / As local books, no longer synced."*
  (lines 182–185); a *"Not yet on Estante:"* notice listing per-book local-only
  work — *"Banda do Bairro · unsaved changes in 2 songs"*, *"Valsas · 1 save
  not yet pushed"* (lines 187–191); a per-book download guard — *"**Rascunhos**
  is only on this computer. Download it before it is removed."* with a Download
  action (line 192); actions *Cancel* and *"Sign out and remove"* (danger)
  (lines 193–196). The destructive-action label tracks the chosen mode.

- **DIRECTION §3.2** (`docs/DIRECTION.md:136–151`) — personal state lives in
  the home book, auto-committed, never pushed; "explicit save is for what the
  user authors, not for preferences." Preferences (theme/language) stay local
  and keep working whether or not signed in (account_screen.md:94–96). **§3.3**
  — the session cookie; before sign-in a device's commits carry a local id.
  **§3.6** (line 289) — the app and service share no code. **§3.7** (lines
  422–424) — "One owner for the data: a Web Worker … The main thread never
  touches IndexedDB"; the store is fed by Worker messages, components read
  slices through `useSyncExternalStore`.

App seams reused (file:line):

- `app/src/account/AccountScreen.jsx:261` — the `onSignOut = () => {}` seam
  (invoked at `:463–466` by the current-device control); `:252–262` props;
  `:281,309–327` the `auth` state machine (`probe()` → `'in'`/`'out'`).
- `app/src/account/auth-client.js:98,143–148` — `createAuthClient({ fetch })`;
  add `signOut()` → `POST /api/auth/signout` beside `listSessions`/
  `revokeSession`, same `postJson`/`AuthError` shape. Contract at
  `api/openapi.yaml:211–220` (204 on success, 401 otherwise; "clears the
  session cookie").
- `app/src/shell/AppShell.jsx:520–529` — the `account` surface; add the
  `onSignOut` prop and the post-sign-out return to the not-signed-in empty
  shelf (`setAccount(false)`, re-probe). `LOCAL_IDENTITY = { id:'local',
  name:'Me' }` (`:44`) is still the commit author (the account-id switch is
  `new_device`'s, unbuilt).
- `app/src/worker/protocol.js:526` — `command(kind, payload)`; `CommandKind`
  (`REMOVE_BOOK:'remove_book'` 114, `DOWNLOAD_BOOK` 113, `PUT_ONLINE` 112,
  `SAVE`/`DISCARD` 31–32) and `EventKind` (`BOOK_REMOVED` 385, `SHELF` 328)
  frozen enums — add `SURVEY_SIGN_OUT`/`SIGN_OUT` and their events.
- `app/src/worker/logic.js:1555–1591` — the `REMOVE_BOOK` handler (shelf read,
  `isLocal` compute, `ensureOnline().remove`, shelf tombstone via `home.set`,
  `removeBook` index drop, `flush`, `BOOK_REMOVED`); `:1506–1518` — the
  `PUT_ONLINE` shelf migration to invert; `:1593–1624` — `DELETE_BOOK`.
- `app/src/worker/online.js:203,231,250` — `download`/`remove`; `remove`
  strips the local tree under a lock; download already strips the remote.
- `app/src/worker/home-book.js` — `ensureHomeBook`, `home.set({ bookId:
  HOME_BOOK_ID, file:'shelf.json', changes, author })`, `home.read`,
  `ensureDeviceId`; `app/src/worker/shelf.js:65–80` — `surfaceShelf(model,
  deviceId)` (shared `books` map vs device-namespaced `local` map).
- `app/src/worker/sync-engine.js:167–208` — `defaultLocalAhead`/
  `defaultCountAhead` (unpushed count, `git log` depth-64 to origin head) and
  `defaultTreeDirty` (`statusMatrix` dirty boolean); the index's per-song
  `unsaved` flag (`search-index.js:197,283`) for the unsaved-songs count.
- `app/src/books/book-display.js:40–77` — `kind` (`'local'|'shared'`),
  `shelfEntries`, `isVisible`; `role.value`.

Test harness: `app/src/account/AccountScreen.behavior.test.jsx` (loopback
`fetch` recorder + worker-backed `createStore`/`createWorkerLogic` loopback +
`installWebLocks` + `fake-indexeddb` + `checkWcag21aa`); the sign-out seam is
already asserted as a no-op-delegation at `:267–275`. Worker behavior tests use
`fake-indexeddb` + a loopback git remote + web-locks (`app/src/test/loopback.js`,
`app/src/test/web-locks.js`), e.g. `online.behavior.test.js`. i18n parity is
held by `app/src/i18n/i18n.test.js`.

## Constraints / requirements

1. **The view never touches git, IndexedDB or the index; the Worker owns the
   teardown.** Both the survey (counting unsaved/unpushed per book) and the
   action (removing books, or migrating them to local and stripping remotes)
   are Worker commands; the dialog only dispatches and reads the resulting
   event/`shelf` slice (DIRECTION §3.7 lines 422–424). This is unlike
   `sign_in`, which added no Worker command because it touched no data — here
   the data is exactly what sign-out changes.

2. **The session cookie is the service's; the app only calls `signOut`.** No
   app code reads or clears `estante_session`; `POST /api/auth/signout` clears
   it server-side (sign_in.md:242–249). The app's "signed in" is re-derived
   from the next `listSessions` probe (401 → `'out'`).

3. **Offline first.** The local teardown needs no network and must not wait on
   one; it runs in the Worker and completes offline. `POST /api/auth/signout`
   is then attempted; if the network is unavailable the device is already
   locally account-free, and a `role="status"` line says the account was left
   on this device and the server session will clear when it reconnects (or
   expires). Nothing blocks on the POST. (See Decisions — order: teardown then
   POST.)

4. **Canonical form, no preserved spelling.** The keep-as-local migration moves
   shelf registers and strips the git remote; it does not rewrite any song, and
   the working copy and history are carried untouched into the now-local book.

5. **A book only on this device is never removed without the download being
   offered.** The survey marks such books (local books, and any book whose
   content is not on Estante); the remove branch offers each a download
   (reusing `DOWNLOAD_BOOK`) before it is removed (workflow lines 87–88; mockup
   line 192). The keep branch removes nothing, so no download is needed.

6. **No song text, titles, ids or secrets in logs.** The sign-out path logs no
   session id, account id, book title or count. Test fixtures use books written
   for the purpose.

7. **Accessibility.** The dialog is a React Aria `Dialog` holding focus (the
   `BookDetail`/`SharingScreen` confirm pattern); the choice is a React Aria
   `RadioGroup` with the default pre-selected; the counts and the download
   guard are carried by words in `role="status"`/notice text, never colour; the
   destructive action is a danger button whose label states the action ("Sign
   out and remove" / "Sign out and keep"). Overlays inherit the themed portal
   from the shell's theme root [[rac-overlays-portal-outside-est-theme-root]].
   axe at WCAG 2.1 AA is clean on every dialog state. When the dialog is open it
   aria-hides the account-screen chrome behind it
   [[rac-modal-aria-hides-shell-chrome]]; assert shell chrome only once it
   closes.

8. **The store threads by prop; navigation is `AppShell` view-state, no
   router** (account_screen.md:308–311). i18n: every new key lands in all four
   locales `{en, pt-BR, es-419, it}` (`i18n.test.js`). Use one gesture per RAC
   button press in tests [[rac-button-keydown-plus-click-cancels-press]]. A
   mount-effect that awaits the Worker client holds it in a `useRef`
   [[load-effect-client-needs-useref]].

9. **The home book stays.** Preferences (theme/language) live in the home book
   and keep working while signed out, so the home book itself is not removed by
   either branch; its git remote, if one is attached, is stripped (idempotent —
   a no-op today, since attaching it is `new_device`'s as-yet-unbuilt work).

## Acceptance criteria

### Behavior delivered

- The current-device sign-out control on the account screen opens the sign-out
  dialog (the `onSignOut` seam is filled; `AppShell` passes it).
- The dialog surveys this device through the Worker and shows, before any
  action: a "Not yet on Estante" list of books with unsaved changes and/or
  saves not yet pushed, counted per book, and a per-book download offer for any
  book that is only on this device.
- The choice defaults to **Remove this account's books**; **Keep them here** is
  the alternative. The confirm button names the chosen action.
- **Remove**: the account's shared books and this device's local books are
  removed from this device (clones dropped, shelf registers tombstoned, index
  entries dropped), a download having been offered first for any book only on
  this device; then `POST /api/auth/signout`; then the surface returns to the
  not-signed-in empty shelf.
- **Keep**: each shared book becomes a local book on the shelf (its shelf
  register migrated `books/{id}` → `local/{deviceId}/{id}`, its git remote
  stripped, its working copy and history kept), already-local books stay, and
  nothing is removed; then `POST /api/auth/signout`; then the not-signed-in
  state with the books still on the shelf as local.
- Cancel closes the dialog and changes nothing.

### Tests, by level

The `.tji` names **behavior** and **e2e-web**; a **unit** level is added for
the pure survey aggregation, which is a genuine pure module.

- **unit** (Vitest, colocated `*.test.js`) — the sign-out survey aggregator (a
  pure function from per-book `{ kind, role, savesWaiting, unsavedSongs,
  onEstante }` records to the dialog's two groups: the "not yet on Estante"
  list and the download-guard list) and the keep-as-local shelf-change
  computation (the register changes that invert put-online). Pins the survey
  shape and the migration against workflow 13 §Signing out (lines 82–88).

- **behavior** (React Testing Library + real React Aria + real i18n, over the
  worker-backed loopback store + `fake-indexeddb` + loopback git + web-locks),
  extending `app/src/account/AccountScreen.behavior.test.jsx` — the sign-out
  dialog: the default (Remove) and the Keep choice; the counts of unsaved
  changes and saves not yet pushed shown per book (a fixture book with a dirty
  working song and a fixture book with a local-unpushed commit); the download
  offered for a local-only book; Remove dispatches `SIGN_OUT {mode:'remove'}`,
  the shelf empties of the account's books, then `signOut` POSTs; Keep
  dispatches `SIGN_OUT {mode:'keep'}`, the books remain on the shelf as local,
  then `signOut` POSTs; Cancel changes nothing; axe clean on every dialog
  state. Pins workflow 13 §Signing out (lines 82–88) and the mockup
  (W13-new-device.dc.html:174–197). The current-device-vs-revoke boundary is
  already pinned at `AccountScreen.behavior.test.jsx:267–275`.

- **behavior** (Vitest, Worker, `fake-indexeddb` + loopback git remote +
  web-locks), new `app/src/worker/sign-out.behavior.test.js` — `SURVEY_SIGN_OUT`
  returns accurate `savesWaiting` (via `countAhead`) and unsaved-song counts
  and the only-here flag for a shared book, a shared book with an unpushed
  commit, a dirty-working shared book, and a purely-local book;
  `SIGN_OUT {mode:'remove'}` drops every clone (shared and local), tombstones
  the shelf, drops the index entries and leaves the SHELF empty of them;
  `SIGN_OUT {mode:'keep'}` migrates each shared book into `shelf.local`, strips
  its remote (a later `SYNC` is a no-op with no origin), keeps its working copy
  and history, and leaves already-local books untouched; the home-book remote
  is stripped idempotently; teardown completes with the network down. Pins
  DIRECTION §3.2/§3.7, workflow 13 §Signing out, and the put-online inverse
  (`logic.js:1506–1518`).

- **e2e-web** (`e2e/web/tests/sign-out.spec.js`, Playwright against the compose
  stack on the phone, tablet and computer projects, `@axe-core/playwright` at
  WCAG 2.1 AA, offline where the teardown is exercised) — sign in (passkey via
  virtual authenticator, as `sign_in`'s e2e does), put a book online
  (`books.online` put-online), make an unsaved edit in one song and a save (an
  unpushed commit) in another, open the account screen and sign out: the dialog
  shows the unsaved-changes and save-not-pushed counts; **Remove** empties the
  account's books from the shelf and returns to the not-signed-in empty shelf;
  a second run chooses **Keep** and the books remain on the shelf as local
  books, no longer synced; axe clean on the account screen and each dialog
  state. Pins workflow 13 §Signing out (lines 82–88). Drivers — all `complete
  100`: `account.sign_in` (signed-in device), `books.online` (a hosted book to
  remove/keep), the save/edit flow (`songs.*`), `account.account_screen` (the
  screen and its sign-out control), `foundation.e2e_web` (the harness).

All named tests land in this task and run (not skipped) in `scripts/gate`. The
service side of sign-out (the `signOut` handler clearing the cookie) is already
covered in the service's own tests against the stack; it is not duplicated here
— the `.tji` names no e2e-api level for this app task, and none is needed.

### Deferred work / graph notes

- **No deferred leaf.** The keep-as-local migration, the survey and the
  orchestration all land here; the home-book-remote strip is done idempotently
  so it needs no follow-up when `new_device` later attaches that remote.
- The **commit-author reversal** (device-local id ↔ account id) is not touched:
  the forward switch is unbuilt (`new_device`'s), so there is nothing to
  reverse; when `account.new_device` lands the forward re-author it lands its
  reversal on sign-out in the same task — not a separate leaf, and not this
  task's.

## Decisions

1. **The remove branch sweeps both the account's shared books and this device's
   local books; the keep branch migrates only the shared books.** The workflow
   option reads "remove this account's books," but the mockup's download guard
   names *"Rascunhos … is only on this computer"* — a purely-local book — and
   offers its download *"before it is removed"* (W13-new-device.dc.html:192).
   On a borrowed or shared device the intent is to leave nothing of the user's,
   so remove clears both maps, with a download offered for anything only here.
   Keep turns the shared books into local books (the already-local ones are
   already local); it removes nothing. *Why:* the mockup is normative — it shows
   what the workflow decided, real states and copy — and leaving local books on
   a borrowed device would defeat the default's stated purpose. *Rejected:*
   removing only `shelf.books` and leaving local books (contradicts the mockup's
   Rascunhos download guard and the borrowed-device purpose); a per-book
   remove/keep matrix (the workflow and mockup present one binary choice for the
   whole device, not a per-book one).

2. **Two Worker commands: a `SURVEY_SIGN_OUT` query and a `SIGN_OUT` action.**
   The dialog needs a fresh, accurate count of local-only work at the moment it
   opens — the `sync[bookId].savesWaiting` slice is only populated after a sync
   emits, and the browse `unsaved` flags are only loaded for opened books — so a
   dedicated survey computes `countAhead` and the unsaved-song count per book on
   demand and returns them as one event. The action then performs the teardown
   under the Worker's locks. *Why:* the §3.7 boundary forbids the view reading
   git/IndexedDB, and an on-demand survey is the only reliable point-in-time
   count. *Rejected:* reusing the store slices (incomplete and stale at an
   arbitrary moment); folding survey and action into one command (conflates the
   read the dialog shows with the write the user confirms); a per-book
   `REMOVE_BOOK` loop driven from the view (the view would have to enumerate the
   account's books and sequence the migration — data logic that belongs in the
   Worker).

3. **Keep-as-local is the inverse of put-online's shelf migration, reusing
   `home.set`.** Put-online moves a register from `local/{deviceId}/{id}` to
   `books/{id}` and adopts the service id (`logic.js:1506–1518`); keep-as-local
   moves `books/{id}` → `local/{deviceId}/{id}` (carrying the label as the
   local title) and strips the git remote, leaving the repo, working copy and
   history in place. *Why:* it is the exact structural inverse of an existing,
   tested seam, and `online.js` already strips a remote on download. *Rejected:*
   re-cloning or re-initialising the repo (needless and would discard unpushed
   work); a new storage concept for "detached" books (the shelf's `local` map
   already is that concept).

4. **Order: Worker teardown first, then `POST /api/auth/signout`.** The teardown
   is local and offline-capable; the POST clears the server session. Doing the
   teardown first honours offline-first (nothing the user does waits on the
   network) and means a failed/offline POST still leaves the device locally
   account-free, with a `role="status"` note that the server session clears on
   reconnect. *Why:* workflow and DIRECTION put local action ahead of the
   network; and on a borrowed device the local wipe is the security-critical
   part, which must not be blocked by connectivity. *Rejected:* POST first then
   teardown (would block the local sign-out on the network, and a failed
   teardown after a cleared cookie would 401 any retry); requiring a push of
   unpushed work before sign-out (the download offer already protects it, and
   forcing a push would block offline).

5. **Current-device sign-out only; revoke-other stays `account_screen`'s.** This
   task fills `onSignOut`; it does not touch the per-device `revokeSession`
   rows. *Why:* the `.tji` graph and workflow 13 (lines 77–79) split them, and
   `account_screen` already shipped and pinned revoke
   (account_screen.md:285–290, `AccountScreen.behavior.test.jsx:267–275`).
   *Rejected:* unifying the two (different endpoints, different semantics — one
   leaves this device, one stops another).

6. **No design delta.** Every choice realises what workflow 13 §Signing out, its
   mockup, and DIRECTION §3.2/§3.3/§3.6/§3.7 already decide; nothing deviates
   from a governing document, changes the format, or adds a runtime dependency
   (the two Worker commands are ordinary protocol surface within the §3.7
   architecture). So no `docs/` or `spec/` edit rides with this task.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- Worker survey and teardown: `app/src/worker/sign-out.js` (new — survey aggregator, `keepAsLocalChanges`, `removeChanges`); `app/src/worker/protocol.js` (SURVEY_SIGN_OUT/SIGN_OUT commands, SIGN_OUT_SURVEY/SIGNED_OUT events); `app/src/worker/logic.js` (two new handlers — survey and sign-out with remove/keep branches); `app/src/worker/sync-engine.js` (exported `countCommitsAhead`/`resolveOriginHead`); `app/src/worker/online.js` (`detach` helper stripping the git remote).
- Auth and UI: `app/src/account/auth-client.js` (`signOut()` → `POST /api/auth/signout`); `app/src/account/SignOutDialog.jsx` (new — radio-group remove/keep dialog with survey counts and per-book download guard); `app/src/account/AccountScreen.jsx` (onSignOut seam filled, offline minimal region added); `app/src/account/account.css` (dialog styles); `app/src/shell/AppShell.jsx` (`onSignOut` wiring, post-sign-out surface return).
- Extracted helper: `app/src/books/download-zip.js` (new, factored out of `app/src/books/BookDetail.jsx`).
- i18n: `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — dialog copy and `account.offlineManage` key for the offline fallback region.
- Tests — unit: `app/src/worker/sign-out.test.js` (12 tests: survey aggregator, keepAsLocalChanges, removeChanges); behavior: `app/src/worker/sign-out.behavior.test.js` (4 tests: survey counts, remove, keep, offline teardown) and extended `app/src/account/AccountScreen.behavior.test.jsx` (13 tests total, including 4 sign-out cases); e2e-web: `e2e/web/tests/sign-out.spec.js` (Remove + Keep on all three viewport projects).
- e2e-api fix: `e2e/api/lib/mail.js`, `e2e/api/mail.test.js` — scoped mailbox-clear to prevent race between parallel workers.

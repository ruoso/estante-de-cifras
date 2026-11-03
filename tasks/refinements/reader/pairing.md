# reader.pairing — Pairing the reader, and signing it out

## TaskJuggler entry

`reader.pairing` in [`tasks/85-reader.tji`](../../85-reader.tji) L143–148 (the
`task pairing` block inside `task reader`), a dependency of
`milestones.m7_reader` ([`tasks/99-milestones.tji`](../../99-milestones.tji)
L58–61).

## Effort estimate

1d.

## Repository

Not under `cifra.md/`. The work lands in:

- `remarkable/internal/pair/` — new package: `pair.go` (begin, poll, the poll
  loop) and `pair_test.go`, with its own httptest fake of the two endpoints.
- `remarkable/internal/backend/` — `views.go` / `backend.go`: the `5 pair` and
  `6 signOut` handlers, `102 pairing` answers, the relay's "first pass after
  pairing" flag; tests in `backend_test.go`.
- `remarkable/internal/sync/` — `sync.go`: a refused session (401) forgets the
  device; `SignOut(ctx)` (cancel the pass in flight, end the session with the
  service, clear the store); `Hold`'s release removing a clone once the device
  is no longer paired; the account name from the home book's `authorName`;
  `api.go`: `signOut`; tests in `sync_test.go` (and `fakeservice_test.go` gains
  `POST /api/auth/signout`).
- `remarkable/internal/store/` — a sign-out that keeps the clones a screen
  holds (`SignOutKeeping(ids)` or equivalent) beside the existing `SignOut`;
  tests in `store_test.go`.
- `remarkable/cmd/estante-reader/main.go` — `--origin` on `run` (default
  `https://estantedecifras.app`), the `pair` and `signout` subcommands, the
  `session` stand-in removed; `main_test.go`.
- `remarkable/qml/` — `browse/NotPaired.qml` (the *signed out from your
  account* line), `browse/pages.js` (that copy; *Paired with your account*),
  `Main.qml` (a refusal met by *Sync* shows *Not paired* at once); tests in
  `qml/tests/tst_main.qml` and `tst_browse_screens.qml`.
- `remarkable/README.md` — the development steps pair instead of pasting a
  session.
- `e2e/api/reader-pairing.test.js` (new), `e2e/api/lib/reader.js` (new:
  `runReader`, `pairReader`, shared), `e2e/api/reader-sync.test.js` (pairs
  through `pairReader` instead of the `session` stand-in).
- Design delta, written beside this refinement:
  `docs/remarkable-reader.md` §5.1 (the paragraph *On the device*) and
  `docs/workflows/19-remarkable-reader.md` §The shelf (Settings: *Paired with
  your account* until the account has a name).

## Inherited dependencies

All settled (`complete 100`):

- `reader.sync` — the `Syncer` (`Pass`, `Run`, `Trigger`, `Hold`,
  `passMu`), the `estante_session` cookie sent only to `Session.Origin`, a 401
  mapped to `Status.Error = "signedOut"` with nothing removed
  (`tasks/refinements/reader/sync.md` step 2 L209–210, Decision 10 L420–425),
  the `session`/`sync` subcommands and `e2e/api/reader-sync.test.js`.
- `reader.browse_screens` — `NotPaired.qml` with its code, expired and offline
  states, sending `5 {}`; Settings' Sign out question sending `6 {}`;
  `Main.qml` routing (`101 paired:true` on Not paired opens the shelf; a
  `102` drawn only while the code page is asked for or shown; `paired:false`
  mid-reading waits for the next `103`) — `browse_screens.md` L92–96, L319–324,
  Decision 4. "The pairing journey against the stack is `reader.pairing`'s
  e2e-api."
- `reader.device_pairing` — the service: `POST /api/devices/pair/begin` (201
  `{code, url, pollToken, expiresAt}`, 429), `/poll` (200
  `{status: pending|expired|approved, session?}`, 404 `pair_token_unknown`,
  429; the session delivered once), `/approve`; the session `kind='remarkable'`,
  read-only (receive-pack and writes 403), allowed `POST /api/auth/signout`
  (`device_pairing.md` Decision 3, Decision 5, Decision 10: no account name
  in the poll — *Paired with* is the home book's `authorName`).
- `reader.store` — `session.json` 0600, `Session{Origin, Token, Account,
  PairedAt}`, `SetSession`, `ClearSession`, `SignOut()` removing session, state,
  `home/`, `books/` and keeping `bundle/` (`store.md` Decision 6, Decision 8).
- `reader.backend_views` — "`signOut` and `pair` stay `reader.pairing`'s"
  (`backend_views.md` L98, L476–477); Settings' `account` is
  `Session().Account` (views.go L287–290).
- `reader.pair_design`, `reader.pair_web` — the web side; Decision 2 of
  `pair_design.md` (L247–257): a session signed out from the account is refused
  at the next sync, the reader forgets it and shows *This reMarkable was signed
  out from your account.*; "its refinement scopes the refused-session case and
  its tests".

## What this task is

The reader's side of pairing and signing out. *Pair with your account* (`5
pair`) makes the backend begin a pairing with the service, answer `102
{code, url, expiresAt}`, and poll in the background with the poll token only it
holds; approved, it keeps the read-only session in the store (0600), runs the
first sync while the code page stays still, and then reports itself paired so
the shelf replaces the code. An expired code is answered `102 {expired:true}`
(*Get a new code* sends `5` again); no network, `102 {offline:true}`. *Sign
out* (`6 signOut`) ends the session with the service, removes the books from
the device and returns to *Not paired*. A session the service refuses at a sync
— signed out from the account — is forgotten the same way, and *Not paired*
says so. The `session` development stand-in goes; the e2e-api pairs for real.

## Why it needs to be done

Without it the reader has no session except one pasted in over SSH: it cannot
be used by anyone. It is the last piece between the built reader and a person
reading on it (M7), and `reader.install`'s guide step (5) "opening it from
AppLoad and pairing it with the account" depends on it working. It also closes
the refused-session case `pair_design` Decision 2 left to it, and the
*Paired with* line `device_pairing` Decision 10 left to it.

## Inputs / context

- `docs/remarkable-reader.md` §5.1 (pairing; this task's delta, *On the
  device*), §5.3 (when a sync runs), §6 (types `5 pair`, `6 signOut`, `101
  state` with `error: signedOut`, `102 pairing`), §10 (session 0600, HTTPS to
  the one origin, no secret in a log).
- `docs/workflows/19-remarkable-reader.md` §Pairing L100–140 (Not paired, the
  code page and its stillness, expired, no Wi-Fi, signed out from the account,
  rule 5 for a background refusal vs one met by *Sync*), §The shelf L172–180
  (Settings: *Paired with*, Sign out's one question).
- `docs/home-book-format.md` §4.1 (`preferences.json` `authorName`).
- `api/openapi.yaml` L229 (`signOut`), L445 (`beginDevicePairing`), L508
  (`pollDevicePairing`), schemas L1463–1526.
- Code seams: `remarkable/internal/backend/backend.go` L98–123
  (`sendState`, `stateLocked`, `Paired` from `st.Session()` at L110), L134–242
  (`Serve`, its loop and message switch), `views.go` L131–156 (`handle`, no
  case for `Pair`/`SignOut`); `remarkable/internal/protocol/messages.go`
  L104, L107 (`Pair`, `SignOut`), L163–180 (`State`, `Pairing`);
  `remarkable/internal/sync/sync.go` L182–196 (`Hold`), L212–242 (`Pass`, the
  401 → `ErrorSignedOut` at L232–233), `api.go` L60–91 (`call`, 401 →
  `errSignedOut`), `schedule.go` (`Run`, `Trigger`);
  `remarkable/internal/store/store.go` L152–174 (`SignOut`),
  `session.go` L51–78; `remarkable/cmd/estante-reader/main.go` L70–92
  (dispatch), L284–312 (`sessionCommand`), L352–392 (`runCommand`).
- QML: `remarkable/qml/Main.qml` L97–142 (`showNotPaired`, `state`,
  `shelf`), L196–200 (102 routing); `browse/NotPaired.qml` L48–90;
  `browse/SettingsScreen.qml` L223–290; `browse/pages.js` L16–22, L262–264
  (`pairedWith`); tests `qml/tests/tst_main.qml` L185 (approved opens the
  shelf), L265 (`test_unpairedMidSongWaitsForTheShelf`), L282, L298.
- e2e: `e2e/api/pairing.test.js` L37–80 (register, begin, poll, approve),
  `e2e/api/reader-sync.test.js` L96–196 (`runReader`, the `session` stand-in,
  `sync`), `e2e/api/lib/env.js` L35–46 (`readerBin`), `scripts/gate` L455.

## Constraints / requirements

1. **One origin.** The backend pairs with its `--origin` (default
   `https://estantedecifras.app`, also used when AppLoad starts it with only
   the socket path) and writes it as `Session.Origin`; sync's same-origin rule
   (sync Decision 7) then holds for everything after. An `--origin` that is not
   `http(s)://host[:port]` is a usage error.
2. **The poll token is a secret.** Held in memory only — never in the store,
   a message to the frontend, stdout, stderr or an error string — and dropped
   when the pairing ends or *Get a new code* begins another. The code is shown
   to the person (it is on the screen) but never logged. The session token is
   never printed: the `pair` subcommand prints the code line only.
3. **Polling.** Every three seconds (overridable in tests), well under the
   service's 120/minute; one goroutine, off the loop's goroutine, cancelled by a
   new `pair`, by `Serve`'s end, or by the pairing ending; its outcome reaches
   the views through the loop (the views run on the loop's goroutine alone, as
   the filler's news does). `pending` keeps polling; `expired` or 404
   `pair_token_unknown` → `102 {expired:true}`; a poll the network does not
   answer (or a 429/5xx) is tried again until ten minutes from begin have
   passed (monotonic clock), then `102 {expired:true}`; `approved` → keep the
   session.
4. **Begin.** No network (the Wi-Fi down, or a transport error) → `102
   {offline:true}`; a service refusal (429, 5xx, a malformed answer) → `102
   {expired:true}` (Decision 4). A `pair` while paired answers `101 state` and
   begins nothing.
5. **The code page stays still** (workflow 19 §Pairing, rule 5): after the
   `102` with the code, the backend sends the frontend nothing until the
   pairing ends — no `102` per poll; states written by the first sync carry
   `paired:false` until that sync ends (Decision 2), and the frontend's Not
   paired ignores them.
6. **Approved.** `SetSession{Origin, Token, PairedAt: now}` (0600, atomic, as
   the store does); the relay's error from an earlier refusal cleared; the
   syncer triggered; when that first pass ends — done or failed — the relay
   reports `paired:true`, and the frontend's `open shelf` is answered from the
   pass's snapshot (or the empty shelf and its sync line, offline). A session
   the store cannot write is answered `102 {expired:true}`.
7. **Sign out** (`6`): leave the view on screen; `Syncer.SignOut(ctx)` cancels
   a pass in flight and waits for it (`passMu`), calls `POST /api/auth/signout`
   with the cookie under a five-second timeout — offline or refused, the device
   signs out all the same — then `store.SignOut()` (session, state, home, books;
   bundle kept) and drops the snapshot; then `101 {paired:false}` with no
   error. Nothing about the device's own pairing waits on the network beyond
   that bound (offline first).
8. **A refused session** (a pass's `errSignedOut`): the syncer forgets the
   device — session, state and home removed, every book removed except the ones
   a screen holds, which go when their hold is released — drops its snapshot,
   and ends with `Status.Error = "signedOut"` (state `paired:false,
   error:"signedOut"`, kept until the next pairing begins). An `open` while
   unpaired is answered `103 {books: []}` (the nearest view), which the frontend
   draws as *Not paired*.
9. **Rule 5 on the frontend.** A refusal met by a background sync changes
   nothing on screen; the next page opened shows *Not paired* with *This
   reMarkable was signed out from your account.* above its words (the existing
   mid-song path, extended to every screen). A refusal met by the person's
   *Sync* on the shelf shows it at once, in the redraw that ends the sync.
   After the person's own *Sign out*, *Not paired* carries no such line.
10. **The account's name.** Each pass that reads the home book sets
    `Session.Account` to `preferences.json`'s `authorName` value when it
    differs (no write otherwise); Settings says *Paired with your account*
    while it is empty.
11. **No secret, no song text in a log** (standing rule; §10): the backend
    and the subcommands print no code, token, session or song text to stderr;
    errors name the step, never the value.
12. Boundaries (DIRECTION §3.6): the reader shares no code with `service/`;
    it speaks only the API contract. The reader never pushes.

## Acceptance criteria

### Behavior delivered

- *Pair with your account* on a reader with no session shows a code and the
  address from the service; the page stays still; approved on the web, the
  shelf of the account replaces it in one redraw; expired, *That code has
  expired.* with *Get a new code*; no Wi-Fi, the offline sentence.
- *Sign out* in Settings, confirmed, ends the session with the service (when
  reachable), removes the books and returns to *Not paired*.
- A reader signed out from the account shows *Not paired* with *This
  reMarkable was signed out from your account.* — at once after *Sync*, at the
  next page opened after a background sync; a song on screen stays readable
  until Back.
- Settings says *Paired with* the account's `authorName`, or *your account*.
- `estante-reader pair --root DIR [--origin URL]` begins, prints one JSON line
  `{code, url, expiresAt}`, polls, and exits 0 once paired (1 expired);
  `estante-reader signout --root DIR` signs the device out. `session` is gone.

### Tests it lands with

**unit** (`go test`, `remarkable/`):

- `remarkable/internal/pair/pair_test.go`, against an httptest fake of begin
  and poll — `TestBeginAnswersTheCode` (code, url, expiresAt; the poll token
  not in the result the frontend sees); `TestPollPendingThenApproved` (the
  session returned once); `TestPollExpired`; `TestPollUnknownTokenIsExpired`
  (404 `pair_token_unknown`); `TestPollRetriesUntilTenMinutes` (unanswered
  polls retried, then expired, on a fake clock); `TestBeginOfflineSaysOffline`
  and `TestBeginRefusedSaysExpired` (429); `TestPairingErrorsCarryNoSecret`
  (no code, poll token or session in any error) — pins §5.1 *On the device*,
  workflow 19 §Pairing, the note's "the poll: pending, approved, expired".
- `remarkable/internal/store/store_test.go` — `TestSignOutKeepsHeldBooks`
  (a held book's clone stays, the rest goes, the bundle stays) — pins §5.1.
- `remarkable/cmd/estante-reader/main_test.go` — `TestRunOriginDefault` and
  `TestOriginMustBeHTTP`; `TestPairPrintsTheCodeNotTheToken` (against an
  httptest service: one JSON line, the session in `session.json` 0600 with the
  origin, the token absent from stdout and stderr); `TestSignOutCommandClears`.

**behavior** (`go test`, `remarkable/`, real store on `t.TempDir()`, real
collaborators over a socketpair):

- `remarkable/internal/backend/backend_test.go`, with a fake service for pair
  and signout and the existing `serve`/`fakeSyncer` seams (or the real syncer
  over `fakeservice_test`-style httptest) —
  `TestPairAnswersTheCodeThenNothingUntilItEnds` (one `102`, no messages while
  polling); `TestPairApprovedSyncsBeforePaired` (session kept 0600; states
  during the first pass say `paired:false`; `paired:true` after it; the next
  `open shelf` answered with the synced books); `TestPairExpired`
  (`102 {expired:true}`); `TestGetANewCodeDropsTheOldPoll` (the first token
  never polled again); `TestPairWhilePairedAnswersState`;
  `TestSignOutClearsTheDevice` (signout called with the cookie; store empty but
  the bundle; `101 {paired:false}` with no error);
  `TestSignOutOfflineStillSignsOut` (the service unreachable: signed out
  within the bound); `TestOpenUnpairedAnswersEmptyShelf` — pins design §5.1,
  §6, workflow 19 §Pairing.
- `remarkable/internal/sync/sync_test.go`, against the fake service —
  `TestRefusedSessionForgetsTheDevice` (401: session, home, state and
  unheld books removed; a held book kept until released, then removed;
  `error:"signedOut"`); `TestSignOutCancelsThePassInFlight`;
  `TestAccountFromAuthorName` (Session.Account set from `preferences.json`,
  not rewritten when unchanged) — pins workflow 19 §Pairing (signed out from
  the account), §5.1, `device_pairing` Decision 10.
- QML (`remarkable/qml/tests/`, the gate's qmltestrunner step):
  - `tst_main.qml` — `test_pairingPageStillUntilAMessage` (on the code page,
    `101` states — syncing, offline, `paired:false` — change no region's
    revision; only a `102 expired` or `101 paired:true` then `103` changes it:
    the note's "the pairing page still until a message changes it");
    `test_refusalMetBySyncShowsNotPairedAtOnce` (Sync tapped on the shelf,
    `101 syncing`, then `101 {paired:false, error:"signedOut"}` → *Not paired*
    with the signed-out line); `test_backgroundRefusalWaitsForTheNextPage` (on
    the shelf, no Sync tapped: the refusal changes no revision; the next `103`
    shows *Not paired* with the line); `test_ownSignOutHasNoRefusalLine`.
  - `tst_browse_screens.qml` — `test_pairedWithYourAccount` (Settings with an
    empty `account` says *Paired with your account*; with a name, *Paired with*
    the name); `test_signedOutLine` (the line drawn, one-bit, inside the
    content region) — workflow 19 §Pairing, §The shelf.

**e2e-api** (`e2e/api/`, vitest against the compose stack, the built
`ESTANTE_E2E_READER_BIN`):

- `e2e/api/reader-pairing.test.js` — `describe('the reader pairs, syncs,
  cannot write, and signs out (reader.pairing)')`:
  - *the reader begins, a signed-in web client approves, the reader syncs*:
    an account made by the passkey ceremony owns a book with a song written
    for the test and a home book whose shelf names it; `pair --root R
    --origin baseUrl` prints its code; the owner approves it
    (`POST /api/devices/pair/approve`); the process exits 0; `session.json`
    is mode 0600 and its token appears in no output; `sync` brings the book
    (its head equal to the pushed one) — the note, §5.1, workflow 19 §Pairing.
  - *a push with the reader's session is refused*: the git CLI pushing to the
    book with the token from `session.json` as the `estante_session` cookie
    is refused (403), and the book's head is unchanged — §5.1 read-only.
  - *Sign out ends the session with the service*: `signout --root R` leaves
    no session and no books under R, and a request with the old token is 401.
  - *signed out from the account*: a second pairing approved, the owner
    revokes it (`DELETE /api/account/sessions/{id}`), and the reader's next
    `sync` reports `signedOut` and leaves no session or books — workflow 19
    §Pairing, `pair_design` Decision 2.
- `e2e/api/reader-sync.test.js` keeps its cases, set up through
  `pairReader` (`e2e/api/lib/reader.js`) instead of the `session` stand-in.

No e2e-web: the reader is not the web app; its screens are pinned by the QML
behavior tests, and the web page that approves is `reader.pair_web`'s.

Deferred work: none.

## Decisions

1. **Drive the e2e through `pair`/`signout` subcommands of the real binary,
   sharing the backend's `internal/pair` and `Syncer.SignOut`.** As
   `reader.sync` did with `sync`. Rejected: driving the AppLoad socket from the
   JS harness (a `SOCK_SEQPACKET` client in Node is not portable and would test
   the framing `protocol` already tests); a Go-side stack test (§9 names it,
   but `reader.sync` settled on `e2e/api/` and the gate runs it there).
2. **The reader reports itself paired only when the first sync after
   approval ends.** One flag in the relay. So the shelf that replaces the code
   is the account's, as workflow 19 says ("the shelf replaces it — one
   redraw"), not an empty shelf that rule 5 would then forbid filling.
   Rejected: `paired:true` at approval (the shelf drawn empty, filled only at
   its next opening); holding the `open shelf` answer in the views until the
   pass ends (a second waiting state in the loop, where the frontend already
   waits on the state).
3. **Remove the `session` stand-in.** Pairing replaces it, and a subcommand
   that plants any token for any origin is surface the device no longer needs;
   `reader-sync.test.js` pairs instead. Rejected: keeping it for development
   (`pair` against a local stack does the same, honestly).
4. **A begin the service refuses is said as an expired code.** Workflow 19 has
   two sentences for the code page: expired and no Wi-Fi. A 429 or 5xx is not
   "not connected to Wi-Fi", and *Get a new code* is the right next step.
   Rejected: a third sentence and a new `102` field (a design change for a
   case the 30-per-hour limit makes rare).
5. **Sign-out asks the service, but never waits on it past five seconds.**
   Offline first: the device's books are removed and its token deleted even
   with no network; the session left on the service is listed in the account
   and signed out from there (workflow 13 §Among the signed-in devices).
   Rejected: refusing to sign out offline; queueing the signout call for later
   (the token is gone with the session file, and keeping it to call later
   would keep a secret the person asked the device to forget).
6. **A refusal keeps the clones a screen holds until released.** Reuses
   `Syncer.Hold`, so "a song on screen stays readable until Back" holds for a
   refusal as for a book no longer shared. Rejected: `store.SignOut()` at once
   (the engine's open book deleted under it).
7. **The account's name comes from the home book**, as `device_pairing`
   Decision 10 settled, set on `Session.Account` by the pass that reads it;
   *Paired with your account* until there is one (design delta in workflow 19).
   Rejected: a new "who am I" endpoint (a contract change for a line of copy).

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-11-02.

- Pairing client: `remarkable/internal/pair/pair.go` (begin and poll; the poll token never leaves the backend, errors carry no secret), tested in `pair_test.go`.
- Backend: `remarkable/internal/backend/pairing.go` and `backend.go`/`views.go` — pair answers the code once then stays silent, `paired:true` only after the first sync ends, Sign out cancels any pass and clears the store keeping the bundle, an unpaired reader answers the empty shelf.
- Sync and store: `remarkable/internal/sync/{sync,api,home}.go` forget a refused session (held books go when released) and set the account from the home book's `authorName`; `remarkable/internal/store/store.go` gains sign-out that keeps held books and the bundle.
- Command: `remarkable/cmd/estante-reader/main.go` gains `pair` and `signout`, `--origin` defaults, and loses `session`.
- QML: `remarkable/qml/Main.qml`, `browse/{NotPaired,ShelfScreen}.qml`, `browse/pages.js` — the signed-out line, *Paired with* the account; tests in `qml/tests/tst_main.qml` and `tst_browse_screens.qml`.
- e2e-api: `e2e/api/reader-pairing.test.js`, `e2e/api/lib/reader.js` (`pairReader`), `reader-sync.test.js` now pairs through it.
- Docs: `docs/remarkable-reader.md` §5.1, `docs/workflows/19-remarkable-reader.md`, `remarkable/README.md`, `e2e/api/README.md`.
- Tech debt: none.

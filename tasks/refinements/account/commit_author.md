# account.commit_author — Authoring as the account

## TaskJuggler entry

[`tasks/70-account.tji`](../../70-account.tji), `task account.commit_author`
("Authoring as the account"). `depends !new_device, sync.engine`. Milestone
`milestones.m5_complete` (`tasks/99-milestones.tji:44`).

Note (verbatim): *"After sign-in, saves, merges and home syncs are authored as
<account-id>@users.estantedecifras.app instead of the device-local id; the
account id comes from the sign-in reply and the attach and is kept in the
Worker's meta store. On sign-in the saves not yet pushed that carry the local id
are re-authored (chain rewritten from the first local-authored commit); sign-out
reverts to the local id; AppShell's LOCAL_IDENTITY is retired. Source:
tasks/refinements/account/new_device.md Decision 8 (account.new_device commit).
Governing: DIRECTION §3.3, workflow 6, sign_in.md Decision 6, sign_out.md.
Tests: unit (re-author of a mixed local and foreign chain); behavior (Worker:
pre-sign-in saves re-authored, hosted pushes authored by the account, sign-out
reverts); e2e-web (a song saved before sign-in shows as you in history after
signing in and putting the book online; axe)."*

## Effort estimate

2d (`allocate team`), as the `.tji` fixes it. Most of the weight is in the
Worker:

- one author resolver that every commit path goes through;
- the account id and a per-device local author id on the `meta` record;
- one new module that rewrites a book's unpushed chain;
- the sign-in and sign-out hooks that call it.

The view side is mechanical: the `LOCAL_IDENTITY` constants are removed from 17
views and `onSignedIn` passes the account id. History's *you* reads a flag the
Worker sets.

## Repository

**estante-de-cifras**, app work only. The note does not start with `cifra.md:`,
and nothing changes in `service/`, `api/` or `cifra.md/`. Directories touched:

- `app/src/worker/`:
  - `author.js`: the resolver;
  - `reauthor.js`: new, the chain rewrite;
  - `logic.js`: `resolveSyncAuthor` retired into the resolver, the `ATTACH_HOME`
    and `SIGN_OUT` hooks, and the payload `author.id` ignored;
  - `protocol.js`: `ATTACH_HOME { accountId }`, and `author` dropped from the
    command payloads;
  - `history.js`: `author.self` on each entry;
  - the tests beside these.
- `app/src/shell/AppShell.jsx`: `onSignedIn(account)` sends the id;
  `LOCAL_IDENTITY` is removed.
- The views that declare `LOCAL_IDENTITY` (listed under Inputs) and
  `app/src/songs/SaveSheet.jsx` (`LOCAL_ID`). They stop sending an author id.
- `app/src/songs/history-view.js`, `SongHistory.jsx`: *you* from `author.self`.
- `e2e/web/tests/commit-author.spec.js`: new. Plus one helper in
  `e2e/web/lib/journeys-account.js`.

## Inherited dependencies

All settled (`complete 100`):

- `account.new_device` (09b5c27):
  - `ATTACH_HOME` (`logic.js:1489-1501` → `attachHome` :1207 → `doAttach`
    :1184) and the start-time attach `startHome` (:1360-1376);
  - the `meta` accessors `readMetaRecord` / `writeMetaFields` (:1082-1110);
  - Decision 3 (no persisted signed-in flag; the cookie is the truth);
  - Decision 8, which hands this task the author switch.
- `sync.engine`:
  - `resolveOriginHead` / `countCommitsAhead` (`sync-engine.js:112-139`), the
    "saves not yet pushed" boundary;
  - the injected `resolveAuthor` (logic.js:630, :679, :710, :728).
- `account.sign_in`:
  - the `Account { id }` reply (`api/openapi.yaml:1107-1115`), handed out by
    `SignIn.jsx:125-133` `finishSignIn` → `onSignedIn(account)`;
  - Decision 6 (`sign_in.md:490-503`) gave the switch away and refused
    `localStorage` for the id.
- `account.sign_out`: the `SIGN_OUT` handler (`logic.js:2640-2711`) and
  keep-as-local (`sign-out.js:58`). `sign_out.md:360-363` hands the reversal to
  whichever task lands the forward switch. That is this task.
- `books.online` (put online), `songs.history` (the history screen and *you*),
  `storage.home_book` (`ensureDeviceId`, `home-book.js:394-426`).

## What this task is

A device that has signed in writes its commits as the account. This covers
saves, merges, conflict settles, home-book writes and syncs, uploads, bring-ins
and forks. Each is authored as `<account-id>@users.estantedecifras.app`.

Before sign-in, and after sign-out, the device writes as a local id. This task
makes that id per device: a random id kept on the `meta` record, so it is never
the literal `local`.

When the user signs in, every book on the device has its saves not yet pushed
rewritten. These are the commits not reachable from `origin/main`, or all of
them for a book that never had a remote. A commit authored by one of this
device's local addresses gets the account's address. Its descendants are
re-hashed. Commits by anyone else keep their author.

Signing out makes later commits local again. Nothing already written is
rewritten back.

History marks *you* by the address the Worker knows is this device's own, with
the name before sign-in as the fallback that workflow 6 keeps.

## Why it needs to be done

DIRECTION §3.3 (:165-177) promises two things. History recognises *you* by the
no-reply address. And "before sign-in, a device's commits carry a local id in
its place, which the account's address replaces in the saves not yet pushed
when the user signs in."

Today neither holds:

- Every commit pushed from a signed-in device carries `local@…` (the view
  saves, `AppShell.jsx:65`) or `<deviceId>@…` (`resolveSyncAuthor`,
  `logic.js:819-830`).
- So a shared book's history cannot tell one person's saves from another's
  except by display name.
- The `local@` address is the same on every device.

`sign_in` Decision 6 and `new_device` Decision 8 each passed this along. It is
the last task that owns it, and `m5_complete` waits on it.

## Inputs / context

Governing documents:

- **DIRECTION §3.3** (`docs/DIRECTION.md:165-177`): the per-user no-reply
  address, never a real email; *you* by that address; the local id before
  sign-in, replaced in the saves not yet pushed at sign-in; the service stores
  no name.
- **Workflow 6** (`docs/workflows/06-history.md:16-19`): "**who** saved it: the
  author's name as the commit gives it, or *you* for the user's own saves —
  recognised by the email the host account supplies, or by the name given
  before sign-in".
- **Workflow 13** (`docs/workflows/13-new-device.md:34-36`): commits carry the
  no-reply address. §Signing out (:162-166) counts saves not yet pushed and
  says nothing about authorship.
- **`sign_in.md` Decision 6** (:490-503); **`sign_out.md`** :360-363 (the
  reversal is this task's), Constraint 4 (:233-235: keep-as-local "does not
  rewrite any song … history … carried untouched").
- **`new_device.md` Decision 8** (:730-742) and deferred block (:599-619).
- **`storage/home_book.md` Decision 6** (:561-571): the commit-author local id
  is *not* the §2.3 device id ("conflating the two ids" rejected). Decision 7:
  device-level state lives on the `meta` record.
- **`storage/working_copy.md`** :271-273 and Decision 7: `author.js` owns only
  `id → email`.
- **`songs/history.md`** :236-243, :318-320: *you* is matched against
  `local@users.estantedecifras.app` today.

Code seams (HEAD 09b5c27):

- `app/src/worker/author.js`:
  - `noReplyAddress(id)` :30;
  - `authorFrom({ id, name }, now)` :48;
  - unit tests in `author.test.js`.
- `app/src/worker/logic.js`:
  - `resolveSyncAuthor` :819-830: `{ id: deviceId, name: authorName ?? 'Me' }`;
    injected at :630 (sync engine), :679 (conflicts), :710 (upload), :728
    (bring-in); called directly at :777, :1164, :1188, :1389, :2421, :2509,
    :2856;
  - SAVE :1561-1586 and NAME_AND_SAVE :2981/:3011 `authorFrom(payload.author)`;
  - CREATE_BOOK :2198, example book :2235, NEW_SONG / My songs :2928, and the
    many `home.set` / `home.ensureLocal` calls with the payload author;
  - `loadOrCreateMeta` :129-170, which strips device fields from the READY view
    at :160-165;
  - SIGN_OUT :2640-2711.
- Commit call sites: `working-copy.js:168, :236`; `books.js:82-88`;
  `example-book.js:112-118`; `my-songs.js:74-80`;
  `home-book.js:224-230, :258/:301-321, :361-366`;
  `sync-engine.js:348-356` (merge); `conflicts.js:453-461` (settle);
  `upload.js:335-341, :555, :621, :647`; `bring-in.js:194-199, :359`;
  `fork.js:79-88`.
- Conflict sessions are in-memory and recomputed from refs
  (`conflicts.js:304, :371`). No ours-oid is persisted that a rewrite would
  orphan.
- Upload imports a zip's history verbatim (`upload.js:7, :191`). So a book
  saved before sign-in on *someone else's* device can arrive here carrying
  their local address.
- `LOCAL_IDENTITY = { id: 'local', name: 'Me' }` is declared in:
  - `app/src/shell/AppShell.jsx:65` (uses :583, :606, :620, :1062);
  - `songs/SongArrange.jsx:66`, `SongWizard.jsx:46`, `SearchScreen.jsx:53`,
    `SongReading.jsx:61`;
  - `files/FileView.jsx:34`;
  - `books/SetlistView.jsx:48`, `BooksScreen.jsx:68`, `BookDetail.jsx:59`,
    `MakeYourOwn.jsx:31`, `LeaveDialog.jsx:27`, `UploadPreview.jsx:42`;
  - `account/AccountScreen.jsx:70`, `MySongsChoice.jsx:31`,
    `SignOutDialog.jsx:42`;
  - `music/ChordExplorer.jsx:38`, `instruments/InstrumentsOverlay.jsx:30`;
  - and `songs/SaveSheet.jsx:46` declares `LOCAL_ID = 'local'` (:103-118).
- `AppShell.jsx:735-739` sends `ATTACH_HOME {}`. Its `onSignedIn` ignores the
  account.
- `app/src/songs/history-view.js`: `LOCAL_NO_REPLY` :36, `isYou` :49-54, `who`
  :128-136. `SongHistory.jsx:250-251` builds the identity from `LOCAL_NO_REPLY`
  plus `preferences.authorName`.
- The hook does not check commit authors (`service/internal/hook/contents.go:62`
  is a size cap only). Rewritten commits push as any others.
- Test seams:
  - `app/src/worker/new-device.behavior.test.js` (`makeDevice`, `open`,
    `signIn`, `ask`, `config` helpers; :466 the 401/sign-out case);
  - `sign-out.behavior.test.js`; `online.behavior.test.js:189`;
  - e2e: `e2e/web/lib/journeys.js`: `sessionCookie` :111, `signInWithPasskey`
    :120, `makeLocalBook` :137, `putBookOnline` :148, `bookGitUrl` :156,
    `saveThroughSheet` :286, `historyFromReading` :300;
  - `e2e/web/lib/git-device.js:26` (`GitDevice`);
  - `GET /api/books/{bookId}/members` (`api/openapi.yaml:594`, a read, allowed
    by `e2e/web/eslint.config.js:58`).

## Constraints / requirements

1. **The Worker owns identity** (DIRECTION §3.7). The account id and the local
   author id live on the `meta` record, never in `localStorage` (sign_in
   Decision 6). The view sends no author id. Neither id is surfaced in the
   READY view, as with `deviceId` (logic.js:160-165).
2. **One resolver.** Every commit, listed under Inputs, takes its identity from
   `resolveAuthor()`, which returns:
   `{ id: meta.accountId ?? meta.localAuthorId, name: authorName pref ?? 'Me' }`.
   SaveSheet's typed name still reaches NAME_AND_SAVE and SET_IDENTITY_NAME as
   `name`. No commit path keeps its own author.
3. **The local author id is per device and distinct from the device id**
   (storage/home_book Decision 6):
   - It is a `crypto.randomUUID()` kept as `meta.localAuthorId` and made on
     first need.
   - The literal `local` is never written again.
   - This device's *local addresses* are `<localAuthorId>@…` and the legacy
     `<deviceId>@…` that `resolveSyncAuthor` wrote.
4. **Re-author scope:**
   - It runs on every book in the working copy: local books, *My songs*, the
     home book, kept-as-local books, and hosted books if any.
   - It covers only commits on `main` not reachable from
     `refs/remotes/origin/main` (all of them when that ref is absent), the
     boundary `countCommitsAhead` uses.
   - A commit in that set is rewritten if its author or committer is one of
     this device's local addresses, or if one of its parents was rewritten.
     Only the local fields change: a foreign author or committer, the tree,
     the message, the timestamps and timezone, and the parent order are all
     kept.
   - A commit reachable from `origin/main` is never rewritten (it is pushed,
     and §3.3 speaks only of "saves not yet pushed").
5. **The working copy and index are untouched.** Trees are identical, so only
   the `main` ref moves. Unsaved changes survive (workflow 13 §Unsaved
   changes).
6. **Safe against a racing write.** The ref update is a compare-and-swap. If
   `main` moved since the walk, the book is walked again. `meta.accountId` is
   written *before* the rewrite, so any commit made during it is already the
   account's.
7. **Before any push, and idempotent.**
   - The re-author runs inside `attachHome`, after the id is stored and before
     the home sync pushes. Put online, which pushes local books later, finds
     them already rewritten.
   - Run twice, it rewrites nothing the second time (no local-authored commit
     remains). So the start-time `startHome` re-attach after an interrupted
     sign-in finishes the job safely.
8. **Offline first.** The rewrite is local and never waits on the network. If
   the attach fails offline after the rewrite, the id stays and the start-time
   attach retries.
9. **Sign-out reverts authorship going forward only.**
   - `SIGN_OUT` clears `meta.accountId` *first*, so its own shelf write and
     every later commit are local.
   - It rewrites nothing back (sign_out Constraint 4). A kept-as-local book's
     account-authored commits stay as they are.
10. **No song text in logs**, and test songs written for the purpose. The
    rewrite logs nothing about messages or contents.
11. **Accessibility:** no new UI. History's *you* stays a word (workflow 6) and
    the history screen stays axe-clean.

## Acceptance criteria

### Behavior delivered

1. After sign-in, every new commit on the device is authored and committed as
   `<account-id>@users.estantedecifras.app`, with the user's display name. This
   covers save, setlist save, new song, new book, home-book write and sync,
   merge, conflict settle, upload, bring-in and fork.
2. `onSignedIn(account)` in `AppShell` sends
   `ATTACH_HOME { accountId: account.id }`. The Worker stores it as
   `meta.accountId` and then re-authors before attaching.
   `ATTACH_HOME` without `accountId` (the start-time path) uses the stored one.
3. On sign-in, the saves not yet pushed that carry this device's local
   addresses are re-authored, per Constraints 4–7. A book saved before sign-in
   and put online afterwards pushes only account-authored commits.
4. Commits by other people in the unpushed set keep their author: an uploaded
   history, or a local address from another device.
5. `SIGN_OUT` clears `meta.accountId`. Later commits carry
   `<localAuthorId>@users.estantedecifras.app`, and existing commits are
   unchanged.
6. History entries from the Worker carry `author.self: true` when the author
   email is this device's account address or one of its local addresses.
   `isYou` returns true on `self`, and otherwise falls back to the name match
   that workflow 6 keeps. `LOCAL_NO_REPLY` is removed.
7. `LOCAL_IDENTITY` (all 17 declarations) and `SaveSheet`'s `LOCAL_ID` are
   gone, and command payloads carry no author id. `protocol.js` documents
   `ATTACH_HOME { accountId? }` and the `name` field for SaveSheet's two
   commands.

### Tests, by level

**unit**

- `app/src/worker/reauthor.test.js`, against the pure planner
  `planReauthor({ commits, pushed, isLocal, to })`. It takes commit records
  (`oid`, `parents`, `author`, `committer`, `message`, `tree`) and returns the
  rewrites in parent-first order. Cases:
  - **mixed local and foreign chain** (the note's case): the first two commits
    pushed; then foreign `ana@…`, local, foreign, local. Expected:
    - the pushed pair untouched;
    - the first unpushed foreign commit untouched (nothing above it was
      rewritten);
    - the first local commit re-authored;
    - the later foreign commit keeps author `ana@…`, gets a re-hashed parent
      and keeps its committer;
    - the last commit re-authored.
    - Trees, messages and timestamps are kept in every case (DIRECTION §3.3,
      Constraint 4).
  - a merge commit with one pushed parent and one rewritten parent: only the
    rewritten parent is remapped, and parent order is kept.
  - a local author with a foreign committer, and the reverse: only the local
    field changes.
  - nothing local: an empty plan (idempotence, Constraint 7).
  - no pushed boundary (a never-pushed book): every commit is a candidate.
- `app/src/worker/author.test.js`, extended for `resolveAuthor`:
  - the account id when set;
  - otherwise the local author id, created once and stable across calls;
  - never `local`;
  - never the device id (storage/home_book Decision 6).
- `app/src/songs/history-view.test.js`, extended:
  - `isYou` true on `author.self`;
  - the name fallback still works (workflow 6 :16-19);
  - a foreign author with a different name is not *you*.

**behavior** (Worker against fake IndexedDB and the loopback service, in the
harness of `new-device.behavior.test.js`): new file
`app/src/worker/commit-author.behavior.test.js`. Cases:

- **pre-sign-in saves re-authored:**
  - Set-up: a signed-out device creates a local book, saves two songs in it,
    adds a song to *My songs* and changes a setting (a home-book commit). It
    then imports an uploaded zip whose history holds a foreign local address.
  - It signs in and sends `ATTACH_HOME { accountId }`.
  - Every unpushed commit authored by `<localAuthorId>@` or `<deviceId>@` is
    now `<accountId>@`, in all three books.
  - The zip's foreign commits keep their author.
  - Working-copy files and a pending unsaved change are byte-identical.
  - History entries for the rewritten saves carry `self: true`.
  - A second `ATTACH_HOME` leaves every oid unchanged.
  - Pins DIRECTION §3.3 and Constraints 4–7.
- **hosted pushes authored by the account:**
  - After sign-in the local book is put online.
  - A save, a home-setting change and a merge with a concurrent remote commit
    are pushed.
  - Every commit on the service remote's `main` that this device made is
    `<accountId>@`, the merge commit included. No `local@`, `<localAuthorId>@`
    or `<deviceId>@` address is reachable from the remote.
  - Pins DIRECTION §3.3 and acceptance 1.
- **interrupted sign-in:**
  - `ATTACH_HOME { accountId }` with the remote unreachable.
  - The id is stored and the rewrite is done. The restart's `startHome` attach
    pushes account-authored commits only.
  - Pins Constraints 7 and 8.
- **racing save:** a SAVE dispatched while the re-author runs is kept on `main`
  (not lost to the ref swap) and is authored as the account. Pins Constraint 6.
- **sign-out reverts:**
  - After a signed-in save, `SIGN_OUT { mode: 'keep' }`.
  - `meta.accountId` is cleared.
  - The next save in the kept book is `<localAuthorId>@`, and the earlier
    `<accountId>@` commits keep their oids.
  - Signing in again as a *different* account rewrites only the post-sign-out
    local commits.
  - Pins `sign_out.md:360-363`, sign_out Constraint 4, and Constraint 9.

The existing Worker and view behavior suites stay green after the protocol
change. Any test asserting `local@users.estantedecifras.app` is updated to the
resolved local address.

**e2e-web**: new file `e2e/web/tests/commit-author.spec.js`. It runs on the
phone, tablet and computer projects, through the real UI only. The case: **a
song saved before sign-in shows as you in history after signing in and putting
the book online.**

- Steps:
  - `makeLocalBook` on a fresh, signed-out device;
  - write and `saveThroughSheet` a song written for the test (name typed in
    the sheet);
  - `signInWithPasskey`;
  - `putBookOnline`;
  - `historyFromReading` on that song.
- The row reads *you*. Axe at WCAG 2.1 AA on the history screen.
- Then a new helper `pushedAuthorEmails(page, title)` in
  `journeys-account.js`:
  - It clones `bookGitUrl` with a `GitDevice` carrying the `sessionCookie`, and
    reads `git log --format='%ae%n%ce'`.
  - The spec reads the owner's `userId` from
    `GET /api/books/{bookId}/members` (a read).
  - It asserts every address equals `<userId>@users.estantedecifras.app`.
- Pins workflow 6 :16-19 and DIRECTION §3.3. The git check is what pins the
  re-author: the *you* row alone could pass on the name fallback.

All named tests land in this task and run (not skipped) in `scripts/gate`. No
e2e-api level is named, and none is needed: nothing in `service/` or `api/`
changes, and the hook does not read authors.

### Deferred work / graph notes

- None. The reversal on sign-out, the history *you*, and the retirement of
  every `LOCAL_IDENTITY` all land here.

## Decisions

1. **The account id reaches the Worker in `ATTACH_HOME` from the sign-in reply,
   and persists on `meta`.**
   - *Why:*
     - The reply is the only place the app learns the account id
       (`openapi.yaml:1107-1115`; no `/me`, and `HomeBook` carries the home
       book's id, not the account's).
     - `ATTACH_HOME` is already the one sign-in → Worker message
       (new_device Decision 1).
     - The `meta` record already holds device-level state (storage/home_book
       Decision 7).
     - This is the note's "comes from the sign-in reply and the attach".
   - *Rejected:*
     - Adding `accountId` to the `HomeBook` reply so a restart can re-learn it.
       That is a service and contract change with its own tests, for one gap
       that only exists before launch: a device signed in before this task
       ships has no stored id and authors locally until its next sign-in.
     - `localStorage` (sign_in Decision 6).
     - Persisting a signed-in flag (new_device Decision 3). The id is an
       authoring identity, not a session claim, and the cookie stays the truth
       for access.
2. **The local author id is a per-device random id, distinct from both
   `local` and the device id.**
   - *Why:*
     - `local@` is the same on every device. An uploaded zip from someone
       else's device (history taken verbatim, `upload.js:7`) would be claimed
       as yours by the re-author and by history's *you*.
     - storage/home_book Decision 6 already refused reusing the §2.3 device id.
     - The legacy `<deviceId>@` written by `resolveSyncAuthor` is still unique
       to this device, so the re-author also matches it.
   - *Rejected:*
     - Keeping `local`: it would misattribute.
     - Reusing `deviceId` as the author id: it contradicts the settled decision
       for one field's saving.
     - Also matching the legacy `local@` in the re-author: it would bring back
       the misattribution. Only pre-launch development data carries it.
3. **The Worker resolves the identity. Views send no author id.**
   - *Why:*
     - The note retires `LOCAL_IDENTITY`.
     - A view that kept sending `{ id: 'local' }` would author a signed-in
       save locally.
     - Seventeen copies of one constant are seventeen chances to miss the
       switch. The Worker owns the data (DIRECTION §3.7).
   - *Rejected:* the view reading the account from `AppShell` state and passing
     it on each command. It is lost on reload (sign_in Decision 6 keeps
     `Account` in memory only), and it splits identity across threads.
4. **The re-author rewrites the unpushed set from the first local-authored
   commit, and keeps foreign authors.**
   - *Why:*
     - DIRECTION §3.3 replaces the local id "in the saves not yet pushed".
       Pushed history is shared and cannot be rewritten.
     - A foreign commit above a rewritten one must be re-hashed, but its
       author is someone else's.
   - *Rejected:*
     - Rewriting with an `amend`-style replay through the working copy. It
       would touch files and the index, against Constraint 5.
     - A `git replace` / mailmap overlay. A pushed object would still carry
       the local address, which is the very thing §3.3 forbids.
5. **It runs inside `attachHome`, before the home sync.**
   - *Why:* it is the one step every sign-in passes through, it comes before
     the first push, and its start-time retry (new_device Decision 1) covers
     an interrupted sign-in for free.
   - *Rejected:* running it in the view's `onSignedIn` as a separate command.
     It could race the attach's push.
6. **Sign-out reverts going forward and rewrites nothing back.**
   - *Why:*
     - sign_out Constraint 4 carries the history untouched.
     - Account-authored commits in a kept-as-local book are truthful, since
       the account made them.
     - Rewriting back would re-hash commits that may already be pushed.
   - *Rejected:* a symmetric re-author to the local id. It is a history
     rewrite with no promise asking for it.
7. **History's *you* is a Worker flag, `author.self`.**
   - *Why:*
     - Only the Worker knows the account and local addresses (Decision 1).
     - The view keeps the name fallback that workflow 6 names.
     - `history-view.js` stays a pure function.
   - *Rejected:* exposing the addresses in the READY view for the view to
     compare. It leaks device ids to the main thread for no gain.
   - `BookHistory.jsx`'s name-only rows are unchanged (no *you* there today).

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- Worker author resolver in `app/src/worker/author.js`: `meta.accountId` else a random per-device `meta.localAuthorId`, never `local` or the device id; resolved inside the book lock in `app/src/worker/logic.js` so a racing save is the account's.
- New `app/src/worker/reauthor.js`: pure planner plus the chain rewrite of each book's unpushed commits (compare-and-swap on `main`; foreign authors, trees and the working copy kept), run from `ATTACH_HOME { accountId }` before the home sync; `SIGN_OUT` clears the id first and rewrites nothing back (`logic.js`, `protocol.js`).
- History entries carry `author.self` (`app/src/worker/history.js`); `isYou` in `app/src/songs/history-view.js` reads it and keeps the name fallback; `LOCAL_NO_REPLY` removed.
- All 17 `LOCAL_IDENTITY` copies and SaveSheet's `LOCAL_ID` removed from the views under `app/src/{shell,songs,books,account,files,music,instruments}/`; `AppShell.jsx` sends the account id on sign-in.
- Unit: `app/src/worker/reauthor.test.js`, `author.test.js`, `app/src/songs/history-view.test.js`.
- Behavior: `app/src/worker/commit-author.behavior.test.js` (5 cases); existing Worker and view suites updated for the retired `local` id.
- e2e-web: `e2e/web/tests/commit-author.spec.js` with the `pushedAuthorEmails` helper in `e2e/web/lib/journeys-account.js`.
- Tech-debt follow-up: none.

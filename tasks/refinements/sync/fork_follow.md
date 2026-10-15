# sync.fork_follow — Following an original

## TaskJuggler

[`tasks/45-sync.tji:63`](../../45-sync.tji) — `task fork_follow "Following an
original"`, under `task sync`. `effort 2d`, `allocate team`, `depends !engine,
service.books`. Through the parent `task sync` it also inherits
`storage.working_copy`, `cifra_js.merge` and `foundation.e2e_api`.

The `.tji` note:

> The original's new saves counted; bring them in through the preview; the
> original going away. Workflow 11. Tests: behavior (the original's new saves
> counted, brought in through the preview, the original gone — against local
> remotes); e2e-api (fork on the stack, push to the original, the fork's
> device counts and brings in the new save).

Downstream, `books.fork` ("Make it my own", [`tasks/65-books.tji:44`](../../65-books.tji))
depends on this task and consumes the interface settled under Decisions
(§The interface `books.fork` consumes).

## Effort estimate

**2d.** About half a day on the service (the change check's fork fields, one
store method, one migration) and a day and a half in the Worker (the change
check's new fields, the follow facts, the shelf's `original` register, the
bring-in preview and merge — built on the upload task's merge path, not a new
one). No screen: the views are `books.fork`'s and the deferred
`books.bring_in`'s.

## Repository

Not under `cifra.md/`. The work lands in:

- `service/internal/server/shelf.go`, `shelf_test.go` — the change check
  answers a fork's `originalNewSaves` / `originalGone`.
- `service/internal/book/book.go`, `book_test.go` — `Store.CountNewSaves`.
- `service/internal/server/books.go` — the fork insert sets `is_fork`.
- `service/internal/db/migrations/0006_fork_flag.sql` (new).
- `api/openapi.yaml` — wording only (the fields already exist; see Inputs).
- `app/src/worker/change-check-client.js` (+ test), `sync-engine.js` (+ unit
  test), `reducer.js` (+ test), `protocol.js`, `logic.js`, `upload.js`,
  `bring-in.js` (new, + behavior test).
- `docs/home-book-format.md` §4.2 — the `original` register (and the `role`
  register the code already writes).
- `e2e/api/fork-follow.test.js` (new).

## Inherited dependencies

Settled:

- `sync.engine` (complete) — the pass, the change check first, the
  per-book lock, `captureDirtyWork` / `reapplyDirtyWork`, the push retry.
- `service.books` (complete) — `POST /api/books/{bookId}/fork`, the copy on
  the volume, `books.original_book_id`.
- `sync.upload` (complete, not a `depends` but on disk) — the preview model
  and `mergeInto`, which this task reuses.
- `sync.lost_access` (complete) — `isAccessRefused` / `takenDownReason`,
  "a 404 is lost access; a 403 is not".
- `service.change_check` (complete) — the endpoint this task extends.
- `foundation.e2e_api` (complete) — the harness.

Pending: none.

## What this task is

A fork follows its original (workflow 11 §Following the original). This task
makes the device **know** three things and **do** one:

1. **Count.** On every sync pass the change check tells the device, for each
   fork on its shelf, how many saves its original has that the fork does not
   (*Ana's Choros has 3 new saves*).
2. **Preview.** On request the Worker fetches the original and builds the
   same song-by-song preview an upload does (workflow 7), writing nothing to
   the fork.
3. **Bring in.** On confirmation it merges the original into the fork,
   commits with the user's note, and pushes; conflicts go to workflow 9.
4. **The original going away.** Removed from the original, the original
   deleted, taken down, or its owner's account deleted: the device learns it,
   records it durably, and following ends. The fork is untouched and syncs on.

The views — the shelf line, the preview screen, the *original is no longer
shared with you* badge and notice — are not here (see Acceptance criteria,
deferred work and Decisions).

## Why it needs to be done

Workflow 11 is the teacher–student loop (DIRECTION §2, `docs/DIRECTION.md:44`):
the student's copy is only useful if the teacher's corrections keep arriving.
`books.fork` cannot be refined or built without knowing what a fork's shelf
entry holds, where the count comes from and what happens when the original
refuses access; this task settles all three. The change-check contract
already carries the fork fields (`api/openapi.yaml:1222-1245`) and the service
deliberately left them unset for this task (`service/internal/server/shelf.go:60-69`).

## Inputs / context

- **Workflow 11** `docs/workflows/11-fork.md`:
  - :17-21 — a fork remembers its book as its **original**.
  - :23-26 — the fork replaces the original on the shelf (that is
    `books.fork`'s).
  - :37-38 — a fork of a fork follows one step only.
  - :42-49 — bringing in is never automatic; the shelf says *Ana's Choros has
    3 new saves*; *Bring them in* shows the upload preview song by song;
    confirming merges, commits and pushes; conflicts go to workflow 9.
  - :51-54 — when the original goes away the fork is untouched, keeps the
    history up to the last follow, says *the original is no longer shared
    with you*; following ends, nothing else does.
  - :58-59 — the original's owner is told nothing.
- **Board** `docs/mockups/W11-fork.dc.html`:
  - :78-82 — the shelf entry *from Ana's Choros*, *Ana's Choros has 3 new
    saves.*, **Bring them in**.
  - :102-135 — the preview: "3 new saves in Ana's Choros since you last
    brought them in. Nothing is written … until you confirm", rows per song
    with a diff and a state badge, a **Note** prefilled "Bring in Ana's
    changes: Carinhoso, Lamentos, …", a conflict notice, **Not now** /
    **Bring them in**, "Merges into your copy, saves, and sends it to
    Estante."
  - :153, :169 — badge *original no longer shared*; notice "This book stops
    following Ana's Choros; it was last brought in on 28 September. Nothing
    else changes".
- **Workflow 8** `docs/workflows/08-sync.md:66-69` — a refusal for not being a
  member makes the *book itself* gone. **Workflow 10** :83-85 — an editor
  lowered to reader with unpushed saves (the permanent-403 question, see
  Decisions).
- **DIRECTION** `docs/DIRECTION.md:213` (forks are copies on the volume),
  §3.3 the change check (one batched request, a fetch only for a book that
  moved), §3.4 sizing.
- **Contract** `api/openapi.yaml`:
  - :411-433 `forkBook`; :1137-1148 `Original {bookId, title?}` ("as the fork
    last knew it"); :1150-1172 `Book.original`.
  - :440-470 `changeCheck`: "a fork whose original advanced (a new-saves
    count or a gone signal)"; :1222-1245 `ShelfBookChange` with `status`
    `changed|unchanged|gone`, `originalNewSaves` (integer ≥ 1),
    `originalGone` (boolean).
- **Service**:
  - `service/internal/server/shelf.go:60-69` — `shelfBookChange` lacks the
    fork fields; :128-173 — access resolution and the per-book loop;
    :182-217 — `accessibleBooks` (the `resolveBookAccess` predicate over
    `id = ANY`).
  - `service/internal/server/books.go:312-441` — `handleForkBook`; :399-400
    the insert with `original_book_id`; :66-68 `gitURL(base, id)` =
    `<base>/git/<id>`.
  - `service/internal/db/migrations/0001_registry.sql:75-86` —
    `original_book_id … REFERENCES books (id) ON DELETE SET NULL`.
  - `service/internal/server/account.go:20-27`,
    `account_test.go:32-40,132-136` — account deletion nulls a fork's
    original (asserted; this task keeps it).
  - `service/internal/server/books.go:291,305` — book delete is a soft
    delete (`deleted_at`), so `original_book_id` survives it.
  - `service/internal/server/git.go:199-238` — a fetch by a non-member, of a
    deleted or nonexistent book, is **404**; the only fetch 403 is
    `taken_down` (:229-233); a reader may fetch, a reader's push is 403
    (:274-276).
  - `service/internal/book/book.go:124-138` — `ResolveHead`, the shape the
    new store method follows.
- **Worker** (`app/src/worker/`):
  - `change-check-client.js:22,37,76-81` — posts the shelf, keeps only
    `changed` / `gone`.
  - `sync-engine.js:237` `createSyncEngine`, :780-815 `pass` (one change
    check :795, unreachable → `news=null` :798), :621 `syncSongbook`,
    :669 `locks.withLock`, :150/:186 dirty capture/reapply, :526
    `pushWithRetry`, :631-654 change-check `gone`, :694/:607 a 404 on
    fetch/push.
  - `access-refused.js:39` `isAccessRefused` (404), :65 `takenDownReason`.
  - `upload.js:141` `createUpload`, :450 `previewMerge(dir, baseOid,
    oursOid, theirsOid)`, :597 the preview model, :682 `mergeInto` (merges
    `refs/upload/<id>`, reapplies dirty work, pushes best-effort), :789
    `import_`, :846 `incomingRefFor` (the conflict hand-off;
    `conflicts.js:136,151,303`).
  - `git.js:54` fixes `remote:'origin', ref:'main', singleBranch:true`;
    `git-http.js:94` the cookie auth.
  - `logic.js:820-840` — the shelf entry registers written in `shelf.json`
    (`label`, `link`, `position`, `role`); :959 the command switch.
  - `protocol.js:28` `CommandKind`, :149 `FORK_BOOK` (no handler —
    `books.fork`'s), :383 `EventKind`, :355-357/:606 the upload commands and
    `UPLOAD_PREVIEW`.
  - `reducer.js:487-499` — the `sync` slice.
  - `books-client.js:44-45` — `Book.gitUrl`, `Book.original`.
- **Home book** `docs/home-book-format.md:216-245` §4.2 `shelf.json` —
  registers per shared book.
- **Tests on disk**: `app/src/worker/sync-engine.behavior.test.js` (helpers
  `advanceRemote`, `makeDeviceB(remote, bookId, {fetch})` — an injectable
  `fetch`), `app/test/git-http-remote.js:170` `startGitHttpRemote`,
  `upload.behavior.test.js`; `service/internal/server/shelf_test.go:90-270`;
  `e2e/api/sync.test.js` (`registerNewAccount`, `createBook`,
  `gitEndpoint`, `cifraAwareMerge`, `IsoGit` from `e2e/api/lib/git.js:147`),
  `e2e/api/books.test.js:46-88` (fork over HTTP).
- **Predecessor refinements**: `tasks/refinements/sync/engine.md` (facts in
  an in-memory reducer slice, no IndexedDB store), `sync/lost_access.md`
  (:352-361 "a 404 is lost access; a 403 is not"; :386-398 the reader-push
  403 left to `books.fork`), `sync/upload.md` (Decision 4, the preview model;
  Decision 9, the view is `books.upload_ui`'s), `service/books.md`.

## Constraints / requirements

1. **Never automatic** (workflow 11:42-44). A pass only counts. Nothing
   fetches the original, and nothing merges it, until the user asks for the
   preview; nothing is written to the fork until they confirm.
2. **The fork itself syncs as any book.** Nothing about the original — its
   count, its refusal, its absence — changes the fork's own phase. A refusal
   from the **original** never marks the **fork** `gone` (the engine's
   lost-access path is the fork's own URL only).
3. **One request per pass** (DIRECTION §3.3). The count rides on the existing
   change check; no per-fork request, no fetch of the original during a pass.
4. **Never confirm a private book exists** (`api/openapi.yaml:447-451`). The
   fork fields are reported only on a book the caller can access, and only
   for the original the service recorded at fork time; `originalGone`
   answers alike for a removed member, a deleted, taken-down or hard-deleted
   original.
5. **One step only** (workflow 11:37-38). A fork's original is the book it
   was forked from; a fork of a fork never reports its grand-original.
6. **Offline first.** The count and the gone signal are learned when there is
   a network; the bring-in needs one (it fetches) and says so plainly when
   there is none, changing nothing. Unsaved edits survive a bring-in exactly
   as they survive a sync (`captureDirtyWork` / `reapplyDirtyWork`).
7. **Canonical form.** The bring-in merge is the cifra-aware merge
   (`cifra_js.merge`) the engine and the upload use; a marked text is never
   committed or pushed — a conflict halts to workflow 9.
8. **The owner is told nothing** (workflow 11:58-59): no notice, no log line
   naming the forker.
9. **No song text in logs.** The service's new code logs nothing about the
   books; counts are not logged with titles.
10. **The Worker owns git and the home book**; the main thread only sends
    commands and reads facts.
11. **No shared code** between app and service; the contract is the seam.

## Acceptance criteria

The task delivers:

1. **Service — the change check answers a fork's original.** For each
   accessible requested book whose row has `is_fork = true`:
   - original recorded and accessible to the caller (the `accessibleBooks`
     predicate), both heads present, and
     `n = Store.CountNewSaves(original, fork) > 0` → the entry carries
     `originalNewSaves: n`, with `status` `changed` (and `head`) if the fork
     itself moved, else `unchanged`;
   - original recorded but **not** accessible (removed member, soft-deleted,
     taken down), or `original_book_id` NULL (its owner's account deleted) →
     `originalGone: true`, with `status` as above;
   - otherwise as today (omitted when the fork is in step).
   An inaccessible fork is answered exactly as today (`gone` / omitted) and
   carries no fork field.
2. **Service — the count.** `book.Store.CountNewSaves(ctx, originalID, forkID)
   (int, error)`: the number of **non-merge** commits reachable from the
   original's `refs/heads/main` and not from the fork's, computed read-only by
   `git --git-dir <original> rev-list --count --no-merges <origHead> --not
   <forkHead>` with `GIT_ALTERNATE_OBJECT_DIRECTORIES=<fork>/objects`; 0 when
   either main is absent. Nothing is written to either repository.
3. **Service — `is_fork`.** Migration `0006_fork_flag.sql`: `ALTER TABLE books
   ADD COLUMN is_fork boolean NOT NULL DEFAULT false; UPDATE books SET is_fork
   = true WHERE original_book_id IS NOT NULL;`. `handleForkBook` sets it. The
   `ON DELETE SET NULL` is kept (account deletion's contract and
   `account_test.go:132-136` stand).
4. **Contract.** `api/openapi.yaml` `ShelfBookChange.originalNewSaves`
   description sharpened to "saves (non-merge commits) on the original's main
   not yet in the fork's", `originalGone` to name the four causes. No shape
   change.
5. **Worker — the change check client** keeps `unchanged` entries and passes
   `originalNewSaves` / `originalGone` through on every entry.
6. **Worker — the follow facts.** After each change check the engine emits,
   for **every** shelf book whose shelf entry has an `original` register and
   no `goneAt`, `EventKind.ORIGINAL { bookId, newSaves, gone }` (0 / false
   when the change check reported nothing — so a count clears after a
   bring-in), into a new reducer slice `originals[bookId]`. An unreachable
   change check (`news=null`) emits nothing (the last facts stand). On
   `originalGone` the Worker also writes `goneAt` into the `original`
   register (durable, below) and emits `{gone: true}`; from then on the
   engine ignores any `originalNewSaves` for that book.
7. **Worker — the shelf's `original` register.** `shelf.json`
   `books[<forkId>].original` is one register whose value is `{ bookId,
   title, link, followedAt, goneAt? }` (`link` the original's clone URL,
   `followedAt` the ISO time of the fork or the last bring-in). Written by
   `logic.js` `recordOriginal({ bookId, original })` — `books.fork` calls it
   when it makes a fork; this task calls it on a bring-in (new
   `followedAt`) and on gone (`goneAt`). `surfaceShelf` projects it.
   `docs/home-book-format.md` §4.2 documents `original` (and the `role`
   register the code already writes) in the same commit.
8. **Worker — the preview.** `CommandKind.PREVIEW_BRING_IN { bookId }` →
   under the book's lock, fetch the original's `link` (cookie auth, as every
   fetch) into `refs/remotes/original/main`, then `previewMerge(dir, base,
   main, originalHead)` → `EventKind.BRING_IN_PREVIEW { bookId, followId,
   original: {bookId, title}, newSaves, previews }`, `previews` the upload's
   row shape `{path, title, status, changes?, summary?, line?}`. `newSaves`
   counted locally the same way as the service (non-merge commits on
   `original/main` not on `main`). The fork's `main`, working tree and
   remote are untouched.
9. **Worker — the bring-in.** `CommandKind.BRING_IN { bookId, followId, note }`
   → the shared merge path (below) merges `refs/remotes/original/main` into
   `main` as a merge commit (no fast-forward) with `note` as its message and
   the user's identity, reapplies unsaved edits, pushes to the fork's own
   remote, writes `followedAt`, and replies `EventKind.BRING_IN_DONE {
   bookId, kind: 'merged', pushed }` or `{ kind: 'needs_you' }` — the
   conflict handed to workflow 9 with `incomingRef =
   refs/remotes/original/main`. `CommandKind.CANCEL_BRING_IN { followId }`
   drops the fetched ref. A `followId` that no longer matches (a second
   preview, a pass that moved `main`) is refused with `{ kind: 'stale' }`.
10. **Worker — the shared merge path.** `upload.js`'s `previewMerge` and
    `mergeInto` move to `app/src/worker/bring-in.js`, `mergeInto` taking the
    theirs **ref name** (not an upload id) and a `fastForward` flag; the
    upload calls them unchanged in behavior; `incomingRefFor` learns
    `refs/remotes/original/main`. No second merge implementation.
11. **Worker — the original refusing access.** A preview's fetch of the
    original that is refused — `isAccessRefused` (404: removed, deleted, or
    a stranger) or `takenDownReason` (403 taken_down) — records `goneAt`,
    emits `ORIGINAL {gone: true}` and replies `BRING_IN_PREVIEW { bookId,
    gone: true }`. It does **not** touch the fork's phase. Any other failure
    (offline, 5xx) replies `{ bookId, error: 'unreachable' }` and records
    nothing.

### Tests it lands with

- **unit** — `service/internal/book/book_test.go`
  `TestCountNewSaves`: a fork made by `Store.Fork`, two commits and one merge
  commit on the original → 2; after the fork merges them → 0; an empty
  original → 0; neither repository's refs or objects change (pins
  workflow 11:46, Constraint 3 and AC2).
- **behavior** — `service/internal/server/shelf_test.go` (httptest against
  Postgres and real git on a temporary volume):
  - `TestChangeCheckForkOriginalNewSaves` — a fork in step with an original
    that advanced two saves → `{status: unchanged, originalNewSaves: 2}`; the
    fork moved too → `changed` with `head` and the count; after the fork's
    main includes them → omitted (workflow 11:46-48).
  - `TestChangeCheckForkOriginalGone` — the caller removed from the
    original, the original soft-deleted, taken down, and
    `original_book_id` nulled → `originalGone: true` each time, the fork
    itself not `gone` (workflow 11:51-54, Constraint 4).
  - `TestChangeCheckForkOfForkOneStep` — a fork of a fork reports only its
    own original's saves (workflow 11:37-38).
  - `TestChangeCheckNotAFork` — a plain book never carries a fork field;
    an inaccessible fork answers `gone` with no fork field (Constraint 4).
- **unit** — `app/src/worker/change-check-client.test.js`: `unchanged`
  entries kept, `originalNewSaves` / `originalGone` passed through (AC5).
- **unit** — `app/src/worker/sync-engine.test.js`: a pass emits `ORIGINAL`
  for each followed fork — the count, 0 when absent, `gone` on
  `originalGone` with `recordOriginal` called with `goneAt`; nothing after
  `goneAt`; nothing when the change check is unreachable; the fork's own
  phase unaffected by any of it (AC6, Constraint 2).
- **unit** — `app/src/worker/reducer.test.js`: the `originals` slice
  (AC6).
- **behavior** — `app/src/worker/bring-in.behavior.test.js` (fake IndexedDB,
  two `startGitHttpRemote` remotes — the original, and the fork seeded from
  it — and the device's working copy of the fork):
  - *counted* — the engine's pass with the change check reporting
    `originalNewSaves` emits the fact; with `originalGone`, writes `goneAt`
    to the shelf register and the fork still fetches and pushes its own
    saves (workflow 11:46, :51-54).
  - *brought in through the preview* — the original advances a changed and an
    added song; `PREVIEW_BRING_IN` returns both rows (`changed`, `added`) and
    `newSaves: 2`, and the fork's `main` and remote are unchanged;
    `BRING_IN` with a note makes one merge commit carrying the note, pushes
    it to the fork's remote, and moves `followedAt`; an unsaved edit in the
    working copy is still unsaved on top (workflow 11:47-48, Constraint 6).
  - *a conflict* — the fork and the original change the same bar;
    the preview row is `conflict`; `BRING_IN` → `needs_you` with nothing
    pushed and the conflict's incoming ref `refs/remotes/original/main`
    (workflow 11:48-49, workflow 9).
  - *the original gone* — the original's fetch answered 404, and separately
    403 `taken_down`, through the device's injected `fetch`: `{gone: true}`,
    `goneAt` recorded, the fork's phase not `gone`, its commits and working
    copy untouched; a refused connection (the original remote stopped) →
    `unreachable`, nothing recorded (AC11, workflow 11:51-54).
  - *stale* — a `BRING_IN` after a second preview → `stale`, nothing
    merged (AC9).
- **behavior** — `app/src/worker/upload.behavior.test.js` (existing, run
  unchanged): the upload's merge still behaves after the move to
  `bring-in.js` (AC10).
- **e2e-api** — `e2e/api/fork-follow.test.js` against the compose stack,
  two accounts by passkey (`registerNewAccount`), IsoGit devices:
  - *counts and brings in* — Ana creates *Choros de Teste* and pushes a song
    written for the test; she invites Bia as reader (`createInvitation` /
    accept, as `account.test.js` does); Bia forks it
    (`POST /api/books/{id}/fork`) and clones the fork; the change check
    reports nothing for the fork; Ana pushes a new save to the original; Bia's
    change check reports `{status: unchanged, originalNewSaves: 1}`; Bia
    fetches the original with her cookie, merges it with
    `cifraAwareMerge` and pushes to the fork; the change check reports
    nothing again (workflow 11:42-49).
  - *the original gone* — Ana removes Bia
    (`DELETE /api/books/{id}/members/{userId}`): Bia's change check reports
    the fork with `originalGone: true` (not `gone`), her fetch of the
    original is 404, and she still pushes to her fork; Ana deletes the
    original in a second run: `originalGone: true` again (workflow
    11:51-54).

The view work is **deferred to `books.bring_in`** (closer registers in WBS):
"Bring them in, as drawn" — `effort 2d`, not a `cifra.md:` task, `depends
books.fork, sync.fork_follow, books.upload_ui`, milestone `m4_together`
(whose note already promises "forks following their original"). Note: "The
*Bring in Ana's saves* screen (W11 board :102-135): N new saves since you
last brought them in, the preview rows reusing the upload preview's, the
prefilled note, the conflict notice, Not now / Bring them in, consuming
`PREVIEW_BRING_IN` / `BRING_IN` / `CANCEL_BRING_IN`; the *original is no
longer shared with you* notice on the book with its last brought-in date
(:169), and the offline reply said plainly. Workflow 11. Tests: behavior (the
preview screen and the notice with Testing Library and axe, keyboard paths
through Not now and Bring them in, stale and unreachable replies); e2e-web
(Ana's account pushes a new save to a book Bia forked, Bia brings it in on
phone, tablet and computer; Bia removed from the original sees the notice;
axe, mockup W11#2-3)." The shelf's *from …* line, *… has N new saves* line
and *original no longer shared* badge are `books.fork`'s (its note already
asserts "a new save of the original counted").

## Decisions

- **The count is the service's, on the change check.** *Chosen:* fill the
  contract's existing `originalNewSaves` from the service, which holds both
  repositories on one volume. *Rejected:* the device fetching every
  original on every pass and counting locally — one extra fetch per fork per
  pass against DIRECTION §3.3's one request per pass, and wasted bandwidth
  for a number. *Rationale:* the contract already says so
  (`api/openapi.yaml:447-449`); the cost is one ref read and one `rev-list`
  per fork per pass.
- **A save is a non-merge commit.** *Chosen:* `--no-merges`. *Rejected:*
  counting every commit — the original's own sync merges between its members
  would inflate "3 new saves" with commits no one made by saving.
  *Rationale:* workflow 4 makes one save one commit; merges are sync's.
- **Counted against the fork's head on the service.** *Chosen:* the fork's
  pushed `main`. *Rejected:* the device's head — the original would then need
  the device's unpushed objects. *Rationale:* a bring-in pushes at once
  (workflow 11:48), so the count clears on the next pass; offline it stays,
  which is true — the fork on Estante does not have them yet.
- **`is_fork` keeps a fork a fork when its original's row is gone.**
  *Chosen:* a new boolean column. *Rejected:* (a) dropping the `ON DELETE SET
  NULL` foreign key so the id dangles — changes account deletion's settled
  contract and `account_test.go`; (b) the device declaring its original in
  the change-check request — makes a client assertion the authority over the
  service's record and changes the request shape. *Rationale:* the smallest
  change that lets the service answer `originalGone` for a hard-deleted
  original, the one cause it otherwise cannot see.
- **The original refusing access ends following; it never touches the fork
  (the permanent-refusal answer `books.fork` asked for).** *Chosen:* every
  definite refusal from the original — the change check's `originalGone`, a
  404 or a 403 `taken_down` on fetching it — is final: `goneAt` is written to
  the shelf register (durable, synced to the account's other devices), the
  device stops counting and offers no bring-in, and the fork keeps its phase
  and its sync. Offline or a 5xx is never a refusal. A reader fetching the
  original is never refused (`git.go:274-276` refuses only a reader's
  push), so the original can answer 403 only for a take-down. *Rejected:*
  re-deriving gone each pass (as `sync.lost_access` does for a book) — the
  service would stop reporting it if the user were re-invited, silently
  resuming a following workflow 11:54 says has ended, and the notice's
  "last brought in on …" needs a stored date anyway. *Rationale:* workflow
  11:51-54 "following ends; nothing else does".
- **The fork's own permanent 403 (an editor lowered to reader with saves not
  yet pushed) is `books.fork`'s, not this task's.** It concerns the fork's
  *source* book before it is a fork, not a fork following its original; the
  engine's push path is untouched here. For `books.fork`: it is that task's
  *saving where one cannot* way in — the engine should classify a push 403
  that is not `taken_down` as permanent (no retry, the book read-only with
  its saves kept), and the surface offers *make this book your own* or the
  download (workflow 10:83-85), the fork carrying those saves over as
  workflow 11:23-24 carries a working copy.
- **The original lives on the shelf entry, one register.** *Chosen:*
  `shelf.json` `books[<forkId>].original = {bookId, title, link, followedAt,
  goneAt?}`. *Rejected:* reading it from `GET /api/books` each time — the
  service drops `original.title` once the original is gone
  (`books.go:223`), yet the board still says *from Ana's Choros* and "last
  brought in on 28 September"; and the Worker would need a network round-trip
  to fetch. *Rationale:* the home book is where per-account shelf state
  already lives, synced across devices; one register is written whole (no
  half-updated original), last-writer-wins like the others.
- **The bring-in is the upload's merge, moved, not copied.** *Chosen:*
  extract `previewMerge` / `mergeInto` into `bring-in.js`, parameterised by
  the theirs ref. *Rejected:* a fork-specific merge — two merge paths that
  would drift. *Rationale:* workflow 11:47 says "the same preview an upload
  does"; `books.bring_in` can reuse the upload preview's rows for the same
  reason.
- **A merge commit, never a fast-forward.** *Chosen:* `fastForward: false`.
  *Rejected:* fast-forwarding when the fork has no saves of its own — the
  user's note (board :125-128) would be lost and history would not show where
  the original came in. *Rationale:* the board's note is the commit message.
- **The original is fetched into `refs/remotes/original/main`**, by URL,
  without a configured `original` remote, so the engine's `origin`-only
  layer (`git.js:54`) and `defaultListBooks` are unaffected.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-15.

- Service: `service/internal/db/migrations/0006_fork_flag.sql` (fork flag), `service/internal/book/book.go` (new-saves count, non-merge commits), `service/internal/server/shelf.go` and `books.go` (change check fills `originalNewSaves` / `originalGone`; `is_fork` covers a hard-deleted original); `api/openapi.yaml` wording; `docs/home-book-format.md` §4.2 `original` and `role` registers.
- Worker: `app/src/worker/bring-in.js` (preview and bring-in via the upload's merge path, moved out of `upload.js`; conflict hand-off `incomingRefFor` chained in `logic.js`), `change-check-client.js`, `sync-engine.js` (ORIGINAL facts), `reducer.js` (originals slice), `git.js` (`fetchOriginal`), `protocol.js`, `upload.js`.
- Deviations: the bring-in preview passes `incomingOnly`; a bring-in that pushed emits `ORIGINAL {newSaves: 0}` at once.
- Tests: `service/internal/book/book_test.go`, `service/internal/server/shelf_test.go` (new saves, gone, fork-of-fork, not a fork); `app/src/worker/bring-in.behavior.test.js`, `change-check-client.test.js`, `sync-engine.test.js`, `reducer.test.js`, `shelf.test.js`; `e2e/api/fork-follow.test.js`.
- Follow-up registered: `books.bring_in` (tasks/65-books.tji, gated by `m4_together`). The permanent push 403 for an editor lowered to reader stays with `books.fork`, per its note.

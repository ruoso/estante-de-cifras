# books.put_online_no_ghosts — Putting a book online leaves no ghost behind

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji) — `books.put_online_no_ghosts`
("Putting a book online leaves no ghost behind", L248), in milestone
`milestones.m3_service` (`tasks/99-milestones.tji:32`).

## Effort estimate

0.5d.

## Repository

The work happens in this repository, outside `cifra.md/`. The note does not start with `cifra.md:`.

- `app/src/worker/reducer.js` — the `INDEX_STATUS` case (L389-411).
- `app/src/worker/recents.js` — two pure list moves and two store operations.
- `app/src/worker/logic.js` — PUT_ONLINE, FORK_BOOK, `removeFromShelf`, DELETE_BOOK, SIGN_OUT, LEAVE_ESTANTE and the OPEN bring-up (`surfaceRecents`).
- Tests:
  - `app/src/worker/reducer.test.js`
  - `app/src/worker/recents.test.js`
  - `app/src/worker/online.behavior.test.js`
  - `app/src/worker/recents.behavior.test.js`
  - `e2e/web/tests/online.spec.js`
- Design delta: `docs/workflows/02-find-and-play.md` (§Before typing, the recents paragraph, L29-35).

No view, protocol, locale, service or API change.

## Inherited dependencies

All of them are settled.

- `books.online` (`complete 100`, `tasks/refinements/books/online.md`) built PUT_ONLINE. Its Decision 3 says that putting a book online adopts the service id as the book's on-device id: the working copy moves from `bookDir(localId)` to `bookDir(serviceId)`. That id change is what leaves the ghosts behind.
- `songs.no_raw_ids` (`complete 100`, `tasks/refinements/songs/no_raw_ids.md`) made a book with no shelf label read *Untitled book* instead of its id. That is why the ghost now shows as *Untitled book* rather than `local-my-songs`. Its Decision 3 is to heal at OPEN rather than in every writer. This task follows that pattern for recents left over from before the fix.
- Already complete and relied on, though not in `depends`:
  - `books.online_reindex` moved the search entries to the new id. It added the `INDEX_STATUS {state: null}` post this task makes the reducer honour.
  - `songs.unsaved_after_discard` added `dropRecents` and `forgetRemovedRecents`, which forget the recents of a removed song.
  - `books.fork` re-points the in-memory recents on `BOOK_FORKED` (reducer L593-628) but does not persist the change.

## What this task is

After *Put online* on a local book, two things go wrong:

- Search lists an extra *Untitled book* with 0 songs, which the Books tab does not show.
- Recent shows *Untitled song · Untitled book*, which opens a dead `/b/local-…/…` address. Unlike the extra section, this one survives a reload.

The task fixes both, together with the same faults on every other path where a book changes id or leaves the device:

1. A `null` `INDEX_STATUS` removes the book from the store's `index` slice.
2. A book that changes id moves its recents to the new id: PUT_ONLINE, and FORK_BOOK too.
3. A book that leaves the shelf drops its recents: remove, leave, delete, sign out with remove, leave Estante, and the retirement of a *My songs* merge.
4. At OPEN, any recent that names a book this device no longer holds is dropped. This cleans up the ghosts that devices already carry.

## Why it needs to be done

The persona exploration on 2026-10-20 found these ghosts. Guitar-teacher agents drove the app with playwright-cli on a local stack, and the findings were checked live and against the code.

- **The extra book in Search.** PUT_ONLINE posts `INDEX_STATUS {bookId: localId, state: null}` (`app/src/worker/logic.js:2679`). The reducer stores the `null` under `index[localId]` and only deletes the song count (`app/src/worker/reducer.js:389-411`). `SearchScreen` lists one book section for every key of `index` (`app/src/songs/SearchScreen.jsx:579`). So the old id comes back as a section, and `resolveBookLabel` names it *Untitled book*.
  - The same `null` is posted when a book leaves: `removeFromShelf` L1183, FORK_BOOK L2796, DELETE_BOOK L2890, SIGN_OUT L3034, LEAVE_ESTANTE L3085.
  - A reload clears this one, because `index` starts as `{}` (reducer L80).
- **The dead recent.** Recents are stored as `{bookId, path, at}` in the Worker's `meta` store (`app/src/worker/recents.js:24`), and nothing re-keys them or drops them by book.
  - After the put-online, the recent still names `localId`. `songByLocation` finds no song for it (SearchScreen L558-567), so the row reads *Untitled song*, the book label reads *Untitled book*, and the address built from it is `/b/<localId>/<path>`.
  - This one survives a reload.

Workflow 2 §Before typing (`docs/workflows/02-find-and-play.md:13-14`) says recents are "the way back into what you were playing". A way back to a book that is not there is not one. Workflow 2 L233-234 also says a book's internal id is never shown, and the dead address shows it in the URL. `milestones.m3_service` waits on this task.

## Inputs / context

- **Workflows**
  - `docs/workflows/02-find-and-play.md`:
    - L13-14 — recents are the way back, and books are sections.
    - L29-35 — recents are kept on the device. This task's delta adds there that a recent follows its book.
    - L232-234 — *Untitled book*, and never an id.
  - `docs/workflows/07-add-a-book.md`:
    - L140-166 — §Putting a book online.
    - L252-264 — §Removing a book, and deleting one.
- **DIRECTION §3.7** — the Worker owns the working copy, the index and IndexedDB, and the main thread only reduces events. Recents live in the Worker's `meta` store, as DIRECTION §3.2 has device-local state.
- **Code**
  - `app/src/worker/reducer.js`:
    - L80 — `index: {}`.
    - L94-99 — the `recents` slice.
    - L389-411 — `INDEX_STATUS`. A `null` deletes `songCounts[bookId]` but writes `index[bookId] = null`.
    - L421-425 — `RECENTS` replaces the slice.
    - L593-628 — `BOOK_FORKED` re-points the in-memory recents.
  - `app/src/worker/recents.js`:
    - L24 — `RECENTS_META_KEY`.
    - L41 — `promoteRecent`.
    - L59 — `dropRecents`. It returns the same array when nothing matched.
    - `createRecents()` — `{read, record, forget}`, with writes serialized on `writeQueue`.
  - `app/src/worker/logic.js`:
    - L288-297 — `listBookIds(fs, homeBookId)`, the book directories on disk.
    - L952-960 — `forgetRemovedRecents`. Its comment says why recents are not hooked into `persistIndexChanges`: `removeBook` also runs for books that are only loading or re-keying.
    - L1155-1187 — `removeFromShelf`. REMOVE_BOOK and LEAVE_BOOK use it, as does the *My songs* merge retirement at L1567 and L2381.
    - L1600-1604 — `surfaceRecents`.
    - L1630-1645 — `handleOpen`, which calls `surfaceRecents` before `buildIndexes`.
    - L2273-2281 — RECORD_RECENT.
    - L2604-2692 — PUT_ONLINE: `localId` and `serviceId`; L2677-2680 drops the index, posts the null, then calls `indexOneBook(serviceId)`; `BOOK_ONLINE` at L2685.
    - L2693-2802 — FORK_BOOK.
    - L2861-2892 — DELETE_BOOK.
    - L2953-3036 — SIGN_OUT (`removedIds`).
    - L3038-3087 — LEAVE_ESTANTE.
  - `app/src/songs/SearchScreen.jsx`:
    - L558-567 — recent rows fall back to an empty title.
    - L569-585 — `bookIds`, the union of browse, `Object.keys(indexSlice)` and fill.
  - `app/src/shell/AppShell.jsx:672-707` — `followBookId` on `BOOK_ONLINE`, so the open song's address already follows. Only the recents do not.
  - Tests to extend:
    - `app/src/worker/reducer.test.js:309`
    - `app/src/worker/online.behavior.test.js` — helpers L63-176; `describe('reindex on put-online / remove / delete (books.online_reindex)')` L393, `seedIndexedLocalBook` L402, cases L414, L449, L477.
    - `app/src/worker/recents.behavior.test.js` — `setup` L41, `describe('recents (behavior)')` L76.
    - `e2e/web/tests/online.spec.js`
    - `e2e/web/lib/journeys.js` — `signedInDevice` L163, `makeLocalBook` L181, `putBookOnline` L210, `startApp` L26, `gotoTab` L33, `openSongFromSearch` L298.
    - `e2e/web/lib/journeys-share.js` — `songLines` L21, `writeSongInBook` L28.
    - `e2e/web/tests/search.spec.js:105-136`, for how the Recent region is asserted.

## Constraints / requirements

1. **The reducer drops the key.**
   - `INDEX_STATUS` with `state: null` (or missing) deletes `bookId` from `index`, as it already does from `songCounts`. When the key is absent it returns the slice unchanged.
   - Every other state is stored as before.
   - Readers of `indexSlice[id]` (`?? null`, `=== 'building'`) see no difference. `SearchScreen`'s key union no longer contains a book that has left.
2. **Recents move and drop by book, in the Worker.** `recents.js` gains:
   - `moveBookRecents(list, fromId, toId)`: every entry with `bookId === fromId` gets `toId`, and the order and `at` are kept. If an entry for the same `{toId, path}` is already in the list, the earlier entry (the more recent) is kept and the later one dropped.
   - `dropBookRecents(list, bookId)`.
   - Both return the same array when nothing matched, as `dropRecents` does.
   - `createRecents()` gains `moveBook(db, fromId, toId)` and `forgetBook(db, bookId)`. Each returns `{recents, changed}`, runs in one `meta` transaction, and is serialized on the existing `writeQueue`.
   - The main thread never touches IndexedDB. It learns the new list from the `RECENTS` event.
3. **Every id change moves recents; every leaving drops them.**
   - In PUT_ONLINE and FORK_BOOK, move `localId`/`bookId` to `serviceId`/`forkId` right after the `null` `INDEX_STATUS`, before `BOOK_ONLINE` / `BOOK_FORKED`. Post `RECENTS` when changed.
   - In `removeFromShelf`, DELETE_BOOK, SIGN_OUT and LEAVE_ESTANTE (for each removed id), drop that book's recents next to its `null` `INDEX_STATUS`. Post `RECENTS` once when changed.
   - Do not hook this into `persistIndexChanges` or `removeBook`, for the reason given at L952-960.
   - A small Worker helper, for example `retireBookRecents(bookId, toId?)`, keeps the six call sites one line each.
4. **Heal at OPEN.**
   - Before posting, `surfaceRecents` drops every recent whose `bookId` is not among `listBookIds(fs, HOME_BOOK_ID)`, and persists the list only when it changed.
   - This clears ghosts that devices made before this task.
   - Recents are only ever recorded for a song this device opened, so their book was on disk. An entry with no directory therefore names a book that has gone.
5. **Offline first, no network.** Moving and dropping recents is local, and adds no fetch or push.
6. **No song text in logs.** A recent is a location. Nothing new is logged.
7. **Accessibility.** No new UI. The Search screen's axe check runs with the fixed lists.

## Acceptance criteria

The behavior:

- After *Put online* on a local book holding a song that was saved and opened, Search lists no *Untitled book* section.
- Recent shows the song under its title and its book's name, and opening it lands on `/b/<serviceId>/<path>` with the song showing.
- The same holds after a reload.
- A book that is removed, left or deleted takes its recents and its Search section with it.
- A device that already holds a ghost recent loses it at its next start.

Tests, by level:

- **unit** — `app/src/worker/reducer.test.js`:
  - Extend L309 (*keeps a ready INDEX_STATUS song count… and drops it on a null status*) so it also asserts `'b1' in state.index === false` after the null. Today it only checks `songCounts`.
  - A new case, *a null INDEX_STATUS removes the book from the index slice (books.put_online_no_ghosts)*. It folds `building`, `ready` and then `null` for one book next to another ready book, and asserts `Object.keys(state.index)` is just the other book.
  - Pins workflow 2 L13-14 (each book on the shelf is a section, and only those).
- **unit** — `app/src/worker/recents.test.js`:
  - `moveBookRecents` re-keys only `fromId`'s entries and keeps the order and `at`.
  - `moveBookRecents` keeps the earlier entry when `{toId, path}` already exists.
  - `dropBookRecents` drops one book's entries.
  - Both return the same array when nothing matched.
  - Pins the workflow 2 L29-35 delta.
- **behavior** — `app/src/worker/online.behavior.test.js`, in `describe('reindex on put-online / remove / delete (books.online_reindex)')`:
  - *put-online moves the book's recents to the service id, persisted across a restart (books.put_online_no_ghosts)*:
    - `seedIndexedLocalBook`, then `RECORD_RECENT {bookId: localId, path}`, then `putOnline`.
    - Assert the last `RECENTS` before `BOOK_ONLINE` holds `{bookId: serviceId, path}` and nothing under `localId`.
    - Assert that `foldState(w.events).index` has no `localId` key.
    - Then start a second worker over the same `idb`/`fs` and send OPEN: its `RECENTS` names `serviceId`.
  - Tighten L414's `expect(index[localId] ?? null).toBeNull()` to `expect(localId in index).toBe(false)`.
  - *remove drops the book's recents and its index entry*: the L449 scenario plus a recorded recent. After REMOVE_BOOK, the last `RECENTS` holds nothing for the book, and the folded `index` has no key for it.
  - *delete drops the book's recents and its index entry*: the same for L477.
  - Pins workflow 2 L29-35 and workflow 7 L252-264.
  - Each fails against today's Worker.
- **behavior** — `app/src/worker/recents.behavior.test.js`, in `describe('recents (behavior)')`: *OPEN drops a recent whose book is no longer on the device (books.put_online_no_ghosts)*.
  - Make a book, record a recent for it, and write a second recent naming `local-gone` straight into the `meta` store, as a device carrying a ghost from before this task would have.
  - Restart and OPEN. `RECENTS` keeps the real book's entry and not `local-gone`, and the stored list no longer holds it.
- **e2e-web** — `e2e/web/tests/online.spec.js`, a new test *putting a book online leaves no ghost in Search or Recent, after a reload too (books.put_online_no_ghosts; workflow 2 §Before typing, workflow 7 §Putting a book online)*:
  1. `signedInDevice`, then `makeLocalBook(page, BOOK)`, then `writeSongInBook(page, BOOK, songLines(SONG))`, then `openSongFromSearch(page, SONG, SONG)`, which records the recent.
  2. `putBookOnline(page, BOOK)`, then `gotoTab(page, 'Search')` with the box empty.
  3. Assert the `Books` region contains no *Untitled book*.
  4. Assert the `Recent` region's row contains `SONG` and `BOOK`, and not *Untitled*.
  5. Run `checkA11y()`.
  6. Click the recent. The song's group is visible, and `page.url()` matches `/\/b\/(?!local-)[^/]+\//`.
  7. `startApp(page)` (a reload), then the same three assertions: no *Untitled book*, the Recent row names `SONG` · `BOOK`, and opening it shows the song at a non-`local-` address.
  - It runs on phone, tablet and computer (the three projects every spec runs on), with axe on the Search screen.
  - It goes through the real UI only. `signedInDevice` exists (`account.sign_in`), and so do the local book, the song editor, and Put online with its confirm (`books.online`, `books.put_online_confirm`). Everything that drives it already exists.
  - Song and book names are written for the test.

## Decisions

1. **Drop the key in the reducer, not filter in `SearchScreen`.** The bug is in the store: a status of "none" is stored as a value. If only `SearchScreen` filtered `null`s, every later reader of `Object.keys(index)` would have to remember the same filter.
   - `songCounts` already deletes on `null`, so `index` now matches it.
   - The Worker's `null` post stays as it is. It is the protocol's way of saying "no longer here" (`books.online_reindex` Decision 4).
2. **Move recents in the Worker and persist them, rather than re-point them in the reducer on `BOOK_ONLINE`.** The `BOOK_FORKED` reducer re-point shows what goes wrong with that approach: the slice is fixed until the next reload, and then the stored list brings the ghost back. That is the half of this bug that survives a reload.
   - The Worker owns the store (DIRECTION §3.7), so it moves the stored list and posts `RECENTS`.
   - The `BOOK_FORKED` reducer re-point is left in place. It is harmless, because the `RECENTS` that follows agrees with it.
3. **Fork moves recents too, though the note names only put-online.** The note's rule is "A book that changes id moves its recents". FORK_BOOK replaces a book with a new id in exactly the way PUT_ONLINE does, and has the same persisted-ghost bug. Covering it is one helper call. Its behavior is the same code path, which the put-online case pins.
4. **Dropping a book's recents is explicit at each call site, not hooked into `removeBook`.** `removeBook` also runs on re-keys and loading (the L952-960 comment). Hooking it there would drop recents on a put-online before they could be moved.
5. **Heal at OPEN as well as fixing the writers.** This follows `songs.no_raw_ids` Decision 3. The deployed app has already put ghosts on users' devices, and the writers' fixes would never clear those. One pass on bring-up does, and it writes only when there is something to drop.
   - Rejected: re-keying a stored `local-…` recent to the book that replaced it, by guessing from the shelf. A dropped ghost costs one tap on Search. A wrong guess would lead to a different song.
6. **A *My songs* merge drops the old *My songs*' recents instead of moving them.** The retirement goes through `removeFromShelf`. The merged songs may land at different paths in the account's *My songs* (a collision renames them), so a moved recent could point at nothing or at the wrong song. Opening the song again records it afresh.
7. **Design delta in workflow 2.** The recents paragraph (L29-35) now says that a recent follows its book and never leads to a book the device no longer has. This puts the promise in the governing document. It is not a new behavior: it is the reading of "the way back" that `songs.unsaved_after_discard` already applied to single songs.
8. **The e2e extends `online.spec.js` with a new test, not a new spec.** That spec is the put-online journey and its harness (its header says so). The Recent-region assertions follow `search.spec.js:105-136`.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-21.

- app/src/worker/reducer.js: a `null` `INDEX_STATUS` removes the book from the `index` slice, as it already did from `songCounts`.
- app/src/worker/recents.js: `moveBookRecents` and `dropBookRecents` (pure), and `moveBook`, `forgetBook` and `keepBooks` on `createRecents`, serialized on the write queue.
- app/src/worker/logic.js: one helper call per site moves recents when a book changes id (PUT_ONLINE, FORK_BOOK) and drops them when it leaves the shelf (remove, leave, delete, sign out, leave Estante, *My songs* merge); OPEN drops recents naming a book no longer on disk.
- Unit: app/src/worker/reducer.test.js, app/src/worker/recents.test.js.
- Behavior: app/src/worker/online.behavior.test.js (moves survive a restart; remove and delete drop recents and the index key), app/src/worker/recents.behavior.test.js (OPEN heal).
- e2e-web: e2e/web/tests/online.spec.js, no ghost in Search or Recent, after a reload too, on phone, tablet and computer. It opens the song with the partial query `Lanterna` and calls `toDestinations` before `putBookOnline`.
- Design delta: docs/workflows/02-find-and-play.md (a recent follows its book).


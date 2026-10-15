# books.bring_in — Bring them in, as drawn

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `books.bring_in`
("Bring them in, as drawn"), under `books`.

## Effort estimate

2d (from the `.tji`).

## Repository

The estante-de-cifras tree only; nothing under `cifra.md/`:

- `app/src/books/` — the new `BringIn.jsx` screen (+ `bring-in.css`), a
  shared `PreviewRows.jsx` extracted from `UploadPreview.jsx`, the *Bring them
  in* button on the shelf row (`BooksScreen.jsx`), the *original is no longer
  shared with you* card (`BookDetail.jsx`), and a date helper in
  `book-display.js`.
- `app/src/i18n/locales/{en,es-419,it,pt-BR}.js` — the new copy.
- `e2e/web/lib/journeys-fork.js` (new) and `e2e/web/tests/bring-in.spec.js`
  (new); `e2e/web/tests/fork.spec.js` switched to the extracted helpers.
- Design delta: `docs/workflows/11-fork.md` §Following the original (already
  written with this refinement; rides in the closer's commit).

No Worker, service or API change: the Worker protocol is `sync.fork_follow`'s
and is consumed as it stands.

## Inherited dependencies

All settled (`complete 100`):

- `books.fork` — the fork itself, the shelf lines *from {original}* /
  *{original} has N new saves.* / the *original no longer shared* badge, the
  Make-it-my-own flows; its Decision 5 left the *Bring them in* button to
  this task.
- `sync.fork_follow` — the Worker's `PREVIEW_BRING_IN` / `BRING_IN` /
  `CANCEL_BRING_IN`, the `ORIGINAL` event and `originals` slice, the
  `original` register with `followedAt` / `goneAt`.
- `books.upload_ui` — `UploadPreview.jsx` and its rows, whose shape the
  bring-in preview shares.

Also complete and used by the tests: `books.share` (invite, remove a member
through the Share dialog), `books.add_by_link` (a second account joins),
`books.online` (a hosted book), `sync.conflicts` (the conflict surface a
`needs_you` hands to).

## What this task is

The user-facing half of following an original (workflow 11 §Following the
original). On the shelf, a fork whose original has new saves gets a *Bring
them in* button beside the count. It opens the *Bring in* screen (W11 board
#3, `docs/mockups/W11-fork.dc.html:101-138`): how many new saves since the
user last brought them in, the songs they touch song by song (the upload
preview's rows), a note already written, a notice naming any song that
meets the user's own edits, and *Not now* / *Bring them in*. Confirming
merges, saves and pushes; a conflict hands to the conflict surface
(workflow 9). Offline, or when the original cannot be reached, the screen
says so plainly and nothing changes. When the original has gone away, the
book's detail carries *The original is no longer shared with you* with the
date it was last brought in (board #4, `:167-170`).

## Why it needs to be done

`sync.fork_follow` built the whole Worker path, and `books.fork` built the
count line, but no main-thread code sends `PREVIEW_BRING_IN` or listens for
`BRING_IN_PREVIEW` / `BRING_IN_DONE` — the count is a dead end and the
teacher–student model of DIRECTION §2 ("keeps pulling the teacher's
changes") cannot be used. It is in milestone `m4_together`
(`tasks/99-milestones.tji:38`).

## Inputs / context

**Governing documents**

- Workflow 11 `docs/workflows/11-fork.md` §Following the original (L55-69,
  plus this task's delta): never automatic; the shelf says *{original} has 3
  new saves*; *Bring them in* shows the upload's preview song by song;
  confirming merges, commits and pushes; conflicts to workflow 9; the
  original going away ends following and nothing else.
- Workflow 7 (the upload preview), workflow 9 (conflicts), workflow 8 (sync,
  offline).
- DIRECTION §2 (forks as the teacher–student model), §3.1–3.2 (offline first,
  the Worker owns git), §3.7 (the app), §4 (the interface).
- Board `docs/mockups/W11-fork.dc.html`; frames listed in
  `e2e/web/lib/mockup-frames.json` (≈L308-332):
  - #2 phone shelf (L68-96): the notice *Ana's Choros has 3 new saves.* with
    the primary *Bring them in* button (L81-82).
  - #3 tablet preview (L101-138): back button; title *Bring in Ana's saves*
    (L107); body *3 new saves in Ana's Choros since you last brought them in.
    Nothing is written to your Choros da Ana until you confirm.* (L110); rows
    with name + status badge + diff lines (L111-124, data L240-251: changed
    `voiced`, added `ok`, conflict `conflict`); field *Note* prefilled *Bring
    in Ana's changes: Carinhoso, Lamentos, Tico-tico no Fubá* (L125-128 — the
    titles alphabetical); notice *Lamentos meets your own edits. After
    confirming you'll settle it one conflict at a time; the rest comes in at
    once.* (L129); *Not now* / *Bring them in* (L130-133); caption *Merges
    into your copy, saves, and sends it to Estante.* (L134).
  - #4 computer (L141-198): the notice (L169) *The original is no longer
    shared with you. This book stops following Ana's Choros; it was last
    brought in on 28 September. Nothing else changes: your copy, its history
    and its songs are all here, and you save, share and sync it as before.*
- `docs/mockups/README.md`, `theme.css` — `.notice`, `.badge`, `.btn
  primary`, `.field`.

**The Worker protocol consumed** (`app/src/worker/protocol.js`)

- Commands L376-390: `PREVIEW_BRING_IN { bookId }`; `BRING_IN { bookId,
  followId, note }`; `CANCEL_BRING_IN { bookId, followId }`.
- Events L662-683: `ORIGINAL { bookId, newSaves, gone }`;
  `BRING_IN_PREVIEW` — `{ bookId, followId, original: { bookId, title },
  newSaves, previews }` (rows `{ path, title, status, changes?, summary?,
  line? }`), or `{ bookId, gone: true }`, or `{ bookId, error: 'unreachable'
  }` (offline / 5xx), or `{ bookId, error: 'not_following' }`
  (`app/src/worker/bring-in.js:299`); `BRING_IN_DONE` — `{ bookId, kind:
  'merged', pushed }` | `{ kind: 'needs_you' }` | `{ kind: 'stale' }`.
- Engine `app/src/worker/bring-in.js` (`createBringIn` ≈L260-417): the
  `followId` is in memory (a reload makes every preview stale); an empty note
  becomes `'Bring in'`; a pushed bring-in emits `ORIGINAL { newSaves: 0 }`,
  so the shelf count clears by itself. Handlers `app/src/worker/logic.js`
  L1656-1694 (BRING_IN also posts the follow-up `SYNC` phase).
- There are no correlation ids: components send with
  `store.send(command(...))` and listen with `useWorkerEvent(store, kind,
  handler)` filtered by `bookId` (`app/src/worker/useStore.js`).

**Seams in the app**

- `app/src/books/BooksScreen.jsx`: `BookRow` L174-209 (the open `Button`
  holding the *from …* and *… has N new saves.* lines L186-194, then the
  sibling `files-btn` and `RenameDialog`); comments L172-174 reserve the
  button for this task; `useSlice(store, 'originals')` L522; the upload
  preview mounted as a full-screen state at L543 / L725-740 with its
  `onNeedsYou` hand-off (`setSelected` + `onOpenBook`).
- `app/src/books/UploadPreview.jsx`: `BADGE_CLASS` / `STATUS_KEY` L49-62;
  rows rendered inline L357-391 (`.list.upload-songs > .row.upload-song`,
  `DiffRows` from `app/src/songs/DiffRows.jsx`, the keep `Checkbox` for
  `replace`); its behavior test `UploadPreview.behavior.test.jsx` (synthetic
  model pattern with `emit`, L184-188).
- `app/src/books/BookDetail.jsx`: reads the `shelf` and `sync` slices; the
  `isGone` card L335-350 (`books.lostAccessTitle`, `role="status"` body), the
  taken-down card L367-381, Download L383-390.
- `app/src/books/book-display.js`: `originalOf` L136 (the register `{ bookId,
  title, link, followedAt, goneAt? }`), `forkLineFor` L154-163.
- Date formatting precedent: `app/src/files/BookHistory.jsx:24`
  (`Intl.DateTimeFormat(currentLocale(), …)`).
- Offline copy precedent: `fork.offline` in `app/src/i18n/locales/en.js:694`
  (*Making it your own needs the network. Nothing changed: connect, then try
  again.*).

**Predecessor decisions carried**

- `books.fork` Decision 4: copy names the **book**, not the owner — the
  data has no owner's name. The board's *Ana's* becomes the original's title.
- `books.fork` Decision 6: book actions live in `BookDetail` cards and shelf
  rows; there is no per-row ⋯ menu.
- `books.upload_ui` Decision 1 (full-screen surface over the shelf, its own
  appbar), Decision 2 (no keep-mine/keep-theirs in the preview — a conflict
  is a word, resolution is workflow 9), Decision 5 (re-preview cancels the
  superseded id), Decision 7 (synthetic preview models in behavior tests).
- `sync.fork_follow`: the note is the merge commit's message; never a
  fast-forward; `followedAt` is the fork time or the last bring-in.
- e2e: `e2e/web/tests/fork.spec.js` — local helpers `biaJoins` (L46),
  `makeItMyOwn` (L57); journey L97 (deliberate fork, Ana saves, Bia's
  `syncNow` shows *{BOOK} has 1 new save.*) is this task's prefix; it already
  calls `mockup(bia.page, 'W11-fork', 2)` (L119). Helpers in
  `e2e/web/lib/journeys-share.js` (`hostedBookWithSong`, `inviteThroughShare`,
  `acceptInvitation`, `openSharing`, `removeFirstMember`, `addSectionAndSave`)
  and `e2e/web/lib/journeys.js` (`syncNow`, `openSongFromSearch`,
  `gotoTab`), `e2e/web/lib/devices.js` `openDevice`.

## Constraints / requirements

1. **Never automatic** (workflow 11): nothing is fetched into the book or
   written until the user presses *Bring them in* on the screen. The
   preview itself only fetches the original's ref (the Worker's job).
2. **Offline first.** The screen opens offline and shows the Worker's
   `unreachable` reply as plain copy: *Bringing them in needs the network.
   Nothing changed: connect, then try again.* — no *Bring them in* button in
   that state, only a way back. The main thread never touches git or
   IndexedDB; everything goes through the existing commands.
3. **Copy names the book** (fork Decision 4): title *Bring in saves from
   {original}*; body *{n} new save(s) in {original} since you last brought
   them in. Nothing is written to {book} until you confirm.* (plural via the
   locale's `count`); note prefilled *Bring in changes from {original}:
   {titles}* — the titles of every row, sorted with the locale's collation
   and joined with the locale's list format, editable; conflict notice
   *{songs} meet(s) your own edits. After confirming you'll settle it one
   conflict at a time; the rest comes in at once.* naming every `conflict`
   row; caption *Merges into your copy, saves, and sends it to Estante.*
4. **Rows are the upload's.** Extract the row list from `UploadPreview.jsx`
   into `PreviewRows.jsx` (status map, name, meta/summary, `DiffRows`, the
   status word as a `.badge`, the optional keep checkbox for `replace` rows
   only when a handler is given) and render it from both screens.
   `UploadPreview`'s rendered output does not change.
5. **The reply lifecycle.**
   - On mount: send `PREVIEW_BRING_IN { bookId }`; until the reply, a
     `role="status"` line *Fetching the new saves from {original}…*.
   - Replies are taken only for this `bookId`.
   - *Not now* (and the appbar back, and unmount while a preview is held):
     `CANCEL_BRING_IN { bookId, followId }`, then close.
   - *Bring them in*: `BRING_IN { bookId, followId, note }`; both buttons
     disabled and a status line *Bringing them in…* until `BRING_IN_DONE`.
     No cancel is sent after a `BRING_IN` (the Worker owns the ref from
     then on).
   - `merged`: close back to the shelf (the count clears through
     `ORIGINAL`; a `pushed: false` shows as the shelf's ordinary *saves
     waiting* sync word).
   - `needs_you`: hand off exactly as the upload does — close, select the
     book, `onOpenBook(bookId)` — so the conflict surface opens (workflow 9).
   - `stale`: re-send `PREVIEW_BRING_IN` and say *Something changed since
     this preview, so it was made again. Check it, then bring them in.*
   - `gone` / `not_following`: the screen shows *The original is no longer
     shared with you.* with only a way back (the shelf badge comes from
     `ORIGINAL`).
6. **The shelf button.** In `BookRow`, when `forkLineFor(...).newSaves > 0`
   (so never once gone), a RAC `Button` *Bring them in*, `btn primary`, as a
   **sibling** of the row's open button (never nested inside it), with the
   accessible name *Bring them in from {original}* (contains the visible
   text, WCAG 2.5.3). It opens the screen as a full-screen state in
   `BooksScreen`, like `upload`.
7. **The gone card.** In `BookDetail`, when the shelf register's
   `originalOf(book)?.goneAt` is set (or the live `originals[bookId].gone`),
   a card titled *The original is no longer shared with you.* with a
   `role="status"` body *This book stops following {original}; it was last
   brought in on {date}. Nothing else changes: your copy, its history and its
   songs are all here, and you save, share and sync it as before.* `{date}`
   is `followedAt` formatted by a pure `broughtInOn(iso, locale, now)` in
   `book-display.js`: day and long month (*28 September*), with the year
   when it is not the current year. It is independent of the fork's own
   `gone` / `taken_down` cards (those are about the fork itself).
8. **Accessibility**: React Aria Components for every control (`Button`,
   `TextField` + `Label` + `Input` for the note); keyboard paths through
   *Not now* and *Bring them in*; focus to the screen's heading on open and
   back to the row's open button on close; status as words (badges, notices),
   never colour alone; axe WCAG 2.1 AA on the screen in every state and on
   the detail card.
9. **Canonical form**: unchanged — the merge is the Worker's, and a marked
   text is never committed (it goes to `needs_you`).
10. **i18n**: every new string in all four locale files
    (`en`, `es-419`, `it`, `pt-BR`); `i18n.test.js` keeps them in step.

## Acceptance criteria

Behavior delivered: constraints 1-10.

Tests, by level:

- **unit** — `app/src/books/book-display.test.js`: `broughtInOn` gives *28
  September* in `en` for a date this year, adds the year for a past year,
  and returns `null` for a missing/invalid `followedAt` (the card then drops
  the date clause) (board #4 L169; workflow 11 §Following the original
  delta).
- **behavior** — `app/src/books/BringIn.behavior.test.jsx` (synthetic
  `BRING_IN_PREVIEW` / `BRING_IN_DONE` through `createStore` +
  `createLoopbackEndpoint`'s `emit`, the `UploadPreview` pattern):
  - on mount it sends `PREVIEW_BRING_IN { bookId }` and shows the fetching
    status;
  - a preview with a changed, an added and a conflict row: the title and the
    *3 new saves in … since you last brought them in* body, each row's title
    and status word, the changed row's diff lines, the note prefilled with
    the titles alphabetical, the conflict notice naming the conflicting song,
    the caption; axe clean (W11 #3, workflow 11);
  - keyboard: Tab reaches the note, *Not now*, *Bring them in*; Enter on *Not
    now* sends `CANCEL_BRING_IN { bookId, followId }` and closes; Enter on
    *Bring them in* after editing the note sends `BRING_IN { bookId,
    followId, note }` with the edited note, disables both buttons, and a
    `merged` reply closes without sending a cancel;
  - `needs_you` calls `onNeedsYou(bookId)`;
  - `stale` re-sends `PREVIEW_BRING_IN` and shows the stale line;
  - `unreachable`: the offline copy, no *Bring them in*, nothing else sent;
    axe clean (constraint 2);
  - `gone`: *The original is no longer shared with you.*, no *Bring them in*;
  - a reply for another `bookId` is ignored.
- **behavior** — `app/src/books/BooksScreen.behavior.test.jsx`: the existing
  "no Bring them in button" assertion (≈L310-311) becomes: a fork with
  `originals[id].newSaves > 0` shows *Bring them in from {original}* beside
  the count; pressing it (and Enter on it) opens the bring-in screen and
  sends `PREVIEW_BRING_IN`; no button for a count of 0 or a gone original;
  the row's open button still opens the book; axe clean (W11 #2).
- **behavior** — `app/src/books/BookDetail.behavior.test.jsx`: a fork whose
  register has `goneAt` and `followedAt` shows the *original is no longer
  shared with you* card with its `role="status"` body and the formatted date;
  no card for a following fork or a non-fork; axe clean (W11 #4 L169).
- **behavior** — `app/src/books/UploadPreview.behavior.test.jsx` stays green
  unchanged after the `PreviewRows` extraction (it pins that the upload's
  rows did not move).
- **e2e-web** — `e2e/web/tests/bring-in.spec.js` (phone, tablet and computer
  projects), through the real UI only, with fork set-up from the new
  `e2e/web/lib/journeys-fork.js` (`biaJoins`, `makeItMyOwn` moved out of
  `fork.spec.js`, which then imports them):
  1. *Ana's new save brought in*: Ana hosts a book with a song written for
     the test and invites Bia as editor; Bia joins in a second context and
     makes the book their own; Ana adds a section and saves; Bia's `syncNow` shows
     *{BOOK} has 1 new save.* and *Bring them in* (`mockup(bia.page,
     'W11-fork', 2)`); Bia goes offline (`context.setOffline(true)`), presses
     *Bring them in*, reads the offline copy, goes back (*Not now*), comes
     online; presses *Bring them in* again: the song's row reads *changed*,
     the note is prefilled with its title; axe on the screen;
     `mockup(bia.page, 'W11-fork', 3)`; *Bring them in* → the shelf without
     the count line, and the song opened from search in Bia's book shows
     Ana's section (workflow 11 §Following the original; workflow 8
     offline).
  2. *Bia removed from the original sees the notice*: the same set-up to the
     fork; Ana opens Share and removes Bia (`openSharing`,
     `removeFirstMember`); Bia's `syncNow` shows the *original no longer
     shared* badge, and Bia's book detail carries *The original is no longer
     shared with you.* with *last brought in on {today}* (today formatted in
     the page with `page.evaluate` + `Intl.DateTimeFormat`, a read); axe on
     the detail (workflow 11 §When the original goes away; W11 #4).
- **Design delta**: `docs/workflows/11-fork.md` §Following the original —
  the preview's count, prefilled note, conflict naming and *Not now*; the
  network requirement with the plain offline reply; the book itself saying
  the original went away with the last brought-in date.

No deferred work.

## Decisions

1. **Copy names the original book, not its owner** (*Bring in saves from
   Ana's Choros*, *Bring in changes from Ana's Choros: …*). The board's
   *Ana's saves* needs an owner's name the data does not carry; `books.fork`
   Decision 4 rejected adding one, and the same rule holds here.
2. **Extract `PreviewRows.jsx` rather than copy the rows.** The note says
   "reusing the upload preview's"; one component keeps the status words and
   badge classes in step. Rejected: rendering `UploadPreview` itself with a
   mode flag — its lifecycle (bytes, target picker, `PREVIEW_UPLOAD`) is
   unrelated, and a flagged component would mix two protocols.
3. **Full-screen state in `BooksScreen`, like the upload**, not a route or a
   modal. Screens are React state in this app (no hash routing); the board
   draws a screen with a back button, and the upload precedent already
   handles narrow/wide and the `needs_you` hand-off.
4. **The button sits on the shelf row only**, as board #2 draws it, a
   sibling of the row's open button (a button inside a button is invalid
   and fails axe). Not also on `BookDetail`: the board puts nothing there
   while following, and the computer's sidebar row carries it.
5. **`stale` re-previews automatically** with a line saying so, rather than
   an error with a *Preview again* button: the user must re-read a changed
   preview either way, and this saves a press without writing anything.
6. **The gone card keys on the register's `goneAt`**, not the fork's `sync`
   phase: the original going away never changes the fork's phase
   (`sync.fork_follow` C2), and the date needs the stored `followedAt`. The
   board's *Original* side card (L180-185) is not built: it repeats the
   notice, and the note scopes the notice only.
7. **`not_following` is shown like `gone`.** It means the book holds no
   original register; for the user the effect is the same — nothing to
   bring in.
8. **No component round-trip through the real Worker logic.** A real
   preview needs an original remote, which the Worker's
   `app/src/worker/bring-in.behavior.test.js` already exercises end to end
   (counted, merged, conflict, gone, unreachable, stale); the component
   tests drive the same replies synthetically (upload_ui Decision 7), and
   the e2e-web journey runs the real path on the stack.
9. **Offline in e2e via `context.setOffline`**, the harness's sanctioned
   seam (`networkBlip`, `offline.js`), not network mocking — it is the real
   *unreachable* path.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-15.

- The bring-in screen: `app/src/books/BringIn.jsx` and `app/src/books/bring-in.css` — count, the upload's rows, the prefilled note, the conflict notice, Not now / Bring them in, and the offline, stale and gone states; a merge closes it, a conflict hands off to the conflict surface once the book's sync phase reads *needs you*.
- The preview rows shared with the upload: `app/src/books/PreviewRows.jsx`, extracted from `app/src/books/UploadPreview.jsx` (whose behavior test is unchanged and green).
- The shelf entry and the gone notice: `app/src/books/BooksScreen.jsx` (*Bring them in from {original}* beside a fork's count) and `app/src/books/BookDetail.jsx` (*original is no longer shared* card with the last brought-in date), with `broughtInOn` in `app/src/books/book-display.js` (formatted as `en-GB` so it reads *28 September*) and strings in `app/src/i18n/locales/{en,es-419,it,pt-BR}.js`.
- Tests: unit `app/src/books/book-display.test.js`; behavior `app/src/books/BringIn.behavior.test.jsx` (9 cases), `BooksScreen.behavior.test.jsx`, `BookDetail.behavior.test.jsx`; e2e-web `e2e/web/tests/bring-in.spec.js` (2 journeys, phone, tablet and computer), with `makeItMyOwn`/`biaJoins` moved to `e2e/web/lib/journeys-fork.js` and imported by `e2e/web/tests/fork.spec.js`.
- Design delta carried in `docs/workflows/11-fork.md`.
- No tech-debt follow-ups.

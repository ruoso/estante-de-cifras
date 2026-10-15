# Refinement — `design.leave_book`

## TaskJuggler

[`tasks/20-design.tji`](../../20-design.tji), `task leave_book "Leaving one
shared book"` (line 62):

> Decide and draw a Leave this book verb for a member who wants to drop one
> membership without deleting their account: where it sits in book management,
> its confirmation (unsaved changes and unpushed saves counted, as Remove does),
> and that Mine on Estante no longer offers the book afterwards. An owner cannot
> leave (handing ownership stays workflow 10 Later). Workflow 10. Source:
> tasks/parking-lot.md 2026-10-14 (Leave one shared book). Tests: none — design
> deliverable (workflow 10 edit and the board).

## Effort estimate

0.5d (as the `.tji` gives it). The workflow text is written with this
refinement (the deltas below); the rest of the half-day is the board.

## Repository

estante-de-cifras, **not** `cifra.md/` (the note does not start with
`cifra.md:`). Files:

- `docs/workflows/10-share.md` — new §Leaving a book (L87-144), **written with
  this refinement** (delta).
- `docs/workflows/07-add-a-book.md` — §Removing a book, and deleting one: the
  *Remove from my shelf* bullet now says removing keeps the membership and
  points to *Leave this book* (delta, written).
- `docs/workflows/17-leaving.md` — the *Leaving one shared book* §Later entry
  retired; an Edge-cases bullet *Leaving one book, not Estante* pointing to
  workflow 10 (delta, written).
- `docs/DIRECTION.md` — §3.6 The API, Sharing bullet (L391-) names the member
  leaving; §6 a new *Leaving one shared book, decided and drawn* bullet
  (L591-) (delta, written).
- `docs/mockups/Leave-book.dc.html` — **new** board (the implementer draws it).
- `docs/mockups/canvas.json` — the board registered (by the closer, per the
  design refinements' precedent; GUIDE.md tells a board writer not to edit it).

No code, no `api/` change: the endpoint is `service.leave_book`'s, the app's
verb `books.leave`'s.

## Inherited dependencies

The task has no `depends`. What it builds on is settled (`complete 100`):

- `service.sharing` — memberships, the owner's `DELETE
  /api/books/{bookId}/members/{userId}` (`api/openapi.yaml:499`, `:530-549`,
  owner only; `service/internal/server/sharing.go:770-803`, `requireOwner` at
  `:780`). No self-remove path exists today.
- `books.online` / the book-management screen — `app/src/books/BookDetail.jsx`
  (the verbs; `RemoveDialog` at `:90`, rendered `:423-431`; Fork card `:412`;
  Delete `:449`, `isOwner && !isLocal`; the *no longer shared* notice
  `:364-396`), `app/src/books/BooksScreen.jsx` (*Mine on Estante* section
  `:467-482`, `MineList` `:284`).
- *Mine on Estante* is computed client-side: `booksNotOnShelf`
  (`app/src/books/mine-on-estante.js:45`) diffs `GET /api/books`
  (`api/openapi.yaml:346-362`, "owned, shared and forks") against the shelf —
  so a membership that ends drops the book from it with no app change beyond a
  refresh.
- `design.leaving` (workflow 17), which parked this question, and
  `design.recovery_email` (the supplementary-board precedent).

Downstream, waiting on this task: `service.leave_book`
(`tasks/30-service.tji:90`) and `books.leave` (`tasks/65-books.tji:108`),
both "as design.leave_book decides".

## What this task is

Decide in workflow 10, and draw on one board, a **Leave this book** verb by
which a member (reader or editor) ends their own membership without deleting
their account: where it sits, what its confirmation counts and offers, what it
does on the service and on the device (and on the person's other devices), and
that *Mine on Estante* no longer offers the book afterwards. An owner is not
offered it.

## Why it needs to be done

*Remove from my shelf* deletes the local clone and keeps the membership
(workflow 7 L132-135), so *Mine on Estante* offers the book again; the only way
for a member to stop following a book today is deleting the whole account
(workflow 17). `design.leaving`'s closer parked it on 2026-10-13
(`git show 799f87d^:tasks/parking-lot.md` L264-267, "Leave one shared book
without deleting the account"), and the 2026-10-14 triage turned it into this
task plus `service.leave_book` and `books.leave`.

## Inputs / context

- **Workflow 10** — `docs/workflows/10-share.md`: §Roles (L62-69), §Who sees
  whom (L71-75), §Removing someone, or lowering their role (L77-85, the
  fork-or-download offer leaving reuses), the new §Leaving a book (L87-144),
  §Later (L175-, *handing ownership*).
- **Workflow 7** — `docs/workflows/07-add-a-book.md` §The book-management screen
  (L12-31, *Mine on Estante* L28-29), §Removing a book, and deleting one
  (L128-139).
- **Workflow 8** — `docs/workflows/08-sync.md` §What the shelf says (L26-38,
  *no longer shared with you* L34), §Losing access (L64-69).
- **Workflow 11** — `docs/workflows/11-fork.md` §Ways in (L10-19), §When the
  original goes away (L70-76).
- **Workflow 17** — `docs/workflows/17-leaving.md` §What happens to books others
  are members of (L111-140; "only the leaver's own membership ends" L127-129),
  §Edge cases (L178-), §Later.
- **DIRECTION** — §3.6 The API, Sharing (L391-394); §6 (L544-).
- **Boards** — `docs/mockups/W10-share.dc.html` (phones: Ana's share screen and
  a new invitation; tablet: the owner's people screen and the remove dialog;
  computer: share on a song, plus an extra strip with the full book and *a
  member sees the book's sharing* L244 — "You're a reader", no leave action;
  the board is full). `docs/mockups/W07-add-a-book.dc.html` computer (L178-240):
  the book detail with Share, Download, *Remove from my shelf* (L219), *Delete
  the book* (L224) cards — the layout the new verb joins.
  `docs/mockups/W17-leaving.dc.html` tablet (L87-): a member's shelf with
  *Banda do Bairro* no longer shared. `docs/mockups/GUIDE.md` (3208×1500, two
  phones / tablet / computer, tokens only, the cast), `theme.css`, `README.md`.
  `docs/mockups/canvas.json`: last board `Recovery-email.dc.html` at `y: 33200`
  on the 1620 stride.
- **Predecessor refinements** — `tasks/refinements/design/leaving.md` (L408-415,
  L519-522: the parked question; type-the-name reserved for terminal actions),
  `recovery_email.md` (a supplementary board drawing decisions of existing
  workflows).

## Constraints / requirements

- **No book without an account** holds: leaving only narrows access; the
  service refuses clone, fetch and push to a former member like anyone else's.
- **An owner cannot leave.** Every book has one owner; handing ownership stays
  workflow 10 §Later (parked, `tasks/parking-lot.md` L103-105).
- **Nothing written is lost silently**: unsaved changes and unpushed saves are
  counted and the fork/download offered (workflow 10 §Removing someone, workflow
  7 §Removing a book).
- **Offline first, with the bounded exception**: membership lives only on the
  service, so leaving needs a connection, like accepting an invitation; offline
  the verb says so in words.
- **Accessibility**: the verb and the confirmation are real buttons and an
  alert dialog in the build (React Aria); counts and *Leaving needs a
  connection* said in words, never colour alone.
- **The board** follows `docs/mockups/GUIDE.md`: W02's head and script,
  3208×1500, two phones, a tablet, a computer, only `var(--…)` tokens, the cast
  (Ana / *Choros da Ana*, *Banda do Bairro*, *My songs*), real copy from
  workflow 10, no invented features.

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause:
*"none — design deliverable (workflow 10 edit and the board)"*). Acceptance is
what the workflow decides, what the board shows, and the DIRECTION deltas —
concrete enough that `service.leave_book`'s and `books.leave`'s named tests are
written against them.

1. **Workflow 10 §Leaving a book decides** (written; the implementer checks it
   against the board and keeps them in step):
   - **who**: a member, reader or editor; never the owner (who sees *Delete the
     book*), never a device-only book, never a book already *no longer shared*
     — *pins `books.leave`'s behavior "the verb shown to members and not
     owners" and `service.leave_book`'s "the owner refused"*;
   - **where**: on the book in book management, below *Remove from my shelf*;
     and **Leave** on a *Mine on Estante* row for a book not on this shelf;
   - **the confirmation**: names the book and owner, says it ends on every
     device and that the owner can invite again; counts unsaved changes and,
     for an editor, unpushed saves, offering **Make it my own first** (fork)
     and **Download first** beside **Leave the book**; no typed name; from
     *Mine on Estante*, the sentence alone — *pins `books.leave`'s behavior
     "the confirmation"*;
   - **the effect**: the membership ends on the service first, then the book
     leaves this device; gone from the shelf and *Mine on Estante*; no clone,
     fetch or push afterwards; other devices of the account see *no longer
     shared with you* at their next sync; the owner's people count drops, no
     notification — *pins `service.leave_book`'s behavior "a member leaves" /
     e2e-api "can no longer clone", and `books.leave`'s e2e-web "gone from the
     shelf and from Mine on Estante"*;
   - **offline / failure**: *Leaving needs a connection*, nothing changes; a
     refused or interrupted leave keeps the book and says it did not leave;
   - **coming back**: by any still-valid invitation, counted against fifty;
   - **edge cases**: a fork of the book is untouched and stops following it;
     an owner cannot leave.
2. **Workflows 7 and 17 and DIRECTION** carry the pointers listed under
   Repository (written). DIRECTION §7 is unchanged: no new workflow.
3. **The board** `docs/mockups/Leave-book.dc.html` exists, drawn to GUIDE.md:
   `.board-head` *Workflow 10 · Leaving a book*, a one- or two-sentence
   `board-sub`, and:
   - **Phone 1** · a reader's book detail for *Choros da Ana* (owner Ana): the
     verbs as W07 draws them, *Remove from my shelf* (*Deletes this device's
     copy only*), then **Leave this book** (*Stop following it on all your
     devices*); no *Delete the book*;
   - **Phone 2** · the reader's confirmation: *Leave Choros da Ana? …*, *1
     song with unsaved changes will be lost*, **Leave the book**, **Cancel**;
   - **Tablet** · an editor in *Banda do Bairro* with saves not pushed: the
     confirmation counting *3 saves have not reached the book and never will*,
     **Make it my own first**, **Download first**, **Leave the book**,
     **Cancel**;
   - **Computer** · the Books screen after leaving: the shelf without the book,
     and *Mine on Estante* listing another member book not on this shelf with
     its **Leave** action and the short confirmation; and, as a second panel
     or inset, the offline state *Leaving needs a connection* on the verb;
   - status in words (`.badge`), never colour alone.
   - Registration: `boards["Leave-book.dc.html"]` `{ x: 0, w: 3208, h: 1500,
     title: "10. Leaving a book" }` at the next free `y` on the 1620 stride
     after the last board when it lands (`34820` today, after Recovery-email at
     `33200`), appended to `order` — by the closer. No other board touched.
4. **No code tests, and none deferred.** The tests pinning these decisions are
   `service.leave_book`'s and `books.leave`'s, named in their `.tji` notes —
   the handshake, not a deferral.
5. **No deferred WBS follow-up.** Both build tasks already exist; the *Mine on
   Estante* Leave falls inside `books.leave` ("as design.leave_book decides").

## Decisions

### Leaving is a section of workflow 10 and a supplementary board

**Chosen:** §Leaving a book in workflow 10 (membership is workflow 10's), drawn
on a new `Leave-book.dc.html`, the Recovery-email / Theme-picker precedent.
**Rejected:** more frames on W10 (its four frames and the extra computer strip
are full; GUIDE.md fixes the board size); a workflow 18 (not a journey of its
own); putting it in workflow 17 (that is leaving Estante; this keeps the
account).

### Leaving also removes the book from this device

**Chosen:** end the membership, then remove the clone — leaving means "stop
having this book", and keeping a frozen copy is what *Download first* or a fork
is for. **Rejected:** keep the copy as *no longer shared with you* (leaves a
dead book the person asked to be rid of, and a second step to clear it); remove
the clone first (offline or a refusal would leave a member with no copy and a
live membership).

### Shown to members only; no owner leave

**Chosen:** the owner sees *Delete the book* instead. **Rejected:** letting an
owner leave by transferring or orphaning the book — handing ownership is
workflow 10 §Later and orphaning contradicts one owner per book
(`design.leaving` Decisions).

### A plain confirmation, not type-the-name

**Chosen:** a sentence, the counted losses, two buttons. Type-the-name is the
house pattern for actions that destroy data for others or for good (deleting a
book, the account — `leaving.md`); leaving touches nobody else's data and an
invitation undoes it. **Rejected:** typing the name (friction out of
proportion); no confirmation (it ends access on every device at once).

### Unpushed saves get the removed-editor offer

**Chosen:** **Make it my own first** and **Download first**, exactly what
workflow 10 §Removing someone offers an editor removed with saves not yet
pushed. **Rejected:** pushing the saves before leaving (the person may not want
them in the book, and a push can conflict — workflow 9 — turning a leave into a
merge); refusing to leave until pushed (blocks leaving on the network and on
conflicts).

### Leave on a *Mine on Estante* row too

**Chosen:** a member who already removed the book from this shelf can leave from
its *Mine on Estante* row. **Rejected:** only on the book's detail — the parked
complaint is exactly that *Mine on Estante* keeps re-offering a removed book,
and making someone add it back (a full clone) just to leave would be absurd.

### Needs a connection; the owner is not notified

**Chosen:** membership is service state, as accepting an invitation is; no
notification, since telling people things is workflow 10 §Later — the owner's
people count says it. **Rejected:** queueing a leave offline (a book half-left
on the device and still a member on the service, re-offered by *Mine on
Estante* until the queue drains).

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-15.

- docs/mockups/Leave-book.dc.html: new board — phone 1 a reader's *Choros da Ana* with **Leave this book** below *Remove from my shelf*; phone 2 its confirmation counting 1 song with unsaved changes; tablet an editor in *Banda do Bairro* with 3 saves not pushed, offered **Make it my own first** or **Download first**; computer the shelf without the book, *Mine on Estante* offering **Leave** on *Aulas de violão*, the short row confirmation and the offline *Leaving needs a connection* state.
- docs/mockups/canvas.json: board registered (y 34820) and added to the order.
- docs/workflows/10-share.md, docs/workflows/07-add-a-book.md, docs/workflows/17-leaving.md, docs/DIRECTION.md: the decisions, written with the refinement.
- Not drawn: the confirmation saying a refused or interrupted leave did not go through.
- The board was not rendered; the canvas republish is in tasks/parking-lot.md.
- Tests: none — design task; the decisions are tested in `service.leave_book` and `books.leave`.

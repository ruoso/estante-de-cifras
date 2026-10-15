# Refinement — `design.w07_remove_board`

## TaskJuggler

[`tasks/20-design.tji`](../../20-design.tji) L69-73,
`task w07_remove_board "Draw the Remove loss-warning cases on W07"`:

> docs/mockups/W07-add-a-book.dc.html draws only the hosted-in-step Remove
> one-liner; add the two normative confirmations of workflow 7 L128-135 —
> unsaved/unpushed loss warning, and the device-only 'gone for good, download
> first' case — as already implemented by books.online. Publishing the canvas
> stays a human step (tasks/parking-lot.md, Republish the mockup canvas).
> Source: tasks/parking-lot.md 2026-10-14 (W07 board under-illustrates the
> Remove flow). Tests: none — design deliverable (the board).

(The workflow text the note cites as L128-135 has since moved: it is
`docs/workflows/07-add-a-book.md:144-155` today.)

## Effort estimate

0.5d (from the `.tji`).

## Repository

**estante-de-cifras**, not `cifra.md/`. Documents only:

- `docs/mockups/Remove-from-shelf.dc.html` — **new** supplementary board for
  workflow 7 (the implementer draws it; see Decision *A supplementary board,
  not more frames on W07*).
- `docs/mockups/canvas.json` — the board registered (by the closer, per the
  design refinements' precedent; `docs/mockups/GUIDE.md:12-15` tells a board
  writer not to edit it).
- `docs/mockups/W07-add-a-book.dc.html` — untouched.
- No workflow or DIRECTION delta (Decision *No document delta*).

## Inherited dependencies

None in the `.tji` (`depends` is empty). What it draws is settled:

- **books.online** (`complete 100`, `tasks/refinements/books/online.md`) —
  built Remove from my shelf with the two confirmations from the workflow
  text, and parked the board gap (its Decision 5, L411-420). The shipped
  dialog is `RemoveDialog`, `app/src/books/BookDetail.jsx:93-141`, its copy
  `app/src/i18n/locales/en.js:186-196`.
- **design.leave_book** / **books.leave** (`complete 100`,
  `tasks/refinements/design/leave_book.md`, `tasks/refinements/books/leave.md`)
  — the Leave confirmation's counted-loss voice, drawn on
  `docs/mockups/Leave-book.dc.html`, which workflow 10 L106 says counts "as
  *Remove from my shelf* counts it".

Downstream: `milestones.m5_complete` (`tasks/99-milestones.tji:44`) waits on
this task; and `books.remove_counts_unsaved` (registered here, below) builds
the one line of this board the app does not show yet.

## What this task is

Draw, on two phones, a tablet and a computer, what *Remove from my shelf*
says when removing would lose something: a book on Estante with unsaved
changes and saves not yet pushed (what would be lost, counted, and asked);
a book only on this device (gone for good, with the download offered first);
and what follows a remove — the row gone from the shelf, and *Mine on
Estante* offering the book again, because removing keeps the membership.

## Why it needs to be done

Workflow 7 §Removing a book, and deleting one makes both confirmations
normative, but the W07 board draws only the in-step card line ("Deletes this
device's copy only. The book stays on Estante.",
`docs/mockups/W07-add-a-book.dc.html:216-220`). books.online built the cases
from the text alone and parked the gap (parking lot 2026-10-08, triaged into
this task on 2026-10-14). The boards are where the app's look and copy are
checked (`e2e/web/lib/mockup.js`, the UI audits); a case with no drawing has
nothing to check against. Drawing it also exposes that the shipped dialog
counts saves not yet pushed but not unsaved changes, which workflow 7 and
workflow 10 L106 both ask for.

## Inputs / context

- **Workflow 7** `docs/workflows/07-add-a-book.md:144-155` — Remove deletes the
  local clone only; with unsaved changes or saves not yet pushed it says what
  would be lost and asks; a book only on this device will be gone for good,
  and the download is offered first; removing keeps a member's membership, so
  *Mine on Estante* offers the book again (L28-31 define *Mine on Estante*);
  *Delete the book* is a different act (already drawn).
- **Workflow 10** `docs/workflows/10-share.md:106-111` — the counted-loss lines:
  *2 songs with unsaved changes will be lost*; saves not yet pushed counted.
- **Boards**
  - `docs/mockups/W07-add-a-book.dc.html` — the cast and the per-book detail
    this board continues: shelf rows (L252-257: *Banda do Bairro*, On Estante,
    *2 saves waiting to go up*; *Exercícios de violão*, On this device), the
    computer detail with Download / Remove / Delete cards (L210-226), the
    Delete dialog (L230-243). Registered `canvas.json` L69-75 (y 12140).
  - `docs/mockups/Leave-book.dc.html` — the supplementary-board precedent and
    the counted-loss voice: `.notice.unsaved` with a warning icon, *1 song with
    unsaved changes will be lost · Carinhoso* (L74), `role="alertdialog"`
    dialogs (L71, L120), *Download first* (L132), and the computer *Mine on
    Estante* dialog (L173).
  - Last registered board: Leave-book at y 34820; next free `y` on the 1620
    stride is **36440**.
- **GUIDE** `docs/mockups/GUIDE.md` — L3-8 (one workflow, two phones, tablet,
  computer, real copy), L19-24 (W02's head, helmet and script; 3208×1500),
  L27 (real buttons, `aria-label` on icon buttons, stroke SVG icons), L29 (the
  cast), L30 (device sizes), L34-43 (theme.css classes).
- **The shipped dialog** (`BookDetail.jsx:93-141`, `en.js:186-196`):
  - title `Remove “{name}” from this device?`; buttons *Cancel* and
    *Remove from my shelf* (danger);
  - hosted with saves waiting: *This device has {count} saves not yet on
    Estante; removing this copy loses them. The book stays on Estante.* — no
    Download;
  - device-only: *This book is only on this device. Removing it deletes it for
    good — there is no copy on Estante. Download it first to keep a copy.* —
    with a **Download** button that leaves the dialog open; device-only wins
    over any unsaved state;
  - unsaved changes are not counted (`tasks/refinements/books/leave.md:379-381`
    records the gap); `SURVEY_SIGN_OUT` already returns `unsavedSongs` and
    `savesWaiting` per book (leave.md Decision 2).
  - Tests pinning it: `app/src/books/BookDetail.behavior.test.jsx:127, :344`;
    `e2e/web/tests/online.spec.js:59`.
- **Design-refinement precedent** — `tasks/refinements/design/leave_book.md`,
  `recovery_email.md`: a supplementary board when the workflow's board is full
  (GUIDE fixes the size); registration by the closer; status in words; the
  republish entry in `tasks/parking-lot.md` L94 gets an *Updated* line.

## Constraints / requirements

- Draw the workflow, in the app's words. Where the app already says it, the
  board uses the shipped copy verbatim; the one line the app lacks (unsaved
  changes counted) uses workflow 10's and the Leave dialog's wording.
- Nothing invented beyond workflow 7 and 10: no Download in the hosted case,
  no fork offer on Remove (that is Leave's), no new verbs.
- Status carried by a word (`.badge`, notice text), never colour alone; the
  confirmations are `role="alertdialog"` with a labelled title, as Leave-book.
- Songs are written for the purpose (the cast's invented titles); no lyrics.
- **The board** follows `docs/mockups/GUIDE.md`: W02's head and script,
  3208×1500, two phones, a tablet, a computer, only `var(--…)` tokens, the
  cast (*My songs*, *Banda do Bairro*, *Exercícios de violão*, *Choros da
  Ana*), real copy from workflow 7, no invented features. Not rendered or
  published by the implementer.

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` Tests: clause: "none —
design deliverable (the board)"). Acceptance is what the board shows —
concrete enough that `books.remove_counts_unsaved`'s named tests are written
against it.

1. **The board** `docs/mockups/Remove-from-shelf.dc.html` exists, drawn to
   GUIDE.md: `.board-head` *Workflow 7 · Removing a book from the shelf*, a
   one- or two-sentence `board-sub` (Remove deletes this device's copy only;
   when that would lose something it counts it and asks; a book only on this
   device is gone for good, with the download first; the membership stays,
   so *Mine on Estante* offers the book again), and:
   - **Phone 1** · *Banda do Bairro*'s book detail, full-screen as the app
     opens it on a phone: chips *On Estante*, *You can save*; badge *2 saves
     waiting to go up*; the Download card; the Remove card with the shipped
     line *Deletes this device's copy only. The book stays on Estante.* and
     its button *Remove from my shelf*;
   - **Phone 2** · its confirmation (`.scrim.center` + `.dialog`
     `role="alertdialog"`): title *Remove “Banda do Bairro” from this device?*;
     two counted lines in a `.notice.unsaved` with the warning icon — **1
     song with unsaved changes will be lost** · *Rua do Porto*, and the
     shipped *This device has 2 saves not yet on Estante; removing this copy
     loses them. The book stays on Estante.*; buttons **Cancel** and
     **Remove from my shelf** (danger); no Download — *pins
     books.remove_counts_unsaved's "the confirmation counts unsaved songs
     beside saves waiting"*;
   - **Tablet** · *Exercícios de violão*'s detail (chip *Only on this
     device*, its Put online card) under the device-only confirmation: title
     *Remove “Exercícios de violão” from this device?*; the shipped body
     *This book is only on this device. Removing it deletes it for good —
     there is no copy on Estante. Download it first to keep a copy.*; buttons
     **Cancel**, **Download** (with the download icon), **Remove from my
     shelf** (danger); a `t-small` under the body naming what the download
     holds, from W07's Download card: *the whole history, and unsaved changes
     as modified files*;
   - **Computer** · the Books screen after removing *Banda do Bairro*: the
     shelf without its row (*My songs* selected, *Choros da Ana*,
     *Exercícios de violão*), and the *Add a book* dialog open on **Mine on
     Estante**, listing *Banda do Bairro* (*On Estante · can save*) to add
     back — the membership kept (workflow 7 L151-153);
   - status in words (`.badge`, notice text), never colour alone.
   - Registration: `boards["Remove-from-shelf.dc.html"]` `{ x: 0, w: 3208,
     h: 1500, title: "7. Removing a book from the shelf" }` at the next free
     `y` on the 1620 stride when it lands (`36440` today, after Leave-book at
     `34820`), appended to `order` — by the closer. No other board touched.
2. **The parking-lot republish entry** (`tasks/parking-lot.md` L94) gets an
   *Updated* line naming the new board (by the closer); W07 there is resolved
   as this board.
3. **No code tests, and none deferred.** The board pins behavior that
   books.online already tests for the device-only case
   (`BookDetail.behavior.test.jsx:344`, `online.spec.js:59`) and the
   saves-waiting count (`BookDetail.behavior.test.jsx:127`); the unsaved count
   is new behavior whose tests ride with the task that builds it.
4. **Deferred follow-up** — `books.remove_counts_unsaved` (closer registers in
   WBS; milestone `milestones.m5_complete`; depends `design.w07_remove_board`;
   note does **not** start with `cifra.md:`), 0.5d: "Remove from my shelf
   counts unsaved songs beside saves waiting, as workflow 7 §Removing a book
   and workflow 10 L106 say and the Remove-from-shelf board draws: the
   confirmation reads both from `SURVEY_SIGN_OUT` (as the Leave dialog does,
   books.leave Decision 2) and shows *N songs with unsaved changes will be
   lost* with their titles; the device-only case unchanged. Tests: behavior
   (`BookDetail.behavior.test.jsx` — a hosted book with an unsaved song and
   no saves waiting asks and counts it; with both, both lines; axe); e2e-web
   (`online.spec.js` — edit a song in a hosted book without saving, Remove
   names the song in its confirmation, confirm, the row is gone; axe; phone,
   tablet, computer)." Its e2e journey needs a hosted book (books.online,
   complete) and an unsaved edit (songs.editor and sync.unsaved, complete) — both reachable
   through the real UI.

## Decisions

### A supplementary board, not more frames on W07

**Chosen:** a new board `Remove-from-shelf.dc.html`, *Workflow 7 · Removing a
book from the shelf*, beside W07. **Rejected:** fitting the confirmations into
W07. W07's four frames already carry four distinct decisions (the shelf; the
four ways in; the upload preview; the detail with the Delete dialog), GUIDE
fixes the board at 3208×1500, and a frame holds one overlay — a Remove dialog
would have to displace the Delete dialog or the Add sheet, undrawing another
normative case. leave_book and recovery_email set this precedent when W10 and
W13 were full. The task's title says "on W07"; its ask — that workflow 7's
Remove cases be drawn — is met by a workflow-7 board.

### The board draws the workflow's count, not only what shipped

**Chosen:** Phone 2 counts unsaved songs *and* saves waiting, and a WBS task
brings the app up to it. **Rejected:** drawing only the shipped saves-waiting
line ("as already implemented by books.online", read literally). Workflow 7
says "with unsaved changes or saves not yet pushed, it says what would be
lost", and workflow 10 L106 builds Leave's counting on Remove's; the shipped
gap is recorded in books/leave.md L379-381. A board that copied the gap would
make the drawing disagree with the constitution and leave the gap with
nothing to be checked against. Everything else on the board is the shipped
copy verbatim.

### The device-only case wins over unsaved changes

**Chosen:** a book only on this device shows the *gone for good* body alone,
whatever it holds unsaved, as the app does. **Rejected:** a combined dialog
listing counts too. Everything is lost in that case — the counts add nothing
the sentence does not say — and the Download offered keeps the unsaved
changes as modified files (W07's Download card), which the tablet's small
line says.

### The button says *Download*, as shipped

**Chosen:** **Download**, which keeps the dialog open so Remove can follow.
**Rejected:** relabelling to *Download first* (Leave's label). The body
already says "Download it first to keep a copy"; the board draws the app,
and a label change is no workflow decision.

### The in-step remove is not drawn again

W07 already draws the card line for a book with nothing to lose; the shipped
app also confirms that case with the same line. The workflow does not forbid
asking, so the board leaves it as W07 has it and spends its frames on the
cases the workflow names.

### No document delta

Workflow 7 already decides every case drawn here (L148-153), and workflow 10
L106 already points at Remove's counting. DIRECTION §6 lists design gaps;
this is a drawing gap in an existing workflow, not a new decision, so §6 and
§7 are unchanged — as display_preferences left §7 when it added frames.

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-15.

- Drew `docs/mockups/Remove-from-shelf.dc.html` (not rendered; tags checked balanced): Phone 1 the Banda do Bairro detail with the *2 saves waiting to go up* badge and the Download, Remove and Leave cards.
- Phone 2: the alertdialog counting *1 song with unsaved changes will be lost · Rua do Porto* beside the shipped saves-waiting line, with no Download.
- Tablet: the device-only dialog for Exercícios de violão with Cancel, Download and Remove from my shelf, and a note on what the download holds.
- Computer: the shelf without Banda do Bairro, and *Add a book* open on Mine on Estante offering it again.
- Registered the board in `docs/mockups/canvas.json` (y 36440) and updated the republish entry in `tasks/parking-lot.md`; workflow and DIRECTION unchanged.
- Follow-up registered: `books.remove_counts_unsaved` in `tasks/65-books.tji`, wired into `m5_complete`.

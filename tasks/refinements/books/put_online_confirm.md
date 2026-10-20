# Refinement — `books.put_online_confirm`

## TaskJuggler

[`tasks/65-books.tji`](../../65-books.tji), `task put_online_confirm "Put
online asks first and says up to 50 people"` (line 234). The note:

> Items 7 and 8 of design.review_polish: Put online on the book detail opens a
> confirmation (Put {book} online?, what private means, up to 50 people; Cancel
> focused; focus back on the card's button), the local book's card says nobody
> else can see it yet, and every screen says up to 50 people
> (books.putOnlineBody, the successor of books.shareBody, the sharing screen's
> hint), in the four locales; the share panel's Put it online stays one press.
> Workflows 7, 10. Source: persona exploration 2026-10-19. Tests: behavior
> (BookDetail: Cancel sends nothing, Put online sends PUT_ONLINE, offline the
> failure line; axe); e2e-web (a local book put online through the dialog on
> phone, tablet and computer, then Share in the app bar; axe; the existing
> put-online journey in e2e/web/lib updated to pass the dialog). Refinement:
> tasks/refinements/design/review_polish.md

The note's back-link names the design refinement that decided the item (its
review findings 7 and 8 are both in its acceptance criterion **7**; its
criterion 8 is the setlist item `books.setlist_done` built). This document is
the build's own refinement; the closer points the note at
`tasks/refinements/books/put_online_confirm.md`.

## Effort estimate

0.5d, as the `.tji` gives it. One dialog modelled on `RemoveDialog`, three
strings changed or added in four locales, one line on the sharing screen, and
the e2e journey that some twenty specs pass through.

## Repository

This repository, not `cifra.md/` (the note does not start with `cifra.md:`):

- `app/src/books/BookDetail.jsx` — the dialog, the card;
- `app/src/books/ShareSheet.jsx` — the limit hint on the owner's sharing
  screen;
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`;
- tests: `app/src/books/BookDetail.behavior.test.jsx`,
  `app/src/books/ShareSheet.behavior.test.jsx`,
  `app/src/books/ShareNeedsOnline.behavior.test.jsx` (its copy assertion),
  `e2e/web/lib/journeys.js` (`putBookOnline`), `e2e/web/tests/book-detail.spec.js`,
  `e2e/web/tests/online.spec.js`.

No design delta: workflow 7 §Putting a book online
(`docs/workflows/07-add-a-book.md:140-167`) and workflow 10 §At most fifty
people per book (`docs/workflows/10-share.md:27-39`) already say all of it —
`design.review_polish` wrote them. Decision 3 (focus after a successful put
online) fills a gap the workflow leaves without contradicting it, and is
recorded here.

## Inherited dependencies

- `design.review_polish` — **settled** (`complete 100`). Criterion 7
  (`tasks/refinements/design/review_polish.md:257-266`), the new copy
  (L378-380), Decisions *Up to 50, in digits* (L433-438) and *Put online asks
  on the detail, not in the share panel* (L440-447); the offline note
  (L188-189). Board: `docs/mockups/Review-polish.dc.html` Tablet frame *Put
  online, asking* (L99; the card L133-135, the dialog L150-158,
  `role="alertdialog"`, Cancel drawn focused, `btn primary` Put online).
- `books.detail_as_drawn` — **settled** (`complete 100`). The detail's order
  and Share in the app bar (`shareRef`, `BookDetail.jsx:400-404, 471`); its
  Constraint 2 / Decision 5 (`tasks/refinements/books/detail_as_drawn.md:177-180,
  343-349`) removed `books.shareBody` and left the fifty wording to this task.
  Its e2e `book-detail.spec.js` presses the card's Put online.
- Already in place, complete: `books.online` (PUT_ONLINE, BOOK_ONLINE,
  BOOK_ONLINE_REFUSED and its worded reasons, `putOnlineFailureKey` in
  `app/src/books/book-display.js:370-376`), `books.share_needs_online` (the
  share panel's one-press Put online), `account.sign_in`, and the e2e-web
  journeys `signedInDevice`, `makeLocalBook`, `openBookDetail`,
  `putBookOnline`, `hostedBook` (`e2e/web/lib/journeys.js:200-232`).

Every test named below is driven by these: a signed-in device and a local
book come from `signedInDevice` + `makeLocalBook`; offline in behavior is a
BOOK_ONLINE_REFUSED `reason: 'offline'` event (as today's tests do). Nothing
is missing.

## What this task is

Put online on a local book's detail runs at once today, and nothing on the
card says the book is invisible to anyone else until then. This task makes
the card say it — *Only on this device: nobody else can see it. Put it online
to invite people — up to 50.* — and makes the card's **Put online** open a
dialog first: **Put {book} online?**, *It goes to Estante private: only you
can open it. Nobody else sees it until you invite them from Share — up to 50
people.*, with **Cancel** (focused) and **Put online**. Cancel sends nothing;
Put online sends PUT_ONLINE. The owner's sharing screen gains the one hint
*Invite people to read or edit this book — up to 50 people.* The share
panel's *Put it online* stays one press. All in four locales.

## Why it needs to be done

In the persona exploration (2026-10-19) a teacher pressed Put online without
knowing it created a book on a server, and nothing told her that her
students could not see the book before it was online; the limit was worded
*at most 50* in one place and *up to fifty* in another. Workflows 7 and 10
now decide both (review_polish findings 7, 8). It is one of the review's
items in `milestones.m5_complete`.

## Inputs / context

- **Workflow 7 §Putting a book online** (`docs/workflows/07-add-a-book.md:140-167`):
  private by default (L143); the card's sentence and *up to 50 people* in
  digits on every screen (L149-152); *Put online asks first, on the book's
  detail* — title, body, Cancel and Put online, focus on Cancel when it opens
  and back on the card's button when it closes (L154-162); a local dialog,
  offline it still opens and Put online fails as today; the share panel stays
  one press (L164-167). §A book's songs (L94-100): a local book has no Share.
- **Workflow 10 §At most fifty people per book** (`docs/workflows/10-share.md:27-39`):
  the sharing screen's hint *Invite people to read or edit this book — up to
  50 people.*; the detail has no Share card.
- **Board**: `docs/mockups/Review-polish.dc.html:99, 133-135, 150-158`.
- **The card today** `app/src/books/BookDetail.jsx:510-524`: heading
  `books.putOnline`, `books.putOnlineBody`, the failure line
  (`p.t-small.detail-error role="status"`, L515-519), the `Button` with
  `onPress={putOnline}` (L520-523). `putOnline` L439-442 clears the failure
  and sends PUT_ONLINE. BOOK_ONLINE → `onReselect(newId)` (L413-418);
  BOOK_ONLINE_REFUSED → `setFailure(reason)` (L420-422); `failureCopy`
  L453-454.
- **Dialog pattern to follow**: `RemoveDialog` (`BookDetail.jsx:117-198`) —
  controlled `DialogTrigger` with the trigger `Button` inside it, so RAC
  returns focus to the trigger on close; `ModalOverlay.scrim.center`,
  `Modal.dialog`, `Dialog`, `Heading slot="title" className="t-h2"`,
  `.actions` with Cancel `books.cancel`. `LeaveDialog.jsx:112` uses
  `Dialog role="alertdialog"` (as the board draws this one). Cancel
  autofocused: `AddToSetlist.jsx:297` (`autoFocus` on a RAC `Button`).
- **Share panel** `app/src/books/ShareNeedsOnline.jsx:42` (PUT_ONLINE
  directly), L51-52 (`sharing.needsOnline`, then `books.putOnlineBody` — so the
  new card sentence shows there too), L65-67 (the button).
- **Sharing screen** `app/src/books/ShareSheet.jsx:186-190` (the owner's
  `sharing.intro`; `copy.intro` for a song or setlist share), the people bar
  `members.count`/`members.limit` (L217-218, L237).
- **Strings**: en `books.cancel` L102, `books.putOnline` L195,
  `books.putOnlineBody` L196-197 (today *Only on this device. Putting it
  online creates it on Estante, private: only you can open it, until you
  invite people to it, at most 50.*), `books.putOnlineOffline` L200,
  `sharing.intro` L280; pt-BR / es-419 / it: `books.putOnlineBody` L183-184,
  `sharing.intro` L256. Parity test `app/src/i18n/i18n.test.js:46`.
- **Tests that exist**: `BookDetail.behavior.test.jsx` — helpers `makeStore`
  L21-27, `lastCommand` L29, `renderDetail` L31-36, `localShelf` L39-43,
  `checkWcag21aa` L12; L61 the local book's controls; L90-101 *Put online
  dispatches PUT_ONLINE, and a quota refusal words a message* (clicks the
  card and expects PUT_ONLINE at once — moves through the dialog); L847 the
  restored-focus describe; L950 the local detail's order.
  `ShareNeedsOnline.behavior.test.jsx:51` asserts the old `putOnlineBody`
  text by regex. `ShareSheet.behavior.test.jsx:92` the owner's intro.
  e2e: `putBookOnline` (`e2e/web/lib/journeys.js:207-212`), used directly by
  add-by-link, commit-author, conflicts, leaving, new-device,
  setlists-resilient, and through `hostedBook` (journeys.js:226-232) and
  `hostedBookWithSong` (`journeys-share.js:50-56`) by some fifteen more specs;
  inline card clicks at `e2e/web/tests/online.spec.js:37` and
  `e2e/web/tests/book-detail.spec.js:34`; `share-needs-online.spec.js:53-56`
  presses the panel's button (unchanged).

## Constraints / requirements

1. **The card** (`BookDetail.jsx:510-524`) keeps its heading and its button
   (still named *Put online*, the `OnlineIcon`, `btn`); its body is the new
   `books.putOnlineBody`: en *Only on this device: nobody else can see it.
   Put it online to invite people — up to 50.* (review_polish L378). The same
   key in the share panel (`ShareNeedsOnline.jsx:52`) shows the same words —
   intended, one sentence for one state.
2. **The dialog** (`PutOnlineDialog`, a function in `BookDetail.jsx` beside
   `RemoveDialog`): the card's button is its `DialogTrigger` trigger; RAC
   `ModalOverlay.scrim.center` › `Modal.dialog` › `Dialog role="alertdialog"`;
   `Heading slot="title"` `books.putOnlineConfirmTitle` (en *Put {name}
   online?*, the book's title); a `t-body` paragraph
   `books.putOnlineConfirmBody` (en *It goes to Estante private: only you can
   open it. Nobody else sees it until you invite them from Share — up to 50
   people.*); `.actions`: **Cancel** (`books.cancel`, `btn`, `autoFocus`,
   closes) then **Put online** (`books.putOnline`, `btn primary`; calls the
   existing `putOnline` and closes). Escape and the scrim cancel, as in every
   detail dialog. Closing returns focus to the card's button (RAC's trigger
   restore).
3. **Nothing runs before the answer.** Opening the dialog sends no command;
   Cancel sends nothing. Put online sends exactly one PUT_ONLINE, then the
   card behaves as today: the failure line on BOOK_ONLINE_REFUSED (offline
   → `books.putOnlineOffline`, quota, signed out — `putOnlineFailureKey`
   unchanged), the button there to try again (which asks again).
4. **Offline first.** The dialog is local: it opens offline with no check of
   the network; Put online offline gives today's failure line (workflow 7
   L164-166). No disabled state, no network wait in the view.
5. **Focus after success** (Decision 3): when BOOK_ONLINE moves the detail to
   the hosted book, the card (and its button) is gone; focus goes to **Share**
   in the detail's app bar, through the existing `shareRef`, once, only when
   the put online was confirmed from this detail.
6. **The sharing screen's hint**: a new `sharing.limitHint` (en *Invite people
   to read or edit this book — up to 50 people.*) in `ShareSheet.jsx`, a
   `t-small` line right after the intro, on the **owner's** screen — book,
   song or setlist share alike (every invitation joins the whole book). Not
   on a member's screen (they cannot invite). The people bar's *37 of 50*
   stays as it is.
7. **The share panel stays one press**: `ShareNeedsOnline.jsx` gets no dialog
   (review_polish Decision L440-447).
8. **Four locales**: `books.putOnlineBody` rewritten, and
   `books.putOnlineConfirmTitle`, `books.putOnlineConfirmBody`,
   `sharing.limitHint` added in en, pt-BR, es-419 and it, each with *50* in
   digits and *up to* (not *at most*) wording (review_polish Decision *Up to
   50, in digits*). `{name}` interpolation as `books.removeTitle` uses it.
   Strings that mention 50 without stating the limit to an inviter
   (`sharing.peopleExplainer` en L301, the invitation room notice L393-394,
   `smallPrint` L1084) are not this task's — they describe what happens at
   the limit, not the limit.
9. **Accessibility**: RAC for every control; the dialog has its heading as its
   name; axe WCAG 2.1 AA with the dialog open and on the detail and sharing
   screen; status in words.
10. **Existing tests move with the behavior, never weakened**: the L90-101
    behavior test goes through the dialog; `ShareNeedsOnline.behavior.test.jsx:51`
    asserts the new sentence; `putBookOnline` and the two inline e2e clicks
    pass the dialog. With the dialog open RAC hides the background from the
    accessibility tree, so the dialog's *Put online* is the only button of
    that name a role query finds; journeys still scope the confirm to the
    `alertdialog` for clarity.

## Acceptance criteria

Behavior delivered: Constraints 1-10 — the card's new sentence; the card's
Put online asking first with Cancel focused, focus back on the card's button
on close and on Share after success; the share panel unchanged in behavior;
the owner's sharing screen's *up to 50 people* hint; four locales.

Tests, by level:

- **unit** — `app/src/i18n/i18n.test.js` (existing parity test) covers the
  three new keys and the rewritten one in all four locales.
- **behavior** — `app/src/books/BookDetail.behavior.test.jsx`, a new describe
  *Put online asks first (workflow 7 §Putting a book online)*:
  - *pressing the card's Put online opens "Put My songs online?" with the
    private-and-up-to-50 body, Cancel focused, and sends nothing; axe clean
    with the dialog open*;
  - *Cancel (and Escape) close it, send no PUT_ONLINE, and focus returns to
    the card's Put online*;
  - *the dialog's Put online sends one PUT_ONLINE for the book and closes,
    focus on the card's button*;
  - *offline: the dialog still opens, and after Put online a refusal with
    reason offline shows "You're offline. Connect, then put it online." on the
    card* (workflow 7 L164-166);
  - *after a confirmed put online, BOOK_ONLINE and the hosted book's detail
    put focus on Share in the app bar* (Constraint 5; the test re-renders the
    detail with the new id and a hosted shelf, as `onReselect` makes the
    shell do);
  - *the local card reads "Only on this device: nobody else can see it. Put
    it online to invite people — up to 50."*;
  - the existing L90-101 test updated to confirm in the dialog before
    expecting PUT_ONLINE and the quota message.
  `app/src/books/ShareSheet.behavior.test.jsx`: *the owner's sharing screen
  says "Invite people to read or edit this book — up to 50 people.", a
  member's does not* (workflow 10 §At most fifty; axe as the file's existing
  checks). `app/src/books/ShareNeedsOnline.behavior.test.jsx:47`: the
  existing test asserts the new sentence and still sends PUT_ONLINE on one
  press, no dialog (Constraint 7).
- **e2e-web** — `e2e/web/lib/journeys.js` `putBookOnline` presses the card's
  Put online, then **Put online** in the `alertdialog`, then waits for *On
  Estante · private*; every spec using it (directly or through `hostedBook` /
  `hostedBookWithSong`) still runs. `e2e/web/tests/book-detail.spec.js`
  (the as-drawn test) and `e2e/web/tests/online.spec.js:19` confirm in the
  dialog where they click the card inline. New test in
  `e2e/web/tests/book-detail.spec.js`: *a local book put online asks first,
  Cancel leaves it local, and Put online makes it private on Estante with
  Share in the app bar (workflow 7 §Putting a book online)*, on phone, tablet
  and computer: `signedInDevice`, `makeLocalBook`, `openBookDetail`; the card
  reads *nobody else can see it* and *up to 50* (axe); press Put online — the
  dialog *Put {book} online?* with *up to 50 people*, Cancel focused (axe with
  it open); Cancel — no dialog, still no Share, focus on the card's Put
  online; press Put online again, then the dialog's Put online — *On Estante
  · private*, Share in the app bar, focused; press Share — the sharing screen
  reads *Invite people to read or edit this book — up to 50 people.* (axe).

## Decisions

### 1. The dialog follows `RemoveDialog`, as an alertdialog with Cancel autofocused

**Chosen:** the card's button as the `DialogTrigger` trigger, so RAC restores
focus to it on close (the workflow's "back on the card's button") with no
code; `role="alertdialog"` as the board draws it and `LeaveDialog` does;
`autoFocus` on Cancel as `AddToSetlist.jsx:297`. **Rejected:** a controlled
`ModalOverlay` with manual focus return — more code for what the trigger
already gives; a generic shared confirm component — one more call site does
not justify it, and every detail dialog is written out today.

### 2. The dialog closes on Put online; progress and failure stay on the card

**Chosen:** close at once and let the card show the failure line as today.
**Rejected:** keeping the dialog open with a pending state until BOOK_ONLINE —
the push can take a while, offline fails at once anyway, and the card is
where the failure line and the retry already live (`books.online`).

### 3. After a confirmed put online, focus goes to Share

**Chosen:** the card's button disappears when the book becomes hosted, so
"back on the card's button" cannot hold past success; Share in the app bar is
the next thing workflow 7 says the person does with a private book, and the
detail already focuses it through `shareRef` for the restored-focus case.
**Rejected:** leaving focus to fall to the document body (a keyboard and
screen-reader user loses their place); the heading of the detail — not a
control, and Share is what the dialog's body points at ("invite them from
Share").

### 4. The limit hint on the owner's sharing screen, for book, song and setlist shares

**Chosen:** one `t-small` line after the intro whenever the owner sees the
screen: the limit is per book and every invitation, from a song or a setlist
too, joins the whole book. **Rejected:** replacing `sharing.intro` — it says
something else (each with their own account) that workflow 10 keeps; showing
it to members — they cannot invite, and their screen already shows the count.

### 5. Other "50" strings stay

**Chosen:** only strings that tell an inviter the limit change. The
invitation-room notice and the explainer say what happens *at* 50, and
`smallPrint` states the service's terms; review_polish's finding was the two
competing statements of the limit (*at most 50*, *up to fifty*), both gone
with this task. **Rejected:** rewording every 50 — churn in four locales for
sentences the review did not flag.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-20.

- The local book's card says "Only on this device: nobody else can see it. Put it online to invite people — up to 50." and its Put online opens a confirmation dialog (Cancel focused, focus back on the card's button, then on Share after success): `app/src/books/BookDetail.jsx`.
- The owner's sharing screens say "up to 50 people": `app/src/books/ShareSheet.jsx`, and `app/src/books/PeopleScreen.jsx` (tablet and computer open the people screen as "the sharing screen"). The share panel's Put it online stays one press.
- Copy in all four locales: `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Behavior tests: `app/src/books/{BookDetail,ShareSheet,PeopleScreen,ShareNeedsOnline,SongSharePanel}.behavior.test.jsx`, `app/src/shell/AppShell.routing.behavior.test.jsx`.
- e2e-web: `e2e/web/lib/journeys.js` (`putBookOnline` through the dialog), `e2e/web/tests/{book-detail,online,share-needs-online}.spec.js`; green on phone, tablet and computer.
- A fixer updated the stale old-sentence assertion in `share-needs-online.spec.js`.
- No tech debt registered.

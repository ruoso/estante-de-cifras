# Refinement — `books.detail_as_drawn`

## TaskJuggler

[`tasks/65-books.tji`](../../65-books.tji), `task detail_as_drawn "The book
detail in the board order, Delete set apart"` (line 206). The note:

> M11: BookDetail stacks Download, Fork, Remove, Leave, a Share card, then the
> red Delete (BookDetail.jsx:465-548), so Delete sits under Share with no
> separation; W07 (docs/mockups/W07-add-a-book.dc.html:202-226) has Share in
> the app bar. As design.review_polish draws it: Share where the board puts
> it, Delete set apart at the end. Source: usability review 2026-10-19 (Claude
> in Chrome on the deployed app, findings verified against the code). Tests:
> behavior (the order and the separation, Share reachable, keyboard path;
> axe); e2e-web (the book detail on the three viewports; axe, mockup W07).

## Effort estimate

0.5d, as the `.tji` gives it. The work is a re-ordering of one component's
JSX plus one new prop (`mode`), a rule, two removed strings, and the tests.
There is no Worker, protocol or service change.

## Repository

This repository, not `cifra.md/` (the note does not start with `cifra.md:`):

- `app/src/books/BookDetail.jsx`, `app/src/books/book-detail.css`;
- `app/src/shell/AppShell.jsx` (the detail's mount, ~L1383-1394: pass
  `mode`);
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` (drop the Share card's
  strings);
- tests: `app/src/books/BookDetail.behavior.test.jsx`, a new
  `e2e/web/tests/book-detail.spec.js`, and an extension of
  `e2e/web/tests/leave-book.spec.js`.

No design delta. Workflow 7 §A book's songs
(`docs/workflows/07-add-a-book.md:94-111`) already says what this task builds.
`design.review_polish` wrote it, together with the W07 board edit.

## Inherited dependencies

- `books.row_opens_songs` is **settled** (`complete 100`). It made the detail
  a shell layer reached by *Manage*, with *Back to {book}*, *Rename* in the
  app bar and the *Files* card. On a computer the detail sits beside the
  book's songs. That refinement's L69 hands the re-ordering to this task.
- `design.review_polish` is **settled** (`complete 100`). Item 1 decided the
  order and the separation (refinement `tasks/refinements/design/review_polish.md:201-217`,
  Decision *Share moves to the app bar; the closing group ends with Delete*
  L386-396), and redrew W07 #4.
- These are complete but not in `depends`: `books.online` (put-online,
  Delete), `books.share` / `books.share_people` (the sharing and people
  screens, and the focus that comes back to Share), `books.leave`,
  `books.fork`, `books.add_by_link` (a member on a second device, which
  `leave-book.spec.js` already drives). The e2e-web harness has the journeys
  `openBookDetail`, `putBookOnline` and `hostedBook` (`e2e/web/lib/journeys.js:201-226`)
  and `pressShare` / `openSharing` (`e2e/web/lib/journeys-share.js:145-170`).
- Downstream: `books.put_online_confirm` depends on this task. Its e2e ends
  with "then Share in the app bar".

## What this task is

Today the book's detail stacks its cards as Download, Files, Fork, Remove,
Leave, a **Share card**, and then the red **Delete the book**. So the one act
that reaches everyone sits directly under Share, with nothing between them.
This task builds the detail as workflow 7 and W07 draw it:

- **Share** moves into the detail's app bar, at its right end, after Rename.
  It is a plain word button, and it shows for whoever had the card: a hosted
  book's owner, or a member.
- The Share card goes.
- The body runs: chips, then state cards, then Download, Files and Fork.
- Then comes a **rule with space above it**, and the closing group: Remove
  from my shelf, Leave this book, and last Delete the book.
- On a phone, Rename shrinks to its icon. Its name stays *Rename {book}*.
- The keyboard follows the same order: Back, Rename, Share, then the body.

## Why it needs to be done

The usability review of 2026-10-19 found Delete set directly under Share, a
place where a mis-tap costs everyone their book. It also found Share buried
below Fork and Remove, though Share is the act most people come to the detail
for. Workflow 7 and W07 #4 already moved it. The app is the last place that
still draws the old order. `books.put_online_confirm` builds on the new app
bar, because after its confirmation the journey continues to "Share in the
app bar".

## Inputs / context

- **Workflow 7 §A book's songs** (`docs/workflows/07-add-a-book.md:94-111`):
  - The app bar is Back, the title, Rename, and Share at the right end.
  - On a phone Rename is an icon named *Rename {book}*, and Share is a word.
  - A local book has no Share, and there is no Share card.
  - The body is the chips, the state cards, Download, Files and Fork. Then a
    rule with space above it (not a heading) and the closing group: Remove,
    Leave, and Delete last.
  - Each card shows only for whom it applies. The keyboard order is Back,
    Rename, Share, then the body.
- **Workflow 10** (`docs/workflows/10-share.md:33-35`): the detail has no
  Share card, because Share is in its app bar.
- **Board**: W07 Computer, `docs/mockups/W07-add-a-book.dc.html:178-239`.
  - App bar (L201-207): the icon Back, the title, a `btn quiet` pencil +
    *Rename*, a spacer, and `<button class="btn">Share</button>`.
  - Body (L208-239):
    - the chips;
    - a row of Download | Files;
    - `<div role="separator" style="border-top: 1px solid var(--line);
      margin-top: 14px">` (L226);
    - a row of Remove | Delete the book (`btn danger`), with Delete last.
  - The local book's app bar (no Share) is drawn on
    `docs/mockups/Review-polish.dc.html:99-136` (Tablet).
- **Design refinement**: `tasks/refinements/design/review_polish.md:201-217`
  (acceptance item 1) and L386-396 (the Decision; a *Danger zone* heading
  was rejected).
- **The component** `app/src/books/BookDetail.jsx`:
  - the flags at L331-389: `isLocal`, `isOwner`, `offersFork` L364,
    `offersLeave` L377, `offersShare = (isOwner && !isLocal) || offersLeave`
    L389;
  - the Share focus-return effect L385-397 (`shareRef`, `autoFocusShare`,
    `onShareFocusReturned`);
  - the app bar L448-456: Back `books.backToBook`, title, `RenameDialog`;
  - `RenameDialog` L202-250: trigger `btn quiet rename-btn`,
    `aria-label={books.renameLabel}`, pencil + word;
  - the body L458-652, in order: chips, original-gone, put online,
    lost-access, cannot-save, taken-down, Download, Files, Fork, Remove,
    Leave, the **Share card L629-644**, Delete L646-652 (`DeleteDialog`
    L256-299).
- **The shell** `app/src/shell/AppShell.jsx`:
  - the detail mount L1383-1394 passes no `mode` today;
  - `shareBook` L1023-1026 opens the people screen when wide, and the phone
    sheet otherwise;
  - `useLayoutMode` L115;
  - `SongReading` takes `mode` as a prop, with a `'narrow'` default
    (`app/src/songs/SongReading.jsx:151`), which is the precedent;
  - CSS: `book-detail.css:31-33` (`.rename-btn {flex:none}`).
- **Strings** in `app/src/i18n/locales/en.js:261-264`: `books.share`,
  `books.shareBody`, `books.shareBodyMember`, plus the comment "The
  owner-only Share card". pt-BR/es-419/it have them at L241-243. The parity
  test is `app/src/i18n/i18n.test.js:46` ("has every key English has, and no
  others").
- **Tests that exist**:
  - `BookDetail.behavior.test.jsx`:
    - `makeStore`/`renderDetail` L21-58, with fixtures `localShelf`,
      `hostedShelf` (owner, *Choros da Ana*, `srv-1`), `memberShelf` (editor,
      `srv-2`) and later `readerShelf`;
    - L794 *Files follows Download*, which orders by the `.card > .t-h2`
      headings;
    - L843-877 *autoFocusShare focuses Share once*, which finds the button
      by `{name: 'Share', exact: true}`;
    - axe via `checkWcag21aa`.
  - e2e:
    - `online.spec.js:19-58`, which captures W07 #4 at L54 with the Delete
      dialog open;
    - `share.spec.js:211, 241`, which press Share, check its focus and run
      axe on the detail;
    - `leave-book.spec.js:67` (a reader's detail);
    - `books.spec.js:69-84` (Rename by `Rename ${NAME}`).
  - Every book-detail Share or Delete locator is page-wide and matches by
    name: `journeys-share.js:154`, `share.spec.js:212/242`,
    `online.spec.js:51`, `leave-book.spec.js:79`.
  - Mockup capture is `e2e/web/lib/mockup.js`. It asserts nothing and
    screenshots only in the frame's own project. W07 #4 is `desktop`
    (`mockup-frames.json:212-216`).

## Constraints / requirements

1. **The app bar**: Back, the title, Rename, then **Share** at the right end
   (`margin-inline-start: auto`, as the board's spacer does).
   - Share is a RAC `Button`, `className="btn"`, with the visible word
     `books.share` and no `aria-label`. Its accessible name stays exactly
     *Share*.
   - It carries `ref={shareRef}`, so the existing focus return keeps
     working, and `onPress={() => onShare(bookId)}`.
   - It shows exactly when `offersShare` holds. The flag is unchanged: a
     local book, the home book of a member, and a `gone` or taken-down
     member's book show no Share, as today.
   - There is exactly one *Share* button on the screen.
2. **No Share card.** Remove `books.shareBody`, `books.shareBodyMember` and
   their comment from all four locales. Keep `books.share`.
   `books.put_online_confirm` writes its own `books.putOnlineBody` copy for
   the fifty-person wording.
3. **The body order**, each card under its existing condition:
   - the chips;
   - original-gone, put online, lost access, can't save, taken down;
   - Download, Files, Fork;
   - the rule;
   - Remove, Leave, Delete.
   
   Delete is the last control in the body. It keeps its `btn danger`
   `DeleteDialog` and its typed-name confirm, unchanged.
4. **The rule** is a RAC `Separator` (renders `role="separator"`), class
   `detail-rule`.
   - Its CSS uses only theme tokens: `border-top: 1px solid var(--line)`,
     with space above it (W07 L226's `margin-top: 14px` on top of the body
     gap).
   - It has no heading and no text.
   - Remove shows for every book, so the rule always has the closing group
     after it.
5. **The phone's Rename**: `BookDetail` takes a `mode` prop (`'narrow' |
   'wide'`, default `'narrow'`, as `SongReading`). `AppShell` passes its
   `useLayoutMode()` value.
   - When narrow, the Rename trigger renders only the pencil.
   - Its `aria-label` (*Rename {book}*) is unchanged, so the button keeps its
     name and stays reachable.
   - When wide, it keeps pencil + word.
   - Share is a word on every mode.
   - The app bar fits a phone (370px) without cutting off or wrapping its
     controls (`shell.narrow_fit`). The title ellipsizes.
6. **The keyboard path** follows the drawn order, because the DOM order is
   the order: Back, Rename, Share, then the body's controls top to bottom,
   with Delete last. Nothing uses `tabIndex` to reorder.
7. **Unchanged behavior**:
   - Share opens the sharing screen (owner) or the people screen (member) on
     tablet and computer, and the sheet on a phone (`shareBook`).
   - Focus comes back to Share when those close.
   - Remove, Leave and Delete close the detail as before.
   - Leave's offline notice stays inside its card.
   - The computer split (`row_opens_songs` Decision) is untouched.
8. **Accessibility**: RAC for every control; axe WCAG 2.1 AA on every state
   the tests render; nothing carried by colour alone. Delete's danger style
   is backed by its words.
9. **Existing tests move with the layout, never weakened.**
   - L794's heading order becomes the new order.
   - Every page-wide `{name: 'Share', exact: true}` locator keeps working,
     because there is still exactly one Share.
   - `books.spec.js`'s `Rename ${NAME}` locators keep working on the phone
     through the `aria-label`.

## Acceptance criteria

Behavior delivered: Constraints 1-9. The detail reads as W07 #4 and
workflow 7 §A book's songs draw it:

- Share is in the app bar for an owner of a hosted book and for a member,
  and is absent for a local book;
- there is no Share card;
- Download, Files and Fork come first, then a rule, then Remove, Leave and,
  last, Delete;
- Rename is an icon on a phone;
- the keyboard order is Back, Rename, Share, then the body.

Tests, by level:

- **unit**: `app/src/i18n/i18n.test.js` (the existing parity test). It
  covers the removal of the two keys in all four locales.
- **behavior**: `app/src/books/BookDetail.behavior.test.jsx`, a new describe
  *the detail as drawn (workflow 7 §A book's songs; W07 #4)*:
  - *a hosted book's owner: the app bar holds Back, Rename and Share in that
    order. There is no Share card. The body's headings run Download, Files,
    then the rule, then Remove from my shelf, Delete the book, and Delete is
    the last button. Axe clean.* This uses `hostedShelf`. It checks that the
    `separator` sits after the Files card and before the Remove card in
    document order (`compareDocumentPosition`). It also checks that
    `.appbar` contains `{name: 'Share', exact: true}` and that the scroll
    body does not.
  - *a member: Share in the app bar, and the body runs Download, Files, Fork,
    the rule, Remove, Leave this book, with no Delete. Axe clean.* This uses
    `memberShelf`, and pins workflow 7: each card shows only for whom it
    applies.
  - *a local book: no Share anywhere. Put online comes first after the
    chips, then Download and Files, then the rule and Remove. Axe clean.*
    This uses `localShelf`, and pins workflow 7: a book only on this device
    has no Share.
  - *a member's book once access is gone: no Share and no Leave. The
    lost-access card comes before Download, and the rule still precedes
    Remove.* This uses the `gone` phase.
  - *Share is reachable and does what it did: pressing it calls
    onShare(bookId)*, for the owner and for the member.
  - *the keyboard path follows the drawn order: Tab from the start of the
    detail reaches Back, Rename {book}, Share, then Download, and the last
    Tab stop in the body is Delete the book.* This uses `userEvent.tab()`
    and pins workflow 7: "Back, Rename, Share, then the body".
  - *on a phone (mode narrow) Rename shows no word but is named Rename
    {book} and opens its dialog; wide, it shows Rename*.
  - The existing tests are kept:
    - L794 *Files follows Download* is updated to the new full order;
    - L843 *autoFocusShare focuses Share once* passes unchanged, now
      against the app-bar button.
- **e2e-web**:
  - a new `e2e/web/tests/book-detail.spec.js`, test *the book detail as
    drawn: Share in the app bar, Delete set apart at the end (workflow 7 §A
    book's songs; W07 #4)*, on phone, tablet and computer. The steps:
    1. `signedInDevice`, `makeLocalBook`, `openBookDetail`.
    2. On the local book there is no *Share* button, and *Put online* is
       present. Run axe.
    3. Press *Put online*. *On Estante · private* appears, and *Share* shows
       in `.book-detail .appbar`.
    4. In the body, the `separator` is above *Remove from my shelf*, and
       *Delete the book* is the lowest button (bounding boxes). On a phone,
       the Rename button shows no visible word. Call
       `mockup(page, 'W07-add-a-book', 4, { note: 'as drawn' })` (desktop
       only, by the frame's kind). Run axe.
    5. Focus *Back to {book}*, then press Tab: *Rename {book}*, then
       *Share*, are focused in turn (real keyboard).
    6. Press Enter on Share. The sharing screen (tablet/computer) or the
       sheet (phone) opens, as `pressShare` expects. Close it. Focus is back
       on Share in the app bar. Run axe.
  - `e2e/web/tests/leave-book.spec.js:67` is extended. On the reader's
    detail, *Share* is in `.book-detail .appbar`, and *Leave this book*
    comes after the separator, with no *Delete the book*. This is the member
    side on the three viewports, through the existing `books.add_by_link`
    journey.
  - The existing book-detail specs (`online.spec.js`, `share.spec.js`,
    `fork.spec.js`, `lost-access.spec.js`, `notice-surface.spec.js`,
    `books.spec.js`, `full-height.spec.js`, `open-a-book.spec.js`) still run
    green, unchanged or with only their words updated.

## Decisions

### 1. Rebuild in place, no new shared app-bar component

**Chosen:** re-order `BookDetail`'s own JSX and move the Share button into
its own `.appbar`, as every deep screen does (`HeaderChrome.jsx:1-8`: "deep
screens keep their own `.appbar`"). **Rejected:** a shared app-bar component
for the detail, songs and setlists. That would be a new seam with nothing to
gain for one screen, and the song and setlist bars fold Share into ⋯ on
narrow screens, which this one must not do.

### 2. Share stays a word on the phone, never in a ⋯ menu

**Chosen:** a visible *Share* word on every mode, as workflow 7 says. Room is
made by turning Rename into an icon on the phone. **Rejected:** the
song/setlist pattern of Share behind ⋯ on narrow screens. The detail has no ⋯
menu, workflow 7 decides otherwise, and `pressShare` (the journey every
sharing e2e uses) expects a visible Share.

### 3. The phone's icon Rename comes from a `mode` prop, not CSS

**Chosen:** `mode` passed by the shell, as `SongReading` takes it, so the
behavior test can render both modes. **Rejected:** (a) a media query that
hides the word. jsdom cannot drive it, so the phone form could not be pinned
below e2e, and a hidden word could linger in the name computation. (b)
Importing `useLayoutMode` into `BookDetail`. That is a cycle with
`AppShell.jsx`, which mounts it.

### 4. The rule is a RAC `Separator`

**Chosen:** `Separator` from react-aria-components, which renders
`role="separator"` as the board does at L226. Tests and assistive technology
can find it. **Rejected:** a CSS-only margin or border on the Remove card.
That cannot be asserted by role, and it would break if Leave or Remove were
hidden. A *Danger zone* heading was already rejected by `review_polish`.

### 5. The Share card's copy is dropped, not moved

**Chosen:** delete `books.shareBody` and `books.shareBodyMember` in all four
locales. The parity test keeps them from lingering. **Rejected:** a tooltip,
or keeping the line under the chips. W07 draws neither, and the people
screen itself says who shares the book. The fifty-person wording belongs to
`books.put_online_confirm` (`books.putOnlineBody`).

### 6. A new e2e spec rather than growing `online.spec.js`

**Chosen:** `book-detail.spec.js` owns the as-drawn journey (the order, the
rule, the keyboard, Share and back), and the member side extends
`leave-book.spec.js`. **Rejected:** stacking the assertions into
`online.spec.js`'s put-online/download/delete test, which already pins a
different promise (workflow 7 §Putting a book online) and captures W07 #4
with the Delete dialog open. The new capture shows the detail itself.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- The book detail follows the W07 board's order: Download, Files, Fork, a rule (React Aria `Separator`), then Remove, Leave and Delete last — `app/src/books/BookDetail.jsx`, `app/src/books/book-detail.css`.
- Share moved into the app bar after Rename for the owner of a hosted book or a member; the Share card is gone. On a phone Rename is an icon still named *Rename {book}*. `app/src/shell/AppShell.jsx` passes the new `mode` prop.
- `books.shareBody` and `books.shareBodyMember` dropped from `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- behavior: `app/src/books/BookDetail.behavior.test.jsx` — new describe "the detail as drawn" (owner, member, local, gone, Share calls `onShare`, keyboard path, phone/wide Rename); existing tests moved with the layout, not weakened. The keyboard test lists Tab stops in DOM order (no `user-event` dependency); the real Tab key is in e2e-web.
- unit: `app/src/i18n/i18n.test.js` (existing parity test, unchanged).
- e2e-web: new `e2e/web/tests/book-detail.spec.js` (phone, tablet, computer) and the member side added to `e2e/web/tests/leave-book.spec.js`.
- WBS: `books.detail_as_drawn` marked `complete 100`; `books.put_online_confirm` now depends on it (`tasks/65-books.tji`). No tech-debt follow-ups.


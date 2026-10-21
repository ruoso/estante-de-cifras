# shell.sheet_close_placement — A sheet’s close sits at its right edge

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) line 175, task
`shell.sheet_close_placement` ("A sheet’s close sits at its right edge"),
under `task shell`. It `depends !narrow_fixes` and is listed in the milestone
`milestones.m5_complete` `depends` at `tasks/99-milestones.tji` line 45. The note,
verbatim:

> The Add a book sheet’s close ✕ sits beside its title instead of at the
> sheet’s right edge, where the Share sheet and every other sheet put it. One
> header for every sheet (title, then close at the end), as the boards draw
> it. Source: persona exploration 2026-10-20 (Haiku agents as guitar teachers
> driving the app with playwright-cli on a local stack; findings verified live
> and against the code). Tests: behavior (each sheet header’s close is its
> last control; axe); e2e-web (Add a book on the three viewports, the close at
> the right edge; axe, mockup W07).

## Effort estimate

**0.25 day** (from the `.tji`). One shared CSS rule, three components moved
onto it, three bespoke rules deleted, four behavior cases in existing test
files and one short e2e-web spec.

## Repository

**estante-de-cifras only** — `app/src/theme/controls.css`,
`app/src/books/{BooksScreen.jsx,books.css,ShareSheet.jsx,SongSharePanel.jsx,sharing.css}`,
`app/src/editor/{FormatHelp.jsx,editor.css}`, their behavior tests, and one
new spec in `e2e/web/tests/`. Not format work (the note does not start with
`cifra.md:`); nothing touches the service, the API or cifra.md.

**No design delta.** The boards already draw the header this task adopts
(W07, W10); the app is brought to them.

## Inherited dependencies

**Settled:**

- `shell.narrow_fixes` (complete 100) — its fixes to the Add a book sheet's
  body (the `.add-choice` border-box, `app/src/books/books.css` L111-125) and
  its e2e-web spec `e2e/web/tests/narrow-fixes.spec.js`, which opens the sheet
  through `openAddABook` (`e2e/web/lib/journeys.js` L171-179). This task
  touches only the sheet's header, not what narrow_fixes fit.
- `shell.narrow_fit` (complete) — `e2e/web/lib/fit.js`; its rule "fix at the
  component, never pass a check with `overflow: hidden`" holds here too.
- `books.add_book_chooser`, `books.share_people`/the Share sheet, and
  `songs`' format help — the three sheets this task re-heads already exist.

**Pending:** none.

## What this task is

Every sheet in the app opens with the same header: its title, which takes the
row's free width, then anything else (the Share sheet's role chip), then the
close ✕ at the sheet's right edge. Today the Add a book sheet's header
(`.sheet-head`, `app/src/books/books.css` L100-104) is a flex row with a gap
and nothing that makes the heading grow — the heading's `grow` class matches
no rule there (theme.css only defines `.row .grow`) — so its ✕ sits right
after the words *Add a book*. The Share sheet and the format help get it
right, each through its own bespoke rule (`.est-sharing .grow` and
`.est-sharing-head`, `app/src/books/sharing.css` L13-22;
`.est-format-help-head`, `app/src/editor/editor.css` L252-261). This task
makes one shared `.sheet-head` and puts every sheet header on it, so the next
sheet cannot drift the same way.

## Why it needs to be done

The persona exploration of 2026-10-20 found the ✕ in a different place on
one sheet than on every other; a close that moves is a close a user has to
hunt for, and the boards draw one place for it. Three copies of one header
rule is how one of them came to be missing; a single rule is the fix that
stays fixed.

## Inputs / context

- **The boards.** `docs/mockups/W07-add-a-book.dc.html` L72-77: the Add a book
  sheet's header is `display: flex; align-items: center; gap: 8px`, the `h2.t-h2`
  with `flex: 1`, then `button.btn.icon aria-label="Close"` with the 24×24 ✕.
  `docs/mockups/W10-share.dc.html` L45-49: the Share sheet's header, the same row
  with the title `flex: 1` and the close last. The header is drawn inline on
  each board; `docs/mockups/theme.css` has `.sheet` (L213) and `.sheet .grip`
  (L214) but no header class — which is why `app/src/theme/theme.css`, the
  mockups' stylesheet verbatim, has none either.
- **Workflow 7 §The book-management screen** (`docs/workflows/07-*.md` L12-60):
  *Add a book* opens the chooser sheet of four ways in.
- **The app today:**
  - `app/src/books/BooksScreen.jsx` L428-452 — the Add a book `Modal
    className="sheet"`, grip, `div.sheet-head` with `Heading slot="title"
    className="t-h2 grow"` and the close `Button className="btn icon"
    aria-label={t('books.close')}`.
  - `app/src/books/books.css` L100-104 — `.sheet-head { display: flex;
    align-items: center; gap: calc(var(--u) * 1); }`.
  - `app/src/books/ShareSheet.jsx` L147-158 — `div.est-sharing-head`: heading
    `t-h2 grow`, `{roleChip}`, close `btn icon` with `CloseIcon`.
  - `app/src/books/SongSharePanel.jsx` L79-86 — the computer's song-share
    panel: `div.est-sharing-head`, `h2.t-h2.grow`, close.
  - `app/src/books/sharing.css` L13-22 — `.est-sharing .grow { flex: 1;
    min-width: 0 }` (also used by sharing rows; stays) and `.est-sharing-head`.
  - `app/src/editor/FormatHelp.jsx` L118-130 — `div.est-format-help-head`,
    `Heading level={2} className="t-h2"`, close; `app/src/editor/editor.css`
    L252-261 its rules.
  - `app/src/theme/controls.css` — "the app's own layer under the drawn visual
    language", imported once right after theme.css (`app/src/App.jsx` L3), and
    injected by `injectStyles` in every behavior test that asks for styles
    (`app/src/test/theme-styles.js` L28-41).
- **Other headings with a ✕** are not sheets: `SignIn.jsx` and
  `InvitedScreen.jsx` are full surfaces with an `.appbar` whose `.title` is
  `flex: 1 1 auto` (theme.css L292). The many sheets/dialogs with a heading and
  action buttons but no ✕ (SaveSheet, SongArrange, AddToSetlist, …) have no
  close to place and are out of scope.
- **Tests today:** `app/src/books/BooksScreen.behavior.test.jsx` (the Add a
  book open + axe case at L232), `app/src/books/ShareSheet.behavior.test.jsx`,
  `app/src/books/SongSharePanel.behavior.test.jsx`,
  `app/src/editor/FormatHelp.behavior.test.jsx`; e2e-web projects phone,
  tablet and computer (`e2e/web/playwright.config.js` L39-42), axe through the
  `checkA11y` fixture of `e2e/web/lib/axe.js` (L97-111).

## Constraints / requirements

- One rule, in `app/src/theme/controls.css`, as a new numbered section:
  `.est .sheet-head { display: flex; align-items: center; gap: calc(var(--u) * 1); }`
  and `.est .sheet-head > .t-h2 { flex-grow: 1; min-width: 0; margin: 0; }`
  (longhands, so jsdom's computed style carries `flex-grow`). The heading may
  wrap; it is never ellipsized or clipped (narrow_fit: no `overflow: hidden`
  to pass a check). theme.css is not edited — it stays the mockups' sheet
  verbatim.
- Every sheet/panel header with a ✕ uses `className="sheet-head"`: Add a book
  (already), the Share sheet, the song-share panel, the format help. Their
  headings drop the now-redundant `grow` class on the header row; their close
  stays the last child of the header, after any chip.
- Delete the superseded rules: `.sheet-head` in `books.css`,
  `.est-sharing-head` in `sharing.css` (keep `.est-sharing .grow`, which rows
  still use), `.est-format-help-head` and its `.t-h2` rule in `editor.css`.
- No markup change beyond the class names: same headings (`slot="title"` so
  each dialog stays named by its title), same close labels, same `CloseIcon`
  or inline ✕. Keyboard order is unchanged (title is not focusable; the close
  is the header's last tab stop, after the chip).
- Accessibility: React Aria `Button` for the close, its accessible name a
  word (*Close*); axe at WCAG 2.1 AA wherever a test renders a sheet.

## Acceptance criteria

Behavior delivered: on every viewport, the Add a book sheet's ✕ sits at the
sheet's right edge on the title's row, as W07 draws it; the Share sheet, the
song-share panel and the format help keep theirs there, now through the one
shared `.sheet-head`.

Tests, by level:

- **behavior** (Vitest + Testing Library, each with `injectStyles()` for the
  theme and controls layers, and an axe check of the open sheet):
  - `app/src/books/BooksScreen.behavior.test.jsx` — new case "the Add a book
    sheet’s header is the shared sheet head: title, then Close last (W07 #2
    L72-77)": in `getByRole('dialog', { name: 'Add a book' })`, the heading's
    parent has class `sheet-head`, its last element child is the button named
    *Close*, and `getComputedStyle(heading).flexGrow === '1'`; axe clean.
  - `app/src/books/ShareSheet.behavior.test.jsx` — same assertions on the
    dialog *Share Choros da Ana* (W10 #1 L45-49), the role chip between title
    and Close; axe clean.
  - `app/src/books/SongSharePanel.behavior.test.jsx` — same on the panel's
    header (heading grows, Close last); axe clean.
  - `app/src/editor/FormatHelp.behavior.test.jsx` — same on the sheet
    presentation's header; axe clean.
- **e2e-web** (Playwright, phone/tablet/computer projects, real UI only):
  `e2e/web/tests/sheet-close.spec.js` — "the Add a book sheet’s close sits at
  its right edge (W07; workflow 7 §The book-management screen)": `startApp`,
  `openAddABook(page)`; the *Close* button's box is on the heading's row (its
  vertical centre within the heading's box) and its right edge is the sheet's
  content edge (`sheet.x + sheet.width − paddingRight`, the padding read with
  `getComputedStyle` on the dialog's `.sheet`, within 1 px), and it is to the
  right of the heading's text box with the gap between them more than half the
  sheet's width on the tablet and computer; then `checkA11y()` (WCAG 2.1 AA,
  both themes); pressing *Close* closes the sheet. The Share sheet is not
  driven at e2e — it needs a hosted book and the fix there is a class rename
  the behavior case pins (Decision 3).

No follow-up tasks deferred.

## Decisions

1. **The shared rule lives in `controls.css`, not theme.css, books.css or
   shell.css.** theme.css is the mockups' stylesheet verbatim and the boards
   draw this header inline, so there is no theme class to copy; books.css is
   imported only by the books screens, so the format help would not get it;
   shell.css belongs to the AppShell layout. controls.css is the app's own
   shared layer, imported once for the whole app and already injected by every
   style-aware behavior test. A React `SheetHeader` component was rejected:
   the three headers differ in what sits between title and close (a chip, a
   heading ref for focus, a plain `h2` in a non-modal panel), and a class
   gives the one layout with no new seam.
2. **Bring the Share sheet, song-share panel and format help onto it too**, not
   just fix Add a book. The note asks for "one header for every sheet"; three
   bespoke copies are how one went missing. Deleting their rules is part of
   the task, so no two rules can disagree again.
3. **e2e-web drives Add a book only.** It is the sheet the note names and the
   one that was wrong; the others are already right on screen and change only
   their class names, which the behavior cases pin with computed style. A Share
   sheet journey would need a hosted book for a rename.
4. **The heading wraps rather than truncates.** The Share title carries a
   book's name (user-length); `min-width: 0` lets it wrap beside the chip and
   the ✕, which stay on the first row's end — the board's `flex: 1` with no
   ellipsis.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-21.

- One shared `.est .sheet-head` rule in `app/src/theme/controls.css` (title grows and wraps, close last).
- Add a book (`app/src/books/BooksScreen.jsx`), Share (`ShareSheet.jsx`), song-share (`SongSharePanel.jsx`) and format help (`app/src/editor/FormatHelp.jsx`) headers use it; the Add a book ✕ now sits at the sheet's right edge as W07 draws it.
- The three bespoke per-sheet rules and the unused `grow` classes are gone (`books.css`, `sharing.css`, `editor.css`).
- Behavior: one new case each in `BooksScreen`, `ShareSheet`, `SongSharePanel` and `FormatHelp` behavior tests, with the `expectSheetHead` helper in `app/src/test/theme-styles.js`.
- e2e-web: `e2e/web/tests/sheet-close.spec.js` on phone, tablet and computer (close at the content edge, axe, Close closes).
- Tech-debt follow-ups: none.

// The pure layout-mode policy (shell.layout). Framework-free, like the theme
// resolver (app/src/theme/resolve.js): no React, no DOM, no `matchMedia` — just
// the breakpoint query the shell subscribes to, the two layout modes it picks
// between, and the three destinations in their drawn order. The view (AppShell)
// is the only layer that knows React (DIRECTION §3.7 lines 415-417); this module
// is unit-testable without a DOM.

// Two layouts split on one breakpoint (Decision): narrow (phone) is the bottom
// tab bar; wide (tablet and computer) is the sidebar + detail split — tablet and
// computer share the wide split.
//
// The refinement's Decision names 768px, reasoning from the *drawn* tablet
// budget (820px, docs/mockups/theme.css line 126). But the e2e-web harness runs
// the tablet project on the Galaxy Tab S4 device descriptor, whose viewport is
// 712px wide — below 768 — so a 768 breakpoint would render the real test
// tablet as a phone, contradicting the refinement's own intent that "tablet and
// computer share the wide split" and that the e2e reaches each destination on
// tablet via the sidebar rail. The breakpoint is therefore 600px (the
// conventional tablet line), which sits cleanly between the actual phone
// (Pixel 7, 412px) and tablet (712px) viewports: phone → narrow, tablet and
// computer (1280px) → wide, as designed. (Flagged in the return summary.)
export const WIDE_QUERY = '(min-width: 600px)';

// The book-management screen's OWN master-detail (books.online Decision 2) needs
// a wider budget than the shell split, because it lives INSIDE the shell's wide
// main pane: a side-by-side detail there is a SECOND 340px sidebar nested beside
// the shell's own 340px rail. Two 340px rails plus a usable detail pane only fit
// on a true computer viewport — on the 712px tablet the shell rail already
// leaves the shelf ~372px, so a nested 340px list squeezes the detail to nothing
// and its acts become unclickable (the e2e tablet projects proved this). So the
// shelf's split engages here, not at WIDE_QUERY: `340 (rail) + 32 (shell scroll
// padding) + 340 (shelf list) + ~360 (detail) ≈ 1072px`. Below it — the tablet
// included — the shelf uses the same full-pane detail-over-list the phone does
// (Decision 2's narrow presentation), which the tall tablet viewport shows
// comfortably. Computer (1280px) stays side-by-side; tablet (712px) does not.
export const BOOKS_WIDE_QUERY = '(min-width: 1080px)';

// The wide reading appbar's full row — Back, title, Edit, History, Add to
// setlist, Print, Share, ⋯ (W02 computer L172-178) — only fits from here at the
// computer's type size (shell.narrow_fit Decision 7). Below it, on the 712px
// tablet included, the reading view keeps Back, title, Edit and ⋯ and moves the
// other four into the ⋯ menu (the W02 tablet frame, L109-115), so Print and
// Share are never pushed past the edge.
export const READING_ACTIONS_WIDE_QUERY = '(min-width: 1080px)';

// The account screen's computer split (account.preferences_layout Decision 3;
// Theme-picker #4, W13 #4): a 300px rail holding the title, who is signed in and
// sign-out, beside Preferences drawn in two columns (Theme | Density, Chord
// diagrams | Language at 320px) inside 32px padding. `300 (rail) + 64 (padding)
// + ~360 (Theme: swatch, name, meta, the Selected badge) + 28 (gap) + 320
// (Language) ≈ 1072px`. On the 712px tablet that leaves the Theme column under
// 300px and squeezes its meta a word per line (the failure shell.narrow_fit
// pins), so below here — the tablet included — the screen keeps the one column
// the phone draws. Computer (1280px) splits; tablet (712px) does not.
export const ACCOUNT_WIDE_QUERY = '(min-width: 1080px)';

// The instruments' computer rail (music.instruments_layout Decision 2; W15 #4):
// the roster as a 340px rail beside the open instrument's screen, whose voicing
// rules draw in two columns. 1080px is the app's line for a second column, as
// for the account and the shelf; below it — the 712px tablet included — the
// instruments keep the phone's one screen at a time, as the board's tablet
// frame (#3) draws no split.
export const INSTRUMENTS_WIDE_QUERY = '(min-width: 1080px)';

// The song editor's computer columns (songs.editor_chrome Decision 8; W04#4
// L162-207): a 300px *Unsaved* pane, the text, and on Save a 360px panel beside
// it. `300 (pane) + ~420 (text) + 360 (panel) ≈ 1080px` — the computer's width,
// the app's line for a second column. Below it — the 712px tablet included —
// the editor keeps one column and the save is a centred dialog (W04#3).
export const EDITOR_WIDE_QUERY = '(min-width: 1080px)';

// The three destinations, in the drawn order — Search · Books · Setlists
// (docs/mockups/GUIDE.md line 34; W02-find-and-play.dc.html lines 55-59). This
// array's order is the tab order; the visible labels come from i18n, keyed by
// these ids (`shell.<id>`).
export const DESTINATIONS = Object.freeze(['search', 'books', 'setlists']);

// The layout mode from whether the wide media query currently matches: a
// matched wide query is the split, an unmatched one is the phone tab bar.
export function layoutMode(matchesWide) {
  return matchesWide ? 'wide' : 'narrow';
}

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

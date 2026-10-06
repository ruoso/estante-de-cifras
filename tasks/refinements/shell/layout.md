# shell.layout — Navigation and layouts

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 15–20, task `shell.layout`
("Navigation and layouts"), under `task shell` (lines 6–8, which `depends
foundation.app_tooling, foundation.e2e_web`). It `depends !tokens`. The note,
verbatim:

> Phone tab bar (Search, Books, Setlists), tablet and computer splits; React
> Aria for every interactive part. Tests: behavior (tab bar and splits with
> Testing Library; keyboard navigation; axe); e2e-web (Search, Books and
> Setlists reached on phone, tablet and computer, axe on each).

Area 50 is the app's shell and visual language. `shell.tokens` gave the shell
its stylesheet; `shell.layout` gives it its navigation frame — the structure
every later screen is drawn inside. `shell.i18n` and `shell.pwa` both
`depends !layout`.

## Effort estimate

**3 days** (from the `.tji`). The work is: a responsive app shell that picks
a narrow (phone) or wide (tablet/computer) layout by viewport; the
three-destination navigation (Search · Books · Setlists) built on React Aria
Components, rendered as a bottom tab bar on the phone and a master-detail
split on tablet and computer; the destination panels as labelled landmark
slots the content tasks fill; and the behavior and e2e-web tests that pin
reaching each destination, the keyboard path, and axe on all three viewports.

## Repository

**estante-de-cifras only** (`app/`, with the e2e specs in `e2e/web/`). This is
app work; the note does **not** start with `cifra.md:`. The app and the
service share no code ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6
line 288); nothing here touches the service, the API, or cifra.md. **No design
delta** is authored: DIRECTION §4 and §3.7 and the mockups already settle the
destinations, the tab bar and the split; the two genuinely-undecided items
(URL/deep-link routing for the shell, and the shared deep-screen app bar) are
left to the tasks that already own them and surfaced, not invented here (see
Decisions and Open questions).

## Inherited dependencies

- **`shell.tokens`** — *settled* (`complete 100`,
  [`tasks/refinements/shell/tokens.md`](tokens.md)). It landed:
  - [`app/src/theme/theme.css`](../../../app/src/theme/theme.css), the drawn
    visual language, carrying the exact chrome classes this task renders —
    `.appbar`/`.appbar .title`, `.split`, `.pane`/`.pane.side`/`.pane.main`,
    `.tabbar`, `.tab`/`.tab.on`, `.row.sel`, `.screen`/`.scroll`, `.btn`
    (adopted from [`docs/mockups/theme.css`](../../../docs/mockups/theme.css)
    lines 139–149, 194). The shell styles against these — it does not
    re-author them.
  - [`app/src/theme/ThemeRoot.jsx`](../../../app/src/theme/ThemeRoot.jsx) —
    the root wrapper (`est theme-<applied> density-<density>`) the shell
    renders *inside*; and `usePrefersDark()` (lines 40–42), the
    `useSyncExternalStore`-over-`matchMedia` precedent this task mirrors for
    its viewport read.
  - [`app/src/theme/resolve.js`](../../../app/src/theme/resolve.js) — the
    pure, framework-free resolver precedent (`themeClasses`, lines 37–39) for
    the small pure module this task adds.
  - the store seam —
    [`app/src/worker/useStore.js`](../../../app/src/worker/useStore.js)
    `useSlice` (lines 14–20) over
    [`app/src/worker/store.js`](../../../app/src/worker/store.js)
    (`getAppStore`, lines 79–87). The shell wraps `<App>` and reads the
    `preferences` slice already; this task adds no new slice (navigation
    location is view state, not Worker data — see Decisions).
- **`foundation.app_tooling`** — *settled* (transitively, via `shell`).
  `react-aria-components` `^1.21.1` is already a dependency
  ([`app/package.json`](../../../app/package.json) line 23); React 19 + the
  React Compiler are on. Tests co-locate: `*.test.js`/`*.test.jsx` for unit,
  `*.behavior.test.jsx` for behavior; the shared axe helper
  [`app/src/a11y/axe.js`](../../../app/src/a11y/axe.js) (`checkWcag21aa`,
  WCAG 2.1 AA tag set) — with `color-contrast` a no-op under jsdom, pinned at
  e2e-web instead. The i18n module
  [`app/src/i18n/index.js`](../../../app/src/i18n/index.js) (dotted-key
  lookup, `LOCALES` at line 26, four locale catalogues) exists and is this
  task's first consumer for navigation copy.
- **`foundation.e2e_web`** — *settled* (transitively). The Playwright harness
  `e2e/web/` runs every spec on three Chromium projects — **phone**
  (`Pixel 7`), **tablet** (`Galaxy Tab S4`), **computer** (`Desktop Chrome`)
  ([`e2e/web/playwright.config.js`](../../../e2e/web/playwright.config.js)
  lines 39–43) — against the compose stack (no `webServer`). The `checkA11y()`
  fixture ([`e2e/web/lib/axe.js`](../../../e2e/web/lib/axe.js) lines 38–52)
  runs axe at WCAG 2.1 AA, where `color-contrast` really runs. Specs import
  `{ test, expect }` from `../lib/axe.js`; `app-loads.spec.js` is the
  "app loads on all three viewports, landmarks, axe-clean" precedent.

**Downstream:** the three destinations are filled by existing leaves that
already `depends shell.layout` through their area roots — `songs.search`
(Search; [`tasks/60-songs.tji`](../../60-songs.tji) line 8), `books.shelf`
(Books; [`tasks/65-books.tji`](../../65-books.tji) line 9) and
`books.setlists` (Setlists; `tasks/65-books.tji` line 45). `shell.i18n`
(languages chooser), `shell.pwa` (installable), `shell.chart`, `shell.diagram`
and `shell.a11y_chart` all build on the shell this task frames.

## What this task is

Turn the empty single-screen app into the navigable shell every later screen
lives in:

1. **A responsive `AppShell`** that renders inside `ThemeRoot`'s root and
   chooses one of two layouts by viewport, via a live `matchMedia`
   subscription (mirroring `usePrefersDark`):
   - **narrow (phone)** — the selected destination fills a `.screen`/`.scroll`
     region with a bottom **`.tabbar`** of three `.tab` buttons;
   - **wide (tablet and computer)** — a master-detail **`.split`**: a
     navigation sidebar (`.pane.side`) carrying the app wordmark and the three
     destinations, and a detail region (`.pane.main`, a `<main>` landmark)
     showing the selected destination.
2. **The three-destination navigation — Search · Books · Setlists, in that
   order** — built on **React Aria Components `Tabs`/`TabList`/`Tab`/
   `TabPanel`**, one controlled instance whose `TabList` renders as the bottom
   tab bar on the phone and as the sidebar rail on tablet/computer, and whose
   `TabPanel`s are the destination regions. RAC gives the roving-tabindex
   keyboard path, `aria-selected` state and the accessible roles for free;
   the icons are decorative (`aria-hidden`), the labels visible text, routed
   through i18n.
3. **The destination panels as labelled slots** — each destination is a
   landmark region with its heading/accessible name ("Search", "Books",
   "Setlists") and a minimal placeholder, enough to be *reached* and asserted
   now; `songs.search`, `books.shelf` and `books.setlists` fill them later
   (they already depend on this task). The shell is usable with no account and
   no book — nothing is asked up front (Workflow 1).
4. **A tiny pure layout-mode module** — `(matches: boolean) → 'wide' |
   'narrow'` and the breakpoint query constant — unit-tested like the theme
   resolver; the only React is the `AppShell` and its `matchMedia` hook.
5. **Navigation copy through i18n** — the three destination labels added to
   all four locale catalogues (`en`, `pt-BR`, `es-419`, `it`), the shell being
   i18n's first consumer.

## Why it needs to be done

The app today is a single hard-coded placeholder screen: `main.jsx` mounts
`<App>`, which renders one `<main>` inside `ThemeRoot` — there is no router and
no way to reach more than one view (seams report; no react-router or any
router in `app/`). Nothing the user actually does — find a song, manage books,
run a setlist — has anywhere to live until the shell exists. `shell.layout` is
the explicit `!tokens` successor and the `depends shell.layout` prerequisite of
the entire `songs` and `books` areas: Search, the book-management screen and
setlists all render *into* the frame this task builds. It is also the first
delivery of DIRECTION §4's interface — search as the primary destination,
books as a screen of their own — and of the "phone, a tablet and a computer
alike" accessible navigation §3.7 names as the reason React Aria was chosen.

## Inputs / context

- **The note's destinations are drawn, not written in DIRECTION.** DIRECTION
  §4 ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines 428–450) names
  **search as the primary interface** ("One search across every loaded book:
  title, artist, sections, words, chords", lines 430–434) and **books as "a
  scope on that search; managing them is a screen of its own"** (lines
  434–435). It does **not** contain the words "tab bar", the ordered
  destination set, or the per-viewport split rules — those live in the
  mockups (§3.7 line 405; §7 lines 519–520 — each screen is "drawn on a phone,
  a tablet and a computer in mockups/"). Setlists appear as a file kind (§2)
  and as Workflow 12, not in §4 prose.
- [`docs/mockups/GUIDE.md`](../../../docs/mockups/GUIDE.md) line 34, verbatim:
  "`.split` with `.pane.side` + `.pane.main` (computer, tablet
  landscape-ish splits), `.tabbar` + `.tab` (`.on`) — **the phone tab bar is
  Search · Books · Setlists (W02)**."
- [`docs/mockups/W02-find-and-play.dc.html`](../../../docs/mockups/W02-find-and-play.dc.html)
  — the canonical navigation reference. The tab bar (lines 55–59): a
  `<div class="tabbar">` of three `<button class="tab">`, exactly one
  `tab on`, each an inline decorative SVG (`aria-hidden`) plus a visible text
  label — **"Search", "Books", "Setlists"**, in that order (magnifier /
  book-stack / list icons). The computer layout (lines 149–211) is the split:
  `pane side` (app title "Estante", search field, Recent, Books lists) beside
  `pane main` (the detail). The tablet (lines 107–143) is a single pane for a
  *deep* view (a song), with an appbar Back — the deep-view collapse, owned by
  the content task, not the shell frame.
- [`docs/mockups/theme.css`](../../../docs/mockups/theme.css) — the chrome
  tokens the shell renders (adopted into `app/src/theme/theme.css`):
  `.appbar` min-height 44px (line 139), `.split { display:flex; flex:1 }`
  (143), `.pane.side { width:340px; border-right; background:var(--surface) }`
  (145), `.pane.main { flex:1 }` (146), `.tabbar { justify-content:
  space-around; border-top; padding: 6px 4px 18px }` — the 18px bottom
  standing in for the home-indicator safe area (147), `.tab { flex-direction:
  column; font-size:12px; font-weight:600; color:var(--ink-2); min-width:64px }`
  (148), `.tab.on { color: var(--accent) }` (149), `.row.sel { background:
  var(--accent-soft) }` (194); `--u: 8px` (8) and the three densities
  (107–109); the drawn device budgets phone 390 / tablet 820 / computer 1280
  (lines 125–127); `.btn { min-height: 44px }` (152) — the 44px touch target.
- [`docs/mockups/README.md`](../../../docs/mockups/README.md) lines 26–27:
  "Every status badge carries a word, never colour alone" — governs the
  selected-destination state (carried by `aria-selected`, not colour only).
- **DIRECTION §3.7** (lines 394–426): React Aria Components, chosen for "the
  richest accessible experience" (396), expressly because "what is expensive
  to build well is accessible interaction on a phone, a tablet and a computer
  alike … keyboard and screen-reader behaviour, press and touch handling that
  works on phones, drag and drop with a keyboard alternative, and formatting
  by locale for the four languages" (398–404); "Its components carry no look
  of their own, so the visual language … applies as drawn" (404–405); "the
  main thread never touches IndexedDB" (409); components read slices through
  `useSyncExternalStore`, "only what shows it moves" (410–414); "the view is
  the only layer that" knows React (415–417); tooling — Vite, PWA, Vitest with
  Testing Library, Playwright, axe at WCAG 2.1 AA (424–426). §3.6 line 288:
  "The app and the service share no code."
- **The destinations' own workflows** (what the content tasks fill the slots
  with — context, not this task's deliverable):
  [`docs/workflows/02-find-and-play.md`](../../../docs/workflows/02-find-and-play.md)
  (Search), [`docs/workflows/07-add-a-book.md`](../../../docs/workflows/07-add-a-book.md)
  (Books), [`docs/workflows/12-setlists.md`](../../../docs/workflows/12-setlists.md)
  (Setlists).
- **Seams in `app/`** (seams report): [`app/src/main.jsx`](../../../app/src/main.jsx)
  mounts `<App>`, no router; [`app/src/App.jsx`](../../../app/src/App.jsx)
  (lines 1–26) renders one `<main>` inside `<ThemeRoot>` — the `AppShell`
  slots in here, replacing the placeholder `<main>`;
  [`app/src/theme/ThemeRoot.jsx`](../../../app/src/theme/ThemeRoot.jsx)
  `usePrefersDark` (40–42) — the live-`matchMedia` hook pattern to mirror;
  [`app/src/i18n/index.js`](../../../app/src/i18n/index.js) and
  `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — add the nav labels in all
  four.
- **Predecessor/sibling refinements:** [`shell/tokens.md`](tokens.md) (the
  stylesheet, the pure-resolver + React-root split, contrast pinned at
  e2e-web, the axe-helper scope note),
  [`../foundation/app_tooling.md`](../foundation/app_tooling.md) (the stack
  and the jsdom contrast note),
  [`../foundation/e2e_web.md`](../foundation/e2e_web.md) (the three-viewport
  harness and its axe fixture).

## Constraints / requirements

- **React Aria for every interactive part** (`.tji` note; DIRECTION §3.7 lines
  396–404; standing accessibility rule). The destination switcher is RAC
  `Tabs`/`TabList`/`Tab`/`TabPanel`; any other interactive chrome this task
  adds is RAC. No bare `<div onClick>`; the keyboard path and ARIA roles come
  from RAC, not hand-rolled.
- **Styled by the drawn classes, not re-authored.** The shell renders
  `theme.css`'s `.tabbar`/`.tab`/`.tab.on`, `.split`/`.pane.side`/`.pane.main`,
  `.screen`/`.scroll` — the chrome `shell.tokens` already adopted. No new
  colours, no new visual language; `.tab.on` stays the drawn accent.
- **The view is the only layer that knows React** (DIRECTION §3.7 lines
  415–417). The layout-mode decision is a pure, framework-free module; only
  `AppShell` and its `matchMedia` hook are React.
- **Navigation location is view state, not Worker data** (DIRECTION §3.7 lines
  407–414). The selected destination is held in the view (controlled RAC
  `Tabs` state); it is **not** put through the Worker-fed store and the main
  thread touches no IndexedDB for it. The `useSlice` store stays for what the
  Worker owns.
- **Accessibility** (standing rule): keyboard reaches and switches every
  destination (RAC roving tabindex, arrow keys, `Home`/`End`); the `<main>`
  landmark is preserved; icons are `aria-hidden` with visible text labels; the
  selected destination is conveyed by `aria-selected` **state** — a word to
  assistive tech — never colour alone (mockups README 26–27); 44px touch
  targets (theme.css 148, 152); axe at WCAG 2.1 AA, contrast pinned at e2e-web
  (jsdom scope note).
- **Locale** (DIRECTION §3.7 line 403; standing rule): the three destination
  labels are i18n keys present in all four catalogues; no hard-coded nav copy
  (fixing the current App.jsx hard-coded strings for the nav it owns).
- **Offline first / no account to open the shell** (standing rules; Workflow 1
  "setup happens at the moment it becomes visible, not up front"): the shell
  renders, and all three destinations are reachable, with no network, no
  account and no book — the chrome is not a book, so "no book without an
  account" does not gate it.
- *Rules that do not bear on this task:* canonical form over preserving
  content (no song is written); no song text in logs (no logging, no song
  text). Named for completeness.

## Acceptance criteria

**Behaviour delivered.**

- The app mounts into `AppShell` inside `ThemeRoot` (replacing the placeholder
  `<main>`), and renders the correct layout for the viewport: a bottom tab bar
  on the phone, a sidebar-plus-detail `.split` on tablet and computer, flipping
  live as the viewport crosses the breakpoint.
- The three destinations **Search · Books · Setlists** (in that order) are
  present and switchable on every viewport; selecting one shows its region and
  marks it `aria-selected`; the labels come from i18n.
- Each destination is a landmark region with its heading/accessible name,
  reachable with no account or book.
- The full keyboard path works: Tab to the tab bar / sidebar rail, arrow keys
  (and `Home`/`End`) move between destinations, selection follows, focus order
  is correct.

**Tests the task lands with, by level.**

- **unit — `app/src/shell/layout-mode.test.js`** (Vitest): the pure
  layout-mode selector — a matched wide query → `'wide'`, unmatched →
  `'narrow'` — and the destinations constant is `['search','books','setlists']`
  in that order. *Pins:* the breakpoint decision (below) and the drawn tab
  order (GUIDE.md line 34; W02 lines 55–59). *(Added beyond the note's named
  levels — a pure module merits a unit test, as `shell.tokens` did for
  `resolve.js`.)*
- **behavior — `app/src/shell/AppShell.behavior.test.jsx`** (Vitest + Testing
  Library, `matchMedia` stubbed per case; axe via `checkWcag21aa`):
  - **narrow:** renders the `.tabbar` with three tabs labelled Search, Books,
    Setlists in order; activating a tab switches the shown destination region
    and sets `aria-selected`; axe-clean.
  - **wide:** renders the `.split` — the sidebar rail and the `<main>` detail;
    the three destinations reachable from the sidebar; activation switches the
    detail; axe-clean.
  - **keyboard navigation:** arrow keys / `Home`/`End` move across the
    destinations with RAC's roving tabindex and selection follows; focus
    order correct.
  - **selected-by-word:** the active destination carries `aria-selected`
    (not colour alone).
  *Pins:* "tab bar and splits with Testing Library; keyboard navigation; axe"
  (`.tji` note); the drawn tab bar and split (GUIDE.md 34, W02 55–59 / 149–211,
  theme.css 143–149); DIRECTION §3.7 lines 396–417; the status-word rule
  (mockups README 26–27). Axe here pins role/name/structure (the rules that
  run under jsdom); **contrast is pinned at e2e-web** (Decisions;
  `foundation/app_tooling.md`).
- **behavior — `app/src/App.test.jsx`** (updated): `App` renders `AppShell`
  with the three destinations and a `<main>` landmark, replacing the
  placeholder-screen assertions; still axe-clean. *Pins:* the shell root now
  carries the navigation frame (DIRECTION §4 lines 430–435; §3.7 404–405).
- **e2e-web — `e2e/web/tests/navigation.spec.js`** (Playwright, three
  viewports, compose stack; imports `{ test, expect }` from `../lib/axe.js`):
  on each of phone, tablet and computer the app loads at the origin, the three
  destinations Search, Books and Setlists are each reached (tap the phone tab
  bar / activate the sidebar rail) and their region/heading shown, and the
  `checkA11y()` fixture (WCAG 2.1 AA, **contrast runs here in a real browser**)
  is clean on each destination. One keyboard-reach assertion confirms the
  destinations are reachable by keyboard. *Pins:* "Search, Books and Setlists
  reached on phone, tablet and computer, axe on each" (`.tji` note); §4 lines
  430–435; the drawn per-viewport layout (GUIDE.md 34).

No test level the note names is dropped; a unit level is added for the pure
module. No test is deferred.

**No deferred WBS leaf.** The three destinations' content is already owned by
existing leaves that depend on this task (`songs.search`, `books.shelf`,
`books.setlists`); this task delivers the frame and the labelled slots, so it
registers **no** new follow-up. The two architectural questions it surfaces
(shell URL/deep-link routing; a shared deep-screen app bar) are judgment calls
left to the tasks that already own the surfaces that need them, and are raised
in the return summary for the parking lot — not encoded as WBS tasks (see Open
questions).

## Decisions

- **The destination switcher is React Aria Components `Tabs`, rendered
  responsively.** One controlled `<Tabs>` instance holds the three
  destinations; its `<TabList>` is styled as the bottom `.tabbar` on the phone
  and as the sidebar rail (`.pane.side`) on tablet/computer, and its
  `<TabPanel>`s are the destination regions. *Rationale:* the mockup literally
  draws a "tab bar" of `.tab` buttons (W02 55–59; GUIDE.md 34); RAC `Tabs` is
  the built-for-purpose accessible answer — roving tabindex, arrow-key
  movement, `aria-selected`, correct roles — satisfying "React Aria for every
  interactive part" and the keyboard-navigation test without hand-rolled ARIA.
  The selected state is a semantic word (`aria-selected`), honouring
  status-by-word-not-colour over `.tab.on`'s accent. *Alternatives rejected:*
  (a) a hand-rolled `<nav>` of `<button>`s — re-implements the keyboard and
  ARIA RAC already gives and fights the note's "React Aria for every
  interactive part"; (b) a routing library's `<NavLink>`s — a new runtime
  dependency (design delta) and URL routing this task deliberately defers.
- **Selection is controlled view state in `AppShell` (`useState`), not a store
  slice.** *Rationale:* navigation location is ephemeral view state, not data
  the Worker owns; DIRECTION §3.7 reserves the store/`useSyncExternalStore`
  path for Worker-owned data and forbids the main thread touching IndexedDB —
  neither applies to which tab is showing. Controlling the selected key in
  `AppShell` also keeps the destination stable across a narrow⇄wide layout
  flip (the `Tabs` subtree re-arranges but selection persists). *Alternative
  rejected:* add a `navigation` slice to the Worker-fed store — the store's
  `send` targets the Worker; routing view state through it crosses the
  data-owner boundary for no gain, and would churn on a message channel built
  for data.
- **Two layouts, split on one breakpoint at `min-width: 768px`; tablet and
  computer share the wide split.** `narrow` (< 768px) → the phone tab bar;
  `wide` (≥ 768px) → the `.split` sidebar+detail, used on both tablet and
  computer (the computer sidebar at theme.css's 340px; the tablet sidebar may
  narrow within the same frame). *Rationale:* the note groups "tablet and
  computer splits" against the phone tab bar, so the shell's wide frame is the
  split for both; 768px sits cleanly between the drawn phone (390) and tablet
  (820) budgets (theme.css 125–127) and is the conventional phone/tablet line.
  The mockups' single-pane tablet boards are *deep* views (a song, a setlist),
  where a content task collapses the detail — deep-view behaviour is owned by
  those tasks, not the shell frame. *Alternatives rejected:* (a) three
  distinct layouts (a separate tablet mode) — the note names two, and no
  mockup gives tablet a distinct *top-level* navigation; (b) CSS media queries
  rendering both the tab bar and the sidebar and hiding one — duplicates the
  interactive navigation in the DOM, creating hidden-but-focusable tabs and a
  doubled accessibility tree; picking the layout in JS keeps exactly one nav
  mounted.
- **Viewport is read with a live `matchMedia` subscription via
  `useSyncExternalStore`, behind a pure layout-mode module.** *Rationale:*
  mirrors the settled `usePrefersDark` pattern (`ThemeRoot.jsx` 40–42) and
  keeps the policy (`matches → 'wide' | 'narrow'`) a framework-free,
  unit-testable module like `resolve.js`, honouring "the view is the only
  layer that knows React". *Alternative rejected:* a resize-listener with
  width math in the component — spreads layout policy into the view and is
  harder to unit-test.
- **Destinations ship as labelled landmark slots; their content is the content
  tasks' job.** *Rationale:* `songs.search`, `books.shelf` and
  `books.setlists` already `depends shell.layout` and own what each screen
  shows; the shell's deliverable per the note is reaching each destination on
  each viewport, which a headed, landmarked placeholder satisfies and the
  content tasks then fill. *Alternative rejected:* build any destination's
  content here — duplicates and pre-empts tasks that already exist, and
  exceeds a 3-day shell task.
- **Contrast at AA is pinned at e2e-web, not behavior.** *Rationale:* axe's
  `color-contrast` needs layout, a no-op under jsdom (the established scope
  note). Behavior-level axe pins role/name/structure on every rendered layout;
  contrast across the themed chrome is pinned in a real browser at e2e-web.
  *Alternative rejected:* claim contrast at behavior — asserts a check jsdom
  never runs.
- **No URL/deep-link routing in the shell; no shared app bar.** *Rationale:*
  no workflow requires the top-level destination to be bookmarkable, and
  building a routing model now would pre-decide deep navigation for songs,
  books and the file view and risk a new dependency (a design delta). Book
  *links* — the one place URLs carry meaning — are already owned by
  `books.add_by_link`/`books.share` against the service. The per-screen app
  bar is drawn differently per screen (its actions differ) and belongs to each
  content task. *Alternative rejected:* add a router and a shared app bar here
  — over-scopes a shell-navigation task and bakes decisions the content and
  share tasks are better placed to make. (Both surfaced to the parking lot;
  see Open questions.)

## Open questions

Two items are genuine judgment calls, left to the tasks that own the surfaces
and surfaced to the parking lot (not encoded as WBS leaves — neither is an
"audit"; each is a real decision for a real owner):

- **Does the app want URL/deep-link routing (bookmarkable destinations,
  browser-back, a `/book/...` entry for a shared link)?** This task uses
  in-memory selection and leaves book-link entry to
  `books.add_by_link`/`books.share`. Whether the shell itself should sync
  location to the URL (and thereby give browser-back and bookmarking) is a
  product/architecture call best made when the share-link flow is built,
  against what it needs.
- **Is there a shared deep-screen app bar, or does each screen draw its own?**
  The mockups draw a per-screen `.appbar` with screen-specific actions
  (Back, Edit, Transpose, History…). Whether to extract a shared `AppBar`
  primitive or let each content task compose `.appbar` from theme.css is an
  interface-consistency call for the content area, not the shell frame.

## Status

**Done** — 2026-10-05.

- `app/src/shell/layout-mode.js` — pure layout-mode selector (`matches → 'wide' | 'narrow'`, breakpoint at 600px, destinations constant `['search','books','setlists']`).
- `app/src/shell/AppShell.jsx` — responsive app shell using React Aria `Tabs`/`TabList`/`Tab`/`TabPanel`; phone tab bar (`.tabbar`) or tablet/computer split (`.split`/`.pane.side`/`.pane.main`) driven by a live `matchMedia` subscription via `useSyncExternalStore`; controlled selection state (`useState`).
- `app/src/shell/shell.css` — root height/flex layout plumbing only (no colours/tokens); `order`-based CSS positions the phone tab bar at foot of DOM.
- `app/src/App.jsx` — mounts `AppShell` replacing the placeholder `<main>`.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — added `shell.nav`, `shell.search`, `shell.books`, `shell.setlists` keys in all four catalogues.
- `e2e/web/tests/app-loads.spec.js` — updated stale placeholder `<h1>Estante de Cifras</h1>` assertion → shell's default "Search" heading.
- `e2e/web/tests/offline.spec.js` — updated same stale heading assertion (missed in initial implementation, fixed by fixer).
- Tests: unit (`app/src/shell/layout-mode.test.js`, 4 tests); behavior (`app/src/shell/AppShell.behavior.test.jsx`, 5 tests; `app/src/App.test.jsx`, 4 tests); e2e-web (`e2e/web/tests/navigation.spec.js`, 6 tests across phone/tablet/computer).
- Breakpoint deviation: 600px instead of refinement's 768px — Galaxy Tab S4 (712px) renders wide as intended; 768px would have treated it as narrow.
- Parking lot: shell URL/deep-link routing and shared deep-screen app bar (two entries appended to `tasks/parking-lot.md`).

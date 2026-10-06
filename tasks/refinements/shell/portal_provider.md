# shell.portal_provider — Portal-scope provider at ThemeRoot

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 55–60, task `shell.portal_provider`
("Portal-scope provider at ThemeRoot"), under `task shell` (lines 6–8, which
`depends foundation.app_tooling, foundation.e2e_web`). It `depends !layout,
books.shelf`. The note, verbatim:

> React Aria Components portals overlays to document.body by default, outside
> ThemeRoot's .est element where all design tokens live. Add react-aria as a
> direct dependency and wrap ThemeRoot with UNSTABLE_PortalProvider so every
> future overlay inherits the token scope without per-screen
> UNSTABLE_portalContainer workarounds. Discovered in books.shelf fixer-2
> (tasks/refinements/books/shelf.md). Tests: behavior (a RAC overlay rendered
> through the portal inherits design tokens, axe); e2e-web (the rename dialog
> and any sheet on the three viewports shows correct tokens and passes axe).

Area 50 is the app's shell and visual language. `shell.tokens` gave the shell
its `.est` token root; `shell.layout` gave it its navigation frame;
`books.shelf` built the app's first overlays (a rename dialog, an *Add a book*
sheet) and, in its fixer-2 pass, discovered the portal-scope defect this task
closes app-wide ([`tasks/refinements/books/shelf.md`](../books/shelf.md) line
613).

## Effort estimate

**0.5 days** (from the `.tji`), allocated `team`. The work is: add `react-aria`
as a direct dependency; wrap `ThemeRoot`'s children with its
`UNSAFE_PortalProvider`, resolving the `.est` root so every React Aria overlay
portals inside the token scope; retire the per-screen workaround `books.shelf`
left in `BooksScreen.jsx`; and the behavior and e2e-web tests that pin a
portaled overlay landing inside `.est` and rendering with correct tokens, axe
clean on all three viewports.

## Repository

**estante-de-cifras only** (`app/`, with the e2e specs in `e2e/web/`). This is
app work, not a `cifra.md:` task. The app and the service share no code
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 line 288); nothing here
touches the service, the API, or cifra.md. **No design delta** is authored:
DIRECTION §3.7 already settles React Aria Components as the app's accessible-UI
library and the mockups' `theme.css` as the visual language that "applies as
drawn" (§3.7 lines 404–405); this task only makes the overlays RAC already
provides inherit that drawn language. Promoting `react-aria` from a transitive
to a direct dependency is **not** a design delta — it adds no new vendor or
runtime; it makes an export of a package already installed (RAC's own
foundation) directly importable, exactly as the `.tji` note scopes (see
Decisions).

## Inherited dependencies

- **`shell.layout`** — *settled* (`complete 100`), refinement
  [`layout.md`](layout.md). It landed the navigation frame every screen (and
  thus every overlay) renders inside — [`app/src/shell/AppShell.jsx`](../../../app/src/shell/AppShell.jsx),
  mounted by [`app/src/App.jsx`](../../../app/src/App.jsx) (lines 29–35) inside
  `ThemeRoot`. The `!layout` edge is structural: the provider wraps the subtree
  the shell fills.
- **`books.shelf`** — *settled, Done 2026-10-06*, refinement
  [`books/shelf.md`](../books/shelf.md). It built the app's first and (today)
  only React Aria overlays and the per-screen portal workaround this task
  retires:
  - [`app/src/books/BooksScreen.jsx`](../../../app/src/books/BooksScreen.jsx) —
    `RenameDialog` (a `DialogTrigger` → `ModalOverlay` → `Modal className="dialog"`
    → `Dialog`) and `AddBookSheet` (→ `Modal className="sheet"`). These are the
    two overlays the app has; neither is a `Popover`/`Tooltip` (grep across
    `app/src` finds overlays only here).
  - the workaround to retire: a `rootRef` + `portalContainer` state resolved via
    `rootRef.current?.closest('.est')` (lines 285–289) threaded into each
    `ModalOverlay` as `UNSTABLE_portalContainer` (lines 160, 215), with the
    explanatory comment at lines 278–284.
  - the defect record: [`books/shelf.md`](../books/shelf.md) line 613 —
    "RAC overlays portal into the `.est` ancestor via `UNSTABLE_portalContainer`
    … App-wide tech debt registered as `shell.portal_provider`."
- **`shell.tokens`** — *settled* (transitively, via `shell`), refinement
  [`tokens.md`](tokens.md). It is the `.est` token root this task resolves:
  [`app/src/theme/ThemeRoot.jsx`](../../../app/src/theme/ThemeRoot.jsx) renders
  `<div className="est theme-<applied> density-<density>">{children}</div>`
  (lines 47–52), and [`app/src/theme/theme.css`](../../../app/src/theme/theme.css)
  scopes every token under `.est` (`--u`, `--surface`, colours, radii — lines
  13–40; nothing at `:root`). That scoping is the whole reason an overlay
  portaled to `document.body` renders token-free.
- **`foundation.app_tooling`** — *settled* (transitively, via `shell`).
  `react-aria-components` `^1.21.1` is a direct dependency
  ([`app/package.json`](../../../app/package.json) line 23); its own foundation
  package `react-aria` `3.52.1` is installed **transitively** (resolved in
  [`app/package-lock.json`](../../../app/package-lock.json) at
  `node_modules/react-aria`) but is **not** a direct dependency. Tests
  co-locate: `*.behavior.test.jsx` for component behavior (Vitest + Testing
  Library + `vitest-axe`); the shared axe helper
  [`app/src/a11y/axe.js`](../../../app/src/a11y/axe.js) (`checkWcag21aa`, the
  WCAG 2.1 AA tag set `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`).
- **`foundation.e2e_web`** — *settled* (transitively). The Playwright harness
  `e2e/web/` runs every spec on three Chromium projects — **phone** (`Pixel 7`),
  **tablet** (`Galaxy Tab S4`), **computer** (`Desktop Chrome`)
  ([`e2e/web/playwright.config.js`](../../../e2e/web/playwright.config.js) lines
  39–43) — against the compose stack. The `checkA11y()` fixture
  ([`e2e/web/lib/axe.js`](../../../e2e/web/lib/axe.js)) runs axe at WCAG 2.1 AA,
  where `color-contrast` really runs. [`e2e/web/tests/books.spec.js`](../../../e2e/web/tests/books.spec.js)
  already opens the rename dialog and runs `checkA11y()` on all three viewports
  (lines 16, 40–50) — the journey this task hardens.

**Downstream:** every later screen with an overlay inherits the fix for free —
the song save sheet and its prefilled note (`songs.save`, workflow 4), the
shape picker and the transpose/menu popovers, the setlist sheets
(`books.setlists`), sign-in and sharing dialogs (`account`, `books.share`).
None of them need the per-screen `closest('.est')` plumbing once the provider is
in place; that is the point of the task.

## What this task is

Make React Aria overlays inherit the app's design tokens by default, once, at
the token root — instead of each screen re-plumbing it:

1. **Add `react-aria` as a direct dependency** of `app/`
   ([`app/package.json`](../../../app/package.json)), pinned to the version line
   React Aria Components `^1.21.1` already resolves (`^3.52.1`). The
   `UNSAFE_PortalProvider` component is exported by the `react-aria` aggregate
   package only — React Aria Components does **not** re-export it — so a direct
   dependency is required to import it (it resolves today only because RAC pulls
   it in transitively). Updating `package.json` requires updating
   `app/package-lock.json` via `npm install react-aria` (a network install; see
   Constraints).
2. **Wrap `ThemeRoot`'s children with `UNSAFE_PortalProvider`**, resolving the
   `.est` root through its `getContainer` callback. `ThemeRoot` is the one
   component that owns the `.est` element, so a provider there gives every
   overlay anywhere beneath it a portal container inside the token scope. The
   container is read by ref (`getContainer` is invoked lazily, at portal time,
   so the ref is populated by then):

   ```jsx
   const rootRef = useRef(null);
   return (
     <div ref={rootRef} className={themeClasses(applied, density)}>
       <UNSAFE_PortalProvider getContainer={() => rootRef.current}>
         {children}
       </UNSAFE_PortalProvider>
     </div>
   );
   ```
3. **Retire the per-screen workaround in `BooksScreen.jsx`** — remove the
   `rootRef`/`portalContainer`/`useEffect` block (lines 285–289) and the
   `UNSTABLE_portalContainer` props (lines 160, 215), now covered app-wide by
   the provider. (The `UNSTABLE_portalContainer` prop name is also stale in RAC
   `1.21.1`, which renamed it `UNSAFE_portalContainer`; the provider makes the
   whole per-overlay prop unnecessary.) The `.dialog` responsive cap in
   `books.css` stays — it is a layout cap, independent of where the overlay
   mounts.
4. **`theme.css` is untouched.** The fix is *where* overlays mount, not *how*
   they are styled; the stylesheet stays verbatim to the mockup.

## Why it needs to be done

React Aria Components portals its overlays (`ModalOverlay`/`Modal`/`Popover`/
`Tooltip`) to `document.body` by default — **outside** `ThemeRoot`'s `.est`
element, where every design token is defined
([`app/src/theme/theme.css`](../../../app/src/theme/theme.css) lines 13–40,
scoped to `.est`). A portaled overlay therefore renders with every `var(--…)`
undefined: no padding, no gaps, raw fixed widths, wrong colours — and on a phone
a token-less dialog can overflow the viewport and push its action off-screen.
`books.shelf` hit exactly this and worked around it per-overlay, resolving the
`.est` ancestor by hand in `BooksScreen.jsx` and registering the app-wide fix as
this task ([`books/shelf.md`](../books/shelf.md) line 613). The workaround does
not scale: every future screen with a dialog, sheet, menu or popover — the song
save sheet, the shape picker, setlist sheets, sign-in and sharing — would have
to repeat the same `closest('.est')` plumbing, and any screen that forgets it
ships a broken overlay. A single `UNSAFE_PortalProvider` at the `.est` root
fixes it once for the whole app and lets every later overlay task stay focused
on its own behaviour. It is the explicit `!layout` + `books.shelf` successor the
WBS scoped for this.

## Inputs / context

- **The `.est` token root to resolve.**
  [`app/src/theme/ThemeRoot.jsx`](../../../app/src/theme/ThemeRoot.jsx) lines
  47–52 — `ThemeRoot` renders the single `<div className="est theme-<applied>
  density-<density>">{children}</div>`; it is the outermost app wrapper
  ([`app/src/App.jsx`](../../../app/src/App.jsx) lines 29–35: `ThemeRoot` →
  `LocaleRoot` → `AppShell`), and its `.est` root stays put across
  `LocaleRoot`'s language remount. The provider wraps `{children}` here.
- **The token scoping that makes the portal escape matter.**
  [`app/src/theme/theme.css`](../../../app/src/theme/theme.css) — `.est { --u:
  8px; --radius; … }` (lines 13–26) and `.est.theme-estante { --bg; --surface;
  --ink; --accent; … }` (lines 29–40); nothing is defined at `:root`.
- **The portal provider's API.**
  `app/node_modules/react-aria/dist/types/src/overlays/PortalProvider.d.ts` —
  `export declare function UNSAFE_PortalProvider(props: PortalProviderProps):
  JSX.Element`, where `PortalProviderProps.getContainer?: (() => HTMLElement |
  null) | null` ("Should return the element where we should portal to"). The
  companion `useUNSAFE_PortalContext()` is what RAC's `Modal`/`Popover`/
  `Tooltip` read internally. React Aria Components' `Modal.d.ts` line 26
  documents the per-overlay container prop as `@deprecated - Use a parent
  UNSAFE_PortalProvider to set your portal container instead.` — the exact
  upgrade path this task takes.
- **The dependency status.** [`app/package.json`](../../../app/package.json)
  line 23 (`"react-aria-components": "^1.21.1"`); `react-aria` absent from
  `dependencies`. [`app/package-lock.json`](../../../app/package-lock.json)
  resolves `node_modules/react-aria` to `3.52.1` (RAC `1.21.1`'s own pinned
  dependency). `react-aria`'s `dist/exports/index.mjs` re-exports
  `UNSAFE_PortalProvider` and `useUNSAFE_PortalContext`; `react-aria-components`'
  exports index contains no `PortalProvider` symbol.
- **The overlays the fix serves today.**
  [`app/src/books/BooksScreen.jsx`](../../../app/src/books/BooksScreen.jsx) —
  `RenameDialog` `ModalOverlay` (line 160) and `AddBookSheet` `ModalOverlay`
  (line 215), both carrying `UNSTABLE_portalContainer={portalContainer ??
  undefined}`; the container resolution at lines 285–289; the comment at
  278–284. These are the only RAC overlays in `app/src`.
- **DIRECTION §3.7** ([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) lines
  394–426): React Aria Components chosen for "the richest accessible experience"
  (396) — "sheets, dialogs that hold focus, menus, the shape picker … drag to
  reorder" (399–401); "Its components carry no look of their own, so the visual
  language (`docs/mockups/theme.css`) applies as drawn" (404–405) — the promise
  this task makes true for portaled overlays; "the view is the only layer that"
  knows React (415–417). §3.6 line 288: the app and the service share no code.
- **Status by a word, never colour alone** —
  [`docs/mockups/README.md`](../../../docs/mockups/README.md) lines 26–27; bears
  on the overlays' own accessible state, preserved by this change.
- **The e2e journey to harden.**
  [`e2e/web/tests/books.spec.js`](../../../e2e/web/tests/books.spec.js) lines
  16, 40–50 — the rename dialog opened and `checkA11y()`-checked on each
  viewport; [`e2e/web/playwright.config.js`](../../../e2e/web/playwright.config.js)
  lines 39–43 — the three viewport projects every spec runs on.
- **Behavior-test precedent for wrapping in `ThemeRoot`.**
  [`app/src/theme/ThemeRoot.test.jsx`](../../../app/src/theme/ThemeRoot.test.jsx)
  (renders `<ThemeRoot store={store}>…</ThemeRoot>` with `checkWcag21aa`) and
  [`app/src/worker/preferences-surface.behavior.test.jsx`](../../../app/src/worker/preferences-surface.behavior.test.jsx)
  — each wraps inline; no shared ThemeRoot test helper exists. The RAC overlay
  test pattern is in
  [`app/src/books/BooksScreen.behavior.test.jsx`](../../../app/src/books/BooksScreen.behavior.test.jsx).
- **Predecessor/sibling refinements:** [`books/shelf.md`](../books/shelf.md)
  (the overlays and the workaround, line 613), [`layout.md`](layout.md) (the
  shell frame; the jsdom-contrast scope note), [`tokens.md`](tokens.md) (the
  `.est` token root and the axe-helper scope),
  [`../foundation/app_tooling.md`](../foundation/app_tooling.md) (the stack and
  the `color-contrast`-is-a-jsdom-no-op note).

## Constraints / requirements

- **React Aria for every interactive part** (standing accessibility rule;
  DIRECTION §3.7). This task adds no new interactive UI — it configures RAC's
  own portal mechanism so overlays inherit the token scope. It must use RAC's
  supported `UNSAFE_PortalProvider`/`getContainer` seam, not a hand-rolled
  portal.
- **`theme.css` untouched; no new visual language.** The fix is purely *where*
  overlays mount; the drawn stylesheet stays verbatim to the mockup (any
  responsive cap already lives in a screen's own layout CSS, e.g.
  `books.css`). No new colours, radii or tokens.
- **The view is the only layer that knows React** (DIRECTION §3.7 lines
  415–417). The provider is a thin wrapper inside `ThemeRoot` (a view
  component); it touches no store slice, no Worker message, no IndexedDB. The
  `getContainer` ref is local DOM plumbing.
- **Dependency hygiene / lockfile** (project standing constraint): adding
  `react-aria` to `package.json` requires updating `app/package-lock.json` in
  the same change, or `scripts/gate`'s `npm ci` hard-fails at install. The
  lockfile update needs a real `npm install react-aria` against the registry;
  if the environment's sandbox blocks that network install, it is surfaced as a
  blocker (the package.json + code + tests are still written against it) — not
  worked around by hand-editing the lockfile.
- **Accessibility** (standing rule): the portaled overlays remain axe-clean at
  WCAG 2.1 AA; with tokens now reaching them, contrast passes in a real browser;
  focus management, keyboard paths and status-by-word (mockups README 26–27)
  are RAC's and are unchanged by the portal location.
- *Rules that do not bear on this task:* canonical form over preserving content
  (no song is written); no song text in logs (no logging, no song text);
  offline first (no network path at runtime — the dependency install is
  build-time); no book without an account (no book is opened). Named for
  completeness.

## Acceptance criteria

**Behaviour delivered.**

- `react-aria` `^3.52.1` is a direct dependency in
  [`app/package.json`](../../../app/package.json), with the matching
  `app/package-lock.json` entry, and `scripts/gate`'s `npm ci` installs cleanly.
- `ThemeRoot` wraps its children in `UNSAFE_PortalProvider` whose `getContainer`
  returns the `.est` root element. Any React Aria overlay
  (`ModalOverlay`/`Modal`/`Popover`/`Tooltip`) rendered anywhere beneath
  `ThemeRoot` portals **into** the `.est` element and so inherits the design
  tokens — no per-screen container prop needed.
- The `BooksScreen.jsx` per-screen workaround is removed (the
  `rootRef`/`portalContainer`/`useEffect` block and the two
  `UNSTABLE_portalContainer` props); the rename dialog and the *Add a book*
  sheet still open, render with correct tokens, and remain accessible — now via
  the app-wide provider. The `.dialog` responsive cap in `books.css` is kept.

**Tests the task lands with, by level.**

- **behavior — `app/src/theme/ThemeRoot.behavior.test.jsx`** (new; Vitest +
  Testing Library; axe via `checkWcag21aa`): render `ThemeRoot` wrapping a small
  React Aria overlay (a `DialogTrigger` → `ModalOverlay` → `Modal` → `Dialog`),
  open it, and assert the overlay's rendered node is a **descendant of the
  `.est` element** (i.e. `container.querySelector('.est')` contains the dialog),
  not a direct child of `document.body` outside it; axe-clean. A second case
  asserts an overlay rendered *without* a surrounding `ThemeRoot` still mounts
  (falls back to `document.body`) so the provider is additive, not required for
  a bare render. *Pins:* the token-scope inheritance the `.tji` note names
  ("a RAC overlay rendered through the portal inherits design tokens, axe");
  `UNSAFE_PortalProvider`'s `getContainer` contract (PortalProvider.d.ts);
  DIRECTION §3.7 lines 404–405. Axe here pins role/name/structure — the rules
  that run under jsdom; **contrast is pinned at e2e-web** (jsdom has no layout,
  so `color-contrast` is a no-op — the established scope note in
  `foundation/app_tooling.md`).
- **behavior — `app/src/books/BooksScreen.behavior.test.jsx`** (updated): the
  rename dialog and the *Add a book* sheet, with the per-screen workaround
  removed, open and are axe-clean when `BooksScreen` is rendered inside
  `ThemeRoot` (the overlay landing inside `.est` via the provider); the existing
  overlay-behaviour assertions (open, submit, close) continue to pass. *Pins:*
  no regression to shelf's overlays ([`books/shelf.md`](../books/shelf.md) lines
  388–393); the provider subsuming the retired workaround.
- **e2e-web — `e2e/web/tests/portal.spec.js`** (new; Playwright, three
  viewports, compose stack; imports `{ test, expect }` from `../lib/axe.js`):
  on each of phone, tablet and computer, open the rename dialog and the *Add a
  book* sheet on the Books screen and assert (a) the overlay is a descendant of
  the `.est` element in the live DOM, and (b) a token-driven computed style is
  actually applied — e.g. the dialog's `background-color` matches the theme
  surface and its padding is non-zero (proving `var(--…)` resolved) — and that
  the dialog's action button is within the viewport and clickable on the phone
  (the overflow the workaround originally guarded against); then `checkA11y()`
  (WCAG 2.1 AA, **contrast runs here in a real browser**) is clean on each
  overlay. *Pins:* "the rename dialog and any sheet on the three viewports shows
  correct tokens and passes axe" (`.tji` note); the per-viewport layout
  (playwright.config.js 39–43); DIRECTION §3.7 404–405. The existing
  `e2e/web/tests/books.spec.js` rename journey continues to pass unchanged.

No test level the note names is dropped. No test is deferred.

**No deferred WBS leaf.** This task *closes* the `books.shelf` tech debt; there
is no remaining overlay the app ships that the provider does not cover (the two
in `BooksScreen` are the only ones), so it registers **no** new follow-up. The
only non-code item is environmental — the `npm install react-aria` lockfile
update needs registry access — surfaced in the return summary as a run-condition
if the sandbox blocks it, not a WBS task.

## Decisions

- **Use `UNSAFE_PortalProvider` from the `react-aria` package — the `.tji`
  note's `UNSTABLE_PortalProvider` is an approximate name.** The symbol the
  installed `react-aria` `3.52.1` (and React Aria Components `1.21.1`) exports is
  `UNSAFE_PortalProvider` (verified in
  `node_modules/react-aria/dist/exports/index.mjs` and
  `.../overlays/PortalProvider.d.ts`; RAC's `Modal.d.ts` line 26 names it in its
  deprecation note). It takes a `getContainer: () => HTMLElement | null`
  callback, **not** a container prop. *Rationale:* the note captured the intent,
  not the exact current symbol; the refinement binds to the real API.
  *Alternative rejected:* wait for a non-`UNSAFE_`-prefixed name — there is
  none; React Aria has shipped this under the `UNSAFE_` prefix across the
  3.x/1.x line, and the deprecated per-overlay prop points at it as *the*
  supported replacement.
- **Promote `react-aria` to a direct dependency; this is not a design delta.**
  *Rationale:* `react-aria` is already installed transitively (`3.52.1`) as
  React Aria Components' own foundation — same maintainers, same version line,
  no new vendor, no added runtime weight; it is simply not directly importable
  until listed. The `.tji` note explicitly scopes "Add react-aria as a direct
  dependency." Making an already-present transitive export importable introduces
  no new architectural seam, so no DIRECTION/workflow edit is required. Pin
  `^3.52.1` to track RAC `1.21.1`'s transitive resolution and avoid a version
  skew between the two. *Alternatives rejected:* (a) deep-import from
  `react-aria-components/dist/.../PortalProvider` or `@react-aria/overlays` —
  not a public export of RAC, fragile across patch releases; (b) a local
  re-export shim — hides the dependency and still needs the package resolvable.
- **The provider lives in `ThemeRoot`, wrapping its children, resolving `.est`
  by ref via `getContainer`.** *Rationale:* `ThemeRoot` is the single component
  that owns the `.est` token root; one provider there covers every overlay in
  the app with no per-screen plumbing — the task's entire purpose. `getContainer`
  is a lazy callback invoked at portal time, so a ref on the `.est` div is
  populated by the time any overlay opens; this subsumes the mount-ordering the
  `BooksScreen` `useEffect` handled by hand. *Alternative rejected:* place the
  provider in `App.jsx` above `ThemeRoot` — `App` does not own the `.est`
  element and would have to reach into `ThemeRoot`'s ref anyway; keeping it where
  the element is defined is simpler and leak-free.
- **Remove the per-screen workaround from `BooksScreen.jsx`; keep the
  `books.css` cap.** *Rationale:* the task exists precisely to retire the
  per-overlay `UNSTABLE_portalContainer` plumbing; leaving it is dead code, and
  the prop name is already stale in RAC `1.21.1` (renamed `UNSAFE_portalContainer`)
  so it may no longer even take effect. The `.dialog` max-width cap is a
  responsive layout concern independent of portaling and stays in the screen's
  own CSS. *Alternative rejected:* keep the workaround as belt-and-suspenders —
  redundant with the provider and a maintenance trap.
- **Behavior-level axe pins structure; contrast is pinned at e2e-web.**
  *Rationale:* axe's `color-contrast` needs layout and is a no-op under jsdom
  (the established scope note). The behavior test can prove the overlay lands
  inside `.est` and is role/name/structure-clean; that tokens *visually* resolve
  (padding, surface colour, no phone overflow) is pinned in a real browser at
  e2e-web, which is also where the original defect manifested. *Alternative
  rejected:* assert token values at behavior level — jsdom resolves no `var(--…)`
  and runs no contrast, so the assertion would be hollow.

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-06.

- `app/package.json` + `app/package-lock.json`: added `react-aria@^3.52.1` as a direct dependency; lockfile updated via `npm install react-aria` (network install succeeded).
- `app/src/theme/ThemeRoot.jsx`: wrapped children in `UNSAFE_PortalProvider` with `getContainer` returning the `.est` root via ref; every React Aria overlay beneath `ThemeRoot` now portals inside the token scope.
- `app/src/books/BooksScreen.jsx`: removed the `rootRef`/`portalContainer`/`useEffect` workaround and both `UNSTABLE_portalContainer` props (lines 160, 215); the `.dialog` responsive cap in `books.css` kept untouched.
- `app/src/theme/ThemeRoot.behavior.test.jsx` (new): behavior test — portals a RAC overlay into `.est`, axe-clean; additive bare-render fallback.
- `app/src/books/BooksScreen.behavior.test.jsx` (updated): screen now rendered inside `ThemeRoot`; overlays open/submit/close and stay axe-clean.
- `e2e/web/tests/portal.spec.js` (new): e2e-web on all three viewports — overlay is descendant of `.est`, token-driven computed styles applied, action in viewport, `checkA11y()` clean.

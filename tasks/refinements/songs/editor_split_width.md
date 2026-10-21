# songs.editor_split_width — The editor splits text and preview only when wide enough

## TaskJuggler entry

[`tasks/60-songs.tji` L247-252](../../60-songs.tji) — `task editor_split_width`
in the `songs` block. Wired into `milestones.m5_complete`
([`tasks/99-milestones.tji` L45](../../99-milestones.tji)).

## Effort estimate

0.5d (from the `.tji`). One hook and one pure rule in the editor, a handful of
condition swaps in `SongEditor.jsx`, a behavior test block and one e2e-web
journey.

## Repository

The estante-de-cifras app only — not `cifra.md/`:

- `app/src/editor/editor-split.js` (new) — the pure rule and its 640px constant;
- `app/src/editor/editor-split.test.js` (new) — its unit test;
- `app/src/editor/SongEditor.jsx` — measuring its own width, and deciding the
  split, the toggle and Help's place from it;
- `app/src/editor/SongEditor.behavior.test.jsx` — the new behavior block;
- `e2e/web/tests/editor-split.spec.js` (new) and the existing
  `e2e/web/tests/editor.spec.js` L45-58 (its wide-screen expectation follows
  the measured width instead of the project name).

No design delta: workflow 3 §The editor (L78-84) already says what this task
builds (written by `design.review_polish`).

## Inherited dependencies

- **Settled:** `design.review_polish` (complete) — item 10 decided the rule and
  wrote it into workflow 3 (refinement
  [`design/review_polish.md`](../design/review_polish.md) L274-280, Decision
  *The editor splits by its own width* L459-466). `songs.editor` (the editor,
  its Text | Preview toggle and wide split), `songs.format_help` (Help in the
  editor's bar, sheet on a phone and popover elsewhere), `songs.editor_chrome`
  (the hosts' chrome, the computer's save panel replacing the preview through
  `showPreview={false}`), `shell.full_height` (the panes scroll on their own),
  `foundation.e2e_web` (the harness, the three projects, `checkA11y`).
- **Pending:** none.

## What this task is

Today `SongEditor` puts text and preview side by side whenever the shell's
layout mode is `wide` (viewport ≥ 600px, `app/src/shell/layout-mode.js`
`WIDE_QUERY`), and shows *Text | Preview* only in the `narrow` (phone) mode.
Workflow 3 now says the editor's **own** width decides: side by side only when
the editor is at least 640px wide; narrower — a phone turned sideways, a narrow
window on a computer, an editor squeezed beside a rail — it is *Text | Preview*,
one at a time, with *Help* beside it, whatever the shell's layout. This task
makes the editor measure itself and follow that rule.

## Why it needs to be done

The 2026-10-19 persona pass found the two panes crowded in a wide-layout window
too narrow for both (review_polish item 10): between the 600px shell breakpoint
and the two panes' minimum (280px text + 340px preview + the gap) the text was
squeezed to a few words per line. It is one of the M5 polish leaves
(`milestones.m5_complete`). Nothing downstream depends on it.

## Inputs / context

- `docs/workflows/03-write-a-new-song.md` §The editor, L78-84 — the rule (the
  normative text), and §Help with the format L110-113 (Help beside *Text |
  Preview* on a phone, beside *Add section* on a tablet and a computer) and
  L115-118 (a sheet on a phone, a panel hanging from Help elsewhere).
- `tasks/refinements/design/review_polish.md` L274-280 (item 10), L353-360 (this
  task's registered note), L459-466 (Decision: 640px of editor width,
  independent of the shell's 600px breakpoint; rejected moving the shell
  breakpoint and a fixed device rule), L497 (the 640 figure is inferred — on
  the parking lot, not reopened here).
- `app/src/editor/SongEditor.jsx`:
  - L102, L120-121 — `layoutMode` prop and `useLayoutMode()` → `mode`;
  - L127 — `previewTab` state (the toggle's choice);
  - L116 — `showPreview: previewAllowed` (the host withholding the preview);
  - L512-514 — `narrow`, `showEditorPane`, `showPreviewPane`;
  - L517-527 — the Help button (class `narrow` → `margin-left: auto`,
    `editor.css` L188-190);
  - L532-544 — the *Text | Preview* `ToggleButtonGroup`, shown on
    `mode === 'narrow'`;
  - L548, L552-554 — Help beside the toggle when narrow, in the bar's actions
    otherwise;
  - L605-606 — `FormatHelp presentation={narrow ? 'sheet' : 'popover'}`;
  - L659-679 — `.est-editor-body` with `split` when `!narrow && previewAllowed`,
    the text pane (hidden, never unmounted) and the preview region (mounted
    only when shown, `tabIndex={0}`).
- `app/src/editor/editor.css` L9-15 (`.est-editor`), L63-74 (`.est-editor-body`
  and `.split`), L76-82 (panes `flex: 1; min-width: 0`).
- `app/src/shell/layout-mode.js` L22 (`WIDE_QUERY` 600px) and its
  `*_WIDE_QUERY` siblings — the precedent of one named constant per layout
  line, each with the arithmetic that justifies it.
- Hosts: `app/src/songs/EditSongHost.jsx` L120-140 (full-screen editor chrome;
  on the computer the 300px Unsaved pane beside it, `showPreview={!panelOpen}`),
  `app/src/songs/NewSongHost.jsx` L88, `app/src/files/RawEditorHost.jsx` L52-63
  (the file view's raw editor, no Help — workflow 3 L113-114).
- Tests today: `app/src/editor/SongEditor.behavior.test.jsx` L395-411 (wide
  split / narrow toggle by `layoutMode` prop, no `ResizeObserver` in jsdom);
  `e2e/web/tests/editor.spec.js` L45-58 (preview beside on tablet and computer
  by project name, `mockup(page, 'W03-write-a-new-song', 4)`);
  `e2e/web/playwright.config.js` L40-42 (Pixel 7 412px, Galaxy Tab S4 712px,
  Desktop Chrome 1280px); `page.setViewportSize` is already used in
  `e2e/web/tests/narrow-fixes.spec.js` L41, `header.spec.js` L61,
  `history.spec.js` L82 (real UI, allowed by `e2e/web/eslint.config.js`).
- The app has no `ResizeObserver` user yet (no seam to reuse); its media-query
  hooks are `useSyncExternalStore` over `matchMedia` (`AppShell.jsx` L72-118).

## Constraints / requirements

1. **The rule**: `split = previewAllowed && width >= 640`, where `width` is the
   editor's own width — the `.est-editor-body` box the two panes share — not
   the viewport. The constant `EDITOR_SPLIT_MIN_WIDTH = 640` lives in
   `app/src/editor/editor-split.js` with its arithmetic in a comment
   (280px text + 340px preview + the gap, workflow 3 L79-80), beside a pure
   `editorSplits({ width, mode, previewAllowed })`.
2. **Unmeasured falls back to the layout mode.** A width of `null` or `0` (not
   yet laid out, or no `ResizeObserver`, as in jsdom) reads as today:
   `mode === 'wide'` splits. So every existing behavior test that renders with
   `layoutMode="wide"` and no observer keeps its meaning.
3. **Measured before paint.** `SongEditor` reads the body's width in a
   `useLayoutEffect` (`getBoundingClientRect().width`) and then follows a
   `ResizeObserver` on the same element, storing the width in state only when
   the split answer changes (no re-render per pixel). No flash of the split on
   a narrow window. The observer is disconnected on unmount. The hook stays in
   the view (`SongEditor.jsx`); the rule stays pure (DIRECTION §3.7: the view
   is the only layer that knows React).
4. **What follows `split`** (replacing the `narrow` uses at L513-514, L520,
   L532, L548, L552-554, L659):
   - `split` → both panes, `.est-editor-body.split`, no toggle, Help in the
     bar's actions beside *Add section* (as on a tablet and a computer today);
   - not `split` and the preview allowed → the *Text | Preview* toggle, one
     pane at a time by `previewTab`, Help beside the toggle (class `narrow`,
     pushed right), whatever `mode` is;
   - preview withheld by the host (`showPreview={false}`, the computer's save
     panel) → text only, no toggle, as today (Decision 3).
5. **What does not follow `split`** — it stays on the layout mode, because the
   workflow ties it to the device: `FormatHelp`'s presentation (sheet on a
   phone, popover on a tablet and a computer — workflow 3 L115-118), and the
   hosts' chrome (Add section in the phone's bottom bar, the computer's
   Unsaved pane, `EDITOR_WIDE_QUERY`). Only the editor's two panes, its toggle
   and Help's place in its bar change.
6. **Focus is kept across the switch.** The text pane is never unmounted (only
   `hidden`), and the preview region stays the same element while shown. When
   the width falls under 640px, the toggle opens on the pane that holds focus:
   focus inside the preview region → *Preview*; otherwise → *Text* (setting
   `previewTab` accordingly at the crossing), so the focused element is never
   hidden. When the width grows to 640px or more, both panes show and focus is
   untouched. The cursor and the text survive both ways (same CodeMirror view).
7. **No loop.** The body's width comes from its container (`flex: 1`, panes
   `min-width: 0`), not from which panes show, so switching cannot change the
   width that decided it.
8. **Accessibility.** The toggle is the existing RAC `ToggleButtonGroup`
   (radios with words), Help keeps its word, the preview region keeps its
   name and `tabIndex`; axe clean at WCAG 2.1 AA in both arrangements on every
   viewport.
9. No copy changes; no new locale keys.

## Acceptance criteria

Behavior delivered: on any device, the editor shows text and preview side by
side exactly when its own width is at least 640px, and *Text | Preview* with
*Help* beside it otherwise; the switch happens live as the window or the
panes around the editor resize, keeping focus, the cursor and the text.

Tests, by level:

- **unit** — `app/src/editor/editor-split.test.js`: `editorSplits` at 639 →
  false, 640 → true, 1000 → true; `null`/`0` → `mode === 'wide'`;
  `previewAllowed: false` → false at any width (workflow 3 L78-84; Constraints
  1-2).
- **behavior** — `app/src/editor/SongEditor.behavior.test.jsx`, a new
  `describe('the split follows the editor\'s own width (songs.editor_split_width)')`
  with a fake `ResizeObserver` stubbed on `globalThis` (recording the observed
  element, letting the test deliver a width) and the body's
  `getBoundingClientRect` stubbed to the same width:
  - `layoutMode="wide"` at 639px: no `.est-editor-body.split`, the *Text* and
    *Preview* radios, Help next to them in the bar (not inside
    `.est-editor-bar-actions`), the chart absent until *Preview* is pressed
    (workflow 3 L81-84);
  - `layoutMode="wide"` at 640px: `.split`, both `.cm-editor` and `.chart`, no
    radios, Help in the actions beside *Add section* (workflow 3 L78-80,
    L110-113);
  - `layoutMode="narrow"` at 800px: split — the width decides, not the layout
    ("whatever the device", L81); `FormatHelp` still opens as the sheet
    (Constraint 5);
  - live crossing with focus in the text: at 800px focus `.cm-content`, deliver
    600px → *Text* selected, `document.activeElement` still inside
    `.cm-content`, the typed text intact; deliver 800px → split, focus still
    there (Constraint 6);
  - live crossing with focus in the preview: at 800px focus the preview region,
    deliver 600px → *Preview* selected and the region still focused;
  - `showPreview={false}` at 600px and at 800px: text only, no radios, no
    chart (Constraint 4, songs.editor_chrome);
  - the observer is disconnected on unmount;
  - axe clean on the 639px and the 640px renders.
  The existing L395-411 case (by `layoutMode`, no observer) stays as the
  fallback's pin (Constraint 2).
- **e2e-web** — `e2e/web/tests/editor-split.spec.js` on phone, tablet and
  computer, reaching the editor through `openExampleBook` + `openSongInEditor`
  (`e2e/web/lib/journeys.js` L57, L332), with a helper in the spec that reads
  `.est-editor-body`'s `clientWidth` and asserts the invariant: under 640px →
  the *Preview* radio visible, no `.est-editor-body.split`, pressing *Preview*
  shows `.chart`, *Help* visible beside the toggle; at 640px or more →
  `.split`, `.chart` visible beside `.cm-content`, no radios. Cases:
  - the project's own viewport (412px phone → toggle; 712px tablet and 1280px
    computer → whatever the measure says, asserted by the invariant), axe;
  - phone project at 844×390 via `page.setViewportSize` (a phone turned
    sideways, workflow 3 L82-83), the invariant, axe;
  - computer project at 620×800 via `page.setViewportSize` — the shell in its
    wide layout (≥600px) with an editor under 640px — expecting the toggle and
    Help beside it, then back to 1280×720 with the text typed before still
    there and the split restored (L83-84, "a narrow window on a computer"),
    axe in the toggle arrangement.
  `e2e/web/tests/editor.spec.js` L45-58 changes its `else` branch from "not the
  phone project" to the same measured invariant, so it cannot contradict the
  new rule on a tablet whose editor is under 640px; its W03#4 mockup capture
  stays.

All named tests run in the gate (`npm test` in `app/`, the e2e-web suite on
the three projects); none is skipped.

## Decisions

1. **Measure with `ResizeObserver` in the editor, not a CSS container query.**
   The rule changes structure, not just style — whether the toggle exists,
   whether the preview is mounted, where Help sits in the bar, which pane keeps
   focus — so React must know the answer. A container query could only hide
   things with CSS, leaving two Help buttons or a hidden radiogroup in the tree.
   `ResizeObserver` is a platform API (no dependency). Rejected: deriving the
   width from the viewport minus known chrome (the hosts change around the
   editor — Unsaved pane, save panel, file list — and the workflow says the
   editor's own width decides).
2. **Observe `.est-editor-body`**, the box the two panes share, so 640 means
   exactly "room for 280 + 340 + the gap". Rejected: `.est-editor` (same width
   today, but the body is what the arithmetic is about).
3. **A withheld preview stays withheld.** When the computer's save panel is open
   the host passes `showPreview={false}` and the panel stands where the preview
   was (songs.editor_chrome); the editor then shows text only and no toggle,
   even though the panel leaves it under 640px. Rejected: showing *Text |
   Preview* beside the save panel — a second preview competing with the panel's
   own summary of the save.
4. **Help's presentation stays with the device.** Workflow 3 L115-118 ties the
   sheet to the phone and the hanging panel to the tablet and computer, so
   that presentation keeps reading the layout mode; only Help's *place in the
   bar* follows the split (L81, "with *Help* beside it"). Rejected: a sheet
   whenever the editor is narrow (a bottom sheet on a computer window).
5. **Unmeasured falls back to the layout mode** rather than to "narrow": the
   existing behavior tests and any environment without layout keep today's
   meaning, and a real browser always measures before paint (Constraint 3).
6. **The toggle opens on the focused pane** at the crossing. Rejected: keeping
   the stale `previewTab` (it can hide the element with focus, losing the
   keyboard user's place).
7. **No dependency added for e2e.** The rotated phone and the narrow computer
   window are `page.setViewportSize` on the existing projects (already used by
   three specs), not new Playwright projects.

## Open questions

(none — all decided)

The 640px figure itself is inferred (review_polish L497, already on the parking
lot); this task implements it as decided.

## Status

**Done** — 2026-10-20.

- app/src/editor/editor-split.js: `editorSplits`, the 640px rule (a withheld preview never splits; an unmeasured width falls back to the layout mode).
- app/src/editor/SongEditor.jsx: measures `.est-editor-body` before paint, then follows a `ResizeObserver`, re-rendering only when the width crosses 640; below it the toggle opens on the pane that has focus, keeping focus, cursor and text. Help still opens as sheet or popover by device.
- app/src/editor/editor-split.test.js: unit (639, 640, 1000, unmeasured, withheld preview).
- app/src/editor/SongEditor.behavior.test.jsx: behavior with a fake `ResizeObserver` (639/640, narrow layout at 800, live crossings with focus in text and preview, withheld preview, disconnect on unmount, axe).
- e2e/web/tests/editor-split.spec.js: e2e-web on each project's viewport, the phone at 844x390, the computer at 620x800 and back, with axe.
- e2e/web/tests/editor.spec.js: the preview test follows the measured width instead of the project name.
- tasks/60-songs.tji: `complete 100` on `songs.editor_split_width`.


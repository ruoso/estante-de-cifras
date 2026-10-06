# books.file_view_spec_narrow_comment — Fix stale narrow comment in the file-view e2e spec

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task file_view_spec_narrow_comment
"Fix stale narrow comment in the file-view e2e spec"` under `task books`.
Dependencies as declared: `depends !file_view` (the sibling file-view task), plus
the parent `task books` cascade. The one-line note:

> "e2e/web/tests/file-view.spec.js line ~50 calls the tablet viewport narrow. The
> tablet is 712px (wide, > 600px threshold); backToTree() no-ops in wide — the
> comment is inaccurate. Fix the comment for accuracy. Source of debt:
> books.file_view (tasks/refinements/books/file_view.md, iter-0116). Governing:
> workflow 14; foundation.e2e_web. Tests: no new tests; the fix is in the e2e spec
> itself (comment-only change)."

This is a one-line documentation-accuracy fix inside the file-view Playwright
journey: a code comment that mislabels the tablet viewport. The helper it
describes is already correct; only its prose is stale.

## Effort estimate

**0.5d** (as scoped in the `.tji`), allocated `team`. The change is a comment
edit; the bulk of the half-day is confirming the layout-mode fact the comment
should state, running the existing e2e journey on all three viewports to confirm
the comment edit changes nothing behavioural, and the completion ritual.

## Repository

**estante-de-cifras** only. One file: `e2e/web/tests/file-view.spec.js` (the
`foundation.e2e_web` harness at `e2e/web/`). No cifra.md work — the note does not
start with `cifra.md:`. No `app/src` change: the helper and the app are correct;
the defect is a comment.

## Inherited dependencies

- **`books.file_view` (settled).** Shipped the file view and its e2e journey
  `e2e/web/tests/file-view.spec.js` (commit `08f0ffe`; refinement
  [`tasks/refinements/books/file_view.md`](file_view.md), Status at L754–756). It
  registered this follow-up as tech debt: "fix stale narrow comment in the e2e
  spec, wired to m2_local" (L756). The journey passed on phone, tablet and
  computer (L754), so the mislabelled comment never masked a real failure — the
  `backToTree()` helper's guard already handles the wide viewports correctly.
- **`foundation.e2e_web` (settled).** The Playwright harness and its
  phone/tablet/computer projects, the axe helper, and the compose stack the
  journey runs against.

No pending dependencies.

## What this task is

`e2e/web/tests/file-view.spec.js` L53–54 carries a comment on the `backToTree()`
helper that reads:

```js
// On the phone and tablet a file fills the screen; step back to the tree. The
// computer keeps the tree beside the file and has no such control.
```

This groups the tablet with the phone as a viewport where "a file fills the
screen". That is wrong. The app's layout breakpoint is `(min-width: 600px)`
(`app/src/shell/layout-mode.js:22`, `WIDE_QUERY`). The real test tablet is a
Galaxy Tab S4 at **712px** (`e2e/web/tests/navigation.spec.js:21`;
`app/src/shell/layout-mode.test.js:15–18`), which is **wide** — it keeps the tree
beside the file exactly as the computer does, and shows no "Back to files"
control. Only the **phone** (412px, narrow) fills the screen with one pane and
offers the back control.

The `backToTree()` helper is already correct: its `if (await back.count())` guard
clicks the "Back to files" button when it exists (phone) and no-ops when it does
not (tablet, computer). The task fixes only the comment, so it states the true
narrow/wide split.

## Why it needs to be done

A comment that says the tablet is narrow is a false statement in a test that other
authors read to understand the layout contract. Left stale, it invites a future
change to "fix" the already-correct helper to click a control that does not exist
on the tablet, or to add a tablet-narrow assumption elsewhere. The file-view
refinement flagged it at iter-0116 rather than hand-editing outside that task's
scope; this task closes the debt. It blocks nothing downstream — it is a
correctness-of-documentation fix wired to milestone **m2_local**.

## Inputs / context

- `e2e/web/tests/file-view.spec.js:53–58` — the `backToTree()` helper and the
  stale comment (the edit site).
- `e2e/web/tests/file-view.spec.js:45–51` — the adjacent `fileRow()` comment,
  which already describes "the wide (tablet and computer) split" **correctly**;
  the fixed `backToTree()` comment must agree with it.
- `app/src/shell/layout-mode.js:18–22` — `WIDE_QUERY = '(min-width: 600px)'`, the
  breakpoint and the reason for it ("tablet via the sidebar rail").
- `app/src/shell/layout-mode.test.js:15–18` — pins the Galaxy Tab S4 (712px) onto
  the wide side of the breakpoint.
- `e2e/web/tests/navigation.spec.js:21` — the authoritative phrasing of the three
  viewports: phone (412px) → the tab bar; tablet (712px) and computer (1280px) →
  the wide layout. The corrected comment should match this framing.
- [`tasks/refinements/books/file_view.md`](file_view.md) L157–163, L464 — the two
  layout modes split at `(min-width: 600px)`; "wide: tree and file side by side;
  narrow: one at a time (workflow 14 L124–132)". L756 registers this debt.
- `docs/workflows/14-*.md` (workflow 14, phone/tablet/computer) — the governing
  workflow for the file view's per-viewport layout.

## Constraints / requirements

- **Comment-only change.** No change to the `backToTree()` helper body, to any
  test, to assertions, to selectors, or to app code. The helper is correct.
- **No new tests, no removed/skipped tests.** The note scopes "no new tests"; the
  existing three-viewport journey must still run and pass unchanged.
- **Agreement with the sibling comment.** The fixed comment must not contradict
  the `fileRow()` comment at L45–51 ("the wide (tablet and computer) split").
- **Accuracy against the breakpoint.** The comment must state the 600px split:
  phone narrow (one pane, a back control), tablet and computer wide (tree beside
  file, no back control). The helper no-ops in the wide case by design.
- Standing rules are untouched by a comment edit (no song text, offline, account,
  accessibility, canonical form all unaffected).

## Acceptance criteria

**Behaviour delivered:** the `backToTree()` comment in
`e2e/web/tests/file-view.spec.js` accurately states that only the phone (narrow,
< 600px) fills the screen and offers "Back to files", while the tablet (712px) and
computer (1280px) are wide and keep the tree beside the file — so the helper
no-ops on both — matching `WIDE_QUERY` (`app/src/shell/layout-mode.js:22`),
`navigation.spec.js:21`, and workflow 14's phone/tablet/computer split.

**Tests, by level:**

- **No new tests** (per the note: comment-only change; there is no behaviour to
  pin that `file_view` did not already pin). The existing
  **e2e-web — `e2e/web/tests/file-view.spec.js`** journey (3 tests × 3 viewports —
  phone, tablet, computer; the file view on the three viewports: a new song, a raw
  edit saved with a rename, a restore from the log; axe — workflow 14) must run and
  pass unchanged after the edit, demonstrating the comment edit is behaviour-inert.
  The closer confirms this suite ran, not skipped, in the gate's output.

No test level is dropped: the note names no level beyond the inherited journey,
and a comment edit introduces no new testable behaviour — pinning a comment's
wording is not a test the gate can run.

## Decisions

- **Fix the comment, not the helper.** The helper's `if (await back.count())`
  guard is the correct, viewport-agnostic way to express "step back only when
  there is a back control". Rewriting it to branch on viewport width would couple
  the test to the breakpoint constant and add nothing — the guard already does the
  right thing on all three viewports. *Alternative rejected:* making the helper
  assert the phone-only presence of the control, which would turn a shared helper
  into a viewport-specific assertion and break its reuse at the tablet/computer
  call sites.
- **Match `navigation.spec.js:21`'s framing.** That spec already states the three
  viewports authoritatively (phone 412px → tab bar; tablet 712px and computer
  1280px → wide). Reusing its framing keeps the two specs' prose consistent and
  avoids inventing a third description of the same split. *Alternative rejected:*
  writing a fresh description, which risks drifting from the established wording.
- **No design delta.** The comment contradicts no governing document — DIRECTION,
  workflow 14 and the layout-mode module all already say the tablet is wide. The
  defect is purely a stale code comment, so there is nothing to amend in the
  constitution.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- Edited `e2e/web/tests/file-view.spec.js` L53–56: replaced the stale `backToTree()` comment (which wrongly grouped the tablet with the phone as "narrow") with accurate prose stating only the phone (412px, < 600px) fills the screen and offers "Back to files", while the tablet (712px) and computer (1280px) are wide and keep the tree beside the file — matching `WIDE_QUERY` (`app/src/shell/layout-mode.js:22`), `navigation.spec.js:21`, and the sibling `fileRow()` comment at L45–51.
- No helper-body change; no app code change; no test assertions added or removed.
- Existing e2e-web journey (`e2e/web/tests/file-view.spec.js`, 3 tests × 3 viewports — phone, tablet, computer) ran and passed (2 flaky on computer passed on retry; 124 clean), confirming the comment edit is behaviour-inert.

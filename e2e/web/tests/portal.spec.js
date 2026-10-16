import { test, expect } from '../lib/axe.js';
import { startApp, gotoTab } from '../lib/journeys.js';

// e2e-web — the portal-scope provider against the compose stack, on the three
// viewports (phone/tablet/computer projects auto-run every spec). ThemeRoot wraps
// the app in react-aria's UNSAFE_PortalProvider (shell.portal_provider), so a
// React Aria overlay portals *into* the `.est` token root rather than to
// document.body, and the visual language (theme.css, scoped to `.est`) "applies
// as drawn" (DIRECTION §3.7 L404-405). This is where the original defect
// manifested — a token-less overlay with no padding, a raw width that overflows
// a phone and pushes its action off-screen — so this is where tokens *resolving*
// is pinned, in a real browser with layout (jsdom has none). On each viewport we
// open the Add-a-book sheet and the rename dialog and assert: (a) the overlay is
// a descendant of `.est` in the live DOM; (b) a token-driven computed style is
// actually applied — a resolved surface background and non-zero padding, which
// are transparent/zero when `var(--…)` is undefined; (c) the overlay's action
// button sits within the viewport and is clickable (the overflow the per-screen
// workaround guarded against, worst on the phone); then axe at WCAG 2.1 AA —
// contrast included, since the real browser gives axe the layout it needs.
// Pins the .tji note ("the rename dialog and any sheet on the three viewports
// shows correct tokens and passes axe"); the book name is written for this test.

const NAME = 'Sexta de tarde';

// A token-driven box resolves its tokens only inside `.est`: `background:
// var(--surface)` computes to a real colour (not transparent) and `padding:
// calc(var(--u) * …)` to non-zero px. Outside the token scope both collapse —
// exactly the broken render this task fixes.
async function assertTokenScoped(box) {
  const styles = await box.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, padTop: cs.paddingTop, padLeft: cs.paddingLeft };
  });
  // `var(--surface)` resolved to a colour, not the transparent initial.
  expect(styles.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(styles.bg).not.toBe('transparent');
  // `calc(var(--u) * …)` resolved to real spacing, not 0 (an undefined --u).
  expect(parseFloat(styles.padTop)).toBeGreaterThan(0);
  expect(parseFloat(styles.padLeft)).toBeGreaterThan(0);
}

// The overlay's action button is within the viewport and clickable — the phone
// overflow the workaround originally guarded against.
async function assertActionInViewport(page, action) {
  await expect(action).toBeVisible();
  const bb = await action.boundingBox();
  const vp = page.viewportSize();
  expect(bb).not.toBeNull();
  expect(bb.x).toBeGreaterThanOrEqual(0);
  expect(bb.y).toBeGreaterThanOrEqual(0);
  expect(bb.x + bb.width).toBeLessThanOrEqual(vp.width + 1);
  expect(bb.y + bb.height).toBeLessThanOrEqual(vp.height + 1);
}

test('RAC overlays portal into `.est` and inherit tokens on this viewport (shell.portal_provider; DIRECTION §3.7 L404-405)', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);
  await gotoTab(page, 'Books');

  // ---- The Add-a-book sheet (a `.sheet` overlay) ----
  await page.getByRole('button', { name: 'Add a book' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // (a) The sheet is a descendant of `.est` (portaled into the token scope, not
  // document.body): the `.sheet` box resolves only when found inside `.est`.
  const sheet = page.locator('.est .sheet');
  await expect(sheet).toBeVisible();
  // (b) its tokens resolved (surface colour, real padding).
  await assertTokenScoped(sheet);
  // (c) the chooser's New book row, then its step's New-book action, are within
  // the viewport and clickable (books.add_book_chooser: the sheet is a chooser).
  const newRow = page.getByRole('dialog').getByRole('button', { name: 'New book' });
  await assertActionInViewport(page, newRow);
  // axe the open sheet (contrast runs here).
  await checkA11y();
  await newRow.click();
  const nameField = page.getByRole('dialog').getByRole('textbox', { name: 'Book name' });
  await expect(nameField).toBeVisible();
  const createAction = page.getByRole('dialog').getByRole('button', { name: 'New book' });
  await assertActionInViewport(page, createAction);

  // Create the book by clicking that action — proving it is reachable/clickable.
  await nameField.fill(NAME);
  await createAction.click();
  await expect(page.getByRole('button', { name: new RegExp(`^${NAME}`) })).toBeVisible();

  // ---- The rename dialog (a `.dialog` overlay) ----
  await page.getByRole('button', { name: `Rename ${NAME}` }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // (a) descendant of `.est`; (b) tokens resolved; (c) action in viewport.
  const dialog = page.locator('.est .dialog');
  await expect(dialog).toBeVisible();
  await assertTokenScoped(dialog);
  const saveAction = page.getByRole('dialog').getByRole('button', { name: 'Save' });
  await assertActionInViewport(page, saveAction);
  // axe the open dialog (contrast runs here).
  await checkA11y();
});

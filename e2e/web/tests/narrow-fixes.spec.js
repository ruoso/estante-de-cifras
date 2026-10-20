// narrow-fixes.spec.js (e2e-web) — nothing cut off or crowded where the persona
// exploration of 2026-10-19 found it (shell.narrow_fixes). Against the compose
// stack, on the phone/tablet/computer projects; on the phone each state is
// checked at its 412 px and again at 390 px, and at each width in both colour
// schemes (Estante and Palco through Automatic), ending in lib/fit.js's
// expectFits and axe at WCAG 2.1 AA. The four states: the Add a book sheet's
// Mine on Estante signed out (workflow 7 §The book-management screen), the
// account's Neck choice (workflow 13 §The account screen, workflow 16 §How
// diagrams are drawn), the setlist editor unsaved (workflow 12 §Building one,
// §The key; W12's editor bar) and search while typing (one clear control).
// Real-UI journeys only.

import { test, expect } from '../lib/axe.js';
import { expectFits, overlaps } from '../lib/fit.js';
import { gotoTab, openAddABook, openExampleBook, startApp } from '../lib/journeys.js';
import { SONG } from '../lib/journeys-core.js';
import { EXAMPLE_BOOK, addSongInEditor, addToNewSetlist, editSetlist, openSetlist } from '../lib/journeys-files.js';
import { chooseDiagramNeck, openAccount } from '../lib/journeys-account.js';

// The width the explorers' phones had, beside the phone project's 412 px.
const NARROW = 390;

const centre = (b) => b.y + b.height / 2;
const sameRow = (a, b) => Math.abs(centre(a) - centre(b)) <= Math.max(a.height, b.height) / 2;

// Let the automatic theme follow a scheme change (as lib/axe.js does).
async function settle(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

// Run `check` at the project's width and, on the phone, again at 390 px
// (restored in `finally`, as header.spec.js does); at each width in the current
// colour scheme and then the other, then axe (which covers both themes itself).
async function atEachWidthAndTheme(page, testInfo, checkA11y, check) {
  const before = page.viewportSize();
  const widths = testInfo.project.name === 'phone' ? [before.width, NARROW] : [before.width];
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height: before.height });
      const dark = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
      const found = dark ? 'dark' : 'light';
      try {
        for (const colorScheme of [found, dark ? 'light' : 'dark']) {
          await page.emulateMedia({ colorScheme });
          await settle(page);
          await check(`${width}px ${colorScheme}`);
        }
      } finally {
        await page.emulateMedia({ colorScheme: found });
        await settle(page);
      }
      await checkA11y();
    }
  } finally {
    await page.setViewportSize(before);
  }
}

// The computed `display` of the browser's own cancel × inside a search input.
// It is an element of the input's user-agent shadow tree (pseudo
// `-webkit-search-cancel-button`), which getComputedStyle(el, pseudo) does not
// resolve (it answers the input's own style), so it is read through the
// DevTools protocol — read-only.
async function nativeCancelDisplay(page, selector) {
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('DOM.enable');
    await client.send('CSS.enable');
    await client.send('DOM.getDocument', { depth: -1, pierce: true });
    const { result } = await client.send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(selector)})`,
    });
    expect(result.objectId, `no ${selector}`).toBeTruthy();
    const { node } = await client.send('DOM.describeNode', { objectId: result.objectId, depth: -1, pierce: true });
    const find = (n) => {
      const attrs = n.attributes ?? [];
      for (let i = 0; i < attrs.length; i += 2) {
        if (attrs[i] === 'pseudo' && attrs[i + 1] === '-webkit-search-cancel-button') return n;
      }
      for (const child of [...(n.shadowRoots ?? []), ...(n.children ?? [])]) {
        const hit = find(child);
        if (hit) return hit;
      }
      return null;
    };
    const cancel = find(node);
    expect(cancel, 'the search input has no native cancel element').not.toBeNull();
    const { nodeIds } = await client.send('DOM.pushNodesByBackendIdsToFrontend', {
      backendNodeIds: [cancel.backendNodeId],
    });
    const { computedStyle } = await client.send('CSS.getComputedStyleForNode', { nodeId: nodeIds[0] });
    return computedStyle.find((p) => p.name === 'display')?.value;
  } finally {
    await client.detach();
  }
}

// `inner` lies inside `outer` (to a pixel).
async function expectInside(inner, outer, what) {
  const a = await inner.boundingBox();
  const b = await outer.boundingBox();
  expect(a, `${what} has no box`).not.toBeNull();
  const inside = a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;
  expect(inside, `${what} [x ${Math.round(a.x)}–${Math.round(a.x + a.width)}] runs outside [x ${Math.round(b.x)}–${Math.round(b.x + b.width)}]`).toBe(true);
}

test('the Add a book sheet: Mine on Estante signed out wraps inside the sheet (workflow 7 §The book-management screen)', async ({
  page,
  checkA11y,
}, testInfo) => {
  await startApp(page);
  const sheet = await openAddABook(page);
  const mine = sheet.getByRole('group', { name: 'Mine on Estante' });
  const status = mine.getByRole('status');
  await expect(status).toHaveText('Sign in to see them.');
  const description = mine.locator('.mine-note').filter({ hasText: 'Your books that are not on this shelf yet.' });
  const parts = [
    [description, 'the Mine description'],
    [status, 'the signed-out sentence'],
    [mine.getByRole('button', { name: 'Sign in with a passkey' }), 'Sign in with a passkey'],
    [mine.getByRole('button', { name: 'No passkey here? Email me a link' }), 'No passkey here? Email me a link'],
  ];

  await atEachWidthAndTheme(page, testInfo, checkA11y, async (where) => {
    const { width } = page.viewportSize();
    const box = await sheet.boundingBox();
    expect(box.x, `${where}: the sheet starts inside the viewport`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${where}: the sheet ends inside the viewport`).toBeLessThanOrEqual(width + 1);
    for (const [part, what] of parts) await expectInside(part, sheet, `${where}: ${what}`);
    // The row itself lies inside its list: nothing of it is cut by the list's edge.
    await expectInside(mine, sheet.locator('.add-choices'), `${where}: the Mine row`);
    await expectFits(page, { sentences: [description] });
  });
});

test('the Neck choice: each name reads whole and "Selected" never crowds it (workflow 13 §The account screen, workflow 16)', async ({
  page,
  checkA11y,
}, testInfo) => {
  await startApp(page);
  await openAccount(page);
  const neck = page.getByRole('radiogroup', { name: 'Neck' });
  const names = neck.locator('.name');
  await expect(names).toHaveText(['Vertical', 'Horizontal']);

  for (const chosen of ['Vertical', 'Horizontal']) {
    await chooseDiagramNeck(page, chosen);
    const tile = neck.locator('label').filter({ has: page.getByRole('radio', { name: new RegExp(`^${chosen}`) }) });
    const name = tile.locator('.name');
    const badge = tile.getByText('Selected', { exact: true });
    await expect(badge).toBeVisible();
    await atEachWidthAndTheme(page, testInfo, checkA11y, async (where) => {
      await expectFits(page, { whole: [names, badge] });
      expect(overlaps(await badge.boundingBox(), await name.boundingBox()), `${where}: "Selected" overlaps ${chosen}`).toBe(false);
      await expectInside(badge, tile, `${where}: "Selected"`);
    });
  }
});

test('the setlist editor, unsaved: the bar wraps by group, the book name and the Key read whole (workflow 12 §Building one, §The key; W12)', async ({
  page,
  checkA11y,
}, testInfo) => {
  await openExampleBook(page);
  const setlist = 'Porch evening';
  await addToNewSetlist(page, SONG.search, SONG.title, setlist);
  await openSetlist(page, setlist);
  await editSetlist(page);
  const key = page.getByRole('textbox', { name: `Key for ${SONG.title}` });
  await key.fill('Am');

  const bar = page.locator('.setlist-edit-bar');
  // Never saved, so the status word is *not saved yet* (books.setlist_done).
  const badge = bar.getByText('not saved yet', { exact: true });
  await expect(badge).toBeVisible();
  const save = bar.getByRole('button', { name: 'Save', exact: true });
  const book = bar.getByText(EXAMPLE_BOOK, { exact: true });
  const hint = page.getByText('Key and note apply in this setlist only', { exact: true });
  const actions = ['Add song', 'Play', 'Discard'].map((name) => bar.getByRole('button', { name, exact: true }));
  const row = page.locator('.setlist-edit-row').filter({ has: key });

  await atEachWidthAndTheme(page, testInfo, checkA11y, async (where) => {
    // The hint beside the section title where both fit (a caption, not a
    // sentence squeezed into a column); dropped whole beneath it when not, where
    // it reads as a sentence.
    const titleBox = await page.getByText('Songs · drag to reorder', { exact: true }).boundingBox();
    const hintBox = await hint.boundingBox();
    const wrapped = hintBox.y >= titleBox.y + titleBox.height - 1;
    if (!wrapped) {
      expect(sameRow(hintBox, titleBox), `${where}: the hint is squeezed beside the title`).toBe(true);
      expect(hintBox.height, `${where}: the hint wraps beside the title`).toBeLessThanOrEqual(titleBox.height * 1.5 + 4);
    }
    await expectFits(page, { whole: [save, badge, book], sentences: wrapped ? [hint] : [] });

    // The status word is never alone on its row: an action shares it; Save is
    // the last action, at the bar's right.
    const badgeBox = await badge.boundingBox();
    const saveBox = await save.boundingBox();
    const boxes = await Promise.all(actions.map((a) => a.boundingBox()));
    expect(boxes.some((b) => sameRow(b, badgeBox)), `${where}: "not saved yet" sits alone on its row`).toBe(true);
    for (const b of [badgeBox, ...boxes]) {
      const before = b.y + b.height <= saveBox.y + 1 || (sameRow(b, saveBox) && b.x + b.width <= saveBox.x + 1);
      expect(before, `${where}: Save is not the last action`).toBe(true);
    }
    const barBox = await bar.boundingBox();
    const rightPad = barBox.x + barBox.width - (saveBox.x + saveBox.width);
    expect(rightPad, `${where}: Save is not at the bar's right`).toBeLessThanOrEqual(32);
    // The computer bar stays one row, as W12 draws it.
    if (testInfo.project.name === 'computer') {
      expect(sameRow(await bar.getByRole('button', { name: 'Done', exact: true }).boundingBox(), saveBox), `${where}: the bar wrapped`).toBe(true);
    }

    // The Key field lies inside its row and shows the typed key whole.
    await expectInside(key, row, `${where}: the Key field`);
    await expectInside(row.getByRole('textbox', { name: `Note for ${SONG.title}` }), row, `${where}: the Note field`);
    await expectInside(row.getByRole('button', { name: `Remove ${SONG.title} from setlist` }), row, `${where}: Remove`);
    await expect(key).toHaveValue('Am');
    expect(await key.evaluate((el) => el.scrollWidth <= el.clientWidth), `${where}: the Key is clipped`).toBe(true);
  });

  // The in-book picker has no ✕ of its own: it keeps the browser's cancel, its
  // only clear control (Constraint 4, Decision 6).
  await addSongInEditor(page, SONG.search);
  expect(await nativeCancelDisplay(page, '.setlist-search-input'), 'the picker lost its only clear control').not.toBe('none');
});

test('search while typing: one clear control, the app’s ✕ (Decision 6)', async ({ page, checkA11y }, testInfo) => {
  await openExampleBook(page);
  await gotoTab(page, 'Search');
  const input = page.getByRole('searchbox');
  await input.fill(SONG.search);
  const clear = page.getByRole('button', { name: 'Clear search' });

  await atEachWidthAndTheme(page, testInfo, checkA11y, async (where) => {
    await expect(clear).toBeVisible();
    const nativeCancel = await nativeCancelDisplay(page, '.search .field input');
    expect(nativeCancel, `${where}: the browser's own cancel × shows beside the app's ✕`).toBe('none');
    await expectFits(page, { whole: [input] });
  });

  await clear.click();
  await expect(input).toHaveValue('');
});

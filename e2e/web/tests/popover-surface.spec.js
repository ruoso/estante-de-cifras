import { test, expect } from '../lib/axe.js';
import { openExampleBook, openSongFromSearch, toDestinations } from '../lib/journeys.js';
import { chooseTheme } from '../lib/journeys-account.js';
import { expectInsideViewport } from '../lib/fit.js';

// e2e-web — every popover drawn on one surface (shell.popover_surface), on the
// three viewports (phone/tablet/computer projects auto-run every spec). The
// usability review (2026-10-19) found the reading view's Transpose popover
// see-through — its *Written key* printed over the shapes caption beneath (M7)
// — and the ⋯ menu see-through and cut off at the right edge (M9): a RAC
// Popover carries no look of its own (DIRECTION §3.7), and nothing drew one.
// jsdom has no layout or painting, so this is where "nothing reads through it"
// is pinned: in each theme — Estante and Palco through the automatic theme
// following the device's colour scheme, Caderno chosen on the account screen —
// the popover sits inside `.est`, its background is the theme's opaque
// --surface, and at the centre of every overlap between it and a visible
// element of the screen beneath, the browser's hit test (elementFromPoint)
// lands in the popover: nothing prints through it or over it. The ⋯ menu also
// opens bottom end — under its trigger, right edges aligned, inside the
// viewport. axe (WCAG 2.1 AA, Estante and Palco on each call) with each open.
// The song is the example book's.

const SEARCH = 'Morning';
const SONG_TITLE = 'Morning on the Porch';

// The three themes, in the order they are visited: the automatic theme on a
// light device (Estante), then on a dark one (Palco), then Caderno chosen.
const THEMES = [
  { name: 'Estante', scheme: 'light' },
  { name: 'Palco', scheme: 'dark' },
  { name: 'Caderno', scheme: 'light', chosen: true },
];

// Put the app in `theme` with the song open on the reading view.
async function readInTheme(page, theme) {
  await page.emulateMedia({ colorScheme: theme.scheme });
  if (theme.chosen) {
    await toDestinations(page);
    await chooseTheme(page, theme.name);
  }
  await openSongFromSearch(page, SEARCH, SONG_TITLE);
  await expect(page.locator('div.est').first()).toHaveClass(new RegExp(`theme-${theme.name.toLowerCase()}`));
}

// The RAC Popover element around an open menu or dialog (it carries
// `data-trigger`).
const popoverOf = (inner) => inner.locator('xpath=ancestor-or-self::*[@data-trigger][1]');

// The popover is on the surface: inside `.est`, carrying `popover`, its
// computed background an opaque colour equal to the `.est` root's resolved
// --surface (resolved through a probe, so the comparison is the browser's own
// colour, whatever notation the theme writes it in).
async function expectOnSurface(popover, what) {
  await expect(popover).toHaveClass(/\bpopover\b/);
  const seen = await popover.evaluate((el) => {
    const root = el.closest('.est');
    if (!root) return { inEst: false };
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--surface)';
    root.append(probe);
    const surface = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { inEst: true, background: getComputedStyle(el).backgroundColor, surface };
  });
  expect(seen.inEst, `${what} portals inside .est`).toBe(true);
  expect(seen.background, `${what} is drawn on the theme's --surface`).toBe(seen.surface);
  const alpha = seen.background.match(/^rgba\([^)]*,\s*([\d.]+)\)$/);
  expect(alpha ? Number(alpha[1]) : 1, `${what}'s background (${seen.background}) is opaque`).toBe(1);
}

// Nothing beneath shows through or over the popover: for every visible leaf
// element of the page outside the popover whose box overlaps the popover's
// (inset by its corner radius, so a hit test never lands in a rounded-off
// corner), the element at the overlap's centre is the popover or inside it.
// Returns the offenders, described.
async function throughOrOver(popover) {
  return popover.evaluate((pop) => {
    const r = pop.getBoundingClientRect();
    const inset = parseFloat(getComputedStyle(pop).borderTopLeftRadius) || 0;
    const box = { left: r.left + inset, top: r.top + inset, right: r.right - inset, bottom: r.bottom - inset };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      if (pop.contains(el) || el.contains(pop)) continue;
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const leaf = el.tagName.toLowerCase() === 'svg' || el.children.length === 0;
      if (!leaf) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) continue;
      const left = Math.max(b.left, box.left, 0);
      const top = Math.max(b.top, box.top, 0);
      const right = Math.min(b.right, box.right, vw);
      const bottom = Math.min(b.bottom, box.bottom, vh);
      if (right - left < 1 || bottom - top < 1) continue;
      const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
      if (!hit || !pop.contains(hit)) {
        const name = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}`;
        offenders.push(`${name} "${(el.textContent || '').trim().slice(0, 40)}" (hit: ${hit ? hit.tagName.toLowerCase() : 'nothing'})`);
      }
    }
    return offenders;
  });
}

test('Transpose opens on a surface over the shapes caption, in every theme (M7)', async ({ page, checkA11y }) => {
  await openExampleBook(page);

  for (const theme of THEMES) {
    await readInTheme(page, theme);
    const transpose = page.getByRole('button', { name: 'Transpose', exact: true }).filter({ visible: true }).first();
    await transpose.click();
    const dialog = page.getByRole('dialog', { name: 'Transpose the view' });
    await expect(dialog).toBeVisible();
    const popover = popoverOf(dialog);
    const what = `the Transpose popover in ${theme.name}`;

    await expectOnSurface(popover, what);
    await expect(dialog.getByText('Written key')).toBeVisible();
    const offenders = await throughOrOver(popover);
    expect(offenders, `${what}: something shows through or over it`).toEqual([]);
    await checkA11y();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});

test('the ⋯ menu opens under its trigger, inside the screen, in every theme (M9)', async ({ page, checkA11y }) => {
  await openExampleBook(page);

  for (const theme of THEMES) {
    await readInTheme(page, theme);
    const more = page.locator('.appbar.reading-chrome').getByRole('button', { name: 'More', exact: true });
    await more.click();
    const menu = page.getByRole('menu', { name: 'More' });
    await expect(menu).toBeVisible();
    const popover = popoverOf(menu);
    const what = `the ⋯ menu in ${theme.name}`;

    await expectOnSurface(popover, what);
    await expectInsideViewport(page, popover, what);

    // Bottom end: under the trigger, right edges aligned. RAC places the
    // popover after it measures it, and again when its width settles (the
    // theme's font), so the check retries until the placement has settled.
    const trigger = await more.boundingBox();
    let box;
    await expect(async () => {
      box = await popover.boundingBox();
      expect(Math.abs(box.x + box.width - (trigger.x + trigger.width)), `${what}: its right edge meets More's`).toBeLessThanOrEqual(1);
      expect(box.y, `${what}: it opens below More`).toBeGreaterThanOrEqual(trigger.y + trigger.height - 0.5);
    }).toPass({ timeout: 5000 });

    // Every item whole: visible, inside the menu's surface and the viewport.
    const items = menu.getByRole('menuitem');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const item = items.nth(i);
      await expect(item).toBeVisible();
      const ib = await item.boundingBox();
      const label = `${what}: "${(await item.textContent()).trim()}"`;
      expect(
        ib.x >= box.x - 0.5 && ib.y >= box.y - 0.5 && ib.x + ib.width <= box.x + box.width + 0.5 && ib.y + ib.height <= box.y + box.height + 0.5,
        `${label} lies whole inside the menu`,
      ).toBe(true);
      await expectInsideViewport(page, item, label);
    }

    const offenders = await throughOrOver(popover);
    expect(offenders, `${what}: something shows through or over it`).toEqual([]);
    await checkA11y();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  }
});

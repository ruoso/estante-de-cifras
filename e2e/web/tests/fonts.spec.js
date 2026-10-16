/**
 * e2e-web — the themes' typefaces are self-hosted (shell.fonts). On phone,
 * tablet and computer:
 *
 *  - Each theme's faces load from the origin: all seven families load, every
 *    font response is same-origin, 200 and font/woff2, and no request leaves
 *    the origin (DIRECTION §3.7: installed and cached up front, no external
 *    call; the .tji note's "fonts load from the origin").
 *  - Caderno and Palco render with their faces, chosen through the real Theme
 *    picker (workflow 1 lines 94–117: Caderno's serif titles, Palco's
 *    typeface for distance).
 *  - Offline after a reload, from the precache: with the worker in control and
 *    the network cut, every face still loads, served by the service worker
 *    (the .tji note; DIRECTION §3.7 lines 424–426).
 *
 * axe at WCAG 2.1 AA on every case, in each theme (the standing accessibility
 * rule).
 */
import { test, expect } from '../lib/axe.js';
import { runOffline } from '../lib/offline.js';
import { startApp } from '../lib/journeys.js';
import { chooseTheme } from '../lib/journeys-account.js';
import { baseUrl } from '../lib/env.js';

// The seven families, under the names theme.css's tokens use.
const FAMILIES = [
  'Figtree',
  'JetBrains Mono',
  'Source Sans 3',
  'Fraunces',
  'IBM Plex Mono',
  'Atkinson Hyperlegible',
  'Atkinson Hyperlegible Mono',
];

const origin = new URL(baseUrl).origin;

const isFont = (response) =>
  response.request().resourceType() === 'font' || new URL(response.url()).pathname.endsWith('.woff2');

// Record every request and every font response the page makes, each tagged
// with the main-frame navigation it belongs to, so a case can look only at
// what happened after its last reload.
function collect(page) {
  const seen = { navigation: 0, requests: [], fonts: [] };
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) seen.navigation += 1;
  });
  page.on('request', (request) => seen.requests.push(request.url()));
  page.on('response', (response) => {
    if (isFont(response)) seen.fonts.push({ navigation: seen.navigation, response });
  });
  return seen;
}

// Load every family (document.fonts.load, the CSS Font Loading API) and return
// what each resolved to: the matched faces' statuses.
function loadAll(page) {
  return page.evaluate(
    (families) =>
      Promise.all(
        families.map(async (family) => {
          const faces = await document.fonts.load(`16px "${family}"`);
          return { family, statuses: faces.map((f) => f.status) };
        }),
      ),
    FAMILIES,
  );
}

function expectAllLoaded(loaded) {
  for (const { family, statuses } of loaded) {
    expect(statuses.length, `${family} matched a face`).toBeGreaterThan(0);
    for (const status of statuses) expect(status, family).toBe('loaded');
  }
}

// The first family of an element's computed font-family, unquoted.
async function firstFamily(locator) {
  const value = await locator.evaluate((el) => getComputedStyle(el).fontFamily);
  return value.split(',')[0].trim().replace(/^["']|["']$/g, '');
}

const fontsCheck = (page, font) => page.evaluate((f) => document.fonts.check(f), font);
const fontsReady = (page) => page.evaluate(() => document.fonts.ready.then(() => true));

const root = (page) => page.locator('.est').first();
const heading = (page) => page.getByRole('heading', { level: 1 }).first();

test("each theme's faces load from the origin", async ({ page, checkA11y }) => {
  const seen = collect(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await startApp(page);

  expectAllLoaded(await loadAll(page));

  expect(seen.fonts.length).toBeGreaterThan(0);
  for (const { response } of seen.fonts) {
    expect(new URL(response.url()).origin, response.url()).toBe(origin);
    expect(response.status(), response.url()).toBe(200);
    expect(response.headers()['content-type'], response.url()).toBe('font/woff2');
  }
  // No request leaves the origin — no CDN, no external call (DIRECTION §3.7).
  const external = seen.requests.filter((url) => /^https?:/.test(url) && new URL(url).origin !== origin);
  expect(external).toEqual([]);

  // Estante (the light device's automatic theme) renders in Figtree.
  await expect(root(page)).toHaveClass(/theme-estante/);
  await fontsReady(page);
  expect(await firstFamily(root(page))).toBe('Figtree');
  expect(await fontsCheck(page, '16px "Figtree"')).toBe(true);
  await checkA11y();
});

test('Caderno and Palco render with their faces', async ({ page, checkA11y }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await startApp(page);

  // Caderno: serif titles in Fraunces, body text in Source Sans 3.
  await chooseTheme(page, 'Caderno');
  await expect(heading(page)).toBeVisible();
  await fontsReady(page);
  expect(await firstFamily(heading(page))).toBe('Fraunces');
  expect(await firstFamily(root(page))).toBe('Source Sans 3');
  expect(await fontsCheck(page, '700 24px "Fraunces"')).toBe(true);
  expect(await fontsCheck(page, '16px "Source Sans 3"')).toBe(true);
  await checkA11y();

  // Palco, on a dark device: Atkinson Hyperlegible.
  await page.emulateMedia({ colorScheme: 'dark' });
  await chooseTheme(page, 'Palco');
  await fontsReady(page);
  expect(await firstFamily(root(page))).toBe('Atkinson Hyperlegible');
  expect(await fontsCheck(page, '16px "Atkinson Hyperlegible"')).toBe(true);
  await checkA11y();
});

test('offline after a reload, from the precache', async ({ page, checkA11y }) => {
  const seen = collect(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await startApp(page);
  await chooseTheme(page, 'Caderno');

  await runOffline(page, {
    async whileOffline(offlinePage) {
      await expect(heading(offlinePage)).toBeVisible();
      // The chosen theme comes back with the device's preferences.
      await expect(root(offlinePage)).toHaveClass(/theme-caderno/);
      const reload = seen.navigation;

      // Every face loads with the network cut.
      expectAllLoaded(await loadAll(offlinePage));

      // …served by the service worker from its precache.
      const afterReload = seen.fonts.filter((f) => f.navigation === reload);
      expect(afterReload.length).toBeGreaterThan(0);
      for (const { response } of afterReload) {
        expect(response.status(), response.url()).toBe(200);
        expect(response.fromServiceWorker(), response.url()).toBe(true);
      }

      // The Caderno heading still renders in Fraunces.
      await fontsReady(offlinePage);
      expect(await firstFamily(heading(offlinePage))).toBe('Fraunces');
      expect(await fontsCheck(offlinePage, '700 24px "Fraunces"')).toBe(true);
    },
  });

  // Network restored; axe clean.
  await checkA11y();
});

/**
 * e2e-web — the app is an installable, offline-first PWA whose update is held
 * until the next launch (shell.pwa). On phone, tablet and computer (no
 * project-level testMatch filter, so every viewport runs each case):
 *
 *  - Installable: index.html links a complete web app manifest with real icons,
 *    each served with an image content-type (DIRECTION §3.3 static-PWA
 *    installability, §3.7 "installed and cached up front").
 *  - Offline from the precache: with the network cut and the page reloaded the
 *    shell opens and the icons are still served from cache (DIRECTION §1
 *    offline-first; complements the foundation smoke offline.spec.js, which stays).
 *  - Update held, then taken on the next launch: a byte-changed sw.js installs a
 *    new worker that goes to waiting (skipWaiting: false, app/vite.config.js:52),
 *    the running shell is not disturbed and the quiet notice appears; a fresh
 *    launch then activates the waiting worker (the .tji note, workflow 8
 *    no-interruption).
 *
 * axe at WCAG 2.1 AA on every case (the standing accessibility rule).
 */
import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';

test('installable: a complete manifest with real icons, served as images', async ({
  page,
  checkA11y,
}) => {
  await page.goto('/');

  // index.html links the manifest; fetching it parses to a web app manifest.
  const manifestHref = await page.locator('link[rel="manifest"]').first().getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifestResp = await page.request.get(manifestHref);
  expect(manifestResp.ok()).toBe(true);
  const manifest = await manifestResp.json();

  expect(manifest.name).toBeTruthy();
  expect(manifest.start_url).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toBeTruthy();

  // An icons array including 192, 512 and a maskable icon.
  const hasSize = (sizes) => manifest.icons.some((i) => i.sizes === sizes);
  const purposes = (i) => String(i.purpose ?? 'any').split(/\s+/);
  expect(hasSize('192x192')).toBe(true);
  expect(hasSize('512x512')).toBe(true);
  expect(manifest.icons.some((i) => purposes(i).includes('maskable'))).toBe(true);

  // Each icon URL returns 200 with an image content-type.
  for (const icon of manifest.icons) {
    const resp = await page.request.get(icon.src);
    expect(resp.ok(), icon.src).toBe(true);
    expect(resp.headers()['content-type'], icon.src).toMatch(/^image\//);
  }

  // The apple-touch-icon link resolves.
  const appleHref = await page
    .locator('link[rel="apple-touch-icon"]')
    .first()
    .getAttribute('href');
  expect(appleHref).toBeTruthy();
  const appleResp = await page.request.get(appleHref);
  expect(appleResp.ok()).toBe(true);
  expect(appleResp.headers()['content-type']).toMatch(/^image\//);

  await checkA11y();
});

test('offline: the app and its icons open from the precache', async ({ page, checkA11y }) => {
  await runOffline(page, {
    async whileOffline(offlinePage) {
      // The precached shell survives the offline reload (navigateFallback).
      await expect(offlinePage.getByRole('main')).toBeVisible();
      await expect(
        offlinePage.getByRole('heading', { level: 1, name: 'Search' }),
      ).toBeVisible();

      // The icon is still available with the network cut — fetched from the page
      // so it goes through the service worker's precache (page.request would
      // bypass it). It matches globPatterns **/*.png (app/vite.config.js:42).
      const status = await offlinePage.evaluate(async () => {
        const res = await fetch('/icon-192.png');
        return res.status;
      });
      expect(status).toBe(200);
    },
  });

  // Network restored; axe clean on the shell.
  await checkA11y();
});

test('update: a new version is held, then taken on the next launch', async ({
  page,
  context,
  checkA11y,
}) => {
  // Simulate a new deploy: serve sw.js with an appended version comment so its
  // bytes change when we bump the version (shell.pwa Decision). route.fetch()
  // gets the real worker; fulfill keeps its JS content-type and overrides only
  // the body.
  let swVersion = 0;
  await context.route('**/sw.js', async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    await route.fulfill({ response: res, body: `${body}\n// e2e-sw-version ${swVersion}\n` });
  });

  await page.goto('/');
  await waitForServiceWorker(page); // worker v0 controls the page

  // A marker on the window that survives only if the page is not reloaded.
  await page.evaluate(() => {
    window.__estanteNotReloaded = true;
  });

  // Deploy a byte-changed worker and check for updates.
  swVersion = 1;
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg.update();
  });

  // The new worker installs and goes to waiting — not active — because
  // skipWaiting is false: the update is held.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return Boolean(reg && reg.waiting);
      }),
    )
    .toBe(true);

  // The running session is undisturbed: the controller is unchanged and the
  // shell was not reloaded.
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  expect(await page.evaluate(() => window.__estanteNotReloaded === true)).toBe(true);

  // The quiet, dismissible notice surfaces the waiting update (onNeedRefresh).
  // Matched by its text (the shell may carry other role=status regions).
  await expect(page.getByText('A new version is ready.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload now' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  await checkA11y();

  // A next launch: with every tab using the old worker closed, the waiting
  // worker activates; a fresh page is then controlled by it, and nothing is
  // left waiting (the update is taken).
  await page.close();
  const next = await context.newPage();
  await next.goto('/');
  await waitForServiceWorker(next);

  await expect
    .poll(() =>
      next.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return Boolean(reg && reg.waiting);
      }),
    )
    .toBe(false);
  expect(await next.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await next.close();
});

/**
 * e2e-web — offline mode cuts and restores the network: once the service worker
 * controls the page, a reload with the network cut still renders the app shell
 * (the PWA precache + navigateFallback), then the page works online again.
 *
 * Pins the offline-first promise (DIRECTION §1 lines 29–31, §3.7 lines
 * 405/424–426; app/vite.config.js lines 42–52) and the .tji note's "offline
 * mode cuts and restores the network" — the primitive workflows 8 and 9 depend
 * on. All projects are Chromium, so context.setOffline runs on each viewport.
 */
import { test, expect } from '@playwright/test';

import { runOffline, waitForServiceWorker } from '../lib/offline.js';

test('the app shell still renders with the network cut, then works online again', async ({
  page,
}) => {
  await runOffline(page, {
    async whileOffline(offlinePage) {
      // The precached shell survives the offline reload (navigateFallback): the
      // main landmark and the default destination's level-1 heading. The
      // placeholder "Estante de Cifras" heading gave way to the navigation shell
      // (shell.layout), which opens on Search on every viewport.
      await expect(offlinePage.getByRole('main')).toBeVisible();
      await expect(
        offlinePage.getByRole('heading', { level: 1, name: 'Search' }),
      ).toBeVisible();
    },
  });

  // Network restored: a fresh load succeeds and the worker still controls it.
  await page.goto('/');
  await waitForServiceWorker(page);
  await expect(page.getByRole('main')).toBeVisible();
});

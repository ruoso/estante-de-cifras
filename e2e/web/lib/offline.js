// Offline-first is a standing rule (DIRECTION §1 lines 29–31): the app works in
// a lesson with no signal, and sync is something that happens when there is a
// network, never something the app waits for. Once loaded the app works with no
// network (§3.7 lines 405, 424–426). The app is precache-first — VitePWA
// precaches the shell with navigateFallback and clientsClaim
// (app/vite.config.js lines 42–51) — so a reload survives offline only once the
// service worker has installed and taken control of the page. This helper waits
// for that before cutting the network, so the test asserts the real
// offline-first behaviour rather than racing the worker's first install (the
// e2e_web refinement, Decisions). context.setOffline is Chromium network
// emulation — why every project is Chromium.

// Wait until a service worker controls the page. clientsClaim makes the active
// worker claim the first visit, which sets navigator.serviceWorker.controller;
// waiting on it (not just registration) is the "the worker controls the page"
// signal the offline reload depends on.
export async function waitForServiceWorker(page, { timeout = 10000 } = {}) {
  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    null,
    { timeout },
  );
}

// Load a page online, wait for the worker to control it, cut the network,
// reload, run the caller's offline assertions, then restore the network:
// go online → wait for the worker → setOffline(true) → reload → (verify) →
// setOffline(false). The restore runs even if an assertion throws, so one
// failing offline test never leaves the context offline for the next.
export async function runOffline(page, { path = '/', whileOffline } = {}) {
  const context = page.context();
  await page.goto(path);
  await waitForServiceWorker(page);
  await context.setOffline(true);
  try {
    await page.reload();
    if (whileOffline) {
      await whileOffline(page);
    }
  } finally {
    await context.setOffline(false);
  }
}

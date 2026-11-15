// When the app looks for a new version of itself (shell.pwa). A browser checks
// a service worker for an update only when a page is loaded, and an installed
// app brought back from the background is not loaded again: left running, it
// would never learn of a deploy. So the app also asks — when it comes back to
// the foreground, when the network comes back, and every hour while open.
//
// Asking only checks. A new version still installs and waits, and the update
// notice still waits for the person (update-state.js; skipWaiting stays off),
// so nothing here reloads the page or interrupts anyone.
//
// Pure wiring over what it is handed (the registration, the window, the
// document), so it is tested without a real service worker; the entry
// (main.jsx) starts it once the worker is registered.

export const HOUR_MS = 60 * 60 * 1000;

/**
 * Start checking for updates. Returns a function that stops.
 *
 * @param {{
 *   registration: { update: () => Promise<unknown> },
 *   window: Window,
 *   document: Document,
 *   intervalMs?: number,
 * }} options
 * @returns {() => void}
 */
export function startUpdateChecks({ registration, window: win, document: doc, intervalMs = HOUR_MS }) {
  if (!registration || typeof registration.update !== 'function') return () => {};

  const check = () => {
    // Offline the check can only fail; the `online` event asks again.
    if (win.navigator && win.navigator.onLine === false) return;
    // A failed check (a network blip, a server mid-deploy) is not the person's
    // problem: the next trigger asks again.
    Promise.resolve()
      .then(() => registration.update())
      .catch(() => {});
  };
  const onVisibility = () => {
    if (doc.visibilityState === 'visible') check();
  };

  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('online', check);
  const timer = win.setInterval(check, intervalMs);

  return () => {
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('online', check);
    win.clearInterval(timer);
  };
}

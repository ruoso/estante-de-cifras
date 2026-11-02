// workbox.js — the service worker's precache and routing options (VitePWA
// generateSW), in a pure module like manifest.js, so they are unit-tested
// without pulling the plugin graph into the test environment.

export const workbox = {
  globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
  // The reMarkable reader's payload (docs/remarkable-reader.md §8) is built into
  // dist/device/ beside the app, but it is the device's, not the browser's: a
  // browser never precaches it (reader.bundle).
  globIgnores: ['device/**'],
  // Any navigation falls back to the app shell, so a deep link works
  // offline as well as online.
  navigateFallback: '/index.html',
  cleanupOutdatedCaches: true,
  // Take control as soon as the worker activates, so the first visit is
  // offline-capable. skipWaiting stays off: an update must still ask
  // before replacing what someone is using (standing offline rule — no
  // user action is lost).
  clientsClaim: true,
  skipWaiting: false,
};

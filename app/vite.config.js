import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { manifest } from './src/pwa/manifest.js';

// The service serves the app on one origin in production (DIRECTION §3.6); in
// development Vite proxies the API to the service so dev is one origin too
// (§3.6 line 377). The target is read from an env var with a localhost
// default; it proxies to nothing until foundation.service_skeleton /
// foundation.compose exist, which is harmless.
const apiTarget = process.env.ESTANTE_API_ORIGIN || 'http://localhost:8080';

export default defineConfig({
  // The app is served at the root origin by the service (DIRECTION §3.6),
  // not a project subpath.
  base: '/',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  plugins: [
    react({
      // The React Compiler runs as a Babel plugin targeting React 19 — the
      // compiler's supported entry point, which keeps re-rendering to what
      // changed without hand-written memoization (DIRECTION §3.7). Its lint
      // rules ship in eslint-plugin-react-hooks, so violations surface in
      // `npm run lint`.
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
    VitePWA({
      // Everything the shell needs is precached, so once loaded the app works
      // with no network (DIRECTION §3.7, "installed and cached up front").
      registerType: 'prompt',
      injectRegister: null,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
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
      },
      // The manifest — fields and icons — lives in a pure module so it is
      // unit-tested without pulling the plugin graph into the test environment
      // (shell.pwa Decision). VitePWA emits it as manifest.webmanifest and links
      // it from the built index.html.
      manifest,
      devOptions: { enabled: false },
    }),
  ],
  test: {
    // The level this set-up exists to prove is component rendering, which
    // needs a DOM; a jsdom default plus a setup file means every later
    // component test gets the right environment with no per-file ceremony,
    // and pure modules run fine in jsdom too.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});

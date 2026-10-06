// The web app manifest, as a pure module (shell.pwa Decision: a framework-free,
// unit-testable seam for the icons/fields contract). vite.config.js imports
// `manifest` into the VitePWA plugin, which emits manifest.webmanifest and links
// it from the built index.html; this module knows nothing of Vite or React
// (DIRECTION §3.7 "framework-free below the view").
//
// A complete manifest is what makes the browser offer to install the app and
// show a home-screen icon and name (DIRECTION §3.3 static-PWA installability,
// §3.7 "installed and cached up front"). Colours are the visual language's
// defaults (docs/mockups/theme.css: --bg #F3F4F1, --accent #1F4F8F). start_url /
// scope / id stay '/' — the one origin the service serves (DIRECTION §3.3).

// The icons, served at the dist root by fixed name (app/public/, served by the
// Go app handler). A 192 and a 512 `any` icon for the browser's install UI and
// home screen, and a 512 `maskable` icon so a platform that masks the icon to
// its own shape (Android adaptive icons) keeps the artwork inside the safe zone
// rather than clipping it.
export const ICONS = [
  { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

// The iOS home-screen icon, linked from index.html (iOS reads a dedicated
// <link rel="apple-touch-icon"> rather than the manifest icons).
export const APPLE_TOUCH_ICON = '/apple-touch-icon-180.png';

export const manifest = {
  name: 'Estante de Cifras',
  short_name: 'Estante',
  description: 'Your shelf of chord charts. Works offline.',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  // The visual language's default direction (docs/mockups/theme.css).
  background_color: '#F3F4F1',
  theme_color: '#1F4F8F',
  categories: ['music'],
  icons: ICONS,
};

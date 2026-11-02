import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// The reMarkable reader's bundle (docs/remarkable-reader.md §4; reader.bundle):
// the web app's own music path, from src/device/entry.js, as one ES2017 IIFE a
// Go host evaluates in goja. Vite 8 bundles with rolldown, so this is §4's
// "rolldown to ES2017". No React, no PWA: the entry reaches neither.
//
// Built by src/device/build.js through Vite's build API with `write: false`, so
// the content-hashed name and the manifest come from the same bytes.

const root = fileURLToPath(new URL('.', import.meta.url));
const entry = fileURLToPath(new URL('./src/device/entry.js', import.meta.url));
const emptyLocale = fileURLToPath(new URL('./src/device/empty-locale.js', import.meta.url));

// One locale, not four (§4): English is the source and DEFAULT_LOCALE, and the
// other three resolve to an empty table, so `t` falls back to English as it
// does for any key a language lacks. i18n/index.js keeps one shape for both
// builds.
const DROPPED_LOCALE = /(?:^|\/)locales\/(?:pt-BR|es-419|it)\.js$/;

function oneLocale() {
  return {
    name: 'estante-device-one-locale',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer && /[\\/]src[\\/]i18n[\\/]/.test(importer) && DROPPED_LOCALE.test(source)) return emptyLocale;
      return null;
    },
  };
}

export default defineConfig({
  root,
  publicDir: false,
  logLevel: 'warn',
  plugins: [oneLocale()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    target: 'es2017',
    outDir: 'dist/device',
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry,
      formats: ['iife'],
      name: 'estanteBundle',
      fileName: () => 'bundle.js',
    },
    // Everything is inlined: an IIFE has no dynamic import and no external.
  },
});

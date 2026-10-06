// unit — the pure manifest module (shell.pwa Decision: a framework-free,
// unit-testable seam for the icons/fields contract). Pins DIRECTION §3.3
// static-PWA installability and §3.7 "installed and cached up front", and the
// mockup colours (docs/mockups/theme.css: --bg #F3F4F1, --accent #1F4F8F). The
// browser needs these fields and icons to offer to install the app and show a
// home-screen icon and name.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { manifest, ICONS, APPLE_TOUCH_ICON } from './manifest.js';

// The app package is always run from its own directory (scripts/gate runs
// `npm test` in app/; Vitest's root is this cwd), so the bundle's public dir and
// index.html resolve from process.cwd(). A root-relative src ('/icon-192.png')
// maps to app/public/icon-192.png.
const publicPath = (src) => path.join(process.cwd(), 'public', src.replace(/^\//, ''));
const indexHtml = () => readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');

describe('manifest (fields)', () => {
  it('carries the installable identity at the one origin', () => {
    expect(manifest.name).toBe('Estante de Cifras');
    expect(manifest.short_name).toBeTruthy();
    // One origin (DIRECTION §3.3): id, start_url and scope are all '/'.
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('uses the visual language colours (docs/mockups/theme.css)', () => {
    expect(manifest.background_color).toBe('#F3F4F1'); // --bg
    expect(manifest.theme_color).toBe('#1F4F8F'); // --accent
  });
});

describe('manifest (icons)', () => {
  it('includes a 192 and a 512 "any" icon and a 512 "maskable" icon', () => {
    const has = (sizes, purpose) =>
      manifest.icons.some(
        (i) => i.sizes === sizes && i.purpose === purpose && i.type === 'image/png',
      );
    expect(has('192x192', 'any')).toBe(true);
    expect(has('512x512', 'any')).toBe(true);
    expect(has('512x512', 'maskable')).toBe(true);
  });

  it('every icon src is root-relative and exists on disk under app/public/', () => {
    for (const icon of ICONS) {
      expect(icon.src.startsWith('/')).toBe(true);
      expect(existsSync(publicPath(icon.src)), icon.src).toBe(true);
    }
  });

  it('the apple-touch icon exists on disk under app/public/', () => {
    expect(APPLE_TOUCH_ICON.startsWith('/')).toBe(true);
    expect(existsSync(publicPath(APPLE_TOUCH_ICON))).toBe(true);
  });
});

describe('index.html', () => {
  it('links the manifest, an icon and the apple-touch icon, and keeps theme-color', () => {
    const html = indexHtml();
    expect(html).toMatch(/<link[^>]+rel="manifest"[^>]+href="\/manifest\.webmanifest"/);
    expect(html).toMatch(/<link[^>]+rel="icon"/);
    expect(html).toMatch(new RegExp(`<link[^>]+rel="apple-touch-icon"[^>]+href="${APPLE_TOUCH_ICON}"`));
    expect(html).toMatch(/<meta[^>]+name="theme-color"[^>]+content="#1F4F8F"/);
  });

  it('references icon files that exist on disk', () => {
    const html = indexHtml();
    for (const href of [...html.matchAll(/href="(\/[^"]+\.png)"/g)].map((m) => m[1])) {
      expect(existsSync(publicPath(href)), href).toBe(true);
    }
  });
});

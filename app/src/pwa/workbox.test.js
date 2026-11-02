// @vitest-environment node
// unit — the service worker's precache options (reader.bundle): the reMarkable
// reader's payload, built into dist/device/ beside the app
// (docs/remarkable-reader.md §8), is never precached by a browser, while the
// app's own assets still are (DIRECTION §3.7, "installed and cached up front").

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { workbox } from './workbox.js';

const ignored = (file) => workbox.globIgnores.some((g) => path.matchesGlob(file, g));
const precached = (file) => workbox.globPatterns.some((g) => path.matchesGlob(file, g)) && !ignored(file);

describe('workbox options', () => {
  it('ignores the device payload', () => {
    expect(workbox.globIgnores).toContain('device/**');
  });

  it('leaves the device bundle and manifest out of the precache', () => {
    expect(ignored('device/bundle.0123abcd.js')).toBe(true);
    expect(ignored('device/manifest.json')).toBe(true);
    expect(precached('device/bundle.0123abcd.js')).toBe(false);
  });

  it('still precaches the app shell', () => {
    expect(ignored('assets/index-abc.js')).toBe(false);
    expect(precached('assets/index-abc.js')).toBe(true);
    expect(workbox.navigateFallback).toBe('/index.html');
  });
});

// behavior — the theme resolves each family to its @font-face (shell.fonts, the
// .tji note's behavior clause). theme.css is read from disk and parsed by the
// DOM's own CSSOM (a <style> in jsdom), the way a browser would read it: every
// --font-* token of every theme names a face the stylesheet declares, with its
// system stack kept as the fallback; every face swaps, is a woff2 from the
// committed fonts/ tree (no CDN, DIRECTION §3.7), and carries its subset's
// unicode-range; and every family ships with its license (the refinement's
// licensing gate, recorded in fonts/README.md).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

// The app package runs from its own directory (scripts/gate runs `npm test` in
// app/), so the theme resolves from process.cwd(), as in pwa/manifest.test.js.
const themeDir = path.join(process.cwd(), 'src', 'theme');
const fontsDir = path.join(themeDir, 'fonts');

// The four theme blocks that set the --font-* tokens (theme.css; the base
// `.est` and each direction).
const THEME_SELECTORS = ['.est', '.est.theme-estante', '.est.theme-caderno', '.est.theme-palco'];
const FONT_TOKENS = ['--font-ui', '--font-display', '--font-chart', '--font-code'];
const GENERIC_FALLBACKS = ['sans-serif', 'serif', 'monospace'];

const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');
const families = (value) => value.split(',').map(unquote);

let style;
let sheet;
let source;

beforeAll(() => {
  source = readFileSync(path.join(themeDir, 'theme.css'), 'utf-8');
  style = document.createElement('style');
  style.textContent = source;
  document.head.appendChild(style);
  sheet = style.sheet;
});

afterAll(() => {
  style.remove();
});

const fontFaces = () =>
  Array.from(sheet.cssRules).filter((r) => r instanceof CSSFontFaceRule);

// Each @font-face's descriptors, by name. jsdom's CSSOM keeps a CSSFontFaceRule
// per face but its declaration drops the descriptors it does not know as
// properties (src, font-display, unicode-range, a weight range), so they are
// read from the rule's own block in the source, in the CSSOM's order (the test
// below pins that the two agree).
const faceDescriptors = () =>
  Array.from(source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@font-face\s*\{([^}]*)\}/g)).map((m) => {
    const out = {};
    for (const decl of m[1].split(/;(?![^(]*\))/)) {
      const at = decl.indexOf(':');
      if (at > 0) out[decl.slice(0, at).trim()] = decl.slice(at + 1).trim();
    }
    return out;
  });

// The rule whose selector list includes `selector` exactly (Estante's block is
// `.est.theme-estante, .est.theme-current`).
const themeRule = (selector) =>
  Array.from(sheet.cssRules).find(
    (r) =>
      r instanceof CSSStyleRule &&
      r.selectorText.split(',').map((s) => s.trim()).includes(selector) &&
      r.style.getPropertyValue('--font-ui'),
  );

// Each url(...) in a src descriptor with the format() that follows it.
const sources = (src) =>
  Array.from(src.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)\s*(?:format\(\s*['"]?([^'")]+)['"]?\s*\))?/g)).map(
    (m) => ({ url: m[2], format: m[3] }),
  );

// fonts/README.md's table: directory → license column.
function readmeLicenses() {
  const readme = readFileSync(path.join(fontsDir, 'README.md'), 'utf-8');
  const out = {};
  for (const line of readme.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    const dir = cells[1]?.match(/^`([a-z0-9-]+)\/`$/);
    if (dir) out[dir[1]] = cells[5];
  }
  return out;
}

describe('theme.css @font-face (shell.fonts)', () => {
  it('declares font faces', () => {
    expect(fontFaces().length).toBeGreaterThan(0);
  });

  it.each(THEME_SELECTORS)(
    '%s: every --font-* token names a declared face first and keeps its system fallback',
    (selector) => {
      const rule = themeRule(selector);
      expect(rule, `no rule sets the font tokens for ${selector}`).toBeTruthy();
      const declared = new Set(fontFaces().map((f) => unquote(f.style.getPropertyValue('font-family'))));
      for (const token of FONT_TOKENS) {
        const stack = families(rule.style.getPropertyValue(token));
        expect(stack.length, `${selector} ${token}`).toBeGreaterThan(1);
        expect(declared, `${selector} ${token} → ${stack[0]}`).toContain(stack[0]);
        expect(GENERIC_FALLBACKS, `${selector} ${token} ends in a generic family`).toContain(
          stack[stack.length - 1],
        );
      }
    },
  );

  it('every face swaps, is a committed woff2 from fonts/, and has a unicode-range', () => {
    const faces = faceDescriptors();
    expect(faces.map((f) => unquote(f['font-family']))).toEqual(
      fontFaces().map((f) => unquote(f.style.getPropertyValue('font-family'))),
    );
    for (const face of faces) {
      const family = face['font-family'];
      expect(face['font-display'], family).toBe('swap');
      expect(face['unicode-range'], family).toMatch(/^U\+[0-9A-F]/i);

      const srcs = sources(face.src ?? '');
      expect(srcs.length, family).toBeGreaterThan(0);
      expect(srcs.some((s) => s.format === 'woff2'), `${family} has a format('woff2') src`).toBe(true);
      for (const { url } of srcs) {
        // No CDN: a relative url Vite fingerprints into assets/ (DIRECTION §3.7).
        expect(url, family).toMatch(/^\.\.?\//);
        expect(url, family).not.toMatch(/^[a-z][a-z0-9+.-]*:|^\/\//i);
        const file = path.resolve(themeDir, url);
        expect(file.startsWith(fontsDir + path.sep), `${url} is under fonts/`).toBe(true);
        expect(existsSync(file), `${url} exists`).toBe(true);
        // The woff2 signature, so a committed file is a real woff2.
        expect(readFileSync(file).subarray(0, 4).toString('latin1'), url).toBe('wOF2');
      }
    }
  });

  it('every font directory holds its license; an OFL family carries the OFL 1.1 text', () => {
    const licenses = readmeLicenses();
    const dirs = readdirSync(fontsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(dirs.length).toBe(7);
    for (const dir of dirs) {
      const license = ['LICENSE', 'OFL.txt']
        .map((name) => path.join(fontsDir, dir, name))
        .find((p) => existsSync(p));
      expect(license, `${dir} has a license file`).toBeTruthy();
      expect(licenses[dir], `${dir} is recorded in fonts/README.md`).toBeTruthy();
      if (/OFL/.test(licenses[dir])) {
        expect(readFileSync(license, 'utf-8'), dir).toContain('SIL OPEN FONT LICENSE Version 1.1');
      }
    }
  });
});

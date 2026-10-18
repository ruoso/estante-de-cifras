// unit — every colour the app paints comes from the theme (shell.palco_contrast).
// In Palco the file view rows, its history cards, the Add to setlist list and
// the setlist point-at results were drawn light-on-light: "a surface colour
// outside the theme tokens" (the .tji note). This reads every app stylesheet
// and component source and pins:
//   (a) every `var(--name)` used is defined by theme.css, or locally in the
//       same file (the `--ink-soft` case: a token no theme defines);
//   (b) no stylesheet outside theme.css declares a colour literal (hex,
//       rgb()/hsl() other than a box-shadow's black-alpha rgba(0, 0, 0, …),
//       or a named colour on a colour property);
//   (c) no JSX carries an inline `style` colour (the New setlist row's amber);
//   (d) controls.css declares the colour scheme per theme (Palco dark, Estante
//       and Caderno light), so native controls follow the theme.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Every app stylesheet and component source under src/, keyed by its path
// relative to src/. Read from disk, as fonts.behavior.test.js reads theme.css:
// Vitest hands a `.css` import (`?raw` included) back as an empty string.
const srcDir = path.join(process.cwd(), 'src');
const sources = Object.fromEntries(
  readdirSync(srcDir, { recursive: true })
    .filter((rel) => /\.(css|jsx)$/.test(rel))
    .map((rel) => [rel.split(path.sep).join('/'), readFileSync(path.join(srcDir, rel), 'utf-8')]),
);

const isTest = (p) => /\.test\.jsx$/.test(p);
const files = Object.entries(sources).filter(([p]) => !isTest(p));
const stylesheets = files.filter(([p]) => p.endsWith('.css'));
const components = files.filter(([p]) => p.endsWith('.jsx'));

const THEME = 'theme/theme.css';
const CONTROLS = 'theme/controls.css';
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Custom properties a source defines: `--name:` in CSS, `'--name':` in a JSX
// style object.
function definedIn(text) {
  const names = new Set();
  for (const m of text.matchAll(/['"]?(--[a-z0-9-]+)['"]?\s*:/gi)) names.add(m[1]);
  return names;
}

const themeTokens = definedIn(stripComments(sources[THEME]));

const NAMED_COLOURS =
  'white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|fuchsia|brown|gold|beige|ivory|tan|salmon|crimson|coral|violet|indigo|khaki|lavender|magenta|cyan';

function colourLiterals(css) {
  const found = [];
  for (const decl of stripComments(css).split(/[;{}]/)) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const value = decl.slice(colon + 1).trim();
    if (!/^[a-z-]+$/.test(prop) || prop.startsWith('--')) continue;
    if (/#[0-9a-f]{3,8}\b/i.test(value)) found.push(`${prop}: ${value}`);
    for (const fn of value.matchAll(/\b(rgba?|hsla?)\(([^)]*)\)/gi)) {
      const blackAlpha = /^rgba$/i.test(fn[1]) && /^0\s*,\s*0\s*,\s*0\s*,/.test(fn[2].trim());
      if (!(blackAlpha && prop === 'box-shadow')) found.push(`${prop}: ${value}`);
    }
    if (
      /^(color|background(-color)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|fill|stroke)$/.test(prop) &&
      new RegExp(`(^|[\\s,(])(${NAMED_COLOURS})($|[\\s,)])`, 'i').test(value)
    ) {
      found.push(`${prop}: ${value}`);
    }
  }
  return found;
}

describe('theme tokens (shell.palco_contrast)', () => {
  it('reads the app stylesheets and components', () => {
    expect(sources[THEME]).toBeTypeOf('string');
    expect(sources[CONTROLS]).toBeTypeOf('string');
    expect(stylesheets.length).toBeGreaterThan(10);
    expect(components.length).toBeGreaterThan(10);
    expect(themeTokens.has('--accent-soft')).toBe(true);
  });

  it('(a) every var(--name) used is defined by theme.css or the same file', () => {
    const undefinedUses = [];
    for (const [path, text] of files) {
      const body = stripComments(text);
      const local = definedIn(body);
      for (const m of body.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
        if (!themeTokens.has(m[1]) && !local.has(m[1])) undefinedUses.push(`${path}: ${m[1]}`);
      }
    }
    expect(undefinedUses).toEqual([]);
  });

  it('(b) no stylesheet outside theme.css declares a colour literal', () => {
    const literals = [];
    for (const [path, text] of stylesheets) {
      if (path === THEME) continue;
      for (const l of colourLiterals(text)) literals.push(`${path}: ${l}`);
    }
    expect(literals).toEqual([]);
  });

  it('(b) the literal check sees a hex, an rgb() and a named colour', () => {
    expect(colourLiterals('.x { background: #fff; }')).toHaveLength(1);
    expect(colourLiterals('.x { color: rgb(10, 10, 10); }')).toHaveLength(1);
    expect(colourLiterals('.x { border: 1px solid white; }')).toHaveLength(1);
    expect(colourLiterals('.x { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }')).toEqual([]);
    expect(colourLiterals('.x { color: var(--ink); background: transparent; }')).toEqual([]);
  });

  it('(c) no JSX carries an inline style colour', () => {
    const inline = [];
    const colourKey = /\b(color|background\w*|border\w*Color|outlineColor|fill|stroke)\s*:/;
    for (const [path, text] of components) {
      for (const m of stripComments(text).matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        if (colourKey.test(m[1])) inline.push(`${path}: style={{${m[1].trim()}}}`);
      }
    }
    expect(inline).toEqual([]);
  });

  it('(d) controls.css sets color-scheme dark on Palco and light on Estante and Caderno', () => {
    const controls = stripComments(sources[CONTROLS]);
    const schemeOf = (theme) => {
      for (const m of controls.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const selectors = m[1].split(',').map((s) => s.trim());
        const scheme = m[2].match(/color-scheme:\s*([a-z]+)/);
        if (scheme && selectors.includes(`.est.theme-${theme}`)) return scheme[1];
      }
      return null;
    };
    expect(schemeOf('palco')).toBe('dark');
    expect(schemeOf('estante')).toBe('light');
    expect(schemeOf('caderno')).toBe('light');
  });
});

import { test, expect } from '../lib/axe.js';

// e2e-web (shell.a11y_chart) — the chart's screen-reader reading in a real
// browser, on the phone, tablet and computer projects (the config runs every
// spec on all three). It drives the hash-gated dev gallery (`#dev/chart`), which
// needs no account or book, and reads the charts the way a screen reader walks
// the tree: skipping `aria-hidden` glyphs, collecting the visually-hidden spoken
// names and the real lyrics.
//
// It asserts the §2 sung-line order, the §4 split word (no hyphen or padding),
// the §5 measure list (an ordered list of measures, chords by name, the `|`
// never in the tree), and — on the interactive arrange chart — the §3 spoken
// chord name a keyboard user reaches. axe (WCAG 2.1 AA; color-contrast runs
// here, the check jsdom cannot) is clean in Estante light and Palco dark.
// Pins the .tji note ("a chart read through the accessibility tree and by
// keyboard on the three viewports") and docs/screen-reader.md §2/§4/§5/§8.

const THEMES = [
  { name: 'Estante (light)', scheme: 'light', cls: /theme-estante/ },
  { name: 'Palco (dark)', scheme: 'dark', cls: /theme-palco/ },
];

// The spoken tokens a screen reader walks, in document order: every text node
// not inside an `aria-hidden` subtree, trimmed, empties dropped. Computed in the
// real browser so the CSS `.visually-hidden` layer and the hidden glyphs are
// exactly what a reader would get.
function a11yTokens(locator) {
  return locator.evaluate((root) => {
    const out = [];
    (function walk(node) {
      if (node.nodeType === 3) {
        const text = node.textContent.trim();
        if (text) out.push(text);
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.getAttribute('aria-hidden') === 'true') return;
      node.childNodes.forEach(walk);
    })(root);
    return out;
  });
}

test('the chart reads in the decided order, by spoken name, on every theme', async ({ page, checkA11y }) => {
  for (const theme of THEMES) {
    await page.emulateMedia({ colorScheme: theme.scheme });
    await page.goto('/#dev/chart');
    await expect(page.locator('.est')).toHaveClass(theme.cls);

    const plain = page.getByRole('group', { name: 'A Gallery Tune — Plain reading chart' });
    await expect(plain).toBeVisible();

    // §2 — a sung line reads chord-then-word-run in source order, the chord by
    // name ("E minor", never "em"). §4 — the split word reads its pieces with no
    // hyphen or padding spoken.
    const sung = plain.locator('.sung');
    expect(await a11yTokens(sung.nth(0))).toEqual(['Te', 'G', 'sting']);
    expect(await a11yTokens(sung.nth(1))).toEqual(['G', 'cats', 'D', 'and', 'E minor', 'dogs']);

    // §5 — the chart line is an ordered list of measures, each chord by name, the
    // `|` never spoken.
    await expect(plain.getByRole('list')).toBeVisible();
    await expect(plain.getByRole('listitem')).toHaveCount(4);
    const barline = await a11yTokens(plain.locator('.barline'));
    expect(barline).toEqual(['C', 'G', 'A minor', 'F']);
    expect(barline.join(' ')).not.toContain('|');
    // A run/intro line is a plain sequence, not a list.
    expect(await a11yTokens(plain.locator('.runline'))).toEqual(['A minor', 'E', 'F sharp minor']);

    await checkA11y();
  }
});

test('an arrange chord is a keyboard-reachable button named by its spoken chord name', async ({ page }) => {
  await page.goto('/#dev/chart');
  const arrange = page.getByRole('group', { name: 'A Gallery Tune — Arrange mode' });
  await expect(arrange).toBeVisible();

  // Every voiced chord is a button whose accessible name is the §3 spoken name,
  // so a keyboard user hears "E minor", not the glyph spelled out.
  const eMinor = arrange.getByRole('button', { name: 'E minor' });
  await expect(eMinor).toBeVisible();
  await expect(arrange.getByRole('button', { name: 'F sharp minor' })).toBeVisible();

  // It is reachable and operable from the keyboard.
  await eMinor.focus();
  await expect(eMinor).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(eMinor).not.toBeFocused();
});

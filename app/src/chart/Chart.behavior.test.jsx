// behavior (shell.chart) — the chart rendered with its real collaborators: a
// song written for the purpose, parsed through the real `cifra-md` reader and
// drawn under a `theme-current` root, so the chart is exercised against the
// reader, the adopted CSS and i18n together. Parsing here is a test convenience
// that pins the real reader→chart contract — production never parses in the
// view (the Worker owns parsing, DIRECTION §3.7 lines 407-417).
//
// Pins: "corpus songs rendered with Testing Library, defaults, conflicts and
// arrange-mode marking, axe" (shell.chart .tji note); mockups/README.md line 24
// and the marking classes (theme.css lines 227-229); Workflows 2 (mark-def), 5
// (mark-tap) and 9 (mark-conf); DIRECTION §3.7 lines 415-417. Axe here pins
// role/name/structure — the rules that run under jsdom; contrast at AA is a
// jsdom no-op, pinned at e2e-web.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { parse } from 'cifra-md';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import Chart from './Chart.jsx';

// A song written for the purpose (never anyone's copyrighted words): a verse of
// two sung lines — the first splits "Testing" so the chord opens room inside the
// word, the second sets each chord over a word start — a stanza break, then a
// chord section of a bar-lined line and a run.
const SONG = `# A Gallery Tune

## Verse
\`\`\`
  G
Testing

G    D   Em
cats and dogs

humming with no chords
\`\`\`

## Chart
\`\`\`
C | G | Am | F
Am E F#m
\`\`\`
`;

// The sung "Testing" line is section 0 / part 0 / line 0; the sung "cats" line
// is line 2 (a break sits between); the bar-lined chart line is section 1 /
// part 0 / line 0.
const addr = (a) => `${a.section}:${a.part}:${a.line}`;
const MARKS = { '0:0:0': 'def', '0:0:2': 'tap', '1:0:0': 'conf' };
const markOf = (a) => MARKS[addr(a)] ?? null;

function renderChart(ui) {
  return render(<div className="est theme-current">{ui}</div>);
}

describe('Chart (behavior)', () => {
  beforeEach(() => setLocale('en'));

  it('is a labelled group drawing the song in the chart markup', () => {
    renderChart(<Chart model={parse(SONG)} />);
    const chart = screen.getByRole('group', { name: 'Chart' });
    expect(chart).toHaveClass('chart');
    // Section names head their sections.
    expect(within(chart).getByText('Verse')).toHaveClass('sec-name');
    expect(within(chart).getByText('Chart')).toHaveClass('sec-name');
  });

  it('draws sung lines as chord-over-word segments', () => {
    const { container } = renderChart(<Chart model={parse(SONG)} />);
    const sung = container.querySelectorAll('.chart .sung');
    expect(sung.length).toBe(2);
    // The first sung line: a lead segment (empty chord) then G over "sting".
    const chords = Array.from(sung[0].querySelectorAll('.s .c')).map((el) => el.textContent);
    expect(chords).toContain('G');
    // The `.fill` span is empty, so a segment's `.w` text is just its words.
    const words = Array.from(sung[0].querySelectorAll('.s .w')).map((el) => el.textContent);
    expect(words.join('')).toContain('sting');
  });

  it('draws the centred hyphen where a chord splits a word and not at a word boundary', () => {
    const { container } = renderChart(<Chart model={parse(SONG)} />);
    const [split, clean] = container.querySelectorAll('.chart .sung');
    // "Testing" split by G → exactly one fill; "cats and dogs" on word starts → none.
    expect(split.querySelectorAll('.w .fill').length).toBe(1);
    expect(clean.querySelectorAll('.w .fill').length).toBe(0);
  });

  it('draws a chord-only line as measures between bar rules', () => {
    const { container } = renderChart(<Chart model={parse(SONG)} />);
    const barline = container.querySelector('.chart .barline');
    // Each measure is a listitem; the visible glyph is the `.g` span (the chord
    // name sits beside it in a visually-hidden node for a screen reader,
    // shell.a11y_chart), so the drawn text reads from the glyph layer.
    const cells = Array.from(barline.querySelectorAll('.m')).map((el) =>
      Array.from(el.querySelectorAll('.g')).map((g) => g.textContent).join(' '),
    );
    expect(cells).toEqual(['C', 'G', 'Am', 'F']);
    // and a run line for the chords with no bars.
    const run = container.querySelector('.chart .runline');
    expect(Array.from(run.querySelectorAll('.g')).map((g) => g.textContent).join(' ')).toBe('Am E F#m');
  });

  it('paints the marking class markOf returns on each line (W02 def, W05 tap, W09 conf)', () => {
    const { container } = renderChart(<Chart model={parse(SONG)} markOf={markOf} />);
    const sung = container.querySelectorAll('.chart .sung');
    expect(sung[0]).toHaveClass('mark-def'); // Testing — defaults (W02)
    expect(sung[1]).toHaveClass('mark-tap'); // cats and dogs — arrange (W05)
    expect(container.querySelector('.chart .barline')).toHaveClass('mark-conf'); // conflict (W09)
    // Without a mark, no marking class.
    expect(container.querySelector('.chart .runline').className).toBe('runline');
  });

  it('sets --chart-size on the host when a size is given (GUIDE line 97)', () => {
    const { container } = renderChart(<Chart model={parse(SONG)} size={20} />);
    expect(container.querySelector('.chart').style.getPropertyValue('--chart-size')).toBe('20px');
  });

  it('is axe-clean at WCAG 2.1 AA, plain and marked', async () => {
    for (const mark of [undefined, markOf]) {
      const { container, unmount } = renderChart(<Chart model={parse(SONG)} markOf={mark} />);
      expect(await checkWcag21aa(container)).toHaveNoViolations();
      unmount();
    }
  });
});

// behavior (shell.a11y_chart) — the chart's screen-reader reading, rendered
// with its real collaborators (the real `cifra-md` reader, the pure
// chord-speech and reading modules, the adopted CSS and i18n) under a
// `theme-current` root. Songs written for the purpose, parsed through the real
// reader. It reads the accessibility tree the way a screen reader walks it —
// skipping `aria-hidden` glyphs, collecting the visually-hidden spoken names and
// the real lyrics — and asserts the §2/§4/§5/§7 order and names, plus an axe
// check of role/name/structure.
//
// Pins: "accessible names as design.screen_reader decided, Testing Library and
// axe" (shell.a11y_chart .tji note); docs/screen-reader.md §2, §4, §5, §7;
// DIRECTION §3.7 lines 447-449. Axe here pins role/name/structure — the rules
// that run under jsdom; contrast at AA is a jsdom no-op, pinned at e2e-web.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { parse } from 'cifra-md';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import Chart from './Chart.jsx';

// A sung line whose columns attach G to "Quando", D to "eu te vi", Em to
// "passar"; a split word "W_hen" under C and G; and a chord-only chart line.
const SUNG = '## Verse\n```\nG      D        Em\nQuando eu te vi passar\n```\n';
const SPLIT = '## Verse\n```\nC G\nW_hen me\n```\n';
const CHART = '## Chart\n```\nG | D | Em | C\n```\n';

function renderChart(ui) {
  return render(<div className="est theme-current">{ui}</div>);
}

// The spoken tokens a screen reader walks, in document order: every text node
// that is not inside an `aria-hidden` subtree, trimmed, empties dropped. A
// visually-hidden spoken name and a real lyric run are each one token; a hidden
// glyph and the centred-hyphen `.fill` contribute nothing.
function a11yTokens(root) {
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
}

describe('Chart — the screen-reader reading (behavior)', () => {
  beforeEach(() => setLocale('en'));

  it('reads a sung line chord-then-word-run in source order, by spoken name (§2)', () => {
    const { container } = renderChart(<Chart model={parse(SUNG)} />);
    const sung = container.querySelector('.chart .sung');
    expect(a11yTokens(sung)).toEqual(['G', 'Quando', 'D', 'eu te vi', 'E minor', 'passar']);
    // Em is "E minor", never read as the word "em".
    expect(a11yTokens(sung)).not.toContain('Em');
  });

  it('reads a split word as its pieces with no hyphen or padding spoken (§4)', () => {
    const { container } = renderChart(<Chart model={parse(SPLIT)} />);
    const sung = container.querySelector('.chart .sung');
    const tokens = a11yTokens(sung);
    expect(tokens).toEqual(['C', 'W', 'G', 'hen me']);
    expect(tokens.join(' ')).not.toMatch(/[_-]/); // neither underscore padding nor hyphen
  });

  it('exposes a chart line as an ordered list of measures, the bar glyph never in the tree (§5)', () => {
    renderChart(<Chart model={parse(CHART)} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.map((li) => a11yTokens(li).join(' '))).toEqual(['G', 'D', 'E minor', 'C']);
    const chart = screen.getByRole('group', { name: 'Chart' });
    expect(a11yTokens(chart).join(' ')).not.toContain('|');
  });

  it('bounds a conflicted run as a group named in musical terms, ending with the exit word (§7.2)', () => {
    const markOf = () => ({ mark: 'conf', phrase: 'conflict in the chart line' });
    renderChart(<Chart model={parse(CHART)} markOf={markOf} />);
    const region = screen.getByRole('group', { name: 'needs you, conflict in the chart line' });
    expect(region).toBeInTheDocument();
    expect(within(region).getByText('end of conflict')).toBeInTheDocument();
  });

  it('bounds a shown default with default / end of defaults (§7.3)', () => {
    renderChart(<Chart model={parse(CHART)} markOf={() => 'def'} />);
    const region = screen.getByRole('group', { name: 'default' });
    expect(within(region).getByText('end of defaults')).toBeInTheDocument();
  });

  it('is axe-clean at WCAG 2.1 AA, unmarked, in conflict and showing defaults', async () => {
    const cases = [
      undefined,
      () => ({ mark: 'conf', phrase: 'conflict in the chart line' }),
      () => 'def',
    ];
    for (const markOf of cases) {
      const { container, unmount } = renderChart(<Chart model={parse(CHART)} markOf={markOf} />);
      expect(await checkWcag21aa(container)).toHaveNoViolations();
      unmount();
    }
  });

  it('announces an arrange chord button by its spoken name (§3, the keyboard surface)', () => {
    renderChart(<Chart model={parse(CHART)} onChordPress={() => {}} />);
    // The default chordLabel is the §3 spoken name, so the keyboard user hears
    // "E minor, button", not the glyph spelled out.
    expect(screen.getByRole('button', { name: 'E minor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'G' })).toBeInTheDocument();
  });
});

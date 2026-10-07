// behavior (music.transpose) — a transposed chart rendered, the song untouched.
// The engine's output is drawn by the real Chart under a `theme-current` root,
// against the real `cifra-md` reader and i18n, so the model→view path is
// exercised end to end at component level. Parsing here is a test convenience
// that pins the reader→engine→chart contract — production never parses in the
// view (the Worker owns parsing, DIRECTION §3.7 lines 407-417).
//
// Pins: the note's "behavior (a transposed chart rendered, the song untouched)";
// workflow 2 §Transposing L112 ("It changes the view, never the song"). Axe here
// pins role/name/structure under jsdom (contrast at AA is a jsdom no-op, pinned
// at e2e-web — the reading screen's, songs.reading).

import { describe, it, expect, beforeEach } from 'vitest';
import { render, within } from '@testing-library/react';
import { parse } from 'cifra-md';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import Chart from './Chart.jsx';
import { transpose } from '../core/transpose.js';

// A song written for the purpose: a sung verse whose first line splits "Testing"
// so a chord opens room inside the word, and whose second sets each chord over a
// word start. Up a tone with no key: G→A, D→E, Em→F#m.
const SONG = `# Transposing Tune

## Verse
\`\`\`
  G
Testing

G    D   Em
cats and dogs
\`\`\`
`;

function renderChart(ui) {
  return render(<div className="est theme-current">{ui}</div>);
}

describe('Chart with a transposed model (behavior)', () => {
  beforeEach(() => setLocale('en'));

  it('draws the transposed chords over the same words', () => {
    const { container } = renderChart(<Chart model={transpose(parse(SONG), 2)} />);
    const sung = container.querySelectorAll('.chart .sung');
    expect(sung.length).toBe(2);

    // The chords are the transposed ones, not the written ones.
    const firstChords = Array.from(sung[0].querySelectorAll('.s .c')).map((el) => el.textContent);
    expect(firstChords).toContain('A'); // G → A over "sting"
    expect(firstChords).not.toContain('G');
    const secondChords = Array.from(sung[1].querySelectorAll('.s .c')).map((el) => el.textContent);
    expect(secondChords).toEqual(expect.arrayContaining(['A', 'E', 'F#m']));

    // The words are untouched — only the view's key changed.
    expect(within(sung[0]).getByText('sting', { exact: false })).toBeTruthy();
    const words = Array.from(sung[1].querySelectorAll('.s .w')).map((el) => el.textContent);
    expect(words.join('')).toContain('cats');
  });

  it('leaves the original model deeply unchanged (the song is untouched, wf2 L112)', () => {
    const model = parse(SONG);
    const frozen = structuredClone(model);
    renderChart(<Chart model={transpose(model, 2)} />);
    expect(model).toEqual(frozen);
  });

  it('is axe-clean at WCAG 2.1 AA', async () => {
    const { container } = renderChart(<Chart model={transpose(parse(SONG), 2)} />);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

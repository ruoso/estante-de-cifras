// behavior — the chord diagram rendered with its real collaborators (the
// carried SVG renderer, diagram.css, i18n), under a `theme-current` root.
//
// Pins: "rendered with an accessible name, axe" (shell.diagram .tji note);
// DIRECTION §3.7 lines 415-417 (the kind is a view concern, not in the core);
// mockups README line 26 (status by word, never colour alone); the accessible
// name is the describeFingering sentence (app/src/render/diagram.js 186-231).
// Axe here pins role/name/label/structure — the rules that run under jsdom;
// contrast at AA is a jsdom no-op, pinned at e2e-web on the screens that embed
// the diagram.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import { parseChord } from '../core/notation/parse.js';
import { instrumentInstance } from '../core/instrument.js';
import { fingeringFromFrets } from '../core/search.js';
import ChordDiagram from './ChordDiagram.jsx';

const guitar = instrumentInstance({
  catalogId: '6guitar',
  label: 'Guitar · Standard',
  strings: 'E2, A2, D3, G3, B3, E4',
  fretCount: 22,
});

const C = parseChord('C').chord;
// Open C, x32010 — "C, x32010, open position, fingers 3-2-1, root on the 5th
// string." is the accessible name a sighted reader would get from the picture.
const openC = fingeringFromFrets(['x', 3, 2, 0, 1, 0], C, guitar);
const context = { chord: C, dialect: 'american', instrument: guitar };

// Rendered under the themed root, the way ThemeRoot puts it on the app root, so
// the token-keyed diagram.css cascades.
function renderDiagram(ui) {
  return render(<div className="est theme-current">{ui}</div>);
}

describe('ChordDiagram (behavior)', () => {
  beforeEach(() => setLocale('en'));

  it('is an image queryable by its accessible name (the describeFingering sentence)', () => {
    renderDiagram(<ChordDiagram fingering={openC} context={context} kind="song" />);
    const img = screen.getByRole('img', { name: /x32010/ });
    expect(img).toBeInTheDocument();
    // The whole sentence is the name, not just the shorthand.
    expect(img).toHaveAccessibleName(/open position/);
  });

  it('song: draws the song modifier and shows no kind word', () => {
    const { container } = renderDiagram(
      <ChordDiagram fingering={openC} context={context} kind="song" />
    );
    const host = container.querySelector('.chord-diagram');
    expect(host).toHaveClass('chord-diagram--song');
    expect(within(host).queryByText(/your shape|default/)).not.toBeInTheDocument();
  });

  it('yours: draws the yours modifier and the word "your shape"', () => {
    const { container } = renderDiagram(
      <ChordDiagram fingering={openC} context={context} kind="yours" />
    );
    expect(container.querySelector('.chord-diagram')).toHaveClass('chord-diagram--yours');
    expect(screen.getByText('your shape')).toBeInTheDocument();
  });

  it('default: draws the default modifier and the word "default"', () => {
    const { container } = renderDiagram(
      <ChordDiagram fingering={openC} context={context} kind="default" />
    );
    expect(container.querySelector('.chord-diagram')).toHaveClass('chord-diagram--default');
    expect(screen.getByText('default')).toBeInTheDocument();
  });

  it('is axe-clean at WCAG 2.1 AA for each kind', async () => {
    for (const kind of ['song', 'yours', 'default']) {
      const { container, unmount } = renderDiagram(
        <ChordDiagram fingering={openC} context={context} kind={kind} />
      );
      expect(await checkWcag21aa(container), kind).toHaveNoViolations();
      unmount();
    }
  });
});

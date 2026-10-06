// behavior (music.explorer) — the by-hand shape dialog with its real collaborators
// (real React Aria, the carried music core, i18n), under a themed root. The Worker
// is not a collaborator here: *enter a shape* produces a fingering and hands it to
// `onStar`, which the explorer turns into SAVE_SHAPE (covered in the explorer's own
// behavior test). Fixtures are shapes written for this test (no-song-text rule).
//
// Pins workflow 16 L136-146: place/lift/mute a string, the per-string read-out with
// foreign notes marked by a word, an unplayable shape reported without blocking,
// the result starred; axe clean.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, act, fireEvent } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import { parseChord } from '../core/notation/parse.js';
import { instrumentInstance } from '../core/instrument.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import EnterShape from './EnterShape.jsx';

const guitar = instrumentInstance({
  catalogId: '6guitar',
  label: 'Guitar · Standard',
  strings: 'E2 A2 D3 G3 B3 E4',
  fretCount: 22,
});
const C = parseChord('C').chord;

// A minimal, stable store so ThemeRoot's `preferences` read and portal provider
// work without the Worker (which this dialog does not touch).
const EMPTY = {};
const fakeStore = { subscribe: () => () => {}, slice: () => EMPTY, open: () => {} };

function installMatchMedia() {
  globalThis.matchMedia = (media) => ({
    media,
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

beforeEach(() => {
  installMatchMedia();
  setLocale('en');
});

function renderEnter(onStar = () => {}) {
  render(
    <ThemeRoot store={fakeStore}>
      <EnterShape instrument={guitar} chord={C} chordSymbol="C" dialect="brazilian" onStar={onStar} />
    </ThemeRoot>,
  );
}

const open = () => act(() => fireEvent.click(screen.getByRole('button', { name: /Enter a shape/ })));

describe('EnterShape (behavior)', () => {
  it('opens, places / lifts / mutes a string, reads the notes out, and marks a foreign one, axe clean', async () => {
    renderEnter();
    open();
    await screen.findByRole('heading', { name: 'Enter a shape' });

    // Place a finger: string 1 (the highest) at fret 1 — an F, foreign to C major.
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'String 1, fret 1' })));
    const notes = screen.getByText('What it sounds').parentElement;
    const foreignRow = within(notes)
      .getAllByRole('listitem')
      .find((li) => /fret 1/.test(li.textContent));
    expect(foreignRow).toBeTruthy();
    expect(within(foreignRow).getByText('not in the chord')).toBeInTheDocument();

    // Lift it: the string reads open again (its note, no fret).
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Open string 1' })));
    expect(
      within(notes)
        .getAllByRole('listitem')
        .some((li) => /String 1: open/.test(li.textContent)),
    ).toBe(true);

    // Mute it: the string reads muted.
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Mute string 1' })));
    expect(
      within(notes)
        .getAllByRole('listitem')
        .some((li) => /String 1: muted/.test(li.textContent)),
    ).toBe(true);

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('reports an unplayable shape without blocking', async () => {
    renderEnter();
    open();
    await screen.findByRole('heading', { name: 'Enter a shape' });

    // Six distinct frets across six strings — more fingers than a hand has.
    for (let n = 1; n <= 6; n += 1) {
      act(() => fireEvent.click(screen.getByRole('radio', { name: `String ${n}, fret ${n}` })));
    }

    // It says so, without blocking — the dialog and its grid are still there, and
    // the star is unavailable (nothing valid to keep).
    expect(
      await screen.findByText(/can’t be played as entered, but it is kept as drawn/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Enter a shape' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Star C,/ })).toBeDisabled();
  });

  it('stars what it produces (a playable shape), handing the fingering up', async () => {
    let starred = null;
    renderEnter((fingering) => {
      starred = fingering;
    });
    open();
    await screen.findByRole('heading', { name: 'Enter a shape' });

    // Build the open C shape x32010 (strings low→high: x 3 2 0 1 0).
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'String 5, fret 3' })));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'String 4, fret 2' })));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Open string 3' })));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'String 2, fret 1' })));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Open string 1' })));

    const star = screen.getByRole('button', { name: /Star C,/ });
    expect(star).not.toBeDisabled();
    act(() => fireEvent.click(star));

    expect(starred).toBeTruthy();
    expect(starred.shorthand).toBe('x32010');
  });
});

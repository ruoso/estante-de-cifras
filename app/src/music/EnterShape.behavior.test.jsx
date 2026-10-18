// behavior (music.explorer) — the by-hand shape dialog with its real collaborators
// (real React Aria, the carried music core, i18n), under a themed root. The Worker
// is not a collaborator here: *enter a shape* produces a fingering and hands it to
// `onStar`, which the explorer turns into SAVE_SHAPE (covered in the explorer's own
// behavior test). Fixtures are shapes written for this test (no-song-text rule).
//
// Pins workflow 16 §Entering a shape by hand (L147-160; the shared builder,
// L149-156 — songs.arrange_polish): place/lift/mute a string, the read-out naming
// each note's part in the chord and a foreign one *not in C*, the board's help
// copy, an unplayable shape reported without blocking, the result starred; axe
// clean.

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
  it('opens, places / lifts / mutes a string, names each note\'s part and marks a foreign one, axe clean', async () => {
    renderEnter();
    open();
    await screen.findByRole('heading', { name: 'Enter a shape' });
    // The board's help copy, shared with arrange's screen.
    expect(
      screen.getByText('Tap a string at a fret to place a finger; tap above the nut to mute or open it.'),
    ).toBeInTheDocument();

    const readout = screen.getByRole('region', { name: 'Notes it holds' });
    const row = (name) =>
      within(readout)
        .getAllByRole('listitem')
        .find((li) => li.querySelector('.name')?.textContent === name);

    // The open C shape x32010: each string's note named by its part in C.
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'String 5, fret 3' })));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'String 4, fret 2' })));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Open string 3' })));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'String 2, fret 1' })));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'String 1, fret 1' })));
    expect(within(row('A2')).getByText('root')).toBeInTheDocument();
    expect(within(row('D3')).getByText('major third')).toBeInTheDocument();
    expect(within(row('G3')).getByText('fifth')).toBeInTheDocument();
    expect(within(row('G3')).getByText('open')).toBeInTheDocument();
    // String 1 at fret 1 is an F, foreign to C major: a word, and the notice.
    expect(within(row('E4 · high E')).getByText('not in C')).toHaveClass('badge', 'conflict');
    expect(within(readout).getByText('C · E · G · F')).toBeInTheDocument();
    expect(
      screen.getByText('The F on the high E string is not in C, which is C, E and G. You can still choose this shape.'),
    ).toBeInTheDocument();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    // Lift it: the string reads open again, its E the chord's major third.
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Open string 1' })));
    expect(within(row('E4 · high E')).getByText('open')).toBeInTheDocument();
    expect(within(row('E4 · high E')).getByText('major third')).toBeInTheDocument();
    expect(screen.queryByText(/You can still choose this shape/)).toBeNull();

    // Mute it: the string reads muted, no note.
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Mute string 1' })));
    expect(within(row('E4 · high E')).getByText('muted')).toBeInTheDocument();
    expect(within(row('E4 · high E')).getByText('—')).toBeInTheDocument();
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

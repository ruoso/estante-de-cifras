import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { event, EventKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { parseChord } from '../core/notation/parse.js';
import { fromCatalog } from '../core/instrument.js';
import { fingeringFromFrets } from '../core/search.js';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import ThemeRoot from './ThemeRoot.jsx';

// behavior — the theme root on a sample surface (shell.tokens). Each theme and
// each density (a `density` register in the preferences slice —
// shell.display_preferences; workflow 1 §Density; home-book-format §4.1) renders with the right `est theme-<x> density-<y>` classes and
// is axe-clean at WCAG 2.1 AA; a `theme` register in the `preferences` slice
// drives the applied theme; a device-mode change under automatic re-applies
// Estante↔Palco. Pins the .tji note ("each theme and density rendered on a
// sample surface" + the home-book-driven choice), DIRECTION §3.7 L404-414, and
// the status-word rule (mockups README L26-27). Contrast at AA is pinned at
// e2e-web (jsdom has no layout, so axe's color-contrast is a no-op here — the
// established scope note in foundation/app_tooling.md).

const DARK = '(prefers-color-scheme: dark)';

// A manual endpoint lets the test push a PREFERENCES event straight into the
// store the way the deferred Worker producer eventually will, no DB involved.
function manualStore() {
  const endpoint = { postMessage: () => {}, onmessage: null };
  const store = createStore(endpoint);
  const emit = (message) => act(() => endpoint.onmessage({ data: message }));
  return { store, emit };
}

// A controllable `prefers-color-scheme` stub (jsdom provides no matchMedia).
// `set(dark)` flips the device mode and notifies the live subscription, the
// way a device switching between light and dark would.
function installMatchMedia(initialDark = false) {
  let matches = initialDark;
  const listeners = new Set();
  globalThis.matchMedia = (media) => ({
    media,
    get matches() {
      return matches;
    },
    addEventListener: (_type, cb) => listeners.add(cb),
    removeEventListener: (_type, cb) => listeners.delete(cb),
  });
  return {
    set(dark) {
      act(() => {
        matches = dark;
        for (const cb of listeners) cb({ matches: dark, media: DARK });
      });
    },
  };
}

afterEach(() => {
  delete globalThis.matchMedia;
});

// The sample surface: a heading and a status carried by a word, never colour
// alone (mockups README L26-27).
function Surface() {
  return (
    <main>
      <h1>Estante de Cifras</h1>
      <p role="status">Salvo</p>
    </main>
  );
}

function root(container) {
  return container.querySelector('.est');
}

describe('ThemeRoot (behavior)', () => {
  const CASES = [
    { chosen: undefined, applied: 'estante' }, // automatic, device light
    { chosen: 'estante', applied: 'estante' },
    { chosen: 'caderno', applied: 'caderno' },
    { chosen: 'palco', applied: 'palco' },
  ];

  for (const density of ['compact', 'comfortable', 'roomy']) {
    for (const { chosen, applied } of CASES) {
      it(`renders ${applied} at density ${density} with the right classes, axe-clean`, async () => {
        installMatchMedia(false);
        const { store, emit } = manualStore();
        const preferences = { density: { value: density, at: 't' } };
        if (chosen) preferences.theme = { value: chosen, at: 't' };
        emit(event(EventKind.PREFERENCES, preferences));

        const { container } = render(
          <ThemeRoot store={store}>
            <Surface />
          </ThemeRoot>,
        );

        expect(root(container)).toHaveClass('est', `theme-${applied}`, `density-${density}`);
        // The status word survives (never colour alone).
        expect(screen.getByRole('status')).toHaveTextContent('Salvo');
        expect(await checkWcag21aa(container)).toHaveNoViolations();
      });
    }
  }

  // An absent, tombstoned or unknown `density` register is the default
  // (home-book-format §4.1 L218-221, L230-233).
  for (const [label, preferences] of [
    ['absent', {}],
    ['tombstoned', { density: { value: null, at: 't' } }],
    ['unknown', { density: { value: 'huge', at: 't' } }],
  ]) {
    it(`renders density-comfortable for an ${label} density register`, () => {
      installMatchMedia(false);
      const { store, emit } = manualStore();
      emit(event(EventKind.PREFERENCES, preferences));
      const { container } = render(
        <ThemeRoot store={store}>
          <Surface />
        </ThemeRoot>,
      );
      expect(root(container)).toHaveClass('density-comfortable');
    });
  }

  it('re-renders a child ChordDiagram mirrored when diagramHanded changes (workflow 16 L216-221)', () => {
    installMatchMedia(false);
    const { store, emit } = manualStore();
    const guitar = fromCatalog('6guitar');
    const C = parseChord('C').chord;
    const openC = fingeringFromFrets(['x', 3, 2, 0, 1, 0], C, guitar);
    const { container } = render(
      <ThemeRoot store={store}>
        <ChordDiagram fingering={openC} context={{ chord: C, instrument: guitar }} />
      </ThemeRoot>,
    );
    const host = () => container.querySelector('.chord-diagram');
    const mutedPath = () => host().querySelector('.ec-muted').getAttribute('d');
    expect(host()).not.toHaveClass('chord-diagram--left');
    const rightHanded = mutedPath();

    emit(event(EventKind.PREFERENCES, { diagramHanded: { value: 'left', at: 't1' } }));
    expect(host()).toHaveClass('chord-diagram--left');
    // The lowest string's marker moved: the drawing itself is mirrored.
    expect(mutedPath()).not.toBe(rightHanded);

    emit(event(EventKind.PREFERENCES, { diagramHanded: { value: null, at: 't2' } }));
    expect(host()).not.toHaveClass('chord-diagram--left');
    expect(mutedPath()).toBe(rightHanded);
  });

  it('lets a theme register in the preferences slice drive the applied theme', () => {
    installMatchMedia(false);
    const { store, emit } = manualStore();
    const { container } = render(
      <ThemeRoot store={store}>
        <Surface />
      </ThemeRoot>,
    );
    // No register yet → automatic, device light → Estante.
    expect(root(container)).toHaveClass('theme-estante');

    // A chosen theme overrides automatic (home-book-format §4.1 L199).
    emit(event(EventKind.PREFERENCES, { theme: { value: 'palco', at: 't1' } }));
    expect(root(container)).toHaveClass('theme-palco');

    // "automatic" as the register value returns to following the device
    // (still light → Estante). Workflow 1 L97-98.
    emit(event(EventKind.PREFERENCES, { theme: { value: 'automatic', at: 't2' } }));
    expect(root(container)).toHaveClass('theme-estante');
  });

  it('re-applies Estante↔Palco when the device mode changes under automatic (workflow 1 L94-103)', () => {
    const media = installMatchMedia(false);
    const { store } = manualStore();
    const { container } = render(
      <ThemeRoot store={store}>
        <Surface />
      </ThemeRoot>,
    );
    expect(root(container)).toHaveClass('theme-estante');

    // The device switches to dark: automatic follows it to Palco, live.
    media.set(true);
    expect(root(container)).toHaveClass('theme-palco');

    // …and back to light.
    media.set(false);
    expect(root(container)).toHaveClass('theme-estante');
  });
});

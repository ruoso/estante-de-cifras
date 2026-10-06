import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { event, EventKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale, DEFAULT_LOCALE, t } from './index.js';
import LocaleRoot from './LocaleRoot.jsx';

// behavior — the locale root over a manual `preferences`-slice store (shell.i18n;
// the shell.tokens stub pattern, matchMedia unneeded). It proves the mechanism
// the chooser will drive: the chosen (or browser's) language reaches the view
// through the slice, a known shell label renders in that language, <html lang>
// carries it, and a language change re-renders a child that takes no locale prop
// — the keyed-remount Decision. Pins the .tji note ("switching language
// re-renders and sets lang"), DIRECTION §3.7 lines 407-417, and the register
// shape (home-book-format §4.1).

// Push a PREFERENCES event straight into the store the way the deferred Worker
// producer (storage.preferences_surface) eventually will — no DB involved.
function manualStore() {
  const endpoint = { postMessage: () => {}, onmessage: null };
  const store = createStore(endpoint);
  const emit = (payload) =>
    act(() => endpoint.onmessage({ data: event(EventKind.PREFERENCES, payload) }));
  return { store, emit };
}

// Set the browser's languages (jsdom's navigator.languages is read-only; define
// it so detectLocale sees what a given browser would).
function setBrowserLanguages(languages) {
  Object.defineProperty(globalThis.navigator, 'languages', {
    value: languages,
    configurable: true,
  });
}

// A child that takes no locale prop and reads a shell label through module-state
// t(): proof that a locale change reaches it only by the keyed remount.
function Label() {
  return <p>{t('shell.search')}</p>;
}

afterEach(() => {
  setLocale(DEFAULT_LOCALE);
  delete globalThis.navigator.languages;
});

describe('LocaleRoot (behavior)', () => {
  it('renders the browser language on an empty slice and sets <html lang>', () => {
    setBrowserLanguages(['pt-BR']);
    const { store } = manualStore();
    render(
      <LocaleRoot store={store}>
        <Label />
      </LocaleRoot>,
    );
    expect(screen.getByText('Busca')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('re-renders a locale-prop-free child and updates <html lang> when the register changes', () => {
    setBrowserLanguages(['pt-BR']);
    const { store, emit } = manualStore();
    render(
      <LocaleRoot store={store}>
        <Label />
      </LocaleRoot>,
    );
    expect(screen.getByText('Busca')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('pt-BR');

    // A chosen language wins over the browser's (home-book-format §4.1 register).
    emit({ language: { value: 'it', at: 't1' } });
    expect(screen.getByText('Cerca')).toBeInTheDocument();
    expect(screen.queryByText('Busca')).not.toBeInTheDocument();
    expect(document.documentElement.lang).toBe('it');
  });

  it('falls back to the browser language for a null register (mirrors the theme automatic)', () => {
    setBrowserLanguages(['pt-BR']);
    const { store, emit } = manualStore();
    render(
      <LocaleRoot store={store}>
        <Label />
      </LocaleRoot>,
    );
    // A chosen language, then its register cleared to null → back to the browser.
    emit({ language: { value: 'it', at: 't1' } });
    expect(screen.getByText('Cerca')).toBeInTheDocument();
    emit({ language: { value: null, at: 't2' } });
    expect(screen.getByText('Busca')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('is axe-clean in at least two languages', async () => {
    setBrowserLanguages(['pt-BR']);
    const { store, emit } = manualStore();
    const { container } = render(
      <LocaleRoot store={store}>
        <main>
          <h1>{t('app.name')}</h1>
          <p>{t('shell.search')}</p>
        </main>
      </LocaleRoot>,
    );
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    emit({ language: { value: 'it', at: 't1' } });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from './App.jsx';
import { checkWcag21aa } from './a11y/axe.js';
import { createStore } from './worker/store.js';
import { CommandKind } from './worker/protocol.js';

// behavior — the app root now mounts the navigation shell (AppShell) inside the
// resolved visual-language root (ThemeRoot), replacing the earlier placeholder
// screen. It proves React 19, the React Compiler, React Aria Components, i18n
// and Testing Library render the shell together, axe-clean at WCAG 2.1 AA. The
// shell root carries the navigation frame Search/Books/Setlists live inside
// (DIRECTION §4 lines 430-435; §3.7 lines 404-405). jsdom reports no matchMedia,
// so the default layout is the phone tab bar.
describe('App', () => {
  it('mounts under the resolved theme root (default automatic → Estante in light)', () => {
    // The shell root carries the resolved theme (DIRECTION §3.7 L404-405), not a
    // hard-coded `theme-current`. With no chosen theme and jsdom reporting no
    // dark mode, automatic resolves to Estante at the comfortable density.
    const { container } = render(<App />);
    expect(container.querySelector('.est')).toHaveClass(
      'est',
      'theme-estante',
      'density-comfortable',
    );
  });

  it('renders the navigation shell: the three destinations and a main landmark', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    for (const name of ['Search', 'Books', 'Setlists']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
  });

  it('opens on the default destination (Search) as its level-1 heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Search' })).toBeInTheDocument();
  });

  it('is axe-clean at WCAG 2.1 AA', async () => {
    const { container } = render(<App />);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

// behavior — the Worker's bring-up (OPEN) is sent by App, the one component
// every mount passes through (shell.dev_mount_open): a cold boot straight into a
// `#dev/*` mount surfaces READY and the preferences slice exactly as a boot into
// the shell does, AppShell no longer adds a second OPEN, and a hash change does
// not re-open. Rendered over a recording store (the FirstRun pattern) and
// without StrictMode, so "exactly one OPEN" is meaningful.
describe('App brings the Worker up', () => {
  function makeStore() {
    const sent = [];
    const store = createStore({ postMessage: (m) => sent.push(m), onmessage: null });
    return { store, sent };
  }
  const opens = (sent) => sent.filter((m) => m.kind === CommandKind.OPEN).length;

  afterEach(() => {
    history.replaceState(null, '', '/');
  });

  it('a boot into a dev mount sends OPEN once', () => {
    // `#dev/chart` consumes no store, so its OPEN can only come from App;
    // `#dev/files` is a store-consuming mount.
    for (const hash of ['#dev/chart', '#dev/files?book=b&path=']) {
      location.hash = hash;
      const { store, sent } = makeStore();
      const { unmount } = render(<App store={store} />);
      expect(opens(sent), hash).toBe(1);
      unmount();
    }
  });

  it('a boot into the shell sends OPEN once', () => {
    const { store, sent } = makeStore();
    render(<App store={store} />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(opens(sent)).toBe(1);
  });

  it('a hash change does not open again', () => {
    const { store, sent } = makeStore();
    render(<App store={store} />);
    expect(opens(sent)).toBe(1);
    act(() => {
      location.hash = '#dev/chart';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(opens(sent)).toBe(1);
  });
});

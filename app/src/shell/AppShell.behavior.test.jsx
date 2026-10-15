import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import AppShell from './AppShell.jsx';
import { WIDE_QUERY } from './layout-mode.js';

// behavior — the navigation shell with its real collaborators (React Aria
// Components, i18n, the themed classes). Pins the .tji note ("tab bar and splits
// with Testing Library; keyboard navigation; axe"), the drawn tab bar and split
// (GUIDE.md line 34, W02 lines 55-59 / 149-211, theme.css lines 143-149),
// DIRECTION §3.7 lines 396-417 (RAC for every interactive part; view-held
// navigation) and the status-word rule (mockups README lines 26-27). Axe here
// pins role/name/structure — the rules that run under jsdom; contrast is pinned
// at e2e-web, where a real browser gives axe the layout its color-contrast rule
// needs (the established scope note, foundation/app_tooling.md).

const DESTINATION_LABELS = ['Search', 'Books', 'Setlists'];

// A controllable viewport stub (jsdom provides no matchMedia). It answers the
// shell's wide query with `wide`, and `set(wide)` flips it and notifies the live
// subscription — the way a viewport crossing the breakpoint would. Mirrors the
// ThemeRoot test's matchMedia stub.
function installMatchMedia(initialWide) {
  let wide = initialWide;
  const listeners = new Set();
  globalThis.matchMedia = (media) => ({
    media,
    get matches() {
      return media === WIDE_QUERY ? wide : false;
    },
    addEventListener: (_type, cb) => listeners.add(cb),
    removeEventListener: (_type, cb) => listeners.delete(cb),
  });
  return {
    set(next) {
      act(() => {
        wide = next;
        for (const cb of listeners) cb({ matches: next, media: WIDE_QUERY });
      });
    },
  };
}

// The shell starts on the place its address names (shell.routing), and jsdom's
// URL carries over from one test to the next: every test starts at `/`.
beforeEach(() => {
  history.replaceState(null, '', '/');
  // The rename record (book-renames.js) lives in sessionStorage: none leaks in.
  sessionStorage.clear();
});

afterEach(() => {
  delete globalThis.matchMedia;
});

describe('AppShell (behavior)', () => {
  it('narrow: renders the .tabbar with the three destinations in order, switches region on activation, axe-clean', async () => {
    installMatchMedia(false);
    const { container } = render(<AppShell />);

    // The phone tab bar is drawn, not the split (GUIDE.md 34; W02 55-59).
    expect(container.querySelector('.tabbar')).toBeInTheDocument();
    expect(container.querySelector('.split')).not.toBeInTheDocument();

    // Three tabs, labelled Search · Books · Setlists in that order.
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(DESTINATION_LABELS);

    // Search shows by default; its region is the only level-1 heading.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Search');

    // Activating Books switches the shown destination region and the selection.
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Books');

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('wide: renders the .split sidebar rail and the <main> detail, switches the detail on activation, axe-clean', async () => {
    installMatchMedia(true);
    const { container } = render(<AppShell />);

    // The sidebar + detail split is drawn, not the tab bar (theme.css 143-149).
    expect(container.querySelector('.split')).toBeInTheDocument();
    expect(container.querySelector('.tabbar')).not.toBeInTheDocument();
    expect(container.querySelector('.pane.side')).toBeInTheDocument();

    // The <main> detail landmark is preserved and holds the destination region.
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent('Search');

    // The three destinations are reachable from the sidebar rail.
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(DESTINATION_LABELS);

    // Activating Setlists switches the detail.
    fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));
    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent('Setlists');

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('flips layout live as the viewport crosses the breakpoint, keeping the selected destination', () => {
    const viewport = installMatchMedia(false);
    const { container } = render(<AppShell />);

    // Narrow to start, select Books.
    expect(container.querySelector('.tabbar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));

    // Cross into the wide range: the split replaces the tab bar, Books survives.
    viewport.set(true);
    expect(container.querySelector('.split')).toBeInTheDocument();
    expect(container.querySelector('.tabbar')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Books');
  });

  it('keyboard: arrow keys and Home/End move across destinations with selection following (RAC roving tabindex)', () => {
    installMatchMedia(false);
    render(<AppShell />);
    const [search, books, setlists] = screen.getAllByRole('tab');

    act(() => search.focus());
    expect(search).toHaveFocus();

    // Arrow moves focus to the next destination and selection follows.
    fireEvent.keyDown(search, { key: 'ArrowRight' });
    expect(books).toHaveFocus();
    expect(books).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Books');

    // End jumps to the last, Home back to the first.
    fireEvent.keyDown(books, { key: 'End' });
    expect(setlists).toHaveFocus();
    expect(setlists).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(setlists, { key: 'Home' });
    expect(search).toHaveFocus();
    expect(search).toHaveAttribute('aria-selected', 'true');
  });

  it('selected-by-word: exactly one tab carries aria-selected=true, the rest false (not colour alone)', () => {
    installMatchMedia(false);
    render(<AppShell />);
    const selected = screen
      .getAllByRole('tab')
      .map((tab) => tab.getAttribute('aria-selected'));
    expect(selected).toEqual(['true', 'false', 'false']);
  });
});

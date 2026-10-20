import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import AppShell from './AppShell.jsx';
import { WIDE_QUERY } from './layout-mode.js';
import { createAuthClient } from '../account/auth-client.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';

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

// The header as drawn (shell.header_chrome): the *Estante* wordmark, the one
// short instrument chip carrying the full identity as its description, and the
// account button — above every destination on a phone, in the side header on a
// tablet or computer. Pins workflow 1 §The instrument (as amended) and W01 phone
// 1 / computer.
describe('AppShell header chrome (behavior)', () => {
  // The standard-guitar fallback the Worker sends when no instrument is set up
  // (label null; worker/instruments.js standardEntry).
  const STANDARD = {
    id: 'standard',
    catalogId: '6guitar',
    label: null,
    tuning: 'E2 A2 D3 G3 B3 E4',
    fretCount: 22,
    shapes: [],
  };

  function renderWithStandard() {
    const endpoint = { postMessage() {}, onmessage: null };
    const store = createStore(endpoint);
    const view = render(<AppShell store={store} />);
    act(() =>
      endpoint.onmessage({
        data: event(EventKind.INSTRUMENTS, { instruments: [], inUseId: null, standard: STANDARD }),
      }),
    );
    return view;
  }

  function expectHeader(header) {
    expect(header).toHaveTextContent(/^Estante/);
    expect(header).not.toHaveTextContent('Estante de Cifras');
    const chip = within(header).getByRole('button', { name: 'Guitar, change instrument' });
    expect(chip).toHaveTextContent(/^Guitar$/);
    expect(chip).toHaveAccessibleDescription('Guitar (6-string), Standard tuning: E2 A2 D3 G3 B3 E4');
    expect(within(header).getByRole('button', { name: 'Account' })).toBeInTheDocument();
    // One chip on the screen: two identically named buttons would be ambiguous.
    expect(screen.getAllByRole('button', { name: /change instrument/ })).toHaveLength(1);
  }

  for (const [layout, wide, headClass] of [
    ['narrow', false, '.instr-top'],
    ['wide', true, '.side-head'],
  ]) {
    it(`${layout}: wordmark, chip and account on Search, Books and Setlists, axe-clean`, async () => {
      installMatchMedia(wide);
      const { container } = renderWithStandard();
      for (const destination of DESTINATION_LABELS) {
        fireEvent.click(screen.getByRole('tab', { name: destination }));
        const header = container.querySelector(headClass);
        expect(header).toBeInTheDocument();
        expectHeader(header);
        // The destination keeps its own page heading — Search's is visually
        // hidden behind the wordmark row, but still the level-1 heading.
        expect(screen.getByRole('heading', { level: 1, name: destination })).toBeInTheDocument();
        expect(await checkWcag21aa(container)).toHaveNoViolations();
      }
    });
  }
});

describe('AppShell paused book panel (behavior)', () => {
  // --- sync.conflicts_polish constraint 5: the paused book panel beside the
  // rail on a wide layout (W09#4 L184-205), a full screen on the phone.
  const CONFLICT_BOOK = 'b1';
  const CONFLICT_AT = '2026-10-16T00:00:00.000Z';
  const CONFLICT_SHELF = {
    books: {
      [CONFLICT_BOOK]: {
        label: { value: 'Choros da Ana', at: CONFLICT_AT },
        role: { value: 'owner', at: CONFLICT_AT },
        position: { value: 1, at: CONFLICT_AT },
      },
    },
    local: {},
  };
  const CONFLICTS_PAYLOAD = {
    bookId: CONFLICT_BOOK,
    inProgress: true,
    songs: [{ path: 'roda-de-rua.cifra.md', title: 'Roda de rua', count: 1, author: 'Ana' }],
    deleted: [],
    incoming: [],
    savesHeld: [],
  };
  function conflictStore() {
    const sent = [];
    const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
    const store = createStore(endpoint);
    const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
    return { store, sent, emit };
  }
  // Books → the book needing you → its songs, the bar's notice → *Settle*,
  // which sends OPEN_CONFLICTS, whose model the Worker then emits (workflow 9
  // §Meeting one; books.row_opens_songs).
  function settleFromBooks(emit) {
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    fireEvent.click(screen.getByRole('button', { name: /^Choros da Ana/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Settle conflicts in Choros da Ana' }));
    emit(event(EventKind.CONFLICTS, CONFLICTS_PAYLOAD));
  }
  function openNeedsYouBook(emit) {
    emit(event(EventKind.SHELF, CONFLICT_SHELF));
    emit(event(EventKind.SYNC, { bookId: CONFLICT_BOOK, phase: 'needs_you', at: CONFLICT_AT }));
    settleFromBooks(emit);
  }

  // books.row_opens_songs (replaces *Files on a book needing you*): pressing the
  // book opens its songs with the notice, and Settle engages the merge and
  // shows the panel (workflow 9 §Meeting one).
  it('Settle on a book that needs you sends OPEN_CONFLICTS and shows the conflicts panel; the press itself opened the book’s songs', () => {
    installMatchMedia(false);
    const { store, sent, emit } = conflictStore();
    render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, CONFLICT_SHELF));
    emit(event(EventKind.SYNC, { bookId: CONFLICT_BOOK, phase: 'needs_you', at: CONFLICT_AT }));
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    fireEvent.click(screen.getByRole('button', { name: /^Choros da Ana/ }));
    // The book's songs, not the panel: Search scoped to the book, its bar's notice.
    expect(screen.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true');
    expect(location.pathname).toBe(`/b/${CONFLICT_BOOK}`);
    expect(screen.queryByRole('list', { name: 'In conflict' })).not.toBeInTheDocument();
    // The press engaged the merge, as it always did, so the bar can count.
    const before = sent.filter((m) => m.kind === CommandKind.OPEN_CONFLICTS).length;
    expect(before).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Settle conflicts in Choros da Ana' }));
    expect(sent.filter((m) => m.kind === CommandKind.OPEN_CONFLICTS).length).toBe(before + 1);
    expect([...sent].reverse().find((m) => m.kind === CommandKind.OPEN_CONFLICTS).payload).toEqual({
      bookId: CONFLICT_BOOK,
    });
    emit(event(EventKind.CONFLICTS, CONFLICTS_PAYLOAD));
    expect(screen.getByRole('list', { name: 'In conflict' })).toBeInTheDocument();
  });

  it('wide: a book needing you opens its panel in the main pane, the rail beside it; a rail tab leaves it (constraint 5; W09#4 L184-205)', async () => {
    installMatchMedia(true);
    const { store, emit } = conflictStore();
    const { container } = render(<AppShell store={store} />);
    // Start elsewhere, so opening the panel is seen to select Books.
    openNeedsYouBook(emit);

    const main = screen.getByRole('main');
    const list = within(main).getByRole('list', { name: 'In conflict' });
    expect(list).toBeInTheDocument();
    expect(within(main).getByText('needs you')).toBeInTheDocument();
    // The rail stays beside it, Books selected, in the side pane.
    const rail = screen.getByRole('tablist', { name: 'Destinations' });
    expect(rail.closest('.pane.side')).toBeTruthy();
    expect(within(rail).getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true');
    // Not a second screen over the shell.
    expect(container.querySelector('.est-bookconf-screen')).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // A rail tab leaves the panel.
    fireEvent.click(within(rail).getByRole('tab', { name: 'Search' }));
    expect(screen.queryByRole('list', { name: 'In conflict' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true');
  });

  it('wide: the panel’s Back returns to the book’s songs it was settled from (books.row_opens_songs Decision *Settle opens the existing conflicts surface*)', async () => {
    installMatchMedia(true);
    const { store, emit } = conflictStore();
    render(<AppShell store={store} />);
    openNeedsYouBook(emit);
    fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));
    // Re-open from Books, then the panel's Back returns to the book's songs.
    settleFromBooks(emit);
    expect(screen.getByRole('list', { name: 'In conflict' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Back' }));
    // Back is the history's (above depth 0, a popstate jsdom fires on a task).
    await waitFor(() => expect(screen.queryByRole('list', { name: 'In conflict' })).not.toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Manage Choros da Ana' })).toBeInTheDocument();
  });

  it('narrow: the panel is a full screen over the shell (no tab bar), as before', async () => {
    installMatchMedia(false);
    const { store, emit } = conflictStore();
    const { container } = render(<AppShell store={store} />);
    openNeedsYouBook(emit);

    expect(screen.getByRole('list', { name: 'In conflict' })).toBeInTheDocument();
    expect(container.querySelector('.est-bookconf-screen')).toBeTruthy();
    expect(screen.queryByRole('tablist', { name: 'Destinations' })).not.toBeInTheDocument();
    expect(container.querySelector('.tabbar')).not.toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});


// behavior (books.row_opens_songs) — a book on the shelf opens on its songs: the
// row's press is the place `{ tab: 'search', book }`, pushed; *Manage* on the
// bar opens the detail as a layer; Files opens over the detail; removing the
// book lands on Books. Pins workflow 7 L28-34 and L86-95, workflow 14 L132-134.
describe('AppShell — a book opens on its songs (books.row_opens_songs)', () => {
  const AT = '2026-10-20T00:00:00.000Z';
  const BOOK = 'l-ex';
  const SHELF = {
    books: {},
    local: { [BOOK]: { title: { value: 'Exercícios', at: AT }, position: { value: 0, at: AT } } },
  };
  function bookStore() {
    const sent = [];
    const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
    const store = createStore(endpoint);
    const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
    return { store, sent, emit };
  }
  function openBookSongs(emit) {
    emit(event(EventKind.SHELF, SHELF));
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    fireEvent.click(screen.getByRole('button', { name: /^Exercícios/ }));
  }

  it('pressing a Books row selects Search scoped to the book at /b/<book>; Back returns to Books (workflow 7 L28-34)', async () => {
    installMatchMedia(false);
    const { store, sent, emit } = bookStore();
    const { container } = render(<AppShell store={store} />);
    openBookSongs(emit);

    expect(screen.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true');
    expect(location.pathname).toBe(`/b/${BOOK}`);
    expect(history.state.place).toEqual({ tab: 'search', book: BOOK });
    expect(container.querySelector('.search .scope')).toHaveTextContent('Exercícios');
    expect(screen.getByRole('button', { name: 'Manage Exercícios' })).toBeInTheDocument();
    expect([...sent].reverse().find((m) => m.kind === CommandKind.BROWSE).payload.scope).toEqual({ books: [BOOK] });
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // A pushed step: the browser's Back returns to Books.
    act(() => history.back());
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true'));
    expect(location.pathname).toBe('/books');
  });

  it('Manage opens the detail as a layer over the book’s songs, and its Back returns to them (workflow 7 L86-95)', async () => {
    installMatchMedia(false);
    const { store, emit } = bookStore();
    const { container } = render(<AppShell store={store} />);
    openBookSongs(emit);

    fireEvent.click(screen.getByRole('button', { name: 'Manage Exercícios' }));
    expect(screen.getByRole('button', { name: 'Back to Exercícios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename Exercícios' })).toBeInTheDocument();
    // A layer, not an address: the URL stays the book's songs.
    expect(location.pathname).toBe(`/b/${BOOK}`);
    expect(history.state.layers).toEqual(['bookDetail']);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Exercícios' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Back to Exercícios' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Manage Exercícios' })).toBeInTheDocument();
    expect(history.state.layers).toEqual([]);
  });

  it('Files on the detail opens the file view on the book, and its Back returns to the detail (workflow 14 L132-134)', async () => {
    installMatchMedia(false);
    const { store, emit } = bookStore();
    render(<AppShell store={store} />);
    openBookSongs(emit);
    fireEvent.click(screen.getByRole('button', { name: 'Manage Exercícios' }));

    fireEvent.click(screen.getByRole('button', { name: 'Files in Exercícios' }));
    expect(screen.getByRole('group', { name: 'Files in Exercícios' })).toBeInTheDocument();
    expect(history.state.layers).toEqual(['bookDetail', 'files']);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Files in Exercícios' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Back to Exercícios' })).toBeInTheDocument();
    expect(history.state.layers).toEqual(['bookDetail']);
  });

  it('on a computer the detail takes the main pane beside the book’s songs (Decision *The detail splits where a song does*)', () => {
    let wide = true;
    globalThis.matchMedia = (media) => ({
      media,
      get matches() {
        return wide && !media.includes('prefers-color-scheme');
      },
      addEventListener() {},
      removeEventListener() {},
    });
    const { store, emit } = bookStore();
    const { container } = render(<AppShell store={store} />);
    openBookSongs(emit);
    fireEvent.click(screen.getByRole('button', { name: 'Manage Exercícios' }));

    const split = container.querySelector('.book-detail-split');
    expect(split).toBeTruthy();
    expect(within(split.querySelector('.pane.main')).getByRole('button', { name: 'Back to Exercícios' })).toBeInTheDocument();
    const side = split.querySelector('.pane.side');
    expect(within(side).getByRole('button', { name: 'Manage Exercícios' })).toBeInTheDocument();
    expect(side.querySelector('.search .scope')).toHaveTextContent('Exercícios');
    wide = false;
  });

  it('a fork made from the detail lands on the shelf, the fork selected with its one-time note (books.fork; W11 #2)', () => {
    installMatchMedia(false);
    const { store, emit } = bookStore();
    render(<AppShell store={store} />);
    openBookSongs(emit);
    fireEvent.click(screen.getByRole('button', { name: 'Manage Exercícios' }));

    emit(
      event(EventKind.SHELF, {
        books: {
          'srv-fork': {
            label: { value: 'Exercícios', at: AT },
            position: { value: 0, at: AT },
            role: { value: 'owner', at: AT },
            original: { value: { bookId: BOOK, title: 'Exercícios', followedAt: AT }, at: AT },
          },
        },
        local: {},
      }),
    );
    emit(event(EventKind.BOOK_FORKED, { previousBookId: BOOK, bookId: 'srv-fork', via: 'service' }));

    expect(screen.queryByRole('button', { name: 'Back to Exercícios' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Exercícios is your own now/)).toHaveAttribute('role', 'status');
  });

  it('removing the book from its detail lands on Books (workflow 7 L94-95)', () => {
    installMatchMedia(false);
    const { store, sent, emit } = bookStore();
    render(<AppShell store={store} />);
    openBookSongs(emit);
    fireEvent.click(screen.getByRole('button', { name: 'Manage Exercícios' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove from my shelf' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove from my shelf' }));
    expect([...sent].reverse().find((m) => m.kind === CommandKind.REMOVE_BOOK).payload).toEqual({ bookId: BOOK });
    emit(event(EventKind.BOOK_REMOVED, { bookId: BOOK }));
    emit(event(EventKind.SHELF, { books: {}, local: {} }));

    expect(screen.queryByRole('button', { name: 'Back to Exercícios' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Books' })).toBeInTheDocument();
    expect(location.pathname).toBe('/books');
  });
});

// behavior (account.sign_in_two_doors) — the recovery-email banner in the shell,
// with an injected loopback auth client answering `GET
// /api/account/recovery-email`. Pins workflow 13 §The banner (placement, full
// screen, *Screens without the header chrome*, *How it reads*, *What the device
// knows*) and boards W13 #2, W01 #4 and Sign-in Tablet.
describe('Recovery-email banner', () => {
  const BANNER = 'No recovery email yet.';
  const banner = () => screen.queryByRole('region', { name: BANNER });
  const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const AT = '2026-10-15T00:00:00.000Z';
  const SHELF = {
    books: { b1: { label: { value: 'Banda do Bairro', at: AT }, role: { value: 'editor', at: AT }, position: { value: 1, at: AT } } },
    local: {},
  };
  const SONG_PATH = 'choro/tarde-clara.cifra.md';
  const SONG_TEXT = ['# Tarde Clara', '', '## Verse', '```', 'G  C | Am  D', '```', ''].join('\n');

  // `answer` is what the next probe gets: a body, a status, or 'offline'.
  function makeAuth(initial) {
    const box = { answer: initial };
    const fetch = async (path, init = {}) => {
      const method = init.method ?? 'GET';
      if (method === 'GET' && path === '/api/account/recovery-email') {
        if (box.answer === 'offline') throw new TypeError('offline');
        if (typeof box.answer === 'number') {
          return { ok: false, status: box.answer, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => box.answer };
      }
      if (method === 'GET' && path === '/api/account/sessions') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ sessions: [{ id: 's1', current: true, lastUsedAt: AT, device: 'Chrome on Linux' }] }),
        };
      }
      if (method === 'GET' && path === '/api/account/passkeys') {
        return { ok: true, status: 200, json: async () => ({ passkeys: [] }) };
      }
      throw new TypeError(`no route for ${method} ${path}`);
    };
    return { client: createAuthClient({ fetch }), box };
  }

  function renderShell(answer, { wide = false } = {}) {
    installMatchMedia(wide);
    const auth = makeAuth(answer);
    const endpoint = { postMessage() {}, onmessage: null };
    const store = createStore(endpoint);
    const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
    const view = render(<AppShell store={store} authClient={auth.client} />);
    return { ...view, ...auth, emit };
  }

  for (const [layout, wide] of [
    ['narrow', false],
    ['wide', true],
  ]) {
    it(`${layout}: below the header chrome and before the destination, on every destination, axe clean`, async () => {
      const { container } = renderShell({ email: null, pending: null }, { wide });
      const shown = await screen.findByRole('region', { name: BANNER });
      const header = container.querySelector(wide ? '.side-head' : '.instr-top');
      if (wide) {
        expect(shown.closest('.pane.main')).toBeTruthy();
        expect(shown.closest('.pane.side')).toBeNull();
      } else {
        expect(follows(header, shown)).toBe(true);
      }
      for (const destination of ['Search', 'Books', 'Setlists']) {
        fireEvent.click(screen.getByRole('tab', { name: destination }));
        const now = banner();
        expect(now, destination).toBeInTheDocument();
        expect(follows(now, screen.getByRole('heading', { level: 1, name: destination }))).toBe(true);
      }
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });
  }

  it('reads in words, is not dismissible and is not a live region: one button, Add one', async () => {
    renderShell({ email: null, pending: null });
    const shown = await screen.findByRole('region', { name: BANNER });
    expect(shown).toHaveTextContent(
      'No recovery email yet. If you lose your passkeys, you lose this account and your books on Estante.',
    );
    expect(within(shown).getAllByRole('button').map((b) => b.textContent)).toEqual(['Add one']);
    expect(['status', 'alert']).not.toContain(shown.getAttribute('role'));
    expect(shown).not.toHaveAttribute('aria-live');
    expect(shown.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
    // A tab change re-renders the same strip, not a new announcement.
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    expect(banner()).not.toHaveAttribute('aria-live');
  });

  it('a pending address keeps it; signed in, the first-run row is not offered', async () => {
    renderShell({ email: null, pending: 'ana@example.com' });
    expect(await screen.findByRole('region', { name: BANNER })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sign in or make an account/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Write a song/ })).toBeInTheDocument();
  });

  it('a confirmed address shows none', async () => {
    const { box } = renderShell({ email: 'ana@example.com', pending: null });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Sign in or make an account/ })).toBeNull());
    expect(box.answer.email).toBe('ana@example.com');
    expect(banner()).toBeNull();
  });

  it('signed out (401) shows none, and the first-run row is offered', async () => {
    renderShell(401);
    // Let the probe answer.
    await act(async () => {
      await Promise.resolve();
    });
    expect(banner()).toBeNull();
    expect(screen.getByRole('button', { name: /^Sign in or make an account/ })).toBeInTheDocument();
  });

  it('offline before any answer: no banner', async () => {
    renderShell('offline');
    await act(async () => {
      await Promise.resolve();
    });
    expect(banner()).toBeNull();
    expect(screen.getByRole('button', { name: /^Sign in or make an account/ })).toBeInTheDocument();
  });

  it('Add one opens the account screen focused on the region; closing it asks again, and a confirmed answer clears the banner', async () => {
    const { box } = renderShell({ email: null, pending: null });
    fireEvent.click(within(await screen.findByRole('region', { name: BANNER })).getByRole('button', { name: 'Add one' }));

    const field = await screen.findByRole('textbox', { name: 'Recovery email' });
    await waitFor(() => expect(field).toHaveFocus());

    box.answer = { email: 'ana@example.com', pending: null };
    fireEvent.click(screen.getAllByRole('button', { name: 'Back' })[0]);
    await waitFor(() => expect(screen.getByRole('tablist', { name: 'Destinations' })).toBeInTheDocument());
    await waitFor(() => expect(banner()).toBeNull());
  });

  it('above a song opened from search, before its own bar; gone while it is read full screen, back after', async () => {
    const { emit } = renderShell({ email: null, pending: null });
    await screen.findByRole('region', { name: BANNER });
    emit(event(EventKind.SHELF, SHELF));
    act(() => {
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'tarde' } });
    });
    emit(
      event(EventKind.SEARCH_RESULTS, {
        query: 'tarde',
        results: [{ bookId: 'b1', path: SONG_PATH, title: 'Tarde Clara', artist: '', score: 3, unsaved: false }],
      }),
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Tarde Clara/ })[0]);
    emit(event(EventKind.SOURCE, { bookId: 'b1', path: SONG_PATH, text: SONG_TEXT }));

    const shown = banner();
    expect(shown).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Destinations' })).toBeNull();
    expect(follows(shown, screen.getAllByRole('button', { name: 'Back' })[0])).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    await screen.findByRole('button', { name: 'Leave full screen' });
    expect(banner()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Leave full screen' }));
    await waitFor(() => expect(banner()).toBeInTheDocument());
  });

  // The themed root decides the tokens; with the scheme dark, Automatic is Palco.
  for (const [theme, dark] of [
    ['estante', false],
    ['palco', true],
  ]) {
    it(`axe clean with the banner in ${theme}`, async () => {
      globalThis.matchMedia = (media) => ({
        media,
        matches: media.includes('prefers-color-scheme: dark') ? dark : false,
        addEventListener() {},
        removeEventListener() {},
      });
      const { client } = makeAuth({ email: null, pending: null });
      const store = createStore({ postMessage() {}, onmessage: null });
      const { container } = render(
        <ThemeRoot store={store}>
          <AppShell store={store} authClient={client} />
        </ThemeRoot>,
      );
      await screen.findByRole('region', { name: BANNER });
      expect(container.querySelector('.est')).toHaveClass(`theme-${theme}`);
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });
  }
});

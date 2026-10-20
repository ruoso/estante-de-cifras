// behavior — the Setlists destination (books.setlists_resilient) with its real
// collaborators (RAC, i18n, the loopback store) under jsdom, over a fake Worker
// as in SetlistView.behavior.test.jsx, plus an axe check of each state. Pins
// Constraint 4 (never *Loading* forever: an ERROR while a list is in flight
// shows a plain sentence and Try again; an unrelated ERROR is ignored) and
// Constraint 5 (a book landing — SHELF_FILL ready — re-lists). Workflow 12 §The
// file L34. All setlist text is written for this test.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor, within } from '@testing-library/react';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SetlistsScreen from './SetlistsScreen.jsx';

function installMatchMedia(matches) {
  globalThis.matchMedia = (query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

beforeEach(() => {
  installMatchMedia(false);
  setLocale('en');
});
afterEach(() => {
  delete globalThis.matchMedia;
});

// One clean, one never saved, one saved and edited (books.setlist_done
// Constraint 3: each row's status).
const SETLISTS = [
  { bookId: 'band', path: 'ensaio.setlist.md', title: 'Ensaio de sábado', count: 3, status: null },
  { bookId: 'band', path: 'nova.setlist.md', title: 'Roda de domingo', count: 1, status: 'new' },
  { bookId: 'band', path: 'aula.setlist.md', title: 'Aula de terça', count: 2, status: 'unsaved' },
];

// A fake Worker whose LIST_SETLISTS reply is chosen per test: `list` answers
// SETLISTS, `error` answers the generic ERROR the Worker's catch posts, `hold`
// answers nothing (a list still in flight).
function makeStore({ reply = 'list' } = {}) {
  const commands = [];
  const state = { reply };
  let workerPort;
  const endpoint = createLoopbackEndpoint((port) => {
    workerPort = port;
    return {
      handle(message) {
        commands.push(message);
        if (message.kind !== CommandKind.LIST_SETLISTS) return;
        if (state.reply === 'list') {
          port.postMessage(event(EventKind.SETLISTS, { setlists: SETLISTS }));
        } else if (state.reply === 'error') {
          port.postMessage(event(EventKind.ERROR, { message: 'boom', code: 'command_failed' }));
        }
      },
    };
  });
  const store = createStore(endpoint);
  const emit = (kind, payload) => act(async () => workerPort.postMessage(event(kind, payload)));
  const lists = () => commands.filter((c) => c.kind === CommandKind.LIST_SETLISTS).length;
  return { store, state, emit, lists };
}

function renderScreen(store) {
  return render(
    <ThemeRoot store={store}>
      <SetlistsScreen store={store} />
    </ThemeRoot>,
  );
}

describe('SetlistsScreen — never Loading forever (books.setlists_resilient)', () => {
  it('shows Loading while a list is in flight (axe clean)', async () => {
    const { store, lists } = makeStore({ reply: 'hold' });
    const { container } = renderScreen(store);
    await waitFor(() => expect(lists()).toBe(1));
    expect(screen.getByText('Loading setlists…')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('an ERROR after LIST_SETLISTS replaces Loading with the failure sentence and Try again; Try again by keyboard re-lists (Constraint 4)', async () => {
    const { store, state, lists } = makeStore({ reply: 'error' });
    const { container } = renderScreen(store);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent("The setlists on this device couldn't be read.");
    expect(screen.queryByText('Loading setlists…')).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Keyboard path: Try again is in the tab order; focus it and press Enter.
    expect(retry.getAttribute('tabindex')).not.toBe('-1');
    expect(retry).not.toBeDisabled();
    state.reply = 'hold';
    act(() => retry.focus());
    expect(retry).toHaveFocus();
    act(() => {
      fireEvent.keyDown(retry, { key: 'Enter' });
      fireEvent.keyUp(retry, { key: 'Enter' });
    });
    await waitFor(() => expect(lists()).toBe(2));
    // Loading again while the retry is in flight.
    expect(screen.getByText('Loading setlists…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('Try again, answered by SETLISTS, renders the list (Constraint 4)', async () => {
    const { store, state, lists } = makeStore({ reply: 'error' });
    const { container } = renderScreen(store);
    const retry = await screen.findByRole('button', { name: 'Try again' });

    state.reply = 'list';
    act(() => retry.focus());
    act(() => {
      fireEvent.keyDown(retry, { key: 'Enter' });
      fireEvent.keyUp(retry, { key: 'Enter' });
    });
    await waitFor(() => expect(lists()).toBe(2));
    expect(await screen.findByText('Ensaio de sábado')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading setlists…')).not.toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('an ERROR with no list in flight leaves the list as it is (Constraint 4)', async () => {
    const { store, emit } = makeStore({ reply: 'list' });
    renderScreen(store);
    expect(await screen.findByText('Ensaio de sábado')).toBeInTheDocument();

    await emit(EventKind.ERROR, { message: 'unrelated', code: 'command_failed' });
    expect(screen.getByText('Ensaio de sábado')).toBeInTheDocument();
    expect(screen.queryByText("The setlists on this device couldn't be read.")).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('a failed re-list over a list already showing leaves the list in place (Constraint 4)', async () => {
    const { store, state, emit, lists } = makeStore({ reply: 'list' });
    renderScreen(store);
    expect(await screen.findByText('Ensaio de sábado')).toBeInTheDocument();

    state.reply = 'error';
    await emit(EventKind.SAVED, { bookId: 'band', commit: 'c1' });
    await waitFor(() => expect(lists()).toBe(2));
    expect(screen.getByText('Ensaio de sábado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('a SHELF_FILL ready re-lists; waiting and cloning do not (Constraint 5)', async () => {
    const { store, emit, lists } = makeStore({ reply: 'list' });
    renderScreen(store);
    expect(await screen.findByText('Ensaio de sábado')).toBeInTheDocument();
    expect(lists()).toBe(1);

    await emit(EventKind.SHELF_FILL, { bookId: 'ana', state: 'waiting', progress: 0 });
    await emit(EventKind.SHELF_FILL, { bookId: 'ana', state: 'cloning', progress: 40 });
    expect(lists()).toBe(1);

    await emit(EventKind.SHELF_FILL, { bookId: 'ana', state: 'ready', progress: 100, songs: 2 });
    await waitFor(() => expect(lists()).toBe(2));
  });

  it('the listed state is axe clean', async () => {
    const { store } = makeStore({ reply: 'list' });
    const { container } = renderScreen(store);
    expect(await screen.findByText('Ensaio de sábado')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

describe('SetlistsScreen — each row says its status (books.setlist_done)', () => {
  it('a row reads "not saved yet" for a new setlist, "unsaved changes" for an edited one, and nothing for a clean one; the word is in the row button\'s name; axe clean (Constraint 3; workflow 12 §Building one)', async () => {
    const { store } = makeStore();
    const { container } = renderScreen(store);
    const fresh = await screen.findByRole('button', { name: /Roda de domingo/ });
    expect(fresh).toHaveAccessibleName(expect.stringContaining('not saved yet'));
    expect(fresh).not.toHaveAccessibleName(expect.stringContaining('unsaved changes'));

    const edited = screen.getByRole('button', { name: /Aula de terça/ });
    expect(edited).toHaveAccessibleName(expect.stringContaining('unsaved changes'));
    expect(edited).not.toHaveAccessibleName(expect.stringContaining('not saved yet'));

    const clean = screen.getByRole('button', { name: /Ensaio de sábado/ });
    expect(clean).not.toHaveAccessibleName(expect.stringContaining('not saved yet'));
    expect(clean).not.toHaveAccessibleName(expect.stringContaining('unsaved changes'));

    // The same badge as the setlist's own; the word, not a colour, differs.
    expect(within(fresh).getByText('not saved yet')).toHaveClass('badge', 'unsaved', 'dot');
    expect(within(edited).getByText('unsaved changes')).toHaveClass('badge', 'unsaved', 'dot');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

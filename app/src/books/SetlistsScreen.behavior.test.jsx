// behavior — the Setlists destination (books.setlists_resilient) with its real
// collaborators (RAC, i18n, the loopback store) under jsdom, over a fake Worker
// as in SetlistView.behavior.test.jsx, plus an axe check of each state. Pins
// Constraint 4 (never *Loading* forever: an ERROR while a list is in flight
// shows a plain sentence and Try again; an unrelated ERROR is ignored) and
// Constraint 5 (a book landing — SHELF_FILL ready — re-lists). Workflow 12 §The
// file L34. All setlist text is written for this test.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
// `shelf` is injected as the SHELF slice (books.setlist_making: which books a
// new setlist can go in); `setlists` overrides the listed ones.
function makeStore({ reply = 'list', shelf = null, setlists = SETLISTS } = {}) {
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
          port.postMessage(event(EventKind.SETLISTS, { setlists }));
        } else if (state.reply === 'error') {
          port.postMessage(event(EventKind.ERROR, { message: 'boom', code: 'command_failed' }));
        }
      },
    };
  });
  const store = createStore(endpoint);
  if (shelf) act(() => endpoint.onmessage({ data: event(EventKind.SHELF, shelf) }));
  const emit = (kind, payload) => act(async () => workerPort.postMessage(event(kind, payload)));
  const lists = () => commands.filter((c) => c.kind === CommandKind.LIST_SETLISTS).length;
  const creates = () => commands.filter((c) => c.kind === CommandKind.CREATE_FILE);
  return { store, state, emit, lists, creates };
}

function renderScreen(store, props = {}) {
  return render(
    <ThemeRoot store={store}>
      <SetlistsScreen store={store} {...props} />
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

// books.setlist_making (workflow 12 §Building one; workflow 3 §Which book; W12
// phone #8-9): the tab's head makes a setlist — a name and, with more than one
// savable book, which one — through CREATE_FILE, and the FILE_CREATED for it
// opens the new setlist in its editor. Book titles are the boards' own.
describe('SetlistsScreen — New setlist from the tab (books.setlist_making)', () => {
  const AT = '2026-10-21T00:00:00.000Z';
  const reg = (value) => ({ value, at: AT });
  const READER = { label: reg('Songbook do Coral'), role: reg('reader'), position: reg(1) };
  const BAND = { label: reg('Banda do Bairro'), role: reg('editor'), position: reg(2) };
  // One savable book beside a reader-role one.
  const ONE = { books: { coral: READER, band: BAND }, local: {} };
  // Two savable books (My songs on the device, and the band) and a reader one.
  const TWO = {
    books: { coral: READER, band: BAND },
    local: { 'local-my-songs': { title: reg('My songs'), position: reg(3) } },
  };

  async function openDialog() {
    const button = await screen.findByRole('button', { name: 'New setlist…' });
    await act(async () => fireEvent.click(button));
    return screen.findByRole('dialog', { name: 'New setlist' });
  }

  it('one savable book: New setlist… in the head; the name focused, no Book group; Create sends CREATE_FILE at the root; its FILE_CREATED opens the editor; axe clean', async () => {
    const onOpenSetlist = vi.fn();
    const { store, emit, creates } = makeStore({ shelf: ONE });
    const { container } = renderScreen(store, { onOpenSetlist });
    const head = (await screen.findByRole('heading', { level: 1, name: 'Setlists' })).parentElement;
    expect(head).toHaveClass('setlists-head');
    expect(within(head).getByRole('button', { name: 'New setlist…' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    const dialog = await openDialog();
    const name = within(dialog).getByRole('textbox', { name: 'Setlist name' });
    await waitFor(() => expect(name).toHaveFocus());
    expect(within(dialog).queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create' })).toBeDisabled();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    await act(async () => fireEvent.change(name, { target: { value: 'Thursday lesson' } }));
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Create' })));
    expect(creates()).toHaveLength(1);
    expect(creates()[0].payload).toEqual({ bookId: 'band', kind: 'setlist', title: 'Thursday lesson' });
    expect(creates()[0].payload).not.toHaveProperty('folder');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New setlist' })).not.toBeInTheDocument());

    await emit(EventKind.FILE_CREATED, { bookId: 'band', path: 'thursday-lesson.setlist.md' });
    expect(onOpenSetlist).toHaveBeenCalledTimes(1);
    expect(onOpenSetlist).toHaveBeenCalledWith({
      bookId: 'band',
      path: 'thursday-lesson.setlist.md',
      startEditing: true,
    });
  });

  it('two savable books and a reader one: the Book group lists the two, My songs checked; the other chosen by keyboard is the one sent; axe clean', async () => {
    const { store, creates } = makeStore({ shelf: TWO });
    renderScreen(store);
    const dialog = await openDialog();
    const group = within(dialog).getByRole('radiogroup', { name: 'Book' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.closest('label').textContent)).toEqual(['Banda do Bairro', 'My songs']);
    expect(within(group).queryByRole('radio', { name: 'Songbook do Coral' })).not.toBeInTheDocument();
    expect(within(group).getByRole('radio', { name: 'My songs' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Banda do Bairro' })).not.toBeChecked();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    await act(async () =>
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Setlist name' }), {
        target: { value: 'Rehearsal' },
      }),
    );
    // The keyboard path: arrow keys move the choice within the group.
    const mine = within(group).getByRole('radio', { name: 'My songs' });
    act(() => mine.focus());
    await act(async () => fireEvent.keyDown(mine, { key: 'ArrowUp' }));
    await waitFor(() => expect(within(group).getByRole('radio', { name: 'Banda do Bairro' })).toBeChecked());
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Create' })));
    expect(creates()).toHaveLength(1);
    expect(creates()[0].payload).toEqual({ bookId: 'band', kind: 'setlist', title: 'Rehearsal' });
  });

  it('a FILE_CREATED with no create pending, for another book, or for a non-setlist opens nothing (Constraint 5)', async () => {
    const onOpenSetlist = vi.fn();
    const { store, emit } = makeStore({ shelf: TWO });
    renderScreen(store, { onOpenSetlist });
    await screen.findByText('Ensaio de sábado');
    // Nothing pending: the file view's own create.
    await emit(EventKind.FILE_CREATED, { bookId: 'band', path: 'gigs/new.setlist.md' });
    expect(onOpenSetlist).not.toHaveBeenCalled();

    // Pending for My songs: a FILE_CREATED for the band, or a README, is not it.
    const dialog = await openDialog();
    await act(async () =>
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Setlist name' }), {
        target: { value: 'Rehearsal' },
      }),
    );
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Create' })));
    await emit(EventKind.FILE_CREATED, { bookId: 'band', path: 'rehearsal.setlist.md' });
    await emit(EventKind.FILE_CREATED, { bookId: 'local-my-songs', path: 'README.md' });
    expect(onOpenSetlist).not.toHaveBeenCalled();
    await emit(EventKind.FILE_CREATED, { bookId: 'local-my-songs', path: 'rehearsal.setlist.md' });
    expect(onOpenSetlist).toHaveBeenCalledWith({
      bookId: 'local-my-songs',
      path: 'rehearsal.setlist.md',
      startEditing: true,
    });
  });

  it('no savable book: no New setlist…, the old empty sentence; savable books and no setlists: the emptyCanMake sentence; axe clean on both', async () => {
    const none = makeStore({ shelf: { books: { coral: READER }, local: {} }, setlists: [] });
    const first = renderScreen(none.store);
    expect(
      await screen.findByText('No setlists yet. Add a song to a setlist from search or the reading view.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New setlist…' })).not.toBeInTheDocument();
    expect(await checkWcag21aa(first.container)).toHaveNoViolations();
    first.unmount();

    const some = makeStore({ shelf: ONE, setlists: [] });
    const second = renderScreen(some.store);
    expect(
      await screen.findByText(
        'No setlists yet. Make one with New setlist, or add a song to a setlist from search or the reading view.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New setlist…' })).toBeInTheDocument();
    expect(await checkWcag21aa(second.container)).toHaveNoViolations();
  });
});

// behavior — the first-run empty state with its real collaborators: React Aria
// Components, the real i18n catalogue, and the real main-thread store + reducer
// over a loopback endpoint whose sent commands we capture. A fresh store (no
// SHELF, no browse, no recents) is exactly the cold start — an empty shelf and
// no recents — so SearchScreen mounts FirstRun (account.first_run, workflow 1
// §Cold; mockup W01). Axe (role/name/structure under jsdom) covers the state;
// contrast is pinned at e2e-web.

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { CommandKind } from '../worker/protocol.js';
import SearchScreen from './SearchScreen.jsx';

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  return { store, sent };
}

const lastCommand = (sent, kind) => [...sent].reverse().find((m) => m.kind === kind);

// Render SearchScreen on a cold store with spy seams for the three routed ways;
// the fourth (open the example book) goes through the store, so we read `sent`.
function renderFirstRun(props = {}) {
  const { store, sent } = makeStore();
  const calls = { write: 0, add: 0, signIn: 0 };
  const utils = render(
    <SearchScreen
      store={store}
      onWriteSong={() => (calls.write += 1)}
      onAddBook={() => (calls.add += 1)}
      onSignIn={() => (calls.signIn += 1)}
      {...props}
    />,
  );
  return { ...utils, sent, calls };
}

describe('FirstRun (behavior)', () => {
  it('shows what a book is and the four ways-in in workflow-1 order, with the My songs entry (workflow 1 §Cold, §My songs; W01)', async () => {
    const { container } = renderFirstRun();

    const region = screen.getByRole('region', { name: 'Your shelf is empty' });
    expect(
      within(region).getByText(/A book is a collection of songs/),
    ).toBeInTheDocument();

    const ways = within(region).getAllByRole('button');
    expect(ways).toHaveLength(4);
    expect(ways[0].textContent).toContain('Write a song');
    expect(ways[0].textContent).toContain('It goes into My songs');
    expect(ways[1].textContent).toContain('Add a book by its link');
    // One door for both: sign in, or make an account (account.sign_in_two_doors).
    expect(ways[2].textContent).toContain('Sign in or make an account');
    expect(ways[2].textContent).toContain('Bring back your shelf, or start one on Estante.');
    expect(ways[3].textContent).toContain('Open the example book');

    // My songs is listed from the start — a plain entry, not a control — with its
    // state carried by a word (Decision 4; mockups README L26).
    const books = screen.getByRole('region', { name: 'Books' });
    expect(within(books).getByText('My songs')).toBeInTheDocument();
    expect(
      within(books).getByText('No songs yet · your own, on this device'),
    ).toBeInTheDocument();
    expect(within(books).queryAllByRole('button')).toHaveLength(0);

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('open the example book sends OPEN_EXAMPLE_BOOK with the localised label; the other three invoke their seams (acceptance 2-3)', () => {
    const { sent, calls } = renderFirstRun();
    const region = screen.getByRole('region', { name: 'Your shelf is empty' });
    const ways = within(region).getAllByRole('button');

    act(() => fireEvent.click(ways[0]));
    act(() => fireEvent.click(ways[1]));
    act(() => fireEvent.click(ways[2]));
    expect(calls).toEqual({ write: 1, add: 1, signIn: 1 });
    // Routing the three ways does not send a worker command.
    expect(lastCommand(sent, CommandKind.OPEN_EXAMPLE_BOOK)).toBeUndefined();

    act(() => fireEvent.click(ways[3]));
    const cmd = lastCommand(sent, CommandKind.OPEN_EXAMPLE_BOOK);
    expect(cmd).toBeTruthy();
    expect(cmd.payload.title).toBe('Example Book');
    // The Worker authors the commit (account.commit_author Decision 3): the view
    // sends no author.
    expect(cmd.payload.author).toBeUndefined();
  });

  it('every way-in is reachable by keyboard (Enter activates it)', () => {
    const { sent, calls } = renderFirstRun();
    const region = screen.getByRole('region', { name: 'Your shelf is empty' });
    const ways = within(region).getAllByRole('button');

    act(() => fireEvent.keyDown(ways[0], { key: 'Enter' }));
    act(() => fireEvent.keyUp(ways[0], { key: 'Enter' }));
    expect(calls.write).toBe(1);

    act(() => fireEvent.keyDown(ways[3], { key: 'Enter' }));
    act(() => fireEvent.keyUp(ways[3], { key: 'Enter' }));
    expect(lastCommand(sent, CommandKind.OPEN_EXAMPLE_BOOK)).toBeTruthy();
  });

  // account.sign_in_two_doors; workflow 1 §Cold L25-29 (offered only while no
  // one is signed in); W01 #1.
  it('with offerSignIn={false} (signed in) there are three ways in and no sign-in row, axe clean', async () => {
    const { container } = renderFirstRun({ offerSignIn: false });
    const region = screen.getByRole('region', { name: 'Your shelf is empty' });
    const ways = within(region).getAllByRole('button');
    expect(ways.map((w) => w.querySelector('.name').textContent)).toEqual([
      'Write a song',
      'Add a book by its link',
      'Open the example book',
    ]);
    expect(within(region).queryByRole('button', { name: /Sign in or make an account/ })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

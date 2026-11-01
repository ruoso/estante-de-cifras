// Behavior test for the book's print (books.print; workflow 7 §Printing the
// book). It renders BookPrint over a loopback store whose stub worker answers
// BROWSE (the book's songs), OPEN_SOURCE (each song's text, one held back until
// released) and OPEN_SONG (one song read transposed). Real RAC + i18n; axe once
// everything is in.
//
// jsdom prints nothing and has no layout: that the links land in the PDF, and
// that the way back repeats on every page of a long song, is checked by hand
// against Chrome's print (workflow 7 §Printing the book); here the links'
// targets, the readiness gate and the screen jump are.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale, t } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import BookPrint from './BookPrint.jsx';

const BOOK = 'book-1';

// Purpose-written songs (no one's copyrighted words), fenced so they read as
// bars (memory chart-snippet-needs-a-fence).
const FIRST = ['# Harbour Lights', '- artist: Ana Lima', '- key: G', '', '## A', '```', 'G | C | D | G', '```', ''].join('\n');
const SECOND = ['# Slow Tide', '- key: C', '', '## A', '```', 'C | F | G | C', '```', ''].join('\n');

const SONGS = [
  { path: 'harbour.cifra.md', title: 'Harbour Lights', artist: 'Ana Lima', unsaved: false },
  { path: 'tide.cifra.md', title: 'Slow Tide', artist: null, unsaved: false },
];
const TEXTS = { 'harbour.cifra.md': FIRST, 'tide.cifra.md': SECOND };
// Slow Tide is read two semitones up: the print shows it as it is read.
const SONG_STATE = { 'tide.cifra.md': { transposition: 2, variations: {} } };

function installMatchMedia() {
  globalThis.matchMedia = (query) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

beforeEach(() => {
  installMatchMedia();
  setLocale('en');
  globalThis.print = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  delete globalThis.matchMedia;
  delete Element.prototype.scrollIntoView;
  vi.restoreAllMocks();
});

// `holdBack` names a song whose text is not answered until `release()`.
function makeStore({ holdBack = null } = {}) {
  let held = null;
  let port;
  const endpoint = createLoopbackEndpoint((p) => {
    port = p;
    return {
      handle(message) {
        const pl = message.payload ?? {};
        switch (message.kind) {
          case CommandKind.BROWSE:
            port.postMessage(event(EventKind.BROWSE_RESULTS, { books: [{ bookId: BOOK, count: SONGS.length, songs: SONGS }] }));
            break;
          case CommandKind.OPEN_SOURCE: {
            const reply = event(EventKind.SOURCE, { bookId: pl.bookId, path: pl.path, text: TEXTS[pl.path] ?? '' });
            if (pl.path === holdBack) held = reply;
            else port.postMessage(reply);
            break;
          }
          case CommandKind.OPEN_SONG:
            port.postMessage(event(EventKind.SONG, {
              bookId: pl.bookId, path: pl.path,
              ...(SONG_STATE[pl.path] ?? { transposition: 0, variations: {} }),
            }));
            break;
          default:
            break;
        }
      },
    };
  });
  const store = createStore(endpoint);
  const release = async () => {
    await act(async () => {
      port.postMessage(held);
    });
  };
  return { store, release };
}

function renderPrint(store, onBack = vi.fn()) {
  const utils = render(
    <ThemeRoot store={store}>
      <BookPrint store={store} bookId={BOOK} onBack={onBack} />
    </ThemeRoot>,
  );
  return { ...utils, onBack };
}

const printButton = () => screen.getByRole('button', { name: t('books.printBook') });

describe('BookPrint — the book as a songbook', () => {
  it('lists every song in the index, each a link to its own page', async () => {
    const { store } = makeStore();
    const { container } = renderPrint(store);
    await screen.findByRole('heading', { level: 2, name: 'Slow Tide' });
    const index = screen.getByRole('navigation');
    const links = within(index).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['Harbour LightsAna Lima', 'Slow Tide']);
    // Each index link points at the page that song's heading is on.
    for (const [i, link] of links.entries()) {
      const target = container.querySelector(link.getAttribute('href'));
      expect(target).not.toBeNull();
      expect(within(target).getByRole('heading', { level: 2 }).textContent).toBe(SONGS[i].title);
    }
  });

  it('gives every song a way back to the index', async () => {
    const { store } = makeStore();
    const { container } = renderPrint(store);
    await screen.findByRole('heading', { level: 2, name: 'Slow Tide' });
    const index = screen.getByRole('navigation');
    const back = screen.getAllByRole('link', { name: t('books.printBookToIndex') });
    expect(back).toHaveLength(2);
    for (const link of back) {
      expect(container.querySelector(link.getAttribute('href'))).toBe(index);
    }
  });

  it('prints each song as it is read: in its key, the transposition named', async () => {
    const { store } = makeStore();
    renderPrint(store);
    const heading = await screen.findByRole('heading', { level: 2, name: 'Slow Tide' });
    const page = heading.closest('article');
    expect(within(page).getByText(/\(\+2\)/)).toBeInTheDocument();
    // C | F | G | C read two up.
    expect([...page.querySelectorAll('.chart .g')].map((el) => el.textContent)).toEqual(['D', 'G', 'A', 'D']);
    // The artist goes under the title.
    const first = screen.getByRole('heading', { level: 2, name: 'Harbour Lights' }).closest('article');
    expect(within(first).getByText(/Ana Lima/)).toBeInTheDocument();
  });

  it('holds Print until every song is in, saying how far along it is', async () => {
    const { store, release } = makeStore({ holdBack: 'tide.cifra.md' });
    renderPrint(store);
    await screen.findByRole('heading', { level: 2, name: 'Harbour Lights' });
    expect(screen.getByRole('status')).toHaveTextContent(t('books.printBookLoading', { done: 1, total: 2 }));
    expect(printButton()).toBeDisabled();
    await release();
    await screen.findByRole('heading', { level: 2, name: 'Slow Tide' });
    expect(screen.getByRole('status')).toHaveTextContent(/2 songs, as you read them/);
    expect(printButton()).toBeEnabled();
    fireEvent.click(printButton());
    expect(globalThis.print).toHaveBeenCalledTimes(1);
  });

  it('on screen, a link scrolls to its place and leaves the address alone', async () => {
    const { store } = makeStore();
    renderPrint(store);
    await screen.findByRole('heading', { level: 2, name: 'Slow Tide' });
    const before = window.location.hash;
    const link = within(screen.getByRole('navigation')).getByRole('link', { name: 'Slow Tide' });
    fireEvent.click(link);
    expect(window.location.hash).toBe(before);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(
      screen.getByRole('heading', { level: 2, name: 'Slow Tide' }).closest('article'),
    );
  });

  it('goes back to the book', async () => {
    const { store } = makeStore();
    const { onBack } = renderPrint(store);
    await screen.findByRole('heading', { level: 2, name: 'Slow Tide' });
    fireEvent.click(screen.getByRole('button', { name: t('books.backToBook', { book: t('books.untitled') }) }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('passes axe with every song in', async () => {
    const { store } = makeStore();
    const { container } = renderPrint(store);
    await screen.findByRole('heading', { level: 2, name: 'Slow Tide' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

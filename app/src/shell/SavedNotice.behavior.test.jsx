// SavedNotice (the persona exploration of 2026-11-01): a SAVED shows *Saved to
// {book}* in a status region for a few seconds, then goes; a second save
// restarts it. Store double; purpose-written book.
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStore } from '../worker/store.js';
import { event, EventKind } from '../worker/protocol.js';
import SavedNotice, { SAVED_NOTICE_MS } from './SavedNotice.jsx';

const reg = (value) => ({ value, at: '2026-11-01T00:00:00Z' });

function makeStore() {
  const endpoint = { postMessage: () => {}, onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, emit };
}

describe('SavedNotice', () => {
  afterEach(() => vi.useRealTimers());

  it('says where a save went, then goes', () => {
    vi.useFakeTimers();
    const { store, emit } = makeStore();
    render(<SavedNotice store={store} />);
    emit(event(EventKind.SHELF, { books: { b1: { label: reg('Roda de Choro'), position: reg(0) } }, local: {} }));
    expect(screen.queryByRole('status')).toBeNull();

    emit(event(EventKind.SAVED, { bookId: 'b1', paths: ['tarde.cifra.md'], commit: 'abc' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved to Roda de Choro');

    act(() => vi.advanceTimersByTime(SAVED_NOTICE_MS - 100));
    emit(event(EventKind.SAVED, { bookId: 'b1', paths: ['tarde.cifra.md'], commit: 'def' }));
    act(() => vi.advanceTimersByTime(SAVED_NOTICE_MS - 100));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

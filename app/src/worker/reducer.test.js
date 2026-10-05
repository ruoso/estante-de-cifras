import { describe, it, expect } from 'vitest';
import { initialState, reduce } from './reducer.js';
import { event, command, EventKind, CommandKind } from './protocol.js';

// unit — the store's reducer (DIRECTION §3.7 L397-401, "only what shows it
// moves"). Each event folds into its slice; a slice that did not change keeps
// the same reference (`Object.is`), while the changed slice is a new object.
describe('worker store reducer', () => {
  it('folds a ready event into the connection and meta slices', () => {
    const meta = { schemaVersion: 1, protocolVersion: 1, createdAt: 123 };
    // A ready event with no persistence result defaults `persisted` to null.
    const next = reduce(initialState, event(EventKind.READY, { meta }));
    expect(next.connection).toEqual({
      status: 'ready',
      error: null,
      persisted: null,
    });
    expect(next.meta).toEqual(meta);
  });

  it('carries the storage-durability result onto the connection slice (storage.fs)', () => {
    // Pins that `persisted` from bring-up (DIRECTION §3 L114-115) rides the
    // ready payload into the connection slice: true (granted), false (denied),
    // null (unavailable) each surface unchanged.
    const meta = { schemaVersion: 1, protocolVersion: 1, createdAt: 123 };
    for (const persisted of [true, false, null]) {
      const next = reduce(initialState, event(EventKind.READY, { meta, persisted }));
      expect(next.connection.persisted).toBe(persisted);
    }
  });

  it('leaves an untouched slice referentially equal while moving the changed one', () => {
    // Start from a ready state so meta holds a real object reference.
    const meta = { schemaVersion: 1, protocolVersion: 1, createdAt: 123 };
    const ready = reduce(initialState, event(EventKind.READY, { meta }));

    // An error touches only the connection slice.
    const errored = reduce(
      ready,
      event(EventKind.ERROR, { message: 'boom', code: 'command_failed' }),
    );

    // The changed slice is a new object…
    expect(errored.connection).not.toBe(ready.connection);
    expect(errored.connection).toEqual({
      status: 'error',
      error: { message: 'boom', code: 'command_failed' },
    });
    // …and the untouched slice keeps its exact reference (the Object.is
    // bail-out that stops an unrelated component re-rendering).
    expect(Object.is(errored.meta, ready.meta)).toBe(true);
  });

  it('folds a save outcome into the save slice under its book, as a word (storage.working_copy)', () => {
    const saved = reduce(
      initialState,
      event(EventKind.SAVED, { bookId: 'book-1', commit: 'abc123', pushed: true }),
    );
    expect(saved.save['book-1']).toEqual({
      status: 'saved',
      commit: 'abc123',
      pushed: true,
    });

    // A discard and a refusal carry their own words; a refusal names the file,
    // reason and first marker line (spec §11.12.3).
    const discarded = reduce(saved, event(EventKind.DISCARDED, { bookId: 'book-1' }));
    expect(discarded.save['book-1']).toEqual({ status: 'discarded' });

    const refused = reduce(
      discarded,
      event(EventKind.SAVE_REFUSED, {
        bookId: 'book-1',
        path: 'song.cifra.md',
        reason: 'marked',
        line: 3,
        marker: '<<<<<<< ours',
      }),
    );
    expect(refused.save['book-1']).toEqual({
      status: 'refused',
      path: 'song.cifra.md',
      reason: 'marked',
      line: 3,
      marker: '<<<<<<< ours',
    });
  });

  it('keeps an untouched book’s save entry referentially equal (only what shows it moves)', () => {
    const a = reduce(
      initialState,
      event(EventKind.SAVED, { bookId: 'book-a', commit: 'a1', pushed: true }),
    );
    const entryA = a.save['book-a'];
    // A save in a different book moves only that book's entry.
    const b = reduce(a, event(EventKind.SAVED, { bookId: 'book-b', commit: 'b1', pushed: false }));
    expect(b.save['book-b']).toEqual({ status: 'saved', commit: 'b1', pushed: false });
    // book-a's entry keeps its exact reference (the Object.is bail-out), as do
    // the unrelated connection/meta slices.
    expect(Object.is(b.save['book-a'], entryA)).toBe(true);
    expect(Object.is(b.connection, a.connection)).toBe(true);
  });

  it('ignores a save/discard/refused event with no bookId (no churn)', () => {
    expect(reduce(initialState, event(EventKind.SAVED, {}))).toBe(initialState);
    expect(reduce(initialState, event(EventKind.DISCARDED, {}))).toBe(initialState);
    expect(reduce(initialState, event(EventKind.SAVE_REFUSED, {}))).toBe(initialState);
  });

  it('returns the same state reference for a command, a malformed message, or an unknown event kind', () => {
    expect(reduce(initialState, command(CommandKind.OPEN))).toBe(initialState);
    expect(reduce(initialState, null)).toBe(initialState);
    expect(reduce(initialState, {})).toBe(initialState);
    // Forward-compatible: an event kind a later build adds is ignored, not a
    // crash, and does not churn state.
    expect(reduce(initialState, event('some_future_kind', {}))).toBe(
      initialState,
    );
  });
});

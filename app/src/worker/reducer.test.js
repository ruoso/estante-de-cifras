import { describe, it, expect } from 'vitest';
import { initialState, reduce } from './reducer.js';
import { event, command, EventKind, CommandKind } from './protocol.js';

// unit — the store's reducer (DIRECTION §3.7 L397-401, "only what shows it
// moves"). Each event folds into its slice; a slice that did not change keeps
// the same reference (`Object.is`), while the changed slice is a new object.
describe('worker store reducer', () => {
  it('folds a ready event into the connection and meta slices', () => {
    const meta = { schemaVersion: 1, protocolVersion: 1, createdAt: 123 };
    const next = reduce(initialState, event(EventKind.READY, { meta }));
    expect(next.connection).toEqual({ status: 'ready', error: null });
    expect(next.meta).toEqual(meta);
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

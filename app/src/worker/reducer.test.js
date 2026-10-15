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

  it('starts with an empty preferences slice (shell.tokens consumer seam)', () => {
    // Nothing chosen and no producer yet: the theme resolves to automatic.
    expect(initialState.preferences).toEqual({});
  });

  it('folds a preferences event into the preferences slice, leaving others stable', () => {
    // The home book's preferences.json as a flat map of {value, at} registers
    // (home-book-format §4.1). Pins the consumer contract the deferred producer
    // (storage.preferences_surface) will feed.
    const registers = {
      theme: { value: 'palco', at: '2026-10-05T14:30:00.000Z' },
      language: { value: 'pt-BR', at: '2026-10-05T14:29:12.500Z' },
    };
    const next = reduce(initialState, event(EventKind.PREFERENCES, registers));
    expect(next.preferences).toEqual(registers);
    // Only the preferences slice moved; the rest keep their references
    // ("only what shows it moves" — DIRECTION §3.7 L410-414).
    expect(Object.is(next.connection, initialState.connection)).toBe(true);
    expect(Object.is(next.save, initialState.save)).toBe(true);

    // An absent payload resets the slice to empty.
    expect(reduce(next, event(EventKind.PREFERENCES)).preferences).toEqual({});
  });

  it('leaves the preferences slice referentially stable on an unrelated event', () => {
    const withPrefs = reduce(
      initialState,
      event(EventKind.PREFERENCES, { theme: { value: 'caderno', at: 't' } }),
    );
    const after = reduce(
      withPrefs,
      event(EventKind.SAVED, { bookId: 'book-1', commit: 'c1', pushed: true }),
    );
    expect(Object.is(after.preferences, withPrefs.preferences)).toBe(true);
  });

  it('folds a song log into the history slice under its book and path (storage.history)', () => {
    // SONG_LOG sets `entries` under [bookId][path], leaving `versions`/`restored`
    // at their empty defaults. Pins workflow 14 L161-173 (the per-entry shape the
    // view reads) through the slice that carries it.
    const entries = [
      { commit: 'c2', short: 'c2', path: 's.cifra.md', isMerge: false, resolution: false },
      { commit: 'c1', short: 'c1', path: 's.cifra.md', isMerge: false, resolution: false },
    ];
    const next = reduce(
      initialState,
      event(EventKind.SONG_LOG, { bookId: 'book-1', path: 's.cifra.md', entries }),
    );
    expect(next.history['book-1']['s.cifra.md']).toEqual({
      entries,
      versions: {},
      restored: 0,
    });
  });

  it('folds a version into the history slice, preserving entries, and a restore bumps its token', () => {
    const entries = [{ commit: 'c1', short: 'c1', path: 's.cifra.md', isMerge: false, resolution: false }];
    const logged = reduce(
      initialState,
      event(EventKind.SONG_LOG, { bookId: 'book-1', path: 's.cifra.md', entries }),
    );
    // VERSION caches the exact bytes under the commit, keeping the entries list.
    const withVersion = reduce(
      logged,
      event(EventKind.VERSION, {
        bookId: 'book-1',
        path: 's.cifra.md',
        commit: 'c1',
        text: 'song bytes\n',
      }),
    );
    expect(withVersion.history['book-1']['s.cifra.md'].entries).toBe(entries);
    expect(withVersion.history['book-1']['s.cifra.md'].versions).toEqual({
      c1: 'song bytes\n',
    });

    // RESTORED bumps a monotonic token (so restoring the same version twice still
    // moves the slice and reopens the save sheet), preserving entries/versions.
    const restored = reduce(
      withVersion,
      event(EventKind.RESTORED, { bookId: 'book-1', path: 's.cifra.md' }),
    );
    expect(restored.history['book-1']['s.cifra.md'].restored).toBe(1);
    const restoredAgain = reduce(
      restored,
      event(EventKind.RESTORED, { bookId: 'book-1', path: 's.cifra.md' }),
    );
    expect(restoredAgain.history['book-1']['s.cifra.md'].restored).toBe(2);
    expect(restoredAgain.history['book-1']['s.cifra.md'].versions).toEqual({
      c1: 'song bytes\n',
    });
  });

  it('folds a book log into the bookLog slice and keeps an untouched song path/book stable', () => {
    const entries = [{ commit: 'c1', short: 'c1', path: 's.cifra.md', isMerge: false, resolution: false }];
    const logged = reduce(
      initialState,
      event(EventKind.SONG_LOG, { bookId: 'book-1', path: 's.cifra.md', entries }),
    );
    const songEntry = logged.history['book-1']['s.cifra.md'];
    const commits = [
      { commit: 'c2', short: 'c2', isMerge: true, files: [{ path: 's.cifra.md', status: 'modified' }] },
      { commit: 'c1', short: 'c1', isMerge: false, files: [{ path: 's.cifra.md', status: 'added' }] },
    ];
    const next = reduce(logged, event(EventKind.BOOK_LOG, { bookId: 'book-1', commits }));
    expect(next.bookLog['book-1']).toEqual({ commits });
    // Only the bookLog slice moved; the history slice (a different concern) keeps
    // its references ("only what shows it moves" — DIRECTION §3.7 L410-414).
    expect(Object.is(next.history, logged.history)).toBe(true);
    expect(Object.is(next.history['book-1']['s.cifra.md'], songEntry)).toBe(true);
  });

  it('keeps an untouched song path referentially equal when another path logs (only what shows it moves)', () => {
    const a = reduce(
      initialState,
      event(EventKind.SONG_LOG, { bookId: 'book-1', path: 'a.cifra.md', entries: [] }),
    );
    const entryA = a.history['book-1']['a.cifra.md'];
    const b = reduce(
      a,
      event(EventKind.SONG_LOG, { bookId: 'book-1', path: 'b.cifra.md', entries: [] }),
    );
    // b's path is new; a's path keeps its exact reference, as does the bookLog slice.
    expect(Object.is(b.history['book-1']['a.cifra.md'], entryA)).toBe(true);
    expect(Object.is(b.bookLog, initialState.bookLog)).toBe(true);
  });

  it('ignores a history event missing its bookId/path/commit (no churn)', () => {
    expect(reduce(initialState, event(EventKind.SONG_LOG, { bookId: 'b' }))).toBe(initialState);
    expect(reduce(initialState, event(EventKind.VERSION, { bookId: 'b', path: 'p' }))).toBe(
      initialState,
    );
    expect(reduce(initialState, event(EventKind.RESTORED, { path: 'p' }))).toBe(initialState);
    expect(reduce(initialState, event(EventKind.BOOK_LOG, {}))).toBe(initialState);
  });

  // sync.fork_follow AC6: the `originals` slice — a fork's original counted on a
  // pass (workflow 11 line 46) or gone (:51-54), whole-entry per fork.
  it('folds ORIGINAL into the originals slice per fork, leaving other forks and slices untouched', () => {
    expect(initialState.originals).toEqual({});
    const a = reduce(
      initialState,
      event(EventKind.ORIGINAL, { bookId: 'fork-1', newSaves: 3, gone: false }),
    );
    expect(a.originals['fork-1']).toEqual({ newSaves: 3, gone: false });
    expect(Object.is(a.sync, initialState.sync)).toBe(true);

    const b = reduce(a, event(EventKind.ORIGINAL, { bookId: 'fork-2', newSaves: 0, gone: true }));
    expect(b.originals['fork-2']).toEqual({ newSaves: 0, gone: true });
    expect(Object.is(b.originals['fork-1'], a.originals['fork-1'])).toBe(true);

    // A count clears after a bring-in: the whole entry is replaced.
    const c = reduce(b, event(EventKind.ORIGINAL, { bookId: 'fork-1', newSaves: 0, gone: false }));
    expect(c.originals['fork-1']).toEqual({ newSaves: 0, gone: false });

    // Missing fields default; a payload with no bookId does not churn.
    expect(reduce(initialState, event(EventKind.ORIGINAL, { bookId: 'f' })).originals.f).toEqual({
      newSaves: 0,
      gone: false,
    });
    expect(reduce(initialState, event(EventKind.ORIGINAL, { newSaves: 2 }))).toBe(initialState);
  });

  // books.fork: the original's id leaves the shelf when it becomes its fork, so
  // its sync fact and original count go with it (no lingering out-of-step mark).
  it('drops the original id from sync and originals on BOOK_FORKED, leaving the rest', () => {
    const a = [
      event(EventKind.SYNC, { bookId: 'orig', phase: 'cannot_save', savesWaiting: 1 }),
      event(EventKind.SYNC, { bookId: 'other', phase: 'in_step' }),
      event(EventKind.ORIGINAL, { bookId: 'orig', newSaves: 2, gone: false }),
    ].reduce(reduce, initialState);
    const b = reduce(a, event(EventKind.BOOK_FORKED, { previousBookId: 'orig', bookId: 'fork', via: 'service' }));
    expect(b.sync.orig).toBeUndefined();
    expect(b.originals.orig).toBeUndefined();
    expect(Object.is(b.sync.other, a.sync.other)).toBe(true);
    // Nothing to drop: no churn.
    expect(reduce(initialState, event(EventKind.BOOK_FORKED, { previousBookId: 'x', bookId: 'y' }))).toBe(
      initialState,
    );
  });

  // books.fork: a search/browse/recent row listed before the fork opens the
  // fork's song, not the original's vanished copy.
  it('re-points search, browse and recent rows from the original to the fork on BOOK_FORKED', () => {
    const a = [
      event(EventKind.SEARCH_RESULTS, {
        query: 'roda',
        results: [{ bookId: 'orig', path: 'roda.cifra.md' }, { bookId: 'other', path: 'x.cifra.md' }],
      }),
      event(EventKind.BROWSE_RESULTS, { books: [{ bookId: 'orig', songs: [] }] }),
      event(EventKind.RECENTS, { recents: [{ bookId: 'orig', path: 'roda.cifra.md' }] }),
    ].reduce(reduce, initialState);
    const b = reduce(a, event(EventKind.BOOK_FORKED, { previousBookId: 'orig', bookId: 'fork' }));
    expect(b.search.results.map((r) => r.bookId)).toEqual(['fork', 'other']);
    expect(b.search.query).toBe('roda');
    expect(b.browse.books[0].bookId).toBe('fork');
    expect(b.recents[0]).toEqual({ bookId: 'fork', path: 'roda.cifra.md' });
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

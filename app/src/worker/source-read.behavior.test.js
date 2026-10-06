// Behavior — the OPEN_SOURCE read-back seam the editor introduces (songs.editor
// Decision 4; the read-back storage.working_copy left out). Drives the real
// Worker logic in-process over a fake IndexedDB and the Web Locks shim, exactly
// as working-copy.behavior.test.js does: a WRITE then an OPEN_SOURCE must hand
// the view the exact working-copy bytes through a SOURCE event; a path with no
// working-copy file must report an ERROR, not throw across the port. The fixture
// is a purpose-written song.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';

const until = (fn) => vi.waitFor(fn, { timeout: 8000, interval: 25 });

// WRITE emits no event; it queues its work behind the book lock, so wait for the
// lock to drain before reading back (mirrors working-copy.behavior.test.js).
async function settled(bookId) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await navigator.locks.request(`book:${bookId}`, { mode: 'exclusive' }, () => {});
  await Promise.resolve();
}

const SONG = ['# Harbour Lights', '- artist: The Quay', '', '## Intro', '```', 'Am | Dm | G7 | C', '```', ''].join('\n');

function setup() {
  const idb = new IDBFactory();
  const name = `src-${Math.random().toString(36).slice(2)}`;
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  const store = createStore(endpoint);
  return { store };
}

describe('OPEN_SOURCE read-back', () => {
  let restoreLocks;
  beforeEach(() => {
    restoreLocks = installWebLocks();
  });
  afterEach(() => {
    restoreLocks();
  });

  it('hands the editor the exact working-copy bytes after a WRITE', async () => {
    const { store } = setup();
    const bookId = 'local-harbour';
    const path = 'harbour-lights.cifra.md';

    store.open();
    await until(() => expect(store.slice('connection').status).toBe('ready'));

    store.send(command(CommandKind.WRITE, { bookId, path, text: SONG }));
    await settled(bookId);

    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    await until(() => expect(store.slice('source')[bookId]?.[path]?.text).toBe(SONG));
  });

  it('reports an ERROR for a path with no working-copy file, without throwing', async () => {
    const { store } = setup();
    store.open();
    await until(() => expect(store.slice('connection').status).toBe('ready'));

    store.send(command(CommandKind.OPEN_SOURCE, { bookId: 'local-harbour', path: 'nope.cifra.md' }));
    await until(() => expect(store.slice('connection').status).toBe('error'));
    // The source slice is left untouched — no partial entry for the missing path.
    expect(store.slice('source')['local-harbour']?.['nope.cifra.md']).toBeUndefined();
  });
});

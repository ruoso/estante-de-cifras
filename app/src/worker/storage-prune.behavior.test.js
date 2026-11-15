// Behavior (Worker) — the storage clean-up (storage-prune.js), driven through
// the loopback the way the app runs it. The scenario is the one that filled a
// device's quota: the app is closed with an upload preview still open (its
// scratch repo left behind), and a book holds a file stored, as before
// fs.js kept only a file's own bytes, with a whole larger buffer. When the app
// opens again, the clean-up removes the scratch repo and shrinks the record —
// and the song still opens exactly as it was.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';

import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { createZip } from './book-zip.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { storedFileBytes } from '../test/stored-file-bytes.js';

const IDENTITY = { id: 'u_tester', name: 'A Tester' };
const SONG = ['# Partida', '', '## A', '```', 'Dm | A7 | % | Dm', '```', ''].join('\n');
const rand = () => Math.random().toString(36).slice(2);
const enc = (s) => new TextEncoder().encode(s);
const WAIT = { timeout: 8000 };

// One Worker over a device's storage (`idb`, `name`): a second call with the
// same pair is the app opened again.
function openWorker(idb, name, prune) {
  const events = [];
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: async () => ({ ok: false, status: 404, json: async () => null }), prune }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  const awaitEvent = async (kind, match = () => true) => {
    let hit;
    await waitFor(() => {
      hit = [...events].reverse().find((e) => e.kind === kind && match(e.payload));
      expect(hit).toBeTruthy();
    }, WAIT);
    return hit.payload;
  };
  return { events, send, awaitEvent };
}

// What the device's filesystem holds, read the way the tests elsewhere read it:
// a filesystem instance of its own over the same storage, used only to read.
const readFs = (idb, name) => createFileSystem(`${name}-fs`, { indexedDB: idb });

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

describe('storage clean-up when the app opens again', () => {
  it('removes a scratch repo left by an open preview and shrinks an oversized record; the song still opens', async () => {
    const idb = new IDBFactory();
    const name = `prune-${rand()}`;
    {
      const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
      const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
      await createHomeBook({ fs, git, locks: createBookLocks({ navigator }) }).ensureDeviceId({ idb, name });
    }

    // The app, first time: a book with one song, and an upload previewed but
    // never imported or cancelled — then the app is closed.
    const first = openWorker(idb, name, { firstDelayMs: 60 * 60 * 1000 });
    first.send(command(CommandKind.OPEN, {}));
    await first.awaitEvent(EventKind.READY);
    first.send(command(CommandKind.CREATE_BOOK, { title: 'Caderno', author: IDENTITY }));
    const { bookId } = await first.awaitEvent(EventKind.BOOK_CREATED);
    first.send(command(CommandKind.WRITE, { bookId, path: 'partida.cifra.md', text: SONG }));
    await new Promise((r) => setTimeout(r, 0));
    await navigator.locks.request(`book:${bookId}`, { mode: 'exclusive' }, () => {});
    first.send(command(CommandKind.SAVE, { bookId, paths: ['partida.cifra.md'], message: 'save', author: IDENTITY }));
    await first.awaitEvent(EventKind.SAVED);
    const zip = new Uint8Array(await (await createZip([{ name: 'chegada.cifra.md', bytes: enc(SONG.replace('Partida', 'Chegada')) }])).arrayBuffer());
    first.send(command(CommandKind.PREVIEW_UPLOAD, { target: { kind: 'new' }, bytes: zip }));
    const preview = await first.awaitEvent(EventKind.UPLOAD_PREVIEW);
    // The superblock is saved half a second after the last change.
    await new Promise((r) => setTimeout(r, 700));

    // The song's record, stored the old way: its bytes as a window onto a
    // megabyte, which IndexedDB keeps whole.
    const fs = readFs(idb, name);
    const dir = `/books/${bookId}`;
    const path = `${dir}/partida.cifra.md`;
    expect(await fs.promises.readdir('/uploads')).toEqual([preview.uploadId]);
    const { ino } = await fs.promises.stat(path);
    const big = new Uint8Array(1024 * 1024);
    big.set(enc(SONG), 4096);
    await new Promise((resolve, reject) => {
      const open = idb.open(`${name}-fs`);
      open.onsuccess = () => {
        const tx = open.result.transaction(`${name}-fs_files`, 'readwrite');
        tx.objectStore(`${name}-fs_files`).put(big.subarray(4096, 4096 + enc(SONG).length), ino);
        tx.oncomplete = () => {
          open.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    const before = await storedFileBytes(idb, `${name}-fs`);
    expect(before).toBeGreaterThan(1024 * 1024);

    // The app opened again: the clean-up runs (here at once, and any upload
    // not in use counts as stale).
    const again = openWorker(idb, name, { firstDelayMs: 0, staleUploadMs: 0 });
    again.send(command(CommandKind.OPEN, {}));
    await again.awaitEvent(EventKind.READY);
    await waitFor(async () => {
      expect(await storedFileBytes(idb, `${name}-fs`)).toBeLessThan(before - 1024 * 1000);
    }, WAIT);
    await waitFor(async () => {
      expect(await readFs(idb, name).promises.readdir('/uploads')).toEqual([]);
    }, WAIT);

    // And the song opens as it was.
    again.send(command(CommandKind.OPEN_SOURCE, { bookId, path: 'partida.cifra.md' }));
    const source = await again.awaitEvent(EventKind.SOURCE, (p) => p.bookId === bookId && p.path === 'partida.cifra.md');
    expect(source.text).toBe(SONG);
  }, 20000);
});

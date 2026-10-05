// behavior — the search index built and kept in the real Worker logic
// in-process (storage.index). Runs the genuine async path: the loopback
// transport (structuredClone + microtask), a fresh fake IndexedDB per test, the
// Web-Locks shim, the real filesystem and git layer, and a local git-HTTP remote
// to seed a book. No network beyond that local remote — search itself makes no
// request (workflow 2 L152-155, "Offline"). All song text is written for this
// test (no-song-text rule). Pins:
//   - built in the Worker from a book → DIRECTION §3.7 L408, workflow 2 L22-24;
//   - updated on an unsaved edit → DIRECTION §3 L116-117, `.tji` "unsaved edits";
//   - updated on save / discard → `.tji` "updated on save", workflow 4;
//   - kept across a restart, keyed by blob hash → `.tji` "kept across a restart
//     … keyed by blob hash so unchanged files are not re-read";
//   - build status → workflow 2 L159-162.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { parse as realParse } from 'cifra-md';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

const FENCE = '```';
const song = (lines) => lines.join('\n') + '\n';
const IDENTITY = { id: 'u_8f3a21', name: 'A Tester' };

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

// vi.waitFor must read only already-folded store state (never re-touch the
// shared lightning-fs in the loop); a few of the helpers below re-send a SEARCH
// command each poll, which is a port message, not a filesystem read.
const until = (fn) => vi.waitFor(fn, { timeout: 8000, interval: 25 });

async function setup() {
  const remote = await startGitHttpRemote();
  const idb = new IDBFactory();
  const name = `idx-${Math.random().toString(36).slice(2)}`;
  const bookId = 'book-1';
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({
    fs,
    http: createGitHttpClient({ fetch: globalThis.fetch }),
  });
  const dir = git.bookDir(bookId);
  await git.clone({ dir, url: remote.url });

  // A fresh Worker logic + store over the shared idb/name (a "restart" is a
  // second one of these). The parse spy proves content-addressing.
  function makeStore(parseFn) {
    const parseSpy = vi.fn(parseFn ?? realParse);
    const endpoint = createLoopbackEndpoint((port) =>
      createWorkerLogic(port, {
        indexedDB: idb,
        name,
        fetch: globalThis.fetch,
        parse: parseSpy,
      }),
    );
    return { store: createStore(endpoint), parseSpy };
  }

  return {
    remote,
    bookId,
    dir,
    makeStore,
    // Test-side write into the book's working tree (coherent with the Worker's
    // fs over the one backing store). Used BEFORE open to seed a book's songs.
    writeSong: (path, text) => fs.promises.writeFile(`${dir}/${path}`, text),
    async cleanup() {
      await remote.stop();
    },
  };
}

// Re-send SEARCH each poll until the given predicate over the results holds.
async function searchUntil(store, query, predicate) {
  await until(() => {
    store.send(command(CommandKind.SEARCH, { query }));
    const slice = store.slice('search');
    expect(slice.query).toBe(query);
    expect(predicate(slice.results)).toBe(true);
  });
  return store.slice('search').results;
}

describe('search index (behavior)', () => {
  it('builds from a book on open and returns a ranked result with its location', async () => {
    const ctx = await setup();
    try {
      ctx.writeSong(
        'verso.cifra.md',
        song([
          '# Coração Valente',
          '- artist: Banda Teste',
          '',
          '## Verso',
          FENCE,
          'G           D',
          'Era uma vez um coração',
          FENCE,
        ]),
      );
      const { store } = ctx.makeStore();
      store.open();
      await until(() => expect(store.slice('index')[ctx.bookId]).toBe('ready'));

      // `coracao` (no accents) finds the song; the result carries its location.
      const results = await searchUntil(store, 'coracao', (rs) =>
        rs.some((r) => r.path === 'verso.cifra.md'),
      );
      const hit = results.find((r) => r.path === 'verso.cifra.md');
      expect(hit.bookId).toBe(ctx.bookId);
      expect(hit.title).toBe('Coração Valente');
      expect(hit.artist).toBe('Banda Teste');
    } finally {
      await ctx.cleanup();
    }
  });

  it('emits INDEX_STATUS building then ready for a book', async () => {
    const ctx = await setup();
    try {
      ctx.writeSong('a.cifra.md', song(['# Uma', '## A', FENCE, 'C', FENCE]));
      const { store } = ctx.makeStore();

      const states = [];
      store.subscribe(() => {
        const s = store.slice('index')[ctx.bookId];
        if (s && states[states.length - 1] !== s) states.push(s);
      });

      store.open();
      await until(() => expect(store.slice('index')[ctx.bookId]).toBe('ready'));
      expect(states).toEqual(['building', 'ready']);
    } finally {
      await ctx.cleanup();
    }
  });

  it('finds a title typed but not saved (covers the working copy)', async () => {
    const ctx = await setup();
    try {
      const { store } = ctx.makeStore();
      store.open();
      await until(() => expect(store.slice('index')[ctx.bookId]).toBe('ready'));

      // WRITE only — no save. The new title must be findable immediately.
      store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: 'rascunho.cifra.md',
          text: song(['# Rascunho Secreto', '## A', FENCE, 'Am', FENCE]),
        }),
      );

      const results = await searchUntil(store, 'rascunho', (rs) =>
        rs.some((r) => r.path === 'rascunho.cifra.md'),
      );
      expect(results.find((r) => r.path === 'rascunho.cifra.md').title).toBe(
        'Rascunho Secreto',
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('re-indexes on save and drops a discarded never-saved file', async () => {
    const ctx = await setup();
    try {
      const { store } = ctx.makeStore();
      store.open();
      await until(() => expect(store.slice('index')[ctx.bookId]).toBe('ready'));

      // Save path: write then SAVE; the saved (canonical) song is findable.
      const savedPath = 'guardada.cifra.md';
      store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: savedPath,
          text: song(['# Guardada', '## A', FENCE, 'C   G', 'letra', FENCE]),
        }),
      );
      store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: [savedPath],
          message: 'add song',
          author: IDENTITY,
        }),
      );
      await until(() => expect(store.slice('save')[ctx.bookId]?.status).toBe('saved'));
      await searchUntil(store, 'guardada', (rs) =>
        rs.some((r) => r.path === savedPath),
      );

      // Discard path: write a never-saved song, confirm it is found, discard it,
      // then it is gone from results.
      const draftPath = 'descartada.cifra.md';
      store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: draftPath,
          text: song(['# Descartavel', '## A', FENCE, 'Em', FENCE]),
        }),
      );
      await searchUntil(store, 'descartavel', (rs) =>
        rs.some((r) => r.path === draftPath),
      );

      store.send(
        command(CommandKind.DISCARD, { bookId: ctx.bookId, paths: [draftPath] }),
      );
      await searchUntil(store, 'descartavel', (rs) =>
        rs.every((r) => r.path !== draftPath),
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('keeps the index across a restart without re-parsing an unchanged file', async () => {
    const ctx = await setup();
    try {
      ctx.writeSong(
        'estavel.cifra.md',
        song(['# Estável', '- artist: Autor', '## A', FENCE, 'G   C', 'oi', FENCE]),
      );

      // First session: builds the index (parses the song once).
      const first = ctx.makeStore();
      first.store.open();
      await until(() =>
        expect(first.store.slice('index')[ctx.bookId]).toBe('ready'),
      );
      await searchUntil(first.store, 'estavel', (rs) =>
        rs.some((r) => r.path === 'estavel.cifra.md'),
      );
      expect(first.parseSpy.mock.calls.length).toBeGreaterThan(0);

      // Restart: a fresh Worker logic over the SAME database and filesystem. The
      // index is rebuilt from the persisted records; the unchanged file's blob
      // oid is recognised, so it is not re-parsed (Decision 3).
      const second = ctx.makeStore();
      second.store.open();
      await until(() =>
        expect(second.store.slice('index')[ctx.bookId]).toBe('ready'),
      );
      const results = await searchUntil(second.store, 'estavel', (rs) =>
        rs.some((r) => r.path === 'estavel.cifra.md'),
      );
      expect(results.find((r) => r.path === 'estavel.cifra.md').title).toBe(
        'Estável',
      );
      // The second session re-parsed nothing: the oid was unchanged.
      expect(second.parseSpy).not.toHaveBeenCalled();
    } finally {
      await ctx.cleanup();
    }
  });
});

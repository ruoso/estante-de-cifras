// behavior — the default-shape cache (home-book §4.6) through the real Worker
// logic, over the in-process loopback rig (as recents.behavior.test.js): a fake
// IndexedDB, the shared lightning-fs, a real git-HTTP remote for the books.
// Saving a song searches its chords' default shapes in all twelve keys on the
// instrument in use and keeps them in the home book's
// shapes-default-cache.json, in one auto-commit, surfacing the table on the
// roster entry; a save that finds nothing new commits nothing. Songs are
// written for the test (no-song-text rule).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { log as gitLog } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { HOME_BOOK_ID } from './home-book.js';
import { parse as parseSettings } from './home-book-canonical.js';
import { STANDARD_INSTRUMENT_ID } from './instruments.js';
import { CACHE_FILE } from './default-shape-fill.js';
import { SHAPE_CACHE_SALT, chordKeyOf } from '../core/shape-cache.js';
import { parseChord } from '../core/notation/parse.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

const until = (fn) => vi.waitFor(fn, { timeout: 20000, interval: 25 });
const FENCE = '```';
const BOOK = 'book-1';
const TUNING = 'E2 A2 D3 G3 B3 E4';
const IDENTITY = { id: 'u_8f3a21', name: 'A Tester' };
const song = (title, chart) => [`# ${title}`, '## A', FENCE, chart, FENCE, ''].join('\n');
const key = (symbol) => chordKeyOf(parseChord(symbol).chord);

async function setup() {
  const remote = await startGitHttpRemote();
  const idb = new IDBFactory();
  const name = `dsc-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const homeDir = git.bookDir(HOME_BOOK_ID);
  await git.clone({ dir: homeDir, url: remote.url });
  await git.clone({ dir: git.bookDir(BOOK), url: remote.url });

  const store = createStore(
    createLoopbackEndpoint((port) => createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch })),
  );
  store.open();
  await until(() => expect(store.slice('index')[BOOK]).toBe('ready'));
  // The author's name is asked once, before the first save (workflow 4).
  store.send(command(CommandKind.SET_IDENTITY_NAME, { name: IDENTITY.name }));
  await until(() => expect(store.slice('preferences')?.authorName?.value).toBe(IDENTITY.name));

  return {
    store,
    // The home book's commits whose message names the cache file.
    async cacheCommits() {
      const commits = await gitLog({ fs, dir: homeDir });
      return commits.filter((c) => c.commit.message.includes(CACHE_FILE)).length;
    },
    async cacheFile() {
      try {
        return parseSettings(await fs.promises.readFile(`${homeDir}/${CACHE_FILE}`, 'utf8'));
      } catch {
        return null;
      }
    },
    // Write, wait for the write's re-index, then save and wait for THIS save's
    // SAVED: the Worker does not serialise commands, and the save slice still
    // reads `saved` from the save before.
    async save(path, text) {
      const seen = [];
      const stop = store.subscribeEvents((m) => seen.push(m));
      try {
        store.send(command(CommandKind.WRITE, { bookId: BOOK, path, text }));
        await until(() =>
          expect(seen.some((m) => m.kind === EventKind.INDEX_STATUS && m.payload.bookId === BOOK)).toBe(true),
        );
        store.send(command(CommandKind.SAVE, { bookId: BOOK, paths: [path], message: 'save' }));
        await until(() =>
          expect(seen.some((m) => m.kind === EventKind.SAVED && m.payload.paths?.includes(path))).toBe(true),
        );
      } finally {
        stop?.();
      }
    },
    cleanup: () => remote.stop(),
  };
}

// The standard guitar's surfaced table: the instrument in use with none set up.
const surfacedTable = (store) => store.slice('instruments')?.standard?.defaultShapes ?? null;

describe('the default-shape cache (behavior)', () => {
  it('a save keeps the song’s default shapes, in all twelve keys, in the home book, and surfaces them', async () => {
    const ctx = await setup();
    try {
      await ctx.save('tarde.cifra.md', song('Tarde', 'C | G'));
      await until(async () => expect(await ctx.cacheCommits()).toBe(1));

      const file = await ctx.cacheFile();
      const reg = file[STANDARD_INSTRUMENT_ID][TUNING][SHAPE_CACHE_SALT];
      expect(typeof reg.at).toBe('string');
      for (const symbol of ['C', 'G', 'D', 'A', 'Bb', 'F']) expect(reg.value.shapes[key(symbol)]).toBeTruthy();

      // The roster entry carries the stored table, so a read finds it searched.
      await until(() => expect(surfacedTable(ctx.store)).toEqual(reg.value));
    } finally {
      await ctx.cleanup();
    }
  }, 60000);

  it('a save that finds nothing new commits nothing; one with a new chord commits once more', async () => {
    const ctx = await setup();
    try {
      await ctx.save('a.cifra.md', song('Uma', 'C | G'));
      await until(async () => expect(await ctx.cacheCommits()).toBe(1));
      // The same chords in another song, then a new chord: fills run one at a
      // time, so once the third save's commit lands the second's fill is done.
      await ctx.save('b.cifra.md', song('Duas', 'G | C'));
      await ctx.save('c.cifra.md', song('Tres', 'Am7'));
      await until(async () => {
        const file = await ctx.cacheFile();
        expect(file[STANDARD_INSTRUMENT_ID][TUNING][SHAPE_CACHE_SALT].value.shapes[key('Am7')]).toBeTruthy();
      });
      expect(await ctx.cacheCommits()).toBe(2);
    } finally {
      await ctx.cleanup();
    }
  }, 60000);
});

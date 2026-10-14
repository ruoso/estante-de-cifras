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
import { hashBlob } from 'isomorphic-git';
import { parse as realParse } from 'cifra-md';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind } from './protocol.js';
import {
  MIGRATIONS,
  INDEX_DOCS_STORE,
  INDEX_LOCATIONS_STORE,
  runMigrations,
} from './migrations.js';
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
    // Seed a store whose cache PREDATES the progression field
    // (storage.progression_search Decision 3, acceptance 9): write the song to
    // the working tree, then open the database at version 2 (steps 1-2 only, no
    // progression step) and put a pre-field `index_docs`/`index_locations`
    // record — note NO `chordSeq`, exactly as the old code wrote it — keyed by
    // the file's real blob oid. When the Worker later opens at the latest
    // version, the v2→v3 migration clears these derived records so reconcile
    // reparses and backfills `progression`.
    async seedStaleIndex(path, text) {
      await fs.promises.writeFile(`${dir}/${path}`, text);
      const bytes = await fs.promises.readFile(`${dir}/${path}`);
      const { oid } = await hashBlob({ object: bytes });
      await new Promise((resolve, reject) => {
        const req = idb.open(name, 2);
        req.onupgradeneeded = (ev) =>
          runMigrations(req.result, req.transaction, ev.oldVersion, ev.newVersion, MIGRATIONS);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction([INDEX_DOCS_STORE, INDEX_LOCATIONS_STORE], 'readwrite');
          tx.objectStore(INDEX_DOCS_STORE).put({
            oid,
            title: 'stale',
            artist: '',
            properties: '',
            sections: '',
            words: '',
            chords: '',
            // chordSeq deliberately absent — the pre-progression record shape.
          });
          tx.objectStore(INDEX_LOCATIONS_STORE).put({
            key: `${bookId}\0${path}`,
            bookId,
            path,
            oid,
            unsaved: false,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
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

      // SAVE it (commit): now it is canonical and committed, so its working copy
      // matches HEAD and it is NOT unsaved (storage.index_dirty_reconcile,
      // workflow 4 — a save clears unsaved).
      first.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['estavel.cifra.md'],
          message: 'keep estavel',
          author: IDENTITY,
        }),
      );
      await until(() =>
        expect(first.store.slice('save')[ctx.bookId]?.status).toBe('saved'),
      );
      // Poll until the post-save reindex has propagated (the SAVED event lands
      // before that reindex, so the unsaved=false must be waited for, not the
      // bare presence of the row).
      await searchUntil(first.store, 'estavel', (rs) =>
        rs.some((r) => r.path === 'estavel.cifra.md' && r.unsaved === false),
      );

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
      // A saved file's unsaved flag stays false across the restart: reconcile
      // re-derives it from HEAD and the committed blob matches the working copy
      // (storage.index_dirty_reconcile, DIRECTION §3.7 L407-409).
      expect(results.find((r) => r.path === 'estavel.cifra.md').unsaved).toBe(false);
      // The second session re-parsed nothing: the oid was unchanged.
      expect(second.parseSpy).not.toHaveBeenCalled();
    } finally {
      await ctx.cleanup();
    }
  });

  it('re-derives unsaved on a restart: a never-committed draft keeps its badge, a saved song does not', async () => {
    // Pins the `.tji` note "a draft reloaded in a fresh Worker instance retains
    // the unsaved badge", workflow 4 (a save clears unsaved), and DIRECTION §3.7
    // L407-409 (the Worker rebuilds the index from its own working tree on load).
    const ctx = await setup();
    try {
      const first = ctx.makeStore();
      first.store.open();
      await until(() =>
        expect(first.store.slice('index')[ctx.bookId]).toBe('ready'),
      );

      // A song written and SAVED (committed) — no longer unsaved.
      const savedPath = 'cantiga.cifra.md';
      first.store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: savedPath,
          text: song(['# Cantiga', '## A', FENCE, 'C   G', 'letra', FENCE]),
        }),
      );
      first.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: [savedPath],
          message: 'add cantiga',
          author: IDENTITY,
        }),
      );
      await until(() =>
        expect(first.store.slice('save')[ctx.bookId]?.status).toBe('saved'),
      );

      // A second song written as a draft and NEVER committed. Live, the WRITE
      // handler marks it unsaved.
      const draftPath = 'esboco.cifra.md';
      first.store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: draftPath,
          text: song(['# Esboço', '## A', FENCE, 'Am  Em', FENCE]),
        }),
      );
      await searchUntil(first.store, 'esboco', (rs) =>
        rs.some((r) => r.path === draftPath && r.unsaved === true),
      );

      // Restart: a fresh Worker instance = a full page reload. The index is
      // rebuilt through reconcile, which RE-DERIVES unsaved from git rather than
      // trusting the persisted flag (the bug this task fixes).
      const second = ctx.makeStore();
      second.store.open();
      await until(() =>
        expect(second.store.slice('index')[ctx.bookId]).toBe('ready'),
      );

      // The committed song reads saved; the never-committed draft keeps its
      // badge, instead of silently flipping to saved on reload.
      const saved = await searchUntil(second.store, 'cantiga', (rs) =>
        rs.some((r) => r.path === savedPath),
      );
      expect(saved.find((r) => r.path === savedPath).unsaved).toBe(false);

      const draft = await searchUntil(second.store, 'esboco', (rs) =>
        rs.some((r) => r.path === draftPath),
      );
      expect(draft.find((r) => r.path === draftPath).unsaved).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });
});

// behavior — setlists in the one song search, built and kept in the real Worker
// (books.setlist_search). Same harness as above; all setlist/song text is
// written for this test (no-song-text rule). No network beyond the local git
// remote that seeds the book. Pins workflow 12 §The file L33-34 ("Setlists are
// found by the same search as songs, marked as setlists"), the suffix/kind
// dispatch over the live WRITE/SAVE edit path (Decision 3), and the
// reconcile-on-save / reconcile-on-restart seams (DIRECTION §3.7 L433-435).
describe('setlist search (behavior)', () => {
  const setlist = (lines) => lines.join('\n') + '\n';

  it('indexes a setlist on open, a WRITE marks it unsaved and a SAVE clears it, a discarded draft drops', async () => {
    const ctx = await setup();
    try {
      // A setlist seeded before open: reconcile indexes it by its title, tagged
      // kind:setlist (found by the same search as songs — workflow 12 L33-34).
      ctx.writeSong(
        'minha-noite.setlist.md',
        setlist(['# Minha Noite', '', '1. [Abertura](abertura.cifra.md)']),
      );
      const { store } = ctx.makeStore();
      store.open();
      await until(() => expect(store.slice('index')[ctx.bookId]).toBe('ready'));

      const seeded = await searchUntil(store, 'minha noite', (rs) =>
        rs.some((r) => r.path === 'minha-noite.setlist.md'),
      );
      const seededHit = seeded.find((r) => r.path === 'minha-noite.setlist.md');
      expect(seededHit.kind).toBe('setlist');
      expect(seededHit.title).toBe('Minha Noite');

      // A WRITE to a *.setlist.md path is parsed as a setlist (suffix dispatch,
      // Decision 3) — a never-saved setlist is findable immediately, unsaved.
      store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: 'gig.setlist.md',
          text: setlist(['# Gig de Sabado', '', '1. [Abertura](abertura.cifra.md)']),
        }),
      );
      const written = await searchUntil(store, 'gig de sabado', (rs) =>
        rs.some((r) => r.path === 'gig.setlist.md' && r.unsaved === true),
      );
      expect(written.find((r) => r.path === 'gig.setlist.md').kind).toBe('setlist');

      // SAVE clears unsaved (now canonical and committed).
      store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['gig.setlist.md'],
          message: 'add setlist',
          author: IDENTITY,
        }),
      );
      await until(() => expect(store.slice('save')[ctx.bookId]?.status).toBe('saved'));
      await searchUntil(store, 'gig de sabado', (rs) =>
        rs.some((r) => r.path === 'gig.setlist.md' && r.unsaved === false),
      );

      // A never-saved draft setlist is found, then discarded and gone.
      store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: 'rascunho.setlist.md',
          text: setlist(['# Rascunho de Lista', '', '1. [Abertura](abertura.cifra.md)']),
        }),
      );
      await searchUntil(store, 'rascunho de lista', (rs) =>
        rs.some((r) => r.path === 'rascunho.setlist.md'),
      );
      store.send(
        command(CommandKind.DISCARD, { bookId: ctx.bookId, paths: ['rascunho.setlist.md'] }),
      );
      await searchUntil(store, 'rascunho de lista', (rs) =>
        rs.every((r) => r.path !== 'rascunho.setlist.md'),
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('re-derives a setlist’s unsaved flag on a restart: a saved one is clean, a never-committed draft keeps its badge', async () => {
    const ctx = await setup();
    try {
      const first = ctx.makeStore();
      first.store.open();
      await until(() => expect(first.store.slice('index')[ctx.bookId]).toBe('ready'));

      // A setlist written and SAVED (committed) — no longer unsaved.
      first.store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: 'salva.setlist.md',
          text: setlist(['# Lista Salva', '', '1. [Abertura](abertura.cifra.md)']),
        }),
      );
      first.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['salva.setlist.md'],
          message: 'add lista',
          author: IDENTITY,
        }),
      );
      await until(() => expect(first.store.slice('save')[ctx.bookId]?.status).toBe('saved'));

      // A second setlist written as a draft and NEVER committed.
      first.store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: 'esboco.setlist.md',
          text: setlist(['# Lista Esboço', '', '1. [Abertura](abertura.cifra.md)']),
        }),
      );
      await searchUntil(first.store, 'lista esboço', (rs) =>
        rs.some((r) => r.path === 'esboco.setlist.md' && r.unsaved === true),
      );

      // Restart = full reload: the index rebuilds through reconcile, which
      // RE-DERIVES unsaved from git for setlists exactly as for songs.
      const second = ctx.makeStore();
      second.store.open();
      await until(() => expect(second.store.slice('index')[ctx.bookId]).toBe('ready'));

      const saved = await searchUntil(second.store, 'lista salva', (rs) =>
        rs.some((r) => r.path === 'salva.setlist.md'),
      );
      expect(saved.find((r) => r.path === 'salva.setlist.md').unsaved).toBe(false);
      expect(saved.find((r) => r.path === 'salva.setlist.md').kind).toBe('setlist');

      const draft = await searchUntil(second.store, 'lista esboço', (rs) =>
        rs.some((r) => r.path === 'esboco.setlist.md'),
      );
      expect(draft.find((r) => r.path === 'esboco.setlist.md').unsaved).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });
});

// behavior — chord-progression search built and matched in the real Worker
// (storage.progression_search). Same harness as above; all song text is written
// for this test (no-song-text rule). No network beyond the local git remote
// that seeds the book — progression search is entirely local (workflow 2
// L152-155, "Offline"). Pins:
//   - a progression query finds the song that contains the run, not a decoy
//     with the chords reordered → `.tji` "a progression query finds a song that
//     contains the run, built in the Worker"; workflow 2 L42; acceptance 7;
//   - spelling-tolerant end-to-end → spec §5.2, Decision 2;
//   - covers unsaved work → DIRECTION §3 L116-117;
//   - backfill + restart → Decision 3, Decision 9;
//   - merged with text, never exclusive → workflow 2 L37.
describe('progression search (behavior)', () => {
  it('finds the song that contains the run and not a decoy with the chords reordered', async () => {
    const ctx = await setup();
    try {
      // Target: the refrain plays Am F C G in order.
      ctx.writeSong(
        'corrida.cifra.md',
        song([
          '# Corrida ao Sol',
          '- artist: Trio Alpha',
          '',
          '## Refrão',
          FENCE,
          'Am  F   C   G',
          'minha estrada segue',
          FENCE,
        ]),
      );
      // Decoy: the SAME four chords, reordered — must NOT match the progression,
      // and its words avoid the query's chord letters so no text hit sneaks in.
      ctx.writeSong(
        'avesso.cifra.md',
        song([
          '# Avesso',
          '- artist: Trio Beta',
          '',
          '## Ponte',
          FENCE,
          'G   C   F   Am',
          'noite tranquila',
          FENCE,
        ]),
      );
      const { store } = ctx.makeStore();
      store.open();
      await until(() => expect(store.slice('index')[ctx.bookId]).toBe('ready'));

      const results = await searchUntil(store, 'Am F C G', (rs) =>
        rs.some((r) => r.path === 'corrida.cifra.md'),
      );
      const hit = results.find((r) => r.path === 'corrida.cifra.md');
      expect(hit.bookId).toBe(ctx.bookId);
      expect(hit.title).toBe('Corrida ao Sol');
      expect(hit.artist).toBe('Trio Alpha');
      // The reordered decoy is not a progression match and has no text hit.
      expect(results.some((r) => r.path === 'avesso.cifra.md')).toBe(false);
    } finally {
      await ctx.cleanup();
    }
  });

  it('is spelling-tolerant: a song written A- F C G is found by Am F C G', async () => {
    const ctx = await setup();
    try {
      ctx.writeSong(
        'variacao.cifra.md',
        song(['# Variação', '## A', FENCE, 'A-  F   C   G', FENCE]),
      );
      const { store } = ctx.makeStore();
      store.open();
      await until(() => expect(store.slice('index')[ctx.bookId]).toBe('ready'));

      const results = await searchUntil(store, 'Am F C G', (rs) =>
        rs.some((r) => r.path === 'variacao.cifra.md'),
      );
      expect(results.find((r) => r.path === 'variacao.cifra.md').title).toBe(
        'Variação',
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('finds a progression typed but not saved (covers the working copy)', async () => {
    const ctx = await setup();
    try {
      const { store } = ctx.makeStore();
      store.open();
      await until(() => expect(store.slice('index')[ctx.bookId]).toBe('ready'));

      // WRITE only — no save. The run must be findable immediately.
      store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: 'ideia.cifra.md',
          text: song(['# Ideia Nova', '## A', FENCE, 'Dm  Bb  F  C', FENCE]),
        }),
      );

      const results = await searchUntil(store, 'Dm Bb F C', (rs) =>
        rs.some((r) => r.path === 'ideia.cifra.md'),
      );
      expect(results.find((r) => r.path === 'ideia.cifra.md').title).toBe(
        'Ideia Nova',
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('backfills on upgrade and then serves from the cache across a restart', async () => {
    const ctx = await setup();
    try {
      // A store whose cache predates the progression field: the song is on disk
      // and indexed at v2 WITHOUT `chordSeq`, so progression cannot match it
      // until the migration clears the cache and reconcile reparses.
      await ctx.seedStaleIndex(
        'antiga.cifra.md',
        song(['# Antiga', '- artist: Coral', '## A', FENCE, 'Em  C   G   D', FENCE]),
      );

      // First launch at the latest version: the v2→v3 migration clears the
      // derived stores, OPEN reconcile reparses the file (once) and backfills
      // the progression field, so the run is now findable.
      const first = ctx.makeStore();
      first.store.open();
      await until(() =>
        expect(first.store.slice('index')[ctx.bookId]).toBe('ready'),
      );
      await searchUntil(first.store, 'Em C G D', (rs) =>
        rs.some((r) => r.path === 'antiga.cifra.md'),
      );
      expect(first.parseSpy.mock.calls.length).toBeGreaterThan(0);

      // Restart over the SAME database: hydrate rebuilds the progression field
      // from the stored sequence; the unchanged blob oid means no reparse.
      const second = ctx.makeStore();
      second.store.open();
      await until(() =>
        expect(second.store.slice('index')[ctx.bookId]).toBe('ready'),
      );
      await searchUntil(second.store, 'Em C G D', (rs) =>
        rs.some((r) => r.path === 'antiga.cifra.md'),
      );
      expect(second.parseSpy).not.toHaveBeenCalled();
    } finally {
      await ctx.cleanup();
    }
  });

  it('merges with text so a song titled the progression still appears', async () => {
    const ctx = await setup();
    try {
      // A song literally TITLED "Am F C G" but playing other chords: it must
      // still appear for the query via the text component (workflow 2 L37,
      // "Nothing is hidden by guessing which was meant").
      ctx.writeSong(
        'titulo.cifra.md',
        song(['# Am F C G', '- artist: Autor', '## A', FENCE, 'D   A', FENCE]),
      );
      // And a song that actually contains the run.
      ctx.writeSong(
        'corre.cifra.md',
        song(['# Corre', '## A', FENCE, 'Am  F   C   G', FENCE]),
      );
      const { store } = ctx.makeStore();
      store.open();
      await until(() => expect(store.slice('index')[ctx.bookId]).toBe('ready'));

      // Both appear — the progression query does not suppress the text match
      // for the same string (workflow 2 L37); the one that contains the run is
      // found alongside the one that only carries the title.
      const results = await searchUntil(store, 'Am F C G', (rs) =>
        rs.some((r) => r.path === 'titulo.cifra.md') &&
        rs.some((r) => r.path === 'corre.cifra.md'),
      );
      expect(results.some((r) => r.path === 'titulo.cifra.md')).toBe(true);
      expect(results.some((r) => r.path === 'corre.cifra.md')).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });
});

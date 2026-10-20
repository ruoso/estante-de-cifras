// Behavior (Worker) — uploading a book from a zip (sync.upload, workflow 7
// §Uploading a book). The whole Worker is driven through the loopback, so the
// shelf write (logic.js) and the conflict-session handoff are exercised
// alongside the upload engine (upload.js). Source repos are built with
// isomorphic-git over fake-indexeddb and zipped with the download's own writer
// (createZip); the push / merge-into-an-online-book cases run against a REAL git
// remote (startGitHttpRemote), the `/api/books` + change-check contract faked
// through an injected `fetch`. Pins workflow 7 §Ends one of two ways / §The
// preview / §No history / §Unrelated history / §A merge left half done /
// §Unsaved changes; spec §11.1, §11.4, §11.12.3, §8.1; DIRECTION §3.1. Song
// text is written for the purpose (no-song-text rule).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import {
  init as gitInit,
  add as gitAdd,
  commit as gitCommit,
  resolveRef,
  readBlob,
  log as gitLog,
} from 'isomorphic-git';

import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { createZip, readZip } from './book-zip.js';
import { canonicaliseFile } from './canonicalise.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';

const IDENTITY = { id: 'u_tester', name: 'A Tester' };
const rand = () => Math.random().toString(36).slice(2);
const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);
const SRC_AUTHOR = { name: 'Up Loader', email: 'up@example.invalid', timestamp: 1600000000, timezoneOffset: 0 };

const songBody = (title, lyric) => ['# ' + title, '', '```', '[C] ', lyric, '```', ''].join('\n');
const SONG_S = songBody('Partida', 'Hoje eu vou');
const SONG_T = songBody('Chegada', 'Enfim cheguei');
const MARKED = ['# Marcada', '', '<<<<<<< ours', 'verso A', '=======', 'verso B', '>>>>>>> theirs', ''].join('\n');

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(Buffer.concat(out).toString('utf8')) : reject(new Error(`${cmd} ${code}: ${Buffer.concat(err)}`)),
    );
  });
}
const remoteHead = (repoDir) =>
  run('git', ['--git-dir', repoDir, 'rev-parse', 'refs/heads/main']).then((s) => s.trim());

// ---- throwaway source repos / zips ---------------------------------------

const newFs = () => createFileSystem(`src-${rand()}-fs`, { indexedDB: new IDBFactory() });

async function listFiles(fs, dir, prefix = '') {
  const names = await fs.promises.readdir(dir);
  const out = [];
  for (const nm of names) {
    const full = `${dir}/${nm}`;
    const rel = prefix ? `${prefix}/${nm}` : nm;
    const stat = await fs.promises.stat(full);
    if (stat.isDirectory()) out.push(...(await listFiles(fs, full, rel)));
    else out.push(rel);
  }
  return out;
}

async function mkdirp(fs, dir) {
  const parts = dir.split('/').filter(Boolean);
  let p = '';
  for (const part of parts) {
    p += `/${part}`;
    try {
      await fs.promises.mkdir(p);
    } catch (e) {
      if (e?.code !== 'EEXIST') throw e;
    }
  }
}

async function zipRepo(fs, dir) {
  const entries = [];
  for (const rel of await listFiles(fs, dir)) {
    entries.push({ name: rel, bytes: await fs.promises.readFile(`${dir}/${rel}`) });
  }
  const blob = await createZip(entries);
  return new Uint8Array(await blob.arrayBuffer());
}

async function materialize(fs, dir, bytes) {
  const entries = await readZip(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  for (const { name, bytes: b } of entries) {
    const dest = `${dir}/${name}`;
    await mkdirp(fs, dest.split('/').slice(0, -1).join('/'));
    await fs.promises.writeFile(dest, b);
  }
}

// Build a repo with one commit holding `files` (a {path: text} map), on `main`.
async function initCommit(fs, dir, files, message = 'Create book') {
  await gitInit({ fs, dir, defaultBranch: 'main' });
  for (const [path, text] of Object.entries(files)) {
    await mkdirp(fs, `${dir}/${path}`.split('/').slice(0, -1).join('/'));
    await fs.promises.writeFile(`${dir}/${path}`, text);
    await gitAdd({ fs, dir, filepath: path });
  }
  await gitCommit({ fs, dir, message, author: SRC_AUTHOR, committer: SRC_AUTHOR });
  return resolveRef({ fs, dir, ref: 'main' });
}

// A folder zip (no .git), just named files.
async function folderZip(files) {
  const blob = await createZip(Object.entries(files).map(([name, text]) => ({ name, bytes: enc(text) })));
  return new Uint8Array(await blob.arrayBuffer());
}

// ---- worker harness -------------------------------------------------------

function routingFetch(remote, serviceId) {
  const impl = async (url, init = {}) => {
    if (typeof url === 'string' && url.startsWith('http')) return globalThis.fetch(url, init);
    if (url === '/api/books' && init.method === 'POST') {
      const { title } = JSON.parse(init.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: serviceId, title, role: 'owner', visibility: 'private', gitUrl: remote?.url, original: null }),
      };
    }
    if (url === '/api/shelf/change-check') return { ok: true, status: 200, json: async () => ({ books: [] }) };
    return { ok: false, status: 404, json: async () => null };
  };
  return { impl };
}

async function makeWorker({ remote = null, serviceId = null } = {}) {
  const idb = new IDBFactory();
  const name = `upload-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  const deviceId = await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const { impl: fetchImpl } = routingFetch(remote, serviceId);
  const events = [];
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: fetchImpl }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  return { idb, name, fs, git, locks, deviceId, events, send };
}

async function awaitEvent(w, kind, match = () => true) {
  let hit;
  await waitFor(() => {
    const err = [...w.events].reverse().find((e) => e.kind === EventKind.ERROR);
    if (err && kind !== EventKind.ERROR) throw new Error(`worker ERROR: ${err.payload.message}`);
    hit = [...w.events].reverse().find((e) => e.kind === kind && match(e.payload));
    expect(hit).toBeTruthy();
  });
  return hit.payload;
}

async function previewUpload(w, target, bytes) {
  const mark = w.events.length;
  w.send(command(CommandKind.PREVIEW_UPLOAD, { target, bytes }));
  let hit;
  await waitFor(() => {
    const err = w.events.slice(mark).find((e) => e.kind === EventKind.ERROR);
    if (err) throw new Error(`worker ERROR: ${err.payload.message}`);
    hit = w.events.slice(mark).find((e) => e.kind === EventKind.UPLOAD_PREVIEW);
    expect(hit).toBeTruthy();
  });
  return hit.payload;
}

async function createLocalBook(w, title) {
  w.send(command(CommandKind.CREATE_BOOK, { title, author: IDENTITY }));
  const p = await awaitEvent(w, EventKind.BOOK_CREATED);
  return p.bookId;
}

async function saveSong(w, bookId, path, text) {
  w.send(command(CommandKind.WRITE, { bookId, path, text }));
  // WRITE emits no event and runs under the book lock; drain the lock so it has
  // settled before SAVE requests the same lock (save-preview.behavior pattern).
  await new Promise((r) => setTimeout(r, 0));
  await navigator.locks.request(`book:${bookId}`, { mode: 'exclusive' }, () => {});
  const mark = w.events.length;
  w.send(command(CommandKind.SAVE, { bookId, paths: [path], message: 'save', author: IDENTITY }));
  await waitFor(() => {
    const hit = w.events.slice(mark).find((e) => e.kind === EventKind.SAVED || e.kind === EventKind.SAVE_REFUSED);
    expect(hit).toBeTruthy();
  });
}

let restoreLocks;
let scratch;
beforeEach(() => {
  restoreLocks = installWebLocks();
  scratch = [];
});
afterEach(() => {
  restoreLocks();
  for (const d of scratch) rmSync(d, { recursive: true, force: true });
});

describe('upload — import as a new book (workflow 7 §Ends one of two ways, spec §11.1)', () => {
  it('imports the zip\'s history verbatim: objects copied, main at the head, the book openable (acceptance 4)', async () => {
    const src = newFs();
    const head = await initCommit(src, '/src', {
      'README.md': '# Caderno\n',
      '.gitattributes': '*.cifra.md merge=cifra\n',
      'partida.cifra.md': SONG_S,
    });
    const bytes = await zipRepo(src, '/src');

    const w = await makeWorker();
    const preview = await previewUpload(w, { kind: 'new' }, bytes);
    expect(preview.hasHistory).toBe(true);
    expect(preview.branch).toBe('main');
    expect(preview.previews.some((p) => p.path === 'partida.cifra.md' && p.status === 'added')).toBe(true);

    w.send(command(CommandKind.IMPORT_UPLOAD, { uploadId: preview.uploadId, choice: 'new_book', author: IDENTITY }));
    const { bookId } = await awaitEvent(w, EventKind.BOOK_CREATED);

    const dir = w.git.bookDir(bookId);
    expect(await resolveRef({ fs: w.fs, dir, ref: 'main' })).toBe(head); // taken verbatim, not rewritten
    expect(await w.fs.promises.readFile(`${dir}/partida.cifra.md`, 'utf8')).toBe(SONG_S);
    // The scratch repo is removed on confirm.
    await expect(w.fs.promises.readdir(`/uploads/${preview.uploadId}`)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('a no-history folder becomes one canonical first commit, songs rewritten to canonical (acceptance 5, 9)', async () => {
    const nonCanonical = SONG_S + '\n\n\n'; // clean but not canonical (trailing blank lines)
    const bytes = await folderZip({ 'README.md': '# Pasta\n', 'partida.cifra.md': nonCanonical });

    const w = await makeWorker();
    const preview = await previewUpload(w, { kind: 'new' }, bytes);
    expect(preview.hasHistory).toBe(false);

    w.send(command(CommandKind.IMPORT_UPLOAD, { uploadId: preview.uploadId, choice: 'new_book', author: IDENTITY }));
    const { bookId } = await awaitEvent(w, EventKind.BOOK_CREATED);
    const dir = w.git.bookDir(bookId);

    const entries = await gitLog({ fs: w.fs, dir, ref: 'main' });
    expect(entries.length).toBe(1); // one first commit
    const stored = await w.fs.promises.readFile(`${dir}/partida.cifra.md`, 'utf8');
    expect(stored).toBe(canonicaliseFile('partida.cifra.md', nonCanonical).text);
    expect(stored).not.toBe(nonCanonical); // landed canonical, not its original spelling
  });
});

// songs.no_raw_ids Constraint 9 — the upload stops writing English: a README with
// no level-1 heading leaves the book untitled on the shelf (the view says
// *Untitled book* in the user's language), and a zip with no README is
// scaffolded under the main thread's localized `untitledTitle`.
describe('upload — a book with no title (songs.no_raw_ids Constraint 9)', () => {
  it('a zip whose README has no heading lands with a position and no shelf title, its README as written', async () => {
    const README = 'Só uma linha de prosa, sem título.\n';
    const bytes = await folderZip({ 'README.md': README, 'partida.cifra.md': SONG_S });

    const w = await makeWorker();
    const preview = await previewUpload(w, { kind: 'new' }, bytes);
    w.send(
      command(CommandKind.IMPORT_UPLOAD, {
        uploadId: preview.uploadId,
        choice: 'new_book',
        untitledTitle: 'Livro sem título',
        author: IDENTITY,
      }),
    );
    const { bookId } = await awaitEvent(w, EventKind.BOOK_CREATED);

    const entry = [...w.events].reverse().find((e) => e.kind === EventKind.SHELF).payload.local[bookId];
    expect(typeof entry.position.value).toBe('number');
    expect(entry.title).toBeUndefined();
    expect(await w.fs.promises.readFile(`${w.git.bookDir(bookId)}/README.md`, 'utf8')).toBe(README);
  });

  it('a zip with no README is scaffolded under the payload’s untitledTitle, and that is its shelf title', async () => {
    const bytes = await folderZip({ 'partida.cifra.md': SONG_S });

    const w = await makeWorker();
    const preview = await previewUpload(w, { kind: 'new' }, bytes);
    w.send(
      command(CommandKind.IMPORT_UPLOAD, {
        uploadId: preview.uploadId,
        choice: 'new_book',
        untitledTitle: 'Livro sem título',
        author: IDENTITY,
      }),
    );
    const { bookId } = await awaitEvent(w, EventKind.BOOK_CREATED);

    const entry = [...w.events].reverse().find((e) => e.kind === EventKind.SHELF).payload.local[bookId];
    expect(entry.title.value).toBe('Livro sem título');
    expect(await w.fs.promises.readFile(`${w.git.bookDir(bookId)}/README.md`, 'utf8')).toBe('# Livro sem título\n');
    expect(await w.fs.promises.readFile(`${w.git.bookDir(bookId)}/README.md`, 'utf8')).not.toMatch(/Untitled/);
  });
});

describe('upload — edits never committed (workflow 7 §Edits never committed, acceptance 2)', () => {
  it('brings an uncommitted working-tree edit in via the synthetic commit', async () => {
    const src = newFs();
    await initCommit(src, '/src', { '.gitattributes': '*.cifra.md merge=cifra\n', 'partida.cifra.md': SONG_S });
    // Edit the working copy without committing.
    const edited = songBody('Partida', 'Hoje eu vou agora');
    await src.promises.writeFile('/src/partida.cifra.md', edited);
    const bytes = await zipRepo(src, '/src');

    const w = await makeWorker();
    const preview = await previewUpload(w, { kind: 'new' }, bytes);
    w.send(command(CommandKind.IMPORT_UPLOAD, { uploadId: preview.uploadId, choice: 'new_book', author: IDENTITY }));
    const { bookId } = await awaitEvent(w, EventKind.BOOK_CREATED);
    const dir = w.git.bookDir(bookId);
    // The imported book's committed song carries the uncommitted edit, written
    // canonical by the §8 writer (acceptance 9) — not its original spelling.
    const stored = await w.fs.promises.readFile(`${dir}/partida.cifra.md`, 'utf8');
    expect(stored).toBe(canonicaliseFile('partida.cifra.md', edited).text);
    expect(stored).toContain('agora'); // the edit's text made it in
  });
});

describe('upload — marked files (workflow 7 §A merge left half done, spec §11.4/§11.12.3)', () => {
  it('leaves a marked working-tree file out with its first marker line; the rest imports (acceptance 7)', async () => {
    const src = newFs();
    await initCommit(src, '/src', { '.gitattributes': '*.cifra.md merge=cifra\n', 'partida.cifra.md': SONG_S });
    // A half-done merge sits in the working tree.
    await src.promises.writeFile('/src/marcada.cifra.md', MARKED);
    const bytes = await zipRepo(src, '/src');

    const w = await makeWorker();
    const preview = await previewUpload(w, { kind: 'new' }, bytes);
    const marked = preview.previews.find((p) => p.path === 'marcada.cifra.md');
    expect(marked.status).toBe('unresolved');
    expect(marked.line).toBe(3); // 1-based first marker line

    w.send(command(CommandKind.IMPORT_UPLOAD, { uploadId: preview.uploadId, choice: 'new_book', author: IDENTITY }));
    const { bookId } = await awaitEvent(w, EventKind.BOOK_CREATED);
    const dir = w.git.bookDir(bookId);
    // The clean song imported; the marked file was left out.
    expect(await w.fs.promises.readFile(`${dir}/partida.cifra.md`, 'utf8')).toBe(SONG_S);
    await expect(w.fs.promises.stat(`${dir}/marcada.cifra.md`)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('names a marker committed in history and imports the latest version without its history (acceptance 8)', async () => {
    const src = newFs();
    // C0 commits a marked song; C1 fixes it so the latest is clean.
    await initCommit(src, '/src', { '.gitattributes': '*.cifra.md merge=cifra\n', 'marcada.cifra.md': MARKED });
    const markedCommit = await resolveRef({ fs: src, dir: '/src', ref: 'main' });
    await src.promises.writeFile('/src/marcada.cifra.md', songBody('Marcada', 'verso resolvido'));
    await gitAdd({ fs: src, dir: '/src', filepath: 'marcada.cifra.md' });
    await gitCommit({ fs: src, dir: '/src', message: 'fix', author: SRC_AUTHOR, committer: SRC_AUTHOR });
    const bytes = await zipRepo(src, '/src');

    const w = await makeWorker();
    const preview = await previewUpload(w, { kind: 'new' }, bytes);
    expect(preview.historyMarkers).toBeTruthy();
    expect(preview.historyMarkers.commit).toBe(markedCommit);
    expect(preview.historyMarkers.path).toBe('marcada.cifra.md');
    expect(preview.historyMarkers.latestClean).toBe(true);

    w.send(command(CommandKind.IMPORT_UPLOAD, { uploadId: preview.uploadId, choice: 'latest_without_history', author: IDENTITY }));
    const { bookId } = await awaitEvent(w, EventKind.BOOK_CREATED);
    const dir = w.git.bookDir(bookId);
    const entries = await gitLog({ fs: w.fs, dir, ref: 'main' });
    expect(entries.length).toBe(1); // one canonical first commit, no marked history
    expect(canonicaliseFile('marcada.cifra.md', await w.fs.promises.readFile(`${dir}/marcada.cifra.md`, 'utf8')).ok).toBe(true);
  });
});

describe('upload — into an existing book (workflow 7, spec §11.1)', () => {
  it('no history is a replace, not a merge: chosen matches replaced, new files added, one ordinary commit (acceptance 5)', async () => {
    const w = await makeWorker();
    const bookId = await createLocalBook(w, 'Meu livro');
    await saveSong(w, bookId, 'partida.cifra.md', SONG_S);
    const dir = w.git.bookDir(bookId);
    const before = await resolveRef({ fs: w.fs, dir, ref: 'main' });

    const changedS = songBody('Partida', 'Hoje eu vou enfim');
    const bytes = await folderZip({ 'partida.cifra.md': changedS, 'chegada.cifra.md': SONG_T });

    const preview = await previewUpload(w, { kind: 'existing', bookId }, bytes);
    expect(preview.hasHistory).toBe(false);
    expect(preview.previews.find((p) => p.path === 'partida.cifra.md').status).toBe('replace');
    expect(preview.previews.find((p) => p.path === 'chegada.cifra.md').status).toBe('added');

    w.send(command(CommandKind.IMPORT_UPLOAD, {
      uploadId: preview.uploadId,
      choice: 'replace',
      target: { bookId },
      perFile: ['partida.cifra.md'],
      author: IDENTITY,
    }));
    await awaitEvent(w, EventKind.SYNC, (p) => p.bookId === bookId);

    const head = await resolveRef({ fs: w.fs, dir, ref: 'main' });
    const [top] = await gitLog({ fs: w.fs, dir, ref: 'main' });
    expect(top.commit.parent).toEqual([before]); // one ordinary single-parent commit
    // The replacement and the addition land canonical (Estante authors canonical).
    expect(await w.fs.promises.readFile(`${dir}/partida.cifra.md`, 'utf8')).toBe(canonicaliseFile('partida.cifra.md', changedS).text);
    expect(await w.fs.promises.readFile(`${dir}/chegada.cifra.md`, 'utf8')).toBe(canonicaliseFile('chegada.cifra.md', SONG_T).text);
    expect(head).not.toBe(before);
  });

  it('a zip whose history is unrelated: the preview reports no shared history, each common song a conflict (acceptance 6)', async () => {
    const w = await makeWorker();
    // The book (its own history).
    const bookId = await createLocalBook(w, 'Meu livro');
    await saveSong(w, bookId, 'partida.cifra.md', SONG_S);
    // A completely separate repo that also holds partida.cifra.md (different) + a new song.
    const src = newFs();
    await initCommit(src, '/src', {
      '.gitattributes': '*.cifra.md merge=cifra\n',
      'partida.cifra.md': songBody('Partida', 'Outra versão'),
      'nova.cifra.md': SONG_T,
    });
    const bytes = await zipRepo(src, '/src');

    const preview = await previewUpload(w, { kind: 'existing', bookId }, bytes);
    expect(preview.sharedHistory).toBe(false);
    expect(preview.previews.find((p) => p.path === 'partida.cifra.md').status).toBe('conflict');
    expect(preview.previews.find((p) => p.path === 'nova.cifra.md').status).toBe('added');
  });

  it('nothing is written until confirm: PREVIEW leaves HEAD unchanged; a cancel removes the scratch repo (acceptance 3)', async () => {
    const w = await makeWorker();
    const bookId = await createLocalBook(w, 'Meu livro');
    await saveSong(w, bookId, 'partida.cifra.md', SONG_S);
    const dir = w.git.bookDir(bookId);
    const before = await resolveRef({ fs: w.fs, dir, ref: 'main' });

    const src = newFs();
    await initCommit(src, '/src', { '.gitattributes': '*.cifra.md merge=cifra\n', 'partida.cifra.md': SONG_S });
    const bytes = await zipRepo(src, '/src');
    const preview = await previewUpload(w, { kind: 'existing', bookId }, bytes);

    // The book was not mutated by the preview.
    expect(await resolveRef({ fs: w.fs, dir, ref: 'main' })).toBe(before);
    await expect(w.fs.promises.stat(`${dir}/.git/refs/upload`)).rejects.toMatchObject({ code: 'ENOENT' });

    // Cancel removes the scratch repo. CANCEL emits no event and the Worker
    // flushes the removal; poll a FRESH fs instance (which reads current idb
    // state, not this instance's cached superblock) until it is gone.
    w.send(command(CommandKind.CANCEL_UPLOAD, { uploadId: preview.uploadId }));
    await waitFor(
      async () => {
        const fresh = createFileSystem(`${w.name}-fs`, { indexedDB: w.idb });
        let gone = false;
        try {
          await fresh.promises.readdir(`/uploads/${preview.uploadId}`);
        } catch (err) {
          gone = err?.code === 'ENOENT';
        }
        expect(gone).toBe(true);
      },
      { timeout: 5000, interval: 150 },
    );
  });
});

describe('upload — merge into an existing online book (workflow 7 §Ends one of two ways, §Unsaved; acceptance 10)', () => {
  it('a clean merge is committed and pushed; unsaved edits are carried on top, still unsaved', async () => {
    const remote = await startGitHttpRemote({ seed: false });
    const serviceId = `srv-${rand()}`;
    try {
      const w = await makeWorker({ remote, serviceId });
      // Build the book from a base repo and put it online so it has a remote.
      const src = newFs();
      await initCommit(src, '/src', { '.gitattributes': '*.cifra.md merge=cifra\n', 'README.md': '# Base\n', 'partida.cifra.md': SONG_S });
      const base = await zipRepo(src, '/src');
      const p0 = await previewUpload(w, { kind: 'new' }, base);
      w.send(command(CommandKind.IMPORT_UPLOAD, { uploadId: p0.uploadId, choice: 'new_book', author: IDENTITY }));
      const { bookId: localId } = await awaitEvent(w, EventKind.BOOK_CREATED);
      w.send(command(CommandKind.PUT_ONLINE, { bookId: localId, author: IDENTITY }));
      const { bookId } = await awaitEvent(w, EventKind.BOOK_ONLINE);
      const dir = w.git.bookDir(bookId);

      // Derive a merge zip sharing the base: add a new song on top.
      const zsrc = newFs();
      await materialize(zsrc, '/z', base);
      await zsrc.promises.writeFile('/z/chegada.cifra.md', SONG_T);
      await gitAdd({ fs: zsrc, dir: '/z', filepath: 'chegada.cifra.md' });
      const theirs = await gitCommit({ fs: zsrc, dir: '/z', message: 'add chegada', author: SRC_AUTHOR, committer: SRC_AUTHOR });
      const zip = await zipRepo(zsrc, '/z');

      // An unsaved edit to an existing song in the book, never committed.
      const editedS = songBody('Partida', 'Hoje eu vou longe');
      w.send(command(CommandKind.WRITE, { bookId, path: 'partida.cifra.md', text: editedS }));

      const preview = await previewUpload(w, { kind: 'existing', bookId }, zip);
      expect(preview.sharedHistory).toBe(true);
      expect(preview.previews.find((p) => p.path === 'chegada.cifra.md').status).toBe('added');

      w.send(command(CommandKind.IMPORT_UPLOAD, { uploadId: preview.uploadId, choice: 'merge', target: { bookId }, author: IDENTITY }));
      await awaitEvent(w, EventKind.SYNC, (p) => p.bookId === bookId && p.phase === 'in_step');

      // The merge landed and was pushed (the remote advanced to the upload's head).
      const head = await resolveRef({ fs: w.fs, dir, ref: 'main' });
      expect(head).toBe(theirs); // fast-forward to the upload's commit
      expect(await remoteHead(remote.repoDir)).toBe(head);
      expect(await w.fs.promises.readFile(`${dir}/chegada.cifra.md`, 'utf8')).toBe(SONG_T);
      // The unsaved edit survived the merge, still uncommitted.
      expect(await w.fs.promises.readFile(`${dir}/partida.cifra.md`, 'utf8')).toBe(editedS);
      const committed = await readBlob({ fs: w.fs, dir, oid: head, filepath: 'partida.cifra.md' });
      expect(dec(committed.blob)).toBe(SONG_S); // HEAD still the base song — the edit is unsaved
    } finally {
      await remote.stop();
    }
  });

  it('a colliding merge leaves needs_you with the retained ref; the conflict session opens and abandon resets (acceptance 10)', async () => {
    const w = await makeWorker();
    // The book from a base repo, imported local (no remote needed for a collision).
    const src = newFs();
    await initCommit(src, '/src', { '.gitattributes': '*.cifra.md merge=cifra\n', 'partida.cifra.md': SONG_S });
    const baseZip = await zipRepo(src, '/src');
    const p0 = await previewUpload(w, { kind: 'new' }, baseZip);
    w.send(command(CommandKind.IMPORT_UPLOAD, { uploadId: p0.uploadId, choice: 'new_book', author: IDENTITY }));
    const { bookId } = await awaitEvent(w, EventKind.BOOK_CREATED);
    const dir = w.git.bookDir(bookId);

    // The book changes the song one way (committed).
    await saveSong(w, bookId, 'partida.cifra.md', songBody('Partida', 'Hoje eu fico aqui'));
    const oursHead = await resolveRef({ fs: w.fs, dir, ref: 'main' });

    // The zip changes the SAME line another way, off the shared base → a conflict.
    const zsrc = newFs();
    await materialize(zsrc, '/z', baseZip);
    await zsrc.promises.writeFile('/z/partida.cifra.md', songBody('Partida', 'Hoje eu vou agora'));
    await gitAdd({ fs: zsrc, dir: '/z', filepath: 'partida.cifra.md' });
    await gitCommit({ fs: zsrc, dir: '/z', message: 'their change', author: SRC_AUTHOR, committer: SRC_AUTHOR });
    const zip = await zipRepo(zsrc, '/z');

    const preview = await previewUpload(w, { kind: 'existing', bookId }, zip);
    expect(preview.sharedHistory).toBe(true);
    expect(preview.previews.find((p) => p.path === 'partida.cifra.md').status).toBe('conflict');

    w.send(command(CommandKind.IMPORT_UPLOAD, { uploadId: preview.uploadId, choice: 'merge', target: { bookId }, author: IDENTITY }));
    await awaitEvent(w, EventKind.SYNC, (p) => p.bookId === bookId && p.phase === 'needs_you');

    // main stays at ours; the zip's ref is retained in the book for the session.
    expect(await resolveRef({ fs: w.fs, dir, ref: 'main' })).toBe(oursHead);
    const uploadRefs = await w.fs.promises.readdir(`${dir}/.git/refs/upload`);
    expect(uploadRefs.length).toBe(1);
    const uploadRef = `refs/upload/${uploadRefs[0]}`;

    // The existing conflict session resolves it (the generalised incoming ref).
    w.send(command(CommandKind.OPEN_CONFLICTS, { bookId }));
    const conflicts = await awaitEvent(w, EventKind.CONFLICTS, (p) => p.bookId === bookId && p.inProgress);
    expect(conflicts.songs.some((s) => s.path === 'partida.cifra.md')).toBe(true);

    // Abandon resets the book to exactly before the upload and drops the ref.
    w.send(command(CommandKind.ABANDON_MERGE, { bookId }));
    await awaitEvent(w, EventKind.CONFLICTS, (p) => p.bookId === bookId && p.inProgress === false);
    expect(await resolveRef({ fs: w.fs, dir, ref: 'main' })).toBe(oursHead);
    await expect(resolveRef({ fs: w.fs, dir, ref: uploadRef })).rejects.toBeTruthy();
  });
});

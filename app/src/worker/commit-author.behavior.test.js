// Behavior (Worker) — authoring as the account (account.commit_author). A
// device is a Worker over its own fake IndexedDB, driven through the loopback;
// REAL git remotes (startGitHttpRemote) stand in for the service's books and
// the account's home book, and an injected `fetch` double answers the service
// API (200 or 401, or no network at all).
//
// Pins DIRECTION §3.3 ("before sign-in, a device's commits carry a local id in
// its place, which the account's address replaces in the saves not yet pushed
// when the user signs in"), the refinement's Constraints 4-9, sign_out.md
// :360-363 and sign_out Constraint 4. Songs and names are written for the test
// (no-song-text rule).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import {
  init as gitInit,
  add as gitAdd,
  commit as gitCommit,
  log as gitLog,
  resolveRef,
} from 'isomorphic-git';

import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { MY_SONGS_ID } from './my-songs.js';
import { createZip } from './book-zip.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';

const DOMAIN = 'users.estantedecifras.app';
const ACCOUNT_ID = 'u_c0ffee';
const ACCOUNT = `${ACCOUNT_ID}@${DOMAIN}`;
const HOME_ID = 'srv-home-ca';
const ANA = { name: 'Ana Teste', email: `ana-id@${DOMAIN}` };
// Another device's local address, carried in by an uploaded zip's history.
const OTHER_DEVICE = { name: 'Ana Teste', email: `other-device-local@${DOMAIN}` };
const rand = () => Math.random().toString(36).slice(2);
const FENCE = '```';
const song = (title, line) => [`# ${title}`, '', FENCE, 'C   G', line, FENCE, ''].join('\n');
const WAIT = { timeout: 20000, interval: 25 };

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: env ?? process.env });
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

// Every author and committer address on a remote's `main`.
async function remoteEmails(remote) {
  const out = await run('git', ['--git-dir', remote.repoDir, 'log', '--format=%ae%n%ce', 'main']);
  return out.split('\n').filter(Boolean);
}
const remoteHead = (remote) =>
  run('git', ['--git-dir', remote.repoDir, 'rev-parse', 'refs/heads/main']).then((s) => s.trim());

// ---- the service double --------------------------------------------------

const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

async function makeService() {
  const home = await startGitHttpRemote({ seed: false });
  const service = {
    home,
    remotes: [home],
    spare: [],
    created: [],
    offline: false,
    async provide(n = 1) {
      for (let i = 0; i < n; i += 1) {
        const remote = await startGitHttpRemote({ seed: false });
        service.spare.push(remote);
        service.remotes.push(remote);
      }
    },
    remoteOf(serviceId) {
      return service.created.find((c) => c.id === serviceId)?.remote ?? null;
    },
    async fetch(url, init = {}, device = {}) {
      if (service.offline) throw new TypeError('Failed to fetch');
      if (typeof url === 'string' && url.startsWith('http')) return globalThis.fetch(url, init);
      const method = init.method ?? 'GET';
      if (url === '/api/account/home-book') {
        if (!device.signedIn) return response(401, { code: 'unauthorized' });
        return response(200, { id: HOME_ID, gitUrl: home.url });
      }
      if (url === '/api/books' && method === 'POST') {
        const { title } = JSON.parse(init.body);
        const remote = service.spare.shift();
        const id = `srv-${rand()}`;
        service.created.push({ id, title, remote });
        return response(201, { id, title, role: 'owner', visibility: 'private', gitUrl: remote.url });
      }
      if (url === '/api/shelf/change-check') {
        // A hosted book whose remote moved past the device's head is `changed`.
        const { books } = JSON.parse(init.body);
        const changed = [];
        for (const { bookId, head } of books) {
          const remote = service.remoteOf(bookId);
          if (!remote) continue;
          const now = await remoteHead(remote).catch(() => null);
          if (now && now !== head) changed.push({ bookId, status: 'changed', head: now });
        }
        return response(200, { books: changed });
      }
      return response(404, null);
    },
    async stop() {
      for (const remote of service.remotes) await remote.stop();
    },
  };
  return service;
}

// ---- a device --------------------------------------------------------------

async function makeDevice(service, { idb = new IDBFactory(), name = `ca-${rand()}`, signedIn = false } = {}) {
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  // The §2.3 device id, as an earlier build's sync identity wrote commits with.
  const deviceId = await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const events = [];
  const session = { signedIn };
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, {
      indexedDB: idb,
      name,
      fetch: (url, init) => service.fetch(url, init, session),
      setInterval: () => 0,
      clearInterval: () => {},
    }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  return {
    idb,
    name,
    deviceId,
    events,
    session,
    send: (cmd) => endpoint.postMessage(cmd),
    fs: () => createFileSystem(`${name}-fs`, { indexedDB: idb }),
    dir: (bookId) => `/books/${bookId}`,
  };
}

function find(w, kind, pred = () => true, from = 0) {
  return w.events.slice(from).find((e) => e.kind === kind && pred(e.payload));
}

async function waitEvent(w, kind, pred = () => true, from = 0) {
  let hit;
  await waitFor(() => {
    hit = find(w, kind, pred, from);
    expect(hit, `waiting for ${kind}`).toBeTruthy();
  }, WAIT);
  return hit.payload;
}

async function ask(w, cmd, kind, pred) {
  const mark = w.events.length;
  w.send(cmd);
  return waitEvent(w, kind, pred, mark);
}

async function open(w) {
  await ask(w, command(CommandKind.OPEN, {}), EventKind.RECENTS);
}

// Sign in as AppShell's onSignedIn does: the session exists, and ATTACH_HOME
// carries the sign-in reply's account id.
async function signIn(w, accountId = ACCOUNT_ID) {
  w.session.signedIn = true;
  return ask(w, command(CommandKind.ATTACH_HOME, { accountId }), EventKind.HOME_ATTACHED);
}

async function write(w, bookId, path, text) {
  await ask(w, command(CommandKind.WRITE, { bookId, path, text }), EventKind.INDEX_STATUS, (p) => p.bookId === bookId);
}

async function save(w, bookId, path, message = 'Add') {
  return ask(
    w,
    command(CommandKind.SAVE, { bookId, paths: [path], message }),
    EventKind.SAVED,
    (p) => p.bookId === bookId,
  );
}

async function localBook(w, title) {
  const { bookId } = await ask(w, command(CommandKind.CREATE_BOOK, { title }), EventKind.BOOK_CREATED);
  return bookId;
}

async function mySongsSong(w, text) {
  const { bookId, path } = await ask(
    w,
    command(CommandKind.NEW_SONG, { mySongsTitle: 'My songs' }),
    EventKind.NEW_SONG_READY,
  );
  await write(w, bookId, path, text);
  const saved = await ask(
    w,
    command(CommandKind.NAME_AND_SAVE, { bookId, fromPath: path }),
    EventKind.SAVED,
    (p) => p.bookId === bookId,
  );
  return saved.path;
}

async function putOnline(service, w, bookId) {
  await service.provide();
  const reply = await ask(w, command(CommandKind.PUT_ONLINE, { bookId }), EventKind.BOOK_ONLINE, (p) => p.previousBookId === bookId);
  return reply.bookId;
}

// A book's commits on `main`, as the device's flushed filesystem holds them.
async function commitsOf(w, bookId) {
  return gitLog({ fs: w.fs(), dir: w.dir(bookId), ref: 'main' });
}
const emailsOf = (entries) => entries.flatMap((e) => [e.commit.author.email, e.commit.committer.email]);
const headOf = (w, bookId) => resolveRef({ fs: w.fs(), dir: w.dir(bookId), ref: 'main' });

// The persisted `meta` record, read straight from the device's database.
function readMeta(w) {
  return new Promise((resolve, reject) => {
    const req = w.idb.open(w.name);
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction('meta', 'readonly').objectStore('meta').get('meta');
      get.onsuccess = () => {
        db.close();
        resolve(get.result ?? {});
      };
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  });
}

// An uploaded book's zip: a history of two commits — one by another device's
// local address, one by this device's legacy `<deviceId>@` (an earlier build's
// sync identity wrote it) — zipped with the download's own writer.
async function zipFromHistory(deviceId) {
  const fs = createFileSystem(`src-${rand()}-fs`, { indexedDB: new IDBFactory() });
  const dir = '/src';
  await gitInit({ fs, dir, defaultBranch: 'main' });
  const commitAs = async (who, file, text, message) => {
    await fs.promises.writeFile(`${dir}/${file}`, text);
    await gitAdd({ fs, dir, filepath: file });
    const sig = { ...who, timestamp: 1_700_000_000, timezoneOffset: 0 };
    await gitCommit({ fs, dir, message, author: sig, committer: sig });
  };
  await commitAs(OTHER_DEVICE, 'README.md', '# Caderno de Teste\n', 'Create book');
  await commitAs(OTHER_DEVICE, 'samba-teste.cifra.md', song('Samba de Teste', 'pé de feijão'), 'Add Samba de Teste');
  await commitAs(
    { name: 'Me', email: `${deviceId}@${DOMAIN}` },
    'baiao-teste.cifra.md',
    song('Baião de Teste', 'chão de terra'),
    'Add Baião de Teste',
  );
  const entries = [];
  const walk = async (rel) => {
    for (const nm of await fs.promises.readdir(rel ? `${dir}/${rel}` : dir)) {
      const path = rel ? `${rel}/${nm}` : nm;
      const stat = await fs.promises.stat(`${dir}/${path}`);
      if (stat.isDirectory()) await walk(path);
      else entries.push({ name: path, bytes: await fs.promises.readFile(`${dir}/${path}`) });
    }
  };
  await walk('');
  const blob = await createZip(entries);
  return new Uint8Array(await blob.arrayBuffer());
}

async function importZip(w, bytes) {
  const preview = await ask(w, command(CommandKind.PREVIEW_UPLOAD, { target: { kind: 'new' }, bytes }), EventKind.UPLOAD_PREVIEW);
  const { bookId } = await ask(
    w,
    command(CommandKind.IMPORT_UPLOAD, { uploadId: preview.uploadId, choice: 'new_book' }),
    EventKind.BOOK_CREATED,
  );
  return bookId;
}

let restoreLocks;
let service;
const scratch = [];
beforeEach(async () => {
  restoreLocks = installWebLocks();
  service = await makeService();
});
afterEach(async () => {
  await service.stop();
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
  restoreLocks();
});

describe('authoring as the account (account.commit_author)', () => {
  it('pre-sign-in saves are re-authored in every book; foreign commits, files and unsaved changes stay (DIRECTION §3.3; Constraints 4-7)', async () => {
    const w = await makeDevice(service);
    await open(w);

    // Signed out: a local book with two saved songs, a song in *My songs*, a
    // setting (a home-book commit) and an uploaded zip's history.
    const bookId = await localBook(w, 'Rascunhos');
    await write(w, bookId, 'marcha-teste.cifra.md', song('Marcha de Teste', 'um dois feijão'));
    await save(w, bookId, 'marcha-teste.cifra.md', 'Add Marcha de Teste');
    await write(w, bookId, 'valsa-teste.cifra.md', song('Valsa de Teste', 'tres quatro arroz'));
    await save(w, bookId, 'valsa-teste.cifra.md', 'Add Valsa de Teste');
    const mySongsPath = await mySongsSong(w, song('Choro de Teste', 'cinco seis café'));
    w.send(command(CommandKind.SET_THEME, { theme: 'palco' }));
    await waitEvent(w, EventKind.PREFERENCES, (p) => p.theme?.value === 'palco');
    const uploadedId = await importZip(w, await zipFromHistory(w.deviceId));

    // A pending unsaved change in the local book.
    const UNSAVED = song('Marcha de Teste', 'um dois três feijão');
    await write(w, bookId, 'marcha-teste.cifra.md', UNSAVED);

    // Before sign-in the device's own commits carry ONE local address: neither
    // the shared `local@` nor the device id.
    const before = emailsOf([
      ...(await commitsOf(w, bookId)),
      ...(await commitsOf(w, MY_SONGS_ID)),
      ...(await commitsOf(w, HOME_BOOK_ID)),
    ]);
    const localAddresses = new Set(before);
    expect(localAddresses.size).toBe(1);
    const [localAddress] = localAddresses;
    expect(localAddress).toMatch(new RegExp(`^[0-9a-f-]{36}@${DOMAIN.replace(/\./g, '\\.')}$`));
    expect(localAddress).not.toBe(`${w.deviceId}@${DOMAIN}`);
    expect(localAddress).not.toBe(`local@${DOMAIN}`);
    const filesBefore = {
      marcha: await w.fs().promises.readFile(`${w.dir(bookId)}/marcha-teste.cifra.md`, 'utf8'),
      valsa: await w.fs().promises.readFile(`${w.dir(bookId)}/valsa-teste.cifra.md`, 'utf8'),
      mine: await w.fs().promises.readFile(`${w.dir(MY_SONGS_ID)}/${mySongsPath}`, 'utf8'),
    };
    expect(filesBefore.marcha).toBe(UNSAVED);
    const treesBefore = (await commitsOf(w, bookId)).map((e) => e.commit.tree);

    // Sign in.
    expect((await signIn(w)).attached).toBe(true);

    // Every commit this device made is the account's now, in all three books.
    for (const id of [bookId, MY_SONGS_ID, HOME_BOOK_ID]) {
      const emails = emailsOf(await commitsOf(w, id));
      expect(emails.length).toBeGreaterThan(0);
      expect(new Set(emails), id).toEqual(new Set([ACCOUNT]));
    }
    // The re-author keeps trees (only the ref moved) and messages.
    const after = await commitsOf(w, bookId);
    expect(after.map((e) => e.commit.tree)).toEqual(treesBefore);
    expect(after.map((e) => e.commit.message.trim())).toEqual([
      'Add Valsa de Teste',
      'Add Marcha de Teste',
      expect.any(String),
    ]);

    // The zip's history: the other device's commits keep their author; this
    // device's legacy `<deviceId>@` commit is re-authored.
    const uploaded = await commitsOf(w, uploadedId);
    const byMessage = Object.fromEntries(uploaded.map((e) => [e.commit.message.trim(), e.commit]));
    expect(byMessage['Create book'].author.email).toBe(OTHER_DEVICE.email);
    expect(byMessage['Add Samba de Teste'].author.email).toBe(OTHER_DEVICE.email);
    expect(byMessage['Add Baião de Teste'].author.email).toBe(ACCOUNT);
    expect(emailsOf(uploaded)).not.toContain(`${w.deviceId}@${DOMAIN}`);

    // The pushed home book carries the account's address only.
    expect(new Set(await remoteEmails(service.home))).toEqual(new Set([ACCOUNT]));

    // Working-copy files, the unsaved change included, are byte-identical.
    expect(await w.fs().promises.readFile(`${w.dir(bookId)}/marcha-teste.cifra.md`, 'utf8')).toBe(filesBefore.marcha);
    expect(await w.fs().promises.readFile(`${w.dir(bookId)}/valsa-teste.cifra.md`, 'utf8')).toBe(filesBefore.valsa);
    expect(await w.fs().promises.readFile(`${w.dir(MY_SONGS_ID)}/${mySongsPath}`, 'utf8')).toBe(filesBefore.mine);
    // …and the edit still reads as unsaved: a save preview reports it changed.
    const preview = await ask(
      w,
      command(CommandKind.PREVIEW_SAVE, { bookId, paths: ['marcha-teste.cifra.md'] }),
      EventKind.SAVE_PREVIEW,
      (p) => p.bookId === bookId,
    );
    expect(preview.previews[0].changes.length).toBeGreaterThan(0);

    // History marks the rewritten saves as the user's own (Decision 7).
    const { entries } = await ask(
      w,
      command(CommandKind.SONG_LOG, { bookId, path: 'valsa-teste.cifra.md' }),
      EventKind.SONG_LOG,
      (p) => p.bookId === bookId,
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.author.self === true)).toBe(true);
    const foreign = await ask(
      w,
      command(CommandKind.SONG_LOG, { bookId: uploadedId, path: 'samba-teste.cifra.md' }),
      EventKind.SONG_LOG,
      (p) => p.bookId === uploadedId,
    );
    expect(foreign.entries.map((e) => e.author.self)).toEqual([false]);

    // A second ATTACH_HOME rewrites nothing (idempotent).
    const heads = {};
    for (const id of [bookId, MY_SONGS_ID, uploadedId]) heads[id] = await headOf(w, id);
    const homeHead = await headOf(w, HOME_BOOK_ID);
    await signIn(w);
    for (const id of [bookId, MY_SONGS_ID, uploadedId]) expect(await headOf(w, id)).toBe(heads[id]);
    expect((await commitsOf(w, HOME_BOOK_ID)).map((e) => e.oid)).toContain(homeHead);
  }, 120000);

  it('hosted pushes are authored by the account: a save, a home setting and a merge (DIRECTION §3.3; acceptance 1)', async () => {
    const w = await makeDevice(service);
    await open(w);
    const localId = await localBook(w, 'Banda do Bairro');
    await write(w, localId, 'marcha-teste.cifra.md', song('Marcha de Teste', 'um dois feijão'));
    await save(w, localId, 'marcha-teste.cifra.md', 'Add Marcha de Teste');
    await signIn(w);

    // Put online after sign-in: the book's whole history goes up.
    const bookId = await putOnline(service, w, localId);
    const remote = service.remoteOf(bookId);
    expect(new Set(await remoteEmails(remote))).toEqual(new Set([ACCOUNT]));

    // Someone else's save lands on the service meanwhile.
    const work = mkdtempSync(nodePath.join(tmpdir(), 'ca-ana-'));
    scratch.push(work);
    const env = {
      PATH: process.env.PATH,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: ANA.name,
      GIT_AUTHOR_EMAIL: ANA.email,
      GIT_COMMITTER_NAME: ANA.name,
      GIT_COMMITTER_EMAIL: ANA.email,
    };
    await run('git', ['clone', '-q', remote.repoDir, work], env);
    writeFileSync(nodePath.join(work, 'frevo-teste.cifra.md'), song('Frevo de Teste', 'sete oito pão'));
    await run('git', ['-C', work, 'add', '.'], env);
    await run('git', ['-C', work, 'commit', '-qm', 'Add Frevo de Teste'], env);
    await run('git', ['-C', work, 'push', '-q', 'origin', 'HEAD:main'], env);

    // This device saves on top of its own head (the push is refused, the save
    // waits), changes a setting, and syncs: the merge is made and pushed.
    await write(w, bookId, 'marcha-teste.cifra.md', song('Marcha de Teste', 'um dois três feijão'));
    await save(w, bookId, 'marcha-teste.cifra.md', 'Change a line');
    w.send(command(CommandKind.SET_THEME, { theme: 'palco' }));
    await waitEvent(w, EventKind.PREFERENCES, (p) => p.theme?.value === 'palco');
    const mark = w.events.length;
    w.send(command(CommandKind.SYNC, { reason: 'test' }));
    await waitEvent(w, EventKind.SYNC, (p) => p.bookId === bookId && p.phase === 'in_step', mark);
    await waitFor(async () => {
      const merges = await run('git', ['--git-dir', remote.repoDir, 'rev-list', '--merges', 'main']);
      expect(merges.trim()).not.toBe('');
    }, WAIT);

    // On the book's remote: this device's commits — the merge included — are
    // the account's; Ana's is hers; no local address is reachable.
    const mergeEmails = await run('git', ['--git-dir', remote.repoDir, 'log', '--merges', '--format=%ae%n%ce', 'main']);
    expect(new Set(mergeEmails.split('\n').filter(Boolean))).toEqual(new Set([ACCOUNT]));
    expect(new Set(await remoteEmails(remote))).toEqual(new Set([ACCOUNT, ANA.email]));
    const changeMsg = await run('git', ['--git-dir', remote.repoDir, 'log', '--format=%s|%ae', 'main']);
    expect(changeMsg).toContain(`Change a line|${ACCOUNT}`);

    // The home book, the setting's commit pushed with it.
    await waitFor(async () => {
      const prefs = await run('git', ['--git-dir', service.home.repoDir, 'show', 'main:preferences.json']);
      expect(prefs).toContain('palco');
    }, WAIT);
    expect(new Set(await remoteEmails(service.home))).toEqual(new Set([ACCOUNT]));
    for (const remoteEmail of [...(await remoteEmails(remote)), ...(await remoteEmails(service.home))]) {
      expect(remoteEmail).not.toBe(`local@${DOMAIN}`);
      expect(remoteEmail).not.toBe(`${w.deviceId}@${DOMAIN}`);
    }
  }, 120000);

  it('an interrupted sign-in: the id is kept and the rewrite done offline; the restart attach pushes account commits only (Constraints 7-8)', async () => {
    const idb = new IDBFactory();
    const name = `ca-${rand()}`;
    const w = await makeDevice(service, { idb, name });
    await open(w);
    const bookId = await localBook(w, 'Rascunhos');
    await write(w, bookId, 'marcha-teste.cifra.md', song('Marcha de Teste', 'um dois feijão'));
    await save(w, bookId, 'marcha-teste.cifra.md', 'Add Marcha de Teste');
    w.send(command(CommandKind.SET_THEME, { theme: 'palco' }));
    await waitEvent(w, EventKind.PREFERENCES, (p) => p.theme?.value === 'palco');

    // Signed in, but the network goes before the attach reaches the service.
    service.offline = true;
    expect(await signIn(w)).toEqual({ attached: false, restored: false });
    expect((await readMeta(w)).accountId).toBe(ACCOUNT_ID);
    for (const id of [bookId, HOME_BOOK_ID]) {
      expect(new Set(emailsOf(await commitsOf(w, id))), id).toEqual(new Set([ACCOUNT]));
    }
    expect(await remoteHead(service.home).catch(() => null)).toBeNull();

    // The network returns; the app restarts and attaches at start.
    service.offline = false;
    const restarted = await makeDevice(service, { idb, name, signedIn: true });
    await open(restarted);
    await waitEvent(restarted, EventKind.HOME_ATTACHED, (p) => p.attached === true);
    await waitFor(async () => expect(await remoteHead(service.home)).toBeTruthy(), WAIT);
    expect(new Set(await remoteEmails(service.home))).toEqual(new Set([ACCOUNT]));
    // …and a put online of the local book pushes the account's commits only.
    const hosted = await putOnline(service, restarted, bookId);
    expect(new Set(await remoteEmails(service.remoteOf(hosted)))).toEqual(new Set([ACCOUNT]));
  }, 120000);

  it('a SAVE racing the re-author is kept on main and authored as the account (Constraint 6)', async () => {
    const w = await makeDevice(service);
    await open(w);
    const bookId = await localBook(w, 'Rascunhos');
    for (let i = 0; i < 3; i += 1) {
      await write(w, bookId, `cancao-${i}.cifra.md`, song(`Canção ${i}`, `verso ${i} de teste`));
      await save(w, bookId, `cancao-${i}.cifra.md`, `Add Canção ${i}`);
    }
    const RACED = song('Canção 0', 'verso corrido de teste');
    await write(w, bookId, 'cancao-0.cifra.md', RACED);

    // The sign-in and the save dispatched together: the save runs while the
    // re-author does.
    w.session.signedIn = true;
    const mark = w.events.length;
    w.send(command(CommandKind.ATTACH_HOME, { accountId: ACCOUNT_ID }));
    w.send(command(CommandKind.SAVE, { bookId, paths: ['cancao-0.cifra.md'], message: 'Racing save' }));
    await waitEvent(w, EventKind.HOME_ATTACHED, () => true, mark);
    await waitEvent(w, EventKind.SAVED, (p) => p.bookId === bookId, mark);
    // Let any in-flight book work settle.
    await navigator.locks.request(`book:${bookId}`, { mode: 'exclusive' }, () => {});

    const entries = await commitsOf(w, bookId);
    const raced = entries.find((e) => e.commit.message.trim() === 'Racing save');
    expect(raced, 'the racing save is on main').toBeTruthy();
    expect(raced.commit.author.email).toBe(ACCOUNT);
    expect(new Set(emailsOf(entries))).toEqual(new Set([ACCOUNT]));
    expect(entries.map((e) => e.commit.message.trim())).toEqual([
      'Racing save',
      'Add Canção 2',
      'Add Canção 1',
      'Add Canção 0',
      expect.any(String),
    ]);
  }, 120000);

  it('sign-out reverts authorship going forward only; a new account rewrites only what came after (sign_out.md:360-363; Constraint 9)', async () => {
    const w = await makeDevice(service);
    await open(w);
    await signIn(w);
    const bookId = await localBook(w, 'Rascunhos');
    await write(w, bookId, 'marcha-teste.cifra.md', song('Marcha de Teste', 'um dois feijão'));
    await save(w, bookId, 'marcha-teste.cifra.md', 'Signed-in save');
    const signedIn = await commitsOf(w, bookId);
    expect(new Set(emailsOf(signedIn))).toEqual(new Set([ACCOUNT]));
    const accountOids = signedIn.map((e) => e.oid);

    await ask(w, command(CommandKind.SIGN_OUT, { mode: 'keep' }), EventKind.SIGNED_OUT);
    w.session.signedIn = false;
    const meta = await readMeta(w);
    expect(meta.accountId ?? null).toBeNull();

    // The next save in the kept book is local, and the account's commits stand.
    await write(w, bookId, 'marcha-teste.cifra.md', song('Marcha de Teste', 'um dois três feijão'));
    await save(w, bookId, 'marcha-teste.cifra.md', 'Signed-out save');
    const local = `${meta.localAuthorId}@${DOMAIN}`;
    const afterOut = await commitsOf(w, bookId);
    expect(afterOut[0].commit.message.trim()).toBe('Signed-out save');
    expect(afterOut[0].commit.author.email).toBe(local);
    expect(afterOut[0].commit.committer.email).toBe(local);
    expect(afterOut.slice(1).map((e) => e.oid)).toEqual(accountOids);

    // Signing in as a different account rewrites only the post-sign-out commit.
    const OTHER_ID = 'u_beef02';
    await signIn(w, OTHER_ID);
    const afterIn = await commitsOf(w, bookId);
    expect(afterIn[0].commit.message.trim()).toBe('Signed-out save');
    expect(afterIn[0].commit.author.email).toBe(`${OTHER_ID}@${DOMAIN}`);
    expect(afterIn[0].commit.parent).toEqual([accountOids[0]]);
    expect(afterIn.slice(1).map((e) => e.oid)).toEqual(accountOids);
    expect(emailsOf(afterIn.slice(1)).every((e) => e === ACCOUNT)).toBe(true);
  }, 120000);

  // account.author_name Constraint 3; workflow 4 §Who made the change (lines
  // 131-137): changing the name on the Account screen authors the saves made
  // after it; an earlier save keeps its oid and the name it was made with —
  // history is not rewritten.
  it('a changed name authors the next save; the earlier commit keeps its oid and old name (account.author_name)', async () => {
    const w = await makeDevice(service);
    await open(w);
    w.send(command(CommandKind.SET_IDENTITY_NAME, { name: 'Ana Teste' }));
    await waitEvent(w, EventKind.PREFERENCES, (p) => p.authorName?.value === 'Ana Teste');

    const bookId = await localBook(w, 'Rascunhos');
    await write(w, bookId, 'marcha-teste.cifra.md', song('Marcha de Teste', 'um dois feijão'));
    await save(w, bookId, 'marcha-teste.cifra.md', 'Before the change');
    const [before] = await commitsOf(w, bookId);
    expect(before.commit.author.name).toBe('Ana Teste');

    w.send(command(CommandKind.SET_IDENTITY_NAME, { name: 'Ana Lima' }));
    await waitEvent(w, EventKind.PREFERENCES, (p) => p.authorName?.value === 'Ana Lima');

    await write(w, bookId, 'marcha-teste.cifra.md', song('Marcha de Teste', 'um dois três feijão'));
    await save(w, bookId, 'marcha-teste.cifra.md', 'After the change');
    const after = await commitsOf(w, bookId);
    expect(after[0].commit.message.trim()).toBe('After the change');
    expect(after[0].commit.author.name).toBe('Ana Lima');
    expect(after[0].commit.parent).toEqual([before.oid]);
    const earlier = after.find((e) => e.oid === before.oid);
    expect(earlier.commit.author.name).toBe('Ana Teste');
    expect(earlier.commit.message.trim()).toBe('Before the change');
  }, 120000);
});

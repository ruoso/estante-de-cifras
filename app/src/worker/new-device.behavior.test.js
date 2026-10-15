// Behavior (Worker) — a new device (account.new_device, workflow 13 §What comes
// down, §Books that were only on the other device, §A device used before
// signing in). Two devices, A and B, are two Worker instances over their own
// fake IndexedDB, each driven through the loopback; they share REAL git remotes
// (startGitHttpRemote) — one for the account's home book and one per hosted
// book — standing in for the service. `GET /api/account/home-book`,
// `POST /api/books` and the change check are served by an injected `fetch`
// double that answers 200 or 401 (signed in or not) and can cut a remote off
// (no network).
//
// Pins workflow 13 (the home book first, the shelf filling, only on your
// iPhone, a device used before signing in), workflow 8 (home books merge key by
// key, the later change wins), workflow 7 (the upload preview's unrelated
// histories), DIRECTION §3.2 and home-book-format §4.2/§7 (`devices`,
// `mySongs`). Song text and names are written for the test (no-song-text rule).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { spawn } from 'node:child_process';
import { getConfig, resolveRef, log as gitLog } from 'isomorphic-git';

import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { MY_SONGS_ID } from './my-songs.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';

const IDENTITY = { id: 'local', name: 'Me' };
const HOME_ID = 'srv-home-1';
const rand = () => Math.random().toString(36).slice(2);
const FENCE = '```';
const song = (title, line) => [`# ${title}`, '', FENCE, 'C   G', line, FENCE, ''].join('\n');
const UA_ANDROID_PHONE =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const UA_ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 8.1.0; SM-T837A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const UKULELE = { catalogId: 'ukulele', label: 'Ukulele · GCEA', tuning: 'G4 C4 E4 A4', fretCount: 15 };
const WAIT = { timeout: 20000, interval: 25 };

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
const remoteHead = (remote) =>
  run('git', ['--git-dir', remote.repoDir, 'rev-parse', 'refs/heads/main']).then((s) => s.trim());
const remoteFile = (remote, file) => run('git', ['--git-dir', remote.repoDir, 'show', `main:${file}`]);

// ---- the service double --------------------------------------------------

const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

async function makeService() {
  const home = await startGitHttpRemote({ seed: false });
  const service = {
    home,
    homeCalls: 0,
    remotes: [home],
    spare: [],
    created: [],
    changeChecks: [],
    blocked: new Set(),
    // A fresh empty remote for the next `POST /api/books` (a put-online).
    async provide(n = 1) {
      for (let i = 0; i < n; i += 1) {
        const remote = await startGitHttpRemote({ seed: false });
        service.spare.push(remote);
        service.remotes.push(remote);
      }
    },
    // `device` is who is asking: its `signedIn` is its session (a cookie).
    async fetch(url, init = {}, device = {}) {
      if (typeof url === 'string' && url.startsWith('http')) {
        for (const prefix of service.blocked) {
          if (url.startsWith(prefix)) throw new TypeError('Failed to fetch');
        }
        return globalThis.fetch(url, init);
      }
      const method = init.method ?? 'GET';
      if (url === '/api/account/home-book') {
        service.homeCalls += 1;
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
        service.changeChecks.push(JSON.parse(init.body));
        return response(200, { books: [] });
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

// A device: a Worker over its own (or a given — a restart) fake IndexedDB. The
// five-minute heartbeat is stubbed out so a pass runs only when asked.
async function makeDevice(
  service,
  { userAgent = UA_ANDROID_TABLET, idb = new IDBFactory(), name = `nd-${rand()}`, signedIn = false } = {},
) {
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  const deviceId = await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const events = [];
  const session = { signedIn: signedIn };
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
  const device = {
    idb,
    name,
    deviceId,
    events,
    userAgent,
    session,
    send: (cmd) => endpoint.postMessage(cmd),
    // A fresh filesystem instance reads what the Worker has flushed.
    fs: () => createFileSystem(`${name}-fs`, { indexedDB: idb }),
    dir: (bookId) => `/books/${bookId}`,
  };
  return device;
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

// Start the device: OPEN, then wait until the start-time attach has asked the
// service (signed out: it ends quietly).
async function open(service, w) {
  const calls = service.homeCalls;
  await ask(w, command(CommandKind.OPEN, { device: { userAgent: w.userAgent } }), EventKind.RECENTS);
  await waitFor(() => expect(service.homeCalls).toBeGreaterThan(calls), WAIT);
}

// Sign in: the service now has a session for this device, and the view sends
// ATTACH_HOME (AppShell's onSignedIn).
async function signIn(service, w) {
  w.session.signedIn = true;
  return ask(w, command(CommandKind.ATTACH_HOME, {}), EventKind.HOME_ATTACHED);
}

// The editor's WRITE, waited out: the re-index it makes says it landed.
async function write(w, bookId, path, text) {
  await ask(w, command(CommandKind.WRITE, { bookId, path, text }), EventKind.INDEX_STATUS, (p) => p.bookId === bookId);
}

async function syncHome(w) {
  return ask(w, command(CommandKind.SYNC_HOME, { author: IDENTITY }), EventKind.INSTRUMENTS);
}

async function localBookWithSong(w, title, path, text) {
  const { bookId } = await ask(w, command(CommandKind.CREATE_BOOK, { title, author: IDENTITY }), EventKind.BOOK_CREATED);
  if (path) {
    await write(w, bookId, path, text);
    await ask(
      w,
      command(CommandKind.SAVE, { bookId, paths: [path], message: 'Add', author: IDENTITY }),
      EventKind.SAVED,
      (p) => p.bookId === bookId,
    );
  }
  return bookId;
}

async function putOnline(service, w, bookId) {
  await service.provide();
  const reply = await ask(
    w,
    command(CommandKind.PUT_ONLINE, { bookId, author: IDENTITY }),
    EventKind.BOOK_ONLINE,
    (p) => p.previousBookId === bookId,
  );
  return reply.bookId;
}

// A song into this device's *My songs* (workflow 3): NEW_SONG, the editor's
// WRITE, the first save.
async function mySongsSong(w, text) {
  const { bookId, path } = await ask(
    w,
    command(CommandKind.NEW_SONG, { mySongsTitle: 'My songs', author: IDENTITY }),
    EventKind.NEW_SONG_READY,
  );
  await write(w, bookId, path, text);
  const saved = await ask(
    w,
    command(CommandKind.NAME_AND_SAVE, { bookId, fromPath: path, author: IDENTITY }),
    EventKind.SAVED,
    (p) => p.bookId === bookId,
  );
  return saved.path;
}

async function search(w, query) {
  const reply = await ask(w, command(CommandKind.SEARCH, { query }), EventKind.SEARCH_RESULTS, (p) => p.query === query);
  return reply.results;
}

const readShelf = async (w) => JSON.parse(await w.fs().promises.readFile(`/books/${HOME_BOOK_ID}/shelf.json`, 'utf8'));
const config = (w, path) => getConfig({ fs: w.fs(), dir: w.dir(HOME_BOOK_ID), path });
const lastPayload = (w, kind) => [...w.events].reverse().find((e) => e.kind === kind)?.payload;
const fillSteps = (w, from = 0) => {
  // The fill's (book, state) steps, a run of progress reports read as one.
  const steps = [];
  for (const e of w.events.slice(from)) {
    if (e.kind !== EventKind.SHELF_FILL) continue;
    const last = steps[steps.length - 1];
    if (last && last[0] === e.payload.bookId && last[1] === e.payload.state) continue;
    steps.push([e.payload.bookId, e.payload.state]);
  }
  return steps;
};

let restoreLocks;
let service;
beforeEach(async () => {
  restoreLocks = installWebLocks();
  service = await makeService();
});
afterEach(async () => {
  await service.stop();
  restoreLocks();
});

describe('a new device (account.new_device, workflow 13)', () => {
  it('a first device: attach pushes this device’s home book into the empty one, restored: false', async () => {
    const a = await makeDevice(service);
    await open(service, a);
    a.send(command(CommandKind.SET_THEME, { theme: 'palco', author: IDENTITY }));
    await waitEvent(a, EventKind.PREFERENCES, (p) => p.theme?.value === 'palco');

    const attached = await signIn(service, a);
    expect(attached).toEqual({ attached: true, restored: false });
    // The account's home book is this device's now: the remote's main is local main.
    const localHead = await resolveRef({ fs: a.fs(), dir: a.dir(HOME_BOOK_ID), ref: 'main' });
    expect(await remoteHead(service.home)).toBe(localHead);
    expect(await config(a, 'remote.origin.url')).toBe(service.home.url);
    expect(await config(a, 'remote.origin.estanteid')).toBe(HOME_ID);
    // The device wrote its kind for itself (Decision 5), as a token.
    const shelf = JSON.parse(await remoteFile(service.home, 'shelf.json'));
    expect(shelf.devices[a.deviceId].kind.value).toBe('android-tablet');
  }, 60000);

  it('the home book first, then the shelf filling: settings come down before any book, books clone one at a time in shelf order', async () => {
    // Device A: a theme, an instrument and two hosted books, its home book pushed.
    const a = await makeDevice(service);
    await open(service, a);
    await signIn(service, a);
    a.send(command(CommandKind.SET_THEME, { theme: 'palco', author: IDENTITY }));
    await waitEvent(a, EventKind.PREFERENCES, (p) => p.theme?.value === 'palco');
    await ask(
      a,
      command(CommandKind.SAVE_INSTRUMENT, { definition: UKULELE, author: IDENTITY }),
      EventKind.INSTRUMENTS,
      (p) => p.instruments.length === 1,
    );
    const first = await putOnline(
      service,
      a,
      await localBookWithSong(a, 'Banda do Bairro', 'marcha-teste.cifra.md', song('Marcha de Teste', 'um dois feijão')),
    );
    const second = await putOnline(
      service,
      a,
      await localBookWithSong(a, 'Valsas', 'valsa-teste.cifra.md', song('Valsa de Teste', 'tres quatro arroz')),
    );
    await syncHome(a);

    // Device B, never used, signs in.
    const b = await makeDevice(service);
    await open(service, b);
    const mark = b.events.length;
    const attached = await signIn(service, b);
    expect(attached).toEqual({ attached: true, restored: true });
    expect(await config(b, 'remote.origin.url')).toBe(service.home.url);
    expect(await config(b, 'remote.origin.estanteid')).toBe(HOME_ID);
    const shelfAtAttach = await readShelf(b);

    // Both books reach *ready*.
    await waitEvent(b, EventKind.SHELF_FILL, (p) => p.bookId === second && p.state === 'ready', mark);
    const events = b.events.slice(mark);
    const prefsAt = events.findIndex((e) => e.kind === EventKind.PREFERENCES && e.payload.theme?.value === 'palco');
    const instrumentsAt = events.findIndex(
      (e) => e.kind === EventKind.INSTRUMENTS && e.payload.instruments.some((i) => i.label === UKULELE.label),
    );
    const firstFillAt = events.findIndex((e) => e.kind === EventKind.SHELF_FILL);
    // The settings are surfaced before the shelf shows anything filling.
    expect(prefsAt).toBeGreaterThanOrEqual(0);
    expect(instrumentsAt).toBeGreaterThanOrEqual(0);
    expect(prefsAt).toBeLessThan(firstFillAt);
    expect(instrumentsAt).toBeLessThan(firstFillAt);

    // Every book listed at once as waiting, then cloning → ready in turn.
    expect(fillSteps(b, mark)).toEqual([
      [first, 'waiting'],
      [second, 'waiting'],
      [first, 'cloning'],
      [first, 'ready'],
      [second, 'cloning'],
      [second, 'ready'],
    ]);
    expect(find(b, EventKind.SHELF_FILL, (p) => p.bookId === first && p.state === 'ready', mark).payload.songs).toBe(1);

    // Each book is searchable once ready.
    const results = await search(b, 'Marcha');
    expect(results.some((r) => r.bookId === first)).toBe(true);
    expect((await search(b, 'Valsa')).some((r) => r.bookId === second)).toBe(true);

    // The clone wrote nothing to the shelf: its registers are as they came down.
    expect(JSON.stringify((await readShelf(b)).books)).toBe(JSON.stringify(shelfAtAttach.books));
  }, 90000);

  it('a clone that fails for want of a network goes back to waiting, and completes on the next start', async () => {
    const a = await makeDevice(service);
    await open(service, a);
    await signIn(service, a);
    const bookId = await putOnline(
      service,
      a,
      await localBookWithSong(a, 'Choros', 'choro-teste.cifra.md', song('Choro de Teste', 'cavaco')),
    );
    await syncHome(a);
    const bookRemote = service.created.find((c) => c.id === bookId).remote;

    service.blocked.add(bookRemote.url);
    const b = await makeDevice(service);
    await open(service, b);
    const mark = b.events.length;
    await signIn(service, b);
    // Listed, tried, and back to waiting (a later trigger may try again, and
    // waits again) — never failed, never ready.
    await waitFor(() => {
      const steps = fillSteps(b, mark);
      expect(steps.slice(0, 3)).toEqual([
        [bookId, 'waiting'],
        [bookId, 'cloning'],
        [bookId, 'waiting'],
      ]);
      expect(steps[steps.length - 1]).toEqual([bookId, 'waiting']);
    }, WAIT);
    await new Promise((r) => setTimeout(r, 200));
    expect(fillSteps(b, mark).every(([, state]) => state === 'waiting' || state === 'cloning')).toBe(true);
    expect(find(b, EventKind.SHELF_FILL, (p) => p.state === 'ready', mark)).toBeUndefined();

    // The network is back; the next start (a new Worker over the same IndexedDB)
    // resumes the fill.
    service.blocked.delete(bookRemote.url);
    const restarted = await makeDevice(service, { idb: b.idb, name: b.name, signedIn: true });
    restarted.send(command(CommandKind.OPEN, { device: { userAgent: UA_ANDROID_TABLET } }));
    await waitEvent(restarted, EventKind.SHELF_FILL, (p) => p.bookId === bookId && p.state === 'ready');
    expect((await search(restarted, 'Choro')).some((r) => r.bookId === bookId)).toBe(true);
  }, 90000);

  it('a device used before signing in: its home book merges key by key (the later change wins), with two parents, and is pushed', async () => {
    const a = await makeDevice(service);
    await open(service, a);
    await signIn(service, a);
    // A sets the theme first (earlier), then the language.
    a.send(command(CommandKind.SET_THEME, { theme: 'caderno', author: IDENTITY }));
    await waitEvent(a, EventKind.PREFERENCES, (p) => p.theme?.value === 'caderno');
    a.send(command(CommandKind.SET_LANGUAGE, { language: 'it', author: IDENTITY }));
    await waitEvent(a, EventKind.PREFERENCES, (p) => p.language?.value === 'it');
    await syncHome(a);

    // B, used before signing in: the same key later, and a local book.
    const b = await makeDevice(service);
    await open(service, b);
    await new Promise((r) => setTimeout(r, 5));
    b.send(command(CommandKind.SET_THEME, { theme: 'palco', author: IDENTITY }));
    await waitEvent(b, EventKind.PREFERENCES, (p) => p.theme?.value === 'palco');
    const localId = await localBookWithSong(b, 'Rascunhos');

    const attached = await signIn(service, b);
    expect(attached.restored).toBe(true);
    const prefs = lastPayload(b, EventKind.PREFERENCES);
    expect(prefs.theme.value).toBe('palco'); // the later change wins
    expect(prefs.language.value).toBe('it'); // the other key merged in

    const fs = b.fs();
    const head = await resolveRef({ fs, dir: b.dir(HOME_BOOK_ID), ref: 'main' });
    const [top] = await gitLog({ fs, dir: b.dir(HOME_BOOK_ID), ref: 'main', depth: 1 });
    expect(top.commit.parent).toHaveLength(2);
    expect(await remoteHead(service.home)).toBe(head); // pushed
    const remoteShelf = JSON.parse(await remoteFile(service.home, 'shelf.json'));
    expect(remoteShelf.local[b.deviceId][localId].title.value).toBe('Rascunhos');
  }, 60000);

  it('only on your Android phone: another device’s local book is listed, not openable, and comes in once put online there', async () => {
    const a = await makeDevice(service, { userAgent: UA_ANDROID_PHONE });
    await open(service, a);
    await signIn(service, a);
    const localId = await localBookWithSong(a, 'Rascunhos', 'rascunho.cifra.md', song('Rascunho de Teste', 'lá lá'));
    await syncHome(a);

    const b = await makeDevice(service);
    await open(service, b);
    await signIn(service, b);
    const shelf = lastPayload(b, EventKind.SHELF);
    expect(shelf.elsewhere).toEqual([
      { deviceId: a.deviceId, bookId: localId, title: 'Rascunhos', kind: 'android-phone', position: 0 },
    ]);
    // Not B's to open: not on B's own shelf, nothing of it on B.
    expect(shelf.local[localId]).toBeUndefined();
    expect(shelf.books[localId]).toBeUndefined();
    await expect(b.fs().promises.stat(b.dir(localId))).rejects.toMatchObject({ code: 'ENOENT' });

    // A puts it online; B's next home sync drops it from `elsewhere` and fills it.
    const serviceId = await putOnline(service, a, localId);
    await syncHome(a);
    const mark = b.events.length;
    await syncHome(b);
    await waitFor(() => expect(lastPayload(b, EventKind.SHELF).elsewhere).toEqual([]), WAIT);
    await waitEvent(b, EventKind.SHELF_FILL, (p) => p.bookId === serviceId && p.state === 'ready', mark);
  }, 90000);

  it('not signed in: a 401 at start attaches nothing; sign-out after an attach strips the service id with the remote', async () => {
    const b = await makeDevice(service);
    await open(service, b);
    await new Promise((r) => setTimeout(r, 100));
    expect(find(b, EventKind.HOME_ATTACHED)).toBeUndefined();
    expect(await config(b, 'remote.origin.url')).toBeUndefined();

    // An explicit attach while still signed out says so, and sets nothing.
    expect(await ask(b, command(CommandKind.ATTACH_HOME, {}), EventKind.HOME_ATTACHED)).toEqual({
      attached: false,
      restored: false,
    });
    expect(await config(b, 'remote.origin.url')).toBeUndefined();

    await signIn(service, b);
    expect(await config(b, 'remote.origin.estanteid')).toBe(HOME_ID);
    await ask(b, command(CommandKind.SIGN_OUT, { mode: 'keep', author: IDENTITY }), EventKind.SIGNED_OUT);
    expect(await config(b, 'remote.origin.url')).toBeUndefined();
    expect(await config(b, 'remote.origin.estanteid')).toBeUndefined();

    // Signing in again re-attaches.
    expect((await signIn(service, b)).attached).toBe(true);
    expect(await config(b, 'remote.origin.estanteid')).toBe(HOME_ID);
  }, 60000);

  it('the change check names the home book by its service id, never “home”', async () => {
    const b = await makeDevice(service);
    await open(service, b);
    await signIn(service, b);
    const checks = service.changeChecks.length;
    b.send(command(CommandKind.SYNC, { reason: 'test' }));
    await waitFor(() => expect(service.changeChecks.length).toBeGreaterThan(checks), WAIT);
    const ids = service.changeChecks.slice(checks).flatMap((c) => c.books.map((x) => x.bookId));
    expect(ids).toContain(HOME_ID);
    expect(ids).not.toContain(HOME_BOOK_ID);
  }, 60000);
});

describe('the two My songs (account.new_device, workflow 13 §A device used before signing in)', () => {
  const SHARED = song('Tarde Clara', 'versão do telefone');
  const SHARED_B = song('Tarde Clara', 'versão do tablet');
  const ONLY_B = song('Noite de Lua', 'só no tablet');

  // A's *My songs*, with one song, put online: `shelf.mySongs` names it.
  async function accountMySongsOnline() {
    const a = await makeDevice(service, { userAgent: UA_ANDROID_PHONE });
    await open(service, a);
    await signIn(service, a);
    await mySongsSong(a, SHARED);
    const accountBookId = await putOnline(service, a, MY_SONGS_ID);
    await syncHome(a);
    const shelf = JSON.parse(await remoteFile(service.home, 'shelf.json'));
    expect(shelf.mySongs.value).toBe(accountBookId);
    return { a, accountBookId };
  }

  // B, used before signing in, with songs in its own *My songs*.
  async function deviceWithMySongs(texts) {
    const b = await makeDevice(service);
    await open(service, b);
    const paths = [];
    for (const text of texts) paths.push(await mySongsSong(b, text));
    return { b, paths };
  }

  it('offers the choice when the account’s My songs is online and this device’s has songs', async () => {
    const { accountBookId } = await accountMySongsOnline();
    const { b } = await deviceWithMySongs([ONLY_B]);
    const mark = b.events.length;
    await signIn(service, b);
    const offer = await waitEvent(b, EventKind.MY_SONGS_CHOICE, (p) => p.offered && p.ready, mark);
    expect(offer).toMatchObject({ offered: true, accountBookId, ready: true, kind: 'android-tablet' });
  }, 90000);

  it('does not offer when the account’s My songs is only local on another device', async () => {
    const a = await makeDevice(service, { userAgent: UA_ANDROID_PHONE });
    await open(service, a);
    await signIn(service, a);
    await mySongsSong(a, SHARED);
    await syncHome(a);

    const { b } = await deviceWithMySongs([ONLY_B]);
    const mark = b.events.length;
    await signIn(service, b);
    expect(await waitEvent(b, EventKind.MY_SONGS_CHOICE, () => true, mark)).toEqual({ offered: false });
    // A's is listed as only on A instead.
    expect(lastPayload(b, EventKind.SHELF).elsewhere.map((e) => [e.bookId, e.kind])).toEqual([
      [MY_SONGS_ID, 'android-phone'],
    ]);
  }, 90000);

  it('keep both relabels this device’s My songs and stops the offer, across a restart', async () => {
    await accountMySongsOnline();
    const { b } = await deviceWithMySongs([ONLY_B]);
    await signIn(service, b);
    await waitEvent(b, EventKind.MY_SONGS_CHOICE, (p) => p.offered);

    const mark = b.events.length;
    b.send(command(CommandKind.KEEP_BOTH_MY_SONGS, { title: 'My songs (this device)', author: IDENTITY }));
    expect(await waitEvent(b, EventKind.MY_SONGS_CHOICE, () => true, mark)).toEqual({ offered: false });
    expect(lastPayload(b, EventKind.SHELF).local[MY_SONGS_ID].title.value).toBe('My songs (this device)');

    // The next start does not ask again.
    const restarted = await makeDevice(service, { idb: b.idb, name: b.name, signedIn: true });
    restarted.send(command(CommandKind.OPEN, { device: { userAgent: UA_ANDROID_TABLET } }));
    expect(await waitEvent(restarted, EventKind.MY_SONGS_CHOICE)).toEqual({ offered: false });
  }, 90000);

  it('merge previews the unrelated histories, and Merge and save lands this device’s songs — unsaved edit included — and retires its My songs', async () => {
    const { accountBookId } = await accountMySongsOnline();
    const { b, paths } = await deviceWithMySongs([SHARED_B, ONLY_B]);
    const [sharedPath, onlyPath] = paths;
    // An unsaved edit to B's own song, carried by the merge (workflow 13 delta).
    const edited = song('Noite de Lua', 'só no tablet, editada');
    await write(b, MY_SONGS_ID, onlyPath, edited);
    await signIn(service, b);
    await waitEvent(b, EventKind.MY_SONGS_CHOICE, (p) => p.offered && p.ready);

    const preview = await ask(
      b,
      command(CommandKind.PREVIEW_MY_SONGS, { target: accountBookId }),
      EventKind.UPLOAD_PREVIEW,
    );
    expect(preview.sharedHistory).toBe(false);
    expect(preview.previews.find((p) => p.path === sharedPath).status).toBe('conflict');
    expect(preview.previews.find((p) => p.path === onlyPath).status).toBe('added');

    // Merge and save: the two share no history, so the song in both goes to the
    // conflict session first (workflow 7 §Unrelated history).
    const synced = await ask(
      b,
      command(CommandKind.IMPORT_UPLOAD, {
        uploadId: preview.uploadId,
        choice: 'merge',
        target: { bookId: accountBookId },
        author: IDENTITY,
        fromMySongs: true,
      }),
      EventKind.SYNC,
      (p) => p.bookId === accountBookId,
    );
    expect(synced.phase).toBe('needs_you');
    // Not retired while the merge is half done.
    expect(lastPayload(b, EventKind.SHELF).local[MY_SONGS_ID]).toBeDefined();

    await ask(b, command(CommandKind.OPEN_CONFLICTS, { bookId: accountBookId }), EventKind.CONFLICTS);
    const mark = b.events.length;
    b.send(
      command(CommandKind.RESOLVE_CONFLICT, { bookId: accountBookId, path: sharedPath, choice: 'theirs', author: IDENTITY }),
    );
    await waitFor(() => {
      const shelf = lastPayload(b, EventKind.SHELF);
      expect(shelf.local[MY_SONGS_ID].title.value).toBeNull();
    }, WAIT);
    await waitEvent(b, EventKind.INDEX_STATUS, (p) => p.bookId === MY_SONGS_ID && p.state === null, mark);

    // The account's book holds both of B's songs, the edit with it; B's own is
    // gone from disk and from search.
    const fs = b.fs();
    const dir = b.dir(accountBookId);
    expect(await fs.promises.readFile(`${dir}/${sharedPath}`, 'utf8')).toContain('versão do tablet');
    expect(await fs.promises.readFile(`${dir}/${onlyPath}`, 'utf8')).toContain('editada');
    await expect(fs.promises.stat(b.dir(MY_SONGS_ID))).rejects.toMatchObject({ code: 'ENOENT' });
    const results = await search(b, 'Noite');
    expect(results.every((r) => r.bookId !== MY_SONGS_ID)).toBe(true);
    expect(results.some((r) => r.bookId === accountBookId)).toBe(true);
  }, 120000);
});

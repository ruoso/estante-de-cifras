/**
 * e2e-api — the reMarkable reader updates its bundle and its QML from the
 * site, against the compose stack (reader.self_update;
 * docs/remarkable-reader.md §8 Updates, §10).
 *
 * An account signs in by the passkey ceremony and pairs the built reader
 * (ESTANTE_E2E_READER_BIN) through the real pairing (`pairReader`). The reader
 * then runs `sync --root R --app F`, F a stand-in for the AppLoad folder (its
 * manifest.json with id `estante`, and an old resources.rcc). At the end of
 * the pass it reads the site's public /device/manifest.json and fetches what it
 * names: the bundle, staged and — with none loaded — switched to, and the QML,
 * placed in F with the one it replaced kept in R/qml/previous/. A second sync
 * fetches nothing again. The switch on a frontend's attach and the rollback of
 * a broken bundle are pinned at the behavior level (the stack cannot serve a
 * broken bundle).
 */
import { afterEach, describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { makeTempDir } from './lib/git.js';
import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';
import { pairReader, readerSession, runReader } from './lib/reader.js';

const OLD_RCC = 'an old resources.rcc, written for this test\n';

// A signed-in client by the passkey ceremony (git.test.js's helper;
// module-local there).
async function registerNewAccount(client) {
  const beginResp = await client.postJson('/api/auth/passkey/register/begin', {});
  expect(beginResp.status).toBe(200);
  const begin = await beginResp.json();
  const credential = await new Authenticator(baseUrl).create(begin.publicKey);
  const finishResp = await client.postJson('/api/auth/passkey/register/finish', {
    state: begin.state,
    credential,
  });
  expect(finishResp.status).toBe(200);
  expect(client.cookies.has('estante_session')).toBe(true);
}

const tempDirs = [];

async function tempDir(prefix) {
  const dir = await makeTempDir(prefix);
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function bytesOf(client, path) {
  const resp = await client.get(path);
  expect(resp.status).toBe(200);
  return Buffer.from(await resp.arrayBuffer());
}

// Every file under dir, by its path relative to dir: its bytes' SHA-256 and
// when it was last written.
async function tree(dir) {
  const out = {};
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath ?? entry.path, entry.name);
    const [bytes, info] = await Promise.all([readFile(path), stat(path)]);
    out[path.slice(dir.length + 1)] = { sha256: sha256(bytes), mtimeMs: info.mtimeMs };
  }
  return out;
}

// A paired reader root, and an AppLoad folder stand-in.
async function setUp() {
  const client = new HttpClient();
  await registerNewAccount(client);
  const root = join(await tempDir('estante-e2e-reader-update-root-'), 'estante');
  await pairReader(client, root);
  const { token } = await readerSession(root);

  const app = await tempDir('estante-e2e-reader-update-app-');
  await writeFile(
    join(app, 'manifest.json'),
    `${JSON.stringify({ id: 'estante', name: 'Estante', entry: '/Main.qml', loadsBackend: true })}\n`,
  );
  await writeFile(join(app, 'resources.rcc'), OLD_RCC);
  return { client, root, app, token };
}

async function sync(root, app, token) {
  const { stdout, stderr } = await runReader(['sync', '--root', root, '--app', app]);
  expect(stdout).not.toContain(token);
  expect(stderr).not.toContain(token);
  return JSON.parse(stdout);
}

describe('the reader updates its bundle and QML from the site (reader.self_update)', () => {
  it("a paired reader's first sync brings the served bundle", async () => {
    const { client, root, app, token } = await setUp();
    await sync(root, app, token);

    // The bundle: current, beside the served manifest as it was served.
    const served = await bytesOf(client, '/device/manifest.json');
    const manifest = JSON.parse(served.toString('utf8'));
    const current = join(root, 'bundle', 'current');
    expect(await readFile(join(current, 'manifest.json'))).toEqual(served);
    expect(sha256(await readFile(join(current, manifest.bundle.path)))).toBe(manifest.bundle.sha256);
    expect(await readdir(join(root, 'bundle'))).not.toContain('next');

    // The QML: placed in the folder, the old one kept in qml/previous/.
    const qml = await bytesOf(client, `/device/${manifest.qml.path}`);
    expect(sha256(qml)).toBe(manifest.qml.sha256);
    expect(await readFile(join(app, 'resources.rcc'))).toEqual(qml);
    expect(await readFile(join(root, 'qml', 'previous', 'resources.rcc'), 'utf8')).toBe(OLD_RCC);
    // The folder's manifest.json is never written; nothing else is left there.
    expect((await readdir(app)).sort()).toEqual(['manifest.json', 'resources.rcc']);

    // Nothing refused, and the served hostApi is one this reader speaks.
    const record = JSON.parse(await readFile(join(root, 'bundle', 'update.json'), 'utf8'));
    expect(record).toEqual({ servedHostApi: manifest.hostApi, refused: [] });
  });

  it('a second sync fetches no file again: its bundle/ is unchanged', async () => {
    const { root, app, token } = await setUp();
    await sync(root, app, token);
    const bundleBefore = await tree(join(root, 'bundle'));
    const appBefore = await tree(app);
    expect(Object.keys(bundleBefore)).toContain('current/manifest.json');

    await sync(root, app, token);
    expect(await tree(join(root, 'bundle'))).toEqual(bundleBefore);
    expect(await tree(app)).toEqual(appBefore);
  });
});

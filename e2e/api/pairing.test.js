/**
 * e2e-api — pairing a reMarkable against the compose stack
 * (reader.device_pairing; docs/remarkable-reader.md §5.1, §10; workflow 13
 * §Pairing a reMarkable).
 *
 * An owner signs in by the passkey ceremony, creates a book and pushes a first
 * commit with the git CLI. A second, cookie-less client — the device — begins
 * a pairing and polls `pending`; the owner approves the code typed in lower
 * case without the dash; the device polls and receives its session once. With
 * that session the git CLI and isomorphic-git each clone the book, the change
 * check and the home book answer; a push from each client is refused and the
 * book's head is unchanged; an API write is 403 `read_only`. The owner's device
 * list shows the reader's row, and signing it out from there makes the
 * device's next request 401. Shapes are pinned structurally against
 * api/openapi.yaml (DevicePairing, DevicePairingPoll, Session).
 */
import { afterEach, describe, it, expect } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { GitCli, IsoGit, makeTempDir } from './lib/git.js';
import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';

// Songs written for this test (never anyone's copyrighted words), canonical so
// the stack's hook accepts the owner's push.
const firstSong = { filename: 'leitura.cifra.md', content: '# Leitura Calma\n\n```\n[C] Folha branca\n```\n' };
const readerSong = { filename: 'nao-vai.cifra.md', content: '# Não Vai\n\n```\n[G] Só leio\n```\n' };

// DevicePairing.code (api/openapi.yaml): three-dash-three, from the alphabet
// without 0, O, 1, I and L.
const CODE = /^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/;

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
  return (await finishResp.json()).id;
}

async function createBook(client, title) {
  const resp = await client.postJson('/api/books', { title });
  expect(resp.status).toBe(201);
  return resp.json();
}

function gitEndpoint(book) {
  return new URL(book.gitUrl, `${baseUrl}/`).toString();
}

// The device's begin: no session, an empty body; 201 DevicePairing.
async function beginPairing(device) {
  const resp = await device.fetch('/api/devices/pair/begin', { method: 'POST' });
  expect(resp.status).toBe(201);
  const pairing = await resp.json();
  expect(Object.keys(pairing).sort()).toEqual(['code', 'expiresAt', 'pollToken', 'url']);
  expect(pairing.code).toMatch(CODE);
  expect(pairing.url).toBe(new URL('/pair', `${baseUrl}/`).toString());
  expect(pairing.pollToken.length).toBeGreaterThan(0);
  expect(Number.isNaN(Date.parse(pairing.expiresAt))).toBe(false);
  return pairing;
}

const poll = (device, pollToken) => device.postJson('/api/devices/pair/poll', { pollToken });

async function expectError(resp, status, code) {
  expect(resp.status).toBe(status);
  const body = await resp.json();
  expect(Object.keys(body).sort()).toEqual(['code', 'message']);
  expect(body.code).toBe(code);
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

describe('pairing a reMarkable (reader.device_pairing)', () => {
  it('a reMarkable is paired, reads, and cannot write', async () => {
    // The owner, a book, a first commit with the git CLI.
    const owner = new HttpClient();
    await registerNewAccount(owner);
    const book = await createBook(owner, 'Livro Pareado');
    const url = gitEndpoint(book);
    const seedDir = await tempDir('estante-e2e-pair-seed-');
    const seed = await GitCli.create(seedDir);
    await seed.init();
    await writeFile(join(seedDir, firstSong.filename), firstSong.content);
    await seed.add('.');
    await seed.commit('First song');
    await seed.pushHTTP(url, owner.cookieHeader());
    const head = await seed.revParse('HEAD');

    // The device begins and polls pending.
    const device = new HttpClient();
    const pairing = await beginPairing(device);
    expect(device.cookies.size).toBe(0);
    let resp = await poll(device, pairing.pollToken);
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ status: 'pending' });

    // The owner approves the code typed in lower case without the dash.
    resp = await owner.postJson('/api/devices/pair/approve', { code: pairing.code.replace('-', '').toLowerCase() });
    expect(resp.status).toBe(204);

    // The device receives its session — once.
    resp = await poll(device, pairing.pollToken);
    expect(resp.status).toBe(200);
    const approved = await resp.json();
    expect(Object.keys(approved).sort()).toEqual(['session', 'status']);
    expect(approved.status).toBe('approved');
    expect(approved.session.length).toBeGreaterThan(0);
    await expectError(await poll(device, pairing.pollToken), 404, 'pair_token_unknown');

    // From here the device carries the session as its estante_session cookie.
    device.cookies.set('estante_session', approved.session);
    const cookie = device.cookieHeader();

    // It reads: the git CLI and isomorphic-git each clone the book.
    const cliDir = await tempDir('estante-e2e-pair-cli-');
    const cli = await GitCli.cloneHTTP(url, cliDir, cookie);
    expect(await cli.revParse('HEAD')).toBe(head);
    const isoDir = await tempDir('estante-e2e-pair-iso-');
    const iso = await IsoGit.create(isoDir);
    await iso.clone({ url, cookie });
    expect(await iso.readFileAtHead(firstSong.filename)).toBe(firstSong.content);

    // The change check and the home book answer.
    resp = await device.postJson('/api/shelf/change-check', { books: [{ bookId: book.id, head }] });
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ books: [] });
    resp = await device.get('/api/account/home-book');
    expect(resp.status).toBe(200);
    expect(Object.keys(await resp.json()).sort()).toEqual(['gitUrl', 'id']);

    // A push from each client is refused, and the book's head is unchanged.
    await writeFile(join(cliDir, readerSong.filename), readerSong.content);
    await cli.add('.');
    await cli.commit('From the reader');
    await expect(cli.pushHTTP(url, cookie)).rejects.toThrow();
    await writeFile(join(isoDir, readerSong.filename), readerSong.content);
    await iso.add(readerSong.filename);
    await iso.commit('From the reader');
    await expect(iso.push({ url, cookie })).rejects.toThrow();
    const checkDir = await tempDir('estante-e2e-pair-check-');
    const check = await GitCli.cloneHTTP(url, checkDir, owner.cookieHeader());
    expect(await check.revParse('HEAD')).toBe(head);

    // An API write is refused, read_only.
    await expectError(await device.postJson('/api/books', { title: 'Do Leitor' }), 403, 'read_only');

    // The owner's device list shows the reader's row.
    const list = await owner.getJson('/api/account/sessions');
    const row = list.sessions.find((s) => s.id === approved.session);
    expect(row).toBeDefined();
    expect(row.kind).toBe('remarkable');
    expect(row.readOnly).toBe(true);
    expect(row.current).toBe(false);
    expect(row.device).toBeUndefined();

    // Signed out from there, the device's next home-book request is 401.
    resp = await owner.fetch(`/api/account/sessions/${approved.session}`, { method: 'DELETE' });
    expect(resp.status).toBe(204);
    await expectError(await device.get('/api/account/home-book'), 401, 'unauthorized');
  });

  it('a code that does not pair: unknown and used are answered apart', async () => {
    const ana = new HttpClient();
    await registerNewAccount(ana);
    const bia = new HttpClient();
    await registerNewAccount(bia);

    // A well-formed code no device is showing.
    await expectError(await ana.postJson('/api/devices/pair/approve', { code: 'KQ7-4TM' }), 404, 'pair_code_unknown');

    // A code approved once is used — for this account and for another.
    const device = new HttpClient();
    const pairing = await beginPairing(device);
    expect((await ana.postJson('/api/devices/pair/approve', { code: pairing.code })).status).toBe(204);
    await expectError(await ana.postJson('/api/devices/pair/approve', { code: pairing.code }), 409, 'pair_code_used');
    await expectError(await bia.postJson('/api/devices/pair/approve', { code: pairing.code }), 409, 'pair_code_used');
  });
});

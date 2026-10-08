/**
 * e2e-api — both device-side git clients are wired and functional in the
 * harness.
 *
 * Pins DIRECTION §3.6 line 281 (the app does git through isomorphic-git) and
 * lines 317–353 (git over HTTP), and the .tji note's "the git CLI and
 * isomorphic-git helpers init, commit and clone a local repository". Scope per
 * the refinement's Decisions: the host `git` CLI clones a local repository
 * natively, so it does the full init → commit → clone round-trip; isomorphic-git
 * has no local-filesystem clone transport (clone speaks smart HTTP), so it
 * proves init → add → commit → read-back locally, and its HTTP clone/fetch/push
 * are exercised against the live service downstream (service.git_http, sync).
 * Every test works in its own mkdtemp directory and cleans it up.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { GitCli, IsoGit, makeTempDir, buildCraftedReceivePack, demuxReceivePack } from './lib/git.js';
import { sampleSong } from './fixtures/songs.js';
import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';
import { connect } from './lib/db.js';

// The per-account storage cap the hook checks a push's growth against — 200 MB,
// history included (service/internal/server/books.go maxBytesPerAccount;
// workflow 14 docs/workflows/14-file-view.md:42-43).
const MAX_BYTES_PER_ACCOUNT = 200 * 1024 * 1024;

// A signed-in client the way a device signs in — the passkey ceremony driving
// the JS software authenticator (no seeded email, no song text). Mirrors
// books.test.js; copied because the helper is module-local there.
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
  const account = await finishResp.json();
  expect(client.cookies.has('estante_session')).toBe(true);
  return account.id;
}

async function createBook(client, title) {
  const resp = await client.postJson('/api/books', { title });
  expect(resp.status).toBe(201);
  return resp.json();
}

// The per-book git endpoint, resolved against the one origin.
function gitEndpoint(book) {
  return new URL(book.gitUrl, `${baseUrl}/`).toString();
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

describe('git clients', () => {
  it('git CLI: init, commit and clone a local repository round-trips a song', async () => {
    const bareDir = await tempDir('estante-e2e-bare-');
    const workDir = await tempDir('estante-e2e-work-');
    const cloneDir = await tempDir('estante-e2e-clone-');

    const bare = await GitCli.create(bareDir);
    await bare.init({ bare: true });

    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.addRemote('origin', bareDir);
    await work.push('origin', 'main');

    await GitCli.cloneRepo(bareDir, cloneDir);
    const readBack = await readFile(join(cloneDir, sampleSong.filename), 'utf8');
    expect(readBack).toBe(sampleSong.content);
  });

  it('isomorphic-git: init, add, commit and read a song back via log/readBlob', async () => {
    const dir = await tempDir('estante-e2e-isogit-');

    const repo = await IsoGit.create(dir);
    await repo.init();
    await writeFile(join(dir, sampleSong.filename), sampleSong.content);
    await repo.add(sampleSong.filename);
    await repo.commit('Add the tuning song');

    const commits = await repo.log();
    expect(commits).toHaveLength(1);
    expect(commits[0].commit.message.trim()).toBe('Add the tuning song');
    expect(await repo.readFileAtHead(sampleSong.filename)).toBe(sampleSong.content);
  });
});

describe('git over HTTP (service.git_http)', () => {
  // The git CLI and isomorphic-git clone, fetch and push against the live stack
  // with a real session — a device moving a book to and from Estante. Pins
  // DIRECTION §3.6 lines 320–330; the contract's Git paths.
  it('the CLI and isomorphic-git clone, fetch and push with a session', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'HTTP Round Trip');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    // The owner pushes the first commit with the git CLI (the book starts empty).
    const workDir = await tempDir('estante-e2e-work-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, cookie);

    // The CLI clones it back from a second working copy and reads the song.
    const cliCloneDir = await tempDir('estante-e2e-cliclone-');
    const cliClone = await GitCli.cloneHTTP(url, cliCloneDir, cookie);
    expect(await readFile(join(cliCloneDir, sampleSong.filename), 'utf8')).toBe(sampleSong.content);

    // isomorphic-git (the app's Worker client) clones it, then pushes a second
    // commit.
    const isoDir = await tempDir('estante-e2e-isohttp-');
    const iso = await IsoGit.create(isoDir);
    await iso.clone({ url, cookie });
    expect(await iso.readFileAtHead(sampleSong.filename)).toBe(sampleSong.content);

    await writeFile(join(isoDir, 'segundo.cifra.md'), '# Segundo\n\n```\n[Am] Teste\n```\n');
    await iso.add('segundo.cifra.md');
    await iso.commit('Add a second song');
    await iso.push({ url, cookie });
    const isoHead = (await iso.log())[0].oid;

    // The CLI clone fetches the later commit isomorphic-git pushed.
    await cliClone.fetchHTTP(url, cookie);
    const fetched = (await cliClone.run('rev-parse', 'refs/remotes/origin/main')).trim();
    expect(fetched).toBe(isoHead);
  });

  // A protocol v2 fetch from the CLI (-c protocol.version=2) negotiates and
  // transfers. Pins DIRECTION §3.6 lines 331–332.
  it('a protocol v2 clone from the CLI succeeds', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'V2 Book');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    const workDir = await tempDir('estante-e2e-v2work-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, cookie);

    const v2Dir = await tempDir('estante-e2e-v2clone-');
    await GitCli.cloneHTTP(url, v2Dir, cookie, { protocolVersion: 2 });
    expect(await readFile(join(v2Dir, sampleSong.filename), 'utf8')).toBe(sampleSong.content);
  });

  // A second account with no membership is refused — 404 on the advertisement
  // (never confirming a private book) and a failed clone and push. Pins contract
  // lines 782–790; DIRECTION §3.3 lines 175–182.
  it('a non-member is refused with 404', async () => {
    const owner = new HttpClient();
    await registerNewAccount(owner);
    const book = await createBook(owner, 'Private Book');
    const url = gitEndpoint(book);

    // Seed a first commit so the book is real (the owner can reach it).
    const workDir = await tempDir('estante-e2e-ownerwork-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, owner.cookieHeader());

    // A stranger: signed in, but not a member.
    const stranger = new HttpClient();
    await registerNewAccount(stranger);
    const strangerCookie = stranger.cookieHeader();

    const refs = await stranger.get(`/git/${book.id}/info/refs?service=git-upload-pack`);
    expect(refs.status).toBe(404);

    const cloneDir = await tempDir('estante-e2e-nmclone-');
    await expect(GitCli.cloneHTTP(url, cloneDir, strangerCookie)).rejects.toThrow();
  });
});

describe('hook: refs (hook.refs)', () => {
  // The member clones, commits and pushes a fast-forward (accepted), then
  // force-pushes a rewritten history — the stack's pre-receive hook refuses the
  // whole push, the reason reaching the client through git's own channel (a
  // remote: line). Pins workflow 14 "Fast-forward only." (14-file-view.md:96-97)
  // and DIRECTION §3.6 line 341. Also the first case that proves the hook is
  // built into and run by the image.
  it('refuses a non-fast-forward force-push to main, the reason on git\'s channel', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'Fast Forward Only');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    // The initial push creates main — accepted (a book comes online).
    const workDir = await tempDir('estante-e2e-ffwork-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, cookie);

    // A fast-forward: a second commit on top, pushed — accepted.
    await writeFile(join(workDir, 'segundo.cifra.md'), '# Segundo\n\n```\n[Am] Teste\n```\n');
    await work.add('.');
    await work.commit('Add a second song');
    await work.pushHTTP(url, cookie);

    // Rewrite the tip and force-push: a non-fast-forward the hook refuses whole.
    await work.run('commit', '--amend', '-m', 'Rewritten tip');
    let error;
    try {
      await work.pushHTTP(url, cookie, 'main', { force: true });
    } catch (e) {
      error = e;
    }
    expect(error, 'the force-push should have been refused').toBeDefined();
    // git relays the hook's stderr to the client prefixed "remote:".
    const relayed = `${error.stderr ?? ''}${error.stdout ?? ''}${error.message ?? ''}`;
    expect(relayed).toContain('remote:');
    expect(relayed).toMatch(/non-fast-forward|refs\/heads\/main/);
  });
});

describe('hook: stowaways (hook.stowaways)', () => {
  // A member pushes an initial main (accepted), then a crafted pack carrying an
  // object unreachable from the new head is POSTed straight to the book's
  // git-receive-pack endpoint — the misbehaving client a well-behaved `git push`
  // cannot produce (pack-objects only ever sends reachable objects). The stack
  // refuses the whole push, the reason reaching the client on git's own channel
  // (the side-band-relayed hook stderr) and the ref reported ng in the
  // report-status, inside a 200 result body — not an HTTP error. Pins workflow
  // 14 "No stowaways" (14-file-view.md:98-101) and DIRECTION §3.6 line 341, and
  // proves the stowaway check is built into and run by the image.
  it('refuses a crafted pack carrying an object unreachable from the new head', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'No Stowaways');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    // The initial push creates main — accepted (a book comes online).
    const workDir = await tempDir('estante-e2e-stowwork-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, cookie);
    const old = await work.revParse('HEAD');

    // A legitimate fast-forward commit on top …
    await writeFile(join(workDir, 'segundo.cifra.md'), '# Segundo\n\n```cifra\n[Am]Linha legitima\n```\n');
    await work.add('.');
    await work.commit('Add a second song');
    const newHead = await work.revParse('HEAD');

    // … and a purpose-written object no commit refers to — the stowaway.
    await writeFile(join(workDir, 'stowaway.txt'), 'an object riding along that no commit refers to\n');
    const stowaway = await work.hashObject('stowaway.txt');

    // Build the crafted pack (introduced objects + the stowaway) and POST the
    // framed receive-pack request with the session cookie.
    const request = await buildCraftedReceivePack(workDir, { old, newHead, extra: [stowaway] });
    const resp = await client.fetch(`/git/${book.id}/git-receive-pack`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-git-receive-pack-request' },
      body: request,
    });
    // A content refusal rides inside the 200 result body, not an HTTP error.
    expect(resp.status).toBe(200);
    const body = Buffer.from(await resp.arrayBuffer());
    const { status, progress } = demuxReceivePack(body);
    // The ref is reported declined on git's channel …
    expect(status).toContain('ng refs/heads/main');
    // … and the hook's reason is relayed on the side-band (git's own channel).
    expect(progress).toMatch(/stowaway|unreachable/);

    // Proof nothing migrated: a fresh clone still sees only the initial commit.
    const verifyDir = await tempDir('estante-e2e-stowverify-');
    const verify = await GitCli.cloneHTTP(url, verifyDir, cookie);
    expect(await verify.revParse('HEAD')).toBe(old);
  });
});

describe('hook: canonical (hook.canonical)', () => {
  // The app's own git client (isomorphic-git) pushes a commit adding a song that
  // parses but is not in canonical form (a ```cifra info-string fence and a
  // chord with no space — the canonical writer normalises both). The stack's
  // pre-receive hook, built with cifra.md for Go, refuses the whole push: the
  // ref is reported declined on git's report-status (band 1), and the hook's
  // "not in canonical form" reason reaches the app's client on git's own
  // side-band channel (band 2) — proving a content-level canonical refusal
  // reaches the device over HTTP, and that the hook (with cifra.md for Go) is
  // actually built into and run by the image. Pins workflow 14 §"Canonical form"
  // (14-file-view.md:51-53, 89-92) and DIRECTION §3.6 line 341.
  it('refuses a non-canonical song push, the reason on git\'s channel', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'Canonical Form');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    // A device brings the book online with a canonical first commit.
    const workDir = await tempDir('estante-e2e-canonwork-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, cookie);

    // The app's own client (isomorphic-git) clones, then commits a song that
    // parses but is not canonical (a ```cifra info-string fence and a chord with
    // no space) — purpose-written filler, never copyrighted words. It is valid
    // UTF-8 at an allowed path within the cap, so the refs/stowaways/contents
    // layers accept it and only the canonical-form layer can refuse it.
    const isoDir = await tempDir('estante-e2e-canoniso-');
    const iso = await IsoGit.create(isoDir);
    await iso.clone({ url, cookie });
    await writeFile(join(isoDir, 'nao-canonica.cifra.md'), '# Nao Canonica\n\n```cifra\n[C]Uma linha nao canonica\n```\n');
    await iso.add('nao-canonica.cifra.md');
    await iso.commit('Add a non-canonical song');

    const messages = [];
    let error;
    try {
      await iso.push({ url, cookie, onMessage: (line) => messages.push(line.toString()) });
    } catch (e) {
      error = e;
    }
    expect(error, 'the non-canonical push should have been refused').toBeDefined();
    // Band 1 (the report-status): the ref is declined, inside a 200 result body.
    expect(error.data?.result?.refs?.['refs/heads/main']?.ok).toBe(false);
    // Band 2 (the side-band): the hook's canonical reason reaches the app's own
    // client on git's own channel.
    expect(messages.join('')).toMatch(/not in canonical form/);
  });
});

describe('hook: limits (hook.limits)', () => {
  // A member pushes to a book whose owning account has almost no quota headroom
  // left (a second book's recorded size, set in Postgres, consumes nearly all of
  // the 200 MB account cap), and the push's net byte growth exceeds that
  // headroom. git runs the push (the account is NOT already over its cap, so the
  // service's pre-git 413 does not fire — that case is pinned server-side), and
  // the hook refuses it on the quarantined objects, the reason reaching the
  // client through git's own channel (a remote: line), inside the 200
  // receive-pack result. Pins workflow 14 "200 MB per account"
  // (14-file-view.md:42-43), "The limits" (:111) and DIRECTION §3.6 lines
  // 342-346 (the hook checks the account's limits from the ESTANTE_* env, no DB).
  it('refuses a push over the account\'s remaining quota, the reason on git\'s channel', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    // A quota-sink book whose recorded size leaves only a tiny positive headroom,
    // and the book this account actually pushes to (empty, so its own per-book
    // cap is nowhere near — only the account cap can bite).
    const sink = await createBook(client, 'Quota Sink');
    const book = await createBook(client, 'Over Account Quota');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    const headroom = 2000; // bytes left in the account quota, a push easily exceeds
    const sql = connect();
    try {
      await sql`UPDATE books SET size_bytes = ${MAX_BYTES_PER_ACCOUNT - headroom} WHERE id = ${sink.id}`;
    } finally {
      await sql.end({ timeout: 5 });
    }

    // Purpose-written filler whose net growth (blob + tree + commit) exceeds the
    // headroom (never copyrighted words). Written in canonical form — the hook's
    // canonical-form check (hook.canonical) runs before the limits check, so a
    // non-canonical push would be refused for that first, not for the quota.
    const fillerLines = [];
    for (let i = 0; i < 300; i += 1) {
      fillerLines.push('[C] linha de preenchimento numero ' + i + ' pra crescer o livro');
    }
    const body = '# Filler Song\n\n```\n' + fillerLines.join('\n\n') + '\n```\n';

    const workDir = await tempDir('estante-e2e-limitwork-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, 'filler.cifra.md'), body);
    await work.add('.');
    await work.commit('Add filler that exceeds the account headroom');

    let error;
    try {
      await work.pushHTTP(url, cookie);
    } catch (e) {
      error = e;
    }
    expect(error, 'the over-quota push should have been refused').toBeDefined();
    // git relays the hook's stderr to the client prefixed "remote:".
    const relayed = `${error.stderr ?? ''}${error.stdout ?? ''}${error.message ?? ''}`;
    expect(relayed).toContain('remote:');
    expect(relayed).toMatch(/storage limit|account/);
  });
});

describe('hook: home book (hook.home_book)', () => {
  // The exact §2.2 bytes and a canonical §6 preferences.json a home book holds.
  const homeReadme =
    '# Home book\n' +
    '\n' +
    'This repository holds one person\'s Estante de Cifras settings. Its files are\n' +
    'JSON that merge key by key, the later change winning; it is written and merged\n' +
    'by the app, not edited by hand. The format is docs/home-book-format.md in the\n' +
    'estante-de-cifras repository.\n';
  const homeGitattributes = '* text=auto eol=lf\n*.json merge=binary\n';
  const canonicalPreferences =
    '{\n' +
    '  "theme": {\n' +
    '    "at": "2026-10-05T14:30:00.000Z",\n' +
    '    "value": "palco"\n' +
    '  }\n' +
    '}\n';

  // A book the registry marks as a home book (kind='home', set directly in
  // Postgres as the limits test sets size_bytes — no provisioning flow needed)
  // moves over the same git-over-HTTP, but the stack's pre-receive hook validates
  // it as settings: a canonical home-book push (the §2.1 files, canonical JSON,
  // the exact §2.2 README/.gitattributes) is accepted, and a *.cifra.md pushed to
  // it is refused whole — the reason reaching the app's own client (isomorphic-git)
  // on git's own channel (band 1 declines the ref, band 2 names the path). Pins
  // docs/home-book-format.md §8 end-to-end through the real stack, the kind
  // forwarded via ESTANTE_BOOK_KIND (§8 lines 496-500).
  it('accepts a canonical home book and refuses a song, the reason on git\'s channel', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'Home Book');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    // The registry marks this book a home book before any push, so the service
    // forwards ESTANTE_BOOK_KIND=home and the hook validates it as settings.
    const sql = connect();
    try {
      await sql`UPDATE books SET kind = 'home' WHERE id = ${book.id}`;
    } finally {
      await sql.end({ timeout: 5 });
    }

    // A device brings the home book online with a canonical first commit: the
    // exact §2.2 README/.gitattributes and a canonical preferences.json.
    const workDir = await tempDir('estante-e2e-homework-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, 'README.md'), homeReadme);
    await writeFile(join(workDir, '.gitattributes'), homeGitattributes);
    await writeFile(join(workDir, 'preferences.json'), canonicalPreferences);
    await work.add('.');
    await work.commit('Bring the home book online');
    await work.pushHTTP(url, cookie); // accepted: a valid home book

    // The app's own client (isomorphic-git) clones and commits a song — which
    // belongs in a songbook, not the home book. It is valid UTF-8 at a path the
    // songbook rules would allow, so only the home-book validator can refuse it.
    const isoDir = await tempDir('estante-e2e-homeiso-');
    const iso = await IsoGit.create(isoDir);
    await iso.clone({ url, cookie });
    await writeFile(join(isoDir, 'cancao.cifra.md'), '# Cancao\n\n```\n[C] Uma linha\n```\n');
    await iso.add('cancao.cifra.md');
    await iso.commit('A song in the home book');

    const messages = [];
    let error;
    try {
      await iso.push({ url, cookie, onMessage: (line) => messages.push(line.toString()) });
    } catch (e) {
      error = e;
    }
    expect(error, 'a song pushed to a home book should be refused').toBeDefined();
    // Band 1 (the report-status): the ref is declined, inside a 200 result body.
    expect(error.data?.result?.refs?.['refs/heads/main']?.ok).toBe(false);
    // Band 2 (the side-band): the hook names the offending path on git's channel.
    expect(messages.join('')).toMatch(/cancao\.cifra\.md/);
    expect(messages.join('')).toMatch(/song or setlist/);
  });
});

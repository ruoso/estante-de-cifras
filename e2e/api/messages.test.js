/**
 * e2e-api — the whole refusal matrix against the compose stack (hook.messages).
 *
 * Every refusal the hook can produce is driven against the live stack and read
 * as *both* device-side git clients present it: once with the git CLI (the
 * reason on `error.stderr`'s `remote:` lines) and once with isomorphic-git (the
 * reason relayed on the side-band band 2 via `onMessage`, with the ref reported
 * `ng refs/heads/main` on band 1). Each case asserts the same fault phrase on
 * both channels and that no song or file content leaks into either. The
 * stowaway surplus — which only a crafted pack can carry — is driven by the raw
 * framed POST (buildCraftedReceivePack/demuxReceivePack), as hook.stowaways
 * established.
 *
 * To test both clients on identical bytes, each content/canonical/limits case
 * builds one commit with the git CLI (which lays down symlinks, binary blobs,
 * over-size files and exact modes faithfully) and then *pushes the same
 * on-disk repository* with each client — isomorphic-git transmits the commit
 * git built, so the wire bytes are identical and only the client differs.
 *
 * Pins workflow 14 §"What the service checks" (docs/workflows/14-file-view.md
 * L85-114, esp. L92-93 "refused whole, naming what failed") and DIRECTION §3.6
 * L341 (the refusal reaches the client on git's own channel) and L346 (the
 * account-quota reason names the user). This is also the first e2e coverage of
 * the contents refusals (hook.contents landed behavior-only). Sessions via the
 * passkey ceremony, books via the API, purpose-written songs only — never
 * copyrighted words.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { GitCli, IsoGit, makeTempDir, buildCraftedReceivePack, demuxReceivePack } from './lib/git.js';
import { sampleSong } from './fixtures/songs.js';
import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';
import { connect } from './lib/db.js';

// The two caps the hook checks a push's growth against (service/internal/hook/
// limits.go maxBookBytes; service/internal/server/books.go maxBytesPerAccount;
// workflow 14 docs/workflows/14-file-view.md:41-43). Set a book's recorded
// size in Postgres to just under a cap, then a small push tips it over — the
// same seam hook.limits' e2e case uses for the account cap, here also for the
// per-book cap.
const MAX_BYTES_PER_ACCOUNT = 200 * 1024 * 1024;
const MAX_BYTES_PER_BOOK = 50 * 1024 * 1024;

// A signed-in client the way a device signs in — the passkey ceremony driving
// the JS software authenticator (no seeded email, no song text). Mirrors
// git.test.js; copied because the helper is module-local there.
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

// buildCommit lays down a commit with the git CLI: prepare(dir) writes the
// working tree, then everything is staged and committed. Returns the working
// directory, which both clients then push.
async function buildCommit(prepare) {
  const workDir = await tempDir('estante-e2e-msg-');
  const work = await GitCli.create(workDir);
  await work.init();
  await prepare(workDir, work);
  await work.add('.');
  await work.commit('push under test');
  return workDir;
}

// cliRefusal pushes workDir's HEAD with the git CLI, expecting a refusal, and
// returns git's relayed stderr/stdout (where a `remote:` line carries the
// hook's reason).
async function cliRefusal(url, cookie, workDir, { force = false } = {}) {
  const work = new GitCli(workDir);
  let error;
  try {
    await work.pushHTTP(url, cookie, 'main', { force });
  } catch (e) {
    error = e;
  }
  expect(error, 'the git CLI push should have been refused').toBeDefined();
  return `${error.stderr ?? ''}${error.stdout ?? ''}${error.message ?? ''}`;
}

// isoRefusal pushes workDir's HEAD with isomorphic-git, expecting a refusal,
// and returns whether the ref was declined (band 1) and the side-band text
// (band 2, where the hook's reason rides).
async function isoRefusal(url, cookie, workDir, { force = false } = {}) {
  const iso = new IsoGit(workDir);
  const messages = [];
  let error;
  try {
    await iso.push({ url, cookie, force, onMessage: (line) => messages.push(line.toString()) });
  } catch (e) {
    error = e;
  }
  expect(error, 'the isomorphic-git push should have been refused').toBeDefined();
  return {
    declined: error.data?.result?.refs?.['refs/heads/main']?.ok === false,
    band2: messages.join(''),
  };
}

// assertReason holds one channel's relayed text to the contract: it names the
// fault, and it carries no song or file content (the secret fed into the push).
function assertReason(channel, label, fault, secret) {
  expect(channel, `${label}: the refusal should name the fault ${fault}`).toMatch(fault);
  if (secret) {
    expect(channel.includes(secret), `${label}: the refusal leaked song/file content`).toBe(false);
  }
}

// Each content/canonical case: a well-behaved first push a device could make,
// carrying exactly one fault, with a purpose-written secret in the file's bytes
// (never copyrighted words) that the refusal must never echo.
const firstPushCases = [
  {
    name: 'a disallowed path (contents)',
    fault: /not an allowed path/,
    secret: 'LetraSecretaForaDoLivro',
    async prepare(dir) {
      await writeFile(join(dir, 'notas.txt'), 'rascunho\n\nLetraSecretaForaDoLivro\n');
    },
  },
  {
    name: 'a symlink (contents)',
    fault: /symlink/,
    secret: 'alvo-secreto-do-link.cifra.md',
    async prepare(dir) {
      // A symlink even at a song-shaped name is refused for its mode (checked
      // before the path kind). Its target is never echoed.
      await symlink('alvo-secreto-do-link.cifra.md', join(dir, 'atalho.cifra.md'));
    },
  },
  {
    name: 'an over-size file (contents)',
    fault: /per-file limit|256 KB/,
    secret: 'EstrofeSecretaDemais',
    async prepare(dir) {
      const line = '[C] EstrofeSecretaDemais que se repete pra passar do limite por arquivo\n\n';
      let body = '# Grande\n\n```\n';
      while (Buffer.byteLength(body, 'utf8') < 300 * 1024) body += line;
      body += '```\n';
      await writeFile(join(dir, 'grande.cifra.md'), body);
    },
  },
  {
    name: 'a non-UTF-8 file (contents)',
    fault: /not valid UTF-8/,
    secret: 'SegredoBinarioNaoUtf8',
    async prepare(dir) {
      const bytes = Buffer.concat([
        Buffer.from('# SegredoBinarioNaoUtf8\n\n', 'utf8'),
        Buffer.from([0xc3, 0x28, 0xff, 0xfe, 0x00]),
        Buffer.from('\n', 'utf8'),
      ]);
      await writeFile(join(dir, 'binaria.cifra.md'), bytes);
    },
  },
  {
    name: 'a wrong .gitattributes (contents)',
    fault: /does not hold exactly/,
    secret: 'merge=driver-secreto-errado',
    async prepare(dir) {
      await writeFile(join(dir, '.gitattributes'), '*.secret merge=driver-secreto-errado\n');
    },
  },
  {
    name: 'a non-canonical song (canonical)',
    fault: /not in canonical form/,
    secret: 'VersoNaoCanonicoSecreto',
    async prepare(dir) {
      // Parses but is not canonical (a ```cifra info-string fence and a chord
      // with no space — the writer normalises both). Valid UTF-8 at an allowed
      // path within the cap, so only the canonical layer can refuse it.
      await writeFile(
        join(dir, 'nao-canonica.cifra.md'),
        '# Nao Canonica\n\n```cifra\n[C]VersoNaoCanonicoSecreto\n```\n',
      );
    },
  },
  {
    name: 'a conflict-marker file (canonical)',
    fault: /conflict marker/,
    secret: 'nossa-versao-SEGREDO-do-merge',
    async prepare(dir) {
      await writeFile(
        join(dir, 'conflito.cifra.md'),
        '# Com Conflito\n\n```\nC | G\n```\n<<<<<<< nossa-versao-SEGREDO-do-merge\n',
      );
    },
  },
  {
    name: 'a README text-rule break (canonical)',
    fault: /has a tab/,
    secret: 'TituloSecretoDoReadmeE2E',
    async prepare(dir) {
      await writeFile(join(dir, 'README.md'), '# TituloSecretoDoReadmeE2E\n\n\tlinha com tab\n');
    },
  },
];

describe('hook: refusal matrix (hook.messages)', () => {
  for (const c of firstPushCases) {
    it(`refuses ${c.name} the same on both git clients, naming the fault and no song text`, async () => {
      const client = new HttpClient();
      await registerNewAccount(client);
      const book = await createBook(client, `Matrix: ${c.name}`);
      const url = gitEndpoint(book);
      const cookie = client.cookieHeader();

      // One commit built by the git CLI, pushed by each client to the same
      // (empty) book — both refused, so the book stays empty between them.
      const workDir = await buildCommit(c.prepare);

      const cli = await cliRefusal(url, cookie, workDir);
      expect(cli).toContain('remote:');
      assertReason(cli, 'git CLI', c.fault, c.secret);

      const { declined, band2 } = await isoRefusal(url, cookie, workDir);
      expect(declined, 'isomorphic-git should see refs/heads/main declined (band 1)').toBe(true);
      assertReason(band2, 'isomorphic-git', c.fault, c.secret);
    });
  }

  it('refuses a non-fast-forward rewrite the same on both git clients, no song text', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'Matrix: non-fast-forward');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    // Seed an accepted main (two canonical commits), then rewrite the tip —
    // adding a song carrying a secret the refs layer never reads.
    const workDir = await tempDir('estante-e2e-msgff-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, cookie);

    await writeFile(join(workDir, 'segundo.cifra.md'), '# Segundo\n\n```\n[Am] Teste\n```\n');
    await work.add('.');
    await work.commit('Add a second song');
    await work.pushHTTP(url, cookie);

    await writeFile(join(workDir, 'segredo.cifra.md'), '# Segredo\n\n```\n[C] VersoSecretoNonFF\n```\n');
    await work.add('.');
    await work.run('commit', '--amend', '-m', 'Rewritten tip');

    const cli = await cliRefusal(url, cookie, workDir, { force: true });
    expect(cli).toContain('remote:');
    assertReason(cli, 'git CLI', /non-fast-forward/, 'VersoSecretoNonFF');

    const { declined, band2 } = await isoRefusal(url, cookie, workDir, { force: true });
    expect(declined, 'isomorphic-git should see refs/heads/main declined (band 1)').toBe(true);
    assertReason(band2, 'isomorphic-git', /non-fast-forward/, 'VersoSecretoNonFF');
  });

  it('refuses an over-account-quota push the same on both git clients, naming the user and no song text', async () => {
    const client = new HttpClient();
    const accountID = await registerNewAccount(client);
    // A quota-sink book whose recorded size leaves only a tiny account headroom,
    // and the (empty) book this account pushes to — so only the account cap can
    // bite, not the per-book cap.
    const sink = await createBook(client, 'Matrix: Quota Sink');
    const book = await createBook(client, 'Matrix: Over Account');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    const headroom = 2000;
    await setBookSize(sink.id, MAX_BYTES_PER_ACCOUNT - headroom);

    const workDir = await buildFillerCommit('SegredoDeQuotaDaConta');

    const cli = await cliRefusal(url, cookie, workDir);
    expect(cli).toContain('remote:');
    assertReason(cli, 'git CLI', /storage limit|account/, 'SegredoDeQuotaDaConta');
    // The account-quota reason names the pushing user (DIRECTION §3.6 L346).
    expect(cli, 'the account-quota reason should name the pushing user').toContain(accountID);

    // A hook refusal still exits git 0 (the rejection rides the report-status
    // inside a 200 body), so the service refreshed the empty target book's
    // recorded size to its real on-disk footprint after the CLI push — consuming
    // the account headroom the fixture set up. Restore the seam so the iso client
    // faces the very same over-account-quota condition the CLI just did.
    await setBookSize(sink.id, MAX_BYTES_PER_ACCOUNT - headroom);
    await setBookSize(book.id, 0);

    const { declined, band2 } = await isoRefusal(url, cookie, workDir);
    expect(declined, 'isomorphic-git should see refs/heads/main declined (band 1)').toBe(true);
    assertReason(band2, 'isomorphic-git', /storage limit|account/, 'SegredoDeQuotaDaConta');
    expect(band2, 'the account-quota reason should name the pushing user').toContain(accountID);
  });

  it('refuses an over-book-cap push the same on both git clients, no song text', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'Matrix: Over Book');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    // The book's own recorded size leaves a tiny per-book headroom (its account
    // still has plenty, so the per-book cap is the one that bites).
    const headroom = 2000;
    await setBookSize(book.id, MAX_BYTES_PER_BOOK - headroom);

    const workDir = await buildFillerCommit('SegredoDeCapDoLivro');

    const cli = await cliRefusal(url, cookie, workDir);
    expect(cli).toContain('remote:');
    assertReason(cli, 'git CLI', /per-book limit/, 'SegredoDeCapDoLivro');

    // A hook refusal still exits git 0 (the rejection rides the report-status
    // inside a 200 body), so the service refreshed book.size_bytes to the repo's
    // real on-disk footprint after the CLI push — erasing the near-cap seam.
    // Restore it so the iso client faces the very same over-book-cap condition.
    await setBookSize(book.id, MAX_BYTES_PER_BOOK - headroom);

    const { declined, band2 } = await isoRefusal(url, cookie, workDir);
    expect(declined, 'isomorphic-git should see refs/heads/main declined (band 1)').toBe(true);
    assertReason(band2, 'isomorphic-git', /per-book limit/, 'SegredoDeCapDoLivro');
  });

  it('refuses a crafted pack carrying a stowaway, the reason on git\'s channel and no object content', async () => {
    const client = new HttpClient();
    await registerNewAccount(client);
    const book = await createBook(client, 'Matrix: Stowaway');
    const url = gitEndpoint(book);
    const cookie = client.cookieHeader();

    // Bring the book online, make a legit fast-forward commit, and mint an
    // object no commit refers to — carrying a secret the count-only reason
    // never echoes.
    const workDir = await tempDir('estante-e2e-msgstow-');
    const work = await GitCli.create(workDir);
    await work.init();
    await writeFile(join(workDir, sampleSong.filename), sampleSong.content);
    await work.add('.');
    await work.commit('Add the tuning song');
    await work.pushHTTP(url, cookie);
    const old = await work.revParse('HEAD');

    await writeFile(join(workDir, 'segundo.cifra.md'), '# Segundo\n\n```\n[Am] Linha legitima\n```\n');
    await work.add('.');
    await work.commit('Add a second song');
    const newHead = await work.revParse('HEAD');

    await writeFile(join(workDir, 'stowaway.txt'), 'objeto-clandestino-SEGREDO que nenhum commit referencia\n');
    const stowaway = await work.hashObject('stowaway.txt');

    const request = await buildCraftedReceivePack(workDir, { old, newHead, extra: [stowaway] });
    const resp = await client.fetch(`/git/${book.id}/git-receive-pack`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-git-receive-pack-request' },
      body: request,
    });
    expect(resp.status).toBe(200);
    const body = Buffer.from(await resp.arrayBuffer());
    const { status, progress } = demuxReceivePack(body);
    expect(status).toContain('ng refs/heads/main');
    expect(progress).toMatch(/stowaway|unreachable/);
    // The count-only reason never echoes the object's bytes.
    expect(progress.includes('objeto-clandestino-SEGREDO')).toBe(false);
    expect(status.includes('objeto-clandestino-SEGREDO')).toBe(false);

    // Nothing migrated: a fresh clone still sees only the initial commit.
    const verifyDir = await tempDir('estante-e2e-msgstowverify-');
    const verify = await GitCli.cloneHTTP(url, verifyDir, cookie);
    expect(await verify.revParse('HEAD')).toBe(old);
  });
});

// setBookSize seeds a book's recorded size in Postgres — the value the service
// hands the hook as the book's current size (ESTANTE_BOOK_BYTES) and sums into
// the account's remaining quota. A refused push leaves it untouched.
async function setBookSize(bookID, sizeBytes) {
  const sql = connect();
  try {
    await sql`UPDATE books SET size_bytes = ${sizeBytes} WHERE id = ${bookID}`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// buildFillerCommit builds a canonical filler song whose net growth (blob +
// tree + commit) comfortably exceeds the 2000-byte headroom, so the canonical
// layer accepts it and only the limits layer can refuse it. The secret rides in
// the title (free text the writer keeps verbatim) — never echoed by the reason.
function buildFillerCommit(secret) {
  const lines = [];
  for (let i = 0; i < 300; i += 1) {
    lines.push('[C] linha de preenchimento numero ' + i + ' pra crescer o livro');
  }
  const body = '# Filler ' + secret + ' Song\n\n```\n' + lines.join('\n\n') + '\n```\n';
  return buildCommit(async (dir) => {
    await writeFile(join(dir, 'filler.cifra.md'), body);
  });
}

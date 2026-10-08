import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'node:fs';

// Real git clients doing what a device would (the e2e_api refinement, §What
// this task is #3): a git-CLI helper (the host `git` through child_process,
// never a shell string — argument arrays, so song text and paths are never
// interpolated into a command line) and an isomorphic-git helper (the published
// Node build of the same client the app's Worker uses, with node:fs and the
// package's Node HTTP client). Each operates in a caller-provided or mkdtemp
// working directory so a ≤4-worker parallel run is collision-free.

const execFileAsync = promisify(execFile);

// A fresh temp working directory. Every test that touches the filesystem gets
// its own and cleans it up (Constraints: bounded parallelism, isolated tests).
export function makeTempDir(prefix = 'estante-e2e-git-') {
  return mkdtemp(join(tmpdir(), prefix));
}

// Run git with an argument array (no shell). GIT_TERMINAL_PROMPT=0 so a missing
// credential never blocks on a prompt; a non-system config keeps the host's
// global settings (signing, hooks) from leaking into the test.
async function runGit(cwd, args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' },
  });
  return stdout;
}

export class GitCli {
  constructor(cwd) {
    this.cwd = cwd;
  }

  static async create(cwd) {
    return new GitCli(cwd ?? (await makeTempDir()));
  }

  run(...args) {
    return runGit(this.cwd, args);
  }

  async init({ bare = false } = {}) {
    await this.run('init', ...(bare ? ['--bare'] : []), '-b', 'main');
    if (!bare) await this.configIdentity();
    return this;
  }

  async configIdentity(name = 'Estante E2E', email = 'e2e@estante.test') {
    await this.run('config', 'user.name', name);
    await this.run('config', 'user.email', email);
    // Never sign fixtures; no signing key is provisioned in the harness.
    await this.run('config', 'commit.gpgsign', 'false');
  }

  async add(pathspec = '.') {
    await this.run('add', pathspec);
  }

  async commit(message) {
    await this.run('commit', '-m', message);
  }

  async addRemote(name, url) {
    await this.run('remote', 'add', name, url);
  }

  // The object name a ref resolves to (trimmed).
  async revParse(ref) {
    return (await this.run('rev-parse', ref)).trim();
  }

  // Write a working-tree file into the object store as a loose blob (never
  // adding it to the index or a tree) and return its object name — the way the
  // stowaway test mints an object no commit refers to.
  async hashObject(filepath) {
    return (await this.run('hash-object', '-w', filepath)).trim();
  }

  async push(remote = 'origin', branch = 'main') {
    await this.run('push', remote, branch);
  }

  // Clone `source` into `dest` (local now; clone over HTTP with a session is a
  // downstream job — the CLI reads cookies from its own config, not relevant to
  // the local round-trip). Returns a GitCli on the clone.
  static async cloneRepo(source, dest) {
    await runGit(tmpdir(), ['clone', source, dest]);
    const repo = new GitCli(dest);
    await repo.configIdentity();
    return repo;
  }

  // Clone `url` into `dest` over smart HTTP, carrying the session cookie as an
  // HTTP header via `-c http.extraHeader` (the device's own path to an
  // authenticated clone — service.git_http). `cookie` is the HttpClient's
  // cookieHeader() string (`estante_session=…`). `protocolVersion`, when set,
  // drives `-c protocol.version=<n>` so protocol v2 can be exercised. Returns a
  // GitCli on the clone with a local identity set for follow-up commits.
  static async cloneHTTP(url, dest, cookie, { protocolVersion } = {}) {
    const cfg = cookieConfig(cookie);
    if (protocolVersion != null) cfg.push('-c', `protocol.version=${protocolVersion}`);
    await runGit(tmpdir(), [...cfg, 'clone', url, dest]);
    const repo = new GitCli(dest);
    await repo.configIdentity();
    return repo;
  }

  // Push this working copy's HEAD to `url` over smart HTTP with the session
  // cookie (service.git_http). `force` adds --force so a non-fast-forward
  // (a rewritten history) is sent to the server rather than refused locally —
  // the server-side pre-receive hook is what refuses it (hook.refs).
  async pushHTTP(url, cookie, ref = 'main', { force = false } = {}) {
    await this.run(
      ...cookieConfig(cookie),
      'push',
      ...(force ? ['--force'] : []),
      url,
      `HEAD:refs/heads/${ref}`,
    );
  }

  // Fetch from `url` over smart HTTP with the session cookie, updating the
  // remote-tracking refs (service.git_http). `protocolVersion`, when set, drives
  // protocol v2.
  async fetchHTTP(url, cookie, { protocolVersion } = {}) {
    const cfg = cookieConfig(cookie);
    if (protocolVersion != null) cfg.push('-c', `protocol.version=${protocolVersion}`);
    await this.run(...cfg, 'fetch', url, '+refs/heads/*:refs/remotes/origin/*');
  }
}

// cookieConfig turns a cookie header string into the `-c http.extraHeader` args
// the git CLI sends on every smart-HTTP request (never a shell string — an
// argument array, so the cookie is never interpolated into a command line).
function cookieConfig(cookie) {
  return cookie ? ['-c', `http.extraHeader=Cookie: ${cookie}`] : [];
}

export class IsoGit {
  constructor(dir) {
    this.dir = dir;
    this.fs = fs;
    // The package's own Node HTTP client — the wire for downstream HTTP
    // clone/fetch/push against the real service (service.git_http, sync).
    this.http = http;
  }

  static async create(dir) {
    return new IsoGit(dir ?? (await makeTempDir('estante-e2e-isogit-')));
  }

  async init() {
    await git.init({ fs: this.fs, dir: this.dir, defaultBranch: 'main' });
    return this;
  }

  // Configure a named remote the way `clone` does — writing `remote.<name>.url`
  // and the `+refs/heads/*:refs/remotes/<name>/*` fetch refspec — so a device
  // that seeded a book with init+push (rather than cloning it) can still fetch:
  // fetch needs that refspec to know where to land the remote-tracking ref.
  addRemote(remote, url) {
    return git.addRemote({ fs: this.fs, dir: this.dir, remote, url });
  }

  async add(filepath) {
    await git.add({ fs: this.fs, dir: this.dir, filepath });
  }

  commit(message, author = { name: 'Estante E2E', email: 'e2e@estante.test' }) {
    return git.commit({ fs: this.fs, dir: this.dir, message, author });
  }

  log() {
    return git.log({ fs: this.fs, dir: this.dir });
  }

  // Read a committed file back at HEAD via log + readBlob.
  async readFileAtHead(filepath) {
    const [head] = await this.log();
    const { blob } = await git.readBlob({ fs: this.fs, dir: this.dir, oid: head.oid, filepath });
    return new TextDecoder().decode(blob);
  }

  // Downstream HTTP surface (the e2e_api refinement, Decisions): isomorphic-git
  // has no local-filesystem clone transport — clone/fetch/push speak smart HTTP
  // to the per-book git endpoint, authenticated by the session cookie, and are
  // exercised against the live service once service.git_http lands. The helper
  // ships now so those tests have it; `cookie` is the HttpClient's cookieHeader.
  clone({ url, cookie, ref = 'main' } = {}) {
    return git.clone({ fs: this.fs, http: this.http, dir: this.dir, url, ref, headers: cookieHeaders(cookie) });
  }

  fetch({ url, cookie } = {}) {
    return git.fetch({ fs: this.fs, http: this.http, dir: this.dir, url, headers: cookieHeaders(cookie) });
  }

  // onMessage, when given, receives each git side-band band-2 line the server
  // relays — where a server-side hook's refusal reason rides (the app's client
  // seeing the hook's words, service.git_http). A pre-receive refusal makes
  // git.push throw GitPushError, whose .data.result.refs[ref] reports the ref
  // declined (band 1, the report-status).
  push({ url, cookie, ref = 'main', onMessage } = {}) {
    return git.push({ fs: this.fs, http: this.http, dir: this.dir, url, ref, headers: cookieHeaders(cookie), onMessage });
  }
}

function cookieHeaders(cookie) {
  return cookie ? { cookie } : undefined;
}

// spawnGit runs git in cwd capturing its raw stdout as a Buffer (pack bytes are
// binary), optionally feeding `input` on stdin. Same hardened environment as the
// other helpers. Used to build a crafted pack by hand.
function spawnGit(cwd, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' },
    });
    const out = [];
    const err = [];
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`git ${args.join(' ')} exited ${code}: ${Buffer.concat(err)}`));
      else resolve(Buffer.concat(out));
    });
    child.stdin.end(input ?? '');
  });
}

// pktLine encodes payload as a git pkt-line: a 4-hex-digit length prefix
// (counting the 4 prefix bytes) then the payload. Returned as a Buffer so a NUL
// in the payload (the capability separator) survives.
export function pktLine(payload) {
  const body = Buffer.from(payload, 'utf8');
  const prefix = Buffer.from((body.length + 4).toString(16).padStart(4, '0'), 'ascii');
  return Buffer.concat([prefix, body]);
}

// buildCraftedReceivePack frames a smart-HTTP git-receive-pack request body that
// updates refs/heads/main from `old` to `newHead` and smuggles the `extra`
// object ids alongside the head's introduced objects — the misbehaving client a
// well-behaved `git push` cannot produce (hook.stowaways Decision). It shells
// out to the host git in `dir` (a clone of the book): `rev-list --objects` for
// the introduced objects, then `pack-objects` fed the explicit list (introduced
// + extra). The body is one command pkt-line (advertising report-status and
// side-band-64k so the server reports per-ref status and relays the hook's
// reason on git's own channel), a flush, then the pack.
export async function buildCraftedReceivePack(dir, { old, newHead, extra = [], ref = 'refs/heads/main' }) {
  const revList = (await spawnGit(dir, ['rev-list', '--objects', newHead, '--not', old])).toString('utf8');
  const introduced = revList
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0]);
  const objects = [...introduced, ...extra];
  const pack = await spawnGit(dir, ['pack-objects', '--stdout', '-q'], objects.join('\n') + '\n');
  const command = `${old} ${newHead} ${ref}\0report-status side-band-64k`;
  return Buffer.concat([pktLine(command), Buffer.from('0000', 'ascii'), pack]);
}

// demuxReceivePack splits a side-band-64k git-receive-pack result body into its
// channels: band 1 (the report-status — unpack/ok and per-ref ok/ng), band 2
// (progress and relayed hook stderr), band 3 (a fatal error). The hook's refusal
// reason rides band 2, the per-ref status band 1 — both git's own channel.
export function demuxReceivePack(buf) {
  const bands = { 1: [], 2: [], 3: [] };
  let i = 0;
  while (i + 4 <= buf.length) {
    const len = parseInt(buf.toString('ascii', i, i + 4), 16);
    if (Number.isNaN(len)) break;
    if (len === 0) {
      i += 4; // flush-pkt
      continue;
    }
    const payload = buf.subarray(i + 4, i + len);
    i += len;
    if (payload.length === 0) continue;
    const band = payload[0];
    if (bands[band]) bands[band].push(payload.subarray(1));
  }
  const text = (b) => Buffer.concat(bands[b]).toString('utf8');
  return { status: text(1), progress: text(2), error: text(3) };
}

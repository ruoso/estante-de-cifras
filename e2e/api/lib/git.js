import { execFile } from 'node:child_process';
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

  push({ url, cookie, ref = 'main' } = {}) {
    return git.push({ fs: this.fs, http: this.http, dir: this.dir, url, ref, headers: cookieHeaders(cookie) });
  }
}

function cookieHeaders(cookie) {
  return cookie ? { cookie } : undefined;
}

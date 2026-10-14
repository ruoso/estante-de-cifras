// A second device that speaks plain git: the host `git` CLI cloning and pushing
// a hosted book over the stack's smart HTTP, carrying an account's session
// cookie. It stands in for a computer with a git client (workflow 14) or for
// another person's device — real git through the real server and its
// pre-receive hook, so what it pushes is what any client could.
//
// Prefer a second browser context (another account, joined through the Share
// dialog) when the journey is about people: this device acts as whichever
// account's cookie it carries, so it never exercises a member's permissions.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const execFileAsync = promisify(execFile);

function runGit(cwd, args) {
  return execFileAsync('git', args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' },
  });
}

export class GitDevice {
  // `url` is the book's git URL (journeys.bookGitUrl), `cookie` a session
  // cookie header value (journeys.sessionCookie); `name`/`email` the commit
  // author the app will show (e.g. in *Updated by {name}*).
  constructor({ url, cookie, name = 'Marina Souza', email = 'marina@users.estantedecifras.app' }) {
    Object.assign(this, { url, cookie, name, email });
    this.dir = null;
  }

  #auth() {
    return ['-c', `http.extraHeader=Cookie: ${this.cookie}`];
  }

  // Clone (or re-clone fresh) the book into a temporary directory.
  async clone() {
    this.cleanup();
    this.dir = mkdtempSync(join(tmpdir(), 'estante-e2e-git-'));
    await runGit(tmpdir(), [...this.#auth(), 'clone', this.url, this.dir]);
    await runGit(this.dir, ['config', 'user.name', this.name]);
    await runGit(this.dir, ['config', 'user.email', this.email]);
    await runGit(this.dir, ['config', 'commit.gpgsign', 'false']);
    return this;
  }

  read(path) {
    return readFileSync(join(this.dir, path), 'utf8');
  }

  write(path, text) {
    mkdirSync(dirname(join(this.dir, path)), { recursive: true });
    writeFileSync(join(this.dir, path), text);
  }

  async commit(message, paths = ['-A']) {
    await runGit(this.dir, ['add', ...paths]);
    await runGit(this.dir, ['commit', '-m', message]);
  }

  // Push to main; resolves with git's result, rejects (with stderr) on a refusal.
  async push() {
    return runGit(this.dir, [...this.#auth(), 'push', this.url, 'HEAD:refs/heads/main']);
  }

  // Clone, write files ({ path: text }), commit and push, in one step.
  async pushFiles(files, message = 'Change songs') {
    await this.clone();
    for (const [path, text] of Object.entries(files)) this.write(path, text);
    await this.commit(message);
    return this.push();
  }

  cleanup() {
    if (this.dir) rmSync(this.dir, { recursive: true, force: true });
    this.dir = null;
  }
}

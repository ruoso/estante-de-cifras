// A reusable local git remote served over HTTP, for the Worker behavior level
// (storage.worker, Decision 5). It wraps git's own `git-http-backend` CGI
// behind `http.createServer`, so it speaks real git smart HTTP that both the
// `git` CLI (this task's self-test) and isomorphic-git (the downstream
// storage.git / storage.working_copy / sync.engine tasks) can clone, fetch,
// and push against. The `git` CLI is already required by `scripts/gate`, so no
// new dependency is added.
//
// Test infrastructure only: it is never imported from a production entry, so
// it never enters the app bundle. It reaches the loopback network
// (127.0.0.1) a test owns — nothing here touches the real network.
//
// Protocol v1: the server does not forward the client's `Git-Protocol` header
// to the backend, so the backend never negotiates up to v2 — it advertises the
// classic smart-HTTP (v0/v1) refs every git client understands.

import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// git's helper programs (git-http-backend) live in its libexec dir, not on the
// PATH as commands.
const GIT_EXEC_PATH = execFileSync('git', ['--exec-path'], {
  encoding: 'utf8',
}).trim();
const GIT_HTTP_BACKEND = path.join(GIT_EXEC_PATH, 'git-http-backend');

// Deterministic, isolated git identity for seeding — no dependency on the
// developer's global git config, and purpose-written values (no song text, no
// real person's data).
function gitEnv(home) {
  return {
    PATH: process.env.PATH,
    HOME: home,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Estante Test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Estante Test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
    GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
  };
}

// Create a bare repository under `root` with one seeded commit on `main`.
// Returns the bare repo's on-disk path. The seeded file is purpose-written
// fixture text, never anyone's words.
function seedBareRepo(root) {
  const env = gitEnv(root);
  const work = path.join(root, 'seed');
  const bare = path.join(root, 'repo.git');

  execFileSync('git', ['init', '-q', '-b', 'main', work], { env });
  writeFileSync(
    path.join(work, 'README.txt'),
    'estante git-http remote test fixture\n',
  );
  execFileSync('git', ['-C', work, 'add', '.'], { env });
  execFileSync('git', ['-C', work, 'commit', '-q', '-m', 'seed fixture'], {
    env,
  });
  execFileSync('git', ['clone', '-q', '--bare', work, bare], { env });
  return bare;
}

// Serve one request through git-http-backend as a CGI process. We buffer the
// CGI output (small for a test repo), split its headers from its body, and
// relay them onto the HTTP response.
function serveRequest(req, res, projectRoot) {
  const parsed = new URL(req.url, 'http://localhost');
  const env = {
    PATH: process.env.PATH,
    GIT_PROJECT_ROOT: projectRoot,
    GIT_HTTP_EXPORT_ALL: '1',
    PATH_INFO: parsed.pathname,
    QUERY_STRING: parsed.searchParams.toString(),
    REQUEST_METHOD: req.method,
    CONTENT_TYPE: req.headers['content-type'] ?? '',
    // CGI must tell the backend how many body bytes to read, or the POST
    // (git-upload-pack's "wants") never reaches it and the clone hangs. git
    // compresses that body, so the backend also needs the content-encoding to
    // inflate it (read from HTTP_CONTENT_ENCODING).
    CONTENT_LENGTH: req.headers['content-length'] ?? '',
    HTTP_CONTENT_ENCODING: req.headers['content-encoding'] ?? '',
    REMOTE_ADDR: req.socket.remoteAddress ?? '',
    // Deliberately no GIT_PROTOCOL (would come from the client's Git-Protocol
    // header): the backend stays on smart-HTTP v1, never negotiating up to v2.
  };

  const child = spawn(GIT_HTTP_BACKEND, [], { env });
  const chunks = [];
  const errChunks = [];
  child.stdout.on('data', (c) => chunks.push(c));
  child.stderr.on('data', (c) => errChunks.push(c));

  child.on('error', (err) => {
    res.writeHead(500);
    res.end(String(err?.message ?? err));
  });

  child.on('close', (code) => {
    const out = Buffer.concat(chunks);
    // CGI separates headers from body with a blank line; accept CRLF or LF.
    let sep = out.indexOf('\r\n\r\n');
    let sepLen = 4;
    if (sep === -1) {
      sep = out.indexOf('\n\n');
      sepLen = 2;
    }
    if (sep === -1 || code !== 0) {
      res.writeHead(500);
      res.end(Buffer.concat(errChunks));
      return;
    }
    const headerText = out.subarray(0, sep).toString('utf8');
    const body = out.subarray(sep + sepLen);

    let status = 200;
    for (const line of headerText.split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (/^status$/i.test(key)) {
        status = parseInt(value, 10) || 200;
      } else {
        res.setHeader(key, value);
      }
    }
    res.writeHead(status);
    res.end(body);
  });

  req.pipe(child.stdin);
}

// Start the remote. Resolves to a handle with the clone `url`, the on-disk
// paths, and an async `stop()` that closes the server and removes the temp
// tree. `mountPath` is the path segment the repo is served at (default
// `/repo.git`), matching the on-disk bare repo name.
export async function startGitHttpRemote() {
  const root = mkdtempSync(path.join(tmpdir(), 'estante-git-remote-'));
  const bare = seedBareRepo(root);

  const server = http.createServer((req, res) => serveRequest(req, res, root));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/repo.git`;

  return {
    url,
    root,
    repoDir: bare,
    async stop() {
      await new Promise((resolve) => server.close(resolve));
      rmSync(root, { recursive: true, force: true });
    },
  };
}

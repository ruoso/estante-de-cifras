/**
 * The reMarkable reader's built binary (ESTANTE_E2E_READER_BIN), driven as a
 * device would be (reader.sync, reader.pairing): `runReader` runs one
 * subcommand, `pairReader` pairs a reader root with an account through the
 * real pairing — `pair` begins and prints its code, the signed-in client
 * approves it, the process exits once it has kept the session — and
 * `readerSession` reads what it kept.
 */
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { baseUrl, readerBin } from './env.js';

// The app's built device bundle, which the gate builds before the stack.
export const bundleDir = fileURLToPath(new URL('../../../app/dist/device', import.meta.url));

// Run the reader with `args`; resolves { stdout, stderr }, rejects (with its
// exit status and stderr) when it fails. `onStdoutLine` is told each line of
// stdout as it comes.
export function runReader(args, { onStdoutLine } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(readerBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let pending = '';
    child.stdout.on('data', (d) => {
      stdout += d;
      if (!onStdoutLine) return;
      pending += d;
      let nl;
      while ((nl = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, nl);
        pending = pending.slice(nl + 1);
        onStdoutLine(line);
      }
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else {
        const err = new Error(`estante-reader ${args[0]} exited ${code}: ${stderr}`);
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}

// Pair the reader root `root` with the account `client` is signed in to:
// `pair --root root --origin baseUrl` prints its code, the client approves it
// (POST /api/devices/pair/approve), and the process exits 0 once the session
// is kept. Resolves the code line it printed and its outputs.
export async function pairReader(client, root) {
  let approval;
  let codeLine;
  const paired = runReader(['pair', '--root', root, '--origin', baseUrl], {
    onStdoutLine: (line) => {
      if (codeLine !== undefined) return;
      codeLine = JSON.parse(line);
      approval = client.postJson('/api/devices/pair/approve', { code: codeLine.code });
    },
  });
  const { stdout, stderr } = await paired;
  if (approval === undefined) throw new Error('estante-reader pair printed no code');
  const resp = await approval;
  if (resp.status !== 204) throw new Error(`approving the reader's code answered ${resp.status}`);
  return { codeLine, stdout, stderr };
}

// The session the reader keeps: session.json's fields and its file mode.
export async function readerSession(root) {
  const path = join(root, 'session.json');
  const [raw, info] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
  return { ...JSON.parse(raw), mode: info.mode & 0o777 };
}

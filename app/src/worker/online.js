// online.js — the Worker's put-online / download / remove / delete mechanics
// (books.online, workflow 7 L46-63, L128-137). The four acts that turn a book
// from a device-only thing into a hosted one, carry it away, or take it off:
//
//   - putOnline — create the book on Estante (empty, private), adopt the
//     service id as the on-device id (Decision 3), set the git remote and push
//     the first commit. The service create happens FIRST; a dropped network
//     after it does not lose the book (the remote is set and the sync engine
//     retries the push — Decision 4).
//   - download — a zip of the repository exactly as it is on the device (the
//     whole `.git` and the working tree, unsaved changes included), with the
//     remote stripped from the zipped `.git/config` so the download opens in any
//     git tool outside the app (workflow 7 L55-63; DIRECTION §3.3 L213-217).
//   - remove — delete this device's clone only; the service book is untouched.
//   - deleteBook — delete the book from Estante for everyone (owner only), then
//     remove the local clone.
//
// It is the sibling of books.js / home-book.js, composed over the same
// primitives (the git transport, the per-book lock, the shared filesystem) plus
// the `/api/books` client (books-client.js). The git/fs mechanics live here;
// the shelf-register migration (the home book) stays in logic.js, as it does
// for CREATE_BOOK (books.js Decision: the creator mints the repo, logic.js
// writes the shelf).
//
// COMPOSITION RULE (locks.md Decision 1): one lock per logical operation, never
// nested. The relocate + set-remote runs under the LOCAL book's lock; the
// inline push and the download/remove each run under the (service) book's lock.
//
// No song text, titles, ids or secrets in logs (standing rule): this module
// logs nothing. Framework-free, Worker-only: plain ESM, no React.

import { createZip } from './book-zip.js';

const utf8 = new TextEncoder();

// Remove the `[remote "origin"]` section from a git config's text, leaving the
// rest byte-for-byte (workflow 7 L60: "The remote is removed, since its URL is
// the service's and useless outside the app"). An INI section runs from its
// header line to the next section header (a line whose first non-space char is
// `[`); every line of the origin-remote section, header included, is dropped.
// Only the zipped copy is rewritten — the on-device repo keeps its remote.
export function stripRemoteFromConfig(text) {
  const lines = text.split('\n');
  const out = [];
  let inOrigin = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      // A new section header: are we entering the origin remote's section?
      inOrigin = /^\[remote\s+"origin"\]$/.test(trimmed);
      if (inOrigin) continue; // drop the header
    }
    if (inOrigin) continue; // drop the body lines of the origin section
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Build the online operations over the composed primitives — the same deps and
 * shape as `createBooks` / `createHomeBook`, plus the `/api/books` client.
 *
 * @param {{
 *   fs: import('./fs.js').FileSystem,
 *   git: ReturnType<typeof import('./git.js').createGitLayer>,
 *   locks: ReturnType<typeof import('./locks.js').createBookLocks>,
 *   booksClient: ReturnType<typeof import('./books-client.js').createBooksClient>,
 * }} deps
 */
export function createOnline({ fs, git, locks, booksClient } = {}) {
  if (!fs) throw new Error('createOnline requires an fs');
  if (!git) throw new Error('createOnline requires a git layer');
  if (!locks) throw new Error('createOnline requires a lock registry');
  if (!booksClient) throw new Error('createOnline requires a books client');

  // Walk every FILE under `dir`, returning paths relative to `dir` (POSIX
  // separators), depth-first. Empty directories are not listed — git recreates
  // whatever directories its objects need. Uses only the fs-interface methods
  // (readdir/stat), so it is backend-agnostic (fs.js).
  async function listFiles(dir, prefix = '') {
    const names = await fs.promises.readdir(dir);
    const files = [];
    for (const name of names) {
      const full = `${dir}/${name}`;
      const rel = prefix ? `${prefix}/${name}` : name;
      const stat = await fs.promises.stat(full);
      if (stat.isDirectory()) {
        files.push(...(await listFiles(full, rel)));
      } else {
        files.push(rel);
      }
    }
    return files;
  }

  // Delete a whole tree (files then directories, depth-first). Uses only
  // unlink/rmdir/readdir/stat.
  async function removeTree(dir) {
    let names;
    try {
      names = await fs.promises.readdir(dir);
    } catch (err) {
      if (err?.code === 'ENOENT') return; // already gone
      throw err;
    }
    for (const name of names) {
      const full = `${dir}/${name}`;
      const stat = await fs.promises.stat(full);
      if (stat.isDirectory()) {
        await removeTree(full);
      } else {
        await fs.promises.unlink(full);
      }
    }
    await fs.promises.rmdir(dir);
  }

  // `mkdir -p`: create `dir` and every missing ancestor under `/`. lightning-fs
  // `mkdir` makes only one level, so the ancestors are created in order.
  async function mkdirp(dir) {
    const parts = dir.split('/').filter(Boolean);
    let path = '';
    for (const part of parts) {
      path += `/${part}`;
      try {
        await fs.promises.mkdir(path);
      } catch (err) {
        if (err?.code !== 'EEXIST') throw err;
      }
    }
  }

  // Copy every file from `from` to `to`, bytes preserved (no text decode, so a
  // binary `.git` object survives). Creates each destination directory as it
  // goes. The source tree is left intact; the caller removes it after.
  async function copyTree(from, to) {
    const files = await listFiles(from);
    for (const rel of files) {
      const bytes = await fs.promises.readFile(`${from}/${rel}`);
      const destDir = `${to}/${rel}`.split('/').slice(0, -1).join('/');
      await mkdirp(destDir);
      await fs.promises.writeFile(`${to}/${rel}`, bytes);
    }
  }

  /**
   * Move a book's whole working copy — `.git`, the working tree, unsaved edits
   * and unpushed commits — from `bookDir(fromId)` to `bookDir(toId)`, and point
   * its `origin` at `gitUrl`. Under the FROM book's lock: no other module knows
   * the new id yet, so nothing else holds its lock. Put-online adopts the service
   * id this way (Decision 3), and books.fork moves a book onto its fork's id.
   *
   * @param {{ fromId: string, toId: string, gitUrl: string }} opts
   */
  function relocate({ fromId, toId, gitUrl }) {
    return locks.withLock(fromId, async () => {
      const from = git.bookDir(fromId);
      const to = git.bookDir(toId);
      await copyTree(from, to);
      await removeTree(from);
      await git.setRemote({ dir: to, url: gitUrl });
    });
  }

  /**
   * Put a device-only book online. Create it on Estante (empty, private — the
   * service create happens FIRST, Decision 4), then under the local book's lock
   * relocate the working copy from `bookDir(localId)` to `bookDir(serviceId)`
   * (Decision 3) and point it at the service remote. Finally push the first
   * commit best-effort under the service book's lock: a push that cannot
   * complete (network dropped mid-act) is not lost — the book is already hosted
   * and the sync engine pushes it on its next pass (offline-first, Decision 4).
   *
   * Throws if the SERVICE create fails (quota/`413`, no session/`401`, offline):
   * nothing is written on the device, so the act can be reported and retried.
   *
   * @param {{ localId: string, title: string }} opts
   * @returns {Promise<{ bookId: string, gitUrl: string, role: string, pushed: boolean }>}
   */
  async function putOnline({ localId, title }) {
    // Create on Estante first. On failure this throws before any device write.
    const book = await booksClient.create({ title });
    const serviceId = book.id;
    const gitUrl = book.gitUrl;

    // Relocate + set the remote under the local book's lock. No other module
    // knows the service id yet, so nothing else holds its lock.
    await relocate({ fromId: localId, toId: serviceId, gitUrl });

    // Push the first commit best-effort under the (service) book's lock. A
    // failure keeps the book hosted; the sync engine retries (Decision 4).
    let pushed = false;
    try {
      await locks.withLock(serviceId, () => git.push({ dir: git.bookDir(serviceId) }));
      pushed = true;
    } catch {
      pushed = false;
    }

    return { bookId: serviceId, gitUrl, role: book.role, pushed };
  }

  /**
   * Zip the book's repository exactly as it is on the device (workflow 7
   * L55-63): every path under `bookDir(bookId)` — the whole `.git` and the
   * working tree, unsaved changes included — with the remote stripped from the
   * zipped `.git/config`. Read under the book's lock so a concurrent save does
   * not tear the snapshot. Returns the zip as raw `bytes` (a `Uint8Array`):
   * bytes cross the Worker boundary cleanly under `postMessage`'s structured
   * clone, where the main thread wraps them in a Blob to save as a file — the
   * Worker never holds the DOM save path (DIRECTION §3.7).
   *
   * @param {{ bookId: string }} opts
   * @returns {Promise<{ bytes: Uint8Array }>}
   */
  function download({ bookId }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      const paths = await listFiles(dir);
      const entries = [];
      for (const rel of paths) {
        if (rel === '.git/config') {
          // Strip the service remote from the zipped config only; the on-device
          // repo keeps its remote (workflow 7 L60).
          const text = await fs.promises.readFile(`${dir}/${rel}`, 'utf8');
          entries.push({ name: rel, bytes: utf8.encode(stripRemoteFromConfig(text)) });
        } else {
          entries.push({ name: rel, bytes: await fs.promises.readFile(`${dir}/${rel}`) });
        }
      }
      const blob = await createZip(entries);
      return { bytes: new Uint8Array(await blob.arrayBuffer()) };
    });
  }

  /**
   * Remove this device's clone of a book (workflow 7 L128-135): delete
   * `bookDir(bookId)`. The service book (if any) is untouched — no network. The
   * shelf-register tombstone is logic.js's, as the shelf write is. Under the
   * book's lock.
   *
   * @param {{ bookId: string }} opts
   */
  function remove({ bookId }) {
    return locks.withLock(bookId, () => removeTree(git.bookDir(bookId)));
  }

  /**
   * Delete a book from Estante for everyone (owner only, workflow 7 L136-137):
   * `DELETE /api/books/{bookId}` first, then remove the local clone. The
   * service call is outside the lock (it is the network act); a non-owner's
   * attempt is refused by the service (`403`/`404`) and throws before any local
   * removal. The typed-name guard is the app's (the view enables this only on an
   * exact match — service.books decision).
   *
   * @param {{ bookId: string }} opts
   */
  async function deleteBook({ bookId }) {
    await booksClient.remove(bookId);
    await locks.withLock(bookId, () => removeTree(git.bookDir(bookId)));
  }

  /**
   * Strip the `[remote "origin"]` section from a book's on-device `.git/config`,
   * leaving its repository, working copy and history in place (account.sign_out
   * keep-as-local, Decision 3; the home-book-remote strip, Constraint 9). Unlike
   * `download`, which strips only the zipped copy, this rewrites the on-device
   * config so the now-local book no longer tracks the service and a later SYNC is
   * a no-op with no origin. Idempotent: a missing config or a config with no
   * origin remote leaves the bytes unchanged. Under the book's lock. No network.
   *
   * @param {{ bookId: string }} opts
   */
  function detach({ bookId }) {
    return locks.withLock(bookId, async () => {
      const configPath = `${git.bookDir(bookId)}/.git/config`;
      let text;
      try {
        text = await fs.promises.readFile(configPath, 'utf8');
      } catch (err) {
        if (err?.code === 'ENOENT') return; // no repo/config here — nothing to detach
        throw err;
      }
      const stripped = stripRemoteFromConfig(text);
      if (stripped !== text) await fs.promises.writeFile(configPath, stripped);
    });
  }

  return { putOnline, relocate, download, remove, deleteBook, detach };
}

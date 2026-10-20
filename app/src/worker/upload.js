// upload.js — the Worker engine behind workflow 7 §Uploading a book
// (sync.upload). A zip is uploaded and the app reads it as a remote to pull
// from: the bytes are read with `readZip`, materialised into a scratch repo on
// the shared fs, the uploader's uncommitted working-tree edits are read as one
// synthetic *changes from the upload* commit, and the upload is previewed song
// by song before anything is written to the book. On confirm it lands one of
// two ways — imported as a fresh local book (its history taken verbatim, or a
// folder / escape-hatch tree written as one canonical first commit) or merged
// into an existing book the user can save to, by the SAME cifra-aware merge sync
// uses, with the zip's temporary ref as *theirs*. What genuinely collides lands
// in the existing conflict session (conflicts.js), reached by generalising its
// incoming ref (Decision 3).
//
// It is the reader side of `book-zip.js` (the download's writer had no consumer)
// and the sibling of online.js / add-by-link.js, composed over the same shared
// primitives (the git transport, the per-book lock, the shared fs) plus the
// cifra merge driver. Everything runs in the Worker (DIRECTION §3.7); the view
// (books.upload_ui) only picks the zip, renders the preview and sends the
// confirm.
//
// UNTRUSTED INPUT (Constraints): nothing in the zip is executed. Only repository
// paths are read; `.git/config` (and so its remotes) and `.git/hooks` are
// ignored, and an entry name that would escape the scratch dir (zip-slip), a
// non-zip buffer or a CRC failure is refused (readZip throws / the materialise
// step throws; logic.js surfaces it as an error event, never a crash).
//
// CANONICAL FORM over preserving content (Constraints, spec §8.1): wherever
// Estante AUTHORS a commit — the synthetic working-tree commit, a folder /
// unrelated / escape-hatch first commit, and (through the merge driver) the
// merge commit — each song is written by the §8 writer (`canonicaliseFile`, the
// single marker gate), and a marked text is never written. A VERBATIM history
// import (objects copied) is git transport, taken as-is (Decision 5).
//
// No song text, titles, ids, commit messages or secrets in logs (standing rule):
// this module logs nothing; its authored commits name only the act. Framework-
// free, Worker-only: plain ESM, no React.

import {
  resolveRef,
  readBlob,
  walk,
  TREE,
  add as gitAdd,
  remove as gitRemove,
  commit as gitCommit,
  writeRef,
  findMergeBase,
  checkout,
  statusMatrix,
  log as gitLog,
} from 'isomorphic-git';
import { parse } from 'cifra-md';
import { canonicaliseFile } from './canonicalise.js';
import { authorFrom } from './author.js';
import { createMergePath, basename, titleOf, diffRow, readBlobBytes } from './bring-in.js';
import { readZip } from './book-zip.js';
import { readmeTitle } from './readme-title.js';
import { GITATTRIBUTES_BYTES } from './books.js';

const SONG_SUFFIX = '.cifra.md';
const SETLIST_SUFFIX = '.setlist.md';
const isMergeable = (p) => p.endsWith(SONG_SUFFIX) || p.endsWith(SETLIST_SUFFIX);
const decoder = new TextDecoder();

// The scratch-repo root for one upload (Decision 8): under `/uploads/<id>`, never
// under `/books`, so it is never mistaken for a book and is removed on confirm,
// cancel or abandon.
const scratchDirOf = (uploadId) => `/uploads/${uploadId}`;
const uploadRefOf = (uploadId) => `refs/upload/${uploadId}`;

/**
 * Validate one zip entry name against zip-slip (Constraints): reject an absolute
 * path, a Windows drive, a backslash-separated escape or any `..` segment, so a
 * materialised entry can only land inside the scratch dir. Returns the POSIX name
 * to write, or null when the name is unsafe.
 *
 * @param {string} name
 * @returns {string|null}
 */
export function safeEntryName(name) {
  if (typeof name !== 'string' || name.length === 0) return null;
  const posix = name.replace(/\\/g, '/');
  if (posix.startsWith('/')) return null; // absolute
  if (/^[a-zA-Z]:/.test(posix)) return null; // drive letter
  if (posix.split('/').some((seg) => seg === '..')) return null; // traversal
  return posix;
}

// The zip bytes as an ArrayBuffer (readZip takes a buffer). A Uint8Array is
// sliced to its own window so a shared buffer is not over-read.
function toArrayBuffer(bytes) {
  if (bytes instanceof ArrayBuffer) return bytes;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/**
 * Build the upload engine over the shared primitives (sync.upload Decision 1).
 *
 * @param {{
 *   fs: import('./fs.js').FileSystem,
 *   git: ReturnType<typeof import('./git.js').createGitLayer>,
 *   locks: ReturnType<typeof import('./locks.js').createBookLocks>,
 *   mergeDriver: Function,
 *   resolveAuthor?: () => Promise<{ id: string, name: string }>,
 *   now?: () => number,
 * }} deps
 */
export function createUpload({ fs, git, locks, mergeDriver, resolveAuthor, now } = {}) {
  if (!fs) throw new Error('createUpload requires an fs');
  if (!git) throw new Error('createUpload requires a git layer');
  if (!locks) throw new Error('createUpload requires a lock registry');
  if (!mergeDriver) throw new Error('createUpload requires a merge driver');
  const author = resolveAuthor ?? (async () => ({ id: 'device', name: 'Me' }));
  const clock = now ?? (() => Date.now());
  const EMPTY = parse('');
  // The preview and the merge are the shared merge path (bring-in.js), the one
  // a fork's bring-in also takes (sync.fork_follow AC10).
  const { previewMerge, mergeInto } = createMergePath({ fs, git, locks, mergeDriver });

  // ---- shared fs-tree helpers (the online.js copyTree pattern) -------------

  async function listFiles(dir, prefix = '') {
    let names;
    try {
      names = await fs.promises.readdir(dir);
    } catch (err) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
    const files = [];
    for (const name of names) {
      const full = `${dir}/${name}`;
      const rel = prefix ? `${prefix}/${name}` : name;
      const stat = await fs.promises.stat(full);
      if (stat.isDirectory()) files.push(...(await listFiles(full, rel)));
      else files.push(rel);
    }
    return files;
  }

  async function removeTree(dir) {
    let names;
    try {
      names = await fs.promises.readdir(dir);
    } catch (err) {
      if (err?.code === 'ENOENT') return;
      throw err;
    }
    for (const name of names) {
      const full = `${dir}/${name}`;
      const stat = await fs.promises.stat(full);
      if (stat.isDirectory()) await removeTree(full);
      else await fs.promises.unlink(full);
    }
    await fs.promises.rmdir(dir);
  }

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

  // Byte-preserving copy (no text decode, so binary `.git` objects survive).
  async function copyTree(from, to) {
    for (const rel of await listFiles(from)) {
      const bytes = await fs.promises.readFile(`${from}/${rel}`);
      const destDir = `${to}/${rel}`.split('/').slice(0, -1).join('/');
      await mkdirp(destDir);
      await fs.promises.writeFile(`${to}/${rel}`, bytes);
    }
  }

  // Copy a repo's objects (content-addressed, so the overlay is safe and
  // idempotent — Decision 2) from one repo dir into another's object store.
  async function copyObjects(fromRepo, toRepo) {
    await copyTree(`${fromRepo}/.git/objects`, `${toRepo}/.git/objects`);
  }

  // ---- git reads over the fs ----------------------------------------------

  async function oidAt(dir, ref) {
    try {
      return await resolveRef({ fs, dir, ref });
    } catch {
      return null;
    }
  }

  async function blobText(dir, oid, filepath) {
    if (!oid) return null;
    try {
      const { blob } = await readBlob({ fs, dir, oid, filepath });
      return decoder.decode(blob);
    } catch {
      return null;
    }
  }

  const blobBytes = (dir, oid, filepath) => readBlobBytes(fs, dir, oid, filepath);

  // The song/setlist blobs of one commit's tree: `[{ path, oid }]`.
  async function treeSongs(dir, oid) {
    if (!oid) return [];
    const rows = await walk({
      fs,
      dir,
      trees: [TREE({ ref: oid })],
      map: async (filepath, [entry]) => {
        if (filepath === '.' || !entry) return undefined;
        if ((await entry.type()) === 'tree') return undefined;
        if (!isMergeable(filepath)) return undefined;
        return { path: filepath, oid: await entry.oid() };
      },
    });
    return rows.filter(Boolean);
  }

  // Every file in a commit's tree (any kind): `[{ path, bytes }]`.
  async function treeFiles(dir, oid) {
    if (!oid) return [];
    const rows = await walk({
      fs,
      dir,
      trees: [TREE({ ref: oid })],
      map: async (filepath, [entry]) => {
        if (filepath === '.' || !entry) return undefined;
        if ((await entry.type()) === 'tree') return undefined;
        return { path: filepath, oid: await entry.oid() };
      },
    });
    const out = [];
    for (const row of rows.filter(Boolean)) {
      out.push({ path: row.path, bytes: await blobBytes(dir, row.oid) });
    }
    return out;
  }

  // Every file in a non-bare repo's working tree (outside `.git`).
  async function workingFiles(repoDir) {
    const files = [];
    for (const rel of await listFiles(repoDir)) {
      if (rel === '.git' || rel.startsWith('.git/')) continue;
      files.push({ path: rel, bytes: await fs.promises.readFile(`${repoDir}/${rel}`) });
    }
    return files;
  }

  // ---- materialise the zip as a scratch repo (Decision 2) ------------------

  // Write the zip entries into the scratch dir, refusing a zip-slip name and
  // ignoring `.git/config` (and its remotes) and `.git/hooks` — nothing in them
  // is read or run (Constraints).
  async function materialise(scratchDir, entries) {
    for (const { name, bytes } of entries) {
      const safe = safeEntryName(name);
      if (safe === null) throw new Error('upload: unsafe entry name');
      if (safe === '.git/config' || safe.startsWith('.git/hooks/')) continue;
      const destDir = `${scratchDir}/${safe}`.split('/').slice(0, -1).join('/');
      await mkdirp(destDir);
      await fs.promises.writeFile(`${scratchDir}/${safe}`, bytes);
    }
  }

  // The checked-out branch name from `.git/HEAD` (workflow 7 §Which branch), or
  // null when detached or absent.
  async function checkedOutBranch(scratchDir) {
    let head;
    try {
      head = await fs.promises.readFile(`${scratchDir}/.git/HEAD`, 'utf8');
    } catch {
      return null;
    }
    const m = head.match(/^ref:\s*refs\/heads\/(.+?)\s*$/);
    return m ? m[1] : null;
  }

  // Read the uploader's uncommitted working-tree edits as one synthetic *changes
  // from the upload* commit on top of the checked-out head (workflow 7 §Edits
  // never committed). A working song holding a marker line is LEFT OUT — recorded
  // for the preview, never staged (§11.12.3, workflow 7 §A merge left half done);
  // a staged song is canonicalised (Estante authors canonical, acceptance 9).
  // Returns `{ headForMerge, markedOut }`.
  async function synthesiseWorkingCommit(scratchDir, headOid) {
    const rows = await statusMatrix({ fs, dir: scratchDir });
    const markedOut = [];
    let staged = false;
    for (const [filepath, head, workdir, stage] of rows) {
      const clean = (head === 1 && workdir === 1 && stage === 1) || (head === 0 && workdir === 0);
      if (clean) continue;
      if (workdir === 0) {
        // A working deletion: stage the removal.
        try {
          await gitRemove({ fs, dir: scratchDir, filepath });
          staged = true;
        } catch {
          /* not in the index */
        }
        continue;
      }
      if (!isMergeable(filepath)) {
        // A non-song working change (e.g. an edited README): stage it verbatim —
        // canonical form governs songs/setlists, not prose.
        await gitAdd({ fs, dir: scratchDir, filepath });
        staged = true;
        continue;
      }
      const bytes = await fs.promises.readFile(`${scratchDir}/${filepath}`);
      const res = canonicaliseFile(filepath, bytes);
      if (!res.ok) {
        // Marked → leave it out with its first marker line (never merged, never
        // written); unreadable → leave it out too. The book keeps its version.
        if (res.reason === 'marked') markedOut.push({ path: filepath, line: res.line });
        continue;
      }
      await fs.promises.writeFile(`${scratchDir}/${filepath}`, res.text);
      await gitAdd({ fs, dir: scratchDir, filepath });
      staged = true;
    }
    if (!staged) return { headForMerge: headOid, markedOut };
    const identity = authorFrom(await author(), clock());
    const syntheticOid = await gitCommit({
      fs,
      dir: scratchDir,
      // Content-free: names the act, never a song (standing rule).
      message: 'changes from the upload',
      author: identity,
      committer: identity,
      parent: headOid ? [headOid] : [],
    });
    return { headForMerge: syntheticOid, markedOut };
  }

  // Scan the zip's history for a committed marker line (workflow 7 §A merge left
  // half done, in the zip's history). Walks commits from `headOid`, checking each
  // distinct song/setlist blob once; returns the first found with the commit and
  // file and whether the latest (head) tree is itself clean (the escape-hatch
  // gate), or null when the history holds no marker.
  async function scanHistoryMarkers(dir, headOid) {
    if (!headOid) return null;
    let entries;
    try {
      entries = await gitLog({ fs, dir, ref: headOid });
    } catch {
      return null;
    }
    const seen = new Set();
    let found = null;
    for (const entry of entries) {
      for (const song of await treeSongs(dir, entry.oid)) {
        if (seen.has(song.oid)) continue;
        seen.add(song.oid);
        const bytes = await blobBytes(dir, song.oid);
        const res = canonicaliseFile(song.path, bytes);
        if (!res.ok && res.reason === 'marked') {
          found = { commit: entry.oid, path: song.path, line: res.line };
          break;
        }
      }
      if (found) break;
    }
    if (!found) return null;
    // Is the latest version itself clean (so the escape hatch is on offer)?
    let latestClean = true;
    for (const song of await treeSongs(dir, headOid)) {
      const res = canonicaliseFile(song.path, await blobBytes(dir, song.oid));
      if (!res.ok && res.reason === 'marked') {
        latestClean = false;
        break;
      }
    }
    return { ...found, latestClean };
  }

  // ---- preview (Decision 4): classify, never mutate the target -------------

  async function previewUnrelated(dir, oursOid, theirsOid) {
    const previews = [];
    const oursPaths = new Set((await treeSongs(dir, oursOid)).map((s) => s.path));
    for (const song of await treeSongs(dir, theirsOid)) {
      if (oursPaths.has(song.path)) {
        // A book kept somewhere else: every song present in both is a conflict to
        // choose between (workflow 7 §Unrelated history; spec §11.4).
        const txt = await blobText(dir, song.oid);
        previews.push({ path: song.path, title: titleOf(song.path, txt), status: 'conflict', line: null });
      } else {
        const after = parse(await blobText(dir, song.oid));
        previews.push(diffRow(song.path, 'added', EMPTY, after));
      }
    }
    return previews;
  }

  async function previewReplace(bookDir, oursOid, files) {
    const previews = [];
    const oursPaths = new Set((await treeSongs(bookDir, oursOid)).map((s) => s.path));
    for (const { path, bytes } of files) {
      if (!isMergeable(path)) continue;
      const res = canonicaliseFile(path, bytes);
      if (!res.ok) {
        if (res.reason === 'marked') previews.push({ path, title: titleOf(path, decoder.decode(bytes)), status: 'unresolved', line: res.line });
        continue;
      }
      const after = parse(res.text);
      if (oursPaths.has(path)) {
        const before = parse((await blobText(bookDir, oursOid, path)) ?? '');
        previews.push(diffRow(path, 'replace', before, after));
      } else {
        previews.push(diffRow(path, 'added', EMPTY, after));
      }
    }
    return previews;
  }

  async function previewNewBook(scratchDir, hasHistory, headForMerge) {
    const previews = [];
    // Each song's bytes: from the head tree (with history) or the folder files.
    const songs = hasHistory
      ? await Promise.all(
          (await treeSongs(scratchDir, headForMerge)).map(async (s) => ({
            path: s.path,
            bytes: await blobBytes(scratchDir, s.oid),
          })),
        )
      : (await workingFiles(scratchDir)).filter((f) => isMergeable(f.path));
    for (const { path, bytes } of songs) {
      const res = canonicaliseFile(path, bytes);
      if (!res.ok) {
        if (res.reason === 'marked') previews.push({ path, title: titleOf(path, decoder.decode(bytes)), status: 'unresolved', line: res.line });
        continue;
      }
      previews.push(diffRow(path, 'added', EMPTY, parse(res.text)));
    }
    return previews;
  }

  /**
   * Read a zip and preview what importing / merging it would do, song by song,
   * WITHOUT writing to the target (workflow 7 §The preview). Materialises the
   * scratch repo, synthesises the working-tree commit, points a temporary ref at
   * the head, and classifies. Returns the preview model (see protocol.js
   * UPLOAD_PREVIEW); `uploadId` names the scratch repo for IMPORT / CANCEL.
   *
   * @param {{ target: { kind: 'new' } | { kind: 'existing', bookId: string }, bytes: ArrayBuffer|Uint8Array }} opts
   */
  async function preview({ target, bytes }) {
    const uploadId = globalThis.crypto.randomUUID();
    const scratchDir = scratchDirOf(uploadId);
    const entries = await readZip(toArrayBuffer(bytes)); // throws on non-zip / CRC
    await materialise(scratchDir, entries); // throws on zip-slip
    const branchHead = await oidAt(scratchDir, 'HEAD');
    const hasHistory = branchHead != null;
    let branch = null;
    let headForMerge = branchHead;
    let markedOut = [];
    let historyMarkers = null;
    if (hasHistory) {
      branch = await checkedOutBranch(scratchDir);
      const built = await synthesiseWorkingCommit(scratchDir, branchHead);
      headForMerge = built.headForMerge;
      markedOut = built.markedOut;
      await writeRef({ fs, dir: scratchDir, ref: uploadRefOf(uploadId), value: headForMerge, force: true });
      historyMarkers = await scanHistoryMarkers(scratchDir, headForMerge);
    }

    let previews = [];
    let sharedHistory = false;
    if (target.kind === 'new') {
      previews = await previewNewBook(scratchDir, hasHistory, headForMerge);
    } else {
      const dir = git.bookDir(target.bookId);
      const oursOid = await oidAt(dir, 'main');
      if (hasHistory) {
        // Classify WITHOUT mutating the book (Constraints): copy the book's
        // objects INTO the disposable scratch so base / ours / theirs are all
        // readable there and `findMergeBase` sees both graphs; the book is
        // untouched until IMPORT.
        await copyObjects(dir, scratchDir);
        let baseOid = null;
        try {
          baseOid = (await findMergeBase({ fs, dir: scratchDir, oids: [oursOid, headForMerge].filter(Boolean) }))?.[0] ?? null;
        } catch {
          baseOid = null;
        }
        sharedHistory = baseOid != null;
        previews = sharedHistory
          ? await previewMerge(scratchDir, baseOid, oursOid, headForMerge)
          : await previewUnrelated(scratchDir, oursOid, headForMerge);
      } else {
        previews = await previewReplace(dir, oursOid, await workingFiles(scratchDir));
      }
    }
    for (const m of markedOut) {
      previews.push({ path: m.path, title: basename(m.path), status: 'unresolved', line: m.line });
    }

    return { uploadId, target, branch, hasHistory, sharedHistory, historyMarkers, previews };
  }

  // ---- import (Decision 1): the only writer --------------------------------

  // Make a fresh local book whose single first commit holds `files` — the folder
  // / unrelated / escape-hatch path (Decision 5, 6). Songs are canonicalised (the
  // §8 writer; a marked one is skipped), prose copied verbatim; `.gitattributes`
  // is ensured and a README gives the title (DIRECTION §2.1). A zip with no
  // README gets one scaffolded under `untitledTitle` (the main thread's
  // localized *Untitled book*); a README with no level-1 heading is kept as
  // written and the book has no title (`null` — songs.no_raw_ids Constraint 9).
  // Returns the book.
  async function createFirstCommitBook(files, identity, untitledTitle) {
    const bookId = `local-${globalThis.crypto.randomUUID()}`;
    let title = null;
    await locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      await git.init({ dir });
      let hasAttributes = false;
      let hasReadme = false;
      for (const { path, bytes } of files) {
        if (path.startsWith('.git/') || path === '.git') continue;
        if (path === '.gitattributes') hasAttributes = true;
        if (path === 'README.md') {
          hasReadme = true;
          title = readmeTitle(bytes);
        }
        let out = bytes;
        if (isMergeable(path)) {
          const res = canonicaliseFile(path, bytes);
          if (!res.ok) continue; // never write a marked / unreadable song
          out = res.text;
        }
        const destDir = `${dir}/${path}`.split('/').slice(0, -1).join('/');
        if (destDir !== dir) await mkdirp(destDir);
        await fs.promises.writeFile(`${dir}/${path}`, out);
        await gitAdd({ fs, dir, filepath: path });
      }
      if (!hasAttributes) {
        await fs.promises.writeFile(`${dir}/.gitattributes`, GITATTRIBUTES_BYTES);
        await gitAdd({ fs, dir, filepath: '.gitattributes' });
      }
      if (!hasReadme && untitledTitle) {
        title = untitledTitle;
        await fs.promises.writeFile(`${dir}/README.md`, `# ${title}\n`);
        await gitAdd({ fs, dir, filepath: 'README.md' });
      }
      await gitCommit({ fs, dir, message: 'Create book', author: identity, committer: identity });
      await fs.flush?.();
    });
    return { bookId, title };
  }

  // Import the zip's history verbatim as a fresh local book (Decision 5): copy
  // the whole scratch repo, point `main` at the head (incl. the synthetic commit),
  // drop the temporary ref and check out. Objects are taken as the zip authored
  // them — canonicalising history is the hook's at push, not this task's.
  async function importVerbatim(scratchDir, uploadId, headForMerge) {
    const bookId = `local-${globalThis.crypto.randomUUID()}`;
    let title = null;
    await locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      // A fresh repo on `main` (HEAD symbolically on the branch, so a later save
      // advances it), the zip's objects copied in, `main` pointed at the head.
      // Only objects cross — never the zip's HEAD/branch/config or its working
      // tree, so an untracked left-out file (a marked file, §11.12.3) and the
      // zip's config/remotes never slip in; `checkout` materialises exactly the
      // committed tree.
      await git.init({ dir });
      await copyObjects(scratchDir, dir);
      await writeRef({ fs, dir, ref: 'refs/heads/main', value: headForMerge, force: true });
      await checkout({ fs, dir, ref: 'main', force: true });
      // `checkout` can leave HEAD detached at the oid; re-attach it to `main` so a
      // later save commits onto the branch (advancing `main`, not a stray HEAD).
      await writeRef({ fs, dir, ref: 'HEAD', value: 'refs/heads/main', symbolic: true, force: true });
      title = readmeTitle(await blobBytes(dir, headForMerge, 'README.md'));
      await fs.flush?.();
    });
    return { bookId, title };
  }

  // A no-history zip into an existing book is a REPLACE, not a merge (Decision 6;
  // spec §11.1): each matching file the reader chose is written with the uploaded
  // (canonical) version, non-matching files added, in one ordinary single-parent
  // commit, then pushed best-effort.
  async function replaceInto(bookId, scratchDir, perFile, identity) {
    const dir = git.bookDir(bookId);
    return locks.withLock(bookId, async () => {
      const oursHead = await oidAt(dir, 'main');
      const oursPaths = new Set((await treeSongs(dir, oursHead)).map((s) => s.path));
      const replaceAll = perFile == null;
      const chosen = new Set(perFile ?? []);
      let wrote = false;
      for (const { path, bytes } of await workingFiles(scratchDir)) {
        const matches = oursPaths.has(path);
        if (matches && !(replaceAll || chosen.has(path))) continue; // keep the book's
        if (path === '.gitattributes' || path === 'README.md') continue; // keep the book's identity
        let out = bytes;
        if (isMergeable(path)) {
          const res = canonicaliseFile(path, bytes);
          if (!res.ok) continue; // never write a marked / unreadable song
          out = res.text;
        } else if (matches && !(replaceAll || chosen.has(path))) {
          continue;
        }
        const destDir = `${dir}/${path}`.split('/').slice(0, -1).join('/');
        if (destDir !== dir) await mkdirp(destDir);
        await fs.promises.writeFile(`${dir}/${path}`, out);
        await gitAdd({ fs, dir, filepath: path });
        wrote = true;
      }
      let pushed = false;
      if (wrote) {
        await gitCommit({ fs, dir, message: 'Import', author: identity, committer: identity });
        await fs.flush?.();
        try {
          await git.push({ dir });
          pushed = true;
        } catch {
          pushed = false;
        }
      }
      return { kind: 'replaced', pushed };
    });
  }

  /**
   * Land a previewed upload on confirm (workflow 7 §Ends one of two ways). The
   * scratch repo named by `uploadId` is read from disk; `choice` chooses the
   * landing. Returns a discriminated result logic.js maps to an event:
   *   - `{ kind: 'new_book', bookId, title }` — `title` is the README's heading,
   *     `untitledTitle` for a scaffolded README, else `null` (no title)
   *   - `{ kind: 'merged' | 'replaced', bookId, pushed }`
   *   - `{ kind: 'needs_you', bookId }`
   *
   * @param {{ uploadId: string, choice: 'new_book'|'latest_without_history'|'merge'|'replace',
   *   target?: { bookId?: string }, perFile?: string[], untitledTitle?: string }} opts
   */
  async function import_({ uploadId, choice, target, perFile, untitledTitle }) {
    const scratchDir = scratchDirOf(uploadId);
    const identity = authorFrom(await author(), clock());
    const headForMerge = await oidAt(scratchDir, uploadRefOf(uploadId));

    if (choice === 'new_book') {
      let out;
      if (headForMerge) {
        out = await importVerbatim(scratchDir, uploadId, headForMerge);
      } else {
        out = await createFirstCommitBook(await workingFiles(scratchDir), identity, untitledTitle);
      }
      await removeTree(scratchDir);
      return { kind: 'new_book', bookId: out.bookId, title: out.title };
    }

    if (choice === 'latest_without_history') {
      // The escape hatch (workflow 7 §A merge left half done, in the zip's
      // history): the latest clean tree as one canonical first commit.
      const out = await createFirstCommitBook(
        await treeFiles(scratchDir, headForMerge),
        identity,
        untitledTitle,
      );
      await removeTree(scratchDir);
      return { kind: 'new_book', bookId: out.bookId, title: out.title };
    }

    const bookId = target?.bookId;
    if (choice === 'merge') {
      const dir = git.bookDir(bookId);
      await copyObjects(scratchDir, dir);
      await writeRef({ fs, dir, ref: uploadRefOf(uploadId), value: headForMerge, force: true });
      // The SAME cifra-aware merge sync uses, with the zip's temp ref as *theirs*
      // (bring-in.js mergeInto): unsaved edits carried on top, still unsaved; a
      // collision leaves `main` at *ours* with the ref retained for the conflict
      // session (Decision 3).
      const result = await mergeInto(bookId, { theirsRef: uploadRefOf(uploadId), identity, fastForward: true });
      await removeTree(scratchDir); // the ref now lives in the book; the scratch is spent
      if (result.kind === 'needs_you') return { kind: 'needs_you', bookId };
      return { kind: 'merged', bookId, pushed: result.pushed };
    }

    // 'replace'
    const result = await replaceInto(bookId, scratchDir, perFile, identity);
    await removeTree(scratchDir);
    return { kind: 'replaced', bookId, pushed: result.pushed };
  }

  /**
   * Discard a previewed upload (workflow 7 §The preview, "nothing is written
   * until it is confirmed"): remove the scratch repo. A retained book-side upload
   * ref, if any, is the conflict session's to drop on abandon.
   *
   * @param {{ uploadId: string }} opts
   */
  async function cancel({ uploadId }) {
    await removeTree(scratchDirOf(uploadId));
    await fs.flush?.();
  }

  // The on-disk upload ref a book retains after a colliding upload merge, or null
  // — the resolver logic.js injects into the conflict session so it settles an
  // upload collision against `refs/upload/<id>` instead of origin/main (Decision
  // 3). Prefers an upload ref; falls back to the sync tracking ref.
  async function incomingRefFor(bookId, dir) {
    try {
      const names = await fs.promises.readdir(`${dir}/.git/refs/upload`);
      if (names && names.length) return uploadRefOf(names[0]);
    } catch {
      /* no upload ref */
    }
    return 'refs/remotes/origin/main';
  }

  return { preview, import_, cancel, incomingRefFor };
}

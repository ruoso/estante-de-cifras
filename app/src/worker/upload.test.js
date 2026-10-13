// Unit — reading a zip as a remote (sync.upload). No network remote: a source
// repo is built with isomorphic-git over `createFileSystem` on `fake-indexeddb`,
// zipped with the download's own writer (`createZip`), and read back by the
// upload engine exactly as a real upload would. Pins workflow 7 §Objects
// (`:79-82`), §Which branch (`:106`), §Edits never committed (`:90-93`); the zip
// reader (`book-zip.js:152`). Song text is written for the purpose (no-song-text
// rule).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  init as gitInit,
  add as gitAdd,
  commit as gitCommit,
  resolveRef,
  readBlob,
  log as gitLog,
} from 'isomorphic-git';

import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createCifraMergeDriver } from './cifra-merge-driver.js';
import { canonicaliseFile } from './canonicalise.js';
import { createZip } from './book-zip.js';
import { createUpload, safeEntryName } from './upload.js';
import { installWebLocks } from '../test/web-locks.js';

const rand = () => Math.random().toString(36).slice(2);
const AUTHOR = { name: 'Up Loader', email: 'up@example.invalid', timestamp: 1600000000, timezoneOffset: 0 };
const UPLOADER = { id: 'u_up', name: 'Up Loader' };

// A short, purpose-written song, canonical when written through the §8 writer.
const SONG = ['# Boa viagem', '', '```', '[C] ', 'Vai com calma', '```', ''].join('\n');

const dec = (b) => new TextDecoder().decode(b);

// A tiny recursive file lister (the download's listFiles, inlined for the test).
async function listFiles(fs, dir, prefix = '') {
  const names = await fs.promises.readdir(dir);
  const out = [];
  for (const nm of names) {
    const full = `${dir}/${nm}`;
    const rel = prefix ? `${prefix}/${nm}` : nm;
    const stat = await fs.promises.stat(full);
    if (stat.isDirectory()) out.push(...(await listFiles(fs, full, rel)));
    else out.push(rel);
  }
  return out;
}

async function zipRepo(fs, dir) {
  const entries = [];
  for (const rel of await listFiles(fs, dir)) {
    entries.push({ name: rel, bytes: await fs.promises.readFile(`${dir}/${rel}`) });
  }
  const blob = await createZip(entries);
  return new Uint8Array(await blob.arrayBuffer());
}

async function writeAdd(fs, dir, path, text) {
  await fs.promises.writeFile(`${dir}/${path}`, text);
  await gitAdd({ fs, dir, filepath: path });
}

// Build a source repo (README + .gitattributes + one song) with one commit on
// `main`, returning its fs and dir so a test can zip it or dirty its tree.
async function makeSourceRepo() {
  const fs = createFileSystem(`src-${rand()}-fs`, { indexedDB: new IDBFactory() });
  const dir = '/src';
  await gitInit({ fs, dir, defaultBranch: 'main' });
  await writeAdd(fs, dir, 'README.md', '# My book\n');
  await writeAdd(fs, dir, '.gitattributes', '*.cifra.md merge=cifra\n');
  await writeAdd(fs, dir, 'boa.cifra.md', SONG);
  await gitCommit({ fs, dir, message: 'Create book', author: AUTHOR, committer: AUTHOR });
  return { fs, dir };
}

function makeUpload() {
  const fs = createFileSystem(`up-${rand()}-fs`, { indexedDB: new IDBFactory() });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  const upload = createUpload({
    fs,
    git,
    locks,
    mergeDriver: createCifraMergeDriver(),
    resolveAuthor: async () => UPLOADER,
  });
  return { fs, git, upload };
}

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

describe('safeEntryName — zip-slip (Constraints)', () => {
  it('refuses absolute, drive, backslash and .. escapes; accepts in-repo paths', () => {
    expect(safeEntryName('../evil')).toBeNull();
    expect(safeEntryName('/etc/passwd')).toBeNull();
    expect(safeEntryName('a/../../b')).toBeNull();
    expect(safeEntryName('C:\\windows')).toBeNull();
    expect(safeEntryName('a\\..\\b')).toBeNull();
    expect(safeEntryName('songs/boa.cifra.md')).toBe('songs/boa.cifra.md');
    expect(safeEntryName('.git/objects/ab/cdef')).toBe('.git/objects/ab/cdef');
  });
});

describe('reading a zip as a remote (workflow 7 §Objects, §Which branch)', () => {
  it('materialises the scratch repo, finds the checked-out branch and points a temp ref at its head', async () => {
    const src = await makeSourceRepo();
    const head = await resolveRef({ fs: src.fs, dir: src.dir, ref: 'main' });
    const bytes = await zipRepo(src.fs, src.dir);

    const { fs, upload } = makeUpload();
    const model = await upload.preview({ target: { kind: 'new' }, bytes });

    expect(model.hasHistory).toBe(true);
    expect(model.branch).toBe('main'); // the zip's checked-out branch, named
    // The temporary ref points at the zip's head (no working edits → the head
    // itself), copying its objects into the store.
    const refHead = await resolveRef({ fs, dir: `/uploads/${model.uploadId}`, ref: `refs/upload/${model.uploadId}` });
    expect(refHead).toBe(head);
    // Every song previewed as added, before anything is written.
    expect(model.previews.map((p) => p.status)).toContain('added');
  });

  it('recognises a bare folder of songs as no history', async () => {
    const blob = await createZip([
      { name: 'boa.cifra.md', bytes: new TextEncoder().encode(SONG) },
      { name: 'README.md', bytes: new TextEncoder().encode('# Folder\n') },
    ]);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const { upload } = makeUpload();
    const model = await upload.preview({ target: { kind: 'new' }, bytes });

    expect(model.hasHistory).toBe(false);
    expect(model.branch).toBeNull();
    expect(model.previews.some((p) => p.path === 'boa.cifra.md' && p.status === 'added')).toBe(true);
  });

  it('reads an uncommitted working-tree edit as a synthetic "changes from the upload" commit (§Edits never committed)', async () => {
    const src = await makeSourceRepo();
    const committedHead = await resolveRef({ fs: src.fs, dir: src.dir, ref: 'main' });
    // Edit the working copy WITHOUT committing — the likely uploader's text-editor
    // change — and leave it a touch non-canonical (extra trailing newlines).
    const edited = SONG.replace('Vai com calma', 'Vai com muita calma') + '\n\n';
    await src.fs.promises.writeFile(`${src.dir}/boa.cifra.md`, edited);
    const bytes = await zipRepo(src.fs, src.dir);

    const { fs, upload } = makeUpload();
    const model = await upload.preview({ target: { kind: 'new' }, bytes });

    const dir = `/uploads/${model.uploadId}`;
    const synthetic = await resolveRef({ fs, dir, ref: `refs/upload/${model.uploadId}` });
    expect(synthetic).not.toBe(committedHead); // a new commit on top

    const [entry] = await gitLog({ fs, dir, ref: synthetic, depth: 1 });
    expect(entry.commit.message.trim()).toBe('changes from the upload');
    expect(entry.commit.author.name).toBe(UPLOADER.name); // by the uploading user
    expect(entry.commit.parent).toEqual([committedHead]);

    // The staged song is canonical, not its original spelling (acceptance 9).
    const { blob } = await readBlob({ fs, dir, oid: synthetic, filepath: 'boa.cifra.md' });
    const canonical = canonicaliseFile('boa.cifra.md', edited);
    expect(dec(blob)).toBe(canonical.text);
    expect(dec(blob)).not.toBe(edited);
  });
});

describe('untrusted input is refused (Constraints)', () => {
  it('rejects a buffer that is not a zip', async () => {
    const { upload } = makeUpload();
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    await expect(upload.preview({ target: { kind: 'new' }, bytes })).rejects.toThrow(/not a zip/);
  });

  it('rejects a zip whose entry did not arrive whole (CRC failure)', async () => {
    const name = 'boa.cifra.md';
    const blob = await createZip([{ name, bytes: new TextEncoder().encode(SONG) }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Corrupt the first bytes of the entry body (past the 30-byte local header +
    // the name), so the stored CRC no longer matches what arrived.
    const bodyStart = 30 + name.length;
    bytes[bodyStart] = bytes[bodyStart] ^ 0xff;
    bytes[bodyStart + 1] = bytes[bodyStart + 1] ^ 0xff;
    const { upload } = makeUpload();
    await expect(upload.preview({ target: { kind: 'new' }, bytes })).rejects.toThrow();
  });

  it('refuses a zip-slip entry name', async () => {
    const blob = await createZip([
      { name: '../escape.cifra.md', bytes: new TextEncoder().encode(SONG) },
    ]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { upload } = makeUpload();
    await expect(upload.preview({ target: { kind: 'new' }, bytes })).rejects.toThrow(/unsafe/);
  });

  it('ignores .git/hooks and .git/config — nothing in the zip is read or run', async () => {
    const src = await makeSourceRepo();
    // Plant a hook and keep the config in the zip: neither must be materialised.
    await src.fs.promises.writeFile(`${src.dir}/.git/hooks/pre-commit`, '#!/bin/sh\necho hi\n');
    const bytes = await zipRepo(src.fs, src.dir);

    const { fs, upload } = makeUpload();
    const model = await upload.preview({ target: { kind: 'new' }, bytes });
    const dir = `/uploads/${model.uploadId}`;

    await expect(fs.promises.stat(`${dir}/.git/hooks/pre-commit`)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.promises.stat(`${dir}/.git/config`)).rejects.toMatchObject({ code: 'ENOENT' });
    // The repo is still readable as a remote despite the dropped config.
    expect(model.hasHistory).toBe(true);
  });
});

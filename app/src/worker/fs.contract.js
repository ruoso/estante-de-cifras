// fs.contract.js — the reusable contract suite for the small filesystem
// interface (storage.fs). It pins the isomorphic-git `fs.promises` contract
// (fs.js Decision 1): every backend of the `FsPromises` `@typedef` must pass
// these same cases. lightning-fs passes them today (fs.test.js); a future OPFS
// backend calls the very same `runFsContract` and must pass unchanged, which is
// the whole point of shaping the interface to a documented external standard.
//
// Backend-agnostic by construction: it uses only the eleven interface methods
// and never references lightning-fs, IndexedDB, or any backend plumbing (the
// fake factory, the Web-Locks shim). `makeFs` is a factory the caller supplies
// that returns a fresh, isolated `FileSystem` (`{ promises }`) per case, so the
// suite stays a pure statement of behavior.

import { describe, it, expect } from 'vitest';

// Arbitrary byte content written for the purpose — no song text is needed at
// this layer (storage.fs: "any bytes used are arbitrary test content").
const BYTES = new Uint8Array([0x68, 0x69, 0x21]); // "hi!"

function bytes(fs, path, opts) {
  return fs.promises.readFile(path, opts);
}

/**
 * Register the interface's contract cases against a backend.
 *
 * @param {() => import('./fs.js').FileSystem} makeFs factory returning a fresh,
 *   isolated filesystem interface per case.
 */
export function runFsContract(makeFs) {
  describe('fs interface contract (isomorphic-git fs.promises)', () => {
    it('writes a file and reads the same bytes back', async () => {
      const fs = makeFs();
      await fs.promises.writeFile('/note.txt', BYTES);
      const got = await bytes(fs, '/note.txt');
      expect(Array.from(got)).toEqual(Array.from(BYTES));
    });

    it('round-trips utf8 text through the encoding option', async () => {
      const fs = makeFs();
      await fs.promises.writeFile('/hello.txt', 'olá mundo');
      expect(await bytes(fs, '/hello.txt', 'utf8')).toBe('olá mundo');
    });

    it('readdir lists the entries of a directory', async () => {
      const fs = makeFs();
      await fs.promises.mkdir('/songs');
      await fs.promises.writeFile('/songs/a.txt', BYTES);
      await fs.promises.writeFile('/songs/b.txt', BYTES);
      const entries = await fs.promises.readdir('/songs');
      expect([...entries].sort()).toEqual(['a.txt', 'b.txt']);
    });

    it('mkdir and rmdir nested directories', async () => {
      const fs = makeFs();
      await fs.promises.mkdir('/a');
      await fs.promises.mkdir('/a/b');
      expect(await fs.promises.readdir('/a')).toContain('b');
      await fs.promises.rmdir('/a/b');
      expect(await fs.promises.readdir('/a')).not.toContain('b');
    });

    it('stat reports size and that a file is a file', async () => {
      const fs = makeFs();
      await fs.promises.writeFile('/note.txt', BYTES);
      const st = await fs.promises.stat('/note.txt');
      expect(st.size).toBe(BYTES.byteLength);
      expect(st.isFile()).toBe(true);
      expect(st.isDirectory()).toBe(false);
    });

    it('stat reports that a directory is a directory', async () => {
      const fs = makeFs();
      await fs.promises.mkdir('/dir');
      const st = await fs.promises.stat('/dir');
      expect(st.isDirectory()).toBe(true);
      expect(st.isFile()).toBe(false);
    });

    it('unlink removes a file', async () => {
      const fs = makeFs();
      await fs.promises.writeFile('/gone.txt', BYTES);
      await fs.promises.unlink('/gone.txt');
      await expect(fs.promises.stat('/gone.txt')).rejects.toThrow();
    });

    it('rename moves a file to a new path', async () => {
      const fs = makeFs();
      await fs.promises.writeFile('/old.txt', BYTES);
      await fs.promises.rename('/old.txt', '/new.txt');
      expect(Array.from(await bytes(fs, '/new.txt'))).toEqual(Array.from(BYTES));
      await expect(fs.promises.stat('/old.txt')).rejects.toThrow();
    });

    it('symlink and readlink round-trip a link target, and lstat sees the link', async () => {
      const fs = makeFs();
      await fs.promises.writeFile('/target.txt', BYTES);
      await fs.promises.symlink('/target.txt', '/link.txt');
      expect(await fs.promises.readlink('/link.txt')).toBe('/target.txt');
      const lst = await fs.promises.lstat('/link.txt');
      expect(lst.isSymbolicLink()).toBe(true);
    });

    it('rejects reading, stat-ing, or listing a path that does not exist', async () => {
      const fs = makeFs();
      await expect(fs.promises.readFile('/missing.txt')).rejects.toThrow();
      await expect(fs.promises.stat('/missing.txt')).rejects.toThrow();
      await expect(fs.promises.readdir('/missing')).rejects.toThrow();
    });
  });
}

// save-preview.js — the per-file save preview (songs.save_sheet, Decision 2).
// "What changed, in musical terms": the semantic diff between the last-saved
// version and the working copy, for the save sheet, the discard confirm and
// *save all* (workflow 4 §Saving, §Several songs at once, §Discarding).
//
// The Worker owns HEAD and the working copy (DIRECTION §3.7), so the diff is
// computed here, not in the view: the view has neither, and one reply must serve
// N paths in one go (save all). It is a READ — no canonicalise, no commit, no
// push — composing the same primitives as the working copy and history (the git
// transport for `bookDir`, the per-book lock, the shared fs), mirroring
// `createHistory` (history.js).
//
// Framework-free, Worker-only: plain ESM, no React. Logs nothing — never song
// text (standing rule); the diff records never reach `console`.

import { diff, unknownTokens } from 'cifra-md';
import { resolveRef, readBlob } from 'isomorphic-git';

/**
 * Build the save-preview reader over the composed primitives — the same deps and
 * shape as `createWorkingCopy`/`createHistory`. `parse` is the cifra-md reader
 * (injected so logic.js can pass the same instance the index spies on).
 *
 * @param {{
 *   fs: import('./fs.js').FileSystem,
 *   git: ReturnType<typeof import('./git.js').createGitLayer>,
 *   locks: ReturnType<typeof import('./locks.js').createBookLocks>,
 *   parse: (input: string|Uint8Array) => object,
 * }} deps
 * @returns {{ preview: (opts: { bookId: string, paths: string[] }) =>
 *   Promise<{ previews: Array<{ path: string, title: string, changes: object[], summary: string, isNew: boolean, unknown: string[] }> }> }}
 */
export function createSavePreview({ fs, git, locks, parse } = {}) {
  if (!fs) throw new Error('createSavePreview requires an fs');
  if (!git) throw new Error('createSavePreview requires a git layer');
  if (!locks) throw new Error('createSavePreview requires a lock registry');
  if (!parse) throw new Error('createSavePreview requires a parse');

  const at = (dir, path) => `${dir}/${path}`;
  // Only a song lists its unknown words (Decision 6); a setlist holds no chart.
  const SONG = /\.cifra\.md$/;
  // The empty model a never-saved song diffs against — all-added.
  const EMPTY = parse('');

  // The last-saved bytes for a path: the blob at HEAD, or `null` when the path
  // has no committed version yet — a never-saved song, or a book with no
  // commits at all (resolveRef throws) — so the caller reads it as new.
  async function headBlob(dir, path) {
    let head;
    try {
      head = await resolveRef({ fs, dir, ref: 'HEAD' });
    } catch {
      return null;
    }
    try {
      const { blob } = await readBlob({ fs, dir, oid: head, filepath: path });
      return blob;
    } catch (err) {
      if (err?.code === 'NotFoundError') return null;
      throw err;
    }
  }

  // The words a save adds that the reader does not read as chords (spec §2.9;
  // workflow 4 §Saving): the distinct unknown tokens of the text to save, in
  // first-seen order, minus those the last-saved version already held — they
  // were asked about when it was saved (songs.unknown_tokens_loud Decision 4).
  function addedUnknown(beforeBytes, afterBytes) {
    const held = new Set(beforeBytes == null ? [] : unknownTokens(beforeBytes).map((tok) => tok.text));
    const out = [];
    for (const { text } of unknownTokens(afterBytes)) {
      if (!held.has(text) && !out.includes(text)) out.push(text);
    }
    return out;
  }

  // Preview one path: the semantic diff between HEAD (before) and the working
  // copy (after), the working copy's title, and whether the song is new. A path
  // in the save set whose working copy is GONE is a deletion (workflow 14 L147;
  // a rename removes the old path) — read it as HEAD → nothing rather than
  // letting the ENOENT abort the whole preview and leave the save note empty.
  async function previewPath(dir, path) {
    let afterBytes = null;
    try {
      afterBytes = await fs.promises.readFile(at(dir, path));
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
    const beforeBytes = await headBlob(dir, path);
    const before = beforeBytes == null ? null : parse(beforeBytes);
    if (afterBytes == null) {
      const { changes, summary } = diff(before ?? EMPTY, EMPTY);
      return {
        path,
        title: (before?.title ?? '').trim(),
        changes,
        summary,
        isNew: false,
        deleted: true,
        unknown: [],
      };
    }
    const after = parse(afterBytes);
    const { changes, summary } = diff(before ?? EMPTY, after);
    return {
      path,
      title: (after?.title ?? '').trim(),
      changes,
      summary,
      isNew: before === null,
      unknown: SONG.test(path) ? addedUnknown(beforeBytes, afterBytes) : [],
    };
  }

  // Preview every path under ONE lock on the book, so the read is consistent
  // with any concurrent save/discard (mirrors history's read-under-lock).
  function preview({ bookId, paths }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      const previews = [];
      for (const path of paths) previews.push(await previewPath(dir, path));
      return { previews };
    });
  }

  return { preview };
}

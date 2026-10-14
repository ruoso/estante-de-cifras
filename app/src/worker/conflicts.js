// conflicts.js — the Worker merge session (sync.conflicts, workflow 9). When
// the sync engine cannot settle a book alone it halts the book reading *needs
// you* and persists nothing (sync.engine; engine.md Decision): this module owns
// what happens when the user engages. On OPEN_CONFLICTS it recomputes the
// byte-deterministic merge from the three blobs (HEAD = *ours*, the retained
// `refs/remotes/origin/main` = *theirs*, their merge base = base) and
// MATERIALISES it in the working copy — every clean-merged file lands so the
// rest of the book carries on, each conflicted song stays at *ours* with its
// recomputed model held in memory. RESOLVE_CONFLICT settles one file by one side
// (`resolveMarked`), by the edited text, or by keeping/deleting a song; when the
// last file is settled it commits the two-parent merge (parents: local HEAD and
// origin/main) and pushes. ABANDON_MERGE resets the book to exactly before the
// sync.
//
// Everything runs in the Worker under the book's one Web Lock (locks.js;
// DIRECTION §3.7): git, the working copy and the index are the Worker's, the
// view is a mirror fed by the CONFLICTS event. No new IndexedDB store — the
// model is recomputed, not stored (engine.md's rejected conflict store). A
// marked text is never committed or pushed (§11.12.3): the commit gates every
// file on the format's own writer, refusing if a marker line remains. No song
// text is logged (standing rule).

import {
  resolveRef, findMergeBase, readBlob, walk, TREE, checkout,
  add as gitAdd, remove as gitRemove, commit as gitCommit, deleteRef, log as gitLog,
} from 'isomorphic-git';
import { parse, write, resolveMarked } from 'cifra-md';
import { authorFrom } from './author.js';
import { recomputeMerge } from './cifra-merge-driver.js';
import { canonicaliseFile } from './canonicalise.js';
import { songConflictModel, disputedChartLines, voicingKeepBothOp } from './conflict-model.js';
import { analyseSong } from '../core/song-analysis.js';
import { planIntoNewVariation, applyPlan } from '../core/voicing-plan/apply.js';
import { parseShorthand } from '../core/fretstring.js';
import { siblingFilename } from '../songs/song-filename.js';

// git's empty tree — the base when ours and theirs share no common ancestor
// (both added the file), so a side's absence reads as "not there in base".
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const SETLIST_SUFFIX = '.setlist.md';
const OURS = 'main';
const THEIRS = 'refs/remotes/origin/main';

function isSetlist(path) {
  return path.endsWith(SETLIST_SUFFIX);
}

// Replace the `ordinal`-th conflict region of a marked text by one side's lines,
// leaving every other region marked (§11.12.4 resolution by one side, one region
// at a time). The marker forms are those cifra.md's merge writes (§11.12.2):
// `<<<<<<< ours`, `=======`, `>>>>>>> theirs`.
function resolveRegionByOrdinal(marked, ordinal, side) {
  const lines = marked.split('\n');
  const out = [];
  let region = 0;
  let k = 0;
  while (k < lines.length) {
    if (lines[k] === '<<<<<<< ours') {
      const mid = lines.indexOf('=======', k);
      const end = lines.indexOf('>>>>>>> theirs', mid);
      if (region === ordinal) {
        const kept = side === 'ours' ? lines.slice(k + 1, mid) : lines.slice(mid + 1, end);
        out.push(...kept);
      } else {
        out.push(...lines.slice(k, end + 1)); // leave this region marked
      }
      region += 1;
      k = end + 1;
    } else {
      out.push(lines[k]);
      k += 1;
    }
  }
  return out.join('\n');
}

// Write each pending voicing keep-both into a canonical song (sync.keep_both
// Decision 2; §8.5.4/§8.5.5): the incoming author's shape lands in a variation
// named for them, copied from the in-use block so the arrangement is complete.
// ours's shape is already in its block (the conflict region was resolved to
// ours before this runs). A second keep-both for the same author accumulates
// into that one variation rather than making another. One parse, the §8 writer
// the single authority; returns the new canonical text (throws only if the
// writer refuses, which the caller turns into a refusal).
function applyVoicingKeepBoth(canonicalText, ops) {
  let model = parse(canonicalText);
  for (const op of ops) {
    const frets = parseShorthand(op.shorthand);
    if (!frets) continue; // theirs's shape unreadable — nothing to keep
    // Re-read each pass: an earlier op may have renumbered the chart (§8.3 I3).
    const reading = analyseSong(model);
    const entry = reading.line.find((e) => e.ref.key === op.key);
    if (!entry) continue; // the key is no longer in the chart (should not happen)
    const planResult = { shapes: new Map([[entry.at, { frets }]]), reading };
    try {
      model = planIntoNewVariation(model, planResult, {
        tuning: op.tuning,
        name: op.name,
        copyFrom: op.copyFrom,
      });
    } catch (err) {
      // The author's variation already exists (a second keep-both into it):
      // add theirs's shape to the same variation (Decision 2, "accumulate").
      if (!/already exists/.test(String(err?.message ?? err))) throw err;
      model = applyPlan(model, planResult, { tuning: op.tuning, variation: op.name });
    }
  }
  return write(model);
}

// The display title of a song/setlist from its text, or the file's basename
// when it cannot be read (never logged).
function titleOf(path, text) {
  if (text == null) return basename(path);
  try {
    return parse(text).title || basename(path);
  } catch {
    return basename(path);
  }
}

function basename(path) {
  const name = path.split('/').pop() ?? path;
  return name.replace(/\.(setlist\.md|cifra\.md|md)$/i, '');
}

/**
 * Build the conflict session subsystem.
 *
 * @param {{
 *   fs: object, git: object, locks: { withLock: Function },
 *   resolveAuthor: () => Promise<{ id: string, name: string }>,
 *   emit: (payload: object) => void,          // CONFLICTS
 *   emitRefused: (payload: object) => void,    // SAVE_REFUSED
 *   requestSync?: () => void,                  // let the engine re-emit the SYNC fact
 *   incomingRef?: (bookId: string, dir: string) => string | Promise<string>,
 *   now?: () => number,
 * }} deps
 */
export function createConflicts(deps) {
  const { fs, git, locks, resolveAuthor, emit, emitRefused } = deps;
  const requestSync = deps.requestSync ?? (() => {});
  const now = deps.now ?? (() => Date.now());
  const dirOf = (bookId) => git.bookDir(bookId);
  // The ref holding *theirs* — what the merge brought in. A racing sync retains
  // `refs/remotes/origin/main` (the default); an upload merge retains
  // `refs/upload/<uploadId>` (sync.upload Decision 3), so the same session, model,
  // screens and abandon/commit gate resolve either without a parallel path. The
  // resolver is injected (logic.js prefers an on-disk upload ref over origin/main),
  // so conflicts.js names no upload convention of its own.
  const resolveIncomingRef = deps.incomingRef ?? (() => THEIRS);

  // bookId -> in-progress merge session (in memory only; a reload re-engages).
  const sessions = new Map();

  function hasInProgressMerge(bookId) {
    return sessions.has(bookId);
  }

  async function oidAt(dir, ref) {
    try {
      return await resolveRef({ fs, dir, ref });
    } catch {
      return null;
    }
  }

  async function blobAt(dir, oid, filepath) {
    if (!oid) return null;
    try {
      const { blob } = await readBlob({ fs, dir, oid, filepath });
      return blob; // Uint8Array; cifra.md merge takes bytes directly
    } catch {
      return null; // absent on that side
    }
  }

  // The display name of whoever last changed `filepath` on theirs — the person
  // the user is settling against (*Ana's*). Never the device's own identity.
  // When theirs DELETED the file, a path-filtered log has nothing to follow (the
  // path is absent at the tip, so isomorphic-git throws) — walk theirs' history
  // instead for the newest commit whose tree lacks the file while its first
  // parent still has it: the deletion, and whoever made it.
  async function incomingAuthor(dir, ref, filepath) {
    try {
      const entries = await gitLog({ fs, dir, ref, filepath, depth: 1 });
      const name = entries?.[0]?.commit?.author?.name;
      if (name) return name;
    } catch {
      // absent at theirs' tip — a deletion; fall through to find who deleted it
    }
    return deletionAuthor(dir, ref, filepath);
  }

  async function deletionAuthor(dir, ref, filepath) {
    let entries;
    try {
      entries = await gitLog({ fs, dir, ref, depth: 64 });
    } catch {
      return null;
    }
    for (const entry of entries) {
      const parent = entry.commit.parent?.[0];
      if (!parent) continue;
      const here = await blobAt(dir, entry.oid, filepath);
      if (here != null) continue;
      const before = await blobAt(dir, parent, filepath);
      if (before != null) return entry.commit.author?.name ?? null;
    }
    return null;
  }

  // Every file that differs across base / ours / theirs (a path all three share
  // byte for byte needs no merge). Returns `[{ path, b, o, t }]` oid triples.
  async function changedPaths(dir, baseOid, oursOid, theirsOid) {
    const trees = [
      TREE({ ref: oursOid }),
      TREE({ ref: baseOid ?? EMPTY_TREE }),
      TREE({ ref: theirsOid }),
    ];
    const rows = await walk({
      fs, dir, trees,
      map: async (filepath, [ours, base, theirs]) => {
        if (filepath === '.') return undefined;
        const types = await Promise.all([ours?.type(), base?.type(), theirs?.type()]);
        if (types.some((ty) => ty === 'tree')) return undefined;
        const [o, b, t] = await Promise.all([
          ours ? ours.oid() : null,
          base ? base.oid() : null,
          theirs ? theirs.oid() : null,
        ]);
        if (o === b && b === t) return undefined; // unchanged on both sides
        return { path: filepath, b, o, t };
      },
    });
    return rows.filter(Boolean);
  }

  async function writeWorking(dir, filepath, text) {
    await fs.promises.writeFile(`${dir}/${filepath}`, text);
    await gitAdd({ fs, dir, filepath });
  }

  async function removeWorking(dir, filepath) {
    try {
      await fs.promises.unlink(`${dir}/${filepath}`);
    } catch {
      // already gone
    }
    try {
      await gitRemove({ fs, dir, filepath });
    } catch {
      // not in the index
    }
  }

  // The file names already in a book folder (for sibling-name collisions).
  async function folderListing(dir, folder) {
    const abs = folder ? `${dir}/${folder.replace(/\/$/, '')}` : dir;
    try {
      return await fs.promises.readdir(abs);
    } catch {
      return [];
    }
  }

  // Stage a resolved song's canonical text, applying any pending voicing
  // keep-both first (sync.keep_both). Returns true when staged, false on a
  // writer refusal (already emitted). Sets `f.resolved` on success.
  async function stageResolved(bookId, f, path, dir, canonicalText) {
    let text = canonicalText;
    if (f.keepBoth?.length) {
      try {
        text = applyVoicingKeepBoth(canonicalText, f.keepBoth);
      } catch (err) {
        emitRefused({ bookId, path, line: null, reason: 'unreadable', message: String(err?.message ?? err) });
        emit(buildPayload(bookId));
        return false;
      }
    }
    await writeWorking(dir, path, text);
    f.resolved = true;
    return true;
  }

  // Canonicalise a region conflict's marked text (refusing a marker line,
  // §11.12.3) and stage it. The single finalise path once a song's last region
  // is settled.
  async function stageFromMarked(bookId, f, path, dir) {
    const res = canonicaliseFile(path, f.marked);
    if (!res.ok) {
      emitRefused({ bookId, path, line: res.line ?? null, reason: res.reason });
      emit(buildPayload(bookId));
      return false;
    }
    return stageResolved(bookId, f, path, dir, res.text);
  }

  // Recompute + materialise. One lock, the whole engage.
  async function open(bookId) {
    return locks.withLock(bookId, async () => {
      const dir = dirOf(bookId);
      const incomingRef = await resolveIncomingRef(bookId, dir);
      const oursOid = await oidAt(dir, OURS);
      const theirsOid = await oidAt(dir, incomingRef);
      if (!oursOid || !theirsOid || oursOid === theirsOid) {
        // Nothing retained to merge — not (or no longer) a conflict.
        sessions.delete(bookId);
        emit({ bookId, inProgress: false });
        return;
      }
      let baseOid = null;
      try {
        const bases = await findMergeBase({ fs, dir, oids: [oursOid, theirsOid] });
        baseOid = bases?.[0] ?? null;
      } catch {
        baseOid = null;
      }

      const files = new Map();
      const incoming = [];
      const paths = await changedPaths(dir, baseOid, oursOid, theirsOid);
      for (const { path, b, o, t } of paths) {
        const setlist = isSetlist(path);
        const base = await blobAt(dir, baseOid, path);
        const ours = await blobAt(dir, oursOid, path);
        const theirs = await blobAt(dir, theirsOid, path);
        const outcome = recomputeMerge({ base, ours, theirs, setlist });
        if (outcome.kind === 'result') {
          await writeWorking(dir, path, outcome.result);
          // What came in with the merge (for *came in from Ana, already here*):
          // theirs moved this file (ours left it at base).
          if (t !== b) {
            incoming.push({
              path,
              title: titleOf(path, outcome.result),
              author: await incomingAuthor(dir, incomingRef, path),
              summary: o === b && b === null ? 'added' : 'changed',
            });
          }
          continue;
        }
        if (outcome.kind === 'deleted') {
          await removeWorking(dir, path);
          continue;
        }
        // A conflict: leave ours in the working copy (it is already checked out),
        // and hold the recomputed outcome for the resolution surfaces. A region
        // conflict keeps a live `marked` text and the remaining regions, both
        // shrinking as the user settles one at a time; a `file` conflict (deleted
        // on one side, edited on the other, or unreadable) has no region.
        const first = outcome.conflicts[0];
        const isFile = first.kind === 'file' || first.kind === 'unresolved';
        const author = await incomingAuthor(dir, incomingRef, path);
        const text = ours != null ? new TextDecoder().decode(ours) : theirs != null ? new TextDecoder().decode(theirs) : null;
        files.set(path, {
          setlist,
          kind: isFile ? 'file' : 'region',
          // region: the merge's marked text and the regions still unsettled.
          marked: outcome.marked ?? null,
          items: isFile ? [] : [...outcome.conflicts],
          // file: the deleted side and the edited side's canonical text to keep.
          deleted: first.deleted ?? null,
          kept: outcome.kept ?? null,
          author,
          title: titleOf(path, text),
          resolved: false,
        });
      }

      sessions.set(bookId, { dir, oursOid, theirsOid, baseOid, files, incoming, incomingRef });
      await surface(bookId);
    });
  }

  // The CONFLICTS payload from the live session.
  function buildPayload(bookId) {
    const session = sessions.get(bookId);
    if (!session) return { bookId, inProgress: false };
    const songs = [];
    const deleted = [];
    for (const [path, f] of session.files) {
      if (f.resolved) continue;
      if (f.kind === 'file') {
        deleted.push({ path, title: f.title, author: f.author, deleted: f.deleted });
        continue;
      }
      const pseudo = { kind: 'conflicts', conflicts: f.items, marked: f.marked };
      const model = songConflictModel(pseudo, { author: f.author });
      songs.push({
        path,
        title: f.title,
        count: model.count,
        author: f.author,
        marked: model.marked,
        items: model.items,
        markedLines: disputedChartLines(pseudo),
      });
    }
    return {
      bookId,
      inProgress: true,
      songs,
      deleted,
      incoming: session.incoming,
      savesHeld: [],
    };
  }

  async function surface(bookId) {
    const session = sessions.get(bookId);
    if (!session) {
      emit({ bookId, inProgress: false });
      return;
    }
    // Every file settled → commit the two-parent merge and push.
    const unsettled = [...session.files.values()].some((f) => !f.resolved);
    if (!unsettled) {
      await settle(bookId);
      return;
    }
    emit(buildPayload(bookId));
  }

  // Refuse the merge if any staged file still holds a marker line (§11.12.3):
  // the format's own writer is the single gate (Decision 3). Returns the first
  // refusal, or null when every file is canonical.
  async function firstMarkerRefusal(session) {
    for (const [path, f] of session.files) {
      if (!f.resolved || f.deletedOut) continue;
      let input;
      try {
        input = await fs.promises.readFile(`${session.dir}/${path}`);
      } catch {
        continue; // deleted — nothing to canonicalise
      }
      const res = canonicaliseFile(path, input);
      if (!res.ok && res.reason === 'marked') return { path, line: res.line };
    }
    return null;
  }

  async function settle(bookId) {
    const session = sessions.get(bookId);
    if (!session) return;
    const dir = session.dir;
    const refusal = await firstMarkerRefusal(session);
    if (refusal) {
      emitRefused({ bookId, path: refusal.path, line: refusal.line, reason: 'marked' });
      emit(buildPayload(bookId));
      return;
    }
    const who = await resolveAuthor();
    const identity = authorFrom(who, now());
    await gitCommit({
      fs,
      dir,
      message: 'Merge',
      author: identity,
      committer: identity,
      parent: [session.oursOid, session.theirsOid],
    });
    // A sync keeps `refs/remotes/origin/main` as its tracking ref; an upload's
    // `refs/upload/<id>` is a temporary ref whose job is done once the merge is
    // committed (sync.upload Decision 3), so drop it. The merge commit's second
    // parent already keeps its objects reachable.
    if (session.incomingRef && session.incomingRef !== THEIRS) {
      try {
        await deleteRef({ fs, dir, ref: session.incomingRef });
      } catch {
        // already gone
      }
    }
    await fs.flush?.();
    sessions.delete(bookId);
    emit({ bookId, inProgress: false });
    // Push is best-effort and offline-tolerant: let the engine push the local-
    // ahead merge commit and emit the fresh SYNC fact (in_step / saves_waiting).
    try {
      await git.push({ dir });
    } catch {
      // offline — the merge is committed locally and waits, like any save.
    }
    requestSync();
  }

  async function resolve({ bookId, path, choice, text, index = null }) {
    return locks.withLock(bookId, async () => {
      const session = sessions.get(bookId);
      if (!session) return;
      const f = session.files.get(path);
      if (!f) return;
      const dir = session.dir;

      if (f.kind === 'file') {
        // Deleted on one side, edited on the other (§11.12.4): keep the edited
        // song (keeping first, workflow 9 L62-64) or delete it. The edited side's
        // canonical text is the outcome's `kept`. A deleted-vs-edited file has no
        // second body to keep beside, so keep-both-song is not offered on it
        // (sync.keep_both Decision 3).
        if (choice === 'delete') {
          await removeWorking(dir, path);
          f.resolved = true;
          f.deletedOut = true;
        } else {
          await writeWorking(dir, path, f.kept);
          f.resolved = true;
        }
        await surface(bookId);
        return;
      }

      // Keep both, for a whole song (workflow 9 §Keep both, for a song;
      // sync.keep_both Decision 3): rather than settling conflict by conflict,
      // ours stays at its path (every remaining region resolved to ours) and
      // theirs's incoming version is written beside it as <name>-<author>.cifra.md.
      // Region conflicts only. Both canonical; both land in the one merge commit.
      if (choice === 'keep_both_song') {
        const oursRes = canonicaliseFile(path, resolveMarked(f.marked, 'ours'));
        if (!oursRes.ok) {
          emitRefused({ bookId, path, line: oursRes.line ?? null, reason: oursRes.reason });
          emit(buildPayload(bookId));
          return;
        }
        const theirsBlob = await blobAt(dir, session.theirsOid, path);
        const theirsRes = theirsBlob != null ? canonicaliseFile(path, theirsBlob) : null;
        const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
        const existing = await folderListing(dir, folder);
        const siblingPath = folder + siblingFilename(basename(path), f.author, existing);
        await writeWorking(dir, path, oursRes.text);
        if (theirsRes?.ok) await writeWorking(dir, siblingPath, theirsRes.text);
        f.items = [];
        f.resolved = true;
        await surface(bookId);
        return;
      }

      // A region conflict (§11.12.4). *edit* resolves the whole file from the
      // user's text; *keep mine* / *take theirs* resolve one region (the `index`
      // the stepper is on) or, with no index, every remaining region at once;
      // *keep both* (voicing only) keeps ours in its block and records theirs's
      // shape to land in a variation named for the author when the file settles.
      if (choice === 'edit') {
        const res = canonicaliseFile(path, text ?? '');
        if (!res.ok) {
          // A marker line still stands, or the text cannot be read: refuse, point
          // at it, leave the file unsettled (§11.12.3; workflow 9 L59).
          emitRefused({ bookId, path, line: res.line ?? null, reason: res.reason });
          emit(buildPayload(bookId));
          return;
        }
        f.items = [];
        if (!(await stageResolved(bookId, f, path, dir, res.text))) return;
        await surface(bookId);
        return;
      }

      if (choice === 'keep_both') {
        // Keep both shapes of a voicing conflict (workflow 9 §Settling one; §7.3):
        // ours's shape stays in its block (resolve this region to ours), and
        // theirs's shape is recorded to land in a variation named for the author.
        // The variation is written once the file's last region settles, so the
        // whole song is parsed and written canonical a single time.
        const op = voicingKeepBothOp(index === null ? null : f.items[index], f.author);
        f.marked = resolveRegionByOrdinal(f.marked, index, 'ours');
        f.items.splice(index, 1);
        if (op) (f.keepBoth ??= []).push(op);
        if (f.items.length === 0 && !(await stageFromMarked(bookId, f, path, dir))) return;
        await surface(bookId);
        return;
      }

      const side = choice === 'theirs' ? 'theirs' : 'ours';
      if (index === null) {
        // The whole-file quick path: resolve every region by one side.
        f.marked = resolveMarked(f.marked, side);
        f.items = [];
      } else {
        // One region: replace the `index`-th remaining region by that side's
        // lines, leaving the others marked (the stepper settles one at a time).
        f.marked = resolveRegionByOrdinal(f.marked, index, side);
        f.items.splice(index, 1);
      }
      if (f.items.length === 0 && !(await stageFromMarked(bookId, f, path, dir))) return;
      await surface(bookId);
    });
  }

  async function commitMerge({ bookId }) {
    return locks.withLock(bookId, async () => {
      const session = sessions.get(bookId);
      if (!session) return;
      const unsettled = [...session.files.values()].some((f) => !f.resolved);
      if (unsettled) {
        emit(buildPayload(bookId));
        return;
      }
      await settle(bookId);
    });
  }

  async function abandon(bookId) {
    return locks.withLock(bookId, async () => {
      const dir = dirOf(bookId);
      // Back to exactly before the sync/upload: working copy and index to *ours*,
      // the retained incoming ref dropped. For a sync that is origin/main, so the
      // next sync re-fetches and re-attempts (workflow 9 L77-78); for an upload it
      // is `refs/upload/<id>`, dropping the retained zip ref (sync.upload Decision
      // 3). A live session knows which; else re-resolve it from disk.
      const session = sessions.get(bookId);
      const incomingRef = session?.incomingRef ?? (await resolveIncomingRef(bookId, dir));
      try {
        await checkout({ fs, dir, ref: OURS, force: true });
      } catch {
        // nothing to restore
      }
      try {
        await deleteRef({ fs, dir, ref: incomingRef });
      } catch {
        // already gone
      }
      await fs.flush?.();
      sessions.delete(bookId);
      emit({ bookId, inProgress: false });
      requestSync();
    });
  }

  return { hasInProgressMerge, open, resolve, commitMerge, abandon };
}

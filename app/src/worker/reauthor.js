// reauthor.js — the saves not yet pushed, re-authored as the account
// (account.commit_author). DIRECTION §3.3: "before sign-in, a device's commits
// carry a local id in its place, which the account's address replaces in the
// saves not yet pushed when the user signs in."
//
// Two halves:
//
// - `planReauthor` is PURE: handed a book's unpushed commit records, it decides
//   which are rewritten and how (Constraint 4). A commit is rewritten when its
//   author or committer is one of this device's local addresses, or when one of
//   its parents was rewritten (it must be re-hashed). Only the local fields
//   change: a foreign author or committer, the tree, the message, the timestamps
//   and timezone, and the parent order are all kept.
// - `reauthorBook` walks one book's `main` down to `refs/remotes/origin/main`
//   (all of it when that ref is absent — the boundary `countCommitsAhead` uses),
//   writes the planned commits parent-first and moves `main` to the rewritten
//   head. Trees are identical, so the working copy and the index are untouched
//   (Constraint 5); only the ref moves. It runs under the book lock and the ref
//   move is a compare-and-swap: if `main` moved since the walk, the book is
//   walked again (Constraint 6).
//
// Run twice, it rewrites nothing the second time (Constraint 7). It logs nothing
// — no message, no content (standing rule). Plain ESM, Worker-only.

import { log as gitLog, readCommit, resolveRef, writeCommit, writeRef } from 'isomorphic-git';

/**
 * Plan the rewrite of a book's commits (account.commit_author Constraint 4).
 *
 * @param {{
 *   commits: { oid: string, parents: string[], author: object, committer: object,
 *     message: string, tree: string }[],
 *   pushed?: Iterable<string>,
 *   isLocal: (email: string) => boolean,
 *   to: string,
 * }} opts `commits` — the records (any order); `pushed` — the oids reachable from
 *   the origin, never rewritten; `isLocal` — whether an address is this device's
 *   local one; `to` — the account's address.
 * @returns {{ oid: string, parents: string[], author: object, committer: object,
 *   message: string, tree: string }[]} the rewrites, parent-first. `parents` are
 *   the ORIGINAL oids in their order; those that are themselves in the plan are
 *   the ones the writer remaps.
 */
export function planReauthor({ commits, pushed = [], isLocal, to }) {
  const pushedSet = new Set(pushed);
  const byOid = new Map();
  for (const c of commits) if (!pushedSet.has(c.oid)) byOid.set(c.oid, c);

  // Parent-first order over the unpushed set (iterative post-order DFS).
  const order = [];
  const done = new Set();
  for (const start of byOid.keys()) {
    if (done.has(start)) continue;
    const stack = [{ oid: start, next: 0 }];
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.next === 0 && done.has(top.oid)) {
        stack.pop();
        continue;
      }
      const parents = byOid.get(top.oid).parents;
      if (top.next < parents.length) {
        const p = parents[top.next++];
        if (byOid.has(p) && !done.has(p)) stack.push({ oid: p, next: 0 });
        continue;
      }
      stack.pop();
      if (!done.has(top.oid)) {
        done.add(top.oid);
        order.push(top.oid);
      }
    }
  }

  const rewritten = new Set();
  const plan = [];
  for (const oid of order) {
    const c = byOid.get(oid);
    const localAuthor = isLocal(c.author.email);
    const localCommitter = isLocal(c.committer.email);
    const parentMoved = c.parents.some((p) => rewritten.has(p));
    if (!localAuthor && !localCommitter && !parentMoved) continue;
    rewritten.add(oid);
    plan.push({
      oid,
      parents: [...c.parents],
      tree: c.tree,
      message: c.message,
      author: localAuthor ? { ...c.author, email: to } : { ...c.author },
      committer: localCommitter ? { ...c.committer, email: to } : { ...c.committer },
    });
  }
  return plan;
}

// The oids reachable from the origin-tracking ref — what is pushed — or an empty
// set for a book that never had a remote.
async function pushedOids({ fs, dir }) {
  let origin;
  try {
    origin = await resolveRef({ fs, dir, ref: 'refs/remotes/origin/main' });
  } catch {
    return new Set();
  }
  const entries = await gitLog({ fs, dir, ref: origin });
  return new Set(entries.map((e) => e.oid));
}

// The commit records on `main` not reachable from the origin, walked from
// `head` and stopping at every pushed commit.
async function unpushedCommits({ fs, dir, head, pushed }) {
  const out = [];
  const seen = new Set();
  const queue = [head];
  while (queue.length) {
    const oid = queue.pop();
    if (seen.has(oid) || pushed.has(oid)) continue;
    seen.add(oid);
    const { commit } = await readCommit({ fs, dir, oid });
    out.push({
      oid,
      parents: commit.parent ?? [],
      tree: commit.tree,
      message: commit.message,
      author: commit.author,
      committer: commit.committer,
    });
    queue.push(...(commit.parent ?? []));
  }
  return out;
}

/**
 * Re-author one book's saves not yet pushed (account.commit_author). Resolves
 * the number of commits rewritten; 0 for a book with no `main` or nothing local.
 *
 * @param {{ fs: object, dir: string, bookId: string, locks: object,
 *   isLocal: (email: string) => boolean, to: string }} opts
 * @returns {Promise<number>}
 */
export function reauthorBook({ fs, dir, bookId, locks, isLocal, to }) {
  return locks.withLock(bookId, async () => {
    for (;;) {
      let head;
      try {
        head = await resolveRef({ fs, dir, ref: 'refs/heads/main' });
      } catch {
        return 0;
      }
      const pushed = await pushedOids({ fs, dir });
      const commits = await unpushedCommits({ fs, dir, head, pushed });
      const plan = planReauthor({ commits, pushed, isLocal, to });
      if (!plan.length) return 0;
      const moved = new Map();
      for (const entry of plan) {
        const oid = await writeCommit({
          fs,
          dir,
          commit: {
            message: entry.message,
            tree: entry.tree,
            parent: entry.parents.map((p) => moved.get(p) ?? p),
            author: entry.author,
            committer: entry.committer,
          },
        });
        moved.set(entry.oid, oid);
      }
      // Compare-and-swap: a `main` that moved since the walk is walked again.
      const now = await resolveRef({ fs, dir, ref: 'refs/heads/main' });
      if (now !== head) continue;
      await writeRef({ fs, dir, ref: 'refs/heads/main', value: moved.get(head) ?? head, force: true });
      return plan.length;
    }
  });
}

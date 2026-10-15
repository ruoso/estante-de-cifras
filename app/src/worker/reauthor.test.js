import { describe, it, expect } from 'vitest';
import { planReauthor } from './reauthor.js';

// unit — the re-author planner (account.commit_author Constraint 4; DIRECTION
// §3.3: "the account's address replaces [the local id] in the saves not yet
// pushed"). Pure: commit records in, the rewrites out, parent-first.

const LOCAL = 'loc-7@users.estantedecifras.app';
const LEGACY = 'dev-3@users.estantedecifras.app';
const ANA = 'ana@users.estantedecifras.app';
const ACCOUNT = 'u_acc@users.estantedecifras.app';
const isLocal = (email) => email === LOCAL || email === LEGACY;

function who(email, name = 'Someone', timestamp = 1_700_000_000, timezoneOffset = -60) {
  return { name, email, timestamp, timezoneOffset };
}

function commit(oid, parents, author, committer = author) {
  return { oid, parents, author, committer, message: `msg ${oid}\n`, tree: `tree-${oid}` };
}

describe('planReauthor', () => {
  it('a mixed local and foreign chain: pushed kept, local re-authored, foreign re-hashed with its author', () => {
    // p1 <- p2 (pushed) <- f1 (Ana) <- l1 (local) <- f2 (Ana) <- l2 (local)
    const commits = [
      commit('l2', ['f2'], who(LOCAL, 'Me', 6, 0)),
      commit('f2', ['l1'], who(ANA, 'Ana', 5, 120)),
      commit('l1', ['f1'], who(LOCAL, 'Me', 4, -180)),
      commit('f1', ['p2'], who(ANA, 'Ana', 3)),
      commit('p2', ['p1'], who(LOCAL, 'Me', 2)),
      commit('p1', [], who(LOCAL, 'Me', 1)),
    ];
    const plan = planReauthor({ commits, pushed: ['p1', 'p2'], isLocal, to: ACCOUNT });

    // The pushed pair and the first unpushed foreign commit (nothing below it was
    // rewritten) are untouched.
    expect(plan.map((e) => e.oid)).toEqual(['l1', 'f2', 'l2']);

    const [l1, f2, l2] = plan;
    expect(l1.author).toEqual(who(ACCOUNT, 'Me', 4, -180));
    expect(l1.committer).toEqual(who(ACCOUNT, 'Me', 4, -180));
    expect(l1.parents).toEqual(['f1']); // f1 is not rewritten: its oid stands

    // The later foreign commit keeps Ana as author and committer; it is in the
    // plan only to be re-hashed onto the rewritten l1.
    expect(f2.author).toEqual(who(ANA, 'Ana', 5, 120));
    expect(f2.committer).toEqual(who(ANA, 'Ana', 5, 120));
    expect(f2.parents).toEqual(['l1']);

    expect(l2.author.email).toBe(ACCOUNT);
    expect(l2.committer.email).toBe(ACCOUNT);
    expect(l2.parents).toEqual(['f2']);

    // Trees, messages and timestamps are kept in every case.
    for (const entry of plan) {
      const original = commits.find((c) => c.oid === entry.oid);
      expect(entry.tree).toBe(original.tree);
      expect(entry.message).toBe(original.message);
      expect(entry.author.timestamp).toBe(original.author.timestamp);
      expect(entry.author.timezoneOffset).toBe(original.author.timezoneOffset);
      expect(entry.author.name).toBe(original.author.name);
    }
  });

  it('a merge with one pushed parent and one rewritten parent: only that parent remaps, order kept', () => {
    // base (pushed) <- o (pushed), base <- l (local); m = merge(o, l) by Ana.
    const commits = [
      commit('m', ['o', 'l'], who(ANA, 'Ana')),
      commit('l', ['base'], who(LOCAL, 'Me')),
      commit('o', ['base'], who(ANA, 'Ana')),
      commit('base', [], who(ANA, 'Ana')),
    ];
    const plan = planReauthor({ commits, pushed: ['base', 'o'], isLocal, to: ACCOUNT });
    expect(plan.map((e) => e.oid)).toEqual(['l', 'm']);
    const m = plan[1];
    // Parent order is kept; of the two, only `l` is in the plan (remapped by the
    // writer), `o` stays as it is.
    expect(m.parents).toEqual(['o', 'l']);
    const rewritten = new Set(plan.map((e) => e.oid));
    expect(m.parents.map((p) => rewritten.has(p))).toEqual([false, true]);
    expect(m.author.email).toBe(ANA);
  });

  it('a local author with a foreign committer, and the reverse: only the local field changes', () => {
    const commits = [
      commit('b', ['a'], who(ANA, 'Ana'), who(LEGACY, 'Me')),
      commit('a', [], who(LOCAL, 'Me'), who(ANA, 'Ana')),
    ];
    const [a, b] = planReauthor({ commits, isLocal, to: ACCOUNT });
    expect(a.oid).toBe('a');
    expect(a.author.email).toBe(ACCOUNT);
    expect(a.committer.email).toBe(ANA);
    expect(b.oid).toBe('b');
    expect(b.author.email).toBe(ANA);
    expect(b.committer.email).toBe(ACCOUNT);
  });

  it('nothing local: an empty plan (idempotence, Constraint 7)', () => {
    const commits = [
      commit('b', ['a'], who(ACCOUNT, 'Me')),
      commit('a', [], who(ANA, 'Ana')),
    ];
    expect(planReauthor({ commits, isLocal, to: ACCOUNT })).toEqual([]);
    // The legacy shared `local@` is someone's, not this device's (Decision 2).
    const shared = [commit('x', [], who('local@users.estantedecifras.app', 'Me'))];
    expect(planReauthor({ commits: shared, isLocal, to: ACCOUNT })).toEqual([]);
  });

  it('no pushed boundary (a never-pushed book): every commit is a candidate', () => {
    const commits = [
      commit('c', ['b'], who(LOCAL, 'Me')),
      commit('b', ['a'], who(ANA, 'Ana')),
      commit('a', [], who(LOCAL, 'Me')),
    ];
    const plan = planReauthor({ commits, isLocal, to: ACCOUNT });
    expect(plan.map((e) => e.oid)).toEqual(['a', 'b', 'c']);
    expect(plan[0].author.email).toBe(ACCOUNT);
    expect(plan[1].author.email).toBe(ANA);
    expect(plan[2].author.email).toBe(ACCOUNT);
  });
});

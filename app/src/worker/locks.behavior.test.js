import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { makeLockManager, installWebLocks } from '../test/web-locks.js';
import { createBookLocks } from './locks.js';

// behavior — storage.locks acceptance. The whole deliverable is the Web-Locks
// interaction, which is exactly the behavior level: createBookLocks driven
// against the test environment's lock seam (app/src/test/web-locks.js), and
// once against the real git layer. There is no pure unit separable from the
// lock manager worth isolating (refinement Decision 5), and no UI is rendered,
// so no axe check applies.
//
// All fixture text is written for this test — never anyone's words
// (no-song-text rule).

// Yield to the macrotask queue so every pending microtask in the shim has
// drained — the way we observe "the waiter has NOT entered yet" without a
// race, since the shim schedules grants on microtasks only.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// A test-controlled gate: a promise plus the function that resolves it, so a
// held lock stays held until the test decides to release it.
function gate() {
  let open;
  const promise = new Promise((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

describe('per-book locks (behavior)', () => {
  // serialised on one book — two withLock('book-a', …) started concurrently;
  // the second's fn body does not begin until the first's fn has resolved.
  // Pins DIRECTION §3 L118-119 ("one lock per book … two tabs must not
  // interleave them").
  it('serialises two operations on one book', async () => {
    const locks = createBookLocks({ navigator: { locks: makeLockManager() } });
    const order = [];
    const first = gate();

    const p1 = locks.withLock('book-a', async () => {
      order.push('first-enter');
      await first.promise; // hold the lock until the test releases it
      order.push('first-exit');
      return 1;
    });

    let secondEntered = false;
    const p2 = locks.withLock('book-a', async () => {
      secondEntered = true;
      order.push('second-enter');
      return 2;
    });

    // While the first holds the lock, the second's body must not have begun.
    await settle();
    expect(secondEntered).toBe(false);
    expect(order).toEqual(['first-enter']);

    first.open();
    expect(await p1).toBe(1);
    expect(await p2).toBe(2);
    // The second ran strictly after the first resolved.
    expect(order).toEqual(['first-enter', 'first-exit', 'second-enter']);
  });

  // concurrent on two books — withLock('book-a', …) and withLock('book-b', …)
  // started concurrently; both fn bodies enter before either resolves (overlap).
  // Pins "on two books not" (.tji note) and the per-book granularity of §3 L118.
  it('runs operations on different books concurrently', async () => {
    const locks = createBookLocks({ navigator: { locks: makeLockManager() } });
    const gateA = gate();
    const gateB = gate();
    let enterA;
    let enterB;
    const aEntered = new Promise((resolve) => {
      enterA = resolve;
    });
    const bEntered = new Promise((resolve) => {
      enterB = resolve;
    });

    const pa = locks.withLock('book-a', async () => {
      enterA();
      await gateA.promise; // still holding book-a's lock …
      return 'a';
    });
    const pb = locks.withLock('book-b', async () => {
      enterB();
      await gateB.promise; // … while book-b's lock is held too
      return 'b';
    });

    // Both bodies enter while both locks are still held — they overlap, which a
    // single shared lock would forbid.
    await Promise.all([aEntered, bEntered]);

    gateA.open();
    gateB.open();
    expect(await pa).toBe('a');
    expect(await pb).toBe('b');
  });

  // a second tab waits — two createBookLocks instances built over ONE shared
  // navigator.locks manager (two tabs' Workers against the origin's single
  // broker); tab B's withLock('book-a', …) body does not start until tab A
  // releases. Pins "a second tab's operation waits" (.tji note) and §3.7
  // L407-409 (one owner; cross-tab via origin-global Web Locks).
  it('makes a second tab wait on the same book', async () => {
    const broker = makeLockManager(); // the origin's single Web Locks broker
    const tabA = createBookLocks({ navigator: { locks: broker } });
    const tabB = createBookLocks({ navigator: { locks: broker } });
    const order = [];
    const held = gate();
    let aHolding;
    const aInside = new Promise((resolve) => {
      aHolding = resolve;
    });

    const pa = tabA.withLock('book-a', async () => {
      order.push('tabA-enter');
      aHolding();
      await held.promise;
      order.push('tabA-exit');
    });
    await aInside;

    let tabBEntered = false;
    const pb = tabB.withLock('book-a', async () => {
      tabBEntered = true;
      order.push('tabB-enter');
    });

    // Tab A still holds the book's lock: tab B must be waiting.
    await settle();
    expect(tabBEntered).toBe(false);

    held.open();
    await Promise.all([pa, pb]);
    expect(order).toEqual(['tabA-enter', 'tabA-exit', 'tabB-enter']);
  });

  // released on failure — a withLock('book-a', …) whose fn rejects propagates
  // the rejection and leaves the book unlocked; a following withLock('book-a',
  // …) proceeds. Pins the release-on-failure constraint.
  it('releases the lock when fn rejects, and propagates the rejection', async () => {
    const locks = createBookLocks({ navigator: { locks: makeLockManager() } });
    const boom = new Error('operation failed');

    await expect(
      locks.withLock('book-a', async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    // The failed operation left the book unlocked, so the next one proceeds.
    const result = await locks.withLock('book-a', async () => 'after failure');
    expect(result).toBe('after failure');
  });

  // composes with the real git layer — withLock('book-a', …) wrapping an actual
  // createGitLayer clone against startGitHttpRemote(), with fake-indexeddb
  // (per-file new IDBFactory()) and installWebLocks() active; a concurrent
  // same-book withLock waits until the clone completes. Pins "Web Locks around
  // every git operation" (.tji note) and the composition contract named in
  // git.md ("storage.locks serialises the git operations this layer exposes").
  describe('composed with the git layer', () => {
    let restoreLocks;
    beforeEach(() => {
      // lightning-fs and createBookLocks both read the global navigator.locks;
      // the shim installs one shared broker for this test (origin-global).
      restoreLocks = installWebLocks();
    });
    afterEach(() => {
      restoreLocks();
    });

    it('serialises a real clone against a concurrent same-book operation', async () => {
      const remote = await startGitHttpRemote();
      const idb = new IDBFactory();
      const fs = createFileSystem('locks-git-fs', { indexedDB: idb });
      const http = createGitHttpClient({ fetch: globalThis.fetch });
      const layer = createGitLayer({ fs, http });
      const locks = createBookLocks(); // reads the installed global broker

      try {
        const dir = layer.bookDir('book-a');

        let cloneDone = false;
        let waiterSawCloneDone = null;

        // The unit of work: a real clone held inside the book's lock.
        const pClone = locks.withLock('book-a', async () => {
          await layer.clone({ dir, url: remote.url });
          cloneDone = true;
        });
        // A concurrent same-book operation started while the clone runs. It can
        // only enter once the clone has released the lock, so it must observe
        // cloneDone === true.
        const pWaiter = locks.withLock('book-a', async () => {
          waiterSawCloneDone = cloneDone;
        });

        await Promise.all([pClone, pWaiter]);

        // The clone really happened (working tree populated) …
        expect(cloneDone).toBe(true);
        const readme = await fs.promises.readFile(`${dir}/README.txt`, 'utf8');
        expect(readme).toContain('fixture');
        // … and the concurrent operation waited for it to complete.
        expect(waiterSawCloneDone).toBe(true);
      } finally {
        await remote.stop();
      }
    });
  });
});

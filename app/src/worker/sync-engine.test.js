import { describe, it, expect, vi } from 'vitest';
import { createSyncEngine, SyncConflictError } from './sync-engine.js';
import { reapplyWorkingText } from './cifra-merge-driver.js';

// unit — the sync engine's retry policy and routing (sync.engine), with injected
// change-check/fetch/merge/push fakes (the .tji note's unit clause). A push
// rejected by a lost race drives fetch→merge→push again up to three times and
// then gives up, leaving the book `syncing`; a push that succeeds on the second
// try stops the loop (workflow 8 L59-62; DIRECTION §3.3:203). All ids are opaque
// strings written for this test; no git, no network, no fs.

// A git layer stub — only `bookDir` is reached when the per-book ops are faked.
const git = { bookDir: (id) => `/books/${id}` };

function pushRejected() {
  const err = new Error('Push rejected because it was not a simple fast-forward');
  err.code = 'PushRejectedError';
  return err;
}

// Build an engine whose per-book ops are all injected, so no real git/fs runs.
function makeEngine(overrides = {}) {
  const facts = [];
  const engine = createSyncEngine({
    git,
    locks: { withLock: (_id, fn) => fn() }, // run inline; the lock is tested elsewhere
    changeCheck: overrides.changeCheck ?? {
      check: vi.fn(async () => new Map([['book1', { bookId: 'book1', status: 'changed' }]])),
    },
    resolveAuthor: async () => ({ id: 'device', name: 'Device' }),
    emit: (payload) => facts.push(payload),
    listBooks:
      overrides.listBooks ??
      (async () => [{ bookId: 'book1', head: 'h', hosted: true, home: false }]),
    fetchBook: overrides.fetchBook ?? vi.fn(async () => {}),
    mergeBook: overrides.mergeBook ?? vi.fn(async () => ({ merged: true })),
    pushBook: overrides.pushBook,
    localAhead: overrides.localAhead ?? (async () => true),
    treeDirty: overrides.treeDirty ?? (async () => false),
    countAhead: overrides.countAhead ?? (async () => 1),
    syncHome: overrides.syncHome,
    surfaceHome: overrides.surfaceHome,
    now: overrides.now,
  });
  return { engine, facts };
}

const lastPhase = (facts, bookId = 'book1') =>
  [...facts].reverse().find((f) => f.bookId === bookId)?.phase;

describe('sync engine retry policy (unit)', () => {
  it('retries a lost race fetch→merge→push up to three times, then leaves the book syncing', async () => {
    const fetchBook = vi.fn(async () => {});
    const mergeBook = vi.fn(async () => ({ merged: true }));
    const pushBook = vi.fn(async () => {
      throw pushRejected(); // every push loses the race
    });
    const { engine, facts } = makeEngine({ fetchBook, mergeBook, pushBook });

    await engine.pass();

    // Initial push + three retries = four attempts (workflow 8 "up to three times").
    expect(pushBook).toHaveBeenCalledTimes(4);
    // The three retries each refetch and remerge before pushing again; the
    // initial fetch/merge happened in the pass before the first push.
    expect(fetchBook).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    expect(mergeBook).toHaveBeenCalledTimes(4);
    expect(lastPhase(facts)).toBe('syncing');
  });

  it('stops the loop as soon as a push succeeds (on the second try)', async () => {
    let attempt = 0;
    const fetchBook = vi.fn(async () => {});
    const mergeBook = vi.fn(async () => ({ merged: true }));
    const pushBook = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw pushRejected();
      // second attempt succeeds
    });
    const { engine, facts } = makeEngine({ fetchBook, mergeBook, pushBook });

    await engine.pass();

    expect(pushBook).toHaveBeenCalledTimes(2);
    expect(fetchBook).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    expect(lastPhase(facts)).toBe('in_step');
  });

  it('treats a non-race push failure (offline) as saves waiting, not a retry', async () => {
    const pushBook = vi.fn(async () => {
      throw new TypeError('Failed to fetch'); // a thrown fetch — offline, not a race
    });
    const { engine, facts } = makeEngine({ pushBook, countAhead: async () => 2 });

    await engine.pass();

    expect(pushBook).toHaveBeenCalledTimes(1); // no retry for a non-race failure
    const fact = [...facts].reverse().find((f) => f.bookId === 'book1');
    expect(fact.phase).toBe('saves_waiting');
    expect(fact.savesWaiting).toBe(2);
  });
});

describe('sync engine routing (unit)', () => {
  it('halts a book on a merge conflict and emits needs_you (no push)', async () => {
    const mergeBook = vi.fn(async () => {
      throw new SyncConflictError('book1');
    });
    const pushBook = vi.fn(async () => {});
    const { engine, facts } = makeEngine({ mergeBook, pushBook });

    await engine.pass();

    expect(pushBook).not.toHaveBeenCalled();
    expect(lastPhase(facts)).toBe('needs_you');
  });

  it('stops syncing a gone book and emits gone', async () => {
    const changeCheck = {
      check: async () => new Map([['book1', { bookId: 'book1', status: 'gone' }]]),
    };
    const fetchBook = vi.fn(async () => {});
    const pushBook = vi.fn(async () => {});
    const { engine, facts } = makeEngine({ changeCheck, fetchBook, pushBook });

    await engine.pass();

    expect(fetchBook).not.toHaveBeenCalled();
    expect(pushBook).not.toHaveBeenCalled();
    expect(lastPhase(facts)).toBe('gone');
  });

  it('marks a book gone on a 404 push refusal, keeps its commits, and stops — a 403 does not (sync.lost_access AC1; workflow 8 L66-69)', async () => {
    // An isomorphic-git HTTP error, the shape access-refused.js reads: the status
    // rides under `err.data.statusCode` (index.js HttpError).
    const httpError = (statusCode) => {
      const err = new Error(`HTTP Error: ${statusCode}`);
      err.code = err.name = 'HttpError';
      err.data = { statusCode, statusMessage: 'x' };
      return err;
    };

    // A book with unpushed commits and nothing incoming: the engine pushes, and
    // the service refuses 404 (no longer a member). The book goes `gone`; it is
    // not re-fetched, not re-merged, and the push is not retried (a 404 is not a
    // lost race), so the local commits stand.
    const quietCheck = { check: async () => new Map() }; // nothing moved
    const fetchBook = vi.fn(async () => {});
    const mergeBook = vi.fn(async () => ({ merged: false }));
    const push404 = vi.fn(async () => {
      throw httpError(404);
    });
    const gone = makeEngine({
      changeCheck: quietCheck,
      fetchBook,
      mergeBook,
      pushBook: push404,
      localAhead: async () => true,
    });

    await gone.engine.pass();

    expect(push404).toHaveBeenCalledTimes(1); // no retry for a 404
    expect(fetchBook).not.toHaveBeenCalled(); // nothing incoming, no re-fetch
    expect(mergeBook).not.toHaveBeenCalled();
    expect(lastPhase(gone.facts)).toBe('gone');

    // A 403 (an editor lowered to reader — still a member) is NOT lost access:
    // the book stays on `saves_waiting`, its push retried next pass.
    const push403 = vi.fn(async () => {
      throw httpError(403);
    });
    const reader = makeEngine({
      changeCheck: quietCheck,
      pushBook: push403,
      localAhead: async () => true,
      countAhead: async () => 1,
    });

    await reader.engine.pass();

    expect(push403).toHaveBeenCalledTimes(1);
    expect(lastPhase(reader.facts)).toBe('saves_waiting');
  });

  it('routes the home book to its own sync (never the cifra-aware merge) and re-surfaces', async () => {
    const syncHome = vi.fn(async () => ({ commit: 'm', pushed: true }));
    const surfaceHome = vi.fn(async () => {});
    const mergeBook = vi.fn(async () => ({ merged: true }));
    const changeCheck = {
      check: async () => new Map([['home', { bookId: 'home', status: 'changed' }]]),
    };
    const { engine, facts } = makeEngine({
      changeCheck,
      listBooks: async () => [{ bookId: 'home', head: 'h', hosted: true, home: true }],
      syncHome,
      surfaceHome,
      mergeBook,
    });

    await engine.pass();

    expect(syncHome).toHaveBeenCalledTimes(1);
    expect(surfaceHome).toHaveBeenCalledTimes(1);
    expect(mergeBook).not.toHaveBeenCalled(); // never the cifra-aware merge
    expect(lastPhase(facts, 'home')).toBe('in_step');
  });

  it('carries lastInStep on offline / saves_waiting facts; null until in step this session', async () => {
    // Pins engine.md L378-381 / workflow 8 L32: the Worker remembers when a book
    // was last in step (held in memory, no status table) and attaches it as
    // `lastInStep` so the shelf can say "offline since …" (sync.states fills the
    // fact the engine reserved). Before any in-step this session it is null.
    let nowMs = Date.parse('2026-10-07T09:40:00.000Z');
    const changeCheck = { check: vi.fn(async () => new Map()) }; // nothing moved
    let ahead = false; // no local-ahead work yet
    const pushBook = vi.fn(async () => {
      throw new TypeError('Failed to fetch'); // a thrown fetch — offline, not a race
    });
    const { engine, facts } = makeEngine({
      changeCheck,
      localAhead: async () => ahead,
      pushBook,
      countAhead: async () => 1,
      now: () => nowMs,
    });

    // Pass 1: reachable, nothing moved or waiting → in step at 09:40.
    await engine.pass();
    expect(lastPhase(facts)).toBe('in_step');

    // Pass 2: the change check cannot reach the service → offline at 10:15, and
    // the fact carries the 09:40 in-step instant.
    nowMs = Date.parse('2026-10-07T10:15:00.000Z');
    changeCheck.check.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch');
    });
    await engine.pass();
    const offline = [...facts].reverse().find((f) => f.bookId === 'book1');
    expect(offline.phase).toBe('offline');
    expect(offline.lastInStep).toBe('2026-10-07T09:40:00.000Z');

    // Pass 3: a local save is now waiting but the push can't reach the service →
    // saves_waiting, still carrying the last in-step instant.
    ahead = true;
    await engine.pass();
    const waiting = [...facts].reverse().find((f) => f.bookId === 'book1');
    expect(waiting.phase).toBe('saves_waiting');
    expect(waiting.lastInStep).toBe('2026-10-07T09:40:00.000Z');
  });

  it('a book never in step this session reports plain offline (lastInStep null)', async () => {
    const changeCheck = {
      check: vi.fn(async () => {
        throw new TypeError('Failed to fetch'); // offline from the first pass
      }),
    };
    const { engine, facts } = makeEngine({ changeCheck, localAhead: async () => false });

    await engine.pass();

    const offline = [...facts].reverse().find((f) => f.bookId === 'book1');
    expect(offline.phase).toBe('offline');
    expect(offline.lastInStep).toBeNull();
  });

  it('pushes a local-ahead book even when the change check reports it unchanged (offline-save retry)', async () => {
    const changeCheck = { check: async () => new Map() }; // nothing moved
    const fetchBook = vi.fn(async () => {});
    const pushBook = vi.fn(async () => {}); // fast-forward push succeeds
    const { engine, facts } = makeEngine({
      changeCheck,
      fetchBook,
      pushBook,
      localAhead: async () => true, // has local commits to send up
    });

    await engine.pass();

    expect(fetchBook).not.toHaveBeenCalled(); // unchanged → no fetch (Decision 4)
    expect(pushBook).toHaveBeenCalledTimes(1);
    expect(lastPhase(facts)).toBe('in_step');
  });
});

// unit — the re-apply helper that rebases an unsaved edit onto the merged
// committed content (sync.unsaved; the .tji's optional unit clause). Pure: real
// cifra.md `merge` over crafted strings, asserting the Outcome → { text,
// conflict, marked } mapping for the three kinds (result / conflicts / deleted).
// All songs are written for this test (no-song-text rule).
describe('reapplyWorkingText — Outcome mapping (unit)', () => {
  const BASE = `# Re-apply Test

## Verse
First verse line
Second verse line

## Chorus
First chorus line
Second chorus line
`;
  const OURS = BASE.replace('Second chorus line', 'Second chorus line, edited here');
  const THEIRS = BASE.replace('First verse line', 'First verse line, edited elsewhere');

  it('maps a clean merge (kind:result) to the canonical merged text, no conflict (AC 2)', () => {
    const { text, conflict, marked, deleted } = reapplyWorkingText({
      base: BASE,
      ours: OURS,
      theirs: THEIRS,
    });
    expect(conflict).toBe(false);
    expect(marked).toBe(false);
    expect(deleted).toBe(false);
    expect(text).toContain('Second chorus line, edited here');
    expect(text).toContain('First verse line, edited elsewhere');
  });

  it('maps an in-file conflict (kind:conflicts with marked) to the marked text, ours labelled ours (AC 4)', () => {
    const oursSameLine = BASE.replace('First verse line', 'First verse line mine');
    const theirsSameLine = BASE.replace('First verse line', 'First verse line theirs');
    const { text, conflict, marked, deleted } = reapplyWorkingText({
      base: BASE,
      ours: oursSameLine,
      theirs: theirsSameLine,
    });
    expect(conflict).toBe(true);
    expect(marked).toBe(true);
    expect(deleted).toBe(false);
    expect(text).toContain('<<<<<<< ours');
    expect(text).toContain('First verse line mine');
    expect(text).toContain('>>>>>>> theirs');
  });

  it('maps a file-level conflict with no marked text (theirs deleted, ours edited) to ours, flagged conflict', () => {
    const { text, conflict, marked, deleted } = reapplyWorkingText({
      base: BASE,
      ours: OURS,
      theirs: null,
    });
    expect(conflict).toBe(true);
    expect(marked).toBe(false);
    expect(deleted).toBe(false);
    expect(text).toBe(OURS); // the user's working text, kept verbatim
  });

  it('maps a deletion (kind:deleted) to a null text flagged deleted', () => {
    const { text, conflict, marked, deleted } = reapplyWorkingText({
      base: BASE,
      ours: null,
      theirs: null,
    });
    expect(deleted).toBe(true);
    expect(text).toBeNull();
    expect(conflict).toBe(false);
    expect(marked).toBe(false);
  });
});

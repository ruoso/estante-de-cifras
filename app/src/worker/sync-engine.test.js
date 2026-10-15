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
    onCannotSave: overrides.onCannotSave,
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
    // The engine now probes git once on the change-check `gone` branch to
    // disambiguate a take-down from plain lost access (books.notice_surface
    // Decision 1). Here the probe succeeds (no `403 taken_down`), so the book is
    // plain gone — the probe neither pushes nor changes the phase.
    const fetchBook = vi.fn(async () => {});
    const pushBook = vi.fn(async () => {});
    const { engine, facts } = makeEngine({ changeCheck, fetchBook, pushBook });

    await engine.pass();

    expect(fetchBook).toHaveBeenCalledTimes(1); // the take-down probe (Decision 1)
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

  // books.notice_surface — the service took a book down for a copyright notice.
  // The change-check answers `gone` with no reason (shelf.go:189-199), so on that
  // branch the engine does one git probe to disambiguate a `taken_down` 403
  // (carrying the reason) from plain lost access (a 404). At the three direct git
  // catch sites, a `taken_down` 403 mid-pass is classified before lost access.
  // The error shape is access-refused.js's: `err.data.statusCode` and the
  // stringified body under `err.data.response` (git.go:232; respond.go:12-30).
  const TAKEN_DOWN_REASON = 'This book has been taken down: Copyright notice filed by the rights holder.';
  const httpError = (statusCode, response) => {
    const err = new Error(`HTTP Error: ${statusCode}`);
    err.code = err.name = 'HttpError';
    err.data = { statusCode, statusMessage: 'x' };
    if (response !== undefined) err.data.response = response;
    return err;
  };
  const takenDown403 = () =>
    httpError(403, JSON.stringify({ code: 'taken_down', message: TAKEN_DOWN_REASON }));
  const lastFact = (facts, bookId = 'book1') =>
    [...facts].reverse().find((f) => f.bookId === bookId);

  describe('take-down (books.notice_surface; workflow 10 §A copyright notice)', () => {
    it('a gone change-check whose probe fetch throws taken_down is emitted taken_down with the reason, its work kept', async () => {
      const changeCheck = {
        check: async () => new Map([['book1', { bookId: 'book1', status: 'gone' }]]),
      };
      // The change-check short-circuits `gone`; the engine probes git once and the
      // probe is refused `403 taken_down` (shelf.go:189-199 answered gone with no
      // reason — the reason rides only on the git refusal, Decision 1).
      const fetchBook = vi.fn(async () => {
        throw takenDown403();
      });
      const pushBook = vi.fn(async () => {});
      const { engine, facts } = makeEngine({ changeCheck, fetchBook, pushBook });

      await engine.pass();

      expect(fetchBook).toHaveBeenCalledTimes(1); // one probe to recover the reason
      expect(pushBook).not.toHaveBeenCalled(); // no push against a taken-down book
      const fact = lastFact(facts);
      expect(fact.phase).toBe('taken_down');
      expect(fact.reason).toBe(TAKEN_DOWN_REASON);
    });

    it('a gone change-check whose probe fetch throws a 404 stays plain gone (lost access, no reason)', async () => {
      const changeCheck = {
        check: async () => new Map([['book1', { bookId: 'book1', status: 'gone' }]]),
      };
      const fetchBook = vi.fn(async () => {
        throw httpError(404);
      });
      const { engine, facts } = makeEngine({ changeCheck, fetchBook });

      await engine.pass();

      expect(fetchBook).toHaveBeenCalledTimes(1);
      const fact = lastFact(facts);
      expect(fact.phase).toBe('gone');
      expect(fact.reason ?? null).toBeNull();
    });

    it('a push refused taken_down mid-pass is emitted taken_down with the reason; a reader-push 403 still falls through to saves_waiting', async () => {
      const quietCheck = { check: async () => new Map() }; // nothing incoming
      const pushTakenDown = vi.fn(async () => {
        throw takenDown403();
      });
      const takenDown = makeEngine({
        changeCheck: quietCheck,
        pushBook: pushTakenDown,
        localAhead: async () => true,
      });

      await takenDown.engine.pass();

      expect(pushTakenDown).toHaveBeenCalledTimes(1); // not retried (not a lost race)
      const fact = lastFact(takenDown.facts);
      expect(fact.phase).toBe('taken_down');
      expect(fact.reason).toBe(TAKEN_DOWN_REASON);

      // A reader-push 403 carries no taken-down body: still a member, not taken
      // down — the book stays saves_waiting, retried next pass (the two do not
      // overlap).
      const pushReader = vi.fn(async () => {
        throw httpError(403);
      });
      const reader = makeEngine({
        changeCheck: quietCheck,
        pushBook: pushReader,
        localAhead: async () => true,
        countAhead: async () => 1,
      });

      await reader.engine.pass();

      expect(lastFact(reader.facts).phase).toBe('saves_waiting');
    });

    it('a fetch refused taken_down on an incoming-change pass is emitted taken_down with the reason', async () => {
      const changeCheck = {
        check: async () => new Map([['book1', { bookId: 'book1', status: 'changed' }]]),
      };
      const fetchTakenDown = vi.fn(async () => {
        throw takenDown403();
      });
      const pushBook = vi.fn(async () => {});
      const { engine, facts } = makeEngine({
        changeCheck,
        fetchBook: fetchTakenDown,
        pushBook,
      });

      await engine.pass();

      expect(pushBook).not.toHaveBeenCalled(); // halted before the best-effort push
      const fact = lastFact(facts);
      expect(fact.phase).toBe('taken_down');
      expect(fact.reason).toBe(TAKEN_DOWN_REASON);
    });
  });

  // books.fork Constraint 6 / Decision 1 — the lowered editor's permanent push
  // refusal (workflow 10 L83-85). The service refuses a reader's push `403
  // {code:'forbidden'}` (git.go:276): the book reads `cannot_save` carrying its
  // waiting saves, its commits are kept, the shelf's role hint is rewritten to
  // `reader`, and the push is not retried this session — while a `403
  // taken_down` stays `taken_down` and a `404` stays `gone`.
  describe('cannot save — a reader push refused 403 forbidden (books.fork Constraint 6; workflow 10 L83-85)', () => {
    const forbidden403 = () =>
      httpError(403, JSON.stringify({ code: 'forbidden', message: 'A reader cannot push to this book.' }));
    const quietCheck = { check: async () => new Map() }; // nothing incoming

    it('emits cannot_save {savesWaiting}, keeps the commits and writes role: reader', async () => {
      const pushBook = vi.fn(async () => {
        throw forbidden403();
      });
      const fetchBook = vi.fn(async () => {});
      const mergeBook = vi.fn(async () => ({ merged: false }));
      const onCannotSave = vi.fn(async () => {});
      const { engine, facts } = makeEngine({
        changeCheck: quietCheck,
        pushBook,
        fetchBook,
        mergeBook,
        onCannotSave,
        localAhead: async () => true,
        countAhead: async () => 2,
      });

      await engine.pass();

      expect(pushBook).toHaveBeenCalledTimes(1); // not a lost race: no retry
      const fact = lastFact(facts);
      expect(fact.phase).toBe('cannot_save');
      expect(fact.savesWaiting).toBe(2); // the commits are kept and counted
      expect(mergeBook).not.toHaveBeenCalled(); // nothing rolled back or merged away
      // The role hint follows what the service said (Decision 8).
      expect(onCannotSave).toHaveBeenCalledTimes(1);
      expect(onCannotSave).toHaveBeenCalledWith('book1');
    });

    it('the next pass does not push it again, while its fetches go on', async () => {
      let check = quietCheck;
      const pushBook = vi.fn(async () => {
        throw forbidden403();
      });
      const fetchBook = vi.fn(async () => {});
      const onCannotSave = vi.fn(async () => {});
      const { engine, facts } = makeEngine({
        changeCheck: { check: (...a) => check.check(...a) },
        pushBook,
        fetchBook,
        onCannotSave,
        localAhead: async () => true,
        countAhead: async () => 1,
      });

      await engine.pass();
      expect(pushBook).toHaveBeenCalledTimes(1);

      // A quiet second pass: no push, still cannot_save.
      await engine.pass();
      expect(pushBook).toHaveBeenCalledTimes(1);
      expect(lastFact(facts).phase).toBe('cannot_save');

      // The original moved: a reader can still read — the fetch runs, the push
      // does not.
      check = { check: async () => new Map([['book1', { bookId: 'book1', status: 'changed' }]]) };
      await engine.pass();
      expect(fetchBook).toHaveBeenCalledTimes(1);
      expect(pushBook).toHaveBeenCalledTimes(1);
      expect(lastFact(facts).phase).toBe('cannot_save');
      // The hint is written once, on the first classification.
      expect(onCannotSave).toHaveBeenCalledTimes(1);
    });

    it('a 403 taken_down is still taken_down and a 404 still gone — never cannot_save', async () => {
      const takenDown = makeEngine({
        changeCheck: quietCheck,
        pushBook: async () => {
          throw takenDown403();
        },
        localAhead: async () => true,
      });
      await takenDown.engine.pass();
      expect(lastFact(takenDown.facts).phase).toBe('taken_down');

      const onCannotSave = vi.fn(async () => {});
      const gone = makeEngine({
        changeCheck: quietCheck,
        pushBook: async () => {
          throw httpError(404, JSON.stringify({ code: 'not_found', message: 'No such book.' }));
        },
        onCannotSave,
        localAhead: async () => true,
      });
      await gone.engine.pass();
      expect(lastFact(gone.facts).phase).toBe('gone');
      expect(onCannotSave).not.toHaveBeenCalled();
    });
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

// unit — following an original (sync.fork_follow AC6, Constraint 2; workflow 11
// lines 42-46, 51-54). A pass emits ORIGINAL for each followed fork from the one
// change check: the count, 0 when absent, `gone` (with `goneAt` recorded) on
// `originalGone`; nothing for a fork already gone; nothing when the change check
// is unreachable; and the fork's own SYNC phase is never moved by any of it.
describe('sync engine following an original (unit)', () => {
  const ORIGINAL = {
    bookId: 'orig',
    title: 'Choros de Teste',
    link: 'https://estante.test/git/orig',
    followedAt: '2026-09-28T10:00:00.000Z',
  };

  function makeFollowEngine({ news, originals, unreachable = false }) {
    const facts = [];
    const followed = [];
    const recordOriginal = vi.fn(async () => {});
    const engine = createSyncEngine({
      git,
      locks: { withLock: (_id, fn) => fn() },
      changeCheck: {
        check: vi.fn(async () => {
          if (unreachable) throw new TypeError('Failed to fetch');
          return new Map(news);
        }),
      },
      resolveAuthor: async () => ({ id: 'device', name: 'Device' }),
      emit: (payload) => facts.push(payload),
      listBooks: async () => Object.keys(originals).map((bookId) => ({
        bookId,
        head: 'h',
        hosted: true,
        home: false,
      })),
      fetchBook: vi.fn(async () => {}),
      mergeBook: vi.fn(async () => ({ merged: false })),
      pushBook: vi.fn(async () => {}),
      localAhead: async () => false,
      treeDirty: async () => false,
      countAhead: async () => 0,
      readOriginals: async () => originals,
      recordOriginal,
      emitOriginal: (payload) => followed.push(payload),
      now: () => Date.parse('2026-10-15T12:00:00.000Z'),
    });
    return { engine, facts, followed, recordOriginal };
  }

  it('emits the count for a fork whose original advanced, and 0 for one the check did not name', async () => {
    const { engine, facts, followed } = makeFollowEngine({
      news: [['fork1', { bookId: 'fork1', status: 'unchanged', originalNewSaves: 3 }]],
      originals: { fork1: ORIGINAL, fork2: { ...ORIGINAL, bookId: 'orig2' } },
    });
    await engine.pass();
    expect(followed).toEqual([
      { bookId: 'fork1', newSaves: 3, gone: false },
      { bookId: 'fork2', newSaves: 0, gone: false },
    ]);
    // The fork itself is in step: `unchanged` because of its original is not a
    // reason to fetch it (Constraint 2).
    expect(lastPhase(facts, 'fork1')).toBe('in_step');
    expect(lastPhase(facts, 'fork2')).toBe('in_step');
  });

  it('on originalGone records goneAt and emits gone, leaving the fork in step', async () => {
    const { engine, facts, followed, recordOriginal } = makeFollowEngine({
      news: [['fork1', { bookId: 'fork1', status: 'unchanged', originalGone: true }]],
      originals: { fork1: ORIGINAL },
    });
    await engine.pass();
    expect(recordOriginal).toHaveBeenCalledWith({
      bookId: 'fork1',
      original: { ...ORIGINAL, goneAt: '2026-10-15T12:00:00.000Z' },
    });
    expect(followed).toEqual([{ bookId: 'fork1', newSaves: 0, gone: true }]);
    expect(lastPhase(facts, 'fork1')).toBe('in_step');
    expect(facts.some((f) => f.bookId === 'fork1' && f.phase === 'gone')).toBe(false);
  });

  it('emits nothing for a fork already gone, even if a count arrives', async () => {
    const { engine, followed, recordOriginal } = makeFollowEngine({
      news: [['fork1', { bookId: 'fork1', status: 'unchanged', originalNewSaves: 2 }]],
      originals: { fork1: { ...ORIGINAL, goneAt: '2026-10-01T00:00:00.000Z' } },
    });
    await engine.pass();
    expect(followed).toEqual([]);
    expect(recordOriginal).not.toHaveBeenCalled();
  });

  it('emits nothing when the change check is unreachable (the last facts stand)', async () => {
    const { engine, facts, followed, recordOriginal } = makeFollowEngine({
      news: [],
      originals: { fork1: ORIGINAL },
      unreachable: true,
    });
    await engine.pass();
    expect(followed).toEqual([]);
    expect(recordOriginal).not.toHaveBeenCalled();
    expect(lastPhase(facts, 'fork1')).toBe('offline');
  });

  it('a fork that moved itself still syncs as any book, with its original counted', async () => {
    const { engine, facts, followed } = makeFollowEngine({
      news: [['fork1', { bookId: 'fork1', status: 'changed', head: 'n', originalNewSaves: 1 }]],
      originals: { fork1: ORIGINAL },
    });
    await engine.pass();
    expect(followed).toEqual([{ bookId: 'fork1', newSaves: 1, gone: false }]);
    expect(lastPhase(facts, 'fork1')).toBe('in_step');
  });
});

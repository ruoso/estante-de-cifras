import { describe, it, expect } from 'vitest';
import {
  MIGRATIONS,
  META_STORE,
  latestVersion,
  runMigrations,
} from './migrations.js';

// unit — the migration framework's pure functions (storage.migrations
// acceptance: "unit (each migration step)", tasks/40-storage.tji:67). No
// IndexedDB is needed: `latestVersion` and `runMigrations` are pure, and step
// 1's upgrade only touches the two IDB-database methods a tiny fake supplies.

// A minimal stand-in for an IDB database's upgrade-time surface: just the two
// members a step's `upgrade(db, …)` touches to create a store. Records which
// stores were created so a test can assert the side effect.
function fakeDb(existingStores = []) {
  const stores = new Set(existingStores);
  return {
    created: [],
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore(name) {
      stores.add(name);
      this.created.push(name);
      return {};
    },
  };
}

// A synthetic step that records its version into `order` when it runs, so a
// test can assert exactly which steps ran and in what order.
function recordingStep(version, order) {
  return {
    version,
    label: `step ${version}`,
    upgrade() {
      order.push(version);
    },
  };
}

describe('latestVersion (unit)', () => {
  it('returns the highest step version', () => {
    const steps = [
      { version: 1, label: 'a', upgrade() {} },
      { version: 2, label: 'b', upgrade() {} },
      { version: 3, label: 'c', upgrade() {} },
    ];
    expect(latestVersion(steps)).toBe(3);
  });

  it('derives version 1 from the real single-step production list', () => {
    expect(latestVersion(MIGRATIONS)).toBe(1);
  });

  it('rejects a gap in the sequence (not contiguous from 1)', () => {
    const steps = [
      { version: 1, label: 'a', upgrade() {} },
      { version: 3, label: 'c', upgrade() {} }, // missing 2
    ];
    expect(() => latestVersion(steps)).toThrow(/contiguous/);
  });

  it('rejects a list that does not start at 1', () => {
    const steps = [{ version: 2, label: 'b', upgrade() {} }];
    expect(() => latestVersion(steps)).toThrow(/contiguous/);
  });

  it('rejects an empty list', () => {
    expect(() => latestVersion([])).toThrow(/non-empty/);
  });
});

describe('runMigrations (unit)', () => {
  it('runs exactly the steps in (oldVersion, newVersion], in ascending order, and no others', () => {
    const order = [];
    const steps = [
      recordingStep(1, order),
      recordingStep(2, order),
      recordingStep(3, order),
      recordingStep(4, order),
    ];
    // Stepping a database found at version 1 up to version 3 runs 2 and 3 only.
    runMigrations({}, {}, 1, 3, steps);
    expect(order).toEqual([2, 3]);
  });

  it('runs in ascending order even when the list is not pre-sorted', () => {
    const order = [];
    const steps = [
      recordingStep(3, order),
      recordingStep(1, order),
      recordingStep(2, order),
    ];
    runMigrations({}, {}, 0, 3, steps);
    expect(order).toEqual([1, 2, 3]);
  });

  it('runs every step from an empty (version 0) database', () => {
    const order = [];
    const steps = [recordingStep(1, order), recordingStep(2, order)];
    runMigrations({}, {}, 0, 2, steps);
    expect(order).toEqual([1, 2]);
  });

  it('runs no step when the database is already at the target version', () => {
    const order = [];
    const steps = [recordingStep(1, order), recordingStep(2, order)];
    runMigrations({}, {}, 2, 2, steps);
    expect(order).toEqual([]);
  });
});

describe('the real step 1 (unit)', () => {
  // Pins the inherited meta-store seam (previously logic.js:29-34): step 1
  // creates the `meta` object store and is idempotent when it already exists.
  const step1 = MIGRATIONS[0];

  it('is version 1', () => {
    expect(step1.version).toBe(1);
  });

  it('creates the meta object store on a fresh database', () => {
    const db = fakeDb();
    step1.upgrade(db, {}, 0);
    expect(db.created).toEqual([META_STORE]);
  });

  it('is idempotent when the meta store already exists', () => {
    const db = fakeDb([META_STORE]);
    step1.upgrade(db, {}, 1);
    expect(db.created).toEqual([]);
  });
});

describe('a throwing step (unit)', () => {
  // Pins the failed-migration constraint: a step that throws propagates out of
  // runMigrations so the caller (openDatabase) can abort the transaction. No
  // swallowing, no continuing past the failed step (Decision 3).
  it('propagates so the caller can abort the transaction', () => {
    const order = [];
    const steps = [
      recordingStep(1, order),
      {
        version: 2,
        label: 'boom',
        upgrade() {
          throw new Error('migration boom');
        },
      },
      recordingStep(3, order),
    ];
    expect(() => runMigrations({}, {}, 0, 3, steps)).toThrow('migration boom');
    // Step 1 ran; step 3 never ran because step 2 threw first.
    expect(order).toEqual([1]);
  });
});

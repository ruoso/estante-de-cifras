// storage-prune.js — when the clean-up runs: a minute after open, then every
// six hours; never two passes at once; a failing step neither stops the other
// nor the schedule.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createPruner, FIRST_PRUNE_DELAY_MS, PRUNE_INTERVAL_MS } from './storage-prune.js';

afterEach(() => {
  vi.useRealTimers();
});

function steps() {
  const calls = [];
  return {
    calls,
    compactFiles: vi.fn(async () => calls.push('compact')),
    pruneUploads: vi.fn(async () => calls.push('uploads')),
  };
}

describe('createPruner', () => {
  it('runs its first pass a minute after start, then every six hours', async () => {
    vi.useFakeTimers();
    const s = steps();
    const pruner = createPruner(s);
    pruner.start();
    await vi.advanceTimersByTimeAsync(FIRST_PRUNE_DELAY_MS - 1);
    expect(s.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(s.calls).toEqual(['compact', 'uploads']);
    await vi.advanceTimersByTimeAsync(PRUNE_INTERVAL_MS - FIRST_PRUNE_DELAY_MS);
    expect(s.calls).toEqual(['compact', 'uploads', 'compact', 'uploads']);
    pruner.stop();
  });

  it('never runs two passes at once', async () => {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const compactFiles = vi.fn(() => gate);
    const pruneUploads = vi.fn(async () => {});
    const pruner = createPruner({ compactFiles, pruneUploads });
    const a = pruner.pass();
    const b = pruner.pass();
    expect(b).toBe(a);
    release();
    await a;
    expect(compactFiles).toHaveBeenCalledTimes(1);
    expect(pruneUploads).toHaveBeenCalledTimes(1);
  });

  it('a failing step does not skip the other, and the next pass runs again', async () => {
    const compactFiles = vi.fn(async () => {
      throw new Error('quota');
    });
    const pruneUploads = vi.fn(async () => {});
    const pruner = createPruner({ compactFiles, pruneUploads });
    await expect(pruner.pass()).resolves.toBeUndefined();
    await pruner.pass();
    expect(compactFiles).toHaveBeenCalledTimes(2);
    expect(pruneUploads).toHaveBeenCalledTimes(2);
  });

  it('stops: no pass after stop, and start twice schedules once', async () => {
    vi.useFakeTimers();
    const s = steps();
    const pruner = createPruner(s);
    pruner.start();
    pruner.start();
    await vi.advanceTimersByTimeAsync(FIRST_PRUNE_DELAY_MS);
    expect(s.calls).toEqual(['compact', 'uploads']);
    pruner.stop();
    await vi.advanceTimersByTimeAsync(PRUNE_INTERVAL_MS * 2);
    expect(s.calls).toEqual(['compact', 'uploads']);
  });
});

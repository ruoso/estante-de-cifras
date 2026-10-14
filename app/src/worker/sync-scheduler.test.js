import { describe, it, expect, vi } from 'vitest';
import { createSyncScheduler } from './sync-scheduler.js';

// unit — the sync scheduler (sync.engine, workflow 8 §When it runs L13-19). With
// an injected clock and timer: a pass fires on each trigger (open, foreground,
// network-back, after-save all call `trigger()`) and every five minutes; and
// overlapping triggers coalesce with no pass starting while one is in flight
// (acceptance 1).

// Let the microtask/promise chain in the scheduler's drive() settle.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('sync scheduler (unit)', () => {
  it('fires a pass on each of the triggers while idle', async () => {
    const run = vi.fn(() => Promise.resolve());
    const scheduler = createSyncScheduler({
      run,
      setInterval: () => ({ unref() {} }),
      clearInterval: () => {},
    });

    // Open, foreground, network back and after-save are all one call: trigger().
    // The scheduler does not distinguish the reason — the action is identical.
    for (let i = 1; i <= 4; i += 1) {
      scheduler.trigger();
      await settle();
      expect(run).toHaveBeenCalledTimes(i);
    }
  });

  it('runs a pass every five minutes through the injected timer, and stop() clears it', async () => {
    let captured = null;
    let capturedMs = null;
    const run = vi.fn(() => Promise.resolve());
    const handle = { unref: vi.fn() };
    const setInterval = vi.fn((cb, ms) => {
      captured = cb;
      capturedMs = ms;
      return handle;
    });
    const clearInterval = vi.fn();
    const scheduler = createSyncScheduler({ run, setInterval, clearInterval });

    scheduler.start();
    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(capturedMs).toBe(5 * 60 * 1000); // five minutes
    expect(handle.unref).toHaveBeenCalled(); // does not keep a test process alive

    // start() is idempotent — a second open does not stack timers.
    scheduler.start();
    expect(setInterval).toHaveBeenCalledTimes(1);

    captured(); // the heartbeat fires
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    captured(); // the next heartbeat, a full interval later
    await settle();
    expect(run).toHaveBeenCalledTimes(2);

    scheduler.stop();
    expect(clearInterval).toHaveBeenCalledWith(handle);
  });

  it('coalesces overlapping triggers into one follow-up, never running two at once', async () => {
    const resolvers = [];
    let active = 0;
    let maxActive = 0;
    const run = vi.fn(() => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise((resolve) => {
        resolvers.push(() => {
          active -= 1;
          resolve();
        });
      });
    });
    const scheduler = createSyncScheduler({
      run,
      setInterval: () => ({ unref() {} }),
      clearInterval: () => {},
    });

    scheduler.trigger(); // starts pass #1
    await settle();
    expect(run).toHaveBeenCalledTimes(1);

    // Two triggers while pass #1 is still in flight: no new pass starts, and the
    // two collapse into a single pending follow-up.
    scheduler.trigger();
    scheduler.trigger();
    await settle();
    expect(run).toHaveBeenCalledTimes(1);

    resolvers.shift()(); // finish pass #1 → the coalesced follow-up starts
    await settle();
    expect(run).toHaveBeenCalledTimes(2);

    resolvers.shift()(); // finish pass #2 → nothing pending
    await settle();
    expect(run).toHaveBeenCalledTimes(2);

    expect(maxActive).toBe(1); // never two passes at once
  });

  it('survives a pass that rejects and keeps scheduling', async () => {
    let calls = 0;
    const run = vi.fn(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('boom')) : Promise.resolve();
    });
    const scheduler = createSyncScheduler({
      run,
      setInterval: () => ({ unref() {} }),
      clearInterval: () => {},
    });

    scheduler.trigger();
    await settle();
    expect(run).toHaveBeenCalledTimes(1);

    // A rejected pass did not wedge the scheduler — a later trigger still runs.
    scheduler.trigger();
    await settle();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('retries an unreachable pass with saves waiting on a capped backoff, and stops once a pass reaches the service', async () => {
    const outcomes = [{ retry: true }, { retry: true }, { retry: true }, { retry: true }, { retry: false }];
    const run = vi.fn(() => Promise.resolve(outcomes.shift()));
    const timeouts = [];
    const scheduler = createSyncScheduler({
      run,
      retryFirstMs: 5,
      retryMaxMs: 15,
      setInterval: () => ({ unref() {} }),
      clearInterval: () => {},
      setTimeout: (fn, ms) => timeouts.push({ fn, ms }),
      clearTimeout: () => {},
    });

    scheduler.trigger();
    await settle();
    for (let i = 0; i < 4; i += 1) {
      timeouts[i].fn();
      await settle();
    }
    expect(run).toHaveBeenCalledTimes(5);
    // 5 → 10 → 15 (capped) → 15; the reachable fifth pass arms nothing more.
    expect(timeouts.map((t) => t.ms)).toEqual([5, 10, 15, 15]);
  });
});

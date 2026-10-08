// sync-scheduler.js — the Worker's trigger coalescer and five-minute timer
// (sync.engine). Sync runs by itself and is mostly invisible (workflow 8
// §When it runs): on app open, on return to the foreground, when the network
// comes back, after every save, and every five minutes while the app is open.
// This module collapses those five triggers into non-overlapping passes — no
// pass starts while one is in flight, and a flood of triggers during a pass
// coalesces into at most one follow-up (acceptance 1).
//
// The scheduler lives in the Worker because the Worker owns the data (DIRECTION
// §3.7): the five-minute timer, the open trigger and the after-save trigger all
// fire inside it. The two DOM-only triggers (foreground, network back) arrive as
// SYNC commands from the thin main-thread adapter (sync-triggers.js), which the
// Worker turns into a `trigger()` the same as any other (Decision 1).
//
// It drives `run` (the engine's `pass`), which is offline-first and never
// throws; a pass that still rejects is swallowed here so a trigger is always
// fire-and-forget and the timer keeps ticking. The timer functions are
// injectable so a test drives them with a fake clock. Framework-free,
// Worker-only ESM, no React. Logs nothing.

// Every five minutes while the app is open (workflow 8 L19). Nothing runs while
// the app is closed — Safari has no background sync, and a songbook needs none
// (workflow 8 L22-24), so the timer is a plain interval, started on open and
// stopped on teardown.
const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Build the scheduler over `run` (an async pass). `intervalMs` is the heartbeat
 * (five minutes). `setInterval`/`clearInterval` are injectable (default the
 * globals, present in a real Worker) so a test drives the timer with a fake
 * clock.
 *
 * @param {{
 *   run: () => Promise<void>,
 *   intervalMs?: number,
 *   setInterval?: typeof globalThis.setInterval,
 *   clearInterval?: typeof globalThis.clearInterval,
 * }} deps
 * @returns {{ trigger: () => void, start: () => void, stop: () => void }}
 */
export function createSyncScheduler({
  run,
  intervalMs = FIVE_MINUTES_MS,
  setInterval = globalThis.setInterval,
  clearInterval = globalThis.clearInterval,
} = {}) {
  if (typeof run !== 'function') {
    throw new Error('createSyncScheduler requires a run function');
  }

  let running = false;
  let pending = false;
  let timer = null;

  // Run passes until none is pending. A trigger that arrives while a pass is in
  // flight sets `pending`, so exactly one follow-up pass runs after the current
  // one settles — many overlapping triggers collapse into that single follow-up
  // (acceptance 1). A pass never throws out of here (offline-first).
  async function drive() {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      do {
        pending = false;
        try {
          await run();
        } catch {
          // A pass is offline-first and should not throw; if it does, swallow it
          // so the scheduler stays alive and the timer keeps ticking.
        }
      } while (pending);
    } finally {
      running = false;
    }
  }

  // Ask for a pass. Fire-and-forget: a caller (a command handler, the timer)
  // never awaits sync, so nothing the user does waits on it (DIRECTION §1).
  function trigger() {
    void drive();
  }

  // Start the five-minute heartbeat (on app open). Idempotent — a second open
  // does not stack timers.
  function start() {
    if (timer == null) {
      timer = setInterval(() => trigger(), intervalMs);
      // In Node (a test's fake or real timers) `setInterval` returns a Timeout
      // whose `unref` lets the process exit while the heartbeat is pending, so a
      // test that forgets to `stop()` does not hang the runner. In a browser
      // Worker it returns a number with no `unref`; nothing to do there.
      if (timer && typeof timer.unref === 'function') timer.unref();
    }
  }

  // Stop the heartbeat (teardown). Idempotent.
  function stop() {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { trigger, start, stop };
}

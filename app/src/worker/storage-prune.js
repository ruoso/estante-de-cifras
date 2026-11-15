// storage-prune.js — the Worker's periodic clean-up of data nothing needs.
//
// A device's storage is the browser's, and the browser's quota is finite: when
// it is full, nothing can be saved — not a song, not an upload, not even the
// app's own update. Two kinds of data used to accumulate:
//
//   - file records holding more than their own bytes: before the filesystem
//     kept only a file's own bytes, a file written from a window onto a larger
//     buffer stored all of it (fs.js `ownBytes`), so an uploaded book carried a
//     copy of its zip per git object. `compactFiles` rewrites them.
//   - upload scratch repos nobody will come back to: a preview left open when
//     the app was closed, an import that failed. `pruneUploads` removes the
//     ones a day old that are not in use (upload.js `pruneStale`).
//
// A pass runs a minute after the app opens — after the start-up work, which it
// never delays — and every six hours while it stays open. Passes never overlap,
// and a failed step is swallowed: the next pass tries again, and nothing the
// person does waits on this. Timers are injectable so a test drives them.
// Framework-free, Worker-only ESM. Logs nothing.

export const FIRST_PRUNE_DELAY_MS = 60 * 1000;
export const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * @param {{
 *   compactFiles: () => Promise<unknown>,
 *   pruneUploads: () => Promise<unknown>,
 *   firstDelayMs?: number,
 *   intervalMs?: number,
 *   setTimeout?: typeof globalThis.setTimeout,
 *   clearTimeout?: typeof globalThis.clearTimeout,
 *   setInterval?: typeof globalThis.setInterval,
 *   clearInterval?: typeof globalThis.clearInterval,
 * }} deps
 * @returns {{ start: () => void, stop: () => void, pass: () => Promise<void> }}
 */
export function createPruner({
  compactFiles,
  pruneUploads,
  firstDelayMs = FIRST_PRUNE_DELAY_MS,
  intervalMs = PRUNE_INTERVAL_MS,
  setTimeout: setT = globalThis.setTimeout,
  clearTimeout: clearT = globalThis.clearTimeout,
  setInterval: setI = globalThis.setInterval,
  clearInterval: clearI = globalThis.clearInterval,
}) {
  let running = null;
  let first = null;
  let timer = null;

  // One pass: each step on its own, so a failure in one does not skip the other.
  function pass() {
    if (running) return running;
    running = (async () => {
      for (const step of [compactFiles, pruneUploads]) {
        try {
          await step();
        } catch {
          /* the next pass tries again */
        }
      }
    })().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    start() {
      if (first !== null || timer !== null) return;
      first = setT(() => {
        first = null;
        pass();
      }, firstDelayMs);
      timer = setI(() => pass(), intervalMs);
    },
    stop() {
      if (first !== null) clearT(first);
      if (timer !== null) clearI(timer);
      first = null;
      timer = null;
    },
    pass,
  };
}

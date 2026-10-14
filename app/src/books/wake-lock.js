// wake-lock.js — the non-component main-thread Wake Lock adapter (books.play,
// workflow 12 L70). It keeps the screen awake while a setlist is playing, and
// re-acquires the lock when the tab returns to the foreground (the browser
// drops a screen lock whenever the page is hidden). It is the precedent set by
// sync-triggers.js: a thin main-thread module that touches no IndexedDB, git
// or index, framework-free (no React — the view mounts it, it is not a
// component), with its platform globals injectable so a test can drive it.
//
// A browser without the Wake Lock API is a graceful no-op, never an error:
// `supported` is false and request/release do nothing, so the player still
// runs — the screen simply is not held, and the status word is not shown.

/**
 * A Wake Lock adapter over `navigator.wakeLock`. `request('screen')` acquires
 * the lock and starts re-acquiring it on `visibilitychange`; `release()` drops
 * the lock and stops re-acquiring. Both are no-ops when the API is absent.
 * @param {{ nav?: Navigator, doc?: Document }} [deps] injectable globals
 * @returns {{ supported: boolean, request: (type?: string) => Promise<void>, release: () => Promise<void> }}
 */
export function createWakeLock({ nav = globalThis.navigator, doc = globalThis.document } = {}) {
  const supported = !!(nav && nav.wakeLock && typeof nav.wakeLock.request === 'function');
  let sentinel = null;
  let type = null;

  async function acquire() {
    if (!supported || type == null) return;
    try {
      sentinel = await nav.wakeLock.request(type);
    } catch {
      // A rejected request (e.g. the document not visible) is not fatal — the
      // player keeps running; the next visibility change tries again.
      sentinel = null;
    }
  }

  const onVisibility = () => {
    if (!doc || doc.visibilityState === 'visible') acquire();
  };

  return {
    supported,
    async request(t = 'screen') {
      type = t;
      doc?.addEventListener?.('visibilitychange', onVisibility);
      await acquire();
    },
    async release() {
      type = null;
      doc?.removeEventListener?.('visibilitychange', onVisibility);
      try {
        await sentinel?.release?.();
      } catch {
        // Releasing an already-released lock is harmless.
      }
      sentinel = null;
    },
  };
}

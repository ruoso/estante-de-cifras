// The main-thread install store (shell.pwa). It holds whether to offer to
// install the app, and how: the browser's own install dialog where the browser
// hands us one (Chromium's `beforeinstallprompt`), or a hint to use Share → Add
// to Home Screen on iOS, where no browser offers an install prompt at all. Like
// the update store beside it, it touches neither IndexedDB nor the Worker — only
// the window's install events and media query, and localStorage for "don't ask
// again" (a per-device convenience: losing it only means asking once more).
//
// No offer ever shows when the app is already running installed (display-mode
// standalone, or iOS's navigator.standalone), nor once the person has dismissed
// it on this device.
//
// createInstallStore(env) is the testable factory; `installStore` is the
// singleton the entry starts and the notice reads.

export const DISMISSED_KEY = 'estante.install.dismissed';

// Offer kinds: 'prompt' — we hold the browser's deferred install event and our
// Install button fires it; 'ios' — a hint to install through the Share sheet.
export const OfferKind = Object.freeze({ PROMPT: 'prompt', IOS: 'ios' });

function isStandalone(win) {
  try {
    if (win.matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch {
    // An environment without matchMedia is not an installed app.
  }
  return win.navigator?.standalone === true;
}

// iPhone, iPod and iPad — including iPadOS, which reports itself as a Mac but
// has touch. Every iOS browser can Add to Home Screen from its Share sheet
// (Safari always; the others since iOS 16.4), and none fires an install prompt.
export function isIos(nav) {
  const ua = nav?.userAgent ?? '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1;
}

function readDismissed(storage) {
  try {
    return storage?.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(storage) {
  try {
    storage?.setItem(DISMISSED_KEY, '1');
  } catch {
    // Private mode or blocked storage: the offer stays hidden for this session.
  }
}

export function createInstallStore() {
  let snapshot = { offer: null };
  // The browser's deferred install event, held so Install can fire it. It can
  // be used only once, so it is cleared as soon as it is.
  let deferred = null;
  let storage = null;
  let started = false;
  const listeners = new Set();

  function set(offer) {
    if (snapshot.offer === offer) return;
    snapshot = { offer };
    for (const listener of listeners) listener();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return snapshot;
    },

    // Wire to the window once, at the entry. Decides the iOS hint up front, and
    // listens for the browser saying the app is installable (or installed).
    start(win = globalThis.window) {
      if (started || !win) return;
      started = true;
      try {
        storage = win.localStorage;
      } catch {
        storage = null;
      }
      if (isStandalone(win) || readDismissed(storage)) return;

      win.addEventListener('beforeinstallprompt', (event) => {
        // Hold the browser's own mini-infobar back: our notice offers the same
        // dialog, in the app's language, and remembers a dismissal.
        event.preventDefault();
        if (readDismissed(storage)) return;
        deferred = event;
        set(OfferKind.PROMPT);
      });
      win.addEventListener('appinstalled', () => {
        deferred = null;
        set(null);
      });

      if (isIos(win.navigator)) set(OfferKind.IOS);
    },

    // Open the browser's install dialog. Whatever the person answers, the event
    // is spent; a later visit gets a fresh one if they declined.
    async install() {
      const event = deferred;
      if (!event) return;
      deferred = null;
      set(null);
      try {
        await event.prompt();
        const choice = await event.userChoice;
        // Declining the browser's dialog is a "no" too: don't ask again.
        if (choice?.outcome === 'dismissed') writeDismissed(storage);
      } catch {
        // A prompt the browser refuses (already shown) leaves nothing to do.
      }
    },

    // Not now, and not again on this device. The browser's own menu still
    // offers Install (or Add to Home Screen) for anyone who changes their mind.
    dismiss() {
      deferred = null;
      writeDismissed(storage);
      set(null);
    },
  };
}

export const installStore = createInstallStore();

// unit — the main-thread install store (shell.pwa). Pins when the install offer
// shows and what it does: the browser's deferred install event becomes a
// 'prompt' offer (and its mini-infobar is held back); iOS gets the Share-sheet
// hint; an installed app (display-mode standalone, navigator.standalone) and a
// device that dismissed the offer get none; Install fires the browser's dialog
// exactly once; dismissing — ours or the browser's — sticks.

import { describe, it, expect, vi } from 'vitest';
import { createInstallStore, isIos, DISMISSED_KEY, OfferKind } from './install-state.js';

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data,
  };
}

// A window double: an event target with a navigator, a display-mode media query
// and localStorage.
function fakeWindow({ ua = ANDROID_UA, standalone = false, iosStandalone, touch = 5, storage } = {}) {
  const target = new EventTarget();
  return {
    addEventListener: target.addEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    navigator: { userAgent: ua, maxTouchPoints: touch, standalone: iosStandalone },
    matchMedia: (q) => ({ matches: standalone && q === '(display-mode: standalone)' }),
    localStorage: storage ?? memoryStorage(),
  };
}

function installEvent(outcome = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('isIos', () => {
  it('knows iPhone, and iPadOS posing as a Mac with touch', () => {
    expect(isIos({ userAgent: IPHONE_UA })).toBe(true);
    expect(isIos({ userAgent: MAC_UA, maxTouchPoints: 5 })).toBe(true);
  });

  it('is not fooled by a desktop Mac or Android', () => {
    expect(isIos({ userAgent: MAC_UA, maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: ANDROID_UA, maxTouchPoints: 5 })).toBe(false);
  });
});

describe('createInstallStore', () => {
  it('offers nothing until the browser says the app is installable', () => {
    const store = createInstallStore();
    store.start(fakeWindow());
    expect(store.getSnapshot().offer).toBeNull();
  });

  it('turns the browser install event into a prompt offer and holds its own banner back', () => {
    const store = createInstallStore();
    const win = fakeWindow();
    const listener = vi.fn();
    store.subscribe(listener);
    store.start(win);

    const event = installEvent();
    win.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(store.getSnapshot().offer).toBe(OfferKind.PROMPT);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('offers the Share-sheet hint on iOS', () => {
    const store = createInstallStore();
    store.start(fakeWindow({ ua: IPHONE_UA }));
    expect(store.getSnapshot().offer).toBe(OfferKind.IOS);
  });

  it('offers nothing when already running installed', () => {
    const android = createInstallStore();
    const win = fakeWindow({ standalone: true });
    android.start(win);
    win.dispatchEvent(installEvent());
    expect(android.getSnapshot().offer).toBeNull();

    const ios = createInstallStore();
    ios.start(fakeWindow({ ua: IPHONE_UA, iosStandalone: true }));
    expect(ios.getSnapshot().offer).toBeNull();
  });

  it('offers nothing on a device that dismissed it before', () => {
    const storage = memoryStorage({ [DISMISSED_KEY]: '1' });
    const store = createInstallStore();
    const win = fakeWindow({ storage });
    store.start(win);
    win.dispatchEvent(installEvent());
    expect(store.getSnapshot().offer).toBeNull();
  });

  it('install opens the browser dialog once and clears the offer', async () => {
    const store = createInstallStore();
    const win = fakeWindow();
    store.start(win);
    const event = installEvent('accepted');
    win.dispatchEvent(event);

    await store.install();
    await store.install();

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().offer).toBeNull();
    expect(win.localStorage.data[DISMISSED_KEY]).toBeUndefined();
  });

  it('declining the browser dialog counts as a dismissal', async () => {
    const store = createInstallStore();
    const win = fakeWindow();
    store.start(win);
    win.dispatchEvent(installEvent('dismissed'));

    await store.install();

    expect(win.localStorage.data[DISMISSED_KEY]).toBe('1');
  });

  it('dismiss hides the offer and remembers it on this device', () => {
    const store = createInstallStore();
    const win = fakeWindow({ ua: IPHONE_UA });
    store.start(win);

    store.dismiss();

    expect(store.getSnapshot().offer).toBeNull();
    expect(win.localStorage.data[DISMISSED_KEY]).toBe('1');
  });

  it('clears the offer once the app is installed', () => {
    const store = createInstallStore();
    const win = fakeWindow();
    store.start(win);
    win.dispatchEvent(installEvent());

    win.dispatchEvent(new Event('appinstalled'));

    expect(store.getSnapshot().offer).toBeNull();
  });

  it('survives storage that throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createInstallStore();
    store.start(fakeWindow({ ua: IPHONE_UA, storage }));
    expect(store.getSnapshot().offer).toBe(OfferKind.IOS);
    expect(() => store.dismiss()).not.toThrow();
    expect(store.getSnapshot().offer).toBeNull();
  });
});

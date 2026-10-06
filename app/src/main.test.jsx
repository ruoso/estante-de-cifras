import { describe, it, expect, vi, beforeEach } from 'vitest';

// Replace the VitePWA virtual module with a spy so the entry's registration
// side effect is observable without a real worker (the app's first vi.mock).
vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn() }));

// behavior — pins that registering the service worker is a side effect of app
// load. `app_tooling` set `injectRegister: null` (app/vite.config.js line 40),
// so the worker is built but never registered unless the entry calls
// `registerSW()`; without it `navigator.serviceWorker.ready` never resolves and
// the offline-first promise (DIRECTION §1 lines 29–31, §3.7 lines 405/424–426)
// is not kept. Pins the .tji note's "import `virtual:pwa-register` and call
// `registerSW()` … so the precached shell controls the page".
describe('main entry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('registers the service worker exactly once on load, with { immediate: true }', async () => {
    const { registerSW } = await import('virtual:pwa-register');

    await import('./main.jsx');

    expect(registerSW).toHaveBeenCalledTimes(1);
    const options = registerSW.mock.calls[0][0];
    expect(options.immediate).toBe(true);
    // shell.pwa wires onNeedRefresh so a waiting worker surfaces the update
    // affordance; `immediate` still holds (foundation.app_sw_register).
    expect(typeof options.onNeedRefresh).toBe('function');
  });

  // shell.pwa: the entry feeds the plugin's onNeedRefresh to the main-thread
  // update store, so a waiting worker flips the store that the shell's notice
  // reads (the user-visible "update on the next launch" affordance handed here
  // by app_sw_register.md).
  it('wires onNeedRefresh to the update store', async () => {
    const { registerSW } = await import('virtual:pwa-register');
    const { updateStore } = await import('./pwa/update-state.js');

    await import('./main.jsx');

    expect(updateStore.getSnapshot().updateReady).toBe(false);
    const { onNeedRefresh } = registerSW.mock.calls[0][0];
    onNeedRefresh();
    expect(updateStore.getSnapshot().updateReady).toBe(true);
  });
});

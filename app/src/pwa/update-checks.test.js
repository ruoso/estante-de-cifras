// shell.pwa — the app asks for a new version of itself when it comes back to the
// foreground, when the network comes back, and hourly; never while offline, and
// a failed check is swallowed (update-checks.js).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startUpdateChecks, HOUR_MS } from './update-checks.js';

function fakeRegistration({ fails = false } = {}) {
  const registration = {
    calls: 0,
    update: vi.fn(() => {
      registration.calls += 1;
      return fails ? Promise.reject(new Error('network')) : Promise.resolve();
    }),
  };
  return registration;
}

function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function setOnline(online) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('startUpdateChecks', () => {
  let stop;
  beforeEach(() => {
    setOnline(true);
    setVisibility('visible');
  });
  afterEach(() => {
    stop?.();
    stop = null;
    vi.useRealTimers();
  });

  it('asks when the app comes back to the foreground, not when it goes to the background', async () => {
    const registration = fakeRegistration();
    stop = startUpdateChecks({ registration, window, document });
    setVisibility('hidden');
    await settle();
    expect(registration.calls).toBe(0);
    setVisibility('visible');
    await settle();
    expect(registration.calls).toBe(1);
  });

  it('asks when the network comes back', async () => {
    const registration = fakeRegistration();
    stop = startUpdateChecks({ registration, window, document });
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(registration.calls).toBe(1);
  });

  it('asks every hour while open', async () => {
    vi.useFakeTimers();
    const registration = fakeRegistration();
    stop = startUpdateChecks({ registration, window, document });
    await vi.advanceTimersByTimeAsync(HOUR_MS - 1);
    expect(registration.calls).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(registration.calls).toBe(1);
    await vi.advanceTimersByTimeAsync(HOUR_MS);
    expect(registration.calls).toBe(2);
  });

  it('does not ask while offline', async () => {
    const registration = fakeRegistration();
    stop = startUpdateChecks({ registration, window, document });
    setOnline(false);
    setVisibility('visible');
    await settle();
    expect(registration.calls).toBe(0);
  });

  it('swallows a failed check, and asks again on the next trigger', async () => {
    const registration = fakeRegistration({ fails: true });
    stop = startUpdateChecks({ registration, window, document });
    setVisibility('visible');
    await settle();
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(registration.calls).toBe(2);
  });

  it('stops asking once stopped', async () => {
    const registration = fakeRegistration();
    stop = startUpdateChecks({ registration, window, document });
    stop();
    stop = null;
    setVisibility('visible');
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(registration.calls).toBe(0);
  });

  it('does nothing without a registration (no service worker)', () => {
    expect(() => startUpdateChecks({ registration: undefined, window, document })()).not.toThrow();
  });
});

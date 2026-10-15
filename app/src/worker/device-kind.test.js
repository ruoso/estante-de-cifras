import { describe, it, expect } from 'vitest';
import { deviceKindOf, deviceHintOf, knownKind, DEVICE_KINDS } from './device-kind.js';

// unit — the device kind a device writes down for itself when it signs in
// (account.new_device Decision 5; workflow 13 §Books that were only on the other
// device: *your iPhone*, *your iPad*, *your Android phone*, *your Mac*, *your
// Windows computer*, and *another device* when it cannot be told).

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  ipad:
    'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  // iPadOS 13+ Safari asks for the desktop site: a Mac's user agent.
  ipadDesktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  chromebook:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

// The user agents of the Playwright device descriptors the e2e projects run
// (e2e/web/playwright.config.js: Pixel 7, Galaxy Tab S4, Desktop Chrome).
const PLAYWRIGHT = {
  pixel7:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.31 Mobile Safari/537.36',
  galaxyTabS4:
    'Mozilla/5.0 (Linux; Android 8.1.0; SM-T837A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.31 Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.31 Safari/537.36',
};

describe('deviceKindOf from a user agent (unit)', () => {
  it.each([
    ['iphone', UA.iphone, 5],
    ['ipad', UA.ipad, 5],
    ['android-phone', UA.androidPhone, 5],
    ['android-tablet', UA.androidTablet, 5],
    ['mac', UA.mac, 0],
    ['windows', UA.windows, 0],
    ['linux', UA.linux, 0],
    ['chromebook', UA.chromebook, 0],
  ])('reads %s', (kind, userAgent, maxTouchPoints) => {
    expect(deviceKindOf({ userAgent, maxTouchPoints })).toBe(kind);
  });

  it('tells an iPad on its desktop user agent from a Mac by its touch points', () => {
    expect(deviceKindOf({ userAgent: UA.ipadDesktop, maxTouchPoints: 5 })).toBe('ipad');
    expect(deviceKindOf({ userAgent: UA.ipadDesktop, maxTouchPoints: 0 })).toBe('mac');
    expect(deviceKindOf({ userAgent: UA.ipadDesktop })).toBe('mac');
  });

  it('an Android without "Mobile" is a tablet', () => {
    expect(deviceKindOf({ userAgent: UA.androidTablet })).toBe('android-tablet');
  });

  it('anything else is other', () => {
    expect(deviceKindOf({ userAgent: 'curl/8.0' })).toBe('other');
    expect(deviceKindOf({ userAgent: '' })).toBe('other');
    expect(deviceKindOf({})).toBe('other');
    expect(deviceKindOf()).toBe('other');
  });

  it('maps the Playwright projects (Pixel 7, Galaxy Tab S4, Desktop Chrome) to android-phone, android-tablet, windows (workflow 13 delta)', () => {
    expect(deviceKindOf({ userAgent: PLAYWRIGHT.pixel7, maxTouchPoints: 5 })).toBe('android-phone');
    expect(deviceKindOf({ userAgent: PLAYWRIGHT.galaxyTabS4, maxTouchPoints: 5 })).toBe('android-tablet');
    expect(deviceKindOf({ userAgent: PLAYWRIGHT.desktopChrome, maxTouchPoints: 0 })).toBe('windows');
  });
});

describe('deviceKindOf from userAgentData (unit)', () => {
  it.each([
    ['android-phone', { platform: 'Android', mobile: true }],
    ['android-tablet', { platform: 'Android', mobile: false }],
    ['iphone', { platform: 'iOS', mobile: true }],
    ['ipad', { platform: 'iOS', mobile: false }],
    ['mac', { platform: 'macOS', mobile: false }],
    ['windows', { platform: 'Windows', mobile: false }],
    ['linux', { platform: 'Linux', mobile: false }],
    ['chromebook', { platform: 'Chrome OS', mobile: false }],
    ['chromebook', { platform: 'ChromeOS', mobile: false }],
  ])('reads %s', (kind, userAgentData) => {
    // The user agent says something else: the client hints win when present.
    expect(deviceKindOf({ userAgentData, userAgent: 'curl/8.0' })).toBe(kind);
  });

  it('an Android user agent decides phone or tablet over the hints’ mobile flag (an emulated tablet reports mobile)', () => {
    expect(
      deviceKindOf({ userAgentData: { platform: 'Android', mobile: true }, userAgent: PLAYWRIGHT.galaxyTabS4 }),
    ).toBe('android-tablet');
    expect(
      deviceKindOf({ userAgentData: { platform: 'Android', mobile: false }, userAgent: PLAYWRIGHT.pixel7 }),
    ).toBe('android-phone');
  });

  it('falls back to the user agent when the platform is empty or unknown', () => {
    expect(deviceKindOf({ userAgentData: { platform: '', mobile: false }, userAgent: UA.windows })).toBe('windows');
    expect(deviceKindOf({ userAgentData: { platform: 'Fuchsia' }, userAgent: UA.iphone })).toBe('iphone');
    expect(deviceKindOf({ userAgentData: { platform: 'Fuchsia' } })).toBe('other');
  });
});

describe('deviceHintOf and knownKind (unit)', () => {
  it('copies only the cloneable fields of a navigator', () => {
    const nav = {
      userAgent: UA.iphone,
      maxTouchPoints: 5,
      userAgentData: { platform: 'iOS', mobile: true, brands: [{ brand: 'x' }], getHighEntropyValues() {} },
      storage: {},
    };
    const hint = deviceHintOf(nav);
    expect(hint).toEqual({ userAgent: UA.iphone, maxTouchPoints: 5, userAgentData: { platform: 'iOS', mobile: true } });
    expect(structuredClone(hint)).toEqual(hint);
    expect(deviceHintOf(undefined)).toEqual({});
  });

  it('reads an unknown stored token as other', () => {
    for (const kind of DEVICE_KINDS) expect(knownKind(kind)).toBe(kind);
    expect(knownKind('toaster')).toBe('other');
    expect(knownKind(null)).toBe('other');
    expect(knownKind(7)).toBe('other');
  });
});

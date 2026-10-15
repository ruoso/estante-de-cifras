// device-kind.js — what kind of device this is, as a short token
// (account.new_device Decision 5). Workflow 13 §Books that were only on the
// other device names a device by its kind — *only on your iPhone*, *your iPad*,
// *your Android phone*, *your Mac*, *your Windows computer* — which each device
// writes down for itself in the home book when it signs in
// (`shelf.devices[<device-id>].kind`, home-book-format §4.2), worked out from
// the browser. A token, not text: every reader words it in its own language,
// and no user-agent string or name the user typed ever reaches a synced file.
//
// The browser's own answer comes first: `navigator.userAgentData` when it names
// a platform (Chromium), else the user-agent string, with `maxTouchPoints`
// telling an iPad (whose Safari presents a Mac's desktop user agent) from a
// Mac. Anything not recognised is `other` (*another device*).
//
// Pure: no I/O, no logging. Plain ESM, shared by the main thread (which reads
// its `navigator` into a hint, `deviceHintOf`) and the Worker (which turns the
// hint into the token). It ports nothing from the service's session labels —
// the app and the service share no code (DIRECTION §3.6).

// Every token a device may write (home-book-format §4.2). A reader meeting any
// other value reads it as `other`.
export const DEVICE_KINDS = Object.freeze([
  'iphone',
  'ipad',
  'android-phone',
  'android-tablet',
  'mac',
  'windows',
  'linux',
  'chromebook',
  'other',
]);

/**
 * The structured-cloneable part of a `navigator` the kind is worked out from —
 * what the main thread hands the Worker with OPEN (a WorkerNavigator has no
 * `maxTouchPoints`). Absent fields stay absent.
 *
 * @param {Navigator | undefined} nav
 * @returns {{ userAgent?: string, maxTouchPoints?: number,
 *   userAgentData?: { platform?: string, mobile?: boolean } }}
 */
export function deviceHintOf(nav) {
  if (!nav) return {};
  const hint = {};
  if (typeof nav.userAgent === 'string') hint.userAgent = nav.userAgent;
  if (typeof nav.maxTouchPoints === 'number') hint.maxTouchPoints = nav.maxTouchPoints;
  const data = nav.userAgentData;
  if (data && typeof data === 'object') {
    hint.userAgentData = {
      platform: typeof data.platform === 'string' ? data.platform : '',
      mobile: data.mobile === true,
    };
  }
  return hint;
}

// The kind from a User-Agent Client Hints platform, or null when the platform
// is empty or not one this list names (the user agent decides then).
function kindOfPlatform(platform, mobile) {
  switch (platform.trim().toLowerCase()) {
    case 'android':
      return mobile ? 'android-phone' : 'android-tablet';
    case 'ios':
      return mobile ? 'iphone' : 'ipad';
    case 'macos':
      return 'mac';
    case 'windows':
      return 'windows';
    case 'chrome os':
    case 'chromeos':
    case 'chromium os':
      return 'chromebook';
    case 'linux':
      return 'linux';
    default:
      return null;
  }
}

// The kind from a user-agent string. Order matters: an Android user agent says
// "Linux", an iPhone's says "like Mac OS X", a Chromebook's says "X11".
function kindOfUserAgent(ua, maxTouchPoints) {
  if (/iPhone|iPod/.test(ua)) return 'iphone';
  if (/iPad/.test(ua)) return 'ipad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'android-phone' : 'android-tablet';
  if (/CrOS/.test(ua)) return 'chromebook';
  // iPadOS Safari presents a Mac's desktop user agent; only the touch screen
  // tells them apart (a Mac reports 0 touch points, an iPad 5).
  if (/Macintosh|Mac OS X/.test(ua)) return maxTouchPoints > 1 ? 'ipad' : 'mac';
  if (/Windows/.test(ua)) return 'windows';
  if (/Linux|X11/.test(ua)) return 'linux';
  return null;
}

/**
 * This device's kind token (Decision 5), from a hint `deviceHintOf` made.
 *
 * @param {{ userAgent?: string, maxTouchPoints?: number,
 *   userAgentData?: { platform?: string, mobile?: boolean } }} [hint]
 * @returns {string} one of DEVICE_KINDS
 */
export function deviceKindOf(hint = {}) {
  const ua = typeof hint?.userAgent === 'string' ? hint.userAgent : '';
  const data = hint?.userAgentData;
  if (data && typeof data.platform === 'string' && data.platform) {
    // Phone or tablet: Chrome on an Android tablet drops "Mobile" from its user
    // agent, and the client hints' `mobile` says the same — except where an
    // emulator sets `mobile` from touch alone; the user agent's own word wins
    // when it names Android.
    const mobile = /Android/.test(ua) ? /Mobile/.test(ua) : data.mobile === true;
    const kind = kindOfPlatform(data.platform, mobile);
    if (kind) return kind;
  }
  const touch = typeof hint?.maxTouchPoints === 'number' ? hint.maxTouchPoints : 0;
  return kindOfUserAgent(ua, touch) ?? 'other';
}

/**
 * A stored kind as a reader takes it: a token this list knows, else `other`
 * (an older app meeting a newer token, or a malformed value).
 *
 * @param {*} value
 * @returns {string}
 */
export function knownKind(value) {
  return typeof value === 'string' && DEVICE_KINDS.includes(value) ? value : 'other';
}

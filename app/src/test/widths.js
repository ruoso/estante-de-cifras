// A matchMedia stub for the three device widths the boards draw (jsdom has no
// matchMedia): the phone matches none of the width lines, the tablet the shell's
// WIDE_QUERY (600px) only, the computer every `min-width` line (the 1080px
// per-screen ones included). Colour-scheme queries never match. Shared by the
// editor hosts' behavior tests (songs.editor_chrome), lifted from the reading
// view's `installWidths` (SongReading.behavior.test.jsx).

import { WIDE_QUERY } from '../shell/layout-mode.js';

export const DEVICES = Object.freeze(['phone', 'tablet', 'computer']);

// The shell's layout mode for a device, as AppShell hands it to a host.
export const modeFor = (device) => (device === 'phone' ? 'narrow' : 'wide');

export function installWidths(device) {
  globalThis.matchMedia = (media) => ({
    media,
    matches:
      device === 'computer'
        ? media.includes('min-width')
        : device === 'tablet'
          ? media === WIDE_QUERY
          : false,
    addEventListener() {},
    removeEventListener() {},
  });
}

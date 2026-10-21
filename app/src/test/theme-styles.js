// The app's real stylesheets, injected into a jsdom document as <style>
// elements (shell.palco_contrast). A behavior test that asserts on
// getComputedStyle needs the cascade the browser applies; Vitest hands a `.css`
// import back as an empty string (`?raw` included), so the sheets are read from
// disk, as theme/fonts.behavior.test.js reads theme.css. The theme layers come
// first, in App.jsx's import order (theme.css, then controls.css), then any
// screen sheets the test names, relative to src/.
//
// jsdom has no user-agent chrome for a <button>, so the browser's (Chromium's
// html.css: the ButtonFace fill, the 2px outset border, the 13.333px system
// font, centred text) goes first as a `button` rule. A row the app does not
// reset then reads as the UA draws it, which is what the reset is tested
// against.
const UA_BUTTON = `button {
  background-color: buttonface;
  border: 2px outset buttonborder;
  font: 400 13.333px Arial;
  text-align: center;
  color: buttontext;
}`;

import { readFileSync } from 'node:fs';
import { expect } from 'vitest';
import path from 'node:path';

const srcDir = path.join(process.cwd(), 'src');

export function injectStyles(...sheets) {
  const elements = ['theme/theme.css', 'theme/controls.css', ...sheets].map((rel) => {
    const style = document.createElement('style');
    style.dataset.sheet = rel;
    style.textContent = readFileSync(path.join(srcDir, rel), 'utf-8');
    document.head.append(style);
    return style;
  });
  const ua = document.createElement('style');
  ua.dataset.sheet = 'user-agent button';
  ua.textContent = UA_BUTTON;
  document.head.prepend(ua);
  return () => [ua, ...elements].forEach((el) => el.remove());
}

// The RAC Popover holding an open menu, list box or dialog (shell.popover_surface):
// its element carries `data-trigger` (MenuTrigger, Select, DialogTrigger). A
// behavior test asserts on it with expectPopoverSurface after injectStyles.
export function popoverOf(el) {
  return el.closest('[data-trigger]');
}

// The popover around `el` is drawn on the shared surface: it portals inside the
// `.est` theme root (ThemeRoot's provider), carries `popover`, and its computed
// background is the theme's --surface (jsdom keeps the var() text).
export function expectPopoverSurface(el) {
  const popover = popoverOf(el);
  expect(popover).not.toBeNull();
  expect(popover.closest('.est')).not.toBeNull();
  expect(popover).toHaveClass('popover');
  expect(getComputedStyle(popover).background).toContain('var(--surface)');
  expect(getComputedStyle(popover).background).not.toContain('var(--surface-2)');
  return popover;
}

// A sheet's header is the shared `.sheet-head` (shell.sheet_close_placement;
// W07 #2 L72-77, W10 #1 L45-49): the heading sits in it inside the `.est` theme
// root and takes the row's free width (computed flex-grow 1, after
// injectStyles), and the header's last element is the close, named Close.
export function expectSheetHead(heading) {
  const head = heading.parentElement;
  expect(head).toHaveClass('sheet-head');
  expect(head.closest('.est')).not.toBeNull();
  expect(getComputedStyle(heading).flexGrow).toBe('1');
  const close = head.lastElementChild;
  expect(close.tagName).toBe('BUTTON');
  expect(close).toHaveAccessibleName('Close');
  return head;
}

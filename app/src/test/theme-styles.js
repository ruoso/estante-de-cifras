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

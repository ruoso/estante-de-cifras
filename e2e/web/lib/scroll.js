// The frame's geometry (shell.full_height): the app occupies exactly the window,
// so a long surface scrolls inside its own container and the document itself
// never scrolls. Layout is computed, so this is checked in a real browser only.

import { expect } from '@playwright/test';

// The short height a visit shrinks the viewport to (the project's width is kept,
// so the narrow/wide layout is unchanged): ordinary content is then "long".
export const SHORT_HEIGHT = 420;

export async function shortenViewport(page, height = SHORT_HEIGHT) {
  const { width } = page.viewportSize();
  await page.setViewportSize({ width, height });
}

// Assert the frame holds on the current surface:
// - the document does not overflow (the page has nothing to scroll);
// - some visible element with overflow-y auto/scroll overflows, and scrolling
//   it to its end moves it and brings its last child into the viewport (the
//   end of the content is reachable inside the surface);
// - every locator in `stayInView` is still in the viewport after that scroll
//   (the surface's chrome stays put).
// The scroller is found generically — the one that overflows the most — so
// this pins the behavior, not which class carries it.
export async function expectScrollsInside(page, { stayInView = [] } = {}) {
  const docOverflow = await page.evaluate(() => {
    const doc = document.scrollingElement;
    return doc.scrollHeight - doc.clientHeight;
  });
  expect(docOverflow, 'the document overflows the window (the page scrolls)').toBeLessThanOrEqual(1);

  const result = await page.evaluate(async () => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    };
    let best = null;
    for (const el of document.querySelectorAll('body *')) {
      const oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      const extra = el.scrollHeight - el.clientHeight;
      if (extra <= 1 || !visible(el)) continue;
      if (!best || extra > best.extra) best = { el, extra };
    }
    if (!best) {
      // Name what could scroll, for the failure message.
      const candidates = [...document.querySelectorAll('body *')]
        .filter((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) && visible(el))
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollHeight}/${el.clientHeight}`);
      return { found: false, candidates };
    }
    const { el } = best;
    // The last in-flow child with a box (CodeMirror's absolute layers are not
    // content).
    const children = [...el.children].filter((c) => {
      const s = getComputedStyle(c);
      const r = c.getBoundingClientRect();
      return s.position !== 'absolute' && s.position !== 'fixed' && r.height > 0;
    });
    const last = children[children.length - 1];
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // From the top (an earlier visit may have left it scrolled), to the end.
    el.scrollTop = 0;
    await frame();
    const before = el.scrollTop;
    el.scrollTop = el.scrollHeight;
    await frame();
    const box = el.getBoundingClientRect();
    const lastBox = last ? last.getBoundingClientRect() : null;
    return {
      found: true,
      scroller: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`,
      before,
      after: el.scrollTop,
      lastInView: lastBox
        ? lastBox.bottom <= Math.min(vh, box.bottom) + 1 && lastBox.bottom > Math.max(0, box.top)
        : false,
    };
  });
  expect(
    result.found,
    `no visible element scrolls its overflowing content (scrollers, scrollHeight/clientHeight: ${result.candidates?.join(', ') || 'none'})`,
  ).toBe(true);
  expect(result.after, `the scroller ${result.scroller} did not scroll`).toBeGreaterThan(result.before);
  expect(result.lastInView, `the end of ${result.scroller} is not reachable in the viewport`).toBe(true);

  const docAfter = await page.evaluate(() => document.scrollingElement.scrollTop);
  expect(docAfter, 'the document scrolled').toBe(0);
  for (const locator of stayInView) {
    await expect(locator).toBeInViewport({ ratio: 0.95 });
  }
}

// The frame's horizontal fit (shell.narrow_fit): the horizontal twin of
// lib/scroll.js. On the current surface nothing runs past the viewport's sides,
// every control is fully visible, the named fixed labels render whole (never
// ellipsized) and the named sentences are never squeezed to one word per line.
// Layout is computed, so this is checked in a real browser only. Pins
// DIRECTION §4 (one app on phone, tablet and computer) and the note's "no
// element wider than the viewport, controls fully visible".

import { expect } from '@playwright/test';

// What counts as a control: what a person can press, type into or choose.
export const CONTROLS = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'textarea',
  'select',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="switch"]',
].join(', ');

// Assert the current surface fits the viewport:
// - the document has no horizontal overflow (the page never scrolls sideways);
// - every visible element — a non-empty box, not `visibility: hidden`, not
//   visually hidden — lies within [0, innerWidth], unless it sits inside an
//   ancestor that scrolls horizontally (a raw pane, a scrollable shape row);
// - every visible control lies within the viewport and within every clipping
//   ancestor (overflow ≠ visible) that does not itself scroll in that axis;
// - each `whole` locator renders whole: neither it nor a clipping box inside it
//   is ellipsized (scrollWidth ≤ clientWidth);
// - each `sentences` locator is at least 60% of its parent's content width, so
//   a sentence never collapses to one word per line.
// Found generically, so this pins the behavior, not which class carries it.
export async function expectFits(page, { whole = [], sentences = [] } = {}) {
  const docOverflow = await page.evaluate(() => {
    const doc = document.scrollingElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(docOverflow, 'the document overflows the window sideways (the page scrolls horizontally)').toBeLessThanOrEqual(1);

  const problems = await page.evaluate((controlSelector) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const TOL = 1;

    // Visually hidden on purpose: `visibility: hidden`, the app's
    // `.visually-hidden`, or React Aria's clip-based VisuallyHidden — on the
    // element or any ancestor.
    const hiddenCache = new Map();
    const isHidden = (el) => {
      if (!el || el === document.body) return false;
      if (hiddenCache.has(el)) return hiddenCache.get(el);
      const s = getComputedStyle(el);
      const clipped =
        s.clip === 'rect(0px, 0px, 0px, 0px)' ||
        s.clipPath === 'inset(50%)' ||
        el.classList.contains('visually-hidden');
      const hidden = s.visibility === 'hidden' || clipped || isHidden(el.parentElement);
      hiddenCache.set(el, hidden);
      return hidden;
    };
    const scrollsIn = (s, axis) => {
      const o = axis === 'x' ? s.overflowX : s.overflowY;
      return o === 'auto' || o === 'scroll';
    };
    const ancestors = (el) => {
      const out = [];
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) out.push(a);
      return out;
    };
    const describe = (el) => {
      const r = el.getBoundingClientRect();
      const name = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      const cls = [...el.classList].join('.');
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} "${name}" [x ${Math.round(r.left)}–${Math.round(r.right)}, y ${Math.round(r.top)}–${Math.round(r.bottom)}; viewport ${vw}×${vh}]`;
    };
    const boxed = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    const wide = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!boxed(el) || isHidden(el)) continue;
      if (ancestors(el).some((a) => scrollsIn(getComputedStyle(a), 'x'))) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -TOL || r.right > vw + TOL) wide.push(`past the viewport's side: ${describe(el)}`);
    }

    const cut = [];
    for (const el of document.querySelectorAll(controlSelector)) {
      if (!boxed(el) || isHidden(el)) continue;
      const r = el.getBoundingClientRect();
      const chain = ancestors(el).map((a) => ({ a, s: getComputedStyle(a) }));
      const inScroller = { x: chain.some(({ s }) => scrollsIn(s, 'x')), y: chain.some(({ s }) => scrollsIn(s, 'y')) };
      // A control scrolled out of its own scroller is reachable by scrolling;
      // anything else must be on screen.
      if (!inScroller.x && (r.left < -TOL || r.right > vw + TOL)) {
        cut.push(`a control past the viewport's side: ${describe(el)}`);
        continue;
      }
      if (!inScroller.y && (r.top < -TOL || r.bottom > vh + TOL)) {
        cut.push(`a control past the viewport's top or bottom: ${describe(el)}`);
        continue;
      }
      // Each clipping box between the control and its nearest scroller in that
      // axis must hold it whole (past the scroller, scrolling reaches it).
      let open = { x: true, y: true };
      for (const { a, s } of chain) {
        const box = a.getBoundingClientRect();
        if (open.x && scrollsIn(s, 'x')) open = { ...open, x: false };
        if (open.y && scrollsIn(s, 'y')) open = { ...open, y: false };
        if (open.x && s.overflowX !== 'visible' && (r.left < box.left - TOL || r.right > box.right + TOL)) {
          cut.push(`a control clipped sideways by ${describe(a)}: ${describe(el)}`);
          break;
        }
        if (open.y && s.overflowY !== 'visible' && (r.top < box.top - TOL || r.bottom > box.bottom + TOL)) {
          cut.push(`a control clipped top or bottom by ${describe(a)}: ${describe(el)}`);
          break;
        }
        if (!open.x && !open.y) break;
      }
    }
    return [...wide, ...cut];
  }, CONTROLS);
  expect(problems, `the surface does not fit the viewport:\n  ${problems.join('\n  ')}`).toEqual([]);

  for (const locator of whole) {
    await expect(locator.first()).toBeVisible();
    const cutLabels = await locator.evaluateAll((els) => {
      const out = [];
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) continue;
        // The element itself, and any clipping box inside it (a chip's label).
        const boxes = [el, ...el.querySelectorAll('*')].filter(
          (b) => b === el || getComputedStyle(b).overflowX !== 'visible',
        );
        for (const b of boxes) {
          if (b.scrollWidth > b.clientWidth) {
            out.push(`"${(el.textContent || el.value || '').trim()}" (${b.scrollWidth}px of text in ${b.clientWidth}px)`);
            break;
          }
        }
      }
      return out;
    });
    expect(cutLabels, `a label the boards draw whole is ellipsized: ${cutLabels.join('; ')}`).toEqual([]);
  }

  for (const locator of sentences) {
    await expect(locator.first()).toBeVisible();
    const squeezed = await locator.evaluateAll((els) =>
      els
        .map((el) => {
          const parent = el.parentElement;
          const ps = getComputedStyle(parent);
          const content = parent.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight);
          const width = el.getBoundingClientRect().width;
          return width >= 0.6 * content
            ? null
            : `"${el.textContent.trim().slice(0, 50)}" is ${Math.round(width)}px of its ${Math.round(content)}px row`;
        })
        .filter(Boolean),
    );
    expect(squeezed, `a sentence is squeezed (one word per line): ${squeezed.join('; ')}`).toEqual([]);
  }
}

// Whether two boxes overlap (beyond half a pixel).
export function overlaps(a, b) {
  return !(a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5 || a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5);
}

// Assert a locator's box lies inside the viewport.
export async function expectInsideViewport(page, locator, what) {
  const { width, height } = page.viewportSize();
  const box = await locator.boundingBox();
  expect(box, `${what} has no box`).not.toBeNull();
  const inside = box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
  expect(inside, `${what} [x ${Math.round(box.x)}–${Math.round(box.x + box.width)}] lies outside the ${width}px viewport`).toBe(true);
}

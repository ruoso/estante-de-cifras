// behavior — the portal-scope provider at the token root (shell.portal_provider).
// ThemeRoot wraps its children in react-aria's UNSAFE_PortalProvider whose
// getContainer returns the `.est` element, so every React Aria overlay portals
// *inside* the token scope instead of to document.body (where theme.css defines
// no `var(--…)`). This pins the token-scope inheritance the .tji note names
// ("a RAC overlay rendered through the portal inherits design tokens, axe"),
// UNSAFE_PortalProvider's getContainer contract (PortalProvider.d.ts) and
// DIRECTION §3.7 L404-405. Axe here pins role/name/structure — the rules that
// run under jsdom; contrast (and that tokens visually resolve) is pinned at
// e2e-web (jsdom has no layout, so color-contrast is a no-op — the established
// scope note in foundation/app_tooling.md). All copy is written for this test.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components';
import { createStore } from '../worker/store.js';
import { checkWcag21aa } from '../a11y/axe.js';
import ThemeRoot from './ThemeRoot.jsx';
import { injectStyles } from '../test/theme-styles.js';

// A manual endpoint lets the test build a real store with no DB, the way the
// other theme behavior test does; no PREFERENCES is emitted, so the applied
// theme is automatic → Estante.
function manualStore() {
  const endpoint = { postMessage: () => {}, onmessage: null };
  return createStore(endpoint);
}

// A minimal React Aria overlay: a trigger and a modal dialog with an accessible
// name (the Heading in the title slot) and a close control — enough to portal
// and to be role/name/structure-clean under axe.
function Overlay() {
  return (
    <DialogTrigger>
      <Button>Open the overlay</Button>
      <ModalOverlay className="scrim center">
        <Modal className="dialog">
          <Dialog>
            {({ close }) => (
              <>
                <Heading slot="title" className="t-h2">
                  A portaled overlay
                </Heading>
                <Button onPress={close}>Close</Button>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

const openOverlay = () =>
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Open the overlay' })));

afterEach(() => {
  delete globalThis.matchMedia;
});

describe('ThemeRoot portal provider (behavior)', () => {
  // shell.overlay_stacking constraints 1, 3 and 4: an overlay already open when
  // it mounts, placed before a positioned screen in tree order and rendered in
  // the same commit (the shell remounting from SignIn), still lands in the one
  // overlay layer, after the screen.
  it('portals every overlay into the one overlay layer, the last child of `.est`, even when it mounts in the same commit as a positioned screen rendered after it (shell.overlay_stacking)', async () => {
    const store = manualStore();
    const { container } = render(
      <ThemeRoot store={store}>
        <ModalOverlay isOpen className="scrim">
          <Modal className="sheet">
            <Dialog>
              <Heading slot="title" className="t-h2">
                A sheet open at mount
              </Heading>
            </Dialog>
          </Modal>
        </ModalOverlay>
        <div className="scroll">
          <p>A screen written for this test.</p>
        </div>
      </ThemeRoot>,
    );

    const est = container.querySelector('.est');
    const layer = est.querySelector('.est-overlays');
    const dialog = await screen.findByRole('dialog', { name: 'A sheet open at mount' });
    const screenBody = est.querySelector('.scroll');

    expect(layer).toContainElement(dialog);
    expect(est.lastElementChild).toBe(layer);
    expect(screenBody.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  // shell.overlay_stacking constraints 2 and 5: the layer is fixed to the
  // viewport, its own stacking context, and takes no taps while what is portaled
  // into it does.
  it('the overlay layer is its own stacking context above the screen (shell.overlay_stacking)', () => {
    const removeStyles = injectStyles('shell/shell.css');
    try {
      const store = manualStore();
      const { container } = render(
        <ThemeRoot store={store}>
          <Overlay />
        </ThemeRoot>,
      );
      openOverlay();
      const layer = container.querySelector('.est-overlays');
      const style = getComputedStyle(layer);
      expect(style.position).toBe('fixed');
      expect(Number(style.zIndex)).toBeGreaterThanOrEqual(1);
      expect(style.pointerEvents).toBe('none');
      const scrim = layer.querySelector('.scrim');
      expect(scrim).not.toBeNull();
      expect(getComputedStyle(scrim).pointerEvents).toBe('auto');
    } finally {
      removeStyles();
    }
  });

  it('portals a React Aria overlay into the `.est` token root, axe-clean (DIRECTION §3.7 L404-405)', async () => {
    const store = manualStore();
    const { container } = render(
      <ThemeRoot store={store}>
        <Overlay />
      </ThemeRoot>,
    );

    openOverlay();

    const est = container.querySelector('.est');
    const dialog = screen.getByRole('dialog');

    // The overlay lands inside `.est` (via the provider's getContainer), not as a
    // direct child of document.body outside the token scope.
    expect(est).toContainElement(dialog);
    expect(dialog.parentElement).not.toBe(document.body);

    // Role/name/structure clean (contrast is pinned at e2e-web).
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('is additive: an overlay with no surrounding ThemeRoot still mounts (falls back to document.body)', () => {
    render(<Overlay />);
    openOverlay();
    // No `.est` ancestor and no provider: RAC falls back to document.body, so the
    // overlay still renders — the provider is never required for a bare render.
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(document.querySelector('.est')).toBeNull();
  });
});

// behavior — the app-wide button.row reset (shell.palco_contrast; theme/
// controls.css). A RAC `Button className="row"` is a native <button>; without
// the reset it kept the UA's light ButtonFace fill, border and font, so Palco's
// light ink sat on a light row. This pins the baseline every Button.row screen
// relies on (ShareSheet, SetlistsScreen, FirstRun, EnterShape, SongArrange, …)
// in each of the three themes, with the real stylesheets in the cascade.
describe('the button.row baseline (shell.palco_contrast)', () => {
  let removeStyles;
  afterEach(() => removeStyles?.());

  for (const theme of ['estante', 'caderno', 'palco']) {
    it(`a bare RAC Button.row inside .est resets to the row look in every theme — ${theme}`, async () => {
      removeStyles = injectStyles();
      const { container } = render(
        <div className={`est theme-${theme}`}>
          <div className="list" role="group" aria-label="Rows written for this test">
            <Button className="row">A plain row</Button>
            <Button className="row sel" aria-pressed>
              A selected row
            </Button>
          </div>
        </div>,
      );
      const root = container.querySelector('.est');
      const plain = screen.getByRole('button', { name: 'A plain row' });
      const sel = screen.getByRole('button', { name: 'A selected row' });

      // No UA fill: the row shows the .list surface behind it.
      expect(getComputedStyle(plain).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      // The selected row keeps the theme's accent-soft fill.
      expect(getComputedStyle(sel).background).toContain('var(--accent-soft)');
      for (const row of [plain, sel]) {
        const style = getComputedStyle(row);
        // No UA border: only the row line at the bottom (last row: none).
        expect(style.borderTopStyle).toBe('none');
        // The font is inherited from the theme root, not the UA button font.
        expect(style.font).not.toContain('depends on user agent');
        expect(style.fontFamily).toBe(getComputedStyle(root).fontFamily);
      }
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });

    it(`a notice's RAC Button.act reads as the drawn word, not a native button — ${theme}`, () => {
      removeStyles = injectStyles();
      render(
        <div className={`est theme-${theme}`}>
          <div className="notice">
            <span>A notice written for this test.</span>
            <Button className="act">Do it</Button>
          </div>
        </div>,
      );
      const act = getComputedStyle(screen.getByRole('button', { name: 'Do it' }));
      expect(act.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(act.borderTopStyle).toBe('none');
      expect(act.font).not.toContain('depends on user agent');
    });
  }
});

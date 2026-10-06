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

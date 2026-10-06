// behavior — the update notice with its real collaborators: React Aria
// Components, the real i18n catalogue (English by default) and the update store's
// shape. Pins the user-visible update affordance handed over by
// app_sw_register.md and the status-by-a-word rule (mockups README): a non-modal
// role=status carrying the word-bearing message, a Reload now and a Dismiss,
// both keyboard reachable, and nothing rendered when no update is waiting. Axe
// covers role/name/structure (the rules that run under jsdom); colour-contrast is
// a jsdom no-op, pinned at e2e-web.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import UpdateReady from './UpdateReady.jsx';

// A store in a fixed state. getSnapshot returns a stable reference (what
// useSyncExternalStore expects); reload and dismiss are spies so we can assert
// the buttons invoke them.
function fakeStore(updateReady) {
  const snapshot = { updateReady };
  return {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    reload: vi.fn(),
    dismiss: vi.fn(),
  };
}

describe('UpdateReady (behavior)', () => {
  it('renders nothing when no update is waiting', () => {
    const { container } = render(<UpdateReady store={fakeStore(false)} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows a non-modal status with the word-bearing message when an update is ready', async () => {
    const store = fakeStore(true);
    const { container } = render(<UpdateReady store={store} />);

    // Status carried by a word, never colour alone.
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('A new version is ready.');

    // Both actions are buttons (React Aria), named by their text.
    expect(screen.getByRole('button', { name: 'Reload now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('Reload now takes the update, by keyboard', () => {
    const store = fakeStore(true);
    render(<UpdateReady store={store} />);
    const reload = screen.getByRole('button', { name: 'Reload now' });

    // Keyboard reachable: focus and press Enter.
    act(() => reload.focus());
    expect(reload).toHaveFocus();
    act(() => {
      fireEvent.keyDown(reload, { key: 'Enter' });
      fireEvent.keyUp(reload, { key: 'Enter' });
    });

    expect(store.reload).toHaveBeenCalledTimes(1);
    expect(store.dismiss).not.toHaveBeenCalled();
  });

  it('Dismiss hides the notice, by pointer', () => {
    const store = fakeStore(true);
    render(<UpdateReady store={store} />);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Dismiss' })));

    expect(store.dismiss).toHaveBeenCalledTimes(1);
    expect(store.reload).not.toHaveBeenCalled();
  });
});

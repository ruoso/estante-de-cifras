// behavior — the install offer with its real collaborators: React Aria
// Components and the real i18n catalogue (English by default). Pins the
// user-visible offer: a non-modal role=status, an Install button only where the
// browser gave us its dialog, the Share-sheet words on iOS, a Not now on both,
// nothing when there is no offer, and standing aside for the update notice.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import InstallOffer from './InstallOffer.jsx';

function fakeStore(offer) {
  const snapshot = { offer };
  return {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    install: vi.fn(),
    dismiss: vi.fn(),
  };
}

function fakeUpdate(updateReady = false) {
  const snapshot = { updateReady };
  return { subscribe: () => () => {}, getSnapshot: () => snapshot };
}

describe('InstallOffer (behavior)', () => {
  it('renders nothing without an offer', () => {
    const { container } = render(<InstallOffer store={fakeStore(null)} update={fakeUpdate()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers Install where the browser gave us its dialog', async () => {
    const store = fakeStore('prompt');
    const { container } = render(<InstallOffer store={store} update={fakeUpdate()} />);

    expect(screen.getByRole('status')).toHaveTextContent('Put Estante on your home screen');
    const install = screen.getByRole('button', { name: 'Install' });

    act(() => install.focus());
    act(() => {
      fireEvent.keyDown(install, { key: 'Enter' });
      fireEvent.keyUp(install, { key: 'Enter' });
    });
    expect(store.install).toHaveBeenCalledTimes(1);

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('tells iOS how to do it from the Share sheet, with no Install button', async () => {
    const store = fakeStore('ios');
    const { container } = render(<InstallOffer store={store} update={fakeUpdate()} />);

    expect(screen.getByRole('status')).toHaveTextContent('tap Share, then Add to Home Screen');
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Not now' })));
    expect(store.dismiss).toHaveBeenCalledTimes(1);

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('stands aside while the update notice is showing', () => {
    const { container } = render(
      <InstallOffer store={fakeStore('prompt')} update={fakeUpdate(true)} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

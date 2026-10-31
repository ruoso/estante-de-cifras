// behavior (workflow 18) — the shell's Help and the first-open tour offer, over
// the real store with a scripted endpoint. Pins: the header carries Help about
// the destination shown; the offer is an inline notice (never a dialog) shown
// only once preferences have arrived without `tourOffered`; *No, thanks* and *Take
// the tour* each send MARK_TOUR_OFFERED, the second also opening the tour; once
// the register is set the offer is gone; axe clean.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import AppShell from './AppShell.jsx';

function installMatchMedia(wide) {
  globalThis.matchMedia = (media) => ({ media, matches: wide && media.includes('min-width'), addEventListener() {}, removeEventListener() {} });
}

afterEach(() => {
  delete globalThis.matchMedia;
});

function renderShell() {
  const sent = [];
  const endpoint = {
    postMessage(message) {
      sent.push(message);
    },
    onmessage: null,
  };
  const store = createStore(endpoint);
  const view = render(<AppShell store={store} />);
  const preferences = (payload) => act(() => endpoint.onmessage({ data: event(EventKind.PREFERENCES, payload) }));
  return { ...view, sent, preferences };
}

const OFFER = 'New to Estante? A short tour shows how it works.';

describe('the shell\'s help and tour offer (workflow 18)', () => {
  it('puts Help about the destination shown in the header', () => {
    installMatchMedia(false);
    renderShell();
    expect(screen.getByRole('button', { name: 'Help: Search' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    expect(screen.getByRole('button', { name: 'Help: Books' })).toBeInTheDocument();
  });

  it('waits for the preferences, then offers the tour inline; No, thanks answers it; axe clean', async () => {
    installMatchMedia(false);
    const { container, sent, preferences } = renderShell();
    expect(screen.queryByText(OFFER)).toBeNull();

    preferences({});
    expect(screen.getByText(OFFER)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'No, thanks' })));
    expect(sent.some((m) => m.kind === CommandKind.MARK_TOUR_OFFERED)).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();

    // The Worker re-surfaces the register: the offer is gone for good.
    preferences({ tourOffered: { value: true, at: '2026-10-31T10:00:00.000Z' } });
    expect(screen.queryByText(OFFER)).toBeNull();
  });

  it('Take the tour answers the offer and opens the tour', async () => {
    installMatchMedia(true);
    const { sent, preferences } = renderShell();
    preferences({});
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Take the tour' })));
    expect(sent.some((m) => m.kind === CommandKind.MARK_TOUR_OFFERED)).toBe(true);
    const tour = await screen.findByRole('dialog', { name: 'Tour' });
    expect(within(tour).getByRole('heading', { name: 'Welcome to Estante' })).toBeInTheDocument();
    act(() => fireEvent.click(within(tour).getByRole('button', { name: 'Skip tour' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('never offers it once answered', () => {
    installMatchMedia(false);
    const { preferences } = renderShell();
    preferences({ tourOffered: { value: true, at: '2026-10-31T10:00:00.000Z' } });
    expect(screen.queryByText(OFFER)).toBeNull();
  });
});

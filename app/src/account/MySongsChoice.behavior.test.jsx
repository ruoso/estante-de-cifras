// behavior — the two-*My songs* choice (account.new_device acceptance 6-8;
// workflow 13 §A device used before signing in; W13 board frame 3) with its real
// collaborators: React Aria Components, the real i18n catalogue and the real
// main-thread store, over a loopback endpoint whose Worker events are injected.
// The Worker side (the zip, the preview, the merge, keep both) is pinned in
// worker/new-device.behavior.test.js. Axe-clean on the choice and the preview.
// Song titles are written for this test (no-song-text rule).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, within, fireEvent } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import MySongsChoice from './MySongsChoice.jsx';

const CHOICE = { offered: true, accountBookId: 'srv-ms', ready: true, kind: 'android-tablet' };

function setup(choice = CHOICE) {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  const onClose = vi.fn();
  const onNeedsYou = vi.fn();
  const utils = render(
    <ThemeRoot store={store}>
      <MySongsChoice store={store} choice={choice} onClose={onClose} onNeedsYou={onNeedsYou} />
    </ThemeRoot>,
  );
  return { ...utils, store, sent, emit, onClose, onNeedsYou };
}

const PREVIEW = {
  uploadId: 'up-1',
  target: { kind: 'existing', bookId: 'srv-ms' },
  branch: 'main',
  hasHistory: true,
  sharedHistory: false,
  historyMarkers: null,
  mySongs: true,
  previews: [
    { path: 'tarde-clara.cifra.md', title: 'Tarde Clara', status: 'conflict', line: null },
    { path: 'noite-de-lua.cifra.md', title: 'Noite de Lua', status: 'added', summary: 'C G', changes: [] },
  ],
};

const kinds = (sent, kind) => sent.filter((m) => m.kind === kind);

// One gesture per press (a RAC Button's keyDown + click cancels the press).
const click = (button) => act(() => fireEvent.click(button));
const pressKey = (button, key) =>
  act(() => {
    button.focus();
    fireEvent.keyDown(button, { key });
    fireEvent.keyUp(button, { key });
  });

// The surface's tab order: its enabled, tabbable controls in document order.
const tabOrder = (container) =>
  [...container.querySelectorAll('.my-songs-choice button, .my-songs-choice [tabindex]')].filter(
    (el) => !el.disabled && el.getAttribute('tabindex') !== '-1',
  );

describe('MySongsChoice (behavior)', () => {
  it('says what the board says (W13 frame 3), axe-clean', async () => {
    const { container } = setup();
    expect(screen.getByText('Your two My songs')).toBeInTheDocument();
    expect(
      screen.getByText('This tablet’s preferences and shapes were merged into your account’s, setting by setting.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'This tablet has its own My songs' })).toBeInTheDocument();
    expect(
      screen.getByText('Your account has a My songs too. Bring the two together, or keep them apart.'),
    ).toBeInTheDocument();
    const merge = screen.getByRole('button', { name: /^Merge/ });
    expect(merge).toHaveTextContent(
      'This tablet’s songs go into your account’s My songs. Preview first, song by song.',
    );
    const keepBoth = screen.getByRole('button', { name: /^Keep both/ });
    expect(keepBoth).toHaveTextContent('This one stays on the shelf as My songs (this device).');
    expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('Merge waits for the account’s My songs to be on this device', () => {
    setup({ ...CHOICE, ready: false });
    expect(screen.getByRole('button', { name: /^Merge/ })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Your account’s My songs is still coming to this device.');
  });

  it('Merge opens the preview: What merging would do, added and conflict rows; Merge and save sends IMPORT_UPLOAD merge', async () => {
    const { container, sent, emit, onNeedsYou } = setup();
    await click(screen.getByRole('button', { name: /^Merge/ }));
    expect(kinds(sent, CommandKind.PREVIEW_MY_SONGS).at(-1).payload).toEqual({ target: 'srv-ms' });

    emit(event(EventKind.UPLOAD_PREVIEW, PREVIEW));
    expect(screen.getByRole('heading', { name: 'What merging would do' })).toBeInTheDocument();
    expect(screen.getByText('Nothing is written until you confirm')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The two share no history, so every song that is in both is shown as a conflict to choose between.',
      ),
    ).toBeInTheDocument();
    const rowOf = (title) => screen.getByText(title).closest('.upload-song');
    expect(within(rowOf('Tarde Clara')).getByText('conflict')).toBeInTheDocument();
    expect(within(rowOf('Noite de Lua')).getByText('added')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    await click(screen.getByRole('button', { name: 'Merge and save' }));
    expect(kinds(sent, CommandKind.IMPORT_UPLOAD).at(-1).payload).toMatchObject({
      uploadId: 'up-1',
      choice: 'merge',
      target: { bookId: 'srv-ms' },
      fromMySongs: true,
    });
    // A song in both goes to the conflict session first.
    emit(event(EventKind.SYNC, { bookId: 'srv-ms', phase: 'needs_you', at: '2026-10-15T10:00:00.000Z' }));
    expect(onNeedsYou).toHaveBeenCalledWith('srv-ms');
  });

  it('Keep both and Keep both instead send KEEP_BOTH_MY_SONGS with the device’s label', async () => {
    const first = setup();
    await click(screen.getByRole('button', { name: /^Keep both/ }));
    expect(kinds(first.sent, CommandKind.KEEP_BOTH_MY_SONGS)).toHaveLength(1);
    expect(kinds(first.sent, CommandKind.KEEP_BOTH_MY_SONGS)[0].payload.title).toBe('My songs (this device)');
    expect(first.onClose).toHaveBeenCalled();
    first.unmount();

    const second = setup();
    await click(screen.getByRole('button', { name: /^Merge/ }));
    second.emit(event(EventKind.UPLOAD_PREVIEW, PREVIEW));
    await click(screen.getByRole('button', { name: 'Keep both instead' }));
    expect(kinds(second.sent, CommandKind.KEEP_BOTH_MY_SONGS)).toHaveLength(1);
    // The previewed upload is dropped; nothing is written to the target.
    expect(kinds(second.sent, CommandKind.CANCEL_UPLOAD).at(-1).payload).toEqual({ uploadId: 'up-1' });
    expect(kinds(second.sent, CommandKind.IMPORT_UPLOAD)).toHaveLength(0);
  });

  it('Later closes and sends nothing', async () => {
    const { sent, onClose } = setup();
    await click(screen.getByRole('button', { name: 'Later' }));
    expect(onClose).toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('every action is reachable by Tab and pressed by Enter or Space', () => {
    const { container, sent, emit, onClose } = setup();
    const later = screen.getByRole('button', { name: 'Later' });
    const merge = screen.getByRole('button', { name: /^Merge/ });
    const keepBoth = screen.getByRole('button', { name: /^Keep both/ });
    expect(tabOrder(container)).toEqual([later, merge, keepBoth]);

    pressKey(merge, 'Enter');
    expect(kinds(sent, CommandKind.PREVIEW_MY_SONGS)).toHaveLength(1);
    emit(event(EventKind.UPLOAD_PREVIEW, PREVIEW));
    const keepInstead = screen.getByRole('button', { name: 'Keep both instead' });
    const mergeAndSave = screen.getByRole('button', { name: 'Merge and save' });
    expect(tabOrder(container)).toEqual([later, merge, keepBoth, keepInstead, mergeAndSave]);
    pressKey(mergeAndSave, ' ');
    expect(kinds(sent, CommandKind.IMPORT_UPLOAD)).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Keep both and Later answer the keyboard too', () => {
    const first = setup();
    pressKey(screen.getByRole('button', { name: /^Keep both/ }), ' ');
    expect(kinds(first.sent, CommandKind.KEEP_BOTH_MY_SONGS)).toHaveLength(1);
    expect(first.onClose).toHaveBeenCalled();
    first.unmount();

    const second = setup();
    pressKey(screen.getByRole('button', { name: 'Later' }), 'Enter');
    expect(second.onClose).toHaveBeenCalled();
    expect(second.sent).toHaveLength(0);
  });
});

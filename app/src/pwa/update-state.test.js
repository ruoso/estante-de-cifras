// unit — the main-thread update store (shell.pwa). Pins "held until the next
// launch" and the no-skipWaiting rule (app/vite.config.js:52 skipWaiting: false;
// workflow 8 no-interruption): onNeedRefresh surfaces a waiting update and
// stashes updateSW, dismiss hides the notice without taking it, reload takes it
// exactly once, and a bare registration with no waiting worker never surfaces an
// update nor calls updateSW.

import { describe, it, expect, vi } from 'vitest';
import { createUpdateStore } from './update-state.js';

describe('createUpdateStore', () => {
  it('starts with no update waiting', () => {
    const store = createUpdateStore();
    expect(store.getSnapshot().updateReady).toBe(false);
  });

  it('onNeedRefresh surfaces the update and notifies subscribers', () => {
    const store = createUpdateStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.onNeedRefresh(vi.fn());

    expect(store.getSnapshot().updateReady).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('dismiss hides the notice without clearing the waiting update', () => {
    const store = createUpdateStore();
    const updateSW = vi.fn();
    store.onNeedRefresh(updateSW);

    store.dismiss();
    expect(store.getSnapshot().updateReady).toBe(false);

    // The waiting update is kept: reload still takes it (it applies on the next
    // launch regardless).
    store.reload();
    expect(updateSW).toHaveBeenCalledTimes(1);
    expect(updateSW).toHaveBeenCalledWith(true);
  });

  it('reload calls the stashed updateSW(true) exactly once per call', () => {
    const store = createUpdateStore();
    const updateSW = vi.fn();
    store.onNeedRefresh(updateSW);

    store.reload();

    expect(updateSW).toHaveBeenCalledTimes(1);
    expect(updateSW).toHaveBeenCalledWith(true);
  });

  it('a bare registration (no waiting worker) never surfaces an update nor calls updateSW', () => {
    const store = createUpdateStore();
    const listener = vi.fn();
    store.subscribe(listener);

    // No onNeedRefresh has fired: nothing is waiting.
    expect(store.getSnapshot().updateReady).toBe(false);
    store.dismiss();
    store.reload(); // must not throw and must not call any updateSW

    expect(store.getSnapshot().updateReady).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('a repeated onNeedRefresh does not churn the snapshot', () => {
    const store = createUpdateStore();
    const listener = vi.fn();
    store.subscribe(listener);

    const first = store.getSnapshot();
    store.onNeedRefresh(vi.fn());
    const second = store.getSnapshot();
    store.onNeedRefresh(vi.fn());
    const third = store.getSnapshot();

    expect(first).not.toBe(second); // changed once
    expect(second).toBe(third); // stable thereafter (no second notification)
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

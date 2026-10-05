import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createStore } from './store.js';
import { useSlice } from './useStore.js';
import { event, EventKind } from './protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';

// behavior — the useSyncExternalStore binding (DIRECTION §3.7 L397-401, "only
// what shows it moves"). Two components each subscribe to a different slice;
// changing one slice re-renders only its component, and the rendered fixture
// is axe-clean at WCAG 2.1 AA.
//
// A manual endpoint lets the test push events straight into the store without
// a Worker or a database — this test is about the hook's re-render behaviour,
// not storage.
function manualStore() {
  const endpoint = { postMessage: () => {}, onmessage: null };
  const store = createStore(endpoint);
  // Fire an event into the store the way the Worker would, inside `act` so
  // React flushes the subscription.
  const emit = (message) => act(() => endpoint.onmessage({ data: message }));
  return { store, emit };
}

function ConnectionView({ store, onRender }) {
  const connection = useSlice(store, 'connection');
  onRender();
  return <p>Connection: {connection.status}</p>;
}

function MetaView({ store, onRender }) {
  const meta = useSlice(store, 'meta');
  onRender();
  return <p>Schema: {meta ? meta.schemaVersion : 'none'}</p>;
}

describe('useSlice (behavior)', () => {
  it('re-renders only the component whose slice changed', () => {
    const { store, emit } = manualStore();
    const connectionRenders = vi.fn();
    const metaRenders = vi.fn();

    render(
      <main>
        <h1>Store state</h1>
        <ConnectionView store={store} onRender={connectionRenders} />
        <MetaView store={store} onRender={metaRenders} />
      </main>,
    );

    const connectionBefore = connectionRenders.mock.calls.length;
    const metaBefore = metaRenders.mock.calls.length;

    // An error event moves only the connection slice; meta keeps its reference.
    emit(event(EventKind.ERROR, { message: 'boom', code: 'command_failed' }));

    expect(screen.getByText('Connection: error')).toBeInTheDocument();
    // The connection component re-rendered…
    expect(connectionRenders.mock.calls.length).toBeGreaterThan(
      connectionBefore,
    );
    // …and the meta component did not (its slice reference did not change).
    expect(metaRenders.mock.calls.length).toBe(metaBefore);
  });

  it('is axe-clean at WCAG 2.1 AA', async () => {
    const { store } = manualStore();
    const { container } = render(
      <main>
        <h1>Store state</h1>
        <ConnectionView store={store} onRender={() => {}} />
        <MetaView store={store} onRender={() => {}} />
      </main>,
    );
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

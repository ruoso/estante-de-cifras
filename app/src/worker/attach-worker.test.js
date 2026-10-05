import { describe, it, expect } from 'vitest';
import { attachWorker } from './attach-worker.js';
import { command, event, CommandKind, EventKind } from './protocol.js';

// unit — the thread-wiring adapter (DIRECTION §3.7 L394-396, the boundary).
// A `message` delivered to the scope reaches the logic, and an event the logic
// posts is `postMessage`d on the scope — proven against a fake worker-scope
// double, without a real `Worker`.
describe('attachWorker', () => {
  it('routes an incoming message to the logic and the logic events onto the scope', () => {
    const posted = [];
    // A fake worker scope: records what is posted, and holds an assignable
    // onmessage the test can fire, just like `self` in a real Worker.
    const scope = {
      postMessage: (message) => posted.push(message),
      onmessage: null,
    };

    const received = [];
    attachWorker(scope, (port) => ({
      handle(message) {
        received.push(message);
        // Emit an event back through the injected port.
        port.postMessage(event(EventKind.READY, { meta: { schemaVersion: 1 } }));
      },
    }));

    // The scope now has an onmessage the adapter installed.
    expect(typeof scope.onmessage).toBe('function');

    // Deliver a command the way the browser delivers it: as a MessageEvent
    // with a `data` field.
    const cmd = command(CommandKind.OPEN);
    scope.onmessage({ data: cmd });

    // It reached the logic unwrapped…
    expect(received).toEqual([cmd]);
    // …and the logic's event went out on the scope.
    expect(posted).toHaveLength(1);
    expect(posted[0].kind).toBe(EventKind.READY);
    expect(posted[0].dir).toBe('event');
  });
});

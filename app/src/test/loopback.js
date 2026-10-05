// An in-process loopback transport double for the Worker behavior level
// (storage.worker, Decision 2). jsdom has no `Worker`, so this wires the
// main-thread store's endpoint directly to the transport-agnostic Worker logic
// in the same process, while still exercising the genuine async path: every
// message is delivered on a microtask and round-trips through `structuredClone`
// — so a test fails the same way production would if any message carried a
// non-cloneable value.
//
// `createLogic` is the same factory shape `attachWorker` takes: given a port
// `{ postMessage }` it returns the logic `{ handle }`. The returned object is
// the `{ postMessage, onmessage }` endpoint to hand to `createStore`.

export function createLoopbackEndpoint(createLogic) {
  const endpoint = { postMessage: null, onmessage: null };

  // The port the logic posts events through: deliver to the store's onmessage,
  // async and cloned.
  const port = {
    postMessage(message) {
      const data = structuredClone(message);
      queueMicrotask(() => {
        endpoint.onmessage?.({ data });
      });
    },
  };

  const logic = createLogic(port);

  // The store posts commands through this: deliver to the logic, async and
  // cloned.
  endpoint.postMessage = (message) => {
    const data = structuredClone(message);
    queueMicrotask(() => {
      logic.handle(data);
    });
  };

  return endpoint;
}

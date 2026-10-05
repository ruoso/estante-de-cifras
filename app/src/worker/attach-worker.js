// The thread-wiring adapter (DIRECTION §3.7 L394-396). It connects the
// transport-agnostic Worker logic to a worker scope — `self` in the real
// Worker thread, a fake scope in a test. Both directions cross here:
//   scope.onmessage (a command arrives) -> logic.handle
//   logic's port.postMessage (an event)  -> scope.postMessage
// so the logic never names `self`, and this adapter holds no data logic.
//
// `createLogic` is a factory that, given a port `{ postMessage }`, returns the
// logic `{ handle }`. Passing a factory (rather than a built logic) is what
// lets the adapter hand the logic a port that posts onto *this* scope.
//
// Framework-free: no React.

export function attachWorker(scope, createLogic) {
  const logic = createLogic({
    postMessage: (message) => scope.postMessage(message),
  });
  scope.onmessage = (messageEvent) => logic.handle(messageEvent.data);
  return logic;
}

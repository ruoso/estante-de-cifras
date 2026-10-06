// The Worker-thread entry: the thin module the real `Worker` runs. It wires
// the transport-agnostic logic to the worker global `self` and nothing more —
// all data logic lives in `logic.js`, which this entry only adapts to the
// thread (DIRECTION §3.7 L394-396). `createWorkerStore()` in `store.js` spawns
// this file with `new Worker(new URL('./index.js', import.meta.url))`.
//
// This line — instantiating a browser `Worker` — is the one thing the jsdom
// unit/behavior tests cannot reach; it is exercised at e2e-web by the first
// shell task that mounts the Worker. The logic it wires is fully covered
// in-process (store.test.js) and the adapter with a fake scope
// (attach-worker.test.js).

// First: point `global` at `globalThis` so the TextEncoder polyfill bundled by
// lightning-fs initialises in a Worker (see worker-env.js). Must precede the
// imports below, which pull in lightning-fs through logic.js → fs.js.
import './worker-env.js';
import { attachWorker } from './attach-worker.js';
import { createWorkerLogic } from './logic.js';

attachWorker(self, (port) => createWorkerLogic(port));

// The message protocol between the main thread and the data Worker
// (DIRECTION §3.7 L394-401). Every message is a plain, structured-cloneable
// envelope so it survives `postMessage` across the real Worker boundary:
// commands travel main -> Worker, events travel Worker -> main. The `kind`
// field is an open string, so later storage and sync tasks (a clone's
// progress, a merge landing, a sync finishing — §3.7 L399-401) add message
// types without reshaping the channel.
//
// Framework-free: this module imports no React. It is the only thing the store
// and the Worker logic share (the constructors), which keeps the boundary thin.

// Rides on every envelope. No runtime negotiation is built — the service
// worker (`skipWaiting: false`) guarantees the Worker and the main thread are
// the same build within one load, so skew cannot occur mid-session — but the
// schema is still guarded by a version the day a migration needs it.
export const PROTOCOL_VERSION = 1;

// Direction tags. The store only ever reduces events; the Worker logic only
// ever handles commands. Each side ignores a message in the wrong direction.
export const COMMAND = 'command';
export const EVENT = 'event';

// Commands: main -> Worker. Open to extension; `OPEN` is the only one this
// task needs (it demonstrates the Worker owning IndexedDB). Later tasks add
// clone / fetch / merge / save / index without touching the envelope.
export const CommandKind = Object.freeze({
  OPEN: 'open',
});

// Events: Worker -> main. `READY` carries the Worker's persisted `meta`;
// `ERROR` carries a message and a code. Later tasks add progress / completion
// kinds here the same way.
export const EventKind = Object.freeze({
  READY: 'ready',
  ERROR: 'error',
});

// Build a command envelope (main -> Worker). `payload` is any
// structured-cloneable value; `kind` is open so callers in later tasks pass
// kinds this module does not yet name.
export function command(kind, payload = {}) {
  return { v: PROTOCOL_VERSION, dir: COMMAND, kind, payload };
}

// Build an event envelope (Worker -> main), same shape, opposite direction.
export function event(kind, payload = {}) {
  return { v: PROTOCOL_VERSION, dir: EVENT, kind, payload };
}

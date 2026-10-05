import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_VERSION,
  COMMAND,
  EVENT,
  CommandKind,
  EventKind,
  command,
  event,
} from './protocol.js';

// unit — the message protocol (DIRECTION §3.7 L397-401, "each is a message").
// Pins the envelope shape and version field, the command and event
// constructors, the extensible `kind`, and that every produced message is
// structured-clone-safe (it crosses `postMessage` in production).
describe('worker protocol', () => {
  it('stamps commands with the version and the command direction', () => {
    const msg = command(CommandKind.OPEN, { any: 'payload' });
    expect(msg).toEqual({
      v: PROTOCOL_VERSION,
      dir: COMMAND,
      kind: 'open',
      payload: { any: 'payload' },
    });
  });

  it('stamps events with the version and the event direction', () => {
    const msg = event(EventKind.READY, { meta: { schemaVersion: 1 } });
    expect(msg).toEqual({
      v: PROTOCOL_VERSION,
      dir: EVENT,
      kind: 'ready',
      payload: { meta: { schemaVersion: 1 } },
    });
  });

  it('defaults the payload to an empty object', () => {
    expect(command(CommandKind.OPEN).payload).toEqual({});
    expect(event(EventKind.READY).payload).toEqual({});
  });

  it('carries an extensible kind — a later task can pass a kind this module does not name', () => {
    // A clone's progress / a merge landing / a sync finishing (§3.7 L399-401)
    // ride the same envelope with a new kind, no reshaping of the channel.
    const progress = event('clone_progress', { received: 42, total: 100 });
    expect(progress.kind).toBe('clone_progress');
    expect(progress.dir).toBe(EVENT);
    expect(progress.v).toBe(PROTOCOL_VERSION);
  });

  it('produces structured-clone-safe messages (round-trips through structuredClone)', () => {
    const cmd = command(CommandKind.OPEN, { nested: { list: [1, 2, 3] } });
    const evt = event(EventKind.ERROR, {
      message: 'nope',
      code: 'command_failed',
    });
    expect(structuredClone(cmd)).toEqual(cmd);
    expect(structuredClone(evt)).toEqual(evt);
  });
});

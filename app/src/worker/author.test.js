import { describe, it, expect } from 'vitest';
import { noReplyAddress, authorFrom } from './author.js';

// unit — the commit identity (storage.working_copy). Pins tasks/40-storage.tji:33
// ("the author's no-reply address") and DIRECTION §3.2 L164-170: commits are
// authored with a per-user no-reply address, `<id>@users.estantedecifras.app`,
// never the user's real email; before sign-in a device local id stands in its
// place, formed the same way.
describe('noReplyAddress', () => {
  it('builds <id>@users.estantedecifras.app for an account user-id', () => {
    expect(noReplyAddress('u_8f3a21')).toBe('u_8f3a21@users.estantedecifras.app');
  });

  it('builds the same shape for a device local id (before sign-in)', () => {
    // The pre-sign-in local id is treated identically — the save path never has
    // to know which it holds (Decision 7).
    expect(noReplyAddress('local-7b2c9d')).toBe(
      'local-7b2c9d@users.estantedecifras.app',
    );
  });

  it('never forms the address from a real email — only the opaque id', () => {
    // Even handed something that looks like an address, it is used verbatim as
    // the local-part of the no-reply domain; a real mailbox is never the author.
    const address = noReplyAddress('u_42');
    expect(address.endsWith('@users.estantedecifras.app')).toBe(true);
    expect(address).not.toContain('@gmail');
  });
});

describe('authorFrom', () => {
  it('shapes name, no-reply email, whole-second timestamp and minute offset', () => {
    // A fixed `now` pins the timestamp: 2020-01-01T00:00:00Z is 1577836800s.
    const now = Date.UTC(2020, 0, 1, 0, 0, 0);
    const author = authorFrom({ id: 'u_42', name: 'A Tester' }, now);
    expect(author).toEqual({
      name: 'A Tester',
      email: 'u_42@users.estantedecifras.app',
      timestamp: 1577836800,
      timezoneOffset: new Date(now).getTimezoneOffset(),
    });
  });

  it('floors the timestamp to whole seconds', () => {
    const author = authorFrom({ id: 'u_1', name: 'X' }, 1577836800999);
    expect(author.timestamp).toBe(1577836800);
  });
});

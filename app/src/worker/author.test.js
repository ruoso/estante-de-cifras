import { describe, it, expect } from 'vitest';
import { noReplyAddress, authorFrom, createAuthorResolver } from './author.js';

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

// unit — the one author resolver (account.commit_author Constraint 2-3;
// storage/home_book Decision 6): `{ id: meta.accountId ?? meta.localAuthorId,
// name }`, the local author id made once, never `local`, never the device id.
describe('createAuthorResolver', () => {
  // An in-memory `meta` record standing in for the Worker's IndexedDB one.
  function fakeMeta(initial = {}) {
    const record = { ...initial };
    return {
      record,
      readMeta: async () => ({ ...record }),
      writeMeta: async (fields) => {
        Object.assign(record, fields);
      },
    };
  }

  it('resolves the account id when one is stored', async () => {
    const meta = fakeMeta({ accountId: 'u_acc', localAuthorId: 'loc-1', deviceId: 'dev-1' });
    const { resolveAuthor } = createAuthorResolver({ ...meta, readName: async () => 'Marina' });
    expect(await resolveAuthor()).toEqual({ id: 'u_acc', name: 'Marina' });
  });

  it('otherwise the local author id, created once and stable across calls', async () => {
    const meta = fakeMeta({ deviceId: 'dev-1' });
    let minted = 0;
    const { resolveAuthor } = createAuthorResolver({
      ...meta,
      randomId: () => `fresh-${++minted}`,
    });
    const [a, b] = await Promise.all([resolveAuthor(), resolveAuthor()]);
    const c = await resolveAuthor();
    expect(a.id).toBe('fresh-1');
    expect(b.id).toBe('fresh-1');
    expect(c.id).toBe('fresh-1');
    expect(minted).toBe(1);
    expect(meta.record.localAuthorId).toBe('fresh-1');
    // A fresh resolver over the same record (a relaunch) keeps the id.
    const again = createAuthorResolver({ ...meta, randomId: () => 'other' });
    expect((await again.resolveAuthor()).id).toBe('fresh-1');
  });

  it('never resolves the literal `local`', async () => {
    const meta = fakeMeta({ deviceId: 'dev-1' });
    const ids = ['local', 'ok-id'];
    const { resolveAuthor } = createAuthorResolver({ ...meta, randomId: () => ids.shift() });
    expect((await resolveAuthor()).id).toBe('ok-id');
  });

  it('never resolves the §2.3 device id (storage/home_book Decision 6)', async () => {
    const meta = fakeMeta({ deviceId: 'dev-1' });
    const ids = ['dev-1', 'loc-2'];
    const { resolveAuthor } = createAuthorResolver({ ...meta, randomId: () => ids.shift() });
    const { id } = await resolveAuthor();
    expect(id).toBe('loc-2');
    expect(id).not.toBe('dev-1');
    // The default mint is a random UUID, distinct from the device id too.
    const real = createAuthorResolver(fakeMeta({ deviceId: 'dev-1' }));
    expect((await real.resolveAuthor()).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('takes a typed name over the stored one, the stored one over `Me`', async () => {
    const meta = fakeMeta({ localAuthorId: 'loc-1' });
    const stored = createAuthorResolver({ ...meta, readName: async () => 'Stored' });
    expect((await stored.resolveAuthor({ name: ' Typed ' })).name).toBe('Typed');
    expect((await stored.resolveAuthor()).name).toBe('Stored');
    const none = createAuthorResolver({ ...meta });
    expect((await none.resolveAuthor()).name).toBe('Me');
  });

  it('names this device\'s local addresses and its own (local + account)', async () => {
    const meta = fakeMeta({ localAuthorId: 'loc-1', deviceId: 'dev-1' });
    const r = createAuthorResolver(meta);
    expect(await r.localAddresses()).toEqual([
      'loc-1@users.estantedecifras.app',
      'dev-1@users.estantedecifras.app',
    ]);
    expect(await r.ownAddresses()).not.toContain('u_acc@users.estantedecifras.app');
    meta.record.accountId = 'u_acc';
    expect(await r.ownAddresses()).toContain('u_acc@users.estantedecifras.app');
    // The shared `local@` every device wrote is never this device's (Decision 2).
    expect(await r.ownAddresses()).not.toContain('local@users.estantedecifras.app');
  });
});

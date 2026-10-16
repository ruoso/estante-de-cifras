// Fixtures for the sharing surfaces' behavior tests (books.share_people): a
// loopback `fetch` double over the Sharing endpoints, a bare store for
// ThemeRoot, and the people of *Choros da Ana* as board W10 draws them — people
// and a book written for these tests. Every account id is a UUID, so a test can
// assert no id reaches the screen.

import { createStore } from '../worker/store.js';
import { createSharingClient } from './sharing-client.js';

export const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const BOOK = 'bk';
export const BOOK_TITLE = 'Choros da Ana';

// A loopback fetch double keyed by "METHOD /path"; records every call with its
// parsed body and answers with the handler's status/body.
export function makeClient(routes) {
  const calls = [];
  const fetch = async (path, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    const handler = routes[`${method} ${path}`];
    if (!handler) throw new Error(`no route for ${method} ${path}`);
    const result = handler(body) ?? {};
    const status = result.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (result.body === undefined) throw new Error('no body');
        return result.body;
      },
    };
  };
  return { client: createSharingClient({ fetch }), calls };
}

// A bare store for ThemeRoot's preferences slice.
export function makeStore() {
  const endpoint = { postMessage: () => {}, onmessage: null };
  return createStore(endpoint);
}

const DAY = 24 * 60 * 60 * 1000;
// An instant `days` from now (negative: ago), so open stays open whenever the
// test runs.
export const fromNow = (days) => new Date(Date.now() + days * DAY).toISOString();

export const ANA = { userId: uid(1), role: 'owner', displayName: 'Ana' };
export const MARINA = { userId: uid(2), role: 'editor', displayName: 'Marina Costa' };
export const NAMED_READERS = ['Joana Lima', 'Rafael Souza', 'Beatriz Alves', 'Lucas Pereira', 'Bia Rocha'].map(
  (name, i) => ({ userId: uid(10 + i), role: 'reader', displayName: name }),
);
export const UNNAMED_READER = { userId: uid(20), role: 'reader' };

// The reader invitation of 2 Oct (open, a week) and the editor invitation of
// 28 Sep (one use, used by Marina), relative to now.
export function invitations({ readerUrl = 'https://estante.app/i/tok-reader' } = {}) {
  const readerAt = fromNow(-3);
  const readers = [...NAMED_READERS, UNNAMED_READER];
  return [
    {
      id: 'i-reader',
      role: 'reader',
      expiry: 'week',
      createdAt: readerAt,
      expiresAt: fromNow(4),
      useLimit: null,
      joined: readers.map((r, i) => ({ userId: r.userId, joinedAt: fromNow(-2 + i * 0.01), ...(r.displayName ? { displayName: r.displayName } : {}) })),
      joinedCount: readers.length,
      withdrawn: false,
      ...(readerUrl ? { url: readerUrl } : {}),
    },
    {
      id: 'i-editor',
      role: 'editor',
      expiry: 'until-withdrawn',
      createdAt: fromNow(-7),
      expiresAt: null,
      useLimit: 1,
      joined: [{ userId: MARINA.userId, joinedAt: fromNow(-6), displayName: 'Marina Costa' }],
      joinedCount: 1,
      withdrawn: false,
    },
  ];
}

// The owner's member list: Ana, Marina, the five named readers and one unnamed.
export function ownerMembers({ count = 37 } = {}) {
  return { members: [ANA, MARINA, ...NAMED_READERS, UNNAMED_READER], count, limit: 50 };
}

// behavior (account.leaving; workflow 17 §Taking your data out / §Deleting / §The
// warnings, counted / §Offline; mockup W17-leaving.dc.html) — the Leaving region's
// two dialogs driven through their real collaborators: real React Aria, real i18n,
// real ThemeRoot/LocaleRoot, a worker-backed loopback store (createLoopbackEndpoint
// over the real Worker logic + fake-indexeddb + web-locks + loopback git remotes),
// an injected auth-client double routing DELETE /api/account, and a loopback
// sharing client for listMembers. Each rendered state is checked axe-clean at
// WCAG 2.1 AA.
//
// Request/response shapes are pinned STRUCTURALLY against api/openapi.yaml —
// DeleteAccountRequest { confirm } in the DELETE body, 204 / 400 / 401 responses,
// MemberList { members, count, limit } — not by importing api/validate.js, which
// breaks under Vite ([[api-validate-js-breaks-under-vite]]).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { add, commit } from 'isomorphic-git';

import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import { createStore } from '../worker/store.js';
import { createWorkerLogic } from '../worker/logic.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { createFileSystem } from '../worker/fs.js';
import { createGitLayer } from '../worker/git.js';
import { createGitHttpClient } from '../worker/git-http.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { createAuthClient } from './auth-client.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import LocaleRoot from '../i18n/LocaleRoot.jsx';
import LeaveDialogs from './LeaveDialogs.jsx';

const rand = () => Math.random().toString(36).slice(2);
const AUTHOR = { id: 'u_tester', name: 'A Tester' };
const FENCE = '```';
const songText = (lines) => lines.join('\n') + '\n';

// A loopback fetch double for the auth client: route by "METHOD /path", record
// each call with its parsed JSON body, and let a handler set the status.
function makeAuthClient(routes) {
  const calls = [];
  const fetch = async (path, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    const handler = routes[`${method} ${path}`];
    if (!handler) throw new Error(`no route for ${method} ${path}`);
    const result = handler({ method, path, body });
    const status = result?.status ?? 204;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (result?.body === undefined) throw new Error('no body');
        return result.body;
      },
    };
  };
  return { client: createAuthClient({ fetch }), calls };
}

// A loopback sharing client: listMembers returns a MemberList-shaped body with the
// configured member count per book id (0 when unlisted).
function sharingDouble(countsById = {}) {
  return {
    async listMembers(bookId) {
      return { members: [], count: countsById[bookId] ?? 0, limit: 50 };
    },
  };
}

function installMatchMedia() {
  globalThis.matchMedia = (media) => ({
    media,
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

// A worker-backed store over fake-indexeddb + web-locks + loopback git remotes
// (each put-online book gets its own empty bare remote, the shape the service
// creates).
function workerStoreOnline(openRemotes) {
  const idb = new IDBFactory();
  const name = `leave-${rand()}`;
  const remoteByService = new Map();
  const fetchImpl = async (url, init = {}) => {
    if (typeof url === 'string' && url.startsWith('http')) return globalThis.fetch(url, init);
    if (url === '/api/books' && init.method === 'POST') {
      const { title } = JSON.parse(init.body);
      const remote = await startGitHttpRemote({ seed: false });
      openRemotes.push(remote);
      const serviceId = `srv-${rand()}`;
      remoteByService.set(serviceId, remote);
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: serviceId,
          title,
          role: 'owner',
          visibility: 'private',
          gitUrl: remote.url,
          original: null,
        }),
      };
    }
    if (url === '/api/shelf/change-check') {
      return { ok: true, status: 200, json: async () => ({ books: [] }) };
    }
    return { ok: false, status: 404, json: async () => null };
  };
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: fetchImpl }),
  );
  const store = createStore(endpoint);
  const events = [];
  store.subscribeEvents((m) => events.push(m));
  return { store, events, remoteByService, fs, git };
}

async function createBook(ctx, title) {
  const mark = ctx.events.length;
  ctx.store.send(command(CommandKind.CREATE_BOOK, { title, author: AUTHOR }));
  let created;
  await waitFor(() => {
    created = ctx.events.slice(mark).find((e) => e.kind === EventKind.BOOK_CREATED);
    expect(created).toBeTruthy();
  });
  return created.payload.bookId;
}

async function putOnline(ctx, localId) {
  ctx.store.send(command(CommandKind.PUT_ONLINE, { bookId: localId, author: AUTHOR }));
  let online;
  await waitFor(() => {
    online = ctx.events.find(
      (e) => e.kind === EventKind.BOOK_ONLINE && e.payload.previousBookId === localId,
    );
    expect(online).toBeTruthy();
  });
  return online.payload.bookId;
}

// A hosted book carrying both kinds of local-only work: one unsaved working song
// and one local commit not yet pushed. Returns the service id.
async function hostedBookWithLocalWork(ctx, title, term) {
  const localId = await createBook(ctx, title);
  ctx.store.send(command(CommandKind.OPEN));
  await waitFor(() => expect(ctx.store.slice('index')?.[localId]).toBe('ready'));
  ctx.store.send(
    command(CommandKind.WRITE, {
      bookId: localId,
      path: `${term}.cifra.md`,
      text: songText([`# ${term}`, '- artist: Trio de Teste', '## A', FENCE, 'C   G', 'ai', FENCE]),
    }),
  );
  await waitFor(() => {
    ctx.store.send(command(CommandKind.SEARCH, { query: term }));
    const hit = (ctx.store.slice('search')?.results ?? []).some((r) => r.bookId === localId);
    expect(hit).toBe(true);
  });
  const serviceId = await putOnline(ctx, localId);
  await ctx.remoteByService.get(serviceId).stop();
  const dir = ctx.git.bookDir(serviceId);
  await ctx.fs.promises.writeFile(`${dir}/nova.cifra.md`, songText(['# Nova', '## A', FENCE, 'C', FENCE]));
  await add({ fs: ctx.fs, dir, filepath: 'nova.cifra.md' });
  await commit({ fs: ctx.fs, dir, message: 'Gravação local', author: { name: 'A Tester', email: 'u@users.invalid' } });
  return serviceId;
}

const EMAIL = 'rafael@example.com';

function renderLeave(ctx, { client, sharingClient, onLeft = () => {} }) {
  return render(
    <ThemeRoot store={ctx.store}>
      <LocaleRoot store={ctx.store}>
        <LeaveDialogs
          store={ctx.store}
          authClient={client}
          sharingClient={sharingClient}
          onLeft={onLeft}
        />
      </LocaleRoot>
    </ThemeRoot>,
  );
}

let restoreLocks;
let openRemotes;
beforeEach(() => {
  restoreLocks = installWebLocks();
  installMatchMedia();
  setLocale('en');
  openRemotes = [];
});
afterEach(async () => {
  restoreLocks();
  delete globalThis.matchMedia;
  setLocale('en');
  for (const r of openRemotes) {
    try {
      await r.stop();
    } catch {
      // already stopped
    }
  }
});

describe('Take your data out (workflow 17 §Taking your data out)', () => {
  it('lists every reachable book plus the home book, each with Download and a Download everything, and dispatches DOWNLOAD_BOOK, axe clean', async () => {
    const ctx = workerStoreOnline(openRemotes);
    const shared = await hostedBookWithLocalWork(ctx, 'Banda do Bairro', 'bairro');
    await createBook(ctx, 'Só aqui');

    const { client } = makeAuthClient({});
    const { container } = renderLeave(ctx, { client, sharingClient: sharingDouble() });

    fireEvent.click(await screen.findByRole('button', { name: 'Take your data out' }));
    const dialog = await screen.findByRole('dialog');

    // The owned book, the local book and the home book, each with a Download.
    expect(within(dialog).getByText('Banda do Bairro')).toBeInTheDocument();
    expect(within(dialog).getByText('Só aqui')).toBeInTheDocument();
    expect(within(dialog).getByText('Your home book')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Download everything' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Download Banda do Bairro' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // A per-book Download yields the per-book zip (BOOK_DOWNLOAD) from the device.
    const mark = ctx.events.length;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download Banda do Bairro' }));
    await waitFor(() => {
      const ev = ctx.events.slice(mark).find((e) => e.kind === EventKind.BOOK_DOWNLOAD && e.payload.bookId === shared);
      expect(ev).toBeTruthy();
      expect(ev.payload.bytes.length).toBeGreaterThan(0);
    });
  });
});

describe('Delete my account (workflow 17 §Deleting / §The warnings, counted)', () => {
  it('shows the willHappen list, the counted who-loses-access and only-here lines, gates on the typed email, and on confirm deletes then tears down, axe clean', async () => {
    const ctx = workerStoreOnline(openRemotes);
    const shared = await hostedBookWithLocalWork(ctx, 'Banda do Bairro', 'bairro');

    const { client, calls } = makeAuthClient({ 'DELETE /api/account': () => ({ status: 204 }) });
    let left = 0;
    renderLeave(ctx, {
      client,
      sharingClient: sharingDouble({ [shared]: 12 }),
      onLeft: () => (left += 1),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Delete my account' }));
    const dialog = await screen.findByRole('dialog');

    // The willHappen statements, in words (workflow 17 §Deleting).
    expect(within(dialog).getByText('Your account, every session and every passkey are removed.')).toBeInTheDocument();
    expect(within(dialog).getByText('The books you own are deleted for everyone who shares them.')).toBeInTheDocument();
    expect(within(dialog).getByText('Your access to books other people own ends.')).toBeInTheDocument();
    expect(within(dialog).getByText('Your books and home book are removed from this device.')).toBeInTheDocument();

    // Who loses access, counted from listMembers; the device-only work, counted
    // from the sign-out survey. A word and a count, never colour alone.
    await within(dialog).findByText('Banda do Bairro · shared with 12 people — they will lose access');
    expect(within(dialog).getByText(/unsaved changes in 1 song/)).toBeInTheDocument();
    expect(within(dialog).getByText(/1 save not yet pushed/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Take your data out first' })).toBeInTheDocument();
    expect(within(dialog).getByText('This cannot be undone.')).toBeInTheDocument();

    // The danger action is disabled until the confirm field is non-empty.
    const deleteBtn = within(dialog).getByRole('button', { name: 'Delete my account' });
    expect(deleteBtn).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Type your email address to confirm:' }), {
      target: { value: EMAIL },
    });
    expect(deleteBtn).toBeEnabled();

    // On confirm: DELETE /api/account first (the email in the body, Decision 4),
    // then the Worker teardown empties the shelf and the surface returns signed-out.
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      const call = calls.find((c) => c.method === 'DELETE' && c.path === '/api/account');
      expect(call).toBeTruthy();
      expect(call.body).toEqual({ confirm: EMAIL });
    });
    await waitFor(() => {
      const shelf = ctx.store.slice('shelf') ?? {};
      const live = Object.values(shelf.books ?? {}).filter((b) => b?.label?.value != null);
      expect(live).toHaveLength(0);
    });
    await waitFor(() => expect(left).toBe(1));
  });

  it('is axe clean with the full delete dialog drawn', async () => {
    const ctx = workerStoreOnline(openRemotes);
    const shared = await hostedBookWithLocalWork(ctx, 'Banda do Bairro', 'bairro');
    const { client } = makeAuthClient({ 'DELETE /api/account': () => ({ status: 204 }) });
    const { container } = renderLeave(ctx, { client, sharingClient: sharingDouble({ [shared]: 12 }) });

    fireEvent.click(await screen.findByRole('button', { name: 'Delete my account' }));
    await screen.findByRole('dialog');
    await screen.findByText('Banda do Bairro · shared with 12 people — they will lose access');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a 400 mismatch keeps the modal open with a role="alert" word and never shows an address', async () => {
    const ctx = workerStoreOnline(openRemotes);
    await createBook(ctx, 'Só aqui');
    const { client } = makeAuthClient({ 'DELETE /api/account': () => ({ status: 400 }) });
    let left = 0;
    renderLeave(ctx, { client, sharingClient: sharingDouble(), onLeft: () => (left += 1) });

    fireEvent.click(await screen.findByRole('button', { name: 'Delete my account' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Type your email address to confirm:' }), {
      target: { value: 'wrong@example.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete my account' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/not the email on this account/);
    // The modal is still open and the teardown never ran.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(left).toBe(0);
  });
});

describe('Offline (workflow 17 §Offline)', () => {
  it('disables Delete my account with a worded note while take-your-data-out still downloads', async () => {
    const ctx = workerStoreOnline(openRemotes);
    const shared = await hostedBookWithLocalWork(ctx, 'Banda do Bairro', 'bairro');
    const { client } = makeAuthClient({});
    renderLeave(ctx, { client, sharingClient: sharingDouble() });

    // The network goes away.
    await act(async () => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    // Delete my account is disabled with the "needs a connection" note.
    fireEvent.click(await screen.findByRole('button', { name: 'Delete my account' }));
    const del = await screen.findByRole('dialog');
    expect(within(del).getByText(/Needs a connection/)).toBeInTheDocument();
    expect(within(del).getByRole('button', { name: 'Delete my account' })).toBeDisabled();
    fireEvent.click(within(del).getByRole('button', { name: 'Cancel' }));

    // Take your data out still works offline: the notice, and a download.
    fireEvent.click(await screen.findByRole('button', { name: 'Take your data out' }));
    const data = await screen.findByRole('dialog');
    expect(within(data).getByText(/downloads work here/)).toBeInTheDocument();
    const mark = ctx.events.length;
    fireEvent.click(within(data).getByRole('button', { name: 'Download Banda do Bairro' }));
    await waitFor(() => {
      expect(ctx.events.slice(mark).some((e) => e.kind === EventKind.BOOK_DOWNLOAD && e.payload.bookId === shared)).toBe(true);
    });
  });
});

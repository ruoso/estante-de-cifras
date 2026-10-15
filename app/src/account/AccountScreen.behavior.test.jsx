// behavior (account.account_screen; workflow 13 §The account screen;
// design.theme_picker; mockup Theme-picker.dc.html) — the account surface driven
// through its real collaborators: real React Aria Components, real i18n, real
// ThemeRoot/LocaleRoot, and:
//   - a worker-backed loopback store (createLoopbackEndpoint over the real Worker
//     logic + fake-indexeddb + web-locks), so a theme/language choice round-trips
//     through the real SET_THEME/SET_LANGUAGE command path and ThemeRoot /
//     LocaleRoot re-apply off the `preferences` slice (Constraints; Decision 2);
//   - an injected auth-client double routing GET/DELETE /api/account/{sessions,
//     passkeys} and the register pair, with a stubbed navigator.credentials /
//     PublicKeyCredential (jsdom provides neither).
// Each rendered state is checked axe-clean at WCAG 2.1 AA.
//
// Request/response shapes are pinned structurally against api/openapi.yaml —
// Session { id, current, lastUsedAt, device? } (961-976), Passkey { id, label?,
// createdAt, lastUsedAt|null } (988-1002) — not by importing api/validate.js,
// which breaks under Vite ([[api-validate-js-breaks-under-vite]]).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';

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
import AccountScreen from './AccountScreen.jsx';

const rand = () => Math.random().toString(36).slice(2);

// A substring matcher that tolerates regex-special characters in a label (the
// locale names carry parentheses, e.g. "Português (Brasil)").
const nameMatch = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

// A loopback fetch double for the auth client: route by "METHOD /path", record
// every call (with its parsed JSON body), and let a handler set the status/body —
// or throw, to model an unreachable service.
function makeAuthClient(routes) {
  const calls = [];
  const fetch = async (path, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    const handler = routes[`${method} ${path}`];
    if (!handler) throw new Error(`no route for ${method} ${path}`);
    const result = handler({ method, path, body });
    const status = result?.status ?? 200;
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

// Stub the platform WebAuthn surface (the "add a passkey" register flow). Mirrors
// SignIn.behavior.test.jsx: parse*OptionsFromJSON is identity and a credential
// carries toJSON() and the attachment.
function installWebAuthn() {
  const PublicKeyCredential = function PublicKeyCredential() {};
  PublicKeyCredential.parseCreationOptionsFromJSON = (json) => json;
  PublicKeyCredential.parseRequestOptionsFromJSON = (json) => json;
  globalThis.PublicKeyCredential = PublicKeyCredential;
  const makeCred = () => {
    const id = `cred_${rand()}`;
    return {
      id,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      toJSON() {
        return { id, rawId: id, type: 'public-key', response: {}, clientExtensionResults: {} };
      },
    };
  };
  Object.defineProperty(globalThis.navigator, 'credentials', {
    configurable: true,
    value: { create: async () => makeCred() },
  });
}
function uninstallWebAuthn() {
  delete globalThis.PublicKeyCredential;
  if (Object.getOwnPropertyDescriptor(globalThis.navigator, 'credentials')) {
    delete globalThis.navigator.credentials;
  }
}

// The device's light/dark mode (jsdom has no matchMedia): fixed at light so
// `automatic` resolves to Estante deterministically (resolve.js).
function installMatchMedia() {
  globalThis.matchMedia = (media) => ({
    media,
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

// A bare store for the auth-only states (ThemeRoot reads the preferences slice;
// the auth client is injected, so no worker is needed to drive the rosters).
function bareStore() {
  return createStore({ postMessage: () => {}, onmessage: null });
}

// A worker-backed store (fresh fake-indexeddb + web-locks) for the preference
// round-trip: SET_THEME/SET_LANGUAGE provision a local home book and re-surface
// PREFERENCES through the real command path.
function workerStore() {
  const idb = new IDBFactory();
  const name = `acct-${rand()}`;
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  return createStore(endpoint);
}

const rootOf = (container) => container.querySelector('.est');

function renderAccount(store, { client, ...props } = {}) {
  const { client: fallback } = makeAuthClient({});
  return render(
    <ThemeRoot store={store}>
      <LocaleRoot store={store}>
        <AccountScreen store={store} authClient={client ?? fallback} {...props} />
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
  uninstallWebAuthn();
  setLocale('en');
  for (const r of openRemotes) {
    try {
      await r.stop();
    } catch {
      // A remote a test already stopped (to pin an unpushed commit) — fine.
    }
  }
});

// A signed-out double: listSessions 401. The signed-in regions are replaced by
// the not-signed-in card.
const signedOut = () => makeAuthClient({ 'GET /api/account/sessions': () => ({ status: 401 }) });

describe('Preferences, before sign-in (workflow 13 L70-76; design.theme_picker)', () => {
  it('renders the four themes and four languages, with the chosen one marked by the word "Selected", axe clean', async () => {
    const { client } = signedOut();
    const { container } = renderAccount(bareStore(), { client });

    // Preferences is always present; the not-signed-in card replaces the rosters.
    await screen.findByText('Not signed in');

    // The four themes, each named in text, inside a labelled radiogroup.
    const themeGroup = screen.getByRole('radiogroup', { name: 'Theme' });
    for (const name of ['Automatic', 'Estante', 'Caderno', 'Palco']) {
      expect(within(themeGroup).getByRole('radio', { name: nameMatch(name) })).toBeInTheDocument();
    }
    // The four languages, each name in its own language.
    const langGroup = screen.getByRole('radiogroup', { name: 'Language' });
    for (const name of ['English', 'Português (Brasil)', 'Español (Latinoamérica)', 'Italiano']) {
      expect(within(langGroup).getByRole('radio', { name: nameMatch(name) })).toBeInTheDocument();
    }

    // The chosen option carries the word "Selected" (never colour alone):
    // Automatic (absent register) and English (the browser's) by default.
    expect(within(themeGroup).getByRole('radio', { name: /Automatic/ })).toBeChecked();
    expect(screen.getAllByText('Selected').length).toBeGreaterThan(0);

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a theme choice applies live through ThemeRoot, and a language choice changes the on-screen language (round-trip)', async () => {
    const { client } = signedOut();
    const { container } = renderAccount(workerStore(), { client });

    await screen.findByText('Not signed in');
    // Automatic + light → Estante to begin with.
    expect(rootOf(container)).toHaveClass('theme-estante');

    // Choose Palco → SET_THEME round-trips and ThemeRoot re-applies theme-palco.
    fireEvent.click(screen.getByRole('radio', { name: /Palco/ }));
    await waitFor(() => expect(rootOf(container)).toHaveClass('theme-palco'));

    // Choose Português → SET_LANGUAGE round-trips and LocaleRoot re-renders the
    // surface in Portuguese ("Preferences" → "Preferências").
    fireEvent.click(screen.getByRole('radio', { name: /Português \(Brasil\)/ }));
    await waitFor(() => expect(screen.getByText('Preferências')).toBeInTheDocument());
    expect(document.documentElement.lang).toBe('pt-BR');
  });
});

describe('Not signed in (workflow 13 L74; acceptance 4)', () => {
  it('the card’s "Use a passkey" / "Email me a link" open the SignIn surface', async () => {
    const { client } = signedOut();
    const opened = [];
    renderAccount(bareStore(), { client, onSignIn: (method) => opened.push(method) });

    fireEvent.click(await screen.findByRole('button', { name: 'Use a passkey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Email me a link' }));
    expect(opened).toEqual(['passkey', 'email']);
  });
});

describe('Signed-in devices (workflow 13 L77-79; acceptance 5)', () => {
  function signedInClient(over = {}) {
    return makeAuthClient({
      'GET /api/account/sessions': () => ({
        body: {
          sessions: [
            { id: 's1', current: true, lastUsedAt: '2026-10-12T10:00:00.000Z', device: 'Chrome on Linux' },
            { id: 's2', current: false, lastUsedAt: '2026-10-11T09:00:00.000Z', device: 'Edge on Windows' },
          ],
        },
      }),
      'GET /api/account/passkeys': () => ({ body: { passkeys: [] } }),
      'GET /api/account/recovery-email': () => ({ body: { email: null, pending: null } }),
      ...over,
    });
  }

  it('marks the current device and signs another out (revokeSession), dropping its row, axe clean', async () => {
    const { client, calls } = signedInClient({
      'DELETE /api/account/sessions/s2': () => ({ status: 204 }),
    });
    const { container } = renderAccount(bareStore(), { client });

    // The current session is marked "in use now"; the other carries its last use.
    expect(await screen.findByText('This device')).toBeInTheDocument();
    expect(screen.getByText(/in use now/)).toBeInTheDocument();
    expect(screen.getByText('Edge on Windows')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // "Sign out" on the other device → confirm → revokeSession → the row leaves.
    fireEvent.click(screen.getByRole('button', { name: 'Sign Edge on Windows out' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }));

    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/account/sessions/s2')).toBe(true),
    );
    await waitFor(() => expect(screen.queryByText('Edge on Windows')).toBeNull());
  });

  it('a 404 on revoke (already gone) reconciles the row away', async () => {
    const { client } = signedInClient({
      'DELETE /api/account/sessions/s2': () => ({ status: 404 }),
    });
    renderAccount(bareStore(), { client });

    await screen.findByText('Edge on Windows');
    fireEvent.click(screen.getByRole('button', { name: 'Sign Edge on Windows out' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(screen.queryByText('Edge on Windows')).toBeNull());
  });

  it('the current device’s sign-out opens the remove/keep dialog, not a revoke (account.sign_out)', async () => {
    // The current-device control is account.sign_out's subject: it opens the
    // sign-out dialog (the remove/keep choice), never a per-device revoke DELETE.
    const { client, calls } = signedInClient();
    let signedOutHere = 0;
    renderAccount(bareStore(), { client, onSignOut: () => (signedOutHere += 1) });

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out of this device' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Sign out of this device?')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('radio', { name: /Remove this account’s books/ }),
    ).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: /Keep them here/ })).toBeInTheDocument();
    // Opening the dialog is not itself a sign-out: the seam fires only on confirm,
    // and no session DELETE (that is another device's revoke) is ever sent.
    expect(signedOutHere).toBe(0);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });
});

describe('Passkeys (workflow 13 L80; acceptance 6)', () => {
  function signedInClient(routes = {}) {
    const passkeys = [
      { id: 'k1', label: 'iCloud Keychain', createdAt: '2026-03-12T00:00:00.000Z', lastUsedAt: null },
    ];
    const { client, calls } = makeAuthClient({
      'GET /api/account/sessions': () => ({ body: { sessions: [{ id: 's1', current: true, lastUsedAt: '2026-10-12T10:00:00.000Z', device: 'Chrome on Linux' }] } }),
      'GET /api/account/passkeys': () => ({ body: { passkeys: [...passkeys] } }),
      // A confirmed email, so the only passkey keeps its Remove (workflow 13 L70–76).
      'GET /api/account/recovery-email': () => ({ body: { email: 'ana@example.com', pending: null } }),
      'DELETE /api/account/passkeys/k1': () => {
        const i = passkeys.findIndex((k) => k.id === 'k1');
        if (i >= 0) passkeys.splice(i, 1);
        return { status: 204 };
      },
      'POST /api/auth/passkey/register/begin': () => ({ body: { publicKey: { challenge: 'c' }, state: 's' } }),
      'POST /api/auth/passkey/register/finish': () => {
        passkeys.push({ id: 'k2', label: 'Windows Hello', createdAt: '2026-10-13T00:00:00.000Z', lastUsedAt: null });
        return { body: { id: 'u_acct' } };
      },
      ...routes,
    });
    return { client, calls, passkeys };
  }

  it('lists passkeys, removes one through the confirm, and adds a passkey to this device, axe clean', async () => {
    installWebAuthn();
    const { client, calls } = signedInClient();
    const { container } = renderAccount(bareStore(), { client });

    expect(await screen.findByText('iCloud Keychain')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Remove → confirm → DELETE → the row leaves.
    fireEvent.click(screen.getByRole('button', { name: 'Remove iCloud Keychain' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/account/passkeys/k1')).toBe(true),
    );
    await waitFor(() => expect(screen.queryByText('iCloud Keychain')).toBeNull());

    // Add a passkey → register begin/create/finish → the re-listed passkey shows.
    fireEvent.click(screen.getByRole('button', { name: 'Add a passkey to this device' }));
    await waitFor(() => expect(screen.getByText('Windows Hello')).toBeInTheDocument());
    expect(calls.some((c) => c.path === '/api/auth/passkey/register/finish')).toBe(true);
  });
});

describe('Errors are worded and retryable (acceptance 7)', () => {
  it('a failed passkeys list shows a worded alert with a retry that recovers', async () => {
    let failing = true;
    const { client } = makeAuthClient({
      'GET /api/account/sessions': () => ({ body: { sessions: [{ id: 's1', current: true, lastUsedAt: '2026-10-12T10:00:00.000Z', device: 'Chrome on Linux' }] } }),
      'GET /api/account/passkeys': () => {
        if (failing) throw new TypeError('Failed to fetch');
        return { body: { passkeys: [{ id: 'k1', label: 'iCloud Keychain', createdAt: '2026-03-12T00:00:00.000Z', lastUsedAt: null }] } };
      },
      'GET /api/account/recovery-email': () => ({ body: { email: null, pending: null } }),
    });
    renderAccount(bareStore(), { client });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/offline, or Estante is unreachable/);

    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('iCloud Keychain')).toBeInTheDocument());
  });
});

describe('Signing out of this device (account.sign_out; workflow 13 §Signing out)', () => {
  const AUTHOR = { id: 'u_tester', name: 'A Tester' };
  const FENCE = '```';
  const songText = (lines) => lines.join('\n') + '\n';

  // A worker-backed store over fake-indexeddb + web-locks + loopback git remotes
  // (each put-online book gets its own empty bare remote, the shape the service
  // creates). Captures raw events for the seeding steps that reply with a
  // transient event rather than a slice (BOOK_CREATED / BOOK_ONLINE).
  function workerStoreOnline() {
    const idb = new IDBFactory();
    const name = `acct-online-${rand()}`;
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

  // A hosted book carrying BOTH kinds of local-only work: one unsaved working
  // song, and one local commit not yet pushed (its remote is stopped right after
  // put-online so no sync pass can push it). Returns the service id.
  async function hostedBookWithLocalWork(ctx, title, term) {
    const localId = await createBook(ctx, title);
    ctx.store.send(command(CommandKind.OPEN));
    await waitFor(() => expect(ctx.store.slice('index')?.[localId]).toBe('ready'));
    const path = `${term}.cifra.md`;
    ctx.store.send(
      command(CommandKind.WRITE, {
        bookId: localId,
        path,
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

  function signedInClient(over = {}) {
    return makeAuthClient({
      'GET /api/account/sessions': () => ({
        body: {
          sessions: [{ id: 's1', current: true, lastUsedAt: '2026-10-12T10:00:00.000Z', device: 'Chrome on Linux' }],
        },
      }),
      'GET /api/account/passkeys': () => ({ body: { passkeys: [] } }),
      'GET /api/account/recovery-email': () => ({ body: { email: null, pending: null } }),
      'POST /api/auth/signout': () => ({ status: 204 }),
      ...over,
    });
  }

  const openDialog = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out of this device' }));
    return screen.findByRole('dialog');
  };

  const shelfVisible = (store) => {
    const shelf = store.slice('shelf') ?? {};
    const live = (map) => Object.entries(map ?? {}).filter(([, b]) => (b?.label?.value ?? b?.title?.value) != null);
    return { shared: live(shelf.books), local: live(shelf.local) };
  };

  it('surveys this device and shows the per-book counts and the download guard, axe clean', async () => {
    const ctx = workerStoreOnline();
    await hostedBookWithLocalWork(ctx, 'Banda do Bairro', 'bairro');
    await createBook(ctx, 'Só aqui'); // a purely-local book → the download guard

    const { client } = signedInClient();
    const { container } = renderAccount(ctx.store, { client });
    const dialog = await openDialog();

    expect(within(dialog).getByText('Sign out of this device?')).toBeInTheDocument();
    await within(dialog).findByText(/unsaved changes in 1 song/);
    expect(within(dialog).getByText(/1 save not yet pushed/)).toBeInTheDocument();
    expect(within(dialog).getByText(/is only on this device/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Download Só aqui/ })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('Remove tears the account’s books off the shelf, then POSTs signout', async () => {
    const ctx = workerStoreOnline();
    const shared = await hostedBookWithLocalWork(ctx, 'Banda do Bairro', 'bairro');
    await createBook(ctx, 'Só aqui');

    const { client, calls } = signedInClient();
    let returned = 0;
    renderAccount(ctx.store, { client, onSignOut: () => (returned += 1) });
    const dialog = await openDialog();
    await within(dialog).findByText(/unsaved changes in 1 song/);

    // Remove is the default; its confirm names the action.
    expect(within(dialog).getByRole('radio', { name: /Remove this account’s books/ })).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out and remove' }));

    // The teardown empties the shelf of both the shared and the local book…
    await waitFor(() => {
      const { shared: s, local: l } = shelfVisible(ctx.store);
      expect(s).toHaveLength(0);
      expect(l).toHaveLength(0);
    });
    // …then the session is cleared and the surface returns to not-signed-in.
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/api/auth/signout')).toBe(true));
    await waitFor(() => expect(returned).toBe(1));
    expect(ctx.store.slice('shelf').books[shared].label.value).toBeNull();
  });

  it('Keep turns the account’s books into local books, then POSTs signout', async () => {
    const ctx = workerStoreOnline();
    const shared = await hostedBookWithLocalWork(ctx, 'Banda do Bairro', 'bairro');

    const { client, calls } = signedInClient();
    let returned = 0;
    renderAccount(ctx.store, { client, onSignOut: () => (returned += 1) });
    const dialog = await openDialog();
    await within(dialog).findByText(/unsaved changes in 1 song/);

    fireEvent.click(within(dialog).getByRole('radio', { name: /Keep them here/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out and keep' }));

    // The shared book stays on the shelf, now as a local book.
    await waitFor(() => {
      const shelf = ctx.store.slice('shelf');
      expect(shelf.books[shared].label.value).toBeNull();
      expect(shelf.local[shared].title.value).toBe('Banda do Bairro');
    });
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/api/auth/signout')).toBe(true));
    await waitFor(() => expect(returned).toBe(1));
  });

  it('Cancel closes the dialog and changes nothing', async () => {
    const ctx = workerStoreOnline();
    const shared = await hostedBookWithLocalWork(ctx, 'Banda do Bairro', 'bairro');

    const { client, calls } = signedInClient();
    let returned = 0;
    renderAccount(ctx.store, { client, onSignOut: () => (returned += 1) });
    const dialog = await openDialog();
    await within(dialog).findByText(/unsaved changes in 1 song/);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(returned).toBe(0);
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/auth/signout')).toBe(false);
    // The book is still on the shelf as a hosted book — nothing was torn down.
    expect(ctx.store.slice('shelf').books[shared].label.value).toBe('Banda do Bairro');
  });
});

describe('A full keyboard path (acceptance; standing a11y rule)', () => {
  it('every interactive control on the not-signed-in surface takes focus', async () => {
    const { client } = signedOut();
    renderAccount(bareStore(), { client });

    await screen.findByText('Not signed in');
    for (const name of ['Back', 'Use a passkey', 'Email me a link']) {
      const el = screen.getByRole('button', { name });
      el.focus();
      expect(el).toHaveFocus();
    }
    // The pickers are reachable radiogroups with focusable radios.
    const palco = screen.getByRole('radio', { name: /Palco/ });
    palco.focus();
    expect(palco).toHaveFocus();
  });
});

describe('Leaving Estante region (account.leaving; workflow 17 §Where leaving lives)', () => {
  const sharingDouble = { listMembers: async () => ({ members: [], count: 0, limit: 50 }) };

  function signedInClient() {
    return makeAuthClient({
      'GET /api/account/sessions': () => ({
        body: { sessions: [{ id: 's1', current: true, lastUsedAt: '2026-10-12T10:00:00.000Z', device: 'Chrome on Linux' }] },
      }),
      'GET /api/account/passkeys': () => ({ body: { passkeys: [] } }),
      'GET /api/account/recovery-email': () => ({ body: { email: null, pending: null } }),
    });
  }

  it('renders at the foot of the signed-in screen, below Passkeys, with the two affordances in order, axe clean', async () => {
    const { client } = signedInClient();
    const { container } = renderAccount(bareStore(), { client, sharingClient: sharingDouble });

    // Present only when signed in: its heading and copy.
    expect(await screen.findByText('Leaving Estante')).toBeInTheDocument();
    expect(
      screen.getByText('Take a copy of everything you hold here, then end your account if you want to.'),
    ).toBeInTheDocument();

    // Two affordances, data-out before the danger delete (the deliberate order).
    const takeData = screen.getByRole('button', { name: 'Take your data out' });
    const deleteAcct = screen.getByRole('button', { name: 'Delete my account' });
    expect(takeData).toBeInTheDocument();
    expect(deleteAcct).toBeInTheDocument();
    expect(takeData.compareDocumentPosition(deleteAcct) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Below Passkeys (the Passkeys head precedes the Leaving head in the document).
    const passkeysHead = screen.getByText('Passkeys');
    const leavingHead = screen.getByText('Leaving Estante');
    expect(passkeysHead.compareDocumentPosition(leavingHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('is absent from the not-signed-in card (there is no account to leave)', async () => {
    const { client } = signedOut();
    renderAccount(bareStore(), { client, sharingClient: sharingDouble });

    await screen.findByText('Not signed in');
    expect(screen.queryByText('Leaving Estante')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete my account' })).toBeNull();
  });
});

// behavior (account.recovery_email) — the Recovery email region and the last way
// in, through the real screen with an injected loopback auth-client. Pins
// workflow 13 §The recovery email L41–68, §The last way in L70–76 and §The
// account screen L133–142; board Recovery-email.dc.html Phone 1, Phone 2 and
// Tablet (the account card). Shapes are pinned structurally against
// api/openapi.yaml: RecoveryEmail { email|null, pending|null } and the request
// body { email } ([[api-validate-js-breaks-under-vite]]).
describe('Recovery email', () => {
  const sharingDouble = { listMembers: async () => ({ members: [], count: 0, limit: 50 }) };
  const SESSION = { id: 's1', current: true, lastUsedAt: '2026-10-12T10:00:00.000Z', device: 'Chrome on Linux' };
  const key = (id, label) => ({ id, label, createdAt: '2026-03-12T00:00:00.000Z', lastUsedAt: null });

  // A signed-in double whose recovery email is held in `state` and moves to
  // `pending` on an accepted request, as the service does (always 202).
  function recoveryClient({ email = null, pending = null, passkeys = [key('k1', 'iCloud Keychain')], routes = {} } = {}) {
    const state = { email, pending };
    const list = [...passkeys];
    const { client, calls } = makeAuthClient({
      'GET /api/account/sessions': () => ({ body: { sessions: [SESSION] } }),
      'GET /api/account/passkeys': () => ({ body: { passkeys: [...list] } }),
      'GET /api/account/recovery-email': () => ({ body: { ...state } }),
      'POST /api/account/recovery-email': ({ body }) => {
        state.pending = body.email;
        return { status: 202 };
      },
      ...routes,
    });
    return { client, calls, state };
  }

  const region = () => screen.getByRole('region', { name: 'Recovery email' });
  const recoveryPosts = (calls) =>
    calls.filter((c) => c.method === 'POST' && c.path === '/api/account/recovery-email');

  it('is present only when signed in, below Passkeys and above Leaving Estante', async () => {
    const { client } = recoveryClient();
    renderAccount(bareStore(), { client, sharingClient: sharingDouble });

    await screen.findByText('No recovery email');
    const passkeysHead = screen.getByText('Passkeys');
    const recoveryHead = within(region()).getByRole('heading', { name: 'Recovery email' });
    const leavingHead = screen.getByText('Leaving Estante');
    expect(passkeysHead.compareDocumentPosition(recoveryHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(recoveryHead.compareDocumentPosition(leavingHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is absent when not signed in', async () => {
    const { client } = signedOut();
    renderAccount(bareStore(), { client, sharingClient: sharingDouble });
    await screen.findByText('Not signed in');
    expect(screen.queryByRole('region', { name: 'Recovery email' })).toBeNull();
  });

  it('none: the badge word, the warning and the field; sending posts {email} and lands in waiting, axe clean', async () => {
    const { client, calls } = recoveryClient();
    const { container } = renderAccount(bareStore(), { client, sharingClient: sharingDouble });

    expect(await screen.findByText('No recovery email')).toBeInTheDocument();
    expect(screen.getByText('If you lose every device with a passkey, there is no way back in.')).toBeInTheDocument();
    const field = within(region()).getByRole('textbox', { name: 'Recovery email' });
    expect(field).toHaveValue('');
    expect(
      screen.getByText('Used only to email you a sign-in link. Shown here, to you, and nowhere else.'),
    ).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.change(field, { target: { value: 'ana@example.com' } });
    fireEvent.click(within(region()).getByRole('button', { name: 'Send a verification link' }));

    expect(await screen.findByText('Waiting for you to confirm')).toBeInTheDocument();
    const posts = recoveryPosts(calls);
    expect(posts).toHaveLength(1);
    expect(Object.keys(posts[0].body)).toEqual(['email']);
    expect(posts[0].body.email).toBe('ana@example.com');

    // Waiting names the address, with Send again and Use a different address.
    expect(region()).toHaveTextContent('We sent a verification link to ana@example.com. Check your inbox and open it.');
    expect(region()).toHaveTextContent('nothing changes and the account still has no recovery email.');
    expect(within(region()).getByRole('button', { name: 'Send again' })).toBeInTheDocument();
    expect(within(region()).getByRole('button', { name: 'Use a different address' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('Send again re-posts the pending address; Use a different address returns to the field', async () => {
    const { client, calls } = recoveryClient({ pending: 'ana@example.com' });
    renderAccount(bareStore(), { client, sharingClient: sharingDouble });

    fireEvent.click(await screen.findByRole('button', { name: 'Send again' }));
    await waitFor(() => expect(recoveryPosts(calls)).toHaveLength(1));
    expect(recoveryPosts(calls)[0].body).toEqual({ email: 'ana@example.com' });

    fireEvent.click(await screen.findByRole('button', { name: 'Use a different address' }));
    const field = within(region()).getByRole('textbox', { name: 'Recovery email' });
    expect(field).toHaveValue('');
    expect(within(region()).queryByRole('button', { name: 'Send again' })).toBeNull();
    fireEvent.change(field, { target: { value: 'bia@example.com' } });
    fireEvent.click(within(region()).getByRole('button', { name: 'Send a verification link' }));
    await waitFor(() => expect(recoveryPosts(calls)).toHaveLength(2));
    expect(recoveryPosts(calls)[1].body).toEqual({ email: 'bia@example.com' });
    expect(await screen.findByRole('button', { name: 'Send again' })).toBeInTheDocument();
  });

  it('confirmed: the address with its Confirmed badge; Change opens the field, axe clean', async () => {
    const { client } = recoveryClient({ email: 'ana@example.com' });
    const { container } = renderAccount(bareStore(), { client, sharingClient: sharingDouble });

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    expect(within(region()).getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Gets a sign-in link when you ask for one. Shown only to you.')).toBeInTheDocument();
    expect(within(region()).queryByRole('textbox')).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(within(region()).getByRole('button', { name: 'Change' }));
    const field = within(region()).getByRole('textbox', { name: 'Recovery email' });
    expect(field).toHaveValue(''); // not prefilled
    expect(within(region()).getByRole('button', { name: 'Send a verification link' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Changing it keeps this address in effect until the new one is confirmed; this address then gets a short notice that it was changed.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(region()).getByRole('button', { name: 'Cancel' }));
    expect(within(region()).queryByRole('textbox')).toBeNull();
  });

  it('confirmed+waiting: the confirmed address stays shown above the waiting block, axe clean', async () => {
    const { client } = recoveryClient({ email: 'ana@example.com', pending: 'bia@example.com' });
    const { container } = renderAccount(bareStore(), { client, sharingClient: sharingDouble });

    expect(await screen.findByText('Waiting for you to confirm')).toBeInTheDocument();
    const confirmedAddress = within(region()).getByText('ana@example.com', { selector: '.t-h2' });
    const waitingBadge = within(region()).getByText('Waiting for you to confirm');
    expect(within(region()).getByText('Confirmed')).toBeInTheDocument();
    expect(confirmedAddress.compareDocumentPosition(waitingBadge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(region()).toHaveTextContent('We sent a verification link to bia@example.com.');
    expect(region()).toHaveTextContent('nothing changes and ana@example.com stays your recovery email.');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a 429 is worded "Too many tries — try again shortly."; a 400 is the invalid-address word', async () => {
    let answer = { status: 429, body: { code: 'rate_limited', message: 'Too many requests. Try again shortly.' } };
    const { client } = recoveryClient({ routes: { 'POST /api/account/recovery-email': () => answer } });
    renderAccount(bareStore(), { client, sharingClient: sharingDouble });

    const field = await within(await screen.findByRole('region', { name: 'Recovery email' })).findByRole('textbox', {
      name: 'Recovery email',
    });
    fireEvent.change(field, { target: { value: 'ana@example.com' } });
    fireEvent.click(within(region()).getByRole('button', { name: 'Send a verification link' }));
    expect(await within(region()).findByRole('alert')).toHaveTextContent('Too many tries — try again shortly.');
    // The region stays usable.
    expect(within(region()).getByRole('button', { name: 'Send a verification link' })).toBeEnabled();

    answer = { status: 400, body: { code: 'bad_request', message: 'The request body did not conform.' } };
    fireEvent.click(within(region()).getByRole('button', { name: 'Send a verification link' }));
    await waitFor(() =>
      expect(within(region()).getByRole('alert')).toHaveTextContent('That does not look like an email address.'),
    );
  });

  it('offline: every region button is disabled, with the When offline note, axe clean', async () => {
    const { client } = recoveryClient({ pending: 'ana@example.com' });
    const { container } = renderAccount(bareStore(), { client, sharingClient: sharingDouble });
    await screen.findByText('Waiting for you to confirm');

    await act(async () => {
      globalThis.dispatchEvent(new Event('offline'));
    });

    expect(within(region()).getByText('When offline')).toBeInTheDocument();
    expect(
      within(region()).getByText(
        'The recovery email needs a connection, like signing in. Its buttons wait until you are back online; your songs do not.',
      ),
    ).toBeInTheDocument();
    for (const button of within(region()).getAllByRole('button')) expect(button).toBeDisabled();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    await act(async () => {
      globalThis.dispatchEvent(new Event('online'));
    });
  });

  describe('the last way in (workflow 13 L70–76)', () => {
    const SENTENCE = 'Your only way to sign in — add a recovery email or another passkey first.';

    it('one passkey and no email: no Remove, the badge and the sentence, axe clean', async () => {
      const { client } = recoveryClient();
      const { container } = renderAccount(bareStore(), { client, sharingClient: sharingDouble });
      await screen.findByText('No recovery email');
      expect(screen.getByText('iCloud Keychain')).toBeInTheDocument();
      expect(screen.getByText('last way in')).toBeInTheDocument();
      expect(screen.getByText(SENTENCE)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove iCloud Keychain' })).toBeNull();
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });

    it('a pending address does not lift it', async () => {
      const { client } = recoveryClient({ pending: 'ana@example.com' });
      renderAccount(bareStore(), { client, sharingClient: sharingDouble });
      await screen.findByText('Waiting for you to confirm');
      expect(screen.getByText('last way in')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove iCloud Keychain' })).toBeNull();
    });

    it('two passkeys: both have Remove', async () => {
      const { client } = recoveryClient({ passkeys: [key('k1', 'iCloud Keychain'), key('k2', 'Windows Hello')] });
      renderAccount(bareStore(), { client, sharingClient: sharingDouble });
      await screen.findByText('No recovery email');
      expect(screen.getByRole('button', { name: 'Remove iCloud Keychain' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove Windows Hello' })).toBeInTheDocument();
      expect(screen.queryByText('last way in')).toBeNull();
    });

    it('a confirmed email and one passkey: Remove is present', async () => {
      const { client } = recoveryClient({ email: 'ana@example.com' });
      renderAccount(bareStore(), { client, sharingClient: sharingDouble });
      await screen.findByText('Confirmed');
      expect(screen.getByRole('button', { name: 'Remove iCloud Keychain' })).toBeInTheDocument();
      expect(screen.queryByText('last way in')).toBeNull();
    });

    it('a remove answered 409 last_way_in is worded with the sentence, not errNetwork, and reloads', async () => {
      const { client, calls } = recoveryClient({
        passkeys: [key('k1', 'iCloud Keychain'), key('k2', 'Windows Hello')],
        routes: {
          'DELETE /api/account/passkeys/k1': () => ({
            status: 409,
            body: { code: 'last_way_in', message: "This is the account's last passkey and it has no recovery email." },
          }),
        },
      });
      renderAccount(bareStore(), { client, sharingClient: sharingDouble });

      fireEvent.click(await screen.findByRole('button', { name: 'Remove iCloud Keychain' }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(SENTENCE));
      expect(screen.queryByText(/offline, or Estante is unreachable/)).toBeNull();
      await waitFor(() =>
        expect(calls.filter((c) => c.path === '/api/account/passkeys' && c.method === 'GET')).toHaveLength(2),
      );
      expect(calls.filter((c) => c.path === '/api/account/recovery-email' && c.method === 'GET')).toHaveLength(2);
    });
  });
});

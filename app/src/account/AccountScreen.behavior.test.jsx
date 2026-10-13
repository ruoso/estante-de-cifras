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
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import { createStore } from '../worker/store.js';
import { createWorkerLogic } from '../worker/logic.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
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
beforeEach(() => {
  restoreLocks = installWebLocks();
  installMatchMedia();
  setLocale('en');
});
afterEach(() => {
  restoreLocks();
  delete globalThis.matchMedia;
  uninstallWebAuthn();
  setLocale('en');
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

  it('the current device’s sign-out invokes the onSignOut seam, not a revoke', async () => {
    const { client, calls } = signedInClient();
    let signedOutHere = 0;
    renderAccount(bareStore(), { client, onSignOut: () => (signedOutHere += 1) });

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out of this device' }));
    expect(signedOutHere).toBe(1);
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
    });
    renderAccount(bareStore(), { client });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/offline, or Estante is unreachable/);

    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('iCloud Keychain')).toBeInTheDocument());
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

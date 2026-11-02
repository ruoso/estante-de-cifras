// behavior (reader.pair_web) — the Pair a device page driven through its real
// collaborators: real React Aria Components, real i18n, the real SignIn surface
// for the signed-out state, and an injected loopback auth client (the
// AccountScreen.behavior.test.jsx L47–68 pattern). Pins workflow 13 §Pairing a
// reMarkable — §Not signed in L356–364, §The page L366–402, §A code that does not
// pair L404–416 — and board Pair-a-device.dc.html; every state is checked
// axe-clean at WCAG 2.1 AA. The request body is pinned structurally against
// api/openapi.yaml approveDevicePairing (`{ code }`), not via api/validate.js
// ([[api-validate-js-breaks-under-vite]]).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import { createAuthClient } from './auth-client.js';
import PairDevice from './PairDevice.jsx';

const APPROVE = 'POST /api/devices/pair/approve';
const SESSIONS = 'GET /api/account/sessions';

const PAIRED = 'Your reMarkable is paired. Its shelf appears on it in a moment.';
const MALFORMED = 'A code is six letters and numbers, like KQ7-4TM.';
const OFFLINE = 'You’re offline. Pairing needs a connection.';
const LEAD = 'Sign in to the account whose books the reMarkable should read.';

// A loopback fetch double: route by "METHOD /path", record every call with its
// parsed JSON body; a handler sets the status/body.
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

const signedIn = (over = {}) =>
  makeAuthClient({
    [SESSIONS]: () => ({ body: { sessions: [] } }),
    [APPROVE]: () => ({ status: 204 }),
    ...over,
  });

const approvals = (calls) => calls.filter((c) => `${c.method} ${c.path}` === APPROVE);

function setOnline(value) {
  Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, get: () => value });
  act(() => {
    globalThis.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

// The platform WebAuthn surface for Make an account (jsdom has none), as in
// AccountScreen.behavior.test.jsx.
function installWebAuthn() {
  const PublicKeyCredential = function PublicKeyCredential() {};
  PublicKeyCredential.parseCreationOptionsFromJSON = (json) => json;
  PublicKeyCredential.parseRequestOptionsFromJSON = (json) => json;
  globalThis.PublicKeyCredential = PublicKeyCredential;
  Object.defineProperty(globalThis.navigator, 'credentials', {
    configurable: true,
    value: {
      create: async () => ({
        id: 'cred_1',
        type: 'public-key',
        authenticatorAttachment: 'platform',
        toJSON() {
          return { id: 'cred_1', rawId: 'cred_1', type: 'public-key', response: {}, clientExtensionResults: {} };
        },
      }),
    },
  });
}

beforeEach(() => setLocale('en'));
afterEach(() => {
  delete globalThis.navigator.onLine;
  delete globalThis.PublicKeyCredential;
  if (Object.getOwnPropertyDescriptor(globalThis.navigator, 'credentials')) delete globalThis.navigator.credentials;
});

async function codeField() {
  return screen.findByRole('textbox', { name: 'Code' });
}

describe('PairDevice — a code approved (workflow 13 §The page L366–402)', () => {
  it('kq7 4tm typed, Enter: one approve with {code}; the paired line and Done, which opens the account screen; axe clean before and after', async () => {
    const { client, calls } = signedIn();
    let opened = 0;
    const { container } = render(<PairDevice authClient={client} onOpenAccount={() => (opened += 1)} />);

    const field = await codeField();
    // The page's heading is the h1 focus lands on (Constraint 12).
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Pair a device' })).toHaveFocus());
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.change(field, { target: { value: ' kq7 4tm ' } });
    fireEvent.submit(field.closest('form'));

    expect(await screen.findByText(PAIRED)).toBeInTheDocument();
    expect(approvals(calls)).toEqual([{ method: 'POST', path: '/api/devices/pair/approve', body: { code: 'kq7 4tm' } }]);
    expect(screen.queryByRole('textbox', { name: 'Code' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(opened).toBe(1);
  });

  it('Back calls the close seam', async () => {
    const { client } = signedIn();
    let closed = 0;
    render(<PairDevice authClient={client} onClose={() => (closed += 1)} />);
    await codeField();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(closed).toBe(1);
  });
});

describe('PairDevice — what it can do (workflow 13 L376–385, L393–396)', () => {
  it('the heading, the body and the warning line are said as text, and no dialog', async () => {
    const { client } = signedIn();
    render(<PairDevice authClient={client} />);
    await codeField();
    expect(screen.getByText('Enter the code your reMarkable shows.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What your reMarkable will be able to do.' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Read every book on your shelf, with your instruments and preferences. It can never change one: it saves nothing and sends nothing back. It stays paired until you sign it out, here or on the reMarkable.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Only enter a code shown on your own reMarkable, in front of you: whoever’s device shows it will read your books.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Six letters and numbers, like KQ7-4TM')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('PairDevice — each refusal said (workflow 13 §A code that does not pair L404–416)', () => {
  const REFUSALS = [
    [404, 'pair_code_unknown', 'No reMarkable is showing that code. Check it against its screen and try again.'],
    [410, 'pair_code_expired', 'That code has expired. Press Get a new code on your reMarkable, and enter the new one.'],
    [409, 'pair_code_used', 'That code was already used. If your reMarkable is not paired, press Get a new code on it.'],
    [429, 'rate_limited', 'Too many tries. Wait a few minutes and try again.'],
  ];

  for (const [status, code, words] of REFUSALS) {
    it(`${status} ${code}: said as the field's error, aria-invalid, focus in the field, its text kept; axe clean`, async () => {
      const { client, calls } = signedIn({ [APPROVE]: () => ({ status, body: { code, message: 'x' } }) });
      const { container } = render(<PairDevice authClient={client} />);

      const field = await codeField();
      fireEvent.change(field, { target: { value: 'KQ7-4TM' } });
      fireEvent.submit(field.closest('form'));

      const error = await screen.findByText(words);
      expect(approvals(calls)).toHaveLength(1);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(error.id || error.closest('[id]').id);
      await waitFor(() => expect(field).toHaveFocus());
      expect(field).toHaveValue('KQ7-4TM');
      expect(screen.queryByText(PAIRED)).toBeNull();
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });
  }
});

describe('PairDevice — malformed (workflow 13 L390–392)', () => {
  it('KQ7-4T: the malformed line under the field, and no request', async () => {
    const { client, calls } = signedIn();
    render(<PairDevice authClient={client} />);

    const field = await codeField();
    fireEvent.change(field, { target: { value: 'KQ7-4T' } });
    fireEvent.submit(field.closest('form'));

    expect(await screen.findByText(MALFORMED)).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveValue('KQ7-4T');
    expect(approvals(calls)).toHaveLength(0);
  });
});

describe('PairDevice — offline (workflow 13 L401–402)', () => {
  it('offline: the button disabled, the offline line, the typed text kept; online again enables it', async () => {
    const { client, calls } = signedIn();
    const { container } = render(<PairDevice authClient={client} />);

    const field = await codeField();
    fireEvent.change(field, { target: { value: 'kq7 4tm' } });
    setOnline(false);

    expect(await screen.findByText(OFFLINE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pair your reMarkable' })).toBeDisabled();
    expect(field).toHaveValue('kq7 4tm');
    fireEvent.submit(field.closest('form'));
    expect(approvals(calls)).toHaveLength(0);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    setOnline(true);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pair your reMarkable' })).toBeEnabled());
    expect(screen.queryByText(OFFLINE)).toBeNull();
    expect(field).toHaveValue('kq7 4tm');
  });
});

describe('PairDevice — signed out (workflow 13 §Not signed in L356–364)', () => {
  it('a 401 probe: the lead above the sign-in surface’s two doors, no Code field; a sign-in made there goes on to the code; axe clean', async () => {
    installWebAuthn();
    let session = false;
    const { client } = makeAuthClient({
      [SESSIONS]: () => (session ? { body: { sessions: [] } } : { status: 401 }),
      'POST /api/auth/passkey/register/begin': () => ({ body: { publicKey: {}, state: 'st' } }),
      'POST /api/auth/passkey/register/finish': () => {
        session = true;
        return { body: { id: 'acct_1' } };
      },
      'GET /api/account/recovery-email': () => ({ body: { email: null, pending: null } }),
      [APPROVE]: () => ({ status: 204 }),
    });
    const signedInWith = [];
    const { container } = render(
      <PairDevice authClient={client} onSignedIn={(account) => signedInWith.push(account)} />,
    );

    expect(await screen.findByText(LEAD)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Pair a device' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use a passkey' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email me a link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make an account' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Code' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Make an account' }));

    expect(await codeField()).toBeInTheDocument();
    expect(signedInWith).toEqual([{ id: 'acct_1' }]);
    expect(screen.queryByText(LEAD)).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a 401 on the press (the session ended under the page) shows the sign-in surface', async () => {
    const { client } = signedIn({ [APPROVE]: () => ({ status: 401 }) });
    render(<PairDevice authClient={client} />);

    const field = await codeField();
    fireEvent.change(field, { target: { value: 'KQ7-4TM' } });
    fireEvent.submit(field.closest('form'));

    expect(await screen.findByText(LEAD)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Code' })).toBeNull();
  });
});

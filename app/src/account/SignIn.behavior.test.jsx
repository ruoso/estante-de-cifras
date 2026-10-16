// behavior (account.sign_in) — the sign-in surface driven through its real
// collaborators: real React Aria Components, real i18n, a stubbed
// `navigator.credentials` + `PublicKeyCredential` (jsdom provides neither), and
// a loopback `fetch` double standing in for the service. Each ceremony is driven
// end to end and `onSignedIn` is asserted with the returned `Account`; every
// step is checked axe-clean at WCAG 2.1 AA.
//
// Pins workflow 13 §Signing in on another device, workflow 7 §Signing in and
// mockup W13 (the copy and the two methods), and the request/response shapes.
//
// NOTE on the shapes: the refinement names `api/validate.js` as the contract
// oracle, but that module cannot load under Vite — its module-top
// `fileURLToPath(new URL('./openapi.yaml', import.meta.url))` throws because Vite
// does not hand external modules a `file://` `import.meta.url`. The app and the
// service share no code (DIRECTION §3.6), and adding a JSON-Schema validator to
// `app/` would be a new dependency (forbidden). So the client's wire shapes are
// pinned here structurally against the contract schemas (api/openapi.yaml):
// EmailLinkRequest `{ email }` (927-935), EmailLinkRedeemRequest `{ token }`
// (937-944), PasskeyRegisterBeginRequest `{ label? }` (861), PasskeyFinishRequest
// `{ state, credential, label? }` (909-925), PasskeyAuthenticateBeginRequest `{}`
// (903-907) and Account `{ id }` (852-859). The e2e-api suite validates the
// service side against the live contract.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import { createAuthClient } from './auth-client.js';
import SignIn from './SignIn.jsx';

const rand = () => Math.random().toString(36).slice(2);

// A loopback fetch double: route by "METHOD /path", record every call (with its
// parsed JSON body), and let a handler set the status/body — or throw, to model
// an unreachable service.
function makeClient(routes) {
  const calls = [];
  const fetch = async (path, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    const call = { method, path, body };
    calls.push(call);
    const handler = routes[`${method} ${path}`];
    if (!handler) throw new Error(`no route for ${method} ${path}`);
    const result = handler(call); // may throw to simulate offline / a 5xx
    const status = result.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => result.body };
  };
  return { client: createAuthClient({ fetch }), calls };
}

function callTo(calls, method, path) {
  return calls.find((c) => c.method === method && c.path === path);
}

// Assert an object carries only keys the contract schema allows, and every
// required one — the structural stand-in for api/validate.js (see header note).
function expectShape(obj, { allowed, required = [] }) {
  expect(obj, 'a body is sent').toBeTruthy();
  for (const key of Object.keys(obj)) {
    expect(allowed, `unexpected key "${key}"`).toContain(key);
  }
  for (const key of required) {
    expect(Object.keys(obj), `missing required key "${key}"`).toContain(key);
  }
}

// Stub the platform WebAuthn surface. `parse*OptionsFromJSON` is identity here
// (the service's JSON passes straight through in the double), and a credential
// carries a `toJSON()` and the attachment the offer rule reads.
function installWebAuthn({ attachment = 'platform', create, get } = {}) {
  const PublicKeyCredential = function PublicKeyCredential() {};
  PublicKeyCredential.parseCreationOptionsFromJSON = (json) => json;
  PublicKeyCredential.parseRequestOptionsFromJSON = (json) => json;
  globalThis.PublicKeyCredential = PublicKeyCredential;
  const makeCred = () => {
    const id = `cred_${rand()}`;
    return {
      id,
      type: 'public-key',
      authenticatorAttachment: attachment,
      toJSON() {
        return { id, rawId: id, type: 'public-key', response: {}, clientExtensionResults: {} };
      },
    };
  };
  Object.defineProperty(globalThis.navigator, 'credentials', {
    configurable: true,
    value: { create: create ?? (async () => makeCred()), get: get ?? (async () => makeCred()) },
  });
}

function uninstallWebAuthn() {
  delete globalThis.PublicKeyCredential;
  if (Object.getOwnPropertyDescriptor(globalThis.navigator, 'credentials')) {
    delete globalThis.navigator.credentials;
  }
}

beforeEach(() => setLocale('en'));
afterEach(() => {
  uninstallWebAuthn();
  setLocale('en');
});

const OPTIONS = { publicKey: { challenge: 'c', rp: { id: '127.0.0.1' } }, state: 's' };

describe('the sign-in surface (behavior)', () => {
  it('renders the workflow-13 sign-in screen with its copy and the two methods, axe clean', async () => {
    const { client } = makeClient({});
    render(<SignIn authClient={client} />);

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(
      screen.getByText('Bring your books, instruments and preferences to this phone.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use a passkey' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email me a link' })).toBeInTheDocument();
    expect(screen.getByText(/No passkey here\?/)).toBeInTheDocument();

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('signs in with a passkey: authenticate begin → get → finish, then onSignedIn (platform → no offer)', async () => {
    installWebAuthn({ attachment: 'platform' });
    const { client, calls } = makeClient({
      'POST /api/auth/passkey/authenticate/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/authenticate/finish': () => ({ body: { id: 'u_signin' } }),
    });
    const onSignedIn = vi.fn();
    render(<SignIn authClient={client} onSignedIn={onSignedIn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use a passkey' }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith({ id: 'u_signin' }));
    // A platform assertion leaves a passkey resident here — no offer step.
    expect(screen.queryByRole('heading', { name: 'Make signing in quicker' })).toBeNull();

    // The shapes: begin takes no body, finish echoes the opaque state and the
    // credential JSON (PasskeyAuthenticateBeginRequest / PasskeyFinishRequest).
    expect(callTo(calls, 'POST', '/api/auth/passkey/authenticate/begin').body).toEqual({});
    const finish = callTo(calls, 'POST', '/api/auth/passkey/authenticate/finish').body;
    expectShape(finish, { allowed: ['state', 'credential', 'label'], required: ['state', 'credential'] });
    expect(finish.state).toBe('s');
    expect(finish.credential.type).toBe('public-key');
  });

  it('makes an account with a passkey in create intent: register begin → create → finish, then onSignedIn', async () => {
    installWebAuthn({ attachment: 'platform' });
    const { client, calls } = makeClient({
      'POST /api/auth/passkey/register/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/register/finish': () => ({ body: { id: 'u_new' } }),
    });
    const onSignedIn = vi.fn();
    render(<SignIn intent="create" authClient={client} onSignedIn={onSignedIn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use a passkey' }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith({ id: 'u_new' }));
    // A registration created a passkey here — no offer either.
    expect(screen.queryByRole('heading', { name: 'Make signing in quicker' })).toBeNull();

    expectShape(callTo(calls, 'POST', '/api/auth/passkey/register/begin').body, { allowed: ['label'] });
    expectShape(callTo(calls, 'POST', '/api/auth/passkey/register/finish').body, {
      allowed: ['state', 'credential', 'label'],
      required: ['state', 'credential'],
    });
  });

  it('emails a link: request → "Check your email", revealing nothing about the address, axe clean', async () => {
    const { client, calls } = makeClient({
      'POST /api/auth/email/request': () => ({ status: 202 }),
    });
    render(<SignIn authClient={client} />);

    fireEvent.click(screen.getByRole('button', { name: 'Email me a link' }));
    const input = await screen.findByRole('textbox', { name: 'Your email' });
    fireEvent.change(input, { target: { value: 'player@example.com' } });
    fireEvent.submit(document.querySelector('form.account-form'));

    await screen.findByRole('heading', { name: 'Check your email' });
    // The address is used only in the request body, never echoed on screen.
    expect(screen.queryByText(/player@example\.com/)).toBeNull();
    const request = callTo(calls, 'POST', '/api/auth/email/request').body;
    expectShape(request, { allowed: ['email'], required: ['email'] });
    expect(request.email).toBe('player@example.com');

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  // books.add_book_chooser Decision 4: the Add-a-book sheet's "No passkey here?
  // Email me a link" opens the surface straight at the email step, which reaches
  // an account only through its recovery email (workflow 13 L25-30).
  it('opens at the email step: initialStep="email" shows "Email me a link" with "Your email" focused, and sending reaches "Check your email", axe clean', async () => {
    const { client, calls } = makeClient({
      'POST /api/auth/email/request': () => ({ status: 202 }),
    });
    render(<SignIn intent="signIn" initialStep="email" authClient={client} />);

    expect(screen.getByRole('heading', { name: 'Email me a link' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
    const input = screen.getByRole('textbox', { name: 'Your email' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    fireEvent.change(input, { target: { value: 'player@example.com' } });
    fireEvent.submit(document.querySelector('form.account-form'));

    await screen.findByRole('heading', { name: 'Check your email' });
    expect(callTo(calls, 'POST', '/api/auth/email/request').body.email).toBe('player@example.com');
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('redeems an emailed link on boot, then shows the offer-a-passkey step, axe clean', async () => {
    const { client, calls } = makeClient({
      'POST /api/auth/email/redeem': () => ({ body: { id: 'u_mail' } }),
    });
    const onSignedIn = vi.fn();
    render(<SignIn redeemToken="tok_abc" authClient={client} onSignedIn={onSignedIn} />);

    await screen.findByRole('heading', { name: 'Make signing in quicker' });
    // Not signed out to the caller yet — the offer is shown first (Decision 5).
    expect(onSignedIn).not.toHaveBeenCalled();
    const redeem = callTo(calls, 'POST', '/api/auth/email/redeem').body;
    expectShape(redeem, { allowed: ['token'], required: ['token'] });
    expect(redeem.token).toBe('tok_abc');

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('registers a passkey from the offer step, then onSignedIn with the redeemed account', async () => {
    installWebAuthn({ attachment: 'platform' });
    const { client } = makeClient({
      'POST /api/auth/email/redeem': () => ({ body: { id: 'u_mail' } }),
      'POST /api/auth/passkey/register/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/register/finish': () => ({ body: { id: 'u_mail' } }),
    });
    const onSignedIn = vi.fn();
    render(<SignIn redeemToken="tok_abc" authClient={client} onSignedIn={onSignedIn} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add a passkey' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith({ id: 'u_mail' }));
  });

  it('declining the offer signs in anyway (Not now → onSignedIn)', async () => {
    const { client } = makeClient({
      'POST /api/auth/email/redeem': () => ({ body: { id: 'u_mail' } }),
    });
    const onSignedIn = vi.fn();
    render(<SignIn redeemToken="tok_abc" authClient={client} onSignedIn={onSignedIn} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith({ id: 'u_mail' }));
  });

  it('a cancelled passkey prompt returns to the method step with no error shouted', async () => {
    installWebAuthn({
      get: async () => {
        throw new DOMException('The operation was cancelled.', 'NotAllowedError');
      },
    });
    const { client } = makeClient({
      'POST /api/auth/passkey/authenticate/begin': () => ({ body: OPTIONS }),
    });
    const onSignedIn = vi.fn();
    render(<SignIn authClient={client} onSignedIn={onSignedIn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use a passkey' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Use a passkey' })).not.toBeDisabled(),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('a 401 on finish shows the worded passkey error and does not sign in', async () => {
    installWebAuthn({ attachment: 'platform' });
    const { client } = makeClient({
      'POST /api/auth/passkey/authenticate/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/authenticate/finish': () => ({ status: 401 }),
    });
    const onSignedIn = vi.fn();
    render(<SignIn authClient={client} onSignedIn={onSignedIn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use a passkey' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("That passkey didn’t work");
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('a redeem 401 shows the expired-link message and offers the email step again', async () => {
    const { client } = makeClient({
      'POST /api/auth/email/redeem': () => ({ status: 401 }),
    });
    render(<SignIn redeemToken="tok_dead" authClient={client} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This link has expired or has already been used');
    expect(screen.getByRole('textbox', { name: 'Your email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request a new link' })).toBeInTheDocument();
  });

  it('offers the passkey step after a cross-device assertion (authenticatorAttachment !== platform)', async () => {
    installWebAuthn({ attachment: 'cross-platform' });
    const { client } = makeClient({
      'POST /api/auth/passkey/authenticate/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/authenticate/finish': () => ({ body: { id: 'u_cd' } }),
    });
    const onSignedIn = vi.fn();
    render(<SignIn authClient={client} onSignedIn={onSignedIn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use a passkey' }));
    await screen.findByRole('heading', { name: 'Make signing in quicker' });
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('gives a keyboard path across the surface: tabbable controls, Enter moves to the email step', async () => {
    const { client } = makeClient({ 'POST /api/auth/email/request': () => ({ status: 202 }) });
    render(<SignIn authClient={client} />);

    // Every control on the method step takes focus.
    for (const name of ['Close', 'Use a passkey', 'Email me a link']) {
      const el = screen.getByRole('button', { name });
      el.focus();
      expect(el).toHaveFocus();
    }

    // Enter on "Email me a link" (a RAC Button) moves to the email step.
    const emailBtn = screen.getByRole('button', { name: 'Email me a link' });
    emailBtn.focus();
    fireEvent.keyDown(emailBtn, { key: 'Enter' });
    fireEvent.keyUp(emailBtn, { key: 'Enter' });

    const input = await screen.findByRole('textbox', { name: 'Your email' });
    input.focus();
    expect(input).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Send the link' })).toBeInTheDocument();
  });
});

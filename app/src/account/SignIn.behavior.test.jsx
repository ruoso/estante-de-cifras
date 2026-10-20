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
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import { createAuthClient } from './auth-client.js';
import SignIn from './SignIn.jsx';
import { InvitedLead, InvitedFooter } from './InvitedScreen.jsx';

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

const HEADING = 'Sign in or make an account';
const NEW_HERE_LINE =
  'Makes a new account with a passkey. Already have one? Sign in above. This would be a second, separate account.';

describe('the sign-in surface (behavior)', () => {
  // account.sign_in_two_doors; workflow 13 §Signing in, or making an account
  // (L10-39); W13 #1: one heading, two labelled sections in this order.
  it('the method step: "Sign in or make an account", then Already have an account? before New here?, axe clean', async () => {
    const { client } = makeClient({});
    render(<SignIn authClient={client} />);

    const heading = screen.getByRole('heading', { name: HEADING });
    expect(heading).toBeInTheDocument();
    await waitFor(() => expect(heading).toHaveFocus());

    const have = screen.getByRole('group', { name: 'Already have an account?' });
    const fresh = screen.getByRole('group', { name: 'New here?' });
    expect(within(have).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Use a passkey',
      'Email me a link',
    ]);
    expect(within(have).getByText(/No passkey here\?/)).toBeInTheDocument();
    expect(within(fresh).getAllByRole('button').map((b) => b.textContent)).toEqual(['Make an account']);
    expect(within(fresh).getByText(NEW_HERE_LINE)).toBeInTheDocument();
    // The two groups, in that order in the DOM.
    expect(have.compareDocumentPosition(fresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('Use a passkey signs in: authenticate begin → get → finish, onSignedIn once then onDone (platform → no offer, no recovery step)', async () => {
    installWebAuthn({ attachment: 'platform' });
    const { client, calls } = makeClient({
      'POST /api/auth/passkey/authenticate/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/authenticate/finish': () => ({ body: { id: 'u_signin' } }),
    });
    const order = [];
    const onSignedIn = vi.fn(() => order.push('signedIn'));
    const onDone = vi.fn(() => order.push('done'));
    render(<SignIn authClient={client} onSignedIn={onSignedIn} onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use a passkey' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(onSignedIn).toHaveBeenCalledWith({ id: 'u_signin' });
    expect(order).toEqual(['signedIn', 'done']);
    // A platform assertion leaves a passkey resident here — no offer step; and
    // signing in has no recovery step (workflow 13 L37-39).
    expect(screen.queryByRole('heading', { name: 'Make signing in quicker' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Add a recovery email' })).toBeNull();
    expect(calls.some((c) => c.path.includes('/register/'))).toBe(false);

    // The shapes: begin takes no body, finish echoes the opaque state and the
    // credential JSON (PasskeyAuthenticateBeginRequest / PasskeyFinishRequest).
    expect(callTo(calls, 'POST', '/api/auth/passkey/authenticate/begin').body).toEqual({});
    const finish = callTo(calls, 'POST', '/api/auth/passkey/authenticate/finish').body;
    expectShape(finish, { allowed: ['state', 'credential', 'label'], required: ['state', 'credential'] });
    expect(finish.state).toBe('s');
    expect(finish.credential.type).toBe('public-key');
  });

  // workflow 13 §Asked when the account is made (L106-120); Sign-in Phone 2.
  it('Make an account registers: onSignedIn with the account before "Add a recovery email" shows, its heading focused, no authenticate, axe clean', async () => {
    installWebAuthn({ attachment: 'platform' });
    const { client, calls } = makeClient({
      'POST /api/auth/passkey/register/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/register/finish': () => ({ body: { id: 'u_new' } }),
    });
    let stepShownAtSignIn = null;
    const onSignedIn = vi.fn(() => {
      stepShownAtSignIn = screen.queryByRole('heading', { name: 'Add a recovery email' }) !== null;
    });
    const onDone = vi.fn();
    render(<SignIn authClient={client} onSignedIn={onSignedIn} onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: 'Make an account' }));

    const step = await screen.findByRole('heading', { name: 'Add a recovery email' });
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(onSignedIn).toHaveBeenCalledWith({ id: 'u_new' });
    expect(stepShownAtSignIn).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    await waitFor(() => expect(step).toHaveFocus());
    // A registration created a passkey here — no offer.
    expect(screen.queryByRole('heading', { name: 'Make signing in quicker' })).toBeNull();
    expect(calls.some((c) => c.path.includes('/authenticate/'))).toBe(false);
    expect(screen.getByText('If you lose every device with a passkey, there is no way back in.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Recovery email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();

    expectShape(callTo(calls, 'POST', '/api/auth/passkey/register/begin').body, { allowed: ['label'] });
    expectShape(callTo(calls, 'POST', '/api/auth/passkey/register/finish').body, {
      allowed: ['state', 'credential', 'label'],
      required: ['state', 'credential'],
    });
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  async function madeAccount(routes = {}, props = {}) {
    installWebAuthn({ attachment: 'platform' });
    const made = makeClient({
      'POST /api/auth/passkey/register/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/register/finish': () => ({ body: { id: 'u_new' } }),
      ...routes,
    });
    const onDone = vi.fn();
    render(<SignIn authClient={made.client} onDone={onDone} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make an account' }));
    await screen.findByRole('heading', { name: 'Add a recovery email' });
    return { ...made, onDone };
  }

  function typeAndSend(address) {
    fireEvent.change(screen.getByRole('textbox', { name: 'Recovery email' }), { target: { value: address } });
    fireEvent.click(screen.getByRole('button', { name: 'Send link' }));
  }

  it('Send link posts { email } to the recovery-email route, then the waiting words name it, and Done → onDone, axe clean', async () => {
    const { calls, onDone } = await madeAccount({
      'POST /api/account/recovery-email': () => ({ status: 202 }),
    });
    typeAndSend('ana@example.com');

    await screen.findByText(/We sent a verification link to/);
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    const post = callTo(calls, 'POST', '/api/account/recovery-email').body;
    expectShape(post, { allowed: ['email'], required: ['email'] });
    expect(post.email).toBe('ana@example.com');
    expect(onDone).not.toHaveBeenCalled();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Not now → onDone, with no recovery-email request', async () => {
    const { calls, onDone } = await madeAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(calls.some((c) => c.path === '/api/account/recovery-email')).toBe(false);
  });

  it('a 400 says the address is not one; a 429 says too many tries (the region’s worded errors)', async () => {
    let status = 400;
    await madeAccount({
      'POST /api/account/recovery-email': () => ({ status, body: { code: status === 400 ? 'bad_request' : 'rate_limited' } }),
    });
    typeAndSend('ana@example');
    expect(await screen.findByRole('alert')).toHaveTextContent('That does not look like an email address.');

    status = 429;
    fireEvent.click(screen.getByRole('button', { name: 'Send link' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many tries'));
  });

  it('offline: Send link waits, the offline note says so, Not now stays enabled', async () => {
    const { onDone } = await madeAccount();
    act(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      window.dispatchEvent(new Event('offline'));
    });
    try {
      expect(screen.getByRole('button', { name: 'Send link' })).toBeDisabled();
      expect(screen.getByText(/The recovery email needs a connection/)).toBeInTheDocument();
      const notNow = screen.getByRole('button', { name: 'Not now' });
      expect(notNow).not.toBeDisabled();
      fireEvent.click(notNow);
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      delete navigator.onLine;
    }
  });

  // workflow 1 §Invited (L54-71); W01 #2: the invitation heads the surface.
  it('with the invitation as its lead: the invitation heading is focused, no book is named, the same two groups follow, and Make an account → the recovery step, axe clean', async () => {
    installWebAuthn({ attachment: 'platform' });
    const { client } = makeClient({
      'POST /api/auth/passkey/register/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/register/finish': () => ({ body: { id: 'u_new' } }),
    });
    const onSignedIn = vi.fn();
    render(
      <SignIn authClient={client} lead={<InvitedLead />} leadFooter={<InvitedFooter />} onSignedIn={onSignedIn} />,
    );

    const heading = screen.getByRole('heading', { name: 'You’re invited to a book on Estante' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.queryByRole('heading', { name: HEADING })).toBeNull();
    expect(screen.getByText('An account is a passkey')).toBeInTheDocument();
    expect(screen.getByText('Then the book goes on your shelf, and opens on its songs.')).toBeInTheDocument();
    const have = screen.getByRole('group', { name: 'Already have an account?' });
    const fresh = screen.getByRole('group', { name: 'New here?' });
    expect(have.compareDocumentPosition(fresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    fireEvent.click(within(fresh).getByRole('button', { name: 'Make an account' }));
    await screen.findByRole('heading', { name: 'Add a recovery email' });
    expect(onSignedIn).toHaveBeenCalledWith({ id: 'u_new' });
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
    render(<SignIn initialStep="email" authClient={client} />);

    expect(screen.getByRole('heading', { name: 'Email me a link' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: HEADING })).toBeNull();
    const input = screen.getByRole('textbox', { name: 'Your email' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    fireEvent.change(input, { target: { value: 'player@example.com' } });
    fireEvent.submit(document.querySelector('form.account-form'));

    await screen.findByRole('heading', { name: 'Check your email' });
    expect(callTo(calls, 'POST', '/api/auth/email/request').body.email).toBe('player@example.com');
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('redeems an emailed link on boot: onSignedIn at once, then the offer-a-passkey step, axe clean', async () => {
    const { client, calls } = makeClient({
      'POST /api/auth/email/redeem': () => ({ body: { id: 'u_mail' } }),
    });
    const onSignedIn = vi.fn();
    const onDone = vi.fn();
    render(<SignIn redeemToken="tok_abc" authClient={client} onSignedIn={onSignedIn} onDone={onDone} />);

    await screen.findByRole('heading', { name: 'Make signing in quicker' });
    // The session exists: handed out now; the offer is the last step (Decision 5).
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(onSignedIn).toHaveBeenCalledWith({ id: 'u_mail' });
    expect(onDone).not.toHaveBeenCalled();
    const redeem = callTo(calls, 'POST', '/api/auth/email/redeem').body;
    expectShape(redeem, { allowed: ['token'], required: ['token'] });
    expect(redeem.token).toBe('tok_abc');

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('registers a passkey from the offer step, then onDone — never a recovery step after the offer', async () => {
    installWebAuthn({ attachment: 'platform' });
    const { client } = makeClient({
      'POST /api/auth/email/redeem': () => ({ body: { id: 'u_mail' } }),
      'POST /api/auth/passkey/register/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/register/finish': () => ({ body: { id: 'u_mail' } }),
    });
    const onSignedIn = vi.fn();
    const onDone = vi.fn();
    render(<SignIn redeemToken="tok_abc" authClient={client} onSignedIn={onSignedIn} onDone={onDone} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add a passkey' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Add a recovery email' })).toBeNull();
  });

  it('declining the offer after a redeemed link ends the surface (Not now → onDone), with no recovery step', async () => {
    const { client } = makeClient({
      'POST /api/auth/email/redeem': () => ({ body: { id: 'u_mail' } }),
    });
    const onSignedIn = vi.fn();
    const onDone = vi.fn();
    render(<SignIn redeemToken="tok_abc" authClient={client} onSignedIn={onSignedIn} onDone={onDone} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Add a recovery email' })).toBeNull();
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
    expect(screen.getByRole('heading', { name: HEADING })).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: HEADING })).toBeInTheDocument();
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
    const onDone = vi.fn();
    render(<SignIn authClient={client} onSignedIn={onSignedIn} onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use a passkey' }));
    await screen.findByRole('heading', { name: 'Make signing in quicker' });
    // Signed in already; the offer is what is left before the surface ends.
    expect(onSignedIn).toHaveBeenCalledWith({ id: 'u_cd' });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('gives a keyboard path: Tab reaches Use a passkey, Email me a link, Make an account in order; Enter on Make an account registers', async () => {
    installWebAuthn({ attachment: 'platform' });
    const { client, calls } = makeClient({
      'POST /api/auth/passkey/register/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/register/finish': () => ({ body: { id: 'u_new' } }),
    });
    render(<SignIn authClient={client} />);

    // The tab order of the method step's controls follows the DOM: Close, then
    // the first section's two, then the second's one.
    const tabbable = [...document.querySelectorAll('button, input, [tabindex="0"]')].filter(
      (el) => !el.disabled && el.getAttribute('tabindex') !== '-1',
    );
    expect(tabbable.map((el) => el.textContent || el.getAttribute('aria-label'))).toEqual([
      'Close',
      'Use a passkey',
      'Email me a link',
      'Make an account',
    ]);
    for (const el of tabbable) {
      act(() => el.focus());
      expect(el).toHaveFocus();
    }

    // Enter on "Make an account" (a RAC Button) runs the register ceremony.
    const make = screen.getByRole('button', { name: 'Make an account' });
    act(() => make.focus());
    fireEvent.keyDown(make, { key: 'Enter' });
    fireEvent.keyUp(make, { key: 'Enter' });
    await screen.findByRole('heading', { name: 'Add a recovery email' });
    expect(callTo(calls, 'POST', '/api/auth/passkey/register/begin')).toBeTruthy();
  });

  it('Enter on Email me a link moves to the email step', async () => {
    const { client } = makeClient({ 'POST /api/auth/email/request': () => ({ status: 202 }) });
    render(<SignIn authClient={client} />);
    const emailBtn = screen.getByRole('button', { name: 'Email me a link' });
    act(() => emailBtn.focus());
    fireEvent.keyDown(emailBtn, { key: 'Enter' });
    fireEvent.keyUp(emailBtn, { key: 'Enter' });
    expect(await screen.findByRole('textbox', { name: 'Your email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send the link' })).toBeInTheDocument();
  });
});

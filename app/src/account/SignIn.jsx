// SignIn — the app's authentication surface (account.sign_in; workflow 13
// §Signing in on another device, workflow 7 §Signing in; mockup W13). One
// multi-step, full-screen surface (Decision 3), mounted by AppShell via the
// same `openSong`/`openFile` useState + early-return pattern, reached from the
// empty shelf's "Sign in" row (the `onSignIn` seam account.first_run wired) and,
// in redeem mode, from the emailed-link boot route in App.jsx.
//
// It offers the three ceremonies that make the service set (or first mint) the
// `estante_session` cookie — sign in with a passkey, make an account with a
// passkey, and the emailed-link fallback — and, after a sign-in that left no
// passkey resident here, offers to add one (Decision 5). On success it hands the
// resulting `Account { id }` to `onSignedIn` and closes; it never reads the
// cookie, stores no token, and logs nothing (Constraints). Everything the user
// does elsewhere stays offline; this surface is the one online exception, and
// when it cannot reach the service it says so in words and lets the user retry.
//
// Presentational throughout with React Aria Components, a managed focus across
// steps, and every status carried by a word (never colour). The platform passkey
// prompt is the browser's own — outside our axe surface.

import { useEffect, useRef, useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { createAuthClient } from './auth-client.js';
import { createCredential, getCredential, isCancellation } from './webauthn-json.js';
import { shouldOfferPasskey } from './offer-passkey.js';
import './account.css';

// The real client, bound to the browser's fetch; the behavior level injects a
// loopback double instead.
const DEFAULT_CLIENT = createAuthClient();

// The key glyph of the passkey buttons (W13 lines 34, 44); decorative.
function PasskeyIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3M15 8l2 2" />
    </svg>
  );
}

// The close (✕) on the surface's app bar; decorative, named by its button.
function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// A worded error (never colour alone), announced when it appears.
function ErrorNotice({ messageKey }) {
  return (
    <p className="notice warn account-error" role="alert">
      {t(`signIn.${messageKey}`)}
    </p>
  );
}

// A quiet "working…" status while a ceremony or request is in flight, announced
// politely so a screen-reader user knows the surface is busy.
function BusyStatus({ busy }) {
  return busy ? (
    <p className="t-small account-busy" role="status">
      {t('signIn.working')}
    </p>
  ) : null;
}

export default function SignIn({
  // 'signIn' (the returning user: authenticate) or 'create' (a brand-new user:
  // register). The empty-shelf row opens 'signIn'; books.add_by_link's invited
  // door will open 'create' (that caller lands with its own task).
  intent = 'signIn',
  // When set, the surface boots in redeem mode and redeems this emailed-link
  // token on mount (App.jsx captures it from `/sign-in/<token>`).
  redeemToken = null,
  authClient = DEFAULT_CLIENT,
  // An optional human label for a newly registered passkey (device name).
  label = undefined,
  onSignedIn = () => {},
  onClose = () => {},
}) {
  const [step, setStep] = useState(redeemToken ? 'redeeming' : 'method');
  const [error, setError] = useState(null); // an i18n leaf under `signIn`, or null
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');

  const accountRef = useRef(null); // the Account held between a finish/redeem and the offer step
  const inFlight = useRef(false); // a second press does not start two ceremonies (Constraints)
  const headingRef = useRef(null);
  const redeemStarted = useRef(false);

  // Move focus to each step's heading as it appears, so the keyboard and a
  // screen reader land on the new step (focus management across steps).
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  // On a successful sign-in: either offer a passkey here (then close), or close
  // now by handing the account out.
  function finishSignIn(account, outcome) {
    accountRef.current = account;
    inFlight.current = false;
    setBusy(false);
    if (shouldOfferPasskey(outcome)) {
      setError(null);
      setStep('offer');
    } else {
      onSignedIn(account);
    }
  }

  // Redeem the emailed link at boot (redeem mode). A valid token signs in and
  // then always offers a passkey here (Decision 5); an expired/used/tampered
  // token (401) shows the worded message and offers the email step again.
  useEffect(() => {
    if (!redeemToken || redeemStarted.current) return;
    redeemStarted.current = true;
    (async () => {
      try {
        const account = await authClient.redeemEmailLink(redeemToken);
        finishSignIn(account, { method: 'redeem' });
      } catch (err) {
        setError(err?.kind === 'unauthorized' ? 'errorExpired' : 'errorOffline');
        setStep('email');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redeemToken]);

  // "Use a passkey" — authenticate (sign-in intent) or register (create intent).
  async function usePasskey() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (intent === 'create') {
        const begin = await authClient.registerBegin(label);
        const { credential } = await createCredential(begin.publicKey);
        const account = await authClient.registerFinish({ state: begin.state, credential, label });
        finishSignIn(account, { method: 'register' });
      } else {
        const begin = await authClient.authenticateBegin();
        const { credential, authenticatorAttachment } = await getCredential(begin.publicKey);
        const account = await authClient.authenticateFinish({ state: begin.state, credential });
        finishSignIn(account, { method: 'authenticate', authenticatorAttachment });
      }
    } catch (err) {
      inFlight.current = false;
      setBusy(false);
      if (isCancellation(err)) return; // cancelled: stay on the method step, no error shouted
      setError(err?.kind === 'unauthorized' ? 'errorPasskey' : 'errorOffline');
    }
  }

  // "Email me a link" — always moves to "check your email" (the response is 202
  // regardless, revealing nothing about who has an account); the address is kept
  // to the request and never echoed on screen.
  async function sendEmailLink(event) {
    event?.preventDefault?.();
    if (inFlight.current) return;
    const address = email.trim();
    if (!address) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await authClient.requestEmailLink(address);
      inFlight.current = false;
      setBusy(false);
      setStep('checkEmail');
    } catch {
      // Only a transport failure reaches here (never "no account"): let the user
      // retry, still telling them nothing about the address.
      inFlight.current = false;
      setBusy(false);
      setError('errorOffline');
    }
  }

  // The offer step: register a passkey here with the session now set. Declining
  // or succeeding both close to onSignedIn (acceptance 6).
  async function addPasskeyHere() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const begin = await authClient.registerBegin(label);
      const { credential } = await createCredential(begin.publicKey);
      await authClient.registerFinish({ state: begin.state, credential, label });
      inFlight.current = false;
      setBusy(false);
      onSignedIn(accountRef.current);
    } catch (err) {
      inFlight.current = false;
      setBusy(false);
      if (isCancellation(err)) return; // cancelled the prompt: stay, let them retry or skip
      setError('errorOffline'); // worded; the user is already signed in, "Not now" continues
    }
  }

  // Declining the offer closes to onSignedIn with the account already signed in.
  const skipOffer = () => onSignedIn(accountRef.current);

  const goMethod = () => {
    setError(null);
    setStep('method');
  };

  // The app-bar close returns to where the surface was opened; at the offer step
  // the user is already signed in, so closing hands the account out instead.
  const handleClose = () => {
    if (step === 'offer' && accountRef.current) {
      onSignedIn(accountRef.current);
    } else {
      onClose();
    }
  };

  let content;
  if (step === 'method') {
    content = (
      <>
        <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
          {t('signIn.heading')}
        </h2>
        <p className="t-body account-sub">{t('signIn.body')}</p>
        {error ? <ErrorNotice messageKey={error} /> : null}
        <Button className="btn primary block" onPress={usePasskey} isDisabled={busy}>
          <PasskeyIcon />
          {t('signIn.usePasskey')}
        </Button>
        <Button
          className="btn block"
          onPress={() => {
            setError(null);
            setStep('email');
          }}
          isDisabled={busy}
        >
          {t('signIn.emailLink')}
        </Button>
        <p className="t-small account-note">{t('signIn.note')}</p>
        <BusyStatus busy={busy} />
      </>
    );
  } else if (step === 'email') {
    content = (
      <>
        <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
          {t('signIn.emailHeading')}
        </h2>
        <p className="t-body account-sub">{t('signIn.emailBody')}</p>
        {error ? <ErrorNotice messageKey={error} /> : null}
        <form className="account-form" onSubmit={sendEmailLink}>
          <TextField className="field" value={email} onChange={setEmail} isRequired>
            <Label>{t('signIn.emailLabel')}</Label>
            <Input
              className="input"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </TextField>
          <Button type="submit" className="btn primary block" isDisabled={busy}>
            {error === 'errorExpired' ? t('signIn.requestNewLink') : t('signIn.emailSend')}
          </Button>
        </form>
        <Button className="btn quiet block" onPress={goMethod} isDisabled={busy}>
          {t('signIn.usePasskeyInstead')}
        </Button>
        <BusyStatus busy={busy} />
      </>
    );
  } else if (step === 'checkEmail') {
    content = (
      <>
        <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
          {t('signIn.checkHeading')}
        </h2>
        <p className="t-body account-sub" role="status">
          {t('signIn.checkBody')}
        </p>
        <Button className="btn block" onPress={goMethod}>
          {t('signIn.checkBack')}
        </Button>
      </>
    );
  } else if (step === 'redeeming') {
    content = (
      <>
        <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
          {t('signIn.redeeming')}
        </h2>
        <p className="t-body account-sub" role="status">
          {t('signIn.working')}
        </p>
      </>
    );
  } else if (step === 'offer') {
    content = (
      <>
        <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
          {t('signIn.offerHeading')}
        </h2>
        <p className="t-body account-sub">{t('signIn.offerBody')}</p>
        {error ? <ErrorNotice messageKey={error} /> : null}
        <Button className="btn primary block" onPress={addPasskeyHere} isDisabled={busy}>
          <PasskeyIcon />
          {t('signIn.offerAdd')}
        </Button>
        <Button className="btn block" onPress={skipOffer} isDisabled={busy}>
          {t('signIn.offerSkip')}
        </Button>
        <BusyStatus busy={busy} />
      </>
    );
  }

  return (
    <div className="screen account-screen">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('signIn.close')} onPress={handleClose}>
          <CloseIcon />
        </Button>
        <span className="title">{t('signIn.brand')}</span>
      </div>
      <div className="scroll account-scroll">
        <div className="account-card">{content}</div>
      </div>
    </div>
  );
}

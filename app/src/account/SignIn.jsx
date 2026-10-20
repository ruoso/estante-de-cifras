// SignIn — the app's one sign-in surface (account.sign_in,
// account.sign_in_two_doors; workflow 13 §Signing in, or making an account;
// mockup W13 #1). One multi-step, full-screen surface (Decision 3), mounted by
// AppShell via the same useState + early-return pattern as `openSong`, and
// opened the same way from every entry: the empty shelf's row, the account
// card, *Mine on Estante*, an invitation (with the invitation as its `lead`) and,
// in redeem mode, the emailed-link boot route in App.jsx.
//
// Its first step is two labelled sections, in this order: *Already have an
// account?* (Use a passkey — authenticate; Email me a link) and *New here?*
// (Make an account — register, which always makes a new, separate account, as
// its line says). No entry picks a door; only a press that names a step lands
// on it (`initialStep="email"`).
//
// Two outcomes, two callbacks: `onSignedIn(account)` fires once, the moment a
// session exists (a finish, or a redeemed link), so the caller attaches the
// home book and accepts an invitation at once; the surface then stays open
// until its last step ends and calls `onDone()` — at once after a sign-in, after
// the offer to add a passkey (Decision 5), or after *Add a recovery email*, which
// follows *Make an account* and nothing else. It never reads the cookie, stores
// no token, and logs nothing (Constraints). Everything the user does elsewhere
// stays offline; this surface is the one online exception, and when it cannot
// reach the service it says so in words and lets the user retry.
//
// Presentational throughout with React Aria Components, a managed focus across
// steps, and every status carried by a word (never colour). The platform passkey
// prompt is the browser's own — outside our axe surface.

import { useEffect, useId, useRef, useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { createAuthClient } from './auth-client.js';
import { createCredential, getCredential, isCancellation } from './webauthn-json.js';
import { shouldOfferPasskey } from './offer-passkey.js';
import RecoveryEmailStep from './RecoveryEmailStep.jsx';
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

// After a cancelled *Use a passkey*: the browser answers "no passkey here" just
// as it answers a cancel, so one calm, conditional line says what to do — a
// polite status on a plain notice, not an error (workflow 13 §Signing in, or
// making an account; account.no_passkey_hint Decision 2).
function NoPasskeyHint() {
  return (
    <p className="notice" role="status">
      {t('signIn.noPasskeyHint')}
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
  // When set, the surface boots in redeem mode and redeems this emailed-link
  // token on mount (App.jsx captures it from `/sign-in/<token>`).
  redeemToken = null,
  // The step the surface opens at: 'method' (the default), or 'email' — the
  // Add-a-book sheet's "No passkey here? Email me a link" lands straight on the
  // emailed-link step (books.add_book_chooser Decision 4; workflow 13 L25-30).
  initialStep = 'method',
  // What heads the method step in place of its own heading: the invitation's
  // (InvitedLead, workflow 1 §Invited), whose `h1` takes the step's focus. The
  // two sections are drawn unchanged below it.
  lead = null,
  // What follows the two sections under a lead (the invitation's footer, W01 #2).
  leadFooter = null,
  authClient = DEFAULT_CLIENT,
  // An optional human label for a newly registered passkey (device name).
  label = undefined,
  // A session now exists: called once, with the `Account`.
  onSignedIn = () => {},
  // The surface's last step has ended (after onSignedIn).
  onDone = () => {},
  // Closed before any session exists.
  onClose = () => {},
}) {
  const [step, setStep] = useState(redeemToken ? 'redeeming' : initialStep);
  const [error, setError] = useState(null); // an i18n leaf under `signIn`, or null
  const [hint, setHint] = useState(false); // the no-passkey line, after a cancelled authenticate
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');

  const accountRef = useRef(null); // the Account, once a session exists
  const inFlight = useRef(false); // a second press does not start two ceremonies (Constraints)
  const headingRef = useRef(null);
  const redeemStarted = useRef(false);
  const emailRef = useRef(null);
  // Opened at the email step, the field takes focus on arrival (there is no
  // step before it to come from); only that first arrival.
  const focusEmailFirst = useRef(!redeemToken && initialStep === 'email');
  const leadRef = useRef(null);
  const haveId = useId();
  const newId = useId();

  // Move focus to each step's heading as it appears, so the keyboard and a
  // screen reader land on the new step (focus management across steps).
  useEffect(() => {
    if (focusEmailFirst.current && emailRef.current) {
      focusEmailFirst.current = false;
      emailRef.current.focus();
      return;
    }
    // With a lead, its own heading is the method step's (the invitation's h1).
    const lead = step === 'method' ? leadRef.current?.querySelector('h1, h2') : null;
    (lead ?? headingRef.current)?.focus();
  }, [step]);

  // A session exists: hand the account out at once (the caller attaches the
  // home book, accepts an invitation), then go on to what follows it — the
  // recovery step after Make an account, the offer after a sign-in that left no
  // passkey here (Decision 5), or nothing.
  function finishSignIn(account, outcome) {
    accountRef.current = account;
    inFlight.current = false;
    setBusy(false);
    setError(null);
    onSignedIn(account);
    if (outcome.method === 'register') {
      setStep('recovery');
    } else if (shouldOfferPasskey(outcome)) {
      setStep('offer');
    } else {
      onDone();
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

  // "Use a passkey" (Already have an account?) authenticates; "Make an account"
  // (New here?) registers, which the service always answers with a new account.
  async function runCeremony(create) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setHint(false);
    try {
      if (create) {
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
      if (isCancellation(err)) {
        // Cancelled, or no passkey here (the two look alike): stay on the method
        // step, no error shouted; after Use a passkey, say what to do instead.
        if (!create) setHint(true);
        return;
      }
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
  // or succeeding both end the surface (onDone); the account was handed out
  // already.
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
      onDone();
    } catch (err) {
      inFlight.current = false;
      setBusy(false);
      if (isCancellation(err)) return; // cancelled the prompt: stay, let them retry or skip
      setError('errorOffline'); // worded; the user is already signed in, "Not now" continues
    }
  }

  // Declining the offer ends the surface, the account already signed in.
  const skipOffer = () => onDone();

  const goMethod = () => {
    setError(null);
    setHint(false);
    setStep('method');
  };

  // The app-bar close returns to where the surface was opened; once a session
  // exists (the offer, the recovery step) closing ends the surface instead.
  const handleClose = () => {
    if (accountRef.current) {
      onDone();
    } else {
      onClose();
    }
  };

  let content;
  if (step === 'method') {
    content = (
      <>
        {lead ? (
          <div className="account-lead" ref={leadRef}>
            {lead}
          </div>
        ) : (
          <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
            {t('signIn.heading')}
          </h2>
        )}
        {error ? <ErrorNotice messageKey={error} /> : hint ? <NoPasskeyHint /> : null}
        <div className="account-door" role="group" aria-labelledby={haveId}>
          <h3 className="t-h2" id={haveId}>
            {t('signIn.haveAccount')}
          </h3>
          <Button className="btn primary block" onPress={() => runCeremony(false)} isDisabled={busy}>
            <PasskeyIcon />
            {t('signIn.usePasskey')}
          </Button>
          <Button
            className="btn block"
            onPress={() => {
              setError(null);
              setHint(false);
              setStep('email');
            }}
            isDisabled={busy}
          >
            {t('signIn.emailLink')}
          </Button>
          <p className="t-small account-note">{t('signIn.note')}</p>
        </div>
        <div className="account-door account-door-new" role="group" aria-labelledby={newId}>
          <h3 className="t-h2" id={newId}>
            {t('signIn.newHere')}
          </h3>
          <Button className="btn block" onPress={() => runCeremony(true)} isDisabled={busy}>
            {t('signIn.makeAccount')}
          </Button>
          <p className="t-small account-note">{t('signIn.newHereNote')}</p>
        </div>
        {lead ? leadFooter : null}
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
              ref={emailRef}
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
  } else if (step === 'recovery') {
    content = <RecoveryEmailStep ref={headingRef} authClient={authClient} onDone={onDone} />;
  }

  return (
    <div className="screen account-screen">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('signIn.close')} onPress={handleClose}>
          <CloseIcon />
        </Button>
        <span className="title">{t('signIn.brand')}</span>
      </div>
      <div className={lead ? 'scroll account-scroll invited-scroll' : 'scroll account-scroll'}>
        <div className="account-card">{content}</div>
      </div>
    </div>
  );
}

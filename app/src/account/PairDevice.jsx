// PairDevice — the Pair a device page (reader.pair_web; workflow 13 §Pairing a
// reMarkable; board Pair-a-device.dc.html). A reMarkable has no browser, so it
// is paired: it shows a short code and the address www.estantedecifras.app/pair,
// and the person, signed in here, enters the code. AppShell shows this page as a
// surface over the shell — opened by that address (App.jsx, `isPairPath`) or by
// **Pair a device** at the foot of the account screen's Signed-in devices.
//
//   - Signed out (the session probe answers 401), the page is the one sign-in
//     surface with its own lead — the page's heading and *Sign in to the account
//     whose books the reMarkable should read.* — both doors and making an
//     account (Decision 4). Signed in there, the page goes on to the code. No
//     code field is shown before a session exists.
//   - Signed in: one field, what the reMarkable will be able to do, the warning
//     line and **Pair your reMarkable**. Nothing is checked before the press; on
//     it a code that is not six letters and numbers is said to be malformed and
//     nothing is sent (pair-code.js). Each refusal of the service is said under
//     the field, which keeps its text and takes the focus.
//   - Approved, the page says it is paired; **Done** opens the account screen,
//     whose own probe lists the reader (Decision 8).
//   - Offline, the button is disabled and the page says so in words.
//
// The code lives only in this component's state: never logged, never put in the
// address, never stored (Constraint 13). It touches no IndexedDB and no book.

import { useEffect, useRef, useState } from 'react';
import { Button, FieldError, Input, Label, Text, TextField } from 'react-aria-components';

import { t } from '../i18n/index.js';
import { createAuthClient, AuthError } from './auth-client.js';
import { checkPairCode } from './pair-code.js';
import { useOnline } from './use-online.js';
import SignIn from './SignIn.jsx';
import { BarEnd } from '../shell/HeaderChrome.jsx';
import './account.css';

// The real client, bound to the browser's fetch; the behavior level injects a
// loopback double instead.
const DEFAULT_CLIENT = createAuthClient();

// The back chevron of the bar; decorative, named by its button.
function BackIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

// The check of the paired outcome (board Tablet); decorative.
function CheckIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

// The no-connection glyph of the offline notice (board Tablet); decorative.
function OfflineIcon() {
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
      <path d="M3 3l18 18M8 7a6 6 0 0 1 10 4h1a4 4 0 0 1 2 7.5M17 18H7a4 4 0 0 1-1-7.9" />
    </svg>
  );
}

// The words under the field for a refused code, by the client's error kind
// (workflow 13 §A code that does not pair). Null for a failure that is not the
// code's (the network, a server fault) — those are said apart from the field.
function refusalOf(error) {
  if (!(error instanceof AuthError)) return null;
  switch (error.kind) {
    case 'pair_unknown':
    case 'bad_request':
      return 'unknown';
    case 'pair_expired':
      return 'expired';
    case 'pair_used':
      return 'used';
    case 'rate_limited':
      return 'rateLimited';
    default:
      return null;
  }
}

// The signed-out lead above the sign-in surface's two doors (workflow 13 §Not
// signed in; board Tablet): the page's heading — which SignIn focuses — and the
// line saying whose books the reMarkable will read.
export function PairLead() {
  return (
    <>
      <h1 className="t-display account-heading" tabIndex={-1}>
        {t('pair.title')}
      </h1>
      <p className="t-body account-sub">{t('pair.signInLead')}</p>
    </>
  );
}

/**
 * @param {{
 *   authClient?: {
 *     listSessions: () => Promise<{ sessions: object[] }>,
 *     approveDevicePairing: (code: string) => Promise<void>,
 *   },
 *   onClose?: () => void,
 *   onOpenAccount?: () => void,
 *   onSignedIn?: (account: object) => void,
 *   onCloseSignIn?: () => void,
 * }} props
 */
export default function PairDevice({
  authClient = DEFAULT_CLIENT,
  // The bar's Back: to the account screen, or the shelf when the address opened
  // the page (AppShell decides).
  onClose = () => {},
  // **Done** after a code is approved: the account screen, at Signed-in devices.
  onOpenAccount = () => {},
  // A session now exists through the page's sign-in (AppShell attaches the home
  // book and asks the account status again, as for any sign-in).
  onSignedIn = () => {},
  // The sign-in surface closed before a session existed: back to the shelf.
  onCloseSignIn = onClose,
}) {
  // 'loading' | 'in' | 'out' — "signed in" from the session probe's 200 or 401
  // (the session is a cookie the app never reads). A probe that cannot reach the
  // service shows the code anyway: the press says what is wrong.
  const [auth, setAuth] = useState('loading');
  const [paired, setPaired] = useState(false);
  const [code, setCode] = useState('');
  // The refusal said under the field: an i18n leaf under `pair`, or null.
  const [refusal, setRefusal] = useState(null);
  // A failure that is not the code's (no connection, a server fault).
  const [failure, setFailure] = useState(false);
  // Each refusal moves the focus to the field, even the same one twice.
  const [refusals, setRefusals] = useState(0);
  const [busy, setBusy] = useState(false);
  const online = useOnline();

  const clientRef = useRef(authClient);
  const inFlight = useRef(false);
  const headingRef = useRef(null);
  const inputRef = useRef(null);

  // Probe the session once, on open: its answer is set in the promise's
  // callbacks, never synchronously in the effect.
  useEffect(() => {
    clientRef.current.listSessions().then(
      () => setAuth('in'),
      (error) => setAuth(error instanceof AuthError && error.kind === 'unauthorized' ? 'out' : 'in'),
    );
  }, []);

  // The page's heading takes the focus as the page — and its paired outcome —
  // appears (signed out, SignIn focuses the lead's heading itself).
  useEffect(() => {
    if (auth === 'in') headingRef.current?.focus();
  }, [auth, paired]);

  // A refused code: the field takes the focus, keeping what was typed.
  useEffect(() => {
    if (refusals > 0) inputRef.current?.focus();
  }, [refusals]);

  const refuse = (leaf) => {
    setRefusal(leaf);
    setRefusals((n) => n + 1);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current || !online) return;
    setFailure(false);
    const checked = checkPairCode(code);
    if (!checked.ok) {
      refuse('malformed');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      await clientRef.current.approveDevicePairing(checked.code);
      setRefusal(null);
      setPaired(true);
    } catch (error) {
      if (error instanceof AuthError && error.kind === 'unauthorized') {
        // The session ended under the page: sign in first, as at the start.
        setRefusal(null);
        setAuth('out');
      } else {
        const leaf = refusalOf(error);
        if (leaf) refuse(leaf);
        else {
          setRefusal(null);
          setFailure(true);
        }
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (auth === 'out') {
    return (
      <SignIn
        authClient={authClient}
        lead={<PairLead />}
        onSignedIn={(account) => {
          onSignedIn(account);
          setAuth('in');
        }}
        onDone={() => setAuth('in')}
        onClose={onCloseSignIn}
      />
    );
  }

  let content = null;
  if (auth === 'in' && paired) {
    content = (
      <div className="pair-paired" role="status">
        <div className="account-confirm-head">
          <span className="account-confirm-check">
            <CheckIcon />
          </span>
          <p className="t-h1">{t('pair.paired')}</p>
        </div>
        <div className="actions pair-actions">
          <Button className="btn primary" onPress={onOpenAccount}>
            {t('pair.done')}
          </Button>
        </div>
      </div>
    );
  } else if (auth === 'in') {
    content = (
      <form className="account-form pair-form" onSubmit={submit}>
        <p className="t-body">{t('pair.intro')}</p>
        <TextField
          className="field"
          value={code}
          onChange={(value) => {
            setCode(value);
          }}
          isInvalid={refusal !== null}
          validationBehavior="aria"
        >
          <Label>{t('pair.codeLabel')}</Label>
          <Input
            ref={inputRef}
            className="input t-mono pair-code"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <Text slot="description" className="t-small">
            {t('pair.codeHint')}
          </Text>
          <FieldError className="notice conflict" role="alert">
            {refusal ? t(`pair.${refusal}`) : null}
          </FieldError>
        </TextField>
        <section className="card pad pair-can-do" aria-labelledby="pair-can-do-heading">
          <h2 className="t-h2" id="pair-can-do-heading">
            {t('pair.canDoHeading')}
          </h2>
          <p className="t-body">{t('pair.canDo')}</p>
        </section>
        <p className="t-small pair-warning">{t('pair.warning')}</p>
        {online ? null : (
          <div className="notice pair-offline" role="status">
            <OfflineIcon />
            <span>{t('pair.offline')}</span>
          </div>
        )}
        {failure && online ? (
          <p className="notice warn" role="alert">
            {t('account.errNetwork')}
          </p>
        ) : null}
        <Button type="submit" className="btn primary block" isDisabled={!online || busy}>
          {t('pair.submit')}
        </Button>
      </form>
    );
  }

  return (
    <div className="screen account-screen pair-screen">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('pair.back')} onPress={onClose}>
          <BackIcon />
        </Button>
        <h1 className="title" ref={headingRef} tabIndex={-1}>
          {t('pair.title')}
        </h1>
        <BarEnd help="account" />
      </div>
      <div className="scroll account-scroll">
        <div className="account-card">{content}</div>
      </div>
    </div>
  );
}

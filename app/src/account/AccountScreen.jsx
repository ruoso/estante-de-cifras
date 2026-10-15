// AccountScreen — the account surface (account.account_screen; workflow 13 §The
// account screen; design.theme_picker; mockup Theme-picker.dc.html). One
// full-screen surface, reached from the header, with three regions:
//
//   1. Preferences — a Theme picker (Automatic, Estante, Caderno, Palco) and a
//      Language picker (the four LOCALES), present and writable whether or not
//      the user is signed in (preferences live in the local home book from the
//      first minute). A choice is a Worker command (SET_THEME / SET_LANGUAGE)
//      that writes the `{ value, at }` register through the home book; the view
//      only dispatches and reads the `preferences` slice, and ThemeRoot /
//      LocaleRoot re-apply off it live (DIRECTION §3.7; Constraints). Automatic
//      is the absent register (Decision 3), so choosing it clears the register.
//   2. Signed-in devices (additive, when signed in) — the account's sessions,
//      the current one marked, with sign out for any *other* device (revokes its
//      session). The current device's sign-out delegates to an `onSignOut` seam
//      account.sign_out fills (Decision 4).
//   3. Passkeys (additive, when signed in) — listed, removable, and "add a
//      passkey to this device" reusing the authed register flow. While the
//      account has no confirmed email, its only passkey is its last way in and
//      has no Remove (workflow 13 §The last way in).
//   4. Recovery email (additive, when signed in; account.recovery_email) — the
//      RecoveryEmailRegion, read after the passkeys. It also tells Leaving how a
//      deletion is confirmed (`confirmBy`: the typed email, or a passkey).
//
// "Signed in" is known only from a response (the session is a cookie the app
// never reads — DIRECTION §3.3): listSessions returns 200 under a session and
// 401 without one, so the screen reads it afresh each open (Constraints). When
// not signed in, the signed-in regions are replaced by the "Not signed in" card
// whose "Use a passkey" / "Email me a link" open the SignIn surface.
//
// Presentational throughout with React Aria Components: the two pickers are
// labelled RadioGroups, the chosen option marked by the word "Selected" and an
// indicator (never colour alone), each destructive action confirms through a RAC
// Dialog, and every status/error is carried by a word (role="status"/"alert").
// It logs nothing. The Recovery email region is the one place the app shows an
// address, to its owner (account.recovery_email, superseding Decision 5 for that
// region alone); Account itself is only `{ id }`.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
} from 'react-aria-components';

import { t, currentLocale, resolveLocale, LOCALES } from '../i18n/index.js';
import { THEMES } from '../theme/resolve.js';
import { orderedBooks } from '../books/book-display.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import { createSharingClient } from '../books/sharing-client.js';
import { createAuthClient, AuthError } from './auth-client.js';
import SignOutDialog from './SignOutDialog.jsx';
import LeaveDialogs from './LeaveDialogs.jsx';
import RecoveryEmailRegion from './RecoveryEmailRegion.jsx';
import { isLastWayIn } from './recovery-email.js';
import { useOnline } from './use-online.js';
import { createCredential, isCancellation } from './webauthn-json.js';
import './account.css';

// The real client, bound to the browser's fetch; the behavior level injects a
// loopback double instead (like SignIn / SharingScreen).
const DEFAULT_CLIENT = createAuthClient();

// The sharing client for the Leaving region's who-loses-access counts
// (listMembers). Bound to the browser's fetch; the behavior level injects a
// loopback double.
const DEFAULT_SHARING_CLIENT = createSharingClient();

// The four theme choices, in mockup order: Automatic (the absent register) then
// the three drawn themes. `id` is what SET_THEME carries (CHOSEN_THEMES).
const THEME_OPTIONS = [
  { id: 'automatic', name: 'themeAutomatic', meta: 'themeAutomaticMeta', swatch: 'auto' },
  { id: 'estante', name: 'themeEstante', meta: 'themeEstanteMeta', swatch: 'estante' },
  { id: 'caderno', name: 'themeCaderno', meta: 'themeCadernoMeta', swatch: 'caderno' },
  { id: 'palco', name: 'themePalco', meta: 'themePalcoMeta', swatch: 'palco' },
];

// The chevron-back glyph of the app bar; decorative, named by its button.
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

// The check that marks a chosen option; decorative, the word "Selected" carries
// the meaning (never colour alone).
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

// The key glyph of the passkey buttons/rows (mockup); decorative.
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

// A live preview swatch for a theme row: a token-scoped `.est theme-<id>` box
// with a chord-coloured "G", or a split estante/palco box for Automatic.
// Decorative — the row's text name is the accessible label.
function ThemeSwatch({ swatch }) {
  if (swatch === 'auto') {
    return (
      <span className="account-swatch account-swatch-split" aria-hidden="true">
        <span className="est theme-estante account-swatch-half">G</span>
        <span className="est theme-palco account-swatch-half">G</span>
      </span>
    );
  }
  return (
    <span className={`est theme-${swatch} account-swatch`} aria-hidden="true">
      G
    </span>
  );
}

// One picker row (a RAC Radio): the check + the preview/label, the name and an
// optional meta, and the "Selected" word on the chosen one. RAC carries the
// checked state as aria-checked; the word and the check are the visible marker.
function PickerRow({ value, name, meta, children }) {
  return (
    <Radio className={({ isSelected }) => `row account-row${isSelected ? ' sel' : ''}`} value={value}>
      {({ isSelected }) => (
        <>
          <span className={`check${isSelected ? ' on' : ''}`}>{isSelected ? <CheckIcon /> : null}</span>
          {children}
          <span className="grow">
            <span className="name">{name}</span>
            {meta ? <span className="meta">{meta}</span> : null}
          </span>
          {isSelected ? <span className="badge ok">{t('account.selected')}</span> : null}
        </>
      )}
    </Radio>
  );
}

// A destructive-action confirm (the SharingScreen RAC Dialog pattern, without
// the typed-name guard): a trigger Button, a modal with the worded consequence,
// Cancel and a danger confirm. Portaled into the `.est` token root by ThemeRoot.
function ConfirmDialog({ trigger, title, body, confirmLabel, onConfirm }) {
  return (
    <DialogTrigger>
      {trigger}
      <ModalOverlay className="scrim center">
        <Modal className="dialog">
          <Dialog>
            {({ close }) => (
              <>
                <Heading slot="title" className="t-h2">
                  {title}
                </Heading>
                <p className="t-body">{body}</p>
                <div className="actions">
                  <Button className="btn" onPress={close}>
                    {t('account.cancel')}
                  </Button>
                  <Button
                    className="btn danger"
                    onPress={() => {
                      onConfirm();
                      close();
                    }}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

// A worded error (never colour alone), announced when it appears, with a retry.
function ErrorNotice({ message, onRetry }) {
  return (
    <div className="account-error-row">
      <p className="notice warn" role="alert">
        {message}
      </p>
      {onRetry ? (
        <Button className="btn" onPress={onRetry}>
          {t('account.retry')}
        </Button>
      ) : null}
    </div>
  );
}

// Word an AuthError the client raised. It carries only a kind/status (no ids, no
// device string), so the wording is generic by design (Constraints — nothing
// names the user).
function errorCopy(error) {
  if (error instanceof AuthError && error.kind === 'last_way_in') return t('account.lastWayInBody');
  if (error instanceof AuthError && (error.kind === 'network' || error.status === null)) {
    return t('account.errNetwork');
  }
  return t('account.errGeneric');
}

// Localised date/time for a session's last use and a passkey's creation, in the
// app's current language. Absent/invalid instants fall back to an empty string.
function formatDateTime(iso, withTime) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const opts = withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
  try {
    return new Intl.DateTimeFormat(currentLocale(), opts).format(date);
  } catch {
    return date.toISOString();
  }
}

export default function AccountScreen({
  store,
  authClient = DEFAULT_CLIENT,
  onClose = () => {},
  // The not-signed-in card's ways in (open the SignIn surface); `method` is
  // 'passkey' | 'email' for the caller to route. AppShell opens SignIn either way.
  onSignIn = () => {},
  // Return the surface to the not-signed-in state after the current-device
  // sign-out has torn down locally and cleared the session (account.sign_out).
  // The SignOutDialog owns the remove/keep-books prompt and the teardown; this
  // is called once it is done, for AppShell to close the account surface. A
  // no-op by default (the dialog still tears down).
  onSignOut = () => {},
  sharingClient = DEFAULT_SHARING_CLIENT,
}) {
  const preferences = useSlice(store, 'preferences');
  // The shelf tells us locally whether this device holds an account's books
  // (shared books only appear under a session). That is the one signed-in signal
  // available with no network — the probe below can only re-derive "signed in"
  // from a live response, so when it fails offline the current-device sign-out
  // (a local, offline-first teardown — Constraint 3) must stay reachable as long
  // as there is an account's book here to leave.
  const shelf = useSlice(store, 'shelf');
  const hasAccountBooks = orderedBooks(shelf).some((entry) => entry.kind === 'shared');

  // The chosen theme is the register's value when it is a drawn theme, else
  // Automatic (the absent/tombstone register — Decision 3). The chosen language
  // is the resolved locale, so one of the four is always marked even before a
  // choice (the browser's until then — resolveLocale).
  const themeValue = preferences?.theme?.value;
  const chosenTheme = THEMES.includes(themeValue) ? themeValue : 'automatic';
  const chosenLanguage = resolveLocale(preferences?.language?.value);
  const authorName = preferences?.authorName?.value;

  const chooseTheme = (theme) =>
    store.send(command(CommandKind.SET_THEME, { theme }));
  const chooseLanguage = (language) =>
    store.send(command(CommandKind.SET_LANGUAGE, { language }));

  // 'loading' | 'in' | 'out' | 'error' — "signed in" read afresh from a 200 vs
  // 401 each time the screen opens (Constraints; Decision 3).
  const [auth, setAuth] = useState('loading');
  const [probeError, setProbeError] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [passkeys, setPasskeys] = useState([]);
  const [passkeysError, setPasskeysError] = useState(null);
  const [actionError, setActionError] = useState(null);
  // The recovery email `{ email, pending }` (null until read) and its read error.
  const [recovery, setRecovery] = useState(null);
  const [recoveryError, setRecoveryError] = useState(null);
  const addInFlight = useRef(false);
  const online = useOnline();

  // Hold the client in a ref (the SharingScreen pattern): a stable value so the
  // load effect's setState-past-await is not read as a synchronous cascade, and
  // so a re-render never re-runs the probe (react-hooks/set-state-in-effect).
  const clientRef = useRef(authClient);
  const client = clientRef.current;

  const loadPasskeys = useCallback(async () => {
    try {
      const { passkeys: list } = await client.listPasskeys();
      setPasskeys(list ?? []);
      setPasskeysError(null);
    } catch (error) {
      setPasskeysError(error);
    }
  }, [client]);

  const loadRecovery = useCallback(async () => {
    try {
      const result = await client.getRecoveryEmail();
      setRecovery({ email: result?.email ?? null, pending: result?.pending ?? null });
      setRecoveryError(null);
    } catch (error) {
      setRecoveryError(error);
    }
  }, [client]);

  // Probe the session: 200 → signed in (fill the devices roster, then passkeys);
  // 401 → not signed in; anything else → a worded, retryable error. No token is
  // stored; the probe runs on open and on retry. Every setState happens past the
  // first `await`, so the mount effect below triggers no synchronous render
  // cascade (react-hooks/set-state-in-effect; the SharingScreen reload pattern).
  const probe = useCallback(async () => {
    try {
      const { sessions: list } = await client.listSessions();
      setSessions(list ?? []);
      setActionError(null);
      setProbeError(null);
      setAuth('in');
      await loadPasskeys();
      await loadRecovery();
    } catch (error) {
      if (error instanceof AuthError && error.kind === 'unauthorized') {
        setAuth('out');
      } else {
        setProbeError(error);
        setAuth('error');
      }
    }
  }, [client, loadPasskeys, loadRecovery]);

  useEffect(() => {
    probe();
  }, [probe]);

  // Sign another device out (current:false only — Decision 4). A 404 means it was
  // already gone; either way the row leaves. Any other failure is worded.
  const revoke = async (session) => {
    setActionError(null);
    try {
      await client.revokeSession(session.id);
    } catch (error) {
      if (!(error instanceof AuthError && error.kind === 'not_found')) {
        setActionError(error);
        return;
      }
    }
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
  };

  // Remove a passkey. A 404 (already gone) reconciles the row away; a 409
  // `last_way_in` (a remove that raced the last-way-in rule) is worded with the
  // rule's sentence and reloads the passkeys and the recovery email; other
  // failures are worded.
  const removePasskey = async (passkey) => {
    setActionError(null);
    try {
      await client.removePasskey(passkey.id);
    } catch (error) {
      if (error instanceof AuthError && error.kind === 'last_way_in') {
        setActionError(error);
        await loadPasskeys();
        await loadRecovery();
        return;
      }
      if (!(error instanceof AuthError && error.kind === 'not_found')) {
        setActionError(error);
        return;
      }
    }
    setPasskeys((prev) => prev.filter((k) => k.id !== passkey.id));
  };

  // Add a passkey to this device: the authed register flow (registerBegin →
  // createCredential → registerFinish), then re-list. A cancelled prompt is not
  // an error; a failure is worded.
  const addPasskey = async () => {
    if (addInFlight.current) return;
    addInFlight.current = true;
    setActionError(null);
    try {
      const begin = await client.registerBegin();
      const { credential } = await createCredential(begin.publicKey);
      await client.registerFinish({ state: begin.state, credential });
      await loadPasskeys();
    } catch (error) {
      if (!isCancellation(error)) setActionError(error);
    } finally {
      addInFlight.current = false;
    }
  };

  const preferencesRegion = (
    <>
      <div className="t-h3">{t('account.preferences')}</div>

      <div className="t-h3 account-subhead">{t('account.theme')}</div>
      <RadioGroup
        className="list account-list"
        aria-label={t('account.theme')}
        value={chosenTheme}
        onChange={chooseTheme}
      >
        {THEME_OPTIONS.map((opt) => (
          <PickerRow key={opt.id} value={opt.id} name={t(`account.${opt.name}`)} meta={t(`account.${opt.meta}`)}>
            <ThemeSwatch swatch={opt.swatch} />
          </PickerRow>
        ))}
      </RadioGroup>
      <p className="t-small account-note">{t('account.themeNote')}</p>

      <div className="t-h3 account-subhead">{t('account.language')}</div>
      <RadioGroup
        className="list account-list"
        aria-label={t('account.language')}
        value={chosenLanguage}
        onChange={chooseLanguage}
      >
        {LOCALES.map((locale) => (
          <PickerRow key={locale.id} value={locale.id} name={locale.name} />
        ))}
      </RadioGroup>
      <p className="t-small account-note">{t('account.languageNote')}</p>
    </>
  );

  const notSignedInCard = (
    <div className="card pad account-signin-card">
      <span className="t-h2">{t('account.notSignedIn')}</span>
      <span className="t-small">{t('account.notSignedInBody')}</span>
      <Button className="btn primary block" onPress={() => onSignIn('passkey')}>
        <PasskeyIcon />
        {t('account.usePasskey')}
      </Button>
      <Button className="btn block" onPress={() => onSignIn('email')}>
        {t('account.emailLink')}
      </Button>
    </div>
  );

  const identityRow = (
    <div className="account-identity">
      <span className="account-avatar" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      </span>
      <span className="account-identity-text">
        {authorName ? (
          <span className="t-h2">{authorName}</span>
        ) : (
          <span className="t-h2">{t('account.signedIn')}</span>
        )}
        <span className="t-small" role="status">
          {t('account.signedInStatus')}
        </span>
      </span>
    </div>
  );

  const devicesRegion = (
    <>
      <div className="t-h3 account-section">{t('account.devices')}</div>
      <div className="list account-list">
        {sessions.map((session) => {
          const label = session.device || t('account.unknownDevice');
          return (
            <div className="row account-row" key={session.id}>
              <span className="grow">
                <span className="name">{session.current ? t('account.thisDevice') : label}</span>
                <span className="meta">
                  {session.current
                    ? t('account.inUseNow', { device: label })
                    : t('account.lastUsed', { time: formatDateTime(session.lastUsedAt, true) })}
                </span>
              </span>
              {session.current ? (
                <SignOutDialog store={store} authClient={authClient} onSignedOut={onSignOut} />
              ) : (
                <ConfirmDialog
                  trigger={
                    <Button className="btn" aria-label={t('account.signOutLabel', { device: label })}>
                      {t('account.signOut')}
                    </Button>
                  }
                  title={t('account.signOutTitle', { device: label })}
                  body={t('account.signOutBody')}
                  confirmLabel={t('account.signOutConfirm')}
                  onConfirm={() => revoke(session)}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  // Unknown (not yet read) counts as no confirmed email: the conservative side,
  // with the server's 409 as the backstop (account.recovery_email Decision 5).
  const lastWayIn = isLastWayIn({ email: recovery?.email ?? null, passkeys });

  // How Leaving confirms a deletion: the typed email, a passkey, or not yet known.
  const confirmBy = recovery ? (recovery.email ? 'email' : 'passkey') : null;

  const passkeysRegion = (
    <>
      <div className="t-h3 account-section">{t('account.passkeys')}</div>
      {passkeysError ? (
        <ErrorNotice message={errorCopy(passkeysError)} onRetry={loadPasskeys} />
      ) : (
        <div className="list account-list">
          {passkeys.map((passkey) => {
            const label = passkey.label || t('account.passkeyUnnamed');
            const added = (
              <>
                <PasskeyIcon />
                <span className="grow">
                  <span className="name">{label}</span>
                  <span className="meta">
                    {t('account.passkeyAdded', { date: formatDateTime(passkey.createdAt, false) })}
                  </span>
                </span>
              </>
            );
            // The last way in (workflow 13 L70–76; board Phone 1): no Remove, a
            // worded badge and the sentence instead.
            if (lastWayIn) {
              return (
                <div className="row account-row account-last-way-in" key={passkey.id}>
                  <span className="account-last-way-in-line">
                    {added}
                    <span className="badge">{t('account.lastWayIn')}</span>
                  </span>
                  <span className="t-small">{t('account.lastWayInBody')}</span>
                </div>
              );
            }
            return (
              <div className="row account-row" key={passkey.id}>
                {added}
                <ConfirmDialog
                  trigger={
                    <Button className="btn quiet" aria-label={t('account.removePasskeyLabel', { name: label })}>
                      {t('account.removePasskey')}
                    </Button>
                  }
                  title={t('account.removePasskeyTitle', { name: label })}
                  body={t('account.removePasskeyBody')}
                  confirmLabel={t('account.removePasskeyConfirm')}
                  onConfirm={() => removePasskey(passkey)}
                />
              </div>
            );
          })}
        </div>
      )}
      <Button className="btn block account-add-passkey" onPress={addPasskey}>
        <PasskeyIcon />
        {t('account.addPasskey')}
      </Button>
    </>
  );

  // The current device's sign-out alone, reachable offline (Constraint 3): the
  // roster and passkeys need a live response, but leaving an account on this
  // device is a local teardown that must not wait on the network. Shown when the
  // probe failed for want of a connection and this device still holds an
  // account's book to leave; a worded status says what offline withholds.
  const offlineSignedOutRegion = (
    <>
      {identityRow}
      <p className="t-small account-note" role="status">
        {t('account.offlineManage')}
      </p>
      <div className="t-h3 account-section">{t('account.devices')}</div>
      <div className="list account-list">
        <div className="row account-row">
          <span className="grow">
            <span className="name">{t('account.thisDevice')}</span>
          </span>
          <SignOutDialog store={store} authClient={authClient} onSignedOut={onSignOut} />
        </div>
      </div>
    </>
  );

  const probeWasOffline = probeError instanceof AuthError && probeError.kind === 'network';

  let signedInRegions = null;
  if (auth === 'loading') {
    signedInRegions = (
      <p className="t-small account-note" role="status">
        {t('account.loading')}
      </p>
    );
  } else if (auth === 'error') {
    signedInRegions =
      probeWasOffline && hasAccountBooks ? (
        offlineSignedOutRegion
      ) : (
        <ErrorNotice message={errorCopy(probeError ?? actionError)} onRetry={probe} />
      );
  } else if (auth === 'out') {
    signedInRegions = notSignedInCard;
  } else {
    signedInRegions = (
      <>
        {identityRow}
        {actionError ? <ErrorNotice message={errorCopy(actionError)} onRetry={() => setActionError(null)} /> : null}
        {devicesRegion}
        {passkeysRegion}
        <RecoveryEmailRegion
          recovery={recovery}
          loadError={recoveryError}
          authClient={authClient}
          online={online}
          onReload={loadRecovery}
        />
        <LeaveDialogs
          store={store}
          authClient={authClient}
          sharingClient={sharingClient}
          confirmBy={confirmBy}
          onConfirmByChanged={loadRecovery}
          onLeft={onSignOut}
        />
      </>
    );
  }

  return (
    <div className="screen account-screen">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('account.back')} onPress={onClose}>
          <BackIcon />
        </Button>
        <span className="title">{t('account.title')}</span>
      </div>
      <div className="scroll account-scroll">
        <div className="account-card account-screen-card">
          {preferencesRegion}
          {signedInRegions}
        </div>
      </div>
    </div>
  );
}

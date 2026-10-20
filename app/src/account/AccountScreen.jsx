// AccountScreen — the account surface (account.account_screen; workflow 13 §The
// account screen; design.theme_picker; mockup Theme-picker.dc.html). One
// full-screen surface, reached from the header, with three regions:
//
//   1. Preferences — a Theme picker (Automatic, Estante, Caderno, Palco), a
//      Density picker (Compact, Comfortable, Roomy), the Chord diagrams Hand and
//      Neck pickers with one live diagram sample (shell.display_preferences),
//      and a Language picker (the four LOCALES), present and writable whether or not
//      the user is signed in (preferences live in the local home book from the
//      first minute). A choice is a Worker command (SET_THEME / SET_LANGUAGE)
//      that writes the `{ value, at }` register through the home book; the view
//      only dispatches and reads the `preferences` slice, and ThemeRoot /
//      LocaleRoot re-apply off it live (DIRECTION §3.7; Constraints). Automatic
//      is the absent register (Decision 3), so choosing it clears the register.
//   2. Signed-in devices (additive, when signed in) — the account's sessions,
//      the current one marked, with sign out for any *other* device (revokes its
//      session). The current device's sign-out sits with who is signed in (the
//      identity block), not on its row (account.preferences_layout Decision 5),
//      and delegates to an `onSignOut` seam account.sign_out fills (Decision 4).
//   3. Passkeys (additive, when signed in) — listed, removable, and "add a
//      passkey to this device" reusing the authed register flow. While the
//      account has no confirmed email, its only passkey is its last way in and
//      has no Remove (workflow 13 §The last way in).
//   4. Recovery email (additive, when signed in; account.recovery_email) — the
//      RecoveryEmailRegion, read after the passkeys. It also tells Leaving how a
//      deletion is confirmed (`confirmBy`: the typed email, or a passkey).
//
// Phone and tablet draw one column, Preferences first; a computer
// (ACCOUNT_WIDE_QUERY) draws a rail with the title and who is signed in beside
// Preferences in two columns (account.preferences_layout; Theme-picker #4).
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

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
import {
  THEMES,
  resolveDensity,
  resolveDiagramDisplay,
} from '../theme/resolve.js';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import { parseChord } from '../core/notation/parse.js';
import { fromCatalog } from '../core/instrument.js';
import { fingeringFromFrets } from '../core/search.js';
import { orderedBooks } from '../books/book-display.js';
import { useSlice } from '../worker/useStore.js';
import { ACCOUNT_WIDE_QUERY } from '../shell/layout-mode.js';
import { command, CommandKind } from '../worker/protocol.js';
import { createSharingClient } from '../books/sharing-client.js';
import { createAuthClient, AuthError } from './auth-client.js';
import SignOutDialog from './SignOutDialog.jsx';
import LeaveDialogs from './LeaveDialogs.jsx';
import RecoveryEmailRegion from './RecoveryEmailRegion.jsx';
import { isLastWayIn } from './recovery-email.js';
import { useOnline } from './use-online.js';
import RecoveryBanner from '../shell/RecoveryBanner.jsx';
import { showsRecoveryBanner } from '../shell/account-status.js';
import { createCredential, isCancellation } from './webauthn-json.js';
import './account.css';

// The real client, bound to the browser's fetch; the behavior level injects a
// loopback double instead (like SignIn / the sharing surfaces).
const DEFAULT_CLIENT = createAuthClient();

// The sharing client for the Leaving region's who-loses-access counts
// (listMembers). Bound to the browser's fetch; the behavior level injects a
// loopback double.
const DEFAULT_SHARING_CLIENT = createSharingClient();

// The account screen's computer split (account.preferences_layout Decision 3;
// see `ACCOUNT_WIDE_QUERY` in layout-mode.js for why it is a computer line, not
// the shell's 600px). The same `matchMedia`/`useSyncExternalStore` seam the
// shell and the shelf use; a missing `matchMedia` (jsdom) reads as not-wide, so a
// behavior render defaults to the one column.
function accountWideQuery() {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia(ACCOUNT_WIDE_QUERY)
    : null;
}

function subscribeAccountWide(onChange) {
  const query = accountWideQuery();
  if (!query?.addEventListener) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readAccountWide() {
  return accountWideQuery()?.matches ?? false;
}

function useAccountWide() {
  return useSyncExternalStore(subscribeAccountWide, readAccountWide, readAccountWide);
}

// The four theme choices, in mockup order: Automatic (the absent register) then
// the three drawn themes. `id` is what SET_THEME carries (CHOSEN_THEMES).
const THEME_OPTIONS = [
  { id: 'automatic', name: 'themeAutomatic', meta: 'themeAutomaticMeta', swatch: 'auto' },
  { id: 'estante', name: 'themeEstante', meta: 'themeEstanteMeta', swatch: 'estante' },
  { id: 'caderno', name: 'themeCaderno', meta: 'themeCadernoMeta', swatch: 'caderno' },
  { id: 'palco', name: 'themePalco', meta: 'themePalcoMeta', swatch: 'palco' },
];

// The three densities, in mockup order, each with its sample chart line drawn at
// that density's --chart-size (theme.css .density-*). `id` is what SET_DENSITY
// carries (DENSITIES). The description is short on a phone, long wider up
// (Theme-picker board); Comfortable's is "The default" either way.
const DENSITY_OPTIONS = [
  { id: 'compact', name: 'densityCompact', meta: 'densityCompactMeta', long: 'densityCompactMetaLong', size: '15px' },
  { id: 'comfortable', name: 'densityComfortable', meta: 'densityComfortableMeta', long: 'densityComfortableMeta', size: '17px' },
  { id: 'roomy', name: 'densityRoomy', meta: 'densityRoomyMeta', long: 'densityRoomyMetaLong', size: '19px' },
];

// The chord-diagram choices (workflow 16 §How diagrams are drawn): `id` is
// what SET_DIAGRAM_HANDED / SET_DIAGRAM_ORIENTATION carry (HANDS / ORIENTATIONS).
const HAND_OPTIONS = [
  { id: 'right', name: 'diagramHandRight', meta: 'diagramHandRightMeta' },
  { id: 'left', name: 'diagramHandLeft', meta: 'diagramHandLeftMeta' },
];
const NECK_OPTIONS = [
  { id: 'vertical', name: 'diagramNeckVertical', meta: 'diagramNeckVerticalMeta' },
  { id: 'horizontal', name: 'diagramNeckHorizontal', meta: 'diagramNeckHorizontalMeta' },
];

// The live diagram sample: C x32010 on a standard-tuned guitar, as the board
// draws it — a fixed, known shape that shows the mirror unambiguously. Drawn
// by ChordDiagram, so it follows the choice through ThemeRoot's context.
const SAMPLE_GUITAR = fromCatalog('6guitar');
const SAMPLE_CHORD = parseChord('C').chord;
const SAMPLE_SHAPE = fingeringFromFrets(['x', 3, 2, 0, 1, 0], SAMPLE_CHORD, SAMPLE_GUITAR);

// The density sample: one chart line at the option's chart size. Decorative —
// the name and description carry the meaning — so hidden from assistive tech.
function DensitySample({ size }) {
  return (
    <span className="account-density-sample" aria-hidden="true">
      <span className="chart" style={{ '--chart-size': size }}>
        <span className="sung">
          <span className="s">
            <span className="c">G</span>
            <span className="w">Tarde</span>
          </span>
        </span>
      </span>
    </span>
  );
}

// A description that is short on a phone and long wider up (the board's two
// copies); the stylesheet shows one. Equal copies render once.
function ResponsiveMeta({ short, long }) {
  if (short === long) return short;
  return (
    <>
      <span className="account-meta-short">{short}</span>
      <span className="account-meta-long">{long}</span>
    </>
  );
}

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

// A destructive-action confirm (the sharing surfaces’ RAC Dialog pattern, without
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
  // The not-signed-in card's one way in: AppShell opens the sign-in surface at
  // its two sections (account.sign_in_two_doors).
  onSignIn = () => {},
  // Opened from the banner's *Add one*: bring the Recovery email region into
  // view with focus in it, once it has been read.
  focusRecovery = false,
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

  // Density and the diagram's hand and neck read through the same resolvers
  // ThemeRoot applies, so an absent, tombstoned or unknown register marks the
  // default Selected — and nothing writes until the user chooses (§4.1).
  const chosenDensity = resolveDensity(preferences?.density?.value);
  const { handed: chosenHand, orientation: chosenNeck } = resolveDiagramDisplay(preferences);
  const chooseDensity = (density) =>
    store.send(command(CommandKind.SET_DENSITY, { density }));
  const chooseHand = (handed) =>
    store.send(command(CommandKind.SET_DIAGRAM_HANDED, { handed }));
  const chooseNeck = (orientation) =>
    store.send(command(CommandKind.SET_DIAGRAM_ORIENTATION, { orientation }));

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
  // Each request to bring the Recovery email region into focus (the banner's
  // *Add one*, here or from the shell); 0 is none.
  const [recoveryFocus, setRecoveryFocus] = useState(focusRecovery ? 1 : 0);
  const addInFlight = useRef(false);
  const online = useOnline();
  const wide = useAccountWide();

  // Hold the client in a ref (the useSharing pattern, sharing-parts.jsx): a stable value so the
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
  // cascade (react-hooks/set-state-in-effect; the useSharing reload pattern).
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

  // Preferences as four regions in workflow 13's order — Theme, Density, Chord
  // diagrams, Language — each its own column so the computer split can pair
  // consecutive ones (Theme | Density, Chord diagrams | Language; Theme-picker
  // #4) without reordering anything (account.preferences_layout Decision 4).
  const preferencesHeading = <div className="t-h3">{t('account.preferences')}</div>;

  const themeRegion = (
    <div className="account-pref">
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
    </div>
  );

  const densityRegion = (
    <div className="account-pref">
      <div className="t-h3 account-subhead">{t('account.density')}</div>
      <RadioGroup
        className="list account-list"
        aria-label={t('account.density')}
        value={chosenDensity}
        onChange={chooseDensity}
      >
        {DENSITY_OPTIONS.map((opt) => (
          <PickerRow
            key={opt.id}
            value={opt.id}
            name={t(`account.${opt.name}`)}
            meta={<ResponsiveMeta short={t(`account.${opt.meta}`)} long={t(`account.${opt.long}`)} />}
          >
            <DensitySample size={opt.size} />
          </PickerRow>
        ))}
      </RadioGroup>
    </div>
  );

  const diagramsRegion = (
    <div className="account-pref">
      <div className="t-h3 account-subhead">{t('account.diagrams')}</div>
      <div className="account-diagram-sample">
        <div className="card account-diagram-sample-card">
          <ChordDiagram
            fingering={SAMPLE_SHAPE}
            context={{ chord: SAMPLE_CHORD, instrument: SAMPLE_GUITAR }}
            kind="song"
          />
        </div>
        <p className="t-small account-note">{t('account.diagramsNote')}</p>
      </div>
      <div className="account-diagram-group">
        <span className="t-small account-diagram-label">{t('account.diagramHand')}</span>
        <RadioGroup
          className="list account-list account-tiles"
          aria-label={t('account.diagramHand')}
          value={chosenHand}
          onChange={chooseHand}
        >
          {HAND_OPTIONS.map((opt) => (
            <PickerRow
              key={opt.id}
              value={opt.id}
              name={t(`account.${opt.name}`)}
              meta={<span className="account-meta-long">{t(`account.${opt.meta}`)}</span>}
            />
          ))}
        </RadioGroup>
      </div>
      <div className="account-diagram-group">
        <span className="t-small account-diagram-label">{t('account.diagramNeck')}</span>
        <RadioGroup
          className="list account-list account-tiles"
          aria-label={t('account.diagramNeck')}
          value={chosenNeck}
          onChange={chooseNeck}
        >
          {NECK_OPTIONS.map((opt) => (
            <PickerRow
              key={opt.id}
              value={opt.id}
              name={t(`account.${opt.name}`)}
              meta={<span className="account-meta-long">{t(`account.${opt.meta}`)}</span>}
            />
          ))}
        </RadioGroup>
      </div>
    </div>
  );

  const languageRegion = (
    <div className="account-pref account-pref-language">
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
    </div>
  );

  const notSignedInCard = (
    <div className="card pad account-signin-card">
      <span className="t-h2">{t('account.notSignedIn')}</span>
      <span className="t-small">{t('account.notSignedInBody')}</span>
      <Button className="btn primary block" onPress={() => onSignIn()}>
        {t('account.signInOrMake')}
      </Button>
    </div>
  );

  // Who is signed in, with *Sign out of this device* beside it (workflow 13 §The
  // account screen, as amended; Theme-picker #3/#4, W13 #4): one button on every
  // viewport — at the end of the row on a phone and tablet, a block button under
  // the identity in the computer rail (account.preferences_layout Decision 5).
  const identityBlock = (
    <div className="account-identity">
      <span className="account-identity-who">
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
      </span>
      <SignOutDialog store={store} authClient={authClient} onSignedOut={onSignOut} block={wide} />
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
              {session.current ? null : (
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
      {identityBlock}
      <p className="t-small account-note" role="status">
        {t('account.offlineManage')}
      </p>
    </>
  );

  const probeWasOffline = probeError instanceof AuthError && probeError.kind === 'network';

  // Each signed-in state as its who-block (what the computer rail holds) and the
  // regions that follow Preferences (only when signed in).
  let whoBlock = null;
  let accountRegions = null;
  if (auth === 'loading') {
    whoBlock = (
      <p className="t-small account-note" role="status">
        {t('account.loading')}
      </p>
    );
  } else if (auth === 'error') {
    whoBlock =
      probeWasOffline && hasAccountBooks ? (
        offlineSignedOutRegion
      ) : (
        <ErrorNotice message={errorCopy(probeError ?? actionError)} onRetry={probe} />
      );
  } else if (auth === 'out') {
    whoBlock = notSignedInCard;
  } else {
    whoBlock = identityBlock;
    accountRegions = (
      <>
        {actionError ? <ErrorNotice message={errorCopy(actionError)} onRetry={() => setActionError(null)} /> : null}
        {devicesRegion}
        {passkeysRegion}
        <RecoveryEmailRegion
          recovery={recovery}
          loadError={recoveryError}
          authClient={authClient}
          online={online}
          onReload={loadRecovery}
          focusRequest={recoveryFocus}
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

  // While the account has no confirmed recovery email the banner is here too,
  // from this screen's own read, so it follows the region as it reloads
  // (workflow 13 §The banner). Its *Add one* asks for the region in place.
  const banner = showsRecoveryBanner({ status: auth, recovery }) ? (
    <RecoveryBanner onAddOne={() => setRecoveryFocus((n) => n + 1)} />
  ) : null;

  const backButton = (
    <Button className="btn icon" aria-label={t('account.back')} onPress={onClose}>
      <BackIcon />
    </Button>
  );

  // On a computer: the rail (title, who is signed in, sign-out — or the way to
  // sign in) beside Preferences in two columns, the account's regions full width
  // below (Theme-picker #4, W13 #4). The rail comes first in the DOM and each
  // row pairs consecutive regions, so reading and focus order stay workflow
  // 13's order with no CSS reordering (account.preferences_layout Decision 6).
  if (wide) {
    return (
      <div className="screen account-screen">
        <div className="split account-split">
          <div className="pane side account-rail">
            <div className="account-rail-body">
              <div className="account-rail-head">
                {backButton}
                <span className="t-h1 account-rail-title">{t('account.title')}</span>
              </div>
              {whoBlock}
            </div>
          </div>
          <div className="pane main">
            {banner}
            <div className="scroll account-main">
              {preferencesHeading}
              <div className="account-pref-row">
                {themeRegion}
                {densityRegion}
              </div>
              <div className="account-pref-row">
                {diagramsRegion}
                {languageRegion}
              </div>
              {accountRegions}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // On a phone and a tablet: one column, Preferences first (Theme-picker #1/#2).
  return (
    <div className="screen account-screen">
      <div className="appbar">
        {backButton}
        <span className="title">{t('account.title')}</span>
      </div>
      {banner}
      <div className="scroll account-scroll">
        <div className="account-card account-screen-card">
          {preferencesHeading}
          {themeRegion}
          {densityRegion}
          {diagramsRegion}
          {languageRegion}
          {whoBlock}
          {accountRegions}
        </div>
      </div>
    </div>
  );
}

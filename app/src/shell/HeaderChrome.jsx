// HeaderChrome — the one bar's shared pieces (shell.one_bar). Every screen
// draws one bar at its top, in the phone's format on every device: on the
// three destinations it leads with the *Estante* wordmark (and, on a tablet or
// computer, the Search · Books · Setlists tabs beside it); on a deeper screen
// Back takes the wordmark's place, then the screen's title and actions. Every
// bar ends the same way — `BarEnd`: the instrument chip (tablet and computer;
// the phone's chip lives in the screen), Help about the page, and the account.
// There is no sidebar: tablet and computer draw the phone's layout, wider.
//
// The shell provides what the end of the bar needs through `ShellChrome` — the
// store, the layout mode, what it knows of the account, and how to open the
// instruments and the account screen — so a screen adds the end of its bar with
// one element. Rendered outside the shell (a screen's own behavior test), the
// context is absent and `BarEnd` draws only the Help it was given.
// The wordmark is text, not a heading — each screen keeps its own `h1`.

import { createContext, useContext, useId } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import InstrumentChip from '../instruments/InstrumentChip.jsx';
import HelpButton from '../help/Help.jsx';

/**
 * What the shell lends every bar: `{ store, mode, accountStatus, onInstruments,
 * onAccount }`, or null outside the shell.
 */
export const ShellChrome = createContext(null);

// The account affordance (account.account_screen acceptance 1; DIRECTION §6
// line 545): the last thing on every bar, signed in or not; pressing it opens
// the account screen. Its name says what it does; whether someone is signed in
// is drawn (a filled circle when signed in, the outline when not) and also said,
// as its description — never the fill alone. While the device does not yet know
// (`unknown`, offline before the first answer) it draws the outline and says
// nothing about it.
export function AccountButton({ onOpen, status = 'unknown' }) {
  const descriptionId = useId();
  const known = status === 'in' || status === 'out';
  const signedIn = status === 'in';
  return (
    <>
      <Button
        className={`btn icon account-open${signedIn ? ' signed-in' : ''}`}
        aria-label={t('account.open')}
        aria-describedby={known ? descriptionId : undefined}
        onPress={onOpen}
      >
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
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      </Button>
      {known ? (
        <span id={descriptionId} className="visually-hidden">
          {t(signedIn ? 'account.statusIn' : 'account.statusOut')}
        </span>
      ) : null}
    </>
  );
}

/**
 * The end of every bar: the instrument chip, Help, the account.
 *
 * @param {object} props
 * @param {string} [props.help]  the page's help id; none draws no Help
 * @param {import('react').ReactNode|boolean} [props.chip]  the chip slot: left
 *   out, the shell's chip on a tablet or computer and none on the phone; `true`
 *   always the shell's chip; `false` none; a node draws that node instead (a
 *   screen whose chip names a mode, or opens its own roster)
 * @param {boolean} [props.account]  false leaves the account out (the account
 *   screen itself)
 */
export function BarEnd({ help, chip, account = true }) {
  const shell = useContext(ShellChrome);
  let chipNode = null;
  if (chip && typeof chip === 'object') chipNode = chip;
  else if (shell && (chip === true || (chip === undefined && shell.mode === 'wide'))) {
    chipNode = <InstrumentChip store={shell.store} onOpen={shell.onInstruments} />;
  }
  return (
    <>
      {chipNode ? <span className="bar-end-gap" aria-hidden="true" /> : null}
      {chipNode}
      {help ? <HelpButton page={help} /> : null}
      {shell && account ? <AccountButton onOpen={shell.onAccount} status={shell.accountStatus} /> : null}
    </>
  );
}

/**
 * A destination's bar: the wordmark, then whatever leads the row (the tabs on a
 * tablet or computer), then the end of the bar with the chip on every device.
 */
export default function HeaderChrome({ className, helpPage, children }) {
  return (
    <div className={`header-chrome ${className ?? ''}`.trim()}>
      <span className="t-h1 wordmark">{t('app.wordmark')}</span>
      {children}
      <span className="header-chrome-space" />
      <BarEnd help={helpPage} chip />
    </div>
  );
}

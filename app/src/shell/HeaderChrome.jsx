// HeaderChrome — the header as the boards draw it (shell.header_chrome; W01
// phone 1 / computer, W02 phone 1 / computer): the *Estante* wordmark, the
// instrument chip and, where the board draws one, the account affordance. One
// cluster reused in four spots — the phone's header row above every destination,
// the tablet/computer side header, and the head of the search rail beside an
// open song or the chord explorer (no account button there). Not a shared app
// bar: deep screens keep their own `.appbar` (shell.layout parking lot). The
// wordmark is text, not a heading — each destination keeps its own `h1`.

import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import InstrumentChip from '../instruments/InstrumentChip.jsx';

// The header account affordance (account.account_screen acceptance 1; DIRECTION
// §6 line 545; mockup Theme-picker — "reached from the header"). Shell chrome
// present on every destination, signed in or not; pressing it opens the account
// surface. An icon button with an accessible name that says what it does — the
// person glyph is decorative.
export function AccountButton({ onOpen }) {
  return (
    <Button className="btn icon account-open" aria-label={t('account.open')} onPress={onOpen}>
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
  );
}

export default function HeaderChrome({ store, className, onInstruments, onAccount }) {
  return (
    <div className={`header-chrome ${className ?? ''}`.trim()}>
      <span className="t-h1 wordmark">{t('app.wordmark')}</span>
      <InstrumentChip store={store} onOpen={onInstruments} />
      {onAccount ? <AccountButton onOpen={onAccount} /> : null}
    </div>
  );
}

// RecoveryBanner — the fixed notice an account carries while it has no confirmed
// recovery email (account.sign_in_two_doors; workflow 13 §The banner; boards
// W13 #2, W01 #4, Sign-in Tablet). The shell draws it below the header chrome
// (or at the top of a screen without one) and the account screen across the
// head of its main pane; who decides it is shown is `showsRecoveryBanner`.
//
// It is a plain labelled section, not a live region: it is there whenever the
// screen is, so nothing announces it again on a tab change. It is not
// dismissible and has no timer — it goes when the address is confirmed. So it
// keeps to one compact row: its state in words (*No recovery email yet.*), in
// the warning tone of the region's *No recovery email* badge (`.notice.unsaved`,
// each theme's tokens), and **Add one**, which opens the account screen at the
// Recovery email region. The title is also a disclosure: pressed, the row
// grows the sentence that says why (*If you lose your passkeys…*), and pressed
// again it folds back (the persona exploration of 2026-11-01).

import { useId, useState } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import './recovery-banner.css';

// The warning glyph (W13 #2); decorative.
function WarnIcon() {
  return (
    <svg
      className="recovery-banner-icon"
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
      <path d="M12 3l10 18H2zM12 10v5M12 18h.01" />
    </svg>
  );
}

// The disclosure's chevron; decorative, turned by the open state.
function Chevron() {
  return (
    <svg
      className="recovery-banner-chevron"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function RecoveryBanner({ onAddOne = () => {} }) {
  const titleId = useId();
  const moreId = useId();
  const [open, setOpen] = useState(false);
  return (
    <section className="notice unsaved recovery-banner" aria-labelledby={titleId} data-open={open || undefined}>
      <WarnIcon />
      <span className="recovery-banner-body">
        <span className="recovery-banner-text">
          <Button
            className="recovery-banner-toggle"
            aria-expanded={open}
            aria-controls={moreId}
            onPress={() => setOpen((was) => !was)}
          >
            <b id={titleId}>{t('account.bannerTitle')}</b>
            <Chevron />
          </Button>{' '}
          <span id={moreId} className="recovery-banner-more" hidden={!open}>
            {t('account.bannerBody')}
          </span>
        </span>
        <Button className="btn" onPress={onAddOne}>
          {t('account.bannerAdd')}
        </Button>
      </span>
    </section>
  );
}

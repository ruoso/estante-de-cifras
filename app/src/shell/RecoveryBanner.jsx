// RecoveryBanner — the fixed notice an account carries while it has no confirmed
// recovery email (account.sign_in_two_doors; workflow 13 §The banner; boards
// W13 #2, W01 #4, Sign-in Tablet). The shell draws it below the header chrome
// (or at the top of a screen without one) and the account screen across the
// head of its main pane; who decides it is shown is `showsRecoveryBanner`.
//
// It is a plain labelled section, not a live region: it is there whenever the
// screen is, so nothing announces it again on a tab change. It is not
// dismissible and has no timer — it goes when the address is confirmed. Its
// state is in words (*No recovery email yet.*), in the warning tone of the
// region's *No recovery email* badge (`.notice.unsaved`, each theme's tokens),
// and its one control, **Add one**, opens the account screen at the Recovery
// email region.

import { useId } from 'react';
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

export default function RecoveryBanner({ onAddOne = () => {} }) {
  const titleId = useId();
  return (
    <section className="notice unsaved recovery-banner" aria-labelledby={titleId}>
      <WarnIcon />
      <span className="recovery-banner-body">
        <span>
          <b id={titleId}>{t('account.bannerTitle')}</b> {t('account.bannerBody')}
        </span>
        <Button className="btn" onPress={onAddOne}>
          {t('account.bannerAdd')}
        </Button>
      </span>
    </section>
  );
}

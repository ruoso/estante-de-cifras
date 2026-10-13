// InvitedScreen — the pre-account door into a shared book (books.add_by_link,
// workflow 1 §Invited; mockup W01). A full-screen surface mounted by AppShell
// when the app boots on an invitation link (`/i/<token>`) and the Worker reports
// it needs an account (NEED_ACCOUNT), or the link is dead/full (BOOK_REFUSED).
//
// It is strictly account-first and strictly GENERIC before sign-in (Decision 1,
// the design delta to workflow 1 §Invited): it names only "a book on Estante",
// never the title or the owner, because the service reveals nothing about a book
// — alive, dead or full — without a session, and a live link cannot be told from
// a dead one until it is accepted. So the book's name and the role it grants
// appear only AFTER sign-in and accept, on the shelf and the book it opens on —
// never here. A dead or full link is worded off the machine-readable reason and
// likewise names nothing about the book (workflow 1 §Invited L53-58).
//
// Presentational with React Aria Components, managed focus on each phase's
// heading, every status a word (never colour alone). The passkey ceremony itself
// is the SignIn surface, opened through `onMakeAccount` / `onSignIn`.

import { useEffect, useRef } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import './account.css';

// The key glyph of the passkey card (W01 L77); decorative.
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

// The copy for each refusal, keyed off the Worker's reason word — never naming
// the book (a dead link reveals nothing, workflow 1 §Invited L53-58). 'full' is
// the one refusal told apart, so the person knows to ask the owner (workflow 1
// §Invited); 'dead' conflates expired/withdrawn/exhausted and a non-member
// request; 'error' is a transport failure (offline / a 5xx).
function refusalCopy(reason) {
  if (reason === 'full') {
    return { title: t('invited.fullTitle'), body: t('invited.fullBody'), addByLink: false };
  }
  if (reason === 'error') {
    return { title: t('invited.errorTitle'), body: t('invited.errorBody'), addByLink: false };
  }
  return { title: t('invited.deadTitle'), body: t('invited.deadBody'), addByLink: true };
}

export default function InvitedScreen({
  // 'working' (accepting / cloning), 'prompt' (needs an account), or 'refused'.
  phase = 'working',
  // For 'refused': 'full' | 'dead' | 'error' (books.add_by_link reason word).
  reason = 'dead',
  onMakeAccount = () => {},
  onSignIn = () => {},
  onAddByLink = () => {},
  onClose = () => {},
}) {
  const headingRef = useRef(null);

  // Land the keyboard and a screen reader on each phase's heading as it appears.
  useEffect(() => {
    headingRef.current?.focus();
  }, [phase]);

  let content;
  if (phase === 'working') {
    content = (
      <>
        <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
          {t('invited.workingHeading')}
        </h2>
        <p className="t-body account-sub" role="status">
          {t('invited.working')}
        </p>
      </>
    );
  } else if (phase === 'refused') {
    const copy = refusalCopy(reason);
    content = (
      <>
        <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
          {copy.title}
        </h2>
        <p className="t-body account-sub" role="alert">
          {copy.body}
        </p>
        {copy.addByLink ? (
          <Button className="btn quiet block" onPress={onAddByLink}>
            {t('invited.addByLink')}
          </Button>
        ) : null}
        <Button className="btn primary block" onPress={onClose}>
          {t('invited.ok')}
        </Button>
      </>
    );
  } else {
    // 'prompt' — the account-first ask. Generic: names only "a book on Estante".
    content = (
      <>
        <h2 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
          {t('invited.promptHeading')}
        </h2>
        <p className="t-body account-sub">{t('invited.promptBody')}</p>
        <div className="card pad">
          <div className="invited-passkey-head">
            <PasskeyIcon />
            <span className="invited-passkey-title">{t('invited.passkeyTitle')}</span>
          </div>
          <span className="t-small">{t('invited.passkeyBody')}</span>
        </div>
        <Button className="btn primary block" onPress={onMakeAccount}>
          {t('invited.makeAccount')}
        </Button>
        <Button className="btn block" onPress={onSignIn}>
          {t('invited.signIn')}
        </Button>
        <p className="t-small account-note">{t('invited.promptFooter')}</p>
      </>
    );
  }

  return (
    <div className="screen account-screen">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('invited.close')} onPress={onClose}>
          <CloseIcon />
        </Button>
        <span className="title">{t('invited.brand')}</span>
      </div>
      <div className="scroll account-scroll">
        <div className="account-card">{content}</div>
      </div>
    </div>
  );
}

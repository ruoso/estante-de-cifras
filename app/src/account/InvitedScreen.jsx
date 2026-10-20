// InvitedScreen — the pre-account door into a shared book (books.add_by_link,
// workflow 1 §Invited; mockup W01 #2). A full-screen surface mounted by AppShell
// when the app boots on an invitation link (`/i/<token>`) while the accept runs.
// When the Worker reports it needs an account (NEED_ACCOUNT) the door is the one
// sign-in surface with the invitation as its lead — `InvitedLead` and
// `InvitedFooter` below, around SignIn's two sections (account.sign_in_two_doors
// Decision *The invitation's prompt is the sign-in surface*). A dead or full
// link (BOOK_REFUSED) is not this screen but InvitedRefusal, a dialog over the
// shelf (books.invited_presentation).
//
// It is strictly account-first and strictly GENERIC before sign-in (Decision 1,
// the design delta to workflow 1 §Invited): it names only "a book on Estante",
// never the title or the owner, because the service reveals nothing about a book
// — alive, dead or full — without a session, and a live link cannot be told from
// a dead one until it is accepted. So the book's name and the role it grants
// appear only AFTER sign-in and accept, on the shelf and the book it opens on —
// never here.
//
// Presentational with React Aria Components, managed focus on each phase's
// heading — which takes focus without drawing a ring, since it is not operable
// (books.invited_presentation Decision 2) — every status a word. The passkey
// ceremonies are the SignIn surface's own, pressed in place.

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

// The book mark above the heading (W01 #2 L70), in the accent colour;
// decorative — it repeats nothing the heading does not say (Decision 5).
function BookMark() {
  return (
    <svg
      className="invited-mark"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-.8 3 15.6-3.5.8z" />
    </svg>
  );
}

// The account-first ask that heads the sign-in surface on an invitation
// (workflow 1 §Invited; W01 #2): the book mark, the heading — which SignIn
// focuses as the step appears — the body and the *An account is a passkey*
// card. Generic: it names only "a book on Estante", never the book.
export function InvitedLead() {
  return (
    <>
      <BookMark />
      <h2 className="t-h1 invited-heading" tabIndex={-1}>
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
    </>
  );
}

// What follows the two sections on an invitation (W01 #2).
export function InvitedFooter() {
  return <p className="t-small account-note">{t('invited.promptFooter')}</p>;
}

// The working phase: the accept (and the clone) running, after sign-in or on a
// device already signed in. A refusal is not this screen: it is InvitedRefusal,
// a dialog over the shelf.
export default function InvitedScreen({ onClose = () => {} }) {
  const headingRef = useRef(null);

  // Land the keyboard and a screen reader on the heading as it appears.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const content = (
    <>
      <h2 className="t-h1 invited-heading" ref={headingRef} tabIndex={-1}>
        {t('invited.workingHeading')}
      </h2>
      <p className="t-body account-sub" role="status">
        {t('invited.working')}
      </p>
    </>
  );

  return (
    <div className="screen account-screen">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('invited.close')} onPress={onClose}>
          <CloseIcon />
        </Button>
        <span className="title">{t('invited.brand')}</span>
      </div>
      <div className="scroll account-scroll invited-scroll">
        <div className="account-card">
          <BookMark />
          {content}
        </div>
      </div>
    </div>
  );
}

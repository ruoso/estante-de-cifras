// NotHere — what an address opens when what it names is not on this device
// (shell.routing; workflow 7 §Links to books). A full-screen surface mounted by
// AppShell in place of the reading view or the setlist, never an empty one:
//
//   - kind 'book': the book is not on the shelf. It names nothing about the
//     book — the app cannot tell a book that is not yours from one of yours not
//     yet added here (workflow 1 §Invited L61-66) — and reuses the dead
//     invitation's words, so both dead ends read alike (Decision 6).
//   - kind 'song' / 'setlist': the book is here but the path is not in its
//     tree — renamed, moved or deleted (workflow 12 L83-85's *missing*). It
//     names the book, and offers its songs.
//
// React Aria buttons, focus on the heading as it appears, the state in words.

import { useEffect, useRef } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import '../account/account.css';

function BackIcon() {
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
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default function NotHere({
  // 'book' | 'song' | 'setlist'
  kind = 'book',
  // The book's label, for the item states only (never shown for 'book').
  bookLabel = '',
  onBack = () => {},
  onGoToBooks = () => {},
  onOpenBook = () => {},
}) {
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [kind]);

  const isBook = kind === 'book';
  const title = isBook
    ? t('notHere.bookTitle')
    : t(kind === 'setlist' ? 'notHere.setlistTitle' : 'notHere.songTitle', { book: bookLabel });

  return (
    <div className="screen account-screen not-here">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('notHere.back')} onPress={onBack}>
          <BackIcon />
        </Button>
        <span className="title">{t('notHere.brand')}</span>
      </div>
      <div className="scroll account-scroll">
        <div className="account-card">
          <h1 className="t-display account-heading" ref={headingRef} tabIndex={-1}>
            {title}
          </h1>
          <p className="t-body account-sub">{isBook ? t('notHere.bookBody') : t('notHere.itemBody')}</p>
          {isBook ? (
            <Button className="btn primary block" onPress={onGoToBooks}>
              {t('notHere.goToBooks')}
            </Button>
          ) : (
            <Button className="btn primary block" onPress={onOpenBook}>
              {t('notHere.openBook', { book: bookLabel })}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

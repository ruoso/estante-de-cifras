// SavedNotice — the word that a save landed (the persona exploration of
// 2026-11-01: after Save the sheet closed and nothing said it worked). Every
// SAVED the Worker sends — a song, several, a setlist — shows *Saved to {book}*
// for a few seconds over the shell, then goes. Like the update notice it is
// non-modal: it covers no control, takes no focus, and its role="status"
// announces it without moving focus (workflow 8: nothing interrupts a
// performance, and nothing saves during one).

import { useEffect, useState } from 'react';
import { t } from '../i18n/index.js';
import { EventKind } from '../worker/protocol.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { bookLabelFor } from '../songs/first-run.js';
import './saved-notice.css';

// How long the word stays, in ms.
export const SAVED_NOTICE_MS = 4000;

export default function SavedNotice({ store }) {
  const shelf = useSlice(store, 'shelf');
  // The book of the last save and a count, so a second save restarts the timer.
  const [saved, setSaved] = useState(null);
  useWorkerEvent(store, EventKind.SAVED, ({ bookId }) => {
    setSaved((prev) => ({ bookId, n: (prev?.n ?? 0) + 1 }));
  });
  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(null), SAVED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [saved]);
  if (!saved) return null;
  return (
    <div className="notice accent saved-notice" role="status">
      {t('shell.savedTo', { book: bookLabelFor(shelf, saved.bookId, t('books.untitled')) })}
    </div>
  );
}

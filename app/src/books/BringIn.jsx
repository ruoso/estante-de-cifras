// BringIn.jsx — the *Bring them in* screen (books.bring_in; workflow 11
// §Following the original; W11 board #3). Opened full screen over the shelf from
// a fork's *Bring them in* button (Decision 3, the upload's precedent): it asks
// the Worker to fetch the original and preview what bringing it in would do
// (PREVIEW_BRING_IN), shows how many new saves there are and the songs they
// touch song by song (the upload preview's rows, PreviewRows), a note already
// written, and a notice naming every song that meets the user's own edits.
// *Bring them in* sends BRING_IN with the note; *Not now* sends CANCEL_BRING_IN.
// Nothing is written to the fork until the user confirms (never automatic).
//
// The Worker owns git, the network and the merge (DIRECTION §3.7): this view
// only sends the three bring-in commands and reacts to BRING_IN_PREVIEW /
// BRING_IN_DONE for its own `bookId` (there are no correlation ids). Offline or
// with the original unreachable, the preview says so plainly and nothing
// changes (Constraint 2). A collision hands off to the conflict surface
// (workflow 9) the way the upload does.
//
// Accessibility: React Aria Components for every control (the back button, the
// note's TextField, *Not now*, *Bring them in*); focus goes to the screen's
// heading on open; status is a word (the badges, the notices, the status lines),
// never colour alone (mockups README L26).

import { useEffect, useRef, useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';

import { t, currentLocale } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import PreviewRows, { previewName } from './PreviewRows.jsx';
import './upload-preview.css';
import './bring-in.css';

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

// The locale's list of names (*A, B, and C*), falling back to commas where
// Intl.ListFormat is missing.
function listOf(names) {
  try {
    return new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(names);
  } catch {
    return names.join(', ');
  }
}

// The note already written (Constraint 3): the original's name and the title of
// every row, sorted with the locale's collation.
export function prefilledNote(original, previews) {
  const collator = new Intl.Collator(currentLocale());
  const titles = previews.map(previewName).sort(collator.compare);
  return titles.length
    ? t('books.bringInNotePrefill', { original, titles: listOf(titles) })
    : t('books.bringInNotePrefillEmpty', { original });
}

/**
 * The full-screen bring-in. `bookId` is the fork, `book` its displayed title,
 * `original` the original's title (the shelf's `original` register — copy names
 * the book, books.fork Decision 4). `onClose` leaves the screen (merged, not
 * now, or back); `onNeedsYou(bookId)` hands a colliding bring-in to the shell
 * so the conflict surface takes over (workflow 9).
 */
export default function BringIn({ store, bookId, book, original, onClose = () => {}, onNeedsYou = () => {} }) {
  const sync = useSlice(store, 'sync');
  // 'fetching' (a PREVIEW_BRING_IN in flight), 'preview', 'busy' (a BRING_IN in
  // flight), 'offline' (unreachable), 'gone' (the original went away, or the
  // book follows nothing), 'needs_you' (the merge collided; waiting for the
  // engine's SYNC to say so before handing off).
  const [state, setState] = useState('fetching');
  const [preview, setPreview] = useState(null);
  const [note, setNote] = useState('');
  const [stale, setStale] = useState(false);

  // The followId of the preview held (for CANCEL_BRING_IN / BRING_IN); null once
  // a BRING_IN is sent — the Worker owns the ref from then on, so no cancel.
  const followIdRef = useRef(null);
  // Whether the user edited the note, so a re-made preview keeps their words.
  const noteEditedRef = useRef(false);
  const headingRef = useRef(null);

  // On mount: focus the heading and ask for the preview. On unmount while a
  // preview is held, drop it (the appbar back, a parent close).
  useEffect(() => {
    headingRef.current?.focus();
    store.send(command(CommandKind.PREVIEW_BRING_IN, { bookId }));
    return () => {
      if (followIdRef.current) {
        store.send(command(CommandKind.CANCEL_BRING_IN, { bookId, followId: followIdRef.current }));
        followIdRef.current = null;
      }
    };
    // Mount once; the screen is for one book for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useWorkerEvent(store, EventKind.BRING_IN_PREVIEW, (reply) => {
    if (reply.bookId !== bookId) return;
    if (reply.gone || reply.error === 'not_following') {
      followIdRef.current = null;
      setState('gone');
      return;
    }
    if (reply.error) {
      followIdRef.current = null;
      setState('offline');
      return;
    }
    followIdRef.current = reply.followId;
    setPreview(reply);
    if (!noteEditedRef.current) setNote(prefilledNote(reply.original?.title || original, reply.previews ?? []));
    setState('preview');
  });

  useWorkerEvent(store, EventKind.BRING_IN_DONE, (reply) => {
    if (reply.bookId !== bookId) return;
    if (reply.kind === 'stale') {
      // Something moved since the preview: make it again and say so (Decision 5).
      setStale(true);
      setState('fetching');
      store.send(command(CommandKind.PREVIEW_BRING_IN, { bookId }));
      return;
    }
    if (reply.kind === 'needs_you') {
      setState('needs_you');
      return;
    }
    onClose();
  });

  // A collision: the engine's SYNC fact follows BRING_IN_DONE, and the shell
  // opens the conflict surface only once the book reads *needs you*.
  const phase = sync?.[bookId]?.phase;
  useEffect(() => {
    if (state === 'needs_you' && phase === 'needs_you') onNeedsYou(bookId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, phase]);

  const notNow = () => {
    if (followIdRef.current) {
      store.send(command(CommandKind.CANCEL_BRING_IN, { bookId, followId: followIdRef.current }));
      followIdRef.current = null;
    }
    onClose();
  };

  const bringIn = () => {
    if (state !== 'preview' || !followIdRef.current) return;
    const followId = followIdRef.current;
    followIdRef.current = null;
    setStale(false);
    setState('busy');
    store.send(command(CommandKind.BRING_IN, { bookId, followId, note }));
  };

  const previews = preview?.previews ?? [];
  const from = preview?.original?.title || original;
  const conflicts = previews.filter((p) => p.status === 'conflict').map(previewName);
  const shown = state === 'preview' || state === 'busy' || state === 'needs_you';
  const busy = state === 'busy' || state === 'needs_you';

  return (
    <div className="screen upload-preview bring-in">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('books.detailBack')} onPress={notNow} isDisabled={busy}>
          <BackIcon />
        </Button>
        <h1 className="title" tabIndex={-1} ref={headingRef}>
          {t('books.bringInTitle', { original })}
        </h1>
      </div>

      <div className="scroll upload-body bring-in-body">
        {stale ? (
          <p className="notice" role="status">
            {t('books.bringInStale')}
          </p>
        ) : null}

        {state === 'fetching' ? (
          <p className="t-small bring-in-status" role="status">
            {t('books.bringInFetching', { original })}
          </p>
        ) : null}

        {state === 'offline' ? (
          <p className="notice" role="status">
            {t('books.bringInOffline')}
          </p>
        ) : null}

        {state === 'gone' ? (
          <p className="notice" role="status">
            {t('books.originalGoneTitle')}
          </p>
        ) : null}

        {shown ? (
          <>
            <p className="t-body">
              {t('books.bringInBody', { count: preview.newSaves ?? 0, original: from, book })}
            </p>
            <PreviewRows previews={previews} />
            <TextField className="field bring-in-note" value={note} isDisabled={busy} onChange={(value) => {
              noteEditedRef.current = true;
              setNote(value);
            }}>
              <Label>{t('books.bringInNote')}</Label>
              <Input className="input" />
            </TextField>
            {conflicts.length ? (
              <p className="notice">
                {t('books.bringInConflict', { count: conflicts.length, songs: listOf(conflicts) })}
              </p>
            ) : null}
            {busy ? (
              <p className="t-small bring-in-status" role="status">
                {t('books.bringInBusy')}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="actions upload-confirm bring-in-actions">
        {shown ? <span className="t-small upload-caption">{t('books.bringInCaption')}</span> : null}
        <Button className="btn" onPress={notNow} isDisabled={busy}>
          {t('books.bringInNotNow')}
        </Button>
        {shown ? (
          <Button className="btn primary" onPress={bringIn} isDisabled={busy}>
            {t('books.bringIn')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// UploadPreview.jsx — the screen a user sees between picking a `.zip` and
// anything being written to a book (books.upload_ui, workflow 7 §Uploading a
// book / §A preview comes first; W07 tablet board). Opened full screen from the
// Add-a-book sheet's Upload way-in: it reads the zip's bytes to the Worker
// (PREVIEW_UPLOAD), renders the returned preview song by song, and sends the
// confirm (IMPORT_UPLOAD) or the dismissal (CANCEL_UPLOAD).
//
// The Worker owns git, the working copy and every merge (DIRECTION §3.7): this
// view only sends the three upload commands and reacts to their replies
// (UPLOAD_PREVIEW / BOOK_CREATED / SYNC / ERROR). It reads the `shelf` slice to
// list the books the user can save to (the merge targets); it never touches
// IndexedDB or git, reads no zip into git and runs no merge (the engine does).
//
// Merge vs replace is derived from the preview's `hasHistory`, both under the one
// "Merge into an existing book" choice (Decision 3): a zip with history merges
// (choice 'merge'); a zip with none is a per-song replace (choice 'replace',
// `perFile`). A colliding merge lands as the engine's ordinary `needs_you` state
// and the existing conflict surface takes over — no resolver lives here
// (Decision 2). A marked text is never imported: an `'unresolved'` row is shown
// left out, not as a choice (Constraints; workflow 7 §A merge left half done).
//
// Accessibility: every interactive part is a React Aria Component with a keyboard
// path and an accessible name — the file picker (the sheet's FileTrigger), the
// `role="radiogroup"` choice, the merge-target picker (a RadioGroup, the app's
// picker idiom), the per-row keep toggles (Checkbox), and the Cancel / confirm
// buttons. Status is a word in the badge, never colour alone (mockups README
// L26). The surface portals nothing of its own; it is a plain full-screen pane.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Radio, RadioGroup } from 'react-aria-components';

import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { titleFor, canSaveFor, orderedBooks } from './book-display.js';
import PreviewRows from './PreviewRows.jsx';
import './upload-preview.css';

// The device commit identity for a shelf-touching command, the same literal the
// shelf and the detail use (BooksScreen.jsx, BookDetail.jsx). The Worker's
// `authorFrom` turns the id into a no-reply address.
const LOCAL_IDENTITY = { id: 'local', name: 'Me' };

function CancelIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * The full-screen upload preview. `bytes` is the picked zip as an ArrayBuffer,
 * `fileName` its name (the appbar title); `onClose` leaves the surface (confirm
 * done, or cancelled); `onNeedsYou(bookId)` hands a colliding merge to the shell
 * so the existing conflict surface takes over (Decision 2).
 */
export default function UploadPreview({
  store,
  bytes,
  fileName,
  onClose = () => {},
  onNeedsYou = () => {},
}) {
  const shelf = useSlice(store, 'shelf');
  const targets = useMemo(
    () => orderedBooks(shelf).filter((e) => canSaveFor(e.kind, e.book) === true),
    [shelf],
  );

  // The user's choice: a new book (always valid, the default — Decision 4) or a
  // merge into one they can save to. `targetId` is the chosen merge target.
  const [choice, setChoice] = useState('new');
  const [targetId, setTargetId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [kept, setKept] = useState(() => new Set());
  const [error, setError] = useState(null);

  // The uploadId of the preview currently shown (for CANCEL_UPLOAD / IMPORT); the
  // import we are waiting a reply for ('new' or a bookId) so we only react to the
  // reply that is ours; and whether a PREVIEW_UPLOAD is still in flight. The live
  // Worker emits ERROR for unrelated failures too, so we only read an ERROR as
  // ours while a preview or an import is pending (there is no correlation id).
  const uploadIdRef = useRef(null);
  const awaitingRef = useRef(null);
  const pendingPreviewRef = useRef(false);

  // Send a fresh PREVIEW_UPLOAD for `target`, cancelling the superseded upload's
  // scratch repo so it does not leak (Decision 5). `preview()` mints a new
  // uploadId per call and classifies against the given target, so every target
  // change re-previews.
  const requestPreview = (target) => {
    if (uploadIdRef.current) {
      store.send(command(CommandKind.CANCEL_UPLOAD, { uploadId: uploadIdRef.current }));
      uploadIdRef.current = null;
    }
    setPreview(null);
    setError(null);
    pendingPreviewRef.current = true;
    store.send(command(CommandKind.PREVIEW_UPLOAD, { target, bytes }));
  };

  // The first preview is against a new book (Decision 4), on mount. The initial
  // state is already empty, so the effect only sends the command (no setState in
  // an effect — load-effect-client-needs-useref). On unmount (a parent close)
  // cancel whatever upload is still open so its scratch repo does not leak.
  useEffect(() => {
    pendingPreviewRef.current = true;
    store.send(command(CommandKind.PREVIEW_UPLOAD, { target: { kind: 'new' }, bytes }));
    return () => {
      if (uploadIdRef.current) {
        store.send(command(CommandKind.CANCEL_UPLOAD, { uploadId: uploadIdRef.current }));
        uploadIdRef.current = null;
      }
    };
    // Mount once; `bytes` is fixed for the surface's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useWorkerEvent(store, EventKind.UPLOAD_PREVIEW, (model) => {
    pendingPreviewRef.current = false;
    uploadIdRef.current = model.uploadId;
    setPreview(model);
    setError(null);
    // Default the no-history replace to replacing every matched song; the user
    // can keep a book's version by clearing a row.
    setKept(new Set(model.previews.filter((p) => p.status === 'replace').map((p) => p.path)));
  });

  // A non-zip / corrupt file (before a preview) or a failed import: word it, never
  // crash (AC1; the engine's ERROR, workflow 7 §The preview "never a crash"). Only
  // our own commands' failures matter — an unrelated Worker ERROR is ignored while
  // nothing of ours is in flight.
  useWorkerEvent(store, EventKind.ERROR, () => {
    if (awaitingRef.current) {
      setError('failed');
      awaitingRef.current = null;
    } else if (pendingPreviewRef.current) {
      setError('badZip');
      pendingPreviewRef.current = false;
    }
  });

  // A new book landed: it appears on the shelf (SHELF re-surfaced) and we leave.
  useWorkerEvent(store, EventKind.BOOK_CREATED, () => {
    if (awaitingRef.current === 'new') {
      uploadIdRef.current = null;
      awaitingRef.current = null;
      onClose();
    }
  });

  // A merge / replace finished: the target reflects it. A collision left it
  // `needs_you` — hand off to the existing conflict surface (Decision 2); any
  // other phase is a clean landing, so we just leave.
  useWorkerEvent(store, EventKind.SYNC, ({ bookId, phase }) => {
    if (awaitingRef.current && awaitingRef.current === bookId) {
      uploadIdRef.current = null;
      awaitingRef.current = null;
      if (phase === 'needs_you') onNeedsYou(bookId);
      else onClose();
    }
  });

  const chooseNew = () => {
    setChoice('new');
    requestPreview({ kind: 'new' });
  };
  const chooseMerge = () => {
    setChoice('merge');
    // Re-preview against the already-chosen target, if any; otherwise wait for a
    // target pick (the new-book preview is cancelled so its scratch does not leak).
    if (targetId) requestPreview({ kind: 'existing', bookId: targetId });
    else if (uploadIdRef.current) {
      store.send(command(CommandKind.CANCEL_UPLOAD, { uploadId: uploadIdRef.current }));
      uploadIdRef.current = null;
      setPreview(null);
    }
  };
  const chooseTarget = (bookId) => {
    setTargetId(bookId);
    requestPreview({ kind: 'existing', bookId });
  };

  const cancel = () => {
    if (uploadIdRef.current) {
      store.send(command(CommandKind.CANCEL_UPLOAD, { uploadId: uploadIdRef.current }));
      uploadIdRef.current = null;
    }
    onClose();
  };

  const toggleKeep = (path, on) => {
    setKept((prev) => {
      const next = new Set(prev);
      if (on) next.add(path);
      else next.delete(path);
      return next;
    });
  };

  const confirm = () => {
    if (!preview) return;
    const uploadId = preview.uploadId;
    if (choice === 'new') {
      awaitingRef.current = 'new';
      store.send(command(CommandKind.IMPORT_UPLOAD, { uploadId, choice: 'new_book', author: LOCAL_IDENTITY }));
      return;
    }
    awaitingRef.current = targetId;
    if (preview.hasHistory) {
      store.send(
        command(CommandKind.IMPORT_UPLOAD, {
          uploadId,
          choice: 'merge',
          target: { bookId: targetId },
          author: LOCAL_IDENTITY,
        }),
      );
    } else {
      const perFile = preview.previews.filter((p) => p.status === 'replace' && kept.has(p.path)).map((p) => p.path);
      store.send(
        command(CommandKind.IMPORT_UPLOAD, {
          uploadId,
          choice: 'replace',
          target: { bookId: targetId },
          perFile,
          author: LOCAL_IDENTITY,
        }),
      );
    }
  };

  // Import the latest clean version without the history that cannot be rewritten
  // (workflow 7 §A merge left half done, L117-122). Lands a fresh new book.
  const importLatest = () => {
    if (!preview) return;
    awaitingRef.current = 'new';
    store.send(
      command(CommandKind.IMPORT_UPLOAD, {
        uploadId: preview.uploadId,
        choice: 'latest_without_history',
        author: LOCAL_IDENTITY,
      }),
    );
  };

  const previews = preview?.previews ?? [];
  const hasConflict = previews.some((p) => p.status === 'conflict');
  const markers = preview?.historyMarkers ?? null;
  // The confirm is ready for a new book as soon as the preview is in, and for a
  // merge once a target is chosen and previewed against.
  const confirmReady = Boolean(preview) && (choice === 'new' || (choice === 'merge' && targetId));
  const primaryLabel = choice === 'merge' ? t('books.uploadConfirmMerge') : t('books.uploadConfirmNew');

  return (
    <div className="screen upload-preview">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('books.uploadCancelSurface')} onPress={cancel}>
          <CancelIcon />
        </Button>
        <span className="title">{t('books.uploadTitle', { name: fileName })}</span>
      </div>

      <div className="scroll upload-body">
        <section aria-labelledby="upload-what-h" className="upload-what-section">
          <h3 className="t-h3" id="upload-what-h">
            {t('books.uploadWhatToDo')}
          </h3>
          <RadioGroup
            className="seg upload-what"
            aria-label={t('books.uploadWhatToDoLabel')}
            value={choice}
            onChange={(value) => (value === 'merge' ? chooseMerge() : chooseNew())}
          >
            <Radio className="upload-what-opt" value="new">
              {t('books.uploadAsNew')}
            </Radio>
            <Radio className="upload-what-opt" value="merge">
              {t('books.uploadMerge')}
            </Radio>
          </RadioGroup>

          {choice === 'merge' ? (
            targets.length ? (
              <RadioGroup
                className="list upload-targets"
                aria-label={t('books.uploadMergeInto')}
                value={targetId ?? ''}
                onChange={chooseTarget}
              >
                {targets.map((e) => (
                  <Radio
                    key={e.id}
                    className={({ isSelected }) => `row upload-target${isSelected ? ' sel' : ''}`}
                    value={e.id}
                  >
                    {({ isSelected }) => (
                      <>
                        <span className="grow">
                          <span className="name">{titleFor(e.book, e.id)}</span>
                        </span>
                        {isSelected ? <span className="badge ok">{t('account.selected')}</span> : null}
                      </>
                    )}
                  </Radio>
                ))}
              </RadioGroup>
            ) : (
              <p className="t-small upload-note" role="status">
                {t('books.uploadNoTargets')}
              </p>
            )
          ) : null}
        </section>

        {error ? (
          <p className="t-small upload-error" role="status">
            {error === 'failed' ? t('books.uploadFailed') : t('books.uploadBadZip')}
          </p>
        ) : null}

        {preview?.branch ? (
          <p className="t-small upload-branch">{t('books.uploadBranch', { branch: preview.branch })}</p>
        ) : null}

        {preview && !error ? (
          <section aria-labelledby="upload-songs-h" className="upload-songs-section">
            <h3 className="t-h3" id="upload-songs-h">
              {t('books.uploadSongs')}
            </h3>
            <PreviewRows previews={previews} kept={kept} onToggleKeep={toggleKeep} />
          </section>
        ) : null}

        {markers ? (
          <div className="card pad upload-markers" role="status">
            <span className="t-h3">{t('books.uploadMarkersTitle')}</span>
            <p className="t-small">
              {t('books.uploadMarkersBody', { commit: markers.commit.slice(0, 7), path: markers.path })}
            </p>
            {markers.latestClean ? (
              <Button className="btn" style={{ alignSelf: 'flex-start' }} onPress={importLatest}>
                {t('books.uploadMarkersLatest')}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="upload-cards">
          <div className="card pad">
            <span className="t-h3">{t('books.uploadLeftOutTitle')}</span>
            <p className="t-small">{t('books.uploadLeftOutBody')}</p>
          </div>
          <div className="card pad">
            <span className="t-h3">{t('books.uploadCanonTitle')}</span>
            <p className="t-small">{t('books.uploadCanonBody')}</p>
          </div>
        </div>
      </div>

      <div className="actions upload-confirm">
        <span className="t-small upload-caption">
          {t('books.uploadConfirmCaption')}
          {hasConflict ? ` ${t('books.uploadConflictCaption')}` : ''}
        </span>
        <Button className="btn" onPress={cancel}>
          {t('books.cancel')}
        </Button>
        <Button className="btn primary" isDisabled={!confirmReady} onPress={confirm}>
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

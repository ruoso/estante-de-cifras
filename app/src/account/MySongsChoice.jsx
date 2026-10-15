// MySongsChoice.jsx — a device used before signing in, with its own *My songs*,
// meets the account's (account.new_device acceptance 6-8; workflow 13 §A device
// used before signing in; W13 board frame 3). A full-screen surface over the
// shell: *Merge* previews this device's songs going into the account's *My
// songs* — workflow 7's upload preview, unrelated histories and all — and *Merge
// and save* lands them; *Keep both* keeps this one on the shelf as *My songs
// (this device)*; *Later* puts the question away until the next start.
//
// The Worker owns git, the zip and the merge (DIRECTION §3.7): this view sends
// PREVIEW_MY_SONGS / IMPORT_UPLOAD / CANCEL_UPLOAD / KEEP_BOTH_MY_SONGS and
// renders the replies (UPLOAD_PREVIEW, SYNC, ERROR). Nothing is written until
// *Merge and save*; a song in both books goes to the conflict session first
// (workflow 7 §Unrelated history), handed to the shell through `onNeedsYou`.
//
// Accessibility: every action is a React Aria Button with its words as its
// name; the preview's rows say *added* / *conflict* as words (PreviewRows); the
// loading and the failure are announced in a `role="status"` line.

import { useRef, useState } from 'react';
import { Button } from 'react-aria-components';

import { t } from '../i18n/index.js';
import { useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { thisDeviceFor } from '../books/book-display.js';
import PreviewRows from '../books/PreviewRows.jsx';
import '../books/upload-preview.css';
import './account.css';

// The device-local commit identity, as the shelf's other commands send it.
const LOCAL_IDENTITY = { id: 'local', name: 'Me' };

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="my-songs-ok"
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

/**
 * `choice` is the `mySongsChoice` slice (`{ offered, accountBookId, ready,
 * kind }`); `onClose` leaves (Later, Keep both, a clean merge); `onNeedsYou`
 * hands the account's *My songs* to the conflict panel.
 */
export default function MySongsChoice({ store, choice, onClose = () => {}, onNeedsYou = () => {} }) {
  const accountBookId = choice?.accountBookId;
  const device = thisDeviceFor(choice?.kind, { t });
  // 'choose' → (Merge) 'loading' → 'preview' → (Merge and save) 'saving'; or
  // 'failed' when the preview or the import could not be made.
  const [phase, setPhase] = useState('choose');
  const [preview, setPreview] = useState(null);
  const uploadIdRef = useRef(null);

  useWorkerEvent(store, EventKind.UPLOAD_PREVIEW, (model) => {
    if (!model?.mySongs) return;
    uploadIdRef.current = model.uploadId;
    setPreview(model);
    setPhase('preview');
  });

  useWorkerEvent(store, EventKind.ERROR, () => {
    if (phase === 'loading' || phase === 'saving') setPhase('failed');
  });

  // A merge that collided leaves the account's *My songs* *needs you*: hand it to
  // the conflict panel. A clean one retires this device's *My songs*, and the
  // offer goes with it (the shell stops showing this surface). The sync engine's
  // own facts about the book (a pass running meanwhile) are not the reply.
  useWorkerEvent(store, EventKind.SYNC, ({ bookId, phase: syncPhase }) => {
    if (phase !== 'saving' || bookId !== accountBookId || syncPhase !== 'needs_you') return;
    uploadIdRef.current = null;
    onNeedsYou(bookId);
  });

  const cancelUpload = () => {
    if (uploadIdRef.current) {
      store.send(command(CommandKind.CANCEL_UPLOAD, { uploadId: uploadIdRef.current }));
      uploadIdRef.current = null;
    }
  };

  const merge = () => {
    setPhase('loading');
    store.send(command(CommandKind.PREVIEW_MY_SONGS, { target: accountBookId }));
  };

  const keepBoth = () => {
    cancelUpload();
    store.send(
      command(CommandKind.KEEP_BOTH_MY_SONGS, { title: t('newDevice.keepBothTitle'), author: LOCAL_IDENTITY }),
    );
    onClose();
  };

  const later = () => {
    cancelUpload();
    onClose();
  };

  const mergeAndSave = () => {
    if (!preview) return;
    setPhase('saving');
    store.send(
      command(CommandKind.IMPORT_UPLOAD, {
        uploadId: preview.uploadId,
        choice: 'merge',
        target: { bookId: accountBookId },
        author: LOCAL_IDENTITY,
        fromMySongs: true,
      }),
    );
  };

  const showPreview = phase === 'preview' || phase === 'saving';

  return (
    <div className="screen my-songs-choice">
      <div className="appbar">
        <span className="title">{t('newDevice.title')}</span>
        <Button className="btn quiet" onPress={later}>
          {t('newDevice.later')}
        </Button>
      </div>

      <div className="scroll my-songs-body">
        <div className="notice my-songs-merged">
          <CheckIcon />
          <span>{t('newDevice.merged', { device })}</span>
        </div>

        <div className="my-songs-intro">
          <h2 className="t-display">{t('newDevice.heading', { device })}</h2>
          <p className="t-body">{t('newDevice.body')}</p>
        </div>

        <div className="my-songs-cards">
          <Button
            className="card pad my-songs-card primary"
            isDisabled={!choice?.ready || phase === 'loading' || phase === 'saving'}
            onPress={merge}
          >
            <span className="t-h2">{t('newDevice.merge')}</span>
            <span className="t-small">{t('newDevice.mergeBody', { device })}</span>
          </Button>
          <Button className="card pad my-songs-card" isDisabled={phase === 'saving'} onPress={keepBoth}>
            <span className="t-h2">{t('newDevice.keepBoth')}</span>
            <span className="t-small">{t('newDevice.keepBothBody')}</span>
          </Button>
        </div>

        {!choice?.ready ? (
          <p className="t-small" role="status">
            {t('newDevice.mergeWaiting')}
          </p>
        ) : null}
        {phase === 'loading' ? (
          <p className="t-small" role="status">
            {t('newDevice.previewLoading')}
          </p>
        ) : null}
        {phase === 'failed' ? (
          <p className="notice warn" role="status">
            {t('newDevice.failed')}
          </p>
        ) : null}

        {showPreview && preview ? (
          <section aria-labelledby="my-songs-preview-h" className="my-songs-preview">
            <div className="section-label">
              <h3 className="t-h3" id="my-songs-preview-h">
                {t('newDevice.previewTitle')}
              </h3>
              <span className="t-small">{t('newDevice.previewNote')}</span>
            </div>
            {!preview.sharedHistory ? <div className="notice unsaved">{t('newDevice.unrelated')}</div> : null}
            <PreviewRows previews={preview.previews ?? []} />
            <div className="actions">
              <Button className="btn" isDisabled={phase === 'saving'} onPress={keepBoth}>
                {t('newDevice.keepBothInstead')}
              </Button>
              <Button className="btn primary" isDisabled={phase === 'saving'} onPress={mergeAndSave}>
                {t('newDevice.mergeAndSave')}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

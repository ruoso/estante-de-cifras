// RestoreConfirm.jsx — "restoring would replace unsaved changes, so it asks
// first and shows what would be lost, as discard does" (songs.history, workflow
// 6 §Restoring L57-58; W06 tablet restore dialog). A centered RAC dialog that
// reads the same `savePreview` slice as the save sheet and the discard confirm
// (HEAD vs working copy — the authoritative unsaved signal, Decision 4), shows
// the to-be-lost changes on `--unsaved-soft`, and offers *Keep my changes* and a
// danger *Lose them and restore*. It is a sibling of DiscardConfirm, not a mode
// of it (Decision 3): two destructive flows with different verbs read clearer as
// two small components sharing the CSS, the slice and the extracted DiffRows.
//
// It does not send RESTORE_VERSION itself — the surface owns the restore command
// and the RESTORED→save-sheet handshake (workflow 6 L59-62); confirming calls
// `onConfirm` and closes. The view is the only React layer (DIRECTION §3.7): it
// reads the slice and sends PREVIEW_SAVE, and never touches git or the index.

import { useEffect } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import DiffRows from './DiffRows.jsx';
import './save-sheet.css';
import './song-history.css';

export default function RestoreConfirm({
  store,
  isOpen,
  onClose,
  onConfirm = () => {},
  bookId,
  paths,
  titleHint = '',
  dateLabel = '',
}) {
  const savePreview = useSlice(store, 'savePreview');
  const previews = savePreview?.[bookId]?.previews ?? [];

  // Ask for the preview when the dialog opens, so "what would be lost" is the
  // same HEAD-vs-working summary the save sheet and the discard confirm show.
  useEffect(() => {
    if (!isOpen || !paths?.length) return;
    store.send(command(CommandKind.PREVIEW_SAVE, { bookId, paths }));
  }, [isOpen, bookId, paths, store]);

  const changes = previews[0]?.changes ?? [];

  const confirm = (close) => {
    onConfirm();
    close();
  };

  return (
    <ModalOverlay
      className="scrim center"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <Modal className="dialog">
        <Dialog>
          {({ close }) => (
            <>
              <Heading slot="title" className="t-h2">
                {t('history.restoreTitle', { date: dateLabel })}
              </Heading>
              <p className="t-body">{t('history.restoreBody', { title: titleHint })}</p>
              <div className="card pad est-history-lost">
                <DiffRows changes={changes} />
              </div>
              <p className="t-small">{t('history.restoreCaption')}</p>
              <div className="actions">
                <Button className="btn" onPress={close}>
                  {t('history.keepChanges')}
                </Button>
                <Button className="btn danger" onPress={() => confirm(close)}>
                  {t('history.loseAndRestore')}
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

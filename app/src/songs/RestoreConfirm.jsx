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
  changes: changesProp = null,
  blockLabel = '',
}) {
  const savePreview = useSlice(store, 'savePreview');
  const previews = savePreview?.[bookId]?.previews ?? [];

  // A block restore (songs.restore_part) shows what would be lost IN THAT BLOCK —
  // the view hands it in; a whole-version restore reads the HEAD-vs-working preview
  // slice, the same summary the save sheet and the discard confirm show.
  const isPart = changesProp != null;

  // Ask for the preview when the whole-version dialog opens (the part dialog is
  // given its scoped changes directly, so it needs no re-read).
  useEffect(() => {
    if (!isOpen || isPart || !paths?.length) return;
    store.send(command(CommandKind.PREVIEW_SAVE, { bookId, paths }));
  }, [isOpen, isPart, bookId, paths, store]);

  const changes = isPart ? changesProp : previews[0]?.changes ?? [];
  const title = isPart
    ? t('history.restorePartTitle', { block: blockLabel })
    : t('history.restoreTitle', { date: dateLabel });
  const body = isPart
    ? t('history.restorePartBody', { title: titleHint, block: blockLabel })
    : t('history.restoreBody', { title: titleHint });
  const caption = isPart ? t('history.restorePartCaption') : t('history.restoreCaption');

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
                {title}
              </Heading>
              <p className="t-body">{body}</p>
              <div className="card pad est-history-lost">
                <DiffRows changes={changes} />
              </div>
              <p className="t-small">{caption}</p>
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

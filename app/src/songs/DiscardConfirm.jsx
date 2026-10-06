// DiscardConfirm.jsx — "Discard changes puts the song back as last saved. It
// shows what would be lost — the same summary as save — and always asks, since
// it is the one destructive action here" (songs.save_sheet, workflow 4
// §Discarding; W04 discard dialog). A centered RAC dialog that reads the same
// `savePreview` slice as the save sheet, offers *Keep editing* and a danger
// *Discard changes*, and sends DISCARD on confirm — reverting a tracked song to
// HEAD, deleting a never-saved draft (workflow 3 §Abandoning).
//
// The view is the only React layer (DIRECTION §3.7): it reads the slice, sends
// PREVIEW_SAVE / DISCARD, and reports the DISCARDED event up through `onDiscarded`
// so the host can reload the reverted text (existing song) or leave the editor
// (a never-saved draft). It never touches IndexedDB or git.

import { useEffect } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import DiffRows from './DiffRows.jsx';
import './save-sheet.css';

export default function DiscardConfirm({
  store,
  isOpen,
  onClose,
  onDiscarded = () => {},
  bookId,
  paths,
  titleHint = '',
}) {
  const savePreview = useSlice(store, 'savePreview');
  const previews = savePreview?.[bookId]?.previews ?? [];

  // Ask for the preview when the dialog opens, so "what would be lost" is the
  // same summary the save sheet shows (workflow 4 §Discarding).
  useEffect(() => {
    if (!isOpen || !paths?.length) return;
    store.send(command(CommandKind.PREVIEW_SAVE, { bookId, paths }));
  }, [isOpen, bookId, paths, store]);

  // The revert landed: close and tell the host (which reloads or exits).
  useWorkerEvent(store, EventKind.DISCARDED, (payload) => {
    if (payload?.bookId === bookId) {
      onClose();
      onDiscarded(payload);
    }
  });

  const confirm = () => {
    store.send(command(CommandKind.DISCARD, { bookId, paths: paths ?? [] }));
  };

  const changes = previews[0]?.changes ?? [];

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
                {t('saveSheet.discardTitle', { title: titleHint })}
              </Heading>
              <p className="t-body">{t('saveSheet.discardBody')}</p>
              <DiffRows changes={changes} />
              <div className="actions">
                <Button className="btn" onPress={close}>
                  {t('saveSheet.keepEditing')}
                </Button>
                <Button className="btn danger" onPress={confirm}>
                  {t('saveSheet.discard')}
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

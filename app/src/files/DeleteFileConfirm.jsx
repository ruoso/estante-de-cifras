// Delete a file, asked once (books.file_view, workflow 14 L147; mirrors
// songs/RestoreConfirm & DiscardConfirm). The confirm delegates the command to
// the host (`onConfirm` → DELETE_FILE), which keeps the file's working-copy
// change until the save commits the removal. A deleted song's setlist links are
// NOT rewritten — they become missing items (workflow 12; Decision 2).

import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { t } from '../i18n/index.js';

export default function DeleteFileConfirm({ isOpen, onClose, file, onConfirm = () => {} }) {
  const name = file?.path ?? '';
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
                {t('fileView.deleteTitle', { name })}
              </Heading>
              <p className="t-body">{t('fileView.deleteBody')}</p>
              <div className="actions">
                <Button className="btn" onPress={close}>
                  {t('fileView.deleteCancel')}
                </Button>
                <Button
                  className="btn danger"
                  onPress={() => {
                    onConfirm();
                    close();
                  }}
                >
                  {t('fileView.deleteConfirm')}
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

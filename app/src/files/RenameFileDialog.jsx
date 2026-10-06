// Rename / move a file, keeping its kind (books.file_view, workflow 14
// L144-146; W14 tablet board). The dialog pins the kind's extension beside an
// editable base-name field — a song keeps `.cifra.md`, so it stays a song — and
// carries the notice that the book's setlist links to the song are rewritten in
// the same save (the Worker's `move` does the relink; workflow 12). Submitting
// sends the new book-root path to the host, which issues MOVE_FILE.

import { useState } from 'react';
import { Button, Dialog, Heading, Input, Label, Modal, ModalOverlay, TextField } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { splitPath, kindSuffix, baseWithoutSuffix } from './file-tree.js';
import { LockIcon } from './icons.jsx';

export default function RenameFileDialog({ isOpen, onClose, file, onRename }) {
  if (!file) return null;
  const suffix = kindSuffix(file.kind);
  const { folder, base } = splitPath(file.path);
  const initial = baseWithoutSuffix(base, file.kind);

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
            <RenameForm
              close={close}
              onClose={onClose}
              onRename={onRename}
              file={file}
              folder={folder}
              suffix={suffix}
              initial={initial}
            />
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function RenameForm({ close, onClose, onRename, file, folder, suffix, initial }) {
  const [name, setName] = useState(initial);
  const title = file.kind === 'setlist' ? t('fileView.renameSetlist') : t('fileView.renameSong');
  const hint = file.kind === 'setlist' ? t('fileView.renameHintSetlist') : t('fileView.renameHintSong');
  const nameLabel = folder
    ? t('fileView.renameNameLabel', { folder })
    : t('fileView.renameNameLabelRoot');

  const submit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !suffix) return;
    const toBase = `${trimmed}${suffix}`;
    const toPath = folder ? `${folder}/${toBase}` : toBase;
    if (toPath !== file.path) onRename(file.path, toPath);
    onClose();
    close();
  };

  return (
    <form className="file-rename" onSubmit={submit}>
      <Heading slot="title" className="t-h1">
        {title}
      </Heading>
      <TextField className="field" value={name} onChange={setName}>
        <Label>{nameLabel}</Label>
        <div className="file-rename-input">
          <Input className="input t-mono" />
          <span className="file-rename-suffix t-mono" aria-hidden="true">
            <LockIcon />
            {suffix}
          </span>
        </div>
        <span className="t-small">{hint}</span>
      </TextField>
      <div className="notice accent file-rename-notice">
        <span>
          <b>{t('fileView.linkNotice')}</b>
        </span>
      </div>
      <div className="actions">
        <Button className="btn" onPress={close}>
          {t('fileView.renameCancel')}
        </Button>
        <Button type="submit" className="btn primary">
          {t('fileView.renameConfirm')}
        </Button>
      </div>
    </form>
  );
}

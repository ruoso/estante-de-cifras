// The one-field dialog *New setlist* and *New folder* open from the *New* menu
// (books.file_view_create_menu; workflow 14 §What can be done to a file): a
// name, labelled with the folder it goes in, *Create* disabled while the name
// is blank or `problem` names a reason — shown as text under the field, never
// colour alone — and *Cancel*. Submitting hands the trimmed name to the host,
// which sends CREATE_FILE (a setlist) or holds the folder in view state.

import { useState } from 'react';
import { Button, Dialog, Heading, Input, Label, Modal, ModalOverlay, Text, TextField } from 'react-aria-components';
import { t } from '../i18n/index.js';

export default function NewNameDialog({ isOpen, onClose, title, folder, problem = () => null, onCreate }) {
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
            <NameForm close={close} onClose={onClose} title={title} folder={folder} problem={problem} onCreate={onCreate} />
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function NameForm({ close, onClose, title, folder, problem, onCreate }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  // A blank name only disables Create; a reason is shown once something is typed.
  const reason = trimmed ? problem(trimmed) : null;
  const disabled = !trimmed || Boolean(reason);
  const label = folder ? t('fileView.createNameLabel', { folder }) : t('fileView.createNameLabelRoot');

  const submit = (event) => {
    event.preventDefault();
    if (disabled) return;
    onCreate(trimmed);
    onClose();
    close();
  };

  return (
    <form className="file-new-name" onSubmit={submit}>
      <Heading slot="title" className="t-h1">
        {title}
      </Heading>
      <TextField className="field" value={name} onChange={setName} isInvalid={Boolean(reason)}>
        <Label>{label}</Label>
        <Input className="input" />
        {reason ? (
          <Text slot="errorMessage" className="t-small file-new-name-problem">
            {reason}
          </Text>
        ) : null}
      </TextField>
      <div className="actions">
        <Button className="btn" onPress={close}>
          {t('fileView.createCancel')}
        </Button>
        <Button type="submit" className="btn primary" isDisabled={disabled}>
          {t('fileView.createConfirm')}
        </Button>
      </div>
    </form>
  );
}

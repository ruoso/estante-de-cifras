// AuthorNameDialog — changing the name one saves as (account.author_name;
// workflow 4 §Who made the change; workflow 13 §The account screen). The
// *Change* trigger opens a small modal with one field prefilled with the stored
// name; *Save* hands the trimmed name to `onSave` (the screen sends
// SET_IDENTITY_NAME — the Worker owns the write), a blank or whitespace-only
// name is refused in words under the field and sends nothing, and an unchanged
// name closes with no write (Decision 4). Cancel and Escape send nothing. RAC's
// DialogTrigger returns focus to *Change* on every close. Portaled into the
// `.est` token root by ThemeRoot. The name is the user's own words — it is never
// logged.

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  FieldError,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
} from 'react-aria-components';

import { t } from '../i18n/index.js';

export default function AuthorNameDialog({ name, onSave }) {
  return (
    <DialogTrigger>
      <Button className="btn" aria-label={t('account.yourNameChangeLabel')}>
        {t('account.yourNameChange')}
      </Button>
      <ModalOverlay className="scrim center" isDismissable>
        <Modal className="dialog">
          <Dialog>
            {({ close }) => <AuthorNameForm initial={name ?? ''} onSave={onSave} close={close} />}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

function AuthorNameForm({ initial, onSave, close }) {
  const [value, setValue] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const blank = !value.trim();

  const submit = (event) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setAttempted(true);
      return;
    }
    if (trimmed !== initial) onSave(trimmed);
    close();
  };

  return (
    <form className="account-name-form" onSubmit={submit}>
      <Heading slot="title" className="t-h2">
        {t('account.yourName')}
      </Heading>
      <TextField
        className="field"
        value={value}
        onChange={setValue}
        // autoFocus on the TextField: React Aria focuses its input on mount,
        // before the Dialog would take focus itself (Constraint 6).
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        isRequired
        isInvalid={attempted && blank}
        validationBehavior="aria"
      >
        <Label>{t('account.yourName')}</Label>
        <Input className="input" />
        <FieldError className="t-small" role="alert">
          {t('account.yourNameEmpty')}
        </FieldError>
      </TextField>
      <div className="actions">
        <Button className="btn" onPress={close}>
          {t('account.cancel')}
        </Button>
        <Button type="submit" className="btn primary">
          {t('account.save')}
        </Button>
      </div>
    </form>
  );
}

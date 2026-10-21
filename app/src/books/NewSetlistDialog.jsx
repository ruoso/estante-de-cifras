// The New-setlist name dialog (books.setlist_making Decision 8; workflow 12
// §Building one) — one dialog for the two places a setlist is made: the
// Setlists tab's head and Add to setlist's *New setlist…* row. It asks for a
// name and, only when more than one book can be saved to (`books`, the offered
// list from `savableBooks`), which book — a RAC RadioGroup labelled *Book*, the
// `defaultBookId` checked (*My songs* first, workflow 3 §Which book). Add to
// setlist passes no list: there the book is the song's own, else My songs
// (books.setlists Decision 7). The name field has focus on open, Create is
// disabled while the name is blank, Enter submits, and the dialog closes only
// once the create was sent; with no book to keep the setlist in (`hasTarget`
// false) it says why, in words, and offers only Cancel (books.owner_can_save
// Constraints 4-5, Decision 4).

import { useState } from 'react';
import {
  Button,
  Dialog,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
  TextField,
} from 'react-aria-components';
import { t } from '../i18n/index.js';
import './setlist.css';

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="setlist-pick-check">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

export default function NewSetlistDialog({
  books = [],
  defaultBookId = null,
  hasTarget = true,
  onCancel,
  onCreate,
}) {
  const [name, setName] = useState('');
  const [bookId, setBookId] = useState(defaultBookId);
  const asksBook = books.length > 1;
  return (
    <ModalOverlay
      className="scrim center"
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Modal className="dialog">
        <Dialog>
          {({ close }) => (
            <form
              className="setlist-name-form"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = name.trim();
                if (!hasTarget || !trimmed) return;
                if (onCreate(trimmed, bookId) === true) close();
              }}
            >
              <Heading slot="title" className="t-h2">
                {t('setlists.newSetlistTitle')}
              </Heading>
              {hasTarget ? (
                // autoFocus on the TextField: React Aria focuses its input on
                // mount, before the Dialog would take focus itself, so typing
                // starts at once (books.owner_can_save Constraint 4).
                // eslint-disable-next-line jsx-a11y/no-autofocus
                <TextField className="field" value={name} onChange={setName} autoFocus>
                  <Label>{t('setlists.newSetlistNameLabel')}</Label>
                  <Input className="input" placeholder={t('setlists.newSetlistNamePlaceholder')} />
                </TextField>
              ) : (
                <p className="t-small" role="status">
                  {t('setlists.newSetlistNoBook')}
                </p>
              )}
              {hasTarget && asksBook ? (
                // Each book named by its title — a word, never colour
                // (books.setlist_making Constraint 4).
                <RadioGroup
                  className="field setlist-book-choice"
                  value={bookId}
                  onChange={setBookId}
                >
                  <Label>{t('setlists.newSetlistBookLabel')}</Label>
                  <div className="list">
                    {books.map((book) => (
                      <Radio
                        key={book.id}
                        value={book.id}
                        className={({ isSelected }) => `row setlist-book-radio${isSelected ? ' sel' : ''}`}
                      >
                        {({ isSelected }) => (
                          <>
                            <span className="grow">
                              <span className="name">{book.label}</span>
                            </span>
                            {isSelected ? <CheckIcon /> : null}
                          </>
                        )}
                      </Radio>
                    ))}
                  </div>
                </RadioGroup>
              ) : null}
              <div className="actions">
                {/* With nowhere to keep a setlist, Cancel is the one action
                    and takes focus (books.owner_can_save Constraint 5). */}
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <Button className="btn" autoFocus={!hasTarget} onPress={close}>
                  {t('setlists.cancel')}
                </Button>
                {hasTarget ? (
                  <Button type="submit" className="btn primary" isDisabled={!name.trim()}>
                    {t('setlists.create')}
                  </Button>
                ) : null}
              </div>
            </form>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// WhichBook.jsx — the "which book" bar shown above the editor while a new song
// is unsaved (songs.new_song, workflow 3 §Which book; W03 which-book control).
// It shows the book the song will be saved into — the one it was started from,
// else *My songs* — and lets the writer change it until the first save, after
// which the host stops rendering it (the file is then an ordinary one).
//
// "Moving it costs nothing" until the first save, so Change book is a plain
// re-target the host drives with shipped primitives (Decision 3); this component
// only presents the current book and offers the push-capable ones. A book the
// user cannot push to is never offered (`canSaveFor`, workflow 3 §Which book
// L28): local books always, shared books only with the editor role; the home
// book never appears (it is not on the shelf).
//
// React Aria Components throughout (a labelled `Button` trigger and a `Menu`),
// so the keyboard path, the roving focus and the accessible names come from RAC.
// The current book is carried by its name — a word, never colour alone (mockups
// README L26).

import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { orderedBooks, titleFor, canSaveFor } from '../books/book-display.js';
import { bookLabelFor } from './first-run.js';

// The book-stack glyph (aria-hidden), the same mark the shelf and the W03 bar
// draw beside "In {book}".
function BookIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-.8 3 15.6-3.5.8z" />
    </svg>
  );
}

export default function WhichBook({ store, bookId, onChangeBook }) {
  const shelf = useSlice(store, 'shelf');
  const book = bookLabelFor(shelf, bookId, t('books.untitled'));

  // The books the song may move to: every shelf book the user can push to
  // (`canSaveFor` true), in shelf order. Local books (including *My songs*) are
  // always savable; a shared reader-role book is dropped.
  const offered = orderedBooks(shelf)
    .filter((entry) => canSaveFor(entry.kind, entry.book) === true)
    .map((entry) => ({ id: entry.id, label: titleFor(entry.book, t('books.untitled')) }));

  return (
    <div className="new-song-book">
      <BookIcon />
      <span className="t-small grow new-song-book-label">
        {t('newSong.inBook', { book })}
        <span className="new-song-book-hint"> · {t('newSong.changeable')}</span>
      </span>
      <MenuTrigger>
        <Button className="btn quiet">{t('newSong.changeBook')}</Button>
        <Popover className="popover">
          <Menu
            aria-label={t('newSong.changeBook')}
            onAction={(key) => onChangeBook(String(key))}
          >
            {offered.map((entry) => (
              <MenuItem key={entry.id} id={entry.id}>
                {entry.label}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  );
}

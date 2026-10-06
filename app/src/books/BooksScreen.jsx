// The book-management screen (books.shelf) — "managing them is a screen of its
// own" (DIRECTION §4 L434), workflow 7's specification. It fills the `books` tab
// panel (AppShell), reads the `shelf` slice through `useSlice`, and sends
// CREATE_BOOK / RENAME_BOOK through `store.send`; it never touches IndexedDB,
// never runs git, never reads the home book directly (DIRECTION §3.7 L407-414).
// The Worker owns the data; this view is the only React layer over it.
//
// It is the shelf LIST plus NEW and RENAME. Each book row shows its title, where
// it lives, whether the user can save, and — only when a book is not in step —
// its sync state (workflow 7 L14-21; W07 board). *Add a book* opens a sheet with
// the New-book flow (the other three ways in are books.add_by_link /
// books.upload_ui; Decision 6). Rename writes a label kept in the home book that
// changes nothing in the repository (workflow 7 L16-18; Decision 3). Putting a
// book online, removing, deleting and the per-book detail are books.online's.
//
// Selection and the open sheet/dialog are ephemeral view state (useState), like
// the shell's destination selection — there is no router and nothing to persist
// (Decision 7). Every interactive part is a React Aria Component with a keyboard
// path and an accessible name; where-it-lives, can-save and the sync badge are
// each a word, never colour alone (mockups README L26).

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
} from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import {
  titleFor,
  whereFor,
  canSaveFor,
  syncStateFor,
  orderedBooks,
} from './book-display.js';
import './books.css';

// Before sign-in there is no account; a local book's commits carry a device-local
// identity (DIRECTION §3.2 L164-170). account.first_run (which depends on this
// task) replaces it with the account's address on the saves not yet pushed when
// the user signs in. Until then a stable local id authors the offline commit — a
// local book never pushes, so it reaches no one.
const LOCAL_IDENTITY = { id: 'local', name: 'Me' };

// The "+" on the Add-a-book trigger (W07 line 32); decorative, named by the
// button's text.
function PlusIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// The pencil on a book's rename control; decorative, named by the button's
// aria-label.
function PencilIcon() {
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
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 6.5l3 3" />
    </svg>
  );
}

// The sync-state badge, shown only when the slice carries a sync state for the
// book — the absence of the slot is "in step with Estante" (workflow 7 L21/L47).
// Each state is a word (never colour alone, mockups README L26); the W08 words.
function SyncBadge({ book }) {
  const sync = syncStateFor(book);
  if (!sync) return null;
  let word;
  if (sync.state === 'unsaved') word = t('books.savesWaiting', { count: sync.count });
  else if (sync.state === 'conflict') word = t('books.needsYou');
  else word = t('books.syncing');
  return (
    <span className="badges">
      <span className={`badge ${sync.cls}`.trim()}>{word}</span>
    </span>
  );
}

// One book on the shelf: a row that opens the book (the detail/reader is a later
// task's seam, `onOpen`) and a rename control beside it. The row carries the
// title, the `{where} · {role}` meta line, and the sync badge when present; it
// reads `.sel` when it is the selected book (W07 desktop master-detail).
function BookRow({ id, book, kind, selected, onOpen, onRename, rowRef, portalContainer }) {
  const title = titleFor(book, id);
  const where = t(`books.${whereFor(kind)}`);
  const canSave = canSaveFor(kind, book);
  const role =
    canSave === true ? t('books.canSave') : canSave === false ? t('books.reader') : null;
  const meta = [where, role].filter(Boolean).join(' · ');
  return (
    <div className={`book-row${selected ? ' sel' : ''}`}>
      <Button className="row book-open" ref={rowRef} onPress={() => onOpen(id)}>
        <span className="grow">
          <span className="name">{title}</span>
          <span className="meta">{meta}</span>
          <SyncBadge book={book} />
        </span>
        <span className="caret t-small" aria-hidden="true">
          ▸
        </span>
      </Button>
      <RenameDialog
        bookId={id}
        currentName={title}
        onRename={onRename}
        portalContainer={portalContainer}
      />
    </div>
  );
}

// The rename control and its dialog (Decision 3; no rename control is drawn on
// the W07 board — this task introduces it). The trigger restores focus on close
// (RAC); the field opens pre-filled with the current name and, on submit, sends
// RENAME_BOOK and closes. The repository is never touched — only the shelf label.
function RenameDialog({ bookId, currentName, onRename, portalContainer }) {
  const [name, setName] = useState(currentName);
  return (
    <DialogTrigger
      onOpenChange={(open) => {
        if (open) setName(currentName);
      }}
    >
      <Button className="rename-btn" aria-label={t('books.renameLabel', { name: currentName })}>
        <PencilIcon />
      </Button>
      <ModalOverlay className="scrim center" UNSTABLE_portalContainer={portalContainer ?? undefined}>
        <Modal className="dialog">
          <Dialog>
            {({ close }) => (
              <form
                className="book-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = name.trim();
                  if (!trimmed) return;
                  onRename(bookId, trimmed);
                  close();
                }}
              >
                <Heading slot="title" className="t-h2">
                  {t('books.renameTitle', { name: currentName })}
                </Heading>
                <TextField className="field" value={name} onChange={setName}>
                  <Label>{t('books.renameField')}</Label>
                  <Input className="input" />
                </TextField>
                <div className="actions">
                  <Button className="btn" onPress={close}>
                    {t('books.cancel')}
                  </Button>
                  <Button type="submit" className="btn primary">
                    {t('books.save')}
                  </Button>
                </div>
              </form>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

// The *Add a book* affordance: the header "+" trigger and the bottom sheet it
// opens (W07 board). In M2 the sheet carries the New-book flow only; By link /
// Mine on Estante / Upload are added by their own tasks (Decision 6). New book
// takes a name and creates an empty local repository with no account (workflow 7
// L25); on submit it sends CREATE_BOOK and closes.
function AddBookSheet({ onCreate, portalContainer }) {
  const [name, setName] = useState('');
  return (
    <DialogTrigger
      onOpenChange={(open) => {
        if (!open) setName('');
      }}
    >
      <Button className="btn primary add-book">
        <PlusIcon />
        {t('books.add')}
      </Button>
      <ModalOverlay className="scrim" UNSTABLE_portalContainer={portalContainer ?? undefined}>
        <Modal className="sheet">
          <Dialog>
            {({ close }) => (
              <>
                <div className="grip" aria-hidden="true" />
                <div className="sheet-head">
                  <Heading slot="title" className="t-h2 grow">
                    {t('books.addTitle')}
                  </Heading>
                  <Button className="btn icon" aria-label={t('books.close')} onPress={close}>
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </Button>
                </div>
                <form
                  className="book-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const trimmed = name.trim();
                    if (!trimmed) return;
                    onCreate(trimmed);
                    close();
                  }}
                >
                  <TextField className="field" value={name} onChange={setName}>
                    <Label>{t('books.nameLabel')}</Label>
                    <Input className="input" placeholder={t('books.namePlaceholder')} />
                  </TextField>
                  <p className="t-small">{t('books.newBookHelp')}</p>
                  <div className="actions">
                    <Button className="btn" onPress={close}>
                      {t('books.cancel')}
                    </Button>
                    <Button type="submit" className="btn primary">
                      {t('books.create')}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

export default function BooksScreen({ store, onOpenBook = () => {} }) {
  const shelf = useSlice(store, 'shelf');
  const ordered = useMemo(() => orderedBooks(shelf), [shelf]);

  // React Aria portals the sheet / dialog to document.body by default — outside
  // ThemeRoot's `.est` root, where every design token (`--u`, `--surface`, the
  // colours) is defined. There the overlay renders with no padding, no gaps and
  // a raw 520px width (tokens all undefined), which overflows a phone and pushes
  // the dialog's Save button off-screen. Portal the overlays back into `.est` so
  // the visual language cascades (null until mounted, and in token-free jsdom —
  // both fall back to document.body, which is harmless there).
  const rootRef = useRef(null);
  const [portalContainer, setPortalContainer] = useState(null);
  useEffect(() => {
    setPortalContainer(rootRef.current?.closest('.est') ?? null);
  }, []);

  // Selection is ephemeral (Decision 7): it highlights the open book (`.sel`),
  // the seam the per-book detail (books.online) will read.
  const [selected, setSelected] = useState(null);

  // A new book's row takes focus once it appears on the shelf (acceptance 6).
  // The create re-surfaces SHELF, growing `ordered`; when a create is pending
  // and a book id appears that was not here before, move focus to its row.
  const rowRefs = useRef(new Map());
  const wantFocus = useRef(false);
  const prevIds = useRef(ordered.map((b) => b.id));
  const idsKey = ordered.map((b) => b.id).join('\u0000');
  useEffect(() => {
    const ids = ordered.map((b) => b.id);
    if (wantFocus.current) {
      const added = ids.find((id) => !prevIds.current.includes(id));
      if (added) {
        setSelected(added);
        rowRefs.current.get(added)?.focus();
        wantFocus.current = false;
      }
    }
    prevIds.current = ids;
    // `idsKey` captures exactly the set of ids; `ordered` is read fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const createBook = (title) => {
    wantFocus.current = true;
    store.send(command(CommandKind.CREATE_BOOK, { title, author: LOCAL_IDENTITY }));
  };

  const renameBook = (bookId, name) => {
    store.send(command(CommandKind.RENAME_BOOK, { bookId, name, author: LOCAL_IDENTITY }));
  };

  return (
    <div className="books-screen" ref={rootRef}>
      <div className="books-head">
        <h1 className="t-h1 grow">{t('shell.books')}</h1>
        <AddBookSheet onCreate={createBook} portalContainer={portalContainer} />
      </div>

      {ordered.length ? (
        <div className="list">
          {ordered.map(({ id, book, kind }) => (
            <BookRow
              key={id}
              id={id}
              book={book}
              kind={kind}
              selected={selected === id}
              onOpen={(bookId) => {
                setSelected(bookId);
                onOpenBook(bookId);
              }}
              onRename={renameBook}
              rowRef={(node) => {
                if (node) rowRefs.current.set(id, node);
                else rowRefs.current.delete(id);
              }}
              portalContainer={portalContainer}
            />
          ))}
        </div>
      ) : (
        <p className="t-small empty" role="status">
          {t('books.empty')}
        </p>
      )}
    </div>
  );
}

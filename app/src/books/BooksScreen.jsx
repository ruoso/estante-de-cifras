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

// RAC overlays portal into the `.est` token root app-wide via the
// UNSAFE_PortalProvider in ThemeRoot (shell.portal_provider) — no per-screen
// portal container is threaded through here any more.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { tokenFromLink } from '../account/invitation-route.js';
import { BOOKS_WIDE_QUERY } from '../shell/layout-mode.js';
import { titleFor, whereFor, canSaveFor, orderedBooks } from './book-display.js';
import { syncDisplayFor, anyOutOfStep } from '../sync-display.js';
import BookDetail from './BookDetail.jsx';
import './books.css';

// Before sign-in there is no account; a local book's commits carry a device-local
// identity (DIRECTION §3.2 L164-170). account.first_run (which depends on this
// task) replaces it with the account's address on the saves not yet pushed when
// the user signs in. Until then a stable local id authors the offline commit — a
// local book never pushes, so it reaches no one.
const LOCAL_IDENTITY = { id: 'local', name: 'Me' };

// Whether the shelf has room for its OWN side-by-side master-detail
// (books.online Decision 2). This is a SECOND sidebar nested inside the shell's
// wide main pane, so it needs a wider budget than the shell split — see
// `BOOKS_WIDE_QUERY` (layout-mode.js) for the nested-rail math. The same
// `matchMedia`/`useSyncExternalStore` seam the shell and ThemeRoot use; a missing
// `matchMedia` (jsdom) reads as not-wide, so a behavior render defaults to the
// narrow detail-over-list.
function booksWideQuery() {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia(BOOKS_WIDE_QUERY)
    : null;
}

function subscribeBooksWide(onChange) {
  const query = booksWideQuery();
  if (!query?.addEventListener) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readBooksWide() {
  return booksWideQuery()?.matches ?? false;
}

function useBooksWide() {
  return useSyncExternalStore(subscribeBooksWide, readBooksWide, readBooksWide);
}

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

// The sync-state badge, shown only when the engine's `sync` fact for the book is
// not *in step* — the absence of the badge is "in step with Estante" (workflow 8
// L28; mockup L48). The word (never colour alone, mockups README L26) and its
// class come from the one sync-word authority, `syncDisplayFor` (sync.states);
// this view never derives the word itself.
function SyncBadge({ entry }) {
  const atom = syncDisplayFor(entry, { t });
  if (!atom) return null;
  return (
    <span className="badges">
      <span className={`badge ${atom.cls}`.trim()}>{atom.word}</span>
    </span>
  );
}

// The sync glyph (GUIDE L106), decorative inside its labelled parent (the header
// quiet mark) — hidden from the accessibility tree, the mark's aria-label names
// it.
function SyncGlyph() {
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
      <path d="M20 11a8 8 0 0 0-14-5l-2 2M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2M20 20v-4h-4" />
    </svg>
  );
}

// One book on the shelf: a row that opens the book (the detail/reader is a later
// task's seam, `onOpen`) and a rename control beside it. The row carries the
// title, the `{where} · {role}` meta line, and the sync badge when present; it
// reads `.sel` when it is the selected book (W07 desktop master-detail).
function BookRow({ id, book, kind, syncEntry, selected, onOpen, onFiles, onRename, rowRef }) {
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
          <SyncBadge entry={syncEntry} />
        </span>
        <span className="caret t-small" aria-hidden="true">
          ▸
        </span>
      </Button>
      <Button
        className="btn files-btn"
        aria-label={t('fileView.filesFor', { name: title })}
        onPress={() => onFiles(id)}
      >
        {t('fileView.filesEntry')}
      </Button>
      <RenameDialog bookId={id} currentName={title} onRename={onRename} />
    </div>
  );
}

// The rename control and its dialog (Decision 3; no rename control is drawn on
// the W07 board — this task introduces it). The trigger restores focus on close
// (RAC); the field opens pre-filled with the current name and, on submit, sends
// RENAME_BOOK and closes. The repository is never touched — only the shelf label.
function RenameDialog({ bookId, currentName, onRename }) {
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
      <ModalOverlay className="scrim center">
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

// The "mine on Estante" sub-section of the Add-a-book sheet (books.add_by_link,
// workflow 7 §Add-a-book L28-29; W07 L87-95): the account's books not yet on this
// device's shelf, computed by the Worker as the `listBooks`-minus-shelf diff and
// carried in the `mine` slice. Signed out, it says so in a word and offers the
// passkey surface; signed in, it lists each off-shelf book with an Add that
// clones it (ADD_MINE). A status carried by a word, never colour alone.
function MineList({ mine, onAddMine, onSignIn }) {
  const status = mine?.status ?? 'idle';
  if (status === 'signed_out') {
    return (
      <>
        <p className="t-small mine-note" role="status">
          {t('books.mineSignedOut')}
        </p>
        <Button className="btn" onPress={onSignIn}>
          {t('books.mineSignIn')}
        </Button>
      </>
    );
  }
  if (status === 'error') {
    return (
      <p className="notice warn" role="status">
        {t('books.mineError')}
      </p>
    );
  }
  if (status === 'ready') {
    const books = mine.books ?? [];
    if (!books.length) {
      return (
        <p className="t-small mine-note" role="status">
          {t('books.mineEmpty')}
        </p>
      );
    }
    return (
      <div className="list">
        {books.map((book) => {
          const label = book.label || book.id;
          return (
            <div className="row mine-row" key={book.id}>
              <span className="grow">
                <span className="name">{label}</span>
              </span>
              <Button
                className="btn"
                aria-label={t('books.mineAddLabel', { name: label })}
                onPress={() => onAddMine(book)}
              >
                {t('books.mineAdd')}
              </Button>
            </div>
          );
        })}
      </div>
    );
  }
  return null; // idle: the list has not loaded yet
}

// The *Add a book* affordance: the header "+" trigger and the bottom sheet it
// opens (W07 board). The sheet carries the four ways in (workflow 7 L13-33): New
// book (a local repository, no account — workflow 7 L25), By link (paste a book's
// invitation link → the invited flow, books.add_by_link), Mine on Estante (the
// account's off-shelf books), and Upload (books.upload_ui, not this task). On
// open it asks the Worker for the "mine" list (LIST_MINE); New book sends
// CREATE_BOOK, By link starts the invited flow with the pasted token, and each
// Mine row sends ADD_MINE.
function AddBookSheet({ onCreate, onByLink, onSignIn, onAddMine, onListMine, mine }) {
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState(false);
  return (
    <DialogTrigger
      onOpenChange={(open) => {
        if (open) {
          onListMine();
        } else {
          setName('');
          setLink('');
          setLinkError(false);
        }
      }}
    >
      <Button className="btn primary add-book">
        <PlusIcon />
        {t('books.add')}
      </Button>
      <ModalOverlay className="scrim">
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

                <section className="add-section" aria-labelledby="add-bylink-h">
                  <h3 className="t-h3" id="add-bylink-h">
                    {t('books.byLink')}
                  </h3>
                  <p className="t-small mine-note">{t('books.byLinkMeta')}</p>
                  <form
                    className="book-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const token = tokenFromLink(link);
                      if (!token) {
                        setLinkError(true);
                        return;
                      }
                      onByLink(token);
                      close();
                    }}
                  >
                    <TextField
                      className="field"
                      value={link}
                      onChange={(value) => {
                        setLink(value);
                        setLinkError(false);
                      }}
                    >
                      <Label>{t('books.byLinkLabel')}</Label>
                      <Input
                        className="input"
                        inputMode="url"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder={t('books.byLinkPlaceholder')}
                      />
                    </TextField>
                    {linkError ? (
                      <p className="notice warn" role="alert">
                        {t('books.byLinkInvalid')}
                      </p>
                    ) : null}
                    <div className="actions">
                      <Button type="submit" className="btn primary">
                        {t('books.byLinkOpen')}
                      </Button>
                    </div>
                  </form>
                </section>

                <section className="add-section" aria-labelledby="add-mine-h">
                  <h3 className="t-h3" id="add-mine-h">
                    {t('books.mineOnEstante')}
                  </h3>
                  <p className="t-small mine-note">{t('books.mineMeta')}</p>
                  <MineList
                    mine={mine}
                    onAddMine={(book) => {
                      onAddMine(book);
                      close();
                    }}
                    onSignIn={() => {
                      onSignIn();
                      close();
                    }}
                  />
                </section>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

export default function BooksScreen({
  store,
  onOpenBook = () => {},
  onByLink = () => {},
  onSignIn = () => {},
  mode = 'narrow',
}) {
  const shelf = useSlice(store, 'shelf');
  const sync = useSlice(store, 'sync');
  const mine = useSlice(store, 'mine');
  const ordered = useMemo(() => orderedBooks(shelf), [shelf]);

  // The shelf's own layout: side-by-side only when the shell is wide AND there
  // is room for a second nested sidebar (the computer, not the 712px tablet —
  // see `useBooksWide`/`BOOKS_WIDE_QUERY`). Below that the shelf uses the same
  // full-pane detail-over-list the phone does, so the detail and its acts get the
  // whole pane rather than a squeezed-to-nothing column (books.online Decision 2).
  const booksWide = useBooksWide();
  const splitMode = mode === 'wide' && booksWide ? 'wide' : 'narrow';

  // The header's one quiet mark: present when any shelf book is out of step
  // (the home book excluded), nothing when all are in step (workflow 8 L36-37).
  const outOfStep = anyOutOfStep(sync);

  // Selection is ephemeral (Decision 7): it highlights the open book (`.sel`),
  // and a new book takes it to move focus (acceptance 6). The per-book detail
  // is a SEPARATE ephemeral state (`openDetail`), so a freshly created book is
  // highlighted and focused without its detail springing open (books.online,
  // Decision 2): the detail opens only when a row is pressed.
  const [selected, setSelected] = useState(null);
  const [openDetail, setOpenDetail] = useState(null);

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

  // Ask the Worker for the account's off-shelf books when the sheet opens
  // (books.add_by_link, "mine on Estante"): GET /api/books minus this device's
  // shelf, replied as a MINE event the `mine` slice folds (Decision 5).
  const listMine = () => {
    store.send(command(CommandKind.LIST_MINE, {}));
  };

  // Add a book the account already has onto this device (ADD_MINE): clone it with
  // no accept — membership is a given. The id/url/role came with the MINE list.
  const addMine = (book) => {
    store.send(
      command(CommandKind.ADD_MINE, {
        bookId: book.id,
        gitUrl: book.gitUrl,
        label: book.label,
        role: book.role,
        author: LOCAL_IDENTITY,
      }),
    );
  };

  // *Sync now* (workflow 8 L37): fire one pass and return at once — the Worker's
  // scheduler coalesces it; nothing blocks on the network (DIRECTION §1). It
  // reuses the engine's SYNC command with a `sync-now` reason (engine.md
  // L340-343), the same path the automatic foreground/online triggers use.
  const syncNow = () => {
    store.send(command(CommandKind.SYNC, { reason: 'sync-now' }));
  };

  // Pressing a row opens its detail (and highlights it); the Files button opens
  // the file view, as before. The one exception: a book the engine left *needs
  // you* engages its in-progress merge instead (sync.conflicts, workflow 9
  // §Meeting one) — opening a paused book shows the conflict panel, not its
  // detail. That branch lives in the shell's `onOpenBook`, so route the press
  // there when the live sync phase says the book needs the user.
  const openBookDetail = (bookId) => {
    setSelected(bookId);
    if (sync[bookId]?.phase === 'needs_you') {
      onOpenBook(bookId);
      return;
    }
    setOpenDetail(bookId);
  };

  const detailKind = ordered.find((e) => e.id === openDetail)?.kind;
  const detail =
    openDetail != null ? (
      <BookDetail
        store={store}
        bookId={openDetail}
        kind={detailKind}
        mode={splitMode}
        onBack={() => setOpenDetail(null)}
        onReselect={(id) => {
          setSelected(id);
          setOpenDetail(id);
        }}
      />
    ) : null;

  const listView = (
    <>
      <div className="books-head">
        <h1 className="t-h1 grow">{t('shell.books')}</h1>
        {outOfStep ? (
          <span className="sync-mark" role="img" aria-label={t('books.notInStep')}>
            <SyncGlyph />
          </span>
        ) : null}
        <Button className="btn sync-now" onPress={syncNow}>
          {t('books.syncNow')}
        </Button>
        <AddBookSheet
          onCreate={createBook}
          onByLink={onByLink}
          onSignIn={onSignIn}
          onAddMine={addMine}
          onListMine={listMine}
          mine={mine}
        />
      </div>

      {ordered.length ? (
        <div className="list">
          {ordered.map(({ id, book, kind }) => (
            <BookRow
              key={id}
              id={id}
              book={book}
              kind={kind}
              syncEntry={sync[id]}
              selected={selected === id}
              onOpen={openBookDetail}
              onFiles={(bookId) => {
                setSelected(bookId);
                onOpenBook(bookId);
              }}
              onRename={renameBook}
              rowRef={(node) => {
                if (node) rowRefs.current.set(id, node);
                else rowRefs.current.delete(id);
              }}
            />
          ))}
        </div>
      ) : (
        <p className="t-small empty" role="status">
          {t('books.empty')}
        </p>
      )}
    </>
  );

  // Wide (computer): the shelf list on the side, the selected book's detail in
  // the main pane (Decision 2; W07 desktop frame). Narrow (phone and tablet — the
  // tablet has no room for a second nested sidebar, see `splitMode`): the list,
  // with a book's detail as a full-pane view over it, a back affordance in its
  // app bar returning to the list.
  if (splitMode === 'wide') {
    return (
      <div className="books-screen">
        <div className="split books-split">
          <div className="pane side">
            <div className="scroll">{listView}</div>
          </div>
          <div className="pane main">
            {detail ?? (
              <p className="t-small detail-empty" role="status">
                {t('books.pickBook')}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <div className="books-screen">{detail ?? listView}</div>;
}

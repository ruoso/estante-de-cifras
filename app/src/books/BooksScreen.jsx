// The book-management screen (books.shelf) — "managing them is a screen of its
// own" (DIRECTION §4 L434), workflow 7's specification. It fills the `books` tab
// panel (AppShell), reads the `shelf` slice through `useSlice`, and sends
// CREATE_BOOK / RENAME_BOOK through `store.send`; it never touches IndexedDB,
// never runs git, never reads the home book directly (DIRECTION §3.7 L407-414).
// The Worker owns the data; this view is the only React layer over it.
//
// It is the shelf LIST plus NEW. Each book row shows its title, where it lives,
// whether the user can save, how many songs it holds, and — only when a book is
// not in step — its sync state (workflow 7 L14-23; W07 board). Pressing a row
// opens the book's songs — search scoped to it, at `…/b/<book>` — and that is
// the row's one action (books.row_opens_songs; workflow 7 L28-34): Rename and
// Files live on the book's detail, reached from *Manage* on the bar above its
// songs, and a fork's *Bring them in* sits on that bar. One list at every width.
// *Add a book* opens a sheet that chooses between the four ways in
// (books.add_book_chooser); the upload preview a zip leads to is the shell's
// full-screen surface, not this screen's.
//
// Selection and the open sheet/dialog are ephemeral view state (useState), like
// the shell's destination selection — there is no router and nothing to persist
// (Decision 7). Every interactive part is a React Aria Component with a keyboard
// path and an accessible name; where-it-lives, can-save and the sync badge are
// each a word, never colour alone (mockups README L26).

// RAC overlays portal into the `.est` token root app-wide via the
// UNSAFE_PortalProvider in ThemeRoot (shell.portal_provider) — no per-screen
// portal container is threaded through here any more.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  FileTrigger,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  ProgressBar,
  TextField,
} from 'react-aria-components';
import { t, LOCALES, resolveLocale } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { tokenFromLink } from '../account/invitation-route.js';
import {
  titleFor,
  orderedBooks,
  forkLineFor,
  fillDisplayFor,
  elsewhereCopyFor,
  bookMetaFor,
} from './book-display.js';
import { inUseEntry } from '../instruments/InstrumentChip.jsx';
import { chipLabel } from '../instruments/instrument-helpers.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';
import { anyOutOfStep } from '../sync-display.js';
import { SyncBadge } from './BookBar.jsx';
import LeaveDialog from './LeaveDialog.jsx';
import './books.css';

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

// One book on the shelf: a single button that opens the book's songs
// (books.row_opens_songs; workflow 7 L28-34 — the row's one action). It carries
// the title, the `{where} · {role} · {count} songs` meta line (or *still
// loading*), and the sync badge when present; it reads `.sel` when it is the
// book last opened from here.
//
// A fork (books.fork, workflow 11; W11 board #2) also says where it came from —
// *from {original}* — and, when its original has saves it does not, *{original}
// has N new saves.* in words; its *Bring them in* is on the bar above the book's
// songs (workflow 7 L83-85).
function BookRow({ id, book, kind, syncEntry, fillEntry, original, songCount, building, selected, onOpen, rowRef }) {
  const title = titleFor(book, t('books.untitled'));
  // While the shelf fills on a new device (account.new_device; W13 frame 2):
  // the state as a word, its meta line, and a labelled bar while cloning.
  const fill = fillDisplayFor(fillEntry, { t });
  const fork = forkLineFor(book, original, t('books.untitled'));
  const meta = bookMetaFor(kind, book, { count: songCount, building, t });
  return (
    <div className={`book-row${selected ? ' sel' : ''}`}>
      <Button className="row book-open" ref={rowRef} onPress={() => onOpen(id)}>
        <span className="grow">
          <span className="name">{title}</span>
          {fork ? <span className="meta">{t('books.fromOriginal', { original: fork.from })}</span> : null}
          <span className="meta">{meta}</span>
          {fill?.meta ? <span className="meta fill-meta">{fill.meta}</span> : null}
          {fork?.newSaves ? (
            <span className="meta new-saves">
              {t('books.originalNewSaves', { original: fork.from, count: fork.newSaves })}
            </span>
          ) : null}
          <SyncBadge entry={syncEntry} originalGone={Boolean(fork?.gone)} />
          {fill ? (
            <span className="badges">
              <span className={`badge ${fill.cls}`.trim()}>{fill.word}</span>
            </span>
          ) : null}
        </span>
        <span className="caret t-small" aria-hidden="true">
          ▸
        </span>
      </Button>
      {fill?.state === 'cloning' ? (
        <ProgressBar
          className="fill-progress"
          value={fill.percent}
          aria-label={t('books.fillProgressLabel', { name: title })}
        >
          {({ percentage }) => (
            <div className="bar">
              <div style={{ width: `${percentage}%` }} />
            </div>
          )}
        </ProgressBar>
      ) : null}
    </div>
  );
}

// The *Home book restored* notice (account.new_device acceptance 3; W13 board
// frame 2): shown on the shelf when the account's settings came down on sign-in,
// with what is now set — the instrument and its tuning, the notation and the
// language, each read from the surfaced slices — until dismissed or the next
// start. Announced politely (`role="status"`); the dismiss is a RAC Button.
function RestoreNotice({ preferences, instruments, onDismiss }) {
  const instrument = chipLabel(inUseEntry(instruments));
  const dialect = preferences?.notation?.value ?? DEFAULT_DIALECT;
  const notation = ['brazilian', 'american', 'realbook'].includes(dialect)
    ? t(['newDevice', 'notation', dialect])
    : dialect;
  const languageId = resolveLocale(preferences?.language?.value);
  const language = LOCALES.find((l) => l.id === languageId)?.name ?? languageId;
  return (
    <div className="notice accent restore-notice">
      <div className="restore-text" role="status">
        <span>
          <b>{t('books.restoredTitle')}</b> {t('books.restoredBody')}
        </span>
        <span className="badges">
          {[instrument, notation, language].filter(Boolean).map((word) => (
            <span key={word} className="badge voiced">
              {word}
            </span>
          ))}
        </span>
      </div>
      <Button className="btn quiet" aria-label={t('books.restoredDismissLabel')} onPress={onDismiss}>
        {t('books.restoredDismiss')}
      </Button>
    </div>
  );
}

// The books only on another device of the account (account.new_device
// acceptance 5; workflow 13 §Books that were only on the other device; W13 board
// frame 2): *Only on your iPhone: Rascunhos* / *Put it online there to have it
// here.* Not rows that open — nothing of them is on this device.
function ElsewhereRows({ elsewhere }) {
  if (!elsewhere?.length) return null;
  return (
    <div className="elsewhere">
      {elsewhere.map((entry) => {
        const copy = elsewhereCopyFor(entry, { t });
        return (
          <div className="notice elsewhere-row" key={`${entry.deviceId}/${entry.bookId}`}>
            <span>
              <b>{copy.line}</b>
            </span>
            <span className="t-small">{copy.help}</span>
          </div>
        );
      })}
    </div>
  );
}

// The chooser's row icons (W07 #2 L80-98): 22px, in the accent, decorative —
// each row is named by its own words.
function ChoiceIcon({ children }) {
  return (
    <svg
      className="add-choice-icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

// The key on Mine's "Sign in with a passkey" (W07 L92); decorative.
function KeyIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3M15 8l2 2" />
    </svg>
  );
}

// The "mine on Estante" row of the Add-a-book chooser (books.add_by_link,
// workflow 7 §Add-a-book L28-29; W07 L87-95): the account's books not yet on this
// device's shelf, computed by the Worker as the `listBooks`-minus-shelf diff and
// carried in the `mine` slice. Signed out, it says so in a word and offers the
// two ways in for an existing account (books.add_book_chooser Decision 4): *Sign
// in with a passkey* and *No passkey here? Email me a link*, each handed to
// `onSignIn` with the sign-in step to open at ('method' / 'email'). Signed in,
// it lists each off-shelf book with an Add that clones it (ADD_MINE). A status
// carried by a word, never colour alone.
//
// A row whose role is not `owner` also offers Leave (books.leave; workflow 10
// L99-101, Leave-book board L143): the same confirmation as book management,
// the sentence alone — nothing of it is on this device (board L192).
function MineList({ store, mine, onAddMine, onSignIn }) {
  const status = mine?.status ?? 'idle';
  if (status === 'signed_out') {
    return (
      <>
        <Button className="btn mine-sign-in" onPress={() => onSignIn('method')}>
          <KeyIcon />
          {t('books.mineSignInPasskey')}
        </Button>
        {/* An action in the app, not an address: a RAC Button worn as the
            board's accent link (W07 L93). */}
        <Button className="t-small mine-email-link" onPress={() => onSignIn('email')}>
          {t('books.mineEmailLink')}
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
              {book.role !== 'owner' ? (
                <LeaveDialog
                  store={store}
                  bookId={book.id}
                  title={label}
                  ownerName={book.ownerName}
                  trigger={t('books.mineLeave')}
                  triggerLabel={t('books.mineLeaveLabel', { name: label })}
                  triggerClass="btn quiet"
                  triggerStyle={null}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }
  return null; // idle: the list has not loaded yet
}

// One row of the chooser that is a button (W07 L79-86, L96-99): an accent icon,
// the way's name and its meta line. The row is named by its name and described
// by its meta line (aria-labelledby / aria-describedby), so a screen reader
// hears "New book, button" and then the line that explains it.
function ChoiceRow({ id, icon, name, meta, buttonRef, onPress }) {
  return (
    <Button
      ref={buttonRef}
      className="row add-choice"
      aria-labelledby={`${id}-name`}
      aria-describedby={`${id}-meta`}
      onPress={onPress}
    >
      <ChoiceIcon>{icon}</ChoiceIcon>
      <span className="grow">
        <span className="name" id={`${id}-name`}>
          {name}
        </span>
        <span className="meta" id={`${id}-meta`}>
          {meta}
        </span>
      </span>
    </Button>
  );
}

// The *Add a book* affordance: the header "+" trigger and the bottom sheet it
// opens (W07 #2). The sheet is a chooser (books.add_book_chooser; workflow 7
// L23-38): four rows, New book, By link, Mine on Estante and Upload, in the
// board's order. New book and By link open their one field as a step in the
// same sheet, with Back to the four (Decision 1); Upload's row is the zip picker
// itself (Decision 2); Mine on Estante holds its own controls in place
// (Decision 3). On open it asks the Worker for the "mine" list (LIST_MINE); New
// book sends CREATE_BOOK, By link starts the invited flow with the pasted token,
// each Mine row sends ADD_MINE, and a picked zip goes to `onUpload`.
//
// The step is ephemeral sheet state: closing the sheet from a step and reopening
// it starts on the chooser with the fields cleared. The sheet keeps its name,
// "Add a book", in every step; a step's own heading is the level below it.
function AddBookSheet({ store, onCreate, onByLink, onSignIn, onAddMine, onListMine, onUpload, mine }) {
  const [step, setStep] = useState('choose'); // 'choose' | 'new' | 'byLink'
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState(false);
  const idBase = useId();
  const rowRefs = useRef({});
  // A step's field takes focus on arrival; Back puts focus on the row the step
  // came from.
  const fieldRef = useRef(null);
  const backTo = useRef(null);
  useEffect(() => {
    if (step !== 'choose') {
      fieldRef.current?.focus();
      return;
    }
    if (!backTo.current) return;
    rowRefs.current[backTo.current]?.focus();
    backTo.current = null;
  }, [step]);
  const goBack = () => {
    backTo.current = step;
    setStep('choose');
  };
  const mineStatus = mine?.status ?? 'idle';
  return (
    <DialogTrigger
      onOpenChange={(open) => {
        if (open) {
          onListMine();
        } else {
          setStep('choose');
          setName('');
          setLink('');
          setLinkError(false);
          backTo.current = null;
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
                  <Heading slot="title" className="t-h2">
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

                {step === 'new' ? (
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
                    <h3 className="t-h3 add-step-title">{t('books.create')}</h3>
                    <TextField className="field" value={name} onChange={setName}>
                      <Label>{t('books.nameLabel')}</Label>
                      <Input ref={fieldRef} className="input" placeholder={t('books.namePlaceholder')} />
                    </TextField>
                    <p className="t-small mine-note">{t('books.newBookHelp')}</p>
                    <div className="actions">
                      <Button className="btn" onPress={goBack}>
                        {t('books.back')}
                      </Button>
                      <Button type="submit" className="btn primary">
                        {t('books.create')}
                      </Button>
                    </div>
                  </form>
                ) : step === 'byLink' ? (
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
                    <h3 className="t-h3 add-step-title">{t('books.byLink')}</h3>
                    <p className="t-small mine-note">{t('books.byLinkMeta')}</p>
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
                        ref={fieldRef}
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
                      <Button className="btn" onPress={goBack}>
                        {t('books.back')}
                      </Button>
                      <Button type="submit" className="btn primary">
                        {t('books.byLinkOpen')}
                      </Button>
                    </div>
                  </form>
                ) : (
                  // The four ways in, in the board's order (W07 L79-99). A plain
                  // container, not role="list": a list of buttons fails axe's
                  // aria-required-children.
                  <div className="list add-choices">
                    <ChoiceRow
                      id={`${idBase}-new`}
                      icon={<path d="M12 5v14M5 12h14" />}
                      name={t('books.create')}
                      meta={t('books.newBookHelp')}
                      buttonRef={(node) => (rowRefs.current.new = node)}
                      onPress={() => setStep('new')}
                    />
                    <ChoiceRow
                      id={`${idBase}-link`}
                      icon={
                        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                      }
                      name={t('books.byLink')}
                      meta={t('books.byLinkMeta')}
                      buttonRef={(node) => (rowRefs.current.byLink = node)}
                      onPress={() => setStep('byLink')}
                    />
                    {/* Mine on Estante is not a button: it holds controls of its
                        own (W07 L87-95; Decision 3). */}
                    <div className="row add-choice add-mine" role="group" aria-labelledby={`${idBase}-mine-name`}>
                      <ChoiceIcon>
                        <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-.8 3 15.6-3.5.8z" />
                      </ChoiceIcon>
                      <span className="grow">
                        <span className="name" id={`${idBase}-mine-name`}>
                          {t('books.mineOnEstante')}
                        </span>
                        <span className="t-small mine-note">
                          {t('books.mineMeta')}
                          {mineStatus === 'signed_out' ? (
                            <>
                              {' '}
                              <span role="status">{t('books.mineSignedOut')}</span>
                            </>
                          ) : null}
                        </span>
                        <MineList
                          store={store}
                          mine={mine}
                          onAddMine={(book) => {
                            onAddMine(book);
                            close();
                          }}
                          onSignIn={(how) => {
                            onSignIn(how);
                            close();
                          }}
                        />
                      </span>
                    </div>
                    {/* Upload (books.upload_ui; W07 L96-99): the row is the RAC
                        FileTrigger's button (Decision 2), an accessible file input
                        accepting `.zip`. The picked file is read to bytes on this
                        thread and handed on (DIRECTION §3.7) — the only data
                        handling here; the shell opens the full-screen preview once
                        the sheet closes. Cancelling the picker leaves the chooser
                        open. */}
                    <FileTrigger
                      acceptedFileTypes={['.zip', 'application/zip']}
                      onSelect={(files) => {
                        const file = files?.[0];
                        if (!file) return;
                        // Read to a Uint8Array view (the Worker accepts
                        // ArrayBuffer/Uint8Array — protocol.js:334); a view
                        // survives structured-clone with its byte offsets intact.
                        file.arrayBuffer().then((buf) => {
                          onUpload({ bytes: new Uint8Array(buf), fileName: file.name });
                          close();
                        });
                      }}
                    >
                      <ChoiceRow
                        id={`${idBase}-upload`}
                        icon={<path d="M12 20V8M7 13l5-5 5 5M4 4h16" />}
                        name={t('books.uploadRow')}
                        meta={t('books.uploadRowMeta')}
                      />
                    </FileTrigger>
                  </div>
                )}
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
  // Pressing a book (books.row_opens_songs): the shell opens its songs, search
  // scoped to it at `…/b/<book>`, for every sync phase.
  onOpenBookSongs = () => {},
  // A fork made from the book's detail, which lands here (the BOOK_FORKED
  // payload): the screen opens with the fork selected and its one-time note.
  forked = null,
  onByLink = () => {},
  // Mine on Estante's sign-in (books.add_book_chooser Decision 4), called with
  // the sign-in step to open at: 'method' or 'email'.
  onSignIn = () => {},
  // A zip picked from the sheet's Upload row, `{ bytes, fileName }`: the shell
  // opens the full-screen upload preview (books.add_book_chooser Decision 5).
  onUpload = () => {},
  // The restore notice's dismissal, held by the shell so it outlives a tab
  // switch (account.new_device); a screen mounted alone keeps its own.
  restoreDismissed,
  onDismissRestored = () => {},
}) {
  const shelf = useSlice(store, 'shelf');
  const fill = useSlice(store, 'fill');
  const home = useSlice(store, 'home');
  const preferences = useSlice(store, 'preferences');
  const instruments = useSlice(store, 'instruments');
  const [ownDismissed, setOwnDismissed] = useState(false);
  const dismissed = restoreDismissed ?? ownDismissed;
  const showRestored = home?.restored === true && !dismissed;
  const filling = Object.keys(fill ?? {}).length > 0;
  const sync = useSlice(store, 'sync');
  const originals = useSlice(store, 'originals');
  const mine = useSlice(store, 'mine');
  const index = useSlice(store, 'index');
  const songCounts = useSlice(store, 'songCounts');
  const ordered = useMemo(() => orderedBooks(shelf), [shelf]);

  // The header's one quiet mark: present when any shelf book is out of step
  // (the home book excluded), nothing when all are in step (workflow 8 L36-37).
  const outOfStep = anyOutOfStep(sync);

  // Selection is ephemeral (Decision 7): it highlights the book last opened
  // from here (`.sel`), and a new book takes it to move focus (acceptance 6).
  const [selected, setSelected] = useState(forked?.bookId ?? null);

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

  // A book became its fork (books.fork, workflow 11 §What a fork is): the fork
  // took the original's place, so the selection follows the new id, with the
  // one-time note saying what happened (W11 #2).
  const noteFor = (forkId) => {
    const book = ordered.find((e) => e.id === forkId)?.book;
    const original = forkLineFor(book, undefined, t('books.untitled'))?.from ?? titleFor(book, t('books.untitled'));
    return { book: titleFor(book, t('books.untitled')), original };
  };
  const [forkedNote, setForkedNote] = useState(() => (forked?.bookId ? noteFor(forked.bookId) : null));
  useWorkerEvent(store, EventKind.BOOK_FORKED, ({ previousBookId, bookId: forkId }) => {
    setForkedNote(noteFor(forkId));
    setSelected((prev) => (prev === previousBookId ? forkId : prev));
  });

  const createBook = (title) => {
    wantFocus.current = true;
    store.send(command(CommandKind.CREATE_BOOK, { title }));
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
        ...(book.ownerName ? { ownerName: book.ownerName } : {}),
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

  // Pressing a row opens the book's songs (workflow 7 L28-34), whatever its
  // sync phase: a book that needs you opens on its songs too, its notice and
  // *Settle* on the bar above them (workflow 9 §Meeting one).
  const openBookSongs = (bookId) => {
    setSelected(bookId);
    onOpenBookSongs(bookId);
  };

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
          store={store}
          onCreate={createBook}
          onByLink={onByLink}
          onSignIn={onSignIn}
          onAddMine={addMine}
          onListMine={listMine}
          onUpload={onUpload}
          mine={mine}
        />
      </div>

      {showRestored ? (
        <RestoreNotice
          preferences={preferences}
          instruments={instruments}
          onDismiss={() => {
            setOwnDismissed(true);
            onDismissRestored();
          }}
        />
      ) : null}

      {filling ? (
        <div className="section-label">
          <span className="t-h3">{t('books.yourShelf')}</span>
          <span className="t-small" role="status">
            {t('books.yourShelfCount', { count: ordered.length })}
          </span>
        </div>
      ) : null}

      {ordered.length ? (
        <div className="list">
          {ordered.map(({ id, book, kind }) => (
            <BookRow
              key={id}
              id={id}
              book={book}
              kind={kind}
              syncEntry={sync[id]}
              fillEntry={fill?.[id]}
              original={originals[id]}
              songCount={songCounts?.[id]}
              building={index?.[id] === 'building'}
              selected={selected === id}
              onOpen={openBookSongs}
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
      <ElsewhereRows elsewhere={shelf?.elsewhere} />
      {/* Said once, on BOOK_FORKED (W11 board #2 :88): the fork took the
          original's place, so nothing shows twice. */}
      {forkedNote ? (
        <p className="t-small forked-note" role="status">
          {t('books.forkedNote', forkedNote)}
        </p>
      ) : null}
    </>
  );

  // One list at every width (workflow 7 L36-37): a book's detail is reached
  // from its songs, never beside the shelf.
  return <div className="books-screen">{listView}</div>;
}

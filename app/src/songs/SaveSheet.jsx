// SaveSheet.jsx — "the sheet that opens when Save passes its gate"
// (songs.save_sheet, workflow 4 §Saving; W04 board). It shows what changed in
// musical terms (the semantic diff between the last-saved version and the
// working copy) and a note prefilled from that summary which the user may edit;
// confirming commits the one file — or, for *save all*, every changed song in
// the book in one commit — with the note as the commit message, and pushes
// (workflow 4 §Save pushes). The first save ever asks once for the author's
// name; a never-saved song with no title line is named here too.
//
// The view is the only React layer (DIRECTION §3.7): it reads the `savePreview`
// and `preferences` slices through `useSlice`, sends PREVIEW_SAVE / SAVE /
// NAME_AND_SAVE / SET_IDENTITY_NAME through `store.send`, and closes on the
// SAVED event. It never touches IndexedDB, git or HEAD — reading the last-saved
// version to diff against is the Worker's PREVIEW_SAVE (Decision 2). Every
// interactive part is a React Aria Component with a keyboard path and a label;
// the diff rows are localized (Decision 3), the saved note stays neutral English.
//
// Where it sits follows the device (songs.editor_chrome Constraint 7; workflow 4
// §Saving): `presentation="sheet"` a bottom sheet (the phone, W04#2), `"dialog"`
// a centred dialog (the tablet, and a new song's first save on a computer,
// W03#4), `"panel"` a labelled region beside the song with no overlay (a saved
// song on a computer, W04#4) — one `SaveForm` in all three. The panel sits
// beside text still being edited, so a new `revision` re-asks the preview; an
// untouched note follows it, a typed one is kept.
//
// The editable form lives in an inner component mounted only while the sheet is
// open (RAC renders the Dialog's children only when the overlay is open), so its
// state is fresh each time — no reset effect. RAC overlays portal into the `.est`
// token root app-wide (shell.portal_provider), so the sheet carries the theme
// with no per-screen portal (memory: rac-overlays-portal-outside-est-theme-root).

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  Heading,
  HeadingContext,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Text,
  TextArea,
  TextField,
} from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import DiffRows from './DiffRows.jsx';
import { MakeYourOwnBody } from '../books/MakeYourOwn.jsx';
import { buildSaveNote } from './save-note.js';
import { deriveSongFilename } from './song-filename.js';
import './save-sheet.css';

// The editable commit form, mounted only while the sheet is open.
function SaveForm({
  store,
  close,
  onClose,
  bookId,
  bookLabel,
  paths,
  isNew,
  fromPath,
  titleHint,
  revision,
  panel,
  beforeSave,
}) {
  const savePreview = useSlice(store, 'savePreview');
  const preferences = useSlice(store, 'preferences');

  const previewPaths = useMemo(
    () => (isNew ? [fromPath].filter(Boolean) : paths ?? []),
    [isNew, fromPath, paths],
  );

  // Ask the Worker for the preview on open (this body mounts on open), and again
  // on each new `revision` — the text moved under an open panel (Constraint 8).
  useEffect(() => {
    if (previewPaths.length) {
      store.send(command(CommandKind.PREVIEW_SAVE, { bookId, paths: previewPaths }));
    }
  }, [store, bookId, previewPaths, revision]);

  // The save landed: close (filtered to this book, so another book's save never
  // closes it). SAVE_REFUSED is the Worker's backstop — surface it, stay open; a
  // save that failed outright (reason 'failed') is surfaced the same way, with
  // Save still enabled for another try (songs.save_empty_message).
  const [refused, setRefused] = useState(null);
  useWorkerEvent(store, EventKind.SAVED, (payload) => {
    if (payload?.bookId === bookId) onClose();
  });
  useWorkerEvent(store, EventKind.SAVE_REFUSED, (payload) => {
    if (payload?.bookId === bookId) setRefused({ line: payload?.line ?? null, reason: payload?.reason ?? null });
  });

  const previews = useMemo(
    () => savePreview?.[bookId]?.previews ?? [],
    [savePreview, bookId],
  );
  const firstPreview = previews[0];
  const defaultNote = useMemo(() => buildSaveNote(previews), [previews]);

  const storedName = preferences?.authorName?.value;
  const needsName = !storedName;
  const needsSongName = isNew && !(firstPreview?.title ?? '').trim();

  // The note is the diff summary until the user edits it (null → default), so no
  // effect is needed to prefill it (Decision 3 — the note stays neutral English).
  const [note, setNote] = useState(null);
  const [authorName, setAuthorName] = useState('');
  const [songName, setSongName] = useState('');
  const noteValue = note ?? defaultNote;

  // The name the first save gives the file (songs.first_save_fields Constraint
  // 3): the Worker's, unless the user is naming a title-less song here — then
  // the typed name folded against the folder's names the preview carried, the
  // same pure function the Worker runs, so it follows each keystroke.
  const fileName =
    needsSongName && songName.trim()
      ? deriveSongFilename(songName, firstPreview?.taken ?? [])
      : (firstPreview?.fileName ?? '');

  const nameMissing = needsName && !authorName.trim();
  const songNameMissing = needsSongName && !songName.trim();
  const canConfirm = !nameMissing && !songNameMissing;

  const confirm = () => {
    if (!canConfirm) return;
    // The editor's gate, again: beside an open panel the text may have moved
    // to something that cannot be saved (songs.editor_chrome Constraint 2).
    if (beforeSave && !beforeSave()) return;
    const name = (storedName ?? authorName.trim()) || '';
    if (needsName) {
      store.send(command(CommandKind.SET_IDENTITY_NAME, { name }));
    }
    // The Worker authors the commit (account.commit_author Decision 3); the
    // sheet hands it only the typed name, which may not be stored yet.
    if (isNew) {
      store.send(
        command(CommandKind.NAME_AND_SAVE, {
          bookId,
          fromPath,
          name,
          message: noteValue,
          title: songName.trim() || undefined,
        }),
      );
    } else {
      store.send(
        command(CommandKind.SAVE, { bookId, paths: paths ?? [], message: noteValue, name }),
      );
    }
  };

  const multi = !isNew && (paths?.length ?? 0) > 1;
  const headerTitle = multi
    ? t('saveSheet.titleAll', { count: paths.length })
    : t('saveSheet.title', { title: firstPreview?.title || titleHint || t('newSong.untitled') });

  return (
    <>
      <Heading slot="title" className="t-h2">
        {headerTitle}
      </Heading>

      {needsName && (
        <TextField className="field" value={authorName} onChange={setAuthorName} isRequired>
          <Label>{t('saveSheet.nameLabel')}</Label>
          <Input className="input" />
          <span className="t-small">{t('saveSheet.nameHelp')}</span>
        </TextField>
      )}

      {needsSongName && (
        <TextField className="field" value={songName} onChange={setSongName} isRequired>
          <Label>{t('saveSheet.songNameLabel')}</Label>
          <Input className="input" />
          <span className="t-small">{t('saveSheet.songNameHelp')}</span>
        </TextField>
      )}

      {isNew && (
        // Where the song goes, shown, not chosen (W03#4 L179-187; Decision 3):
        // the book is changed from the line above the editor.
        <>
          <TextField className="field" value={bookLabel} isReadOnly>
            <Label>{t('saveSheet.bookLabel')}</Label>
            <Input className="input est-save-readonly" />
          </TextField>
          <TextField className="field" value={fileName} isReadOnly>
            <Label>{t('saveSheet.fileNameLabel')}</Label>
            <Input className="input t-mono est-save-readonly" />
            <Text slot="description" className="t-small">
              {t('saveSheet.fileNameHelp')}
            </Text>
          </TextField>
        </>
      )}

      <div className="t-h3">{t('saveSheet.whatChanged')}</div>
      {multi ? (
        <div className="est-save-songs">
          {previews.map((p) => (
            <div className="est-save-song" key={p.path}>
              <div className="t-small est-save-song-title">{p.title || p.path}</div>
              <DiffRows changes={p.changes} />
            </div>
          ))}
        </div>
      ) : (
        <DiffRows changes={firstPreview?.changes} />
      )}

      <TextField
        className="field"
        value={noteValue}
        onChange={setNote}
      >
        <Label>{t('saveSheet.note')}</Label>
        <TextArea className="input est-save-note" rows={2} />
      </TextField>

      {refused && (
        <p className="notice conflict est-save-refused" role="alert">
          {refused.reason === 'merge_in_progress'
            ? t('saveSheet.refusedMerge')
            : refused.reason === 'failed'
              ? t('saveSheet.failed')
              : t('saveSheet.refused', { line: refused.line ?? '?' })}
        </p>
      )}

      <p className="t-small">{t('saveSheet.pushCaption')}</p>

      {panel ? (
        // W04#4 L206: the panel's one full-width Save; it closes with Escape
        // or the quiet Cancel under it, the text stays in reach beside it.
        <div className="est-save-panel-actions">
          <Button className="btn primary block" isDisabled={!canConfirm} onPress={confirm}>
            {t('saveSheet.save')}
          </Button>
          <Button className="btn quiet block" onPress={close}>
            {t('saveSheet.cancel')}
          </Button>
        </div>
      ) : (
        <div className="actions">
          <Button className="btn" onPress={close}>
            {t('saveSheet.cancel')}
          </Button>
          <Button className="btn primary" isDisabled={!canConfirm} onPress={confirm}>
            {t('saveSheet.save')}
          </Button>
        </div>
      )}
    </>
  );
}

// The open sheet's content. A book the user cannot save to shows the
// make-it-your-own offer (workflow 4 §A book the user cannot push to; books.fork)
// in place of the form; once the Worker made the fork it turns into the ordinary
// save form for the same paths in the fork, so the save lands there. Whether it
// must offer the fork is latched on open: between the SHELF re-surface that
// drops the original and BOOK_FORKED, the host's `canSave` reads a book with no
// shelf entry and must not flip to a form for the vanished id.
function SheetContent({
  store,
  close,
  onClose,
  bookId,
  canSave,
  bookLabel,
  titleHint,
  onMakeYourOwn,
  grip,
  ...form
}) {
  const [mustFork] = useState(canSave === false);
  const [forkedTo, setForkedTo] = useState(null);
  const gripMark = grip ? <div className="grip" aria-hidden="true" /> : null;
  if (mustFork && !forkedTo) {
    return (
      <>
        {gripMark}
        <MakeYourOwnBody
          store={store}
          bookId={bookId}
          bookTitle={bookLabel || titleHint}
          onCancel={close}
          onForked={({ bookId: forkId }) => {
            setForkedTo(forkId);
            onMakeYourOwn(forkId);
          }}
        />
      </>
    );
  }
  return (
    <>
      {gripMark}
      <SaveForm
        store={store}
        close={close}
        onClose={onClose}
        bookId={forkedTo ?? bookId}
        bookLabel={bookLabel}
        titleHint={titleHint}
        {...form}
      />
    </>
  );
}

// The computer's inline panel (W04#4 L186-207): a region named by its heading,
// not a dialog — the editor beside it stays editable. Opening it moves focus to
// its heading; Escape inside it closes it (the host returns focus to its Save).
function SavePanel({ onClose, ...content }) {
  const headingId = useId();
  const sectionRef = useRef(null);
  useEffect(() => {
    sectionRef.current?.querySelector(`[id="${headingId}"]`)?.focus();
  }, [headingId]);
  return (
    // The Escape is a shortcut on the region the panel's own controls sit in;
    // every control inside is a RAC control with its own keyboard path.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      ref={sectionRef}
      className="pane side est-save-panel"
      aria-labelledby={headingId}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {/* Both bodies head themselves with a `slot="title"` Heading; outside a
          Dialog the slot is filled here, so the region is named by it. */}
      <HeadingContext.Provider value={{ slots: { title: { id: headingId, tabIndex: -1 } } }}>
        <SheetContent close={onClose} onClose={onClose} {...content} />
      </HeadingContext.Provider>
    </section>
  );
}

/**
 * The save sheet. `canSave === false` (a reader's book — `saveTargetFor`) opens
 * the make-it-your-own offer instead of the form; `onMakeYourOwn(forkId)` tells
 * the host the book became its fork (the host's own id follows BOOK_FORKED).
 */
export default function SaveSheet({
  store,
  isOpen,
  onClose,
  bookId,
  paths,
  isNew = false,
  fromPath = null,
  titleHint = '',
  bookLabel = '',
  canSave = true,
  onMakeYourOwn = () => {},
  presentation = 'sheet',
  revision = 0,
  beforeSave,
}) {
  // A stable accessible name for the overlay, independent of the preview
  // arriving; the make-it-your-own offer is named by its own heading.
  const label =
    canSave === false
      ? undefined
      : !isNew && (paths?.length ?? 0) > 1
        ? t('saveSheet.titleAll', { count: paths.length })
        : t('saveSheet.title', { title: titleHint || t('newSong.untitled') });

  const content = {
    store,
    bookId,
    canSave,
    bookLabel,
    titleHint,
    onMakeYourOwn,
    paths,
    isNew,
    fromPath,
    revision,
    beforeSave,
  };

  if (presentation === 'panel') {
    return isOpen ? <SavePanel onClose={onClose} {...content} panel /> : null;
  }

  const sheet = presentation !== 'dialog';
  return (
    <ModalOverlay
      className={sheet ? 'scrim' : 'scrim center'}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <Modal className={sheet ? 'sheet est-save-sheet' : 'dialog est-save-sheet est-save-dialog'}>
        <Dialog aria-label={label}>
          {({ close }) => <SheetContent close={close} onClose={onClose} grip={sheet} {...content} />}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

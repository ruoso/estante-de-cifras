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
// The editable form lives in an inner component mounted only while the sheet is
// open (RAC renders the Dialog's children only when the overlay is open), so its
// state is fresh each time — no reset effect. RAC overlays portal into the `.est`
// token root app-wide (shell.portal_provider), so the sheet carries the theme
// with no per-screen portal (memory: rac-overlays-portal-outside-est-theme-root).

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextArea,
  TextField,
} from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import DiffRows from './DiffRows.jsx';
import { buildSaveNote } from './save-note.js';
import './save-sheet.css';

// Before sign-in a device's commits carry a local id (DIRECTION §3.2 L164-170);
// the save sheet supplies the display name (stored, or asked here) on top of it.
const LOCAL_ID = 'local';

// The editable commit form, mounted only while the sheet is open.
function SaveForm({ store, close, onClose, bookId, paths, isNew, fromPath, titleHint }) {
  const savePreview = useSlice(store, 'savePreview');
  const preferences = useSlice(store, 'preferences');

  const previewPaths = useMemo(
    () => (isNew ? [fromPath].filter(Boolean) : paths ?? []),
    [isNew, fromPath, paths],
  );

  // Ask the Worker for the preview once, on open (this body mounts on open).
  useEffect(() => {
    if (previewPaths.length) {
      store.send(command(CommandKind.PREVIEW_SAVE, { bookId, paths: previewPaths }));
    }
  }, [store, bookId, previewPaths]);

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

  const nameMissing = needsName && !authorName.trim();
  const songNameMissing = needsSongName && !songName.trim();
  const canConfirm = !nameMissing && !songNameMissing;

  const confirm = () => {
    if (!canConfirm) return;
    const name = (storedName ?? authorName.trim()) || '';
    if (needsName) {
      store.send(command(CommandKind.SET_IDENTITY_NAME, { name, author: { id: LOCAL_ID, name } }));
    }
    const author = { id: LOCAL_ID, name: name || 'Me' };
    if (isNew) {
      store.send(
        command(CommandKind.NAME_AND_SAVE, {
          bookId,
          fromPath,
          author,
          message: noteValue,
          title: songName.trim() || undefined,
        }),
      );
    } else {
      store.send(
        command(CommandKind.SAVE, { bookId, paths: paths ?? [], message: noteValue, author }),
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

      <div className="actions">
        <Button className="btn" onPress={close}>
          {t('saveSheet.cancel')}
        </Button>
        <Button className="btn primary" isDisabled={!canConfirm} onPress={confirm}>
          {t('saveSheet.save')}
        </Button>
      </div>
    </>
  );
}

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
}) {
  // A stable accessible name for the overlay, independent of the preview arriving.
  const label =
    !isNew && (paths?.length ?? 0) > 1
      ? t('saveSheet.titleAll', { count: paths.length })
      : t('saveSheet.title', { title: titleHint || t('newSong.untitled') });

  return (
    <ModalOverlay
      className="scrim"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <Modal className="sheet est-save-sheet">
        <Dialog aria-label={label}>
          {({ close }) =>
            canSave === false ? (
              // A book the user cannot push to (workflow 4 §A book the user
              // cannot push to): explain and offer to make it their own
              // (workflow 11, delivered there — Deferred). Nothing to commit.
              <>
                <div className="grip" aria-hidden="true" />
                <Heading slot="title" className="t-h2">
                  {t('saveSheet.cannotSaveTitle', { title: titleHint })}
                </Heading>
                <p className="t-small est-save-cannot">
                  {t('saveSheet.cannotSaveBody', { title: titleHint, book: bookLabel })}
                </p>
                <div className="actions">
                  <Button className="btn quiet" onPress={close}>
                    {t('saveSheet.notNow')}
                  </Button>
                  <Button className="btn primary" onPress={onMakeYourOwn}>
                    {t('saveSheet.makeYourOwn')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grip" aria-hidden="true" />
                <SaveForm
                  store={store}
                  close={close}
                  onClose={onClose}
                  bookId={bookId}
                  paths={paths}
                  isNew={isNew}
                  fromPath={fromPath}
                  titleHint={titleHint}
                />
              </>
            )
          }
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

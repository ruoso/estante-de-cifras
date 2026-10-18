// BookConflicts — the book-level paused panel (sync.conflicts, workflow 9
// §Meeting one / §The rest / §Leaving one; W09 computer). A book the sync engine
// left *needs you* shows, once engaged: the *N songs need you* notice, the *in
// conflict* list with *Settle*, the deleted-against-edited cards, the *came in …
// already here* list, the held-save card, and *abandon the merge*. The merge is
// book-wide — nothing new comes in until it is settled (workflow 9 L38-45).
//
// The view only sends RESOLVE_CONFLICT (keep / delete a deleted-vs-edited song)
// and ABANDON_MERGE, and mirrors the Worker through the `conflicts` slice. React
// Aria Components, keyboard reachable, every status carried by a word.
//
// On a phone it is a full screen over the shell; `embedded` (a tablet or a
// computer) draws it as the content of the shell's main pane, the rail beside it,
// keeping its app bar (sync.conflicts_polish constraint 5; W09#4 L205-254).

import { useEffect, useRef } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import './book-conflicts.css';

export default function BookConflicts({ store, bookId, title, embedded = false, onSettle, onClose }) {
  const conflicts = useSlice(store, 'conflicts');
  const book = conflicts?.[bookId] ?? null;
  // The recomputed model arrives just after OPEN_CONFLICTS engages the book, so
  // `book` is briefly absent at first; don't mistake that for settled. Once it has
  // loaded, its later disappearance means the merge settled or was abandoned —
  // leave to the shell, the book no longer *needs you*.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (book) loadedRef.current = true;
  }, [book]);
  useEffect(() => {
    if (!book && loadedRef.current) onClose?.();
  }, [book, onClose]);

  const songs = book?.songs ?? [];
  const deleted = book?.deleted ?? [];
  const incoming = book?.incoming ?? [];
  const pending = songs.length + deleted.length;

  const keepDeleted = (path) => store.send(command(CommandKind.RESOLVE_CONFLICT, { bookId, path, choice: 'keep' }));
  const deleteDeleted = (path) => store.send(command(CommandKind.RESOLVE_CONFLICT, { bookId, path, choice: 'delete' }));
  const keepBothSong = (path) => store.send(command(CommandKind.RESOLVE_CONFLICT, { bookId, path, choice: 'keep_both_song' }));
  const abandon = () => store.send(command(CommandKind.ABANDON_MERGE, { bookId }));

  return (
    <div className={embedded ? 'est-bookconf-embedded' : 'screen est-bookconf-screen'}>
      <div className="appbar">
        {onClose && (
          <Button className="btn icon" aria-label={t('songConflict.back')} onPress={() => onClose()}>
            ‹
          </Button>
        )}
        <span className="title">{title}</span>
        <span className="badge conflict dot">{t('books.needsYou')}</span>
      </div>

      {book && (
      <div className={embedded ? 'est-bookconf-scroll' : 'scroll est-bookconf-scroll'}>
        <div className="notice conflict est-bookconf-needsyou" role="status">
          <span>
            <b>{t('bookConflicts.needsYou', { count: pending })}</b> {t('bookConflicts.needsYouBody')}
          </span>
        </div>

        <div className="est-bookconf-cols">
          <div className="est-bookconf-main">
            {songs.length > 0 && (
              <>
                <div className="t-h3">{t('bookConflicts.inConflict')}</div>
                <ul className="list est-bookconf-list" aria-label={t('bookConflicts.inConflict')}>
                  {songs.map((s) => (
                    <li key={s.path} className="row est-bookconf-row">
                      <span className="grow">
                        <span className="name">{s.title}</span>
                      </span>
                      <span className="badge conflict dot">{t('bookConflicts.conflictsCount', { count: s.count })}</span>
                      <Button className="btn quiet" aria-label={t('bookConflicts.settleSong', { title: s.title })} onPress={() => onSettle?.(s.path)}>
                        {t('bookConflicts.settle')}
                      </Button>
                      <Button className="btn quiet" aria-label={t('bookConflicts.keepBothSongFor', { title: s.title })} onPress={() => keepBothSong(s.path)}>
                        {t('bookConflicts.keepBothSong')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {deleted.map((d) => (
              <div key={d.path} className="card pad est-bookconf-deleted">
                <div className="est-bookconf-deleted-head">
                  <span className="t-h2 grow">{d.title}</span>
                  <span className="badge conflict dot">{t('bookConflicts.conflictBadge')}</span>
                </div>
                <p className="t-body">{t('bookConflicts.deletedBody', { author: d.author ?? t('songConflict.theirsFallback') })}</p>
                <div className="actions">
                  <Button className="btn primary" onPress={() => keepDeleted(d.path)}>{t('bookConflicts.keepSong')}</Button>
                  <Button className="btn" onPress={() => deleteDeleted(d.path)}>{t('bookConflicts.deleteSong')}</Button>
                </div>
              </div>
            ))}

            {incoming.length > 0 && (
              <>
                <div className="t-h3">{t('bookConflicts.cameIn')}</div>
                <ul className="list est-bookconf-incoming" aria-label={t('bookConflicts.cameIn')}>
                  {incoming.map((i) => (
                    <li key={i.path} className="row est-bookconf-row">
                      <span className="grow">
                        <span className="name">{i.title}</span>
                        <span className="meta">
                          {i.summary === 'added'
                            ? t('bookConflicts.addedBy', { author: i.author ?? t('songConflict.theirsFallback') })
                            : t('bookConflicts.changedBy', { author: i.author ?? t('songConflict.theirsFallback') })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="est-bookconf-side">
            <div className="card pad est-bookconf-saving">
              <span className="t-h3">{t('bookConflicts.savingTitle')}</span>
              <p className="t-body">{t('bookConflicts.savingBody', { count: pending })}</p>
              <p className="t-small">{t('bookConflicts.savingSafe')}</p>
            </div>
            <div className="card pad est-bookconf-notnow">
              <span className="t-h3">{t('bookConflicts.notNowTitle')}</span>
              <p className="t-small">{t('bookConflicts.notNowBody')}</p>
              <Button className="btn" onPress={abandon}>{t('bookConflicts.abandon')}</Button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

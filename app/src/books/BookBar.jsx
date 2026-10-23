// BookBar.jsx — the bar above a book's songs (books.row_opens_songs; workflow 7
// §A book's songs L58-95; the Open-a-book board). Search scoped to one book (or
// a folder in it) draws it between the box and the results: the book's title,
// the same meta line as its shelf row, its sync state in words when it is out of
// step, and **Manage**, which opens the book's detail. When the book waits on
// the person, a notice says so with the one act that settles it: a book that
// needs you — *{count} songs need you.* with **Settle** — and a fork whose
// original has new saves — *{original} has {count} new saves.* with **Bring
// them in**.
//
// It reads the local slices only (`shelf`, `sync`, `originals`, `index`,
// `songCounts`, `conflicts`) and sends nothing: a book that needs you is
// engaged by pressing it on the shelf (the shell's OPEN_CONFLICTS, workflow 9
// §Meeting one), and the engaged model counts its songs; never engaged on its
// own, so an abandoned merge stays abandoned. Nothing waits on the network
// (DIRECTION §1).
//
// Accessibility: React Aria Buttons named for the book (*Manage {book}*,
// *Settle conflicts in {book}*, *Bring them in from {original}*); every state is
// a word, never colour alone (mockups README L26).

import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { syncDisplayFor } from '../sync-display.js';
import { titleFor, orderedBooks, forkLineFor, bookMetaFor } from './book-display.js';
import { CreateIcon } from '../songs/song-rows.jsx';
import './book-bar.css';

// The sync-state badge, shown only when the engine's `sync` fact for the book is
// not *in step* — the absence of the badge is "in step with Estante" (workflow 8
// L28; mockup L48). The word (never colour alone, mockups README L26) and its
// class come from the one sync-word authority, `syncDisplayFor` (sync.states);
// this view never derives the word itself.
// A fork whose original is no longer shared carries a second badge, *original
// no longer shared* (books.fork; W11 board #4 :153) — a word, beside the sync
// word when there is one. Shared by the shelf row and the bar.
export function SyncBadge({ entry, originalGone = false }) {
  const atom = syncDisplayFor(entry, { t });
  if (!atom && !originalGone) return null;
  return (
    <span className="badges">
      {atom ? <span className={`badge ${atom.cls}`.trim()}>{atom.word}</span> : null}
      {originalGone ? <span className="badge">{t('books.originalNoLongerShared')}</span> : null}
    </span>
  );
}

/**
 * The bar for `bookId`. `onManage(bookId)` opens the book's detail;
 * `onSettle(bookId)` opens its conflicts; `onBringIn(bookId, { book, original })`
 * opens the bring-in preview for a fork.
 */
// `headingLevel` is 1 on a book's own page, where the title names the screen
// (books.book_page). `onNewSong`, when given, puts **New song** — the page's
// one primary act — first in the card's row of buttons, Manage beside it; a
// book the person cannot save to is given none.
export default function BookBar({ store, bookId, headingLevel = 2, onNewSong = null, onManage = () => {}, onSettle = () => {}, onBringIn = () => {} }) {
  const shelf = useSlice(store, 'shelf');
  const sync = useSlice(store, 'sync');
  const originals = useSlice(store, 'originals');
  const index = useSlice(store, 'index');
  const songCounts = useSlice(store, 'songCounts');
  const conflicts = useSlice(store, 'conflicts');
  const Heading = headingLevel === 1 ? 'h1' : 'h2';

  const entry = orderedBooks(shelf).find((e) => e.id === bookId);
  const book = entry?.book;
  const title = titleFor(book ?? {}, t('books.untitled'));
  const meta = bookMetaFor(entry?.kind ?? 'local', book, {
    count: songCounts?.[bookId],
    building: index?.[bookId] === 'building',
    t,
  });
  const fork = forkLineFor(book, originals?.[bookId], t('books.untitled'));
  const needsYou = sync?.[bookId]?.phase === 'needs_you';

  // The engaged merge's model counts the songs that wait on the person.
  const model = conflicts?.[bookId];
  const pending = model ? (model.songs?.length ?? 0) + (model.deleted?.length ?? 0) : null;

  return (
    <section className="card pad book-bar" aria-labelledby={`book-bar-${bookId}`}>
      <div className="book-bar-head">
        <span className="book-bar-text">
          <Heading className="t-h2" id={`book-bar-${bookId}`}>
            {title}
          </Heading>
          {fork ? <span className="t-small">{t('books.fromOriginal', { original: fork.from })}</span> : null}
          <span className="t-small">{meta}</span>
          <SyncBadge entry={sync?.[bookId]} originalGone={Boolean(fork?.gone)} />
        </span>
      </div>
      {needsYou ? (
        <div className="notice conflict book-bar-notice">
          <span role="status">
            {pending != null ? t('bookConflicts.needsYou', { count: pending }) : t('books.needsYou')}
          </span>
          <Button
            className="btn"
            aria-label={t('books.settleLabel', { book: title })}
            onPress={() => onSettle(bookId)}
          >
            {t('books.settle')}
          </Button>
        </div>
      ) : null}
      {fork?.newSaves ? (
        <div className="notice accent book-bar-notice">
          <span className="new-saves">
            {t('books.originalNewSaves', { original: fork.from, count: fork.newSaves })}
          </span>
          <Button
            className="btn primary"
            aria-label={t('books.bringInLabel', { original: fork.from })}
            onPress={() => onBringIn(bookId, { book: title, original: fork.from })}
          >
            {t('books.bringIn')}
          </Button>
        </div>
      ) : null}
      <div className="book-bar-actions">
        {onNewSong ? (
          <Button
            className="btn primary"
            aria-label={t('newSong.inThisBook', { book: title })}
            onPress={() => onNewSong(bookId)}
          >
            <CreateIcon />
            {t('books.pageNewSong')}
          </Button>
        ) : null}
        <Button className="btn" aria-label={t('books.manageLabel', { book: title })} onPress={() => onManage(bookId)}>
          {t('books.manage')}
        </Button>
      </div>
    </section>
  );
}

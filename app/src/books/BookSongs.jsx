// BookSongs.jsx — a book's page (books.book_page; workflow 7 §A book's page;
// the Open-a-book board): what pressing a book on the shelf opens, at its
// address `…/b/<book>`, on the Books destination. Its *Books* button goes back
// to where it was opened from; the bar names the book (BookBar: its meta, its state
// in words, *Manage*, and what waits on the person); **New song** starts a song
// in it; a field searches within it; and below, the book's songs, every one,
// as one flat list. An empty book says so and leaves New song as the way on.
//
// It reads the `browse`, `search`, `index`, `fill`, `shelf`, `conflicts` and
// `instruments` slices and sends BROWSE / SEARCH scoped to the book, as the
// search screen does for a scope (songs.search) — it never touches IndexedDB
// (DIRECTION §3.7). The typed text is lifted to the shell so it outlives a song
// opened from here.
//
// Accessibility: the book's title is the page's h1 (in the bar); every control
// is a React Aria Component with an accessible name (*Back to Books*, *New song
// in {book}*, *Search in {book}*); "still loading" and every badge are words.

import { useEffect, useMemo, useState } from 'react';
import { Button, Input, SearchField } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import { inUseEntry } from '../instruments/InstrumentChip.jsx';
import { chipLabel } from '../instruments/instrument-helpers.js';
import { bookLabelFor as resolveBookLabel } from '../songs/first-run.js';
import { canWriteTo, CreateIcon, keyOf, SearchIcon, SetlistRow, SongRow } from '../songs/song-rows.jsx';
import SaveSheet from '../songs/SaveSheet.jsx';
import BookBar from './BookBar.jsx';
import BringIn from './BringIn.jsx';
import { fillDisplayFor, saveTargetFor } from './book-display.js';
import '../songs/search.css';
import './book-songs.css';

// As the search screen: a SEARCH per burst of keystrokes, not per character.
const SEARCH_DEBOUNCE_MS = 120;

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default function BookSongs({
  store,
  bookId,
  query: controlledQuery,
  onQueryChange,
  // Null where something else is the way back (beside the book's detail).
  onBack = null,
  onOpenSong = () => {},
  onOpenSetlist = () => {},
  onWriteSong = () => {},
  onAddToSetlist = null,
  // The bar's acts: *Manage* opens the book's detail, *Settle* its conflicts; a
  // bring-in that meets the person's own edits hands the book to the conflicts
  // (workflow 11).
  onManage = () => {},
  onSettle = () => {},
  onNeedsYou = () => {},
}) {
  const browseSlice = useSlice(store, 'browse');
  const searchSlice = useSlice(store, 'search');
  const indexSlice = useSlice(store, 'index');
  const fillSlice = useSlice(store, 'fill');
  const shelf = useSlice(store, 'shelf');
  const conflicts = useSlice(store, 'conflicts');
  const instrumentsSlice = useSlice(store, 'instruments');
  const instrument = chipLabel(inUseEntry(instrumentsSlice)) || t('search.instrument');

  const [internalQuery, setInternalQuery] = useState('');
  const query = controlledQuery ?? internalQuery;
  const setQuery = onQueryChange ?? setInternalQuery;
  const typedQuery = query.trim();
  const typed = typedQuery.length > 0;
  // Save all over the book's changed songs (workflow 4 §Several songs at once),
  // and the fork's bring-in, which takes the page (books.bring_in Decision 3).
  const [saveAll, setSaveAll] = useState(null);
  const [bringIn, setBringIn] = useState(null);

  const scope = useMemo(() => ({ books: [bookId] }), [bookId]);

  // The book's songs, re-read as its index settles (the `index` slice moves).
  useEffect(() => {
    store.send(command(CommandKind.BROWSE, { scope }));
  }, [store, scope, indexSlice]);

  useEffect(() => {
    if (!typedQuery) return undefined;
    const id = setTimeout(() => {
      store.send(command(CommandKind.SEARCH, { query: typedQuery, scope }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [typedQuery, scope, store, indexSlice]);

  const bookLabel = resolveBookLabel(shelf, bookId, t('books.untitled'));
  const canWrite = canWriteTo(shelf, bookId);
  const fillEntry = fillSlice?.[bookId];
  const comingDown = fillEntry && fillEntry.state !== 'ready' ? fillDisplayFor(fillEntry, { t }) : null;
  const building = indexSlice?.[bookId] === 'building';

  // A song whose merge waits on the person reads *conflict* (workflow 9).
  const inConflict = (item) => {
    const model = conflicts?.[item.bookId];
    if (!model) return item;
    const hit = [...(model.songs ?? []), ...(model.deleted ?? [])].some((c) => c.path === item.path);
    return hit ? { ...item, conflict: true } : item;
  };
  const book = browseSlice.books.find((b) => b.bookId === bookId);
  const songs = (book?.songs ?? []).map((s) => inConflict({ ...s, bookId }));
  const unsavedPaths = comingDown ? [] : songs.filter((s) => s.unsaved).map((s) => s.path);
  const results = searchSlice.results.filter((r) => r.bookId === bookId).map(inConflict);

  if (bringIn) {
    return (
      <div className="book-songs">
        <BringIn
          store={store}
          bookId={bringIn.bookId}
          book={bringIn.book}
          original={bringIn.original}
          onClose={() => setBringIn(null)}
          onNeedsYou={(id) => {
            setBringIn(null);
            onNeedsYou(id);
          }}
        />
      </div>
    );
  }

  const songRow = (s) => (
    <SongRow
      key={keyOf(bookId, s.path)}
      item={s}
      bookLabel={null}
      instrument={instrument}
      onOpen={onOpenSong}
      onAddToSetlist={onAddToSetlist}
    />
  );

  let body;
  if (typed) {
    body = results.length ? (
      <section className="search-section" aria-labelledby="book-songs-matching">
        <div className="section-label">
          <h2 className="t-h3" id="book-songs-matching">
            {t('search.matching', { query: typedQuery })}
          </h2>
        </div>
        <div className="list">
          {results.map((r) =>
            r.kind === 'setlist' ? (
              <SetlistRow key={keyOf(r.bookId, r.path)} item={r} bookLabel={null} onOpen={onOpenSetlist} />
            ) : (
              songRow(r)
            ),
          )}
        </div>
      </section>
    ) : (
      // Nothing matched: say where it looked, and offer the song as a new one
      // in this book, the query its title (workflow 3 §Ways in).
      <section className="search-section search-no-match" aria-labelledby="book-songs-no-match">
        <div className="search-no-match-head">
          <h2 className="t-h2" id="book-songs-no-match">
            {t('search.noMatch')}
          </h2>
          <p className="t-small">{t('search.searchedIn', { books: bookLabel })}</p>
        </div>
        {canWrite && !comingDown ? (
          <div className="list">
            <Button className="row explore" onPress={() => onWriteSong({ title: typedQuery, bookId })}>
              <CreateIcon />
              <span className="grow">
                <span className="name">{t('newSong.create', { query: typedQuery })}</span>
                <span className="meta">{t('newSong.createMeta', { book: bookLabel })}</span>
              </span>
            </Button>
          </div>
        ) : null}
        <p className="visually-hidden" role="status">
          {t('search.empty', { query: typedQuery })}
        </p>
      </section>
    );
  } else if (comingDown || (building && !songs.length)) {
    // Nothing to list yet: the book is coming down, or its index is building.
    body = (
      <p className="t-small empty" role="status">
        {comingDown ? comingDown.word : t('books.pageLoading')}
      </p>
    );
  } else if (!songs.length) {
    body = (
      <p className="t-small empty" role="status">
        {canWrite ? t('books.pageEmpty') : t('books.pageEmptyReader')}
      </p>
    );
  } else {
    body = (
      <section className="search-section" aria-labelledby="book-songs-list">
        <h2 className="visually-hidden" id="book-songs-list">
          {t('books.pageSongs', { book: bookLabel })}
        </h2>
        <div className="list">{songs.map(songRow)}</div>
      </section>
    );
  }

  return (
    <div className="book-songs">
      {/* Back to where the book was opened from — the shelf, almost always —
          named by the word it shows (label in name, WCAG 2.5.3). */}
      {onBack ? (
        <Button className="btn quiet book-songs-back" aria-label={t('books.backToBooks')} onPress={onBack}>
          <BackIcon />
          {t('shell.books')}
        </Button>
      ) : null}

      <BookBar
        store={store}
        bookId={bookId}
        headingLevel={1}
        // New song in this book (workflow 3 §Ways in): only where the person
        // can save, and not while the book is still coming down (workflow 3
        // §Which book L28).
        onNewSong={canWrite && !comingDown ? () => onWriteSong({ bookId }) : null}
        onManage={onManage}
        onSettle={onSettle}
        onBringIn={(id, names) => setBringIn({ bookId: id, ...names })}
      />

      {unsavedPaths.length > 0 ? (
        <div className="book-unsaved">
          <span className="book-unsaved-count t-small">
            {t('search.unsavedCount', { count: unsavedPaths.length })}
          </span>
          <Button
            className="btn save-all"
            aria-label={t('saveSheet.saveAllLabel', { book: bookLabel })}
            onPress={() => setSaveAll({ bookId, paths: unsavedPaths, bookLabel })}
          >
            {t('saveSheet.saveAll')}
          </Button>
        </div>
      ) : null}

      <div className="search">
        <SearchIcon />
        <SearchField
          className="field"
          aria-label={t('books.pageSearchLabel', { book: bookLabel })}
          value={query}
          onChange={setQuery}
        >
          <Input placeholder={t('books.pageSearchPlaceholder')} />
          <Button className="field-x" aria-label={t('search.clearQuery')}>
            ✕
          </Button>
        </SearchField>
      </div>

      <div className="search-results book-songs-results">{body}</div>

      <SaveSheet
        store={store}
        isOpen={Boolean(saveAll)}
        onClose={() => setSaveAll(null)}
        bookId={saveAll?.bookId}
        paths={saveAll?.paths ?? []}
        titleHint={saveAll?.bookLabel ?? ''}
        bookLabel={saveAll?.bookLabel ?? ''}
        canSave={saveAll ? saveTargetFor(shelf, saveAll.bookId, t('books.untitled')).canSave : true}
      />
    </div>
  );
}

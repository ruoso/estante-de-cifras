// The search screen (songs.search) — the app's primary interface and the first
// thing it shows: "one box, across every book on the shelf" (workflow 2 L11,
// DIRECTION §4 L430). It fills the `search` destination panel (AppShell), reads
// the `search`, `index`, `browse`, `recents` and `preferences` slices through
// `useSlice`, and sends `SEARCH` / `BROWSE` / (via other tasks) `RECORD_RECENT`
// commands through `store.send` — it never touches IndexedDB and never parses a
// song itself (DIRECTION §3.7 L407-414, Decision 1). The Worker owns the data;
// this view is the only React layer over it.
//
// Before anything is typed it shows the device-local recents, then every book
// as a collapsible section (workflow 2 L13-16). As the user types, results
// narrow on every keystroke from the `search` slice; when the query parses as a
// chord in the user's notation an "Explore {chord}" row is offered first, in
// ADDITION to the song results (workflow 2 L26-40, Decision 4). A scope filter
// narrows the search to a book and shows as a chip inside the box; it is
// ephemeral view state, so it resets each session (workflow 2 L60-65, Decision
// 8). Every interactive part is a React Aria Component with a keyboard path and
// an accessible name; every badge and the "still loading" state carry a word,
// never colour alone (mockups README L26).

import { useEffect, useMemo, useState } from 'react';
import {
  Group,
  SearchField,
  Input,
  Button,
  Disclosure,
  DisclosurePanel,
  Heading,
} from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';
import {
  recognizeChord,
  scopePayload,
  INITIAL_SCOPE,
  songTitle,
  folderOf,
} from './search-query.js';
import './search.css';

// Results narrow "on every keystroke" (workflow 2 L22), but a SEARCH per
// keystroke would thrash the Worker; a short debounce coalesces a fast typist's
// bursts while still feeling immediate. The browse/recents the pre-typing state
// shows need no debounce — they are not re-queried per character.
const SEARCH_DEBOUNCE_MS = 120;

// The NUL join key for a location (bookId + path) — the same separator the
// index uses; it cannot occur in a book id or a path.
const keyOf = (bookId, path) => `${bookId}\u0000${path}`;

// The magnifier drawn in the box (W02 lines 35-37); decorative, named by the
// field's label.
function SearchIcon() {
  return (
    <svg
      className="icon"
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
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

// The accent-tinted grid drawn on the explore row (W02 lines 39-43); decorative.
function ExploreIcon() {
  return (
    <svg
      className="explore-icon"
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

// The funnel on a book's "search only here" button; decorative, named by the
// button's aria-label.
function FilterIcon() {
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
      <path d="M3 5h18l-7 8v6l-4-2v-4z" />
    </svg>
  );
}

// The badges a result carries, each labelled with a word (mockups README L26,
// acceptance 4). Order mirrors the mockup: voiced, then unsaved/conflict. Only
// the flags that apply render; `voicedFor`/`conflict` are the seam their owning
// tasks fill (Decision 7), so they simply stay absent until then.
function Badges({ item, instrument }) {
  const badges = [];
  if (item.voicedFor) {
    badges.push(
      <span key="voiced" className="badge voiced">
        {t('search.voicedFor', { instrument })}
      </span>,
    );
  }
  if (item.unsaved) {
    badges.push(
      <span key="unsaved" className="badge unsaved dot">
        {t('search.unsaved')}
      </span>,
    );
  }
  if (item.conflict) {
    badges.push(
      <span key="conflict" className="badge conflict dot">
        {t('search.conflict')}
      </span>,
    );
  }
  if (!badges.length) return null;
  return <span className="badges">{badges}</span>;
}

// One song row — a result, a recent, or a song inside a book section. Activating
// it (click or keyboard, via RAC Button) opens the song (workflow 2: "Opening a
// result shows the song to be read"); the reading view is `songs.reading`, so
// here it is the `onOpen` seam. Shows the title (or the file name for a titleless
// song), where it lives (book, and folder when not at the root), and badges.
function SongRow({ item, bookLabel, instrument, onOpen }) {
  const folder = folderOf(item.path);
  const where = folder
    ? t('search.where', { book: bookLabel, folder })
    : bookLabel;
  // The row says the title and artist, and where it lives: book, and folder
  // only when not at the root (workflow 2 L46-49). The artist leads the meta
  // line, then the location.
  const meta = [item.artist, where].filter(Boolean).join(' · ');
  return (
    <Button
      className="row"
      onPress={() => onOpen({ bookId: item.bookId, path: item.path })}
    >
      <span className="grow">
        <span className="name">{songTitle(item.title, item.path)}</span>
        <span className="meta">{meta}</span>
      </span>
      <Badges item={item} instrument={instrument} />
    </Button>
  );
}

// One book as a collapsible section (workflow 2 L15-16). The disclosure toggles
// by pointer and keyboard (RAC); its heading carries the book label and either
// the song count or, while the book's index is still building, a "still
// loading" line rather than looking empty (workflow 2 L159-162). A funnel button
// narrows the search to just this book (the scope — workflow 2 L62).
function BookSection({ bookId, book, building, bookLabel, instrument, onOpen, onScopeBook }) {
  const count = book?.count ?? 0;
  const songs = book?.songs ?? [];
  const meta = building
    ? t('search.stillLoading')
    : t('search.songCount', { count });
  return (
    <Disclosure className="book">
      {({ isExpanded }) => (
        <>
          <div className="book-head">
            <Heading className="book-heading">
              <Button slot="trigger" className="row book-trigger">
                <span className="caret t-small" aria-hidden="true">
                  {isExpanded ? '▾' : '▸'}
                </span>
                <span className="grow">
                  <span className="name">{bookLabel}</span>
                  <span className="meta">{meta}</span>
                </span>
              </Button>
            </Heading>
            <Button
              className="scope-btn"
              aria-label={t('search.scopeToBook', { book: bookLabel })}
              onPress={() => onScopeBook(bookId)}
            >
              <FilterIcon />
            </Button>
          </div>
          <DisclosurePanel className="book-panel">
            <div className="list">
              {songs.map((s) => (
                <SongRow
                  key={keyOf(bookId, s.path)}
                  item={{ ...s, bookId }}
                  bookLabel={bookLabel}
                  instrument={instrument}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  );
}

// The display label for a scope chip. A book is shown by the label the user
// gave it on their shelf (storage.shelf_surface, workflow 7 L14-21), resolved
// through `bookLabelFor` and falling back to the `bookId`; a folder scope reads
// `book/prefix`.
function scopeChipLabel(scope, bookLabelFor) {
  if (!scope) return '';
  if (Array.isArray(scope.books)) return scope.books.map(bookLabelFor).join(', ');
  if (scope.bookId) {
    const label = bookLabelFor(scope.bookId);
    return scope.prefix ? `${label}/${scope.prefix}` : label;
  }
  return '';
}

export default function SearchScreen({
  store,
  onOpenSong = () => {},
  onExploreChord = () => {},
}) {
  const searchSlice = useSlice(store, 'search');
  const indexSlice = useSlice(store, 'index');
  const browseSlice = useSlice(store, 'browse');
  const recentsSlice = useSlice(store, 'recents');
  const preferences = useSlice(store, 'preferences');
  const shelf = useSlice(store, 'shelf');

  // Chord recognition reads the user's notation dialect (Decision 4), falling
  // back to the app default when none is surfaced. The instrument-in-use label
  // (owned by the music tasks) fills `{instrument}` when present; until then the
  // copy reads the generic "on your instrument" (workflow 2 L28).
  const dialect = preferences?.notation?.value ?? DEFAULT_DIALECT;
  const instrument = preferences?.instrument?.value || t('search.instrument');

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState(INITIAL_SCOPE);

  const typedQuery = query.trim();
  const typed = typedQuery.length > 0;

  // SEARCH on each keystroke, debounced; the engine returns nothing for an empty
  // query, so the pre-typing browse is shown instead when the box is empty.
  useEffect(() => {
    if (!typedQuery) return undefined;
    const id = setTimeout(() => {
      store.send(
        command(CommandKind.SEARCH, {
          query: typedQuery,
          scope: scopePayload(scope),
        }),
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [typedQuery, scope, store]);

  // BROWSE for the pre-typing listing; re-sent as books finish indexing (the
  // `index` slice moves) and whenever the scope changes, so counts and songs
  // fill in and narrow.
  useEffect(() => {
    store.send(command(CommandKind.BROWSE, { scope: scopePayload(scope) }));
  }, [store, scope, indexSlice]);

  // Recents store only a location; join them to the browse data to show a title
  // and badges, falling back to the file name when the book is not yet browsed.
  const songByLocation = useMemo(() => {
    const map = new Map();
    for (const book of browseSlice.books) {
      for (const s of book.songs) {
        map.set(keyOf(book.bookId, s.path), { ...s, bookId: book.bookId });
      }
    }
    return map;
  }, [browseSlice]);

  const recentItems = recentsSlice.map(
    (r) =>
      songByLocation.get(keyOf(r.bookId, r.path)) ?? {
        bookId: r.bookId,
        path: r.path,
        title: '',
        artist: '',
        unsaved: false,
      },
  );

  // Every book to list: those with indexed songs (browse) plus any whose index
  // is still building (so it shows "still loading" rather than vanishing).
  const bookIds = useMemo(() => {
    const ids = new Set(browseSlice.books.map((b) => b.bookId));
    for (const id of Object.keys(indexSlice)) ids.add(id);
    return [...ids].sort();
  }, [browseSlice, indexSlice]);

  const bookById = useMemo(() => {
    const m = new Map();
    for (const b of browseSlice.books) m.set(b.bookId, b);
    return m;
  }, [browseSlice]);

  // A book's label is the name the user gave it on their shelf, surfaced from the
  // home book's shelf.json (storage.shelf_surface, resolving songs.search
  // Decision 6); fall back to the opaque `bookId` when no label register is
  // present or it is a cleared tombstone / empty (home-book-format §4.2, §5.3).
  const bookLabelFor = (bookId) => shelf?.books?.[bookId]?.label?.value || bookId;

  const recognized = typed ? recognizeChord(query, dialect) : null;
  const results = searchSlice.results;

  return (
    <div className="search-screen">
      <h1 className="t-h1">{t('shell.search')}</h1>

      <Group className="search" aria-label={t('search.label')}>
        <SearchIcon />
        {scope && (
          <span className="scope">
            <span>{scopeChipLabel(scope, bookLabelFor)}</span>
            <Button
              className="scope-x"
              aria-label={t('search.clearFilter')}
              onPress={() => setScope(INITIAL_SCOPE)}
            >
              ✕
            </Button>
          </span>
        )}
        <SearchField
          className="field"
          aria-label={t('search.label')}
          value={query}
          onChange={setQuery}
        >
          <Input placeholder={t('search.placeholder')} />
          <Button className="field-x" aria-label={t('search.clearQuery')}>
            ✕
          </Button>
        </SearchField>
      </Group>

      {typed ? (
        <>
          {recognized && (
            <div className="list">
              <Button
                className="row explore"
                onPress={() => onExploreChord(recognized.chord)}
              >
                <ExploreIcon />
                <span className="grow">
                  <span className="name">
                    {t('search.explore', { query: typedQuery, instrument })}
                  </span>
                  <span className="meta">{t('search.exploreMeta')}</span>
                </span>
              </Button>
            </div>
          )}
          <section className="search-section" aria-labelledby="search-matching">
            <div className="section-label">
              <h2 className="t-h3" id="search-matching">
                {t('search.matching', { query: typedQuery })}
              </h2>
            </div>
            {results.length ? (
              <div className="list">
                {results.map((r) => (
                  <SongRow
                    key={keyOf(r.bookId, r.path)}
                    item={r}
                    bookLabel={bookLabelFor(r.bookId)}
                    instrument={instrument}
                    onOpen={onOpenSong}
                  />
                ))}
              </div>
            ) : (
              <p className="t-small empty" role="status">
                {t('search.empty', { query: typedQuery })}
              </p>
            )}
          </section>
        </>
      ) : (
        <>
          {recentItems.length > 0 && (
            <section className="search-section" aria-labelledby="search-recent">
              <div className="section-label">
                <h2 className="t-h3" id="search-recent">
                  {t('search.recent')}
                </h2>
              </div>
              <div className="list">
                {recentItems.map((item, i) => (
                  <SongRow
                    key={`recent-${keyOf(item.bookId, item.path)}-${i}`}
                    item={item}
                    bookLabel={bookLabelFor(item.bookId)}
                    instrument={instrument}
                    onOpen={onOpenSong}
                  />
                ))}
              </div>
            </section>
          )}
          {bookIds.length > 0 && (
            <section className="search-section" aria-labelledby="search-books">
              <div className="section-label">
                <h2 className="t-h3" id="search-books">
                  {t('search.books')}
                </h2>
              </div>
              <div className="search-books">
                {bookIds.map((id) => (
                  <BookSection
                    key={id}
                    bookId={id}
                    book={bookById.get(id)}
                    building={indexSlice[id] === 'building'}
                    bookLabel={bookLabelFor(id)}
                    instrument={instrument}
                    onOpen={onOpenSong}
                    onScopeBook={(bookId) => setScope({ books: [bookId] })}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

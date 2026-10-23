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
// 8). A scope is a filter only: a book's own page — its bar, *Manage*, what
// waits on the person — is BookSongs, on the Books destination
// (books.book_page; workflow 7 §A book's page). Every interactive part is a React Aria Component with a
// keyboard path and an accessible name; every badge and the "still loading"
// state carry a word, never colour alone (mockups README L26).

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
import { t, currentLocale } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';
import { fillDisplayFor, orderedBooks, saveTargetFor } from '../books/book-display.js';
import {
  recognizeChord,
  scopePayload,
  INITIAL_SCOPE,
  inScope,
  moveBookEntry,
} from './search-query.js';
import FirstRun from './FirstRun.jsx';
import { keyOf, SearchIcon, canWriteTo, CreateIcon, SongRow, SetlistRow } from './song-rows.jsx';
import { bookOfScope } from '../shell/place.js';
import SaveSheet from './SaveSheet.jsx';
import { showsFirstRun, bookLabelFor as resolveBookLabel } from './first-run.js';
import { inUseEntry } from '../instruments/InstrumentChip.jsx';
import { chipLabel } from '../instruments/instrument-helpers.js';
import './search.css';

// Results narrow "on every keystroke" (workflow 2 L22), but a SEARCH per
// keystroke would thrash the Worker; a short debounce coalesces a fast typist's
// bursts while still feeling immediate. The browse/recents the pre-typing state
// shows need no debounce — they are not re-queried per character.
const SEARCH_DEBOUNCE_MS = 120;

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

// One book as a collapsible section (workflow 2 L15-16). The disclosure toggles
// by pointer and keyboard (RAC); its heading carries the book label and either
// the song count or, while the book's index is still building, a "still
// loading" line rather than looking empty (workflow 2 L159-162). A book still
// coming down onto this device reads the shelf's fill word (*waiting*, *cloning
// 40%*), never *0 songs*, and offers no New song or Save all — nothing is there
// to write into yet (books.setlists_resilient Constraint 7). A funnel button
// narrows the search to just this book (the scope — workflow 2 L62).
function BookSection({
  bookId,
  book,
  building,
  // The book's fill display (`fillDisplayFor`) while it is still coming down,
  // else null.
  comingDown = null,
  bookLabel,
  instrument,
  onOpen,
  onScopeBook,
  onWriteSong,
  onSaveAll,
  canWrite,
  onAddToSetlist,
  markConflict = (item) => item,
  // Whether the section is open, and its setter: the screen holds the open
  // state for the session (songs.search_scope_follows Constraint 5; workflow 2
  // §The search screen), so a tab switch or a song opened over Search finds it
  // as it was left.
  isExpanded: expanded = false,
  onExpandedChange = () => {},
}) {
  const count = book?.count ?? 0;
  const songs = book?.songs ?? [];
  // Save all is offered in a book's section for a book the user can push to when
  // songs in it have unsaved changes (workflow 4 §Several songs at once).
  const unsavedPaths = comingDown ? [] : songs.filter((s) => s.unsaved).map((s) => s.path);
  const meta = comingDown
    ? comingDown.word
    : building
      ? t('search.stillLoading')
      : t('search.songCount', { count });
  return (
    <Disclosure className="book" isExpanded={expanded} onExpandedChange={onExpandedChange}>
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
            {/* New song in this book (workflow 3 §Ways in L13): only for a book
                the user can push to (`canSaveFor`); a book they cannot save to
                is not offered one (workflow 3 §Which book L28). */}
            {canWrite && !comingDown && (
              <Button
                className="scope-btn"
                aria-label={t('newSong.inThisBook', { book: bookLabel })}
                onPress={() => onWriteSong({ bookId })}
              >
                <CreateIcon />
              </Button>
            )}
            <Button
              className="scope-btn"
              aria-label={t('search.scopeToBook', { book: bookLabel })}
              onPress={() => onScopeBook(bookId)}
            >
              <FilterIcon />
            </Button>
          </div>
          {/* Save all the book's changed songs in one commit (workflow 4
              §Several songs at once), only when something is unsaved. A line of
              its own under the header, saying what it saves, outside what opens
              and closes so it shows with the section closed too (workflow 2 §A
              book's section header; songs.search_book_head_narrow). In a book
              the user cannot push to it opens the make-it-your-own offer
              instead (workflow 4 §A book the user cannot push to; books.fork
              Constraint 7). */}
          {unsavedPaths.length > 0 && (
            <div className="book-unsaved">
              <span className="book-unsaved-count t-small">
                {t('search.unsavedCount', { count: unsavedPaths.length })}
              </span>
              <Button
                className="btn save-all"
                aria-label={t('saveSheet.saveAllLabel', { book: bookLabel })}
                onPress={() => onSaveAll({ bookId, paths: unsavedPaths, bookLabel })}
              >
                {t('saveSheet.saveAll')}
              </Button>
            </div>
          )}
          <DisclosurePanel className="book-panel">
            <div className="list">
              {songs.map((s) => (
                <SongRow
                  key={keyOf(bookId, s.path)}
                  item={markConflict({ ...s, bookId })}
                  bookLabel={bookLabel}
                  instrument={instrument}
                  onOpen={onOpen}
                  onAddToSetlist={onAddToSetlist}
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
// through `bookLabelFor` and falling back to *Untitled book*, never the id
// (songs.no_raw_ids); a folder scope reads
// `book/prefix`.
// The books a search looked in, as the locale lists them (*A, B and C*) — the
// no-match state's *Searched … in {books}.* (W03#1 L41): the scope's books, or
// every book on the shelf in its order — My songs alone on an empty shelf, where
// it is listed from the start (workflow 1 §My songs). Falls back to commas where
// Intl.ListFormat is missing.
function searchedBooks(scope, shelf, bookIds, bookLabelFor) {
  let ids;
  if (Array.isArray(scope?.books)) ids = scope.books;
  else if (scope?.bookId) ids = [scope.bookId];
  else {
    ids = orderedBooks(shelf).map((b) => b.id);
    if (!ids.length) ids = bookIds;
  }
  const names = ids.length ? ids.map(bookLabelFor) : [t('firstRun.mySongs')];
  try {
    return new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(names);
  } catch {
    return names.join(', ');
  }
}

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
  onOpenSetlist = () => {},
  onExploreChord = () => {},
  onWriteSong = () => {},
  onAddBook = () => {},
  onSignIn = () => {},
  // Whether the cold first run offers its sign-in row (offersFirstRunSignIn).
  offerSignIn = true,
  onAddToSetlist = null,
  query: controlledQuery,
  onQueryChange,
  scope: controlledScope,
  onScopeChange,
  // Which book sections are open (`Map<bookId, boolean>`) and its setter (a
  // value or an updater): the shell lifts it so it lasts the session across a
  // tab switch and a full-screen host (songs.search_scope_follows Constraint
  // 5). Uncontrolled, it is local state, as the scope is.
  expandedBooks: controlledExpanded,
  onExpandedBooksChange,
}) {
  const searchSlice = useSlice(store, 'search');
  const indexSlice = useSlice(store, 'index');
  const fillSlice = useSlice(store, 'fill');
  const browseSlice = useSlice(store, 'browse');
  const recentsSlice = useSlice(store, 'recents');
  const preferences = useSlice(store, 'preferences');
  const shelf = useSlice(store, 'shelf');
  const conflicts = useSlice(store, 'conflicts');

  // Chord recognition reads the user's notation dialect (Decision 4), falling
  // back to the app default when none is surfaced. The instrument in use fills
  // `{instrument}` with the chip's one short label (shell.header_chrome; workflow
  // 2 L28), the generic "on your instrument" only while no slice has arrived.
  const dialect = preferences?.notation?.value ?? DEFAULT_DIALECT;
  const instrumentsSlice = useSlice(store, 'instruments');
  const instrument = chipLabel(inUseEntry(instrumentsSlice)) || t('search.instrument');

  // The query is controllable: the chord explorer lifts it so the search box and
  // the explorer's chord input hold the one symbol, and *back* returns to search
  // with it still typed (music.explorer; workflow 16 L26-27). Uncontrolled (the
  // standalone shell mount and the component tests) falls back to local state.
  const [internalQuery, setInternalQuery] = useState('');
  const query = controlledQuery ?? internalQuery;
  const setQuery = onQueryChange ?? setInternalQuery;
  // The scope is controllable too: the shell lifts it so a book's address
  // (`/b/<book>`) can set it and back can return to it (shell.routing Decision
  // 1). Uncontrolled, it is local state reset on every mount (Decision 8). The
  // setter takes a value or an updater, either way.
  const [internalScope, setInternalScope] = useState(INITIAL_SCOPE);
  const scope = controlledScope === undefined ? internalScope : controlledScope;
  const setScope = onScopeChange ?? setInternalScope;
  const [internalExpanded, setInternalExpanded] = useState(() => new Map());
  const expandedBooks = controlledExpanded ?? internalExpanded;
  const setExpandedBooks = onExpandedBooksChange ?? setInternalExpanded;
  // Save all opens the one save sheet over a book's changed songs (workflow 4
  // §Several songs at once). Ephemeral view state: `{ bookId, paths, bookLabel }`.
  const [saveAll, setSaveAll] = useState(null);
  // A book became its fork (books.fork): the scope and an open save-all follow
  // the new id, so the save lands in the fork and the search stays narrowed to
  // the same book.
  useWorkerEvent(store, EventKind.BOOK_FORKED, ({ previousBookId, bookId: forkId }) => {
    setSaveAll((prev) => (prev && prev.bookId === previousBookId ? { ...prev, bookId: forkId } : prev));
    setExpandedBooks((prev) => moveBookEntry(prev, previousBookId, forkId));
    setScope((prev) => {
      if (!prev) return prev;
      if (Array.isArray(prev.books) && prev.books.includes(previousBookId)) {
        return { ...prev, books: prev.books.map((id) => (id === previousBookId ? forkId : id)) };
      }
      if (prev.bookId === previousBookId) return { ...prev, bookId: forkId };
      return prev;
    });
  });

  const typedQuery = query.trim();
  const typed = typedQuery.length > 0;

  // SEARCH on each keystroke, debounced; the engine returns nothing for an empty
  // query, so the pre-typing browse is shown instead when the box is empty.
  // Re-sent as books finish indexing (the `index` slice moves), like BROWSE
  // below: a query typed while a book is still building would otherwise sit on
  // an empty result and never refresh when the book becomes searchable (the
  // reading e2e opens a song straight after a reload, before its index settles).
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
  }, [typedQuery, scope, store, indexSlice]);

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

  // A scoped search is that book's songs (workflow 2 §Scope): a recent from a
  // book the scope does not hold is not listed (songs.search_scope_follows
  // Decision 6). `allRecents` keeps the cold-door test on the whole shelf.
  const allRecents = recentsSlice;
  const recentItems = recentsSlice.filter((r) => inScope(scope, r.bookId, r.path)).map(
    (r) =>
      songByLocation.get(keyOf(r.bookId, r.path)) ?? {
        bookId: r.bookId,
        path: r.path,
        title: '',
        artist: '',
        unsaved: false,
      },
  );

  // Every book to list: those with indexed songs (browse), any whose index is
  // still building (so it shows "still loading" rather than vanishing), and any
  // still coming down onto this device (so it reads its fill word, not *0
  // songs* — books.setlists_resilient Constraint 7; workflow 2 L177-179).
  const comingDownOf = (id) => {
    const entry = fillSlice?.[id];
    return entry && entry.state !== 'ready' ? fillDisplayFor(entry, { t }) : null;
  };
  // With a scope set, only the books it holds get a section — no section, and
  // so no *0 songs*, for a book whose songs the scope hides (workflow 2 §Scope;
  // songs.search_scope_follows Constraint 3-4). A book in scope still reads
  // *still loading* or its fill word while it builds or comes down.
  const allBookIds = useMemo(() => {
    const ids = new Set(browseSlice.books.map((b) => b.bookId));
    for (const id of Object.keys(indexSlice)) ids.add(id);
    for (const [id, entry] of Object.entries(fillSlice ?? {})) {
      if (entry?.state !== 'ready') ids.add(id);
    }
    return [...ids].sort();
  }, [browseSlice, indexSlice, fillSlice]);
  const bookIds = useMemo(
    () => allBookIds.filter((id) => inScope(scope, id)),
    [allBookIds, scope],
  );

  const bookById = useMemo(() => {
    const m = new Map();
    for (const b of browseSlice.books) m.set(b.bookId, b);
    return m;
  }, [browseSlice]);

  // A book's label is the name the user gave it on their shelf, surfaced from the
  // home book's shelf.json (storage.shelf_surface, resolving songs.search
  // Decision 6): a local book's `title`, then a shared book's `label`, then
  // *Untitled book* when neither is present or it is a cleared tombstone / blank
  // — never the opaque `bookId` (songs.no_raw_ids Constraint 1; home-book-format
  // §4.2, §5.3).
  const bookLabelFor = (bookId) => resolveBookLabel(shelf, bookId, t('books.untitled'));

  const recognized = typed ? recognizeChord(query, dialect) : null;
  // A song whose merge waits on the person reads *conflict* (workflow 9
  // §Meeting one): the engaged book's model names its paths.
  const inConflict = (item) => {
    const model = conflicts?.[item.bookId];
    if (!model) return item;
    const hit = [...(model.songs ?? []), ...(model.deleted ?? [])].some((c) => c.path === item.path);
    return hit ? { ...item, conflict: true } : item;
  };
  const results = searchSlice.results.map(inConflict);

  return (
    <div className="search-screen">
      {/* The page heading stays for the outline and screen readers, visually
          hidden: the header's wordmark row is what the boards draw here
          (shell.header_chrome Decision 6). */}
      <h1 className="t-h1 visually-hidden">{t('shell.search')}</h1>

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


      {/* The results scroll under the heading and the search pill, which stay
          in view (shell.full_height). */}
      <div className="search-results">
        {typed ? (
          <>
            {recognized && (
              <div className="list">
                <Button
                  className="row explore"
                  onPress={() => onExploreChord(recognized.chord, typedQuery)}
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
            {results.length ? (
              <section className="search-section" aria-labelledby="search-matching">
                <div className="section-label">
                  <h2 className="t-h3" id="search-matching">
                    {t('search.matching', { query: typedQuery })}
                  </h2>
                </div>
                <div className="list">
                  {results.map((r) =>
                    r.kind === 'setlist' ? (
                      <SetlistRow
                        key={keyOf(r.bookId, r.path)}
                        item={r}
                        bookLabel={bookLabelFor(r.bookId)}
                        onOpen={onOpenSetlist}
                      />
                    ) : (
                      <SongRow
                        key={keyOf(r.bookId, r.path)}
                        item={r}
                        bookLabel={bookLabelFor(r.bookId)}
                        instrument={instrument}
                        onOpen={onOpenSong}
                        onAddToSetlist={onAddToSetlist}
                      />
                    ),
                  )}
                </div>
              </section>
            ) : (
              // Nothing matched (W03#1 L39-46): what was searched where, the
              // Create row, and pasting as a way in of its own (workflow 3
              // §Ways in L15-17). The status line announces it; the heading
              // says it to the eye.
              <section className="search-section search-no-match" aria-labelledby="search-no-match">
                <div className="search-no-match-head">
                  <h2 className="t-h2" id="search-no-match">
                    {t('search.noMatch')}
                  </h2>
                  <p className="t-small">
                    {t('search.searchedIn', { books: searchedBooks(scope, shelf, bookIds, bookLabelFor) })}
                  </p>
                </div>
                {/* Nothing matched, so create it — the query becomes the title,
                    the song goes into My songs (workflow 3 §Ways in L10-11; W03
                    Create row, "A new song in My songs"). A primary row, like
                    the explore row above it. */}
                <div className="list">
                  <Button
                    className="row explore"
                    onPress={() => onWriteSong({ title: typedQuery })}
                  >
                    <CreateIcon />
                    <span className="grow">
                      <span className="name">
                        {t('newSong.create', { query: typedQuery })}
                      </span>
                      <span className="meta">
                        {t('newSong.createMeta', { book: t('firstRun.mySongs') })}
                      </span>
                    </span>
                  </Button>
                </div>
                <p className="t-small empty">{t('search.pasteHint')}</p>
                <p className="visually-hidden" role="status">
                  {t('search.empty', { query: typedQuery })}
                </p>
              </section>
            )}
          </>
        ) : showsFirstRun(allBookIds, allRecents) ? (
          // The cold door: an empty shelf and no recents (account.first_run,
          // workflow 1 §Cold). "Open the example book" seeds the bundled book in
          // the Worker; the other three route to the doors their own tasks own
          // (Decision 1, acceptance 2-3).
          <FirstRun
            onWriteSong={onWriteSong}
            onAddBook={onAddBook}
            onSignIn={onSignIn}
            offerSignIn={offerSignIn}
            onOpenExampleBook={() =>
              store.send(
                command(CommandKind.OPEN_EXAMPLE_BOOK, {
                  title: t('firstRun.exampleLabel'),
                }),
              )
            }
          />
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
                      item={inConflict(item)}
                      bookLabel={bookLabelFor(item.bookId)}
                      instrument={instrument}
                      onOpen={onOpenSong}
                      onAddToSetlist={onAddToSetlist}
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
                      comingDown={comingDownOf(id)}
                      bookLabel={bookLabelFor(id)}
                      instrument={instrument}
                      onOpen={onOpenSong}
                      onScopeBook={(bookId) => setScope({ books: [bookId] })}
                      onWriteSong={onWriteSong}
                      onSaveAll={setSaveAll}
                      canWrite={canWriteTo(shelf, id)}
                      onAddToSetlist={onAddToSetlist}
                      markConflict={inConflict}
                      // A book with no entry opens iff the scope is that one
                      // book; an entry is how it was left.
                      isExpanded={expandedBooks.has(id) ? expandedBooks.get(id) : id === bookOfScope(scope)}
                      onExpandedChange={(open) =>
                        setExpandedBooks((prev) => new Map(prev).set(id, open))
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* The one save sheet for *save all* (workflow 4 §Several songs at once):
          one commit over every changed song in the book. */}
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

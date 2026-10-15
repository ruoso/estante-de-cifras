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
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';
import { canSaveFor, saveTargetFor } from '../books/book-display.js';
import {
  recognizeChord,
  scopePayload,
  INITIAL_SCOPE,
  songTitle,
  folderOf,
} from './search-query.js';
import FirstRun from './FirstRun.jsx';
import SaveSheet from './SaveSheet.jsx';
import { showsFirstRun, bookLabelFor as resolveBookLabel } from './first-run.js';
import './search.css';

// A local book's offline commits carry a device-local identity until an account
// arrives (DIRECTION §3.2; mirrors BooksScreen's `LOCAL_IDENTITY` — account.sign_in
// replaces it on the unpushed saves). The view supplies it, and the localised
// label, with OPEN_EXAMPLE_BOOK, exactly as the Add-a-book flow supplies them
// with CREATE_BOOK.
const LOCAL_IDENTITY = { id: 'local', name: 'Me' };

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

// Whether a new song may be started into a book from its section (workflow 3
// §Which book L28): a shared book only when the user can push to it
// (`canSaveFor` the editor role), a local book (in `shelf.local`, including *My
// songs*) always. A book with no shelf entry is treated as local/on-device.
function canWriteTo(shelf, bookId) {
  const shared = shelf?.books?.[bookId];
  if (shared) return canSaveFor('shared', shared) === true;
  return true;
}

// The plus on a "create / new song" affordance (W03 Create row, "new song in
// this book"); decorative, named by its row name or the button's aria-label.
function CreateIcon() {
  return (
    <svg
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
      style={{ color: 'var(--accent)', flex: 'none' }}
    >
      <path d="M12 5v14M5 12h14" />
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
function SongRow({ item, bookLabel, instrument, onOpen, onAddToSetlist }) {
  const folder = folderOf(item.path);
  const where = folder
    ? t('search.where', { book: bookLabel, folder })
    : bookLabel;
  // The row says the title and artist, and where it lives: book, and folder
  // only when not at the root (workflow 2 L46-49). The artist leads the meta
  // line, then the location.
  const meta = [item.artist, where].filter(Boolean).join(' · ');
  const title = songTitle(item.title, item.path);
  // Add-to-setlist is on every song (workflow 12 §Building one): a trailing icon
  // button beside the open action. A button cannot nest inside a RAC Button, so
  // the row is a flex container with the open Button and this one as siblings
  // (the BookSection header precedent).
  return (
    <div className="row search-row">
      <Button
        className="search-row-open"
        onPress={() => onOpen({ bookId: item.bookId, path: item.path })}
      >
        <span className="grow">
          <span className="name">{title}</span>
          <span className="meta">{meta}</span>
        </span>
        <Badges item={item} instrument={instrument} />
      </Button>
      {onAddToSetlist ? (
        <Button
          className="btn icon search-add-setlist"
          aria-label={t('search.addToSetlist', { title })}
          onPress={() =>
            onAddToSetlist({ bookId: item.bookId, path: item.path, title: item.title || null })
          }
        >
          <AddToSetlistIcon />
        </Button>
      ) : null}
    </div>
  );
}

// One setlist row in the typed-query results (books.setlist_search, workflow 12
// §The file L34: "Setlists are found by the same search as songs, marked as
// setlists. Opening one lists its songs."). A setlist is MARKED by the word
// "Setlist" (mockups README L26 — status by a word, never colour alone), shows
// its title and where it lives (book, and folder when not at the root — never
// the file name, DIRECTION §4 L470), and is NOT offered Add-to-setlist (that is
// for songs). The badge sits inside the open Button, so the button's accessible
// name carries the title AND that it is a setlist (acceptance 2). Activating it
// routes to the existing setlist view through `onOpenSetlist` (Decision 5).
function SetlistRow({ item, bookLabel, onOpen }) {
  const folder = folderOf(item.path);
  const where = folder
    ? t('search.where', { book: bookLabel, folder })
    : bookLabel;
  const title = songTitle(item.title, item.path);
  return (
    <div className="row search-row">
      <Button
        className="search-row-open"
        onPress={() => onOpen({ bookId: item.bookId, path: item.path })}
      >
        <span className="grow">
          <span className="name">{title}</span>
          <span className="meta">{where}</span>
        </span>
        <span className="badges">
          <span className="badge setlist">{t('search.setlist')}</span>
        </span>
      </Button>
    </div>
  );
}

// The Add-to-setlist glyph on a song row — a list with a plus.
function AddToSetlistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h10M4 12h10M4 18h7M17 15v6M14 18h6" />
    </svg>
  );
}

// One book as a collapsible section (workflow 2 L15-16). The disclosure toggles
// by pointer and keyboard (RAC); its heading carries the book label and either
// the song count or, while the book's index is still building, a "still
// loading" line rather than looking empty (workflow 2 L159-162). A funnel button
// narrows the search to just this book (the scope — workflow 2 L62).
function BookSection({
  bookId,
  book,
  building,
  bookLabel,
  instrument,
  onOpen,
  onScopeBook,
  onWriteSong,
  onSaveAll,
  canWrite,
  onAddToSetlist,
}) {
  const count = book?.count ?? 0;
  const songs = book?.songs ?? [];
  // Save all is offered in a book's section for a book the user can push to when
  // songs in it have unsaved changes (workflow 4 §Several songs at once).
  const unsavedPaths = songs.filter((s) => s.unsaved).map((s) => s.path);
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
            {/* New song in this book (workflow 3 §Ways in L13): only for a book
                the user can push to (`canSaveFor`); a book they cannot save to
                is not offered one (workflow 3 §Which book L28). */}
            {canWrite && (
              <Button
                className="scope-btn"
                aria-label={t('newSong.inThisBook', { book: bookLabel })}
                onPress={() => onWriteSong({ bookId })}
              >
                <CreateIcon />
              </Button>
            )}
            {/* Save all the book's changed songs in one commit (workflow 4
                §Several songs at once), only when something is unsaved. In a
                book the user cannot push to it opens the make-it-your-own
                offer instead (workflow 4 §A book the user cannot push to;
                books.fork Constraint 7). */}
            {unsavedPaths.length > 0 && (
              <Button
                className="btn save-all"
                aria-label={t('saveSheet.saveAllLabel', { book: bookLabel })}
                onPress={() => onSaveAll({ bookId, paths: unsavedPaths, bookLabel })}
              >
                {t('saveSheet.saveAll')}
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
          <DisclosurePanel className="book-panel">
            <div className="list">
              {songs.map((s) => (
                <SongRow
                  key={keyOf(bookId, s.path)}
                  item={{ ...s, bookId }}
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
  onOpenSetlist = () => {},
  onExploreChord = () => {},
  onWriteSong = () => {},
  onAddBook = () => {},
  onSignIn = () => {},
  onAddToSetlist = null,
  query: controlledQuery,
  onQueryChange,
  scope: controlledScope,
  onScopeChange,
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
  // Save all opens the one save sheet over a book's changed songs (workflow 4
  // §Several songs at once). Ephemeral view state: `{ bookId, paths, bookLabel }`.
  const [saveAll, setSaveAll] = useState(null);
  // A book became its fork (books.fork): the scope and an open save-all follow
  // the new id, so the save lands in the fork and the search stays narrowed to
  // the same book.
  useWorkerEvent(store, EventKind.BOOK_FORKED, ({ previousBookId, bookId: forkId }) => {
    setSaveAll((prev) => (prev && prev.bookId === previousBookId ? { ...prev, bookId: forkId } : prev));
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
  // Decision 6): a local book's `title`, then a shared book's `label`, then the
  // opaque `bookId` when neither is present or it is a cleared tombstone / empty
  // (account.first_run Decision 5; home-book-format §4.2, §5.3).
  const bookLabelFor = (bookId) => resolveBookLabel(shelf, bookId);

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
            <section className="search-section" aria-labelledby="search-matching">
              <div className="section-label">
                <h2 className="t-h3" id="search-matching">
                  {t('search.matching', { query: typedQuery })}
                </h2>
              </div>
              {results.length ? (
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
              ) : (
                <>
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
                  <p className="t-small empty" role="status">
                    {t('search.empty', { query: typedQuery })}
                  </p>
                </>
              )}
            </section>
          </>
        ) : showsFirstRun(bookIds, recentItems) ? (
          // The cold door: an empty shelf and no recents (account.first_run,
          // workflow 1 §Cold). "Open the example book" seeds the bundled book in
          // the Worker; the other three route to the doors their own tasks own
          // (Decision 1, acceptance 2-3).
          <FirstRun
            onWriteSong={onWriteSong}
            onAddBook={onAddBook}
            onSignIn={onSignIn}
            onOpenExampleBook={() =>
              store.send(
                command(CommandKind.OPEN_EXAMPLE_BOOK, {
                  title: t('firstRun.exampleLabel'),
                  author: LOCAL_IDENTITY,
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
                      item={item}
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
                      bookLabel={bookLabelFor(id)}
                      instrument={instrument}
                      onOpen={onOpenSong}
                      onScopeBook={(bookId) => setScope({ books: [bookId] })}
                      onWriteSong={onWriteSong}
                      onSaveAll={setSaveAll}
                      canWrite={canWriteTo(shelf, id)}
                      onAddToSetlist={onAddToSetlist}
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
        canSave={saveAll ? saveTargetFor(shelf, saveAll.bookId).canSave : true}
      />
    </div>
  );
}

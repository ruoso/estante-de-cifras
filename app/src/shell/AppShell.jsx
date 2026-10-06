// The responsive navigation shell (shell.layout): the frame every later screen
// lives in. It renders inside ThemeRoot's `.est` root and chooses one of two
// layouts by viewport — a bottom tab bar on the phone, a sidebar + detail
// `.split` on tablet and computer — flipping live as the viewport crosses the
// breakpoint.
//
// The destination switcher is one controlled React Aria Components `Tabs`
// instance (Decision): its `TabList` is the bottom `.tabbar` on the phone and
// the sidebar rail on tablet/computer, its `TabPanel`s are the destination
// regions. RAC gives the roving-tabindex keyboard path, arrow / Home / End
// movement, `aria-selected` state and the accessible tab/tabpanel roles — "React
// Aria for every interactive part" without hand-rolled ARIA. The selected
// destination is view state (`useState`), not Worker data: navigation location
// is ephemeral and the main thread touches no IndexedDB for it (DIRECTION §3.7
// lines 407-414). Holding it here also keeps the destination stable across a
// narrow⇄wide layout flip.
//
// The destinations ship as labelled slots with a heading and nothing more;
// songs.search, books.shelf and books.setlists (which already depend on this
// task) fill them. The shell is usable with no account and no book (Workflow 1).

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Tabs, TabList, Tab, TabPanel } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { getAppStore } from '../worker/store.js';
import { useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import SearchScreen from '../songs/SearchScreen.jsx';
import NewSongHost from '../songs/NewSongHost.jsx';
import BooksScreen from '../books/BooksScreen.jsx';
import FileView from '../files/FileView.jsx';
import ChordExplorer from '../music/ChordExplorer.jsx';
import InstrumentChip from '../instruments/InstrumentChip.jsx';
import InstrumentsOverlay from '../instruments/InstrumentsOverlay.jsx';
import { DESTINATIONS, WIDE_QUERY, layoutMode } from './layout-mode.js';
import './shell.css';

// The device-local commit identity before sign-in (SearchScreen/BooksScreen use
// the same literal; `authorFrom` in the Worker turns the id into the no-reply
// address). An account id replaces it once signed in — not an M2 concern.
const LOCAL_IDENTITY = { id: 'local', name: 'Me' };

// The wide media query, or null where `matchMedia` is absent (jsdom provides
// none — the behavior test stubs it). A missing query reads as not-wide, so the
// default layout is the phone tab bar. Mirrors ThemeRoot's `usePrefersDark`.
function wideQuery() {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia(WIDE_QUERY)
    : null;
}

function subscribeViewport(onChange) {
  const query = wideQuery();
  if (!query?.addEventListener) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readWide() {
  return wideQuery()?.matches ?? false;
}

// The current layout mode, re-read live whenever the viewport crosses the
// breakpoint — a `useSyncExternalStore`-over-`matchMedia` subscription behind
// the pure `layoutMode` policy.
export function useLayoutMode() {
  const wide = useSyncExternalStore(subscribeViewport, readWide, readWide);
  return layoutMode(wide);
}

// Decorative destination icons (aria-hidden): the magnifier, book-stack and
// list drawn in the tab bar (W02-find-and-play.dc.html lines 56-58). The visible
// label beside each is the accessible name, routed through i18n.
const ICONS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  books: <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-.8 3 15.6-3.5.8z" />,
  setlists: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
};

function DestinationIcon({ name }) {
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
    >
      {ICONS[name]}
    </svg>
  );
}

// One destination tab, styled for the layout it sits in: a `.tab` (`.on` when
// selected) column in the phone tab bar, a `.row` (`.sel` when selected) in the
// sidebar rail. The selected state is carried by `aria-selected` (a word to
// assistive tech, from RAC), never colour alone (mockups README lines 26-27);
// `.tab.on` / `.row.sel` are the drawn accent on top of that.
function destinationTab(key, variant) {
  const label = t(`shell.${key}`);
  if (variant === 'rail') {
    return (
      <Tab key={key} id={key} className={({ isSelected }) => `row${isSelected ? ' sel' : ''}`}>
        <DestinationIcon name={key} />
        <span className="grow">
          <span className="name">{label}</span>
        </span>
      </Tab>
    );
  }
  return (
    <Tab key={key} id={key} className={({ isSelected }) => `tab${isSelected ? ' on' : ''}`}>
      <DestinationIcon name={key} />
      {label}
    </Tab>
  );
}

// The destination regions: each a `TabPanel` (role=tabpanel, named by its tab).
// The `search` panel renders the real search screen and the `books` panel the
// book-management screen — both threaded the store (songs.search / books.shelf
// Decision 1) — while `setlists` stays a labelled slot its own content task will
// fill. RAC mounts only the selected panel, so exactly one level-1 heading (the
// screen's own) is present at a time.
function destinationPanels(store, onNavigate, onWriteSong, onOpenBook, search) {
  return DESTINATIONS.map((key) => (
    <TabPanel key={key} id={key}>
      {key === 'search' ? (
        // The first-run "add a book by its link" way-in routes to the Books
        // screen's add-a-book flow via this navigation callback (account.first_run
        // Decision 1; books.add_by_link fills in the by-link option). Navigation
        // stays view-state here (no router); the other first-run seams are plain
        // callback props their own tasks wire. `onWriteSong` is the new-song
        // way-in (songs.new_song): the Create row, the empty shelf and a book's
        // section all raise it, with the started-from book and the query title.
        // The query is lifted so it survives opening the chord explorer and is
        // still typed on *back* (music.explorer); the chord row opens the explorer.
        <SearchScreen
          store={store}
          onAddBook={() => onNavigate('books')}
          onWriteSong={onWriteSong}
          query={search.query}
          onQueryChange={search.onQueryChange}
          onExploreChord={search.onExploreChord}
        />
      ) : key === 'books' ? (
        <BooksScreen store={store} onOpenBook={onOpenBook} />
      ) : (
        <h1 className="t-h1">{t(`shell.${key}`)}</h1>
      )}
    </TabPanel>
  ));
}

export default function AppShell({ store = getAppStore() }) {
  const mode = useLayoutMode();
  const [selected, setSelected] = useState(DESTINATIONS[0]);

  // Writing a new song is ephemeral view state, not Worker data and not a store
  // slice (songs.new_song Decision 5; shell.layout Decision 5 — navigation is
  // `useState`, no router). `editing` is null unless a new song is open; while
  // open it carries the song's title, its target book and placeholder path (set
  // once NEW_SONG_READY lands), and whether it is still a fresh template.
  const [editing, setEditing] = useState(null);
  // The open book's file view (books.file_view): its bookId, or null. Like
  // `editing`, a full-screen host over the shell and ephemeral view state (no
  // router); the per-book Files control on the book-management screen sets it.
  const [openFile, setOpenFile] = useState(null);
  // The instrument surface (music.instruments Decision 1): the header chip is
  // shell chrome present on every destination; pressing it opens the roster
  // overlay. Open-state is ephemeral view state, like the destination selection.
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
  // The search query, lifted here (music.explorer): opening the chord explorer
  // unmounts the search panel, so holding the query in the shell keeps it typed
  // for *back*. The chord explorer is a full-screen surface over the shell, like
  // the file view and the new-song host; `exploring` carries the typed symbol or
  // is null. Ephemeral view state, no router (shell.layout).
  const [searchQuery, setSearchQuery] = useState('');
  const [exploring, setExploring] = useState(null);
  // The live CodeMirror view, so Change book can carry the current text to the
  // new book's placeholder (Decision 3). A ref, not state — it never renders.
  const editorRef = useRef(null);
  // A pending Change-book re-target: the text to carry and the placeholder to
  // discard, consumed by the next NEW_SONG_READY.
  const retargetRef = useRef(null);

  // Start a new song from any way in (songs.new_song, workflow 3 §Ways in). The
  // payload carries the started-from book (else *My songs*), the folder (the
  // file view's, else the book root), the search query as the title, and the
  // localised *My songs* label the Worker writes if it must mint the book.
  const startNewSong = useCallback(
    (opts = {}) => {
      setEditing({ songTitle: opts.title ?? '', bookId: null, path: null, isNew: true });
      store.send(
        command(CommandKind.NEW_SONG, {
          targetBookId: opts.bookId ?? null,
          folder: opts.folder ?? null,
          mySongsTitle: t('firstRun.mySongs'),
          author: LOCAL_IDENTITY,
        }),
      );
    },
    [store],
  );

  // Change the book before the first save (Decision 3): re-target with shipped
  // primitives — NEW_SONG for the new book, then WRITE the current text into its
  // placeholder and DISCARD the old one (uncommitted, so it is deleted). No
  // bespoke move command; moving a draft costs nothing.
  const changeBook = useCallback(
    (targetBookId) => {
      if (!editing?.bookId || targetBookId === editing.bookId) return;
      retargetRef.current = {
        text: editorRef.current?.state?.doc?.toString() ?? '',
        from: { bookId: editing.bookId, path: editing.path },
      };
      store.send(
        command(CommandKind.NEW_SONG, {
          targetBookId,
          folder: null,
          mySongsTitle: t('firstRun.mySongs'),
          author: LOCAL_IDENTITY,
        }),
      );
    },
    [store, editing],
  );

  // Bring the Worker up once the shell is on screen (store.js `open()`): it
  // opens the database, reports READY, and surfaces the home book's
  // preferences, shelf and instrument roster plus the device recents — the
  // bring-up that fills the header instrument chip with the in-use (or the
  // standard-guitar default) instrument as soon as the shell paints, with no
  // interaction (music.instruments §The roster; the chip is shell chrome, not a
  // destination). Idempotent in the Worker (`ensureOpen`/`ensureIndexHydrated`
  // are memoised) and the store is a singleton, so StrictMode's double-invoke
  // cannot bring up twice; the inert no-op store (jsdom) has `open()` too, so
  // the behaviour tests that mount the shell post to a dead endpoint and no-op.
  useEffect(() => {
    store.open?.();
  }, [store]);

  // The Worker allocated the target book and placeholder path: mount the editor
  // on them. A re-target instead carries the text over and discards the old
  // placeholder, mounting on the existing file (isNew: false).
  useWorkerEvent(store, EventKind.NEW_SONG_READY, ({ bookId, path }) => {
    // While the file view is open it owns its own new-song flow (its editor is
    // embedded); the shell's editor host stays dormant.
    if (openFile) return;
    const retarget = retargetRef.current;
    if (retarget) {
      retargetRef.current = null;
      store.send(command(CommandKind.WRITE, { bookId, path, text: retarget.text }));
      store.send(
        command(CommandKind.DISCARD, {
          bookId: retarget.from.bookId,
          paths: [retarget.from.path],
        }),
      );
      setEditing((prev) => (prev ? { ...prev, bookId, path, isNew: false } : prev));
    } else {
      setEditing((prev) => (prev ? { ...prev, bookId, path, isNew: true } : prev));
    }
  });

  // The first save landed: the song is now an ordinary one (workflow 3 §The
  // first save). Close the host and return to where the writer was.
  useWorkerEvent(store, EventKind.SAVED, ({ bookId }) => {
    if (openFile) return;
    retargetRef.current = null;
    setEditing((prev) => (prev && prev.bookId === bookId ? null : prev));
  });

  // Leave the editor (Back): a never-saved draft stays in the working copy,
  // findable by its badge (workflow 3 §Abandoning it L53-54). Drop any pending
  // re-target so a later new song does not consume it.
  const exitEditing = useCallback(() => {
    retargetRef.current = null;
    setEditing(null);
  }, []);

  // The file view is a full screen over the shell (books.file_view Decision 7),
  // exactly as the new-song editor host is; Back returns to the shell.
  if (openFile) {
    return (
      <FileView store={store} bookId={openFile} mode={mode} onBack={() => setOpenFile(null)} />
    );
  }

  // While a new song is open and its book/path are known, the host is a full
  // screen over the shell (W03 board: a Back affordance on every viewport, the
  // editor's own text/preview split as the wide layout).
  if (editing?.bookId && editing?.path) {
    return (
      <NewSongHost
        store={store}
        editing={editing}
        mode={mode}
        onBack={exitEditing}
        onChangeBook={changeBook}
        editorRef={editorRef}
      />
    );
  }

  // The chord explorer (music.explorer, workflow 16): a full screen over the
  // shell, reached from search's chord row, carrying the typed symbol. Back
  // returns to search with the query still typed (it is lifted above).
  if (exploring) {
    return (
      <ChordExplorer
        store={store}
        initialText={exploring.text}
        mode={mode}
        onBack={() => setExploring(null)}
      />
    );
  }

  const openInstruments = () => setInstrumentsOpen(true);
  const search = {
    query: searchQuery,
    onQueryChange: setSearchQuery,
    onExploreChord: (_chord, typedQuery) => setExploring({ text: typedQuery ?? searchQuery }),
  };

  return (
    <>
      <Tabs
        className="shell"
        orientation={mode === 'wide' ? 'vertical' : 'horizontal'}
        selectedKey={selected}
        onSelectionChange={setSelected}
      >
        {mode === 'wide' ? (
          <div className="split">
            <div className="pane side">
              <div className="side-head">
                <span className="t-h1">{t('app.name')}</span>
                {/* The instrument chip, the one shared piece of shell chrome
                    (music.instruments Decision 1): the computer board draws it in
                    the side header. */}
                <InstrumentChip store={store} onOpen={openInstruments} />
              </div>
              <TabList className="rail" aria-label={t('shell.nav')}>
                {DESTINATIONS.map((key) => destinationTab(key, 'rail'))}
              </TabList>
            </div>
            <main className="pane main">
              <div className="scroll">
                {destinationPanels(store, setSelected, startNewSong, setOpenFile, search)}
              </div>
            </main>
          </div>
        ) : (
          <div className="screen">
            {/* The narrow top strip holds only the instrument chip (the board's
                minimal header on the phone); `order: -1` keeps it above the
                scrolling detail. */}
            <div className="instr-top">
              <InstrumentChip store={store} onOpen={openInstruments} />
            </div>
            {/* The TabList renders before the TabPanels so RAC can register the
                tab ids the panels reference (react-aria tabs link panel↔tab by a
                shared base id set when the list mounts); the tab bar is placed
                back at the foot of the screen with `order` in shell.css. */}
            <TabList className="tabbar" aria-label={t('shell.nav')}>
              {DESTINATIONS.map((key) => destinationTab(key, 'tab'))}
            </TabList>
            <main className="scroll">
              {destinationPanels(store, setSelected, startNewSong, setOpenFile, search)}
            </main>
          </div>
        )}
      </Tabs>
      <InstrumentsOverlay
        store={store}
        isOpen={instrumentsOpen}
        onClose={() => setInstrumentsOpen(false)}
      />
    </>
  );
}

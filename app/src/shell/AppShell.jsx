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
import { Button, Tabs, TabList, Tab, TabPanel } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { getAppStore } from '../worker/store.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import SearchScreen from '../songs/SearchScreen.jsx';
import SongReading from '../songs/SongReading.jsx';
import SongHistory from '../songs/SongHistory.jsx';
import SongArrange from '../songs/SongArrange.jsx';
import SongWizard from '../songs/SongWizard.jsx';
import NewSongHost from '../songs/NewSongHost.jsx';
import BooksScreen from '../books/BooksScreen.jsx';
import SharingScreen from '../books/SharingScreen.jsx';
import BookConflicts from '../books/BookConflicts.jsx';
import SongConflict from '../songs/SongConflict.jsx';
import { orderedBooks, titleFor } from '../books/book-display.js';
import SignIn from '../account/SignIn.jsx';
import InvitedScreen from '../account/InvitedScreen.jsx';
import AccountScreen from '../account/AccountScreen.jsx';
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

// The header account affordance (account.account_screen acceptance 1; DIRECTION
// §6 line 545; mockup Theme-picker — "reached from the header"). Shell chrome
// present on every destination, signed in or not; pressing it opens the account
// surface. An icon button with an accessible name that says what it does — the
// person glyph is decorative.
function AccountButton({ onOpen }) {
  return (
    <Button className="btn icon account-open" aria-label={t('account.open')} onPress={onOpen}>
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
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
    </Button>
  );
}

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
function destinationPanels(store, onNavigate, onWriteSong, onOpenBook, onOpenSong, onSignIn, onByLink, search, mode) {
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
          onOpenSong={onOpenSong}
          onSignIn={onSignIn}
          query={search.query}
          onQueryChange={search.onQueryChange}
          onExploreChord={search.onExploreChord}
        />
      ) : key === 'books' ? (
        // The Add-a-book sheet's "By link" (paste a link → the invited flow) and
        // "Mine on Estante" (sign in to see them) seams are books.add_by_link's,
        // wired here: `onByLink` starts the invited flow, `onSignIn` opens the
        // passkey surface.
        <BooksScreen
          store={store}
          onOpenBook={onOpenBook}
          onByLink={onByLink}
          onSignIn={onSignIn}
          mode={mode}
        />
      ) : (
        <h1 className="t-h1">{t(`shell.${key}`)}</h1>
      )}
    </TabPanel>
  ));
}

export default function AppShell({
  store = getAppStore(),
  redeemToken = null,
  inviteToken = null,
  bookSong = null,
  inviteSongAnchor = null,
}) {
  const mode = useLayoutMode();
  const shelf = useSlice(store, 'shelf');
  const sync = useSlice(store, 'sync');
  const [selected, setSelected] = useState(DESTINATIONS[0]);

  // The invited flow (books.add_by_link, workflow 1 §Invited): a full-screen
  // surface over the shell, opened when the app booted on an invitation link
  // (`/i/<token>`, App.jsx) or the person pasted one into the Add-a-book sheet.
  // `null` is closed; otherwise `{ phase, reason?, token }` where phase is
  // 'working' (accepting/cloning), 'prompt' (needs an account) or 'refused' (a
  // dead/full link, with the worded `reason`). The Worker drives it: ADD_BY_LINK
  // attempts accept, and NEED_ACCOUNT / BOOK_CLONED / BOOK_REFUSED move this
  // state (Decision 2). `token` is carried so the accept can be re-sent after
  // sign-in (accept is idempotent on repeat — no double join).
  const [invited, setInvited] = useState(inviteToken ? { phase: 'working', token: inviteToken } : null);

  // The sign-in surface (account.sign_in): a full-screen surface over the shell,
  // like `openSong`/`openFile`. It is opened by the empty shelf's "Sign in" row
  // (the `onSignIn` seam account.first_run wired) in create intent — the cold
  // device's primary account-creation path, "An account is a passkey" (workflow
  // 7; the e2e journey makes an account here) — or, when the app booted at
  // `/sign-in/<token>` (App.jsx), straight into redeem mode. The returning-device
  // authenticate path and its "I have an account: sign in" entry are
  // books.add_by_link's, which opens this same surface in sign-in intent.
  // `null` is closed; otherwise `{ intent, token }`. Closing (cancel, or after a
  // successful `onSignedIn`) returns to where it was opened from. The account
  // itself is handed to `onSignedIn`; filling the shelf and switching the commit
  // author from the device-local id are account.new_device's, not this surface's
  // (Decision 6), so here a sign-in simply closes the surface.
  const [signIn, setSignIn] = useState(
    redeemToken ? { intent: 'signIn', token: redeemToken } : null,
  );

  // The account screen (account.account_screen, workflow 13 §The account screen):
  // a full-screen surface over the shell, opened from the header account
  // affordance (present signed-in or not — DIRECTION §6 line 545), like
  // `signIn`/`openSong`. `false` is closed. It reads "signed in" afresh each open
  // from a 200/401 probe (Decision 3), writes theme/language through the Worker,
  // and its not-signed-in card opens the SignIn surface above it; closing returns
  // to where it was opened from (the selected destination is held in `selected`).
  const [account, setAccount] = useState(false);

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
  // The open song, set from a tapped search result (songs.reading Decision 5):
  // `{ bookId, path }` or null. Like the editor host and the file view, it is a
  // full-screen surface over the shell (narrow) / the master-detail (wide), and
  // ephemeral view state — no router, no store slice (shell.layout Decision).
  const [openSong, setOpenSong] = useState(null);
  // The sharing surface over the open song (books.share): `{ bookId, path }` or
  // null, set by the reading toolbar's Share (the owner invites to this song, a
  // member copies its address). A RAC Modal portaled into `.est`, so it sits over
  // the reading view without replacing it. Ephemeral view state, no router.
  const [sharing, setSharing] = useState(null);
  // The song-history surface (songs.history), raised from the reading view's
  // `onOpenHistory` seam — the "see what changed" merge notice (sync.read_in_place)
  // and the existing History button both open it: `{ bookId, path, commit? }` or
  // null. A full-screen surface mounted over the open song; `onBack` returns to
  // reading. Ephemeral view state, no router, like `openSong` itself. This closes
  // the seam songs.reading left for its toolbar (Decision 6).
  const [history, setHistory] = useState(null);
  // The arrange surface, raised from the reading view's `onArrange` seam
  // (songs.arrange Decision 1): `{ bookId, path }` or null. A full-screen surface
  // mounted over the open song — **Done** clears it and returns to reading with
  // the working copy's unsaved edit intact. Ephemeral view state, no router, like
  // `openSong` itself.
  const [arranging, setArranging] = useState(null);
  // The voicing wizard, raised from arrange's `onRunWizard` seam
  // (songs.wizard_ui Decision 1): `{ bookId, path }` or null. It is a surface
  // mounted over arrange; closing it (Back, or after Write the plan) returns to
  // arrange, which re-mounts and re-reads the working copy (WRITE is silent), so
  // a new variation shows. `wizardReturn` holds whether to send focus back to
  // arrange's Run-the-wizard button on that re-mount (its node is replaced).
  const [wizard, setWizard] = useState(null);
  const [wizardReturn, setWizardReturn] = useState(false);
  // The conflict surfaces (sync.conflicts, workflow 9): `conflictsBook` is the
  // bookId whose paused merge panel is open; `songConflict` is `{ bookId, path }`
  // for the per-song resolver mounted over it. Opening a book the engine left
  // *needs you* engages the merge (OPEN_CONFLICTS materialises it) and shows the
  // panel. Ephemeral view state, no router, like the other surfaces.
  const [conflictsBook, setConflictsBook] = useState(null);
  const [songConflict, setSongConflict] = useState(null);
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

  // Start the invited flow for a token: show the working surface and send
  // ADD_BY_LINK. The Worker attempts the accept and replies NEED_ACCOUNT (no
  // session yet), BOOK_CLONED (joined) or BOOK_REFUSED (dead/full link). Reused
  // by the boot route, the "paste a link" affordance and the post-sign-in retry.
  const openByLink = useCallback(
    (token) => {
      setInvited({ phase: 'working', token });
      store.send(command(CommandKind.ADD_BY_LINK, { token, author: LOCAL_IDENTITY }));
    },
    [store],
  );

  // Boot the invited flow once when the app opened on `/i/<token>` (App.jsx
  // captured and cleaned it). A signed-in device clones straight away; a
  // signed-out one is asked for an account first — both through the one ADD_BY_LINK
  // (Decision 2). Guarded so it fires exactly once for the captured token.
  const inviteBooted = useRef(false);
  useEffect(() => {
    if (!inviteToken || inviteBooted.current) return;
    inviteBooted.current = true;
    openByLink(inviteToken);
  }, [inviteToken, openByLink]);

  // Boot a member's `/b/<bookId>/<path>` deep link once: open that song in the
  // book the account already holds (books.share, workflow 10 L95-96). The
  // open-song-by-(bookId, path) seam self-resolves the text (SongReading), so no
  // index lookup is needed. Guarded so it fires exactly once for the captured
  // address.
  const bookSongBooted = useRef(false);
  useEffect(() => {
    if (!bookSong || bookSongBooted.current) return;
    bookSongBooted.current = true;
    setOpenSong({ bookId: bookSong.bookId, path: bookSong.path });
  }, [bookSong]);

  // The account-first gate: the accept answered 401, so show the generic invited
  // screen (names nothing about the book) with the account-first prompt. The
  // token to retry is kept in the ref.
  useWorkerEvent(store, EventKind.NEED_ACCOUNT, ({ token }) => {
    setInvited((prev) => ({ phase: 'prompt', token: token ?? prev?.token ?? null }));
  });

  // The book was cloned and recorded on the shelf. Only the invited flow lands on
  // it (a "mine on Estante" add leaves `invited` null and simply lets the book
  // appear on the shelf via the SHELF re-surface). Land on the Books destination,
  // where the just-cloned book now shows *On Estante* with its role and its songs
  // are reachable (workflow 1 §Invited "the first screen is its song list"; the
  // reader's deep-link into a specific song is books.share's, scoped out here).
  useWorkerEvent(store, EventKind.BOOK_CLONED, ({ bookId }) => {
    if (!invited) return;
    setInvited(null);
    setSelected('books');
    // A song-share invitation carried the song path as a client-only `#<path>`
    // fragment (books.share Decision 2): open it in the freshly cloned book.
    if (inviteSongAnchor && bookId) {
      setOpenSong({ bookId, path: inviteSongAnchor });
    }
  });

  // A dead or full link: surface the worded refusal (it names nothing about the
  // book, workflow 1 §Invited L53-58).
  useWorkerEvent(store, EventKind.BOOK_REFUSED, ({ reason }) => {
    setInvited((prev) => ({ phase: 'refused', reason: reason ?? 'dead', token: prev?.token ?? null }));
  });

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

  // The sign-in surface is a full screen over the shell (account.sign_in
  // Decision 3), checked first so a `/sign-in/<token>` boot shows it even with
  // no shelf yet behind it. `onSignedIn` hands the account out (the shelf fill
  // and the author switch are account.new_device's — Decision 6); here it just
  // closes. Cancel closes the same way.
  if (signIn) {
    return (
      <SignIn
        intent={signIn.intent}
        redeemToken={signIn.token ?? null}
        onSignedIn={() => {
          // Opened from the invited flow: re-send the accept now that there is a
          // session (idempotent on repeat — no double join), showing the working
          // surface again while it clones.
          const token = invited?.token;
          setSignIn(null);
          if (signIn.forInvite && token) {
            openByLink(token);
          }
        }}
        onClose={() => setSignIn(null)}
      />
    );
  }

  // The account screen (account.account_screen): a full screen over the shell,
  // checked after SignIn so the not-signed-in card's "Use a passkey" / "Email me
  // a link" open the SignIn surface above it and return here on close (the
  // account surface stays open behind it). `onSignOut` is the current-device
  // seam account.sign_out fills (Decision 4) — a no-op here.
  if (account) {
    return (
      <AccountScreen
        store={store}
        onClose={() => setAccount(false)}
        onSignIn={() => setSignIn({ intent: 'signIn' })}
      />
    );
  }

  // The invited door (books.add_by_link, workflow 1 §Invited): checked after
  // SignIn so pressing "Make an account" / "I have an account: sign in" opens the
  // passkey surface over it and returns here, and before the shell so it shows
  // even with no shelf behind it.
  if (invited) {
    return (
      <InvitedScreen
        phase={invited.phase}
        reason={invited.reason}
        onMakeAccount={() => setSignIn({ intent: 'create', forInvite: true })}
        onSignIn={() => setSignIn({ intent: 'signIn', forInvite: true })}
        onAddByLink={() => {
          setInvited(null);
          setSelected('books');
        }}
        onClose={() => setInvited(null)}
      />
    );
  }

  // Opening a book (shell.layout): its Files view, unless the sync engine left it
  // reading *needs you* (sync.conflicts) — then engage the merge (OPEN_CONFLICTS
  // recomputes and materialises it) and show the paused panel instead (workflow
  // 9 §Meeting one). A book already being settled keeps its panel.
  const openBook = (bookId) => {
    if (conflictsBook === bookId || sync?.[bookId]?.phase === 'needs_you') {
      if (conflictsBook !== bookId) store.send(command(CommandKind.OPEN_CONFLICTS, { bookId }));
      setConflictsBook(bookId);
    } else {
      setOpenFile(bookId);
    }
  };

  // The per-song conflict resolver (sync.conflicts, workflow 9 §Settling one): a
  // full screen over the paused panel, raised by its *Settle*. Checked first so
  // it sits over the panel; Back returns to it.
  if (songConflict) {
    return (
      <SongConflict
        store={store}
        bookId={songConflict.bookId}
        path={songConflict.path}
        onClose={() => setSongConflict(null)}
      />
    );
  }

  // The book-level paused panel (sync.conflicts, workflow 9 §The rest): a full
  // screen over the shell for a book with an in-progress merge. *Settle* opens the
  // per-song resolver above; Back returns to the shell.
  if (conflictsBook) {
    const entry = orderedBooks(shelf).find((e) => e.id === conflictsBook);
    return (
      <BookConflicts
        store={store}
        bookId={conflictsBook}
        title={titleFor(entry?.book ?? {}, conflictsBook)}
        onSettle={(path) => setSongConflict({ bookId: conflictsBook, path })}
        onClose={() => setConflictsBook(null)}
      />
    );
  }

  // A song's history is a full screen over whatever opened it (songs.history),
  // checked before the editor hosts and the reading view so it sits over the
  // surface that raised it — Back returns there (the reading view, the file-view
  // raw editor, or the new-song host). Both the reading view's merge notice and
  // History button (sync.read_in_place) and the editor's merge notice
  // (songs.edit_in_place) reach it through `onOpenHistory`.
  if (history) {
    return (
      <SongHistory
        store={store}
        bookId={history.bookId}
        path={history.path}
        onBack={() => setHistory(null)}
      />
    );
  }

  // The file view is a full screen over the shell (books.file_view Decision 7),
  // exactly as the new-song editor host is; Back returns to the shell.
  if (openFile) {
    return (
      <FileView store={store} bookId={openFile} mode={mode} onBack={() => setOpenFile(null)} onOpenHistory={setHistory} />
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
        onOpenHistory={setHistory}
        editorRef={editorRef}
      />
    );
  }

  // The voicing wizard (songs.wizard_ui): the action behind arrange's **Run the
  // wizard** affordance, a surface mounted over arrange. Checked before
  // `arranging` so it sits over it; **Back** / **Write the plan** close it and
  // flag arrange to send focus back to its Run-the-wizard button as it re-mounts.
  if (wizard) {
    return (
      <SongWizard
        store={store}
        bookId={wizard.bookId}
        path={wizard.path}
        mode={mode}
        onBack={() => {
          setWizard(null);
          setWizardReturn(true);
        }}
      />
    );
  }

  // Arranging a song (songs.arrange): the mode entered from the reading view's
  // `onArrange` seam, a full screen over the open song. **Done** returns to
  // reading (the working copy's unsaved edit stays). Checked before `openSong`
  // so it sits over the reading view that raised it. *Run the wizard* opens the
  // wizard surface above (songs.wizard_ui); on its close arrange re-mounts and
  // `autoFocusWizard` returns focus to the button that opened it.
  if (arranging) {
    return (
      <SongArrange
        store={store}
        bookId={arranging.bookId}
        path={arranging.path}
        mode={mode}
        onBack={() => setArranging(null)}
        onRunWizard={(args) => setWizard(args)}
        autoFocusWizard={wizardReturn}
        onWizardFocusReturned={() => setWizardReturn(false)}
      />
    );
  }

  // A song is open to be read (songs.reading): a full screen over the shell on
  // the phone (Back returns to search), the computer's master-detail on tablet
  // and computer (search in `.pane.side`, the reading view in `.pane.main` —
  // SongReading draws the split itself, sharing the open-song seam so a result
  // in the side pane switches songs). The toolbar's edit / add-to-setlist / share
  // are affordance seams their owning tasks wire (songs.editor, books.setlists,
  // books.share); this task renders them and raises the callbacks (Decision 6).
  // Arrange is wired (`onArrange` opens the arrange surface above); history is
  // wired too — `onOpenHistory` opens SongHistory (checked above), so both the
  // merge notice and the History button land on history in-app.
  if (openSong) {
    // The share surface hangs over the reading view (books.share Decision 4): the
    // book's role/title come from the shelf, so the owner sees the invite form and
    // a member only the song's address. A RAC Modal portaled into `.est`, a
    // sibling of the reading view so it overlays rather than replaces it.
    const shareEntry = sharing
      ? orderedBooks(shelf).find((e) => e.id === sharing.bookId)
      : null;
    return (
      <>
        <SongReading
          store={store}
          bookId={openSong.bookId}
          path={openSong.path}
          mode={mode}
          onBack={() => setOpenSong(null)}
          onOpenSong={setOpenSong}
          onArrange={setArranging}
          onOpenHistory={setHistory}
          onShare={setSharing}
        />
        {sharing ? (
          <SharingScreen
            bookId={sharing.bookId}
            title={titleFor(shareEntry?.book ?? {}, sharing.bookId)}
            role={shareEntry?.book?.role?.value ?? null}
            songPath={sharing.path}
            onClose={() => setSharing(null)}
          />
        ) : null}
      </>
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
                    the side header. The account affordance sits beside it
                    (account.account_screen). */}
                <InstrumentChip store={store} onOpen={openInstruments} />
                <AccountButton onOpen={() => setAccount(true)} />
              </div>
              <TabList className="rail" aria-label={t('shell.nav')}>
                {DESTINATIONS.map((key) => destinationTab(key, 'rail'))}
              </TabList>
            </div>
            <main className="pane main">
              <div className="scroll">
                {destinationPanels(store, setSelected, startNewSong, openBook, setOpenSong, () => setSignIn({ intent: 'create' }), openByLink, search, mode)}
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
              <AccountButton onOpen={() => setAccount(true)} />
            </div>
            {/* The TabList renders before the TabPanels so RAC can register the
                tab ids the panels reference (react-aria tabs link panel↔tab by a
                shared base id set when the list mounts); the tab bar is placed
                back at the foot of the screen with `order` in shell.css. */}
            <TabList className="tabbar" aria-label={t('shell.nav')}>
              {DESTINATIONS.map((key) => destinationTab(key, 'tab'))}
            </TabList>
            <main className="scroll">
              {destinationPanels(store, setSelected, startNewSong, openBook, setOpenSong, () => setSignIn({ intent: 'create' }), openByLink, search, mode)}
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

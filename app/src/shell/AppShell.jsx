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
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import SearchScreen from '../songs/SearchScreen.jsx';
import SongReading from '../songs/SongReading.jsx';
import SongHistory from '../songs/SongHistory.jsx';
import SaveSheet from '../songs/SaveSheet.jsx';
import SongArrange from '../songs/SongArrange.jsx';
import SongWizard from '../songs/SongWizard.jsx';
import NewSongHost from '../songs/NewSongHost.jsx';
import EditSongHost from '../songs/EditSongHost.jsx';
import BooksScreen from '../books/BooksScreen.jsx';
import BookDetail from '../books/BookDetail.jsx';
import SetlistsScreen from '../books/SetlistsScreen.jsx';
import SetlistView from '../books/SetlistView.jsx';
import SetlistPlay from '../books/SetlistPlay.jsx';
import AddToSetlist from '../books/AddToSetlist.jsx';
import ShareSheet from '../books/ShareSheet.jsx';
import PeopleScreen from '../books/PeopleScreen.jsx';
import NewInvitationScreen from '../books/NewInvitation.jsx';
import SongSharePanel from '../books/SongSharePanel.jsx';
import BookConflicts from '../books/BookConflicts.jsx';
import SongConflict from '../songs/SongConflict.jsx';
import { orderedBooks, titleFor, saveTargetFor } from '../books/book-display.js';
import SignIn from '../account/SignIn.jsx';
import UploadPreview from '../books/UploadPreview.jsx';
import RecoveryEmailConfirm from '../account/RecoveryEmailConfirm.jsx';
import InvitedScreen, { InvitedLead, InvitedFooter } from '../account/InvitedScreen.jsx';
import { createAuthClient } from '../account/auth-client.js';
import InvitedRefusal from '../account/InvitedRefusal.jsx';
import AccountScreen from '../account/AccountScreen.jsx';
import MySongsChoice from '../account/MySongsChoice.jsx';
import FileView from '../files/FileView.jsx';
import ChordExplorer from '../music/ChordExplorer.jsx';
import HeaderChrome from './HeaderChrome.jsx';
import InstrumentsOverlay from '../instruments/InstrumentsOverlay.jsx';
import { DESTINATIONS, READING_ACTIONS_WIDE_QUERY, WIDE_QUERY, layoutMode } from './layout-mode.js';
import { bookFileSet } from '../books/setlist-display.js';
import { initialState } from '../worker/reducer.js';
import NotHere from './NotHere.jsx';
import RecoveryBanner from './RecoveryBanner.jsx';
import { useAccountStatus } from './use-account-status.js';
import { offersFirstRunSignIn, showsRecoveryBanner } from './account-status.js';
import { bookOfScope, isSetlistPath, sameItem } from './place.js';
import { bootEntry, usePlaceHistory } from './use-place-history.js';
import './shell.css';

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

// Whether a wide layout is the computer's (READING_ACTIONS_WIDE_QUERY), where a
// book's detail takes the main pane beside its songs as a song does
// (books.row_opens_songs Decision *The detail splits where a song does*).
function computerQuery() {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia(READING_ACTIONS_WIDE_QUERY)
    : null;
}

function subscribeComputer(onChange) {
  const query = computerQuery();
  if (!query?.addEventListener) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readComputer() {
  return computerQuery()?.matches ?? false;
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
// The `search` panel renders the real search screen, the `books` panel the
// book-management screen and the `setlists` panel the Setlists destination — all
// threaded the store (songs.search / books.shelf / books.setlists Decision 1).
// RAC mounts only the selected panel, so exactly one level-1 heading (the
// screen's own) is present at a time.
// What an address names, resolved on the device from the shelf and the book's
// tree (shell.routing Decision 6): 'pending' while the tree is on its way, 'ok',
// or the not-here kind — 'book' (not on the shelf), 'song' / 'setlist' (not in
// the book's present files). `checkItem` is false for an entry popped from
// history, whose item an in-app open already vouched for.
function resolvePlace({ place, checkItem, treeReady }, shelf, tree) {
  const item = place.song ?? place.setlist ?? null;
  const bookId = item?.bookId ?? place.book;
  if (!bookId) return 'ok';
  if (!orderedBooks(shelf).some((entry) => entry.id === bookId)) return 'book';
  if (!item || !checkItem) return 'ok';
  if (!treeReady || !tree?.[bookId]) return 'pending';
  if (bookFileSet(tree[bookId].entries).has(item.path)) return 'ok';
  return place.song ? 'song' : 'setlist';
}

// The shell's auth client (the account-status probe), shared with the sign-in
// surface and the account screen; the behavior level injects a loopback double.
const DEFAULT_AUTH_CLIENT = createAuthClient();

function destinationPanels(store, onNavigate, onWriteSong, onOpenBookSongs, onOpenSong, onSignIn, onByLink, onOpenSetlist, onAddToSetlist, search, restore = {}, openSetlistView = null, bookActs = {}, onSignInMine = () => {}, onUpload = () => {}, openBookView = null, offerSignIn = true) {
  return DESTINATIONS.map((key) => (
    <TabPanel key={key} id={key} className="shell-panel">
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
          offerSignIn={offerSignIn}
          query={search.query}
          onQueryChange={search.onQueryChange}
          onExploreChord={search.onExploreChord}
          scope={search.scope}
          onScopeChange={search.onScopeChange}
          onAddToSetlist={onAddToSetlist}
          onOpenSetlist={onOpenSetlist}
          onManageBook={bookActs.onManage}
          onSettleBook={bookActs.onSettle}
          onNeedsYou={bookActs.onNeedsYou}
        />
      ) : key === 'books' ? (
        // The Add-a-book sheet's "By link" (paste a link → the invited flow) and
        // "Mine on Estante" (sign in to see them) seams are books.add_by_link's,
        // wired here: `onByLink` starts the invited flow, `onSignInMine` opens the
        // sign-in surface for an existing account at the step it names
        // (books.add_book_chooser Decision 4), and `onUpload` opens the
        // full-screen upload preview (Decision 5). Pressing a book opens its
        // songs (books.row_opens_songs). On a wide layout a book that needs
        // you opens its paused panel here, the rail beside it
        // (sync.conflicts_polish constraint 5; W09#4).
        openBookView ?? (
          <BooksScreen
            store={store}
            onOpenBookSongs={onOpenBookSongs}
            forked={bookActs.forkLanding}
            onByLink={onByLink}
            onSignIn={onSignInMine}
            onUpload={onUpload}
            restoreDismissed={restore.dismissed}
            onDismissRestored={restore.onDismiss}
          />
        )
      ) : key === 'setlists' ? (
        // On the phone an open setlist sits in this panel, the tab bar below it
        // (books.setlist_chrome; W12 phone #1); otherwise the Setlists list.
        openSetlistView ?? <SetlistsScreen store={store} onOpenSetlist={onOpenSetlist} />
      ) : (
        <h1 className="t-h1">{t(`shell.${key}`)}</h1>
      )}
    </TabPanel>
  ));
}

export default function AppShell({
  store = getAppStore(),
  redeemToken = null,
  recoveryToken = null,
  inviteToken = null,
  inviteSongAnchor = null,
  authClient = DEFAULT_AUTH_CLIENT,
}) {
  const mode = useLayoutMode();
  const computer = useSyncExternalStore(subscribeComputer, readComputer, readComputer) && mode === 'wide';
  // What the shell knows of the account, from the service's answer
  // (account.sign_in_two_doors): whether the cold row offers signing in, and
  // whether the recovery-email banner shows. The client is read once: one
  // stable value for the probe (which holds it in a ref) and the surfaces.
  const [auth] = useState(authClient);
  const accountStatus = useAccountStatus(auth);
  const refreshAccount = accountStatus.refresh;
  const shelf = useSlice(store, 'shelf');
  const tree = useSlice(store, 'tree');
  const sync = useSlice(store, 'sync');
  // Where the session starts (shell.routing): the address's place, read once.
  // Its tab is selected from the first render; a book, song or setlist it names
  // waits in `resolving` until the shelf (and the book's tree) say it is here.
  const [boot] = useState(bootEntry);
  const [selected, setSelected] = useState(boot.place.tab ?? DESTINATIONS[0]);
  // The search scope, lifted here (shell.routing Decision 1) so a book's address
  // can set it and back can return to it; SearchScreen is controlled by it.
  const [scope, setScope] = useState(null);
  // A place applied from an address (boot) or from history (popstate) that names
  // a book or an item, held until it resolves: `{ place, checkItem, treeReady }`
  // or null. While pending the shell's destination shows; when it resolves to a
  // not-here kind, the NotHere surface shows and the URL stays at the address.
  const [resolving, setResolving] = useState(() =>
    boot.fromAddress ? { place: boot.place, checkItem: true, treeReady: false } : null,
  );

  // The invited flow (books.add_by_link, workflow 1 §Invited): a full-screen
  // surface over the shell (a refusal: a dialog over it), opened when the app
  // booted on an invitation link (`/i/<token>`, App.jsx) or the person pasted
  // one into the Add-a-book sheet.
  // `null` is closed; otherwise `{ phase, reason?, token }` where phase is
  // 'working' (accepting/cloning), 'prompt' (needs an account) or 'refused' (a
  // dead/full link, with the worded `reason`). The Worker drives it: ADD_BY_LINK
  // attempts accept, and NEED_ACCOUNT / BOOK_CLONED / BOOK_REFUSED move this
  // state (Decision 2). `token` is carried so the accept can be re-sent after
  // sign-in (accept is idempotent on repeat — no double join).
  const [invited, setInvited] = useState(inviteToken ? { phase: 'working', token: inviteToken } : null);

  // The one sign-in surface (account.sign_in, account.sign_in_two_doors;
  // workflow 13 §Signing in, or making an account): a full-screen surface over
  // the shell, like `openSong`/`openFile`, opened the same way from every entry
  // — the cold row, the account card, *Mine on Estante* and an invitation (with
  // the invitation as its lead) — at its two sections; no entry picks a door.
  // When the app booted at `/sign-in/<token>` (App.jsx) it opens straight into
  // redeem mode. `null` is closed; otherwise `{ step?, token?, forInvite? }`.
  // `onSignedIn` attaches the home book (and accepts the invitation) the moment
  // the session exists; `onDone` closes it once its last step — the offer, or
  // *Add a recovery email* after *Make an account* — has ended.
  const [signIn, setSignIn] = useState(redeemToken ? { token: redeemToken } : null);
  // Mine on Estante's sign-in (books.add_book_chooser Decision 4): its passkey
  // button opens the two sections; "No passkey here? Email me a link" names a
  // step, so it lands on the email step.
  const signInMine = (step) => setSignIn(step === 'email' ? { step: 'email' } : {});

  // The upload preview (books.upload_ui Decision 1; books.add_book_chooser
  // Decision 5): a full-screen surface over the shell on every viewport, with no
  // rail, side pane or tab bar beside it (W07 #3). `{ bytes, fileName }` of the
  // zip picked from the Add-a-book sheet while open; `null` closed.
  const [upload, setUpload] = useState(null);

  // The account screen (account.account_screen, workflow 13 §The account screen):
  // a full-screen surface over the shell, opened from the header account
  // affordance (present signed-in or not — DIRECTION §6 line 545), like
  // `signIn`/`openSong`. `false` is closed. It reads "signed in" afresh each open
  // from a 200/401 probe (Decision 3), writes theme/language through the Worker,
  // and its not-signed-in card opens the SignIn surface above it; closing returns
  // to where it was opened from (the selected destination is held in `selected`).
  // `{ focus: 'recovery' }` opens it from the banner's *Add one*, at the
  // Recovery email region (account.sign_in_two_doors).
  const [account, setAccount] = useState(false);
  const openRecoveryEmail = () => setAccount({ focus: 'recovery' });
  // A song read full screen drops the banner with the rest of the chrome
  // (workflow 13 §The banner, *Full screen*); SongReading reports it.
  const [readingFull, setReadingFull] = useState(false);

  // A new device (account.new_device): the shelf's *Home book restored* notice
  // is dismissed for the rest of this start (it outlives a tab switch, so it is
  // held here), and *Later* on the two-*My songs* choice puts it away until the
  // next start — it sends nothing; the Worker asks again then.
  const [restoreDismissed, setRestoreDismissed] = useState(false);
  const restore = { dismissed: restoreDismissed, onDismiss: () => setRestoreDismissed(true) };
  const mySongsChoice = useSlice(store, 'mySongsChoice');
  const [mySongsLater, setMySongsLater] = useState(false);

  // The recovery email's confirm page (account.recovery_email; workflow 13
  // §Confirming it): a full-screen surface opened only when the app booted at
  // `/recovery-email/<token>` (App.jsx). It posts the token once, needs no
  // session and never signs in, so the device's signed-in state is untouched.
  // `null` is closed; "Open Estante" closes it onto the shelf.
  const [recoveryConfirm, setRecoveryConfirm] = useState(recoveryToken);

  // Writing a new song is ephemeral view state, not Worker data and not a store
  // slice (songs.new_song Decision 5; shell.layout Decision 5 — navigation is
  // `useState`, no router). `editing` is null unless a new song is open; while
  // open it carries the song's title, its target book and placeholder path (set
  // once NEW_SONG_READY lands), and whether it is still a fresh template.
  const [editing, setEditing] = useState(null);
  // Editing a song that already exists (workflow 4): what the reading view's
  // Edit opens — { bookId, path, songTitle } or null. Kept apart from `editing`
  // (a new song), whose SAVED and re-target handling it must not share.
  const [editingSong, setEditingSong] = useState(null);
  // The open book's file view (books.file_view): `{ bookId, path }` or null —
  // `path` the file it opened at (the reading view's *Show the file*,
  // songs.show_the_file) or null (*Files* on the book's detail,
  // books.row_opens_songs). Like `editing`, a full-screen host over the shell
  // and ephemeral view state (no router).
  const [openFile, setOpenFile] = useState(null);
  // A book's detail (books.row_opens_songs; workflow 7 L86-95): `{ bookId }` or
  // null, opened by *Manage* on the bar above the book's songs. A layer over
  // them, never an address: a reload lands on `…/b/<book>`.
  const [bookDetail, setBookDetail] = useState(null);
  // A fork made from the book's detail lands on the shelf, the fork in the
  // original's place with its one-time note (books.fork; W11 #2): the
  // BOOK_FORKED payload the Books screen opens with, or null.
  const [forkLanding, setForkLanding] = useState(null);
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
  // member copies its address). A panel beside the chart on a tablet or a
  // computer, the Share sheet on a phone (books.share_people; workflow 10 **Where
  // it sits**) — drawn by the reading view. Ephemeral view state, no router.
  const [sharing, setSharing] = useState(null);
  // A book's sharing (books.share_people): the phone's Share sheet over the
  // shell (`{ bookId }`), and the two screens it leads to — the people screen
  // and the New invitation screen — each a full screen over the shell like the
  // file view, with Back through `closers`. On a tablet or a computer *Share*
  // opens the people screen directly. Ephemeral view state, no router.
  const [shareSheet, setShareSheet] = useState(null);
  const [people, setPeople] = useState(null);
  const [newInvitation, setNewInvitation] = useState(null);
  // Where focus goes when a sharing screen closes and the screen beneath
  // re-mounts with fresh nodes (shell.surface_restore_focus): `'book'` — the book
  // detail's *Share* — `'people'` — the people screen's title — or null. Set by
  // the closers, like `wizardReturn`, so Back, Done and the system back all get it.
  const [shareReturn, setShareReturn] = useState(null);
  // The song-history surface (songs.history), raised from the reading view's
  // `onOpenHistory` seam — the "see what changed" merge notice (sync.read_in_place)
  // and the existing History button both open it: `{ bookId, path, commit? }` or
  // null. A full-screen surface mounted over the open song; `onBack` returns to
  // reading. Ephemeral view state, no router, like `openSong` itself. This closes
  // the seam songs.reading left for its toolbar (Decision 6).
  const [history, setHistory] = useState(null);
  // A version or block restored from the history opens the save sheet over it
  // (workflow 6 L59-62): saving the restored text makes a new version.
  const [restoredSaveOpen, setRestoredSaveOpen] = useState(false);
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
  // The setlist surface (books.setlists, workflow 12): `openSetlist` is the
  // opened setlist `{ bookId, path }` (a full-screen surface over the shell /
  // master-detail, like `openSong`); `addingToSetlist` is the song the
  // Add-to-setlist dialog is adding `{ bookId, path, title? }`, raised from the
  // reading view's and the search rows' `onAddToSetlist` seam — a RAC Modal
  // portaled into `.est` over whatever surface raised it. Ephemeral, no router.
  const [openSetlist, setOpenSetlist] = useState(null);
  const [addingToSetlist, setAddingToSetlist] = useState(null);
  // The sharing surface over the open setlist (books.setlist_invitation;
  // workflow 12 §Sharing one): `{ bookId, path }` or null, set by the setlist's
  // Share — a panel beside the list on wide, the Share sheet on a phone. Kept
  // apart from the song's `sharing` (Decision 5), so a song opened from the
  // setlist never shows it; it closes with the setlist (below).
  const [sharingSetlist, setSharingSetlist] = useState(null);
  // Opening a setlist, from any destination, selects the Setlists tab
  // (books.setlist_chrome Decision 3); a search hit still pushes, so Back lands
  // on search again.
  const openSetlistOnTab = (next) => {
    setSelected('setlists');
    setOpenSetlist(next);
  };
  // The setlist player (books.play, workflow 12 §Playing through): the setlist
  // being played `{ bookId, path }`, a chrome-free full-screen surface over the
  // opened setlist, raised from SetlistView's `onPlay` seam. Stop clears it and
  // the setlist is still behind. Ephemeral, no router.
  const [playingSetlist, setPlayingSetlist] = useState(null);
  // The live CodeMirror view, so Change book can carry the current text to the
  // new book's placeholder (Decision 3). A ref, not state — it never renders.
  const editorRef = useRef(null);
  // A pending Change-book re-target: the text to carry and the placeholder to
  // discard, consumed by the next NEW_SONG_READY.
  const retargetRef = useRef(null);
  // A re-target's old placeholder, discarded once its editor has unmounted.
  const pendingDiscardRef = useRef(null);

  // The place shown now and the surfaces open over it (shell.routing): what the
  // address and the history entry say. A one-book scope is part of the place on
  // search only; the layers are listed in a fixed order.
  const scopedBook = selected === 'search' ? bookOfScope(scope) : null;
  const place = {
    tab: selected,
    ...(scopedBook ? { book: scopedBook } : {}),
    ...(openSong ? { song: { bookId: openSong.bookId, path: openSong.path } } : {}),
    ...(openSetlist ? { setlist: { bookId: openSetlist.bookId, path: openSetlist.path } } : {}),
  };
  const layers = [
    account && 'account',
    bookDetail && 'bookDetail',
    conflictsBook && 'conflicts',
    songConflict && 'songConflict',
    history && 'history',
    openFile && 'files',
    people && 'people',
    newInvitation && 'newInvitation',
    editing && 'newSong',
    editingSong && 'editor',
    wizard && 'wizard',
    arranging && 'arrange',
    playingSetlist && 'play',
    exploring && 'explorer',
  ].filter(Boolean);
  // How each surface closes — what its Back does at the bottom of the history,
  // and what `popstate` does to a surface the entry it lands on does not name.
  // The editor's unsaved edit stays in the working copy either way. `kept` is the
  // layers a popped entry keeps (absent for a Back that closes this one alone),
  // so a closer can tell what will still be there once the pop is applied.
  const stays = (kind, kept) => !kept || kept.includes(kind);
  // A sharing screen's close sends focus back only to a surface that re-mounts:
  // the people screen when it is still open, else the book detail when it is
  // open with no song or setlist over it (a flag never waits for a surface that
  // will not mount).
  const shareReturnFor = (kept, { fromInvitation }) => {
    if (fromInvitation && people && stays('people', kept)) return 'people';
    if (bookDetail && stays('bookDetail', kept) && !openSong && !openSetlist) return 'book';
    return null;
  };
  const closers = {
    // Closing the account screen asks again: the address may have been set or
    // confirmed there.
    account: () => {
      setAccount(false);
      refreshAccount();
    },
    bookDetail: () => {
      setBookDetail(null);
      setShareReturn(null);
    },
    conflicts: () => setConflictsBook(null),
    songConflict: () => setSongConflict(null),
    history: () => {
      setRestoredSaveOpen(false);
      setHistory(null);
    },
    files: () => setOpenFile(null),
    people: (kept) => {
      setPeople(null);
      setShareReturn(shareReturnFor(kept, { fromInvitation: false }));
    },
    newInvitation: (kept) => {
      setNewInvitation(null);
      // When the same pop closes the people screen too, its closer (run first,
      // in layer order) already said where focus goes.
      if (!people || stays('people', kept)) setShareReturn(shareReturnFor(kept, { fromInvitation: true }));
    },
    newSong: () => {
      // A never-saved draft stays in the working copy, findable by its badge
      // (workflow 3 §Abandoning it L53-54); a pending re-target is dropped so a
      // later new song does not consume it.
      retargetRef.current = null;
      setEditing(null);
    },
    editor: () => setEditingSong(null),
    wizard: () => {
      setWizard(null);
      // Focus goes back to Run the wizard only when arrange is still there to
      // re-mount (the computer split's Done closes it too).
      if (arranging) setWizardReturn(true);
    },
    arrange: () => setArranging(null),
    play: () => setPlayingSetlist(null),
    explorer: () => setExploring(null),
  };
  // Set the place's slots: the tab, the one-book scope (on search), the open
  // song and setlist.
  const applyPlace = (next) => {
    // A setlist is always on the Setlists tab (books.setlist_chrome Decision 3),
    // as place.js reads a setlist's address.
    setSelected(next.setlist ? 'setlists' : next.tab);
    if (next.tab === 'search') {
      setScope((prev) => {
        if (next.book) return bookOfScope(prev) === next.book ? prev : { bookId: next.book };
        return bookOfScope(prev) ? null : prev;
      });
    }
    setOpenSong(next.song ?? null);
    setOpenSetlist(next.setlist ?? null);
  };
  // An entry popped from history: close every surface it does not name, then set
  // its place — through `resolving` when it names a book (or an item) other than
  // the one open, so a book removed since says so instead of opening empty.
  const applyEntry = (next, kept) => {
    for (const kind of layers) {
      if (!kept.includes(kind)) closers[kind](kept);
    }
    const item = next.song ?? next.setlist ?? null;
    const bookId = item?.bookId ?? next.book ?? null;
    const unchanged = item
      ? sameItem(item, next.song ? openSong : openSetlist)
      : !bookId || bookId === bookOfScope(scope);
    if (bookId && !unchanged) {
      setResolving({ place: next, checkItem: false, treeReady: false });
    } else {
      setResolving(null);
      applyPlace(next);
    }
  };
  const { back, renameBook, followSong, pushNext } = usePlaceHistory({
    boot,
    place,
    layers,
    hold: Boolean(resolving),
    onApply: applyEntry,
  });

  // Resolving an address: once the shelf has its first value, a place naming a
  // book that is here (and, from an address, an item in its present files)
  // opens; otherwise the not-here kind shows. Decided while rendering, so the
  // empty reading view never mounts for something that is not here.
  const shelfSeen = shelf !== initialState.shelf;
  const verdict = resolving ? (shelfSeen ? resolvePlace(resolving, shelf, tree) : 'pending') : null;
  if (resolving && verdict === 'ok') {
    setResolving(null);
    applyPlace(resolving.place);
  }
  // A setlist's share closes with its setlist, and never carries to another
  // (books.setlist_invitation Constraint 4).
  if (sharingSetlist && !sameItem(sharingSetlist, openSetlist)) setSharingSetlist(null);
  // The book's tree is asked for once per resolution; its TREE reply marks the
  // resolution's tree as fresh.
  const resolvingBook =
    resolving && verdict === 'pending' && shelfSeen
      ? (resolving.place.song ?? resolving.place.setlist)?.bookId ?? null
      : null;
  useEffect(() => {
    if (resolvingBook) store.send(command(CommandKind.BOOK_TREE, { bookId: resolvingBook }));
  }, [store, resolvingBook]);
  useWorkerEvent(store, EventKind.TREE, ({ bookId }) => {
    setResolving((prev) => {
      if (!prev || prev.treeReady) return prev;
      const item = prev.place.song ?? prev.place.setlist;
      return item?.bookId === bookId ? { ...prev, treeReady: true } : prev;
    });
  });

  // A book became its fork (books.fork, workflow 11): the device's copy now lives
  // under the fork's id, so every open surface holding the original's id follows
  // it — the editor host, the file view, the open song and its history, arrange,
  // the wizard, sharing and the setlist surfaces — and a save made from any of
  // them lands in the fork. Each `{ bookId, … }` surface keeps the rest of its
  // state; the file view's is the id itself. A put-online changes the book's id
  // the same way (BOOK_ONLINE, shell.routing Decision 8). The search scope
  // follows too, and the current history entry is replaced with the new id's
  // address rather than a step pushed.
  const followBookId = ({ previousBookId, bookId: forkId }) => {
    if (!previousBookId || !forkId || previousBookId === forkId) return;
    const follow = (prev) => (prev && prev.bookId === previousBookId ? { ...prev, bookId: forkId } : prev);
    renameBook(previousBookId, forkId);
    setScope((prev) => {
      if (!prev) return prev;
      if (Array.isArray(prev.books) && prev.books.includes(previousBookId)) {
        return { ...prev, books: prev.books.map((id) => (id === previousBookId ? forkId : id)) };
      }
      return prev.bookId === previousBookId ? { ...prev, bookId: forkId } : prev;
    });
    setEditingSong(follow);
    setOpenSong(follow);
    setHistory(follow);
    setArranging(follow);
    setWizard(follow);
    setSharing(follow);
    setShareSheet(follow);
    setPeople(follow);
    setNewInvitation(follow);
    setOpenSetlist(follow);
    setSharingSetlist(follow);
    setPlayingSetlist(follow);
    setOpenFile(follow);
    setBookDetail(follow);
  };
  useWorkerEvent(store, EventKind.BOOK_FORKED, followBookId);
  useWorkerEvent(store, EventKind.BOOK_FORKED, (payload) => {
    if (!bookDetail || bookDetail.bookId !== payload?.previousBookId) return;
    setBookDetail(null);
    setScope(null);
    setForkLanding(payload);
    setSelected('books');
  });
  useWorkerEvent(store, EventKind.BOOK_ONLINE, followBookId);

  // The open song's file renamed, moved or deleted in the file view opened over
  // it (songs.show_the_file Constraint 6): the open song follows it to its new
  // path, or closes, so Back lands on the song where it is now — or on the
  // destination underneath — and never on a file that is gone. The history
  // entries below that name the old path read as naming where it went.
  useWorkerEvent(store, EventKind.FILE_MOVED, ({ bookId, fromPath, toPath }) => {
    if (!openSong || openSong.bookId !== bookId || openSong.path !== fromPath) return;
    followSong(bookId, fromPath, toPath);
    setOpenSong({ ...openSong, path: toPath });
  });
  useWorkerEvent(store, EventKind.FILE_DELETED, ({ bookId, path }) => {
    if (!openSong || openSong.bookId !== bookId || openSong.path !== path) return;
    followSong(bookId, path, null);
    setOpenSong(null);
  });

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
        }),
      );
    },
    [store, editing],
  );

  // Start the invited flow for a token: show the working surface and send
  // ADD_BY_LINK. The Worker attempts the accept and replies NEED_ACCOUNT (no
  // session yet), BOOK_CLONED (joined) or BOOK_REFUSED (dead/full link). Reused
  // by the boot route, the "paste a link" affordance and the post-sign-in retry.
  const openByLink = useCallback(
    (token) => {
      setInvited({ phase: 'working', token });
      store.send(command(CommandKind.ADD_BY_LINK, { token }));
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

  // The account-first gate: the accept answered 401, so show the generic invited
  // screen (names nothing about the book) with the account-first prompt. The
  // token to retry is kept in the ref.
  // The prompt is the one sign-in surface with the invitation as its lead
  // (account.sign_in_two_doors Decision *The invitation's prompt is the sign-in
  // surface*), so its sections are pressed in place and its recovery step
  // survives the accept moving the invitation on behind it.
  useWorkerEvent(store, EventKind.NEED_ACCOUNT, ({ token }) => {
    setInvited((prev) => ({ phase: 'prompt', token: token ?? prev?.token ?? null }));
    setSignIn({ forInvite: true });
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
    // fragment (books.share Decision 2): open it in the freshly cloned book —
    // a pushed step, so the address bar ends on the song's address
    // (shell.routing Decision 9), never on the token. A setlist's invitation
    // carries the setlist's path the same way, and opens the setlist on the
    // Setlists tab — decided by the path, as an address is
    // (books.setlist_invitation Decision 3).
    if (inviteSongAnchor && bookId) {
      if (isSetlistPath(inviteSongAnchor)) openSetlistOnTab({ bookId, path: inviteSongAnchor });
      else setOpenSong({ bookId, path: inviteSongAnchor });
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
      // The old placeholder is discarded only once its editor has unmounted:
      // that editor flushes a still-debounced write on unmount (the template's
      // first write, or the last keystrokes), which would re-create the file
      // after an earlier DISCARD and leave a stray unsaved draft behind.
      pendingDiscardRef.current = retarget.from;
      setEditing((prev) => (prev ? { ...prev, bookId, path, isNew: false } : prev));
    } else {
      setEditing((prev) => (prev ? { ...prev, bookId, path, isNew: true } : prev));
    }
  });

  // Send a re-target's DISCARD after the commit that swapped the editor: parent
  // effects run after the old child editor's unmount cleanup (its flush), and
  // the Worker handles commands in order.
  useEffect(() => {
    const from = pendingDiscardRef.current;
    if (!from) return;
    pendingDiscardRef.current = null;
    store.send(command(CommandKind.DISCARD, { bookId: from.bookId, paths: [from.path] }));
  }, [store, editing]);

  // The first save landed: the song is now an ordinary one (workflow 3 §The
  // first save). Close the host and return to where the writer was.
  useWorkerEvent(store, EventKind.SAVED, ({ bookId }) => {
    if (openFile) return;
    retargetRef.current = null;
    setEditing((prev) => (prev && prev.bookId === bookId ? null : prev));
  });

  // A save of the song being edited closes the editor, back to reading it.
  useWorkerEvent(store, EventKind.SAVED, ({ bookId }) => {
    setEditingSong((prev) => (prev && prev.bookId === bookId ? null : prev));
  });

  // Leave the editor (Back): a never-saved draft stays in the working copy,
  // findable by its badge (workflow 3 §Abandoning it L53-54). Drop any pending
  // re-target so a later new song does not consume it.
  const exitEditing = () => back(closers.newSong);

  // The recovery email's confirm page, checked before every other surface so a
  // `/recovery-email/<token>` boot shows it on any device, signed in or not
  // (account.recovery_email Decision 6).
  if (recoveryConfirm) {
    return <RecoveryEmailConfirm token={recoveryConfirm} onClose={() => setRecoveryConfirm(null)} />;
  }

  // The sign-in surface is a full screen over the shell (account.sign_in
  // Decision 3), checked first so a `/sign-in/<token>` boot shows it even with
  // no shelf yet behind it, and so an invitation's prompt is this one element in
  // this one place from its sections to its last step. `onSignedIn` hands the
  // account's id to the Worker's attach, which fills the shelf and switches the
  // commit author (account.new_device; account.commit_author), and re-sends an
  // invitation's accept — all while the surface's last step still shows
  // (workflow 13 §Asked when the account is made: nothing waits on it). `onDone`
  // closes it onto where the person was headed. Closing before a session
  // returns to where it was opened from; an invitation's closes the invitation.
  if (signIn) {
    return (
      <SignIn
        authClient={auth}
        initialStep={signIn.step ?? 'method'}
        redeemToken={signIn.token ?? null}
        lead={signIn.forInvite ? <InvitedLead /> : null}
        leadFooter={signIn.forInvite ? <InvitedFooter /> : null}
        onSignedIn={(account) => {
          // Signing in makes this device the account's (account.new_device):
          // the Worker attaches the home book — its settings first — and fills
          // the shelf in the background. The account id rides along: the Worker
          // keeps it and authors every commit as the account from now on,
          // re-authoring the saves not yet pushed first (account.commit_author).
          store.send(command(CommandKind.ATTACH_HOME, account?.id ? { accountId: account.id } : {}));
          // Opened from the invited flow: re-send the accept now that there is a
          // session (idempotent on repeat — no double join), showing the working
          // surface again while it clones.
          const token = invited?.token;
          if (signIn.forInvite && token) {
            openByLink(token);
          }
          refreshAccount();
        }}
        onDone={() => setSignIn(null)}
        onClose={() => {
          if (signIn.forInvite) setInvited(null);
          setSignIn(null);
        }}
      />
    );
  }

  // The recovery-email banner (workflow 13 §The banner): shown on the service's
  // answer while the signed-in account has no confirmed address. The shell
  // draws it below the header chrome; every other surface that replaces the
  // shell gets it at the top of the window, above its own bar, through
  // `framed` (*Screens without the header chrome*). Not on the sign-in surface
  // or the verification-link page (above), the setlist's Play, reading full
  // screen, or the account screen, which draws its own.
  const showBanner = showsRecoveryBanner(accountStatus);
  const banner = showBanner ? <RecoveryBanner onAddOne={openRecoveryEmail} /> : null;
  // The frame is always there, the banner in it or not, so a surface is never
  // re-mounted when the banner comes or goes.
  const framed = (surface, { withBanner = true } = {}) => (
    <div className="recovery-frame">
      {withBanner ? banner : null}
      {surface}
    </div>
  );

  // The account screen (account.account_screen): a full screen over the shell,
  // checked after SignIn so the not-signed-in card's *Sign in or make an account*
  // opens the SignIn surface above it and returns here on close (the account
  // surface stays open behind it). It draws the recovery-email banner itself,
  // from its own read; opened from the banner's *Add one* it focuses the
  // Recovery email region. `onSignOut` returns the surface to the
  // not-signed-in state once account.sign_out's dialog has torn the account down
  // on this device: close the account screen onto the shelf (which the Worker has
  // already emptied, in remove mode, or left as local books, in keep mode).
  if (account) {
    return (
      <AccountScreen
        store={store}
        authClient={auth}
        focusRecovery={account?.focus === 'recovery'}
        onClose={() => back(closers.account)}
        onSignIn={() => setSignIn({})}
        onSignOut={() => {
          setAccount(false);
          refreshAccount();
        }}
      />
    );
  }

  // The invited door's working phase (books.add_by_link, workflow 1 §Invited):
  // before the shell so it shows even with no shelf behind it. Its prompt is
  // the sign-in surface above. A refused link is not this screen: the shell
  // renders, with InvitedRefusal over it (books.invited_presentation).
  if (invited && (invited.phase === 'working' || invited.phase === 'prompt')) {
    return framed(<InvitedScreen onClose={() => setInvited(null)} />);
  }

  // An address for something not on this device (shell.routing; workflow 7
  // §Links to books): the plain not-here screen, never an empty song. The URL
  // stays at the address. Back leaves for search (or the entry below); *Go to
  // Books* opens the Books destination; *Open {book}'s songs* scopes search to
  // the book that is here.
  if (verdict === 'book' || verdict === 'song' || verdict === 'setlist') {
    const notHereBook = (resolving.place.song ?? resolving.place.setlist)?.bookId ?? resolving.place.book;
    const entry = orderedBooks(shelf).find((e) => e.id === notHereBook);
    const leave = (next) => {
      setResolving(null);
      applyPlace(next);
    };
    return framed(
        <NotHere
          kind={verdict}
          bookLabel={verdict === 'book' ? '' : titleFor(entry?.book ?? {}, t('books.untitled'))}
          onBack={() => back(() => leave({ tab: 'search' }))}
          onGoToBooks={() => leave({ tab: 'books' })}
          onOpenBook={() => leave({ tab: 'search', book: notHereBook })}
        />,
    );
  }

  // What the sharing surfaces need of a book from the shelf: its title, the
  // caller's role, and the owner's name (books.owner_name) a member reads.
  // A book only on this device (`isLocal`) has no one to share with yet
  // (books.share_needs_online Constraint 1). A put-online surfaces the shelf
  // without the local entry just before BOOK_ONLINE moves the surface to the
  // new id: in that gap the book is still treated as local, so the song's Share
  // keeps saying *Putting it online…* and asks Estante nothing under the old id.
  const sharingFacts = (bookId) => {
    const entry = orderedBooks(shelf).find((e) => e.id === bookId);
    const book = entry?.book ?? {};
    const owner = book?.owner?.value;
    return {
      title: titleFor(book, t('books.untitled')),
      role: book?.role?.value ?? null,
      ownerName: typeof owner === 'string' && owner !== '' ? owner : null,
      isLocal: !entry || entry.kind === 'local',
    };
  };
  // A book's Share: the sheet on a phone, the people screen on a tablet or a
  // computer (workflow 10 **Where it sits**).
  const shareBook = (bookId) => {
    if (mode === 'wide') setPeople({ bookId });
    else setShareSheet({ bookId });
  };
  // From a sheet (a book's or a song's): close it and open a screen.
  const openPeopleFrom = (bookId) => {
    setShareSheet(null);
    setSharing(null);
    setSharingSetlist(null);
    setPeople({ bookId });
  };

  // The paused book panel is a view of a book: on a wide layout it sits in the
  // Books destination, so opening it selects that tab (sync.conflicts_polish
  // Decision 3).
  const openConflicts = (bookId) => {
    if (mode === 'wide') setSelected('books');
    setConflictsBook(bookId);
  };
  // A book's conflicts, from *Settle* on its bar or a bring-in or upload that
  // met the person's own edits (books.upload_ui Decision 2): engage the merge
  // (OPEN_CONFLICTS recomputes and materialises it) and show the paused panel
  // (workflow 9 §Meeting one). A book already being settled keeps its panel.
  const engageConflicts = (bookId) => {
    if (conflictsBook !== bookId) store.send(command(CommandKind.OPEN_CONFLICTS, { bookId }));
    openConflicts(bookId);
  };
  // The file view, from either way in (workflow 14 §The view): *Files in
  // {book}* on the book's detail (no path) and a song's *Show the file* (its
  // path).
  const openFiles = (bookId, path = null) => setOpenFile({ bookId, path });
  // A book pressed on the Books tab opens its songs: search scoped to it, at
  // `…/b/<book>`, a pushed step so Back returns to Books (workflow 7 L28-34).
  // A book that needs you is engaged as it opens, as pressing it always did
  // (OPEN_CONFLICTS; workflow 9 §Meeting one), so its bar counts the songs that
  // wait on the person; its panel opens only from *Settle*.
  const openBookSongs = (bookId) => {
    setForkLanding(null);
    if (sync?.[bookId]?.phase === 'needs_you' && conflictsBook !== bookId) {
      store.send(command(CommandKind.OPEN_CONFLICTS, { bookId }));
    }
    pushNext();
    setSelected('search');
    setScope({ bookId });
  };
  // The bar's acts on a book's songs (books.row_opens_songs).
  const bookActs = {
    onManage: (bookId) => setBookDetail({ bookId }),
    onSettle: engageConflicts,
    onNeedsYou: engageConflicts,
    forkLanding,
  };
  // The book left the shelf from its detail (removed, left or deleted): there
  // are no songs to return to, so the shelf shows (workflow 7 L94-95).
  const leaveGoneBook = () => {
    setBookDetail(null);
    setScope(null);
    setSelected('books');
  };

  // A device used before signing in, with songs in its own *My songs*, whose
  // account has one online too (account.new_device; workflow 13 §A device used
  // before signing in; W13 board frame 3): the choice to merge or keep both, a
  // full screen over the shell. *Later* puts it away until the next start. A
  // merge that collides hands the account's *My songs* to the conflict panel.
  if (mySongsChoice?.offered && !mySongsLater) {
    return framed(
        <MySongsChoice
          store={store}
          choice={mySongsChoice}
          onClose={() => setMySongsLater(true)}
          onNeedsYou={(bookId) => {
            setMySongsLater(true);
            store.send(command(CommandKind.OPEN_CONFLICTS, { bookId }));
            openConflicts(bookId);
          }}
        />,
    );
  }

  // The upload preview takes the whole screen (books.add_book_chooser Decision
  // 5): it is the thing being previewed, not yet a book on the shelf. Cancel and
  // a finished import return to the Books destination behind it; a colliding
  // merge opens the book's conflict surface through `engageConflicts` (books.upload_ui
  // Decision 2).
  if (upload) {
    return framed(
        <UploadPreview
          store={store}
          bytes={upload.bytes}
          fileName={upload.fileName}
          onClose={() => setUpload(null)}
          onNeedsYou={(bookId) => {
            setUpload(null);
            engageConflicts(bookId);
          }}
        />,
    );
  }

  const openInstruments = () => setInstrumentsOpen(true);
  // The cold row's *Sign in or make an account*, only while no one is signed in
  // (workflow 1 §Cold).
  const offerSignIn = offersFirstRunSignIn(accountStatus);
  // A destination tab pressed under an open setlist (the phone) leaves it: a tab
  // switch plus a close, so the entry is replaced (routing Decision 4;
  // books.setlist_chrome Decision 4). So does a rail tab beside the paused book
  // panel (a tablet or a computer), through the panel's own close
  // (sync.conflicts_polish constraint 5).
  const selectTab = (key) => {
    setForkLanding(null);
    if (openSetlist) setOpenSetlist(null);
    if (conflictsBook) closers.conflicts();
    setSelected(key);
  };
  const search = {
    query: searchQuery,
    onQueryChange: setSearchQuery,
    onExploreChord: (_chord, typedQuery) => setExploring({ text: typedQuery ?? searchQuery }),
    scope,
    onScopeChange: setScope,
  };

  // The shell itself: the destinations under their tab bar (phone) or beside the
  // rail (tablet, computer). `booksView` takes the Books panel's place — the
  // paused book panel on a wide layout (sync.conflicts_polish constraint 5;
  // W09#4) — as `setlistView` takes the Setlists panel's on the phone.
  const renderShell = ({ booksView = null, setlistView = null, sharingScreen = null } = {}) => (
    <>
      <Tabs
        className={sharingScreen ? 'shell shell-covered' : 'shell'}
        hidden={sharingScreen ? true : undefined}
        orientation={mode === 'wide' ? 'vertical' : 'horizontal'}
        selectedKey={selected}
        onSelectionChange={selectTab}
      >
        {mode === 'wide' ? (
          <div className="split">
            <div className="pane side">
              {/* The side header (shell.header_chrome; W01/W02 computer): the
                  wordmark, the instrument chip — the one shared piece of shell
                  chrome (music.instruments Decision 1) — and the account
                  affordance (account.account_screen). */}
              <HeaderChrome
                store={store}
                className="side-head"
                onInstruments={openInstruments}
                onAccount={() => setAccount(true)}
              />
              <TabList className="rail" aria-label={t('shell.nav')}>
                {DESTINATIONS.map((key) => destinationTab(key, 'rail'))}
              </TabList>
            </div>
            {/* Busy while an address resolves (shell.routing): what it names
                opens over this destination once the device says it is here. */}
            <main className="pane main" aria-busy={resolving ? true : undefined}>
              {banner}
              <div className="scroll">
                {destinationPanels(store, setSelected, startNewSong, openBookSongs, setOpenSong, () => setSignIn({}), openByLink, openSetlistOnTab, setAddingToSetlist, search, restore, null, bookActs, signInMine, setUpload, booksView, offerSignIn)}
              </div>
            </main>
          </div>
        ) : (
          <div className="screen">
            {/* The phone's header row above every destination
                (shell.header_chrome; W01/W02 phone 1): wordmark, chip, account;
                `order: -1` keeps it above the scrolling detail. Not over an
                open setlist, whose own app bar is the first row (W12 phone #1). */}
            {setlistView ? null : (
              <HeaderChrome
                store={store}
                className="instr-top"
                onInstruments={openInstruments}
                onAccount={() => setAccount(true)}
              />
            )}
            {banner}
            {/* The TabList renders before the TabPanels so RAC can register the
                tab ids the panels reference (react-aria tabs link panel↔tab by a
                shared base id set when the list mounts); the tab bar is placed
                back at the foot of the screen with `order` in shell.css. */}
            <TabList className="tabbar" aria-label={t('shell.nav')}>
              {DESTINATIONS.map((key) => destinationTab(key, 'tab'))}
            </TabList>
            <main className={setlistView ? 'scroll scroll-setlist' : 'scroll'} aria-busy={resolving ? true : undefined}>
              {destinationPanels(store, setSelected, startNewSong, openBookSongs, setOpenSong, () => setSignIn({}), openByLink, openSetlistOnTab, setAddingToSetlist, search, restore, setlistView, bookActs, signInMine, setUpload, null, offerSignIn)}
            </main>
          </div>
        )}
      </Tabs>
      {sharingScreen ? banner : null}
      {sharingScreen}
      <InstrumentsOverlay
        store={store}
        isOpen={instrumentsOpen}
        onClose={() => setInstrumentsOpen(false)}
      />
      {addingToSetlist ? (
        <AddToSetlist
          store={store}
          song={addingToSetlist}
          onClose={() => setAddingToSetlist(null)}
        />
      ) : null}
      {/* A book's Share on a phone (books.share_people; W10 #1): the sheet over
          the shell, leading to the people and New invitation screens. */}
      {shareSheet ? (
        <ShareSheet
          bookId={shareSheet.bookId}
          title={sharingFacts(shareSheet.bookId).title}
          role={sharingFacts(shareSheet.bookId).role}
          onClose={() => setShareSheet(null)}
          onOpenPeople={() => openPeopleFrom(shareSheet.bookId)}
          onNewInvitation={() => {
            setShareSheet(null);
            setNewInvitation({ bookId: shareSheet.bookId });
          }}
        />
      ) : null}
      {/* A refused invitation link (books.invited_presentation; workflow 1
          §Invited; W01 #4): an alert dialog over the person's shelf — the empty
          front door for a fresh account — and dismissing it leaves them there. */}
      {invited?.phase === 'refused' ? (
        <InvitedRefusal
          reason={invited.reason}
          onAddByLink={() => {
            setInvited(null);
            setSelected('books');
          }}
          onClose={() => setInvited(null)}
        />
      ) : null}
    </>
  );

  // The per-song conflict resolver (sync.conflicts, workflow 9 §Settling one): a
  // full screen over the paused panel, raised by its *Settle*. Checked first so
  // it sits over the panel; Back returns to it.
  if (songConflict) {
    return framed(
        <SongConflict
          store={store}
          bookId={songConflict.bookId}
          path={songConflict.path}
          onClose={() => back(closers.songConflict)}
        />,
    );
  }

  // The book-level paused panel (sync.conflicts, workflow 9 §The rest) for a
  // book with an in-progress merge. On a phone, a full screen over the shell; on
  // a tablet or a computer, the Books destination's content in the main pane,
  // the header chrome and the rail beside it — "the book needs you; the rest of
  // it carries on" (sync.conflicts_polish constraint 5; W09#4 L184-205).
  // *Settle* opens the per-song resolver above; Back returns to the shell.
  if (conflictsBook) {
    const entry = orderedBooks(shelf).find((e) => e.id === conflictsBook);
    const panel = (
      <BookConflicts
        store={store}
        bookId={conflictsBook}
        title={titleFor(entry?.book ?? {}, t('books.untitled'))}
        embedded={mode === 'wide'}
        onSettle={(path) => setSongConflict({ bookId: conflictsBook, path })}
        onClose={() => back(closers.conflicts)}
      />
    );
    return mode === 'wide' ? renderShell({ booksView: panel }) : framed(panel);
  }

  // A song's history is a full screen over whatever opened it (songs.history),
  // checked before the editor hosts and the reading view so it sits over the
  // surface that raised it — Back returns there (the reading view, the file-view
  // raw editor, or the new-song host). Both the reading view's merge notice and
  // History button (sync.read_in_place) and the editor's merge notice
  // (songs.edit_in_place) reach it through `onOpenHistory`.
  if (history) {
    return framed(
      <>
        <SongHistory
          store={store}
          bookId={history.bookId}
          path={history.path}
          // The book's shelf name (via titleFor), never its id (songs.no_raw_ids
          // Constraint 4).
          bookLabel={saveTargetFor(shelf, history.bookId, t('books.untitled')).label}
          onBack={() => back(closers.history)}
          onRestored={() => setRestoredSaveOpen(true)}
        />
        <SaveSheet
          store={store}
          isOpen={restoredSaveOpen}
          onClose={() => setRestoredSaveOpen(false)}
          bookId={history.bookId}
          paths={[history.path]}
          bookLabel={saveTargetFor(shelf, history.bookId, t('books.untitled')).label}
          canSave={saveTargetFor(shelf, history.bookId, t('books.untitled')).canSave}
        />
      </>,
    );
  }

  // A book's sharing screens (books.share_people; workflow 10 **Where it
  // sits**): the New invitation screen (the phone's, W10 #2) over the people
  // screen (W10 #3, #5, #6), each a full screen with Back through `closers`.
  // Over the open song (a song's share led there) it replaces the reading view;
  // over the shell it is drawn below with the shell kept, hidden, so Back
  // returns to the book that was open.
  let sharingScreen = null;
  if (newInvitation) {
    sharingScreen = (
      <NewInvitationScreen
        bookId={newInvitation.bookId}
        title={sharingFacts(newInvitation.bookId).title}
        onBack={() => back(closers.newInvitation)}
      />
    );
  } else if (people) {
    const facts = sharingFacts(people.bookId);
    sharingScreen = (
      <PeopleScreen
        bookId={people.bookId}
        title={facts.title}
        role={facts.role}
        ownerName={facts.ownerName}
        mode={mode}
        onBack={() => back(closers.people)}
        onNewInvitation={() => setNewInvitation({ bookId: people.bookId })}
        autoFocusTitle={shareReturn === 'people'}
        onTitleFocusReturned={() => setShareReturn(null)}
      />
    );
  }
  // Over an open setlist too (books.setlist_invitation Constraint 6): the
  // setlist's Manage leads here, and Back returns to the setlist.
  if (sharingScreen && (openSong || openSetlist || bookDetail)) return framed(sharingScreen);

  // The file view is a full screen over the shell (books.file_view Decision 7),
  // exactly as the new-song editor host is; Back returns to the shell.
  if (openFile) {
    return framed(
        <FileView
          store={store}
          bookId={openFile.bookId}
          initialPath={openFile.path}
          mode={mode}
          onBack={() => back(closers.files)}
          onOpenHistory={setHistory}
        />,
    );
  }

  // A book's detail (books.row_opens_songs; workflow 7 L86-95): a layer over the
  // book's songs. On a computer it takes the main pane beside them, as a song
  // does (SongReading's split); below that it is a full screen with *Back to
  // {book}*. Files opens over it (above), and its Back returns here; Back from
  // the detail returns to the book's songs.
  if (bookDetail) {
    const detailEntry = orderedBooks(shelf).find((e) => e.id === bookDetail.bookId);
    const detail = (
      <BookDetail
        store={store}
        bookId={bookDetail.bookId}
        kind={detailEntry?.kind}
        onBack={() => back(closers.bookDetail)}
        onGone={leaveGoneBook}
        onShare={shareBook}
        onFiles={(bookId) => openFiles(bookId)}
        onReselect={(bookId) => setBookDetail({ bookId })}
        autoFocusShare={shareReturn === 'book'}
        onShareFocusReturned={() => setShareReturn(null)}
      />
    );
    // A book's Share on a phone: the sheet over the detail.
    const shareOverlay = shareSheet ? (
      <ShareSheet
        bookId={shareSheet.bookId}
        title={sharingFacts(shareSheet.bookId).title}
        role={sharingFacts(shareSheet.bookId).role}
        onClose={() => setShareSheet(null)}
        onOpenPeople={() => openPeopleFrom(shareSheet.bookId)}
        onNewInvitation={() => {
          setShareSheet(null);
          setNewInvitation({ bookId: shareSheet.bookId });
        }}
      />
    ) : null;
    if (computer) {
      return framed(
        <>
          <div className="split book-detail-split">
            <div className="pane side">
              <HeaderChrome store={store} className="rail-head" onInstruments={openInstruments} />
              <SearchScreen
                store={store}
                onOpenSong={(song) => {
                  setBookDetail(null);
                  setOpenSong(song);
                }}
                onWriteSong={startNewSong}
                query={searchQuery}
                onQueryChange={setSearchQuery}
                scope={scope}
                onScopeChange={setScope}
                onManageBook={bookActs.onManage}
                onSettleBook={bookActs.onSettle}
                onNeedsYou={bookActs.onNeedsYou}
              />
            </div>
            <div className="pane main">{detail}</div>
          </div>
          <InstrumentsOverlay store={store} isOpen={instrumentsOpen} onClose={() => setInstrumentsOpen(false)} />
        </>,
      );
    }
    return framed(
      <>
        <div className="book-detail-layer">{detail}</div>
        {shareOverlay}
      </>,
    );
  }

  // While a new song is open and its book/path are known, the host is a full
  // screen over the shell (W03 board: a Back affordance on every viewport, the
  // editor's own text/preview split as the wide layout).
  if (editing?.bookId && editing?.path) {
    return framed(
        <NewSongHost
          store={store}
          editing={editing}
          mode={mode}
          onBack={exitEditing}
          onChangeBook={changeBook}
          onOpenHistory={setHistory}
          editorRef={editorRef}
        />,
    );
  }

  // Editing an existing song (workflow 4): a full screen over the reading view;
  // Back and a save return to it (the unsaved edit stays in the working copy).
  if (editingSong) {
    return framed(
        <EditSongHost
          store={store}
          editing={editingSong}
          mode={mode}
          onBack={() => back(closers.editor)}
          onOpenHistory={setHistory}
          onEdit={({ bookId, path, title }) => setEditingSong({ bookId, path, songTitle: title ?? '' })}
          editorRef={editorRef}
        />,
    );
  }

  // The voicing wizard (songs.wizard_ui): the action behind arrange's **Run the
  // wizard** affordance, a surface mounted over arrange. Checked before
  // `arranging` so it sits over it; **Back** / **Write the plan** close it and
  // flag arrange to send focus back to its Run-the-wizard button as it re-mounts.
  if (wizard) {
    return framed(
        <SongWizard
          store={store}
          bookId={wizard.bookId}
          path={wizard.path}
          mode={mode}
          onBack={() => back(closers.wizard)}
          onDone={() => {
            // The computer split's **Done** keeps arrange's meaning: back to
            // reading, leaving the wizard and arrange together (songs.arrange_polish
            // Decision 8; nothing was written — the plan lives in memory). The
            // wizard's entry is stepped back as its Back does; arrange closes at
            // once, so the entry back lands on is the reading view's and the
            // history hook steps over it.
            back(closers.wizard);
            setArranging(null);
            setWizardReturn(false);
          }}
        />,
    );
  }

  // Arranging a song (songs.arrange): the mode entered from the reading view's
  // `onArrange` seam, a full screen over the open song. **Done** returns to
  // reading (the working copy's unsaved edit stays). Checked before `openSong`
  // so it sits over the reading view that raised it. *Run the wizard* opens the
  // wizard surface above (songs.wizard_ui); on its close arrange re-mounts and
  // `autoFocusWizard` returns focus to the button that opened it.
  if (arranging) {
    return framed(
        <SongArrange
          store={store}
          bookId={arranging.bookId}
          path={arranging.path}
          mode={mode}
          onBack={() => back(closers.arrange)}
          onRunWizard={(args) => setWizard(args)}
          autoFocusWizard={wizardReturn}
          onWizardFocusReturned={() => setWizardReturn(false)}
        />,
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
    // A song's share (books.share_people): a panel beside the chart on a tablet
    // or a computer, the Share sheet on a phone — drawn by the reading view,
    // which knows the song's title. The book's role/title come from the shelf,
    // so the owner sees the invite and a member the song's address. A song in a
    // book only on this device offers Put online instead, or signing in first —
    // the SignIn surface's onDone comes back to this same surface
    // (books.share_needs_online Constraint 4).
    const shareFacts = sharing ? sharingFacts(sharing.bookId) : null;
    const songShare = sharing
      ? ({ title: songTitle }) =>
          mode === 'wide' ? (
            <SongSharePanel
              store={store}
              bookId={sharing.bookId}
              title={shareFacts.title}
              role={shareFacts.role}
              isLocal={shareFacts.isLocal}
              accountStatus={accountStatus.status}
              onSignIn={() => setSignIn({})}
              songPath={sharing.path}
              songTitle={songTitle}
              onClose={() => setSharing(null)}
              onManage={() => openPeopleFrom(sharing.bookId)}
            />
          ) : (
            <ShareSheet
              store={store}
              bookId={sharing.bookId}
              title={shareFacts.title}
              role={shareFacts.role}
              isLocal={shareFacts.isLocal}
              accountStatus={accountStatus.status}
              onSignIn={() => setSignIn({})}
              songPath={sharing.path}
              songTitle={songTitle}
              onClose={() => setSharing(null)}
              onOpenPeople={() => openPeopleFrom(sharing.bookId)}
            />
          )
      : null;
    return framed(
      <>
        <SongReading
          store={store}
          bookId={openSong.bookId}
          path={openSong.path}
          mode={mode}
          onBack={() => back(() => setOpenSong(null))}
          onOpenSong={setOpenSong}
          onEdit={({ bookId, path, title }) => setEditingSong({ bookId, path, songTitle: title ?? '' })}
          onArrange={setArranging}
          onOpenHistory={setHistory}
          onShare={setSharing}
          onShowFile={({ bookId, path }) => openFiles(bookId, path)}
          onAddToSetlist={setAddingToSetlist}
          sidePanel={songShare}
          onFullScreenChange={setReadingFull}
        />
        {addingToSetlist ? (
          <AddToSetlist
            store={store}
            song={addingToSetlist}
            onClose={() => setAddingToSetlist(null)}
          />
        ) : null}
      </>,
      { withBanner: !readingFull },
    );
  }

  // The setlist player (books.play, workflow 12 §Playing through): a chrome-free
  // full-screen performance surface over the opened setlist. Stop returns to the
  // setlist (still behind it).
  if (playingSetlist) {
    return (
      <SetlistPlay
        store={store}
        bookId={playingSetlist.bookId}
        path={playingSetlist.path}
        mode={mode}
        onStop={() => back(closers.play)}
      />
    );
  }

  // The opened setlist (books.setlists, workflow 12). Play (books.play) enters
  // the player above; Back returns to where it was opened from. On tablet and
  // computer it is a full-screen surface over the master-detail, no rail beside
  // it (W12 #3, #4); on the phone it sits in the Setlists tab panel with the tab
  // bar below it and no header row above (books.setlist_chrome; W12 phone #1;
  // header_chrome Decision 8).
  // Its Share (books.setlist_invitation) is the song's surfaces in setlist
  // mode, built like the song's share above.
  const setlistShareFacts = sharingSetlist ? sharingFacts(sharingSetlist.bookId) : null;
  const setlistShare = sharingSetlist
    ? ({ title: setlistTitle }) =>
        mode === 'wide' ? (
          <SongSharePanel
            store={store}
            bookId={sharingSetlist.bookId}
            title={setlistShareFacts.title}
            role={setlistShareFacts.role}
            isLocal={setlistShareFacts.isLocal}
            accountStatus={accountStatus.status}
            onSignIn={() => setSignIn({})}
            itemKind="setlist"
            songPath={sharingSetlist.path}
            songTitle={setlistTitle}
            onClose={() => setSharingSetlist(null)}
            onManage={() => openPeopleFrom(sharingSetlist.bookId)}
          />
        ) : (
          <ShareSheet
            store={store}
            bookId={sharingSetlist.bookId}
            title={setlistShareFacts.title}
            role={setlistShareFacts.role}
            isLocal={setlistShareFacts.isLocal}
            accountStatus={accountStatus.status}
            onSignIn={() => setSignIn({})}
            itemKind="setlist"
            songPath={sharingSetlist.path}
            songTitle={setlistTitle}
            onClose={() => setSharingSetlist(null)}
            onOpenPeople={() => openPeopleFrom(sharingSetlist.bookId)}
          />
        )
    : null;
  const setlistView = openSetlist ? (
    <SetlistView
      store={store}
      bookId={openSetlist.bookId}
      path={openSetlist.path}
      mode={mode}
      onBack={() => back(() => setOpenSetlist(null))}
      onPlay={({ bookId, path }) => setPlayingSetlist({ bookId, path })}
      onShare={setSharingSetlist}
      sidePanel={setlistShare}
    />
  ) : null;
  if (setlistView && mode === 'wide') return framed(setlistView);

  // The chord explorer (music.explorer, workflow 16): a full screen over the
  // shell, reached from search's chord row, carrying the typed symbol. Back
  // returns to search with the query still typed (it is lifted above).
  if (exploring) {
    return framed(
        <ChordExplorer
          store={store}
          initialText={exploring.text}
          mode={mode}
          onBack={() => back(closers.explorer)}
          onTextChange={setSearchQuery}
        />,
    );
  }

  return renderShell({ setlistView, sharingScreen });
}

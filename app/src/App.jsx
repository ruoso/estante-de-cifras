import { useEffect, useState } from 'react';
import './theme/theme.css';
import ThemeRoot from './theme/ThemeRoot.jsx';
import LocaleRoot from './i18n/LocaleRoot.jsx';
import AppShell from './shell/AppShell.jsx';
import ChartGallery from './chart/gallery/ChartGallery.jsx';
import EditorDev from './editor/EditorDev.jsx';
import HistoryDev from './songs/HistoryDev.jsx';
import ReadingDev from './songs/ReadingDev.jsx';
import ArrangeDev from './songs/ArrangeDev.jsx';
import WizardDev from './songs/WizardDev.jsx';
import FilesDev from './files/FilesDev.jsx';
import SetlistsDev from './books/SetlistsDev.jsx';
import UpdateReady from './pwa/UpdateReady.jsx';
import { signInToken } from './account/sign-in-route.js';
import { recoveryEmailToken } from './account/recovery-email-route.js';
import { invitationToken } from './account/invitation-route.js';
import { bookSongRoute, songAnchorFromHash } from './books/book-route.js';
import { getAppStore } from './worker/store.js';

// The chart's dev gallery is reachable only at `#dev/chart` — absent from the
// tab bar and from normal navigation, it is the e2e-web mount point for the
// chart before any song screen exists (shell.chart). Read once at render: the
// e2e spec navigates straight to the hash URL, so no live hashchange listener
// is needed for a dev-only mount.
function isChartGallery() {
  return typeof location !== 'undefined' && location.hash.startsWith('#dev/chart');
}

// The source editor's dev mount, `#dev/editor` — mirroring `#dev/chart`. The
// editor's real entry points (songs.reading's edit, songs.new_song, the file
// view) are other tasks and none is a dependency here, so — exactly as the
// chart shipped behind `#dev/chart` before a song screen existed — the editor
// stands up behind `#dev/editor` so its behaviour and e2e run now (Decision 6).
function isEditorDev() {
  return typeof location !== 'undefined' && location.hash.startsWith('#dev/editor');
}

// The history surface's dev mount, `#dev/history` — mirroring `#dev/editor`
// (songs.history Decision 5). Its real entry point is songs.reading's toolbar,
// a sibling task that is not a dependency; until it wires the `onOpenHistory`
// seam, history stands up behind this hash so its behaviour and e2e run now.
function isHistoryDev() {
  return typeof location !== 'undefined' && location.hash.startsWith('#dev/history');
}

// The reading view's dev mount, `#dev/reading` — mirroring `#dev/history`
// (songs.reading Decision 5). Its real entry point is a search result tapped in
// AppShell (wired in this task); the dev mount stands the surface up at
// `#dev/reading?book=…&path=…` so its behaviour and e2e run on every viewport.
function isReadingDev() {
  return typeof location !== 'undefined' && location.hash.startsWith('#dev/reading');
}

// The arrange surface's dev mount, `#dev/arrange` — mirroring `#dev/reading`
// (songs.arrange Decision 1). Its real entry is the reading view's `onArrange`
// seam (wired here in AppShell); the dev mount stands the surface up at
// `#dev/arrange?book=…&path=…` so its behavior and e2e run on every viewport.
function isArrangeDev() {
  return typeof location !== 'undefined' && location.hash.startsWith('#dev/arrange');
}

// The wizard surface's dev mount, `#dev/wizard` — mirroring `#dev/arrange`
// (songs.wizard_ui Decision 1). Its real entry is arrange's `onRunWizard` seam
// (wired here in AppShell); the dev mount stands the surface up at
// `#dev/wizard?book=…&path=…` so its behavior and e2e run on every viewport.
function isWizardDev() {
  return typeof location !== 'undefined' && location.hash.startsWith('#dev/wizard');
}

// The file view's dev mount, `#dev/files` — mirroring `#dev/history`
// (books.file_view Decision 7). Its real entry is the book-management screen's
// per-book Files control (wired here in AppShell); the dev mount stands the
// surface up at `#dev/files?book=…` so its e2e journey runs now.
function isFilesDev() {
  return typeof location !== 'undefined' && location.hash.startsWith('#dev/files');
}

// The setlist surface's dev mount, `#dev/setlists` — mirroring `#dev/files`
// (books.setlists Decision 3). Its real entry is the Setlists destination tap
// (wired here in AppShell); the dev mount stands the surface up at
// `#dev/setlists?book=…&path=…` so its behavior and e2e run on every viewport.
function isSetlistsDev() {
  return typeof location !== 'undefined' && location.hash.startsWith('#dev/setlists');
}

// The dev mounts (`#dev/chart`, `#dev/editor`) are chosen from the hash. There
// is no router — navigation is view state (songs.editor Decision 5) — but a
// test, or a user, can reach a dev mount by changing the hash within a live
// session: the editor's e2e seeds a book at `/` first, then navigates to
// `#dev/editor?book=…&path=…`, which is a same-document change that does NOT
// reload. Re-render on `hashchange` so the mount switches live — the way the
// real in-app entry points (songs.reading's edit, the file view) switch into
// the editor without a page reload — instead of only reading the hash on the
// first render.
function useHashRoute() {
  const [, setHash] = useState(() => (typeof location === 'undefined' ? '' : location.hash));
  useEffect(() => {
    const onHashChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
}

// The emailed sign-in link boots the app at `/sign-in/<token>` — a path, not a
// hash (account.sign_in Decision 4; the service mails a path). Read it once at
// boot, beside the `#dev/*` hash mounts; AppShell opens the sign-in surface in
// redeem mode when a token is present. Pure parse in `signInToken`.
function bootRedeemToken() {
  return typeof location === 'undefined' ? null : signInToken(location.pathname);
}

// The recovery email's verification link boots the app at
// `/recovery-email/<token>` — a path, like the sign-in link (account.
// recovery_email; workflow 13 §Confirming it). Read it once at boot; AppShell
// opens the confirm page, which needs no session. Pure parse in
// `recoveryEmailToken`.
function bootRecoveryEmailToken() {
  return typeof location === 'undefined' ? null : recoveryEmailToken(location.pathname);
}

// An invitation boots the app at `/i/<token>` — a path, not a hash
// (books.add_by_link, workflow 1 §Invited; the service mails/links a path). Read
// it once at boot, beside the redeem token; AppShell opens the invited flow (try
// accept → account-first prompt → clone) when a token is present. Pure parse in
// `invitationToken`.
function bootInvitationToken() {
  return typeof location === 'undefined' ? null : invitationToken(location.pathname);
}

// A song's plain address boots the app at `/b/<bookId>/<path>` — a member's deep
// link into a book they already hold (books.share, workflow 10 L95-96; Decision
// 2). Read once at boot, beside the invitation token; AppShell seeds the open
// song. Pure parse in `bookSongRoute`.
function bootBookSong() {
  return typeof location === 'undefined' ? null : bookSongRoute(location.pathname);
}

// An invitation link may carry the shared song as a client-only `#<path>`
// fragment (books.share Decision 2). It is meaningful only alongside an
// invitation link, and the URL is cleaned at boot (dropping the fragment), so it
// is captured here once; AppShell opens that song on BOOK_CLONED.
function bootInviteSongAnchor() {
  if (typeof location === 'undefined') return null;
  return invitationToken(location.pathname) ? songAnchorFromHash(location.hash) : null;
}

// The app root: the resolved visual-language root (ThemeRoot, shell.tokens)
// wrapping the navigation shell (AppShell, shell.layout) — the frame Search,
// Books and Setlists are drawn inside (DIRECTION §4 lines 430-435; §3.7 lines
// 404-405). ThemeRoot reads the `preferences` slice from the store; the shell
// below it holds its navigation location in the view, not the store (navigation
// is view state, not Worker data — DIRECTION §3.7 lines 407-414). The view is
// the only layer that knows React.
//
// LocaleRoot (shell.i18n) sits inside ThemeRoot, reading the same `preferences`
// slice: it makes the shell below it speak the chosen (or browser's) language,
// sets <html lang>, and remounts its subtree when the language changes so every
// t() re-reads. ThemeRoot's own `.est` root stays put across that remount.
export default function App({ store = getAppStore() }) {
  useHashRoute();

  // Bring the Worker up once the app is on screen (store.js `open()`): it opens
  // the database, reports READY, and surfaces the home book's preferences, shelf
  // and instrument roster plus the device recents — what ThemeRoot, LocaleRoot,
  // the header instrument chip and the save sheet's kept name read. It lives at
  // the root, not in AppShell, so every mount the page can boot into sends it —
  // the shell and each `#dev/*` mount alike (a reload straight into a dev mount
  // would otherwise leave `preferences` empty) — and it sits above LocaleRoot,
  // whose language-change remount therefore does not re-open (shell.dev_mount_open).
  // Depends on the store only, so a hashchange re-render sends nothing more.
  // Idempotent in the Worker (`ensureOpen`/`ensureIndexHydrated` are memoised)
  // and the store is a singleton, so StrictMode's dev-only double-invoke is
  // harmless; the inert no-op store (jsdom) has `open()` too.
  useEffect(() => {
    store.open?.();
  }, [store]);

  // Capture the redeem token once at mount and clean the URL to `/` with
  // history.replaceState, so the single-use token does not linger in history or
  // a share (Decision 4). The surface runs the redeem; AppShell receives the
  // token and opens the surface in redeem mode.
  const [redeemToken] = useState(bootRedeemToken);
  // The recovery email's confirm token, captured and the URL cleaned the same
  // way, so the single-use link does not linger in history or a share.
  const [recoveryToken] = useState(bootRecoveryEmailToken);
  // The invitation token, captured once at mount and the URL cleaned to `/` the
  // same way — so the single-use-ish link does not linger in history or a share,
  // and a reload does not re-run the invited flow. AppShell runs the flow.
  const [inviteToken] = useState(bootInvitationToken);
  // A member's `/b/<bookId>/<path>` deep link and an invitation's `#<path>` song
  // fragment, each captured once and the URL cleaned to `/` the same way.
  const [bookSong] = useState(bootBookSong);
  const [inviteSongAnchor] = useState(bootInviteSongAnchor);
  useEffect(() => {
    if ((redeemToken || recoveryToken || inviteToken || bookSong) && typeof history !== 'undefined') {
      history.replaceState(null, '', '/');
    }
  }, [redeemToken, recoveryToken, inviteToken, bookSong]);

  return (
    <ThemeRoot store={store}>
      <LocaleRoot store={store}>
        {isChartGallery() ? (
          <ChartGallery />
        ) : isEditorDev() ? (
          <EditorDev store={store} />
        ) : isHistoryDev() ? (
          <HistoryDev store={store} />
        ) : isReadingDev() ? (
          <ReadingDev store={store} />
        ) : isArrangeDev() ? (
          <ArrangeDev store={store} />
        ) : isWizardDev() ? (
          <WizardDev store={store} />
        ) : isFilesDev() ? (
          <FilesDev store={store} />
        ) : isSetlistsDev() ? (
          <SetlistsDev store={store} />
        ) : (
          <AppShell
            store={store}
            redeemToken={redeemToken}
            recoveryToken={recoveryToken}
            inviteToken={inviteToken}
            bookSong={bookSong}
            inviteSongAnchor={inviteSongAnchor}
          />
        )}
        {/* The PWA update notice (shell.pwa) sits over the shell, inside the
            token root and the locale boundary so it is themed and translated; it
            renders nothing until a new version is waiting. */}
        <UpdateReady />
      </LocaleRoot>
    </ThemeRoot>
  );
}

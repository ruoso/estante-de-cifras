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
import FilesDev from './files/FilesDev.jsx';
import UpdateReady from './pwa/UpdateReady.jsx';
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

// The file view's dev mount, `#dev/files` — mirroring `#dev/history`
// (books.file_view Decision 7). Its real entry is the book-management screen's
// per-book Files control (wired here in AppShell); the dev mount stands the
// surface up at `#dev/files?book=…` so its e2e journey runs now.
function isFilesDev() {
  return typeof location !== 'undefined' && location.hash.startsWith('#dev/files');
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
        ) : isFilesDev() ? (
          <FilesDev store={store} />
        ) : (
          <AppShell store={store} />
        )}
        {/* The PWA update notice (shell.pwa) sits over the shell, inside the
            token root and the locale boundary so it is themed and translated; it
            renders nothing until a new version is waiting. */}
        <UpdateReady />
      </LocaleRoot>
    </ThemeRoot>
  );
}

import './theme/theme.css';
import ThemeRoot from './theme/ThemeRoot.jsx';
import LocaleRoot from './i18n/LocaleRoot.jsx';
import AppShell from './shell/AppShell.jsx';
import ChartGallery from './chart/gallery/ChartGallery.jsx';
import { getAppStore } from './worker/store.js';

// The chart's dev gallery is reachable only at `#dev/chart` — absent from the
// tab bar and from normal navigation, it is the e2e-web mount point for the
// chart before any song screen exists (shell.chart). Read once at render: the
// e2e spec navigates straight to the hash URL, so no live hashchange listener
// is needed for a dev-only mount.
function isChartGallery() {
  return typeof location !== 'undefined' && location.hash.startsWith('#dev/chart');
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
  return (
    <ThemeRoot store={store}>
      <LocaleRoot store={store}>{isChartGallery() ? <ChartGallery /> : <AppShell store={store} />}</LocaleRoot>
    </ThemeRoot>
  );
}

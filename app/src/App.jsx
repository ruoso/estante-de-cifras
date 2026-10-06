import './theme/theme.css';
import ThemeRoot from './theme/ThemeRoot.jsx';
import AppShell from './shell/AppShell.jsx';
import { getAppStore } from './worker/store.js';

// The app root: the resolved visual-language root (ThemeRoot, shell.tokens)
// wrapping the navigation shell (AppShell, shell.layout) — the frame Search,
// Books and Setlists are drawn inside (DIRECTION §4 lines 430-435; §3.7 lines
// 404-405). ThemeRoot reads the `preferences` slice from the store; the shell
// below it holds its navigation location in the view, not the store (navigation
// is view state, not Worker data — DIRECTION §3.7 lines 407-414). The view is
// the only layer that knows React.
export default function App({ store = getAppStore() }) {
  return (
    <ThemeRoot store={store}>
      <AppShell />
    </ThemeRoot>
  );
}

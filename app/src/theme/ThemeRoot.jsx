// The theme root (shell.tokens): the one component that applies the visual
// language to the app root. It reads the chosen theme from the store's
// `preferences` slice (never IndexedDB from the view — DIRECTION §3.7 line 409)
// and follows the device's light/dark mode live, then puts
// `est theme-<applied> density-<density>` on its wrapper so theme.css cascades.
//
// The policy is the pure resolver; this is the only layer here that knows React
// (DIRECTION §3.7 lines 415-417). The device-mode read is a live
// `prefers-color-scheme` subscription through `useSyncExternalStore`, so
// automatic follows each device as it changes (Workflow 1 lines 94-103), never
// a one-time read and never written to the home book.

import { useMemo, useRef, useSyncExternalStore } from 'react';
import { UNSAFE_PortalProvider } from 'react-aria';
import { useSlice } from '../worker/useStore.js';
import {
  resolveTheme,
  resolveDensity,
  resolveDiagramDisplay,
  themeClasses,
} from './resolve.js';
import { DiagramDisplayContext } from './display-context.js';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// The device's dark-mode media query, or null where `matchMedia` is absent
// (jsdom provides none — the behavior test stubs it). A missing query reads as
// light, so the first-run default is Estante.
function darkModeQuery() {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia(DARK_QUERY)
    : null;
}

function subscribeDarkMode(onChange) {
  const query = darkModeQuery();
  if (!query?.addEventListener) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readDarkMode() {
  return darkModeQuery()?.matches ?? false;
}

// Whether the device is currently in dark mode, re-read whenever it changes.
export function usePrefersDark() {
  return useSyncExternalStore(subscribeDarkMode, readDarkMode, readDarkMode);
}

// Apply the resolved theme and density to the app root. `store` carries the
// `preferences` slice; the `density` register picks the density class, and the
// `diagramHanded` / `diagramOrientation` registers become the
// DiagramDisplayContext every ChordDiagram beneath reads (shell.display_preferences).
//
// React Aria Components portals its overlays (ModalOverlay/Modal/Popover/Tooltip)
// to document.body by default — outside this `.est` root, where every design
// token is defined (theme.css, scoped to `.est`), so a portaled overlay would
// render with every `var(--…)` undefined. `UNSAFE_PortalProvider` here gives
// every overlay anywhere beneath ThemeRoot a portal container inside the token
// scope, once, so no screen re-plumbs it (shell.portal_provider; it retires the
// per-screen `UNSAFE_portalContainer` workaround books.shelf carried).
// `getContainer` is a lazy callback invoked at portal time, so the ref on the
// `.est` div is populated by the time any overlay opens; it returns null in a
// bare render with no mounted root, so RAC falls back to document.body — the
// provider is additive, never required.
export default function ThemeRoot({ store, children }) {
  const preferences = useSlice(store, 'preferences');
  const prefersDark = usePrefersDark();
  const applied = resolveTheme(preferences?.theme?.value, prefersDark);
  const density = resolveDensity(preferences?.density?.value);
  const { handed, orientation } = resolveDiagramDisplay(preferences);
  const diagramDisplay = useMemo(() => ({ handed, orientation }), [handed, orientation]);
  const rootRef = useRef(null);
  // `est-frame` marks this wrapper as the one window-height frame (shell.css);
  // themeClasses stays the boards' exact class set, which token-scoped previews
  // (the account screen's theme swatches) also carry without being framed
  // (account.preferences_layout Decision 1).
  return (
    <div ref={rootRef} className={`${themeClasses(applied, density)} est-frame`}>
      <DiagramDisplayContext.Provider value={diagramDisplay}>
        <UNSAFE_PortalProvider getContainer={() => rootRef.current}>
          {children}
        </UNSAFE_PortalProvider>
      </DiagramDisplayContext.Provider>
    </div>
  );
}

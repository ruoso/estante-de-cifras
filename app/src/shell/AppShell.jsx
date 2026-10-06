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

import { useState, useSyncExternalStore } from 'react';
import { Tabs, TabList, Tab, TabPanel } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { DESTINATIONS, WIDE_QUERY, layoutMode } from './layout-mode.js';
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

// The destination regions: each a `TabPanel` (role=tabpanel, named by its tab)
// carrying its heading. A minimal labelled slot — enough to be reached and
// asserted now; the content tasks fill it. RAC mounts only the selected panel,
// so exactly one level-1 heading is present at a time.
function destinationPanels() {
  return DESTINATIONS.map((key) => (
    <TabPanel key={key} id={key}>
      <h1 className="t-h1">{t(`shell.${key}`)}</h1>
    </TabPanel>
  ));
}

export default function AppShell() {
  const mode = useLayoutMode();
  const [selected, setSelected] = useState(DESTINATIONS[0]);

  return (
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
              <span className="t-h1">Estante de Cifras</span>
            </div>
            <TabList className="rail" aria-label={t('shell.nav')}>
              {DESTINATIONS.map((key) => destinationTab(key, 'rail'))}
            </TabList>
          </div>
          <main className="pane main">
            <div className="scroll">{destinationPanels()}</div>
          </main>
        </div>
      ) : (
        <div className="screen">
          {/* The TabList renders before the TabPanels so RAC can register the
              tab ids the panels reference (react-aria tabs link panel↔tab by a
              shared base id set when the list mounts); the tab bar is placed
              back at the foot of the screen with `order` in shell.css. */}
          <TabList className="tabbar" aria-label={t('shell.nav')}>
            {DESTINATIONS.map((key) => destinationTab(key, 'tab'))}
          </TabList>
          <main className="scroll">{destinationPanels()}</main>
        </div>
      )}
    </Tabs>
  );
}

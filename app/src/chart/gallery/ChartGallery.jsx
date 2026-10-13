// The chart's hash-gated dev gallery (shell.chart): a dev-only mount that draws
// written-for-purpose charts in the four marking states — plain, all-defaults,
// a conflicted line and arrange mode — so the e2e-web spec can drive a real
// chart in a browser (overflow and contrast) before any song screen exists (the
// refinement's "a hash-gated dev gallery is the e2e-web mount point" decision).
//
// It is reachable only at `#dev/chart`: App.jsx mounts it there instead of the
// navigation shell, so it is absent from the tab bar and from normal
// navigation, and it inherits the site-wide theme root above it. It uses
// in-memory fixtures — no book, no account, no network and no storage (offline
// first; the chart draws the data handed to it). The labels here are dev copy,
// not routed through i18n, since the gallery never ships to a user.

import Chart from '../Chart.jsx';
import { demoSong, GALLERY_STATES } from './fixtures.js';

export default function ChartGallery() {
  return (
    <main className="scroll" style={{ padding: 'calc(var(--u) * 2)', display: 'flex', flexDirection: 'column', gap: 'calc(var(--u) * 3)' }}>
      <h1 className="t-h1">Chart gallery (dev)</h1>
      {GALLERY_STATES.map((state) => (
        <section key={state.id} style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--u))' }}>
          <h2 className="t-h3">{state.label}</h2>
          {/* Arrange makes every voiced chord a keyboard-reachable React Aria
              Button whose accessible name is the §3 spoken chord name, so the
              e2e-web spec can drive the chart by keyboard with no book or
              account (shell.a11y_chart; the dev-gallery drive needs neither). */}
          <Chart
            model={demoSong}
            markOf={state.markOf}
            onChordPress={state.id === 'arrange' ? () => {} : undefined}
            label={`${demoSong.title} — ${state.label}`}
          />
        </section>
      ))}
    </main>
  );
}

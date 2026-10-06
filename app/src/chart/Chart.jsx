// The chart (shell.chart): a thin React view over the pure `chartRows` layout.
// It renders a parsed cifra.md song model proportionally — a sung line as
// chords stacked over the words they are attached to, a chord-only line as
// measures between bar rules or a run, section names, words lines and stanza
// breaks — in the mockups' chart markup, which theme.css lines 210-229 style
// from the theme tokens (the "adopted chart CSS" the task renders into). The
// visual language, the CSS and the attachment all already exist; this draws
// them (the refinement).
//
// This is a view component, so it is the only layer here that knows React
// (DIRECTION §3.7 lines 415-417): the model→rows geometry is the framework-free
// `layout.js`, and the component takes the already-parsed, plain-object model
// as data — it never imports `cifra-md` or parses, because the Worker owns
// parsing and the model crosses to the view as JSON (DIRECTION §3.7 lines
// 407-414). It authors no colour: every colour comes from the tokens through
// the adopted CSS, so the chart re-themes with no code in it (the chart
// invariant, shared with the diagram).
//
// The chart is not interactive in this task (arrange mode's tap-to-choose is
// the arrange surface's — Workflow 5), so it introduces no React Aria
// Components control; `mark-tap` here is the visual affordance only. Marking is
// a consumer-supplied, line-addressed seam (`markOf`), exactly as the diagram's
// kind is: the chart draws a given state and derives nothing from the model.

import { chartRows } from './layout.js';
import { t } from '../i18n/index.js';

// The marking class a line carries, from the consumer's `markOf(address)` →
// 'def' | 'conf' | 'tap' | null: the adopted `mark-def` (dashed outline),
// `mark-conf` (conflict background) and `mark-tap` (highlight on each chord)
// states (theme.css lines 227-229). No mark, no class — the plain reading chart.
function markClass(markOf, address) {
  const mark = markOf?.(address);
  return mark ? ` mark-${mark}` : '';
}

// One sung segment: the chord in `.c` stacked over its words in `.w`. The DOM
// order is chord-then-words so the reading order is sensible (the designed
// screen-reader order is shell.a11y_chart's). Where the segment splits a word,
// the `.fill` span draws the centred hyphen in the gap (theme.css lines
// 215-219); no split, nothing drawn.
function Segment({ chord, words, hyphen }) {
  return (
    <span className="s">
      <span className="c">{chord}</span>
      <span className="w">
        {words}
        {hyphen ? <span className="fill" /> : null}
      </span>
    </span>
  );
}

function Row({ row, markOf }) {
  switch (row.type) {
    case 'section':
      return <div className="sec-name">{row.name}</div>;
    case 'sung':
      return (
        <div className={`sung${markClass(markOf, row.address)}`}>
          {row.segments.map((segment, i) => (
            <Segment key={i} {...segment} />
          ))}
        </div>
      );
    case 'bars':
      return (
        <div className={`barline${markClass(markOf, row.address)}`}>
          {row.measures.map((cell, i) => (
            <span key={i} className="m">
              {cell}
            </span>
          ))}
        </div>
      );
    case 'run':
      return <div className={`runline${markClass(markOf, row.address)}`}>{row.text}</div>;
    case 'words':
      return <div className={`words${markClass(markOf, row.address)}`}>{row.text}</div>;
    case 'gap':
      return <div className="gap" />;
    default:
      return null;
  }
}

/**
 * @param {object} props
 * @param {object} props.model  the reader's plain-object song model
 * @param {(address: { section: number, part: number, line: number }) =>
 *   ('def'|'conf'|'tap'|null)} [props.markOf]  the line-addressed marking seam;
 *   default: no marking (the plain reading chart)
 * @param {number|string} [props.size]  sets `--chart-size` on the host, for a
 *   bigger chart on a tablet or computer (GUIDE line 97); a number is pixels
 * @param {string} [props.label]  the chart's accessible name; default `Chart`
 * @param {string} [props.className]  extra classes on the host
 */
export default function Chart({ model, markOf, size, label, className }) {
  const rows = chartRows(model);
  // `--chart-size` is a custom property the adopted CSS reads; a number is taken
  // as pixels, a string passed through (e.g. '20px').
  const style = size != null ? { '--chart-size': typeof size === 'number' ? `${size}px` : size } : undefined;
  return (
    <div
      className={`chart${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={label ?? t('chart.label')}
      style={style}
    >
      {rows.map((row, i) => (
        <Row key={i} row={row} markOf={markOf} />
      ))}
    </div>
  );
}

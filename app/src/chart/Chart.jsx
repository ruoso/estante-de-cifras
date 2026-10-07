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
// The chart is non-interactive by default (the plain reading chart introduces
// no control). Its one opt-in interactive seam is `onChordPress` (arrange mode's
// tap-to-choose — Workflow 5 Decision 3): when given, every voiced chord token
// becomes a keyboard-reachable React Aria `Button` carrying its cifra.md
// occurrence path, inside the chart's own `role="group"`. Absent, the chart
// renders exactly as today and introduces no RAC control; `mark-tap` is then the
// visual affordance only. Marking stays a consumer-supplied, line-addressed seam
// (`markOf`), exactly as the diagram's kind is: the chart draws a given state and
// derives nothing from the model.

import { Fragment } from 'react';
import { Button } from 'react-aria-components';
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

// One chord token: plain text in a span (the reading chart), or — when the
// arrange seam is on and the token is a voiced chord — a React Aria `Button`
// that raises `onChordPress(token.address)`. The accessible name comes from
// `chordLabel(token)` so the chart stays decoupled from any one screen's copy.
function ChordToken({ text, token, onChordPress, chordLabel, className }) {
  if (onChordPress && token) {
    return (
      <Button
        className={className}
        aria-label={chordLabel(token)}
        onPress={() => onChordPress(token.address)}
      >
        {text}
      </Button>
    );
  }
  return <span className={className}>{text}</span>;
}

// One sung segment: the chord in `.c` stacked over its words in `.w`. The DOM
// order is chord-then-words so the reading order is sensible (the designed
// screen-reader order is shell.a11y_chart's). Where the segment splits a word,
// the `.fill` span draws the centred hyphen in the gap (theme.css lines
// 215-219); no split, nothing drawn.
function Segment({ segment, onChordPress, chordLabel }) {
  return (
    <span className="s">
      <ChordToken
        text={segment.chord}
        token={segment.token}
        onChordPress={onChordPress}
        chordLabel={chordLabel}
        className={onChordPress && segment.token ? 'c chord-tap' : 'c'}
      />
      <span className="w">
        {segment.words}
        {segment.hyphen ? <span className="fill" /> : null}
      </span>
    </span>
  );
}

// A chord-only measure's cells, interactive: each voiced chord a press target,
// space-separated as the joined string would be.
function InteractiveCells({ cells, onChordPress, chordLabel }) {
  return cells.map((cell, j) => (
    <Fragment key={j}>
      {j > 0 ? ' ' : null}
      <ChordToken
        text={cell.text}
        token={cell.token}
        onChordPress={onChordPress}
        chordLabel={chordLabel}
        className="chord-tap"
      />
    </Fragment>
  ));
}

function Row({ row, markOf, onChordPress, chordLabel }) {
  switch (row.type) {
    case 'section':
      return <div className="sec-name">{row.name}</div>;
    case 'sung':
      return (
        <div className={`sung${markClass(markOf, row.address)}`}>
          {row.segments.map((segment, i) => (
            <Segment key={i} segment={segment} onChordPress={onChordPress} chordLabel={chordLabel} />
          ))}
        </div>
      );
    case 'bars':
      return (
        <div className={`barline${markClass(markOf, row.address)}`}>
          {onChordPress
            ? row.cells.map((cells, i) => (
                <span key={i} className="m">
                  <InteractiveCells cells={cells} onChordPress={onChordPress} chordLabel={chordLabel} />
                </span>
              ))
            : row.measures.map((cell, i) => (
                <span key={i} className="m">
                  {cell}
                </span>
              ))}
        </div>
      );
    case 'run':
      return (
        <div className={`runline${markClass(markOf, row.address)}`}>
          {onChordPress ? (
            <InteractiveCells cells={row.tokens} onChordPress={onChordPress} chordLabel={chordLabel} />
          ) : (
            row.text
          )}
        </div>
      );
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
 * @param {(address: { section: number, part: number, line: number, measure: number,
 *   item: number }) => void} [props.onChordPress]  the opt-in arrange seam: when
 *   given, every voiced chord is a React Aria `Button` raising this with its
 *   cifra.md occurrence path; absent, the chart is non-interactive (as today)
 * @param {(token: { symbol: string, key: string }) => string} [props.chordLabel]
 *   the accessible name of a pressable chord; default the chord symbol
 */
export default function Chart({ model, markOf, size, label, className, onChordPress, chordLabel }) {
  const rows = chartRows(model);
  const labelOf = chordLabel ?? ((token) => token.symbol);
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
        <Row key={i} row={row} markOf={markOf} onChordPress={onChordPress} chordLabel={labelOf} />
      ))}
    </div>
  );
}

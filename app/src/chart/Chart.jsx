// The chart (shell.chart + shell.a11y_chart): a thin React view over the pure
// `chartRows` layout. It renders a parsed cifra.md song model proportionally —
// a sung line as chords stacked over the words they are attached to, a
// chord-only line as measures between bar rules or a run, section names, words
// lines and stanza breaks — in the mockups' chart markup, which theme.css lines
// 210-229 style from the theme tokens (the "adopted chart CSS").
//
// This is a view component, so it is the only layer here that knows React
// (DIRECTION §3.7 lines 415-417): the model→rows geometry is the framework-free
// `layout.js`, the §3 spoken chord name is the framework-free
// `render/chord-speech.js`, and the §2-§7 reading order is `chart/reading.js`.
// This component is the only place that turns those labels into ARIA
// (docs/screen-reader.md §8). It authors no colour: every colour comes from the
// tokens through the adopted CSS, so the chart re-themes with no code in it.
//
// The screen-reader reading (docs/screen-reader.md): each chord glyph is hidden
// from the accessibility tree (`aria-hidden`) and its spoken name carried by an
// adjacent visually-hidden text node placed before the word-run, so a segment
// reads chord-then-word-run in source order (§2); padding and the centred
// hyphen contribute no accessible text (§4); a chart line is an ordered list of
// measures so the count and position announce and the `|` is never spoken (§5);
// a contiguous run of conflict/default rows is a bounded group that announces
// what conflicts in musical terms at entry and its end at exit (§7).
//
// The chart is non-interactive by default. Its one opt-in interactive seam is
// `onChordPress` (arrange mode — Workflow 5 Decision 3): when given, every
// voiced chord token becomes a keyboard-reachable React Aria `Button` whose
// accessible name is the §3 spoken chord name (so a keyboard user hears
// "E minor, button", never the glyph). Marking stays a consumer-supplied,
// line-addressed seam (`markOf`), which may return the mark alone or the mark
// plus the §7 phrase the consumer computed.

import { Fragment } from 'react';
import { Button } from 'react-aria-components';
import { chartRows } from './layout.js';
import { speakVoice, regionAnnouncement } from './reading.js';
import { speakChord } from '../render/chord-speech.js';
import { t } from '../i18n/index.js';

// The mark a line carries, from the consumer's `markOf(address)`. It may be a
// bare string ('def' | 'conf' | 'tap' | null) or an object { mark, phrase }
// where `phrase` is the §7 musical-terms wording the consumer supplies
// (SongConflict). Section and gap rows carry no address and so no mark.
function resolveMark(markOf, address) {
  if (!markOf || !address) return { mark: null, phrase: null };
  const result = markOf(address);
  if (result == null) return { mark: null, phrase: null };
  if (typeof result === 'string') return { mark: result, phrase: null };
  return { mark: result.mark ?? null, phrase: result.phrase ?? result.announce ?? null };
}

// A chord/no-chord glyph: the visible glyph plus, when there is a §3 spoken
// form for it, the glyph hidden from the accessibility tree and the spoken name
// carried in a visually-hidden sibling (the robust, AT-agnostic pattern — a
// hidden presentation glyph + a visible-to-the-reader text node, not an
// `aria-label` on a non-semantic span; the refinement's Decision). A bare glyph
// with no spoken form (an unknown token, or a chord with no parsed model) stays
// readable as drawn.
function Glyph({ text, voice, speakSlot, className }) {
  const spoken = speakSlot(voice);
  const replace = spoken != null && (voice?.type === 'chord' ? !!voice?.chord : voice?.type === 'nochord');
  return (
    <>
      <span className={className} aria-hidden={replace || undefined}>
        {text}
      </span>
      {replace ? <span className="visually-hidden">{spoken}</span> : null}
    </>
  );
}

// One chord slot: a React Aria `Button` when the arrange seam is on and the slot
// is a voiced chord, else the glyph with its spoken name. The button's
// accessible name is the consumer's `chordLabel(token)` when given, else the §3
// spoken chord name, so an interactive chord always announces its name.
function ChordSlot({ text, token, voice, ctx, glyphClass }) {
  if (ctx.onChordPress && token) {
    const name = ctx.chordLabel ? ctx.chordLabel(token) : ctx.speakSlot(voice) ?? text;
    return (
      <Button className={glyphClass === 'c' ? 'c chord-tap' : 'chord-tap'} aria-label={name} onPress={() => ctx.onChordPress(token.address)}>
        {text}
      </Button>
    );
  }
  return <Glyph text={text} voice={voice} speakSlot={ctx.speakSlot} className={glyphClass} />;
}

// One sung segment: the chord in `.c` stacked over its words in `.w`, DOM order
// chord-then-words so the reading is chord-then-word-run (§2). The spoken name
// sits before the word-run; the centred-hyphen `.fill` is decorative and hidden
// from the tree (§4). The words are the real `.w` text, read as written.
function Segment({ segment, ctx }) {
  return (
    <span className="s">
      <ChordSlot text={segment.chord} token={segment.token} voice={segment.voice} ctx={ctx} glyphClass="c" />
      <span className="w">
        {segment.words}
        {segment.hyphen ? <span className="fill" aria-hidden="true" /> : null}
      </span>
    </span>
  );
}

// A chord-only measure's cells, space-separated as the joined string would be.
function Cells({ cells, ctx }) {
  return cells.map((cell, j) => (
    <Fragment key={j}>
      {j > 0 ? ' ' : null}
      <ChordSlot text={cell.text} token={cell.token} voice={cell.voice} ctx={ctx} glyphClass="g" />
    </Fragment>
  ));
}

function Row({ row, mark, ctx }) {
  const markCls = mark ? ` mark-${mark}` : '';
  switch (row.type) {
    case 'section':
      return <div className="sec-name">{row.name}</div>;
    case 'sung':
      return (
        <div className={`sung${markCls}`}>
          {row.segments.map((segment, i) => (
            <Segment key={i} segment={segment} ctx={ctx} />
          ))}
        </div>
      );
    case 'bars':
      // An ordered list of measures (§5): the reader announces "list, N items,
      // item 1 …", so the count and each measure's position are spoken, and a
      // stated bar number (cifra.md §2.8) leads its measure. The `|` is a CSS
      // border, never a character, so it is never read.
      return (
        <div className={`barline${markCls}`} role="list">
          {row.cells.map((cells, i) => {
            const number = row.numbers?.[i];
            const stated = number?.stated && number?.number != null;
            return (
              <span key={i} className="m" role="listitem">
                {stated ? (
                  <span className="visually-hidden">{t('chart.spoken.bar', { n: number.number })} </span>
                ) : null}
                <Cells cells={cells} ctx={ctx} />
              </span>
            );
          })}
        </div>
      );
    case 'run':
      // A run/intro line is a plain sequence, not an ordered measure group (§5).
      return (
        <div className={`runline${markCls}`}>
          <Cells cells={row.tokens} ctx={ctx} />
        </div>
      );
    case 'words':
      return <div className={`words${markCls}`}>{row.text}</div>;
    case 'gap':
      return <div className="gap" />;
    default:
      return null;
  }
}

// Fold the flat rows into render units, wrapping a contiguous run of rows that
// share a 'conf' or 'def' mark into one bounded region (§7); every other row is
// its own unit. Only this component knows row adjacency, so the bounding lives
// here (the refinement's Decision); 'tap' and the plain chart are never bounded.
function renderUnits(rows, markOf) {
  const units = [];
  let region = null;
  rows.forEach((row, i) => {
    const { mark, phrase } = resolveMark(markOf, row.address);
    if (mark === 'conf' || mark === 'def') {
      if (region && region.mark === mark) {
        region.items.push({ row, i });
      } else {
        region = { mark, phrase, items: [{ row, i }] };
        units.push({ kind: 'region', region });
      }
    } else {
      region = null;
      units.push({ kind: 'row', row, i, mark });
    }
  });
  return units;
}

/**
 * @param {object} props
 * @param {object} props.model  the reader's plain-object song model
 * @param {(address: { section: number, part: number, line: number }) =>
 *   ('def'|'conf'|'tap'|null|{ mark: string, phrase?: string })} [props.markOf]
 *   the line-addressed marking seam; a string mark, or the mark plus the §7
 *   musical-terms phrase; default: no marking (the plain reading chart)
 * @param {number|string} [props.size]  sets `--chart-size` on the host
 * @param {string} [props.label]  the chart's accessible name; default `Chart`
 * @param {string} [props.className]  extra classes on the host
 * @param {(address: { section: number, part: number, line: number, measure: number,
 *   item: number }) => void} [props.onChordPress]  the opt-in arrange seam
 * @param {(token: { symbol: string, key: string }) => string} [props.chordLabel]
 *   the accessible name of a pressable chord; default the §3 spoken chord name
 */
export default function Chart({ model, markOf, size, label, className, onChordPress, chordLabel }) {
  const rows = chartRows(model);
  const speak = (chord, opts) => speakChord(chord, { t, ...opts });
  const speakSlot = (voice) => speakVoice(voice, { speak, t });
  const ctx = { onChordPress, chordLabel, speakSlot };
  const units = renderUnits(rows, markOf);
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
      {units.map((unit, u) => {
        if (unit.kind === 'row') {
          return <Row key={u} row={unit.row} mark={unit.mark} ctx={ctx} />;
        }
        const ann = regionAnnouncement(unit.region.mark, { t, phrase: unit.region.phrase });
        return (
          <div key={u} className={`region region-${unit.region.mark}`} role="group" aria-label={ann.enter}>
            {unit.region.items.map(({ row, i }) => (
              <Row key={i} row={row} mark={unit.region.mark} ctx={ctx} />
            ))}
            <span className="visually-hidden">{ann.exit}</span>
          </div>
        );
      })}
    </div>
  );
}

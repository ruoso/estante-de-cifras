// The chord diagram (shell.diagram): a thin React view over the carried SVG
// renderer. It draws a `Fingering` as a vertical chord box in the visual
// language, in one of three kinds — the song's own shape (dots in ink, no
// word), your shape (dots in the chord colour, labelled *your shape*) and the
// default (dots drawn hollow, labelled *default*). ChordBox.dc.html is the
// governing drawing.
//
// This is a view component, so it is the only layer here that knows React
// (DIRECTION §3.7 lines 415-417): it reuses the framework-free renderer rather
// than re-drawing the grid in JSX (the "reuse the carried renderer" decision),
// and carries the kind as a modifier class on its host. diagram.css maps the
// renderer's `ec-*` classes onto the theme tokens and selects the dot/barre
// fill from that modifier, so colour comes from the tokens, never from code,
// and the drawing re-themes with no code in it.
//
// The diagram is not interactive in this task (tapping to enlarge, starring and
// entering a shape are their own later tasks), so it introduces no React Aria
// Components control: when an enclosing surface makes the diagram pressable,
// that surface owns the control and its keyboard path.

import { diagramKind, diagramSvg } from './chord-diagram.js';
import './diagram.css';

/**
 * @param {object} props
 * @param {import('../core/search.js').Fingering} props.fingering
 * @param {object} [props.context]  { chord, dialect, instrument } — the
 *   accessible name is the `describeFingering` sentence built from it.
 * @param {'song'|'yours'|'default'} [props.kind]
 * @param {number} [props.size]  the renderer's scale multiplier
 * @param {string} [props.className]  extra classes on the host
 */
export default function ChordDiagram({ fingering, context, kind = 'song', size, className }) {
  const { modifier, word } = diagramKind(kind);
  const options = size != null ? { size } : {};
  // The renderer returns a trusted, app-generated SVG string with role="img"
  // and the escaped aria-label; the host renders it in place so print and
  // export stay the same string that is on screen (chord-box.js lines 4-7).
  const svg = diagramSvg(fingering, context ?? {}, options);

  return (
    <div className={`chord-diagram ${modifier}${className ? ` ${className}` : ''}`}>
      <span className="chord-diagram__box" dangerouslySetInnerHTML={{ __html: svg }} />
      {/* The kind word is adjacent visible text, read by assistive tech in
          document order — not folded into the SVG's aria-label, which would say
          it twice (the "carries a visible word" decision; mockups README line
          26, status by word). */}
      {word ? <span className="chord-diagram__who">{word}</span> : null}
    </div>
  );
}

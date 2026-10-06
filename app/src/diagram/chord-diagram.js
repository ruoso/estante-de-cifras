// The chord diagram's presentation helpers (shell.diagram).
//
// The kind — the song's own shape, your shape, the default — is a view concern,
// not something the carried music core knows about (DIRECTION §3.7 lines
// 415-417; the refinement's "kind is a view concern" decision). It resolves to
// a modifier class on the React host, which diagram.css turns into the dot and
// barre fill from the theme tokens (--ink / --chord / --default-dot), and to a
// visible word for the two non-song kinds — a word beside the drawing, never
// colour alone (mockups README line 26). These helpers are framework-free so
// the unit test can pin them with no DOM.

import { renderDiagram } from '../render/index.js';
import { t } from '../i18n/index.js';

/** The three kinds the diagram draws, mirroring ChordBox.dc.html line 40. */
export const KINDS = ['song', 'yours', 'default'];

/**
 * Resolve a kind to its modifier class and the word shown beside the drawing.
 *
 * `song` is the plain, unlabelled case (dots in ink, no word); `yours` carries
 * *your shape* (dots in the chord colour) and `default` carries *default* (dots
 * drawn hollow) — ChordBox.dc.html lines 81-82, mockups README line 26. An
 * unknown kind falls back to `song` rather than drawing a broken state.
 *
 * @param {'song'|'yours'|'default'} [kind]
 * @returns {{ kind: string, modifier: string, word: string|null }}
 */
export function diagramKind(kind = 'song') {
  const resolved = KINDS.includes(kind) ? kind : 'song';
  const word =
    resolved === 'yours'
      ? t('diagram.yourShape')
      : resolved === 'default'
        ? t('diagram.default')
        : null;
  return { kind: resolved, modifier: `chord-diagram--${resolved}`, word };
}

/**
 * The themed-class SVG string for a fingering, from the carried renderer.
 *
 * A thin wrapper over `renderDiagram` so the component has one seam to render
 * into its host and the unit test has one place to pin the geometry the task
 * cares about — the starting fret surfaces as `ec-fretnum` when the shape sits
 * up the neck, and the thick nut (`ec-nut`) stands in for it at the nut
 * (chord-box.js lines 65-86; mockups README line 25). The label inside is
 * already escaped by the renderer's `esc`, so the host renders trusted markup.
 *
 * @param {import('../core/search.js').Fingering} fingering
 * @param {object} [context]  { chord, dialect, instrument } for the aria-label
 * @param {import('../render/diagram.js').DiagramOptions} [options]
 * @returns {string} SVG markup
 */
export function diagramSvg(fingering, context = {}, options = {}) {
  return renderDiagram(fingering, context, options);
}

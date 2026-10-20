// The source editor's CodeMirror extension set (songs.editor; DIRECTION §3.7),
// shared by the song editor and the conflict resolver's *edit* view
// (sync.conflicts_editing Decision 1), so the two never drift on line numbers,
// colouring or accessibility. Pure configuration: no store, no WRITE, no React.
// Each host adds its own behavior (the song editor's paste handler, its
// ExternalLoad and WRITE) through `onDocChange` and its own extensions.

import { StateField, RangeSetBuilder } from '@codemirror/state';
import {
  EditorView,
  Decoration,
  lineNumbers,
  highlightActiveLine,
  keymap,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { classifyLines } from './cifra-syntax.js';
import { unknownMarks } from './unknown-words.js';

// Build the per-line decoration set from the classifier. A `text` (plain) line
// gets no decoration (default colour); every other class maps to an
// `est-<class>` line decoration the stylesheet colours with tokens. The
// classifier reads the song in its own notation (cifra.md §5.6), never the
// user's preference.
function buildDecorations(doc) {
  const classes = classifyLines(doc.toString());
  const builder = new RangeSetBuilder();
  for (let i = 0; i < doc.lines; i += 1) {
    const cls = classes[i];
    if (cls && cls !== 'text') {
      const line = doc.line(i + 1);
      builder.add(line.from, line.from, Decoration.line({ class: `est-${cls}` }));
    }
  }
  return builder.finish();
}

// The mark decorations over every word the reader does not read as a chord
// (songs.unknown_tokens_loud; workflow 4 §Editing): a wavy underline — a shape,
// not colour alone — with a `title` saying so.
function buildMarks(doc, title) {
  const mark = Decoration.mark({ class: 'est-unknown', attributes: { title } });
  const builder = new RangeSetBuilder();
  for (const { from, to } of unknownMarks(doc.toString())) builder.add(from, to, mark);
  return builder.finish();
}

/**
 * A song's unknown-token marks, recomputed on every change (editor Decision 2:
 * synchronous decorations over the buffer). Only the song editor adds it, and
 * only for a song (unknown-words.js `isSongPath`); the shared set stays
 * unmarked for the conflict resolver and the raw editor.
 *
 * @param {{ title: string }} options — the mark's tooltip text
 * @returns {object} a CodeMirror extension
 */
export function unknownMarksField({ title }) {
  return StateField.define({
    create: (state) => buildMarks(state.doc, title),
    update: (value, tr) => (tr.docChanged ? buildMarks(tr.state.doc, title) : value),
    provide: (f) => EditorView.decorations.from(f),
  });
}

/**
 * The source editor's extensions, in order: line numbers, the active line,
 * history, the default and history keymaps (no indentWithTab, so Tab is never
 * trapped), the cifra syntax colouring, the accessible name with tabindex 0,
 * and an update listener that calls `onDocChange(update)` on every document
 * change.
 *
 * @param {{ label: string, onDocChange?: (update: object) => void }} options
 * @returns {Array<object>} CodeMirror extensions
 */
export function sourceExtensions({ label, onDocChange }) {
  const syntaxField = StateField.define({
    create: (state) => buildDecorations(state.doc),
    update: (value, tr) => (tr.docChanged ? buildDecorations(tr.state.doc) : value),
    provide: (f) => EditorView.decorations.from(f),
  });

  return [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    syntaxField,
    // tabindex 0 states what the contenteditable already is — in the tab
    // order — so axe sees the scrolling editor holds focusable content
    // (scrollable-region-focusable; shell.full_height bounds the editor, so
    // it scrolls).
    EditorView.contentAttributes.of({
      'aria-label': label,
      tabindex: '0',
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      onDocChange?.(update);
    }),
  ];
}

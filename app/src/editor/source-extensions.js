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
  WidgetType,
  lineNumbers,
  highlightActiveLine,
  keymap,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { classifyLines } from './cifra-syntax.js';
import { unknownMarks } from './unknown-words.js';
import { lineDiagnostics } from './diagnostic-words.js';
import { parse } from 'cifra-md';

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

// The words under a reported line (songs.editor_errors_in_words Constraint 3;
// workflow 4 §Editing): a block of text right below it, in the text's flow,
// holding no control (a control inside the textbox would break its single tab
// stop and axe nested-interactive). aria-hidden, so a screen reader does not
// read it as part of the song — the song editor speaks it through its own live
// region when the cursor arrives (Decision 2).
class LineNoteWidget extends WidgetType {
  constructor(text) {
    super();
    this.text = text;
  }

  eq(other) {
    return other.text === this.text;
  }

  toDOM() {
    const el = document.createElement('div');
    el.className = 'est-line-note';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = this.text;
    return el;
  }

  ignoreEvent() {
    return false;
  }
}

// One note after each line the classifier colours `err`, from the same
// diagnostics (Constraint 2): the first diagnostic on the line names it.
function buildNotes(doc, lineNote) {
  const builder = new RangeSetBuilder();
  const byLine = lineDiagnostics(parse(doc.toString()).diagnostics);
  for (const n of [...byLine.keys()].sort((a, b) => a - b)) {
    if (n < 1 || n > doc.lines) continue;
    const line = doc.line(n);
    const widget = new LineNoteWidget(lineNote(byLine.get(n)));
    builder.add(line.to, line.to, Decoration.widget({ widget, block: true, side: 1 }));
  }
  return builder.finish();
}

/**
 * The source editor's extensions, in order: line numbers, the active line,
 * history, the default and history keymaps (no indentWithTab, so Tab is never
 * trapped), the cifra syntax colouring, the accessible name with tabindex 0,
 * a note in words under every line it colours red (when `lineNote` is given —
 * every host gives it, songs.editor_errors_in_words Decision 8), and an update
 * listener that calls `onDocChange(update)` on every document change.
 *
 * @param {{
 *   label: string,
 *   lineNote?: (diagnostic: {code: string, line: number}) => string,
 *   onDocChange?: (update: object) => void,
 * }} options
 * @returns {Array<object>} CodeMirror extensions
 */
export function sourceExtensions({ label, lineNote, onDocChange }) {
  const syntaxField = StateField.define({
    create: (state) => buildDecorations(state.doc),
    update: (value, tr) => (tr.docChanged ? buildDecorations(tr.state.doc) : value),
    provide: (f) => EditorView.decorations.from(f),
  });
  // Recomputed on every change, like the unknown-word marks.
  const notesField = lineNote
    ? StateField.define({
        create: (state) => buildNotes(state.doc, lineNote),
        update: (value, tr) => (tr.docChanged ? buildNotes(tr.state.doc, lineNote) : value),
        provide: (f) => EditorView.decorations.from(f),
      })
    : [];

  return [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    syntaxField,
    notesField,
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

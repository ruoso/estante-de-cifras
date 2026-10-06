// The source editor (songs.editor; DIRECTION §3.7 L418-420). CodeMirror 6 over
// a song's cifra.md text: the text loaded from the working copy (or a template
// for a new song), coloured by cifra.md structure, persisted back on every
// (debounced) edit, with a preview beside it on a wide screen and a tap away on
// a phone, paste-into-a-fence with undo, and a voicing the reader cannot read
// stopping the save.
//
// Component boundaries (DIRECTION §3.6-3.7): this is the only React layer. It
// reads the song text through the `source` slice (fed by OPEN_SOURCE), persists
// edits through WRITE, and never touches IndexedDB, git or the book lock — the
// Worker owns durability and the canonical save. The editor parses in the view
// for syntax, preview and the pre-save diagnostics (Decision 2); `cifra-md`
// knows no React, so it is usable below the view. Canonicalising, the
// marked-text refusal and the commit stay in the Worker.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { StateField, RangeSetBuilder } from '@codemirror/state';
import {
  EditorView,
  Decoration,
  lineNumbers,
  highlightActiveLine,
  keymap,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo } from '@codemirror/commands';
import { parse, DEFAULT_DIALECT } from 'cifra-md';

import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import { useLayoutMode } from '../shell/AppShell.jsx';
import { t } from '../i18n/index.js';
import Chart from '../chart/Chart.jsx';
import { classifyLines } from './cifra-syntax.js';
import { fencePaste } from './fence-paste.js';
import { template, templateDialect } from './template.js';
import './editor.css';

// Per-keystroke WRITE runs under the book lock, so the view debounces its
// writes (storage.working_copy Decision 3). Short enough that closing the tab
// shortly after a keystroke loses nothing (the unmount also flushes).
const WRITE_DEBOUNCE_MS = 400;

// The diagnostics that stop a save (Decision 3): a voicing the reader could not
// read (which canonicalising would silently drop — workflow 4 §Normalising) and
// a conflict marker (never canonical — spec §8.1/§11.12.3). Everything else the
// format is happy to normalise.
const SAVE_BLOCKERS = new Set(['bad-voicing', 'marker-line']);

// Build the per-line decoration set from the classifier. A `text` (plain) line
// gets no decoration (default colour); every other class maps to an
// `est-<class>` line decoration the stylesheet colours with tokens.
function buildDecorations(doc, dialect) {
  const classes = classifyLines(doc.toString(), dialect);
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

export default function SongEditor({
  store,
  bookId = null,
  path = null,
  isNew = false,
  title = '',
  onSave,
  layoutMode,
  editorRef,
}) {
  const preferences = useSlice(store, 'preferences');
  const sourceSlice = useSlice(store, 'source');
  const autoMode = useLayoutMode();
  const mode = layoutMode ?? autoMode;

  const dialect = useMemo(
    () => (isNew ? templateDialect(preferences) : preferences?.notation?.value ?? DEFAULT_DIALECT),
    [isNew, preferences],
  );

  // The buffer text, mirrored into React so the preview and the save gate parse
  // from the live buffer (Decision 2). CodeMirror owns the editable truth; this
  // follows it through the update listener.
  const [text, setText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [saveError, setSaveError] = useState(null); // { line, code } | null
  const [pasteNotice, setPasteNotice] = useState(null); // { titled } | null

  // The initial document: a template for a new song, else the working-copy text
  // once OPEN_SOURCE has returned it.
  const sourceText = sourceSlice?.[bookId]?.[path]?.text;
  // A new song's template carries the title the host started it with (the
  // search query, the file-view/book-section empty title) — songs.new_song
  // wires the `title` the template seam already accepts (editor.md Decision 9;
  // workflow 3 §Ways in). Empty when none, exactly as before.
  const templateDoc = useMemo(
    () => (isNew ? template(preferences, { title }) : null),
    [isNew, preferences, title],
  );

  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const dialectRef = useRef(dialect);
  const changeHandlerRef = useRef(() => {});
  const pasteHandlerRef = useRef(() => false);
  const writeTimer = useRef(null);
  const pendingWrite = useRef(null);
  const loadedKey = useRef(null);

  // Durability: schedule a debounced WRITE of the current text (never for a
  // template with no destination file yet).
  const scheduleWrite = useCallback(
    (value) => {
      if (!bookId || !path) return;
      pendingWrite.current = value;
      if (writeTimer.current) clearTimeout(writeTimer.current);
      writeTimer.current = setTimeout(() => {
        writeTimer.current = null;
        pendingWrite.current = null;
        store.send(command(CommandKind.WRITE, { bookId, path, text: value }));
      }, WRITE_DEBOUNCE_MS);
    },
    [store, bookId, path],
  );

  // CodeMirror's extensions are built once but must call the latest handlers
  // (they close over the current dialect and props). The refs are updated in an
  // effect — never during render — and read lazily when an edit or paste fires.
  useEffect(() => {
    dialectRef.current = dialect;

    changeHandlerRef.current = (value) => {
      setText(value);
      // Any edit clears a stale save-stop notice and a stale paste notice; a
      // wrapping paste re-sets its own notice after its dispatch below.
      setSaveError(null);
      setPasteNotice(null);
      scheduleWrite(value);
    };

    pasteHandlerRef.current = (event, view) => {
      const pasted = event.clipboardData?.getData('text/plain') ?? '';
      if (!pasted) return false;
      event.preventDefault();
      const sel = view.state.selection.main;
      const before = view.state.doc.sliceString(0, sel.from);
      // A `#` heading (even an empty one) is a title slot; the first pasted line
      // is promoted only when the song has no heading at all.
      const hasTitle = parse(view.state.doc.toString(), dialect).title !== null;
      const result = fencePaste({ text: before, pasted, hasTitle });
      // The title (when promoted) is inserted at the document head and the
      // fenced body at the paste point, in one transaction — one undo reverts
      // both. Both may be insertions at offset 0 (an empty doc): that is
      // touching, not overlapping, and CodeMirror applies them in array order.
      const changes = [];
      let delta = 0;
      if (result.title) {
        changes.push({ from: 0, insert: `${result.title}\n` });
        delta = result.title.length + 1;
      }
      changes.push({ from: sel.from, to: sel.to, insert: result.insert });
      const anchor = sel.from + delta + result.insert.length;
      view.dispatch({ changes, selection: { anchor }, userEvent: 'input.paste', scrollIntoView: true });
      if (result.wrapped) setPasteNotice({ titled: result.titled });
      return true;
    };
  });

  // Create the CodeMirror view once, under this component's lifetime. bookId/
  // path are stable for a mounted editor (hosts remount via React key for a
  // different song), so the view is not rebuilt on every prop change.
  useEffect(() => {
    const syntaxField = StateField.define({
      create: (state) => buildDecorations(state.doc, dialectRef.current),
      update: (value, tr) =>
        tr.docChanged ? buildDecorations(tr.state.doc, dialectRef.current) : value,
      provide: (f) => EditorView.decorations.from(f),
    });

    const view = new EditorView({
      parent: containerRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        syntaxField,
        EditorView.contentAttributes.of({ 'aria-label': t('editor.source.sourceLabel') }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) changeHandlerRef.current(update.state.doc.toString());
        }),
        EditorView.domEventHandlers({
          paste: (event, cmView) => pasteHandlerRef.current(event, cmView),
        }),
      ],
    });
    viewRef.current = view;
    if (editorRef) editorRef.current = view;

    return () => {
      // Flush a pending write so closing the editor loses nothing.
      if (writeTimer.current) {
        clearTimeout(writeTimer.current);
        if (pendingWrite.current != null && bookId && path) {
          store.send(command(CommandKind.WRITE, { bookId, path, text: pendingWrite.current }));
        }
      }
      view.destroy();
      viewRef.current = null;
      if (editorRef) editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the initial document into the buffer, exactly once per song. A later
  // SOURCE for the same path (or a preferences-driven template recompute) does
  // not clobber edits already in the buffer.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const initial = isNew ? templateDoc?.text : sourceText;
    if (initial == null) return;
    const key = `${isNew ? 'new' : 'src'}:${bookId}:${path}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    const cursor = isNew ? templateDoc.cursor : 0;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: initial },
      selection: { anchor: Math.min(cursor, initial.length) },
    });
    setText(initial);
  }, [isNew, templateDoc, sourceText, bookId, path]);

  // Ask the Worker for the working-copy text of an existing song.
  useEffect(() => {
    if (isNew || !bookId || !path) return;
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
  }, [store, isNew, bookId, path]);

  const parsed = useMemo(() => parse(text, dialect), [text, dialect]);
  const blockers = useMemo(
    () => parsed.diagnostics.filter((d) => SAVE_BLOCKERS.has(d.code)),
    [parsed],
  );

  const addSection = () => {
    const view = viewRef.current;
    if (!view) return;
    const docStr = view.state.doc.toString();
    const end = docStr.length;
    const trailing = /\n*$/.exec(docStr)[0].length;
    const sep = end === 0 ? '' : '\n'.repeat(Math.max(0, 2 - trailing));
    const head = `${sep}## \n\`\`\`\n`;
    const insert = `${head}\n\`\`\``;
    const cursor = end + head.length; // the empty line between the fences
    view.dispatch({ changes: { from: end, insert }, selection: { anchor: cursor }, scrollIntoView: true });
    view.focus();
  };

  const undoPaste = () => {
    const view = viewRef.current;
    if (!view) return;
    undo(view);
    setPasteNotice(null);
    view.focus();
  };

  const onSavePress = () => {
    if (blockers.length > 0) {
      setSaveError({ line: blockers[0].line, code: blockers[0].code });
      return;
    }
    setSaveError(null);
    onSave?.();
  };

  const showStop = Boolean(saveError) && blockers.length > 0;
  let stopMessage = '';
  if (saveError) {
    stopMessage =
      saveError.code === 'marker-line'
        ? t('editor.source.markerStop', { line: saveError.line })
        : t('editor.source.voicingStop', { line: saveError.line });
  }

  const showEditorPane = !(mode === 'narrow' && showPreview);
  const showPreviewPane = mode === 'wide' || showPreview;

  return (
    <div className="est-editor">
      <div className="est-editor-bar">
        {mode === 'narrow' && (
          <ToggleButtonGroup
            className="seg"
            aria-label={t('editor.source.viewToggle')}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[showPreview ? 'preview' : 'text']}
            onSelectionChange={(keys) => setShowPreview(keys.has('preview'))}
          >
            <ToggleButton id="text">{t('editor.source.text')}</ToggleButton>
            <ToggleButton id="preview">{t('editor.source.preview')}</ToggleButton>
          </ToggleButtonGroup>
        )}
        <span className="est-editor-bar-spacer" />
        <Button className="btn" onPress={addSection}>
          {t('editor.source.addSection')}
        </Button>
        <Button className="btn primary" onPress={onSavePress}>
          {t('editor.source.save')}
        </Button>
      </div>

      {pasteNotice && (
        <div className="notice accent est-editor-notice" role="status">
          <span className="est-editor-notice-text">
            {t('editor.source.pasteFenced')}
            {pasteNotice.titled ? ` ${t('editor.source.pasteTitleAdded')}` : ''}
          </span>
          <Button className="btn" onPress={undoPaste}>
            {t('editor.source.undo')}
          </Button>
        </div>
      )}

      {showStop && (
        <div className="notice conflict est-editor-notice" role="alert">
          <span className="est-editor-notice-text">
            <b>{t('editor.source.notSaved')}</b> {stopMessage}
          </span>
        </div>
      )}

      <div className={`est-editor-body${mode === 'wide' ? ' split' : ''}`}>
        <div className="est-editor-pane" hidden={!showEditorPane}>
          <div ref={containerRef} className="est-cm" />
        </div>
        {showPreviewPane && (
          <div className="est-editor-pane est-editor-preview">
            <div className="t-h3">{t('editor.source.preview')}</div>
            <Chart model={parsed} label={t('editor.source.previewLabel')} />
          </div>
        )}
      </div>
    </div>
  );
}

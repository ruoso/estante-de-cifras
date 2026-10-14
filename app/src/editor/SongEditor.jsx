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
import { Annotation, StateField, RangeSetBuilder } from '@codemirror/state';
import {
  EditorView,
  Decoration,
  lineNumbers,
  highlightActiveLine,
  keymap,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo } from '@codemirror/commands';
import { parse, DEFAULT_DIALECT } from 'cifra-md';

import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { useLayoutMode } from '../shell/AppShell.jsx';
import { t } from '../i18n/index.js';
import Chart from '../chart/Chart.jsx';
import { classifyLines } from './cifra-syntax.js';
import { fencePaste } from './fence-paste.js';
import { sectionInsertPos } from './section-insert.js';
import { template, templateDialect } from './template.js';
import './editor.css';

// Per-keystroke WRITE runs under the book lock, so the view debounces its
// writes (storage.working_copy Decision 3). Short enough that closing the tab
// shortly after a keystroke loses nothing (the unmount also flushes).
const WRITE_DEBOUNCE_MS = 400;

// Marks the one programmatic dispatch that loads a file's on-disk bytes into the
// buffer (the initial-load effect). The update listener skips its debounced
// WRITE for such a transaction: those bytes are already on disk, so persisting
// them is redundant — and, worse, a pending self-write flushed on unmount would
// resurrect a file deleted right after it was opened (books.file_view delete).
// A genuine edit and the merge-adopt dispatch carry no such annotation, so they
// still schedule a WRITE.
const ExternalLoad = Annotation.define();

// The diagnostics that stop a save (Decision 3): a voicing the reader could not
// read (which canonicalising would silently drop — workflow 4 §Normalising) and
// a conflict marker (never canonical — spec §8.1/§11.12.3). Everything else the
// format is happy to normalise.
const SAVE_BLOCKERS = new Set(['bad-voicing', 'marker-line']);

// The ✕ on the merge notice's dismiss control (mirrors SongReading's; aria-hidden
// — the button's "Dismiss update notice" label is its accessible name).
function DismissIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// The minimal single change turning `oldStr` into `newStr`: the span between the
// common prefix and the common suffix. Dispatched as a CodeMirror change so the
// editor maps the caret/selection through it — the caret keeps its place
// relative to surrounding text, clamped where its own line was rewritten
// (Decision 3). Not a three-way merge: the Worker already merged (Decision 4).
function minimalChange(oldStr, newStr) {
  let from = 0;
  const min = Math.min(oldStr.length, newStr.length);
  while (from < min && oldStr[from] === newStr[from]) from += 1;
  let oldEnd = oldStr.length;
  let newEnd = newStr.length;
  while (oldEnd > from && newEnd > from && oldStr[oldEnd - 1] === newStr[newEnd - 1]) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  return { from, to: oldEnd, insert: newStr.slice(from, newEnd) };
}

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
  onOpenHistory = () => {},
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
  // A background sync merged a new version under the unsaved buffer (sync.unsaved
  // → the transient MERGED fact; workflow 8 L55-56). The shown notice —
  // `{ author, commit }` — or null; `mergePending` flags the one re-issued
  // OPEN_SOURCE whose bytes the swap effect adopts past the loadedKey guard.
  const [update, setUpdate] = useState(null);
  const mergePending = useRef(false);

  // The initial document: a template for a new song, else the working-copy text
  // once THIS mount's OPEN_SOURCE has returned it. The slice may still hold an
  // entry from an earlier open of the same song — stale once the working copy
  // moved since (a discard, or edits made after that open) — so the entry
  // present at mount is ignored; every SOURCE reply lands as a new entry object.
  const [staleSourceEntry] = useState(() => sourceSlice?.[bookId]?.[path]);
  const sourceEntry = sourceSlice?.[bookId]?.[path];
  const sourceText = sourceEntry && sourceEntry !== staleSourceEntry ? sourceEntry.text : undefined;
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
        // tabindex 0 states what the contenteditable already is — in the tab
        // order — so axe sees the scrolling editor holds focusable content
        // (scrollable-region-focusable; shell.full_height bounds the editor, so
        // it scrolls).
        EditorView.contentAttributes.of({
          'aria-label': t('editor.source.sourceLabel'),
          tabindex: '0',
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          // The initial on-disk load is not an edit to persist (ExternalLoad):
          // mirror its text into React but schedule no WRITE.
          const external = update.transactions.some((tr) => tr.annotation(ExternalLoad));
          if (external) setText(update.state.doc.toString());
          else changeHandlerRef.current(update.state.doc.toString());
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
      // An existing file's bytes are already on disk, so adopting them must not
      // schedule a WRITE (ExternalLoad). A NEW song is the exception: its
      // placeholder file is created by the editor's first WRITE (the Worker's
      // NEW_SONG does not write it), so the template load must still persist.
      ...(isNew ? null : { annotations: ExternalLoad.of(true) }),
    });
    setText(initial);
  }, [isNew, templateDoc, sourceText, bookId, path]);

  // Ask the Worker for the working-copy text of an existing song.
  useEffect(() => {
    if (isNew || !bookId || !path) return;
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
  }, [store, isNew, bookId, path]);

  // A merge landed under the open buffer (the transient MERGED fact, like
  // RESTORED / FILE_MOVED). React only when it names THIS open song. The Worker
  // owns the merge — the view adopts the result, never re-merges (Decision 4):
  // re-issue OPEN_SOURCE to pull the merged bytes (Decision 2, demand-driven as
  // the reading-view mirror does) and surface the notice. Cancel any in-flight
  // debounced WRITE first — it still holds the pre-merge buffer, which the merge
  // already folded in as `ours`, so letting it land would clobber the incoming
  // side on disk (Decision 4). A new-song editor has no file to merge into.
  useWorkerEvent(store, EventKind.MERGED, ({ bookId: changedBook, changed }) => {
    if (isNew || changedBook !== bookId) return;
    const hit = changed?.find((c) => c.path === path);
    if (!hit) return;
    if (writeTimer.current) {
      clearTimeout(writeTimer.current);
      writeTimer.current = null;
      pendingWrite.current = null;
    }
    mergePending.current = true;
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    setUpdate({ author: hit.author, commit: hit.commit });
  });

  // Adopt the merged working text past the loadedKey guard — the one deliberate
  // reload (Decision 2). Dispatch it as the minimal change from the current
  // buffer so CodeMirror maps the caret/selection through it (Decision 3); the
  // update listener mirrors the new text into React and re-schedules the WRITE.
  useEffect(() => {
    if (!mergePending.current) return;
    const view = viewRef.current;
    if (!view || sourceText == null) return;
    mergePending.current = false;
    const current = view.state.doc.toString();
    if (sourceText === current) return;
    view.dispatch({ changes: minimalChange(current, sourceText) });
  }, [sourceText]);

  const parsed = useMemo(() => parse(text, dialect), [text, dialect]);
  const blockers = useMemo(
    () => parsed.diagnostics.filter((d) => SAVE_BLOCKERS.has(d.code)),
    [parsed],
  );

  const addSection = () => {
    const view = viewRef.current;
    if (!view) return;
    const docStr = view.state.doc.toString();
    // The end of the chart, not the end of the document: on a song with a
    // voicings appendix the new section must land before the rule, or
    // canonicalise drops it on save (section-insert.js; spec §1.5/§8.2). With no
    // appendix this is `docStr.length`, exactly as Add section behaved before.
    const from = sectionInsertPos(docStr);
    const before = docStr.slice(0, from);
    const after = docStr.slice(from);
    // Pad a blank line before the heading (unless inserting at the very start)
    // and — when there is an appendix following — a blank line after the closing
    // fence, honouring the newlines already present on each side.
    const leadingNL = /\n*$/.exec(before)[0].length;
    const afterNL = /^\n*/.exec(after)[0].length;
    const leadSep = before.length === 0 ? '' : '\n'.repeat(Math.max(0, 2 - leadingNL));
    const trailSep = after.length === 0 ? '' : '\n'.repeat(Math.max(0, 2 - afterNL));
    const head = `${leadSep}## \n\`\`\`\n`;
    const insert = `${head}\n\`\`\`${trailSep}`;
    const cursor = from + head.length; // the empty line between the fences
    view.dispatch({ changes: { from, insert }, selection: { anchor: cursor }, scrollIntoView: true });
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
    // Send a still-debounced edit now: the Worker handles commands in order,
    // so the save sheet's preview (sent once it opens) reads the text as typed
    // — a Save pressed within the debounce otherwise previews the older text.
    if (writeTimer.current) {
      clearTimeout(writeTimer.current);
      writeTimer.current = null;
      if (pendingWrite.current != null && bookId && path) {
        store.send(command(CommandKind.WRITE, { bookId, path, text: pendingWrite.current }));
      }
      pendingWrite.current = null;
    }
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

      {update && (
        <div className="notice accent est-editor-notice est-editor-update-notice" role="status">
          <span className="est-editor-notice-text">
            {t('editor.updatedBy', { name: update.author })}
          </span>
          <Button
            className="btn"
            onPress={() => onOpenHistory({ bookId, path, commit: update.commit })}
          >
            {t('editor.seeWhatChanged')}
          </Button>
          <Button
            className="btn icon"
            aria-label={t('editor.updateDismiss')}
            onPress={() => setUpdate(null)}
          >
            <DismissIcon />
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
          // The preview scrolls on its own under the frame (shell.full_height)
          // and holds no control, so it takes focus itself — a named region
          // the keyboard can reach and scroll (axe scrollable-region-focusable),
          // the scroll-region case jsx-a11y's rule documents as legitimate.
          <div
            className="est-editor-pane est-editor-preview"
            role="region"
            aria-label={t('editor.source.preview')}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
          >
            <div className="t-h3">{t('editor.source.preview')}</div>
            <Chart model={parsed} label={t('editor.source.previewLabel')} />
          </div>
        )}
      </div>
    </div>
  );
}

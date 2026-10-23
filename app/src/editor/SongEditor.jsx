// The source editor (songs.editor; DIRECTION §3.7 L418-420). CodeMirror 6 over
// a song's cifra.md text: the text loaded from the working copy (or a template
// for a new song), coloured by cifra.md structure, persisted back on every
// (debounced) edit, with a preview beside it when the editor is wide enough and
// a tap away when it is not — a preview that arranges, as the arrange screen
// does (workflow 4 §Editing): its chords open the shape picker and every
// chord's diagram follows the chart, a choice landing in the buffer as one
// undoable change — paste-into-a-fence with undo, a voicing the reader cannot read
// stopping the save, and every line the reader reports saying why in words —
// under the line, and to a screen reader when the cursor arrives
// (songs.editor_errors_in_words).
//
// Component boundaries (DIRECTION §3.6-3.7): this is the only React layer. It
// reads the song text through the `source` slice (fed by OPEN_SOURCE), persists
// edits through WRITE, and never touches IndexedDB, git or the book lock — the
// Worker owns durability and the canonical save. The editor parses in the view
// for syntax, preview and the pre-save diagnostics (Decision 2); `cifra-md`
// knows no React, so it is usable below the view. Canonicalising, the
// marked-text refusal and the commit stay in the Worker.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { Annotation } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { undo, isolateHistory } from '@codemirror/commands';
import { parse } from 'cifra-md';

import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { useLayoutMode } from '../shell/AppShell.jsx';
import { t } from '../i18n/index.js';
import Chart from '../chart/Chart.jsx';
import InstrumentChip from '../instruments/InstrumentChip.jsx';
import { useArrange } from '../songs/arrange-surface.jsx';
import { sourceExtensions, unknownMarksField } from './source-extensions.js';
import { fencePaste, fenceAround } from './fence-paste.js';
import { lineDiagnostics, lineNoteText } from './diagnostic-words.js';
import { sectionInsertion } from './section-insert.js';
import { saveBlockers, stopMessageKey } from './save-blockers.js';
import { isSongPath, formatHint } from './unknown-words.js';
import { exampleInsertion } from './format-help.js';
import FormatHelp from './FormatHelp.jsx';
import { EDITOR_SPLIT_MIN_WIDTH, editorSplits } from './editor-split.js';
import { template } from './template.js';
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

// The ✕ on the merge notice's dismiss control (mirrors SongReading's; aria-hidden
// — the button's "Dismiss update notice" label is its accessible name).
function DismissIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// The question mark on *Help* (board Format-help; aria-hidden — the word is
// the button's name).
function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01" />
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

export default function SongEditor({
  store,
  bookId = null,
  path = null,
  isNew = false,
  title = '',
  onSave,
  onOpenHistory = () => {},
  // Told whether the working text differs from the last saved version — the
  // host's *unsaved changes* mark (sync.in_place_notices; W08#3 L96).
  onUnsavedChange,
  layoutMode,
  editorRef,
  flushRef,
  // A host-owned chrome (songs.editor_chrome Constraints 2-4, 8): the host
  // draws Save in its own header and calls the editor's gate through
  // `saveRef`; on a phone it draws Add section in its bottom bar and calls it
  // through `addSectionRef`. With either ref the editor draws no button of its
  // own for it. `onTitleChange` hears the parsed `#` title (null when the text
  // has none), `onWrite` each WRITE the editor sends, and `showPreview={false}`
  // hides the wide preview (the computer's save panel sits there instead).
  saveRef,
  addSectionRef,
  onTitleChange,
  onWrite,
  showPreview: previewAllowed = true,
}) {
  const preferences = useSlice(store, 'preferences');
  const sourceSlice = useSlice(store, 'source');
  const autoMode = useLayoutMode();
  const mode = layoutMode ?? autoMode;

  // The buffer text, mirrored into React so the preview and the save gate parse
  // from the live buffer (Decision 2). CodeMirror owns the editable truth; this
  // follows it through the update listener.
  const [text, setText] = useState('');
  const [previewTab, setPreviewTab] = useState(false);
  // The editor's own width — the body the two panes share — decides the split
  // (songs.editor_split_width; workflow 3 §The editor L78-84). Kept in state
  // only when it lands on the other side of the rule, so a resize does not
  // re-render per pixel; `null` until measured (the layout mode decides then).
  const bodyRef = useRef(null);
  const previewRef = useRef(null);
  const bodyWidthRef = useRef(null);
  const [bodyWidth, setBodyWidth] = useState(null);
  const [saveError, setSaveError] = useState(null); // { line, code } | null
  // The notice that the editor put text inside the music, with its Undo: a
  // paste it wrapped, or a line *Put it in the music* fenced
  // (songs.editor_errors_in_words Constraint 6; workflow 3 §Pasting a cifra).
  const [wrapNotice, setWrapNotice] = useState(null); // { kind: 'paste', titled } | { kind: 'line', line } | null
  // The notice that what was typed looks like another format (workflow 3
  // §When it looks like another format; songs.format_help Decision 1): the
  // line the cursor is on — a typed line counts once the cursor has left it —
  // the lines a paste brought in, which count at once, and the cases dismissed
  // for the rest of this editing (Decision 4).
  const [cursorLine, setCursorLine] = useState(1);
  const [pastedLines, setPastedLines] = useState(() => new Set());
  const [dismissedHints, setDismissedHints] = useState(() => new Set());
  // The format help (songs.format_help): open or not, and the topic Show me
  // how opened it at. `focusTextOnClose` hands focus to the text once the
  // help has closed after an Insert (workflow 3 L222-227).
  const [help, setHelp] = useState({ open: false, topic: null });
  const helpRef = useRef(null);
  const focusTextOnClose = useRef(false);
  // Marks and the notice are for a song a person is writing, never README.md
  // or a setlist in the raw editor (songs.unknown_tokens_loud Decision 6).
  const song = isSongPath(path);
  // A background sync merged a new version under the unsaved buffer (sync.unsaved
  // → the transient MERGED fact; workflow 8 L55-56). The shown notice —
  // `{ author, commit, summary }` — or null; `mergePending` flags the one re-issued
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
  const freshEntry = sourceEntry && sourceEntry !== staleSourceEntry ? sourceEntry : null;
  const sourceText = freshEntry ? freshEntry.text : undefined;
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
  const changeHandlerRef = useRef(() => {});
  const pasteHandlerRef = useRef(() => false);
  const writeTimer = useRef(null);
  const onWriteRef = useRef(onWrite);
  const pendingWrite = useRef(null);
  const loadedKey = useRef(null);
  // Whether the buffer holds its first document yet (the mirrored `text` is ''
  // until then), and the SOURCE a SAVED for this path marked saved — with the
  // buffer text at that moment — for the unsaved signal below.
  const [loaded, setLoaded] = useState(false);
  const [savedMark, setSavedMark] = useState(null); // { entry, text } | null

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
        onWriteRef.current?.();
      }, WRITE_DEBOUNCE_MS);
    },
    [store, bookId, path],
  );

  // Send a still-debounced edit now and disarm the timer — the one flush that
  // Save, the unmount cleanup and the host (through `flushRef`) all go through
  // (songs.discard_summary Constraint 2). The Worker handles commands in order,
  // so a preview sent after this reads the text as typed; clearing the timer
  // means nothing can land after a DISCARD that follows.
  const flushWrite = useCallback(() => {
    if (writeTimer.current) {
      clearTimeout(writeTimer.current);
      writeTimer.current = null;
    }
    if (pendingWrite.current != null && bookId && path) {
      store.send(command(CommandKind.WRITE, { bookId, path, text: pendingWrite.current }));
      pendingWrite.current = null;
      onWriteRef.current?.();
    }
  }, [store, bookId, path]);

  // CodeMirror's extensions are built once but must call the latest handlers
  // (they close over the current props). The refs are updated in an
  // effect — never during render — and read lazily when an edit or paste fires.
  useEffect(() => {
    onWriteRef.current = onWrite;
    changeHandlerRef.current = (value) => {
      setText(value);
      // Any edit clears a stale save-stop notice and a stale wrap notice; a
      // wrapping paste or Put it in the music re-sets its own notice after its
      // dispatch.
      setSaveError(null);
      setWrapNotice(null);
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
      const hasTitle = parse(view.state.doc.toString()).title !== null;
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
      if (result.wrapped) setWrapNotice({ kind: 'paste', titled: result.titled });
      // Pasted text counts at once (workflow 3): the lines it now spans.
      const doc = view.state.doc;
      const first = doc.lineAt(sel.from).number;
      const last = doc.lineAt(anchor).number;
      const lines = new Set();
      for (let n = first; n <= last; n += 1) lines.add(n);
      setPastedLines(lines);
      return true;
    };
  });

  // Create the CodeMirror view once, under this component's lifetime. bookId/
  // path are stable for a mounted editor (hosts remount via React key for a
  // different song), so the view is not rebuilt on every prop change.
  useEffect(() => {
    const view = new EditorView({
      parent: containerRef.current,
      extensions: [
        ...sourceExtensions({
          label: t('editor.source.sourceLabel'),
          // The words under every red line (songs.editor_errors_in_words).
          lineNote: (d) => lineNoteText(d, t),
          onDocChange: (update) => {
            // The initial on-disk load is not an edit to persist (ExternalLoad):
            // mirror its text into React but schedule no WRITE.
            const external = update.transactions.some((tr) => tr.annotation(ExternalLoad));
            if (external) setText(update.state.doc.toString());
            else changeHandlerRef.current(update.state.doc.toString());
          },
        }),
        EditorView.domEventHandlers({
          paste: (event, cmView) => pasteHandlerRef.current(event, cmView),
        }),
        // The cursor's line, for the bracket notice's timing and the spoken
        // note of a reported line.
        EditorView.updateListener.of((update) => {
          if (!update.selectionSet && !update.docChanged) return;
          const { state } = update;
          setCursorLine(state.doc.lineAt(state.selection.main.head).number);
        }),
        ...(song ? [unknownMarksField({ title: t('editor.source.unknownMark') })] : []),
      ],
    });
    viewRef.current = view;
    if (editorRef) editorRef.current = view;
    // The host's flush (an outside Discard sends the pending edit before its
    // confirm previews — songs.discard_summary Decision 1).
    if (flushRef) flushRef.current = flushWrite;

    return () => {
      // Flush a pending write so closing the editor loses nothing.
      flushWrite();
      view.destroy();
      viewRef.current = null;
      if (editorRef) editorRef.current = null;
      if (flushRef) flushRef.current = null;
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
    setLoaded(true);
  }, [isNew, templateDoc, sourceText, bookId, path]);

  // Ask the Worker for the working-copy text of an existing song, and for a
  // song its reading state too (OPEN_SONG — a plain read): the variation in use
  // per tuning, which the arranging preview chooses into.
  useEffect(() => {
    if (isNew || !bookId || !path) return;
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    if (song) store.send(command(CommandKind.OPEN_SONG, { bookId, path }));
  }, [store, isNew, bookId, path, song]);

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
    setUpdate({ author: hit.author, commit: hit.commit, summary: hit.summary ?? '' });
  });

  // The unsaved signal (sync.in_place_notices Decision 5; W08#3 L96): the last
  // SOURCE's `unsaved` (the Worker compared the working text with HEAD), or an
  // edit since — the buffer no longer reads as that SOURCE's text. A SAVED for
  // this path marks the buffer as it stood saved until the next SOURCE. A new
  // song is unsaved until it is named and saved. A merge's re-read SOURCE says
  // `unsaved: true` under the user's edits, so the mark stays.
  useWorkerEvent(store, EventKind.SAVED, (payload) => {
    if (isNew || payload?.bookId !== bookId) return;
    if (payload.path !== path && !payload.paths?.includes(path)) return;
    setSavedMark({ entry: freshEntry, text: viewRef.current?.state.doc.toString() ?? text });
  });
  let unsaved = false;
  if (isNew) unsaved = true;
  else if (loaded && freshEntry) {
    const saved = savedMark && savedMark.entry === freshEntry;
    const baseText = saved ? savedMark.text : freshEntry.text;
    unsaved = (!saved && freshEntry.unsaved === true) || text !== baseText;
  }
  useEffect(() => {
    onUnsavedChange?.(unsaved);
  }, [onUnsavedChange, unsaved]);

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

  // Read in the song's own notation (cifra.md §5.6; workflow 2 §Reading a
  // song): the preview speaks the song's chords, and the save gate reports what
  // the reader reports. A new song's template writes `notation:` from the
  // preference, so it reads back the same.
  const parsed = useMemo(() => parse(text), [text]);
  // The diagnostics that stop a save (Decision 3; save-blockers.js): a conflict
  // marker, a voicing the reader could not read, and content after the rule the
  // song writer would drop (workflow 4 §Normalising). Everything else the format
  // is happy to normalise.
  const blockers = useMemo(() => saveBlockers(parsed.diagnostics, path), [parsed, path]);
  // What was typed looks like another format (workflow 3 §When it looks like
  // another format): chords in brackets first, then chords outside the music,
  // at the first line that counts — the cursor has left it, or it was pasted.
  // A question, never a stop; it goes when the text no longer holds the case.
  const hint = useMemo(
    () => (song ? formatHint({ text, parsed, cursorLine, pastedLines, dismissed: dismissedHints }) : null),
    [song, text, parsed, cursorLine, pastedLines, dismissedHints],
  );

  // The host's header names the song by its title as the text has it now
  // (songs.editor_chrome Constraint 4; workflow 4 §Editing). Reported from the
  // parse the preview already makes (Decision 6); nothing until the buffer
  // holds its document, so the host shows its own title meanwhile.
  const parsedTitle = loaded ? (parsed.title ?? null) : undefined;

  // What a screen reader hears when the cursor reaches a reported line
  // (songs.editor_errors_in_words Constraint 5, Decision 2): that line's note,
  // in a live region outside the textbox; nothing on an unreported line. It is
  // derived from the cursor's line and the line's first diagnostic, so typing
  // on the same line leaves the region's words — and the announcement — as
  // they are; a change of line, or of the line's first code, sets it anew.
  // The region is there while the text holds any red line, so it is in place
  // before the cursor reaches one (a live region speaks changes, not its
  // arrival), and a song with nothing to say carries no extra status.
  const reportedByLine = useMemo(() => lineDiagnostics(parsed.diagnostics), [parsed]);
  const cursorDiagnostic = reportedByLine.get(cursorLine) ?? null;
  const lineAnnouncement = cursorDiagnostic ? lineNoteText(cursorDiagnostic, t) : '';
  useEffect(() => {
    if (parsedTitle !== undefined) onTitleChange?.(parsedTitle);
  }, [onTitleChange, parsedTitle]);

  // The preview arranges (workflow 4 §Editing; workflow 5): the arrange screen's
  // tappable chart, picker, shapes and variations over the live buffer. A choice
  // is the canonical text `write` makes of the chosen model, put into the buffer
  // as the minimal change — one undo step, the caret mapped through it — so it
  // is an edit like a keystroke: mirrored, debounced into WRITE, saved or
  // discarded with the rest. While the text holds a line that stops a save,
  // `write` could drop it, so the chart reads but takes no taps until it is
  // fixed.
  const canArrange = song && blockers.length === 0;
  const arrangeText = (out) => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (out === current) return;
    view.dispatch({
      changes: minimalChange(current, out),
      userEvent: 'input',
      annotations: isolateHistory.of('full'),
    });
  };
  const arrange = useArrange({
    store,
    bookId,
    path,
    text: song ? text : '',
    onText: arrangeText,
    mode: mode === 'narrow' ? 'narrow' : 'wide',
    canWrite: canArrange,
    chartProps: { label: t('editor.source.previewLabel') },
  });

  const addSection = () => {
    const view = viewRef.current;
    if (!view) return;
    // The end of the chart, not the end of the document: on a song with a
    // voicings appendix the new section must land before the rule, or
    // canonicalise drops it on save (section-insert.js; spec §1.5/§8.2), padded
    // by a blank line on each side.
    const head = '## \n```\n';
    const { from, insert, offset } = sectionInsertion(view.state.doc.toString(), `${head}\n\`\`\``);
    const cursor = from + offset + head.length; // the empty line between the fences
    view.dispatch({ changes: { from, insert }, selection: { anchor: cursor }, scrollIntoView: true });
    view.focus();
  };

  // The help's Insert (workflow 3 §Help with the format; Constraint 4): the
  // example where Add section puts a new part, as one transaction — one undo
  // takes it back — the cursor at its end; the help closes and the text takes
  // focus once it has.
  const insertExample = (example) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, insert, cursor } = exampleInsertion(view.state.doc.toString(), example);
    // Its own undo step, never merged with a keystroke just before it.
    view.dispatch({
      changes: { from, insert },
      selection: { anchor: cursor },
      scrollIntoView: true,
      annotations: isolateHistory.of('full'),
    });
    focusTextOnClose.current = true;
    setHelp({ open: false, topic: null });
  };
  useEffect(() => {
    if (help.open || !focusTextOnClose.current) return;
    focusTextOnClose.current = false;
    viewRef.current?.focus();
  }, [help.open]);

  // Put it in the music (songs.editor_errors_in_words Constraint 6; workflow 3
  // §When it looks like another format): the reported line's paragraph between
  // two fence lines, as its own undo step; the cursor stays on the same text,
  // now inside the fence, and the text takes focus back.
  const putInMusic = (line) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to, insert } = fenceAround(view.state.doc.toString(), line);
    const head = view.state.selection.main.head;
    const opener = insert.indexOf('\n') + 1;
    let anchor = head;
    if (head > to) anchor = head + insert.length - (to - from);
    else if (head >= from) anchor = head + opener;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor },
      userEvent: 'input',
      scrollIntoView: true,
      annotations: isolateHistory.of('full'),
    });
    setWrapNotice({ kind: 'line', line });
    view.focus();
  };

  // The wrap notice's Undo, for a paste and a fenced line alike: one undo
  // reverses exactly the one transaction.
  const undoWrap = () => {
    const view = viewRef.current;
    if (!view) return;
    undo(view);
    setWrapNotice(null);
    view.focus();
  };

  // The gate: true when the save may go ahead (a host's panel confirms only
  // then — songs.editor_chrome Constraint 2).
  const onSavePress = () => {
    if (blockers.length > 0) {
      setSaveError({ line: blockers[0].line, code: blockers[0].code });
      return false;
    }
    setSaveError(null);
    // Send a still-debounced edit now: the Worker handles commands in order,
    // so the save sheet's preview (sent once it opens) reads the text as typed
    // — a Save pressed within the debounce otherwise previews the older text.
    flushWrite();
    onSave?.();
    return true;
  };

  // Publish the gate and Add section to a host that draws them (Decision 7, as
  // `flushRef` is published): re-read every render, so the gate reads the
  // blockers of the text as it is now.
  useEffect(() => {
    if (saveRef) saveRef.current = onSavePress;
    if (addSectionRef) addSectionRef.current = addSection;
    return () => {
      if (saveRef) saveRef.current = null;
      if (addSectionRef) addSectionRef.current = null;
    };
  });

  // Measure the body before paint, then follow it as the window or the panes
  // around the editor resize (songs.editor_split_width Constraints 3, 6-7).
  // The body takes its width from its container, never from which panes show,
  // so a switch cannot change the width that decided it. Crossing under the
  // rule, the toggle opens on the pane that holds focus, so the focused element
  // is never hidden; the text pane is only ever hidden, never unmounted.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const measure = (width) => {
      const prev = bodyWidthRef.current;
      const sameSide = prev && width ? prev >= EDITOR_SPLIT_MIN_WIDTH === width >= EDITOR_SPLIT_MIN_WIDTH : !prev && !width;
      if (sameSide) return;
      bodyWidthRef.current = width;
      if (width && width < EDITOR_SPLIT_MIN_WIDTH) {
        setPreviewTab(Boolean(previewRef.current?.contains(document.activeElement)));
      }
      setBodyWidth(width);
    };
    measure(body.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measure(body.getBoundingClientRect().width));
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  const showStop = Boolean(saveError) && blockers.length > 0;
  let stopMessage = '';
  if (saveError) {
    stopMessage = t(stopMessageKey(saveError.code), { line: saveError.line });
  }

  // The device decides Help's presentation (a sheet on a phone, a popover on a
  // tablet and a computer — workflow 3 L115-118); the editor's own width
  // decides the panes, the Text | Preview toggle and Help's place in the bar
  // (songs.editor_split_width Constraints 4-5). A preview the host withholds
  // stays withheld: text only, no toggle (Decision 3).
  const narrow = mode === 'narrow';
  const split = editorSplits({ width: bodyWidth, mode, previewAllowed });
  const toggle = !split && previewAllowed;
  const showEditorPane = !(toggle && previewTab);
  const showPreviewPane = split || (toggle && previewTab);
  const hostSave = saveRef !== undefined;
  const hostAddSection = addSectionRef !== undefined;
  const helpButton = (
    <Button
      ref={helpRef}
      className={`btn est-editor-help${toggle ? ' narrow' : ''}`}
      aria-expanded={help.open}
      onPress={() => setHelp({ open: true, topic: null })}
    >
      <HelpIcon />
      {t('editor.formatHelp.open')}
    </Button>
  );

  return (
    <div className="est-editor">
      <div className="est-editor-bar">
        {toggle && (
          <ToggleButtonGroup
            className="seg"
            aria-label={t('editor.source.viewToggle')}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[previewTab ? 'preview' : 'text']}
            onSelectionChange={(keys) => setPreviewTab(keys.has('preview'))}
          >
            <ToggleButton id="text">{t('editor.source.text')}</ToggleButton>
            <ToggleButton id="preview">{t('editor.source.preview')}</ToggleButton>
          </ToggleButtonGroup>
        )}
        {/* Help: beside Text | Preview when the editor is too narrow to split
            (a phone, a phone turned sideways, a narrow window), otherwise
            beside Add section — always the editor's own, for a song only
            (songs.format_help Constraints 5-6; songs.editor_split_width). */}
        {song && toggle ? helpButton : null}
        {/* The actions wrap beneath the switch as a unit when they do not fit
            beside it, Save last and right-aligned (shell.narrow_fit
            Decision 5; W14#2, W04 phone). */}
        {hostSave && hostAddSection && !(song && !toggle) ? null : (
          <div className="est-editor-bar-actions">
            {song && !toggle ? helpButton : null}
            {hostAddSection ? null : (
              <Button className="btn" onPress={addSection}>
                {t('editor.source.addSection')}
              </Button>
            )}
            {hostSave ? null : (
              <Button className="btn primary" onPress={onSavePress}>
                {t('editor.source.save')}
              </Button>
            )}
          </div>
        )}
      </div>

      {wrapNotice && (
        <div className="notice accent est-editor-notice" role="status">
          <span className="est-editor-notice-text">
            {wrapNotice.kind === 'line'
              ? t('editor.source.lineFenced', { line: wrapNotice.line })
              : t('editor.source.pasteFenced')}
            {wrapNotice.kind === 'paste' && wrapNotice.titled ? ` ${t('editor.source.pasteTitleAdded')}` : ''}
          </span>
          <Button className="btn" onPress={undoWrap}>
            {t('editor.source.undo')}
          </Button>
        </div>
      )}

      {hint && (
        <div className="notice accent est-editor-notice" role="status">
          <span className="est-editor-notice-text">
            {t(hint.kind === 'bracket' ? 'editor.source.bracketChords' : 'editor.source.unfencedChords', {
              line: hint.line,
            })}
          </span>
          {hint.kind === 'unfenced' ? (
            <Button className="btn est-editor-put-in-music" onPress={() => putInMusic(hint.line)}>
              {t('editor.source.putInMusic')}
            </Button>
          ) : null}
          <Button
            className="btn quiet act est-editor-show-me"
            onPress={() => setHelp({ open: true, topic: hint.topic })}
          >
            {t('editor.source.showMeHow')}
          </Button>
          <Button
            className="btn icon"
            aria-label={t('editor.source.dismissNotice')}
            onPress={() => setDismissedHints((prev) => new Set(prev).add(hint.kind))}
          >
            <DismissIcon />
          </Button>
        </div>
      )}

      {song && (
        <FormatHelp
          presentation={narrow ? 'sheet' : 'popover'}
          isOpen={help.open}
          topic={help.topic}
          triggerRef={helpRef}
          onClose={() => setHelp({ open: false, topic: null })}
          onInsert={insertExample}
        />
      )}

      {/* The merged-under-your-edits notice (sync.in_place_notices; W08#3
          L101-107; workflow 8 L55-56): what happened, a *Came in* row with the
          musical summary of what arrived (only when there is one), and a link
          to the song's history at that commit. */}
      {update && (
        <div className="notice accent est-editor-notice est-editor-update-notice" role="status">
          <div className="est-editor-update-body">
            <span>
              <b>{t('editor.mergedUnderLead', { name: update.author })}</b>
              {t('editor.mergedUnderRest')}
            </span>
            {update.summary ? (
              <div className="diff">
                <div className="d">
                  <span className="k">{t('editor.cameIn')}</span>
                  <span>{update.summary}</span>
                </div>
              </div>
            ) : null}
            <Button
              className="act btn quiet"
              onPress={() => onOpenHistory({ bookId, path, commit: update.commit })}
            >
              {t('editor.seeWhatCameIn')}
            </Button>
          </div>
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

      {reportedByLine.size > 0 ? (
        <div className="visually-hidden est-line-announce" role="status" aria-live="polite">
          {lineAnnouncement}
        </div>
      ) : null}

      <div ref={bodyRef} className={`est-editor-body${split ? ' split' : ''}`}>
        <div className="est-editor-pane" hidden={!showEditorPane}>
          <div ref={containerRef} className="est-cm" />
        </div>
        {showPreviewPane && (
          // The preview scrolls on its own under the frame (shell.full_height)
          // and holds no control, so it takes focus itself — a named region
          // the keyboard can reach and scroll (axe scrollable-region-focusable),
          // the scroll-region case jsx-a11y's rule documents as legitimate.
          <div
            ref={previewRef}
            className="est-editor-pane est-editor-preview"
            role="region"
            aria-label={t('editor.source.preview')}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
          >
            {arrange.enterScreen}
            {/* Kept mounted (hidden) while a shape is entered, so the chord
                that opened the picker is there to take focus back. */}
            <div className="est-editor-preview-body" hidden={arrange.entering}>
              <div className="est-editor-preview-head">
                <div className="t-h3">{t('editor.source.preview')}</div>
                {song && arrange.entry ? <InstrumentChip store={store} onOpen={arrange.openInstruments} /> : null}
              </div>
              {song ? (
                <>
                  <p className="t-small est-editor-arrange-hint">
                    {canArrange ? t('arrange.modeHint') : t('editor.source.arrangeBlocked')}
                  </p>
                  {arrange.variationSelector}
                  {arrange.chart}
                  {arrange.shapesStrip}
                  <div className="est-editor-arrange-actions">
                    {arrange.chooseEveryButton}
                    <Button className="btn" isDisabled={!canArrange} onPress={arrange.openAddVariation}>
                      {t('arrange.variations')}
                    </Button>
                  </div>
                </>
              ) : (
                <Chart model={parsed} label={t('editor.source.previewLabel')} />
              )}
            </div>
          </div>
        )}
      </div>
      {song ? arrange.overlays : null}
    </div>
  );
}

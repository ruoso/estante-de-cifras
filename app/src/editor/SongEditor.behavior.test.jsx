// Behavior — the source editor working with its real collaborators (React Aria,
// i18n, a loopback-backed store with seeded `source`/`preferences` slices,
// CodeMirror). Pins workflow 3 §The editor / §The notation property / §Pasting
// a cifra, workflow 4 §Normalising, and spec §7.4 / §11.12.3. axe (WCAG 2.1 AA)
// over every state. The `editorRef` prop is the test seam onto the live
// CodeMirror view (the same ref a host would hold). Fixtures are purpose-written
// songs.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent, act, waitFor } from '@testing-library/react';
import { undo } from '@codemirror/commands';
import { write, parse } from 'cifra-md';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { t } from '../i18n/index.js';
import { template } from './template.js';
import SongEditor from './SongEditor.jsx';

// CodeMirror measures text geometry with Range.getClientRects during its async
// measure pass; jsdom has no layout and does not implement it, which would
// surface as an unhandled error. Stub it so the measure pass is a no-op here —
// real geometry (wrapping, the gutter, scrolling) is covered at the e2e level.
Range.prototype.getClientRects = function getClientRects() {
  return [];
};
Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
};

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const firePaste = (node, text) =>
  act(() => {
    fireEvent.paste(node, { clipboardData: { getData: () => text } });
  });

const BOOK = 'local-example-book';
const PATH = 'tide.cifra.md';

describe('SongEditor', () => {
  it('opens a new song on the template, with the preference dialect and the cursor in the fence', async () => {
    const { store, emit } = makeStore();
    emit(event(EventKind.PREFERENCES, { notation: { value: 'american', at: 1 } }));
    const editorRef = { current: null };
    const { container } = render(
      <SongEditor store={store} isNew layoutMode="wide" editorRef={editorRef} onSave={() => {}} />,
    );

    const expected = template({ notation: { value: 'american' } });
    expect(editorRef.current.state.doc.toString()).toBe(expected.text);
    expect(editorRef.current.state.doc.toString()).toContain('- notation: american');
    // The cursor sits on the empty line inside the section's fence.
    const head = editorRef.current.state.selection.main.head;
    expect(editorRef.current.state.doc.lineAt(head).text).toBe('');
    expect(head).toBe(expected.cursor);
    // The preview renders the parsed song beside the text.
    expect(container.querySelector('.chart .sec-name')?.textContent).toBe('Intro');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('opens on its own OPEN_SOURCE reply, not text an earlier open left in the slice (a discard after reopening)', () => {
    const { store, sent, emit } = makeStore();
    // An earlier open of the song read the edited text into the slice.
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: '# Tide\n\n## Intro\n```\nG | C | Em\n```\n' }));
    const editorRef = { current: null };
    render(<SongEditor store={store} bookId={BOOK} path={PATH} editorRef={editorRef} onSave={() => {}} />);
    // The stale entry is not adopted; this mount asks the Worker.
    expect(editorRef.current.state.doc.toString()).toBe('');
    expect(sent.filter((c) => c.kind === CommandKind.OPEN_SOURCE)).toHaveLength(1);
    // The Worker answers with the reverted working copy, which is what shows.
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: '# Tide\n\n## Intro\n```\nG | C\n```\n' }));
    expect(editorRef.current.state.doc.toString()).toContain('G | C\n');
    expect(editorRef.current.state.doc.toString()).not.toContain('Em');
  });

  it('adds a section and puts the cursor on the empty line inside its fence, by keyboard', () => {
    const { store, emit } = makeStore();
    emit(event(EventKind.PREFERENCES, { notation: { value: 'brazilian', at: 1 } }));
    const editorRef = { current: null };
    render(<SongEditor store={store} isNew layoutMode="wide" editorRef={editorRef} onSave={() => {}} />);

    const button = screen.getByRole('button', { name: t('editor.source.addSection') });
    act(() => {
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyUp(button, { key: 'Enter' });
    });

    const state = editorRef.current.state;
    const cursorLine = state.doc.lineAt(state.selection.main.head);
    expect(cursorLine.text).toBe(''); // the empty line
    expect(state.doc.line(cursorLine.number - 1).text).toBe('```'); // fence open above
    expect(state.doc.line(cursorLine.number + 1).text).toBe('```'); // fence close below
  });

  it('adds a section in the body (not the voicings appendix) on a song with voicings, and the section survives a save', async () => {
    // songs.editor_section_after_voicings: on a song whose chart is followed by
    // a `---` / `## Voicings:` appendix, Add section must insert BEFORE the rule
    // (the end of the chart), or canonicalise drops the section on save (spec
    // §1.5/§8.2; corpus/29-voicings-part). Pins the note's behavior clause.
    const { store, emit } = makeStore();
    const editorRef = { current: null };
    const SONG = [
      '# Lua Nova',
      '',
      '## Primeira Parte',
      '```',
      'G  D',
      '```',
      '',
      '---',
      '',
      '## Voicings: E2 A2 D3 G3 B3 E4',
      '- G: 320003',
      '',
    ].join('\n');
    const { container } = render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={() => {}} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: SONG }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(SONG));

    const button = screen.getByRole('button', { name: t('editor.source.addSection') });
    act(() => {
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyUp(button, { key: 'Enter' });
    });

    const state = editorRef.current.state;
    const doc = state.doc.toString();
    // The new section's heading + empty fence lands in the chart, before the
    // rule and the voicing block — not at the document end inside the appendix.
    const headingAt = doc.indexOf('\n## \n'); // the new empty `## ` heading line
    const ruleAt = doc.indexOf('\n---\n');
    const voicingsAt = doc.indexOf('## Voicings:');
    expect(headingAt).toBeGreaterThan(-1);
    expect(headingAt).toBeLessThan(ruleAt);
    expect(headingAt).toBeLessThan(voicingsAt);
    // A blank line separates the new section from the following rule.
    expect(doc).toContain('```\n\n---\n');

    // The cursor sits on the empty line inside the new fence.
    const cursorLine = state.doc.lineAt(state.selection.main.head);
    expect(cursorLine.text).toBe('');
    expect(state.doc.line(cursorLine.number - 1).text).toBe('```'); // fence open above
    expect(state.doc.line(cursorLine.number + 1).text).toBe('```'); // fence close below

    // The save round-trips the new section: canonicalising the buffer the way
    // the Worker's save does (write ∘ parse) keeps the section in the chart (an
    // empty section serialises as `##`), before the voicings part — whereas the
    // same section appended AFTER the rule is dropped (spec §8.2).
    const saved = write(parse(doc));
    const savedHeadingAt = saved.indexOf('\n##\n');
    const savedVoicingsAt = saved.indexOf('## Voicings:');
    expect(savedHeadingAt).toBeGreaterThan(-1);
    expect(savedHeadingAt).toBeLessThan(savedVoicingsAt);
    const preFix = `${SONG}\n## \n\`\`\`\n\n\`\`\``; // the pre-fix behaviour: append at document end
    expect(write(parse(preFix))).not.toContain('\n##\n');

    // No UI change — the editor stays accessible.
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('wraps a pasted cifra in a fence and promotes its title, reversible by the notice and by undo', async () => {
    const { store, emit } = makeStore();
    const editorRef = { current: null };
    const { container } = render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={() => {}} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: '## Intro\n\n' }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe('## Intro\n\n'));

    const content = container.querySelector('.cm-content');
    const PASTE = 'Maré Mansa\n[Intro] Am  G\nA maré veio mansa';
    act(() => editorRef.current.dispatch({ selection: { anchor: editorRef.current.state.doc.length } }));
    firePaste(content, PASTE);

    const doc = editorRef.current.state.doc.toString();
    expect(doc.startsWith('# Maré Mansa\n')).toBe(true);
    expect(doc).toContain('```\n[Intro] Am  G');
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(t('editor.source.pasteTitleAdded'));
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // The notice's Undo reverts the whole move.
    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.source.undo') })));
    expect(editorRef.current.state.doc.toString()).toBe('## Intro\n\n');
    expect(screen.queryByRole('status')).toBeNull();

    // A plain editor undo reverts it too (the move is one history step).
    act(() => editorRef.current.dispatch({ selection: { anchor: editorRef.current.state.doc.length } }));
    firePaste(content, PASTE);
    expect(editorRef.current.state.doc.toString().startsWith('# Maré Mansa\n')).toBe(true);
    act(() => undo(editorRef.current));
    expect(editorRef.current.state.doc.toString()).toBe('## Intro\n\n');
  });

  it('stops the save on a voicing the reader cannot read, and proceeds once it is gone', async () => {
    const { store, emit } = makeStore();
    const onSave = vi.fn();
    const editorRef = { current: null };
    const BAD = [
      '# Tarde Clara',
      '## Primeira Parte',
      '```',
      'G  D',
      '```',
      '',
      '---',
      '',
      '## Voicings: E2 A2 D3 G3 B3 E4',
      '- G: 320003',
      '- Em: 02200', // line 11 — 5 frets for a 6-string tuning (§7.4)
    ].join('\n');
    const { container } = render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={onSave} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: BAD }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(BAD));

    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.source.save') })));
    expect(onSave).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(t('editor.source.notSaved'));
    expect(alert).toHaveTextContent('11'); // the line number, carried by a word
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Delete the offending last line; the stop clears and Save goes through.
    act(() => {
      const doc = editorRef.current.state.doc;
      const last = doc.line(doc.lines);
      editorRef.current.dispatch({ changes: { from: last.from - 1, to: doc.length } });
    });
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.source.save') })));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('stops the save on a section typed after the rule, and saves it once the rule moves below it', async () => {
    // songs.save_gate_dropped_section — a `---` typed above a section out of
    // Markdown habit makes the section a heading with no tuning in the voicings
    // part, which canonicalising drops (spec §7.2, §8.2). Pins workflow 4
    // §Normalising: the save stops at the heading's line with the after-rule
    // message, and moving the rule below the section unblocks it and keeps it.
    const { store, emit } = makeStore();
    const onSave = vi.fn();
    const editorRef = { current: null };
    const SONG = [
      '# Tarde Clara',
      '',
      '## Primeira Parte',
      '```',
      'G  D',
      '```',
      '',
      '---',
      '',
      '## Refrão', // line 10
      '```',
      'C | G | Am',
      '```',
      '',
    ].join('\n');
    const { container } = render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={onSave} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: SONG }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(SONG));

    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.source.save') })));
    expect(onSave).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(t('editor.source.notSaved'));
    expect(alert).toHaveTextContent(t('editor.source.afterRuleStop', { line: 10 }));
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Move the rule below the section: delete the `---` line (and the blank
    // after it), then append a rule at the end — the section is now in the chart.
    act(() => {
      const doc = editorRef.current.state.doc;
      const rule = doc.line(8);
      editorRef.current.dispatch({
        changes: [
          { from: rule.from, to: doc.line(9).to + 1 },
          { from: doc.length, insert: '\n---\n' },
        ],
      });
    });
    const moved = editorRef.current.state.doc.toString();
    expect(moved.indexOf('## Refrão')).toBeLessThan(moved.indexOf('---'));
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.source.save') })));
    expect(onSave).toHaveBeenCalledTimes(1);

    // The save round-trips the section: canonicalising the buffer as the
    // Worker's save does (write ∘ parse) keeps its heading and its bar line.
    const saved = write(parse(moved));
    expect(saved).toContain('## Refrão');
    expect(saved).toContain('C | G | Am');
    // Whereas the stopped buffer would have lost them (spec §8.2).
    expect(write(parse(SONG))).not.toContain('## Refrão');
  });

  it('sends a still-debounced edit before Save hands over, so the save sheet sees it', async () => {
    const { store, sent, emit } = makeStore();
    const editorRef = { current: null };
    const writesAtSave = [];
    const onSave = () => writesAtSave.push(...sent.filter((c) => c.kind === CommandKind.WRITE));
    render(<SongEditor store={store} bookId={BOOK} path={PATH} editorRef={editorRef} onSave={onSave} />);
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: '# Tide\n' }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe('# Tide\n'));

    // An edit, then Save at once — well inside the write debounce.
    act(() => editorRef.current.dispatch({ changes: { from: 7, insert: '- key: G\n' } }));
    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.source.save') })));

    expect(writesAtSave).toHaveLength(1);
    expect(writesAtSave[0].payload.text).toBe('# Tide\n- key: G\n');
  });

  it('stops the save on a conflict-marker buffer', async () => {
    const { store, emit } = makeStore();
    const onSave = vi.fn();
    const editorRef = { current: null };
    const MARKED = ['# Song', '```', '<<<<<<< ours', 'Am', '=======', 'C', '>>>>>>> theirs', '```'].join('\n');
    render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={onSave} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: MARKED }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(MARKED));

    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.source.save') })));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t('editor.source.notSaved'));
  });

  it('shows the preview beside the text on wide, and a tap away on narrow', () => {
    const { store, emit } = makeStore();
    emit(event(EventKind.PREFERENCES, { notation: { value: 'brazilian', at: 1 } }));

    const wide = render(<SongEditor store={store} isNew layoutMode="wide" onSave={() => {}} />);
    expect(wide.container.querySelector('.est-editor-body.split')).not.toBeNull();
    expect(wide.container.querySelector('.cm-editor')).not.toBeNull();
    expect(wide.container.querySelector('.chart')).not.toBeNull();
    wide.unmount();

    const { container } = render(<SongEditor store={store} isNew layoutMode="narrow" onSave={() => {}} />);
    // Phone: the editor shows, the preview is a tap away (no chart yet).
    expect(container.querySelector('.chart')).toBeNull();
    // RAC's single-select ToggleButtonGroup is a radiogroup of radios.
    const previewTab = screen.getByRole('radio', { name: t('editor.source.preview') });
    act(() => fireEvent.click(previewTab));
    expect(container.querySelector('.chart')).not.toBeNull();
  });

  // songs.edit_in_place — a sync merges a new version under the open editor's
  // unsaved edits (sync.unsaved emits the transient MERGED fact). The editor is
  // the one React layer over the live buffer, so the swap + notice live here and
  // every host inherits them. Pins workflow 8 §"A song open while it changes"
  // L55-56 and the MERGED payload (protocol.js:372-392).
  const V1 = ['# Tide', '', '## Verse', '```', 'C  G  Am  F', '```', ''].join('\n');
  const BRIDGE = ['## Bridge', '```', 'Dm  G', '```', ''].join('\n');

  it('swaps to the merged working text keeping the caret, shows the Updated-by notice, and opens history', async () => {
    const { store, emit } = makeStore();
    const onOpenHistory = vi.fn();
    const editorRef = { current: null };
    const { container } = render(
      <SongEditor
        store={store}
        bookId={BOOK}
        path={PATH}
        layoutMode="wide"
        editorRef={editorRef}
        onSave={() => {}}
        onOpenHistory={onOpenHistory}
      />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: V1 }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(V1));

    // The caret sits early in the prefix the merge leaves untouched.
    const caret = V1.indexOf('Verse');
    act(() => editorRef.current.dispatch({ selection: { anchor: caret } }));

    // The incoming author appends a bridge; the prefix (and the caret) is untouched.
    const MERGED = V1 + BRIDGE;
    emit(event(EventKind.MERGED, { bookId: BOOK, changed: [{ path: PATH, author: 'Ana Luiza', commit: 'abc123' }] }));
    // The merged bytes are served on the re-issued OPEN_SOURCE (demand-driven, D2).
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: MERGED }));

    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(MERGED));
    // The caret kept its place through the swap (Decision 3).
    expect(editorRef.current.state.selection.main.head).toBe(caret);

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(t('editor.updatedBy', { name: 'Ana Luiza' }));
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // "See what changed" opens the song's history at the incoming commit.
    act(() => fireEvent.click(within(notice).getByRole('button', { name: t('editor.seeWhatChanged') })));
    expect(onOpenHistory).toHaveBeenCalledWith({ bookId: BOOK, path: PATH, commit: 'abc123' });

    // The notice is dismissible.
    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.updateDismiss') })));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('cancels the pending pre-merge write so nothing clobbers the merge on disk', async () => {
    const { store, sent, emit } = makeStore();
    const editorRef = { current: null };
    const { unmount } = render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={() => {}} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: V1 }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(V1));

    // The user types; a debounced WRITE holding the pre-merge buffer is now pending.
    const EDITED = V1.replace('C  G  Am  F', 'C  G  Am  F  Dm');
    act(() =>
      editorRef.current.dispatch({ changes: { from: 0, to: editorRef.current.state.doc.length, insert: EDITED } }),
    );

    // A merge lands (the merge already folded the flushed edit in as `ours`). The
    // editor cancels the in-flight pre-merge WRITE and adopts the merged bytes.
    const MERGED = EDITED + BRIDGE;
    emit(event(EventKind.MERGED, { bookId: BOOK, changed: [{ path: PATH, author: 'Ana', commit: 'c1' }] }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: MERGED }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(MERGED));

    // Unmount flushes whatever write is pending. It must be the merged text — the
    // stale pre-merge write was cancelled, so it never reaches the working copy.
    unmount();
    const writes = sent.filter((m) => m.kind === CommandKind.WRITE);
    expect(writes.some((m) => m.payload.text === EDITED)).toBe(false);
    expect(writes[writes.length - 1].payload.text).toBe(MERGED);
  });

  it('shows a conflicting merge’s marked text and the save gate blocks saving it', async () => {
    // The workflow-9 boundary (sync.conflicts is out of scope): a conflicting
    // re-merge writes the `marked` text; the editor adopts it and the existing
    // pre-save gate blocks Save (workflow 4 §Normalising L47-56, editor.md D3).
    const { store, emit } = makeStore();
    const onSave = vi.fn();
    const editorRef = { current: null };
    render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={onSave} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: V1 }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(V1));

    const MARKED = ['# Tide', '```', '<<<<<<< ours', 'C', '=======', 'Am', '>>>>>>> theirs', '```', ''].join('\n');
    emit(event(EventKind.MERGED, { bookId: BOOK, changed: [{ path: PATH, author: 'Ana', commit: 'c1' }] }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: MARKED }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(MARKED));

    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.source.save') })));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t('editor.source.notSaved'));
  });

  it('ignores a MERGED naming another song or book — the open buffer is untouched', async () => {
    const { store, sent, emit } = makeStore();
    const editorRef = { current: null };
    render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={() => {}} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: V1 }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(V1));

    const openSourceBefore = sent.filter((m) => m.kind === CommandKind.OPEN_SOURCE).length;
    // A different path in the same book, then this path in a different book.
    emit(event(EventKind.MERGED, { bookId: BOOK, changed: [{ path: 'other.cifra.md', author: 'Ana', commit: 'c1' }] }));
    emit(event(EventKind.MERGED, { bookId: 'other-book', changed: [{ path: PATH, author: 'Ana', commit: 'c1' }] }));

    expect(editorRef.current.state.doc.toString()).toBe(V1);
    expect(screen.queryByRole('status')).toBeNull();
    // No merge re-read was issued for a fact that is not ours.
    expect(sent.filter((m) => m.kind === CommandKind.OPEN_SOURCE).length).toBe(openSourceBefore);
  });
});

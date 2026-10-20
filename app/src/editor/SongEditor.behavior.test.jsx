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
import { parseChord } from '../core/notation/parse.js';
import { speakChord } from '../render/chord-speech.js';
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

  it('saves a README with a rule and a heading under it, with no after-rule stop (workflow 14 L73)', async () => {
    // books.save_readme_verbatim Decision 4 — README.md is saved as written, not
    // through the song writer, so a `---` and the `## Usage` under it drop
    // nothing and the after-rule stop does not apply (it still does for a song, above).
    const { store, emit } = makeStore();
    const onSave = vi.fn();
    const editorRef = { current: null };
    const README = '# Livro de Ensaio\n\nNotas do grupo.\n\n---\n\n## Usage\n\nAbra uma cifra.\n';
    const { container } = render(
      <SongEditor store={store} bookId={BOOK} path="README.md" layoutMode="wide" editorRef={editorRef} onSave={onSave} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: 'README.md', text: README }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(README));
    // The reader does flag the heading after the rule…
    expect(parse(README).diagnostics.map((d) => d.code)).toContain('bad-block-heading');

    // …but on README.md it stops nothing.
    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.source.save') })));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
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

  // songs.discard_summary Constraint 2: the host's flush (an outside Discard)
  // sends the pending edit and disarms the timer, so nothing can follow a DISCARD.
  it('a host flush sends the still-debounced edit once, and nothing after', async () => {
    const { store, sent, emit } = makeStore();
    const editorRef = { current: null };
    const flushRef = { current: null };
    const { unmount } = render(
      <SongEditor store={store} bookId={BOOK} path={PATH} editorRef={editorRef} flushRef={flushRef} onSave={() => {}} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: '# Tide\n' }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe('# Tide\n'));
    expect(typeof flushRef.current).toBe('function');

    act(() => editorRef.current.dispatch({ changes: { from: 7, insert: '- key: G\n' } }));
    act(() => flushRef.current());

    const writes = () => sent.filter((c) => c.kind === CommandKind.WRITE);
    expect(writes()).toHaveLength(1);
    expect(writes()[0].payload).toMatchObject({ bookId: BOOK, path: PATH, text: '# Tide\n- key: G\n' });

    // Past the editor's 400 ms write debounce, then unmount: no second WRITE.
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    unmount();
    expect(writes()).toHaveLength(1);
    // The editor clears the host's ref on unmount, so a later call is a no-op.
    expect(flushRef.current).toBeNull();
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

  // songs.song_notation_views — the preview reads the song in its own notation
  // (cifra.md §5.6; workflow 2 §Reading a song, "wherever the song is read"),
  // never the user's preference: cifra-md reports the reading taken per chord
  // item, and the preview speaks it.
  it('the preview reads an american song\'s C7+ as the sharp fifth under a brazilian preference', async () => {
    const { store, emit } = makeStore();
    emit(event(EventKind.PREFERENCES, { notation: { value: 'brazilian', at: 1 } }));
    const editorRef = { current: null };
    const AMERICAN = ['# Brass Lantern', '- notation: american', '', '## A', '```', 'C7+', '```', ''].join('\n');
    const { container } = render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={() => {}} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: AMERICAN }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(AMERICAN));

    const sharpFifth = speakChord(parseChord('C7+', 'american').chord, { t });
    const majorSeventh = speakChord(parseChord('C7+', 'brazilian').chord, { t });
    // The brazilian reading would speak another chord, so this can fail.
    expect(sharpFifth).not.toBe(majorSeventh);
    const chart = container.querySelector('.est-editor-preview .chart');
    await waitFor(() => expect(within(chart).getByText(sharpFifth)).toBeInTheDocument());
    expect(within(chart).queryByText(majorSeventh)).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  // songs.edit_in_place — a sync merges a new version under the open editor's
  // unsaved edits (sync.unsaved emits the transient MERGED fact). The editor is
  // the one React layer over the live buffer, so the swap + notice live here and
  // every host inherits them. Pins workflow 8 §"A song open while it changes"
  // L55-56 and the MERGED payload (protocol.js:372-392).
  const V1 = ['# Tide', '', '## Verse', '```', 'C  G  Am  F', '```', ''].join('\n');
  const BRIDGE = ['## Bridge', '```', 'Dm  G', '```', ''].join('\n');

  it('a merge under unsaved edits says it was merged under your changes, with what came in (sync.in_place_notices; W08#3 L101-107; workflow 8 L55-56)', async () => {
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
    // The summary is written for the test (the Worker's diff summary in life).
    emit(
      event(EventKind.MERGED, {
        bookId: BOOK,
        changed: [{ path: PATH, author: 'Ana Luiza', commit: 'abc123', summary: 'Bridge: added' }],
      }),
    );
    // The merged bytes are served on the re-issued OPEN_SOURCE (demand-driven, D2).
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: MERGED, unsaved: true }));

    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(MERGED));
    // The caret kept its place through the swap (Decision 3).
    expect(editorRef.current.state.selection.main.head).toBe(caret);

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(
      "Ana Luiza's save came in while you were editing, and was merged under your changes. Yours are still here, unsaved, on top.",
    );
    // The lead clause is bold, as W08#3 L102 draws it.
    expect(notice.querySelector('b')).toHaveTextContent("Ana Luiza's save came in while you were editing");
    // The *Came in* row carries the summary of what arrived.
    const row = within(notice).getByText('Came in').closest('.d');
    expect(row).toHaveTextContent('Bridge: added');
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // "See what came in" opens the song's history at the incoming commit.
    act(() => fireEvent.click(within(notice).getByRole('button', { name: 'See what came in' })));
    expect(onOpenHistory).toHaveBeenCalledWith({ bookId: BOOK, path: PATH, commit: 'abc123' });

    // The notice is dismissible.
    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.updateDismiss') })));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('no Came in row when the merge brought no summary (sync.in_place_notices; W08#3 L103-105)', async () => {
    const { store, emit } = makeStore();
    const editorRef = { current: null };
    render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={() => {}} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: V1 }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(V1));

    emit(event(EventKind.MERGED, { bookId: BOOK, changed: [{ path: PATH, author: 'Ana', commit: 'c1', summary: '' }] }));
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent("Ana's save came in while you were editing, and was merged under your changes.");
    expect(within(notice).queryByText('Came in')).toBeNull();
    expect(within(notice).getByRole('button', { name: 'See what came in' })).toBeInTheDocument();
  });

  it('reports unsaved from SOURCE and from an edit, cleared by SAVED (sync.in_place_notices; W08#3 L96)', async () => {
    const { store, emit } = makeStore();
    const editorRef = { current: null };
    const onUnsavedChange = vi.fn();
    const last = () => onUnsavedChange.mock.calls.at(-1)?.[0];
    render(
      <SongEditor
        store={store}
        bookId={BOOK}
        path={PATH}
        layoutMode="wide"
        editorRef={editorRef}
        onSave={() => {}}
        onUnsavedChange={onUnsavedChange}
      />,
    );
    // In step with the last save.
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: V1, unsaved: false }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(V1));
    await waitFor(() => expect(last()).toBe(false));

    // A typed change.
    act(() => editorRef.current.dispatch({ changes: { from: V1.length, insert: BRIDGE } }));
    await waitFor(() => expect(last()).toBe(true));

    // Saved: cleared. A SAVED for another path leaves it alone first.
    emit(event(EventKind.SAVED, { bookId: BOOK, paths: ['other.cifra.md'], commit: 'c0' }));
    expect(last()).toBe(true);
    emit(event(EventKind.SAVED, { bookId: BOOK, paths: [PATH], commit: 'c2' }));
    await waitFor(() => expect(last()).toBe(false));

    // A SOURCE whose working text differs from HEAD: unsaved again.
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: V1 + BRIDGE, unsaved: true }));
    await waitFor(() => expect(last()).toBe(true));
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

// songs.unknown_tokens_loud §Acceptance 2-3: the words the reader does not
// read as chords are marked as typed (workflow 4 §Editing; spec §2.9), and a
// bracket heading named by a chord raises the *Chords in brackets* notice
// (workflow 3 §When it looks like another format; spec §1.7.2). Neither stops a
// save.
// songs.render_notes — usability finding M1: a song written as bracket chords on
// plain lines (no fence) is all notes (cifra.md §1.9; workflow 3 L93-96), and
// the preview, the reading Chart (editor.md AC5), shows those lines as written
// instead of a blank preview. axe over the preview with notes.
describe('SongEditor — the preview shows notes', () => {
  const PLAIN = ['# Trilha Curta', '', '[G]Walk the [C]road', 'down to the [D]water', ''].join('\n');

  it('shows a bracket-chord song with no fence in the preview, as written (wide)', async () => {
    const { store, emit } = makeStore();
    const editorRef = { current: null };
    const { container } = render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={() => {}} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: PLAIN }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(PLAIN));

    const preview = screen.getByRole('region', { name: t('editor.source.preview') });
    const note = within(preview).getByText(/\[G\]Walk the \[C\]road/);
    expect(note.tagName).toBe('P');
    expect(note.textContent).toBe('[G]Walk the [C]road\ndown to the [D]water');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('shows the same behind the Preview tab on narrow', async () => {
    const { store, emit } = makeStore();
    const editorRef = { current: null };
    const { container } = render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="narrow" editorRef={editorRef} onSave={() => {}} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: PLAIN }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(PLAIN));

    act(() => fireEvent.click(screen.getByRole('radio', { name: t('editor.source.preview') })));
    const preview = screen.getByRole('region', { name: t('editor.source.preview') });
    expect(within(preview).getByText(/\[G\]Walk the \[C\]road/).textContent).toBe('[G]Walk the [C]road\ndown to the [D]water');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

// The test song for songs.trailing_chord_gap, written for the purpose: Fmaj7 a
// few columns past "tarde", A7 exactly at the end of "barco" — the two
// attachments cifra.md §4.4 gives "past the end" (words: '').
const PORTO_SONG = [
  '# Porto de Lenha',
  '',
  '## Verso',
  '```',
  'C                     Fmaj7',
  'Vem a maré da tarde',
  'G           A7',
  'leva o barco',
  '```',
  '',
].join('\n');

// songs.trailing_chord_gap — the preview (the reading Chart, editor.md AC5)
// draws a chord written past the end of its sung line as a `tail` segment, kept
// apart from the last word (cifra.md §4.4, §4.8). The geometry is pinned at
// e2e-web; axe over the preview.
describe('SongEditor — a chord after the last word in the preview', () => {
  it('the preview draws a chord after the last word apart from it', async () => {
    const { store, emit } = makeStore();
    const editorRef = { current: null };
    const { container } = render(
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={() => {}} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: '' }));
    await waitFor(() => expect(editorRef.current).not.toBeNull());
    // Typed into the editor: the whole song as one edit, as a user's typing lands.
    act(() => {
      const view = editorRef.current;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: PORTO_SONG } });
    });

    const preview = screen.getByRole('region', { name: t('editor.source.preview') });
    await waitFor(() => expect(preview.querySelectorAll('.chart .s.tail').length).toBe(2));
    const tails = Array.from(preview.querySelectorAll('.chart .s.tail'));
    expect(tails.map((s) => s.querySelector('.c').textContent)).toEqual(['Fmaj7', 'A7']);
    expect(tails.every((s) => s.querySelector('.w').textContent === '')).toBe(true);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

describe('SongEditor — words not read as chords', () => {
  const BRACKETS = ['# Tarde Clara', '', '```', '[Am]Teste [G]linha', '```', ''].join('\n');
  const bracketNotice = (line) => t('editor.source.bracketChords', { line });

  async function open(text, path = PATH, onSave = () => {}) {
    const { store, emit } = makeStore();
    const editorRef = { current: null };
    const utils = render(
      <SongEditor store={store} bookId={BOOK} path={path} layoutMode="wide" editorRef={editorRef} onSave={onSave} />,
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path, text }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(text));
    return { ...utils, editorRef };
  }

  it('marks every word it does not read as a chord', async () => {
    const onSave = vi.fn();
    const { container } = await open(BRACKETS, PATH, onSave);

    const marks = [...container.querySelectorAll('.est-unknown')];
    expect(marks.map((m) => m.textContent)).toEqual(['Teste', '[G]linha']);
    for (const m of marks) expect(m).toHaveAttribute('title', t('editor.source.unknownMark'));
    // The bracket heading reads as a chord: the notice names its line, in words.
    expect(screen.getByRole('status')).toHaveTextContent(bracketNotice(4));
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // A question, never a stop: Save goes through.
    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.source.save') })));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('marks follow the text: a word in a bar, and none once it is a chord', async () => {
    const SONG = ['# Tarde Clara', '', '## Parte', '```', '| G | C | fine |', '```', ''].join('\n');
    const { container, editorRef } = await open(SONG);
    expect([...container.querySelectorAll('.est-unknown')].map((m) => m.textContent)).toEqual(['fine']);
    expect(screen.queryByRole('status')).toBeNull();

    act(() => {
      const at = editorRef.current.state.doc.toString().indexOf('fine');
      editorRef.current.dispatch({ changes: { from: at, to: at + 4, insert: 'D7' } });
    });
    expect(container.querySelectorAll('.est-unknown')).toHaveLength(0);
  });

  it('dismisses the bracket notice and keeps it away while editing', async () => {
    const { editorRef } = await open(BRACKETS);
    const dismiss = screen.getByRole('button', { name: t('editor.source.dismissNotice') });
    act(() => fireEvent.click(dismiss));
    expect(screen.queryByText(bracketNotice(4))).toBeNull();

    // Another keystroke, a new bracket chord even: it stays away for this editing.
    act(() => {
      const end = editorRef.current.state.doc.length;
      editorRef.current.dispatch({ changes: { from: end, insert: '\n```\n[G7]linha\n```\n' }, selection: { anchor: 0 } });
    });
    expect(screen.queryByText(/looks like chords in brackets/)).toBeNull();
  });

  it('goes on its own when the text no longer holds the case', async () => {
    const { editorRef } = await open(BRACKETS);
    expect(screen.getByText(bracketNotice(4))).toBeInTheDocument();
    act(() => {
      const doc = editorRef.current.state.doc;
      const line = doc.line(4);
      editorRef.current.dispatch({ changes: { from: line.from, to: line.to, insert: '[Refrão]' }, selection: { anchor: 0 } });
    });
    expect(screen.queryByText(/looks like chords in brackets/)).toBeNull();
  });

  it('a typed bracket line waits for the cursor to leave it', async () => {
    const SONG = ['# Tarde Clara', '', '```', '', '```', ''].join('\n');
    const { editorRef } = await open(SONG);
    const lineFrom = editorRef.current.state.doc.line(4).from;
    // Typed key by key, the cursor following: no notice halfway through `[A`,
    // nor once `[Am]` is complete while the cursor is still on its line.
    for (const ch of '[Am]') {
      act(() => {
        const head = editorRef.current.state.selection.main.head;
        const at = head < lineFrom ? lineFrom : head;
        editorRef.current.dispatch({ changes: { from: at, insert: ch }, selection: { anchor: at + 1 }, userEvent: 'input.type' });
      });
      expect(screen.queryByText(/looks like chords in brackets/)).toBeNull();
    }
    // The cursor moves to another line: now the line counts.
    act(() => editorRef.current.dispatch({ selection: { anchor: 0 } }));
    expect(screen.getByText(bracketNotice(4))).toBeInTheDocument();
  });

  it('pasted bracket chords count at once', async () => {
    const SONG = ['# Tarde Clara', '', '```', '', '```', ''].join('\n');
    const { container, editorRef } = await open(SONG);
    const at = editorRef.current.state.doc.line(4).from;
    act(() => editorRef.current.dispatch({ selection: { anchor: at } }));
    firePaste(container.querySelector('.cm-content'), '[Am]Teste');
    // The cursor is still on the pasted line, and the notice is already there.
    const head = editorRef.current.state.selection.main.head;
    expect(editorRef.current.state.doc.lineAt(head).number).toBe(4);
    expect(screen.getByText(bracketNotice(4))).toBeInTheDocument();
  });

  it('a raw README marks nothing', async () => {
    const README = ['# Livro de Ensaio', '', '```', '[Am]Teste [G]linha', 'Teste linha', '```', ''].join('\n');
    const { container } = await open(README, 'README.md');
    expect(container.querySelectorAll('.est-unknown')).toHaveLength(0);
    expect(screen.queryByText(/looks like chords in brackets/)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// songs.editor_chrome Constraints 2-4, 8; editor Decision 10: the seams a host
// that draws its own header uses.
describe('SongEditor under a host-owned chrome', () => {
  const SONG = '# Tarde Clara\n\n## A\n```\nC | G\n```\n';

  async function mountSong(props = {}) {
    const env = makeStore();
    const editorRef = { current: null };
    const utils = render(
      <SongEditor store={env.store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} {...props} />,
    );
    env.emit(event(EventKind.SOURCE, { bookId: BOOK, path: PATH, text: SONG }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(SONG));
    return { ...env, ...utils, editorRef };
  }

  it('reports the parsed title as it changes', async () => {
    const onTitleChange = vi.fn();
    const { editorRef } = await mountSong({ onTitleChange, onSave: () => {} });
    // On mount, once the text is in.
    expect(onTitleChange).toHaveBeenLastCalledWith('Tarde Clara');

    const heading = () => editorRef.current.state.doc.line(1);
    act(() => editorRef.current.dispatch({ changes: { from: heading().from, to: heading().to, insert: '# Maré Mansa' } }));
    expect(onTitleChange).toHaveBeenLastCalledWith('Maré Mansa');

    // The heading gone: null, so the host falls back to its own title.
    act(() => editorRef.current.dispatch({ changes: { from: heading().from, to: heading().to, insert: '' } }));
    expect(onTitleChange).toHaveBeenLastCalledWith(null);
  });

  it('a host-owned Save: the gate through saveRef, Add section through addSectionRef, onWrite, showPreview', async () => {
    const onSave = vi.fn();
    const onWrite = vi.fn();
    const saveRef = { current: null };
    const addSectionRef = { current: null };
    const { container, editorRef, sent, rerender, store } = await mountSong({
      onSave,
      onWrite,
      saveRef,
      addSectionRef,
    });

    // The bar draws neither: the host does.
    const bar = container.querySelector('.est-editor-bar');
    expect(within(bar).queryByRole('button', { name: t('editor.source.save') })).toBeNull();
    expect(within(bar).queryByRole('button', { name: t('editor.source.addSection') })).toBeNull();

    // The published Add section inserts a section.
    act(() => addSectionRef.current());
    expect(editorRef.current.state.doc.toString()).toMatch(/## \n```\n\n```\n?$/);

    // A debounced write fires onWrite after the WRITE is sent.
    const writes = () => sent.filter((m) => m.kind === CommandKind.WRITE).length;
    const before = writes();
    await waitFor(() => expect(onWrite).toHaveBeenCalled(), { timeout: 2000 });
    expect(writes()).toBe(before + 1);

    // The gate: clean text calls onSave and says so.
    let passed;
    act(() => {
      passed = saveRef.current();
    });
    expect(passed).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);

    // A voicing the reader cannot read: the stop, no onSave.
    act(() =>
      editorRef.current.dispatch({
        changes: {
          from: editorRef.current.state.doc.length,
          insert: '\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- Em: 02200\n',
        },
      }),
    );
    act(() => {
      passed = saveRef.current();
    });
    expect(passed).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent(t('editor.source.notSaved'));

    // The wide preview shows by default and hides with showPreview={false}.
    expect(screen.getByRole('region', { name: t('editor.source.preview') })).toBeInTheDocument();
    rerender(
      <SongEditor
        store={store}
        bookId={BOOK}
        path={PATH}
        layoutMode="wide"
        editorRef={editorRef}
        onSave={onSave}
        onWrite={onWrite}
        saveRef={saveRef}
        addSectionRef={addSectionRef}
        showPreview={false}
      />,
    );
    expect(screen.queryByRole('region', { name: t('editor.source.preview') })).toBeNull();
    expect(container.querySelector('.est-editor-body')).not.toHaveClass('split');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('without the refs the bar keeps its own Add section and Save', async () => {
    const { container } = await mountSong({ onSave: () => {} });
    const bar = container.querySelector('.est-editor-bar');
    expect(within(bar).getByRole('button', { name: t('editor.source.save') })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: t('editor.source.addSection') })).toBeInTheDocument();
  });
});

// songs.format_help: Help in the editor's bar, Insert, and the notice's three
// cases with Show me how (workflow 3 §Help with the format, §When it looks
// like another format; workflow 4 §Editing). Purpose-written songs.
describe('SongEditor format help', () => {
  // While the help is open RAC hides the rest of the page from the
  // accessibility tree (a modal overlay), Help included.
  const HELP = () => screen.getByRole('button', { name: 'Help', hidden: true });
  const helpDialog = () => screen.queryByRole('dialog', { name: 'Writing a song' });

  async function mount(text, { path = PATH, layoutMode = 'wide' } = {}) {
    const env = makeStore();
    const editorRef = { current: null };
    const utils = render(
      <SongEditor store={env.store} bookId={BOOK} path={path} layoutMode={layoutMode} editorRef={editorRef} onSave={() => {}} />,
    );
    env.emit(event(EventKind.SOURCE, { bookId: BOOK, path, text }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(text));
    return { ...env, ...utils, editorRef };
  }

  const SONG = '# Tarde Clara\n\n## A\n```\nC | G\n```\n';

  it('Help opens the help and Escape returns focus to Help', async () => {
    // Narrow: beside Text | Preview, in the bar; the sheet.
    const narrow = await mount(SONG, { layoutMode: 'narrow' });
    let bar = narrow.container.querySelector('.est-editor-bar');
    const toggle = within(bar).getByRole('radiogroup', { name: t('editor.source.viewToggle') });
    expect(toggle.nextElementSibling).toBe(HELP());
    expect(HELP()).toHaveAttribute('aria-expanded', 'false');
    act(() => HELP().focus());
    act(() => fireEvent.click(HELP()));
    expect(helpDialog()).toBeInTheDocument();
    expect(helpDialog().closest('.sheet')).not.toBeNull();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
    // The Dialog takes focus in an effect; Escape is pressed from inside it.
    await waitFor(() => expect(helpDialog()).toContainElement(document.activeElement));
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(helpDialog()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(HELP()));
    narrow.unmount();

    // Wide: beside Add section; a popover hanging from Help, aria-expanded
    // while open.
    const wide = await mount(SONG);
    bar = wide.container.querySelector('.est-editor-bar');
    const addSection = within(bar).getByRole('button', { name: t('editor.source.addSection') });
    expect(addSection.previousElementSibling).toBe(HELP());
    act(() => HELP().focus());
    act(() => fireEvent.click(HELP()));
    expect(helpDialog().closest('.popover.card')).not.toBeNull();
    expect(HELP()).toHaveAttribute('aria-expanded', 'true');
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
    await waitFor(() => expect(helpDialog()).toContainElement(document.activeElement));
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(helpDialog()).toBeNull();
    expect(HELP()).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(document.activeElement).toBe(HELP()));
  });

  it('Insert puts the Bars example where Add section would, and one undo removes it', async () => {
    const chart = '# Tarde Clara\n\n## A\n```\nC | G\n```\n';
    const text = `${chart}\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- C: x32010\n`;
    const { editorRef, container } = await mount(text);
    act(() => fireEvent.click(HELP()));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Insert the Bars example' })));

    const bars = '## Intro\n```\nG | % | C | D\n```';
    const doc = editorRef.current.state.doc.toString();
    expect(doc).toBe(`${chart}\n${bars}\n\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- C: x32010\n`);
    expect(doc.indexOf(bars)).toBeLessThan(doc.indexOf('---'));
    expect(helpDialog()).toBeNull();
    expect(editorRef.current.state.selection.main.head).toBe(chart.length + 1 + bars.length);
    await waitFor(() => expect(container.querySelector('.cm-content').contains(document.activeElement)).toBe(true));

    act(() => {
      undo(editorRef.current);
    });
    expect(editorRef.current.state.doc.toString()).toBe(text);
  });

  it('Show me how opens the help at Chords over words, and focus returns to it', async () => {
    const BRACKETS = ['# Tarde Clara', '', '```', '[Am]Teste [G]linha', '```', ''].join('\n');
    await mount(BRACKETS);
    expect(screen.getByText(t('editor.source.bracketChords', { line: 4 }))).toBeInTheDocument();
    const showMe = screen.getByRole('button', { name: 'Show me how' });
    act(() => showMe.focus());
    act(() => fireEvent.click(showMe));
    expect(helpDialog()).toBeInTheDocument();
    const heading = screen.getByRole('heading', { name: '3. Chords over words' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    // The popover still hangs from Help (board Computer).
    expect(HELP()).toHaveAttribute('aria-expanded', 'true');
    act(() => fireEvent.click(within(helpDialog()).getByRole('button', { name: 'Close' })));
    expect(helpDialog()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show me how' })));
  });

  it('chords outside the music: the notice names the line and opens at Parts and the music fence', async () => {
    const UNFENCED = ['# Tarde Clara', '', '## Intro', 'G | C | D', ''].join('\n');
    const { editorRef, container } = await mount(UNFENCED);
    const notice = t('editor.source.unfencedChords', { line: 4 });
    expect(notice).toBe(
      'Line 4 looks like chords, but it is outside the music, so it is kept as a note. Music goes between two lines of three backticks.',
    );
    expect(screen.getByRole('status')).toHaveTextContent(notice);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Show me how' })));
    const heading = screen.getByRole('heading', { name: '2. Parts and the music fence' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    act(() => fireEvent.click(within(helpDialog()).getByRole('button', { name: 'Close' })));

    // Dismissed: gone for this editing; a bracket line added still raises the
    // bracket notice (Decision 4).
    act(() => fireEvent.click(screen.getByRole('button', { name: t('editor.source.dismissNotice') })));
    expect(screen.queryByText(notice)).toBeNull();
    act(() => {
      const end = editorRef.current.state.doc.length;
      editorRef.current.dispatch({ changes: { from: end, insert: '\n[G]Walk the road\n' }, selection: { anchor: 0 } });
    });
    expect(screen.queryByText(notice)).toBeNull();
    expect(screen.getByText(t('editor.source.bracketChords', { line: 6 }))).toBeInTheDocument();
  });

  it('bracket chords in notes raise the bracket notice', async () => {
    await mount(['# Tarde Clara', '', '[G]Walk the road', ''].join('\n'));
    expect(screen.getByText(t('editor.source.bracketChords', { line: 3 }))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show me how' })).toBeInTheDocument();
  });

  it('a README has no Help and no notice', async () => {
    await mount(['# Livro de Ensaio', '', '## Intro', 'G | C | D', '[G]Walk the road', ''].join('\n'), {
      path: 'README.md',
    });
    expect(screen.queryByRole('button', { name: 'Help' })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show me how' })).toBeNull();
  });
});

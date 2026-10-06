// Behavior — the source editor working with its real collaborators (React Aria,
// i18n, a loopback-backed store with seeded `source`/`preferences` slices,
// CodeMirror). Pins workflow 3 §The editor / §The notation property / §Pasting
// a cifra, workflow 4 §Normalising, and spec §7.4 / §11.12.3. axe (WCAG 2.1 AA)
// over every state. The `editorRef` prop is the test seam onto the live
// CodeMirror view (the same ref a host would hold). Fixtures are purpose-written
// songs.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { undo } from '@codemirror/commands';
import { write, parse } from 'cifra-md';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind } from '../worker/protocol.js';
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
});

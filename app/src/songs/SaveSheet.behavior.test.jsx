// Behavior — the save sheet and discard confirm over a store double
// (songs.save_sheet, workflow 4; W04 board). Renders the components inside
// ThemeRoot so RAC overlays portal into the `.est` token scope (memory:
// rac-overlays-portal-outside-est-theme-root), seeds the Worker's replies by
// emitting SAVE_PREVIEW / PREFERENCES, and asserts the commands the sheet sends.
// axe (WCAG 2.1 AA) over every state. Fixtures are purpose-written — never
// anyone's copyrighted words.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SaveSheet from './SaveSheet.jsx';
import DiscardConfirm from './DiscardConfirm.jsx';

// ThemeRoot reads the viewport through matchMedia (jsdom has none); pin it.
globalThis.matchMedia = (media) => ({
  media,
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});

afterEach(() => cleanup());

const AT = '2026-10-06T00:00:00.000Z';
const BOOK = 'book-1';

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const lastCommand = (sent, kind) => sent.filter((c) => c.kind === kind).at(-1);
const commandsOf = (sent, kind) => sent.filter((c) => c.kind === kind);

// A chord change and a whole voicing block added — the W04 sheet's two rows.
const CHANGES = [
  { kind: 'chord', op: 'changed', where: { section: 'Primeira Parte', bar: 2 }, before: 'D', after: 'D7' },
  { kind: 'voicing', op: 'added', where: { tuning: 'G4 C4 E4 A4', variation: '' }, before: null, after: null },
];
const SUMMARY = 'Primeira Parte bar 2: D → D7; added voicings for G4 C4 E4 A4';

const preview = (overrides = {}) => ({
  path: 'tarde-clara.cifra.md',
  title: 'Tarde Clara',
  changes: CHANGES,
  summary: SUMMARY,
  isNew: false,
  ...overrides,
});

function Harness({ store, open, props }) {
  return (
    <ThemeRoot store={store}>
      <SaveSheet store={store} isOpen={open} onClose={() => {}} bookId={BOOK} {...props} />
    </ThemeRoot>
  );
}

function renderSheet(props, store) {
  // Mount with the sheet closed, then open it — exactly as a host does: by then
  // ThemeRoot's portal container ref is set, so the overlay mounts into the
  // `.est` scope (its ref is null on the very first paint).
  const utils = render(<Harness store={store} open={false} props={props} />);
  utils.rerender(<Harness store={store} open props={props} />);
  return utils;
}

// The author name already known, so the name field is out of the way unless a
// test is about it.
const withName = (emit) => emit(event(EventKind.PREFERENCES, { authorName: { value: 'Marina', at: AT } }));

describe('save sheet — what changed and the note (§Saving)', () => {
  it('refuses a save in a book with an in-progress merge with settle-the-conflicts-first (sync.conflicts; workflow 9 L42-43)', async () => {
    const { store, emit } = makeStore();
    renderSheet({ paths: ['tarde-clara.cifra.md'] }, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));
    // The Worker's merge-in-progress refusal surfaces, distinct from a marker line.
    emit(event(EventKind.SAVE_REFUSED, { bookId: BOOK, reason: 'merge_in_progress' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Settle the conflicts in this book first');
  });

  it('shows the musical summary as localized rows and prefills the editable note', async () => {
    const { store, emit } = makeStore();
    renderSheet({ paths: ['tarde-clara.cifra.md'] }, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));

    // The two-column rows, localized; musical tokens passed through as data.
    expect(screen.getByText('Primeira Parte bar 2')).toBeInTheDocument();
    expect(screen.getByText('D → D7')).toBeInTheDocument();
    expect(screen.getByText('added for G4 C4 E4 A4')).toBeInTheDocument();

    // The note is prefilled from the diff summary, verbatim, and is editable.
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue(SUMMARY);
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();
  });

  it('confirming an existing song sends SAVE with the note as the commit message', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet({ paths: ['tarde-clara.cifra.md'] }, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    const cmd = lastCommand(sent, CommandKind.SAVE);
    expect(cmd.payload).toMatchObject({
      bookId: BOOK,
      paths: ['tarde-clara.cifra.md'],
      message: SUMMARY,
      author: { id: 'local', name: 'Marina' },
    });
  });

  it('confirming a never-saved song sends NAME_AND_SAVE with the note', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet({ paths: ['untitled.cifra.md'], isNew: true, fromPath: 'untitled.cifra.md' }, store);
    withName(emit);
    emit(
      event(EventKind.SAVE_PREVIEW, {
        bookId: BOOK,
        previews: [preview({ path: 'untitled.cifra.md', title: 'Tarde Clara', isNew: true })],
      }),
    );

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    const cmd = lastCommand(sent, CommandKind.NAME_AND_SAVE);
    expect(cmd.payload).toMatchObject({ bookId: BOOK, fromPath: 'untitled.cifra.md', message: SUMMARY });
  });
});

describe('save sheet — who made the change (§Who made the change)', () => {
  it('asks for the author name once when none is stored, sends it, and stops asking once persisted', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet({ paths: ['tarde-clara.cifra.md'] }, store); // no PREFERENCES → no stored name
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));

    // The name field is shown and Save waits for it.
    const field = screen.getByRole('textbox', { name: /Your name/ });
    expect(field).toBeInTheDocument();
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();

    act(() => fireEvent.change(field, { target: { value: 'Ana' } }));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));

    // The name is persisted to the home book and used as the commit author.
    expect(lastCommand(sent, CommandKind.SET_IDENTITY_NAME).payload.name).toBe('Ana');
    expect(lastCommand(sent, CommandKind.SAVE).payload.author).toMatchObject({ id: 'local', name: 'Ana' });

    // Once persisted, the field is gone — it is asked only once.
    withName(emit);
    expect(screen.queryByRole('textbox', { name: /Your name/ })).not.toBeInTheDocument();
  });
});

describe('save sheet — a titleless new song is named (acceptance 7)', () => {
  it('prompts for a name and sends it as the title for NAME_AND_SAVE', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet({ paths: ['untitled.cifra.md'], isNew: true, fromPath: 'untitled.cifra.md' }, store);
    withName(emit);
    emit(
      event(EventKind.SAVE_PREVIEW, {
        bookId: BOOK,
        previews: [preview({ path: 'untitled.cifra.md', title: '', isNew: true })],
      }),
    );

    const field = screen.getByRole('textbox', { name: 'Name this song' });
    act(() => fireEvent.change(field, { target: { value: 'Nova' } }));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));

    expect(lastCommand(sent, CommandKind.NAME_AND_SAVE).payload.title).toBe('Nova');
  });
});

describe('save sheet — save all (§Several songs at once)', () => {
  it('lists every changed song and makes one commit over all their paths', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet({ paths: ['tarde-clara.cifra.md', 'carinhoso.cifra.md'] }, store);
    withName(emit);
    emit(
      event(EventKind.SAVE_PREVIEW, {
        bookId: BOOK,
        previews: [
          preview({ path: 'tarde-clara.cifra.md', title: 'Tarde Clara', summary: 'a' }),
          preview({ path: 'carinhoso.cifra.md', title: 'Carinhoso', summary: 'b' }),
        ],
      }),
    );

    expect(screen.getByText('Tarde Clara')).toBeInTheDocument();
    expect(screen.getByText('Carinhoso')).toBeInTheDocument();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    const saves = commandsOf(sent, CommandKind.SAVE);
    expect(saves).toHaveLength(1); // ONE commit over both paths
    expect(saves[0].payload.paths).toEqual(['tarde-clara.cifra.md', 'carinhoso.cifra.md']);
    expect(saves[0].payload.message).toBe('Tarde Clara: a; Carinhoso: b');
  });
});

// Workflow 4 §A book the user cannot push to; books.fork AC1 (W11 board #1):
// Save in a reader's book opens the make-it-your-own offer, never the form; on
// BOOK_FORKED it turns into the ordinary save form for the same paths in the
// fork, and the SAVE goes to the fork.
describe('save sheet — a book the user cannot push to (§A book the user cannot push to; books.fork)', () => {
  const props = {
    paths: ['carinhoso.cifra.md'],
    canSave: false,
    titleHint: 'Carinhoso',
    bookLabel: 'Choros da Ana',
  };

  it('offers to make the book your own with the board #1 copy; it does not save', async () => {
    const { store, sent } = makeStore();
    renderSheet(props, store);

    expect(
      screen.getByRole('heading', { name: 'Choros da Ana is someone else’s — make it your own?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('You can read Choros da Ana, but not save to it. Making it your own gives you:'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make it my own' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    expect(commandsOf(sent, CommandKind.SAVE)).toHaveLength(0);
    expect(commandsOf(sent, CommandKind.PREVIEW_SAVE)).toHaveLength(0);
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();
  });

  it('after BOOK_FORKED shows the save form for the fork’s id, and the SAVE goes to the fork', async () => {
    const { store, sent, emit } = makeStore();
    withName(emit);
    const onMakeYourOwn = vi.fn();
    renderSheet({ ...props, onMakeYourOwn }, store);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Make it my own' })));
    expect(lastCommand(sent, CommandKind.FORK_BOOK).payload.bookId).toBe(BOOK);
    expect(screen.getByRole('status')).toHaveTextContent('Making it your own…');

    emit(event(EventKind.BOOK_FORKED, { previousBookId: BOOK, bookId: 'fork-1', via: 'service' }));
    expect(onMakeYourOwn).toHaveBeenCalledWith('fork-1');
    // The ordinary form, asking for the fork's preview.
    expect(lastCommand(sent, CommandKind.PREVIEW_SAVE).payload).toMatchObject({
      bookId: 'fork-1',
      paths: ['carinhoso.cifra.md'],
    });
    emit(event(EventKind.SAVE_PREVIEW, { bookId: 'fork-1', previews: [preview({ path: 'carinhoso.cifra.md', title: 'Carinhoso' })] }));
    expect(screen.getByRole('heading', { name: 'Save Carinhoso' })).toBeInTheDocument();
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(lastCommand(sent, CommandKind.SAVE).payload).toMatchObject({
      bookId: 'fork-1',
      paths: ['carinhoso.cifra.md'],
    });
  });
});

describe('discard confirm (§Discarding)', () => {
  it('shows what would be lost, always asks, and sends DISCARD on confirm', async () => {
    const { store, sent, emit } = makeStore();
    render(
      <ThemeRoot store={store}>
        <DiscardConfirm
          store={store}
          isOpen
          onClose={() => {}}
          bookId={BOOK}
          paths={['tarde-clara.cifra.md']}
          titleHint="Tarde Clara"
        />
      </ThemeRoot>,
    );
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));

    // The same summary as save, shown as what would be lost.
    expect(screen.getByText(/This would be lost/)).toBeInTheDocument();
    expect(screen.getByText('D → D7')).toBeInTheDocument();
    // It always asks: Keep editing cancels, Discard changes is the danger action.
    expect(screen.getByRole('button', { name: 'Keep editing' })).toBeInTheDocument();
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Discard changes' })));
    expect(lastCommand(sent, CommandKind.DISCARD).payload).toMatchObject({
      bookId: BOOK,
      paths: ['tarde-clara.cifra.md'],
    });
  });
});

// songs.save_empty_message — workflow 4 §Saving: with no musical summary the note
// names the file it saves; a cleared note still saves (the Worker supplies the
// default); a save that cannot be made says *Not saved* and stays open.
describe('save sheet — no summary, a cleared note, a failed save (§Saving)', () => {
  const README = preview({ path: 'README.md', title: '', changes: [], summary: '' });

  it('a save with no musical summary prefills Update <path> and sends it', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet({ paths: ['README.md'] }, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [README] }));

    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('Update README.md');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(lastCommand(sent, CommandKind.SAVE).payload).toMatchObject({
      bookId: BOOK,
      paths: ['README.md'],
      message: 'Update README.md',
    });
  });

  it('a cleared note still sends SAVE', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet({ paths: ['tarde-clara.cifra.md'] }, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));

    act(() => fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: '' } }));
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    act(() => fireEvent.click(save));
    expect(lastCommand(sent, CommandKind.SAVE).payload).toMatchObject({
      paths: ['tarde-clara.cifra.md'],
      message: '',
    });
  });

  it('a failed save says Not saved and stays open for another try', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet({ paths: ['README.md'] }, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [README] }));

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    emit(
      event(EventKind.SAVE_REFUSED, {
        bookId: BOOK,
        path: 'README.md',
        reason: 'failed',
        marker: null,
        line: null,
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Not saved. Something went wrong writing it to this device. Your changes are still here — save again.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();

    act(() => fireEvent.click(save));
    expect(commandsOf(sent, CommandKind.SAVE)).toHaveLength(2);
  });
});

// Behavior — the save sheet and discard confirm over a store double
// (songs.save_sheet, workflow 4; W04 board). Renders the components inside
// ThemeRoot so RAC overlays portal into the `.est` token scope (memory:
// rac-overlays-portal-outside-est-theme-root), seeds the Worker's replies by
// emitting SAVE_PREVIEW / PREFERENCES, and asserts the commands the sheet sends.
// axe (WCAG 2.1 AA) over every state. Fixtures are purpose-written — never
// anyone's copyrighted words.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
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

    // A saved song's save shows neither first-save field (songs.first_save_fields
    // Constraint 4): its file was named at its first save.
    expect(screen.queryByRole('textbox', { name: 'Book' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'File name' })).not.toBeInTheDocument();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    const cmd = lastCommand(sent, CommandKind.SAVE);
    expect(cmd.payload).toMatchObject({
      bookId: BOOK,
      paths: ['tarde-clara.cifra.md'],
      message: SUMMARY,
      name: 'Marina',
    });
    // No author id: the Worker resolves it (account.commit_author Decision 3).
    expect(cmd.payload.author).toBeUndefined();
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
    expect(lastCommand(sent, CommandKind.SAVE).payload.name).toBe('Ana');
    expect(lastCommand(sent, CommandKind.SAVE).payload.author).toBeUndefined();

    // Once persisted, the field is gone — it is asked only once.
    withName(emit);
    expect(screen.queryByRole('textbox', { name: /Your name/ })).not.toBeInTheDocument();
  });

  // account.author_name acceptance 4: once the Account screen has replaced the
  // register, the sheet still reads it live — no field, no SET_IDENTITY_NAME,
  // and the save carries the new name.
  it('with the name changed on the Account screen, asks nothing and saves under the new name', async () => {
    const { store, sent, emit } = makeStore();
    withName(emit);
    // The Account screen's change re-surfaces PREFERENCES with the new register.
    emit(event(EventKind.PREFERENCES, { authorName: { value: 'Marina Lima', at: '2026-10-19T00:00:00.000Z' } }));
    renderSheet({ paths: ['tarde-clara.cifra.md'] }, store);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));

    expect(screen.queryByRole('textbox', { name: /Your name/ })).not.toBeInTheDocument();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(commandsOf(sent, CommandKind.SET_IDENTITY_NAME)).toHaveLength(0);
    expect(lastCommand(sent, CommandKind.SAVE).payload.name).toBe('Marina Lima');
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

// songs.first_save_fields — W03#4 L179-187: the first save names the book and
// the file, read-only, with *Named once, from the title…*.
describe('save sheet — the first save names the book and the file (W03#4)', () => {
  const HINT = 'Named once, from the title. Changing the title later edits its heading, not the file.';

  it("a new song's first save shows Book and the previewed File name, with the hint", async () => {
    const { store, emit } = makeStore();
    renderSheet(
      { paths: ['untitled.cifra.md'], isNew: true, fromPath: 'untitled.cifra.md', bookLabel: 'My songs' },
      store,
    );
    withName(emit);
    emit(
      event(EventKind.SAVE_PREVIEW, {
        bookId: BOOK,
        previews: [
          preview({
            path: 'untitled.cifra.md',
            isNew: true,
            fileName: 'tarde-clara-2.cifra.md',
            taken: ['tarde-clara.cifra.md'],
          }),
        ],
      }),
    );

    const book = screen.getByRole('textbox', { name: 'Book' });
    expect(book).toHaveValue('My songs');
    expect(book).toHaveAttribute('readonly');
    const file = screen.getByRole('textbox', { name: 'File name' });
    expect(file).toHaveValue('tarde-clara-2.cifra.md');
    expect(file).toHaveAttribute('readonly');
    expect(file).toHaveAccessibleDescription(HINT);
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();
  });

  it('the file name follows the typed name', async () => {
    const { store, emit } = makeStore();
    renderSheet(
      { paths: ['untitled.cifra.md'], isNew: true, fromPath: 'untitled.cifra.md', bookLabel: 'My songs' },
      store,
    );
    withName(emit);
    emit(
      event(EventKind.SAVE_PREVIEW, {
        bookId: BOOK,
        previews: [
          preview({
            path: 'untitled.cifra.md',
            title: '',
            isNew: true,
            fileName: 'untitled.cifra.md',
            taken: ['mare-mansa.cifra.md'],
          }),
        ],
      }),
    );

    const file = screen.getByRole('textbox', { name: 'File name' });
    expect(file).toHaveValue('untitled.cifra.md');
    // saveSheet.songNameHelp: the typed name becomes the file name, folded
    // against the folder's names the preview carried — no Worker round trip.
    const name = screen.getByRole('textbox', { name: 'Name this song' });
    act(() => fireEvent.change(name, { target: { value: 'Maré Mansa' } }));
    expect(file).toHaveValue('mare-mansa-2.cifra.md');
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();
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

// songs.unknown_tokens_loud §Acceptance 4; workflow 4 §Saving (delta): the
// words the save adds that are not read as chords are listed, and the one
// confirm asks *Save anyway* — pressable, and saving as Save does.
describe('save sheet — words not read as chords (§Saving)', () => {
  it('lists the words not read as chords and asks Save anyway', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet({ paths: ['tarde-clara.cifra.md'] }, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview({ unknown: ['Teste', '[G]linha'] })] }));

    expect(screen.getByText('Not read as chords, kept as written: Teste, [G]linha')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    const anyway = screen.getByRole('button', { name: 'Save anyway' });
    expect(anyway).toBeEnabled();
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();

    act(() => fireEvent.click(anyway));
    const saves = commandsOf(sent, CommandKind.SAVE);
    expect(saves).toHaveLength(1);
    expect(saves[0].payload).toMatchObject({
      bookId: BOOK,
      paths: ['tarde-clara.cifra.md'],
      message: SUMMARY,
      name: 'Marina',
    });
  });

  it('several songs list one line each, by title', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet({ paths: ['tarde-clara.cifra.md', 'carinhoso.cifra.md', 'mare.cifra.md'] }, store);
    withName(emit);
    emit(
      event(EventKind.SAVE_PREVIEW, {
        bookId: BOOK,
        previews: [
          preview({ path: 'tarde-clara.cifra.md', title: 'Tarde Clara', summary: 'a', unknown: ['Teste'] }),
          preview({ path: 'carinhoso.cifra.md', title: 'Carinhoso', summary: 'b', unknown: [] }),
          preview({ path: 'mare.cifra.md', title: 'Maré Mansa', summary: 'c', unknown: ['rit.', '(solo)'] }),
        ],
      }),
    );

    const lines = document.querySelectorAll('.est-save-unknown p');
    expect([...lines].map((l) => l.textContent)).toEqual([
      'Tarde Clara: Not read as chords, kept as written: Teste',
      'Maré Mansa: Not read as chords, kept as written: rit., (solo)',
    ]);
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save anyway' })));
    expect(commandsOf(sent, CommandKind.SAVE)[0].payload.paths).toEqual([
      'tarde-clara.cifra.md',
      'carinhoso.cifra.md',
      'mare.cifra.md',
    ]);
  });

  it('no list, plain Save', async () => {
    const { store, emit } = makeStore();
    renderSheet({ paths: ['tarde-clara.cifra.md'] }, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview({ unknown: [] })] }));

    expect(screen.queryByText(/Not read as chords/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save anyway' })).not.toBeInTheDocument();
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

// songs.editor_chrome Constraint 7; workflow 4 §Saving (as edited): where the
// save sits follows the device — W04#2 (sheet), W03#4 (dialog), W04#4 (panel).
describe('save surface — one form, three presentations', () => {
  const PROPS = { paths: ['tarde-clara.cifra.md'], titleHint: 'Tarde Clara' };
  const fill = (emit) => {
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));
  };
  // The parts every presentation carries: what changed, the note, Save.
  const expectForm = (root) => {
    expect(root).toHaveTextContent('What changed');
    expect(root).toHaveTextContent('Primeira Parte bar 2');
    expect(within(root).getByRole('textbox', { name: 'Note' })).toHaveValue(SUMMARY);
    expect(within(root).getByRole('button', { name: 'Save' })).toBeInTheDocument();
  };

  it('presentation="sheet" is a bottom sheet with a grip', async () => {
    const { store, emit } = makeStore();
    renderSheet({ ...PROPS, presentation: 'sheet' }, store);
    fill(emit);
    const dialog = screen.getByRole('dialog');
    const sheet = dialog.closest('.sheet');
    expect(sheet).not.toBeNull();
    expect(sheet.querySelector('.grip')).not.toBeNull();
    expectForm(dialog);
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('presentation="dialog" is a centred dialog, no grip', async () => {
    const { store, emit } = makeStore();
    renderSheet({ ...PROPS, presentation: 'dialog' }, store);
    fill(emit);
    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('.dialog')).not.toBeNull();
    expect(dialog.closest('.scrim.center')).not.toBeNull();
    expect(dialog.closest('.sheet')).toBeNull();
    expect(dialog.querySelector('.grip')).toBeNull();
    expectForm(dialog);
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('presentation="panel" is a labelled region without an overlay; a new revision re-asks the preview', async () => {
    const { store, emit, sent } = makeStore();
    const { container, rerender } = renderSheet({ ...PROPS, presentation: 'panel' }, store);
    fill(emit);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.querySelector('.scrim')).toBeNull();
    expect(document.querySelector('.scrim')).toBeNull();
    const panel = screen.getByRole('region', { name: 'Save Tarde Clara' });
    expect(panel.querySelector('.grip')).toBeNull();
    expectForm(panel);
    expect(await checkWcag21aa(panel)).toHaveNoViolations();

    const asked = commandsOf(sent, CommandKind.PREVIEW_SAVE).length;
    rerender(<Harness store={store} open props={{ ...PROPS, presentation: 'panel', revision: 1 }} />);
    expect(commandsOf(sent, CommandKind.PREVIEW_SAVE)).toHaveLength(asked + 1);
  });
});

// songs.save_feedback — workflow 4 §Saving (the pending and missing-field
// paragraph) and §Who made the change: Save is never grey for a missing field,
// one tap makes one version, and the account's name takes the field's place.
describe('save sheet — saving says what it is doing and why it cannot (songs.save_feedback)', () => {
  const PROPS = { paths: ['tarde-clara.cifra.md'], titleHint: 'Tarde Clara' };
  // The form's root in each presentation: the dialog, or the panel's region.
  const formRoot = (presentation) =>
    presentation === 'panel'
      ? screen.getByRole('region', { name: 'Save Tarde Clara' })
      : screen.getByRole('dialog');

  describe.each(['sheet', 'dialog', 'panel'])('presentation="%s"', (presentation) => {
    it('a blank name keeps Save pressable and says why', async () => {
      const { store, sent, emit } = makeStore();
      renderSheet({ ...PROPS, presentation }, store); // no PREFERENCES → no stored name
      emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));

      const field = screen.getByRole('textbox', { name: /Your name/ });
      const save = screen.getByRole('button', { name: 'Save' });
      expect(save).toBeEnabled();
      act(() => fireEvent.click(save));

      // Nothing sent; the error under the field, described-by its input; the
      // cursor in the field.
      expect(commandsOf(sent, CommandKind.SET_IDENTITY_NAME)).toHaveLength(0);
      expect(commandsOf(sent, CommandKind.SAVE)).toHaveLength(0);
      const error = screen.getByText('Enter your name to save.');
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
      expect(field).toHaveAccessibleDescription(/Enter your name to save\./);
      expect(field).toHaveFocus();
      expect(await checkWcag21aa(formRoot(presentation))).toHaveNoViolations();

      // A name typed: the error goes, and Save sends the name then the save.
      act(() => fireEvent.change(field, { target: { value: 'Ana' } }));
      expect(screen.queryByText('Enter your name to save.')).not.toBeInTheDocument();
      expect(field).not.toHaveAttribute('aria-invalid', 'true');
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
      const kinds = sent
        .map((c) => c.kind)
        .filter((k) => k === CommandKind.SET_IDENTITY_NAME || k === CommandKind.SAVE);
      expect(kinds).toEqual([CommandKind.SET_IDENTITY_NAME, CommandKind.SAVE]);
      expect(lastCommand(sent, CommandKind.SET_IDENTITY_NAME).payload.name).toBe('Ana');
      expect(lastCommand(sent, CommandKind.SAVE).payload.name).toBe('Ana');
    });
  });

  it('a whitespace-only name is blank too', () => {
    const { store, sent, emit } = makeStore();
    renderSheet(PROPS, store);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));
    const field = screen.getByRole('textbox', { name: /Your name/ });
    act(() => fireEvent.change(field, { target: { value: '   ' } }));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(commandsOf(sent, CommandKind.SAVE)).toHaveLength(0);
    expect(screen.getByText('Enter your name to save.')).toBeInTheDocument();
  });

  it('a blank song name says why', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet({ paths: ['untitled.cifra.md'], isNew: true, fromPath: 'untitled.cifra.md' }, store);
    // No stored name either: both fields blank.
    emit(
      event(EventKind.SAVE_PREVIEW, {
        bookId: BOOK,
        previews: [preview({ path: 'untitled.cifra.md', title: '', isNew: true })],
      }),
    );
    const nameField = screen.getByRole('textbox', { name: /Your name/ });
    const songField = screen.getByRole('textbox', { name: 'Name this song' });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));

    // Both say why; the cursor goes to the name first (the visual order).
    expect(commandsOf(sent, CommandKind.NAME_AND_SAVE)).toHaveLength(0);
    expect(commandsOf(sent, CommandKind.SET_IDENTITY_NAME)).toHaveLength(0);
    expect(nameField).toHaveAccessibleDescription(/Enter your name to save\./);
    expect(songField).toHaveAccessibleDescription(/Name the song to save\./);
    expect(nameField).toHaveFocus();

    // The name given, the song still unnamed: the cursor goes to the song name.
    act(() => fireEvent.change(nameField, { target: { value: 'Ana' } }));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(commandsOf(sent, CommandKind.NAME_AND_SAVE)).toHaveLength(0);
    expect(screen.queryByText('Enter your name to save.')).not.toBeInTheDocument();
    expect(songField).toHaveAttribute('aria-invalid', 'true');
    expect(songField).toHaveFocus();
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();

    // Named: the error goes and NAME_AND_SAVE is sent with the title.
    act(() => fireEvent.change(songField, { target: { value: 'Nova' } }));
    expect(screen.queryByText('Name the song to save.')).not.toBeInTheDocument();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(commandsOf(sent, CommandKind.NAME_AND_SAVE)).toHaveLength(1);
    expect(lastCommand(sent, CommandKind.NAME_AND_SAVE).payload.title).toBe('Nova');
  });

  it('saving shows Saving… and a second press sends nothing', async () => {
    const { store, sent, emit } = makeStore();
    renderSheet(PROPS, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));

    const save = screen.getByRole('button', { name: 'Save' });
    act(() => fireEvent.click(save));
    act(() => fireEvent.click(save));
    act(() => fireEvent.click(screen.getByRole('button', { name: /Saving…/ })));
    expect(commandsOf(sent, CommandKind.SAVE)).toHaveLength(1);

    // Pending, said in a word; it keeps focus rather than going disabled.
    const pending = screen.getByRole('button', { name: 'Saving…' });
    expect(pending).toHaveAttribute('data-pending', 'true');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    // Cancel stays available while saving.
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();

    // Another book's refusal leaves this one pending.
    emit(event(EventKind.SAVE_REFUSED, { bookId: 'book-2', reason: 'failed' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();

    // This book's refusal: Save again, pressable.
    emit(event(EventKind.SAVE_REFUSED, { bookId: BOOK, path: 'tarde-clara.cifra.md', reason: 'failed' }));
    const again = screen.getByRole('button', { name: 'Save' });
    expect(again).not.toHaveAttribute('data-pending');
    act(() => fireEvent.click(again));
    expect(commandsOf(sent, CommandKind.SAVE)).toHaveLength(2);
  });

  it("the account's name arriving takes the field's place", async () => {
    const { store, sent, emit } = makeStore();
    renderSheet(PROPS, store); // opened with no authorName
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));
    expect(screen.getByRole('textbox', { name: /Your name/ })).toBeInTheDocument();
    // Pressed blank first: the error shows, then the name arrives and both go.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(screen.getByText('Enter your name to save.')).toBeInTheDocument();

    // The attach after sign-in brings the account home book's authorName.
    emit(event(EventKind.PREFERENCES, { authorName: { value: 'Marina', at: AT } }));
    expect(screen.queryByRole('textbox', { name: /Your name/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Enter your name to save.')).not.toBeInTheDocument();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(lastCommand(sent, CommandKind.SAVE).payload.name).toBe('Marina');
    expect(commandsOf(sent, CommandKind.SET_IDENTITY_NAME)).toHaveLength(0);
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();
  });
});

// shell.plain_language — workflow 4 §Save pushes L90-94: the caption is chosen
// by where the book lives; with no shelf yet it reads as hosted (Decision
// *Unknown reads as hosted*).
describe('save sheet — the caption says where the save goes (§Save pushes)', () => {
  const LOCAL_CAPTION = 'Saved on this device. Only you can see it until the book is put online.';
  const HOSTED_CAPTION = 'Saving shares this version with whoever shares the book; with no network, at the next sync.';

  it('a book only on this device says the save stays here, not that it is shared (axe clean)', async () => {
    const { store, emit } = makeStore();
    emit(event(EventKind.SHELF, { books: {}, local: { [BOOK]: { title: { value: 'Caderno da Lia', at: AT }, position: { value: 0, at: AT } } } }));
    renderSheet({ paths: ['tarde-clara.cifra.md'] }, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));

    expect(screen.getByText(LOCAL_CAPTION)).toBeInTheDocument();
    expect(screen.queryByText(/Saving shares this version/)).toBeNull();
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();
  });

  it('a book on Estante keeps the sharing caption (axe clean)', async () => {
    const { store, emit } = makeStore();
    emit(event(EventKind.SHELF, {
      books: { [BOOK]: { label: { value: 'Roda de Sábado', at: AT }, role: { value: 'owner', at: AT }, position: { value: 1, at: AT } } },
      local: {},
    }));
    renderSheet({ paths: ['tarde-clara.cifra.md'] }, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));

    expect(screen.getByText(HOSTED_CAPTION)).toBeInTheDocument();
    expect(screen.queryByText(LOCAL_CAPTION)).toBeNull();
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();
  });

  it('with the shelf not arrived yet, the sharing caption', () => {
    const { store, emit } = makeStore();
    renderSheet({ paths: ['tarde-clara.cifra.md'] }, store);
    withName(emit);
    emit(event(EventKind.SAVE_PREVIEW, { bookId: BOOK, previews: [preview()] }));

    expect(screen.getByText(HOSTED_CAPTION)).toBeInTheDocument();
    expect(screen.queryByText(LOCAL_CAPTION)).toBeNull();
  });
});

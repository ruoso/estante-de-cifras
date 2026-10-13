// Behavior — the save sheet and discard confirm over a store double
// (songs.save_sheet, workflow 4; W04 board). Renders the components inside
// ThemeRoot so RAC overlays portal into the `.est` token scope (memory:
// rac-overlays-portal-outside-est-theme-root), seeds the Worker's replies by
// emitting SAVE_PREVIEW / PREFERENCES, and asserts the commands the sheet sends.
// axe (WCAG 2.1 AA) over every state. Fixtures are purpose-written — never
// anyone's copyrighted words.

import { describe, it, expect, afterEach } from 'vitest';
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

describe('save sheet — a book the user cannot push to (§A book the user cannot push to)', () => {
  it('explains the book is someone else’s and offers to make it your own; it does not save', async () => {
    const { store, sent } = makeStore();
    renderSheet(
      { paths: ['carinhoso.cifra.md'], canSave: false, titleHint: 'Carinhoso', bookLabel: 'Choros da Ana' },
      store,
    );

    expect(screen.getByText(/Choros da Ana is someone else/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make this book your own' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    expect(commandsOf(sent, CommandKind.SAVE)).toHaveLength(0);
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();
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

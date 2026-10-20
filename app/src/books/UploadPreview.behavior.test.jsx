// behavior — the upload preview surface (books.upload_ui, workflow 7 §Uploading
// a book / §A preview comes first / §A zip with no history / §A merge left half
// done; W07 tablet board). Two levels of collaborator, per Decision 7:
//
//  1. A REAL round-trip through the loopback with `createWorkerLogic`: the
//     Add-a-book Upload way-in opens a `.zip` picker; a no-history folder zip
//     built in-test with `createZip` of authored `*.cifra.md` files previews
//     every song as *added*; confirming *Import as a new book* lands it and the
//     book appears on the shelf; switching to *Merge into an existing book* and
//     picking a savable book re-previews as *replace* + *added*, and a per-row
//     keep toggle feeds `perFile` on *Merge and save*. jsdom has no git CLI, so a
//     history-bearing zip is out of reach here — it is pinned at the shipped
//     Worker level (upload.behavior.test.js) and at e2e-web.
//
//  2. SYNTHETIC `UPLOAD_PREVIEW` models (the established synthetic-model pattern,
//     voicing-keepboth) for the git-history-dependent rows: *changed* (the
//     musical summary + diff rows through the save-sheet DiffRows — workflow 7
//     L87), *conflict* (the word + the "goes to resolution" caption, no in-preview
//     resolver — Decision 2), *unresolved* (the "fix it before importing" wording
//     + the marker line, shown left out — workflow 7 L108-116), and a
//     `historyMarkers` notice with the escape hatch gated on `latestClean`
//     (workflow 7 L117-122).
//
// Axe (WCAG 2.1 AA — the rules that run under jsdom) covers the picker, the
// preview with every status present, and the overlay. Songs are written for the
// test (no-song-text rule).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { useState } from 'react';
import { render, screen, fireEvent, act, waitFor, within, cleanup } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { createFileSystem } from '../worker/fs.js';
import { createGitLayer } from '../worker/git.js';
import { createGitHttpClient } from '../worker/git-http.js';
import { createBookLocks } from '../worker/locks.js';
import { createHomeBook } from '../worker/home-book.js';
import { createWorkerLogic } from '../worker/logic.js';
import { createZip } from '../worker/book-zip.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import BooksScreen from './BooksScreen.jsx';
import UploadPreview from './UploadPreview.jsx';

const rand = () => Math.random().toString(36).slice(2);
const enc = (s) => new TextEncoder().encode(s);
const songBody = (title, lyric) => ['# ' + title, '', '```', '[C] ', lyric, '```', ''].join('\n');

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
  globalThis.matchMedia = (media) => ({ media, matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => {
  cleanup();
  restoreLocks();
  delete globalThis.matchMedia;
});

// ---- a real Worker-backed store (local only, offline) ----------------------

async function makeWorkerStore(label) {
  const idb = new IDBFactory();
  const name = `up-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const offline = () => Promise.reject(new Error('offline: no network in this test'));
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: offline }) });
  const locks = createBookLocks({ navigator });
  // Persist the device id to the same meta db the Worker opens, so both agree
  // (books.behavior.test.js pattern).
  await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: offline }),
  );
  const sent = [];
  const realPost = endpoint.postMessage.bind(endpoint);
  endpoint.postMessage = (m) => {
    sent.push(m);
    realPost(m);
  };
  return { store: createStore(endpoint), sent };
}

const lastCommand = (sent, kind) => [...sent].reverse().find((m) => m.kind === kind);

async function zipOf(files) {
  const blob = await createZip(Object.entries(files).map(([name, text]) => ({ name, bytes: enc(text) })));
  return blob;
}

// The shelf with the shell's upload seam (books.add_book_chooser Decision 5):
// AppShell holds the picked zip and draws the full-screen preview in place of
// everything else; this host does the same for the round trip, without the rest
// of the shell (AppShell.routing.behavior.test.jsx pins the shell's own wiring).
function ShelfWithUpload({ store }) {
  const [upload, setUpload] = useState(null);
  if (upload) {
    return (
      <UploadPreview
        store={store}
        bytes={upload.bytes}
        fileName={upload.fileName}
        onClose={() => setUpload(null)}
      />
    );
  }
  return <BooksScreen store={store} onUpload={setUpload} />;
}

// Open the Add-a-book sheet and feed a zip through the Upload row's picker.
async function uploadThroughSheet(blob, fileName) {
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Add a book' })));
  const dialog = screen.getByRole('dialog');
  // The FileTrigger renders an accessible `.zip` file input inside the sheet.
  const input = dialog.querySelector('input[type="file"]');
  expect(input).toBeTruthy();
  expect(input.getAttribute('accept')).toContain('.zip');
  const file = new File([blob], fileName, { type: 'application/zip' });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
    await Promise.resolve();
  });
}

describe('UploadPreview — a real round-trip (workflow 7 §Uploading a book, §A zip with no history; protocol.js:334-357)', () => {
  it('Upload → preview all songs added → Import as a new book lands on the shelf; then Merge into it replaces per row', async () => {
    const { store, sent } = await makeWorkerStore('rt');
    render(
      <ThemeRoot store={store}>
        <ShelfWithUpload store={store} />
      </ThemeRoot>,
    );
    act(() => store.open());

    // (1) A no-history folder zip of authored songs + a README (for the title).
    const newZip = await zipOf({
      'README.md': '# Banda do Bairro\n',
      'partida.cifra.md': songBody('Partida', 'Hoje eu vou'),
      'chegada.cifra.md': songBody('Chegada', 'Enfim cheguei'),
    });
    await uploadThroughSheet(newZip, 'banda.zip');

    // The preview surface opens and shows every song as *added*.
    await waitFor(() => expect(screen.getByText('Partida')).toBeInTheDocument());
    const songList = document.querySelector('.upload-songs');
    expect(within(songList).getByText('Chegada')).toBeInTheDocument();
    const added = within(songList).getAllByText('added');
    expect(added).toHaveLength(2);
    // PREVIEW_UPLOAD was sent against a new book (Decision 4).
    expect(lastCommand(sent, CommandKind.PREVIEW_UPLOAD).payload.target).toEqual({ kind: 'new' });

    // Confirm *Import as a new book*.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Import as a new book' })));
    await waitFor(() => {
      const imp = lastCommand(sent, CommandKind.IMPORT_UPLOAD);
      expect(imp?.payload.choice).toBe('new_book');
    });
    // The new book appears on the shelf and the surface is gone.
    await waitFor(() => expect(screen.getByText('Banda do Bairro')).toBeInTheDocument());
    expect(document.querySelector('.upload-preview')).toBeNull();

    // (2) A second no-history zip: a changed partida + a brand-new song. Merge it
    // into the book just imported → partida *replace*, extra *added*.
    const mergeZip = await zipOf({
      'partida.cifra.md': songBody('Partida', 'Hoje eu vou enfim'),
      'extra.cifra.md': songBody('Extra', 'Mais uma'),
    });
    await uploadThroughSheet(mergeZip, 'mais.zip');
    await waitFor(() => expect(document.querySelector('.upload-preview')).toBeTruthy());

    // Switch to *Merge into an existing book* and pick the savable target.
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Merge into an existing book' })));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Banda do Bairro' })));

    await waitFor(() => expect(screen.getByText('replace')).toBeInTheDocument());
    expect(screen.getByText('added')).toBeInTheDocument();
    expect(lastCommand(sent, CommandKind.PREVIEW_UPLOAD).payload.target.kind).toBe('existing');

    // Toggle the per-row keep off (keep the book's Partida) and Merge and save.
    const keep = screen.getByRole('checkbox', { name: /Partida/ });
    act(() => fireEvent.click(keep));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Merge and save' })));

    await waitFor(() => {
      const imp = lastCommand(sent, CommandKind.IMPORT_UPLOAD);
      expect(imp?.payload.choice).toBe('replace');
    });
    const imp = lastCommand(sent, CommandKind.IMPORT_UPLOAD);
    expect(imp.payload.target.bookId).toBeTruthy();
    expect(Array.isArray(imp.payload.perFile)).toBe(true);
    expect(imp.payload.perFile).not.toContain('partida.cifra.md'); // the toggle fed perFile
    // The merge settles (SYNC) and the surface closes.
    await waitFor(() => expect(document.querySelector('.upload-preview')).toBeNull());
  });
});

// ---- synthetic preview models (inline endpoint) ----------------------------

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const CHANGES = [
  { kind: 'chord', op: 'changed', where: { section: 'Primeira Parte', bar: 2 }, before: 'D', after: 'D7' },
];
const SUMMARY = 'Primeira Parte bar 2: D → D7';

const model = (overrides = {}) => ({
  uploadId: 'u-synth',
  target: { kind: 'new' },
  branch: 'main',
  hasHistory: true,
  sharedHistory: true,
  historyMarkers: null,
  previews: [],
  ...overrides,
});

const renderPreview = (store) =>
  render(
    <ThemeRoot store={store}>
      <UploadPreview store={store} bytes={new ArrayBuffer(8)} fileName="banda.zip" onClose={() => {}} />
    </ThemeRoot>,
  );

describe('UploadPreview — every status word renders (synthetic UPLOAD_PREVIEW; W07 tablet board)', () => {
  it('a changed row shows the musical summary and diff through the save-sheet DiffRows (workflow 7 L87)', () => {
    const { store, emit } = makeStore();
    renderPreview(store);
    emit(
      event(EventKind.UPLOAD_PREVIEW, model({
        previews: [{ path: 'tarde.cifra.md', title: 'Tarde Clara', status: 'changed', changes: CHANGES, summary: SUMMARY }],
      })),
    );
    expect(screen.getByText('Tarde Clara')).toBeInTheDocument();
    expect(screen.getByText('changed')).toBeInTheDocument();
    expect(screen.getByText(SUMMARY)).toBeInTheDocument();
    // Rendered by DiffRows (the save-sheet component), not a bespoke renderer.
    expect(screen.getByText('Primeira Parte bar 2')).toBeInTheDocument();
    expect(screen.getByText('D → D7')).toBeInTheDocument();
  });

  it('a conflict row shows the word and the "goes to resolution" caption, with no in-preview resolver (Decision 2)', () => {
    const { store, emit } = makeStore();
    renderPreview(store);
    emit(
      event(EventKind.UPLOAD_PREVIEW, model({
        previews: [{ path: 'nasce.cifra.md', title: 'Nasce o Dia', status: 'conflict', line: null }],
      })),
    );
    expect(screen.getByText('conflict')).toBeInTheDocument();
    expect(screen.getByText(/The conflict goes to resolution\./)).toBeInTheDocument();
    // The one conflict surface owns resolution — no keep-mine/keep-theirs here.
    expect(screen.queryByText(/keep mine/i)).toBeNull();
    expect(screen.queryByText(/keep theirs/i)).toBeNull();
  });

  it('an unresolved row shows "fix it before importing", its marker line, and is left out (workflow 7 L108-116)', () => {
    const { store, emit } = makeStore();
    renderPreview(store);
    emit(
      event(EventKind.UPLOAD_PREVIEW, model({
        previews: [{ path: 'marcada.cifra.md', title: 'Marcada', status: 'unresolved', line: 3 }],
      })),
    );
    expect(screen.getByText('unresolved')).toBeInTheDocument();
    expect(screen.getByText(/unresolved merge: fix it before importing/)).toBeInTheDocument();
    expect(screen.getByText(/first marker on line 3/)).toBeInTheDocument();
  });

  it('a historyMarkers notice names the commit and file, offering the escape hatch only when the latest is clean (workflow 7 L117-122)', () => {
    const { store, sent, emit } = makeStore();
    renderPreview(store);

    // latestClean false → no escape hatch.
    emit(event(EventKind.UPLOAD_PREVIEW, model({
      historyMarkers: { commit: 'abcdef1234567', path: 'marcada.cifra.md', line: 3, latestClean: false },
      previews: [],
    })));
    expect(screen.getByText(/abcdef1/)).toBeInTheDocument();
    expect(screen.getByText(/marcada\.cifra\.md/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import the latest version without its history' })).toBeNull();

    // latestClean true → the escape hatch imports latest_without_history.
    emit(event(EventKind.UPLOAD_PREVIEW, model({
      historyMarkers: { commit: 'abcdef1234567', path: 'marcada.cifra.md', line: 3, latestClean: true },
      previews: [],
    })));
    const latest = screen.getByRole('button', { name: 'Import the latest version without its history' });
    act(() => fireEvent.click(latest));
    expect(lastCommand(sent, CommandKind.IMPORT_UPLOAD).payload.choice).toBe('latest_without_history');
  });

  it('names the branch and renders the Left out and Put in canonical form cards (workflow 7 L106; W07 board)', () => {
    const { store, emit } = makeStore();
    renderPreview(store);
    emit(event(EventKind.UPLOAD_PREVIEW, model({ branch: 'main', previews: [] })));
    expect(screen.getByText(/From the zip’s branch main\./)).toBeInTheDocument();
    expect(screen.getByText('Left out')).toBeInTheDocument();
    // shell.plain_language — workflow 7 §Uploading L204-211: plain words, git's
    // own files left to the file view.
    const leftOut = screen.getByText('A book holds songs, setlists and its README, so these stay behind.');
    expect(leftOut).toBeInTheDocument();
    expect(leftOut.closest('.card')).not.toHaveTextContent('.gitattributes');
    expect(screen.getByText('Put in canonical form')).toBeInTheDocument();
    expect(screen.getByText(/The voicings are put in canonical order/)).toBeInTheDocument();
  });

  it('a cancel sends CANCEL_UPLOAD for the shown upload (Decision 5)', () => {
    const { store, sent, emit } = makeStore();
    let closed = false;
    render(
      <ThemeRoot store={store}>
        <UploadPreview store={store} bytes={new ArrayBuffer(8)} fileName="banda.zip" onClose={() => (closed = true)} />
      </ThemeRoot>,
    );
    emit(event(EventKind.UPLOAD_PREVIEW, model({ uploadId: 'u-cancel', previews: [] })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Cancel the upload' })));
    expect(lastCommand(sent, CommandKind.CANCEL_UPLOAD).payload.uploadId).toBe('u-cancel');
    expect(closed).toBe(true);
  });
});

// books.owner_can_save: a book the signed-in person put online is shelved with
// role `owner` and is a Merge-into target; a reader-role book is not (workflow 7
// §Uploading a book, `canSaveFor`).
describe('UploadPreview — an owner-role book is a merge target (books.owner_can_save)', () => {
  it('offers the owner-role shared book as a Merge-into target, never the reader one', async () => {
    const { store, sent, emit } = makeStore();
    const { container } = renderPreview(store);
    emit(
      event(EventKind.SHELF, {
        books: {
          'srv-own': { label: { value: 'Roda de Sábado' }, role: { value: 'owner' }, position: { value: 1 } },
          'srv-read': { label: { value: 'Songbook do Coral' }, role: { value: 'reader' }, position: { value: 2 } },
        },
        local: {},
      }),
    );
    emit(event(EventKind.UPLOAD_PREVIEW, model()));
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Merge into an existing book' })));
    const own = screen.getByRole('radio', { name: 'Roda de Sábado' });
    expect(screen.queryByRole('radio', { name: 'Songbook do Coral' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    act(() => fireEvent.click(own));
    await waitFor(() =>
      expect(lastCommand(sent, CommandKind.PREVIEW_UPLOAD)?.payload.target).toMatchObject({
        kind: 'existing',
        bookId: 'srv-own',
      }),
    );
  });
});

describe('UploadPreview — accessibility (axe WCAG 2.1 AA)', () => {
  it('the Add-a-book chooser’s Upload row is the zip picker, and the chooser is axe-clean (books.add_book_chooser Decision 2)', async () => {
    const { store } = makeStore();
    render(
      <ThemeRoot store={store}>
        <BooksScreen store={store} />
      </ThemeRoot>,
    );
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add a book' })));
    const dialog = screen.getByRole('dialog');
    const row = within(dialog).getByRole('button', { name: 'Upload' });
    expect(row).toHaveAccessibleDescription('A zip of a book, with or without its history.');
    // No separate "Choose a zip" step: the row itself opens the picker.
    expect(within(dialog).queryByRole('button', { name: 'Choose a zip' })).toBeNull();
    expect(dialog.querySelector('input[type="file"]').getAttribute('accept')).toContain('.zip');
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  // W07 #3 L119-122 (books.add_book_chooser Decision 6): the mode switch is one
  // segmented control — the radio group carries `upload-what` and both radios'
  // segments are its direct children. jsdom has no layout, so the one row itself
  // is measured at e2e (upload.spec.js).
  it('the mode switch is one segmented group: both radios are direct segments of `.upload-what`', () => {
    const { store } = makeStore();
    renderPreview(store);
    const group = screen.getByRole('radiogroup', { name: 'What to do with the upload' });
    expect(group).toHaveClass('seg', 'upload-what');
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.closest('.upload-what-opt').textContent)).toEqual([
      'Import as a new book',
      'Merge into an existing book',
    ]);
    for (const radio of radios) {
      expect(radio.closest('.upload-what-opt').parentElement).toBe(group);
    }
  });

  it('the preview is axe-clean with every status present', async () => {
    const { store, emit } = makeStore();
    const { container } = renderPreview(store);
    emit(
      event(EventKind.UPLOAD_PREVIEW, model({
        hasHistory: false,
        branch: 'main',
        historyMarkers: { commit: 'abcdef1234567', path: 'marcada.cifra.md', line: 3, latestClean: true },
        previews: [
          { path: 'a.cifra.md', title: 'Added', status: 'added', changes: [], summary: '' },
          { path: 'c.cifra.md', title: 'Changed', status: 'changed', changes: CHANGES, summary: SUMMARY },
          { path: 'x.cifra.md', title: 'Conflict', status: 'conflict', line: null },
          { path: 'r.cifra.md', title: 'Replace', status: 'replace', changes: CHANGES, summary: SUMMARY },
          { path: 'm.cifra.md', title: 'Marked', status: 'unresolved', line: 3 },
        ],
      })),
    );
    expect(screen.getByText('added')).toBeInTheDocument();
    expect(screen.getByText('replace')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

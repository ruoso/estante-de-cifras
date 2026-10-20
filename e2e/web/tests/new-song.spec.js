// new song (e2e-web) — writing a new song from nothing to a song saved in a
// book, against the compose stack, on the phone, tablet and computer projects
// (songs.new_song, workflow 3). The three ways in that have a host — the empty
// shelf, search's Create row, a book's section — each open the editor on a
// concrete book, and the first save names and commits the file; and all of it
// works offline. Axe runs at WCAG 2.1 AA on the ways-in surface, the editor host
// and the which-book control on every viewport. The file-view way in is
// books.file_view's (no file view exists yet — Decision 7). A fresh Playwright
// context is a first visit: the shelf and IndexedDB start empty. Fixtures are
// purpose-written songs — never anyone's copyrighted words.

import { test, expect } from '../lib/axe.js';
import { runOffline } from '../lib/offline.js';
import { mockup } from '../lib/mockup.js';
import { startApp, openExampleBook, saveThroughSheet } from '../lib/journeys.js';
import { replaceSong } from '../lib/journeys-edit.js';

// A full, canonicalisable song to type in place of the template.
const HARBOUR = [
  '# Harbour Lights',
  '- artist: The Jetty Trio',
  '- notation: brazilian',
  '',
  '## Intro',
  '```',
  'Am | Dm | G7 | C7M',
  '```',
  '',
];

// Replace the editor's template with `lines`, then save through the save sheet
// (the first save ever asks once for the author's name; a typed title means no
// song-name prompt, and the note prefills from the preview). W03#4 — the first
// save on a computer — is framed by the header-follows-the-heading test below.
async function typeAndSave(page, lines) {
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(lines.join('\n'));
  await saveThroughSheet(page, {
    onSheet: async (sheet) => {
      await expect(sheet.getByRole('textbox', { name: 'Note' })).not.toHaveValue('');
    },
  });
}

test('from the empty shelf: Write a song opens the editor on My songs, the first save names and keeps it', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);

  // The first-run ways-in surface is axe-clean.
  await checkA11y();

  await page.getByRole('button', { name: /Write a song/ }).click();

  // The host is up on My songs — the which-book control says so.
  await expect(page.getByText(/In My songs/)).toBeVisible();
  await checkA11y();

  await typeAndSave(page, HARBOUR);

  // Back on search, the song is on the shelf and findable without an unsaved
  // badge; My songs now exists as a book.
  await page.getByRole('searchbox').fill('Harbour');
  await expect(page.getByText('Harbour Lights')).toBeVisible();
  await expect(page.getByText('unsaved')).toHaveCount(0);

  await page.getByRole('searchbox').fill('');
  // The book row (not the "New song in…" / "Search only in…" scope buttons,
  // whose labels also contain "My songs"): anchor at the start so the regex
  // pins the book trigger, whose name is "My songs <count>".
  await expect(page.getByRole('button', { name: /^My songs/ })).toBeVisible();
});

test('from search (no match): Create "{query}" opens the template titled with the query', async ({
  page,
  checkA11y,
}, testInfo) => {
  await startApp(page);

  await page.getByRole('searchbox').fill('Moonlit Pier');
  // W03#1 (songs.editor_chrome): what was searched where, Create, and pasting
  // as a way in of its own (workflow 3 §Ways in).
  await expect(page.getByRole('heading', { name: 'No songs match' })).toBeVisible();
  await expect(page.getByText(/^Searched titles, artists, sections, words and chords in /)).toBeVisible();
  await expect(page.getByText('Or paste a whole song, copied from anywhere, into a new one.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Create .Moonlit Pier./ })).toBeVisible();
  await mockup(page, 'W03-write-a-new-song', 1);
  await checkA11y(); // the no-match state
  await page.getByRole('button', { name: /Create .Moonlit Pier./ }).click();

  // The template is titled with the query, and so is the header.
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await expect(content).toContainText('Moonlit Pier');
  const bar = page.locator('.editor-chrome > .appbar');
  await expect(bar.locator('.title')).toHaveText('Moonlit Pier');
  await expect(bar.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  if (testInfo.project.name === 'phone') {
    // Unsaved from the start: the strip under the header (Decision 2).
    const strip = page.getByRole('status').filter({ hasText: 'Kept on this device' });
    await expect(strip).toContainText('unsaved changes');
  }
  await mockup(page, 'W03-write-a-new-song', 2);
  await checkA11y(); // the new song's editor

  // Put a chord in the empty fence and save; the song is then findable.
  await content.click();
  // The template ends on its closing fence: step up onto the empty line
  // inside it, so the chords are music, not a word after the fence the
  // save sheet would list as not read as a chord (songs.unknown_tokens_loud).
  await page.keyboard.press('Control+End');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.insertText('Am G C');
  await saveThroughSheet(page, {
    onSheet: async (sheet) => {
      await expect(sheet.getByRole('textbox', { name: 'Note' })).not.toHaveValue('');
    },
  });

  await page.getByRole('searchbox').fill('Moonlit');
  await expect(page.getByText('Moonlit Pier')).toBeVisible();
});

test('from a book section: new song in this book lands the song in that book', async ({ page }) => {
  await startApp(page);

  await openExampleBook(page);

  await page.getByRole('button', { name: /New song in Example Book/ }).click();
  await expect(page.getByText(/In Example Book/)).toBeVisible();

  await typeAndSave(page, [
    '# Jetty at Dawn',
    '- artist: The Jetty Trio',
    '- notation: brazilian',
    '',
    '## Intro',
    '```',
    'C | G | Am | F',
    '```',
    '',
  ]);

  // It is in the example book: searching finds it, and its where is that book.
  await page.getByRole('searchbox').fill('Jetty at Dawn');
  await expect(page.getByText('Jetty at Dawn')).toBeVisible();
  await expect(page.getByText(/Example Book/)).toBeVisible();
});

test('offline: a new song can be written and saved, and persists', async ({ page }) => {
  await startApp(page);

  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await offlinePage.getByRole('button', { name: /Write a song/ }).click();
      await expect(offlinePage.getByText(/In My songs/)).toBeVisible();
      await typeAndSave(offlinePage, HARBOUR);

      // The commit is kept locally with no network; the song is findable offline.
      await offlinePage.getByRole('searchbox').fill('Harbour');
      await expect(offlinePage.getByText('Harbour Lights')).toBeVisible();
      await expect(offlinePage.getByText('unsaved')).toHaveCount(0);

      // It persists: after a reload, still offline, the song is still there.
      await offlinePage.reload();
      await offlinePage.getByRole('searchbox').fill('Harbour');
      await expect(offlinePage.getByText('Harbour Lights')).toBeVisible();
    },
  });
});

// A song written for the purpose, with its own heading.
const MARE_MANSA = [
  '# Maré Mansa',
  '- notation: brazilian',
  '',
  '## Intro',
  '```',
  'Am | Dm | G7 | C7M',
  '```',
  '',
].join('\n');

const FILE_NAME_HINT =
  'Named once, from the title. Changing the title later edits its heading, not the file.';

// songs.editor_chrome: the header names the song by its first heading as typed,
// and the first save sits where the device puts it (W03#3-4; workflow 3 §The
// first save; Decision 3).
test('the header follows the first heading, and the first save is a dialog on tablet and computer', async ({
  page,
  checkA11y,
}, testInfo) => {
  const device = testInfo.project.name;
  await startApp(page);
  await page.getByRole('searchbox').fill('Brisa Leve');
  await page.getByRole('button', { name: /Create .Brisa Leve./ }).click();
  const bar = page.locator('.editor-chrome > .appbar');
  await expect(bar.locator('.title')).toHaveText('Brisa Leve');

  await replaceSong(page, MARE_MANSA);
  await expect(bar.locator('.title')).toHaveText('Maré Mansa');
  await mockup(page, 'W03-write-a-new-song', 3, { note: 'header follows the heading' });

  await bar.getByRole('button', { name: 'Save', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  if (device === 'phone') {
    await expect(page.locator('.sheet')).toBeVisible();
  } else {
    await expect(page.locator('.scrim.center .dialog')).toBeVisible();
    await expect(page.locator('.sheet')).toHaveCount(0);
  }
  await expect(dialog.getByRole('heading', { name: 'Save Maré Mansa' })).toBeVisible();
  // songs.first_save_fields: the first save names the book and the file it
  // takes, read-only, with the hint (W03#4 L179-187) — before the frame.
  await expect(dialog.getByRole('textbox', { name: 'Book' })).toHaveValue('My songs');
  const fileName = dialog.getByRole('textbox', { name: 'File name' });
  await expect(fileName).toHaveValue('mare-mansa.cifra.md');
  await expect(fileName).toHaveAccessibleDescription(FILE_NAME_HINT);
  await mockup(page, 'W03-write-a-new-song', 4);
  await checkA11y(); // the first save open
  const nameField = dialog.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill('Marina Souza');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('searchbox').fill('Maré Mansa');
  await expect(page.getByRole('button', { name: /Maré Mansa/ }).first()).toBeVisible();
});

// songs.first_save_fields — workflow 3 §Its file name L48: a name taken in the
// same folder gains -2, and the first save shows it before it is fixed.
test('a second song with a taken title is named with -2', async ({ page, checkA11y }) => {
  await startApp(page);
  const searchbox = page.getByRole('searchbox');

  await searchbox.fill('Primeira Maré');
  await page.getByRole('button', { name: /Create .Primeira Maré./ }).click();
  await replaceSong(page, MARE_MANSA);
  await saveThroughSheet(page, {
    onSheet: async (sheet) => {
      await expect(sheet.getByRole('textbox', { name: 'File name' })).toHaveValue('mare-mansa.cifra.md');
    },
  });

  await searchbox.fill('Segunda Maré');
  await page.getByRole('button', { name: /Create .Segunda Maré./ }).click();
  await replaceSong(page, MARE_MANSA);
  await saveThroughSheet(page, {
    onSheet: async (sheet) => {
      await expect(sheet.getByRole('textbox', { name: 'Book' })).toHaveValue('My songs');
      await expect(sheet.getByRole('textbox', { name: 'File name' })).toHaveValue('mare-mansa-2.cifra.md');
      await checkA11y(); // the first save open, with the fields
    },
  });

  // Both are kept, under the one title.
  await searchbox.fill('Maré Mansa');
  await expect(page.getByRole('button', { name: /^Maré Mansa My songs/ })).toHaveCount(2);
});

// file-view-create (e2e-web) — the file view's *New* menu and its phone bars
// (books.file_view_create_menu; workflow 14 §What can be done to a file
// L147-171 and §Statuses; workflow 3 L32-33; W14 #1-2), on the phone, tablet
// and computer projects against the compose stack. Real UI only: Books →
// *Files in Example Book*, then New → Folder, Setlist, Song and README.md, each
// appearing in the tree and opening; and on a phone, the tree bar's icon
// actions (the *Files* title not squeezed) and the open file's one bar with its
// *More* menu. Axe (WCAG 2.1 AA) on the menu, the setlist and folder dialogs,
// the tree with an empty folder, the open README and the More menu. Fixtures
// are purpose-written (*Rehearsal set*, `ensaios/`, *Harbour Lights*).

import { mockup } from '../lib/mockup.js';
import { test, expect } from '../lib/axe.js';
import { openExampleBook, openFiles } from '../lib/journeys.js';
import {
  EXAMPLE_BOOK,
  fileRow,
  folderRow,
  backToTree,
  confirmSaveSheet,
  createInFiles,
  chooseFolder,
  deleteOpenFile,
  filesTab,
  saveAllChanges,
} from '../lib/journeys-files.js';

const MORNING = 'morning-on-the-porch.cifra.md';
const SETLIST = 'rehearsal-set.setlist.md';

// A purpose-written, canonicalisable song to write into the new folder.
const HARBOUR = [
  '# Harbour Lights',
  '- artist: The Jetty Trio',
  '- notation: brazilian',
  '',
  '## Intro',
  '```',
  'C | Am | F | G7',
  '```',
  '',
];

// The open file's place: the phone's meta line, or the wide header's path.
const openFilePlace = (page) =>
  page.locator('.file-view-meta, .raw-editor-name').filter({ visible: true }).first();

test('create each kind from the New menu; each appears in the tree and opens', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openFiles(page, EXAMPLE_BOOK);
  await expect(fileRow(page, MORNING)).toBeVisible();

  // 1. New opens the four kinds; the book has a README, so that one is the
  //    disabled *README.md already exists* (W14 #1 L58-63).
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'Song', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Setlist', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Folder', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'README.md already exists' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await checkA11y(); // the create menu
  await mockup(page, 'W14-file-view', 1, { note: 'create menu' });
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  // 2. Folder `ensaios`: a row shown *empty*, chosen (workflow 14 §Statuses).
  await createInFiles(page, 'Folder', 'ensaios', checkA11y);
  await expect(folderRow(page, 'ensaios')).toBeVisible();
  await expect(folderRow(page, 'ensaios')).toContainText('empty');
  await expect(folderRow(page, 'ensaios')).toHaveAttribute('aria-pressed', 'true');
  await checkA11y(); // the tree with the empty folder

  // 3. Setlist *Rehearsal set* goes in it, named as it is made, holding only its
  //    title; then it is in the tree as *new* and the folder is no longer empty.
  await createInFiles(page, 'Setlist', 'Rehearsal set', checkA11y);
  await expect(page.locator('.cm-content')).toContainText('# Rehearsal set');
  await expect(openFilePlace(page)).toContainText('ensaios/');
  await backToTree(page);
  await expect(fileRow(page, SETLIST)).toBeVisible();
  await expect(fileRow(page, SETLIST)).toContainText('new');
  await expect(folderRow(page, 'ensaios')).not.toContainText('empty');

  // 4. Song, with `ensaios/` chosen: the editor opens on the template; written
  //    and saved, it is named from its title, in that folder (workflow 3 L32-33).
  await chooseFolder(page, 'ensaios');
  await createInFiles(page, 'Song');
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(HARBOUR.join('\n'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await confirmSaveSheet(page);
  await expect(openFilePlace(page)).toContainText('ensaios/');
  await backToTree(page);
  await expect(fileRow(page, 'harbour-lights.cifra.md')).toBeVisible();

  // 5. The setlist saved with Save…: its *new* word goes.
  await saveAllChanges(page);
  await filesTab(page);
  await expect(fileRow(page, SETLIST)).toBeVisible();
  await expect(fileRow(page, SETLIST)).not.toContainText('new');

  // 6. The README: deleted and saved, then New → README.md is offered, and it
  //    opens holding the book's name, as the file view shows it, as its heading.
  await fileRow(page, 'README.md').click();
  await deleteOpenFile(page, 'README.md');
  await saveAllChanges(page);
  await filesTab(page);
  await expect(fileRow(page, 'README.md')).toHaveCount(0);
  const treeLabel = await page.getByRole('group', { name: /^Files in / }).getAttribute('aria-label');
  const bookName = treeLabel.replace(/^Files in /, '');
  await createInFiles(page, 'README.md');
  await expect(page.locator('.cm-content')).toContainText(`# ${bookName}`);
  await checkA11y(); // the open README
  await backToTree(page);
  await expect(fileRow(page, 'README.md')).toContainText('new');
});

test('on a phone, the top bar’s icon actions and the open file’s More menu', async ({ page, checkA11y }, testInfo) => {
  await openExampleBook(page);
  await openFiles(page, EXAMPLE_BOOK);
  await expect(fileRow(page, MORNING)).toBeVisible();

  if (testInfo.project.name !== 'phone') {
    // The wider layouts keep the board's header buttons (W14 tablet #3).
    await fileRow(page, MORNING).click();
    await expect(page.getByRole('button', { name: `Rename ${MORNING}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Delete ${MORNING}` })).toBeVisible();
    await expect(page.locator('.est-file-view').getByRole('button', { name: 'More', exact: true })).toHaveCount(0);
    return;
  }

  // The tree bar: *Files*, not truncated, then History and New as icon buttons
  // (W14 #1 L30-35).
  const bar = page.locator('.file-view-bar').filter({ visible: true }).first();
  const title = bar.locator('.title');
  await expect(title).toHaveText('Files');
  expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  for (const name of ['History', 'New']) {
    const button = bar.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    await expect(button).toHaveText('');
  }

  // One file open: one bar — Back to files, its base name, More (W14 #2 L68-72).
  await fileRow(page, MORNING).click();
  const fileBar = page.locator('.file-view-narrow-editor .file-view-bar');
  await expect(fileBar.getByRole('button', { name: 'Back to files' })).toBeVisible();
  await expect(fileBar.locator('.title')).toHaveText(MORNING);
  await expect(page.locator('.raw-editor-head')).toHaveCount(0);
  await fileBar.getByRole('button', { name: 'More', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'Rename', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
  await checkA11y(); // the More menu open
  await mockup(page, 'W14-file-view', 2, { note: 'more menu' });

  // Rename through the menu keeps .cifra.md.
  await menu.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').fill('morning-porch');
  await dialog.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(fileBar.locator('.title')).toHaveText('morning-porch.cifra.md');
  await backToTree(page);
  await expect(fileRow(page, 'morning-porch.cifra.md')).toBeVisible();
});

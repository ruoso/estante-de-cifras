// Real-UI journeys for the file view (workflow 14) and setlists (workflow 12).
// Same rules as journeys.js: drive the app from `/` through the real
// navigation; nothing is injected. Folded into journeys.js by the coordinator.

import { expect } from '@playwright/test';
import { openFiles, gotoTab } from './journeys.js';

export const EXAMPLE_BOOK = 'Example Book';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- uploading a book (workflow 7) ---------------------------------------------

// From the Books destination: pick a zip through the Add-a-book chooser's Upload
// row, which is the file picker itself (books.add_book_chooser Decision 2); the
// full-screen preview opens. `checkA11y`, when given, runs on the chooser.
export async function uploadZip(page, zipPath, checkA11y) {
  await page.getByRole('button', { name: 'Add a book' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const row = sheet.getByRole('button', { name: 'Upload' });
  await expect(row).toHaveAccessibleDescription('A zip of a book, with or without its history.');
  if (checkA11y) await checkA11y(); // the chooser
  const chooser = page.waitForEvent('filechooser');
  await row.click();
  await (await chooser).setFiles(zipPath);
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('radiogroup', { name: 'What to do with the upload' })).toBeVisible();
}

// A tree file row: its accessible name starts with the file name (a status
// word may follow). Anchored so it is not the open editor's "Rename <name>" /
// "Delete <name>" buttons, which stay mounted beside the tree on wide layouts.
export const fileRow = (page, name) => page.getByRole('button', { name: new RegExp(`^${escape(name)}`) });

// Only the narrow (phone) layout fills the screen with one pane and offers
// "Back to files"; step back to the tree there. No-op on the wide layouts.
export async function backToTree(page) {
  const back = page.getByRole('button', { name: 'Back to files' });
  if (await back.count()) await back.click();
}

// Leave the file view for the shell it sits over (the file view's own Back).
export async function leaveFiles(page) {
  await backToTree(page);
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
}

// In the file view with a song open: an unsaved edit — a new section, a clean,
// canonicalisable change, inserted before the first section heading so it lands
// in the body. Not saved: the song stays `unsaved` for as long as the session
// lives (the flag is live-only — never reload after this).
export async function editSong(page, mark) {
  const heading = page.locator('.cm-content .cm-line').filter({ hasText: /^## / }).first();
  await heading.click();
  await page.keyboard.press('Home');
  await page.keyboard.insertText(`## ${mark}\n\`\`\`\nC | G\n\`\`\`\n\n`);
}

// Confirm the open save sheet, answering the one-time name prompt if present.
export async function confirmSaveSheet(page, name = 'Marina Souza') {
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill(name);
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toBeHidden();
}

// In the file view with a file open: one of its actions (`Rename` / `Delete`).
// On a phone they sit in the open file's one bar under *More* (⋯); on the wider
// layouts they are the header's `Rename {name}` / `Delete {name}` buttons
// (books.file_view_create_menu Decision 6). Waits for whichever the layout draws.
async function openFileAction(page, action, fileName) {
  const more = page.locator('.est-file-view').getByRole('button', { name: 'More', exact: true });
  const button = page.getByRole('button', { name: `${action} ${fileName}` });
  await expect(more.or(button).first()).toBeVisible();
  if (await button.first().isVisible()) {
    await button.first().click();
    return;
  }
  await more.click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}

// In the file view with a file open: open its rename dialog, on any layout.
export async function openRenameDialog(page, fileName) {
  await openFileAction(page, 'Rename', fileName);
  await expect(page.getByRole('dialog')).toBeVisible();
}

// In the file view with a file open: rename it (keeping its kind).
export async function renameOpenFile(page, fileName, newBase) {
  await openRenameDialog(page, fileName);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(newBase);
  await dialog.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(dialog).toBeHidden();
}

// In the file view with a file open: delete it (asked once).
export async function deleteOpenFile(page, fileName) {
  await openFileAction(page, 'Delete', fileName);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeHidden();
}

// In the file view's tree: *New* → `kind` (Song, Setlist, Folder or README.md),
// in the folder being looked at (books.file_view_create_menu). Setlist and
// Folder open a name dialog: `name` is typed and *Create* pressed — after
// `checkA11y`, when given, runs on the filled dialog.
export async function createInFiles(page, kind, name, checkA11y) {
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: kind, exact: true }).click();
  if (kind !== 'Setlist' && kind !== 'Folder') return;
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').fill(name);
  if (checkA11y) await checkA11y(); // the name dialog
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(dialog).toBeHidden();
}

// A tree folder row: named `{name}/` (then *empty* while the view holds it).
export const folderRow = (page, name) => page.getByRole('button', { name: new RegExp(`^${escape(name)}/`) });

// Choose a folder in the tree, so *New* goes in it.
export async function chooseFolder(page, name) {
  const row = folderRow(page, name);
  await row.click();
  await expect(row).toHaveAttribute('aria-pressed', 'true');
}

// File view history tab (from the tree's bar).
export async function openFilesHistory(page) {
  await backToTree(page);
  await page.getByRole('button', { name: 'History', exact: true }).click();
}

// Back to the tree tab from the history tab.
export async function filesTab(page) {
  await page.getByRole('button', { name: 'Files', exact: true }).click();
}

// Save every pending change in one commit, from the file view's History tab.
export async function saveAllChanges(page) {
  await openFilesHistory(page);
  await page.getByRole('button', { name: /Save \d+ files?…/ }).click();
  await confirmSaveSheet(page);
}

// Books → Files → open a file → delete it (unsaved working-copy removal).
export async function deleteSongInFiles(page, bookTitle, fileName) {
  await openFiles(page, bookTitle);
  await fileRow(page, fileName).first().click();
  await deleteOpenFile(page, fileName);
  await expect(page.getByText('1 file changed')).toBeVisible();
}

// ---- setlists ---------------------------------------------------------------

// The Setlists destination, then the named setlist's read view.
export async function openSetlist(page, name) {
  await gotoTab(page, 'Setlists');
  const row = page.getByRole('button', { name: new RegExp(escape(name)) });
  await expect(row.first()).toBeVisible();
  await row.first().click();
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
}

// From search: the Add-to-setlist icon on a song row opens the dialog.
export async function addToSetlistFromSearch(page, query, title) {
  const searchbox = page.getByRole('searchbox');
  if (!(await searchbox.first().isVisible().catch(() => false))) {
    // A full-screen song on a phone: Back to the destinations first.
    const tab = page.getByRole('tab', { name: 'Search' });
    if (!(await tab.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Back' }).first().click();
    }
    await gotoTab(page, 'Search');
  }
  await searchbox.first().fill(query);
  const addButton = page.getByRole('button', { name: `Add ${title} to a setlist` });
  await expect(addButton.first()).toBeVisible();
  await addButton.first().click();
  await expect(page.getByRole('heading', { name: 'Add to setlist' })).toBeVisible();
}

// Add a song to a brand-new setlist.
export async function addToNewSetlist(page, query, title, setlistName) {
  await addToSetlistFromSearch(page, query, title);
  await page.getByRole('button', { name: 'New setlist…' }).click();
  await page.getByRole('textbox', { name: 'Setlist name' }).fill(setlistName);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Add to setlist' })).toBeHidden();
}

// Add a song to an existing setlist.
export async function addToExistingSetlist(page, query, title, setlistName) {
  await addToSetlistFromSearch(page, query, title);
  await page.getByRole('button', { name: new RegExp(escape(setlistName)) }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add to setlist' })).toBeHidden();
}

// Setlist read view → Edit.
export async function editSetlist(page) {
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('grid', { name: 'Songs · drag to reorder' })).toBeVisible();
}

// Setlist read view → Play.
export async function enterPlayer(page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop playing' })).toBeVisible();
}

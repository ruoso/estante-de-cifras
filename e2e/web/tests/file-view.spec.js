// file-view (e2e-web) — the file view on the phone, tablet and computer
// projects, against the compose stack (books.file_view, workflow 14; DIRECTION
// §4 L449-452). Every journey starts at `/`, puts the example book on the
// device and reaches the file view the way a person does: Books → "Files in
// Example Book". The journeys: write a new song from the file view (named at
// the first save) and see it in the tree; raw-edit one song and rename another
// (keeping .cifra.md); save them together in one commit from the change list;
// open the book's history, open a commit, and restore an earlier version from
// the log, saved as a new version; delete a song, save, and recover it from
// history; rename offline; edit README.md (no musical summary) and restore it;
// and the second way in, a song's *Show the file* from its reading view
// (songs.show_the_file), back to the song. The rename dialog lists the setlist
// items it relinks (none for a setlist), and an open commit is headed by its
// message (books.file_view_history_polish). Axe runs at WCAG 2.1 AA on the tree, the editor,
// the rename dialog, the change list, the history and an open commit. Fixtures
// are purpose-written songs — never anyone's words.

import { mockup } from '../lib/mockup.js';
import { test, expect } from '../lib/axe.js';
import { openExampleBook, openFiles, openSongFromSearch, showFileFromReading, startApp } from '../lib/journeys.js';
import { SONG } from '../lib/journeys-core.js';
import {
  EXAMPLE_BOOK,
  fileRow,
  backToTree,
  confirmSaveSheet,
  renameOpenFile,
  deleteOpenFile,
  openRenameDialog,
  createInFiles,
  openFilesHistory,
  filesTab,
  saveAllChanges,
} from '../lib/journeys-files.js';

const MORNING = 'morning-on-the-porch.cifra.md';
const FERRY = 'the-ferry-line.cifra.md';
const SHORT_SET = 'a-short-set.setlist.md';

// A full, canonicalisable new song to write from the file view.
const JETTY = [
  '# Jetty at Dawn',
  '- artist: The Jetty Trio',
  '- notation: brazilian',
  '',
  '## Intro',
  '```',
  'Am | Dm | G7 | C7M',
  '```',
  '',
];

// Type a new song over the template in the open editor and save it.
async function writeNewSong(page, lines) {
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(lines.join('\n'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await confirmSaveSheet(page);
}

// Insert a section at the top of the open song (a real, canonicalisable edit).
async function editOpenSong(page, mark) {
  const heading = page.locator('.cm-content .cm-line').filter({ hasText: /^## / }).first();
  await heading.click();
  await page.keyboard.press('Home');
  await page.keyboard.insertText(`## ${mark}\n\`\`\`\nC | G\n\`\`\`\n\n`);
}

test('the file view: a new song, a raw edit and a rename saved together; axe-clean', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await openFiles(page, EXAMPLE_BOOK);

  // The tree lists the book's files.
  await expect(fileRow(page, MORNING)).toBeVisible();
  await checkA11y(); // the tree
  await mockup(page, 'W14-file-view', 1); // the book's files (phone)

  // Write a new song from the file view (New → Song, the folder-aware NEW_SONG
  // entry; books.file_view_create_menu).
  await createInFiles(page, 'Song');
  await expect(page.locator('.cm-content')).toBeVisible();
  await checkA11y(); // the raw editor
  await mockup(page, 'W14-file-view', 2); // one file in the raw editor (phone)
  await writeNewSong(page, JETTY);

  // It is in the tree, no longer unsaved.
  await backToTree(page);
  await expect(fileRow(page, 'jetty-at-dawn.cifra.md')).toBeVisible();

  // Raw-edit one song…
  await fileRow(page, MORNING).click();
  await editOpenSong(page, 'Coda');
  await backToTree(page);

  // A setlist relinks nothing when renamed, so its dialog promises no links
  // (books.file_view_history_polish Decision 3).
  await fileRow(page, SHORT_SET).click();
  await openRenameDialog(page, SHORT_SET);
  const setlistDialog = page.getByRole('dialog');
  await expect(setlistDialog.getByRole('heading', { name: 'Rename setlist' })).toBeVisible();
  await expect(setlistDialog.getByText('Links to it are updated in the same save')).toHaveCount(0);
  await setlistDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(setlistDialog).toBeHidden();
  await backToTree(page);

  // …and rename another, keeping its kind (.cifra.md pinned). The dialog lists
  // the setlist item linking to it, rewritten in the same save (workflow 14
  // L151-153; W14 tablet #3 L144-147).
  await fileRow(page, FERRY).click();
  await openRenameDialog(page, FERRY);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Links to it are updated in the same save')).toBeVisible();
  await expect(dialog.getByText(`${SHORT_SET} · item 2`)).toBeVisible();
  await checkA11y(); // the rename dialog, its links listed
  await mockup(page, 'W14-file-view', 3, { note: 'links listed' }); // tree and file side by side, renaming (tablet)
  await dialog.getByRole('textbox').fill('ferry-crossing');
  await dialog.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(dialog).toBeHidden();
  await backToTree(page);

  // The change list (under History) holds both changes; save them in one commit.
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const changes = page.getByRole('group', { name: 'Changes not saved' });
  await expect(changes).toBeVisible();
  await checkA11y(); // the change list + history
  await page.getByRole('button', { name: /Save \d+ files?…/ }).click();
  await confirmSaveSheet(page);

  // The rename landed: the new name is in the tree, the old is gone.
  await filesTab(page);
  await expect(fileRow(page, 'ferry-crossing.cifra.md')).toBeVisible();
  await expect(fileRow(page, FERRY)).toHaveCount(0);

  // Durable: after a reload the tree still has the new names.
  await startApp(page);
  await openFiles(page, EXAMPLE_BOOK);
  await expect(fileRow(page, 'ferry-crossing.cifra.md')).toBeVisible();
  await expect(fileRow(page, 'jetty-at-dawn.cifra.md')).toBeVisible();
  await expect(fileRow(page, FERRY)).toHaveCount(0);
});

test('restoring an earlier version from the book’s history saves it as a new version', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await openFiles(page, EXAMPLE_BOOK);

  // Give a song a second version, so the log has an earlier one to restore.
  await fileRow(page, MORNING).click();
  await editOpenSong(page, 'Reprise');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await confirmSaveSheet(page);

  // Step back to the tree (on the phone the song fills the screen, and History
  // lives on the tree's bar), then open the book's history and an earlier commit.
  await openFilesHistory(page);
  const commits = page.getByRole('group', { name: /Versions of/ });
  await expect(commits).toBeVisible();
  await checkA11y(); // the history list
  await commits.getByRole('button').last().click(); // the oldest (bundled) commit

  // Its per-file diff shows; restore the SONG's earlier version. Scope by the
  // commit-file's name header, not the whole row's text: the bundled root
  // commit also holds the setlist, whose diff body lists this song's path.
  const restore = page
    .locator('.commit-file', { has: page.locator('.commit-file-name', { hasText: MORNING }) })
    .getByRole('button', { name: 'Restore this version' });
  await expect(restore).toBeVisible();
  // The open commit is headed by its message, then author · date (with its
  // year) · hash · files (workflow 14 L169-172; W14 computer #4 L201-202).
  await expect(page.getByRole('heading', { name: 'Open example book' })).toBeVisible();
  await expect(page.locator('.commit-meta')).toContainText(/\b\d{4}\b/);
  await checkA11y(); // an open commit
  await mockup(page, 'W14-file-view', 4, { note: 'commit heading' }); // history, one commit open (computer)
  await restore.click();

  // The restored version opens the save sheet; saving makes a new version.
  await confirmSaveSheet(page);
  await filesTab(page);
  await fileRow(page, MORNING).click();
  await expect(page.locator('.cm-content')).not.toContainText('Reprise');
});

// songs.save_empty_message — workflow 4 §Saving, workflow 14 L149-158: a file
// that is not a song has no musical summary, so the note names the file; the
// save commits and the sheet closes (the parking-lot reproductions).
async function editAndSaveReadme(page, checkA11y) {
  await fileRow(page, 'README.md').click();
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText('\nA line added for this test.\n');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // The note is prefilled with the file it saves; axe on the open sheet.
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('textbox', { name: 'Note' })).toHaveValue('Update README.md');
  if (checkA11y) await checkA11y(); // the save sheet over a non-song file
  await confirmSaveSheet(page); // the sheet hides
}

test('README.md edited in the raw editor and saved closes the sheet and commits Update README.md', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await openFiles(page, EXAMPLE_BOOK);
  await editAndSaveReadme(page, checkA11y);

  // The book's history lists the new version under that message.
  await openFilesHistory(page);
  const commits = page.getByRole('group', { name: /Versions of/ });
  await expect(commits).toBeVisible();
  await expect(commits.getByText('Update README.md').first()).toBeVisible();
});

test('README.md restored from the book’s history and saved closes the sheet', async ({ page }) => {
  await openExampleBook(page);
  await openFiles(page, EXAMPLE_BOOK);
  await editAndSaveReadme(page);

  // Restore README.md's earlier version from the oldest commit and save
  // (workflow 14 L169-173).
  await openFilesHistory(page);
  const commits = page.getByRole('group', { name: /Versions of/ });
  await expect(commits).toBeVisible();
  await commits.getByRole('button').last().click(); // the oldest (bundled) commit
  await page
    .locator('.commit-file', {
      has: page.locator('.commit-file-name', { hasText: /^README\.md$/ }),
    })
    .getByRole('button', { name: 'Restore this version' })
    .click();
  await confirmSaveSheet(page); // the sheet hides
});

test('a deleted song is saved as gone, and recovered from the book’s history (workflow 14 §Delete, workflow 6)', async ({
  page,
}) => {
  await openExampleBook(page);
  await openFiles(page, EXAMPLE_BOOK);

  // Delete (asked once), then save the deletion.
  await fileRow(page, FERRY).click();
  await deleteOpenFile(page, FERRY);
  await expect(page.getByText('1 file changed')).toBeVisible();
  await saveAllChanges(page);
  await filesTab(page);
  await expect(fileRow(page, FERRY)).toHaveCount(0);

  // Recover it: the oldest commit still holds the song; restore it and save.
  await openFilesHistory(page);
  const commits = page.getByRole('group', { name: /Versions of/ });
  await expect(commits).toBeVisible();
  await commits.getByRole('button').last().click();
  await page
    .locator('.commit-file', { has: page.locator('.commit-file-name', { hasText: FERRY }) })
    .getByRole('button', { name: 'Restore this version' })
    .click();
  await confirmSaveSheet(page);

  // The song is back in the tree, and still there after a reload.
  await filesTab(page);
  await expect(fileRow(page, FERRY)).toBeVisible();
  await startApp(page);
  await openFiles(page, EXAMPLE_BOOK);
  await expect(fileRow(page, FERRY)).toBeVisible();
});

test('the file view opens and renames a song offline', async ({ page }) => {
  await openExampleBook(page);

  const context = page.context();
  await context.setOffline(true);
  try {
    await page.reload();
    await openFiles(page, EXAMPLE_BOOK);
    await expect(fileRow(page, MORNING)).toBeVisible();
    await fileRow(page, FERRY).click();
    await renameOpenFile(page, FERRY, 'ferry-offline');

    // All local — no network.
    await saveAllChanges(page);
    await filesTab(page);
    await expect(fileRow(page, 'ferry-offline.cifra.md')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

// songs.show_the_file — workflow 14 §The view L132-138; the e2e coverage audit's
// journey 14.8: search → the song → More → Show the file opens the file view at
// the song's file; Back returns to the song.
test('show the file from the reading view opens the file view at the song; Back returns to it (workflow 14 §The view)', async ({
  page,
  checkA11y,
}, testInfo) => {
  await openExampleBook(page);
  await openSongFromSearch(page, SONG.search, SONG.title);
  await showFileFromReading(page, checkA11y);

  // The song's file open in the raw editor.
  await expect(page.locator('.cm-content')).toContainText(`# ${SONG.title}`);
  if (testInfo.project.name === 'phone') {
    // One pane at a time: the file, with its way back to the tree.
    await expect(page.getByRole('button', { name: 'Back to files' })).toBeVisible();
    await checkA11y(); // the file view, at the file
    await backToTree(page);
  } else {
    await checkA11y(); // the file view, at the file
  }
  // The tree, the song's row selected (beside the file on the wider two).
  await expect(fileRow(page, MORNING)).toBeVisible();
  await expect(fileRow(page, MORNING)).toHaveAttribute('aria-pressed', 'true');

  // The file view's Back: the reading view of the same song.
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await expect(page.getByRole('group', { name: SONG.title }).first()).toBeVisible();
  await expect(page.locator('.cm-content')).toHaveCount(0);
});

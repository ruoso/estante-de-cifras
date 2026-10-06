// file-view (e2e-web) — the file view on the phone, tablet and computer
// projects, against the compose stack (books.file_view, workflow 14; DIRECTION
// §4 L449-452). The surface is reached through the dev hash `#dev/files?book=…`
// (the real entry is the book-management screen's per-book Files control, wired
// in AppShell; the dev mount stands it up for the journey — Decision 7). The
// journey: open a local book's file view; write a new song from the file view
// (named at the first save) and see it in the tree; raw-edit one song and
// rename another (keeping .cifra.md); save them together in one commit from the
// change list; then open the book's history, open a commit, and restore an
// earlier version from the log, saved as a new version. Axe runs at WCAG 2.1 AA
// on the tree, the editor, the rename dialog, the change list, the history and
// an open commit. Fixtures are purpose-written songs — never anyone's words.

import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';

const BOOK = 'local-example-book';
const MORNING = 'morning-on-the-porch.cifra.md';
const FERRY = 'the-ferry-line.cifra.md';
const filesUrl = `/#dev/files?book=${BOOK}`;

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

// Put the example book on the device and wait until a song is indexed.
async function seedExampleBook(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByRole('button', { name: /Open the example book/ }).click();
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.getByText('Morning on the Porch')).toBeVisible();
  await page.getByRole('searchbox').fill('');
}

// A tree file row (its accessible name starts with the file name; a status word
// may follow). Anchored at the start so it is the tree row, not the open
// editor's "Rename <name>" / "Delete <name>" action buttons — whose aria-labels
// embed the same file name and stay mounted beside the tree in the wide (tablet
// and computer) split.
const fileRow = (page, name) =>
  page.getByRole('button', { name: new RegExp(`^${name.replace(/\./g, '\\.')}`) });

// Only the phone (412px, narrow < 600px) fills the screen with one pane and
// offers "Back to files"; step back to the tree there. The tablet (712px) and
// computer (1280px) are wide and keep the tree beside the file (WIDE_QUERY,
// app/src/shell/layout-mode.js) — no such control, so the guard below no-ops.
async function backToTree(page) {
  const back = page.getByRole('button', { name: 'Back to files' });
  if (await back.count()) await back.click();
}

// Confirm the open save sheet, filling the one-time name prompt if present.
async function confirmSave(page) {
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill('Marina Souza');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
}

// Type a new song over the template in the open editor and save it.
async function writeNewSong(page, lines) {
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(lines.join('\n'));
  await page.waitForTimeout(800); // let the debounced WRITE settle
  await page.getByRole('button', { name: 'Save' }).click();
  await confirmSave(page);
}

// Insert a section at the top of the open song (a real, canonicalisable edit).
async function editOpenSong(page, mark) {
  const heading = page.locator('.cm-content .cm-line').filter({ hasText: /^## / }).first();
  await heading.click();
  await page.keyboard.press('Home');
  await page.keyboard.insertText(`## ${mark}\n\`\`\`\nC | G\n\`\`\`\n\n`);
  await page.waitForTimeout(800);
}

test('the file view: a new song, a raw edit and a rename saved together; axe-clean', async ({
  page,
  checkA11y,
}) => {
  await seedExampleBook(page);
  await page.goto(filesUrl);

  // The tree lists the book's files.
  await expect(fileRow(page, MORNING)).toBeVisible();
  await checkA11y(); // the tree

  // Write a new song from the file view (the folder-aware NEW_SONG entry).
  await page.getByRole('button', { name: 'New song' }).click();
  await expect(page.locator('.cm-content')).toBeVisible();
  await checkA11y(); // the raw editor
  await writeNewSong(page, JETTY);

  // It is in the tree, no longer unsaved.
  await backToTree(page);
  await expect(fileRow(page, 'jetty-at-dawn.cifra.md')).toBeVisible();

  // Raw-edit one song…
  await fileRow(page, MORNING).click();
  await editOpenSong(page, 'Coda');
  await backToTree(page);

  // …and rename another, keeping its kind (.cifra.md pinned).
  await fileRow(page, FERRY).click();
  await page.getByRole('button', { name: new RegExp(`Rename ${FERRY.replace(/\./g, '\\.')}`) }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Links to it are updated in the same save')).toBeVisible();
  await checkA11y(); // the rename dialog
  await dialog.getByRole('textbox').fill('ferry-crossing');
  await dialog.getByRole('button', { name: 'Rename' }).click();
  await expect(dialog).toBeHidden();
  await backToTree(page);

  // The change list (under History) holds both changes; save them in one commit.
  await page.getByRole('button', { name: 'History' }).click();
  const changes = page.getByRole('group', { name: 'Changes not saved' });
  await expect(changes).toBeVisible();
  await checkA11y(); // the change list + history
  await page.getByRole('button', { name: /Save \d+ files?…/ }).click();
  await confirmSave(page);

  // The rename landed: the new name is in the tree, the old is gone. The Files
  // tab button is named exactly "Files"; match it exactly so it is not the
  // "Save N files…" button or a commit row (whose name carries "N files").
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  await expect(fileRow(page, 'ferry-crossing.cifra.md')).toBeVisible();
  await expect(fileRow(page, FERRY)).toHaveCount(0);
});

test('restoring an earlier version from the book’s history saves it as a new version', async ({
  page,
  checkA11y,
}) => {
  await seedExampleBook(page);
  await page.goto(filesUrl);

  // Give a song a second version, so the log has an earlier one to restore.
  await fileRow(page, MORNING).click();
  await editOpenSong(page, 'Reprise');
  await page.getByRole('button', { name: 'Save' }).click();
  await confirmSave(page);

  // Step back to the tree (on the phone the song fills the screen, and History
  // lives on the tree's bar), then open the book's history and an earlier commit.
  await backToTree(page);
  await page.getByRole('button', { name: 'History' }).click();
  const commits = page.getByRole('group', { name: /Versions of/ });
  await expect(commits).toBeVisible();
  await checkA11y(); // the history list
  await commits.getByRole('button').last().click(); // the oldest (bundled) commit

  // Its per-file diff shows; restore the SONG's earlier version — the one it gave
  // a second version to. Scope by the commit-file's name header, not the whole
  // row's text: the bundled root commit also holds the setlist, whose diff body
  // lists this song's path, so a row-wide hasText would match the setlist too.
  const restore = page
    .locator('.commit-file', { has: page.locator('.commit-file-name', { hasText: MORNING }) })
    .getByRole('button', { name: 'Restore this version' });
  await expect(restore).toBeVisible();
  await checkA11y(); // an open commit
  await restore.click();

  // The restored version opens the save sheet; saving makes a new version.
  await confirmSave(page);
});

test('the file view opens and renames a song offline', async ({ page }) => {
  await seedExampleBook(page);

  await runOffline(page, {
    path: filesUrl,
    async whileOffline(offlinePage) {
      await expect(fileRow(offlinePage, MORNING)).toBeVisible();
      await fileRow(offlinePage, FERRY).click();
      await offlinePage
        .getByRole('button', { name: new RegExp(`Rename ${FERRY.replace(/\./g, '\\.')}`) })
        .click();
      const dialog = offlinePage.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('textbox').fill('ferry-offline');
      await dialog.getByRole('button', { name: 'Rename' }).click();
      await expect(dialog).toBeHidden();

      await backToTree(offlinePage);
      await offlinePage.getByRole('button', { name: 'History' }).click();
      await offlinePage.getByRole('button', { name: /Save \d+ files?…/ }).click();
      // All local — no network. The name was asked on no earlier save here, so
      // fill it if the sheet asks.
      const sheet = offlinePage.getByRole('dialog');
      await expect(sheet).toBeVisible();
      const nameField = sheet.getByRole('textbox', { name: /Your name/ });
      if (await nameField.count()) await nameField.fill('Marina Souza');
      await sheet.getByRole('button', { name: 'Save' }).click();
      await expect(sheet).toBeHidden();

      await offlinePage.getByRole('button', { name: 'Files', exact: true }).click();
      await expect(fileRow(offlinePage, 'ferry-offline.cifra.md')).toBeVisible();
    },
  });
});

// Journeys for the edit group (editor, save sheet, history, restore-part).
// Built on lib/journeys.js; real-UI only.

import { expect } from '@playwright/test';
import { openExampleBook, openSongFromSearch, openSongInEditor, saveThroughSheet } from './journeys.js';

// Add a new section before the song's FIRST section heading — a clean,
// canonicalisable change ("section added"). `mark` names it. Uses insertText
// (not keyboard.type): CodeMirror's mobile input path collapses Enter keydowns,
// so a multi-line block only forms with insertText. Waits out the write debounce.
export async function addSection(page, mark) {
  const heading = page.locator('.cm-content .cm-line').filter({ hasText: /^## / }).first();
  await heading.click();
  await page.keyboard.press('Home');
  await page.keyboard.insertText(`## ${mark}\n\`\`\`\nC | G\n\`\`\`\n\n`);
}

// Replace the whole song in the open editor with `text`, then let the write
// debounce settle.
export async function replaceSong(page, text) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);
}

// The editor's Save -> the open save sheet (not confirmed).
export async function openSaveSheet(page) {
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  return sheet;
}

// Confirm an open save sheet: answer the one-time name prompt if asked, an
// optional note, then Save, and wait for it to close.
export async function confirmSheet(page, { note, name = 'Marina Souza' } = {}) {
  const sheet = page.getByRole('dialog');
  const nameField = sheet.getByRole('textbox', { name: /Your name/ });
  if (await nameField.count()) await nameField.fill(name);
  if (note !== undefined) await sheet.getByRole('textbox', { name: 'Note' }).fill(note);
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toBeHidden();
}

// Leave the editor/reading view for the search screen, keeping the Worker
// session (no reload). On a phone Back steps editor -> reading -> destinations.
export async function backToSearch(page) {
  const searchbox = page.getByRole('searchbox');
  for (let i = 0; i < 3; i++) {
    if (await searchbox.first().isVisible().catch(() => false)) return;
    const back = page.getByRole('button', { name: 'Back' }).first();
    if (await back.isVisible().catch(() => false)) await back.click();
    else await page.getByRole('tab', { name: 'Search' }).click();
  }
  await expect(searchbox.first()).toBeVisible();
}

// Reading -> Edit (song already open in reading, e.g. after a save returned there).
export async function editAgain(page) {
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.locator('.cm-content')).toBeVisible();
}

// Search -> song -> History list.
export async function openSongHistory(page, query, title) {
  await openSongFromSearch(page, query, title);
  await openHistory(page);
}

// Open a version (the computer opens the newest beside the list; phone/tablet
// show the list until a row is tapped).
export async function openFirstVersion(page) {
  await expect(page.locator('.est-history-row').first()).toBeVisible();
  await page.locator('.est-history-row').first().click();
  await expect(page.getByRole('group', { name: 'The song as it was' })).toBeVisible();
}

// Reading -> History, on any layout: a toolbar button where the reading chrome
// has one (tablet, computer), the app bar's More menu on the phone. (The shared
// journeys.historyFromReading only finds the toolbar button.)
export async function openHistory(page) {
  const button = page.getByRole('button', { name: 'History', exact: true }).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.getByRole('button', { name: 'More', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'History', exact: true }).click();
  }
  await expect(page.locator('.est-history-row').first()).toBeVisible();
}

// Saves give the example song a history over its bundled first version: one
// save per mark (a section added and saved with the note `Add a <mark>`), two
// by default. Leaves the app on the reading view of the song.
export async function buildHistory(page, marks = ['Coda', 'Bridge']) {
  const title = 'Morning on the Porch';
  await openExampleBook(page);
  await openSongInEditor(page, 'Morning', title);
  for (const [i, mark] of marks.entries()) {
    if (i > 0) await editAgain(page);
    await addSection(page, mark);
    await saveThroughSheet(page, { note: `Add a ${mark}` });
  }
  await expect(page.getByRole('group', { name: title }).first()).toBeVisible();
}

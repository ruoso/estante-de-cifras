// Sync-group journeys (conflicts, edit/read in place, sync states). Folded into
// journeys.js by the coordinator.

import { expect } from '@playwright/test';
import { GitDevice } from './git-device.js';
import { hostedBook, waitUntilSearchable, gotoTab, startApp } from './journeys.js';

// Sign in, host an (empty) book, push `files` ({ path: text }) into it from a
// git CLI second device, and wait until the app has synced and indexed a song
// (`query` finds `title`). Returns what hostedBook returns plus the GitDevice.
export async function hostedBookWithSongs(page, bookName, files, { query, title, author }) {
  const hosted = await hostedBook(page, bookName);
  const device = new GitDevice({ url: hosted.url, cookie: hosted.cookie, ...(author ?? {}) });
  await device.pushFiles(files, 'Add songs');
  await waitUntilSearchable(page, query, title);
  return { ...hosted, device };
}

// The song's History from the reading view: an app-bar button on the computer,
// the More menu on the phone and the tablet (shell.narrow_fit Decision 7 — the
// wide appbar collapses History, Add to setlist, Print and Share into ⋯ below
// 1080px), so the button's presence decides.
export async function historyFromReadingAnyViewport(page) {
  const button = page.getByRole('button', { name: 'History', exact: true }).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.getByRole('button', { name: 'More', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'History', exact: true }).click();
  }
}

// Enter the chrome-free full-screen reading view.
export async function enterFullScreen(page, narrow) {
  if (narrow) {
    await page.getByRole('button', { name: 'Full screen' }).click();
  } else {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Full screen' }).click();
  }
  await expect(page.locator('.reading-fullscreen-scroll')).toBeVisible();
}

// Go to a destination tab from wherever we are: with a song open the tab bar
// can be absent (the reading view or editor on some layouts), so step Back
// first.
export async function gotoTabFromSong(page, name) {
  const tab = page.getByRole('tab', { name });
  for (let i = 0; i < 3 && !(await tab.isVisible().catch(() => false)); i++) {
    const back = page.getByRole('button', { name: 'Back' });
    if (await back.count()) {
      await back.first().click();
    } else {
      // The wide reading view has no Back (search sits beside the song): the
      // person reopens the app at `/`, which the precache serves offline too.
      await startApp(page);
    }
  }
  await gotoTab(page, name);
}

// In the open editor: replace the line that reads `oldLine` exactly with
// `newLine`.
export async function replaceLine(page, oldLine, newLine) {
  await page.locator('.cm-content').getByText(oldLine, { exact: true }).first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await page.keyboard.insertText(newLine);
}

// Books → the book → Manage: its detail (books.row_opens_songs).
export { openBookDetail } from './journeys.js';

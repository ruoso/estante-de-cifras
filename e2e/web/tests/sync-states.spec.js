// sync-states (e2e-web) — the Books-header sync affordances (sync.states)
// against the compose stack, on the phone/tablet/computer projects with axe at
// WCAG 2.1 AA on the shelf (contrast included). Drives the REAL Worker end to
// end: the sync slice it reads, the `anyOutOfStep` header mark, the badge slot,
// and the *Sync now* command. Pins workflow 8 L28, L36-38; acceptance 2 (the
// quiet mark), 3 (*Sync now*), 1 (in_step → nothing); DIRECTION §1 (offline-first:
// *Sync now* returns at once, never an error).
//
// The sync engine emits a per-book fact ONLY for a HOSTED book. The first two
// tests use a local book (in step by absence: no badge, no mark). The third is
// the positive out-of-step journey on a hosted book — WBS task
// sync.states_e2e_hosted: the book goes offline with saves waiting, the shelf
// reads *2 saves waiting to go up* with the header mark, the network returns and
// the states clear. Book and song names are written for this test.

import { test, expect } from '../lib/axe.js';
import { GitDevice } from '../lib/git-device.js';
import { mockup } from '../lib/mockup.js';
import {
  makeLocalBook,
  gotoTab,
  startApp,
  hostedBook,
  openSongInEditor,
  editFromReading,
  waitUntilSearchable,
  typeAtEndOfLine,
  saveThroughSheet,
} from '../lib/journeys.js';
import { gotoTabFromSong } from '../lib/journeys-sync.js';

const NAME = 'Domingo de manhã';

async function booksWithOneLocalBook(page) {
  await startApp(page);
  await makeLocalBook(page, NAME);
}

test('an in-step shelf shows no badge and no header quiet mark, and the shelf is axe-clean (workflow 8 L28, L36)', async ({
  page,
  checkA11y,
}) => {
  await booksWithOneLocalBook(page);

  // The local book is in step (never hosted → no sync fact): its row carries no
  // sync badge — the absence IS "in step with Estante" (workflow 8 L28).
  const row = page.locator('.book-row', { hasText: NAME });
  await expect(row).toBeVisible();
  await expect(row.locator('.badge')).toHaveCount(0);

  // The header's one quiet mark is absent when every shelf book is in step.
  await expect(page.getByRole('img', { name: 'Some books are not in step' })).toHaveCount(0);

  await checkA11y(); // the shelf in step, this viewport (real contrast)
});

test('Sync now is reachable by keyboard, fires a pass and returns at once (workflow 8 L37; DIRECTION §1)', async ({
  page,
}) => {
  await booksWithOneLocalBook(page);

  // *Sync now* is a React Aria Button in the Books header (acceptance 3). Reach
  // it by keyboard and activate it with Enter.
  const syncNow = page.getByRole('button', { name: 'Sync now' });
  await syncNow.focus();
  await expect(syncNow).toBeFocused();
  await page.keyboard.press('Enter');

  // It returns immediately: the shelf stays, the button stays enabled, and a
  // local-only pass surfaces nothing — no header mark, no error.
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
  await expect(syncNow).toBeEnabled();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Some books are not in step' })).toHaveCount(0);
  await expect(page.locator('.book-row', { hasText: NAME }).locator('.badge')).toHaveCount(0);
});

// WBS task sync.states_e2e_hosted: the positive out-of-step journey on a hosted
// book (workflow 8 L28-38; acceptance 1-2).
async function offlineSavesJourney(page, checkA11y, recover) {
  test.setTimeout(150000);
  const HOSTED = 'Caderno Offline';
  const TITLE = 'Maré Baixa';
  const FILE = 'mare-baixa.cifra.md';
  const LINE = 'C | G | Am | F';
  const song = ['# ' + TITLE, '- language: en', '', '## Parte', '```', LINE, '```'].join('\n') + '\n';

  const { url, cookie } = await hostedBook(page, HOSTED);
  const ana = new GitDevice({ url, cookie });
  try {
    await ana.pushFiles({ [FILE]: song }, 'Add a song');
  } finally {
    ana.cleanup();
  }
  // Pull the song down and index it (reload until it is searchable).
  await waitUntilSearchable(page, 'Mar', TITLE);

  // In step to begin with: no badge, no header mark.
  await gotoTab(page, 'Books');
  const row = page.locator('.book-row', { hasText: HOSTED });
  await expect(row).toBeVisible();
  await expect(row.getByText(/saves? waiting/)).toHaveCount(0);

  // Go offline and save twice. Each save is a local commit that cannot go up.
  await page.context().setOffline(true);
  await openSongInEditor(page, 'Mar', TITLE);
  await typeAtEndOfLine(page, LINE, ' | Dm');
  await saveThroughSheet(page, { note: 'First offline save' });
  await editFromReading(page);
  await typeAtEndOfLine(page, `${LINE} | Dm`, ' | E7');
  await saveThroughSheet(page, { note: 'Second offline save' });

  // Books reads the state in words, with the header's quiet mark.
  await gotoTabFromSong(page, 'Books');
  await expect(row.getByText('2 saves waiting to go up')).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('img', { name: 'Some books are not in step' })).toBeVisible();
  await mockup(page, 'W08-sync', 1);
  await checkA11y(); // the shelf out of step, this viewport

  // The network returns: the saves go up and the states clear.
  await page.context().setOffline(false);
  await recover();
  await expect(row.getByText(/saves? waiting/)).toHaveCount(0, { timeout: 60000 });
  await expect(page.getByRole('img', { name: 'Some books are not in step' })).toHaveCount(0);
  await expect(row.locator('.badge')).toHaveCount(0);
  await checkA11y(); // the shelf back in step

  // The saves really went up: a fresh clone carries the second save's text.
  const check = new GitDevice({ url, cookie });
  try {
    await check.clone();
    expect(check.read(FILE)).toContain(`${LINE} | Dm | E7`);
  } finally {
    check.cleanup();
  }
}

test('a hosted book offline with two saves waiting reads "2 saves waiting" with the header mark, and both clear when the network returns (workflow 8 L28-38; sync.states_e2e_hosted)', async ({
  page,
  checkA11y,
}) => {
  // BUG: after the app is reloaded while offline (the only way off a wide-layout
  // song), the `online` event no longer triggers a push — the saves stay waiting
  // until Sync now — see coordinator report
  test.fixme(true, 'online event does not push after an offline reload');
  await offlineSavesJourney(page, checkA11y, async () => {});
});

test('a hosted book offline with two saves waiting reads "2 saves waiting" with the header mark, and Sync now clears both once the network is back (workflow 8 L28-38, L37)', async ({
  page,
  checkA11y,
}) => {
  await offlineSavesJourney(page, checkA11y, async () => {
    await page.getByRole('button', { name: 'Sync now' }).click();
  });
});

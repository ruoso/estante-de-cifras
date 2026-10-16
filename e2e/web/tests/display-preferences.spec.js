// display-preferences (e2e-web) — density and the chord diagram's hand and neck
// against the compose stack (shell.display_preferences; workflow 1 §Density;
// workflow 16 §How diagrams are drawn; home-book-format §4.1; Theme-picker
// board). Two journeys on the phone, tablet and computer projects, with axe at
// WCAG 2.1 AA on every screen they draw:
//
//   (1) Density kept across a reload — choose Roomy on the account screen; the
//       app root is density-roomy and Roomy is marked Selected; reload; still
//       so; choose Comfortable; back to density-comfortable.
//   (2) Diagram display kept across a reload, in the explorer and the picker —
//       choose Left-handed and Horizontal; the account's sample follows;
//       reload; every candidate diagram in the explorer, then in the in-song
//       picker, is a horizontal neck in a left-handed host.
//
// No sign-in: preferences live in the local home book from the first minute
// (workflow 13 §The account screen), and the reload is one device.

import { test, expect } from '../lib/axe.js';
import { startApp, openExampleBook, openSongFromSearch } from '../lib/journeys.js';
import { SONG, openExplorerFor, enterArrange, arrangeChord, picker } from '../lib/journeys-core.js';
import {
  openAccount,
  chooseDensity,
  chooseDiagramHand,
  chooseDiagramNeck,
} from '../lib/journeys-account.js';

const root = (page) => page.locator('div.est').first();
const radio = (page, group, name) =>
  page.getByRole('radiogroup', { name: group }).getByRole('radio', { name: new RegExp(name) });
// The chosen row of a group: the one carrying the word "Selected".
const selectedRow = (page, group) =>
  page.getByRole('radiogroup', { name: group }).locator('label', { hasText: 'Selected' });

// Every chord diagram within `scope` is drawn as a horizontal neck in a
// left-handed host — and there is at least one.
async function expectAllLeftHorizontal(scope) {
  const diagrams = scope.locator('.chord-diagram');
  await expect(diagrams.first()).toBeVisible();
  await expect(scope.locator('.chord-diagram:not(.chord-diagram--left)')).toHaveCount(0);
  await expect(scope.locator('.chord-diagram .ec-diagram-vertical')).toHaveCount(0);
  await expect(scope.locator('.chord-diagram--left .ec-diagram-horizontal')).toHaveCount(
    await diagrams.count(),
  );
}

test('keeps a density choice across a reload; axe in each', async ({ page, checkA11y }) => {
  await startApp(page);
  await openAccount(page);
  await expect(root(page)).toHaveClass(/density-comfortable/);

  await chooseDensity(page, 'Roomy');
  await expect(selectedRow(page, 'Density')).toHaveCount(1);
  await expect(selectedRow(page, 'Density')).toContainText('Roomy');
  await checkA11y(); // the account screen, roomy

  // Reload: the committed register re-surfaces, so the density survives.
  await startApp(page);
  await expect(root(page)).toHaveClass(/density-roomy/);
  await openAccount(page);
  await expect(radio(page, 'Density', 'Roomy')).toBeChecked();
  await expect(selectedRow(page, 'Density')).toContainText('Roomy');

  // Comfortable again (the default, a tombstone): back to density-comfortable.
  await chooseDensity(page, 'Comfortable');
  await expect(root(page)).toHaveClass(/density-comfortable/);
  await expect(selectedRow(page, 'Density')).toContainText('Comfortable');
  await checkA11y(); // the account screen, comfortable
});

test('keeps the diagram hand and neck across a reload, in the explorer and the picker; axe', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);
  await openAccount(page);

  await chooseDiagramHand(page, 'Left-handed');
  await chooseDiagramNeck(page, 'Horizontal');
  const sample = page.locator('.account-diagram-sample .chord-diagram--left');
  await expect(sample.locator('.ec-diagram-horizontal')).toBeVisible();
  await checkA11y(); // the account screen, left-handed horizontal

  // Reload, then the explorer: every candidate follows the choice.
  await startApp(page);
  await openExplorerFor(page, 'C');
  await expectAllLeftHorizontal(page);
  await checkA11y(); // the explorer

  // The in-song picker shares the explorer's diagrams; it follows too.
  await openExampleBook(page);
  await openSongFromSearch(page, SONG.search, SONG.title);
  await enterArrange(page);
  await arrangeChord(page).click();
  await expect(picker(page)).toBeVisible();
  await expectAllLeftHorizontal(picker(page));
  await checkA11y(); // the open picker
});

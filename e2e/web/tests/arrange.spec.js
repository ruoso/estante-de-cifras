import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';
import { openExampleBook, openSongFromSearch, startApp, settleEdits } from '../lib/journeys.js';
import {
  SONG,
  enterArrange,
  arrangeChord,
  picker,
  candidate,
  unchosenWords,
  countUnchosen,
  addEmptyVariation,
  saveArrangementThroughSheet,
} from '../lib/journeys-core.js';

// e2e-web — arranging a song end to end on the three viewports (songs.arrange,
// workflow 5). The example book is seeded through the UI, a song is opened from
// search, arrange is entered from the reading view, a chord is tapped, and a
// shape is chosen — with axe at WCAG 2.1 AA on the arrange screen and the open
// picker. Then: only here and enter-a-shape; the whole journey by keyboard on
// the computer; a new variation; a choice saved through the save sheet and still
// chosen after a reload; "Choose these for every unchosen chord"; arrange hidden
// while transposed; and choosing a shape offline. phone is the narrow screen;
// tablet and computer are the wide side-by-side. Pins workflow 5 L14-41, L43-49,
// L30-31, L52-61, L75-85; workflow 2 L135-146; the .tji e2e clause; offline-first.

const openSong = (page) => openSongFromSearch(page, SONG.search, SONG.title);

// Pick a variation in arrange's selector (shown once the instrument has more than one).
const selectVariation = (page, name) =>
  page.getByRole('group', { name: 'Variation' }).getByRole('button', { name }).click();

test('arranges a song for guitar: tap a chord, choose a shape', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);

  // The chart is a group of tappable chords; the shapes strip renders.
  await expect(arrangeChord(page)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Shapes' })).toBeVisible();
  await mockup(page, 'W05-arrange', 1);
  await checkA11y(); // the arrange screen

  // Tap a chord → the picker opens (Every <chord> is the default scope).
  await arrangeChord(page).click();
  await expect(picker(page)).toBeVisible();
  await mockup(page, 'W05-arrange', 2);
  await checkA11y(); // the open picker

  // Choose the first candidate shape; the picker closes and the chart remains.
  await candidate(picker(page)).click();
  await expect(picker(page)).toBeHidden();
  await expect(arrangeChord(page)).toBeVisible();
});

test('only here warns, and a shape by hand can be chosen', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);

  await arrangeChord(page).click();
  await expect(picker(page)).toBeVisible();

  // Only here reveals the shared-chart warning before any shape is chosen.
  await picker(page).getByRole('button', { name: 'Only here' }).click();
  await expect(page.getByText(/marks this bar in the chart/)).toBeVisible();

  // Enter a shape by hand: place a finger and choose it.
  await picker(page).getByRole('button', { name: 'Enter a shape' }).click();
  const dialog = page.getByRole('dialog', { name: /^Enter a shape for/ });
  await expect(dialog).toBeVisible();
  await mockup(page, 'W05-arrange', 3);
  await checkA11y(); // the enter-a-shape dialog
  await dialog.getByRole('radio', { name: 'String 1, fret 4' }).click();
  await candidate(dialog).click();
  await expect(dialog).toBeHidden();
});

test('runs the whole arrange journey by keyboard on the computer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'computer', 'keyboard-only journey runs on the computer viewport');
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);

  // Focus a chord and open the picker with the keyboard; choose a candidate with
  // the keyboard — no pointer.
  await arrangeChord(page).focus();
  await page.keyboard.press('Enter');
  await expect(picker(page)).toBeVisible();
  await candidate(picker(page)).focus();
  await page.keyboard.press('Enter');
  await expect(picker(page)).toBeHidden();
});

test('adds a new variation and switches to it', async ({ page }) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);

  // Guitar has one variation here, so the selector is hidden. Add one.
  await expect(page.getByRole('group', { name: 'Variation' })).toBeHidden();
  await page.getByRole('button', { name: 'Variations' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a variation' });
  await dialog.getByRole('textbox', { name: 'Name for this variation' }).fill('Up the neck');
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(dialog).toBeHidden();

  // With two variations the selector appears; the new one is in use.
  await expect(page.getByRole('group', { name: 'Variation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Up the neck' })).toBeVisible();

  // A choice now lands in the new variation.
  await arrangeChord(page).click();
  await candidate(picker(page)).click();
  await expect(picker(page)).toBeHidden();
});

test('a shape chosen in arrange is saved through the save sheet and is still chosen after a reload', async ({
  page,
}) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);

  // An empty variation starts with nothing chosen: every shape in the strip
  // carries a "default"/"your shape" word.
  await addEmptyVariation(page, 'Up the neck');
  const none = await countUnchosen(page);
  expect(none).toBeGreaterThan(1);

  // Choose a shape for the first chord (Every <chord>): exactly that chord's
  // shape stops being marked.
  await arrangeChord(page).click();
  await candidate(picker(page)).click();
  await expect(picker(page)).toBeHidden();
  await expect(unchosenWords(page)).toHaveCount(none - 1);

  // Done, Edit, Save: the sheet lists the voicing as the change, and the commit lands.
  await saveArrangementThroughSheet(page, {
    note: 'A shape up the neck',
    inspect: async (sheet) => {
      await expect(sheet).toContainText('Voicings');
    },
  });

  // Durable: after a reload the saved variation is there, and with it in use
  // the same chord is still the only one chosen.
  await startApp(page);
  await openSong(page);
  await enterArrange(page);
  await selectVariation(page, 'Up the neck');
  await expect(unchosenWords(page)).toHaveCount(none - 1);
});

test('Choose these for every unchosen chord chooses them all, and they stay chosen after a save and reload', async ({
  page,
}) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);

  // The song's own guitar shapes leave nothing to choose.
  const chooseAll = page.getByRole('button', { name: 'Choose these for every unchosen chord' });
  await expect(chooseAll).toBeDisabled();
  await expect(unchosenWords(page)).toHaveCount(0);

  // A new, empty variation has every chord unchosen — one press chooses them all.
  await addEmptyVariation(page, 'Easy');
  await expect(chooseAll).toBeEnabled();
  expect(await countUnchosen(page)).toBeGreaterThan(1);
  await chooseAll.click();
  await expect(unchosenWords(page)).toHaveCount(0);
  await expect(chooseAll).toBeDisabled();

  await saveArrangementThroughSheet(page, {
    note: 'Easy shapes',
    inspect: async (sheet) => {
      await expect(sheet).toContainText('Voicings');
    },
  });

  await startApp(page);
  await openSong(page);
  await enterArrange(page);
  await selectVariation(page, 'Easy');
  await expect(unchosenWords(page)).toHaveCount(0);
  await expect(chooseAll).toBeDisabled();
});

test('arrange is not offered while the song is transposed, and comes back at the written key (workflow 2 L135-146)', async ({
  page,
}, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  // Narrow: the action bar's Arrange. Wide: the More menu's "Arrange for …".
  const offered = async (yes) => {
    if (narrow) {
      const direct = page.getByRole('button', { name: 'Arrange', exact: true });
      if (yes) await expect(direct).toBeVisible();
      else await expect(direct).toHaveCount(0);
      return;
    }
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('menuitem', { name: 'Full screen' })).toBeVisible();
    const item = page.getByRole('menuitem', { name: /^Arrange for/ });
    if (yes) await expect(item).toBeVisible();
    else await expect(item).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Full screen' })).toBeHidden();
  };

  await openExampleBook(page);
  await openSong(page);
  await offered(true);

  await page.getByRole('button', { name: 'Transpose' }).click();
  await page.getByRole('button', { name: 'Up a semitone' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Arranging is off while transposed')).toBeVisible();
  await offered(false);

  // Back at the written key, arrange is offered again and opens.
  await page.getByRole('button', { name: /^Back to/ }).click();
  await expect(page.getByText('Arranging is off while transposed')).toHaveCount(0);
  await offered(true);
  await enterArrange(page);
});

test('chooses a shape offline; it is still chosen after an offline reload', async ({ page }) => {
  await openExampleBook(page);
  await expect(page.getByRole('searchbox')).toBeVisible();

  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await waitForServiceWorker(offlinePage);
      await openSong(offlinePage);
      await enterArrange(offlinePage);
      await addEmptyVariation(offlinePage, 'Offline fit');
      const none = await countUnchosen(offlinePage);

      await arrangeChord(offlinePage).click();
      await expect(picker(offlinePage)).toBeVisible();
      await candidate(picker(offlinePage)).click();
      await expect(picker(offlinePage)).toBeHidden();
      await expect(unchosenWords(offlinePage)).toHaveCount(none - 1);

      // The choice went to the working copy on the device: it survives a reload
      // with the network still cut.
      await settleEdits(offlinePage);
      await offlinePage.reload();
      await waitForServiceWorker(offlinePage);
      await openSong(offlinePage);
      await enterArrange(offlinePage);
      await selectVariation(offlinePage, 'Offline fit');
      await expect(unchosenWords(offlinePage)).toHaveCount(none - 1);
    },
  });
});

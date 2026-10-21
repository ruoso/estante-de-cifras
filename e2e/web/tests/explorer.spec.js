import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { startApp, openExampleBook, openSongFromSearch } from '../lib/journeys.js';
import {
  SONG,
  chip,
  addInstrument,
  closeInstruments,
  openExplorerFor,
  toSearch,
} from '../lib/journeys-core.js';

// e2e-web (music.explorer) — workflow 16 against the served compose stack, on the
// phone / tablet / computer viewport projects (playwright.config.js), with axe at
// WCAG 2.1 AA (contrast included, in a real browser) on the explorer screen.
//
// The .tji e2e-web clause: "search's chord row opens it, a shape starred as my
// shape, used offline too; axe." Everything the explorer does runs on the device,
// with no account and no book — the fingering search, the diagrams and the home-book
// write are all local (workflow 16 L164-170; workflow 8 for sync).
//
// A real instrument is set up first: *my shapes* are keyed by instrument id
// (home-book §4.4), and the synthesized standard-guitar fallback has none, so the
// star is kept and reviewed against an instrument the user has added — the same
// place the my-shapes review lives (music.instruments).

const EXPLORE_ROW = /Explore A on your/;

const addGuitar = async (page) => {
  // The built-in guitar is listed too (music.instruments_roster_default), so wait
  // on the added one's own row.
  await addInstrument(page, { listed: 'Guitar (6-string) · Standard' });
  await closeInstruments(page);
};
const openExplorer = (page) => openExplorerFor(page, 'A');

test('search’s chord row opens the explorer; a shape is starred as my shape and reviewed; axe', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);

  await addGuitar(page);
  await openExplorer(page);

  // The ranked shapes are drawn, each with a star; axe on the screen.
  await expect(page.getByRole('button', { name: /^Star A,/ }).first()).toBeVisible();
  await checkA11y();
  await mockup(page, 'W16-chord-explorer', 4);

  // Star the first shape — it becomes *your shape* and its button is pressed.
  await page.getByRole('button', { name: /^Star A,/ }).first().click();
  const starred = page.getByRole('button', { name: /^Your shape for A,/ }).first();
  await expect(starred).toBeVisible();
  await expect(starred).toHaveAttribute('aria-pressed', 'true');
  await mockup(page, 'W16-chord-explorer', 1);

  // Back returns to search with the symbol still typed.
  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('A');

  // The star is reviewable in the instrument's my-shapes (music.instruments).
  await chip(page).click();
  // The added guitar, in use — not the built-in row listed beside it.
  await page.getByRole('button', { name: /^Open Guitar \(6-string\) · Standard/ }).click();
  await expect(page.getByText('your shape').first()).toBeVisible();
});

test('the explorer works offline: explore and star with the network cut, and it persists', async ({
  page,
}) => {
  const context = page.context();
  await startApp(page);
  // Set the instrument up online, then cut the network for the real journey.
  await addGuitar(page);

  await context.setOffline(true);
  try {
    // The shell comes back from cache with no network…
    await page.reload();
    await expect(page.getByRole('searchbox')).toBeVisible();

    // …and the whole explorer runs on the device: the chord row opens it, the
    // shapes render, and a star writes the home book locally.
    await openExplorer(page);
    await expect(page.getByRole('button', { name: /^Star A,/ }).first()).toBeVisible();
    await page.getByRole('button', { name: /^Star A,/ }).first().click();
    await expect(page.getByRole('button', { name: /^Your shape for A,/ }).first()).toBeVisible();

    // It persisted locally: a second offline reload still shows it starred.
    await page.reload();
    await page.getByRole('searchbox').fill('A');
    await page.getByRole('button', { name: EXPLORE_ROW }).click();
    await expect(page.getByRole('button', { name: /^Your shape for A,/ }).first()).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test('the explorer’s chord input can be edited: the shapes re-derive, an ambiguous symbol says how it was read, and Back returns to the typed query (workflow 16 §The chord)', async ({
  page,
  checkA11y,
}) => {
  await startApp(page);
  await openExplorer(page);
  await expect(page.getByRole('button', { name: /^Star A,/ }).first()).toBeVisible();

  // A → Am: the diagrams are Am's now.
  const input = page.getByRole('textbox', { name: 'Chord' });
  await input.fill('Am');
  await expect(page.getByRole('button', { name: /^Star Am,/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Star A,/ })).toHaveCount(0);

  // C7+ is ambiguous: the reading it took is said, with the flip, spelled as
  // workflow 16 §Viewing by notation names it (C7♯5, never C7(5+)) — visible
  // before the W16#3 frame so it captures the drawn copy. The shapes' badges
  // read the difficulty word lowercase, as the board draws them.
  await input.fill('C7+');
  await expect(page.getByText(/Read as/).first()).toBeVisible();
  const flip = page.getByRole('button', { name: 'Read as C7♯5 instead?' });
  await expect(flip).toBeVisible();
  await expect(page.locator('.badge').getByText('easy', { exact: true }).first()).toBeVisible();
  await mockup(page, 'W16-chord-explorer', 3);

  // The flip back to the Brazilian reading is spelled in the user's dialect.
  await flip.click();
  await expect(page.getByRole('button', { name: 'Read as C7M instead?' })).toBeVisible();
  await checkA11y();

  // Something that is not a chord says so rather than showing shapes.
  await input.fill('Zzz');
  await expect(page.getByText(/is not a chord this app can read/)).toBeVisible();

  // The input and the search box hold one symbol (workflow 16 L24-26): Back
  // returns to search with what the input holds now.
  await input.fill('Am');
  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('Am');
});

test('a shape entered by hand and starred is "your shape" in the reading view, and removing it takes it away (workflow 16 §Entering a shape; workflow 15 §My shapes)', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  // A tuning none of the example songs carries, so the song has no chosen shape
  // for this instrument and the chord falls to *your shape* when there is one.
  await addInstrument(page, { tuning: 'Drop D', name: 'My Drop D' });
  await closeInstruments(page);

  await openExplorerFor(page, 'G');
  await page.getByRole('button', { name: /^Enter a shape/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Enter a shape' });
  await expect(dialog).toBeVisible();
  // x-2-0-0-0-3 on D A D G B E: a G chord, placed finger by finger.
  await dialog.getByRole('radio', { name: 'String 5, fret 2' }).click();
  await dialog.getByRole('radio', { name: 'Open string 4' }).click();
  await dialog.getByRole('radio', { name: 'Open string 3' }).click();
  await dialog.getByRole('radio', { name: 'Open string 2' }).click();
  await dialog.getByRole('radio', { name: 'String 1, fret 3' }).click();
  await checkA11y(); // the enter-a-shape dialog with a shape placed
  await dialog.getByRole('button', { name: /^Star G,/ }).click();
  await expect(dialog).toBeHidden();

  // In the song, G reads as the shape entered by hand.
  await page.getByRole('button', { name: 'Back to search' }).click();
  await openSongFromSearch(page, SONG.search, SONG.title);
  await expect(
    page.getByText(
      'This song doesn’t say yet how to play its chords on My Drop D, so each chord shows its easiest shape.',
    ),
  ).toBeVisible();
  await mockup(page, 'W02-find-and-play', 3);
  const yours = page.locator('.reading-shapes .chord-diagram__who', { hasText: 'your shape' });
  await expect(yours).toHaveCount(1);

  // Remove it from the instrument's my shapes.
  await toSearch(page);
  await chip(page).click();
  await page.getByRole('button', { name: /^Open My Drop D/ }).click();
  await page.getByRole('button', { name: /^Remove your shape for G,/ }).click();
  await expect(page.getByRole('button', { name: /^Remove your shape for G,/ })).toHaveCount(0);
  await expect(page.getByText(/No shapes saved for this tuning yet/)).toBeVisible();
  await closeInstruments(page);

  // The song no longer has a shape of yours, and the explorer shows G unstarred.
  await openSongFromSearch(page, SONG.search, SONG.title);
  await expect(page.locator('.reading-shapes .chord-diagram').first()).toBeVisible();
  await expect(yours).toHaveCount(0);
  await startApp(page);
  await openExplorerFor(page, 'G');
  await expect(page.getByRole('button', { name: /^Your shape for G,/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Star G,/ }).first()).toBeVisible();
});

import { test, expect } from '../lib/axe.js';
import { openExampleBook, openSongFromSearch, openBookDetail } from '../lib/journeys.js';
import { SONG, addInstrument, closeInstruments } from '../lib/journeys-core.js';

// e2e-web — what the screen says about choosing shapes stays off paper
// (songs.print_no_defaults). On a tuning no example song carries, every shape is
// the app's suggestion: on screen each is marked *default*, a caption explains
// the marks, and a notice offers to arrange the song. A printed song is for
// playing, so the reading view's print and the book's print carry the shapes
// with none of that — every diagram drawn as a song's own, no *default*, no
// caption about the marks, no notice. Pinned on the three viewports with
// `emulateMedia({ media: 'print' })`.

const openSong = (page) => openSongFromSearch(page, SONG.search, SONG.title);

const CAPTION = 'In ink: the song’s own shape. In colour: a shape you chose. In outline, marked default: the app’s suggestion.';
const NOTICE = 'This song doesn’t say yet how to play its chords on My Drop D, so each chord shows its easiest shape.';

// Every default diagram's dots, as the printer would fill them: the computed
// fill of each dot, which on screen is the hollow --default-dot.
const defaultDotFills = (scope) =>
  scope
    .locator('.chord-diagram--default .ec-dot')
    .evaluateAll((dots) => [...new Set(dots.map((d) => getComputedStyle(d).fill))]);
const songDotFill = (page) =>
  page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--ink)';
    document.querySelector('.est').appendChild(probe);
    const ink = getComputedStyle(probe).color;
    probe.remove();
    return ink;
  });

test('the reading view prints its shapes with no default marks, no caption about them and no arrange notice', async ({
  page,
}) => {
  await openExampleBook(page);
  await addInstrument(page, { tuning: 'Drop D', name: 'My Drop D' });
  await closeInstruments(page);
  await openSong(page);

  const shapes = page.locator('.reading-shapes');
  const defaultWords = shapes.locator('.chord-diagram--default .chord-diagram__who');

  // On screen: the marks, their caption and the notice.
  await expect(defaultWords.first()).toBeVisible();
  await expect(defaultWords.first()).toHaveText('default');
  await expect(page.getByText(CAPTION)).toBeVisible();
  await expect(page.getByText(NOTICE)).toBeVisible();
  const screenFills = await defaultDotFills(shapes);

  // On paper: the shapes print, unmarked.
  await page.emulateMedia({ media: 'print' });
  await expect(shapes.locator('.chord-diagram').first()).toBeVisible();
  await expect(defaultWords.first()).toBeHidden();
  expect(await defaultWords.evaluateAll((words) => words.filter((w) => w.checkVisibility()).length)).toBe(0);
  await expect(page.getByText(CAPTION)).toBeHidden();
  await expect(page.getByText(NOTICE)).toBeHidden();
  // Drawn as a song's own shape: filled in ink, not hollow.
  const ink = await songDotFill(page);
  expect(await defaultDotFills(shapes)).toEqual([ink]);
  expect(screenFills).not.toEqual([ink]);

  // Back on screen, all of it returns.
  await page.emulateMedia({ media: 'screen' });
  await expect(defaultWords.first()).toBeVisible();
  await expect(page.getByText(CAPTION)).toBeVisible();
  await expect(page.getByText(NOTICE)).toBeVisible();
});

test('the book prints its songs’ shapes with no default marks and no caption about them', async ({ page }) => {
  await openExampleBook(page);
  await addInstrument(page, { tuning: 'Drop D', name: 'My Drop D' });
  await closeInstruments(page);
  await openBookDetail(page, 'Example Book');
  await page.getByRole('button', { name: 'Print Example Book' }).click();

  const doc = page.locator('.book-print');
  await expect(doc.locator('.reading-shapes').first()).toBeVisible();
  const defaultWords = doc.locator('.chord-diagram--default .chord-diagram__who');
  await expect(defaultWords.first()).toBeAttached();

  await page.emulateMedia({ media: 'print' });
  await expect(doc.locator('.reading-shapes .chord-diagram').first()).toBeVisible();
  expect(await defaultWords.evaluateAll((words) => words.filter((w) => w.checkVisibility()).length)).toBe(0);
  expect(
    await doc.getByText(CAPTION).evaluateAll((captions) => captions.filter((c) => c.checkVisibility()).length),
  ).toBe(0);
  const ink = await songDotFill(page);
  expect(await defaultDotFills(doc)).toEqual([ink]);
});

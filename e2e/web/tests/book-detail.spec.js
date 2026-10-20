// e2e-web — the book detail as drawn (books.detail_as_drawn; workflow 7 §A
// book's songs; W07 #4; design.review_polish item 1): Share in the detail's app
// bar after Rename, no Share card, Download and Files first, then a rule and the
// closing group with Delete last; Rename an icon on a phone; the keyboard path
// Back, Rename, Share, then the body. Against the compose stack, on the three
// viewport projects (phone, tablet, computer), with axe at WCAG 2.1 AA on every
// state it reaches. Book names are written for the test (no-song-text rule).
import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { signedInDevice, makeLocalBook, openBookDetail } from '../lib/journeys.js';
import { closeSharing, peopleScreen } from '../lib/journeys-share.js';

const onPhone = () => test.info().project.name === 'phone';

test("the book detail as drawn: Share in the app bar, Delete set apart at the end (workflow 7 §A book's songs; W07 #4)", async ({
  page,
  checkA11y,
}) => {
  const NAME = 'Sábado de ensaio';
  await signedInDevice(page);
  await makeLocalBook(page, NAME);
  await openBookDetail(page, NAME);

  const detail = page.locator('.book-detail');
  const appbar = detail.locator('.appbar');
  const body = detail.locator('.book-detail-body');

  // A book only on this device has no Share (workflow 7); Put online is there.
  await expect(page.getByRole('button', { name: 'Put online' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0);
  await checkA11y(); // the local book's detail

  // Put it online: Share shows in the detail's app bar.
  await page.getByRole('button', { name: 'Put online' }).click();
  await expect(page.getByText('On Estante · private')).toBeVisible();
  const share = appbar.getByRole('button', { name: 'Share', exact: true });
  await expect(share).toBeVisible();
  await expect(body.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0);

  // The rule sits above Remove from my shelf, and Delete the book is the lowest
  // button of the body (W07 L226: the closing group set apart, Delete last).
  const rule = body.getByRole('separator');
  const remove = body.getByRole('button', { name: 'Remove from my shelf' });
  const del = body.getByRole('button', { name: 'Delete the book' });
  const ruleBox = await rule.boundingBox();
  const removeBox = await remove.boundingBox();
  const filesBox = await body.getByRole('button', { name: `Files in ${NAME}` }).boundingBox();
  expect(ruleBox.y).toBeGreaterThan(filesBox.y);
  expect(ruleBox.y).toBeLessThan(removeBox.y);
  const deleteBox = await del.boundingBox();
  for (const button of await body.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box.y).toBeLessThanOrEqual(deleteBox.y);
  }

  // On a phone, Rename is its icon alone, still named Rename {book}.
  const rename = appbar.getByRole('button', { name: `Rename ${NAME}` });
  if (onPhone()) await expect(rename).toHaveText('');
  else await expect(rename).toHaveText('Rename');
  await mockup(page, 'W07-add-a-book', 4, { note: 'as drawn' });
  await checkA11y(); // the hosted book's detail, as drawn

  // The keyboard path, by the real keyboard: Back, Rename {book}, Share.
  await appbar.getByRole('button', { name: `Back to ${NAME}` }).focus();
  await page.keyboard.press('Tab');
  await expect(rename).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(share).toBeFocused();

  // Enter on Share: the sheet on a phone, the people screen on a tablet or a
  // computer (workflow 10 **Where it sits**). Closing it puts focus back on
  // Share in the app bar.
  await page.keyboard.press('Enter');
  if (onPhone()) {
    const sheet = page.getByRole('dialog', { name: `Share ${NAME}` });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
  } else {
    await expect(peopleScreen(page, NAME)).toBeVisible();
    await closeSharing(page);
  }
  await expect(share).toBeFocused();
  await checkA11y(); // the detail, back from sharing
});

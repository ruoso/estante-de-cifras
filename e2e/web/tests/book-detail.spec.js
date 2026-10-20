// e2e-web — the book detail as drawn (books.detail_as_drawn; workflow 7 §A
// book's songs; W07 #4; design.review_polish item 1): Share in the detail's app
// bar after Rename, no Share card, Download and Files first, then a rule and the
// closing group with Delete last; Rename an icon on a phone; the keyboard path
// Back, Rename, Share, then the body. Against the compose stack, on the three
// viewport projects (phone, tablet, computer), with axe at WCAG 2.1 AA on every
// state it reaches. Book names are written for the test (no-song-text rule).
import { test, expect } from '../lib/axe.js';
import { mockup } from '../lib/mockup.js';
import { signedInDevice, makeLocalBook, openBookDetail, confirmPutOnline } from '../lib/journeys.js';
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

  // Put it online (confirmed in the dialog): Share shows in the detail's app bar.
  await page.getByRole('button', { name: 'Put online' }).click();
  await confirmPutOnline(page, NAME);
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

// books.put_online_confirm (workflow 7 §Putting a book online L143-167; workflow
// 10 §At most fifty people per book): the local card says nobody else can see
// the book; its Put online asks first, Cancel focused; Cancel leaves it local
// with focus back on the card's button; the dialog's Put online makes it
// private on Estante with Share in the app bar, focused; the sharing screen
// says up to 50 people.
test('a local book put online asks first, Cancel leaves it local, and Put online makes it private on Estante with Share in the app bar (workflow 7 §Putting a book online)', async ({
  page,
  checkA11y,
}) => {
  const NAME = 'Ensaio de quinta';
  await signedInDevice(page);
  await makeLocalBook(page, NAME);
  await openBookDetail(page, NAME);

  const detail = page.locator('.book-detail');
  const appbar = detail.locator('.appbar');
  const card = detail.locator('.book-detail-body').getByRole('button', { name: 'Put online' });

  // The local card says the book is invisible to anyone else, and the limit.
  await expect(detail.getByText(/nobody else can see it/)).toBeVisible();
  await expect(detail.getByText(/up to 50\.$/)).toBeVisible();
  await checkA11y(); // the local detail with the card's sentence

  // Put online asks first: Put {book} online?, up to 50 people, Cancel focused.
  await card.click();
  const dialog = page.getByRole('alertdialog', { name: `Put ${NAME} online?` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/up to 50 people\.$/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await checkA11y(); // the dialog open

  // Cancel: no dialog, still local (no Share), focus back on the card's button.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0);
  await expect(page.getByText('On Estante · private')).toHaveCount(0);
  await expect(card).toBeFocused();

  // Put online again, and confirm: private on Estante, Share in the app bar,
  // focused (books.put_online_confirm Decision 3).
  await card.click();
  await confirmPutOnline(page, NAME);
  const share = appbar.getByRole('button', { name: 'Share', exact: true });
  await expect(share).toBeVisible();
  await expect(share).toBeFocused();
  await checkA11y(); // the hosted detail

  // Share: the sharing screen tells the owner the limit (workflow 10).
  await share.click();
  const hint = 'Invite people to read or edit this book — up to 50 people.';
  if (onPhone()) {
    const sheet = page.getByRole('dialog', { name: `Share ${NAME}` });
    await expect(sheet.getByText(hint)).toBeVisible();
  } else {
    await expect(peopleScreen(page, NAME).getByText(hint)).toBeVisible();
  }
  await checkA11y(); // the sharing screen
});

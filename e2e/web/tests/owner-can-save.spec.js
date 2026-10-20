/**
 * e2e-web — a book the signed-in person put online can be saved to everywhere
 * (books.owner_can_save), on the phone, tablet and computer. Put-online writes
 * the shelf entry with role `owner`; the shelf row says *can save* in a word
 * (workflow 7 L19), and Add to setlist offers the book as the new setlist's
 * home (workflow 12 §Building one; setlists Decision 7). The New setlist… name
 * field takes typing at once — the name is typed without clicking the field.
 * axe (WCAG 2.1 AA) runs on the shelf, the picker and the name dialog.
 *
 * Book, song and setlist names are written for this test.
 */
import { test, expect } from '../lib/axe.js';
import { gotoTab, openSongFromSearch } from '../lib/journeys.js';
import { hostedBookWithSong } from '../lib/journeys-share.js';
import { addToNewSetlistFromSong, openSetlist } from '../lib/journeys-files.js';

const BOOK = 'Roda de Sábado';
const SONG_TITLE = 'Feira de Domingo';
const SETLIST = 'Ensaio de quinta';

test('a book put online, then a song added to a new setlist in it from the song view', async ({
  page,
  checkA11y,
}) => {
  test.setTimeout(30000);

  // Sign in, make a book, write a song, put it online (workflow 13; books.online).
  await hostedBookWithSong(page, BOOK, SONG_TITLE);

  // The shelf: the owned book reads *On Estante · can save* (workflow 7 L19).
  await gotoTab(page, 'Books');
  const row = page.getByRole('button', { name: new RegExp(`^${BOOK}`) });
  await expect(row).toContainText('On Estante · can save');
  await checkA11y();

  // The song view → Add to setlist → New setlist…: the picker names the owned
  // book as the new setlist's book (setlists Decision 7), and the name is typed
  // straight into the focused field.
  await openSongFromSearch(page, 'Feira', SONG_TITLE);
  await addToNewSetlistFromSong(page, SONG_TITLE, SETLIST, {
    checkA11y: async () => {
      if (await page.getByRole('textbox', { name: 'Setlist name' }).isVisible().catch(() => false)) {
        // The name dialog is open over the picker: the picker's line says where
        // the new setlist goes — the owned book, not a copy elsewhere.
        await expect(
          page.getByText(`The setlist change is then an unsaved change to ${BOOK}, saved like any other.`),
        ).toBeVisible();
      }
      await checkA11y();
    },
  });

  // The setlist opens from the Setlists destination, in that book, and holds
  // the song (workflow 12 §Building one).
  // Back from the song to the destinations (the tabs are not beside a song).
  await page.getByRole('button', { name: /^Back/ }).filter({ visible: true }).first().click();
  await gotoTab(page, 'Setlists');
  await expect(page.getByRole('button', { name: new RegExp(SETLIST) }).first()).toContainText(BOOK);
  await openSetlist(page, SETLIST);
  await expect(page.locator('.setlist-screen').getByText(SONG_TITLE).first()).toBeVisible();
});

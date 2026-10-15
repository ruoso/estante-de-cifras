// Real-UI journeys for forks (workflow 11): a second account joining a book
// through an invitation, and the make-it-your-own sheet's confirm. Shared by
// fork.spec.js (books.fork) and bring-in.spec.js (books.bring_in).
//
// Everything is the Share dialog, the invited screen and the sheet: no API
// writes, no dev mounts.

import { expect } from '@playwright/test';
import { analyzeWcag21aa } from './axe.js';
import { enableVirtualAuthenticator, waitUntilSearchable } from './journeys.js';
import { inviteThroughShare, acceptInvitation } from './journeys-share.js';
import { openDevice } from './devices.js';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The shelf row's open button for a book (its name starts with the title).
export const bookRowName = (book) => new RegExp(`^${escape(book)}`);

// The make-it-your-own sheet's title for a book.
export const forkSheetTitle = (book) => `${book} is someone else’s — make it your own?`;

// Bia joins Ana's `book` through an invitation of `role`, in a second context,
// and waits until the song (`songTitle`, found by `query`) is on that device.
// Returns the device (`{ context, page }`); the caller closes its context.
export async function biaJoins(browser, page, { book, role, query, songTitle }) {
  const link = await inviteThroughShare(page, book, { role });
  const bia = await openDevice(browser);
  await enableVirtualAuthenticator(bia.page);
  await acceptInvitation(bia.page, link);
  await expect(bia.page.getByRole('button', { name: bookRowName(book) })).toBeVisible();
  await waitUntilSearchable(bia.page, query, songTitle);
  return bia;
}

// The make-it-your-own sheet for `book` is open: axe it, then confirm.
export async function makeItMyOwn(page, book) {
  const sheet = page.getByRole('dialog', { name: forkSheetTitle(book) });
  await expect(sheet).toBeVisible();
  expect(await analyzeWcag21aa(page)).toEqual([]); // axe: the sheet
  await sheet.getByRole('button', { name: 'Make it my own' }).click();
  await expect(sheet).toBeHidden({ timeout: 15000 });
}

// e2e-web (shell.overlay_stacking) — sheets and dialogs always paint above the
// screen. A persona run (2026-10-20) made an account from inside Share on a
// song in a book only on this device: on Done the shell mounted again with the
// sheet still open, the sheet's scrim landed before the song in `.est`, and the
// song's positioned scroll body painted over it — chips, chord diagrams and
// *Arrange for Guitar* on top of the sheet's words; the *New invitation* form
// after Put online the same. Every overlay now portals into ThemeRoot's one
// overlay layer, its own stacking context after the screen. This walks the
// reported journey (workflow 10 §Sharing a song, the needs-online state;
// workflow 13 §Signing in, or making an account, with the recovery email) and,
// at each stop, hit-tests every visible text of the Share surface: the
// browser's elementFromPoint at its centre lands in the surface, so nothing of
// the song page covers it. On the computer Share is the in-flow panel, not a
// sheet; the same hit test pins that it is uncovered. Runs on phone, tablet and
// computer (the projects); real UI only. axe (both themes) at each stop. The
// song is written for this test.

import { test, expect, analyzeBothThemes } from '../lib/axe.js';
import { startApp, enableVirtualAuthenticator, openSongFromSearch, makeAccount } from '../lib/journeys.js';
import { writeSongFromScratch, uniqueEmail } from '../lib/journeys-account.js';

const SONG_TITLE = 'Paper Lanterns';
const SONG = [`# ${SONG_TITLE}`, '', '## Verse', '```', 'G  D | Em  C', '```', ''];
const onPhone = () => test.info().project.name === 'phone';

// Song → Share (an appbar button on the computer, the More menu on the phone
// and the tablet — share-needs-online.spec.js shareSong). The phone's sheet or
// the wide panel.
async function shareSong(page) {
  await openSongFromSearch(page, 'Lanterns', SONG_TITLE);
  const share = page.getByRole('button', { name: 'Share', exact: true });
  if (await share.isVisible().catch(() => false)) {
    await share.click();
  } else {
    await page.getByRole('button', { name: 'More', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'Share', exact: true }).click();
  }
  return page
    .getByRole('dialog', { name: `Share ${SONG_TITLE}` })
    .or(page.getByRole('complementary', { name: `Share ${SONG_TITLE}` }));
}

// Nothing of the page covers the surface (the hit test of
// popover-surface.spec.js, turned inward): for every visible text leaf inside
// the surface, the part of its box inside both the surface's box and the
// viewport is hit-tested at its centre, and the element there is inside the
// surface. Returns the covered leaves, described.
async function coveredText(surface) {
  return surface.evaluate((root) => {
    const r = root.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const covered = [];
    let checked = 0;
    for (const el of root.querySelectorAll('*')) {
      if (el.children.length !== 0 || !(el.textContent || '').trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      const left = Math.max(b.left, r.left, 0);
      const top = Math.max(b.top, r.top, 0);
      const right = Math.min(b.right, r.right, vw);
      const bottom = Math.min(b.bottom, r.bottom, vh);
      if (right - left < 1 || bottom - top < 1) continue;
      checked += 1;
      const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
      if (!hit || !root.contains(hit)) {
        const name = `${hit ? hit.tagName.toLowerCase() : 'nothing'}${hit && typeof hit.className === 'string' && hit.className.trim() ? `.${hit.className.trim().split(/\s+/).join('.')}` : ''}`;
        covered.push(`"${el.textContent.trim().slice(0, 40)}" (hit: ${name})`);
      }
    }
    return { checked, covered };
  });
}

async function expectUncovered(surface, what) {
  const { checked, covered } = await coveredText(surface);
  expect(checked, `${what} has visible text to hit-test`).toBeGreaterThan(0);
  expect(covered, `nothing of the song page covers ${what}`).toEqual([]);
}

test('Share, an account made from it, Done: the sheet and then New invitation are uncovered', async ({ page }) => {
  test.setTimeout(60000);
  await enableVirtualAuthenticator(page);
  // Signed out, a song into this device's My songs.
  await writeSongFromScratch(page, SONG);
  await startApp(page);

  const surface = await shareSong(page);
  await surface.getByRole('button', { name: 'Sign in to put it online' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in or make an account' })).toBeVisible();
  // The report's branch: the recovery email sent, then Done — the shell mounts
  // again with the Share surface still open.
  await makeAccount(page, { recovery: uniqueEmail('overlay') });

  await expect(surface).toBeVisible();
  const putOnline = surface.getByRole('button', { name: 'Put online' });
  await expect(putOnline).toBeVisible();
  await expectUncovered(surface, 'the Share surface after Done');
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: share back over the song

  // Put online, then the invite's New invitation form (on the phone, behind
  // *Invite someone to this song*).
  await putOnline.click();
  await expect(surface.getByRole('textbox', { name: 'Song address' })).toBeVisible({ timeout: 30000 });
  if (onPhone()) await surface.getByRole('button', { name: 'Invite someone to this song' }).click();
  await expect(surface.getByRole('button', { name: 'Create link' })).toBeVisible();
  await expectUncovered(surface, 'the New invitation form');
  expect(await analyzeBothThemes(page)).toEqual([]); // axe: the owner's song invite
});

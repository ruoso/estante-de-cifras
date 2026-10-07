import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';

// e2e-web — running the voicing wizard end to end on the three viewports
// (songs.wizard_ui, workflow 5). The example book is seeded through the UI, a
// song is opened from search, arrange is entered from the reading view, and
// **Run the wizard** opens the wizard: a policy is chosen, the plan previewed,
// and written into a new variation — with axe at WCAG 2.1 AA on the wizard and
// the arrange screen. Then: into a new variation first / over this one second,
// and the fresh-variation shortcut; and the whole run offline. The example song
// already has a guitar voicing block, so the in-use variation has choices and
// the new/over question is offered. phone is the narrow screen; tablet and
// computer are the wide side-by-side. Pins workflow 5 L64-72; the .tji e2e
// clause; offline-first.

const SEARCH = 'Morning';
const SONG_TITLE = 'Morning on the Porch';

async function gotoSearch(page) {
  await page.goto('/');
  await waitForServiceWorker(page);
  const openExample = page.getByRole('button', { name: /Open the example book/ });
  const books = page.getByRole('heading', { name: 'Books' });
  await expect(async () => {
    if (await openExample.isVisible().catch(() => false)) {
      await openExample.click({ timeout: 2000 }).catch(() => {});
    }
    await expect(books).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await page.getByRole('searchbox').fill(SEARCH);
  await expect(page.getByRole('button', { name: new RegExp(SONG_TITLE) }).first()).toBeVisible();
  await page.getByRole('searchbox').fill('');
}

async function openSong(page) {
  await page.getByRole('searchbox').fill(SEARCH);
  const result = page.getByRole('button', { name: new RegExp(SONG_TITLE) });
  await expect(result.first()).toBeVisible();
  await result.first().click();
  await expect(page.locator('.reading-sheet')).toBeVisible();
}

// Enter arrange from the reading view: the narrow action bar's Arrange, or the
// wide "More" overflow's "Arrange for …".
async function enterArrange(page, narrow) {
  if (narrow) {
    await page.getByRole('button', { name: 'Arrange', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: /^Arrange for/ }).click();
  }
  await expect(page.getByText(/Arranging ·/)).toBeVisible();
}

const runWizard = (page) => page.getByRole('button', { name: 'Run the wizard' });
const policy = (page, name) => page.getByRole('button', { name });
const seePlan = (page) => page.getByRole('button', { name: 'See the plan' });
const writePlan = (page) => page.getByRole('button', { name: 'Write the plan' });

// Choose a policy and preview it.
async function toPreview(page, name = 'The smoothest path') {
  await runWizard(page).click();
  await expect(policy(page, name)).toBeVisible();
  await policy(page, name).click();
  await seePlan(page).click();
  await expect(writePlan(page)).toBeVisible();
}

test('runs the wizard into a new variation; the variation reads back in arrange', async ({ page, checkA11y }, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  await gotoSearch(page);
  await openSong(page);
  await enterArrange(page, narrow);

  await toPreview(page);
  // The example song's guitar block already has choices, so the plan is offered
  // into a new variation first.
  await expect(page.getByRole('radio', { name: /Into a new variation/ })).toBeChecked();
  await checkA11y(); // the wizard, at its preview + plan-ready state

  await page.getByRole('textbox', { name: 'Name for this variation' }).fill('Up the neck');
  await writePlan(page).click();

  // Back in arrange: the variation selector now shows, with the new one in use,
  // and the shapes strip reads the plan back.
  await expect(page.getByText(/Arranging ·/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Variation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Up the neck' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Shapes' })).toBeVisible();
  await checkA11y(); // the arrange screen after the wizard
});

test('offers into a new variation first and over this one second; a fresh variation writes straight in', async ({ page }, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  await gotoSearch(page);
  await openSong(page);
  await enterArrange(page, narrow);

  // With choices in the in-use variation, both options are offered, new first.
  await toPreview(page);
  await expect(page.getByRole('radio', { name: /Into a new variation/ })).toBeChecked();
  const over = page.getByRole('radio', { name: /Over Default/ });
  await expect(over).toBeVisible();

  // Over this one replaces the in-use variation's shapes and returns to arrange.
  await over.click();
  await writePlan(page).click();
  await expect(page.getByText(/Arranging ·/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Shapes' })).toBeVisible();

  // A fresh variation with no choices: add an empty one in arrange (not a copy
  // of the one in use), then the wizard writes straight in with no new/over
  // question.
  await page.getByRole('button', { name: 'Variations' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a variation' });
  await dialog.getByRole('textbox', { name: 'Name for this variation' }).fill('Blank');
  await dialog.getByRole('checkbox').uncheck();
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Blank' })).toBeVisible();

  await toPreview(page, 'Down at the nut');
  await expect(page.getByRole('radio', { name: /Into a new variation/ })).toBeHidden();
  await writePlan(page).click();
  await expect(page.getByText(/Arranging ·/)).toBeVisible();
});

test('runs the wizard offline; the plan is written to the working copy', async ({ page }, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  await gotoSearch(page);
  await expect(page.getByRole('searchbox')).toBeVisible();

  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await waitForServiceWorker(offlinePage);
      await openSong(offlinePage);
      await enterArrange(offlinePage, narrow);

      await toPreview(offlinePage);
      await offlinePage.getByRole('textbox', { name: 'Name for this variation' }).fill('Offline plan');
      await writePlan(offlinePage).click();

      // The whole run and the write to the working copy succeed offline.
      await expect(offlinePage.getByText(/Arranging ·/)).toBeVisible();
      await expect(offlinePage.getByRole('button', { name: 'Offline plan' })).toBeVisible();
    },
  });
});

import { test, expect } from '../lib/axe.js';
import { waitForServiceWorker } from '../lib/offline.js';

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

const chip = (page) => page.getByRole('button', { name: /change instrument/ });
const addButton = (page) => page.getByRole('button', { name: 'Add instrument', exact: true });

// Add a standard guitar as a real instrument (so a starred shape persists and is
// reviewable), then close the roster. Works online or offline — it is a local
// home-book write.
async function addGuitar(page) {
  await chip(page).click();
  await expect(page.getByRole('heading', { name: 'Instruments' })).toBeVisible();
  await addButton(page).click();
  await expect(page.getByRole('heading', { name: 'Add instrument' })).toBeVisible();
  await addButton(page).click();
  await expect(page.getByRole('button', { name: /^Open Guitar/ })).toBeVisible();
  await page.keyboard.press('Escape');
}

// From the search screen, type a chord and open the explorer through its row.
async function openExplorer(page) {
  await page.getByRole('searchbox').fill('A');
  await page.getByRole('button', { name: EXPLORE_ROW }).click();
  // The explorer carries the symbol in its chord input.
  await expect(page.getByRole('textbox', { name: 'Chord' })).toHaveValue('A');
}

test('search’s chord row opens the explorer; a shape is starred as my shape and reviewed; axe', async ({
  page,
  checkA11y,
}) => {
  await page.goto('/');
  await waitForServiceWorker(page);

  await addGuitar(page);
  await openExplorer(page);

  // The ranked shapes are drawn, each with a star; axe on the screen.
  await expect(page.getByRole('button', { name: /^Star A,/ }).first()).toBeVisible();
  await checkA11y();

  // Star the first shape — it becomes *your shape* and its button is pressed.
  await page.getByRole('button', { name: /^Star A,/ }).first().click();
  const starred = page.getByRole('button', { name: /^Your shape for A,/ }).first();
  await expect(starred).toBeVisible();
  await expect(starred).toHaveAttribute('aria-pressed', 'true');

  // Back returns to search with the symbol still typed.
  await page.getByRole('button', { name: 'Back to search' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('A');

  // The star is reviewable in the instrument's my-shapes (music.instruments).
  await chip(page).click();
  await page.getByRole('button', { name: /^Open Guitar/ }).click();
  await expect(page.getByText('your shape').first()).toBeVisible();
});

test('the explorer works offline: explore and star with the network cut, and it persists', async ({
  page,
}) => {
  const context = page.context();
  await page.goto('/');
  await waitForServiceWorker(page);
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

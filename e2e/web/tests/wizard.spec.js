import { test, expect } from '../lib/axe.js';
import { runOffline, waitForServiceWorker } from '../lib/offline.js';
import { mockup } from '../lib/mockup.js';
import { openExampleBook, openSongFromSearch, startApp, settleEdits } from '../lib/journeys.js';
import {
  SONG,
  enterArrange,
  arrangePreview,
  unchosenWords,
  addEmptyVariation,
  saveArrangementThroughSheet,
  toPreview,
} from '../lib/journeys-core.js';

const openSong = (page) => openSongFromSearch(page, SONG.search, SONG.title);

// e2e-web — running the voicing wizard end to end on the three viewports
// (songs.wizard_ui, workflow 5). The example book is seeded through the UI, a
// song is opened from search, Arrange opens the editor on its preview
// (songs.arrange_in_editor), and the preview's **Run the wizard** opens the
// wizard: a policy is chosen, the plan previewed, and written into a new
// variation — with axe at WCAG 2.1 AA on the wizard and the editor after it.
// Every run checks the plan was applied: each shape the wizard previewed is the
// song's own afterwards, nothing is left unchosen, and a plan written into a
// new variation leaves the old one as it was. Then: into a new variation first
// / over this one second, and the fresh-variation shortcut; and the whole run
// offline. The example song
// already has a guitar voicing block, so the in-use variation has choices and
// the new/over question is offered. Pins workflow 5 L64-72; the .tji e2e
// clause; offline-first.

const writePlan = (page) => page.getByRole('button', { name: 'Write the plan' });

// What a row of diagrams shows, chord by chord: each diagram's label opens with
// the chord and its shape ("C major, x32010, open position, …"), so the first
// two parts name exactly what is drawn. Sorted, so two rows compare as sets.
async function shapesIn(scope) {
  const labels = await scope
    .locator('svg[role="img"]')
    .evaluateAll((svgs) => svgs.map((svg) => svg.getAttribute('aria-label') ?? ''));
  return labels.map((label) => label.split(', ').slice(0, 2).join(', ')).sort();
}
// The plan the wizard previews (one diagram per chord) — under its steps on a
// phone or a tablet, in the *Shapes · {variation}* column beside the chart on a
// computer — and the shapes the editor's preview shows for the variation in use.
const planShapes = (page) => shapesIn(page.locator('.wizard-preview .shapes, .wizard-main-shapes .shapes'));
const songShapes = (page) => shapesIn(arrangePreview(page).locator('.arrange-shapes'));

// The plan was applied: every shape it previewed is now the song's own for the
// variation in use (a chord the plan plays two ways may add a footnoted shape,
// so the song can show more than the plan's one-per-chord), and nothing is left
// unchosen.
async function expectPlanApplied(page, plan) {
  expect(plan.length, 'the plan previews shapes').toBeGreaterThan(0);
  await expect(arrangePreview(page).locator('.arrange-shapes')).toBeVisible();
  await expect(async () => {
    const shown = await songShapes(page);
    for (const shape of plan) expect(shown, `the song shows the plan's ${shape}`).toContain(shape);
  }).toPass({ timeout: 5000 });
  await expect(unchosenWords(page)).toHaveCount(0);
}

test('runs the wizard into a new variation; the variation reads back in the editor’s preview', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);

  // The song's own shapes, before the wizard.
  const before = await songShapes(page);
  expect(before.length).toBeGreaterThan(0);

  await toPreview(page);
  // The example song's guitar block already has choices, so the plan is offered
  // into a new variation first.
  await expect(page.getByRole('radio', { name: /Into a new variation/ })).toBeChecked();
  await checkA11y(); // the wizard, at its preview + plan-ready state
  const plan = await planShapes(page);

  await page.getByRole('textbox', { name: 'Name for this variation' }).fill('Up the neck');
  await writePlan(page).click();

  // Back in the editor, on its preview: the variation selector now shows, with
  // the new one in use, and the shapes strip reads the plan back.
  await expect(arrangePreview(page)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Variation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Up the neck' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Shapes' })).toBeVisible();
  await expectPlanApplied(page, plan);
  await checkA11y(); // the editor after the wizard

  // Into a new variation, not over the old one: Default still holds the song's
  // own shapes, untouched.
  await page.getByRole('group', { name: 'Variation' }).getByRole('button', { name: 'Default' }).click();
  await expect.poll(() => songShapes(page)).toEqual(before);
  await page.getByRole('group', { name: 'Variation' }).getByRole('button', { name: 'Up the neck' }).click();
  await expectPlanApplied(page, plan);

  // Saved through the editor's save sheet and durable: after a reload
  // the variation is in the song and every chord in it has a chosen shape.
  await saveArrangementThroughSheet(page, {
    note: 'Wizard plan',
    inspect: async (sheet) => {
      await expect(sheet).toContainText('Voicings');
    },
  });
  await startApp(page);
  await openSong(page);
  await enterArrange(page);
  await page.getByRole('group', { name: 'Variation' }).getByRole('button', { name: 'Up the neck' }).click();
  await expectPlanApplied(page, plan);
  await page.getByRole('group', { name: 'Variation' }).getByRole('button', { name: 'Default' }).click();
  await expect.poll(() => songShapes(page)).toEqual(before);
});

test('offers into a new variation first and over this one second; a fresh variation writes straight in', async ({ page }) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);

  // With choices in the in-use variation, both options are offered, new first.
  await toPreview(page);
  await expect(page.getByRole('radio', { name: /Into a new variation/ })).toBeChecked();
  const over = page.getByRole('radio', { name: /Replace “Default”/ });
  await expect(over).toBeVisible();

  // Over this one replaces the in-use variation's shapes and returns to the
  // editor: Default now holds the plan.
  await over.click();
  const overPlan = await planShapes(page);
  await writePlan(page).click();
  await expectPlanApplied(page, overPlan);

  // A fresh variation with no choices: add an empty one in the preview (not a copy
  // of the one in use), then the wizard writes straight in with no new/over
  // question.
  await addEmptyVariation(page, 'Blank');

  await expect(unchosenWords(page).first()).toBeVisible();
  await toPreview(page, 'Down at the nut');
  await expect(page.getByRole('radio', { name: /Into a new variation/ })).toBeHidden();
  const nutPlan = await planShapes(page);
  await writePlan(page).click();
  await expectPlanApplied(page, nutPlan);
  await expect(page.getByRole('group', { name: 'Variation' }).getByRole('button', { name: 'Blank' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

// The chord names the reading view's chart draws, in reading order — sung
// chords (`.c`) and a bar's chords (`.g`), empty where a segment has none.
const chartNames = (page) =>
  page
    .getByRole('group', { name: SONG.title })
    .first()
    .locator('.c, .g')
    .evaluateAll((glyphs) => glyphs.map((g) => g.textContent.trim()));

async function toggleNaming(page, item) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: item }).click();
  await expect(page.getByRole('menu', { name: 'More' })).toHaveCount(0);
}

// The choro planner (choroCentro, workflow 5 §The wizard) plays the six-string's
// part beside a seven-string: its bass a third above the other guitar's, so its
// shapes are inversions. Written into a new variation, every shape it previewed
// is the song's; and named *as voiced* the reading view's chart says what those
// shapes sound — a slash chord over the third — where *as written* it says the
// chart's own names.
test('the choro wizard writes its inversions, and naming chords as voiced shows them', async ({ page, checkA11y }) => {
  await openExampleBook(page);
  await openSong(page);
  const written = await chartNames(page);
  expect(written.filter(Boolean).length).toBeGreaterThan(0);
  expect(written.some((name) => name.includes('/')), 'the song is written with no slash chords').toBe(false);

  await enterArrange(page);
  await page.getByRole('button', { name: 'Run the wizard' }).click();
  await page.getByRole('button', { name: 'Choro, beside a seven-string' }).click();
  // Its one stylistic question, answered with its default.
  await expect(
    page.getByRole('radiogroup', { name: 'Where no third above the other guitar is in the chord' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'See the plan' }).click();
  await expect(writePlan(page)).toBeVisible();
  const plan = await planShapes(page);
  await page.getByRole('textbox', { name: 'Name for this variation' }).fill('Choro');
  await writePlan(page).click();
  await expect(page.getByRole('group', { name: 'Variation' }).getByRole('button', { name: 'Choro' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expectPlanApplied(page, plan);

  // Back to reading, where the Choro variation is the one in use.
  await page.getByRole('button', { name: /^Back/ }).first().click();
  await expect(page.getByRole('group', { name: SONG.title }).first()).toBeVisible();
  expect(await chartNames(page), 'as written, the chart keeps its own names').toEqual(written);

  // As voiced: the chart names what the choro shapes sound.
  await toggleNaming(page, 'Name chords as voiced');
  await expect.poll(() => chartNames(page)).not.toEqual(written);
  const voiced = await chartNames(page);
  expect(voiced).toHaveLength(written.length);
  expect(voiced.some((name) => name.includes('/')), 'an inversion is named over its bass').toBe(true);
  // One shape per chord in the variation, so a chord written the same way is
  // named the same way everywhere; and a renamed chord keeps its written name
  // ahead of the bass it is voiced over.
  const as = new Map();
  written.forEach((name, i) => {
    if (!name) return;
    if (as.has(name)) expect(voiced[i], `every ${name} is named alike`).toBe(as.get(name));
    else as.set(name, voiced[i]);
    if (voiced[i] !== name && voiced[i].includes('/')) {
      expect(voiced[i].startsWith(`${name}/`), `${name} voiced as ${voiced[i]}`).toBe(true);
    }
  });
  await checkA11y(); // the reading view, named as voiced

  // And back: as written, the chart's own names again.
  await toggleNaming(page, 'Name chords as written');
  await expect.poll(() => chartNames(page)).toEqual(written);
});

test('runs the wizard offline; the plan is in the working copy after an offline reload', async ({ page }) => {
  await openExampleBook(page);
  await expect(page.getByRole('searchbox')).toBeVisible();

  await runOffline(page, {
    path: '/',
    async whileOffline(offlinePage) {
      await waitForServiceWorker(offlinePage);
      await openSong(offlinePage);
      await enterArrange(offlinePage);

      await toPreview(offlinePage);
      const plan = await planShapes(offlinePage);
      await offlinePage.getByRole('textbox', { name: 'Name for this variation' }).fill('Offline plan');
      await writePlan(offlinePage).click();

      // The whole run and the write to the working copy succeed offline.
      await expect(arrangePreview(offlinePage)).toBeVisible();
      await expect(offlinePage.getByRole('button', { name: 'Offline plan' })).toBeVisible();
      await expectPlanApplied(offlinePage, plan);

      // The plan is on the device: it is still there after a reload, offline.
      await settleEdits(offlinePage);
      await offlinePage.reload();
      await waitForServiceWorker(offlinePage);
      await openSong(offlinePage);
      await enterArrange(offlinePage);
      await offlinePage.getByRole('group', { name: 'Variation' }).getByRole('button', { name: 'Offline plan' }).click();
      await expectPlanApplied(offlinePage, plan);
    },
  });
});

// On a computer the wizard sits in a 380px pane beside the song's chart, which
// previews the plan; on a phone or a tablet it keeps the whole screen
// (songs.arrange_polish Decisions 6-8; W05#4; workflow 5 L91-93). Its step back
// reads **Back** on all three.
test('on a computer the wizard sits beside the chart', async ({ page, checkA11y }, testInfo) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);
  await toPreview(page);
  await expect(page.getByRole('radio', { name: /Into a new variation/ })).toBeChecked();
  await page.getByRole('textbox', { name: 'Name for this variation' }).fill('Up the neck');

  const split = page.locator('.wizard-split');
  if (testInfo.project.name === 'computer') {
    const side = split.locator('.pane.side');
    const main = split.locator('.pane.main');
    const chart = main.locator('.chart');
    await expect(side).toBeVisible();
    await expect(chart).toBeVisible();
    // Side by side, both on screen without scrolling.
    const sideBox = await side.boundingBox();
    const chartBox = await chart.boundingBox();
    expect(sideBox.x + sideBox.width, 'the wizard pane ends before the chart begins').toBeLessThanOrEqual(chartBox.x + 1);
    await expect(side.getByRole('button', { name: 'Write the plan' })).toBeInViewport();
    await expect(chart).toBeInViewport();
    // The main pane is dressed as arrange and previews the plan.
    await expect(main.getByText('Arranging · Guitar')).toBeVisible();
    await expect(main.getByText('Preview of the plan')).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Shapes · Up the neck' })).toBeVisible();
  } else {
    await expect(split).toHaveCount(0);
    await expect(page.locator('.wizard-screen')).toBeVisible();
  }
  await mockup(page, 'W05-arrange', 4);
  await checkA11y(); // the wizard's plan step, split on the computer

  // Back (not "Other ways") returns to the planners.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Choose a policy' })).toBeVisible();

  // ✕ is the one way out (no second Done beside it, songs.wizard_review): back
  // to the editor that raised it, focus on Run the wizard.
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.wizard-screen')).toHaveCount(0);
  await expect(arrangePreview(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run the wizard' })).toBeFocused();
});

// songs.wizard_review — the plan says which shape is which and which change: every
// diagram it previews carries its chord's name (and, for an inversion, what it
// sounds) and *new shape* or *as now*; the count is of chords, not of the places
// they are played (the example song plays five chords twenty times); and a plan
// that changes nothing offers nothing to write.
test('the plan names its shapes and counts chords; a plan that changes nothing offers nothing to write', async ({
  page,
  checkA11y,
}) => {
  await openExampleBook(page);
  await openSong(page);
  await enterArrange(page);
  // Run the wizard is in sight where the preview begins, beside the instrument.
  const head = arrangePreview(page).locator('.est-editor-preview-head');
  await expect(head.getByRole('button', { name: 'Run the wizard' })).toBeInViewport();

  await toPreview(page, 'Choro, beside a seven-string');
  const plan = page.locator('.wizard-preview, .wizard-main-shapes').first();
  const diagrams = plan.locator('.chord-diagram');
  await expect(diagrams).toHaveCount(5);
  await expect(plan.locator('.chord-diagram__chord')).toHaveText(['G', 'C', 'D', 'Em', 'Am']);
  await expect(plan.locator('.chord-diagram__sounded')).toHaveText(['G/B', 'C/E', 'D/F#', 'Em/G', 'Am/C']);
  await expect(plan.locator('.chord-diagram__who')).toHaveText(Array(5).fill('new shape'));
  await expect(page.getByText('5 of 5 chords would change.')).toBeVisible();
  await checkA11y(); // the plan, named

  // Down at the nut is what the song already has: nothing to write.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Down at the nut' }).click();
  await page.getByRole('button', { name: 'See the plan' }).click();
  await expect(page.getByText(/^Every chord already has the shape this would choose, so there is nothing to write\./)).toBeVisible();
  await expect(plan.locator('.chord-diagram__who')).toHaveText(Array(5).fill('as now'));
  await expect(writePlan(page)).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'Where to put the plan' })).toHaveCount(0);
  await checkA11y(); // nothing to write
});

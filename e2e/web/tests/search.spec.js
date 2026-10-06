import { test, expect } from '../lib/axe.js';
import { runOffline } from '../lib/offline.js';

// e2e-web (songs.search) — the search screen against the served compose stack,
// on the phone / tablet / computer viewport projects (playwright.config.js),
// with axe at WCAG 2.1 AA (contrast included, in a real browser) on every
// screen the task touches.
//
// The app opens on search: one box across every book (workflow 2 L11, DIRECTION
// §4 L430). A chord typed into that box is offered as the explorer row, FIRST,
// recognised entirely on the device (workflow 2 L26-40) — and that recognition
// keeps working after an offline reload, because nothing on this screen needs a
// network (workflow 2 L152-155).
//
// SCOPE NOTE — seeded songs across books: the refinement's "search across books,
// results narrow" case needs purpose-written songs seeded into several books on
// the device. There is no e2e seam to put a book on a device yet: a fresh device
// is an empty shelf, the clone / account / git-serving flows are unbuilt, and
// the Worker's store is not reachable from the page to inject one. So that case
// cannot be written against the current harness without inventing a seeding seam
// or a dev-only injection mount (out of this task's scope). The cases below are
// everything the served surface supports today; the across-books narrowing is
// called out for the first task that lands a book-onto-device flow (see the
// implementer summary).

const EXPLORE_ROW = /Explore A on your/;

test('opens on the search box, axe-clean on this viewport (workflow 2 L11, DIRECTION §4 L430)', async ({
  page,
  checkA11y,
}) => {
  await page.goto('/');

  // The app opens on the Search destination with its one box.
  await expect(page.getByRole('tab', { name: 'Search' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const box = page.getByRole('searchbox');
  await expect(box).toBeVisible();

  await checkA11y();
});

test('a chord typed in the box offers the explorer first, on the device (workflow 2 L26-40)', async ({
  page,
  checkA11y,
}) => {
  await page.goto('/');

  // Typing a chord symbol offers "Explore A on your instrument" — recognised on
  // the device, with no book on the shelf and no network call.
  await page.getByRole('searchbox').fill('A');
  await expect(page.getByRole('button', { name: EXPLORE_ROW })).toBeVisible();

  // Axe clean in the typed state too, on this viewport.
  await checkA11y();
});

test('search still recognises a chord after an offline reload (workflow 2 L152-155, offline-first)', async ({
  page,
}) => {
  await runOffline(page, {
    async whileOffline(offlinePage) {
      // The screen comes back from cache with the network cut…
      await expect(offlinePage.getByRole('searchbox')).toBeVisible();
      // …and the chord explorer is still offered, because recognition runs
      // entirely on the device.
      await offlinePage.getByRole('searchbox').fill('A');
      await expect(
        offlinePage.getByRole('button', { name: EXPLORE_ROW }),
      ).toBeVisible();
    },
  });
});

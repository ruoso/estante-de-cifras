// edit-in-place (e2e-web) — a song open in the EDITOR while sync merges a new
// version under its unsaved edits (songs.edit_in_place, workflow 8 §"A song open
// while it changes" L55-56; W08). The editor-view mirror of read-in-place.spec.js.
// Against the compose stack on the phone/tablet/computer projects, with axe at
// WCAG 2.1 AA on the editor + notice each viewport.
//
// Driven through the real UI from `/`:
//   1. the device signs in (passkey), makes a book and puts it online;
//   2. a SECOND DEVICE (the host `git` CLI, carrying the device's own session
//      cookie over smart HTTP) seeds one song; the app syncs it down;
//   3. the reader finds the song by search, opens it, presses Edit, types an
//      unsaved edit, and the second device pushes a NEW version of the same song
//      (a different part — a clean merge) as INCOMING_AUTHOR;
//   4. a sync (the network drops and comes back — journeys.networkBlip) merges
//      the incoming version UNDER the unsaved edit; the open editor re-reads the
//      merged working text in place (both edits present), the notice says
//      *{name}'s save came in while you were editing, and was merged under your
//      changes*, with a *Came in* row and *See what came in*, which opens the
//      song's history; the *unsaved changes* mark stays (sync.in_place_notices).
// Book and song names are written for this test (no-song-text rule).

import { test, expect } from '../lib/axe.js';
import { GitDevice } from '../lib/git-device.js';
import { mockup } from '../lib/mockup.js';
import { openSongInEditor, typeAtEndOfLine, settleEdits, networkBlip } from '../lib/journeys.js';
import { hostedBookWithSongs } from '../lib/journeys-sync.js';

const BOOK = 'Caderno do Cais';
const SONG_TITLE = 'Harbour Lights';
const SONG_FILE = 'harbour-lights.cifra.md';
const INTRO_LINE = 'C | G | Am | F';
const INTRO_EDIT = ' | B7'; // typed at the end of the intro line
const EDITED_INTRO = `${INTRO_LINE}${INTRO_EDIT}`;
const SONG_V1 = [
  `# ${SONG_TITLE}`,
  '- language: en',
  '',
  '## Intro',
  '```',
  INTRO_LINE,
  '```',
  '',
  '## Verse 1',
  '```',
  'the harbour wakes at dawn',
  '```',
  '',
  '## Verse 2',
  '```',
  'and gulls begin to call',
  '```',
];
// Leading '' makes the one canonical blank line before the heading; no trailing
// '' (a trailing blank line is non-canonical, which the pre-receive hook refuses).
const BRIDGE = ['', '## Bridge', '```', 'a lighthouse sweeps the bay', '```'];
const INCOMING_AUTHOR = 'Ana Luiza';

test('a sync merges a new version under the open editor’s unsaved edit, in place, saying it was merged under the edits and what came in, with the unsaved mark (workflow 8 L55-56, W08#3; sync.in_place_notices)', async ({
  page,
  checkA11y,
}) => {
  const { url, cookie } = await hostedBookWithSongs(
    page,
    BOOK,
    { [SONG_FILE]: `${SONG_V1.join('\n')}\n` },
    { query: 'Harbour', title: SONG_TITLE },
  );

  // Search → song → Edit, then an unsaved edit at the end of the intro line (the
  // part the incoming version will NOT touch).
  await openSongInEditor(page, 'Harbour', SONG_TITLE);
  const content = page.locator('.cm-content');
  await expect(content).toContainText(INTRO_LINE);
  await typeAtEndOfLine(page, INTRO_LINE, INTRO_EDIT);
  await expect(content).toContainText(EDITED_INTRO);
  await checkA11y(); // the editor with an unsaved edit, this viewport

  // Let the debounced WRITE flush the edit into the working copy before the sync
  // captures it.
  await settleEdits(page);
  // The editor says the text is unsaved (sync.in_place_notices; W08#3 L96).
  const unsavedMark = page.locator('.new-song').getByText('unsaved changes', { exact: true });
  await expect(unsavedMark).toBeVisible();

  // The second device publishes a new version (a bridge) of the same song.
  const ana = new GitDevice({ url, cookie, name: INCOMING_AUTHOR, email: 'ana@users.estantedecifras.app' });
  try {
    await ana.clone();
    ana.write(SONG_FILE, ana.read(SONG_FILE) + BRIDGE.join('\n') + '\n');
    await ana.commit('Add a bridge');
    await ana.push();
  } finally {
    ana.cleanup();
  }

  // A sync pass merges the incoming version UNDER the unsaved edit and emits
  // MERGED: the editor re-reads the merged working text in place, notice shown.
  await networkBlip(page);
  const notice = page.locator('.est-editor-update-notice');
  await expect(notice).toBeVisible({ timeout: 10000 });
  await expect(notice).toHaveAttribute('role', 'status');
  // It says the save was merged under the user's changes, and what came in
  // (sync.in_place_notices; W08#3 L101-107).
  await expect(notice).toContainText(
    `${INCOMING_AUTHOR}'s save came in while you were editing, and was merged under your changes.`,
  );
  const cameIn = notice.locator('.diff .d');
  await expect(cameIn).toContainText('Came in');
  await expect(cameIn.locator('span').nth(1)).not.toBeEmpty();
  await expect(notice.getByRole('button', { name: 'See what came in' })).toBeVisible();

  // Both the reader's unsaved edit and the incoming bridge are in the buffer.
  await expect(content).toContainText('B7');
  await expect(content).toContainText('lighthouse');
  // The edits are still unsaved, on top: the mark stays.
  await expect(unsavedMark).toBeVisible();
  await mockup(page, 'W08-sync', 3);
  await checkA11y(); // the merged editor + notice state, this viewport

  await notice.getByRole('button', { name: 'See what came in' }).click();
  await expect(page.locator('.est-history-row').first()).toBeVisible();
  await checkA11y(); // the history surface reached from the notice, this viewport

  // Back returns to the song the editor was opened from.
  await page.getByRole('button', { name: 'Back to the song' }).click();
  await expect(page.locator('.cm-content, .reading-sheet').first()).toBeVisible();
});

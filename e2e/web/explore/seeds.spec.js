// Exploration seeds — never part of the suite. playwright.config.js runs
// tests/ only; these run through explore.config.js, one at a time, under
// `--debug=cli`, from scripts/explore. Each brings the app to a realistic
// starting state through the real UI (the same journeys the suite uses) and
// then pauses at page.pause(), so an agent can attach with playwright-cli and
// explore as a person would (see README.md here).
//
// A seed sets up state only; it asserts nothing about the app beyond what its
// journeys already check. Add a seed for each starting state a persona needs.
import { test } from '@playwright/test';
import { enableVirtualAuthenticator, startApp } from '../lib/journeys.js';
import { hostedBookWithSong } from '../lib/journeys-share.js';

// An exploration session lasts as long as the agent driving it.
test.setTimeout(0);

// A fresh device: nothing on the shelf, not signed in. A virtual platform
// authenticator stands in for the phone's fingerprint, so making an account
// with a passkey works without a prompt; it holds no credential yet.
test('seed: cold device', async ({ page }) => {
  await enableVirtualAuthenticator(page);
  await startApp(page);
  await page.pause();
});

// Signed in with a passkey, with a book put online that holds one song
// (Roda de Choro, Tarde Clara). Saves made earlier carry the journeys' author
// name, Marina Souza — an artifact of the seed, not a finding.
test('seed: signed in with a hosted book', async ({ page }) => {
  await hostedBookWithSong(page, 'Roda de Choro', 'Tarde Clara');
  await page.pause();
});

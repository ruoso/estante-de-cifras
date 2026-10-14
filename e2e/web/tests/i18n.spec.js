import { test, expect } from '../lib/axe.js';

// e2e-web (shell.i18n) — the shell speaks the browser's language on a first
// load (empty home book, no chosen language), <html lang> carries it, and axe
// is clean in each language's layout. Runs on all three viewport projects
// (phone/tablet/computer, playwright.config.js). With no preferences producer
// yet (storage.preferences_surface is deferred), a fresh context's home book is
// empty, so the language is the browser's by primary subtag — exactly the
// first-run behaviour Workflow 1 §Language lines 80-84 calls for.
//
// Pins the .tji note ("the browser's language chosen on a first load; axe in
// each language's layout") and Workflow 1 §Language. The visible chooser is a
// different task's (account.account_screen); here the mechanism is driven by
// the browser language the context reports.

// The four languages, each with a browser tag that resolves to it by primary
// subtag and the Search destination's label in that language (its accessible
// tab name). en-US→en, pt-BR→pt-BR, es-MX→es-419, it-IT→it.
const LANGUAGES = [
  { id: 'en', tag: 'en-US', search: 'Search' },
  { id: 'pt-BR', tag: 'pt-BR', search: 'Busca' },
  { id: 'es-419', tag: 'es-MX', search: 'Búsqueda' },
  { id: 'it', tag: 'it-IT', search: 'Cerca' },
];

for (const lang of LANGUAGES) {
  test.describe(lang.id, () => {
    // The context's locale (platform emulation) sets Accept-Language, and
    // Chromium derives navigator.language / navigator.languages (the list
    // detectLocale reads) from it, the way a device configured for this
    // language would. Nothing is injected into the page.
    test.use({ locale: lang.tag });

    test(`first load shows the shell in ${lang.id}, <html lang>, axe-clean`, async ({
      page,
      checkA11y,
    }) => {
      await page.goto('/');

      // <html lang> carries the resolved language the instant the app mounts.
      await expect(page.locator('html')).toHaveAttribute('lang', lang.id);

      // The shell's first destination renders its label in this language.
      await expect(page.getByRole('tab', { name: lang.search })).toBeVisible();

      // Axe clean in this language's layout — the layout is identical across
      // languages and only the text differs (contrast runs in a real browser).
      await checkA11y();
    });
  });
}

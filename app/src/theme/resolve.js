// The pure theme resolver (shell.tokens). Framework-free: no React, no DOM —
// just the policy that turns the chosen theme and the device's light/dark mode
// into the one applied theme, and builds the visual-language root class. The
// view (ThemeRoot) is the only layer that knows React; this module mirrors the
// framework-free i18n module (app/src/i18n/index.js) so "the theme chosen by
// the device's mode and by the home book" is unit-testable without a DOM.
//
// "Automatic" is a device-mode mapping, not a theme.css change: Estante while
// the device is in light mode, Palco while it is in dark mode — the one pairing
// that can respect the device, two light themes and one dark one (Workflow 1
// lines 94-98). theme.css deliberately carries no prefers-color-scheme query.

// The three drawn themes (docs/mockups/theme.css): two light, one dark.
export const THEMES = Object.freeze(['estante', 'caderno', 'palco']);

// The values a user can choose, from preferences.json's `theme` register:
// an explicit theme, or `automatic` (home-book-format §4.1 lines 199-202).
export const CHOSEN_THEMES = Object.freeze(['automatic', ...THEMES]);

// Density ships fixed at the mockup prop default; no chooser, no persistence
// (no `density` register in home-book-format §4.1 — Decision "density ships as
// a render axis"). It stays a parameter so the behavior test can render each.
export const DENSITIES = Object.freeze(['compact', 'comfortable', 'roomy']);
export const DEFAULT_DENSITY = 'comfortable';

// Resolve the applied theme from the chosen theme and whether the device is in
// dark mode. An explicit theme is returned unchanged whatever the device asks;
// anything else — `automatic`, an absent register (undefined/null), or an
// unknown value — follows the device: Palco in dark, Estante in light.
export function resolveTheme(chosenTheme, prefersDark) {
  if (THEMES.includes(chosenTheme)) return chosenTheme;
  return prefersDark ? 'palco' : 'estante';
}

// The visual-language root class the app root carries: `est theme-<applied>
// density-<density>` (docs/mockups/theme.css — every board sets exactly this).
export function themeClasses(appliedTheme, density = DEFAULT_DENSITY) {
  return `est theme-${appliedTheme} density-${density}`;
}

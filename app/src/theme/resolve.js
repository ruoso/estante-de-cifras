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

// The densities a user can choose, from preferences.json's `density` register
// (home-book-format §4.1): absent, a tombstone, or an unknown value all read as
// comfortable — the default lives here, never in the data.
export const DENSITIES = Object.freeze(['compact', 'comfortable', 'roomy']);
export const DEFAULT_DENSITY = 'comfortable';

// How a chord diagram is drawn, from the `diagramHanded` and
// `diagramOrientation` registers (home-book-format §4.1; workflow 16 §How
// diagrams are drawn). Each is its own register, resolved independently.
export const HANDS = Object.freeze(['right', 'left']);
export const DEFAULT_HAND = 'right';
export const ORIENTATIONS = Object.freeze(['vertical', 'horizontal']);
export const DEFAULT_ORIENTATION = 'vertical';

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

// The applied density: the register's value when it is one of DENSITIES, else
// comfortable (an unknown value reads as the default and is left as it is —
// home-book-format §4.1).
export function resolveDensity(value) {
  return DENSITIES.includes(value) ? value : DEFAULT_DENSITY;
}

// How every chord diagram is drawn, from the preferences slice: `{ handed,
// orientation }`, each the register's value when in its set, else the default.
export function resolveDiagramDisplay(preferences) {
  const handed = preferences?.diagramHanded?.value;
  const orientation = preferences?.diagramOrientation?.value;
  return {
    handed: HANDS.includes(handed) ? handed : DEFAULT_HAND,
    orientation: ORIENTATIONS.includes(orientation) ? orientation : DEFAULT_ORIENTATION,
  };
}

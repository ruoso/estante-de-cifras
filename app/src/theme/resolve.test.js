import { describe, it, expect } from 'vitest';
import { resolveTheme, themeClasses, DEFAULT_DENSITY } from './resolve.js';

// unit — the pure theme resolver (shell.tokens). Pins "the theme chosen by the
// device's mode and by the home book" (the .tji note): automatic maps to the
// device's light/dark mode (Workflow 1 lines 94-103), an absent register is
// automatic (home-book-format §4.1 lines 199-202), and an explicit choice
// overrides the device. No DOM: the resolver is framework-free.
describe('resolveTheme', () => {
  it('maps automatic to the device mode: dark → palco, light → estante (workflow 1 L94-98)', () => {
    expect(resolveTheme('automatic', true)).toBe('palco');
    expect(resolveTheme('automatic', false)).toBe('estante');
  });

  it('treats an absent chosen theme as automatic (home-book-format §4.1 L199-202)', () => {
    // The `theme` register is absent until the user chooses; while absent the
    // app follows the device.
    expect(resolveTheme(undefined, true)).toBe('palco');
    expect(resolveTheme(undefined, false)).toBe('estante');
    expect(resolveTheme(null, true)).toBe('palco');
    expect(resolveTheme(null, false)).toBe('estante');
  });

  it('returns each explicit theme unchanged, whatever the device mode (workflow 1 L97)', () => {
    for (const prefersDark of [true, false]) {
      expect(resolveTheme('estante', prefersDark)).toBe('estante');
      expect(resolveTheme('caderno', prefersDark)).toBe('caderno');
      expect(resolveTheme('palco', prefersDark)).toBe('palco');
    }
  });

  it('falls back to the device for an unrecognised register value', () => {
    // A corrupt or future value is not a crash: it follows the device, as
    // automatic does.
    expect(resolveTheme('midnight', true)).toBe('palco');
    expect(resolveTheme('midnight', false)).toBe('estante');
  });
});

describe('themeClasses', () => {
  it('emits est theme-<applied> density-<density>', () => {
    expect(themeClasses('estante', 'comfortable')).toBe(
      'est theme-estante density-comfortable',
    );
    expect(themeClasses('palco', 'compact')).toBe(
      'est theme-palco density-compact',
    );
    expect(themeClasses('caderno', 'roomy')).toBe(
      'est theme-caderno density-roomy',
    );
  });

  it('defaults density to comfortable (the mockup prop default)', () => {
    expect(themeClasses('estante')).toBe(
      `est theme-estante density-${DEFAULT_DENSITY}`,
    );
    expect(DEFAULT_DENSITY).toBe('comfortable');
  });
});

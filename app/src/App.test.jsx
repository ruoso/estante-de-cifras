import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';
import { checkWcag21aa } from './a11y/axe.js';

// behavior — the app root now mounts the navigation shell (AppShell) inside the
// resolved visual-language root (ThemeRoot), replacing the earlier placeholder
// screen. It proves React 19, the React Compiler, React Aria Components, i18n
// and Testing Library render the shell together, axe-clean at WCAG 2.1 AA. The
// shell root carries the navigation frame Search/Books/Setlists live inside
// (DIRECTION §4 lines 430-435; §3.7 lines 404-405). jsdom reports no matchMedia,
// so the default layout is the phone tab bar.
describe('App', () => {
  it('mounts under the resolved theme root (default automatic → Estante in light)', () => {
    // The shell root carries the resolved theme (DIRECTION §3.7 L404-405), not a
    // hard-coded `theme-current`. With no chosen theme and jsdom reporting no
    // dark mode, automatic resolves to Estante at the comfortable density.
    const { container } = render(<App />);
    expect(container.querySelector('.est')).toHaveClass(
      'est',
      'theme-estante',
      'density-comfortable',
    );
  });

  it('renders the navigation shell: the three destinations and a main landmark', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    for (const name of ['Search', 'Books', 'Setlists']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
  });

  it('opens on the default destination (Search) as its level-1 heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Search' })).toBeInTheDocument();
  });

  it('is axe-clean at WCAG 2.1 AA', async () => {
    const { container } = render(<App />);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

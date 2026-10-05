import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';
import { checkWcag21aa } from './a11y/axe.js';

// behavior — renders the proof component (a React Aria Components element under
// the resolved visual-language root) with its real collaborators, proving React
// 19, the React Compiler, React Aria and Testing Library all work together, then
// asserts the rendered tree is axe-clean at WCAG 2.1 AA via the shared helper.
// This is the set-up every later UI task reuses (DIRECTION §3.7; the standing
// accessibility rule).
describe('App', () => {
  it('mounts under the resolved theme root (default automatic → Estante in light)', () => {
    // The shell root now carries the resolved theme (DIRECTION §3.7 L404-405),
    // not a hard-coded `theme-current`. With no chosen theme and jsdom reporting
    // no dark mode, automatic resolves to Estante at the comfortable density.
    const { container } = render(<App />);
    expect(container.querySelector('.est')).toHaveClass(
      'est',
      'theme-estante',
      'density-comfortable',
    );
  });

  it('renders a React Aria button with an accessible name and role', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: 'Explorar o acervo' });
    expect(button).toBeInTheDocument();
  });

  it('carries its status as a word, not colour alone', () => {
    render(<App />);
    // The status is readable as text (docs/mockups/README.md line 27), not a
    // bare colour swatch.
    expect(screen.getByRole('status')).toHaveTextContent('Pronto para começar');
  });

  it('is axe-clean at WCAG 2.1 AA', async () => {
    const { container } = render(<App />);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

// behavior (workflow 18) — Help on every page and the tour, with their real
// collaborators (React Aria, i18n, the chart and diagram), under a themed root.
// Pins: the button names its page; the panel says what the page is for and what
// can be done there; Other pages shows another page's help in place, with Back
// to the page's own; Take the tour opens the tour; the tour steps Back / Next /
// Done and Skip; focus returns to Help; axe clean. And every page and card has
// its copy in all four languages.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, act, fireEvent, waitFor } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale, tr } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import HelpButton from './Help.jsx';
import { HELP_PAGES, TOUR_STEPS } from './help-topics.js';

const EMPTY = {};
const fakeStore = { subscribe: () => () => {}, slice: () => EMPTY, open: () => {} };

beforeEach(() => {
  globalThis.matchMedia = (media) => ({ media, matches: false, addEventListener: () => {}, removeEventListener: () => {} });
  setLocale('en');
});

const click = (el) => act(() => fireEvent.click(el));

function renderHelp(page = 'song') {
  return render(
    <ThemeRoot store={fakeStore}>
      <HelpButton page={page} />
    </ThemeRoot>,
  );
}

describe('Help (behavior)', () => {
  it('opens the page\'s own help: what it is for and what can be done there; axe clean', async () => {
    renderHelp('song');
    const button = screen.getByRole('button', { name: 'Help: Reading a song' });
    click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Reading a song' });
    expect(within(dialog).getByText(/The song as a chart/)).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'What you can do here' })).toBeInTheDocument();
    expect(within(dialog).getByText(/Transpose to read it in another key/)).toBeInTheDocument();
    // Every other page is listed by name, not this one.
    const others = within(dialog).getByRole('navigation', { name: 'Other pages' });
    expect(within(others).getAllByRole('button')).toHaveLength(HELP_PAGES.length - 1);
    expect(within(others).queryByRole('button', { name: 'Reading a song' })).toBeNull();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('shows another page\'s help in place, with Back to the page\'s own', async () => {
    renderHelp('song');
    click(screen.getByRole('button', { name: 'Help: Reading a song' }));
    const dialog = await screen.findByRole('dialog');
    click(within(dialog).getByRole('button', { name: 'Setlists' }));
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Setlists' })).toBeInTheDocument();
    click(within(dialog).getByRole('button', { name: 'Back to Reading a song' }));
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Reading a song' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Back to/ })).toBeNull();
  });

  it('closes on Close, focus back on Help', async () => {
    renderHelp('books');
    const button = screen.getByRole('button', { name: 'Help: Books' });
    act(() => button.focus());
    click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Books' });
    click(within(dialog).getByRole('button', { name: 'Close help' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(button).toHaveFocus());
  });

  it('takes the tour: Next through every card, Back, a picture where there is one, Done; axe clean', async () => {
    renderHelp('search');
    click(screen.getByRole('button', { name: 'Help: Search' }));
    click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Take the tour' }));
    const tour = await screen.findByRole('dialog', { name: 'Tour' });
    expect(within(tour).getByText(`1 of ${TOUR_STEPS.length}`)).toBeInTheDocument();
    expect(within(tour).getByRole('heading', { name: 'Welcome to Estante' })).toBeInTheDocument();
    expect(within(tour).queryByRole('button', { name: 'Back' })).toBeNull();

    click(within(tour).getByRole('button', { name: 'Next' }));
    click(within(tour).getByRole('button', { name: 'Next' }));
    // The third card draws a chart line with the app's own chart.
    expect(within(tour).getByRole('heading', { name: 'Read and play' })).toBeInTheDocument();
    expect(tour.querySelector('.help-tour-picture .chart')).toBeTruthy();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
    click(within(tour).getByRole('button', { name: 'Back' }));
    expect(within(tour).getByRole('heading', { name: 'Find a song' })).toBeInTheDocument();

    // From the second card to the last.
    for (let i = 2; i < TOUR_STEPS.length; i += 1) click(within(tour).getByRole('button', { name: 'Next' }));
    expect(within(tour).getByText(`${TOUR_STEPS.length} of ${TOUR_STEPS.length}`)).toBeInTheDocument();
    expect(within(tour).queryByRole('button', { name: 'Skip tour' })).toBeNull();
    click(within(tour).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Skip tour leaves it at any card', async () => {
    renderHelp('search');
    click(screen.getByRole('button', { name: 'Help: Search' }));
    click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Take the tour' }));
    const tour = await screen.findByRole('dialog', { name: 'Tour' });
    click(within(tour).getByRole('button', { name: 'Next' }));
    click(within(tour).getByRole('button', { name: 'Skip tour' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('help copy', () => {
  for (const locale of ['en', 'pt-BR', 'es-419', 'it']) {
    it(`has every page and every tour card in ${locale}`, () => {
      setLocale(locale);
      for (const id of HELP_PAGES) {
        const page = tr(`help.pages.${id}`);
        expect(page?.title, id).toBeTruthy();
        expect(page?.summary, id).toBeTruthy();
        expect(Array.isArray(page?.points) && page.points.length > 0, id).toBe(true);
      }
      for (const { id } of TOUR_STEPS) {
        expect(tr(`help.tour.${id}.title`), id).toBeTruthy();
        expect(tr(`help.tour.${id}.body`), id).toBeTruthy();
      }
    });
  }
});

// Behavior — the format help, *Writing a song*, with React Aria and i18n
// (songs.format_help; workflow 3 §Help with the format; board Format-help
// Phone 2, Tablet). Pins the two presentations (a sheet with its grip on a
// phone, a card popover elsewhere), the eight topics in order, Copy and its
// refusal (Decision 6), opening at a topic, and pt-BR with its marks
// untouched. axe (WCAG 2.1 AA) over each. Fixtures are the help's own
// purpose-written examples.

import { useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent, act, waitFor } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { t, setLocale } from '../i18n/index.js';
import en from '../i18n/locales/en.js';
import FormatHelp from './FormatHelp.jsx';

function Harness(props) {
  const triggerRef = useRef(null);
  return (
    <>
      <button type="button" ref={triggerRef}>
        Help
      </button>
      <FormatHelp isOpen triggerRef={triggerRef} onClose={() => {}} onInsert={() => {}} {...props} />
    </>
  );
}

const HEADINGS = [
  '1. The title and details',
  '2. Parts and the music fence',
  '3. Chords over words',
  '4. Bars',
  '5. Repeats',
  '6. Part names inside the music',
  '7. Notes',
  '8. How to play a chord',
];

const titleCopy = () =>
  screen.getByRole('button', { name: t('editor.formatHelp.copyLabel', { topic: 'The title and details' }) });

afterEach(() => {
  setLocale('en');
  vi.unstubAllGlobals();
});

describe('FormatHelp', () => {
  it('a sheet on a phone, a popover elsewhere — a dialog named Writing a song with eight topics in order', async () => {
    for (const presentation of ['sheet', 'popover']) {
      const { unmount } = render(<Harness presentation={presentation} />);
      const dialog = screen.getByRole('dialog', { name: 'Writing a song' });
      const surface = dialog.closest(presentation === 'sheet' ? '.sheet' : '.popover.card');
      expect(surface).not.toBeNull();
      expect(surface.querySelector('.grip') !== null).toBe(presentation === 'sheet');
      expect(within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(HEADINGS);
      // Each topic is a section labelled by its heading, its example a <pre>.
      expect(within(dialog).getByRole('region', { name: '4. Bars' }).querySelector('pre').textContent).toBe(
        en.editor.formatHelp.topics.bars.example,
      );
      expect(
        within(dialog).getByRole('button', { name: 'Insert the Bars example' }).textContent,
      ).toBe('Insert');
      expect(await checkWcag21aa(document.body)).toHaveNoViolations();
      unmount();
    }
  });

  it('Copy says Copied, or that it could not; the help stays open', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const onClose = vi.fn();
    const { unmount } = render(<Harness presentation="popover" onClose={onClose} />);
    await act(async () => fireEvent.click(titleCopy()));
    expect(writeText).toHaveBeenCalledWith(en.editor.formatHelp.topics.title.example);
    expect(titleCopy().textContent).toBe('Copied');
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toContain('Copied');
    expect(screen.getByRole('dialog', { name: 'Writing a song' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    unmount();

    // No clipboard at all (an insecure context): it says so.
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    render(<Harness presentation="sheet" onClose={onClose} />);
    await act(async () => fireEvent.click(titleCopy()));
    expect(titleCopy().textContent).toBe('Could not copy — select the example instead');
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toContain(
      'Could not copy — select the example instead',
    );
    expect(screen.getByRole('dialog', { name: 'Writing a song' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('a refused copy says it could not', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
    render(<Harness presentation="popover" />);
    const copy = screen.getByRole('button', { name: 'Copy the How to play a chord example' });
    await act(async () => fireEvent.click(copy));
    expect(copy.textContent).toBe('Could not copy — select the example instead');
  });

  it('opens at a topic: its heading has focus', async () => {
    render(<Harness presentation="popover" topic="chords" />);
    const heading = screen.getByRole('heading', { name: '3. Chords over words' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('Insert hands the example to the editor', () => {
    const onInsert = vi.fn();
    render(<Harness presentation="sheet" onInsert={onInsert} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert the Bars example' }));
    expect(onInsert).toHaveBeenCalledWith(en.editor.formatHelp.topics.bars.example);
  });

  it('the close button and Escape close it, as a sheet and as a popover', () => {
    for (const presentation of ['sheet', 'popover']) {
      const onClose = vi.fn();
      const { unmount } = render(<Harness presentation={presentation} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(2);
      unmount();
    }
  });

  it('in pt-BR: Escrevendo uma música, Inserir, Copiar, the marks untouched', async () => {
    setLocale('pt-BR');
    render(<Harness presentation="popover" />);
    const dialog = screen.getByRole('dialog', { name: 'Escrevendo uma música' });
    expect(within(dialog).getAllByRole('button', { name: /^Inserir o exemplo de / })[0].textContent).toBe('Inserir');
    expect(
      within(dialog).getByRole('button', { name: 'Copiar o exemplo de O título e os detalhes' }).textContent,
    ).toBe('Copiar');
    const examples = [...dialog.querySelectorAll('pre')].map((p) => p.textContent);
    expect(examples).toHaveLength(8);
    expect(examples[1]).toMatch(/^## Verso\n```\n/);
    expect(examples[3]).toContain('G | % | C | D');
    expect(examples[4]).toContain('|: G | C |1. D | G :|2. D | D |');
    expect(examples[5]).toMatch(/^```\n\[Refrão\]\n/);
    expect(examples[6]).toContain('// ');
    expect(examples[7]).toContain('---\n\n## Voicings: E2 A2 D3 G3 B3 E4');
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });
});

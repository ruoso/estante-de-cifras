// unit — the README heading reader (songs.no_raw_ids Constraint 7). Pins
// DIRECTION §2.1: a book's title is the level-1 heading of its README. Headings
// are written for the test.

import { describe, it, expect } from 'vitest';
import { readmeTitle } from './readme-title.js';

const bytes = (s) => new TextEncoder().encode(s);

describe('readmeTitle (DIRECTION §2.1)', () => {
  it('reads the level-1 heading of string and byte input', () => {
    expect(readmeTitle('# Cadernos da Praça\n\nUm livro.\n')).toBe('Cadernos da Praça');
    expect(readmeTitle(bytes('# Cadernos da Praça\n'))).toBe('Cadernos da Praça');
  });

  it('trims the heading', () => {
    expect(readmeTitle('#    Rodas de Sábado   \n')).toBe('Rodas de Sábado');
  });

  it('does not take a ## heading as the title', () => {
    expect(readmeTitle('## Só uma seção\n\ntexto\n')).toBeNull();
    expect(readmeTitle('## Seção\n# Título Depois\n')).toBe('Título Depois');
  });

  it('takes the first # heading when there are several', () => {
    expect(readmeTitle('Prosa antes.\n\n# Primeiro\n\n# Segundo\n')).toBe('Primeiro');
  });

  it('is null with no heading, an empty README or no README', () => {
    expect(readmeTitle('Só uma linha de prosa, sem título.\n')).toBeNull();
    expect(readmeTitle('')).toBeNull();
    expect(readmeTitle(bytes(''))).toBeNull();
    expect(readmeTitle('#   \n')).toBeNull();
    expect(readmeTitle(null)).toBeNull();
    expect(readmeTitle(undefined)).toBeNull();
  });
});

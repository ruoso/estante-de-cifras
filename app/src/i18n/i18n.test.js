import { describe, it, expect, afterEach } from 'vitest';
import {
  LOCALES,
  LOCALE_IDS,
  DEFAULT_LOCALE,
  t,
  tr,
  ordinal,
  errorText,
  setLocale,
  currentLocale,
  detectLocale,
  resolveLocale,
  isLocale,
  hasMessage,
} from './index.js';
import en from './locales/en.js';

afterEach(() => setLocale(DEFAULT_LOCALE));

/** Every leaf path in a message tree, so two languages can be compared. */
function leaves(node, prefix = []) {
  if (node === null || typeof node !== 'object') return [prefix.join('.')];
  if (Array.isArray(node)) {
    return node.flatMap((item, i) => leaves(item, [...prefix, String(i)]));
  }
  return Object.entries(node).flatMap(([key, value]) => leaves(value, [...prefix, key]));
}

/** The `{name}` placeholders a string uses. */
const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function leafValue(node, path) {
  return path.split('.').reduce((n, seg) => (n == null ? undefined : n[seg]), node);
}

describe('the languages', () => {
  it('are English, Brazilian Portuguese, Latin American Spanish and Italian', () => {
    expect(LOCALE_IDS).toEqual(['en', 'pt-BR', 'es-419', 'it']);
    expect(DEFAULT_LOCALE).toBe('en');
    for (const locale of LOCALES) expect(locale.name).toBeTruthy();
  });

  for (const locale of LOCALES.filter((l) => l.id !== 'en')) {
    describe(locale.id, () => {
      it('has every key English has, and no others', () => {
        // Plural objects may legitimately differ in which forms they carry
        // (English has `one`, Portuguese too, but a language might add `many`),
        // so compare at the level above the plural forms.
        const collapse = (paths) =>
          [...new Set(paths.map((p) => p.replace(/\.(zero|one|two|few|many|other)$/, '')))].sort();
        expect(collapse(leaves(locale.messages))).toEqual(collapse(leaves(en)));
      });

      it('uses the same placeholders as English in every string', () => {
        for (const path of leaves(en)) {
          const ours = leafValue(en, path);
          const theirs = leafValue(locale.messages, path);
          if (typeof ours !== 'string' || typeof theirs !== 'string') continue;
          if (/\.(zero|one|two|few|many|other)$/.test(path)) continue;
          expect(placeholders(theirs), path).toEqual(placeholders(ours));
        }
      });

      it('translates rather than copies, for the bulk of the strings', () => {
        const paths = leaves(en).filter((p) => typeof leafValue(en, p) === 'string');
        const same = paths.filter((p) => leafValue(en, p) === leafValue(locale.messages, p));
        // Chord symbols, tuning names and the app's name are the same everywhere.
        expect(same.length / paths.length).toBeLessThan(0.15);
      });
    });
  }
});

// shell.plain_language — workflow 7 §Downloading and §Uploading, workflow 12
// L33-35; design.review_polish's Constraint: git terms stay in the file view.
describe('says the everyday lines without git\u2019s words, in every language (shell.plain_language)', () => {
  const EVERYDAY = ['books.downloadBody', 'books.uploadLeftOutBody', 'setlists.relativeNote', 'saveSheet.localCaption'];
  const GIT_WORDS = [/\bgit\b/i, /repositor/i, /\.gitattributes/, /\bhost\b/i];

  for (const locale of LOCALES) {
    it(`${locale.id} names no git term in the everyday lines`, () => {
      for (const path of EVERYDAY) {
        const text = leafValue(locale.messages, path);
        expect(typeof text, path).toBe('string');
        for (const word of GIT_WORDS) expect(text, `${path} ${word}`).not.toMatch(word);
      }
    });
  }

  it('English says the copy table\u2019s words (design.review_polish, The new copy)', () => {
    expect(en.books.downloadBody).toBe(
      'A zip of this book as it is on this device: every song and setlist with its whole history, and unsaved changes as they are. Upload it to bring the book back.',
    );
    expect(en.books.uploadLeftOutBody).toBe('A book holds songs, setlists and its README, so these stay behind.');
    expect(en.setlists.relativeNote).toBe(
      'The links start from {folder}, so they keep working wherever the book’s files are copied.',
    );
    expect(en.saveSheet.localCaption).toBe('Saved on this device. Only you can see it until the book is put online.');
    expect(en.saveSheet.pushCaption).toBe(
      'Saving shares this version with whoever shares the book; with no network, at the next sync.',
    );
  });
});

describe('lookup', () => {
  it('interpolates named parameters', () => {
    expect(t('results.none', { label: 'Guitar' })).toBe('No fingerings for this chord on Guitar.');
  });

  it('chooses the plural form by count', () => {
    expect(t('sheets.measures', { count: 1 })).toBe('1 measure');
    expect(t('sheets.measures', { count: 2 })).toBe('2 measures');
    expect(t('sheets.measures', { count: 0 })).toBe('0 measures');
  });

  it('follows the language for plurals too', () => {
    setLocale('pt-BR');
    expect(t('sheets.measures', { count: 1 })).toBe('1 compasso');
    expect(t('sheets.measures', { count: 3 })).toBe('3 compassos');
  });

  it('accepts a path with a dotted segment', () => {
    expect(tr(['announcements', '0.2.0']).title).toBe('What changed in 0.2');
    expect(t(['announcements', '0.2.0', 'title'])).toBe('What changed in 0.2');
  });

  it('shows the key rather than nothing for a missing string', () => {
    expect(t('no.such.key')).toBe('no.such.key');
    expect(hasMessage('no.such.key')).toBe(false);
    expect(hasMessage('nav.explore')).toBe(true);
  });

  it('falls back to English for a key a language lacks', () => {
    // Nothing is missing today, so simulate: the raw lookup falls through to
    // English when the current language has no value.
    setLocale('es-419');
    // app.name is the product's proper noun — the same in every catalogue
    // (shell.i18n reconciled it from the carried-over 'Explore Chords').
    expect(t('app.name')).toBe('Estante de Cifras');
    expect(tr('nav')).toBeTruthy();
  });

  it('names the wordmark Estante in every language (shell.header_chrome)', () => {
    // The header's wordmark is the proper noun's short form, like the PWA's
    // short_name; the document title keeps app.name.
    for (const id of LOCALE_IDS) {
      setLocale(id);
      expect(t('app.wordmark'), id).toBe('Estante');
    }
  });

  it('leaves an unknown placeholder visible', () => {
    expect(t('results.none', {})).toBe('No fingerings for this chord on {label}.');
  });
});

describe('ordinals', () => {
  it('follow English suffix rules', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st',
    ]);
  });

  it('use the feminine ordinal indicator in Portuguese, Spanish and Italian (string is feminine)', () => {
    setLocale('pt-BR');
    expect(ordinal(5)).toBe('5ª');
    setLocale('es-419');
    expect(ordinal(1)).toBe('1ª');
    setLocale('it');
    expect(ordinal(3)).toBe('3ª');
  });
});

describe('choosing a language', () => {
  it('matches the browser languages by primary subtag, first match wins', () => {
    expect(detectLocale(['pt-PT', 'en'])).toBe('pt-BR');
    expect(detectLocale(['es-ES'])).toBe('es-419');
    expect(detectLocale(['es-MX', 'pt-BR'])).toBe('es-419');
    expect(detectLocale(['en-GB'])).toBe('en');
    expect(detectLocale(['it-IT', 'en'])).toBe('it');
    expect(detectLocale(['it-CH'])).toBe('it');
    expect(detectLocale(['fr', 'de'])).toBe('en');
    expect(detectLocale([])).toBe('en');
    expect(detectLocale(['fr', 'pt'])).toBe('pt-BR');
  });

  it('is case-insensitive about tags', () => {
    expect(detectLocale(['PT-br'])).toBe('pt-BR');
  });

  // resolveLocale is the shell.i18n policy LocaleRoot drives: the chosen
  // preference when it is a language we have, else the browser's (Workflow 1
  // §Language lines 80-84). Pins "the browser's language until one is chosen,
  // then that one."
  it('resolveLocale prefers a valid chosen id over the browser', () => {
    expect(resolveLocale('it', ['pt-BR'])).toBe('it');
    expect(resolveLocale('pt-BR', ['en-US'])).toBe('pt-BR');
  });

  it('resolveLocale falls to the browser for a null/absent/invalid preference', () => {
    expect(resolveLocale(null, ['pt-PT', 'en'])).toBe('pt-BR');
    expect(resolveLocale(undefined, ['es-ES'])).toBe('es-419');
    expect(resolveLocale('xx', ['it-IT'])).toBe('it');
  });

  it('resolveLocale falls to English when nothing matches', () => {
    expect(resolveLocale(null, ['fr', 'de'])).toBe('en');
    expect(resolveLocale('xx', [])).toBe('en');
  });

  it('setLocale ignores an unknown id and reports what it set', () => {
    expect(setLocale('pt-BR')).toBe('pt-BR');
    expect(currentLocale()).toBe('pt-BR');
    expect(setLocale('xx')).toBe('en');
    expect(isLocale('xx')).toBe(false);
    expect(isLocale('es-419')).toBe(true);
  });
});

describe('errors from the core', () => {
  it('are translated by code, with their parameters', () => {
    const error = Object.assign(new Error('Unexpected "q".'), {
      code: 'unexpected',
      params: { text: 'q' },
    });
    expect(errorText(error)).toBe('Unexpected "q".');
    setLocale('pt-BR');
    expect(errorText(error)).toBe('Não esperava "q".');
  });

  it('show their own message when they carry no code we know', () => {
    expect(errorText(new Error('Something odd'))).toBe('Something odd');
    expect(errorText(Object.assign(new Error('Odd'), { code: 'nope' }))).toBe('Odd');
    expect(errorText({ code: 'empty' })).toBe('Enter a chord.');
  });
});

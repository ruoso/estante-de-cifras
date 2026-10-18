// shape-readout.js — what a shape entered by hand holds (songs.arrange_polish;
// workflow 16 §Entering a shape by hand, board W05#3 L141, L151, L274-281). The
// pure read-out the shared `ShapeBuilder` renders in both hosts (the explorer's
// dialog, arrange's screen): one row per string, low to high, with the string's
// name, its fret, the note it sounds and that note's part in the chord as a word
// (*root*, *minor third*, *fifth*) — or *not in Cm* for a foreign note — the
// summary of the notes it holds, and the notice spelling the foreign ones out.
//
// No React, no DOM: the roles come from `chordTones`' degree and alter (no new
// harmony); the words come from i18n, as fingering-groups.js's do.

import { t, currentLocale } from '../i18n/index.js';
import { chordTones } from '../core/chord.js';
import { degreeToInterval, pitchToMidi, transposeNote, note } from '../core/pitch.js';

// The named roles, by degree then alter (refinement criterion 3). Any other pair
// falls back to the degree's ordinal word with *flat* / *sharp*.
const ROLES = {
  1: { 0: 'root' },
  2: { 0: 'second' },
  3: { '-1': 'minorThird', 0: 'majorThird' },
  4: { 0: 'fourth' },
  5: { '-1': 'flatFifth', 0: 'fifth', 1: 'sharpFifth' },
  6: { 0: 'sixth' },
  7: { '-2': 'diminishedSeventh', '-1': 'minorSeventh', 0: 'majorSeventh' },
  9: { '-1': 'flatNinth', 0: 'ninth', 1: 'sharpNinth' },
  11: { 0: 'eleventh', 1: 'sharpEleventh' },
  13: { '-1': 'flatThirteenth', 0: 'thirteenth' },
};

// A note as the read-out prints it, with the accidental glyphs the board writes
// (`E♭`, `F♯`), never the ASCII spelling.
const GLYPH = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
const glyphNote = (n) => n.letter + GLYPH[String(n.accidental)];

const ALTER_WORD = { '-2': 'doubleFlat', '-1': 'flat', 1: 'sharp', 2: 'doubleSharp' };

/** A chord tone's part in the chord as a word, from its degree and alter. */
export function roleWord(degree, alter = 0) {
  const named = ROLES[degree]?.[String(alter)];
  if (named) return t(`explorer.enter.roles.${named}`);
  const ordinal = t(`explorer.enter.degrees.${degree}`);
  const word = ALTER_WORD[String(alter)];
  return word ? t(`explorer.enter.alter.${word}`, { degree: ordinal }) : ordinal;
}

// Each string's letter (with its accidental) and how it is told apart: a letter
// two strings share gets *low* / *high* on the lower and higher of them; a
// letter on three or more strings falls back to the pitch alone.
function stringIdentities(strings) {
  const letters = strings.map((p) => glyphNote(p.note));
  const count = new Map();
  for (const l of letters) count.set(l, (count.get(l) ?? 0) + 1);
  return strings.map((p, i) => {
    const letter = letters[i];
    const pitch = glyphNote(p.note) + p.octave;
    const n = count.get(letter);
    if (n === 1) return { pitch, letter, qualifier: null, bare: false };
    if (n > 2) return { pitch, letter, qualifier: null, bare: true };
    const other = strings.findIndex((q, j) => j !== i && letters[j] === letter);
    const [mine, theirs] = [pitchToMidi(p), pitchToMidi(strings[other])];
    const low = mine < theirs || (mine === theirs && i < other);
    const qualifier = t(low ? 'explorer.enter.lowString' : 'explorer.enter.highString', { note: letter });
    return { pitch, letter, qualifier, bare: false };
  });
}

/** Each string's name, low to high as the tuning lists them (`E2 · low E`, `A2`). */
export function stringNames(strings) {
  return stringIdentities(strings).map(({ pitch, qualifier }) =>
    qualifier ? t('explorer.enter.stringQualified', { pitch, qualifier }) : pitch,
  );
}

/** Each string as a sentence names it (`the A string`, `the high E string`). */
export function stringMentions(strings) {
  return stringIdentities(strings).map(({ pitch, letter, qualifier, bare }) =>
    t('explorer.enter.onString', { name: qualifier ?? (bare ? pitch : letter) }),
  );
}

// A foreign note has no functional spelling to borrow from the chord; it is
// spelled by its interval above the root (A♭ over C, a minor sixth — the board's
// spelling), falling back to sharps should that need more than a double accidental.
const DEGREE_BY_SEMITONE = [
  [1, 0], [2, -1], [2, 0], [3, -1], [3, 0], [4, 0],
  [5, -1], [5, 0], [6, -1], [6, 0], [7, -1], [7, 0],
];
const SHARP = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];
function foreignSpelling(root, rootPc, pc) {
  const [degree, alter] = DEGREE_BY_SEMITONE[(((pc - rootPc) % 12) + 12) % 12];
  try {
    return transposeNote(root, degreeToInterval(degree, alter));
  } catch {
    return note(SHARP[pc][0], SHARP[pc][1]);
  }
}

// The board writes its lists without a serial comma (*C, E♭ and G*), which
// English's default list style adds.
function listOf(items) {
  const locale = currentLocale() === 'en' ? 'en-GB' : currentLocale();
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}

/**
 * The read-out of a shape entered by hand.
 *
 * @param {object} chord the parsed chord (`core/chord.js`)
 * @param {string} chordSymbol the chord as the host names it (`Cm`)
 * @param {import('../core/pitch.js').Pitch[]} strings the tuning, low to high as listed
 * @param {Array<'x'|number|string>} frets one value per string, `'x'` muted
 * @returns {{ rows: Array<{ string: string, fret: string, note: string, muted: boolean,
 *   foreign: boolean, badge: string|null }>, summary: string, foreign: string[],
 *   notice: string|null }}
 */
export function shapeReadout(chord, chordSymbol, strings, frets) {
  const tones = chordTones(chord);
  const toneByPc = new Map(tones.map((tone) => [tone.pitchClass, tone]));
  const rootPc = tones[0]?.pitchClass ?? 0;
  const names = stringNames(strings);
  const mentions = stringMentions(strings);

  const rows = [];
  const soundedTones = new Set();
  const foreignNotes = []; // distinct, string order
  const foreignMentions = [];
  strings.forEach((pitch, i) => {
    const value = frets[i];
    if (value === 'x' || value == null) {
      rows.push({ string: names[i], fret: t('explorer.enter.fretMuted'), note: '—', muted: true, foreign: false, badge: null });
      return;
    }
    const fret = Number(value);
    const pc = (((pitchToMidi(pitch) + fret) % 12) + 12) % 12;
    const tone = toneByPc.get(pc);
    const name = glyphNote(tone ? tone.spelled : foreignSpelling(chord.root, rootPc, pc));
    const fretText = fret === 0 ? t('explorer.enter.fretOpen') : t('explorer.enter.fretAt', { fret });
    if (tone) {
      soundedTones.add(tone);
      rows.push({ string: names[i], fret: fretText, note: name, muted: false, foreign: false, badge: roleWord(tone.degree, tone.alter) });
    } else {
      if (!foreignNotes.includes(name)) foreignNotes.push(name);
      foreignMentions.push(t('explorer.enter.noteOnString', { note: name, string: mentions[i] }));
      rows.push({
        string: names[i],
        fret: fretText,
        note: name,
        muted: false,
        foreign: true,
        badge: t('explorer.enter.notIn', { chord: chordSymbol }),
      });
    }
  });

  const summary = [
    ...tones.filter((tone) => soundedTones.has(tone)).map((tone) => glyphNote(tone.spelled)),
    ...foreignNotes,
  ].join(' · ');

  const params = { chord: chordSymbol, tones: listOf(tones.map((tone) => glyphNote(tone.spelled))) };
  let notice = null;
  if (foreignMentions.length === 1) {
    notice = t('explorer.enter.foreignOne', { ...params, which: foreignMentions[0] });
  } else if (foreignMentions.length > 1) {
    notice = t('explorer.enter.foreignMany', { ...params, which: listOf(foreignMentions) });
  }
  return { rows, summary, foreign: foreignMentions, notice };
}

/**
 * A reading of the music in a chart, as against the text of it (§2.10).
 *
 * `cifra-md`'s `parse` reads, and `edit.js`/`write.js` round-trip, the source.
 * This looks at what the source says musically: the line of bass notes the
 * chart implies, and the figures that line makes. A planner is handed one of
 * these before it chooses anything, so a rule stated over a passage — "use
 * octaves through here rather than repeat the same third twice" — has something
 * to be stated against.
 *
 * The dividing line is that **anything one array index away is not analysis**.
 * A planner holds `line` entire, so "what does this chord resolve to" is
 * `line[at + 1]` and needs no machinery here. What earns a place is what takes
 * a scan — where a run begins and ends — or a derivation every planner would
 * otherwise repeat.
 *
 * Re-sourced onto the cifra.md parse model (`music.wizard`): the song is a
 * cifra.md document, and the line walks its chart positions. Each entry carries
 * its cifra.md **occurrence index path** `{ section, part, line, measure, item }`
 * alongside the scalar `at`, so the plan→variation bridge (`voicing-plan/apply.js`)
 * can hand `chooseShapes` the identity it wants without re-walking the model.
 * The walk mirrors `edit.js`'s `chordOccurrences` exactly — every music part,
 * every line, every measure, in document order — so an occurrence path here
 * points at the same item there.
 *
 * Pure and synchronous, like everything in core/ (§3.2). It reads the cifra.md
 * model as data and imports only other core modules.
 */

import { parseChord } from './notation/parse.js';
import { bassNote } from './chord.js';
import { pitchClass } from './pitch.js';

/**
 * @typedef {object} Occurrence       the cifra.md occurrence index path
 * @property {number} section
 * @property {number} part
 * @property {number} line
 * @property {number} measure
 * @property {number} item
 *
 * @typedef {object} ReadingEntry
 * @property {number} at                position in the reading's line
 * @property {{symbol: string, key: (string|null), index?: number}} ref
 *   the chart token's identity — `symbol`/`key` from the cifra.md chord item;
 *   `key` is null for an unparseable token, which carries nothing a planner reads
 * @property {import('./chord.js').Chord|null} chord   null if it does not parse
 * @property {number|null} bassPc       the chart's bass: slash note, else root
 * @property {Occurrence} occurrence    where the item sits in the model
 *
 * @typedef {object} Span
 * @property {'walking'} kind
 * @property {number} from              inclusive `at`
 * @property {number} to                inclusive `at`
 * @property {{direction: 'up'|'down', chromatic: boolean}} detail
 *
 * @typedef {object} SongReading
 * @property {ReadingEntry[]} line
 * @property {Span[]} spans
 * @property {(at: number, kind?: string) => Span[]} spansAt
 */

/**
 * The step from one bass note to the next, as a musician hears it.
 *
 * Pitch classes wrap, so B to C is up a semitone rather than down eleven. The
 * shortest signed path says so.
 */
function step(from, to) {
  let d = (to - from) % 12;
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
}

/** A step small enough to be a walk rather than a leap. */
function walks(d) {
  return d === 1 || d === 2 || d === -1 || d === -2;
}

/**
 * Runs where the bass walks rather than leaps.
 *
 * Not "chromatic runs". The sources describe a *baixo cromático-diatônico* — a
 * line that avoids large leaps and "offers a melody" (Campos Ramos, p.121) —
 * and the line they analyse in *Vibrações* is ré-mi-fá-fá#-sol-lá-sib, whole
 * tones and semitones mixed. That shape is what the idiom's rules answer to, so
 * that is the shape this finds; `detail.chromatic` is there for a planner that
 * wants the narrower all-semitone case.
 *
 * Three chords at least, because two chords are one step, and one step is not
 * yet a line going anywhere.
 */
function walkingSpans(line) {
  const spans = [];
  let from = null;
  let direction = 0;
  let chromatic = true;

  const close = (to) => {
    if (from !== null && to - from >= 2) {
      spans.push({
        kind: 'walking',
        from,
        to,
        detail: { direction: direction > 0 ? 'up' : 'down', chromatic },
      });
    }
    from = null;
  };

  for (let i = 1; i < line.length; i += 1) {
    const before = line[i - 1];
    const here = line[i];
    const d =
      before.bassPc === null || here.bassPc === null ? null : step(before.bassPc, here.bassPc);

    if (d === null || !walks(d)) {
      close(i - 1);
      continue;
    }
    if (from !== null && Math.sign(d) !== direction) close(i - 1);
    if (from === null) {
      from = i - 1;
      direction = Math.sign(d);
      chromatic = true;
    }
    if (Math.abs(d) !== 1) chromatic = false;
  }
  close(line.length - 1);
  return spans;
}

/**
 * Every chart position of the document, in document order: the chord tokens and
 * the tokens that sit in a chord's place but do not parse (`type: 'unknown'`),
 * each with its occurrence index path. A repeat sign, a beat marker and a bar
 * line are not positions — they write no chord and move no bass.
 *
 * The walk matches `edit.js`'s `chordOccurrences`: all music parts, all their
 * lines (so a lyric line between two charts still advances the `line` index),
 * all measures. An unparseable token is kept as a position so a walking run
 * breaks at it and a planner skips it, exactly as the original reading did.
 */
function* chartPositions(doc) {
  const sections = doc?.sections ?? [];
  for (let section = 0; section < sections.length; section += 1) {
    const body = sections[section]?.body ?? [];
    for (let part = 0; part < body.length; part += 1) {
      if (body[part]?.type !== 'music') continue;
      const lines = body[part]?.lines ?? [];
      for (let line = 0; line < lines.length; line += 1) {
        const measures = lines[line]?.measures ?? [];
        for (let measure = 0; measure < measures.length; measure += 1) {
          const items = measures[measure]?.items ?? [];
          for (let item = 0; item < items.length; item += 1) {
            const it = items[item];
            if (it?.type === 'chord' || it?.type === 'unknown') {
              yield { item: it, occurrence: { section, part, line, measure, item } };
            }
          }
        }
      }
    }
  }
}

/**
 * Read a parsed song.
 *
 * @param {object} doc  a cifra.md parse model
 * @param {string} [dialect]
 * @returns {SongReading}
 */
export function analyseSong(doc, dialect) {
  const line = [];
  let at = 0;
  for (const { item, occurrence } of chartPositions(doc)) {
    const chord = item.type === 'chord' ? (parseChord(item.symbol, dialect).chord ?? null) : null;
    const ref =
      item.type === 'chord'
        ? { symbol: item.symbol, key: item.key, index: item.index }
        : { symbol: item.text ?? '', key: null };
    line.push({ at, ref, chord, bassPc: chord ? pitchClass(bassNote(chord)) : null, occurrence });
    at += 1;
  }

  const spans = walkingSpans(line);
  return {
    line,
    spans,
    spansAt: (pos, kind) =>
      spans.filter((s) => s.from <= pos && pos <= s.to && (kind === undefined || s.kind === kind)),
  };
}

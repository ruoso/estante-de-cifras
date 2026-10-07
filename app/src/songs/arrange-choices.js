// arrange-choices.js — the pure choice-building helpers of the arrange surface
// (songs.arrange). No React and no I/O: given the parsed working-copy model and
// the three-level resolver's map, these build the inputs the `cifra-md` §8.5
// editing operations take. The surface composes them in the view and hands the
// results to the ops and the canonical writer (DIRECTION §3.7 "framework-free
// below the view"; Decision 2). Co-located unit tests pin them, since the logic
// is pure and warrants it (testing policy).

import { analyseSong } from '../core/song-analysis.js';

// A `Fingering` (from the search, or the resolver's resolved shape) → the
// `{ frets, fingers? }` shape the §8.5 ops expect, in the model's array form.
// The app's fingerings encode the thumb as finger `0`; cifra.md writes it as
// `'T'`, so re-encode it here (the same mapping `voicing-plan/apply.js` does).
// `frets` may hold `'x'` for a muted string; `fingers`, when present, is
// parallel and holds `int | 'T' | null`. A fingering with no `fingers` array
// yields a shape with no `fingers` (I4: only what was chosen is written).
export function toShape(fingering) {
  const shape = { frets: [...fingering.frets] };
  if (Array.isArray(fingering.fingers)) {
    shape.fingers = fingering.fingers.map((f) => (f === 0 ? 'T' : f));
  }
  return shape;
}

// A tapped chart address → the §8.5.1 occurrence of that chord, with its voicing
// key, read straight off the parsed model (cifra.md §8.5.1 input). The address
// is the occurrence path Chart's `onChordPress` raises
// ({ section, part, line, measure, item }); this reads the item there to confirm
// it is a chord and to carry the picker the `symbol`/`index`/`key` it needs for
// "every Cm" (`chooseShapeForKey` wants `{ symbol, index }`) and for the search
// and title. Returns null when the address does not point at a chord item.
export function occurrenceAt(model, address) {
  if (!model || !address) return null;
  const { section, part, line, measure, item } = address;
  const it =
    model.sections?.[section]?.body?.[part]?.lines?.[line]?.measures?.[measure]?.items?.[item];
  if (!it || it.type !== 'chord') return null;
  return {
    occurrence: { section, part, line, measure, item },
    symbol: it.symbol,
    index: it.index ?? 1,
    key: it.key ?? it.symbol,
  };
}

// The §8.5.4 `chooseShapes` plan for "choose these for every unchosen chord"
// (Workflow 5 L52-61): every occurrence of every chord the resolver shows as
// `yours` or `default`, at the exact fingering it shows, so the user's shapes
// and the app's defaults become choices in one pass. A `song`-sourced chord
// (already chosen) is left untouched, and a chord the resolver could not voice
// at all is omitted (it is absent from the map). The walk is `analyseSong`'s
// reading line — the same occurrence bridge the wizard's writer uses — so each
// plan entry's occurrence points at the same item `cifra-md`'s ops do.
export function unchosenPlan(model, resolved, dialect) {
  if (!model || !resolved) return [];
  const reading = analyseSong(model, dialect);
  const plan = [];
  for (const entry of reading.line) {
    if (!entry.chord || entry.ref?.key == null) continue;
    const r = resolved.get(entry.ref.key);
    if (!r || r.source === 'song') continue;
    plan.push({ occurrence: entry.occurrence, shape: toShape(r.fingering) });
  }
  return plan;
}

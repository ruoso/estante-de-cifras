// conflict-model.js — the pure mapper from a cifra.md merge `Outcome`
// (spec §11.12.1) into the view model the conflict screens render in musical
// terms (sync.conflicts, workflow 9 §Settling one). One entry per conflict that
// has a region, each carrying both sides — *yours* (ours) first, then the
// incoming author's (*theirs*) — plus the whole-file cases (deleted-vs-edited,
// unreadable) the book-level panel draws, and a derivation of which of ours's
// chart lines a conflicted song's reading view marks (`mark-conf`).
//
// Framework-free and Worker-only: it reads the plain `Outcome` the Worker gets
// back from cifra.md `merge` (it imports nothing, parses nothing, logs nothing —
// no song text; standing rule). The screens turn these records into charts and
// chord diagrams; the model carries the data, never UI copy. The incoming
// author's display name is threaded in as `author` so the view can label
// *theirs* with a real name (the mockup's *Ana's*); ours is always *yours*.

// The conflict kinds that carry a region of ours/theirs chart lines (spec
// §11.12.1): a reading view of ours marks exactly these lines (`mark-conf`).
const CHART_KINDS = new Set(['chart', 'sections', 'block-notes']);

// A whole-file conflict (spec §11.12.4): no region, so no *keep mine* / *take
// theirs* of a marked region — a choice of which tree entry survives.
const FILE_KINDS = new Set(['file', 'unresolved']);

// The descriptor members a conflict may carry beyond its sides (spec §11.12.5,
// in that order). Copied through verbatim so the view can name the thing in
// conflict — a property's key, a voicing's tuning/variation/key, which side
// deleted the file — without the model re-deriving any of it.
const DESCRIPTOR_MEMBERS = [
  'line', 'deleted', 'unreadable', 'item', 'occurrence', 'after',
  'tuning', 'variation', 'key', 'changed', 'symbols',
];

function sideValue(v) {
  // A side on which the thing is absent has none (§11.12.1): normalise an
  // absent side (undefined) to null; a present run (array) or value (string) is
  // passed through as the view will render it.
  return v === undefined ? null : v;
}

function mapConflict(c) {
  const out = { kind: c.kind };
  for (const member of DESCRIPTOR_MEMBERS) {
    if (c[member] !== undefined && c[member] !== null) out[member] = c[member];
  }
  // A voicing's chord is its key without the occurrence index (§8.4.6, e.g.
  // `Cm[2]` → `Cm`); the view draws a diagram labelled for the chord.
  if (c.kind === 'voicing' && typeof c.key === 'string') {
    out.chord = c.key.replace(/\[\d+\]$/, '');
  }
  // The two sides, ours first (workflow 9 §Settling one: *yours* then *Ana's*).
  out.base = sideValue(c.base);
  out.ours = sideValue(c.ours);
  out.theirs = sideValue(c.theirs);
  return out;
}

/**
 * Map one song's (or setlist's) merge `Outcome` to the per-song view model.
 *
 * @param {{ kind: string, conflicts: object[], marked: string|null }} outcome
 *   the `Outcome` from cifra.md `merge` — `kind` is 'conflicts' here.
 * @param {{ author?: string|null }} [opts]  the incoming author's display name,
 *   used to label *theirs*; ours is always *yours*.
 * @returns {{
 *   count: number,
 *   author: string|null,
 *   marked: string|null,
 *   file: ({ kind: 'file', deleted?: 'ours'|'theirs', unreadable?: string[] }
 *          | { kind: 'unresolved' })|null,
 *   items: object[],
 * }}
 */
export function songConflictModel(outcome, opts = {}) {
  const conflicts = outcome?.conflicts ?? [];
  // A `file` / `unresolved` conflict is the only conflict of its merge
  // (§11.12.5): the whole-file choice the book-level panel draws, not a
  // one-at-a-time region.
  const whole = conflicts.find((c) => FILE_KINDS.has(c.kind));
  const items = conflicts.filter((c) => !FILE_KINDS.has(c.kind)).map(mapConflict);
  return {
    count: items.length,
    author: opts.author ?? null,
    marked: outcome?.marked ?? null,
    file: whole ? mapConflict(whole) : null,
    items,
  };
}

/**
 * The lines of ours a conflicted song's reading view marks (`mark-conf`): the
 * ours side of every chart/sections/block-notes region (§11.12.1). Each is a
 * canonical chart line as the merge wrote it, which is how ours's reading chart
 * renders it — the view matches a rendered line's text against this set to mark
 * the disputed bars (workflow 9 §Meeting one: "the conflicted places marked").
 *
 * @param {{ conflicts: object[] }} outcome
 * @returns {string[]}  the disputed ours lines, in region order
 */
export function disputedChartLines(outcome) {
  const lines = [];
  for (const c of outcome?.conflicts ?? []) {
    if (!CHART_KINDS.has(c.kind)) continue;
    const ours = c.ours;
    if (Array.isArray(ours)) {
      for (const line of ours) {
        // A `sections`/`block` run is multi-line text per unit; a `chart` run is
        // one line per unit. Split on LF so every marked line stands alone.
        for (const one of String(line).split('\n')) if (one.length) lines.push(one);
      }
    }
  }
  return lines;
}

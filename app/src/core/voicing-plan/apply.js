/**
 * The plan → variation bridge (workflow 5 §The wizard; cifra.md §8.5.4/§8.5.5).
 *
 * A planner returns a shape per chord occurrence, keyed by the reading's scalar
 * `at` and knowing nothing of the format. Turning that into a song is cifra.md
 * for JavaScript's job, not the app's: §8.5.4 `chooseShapes(doc, plan, tuning,
 * variation)` does the one-pass batch — footnote-slot allocation, the refusal to
 * merge slots another tuning or variation tells apart, and the renumber-and-prune
 * that falls out of the canonical writer — and §8.5.5 `addVariation` creates a
 * new block. The app does not carry over Explore Chords' text-level
 * `setVoicingsForOccurrences`; it maps the plan onto those operations instead
 * (DESIGN §2.10; `cifra_js.editing`). The wizard is their first caller.
 *
 * All this bridge adds is the two mechanical adapters that stand between a
 * planner's output and the §8.5 `plan`:
 *   - each `at` becomes its cifra.md occurrence index path, read straight off
 *     `reading.line[at].occurrence` (built once in `analyseSong`);
 *   - a shape's fingering is written in cifra.md's encoding, inverting the read
 *     mapping of `voicings.js:withSongFingers`: the app's thumb `0` → `'T'`.
 *
 * Chords the planner could not voice are in `planResult.missing` and never in
 * `shapes`, so iterating `shapes` leaves them out — a default on read, never
 * persisted (§8.5.4 / I4). Operations do not self-canonicalise: each returns the
 * mutated model, and the caller hands it to `write`/`canonical`.
 *
 * Pure, synchronous and framework-free, like everything in core/ (DIRECTION
 * §3.7). It knows no React, no Worker and no storage; the instrument's tuning,
 * the variation name and the plan are arguments.
 */

import { chooseShapes, addVariation } from 'cifra-md';

/**
 * A planner's shape value → a §8.5 shape (`{ frets, fingers? }`).
 *
 * The planners return bare frets (`(number|'x')[]`); a caller may also pass a
 * fingering-like `{ frets, fingers }` (the one-chord picker of `songs.arrange`),
 * in which case the fingering is kept and its thumb re-encoded. A finger `0` is
 * the app's thumb; cifra.md writes it `'T'` (§7.5.1).
 */
function toShape(value) {
  if (Array.isArray(value)) return { frets: [...value] };
  const shape = { frets: [...value.frets] };
  if (Array.isArray(value.fingers)) {
    shape.fingers = value.fingers.map((f) => (f === 0 ? 'T' : f));
  }
  return shape;
}

/** The §8.5.4 `plan` for a planner's `shapes`, each `at` resolved to its path. */
function planFor(planResult) {
  const plan = [];
  for (const [at, value] of planResult.shapes) {
    const entry = planResult.reading.line[at];
    if (!entry) continue;
    plan.push({ occurrence: entry.occurrence, shape: toShape(value) });
  }
  return plan;
}

/**
 * Write a plan into an existing variation — the "over this one" path of
 * workflow 5, where the plan lands in the variation already in use (or the
 * default). Returns the mutated model; the caller runs `write`.
 *
 * @param {object} doc  the cifra.md parse model
 * @param {import('./index.js').PlanResult & {reading: object}} planResult
 *   a `planVoicings` result (its `shapes` Map and `reading`)
 * @param {{tuning: (string|object), variation?: string}} options
 *   `tuning` is a §6.2 text or a parsed `{ text, pitches, id }`; `variation` is
 *   the block label, `''` the default
 * @returns {object} the new model
 */
export function applyPlan(doc, planResult, { tuning, variation = '' } = {}) {
  return chooseShapes(doc, planFor(planResult), tuning, variation);
}

/**
 * The plan into a new variation first — the primary path of workflow 5, which
 * keeps the plan beside an existing arrangement rather than over it (§7.3). It
 * creates the block (`addVariation`, which **throws** if one for this tuning and
 * name already exists) then writes the plan into it, leaving the default and the
 * previously in-use variation untouched (variations do not inherit, §7.3).
 * Returns the mutated model; the caller runs `write`.
 *
 * @param {object} doc  the cifra.md parse model
 * @param {import('./index.js').PlanResult & {reading: object}} planResult
 * @param {{tuning: (string|object), name: string, copyFrom?: string}} options
 *   `name` is the new block's label; `copyFrom`, when given, the label of a
 *   variation of the same tuning to seed it from
 * @returns {object} the new model
 */
export function planIntoNewVariation(doc, planResult, { tuning, name, copyFrom } = {}) {
  const withVariation = addVariation(doc, tuning, name, copyFrom);
  return applyPlan(withVariation, planResult, { tuning, variation: name });
}

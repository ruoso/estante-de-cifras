// restorable-blocks.js — group a compare-with-now musical diff into the blocks a
// reader can bring back one at a time (songs.restore_part, workflow 6 §Restoring).
// Pure and framework-free (the view's helper): it folds the ordered change records
// `diff` produced (cifra_js.diff) into restorable blocks — a section (by name, as
// `diff` aligns sections) or a voicing block (by tuning text and variation) — each
// carrying its change records, a display label and the ref RESTORE_PART sends.
//
// Title, property and whole-song reorder changes are not independently restorable
// (restore_part.md Decision 1): a property is a one-field edit better served by
// whole-version restore or direct editing, a reorder is the whole chart, and words
// ride with their section. The ref is resolved against the version's parsed model
// by stable identity in the Worker (restore-block.js); the view mints it from the
// records, so no model subtree crosses the protocol (restore_part.md Decision 5).

/**
 * @param {Array<{ kind: string, op: string, where: object, before: * }>} [changes]
 *   the compare-with-now diff's ordered change records
 * @returns {Array<{ kind: 'section'|'voicing', label: string, ref: object,
 *   changes: object[] }>} the restorable blocks in document-then-model order
 *   (sections first, then voicing blocks — the order `diff` emits them)
 */
export function restorableBlocks(changes) {
  const blocks = [];
  const byKey = new Map();
  const block = (key, make) => {
    let b = byKey.get(key);
    if (!b) {
      b = make();
      byKey.set(key, b);
      blocks.push(b);
    }
    return b;
  };
  for (const ch of changes ?? []) {
    const w = ch.where ?? {};
    if (ch.kind === 'section' || ch.kind === 'chord' || ch.kind === 'words') {
      // A whole-song reorder is not one block (restore_part.md Decision 1).
      if (ch.kind === 'section' && ch.op === 'reordered') continue;
      const name = w.section ?? '';
      const b = block(`s\u0000${name}`, () => ({
        kind: 'section',
        label: name,
        ref: { kind: 'section', name, fromName: name },
        changes: [],
      }));
      // A rename pairs the working name (where.section) with the version name
      // (the record's `before`): restore renames back and restores the content.
      if (ch.kind === 'section' && ch.op === 'renamed') b.ref.fromName = ch.before ?? name;
      b.changes.push(ch);
    } else if (ch.kind === 'voicing') {
      const tuning = w.tuning ?? '';
      const variation = w.variation ?? '';
      const b = block(`v\u0000${tuning}\u0000${variation}`, () => ({
        kind: 'voicing',
        label: tuning,
        ref: { kind: 'voicing', tuning, variation },
        changes: [],
      }));
      b.changes.push(ch);
    }
    // title, property → not independently restorable (restore_part.md Decision 1).
  }
  return blocks;
}

// Whether two block refs name the same block (same kind and identity). Used to
// pair a compare-with-now block with its HEAD-vs-working twin (what would be lost).
export function sameBlockRef(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'section') return a.name === b.name;
  return a.tuning === b.tuning && a.variation === b.variation;
}

/**
 * The localized display label of a restorable block (musical tokens — the section
 * name, the tuning — pass as data, never translated).
 *
 * @param {{ kind: string, label: string }} block
 * @param {(key: string, params?: object) => string} t
 */
export function blockLabelText(block, t) {
  if (block.kind === 'voicing') return t('history.voicingBlock', { tuning: block.label });
  return block.label === '' ? t('saveSheet.change.untitledSection') : block.label;
}

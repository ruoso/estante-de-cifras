// restore-block.js — the model-level splice behind RESTORE_PART (songs.restore_part,
// workflow 6 §Restoring). Pure and framework-free: it parses the working copy and
// the chosen version, replaces exactly ONE block — a section or a voicing block —
// of the working model with the version's, and writes the result canonical. Every
// other section, block, property and the title are carried through
// parse→splice→write unchanged, which the canonical round-trip guarantees ("one
// block changes, the rest byte-identical", restore_part.md §Constraints).
//
// It lives in the Worker (the splice and the working-tree write are the Worker's,
// DIRECTION §3.7) but touches no git, IndexedDB or lock: restorePart in history.js
// calls it inside the one book lock. The subtle part — re-deriving the §8.3
// footnote invariants after a voicing block moves, and dropping a restored block
// whose keys the chart no longer uses — is write/canonical's, already corpus-proven
// (restore_part.md Decision 2); this module only orchestrates plain-object trees.
//
// A restored voicing block whose chords are not in the working chart is emptied by
// canonical's §8.3 I1; canonical leaves the emptied block as a bare heading, so
// this module drops empty voicing blocks before serialising — never a dangling
// half-restore (restore_part.md §Constraints; behaviour 4). When the splice
// canonicalises to the working copy's own canonical form — nothing to bring back,
// or a block pruned to nothing — it returns `{ empty: true }` and writes nothing.

import { parse, write, canonical } from 'cifra-md';

// A stable deep copy that preserves key order (the model is plain JSON), matching
// write.js's clone so a spliced subtree is byte-identical to a parsed one.
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Splice one section name-group: the working copy's run of sections named `name`
// is replaced by the version's run named `fromName` (the two differ only on a
// rename, restore_part.md Decision 5). An empty version run removes the working
// run (the block was added since the version — restore drops it); an empty working
// run inserts the version run at its version-order position (the block was removed
// since — restore brings it back).
function spliceSection(doc, vDoc, name, fromName) {
  const vRun = vDoc.sections.filter((s) => s.name === fromName).map(clone);
  const wIdxs = [];
  doc.sections.forEach((s, i) => {
    if (s.name === name) wIdxs.push(i);
  });
  if (wIdxs.length) {
    const at = wIdxs[0];
    for (let k = wIdxs.length - 1; k >= 0; k -= 1) doc.sections.splice(wIdxs[k], 1);
    if (vRun.length) doc.sections.splice(at, 0, ...vRun);
  } else if (vRun.length) {
    const vIdx = vDoc.sections.findIndex((s) => s.name === fromName);
    const before = new Set(vDoc.sections.slice(0, vIdx).map((s) => s.name));
    let insertAt = 0;
    for (let i = 0; i < doc.sections.length; i += 1) {
      if (before.has(doc.sections[i].name)) insertAt = i + 1;
    }
    doc.sections.splice(insertAt, 0, ...vRun);
  }
}

// Splice one voicing block, keyed by (tuning text, variation label) — the identity
// the diff records carry (restore_part.md Decision 5). Replace / remove / add,
// mirroring spliceSection; canonical re-sorts the blocks (§8.4.6), so the insert
// position only has to be deterministic.
function spliceVoicing(doc, vDoc, tuning, variation) {
  const matches = (b) => b.tuning.text === tuning && b.label === variation;
  const vBlock = vDoc.blocks.find(matches) ?? null;
  const wIdx = doc.blocks.findIndex(matches);
  if (wIdx >= 0) {
    if (vBlock) doc.blocks[wIdx] = clone(vBlock);
    else doc.blocks.splice(wIdx, 1);
  } else if (vBlock) {
    doc.blocks.push(clone(vBlock));
  }
}

// Canonical text of a model, with any voicing block §8.3 I1 emptied dropped so no
// bare voicing heading survives. The comparison both sides use, so a no-op and a
// prune-to-nothing both read as "nothing to bring back".
function canonicalText(doc) {
  const canon = canonical(doc);
  canon.blocks = canon.blocks.filter((b) => b.voicings.length > 0);
  return write(canon);
}

/**
 * Splice one block of `versionText` into `workingText`, canonical.
 *
 * @param {string} workingText the working copy's current bytes
 * @param {string} versionText the chosen version's bytes
 * @param {{ kind: 'section'|'voicing', name?: string, fromName?: string,
 *   tuning?: string, variation?: string }} block the ref restorableBlocks minted
 * @returns {{ text: string } | { empty: true }} the spliced canonical text, or
 *   `{ empty: true }` when the restore brings nothing back — a no-op, or a voicing
 *   block pruned to nothing because its chords are not in the working chart
 */
export function restoreBlock(workingText, versionText, block) {
  const wDoc = parse(workingText);
  const vDoc = parse(versionText);
  const spliced = clone(wDoc);
  if (block.kind === 'voicing') {
    spliceVoicing(spliced, vDoc, block.tuning, block.variation ?? '');
  } else {
    spliceSection(spliced, vDoc, block.name, block.fromName ?? block.name);
  }
  const text = canonicalText(spliced);
  if (text === canonicalText(wDoc)) return { empty: true };
  return { text };
}

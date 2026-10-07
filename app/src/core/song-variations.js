/**
 * The variation labels a song offers for one tuning — what feeds the reading
 * view's variation picker (workflow 2 L73-74; cifra.md §7.6).
 *
 * The companion of `voicings.js`'s private `selectBlock`: where that resolves
 * the one block in use for a tuning and variation, this enumerates the labels a
 * picker chooses between. The §7.6 no-fallback rule holds here too — only blocks
 * whose tuning matches are counted, so a variation is never borrowed across
 * tunings, and a tuning with no block offers nothing.
 *
 * Pure, synchronous and framework-free, like everything in core/ (DIRECTION
 * §3.7): it reads the cifra.md parse model as data and knows nothing of React,
 * IndexedDB or the Worker.
 */

/**
 * The ordered variation labels a song has for `tuningId` (the §6.3 identity,
 * the space-joined open-string MIDI numbers — `openMidis(instrument).join(' ')`,
 * the same identity `resolveSongVoicings` matches on). The default variation
 * (`label === ''`, cifra.md's plain `Voicings` heading) comes first when the
 * song has one; the named variations follow in `parse` order. Duplicates are
 * folded. A tuning the song has no block for yields `[]`.
 *
 * @param {object} parsed  a cifra.md parse model
 * @param {string} tuningId  the §6.3 tuning identity to enumerate for
 * @returns {string[]}  the labels, `''` first, in chart/picker order
 */
export function songVariations(parsed, tuningId) {
  const labels = [];
  const seen = new Set();
  for (const block of parsed?.blocks ?? []) {
    if (block?.tuning?.id !== tuningId) continue;
    const label = block.label ?? '';
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  // The default variation leads the picker, whatever its position in the text.
  if (seen.has('') && labels[0] !== '') {
    return ['', ...labels.filter((l) => l !== '')];
  }
  return labels;
}

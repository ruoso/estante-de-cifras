// render-change.js — the pure, localized renderer for one semantic-diff change
// record (songs.save_sheet, Decision 3; workflow 4 §Saving). The library's
// `diff` (cifra_js.diff) returns structured records `{ kind, op, where, before,
// after, text }`, whose `text` is neutral English — right for the commit
// message / note, wrong on screen for a pt-BR/es/it UI. This maps each record
// to a localized `{ where, what }` row — the location and what changed there —
// the two columns the save sheet and the discard confirm show (mockup W04's
// `.diff` rows). Musical tokens — chord symbols, note names, section names,
// property keys, bar numbers — are passed through as DATA, never translated;
// only the surrounding words are. Reused by `songs.history`'s version previews.
//
// Pure: no React, no I/O. `t` is the i18n lookup (i18n/index.js), `t(key,
// params)` interpolating `{name}`-style placeholders.

// The pre-heading section's name is the empty string (diff.js sectionLabel);
// name it with a word so a row for it never renders blank.
function sectionLabel(name, t) {
  return name === '' || name == null ? t('saveSheet.change.untitledSection') : name;
}

// The location column: where in the song the change is.
function whereOf(record, t) {
  const w = record.where ?? {};
  switch (record.kind) {
    case 'title':
      return t('saveSheet.change.titleWhere');
    case 'property':
      // The property key is the user's/format's own word (e.g. capo, key).
      return w.key ?? '';
    case 'section':
      if (record.op === 'reordered') return t('saveSheet.change.sectionsWhere');
      // A rename locates by the old name, which is the record's `before`.
      return sectionLabel(record.op === 'renamed' ? record.before : w.section, t);
    case 'chord':
      return w.bar != null
        ? t('saveSheet.change.sectionBar', { section: sectionLabel(w.section, t), bar: w.bar })
        : sectionLabel(w.section, t);
    case 'words':
      return sectionLabel(w.section, t);
    case 'voicing':
      // Both a whole-block change and a single-voicing change read under the one
      // "Voicings" heading (mockup W04); the tuning is carried in the what column.
      return t('saveSheet.change.voicingsWhere');
    default:
      return '';
  }
}

// The what column: what changed at that location.
function whatOf(record, t) {
  const { kind, op, before, after } = record;
  const w = record.where ?? {};

  if (kind === 'voicing') {
    const tuning = w.tuning ?? '';
    if (w.key == null) {
      // A whole voicing block added or removed: "added for {tuning}".
      return op === 'removed'
        ? t('saveSheet.change.voicingBlockRemoved', { tuning })
        : t('saveSheet.change.voicingBlockAdded', { tuning });
    }
    // One voicing within a block, named by its chord (the block's key).
    const chord = w.key;
    if (op === 'removed') return t('saveSheet.change.voicingRemoved', { tuning, chord });
    if (op === 'added') return t('saveSheet.change.voicingAdded', { tuning, chord });
    return t('saveSheet.change.voicingChanged', { tuning, chord });
  }

  if (kind === 'section') {
    if (op === 'added') return t('saveSheet.change.sectionAdded');
    if (op === 'removed') return t('saveSheet.change.sectionRemoved');
    if (op === 'renamed') return t('saveSheet.change.sectionRenamed', { name: sectionLabel(after, t) });
    return t('saveSheet.change.sectionReordered');
  }

  if (kind === 'words') return t('saveSheet.change.wordsChanged');

  // title, property, chord — add / remove / change of a value.
  if (op === 'added') return t('saveSheet.change.added', { value: after });
  if (op === 'removed') return t('saveSheet.change.removed', { value: before });
  return t('saveSheet.change.changed', { before, after });
}

/**
 * Render one diff change record to a localized two-column row.
 *
 * @param {{ kind: string, op: string, where: object, before: *, after: * }} change
 * @param {(key: string, params?: object) => string} t
 * @returns {{ where: string, what: string }}
 */
export function renderChange(change, t) {
  return { where: whereOf(change, t), what: whatOf(change, t) };
}

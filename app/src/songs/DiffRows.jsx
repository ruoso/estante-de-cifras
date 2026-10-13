// DiffRows.jsx — the localized two-column "what changed" rows (mockup W04/W06
// `.diff`): a location in `.k` and what changed beside it, one row per semantic-
// diff change record. Extracted from the inline copies that `SaveSheet.jsx` and
// `DiscardConfirm.jsx` each carried, so the save sheet, the discard confirm and
// songs.history's version diffs all render change records identically
// (songs.history Wiring; the `renderChange` header names history as a consumer).
//
// It has two modes. Its default is a flat list of change rows (the save sheet, the
// discard confirm, a version-vs-before diff). Given `blocks` and `onRestoreBlock`
// (the compare-with-now diff in songs.history), it groups the rows by restorable
// block — a section or a voicing block — and shows a *Restore this block* affordance
// beside each (songs.restore_part, workflow 6 §Restoring): the per-block affordance
// lives here and is raised to SongHistory.
//
// Pure presentation: it renders the records `diff` produced (cifra_js.diff) through
// the pure, localized `renderChange` — musical tokens pass as data, never translated
// (Decision 3). It holds no state and reads no slice. `t` is read from the
// module-level i18n (the whole view re-renders on a language change).

import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { renderChange } from './render-change.js';
import { blockLabelText } from './restorable-blocks.js';

function ChangeRow({ change, i }) {
  const { where, what } = renderChange(change, t);
  return (
    <div className="d" key={`${where}:${what}:${i}`}>
      <span className="k">{where}</span>
      <span>{what}</span>
    </div>
  );
}

/**
 * @param {object} props
 * @param {Array<{ kind: string, op: string, where: object, before: *, after: * }>} [props.changes]
 *   the diff's ordered change records (flat mode); nothing renders when empty/absent
 * @param {Array<{ kind: string, label: string, ref: object, changes: object[] }>} [props.blocks]
 *   restorable blocks (grouped mode); with `onRestoreBlock`, each gets a restore button
 * @param {(block: object) => void} [props.onRestoreBlock] raise a per-block restore
 */
export default function DiffRows({ changes, blocks, onRestoreBlock }) {
  // Grouped, per-block restore mode (songs.restore_part): each block the version
  // differs in carries its rows and a *Restore this block* affordance.
  if (blocks && onRestoreBlock) {
    if (!blocks.length) return null;
    return (
      <div className="diff est-restore-blocks">
        {blocks.map((block, bi) => {
          const label = blockLabelText(block, t);
          return (
            <div
              className="est-restore-block"
              key={`${block.kind}:${block.label}:${bi}`}
              role="group"
              aria-label={label}
            >
              <div className="est-restore-rows">
                {block.changes.map((change, i) => (
                  <ChangeRow change={change} i={i} key={`${block.label}:${i}`} />
                ))}
              </div>
              <Button
                className="btn est-restore-btn"
                aria-label={t('history.restoreBlockNamed', { block: label })}
                onPress={() => onRestoreBlock(block)}
              >
                {t('history.restoreBlock')}
              </Button>
            </div>
          );
        })}
      </div>
    );
  }

  // Flat mode.
  if (!changes?.length) return null;
  return (
    <div className="diff">
      {changes.map((change, i) => (
        <ChangeRow change={change} i={i} key={`${change.kind}:${i}`} />
      ))}
    </div>
  );
}

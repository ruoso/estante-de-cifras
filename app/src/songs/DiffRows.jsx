// DiffRows.jsx — the localized two-column "what changed" rows (mockup W04/W06
// `.diff`): a location in `.k` and what changed beside it, one row per semantic-
// diff change record. Extracted from the inline copies that `SaveSheet.jsx` and
// `DiscardConfirm.jsx` each carried, so the save sheet, the discard confirm and
// songs.history's version diffs all render change records identically
// (songs.history Wiring; the `renderChange` header names history as a consumer).
//
// Pure presentation: it renders the records `diff` produced (cifra_js.diff)
// through the pure, localized `renderChange` — musical tokens pass as data,
// never translated (Decision 3). It holds no state and reads no slice; the
// change records are handed in as a prop. `t` is read from the module-level i18n
// (the whole view re-renders on a language change), matching renderChange's
// callers.

import { t } from '../i18n/index.js';
import { renderChange } from './render-change.js';

/**
 * @param {object} props
 * @param {Array<{ kind: string, op: string, where: object, before: *, after: * }>} [props.changes]
 *   the diff's ordered change records; nothing renders when empty or absent
 */
export default function DiffRows({ changes }) {
  if (!changes?.length) return null;
  return (
    <div className="diff">
      {changes.map((change, i) => {
        const { where, what } = renderChange(change, t);
        return (
          <div className="d" key={`${where}:${what}:${i}`}>
            <span className="k">{where}</span>
            <span>{what}</span>
          </div>
        );
      })}
    </div>
  );
}

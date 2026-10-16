// InstrumentChip — the one shared piece of shell chrome (music.instruments
// Decision 1): the instrument in use, shown everywhere, opening the roster
// (workflow 1 L65-66; workflow 15 L61-69). It reads the `instruments` slice and
// renders the in-use instrument's one short label (or the standard-guitar
// fallback when no instrument is set up), with the full identity — catalogue,
// tuning, pitches — as its accessible description (shell.header_chrome);
// pressing it asks the shell to open the overlay. A React Aria `Button` with an
// accessible name that says what it does; the chip carries the instrument as a
// word, never colour alone.

import { useId } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { chipDescription, chipLabel } from './instrument-helpers.js';

// The in-use instrument from the slice: the entry whose id is `inUseId`, else
// the standard-guitar fallback the Worker always sends (absent in-use → the
// built-in default, workflow 1 L72-78).
export function inUseEntry(slice) {
  const { instruments = [], inUseId = null, standard = null } = slice ?? {};
  if (inUseId) {
    const found = instruments.find((e) => e.id === inUseId);
    if (found) return found;
  }
  return standard;
}

export default function InstrumentChip({ store, onOpen }) {
  const slice = useSlice(store, 'instruments');
  const entry = inUseEntry(slice);
  const label = chipLabel(entry);
  const descriptionId = useId();
  return (
    <>
      <Button
        className="chip accent instrument-chip"
        aria-label={t('instr.chip.change', { label })}
        aria-describedby={descriptionId}
        onPress={onOpen}
      >
        {label}
      </Button>
      <span id={descriptionId} className="visually-hidden">
        {chipDescription(entry)}
      </span>
    </>
  );
}

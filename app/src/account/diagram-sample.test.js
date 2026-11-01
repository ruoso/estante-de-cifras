// The Account screen's diagram sample follows the instrument in use (the persona
// exploration of 2026-11-01): a ukulele draws a four-string C, and no
// instrument in use draws the guitar's known C.
import { describe, it, expect } from 'vitest';
import { instrumentInstance, configFor } from '../core/instrument.js';
import { diagramSample } from './AccountScreen.jsx';

const UKE_TUNING = 'G4 C4 E4 A4';

describe('diagramSample', () => {
  it('draws a C on the ukulele in use', () => {
    const inst = instrumentInstance({ catalogId: 'ukulele', strings: UKE_TUNING, fretCount: 15 });
    const entry = { id: 'u1', catalogId: 'ukulele', label: 'Ukulele', tuning: UKE_TUNING, fretCount: 15, config: configFor(inst, 'strumming'), shapes: [] };
    const sample = diagramSample({ instruments: [entry], inUseId: 'u1', standard: null });
    expect(sample.instrument.strings).toHaveLength(4);
    expect(sample.fingering).not.toBeNull();
  });

  it('draws the guitar sample with nothing in use', () => {
    const sample = diagramSample({ instruments: [], inUseId: null, standard: null });
    expect(sample.instrument.strings).toHaveLength(6);
  });
});

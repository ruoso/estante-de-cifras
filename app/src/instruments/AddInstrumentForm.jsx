// AddInstrumentForm — adding an instrument (music.instruments, workflow 15
// §Adding): catalogue → a tuning preset or a custom §6 pitch list → the "How you
// play" preset → an optional rename → Add. The tuning is the identity and the
// source of truth (shown as its §6 text); a custom list that does not parse is
// refused with the reason and nothing is stored (workflow 15 L224-226). Every
// control is a React Aria Component with a keyboard path and a label.

import { useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  TextField,
} from 'react-aria-components';
import { t, errorText } from '../i18n/index.js';
import { defaultPresetFor } from '../core/instrument.js';
import {
  CATALOG,
  catalogEntry,
  PRESET_IDS,
  tuningText,
  tuningName,
  defaultLabel,
  presetLabel,
} from './instrument-helpers.js';

const CUSTOM = '__custom__';

// A role="group" segmented control of pressable buttons, single-select — the
// mockup's chip/segment rows (a role="group", not a role="list" —
// [[role-list-of-rac-buttons-fails-axe]]). Each option is a RAC Button carrying
// its selected state as aria-pressed (a word to assistive tech, never colour
// alone).
function SegGroup({ label, options, value, onChange, className = 'chip-row' }) {
  return (
    <div role="group" aria-label={label} className={className}>
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <Button
            key={opt.id}
            className={`chip${selected ? ' accent' : ''}`}
            aria-pressed={selected}
            onPress={() => onChange(opt.id)}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}

// Match a §6 tuning text to one of a catalogue entry's preset tunings, so an
// edit opens on the named preset it was made from (else the custom sentinel).
function matchTuning(entry, tuning) {
  for (const tn of entry.tunings) {
    try {
      if (tuningText(tn.strings) === tuning) return tn.name;
    } catch {
      // ignore a catalogue tuning that will not parse (there are none today)
    }
  }
  return CUSTOM;
}

export default function AddInstrumentForm({ onSubmit, onCancel, initial = null, editId = null }) {
  const startCatalog = initial?.catalogId ?? CATALOG[0].id;
  const startEntry = catalogEntry(startCatalog) ?? CATALOG[0];
  const startTuning = initial ? matchTuning(startEntry, initial.tuning) : startEntry.tunings[0].name;

  const [catalogId, setCatalogId] = useState(startCatalog);
  const entry = catalogEntry(catalogId) ?? CATALOG[0];
  const tunings = entry.tunings;

  const [tuningChoice, setTuningChoice] = useState(startTuning);
  const [custom, setCustom] = useState(
    initial && startTuning === CUSTOM ? initial.tuning : '',
  );
  const [playPreset, setPlayPreset] = useState(defaultPresetFor(startCatalog));
  const [name, setName] = useState(initial?.label ?? '');
  const [nameTouched, setNameTouched] = useState(Boolean(initial?.label));
  const [presetTouched, setPresetTouched] = useState(false);
  const [error, setError] = useState(null);

  const isCustom = tuningChoice === CUSTOM;

  // The chosen tuning as its §6 identity text, and any parse fault on a custom
  // list (shown under the field; nothing is stored until it reads).
  const { text: tuningDisplay, reason } = useMemo(() => {
    const raw = isCustom ? custom : tunings.find((tn) => tn.name === tuningChoice)?.strings ?? '';
    if (isCustom && !custom.trim()) return { text: '', reason: null };
    try {
      return { text: tuningText(raw), reason: null };
    } catch (err) {
      return { text: '', reason: errorText(err) };
    }
  }, [isCustom, custom, tuningChoice, tunings]);

  // The label the user sees until they rename: "catalogue · tuning" (the preset
  // name, or the §6 text for a custom tuning).
  const suggested = defaultLabel(catalogId, isCustom ? tuningDisplay : tuningName(tuningChoice));
  const shownName = nameTouched ? name : suggested;

  const onCatalog = (id) => {
    const next = catalogEntry(id) ?? CATALOG[0];
    setCatalogId(id);
    setTuningChoice(next.tunings[0].name);
    setCustom('');
    setError(null);
    if (!presetTouched) setPlayPreset(defaultPresetFor(id));
  };

  const submit = (event) => {
    event.preventDefault();
    let tuning;
    try {
      tuning = tuningText(isCustom ? custom : tunings.find((tn) => tn.name === tuningChoice).strings);
    } catch (err) {
      setError(errorText(err));
      return;
    }
    const label = (nameTouched ? name : suggested).trim() || suggested;
    const definition = { catalogId, label, tuning, fretCount: entry.fretCount };
    // Editing rewrites only the definition (rules stay their own register,
    // workflow 15 L46-49); adding carries the chosen "How you play" preset.
    onSubmit(editId ? { id: editId, definition } : { definition, preset: playPreset });
  };

  const tuningOptions = [
    ...tunings.map((tn) => ({ id: tn.name, label: tuningName(tn.name) })),
    { id: CUSTOM, label: t('instr.add.custom') },
  ];
  const presetOptions = PRESET_IDS.map((id) => ({ id, label: presetLabel(id) }));

  return (
    <form className="instr-form" onSubmit={submit}>
      <Select
        className="field"
        selectedKey={catalogId}
        onSelectionChange={(key) => onCatalog(String(key))}
      >
        <Label>{t('instr.add.instrument')}</Label>
        <Button className="input select-trigger">
          <SelectValue />
          <span aria-hidden="true">▾</span>
        </Button>
        <Popover className="instr-popover">
          <ListBox>
            {CATALOG.map((e) => (
              <ListBoxItem key={e.id} id={e.id}>
                {t(['catalog', e.id])}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>

      <div className="field">
        <span className="field-label">{t('instr.add.tuning')}</span>
        <SegGroup
          label={t('instr.add.tuningGroup')}
          options={tuningOptions}
          value={tuningChoice}
          onChange={(id) => {
            setTuningChoice(id);
            setError(null);
          }}
        />
        {isCustom ? (
          <TextField
            className="field"
            value={custom}
            onChange={setCustom}
            aria-label={t('instr.add.customOption')}
          >
            <Input className="input t-mono" placeholder={t('instr.add.customPlaceholder')} />
          </TextField>
        ) : null}
        {tuningDisplay ? (
          <div className="input t-mono instr-tuning-preview">{tuningDisplay}</div>
        ) : null}
        {error || reason ? (
          <p className="t-small instr-error" role="alert">
            {t('instr.add.badTuning', { reason: error ?? reason })}
          </p>
        ) : null}
        <span className="t-small">{t('instr.add.tuningHelp')}</span>
      </div>

      <TextField
        className="field"
        value={shownName}
        onChange={(v) => {
          setNameTouched(true);
          setName(v);
        }}
      >
        <Label>{t('instr.add.name')}</Label>
        <Input className="input" />
      </TextField>

      {editId ? null : (
        <div className="field">
          <span className="field-label">{t('instr.add.howYouPlay')}</span>
          <SegGroup
            label={t('instr.add.howYouPlay')}
            options={presetOptions}
            value={playPreset}
            onChange={(id) => {
              setPresetTouched(true);
              setPlayPreset(id);
            }}
          />
          <span className="t-small">{t('instr.add.howYouPlayHelp')}</span>
        </div>
      )}

      <div className="actions">
        <Button className="btn" onPress={onCancel}>
          {t('instr.add.cancel')}
        </Button>
        <Button type="submit" className="btn primary">
          {t('instr.add.submit')}
        </Button>
      </div>
    </form>
  );
}

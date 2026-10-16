// VoicingRules — the preset segmented control over the expert panel
// (music.instruments, workflow 15 §The voicing rules). A preset (no "Standard")
// chosen from a role="group" segmented control; below it every HeuristicConfig
// rule as a role="switch" toggle, every limit and weight as a number. Editing
// any one turns the preset to Custom (via the core's `withOverrides`) and stores
// the config exactly; choosing a preset rebuilds from it. `rootInBass` is forced
// off and disabled on an instrument with no bass register. The effective config
// comes down already resolved from the Worker (rebuilt for a preset, re-clamped
// for a custom set), so the view and the search never derive it differently.

import { Button, Input, Label, NumberField, Switch } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { withOverrides, DEFAULT_WEIGHTS } from '../core/heuristics.js';
import { defaultPresetFor } from '../core/instrument.js';
import { PRESET_IDS, presetLabel } from './instrument-helpers.js';

// The expert panel's rows, in the mockup's order (W15 tablet board).
const TOGGLE_KEYS = [
  'requireRoot',
  'rootInBass',
  'requireThird',
  'omitFifth',
  'allowRootless',
  'requireExtensions',
  'allowBarre',
  'allowInnerMutes',
  'allowDoubling',
  'allowDuplicatePitch',
];
const LIMIT_KEYS = ['maxSpan', 'minSoundingStrings', 'maxResultsPerGroup'];
const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS);

export default function VoicingRules({ entry, onSetRules }) {
  const config = entry.config;
  const hasBass = entry.hasBass;
  const custom = entry.presetId === 'custom';

  // Apply one edit: let the core decide whether it still names a preset or has
  // become Custom (`withOverrides` flips `preset` to 'custom' when it diverges),
  // then store the intent — a named preset, or the frozen custom config.
  const applyPatch = (patch) => {
    const next = withOverrides(config, patch);
    const rules =
      next.preset === 'custom' ? { preset: 'custom', config: next } : { preset: next.preset };
    onSetRules(entry.id, rules);
  };

  const choosePreset = (id) => onSetRules(entry.id, { preset: id });
  const resetTarget = defaultPresetFor(entry.catalogId);

  return (
    <div className="instr-rules">
      <div className="instr-rules-head">
        <span className="t-h3">{t('instr.rules.preset')}</span>
        <div role="group" aria-label={t('instr.rules.presetGroup')} className="seg">
          {PRESET_IDS.map((id) => {
            const selected = !custom && entry.presetId === id;
            return (
              <Button
                key={id}
                className={selected ? 'on' : undefined}
                aria-pressed={selected}
                onPress={() => choosePreset(id)}
              >
                {presetLabel(id)}
              </Button>
            );
          })}
        </div>
        {custom ? <span className="badge">{t('rules.custom')}</span> : null}
        {custom ? (
          <Button className="btn quiet instr-reset" onPress={() => choosePreset(resetTarget)}>
            {t('instr.rules.reset', { preset: presetLabel(resetTarget) })}
          </Button>
        ) : null}
      </div>

      <p className="t-small">{t('instr.rules.explainer')}</p>

      {/* Two columns from a tablet up (W15 #3; music.instruments_layout Decision
          3): Rules, then Limits above Costs. The DOM keeps the reading order at
          every width; only the CSS lays them side by side. */}
      <div className="instr-rules-cols">
        <div className="instr-rules-col">
          <section className="instr-rules-section">
            <div className="section-label">
              <span className="t-h3">{t('instr.rules.rules')}</span>
            </div>
            <div className="list">
              {TOGGLE_KEYS.map((key) => {
                const value = Boolean(config[key]);
                const disabled = key === 'rootInBass' && !hasBass;
                const label = t(['instr', 'rules', 'rule', key]);
                return (
                  <div className="row" key={key}>
                    <span className="grow" aria-hidden="true">
                      <span className="name">{label}</span>
                    </span>
                    {/* The Switch carries the label as its accessible name;
                        role=switch and aria-checked (from RAC) convey the state,
                        so the visible name beside it is aria-hidden to avoid
                        saying it twice. */}
                    <Switch
                      className="instr-switch"
                      aria-label={label}
                      isSelected={value}
                      isDisabled={disabled}
                      onChange={(checked) => applyPatch({ [key]: checked })}
                    >
                      <span className={`toggle${value ? ' on' : ''}`} aria-hidden="true" />
                    </Switch>
                  </div>
                );
              })}
            </div>
            {!hasBass ? <p className="t-small">{t('instr.rules.noBass')}</p> : null}
          </section>
        </div>

        <div className="instr-rules-col">
          <section className="instr-rules-section">
            <div className="section-label">
              <span className="t-h3">{t('instr.rules.limits')}</span>
            </div>
            <div className="list">
              {LIMIT_KEYS.map((key) => (
                <NumberField
                  key={key}
                  className="row instr-num"
                  value={Number(config[key] ?? 0)}
                  step={1}
                  minValue={1}
                  onChange={(v) => Number.isFinite(v) && applyPatch({ [key]: v })}
                >
                  <Label className="grow">
                    <span className="name">{t(['instr', 'rules', 'limit', key])}</span>
                    {key === 'maxSpan' ? (
                      <span className="meta">{t('instr.rules.limit.maxSpanUnit')}</span>
                    ) : null}
                  </Label>
                  <Input className="input instr-num-input" />
                </NumberField>
              ))}
            </div>
          </section>

          <section className="instr-rules-section">
            <div className="section-label">
              <span className="t-h3">{t('instr.rules.costs')}</span>
            </div>
            <div className="list">
              {WEIGHT_KEYS.map((key) => (
                <NumberField
                  key={key}
                  className="row instr-num"
                  value={Number(config.weights?.[key] ?? 0)}
                  step={0.1}
                  onChange={(v) => Number.isFinite(v) && applyPatch({ weights: { [key]: v } })}
                >
                  <Label className="grow">
                    <span className="name">{t(['rules', 'weight', key])}</span>
                  </Label>
                  <Input className="input instr-num-input" />
                </NumberField>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

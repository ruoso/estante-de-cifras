// SongWizard — the voicing wizard (songs.wizard_ui, workflow 5; board W05, the
// computer drawing). The action behind arrange's **Run the wizard** affordance:
// arrange raises `onRunWizard({ bookId, path })`, and AppShell mounts this
// surface over arrange (ephemeral view state, no router — mirroring `arranging`
// itself). It is two steps (docs/DESIGN.md §2.10): choose a policy — the
// planners that make sense on this instrument, each with *How it works* and the
// works it cites, and the choro's one stylistic question — then see the shapes it
// would choose, as the same diagrams the song will carry, before anything
// changes. Accepting writes the plan into the working copy like any other arrange
// edit, then returns to arrange (Decision 1).
//
// The view drives the pure engine and never re-plans or re-ranks (Decision 5):
// the policy list is `plannersFor(instrument)`, the stylistic question is seeded
// from `optionDefaults`, and the preview is `planVoicings`' result rendered
// as-is. Nothing is persisted until **Write the plan** (Decision 2): the preview
// is computed in memory. When the variation in use already holds choices the
// wizard offers *into a new variation* first and *over this one* second
// (Decision 3, the pure `wizard-choices` helper); when it has none the plan is
// written straight in with no question. Writing reuses arrange's persistence
// exactly — the engine's mutated model → cifra.md `write` → `WRITE`, and
// `SET_VARIATION` for a new block — with no new Worker command (Decision 4). The
// Worker owns durability; the view never touches IndexedDB or git (DIRECTION
// §3.7). WRITE is silent, so arrange re-reads the working copy when it re-mounts
// on close and shows the new variation.

import { useEffect, useState } from 'react';
import { Button, Disclosure, DisclosurePanel, Heading, Input, Label, Radio, RadioGroup, TextField } from 'react-aria-components';
import { parse, write } from 'cifra-md';
import { t, tr } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import { inUseEntry } from '../instruments/InstrumentChip.jsx';
import { instrumentInstance, openMidis } from '../core/instrument.js';
import { fingeringFromFrets } from '../core/search.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';
import { plannersFor, plannerById, optionDefaults, planVoicings } from '../core/voicing-plan/index.js';
import { planIntoNewVariation, applyPlan } from '../core/voicing-plan/apply.js';
import { sourcesFor, citation } from '../data/sources.js';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import { inUseHasChoices, existingFor } from './wizard-choices.js';
import './wizard.css';

// The device-local commit identity before sign-in, as every write path uses: the
// personal variation-in-use register is auto-committed to the home book, never
// pushed (mirrors SongArrange's LOCAL_IDENTITY).
const LOCAL_IDENTITY = { id: 'local', name: 'Me' };

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// The citations a planner (or a stylistic option) stands on, resolved from the
// bibliography: the works it cites, or the no-source line for a rule of thumb
// about hands that claims nothing about anybody's music (DESIGN §2.10).
function Sources({ ids }) {
  const sources = sourcesFor(ids);
  return (
    <div className="wizard-sources">
      <p className="t-small wizard-sources-label">{t('wizard.sources')}</p>
      {sources.length ? (
        <ul className="wizard-source-list">
          {sources.map((s) => (
            <li key={s.id} className="t-small">
              {citation(s)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="t-small">{t('wizard.noSources')}</p>
      )}
    </div>
  );
}

export default function SongWizard({ store, bookId, path, mode = 'narrow', onBack = () => {} }) {
  // Bring the song in on mount (idempotent — arrange already opened it): the text
  // to parse (OPEN_SOURCE) and the reading state for the variation in use
  // (OPEN_SONG), so the surface stands alone at its dev mount too (Decision 1).
  useEffect(() => {
    if (!bookId || !path) return;
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    store.send(command(CommandKind.OPEN_SONG, { bookId, path }));
  }, [store, bookId, path]);

  // The slices arrange reads — the song to plan and the instrument to plan for.
  const sourceSlice = useSlice(store, 'source');
  const songSlice = useSlice(store, 'song');
  const instrumentsSlice = useSlice(store, 'instruments');
  const preferences = useSlice(store, 'preferences');

  const [stage, setStage] = useState('policy'); // 'policy' → 'preview'
  const [plannerId, setPlannerId] = useState(null);
  const [choices, setChoices] = useState({}); // stylistic answers for the policy
  const [choice, setChoice] = useState('new'); // 'new' | 'over', when a choice is offered
  const [varName, setVarName] = useState(() => t('wizard.defaultName'));
  const [varError, setVarError] = useState(null);

  const text = sourceSlice?.[bookId]?.[path]?.text ?? '';
  const dialect = preferences?.notation?.value ?? DEFAULT_DIALECT;
  const entry = inUseEntry(instrumentsSlice);

  let instrument = null;
  if (entry) {
    try {
      instrument = instrumentInstance({
        catalogId: entry.catalogId,
        label: entry.label ?? undefined,
        strings: entry.tuning,
        fretCount: entry.fretCount,
        heuristics: entry.config,
      });
    } catch {
      instrument = null;
    }
  }

  // The two tunings, by design (as arrange): `tuningId` the §6.3 identity for
  // SET_VARIATION and the variation-in-use register; `tuningText` the §6.2 text
  // the cifra.md §8.5 ops parse to address a block.
  const tuningId = instrument ? openMidis(instrument).join(' ') : '';
  const tuningText = entry?.tuning ?? '';

  const model = text ? parse(text, dialect) : null;
  const reading = songSlice?.[bookId]?.[path] ?? { variations: {} };
  const variation = reading.variations?.[tuningId] ?? '';
  const variationName = (v) => (v === '' ? t('arrange.variationDefault') : v);

  const planners = instrument ? plannersFor(instrument) : [];

  // The plan, computed in memory for the preview — never written here (Decision
  // 2). `existing` lets the engine report which planned shapes the song already
  // has, so the "would change" count is right.
  const existing = model ? existingFor(model, tuningText, variation) : new Map();
  let planResult = null;
  if (model && instrument && plannerId) {
    try {
      planResult = planVoicings(plannerId, model, instrument, { dialect, existing, choices });
    } catch {
      planResult = null;
    }
  }

  // Whether the variation in use already holds choices: the branch that decides
  // *new / over* vs writing straight in (Workflow 5 L70-72, Decision 3).
  const needsChoice = model ? inUseHasChoices(model, tuningText, variation) : false;

  // The preview shapes: one diagram per distinct chord, the fingering built from
  // the planner's frets exactly as the song will carry it.
  const previewShapes = [];
  if (planResult) {
    const seen = new Set();
    for (const [at, frets] of planResult.shapes) {
      const line = planResult.reading.line[at];
      if (!line || line.ref.key == null || seen.has(line.ref.key)) continue;
      const fingering = line.chord ? fingeringFromFrets(frets, line.chord, instrument) : null;
      if (!fingering) continue;
      seen.add(line.ref.key);
      previewShapes.push({ key: line.ref.key, symbol: line.ref.symbol, chord: line.chord, fingering });
    }
  }

  const total = planResult ? planResult.shapes.size : 0;
  const changed = planResult ? total - planResult.unchanged.length : 0;
  const missingList = planResult
    ? [...new Set(planResult.missing.map((at) => planResult.reading.line[at]?.ref.symbol).filter(Boolean))]
    : [];

  const choosePolicy = (id) => {
    setPlannerId(id);
    setChoices(optionDefaults(plannerById(id)));
  };

  const selectVariation = (next) =>
    store.send(
      command(CommandKind.SET_VARIATION, {
        bookId,
        path,
        tuning: tuningId,
        variation: next,
        author: LOCAL_IDENTITY,
      }),
    );

  // Persist a mutated model: canonicalise and write it to the working copy
  // (unsaved). `write` refuses a model that would hold a marker line (§8.1); the
  // plan never produces one, so a throw is swallowed rather than crashing.
  const persist = (doc) => {
    let out;
    try {
      out = write(doc);
    } catch {
      return false;
    }
    store.send(command(CommandKind.WRITE, { bookId, path, text: out }));
    return true;
  };

  // Write the plan and return to arrange (Decision 4). *Into a new variation*
  // creates the block (its name refused inline on a duplicate, via
  // `addVariation`'s throw — Decision 6) then switches the personal register to
  // it; *over this one*, and the no-choices shortcut, write into the variation in
  // use. Either way it is an ordinary unsaved working-copy edit.
  const writePlan = () => {
    if (!model || !planResult) return;
    const doc = parse(text, dialect);
    if (needsChoice && choice === 'new') {
      const name = varName.trim();
      if (!name) {
        setVarError(t('arrange.variationNeedsName'));
        return;
      }
      let next;
      try {
        next = planIntoNewVariation(doc, planResult, { tuning: tuningText, name });
      } catch {
        setVarError(t('arrange.variationTaken', { name }));
        return;
      }
      if (!persist(next)) return;
      selectVariation(name);
    } else {
      if (!persist(applyPlan(doc, planResult, { tuning: tuningText, variation }))) return;
    }
    onBack();
  };

  const header = (
    <div className="wizard-head">
      <span className="t-h3 wizard-eyebrow">{t('wizard.open')}</span>
      {stage === 'policy' ? (
        <>
          <h1 className="t-h1">{t('wizard.title')}</h1>
          <p className="t-small">{t('wizard.help')}</p>
        </>
      ) : needsChoice ? (
        <>
          <h1 className="t-h1">{t('wizard.planReady')}</h1>
          <p className="t-small">{t('wizard.planReadyPrompt', { variation: variationName(variation) })}</p>
        </>
      ) : (
        <h1 className="t-h1">{t('wizard.previewTitle')}</h1>
      )}
    </div>
  );

  // Step one: the policy list — a focusable group of toggle options (role=group,
  // not a list of buttons: [[role-list-of-rac-buttons-fails-axe]]). Each policy
  // carries its name and text, a *How it works* disclosure, and its citations;
  // the choro's stylistic question appears under it once it is chosen.
  const policyStep = (
    <div className="wizard-policies" role="group" aria-label={t('wizard.policyLabel')}>
      {planners.map((p) => {
        const on = plannerId === p.id;
        const steps = tr(['wizard', 'planners', p.id, 'how']) ?? [];
        return (
          <div key={p.id} className={`card pad wizard-policy${on ? ' on' : ''}`}>
            <Button
              className="wizard-policy-choose"
              aria-pressed={on}
              aria-label={t(`wizard.planners.${p.id}.name`)}
              onPress={() => choosePolicy(p.id)}
            >
              <span className={`check${on ? ' on' : ''}`} aria-hidden="true">
                {on ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                ) : null}
              </span>
              <span className="wizard-policy-text">
                <span className="t-h2">{t(`wizard.planners.${p.id}.name`)}</span>
                <span className="t-small">{t(`wizard.planners.${p.id}.text`)}</span>
              </span>
            </Button>
            <Disclosure className="wizard-how">
              <Heading className="wizard-how-heading">
                <Button slot="trigger" className="wizard-how-trigger t-small">
                  {t('wizard.how')}
                </Button>
              </Heading>
              <DisclosurePanel className="wizard-how-panel">
                <p className="t-small wizard-how-title">{t('wizard.howTitle')}</p>
                <ol className="wizard-how-steps">
                  {steps.map((step, i) => (
                    <li key={i} className="t-small">
                      {step}
                    </li>
                  ))}
                </ol>
                <Sources ids={p.sources} />
              </DisclosurePanel>
            </Disclosure>
            {on && p.options?.length
              ? p.options.map((opt) => {
                  const base = `wizard.planners.${p.id}.options.${opt.id}`;
                  return (
                    <RadioGroup
                      key={opt.id}
                      className="wizard-option"
                      value={choices[opt.id] ?? opt.default}
                      onChange={(v) => setChoices((c) => ({ ...c, [opt.id]: v }))}
                      aria-label={t(`${base}.label`)}
                    >
                      <span className="t-small wizard-option-label">{t(`${base}.label`)}</span>
                      {opt.values.map((val) => (
                        <Radio key={val} className="wizard-option-radio" value={val}>
                          <span className="check" aria-hidden="true" />
                          <span className="wizard-option-text">
                            <span>{t(`${base}.values.${val}`)}</span>
                            <span className="t-small">{t(`${base}.rules.${val}`)}</span>
                          </span>
                        </Radio>
                      ))}
                    </RadioGroup>
                  );
                })
              : null}
          </div>
        );
      })}
      {planners.length === 0 ? (
        <p className="t-small" role="status">
          {t('wizard.help')}
        </p>
      ) : null}
    </div>
  );

  // The preview: the diagrams the song will carry, a "{n} of {m} would change"
  // line (or the nothing-changes state), and the chords it could not voice.
  const previewSection =
    stage === 'preview' ? (
      <section className="wizard-preview" aria-label={t('wizard.previewTitle')}>
        {total > 0 && changed === 0 ? (
          <p className="t-small wizard-summary" role="status">
            {t('wizard.nothing')}
          </p>
        ) : null}
        {changed > 0 ? (
          <p className="t-small wizard-summary" role="status">
            {t('wizard.summary', { count: changed, total })}
          </p>
        ) : null}
        {missingList.length ? (
          <p className="t-small wizard-missing" role="status">
            {t('wizard.missing', { list: missingList.join(', ') })}
          </p>
        ) : null}
        <div className="shapes wizard-shapes">
          {previewShapes.map((s) => (
            <ChordDiagram
              key={s.key}
              fingering={s.fingering}
              kind="song"
              context={{ chord: s.chord, dialect, instrument }}
            />
          ))}
        </div>
      </section>
    ) : null;

  // Step two's decision, when the variation in use already has choices: *into a
  // new variation* (first, named) or *over this one* — a radiogroup, never a list
  // of buttons (accessibility; [[role-list-of-rac-buttons-fails-axe]]).
  const choiceSection =
    stage === 'preview' && needsChoice ? (
      <RadioGroup
        className="wizard-choice"
        value={choice}
        onChange={setChoice}
        aria-label={t('wizard.choiceLabel')}
      >
        <div className={`card pad wizard-choice-card${choice === 'new' ? ' on' : ''}`}>
          <Radio value="new" className="wizard-choice-radio">
            <span className="check" aria-hidden="true" />
            <span className="wizard-choice-text">
              <span className="t-h2">{t('wizard.newVariation')}</span>
              <span className="t-small">{t('wizard.newVariationHint', { variation: variationName(variation) })}</span>
            </span>
          </Radio>
          {choice === 'new' ? (
            <TextField
              className="field wizard-name"
              value={varName}
              onChange={(v) => {
                setVarName(v);
                setVarError(null);
              }}
              isInvalid={Boolean(varError)}
            >
              <Label>{t('arrange.variationName')}</Label>
              <Input className="input" placeholder={t('arrange.variationPlaceholder')} />
              {varError ? (
                <span className="t-small wizard-field-error" role="alert">
                  {varError}
                </span>
              ) : null}
            </TextField>
          ) : null}
        </div>
        <div className={`card pad wizard-choice-card${choice === 'over' ? ' on' : ''}`}>
          <Radio value="over" className="wizard-choice-radio">
            <span className="check" aria-hidden="true" />
            <span className="wizard-choice-text">
              <span className="t-h2">{t('wizard.over', { variation: variationName(variation) })}</span>
              <span className="t-small">{t('wizard.overHint')}</span>
            </span>
          </Radio>
        </div>
      </RadioGroup>
    ) : null;

  const actions = (
    <div className="wizard-actionbar wizard-chrome">
      {stage === 'policy' ? (
        <Button className="btn primary grow" isDisabled={!plannerId} onPress={() => setStage('preview')}>
          {t('wizard.preview')}
        </Button>
      ) : (
        <>
          <Button className="btn grow" onPress={() => setStage('policy')}>
            {t('wizard.back')}
          </Button>
          <Button className="btn primary grow" onPress={writePlan}>
            {t('wizard.write')}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className={`screen wizard-screen${mode === 'wide' ? ' wizard-wide' : ''}`}>
      <div className="appbar wizard-chrome">
        <Button className="btn icon" aria-label={t('wizard.cancel')} onPress={onBack}>
          <CloseIcon />
        </Button>
        <span className="title">{model?.title ?? path}</span>
      </div>
      <div className="scroll wizard-scroll">
        <div className="wizard-body">
          <div className="wizard-controls">
            {header}
            {stage === 'policy' ? policyStep : choiceSection}
            {stage === 'preview' ? (
              <p className="t-small wizard-editnote">{t('wizard.editNote')}</p>
            ) : null}
          </div>
          <div className="wizard-preview-col">{previewSection}</div>
        </div>
      </div>
      {actions}
    </div>
  );
}

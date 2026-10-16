// SongArrange — the arrange surface (songs.arrange, workflow 5; board W05). The
// mode entered from the reading view's `onArrange` seam: it turns the song's
// chords into things to tap, and choosing a shape writes it into the voicing
// block for the instrument's tuning and the variation in use. A full-screen
// surface AppShell mounts over reading (ephemeral view state, no router —
// mirroring `openSong`), with **Done** returning to reading; the working copy's
// unsaved edit stays (Decision 1).
//
// The view is the only React layer and composes the pure core exactly as reading
// does — parse → resolveSongVoicings → <Chart>/<ChordDiagram> — and, for each
// choice, parses the working text, applies the relevant `cifra-md` §8.5 edit op,
// runs the canonical `write`, and persists through the existing `WRITE` command
// (Decision 2). The Worker owns durability; the view never touches IndexedDB or
// git (DIRECTION §3.7). WRITE is silent, so the surface holds the current text in
// local state seeded from the `source` slice and re-renders from it.
//
// Arrange reads and writes the written model at offset 0: reading suppresses the
// seam while transposed, and a voicing is for the chord as written (§7.6,
// Decision 8). *Which variation is in use* is personal state (SET_VARIATION, the
// home book); a shape chosen into the song is shared content (WRITE, the book
// working copy) — the two writes land in different stores by design (§3.2).

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
} from 'react-aria-components';
import {
  parse,
  write,
  addVariation,
  chooseShapeForKey,
  chooseShapeForOccurrence,
  chooseShapes,
} from 'cifra-md';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import { inUseEntry } from '../instruments/InstrumentChip.jsx';
import { chipLabel } from '../instruments/instrument-helpers.js';
import { instrumentInstance, openMidis } from '../core/instrument.js';
import { resolveSongVoicings } from '../core/voicings.js';
import { songVariations } from '../core/song-variations.js';
import { parseChord } from '../core/notation/parse.js';
import { speakChord } from '../render/chord-speech.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';
import { searchFingerings } from '../core/search.js';
import Chart from '../chart/Chart.jsx';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import FingeringGroups from '../music/FingeringGroups.jsx';
import EnterShape from '../music/EnterShape.jsx';
import { groupViewModel, spokenShorthand } from '../music/fingering-groups.js';
import { chartChordList } from './reading-view.js';
import { occurrenceAt, unchosenPlan, toShape } from './arrange-choices.js';
import './arrange.css';

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

// The warning triangle on the "only here" notice (aria-hidden; the word carries
// the status — mockups README line 26).
function WarnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="arrange-warn-icon">
      <path d="M12 3l10 18H2zM12 10v5M12 18h.01" />
    </svg>
  );
}

export default function SongArrange({
  store,
  bookId,
  path,
  mode = 'narrow',
  onBack = () => {},
  onRunWizard = () => {},
  autoFocusWizard = false,
  onWizardFocusReturned = () => {},
}) {
  // When arrange re-mounts on the wizard's close (its destination lives over this
  // surface, which unmounts while the wizard is up — songs.wizard_ui), send focus
  // back to the Run-the-wizard button that opened it, a fresh node after the
  // re-mount. One-shot on mount; the shell clears the flag once honoured.
  const wizardButtonRef = useRef(null);
  useEffect(() => {
    if (autoFocusWizard && wizardButtonRef.current) {
      wizardButtonRef.current.focus();
      onWizardFocusReturned();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Bring the song in on mount (idempotent — reading already opened it): the text
  // to parse (OPEN_SOURCE) and the reading state for the variation in use
  // (OPEN_SONG). The Worker owns both; the view only asks.
  useEffect(() => {
    if (!bookId || !path) return;
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    store.send(command(CommandKind.OPEN_SONG, { bookId, path }));
  }, [store, bookId, path]);

  const sourceSlice = useSlice(store, 'source');
  const songSlice = useSlice(store, 'song');
  const instrumentsSlice = useSlice(store, 'instruments');
  const preferences = useSlice(store, 'preferences');

  const sourceText = sourceSlice?.[bookId]?.[path]?.text ?? '';
  // The working text the surface renders from. WRITE is silent, so after a choice
  // the local `edited` text is authoritative (Decision 2); until the first edit
  // it falls through to the `source` slice the Worker surfaced. The surface is
  // mounted for one song (AppShell re-mounts it per arrange session), so there is
  // no open-song change to reset across — no seeding effect, no setState churn.
  const [edited, setEdited] = useState(null);
  const text = edited ?? sourceText;

  const [picker, setPicker] = useState(null); // { occurrence, symbol, index, key } | null
  const [scope, setScope] = useState('key'); // 'key' = every Cm, 'here' = only here
  const [addVarOpen, setAddVarOpen] = useState(false);
  const [varName, setVarName] = useState('');
  const [varCopy, setVarCopy] = useState(true);
  const [varError, setVarError] = useState(null);

  const dialect = preferences?.notation?.value ?? DEFAULT_DIALECT;
  const entry = inUseEntry(instrumentsSlice);
  const config = entry?.config ?? null;
  const instrumentLabel = chipLabel(entry) || t('search.instrument');

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
  // Two tunings, by design: `tuningId` is the §6.3 identity (open-string MIDIs,
  // the key the personal variation-in-use register and the resolver use);
  // `tuningText` is the readable pitch text (`entry.tuning`) the `cifra-md` §8.5
  // ops parse to address a block. They resolve to the same block id.
  const tuningId = instrument ? openMidis(instrument).join(' ') : '';
  const tuningText = entry?.tuning ?? '';

  // The written model at offset 0 (no transpose, Decision 8) and the three-level
  // resolution of every chord, honouring the song's own voicings.
  const model = text ? parse(text, dialect) : null;
  const reading = songSlice?.[bookId]?.[path] ?? { variations: {} };
  const variation = reading.variations?.[tuningId] ?? '';
  const variations = model && tuningId ? songVariations(model, tuningId) : [];

  const resolved =
    instrument && model
      ? resolveSongVoicings(model, instrument, { variation, shapes: entry?.shapes ?? [] })
      : new Map();
  const chordList = model ? chartChordList(model) : [];
  const symbolByKey = new Map(chordList.map((c) => [c.key, c.symbol]));
  const shapes = [...resolved.entries()].map(([key, v]) => ({
    key,
    symbol: symbolByKey.get(key) ?? key,
    source: v.source,
    fingering: v.fingering,
  }));
  const anyUnchosen = shapes.some((s) => s.source !== 'song');
  const tuningShapes = (entry?.shapes ?? []).filter((s) => s.tuning === entry?.tuning);

  // Persist a mutated model: canonicalise, re-render from the result, and write
  // it to the working copy (unsaved). `write` refuses a model that would hold a
  // marker line (§8.1) — arrange never produces one, so a throw is swallowed and
  // the choice is dropped rather than crashing the surface.
  const persist = (doc) => {
    let out;
    try {
      out = write(doc);
    } catch {
      return false;
    }
    setEdited(out);
    store.send(command(CommandKind.WRITE, { bookId, path, text: out }));
    return true;
  };

  const openPicker = (address) => {
    const info = occurrenceAt(model, address);
    if (!info) return;
    setScope('key');
    setPicker(info);
  };

  // Choose a shape for the picker's chord, at the current scope: a key choice
  // sets every occurrence (§8.5.2), "only here" just this one (§8.5.1).
  const applyChoice = (fingering) => {
    if (!model || !picker) return;
    const shape = toShape(fingering);
    const doc = parse(text, dialect);
    const next =
      scope === 'here'
        ? chooseShapeForOccurrence(doc, picker.occurrence, tuningText, variation, shape)
        : chooseShapeForKey(doc, { symbol: picker.symbol, index: picker.index }, tuningText, variation, shape);
    persist(next);
    setPicker(null);
  };

  // Choose these for every unchosen chord: one §8.5.4 batch of every unchosen
  // occurrence at its shown fallback shape (Workflow 5 L52-61).
  const chooseEveryUnchosen = () => {
    if (!model) return;
    const plan = unchosenPlan(model, resolved, dialect);
    if (!plan.length) return;
    persist(chooseShapes(parse(text, dialect), plan, tuningText, variation));
  };

  const selectVariation = (next) =>
    store.send(
      command(CommandKind.SET_VARIATION, {
        bookId,
        path,
        tuning: tuningId,
        variation: next,
      }),
    );

  const closeAddVar = () => {
    setAddVarOpen(false);
    setVarName('');
    setVarCopy(true);
    setVarError(null);
  };

  // Add a variation: write its block (empty, or a copy of the one in use) to the
  // song, then set it in use so subsequent choices land in it (Decision 7). A
  // name already used throws from `addVariation` and surfaces as an inline field
  // error — a word, never colour alone.
  const submitAddVar = () => {
    const name = varName.trim();
    if (!name) {
      setVarError(t('arrange.variationNeedsName'));
      return;
    }
    // Copy only from a variation whose block actually exists; otherwise start
    // empty (a song with no block for this tuning has nothing to copy).
    const copyFrom = varCopy && variations.includes(variation) ? variation : undefined;
    let next;
    try {
      next = addVariation(parse(text, dialect), tuningText, name, copyFrom);
    } catch {
      setVarError(t('arrange.variationTaken', { name }));
      return;
    }
    if (!persist(next)) return;
    selectVariation(name);
    closeAddVar();
  };

  const variationName = (v) => (v === '' ? t('arrange.variationDefault') : v);

  // The picker's candidate shapes: the search, ranked and grouped by the core,
  // never re-sorted here (Decision 6).
  const pickerChord = picker ? parseChord(picker.symbol, dialect).chord : null;
  const pickerResult = pickerChord && instrument ? searchFingerings(pickerChord, instrument, config, {}) : null;
  const pickerGroups = pickerResult ? groupViewModel(pickerResult, { chord: pickerChord, shapes: tuningShapes }) : null;
  const pickerContext = pickerChord && instrument ? { chord: pickerChord, dialect, instrument } : null;
  const pickerSection = picker ? model?.sections?.[picker.occurrence.section]?.name : null;

  // The per-candidate "choose" action FingeringGroups renders beside each shape
  // (its ranking/grouping untouched): a labelled press target (chord + shorthand,
  // the mockup's aria-label), writing at the picker's current scope.
  const chooseAction = ({ fingering }) => (
    <Button
      className="btn arrange-choose"
      aria-label={t('arrange.chooseShapeLabel', {
        chord: picker.symbol,
        shorthand: spokenShorthand(fingering.shorthand),
      })}
      onPress={() => applyChoice(fingering)}
    >
      {t('arrange.choose')}
    </Button>
  );

  // Enter a shape by hand, reused with its primary action configured to "Choose
  // this shape" (not the explorer's star — Decision 6); it writes at the picker's
  // current scope.
  const enterPrimary = picker
    ? {
        label: t('arrange.chooseShape'),
        icon: null,
        ariaLabel: (fingering) =>
          t('arrange.chooseShapeLabel', {
            chord: picker.symbol,
            shorthand: fingering ? spokenShorthand(fingering.shorthand) : '',
          }),
        onChoose: (fingering) => applyChoice(fingering),
        triggerName: t('arrange.enterShape'),
        triggerMeta: null,
        title: t('arrange.enterShapeTitle', { chord: picker.symbol }),
      }
    : null;

  // A tappable chord's accessible name is its §3 spoken name (shell.a11y_chart;
  // docs/screen-reader.md §3), so a keyboard user hears "E minor", not the glyph
  // spelled out. Routed through the same `speakChord` the reading chart uses.
  const chordLabel = (token) => {
    const parsed = parseChord(token.symbol, dialect).chord;
    return parsed ? speakChord(parsed, { notation: dialect, t }) : token.symbol;
  };

  const variationSelector =
    variations.length > 1 ? (
      <div className="arrange-variation-row">
        <span className="t-h3">{t('arrange.variationLabel')}</span>
        <div className="seg" role="group" aria-label={t('arrange.variationLabel')}>
          {variations.map((v) => (
            <Button
              key={v || 'default'}
              className={v === variation ? 'on' : ''}
              aria-pressed={v === variation}
              onPress={() => selectVariation(v)}
            >
              {variationName(v)}
            </Button>
          ))}
          <Button onPress={() => setAddVarOpen(true)}>{t('arrange.newVariation')}</Button>
        </div>
        <span className="t-small">{t('arrange.selectorCaption', { instrument: instrumentLabel })}</span>
      </div>
    ) : null;

  const shapesStrip = shapes.length ? (
    <section className="arrange-shapes" aria-label={t('arrange.shapes')}>
      <h2 className="t-h3">{t('arrange.shapes')}</h2>
      <div className="shapes">
        {shapes.map((s) => (
          <ChordDiagram
            key={s.key}
            fingering={s.fingering}
            kind={s.source}
            context={{ chord: parseChord(s.symbol, dialect).chord, dialect, instrument }}
          />
        ))}
      </div>
      {anyUnchosen ? <p className="t-small">{t('arrange.shapesCaption')}</p> : null}
    </section>
  ) : null;

  return (
    <div className={`screen arrange-screen${mode === 'wide' ? ' arrange-wide' : ''}`}>
      <div className="appbar arrange-chrome">
        {mode === 'wide' ? null : (
          <Button className="btn icon" aria-label={t('arrange.back')} onPress={onBack}>
            <BackIcon />
          </Button>
        )}
        <span className="title">{model?.title ?? path}</span>
        <span className="chip accent">{t('arrange.modeChip', { instrument: instrumentLabel })}</span>
        <Button className="btn primary" onPress={onBack}>
          {t('arrange.done')}
        </Button>
      </div>

      <div className="scroll arrange-scroll">
        <p className="t-small arrange-hint">{t('arrange.modeHint')}</p>
        {variationSelector}
        <div className="arrange-body">
          {model ? (
            <Chart
              model={model}
              size={mode === 'wide' ? 20 : undefined}
              label={model.title ?? undefined}
              markOf={() => 'tap'}
              onChordPress={openPicker}
              chordLabel={chordLabel}
            />
          ) : null}
          {shapesStrip}
        </div>
        <Button className="btn block" isDisabled={!anyUnchosen} onPress={chooseEveryUnchosen}>
          {t('arrange.chooseEveryUnchosen')}
        </Button>
      </div>

      <div className="arrange-actionbar arrange-chrome">
        <Button ref={wizardButtonRef} className="btn grow" onPress={() => onRunWizard({ bookId, path })}>
          {t('arrange.runWizard')}
        </Button>
        <Button className="btn grow" onPress={() => setAddVarOpen(true)}>
          {t('arrange.variations')}
        </Button>
      </div>

      {/* The picker — a bottom sheet (narrow) or a centred panel (wide). Controlled
          so a chord press opens it and Escape / scrim / Done closes it; RAC
          restores focus to the chord on close. */}
      <ModalOverlay
        className={`scrim${mode === 'wide' ? ' center' : ''}`}
        isOpen={picker != null}
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
        isDismissable
      >
        <Modal className="sheet arrange-sheet">
          <Dialog className="arrange-picker" aria-label={picker ? t('arrange.pickerLabel', { chord: picker.symbol }) : undefined}>
            {picker ? (
              <>
                <div className="grip" />
                <div className="arrange-picker-head">
                  <Heading slot="title" className="t-h1">
                    {picker.symbol}
                  </Heading>
                  {pickerSection ? <span className="t-small">{pickerSection}</span> : null}
                </div>
                <div className="seg arrange-scope" role="group" aria-label={t('arrange.scopeLabel')}>
                  <Button
                    className={scope === 'key' ? 'on' : ''}
                    aria-pressed={scope === 'key'}
                    onPress={() => setScope('key')}
                  >
                    {t('arrange.everyChord', { chord: picker.symbol })}
                  </Button>
                  <Button
                    className={scope === 'here' ? 'on' : ''}
                    aria-pressed={scope === 'here'}
                    onPress={() => setScope('here')}
                  >
                    {t('arrange.onlyHere')}
                  </Button>
                </div>
                {scope === 'here' ? (
                  <div className="notice unsaved arrange-onlyhere">
                    <WarnIcon />
                    <span>{t('arrange.onlyHereWarning')}</span>
                  </div>
                ) : null}
                <div className="list">
                  <EnterShape
                    instrument={instrument}
                    chord={pickerChord}
                    chordSymbol={picker.symbol}
                    dialect={dialect}
                    primary={enterPrimary}
                  />
                </div>
                {pickerGroups && pickerGroups.length ? (
                  <FingeringGroups groups={pickerGroups} context={pickerContext} renderAction={chooseAction} />
                ) : (
                  <p className="t-small" role="status">
                    {t('arrange.noShapes', { chord: picker.symbol, instrument: instrumentLabel })}
                  </p>
                )}
              </>
            ) : null}
          </Dialog>
        </Modal>
      </ModalOverlay>

      {/* Add a variation (Decision 7). */}
      <ModalOverlay
        className="scrim center"
        isOpen={addVarOpen}
        onOpenChange={(open) => {
          if (!open) closeAddVar();
        }}
        isDismissable
      >
        <Modal className="dialog arrange-addvar">
          <Dialog className="arrange-addvar-dialog">
            <Heading slot="title" className="t-h2">
              {t('arrange.addVariationTitle')}
            </Heading>
            <TextField
              className="field"
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
                <span className="t-small arrange-field-error" role="alert">
                  {varError}
                </span>
              ) : null}
            </TextField>
            {variations.includes(variation) ? (
              <Checkbox className="arrange-copy" isSelected={varCopy} onChange={setVarCopy}>
                <span className="arrange-copy-box" aria-hidden="true" />
                <span>{t('arrange.variationCopy', { name: variationName(variation) })}</span>
              </Checkbox>
            ) : null}
            <div className="actions">
              <Button className="btn" onPress={closeAddVar}>
                {t('arrange.addVariationCancel')}
              </Button>
              <Button className="btn primary" onPress={submitAddVar}>
                {t('arrange.addVariationConfirm')}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
}

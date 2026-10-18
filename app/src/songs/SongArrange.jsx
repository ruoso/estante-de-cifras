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
//
// As drawn (songs.arrange_polish; board W05): the header's one chip is the
// instrument chip carrying the mode (*Arranging · Guitar*, Decision 1), opening
// the instruments as reading's does; *Enter a shape* is a screen of the mode —
// not a dialog over the picker — that replaces arrange's body under its own app
// bar (Decision 2), with the shared `ShapeBuilder` naming each note's part in the
// chord. Back and Cancel return to the picker as it was; *Choose this shape*
// writes as a listed candidate does and returns focus to the chord.

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
import InstrumentChip, { inUseEntry } from '../instruments/InstrumentChip.jsx';
import InstrumentsOverlay from '../instruments/InstrumentsOverlay.jsx';
import { chipLabel } from '../instruments/instrument-helpers.js';
import { instrumentInstance, openMidis } from '../core/instrument.js';
import { resolveSongVoicings } from '../core/voicings.js';
import { songVariations } from '../core/song-variations.js';
import { parseChord } from '../core/notation/parse.js';
import { speakChord } from '../render/chord-speech.js';
import { DEFAULT_DIALECT, songDialect } from '../core/notation/dialects.js';
import { searchFingerings } from '../core/search.js';
import Chart from '../chart/Chart.jsx';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import FingeringGroups from '../music/FingeringGroups.jsx';
import { ShapeBuilder } from '../music/EnterShape.jsx';
import { PlusIcon } from '../music/icons.jsx';
import { groupViewModel, spokenShorthand } from '../music/fingering-groups.js';
import { chartChordList } from './reading-view.js';
import { occurrenceAt, unchosenPlan, toShape } from './arrange-choices.js';
import './arrange.css';

// The bar an occurrence sits in, as the chart numbers it (cifra.md's measure
// `number`), for the enter-a-shape screen's context line.
function barNumber(model, occurrence) {
  const { section, part, line, measure } = occurrence;
  return model?.sections?.[section]?.body?.[part]?.lines?.[line]?.measures?.[measure]?.number ?? null;
}

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

// The enter-a-shape screen's frame (W05#3): its own app bar — Back, the title as
// the screen's heading, and the instrument named in chip styling but not a
// switch (Decision 3) — the context line and the board's help, then the builder.
// The heading takes focus on arrival so the screen announces itself.
function EnterShapeScreen({ title, instrumentLabel, context, onBack, children }) {
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <>
      <div className="appbar arrange-chrome">
        <Button className="btn icon" aria-label={t('arrange.back')} onPress={onBack}>
          <BackIcon />
        </Button>
        <h1 ref={headingRef} tabIndex={-1} className="title arrange-enter-title">
          {title}
        </h1>
        <span className="chip accent arrange-mention">{instrumentLabel}</span>
      </div>
      <div className="scroll arrange-enter-scroll">
        <p className="t-small arrange-enter-context">
          <span className="arrange-enter-place">{context}.</span>
          {' '}
          <span>{t('explorer.enter.help')}</span>
        </p>
        {children}
      </div>
    </>
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
  // The enter-a-shape screen (Decision 2): the picker's occurrence and scope it
  // was opened from, so Back / Cancel reopen the picker as it was.
  const [entering, setEntering] = useState(null); // { picker, scope } | null
  // Focus goes to the *Enter a shape* row when the picker reopens from the screen.
  const [focusEnterRow, setFocusEnterRow] = useState(false);
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
  // The chord that opened the picker: focus returns to it from the screen (its
  // node stays mounted, hidden, while the screen shows).
  const chordRef = useRef(null);
  const enterRowRef = useRef(null);
  // Reopened from the screen, the picker puts focus on the *Enter a shape* row
  // (after the dialog's own autofocus, which runs first as a child effect).
  useEffect(() => {
    if (focusEnterRow && picker) enterRowRef.current?.focus();
  }, [focusEnterRow, picker]);

  const dialect = preferences?.notation?.value ?? DEFAULT_DIALECT;
  const entry = inUseEntry(instrumentsSlice);
  const config = entry?.config ?? null;
  // The Worker always sends the standard entry, so once the slice is loaded
  // there is an instrument to name; the chip renders only then.
  const instrumentLabel = chipLabel(entry);

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
  // resolution of every chord, honouring the song's own voicings. The chart is
  // read in the song's own notation (cifra.md §5.6); `dialect`, the preference,
  // only spells chords for this user (the picker, the diagram, speech).
  const model = text ? parse(text) : null;
  const notation = songDialect(model);
  const reading = songSlice?.[bookId]?.[path] ?? { variations: {} };
  const variation = reading.variations?.[tuningId] ?? '';
  const variations = model && tuningId ? songVariations(model, tuningId) : [];

  const resolved =
    instrument && model
      ? resolveSongVoicings(model, instrument, { variation, shapes: entry?.shapes ?? [], dialect: notation })
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
    const active = globalThis.document?.activeElement;
    chordRef.current = active && active !== globalThis.document.body ? active : null;
    setScope('key');
    setFocusEnterRow(false);
    setPicker(info);
  };

  // Choose a shape for the picker's chord, at the current scope: a key choice
  // sets every occurrence (§8.5.2), "only here" just this one (§8.5.1).
  const applyChoice = (fingering, target = picker, at = scope) => {
    if (!model || !target) return;
    const shape = toShape(fingering);
    const doc = parse(text);
    const next =
      at === 'here'
        ? chooseShapeForOccurrence(doc, target.occurrence, tuningText, variation, shape)
        : chooseShapeForKey(doc, { symbol: target.symbol, index: target.index }, tuningText, variation, shape);
    persist(next);
    setPicker(null);
  };

  // *Enter a shape*: close the picker and open the screen on the same occurrence
  // and scope.
  const enterShape = () => {
    setEntering({ picker, scope });
    setFocusEnterRow(false);
    setPicker(null);
  };

  // Back / Cancel: arrange again, the picker reopened as it was. The chord is
  // focused first (synchronously, once visible) so the reopened picker returns
  // focus to it when it closes; inside the picker focus lands on the row.
  const leaveEntering = () => {
    const back = entering;
    flushSync(() => setEntering(null));
    chordRef.current?.focus?.();
    setScope(back.scope);
    setFocusEnterRow(true);
    setPicker(back.picker);
  };

  // *Choose this shape*: write it as a listed candidate is written, at the scope
  // the picker had, then arrange with the picker closed and focus on the chord.
  const chooseEntered = (fingering) => {
    const { picker: target, scope: at } = entering;
    applyChoice(fingering, target, at);
    flushSync(() => setEntering(null));
    chordRef.current?.focus?.();
  };

  // Choose these for every unchosen chord: one §8.5.4 batch of every unchosen
  // occurrence at its shown fallback shape (Workflow 5 L52-61).
  const chooseEveryUnchosen = () => {
    if (!model) return;
    const plan = unchosenPlan(model, resolved, notation);
    if (!plan.length) return;
    persist(chooseShapes(parse(text), plan, tuningText, variation));
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
      next = addVariation(parse(text), tuningText, name, copyFrom);
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
  const pickerChord = picker ? parseChord(picker.symbol, notation).chord : null;
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

  // The shared builder's primary action on the screen: "Choose this shape" (not
  // the explorer's star — songs.arrange Decision 6), labelled with the chord and
  // the shape.
  const enterPrimary = entering
    ? {
        label: t('arrange.chooseShape'),
        icon: null,
        ariaLabel: (fingering) =>
          t('arrange.chooseShapeLabel', {
            chord: entering.picker.symbol,
            shorthand: fingering ? spokenShorthand(fingering.shorthand) : '',
          }),
        onChoose: chooseEntered,
      }
    : null;

  // A tappable chord's accessible name is its §3 spoken name (shell.a11y_chart;
  // docs/screen-reader.md §3), so a keyboard user hears "E minor", not the glyph
  // spelled out. Routed through the same `speakChord` the reading chart uses.
  const chordLabel = (token) => {
    const parsed = parseChord(token.symbol, notation).chord;
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
            context={{ chord: parseChord(s.symbol, notation).chord, dialect, instrument }}
          />
        ))}
      </div>
      {anyUnchosen ? <p className="t-small">{t('arrange.shapesCaption')}</p> : null}
    </section>
  ) : null;

  // The enter-a-shape screen's context line (W05#3 L130): where it applies and
  // how far — *Choro da Chuva · Primeira Parte, bar 3 · only here*.
  const enterContext = (() => {
    if (!entering) return '';
    const { picker: at, scope: how } = entering;
    const params = {
      song: model?.title ?? path,
      section: model?.sections?.[at.occurrence.section]?.name ?? '',
      bar: barNumber(model, at.occurrence) ?? at.occurrence.measure + 1,
      scope: how === 'here' ? t('arrange.scopeHere') : t('arrange.scopeKey', { chord: at.symbol }),
    };
    return params.section ? t('arrange.enterContext', params) : t('arrange.enterContextNoSection', params);
  })();
  const enteringChord = entering ? parseChord(entering.picker.symbol, notation).chord : null;

  return (
    <div className={`screen arrange-screen${mode === 'wide' ? ' arrange-wide' : ''}`}>
      {entering && enteringChord && instrument ? (
        <EnterShapeScreen
          title={t('arrange.enterShapeTitle', { chord: entering.picker.symbol })}
          instrumentLabel={instrumentLabel}
          context={enterContext}
          onBack={leaveEntering}
        >
          <ShapeBuilder
            className="enter-shape-screen"
            instrument={instrument}
            chord={enteringChord}
            chordSymbol={entering.picker.symbol}
            dialect={dialect}
            primary={enterPrimary}
            onCancel={leaveEntering}
            showHelp={false}
            headingLevel={2}
          />
        </EnterShapeScreen>
      ) : null}

      {/* Arrange itself — kept mounted (hidden) while a shape is entered, so the
          chord that opened the picker is there to take focus back. */}
      <div className="arrange-mode" hidden={entering != null}>
        <div className="appbar arrange-chrome">
          {mode === 'wide' ? null : (
            <Button className="btn icon" aria-label={t('arrange.back')} onPress={onBack}>
              <BackIcon />
            </Button>
          )}
          <span className="title">{model?.title ?? path}</span>
          {entry ? (
            <InstrumentChip
              store={store}
              onOpen={() => setInstrumentsOpen(true)}
              labelFor={(label) => t('arrange.modeChip', { instrument: label })}
            />
          ) : null}
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
      </div>

      {/* The picker — a bottom sheet (narrow) or a centred panel (wide). Controlled
          so a chord press opens it and Escape / scrim / Done closes it; RAC
          restores focus to the chord on close. */}
      <ModalOverlay
        className={`scrim${mode === 'wide' ? ' center' : ''}`}
        isOpen={picker != null}
        onOpenChange={(open) => {
          if (!open) {
            setPicker(null);
            setFocusEnterRow(false);
          }
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
                  {/* Arrange's host for the shared builder: a plain row that
                      leaves the picker for the enter-a-shape screen. */}
                  <Button
                    className="row explore enter-shape-trigger"
                    isDisabled={!pickerChord || !instrument}
                    ref={enterRowRef}
                    onPress={enterShape}
                  >
                    <PlusIcon />
                    <span className="grow">
                      <span className="name">{t('arrange.enterShape')}</span>
                    </span>
                  </Button>
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

      <InstrumentsOverlay store={store} isOpen={instrumentsOpen} onClose={() => setInstrumentsOpen(false)} />

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

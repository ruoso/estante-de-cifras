// InstrumentsOverlay — the instrument surface drawn behind the header chip
// (music.instruments Decision 1): a React Aria overlay holding an in-memory view
// stack — the roster, an instrument's detail (definition, rules, my shapes), the
// add/edit form, the voicing-rules panel, and the remove confirmation. It reads
// the `instruments` slice and sends the per-operation commands through the
// store; it never touches IndexedDB or git (DIRECTION §3.7). Overlays portal into
// the `.est` token root via ThemeRoot's provider ([[rac-overlays-portal-outside-est-theme-root]]).
//
// Drawn as W15 draws it (music.instruments_layout; workflow 15 §Where it sits):
// a full screen on every viewport, one view at a time on the phone and tablet,
// and on a computer the roster as a rail beside the open view.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import AddInstrumentForm from './AddInstrumentForm.jsx';
import VoicingRules from './VoicingRules.jsx';
import MyShapes from './MyShapes.jsx';
import { BackIcon, CloseIcon, PlusIcon } from './icons.jsx';
import {
  catalogName,
  chipLabel,
  displayLabel,
  presetLabel,
  rosterEntries,
} from './instrument-helpers.js';
import { INSTRUMENTS_WIDE_QUERY } from '../shell/layout-mode.js';
import './instruments.css';

// The computer rail (music.instruments_layout Decision 2; see
// `INSTRUMENTS_WIDE_QUERY`). The same `matchMedia`/`useSyncExternalStore` seam
// the account screen uses; a missing `matchMedia` (jsdom) reads as not-wide.
function instrumentsWideQuery() {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia(INSTRUMENTS_WIDE_QUERY)
    : null;
}

function subscribeInstrumentsWide(onChange) {
  const query = instrumentsWideQuery();
  if (!query?.addEventListener) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readInstrumentsWide() {
  return instrumentsWideQuery()?.matches ?? false;
}

function useInstrumentsWide() {
  return useSyncExternalStore(subscribeInstrumentsWide, readInstrumentsWide, readInstrumentsWide);
}

// One instrument on the roster: opens its detail; shows the preset and string
// count, and the word *in use* (a badge, never colour alone) when it is the one
// in use. On the computer rail the open row is the one marked (`sel`,
// `aria-current`, W15 #4); on the phone's roster it is the one in use.
function RosterRow({ entry, inUse, open, rail, onOpen }) {
  const marked = rail ? open : inUse;
  const label = displayLabel(entry);
  const meta = `${presetLabel(entry.presetId)} · ${t('instr.roster.strings', {
    count: entry.stringCount,
  })}`;
  return (
    <Button
      className={`row${marked ? ' sel' : ''}`}
      aria-label={t('instr.roster.open', { label })}
      aria-current={rail && open ? 'true' : undefined}
      onPress={() => onOpen(entry.id)}
    >
      <span className="grow">
        <span className="name">{label}</span>
        <span className="meta">{meta}</span>
      </span>
      {inUse ? <span className="badge ok">{t('instr.roster.inUse')}</span> : null}
    </Button>
  );
}

export default function InstrumentsOverlay({ store, isOpen, onClose }) {
  const slice = useSlice(store, 'instruments');
  // The roster's rows: the built-in standard guitar (while it is not stored)
  // first, then the stored instruments; in use as the chip resolves it
  // (music.instruments_roster_default Decision 1).
  const { entries: instruments, inUseId } = rosterEntries(slice);
  const builtIn = slice?.standard ?? null;
  const wide = useInstrumentsWide();
  // The in-memory view stack: `{ name, id }`. Add carries `from`, the detail the
  // computer's main pane showed before it (where its Cancel returns); a saved
  // add on the computer carries `known`, the ids listed when it was sent, so the
  // main pane opens the new instrument once the Worker lists it.
  const [view, setView] = useState({ name: 'roster', id: null });
  const mainHeading = useRef(null);
  const lastMain = useRef(null);

  const send = (kind, payload) =>
    store.send(command(kind, payload));

  const close = () => {
    setView({ name: 'roster', id: null });
    onClose();
  };

  // The view the computer's main pane or the phone's one screen returns to.
  const toRoster = { name: 'roster', id: null };

  const saveNew = ({ definition, preset }) => {
    send(CommandKind.SAVE_INSTRUMENT, { definition, preset });
    setView(
      wide
        ? { name: 'detail', id: view.from ?? null, known: instruments.map((e) => e.id) }
        : toRoster,
    );
  };
  const saveEdit = ({ id, definition }) => {
    send(CommandKind.SAVE_INSTRUMENT, { id, definition });
    setView({ name: 'detail', id });
  };
  const setRules = (id, rules) => send(CommandKind.SET_INSTRUMENT_RULES, { id, rules });
  // On the computer the rail shows the new *in use* beside the open detail; on
  // the phone and tablet the roster is where it shows (workflow 15 §Where it sits).
  const switchTo = (id) => {
    send(CommandKind.USE_INSTRUMENT, { id });
    if (!wide) setView(toRoster);
  };
  const removeInstrument = (id) => {
    send(CommandKind.REMOVE_INSTRUMENT, { id });
    setView(toRoster);
  };
  const removeShape = (id, tuning, chord) =>
    send(CommandKind.REMOVE_SHAPE, { id, tuning, chord });

  // A saved add on the computer opens the instrument it added, once listed.
  let shown = view;
  if (view.known) {
    const added = instruments.find((e) => !view.known.includes(e.id));
    if (added) shown = { name: 'detail', id: added.id };
  }
  // The entry the detail/rules/edit views are about; falls back to the roster if
  // it is gone (e.g. just removed, or a sync dropped it).
  let current = instruments.find((e) => e.id === shown.id) ?? null;
  let resolved =
    (shown.name === 'detail' || shown.name === 'rules' || shown.name === 'edit') && !current
      ? toRoster
      : shown;
  // On the computer the roster is the rail, so the main pane shows the
  // instrument in use when nothing else is open (W15 #4).
  if (wide && resolved.name === 'roster') {
    current = instruments.find((e) => e.id === inUseId) ?? instruments[0] ?? null;
    resolved = current ? { name: 'detail', id: current.id } : toRoster;
  }
  const openId = resolved.name === 'add' ? null : (current?.id ?? null);
  const openAdd = () => setView({ name: 'add', id: null, from: openId });

  // A rail row, Edit rules, Back or Cancel changes what the main pane holds:
  // focus lands on its heading, so a keyboard user is on what they opened. Not on
  // the first render of an opening, where the dialog places focus itself.
  const mainKey = wide && isOpen ? `${resolved.name}:${resolved.id ?? ''}` : null;
  useEffect(() => {
    if (mainKey && lastMain.current && lastMain.current !== mainKey) {
      mainHeading.current?.focus();
    }
    lastMain.current = mainKey;
  }, [mainKey]);
  const headingProps = wide ? { ref: mainHeading, tabIndex: -1 } : {};

  // The roster: the phone's first screen, the computer's rail. Its Back closes
  // the instruments, as Escape does (workflow 15 §Where it sits).
  const roster = (
    <>
      <div className="appbar">
        <Button className="btn icon" aria-label={t('instr.roster.back')} onPress={close}>
          <BackIcon />
        </Button>
        {wide ? (
          <Heading level={2} className="title">
            {t('instr.roster.title')}
          </Heading>
        ) : (
          <Heading slot="title" className="title">
            {t('instr.roster.title')}
          </Heading>
        )}
        {/* The + leaves while the main pane is the form it opens, so the form's
            submit is the one control named *Add instrument* on screen. */}
        {resolved.name === 'add' || resolved.name === 'edit' ? null : (
          <Button className="btn icon" aria-label={t('instr.roster.add')} onPress={openAdd}>
            <PlusIcon />
          </Button>
        )}
      </div>
      <div className="scroll instr-scroll">
        {instruments.length ? (
          <div className="list">
            {instruments.map((entry) => (
              <RosterRow
                key={entry.id}
                entry={entry}
                inUse={entry.id === inUseId}
                open={entry.id === openId}
                rail={wide}
                onOpen={(id) => setView({ name: 'detail', id })}
              />
            ))}
          </div>
        ) : null}
        <div className="list">
          <Button className="row explore" onPress={openAdd}>
            <PlusIcon />
            <span className="grow">
              <span className="name">{t('instr.roster.add')}</span>
              <span className="meta">{t('instr.roster.addMeta')}</span>
            </span>
          </Button>
        </div>
        <p className="t-small">{t('instr.roster.footer')}</p>
      </div>
    </>
  );

  let main = null;
  if (resolved.name === 'add' || resolved.name === 'edit') {
    const editing = resolved.name === 'edit' ? current : null;
    // The one way out of the form: the bar's ✕ *Cancel* (music.instruments_layout
    // Decision 6), back to where the form was opened from.
    const cancel = () =>
      setView(
        editing
          ? { name: 'detail', id: editing.id }
          : wide && resolved.from
            ? { name: 'detail', id: resolved.from }
            : toRoster,
      );
    main = (
      <>
        <div className="appbar">
          <Button className="btn icon" aria-label={t('instr.add.cancel')} onPress={cancel}>
            <CloseIcon />
          </Button>
          <Heading slot="title" className="title" {...headingProps}>
            {editing ? t('instr.detail.edit') : t('instr.add.title')}
          </Heading>
        </div>
        <div className="scroll instr-scroll">
          <AddInstrumentForm
            editId={editing?.id ?? null}
            initial={
              editing
                ? { catalogId: editing.catalogId, tuning: editing.tuning, label: editing.label }
                : null
            }
            onSubmit={editing ? saveEdit : saveNew}
          />
        </div>
      </>
    );
  } else if (resolved.name === 'rules') {
    main = (
      <>
        <div className="appbar">
          <Button
            className="btn icon"
            aria-label={t('instr.roster.back')}
            onPress={() => setView({ name: 'detail', id: current.id })}
          >
            <BackIcon />
          </Button>
          <Heading slot="title" className="title" {...headingProps}>
            {t('instr.rules.title')}
          </Heading>
          {/* Whose rules these are, as a label in chip styling — not a second chip
              (music.instruments_layout Decision 5). */}
          <span className="chip instr-rules-for">{chipLabel(current)}</span>
        </div>
        <div className="scroll instr-scroll">
          <VoicingRules entry={current} onSetRules={setRules} />
        </div>
      </>
    );
  } else if (resolved.name === 'detail') {
    const entry = current;
    const inUse = entry.id === inUseId;
    const shapeCount = entry.shapes.length;
    // The built-in standard guitar, not yet stored, has nothing to remove — it
    // is what removal falls back to (Decision 3). Once stored it is ordinary.
    const removable = !(builtIn && entry.id === builtIn.id);
    main = (
      <>
        <div className="appbar">
          {/* On the computer the rail is beside it, so it has no Back (W15 #4). */}
          {wide ? null : (
            <Button
              className="btn icon"
              aria-label={t('instr.roster.back')}
              onPress={() => setView(toRoster)}
            >
              <BackIcon />
            </Button>
          )}
          <Heading slot="title" className="title" {...headingProps}>
            {displayLabel(entry)}
          </Heading>
          {inUse ? (
            <span className="badge ok">{t('instr.detail.inUse')}</span>
          ) : (
            <Button className="btn quiet" onPress={() => switchTo(entry.id)}>
              {t('instr.detail.use')}
            </Button>
          )}
        </div>
        <div className="scroll instr-scroll">
          <div className="card pad">
            <div className="instr-card-head">
              <span className="t-h3">{t('instr.detail.definition')}</span>
              <Button
                className="btn quiet"
                onPress={() => setView({ name: 'edit', id: entry.id })}
              >
                {t('instr.detail.edit')}
              </Button>
            </div>
            <div className="instr-def">
              <div className="instr-def-row">
                <span className="k">{t('instr.detail.catalogue')}</span>
                <span>{catalogName(entry.catalogId)}</span>
              </div>
              <div className="instr-def-row">
                <span className="k">{t('instr.detail.tuning')}</span>
                <span className="t-mono instr-tuning">{entry.tuning}</span>
              </div>
              <div className="instr-def-row">
                <span className="k">{t('instr.detail.frets')}</span>
                <span>{entry.fretCount}</span>
              </div>
            </div>
          </div>

          <div className="card pad">
            <div className="instr-card-head">
              <span className="t-h3">{t('instr.detail.voicingRules')}</span>
              <Button
                className="btn quiet"
                onPress={() => setView({ name: 'rules', id: entry.id })}
              >
                {t('instr.detail.editRules')}
              </Button>
            </div>
            <div className="instr-rules-summary">
              <span className="badge">{presetLabel(entry.presetId)}</span>
            </div>
          </div>

          <MyShapes entry={entry} onRemoveShape={removeShape} />

          {removable ? (
            <DialogTrigger>
              <Button className="btn danger instr-remove">{t('instr.detail.remove')}</Button>
              <ModalOverlay className="scrim center" isDismissable>
                <Modal className="dialog">
                  <Dialog role="alertdialog">
                    {({ close: closeConfirm }) => (
                      <>
                        <Heading slot="title" className="t-h2">
                          {t('instr.remove.title', { label: displayLabel(entry) })}
                        </Heading>
                        <p className="t-body instr-remove-body">
                          {/* With no shapes the confirm names only the variations
                              (workflow 15 §Removing) — a separate key, since the
                              plural rules never select `zero` for 0 (Decision 5). */}
                          {shapeCount === 0
                            ? t('instr.remove.bodyNoShapes', { tuning: entry.tuning })
                            : t('instr.remove.body', {
                                shapes: t('instr.remove.shapes', { count: shapeCount }),
                                tuning: entry.tuning,
                              })}
                        </p>
                        <div className="actions">
                          <Button className="btn" onPress={closeConfirm}>
                            {t('instr.remove.cancel')}
                          </Button>
                          <Button
                            className="btn danger"
                            onPress={() => {
                              closeConfirm();
                              removeInstrument(entry.id);
                            }}
                          >
                            {t('instr.remove.confirm')}
                          </Button>
                        </div>
                      </>
                    )}
                  </Dialog>
                </Modal>
              </ModalOverlay>
            </DialogTrigger>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <ModalOverlay
      className="scrim instr-scrim"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      isDismissable
    >
      <Modal className="instr-modal">
        <Dialog className="instr-dialog" aria-label={t('instr.roster.title')}>
          {wide ? (
            <div className="split">
              <div className="pane side">{roster}</div>
              <div className="pane main">{main}</div>
            </div>
          ) : (
            (main ?? roster)
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

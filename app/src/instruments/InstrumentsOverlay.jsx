// InstrumentsOverlay — the instrument surface drawn behind the header chip
// (music.instruments Decision 1): a React Aria overlay holding an in-memory view
// stack — the roster, an instrument's detail (definition, rules, my shapes), the
// add/edit form, the voicing-rules panel, and the remove confirmation. It reads
// the `instruments` slice and sends the per-operation commands through the
// store; it never touches IndexedDB or git (DIRECTION §3.7). Overlays portal into
// the `.est` token root via ThemeRoot's provider ([[rac-overlays-portal-outside-est-theme-root]]).

import { useState } from 'react';
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
import { catalogName, displayLabel, presetLabel, rosterEntries } from './instrument-helpers.js';
import './instruments.css';

// One instrument on the roster: opens its detail; shows the preset and string
// count, and the word *in use* (a badge, never colour alone) when it is the one
// in use.
function RosterRow({ entry, inUse, onOpen }) {
  const label = displayLabel(entry);
  const meta = `${presetLabel(entry.presetId)} · ${t('instr.roster.strings', {
    count: entry.stringCount,
  })}`;
  return (
    <Button
      className={`row${inUse ? ' sel' : ''}`}
      aria-label={t('instr.roster.open', { label })}
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
  const [view, setView] = useState({ name: 'roster', id: null });

  const send = (kind, payload) =>
    store.send(command(kind, payload));

  const close = () => {
    setView({ name: 'roster', id: null });
    onClose();
  };

  const saveNew = ({ definition, preset }) => {
    send(CommandKind.SAVE_INSTRUMENT, { definition, preset });
    setView({ name: 'roster', id: null });
  };
  const saveEdit = ({ id, definition }) => {
    send(CommandKind.SAVE_INSTRUMENT, { id, definition });
    setView({ name: 'detail', id });
  };
  const setRules = (id, rules) => send(CommandKind.SET_INSTRUMENT_RULES, { id, rules });
  const switchTo = (id) => {
    send(CommandKind.USE_INSTRUMENT, { id });
    setView({ name: 'roster', id: null });
  };
  const removeInstrument = (id) => {
    send(CommandKind.REMOVE_INSTRUMENT, { id });
    setView({ name: 'roster', id: null });
  };
  const removeShape = (id, tuning, chord) =>
    send(CommandKind.REMOVE_SHAPE, { id, tuning, chord });

  // The entry the detail/rules/edit views are about; falls back to the roster if
  // it is gone (e.g. just removed, or a sync dropped it).
  const current = instruments.find((e) => e.id === view.id) ?? null;
  const resolved =
    (view.name === 'detail' || view.name === 'rules' || view.name === 'edit') && !current
      ? { name: 'roster', id: null }
      : view;

  let body;
  if (resolved.name === 'roster') {
    body = (
      <>
        <div className="appbar">
          <Button className="btn icon" aria-label={t('instr.roster.close')} onPress={close}>
            <CloseIcon />
          </Button>
          <Heading slot="title" className="title">
            {t('instr.roster.title')}
          </Heading>
          <Button
            className="btn icon"
            aria-label={t('instr.roster.add')}
            onPress={() => setView({ name: 'add', id: null })}
          >
            <PlusIcon />
          </Button>
        </div>
        <div className="scroll instr-scroll">
          {instruments.length ? (
            <div className="list">
              {instruments.map((entry) => (
                <RosterRow
                  key={entry.id}
                  entry={entry}
                  inUse={entry.id === inUseId}
                  onOpen={(id) => setView({ name: 'detail', id })}
                />
              ))}
            </div>
          ) : null}
          <div className="list">
            <Button
              className="row explore"
              onPress={() => setView({ name: 'add', id: null })}
            >
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
  } else if (resolved.name === 'add' || resolved.name === 'edit') {
    const editing = resolved.name === 'edit' ? current : null;
    body = (
      <>
        <div className="appbar">
          <Button
            className="btn icon"
            aria-label={t('instr.add.cancel')}
            onPress={() =>
              setView(editing ? { name: 'detail', id: editing.id } : { name: 'roster', id: null })
            }
          >
            <BackIcon />
          </Button>
          <Heading slot="title" className="title">
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
            onCancel={() =>
              setView(editing ? { name: 'detail', id: editing.id } : { name: 'roster', id: null })
            }
          />
        </div>
      </>
    );
  } else if (resolved.name === 'rules') {
    body = (
      <>
        <div className="appbar">
          <Button
            className="btn icon"
            aria-label={t('instr.roster.back')}
            onPress={() => setView({ name: 'detail', id: current.id })}
          >
            <BackIcon />
          </Button>
          <Heading slot="title" className="title">
            {t('instr.rules.title')}
          </Heading>
        </div>
        <div className="scroll instr-scroll">
          <VoicingRules entry={current} onSetRules={setRules} />
        </div>
      </>
    );
  } else {
    // detail
    const entry = current;
    const inUse = entry.id === inUseId;
    const shapeCount = entry.shapes.length;
    // The built-in standard guitar, not yet stored, has nothing to remove — it
    // is what removal falls back to (Decision 3). Once stored it is ordinary.
    const removable = !(builtIn && entry.id === builtIn.id);
    body = (
      <>
        <div className="appbar">
          <Button
            className="btn icon"
            aria-label={t('instr.roster.back')}
            onPress={() => setView({ name: 'roster', id: null })}
          >
            <BackIcon />
          </Button>
          <Heading slot="title" className="title">
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
          {body}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

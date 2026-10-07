// EnterShape — the by-hand shape dialog (music.explorer, workflow 16 L136-146;
// the shared affordance songs.arrange will reuse). A grid where each string is
// set to muted, open or a fret; a per-string read-out of the notes it sounds
// with any foreign to the chord marked by a word; the shape drawn as entered and
// never rejected — a half-finished or unusual one is kept, an unplayable one says
// so without blocking — and what it produces can be starred. React Aria
// throughout; the overlay portals into the `.est` token root via ThemeRoot
// ([[rac-overlays-portal-outside-est-theme-root]]).

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
} from 'react-aria-components';
import { t } from '../i18n/index.js';
import { note, formatNote } from '../core/pitch.js';
import { chordTones } from '../core/chord.js';
import { openMidis, fingeringFromFrets } from '../core/search.js';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import { PlusIcon, StarIcon } from './icons.jsx';

// Frets offered on the by-hand grid: muted, open, and the first frets — enough to
// place the shapes a player records by hand near the nut.
const FRET_WINDOW = 7;
// A chromatic sharp spelling for a note foreign to the chord, which has no
// functional spelling to borrow (mirrors core/chord.js's own fallback).
const SHARP = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];

// What one string sounds for the current chord: its state, the note name, and
// whether that note is foreign to the chord (home-book/§5.6 is not involved — this
// is which note it is and whether the chord asks for it).
function stringNote(chord, openMidi, value) {
  if (value === 'x') return { muted: true };
  const fret = Number(value);
  const pc = (((openMidi + fret) % 12) + 12) % 12;
  const toneByPc = new Map(chordTones(chord).map((tone) => [tone.pitchClass, tone.spelled]));
  const spelled = toneByPc.get(pc) ?? note(SHARP[pc][0], SHARP[pc][1]);
  return { muted: false, open: fret === 0, fret, name: formatNote(spelled), foreign: !toneByPc.has(pc) };
}

function readoutLabel(chord, openMidi, value, index, stringCount) {
  const n = stringCount - index; // 1 is the highest-pitched string, as spoken
  const info = stringNote(chord, openMidi, value);
  if (info.muted) return { text: t('explorer.enter.muted', { n }), foreign: false };
  if (info.open) return { text: t('explorer.enter.openNote', { n, note: info.name }), foreign: info.foreign };
  return {
    text: t('explorer.enter.frettedNote', { n, fret: info.fret, note: info.name }),
    foreign: info.foreign,
  };
}

// The grid + read-out + preview, mounted fresh each time the dialog opens so its
// entered state starts empty. The primary action is configurable (Decision 6):
// the explorer passes its star, arrange passes "Choose this shape".
function ShapeBuilder({ instrument, chord, dialect, primary, close }) {
  const stringCount = instrument.strings.length;
  const opens = openMidis(instrument);
  const [frets, setFrets] = useState(() => Array.from({ length: stringCount }, () => 'x'));

  const setString = (index, value) =>
    setFrets((prev) => prev.map((f, i) => (i === index ? value : f)));

  const numericFrets = frets.map((f) => (f === 'x' ? 'x' : Number(f)));
  const anySounding = numericFrets.some((f) => f !== 'x');
  const fingering = anySounding
    ? fingeringFromFrets(numericFrets, chord, instrument, instrument.heuristics)
    : null;

  return (
    <div className="enter-shape-body">
      <p className="t-small enter-shape-help">{t('explorer.enter.help')}</p>

      <div className="enter-shape-grid">
        {frets.map((value, index) => {
          const n = stringCount - index;
          return (
            <RadioGroup
              key={index}
              className="enter-shape-string"
              orientation="horizontal"
              value={String(value)}
              onChange={(next) => setString(index, next)}
              aria-label={t('explorer.enter.nut', { n })}
            >
              <span className="enter-shape-stringname t-small">{n}</span>
              <Radio className="enter-shape-fret" value="x" aria-label={t('explorer.enter.muteString', { n })}>
                ✕
              </Radio>
              {Array.from({ length: FRET_WINDOW + 1 }, (_, fret) => (
                <Radio
                  key={fret}
                  className="enter-shape-fret"
                  value={String(fret)}
                  aria-label={
                    fret === 0
                      ? t('explorer.enter.openString', { n })
                      : t('explorer.enter.setFret', { n, fret })
                  }
                >
                  {fret === 0 ? '○' : fret}
                </Radio>
              ))}
            </RadioGroup>
          );
        })}
      </div>

      <div className="enter-shape-readout">
        <span className="t-h3">{t('explorer.enter.readout')}</span>
        <ul className="enter-shape-notes">
          {frets.map((value, index) => {
            const { text, foreign } = readoutLabel(chord, opens[index], value, index, stringCount);
            return (
              <li key={index}>
                {text}
                {foreign ? <span className="badge warn enter-shape-foreign"> {t('explorer.enter.foreign')}</span> : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="enter-shape-preview">
        {fingering ? (
          <ChordDiagram fingering={fingering} context={{ chord, dialect, instrument }} kind="default" />
        ) : anySounding ? (
          <p className="notice warn" role="status">
            {t('explorer.enter.unplayable')}
          </p>
        ) : null}
      </div>

      <div className="actions">
        <Button className="btn" onPress={close}>
          {t('explorer.enter.cancel')}
        </Button>
        <Button
          className="btn primary"
          isDisabled={!fingering}
          aria-label={primary.ariaLabel(fingering)}
          onPress={() => {
            if (!fingering) return;
            primary.onChoose(fingering);
            close();
          }}
        >
          {primary.icon}
          <span>{primary.label}</span>
        </Button>
      </div>
    </div>
  );
}

export default function EnterShape({ instrument, chord, chordSymbol, dialect, onStar, primary }) {
  // No chord to place notes against, or no instrument — nothing to enter.
  const ready = Boolean(instrument && chord);
  // The default primary action is the explorer's star, built from `onStar`
  // (music.explorer); a consumer (arrange) passes its own `primary` to write the
  // shape elsewhere (Decision 6). Each `primary` carries the button copy, its
  // per-fingering accessible name, the trigger-row copy, and the dialog title.
  const action = primary ?? {
    label: t('explorer.enter.star'),
    icon: <StarIcon />,
    ariaLabel: (fingering) =>
      t('explorer.star', { chord: chordSymbol, shorthand: fingering ? fingering.shorthand : '' }),
    onChoose: (fingering) => onStar(fingering),
    triggerName: t('explorer.enter.name'),
    triggerMeta: t('explorer.enter.meta'),
    title: t('explorer.enter.title'),
  };
  return (
    <DialogTrigger>
      <Button className="row explore enter-shape-trigger" isDisabled={!ready}>
        <PlusIcon />
        <span className="grow">
          <span className="name">{action.triggerName}</span>
          {action.triggerMeta ? <span className="meta">{action.triggerMeta}</span> : null}
        </span>
      </Button>
      <ModalOverlay className="scrim center" isDismissable>
        <Modal className="dialog enter-shape">
          <Dialog className="enter-shape-dialog">
            {({ close }) => (
              <>
                <Heading slot="title" className="t-h2">
                  {action.title}
                </Heading>
                {ready ? (
                  <ShapeBuilder
                    instrument={instrument}
                    chord={chord}
                    dialect={dialect}
                    primary={action}
                    close={close}
                  />
                ) : null}
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

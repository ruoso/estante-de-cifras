// EnterShape — the by-hand shape dialog (music.explorer, workflow 16 §Entering a
// shape by hand) and the shared `ShapeBuilder` inside it. A grid where each
// string is set to muted, open or a fret; the read-out of what the shape holds —
// *Notes it holds*, one row per string naming the note's part in the chord
// (*root*, *minor third*) or *not in Cm*, and a notice spelling the foreign notes
// out (songs.arrange_polish, the pure shape-readout.js); the shape drawn as
// entered and never rejected — a half-finished or unusual one is kept, an
// unplayable one says so without blocking. The explorer hosts the builder in this
// dialog and stars what it produces; arrange hosts the same builder as a screen
// of the mode (its Decision 4), so the two never disagree on a shape. React Aria
// throughout; the overlay portals into the `.est` token root via ThemeRoot
// ([[rac-overlays-portal-outside-est-theme-root]]).

import { useId, useState } from 'react';
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
import { fingeringFromFrets } from '../core/search.js';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import { PlusIcon, StarIcon } from './icons.jsx';
import { shapeReadout } from './shape-readout.js';

// Frets offered on the by-hand grid: muted, open, and the first frets — enough to
// place the shapes a player records by hand near the nut.
const FRET_WINDOW = 7;

// The warning triangle on the foreign-note notice (aria-hidden; the words carry
// the status — mockups README line 26).
function WarnIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="enter-shape-warn">
      <path d="M12 3l10 18H2zM12 10v5M12 18h.01" />
    </svg>
  );
}

// The grid + preview card, the read-out and the actions, mounted fresh each time
// a host opens it so its entered state starts empty. The primary action is
// configurable (songs.arrange Decision 6): the explorer passes its star, arrange
// passes "Choose this shape". `onCancel` is the host's way back; `onChosen` runs
// after the primary action (the dialog closes; arrange navigates in onChoose).
// A host that shows the help elsewhere (arrange's context line) passes
// `showHelp={false}`; `headingLevel` fits the read-out's heading under the host's.
export function ShapeBuilder({
  instrument,
  chord,
  chordSymbol,
  dialect,
  primary,
  onCancel,
  onChosen = () => {},
  showHelp = true,
  headingLevel = 3,
  className = '',
}) {
  const stringCount = instrument.strings.length;
  const [frets, setFrets] = useState(() => Array.from({ length: stringCount }, () => 'x'));
  const readoutId = useId();

  const setString = (index, value) =>
    setFrets((prev) => prev.map((f, i) => (i === index ? value : f)));

  const numericFrets = frets.map((f) => (f === 'x' ? 'x' : Number(f)));
  const anySounding = numericFrets.some((f) => f !== 'x');
  const fingering = anySounding
    ? fingeringFromFrets(numericFrets, chord, instrument, instrument.heuristics)
    : null;
  const readout = shapeReadout(chord, chordSymbol, instrument.strings, numericFrets);
  const ReadoutHeading = `h${headingLevel}`;

  return (
    <div className={`enter-shape-body${className ? ` ${className}` : ''}`}>
      {showHelp ? <p className="t-small enter-shape-help">{t('explorer.enter.help')}</p> : null}

      <div className="enter-shape-main">
        <div className="card pad enter-shape-card">
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

          <div className="enter-shape-preview">
            {fingering ? (
              <ChordDiagram fingering={fingering} context={{ chord, dialect, instrument }} kind="default" />
            ) : anySounding ? (
              <p className="notice warn" role="status">
                {t('explorer.enter.unplayable')}
              </p>
            ) : null}
          </div>
        </div>

        <section className="enter-shape-readout" aria-labelledby={readoutId}>
          <ReadoutHeading id={readoutId} className="t-h3">
            {t('explorer.enter.readout')}
          </ReadoutHeading>
          {readout.summary ? <p className="t-h2 enter-shape-summary">{readout.summary}</p> : null}
          <ul className="list enter-shape-notes">
            {readout.rows.map((row, index) => (
              <li key={index} className="row enter-shape-note">
                <span className="grow">
                  <span className="name">{row.string}</span>
                  <span className="meta">{row.fret}</span>
                </span>
                <span className="t-h2 enter-shape-notename">{row.note}</span>
                {row.badge ? (
                  <span className={`badge${row.foreign ? ' conflict' : ''}`}>{row.badge}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {readout.notice ? (
        <div className="notice conflict enter-shape-notice" role="status">
          <WarnIcon />
          <span>{readout.notice}</span>
        </div>
      ) : null}

      <div className="actions">
        <Button className="btn" onPress={onCancel}>
          {t('explorer.enter.cancel')}
        </Button>
        <Button
          className="btn primary"
          isDisabled={!fingering}
          aria-label={primary.ariaLabel(fingering)}
          onPress={() => {
            if (!fingering) return;
            primary.onChoose(fingering);
            onChosen();
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
                    chordSymbol={chordSymbol}
                    dialect={dialect}
                    primary={action}
                    onCancel={close}
                    onChosen={close}
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

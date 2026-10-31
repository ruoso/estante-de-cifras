// EnterShape — the by-hand shape dialog (music.explorer, workflow 16 §Entering a
// shape by hand) and the shared `ShapeBuilder` inside it. A big chord diagram,
// drawn the way the reader's diagrams are (hand, neck), to tap: a string at a
// fret puts a finger there and a second tap lifts it, the row above the nut
// opens or mutes the string, and two arrows move the window along the neck
// (Explore Chords' shape dialog, DESIGN.md §2.11). The keyboard and a screen
// reader set the same shape string by string, through a grid of radios that
// shows itself when it takes focus; the read-out of what the shape holds —
// *Notes it holds*, one row per string naming the note's part in the chord
// (*root*, *minor third*) or *not in Cm*, and a notice spelling the foreign notes
// out (songs.arrange_polish, the pure shape-readout.js); the shape drawn as
// entered and never rejected — a half-finished or unusual one is kept, an
// unplayable one says so without blocking. The explorer hosts the builder in this
// dialog and stars what it produces; arrange hosts the same builder as a screen
// of the mode (its Decision 4), so the two never disagree on a shape. React Aria
// throughout; the overlay portals into the `.est` token root via ThemeRoot
// ([[rac-overlays-portal-outside-est-theme-root]]).

import { useContext, useId, useState } from 'react';
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
import { midiAt } from '../core/instrument.js';
import { shorthandOf } from '../core/fretstring.js';
import { renderChordBox, renderNeck, describeFingering } from '../render/index.js';
import { DiagramDisplayContext } from '../theme/display-context.js';
import '../diagram/diagram.css';
import { PlusIcon, StarIcon } from './icons.jsx';
import { shapeReadout } from './shape-readout.js';

// Fret rows the board shows at once: two more than any hand spans. The window
// starts where nothing is yet (the nut) and moves only when asked — one that
// followed the shape would slide out from under the finger placing it.
const ROWS = 6;
// The board's scale over the reading diagrams: big enough to hit with a thumb.
const BOARD_SIZE = 2.2;

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
  const fretCount = instrument.fretCount ?? 22;
  const { handed, orientation } = useContext(DiagramDisplayContext);
  const [frets, setFrets] = useState(() => Array.from({ length: stringCount }, () => 'x'));
  const [start, setStart] = useState(1);
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

  // The board: the shape as a hand would hold it when it can be held (fingers
  // and barre), else as entered — a dot per fretted string — since a shape on
  // its way to being one need not be playable, and refusing to draw it would
  // hide what was just tapped. Drawn with click targets off the same geometry
  // as the grid (chord-box.js / neck.js `hits`).
  const sketch = {
    frets: numericFrets,
    fingers: numericFrets.map(() => null),
    barre: null,
    midis: numericFrets.map((f, i) => (f === 'x' ? null : midiAt(instrument, i, f))),
    shorthand: shorthandOf(numericFrets),
    position: 0,
  };
  const drawn = fingering ?? sketch;
  const boardOptions = {
    handed,
    size: BOARD_SIZE,
    fretsShown: ROWS,
    startFret: start,
    hits: true,
    label: fingering
      ? describeFingering(fingering, { chord, dialect, instrument })
      : t('explorer.enter.sketch', { shorthand: sketch.shorthand }),
  };
  const board = orientation === 'horizontal' ? renderNeck(drawn, boardOptions) : renderChordBox(drawn, boardOptions);

  // A tap on the board: above the nut cycles the string open → muted → open (a
  // fretted string goes open), a fret toggles a finger there.
  const onBoard = (event) => {
    const hit = event.target.closest?.('.ec-hit');
    if (!hit) return;
    const index = Number(hit.dataset.string);
    if (hit.dataset.fret === 'marker') setString(index, frets[index] === 0 ? 'x' : 0);
    else {
      const fret = Number(hit.dataset.fret);
      setString(index, frets[index] === fret ? 'x' : fret);
    }
  };
  const move = (by) => setStart((now) => Math.max(1, Math.min(fretCount - ROWS + 1, now + by)));
  const windowFrets = Array.from({ length: ROWS }, (_, r) => start + r);

  return (
    <div className={`enter-shape-body${className ? ` ${className}` : ''}`}>
      {showHelp ? <p className="t-small enter-shape-help">{t('explorer.enter.help')}</p> : null}

      <div className="enter-shape-main">
        <div className="card pad enter-shape-card">
          {/* The pointer's way in: the diagram itself. A click lands on a hit
              target the renderer drew; the keyboard sets the same strings
              through the radios below, so the board takes no key events. */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            className={`chord-diagram enter-shape-board${orientation === 'horizontal' ? ' chord-diagram--horizontal' : ''}`}
            onClick={onBoard}
            dangerouslySetInnerHTML={{ __html: board }}
          />
          <div className="enter-shape-position">
            <Button className="btn icon" aria-label={t('explorer.enter.towardsNut')} isDisabled={start <= 1} onPress={() => move(-1)}>
              ←
            </Button>
            <span className="t-small enter-shape-window">
              {t('explorer.enter.frets', { from: start, to: start + ROWS - 1 })}
            </span>
            <Button
              className="btn icon"
              aria-label={t('explorer.enter.upTheNeck')}
              isDisabled={start >= fretCount - ROWS + 1}
              onPress={() => move(1)}
            >
              →
            </Button>
          </div>
          {fingering == null && anySounding ? (
            <p className="notice warn" role="status">
              {t('explorer.enter.unplayable')}
            </p>
          ) : null}

          {/* The keyboard's and the screen reader's way in: each string set to
              muted, open or a fret in the board's window. Out of sight until it
              takes focus, when it shows, so a pointer sees only the board. */}
          <div className="enter-shape-grid">
            {frets.map((value, index) => {
              const n = stringCount - index;
              return (
                <RadioGroup
                  key={index}
                  className="enter-shape-string"
                  orientation="horizontal"
                  value={String(value)}
                  onChange={(next) => setString(index, next === 'x' ? 'x' : Number(next))}
                  aria-label={t('explorer.enter.nut', { n })}
                >
                  <span className="enter-shape-stringname t-small">{n}</span>
                  <Radio className="enter-shape-fret" value="x" aria-label={t('explorer.enter.muteString', { n })}>
                    ✕
                  </Radio>
                  <Radio className="enter-shape-fret" value="0" aria-label={t('explorer.enter.openString', { n })}>
                    ○
                  </Radio>
                  {windowFrets.map((fret) => (
                    <Radio
                      key={fret}
                      className="enter-shape-fret"
                      value={String(fret)}
                      aria-label={t('explorer.enter.setFret', { n, fret })}
                    >
                      {fret}
                    </Radio>
                  ))}
                </RadioGroup>
              );
            })}
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

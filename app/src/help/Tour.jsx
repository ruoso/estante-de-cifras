// The tour (workflow 18 §The tour): a short run of cards in a dialog, offered
// once on a first, cold open and always available from Help. Each card is a
// heading, a few sentences and, where a picture says it faster, the app's own
// drawing — a chart line drawn by the chart, a chord box drawn by the diagram —
// so what the tour shows is what the app looks like. It changes nothing.
//
// A controlled React Aria dialog: the host owns whether it is open; Back, Next,
// Done and Skip tour move or close it, Escape and the scrim close it too, and
// focus returns to whatever opened it. The card's heading is a live region, so
// moving to the next card is announced without moving focus off Next.

import { useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { parse } from 'cifra-md';
import { t } from '../i18n/index.js';
import Chart from '../chart/Chart.jsx';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import { fromCatalog } from '../core/instrument.js';
import { parseChord } from '../core/notation/parse.js';
import { fingeringFromFrets } from '../core/search.js';
import { TOUR_STEPS } from './help-topics.js';
import './help.css';

// The pictures' fixed material: a C on a standard guitar, and two lines of a
// song written for the tour (its words are i18n's, so they read in the
// reader's language).
const GUITAR = fromCatalog('6guitar');
const C = parseChord('C').chord;
const C_SHAPE = fingeringFromFrets(['x', 3, 2, 0, 1, 0], C, GUITAR);

function picture(kind) {
  if (kind === 'diagram') {
    return (
      <ChordDiagram fingering={C_SHAPE} context={{ chord: C, instrument: GUITAR }} kind="song" name="C" />
    );
  }
  const song = parse(t('help.tour.sample'));
  return (
    <Chart
      model={song}
      size={15}
      label={t('help.tour.sampleLabel')}
      {...(kind === 'tap' ? { markOf: () => 'tap' } : null)}
    />
  );
}

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose  every way the tour ends: Done, Skip, Escape
 */
export default function Tour({ isOpen, onClose }) {
  const [index, setIndex] = useState(0);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;
  const close = () => {
    setIndex(0);
    onClose();
  };
  return (
    <ModalOverlay
      className="scrim center"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      isDismissable
    >
      <Modal className="dialog help-tour">
        <Dialog className="help-tour-dialog" aria-label={t('help.tour.label')}>
          <p className="t-small help-tour-count">
            {t('help.tour.count', { n: index + 1, total: TOUR_STEPS.length })}
          </p>
          <div aria-live="polite">
            <Heading level={2} className="t-h2 help-tour-title">
              {t(`help.tour.${step.id}.title`)}
            </Heading>
            <p className="t-body help-tour-body">{t(`help.tour.${step.id}.body`)}</p>
          </div>
          {step.picture ? (
            <div className="card pad help-tour-picture" aria-hidden="true">
              {picture(step.picture)}
            </div>
          ) : null}
          <div className="help-tour-dots" aria-hidden="true">
            {TOUR_STEPS.map((s, i) => (
              <span key={s.id} className={i === index ? 'on' : ''} />
            ))}
          </div>
          <div className="actions help-tour-actions">
            {last ? null : (
              <Button className="btn quiet help-tour-skip" onPress={close}>
                {t('help.tour.skip')}
              </Button>
            )}
            {index > 0 ? (
              <Button className="btn" onPress={() => setIndex(index - 1)}>
                {t('help.tour.back')}
              </Button>
            ) : null}
            {last ? (
              <Button className="btn primary" onPress={close}>
                {t('help.tour.done')}
              </Button>
            ) : (
              <Button className="btn primary" onPress={() => setIndex(index + 1)}>
                {t('help.tour.next')}
              </Button>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

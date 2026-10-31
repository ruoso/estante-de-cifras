// Help (workflow 18 §Help on every page): the question-mark button each page
// puts in its app bar, and the panel it opens about that page — its name, what
// it is for, what can be done there — with every other page's help under
// *Other pages* and *Take the tour* at the foot. The button owns its own open
// state and the tour it can start, so a page adds help with one element and no
// wiring.
//
// Bundled copy (`help.pages.<id>`), so it opens offline and touches neither the
// network nor the Worker. A React Aria dialog: Escape, the scrim and Close all
// close it, and focus returns to the button.

import { useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { t, tr } from '../i18n/index.js';
import { HELP_PAGES, isHelpPage } from './help-topics.js';
import Tour from './Tour.jsx';
import './help.css';

function HelpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6M12 17h.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const pageTitle = (id) => t(`help.pages.${id}.title`);

// One page's help: what it is for, then what can be done there.
function PageHelp({ id, headingRef }) {
  const points = tr(`help.pages.${id}.points`);
  return (
    <section className="help-page">
      <Heading slot="title" level={2} className="t-h2 help-title" ref={headingRef} tabIndex={-1}>
        {pageTitle(id)}
      </Heading>
      <p className="t-body help-summary">{t(`help.pages.${id}.summary`)}</p>
      {Array.isArray(points) && points.length ? (
        <>
          <h3 className="t-h3 help-subhead">{t('help.canDo')}</h3>
          <ul className="help-points">
            {points.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

/**
 * The help panel. `page` is the page it opened on; another page's help can be
 * shown in its place from *Other pages*, with *Back to* the page's own.
 *
 * @param {object} props
 * @param {string} props.page  a HELP_PAGES id
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {() => void} props.onTour  *Take the tour*: the host closes this and opens the tour
 */
export function HelpPanel({ page, isOpen, onClose, onTour }) {
  const [shown, setShown] = useState(null);
  const headingRef = useRef(null);
  const current = shown && isHelpPage(shown) ? shown : page;
  const show = (id) => {
    setShown(id === page ? null : id);
    // The new page's heading takes focus, so the change is heard and the
    // reading starts at its top.
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  const close = () => {
    setShown(null);
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
      <Modal className="dialog help-panel">
        <Dialog className="help-dialog">
          <div className="sheet-head">
            <span className="t-small help-kicker">{t('help.kicker')}</span>
            <Button className="btn icon" aria-label={t('help.close')} onPress={close}>
              <CloseIcon />
            </Button>
          </div>
          {current !== page ? (
            <Button className="btn quiet help-back" onPress={() => show(page)}>
              {t('help.backTo', { page: pageTitle(page) })}
            </Button>
          ) : null}
          <PageHelp id={current} headingRef={headingRef} />
          <nav className="help-others" aria-label={t('help.others')}>
            <h3 className="t-h3 help-subhead">{t('help.others')}</h3>
            <ul className="help-index">
              {HELP_PAGES.filter((id) => id !== current).map((id) => (
                <li key={id}>
                  <Button className="help-index-item" onPress={() => show(id)}>
                    {pageTitle(id)}
                  </Button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="help-foot">
            <span className="t-small">{t('help.tourLine')}</span>
            <Button
              className="btn"
              onPress={() => {
                setShown(null);
                onTour();
              }}
            >
              {t('help.takeTour')}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/**
 * The question-mark button a page puts in its app bar, opening that page's
 * help; from there, the tour.
 *
 * @param {object} props
 * @param {string} props.page  a HELP_PAGES id
 * @param {string} [props.className]
 */
export default function HelpButton({ page, className = '' }) {
  const [open, setOpen] = useState(null); // 'help' | 'tour' | null
  return (
    <>
      <Button
        className={`btn icon help-button${className ? ` ${className}` : ''}`}
        aria-label={t('help.buttonFor', { page: pageTitle(page) })}
        onPress={() => setOpen('help')}
      >
        <HelpIcon />
      </Button>
      <HelpPanel page={page} isOpen={open === 'help'} onClose={() => setOpen(null)} onTour={() => setOpen('tour')} />
      <Tour isOpen={open === 'tour'} onClose={() => setOpen(null)} />
    </>
  );
}

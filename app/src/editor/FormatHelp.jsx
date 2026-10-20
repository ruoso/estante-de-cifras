// The format help, *Writing a song* (songs.format_help; workflow 3 §Help with
// the format; board Format-help): one scrolling page of eight short topics,
// each a heading, a sentence or two and an example in the editor's monospaced
// face. The parts' examples carry Insert, the title and the voicings Copy. On a
// phone it is a sheet from the bottom; on a tablet and a computer a panel
// hanging from *Help*, over the preview (Decision 10).
//
// Bundled copy, so it opens offline and touches neither the network nor the
// Worker (Constraint 8). The editor owns the open state and what Insert does
// to the text; this draws the help and runs Copy.

import { useEffect, useId, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay, Popover } from 'react-aria-components';

import { t, tr } from '../i18n/index.js';
import { FORMAT_TOPICS } from './format-help.js';

// How long *Copied* stays before the button says *Copy* again.
const COPIED_MS = 2000;

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function InsertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </svg>
  );
}

// The topic's name in an action's label: its heading without the number
// (*Insert the Bars example*).
const topicName = (heading) => heading.replace(/^\d+\.\s*/, '');

// Copy: the button says *Copied*, or — with no clipboard, or a refusal — that
// it could not, and the example stays there to select by hand (Decision 6).
// The change is announced through a status line beside it.
function CopyButton({ example, label }) {
  const [state, setState] = useState('idle'); // 'idle' | 'copied' | 'failed'
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    clearTimeout(timer.current);
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(example);
      setState('copied');
      timer.current = setTimeout(() => setState('idle'), COPIED_MS);
    } catch {
      setState('failed');
    }
  };
  let word = t('editor.formatHelp.copy');
  if (state === 'copied') word = t('editor.formatHelp.copied');
  else if (state === 'failed') word = t('editor.formatHelp.copyFailed');
  return (
    <>
      <Button className="btn est-format-help-action" aria-label={label} onPress={copy}>
        <CopyIcon />
        {word}
      </Button>
      <span className="est-format-help-status" role="status">
        {state === 'idle' ? '' : word}
      </span>
    </>
  );
}

function Topic({ id, action, headingRef, onInsert }) {
  const headingId = useId();
  const { heading, text, example } = tr(['editor', 'formatHelp', 'topics', id]);
  const name = topicName(heading);
  return (
    <section className="est-format-help-topic" aria-labelledby={headingId}>
      {/* Focusable by script only, so Show me how can open the help with this
          heading the first thing read (workflow 3 L222-227). */}
      <h3 id={headingId} ref={headingRef} tabIndex={-1} className="t-h2 est-format-help-topic-heading">
        {heading}
      </h3>
      <p className="t-body">{text}</p>
      <pre className="editor est-format-help-example">{example}</pre>
      {action === 'insert' ? (
        <Button
          className="btn est-format-help-action"
          aria-label={t('editor.formatHelp.insertLabel', { topic: name })}
          onPress={() => onInsert(example)}
        >
          <InsertIcon />
          {t('editor.formatHelp.insert')}
        </Button>
      ) : (
        <CopyButton example={example} label={t('editor.formatHelp.copyLabel', { topic: name })} />
      )}
    </section>
  );
}

function HelpContent({ close, topic, grip, onInsert }) {
  const headings = useRef({});
  // Opened at a topic (Show me how): its heading takes focus, ahead of the
  // Dialog's own focus — which only moves focus when it is not already inside.
  useEffect(() => {
    if (topic) headings.current[topic]?.focus();
  }, [topic]);
  return (
    <>
      {grip ? <div className="grip" aria-hidden="true" /> : null}
      <div className="est-format-help-head">
        <Heading slot="title" level={2} className="t-h2">
          {t('editor.formatHelp.title')}
        </Heading>
        <Button className="btn icon" aria-label={t('editor.formatHelp.close')} onPress={close}>
          <CloseIcon />
        </Button>
      </div>
      <div className="est-format-help-body">
        <p className="t-small est-format-help-intro">{t('editor.formatHelp.intro')}</p>
        {FORMAT_TOPICS.map(({ id, action }) => (
          <Topic
            key={id}
            id={id}
            action={action}
            headingRef={(el) => {
              headings.current[id] = el;
            }}
            onInsert={onInsert}
          />
        ))}
      </div>
    </>
  );
}

/**
 * The help, drawn as the editor's layout asks: `presentation` `'sheet'` (a
 * phone) or `'popover'` (a tablet and a computer, hanging from `triggerRef`).
 * `topic` opens it at that topic's heading; `onInsert(example)` is the
 * editor's Insert; `onClose` hears every way it closes.
 */
export default function FormatHelp({ presentation, isOpen, topic = null, triggerRef, onClose, onInsert }) {
  const onOpenChange = (open) => {
    if (!open) onClose();
  };
  const dialog = (grip) => (
    <Dialog className="est-format-help-dialog">
      <HelpContent close={onClose} topic={topic} grip={grip} onInsert={onInsert} />
    </Dialog>
  );

  if (presentation === 'sheet') {
    return (
      <ModalOverlay className="scrim" isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
        <Modal className="sheet est-format-help est-format-help-sheet">{dialog(true)}</Modal>
      </ModalOverlay>
    );
  }
  return (
    <Popover
      className="popover card est-format-help est-format-help-popover"
      triggerRef={triggerRef}
      placement="bottom end"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      {dialog(false)}
    </Popover>
  );
}

// InvitedRefusal — a refused invitation link, drawn as W01 #4 draws it: an
// alert dialog over the person's shelf, not a screen of its own
// (books.invited_presentation; workflow 1 §Invited, the presentation paragraph).
// AppShell mounts it over the shell when the Worker answers BOOK_REFUSED; for
// someone who made their account through this very link that shelf is the empty
// front door, and dismissing the dialog leaves them on it.
//
// The copy is books.add_by_link's, keyed off the Worker's reason word, and names
// nothing about the book (a dead link reveals nothing, workflow 1 §Invited
// L61-66). The icon goes with the heading, never instead of it.

import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { t } from '../i18n/index.js';
import './account.css';

// The copy for each refusal, keyed off the Worker's reason word — never naming
// the book. 'full' is the one refusal told apart, so the person knows to ask the
// owner (workflow 1 §Invited); 'dead' conflates expired/withdrawn/exhausted and a
// non-member request; 'error' is a transport failure (offline / a 5xx).
export function refusalCopy(reason) {
  if (reason === 'full') {
    return { title: t('invited.fullTitle'), body: t('invited.fullBody'), addByLink: false };
  }
  if (reason === 'error') {
    return { title: t('invited.errorTitle'), body: t('invited.errorBody'), addByLink: false };
  }
  return { title: t('invited.deadTitle'), body: t('invited.deadBody'), addByLink: true };
}

// The warning triangle of the dead-link dialog (W01 L177); decorative.
function WarningIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3l10 18H2zM12 10v5M12 18h.01" />
    </svg>
  );
}

// The person of the full-book dialog (W01 L188); decorative.
function PersonIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

export default function InvitedRefusal({
  // 'full' | 'dead' | 'error' (books.add_by_link reason word).
  reason = 'dead',
  onAddByLink = () => {},
  onClose = () => {},
}) {
  const copy = refusalCopy(reason);
  return (
    <ModalOverlay
      className="scrim center"
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <Modal className="dialog invited-refusal">
        <Dialog role="alertdialog" className="invited-refusal-body">
          <div className="invited-refusal-head">
            <span className="invited-refusal-icon">{reason === 'full' ? <PersonIcon /> : <WarningIcon />}</span>
            <Heading slot="title" className="t-h2">
              {copy.title}
            </Heading>
          </div>
          <p className="t-body">{copy.body}</p>
          <div className="actions">
            {copy.addByLink ? (
              <Button className="btn quiet" onPress={onAddByLink}>
                {t('invited.addByLink')}
              </Button>
            ) : null}
            <Button className="btn primary" onPress={onClose}>
              {t('invited.ok')}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

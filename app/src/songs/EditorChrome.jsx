// EditorChrome.jsx — the one header both editor hosts draw (songs.editor_chrome
// Constraint 1; W03, W04 boards; workflow 4 §Editing). From props only — the
// hosts keep their own state (save open, discard open, reload key):
//
// - phone (`layout="phone"`, W04#1 L28-52): the app bar *Back · {title} · Save*;
//   while unsaved a strip of its own, *unsaved changes · Kept on this device*;
//   the host's body; a bottom bar *Add section · Discard changes*. The title has
//   the bar's room, so a drawn title shows whole (shell.narrow_fit).
// - tablet and computer (W04#3 L104-110, W04#4 L156-161): the app bar *Back ·
//   {title} · unsaved changes · Discard changes · Save*, no strip, no bottom bar
//   (Add section stays in the editor's own bar). The computer keeps Back,
//   though the board draws none (Decision 4).
//
// Save is the host's `onSave`, which runs the editor's gate (Constraint 2); the
// status is a word on a badge, never colour alone (mockups README L26).

import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import './editor-chrome.css';

function BackIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default function EditorChrome({
  title,
  unsaved,
  layout,
  backLabel,
  onBack,
  onSave,
  onDiscard,
  onAddSection,
  saveButtonRef,
  children,
}) {
  const phone = layout === 'phone';
  const mark = <span className="badge unsaved dot">{t('editor.unsaved')}</span>;
  return (
    <div className="screen new-song editor-chrome">
      <div className="appbar">
        <Button className="btn icon" aria-label={backLabel} onPress={onBack}>
          <BackIcon />
        </Button>
        <span className="title">{title}</span>
        {!phone && unsaved ? mark : null}
        {phone ? null : (
          <Button className="btn" onPress={onDiscard}>
            {t('saveSheet.discard')}
          </Button>
        )}
        <Button ref={saveButtonRef} className="btn primary" onPress={onSave}>
          {t('editor.source.save')}
        </Button>
      </div>
      {phone && unsaved ? (
        <div className="editor-chrome-strip" role="status">
          {mark}
          <span className="t-small">{t('editor.keptOnDevice')}</span>
        </div>
      ) : null}
      {children}
      {phone ? (
        <div className="editor-chrome-bottom">
          <Button className="btn" onPress={onAddSection}>
            {t('editor.source.addSection')}
          </Button>
          <Button className="btn" onPress={onDiscard}>
            {t('saveSheet.discard')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

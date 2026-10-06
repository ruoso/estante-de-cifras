// The update affordance (shell.pwa): a quiet, dismissible notice that a new
// version is ready, with an explicit Reload now and a Dismiss. foundation.
// app_sw_register handed the user-visible "update on next launch" behaviour here
// (app_sw_register.md). It is non-modal — it never traps or steals focus, so it
// cannot interrupt a performance (workflow 8 no-interruption); its status is
// carried by a word ("A new version is ready"), never colour alone (mockups
// README). React Aria's Button gives each action its keyboard path and
// accessible name without hand-rolled ARIA (the standing accessibility rule).
//
// It reads the main-thread update store (no IndexedDB, no Worker — shell.pwa
// Constraints) and renders nothing until a version is actually waiting.

import { useSyncExternalStore } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { updateStore } from './update-state.js';
import './update-ready.css';

export default function UpdateReady({ store = updateStore }) {
  const { updateReady } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  if (!updateReady) return null;

  // role="status" (implicit aria-live=polite) announces the message when it
  // appears, without moving focus. It sits over the shell (position: fixed) so
  // it disturbs no layout.
  return (
    <div className="notice accent update-ready" role="status">
      <span className="t-body grow">{t('update.ready')}</span>
      <div className="actions">
        <Button className="btn quiet" onPress={() => store.reload()}>
          {t('update.reload')}
        </Button>
        <Button className="btn quiet" onPress={() => store.dismiss()}>
          {t('update.dismiss')}
        </Button>
      </div>
    </div>
  );
}

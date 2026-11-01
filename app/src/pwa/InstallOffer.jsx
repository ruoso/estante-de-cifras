// The install offer (shell.pwa): a quiet, dismissible notice suggesting the
// person put the app on their home screen. Where the browser hands us its
// install dialog (Android Chrome and other Chromium browsers) it carries an
// Install button that opens it; on iOS, where no browser offers one, it says how
// to do it from the Share sheet. Non-modal like the update notice — role=status,
// never takes focus — so it cannot interrupt a performance, and it stands aside
// while that notice is showing, so the app asks for one thing at a time.

import { useSyncExternalStore } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { installStore, OfferKind } from './install-state.js';
import { updateStore } from './update-state.js';
import './install-offer.css';

function useStore(store) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export default function InstallOffer({ store = installStore, update = updateStore }) {
  const { offer } = useStore(store);
  const { updateReady } = useStore(update);

  if (!offer || updateReady) return null;

  return (
    <div className="notice accent install-offer" role="status">
      <span className="t-body grow">
        {offer === OfferKind.IOS ? t('install.ios') : t('install.offer')}
      </span>
      <div className="actions">
        {offer === OfferKind.PROMPT && (
          <Button className="btn quiet" onPress={() => store.install()}>
            {t('install.install')}
          </Button>
        )}
        <Button className="btn quiet" onPress={() => store.dismiss()}>
          {t('install.dismiss')}
        </Button>
      </div>
    </div>
  );
}

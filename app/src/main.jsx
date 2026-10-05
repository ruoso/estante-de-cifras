import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';

// Register the generated service worker as a load-time side effect. VitePWA
// runs with `injectRegister: null` (app/vite.config.js), so nothing registers
// the worker unless the entry does: this call precaches the shell and — via
// `clientsClaim` — takes control of the page, the precondition for the app
// working with no signal (DIRECTION §1 offline-first, §3.7). `immediate: true`
// registers as the entry runs rather than on the window `load` event, closing
// the window before the first offline reload; no update callbacks here, because
// `skipWaiting: false` already encodes "update on the next launch" and the
// user-visible update affordance is shell.pwa's. Registered once at module
// scope so StrictMode's double-invoke does not register twice.
registerSW({ immediate: true });

// The view is the only layer that knows React (DIRECTION §3.7): the entry
// mounts the app and nothing more.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

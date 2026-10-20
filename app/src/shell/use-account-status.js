// useAccountStatus — what the shell knows of the account, from the service's
// answer (account.sign_in_two_doors Decision *The shell learns the account's
// state from the recovery-email GET*). One probe, `GET
// /api/account/recovery-email`, says both things: a 200 means signed in, with
// the banner's `{ email, pending }`; a 401 means signed out. A network failure
// keeps the last answer ('unknown' at first), so offline the banner never
// appears before an answer and nothing waits on it.
//
// It probes on mount, when the device comes back online, when the page becomes
// visible again, and on `refresh()` (after a sign-in, a sign-out or leaving, and
// when the account screen closes). No timer. A main-thread `fetch` through the
// injected auth client — no Worker, no IndexedDB — and it logs nothing.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthError } from '../account/auth-client.js';
import { useOnline } from '../account/use-online.js';

/**
 * @param {{ getRecoveryEmail: () => Promise<{ email?: string|null, pending?: string|null }> }} authClient
 * @returns {{ status: 'unknown'|'in'|'out', recovery: { email: string|null, pending: string|null } | null, refresh: () => void }}
 */
export function useAccountStatus(authClient) {
  const [state, setState] = useState({ status: 'unknown', recovery: null });
  const online = useOnline();
  // Held in a ref: a stable client, so the probe effects run on their triggers
  // only (react-hooks/set-state-in-effect; the useSharing reload pattern).
  const clientRef = useRef(authClient);
  // Only the latest probe's answer lands, so a slow earlier one cannot undo it.
  const latest = useRef(0);

  const probe = useCallback(async () => {
    const id = ++latest.current;
    try {
      const result = await clientRef.current.getRecoveryEmail();
      if (id !== latest.current) return;
      setState({
        status: 'in',
        recovery: { email: result?.email ?? null, pending: result?.pending ?? null },
      });
    } catch (error) {
      if (id !== latest.current) return;
      if (error instanceof AuthError && error.kind === 'unauthorized') {
        setState({ status: 'out', recovery: null });
      }
      // Anything else (offline, a fault) keeps the last answer.
    }
  }, []);

  // On mount, and each time the device is back online.
  useEffect(() => {
    if (online) probe();
  }, [online, probe]);

  // When the page is shown again (a confirmation opened on another device).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') probe();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [probe]);

  return { status: state.status, recovery: state.recovery, refresh: probe };
}

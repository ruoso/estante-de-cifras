// sharing-parts.jsx — the pieces every sharing surface shares (books.share_people;
// workflow 10; board W10): the load of a book's members and invitations, the
// worded refusal, the people count with its bar, and Copy / Copy link. The
// surfaces themselves are ShareSheet (#1), PeopleScreen (#3, #5, #6),
// NewInvitation (#2) and SongSharePanel (#4).
//
// Sharing is inherently online (books.share Constraints): every call acts on the
// service's registry through the main-thread sharing client (books.share
// Decision 1), which logs nothing; a refusal is worded, never queued.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, TextField } from 'react-aria-components';

import { t } from '../i18n/index.js';
import { createSharingClient, SharingError } from './sharing-client.js';
import { roomLeft } from './people.js';

// One client for the app; the behavior level injects a loopback double instead.
export const DEFAULT_SHARING_CLIENT = createSharingClient();

// Word a refusal from the sharing client into a status the view shows. A refusal
// carries only code/status (no ids, no book), so the wording is generic.
export function errorCopy(error) {
  if (!(error instanceof SharingError)) return t('sharing.errGeneric');
  if (error.status === null || error.code === 'network') return t('sharing.errNetwork');
  if (error.status === 403) return t('sharing.errForbidden');
  if (error.status === 404) return t('sharing.errNotFound');
  return t('sharing.errGeneric');
}

// The book's members and, for the owner, its invitations — loaded on mount and
// again after every action. The client is held in a ref so the mount effect
// awaits a stable value (react-hooks/set-state-in-effect); every setState comes
// past an `await`.
export function useSharing({ client, bookId, isOwner }) {
  const [stable] = useState(() => client ?? DEFAULT_SHARING_CLIENT);
  const clientRef = useRef(stable);
  const [members, setMembers] = useState(null);
  const [invitations, setInvitations] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = useCallback(async () => {
    const c = clientRef.current;
    try {
      const nextMembers = await c.listMembers(bookId);
      const nextInvites = isOwner ? await c.listInvitations(bookId) : null;
      setMembers(nextMembers);
      setInvitations(nextInvites);
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    }
  }, [bookId, isOwner]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { client: stable, members, invitations, loadError, reload };
}

// The load's own states: a worded refusal with Try again, or Loading….
export function LoadState({ error, onRetry }) {
  if (error) {
    return (
      <div className="est-sharing-body">
        <p className="notice warn" role="alert">
          {errorCopy(error)}
        </p>
        <div className="actions">
          <Button className="btn" onPress={onRetry}>
            {t('sharing.retry')}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <p className="t-small" role="status">
      {t('sharing.loading')}
    </p>
  );
}

// The people count against the cap — the service's numbers, never the app's
// (books.share Decision 5). `room` adds the sheet's "Room for 13 more." line,
// or the full-book notice.
export function PeopleBar({ count, limit = 50, bookTitle, room = true }) {
  const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
  const full = count >= limit;
  const label = t('sharing.countOfLimit', { count, limit });
  return (
    <div className="est-sharing-people">
      <div className="est-sharing-people-head">
        <span className="t-h3 grow">{t('sharing.people')}</span>
        <span className="est-sharing-count">{label}</span>
      </div>
      <div className="bar" role="img" aria-label={label}>
        <div style={{ width: `${pct}%` }} />
      </div>
      {!room ? null : full ? (
        <p className="notice conflict est-sharing-full" role="status">
          <span>{t('sharing.full', { name: bookTitle })}</span>
        </p>
      ) : (
        <span className="t-small">{t('sharing.roomForMore', { count: roomLeft(count, limit) })}</span>
      )}
    </div>
  );
}

// Copy a link: the button says *Copied* — announced through a polite live
// region — or *Couldn't copy*, and then the link sits in a read-only field to
// select by hand (Constraint 9) — unless the link is already in a field beside
// it (`byHand` false). A missing clipboard (an insecure context) is a
// failed copy, never a silent one.
export function CopyLinkButton({ url, label = t('sharing.copyLink'), fieldLabel = t('sharing.linkLabel'), className = 'btn', byHand = true }) {
  const [state, setState] = useState('idle'); // 'idle' | 'copied' | 'failed'
  const copy = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
  };
  const word = state === 'copied' ? t('sharing.copied') : state === 'failed' ? t('sharing.couldNotCopy') : label;
  return (
    <>
      <Button className={className} onPress={copy}>
        {word}
      </Button>
      <span className="est-sr" aria-live="polite">
        {state === 'copied' ? t('sharing.copied') : state === 'failed' ? t('sharing.couldNotCopy') : ''}
      </span>
      {state === 'failed' && byHand ? (
        <TextField className="field est-sharing-byhand" value={url} aria-label={fieldLabel}>
          <Input className="input" readOnly />
          <span className="t-small">{t('sharing.copyByHand')}</span>
        </TextField>
      ) : null}
    </>
  );
}

// The close ✕ every sharing surface draws in its head.
export function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

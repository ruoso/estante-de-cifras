// SongSharePanel.jsx — *Share* on a song on a tablet or a computer
// (books.share_people; workflow 10 §Sharing a song, **Where it sits**; board W10
// #4): a panel beside the chart, inside the reading view's split — not a Modal.
// There is no scrim; the chart stays reachable and is never aria-hidden. The
// panel is a `complementary` region named "Share <song>"; opening it moves focus
// to its heading, and closing it (✕ or Escape) returns focus to Share.
//
// It holds the song's address for people already in the book, with Copy; for
// the owner, *Invite someone to this song* (an invitation that opens on it,
// books.share Decision 2) in the compact form #4 draws; and the book's people in
// one line with *Manage*, which opens the people screen.
//
// A song in a book only on this device has none of that yet: the panel holds
// ShareNeedsOnline instead, and asks Estante nothing until the book is put
// online (books.share_needs_online Constraint 2) — the loads live in the hosted
// body below, mounted only for a book on Estante.
//
// *Share* on a setlist is this panel with `itemKind="setlist"`
// (books.setlist_invitation; workflow 12 §Sharing one): `songPath`/`songTitle`
// then name the setlist, and only the words change — the address, an invitation
// that opens on the setlist, and a line that the invited join the whole book.

import { useEffect, useRef } from 'react';
import { Button } from 'react-aria-components';

import { t } from '../i18n/index.js';
import { bookSongPath } from './book-route.js';
import { leadsWithInvite, memberSummary, personLabel } from './people.js';
import { CreatedLink, InvitationForm, useCreateInvitation } from './NewInvitation.jsx';
import { SongAddress, itemShareCopy } from './ShareSheet.jsx';
import ShareNeedsOnline from './ShareNeedsOnline.jsx';
import { CloseIcon, LoadState, errorCopy, useSharing } from './sharing-parts.jsx';
import './sharing.css';

// Where focus goes back when the panel closes and the control that opened it is
// gone (the tablet's Share sits in the More menu): the reading view marks it.
const RETURN_SELECTOR = '[data-share-return]';

export default function SongSharePanel({
  store = null,
  bookId,
  title,
  role = null,
  isLocal = false,
  accountStatus = 'unknown',
  itemKind = 'song',
  songPath,
  songTitle = null,
  sharingClient,
  origin,
  onClose = () => {},
  onManage = () => {},
  onSignIn = () => {},
}) {
  const headingRef = useRef(null);
  const songName = songTitle ?? songPath;

  // Focus to the heading on open; back to what opened the panel on close.
  useEffect(() => {
    const opener = typeof document !== 'undefined' ? document.activeElement : null;
    headingRef.current?.focus();
    return () => {
      const target = opener && opener.isConnected && opener !== document.body ? opener : document.querySelector(RETURN_SELECTOR);
      target?.focus?.();
    };
  }, []);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    // The panel listens for Escape on its own subtree, as a dialog would; its
    // controls are the focusable parts.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside className="est-sharing-panel" aria-labelledby="est-songshare-title" onKeyDown={onKeyDown}>
      <div className="sheet-head">
        <h2 className="t-h2" id="est-songshare-title" ref={headingRef} tabIndex={-1}>
          {t('sharing.shareTitle', { name: songName })}
        </h2>
        <Button className="btn icon" aria-label={t('sharing.close')} onPress={onClose}>
          <CloseIcon />
        </Button>
      </div>
      <div className="est-sharing-panel-scroll">
        {isLocal ? (
          <ShareNeedsOnline
            store={store}
            bookId={bookId}
            bookTitle={title}
            accountStatus={accountStatus}
            onSignIn={onSignIn}
          />
        ) : (
          <HostedSongShare
            bookId={bookId}
            title={title}
            role={role}
            itemKind={itemKind}
            songPath={songPath}
            songName={songName}
            sharingClient={sharingClient}
            origin={origin}
            onManage={onManage}
          />
        )}
      </div>
    </aside>
  );
}

// The panel's body for a book on Estante: the song's address, the owner's
// invite, and the book's people — loaded on mount, so only ever mounted for a
// hosted book (a put-online mounts it fresh under the book's new id).
function HostedSongShare({ bookId, title, role, itemKind, songPath, songName, sharingClient, origin, onManage }) {
  const isOwner = role === 'owner';
  const { client, members, invitations, loadError, reload } = useSharing({ client: sharingClient, bookId, isOwner });
  const creating = useCreateInvitation({ client, bookId, songPath, onCreated: () => reload() });
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const copy = itemShareCopy(itemKind, { book: title, name: songName });

  const count = members?.count ?? 0;
  const limit = members?.limit ?? 50;
  const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
  const invCount = invitations?.invitations?.length ?? 0;
  const summary = isOwner
    ? `${memberSummary(members?.members ?? [], { t, you: false })} · ${t('sharing.invitationsCount', { count: invCount })}`
    : (members?.members ?? []).map((m) => personLabel(m, { t })).join(', ');

  // While nobody but the owner is in the book, the invite comes straight after
  // the opening line and the address follows it (workflow 10 §Nobody in the
  // book yet); while the people load, or cannot, the address comes first.
  const leads = leadsWithInvite({ isOwner, members: loadError ? null : members });
  const address = (
    <SongAddress
      songAddress={`${base}${bookSongPath(bookId, songPath)}`}
      songTitle={songName}
      addressLabel={copy.addressLabel}
    />
  );

  return (
    <>
      <p className="t-small">{copy.intro}</p>
      {leads ? null : address}
      {loadError || members == null ? (
        <LoadState error={loadError} onRetry={reload} />
      ) : (
        <>
          {isOwner ? (
            <>
              {leads ? null : <div className="est-sharing-rule" />}
              <div className="t-h3">{copy.invite}</div>
              <p className="t-small">{copy.inviteBody}</p>
              {creating.error ? (
                <p className="notice warn" role="alert">
                  {errorCopy(creating.error)}
                </p>
              ) : null}
              {creating.link ? (
                <CreatedLink link={creating.link} onDone={creating.reset} />
              ) : (
                <InvitationForm
                  compact
                  intro={false}
                  bookTitle={title}
                  count={count}
                  limit={limit}
                  busy={creating.busy}
                  onCreate={creating.create}
                />
              )}
            </>
          ) : null}
          {leads ? (
            <>
              <div className="est-sharing-rule" />
              {address}
            </>
          ) : null}
          <div className="est-sharing-rule" />
          <div className="est-sharing-people-head">
            <span className="t-h3 grow">{t('sharing.people')}</span>
            <span className="est-sharing-count">{t('sharing.countOfLimit', { count, limit })}</span>
          </div>
          <div className="bar" role="img" aria-label={t('sharing.countOfLimit', { count, limit })}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <div className="est-sharing-terms">
            <span className="t-small grow">{summary}</span>
            <Button className="btn quiet" onPress={onManage}>
              {isOwner ? t('sharing.manage') : t('sharing.seePeople')}
            </Button>
          </div>
        </>
      )}
    </>
  );
}

// ShareSheet.jsx — *Share* on a phone (books.share_people; workflow 10 **Where it
// sits**; board W10 #1): a bottom sheet that sums a book's people up — *37 of
// 50*, the members counted by role, the invitations — and leads to the people
// screen (its Members row and each invitation row) and to a new invitation
// (*Invite people*), each a screen of its own that AppShell mounts.
//
// *Share* on a song, on a phone, is this sheet with the song's part on top: the
// address members open it at, with Copy, and — for the owner — *Invite someone
// to this song*, whose link opens on the song (books.share Decision 2). A
// member's sheet shows what a member sees: their role in a word, the count, and
// who shares the book and saves to it.
//
// *Share* on a setlist is the same sheet with `itemKind="setlist"`
// (books.setlist_invitation; workflow 12 §Sharing one): `songPath`/`songTitle`
// then name the setlist, and only the words change.
//
// A song in a book only on this device has no one to share it with yet: the
// sheet holds ShareNeedsOnline instead, and asks Estante nothing until the book
// is put online (books.share_needs_online Constraint 2) — the loads live in the
// hosted body, mounted only for a book on Estante.
//
// A RAC Modal sheet, portaled into the `.est` token root by the app-wide
// provider (books.share Decision 4).

import { useState } from 'react';
import { Button, Dialog, Heading, Input, Modal, ModalOverlay, TextField } from 'react-aria-components';

import { currentLocale, t } from '../i18n/index.js';
import { bookSongPath } from './book-route.js';
import { invitationShort, invitationTitle, leadsWithInvite, memberSummary, personLabel } from './people.js';
import ShareNeedsOnline from './ShareNeedsOnline.jsx';
import { CreatedLink, InvitationForm, useCreateInvitation } from './NewInvitation.jsx';
import { ChevronIcon, CloseIcon, CopyLinkButton, LoadState, PeopleBar, errorCopy, useSharing } from './sharing-parts.jsx';
import './sharing.css';

// A row that leads somewhere (the Members row, an invitation row): a button
// carrying a name, a meta line and a chevron.
function NavRow({ name, meta, onPress, icon = null }) {
  return (
    <Button className="row est-sharing-nav" onPress={onPress}>
      {icon}
      <span className="grow">
        <span className="name">{name}</span>
        <span className="meta">{meta}</span>
      </span>
      <ChevronIcon />
    </Button>
  );
}

function PersonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

// A song's part of the sheet (and of the wide panel): the address members open
// it at, with Copy (workflow 10 §Sharing a song).
export function SongAddress({ songAddress, songTitle, addressLabel = t('sharing.songAddressLabel') }) {
  return (
    <div className="est-sharing-song">
      <div className="t-h3">{t('sharing.songForMembers')}</div>
      <p className="t-small">{t('sharing.songForMembersBody', { name: songTitle })}</p>
      <div className="est-sharing-linkrow">
        <TextField className="field grow" value={songAddress} aria-label={addressLabel}>
          <Input className="input" readOnly />
        </TextField>
        <CopyLinkButton url={songAddress} label={t('sharing.copy')} byHand={false} />
      </div>
    </div>
  );
}

// The words that differ between Share on a song and Share on a setlist
// (workflow 10 §Sharing a song or a setlist): the intro (for a setlist, that the
// invited join the whole book), the invite's heading and body, and the address
// field's label. `name` is the song's or setlist's.
export function itemShareCopy(itemKind, { book, name }) {
  if (itemKind === 'setlist') {
    return {
      intro: t('sharing.setlistShareIntro', { book, setlist: name }),
      invite: t('sharing.setlistInvite'),
      inviteBody: t('sharing.setlistInviteBody', { book, setlist: name }),
      addressLabel: t('sharing.setlistAddressLabel'),
    };
  }
  return {
    intro: t('sharing.songShareIntro', { book }),
    invite: t('sharing.songInvite'),
    inviteBody: t('sharing.songInviteBody', { book, song: name }),
    addressLabel: t('sharing.songAddressLabel'),
  };
}

/**
 * The Share sheet. `title` is the book's; `songPath`/`songTitle` make it a
 * song's sheet — or, with `itemKind="setlist"`, a setlist's (the names stay the
 * song's: they name the shared item). `onOpenPeople` and `onNewInvitation` are AppShell's: each
 * closes the sheet and opens that screen.
 */
export default function ShareSheet({
  store = null,
  bookId,
  title,
  role = null,
  isLocal = false,
  accountStatus = 'unknown',
  itemKind = 'song',
  songPath = null,
  songTitle = null,
  sharingClient,
  origin,
  onClose = () => {},
  onOpenPeople = () => {},
  onNewInvitation = () => {},
  onSignIn = () => {},
}) {
  const isOwner = role === 'owner';
  const songName = songTitle ?? songPath;
  const body = isLocal ? (
    <ShareNeedsOnline store={store} bookId={bookId} bookTitle={title} accountStatus={accountStatus} onSignIn={onSignIn} />
  ) : (
    <HostedShareBody
      bookId={bookId}
      title={title}
      role={role}
      itemKind={itemKind}
      songPath={songPath}
      songName={songName}
      sharingClient={sharingClient}
      origin={origin}
      onOpenPeople={onOpenPeople}
      onNewInvitation={onNewInvitation}
    />
  );

  const roleChip =
    !isOwner && role ? (
      <span className="chip">{role === 'editor' ? t('sharing.youAreEditor') : t('sharing.youAreReader')}</span>
    ) : null;

  return (
    <ModalOverlay className="scrim" isOpen onOpenChange={(open) => !open && onClose()} isDismissable>
      <Modal className="sheet est-sharing">
        <Dialog>
          <div className="grip" aria-hidden="true" />
          <div className="sheet-head">
            <Heading slot="title" className="t-h2">
              {t('sharing.shareTitle', { name: songPath ? songName : title })}
            </Heading>
            {roleChip}
            <Button className="btn icon" aria-label={t('sharing.close')} onPress={onClose}>
              <CloseIcon />
            </Button>
          </div>
          <div className="scroll est-sharing-scroll">
            <div className="est-sharing-body">{body}</div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// The sheet's body for a book on Estante: the people and invitations, loaded on
// mount — so only ever mounted for a hosted book (a put-online mounts it fresh
// under the book's new id) — and, on a song's sheet, the song's part.
function HostedShareBody({ bookId, title, role, itemKind, songPath, songName, sharingClient, origin, onOpenPeople, onNewInvitation }) {
  const isOwner = role === 'owner';
  const locale = currentLocale();
  const { client, members, invitations, loadError, reload } = useSharing({ client: sharingClient, bookId, isOwner });
  const [songInviting, setSongInviting] = useState(false);
  const creating = useCreateInvitation({ client, bookId, songPath, onCreated: () => reload() });
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');

  const list = members?.members ?? [];
  const invs = invitations?.invitations ?? [];

  // Who a member sees, by name (#6): the owner and the editors.
  const visibleNames = list.map((m) => personLabel(m, { t })).join(', ');
  const owner = list.find((m) => m.role === 'owner');
  const ownerShown = owner?.displayName?.trim() || t('sharing.itsOwner');
  const copy = itemShareCopy(itemKind, { book: title, name: songName });
  const intro = songPath
    ? copy.intro
    : isOwner
      ? t('sharing.intro')
      : t(role === 'editor' ? 'sharing.memberIntroEditor' : 'sharing.memberIntroReader', { owner: ownerShown });

  let body;
  if (loadError || members == null) {
    body = <LoadState error={loadError} onRetry={reload} />;
  } else if (creating.link) {
    body = (
      <CreatedLink
        link={creating.link}
        onDone={() => {
          creating.reset();
          setSongInviting(false);
        }}
      />
    );
  } else if (songInviting) {
    body = (
      <>
        <p className="t-small">{copy.inviteBody}</p>
        {creating.error ? (
          <p className="notice warn" role="alert">
            {errorCopy(creating.error)}
          </p>
        ) : null}
        <InvitationForm
          bookTitle={title}
          count={members.count}
          limit={members.limit}
          intro={false}
          busy={creating.busy}
          onCreate={creating.create}
          onCancel={() => setSongInviting(false)}
        />
      </>
    );
  } else {
    // While nobody but the owner is in the book, the invite comes straight
    // after the opening line, above the address and the people (workflow 10
    // §Nobody in the book yet); otherwise the usual order.
    const leads = leadsWithInvite({ isOwner, members });
    const address = songPath ? (
      <SongAddress
        songAddress={`${base}${bookSongPath(bookId, songPath)}`}
        songTitle={songName}
        addressLabel={copy.addressLabel}
      />
    ) : null;
    const invite = isOwner ? (
      <Button
        className="btn primary block est-sharing-invite-btn"
        onPress={() => (songPath ? setSongInviting(true) : onNewInvitation())}
      >
        {songPath ? copy.invite : t('sharing.invitePeople')}
      </Button>
    ) : null;
    body = (
      <>
        {leads ? null : address}
        <p className="t-small">{intro}</p>
        {/* The limit, told to whoever invites (books.put_online_confirm
            Constraint 6; workflow 10 §At most fifty): the owner, from a book,
            song or setlist share alike — every invitation joins the book. */}
        {isOwner ? <p className="t-small">{t('sharing.limitHint')}</p> : null}
        {leads ? (
          <>
            {invite}
            {address}
          </>
        ) : null}
        <PeopleBar count={members.count} limit={members.limit} bookTitle={title} />
        <NavRow
          icon={<PersonIcon />}
          name={t('sharing.members')}
          meta={isOwner ? memberSummary(list, { t }) : visibleNames}
          onPress={onOpenPeople}
        />
        {isOwner && !songPath ? (
          <>
            <div className="est-sharing-rule" />
            <div className="t-h3">{t('sharing.invitations')}</div>
            {invs.length ? (
              <div className="list">
                {invs.map((inv) => (
                  <NavRow
                    key={inv.id}
                    name={invitationTitle(inv, { t, locale })}
                    meta={invitationShort(inv, list, { t, locale })}
                    onPress={onOpenPeople}
                  />
                ))}
              </div>
            ) : (
              <p className="t-small">{t('sharing.noInvitations')}</p>
            )}
          </>
        ) : null}
        {leads ? null : invite}
      </>
    );
  }

  return body;
}

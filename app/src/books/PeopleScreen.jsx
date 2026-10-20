// PeopleScreen.jsx — a book's people (books.share_people; workflow 10 §Who sees
// whom, §Invitations, §Removing someone, or lowering their role; board W10 #3,
// #5, #6). A full screen over the shell, mounted from AppShell as FileView is,
// with Back through its closers: on a phone it is reached from the Share sheet's
// Members row and invitation rows; on a tablet or a computer *Share* opens it
// directly (workflow 10 **Where it sits**).
//
// The owner sees the count against fifty with the room left (or *Full*, #5),
// every member by the name they give their saves — never an account id — with
// the invitation they joined through, a role menu and Remove (a centred alert
// dialog, no typed name: Decision 5); the first four readers, then *Show {n}
// more readers*; and every invitation with its state in a word, its terms, who
// joined through it, *Copy link* while it can still let someone in, and
// Withdraw. A member (#6) sees who shares the book and who saves to it — the
// service lists no other reader — and no controls.

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  Disclosure,
  DisclosurePanel,
  Heading,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
} from 'react-aria-components';

import { currentLocale, t } from '../i18n/index.js';
import {
  canCopyLink,
  invitationState,
  invitationTitle,
  joinedSummary,
  joinedThrough,
  personLabel,
  roomLeft,
  shortDate,
  usesLeft,
} from './people.js';
import { NewInvitationDialog, TERMS_KEY } from './NewInvitation.jsx';
import { BackIcon, CopyLinkButton, LoadState, errorCopy, useSharing } from './sharing-parts.jsx';
import './sharing.css';

// The first readers listed before *Show {n} more readers* (W10 #3).
const READERS_SHOWN = 4;

const named = (m) => typeof m?.displayName === 'string' && m.displayName.trim() !== '';

const roleWord = (role) =>
  role === 'owner' ? t('sharing.roleOwner') : role === 'editor' ? t('sharing.roleEditor') : t('sharing.roleReader');

// A member's meta line: the invitation they joined through (Decision 7), else
// what their role does.
function memberMeta(member, invitations, locale) {
  const through = joinedThrough(member, invitations);
  const date = through ? shortDate(through.createdAt, locale) : null;
  if (through && date) {
    return t(through.role === 'editor' ? 'sharing.throughEditor' : 'sharing.throughReader', { date });
  }
  return t(member.role === 'editor' ? 'sharing.editorMeta' : 'sharing.readerMeta');
}

// Removing someone (#3; workflow 10 §Removing someone): a centred alert dialog
// in whole, pronoun-free sentences (Decision 8), no typed name (Decision 5).
function RemoveDialog({ member, invitations, room, locale, onCancel, onRemove }) {
  const name = named(member) ? member.displayName.trim() : null;
  const editor = member.role === 'editor';
  const title = name
    ? t('sharing.removeTitle', { name })
    : t(editor ? 'sharing.removeTitleEditor' : 'sharing.removeTitleReader');
  const through = joinedThrough(member, invitations);
  const date = through ? shortDate(through.createdAt, locale) : null;
  const joined = date
    ? `${t(through.role === 'editor' ? 'sharing.removeJoinedEditor' : 'sharing.removeJoinedReader', {
        name: name ?? t('sharing.thisPerson'),
        date,
      })} `
    : '';
  return (
    <ModalOverlay className="scrim center" isOpen isDismissable onOpenChange={(open) => !open && onCancel()}>
      <Modal className="dialog est-sharing-dialog">
        <Dialog role="alertdialog">
          <Heading slot="title" className="t-h1">
            {title}
          </Heading>
          <p className="t-body">{`${joined}${t('sharing.removeEffect')}`}</p>
          <p className="t-small">{t('sharing.removeStays', { count: room + 1 })}</p>
          <div className="actions">
            <Button className="btn" onPress={onCancel}>
              {t('sharing.cancel')}
            </Button>
            <Button className="btn danger" onPress={() => onRemove(member)}>
              {name ? t('sharing.removeConfirm', { name }) : t('sharing.removeConfirmUnnamed')}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// One member row the owner manages: name, meta, the role menu and Remove.
function ManagedRow({ member, meta, onChangeRole, onRemove }) {
  const name = named(member) ? member.displayName.trim() : null;
  const label = personLabel(member, { t });
  const menuLabel = name
    ? t('sharing.changeRole', { name })
    : t(member.role === 'editor' ? 'sharing.changeRoleEditor' : 'sharing.changeRoleReader');
  return (
    <div className="row est-sharing-member">
      <span className="grow">
        <span className="name">{label}</span>
        <span className="meta">{meta}</span>
      </span>
      <MenuTrigger>
        <Button className="btn est-sharing-role" aria-label={menuLabel}>
          {`${roleWord(member.role)} ▾`}
        </Button>
        <Popover className="popover" placement="bottom end">
          <Menu className="menu" aria-label={menuLabel} onAction={(key) => onChangeRole(member, String(key))}>
            {member.role !== 'editor' ? <MenuItem id="editor">{t('sharing.makeEditor')}</MenuItem> : null}
            {member.role !== 'reader' ? <MenuItem id="reader">{t('sharing.makeReader')}</MenuItem> : null}
          </Menu>
        </Popover>
      </MenuTrigger>
      <Button className="btn quiet est-sharing-remove" onPress={() => onRemove(member)}>
        {t('sharing.remove')}
      </Button>
    </div>
  );
}

// A read-only row: the owner's own, and every row a member sees (#6).
function PlainRow({ label, meta, badge }) {
  return (
    <div className="row est-sharing-member">
      <span className="grow">
        <span className="name">{label}</span>
        <span className="meta">{meta}</span>
      </span>
      {badge ? <span className="badge">{badge}</span> : null}
    </div>
  );
}

const STATE_WORD = {
  open: 'sharing.stateOpen',
  withdrawn: 'sharing.stateWithdrawn',
  usedUp: 'sharing.stateUsedUp',
  expired: 'sharing.stateExpired',
};

// One invitation card (#3): title, its state in a word, *Copy link* while it
// can let someone in (Decision 4), Withdraw, its terms, who joined through it.
function InvitationCard({ invitation, members, locale, onWithdraw }) {
  const state = invitationState(invitation);
  const left = usesLeft(invitation);
  const terms = `${t(`sharing.${TERMS_KEY[invitation.expiry] ?? 'termsWeek'}`)} · ${
    left === null ? t('sharing.usesNoLimit') : t('sharing.usesLeft', { count: left })
  }`;
  return (
    <div className="card pad est-sharing-invite">
      <div className="est-sharing-invite-head">
        <span className="t-h3 grow">{invitationTitle(invitation, { t, locale })}</span>
        <span className={state === 'open' ? 'badge ok' : 'badge'}>{t(STATE_WORD[state])}</span>
        {canCopyLink(invitation) ? <CopyLinkButton url={invitation.url} className="btn est-sharing-copy" /> : null}
        {invitation.withdrawn ? null : (
          <Button className="btn quiet" onPress={() => onWithdraw(invitation)}>
            {t('sharing.withdraw')}
          </Button>
        )}
      </div>
      <span className="t-small">{terms}</span>
      <span className="t-small">
        <b>{t('sharing.joinedThrough')}</b> {joinedSummary(invitation, members, { t, locale })}
      </span>
    </div>
  );
}

/**
 * The people screen. `role` is the caller's (from the shelf); `mode` picks the
 * New invitation's place — the phone's own screen (`onNewInvitation`, raised to
 * AppShell) or, wide, a centred dialog over this screen. `ownerName` is the
 * shelf's name for the owner, a member's fallback when the service sends none.
 * `autoFocusTitle` sends focus to the screen's title once on mount — the shell
 * sets it when a New invitation screen made from here closes and this screen
 * re-mounts (shell.surface_restore_focus) — then calls `onTitleFocusReturned`.
 */
export default function PeopleScreen({
  bookId,
  title,
  role = null,
  mode = 'narrow',
  ownerName = null,
  sharingClient,
  onBack = () => {},
  onNewInvitation = null,
  autoFocusTitle = false,
  onTitleFocusReturned = () => {},
}) {
  const isOwner = role === 'owner';
  const locale = currentLocale();
  const { client, members, invitations, loadError, reload } = useSharing({ client: sharingClient, bookId, isOwner });
  const [actionError, setActionError] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [moreReaders, setMoreReaders] = useState(false);
  const membersHeading = useRef(null);
  // Back on this screen after the New invitation screen over it closed (the
  // screen's nodes are fresh): focus its title, so a screen reader says where it
  // is. One-shot on mount; the shell clears the flag once honoured.
  const titleRef = useRef(null);
  useEffect(() => {
    if (autoFocusTitle && titleRef.current) {
      titleRef.current.focus();
      onTitleFocusReturned();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (fn) => {
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (error) {
      setActionError(error);
    }
  };
  const withdraw = (inv) => act(() => client.withdrawInvitation(bookId, inv.id));
  const changeRole = (m, next) => act(() => client.changeMemberRole(bookId, m.userId, next));
  const remove = (m) => {
    setRemoving(null);
    act(() => client.removeMember(bookId, m.userId));
  };
  const newInvitation = () => {
    if (mode !== 'wide' && onNewInvitation) onNewInvitation();
    else setInviting(true);
  };

  const count = members?.count ?? 0;
  const limit = members?.limit ?? 50;
  const room = roomLeft(count, limit);
  const full = members != null && count >= limit;
  const list = members?.members ?? [];
  const invs = invitations?.invitations ?? [];
  const owner = list.find((m) => m.role === 'owner') ?? null;
  const editors = list.filter((m) => m.role === 'editor');
  const readers = list.filter((m) => m.role === 'reader');

  const heading = isOwner ? t('sharing.peopleTitle', { book: title }) : t('sharing.sharingTitle', { book: title });

  let body;
  if (loadError || members == null) {
    body = <LoadState error={loadError} onRetry={reload} />;
  } else if (isOwner) {
    const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
    const ownerLabel = owner && named(owner) ? t('sharing.youNamed', { name: owner.displayName.trim() }) : t('sharing.you');
    const rowFor = (m) => (
      <ManagedRow
        key={m.userId}
        member={m}
        meta={memberMeta(m, invs, locale)}
        onChangeRole={changeRole}
        onRemove={setRemoving}
      />
    );
    const hidden = readers.slice(READERS_SHOWN);
    body = (
      <>
        <div className="card pad est-sharing-countcard">
          <div className="est-sharing-people-head">
            <span className="t-h2 grow">{t('sharing.peopleOfLimit', { count, limit })}</span>
            <span className="t-small">{full ? t('sharing.noRoomLeft') : t('sharing.besidesYou', { count: room })}</span>
          </div>
          <div className="bar" role="img" aria-label={t('sharing.countOfLimit', { count, limit })}>
            <div style={{ width: `${pct}%` }} />
          </div>
          {full ? (
            <>
              <p className="notice conflict est-sharing-full" role="status">
                <span>{t('sharing.full', { name: title })}</span>
              </p>
              <div>
                <Button className="btn" onPress={() => membersHeading.current?.focus()}>
                  {t('sharing.reviewMembers')}
                </Button>
              </div>
            </>
          ) : (
            <span className="t-small">{t('sharing.peopleExplainer', { book: title })}</span>
          )}
        </div>
        {actionError ? (
          <p className="notice warn" role="alert">
            {errorCopy(actionError)}
          </p>
        ) : null}
        <h2 className="t-h3" ref={membersHeading} tabIndex={-1}>
          {t('sharing.members')}
        </h2>
        <div className="list">
          {owner ? <PlainRow label={ownerLabel} meta={t('sharing.ownerMeta')} badge={t('sharing.roleOwner')} /> : null}
          {editors.map(rowFor)}
          {readers.slice(0, READERS_SHOWN).map(rowFor)}
        </div>
        {hidden.length ? (
          <Disclosure isExpanded={moreReaders} onExpandedChange={setMoreReaders} className="est-sharing-more">
            <Button slot="trigger" className="btn quiet est-sharing-more-btn">
              {moreReaders
                ? t('sharing.showFewerReaders')
                : t('sharing.showMoreReaders', { count: hidden.length })}
            </Button>
            <DisclosurePanel>
              <div className="list">{hidden.map(rowFor)}</div>
            </DisclosurePanel>
          </Disclosure>
        ) : null}
        <h2 className="t-h3">{t('sharing.invitations')}</h2>
        {invs.length ? (
          <div className="est-sharing-invites">
            {invs.map((inv) => (
              <InvitationCard key={inv.id} invitation={inv} members={list} locale={locale} onWithdraw={withdraw} />
            ))}
            <p className="t-small">{t('sharing.withdrawNote')}</p>
          </div>
        ) : (
          <p className="t-small">{t('sharing.noInvitations')}</p>
        )}
      </>
    );
  } else {
    // A member's view (#6): who shares the book, who saves to it.
    const ownerShown = owner && named(owner) ? owner.displayName.trim() : ownerName || t('sharing.itsOwner');
    body = (
      <>
        <p className="t-small">
          {t(role === 'editor' ? 'sharing.memberIntroEditor' : 'sharing.memberIntroReader', { owner: ownerShown })}
        </p>
        <div className="list">
          {owner ? (
            <PlainRow
              label={named(owner) ? owner.displayName.trim() : ownerName || personLabel(owner, { t })}
              meta={t('sharing.sharesMeta')}
              badge={t('sharing.roleOwner')}
            />
          ) : null}
          {editors.map((m) => (
            <PlainRow key={m.userId} label={personLabel(m, { t })} meta={t('sharing.editorMeta')} badge={t('sharing.roleEditor')} />
          ))}
        </div>
      </>
    );
  }

  return (
    <section className="screen est-sharing-screen est-people" aria-labelledby="est-people-title">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('sharing.back')} onPress={onBack}>
          <BackIcon />
        </Button>
        <h1 className="title" id="est-people-title" ref={titleRef} tabIndex={-1}>
          {heading}
        </h1>
        {isOwner && full ? <span className="badge conflict">{t('sharing.stateFull')}</span> : null}
        {isOwner ? (
          <Button className="btn primary" onPress={newInvitation}>
            {t('sharing.newInvitation')}
          </Button>
        ) : role ? (
          <span className="chip">{role === 'editor' ? t('sharing.youAreEditor') : t('sharing.youAreReader')}</span>
        ) : null}
      </div>
      <div className="scroll est-sharing-scroll est-sharing-page">{body}</div>
      {removing ? (
        <RemoveDialog
          member={removing}
          invitations={invs}
          room={room}
          locale={locale}
          onCancel={() => setRemoving(null)}
          onRemove={remove}
        />
      ) : null}
      {inviting ? (
        <NewInvitationDialog
          bookId={bookId}
          title={title}
          client={client}
          count={members ? count : null}
          limit={limit}
          onClose={() => setInviting(false)}
          onCreated={() => reload()}
        />
      ) : null}
    </section>
  );
}

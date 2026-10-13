// SharingScreen.jsx — the owner's view and controls for sharing a hosted book,
// and the roster a plain member sees (books.share, workflow 10; board W10). An
// overlay reached from BookDetail (an owner-only Share card) and from a song's
// Share affordance (AppShell), mounted as a RAC Modal/Dialog portaled into the
// `.est` token root by the app-wide provider (Decision 4; shell.portal_provider).
//
// The surface shows PEOPLE N of 50 with the room remaining (the count is the
// service's, never the app's — Decision 5; workflow 10 L34), the role-grouped
// MEMBERS list with worded role chips, and — for the owner — the book's
// INVITATIONS. The owner makes an invitation (a role, an expiry, an optional
// use-limit), sees who joined through each, withdraws one, changes a member's
// role and removes a member (a typed-name confirm). A non-owner member sees the
// owner and editors and the count, never the other readers (the server filters),
// and gets no owner controls (workflow 10 L71-75).
//
// Sharing management is inherently online (Constraints — Offline-first, scoped):
// every call acts on the server registry, which has no local projection, so a
// refusal is worded as a "needs connection" / owner-only / not-available state,
// never queued. The client (sharing-client.js) runs on the main thread (Decision
// 1) and logs nothing; the invitation link is shown in the UI but never logged.
//
// Accessibility: React Aria Components throughout, a keyboard path and an
// accessible name for every control, role and state carried by a word (never
// colour alone), and the destructive remove is a typed-name confirm (the
// DeleteDialog pattern from BookDetail). axe (WCAG 2.1 AA) runs on every state in
// the behavior test.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Group,
  Heading,
  Input,
  Label,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  NumberField,
  Popover,
  Radio,
  RadioGroup,
  Switch,
  TextField,
} from 'react-aria-components';

import { t } from '../i18n/index.js';
import { createSharingClient, SharingError } from './sharing-client.js';
import { bookSongPath, invitationSongLink } from './book-route.js';
import './sharing.css';

const EXPIRY_CHOICES = ['day', 'week', 'month', 'until-withdrawn'];
const EXPIRY_KEY = {
  day: 'expiryDay',
  week: 'expiryWeek',
  month: 'expiryMonth',
  'until-withdrawn': 'expiryUntilWithdrawn',
};
const TERMS_KEY = {
  day: 'termsDay',
  week: 'termsWeek',
  month: 'termsMonth',
  'until-withdrawn': 'termsUntilWithdrawn',
};

// Word a refusal from the sharing client into a status the view shows. A refusal
// carries only code/status (no ids, no book), so the wording is generic by
// design (Constraints — no song text or secrets surfaced).
function errorCopy(error) {
  if (!(error instanceof SharingError)) return t('sharing.errGeneric');
  if (error.status === null || error.code === 'network') return t('sharing.errNetwork');
  if (error.status === 403) return t('sharing.errForbidden');
  if (error.status === 404) return t('sharing.errNotFound');
  return t('sharing.errGeneric');
}

// A member's shown label: a display name when the service sends one, else the
// opaque user id (Decision 3 — no friendly name in the first pass).
const memberLabel = (member) => member.displayName || member.userId;

// Copy text to the clipboard when the platform has one; a no-op otherwise (jsdom,
// an insecure context). The link also sits in a read-only field so it can be
// selected by hand, so a missing clipboard never traps the owner.
function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

// The typed-name confirm for removing a member (the BookDetail DeleteDialog
// pattern): the destructive button enables only on an exact match of the shown
// label. Removal is lazy server-side (workflow 10 L77-85), so the copy says so.
function RemoveMemberDialog({ member, onRemove }) {
  const label = memberLabel(member);
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === label;
  return (
    <DialogTrigger onOpenChange={(open) => open && setTyped('')}>
      <Button className="btn quiet est-sharing-remove">{t('sharing.remove')}</Button>
      <ModalOverlay className="scrim center">
        <Modal className="dialog">
          <Dialog>
            {({ close }) => (
              <>
                <Heading slot="title" className="t-h2">
                  {t('sharing.removeTitle', { name: label })}
                </Heading>
                <p className="t-body">{t('sharing.removeBody')}</p>
                <TextField className="field" value={typed} onChange={setTyped}>
                  <Label>{t('sharing.removeField', { name: label })}</Label>
                  <Input className="input" autoComplete="off" />
                </TextField>
                <div className="actions">
                  <Button className="btn" onPress={close}>
                    {t('sharing.cancel')}
                  </Button>
                  <Button
                    className="btn danger"
                    isDisabled={!matches}
                    onPress={() => {
                      onRemove(member);
                      close();
                    }}
                  >
                    {t('sharing.removeConfirm', { name: label })}
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

// One member row. For the owner it carries a role-change menu (editor⇄reader) and
// the remove confirm; for a member it is read-only. The owner's own row reads
// "You" and carries no controls (the owner is never invited or removed —
// workflow 10 L62-69).
function MemberRow({ member, isSelf, canManage, onChangeRole, onRemove }) {
  const label = isSelf ? t('sharing.you') : memberLabel(member);
  const metaKey =
    member.role === 'owner' ? 'ownerMeta' : member.role === 'editor' ? 'editorMeta' : 'readerMeta';
  const roleWord =
    member.role === 'owner'
      ? t('sharing.roleOwner')
      : member.role === 'editor'
        ? t('sharing.roleEditor')
        : t('sharing.roleReader');
  const manageable = canManage && member.role !== 'owner';
  return (
    <div className="row est-sharing-member">
      <span className="grow">
        <span className="name">{label}</span>
        <span className="meta">{t(`sharing.${metaKey}`)}</span>
      </span>
      <span className="badge">{roleWord}</span>
      {manageable ? (
        <>
          <MenuTrigger>
            <Button className="btn est-sharing-role" aria-label={t('sharing.changeRole', { name: label })}>
              {roleWord} ▾
            </Button>
            <Popover>
              <Menu
                className="menu"
                aria-label={t('sharing.changeRole', { name: label })}
                onAction={(key) => onChangeRole(member, String(key))}
              >
                {member.role !== 'editor' ? (
                  <MenuItem id="editor">{t('sharing.makeEditor')}</MenuItem>
                ) : null}
                {member.role !== 'reader' ? (
                  <MenuItem id="reader">{t('sharing.makeReader')}</MenuItem>
                ) : null}
              </Menu>
            </Popover>
          </MenuTrigger>
          <RemoveMemberDialog member={member} onRemove={onRemove} />
        </>
      ) : null}
    </div>
  );
}

// One invitation row (owner only): its role, a worded state (open / withdrawn /
// used up — never colour alone), its terms (expiry + uses remaining), who joined
// through it, and Withdraw (workflow 10 L40-60). The link is NOT re-shown here —
// it is shown exactly once at creation (Decision 6).
function InvitationRow({ invitation, onWithdraw }) {
  const roleWord =
    invitation.role === 'editor' ? t('sharing.roleEditor') : t('sharing.roleReader');
  const remaining = invitation.useLimit; // null = unlimited; a number = uses left
  const usedUp = remaining === 0;
  const state = invitation.withdrawn
    ? t('sharing.stateWithdrawn')
    : usedUp
      ? t('sharing.stateUsedUp')
      : t('sharing.stateOpen');
  const terms = t(`sharing.${TERMS_KEY[invitation.expiry] ?? 'termsWeek'}`);
  const uses =
    remaining === null || remaining === undefined
      ? t('sharing.usesNoLimit')
      : t('sharing.usesLeft', { count: remaining });
  const joiners = invitation.joined ?? [];
  const joinedText =
    invitation.joinedCount > 0
      ? `${t('sharing.joinedCount', { count: invitation.joinedCount })}${
          joiners.length ? ` · ${joiners.map(memberLabel).join(', ')}` : ''
        }`
      : t('sharing.joinedNobody');
  return (
    <div className="card pad est-sharing-invite">
      <div className="est-sharing-invite-head">
        <span className="t-h3 grow">{t('sharing.inviteRowTitle', { role: roleWord })}</span>
        <span className="badge">{state}</span>
        {invitation.withdrawn ? null : (
          <Button className="btn quiet" onPress={() => onWithdraw(invitation)}>
            {t('sharing.withdraw')}
          </Button>
        )}
      </div>
      <span className="t-small">{`${terms} · ${uses}`}</span>
      <span className="t-small">
        <b>{t('sharing.joinedThrough')}</b> {joinedText}
      </span>
    </div>
  );
}

// The new-invitation form (role, expiry, optional use-limit) — workflow 10
// L40-60; W10 phone L70-104. On create it hands the made invitation up; the
// caller shows the link once (Decision 6).
function InviteForm({ songPath, bookTitle, busy, onCreate, onCancel }) {
  const [role, setRole] = useState('reader');
  const [expiry, setExpiry] = useState('week'); // the default (workflow 10 L49-51)
  const [limitOn, setLimitOn] = useState(false);
  const [useLimit, setUseLimit] = useState(1);

  const submit = () => {
    const req = { role, expiry };
    if (limitOn) req.useLimit = Math.max(1, Math.round(useLimit || 1));
    onCreate(req);
  };

  return (
    <div className="est-sharing-form">
      <p className="t-small">
        {songPath ? t('sharing.songInviteBody', { book: bookTitle }) : t('sharing.inviteIntro')}
      </p>

      <RadioGroup className="field" value={role} onChange={setRole}>
        <Label>{t('sharing.role')}</Label>
        <div className="est-sharing-seg">
          <Radio className="est-sharing-seg-opt" value="reader">
            {t('sharing.roleReader')}
          </Radio>
          <Radio className="est-sharing-seg-opt" value="editor">
            {t('sharing.roleEditor')}
          </Radio>
        </div>
        <span className="t-small">{t('sharing.roleHelp')}</span>
      </RadioGroup>

      <RadioGroup className="field" value={expiry} onChange={setExpiry}>
        <Label>{t('sharing.expires')}</Label>
        <div className="est-sharing-expiry">
          {EXPIRY_CHOICES.map((choice) => (
            <Radio key={choice} className="est-sharing-expiry-opt" value={choice}>
              {t(`sharing.${EXPIRY_KEY[choice]}`)}
            </Radio>
          ))}
        </div>
      </RadioGroup>

      <div className="field est-sharing-limit">
        <Switch isSelected={limitOn} onChange={setLimitOn}>
          <span className="est-sharing-switch-track" aria-hidden="true">
            <span className="est-sharing-switch-thumb" />
          </span>
          {t('sharing.limitToggle')}
        </Switch>
        <span className="t-small">{t('sharing.limitHelp')}</span>
        {limitOn ? (
          <NumberField
            className="field"
            minValue={1}
            value={useLimit}
            onChange={(n) => setUseLimit(Number.isFinite(n) ? n : 1)}
          >
            <Label>{t('sharing.limitField')}</Label>
            <Group className="est-sharing-number">
              <Input className="input" />
            </Group>
          </NumberField>
        ) : null}
      </div>

      <div className="actions">
        <Button className="btn" onPress={onCancel} isDisabled={busy}>
          {t('sharing.cancel')}
        </Button>
        <Button className="btn primary" onPress={submit} isDisabled={busy}>
          {t('sharing.createLink')}
        </Button>
      </div>
    </div>
  );
}

// The made link, shown exactly once with a copy affordance and a note that it
// will not be shown again (Decision 6; acceptance 2). For a song share the link
// carries the song path as a client-only `#<path>` fragment (Decision 2).
function CreatedLink({ link, onDone }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="est-sharing-created">
      <p className="t-small est-sharing-linknote" role="status">
        {t('sharing.linkReady')}
      </p>
      <div className="est-sharing-linkrow">
        <TextField className="field grow" value={link} aria-label={t('sharing.linkLabel')}>
          <Input className="input" readOnly />
        </TextField>
        <Button
          className="btn"
          onPress={() => {
            copyToClipboard(link);
            setCopied(true);
          }}
        >
          {copied ? t('sharing.copied') : t('sharing.copy')}
        </Button>
      </div>
      <div className="actions">
        <Button className="btn primary" onPress={onDone}>
          {t('sharing.done')}
        </Button>
      </div>
    </div>
  );
}

export default function SharingScreen({
  bookId,
  title,
  role = null,
  songPath = null,
  onClose = () => {},
  sharingClient,
  origin,
}) {
  const clientRef = useRef(sharingClient ?? createSharingClient());
  const client = clientRef.current;
  const isOwner = role === 'owner';
  const base =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : '');

  const [members, setMembers] = useState(null);
  const [invitations, setInvitations] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState('main'); // 'main' | 'invite'
  const [created, setCreated] = useState(null); // the link shown once after create
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Load (and reload after an action) the members and, for an owner, the
  // invitations. Every setState happens past an `await`, so the mount effect
  // below triggers no synchronous render cascade (react-hooks/set-state-in-effect).
  const reload = useCallback(async () => {
    try {
      const nextMembers = await client.listMembers(bookId);
      setMembers(nextMembers);
      if (isOwner) {
        const nextInvites = await client.listInvitations(bookId);
        setInvitations(nextInvites);
      }
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    }
  }, [client, bookId, isOwner]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createInvitation = async (req) => {
    setBusy(true);
    setActionError(null);
    try {
      const invitation = await client.createInvitation(bookId, req);
      const link = songPath ? invitationSongLink(invitation.url, songPath) : invitation.url;
      setCreated({ link });
      setView('main');
      await reload();
    } catch (error) {
      setActionError(error);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (invitation) => {
    setActionError(null);
    try {
      await client.withdrawInvitation(bookId, invitation.id);
      await reload();
    } catch (error) {
      setActionError(error);
    }
  };

  const changeRole = async (member, nextRole) => {
    setActionError(null);
    try {
      await client.changeMemberRole(bookId, member.userId, nextRole);
      await reload();
    } catch (error) {
      setActionError(error);
    }
  };

  const remove = async (member) => {
    setActionError(null);
    try {
      await client.removeMember(bookId, member.userId);
      await reload();
    } catch (error) {
      setActionError(error);
    }
  };

  const headingName = title ?? bookId;
  const songAddress = songPath ? `${base}${bookSongPath(bookId, songPath)}` : null;

  // People summary — the service's count/limit, never the app's (Decision 5).
  const count = members?.count ?? 0;
  const limit = members?.limit ?? 50;
  const room = Math.max(0, limit - count);
  const isFull = members != null && count >= limit;
  const barPct = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;

  const byRole = (wanted) => (members?.members ?? []).filter((m) => m.role === wanted);
  const owners = byRole('owner');
  const editors = byRole('editor');
  const readers = byRole('reader');

  const summary = (
    <div className="est-sharing-people">
      <div className="est-sharing-people-head">
        <span className="t-h3 grow">{t('sharing.people')}</span>
        <span className="est-sharing-count">{t('sharing.countOfLimit', { count, limit })}</span>
      </div>
      <div className="bar" role="img" aria-label={t('sharing.countOfLimit', { count, limit })}>
        <div style={{ width: `${barPct}%` }} />
      </div>
      {isFull ? (
        <p className="notice conflict est-sharing-full" role="status">
          {t('sharing.full', { name: headingName })}
        </p>
      ) : (
        <span className="t-small">{t('sharing.roomForMore', { count: room })}</span>
      )}
    </div>
  );

  const membersSection = (
    <>
      <div className="t-h3">{t('sharing.members')}</div>
      <div className="list">
        {owners.map((m) => (
          <MemberRow key={m.userId} member={m} isSelf={isOwner} canManage={false} />
        ))}
        {editors.map((m) => (
          <MemberRow
            key={m.userId}
            member={m}
            isSelf={false}
            canManage={isOwner}
            onChangeRole={changeRole}
            onRemove={remove}
          />
        ))}
        {readers.map((m) => (
          <MemberRow
            key={m.userId}
            member={m}
            isSelf={false}
            canManage={isOwner}
            onChangeRole={changeRole}
            onRemove={remove}
          />
        ))}
      </div>
    </>
  );

  const invitationsSection = isOwner ? (
    <>
      <div className="t-h3">{t('sharing.invitations')}</div>
      {(invitations?.invitations ?? []).length ? (
        <div className="est-sharing-invites">
          {invitations.invitations.map((inv) => (
            <InvitationRow key={inv.id} invitation={inv} onWithdraw={withdraw} />
          ))}
          <p className="t-small">{t('sharing.withdrawNote')}</p>
        </div>
      ) : (
        <p className="t-small" role="status">
          {t('sharing.noInvitations')}
        </p>
      )}
    </>
  ) : null;

  // The share-a-song header: the plain address for members, and — for the owner —
  // the invite-to-this-song entry (workflow 10 L92-101; W10 computer L163-227).
  const songSection = songPath ? (
    <div className="est-sharing-song">
      <div className="t-h3">{t('sharing.songForMembers')}</div>
      <p className="t-small">{t('sharing.songForMembersBody', { name: title ?? bookId })}</p>
      <div className="est-sharing-linkrow">
        <TextField className="field grow" value={songAddress} aria-label={t('sharing.songAddressLabel')}>
          <Input className="input" readOnly />
        </TextField>
        <Button className="btn" onPress={() => copyToClipboard(songAddress)}>
          {t('sharing.copy')}
        </Button>
      </div>
    </div>
  ) : null;

  let bodyContent;
  if (loadError) {
    bodyContent = (
      <div className="est-sharing-body">
        <p className="notice warn" role="alert">
          {errorCopy(loadError)}
        </p>
        <div className="actions">
          <Button className="btn" onPress={reload}>
            {t('sharing.retry')}
          </Button>
        </div>
      </div>
    );
  } else if (members == null) {
    bodyContent = (
      <p className="t-small" role="status">
        {t('sharing.loading')}
      </p>
    );
  } else if (view === 'invite') {
    bodyContent = (
      <InviteForm
        songPath={songPath}
        bookTitle={title ?? bookId}
        busy={busy}
        onCreate={createInvitation}
        onCancel={() => setView('main')}
      />
    );
  } else if (created) {
    bodyContent = <CreatedLink link={created.link} onDone={() => setCreated(null)} />;
  } else {
    bodyContent = (
      <div className="est-sharing-body">
        {songSection}
        {isOwner ? (
          <p className="t-small">{t('sharing.intro')}</p>
        ) : (
          <p className="t-small">{t('sharing.memberIntro')}</p>
        )}
        {summary}
        {actionError ? (
          <p className="notice warn" role="alert">
            {errorCopy(actionError)}
          </p>
        ) : null}
        {membersSection}
        {invitationsSection}
        {isOwner ? (
          <Button className="btn primary block est-sharing-invite-btn" onPress={() => setView('invite')}>
            {songPath ? t('sharing.songInvite') : t('sharing.invitePeople')}
          </Button>
        ) : null}
      </div>
    );
  }

  const roleChip = !isOwner && role ? (
    <span className="chip">
      {role === 'editor' ? t('sharing.youAreEditor') : t('sharing.youAreReader')}
    </span>
  ) : null;

  return (
    <ModalOverlay className="scrim" isOpen onOpenChange={(open) => !open && onClose()} isDismissable>
      <Modal className="sheet est-sharing">
        <Dialog>
          {({ close }) => (
            <>
              <div className="grip" aria-hidden="true" />
              <div className="est-sharing-head">
                <Heading slot="title" className="t-h2 grow">
                  {t('sharing.shareTitle', { name: songPath ? title ?? bookId : headingName })}
                </Heading>
                {roleChip}
                <Button
                  className="btn icon"
                  aria-label={t('sharing.close')}
                  onPress={() => {
                    onClose();
                    close();
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </Button>
              </div>
              <div className="scroll est-sharing-scroll">{bodyContent}</div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

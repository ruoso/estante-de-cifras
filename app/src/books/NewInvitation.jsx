// NewInvitation.jsx — making an invitation (books.share_people; workflow 10
// §Invitations, §At most fifty people per book; board W10 #2, #4). The form is
// the role, the expiry (a week by default) and an optional use-limit, with the
// room-left callout: how many more people the book has room for, or — on a full
// book — that the link lets nobody in until someone is removed, while *Create
// link* stays enabled (the service allows it; books.share Decision 5).
//
// Where it sits (workflow 10 §Who sees whom, **Where it sits**): on a phone the
// New invitation screen (#2), a full screen over the shell mounted from AppShell
// with Back through its closers; on a tablet or a computer a centred dialog over
// the people screen (the SongArrange precedent, sheet-narrow / centred-wide). A
// song's sheet and panel carry the same form inline.
//
// The link a create returns can be copied again later from the people screen
// while it can still let someone in (Decision 3), so the made link is shown with
// Copy and Done, not as a once-only secret.

import { useState } from 'react';
import {
  Button,
  Dialog,
  Group,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  NumberField,
  Radio,
  RadioGroup,
  Switch,
  TextField,
} from 'react-aria-components';

import { t } from '../i18n/index.js';
import { invitationSongLink } from './book-route.js';
import { roomLeft } from './people.js';
import { BackIcon, CopyLinkButton, errorCopy, SendLinkButton, useSharing } from './sharing-parts.jsx';
import './sharing.css';

const EXPIRY_CHOICES = ['day', 'week', 'month', 'until-withdrawn'];
const EXPIRY_KEY = {
  day: 'expiryDay',
  week: 'expiryWeek',
  month: 'expiryMonth',
  'until-withdrawn': 'expiryUntilWithdrawn',
};
export const TERMS_KEY = {
  day: 'termsDay',
  week: 'termsWeek',
  month: 'termsMonth',
  'until-withdrawn': 'termsUntilWithdrawn',
};

// The room-left callout (W10 #2), or the full-book notice. Absent until the
// count is known.
function RoomCallout({ bookTitle, count, limit }) {
  if (count === null || count === undefined) return null;
  if (count >= limit) {
    return (
      <p className="notice conflict" role="status">
        <span>{t('sharing.fullCallout', { book: bookTitle })}</span>
      </p>
    );
  }
  return (
    <p className="notice accent">
      <span>{t('sharing.roomCallout', { book: bookTitle, count: roomLeft(count, limit) })}</span>
    </p>
  );
}

// The role, segmented (W10 #2, #4): a RAC RadioGroup.
function RolePicker({ role, onChange, help = true }) {
  return (
    <RadioGroup className="field" value={role} onChange={onChange}>
      <Label>{t('sharing.role')}</Label>
      <div className="est-sharing-seg">
        <Radio className="est-sharing-seg-opt" value="reader">
          {t('sharing.roleReader')}
        </Radio>
        <Radio className="est-sharing-seg-opt" value="editor">
          {t('sharing.roleEditor')}
        </Radio>
      </div>
      {help ? <span className="t-small">{t('sharing.roleHelp')}</span> : null}
    </RadioGroup>
  );
}

function TermsFields({ expiry, onExpiry, limitOn, onLimitOn, useLimit, onUseLimit }) {
  return (
    <>
      <RadioGroup className="field" value={expiry} onChange={onExpiry}>
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
        <Switch isSelected={limitOn} onChange={onLimitOn}>
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
            onChange={(n) => onUseLimit(Number.isFinite(n) ? n : 1)}
          >
            <Label>{t('sharing.limitField')}</Label>
            <Group className="est-sharing-number">
              <Input className="input" />
            </Group>
          </NumberField>
        ) : null}
      </div>
    </>
  );
}

/**
 * The invitation form. `count`/`limit` are the service's (null while loading);
 * `compact` is a song panel's form (#4): the role, then the terms in one line
 * with *Change* to open them. `onCreate(req)` receives the CreateInvitation
 * request body; `onCancel` adds a Cancel beside *Create link*.
 */
export function InvitationForm({ bookTitle, count = null, limit = 50, busy = false, onCreate, onCancel, compact = false, intro = true }) {
  const [role, setRole] = useState('reader');
  const [expiry, setExpiry] = useState('week'); // the default (workflow 10 §Invitations)
  const [limitOn, setLimitOn] = useState(false);
  const [useLimit, setUseLimit] = useState(1);
  const [termsOpen, setTermsOpen] = useState(!compact);

  const submit = () => {
    const req = { role, expiry };
    if (limitOn) req.useLimit = Math.max(1, Math.round(useLimit || 1));
    onCreate(req);
  };
  const uses = limitOn
    ? t('sharing.usesLeft', { count: Math.max(1, Math.round(useLimit || 1)) })
    : t('sharing.usesNoLimit');

  return (
    <div className="est-sharing-form">
      {intro ? <p className="t-small">{t('sharing.inviteIntro')}</p> : null}
      <RolePicker role={role} onChange={setRole} help={!compact} />
      {termsOpen ? (
        <TermsFields
          expiry={expiry}
          onExpiry={setExpiry}
          limitOn={limitOn}
          onLimitOn={setLimitOn}
          useLimit={useLimit}
          onUseLimit={setUseLimit}
        />
      ) : (
        <div className="est-sharing-terms">
          <span className="t-small grow">{`${t(`sharing.${TERMS_KEY[expiry]}`)} · ${uses}`}</span>
          <Button className="btn quiet" aria-label={t('sharing.changeTerms')} onPress={() => setTermsOpen(true)}>
            {t('sharing.change')}
          </Button>
        </div>
      )}
      {compact ? null : (
        <>
          <RoomCallout bookTitle={bookTitle} count={count} limit={limit} />
          <p className="t-small">{t('sharing.seeWhoJoins')}</p>
        </>
      )}
      <div className="actions">
        {onCancel ? (
          <Button className="btn" onPress={onCancel} isDisabled={busy}>
            {t('sharing.cancel')}
          </Button>
        ) : null}
        <Button className={compact ? 'btn primary block' : 'btn primary'} onPress={submit} isDisabled={busy}>
          {t('sharing.createLink')}
        </Button>
      </div>
    </div>
  );
}

// The made link, with Send (where the device can share), Copy and Done
// (workflow 10 §Sending the link). A song's invitation carries the song as a
// client-only `#<path>` fragment (books.share Decision 2).
export function CreatedLink({ link, onDone }) {
  return (
    <div className="est-sharing-created">
      <p className="t-small est-sharing-linknote" role="status">
        {t('sharing.linkReady')}
      </p>
      <div className="est-sharing-linkrow">
        <TextField className="field grow" value={link} aria-label={t('sharing.linkLabel')}>
          <Input className="input" readOnly />
        </TextField>
        <div className="est-sharing-linkbtns">
          <SendLinkButton url={link} />
          <CopyLinkButton url={link} label={t('sharing.copy')} byHand={false} />
        </div>
      </div>
      <div className="actions">
        <Button className="btn primary" onPress={onDone}>
          {t('sharing.done')}
        </Button>
      </div>
    </div>
  );
}

// Create, then show the link: the state every way in shares. `songPath` makes
// the shown link open on that song.
export function useCreateInvitation({ client, bookId, songPath = null, onCreated = () => {} }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [link, setLink] = useState(null);
  const create = async (req) => {
    setBusy(true);
    setError(null);
    try {
      const invitation = await client.createInvitation(bookId, req);
      setLink(songPath ? invitationSongLink(invitation.url, songPath) : invitation.url);
      onCreated(invitation);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, link, create, reset: () => setLink(null) };
}

function FormOrLink({ bookTitle, count, limit, creating, onDone, onCancel }) {
  if (creating.link) return <CreatedLink link={creating.link} onDone={onDone} />;
  return (
    <>
      {creating.error ? (
        <p className="notice warn" role="alert">
          {errorCopy(creating.error)}
        </p>
      ) : null}
      <InvitationForm
        bookTitle={bookTitle}
        count={count}
        limit={limit}
        busy={creating.busy}
        onCreate={creating.create}
        onCancel={onCancel}
      />
    </>
  );
}

/**
 * The phone's New invitation screen (#2): a full screen over the shell, its
 * own app bar and Back. It reads the book's count for the callout itself.
 */
export default function NewInvitationScreen({ bookId, title, sharingClient, onBack = () => {}, onCreated }) {
  const { client, members } = useSharing({ client: sharingClient, bookId, isOwner: false });
  const creating = useCreateInvitation({ client, bookId, onCreated });
  return (
    <section className="screen est-sharing-screen" aria-labelledby="est-newinv-title">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('sharing.back')} onPress={onBack}>
          <BackIcon />
        </Button>
        <h1 className="title" id="est-newinv-title">
          {t('sharing.newInvitation')}
        </h1>
      </div>
      <div className="scroll est-sharing-scroll est-sharing-page">
        <FormOrLink
          bookTitle={title}
          count={members ? members.count : null}
          limit={members?.limit ?? 50}
          creating={creating}
          onDone={onBack}
        />
      </div>
    </section>
  );
}

/**
 * The tablet's and computer's New invitation: a centred dialog over the people
 * screen, which hands down the count it already holds.
 */
export function NewInvitationDialog({ bookId, title, client, count, limit, onClose, onCreated }) {
  const creating = useCreateInvitation({ client, bookId, onCreated });
  return (
    <ModalOverlay className="scrim center" isOpen isDismissable onOpenChange={(open) => !open && onClose()}>
      <Modal className="dialog est-sharing-dialog">
        <Dialog>
          <Heading slot="title" className="t-h2">
            {t('sharing.newInvitation')}
          </Heading>
          <FormOrLink
            bookTitle={title}
            count={count}
            limit={limit}
            creating={creating}
            onDone={onClose}
            onCancel={onClose}
          />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

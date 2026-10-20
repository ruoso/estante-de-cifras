# 10. Share

Status: decided.

Opening a book on Estante to other people: students, a band. Taken ahead of
sync and conflicts because it decides what the service's registry holds
(DIRECTION §3.3), and what a link does in workflows 1 and 7.

## Who can open a book

**Only people the owner let in, each with an account, and at most fifty of
them.** There is no catalogue (nobody browses or searches other people's
books), no reading without signing in, and no link that opens a book to
whoever holds it. A book stays what it is meant to be — a class, a band —
and cannot drift into being public because a link was posted somewhere.

This is also what keeps the service's exposure small: books hold songs'
words, which are other people's copyrighted text, and a book reachable only
by a known group of named people is a songbook passed around a class, not a
lyrics site (DIRECTION §3.3).

A book on Estante starts private (workflow 7). Its owner opens it up from
*share*, on the book or on any of its songs, by **inviting people**, each a
**reader** or an **editor**. The service enforces all of it: a request
without a session is refused, and so is a reader's push.

## At most fifty people per book

A book has its owner and **at most fifty members**, readers and editors
together. The owner sees how many — *37 of 50* — in the sharing screen.

When the book is full, an invitation stops admitting anyone: opening it says
the book has reached its limit, and the owner is told someone tried. Making
room is removing someone. The service enforces the count, not the app.

Fifty is per book, not per invitation, because it is the book's reach that it
limits. A teacher with more students than that uses a book per class, or a
fork per class (workflow 11).

## Invitations

By link, not by email address: the owner makes an invitation for a role, and
sends it however they like. The service holds nobody's address before they
have agreed to anything.

**One invitation may be used by many people.** A teacher sends one link to a
whole class, a band one link to the band.

- Each invitation has an **expiry**, chosen when it is made — a day, a week
  (the default), a month, or until withdrawn — and optionally a **limit on
  uses**, down to one for an invitation meant for one person.
- The owner sees each invitation with **who has joined through it**, and can
  withdraw it: nobody new joins, and those who joined stay members.
- A forwarded invitation lets in whoever it reaches, up to the book's limit.
  The list of who joined is how the owner notices, and removing someone is
  the remedy.
- The owner can **copy an invitation's link** again from the sharing screen,
  on any of their devices, for as long as it can still let someone in. A
  withdrawn, expired or used-up invitation has no link to copy.

Opening an invitation asks the person to sign in, or to make an account —
a passkey, which takes seconds (workflow 7) — and then puts the book on their
shelf.

## Roles

- **Owner**: one per book. Shares it, invites, removes people, deletes the
  book.
- **Editor**: saves to the book.
- **Reader**: reads it, and keeps it on their shelf.

Only the owner invites, in the first pass.

## Who sees whom

The owner sees every member with their role, and every invitation with who
joined through it. Members see who the owner and the editors are — their
names are in the history anyway — but not the other readers.

Each person is named by the name they give their saves (DIRECTION §3.3).
Someone who has not given one yet reads *Unnamed reader* or *Unnamed editor*,
never an account's id.

**Where it sits.** *Share* on a book opens, on a phone, a sheet that sums the
book's people up — *37 of 50*, the members counted by role, the invitations —
and leads to the people screen and to a new invitation, each a screen of its
own. On a tablet or a computer it opens the people screen itself, with a new
invitation as a dialog over it. *Share* on a song is a panel beside the song
on a tablet or a computer, and the same sheet on a phone. A member's *Share*
opens the same places, showing what a member sees.

## Removing someone, or lowering their role

It takes effect at their next request to the service. What is on their device
stays; it cannot be recalled. The book becomes *no longer shared with you*
on their shelf (workflow 8).

An editor lowered to reader, or removed, with saves not yet pushed, is told
those saves can no longer go to the book, and is offered a fork (workflow 11)
or the download (workflow 7), so that nothing they wrote is lost.

## Leaving a book

A member — a reader or an editor — can end their own membership:
**Leave this book**, without asking the owner and without leaving Estante
(workflow 17). *Remove from my shelf* (workflow 7) is not leaving: it deletes
this device's copy and keeps the membership, so *Mine on Estante* offers the
book again. Leaving is the one that makes it stop.

**Where it sits.** On the book in the book-management screen, among the
book's verbs and below *Remove from my shelf*, shown only to a member: an
owner sees *Delete the book* there instead, and a book that is only on this
device has no membership to leave. A book the member already removed from
this shelf is still listed in *Mine on Estante*, and its row offers
**Leave** too, so nobody has to put a book back on the shelf in order to
leave it.

**The confirmation** names the book and its owner, and says what leaving
does: *Leave Choros da Ana? You will no longer open or sync it, on any of
your devices, and it is removed from this one. Ana can invite you again.*
What would be lost is counted, as *Remove from my shelf* counts it:

- **unsaved changes** — *2 songs with unsaved changes will be lost*;
- **saves not yet pushed**, for an editor — *3 saves have not reached the
  book and never will*, with **Make it my own first** (a fork, workflow 11,
  which carries those saves and the unsaved changes) and **Download first**
  (workflow 7) beside **Leave the book**, as for someone removed.

With nothing to lose, the confirmation is the sentence and two buttons,
**Leave the book** and **Cancel**. There is no typed name: leaving touches
nobody else's data, and an invitation undoes it. From *Mine on Estante* there
is nothing on this device to lose, so the confirmation is the sentence alone.

**What it does.** The membership ends on the service first; only then is the
book removed from this device. The book is gone from the shelf and from *Mine
on Estante*; the member can no longer clone, fetch or push it. On the
person's other devices it becomes *no longer shared with you* at their next
sync (workflow 8 §Losing access), their copy kept, as for someone removed.
The owner's people screen no longer lists them and the count drops by one;
the owner is not notified (telling people things is *Later*).

**It needs a connection**, like accepting an invitation: offline, the verb
says *Leaving needs a connection* and nothing changes. If the service refuses
or cannot be reached mid-way, the book stays on the shelf, a member still,
and the confirmation says it did not leave.

**Coming back** is an invitation like anyone's: one still valid lets them in
again, counted against the fifty.

Edge cases:

- **A fork of the book** is the person's own and is untouched; it stops
  following the original, which it now says is *no longer shared with you*
  (workflow 11 §When the original goes away).
- **An owner cannot leave** — handing ownership is *Later*; the way out is
  deleting the book (workflow 7) or the account (workflow 17).
- **Already removed by the owner** — the book is already *no longer shared
  with you*; there is nothing to leave, and the verb is not offered.

## A reader who wants to change something

Their edits stay unsaved on their device, as workflow 4 has it, and *save*
offers to make the book their own (workflow 11).

## Sharing a song

*Share* on a song shares its book: the invitation it makes opens on that song
once accepted. For someone already a member, the link is just the song's
address, `…/b/<book>/<path>`. There is no sharing one song apart from its
book.

A song in a book that is only on this device — *My songs* before it goes
online, or any book made here — has no one to share it with yet. Its
*Share* opens the same panel or sheet, and says so in words: *this book is
only on this device; put it online to invite people*, with the same line
*Put online* carries in the book's detail (workflow 7 §Putting a book
online: it goes online private). It offers *Put online* there; signed out,
it offers *Sign in to put it online* first, which opens the one sign-in
surface (workflow 13 §Signing in, or making an account) and comes back to
the same panel, where *Put online* is then one more press. Once the book is
online, the panel is the owner's ordinary song share, ready to invite.
Nothing in it asks Estante anything until *Put online* is pressed.

Explore Chords' link, which carried the song in the link itself, is not
brought over.

## A copyright notice

The service can withdraw a book's invitations, remove its members, or take
the book down altogether, by an admin action, and the owner is told why. This
is a process written down in the terms, not a feature of the app.

The action is an operator command run on the server, not an endpoint on the
public origin. Each action records the reason it was taken, durably, against
the book — the record behind *the owner is told why*. When a book is taken
down its repository stays in place, but it is unreachable: its owner and
members are refused git with that reason (a stranger, as always, learns
nothing), and the book shows as gone on every shelf (workflow 8). Surfacing
that reason inside the app is a later addition over the record the service
keeps.

## Later

- **Approving each person** before they join through an invitation.
- **Handing ownership** of a book to someone else.
- **Editors who invite.**
- **Forks inheriting their original's limit**, should forks of forks ever be
  used to reach more people than a book can hold.
- **Telling people a book changed.** *Your teacher updated Choros* is a real
  need, and the service knows when a book's ref moves. In the first pass the
  sync state on the shelf (workflow 8) says it.

# 10. Share

Status: decided.

Opening a book on Estante to other people: students, a band. Taken ahead of
sync and conflicts because it decides what the service's registry holds
(DIRECTION §3.3), and what a link does in workflows 1 and 7.

There is no catalogue in the first pass: nobody browses or searches other
people's books. So there is no *public* as distinct from *anyone with the
link*. A link is how a book reaches anyone.

## Two ways to open a book

A book on Estante starts private (workflow 7). Its owner opens it up from
*share*, on the book or on any of its songs, in two independent ways:

- **a read link**: anyone holding it can read the book and keep it on their
  shelf, with no account;
- **people**: each a **reader** or an **editor**, invited by link, who signs
  in to accept.

The service enforces both. A reader's push is refused by the service, not
merely hidden by the app.

The two trade differently. A read link costs its readers nothing and tells
the owner nothing: everyone holding it is the same, and ending one person's
access ends everyone's. An invitation costs each person an account, and buys
the owner names — who is in the class — and the means to remove one student
without disturbing the rest.

## The read link

`…/b/<book>?k=<secret>`, off until the owner turns it on.

Turning it off, or resetting it to a new secret, ends access for everyone
holding the old one. Their copy stays on their device as it is, stops
syncing, and is marked *no longer shared with you*.

The terms say a read link is for sharing with people you chose, not for
publishing.

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
- A forwarded invitation lets in whoever it reaches. The list of who joined
  is how the owner notices, and removing someone is the remedy.

Opening an invitation asks the person to sign in, or to make an account
(workflow 7), and then puts the book on their shelf.

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

## Removing someone, or lowering their role

It takes effect at their next request to the service. What is on their device
stays; it cannot be recalled.

An editor lowered to reader, or removed, with saves not yet pushed, is told
those saves can no longer go to the book, and is offered a fork (workflow 11)
or the download (workflow 7), so that nothing they wrote is lost.

## A reader who wants to change something

Their edits stay unsaved on their device, as workflow 4 has it, and *save*
offers to make the book their own (workflow 11).

## Sharing a song

*Share* on a song shares its book, with a link that opens on that song:
`…/b/<book>/<path>`, with the read link's secret when it is a read link.
There is no sharing one song apart from its book.

Explore Chords' link, which carried the song in the link itself, is not
brought over. If sharing one song out of a private book turns out to be
missed, it can come back; it needs no host.

## A copyright notice

The service can turn off a book's read link, or the book altogether, by an
admin action, and the owner is told why. This is a process written down in
the terms, not a feature of the app.

## Later

- **Approving each person** before they join through an invitation.
- **Handing ownership** of a book to someone else.
- **Editors who invite.**
- **Telling people a book changed.** *Your teacher updated Choros* is a real
  need, and the service knows when a book's ref moves. In the first pass the
  sync state on the shelf (workflow 8) says it.

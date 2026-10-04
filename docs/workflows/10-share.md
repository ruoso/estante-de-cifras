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

## Removing someone, or lowering their role

It takes effect at their next request to the service. What is on their device
stays; it cannot be recalled. The book becomes *no longer shared with you*
on their shelf (workflow 8).

An editor lowered to reader, or removed, with saves not yet pushed, is told
those saves can no longer go to the book, and is offered a fork (workflow 11)
or the download (workflow 7), so that nothing they wrote is lost.

## A reader who wants to change something

Their edits stay unsaved on their device, as workflow 4 has it, and *save*
offers to make the book their own (workflow 11).

## Sharing a song

*Share* on a song shares its book: the invitation it makes opens on that song
once accepted. For someone already a member, the link is just the song's
address, `…/b/<book>/<path>`. There is no sharing one song apart from its
book.

Explore Chords' link, which carried the song in the link itself, is not
brought over.

## A copyright notice

The service can withdraw a book's invitations, remove its members, or take
the book down altogether, by an admin action, and the owner is told why. This
is a process written down in the terms, not a feature of the app.

## Later

- **Approving each person** before they join through an invitation.
- **Handing ownership** of a book to someone else.
- **Editors who invite.**
- **Forks inheriting their original's limit**, should forks of forks ever be
  used to reach more people than a book can hold.
- **Telling people a book changed.** *Your teacher updated Choros* is a real
  need, and the service knows when a book's ref moves. In the first pass the
  sync state on the shelf (workflow 8) says it.

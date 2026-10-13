# 1. First run

Status: decided.

How someone reaches their first song (workflow 2) from nothing.

## Two ways in

People arrive by one of two doors, and the second may be the more common:

- **Cold**: they found the app and opened it. The shelf is empty.
- **Invited**: a teacher or a bandmate sent them a link to a book, or to one
  song in it. They want *that*, now, not a tour.

Neither door asks anything before showing something. Setup happens at the
moment it becomes visible, not up front.

## Cold

The first screen is search (workflow 2), with an empty shelf. The empty
state says what a book is, and offers the ways to fill the shelf:

- **write a song**, which goes into *My songs* (below);
- **add a book** by its link (workflow 7);
- **sign in** to bring back a shelf from another device (workflow 13);
- **open the example book**, songs written for the purpose that ship with
  the app.

No book on Estante can be read without an account (workflow 10), so the
example book comes with the app instead: *open the example book* puts it on
the shelf as a local book, and it is removed like any other. Nothing of it is
on the shelf until asked for, so it never has to be cleared out once real
books arrive.

### *My songs*

Every shelf has a local book called *My songs*, so *write a song* never has
to ask where the song goes. It is listed from the start and created — an
empty repository, no remote — when the first song is written into it. Until
then there is nothing to store.

## Invited

An invitation (workflow 10) opens the app on that book. It always asks the
person to sign in, or to make an account first — a passkey, which takes
seconds — since no book can be read without one. Then the book is cloned,
as the reader or editor the invitation makes them, and the first screen is
its song list, or the song the invitation was made from.

Until the account exists, the invited screen names neither the book nor its
owner — only that it is an invitation to a book on Estante. The service tells
whoever holds a link nothing about a book — alive, dead or full — without a
session, and a link cannot be told apart from a dead one until it is accepted;
so the book's name and the role it grants appear only once the person has
signed in and the invitation is accepted, on the shelf and the book it opens
on.

The user is on someone else's book until they choose to be more (workflow
11, fork).

**A link that no longer works** — an invitation expired or withdrawn, a book
that has reached its limit of people, a book's plain address opened by someone
who is not a member — cannot be cloned. The app says the link does not open
the book, and suggests asking whoever sent it for a new one; a full book says
so, so that the person knows to ask the owner. It does not say whose book it
is: a dead link should tell its holder nothing about the book.

## The instrument

Explore Chords made the instrument the app's identity and set it up before
anything else. Here the song comes first, so:

- The instrument in use defaults to a **standard guitar**, shown as a chip in
  the header, and changed from there.
- **The first time a song is opened**, the reading view says *playing on
  guitar — change?* once. That is the moment the choice shows, so it is the
  moment to ask. Dismissing it, or changing the instrument, means it is not
  asked again.

## The home book

Instruments, preferences and which variations are in use have to live
somewhere from the first minute. The home book (DIRECTION §3.2) starts
local, with no remote, and gains one when the user signs in. What happens
when the account already has a home book from another device is workflow
13's.

## Language

As Explore Chords did: the browser's language until one is chosen in the
header, then that one. The choice is a preference, so it lives in the home
book and follows the user to a new device.

## Theme

The app comes in three themes, drawn in [the mockups](../mockups/):
**Estante** (neutral, ink-blue chords), **Caderno** (paper, chords in red
pen, serif titles) and **Palco** (a dark stage, amber chords, a typeface
made to be read from a music stand). The user chooses one, from the same
place as the language.

Until they do, the theme is **automatic**: Estante while the device is in
light mode, Palco while it is in dark mode, following the device as it
changes. Two of the three are light and one is dark, so this is the one
pairing that respects what the device asks for. Choosing a theme replaces
automatic, and *automatic* stays one of the choices.

The choice is a preference, kept in the home book like the language, so it
follows the user to a new device. Automatic still follows each device's
own light or dark mode, so a phone in dark mode at a gig shows Palco while
the laptop at home shows Estante.

The chart itself never changes with the theme beyond colour and typeface:
which chord sits over which syllable is the song's, not the theme's.

# 12. Setlists

Status: decided.

An ordered list of songs, built for a gig, a lesson or a rehearsal, and played
through in order.

## The file

A setlist is a file in a book, `*.setlist.md`, by the same convention songs
use (DIRECTION §2.1). It is Markdown, so it reads as a list of links on any
git host:

```
# Bar do Zé, 10 October

1. [Garota de Ipanema](bossa/garota-de-ipanema.cifra.md)
   - key: D
2. [Corcovado](bossa/corcovado.cifra.md)
3. [Carinhoso](choro/carinhoso.cifra.md)
   - note: start from the B section
```

- The **title** is the level-1 heading, as in a song.
- The setlist is a **numbered list**, one item per song, each a **relative
  link** to a `*.cifra.md` file in the same book.
- Under an item, an optional list of **properties** for that song in this
  setlist: `key`, and `note`, free text.

It is short enough to define in the cifra.md specification, as a companion to the
song format, so that other tools can read it.

Where the setlist's file is shown beside its editor, a line under it says why
the links look as they do, without git's words: *The links start from
{folder}, so they keep working wherever the book’s files are copied.*

Setlists are found by the same search as songs, marked as setlists. Opening
one lists its songs.

## Songs from another book

**A setlist points only into its own book.** Links are relative, so the
setlist works on any git host and in the download. *Add to setlist* on a song
from another book copies the song into the setlist's book first, and says so.
A personal gig setlist built from songs in several books therefore lives in
*My songs*, with copies.

## The key

The band agrees to play *Garota* in D. That is the band's, so it lives in the
shared setlist, not in anyone's home book.

While a song is played from the setlist, `key` transposes it for reading
(workflow 2), over the user's own remembered transposition; outside the
setlist, the user's own applies again. It is a **target key**, not an
interval, so it reads the same whatever key the song is written in. To know
the interval it needs the song's own `key` property; when the song has none,
the setlist's `key` is shown as a note instead.

## Building one

*Add to setlist* is on every song, in search and in the reading view, and
chooses the setlist or makes a new one. Within a setlist, songs are reordered
by dragging and removed by swiping. Every change is an edit, saved like any
other (workflow 4).

**A setlist made from Add to setlist is not saved yet**, and says so. Making
it opens nothing — the person was adding a song from a song, and stays there
— and the file it writes is an unsaved change like any other (workflow 4:
one kind of unsaved change). Until its first save it reads **not saved yet**
where an edited setlist reads *unsaved changes*: in its badge, in the list of
setlists and in the editor's bar. Its badge sits under its title in the read
view, beside the book and song count; in the list of setlists the word sits
on the setlist's row; a saved setlist with nothing unsaved shows neither. It
is the same change underneath, named for what it is, so opening it does not
claim it was changed.

**Done leaves editing.** The editor's bar starts with **Done**, a word, where
an icon-only Back was: it returns to the setlist as read, keeping every
change, as leaving any unsaved change asks nothing (workflow 4). Save and
Discard stay as they are; Done is the one way out, not a second one beside
Back.

*Add song*, in a setlist being edited, searches the setlist's book. A song
already in the setlist is still listed, and says so in words — *Already in
this setlist · 1*, with its places — so nobody adds it twice by accident; it
can still be added again, since a setlist may come back to a song.

## Sharing one

A teacher builds this week's lesson as a setlist and wants the class to see
it. Sharing is per book (workflow 10), so *Share* on a setlist shares its
book, as *Share* on a song does (workflow 10 §Sharing a song or a setlist):
the invitation it makes opens on the setlist once accepted, and a member is
given the setlist's address, `…/b/<book>/<path>`. The people invited join the
whole book, and the surface says so in a line.

*Share* sits on the setlist being read: in its *More* menu on a phone, where
it opens the Share sheet, and as a button in its app bar on a tablet or a
computer, where it opens the panel beside the list. On a book only on this
device it says the book must go online first and offers to put it online, as
on a song. The people invited open the setlist as the book holds it, so a
change not yet saved reaches them once it is saved and synced (workflow 4,
workflow 8), as for a song.

## Playing through

*Play* goes through the songs one at a time, full screen.

- **Next and previous** by swiping, by tapping the edges of the screen, or by
  a page-turner pedal. Pedals send the keys a keyboard does, so the arrow and
  page keys are enough.
- **The screen is kept awake** while playing (the Wake Lock API).
- **Sync waits** until playing stops (workflow 8).
- **The next song's title** is shown at the end of each one.

Each person plays on their own instrument, with their own variations: the
setlist says nothing about instruments, since the songs' voicing blocks
already serve each person (workflow 2).

## Songs moved, renamed or deleted

Renaming or moving a song in the file view updates the links to it in the same
book's setlists, in the same save.

A link that still points at nothing — the song deleted, or moved by someone
using git on a computer — shows as *missing* in the setlist, is skipped when
playing, and offers to be pointed at a song.

# 19. Reading on a reMarkable

The reMarkable reader ([`docs/remarkable-reader.md`](../remarkable-reader.md))
shows the account's books on a reMarkable 2: the shelf, a book's songs and
setlists, a song at any key, a setlist played through. It writes nothing. This
document decides its screens; they are drawn, one bit at the panel's own size, in
[`docs/reader-mockups/`](../reader-mockups/).

They are not the web app's screens made smaller. The web app redraws freely —
a list scrolls, a popover opens over the page, a number ticks, a field shows a
spinner — because a phone redraws sixty times a second. **An e-ink screen
redraws in a few hundred milliseconds, and a large redraw flashes black.** On a
music stand a flash is the screen going dark in the middle of a bar. So the
reader is designed by its redraws: what changes, how much of the screen, and
how often.

## The refresh budget

Ten rules, in order of how much they matter. Every screen below follows them;
each screen ends with what its actions cost.

1. **One action, one redraw.** Every tap changes the screen once, when what it
   shows is complete. There are no intermediate states: no *Loading…* that is
   then replaced, no list that fills in row by row, no chart drawn before its
   shapes. A song opens in about a tenth of a second (the reader's measured
   budget); waiting that long on the old page is better than drawing twice.
2. **Nothing moves by itself.** No animation, no transition, no progress bar,
   no spinner, no blinking cursor, no relative time that ticks (*3 min ago*).
   Time is written as a time: *Synced at 14:32*.
3. **Paged, never scrolled.** Every list and every song is laid out in pages
   that fit the screen. Scrolling an e-ink screen is a stream of partial
   redraws that ghost; turning a page is one.
4. **Fixed chrome.** The bar at the top and the line at the bottom of a screen
   never move. Changing the content redraws the content region only; changing a
   word in the bar redraws that word only.
5. **Background news never redraws the screen.** A sync that brings a new
   version of a song, a new book, a shape found late — none of it changes what
   is on the screen. It shows on the next screen the person opens. The only
   exceptions are the two the person is waiting for: a pairing approved, and
   the sync word on the shelf.
6. **Black and white.** One bit: black ink on white paper, no greys, no tints,
   no shadows, strokes at least 2 px. A one-bit change can use the panel's fast
   black-and-white update, which is quicker and leaves less ghosting than a
   greyscale one. Emphasis is weight, size and inversion (white on black), never
   colour or grey.
7. **The pressed control answers at once, and nothing else does.** A tap inverts
   the control that was tapped — a small, fast update — so the person knows it
   took, while the next page is prepared. The page then changes in one redraw
   (rule 1).
8. **Choose, don't step.** A control that would redraw once per step — a key
   moved up a semitone at a time, a list paged to the letter M — is replaced by
   one that goes straight to the choice: a key grid, a letter row. One decision,
   one redraw.
9. **Prepare ahead.** The next page of a song, and the first page of the next
   song in a setlist, are laid out before they are asked for, so a turn shows a
   page that is ready.
10. **Big targets.** Rows are at least 120 px tall (about 13 mm on the rM2's
    226 dpi), controls at least 100 px; the left and right thirds of a page are
    whole turn zones. A finger on a slanted screen at a music stand is not a
    mouse.

Only the text and the strokes matter on paper, and the same is true here: the
screens below draw nothing that is not information.

## The screen

Portrait, 1404 × 1872 px. Every screen has the same three regions, which never
move:

```
┌──────────────────────────────────────────────┐
│ BAR      (140 px)  back · title · one action │
├──────────────────────────────────────────────┤
│                                              │
│                                              │
│ CONTENT  (the page)                          │
│                                              │
│                                              │
├──────────────────────────────────────────────┤
│ FOOT     (100 px)  ‹   page 2 of 5   ›       │
└──────────────────────────────────────────────┘
```

- **The bar**: *Back* (a word with its arrow, never the arrow alone) at the
  left, the screen's title, and at most one action at the right.
- **The content**: one page. Turned by a tap in its left or right third, a
  swipe, or the foot's arrows. On a list — the shelf, a book, a setlist —
  the rows are the targets, the whole width, so a list turns by a swipe or the
  foot's arrows only.
- **The foot**: where the page is (*2 of 5*) and the arrows, at its right. A
  screen with one page shows the foot without arrows rather than removing it,
  so the content never changes height.

The interface face is Atkinson Hyperlegible, as the app's; the chart's is
Figtree, as the app's default theme. Both are carried with the reader, with
Atkinson Hyperlegible Mono for a chart's verbatim blocks, whose columns a
proportional face would break. They are the app's own font files, byte for
byte.

## Pairing

The reader opens unpaired the first time, and after *Sign out*.

**Not paired** — one page, no bar actions:

> **Estante de Cifras**
> Your songbooks, on this reMarkable. Pair it with your account to bring them
> here. It reads; it never changes your songs.
>
> [ Pair with your account ]

*Pair with your account* replaces the page with the code — one redraw:

> **Pair this reMarkable**
> On your phone or computer, go to **estantedecifras.app/pair** and enter:
>
> # KQ7-4TM
>
> This code works until 14:42.
> [ Get a new code ]

The page then stays still: no countdown, no *waiting…* that changes. When the
code is approved the shelf replaces it — one redraw. When it expires, the code
is replaced by *That code has expired.* and *Get a new code* — one redraw, the
only change the page makes on its own. With no network: *This reMarkable is not
connected to Wi-Fi. Connect it in Settings and try again.*, in the code's
place, with *Get a new code* to try again. The code page's bar has **Back**, to
*Not paired*.

Costs: open the code — 1; approved — 1; expired — 1.

## The shelf

The screen the reader opens to once paired. Bar: **Estante** as the title; at
the right, **Sync** (a word).

Content: the books, in the shelf's order (home book, `shelf.json`), one row
each — the book's name large, and under it *32 songs · 4 setlists*. Ten rows
to a page.

The sync state is a line of the content's top, not of the bar: *Synced at
14:32*, *Not connected — showing what was synced at 09:10*, or *Syncing…*. It
is the one word on any screen that changes by itself (rule 5): set to
*Syncing…* when a sync begins and to *Synced at …* when it ends — two small
redraws of that line, and only while the shelf is on screen. A sync that
begins and ends while another screen is open changes nothing until the shelf
is opened again.

**Sync** starts a sync at once (the line changes) and does nothing else. A
book that arrived in the sync appears in the list on the next opening of the
shelf, not while it is on screen (rule 5).

Each row's second line counts what the book holds: *32 songs · 4 setlists*,
*1 song*; a book with no setlists says only its songs (*12 songs*) — nothing
drawn that is not information.

**Nothing yet:** *No books on your shelf yet. Books you add in Estante on your
phone or computer come here.*

At the foot's left, **Settings** — a word, not a gear — opens the one page of
settings (bar: **Back** to the shelf · *Settings*), in this order: **Account**,
*Paired with* and the account it is paired with; **Sync**, the shelf's sync
line as it was when the page opened (it does not change while the page is on
screen — rule 5's exception is the shelf's); **Shapes**, *11 shapes hidden —
the ones you know* with **Show all again** (the count redrawn when it is
pressed), or *No shapes hidden.* without the button; **This reader**,
*Version 0.1.0*; and **Sign out**, which asks once: pressed, it is replaced by
*Sign out of this reMarkable? Your books are removed from it; nothing changes
in your account.* with **Sign out** and **Cancel** — one redraw of that part of
the page — and the second *Sign out* signs out, returning to *Not paired*.

Costs: open a book — 1; turn a page — 1; Sync — 2 small (start, end).

## A book

Bar: **Back** (to the shelf) · the book's name.

Content: the book's **setlists first** — few, and what a gig opens — each a row
with its name and *12 songs*; then its **songs**, in the order the web app's
book page lists them, title large, artist under it. Ten rows to a page; a
setlist or a song is never split from its second line.

**The letter row.** A book of three hundred songs is thirty pages; turning to
*Samba de Uma Nota Só* one page at a time is twenty redraws. Above the foot, the
book shows two rows of thirteen letters — **A B C … Z**, two rows so each
letter is a full-size target (rule 10) — of which only the letters that
start a song are drawn as targets (the rest are not drawn at all, so there is
nothing to tap that leads nowhere). A letter turns to the page where that
letter starts — one redraw (rule 8). A song's letter is its title's first
letter without its accent (*Ária* under **A**, *Ção* under **C**); a title
that starts with a digit or a sign has no letter and is reached by turning. A
letter that starts no song leaves its place empty, so the letters never move.
The letter rows are part of the fixed chrome and never change while the book
is open — none is marked as the current one. They are not shown for a book of
two pages or fewer.

Back from a song or a setlist returns to the book at the page it was left on.

**Empty book:** *No songs in this book yet.*

Costs: open a song or a setlist — 1; turn a page — 1; a letter — 1.

## A song

The screen the reader exists for.

**Bar:** **Back** · the title (and, smaller, the artist) · at the right the
**key**, as a button showing where the song is: *C*, or while transposed,
*D (+2)*.

**Content: the chart, in pages.** The rows the web app's chart draws — the
section names, the bar lines, the sung lines with each chord over its words,
the notes — laid out the way the printed book is (books.print): in two columns
when the song's longest sung line, and its widest row of four bars, fit half
the page, else one; a column filled to its foot before the next begins; a sung
line, a block of bars and a section name with its first line never split. A
block of bars taller than a whole column — a long section written as one —
breaks between its rows of four, never inside one. The chart face is large
enough to read at arm's length on a stand.

**A song that is all chords** — a choro, an instrumental — is the hard case,
and the one the layout is sized for: 20 to 35 different chords, 45 to 95 bars,
two chords to a bar, `%` repeats, first and second endings. Its bars run in
**one column, four to a row**, each bar wide enough for two chords at the chart
size; a line of bars keeps its own breaks (a line of three bars is a row of
three), and an ending is a row of its own, its label (*1st*, *2nd* — the
ending's number, as the chart carries it) in the place of its first bar. Such a
song is two or three pages.

**Shapes on every page, for that page.** Under the chart, a strip of the shapes
of the chords **on this page**, in the order they first appear — so the person
never turns back to find a shape. A chord on two pages is on both pages'
strips. A song with few chords draws them large, four or five across; a song
with many draws them compact, eight to a row, as many rows as its busiest page
needs — section A of *Noites Cariocas* alone needs sixteen. The strip's height
is fixed for the song (the busiest page's), so the chart's pages are laid out
once and a turn never moves the strip. A shape carries the fingers the song
gives it. Shapes print alike — no *default* or *your shape* marks, as on paper
— since the person needs the shape, not where it came from. The notes a song
writes for its shapes (cifra.md §7.4; the web app's line under its shapes) have
no room in the strip: they follow the chart's last row, on its last page, as a
paragraph of notes.

**The strip pages when a page needs more.** The strip holds at most two rows of
eight. A page whose chords need more — the first page of *Três Estrelinhas*
needs 24 — says so in the strip's head, *Shapes on this page · 1–16 of 24*,
and the head carries its own ‹ and › with *1 of 2*. They turn **the strip
only**: one redraw of the strip, the chart left exactly where it is. Turning
the chart's page starts the next page's strip at its first shapes. The strip's
turn zones are its own buttons, never the chart's thirds, so a tap meant for the
shapes never turns the page.

**Hide the shapes you know.** A player who has G6 and Am under their fingers
does not need them drawn on every page, and every shape drawn takes room from
the music. **Tapping a diagram** inverts it and turns the strip's head into a
question — *C#° · x45320 — hide this shape in every song?* — with **Hide** and
**Cancel**: one redraw of the strip. *Hide* takes the shape out of every strip
on this reMarkable; the strip is laid out again, and when the song's busiest
page now needs fewer rows, the chart takes the room and is laid out again from
the bar at the top — one redraw. *Cancel* puts the head back — one redraw.

What is hidden is **this chord in this voicing on this tuning**: the frets, not
the name. A song that voices C#° another way shows that shape, since the person
has not said they know it; a song that writes the same chord another way
(*C7M* for *Cmaj7*) hides it too, as my shapes match by chord, not by spelling
(workflow 2). The strip's
head counts what it holds back — *Shapes on this page · 8 · 11 hidden* — and
**Show hidden** turns the strip to this page's hidden shapes — its head then
*Hidden on this page · 11*, with **Done** to turn it back — each a tap to show
again. *Settings* says how many are hidden, with **Show all again**. The list
is the reader's, kept on this reMarkable; it is never written to the account.

**Hide shapes.** At the foot's left, *Hide shapes* gives the chart the whole
page: the song is laid out again without the strip, from the bar that was at
the top of the page, so the person stays where they were — one redraw. A choro
of three pages may become two; *Três Estrelinhas* fits on one. *Show shapes*
brings the strip back the same way. The choice is the reader's, kept on this
reMarkable for every song (the reader writes nothing to the account). With the
shapes hidden, or a strip shorter than the grid, the key grid opens over the
bottom of the page, from the foot up, and closes the same way — one redraw
each, the chart under it unchanged.

**Turning.** The left or right third of the page, a swipe, or the foot's
arrows. The next page is already laid out (rule 9). At the last page, *next*
does nothing on its own (a song outside a setlist is not followed by anything);
the foot says *End*.

**The key.** Tapping the key button replaces the shapes strip — only the strip
— with the **key grid**, one redraw:

```
┌──────────────────────────────────────────────┐
│ KEY      As written: C       Your key: D     │
│   C    Db    D    Eb    E    F               │
│   F#   G     Ab   A     Bb   B               │
│ [ As written ]                    [ Close ]  │
└──────────────────────────────────────────────┘
```

The twelve keys in the song's own spelling, the current one inverted. *As
written* and the saved key (*Your key*, from the account's `songs.json`, when
it differs) are named. The names come with the song from the reader's music
code, never spelled by the screen. *As written* puts the song at its written
key even when a key is saved — *Your key* is then one tap in the grid. Tapping a key closes the grid and redraws the song in
that key from its first page — one redraw. *Close* puts the strip back — one
redraw. A key is chosen, never stepped to (rule 8): from C to F is one tap, not
five redraws.

A key chosen here **stays on this reMarkable**, for this song, until another is
chosen or *As written* — it is never written to the account (the reader writes
nothing). The song opens at the account's saved key until one is chosen here.

**A song with no `key` property** names its key by its last chord, as the web
app does (workflow 2 §Transposing): *Dm* for *Três Estrelinhas*, which opens on
A7/C♯ and ends on Dm; a setlist's key for such a song is shown as its note, not
applied (workflow 12 §The key). **A song with no chords**
shows no key button and no strip.

Costs: turn — 1; open the key grid — 1 (the strip only); choose a key — 1;
close — 1 (the strip only).

## A setlist

Bar: **Back** (to the book) · the setlist's name · at the right, **Play**.

Content: its songs in order, one row each — *1*, the title, and the key the
setlist sets for it (*in D*; a song the setlist sets no key for plays in its
own key, named on its song screen, and its row names none) — and the
setlist's note for a song under it. A missing song
says *missing* and is skipped by Play (workflow 12). Ten rows to a page.

**Play** opens the first song; tapping a row opens Play at that song (a
*missing* row is not a target: it has nothing to open). Playing is a song screen
with four differences:

- The bar's title is the place and the song: *3 of 12 · Garota*, and the key
  button shows the setlist's key (workflow 12 §The key).
- *Next* on a song's last page goes to the **next song's first page** — laid out
  in advance (rule 9) — and *previous* on a first page to the previous song's
  last page. The setlist reads as one long book.
- The last page of each song ends with the next song's title and key, *Next:
  Asa Branca, in G*, and its note when it has one — the `- note:` the setlist
  file gives that item (cifra.md §10; workflow 12).
- The first page of each song starts, above its chart, with that song's own
  note, and with the setlist's key as a note (*key: D*) when it cannot be
  applied — the song states no key, or the keys differ in mode (cifra.md
  §10.7; workflow 12 §The key, §Playing through). So a song Play starts at has
  its note, though no song before it carried it.

The songs on either side of the one playing are read ahead, so a turn across
songs is one redraw whichever way it goes. A turn faster than the reading
ahead waits on the old page and then changes once (rule 1).

Back returns to the setlist, at the page holding the song that was playing.

Costs: start — 1; every turn, across songs too — 1.

## When something has changed

A sync never moves the page being read (rule 5). A song changed by someone else
shows its new version the next time it is opened; a setlist being played keeps
the version it started with until Back. A book that is no longer shared with
the account disappears from the shelf the next time the shelf is opened, and a
song open from it stays readable until Back.

The reader says nothing about versions or authors: it is for reading; history
is the web app's.

## What it costs, in one table

| Action | Redraws | How much |
|---|---|---|
| Tap anything | +1 | the tapped control, inverted (rule 7) |
| Open a book, a song, a setlist; Back | 1 | content and bar |
| Turn a page (and a song, in Play) | 1 | content and foot |
| A letter, in a book | 1 | content and foot |
| Open / close the key grid | 1 | the shapes strip (with shapes hidden, the page's foot of the chart) |
| Turn the shapes strip | 1 | the strip only |
| Tap a diagram (the question) / Cancel | 1 | the strip only |
| Hide a shape you know | 1 | the strip; the content too when the strip loses a row |
| Hide / show shapes | 1 | content, laid out again from the bar at the top |
| Choose a key | 1 | content and the key button |
| Sync, on the shelf | 2 | one line |
| Sync, anywhere else | 0 | — |
| Pairing approved / code expired | 1 | content |

## What the screens assume

These rules assume the panel is updated region by region, with a fast
black-and-white update for one-bit changes. What the panel does in use —
which updates flash, how long a page takes to appear — revises this document.

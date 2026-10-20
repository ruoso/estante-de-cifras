# 2. Find and play a song

Status: decided. Screens and edge cases below; details to settle while
building are marked *later*.

The screen people will use most. First run (workflow 1) is mostly a matter of
how to get someone here, so this one came first.

## The search screen

The app opens on search: one box, across every book on the shelf.

**Before anything is typed**, it shows the songs recently opened, then each
book as a collapsible section listing its songs. Recents are the way back
into what you were playing; the books are the way to browse.

Recents are kept on the device and are not synced. They change every time a
song is opened, and the home book (DIRECTION §3.2) would gain a commit for
each. What you played on the phone last night is not something the laptop
needs.

**As you type**, results narrow on every keystroke. Search covers title,
properties (artist and the rest), section names, words and chords, and
ignores accents and case: `coracao` finds *Coração*.

### The chord explorer is a result

When what is typed parses as a chord symbol, the first result is **explore
Cmaj7 on your instrument**, which opens the fingering explorer Explore Chords
was built around. Below it come the songs, as for any other text. There is
one box, and two kinds of result.

Two things follow:

- **A short query can be both.** `A` is a chord and a word (*A Banda*). Both
  results appear: the explorer row, then the songs that match the text, then
  the songs that use the chord. Nothing is hidden by guessing which was
  meant.
- **Ambiguous symbols** (cifra.md §5.6) are read in the user's notation, with
  the explorer showing the ambiguity as Explore Chords does.

*Later:* searching by progression, `Am F C G`, as songs that contain it.

### A result

Each result shows:

- the **title** and **artist**;
- **where it lives**: book, and folder when it is not at the root;
- **badges**, only when they apply:
  - *voiced for* the instrument in use, when the song has a voicing block
    for its tuning;
  - *unsaved changes*;
  - *conflict*, from a merge waiting on the user.

These carry the case of two songs with the same title, such as a teacher's
original and a student's fork: the book tells them apart, and the badges say
which is the one you have been working in. Results are not grouped by song.

### Scope

Search covers every book. A filter narrows it to books, or to folders within
one, and **resets at the start of each session**: a scope you have forgotten
about hides results without saying so. While a filter is on, it is shown in
the box, not tucked behind a button. The one exception is a session that
starts from a book's address (`…/b/<book>`, workflow 7): it opens on that
book's songs, the scope shown in the box like any other. Pressing a book on
the book-management screen opens the same place.

While the scope is one book or a folder in it, a bar above the results names
the book, its state, and *Manage* for its detail (workflow 7 §A book's
songs).

## Reading a song

Opening a result shows the song to be read, as Explore Chords' reading view
does: the chart, then the shapes, a page at a time on a phone.

- **The instrument in use** decides the shapes. Where the song has more than
  one variation for that tuning, a picker chooses between them; which one is
  in use is remembered per song and tuning, in the home book.
- **A song with no voicings for the instrument in use** still plays: every
  chord takes a default (below), marked as not the song's choice, and the
  page offers **arrange for cavaquinho**, which leads into workflow 5.
- **A song with only some chords voiced** shows the song's shapes where it
  has them and defaults elsewhere, marked the same way.
- **A song that does not fully parse** is shown anyway, with what was not
  understood marked where it is (cifra.md: a reader never discards what it
  did not understand).
- **The song's notation reads its chords.** An ambiguous symbol (cifra.md
  §5.6) in a song is read in the dialect the song declares in `notation`
  (Brazilian when it declares none), not in the reader's own preference —
  that is what a new song writes the property for (workflow 3). So `C7+` in
  an American song is the sharp-fifth chord for everyone: its shape, its
  default and its transposition are that chord's. The same holds wherever the
  song is read: playing it through a setlist (workflow 12), the voicing
  wizard (workflow 5), and the editor's preview and colouring (workflow 4).
  The preference is how the user reads a symbol they type (the search box,
  the explorer).

From the reading view the song can be edited (workflow 4), its history
opened (workflow 6), transposed (below), and printed.

### Where a chord's shape comes from

A chord the song has chosen no shape for (cifra.md §7.6) takes a default,
and the spec leaves the default to the app. Here it is, in order:

1. **the song's choice**, from its block for this tuning and the variation in
   use;
2. **my shape**: the shape the user saved as how they play that chord on this
   instrument, kept in the home book;
3. **the app's default**: the easiest shape the fingering search finds under
   the instrument's rules.

Each is marked for what it is: the song's choice plain, *your shape*, or
*default*. On paper they print alike, since a student needs the shape, not
its provenance.

My shapes match by chord, not by spelling, so one saved as `Cmaj7` serves a
song that writes `C7M`. They are applied when the song is shown and are never
written into it. Explore Chords wrote a starred shape into a song the first
time its chord appeared there; in a shared book that would put one person's
habits into everyone's song at their next save. Writing them in is an
explicit act instead (workflow 5).

## Transposing

The reading view can transpose a song, up or down by semitones. **It changes
the view, never the song**: the text, the chart and every voicing block stay
as they are. This is what makes transposing cheap here, where Explore Chords
deferred it: nothing a teacher chose is invalidated, because nothing is
rewritten. cifra.md §8.6 leaves transposing a document undefined; this is
not that, but a reader showing what it read in another key.

**A transposed song has no chosen shapes.** The song's voicings were chosen
for the chords it is written in, so while it is transposed, every chord takes
my shape or the app's default (above). This holds even where a transposed
chord coincides with one the song voices — up a fourth, the song's `G` is a
`C`, and the song may well voice a `C` — because the song's footnote markers
and its arrangement were made for the original harmony, and a match is a
coincidence.

*Later:* transposing up two with a capo at the second fret on the same tuning
is the one case where the song's own shapes are exactly right. That is the
capo feature, and it builds on this one.

**Spelling.** With a `key` property, the transposed chords are spelled as the
new key spells them: up a semitone from C is D♭, with flats. Without one,
whichever of the sharp or the flat spelling gives the song fewer accidentals.

**It is remembered per song.** A singer does that song in D, every time. The
transposition is kept in the home book, beside the variation in use, and is
shown plainly while it applies — *transposed to D (+2)* — with a way back to
the written key.

**It is for reading.** While transposed:

- *edit* opens the text as written;
- *arrange* (workflow 5) is not offered, since it writes voicings for the
  chords as written;
- tapping a chord still opens the picker, and what is chosen there is saved
  as *my shape* for that chord on this instrument, not into the song.

Printing and a link to the song carry the transposition; search matches the
chords as written.

## Offline

Nothing on this screen needs a network. Search, the explorer and reading all
run on what is on the device. The only thing offline changes is that sync
status (workflow 8) may say the shelf has not been brought up to date.

## Edge cases

- **An empty shelf** is first run (workflow 1).
- **A book still cloning, or an index still building**, contributes results
  as they become available. The book's section says it is still loading,
  rather than looking empty.
- **A song with no title** is listed by its file name, without the
  `.cifra.md`.
- **A song open while sync brings a new version of it** — see workflow 8.

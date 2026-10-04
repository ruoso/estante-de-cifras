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
the box, not tucked behind a button.

## Reading a song

Opening a result shows the song to be read, as Explore Chords' reading view
does: the chart, then the shapes, a page at a time on a phone.

- **The instrument in use** decides the shapes. Where the song has more than
  one variation for that tuning, a picker chooses between them; which one is
  in use is remembered per song and tuning, in the home book.
- **A song with no voicings for the instrument in use** still plays: every
  chord takes the default fingering the app works out. Those shapes are
  marked as the app's choice, not the song's, and the page offers
  **arrange for cavaquinho**, which leads into workflow 5.
- **A song with only some chords voiced** shows the song's shapes where it
  has them and defaults elsewhere, marked the same way.
- **A song that does not fully parse** is shown anyway, with what was not
  understood marked where it is (cifra.md: a reader never discards what it
  did not understand).

From the reading view the song can be edited (workflow 4), its history
opened (workflow 6), and it can be printed.

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

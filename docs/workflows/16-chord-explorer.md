# 16. The chord explorer

Status: decided. Screens and edge cases below; details to settle while
building are marked *later*.

What *Explore A on your instrument* opens. Workflow 2 made the explorer a
search result — when the typed text parses as a chord, the first result is
*explore A on your guitar* ([workflow 2](02-find-and-play.md) lines 27–42).
This is the screen that result opens: every way to play that chord on the
instrument in use, easiest first, and a way to keep the one you play as *your
shape*.

Explore Chords was built around this screen, and the music core comes over as
is (DIRECTION §5): the fingering search, the finger assignment, the scoring,
the diagrams. What changes is the frame around it. Explore Chords made the
instrument the app's identity and the explorer its home; here the song comes
first and the explorer is reached *through* search (DIRECTION §4). So this is a
tool, not a dashboard (Explore Chords' DESIGN §2.3): a chord input, the
instrument it is read on, and the ranked shapes — nothing else.

## Getting here, and the chord input

The explorer opens from search's chord row (workflow 2). It carries an
**editable chord input**, so the chord can be changed without going back —
type `Am` over `A` and the shapes re-derive. The input and the search box hold
the same symbol: arriving from search fills it in, and *back* returns to search
with it still typed, songs and all. There is one symbol, read two ways.

The **instrument in use** is shown as the header chip, as everywhere else
(workflow 1), with the one short label it has everywhere (workflow 15, The
roster): *Guitar*, the full tuning as its accessible description. It is a preference in the home book, and
changing it from the chip re-derives the shapes for the new tuning — a chord on
the cavaquinho is a different search from the same chord on the guitar. The
explorer reads the instrument, its tuning and its voicing rules; it does not
set them (that is workflow 15). They are the search's configuration, opaque
input it hands to the music core.

## Ranked, grouped by position

The shapes the fingering search finds for that chord on that instrument,
**ranked easiest first** and **grouped by position**. This is the same
ranked-and-grouped presentation workflow 5's in-song picker uses — one shared
component (Explore Chords' `fingering-groups.js`), so ranking, grouping and
order can never drift between *explore a chord* and *choose a shape in a song*.
The explorer wraps it with the chord input and the star; the picker wraps it
with *every Cm / only here*.

**Ranking** is the music core's difficulty score: a weighted sum of what makes
a shape hard — its stretch, a barre, how many fingers, muted strings, a missing
fifth, an unrequested bass note, less a bonus for open strings — sorted
ascending, so the easiest is first. Ties break by position, lower on the neck
first. The number itself is never shown; each shape carries a **difficulty
word** instead — *easy*, *medium* or *hard* — the bucket the score falls in. A
word, never a bare number (noise to someone choosing a shape) and never colour
alone (the standing accessibility rule).

**A position** is where the hand sits. A shape is in **open position** when it
has at least one open string and every fretted note is within the first four
frets; otherwise its position is its **lowest fretted fret**. Groups are *Open*,
*Fret 1*, *Fret 3*, *Fret 5*… — the positions that have a shape, the empty ones
skipped, open first and then up the neck. This is deliberately **not CAGED
roman numerals**: those assume a standard-tuned six-string guitar and say
nothing about a cavaquinho, a ukulele, drop D or a capo (cifra.md §6). The
music core computes it this way already.

Each group shows its easiest **six** shapes with a **show more** that reveals
the rest; the count is display-only — the group holds every shape found, and
*show more* never changes the search. Each shape is drawn as a `ChordBox`
diagram (DIRECTION §3.7, the app's own drawing) with its fret shorthand
(`x32010`), its difficulty word, and a star. Every diagram carries an
accessible name — the music core's `describeFingering`, a sentence like *"A
major, x02220, open position, fingers 2-1-3, root on the 5th string, easy"* —
so the groups read under a screen reader as they look.

## Viewing by notation

The typed symbol is read and shown in the user's **notation dialect** — the
home book's `notation` preference (`preferences.json`), `brazilian` by default
(cifra.md §5.6). There is **no dialect picker on this screen**: the dialect is a
single preference, set once (workflow 1), not a per-screen control.

Most symbols read one way in every dialect. Four spellings do not, and cifra.md
§5.6 names them: a reader MUST apply the dialect and MUST report that it did,
*"so that an application can show which reading was taken and offer the other."*
The explorer is that application. On one of the four, it shows the **reading it
took and a flip to the other**, and flipping re-runs the search on the new
reading:

- **`C7+`** — *read as C7M (major seventh) · read as C7♯5 instead?* The
  `brazilian` reading is the major seventh; `american` and `realbook` read the
  `+` as a sharp fifth. (The dangerous one: three identical characters, two
  chords a semitone apart.)
- **bare `C9`** — *read as Cadd9 (added ninth) · read as C9 (dominant ninth)
  instead?* `brazilian` adds the ninth with no seventh; `american`/`realbook`
  include the flat seventh.
- **bare `B°`** — *read as B°7 (diminished seventh) · read as Bdim (diminished
  triad) instead?* Every dialect reads a bare `°` as the seventh; the flip is to
  the plain triad. (Writing `dim` out is already the triad, and `°7`/`dim7` are
  unambiguous — no flip there.)
- **`C7(4)`** — *read as C7sus4 (suspended fourth) · read as C7add4 (added
  fourth) instead?* `brazilian` suspends; `american`/`realbook` add. Only on a
  major triad; `Cm7(4)` is an added fourth in every dialect, with nothing to
  flip.

The flip is per chord, which is the one place a dialect's choice is felt and
worth overriding; it does not change the preference. A symbol that is not one of
the four shows no flip.

**How the flip spells the other reading.** The reading taken is written in the
user's dialect (*read as C7M*). The flip names the other reading in a spelling
that cannot be mistaken for the symbol typed: the **American** spelling, with
the accidentals written as `♯` and `♭` — *C7♯5*, *C9*, *Bdim*, *C7add4*. The
only exception is a flip back to the user's own dialect's reading, after a
flip: that is spelled in the user's dialect (*read as C7M instead?*), the way
the notice spelled it first. Chord symbols are not translated, so the flip reads
the same in every language. (The user's dialect cannot spell the other reading
safely: in `brazilian` the sharp-fifth seventh is `C7(5+)`, one easy slip from
the `C7+` it is being told apart from.)

## Starring a shape as *your shape*

Every shape card carries a **star**. Starring writes that shape as **your
shape** for this chord on this instrument and tuning — one leaf in the home
book's `shapes.json`, at the path instrument → tuning → chord
([home-book format](../home-book-format.md) §4.4). It is **matched by chord,
not by spelling**, so a shape starred for `Cmaj7` serves a song that writes
`C7M` (workflow 2). The stored value is the shape itself — the fret pattern for
that tuning (cifra.md §7: a shape is `x35543`, meaningless without its tuning) —
not a rendered picture; the diagram is recomputed from it on load, so a starred
shape never drifts out of date when the rules change.

Starring is a **preference change**, so it commits automatically to the home
book — no explicit save (DIRECTION §3.2). Offline it writes the home book
locally and syncs when there is a network (workflow 8); nothing waits.

A starred shape is drawn as *your shape* — in the chord colour, labelled *your
shape*, per the `ChordBox` decision — so its state is a word plus a drawing,
never colour alone; the star's pressed state says the same. Unstarring removes
the key. What a star changes is the **fallback**: where a song has chosen no
shape for that chord, the reading view shows *your shape* before the app's
default (workflow 2's fallback order). It is **never written into a song**.
Explore Chords wrote a starred shape into a song the first time its chord
appeared; in a shared book that would put one person's habits into everyone's
song at their next save (workflow 2 line 106). The only path into a song is the
explicit act in workflow 5.

### Entering a shape by hand

*Enter a shape* sits at the top of the results, the same by-hand builder the
song picker offers (Explore Chords' DESIGN §2.11, the shared affordance) — here
a dialog over the results, in a song a screen of arrange (workflow 5, Choosing
a shape): a big diagram where tapping a string at a fret places a finger and
tapping again lifts it, tapping above the nut mutes or opens the string, with a
per-string read-out of the notes it sounds, each named by its part in the chord
(*root*, *minor third*, *fifth*), and any that are foreign to the chord marked
by a word (*not in Cm*). It is **offered here too**, and what it produces can be starred — the
natural way to record *how I actually play it* when the search did not surface
that shape. A half-finished or unusual shape is drawn as it is entered and is
not rejected (cifra.md: nothing is discarded); an unplayable one says so
without blocking.

## Scrolling and moving through it

Groups **stack vertically**, easiest position first — *Open*, then up the neck.
Within a group the shapes are a **horizontally-scrollable row on a phone** and a
**wrapped grid on a tablet or computer**, so a phone shows the easiest few at a
glance and scrolls sideways for more within the position before scrolling down
to the next. The **chord input and the instrument chip stay reachable** while
the results scroll — the one is how you change the chord, the other the
instrument, and both are in play throughout.

A **full keyboard path** moves through the groups and the shapes within each and
reaches the star on every one, and *show more*, *enter a shape* and the notation
flip are all reachable the same way. React Aria Components carry this
(DIRECTION §3.7); axe at WCAG 2.1 AA checks it on the built screen.

## Offline

The whole screen runs on the device. The fingering search, the finger
assignment, the scoring and the diagrams are the framework-free music core
(DIRECTION §3.7, §5) — no network. Starring writes the home book locally and
syncs later (workflow 2 §Offline, workflow 8). The explorer reads the music
core and the user's own home book, not a shared book, so it needs no membership:
there is nothing here that waits on an account or a connection.

## Edge cases

- **No playable fingering.** When the instrument's voicing rules admit no shape
  for the chord, an **empty state names the reason and points at the rules** —
  the rules are too strict for this chord on this tuning — with a path to them
  (the instrument chip, workflow 15). The search **never silently relaxes the
  rules** to manufacture a shape (Explore Chords' rule); loosening them is the
  user's deliberate act, made where the rules live.
- **A query that is both a chord and a word.** `A` is a chord and *A Banda*.
  Search keeps both kinds of result on its own screen (workflow 2); the explorer
  is about the chord only. Getting back to the songs is the *back* path to
  search, where both still are.
- **An ambiguous symbol, before any flip.** The default reading for the dialect
  is shown and searched, with the flip offered (above). Nothing is hidden by
  guessing; the other reading is one tap away.
- **A very large result set.** Capped per group for display, with *show more*;
  the cap is display-only and the search is complete underneath.
- **An unparseable symbol.** If the editable input stops being a chord as it is
  typed, the explorer says the symbol is not one it can read and keeps the last
  good results dimmed, rather than emptying; *back* still returns to search.

## How diagrams are drawn

As Explore Chords offered, two display choices change how a shape is **drawn**,
never which shapes are found, their ranking, their grouping or their
shorthand:

- **Hand** — **Right-handed** (the default) or **Left-handed**, the strings
  drawn in the opposite order: on the vertical chord box an exact mirror, the
  lowest string on the right, as a left-handed player sees their own
  instrument.
- **Neck** — **Vertical** (the default), the chord box with the nut at the top,
  or **Horizontal**, the neck lying across with the nut at the left and the
  frets running to the right — the lowest string at the top, at the bottom when
  left-handed.

They are chosen in the **Preferences** section of the account screen, beside
theme, density and language (workflow 1; drawn in
[the mockups](../mockups/Theme-picker.dc.html)), as two labelled choices with
one live diagram drawn as the pair would draw it; the chosen ones marked by the
word *Selected*. They are preferences, kept in the home book
(home-book-format §4.1 `diagramHanded`, `diagramOrientation`), so they follow
the user to every device; until chosen, right-handed and vertical.

They apply to **every chord diagram the app draws** — the explorer's groups, the
in-song picker (workflow 5), the diagrams beside a song (workflow 2), the
wizard's and a conflict's diagrams, *my shapes* and entering a shape by hand —
so a left-handed player never meets one drawn the other way. Entering a shape by
hand follows them too: a tap lands on the string and fret drawn under the
finger, and the shape recorded is the same whichever way it was drawn.

What a diagram says does not change: its accessible name is still the music
core's `describeFingering` sentence, which names strings by their order on the
instrument, not by where they sit on the screen; the starting fret stays a
plain number beside the first fret (the mockups' README, *Decisions the
drawings carry*); *your shape* and *default*
are drawn and said as before.

## Out of scope

Decided to be **not** part of this screen:

- **A *browse all my shapes* surface.** The explorer stars and unstars one chord
  at a time; there is no screen here to review or remove *your shapes* across
  chords. It may belong with the instrument-attached personal state workflow 15
  owns.

## Later

- **Searching by progression** from the same box (`Am F C G`) is workflow 2's
  *later*, and would reach songs, not the explorer.
- **A capo** changes the tuning the search runs on (cifra.md §6.3), and the
  explorer follows it like any other tuning once the capo feature lands
  (workflow 2 *later*).

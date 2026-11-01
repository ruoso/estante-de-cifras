# 5. Arrange for an instrument

Status: decided.

Choosing how a song's chords are played on one instrument: the voicing block
for its tuning (cifra.md §7). This is the work Explore Chords was built
around — the fingering search, the picker, entering a shape by hand, the
voicing wizard, variations — and most of it comes over. What is new is that
the song may be someone else's, and the arrangement is shared.

Every change here is an edit like any other (workflow 4): it goes to the
working copy, shows as unsaved, and is saved or discarded the same way.

Arranging happens in one place: the **editor's preview** (workflow 3 §The
editor). Its chart's chords are things to tap, with the picker, the shapes,
the variations and the wizard beside the text, so changing a chord's shape
while writing never means leaving the editor, and arranging never means
learning a second screen that does a subset of the same thing.

## Arranging is editing

From the reading view, *arrange* — or *arrange for cavaquinho*, on a song
with nothing chosen for this instrument — opens the editor on its preview
(on a phone, the *Preview* side of its Text | Preview switch; where the text
and the preview sit side by side, both), and *Back* returns to reading.
Outside the editor, tapping a chord only shows its diagram larger. A phone on
a music stand gets tapped by accident mid-song, and an accidental tap must
never change the song.

While the text holds a line that would stop a save, the preview reads but
takes no taps, and says so: a choice is written by rewriting the song, which
could drop that line.

In the mode, chords with a chosen shape show it, and chords without one show
what they fall back to (workflow 2), marked *your shape* or *default*.

Arranging is not offered while the song is transposed (workflow 2): it writes
voicings for the chords as written.

The instrument is named by the preview's instrument chip, beside the shapes it
decides — the screen's one chip — and opens the instruments as it does
everywhere, so arranging for another instrument is a switch away. A step that
works on one tuning's strings (entering a shape by hand, the wizard's plan)
names the instrument as *Arranging · Guitar* but does not switch it.

## Choosing a shape

Tapping a chord opens the picker, as Explore Chords had it: the shapes the
search finds for that chord on this instrument, ranked easiest first and
grouped by position, with *enter a shape* at the top (its DESIGN §2.11).
Choosing one writes `- Cm: x35543` into the block for this tuning and the
variation in use, creating the block if there is none.

*Enter a shape* opens a dialog in place of the picker, over the chart — never
another screen, so the song (or the editor's text) stays where it was behind
it: *Enter a shape for Cm*, a line saying where and how far it applies (*Choro
da Chuva · Primeira Parte, bar 3 · only here*), the big diagram, drawn as the
reader's diagrams are (left-handed, horizontal), empty to begin with — tap a
string at a fret to place a finger and again to lift it, tap above the nut to
open or mute the string, the arrows move it along the neck; the keyboard sets
the same strings through a row of choices per string that shows when it takes
focus — and beside it *Notes it holds* — the notes it sounds, then one row per
string with its fret, its note and that note's part in the chord (*root*,
*minor third*, *fifth*), or *not in Cm* for a foreign one, which a notice spells
out and does not block (*You can still choose this shape*). *Cancel* or Escape
returns to the picker as it was; *Choose this shape* writes it as any other
choice does.

### Every Cm, or only this one

A voicing key names a chord everywhere it appears, so choosing a shape for
`Cm` sets every `Cm` in the song. Playing one occurrence differently means
giving it a footnote marker, `Cm[2]`, and that is a change to the **chart**,
which every instrument shares (cifra.md §8.4).

So the picker, opened from a bar, offers both: **every Cm** and **only
here**. *Only here* says before it acts that it marks the chart for everyone
who plays the song. On every other tuning that occurrence becomes unchosen,
since §7.6 does not let `Cm[2]` fall back to `Cm`, and shows that tuning's
default until someone chooses for it. Writing the marker keeps the words in
place on a sung line (§8.7) and renumbers markers from use (§8.4), as the
library's writer does for every edit.

### Accepting what is shown

The spec never writes defaults into a document (§7.6): a block holds what
somebody chose. But a user may look at what the unchosen chords show — their
own shape or the app's default — and decide it is right. And a default can
change when the app, the user's rules or their shapes do, while a choice
cannot.

**Choose these for every unchosen chord** writes in what each one shows. It
is an explicit act by the user, which makes the result a choice and not a
default. This is the only way *my shapes* get into a song.

## The wizard

*Run the wizard*, in the preview's head beside the instrument chip — where
the preview begins, not after the chart — plans the whole song at once, with
the planners and questions Explore Chords' wizard had (its DESIGN §2.10). Its plan is written
into the working copy like any other edit: the save sheet shows what it
chose, and discard undoes it.

Its plan is shown before anything changes, as the shapes the song would
carry: each named for its chord, with what it sounds beside the name where
that differs (*G/B*), and marked *new shape* or *as now*. The count is of
chords, as the diagrams are — *3 of 5 chords would change* — not of every
place a chord is played. A plan that changes nothing says so and offers
nothing to write; *Back* tries another way.

The wizard never goes quiet. Until the song's text is in, it says it is
reading the song and *See the plan* waits; it plans only on the text it has
just read, never on one left from an earlier open. When no plan can be made it
says so and what went wrong, and offers nothing to write; a song with no chord
to shape says that; a planned shape the diagram cannot draw under the
instrument's rules is still counted and written, and named in words (*Also in
the plan, with no diagram to show them: E7/D (x20454)*); and when the plan
cannot be written into the song it says so and stays on the plan.

A variation is the way to keep a plan beside an existing arrangement rather
than over it. So when the variation in use already has choices, the wizard
offers **into a new variation** first, and *replace “Default”* second — the
variation named in quotes, since a name like *For my students* does not read
as part of a sentence.

On a computer the wizard sits in a pane beside the song's chart, which
previews the plan's shapes as they would read; on a phone or a tablet it takes
the screen. Its step back to the planners reads *Back*; its ✕ is the one way
out, and it and *Write the plan* both return to the editor's preview. The
instrument it plans for is named in words beside the song's title, not on a
chip, since nothing there switches it.

The save sheet names what the wizard wrote as a person would: the variation
by its name and the tuning by the instrument that plays it — *“For my
students” added for Guitar* — falling back to the tuning as written only
when no instrument on the device plays it.

## Variations

As Explore Chords had them (its DESIGN §2.13):

- the song's unnamed variation — its plain *Voicings* block for the
  tuning — reads *Default* wherever a variation is named;
- adding one starts empty, or as a copy of the one in use;
- a name already in use is refused;
- the selector appears only when a tuning has more than one, above the
  shapes in the editor's preview and among the reading view's display
  options.

Which one is in use is remembered per song and tuning, in the home book
(workflow 2).

## Someone else's song

A student arranging the teacher's song for ukulele adds a block for a tuning
the teacher does not play, and merging that back is clean (DIRECTION §2.2).
Nothing is different while arranging. Whether the user can save there is
workflow 4's rule, and making the book their own is workflow 11.

The one arranging act that reaches other people's instruments is *only here*,
and it says so.

## Later

**A tuning close to one the song has.** The song is arranged for standard
guitar; the user plays in drop D, or with a capo, which is a tuning of its
own (cifra.md §6.3). Nothing carries over, and must not (§7.6). An offer to
start from the nearby tuning's shapes, adjusted where they still fit, is a
later feature, alongside the capo.

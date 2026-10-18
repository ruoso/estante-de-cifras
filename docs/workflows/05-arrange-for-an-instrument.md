# 5. Arrange for an instrument

Status: decided.

Choosing how a song's chords are played on one instrument: the voicing block
for its tuning (cifra.md §7). This is the work Explore Chords was built
around — the fingering search, the picker, entering a shape by hand, the
voicing wizard, variations — and most of it comes over. What is new is that
the song may be someone else's, and the arrangement is shared.

Every change here is an edit like any other (workflow 4): it goes to the
working copy, shows as unsaved, and is saved or discarded the same way.

## Arranging is a mode

From the reading view, *arrange* — or *arrange for cavaquinho*, on a song
with nothing chosen for this instrument — turns the song's chords into things
to tap, and *done* turns them back. Outside the mode, tapping a chord only
shows its diagram larger. A phone on a music stand gets tapped by accident
mid-song, and an accidental tap must never change the song.

In the mode, chords with a chosen shape show it, and chords without one show
what they fall back to (workflow 2), marked *your shape* or *default*.

Arranging is not offered while the song is transposed (workflow 2): it writes
voicings for the chords as written.

The mode is named in the header by the instrument chip itself, which reads
*Arranging · Guitar* — the chip's one short label (workflow 15, The roster)
after the mode — and opens the instruments as it does everywhere, so arranging
for another instrument is a switch away. A step inside the mode that works on
one tuning's strings (entering a shape by hand, the wizard's plan) names the
instrument the same way but does not switch it.

## Choosing a shape

Tapping a chord opens the picker, as Explore Chords had it: the shapes the
search finds for that chord on this instrument, ranked easiest first and
grouped by position, with *enter a shape* at the top (its DESIGN §2.11).
Choosing one writes `- Cm: x35543` into the block for this tuning and the
variation in use, creating the block if there is none.

*Enter a shape* opens a screen of the mode, not a dialog over the picker
(board W05, the tablet): *Enter a shape for Cm*, a line saying where and how
far it applies (*Choro da Chuva · Primeira Parte, bar 3 · only here*), the big
diagram, and beside it *Notes it holds* — the notes it sounds, then one row per
string with its fret, its note and that note's part in the chord (*root*,
*minor third*, *fifth*), or *not in Cm* for a foreign one, which a notice spells
out and does not block (*You can still choose this shape*). *Cancel* or *Back*
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

*Run the wizard* plans the whole song at once, with the planners and
questions Explore Chords' wizard had (its DESIGN §2.10). Its plan is written
into the working copy like any other edit: the save sheet shows what it
chose, and discard undoes it.

A variation is the way to keep a plan beside an existing arrangement rather
than over it. So when the variation in use already has choices, the wizard
offers **into a new variation** first, and *over this one* second.

On a computer the wizard sits in a pane beside the song's chart, which
previews the plan's shapes as they would read in arrange; on a phone or a
tablet it takes the screen. Its step back to the planners reads *Back*.

## Variations

As Explore Chords had them (its DESIGN §2.13):

- the song's unnamed variation — its plain *Voicings* block for the
  tuning — reads *Default* wherever a variation is named;
- adding one starts empty, or as a copy of the one in use;
- a name already in use is refused;
- the selector appears only when a tuning has more than one, above the
  shapes in arrange mode and among the reading view's display options.

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

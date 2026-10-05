# 15. Set up an instrument

Status: decided. Screens and edge cases below; details to settle while
building are marked *later*.

Half of Explore Chords was *set up an instrument*: pick one, settle a tuning,
say how you play, and from then on every fingering the app offers is shaped by
that choice. Estante keeps the model and demotes it — the song comes first
(workflow 1), so instrument set-up is **reached when wanted**, from the header's
instrument chip, not asked before anything else. This is that reached-for
surface: what an instrument is, adding a second one and switching between them,
and the voicing rules — a preset and an expert panel — each instrument carries.
The model, the fingering search and the catalogue all come over from Explore
Chords (DIRECTION §5); what is new is the frame around them and the storage, the
home book (DIRECTION §3.2).

## The model of an instrument

An instrument is an **instance the user set up**, not a type: *Guitar · E A D G
B E* and *Guitar · D A D G B E* are two instruments, because in practice they
are two different things to play (Explore Chords' DESIGN §2.1). Each is:

- a **catalogue entry** (`catalogId`) — the template it was made from
  (`6guitar`, `cavaquinho`, `ukulele`, `4bass`…), which fixes the fret count and
  carries the tuning presets. The catalogue comes over from Explore Chords as is
  (`src/data/instruments.js`, DIRECTION §5) and is **not re-decided here**; the
  board illustrates with the app's cast (guitar, cavaquinho, ukulele), but the
  contents are inherited.
- a user **label** — *Guitar · Drop D*, renameable.
- a **tuning** — the **source of truth**, spelled as cifra.md §6 spells it (an
  uppercase letter, the pitches joined by single spaces, each pitch's own
  spelling kept): `E2 A2 D3 G3 B3 E4`, `D4 G4 B4 D5`, `G4 C4 E4 A4`. The number
  of strings is the length of the list; a re-entrant tuning (the ukulele's high
  G) is allowed. **There is no capo field** — a capo raises every open string
  equally, which is exactly a transposed tuning (cifra.md §6.3; Explore Chords
  §4.3), so *Guitar · Capo 2* is simply the instance tuned
  `F#2 B2 E3 A3 C#4 F#4`, and the frets come out capo-relative on their own. A
  field nothing reads would be worse than its absence.
- a **fret count** — from the catalogue entry (22 for a guitar, 17 for a
  cavaquinho, 15 for a ukulele).
- its **voicing rules** — below.

Stored, an instrument is one entry in the home book's `instruments.json`
([home-book format](../home-book-format.md) §4.3), and deliberately **two
registers**: its `definition` (the catalogue entry, the label, the tuning, the
fret count) and its `rules`. They merge independently, the later change winning
key by key (home-book §5), so renaming the instrument on the phone and editing a
rule on the laptop never clobber one another. Both values are **opaque** to the
home-book format: this workflow owns their shape, the format owns only the key
and the envelope (home-book §1.2, §4.3). Workflow 15 does **not** add a file,
change the register envelope, or need an atomic multi-key write.

The tuning text is also the **identity** that keys the rest of the personal
state: *my shapes* are stored under instrument → tuning → chord (`shapes.json`,
home-book §4.4), and a song's variation-in-use is stored per tuning
(`songs.json`, home-book §4.5), each under the same cifra.md §6 text a song's
voicing block names its tuning with (cifra.md §6.3, §7.6). So a shape kept for a
tuning and a song written for that tuning spell it the same way, and match.

## The roster, and switching

The **instrument in use** is shown as a chip in the header, everywhere
(workflow 1 lines 65–66; workflow 16 line 29): *Guitar · E A D G B E*. Tapping
it opens the **roster** — the user's instruments, the one in use **marked with a
word** (*in use*, never colour alone), and *+ Add instrument* at the foot.
Choosing another switches to it, and everything on screen **re-derives at once**:
the reading view's shapes, the explorer's results, the arrange picker's ranking
— a chord on the cavaquinho is a different search from the same chord on the
guitar (workflow 16 line 32). There is **one instrument in use at a time**.

Which one that is is a single account-wide preference: a **singleton register in
`preferences.json`** (home-book §4.1), its value an instrument id, **absent
meaning the standard guitar** — the built-in the app shows until the user has
set anything up (home-book §2.1, a lazy write; workflow 1's default). It is
**not per-device**: the two shipped workflows call it *a preference*, and a
user's few devices converging on one in-use instrument under last-write-wins is
fine, since switching is one tap. A boolean *in use* on each instrument in
`instruments.json` was rejected — *in use* is singular, and a key-by-key merge
would admit two winners; a singleton register cannot. This needs **no
home-book-format change**: §4.1's key list is descriptive, and the format
validates the register envelope and the file whitelist, not a fixed set of
preference keys, so a new singleton register is already well-formed.

## Adding an instrument

Adding one is a **first-class flow** (Explore Chords §2.1), not buried in
settings:

1. **catalogue** — pick the entry (*Guitar (6-string)*, *Cavaquinho*,
   *Ukulele*, *Bass*…);
2. **tuning** — a **preset** for that entry (*Standard*, *Drop D*, *Open G*,
   *DADGAD*… — the presets the catalogue carries) **or a custom pitch list**
   typed as cifra.md §6 text; the chosen tuning is shown as its identity text;
3. **optional rename** — the label defaults to *catalogue · tuning*
   (*Guitar · Drop D*) and can be changed.

The result is a new instance with its own rules, starting from the preset
default for its catalogue entry (below). Setting up *Guitar · Standard* and
later *Guitar · Drop D* leaves **two instruments** in the roster, as intended —
a tuning is the identity, so they are genuinely different.

## The voicing rules

Every fingering the app offers — the reading view's default, the explorer's
ranked list, the arrange picker — is the easiest shape the fingering search
finds **under the instrument's rules** (workflow 2 lines 96–97; workflow 16).
Those rules **belong to the instrument instance, not the app** (Explore Chords
§2.5): a bass and a ukulele want permanently different rules, and a global mode
you must remember to switch is the wrong model. They are the `rules` register of
§4.3.

### The preset

Each instrument carries a **preset**, one of **Beginner**, **Strumming**,
**Fingerstyle**, **Jazz**, **Bass-friendly**. There is **no *Standard***:
strumming and fingerstyle are two ways of playing, not a norm and a deviation,
and the baseline is **Strumming**, named for the one assumption it rests on — a
strumming hand crosses every string, so a strummed chord has no muted hole in
the middle. The default per catalogue entry is sensible: **Strumming** for a
guitar, **Bass-friendly** for a bass (Explore Chords' `defaultPresetFor`).

*How you play* is **not a first-run question**. Explore Chords asked it before
anything else; estante puts the song first (workflow 1 lines 62–63), so it is
this preset, chosen when **setting up or editing** the instrument — with the
sensible per-catalogue default until it is. A **preset is its rules**: an
instrument that names one is **rebuilt from it on load**, so a later correction
to a preset reaches an instrument set up a year ago, and there is nothing of the
user's to lose.

### The expert panel

Below the preset, an **expert panel** exposes **every rule** the music core's
configuration carries (`HeuristicConfig`, carried over under DIRECTION §5) —
each decision a **toggle**, each limit and cost a **number**:

- **toggles** — *root required* (`requireRoot`), *root in bass* (`rootInBass`),
  *third required* (`requireThird`), *fifth may be omitted* (`omitFifth`),
  *rootless allowed* (`allowRootless`), *extensions required*
  (`requireExtensions`), *barre allowed* (`allowBarre`), *inner mutes allowed*
  (`allowInnerMutes`), *doubling allowed* (`allowDoubling`), *duplicate pitch
  allowed* (`allowDuplicatePitch`);
- **limits** — *max span* in frets (`maxSpan`), *min sounding strings*
  (`minSoundingStrings`), *shapes shown per group* (`maxResultsPerGroup`);
- **costs** — the scoring weights the difficulty ranking uses (`weights`, from
  Explore Chords' `DEFAULT_WEIGHTS`: the per-fret stretch, a barre, each finger,
  a muted string, an omitted fifth, a rootless voicing, a non-root bass, the
  open-string bonus…), each a number.

**Editing any one flips the label to `Custom`**, and a `Custom` configuration is
**kept exactly as written** — it is *not* rebuilt from a preset when it loads,
unlike one that still names a preset. The state is carried by a **word**
(*Strumming*, or *Custom*), never colour alone, and a *Custom* instrument offers
*reset to a preset* to get back.

Two rules are **not free toggles the user can break**: **`rootInBass` is forced
off where the instrument has no bass register** — its lowest open string is not
below C3, true of the ukulele and the cavaquinho but not the guitar or the bass
— so switching a ukulele to *Jazz* cannot re-break it (`configFor` reapplies the
instrument's own defaults on top of any preset); and whether a muted string is
*allowed* is this panel's toggle, but whether a mute is *justified* in a given
shape is the search's own rule, not something the panel exposes.

## Reviewing my shapes

*My shapes* — how the user plays a chord on an instrument — are starred one at a
time in the explorer (workflow 16) and in the arrange picker, and are never
written into a song (workflow 2 lines 103–108). Where they are **reviewed and
removed** was left open (workflow 16 lines 203–205): it is here. The instrument's
screen lists **the shapes saved for that instrument, grouped by tuning** (the
`shapes.json` subtree for its id, home-book §4.4), each drawn as a `ChordBox` in
the chord colour and labelled *your shape*, with a way to **remove** it. Adding
a shape stays the explorer's one-at-a-time starring — this is review and
removal, not a second editor. A removed shape is a **tombstone** on its leaf
register (home-book §5.3). A separate cross-instrument *all my shapes* browser
was rejected: a per-instrument list is enough to drop a stale shape without
re-finding it in the explorer, and there is no second call site for a global one
today.

**Notation is not set here.** The dialect is a single home-book preference set
once (workflow 1; workflow 16 line 78) — how the user reads chords, not a
property of the instrument — so the instrument screen does not repeat it.

## Removing an instrument

Removing an instrument **asks first**, and the confirmation **names what goes
with it**: the shapes saved for it (`shapes.json`) and the per-tuning
variations-in-use for its tunings (`songs.json`) are removed too, each as a
tombstone on its register (home-book §4.3, §5.3). Removing the **in-use**
instrument, or the **last** one, **falls back to the standard guitar** — the
same built-in default an absent in-use register means (workflow 1). The songs'
own voicing blocks are untouched: they belong to the song, not the home book, so
another device, or a bandmate, still reads them.

## No "viewing as" override

Explore Chords had a transient *viewing as* bar for a shared link or a sheet
written for another instrument (§2.1). Estante does **not** carry it: the reading
view already handles a song whose voicings are for a tuning the user does not
use, through the shape fallback (workflow 2 lines 88–108 — the song's choice,
then *my shape*, then the app default), and a shared **book** (workflow 10)
carries no instrument. Switching the in-use instrument from the chip is the only
instrument change, and it is explicit.

## Offline

Adding an instrument, switching, editing a rule, and removing a shape or an
instrument are **home-book preference changes**: they **commit automatically**
and sync when there is a network (DIRECTION §3.2; workflow 16 lines 119–122) —
not the explicit save-sheet of workflow 4. Everything here runs on the device:
the catalogue, the fingering search and the scoring are the framework-free music
core (DIRECTION §3.6–3.7, §5), and the home book is written locally first.
Nothing waits on the network, and nothing here needs a shared book or a
membership — it is all the user's own.

## Edge cases

- **A tuning that duplicates an existing instance.** Setting up a second
  instrument with a tuning identity one already has is allowed but pointed out —
  the two would share the same *my shapes* and song variations under that
  tuning, and editing the existing one is usually what was meant. The user may
  keep both (two labels, two rule sets) or cancel. *(The exact wording, and
  whether to offer "edit the existing one instead", is a detail to settle while
  building — later.)*
- **A custom pitch list that does not parse** as cifra.md §6 text (a stray
  token, an empty list) is refused with the reason, as `parseTuning` faults;
  nothing is stored until it reads.
- **Switching to an instrument whose rules admit no shape** for a chord on
  screen. The reading view falls through its default chain as always
  (workflow 2), and the explorer shows its *no shape fits the rules* empty state
  pointing back here (workflow 16 lines 173–179) — the search never silently
  relaxes the rules.
- **A `Custom` instrument when its preset is later corrected.** It keeps its
  edited rules exactly; only instruments that still name a preset are rebuilt
  (above).

## Later

- **Starting a tuning from a nearby one's shapes.** A tuning close to one the
  user already has (drop D from standard, or a capo) could offer to start from
  that tuning's shapes, adjusted where they still fit — already a *later* item
  in workflow 5 (lines 96–102). Nothing carries over automatically, and must
  not.
- **A capo as a tuning the search runs on.** A capo is a tuning (cifra.md §6.3);
  once the capo feature lands it is just another instance, and the explorer and
  the reading view follow it like any other tuning — already a *later* item in
  workflow 16.

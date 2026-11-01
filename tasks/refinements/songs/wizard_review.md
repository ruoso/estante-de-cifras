# songs.wizard_review — The wizard's plan named, counted and found

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), task `songs.wizard_review` ("The
wizard's plan named, counted and found"), under `task songs`. It `depends
!wizard_ui, !arrange_in_editor` and sits in `milestones.m5_complete`. The note
lists what the persona exploration found and the fixes below.

## Source

A persona exploration on 2026-11-01: a Haiku agent playing a choro teacher
(*Marcos*), told only that the app "has a wizard that picks the chord shapes
for a whole song, and it knows choro", drove the voicing wizard on the example
song with `scripts/explore` against the pushed `main`, on a computer and then
a phone. Each finding was checked against its screenshots and the code before
it became work; the human confirmed they had met the same problems.

## Decisions

1. **Every previewed shape is named and marked.** The plan's diagrams — under
   its steps on a phone or a tablet, in the *Shapes · {variation}* column on a
   computer — carry the chord's name and, where the shape sounds something
   else, what it sounds (`shapeNames`, as the editor's and the reading view's
   shapes do: *G  G/B*). Each carries a word, *new shape* or *as now*, through
   `ChordDiagram`'s new `note` (the word slot a kind's *default* / *your shape*
   uses). On a phone the named diagrams are the plan; no chart is added there,
   since a phone's wizard is already a long scroll.
2. **The count is of chords.** *{n} of {m} chords would change* counts the
   distinct chords the diagrams show; a chord changes when any place it is
   played gets a shape the variation does not already have there. Before, it
   counted every occurrence (20 of 20 for a five-chord song).
3. **A plan that changes nothing offers nothing to write.** The note says so
   (*…so there is nothing to write. Go back to try another way.*), and the
   where-to-put-it question, the edit note and *Write the plan* are not shown;
   *Back* remains. Writing such a plan used to copy the variation as a new
   one.
4. **The variation is quoted.** *Replace “Default”* (was *Over Default*), and
   the prompt and the new-variation hint quote it too, so a user's name such
   as *For my students* never reads as part of the sentence.
5. **Run the wizard is in the preview's head**, beside the instrument chip
   it plans for, in view when the preview opens — not after the whole chart.
6. **One way out on a computer.** The split's main bar loses its *Done*; the
   side's ✕ closes the wizard, as on a phone and a tablet. The instrument is
   named there in words (*Arranging · Guitar*), not on a chip, since nothing
   there switches it.
7. **The save sheet names the change as a person would.** A voicing block's
   tuning reads as the user's instrument whose strings sound it
   (`tuningLabelFor`: the in-use instrument, the roster, the standard guitar,
   compared by pitch so enharmonic spellings match), else as written; a named
   variation is named — *“For my students” added for Guitar*, *for Guitar,
   “Easy”: Em changed*. `DiffRows` reads the instruments through the shell's
   `ShellChrome` store, so the save sheet, the discard confirm, history and
   the upload preview all follow; outside the shell it renders the tuning as
   written. The suggested commit note stays the diff's neutral English.

Not taken up: the choro policy assumes a seven-string beside it with no way to
say otherwise (its text already says so; whether to ask is a design question
for its own task), and the long *How it works* panel.

## Design delta (rides in this task's commit)

- `docs/workflows/05-arrange-for-an-instrument.md` §The wizard — where *Run
  the wizard* sits, the named and marked plan, the count by chord, nothing to
  write, *replace “Default”*, ✕ as the one way out, and the save sheet's
  wording.

## Tests

- unit: `render-change.test.js` (a named variation added, removed, and a
  voicing in it; the tuning by its instrument; the default variation unnamed);
  `instrument-helpers.test.js` (`tuningLabelFor`: the roster, enharmonic
  strings, a tuning nobody plays or written by name).
- behavior: `SongWizard.behavior.test.jsx` (named shapes with what they sound,
  *new shape*/*as now*, *n of 4 chords* for a chart that plays G three times;
  nothing to write; ✕ the one way out on the computer; axe);
  `SongEditor.arrange.behavior.test.jsx` (Run the wizard in the preview's head
  beside the chip).
- e2e-web: `wizard.spec.js` (the example song's choro plan names G, C, D, Em,
  Am with G/B, C/E, D/F#, Em/G, Am/C, all *new shape*, *5 of 5 chords*; *Down
  at the nut* is all *as now* with nothing to write; Run the wizard in view;
  ✕ back to the editor with focus on Run the wizard; *Replace “Default”*; on
  the three viewports; axe).

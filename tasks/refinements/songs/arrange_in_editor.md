# songs.arrange_in_editor — Arrange in the editor; no arrange screen

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), task `songs.arrange_in_editor`
("Arrange in the editor; no arrange screen"), under `task songs`. It `depends
!arrange_polish, !editor_split_width, shell.one_bar` and sits in
`milestones.m5_complete`. The note, verbatim:

> Arranging lived in two places: an arrange screen entered from reading, and
> the editor's preview, which since fb191f7 arranges with the same tappable
> chart, picker, shapes, variations and choose-every (one hook, useArrange).
> The screen added only Run the wizard and a mode chip, and a person met two
> screens doing nearly the same thing. Retire the arrange screen: the reading
> view's Arrange (the phone's action bar, the More menu's Arrange for, the
> no-voicings notice) opens the editor on its preview — the Preview side of
> the switch where the two do not sit side by side — and the preview's actions
> gain Run the wizard, whose surface sits over the editor and returns to it
> (Back, Done, Write the plan) with focus on that button. The editor's bar
> leaves the instrument chip to the preview, so the screen keeps one chip.
> Source: review with the human 2026-11-01 (a report that the arrange screen
> hid the chord names, not reproduced on the example book; decided to keep
> one place to arrange). Tests: behavior (SongEditor: Run the wizard in the
> preview's actions, the pending edit sent first, disabled while a line stops
> the save, the editor opened on its preview; SongWizard: focus back to the
> editor's Run the wizard; AppShell routing: Arrange opens the editor, the
> wizard over it; axe); e2e-web (arrange.spec, wizard.spec, routing,
> full-height, display-preferences and a11y-chart through the editor's preview
> on the three viewports; axe).

## Decisions

1. **One place to arrange: the editor's preview.** `SongArrange` and its dev
   mount (`#dev/arrange`) are gone. The arranging itself stays in
   `useArrange` (`app/src/songs/arrange-surface.jsx`); the editor is now its
   only host. Nothing the screen did is lost: its chart, picker, enter a
   shape, shapes, variations and choose-every were the hook's, and the editor
   already laid them out.
2. **The reading view's Arrange stays, and opens the editor.** Every way in —
   the phone's action bar, the More menu's *Arrange for {instrument}*, the
   no-voicings notice's *Arrange for {instrument}* — calls `onArrange`, which
   AppShell answers with `editingSong = { …, arrange: true }`. It is still
   hidden while the song is transposed (workflow 2). *Arrange* and *Edit* are
   both kept: one says where you land (the preview), the other the text.
3. **Arrange opens on the preview.** `startOnPreview` selects the Preview side
   of the editor's Text | Preview switch on its first measure; where text and
   preview sit side by side both show and nothing changes. After that the
   switch follows focus as before (songs.editor_split_width).
4. **Run the wizard is a preview action**, after *Variations*, disabled with
   them while the text holds a line that stops the save. Pressing it flushes
   the debounced edit first (the wizard reads the working copy), marks the
   editor to come back on its preview, and raises `onRunWizard`. The wizard is
   a layer over the editor (`['editor', 'wizard']`); closing it — *Back*,
   *Done* on the computer split, or after *Write the plan* — re-mounts the
   editor, which re-reads the working copy past the stale `source` entry it
   ignores at mount, and returns focus to *Run the wizard* once the text has
   loaded. The wizard's *Done* no longer closes two layers: there is no arrange
   layer under it.
5. **Only songs already in a book get the wizard.** `EditSongHost` passes
   `onRunWizard`; the new-song host does not, so a song still being written
   arranges shape by shape. The wizard can come to it later if asked for.
6. **One instrument chip on the editor.** On a tablet and a computer the
   editor's bar no longer draws the shell's chip (`BarEnd chip={false}`); the
   preview's head carries it, beside the shapes it decides — as the arrange
   screen's single chip did. The wizard still names the instrument as
   *Arranging · Guitar* on its computer split; the `arrange.back` string, used
   only by the retired screen, is removed from the four locales.

## Design delta (rides in this task's commit)

- `docs/workflows/05-arrange-for-an-instrument.md` — arranging happens in the
  editor's preview; *Arranging is a mode* becomes *Arranging is editing*; the
  chip, the wizard's place and its return.
- `docs/workflows/03-write-a-new-song.md` §The editor — the preview is where a
  song is arranged, with *Run the wizard*; the reading view's *arrange* opens
  it.
- The W05 board still draws the arrange screen; the editor board's preview is
  the drawing of record until the boards are refreshed.

## Tests

- behavior: `SongEditor.arrange.behavior.test.jsx` (Run the wizard flushes the
  pending edit and raises `onRunWizard`; disabled while a line stops the save;
  the phone editor opens on the preview only when asked), `SongWizard.behavior
  .test.jsx` (the keyboard run returns focus to the editor's Run the wizard),
  `AppShell.routing.behavior.test.jsx` (Arrange opens the editor; the wizard
  over it; back after a reload leaves the song), `SongReading.behavior.test.jsx`
  (`onArrange` carries the title).
- e2e-web: `journeys-core.js`'s `enterArrange` lands on the editor's preview
  and `saveArrangementThroughSheet` saves from the editor; `arrange.spec.js`,
  `wizard.spec.js`, `routing.spec.js`, `full-height.spec.js`,
  `display-preferences.spec.js` and `a11y-chart.spec.js` follow.
  `wizard.spec.js` now checks the plan was applied, not only that the editor
  came back: every shape the wizard previewed (read from each diagram's label,
  chord and shorthand) is the song's own afterwards for the variation written,
  nothing is left unchosen, a plan into a new variation leaves *Default* as it
  was, and the same holds after a save and reload and after an offline reload.
  A choro run (*Choro, beside a seven-string*, its stylistic question at its
  default) writes its inversions into a new variation, and the reading view's
  *Name chords as voiced* renames the chart to what they sound — on the example
  song G/B, C/E, D/F#, Em/G, Am/C, each chord alike everywhere and named over
  its bass — while *as written* keeps the chart's own names before and after.

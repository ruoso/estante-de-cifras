# Mockups

Every workflow in [../workflows/](../workflows/), drawn on a phone, a tablet and a
computer, and the visual language they share. They are viewed on a design canvas:
<https://claude.ai/artifact/1ExKSNhyFiQWLKKsijDVBm> (private to its owner until shared).
This directory is the source of that canvas, kept here so it can be read and diffed
beside the decisions it draws. The files rely on the canvas's runtime and do not render
on their own.

## What is here

- `Main.dc.html`: the visual language. Three directions drawn with the same parts:
  - **Estante**: neutral, ink-blue chords.
  - **Caderno**: paper, pen-red chords, serif titles.
  - **Palco**: dark stage, amber chords, Atkinson Hyperlegible.
- `W01-…` to `W14-…`: one board per workflow. Each has two phones, a tablet and a computer.
- `ChordBox.dc.html`: the chord diagram component every board uses.
- `theme.css`: the design tokens of the three directions and every shared part. `theme-current` picks the direction all boards show; each board's tweaks can switch it to any direction and density.
- `canvas.json`: how the boards are laid out on the canvas.
- `GUIDE.md`: the brief the boards were drawn from. Its paths point at the working folder they were written in.

## Decisions the drawings carry

- **Charts are set in a proportional face, not a monospace.** A sung line is drawn as segments, each a chord stacked over the words it is attached to. A chord wider than its syllable opens room in the words. Where that room falls inside a word, a centred hyphen bridges it, as syllables are joined under notes in sheet music. Chord-only lines are measures between bar rules. Only the raw source editor and a verbatim block in a song are monospaced.
- **A chord diagram that starts up the neck** shows the fret number alone (`8`), right-aligned beside the first fret.
- **Defaults are drawn hollow, your shapes filled in the chord colour, the song's own shapes filled in ink.** Every status badge carries a word, never colour alone.

# The choro book (reader.engine fixture)

Four instrumental choro-like charts, written for this project, chord-heavy on
purpose: diminished and half-diminished chords, altered dominants (`7(b9)`,
`7(#5)`, `7(#11)`), `6/9` and `13`, slash-bass lines, secondary dominants, and
a minor A part against major B and C parts. One is read in the American
dialect and one in Real Book symbols, so the reader is checked beyond the
default Brazilian one.

`npm run build` fills this book's default-shape table with the Worker's own
fill and records the built bundle's answers for it under Node
(`dist-test/device/choros.default-shapes.json`); the reader's engine replays
them in goja at all twelve keys.

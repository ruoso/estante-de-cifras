// Written-for-purpose chart fixtures for the dev gallery (shell.chart).
//
// Plain-object models in the reader's shape (spec/0-overview.md §0.4; the shape
// `corpus/28-sung-line-layout/parsed.json` carries), hand-written rather than
// parsed so the gallery pulls in no `cifra-md` and the chart is driven by data
// alone — the way a real screen will hand it the model read from a slice
// (DIRECTION §3.7 lines 407-414). The words are already divided among the items
// as the §4.5 pass leaves them, with no `_` padding; the song is nonsense
// written for the purpose, never anyone's copyrighted words (the standing "no
// song text" rule — these are the gallery's own fixture lines).

// A short sung-and-charted song: a verse of two sung lines (the first splits a
// word so the centred hyphen shows), a stanza break and a words-only line, then
// a chord section with a bar-lined line and a run.
export const demoSong = {
  title: 'A Gallery Tune',
  properties: [],
  blocks: [],
  sung: true,
  sungAt: 2,
  diagnostics: [],
  sections: [
    {
      name: 'Verse',
      heading: 'markdown',
      anchor: null,
      groups: [],
      body: [
        {
          type: 'music',
          lines: [
            // "  G\nTesting" → lead "Te" under an empty slot, then G over
            // "sting": the chord opens room inside the word, so a hyphen bridges
            // "Te" and "sting".
            {
              kind: 'sung',
              closeBar: null,
              forced: false,
              measures: [
                {
                  bar: null,
                  items: [
                    { type: 'lead', column: 0, words: 'Te' },
                    { type: 'chord', symbol: 'G', index: 1, key: 'G', chord: null, column: 2, words: 'sting' },
                  ],
                },
              ],
            },
            // Each chord sits over a word start, so no hyphen is drawn.
            {
              kind: 'sung',
              closeBar: null,
              forced: false,
              measures: [
                {
                  bar: null,
                  items: [
                    { type: 'chord', symbol: 'G', index: 1, key: 'G', chord: null, column: 0, words: 'cats ' },
                    { type: 'chord', symbol: 'D', index: 1, key: 'D', chord: null, column: 5, words: 'and ' },
                    { type: 'chord', symbol: 'Em', index: 1, key: 'Em', chord: null, column: 9, words: 'dogs' },
                  ],
                },
              ],
            },
            { kind: 'break' },
            { kind: 'lyric', text: 'humming with no chords', forced: false },
          ],
        },
      ],
    },
    {
      name: 'Chart',
      heading: 'markdown',
      anchor: null,
      groups: [],
      body: [
        {
          type: 'music',
          lines: [
            {
              kind: 'chart',
              closeBar: '|',
              measures: [
                { bar: null, items: [{ type: 'chord', symbol: 'C', index: 1, key: 'C', chord: null }] },
                { bar: '|', items: [{ type: 'chord', symbol: 'G', index: 1, key: 'G', chord: null }] },
                { bar: '|', items: [{ type: 'chord', symbol: 'Am', index: 1, key: 'Am', chord: null }] },
                { bar: '|', items: [{ type: 'chord', symbol: 'F', index: 1, key: 'F', chord: null }] },
              ],
            },
            {
              kind: 'chart',
              run: true,
              closeBar: null,
              measures: [
                {
                  bar: null,
                  items: [
                    { type: 'chord', symbol: 'Am', index: 1, key: 'Am', chord: null },
                    { type: 'chord', symbol: 'E', index: 1, key: 'E', chord: null },
                    { type: 'chord', symbol: 'F#m', index: 1, key: 'F#m', chord: null },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// The stable addresses of the two sung lines (section 0) and the bar-lined
// chart line (section 1, part 0, line 0), so each gallery state's `markOf`
// paints the lines the governing boards mark.
const addressKey = (a) => `${a.section}:${a.part}:${a.line}`;
const SUNG_LINES = new Set(['0:0:0', '0:0:1']);
const CHART_BARS = new Set(['1:0:0']);

// The four gallery states, mirroring the boards: plain (no marking), all
// defaults (W02 `mark-def` on the sung lines), a conflicted line (W09
// `mark-conf` on a bar-lined line) and arrange mode (W05 `mark-tap` on the sung
// lines and the chart). Each is a `markOf` the chart consumes unchanged.
export const GALLERY_STATES = [
  { id: 'plain', label: 'Plain reading chart', markOf: () => null },
  {
    id: 'defaults',
    label: 'All shapes on their default',
    markOf: (a) => (SUNG_LINES.has(addressKey(a)) ? 'def' : null),
  },
  {
    id: 'conflict',
    label: 'A conflicted line',
    markOf: (a) => (CHART_BARS.has(addressKey(a)) ? 'conf' : null),
  },
  {
    id: 'arrange',
    label: 'Arrange mode',
    markOf: (a) => (SUNG_LINES.has(addressKey(a)) || CHART_BARS.has(addressKey(a)) ? 'tap' : null),
  },
];

// print-columns.js — how wide a printed column the song can live in (workflow 2
// §Reading a song, *Print*; Explore Chords' sheet-print `fitColumns`).
//
// A song with its words is narrow and tall: a sung line is about a third of the
// width of A4, so one column wastes most of the paper and spends pages doing it.
// The print dialog chooses the paper and the margins and never tells the page,
// so the page cannot count the columns; what it can measure is the narrowest
// column the song fits in. That goes on the sheet as `--print-column`, which the
// print stylesheet gives to `column-width`, and the browser fits as many columns
// as the real paper allows, down to one.
//
// The measure is the longest sung line, so no sung line wraps. Chart blocks are
// left out of it: their measures sit in a grid and cannot wrap, and one wide
// intro would force the whole sheet into one column. A block wider than the
// column spans every column instead (`data-print-span`), the way a wide figure
// does in a magazine. A song with no words at all takes its widest block.

const naturalWidth = (node) => {
  const before = node.style.width;
  node.style.width = 'max-content';
  const width = node.getBoundingClientRect().width;
  node.style.width = before;
  return width;
};

// A chart block is held to the chart's width on screen and scrolls inside it,
// so its own width is what it scrolls over.
const blockWidth = (node) => Math.max(naturalWidth(node), node.scrollWidth);

const widest = (nodes, measure) => nodes.reduce((max, node) => Math.max(max, measure(node)), 0);

/**
 * Measure the sheet and set its print column width; mark the chart blocks too
 * wide for it. Called just before printing, while the screen layout stands.
 *
 * @param {HTMLElement|null} sheet  the `.reading-sheet`
 */
export function fitPrintColumns(sheet) {
  if (!sheet) return;
  const sung = [...sheet.querySelectorAll('.chart .sung')];
  const blocks = [...sheet.querySelectorAll('.chart .bargrid, .chart .runline')];
  const column = sung.length ? widest(sung, naturalWidth) : widest(blocks, blockWidth);
  for (const block of blocks) {
    if (column > 0 && blockWidth(block) > column + 1) block.dataset.printSpan = 'all';
    else delete block.dataset.printSpan;
  }
  if (column > 0) sheet.style.setProperty('--print-column', `${Math.ceil(column)}px`);
  else sheet.style.removeProperty('--print-column');
}

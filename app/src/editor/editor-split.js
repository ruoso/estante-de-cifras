// Whether the editor shows its text and preview side by side
// (songs.editor_split_width; workflow 3 §The editor L78-84). Pure — no React,
// no DOM: the view (SongEditor) measures its own body and asks this
// (DIRECTION §3.7).
//
// The editor's own width decides, not the shell's layout: the side rail, the
// Unsaved pane or a narrow window can leave a wide layout a narrow editor
// (design.review_polish item 10, Decision *The editor splits by its own
// width*).

// The two panes' room: a text of at least 280px beside the 340px preview and
// the gap between them (`.est-editor-body` gap, 2 × --u: 16px at comfortable
// density, 20px at roomy). `280 + 340 + 16..20 ≈ 640px`. Independent of the
// shell's 600px breakpoint (layout-mode.js WIDE_QUERY).
export const EDITOR_SPLIT_MIN_WIDTH = 640;

/**
 * Whether the editor splits into text and preview side by side.
 *
 * - `previewAllowed: false` (the host withholds the preview — the computer's
 *   save panel stands there) → never: text only.
 * - `width` measured (a positive number) → at least EDITOR_SPLIT_MIN_WIDTH.
 * - `width` unmeasured (`null`, `0` — not laid out yet, or no ResizeObserver)
 *   → the layout mode, as before: `wide` splits (Decision 5).
 *
 * @param {{ width: number | null | undefined, mode: 'wide' | 'narrow', previewAllowed: boolean }} input
 * @returns {boolean}
 */
export function editorSplits({ width, mode, previewAllowed }) {
  if (!previewAllowed) return false;
  if (!width) return mode === 'wide';
  return width >= EDITOR_SPLIT_MIN_WIDTH;
}

// A small hook the setlist surface uses to learn a song's title when only its
// { bookId, path } is known (the reading view's `onAddToSetlist` seam carries no
// title). Search rows already know the title and pass it, so no read happens
// then; otherwise this asks the Worker for the song's working-copy text
// (OPEN_SOURCE → the `source` slice) and takes its H1. Display-only: the Worker
// derives the authoritative link text itself when it writes the item.

import { useEffect } from 'react';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';

const SONG_SUFFIX = '.cifra.md';

function stemOf(path) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.endsWith(SONG_SUFFIX) ? name.slice(0, -SONG_SUFFIX.length) : name;
}

// The first `# ` heading's text, or null when the text opens with something else
// (an H1 only counts as the title when it is the first non-blank line, §1).
function titleFromText(text) {
  if (!text) return null;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const m = /^#\s+(.*)$/.exec(line);
    return m ? m[1].trim() || null : null;
  }
  return null;
}

export function useLoadSong(store, bookId, path, initialTitle) {
  const source = useSlice(store, 'source');
  useEffect(() => {
    if (initialTitle) return;
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
  }, [store, bookId, path, initialTitle]);
  if (initialTitle) return initialTitle;
  const text = source?.[bookId]?.[path]?.text;
  return titleFromText(text) ?? stemOf(path);
}

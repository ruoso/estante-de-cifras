// MarkedTextEditor — the source editor (workflow 3) over a text held in memory:
// the conflict resolver's *edit* view of a song's marked text
// (sync.conflicts_editing; workflow 9 §Settling one; W09#3). The same
// CodeMirror setup as the song editor (sourceExtensions: line numbers, the
// cifra syntax colouring with marker lines as `est-mk`, the active line, the
// accessible name, tabindex 0), and nothing else: no OPEN_SOURCE, no WRITE, no
// store. A marked text never reaches the working copy (DIRECTION §2.2); the host
// sends the text to the Worker on its own Save.
//
// The view is created once on mount from `initialText`; a later `initialText`
// is ignored, so a re-render (a refused save) keeps the buffer and its undo
// history. The host reaches the view through `viewRef` (Go to line).

import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { sourceExtensions } from './source-extensions.js';
import './editor.css';

export default function MarkedTextEditor({ initialText = '', label, onChange, viewRef, className = '' }) {
  const containerRef = useRef(null);
  const changeRef = useRef(onChange);
  const initialRef = useRef(initialText);
  const labelRef = useRef(label);

  // The listener is built once but calls the latest handler; the ref is
  // updated in an effect, never during render.
  useEffect(() => {
    changeRef.current = onChange;
  });

  useEffect(() => {
    const view = new EditorView({
      parent: containerRef.current,
      doc: initialRef.current,
      extensions: sourceExtensions({
        label: labelRef.current,
        onDocChange: (update) => changeRef.current?.(update.state.doc.toString()),
      }),
    });
    if (viewRef) viewRef.current = view;
    return () => {
      view.destroy();
      if (viewRef) viewRef.current = null;
    };
  }, [viewRef]);

  return <div ref={containerRef} className={`est-cm ${className}`.trim()} />;
}

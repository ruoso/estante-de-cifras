// SongShapes — a song's shapes on the instrument in use, under its chart
// (songs.reading; books.print): one diagram per chord, marked for what it is,
// then the voicing block's notes and the caption. The reading view and the
// book's print both draw it from readSongSheet (song-sheet.js); the heading and
// its look are theirs. Named by its visible heading.

import { useId } from 'react';
import { parseChord } from '../core/notation/parse.js';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import { shapeNames } from './reading-view.js';

export default function SongShapes({ sheet, heading, caption = null, className = 'reading-shapes', headingLevel = 2 }) {
  const headingId = useId();
  if (!sheet.shapes.length) return null;
  const { notation, dialect, instrument, renamed } = sheet;
  const Heading = `h${headingLevel}`;
  return (
    <section className={className} aria-labelledby={headingId}>
      <Heading className="t-h3" id={headingId}>{heading}</Heading>
      <div className="shapes">
        {sheet.shapes.map((s) => (
          <ChordDiagram
            key={s.key}
            fingering={s.fingering}
            kind={s.source}
            context={{ chord: parseChord(s.symbol, notation).chord, dialect, instrument }}
            {...shapeNames(s, { notation, renamed })}
          />
        ))}
      </div>
      {sheet.blockNotes.length ? <p className="t-small reading-block-notes">{sheet.blockNotes.join('\n')}</p> : null}
      {caption ? <p className="t-small">{caption}</p> : null}
    </section>
  );
}

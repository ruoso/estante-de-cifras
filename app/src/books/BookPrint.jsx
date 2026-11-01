// BookPrint — the book's print (books.print; workflow 7 §Printing the book):
// every song in the book, each on its own page, behind an index whose rows are
// links to them, and on every page a link back to the index. Printed to paper
// it is a songbook; saved as a PDF (the print dialog's *Save as PDF*) the links
// are the PDF's own, so a tablet or an e-reader — a reMarkable — turns to a song
// with a tap and comes back the same way.
//
// Opened from the book's detail (*Print*), a surface over it like the setlist
// player: Back returns to the detail. On screen it is the preview — the index,
// then the songs — under one bar with *Print*; print hides the bar.
//
// The view is the only React layer (DIRECTION §3.7): it lists the book's songs
// through BROWSE (the `browse` slice, in the book page's order), asks for each
// song's text and reading state (OPEN_SOURCE / OPEN_SONG → the `source` and
// `song` slices), and draws each sheet the way the reading view does
// (readSongSheet: the song in the key it is read in, its shapes on the
// instrument in use). It adds no Worker command and persists nothing.
//
// The way back repeats on every page because each song is a layout table: the
// browser repeats a table's header row at the top of every page the table runs
// over, and the link in it with it, so a song that takes three pages has the
// way back on all three.

import { useEffect, useId, useMemo, useRef } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import { inUseEntry } from '../instruments/InstrumentChip.jsx';
import { chipLabel } from '../instruments/instrument-helpers.js';
import { BarEnd } from '../shell/HeaderChrome.jsx';
import Chart from '../chart/Chart.jsx';
import { bookLabelFor } from '../songs/first-run.js';
import { songTitle } from '../songs/search-query.js';
import { readSongSheet, shapesCaption, captionExplainsMarks, transposedLabel } from '../songs/song-sheet.js';
import SongShapes from '../songs/SongShapes.jsx';
import { fitPrintColumns } from '../songs/print-columns.js';
import { INDEX_ANCHOR, songAnchor, printProgress } from './book-print.js';
import '../songs/reading.css';
import './book-print.css';

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

// A link within the print. On paper (and in the PDF) it is a plain fragment
// link, which the browser writes as a link to that place in the document. On
// screen the fragment must not reach the address bar — the shell's places live
// in the history — so a press scrolls to the place instead.
function JumpLink({ to, className, children, ...rest }) {
  const onClick = (e) => {
    e.preventDefault();
    document.getElementById(to)?.scrollIntoView({ block: 'start' });
  };
  return (
    <a href={`#${to}`} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}

// One song's pages: the running head (the book, and the way back to the index)
// repeated on each page, then the song's own head and its sheet.
function PrintedSong({ index, song, text, reading, entry, preferences, bookLabel, instrumentLabel }) {
  const headingId = useId();
  const sheet = readSongSheet({ text, reading, entry, preferences });
  const title = songTitle(sheet.baseModel?.title ?? song.title, t('newSong.untitled'));
  const keyed = transposedLabel(sheet, t);
  const byline = [sheet.artist, instrumentLabel, keyed].filter(Boolean).join(' · ');

  let chart = null;
  if (sheet.empty) {
    chart = <p className="t-body">{t('reading.emptySong')}</p>;
  } else if (sheet.model) {
    chart = (
      <Chart
        model={sheet.model}
        size={20}
        label={title}
        markEmpty
        chordNames={sheet.renamed}
        barNumbers={sheet.barNumbers}
      />
    );
  }

  return (
    <article id={songAnchor(index)} className="book-print-song" aria-labelledby={headingId}>
      {/* A layout table, so paper repeats its header row — the book, and the
          way back to the index — on every page the song runs over. Only a real
          table's header does: a CSS table's header group is not repeated. */}
      <table className="book-print-pages" role="presentation">
        <thead>
          <tr className="book-print-running">
            <td className="t-small book-print-running-book">{bookLabel}</td>
            <td className="book-print-running-link">
              <JumpLink to={INDEX_ANCHOR} className="book-print-to-index">
                <span aria-hidden="true">↑ </span>
                {t('books.printBookToIndex')}
              </JumpLink>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={2} className="book-print-body">
              <div className="book-print-head">
                <h2 className="t-h1" id={headingId}>{title}</h2>
                {byline ? <span className="t-small">{byline}</span> : null}
              </div>
              <div className="reading-sheet">
                {chart}
                <SongShapes
                  sheet={sheet}
                  heading={keyed && sheet.status?.keyName ? t('reading.shapesInKey', { key: sheet.status.keyName }) : t('reading.shapes')}
                  caption={shapesCaption(sheet, t)}
                  captionScreenOnly={captionExplainsMarks(sheet)}
                  headingLevel={3}
                />
                {sheet.unvoiced.length ? (
                  <p className="t-small reading-unvoiced">
                    {t('reading.unvoiced', { list: sheet.unvoiced.map((k) => sheet.symbolByKey.get(k) ?? k).join(', ') })}
                  </p>
                ) : null}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

export default function BookPrint({ store, bookId, onBack = () => {} }) {
  const browse = useSlice(store, 'browse');
  const source = useSlice(store, 'source');
  const songSlice = useSlice(store, 'song');
  const instrumentsSlice = useSlice(store, 'instruments');
  const preferences = useSlice(store, 'preferences');
  const shelf = useSlice(store, 'shelf');
  const indexSlice = useSlice(store, 'index');

  const scope = useMemo(() => ({ books: [bookId] }), [bookId]);
  // The book's songs, re-read as its index settles, as the book's page does.
  useEffect(() => {
    store.send(command(CommandKind.BROWSE, { scope }));
  }, [store, scope, indexSlice]);

  const songs = useMemo(
    () => browse?.books?.find((b) => b.bookId === bookId)?.songs ?? [],
    [browse, bookId],
  );
  // Each song's text and reading state, asked for once per song.
  const asked = useRef(new Set());
  useEffect(() => {
    for (const s of songs) {
      if (asked.current.has(s.path)) continue;
      asked.current.add(s.path);
      store.send(command(CommandKind.OPEN_SOURCE, { bookId, path: s.path }));
      store.send(command(CommandKind.OPEN_SONG, { bookId, path: s.path }));
    }
  }, [store, bookId, songs]);

  // Print fills the paper: just before the dialog opens, each song's sheet is
  // measured for the narrowest column it fits in, as the reading view's is
  // (print-columns.js).
  const docRef = useRef(null);
  useEffect(() => {
    const fit = () => {
      for (const sheet of docRef.current?.querySelectorAll('.reading-sheet') ?? []) fitPrintColumns(sheet);
    };
    globalThis.addEventListener?.('beforeprint', fit);
    return () => globalThis.removeEventListener?.('beforeprint', fit);
  }, []);

  const texts = source?.[bookId] ?? {};
  const progress = printProgress(songs, texts);
  const entry = inUseEntry(instrumentsSlice);
  const instrumentLabel = chipLabel(entry);
  const bookLabel = bookLabelFor(shelf, bookId, t('books.untitled'));
  const indexHeadingId = useId();

  let status;
  if (!songs.length) status = t('books.printBookEmpty');
  else if (!progress.ready) status = t('books.printBookLoading', { done: progress.done, total: progress.total });
  else status = t('books.printBookReady', { count: progress.total });

  return (
    <div className="screen book-print">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('books.backToBook', { book: bookLabel })} onPress={onBack}>
          <BackIcon />
        </Button>
        <span className="title">{t('books.printBookTitle', { book: bookLabel })}</span>
        <Button
          className="btn primary"
          isDisabled={!progress.ready || !songs.length}
          onPress={() => window.print()}
        >
          {t('books.printBook')}
        </Button>
        <BarEnd help="book" />
      </div>
      <div className="scroll book-print-scroll">
        <p className="t-small book-print-status" role="status">{status}</p>
        <div className="book-print-doc" ref={docRef}>
          <nav id={INDEX_ANCHOR} className="book-print-index" aria-labelledby={indexHeadingId}>
            <h1 className="t-h1" id={indexHeadingId}>{bookLabel}</h1>
            {instrumentLabel ? (
              <p className="t-small">{t('books.printBookShapesFor', { instrument: instrumentLabel })}</p>
            ) : null}
            <h2 className="t-h3">{t('books.printBookIndex')}</h2>
            <ol className="book-print-toc">
              {songs.map((s, i) => (
                <li key={s.path}>
                  <JumpLink to={songAnchor(i)}>
                    <span className="book-print-toc-title">{songTitle(s.title, t('newSong.untitled'))}</span>
                    {s.artist ? <span className="t-small book-print-toc-artist">{s.artist}</span> : null}
                  </JumpLink>
                </li>
              ))}
            </ol>
          </nav>
          {songs.map((s, i) =>
            texts[s.path] ? (
              <PrintedSong
                key={s.path}
                index={i}
                song={s}
                text={texts[s.path].text ?? ''}
                reading={songSlice?.[bookId]?.[s.path] ?? null}
                entry={entry}
                preferences={preferences}
                bookLabel={bookLabel}
                instrumentLabel={instrumentLabel}
              />
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

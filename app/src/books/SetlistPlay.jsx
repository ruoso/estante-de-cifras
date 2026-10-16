// SetlistPlay — the full-screen performance surface (books.play, workflow 12
// §Playing through, §The key; board W12 phone "playing through"). From an
// opened setlist, Play enters a chrome-free screen that shows the songs one at
// a time, in order, each in the setlist's key, and turns the page by swipe,
// edge tap, the on-screen edge buttons, or the arrow/page keys a pedal sends.
// The screen is kept awake while playing; sync waits until it stops.
//
// The view is the only React layer (DIRECTION §3.7): it reads the setlist and
// each song's working-copy text through OPEN_SOURCE (the `source` slice →
// cifra-md's parseSetlist/parse), the book's file set through BOOK_TREE (the
// `tree` slice, for missing-item detection) and the user's own remembered
// transposition through OPEN_SONG (the `song` slice), and composes the pure
// music core — parse → transpose → <Chart> — itself. It adds no Worker command
// and persists nothing: the setlist's target key is applied at read time only,
// never written as the song's transposition (the key is the band's, workflow
// 12 §The key; Decision 3). "Sync waits" is load-once-per-song: a song's text
// is requested once when it becomes current and not re-requested while it
// stays on screen, so a background merge does not move the displayed chart
// (Decision 2); the next load — navigation or a re-open after Stop — shows the
// merged version.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { parse, parseSetlist } from 'cifra-md';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import { transpose, transposedKeyName } from '../core/transpose.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';
import Chart from '../chart/Chart.jsx';
import { setlistRows, bookFileSet } from './setlist-display.js';
import { playableItems, clampIndex, playKeyOffset, nextItem } from './setlist-play.js';
import { createWakeLock } from './wake-lock.js';
import './play.css';

// The app-bar glyphs (aria-hidden; each button carries its own accessible
// name). The stop ✕ and the chevrons the W12 board draws.
function Icon({ d, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}
const CLOSE = ['M6 6l12 12', 'M18 6L6 18'];
const CHEVRON_LEFT = ['M15 18l-6-6 6-6'];
const CHEVRON_RIGHT = ['M9 6l6 6-6 6'];

function songProperty(parsed, name) {
  return parsed?.properties?.find((p) => p?.key === name)?.value ?? null;
}

export default function SetlistPlay({
  store,
  bookId,
  path,
  mode = 'narrow',
  onStop = () => {},
  wakeLock = null,
}) {
  const source = useSlice(store, 'source');
  const tree = useSlice(store, 'tree');
  const song = useSlice(store, 'song');
  const preferences = useSlice(store, 'preferences');
  const dialect = preferences?.notation?.value ?? DEFAULT_DIALECT;

  // The setlist's own text and the book's file set — the inputs to the ordered
  // playable list. Requested once on mount (the setlist does not move while
  // playing either; a re-open after Stop reloads it).
  useEffect(() => {
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    store.send(command(CommandKind.BOOK_TREE, { bookId }));
  }, [store, bookId, path]);

  const setlistText = source?.[bookId]?.[path]?.text;
  const setlistModel = useMemo(
    () => (setlistText != null ? parseSetlist(setlistText) : null),
    [setlistText],
  );
  const present = useMemo(
    () => bookFileSet(tree?.[bookId]?.entries ?? []),
    [tree, bookId],
  );
  const playable = useMemo(
    () => (setlistModel ? playableItems(setlistRows(setlistModel, path, present)) : []),
    [setlistModel, path, present],
  );

  // The cursor is held unclamped; the live index is clamped against the
  // playable list, so a list that shrinks (a song gone missing on a reload)
  // never points off the end.
  const [cursor, setCursor] = useState(0);
  const index = clampIndex(cursor, playable.length);
  const current = playable[index] ?? null;

  const goNext = () => setCursor((c) => clampIndex(clampIndex(c, playable.length) + 1, playable.length));
  const goPrev = () => setCursor((c) => clampIndex(clampIndex(c, playable.length) - 1, playable.length));

  // Load-once-per-song (Decision 2): the current song's text and the user's own
  // reading state are requested when it becomes current, keyed on its resolved
  // path, and not re-requested while it stays on screen.
  const resolvedPath = current?.resolvedPath ?? null;
  useEffect(() => {
    if (!resolvedPath) return;
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path: resolvedPath }));
    store.send(command(CommandKind.OPEN_SONG, { bookId, path: resolvedPath }));
  }, [store, bookId, resolvedPath]);

  // The Wake Lock adapter (Decision 6): a stable value created once, held while
  // the player is mounted and released on Stop/unmount. Injectable so the
  // behavior test can spy it.
  const [lock] = useState(() => wakeLock ?? createWakeLock());
  useEffect(() => {
    lock.request('screen');
    return () => { lock.release(); };
  }, [lock]);

  const stop = () => {
    lock.release();
    onStop();
  };

  // The pedal keys (and Escape) are bound on the surface through a window
  // listener, so they drive the player wherever focus sits — a page-turner
  // sends the keys a keyboard does (workflow 12 L66-69). The latest handlers
  // are held in a ref so the listener is installed once.
  const navRef = useRef({ goNext, goPrev, stop });
  useEffect(() => { navRef.current = { goNext, goPrev, stop }; });
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); navRef.current.goNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); navRef.current.goPrev(); }
      else if (e.key === 'Escape') { e.preventDefault(); navRef.current.stop(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Move focus into the player on entry (the Stop button), so a screen reader
  // lands on the surface rather than stranding on the setlist behind it.
  const surfaceRef = useRef(null);
  useEffect(() => {
    surfaceRef.current?.querySelector('button')?.focus();
  }, []);

  // Swipe and edge-tap: pointer/touch enhancements over the SAME next/prev
  // actions as the edge buttons and keys (Decision 5). A clear horizontal drag
  // turns the page; an almost-still tap near a left/right edge does too, while
  // a tap in the middle leaves reading and scrolling alone.
  const pointerRef = useRef(null);
  const onPointerDown = (e) => { pointerRef.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e) => {
    const start = pointerRef.current;
    pointerRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext(); else goPrev();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect?.();
    const width = rect?.width || 0;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && width) {
      const relX = e.clientX - rect.left;
      if (relX < width * 0.25) goPrev();
      else if (relX > width * 0.75) goNext();
    }
  };

  // The current song's model and its key display. The setlist's target key is
  // applied through the transposition engine when the song has a written key;
  // without one it is shown as a note, untransposed; with no item key the song
  // reads under the user's own remembered offset (workflow 12 §The key).
  const songText = resolvedPath ? source?.[bookId]?.[resolvedPath]?.text : null;
  const baseModel = useMemo(
    () => (songText ? parse(songText, dialect) : null),
    [songText, dialect],
  );
  const writtenKey = songProperty(baseModel, 'key');
  const reading = resolvedPath ? song?.[bookId]?.[resolvedPath] : null;
  const ownOffset = reading?.transposition ?? 0;

  // The setlist's target key, when the item carries one, as a signed offset —
  // null (shown as a note, untransposed) when the song has no written key, a
  // key is not a key, or the two keys differ in mode (cifra.md §10.7.1).
  const itemKeyOffset = current?.key ? playKeyOffset(writtenKey, current.key) : null;
  const noteOnly = Boolean(current?.key) && itemKeyOffset == null;
  const offset = current?.key ? (itemKeyOffset ?? 0) : ownOffset;
  // The transposed model (React Compiler memoizes this derivation).
  const model = baseModel ? transpose(baseModel, offset, { dialect }) : null;
  // The chip names the key the chart is played in: whenever a setlist key is
  // in force — offset 0 included, so a band key equal to the written one is
  // still named — and, with no item key, only when the user's own
  // transposition moves the chart. A key shown as a note claims none.
  const showChip = current?.key ? !noteOnly : Boolean(offset);
  const currentKeyName = showChip ? transposedKeyName(writtenKey, offset, dialect) : null;
  // "written in" only when the setlist key actually moved the chart.
  const setlistLine = !current?.key
    ? null
    : !noteOnly && offset
      ? t('play.setlistKey', { key: current.key, songKey: writtenKey })
      : t('play.setlistKeyNote', { key: current.key });

  const title = current ? (baseModel?.title ?? current.title) : '';
  const total = playable.length;
  const next = nextItem(playable, index);

  const positionText = lock.supported
    ? t('play.positionAwake', { i: index + 1, n: total })
    : t('play.position', { i: index + 1, n: total });
  const announcement = current
    ? `${t('play.announce', { title, i: index + 1, n: total })}${next ? ` ${t('play.announceNext', { title: next.title })}` : ''}`
    : '';

  return (
    <div className="play-fullscreen" ref={surfaceRef}>
      <div className="play-bar">
        <Button className="btn icon" aria-label={t('play.stop')} onPress={stop}>
          <Icon d={CLOSE} />
        </Button>
        <div className="play-bar-text">
          <span className="t-h2 play-title">{title}</span>
          <span className="t-small">{positionText}</span>
        </div>
        {currentKeyName ? (
          <span className="chip accent">{t('play.inKey', { key: currentKeyName })}</span>
        ) : null}
      </div>

      {/* The sheet scrolls under the frame (shell.full_height) and holds no
          control, so it takes focus itself: a named region the keyboard can
          reach and scroll (axe scrollable-region-focusable). */}
      <div
        className="scroll play-sheet"
        role="region"
        aria-label={title || positionText}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {setlistLine ? <span className="t-small">{setlistLine}</span> : null}

        {model ? (
          <Chart model={model} size={mode === 'wide' ? 20 : 21} label={title || undefined} />
        ) : current ? null : (
          <p className="t-small">{t('play.empty')}</p>
        )}

        {next ? (
          <div className="card pad play-next">
            <span className="t-h3">{t('play.nextHeading')}</span>
            <span className="t-h2">{t('play.nextItem', { number: next.number, title: next.title })}</span>
            {next.note ? <span className="t-small">{t('play.note', { note: next.note })}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="t-small play-hint">{t('play.hint')}</div>

      <Button
        className="btn icon play-edge play-edge-prev"
        aria-label={t('play.previous')}
        isDisabled={index <= 0}
        onPress={goPrev}
      >
        <Icon d={CHEVRON_LEFT} size={18} />
      </Button>
      <Button
        className="btn icon play-edge play-edge-next"
        aria-label={t('play.next')}
        isDisabled={index >= total - 1}
        onPress={goNext}
      >
        <Icon d={CHEVRON_RIGHT} size={18} />
      </Button>

      <div role="status" aria-live="polite" className="visually-hidden">{announcement}</div>
    </div>
  );
}

// SongReading — the reading view (songs.reading, workflow 2 §"Reading a song",
// §"Transposing"; board W02). The screen a reader lands on when a search result
// is opened: the song drawn as a chart in a proportional face, then its shapes
// on the instrument in use, each resolved in the §7.6 order (the song's choice,
// then my shape, then the app's default) and marked for what it is. A picker
// chooses between a tuning's variations (remembered per song and tuning); the
// Transpose control reads the song up or down by semitones (remembered per
// song), changing only the view, never the song; a chrome-free full screen, a
// print stylesheet and the responsive app bar carry the rest.
//
// The view is the only React layer: it parses the working-copy text (OPEN_SOURCE,
// as the editor does) and composes the pure music core — parse → transpose →
// resolveSongVoicings → <Chart>/<ChordDiagram> — itself (Decision 1). The Worker
// owns durability: reading state is read through the `song` slice (OPEN_SONG →
// SONG) and written through SET_TRANSPOSITION / SET_VARIATION, never by the view
// touching storage (Constraints). "Which song is open", the transpose popover's
// open state and full screen are ephemeral view state, never a Worker slice.
//
// No router, mirroring ChordExplorer: narrow is a full screen over the shell
// with its own app bar and Back; wide below READING_ACTIONS_WIDE_QUERY is the
// tablet's whole-pane reading (W01#3, W02#3, W12#3 — no search rail, the chip
// and Transpose in the app bar, the shapes in a card); at and above it, the
// computer's master-detail — search in `.pane.side`, the reading view in
// `.pane.main` (songs.reading_chrome Decision 1). Overlays
// portal into the `.est` root through ThemeRoot's UNSAFE_PortalProvider
// (shell.portal_provider), so RAC menus and popovers are themed and labelled.

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  Label,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Select,
  SelectValue,
} from 'react-aria-components';
import { parse } from 'cifra-md';
import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import InstrumentChip, { inUseEntry } from '../instruments/InstrumentChip.jsx';
import { chipLabel } from '../instruments/instrument-helpers.js';
import HeaderChrome from '../shell/HeaderChrome.jsx';
import InstrumentsOverlay from '../instruments/InstrumentsOverlay.jsx';
import { instrumentInstance, openMidis } from '../core/instrument.js';
import { resolveSongVoicings, unvoiceableKeys } from '../core/voicings.js';
import { transpose } from '../core/transpose.js';
import { songVariations } from '../core/song-variations.js';
import { parseChord } from '../core/notation/parse.js';
import { DEFAULT_DIALECT, songDialect } from '../core/notation/dialects.js';
import Chart from '../chart/Chart.jsx';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import SearchScreen from './SearchScreen.jsx';
import { bookLabelFor } from './first-run.js';
import { transposeStatus, chartChordList } from './reading-view.js';
import { READING_ACTIONS_WIDE_QUERY } from '../shell/layout-mode.js';
import './reading.css';

// Keep an offset inside an octave: beyond ±11 is a redundant re-spelling of a
// smaller one, and the key name wraps anyway.
const clampOffset = (n) => Math.max(-11, Math.min(11, n));

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

// Whether a wide reading view is the computer's (search beside the song, the
// full row Edit · History · Add to setlist · Print · Share — W02 computer
// L153, L172-178) rather than the tablet's whole pane (W02#3): the one
// tablet/computer boundary, where shell.narrow_fit measured the full row to fit
// (songs.reading_chrome Decision 1). The ⋯ menu holds every action on every
// width; this only decides which shortcuts sit beside it (Decision 2). The same
// `matchMedia`/`useSyncExternalStore` seam the shell and the shelf use; a
// missing `matchMedia` (jsdom) reads as not-wide.
function readingActionsQuery() {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia(READING_ACTIONS_WIDE_QUERY)
    : null;
}
function subscribeReadingActions(onChange) {
  const query = readingActionsQuery();
  if (!query?.addEventListener) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
function readReadingActions() {
  return readingActionsQuery()?.matches ?? false;
}

function songProperty(parsed, name) {
  return parsed?.properties?.find((p) => p?.key === name)?.value ?? null;
}

// The up/down arrows drawn in the transpose popover and the reading glyph in the
// app bar (aria-hidden; the button's label is the accessible name).
function TransposeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

// The sync arrows beside the full-screen waiting footnote (W08#4 L154;
// aria-hidden — the words carry the state).
function SyncIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20 11a8 8 0 0 0-14-5l-2 2M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2M20 20v-4h-4" />
    </svg>
  );
}

// The ✕ on the first-open instrument prompt's dismiss control (W01 L107;
// aria-hidden — the button's "Keep guitar and dismiss" label is its name).
function DismissIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function SongReading({
  store,
  bookId,
  path,
  mode = 'narrow',
  onBack = () => {},
  onEdit = () => {},
  onOpenHistory = () => {},
  onArrange = () => {},
  onAddToSetlist = () => {},
  onShare = () => {},
  onOpenSong = () => {},
  // Show the file (songs.show_the_file; workflow 14 §The view L132-135): the
  // file view opened at this song's file.
  onShowFile = () => {},
  // A song's share (books.share_people), given the song's title: a panel beside
  // the chart on a tablet or a computer (W10 #4), the Share sheet — a Modal —
  // on a phone. Null when no share is open.
  sidePanel = null,
  // Told whether the song is read full screen (and false as it closes), so the
  // shell drops the recovery-email banner with the rest of the chrome
  // (workflow 13 §The banner, *Full screen*; account.sign_in_two_doors).
  onFullScreenChange = () => {},
}) {
  // Bring the song in on mount (and when the open song changes): the text to
  // parse (OPEN_SOURCE), the reading state (OPEN_SONG), and a device-local recent
  // (RECORD_RECENT — no home-book song commit, Decision 2). The Worker owns all
  // three; the view only asks.
  useEffect(() => {
    if (!bookId || !path) return;
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    store.send(command(CommandKind.OPEN_SONG, { bookId, path }));
    store.send(command(CommandKind.RECORD_RECENT, { bookId, path }));
  }, [store, bookId, path]);

  const [fullScreen, setFullScreen] = useState(false);
  useEffect(() => {
    onFullScreenChange(fullScreen);
    return () => onFullScreenChange(false);
  }, [fullScreen, onFullScreenChange]);
  const actionsInline = useSyncExternalStore(subscribeReadingActions, readReadingActions, readReadingActions);
  // The three reading chromes the boards draw (songs.reading_chrome): phone
  // (narrow), tablet (wide, below the query) and computer (wide, at or above).
  const computer = mode === 'wide' && actionsInline;
  const tablet = mode === 'wide' && !actionsInline;
  const shapesHeadingId = useId();
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);

  // A background sync landed a new version of this song (sync.read_in_place,
  // workflow 8 §"A song open while it changes"; W08). `update` is the shown
  // notice — `{ author, commit }` — or null; `pending` holds a merge that
  // arrived while full screen, applied on leaving it (the full-screen defer is a
  // main-thread view gate, never a Worker slice — Decision 3). Two merges while
  // full screen collapse to the most recent (acceptance 4).
  const [update, setUpdate] = useState(null);
  const [pending, setPending] = useState(null);
  // The live scroll container and a captured scroll anchor, so the reader keeps
  // their place when the chart re-renders on the merged version (Decision 4). A
  // ref, not state: it never renders and must survive the swap.
  const scrollRef = useRef(null);
  const anchorRef = useRef(null);

  // Capture the musical place before the text swaps: the first chart line still
  // at or below the viewport top, and its offset within the scroll viewport
  // (Decision 4). jsdom has no layout, so the anchor does not resolve there and
  // the plain `scrollTop` fallback is what the behavior test pins; the visual
  // guarantee is e2e-web.
  const captureAnchor = () => {
    const scroll = scrollRef.current;
    if (!scroll) {
      anchorRef.current = null;
      return;
    }
    const viewportTop = scroll.getBoundingClientRect().top;
    const lines = scroll.querySelector('.chart')?.children ?? [];
    let index = null;
    let offset = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const rect = lines[i].getBoundingClientRect();
      if (rect.bottom > viewportTop) {
        index = i;
        offset = rect.top - viewportTop;
        break;
      }
    }
    anchorRef.current = { scrollTop: scroll.scrollTop, index, offset };
  };

  // Pull the merged text for this open path and surface the notice. OPEN_SOURCE
  // is demand-driven (Decision 2): the fresh bytes flow through the `source`
  // slice, the chart re-parses and re-renders, and the layout effect below
  // restores the place after it lays out.
  const applyUpdate = (next) => {
    captureAnchor();
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    setUpdate(next);
    setPending(null);
  };

  // A merge landed (the transient MERGED fact, like RESTORED / FILE_MOVED). React
  // only when it names THIS open song; full screen defers (Decision 3). The
  // handler is held in a ref by useWorkerEvent, so it reads the current
  // `fullScreen` / `bookId` / `path` without re-subscribing.
  useWorkerEvent(store, EventKind.MERGED, ({ bookId: changedBook, changed }) => {
    if (changedBook !== bookId) return;
    const hit = changed?.find((c) => c.path === path);
    if (!hit) return;
    const next = { author: hit.author, commit: hit.commit };
    if (fullScreen) setPending(next);
    else applyUpdate(next);
  });

  // Leaving full screen applies any merge that waited (acceptance 4; W08 L159):
  // the update shows in place and the notice appears, now the performance is over.
  const leaveFullScreen = () => {
    setFullScreen(false);
    if (pending) applyUpdate(pending);
  };

  const sourceSlice = useSlice(store, 'source');
  const songSlice = useSlice(store, 'song');
  const instrumentsSlice = useSlice(store, 'instruments');
  const preferences = useSlice(store, 'preferences');
  const shelf = useSlice(store, 'shelf');

  const text = sourceSlice?.[bookId]?.[path]?.text ?? '';

  // Restore the captured place once the merged chart has laid out (Decision 4).
  // Keyed on the swapped text AND the notice: the re-issued OPEN_SOURCE's merged
  // bytes and the `update` notice commit in either order, and the notice sits
  // above the chart (it pushes it down), so the restore must run in the render
  // where the notice is present or it under-corrects by the notice's height. So
  // re-anchor on both, and release the captured place only once the notice has
  // laid out — an early text-only render re-anchors (a no-op while the notice is
  // still absent) but keeps the anchor, so the following notice render corrects
  // for real. Anchors to the same chart line when it resolves; falls back to
  // scrollTop (what the behavior test pins in layout-free jsdom).
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const scroll = scrollRef.current;
    if (!scroll) return;
    const lines = scroll.querySelector('.chart')?.children;
    if (anchor.index != null && lines && lines[anchor.index]) {
      const viewportTop = scroll.getBoundingClientRect().top;
      const rect = lines[anchor.index].getBoundingClientRect();
      scroll.scrollTop += rect.top - viewportTop - anchor.offset;
    } else {
      scroll.scrollTop = anchor.scrollTop;
    }
    if (update) anchorRef.current = null;
  }, [text, update]);

  const reading = songSlice?.[bookId]?.[path] ?? { transposition: 0, variations: {} };
  const offset = reading.transposition ?? 0;
  const dialect = preferences?.notation?.value ?? DEFAULT_DIALECT;
  const entry = inUseEntry(instrumentsSlice);

  // The instrument instance the music core searches on, re-derived when the chip
  // changes it (React Compiler memoises these pure derivations).
  let instrument = null;
  if (entry) {
    try {
      instrument = instrumentInstance({
        catalogId: entry.catalogId,
        label: entry.label ?? undefined,
        strings: entry.tuning,
        fretCount: entry.fretCount,
        heuristics: entry.config,
      });
    } catch {
      instrument = null;
    }
  }
  const tuningId = instrument ? openMidis(instrument).join(' ') : '';

  // Parse the working copy, then transpose the view (offset 0 leaves it as
  // written). The written key — for the chip's destination and the "Back to"
  // label — is read from the untransposed song (its `key` is left as written,
  // cifra.md §8.6).
  //
  // The chart is read, transposed and voiced in the song's own notation
  // (cifra.md §5.6; workflow 2 §Reading a song, "The song's notation reads its
  // chords"); `dialect`, the preference, only spells chords for this user.
  const baseModel = text ? parse(text) : null;
  const notation = songDialect(baseModel);
  const model = baseModel ? transpose(baseModel, offset, { dialect: notation }) : null;
  const writtenKey = songProperty(baseModel, 'key');
  const artist = songProperty(baseModel, 'artist');
  const bookLabel = bookLabelFor(shelf, bookId);

  const variation = reading.variations?.[tuningId] ?? '';
  const variations = baseModel && tuningId ? songVariations(baseModel, tuningId) : [];

  // Resolve every chord in the §7.6 order. While transposed the song's own
  // voicings are suppressed (the rewritten symbols no longer match them), so
  // every shape falls to yours or the default (workflow 2 L120-125).
  const resolved =
    instrument && model
      ? resolveSongVoicings(model, instrument, {
          variation,
          shapes: entry?.shapes ?? [],
          ignoreSongVoicings: offset !== 0,
          dialect: notation,
        })
      : new Map();
  const chordList = model ? chartChordList(model) : [];
  const symbolByKey = new Map(chordList.map((c) => [c.key, c.symbol]));
  const shapes = [...resolved.entries()].map(([key, v]) => ({
    key,
    symbol: symbolByKey.get(key) ?? key,
    source: v.source,
    fingering: v.fingering,
  }));
  const unvoiced = model ? unvoiceableKeys(model, resolved, { dialect: notation }) : [];

  // The accent notice: nobody has chosen shapes for this tuning in this song, so
  // every chord takes a default and the page offers arrange (workflow 2 L75-77).
  // Only at the written key — while transposed the shapes are deliberately not
  // the song's, which a different caption explains.
  const noVoicings = offset === 0 && Boolean(model) && chordList.length > 0 && variations.length === 0;
  const instrumentLabel = chipLabel(entry) || t('search.instrument');

  const status = transposeStatus(writtenKey, offset);
  const transposed = offset !== 0;

  const setTransposition = (semitones) =>
    store.send(command(CommandKind.SET_TRANSPOSITION, { bookId, path, semitones }));
  const setVariation = (next) =>
    store.send(
      command(CommandKind.SET_VARIATION, { bookId, path, tuning: tuningId, variation: next }),
    );

  const variationLabel = (v) => (v === '' ? t('reading.variationDefault') : v);

  // The transposed state, drawn once, in the meta row (songs.transpose_chrome;
  // mockups W02#4 L181-186): the chip naming the key, the way back to the written
  // key, and the "arranging is off" note. Both keys named, or neither
  // (transposeStatus). Shown only while transposed.
  const transposedParts = status
    ? [
        <span key="chip" className="chip accent">
          {status.keyName
            ? t('reading.transposedToKey', { key: status.keyName, offset: signed(status.offset) })
            : t('reading.transposedBy', { offset: signed(status.offset) })}
        </span>,
        <Button key="back" className="btn quiet" onPress={() => setTransposition(0)}>
          {status.writtenKey
            ? t('reading.backToKey', { key: status.writtenKey })
            : t('reading.backToWritten')}
        </Button>,
        <span key="arranging-off" className="t-small reading-arranging-off">
          {t('reading.arrangingOff')}
        </span>,
      ]
    : null;

  // The one transpose control renders as an app-bar icon (phone) or a labelled
  // button (the tablet's app bar, the computer's meta row — Decision 3).
  const variant = mode === 'wide' ? 'button' : 'icon';

  // The Transpose control: a popover stepper — down a semitone, the signed
  // offset, up a semitone — and nothing more; the meta row names the key and
  // carries the way back (songs.transpose_chrome Decision 2). RAC's
  // DialogTrigger owns its open state (ephemeral view state, not a slice) and
  // gives the keyboard path, focus management and Escape.
  const transposeControl = (
    <DialogTrigger>
      <Button
        className={variant === 'icon' ? 'btn icon' : 'btn'}
        aria-label={t('reading.transpose')}
      >
        {variant === 'icon' ? <TransposeIcon /> : t('reading.transpose')}
      </Button>
      <Popover>
        <Dialog className="reading-transpose" aria-label={t('reading.transposeTitle')}>
          <div className="reading-transpose-row">
            <Button className="btn icon" aria-label={t('reading.down')} onPress={() => setTransposition(clampOffset(offset - 1))}>
              −
            </Button>
            <span className="reading-transpose-now" aria-live="polite">
              {transposed ? signed(offset) : t('reading.writtenKey')}
            </span>
            <Button className="btn icon" aria-label={t('reading.up')} onPress={() => setTransposition(clampOffset(offset + 1))}>
              +
            </Button>
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );

  // The variation picker (RAC Select): shown when the tuning has more than one
  // variation and the song is not transposed (a transposed song has no chosen
  // shapes, so no variation to pick — workflow 2 L120-125). Keyboard-operable.
  const variationPicker =
    variations.length > 1 && !transposed ? (
      <Select
        className="reading-variation"
        selectedKey={variation}
        onSelectionChange={(key) => setVariation(String(key))}
      >
        <Label className="t-small">{t('reading.variationLabel')}</Label>
        <Button className="btn">
          <SelectValue />
        </Button>
        <Popover>
          <ListBox className="menu">
            {variations.map((v) => (
              <ListBoxItem key={v || 'default'} id={v}>
                {variationLabel(v)}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
    ) : null;

  // The shapes caption (mockups README L26; W02 L138, L206): while transposed,
  // why the shapes are not the song's; otherwise, how to read the kinds when any
  // chord is on a non-song shape (a word, never colour alone — the diagrams carry
  // "default" / "your shape", the caption names the colours).
  const anyNonSong = shapes.some((s) => s.source !== 'song');
  let caption = null;
  if (transposed && shapes.length) {
    caption = writtenKey
      ? t('reading.transposedCaptionKey', { key: writtenKey })
      : t('reading.transposedCaption');
  } else if (anyNonSong) {
    caption = t('reading.shapesCaption');
  }

  // The shapes heading (Decision 4): *Shapes in {key}* while transposed (W02#4);
  // otherwise the phone's plain *Shapes* (W02#2, the chip just above in the meta
  // row) and, on tablet and computer, *Shapes · {instrument}* by the chip's short
  // label (W01#3, W02#3; `.t-h3` uppercases it as the board does).
  let shapesHeading;
  if (transposed && status?.keyName) shapesHeading = t('reading.shapesInKey', { key: status.keyName });
  else if (mode === 'wide') shapesHeading = t('reading.shapesFor', { instrument: instrumentLabel });
  else shapesHeading = t('reading.shapes');

  const sheet = (
    <div className="reading-sheet">
      {model ? <Chart model={model} size={mode === 'wide' ? 20 : undefined} label={baseModel?.title ?? undefined} /> : null}
      {shapes.length ? (
        // The tablet's bordered card beside the chart (W02#3 L130-139); the
        // computer's unbordered column (W02#4 L198-207); the phone's plain
        // section (W02#2 L86-92). Named by its visible heading.
        <section
          className={tablet ? 'reading-shapes card pad' : 'reading-shapes'}
          aria-labelledby={shapesHeadingId}
        >
          <h2 className="t-h3" id={shapesHeadingId}>{shapesHeading}</h2>
          <div className="shapes">
            {shapes.map((s) => (
              <ChordDiagram
                key={s.key}
                fingering={s.fingering}
                kind={s.source}
                context={{ chord: parseChord(s.symbol, notation).chord, dialect, instrument }}
              />
            ))}
          </div>
          {caption ? <p className="t-small">{caption}</p> : null}
        </section>
      ) : null}
      {unvoiced.length ? (
        <p className="t-small reading-unvoiced" role="status">
          {t('reading.unvoiced', { list: unvoiced.map((k) => symbolByKey.get(k) ?? k).join(', ') })}
        </p>
      ) : null}
    </div>
  );

  // Full screen: the sheet alone, chrome hidden, with a keyboard-reachable way
  // out (workflow 2 L97; DIRECTION §3.7 "the worst moment for anything to move").
  if (fullScreen) {
    return (
      <div className="reading-fullscreen">
        {/* The top row W08#4 draws (L123-126): the song's title filling the free
            space, then the way out (sync.in_place_notices). The title is a
            heading-styled span, not a second landmark — the region below is
            already named by it. */}
        <div className="reading-fullscreen-top">
          <span className="t-h2 reading-fullscreen-title">{baseModel?.title ?? path}</span>
          <Button className="btn quiet reading-exit-full" onPress={leaveFullScreen}>
            {t('reading.leaveFullScreen')}
          </Button>
        </div>
        {/* The sheet scrolls under the frame (shell.full_height) and holds no
            control, so it takes focus itself: a named region the keyboard can
            reach and scroll (axe scrollable-region-focusable). */}
        <div
          className="scroll reading-fullscreen-scroll"
          ref={scrollRef}
          role="region"
          aria-label={baseModel?.title ?? path}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          {sheet}
          {/* A merge held back while full screen (Decision 3 of sync.read_in_place):
              a quiet footnote at the end of the sheet, naming the most recent
              author (W08#4 L153-156). Not a live region — announcing mid-song is
              the interruption workflow 8 L54 forbids; it is read in document
              order, after the chart (sync.in_place_notices Decision 1). */}
          {pending ? (
            <p className="reading-update-waiting">
              <SyncIcon />
              <span className="t-small">{t('reading.updateWaiting', { name: pending.author })}</span>
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  // The ⋯ menu, the same on every device (songs.reading_chrome Decision 2; the
  // .tji note: it holds Edit, History, Add to setlist, Print, Share): every
  // action of the reading view, keyboard-reachable the same way everywhere
  // (workflow 2 L86-87). The buttons a device draws beside it are shortcuts to
  // items it also holds.
  const moreMenu = (
    <MenuTrigger>
      <Button className="btn icon" aria-label={t('reading.more')} data-share-return="">
        <MoreIcon />
      </Button>
      <Popover>
        <Menu
          className="menu"
          aria-label={t('reading.more')}
          onAction={(key) => {
            if (key === 'edit') onEdit({ bookId, path, title: baseModel?.title });
            else if (key === 'history') onOpenHistory({ bookId, path });
            else if (key === 'addToSetlist') onAddToSetlist({ bookId, path });
            else if (key === 'print') window.print();
            else if (key === 'share') onShare({ bookId, path });
            else if (key === 'showFile') onShowFile({ bookId, path });
            else if (key === 'arrange') onArrange({ bookId, path });
            else if (key === 'fullScreen') setFullScreen(true);
          }}
        >
          <MenuItem id="edit">{t('reading.edit')}</MenuItem>
          <MenuItem id="history">{t('reading.history')}</MenuItem>
          <MenuItem id="addToSetlist">{t('reading.addToSetlist')}</MenuItem>
          <MenuItem id="print">{t('reading.print')}</MenuItem>
          <MenuItem id="share">{t('reading.share')}</MenuItem>
          <MenuItem id="showFile">{t('reading.showFile')}</MenuItem>
          {!transposed ? <MenuItem id="arrange">{t('reading.arrangeFor', { instrument: instrumentLabel })}</MenuItem> : null}
          <MenuItem id="fullScreen">{t('reading.fullScreen')}</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );

  // The first-open instrument prompt (workflow 1 §The instrument; W01 L104-108;
  // songs.first_song): the one-time inline notice offered the first time a song
  // shows its shapes on the implicit standard guitar. Shown iff no instrument has
  // been put in use (`instrumentInUse` absent — the copy is fixed to "guitar", so
  // a user who already chose has nothing to ask) AND the prompt has not been
  // answered (`instrumentPromptSeen` absent). Purely slice-driven off the home
  // book's preferences — no new store slice, no local "dismissed" useState
  // (Constraints; Decisions 2, 3). Both controls answer it (the Worker writes the
  // flag, the re-surfaced slice hides the notice); *Change instrument* also opens
  // the existing roster. An inline notice in the scroll body, never a modal — it
  // must not aria-hide the chrome or chart (Decision 4; project memory).
  const showInstrumentPrompt = !preferences?.instrumentInUse && !preferences?.instrumentPromptSeen;
  const markInstrumentPromptSeen = () =>
    store.send(command(CommandKind.MARK_INSTRUMENT_PROMPT_SEEN, {}));
  const instrumentPrompt = showInstrumentPrompt ? (
    <div className="notice accent reading-instrument-prompt">
      <span>{t('reading.instrumentPrompt')}</span>
      <Button
        className="btn"
        onPress={() => {
          markInstrumentPromptSeen();
          setInstrumentsOpen(true);
        }}
      >
        {t('reading.instrumentPromptChange')}
      </Button>
      <Button className="btn icon" aria-label={t('reading.instrumentPromptDismiss')} onPress={markInstrumentPromptSeen}>
        <DismissIcon />
      </Button>
    </div>
  ) : null;

  // The merge-landed notice (sync.read_in_place; workflow 8 L51-52; W08 L65,
  // L177): *updated by {name}: see what changed*, opening the song's history. A
  // non-modal inline notice in the scroll body with role="status" — it announces
  // without moving focus and never aria-hides the chart (UpdateReady.jsx; project
  // memory "RAC modal aria-hides shell chrome"). Dismissible; state carried by
  // the words, never colour alone (mockups README L26).
  const updateNotice = update ? (
    <div className="notice accent reading-update-notice" role="status">
      <span className="grow">{t('reading.updatedBy', { name: update.author })}</span>
      <Button
        className="act btn quiet"
        onPress={() => onOpenHistory({ bookId, path, commit: update.commit })}
      >
        {t('reading.seeWhatChanged')}
      </Button>
      <Button
        className="btn icon"
        aria-label={t('reading.updateDismiss')}
        onPress={() => setUpdate(null)}
      >
        <DismissIcon />
      </Button>
    </div>
  ) : null;

  // The meta row. The computer leads it with Transpose (where W02#4 draws the
  // transposed state's controls, Decision 3); the tablet's Transpose and chip
  // are in its app bar; the phone's chip is here (W02 phone 2) and its Transpose
  // an app-bar icon. One chip per screen (shell.header_chrome Decision 7): the
  // computer's heads the search rail. While transposed the written key's chip
  // gives way to the transposed state (W02#4: Transpose · byline · chip · Back ·
  // arranging is off), on every device.
  const metaRow = (
    <div className="reading-meta">
      {computer ? transposeControl : null}
      <span className="t-small reading-byline">
        {artist ? t('reading.byline', { artist, book: bookLabel }) : bookLabel}
      </span>
      {mode === 'wide' ? null : <InstrumentChip store={store} onOpen={() => setInstrumentsOpen(true)} />}
      {writtenKey && !transposed ? <span className="chip">{t('reading.keyOf', { key: writtenKey })}</span> : null}
      {transposedParts}
      {variationPicker}
    </div>
  );

  // The scroll body every device shares: the notices first, above the chart
  // (the instrument prompt, the update notice, the meta row with the transposed
  // state, no voicings),
  // then the sheet.
  const body = (
    <div className="scroll reading-scroll" ref={scrollRef}>
      {instrumentPrompt}
      {updateNotice}
      {metaRow}
      {noVoicings ? (
        <div className="notice accent">
          <span>{t('reading.noVoicings', { instrument: instrumentLabel })}</span>
          <Button className="act btn quiet" onPress={() => onArrange({ bookId, path })}>
            {t('reading.arrangeFor', { instrument: instrumentLabel })}
          </Button>
        </div>
      ) : null}
      {sheet}
    </div>
  );

  // Back to the destinations (Books, Setlists, Account): the shell is replaced
  // while a song is open, on every layout.
  const backButton = (
    <Button className="btn icon" aria-label={t('reading.back')} onPress={onBack}>
      <BackIcon />
    </Button>
  );
  const titleSpan = <span className="title">{baseModel?.title ?? path}</span>;
  const editButton = (
    <Button className="btn" onPress={() => onEdit({ bookId, path, title: baseModel?.title })}>
      {t('reading.edit')}
    </Button>
  );

  // The body with the side panel beside it, when one is open (wide); the phone
  // draws the sheet over its screen instead.
  const panel = typeof sidePanel === 'function' ? sidePanel({ title: baseModel?.title ?? null }) : sidePanel;
  const wideBody = panel ? (
    <div className="reading-with-panel">
      {body}
      {panel}
    </div>
  ) : (
    body
  );

  if (computer) {
    return (
      <>
        <div className="split reading-split">
          <div className="pane side reading-side">
            {/* Search beside the song (the computer's master-detail): a result
                tapped here switches the open song through the same seam. Left
                uncontrolled so it holds and edits its own query. Its head carries
                the wordmark and the chip outside the scroller (W02 computer). */}
            <HeaderChrome store={store} className="rail-head" onInstruments={() => setInstrumentsOpen(true)} />
            <SearchScreen store={store} onOpenSong={onOpenSong} />
          </div>
          <div className="pane main">
            {/* The full row (W02 computer L172-179), shortcuts to items ⋯ also
                holds; it fits from READING_ACTIONS_WIDE_QUERY (shell.narrow_fit). */}
            <div className="appbar reading-chrome">
              {backButton}
              {titleSpan}
              {editButton}
              <Button className="btn" onPress={() => onOpenHistory({ bookId, path })}>
                {t('reading.history')}
              </Button>
              <Button className="btn" onPress={() => onAddToSetlist({ bookId, path })}>
                {t('reading.addToSetlist')}
              </Button>
              <Button className="btn" onPress={() => window.print()}>
                {t('reading.print')}
              </Button>
              <Button className="btn" onPress={() => onShare({ bookId, path })} data-share-return="">
                {t('reading.share')}
              </Button>
              {moreMenu}
            </div>
            {wideBody}
          </div>
        </div>
        <InstrumentsOverlay store={store} isOpen={instrumentsOpen} onClose={() => setInstrumentsOpen(false)} />
      </>
    );
  }

  if (tablet) {
    return (
      <>
        {/* The tablet reads the song on the whole pane, no search rail (W01#3,
            W02#3, W12#3; Decision 1): Back · title · chip · Transpose · Edit · ⋯,
            the chip here because there is no rail to head. */}
        <div className="split reading-split reading-tablet">
          <div className="pane main">
            <div className="appbar reading-chrome">
              {backButton}
              {titleSpan}
              <InstrumentChip store={store} onOpen={() => setInstrumentsOpen(true)} />
              {transposeControl}
              {editButton}
              {moreMenu}
            </div>
            {wideBody}
          </div>
        </div>
        <InstrumentsOverlay store={store} isOpen={instrumentsOpen} onClose={() => setInstrumentsOpen(false)} />
      </>
    );
  }

  // Narrow: a full screen over the shell, its own app bar and bottom action bar.
  return (
    <>
      <div className="screen reading-screen">
        <div className="appbar reading-chrome">
          {backButton}
          {titleSpan}
          {transposeControl}
          {moreMenu}
        </div>
        {body}
        <div className="reading-actionbar reading-chrome">
          {!transposed ? (
            <Button className="btn grow" onPress={() => onArrange({ bookId, path })}>
              {t('reading.arrange')}
            </Button>
          ) : null}
          <Button className="btn grow" onPress={() => onEdit({ bookId, path, title: baseModel?.title })}>
            {t('reading.edit')}
          </Button>
          <Button className="btn primary grow" onPress={() => setFullScreen(true)}>
            {t('reading.fullScreen')}
          </Button>
        </div>
      </div>
      {panel}
      <InstrumentsOverlay store={store} isOpen={instrumentsOpen} onClose={() => setInstrumentsOpen(false)} />
    </>
  );
}

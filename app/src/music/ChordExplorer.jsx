// ChordExplorer — the screen *Explore A on your instrument* opens (music.explorer,
// workflow 16; board W16). Reached from search's chord row (never a home), it
// shows every way to play the typed chord on the instrument in use — ranked
// easiest first, grouped by position, each a ChordDiagram with a difficulty word
// and a star — over the carried music core (no music logic is written here). The
// chord is an editable input; the instrument is the ambient header chip; starring
// writes *your shape* to the home book (never into a song); an ambiguous §5.6
// symbol shows the reading it took and a flip; *enter a shape* places one by hand.
// The whole screen runs on the device, offline, needing no account.
//
// An in-memory surface, no router (shell.layout; design.explorer Decision): it
// composes its own `.appbar`, Back returns to search. On the computer it sits
// beside the search results (board L173-244) by embedding the search screen in the
// side pane, the two sharing the one symbol.

import { useState } from 'react';
import { Button, Input, Label, TextField, ToggleButton } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import InstrumentChip, { inUseEntry } from '../instruments/InstrumentChip.jsx';
import InstrumentsOverlay from '../instruments/InstrumentsOverlay.jsx';
import { displayLabel } from '../instruments/instrument-helpers.js';
import { instrumentInstance } from '../core/instrument.js';
import { parseChord } from '../core/notation/parse.js';
import { formatChord } from '../core/notation/format.js';
import { searchFingerings } from '../core/search.js';
import { sameChord } from '../core/chord.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';
import SearchScreen from '../songs/SearchScreen.jsx';
import FingeringGroups from './FingeringGroups.jsx';
import EnterShape from './EnterShape.jsx';
import { groupViewModel, spokenShorthand } from './fingering-groups.js';
import { BackIcon, StarIcon } from './icons.jsx';
import './music.css';

// The device-local commit identity before sign-in, as every other write path uses.
const LOCAL_IDENTITY = { id: 'local', name: 'Me' };

export default function ChordExplorer({
  store,
  initialText = '',
  mode = 'narrow',
  onBack = () => {},
  // The input and the search box hold one symbol (workflow 16 L24-26): each
  // edit is reported up so *back* returns to search with it still typed.
  onTextChange = () => {},
}) {
  const slice = useSlice(store, 'instruments');
  const entry = inUseEntry(slice);
  const preferences = useSlice(store, 'preferences');
  const dialect = preferences?.notation?.value ?? DEFAULT_DIALECT;

  const [text, setText] = useState(initialText);
  // The §5.6 reading flip: an `options.readings` override for the current chord,
  // reset whenever the symbol changes. It does NOT change the notation preference.
  const [overrides, setOverrides] = useState({});
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
  // The last text that parsed as a chord, so an unparseable edit dims its results
  // rather than emptying the screen (workflow 16 L189-191). Tracked in the change
  // handler (an event handler), never in render.
  const [lastValidText, setLastValidText] = useState(() =>
    initialText.trim() && parseChord(initialText.trim(), dialect).chord ? initialText.trim() : '',
  );

  const changeText = (value) => {
    setText(value);
    onTextChange(value);
    setOverrides({});
    const next = value.trim();
    if (next && parseChord(next, dialect).chord) setLastValidText(next);
  };

  // Build the instrument instance for the in-use entry, the opaque input the music
  // core searches on. Re-derives when the chip changes the instrument or tuning.
  // (React Compiler memoises these pure derivations; no manual useMemo.)
  const config = entry?.config ?? null;
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

  const trimmed = text.trim();
  const parsed = trimmed ? parseChord(trimmed, dialect, { readings: overrides }) : null;
  const chord = parsed?.chord ?? null;
  const unreadable = Boolean(trimmed) && !chord;
  const ambiguity = parsed?.ambiguities?.[0] ?? null;

  // The search: every way to play this chord on this instrument, ranked and
  // grouped by the core (never re-sorted here).
  const result = chord && instrument ? searchFingerings(chord, instrument, config, {}) : null;

  // The shapes stored for the current tuning, for the starred-match.
  const tuningShapes = (entry?.shapes ?? []).filter((s) => s.tuning === entry?.tuning);

  const groups = result ? groupViewModel(result, { chord, shapes: tuningShapes }) : null;

  const context = chord && instrument ? { chord, dialect, instrument } : null;
  const chordSymbol = chord ? formatChord(chord, dialect) : trimmed;

  // When the current text is unparseable, re-derive the last valid chord's results
  // to show dimmed (workflow 16 L189-191). Pure derivation (no ref, no effect);
  // only computed on the rare unparseable edit.
  const dimmedChord = unreadable && lastValidText ? parseChord(lastValidText, dialect).chord : null;
  const dimmedResult =
    dimmedChord && instrument ? searchFingerings(dimmedChord, instrument, config, {}) : null;
  const dimmedGroups = dimmedResult
    ? groupViewModel(dimmedResult, { chord: dimmedChord, shapes: tuningShapes })
    : null;
  const dimmedContext = dimmedChord && instrument ? { chord: dimmedChord, dialect, instrument } : null;

  // Star / unstar one shape as *your shape* for this chord on the in-use
  // instrument and tuning: SAVE_SHAPE writes, REMOVE_SHAPE tombstones; the Worker
  // does the canonical, auto-committed, no-push write. Keyed by the chord as the
  // music core matches it — never written into a song.
  const toggleStar = ({ fingering, starred }) => {
    if (!entry || !chord) return;
    const base = { id: entry.id, tuning: entry.tuning, author: LOCAL_IDENTITY };
    if (starred) {
      // Tombstone the exact stored leaf matching this chord (by chord, not
      // spelling) and shorthand, falling back to the canonical key.
      const leaf = tuningShapes.find(
        (s) => s.shorthand === fingering.shorthand && sameChord(parseChord(s.chord)?.chord ?? null, chord),
      );
      store.send(
        command(CommandKind.REMOVE_SHAPE, {
          ...base,
          chord: leaf?.chord ?? formatChord(chord, DEFAULT_DIALECT),
        }),
      );
    } else {
      store.send(
        command(CommandKind.SAVE_SHAPE, {
          ...base,
          chord: formatChord(chord, DEFAULT_DIALECT),
          shorthand: fingering.shorthand,
        }),
      );
    }
  };

  const flip = () => {
    if (!ambiguity) return;
    setOverrides((prev) => ({ ...prev, [ambiguity.kind]: ambiguity.alternatives[0] }));
  };

  // The star action slot the shared list renders beside each shape.
  const starAction = ({ fingering, starred }) => (
    <ToggleButton
      className="btn icon explorer-star"
      isSelected={starred}
      aria-label={
        starred
          ? t('explorer.unstar', { chord: chordSymbol, shorthand: spokenShorthand(fingering.shorthand) })
          : t('explorer.star', { chord: chordSymbol, shorthand: spokenShorthand(fingering.shorthand) })
      }
      onChange={() => toggleStar({ fingering, starred })}
    >
      <StarIcon filled={starred} />
    </ToggleButton>
  );

  // The reading-it-took notice and the flip to the other reading (§5.6).
  let notice = null;
  if (ambiguity && chord) {
    const altParsed = parseChord(trimmed, dialect, {
      readings: { ...overrides, [ambiguity.kind]: ambiguity.alternatives[0] },
    });
    const altSymbol = altParsed.chord ? formatChord(altParsed.chord, dialect) : null;
    notice = (
      <div className="notice accent explorer-notice">
        <span>
          {t('explorer.notice.readAs', {
            chord: chordSymbol,
            reading: t(['readings', ambiguity.kind, ambiguity.chosen]),
          })}{' '}
          {t(['explorer', 'notice', 'about', ambiguity.kind])}
        </span>
        {altSymbol ? (
          <Button className="act btn quiet" onPress={flip}>
            {t('explorer.notice.flip', { chord: altSymbol })}
          </Button>
        ) : null}
      </div>
    );
  }

  let results = null;
  if (unreadable) {
    results = (
      <>
        <p className="notice warn explorer-unreadable" role="status">
          {t('explorer.unreadable', { text: trimmed })}
        </p>
        {dimmedGroups ? (
          <div className="explorer-dimmed">
            <FingeringGroups groups={dimmedGroups} context={dimmedContext} />
          </div>
        ) : null}
      </>
    );
  } else if (result && result.count === 0) {
    results = (
      <div className="card pad explorer-empty">
        <h2 className="t-h2">{t('explorer.empty.title')}</h2>
        <p className="t-body">
          {t('explorer.empty.body', { chord: chordSymbol, instrument: displayLabel(entry) })}
        </p>
        <Button className="btn block" onPress={() => setInstrumentsOpen(true)}>
          {t('explorer.empty.rules')}
        </Button>
        <p className="t-small">{t('explorer.empty.hint')}</p>
      </div>
    );
  } else if (groups) {
    results = <FingeringGroups groups={groups} context={context} renderAction={starAction} />;
  }

  // The chord input sits above the scrolling results, so it stays reachable
  // while they scroll (workflow 16 §Scrolling and moving through it); the chip
  // is in the app bar above both.
  const detail = (
    <>
      <div className="explorer-head">
        <TextField className="field explorer-input" value={text} onChange={changeText}>
          <Label className="t-h3">{t('explorer.chord')}</Label>
          <Input className="input" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </TextField>
        <div className="list explorer-enter">
          <EnterShape
            instrument={instrument}
            chord={chord}
            chordSymbol={chordSymbol}
            dialect={dialect}
            onStar={(fingering) => toggleStar({ fingering, starred: false })}
          />
        </div>
      </div>
      <div className="scroll explorer-scroll">
        {notice}
        {results}
      </div>
    </>
  );

  const appbar = (
    <div className="appbar">
      <Button className="btn icon" aria-label={t('explorer.back')} onPress={onBack}>
        <BackIcon />
      </Button>
      <span className="title">{t('explorer.title')}</span>
      <InstrumentChip store={store} onOpen={() => setInstrumentsOpen(true)} />
    </div>
  );

  return (
    <>
      {mode === 'wide' ? (
        <div className="split explorer-split">
          <div className="pane side explorer-side">
            <SearchScreen
              store={store}
              query={text}
              onQueryChange={changeText}
              onExploreChord={(c, q) => changeText(q)}
            />
          </div>
          <div className="pane main">
            {appbar}
            {detail}
          </div>
        </div>
      ) : (
        <div className="screen explorer-screen">
          {appbar}
          {detail}
        </div>
      )}
      <InstrumentsOverlay
        store={store}
        isOpen={instrumentsOpen}
        onClose={() => setInstrumentsOpen(false)}
      />
    </>
  );
}

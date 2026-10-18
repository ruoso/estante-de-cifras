// SongConflict — the per-song conflict resolver (sync.conflicts, workflow 9
// §Settling one; W09 phone). It reads one paused book's recomputed model from
// the `conflicts` slice and walks the song's conflicts one at a time, each shown
// as the two versions side by side in musical terms — named *yours* and the
// incoming author's — with *keep mine*, *take theirs* and *edit*. A conflicted
// song's reading view (the preview below) marks its disputed bars (`mark-conf`).
//
// The view only sends RESOLVE_CONFLICT and mirrors the Worker through the
// CONFLICTS event (DIRECTION §3.7): it never touches git, the working copy or the
// index, and parses only the tiny conflict snippets it draws (cifra.md is
// framework-free and below the view). React Aria Components throughout, keyboard
// reachable, labelled; the only monospaced surface is the raw *edit* text
// (mockup README L24), in the source editor of workflow 3 with its markers named
// for the people (sync.conflicts_editing; W09#3).

import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { EditorSelection } from '@codemirror/state';
import { parse, resolveMarked } from 'cifra-md';
import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import Chart from '../chart/Chart.jsx';
import { chartRows } from '../chart/layout.js';
import MarkedTextEditor from '../editor/MarkedTextEditor.jsx';
import { labelMarkers, conflictTitle, differingMeasures, rowText } from './conflict-text.js';
import { chartChordList } from './reading-view.js';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import { inUseEntry } from '../instruments/InstrumentChip.jsx';
import { parseChord } from '../core/notation/parse.js';
import { DEFAULT_DIALECT, songDialect } from '../core/notation/dialects.js';
import { instrumentInstance } from '../core/instrument.js';
import { resolveSongVoicings } from '../core/voicings.js';
import { parseShorthand } from '../core/fretstring.js';
import { fingeringFromFrets } from '../core/search.js';
import './song-conflict.css';

// A chord diagram for one voicing side, built from the conflict's tuning, chord
// and fret shorthand — the same ChordDiagram the arrange screen draws. Null when
// the shape cannot be built (an unusual tuning or an unreadable chord): the card
// falls back to the chord and the shape as a labelled value.
function fingeringFor(item, side) {
  try {
    const shorthand = side === 'ours' ? item.ours : item.theirs;
    if (!shorthand) return null;
    const chord = parseChord(item.chord ?? item.key ?? '').chord;
    if (!chord) return null;
    const instrument = instrumentInstance({ strings: item.tuning });
    const frets = parseShorthand(shorthand);
    const fingering = fingeringFromFrets(frets, chord, instrument, instrument.heuristics);
    if (!fingering) return null;
    return { fingering, chord, instrument };
  } catch {
    return null;
  }
}

// Parse a run of chart lines (one side of a conflict) into a model the Chart can
// draw, or null when it will not parse. Bare chart lines (`chart`/`block-notes`
// runs) are wrapped in a fence so the reader takes them as a chart (§11.8.1); a
// `sections` run is already whole sections and parses as-is; a full song (the
// resolved marked text, for the preview) is passed as given.
function snippetModel(lines, { fence = false } = {}) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const text = fence ? '```\n' + lines.join('\n') + '\n```' : lines.join('\n');
  try {
    return parse(text);
  } catch {
    return null;
  }
}

// The in-use instrument as the reader builds it (SongReading), or null when the
// slice has not arrived or the entry will not build.
function readerInstrument(entry) {
  if (!entry) return null;
  try {
    return instrumentInstance({
      catalogId: entry.catalogId,
      label: entry.label ?? undefined,
      strings: entry.tuning,
      fretCount: entry.fretCount,
      heuristics: entry.config,
    });
  } catch {
    return null;
  }
}

// The chords one side of a chart conflict wrote in the bars that differ, each
// voiced as this device's reader would draw it (sync.conflicts_polish
// Decisions 1-2; workflow 9 §Settling one, "two bars rendered, two diagrams"):
// resolved in the §7.6 order against that side's whole song, so a voicing block
// in it governs its own chords, then my shapes, then the default. Distinct, in
// order of appearance; a chord the instrument cannot voice comes back with no
// fingering (its name is shown instead). Never throws.
function sideChords(item, side, sideModel, instrument, entry) {
  if (!instrument || !sideModel) return [];
  try {
    const notation = songDialect(sideModel);
    const resolved = resolveSongVoicings(sideModel, instrument, { shapes: entry?.shapes ?? [], dialect: notation });
    const seen = new Set();
    const out = [];
    for (const measure of differingMeasures(item, side)) {
      const model = snippetModel([measure], { fence: true });
      for (const { key, symbol } of model ? chartChordList(model) : []) {
        if (seen.has(key)) continue;
        const chord = parseChord(symbol, notation).chord;
        if (!chord) continue; // not a chord at all: nothing to voice or name
        seen.add(key);
        const voiced = resolved.get(key);
        out.push({ key, symbol, chord, source: voiced?.source ?? null, fingering: voiced?.fingering ?? null });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// The line addresses a conflicted song's reading view marks → the §7
// musical-terms phrase for each: the rows of ours whose text is one of the
// disputed lines (workflow 9 §Meeting one), keyed `section:part:line`, with the
// phrase a screen reader announces at entry — a chart line vs. another line
// (docs/screen-reader.md §7.1; workflow 9 lines 13-23).
function markedAddresses(model, markedLines) {
  const want = new Set(markedLines ?? []);
  const keys = new Map();
  if (!model || want.size === 0) return keys;
  for (const row of chartRows(model)) {
    const text = rowText(row);
    if (text != null && want.has(text) && row.address) {
      const { section, part, line } = row.address;
      const phrase = row.type === 'bars' || row.type === 'run'
        ? t('songConflict.spoken.chartLine')
        : t('songConflict.spoken.line');
      keys.set(`${section}:${part}:${line}`, phrase);
    }
  }
  return keys;
}

// One side of one conflict, in musical terms.
// `voicing` is { chords, dialect, instrument } for a chart side: the diagrams
// sit under the side's bar (W09#1 L45-77).
function SideCard({ item, side, heading, voicing }) {
  const value = side === 'ours' ? item.ours : item.theirs;
  let body;
  if (item.kind === 'chart' || item.kind === 'sections' || item.kind === 'block-notes') {
    const model = snippetModel(value, { fence: item.kind !== 'sections' });
    const chords = model && item.kind === 'chart' ? voicing?.chords ?? [] : [];
    const voiced = chords.filter((c) => c.fingering);
    const unvoiced = chords.filter((c) => !c.fingering);
    body = model ? (
      <>
        <Chart model={model} label={heading} />
        {voiced.length > 0 && (
          <div className="shapes est-conflict-diagrams">
            {voiced.map((c) => (
              <ChordDiagram
                key={c.key}
                fingering={c.fingering}
                kind={c.source}
                context={{ chord: c.chord, dialect: voicing.dialect, instrument: voicing.instrument }}
              />
            ))}
          </div>
        )}
        {unvoiced.length > 0 && (
          <p className="t-small est-conflict-unvoiced">
            {t('reading.unvoiced', { list: unvoiced.map((c) => c.symbol).join(', ') })}
          </p>
        )}
      </>
    ) : (
      <p className="t-small est-conflict-absent">{t('songConflict.absent')}</p>
    );
  } else if (item.kind === 'voicing') {
    const built = fingeringFor(item, side);
    body = built ? (
      <ChordDiagram
        fingering={built.fingering}
        context={{ chord: built.chord, dialect: DEFAULT_DIALECT, instrument: built.instrument }}
        kind={side === 'ours' ? 'yours' : 'default'}
      />
    ) : (
      <p className="t-body est-conflict-value">{value ?? t('songConflict.absent')}</p>
    );
  } else {
    body = <p className="t-body est-conflict-value">{value ?? t('songConflict.absent')}</p>;
  }
  return (
    <div className="card pad est-conflict-side" aria-label={heading}>
      <span className="t-h3">{heading}</span>
      {body}
    </div>
  );
}

// The heading and subline for a conflict, in musical terms. `model` is ours,
// parsed (the preview), from which a chart conflict's place is named.
function describe(item, author, model) {
  const theirs = author ?? null;
  if (item.kind === 'voicing') {
    const variation = item.variation ? item.variation : t('songConflict.mainVariation');
    return {
      title: conflictTitle(item, model, t),
      body: theirs
        ? t('songConflict.voicingBody', { tuning: item.tuning ?? '', variation, author: theirs })
        : t('songConflict.voicingBodyFallback', { tuning: item.tuning ?? '', variation }),
    };
  }
  if (item.kind === 'property') {
    return {
      title: conflictTitle(item, model, t),
      body: theirs ? t('songConflict.propertyBody', { author: theirs }) : t('songConflict.propertyBodyFallback'),
    };
  }
  if (item.kind === 'title') {
    return {
      title: conflictTitle(item, model, t),
      body: theirs ? t('songConflict.titleBody', { author: theirs }) : t('songConflict.titleBodyFallback'),
    };
  }
  if (item.kind === 'chart' || item.kind === 'sections') {
    return {
      title: conflictTitle(item, model, t),
      body: theirs ? t('songConflict.chartBody', { author: theirs }) : t('songConflict.chartBodyFallback'),
    };
  }
  return {
    title: conflictTitle(item, model, t),
    body: theirs ? t('songConflict.genericBody', { author: theirs }) : t('songConflict.genericBodyFallback'),
  };
}

export default function SongConflict({ store, bookId, path, onClose }) {
  const conflicts = useSlice(store, 'conflicts');
  const instrumentsSlice = useSlice(store, 'instruments');
  const preferences = useSlice(store, 'preferences');
  const song = conflicts?.[bookId]?.songs?.find((s) => s.path === path) ?? null;
  const author = song?.author ?? null;
  const authorLabel = author ? t('songConflict.theirs', { author }) : t('songConflict.theirsFallback');

  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(null); // { text } | null
  const editorView = useRef(null);
  const [refused, setRefused] = useState(null); // { line } | null
  const [settled, setSettled] = useState([]); // view-local log of this session

  // The song (this path) has left the model: resolved, or the book settled /
  // abandoned. Leave to wherever opened us (the book panel or the shelf).
  const gone = conflicts?.[bookId] == null || song == null;
  useEffect(() => {
    if (gone) onClose?.();
  }, [gone, onClose]);

  // The stepper stays inside the remaining conflicts as they settle: clamp at
  // render rather than mutating state in an effect.
  const count = song?.items?.length ?? 0;
  const effStep = Math.min(step, Math.max(0, count - 1));

  useWorkerEvent(store, EventKind.SAVE_REFUSED, (payload) => {
    if (payload?.bookId === bookId && payload?.path === path && payload?.reason === 'marked') {
      setRefused({ line: payload.line ?? null });
    }
  });

  // ours, canonical, with the disputed bars marked — the reading-view preview.
  // (The React compiler memoises these; they are cheap one-snippet parses.)
  const previewModel = song?.marked ? snippetModel(resolveMarked(song.marked, 'ours').split('\n')) : null;
  const markedKeys = markedAddresses(previewModel, song?.markedLines);
  // theirs, whole, for voicing the chords their side wrote against their song.
  const theirsModel = song?.marked ? snippetModel(resolveMarked(song.marked, 'theirs').split('\n')) : null;
  const entry = inUseEntry(instrumentsSlice);
  const instrument = readerInstrument(entry);
  const dialect = preferences?.notation?.value ?? DEFAULT_DIALECT;
  // The chart marks a conflicted line and, for a screen reader, names what
  // conflicts in musical terms (§7.1) — the phrase Chart bounds the region with.
  const markOf = (a) => {
    const key = `${a.section}:${a.part}:${a.line}`;
    return markedKeys.has(key) ? { mark: 'conf', phrase: markedKeys.get(key) } : null;
  };

  if (!song) return null;
  const item = song.items[effStep] ?? null;

  const logSettled = (label) => setSettled((prev) => [...prev, { label }]);

  const keepMine = () => {
    logSettled(`${describe(item, author, previewModel).title} · ${t('songConflict.settledMine')}`);
    store.send(command(CommandKind.RESOLVE_CONFLICT, { bookId, path, choice: 'mine', index: effStep }));
  };
  const takeTheirs = () => {
    logSettled(`${describe(item, author, previewModel).title} · ${author ? t('songConflict.settledTheirs', { author }) : t('songConflict.theirsFallback')}`);
    store.send(command(CommandKind.RESOLVE_CONFLICT, { bookId, path, choice: 'theirs', index: effStep }));
  };
  const keepBoth = () => {
    logSettled(`${describe(item, author, previewModel).title} · ${t('songConflict.settledKeepBoth', { author })}`);
    store.send(command(CommandKind.RESOLVE_CONFLICT, { bookId, path, choice: 'keep_both', index: effStep, author }));
  };
  const keepBothSong = () => {
    store.send(command(CommandKind.RESOLVE_CONFLICT, { bookId, path, choice: 'keep_both_song', author }));
  };
  // The marked text with its markers named for the people, as the side cards
  // name them (Decision 2): display only — still marker lines (§11.12.3).
  const openEdit = () => {
    setRefused(null);
    const labels = {
      yours: t('songConflict.markerYours'),
      theirs: author ? t('songConflict.markerTheirs', { author }) : t('songConflict.markerTheirsFallback'),
    };
    setEditing({ text: labelMarkers(song.marked ?? '', labels) });
  };
  const saveEdit = () => {
    setRefused(null);
    logSettled(t('songConflict.settledEdit'));
    store.send(command(CommandKind.RESOLVE_CONFLICT, { bookId, path, choice: 'edit', text: editing.text }));
  };
  // Go to line N (W09#3 L158): the cursor to the start of the refused line,
  // scrolled into view, and the editor focused.
  const goToLine = () => {
    const view = editorView.current;
    if (!view || refused?.line == null) return;
    const n = Math.min(Math.max(1, refused.line), view.state.doc.lines);
    const line = view.state.doc.line(n);
    view.dispatch({ selection: EditorSelection.cursor(line.from), scrollIntoView: true });
    view.focus();
  };

  const appbar = (
    <div className="appbar">
      <Button className="btn icon" aria-label={t('songConflict.back')} onPress={() => onClose?.()}>
        ‹
      </Button>
      <span className="title">{song.title}</span>
      <span className="badge conflict dot">{t('bookConflicts.conflictBadge')}</span>
    </div>
  );

  if (editing) {
    return (
      <div className="screen est-conflict-screen">
        {appbar}
        <div className="scroll est-conflict-scroll">
          <h2 className="t-h2">{t('songConflict.editTitle', { title: song.title })}</h2>
          {refused && (
            <div className="notice conflict est-conflict-refused" role="alert">
              <span className="est-conflict-refused-text">
                {t('songConflict.editRefused', { line: refused.line ?? '?' })}
              </span>
              {refused.line != null && (
                <Button className="btn" onPress={goToLine}>
                  {t('songConflict.editGoToLine', { line: refused.line })}
                </Button>
              )}
            </div>
          )}
          <MarkedTextEditor
            className="est-conflict-editor"
            initialText={editing.text}
            label={t('songConflict.editTextLabel')}
            onChange={(text) => setEditing({ text })}
            viewRef={editorView}
          />
          <div className="card pad est-conflict-markers">
            <span className="t-h3">{t('songConflict.markersTitle')}</span>
            <ul className="est-conflict-legend">
              <li><span className="t-mono">&lt;&lt;&lt;&lt;&lt;&lt;&lt;</span> {t('songConflict.markerStart')}</li>
              <li><span className="t-mono">=======</span> {author ? t('songConflict.markerMid', { author }) : t('songConflict.markerMid', { author: authorLabel })}</li>
              <li><span className="t-mono">&gt;&gt;&gt;&gt;&gt;&gt;&gt;</span> {author ? t('songConflict.markerEnd', { author }) : t('songConflict.markerEnd', { author: authorLabel })}</li>
            </ul>
            <p className="t-small">{t('songConflict.editHelp')}</p>
          </div>
          <div className="actions est-conflict-actions">
            <Button className="btn primary" onPress={saveEdit}>{t('songConflict.editSave')}</Button>
            <Button className="btn quiet" onPress={() => setEditing(null)}>{t('songConflict.editCancel')}</Button>
          </div>
        </div>
      </div>
    );
  }

  const { title, body } = describe(item, author, previewModel);
  return (
    <div className="screen est-conflict-screen">
      {appbar}
      <div className="scroll est-conflict-scroll">
        <div className="est-conflict-stepper">
          <span className="t-h3 est-conflict-step">{t('songConflict.stepOf', { n: effStep + 1, total: count })}</span>
          <Button
            className="btn icon"
            aria-label={t('songConflict.prev')}
            isDisabled={effStep === 0}
            onPress={() => setStep(Math.max(0, effStep - 1))}
          >
            ‹
          </Button>
          <Button
            className="btn icon"
            aria-label={t('songConflict.next')}
            isDisabled={effStep >= count - 1}
            onPress={() => setStep(Math.min(count - 1, effStep + 1))}
          >
            ›
          </Button>
        </div>

        <div className="est-conflict-head">
          <h2 className="t-h2">{title}</h2>
          <p className="t-small">{body}</p>
        </div>

        <div className="est-conflict-sides">
          <SideCard
            item={item}
            side="ours"
            heading={t('songConflict.yours')}
            voicing={{ chords: sideChords(item, 'ours', previewModel, instrument, entry), dialect, instrument }}
          />
          <SideCard
            item={item}
            side="theirs"
            heading={authorLabel}
            voicing={{ chords: sideChords(item, 'theirs', theirsModel, instrument, entry), dialect, instrument }}
          />
        </div>

        <div className="actions est-conflict-actions">
          <Button className="btn" onPress={keepMine}>{t('songConflict.keepMine')}</Button>
          <Button className="btn" onPress={takeTheirs}>{t('songConflict.takeTheirs')}</Button>
          {item?.kind === 'voicing' && author && (
            <Button className="btn" onPress={keepBoth}>{t('songConflict.keepBoth')}</Button>
          )}
          <Button className="btn" onPress={openEdit}>{t('songConflict.edit')}</Button>
        </div>

        <div className="notice est-conflict-notice">
          <span className="t-small">{t('songConflict.readsAsYours', { title: song.title })}</span>
        </div>

        <div className="card pad est-conflict-keepboth-song">
          <span className="t-h3">{t('songConflict.keepBothSongTitle')}</span>
          <p className="t-small">
            {author
              ? t('songConflict.keepBothSongBody', { author })
              : t('songConflict.keepBothSongBodyFallback')}
          </p>
          <div className="actions">
            <Button className="btn" onPress={keepBothSong}>{t('songConflict.keepBothSong')}</Button>
          </div>
        </div>

        {previewModel && (
          <Chart model={previewModel} markOf={markOf} label={t('songConflict.previewLabel', { title: song.title })} className="est-conflict-preview" />
        )}

        {settled.length > 0 && (
          <div className="card pad est-conflict-settled">
            <span className="t-h3">{t('songConflict.settledSoFar')}</span>
            <ul className="est-conflict-settledlist">
              {settled.map((s, i) => (
                <li key={i} className="t-small">{s.label}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

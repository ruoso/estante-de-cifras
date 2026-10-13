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
// (mockup README L24).

import { useEffect, useState } from 'react';
import { Button, TextArea, TextField, Label } from 'react-aria-components';
import { parse, resolveMarked } from 'cifra-md';
import { t } from '../i18n/index.js';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import Chart from '../chart/Chart.jsx';
import { chartRows } from '../chart/layout.js';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import { parseChord } from '../core/notation/parse.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';
import { instrumentInstance } from '../core/instrument.js';
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

// The reconstructed canonical text of a chart row, for matching the disputed
// lines (bars join with ` | `, as canonical form writes them).
function rowText(row) {
  if (row.type === 'bars') return row.measures.join(' | ');
  if (row.type === 'run' || row.type === 'words') return row.text;
  return null;
}

// The set of line addresses a conflicted song's reading view marks: the rows of
// ours whose text is one of the disputed lines (workflow 9 §Meeting one).
function markedAddresses(model, markedLines) {
  const want = new Set(markedLines ?? []);
  const keys = new Set();
  if (!model || want.size === 0) return keys;
  for (const row of chartRows(model)) {
    const text = rowText(row);
    if (text != null && want.has(text) && row.address) {
      const { section, part, line } = row.address;
      keys.add(`${section}:${part}:${line}`);
    }
  }
  return keys;
}

// One side of one conflict, in musical terms.
function SideCard({ item, side, heading }) {
  const value = side === 'ours' ? item.ours : item.theirs;
  let body;
  if (item.kind === 'chart' || item.kind === 'sections' || item.kind === 'block-notes') {
    const model = snippetModel(value, { fence: item.kind !== 'sections' });
    body = model ? (
      <Chart model={model} label={heading} />
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

// The heading and subline for a conflict, in musical terms.
function describe(item, author) {
  const theirs = author ?? null;
  if (item.kind === 'voicing') {
    const variation = item.variation ? item.variation : t('songConflict.mainVariation');
    return {
      title: t('songConflict.voicingTitle', { chord: item.chord ?? item.key ?? '' }),
      body: theirs
        ? t('songConflict.voicingBody', { tuning: item.tuning ?? '', variation, author: theirs })
        : t('songConflict.voicingBodyFallback', { tuning: item.tuning ?? '', variation }),
    };
  }
  if (item.kind === 'property') {
    return {
      title: t('songConflict.propertyTitle', { key: item.key ?? '' }),
      body: theirs ? t('songConflict.propertyBody', { author: theirs }) : t('songConflict.propertyBodyFallback'),
    };
  }
  if (item.kind === 'title') {
    return {
      title: t('songConflict.titleTitle'),
      body: theirs ? t('songConflict.titleBody', { author: theirs }) : t('songConflict.titleBodyFallback'),
    };
  }
  if (item.kind === 'chart' || item.kind === 'sections') {
    return {
      title: t('songConflict.chartTitleFallback'),
      body: theirs ? t('songConflict.chartBody', { author: theirs }) : t('songConflict.chartBodyFallback'),
    };
  }
  return {
    title: t('songConflict.genericTitle'),
    body: theirs ? t('songConflict.genericBody', { author: theirs }) : t('songConflict.genericBodyFallback'),
  };
}

export default function SongConflict({ store, bookId, path, onClose }) {
  const conflicts = useSlice(store, 'conflicts');
  const song = conflicts?.[bookId]?.songs?.find((s) => s.path === path) ?? null;
  const author = song?.author ?? null;
  const authorLabel = author ? t('songConflict.theirs', { author }) : t('songConflict.theirsFallback');

  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(null); // { text } | null
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
  const markOf = (a) => (markedKeys.has(`${a.section}:${a.part}:${a.line}`) ? 'conf' : null);

  if (!song) return null;
  const item = song.items[effStep] ?? null;

  const logSettled = (label) => setSettled((prev) => [...prev, { label }]);

  const keepMine = () => {
    logSettled(`${describe(item, author).title} · ${t('songConflict.settledMine')}`);
    store.send(command(CommandKind.RESOLVE_CONFLICT, { bookId, path, choice: 'mine', index: effStep }));
  };
  const takeTheirs = () => {
    logSettled(`${describe(item, author).title} · ${author ? t('songConflict.settledTheirs', { author }) : t('songConflict.theirsFallback')}`);
    store.send(command(CommandKind.RESOLVE_CONFLICT, { bookId, path, choice: 'theirs', index: effStep }));
  };
  const openEdit = () => {
    setRefused(null);
    setEditing({ text: song.marked ?? '' });
  };
  const saveEdit = () => {
    setRefused(null);
    logSettled(t('songConflict.settledEdit'));
    store.send(command(CommandKind.RESOLVE_CONFLICT, { bookId, path, choice: 'edit', text: editing.text }));
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
            <p className="notice conflict est-conflict-refused" role="alert">
              {t('songConflict.editRefused', { line: refused.line ?? '?' })}
            </p>
          )}
          <TextField className="field est-conflict-editfield" value={editing.text} onChange={(text) => setEditing({ text })}>
            <Label className="t-small">{t('songConflict.editTextLabel')}</Label>
            <TextArea
              className="input t-mono est-conflict-editor"
              rows={Math.max(8, editing.text.split('\n').length + 1)}
            />
          </TextField>
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

  const { title, body } = describe(item, author);
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
          <SideCard item={item} side="ours" heading={t('songConflict.yours')} />
          <SideCard item={item} side="theirs" heading={authorLabel} />
        </div>

        <div className="actions est-conflict-actions">
          <Button className="btn" onPress={keepMine}>{t('songConflict.keepMine')}</Button>
          <Button className="btn" onPress={takeTheirs}>{t('songConflict.takeTheirs')}</Button>
          <Button className="btn" onPress={openEdit}>{t('songConflict.edit')}</Button>
        </div>

        {item?.kind === 'voicing' && author && (
          <p className="t-small est-conflict-hint">{t('songConflict.keepBothHint', { author })}</p>
        )}

        <div className="notice est-conflict-notice">
          <span className="t-small">{t('songConflict.readsAsYours', { title: song.title })}</span>
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

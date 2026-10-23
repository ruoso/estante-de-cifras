// SongArrange — the arrange surface (songs.arrange, workflow 5; board W05). The
// mode entered from the reading view's `onArrange` seam: it turns the song's
// chords into things to tap, and choosing a shape writes it into the voicing
// block for the instrument's tuning and the variation in use. A full-screen
// surface AppShell mounts over reading (ephemeral view state, no router —
// mirroring `openSong`), with **Done** returning to reading; the working copy's
// unsaved edit stays (Decision 1).
//
// The arranging itself — the tappable chart, the picker, the shapes, variations
// and the enter-a-shape screen — is `useArrange` (arrange-surface.jsx), shared
// with the editor's preview. This screen is its chrome, and the place its
// choices land: each one is written to the working copy through the existing
// `WRITE` command (Decision 2). The Worker owns durability; the view never
// touches IndexedDB or git (DIRECTION §3.7). WRITE is silent, so the surface
// holds the current text in local state seeded from the `source` slice and
// re-renders from it.
//
// As drawn (songs.arrange_polish; board W05): the header's one chip is the
// instrument chip carrying the mode (*Arranging · Guitar*, Decision 1), opening
// the instruments as reading's does; *Enter a shape* is a screen of the mode —
// not a dialog over the picker — that replaces arrange's body under its own app
// bar (Decision 2), with the shared `ShapeBuilder` naming each note's part in the
// chord. Back and Cancel return to the picker as it was; *Choose this shape*
// writes as a listed candidate does and returns focus to the chord.

import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { songTitle } from './search-query.js';
import { useSlice } from '../worker/useStore.js';
import { command, CommandKind } from '../worker/protocol.js';
import InstrumentChip from '../instruments/InstrumentChip.jsx';
import { useArrange, BackIcon } from './arrange-surface.jsx';

export default function SongArrange({
  store,
  bookId,
  path,
  mode = 'narrow',
  onBack = () => {},
  onRunWizard = () => {},
  autoFocusWizard = false,
  onWizardFocusReturned = () => {},
}) {
  // When arrange re-mounts on the wizard's close (its destination lives over this
  // surface, which unmounts while the wizard is up — songs.wizard_ui), send focus
  // back to the Run-the-wizard button that opened it, a fresh node after the
  // re-mount. One-shot on mount; the shell clears the flag once honoured.
  const wizardButtonRef = useRef(null);
  useEffect(() => {
    if (autoFocusWizard && wizardButtonRef.current) {
      wizardButtonRef.current.focus();
      onWizardFocusReturned();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Bring the song in on mount (idempotent — reading already opened it): the text
  // to parse (OPEN_SOURCE) and the reading state for the variation in use
  // (OPEN_SONG). The Worker owns both; the view only asks.
  useEffect(() => {
    if (!bookId || !path) return;
    store.send(command(CommandKind.OPEN_SOURCE, { bookId, path }));
    store.send(command(CommandKind.OPEN_SONG, { bookId, path }));
  }, [store, bookId, path]);

  const sourceSlice = useSlice(store, 'source');
  const sourceText = sourceSlice?.[bookId]?.[path]?.text ?? '';
  // The working text the surface renders from. WRITE is silent, so after a choice
  // the local `edited` text is authoritative (Decision 2); until the first edit
  // it falls through to the `source` slice the Worker surfaced. The surface is
  // mounted for one song (AppShell re-mounts it per arrange session), so there is
  // no open-song change to reset across — no seeding effect, no setState churn.
  const [edited, setEdited] = useState(null);
  const text = edited ?? sourceText;

  const arrange = useArrange({
    store,
    bookId,
    path,
    text,
    mode,
    chartProps: { size: mode === 'wide' ? 20 : undefined },
    onText: (out) => {
      setEdited(out);
      store.send(command(CommandKind.WRITE, { bookId, path, text: out }));
    },
  });

  return (
    <div className={`screen arrange-screen${mode === 'wide' ? ' arrange-wide' : ''}`}>
      {arrange.enterScreen}

      {/* Arrange itself — kept mounted (hidden) while a shape is entered, so the
          chord that opened the picker is there to take focus back. */}
      <div className="arrange-mode" hidden={arrange.entering}>
        <div className="appbar arrange-chrome">
          {mode === 'wide' ? null : (
            <Button className="btn icon" aria-label={t('arrange.back')} onPress={onBack}>
              <BackIcon />
            </Button>
          )}
          <span className="title">{songTitle(arrange.model?.title, t('newSong.untitled'))}</span>
          {arrange.entry ? (
            <InstrumentChip
              store={store}
              onOpen={arrange.openInstruments}
              labelFor={(label) => t('arrange.modeChip', { instrument: label })}
            />
          ) : null}
          <Button className="btn primary" onPress={onBack}>
            {t('arrange.done')}
          </Button>
        </div>

        <div className="scroll arrange-scroll">
          <p className="t-small arrange-hint">{t('arrange.modeHint')}</p>
          {arrange.variationSelector}
          <div className="arrange-body">
            {arrange.chart}
            {arrange.shapesStrip}
          </div>
          {arrange.chooseEveryButton}
        </div>

        <div className="arrange-actionbar arrange-chrome">
          <Button ref={wizardButtonRef} className="btn grow" onPress={() => onRunWizard({ bookId, path })}>
            {t('arrange.runWizard')}
          </Button>
          <Button className="btn grow" onPress={arrange.openAddVariation}>
            {t('arrange.variations')}
          </Button>
        </div>
      </div>

      {arrange.overlays}
    </div>
  );
}

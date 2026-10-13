// sync-display.js — the one sync-word authority on the main thread (sync.states).
// It turns the engine's raw per-book sync FACTS (the `sync` reducer slice, keyed
// by bookId: `{ phase, savesWaiting, lastInStep, at }` — protocol.js SYNC) into
// the one WORD workflow 8 prescribes for the shelf. The engine ships facts, not
// presentation (sync.engine Decision 5; engine.md L366-371): this is that
// presentation, a pure derivation so every surface — the Books shelf here, and
// later the song-screen sync surfaces (sync.unsaved, sync.read_in_place,
// sync.lost_access) — renders the same atom without re-deriving the word.
//
// No React, no I/O, no sync state of its own — it reads the slice and the one
// `lastInStep` fact the Worker fills in (sync.states Decision "A structured state
// atom"; DIRECTION §3.7). The view maps the atom to a `<span class="badge …">`;
// the class only adds colour, the word carries the meaning (mockups README L26).
//
// Pins: workflow 8 "What the shelf says" L28-37, mockup W08 L239-242,
// theme.css L175-197.

// The reserved id of the one home book per installation (DIRECTION §3.2): it
// emits sync facts like any repository, but it is personal state, not a shelf
// book, so the shelf badges and the header mark exclude it (sync.states
// Constraints "Songbooks only"). Kept as a local literal — the Worker's
// home-book.js is never imported by the main thread (DIRECTION §3.7).
const HOME_BOOK_ID = 'home';

// A book is "out of step" when its phase is anything but in step (and present):
// the five states workflow 8 shows (L28-34). `in_step` and an absent/unknown
// phase render nothing.
// `taken_down` reads as gone on every shelf (workflow 10 L113: "shows as gone on
// every shelf") — only BookDetail distinguishes it (books.notice_surface).
const OUT_OF_STEP = new Set([
  'syncing',
  'saves_waiting',
  'offline',
  'needs_you',
  'gone',
  'taken_down',
]);

// The last-in-step instant (an ISO §3 instant) as the HH:MM a person reads
// ("offline since 09:40", mockup L241). Local wall-clock — the user's own time,
// not UTC. Returns null for an absent or unparseable instant so `offline` falls
// back to the plain word.
function timeOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * The sync display atom for one book's slice entry, or `null` when the book is
 * in step (render nothing — workflow 8 L28, mockup L48). The returned atom is
 * structured, never a finished string, so other surfaces reuse it:
 *   `{ kind, word, cls, dot, count?, since? }`
 * where `kind` is the phase, `word` is the translated text to show, `cls` is the
 * badge modifier class(es) the view appends after `badge` (theme.css L175-197),
 * `dot` is whether the badge carries the 7px attention dot, `count` the
 * saves-waiting number, and `since` the formatted time for `offline`.
 *
 * The mapping (acceptance 1; workflow 8 L28-34; mockup L239-242):
 *   in_step       → null                         (nothing)
 *   syncing       → "syncing"                     (.badge)
 *   saves_waiting → "{count} save(s) waiting…"     (.badge.unsaved, plural by count)
 *   offline       → "offline since {time}" / "offline" (.badge)
 *   needs_you     → "needs you"                    (.badge.conflict.dot)
 *   gone          → "no longer shared with you"    (.badge.conflict.dot)
 *   taken_down    → "no longer shared with you"    (.badge.conflict.dot, same as gone)
 *
 * @param {{ phase?: string, savesWaiting?: number, lastInStep?: string|null }|null|undefined} entry
 * @param {{ t: (key: string, params?: object) => string, now?: () => number }} options
 *   `t` is the i18n lookup; `now` is accepted for callers (and reserved for a
 *   future relative "since") — the shelf word itself needs only the time.
 * @returns {{ kind: string, word: string, cls: string, dot: boolean, count?: number, since?: string }|null}
 */
export function syncDisplayFor(entry, options = {}) {
  const { t } = options;
  const phase = entry?.phase;
  switch (phase) {
    case 'syncing':
      return { kind: 'syncing', word: t('books.syncing'), cls: '', dot: false };
    case 'saves_waiting': {
      const count = entry?.savesWaiting ?? 0;
      return {
        kind: 'saves_waiting',
        word: t('books.savesWaiting', { count }),
        cls: 'unsaved',
        dot: false,
        count,
      };
    }
    case 'offline': {
      const since = timeOf(entry?.lastInStep);
      return since
        ? { kind: 'offline', word: t('books.offline', { time: since }), cls: '', dot: false, since }
        : { kind: 'offline', word: t('books.offlineUnknown'), cls: '', dot: false };
    }
    case 'needs_you':
      return { kind: 'needs_you', word: t('books.needsYou'), cls: 'conflict dot', dot: true };
    case 'gone':
      return { kind: 'gone', word: t('books.noLongerShared'), cls: 'conflict dot', dot: true };
    case 'taken_down':
      // A book the service took down for a copyright notice reads the same word
      // and badge as gone on every shelf (workflow 10 L113; books.notice_surface
      // Decision; the reason surfaces only on BookDetail, not here).
      return {
        kind: 'taken_down',
        word: t('books.noLongerShared'),
        cls: 'conflict dot',
        dot: true,
      };
    // in_step, an absent entry, and any unknown phase: nothing on the shelf.
    default:
      return null;
  }
}

/**
 * Whether any SHELF book is out of step — the Books header's one quiet mark
 * (workflow 8 L36-37; mockup L29-35). The home book emits sync facts too but is
 * personal state, not a shelf book, so it is excluded (Constraints "Songbooks
 * only"). False when every shelf book is in step (or the slice is empty).
 *
 * @param {Record<string, { phase?: string }>} syncSlice the `sync` reducer slice
 * @returns {boolean}
 */
export function anyOutOfStep(syncSlice) {
  if (!syncSlice) return false;
  for (const [bookId, entry] of Object.entries(syncSlice)) {
    if (bookId === HOME_BOOK_ID) continue;
    if (OUT_OF_STEP.has(entry?.phase)) return true;
  }
  return false;
}

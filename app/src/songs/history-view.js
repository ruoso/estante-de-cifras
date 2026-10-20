// history-view.js — the pure assembly behind the history list (songs.history,
// workflow 6 §The list L11-37; mockup W06 phone screen 1 / computer side pane).
// `storage.history` ships raw version bytes + commit metadata and leaves the
// musical summary, the unsaved-first entry and the *you* marking to the UI
// (storage/history.md:100-106,354-362); this module does exactly that, over the
// `history`, `savePreview`, `preferences` slices the view already holds:
//
//   - it prepends the working copy's unsaved changes as the first row, when the
//     save preview reports any (the authoritative HEAD-vs-working signal, not
//     the live-only index flag — memory: reconcile-resets-unsaved-on-reload,
//     Decision 4);
//   - it pairs each committed version with the one before it and runs the
//     semantic `diff` to get that version's musical summary and change records
//     (the oldest diffs against an empty parse — its *New song: …* summary);
//   - a resolution merge (workflow 6 L28-32) is labelled *merged, with your
//     resolution* and diffed against its first parent;
//   - it marks a save as *you* by the device no-reply email or, before sign-in,
//     the stored author name, and formats *when*.
//
// Parsing and diffing in the view is the editor's pattern (SongEditor.jsx:246)
// and `storage.history`'s stated contract (Decision 1); cifra.md is framework-
// free and knows nothing of React, so importing it in a view module is fine.
//
// Pure: no React, no I/O. `t` is the i18n lookup; `locale` the BCP-47 tag for
// the date format. Musical tokens in the summary stay the library's neutral
// English one-liner (the save note's rule), while the detail card renders the
// `changes` records through the localized `renderChange`.

import { parse, diff } from 'cifra-md';

// The first line of a commit message — the note the save sheet wrote (workflow
// 4). Never the whole body, so a row stays one line.
function subjectOf(message) {
  return String(message ?? '').split('\n')[0].trim();
}

/**
 * Is this commit the user's own save? Recognised by the address — the Worker
 * marks `author.self` when the email is this device's account or local address,
 * which only it knows (account.commit_author Decision 7) — or else by the
 * display name the home book keeps (`identity.name`). Workflow 6 L16-19.
 */
export function isYou(author, identity = {}) {
  if (!author) return false;
  if (author.self === true) return true;
  if (identity.name && author.name && author.name === identity.name) return true;
  return false;
}

// A localized, human date(-and-time) for a commit's author instant (git stores
// it as whole seconds). Best-effort: a missing timestamp reads blank, and an
// environment without `Intl` falls back to the ISO date. `withTime` carries the
// list/detail "when"; the date alone names the restore dialog (W06 "20 Sep").
// The app's `en` is the boards' English, day before month on a 24-hour clock
// (W06 "20 Sep, 18:02"), so it formats as `en-GB`, as the book history does;
// every other locale formats as itself.
function formatWhen(timestamp, locale, withTime = true) {
  if (timestamp == null) return '';
  const date = new Date(timestamp * 1000);
  const options = withTime
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short' };
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, options).format(date);
  } catch {
    return date.toISOString();
  }
}

// The "before" text a version is compared against (workflow 6 §A version L47):
// its first parent for a resolution merge, otherwise the next older entry in the
// filtered list; the oldest version diffs against the empty string (all added).
export function beforeTextOf(entries, index, versions) {
  const entry = entries[index];
  if (entry.resolution) return versions[entry.parents?.[0]] ?? '';
  const older = entries[index + 1];
  return older ? versions[older.commit] ?? '' : '';
}

// The summary and change records for one version against its "before" text —
// computed only when the version's own text has been read back (READ_VERSION);
// until then the row carries no summary and the list shows the note alone.
function changeOf(thisText, beforeText) {
  if (thisText == null) return { summary: '', changes: [], hasText: false };
  const { changes, summary } = diff(parse(beforeText ?? ''), parse(thisText));
  return { summary, changes, hasText: true };
}

/**
 * Assemble the history rows for a song (workflow 6 §The list). The unsaved row
 * (when the preview has changes) is pinned first; the committed versions follow
 * newest-first in `entries` order, each carrying its localized note, who/when,
 * musical summary and the `diff` change records the detail card renders.
 *
 * @param {object} opts
 * @param {Array<object>} [opts.entries] SONG_LOG entries, newest first
 * @param {Record<string,string>} [opts.versions] commit → version text (VERSION cache)
 * @param {{ changes?: object[], summary?: string }|null} [opts.preview] the path's save preview
 * @param {{ name?: string }} [opts.identity] the *you* identity
 * @param {(key: string, params?: object) => string} opts.t the i18n lookup
 * @param {string} [opts.locale='en'] the BCP-47 tag for the date format
 * @returns {{ rows: object[] }}
 */
export function buildHistoryView({
  entries = [],
  versions = {},
  preview = null,
  identity = {},
  t,
  locale = 'en',
} = {}) {
  const rows = [];

  if (preview?.changes?.length) {
    rows.push({
      kind: 'unsaved',
      summary: preview.summary ?? '',
      changes: preview.changes ?? [],
    });
  }

  entries.forEach((entry, index) => {
    const thisText = versions[entry.commit];
    const { summary, changes, hasText } = changeOf(thisText, beforeTextOf(entries, index, versions));
    const you = isYou(entry.author, identity);
    rows.push({
      kind: 'version',
      commit: entry.commit,
      path: entry.path,
      parents: entry.parents ?? [],
      resolution: Boolean(entry.resolution),
      note: entry.resolution ? t('history.mergedWithResolution') : subjectOf(entry.message),
      who: you ? t('history.you') : entry.author?.name ?? '',
      isYou: you,
      when: formatWhen(entry.timestamp, locale),
      whenDate: formatWhen(entry.timestamp, locale, false),
      timestamp: entry.timestamp ?? null,
      summary,
      changes,
      hasText,
    });
  });

  return { rows };
}

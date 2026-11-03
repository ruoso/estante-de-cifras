// instrument.js — the reader's instrument and its default-shape table, chosen
// from the home book's files (reader.sync; docs/remarkable-reader.md §4
// `instrument(files)`, §4.1; docs/home-book-format.md §4.3–§4.6).
//
// Pure: the Go host reads the home book and hands its four files here as
// parsed JSON, so the choice of entry (the roster as the Worker surfaces it)
// and of table (whose fit is a fingerprint the music core computes) stays in
// the music core's own code rather than in a port (§4 "No port of the music
// core"). No logging.

import { isRegister } from '../worker/home-book-merge.js';
import { STANDARD_INSTRUMENT_ID, surfaceInstruments } from '../worker/instruments.js';
import { createShapeCache, isShapeTable } from '../core/shape-cache.js';
import { instrumentFor } from '../songs/song-sheet.js';
import { displayLabel } from '../instruments/instrument-helpers.js';

const isMap = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// A file as read: absent, or anything but a map, reads as `{}` (format §2.1).
const asMap = (value) => (isMap(value) ? value : {});

// The well-formed table held by a register, or null.
function tableOf(reg) {
  return isRegister(reg) && isShapeTable(reg.value) ? reg.value : null;
}

/**
 * The instrument to read with and the table §4.1 reads for it, and the
 * account's instruments to choose from.
 *
 * `files` is `{ instruments, preferences, shapes, defaultShapes }`, the home
 * book's instruments.json, preferences.json, shapes.json and
 * shapes-default-cache.json as parsed JSON (absent as `{}`). The entry is
 * `instrumentId`'s when it names one of the account's instruments — the one
 * chosen on the reader, which stays on the device (workflow 19 §Settings) —
 * else the one `surfaceInstruments` names in use, else the standard guitar.
 * `instruments` is every one the reader can choose, in the roster's order,
 * each `{ id, name, tuning }` named as the web app's roster names it, and
 * `inUseId` the account's own instrument in use (the standard guitar's id
 * when none). Its table:
 * the register under `salt` when it holds a well-formed table; else, of the
 * other salts not in `decommissioned`, the well-formed tables whose
 * fingerprint fits the instrument as it is now, the latest written (`at`)
 * first (format §4.6 "Which salt a reader uses"); else null.
 *
 * @param {{ instruments?: object, preferences?: object, shapes?: object, defaultShapes?: object }} files
 * @param {{ salt: string, decommissioned?: readonly string[], instrumentId?: string|null }} opts
 * @returns {{ entry: object, table: object|null, salt: string|null, instruments: object[], inUseId: string }}
 */
export function chooseInstrument(files, { salt, decommissioned = [], instrumentId = null } = {}) {
  const { instruments, preferences, shapes, defaultShapes } = asMap(files);
  // The roster without its tables: the table is chosen here, under the salt
  // given, and travels beside the entry rather than inside it.
  const surfaced = surfaceInstruments({
    instruments: asMap(instruments),
    preferences: asMap(preferences),
    shapes: asMap(shapes),
    defaultShapes: {},
  });
  const accountEntry =
    (surfaced.inUseId && surfaced.instruments.find((e) => e.id === surfaced.inUseId)) ||
    surfaced.standard ||
    surfaced.instruments.find((e) => e.id === STANDARD_INSTRUMENT_ID);
  // The choices: the account's instruments, and the standard guitar while it
  // is synthesized (not yet one of them).
  const roster = surfaced.standard ? [surfaced.standard, ...surfaced.instruments] : surfaced.instruments;
  const chosen = typeof instrumentId === 'string' && instrumentId ? roster.find((e) => e.id === instrumentId) : null;
  const entry = chosen || accountEntry;
  const listed = {
    instruments: roster.map((e) => ({ id: e.id, name: displayLabel(e), tuning: e.tuning })),
    inUseId: accountEntry.id,
  };
  const answer = (table, chosenSalt) => ({ entry, table, salt: chosenSalt, ...listed });

  const bySalt = asMap(asMap(asMap(defaultShapes)[entry.id])[entry.tuning]);

  const own = tableOf(bySalt[salt]);
  if (own) return answer(own, salt);

  const instrument = instrumentFor(entry);
  if (!instrument) return answer(null, null);
  const { fingerprint } = createShapeCache({ instrument });
  const candidates = [];
  for (const other of Object.keys(bySalt)) {
    if (other === salt || decommissioned.includes(other)) continue;
    const table = tableOf(bySalt[other]);
    if (!table || table.fingerprint !== fingerprint) continue;
    candidates.push({ salt: other, at: bySalt[other].at, table });
  }
  if (candidates.length === 0) return answer(null, null);
  // Latest `at` first (§3 instants compare as text); ties by salt, so the
  // choice never depends on the file's key order.
  candidates.sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? 1 : -1;
    return a.salt < b.salt ? -1 : a.salt > b.salt ? 1 : 0;
  });
  const [best] = candidates;
  return answer(best.table, best.salt);
}

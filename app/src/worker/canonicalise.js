// canonicalise.js — the canonicalise-one-file step of a save
// (storage.working_copy). "Canonical form over preserving content" is a
// standing rule (spec §8.1, §10.9; workflow 14 L50-52: "The app canonicalizes
// every song and setlist when saving"). Each file in a save is run through the
// cifra.md writer, and the canonical text is what the save writes back and
// commits; "a marked text is never saved or pushed" (spec §11.12.3).
//
// It dispatches by file extension: a `*.setlist.md` through the setlist
// reader/writer, every other (song) file through the §1-§8 reader/writer.
//
// The writer is the single authority on canonicality and marker lines
// (Decision 4): the song writer throws `MarkedTextError`, and the marker-line
// primitive `markerLines` (spec §11.12.3) is the format's own scan — this module
// never re-implements the §11.12.3 rule. Same library, same answer, in the app
// and in the service's pre-receive hook (DIRECTION §3.6).
//
// Pure: it imports only the cifra.md package, does no I/O, logs nothing (no song
// text — standing rule). Plain ESM, Worker-only.

import {
  write,
  parse,
  writeSetlist,
  parseSetlist,
  markerLines,
  prepare,
  MarkedTextError,
} from 'cifra-md';

// A setlist file (workflow 14 L24-36). Anything else is a song (`*.cifra.md`).
const SETLIST_SUFFIX = '.setlist.md';

/**
 * The refusal for the first marker line of a canonical text, shaped like the
 * one the song writer's `MarkedTextError` yields. The setlist writer does not
 * raise it itself, so the save path checks its output with the format's own
 * `markerLines` primitive (§11.12.3) — not a re-implemented scan.
 *
 * @param {string} text
 * @returns {{ ok: false, reason: 'marked', line: number, marker: string }|null}
 */
function firstMarkerRefusal(text) {
  const found = markerLines(text);
  if (found.length === 0) return null;
  const line = found[0];
  return { ok: false, reason: 'marked', line, marker: prepare(text)[line - 1] };
}

/**
 * Canonicalise one working-copy file. `input` is the file's bytes (a
 * `Uint8Array`) or its text (a string) — the reader takes either and validates
 * UTF-8 itself.
 *
 * Returns `{ ok: true, text }` with the canonical text to write back and commit,
 * or `{ ok: false, reason, marker?, line? }` when the file cannot be saved:
 *   - `reason: 'marked'` — the file holds a conflict marker line (a marked
 *     text, §11.12.3); `line`/`marker` point at the first one.
 *   - `reason: 'unreadable'` — the reader cannot read the file at all (invalid
 *     UTF-8, §9.2; the permissive reader turns malformed music into diagnostics
 *     rather than a throw, so this is the hard-error case).
 *
 * @param {string} path  the file's path within the book (dispatches on its extension)
 * @param {Uint8Array|string} input
 * @returns {{ ok: true, text: string }
 *   | { ok: false, reason: 'marked', line: number, marker: string }
 *   | { ok: false, reason: 'unreadable', message: string }}
 */
export function canonicaliseFile(path, input) {
  try {
    if (path.endsWith(SETLIST_SUFFIX)) {
      // The setlist writer canonicalises (§10.9) but does not raise on a marked
      // text, so gate its output on the format's marker-line primitive.
      const text = writeSetlist(parseSetlist(input));
      return firstMarkerRefusal(text) ?? { ok: true, text };
    }
    // A song: the writer is `serialize ∘ canonical` with the §8.1 marked-text
    // refusal, so a conflict marker surfaces here as `MarkedTextError`.
    const text = write(parse(input));
    return { ok: true, text };
  } catch (err) {
    if (err instanceof MarkedTextError) {
      return { ok: false, reason: 'marked', line: err.line, marker: err.text };
    }
    // Not a marked text: the reader could not read the bytes at all (e.g.
    // invalid UTF-8). Surface it as a refusal, not a throw — the save path turns
    // it into a SAVE_REFUSED event, never a log line.
    return { ok: false, reason: 'unreadable', message: String(err?.message ?? err) };
  }
}

# songs.history_24h — Song history tells the time as the rest of the app does

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) — `task history_24h` (line 189), in
milestone `m3_service` (`tasks/99-milestones.tji:32`).

## Effort estimate

0.25d.

## Repository

The app only: `app/src/songs/history-view.js` and its unit test
`app/src/songs/history-view.test.js`. Nothing under `cifra.md/`, `service/` or
`api/`. No design delta.

## Inherited dependencies

- `songs.history` — **settled** (complete): `buildHistoryView` and its private
  `formatWhen`, which give each history row its `when` (list and detail card)
  and `whenDate` (the restore dialog's title).
- Group dependencies of `songs` (`shell.layout`, `shell.chart`,
  `foundation.e2e_web`) — all complete; none is needed by the one unit test
  this task lands with.

## What this task is

The song history formats a version's time with the bare app locale
(`currentLocale()` → `en`) and no other hint, so English reads the US way —
*Oct 2, 04:59 PM* — while every other date the app shows in English maps `en`
to `en-GB` and reads day-first with a 24-hour clock (*2 Oct, 16:59*). Make
`formatWhen` use the same mapping, so the history's *when* and the restore
dialog's date read as the rest of the app and as the W06 board draws them.

## Why it needs to be done

Usability review 2026-10-19 (Claude in Chrome on the deployed app, verified
against the code): the song history showed *16:59 PM*. The *PM* was not
reproduced (Node's ICU gives *04:59 PM* for `en` with these options; the
reviewer's browser mixed its own hour-cycle preference in), but the cause of
the two clock styles is in the code: `history-view.js` is the one date
formatter on a time-bearing screen that skips the `en → en-GB` mapping. No
downstream task depends on it; it is an M3 polish fix.

## Inputs / context

- `app/src/songs/history-view.js:50-65` — `formatWhen(timestamp, locale,
  withTime)`: `new Intl.DateTimeFormat(locale, { day: 'numeric', month:
  'short', hour: '2-digit', minute: '2-digit' })`, and the date-only form for
  `whenDate`. Called at `history-view.js:132-133` from `buildHistoryView`
  (signature `history-view.js:101-108`, `locale` has no default).
- `app/src/songs/SongHistory.jsx:275` — passes `locale: currentLocale()`;
  rows render `row.when` at `SongHistory.jsx:112` and `:508`, `whenDate` at
  `:469` (the restore dialog).
- The mapping as the app already writes it, four times:
  - `app/src/books/book-display.js:254-273` (`broughtInOn`, with the comment:
    "The app's `en` is the boards' English, which writes the day before the
    month … so it is formatted as `en-GB`; every other locale formats as
    itself"), falling back to `en-GB` in the `catch`;
  - `app/src/files/BookHistory.jsx:36-49` (`fullDateLabel`, W14: *2 October
    2026, 21:14* — the other history screen, with a time);
  - `app/src/books/people.js:16-26` (`shortDate`, `locale = 'en'` default);
  - `app/src/music/shape-readout.js:105` (`listOf`).
- `app/src/i18n/index.js:26-31` — the four locales: `en`, `pt-BR`, `es-419`,
  `it`.
- The board: `docs/mockups/W06-history.dc.html:115` *Ana · 20 Sep, 18:02*,
  `:256` *you · 28 Sep, 22:40*, `:137` *Restore the version of 20 Sep?* —
  day-first, 24-hour, no AM/PM.
- `tasks/refinements/songs/history.md` — the predecessor; it left the date
  format to `Intl` without deciding the English variant.

What the options give today (Node ICU, 2 Oct 16:59 local):

| locale | today | after |
|---|---|---|
| `en` | *Oct 2, 04:59 PM* | *2 Oct, 16:59* (`en-GB`) |
| `pt-BR` | *2 de out., 16:59* | unchanged |
| `it` | *2 ott, 16:59* | unchanged |
| `es-419` | *2 oct, 04:59 p.m.* | unchanged — formats as itself, as in `BookHistory.jsx` |

## Constraints / requirements

1. `formatWhen` formats with `locale === 'en' ? 'en-GB' : locale`, exactly the
   expression the four siblings use, for both `when` and `whenDate`.
2. The fallback when `Intl` throws stays as it is (the ISO string): the
   function's existing contract, unrelated to the bug.
3. `buildHistoryView`'s `locale` defaults to `'en'` (as `people.js` `shortDate`
   does), so a caller that omits it gets the app's English, not the test
   runner's or browser's default locale.
4. No other formatter changes: `BookHistory.jsx`'s short row date
   (`dateLabel`, line 21) and `AccountScreen.jsx:356-366` also use the bare
   locale, but the first has no time and the second is the account screen's
   own `dateStyle` form — out of this task's scope (the note names the song
   history).
5. Pure module: no React, no I/O (the file's header contract).

## Acceptance criteria

### Behavior delivered

- In English the song history's list rows and open version read *who · 2 Oct,
  16:59* — day first, 24-hour, no *AM*/*PM*; the restore dialog asks about
  *2 Oct*.
- Portuguese, Spanish and Italian read as before (each as itself), matching
  the book history (`BookHistory.jsx`).

### Tests the task lands with, by level

- **unit** — `app/src/songs/history-view.test.js`, a new `describe('when')`
  block. The timestamp is built with the local-time constructor
  (`new Date(2026, 9, 2, 16, 59).getTime() / 1000`) so the hour is 16:59 in
  any `TZ` the runner has, and October avoids ICU's *Sep*/*Sept* variance:
  - `en`: `when` contains `16:59`, matches neither `/AM|PM/i`, and the day
    precedes the month (`/^2 Oct/`); `whenDate` is `2 Oct` (W06 board L115,
    L137; the `book-display.js:254` rule).
  - `en` omitted (no `locale` passed): same as `en` (Constraint 3).
  - `pt-BR` and `it`: `when` contains `16:59` and no `AM`/`PM`.
  - `es-419`: `when` equals
    `new Intl.DateTimeFormat('es-419', options).format(date)` — formatted as
    itself, as `BookHistory.jsx:41` does (Decision 2). It is the one locale
    whose expected string comes from `Intl`, because its 12-hour *p. m.*
    spelling varies across ICU versions.
  - The existing `buildHistoryView` cases keep passing.

No behavior or e2e-web level: the note's `Tests:` clause names unit only, and
the change is one argument to `Intl.DateTimeFormat` inside a pure module whose
output the existing `SongHistory` behavior and e2e tests already render
(Decision 3).

## Decisions

1. **Inline the mapping, not a shared helper.** The app already writes
   `locale === 'en' ? 'en-GB' : locale` in four places; a fifth inline copy
   keeps this a one-file fix. Extracting a `dateLocale()` into
   `app/src/i18n/index.js` and rewriting the four siblings would be a
   refactor across books, files and music with their tests, out of
   proportion to a 0.25d fix and to the note ("Use the same mapping").
2. **No explicit `hourCycle: 'h23'`.** Forcing 24-hour would make `es-419`
   read *16:59* here but *04:59 p. m.* in the book history — a new
   inconsistency, where the task is consistency. The app's convention is
   "English is `en-GB`, every other locale is itself"; the history follows
   it. The unreproduced *16:59 PM* came from the reviewer's browser mixing a
   24-hour preference into `en`'s 12-hour pattern; `en-GB` has no day period
   to mix, so it cannot recur in English.
3. **Unit only.** A behavior test of `SongHistory` would assert the same
   string through a component; an e2e-web case could not pin the hour without
   controlling the commit time and the browser's clock, and the browser's
   hour-cycle preference is what produced the unreproduced *PM*. The pure
   function is where the format is decided, and it is pinned there per
   locale.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- `app/src/songs/history-view.js`: `formatWhen` formats with `locale === 'en' ? 'en-GB' : locale` for both `when` and `whenDate`, so English reads *2 Oct, 16:59* and the restore dialog asks about *2 Oct*; the ISO-string fallback is unchanged.
- `buildHistoryView`'s `locale` defaults to `'en'`.
- pt-BR, it and es-419 read as before (each as itself).
- `app/src/songs/history-view.test.js`: new `describe('when')` block (unit) — en, omitted locale, pt-BR, it, es-419.
- `e2e/web/lib/journeys-files.js`: `deleteOpenFile` waits until the file has really closed (fixes a phone-layout race in `file-view-create.spec.js`, unrelated to the change).
- Tech debt: none.

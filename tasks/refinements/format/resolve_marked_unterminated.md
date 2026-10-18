# format.resolve_marked_unterminated — resolveMarked stops on an unterminated region

## TaskJuggler entry

[`tasks/05-format.tji`](../../05-format.tji) — `task resolve_marked_unterminated
"resolveMarked stops on an unterminated region"` (in `format`). Milestone: the
late polish milestone in `tasks/99-milestones.tji` (line 44) already lists it.

## Effort estimate

0.5d.

## Repository

Both, in one commit:

- `cifra.md/spec/11-merge.md` — the design delta (§11.12.4, already written
  alongside this refinement).
- `cifra.md/js/src/merge.js`, `cifra.md/js/test/merge.test.js` — the fix and
  its unit tests.
- `cifra.md/go/merge.go`, `cifra.md/go/merge_test.go` — the same refusal in Go,
  and its unit test.
- `app/src/songs/conflict-text.js` — the app's workaround drops out (Decision 5).

## Inherited dependencies

- `format.merge` — **settled** (complete). It defined the marked text
  (§11.12.2), marker lines (§11.12.3) and resolving (§11.12.4), and landed
  `resolveMarked` / `ResolveMarked` in both implementations.
- Source of the debt: `sync.conflicts_row_summary` (complete) —
  `tasks/refinements/sync/conflicts_row_summary.md` Status, last bullet: "cifra.md/js
  `resolveMarked` never returns on an unterminated `<<<<<<< ours` region".

## What this task is

`resolveMarked(marked, side)` replaces every region of a marked text by one
side's lines. When a `<<<<<<< ours` line has no `=======` after it, or the
`=======` has no `>>>>>>> theirs` after it, the JavaScript walk never returns,
and the Go walk panics. This task makes both refuse such a text with a typed
error naming the line of the open region's `<<<<<<< ours`. It also writes into
§11.12.4 that a resolver must refuse an open region. With that in place, the
app's guard in front of `resolveMarked` is no longer needed and is removed.

## Why it needs to be done

- A library function that hangs on bad input is a defect whatever the caller
  does. In the app it would freeze the Worker or the main thread. The app
  now guards one call site (`oursModel`), but `app/src/worker/conflicts.js:519`
  and `:576` call `resolveMarked` unguarded. Today those only see marked texts the
  merger wrote, but nothing in the library keeps that true.
- The three implementations disagree today: the JS walk loops, Go panics, and
  the reference test helper raises `ValueError`. The rule is that a
  disagreement is settled in the spec, never by copying one implementation,
  so the spec gets the sentence and both implementations are held to it.

## Inputs / context

- **Spec §11.12.2** (`cifra.md/spec/11-merge.md:978`) — a region is
  `<<<<<<< ours`, ours's lines, `=======`, theirs's lines, `>>>>>>> theirs`.
- **Spec §11.12.3** (`:1035`) — marker lines; a writer refuses a marked text
  and points at the first marker line. The same "refuse and point at a line"
  pattern is used here.
- **Spec §11.12.4** (`:1058`) — resolving. **Design delta:** a new paragraph
  after the first one (`:1073`–`:1079`) defines an **open** region and says a
  resolver by one side MUST refuse a text holding one, point at its
  `<<<<<<< ours` line, and MUST NOT take the rest of the text as a side or
  leave the region in place.
- **JS** `cifra.md/js/src/merge.js:597` `regionsOf` and `:615` `resolveMarked`.
  `lines.indexOf(MID, k)` returns `-1` and `lines.indexOf(END, -1)` returns
  `-1`, so `k = e + 1 = 0` and the loop restarts forever. `MID`/`END` constants
  are at `:574`–`:575`. It is exported from `cifra.md/js/src/index.js:118`.
- **JS error precedent** `cifra.md/js/src/write.js:393` `MarkedTextError`
  (`name`, `line`, `text`, a message naming the line).
- **Go** `cifra.md/go/merge.go:1058` `markedRegions` and `:1084`
  `ResolveMarked(marked []byte, side string) ([]byte, error)`. It already
  returns an `error` and always returns `nil`. On an open region,
  `indexOf(markMid, k)` gives `-1` and the next `lines[-1]` / slice panics.
  The constants are at `:970`–`:971`.
- **Go test home** `cifra.md/go/merge_test.go:318` `TestResolveMarked`.
- **JS test home** `cifra.md/js/test/merge.test.js:249` (`§11.4 marked
  inputs`). A new `describe("§11.12.4 resolving", …)` goes beside it.
- **Reference** `cifra.md/reference/tests/merge_props.py:7`–`:37`: `regions` and
  `resolve` are a test helper only (the reference library has no resolver).
  `list.index` already raises `ValueError` on an open region.
- **Corpus harnesses** `cifra.md/js/test/corpus/harness.js:470` and
  `cifra.md/go/internal/corpus/harness.go:503` resolve the merger's marked
  outputs. Those outputs are always well formed, so they are unaffected.
- **App** `app/src/songs/conflict-text.js:159`–`:194`: `wellFormedRegions` and
  its use in `oursModel`, wrapped in `try/catch`.
  `app/src/songs/conflict-text.test.js:172`–`:177` pins that
  `conflictSummary` falls back on `'<<<<<<< ours\nDb7 | C7'`. The app consumes
  the package as `"cifra-md": "file:../cifra.md/js"` (`app/package.json:23`).

## Constraints / requirements

- **Implementations agree because they are checked.** JS and Go are each
  written against the new §11.12.4 paragraph. No code is shared or ported.
- The fix lives in the walk (`regionsOf` / `markedRegions`). It runs once over
  the lines and then fails. Do not add a pre-scan pass.
- A well-formed marked text resolves **byte for byte as before**. The
  `resolving by one side gives a document` properties
  (`cifra.md/js/test/merge_properties.test.js:131`), the Go `TestResolveMarked`
  and both corpus harnesses stay green and unedited.
- Out of scope, and unchanged: a stray `=======` or `>>>>>>> theirs` outside
  any region is passed through as an ordinary line, as it is today. The
  resolved text then still holds a marker line, and the writer refuses it per
  §11.12.3. A second `<<<<<<< ours` before the `=======` is taken as an ours
  line, as it is today.
- Line numbers are 1-based over the `\n`-split lines that `resolveMarked`
  already walks. This matches `conflict.line` in §11.12.5.
- Test fixtures use made-up chord lines (e.g. `C | G`), never someone else's song.

## Acceptance criteria

Behavior:

1. JS: `resolveMarked` throws `OpenRegionError` (exported from
   `cifra.md/js/src/merge.js` and from `cifra.md/js/src/index.js`) when a
   `<<<<<<< ours` line has no later `=======`, or that `=======` has no later
   `>>>>>>> theirs`. The error has `name === "OpenRegionError"`, a
   `line` (1-based, the open region's `<<<<<<< ours`), and a message like
   `line 3 opens a conflict region that is never closed`. It never loops.
2. Go: `ResolveMarked` returns `nil` and a non-nil `*OpenRegionError{Line int}`
   (exported, with an `Error()` string of the same shape) in the same cases,
   and never panics.
3. The first open region decides: in a text with a closed region followed by an
   open one, the error names the second region's opener line.
4. `app/src/songs/conflict-text.js`: `wellFormedRegions` and its call are
   deleted. `oursModel` relies on its existing `try/catch` around
   `parse(resolveMarked(…))`, and the comment at `:160`–`:162` goes with it.

Tests:

- **unit (js)** `cifra.md/js/test/merge.test.js`, new `describe("§11.12.4
  resolving")`, pinning the new §11.12.4 paragraph:
  - `an open region is refused`: `test.each` over (a) `<<<<<<< ours` with no
    `=======`, (b) `=======` present but no `>>>>>>> theirs`, (c) a closed
    region followed by an open one, each for both `"ours"` and `"theirs"`. Each
    expects an `OpenRegionError` with the right `line`. A hang would fail on
    Vitest's timeout.
  - `a closed region still resolves`: a hand-written two-region text resolves
    to the expected ours and theirs strings (it guards against the fix changing
    the happy path).
- **unit (go)** `cifra.md/go/merge_test.go`, new `TestResolveMarkedOpenRegion`,
  with the same three cases on both sides. It asserts `errors.As` to
  `*OpenRegionError` with the right `Line` and no panic. `TestResolveMarked`
  stays as is.
- **unit (app)** `app/src/songs/conflict-text.test.js:172` (`conflictSummary
  falls back without throwing when marked is absent or unreadable`) stays
  unedited and green. It now passes through `OpenRegionError` caught in
  `oursModel` instead of the deleted guard, so it pins Behavior 4.
- **corpus**: no new entries (Decision 3). `cifra.md/js/test/corpus.test.js`
  and `go test ./internal/corpus/...` run unchanged and green. They show that
  every marked output in `corpus/merge/` still resolves.
- **pytest**: none (Decision 3). `reference/tests/test_merge_properties.py` and
  `test_merge_corpus.py` stay green.

## Decisions

1. **Refuse, don't guess.** The other option was "stop": take the rest of
   the text as the ours side, or leave the region in place. Taking the rest
   invents a side the text never gave. Leaving the region in place returns a
   still-marked text from a function whose contract is "a text with no region
   left". Refusing matches how §11.12.3 treats a marked text at the writer
   (refuse, point at the line), and gives the caller the line to show.
2. **A spec sentence, not just a bug fix.** §11.12.4 did not say what an open
   region is. The three implementations already behave differently (a loop, a
   panic, a `ValueError`), and the project settles disagreements in the spec.
   The paragraph is small and normative (MUST refuse, MUST point at the line).
3. **No corpus entry and no reference change.** The merge corpus pins
   `merge(base, ours, theirs)` outputs. A merger never writes an open region,
   so there is no input triple that produces one, and no corpus file shape
   for "a resolver refuses this text". The reference library has no public
   resolver. Its test helper `merge_props.resolve` already terminates by
   raising, which agrees with the new rule. So the note's "pytest if they
   share the behavior" resolves to none. Unit tests in JS and Go are the level
   that can pin it.
4. **A typed error in each language** (`OpenRegionError` with `line`/`Line`),
   following `MarkedTextError`. A bare `Error` was rejected because callers
   (the app's refusal path) want the line without parsing a message. Go
   already returns an `error`, so the signature does not change.
5. **The app's guard goes in this task.** It was the workaround for this
   exact defect. The app links the package from the tree, so the fix reaches
   it in the same commit, and keeping the guard would leave two definitions of
   "well-formed region". The existing app test pins the behavior that stays
   (fallback without throwing). The worker call sites (`conflicts.js:519`,
   `:576`) need no change: they now throw instead of hanging on an input they
   never receive.
6. **The app's `resolveRegionByOrdinal`** (`app/src/worker/conflicts.js:52`)
   has the same `indexOf` pattern, but it is not touched or registered. It only
   ever sees `f.marked` as the merger wrote it, narrowed by its own earlier
   region resolutions, which never open a region. The only hand-edited
   text, the source editor's `edit` choice (`conflicts.js:543`), never goes
   through it. That path canonicalises the edited text and refuses any marker
   line left (§11.12.3), then settles the file. So no user can reach it.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-18.

- cifra.md/spec/11-merge.md: §11.12.4 now defines an open region and says a resolver MUST refuse it, pointing at its `<<<<<<< ours` line.
- cifra.md/js/src/merge.js, cifra.md/js/src/index.js: `resolveMarked` throws the exported `OpenRegionError` (`line`, 1-based) from inside the existing walk, instead of looping forever.
- cifra.md/go/merge.go: `ResolveMarked` returns `*OpenRegionError{Line}` instead of panicking.
- Tests: cifra.md/js/test/merge.test.js (`§11.12.4 resolving`: an open region is refused, a closed region still resolves); cifra.md/go/merge_test.go (`TestResolveMarkedOpenRegion`).
- app/src/songs/conflict-text.js: `wellFormedRegions` and its comment removed; `oursModel` relies on its `try/catch`. conflict-text.test.js is unedited and green.
- No corpus entries and no pytest (Decision 3); no tech-debt follow-up.

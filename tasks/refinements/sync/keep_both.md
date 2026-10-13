# sync.keep_both — Keep-both conflict resolution

## TaskJuggler

[`sync.keep_both`](../../45-sync.tji) — `tasks/45-sync.tji:42`
(`task keep_both` inside `task sync`).

## Effort estimate

2d (as the `.tji` carries). Two resolution affordances on top of the
conflict machinery `sync.conflicts` already shipped, plus their behavior and
e2e-web tests and a small workflow-9 delta. No new storage, no new git
plumbing, no format change.

## Repository

**estante-de-cifras**, the app only: `app/src/` (the Web Worker's merge
session and the conflict resolver UI) and `e2e/web/`. No cifra.md change —
see Decision 1.

## Inherited dependencies

- **`sync.conflicts`** (`!conflicts`) — **settled** (Done 2026-10-13,
  `tasks/refinements/sync/conflicts.md`). It built the whole merge-session
  subsystem this task extends: the Worker's `conflicts.js` resolver, the
  `conflict-model.js` musical-terms mapper, the `OPEN_CONFLICTS` /
  `RESOLVE_CONFLICT` / `COMMIT_MERGE` / `ABANDON_MERGE` protocol, the
  `SongConflict.jsx` per-song resolver and the `BookConflicts.jsx` paused
  panel, and the two-parent merge commit gated on canonicality. Its
  Acceptance criteria explicitly deferred the two keep-both affordances to
  this task; today they exist only as a textual hint (see Inputs).
- Through `sync.conflicts`, transitively **settled**: `sync.engine`,
  `foundation.e2e_web`, `books.add_by_link` (all `complete 100`). Through
  the parent `task sync`: `storage.working_copy`, `cifra_js.merge`,
  `foundation.e2e_api`. `books.online` is also `complete 100`. Every
  prerequisite that drives the named tests (a hosted shared book, a second
  writer, the e2e-web harness, the local git remote + fake-IndexedDB harness)
  is in place — see Acceptance criteria §Test drivers.

(none pending.)

## What this task is

When a merge genuinely collides, `sync.conflicts` lets the user settle each
conflict with **keep mine**, **take theirs**, **edit** (git markers), or
**abandon**. "Keep both" — keeping *both* sides rather than choosing one —
is listed in workflow 9 under **§Later**, achievable only by hand through
*edit* today. This task promotes it to two first-class resolutions:

1. **Keep both, for a voicing.** On a `voicing` conflict (two shapes for one
   chord in one tuning/variation/key), keep-both keeps the user's shape in
   its block and writes the other person's shape into **a new variation
   named for them** (*Ana's*), so neither complete arrangement is lost.
2. **Keep both, for a song.** For a song whose conflicts the user would
   rather not settle one by one, keep-both keeps the user's version at
   `<name>.cifra.md` and writes the other person's full incoming version
   **beside it** as a sibling `<name>-ana.cifra.md` — "for when two people
   have really made two songs."

Both are new `RESOLVE_CONFLICT` choices applied by the Worker under the book
lock, landing in the same two-parent merge commit the other resolutions use,
canonical and pushed.

## Why it needs to be done

`sync.conflicts` shipped keep mine / take theirs / edit / abandon and left
keep-both as registered debt (its Deferred bullet names this task). Workflow
9 §Later promises it; the resolver even renders a hint today —
`SongConflict.jsx:315-317`, copy at `app/src/i18n/locales/en.js:657-658`:
*"To keep both shapes, choose Edit and put {author}'s in a variation of its
own."* — telling the user to do by hand exactly what this task automates.
Until it lands, preserving both a voicing and a song means hand-editing git
markers, which defeats the musical-terms resolver for the one case where
"neither is wrong" is the honest answer. It is a leaf (no task depends on
it); it completes workflow 9 and milestone `m4_together`.

## Inputs / context

**Governing documents**

- **Workflow 9, Conflicts** — `docs/workflows/09-conflicts.md`:
  - §What can conflict, L13-24 — the `voicing` kind (both chose a shape for
    the same key/tuning/variation differently, L17-18) vs the whole-file
    kind (L22-23).
  - §Settling one, L47-70 — the per-conflict resolution list (keep mine /
    take theirs / edit, L53-60) and the whole-book commit (L69-70). This is
    where voicing keep-both joins, per the design delta.
  - §Later, L80-87 — the two keep-both bullets this task promotes
    (voicing → *"a new variation named for them (Ana's), so neither
    arrangement is lost (workflow 5)"*, L82-83; song → *"written beside it
    as `<name>-ana.cifra.md`, for when two people have really made two
    songs"*, L84-85; *"Both can be done by hand with edit in the meantime"*,
    L87).
- **Workflow 5** (arrange / variations) — the variation mechanism workflow 9
  §Later points at for the voicing case.
- **DIRECTION** — `docs/DIRECTION.md`: §2.2 Merging (L76-101 — the
  cifra-aware merge, voicings merge by tuning/variation/key, a conflict is
  shown in musical terms, a marked text is never canonical), §3.1 Sync
  (L127-134), §3.7 The app (L409-449 — the Worker owns git/working
  copy/index; the view is the only React layer; status by a word).
- **Mockup** — `docs/mockups/W09-conflicts.dc.html`, the voicing keep-both
  hint region (~L95-138, *"put Ana's in a variation of its own"*) — the
  drawing to refresh so it shows the action, not the hint.
- **cifra.md spec** (read, not changed — see Decision 1):
  `/home/ruoso/devel/cifra.md/spec/7-voicings.md` §7.3 Variations (L81-105 —
  a variation is a voicing block for the same tuning under a different
  label; the default's name is the empty string; variations do not inherit);
  `spec/8-normalisation.md` §8.1 (L8-54 — a saved document is always
  canonical and may hold no marker line);
  `spec/11-merge.md` §11.12.1 (L925-977 — the conflict model, incl. the
  `voicing` and `variation` kinds) and §11 Open questions "Keep both"
  (L2437-2440 — keep-both-as-a-new-variation "is a resolution an application
  may want (Estante's workflow 9 lists it for later)… It would be defined
  here, so that two applications keep both alike").

**Source seams this task extends** (all under `app/src/`)

- **`worker/conflicts.js`** — the merge session. `resolve({ bookId, path,
  choice, text, index })` (`:363`) is the applier; `choice` is today
  `'mine'|'theirs'|'edit'|'keep'|'delete'` (anything not `'theirs'` maps to
  the ours side, `:406`). `writeWorking`/`removeWorking` (`:169-185`) stage
  into the working copy via isomorphic-git `add`/`remove`; `settle(bookId)`
  (`:330`) gates every staged file through `firstMarkerRefusal` then the
  two-parent `commit` (`:342-349`) and `push`. `open(bookId)` (`:188`) holds
  each conflicted file's recomputed `Outcome` in the in-memory `sessions`
  Map. Imports `resolveMarked`, `parse` from `cifra-md`.
- **`worker/conflict-model.js`** — the musical-terms mapper. A `voicing`
  item (`:47-49`) carries `tuning`, `variation`, `key`, a derived `chord`,
  and each side's fret shorthand (`ours`/`theirs`). `FILE_KINDS`
  (`:22`, comment `:20-21`) marks the whole-file kinds that have no region —
  the seam the song-level keep-both sits beside (but does **not** extend; see
  Decision 3).
- **`worker/protocol.js`** — `CommandKind.RESOLVE_CONFLICT` (`:313`, payload
  `{ bookId, path, choice, text?, author }`, `:300-303`); the `CONFLICTS`
  event payload (`:522-540`).
- **`core/voicing-plan/apply.js`** — **`planIntoNewVariation(doc,
  planResult, { tuning, name, copyFrom })`** (`:93`): writes a voicing plan
  into a **new named variation block**, leaving the in-use one untouched.
  This is the exact mechanism the current hint describes by hand, and what
  voicing keep-both calls programmatically. `applyPlan` (`:74`) is the
  over-this-one path.
- **`core/song-variations.js`** — `songVariations(parsed, tuningId)` (`:28`)
  enumerates a tuning's variation labels (so keep-both can find or reuse an
  existing author-named variation). `core/voicings.js` `selectBlock` (`:81`).
- **`songs/song-filename.js`** — `slugify(title)` (`:43`, NFD→ASCII,
  lowercase, non-alnum→`-`) and `deriveSongFilename(title, existing)` (`:66`,
  collision suffix `-2`/`-3`… against the folder listing). The sibling-file
  naming reuses both.
- **`worker/canonicalise.js`** — `canonicaliseFile` / `firstMarkerRefusal`,
  the single §8 writer gate on canonicality (no re-implemented parser).
- **UI** — `songs/SongConflict.jsx` (the per-conflict actions row,
  `:309-313`; the `keepBothHint`, `:315-317`, shown only for `voicing &&
  author`); `books/BookConflicts.jsx` (the paused panel, whole-file actions
  `:91-94`). Both have a flat `.actions` row, no overflow menu today.
  `i18n/locales/{en,pt-BR,es-419,it}.js` (parity enforced by
  `i18n/i18n.test.js`).

**Existing tests this task adds to**

`worker/conflicts.behavior.test.js`, `worker/conflict-model.test.js`,
`songs/SongConflict.behavior.test.jsx`, `books/BookConflicts.behavior.test.jsx`,
`e2e/web/tests/conflicts.spec.js` (the two-writer collide-and-settle journey,
`roda-de-rua.cifra.md` fixture, *Yours*/*Ana's* side labels).

## Constraints / requirements

- **Component boundaries (DIRECTION §3.7).** All resolution runs in the Web
  Worker under the one book lock (`locks.js` `withLock`); the main thread
  never touches git or IndexedDB. The view sends a `RESOLVE_CONFLICT`
  command and reads the `conflicts` slice; "only what shows it moves."
- **Canonical form over preserving content (§8.1).** Both outputs go through
  the `canonicaliseFile` gate before staging; `settle` refuses any staged
  file still holding a marker line. The author-named variation and the
  sibling file are canonical `.cifra.md`; nothing of the user's
  non-canonical spelling is preserved.
- **One writer, no re-implemented parser.** The new variation is written via
  `planIntoNewVariation` and the §8 writer; the sibling is theirs's already-
  canonical incoming bytes. Never scan or rewrite cifra.md text by hand.
- **No new storage.** The conflict model stays in-memory and recomputed, as
  `sync.conflicts` decided; keep-both adds no IndexedDB store and no
  migration. It extends the existing `RESOLVE_CONFLICT`/`settle` path — no
  new command, no new git operation beyond the `add` of one more file.
- **Accessibility.** The two new actions are React Aria Components, keyboard-
  reachable and operable, axe clean at WCAG 2.1 AA; each carries a word, not
  colour. The resolution overlay must not aria-hide the chart/shell chrome
  ([[rac-modal-aria-hides-shell-chrome]]) and any React Aria overlay portals
  inside `.est` ([[rac-overlays-portal-outside-est-theme-root]]). In behavior
  tests drive one gesture per action ([[rac-button-keydown-plus-click-cancels-press]]);
  a button row that reads as a list uses `role="group"`
  ([[role-list-of-rac-buttons-fails-axe]]).
- **No song text in logs; fixtures written for the purpose.** Test songs are
  authored for the test (never copyrighted words); the service logs no song
  text.
- **Offline first.** Keep-both resolves and commits locally; the push is the
  same offline-tolerant push the other resolutions use.

## Acceptance criteria

**Behavior delivered**

- On a `voicing` conflict, the per-conflict actions row of the resolver
  offers **Keep both** (shown only for voicing conflicts, replacing the
  `keepBothHint`). Choosing it: the user's shape stays in its block; the
  other person's shape lands in a variation named for them (e.g. *Ana*) for
  that tuning, built from the in-use block with the other side's shape
  substituted for the conflicted key (so the new variation is a complete
  playable arrangement, not a one-chord fragment — Decision 2); a second
  voicing keep-both in the same song/tuning accumulates into that same
  variation rather than making a new one. The conflict is marked resolved;
  the working-copy song is canonical.
- On a song with region conflicts, the resolver offers **Keep both** as a
  whole-song action: the user's version is kept at `<name>.cifra.md` and the
  other person's incoming version is written beside it as
  `<name>-ana.cifra.md` (`<name>-<slug of the other writer>`, collision-
  suffixed via `deriveSongFilename` — Decision 4). Offered on region-
  conflicted songs, **not** on a deleted-vs-edited `file` conflict (Decision
  3). The song's conflict is resolved; both files are canonical.
- Both resolutions land in the whole-book two-parent merge commit (parents
  local HEAD and `origin/main`), listed in history as *merged, with your
  resolution*, and pushed — the existing `settle` path, which refuses if any
  staged file still holds a marker line.

**Tests, by level** (the `.tji` `Tests:` clause: behavior + e2e-web)

- **behavior (Worker)** — `app/src/worker/conflicts.behavior.test.js`
  (new cases), each against the real local git remote (`git-http-remote`) +
  fake-IndexedDB with a second clone that pushed the colliding change, songs
  written for the purpose:
  - *keep both a voicing* — a `voicing` conflict resolved keep-both ⇒ the
    working-copy song keeps ours's shape in its block and carries a new
    variation named for the incoming author holding theirs's shape; the file
    is canonical; the two-parent commit is made and pushed (pins workflow 9
    §Later voicing bullet, spec §7.3).
  - *keep both voicings accumulate* — two voicing conflicts in one song/tuning
    resolved keep-both ⇒ a single author-named variation holds both theirs
    shapes (pins Decision 2).
  - *keep both a song* — a region-conflicted song resolved keep-both ⇒ ours
    at `<name>.cifra.md`, theirs's canonical bytes at `<name>-<author>.cifra.md`
    (collision-suffixed when the name is taken), both staged, committed and
    pushed; both canonical (pins workflow 9 §Later song bullet, §8.1).
  - *keep-both stays canonical* — the produced texts hold no marker line;
    `settle` would refuse otherwise (pins §8.1 / §11.12.3).
- **behavior (view)** — Testing Library + loopback store double + real React
  Aria + i18n, keyboard through every action, axe clean:
  - `app/src/songs/SongConflict.behavior.test.jsx` (new cases) — **Keep both**
    present only on a voicing step and absent on a chart step; the keyboard
    path fires `RESOLVE_CONFLICT` with the voicing keep-both choice; the
    whole-song **Keep both** fires the song keep-both choice; the old
    `keepBothHint` is gone; axe clean (pins workflow 9 §Settling one as
    amended).
  - `app/src/books/BookConflicts.behavior.test.jsx` (new case) if the song
    keep-both action is mirrored on the panel's conflicted-song row;
    keyboard, axe clean.
- **e2e-web** — `e2e/web/tests/conflicts.spec.js` (new *keep both a voicing*
  test, phone/tablet/computer), reusing the two-writer hosted-book setup (the
  owner and a node-git second writer "Ana" as a member of the same book):
  both set a different shape for the same chord of a song that has a voicings
  block (a fixture written for the purpose), both push; the second device to
  sync shows *needs you*; the user resolves with **Keep both**; assert the
  song now keeps the user's shape in use and carries a variation named for
  the other writer with theirs's shape (visible in the variation picker), the
  book clears *needs you* and the resolved merge is pushed and fetched back;
  axe on the conflict screen and the resolved song on all three viewports
  (pins workflow 9 §Later voicing bullet end to end).

If the implementer extracts a pure helper (e.g. deriving the sibling name, or
building the new-variation plan from a `voicing` conflict item), it gets a
unit case in the matching existing file
(`app/src/songs/song-filename.test.js` or
`app/src/worker/conflict-model.test.js`) — not a new mandated level, just
coverage where a pure seam appears.

**Test drivers** (checked present before naming)

- behavior (Worker): the local git smart-HTTP remote `git-http-remote` +
  `fake-indexeddb` + loopback/web-locks helpers — shipped by `sync.conflicts`
  / foundation, used by `conflicts.behavior.test.js`. ✓
- behavior (view): Testing Library + loopback store + React Aria + i18n —
  shipped. ✓
- e2e-web: the compose stack, two accounts sharing one hosted book (the
  second writer via node-git/CLI as a member) — the exact pattern
  `conflicts.spec.js` already runs; its drivers (`foundation.e2e_web`,
  `books.add_by_link`, `books.online`) are all `complete 100` and in this
  task's dependency closure through `!conflicts`. The only new test material
  is a fixture song carrying a voicings block (written for the purpose). ✓

No test level from the `.tji` note is dropped; none is added as mandatory.

**Deferred / follow-up:** none. Keep-both is fully delivered here with its
tests; nothing is left for a later task.

## Decisions

1. **App-layer resolution; no cifra.md spec, reference or corpus change.**
   The task note does not start with `cifra.md:`, and the format already
   provides everything keep-both needs: §7.3 variations for the voicing case,
   and a canonical `.cifra.md` file for the song case. The spec's §11 Open
   questions bullet (`spec/11-merge.md:2437-2440`) frames keep-both-as-a-new-
   variation as *"a resolution an application may want"* that is **not yet**
   defined ("It would be defined here"). Both outputs are ordinary canonical
   documents, so any conforming reader reads them identically — there is no
   cross-implementation disagreement to settle in the spec: the Go
   `git-merge-cifra` driver is a *non-interactive merge driver*, not an
   interactive resolver, so there is no second resolver that must "keep both
   alike" today. *Alternative — push the definition into cifra.md §11 now
   (spec + reference + corpus move together).* Rejected as speculative: it
   would standardize a resolution with exactly one implementer against a
   hypothetical second, enlarging a 2d app task into a format change. The
   question of eventually standardizing it stays where it already lives —
   cifra.md's own §11 open question (surfaced for the parking lot).
2. **Voicing keep-both copies the in-use block into the new variation, with
   the other side's shape substituted for the conflicted key**, via
   `planIntoNewVariation(doc, planResult, { tuning, name, copyFrom })`.
   *Alternative — a minimal variation holding only the other side's differing
   key.* Rejected: §7.3 says variations do not inherit, so a one-chord
   variation would resolve every other chord through defaults / *my shapes*
   when in use, losing the user's arrangement for the rest of the song —
   "neither arrangement is lost" (workflow 9 L83) means both must be
   *complete*. Multiple voicing keep-boths in one song/tuning accumulate into
   one variation named for that writer (found via `songVariations`), not a
   stack of near-duplicate blocks.
3. **Song keep-both applies to region-conflicted songs, not to a
   deleted-vs-edited `file` conflict.** The sibling exists to split a song
   whose two sides diverged into "two songs"; a `file` conflict (one side
   deleted, the other edited) has no second body of content to keep beside,
   and already offers *keep the song, with the edits* / *delete it*
   (workflow 9 L62-64). So keep-both-song sits beside the `FILE_KINDS` seam
   (`conflict-model.js:20-22`) but does not extend it.
4. **The sibling is named for the other writer: `<name>-<slug of the
   incoming author>.cifra.md`, rendered `<name>-ana.cifra.md` for "Ana".**
   Workflow 9 §Later and the W09 mockup write `<name>-ana.cifra.md` (Ana is
   the stand-in incoming author, matching the resolver's *Ana's* label); the
   WBS task text's `<name>-other.cifra.md` is a generic placeholder for the
   same thing. The normative workflow wins: the name is derived from the
   other person. Reuse `slugify` and the `-2`/`-3` collision suffix from
   `song-filename.js`.
5. **New `RESOLVE_CONFLICT` choices, not new commands.** Add a voicing
   `choice` (index-scoped, e.g. `'keep_both'`) and a song-level `choice`
   (path-scoped, e.g. `'keep_both_song'`) handled in `conflicts.js`
   `resolve`, reusing `writeWorking` and the existing `settle` two-parent
   commit + push. *Alternative — dedicated `KEEP_BOTH*` commands.* Rejected:
   keep-both is a resolution like the others; one applier, one commit path,
   the smallest seam.
6. **UI placement.** Voicing keep-both is a fourth action in the
   `SongConflict` per-conflict `.actions` row, shown only for voicing
   conflicts (replacing the `keepBothHint` at `:315-317`). Song keep-both is
   a whole-song action in the resolver (naturally mirrored on the
   `BookConflicts` conflicted-song row). React Aria, keyboard, axe, status by
   a word.
7. **Design delta — workflow 9.** Because this makes keep-both real app
   behavior, `docs/workflows/09-conflicts.md` is updated in the same (closer)
   commit: the two keep-both bullets move out of §Later into §Settling one
   (voicing, as a per-conflict option) and a short whole-song paragraph, with
   the decided copy; §Later is removed (its "by hand with edit" fallback is
   subsumed — the *edit* bullet already notes it keeps both included). No new
   mockup board: the W09 board already draws the resolver; its voicing
   keep-both hint region (~L95-138) is refreshed to show the action instead
   of the hint. A full new board is `design`-area work and disproportionate
   to a 2d sync task.

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-13.

- `app/src/worker/conflicts.js` — `keep_both` (voicing) and `keep_both_song` (whole-song) branches in `resolve`; `applyVoicingKeepBoth`, `stageResolved`, `stageFromMarked`, `folderListing` helpers; voicing accumulate into one author-named variation.
- `app/src/worker/conflict-model.js` — pure `voicingKeepBothOp` maps a `voicing` conflict item into a `planIntoNewVariation` call shape.
- `app/src/songs/song-filename.js` — pure `siblingFilename(name, author, existing)` deriving `<name>-<slug>.cifra.md` with collision suffix.
- `app/src/songs/SongConflict.jsx`, `app/src/books/BookConflicts.jsx`, `app/src/songs/song-conflict.css`, `app/src/worker/protocol.js` — Keep both action surfaced; `keepBothHint` removed; i18n keys added in `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- `docs/workflows/09-conflicts.md` — keep-both bullets moved from §Later into §Settling one; §Later removed.
- `docs/mockups/W09-conflicts.dc.html` — hint region updated to show the Keep both action.
- Tests: unit (`song-filename.test.js` siblingFilename, `conflict-model.test.js` voicingKeepBothOp); behavior Worker (`conflicts.behavior.test.js` — keep both a voicing, voicings accumulate, keep both a song, stays canonical); behavior view (`SongConflict.behavior.test.jsx` — 3 new Keep both cases + axe; `BookConflicts.behavior.test.jsx` — 1 new keep-both case + axe); e2e-web (`e2e/web/tests/conflicts.spec.js` — keep both a voicing on phone/tablet/computer + axe).

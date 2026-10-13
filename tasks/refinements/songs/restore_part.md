# songs.restore_part — Restore part of a version

## TaskJuggler entry

`task restore_part` in [`tasks/60-songs.tji`](../../60-songs.tji) (lines
78–83), under `task songs`, `depends !history, cifra_js.editing`. The `.tji`
note, verbatim:

> "Restore a single block of a version into the working copy, not the whole
> song; chosen from the per-version musical diff. Workflow 6 §Later. Source of
> debt: tasks/refinements/songs/history.md. Tests: behavior (one block
> restored, the rest untouched; axe); e2e-web (a block restored and saved on
> the three viewports; axe)."

This is a registered tech-debt leaf: `songs.history` (workflow 6) shipped
whole-version restore and explicitly left restoring *part* of a version to a
later leaf ([`history.md`](./history.md) §Deferred work; workflow 6 §Later as
it then stood).

## Effort estimate

**1.5 days** (from the `.tji`). `allocate team`.

## Repository

**estante-de-cifras** only, in one directory — `app/`:

- `app/src/songs/restorable-blocks.js` (new, pure) + `restorable-blocks.test.js` —
  grouping a musical diff into the blocks a user can bring back, and the ref
  the restore command carries.
- `app/src/worker/restore-block.js` (new, pure) + `restore-block.test.js` —
  the model-level splice: one block of the version's parsed model into the
  working copy's, written back canonical.
- `app/src/worker/history.js`, `app/src/worker/protocol.js` — a new
  `RESTORE_PART` command handled beside `restoreVersion`, reusing the
  `RESTORED` event.
- `app/src/songs/SongHistory.jsx`, `DiffRows.jsx`, `song-history.css` — the
  per-block *Restore this block* affordance on the version detail; the
  block-scoped confirm reuses `RestoreConfirm.jsx`.
- `app/src/songs/SongHistory.behavior.test.jsx` (extend),
  `app/src/worker/history.behavior.test.js` (extend) — the view and Worker
  behaviour.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — a few new `history.*` keys.
- `e2e/web/tests/restore-part.spec.js` (new) — the journey.

This task **consumes** the `cifra-md` package (`parse`, `write`/`canonical`,
`diff`) but adds nothing to it: it is **not** a `cifra.md:` task. The model
splice is thin app orchestration over plain-object model trees; the
footnote-index bookkeeping it depends on is `write`/`canonical`'s, already
corpus-proven (see §Decisions *The splice lives in the app, not cifra.md*).

**Design delta (same commit).** [`docs/workflows/06-history.md`](../../docs/workflows/06-history.md)
§Restoring is amended: the "Later" item *Restoring part of a version* is
promoted to decided behaviour and its three-line §Later section removed. This
refinement turns that decided paragraph into the work order.

## Inherited dependencies

- **`songs.history` — settled** (Done; [`tasks/60-songs.tji`](../../60-songs.tji)
  line 74 `complete 100`; [`history.md`](./history.md) §Status). It delivers
  the whole surface this task extends: the version list, a version read
  as-it-was beside its musical diff, *compare with now*, *show the text*, and
  whole-version *Restore this version* — the last writing the historical blob
  into the working copy uncommitted, to be saved as a new version. Established
  seams reused here, by name:
  - the view `app/src/songs/SongHistory.jsx` with the version-detail diff
    (`DiffRows changes={shownChanges}`, `SongHistory.jsx:177`;
    `shownChanges = comparingNow ? compareChanges : openRow?.changes`,
    `:345`), the compare-with-now diff `diff(parse(thisText), parse(workingText)).changes`
    (`:343`), the single *restore* button (`:394`) and its dirty-confirm path
    (`onRestoreClick` → `RestoreConfirm` or `sendRestore`, `:328–366`);
  - the dev-mount host `app/src/songs/HistoryDev.jsx` behind `#dev/history`,
    opening `SaveSheet` on the `RESTORED` token bump;
  - the Worker's `createHistory({fs,git,locks})` with `restoreVersion({bookId,
    path, commit, fromPath})` writing the historical blob into the working
    tree at the song's **current** path, uncommitted, inside one `withLock`,
    not through `workingCopy.write` (`app/src/worker/history.js:322–340`; the
    "RESTORE DOES NOT COMMIT, CANONICALISE OR PUSH" invariant, `history.js:28`);
  - the protocol: `CommandKind.RESTORE_VERSION`, `EventKind.RESTORED
    {bookId, path}` (`app/src/worker/protocol.js:55,310`).
- **`cifra_js.editing` — settled** (Done 2026-10-05, cifra.md `b1d1f94`;
  [`cifra_js/editing.md`](../cifra_js/editing.md) §Status). It establishes the
  model-edit conventions this task follows — a pure `doc → doc` transform that
  deep-clones and returns a new model, canonicalisation **left to `write`**,
  and an occurrence/section/voicing addressed by its structural path in the
  model. Its five §8.5 ops are shape-choosing, not a generic block splice, so
  this task does not call them (§Decisions); it depends on `editing` for the
  settled model-transform-then-`write` pattern they share.
- **Implied, settled (through `songs.history`'s chain):** `cifra_js.diff` — the
  block-aware `diff(before, after) → {changes, summary}` whose change records
  are already grouped by block and were designed for "later block-wise" use
  ([`cifra_js/diff.md`](../cifra_js/diff.md):297, :122–123); `cifra_js.reader`
  / `cifra_js.writer` through the package (`parse`, `write`, `canonical`);
  `storage.history` (the `createHistory` Worker seam) and
  `storage.working_copy`; `foundation.e2e_web` (the Playwright harness).

## What this task is

A user reading a song's history can already bring a **whole** old version back
into the working copy. This task adds bringing back **one block** — a section
or a voicing block — and leaving the rest of the song as it is. The canonical
need (workflow 6): *bring back the ukulele voicings from last week* without
losing this week's new verse.

The musical diff already knows the song in blocks, so this is a matter of
offering it. On the version detail, *compare with now* lists the blocks of
that version that differ from what is on screen now; each gets a *Restore this
block*. Choosing one replaces (or adds, or removes) just that block in the
working copy and opens the save sheet, so the one-block change is saved as a
new version. It asks first — showing what would be lost in that block — when
the block holds unsaved changes, exactly as whole-version restore and discard
do. Where the version is too old to read in blocks, or a block's chords are no
longer in the song, the surface says so and offers what it can rather than
failing.

## Why it needs to be done

`songs.history` closed workflow 6 except its §Later line; this leaf closes
that line, completing workflow 6. It is the last piece of the "history" slice
of milestone **M2 `m2_local`** ("find, read, write, edit, arrange, history").
No task depends on it; it is a leaf. Its value is direct: partial restore is a
real, named need, and the whole-version restore that shipped first is a blunt
instrument — restoring last week's voicings should not also throw away this
week's edits.

## Inputs / context

### Governing design

- [`docs/workflows/06-history.md`](../../docs/workflows/06-history.md)
  **§Restoring** (as amended by this task's delta): *Restore this block* on
  each block the version has that differs from now; writes one block, leaves
  the rest; asks first when the block has unsaved changes; the no-op /
  unreadable-version surfaces; the save sheet then shows the change. The
  §Later item this promotes was the task's starting point.
- [`docs/DIRECTION.md`](../../docs/DIRECTION.md) **§3.6–§3.7** — the view is
  the only React layer; the Worker owns git, the working copy and the index;
  the main thread never touches IndexedDB; `cifra-md` stays framework-free
  below the view; the app and the service share no code. **§3.1** — a saved
  version is a commit; restore never rewrites history, it makes a new version.
  **§4** — song history is a diff in musical terms with a save message drawn
  from it.
- [`docs/mockups/W06-history.dc.html`](../../docs/mockups/W06-history.dc.html)
  — the version-detail diff surface on phone, tablet and computer; the
  per-block affordance reuses its diff-row and button tokens (no new visual
  language), and `docs/mockups/README.md:26` — every status word-carried,
  never colour alone.

### The musical diff (the block structure to offer)

[`cifra_js/diff.md`](../cifra_js/diff.md) — `diff(before, after) →
{changes, summary}`, imported from `cifra-md`, over two parsed models:

- `changes` is an ordered array of `{ kind, op, where, before, after, text }`;
  `kind ∈ title | property | section | chord | words | voicing`;
  `op ∈ added | removed | changed | renamed | reordered`;
  `where = { section?, bar?, tuning?, variation?, … }` (diff.md:210–218).
- Ordering is deterministic: title, properties, **sections in document
  order** (each with its chord and words changes), then **voicing blocks in
  model order** (diff.md:223–225).
- A **section** aligns by name occurrence in order; a **voicing block** is
  keyed by `(tuning.id, label)` — `label` the variation name, empty for the
  default (diff.md:145–147, :236). The model subtrees: `sections[i] =
  { name, heading, anchor, body, groups }` (diff.md:136) and `blocks[i] =
  { label, tuning, voicings, notes }` (diff.md:145).
- `diff` was built for this: "the per-version preview … and — later —
  block-wise [restore]" (diff.md:297); "the diff is block-aware" (diff.md:123).

### The code seams this extends

- `app/src/worker/history.js:322–340` — `restoreVersion`, the exact mechanics
  to mirror for a block (read historical blob, write working tree, one lock,
  no commit).
- `app/src/worker/protocol.js:53–55, 308–310` — `CommandKind` / `EventKind`
  are open strings each consumer extends; `RESTORE_VERSION`→`RESTORED` the
  pattern a `RESTORE_PART`→`RESTORED` follows.
- `app/src/songs/SongHistory.jsx:177, 343–345, 394, 328–366` — the diff rows,
  the two diff modes, the restore button, the dirty-confirm path.
- `cifra_js/editing.md` §Decisions — the pure `doc → doc` deep-clone transform
  with canonicalisation left to `write`; the index-path addressing convention
  (`{ section, part, line, measure, item }`) `diff.js` and `edit.js` share.

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data** (DIRECTION
  §3.7). The view renders the per-block affordance, reads slices and sends the
  command; it never parses-to-write, canonicalises, touches IndexedDB, git or
  the book lock. The splice and the working-tree write happen in the Worker,
  inside the one book lock `createHistory` already takes (like
  `restoreVersion`), never through `workingCopy.write`.
- **Canonical form over preserving content** (cifra.md §8). The restore writes
  through `write`/`canonical`: the spliced model is normalised, footnote
  indices (§8.3 I1/I2/I3) re-derived from the current chart and blocks. A
  restored voicing block whose keys no longer appear in the chart is pruned by
  canonicalisation — surfaced ("brings nothing back"), never left as a dangling
  half-restore. A marked text is never produced (restore introduces no conflict
  markers) and `write` still refuses one if handed it.
- **One block changes, the rest is byte-identical.** Restoring a block mutates
  only that block's subtree in the working model; every other section, block,
  property and the title are carried through `parse`→splice→`write` unchanged,
  which the canonical round-trip guarantees. This is the task's load-bearing
  behaviour ("the rest untouched").
- **No new sync phase or state.** The restore is a local working-copy write
  that yields an unsaved change, saved and pushed through the normal save path
  (`SaveSheet`→`SAVE`). The only protocol addition is the `RESTORE_PART`
  command reusing the `RESTORED` event — the established open-string extension,
  not a new phase in the sync model. (Orchestrator note honoured: coordinate
  with the existing phase/state model; no new phases.)
- **Consistent with the conflict-resolution surface** (workflow 9, commit
  `b8ab1a6`). The block-restore confirm reuses the same centered
  `RestoreConfirm` RAC dialog history already uses, with block-scoped "what
  would be lost"; status is word-carried; the choose-and-apply register matches
  the paused-book / conflict surface. No bespoke overlay.
- **Offline first.** History is a full clone; the diff, the splice and the
  working-copy write are all local git/model work — nothing waits on the
  network; the push is the save sheet's, deferred as usual.
- **Accessibility.** Every interactive part is a React Aria Component
  (`DiffRows`' per-block *Restore this block* `Button`, the `RestoreConfirm`
  dialog); full keyboard paths; axe at WCAG 2.1 AA on the history surface, the
  confirm and the save sheet, on every viewport; status a word, never colour.
  Overlays portal into the `.est` token root via `ThemeRoot`.
- **i18n.** All copy through `t(key, params)`; new `history.*` keys in all four
  catalogues, `en` the source of truth (build gate on completeness). Musical
  tokens (chord symbols, section names, tuning text) pass through `renderChange`
  as data, never translated.
- **No song text in logs; purpose-written fixtures.** Service logs are
  unaffected (no service work); every test song is written for the purpose.
- **No book without an account; `noindex`.** Applies trivially — history is a
  book surface behind the session the shell already holds.

## Acceptance criteria

### Behaviour delivered

1. On the version detail in **compare-with-now** mode, each block the version
   has that differs from the working copy carries a *Restore this block*
   affordance beside its diff rows; the restorable blocks are **sections and
   voicing blocks** (the structural units the diff groups), in document then
   model order. *Pins workflow 6 §Restoring; diff.md:223–236; W06 version
   detail.*
2. Choosing *Restore this block* on a block whose version content differs from
   now writes **only that block** into the working copy — a section or a
   voicing block replaced, added, or removed to match the version — and leaves
   every other block byte-identical; the save sheet then opens on the song so
   the one-block change is saved as a new version. *Pins the `.tji` "one block
   restored, the rest untouched"; workflow 6 §Restoring; §3.1.*
3. When the block holds unsaved changes (its working-copy content differs from
   the last saved version), restore asks first through `RestoreConfirm`,
   showing what would be lost **in that block**; otherwise it proceeds. *Pins
   workflow 6 §Restoring ("asks first … what would be lost in that block");
   workflow 9 surface consistency.*
4. A chosen block that, once spliced and canonicalised, equals the working copy
   (nothing to bring back) or is pruned to nothing (its chords are no longer in
   the song) is surfaced with a word-carried notice and does **not** open an
   empty save sheet. *Pins workflow 6 §Restoring ("brings nothing back, and
   says so"); canonical-form rule.*
5. A version whose historical bytes do not `parse` into blocks offers only the
   whole-version *Restore this version* (`songs.history`), with a word-carried
   note that this version cannot be restored block by block. *Pins workflow 6
   §Restoring ("a version too old to read in blocks offers only the
   whole-version restore"); orchestrator "surface what's available rather than
   failing."*

Wiring: a new pure `restorable-blocks.js` (view) and `restore-block.js`
(Worker), a `RESTORE_PART` command in `protocol.js` handled by `createHistory`
in `history.js` (reusing `RESTORED`), the per-block affordance in `DiffRows.jsx`
raised to `SongHistory.jsx`, and the block-scoped reuse of `RestoreConfirm.jsx`.
No new `EventKind`, no new sync phase; `reducer`/`store`/`logic` unchanged.

### Tests the task lands with, by level

The `.tji` names **behavior** and **e2e-web**. Per the testing policy this
refinement **adds unit** for the two new pure modules (a pure module gets unit
tests), and splits behavior into the view and the Worker, as the `songs.history`
siblings do.

- **unit — `app/src/songs/restorable-blocks.test.js`** — `restorableBlocks(changes)`
  groups a diff's change records into restorable blocks (section by
  `anchor`/name-in-order, voicing block by `(tuning.id, label)`), carries each
  block's display label and the ref the command sends, and excludes
  non-block kinds (a title/property-only or lyric-only change is folded into
  its section or omitted — §Decisions). *Pins diff.md:210–236; the block-scope
  decision.*
- **unit — `app/src/worker/restore-block.test.js`** — `restoreBlock(workingText,
  versionText, block)` on purpose-written songs: a section replaced / added /
  removed; a voicing block replaced / added / removed; the rest of the song
  byte-identical (`write` round-trip); canonicalisation renumbers footnote
  indices when a restored voicing block collides (§8.3 I2/I3); the no-op case
  (block already matches now → `empty`) and the prune-to-nothing case (restored
  voicings whose keys are not in the chart → `empty`). *Pins workflow 6
  §Restoring; cifra.md §8.3; "the rest untouched."*
- **behavior (view) — `app/src/songs/SongHistory.behavior.test.jsx`** (extend,
  Testing Library + axe) — *Restore this block* shown per differing block on
  compare-with-now; choosing one sends `RESTORE_PART` naming **only** that
  block; on `RESTORED`, `onRestored` fires and the save sheet's preview shows
  only that block changed; the block-scoped `RestoreConfirm` appears when the
  block has unsaved changes and not otherwise; the no-op notice (4) and the
  unparseable-version fallback (5); axe clean on each state. *Pins behaviours
  1–5; workflow 6 §Restoring; W06.*
- **behavior (Worker) — `app/src/worker/history.behavior.test.js`** (extend;
  the Worker rig — `fake-indexeddb`, `installWebLocks`, a local git remote) —
  `RESTORE_PART {bookId, path, commit, fromPath, block}` reads the historical
  blob at `fromPath@commit` and the current working copy, writes the spliced
  canonical text at the song's **current** path uncommitted inside one lock,
  emits `RESTORED {bookId, path}`, and neither commits nor pushes; the working
  tree's song equals the splice and is byte-identical elsewhere; rename-correct
  via `fromPath`. *Pins the Worker seam (history.js:28, :322–340); DIRECTION
  §3.7.*
- **e2e-web — `e2e/web/tests/restore-part.spec.js`** (new; compose stack;
  phone, tablet and computer projects) — write a song, save; edit one block
  (a voicing block in one run, a section in another) and a second block, save;
  open the song's history, open the earlier version, *compare with now*,
  *Restore this block* on the first block, save; the restored block is back and
  the second block's edit is intact; axe at WCAG 2.1 AA on the history surface,
  the confirm and the save sheet. All steps local (restore needs no network).
  *Pins the `.tji` e2e clause ("a block restored and saved on the three
  viewports; axe"); workflow 6 §Restoring.*

Driveability: every prerequisite is in `depends` and `complete 100` — the
history surface and its `createHistory`/`RESTORE_VERSION` seam (`songs.history`
← `storage.history`, `storage.working_copy`), the block-aware `diff` and the
model `parse`/`write` (`cifra_js.diff`/`reader`/`writer` via the package), the
`#dev/history` dev mount, and the Playwright harness (`foundation.e2e_web`).
The e2e seeds its own two versions locally (write, save, edit, save); it needs
no hosted book and no second device.

### Deferred work (closer registers in the WBS)

**None.** Finer-than-block restore (one chord of a bar, one voicing entry of a
block) is deliberately **out of scope and not a new leaf**: the §Later need is
block-level ("the song in blocks"), and sub-block restore invites bar
renumbering and partial-voicing reconciliation the whole-block splice avoids —
it is designed-future like "comparing two arbitrary versions," not deferred
debt. No mockup-board leaf: the per-block affordance reuses W06's existing
diff-row and button tokens and the workflow delta carries the decided behaviour.

## Decisions

1. **The restorable unit is a block — a section or a voicing block — not a
   sub-block.** These are the structural units `diff` already groups by
   (diff.md:223–225) and the model exposes as whole subtrees (`sections[i]`,
   `blocks[i]`), so a restore is a clean subtree replace that canonicalisation
   reconciles. *Rejected:* restoring a single chord or a single voicing entry —
   finer, but it reopens the footnote-index and bar-numbering bookkeeping §8.5
   and the whole-block splice sidestep, for a need §Later did not ask for.
   Title/property header fields and lyric-only changes are not independently
   restorable: a property is a one-field edit better served by whole-version
   restore or direct editing, and words ride with their section.
2. **The splice lives in the app (the Worker), not in `cifra-md`.** Replacing a
   section or voicing-block subtree is thin plain-object orchestration; the
   subtle part — re-deriving footnote invariants after a voicing block moves —
   is `write`/`canonical`'s, already corpus-proven. So `restore-block.js` is a
   pure app helper that `parse`s both texts, splices the subtree, and hands the
   result to `write`. *Rejected:* a new `restoreBlock` operation inside
   `cifra-md` (`js/src/edit.js`). That would make this a `cifra.md:` task with a
   spec chapter, a Python-reference port and corpus entries, for behaviour no
   second implementation consumes (the Go side reads/writes/merges, it never
   arranges or restores) — exactly the scope `cifra_js.editing` §Decisions
   declined for §8.5. The `.tji` note is not a `cifra.md:` task and its
   `depends` are app-reachable, confirming the intent. The §8.5 ops are
   shape-choosing, not a generic block splice, so they are not reused here
   either.
3. **The affordance keys on the compare-with-now diff.** *Restore this block*
   sits on the blocks of the version that differ from the working copy —
   precisely the blocks a restore would change — so every offered restore is a
   real change. A block that already matches now is not offered; if one is
   chosen anyway (e.g. the working copy changed under the surface) the no-op is
   surfaced, not an empty save sheet (behaviour 4). *Rejected:* offering restore
   on the version-vs-before diff, where a shown block may already match now and
   restoring it does nothing — confusing, and it buries the "what would this
   bring back" signal the compare-with-now diff gives for free.
4. **A new `RESTORE_PART` command, reusing the `RESTORED` event and the save
   path.** `restorePart` on `createHistory` mirrors `restoreVersion`
   byte-for-byte except for the splice: one lock, write the current path
   uncommitted, no commit/push, then `RESTORED` so the existing host opens the
   save sheet. *Rejected:* a new event kind or a bespoke "partial restore"
   state — unnecessary; `RESTORED {bookId, path}` already means "an uncommitted
   restore landed, open the save sheet," which is exactly what a block restore
   produces. This keeps the sync model untouched (orchestrator constraint).
5. **The block ref is resolved against the version's parsed model by stable
   identity** — a section by `anchor` (falling back to name-in-order as `diff`
   aligns), a voicing block by `(tuning.id, label)`. The view, which already
   parses the version to render, mints the ref; the Worker re-parses and
   resolves the same way, so the two agree without shipping model subtrees over
   the protocol. *Rejected:* passing the block's model subtree in the command
   payload (couples the protocol to the model shape and bloats the message) or
   re-diffing in the Worker to locate the block (duplicates alignment and the
   diff already ran in the view).
6. **"Surface what's available rather than failing" is two concrete cases, no
   more.** A version that does not `parse` offers only whole-version restore
   with a word-carried note (behaviour 5); a block that canonicalises to a
   no-op or is pruned to nothing says so (behaviour 4). Both are local, both
   are word-carried, neither invents a phase or a retry. *Rejected:* a generic
   "some history unrecoverable" banner or a repair/retry affordance — there is
   no partial state to repair; a version either reads in blocks or it does not,
   and whole-version restore (raw bytes) already covers the latter.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-13.

- New `app/src/songs/restorable-blocks.js` (pure view helper) + `restorable-blocks.test.js` — groups a diff's change records into section/voicing-block units with stable refs (anchor/name-in-order for sections, `(tuning.id, label)` for voicing blocks); 8 unit tests.
- New `app/src/worker/restore-block.js` (pure Worker helper) + `restore-block.test.js` — reads both texts, splices one block subtree into the working model, writes via `write`/`canonical`; handles section replace/add/remove, voicing-block replace/add/remove, footnote-index renumber (§8.3), no-op and prune-to-nothing cases; 10 unit tests.
- Extended `app/src/worker/history.js` and `app/src/worker/protocol.js` — new `RESTORE_PART` command handled by `restorePart` on `createHistory`, reusing the `RESTORED` event; the splice and working-tree write happen inside one book lock, uncommitted.
- Extended `app/src/worker/logic.js` — wires `RESTORE_PART` into the Worker dispatch.
- Amended `app/src/songs/SongHistory.jsx`, `DiffRows.jsx`, `RestoreConfirm.jsx`, `song-history.css` — per-block *Restore this block* affordance on the compare-with-now diff; block-scoped `RestoreConfirm` when block has unsaved changes; no-op notice; unparseable-version fallback.
- Updated `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — new `history.*` i18n keys.
- Amended `docs/workflows/06-history.md` — §Restoring §Later item promoted to decided behaviour.
- Behavior tests: `SongHistory.behavior.test.jsx` (+5 cases, axe), `history.behavior.test.js` (+1 — RESTORE_PART splice, uncommitted, rename-correct).
- e2e-web: `e2e/web/tests/restore-part.spec.js` — block restored over unsaved edit (confirm path) + clean voicing-block restore; axe on history surface, confirm, save sheet; three viewports.

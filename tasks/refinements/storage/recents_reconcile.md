# storage.recents_reconcile — retire the synced `recents.json`

## TaskJuggler entry

[`tasks/40-storage.tji`](../../40-storage.tji), `task recents_reconcile`
under `task storage`. The one-line note:

> "Remove the now-superseded synced recents.json from the home book's
> SETTINGS_FILES (app/src/worker/home-book.js:56–63) and reconcile
> docs/home-book-format.md §4.6/§7 and tasks/refinements/storage/home_book.md
> §2.1/§7 with device-local recents, resolving the contradiction with
> DIRECTION §3.2 / workflow 2 L17–20. Source of debt:
> tasks/refinements/songs/search.md (songs.search). Tests: unit (recents.json
> no longer in SETTINGS_FILES; the key-by-key home-book merge unaffected;
> recording a recent commits nothing to the home book)."

Dependency as declared: `depends songs.search`.

## Effort estimate

**0.5d** (as scoped in the `.tji`), allocated `team`. A one-line code change,
a bounded documentation reconciliation, and one new unit assertion — the bulk
of the work is bringing the format document in line with a decision already
made elsewhere, not making a new one.

## Repository

**estante-de-cifras** only, `app/` and `docs/`:

- `app/src/worker/home-book.js` — remove `'recents.json'` from
  `SETTINGS_FILES` (`:56–63`) and export the constant (frozen) so the unit
  assertion can read it (Decision 4).
- `app/src/worker/home-book.test.js` — the new unit case over the exported
  constant.
- `app/src/worker/home-book-canonical.test.js` — relabel the one fixture that
  used a recents list as its array-order example (`:53–67`), since §4.6 no
  longer defines a recents list (Decision 3; the array-order behaviour is
  unchanged).
- `docs/home-book-format.md` — the format reconciliation: §2.1, §2.3, §4.6,
  §6.1, §7, §8 (the delta this task carries; see Acceptance → Format
  reconciliation).
- `tasks/refinements/storage/home_book.md` — the factual format-summary in its
  *Inputs / context → The format* section brought in line (§2.1, §2.3 and §7
  bullets), touching no Decisions/Acceptance/Status line of that refinement
  (those stay the historical record; Decision 2).

**Not a `cifra.md:` task.** The home book is the app's personal-state format,
owned in this repository (home-book-format.md L11–14); nothing in the cifra.md
repository defines or reads it. The app and the service share no code
(DIRECTION §3.6); recents never leave the device, so the service is untouched.

## Inherited dependencies

All **settled**:

- **`songs.search`** — *settled, Done 2026-10-05*
  ([`../songs/search.md`](../songs/search.md)). This is the source of the debt
  and the task that already built the correct seam:
  - It landed the **device-local recents store**:
    `app/src/worker/recents.js` (the capped, most-recent-first list under the
    `recents` key of the Worker-owned `meta` database), the
    `RECORD_RECENT { bookId, path }` command and the `RECENTS` event
    (`app/src/worker/protocol.js:110–114`), the `recents` slice
    (`app/src/worker/reducer.js:83–88, 296–299`), and the `logic.js` dispatch
    (`app/src/worker/logic.js:350–355, 448–456, 661–668`).
  - Its **Decision 2** (`../songs/search.md:464–476`) chose the `meta` store
    over the home book's `recents.json` and recorded that `recents.json` "is
    also presently dead (nothing writes or surfaces it)", deferring the dead
    file's removal and the format reconciliation to **this** task.
  - Its deferral note (`../songs/search.md:427–439`) scopes this task exactly,
    including that "its refinement carries the `home-book-format.md` delta (out
    of [`songs.search`]'s write scope)".
- **`storage.home_book`** — *settled, Done*
  ([`home_book.md`](home_book.md)). The writer/merger whose `SETTINGS_FILES`
  (`home-book.js:56–63`) drives the `sync` merge loop (`home-book.js:289`). Its
  *Inputs / context → The format* summary (§2.1, §2.3, §7) is what this task
  reconciles.
- **`design.home_book_format`** — *settled, Done*
  ([`../design/home_book_format.md`](../design/home_book_format.md)). The
  design task that wrote `docs/home-book-format.md`. Its "Per-device state"
  decision (`:216–220`) tried to reconcile a since-removed workflow 4 line
  (*"recents in the home book"*) with workflow 13 (*recents per device*) by
  having recents sync under a device-id namespace. Workflow 2 L17–20 (decided)
  settles it the other way; this task amends the format to match. Workflow 4
  no longer mentions recents (confirmed: no `recent*` in
  `docs/workflows/04-edit-and-save.md`), so the format is now the only outlier.

**No pending blocking dependencies.** `hook.home_book` (the service-side
validator of §8) is **not yet built** (`tasks/35-hook.tji:44–49`, no
`complete`, no refinement). It will be written against the amended §8 (seven
files, not eight) when it lands — so this task changes no shipped validator and
leaves no stale whitelist behind it (Decision 6).

## What this task is

Retire the synced `recents.json`. The app's recents are device-local and
unsynced — workflow 2 L17–20 and DIRECTION §3.2 require it, and `songs.search`
implemented it (the `meta` store). But three places still describe or carry a
*synced* `recents.json`: the home book's `SETTINGS_FILES` constant (dead — the
`sync` merge loop iterates a file nothing ever writes), and
`docs/home-book-format.md` §2.1/§4.6/§7/§8 (which still lists `recents.json` as
a tracked, per-device-namespaced, synced home-book file), plus the factual
summary of that format in `home_book.md`. This task removes the dead constant
entry and brings the format document and the `home_book` refinement's summary
in line with the device-local decision, resolving the contradiction.

## Why it needs to be done

It closes a live contradiction between the implementation, the direction and
the format specification:

- **The direction and the workflows** say recents are device-local and **not
  synced**: workflow 2 L17–20 ("Recents are kept on the device and are not
  synced … the home book (DIRECTION §3.2) would gain a commit for each. What
  you played on the phone last night is not something the laptop needs"),
  workflow 13 L35–36 ("Recents are kept per device, so there is no 'most
  recently played' to go by"), and DIRECTION §3.2 L136–151, which lists the
  personal state the home book holds and does **not** include recents.
- **The implementation** agrees: `songs.search` keeps recents in the
  device-local `meta` store and never commits them (`recents.js`;
  `../songs/search.md` Decision 2).
- **The format document and the dead constant** disagree: `recents.json` is a
  tracked home-book file (§2.1, §4.6) whose per-device namespace is said to
  *sync* "riding in the home book like every other file" (§7), and it is still
  in `SETTINGS_FILES`.

Leaving it costs twice over: the `sync` merge loop carries a dead file, and the
unbuilt `hook.home_book` would be written against a whitelist that admits a
file the app must never push. The task is small but load-bearing: the format is
the specification `hook.home_book` will validate against.

## Inputs / context

### Governing design (the already-settled decision)

- **Workflow 2 — Find and play a song**
  (`docs/workflows/02-find-and-play.md` L17–20): recents are device-local and
  not synced; a per-open home-book commit is explicitly ruled out. (Status:
  decided, L3.)
- **Workflow 13 — A new device** (`docs/workflows/13-new-device.md` L35–36):
  "Recents are kept per device, so there is no 'most recently played' to go
  by." The "what comes down" to a new device (L29–55) is the home book, the
  shelf and local-book markers, and explicitly *not* recents; device-bound
  state "stays on the device … Nothing travels, and nothing pretends to"
  (L52–55).
- **DIRECTION §3.2 — Personal state** (`docs/DIRECTION.md` L136–151): the home
  book holds instruments, notation, theme, variations, transpositions and *my
  shapes* — recents are not among them.
- **DIRECTION §3.7 — the app**: the Worker is the one owner of on-device data;
  device-local state lives in storage the Worker owns (the `meta` store), which
  is where recents already are.

### The document being reconciled

- **`docs/home-book-format.md`** — the format. The sections that still assert a
  synced `recents.json`:
  - **§2.1 The tracked files** (L76–98): lists `recents.json` as one of eight
    tracked files (six settings files); "Each of the six settings files is
    independent" (L93).
  - **§2.3 Identifiers** (L130–148): the device id is a namespace key "in
    `recents.json` and in `shelf.json`'s local books" (L135); a song ref is the
    key "under which per-song state (§4.5) and recents (§4.6) are held" (L148).
  - **§4.6 `recents.json`** (L310–328): defines the per-device synced recents
    file.
  - **§6.1** (L407): "keeps every array's order — a recents list (§4.6) and any
    ordered opaque value".
  - **§7 Per-device state** (L445–463): recents and local-book markers are
    namespaced by device id so they "nonetheless **sync**, riding in the home
    book like every other file, so a lost device's recents … are not lost with
    it" — the rationale this task reverses for recents.
  - **§8 Allowed kinds and validation** (L465–493): "the eight files of §2.1"
    (L467, L472) — the whitelist `hook.home_book` will enforce.

### The code seam

- **`app/src/worker/home-book.js:56–63`** — `SETTINGS_FILES`, the module-level
  constant the `sync` merge loop iterates (`:289`). `recents.json` is entry six
  (`:62`); nothing ever writes it, so it is dead. The constant is not exported.
- **`app/src/worker/home-book.test.js`** — the unit test for `home-book.js`
  (currently the §2.3 device id). The new assertion over `SETTINGS_FILES` lands
  here.
- **`app/src/worker/home-book-merge.test.js`** — the unit test for
  `mergeTrees`, the key-by-key merge. It is **file-agnostic** (it merges trees,
  not named files) and never referenced `recents.json`, so it pins "the merge
  unaffected" by continuing green, unchanged.
- **`app/src/worker/home-book-canonical.test.js:53–67`** — a §6.1 array-order
  unit case whose fixture is shaped as a recents list. The rule it pins (arrays
  keep their order) survives; only the example needs relabelling to an ordered
  opaque value, since §4.6 no longer defines a recents list.
- **`app/src/worker/recents.behavior.test.js`** (landed by `songs.search`) —
  pins "recording a recent commits nothing to the home book" against a real
  local git remote. It must stay green here.

### The refinement summary being reconciled

- **`tasks/refinements/storage/home_book.md`** *Inputs / context → The format*
  (L196–252): the §2.1 bullet (L205–206) lists `recents.json`; the §2.3 bullet
  (L214–218) names it a namespace key "in `recents.json`"; the §7 bullet
  (L244–248) says recents "sync yet never collide". These factual summaries are
  updated to match the amended format.

## Constraints / requirements

- **Offline first; recents never touch the home book or the network.** A song
  open writes only the device-local `meta` store; it makes no commit and no
  push (workflow 2 L17–20; `../songs/search.md` Decision 2). *Central — pinned
  by the retained `recents.behavior.test.js` "no home-book commit" case.*
- **The Worker owns on-device state.** Recents live in the `meta` store the
  Worker owns (home-book-format §2.3; DIRECTION §3.7), never in a synced file,
  never in `localStorage`, never touched by the main thread. *Applies — already
  satisfied by `songs.search`; this task removes the contradicting file.*
- **The home book stays a legible settings repository.** After the change the
  home book holds five settings files plus `README.md` and `.gitattributes`;
  the merge, canonical form and per-device namespacing of local-book markers
  are unchanged. *Applies.*
- **No song text in logs.** A song ref is a location reference (`<book-id>/
  <path>`), not song text; the Worker logs nothing regardless
  (`logic.js:9–11`). *Applies trivially — nothing new is logged.*
- **No book without an account.** Unaffected — recents reference locations on
  the device and open no read path. *Applies trivially.*
- **Canonical form over preserving content.** *Not applicable* — no song or
  settings content is produced or preserved; a file is removed from a
  whitelist. No legacy `recents.json` exists on any remote to migrate (nothing
  ever wrote one), so there is no compaction or migration concern (Decision 5).
- **Format owned here.** The home book is the app's personal-state format
  (home-book-format L11–14); this is a documentation+code change in
  estante-de-cifras, not a cifra.md spec change. *Applies.*

## Acceptance criteria

### Behavior delivered

1. **The dead file is gone from the merge.** `SETTINGS_FILES`
   (`home-book.js:56–63`) holds exactly `preferences.json`, `shelf.json`,
   `instruments.json`, `shapes.json`, `songs.json` — `recents.json` is removed.
   The `sync` merge loop (`:289`) therefore never iterates `recents.json`.
2. **The format describes device-local recents.** `docs/home-book-format.md`
   no longer lists `recents.json` as a tracked, synced home-book file, and
   states that recents are device-local and deliberately not a home-book file
   (see Format reconciliation).
3. **The `home_book` refinement summary matches.** The factual format summary
   in `home_book.md` (§2.1, §2.3, §7 bullets) no longer describes a synced
   `recents.json`.
4. **Recents still work and still cost no commit.** Recording a song open
   writes the device-local `meta` store and emits `RECENTS`, making no
   home-book commit and no push — unchanged from `songs.search`, now pinned
   against a home book whose format no longer admits recents.

### Format reconciliation (the delta this task carries)

In `docs/home-book-format.md`:

- **§2.1** — remove the `recents.json` bullet (L86); the tracked files become
  five settings files plus `README.md` and `.gitattributes` (**seven** total).
  Change "the six settings files" → "the five settings files" (L93).
- **§2.3** — the device id is a namespace key in `shelf.json`'s local books
  (§4.2, §7) **and** the owner key of the device-local recents the Worker keeps
  outside the home book (§4.6); it is no longer a key *in* a home-book file for
  recents (L135). The song-ref sentence (L148) keeps per-song state (§4.5) and
  notes the device-local recents list is keyed by song ref (§4.6), not held in
  the home book.
- **§4.6** — repurpose (do **not** delete, to keep §5–§9 numbering and every
  cross-reference stable; Decision 3): a short section stating recents are kept
  on the device and are not synced (workflow 2; DIRECTION §3.2), in the `meta`
  store the Worker owns (§2.3), outside the home book — never written here,
  pushed or merged — and are not among what comes down to a new device
  (workflow 13).
- **§6.1** — drop the "a recents list (§4.6)" example from the array-order
  bullet (L407); keep the rule and use an ordered opaque value as the example.
- **§7** — rewrite "Per-device state": the home book's per-device state is the
  **local-only-book markers** (§4.2), namespaced by device id so they sync yet
  never collide (keep that rationale and the §5 map-union point). Recents are
  also per-device but are **device-local and not a home-book file** (§4.6):
  never written here, so no cross-device "most recently played" and nothing to
  merge. Remove the "a lost device's recents … are not lost with it" rationale
  for recents (it is reversed; Decision 6).
- **§8** — "the eight files of §2.1" → "the seven files of §2.1" (L467) and
  "any path other than the eight of §2.1" → "… than the seven of §2.1" (L472).
  A home book pushing `recents.json` is then refused as a disallowed path — the
  correct outcome, since the app must never produce it.

In `tasks/refinements/storage/home_book.md` (factual summary only, not its
Decisions/Acceptance/Status): the §2.1 bullet (L205–206) drops `recents.json`;
the §2.3 bullet (L214–218) drops "in `recents.json`" and notes the device-local
recents live outside the home book; the §7 bullet (L244–248) says local-book
markers sync and recents are device-local, not in the home book.

### Tests the task lands with, by level

Per the `.tji` note: **unit**. (The note's "unit (…)" clause is sharpened below
into named cases; one guard already lives at the behavior level where
`songs.search` placed it — Decision 5 — and is held green, not duplicated or
dropped.) Fixtures are purpose-written songs, never anyone's copyrighted words.

- **unit — `app/src/worker/home-book.test.js`** (new case): `SETTINGS_FILES`
  (now exported, frozen — Decision 4) equals exactly
  `['preferences.json', 'shelf.json', 'instruments.json', 'shapes.json',
  'songs.json']` and does **not** include `'recents.json'`. *Pins the removal
  and the amended §2.1.*
- **unit — `app/src/worker/home-book-merge.test.js`** (existing, unchanged,
  held green): the key-by-key register/map merge (greater `at` wins, map union,
  tombstone retention) is file-agnostic and unaffected by dropping
  `recents.json`. *Pins "the key-by-key home-book merge unaffected"
  (home-book-format §5).*
- **unit — `app/src/worker/home-book-canonical.test.js`** (relabelled fixture,
  `:53–67`): canonical form keeps an array's order (§6.1) — the fixture becomes
  an ordered opaque value instead of a recents list; the asserted bytes and the
  rule are unchanged. *Pins §6.1 array-order with no dangling §4.6 reference.*
- **behavior — `app/src/worker/recents.behavior.test.js`** (existing from
  `songs.search`, held green): `RECORD_RECENT` writes the device-local `meta`
  store and makes **no commit** to the home book (asserted against the local git
  remote). *Pins "recording a recent commits nothing to the home book"
  (workflow 2 L17–20) — the guard this task must not regress.*

The closer confirms every named test above ran (not skipped) in the gate's
output, including the three existing tests held green.

### Deferred work

**None.** This task is self-contained: the code change, the format delta and
the refinement-summary reconciliation all land here, with their tests.
`hook.home_book` is an already-planned leaf (`tasks/35-hook.tji:44`) that reads
the amended §8 when it is built — it is not a follow-up this task creates.

## Decisions

1. **Recents are device-local only; the home book never carries them.** This is
   the already-settled direction (workflow 2 L17–20, workflow 13 L35–36,
   DIRECTION §3.2) and the shipped implementation (`songs.search` Decision 2).
   This task finalises it by removing the one contradicting file and its
   specification. *Rejected: keeping `recents.json` synced under a device-id
   namespace (what the format currently says) — it contradicts workflow 2
   (a home-book commit per song-open is exactly what the workflow rules out),
   it is dead code (nothing writes or surfaces it), and `songs.search` already
   chose the `meta` store. Keeping it would also force the unbuilt
   `hook.home_book` to validate a file the app must never push.*
2. **Reconcile by amending the format, not the implementation or the
   direction.** The implementation and three governing documents already agree;
   the format is the lone outlier. So the fix moves the format document (and the
   `home_book` refinement's factual summary of it) to match — editing only the
   summary's Inputs/context bullets, never that refinement's Decisions,
   Acceptance or Status, which stay the historical record of why
   `storage.home_book` existed (completion ritual). *Rejected: "accepting" the
   synced design and reverting `songs.search` — it would reintroduce the
   per-open commit the direction forbids.*
3. **Repurpose §4.6 rather than delete-and-renumber.** Keeping §4.6 as a short
   "recents are device-local" section holds §5–§9 and every `§N` cross-reference
   (in the spec and in `home_book.md`) stable. *Rejected: deleting §4.6 and
   renumbering §5–§9 — it churns every downstream reference for no benefit and
   risks a stale `§N` pointer elsewhere.*
4. **Export `SETTINGS_FILES` (frozen) for a direct unit assertion.** The `.tji`
   note points at the constant by name ("recents.json no longer in
   SETTINGS_FILES"); exporting a `Object.freeze`d array lets the unit test
   assert it directly and guards against accidental mutation. *Rejected:
   keeping it private and asserting only indirectly through a `sync` behavior
   test — the direct constant assertion is the clearest, cheapest pin and is
   what the note asks for; a behavior-only check is indirect and slower.*
5. **Keep the "no home-book commit" pin at the behavior level where it already
   lives.** `recents.behavior.test.js` asserts no commit against a real local
   git remote — the only way to *prove* no commit. This task holds it green
   rather than adding a weaker unit duplicate. The note's "unit" level is not
   dropped (two real unit cases land); a behavior guard is additionally held, as
   the testing policy permits. No legacy `recents.json` exists on any remote to
   migrate — nothing ever wrote one — so there is no compaction/migration case
   to add. *Rejected: a unit-only re-assertion of "no commit" — it cannot
   observe a push and would be strictly weaker than the existing behavior
   test.*
6. **Drop the lost-device recents-recovery rationale.** The old §7 justified
   syncing recents so "a lost device's recents … are not lost with it". That is
   reversed: workflow 13 L52–55 says device-bound state "stays on the device …
   Nothing travels, and nothing pretends to", and L35–36 makes recents
   per-device with no cross-device history. A device's recents are disposable;
   losing them with a lost device is acceptable and matches the direction.
   (Local-only-book markers keep their sync rationale — workflow 13 L45–50 wants
   a new device to list *only on your iPhone* — so §7 retains it for them.)
   *Rejected: preserving recents-recovery by some other synced channel — no
   workflow asks for cross-device recents, and the cost (a commit per song-open)
   is precisely what the direction forbids.*

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- `app/src/worker/home-book.js` — removed `'recents.json'` from `SETTINGS_FILES`; exported the constant frozen (Decision 4).
- `app/src/worker/home-book.test.js` — new unit cases asserting `SETTINGS_FILES` equals exactly five files and excludes `recents.json`.
- `app/src/worker/home-book-canonical.test.js` — relabelled the §6.1 array-order fixture from "recents list" to "ordered opaque value" (bytes and rule unchanged).
- `docs/home-book-format.md` — §2.1 (bullet removed, "six"→"five"), §2.3 (device-id/song-ref), §4.6 (repurposed to "Recents — not a home-book file"), §6.1, §7 (rewritten), §8 ("eight"→"seven", ×2).
- `tasks/refinements/storage/home_book.md` — §2.1/§2.3/§7 summary bullets updated (Inputs/context only; Decisions/Acceptance/Status untouched).
- Tests held green: `home-book-merge.test.js` (unit, 13 tests), `recents.behavior.test.js` (behavior, 3 tests, "no home-book commit").

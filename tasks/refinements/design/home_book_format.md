# Refinement — `design.home_book_format`

## TaskJuggler

- Task: `design.home_book_format` — "The home book's format".
- Defined in [`tasks/20-design.tji`](../../20-design.tji) (lines 34–38).
- `note`: *"Settings as JSON with a time on every key, so 'the later change
  wins' key by key; the shelf list, labels, instruments, rules, my shapes,
  theme, language, variation in use, transpositions. Workflows 8, 13.
  Tests: none — design deliverable (the format decided in a document);
  storage.home_book's tests pin it."*

## Effort estimate

1d (unchanged from the `.tji`). This is a design task: the deliverable is a
written format, not code. The budget covers writing the format document,
retiring the open-decision bullet in DIRECTION §6, and scoping the "nothing
else" rule so the home book fits the constitution.

## Repository

**estante-de-cifras.** The deliverable is a design document plus governing-
document deltas, all in this repository:

- `docs/home-book-format.md` — the new format document (the decided format).
- `docs/DIRECTION.md` — §6 (retire the open bullet), §2.1 and §3.2 (scope
  "nothing else" to songbooks; name the home book as a settings repository).
- `docs/workflows/14-file-view.md` — scope its "what a book may hold" rule to
  songbooks and point at the home book's own allowed kinds.

No `cifra.md:` work. The home book's JSON is **not** a cifra.md format — it is
the app's personal-state format, owned here. Nothing in `/home/ruoso/devel/cifra.md`
changes.

## Inherited dependencies

The `design` parent task `depends bootstrap.workflows` ([`tasks/20-design.tji`](../../20-design.tji)
line 7). `home_book_format` carries no further `depends` of its own.

- **Settled.** `bootstrap.workflows` — the fourteen workflows are decided
  (DIRECTION §7, [`docs/DIRECTION.md`](../../docs/DIRECTION.md) lines 502–526).
  Workflows 1, 8 and 13 already fix the home book's behaviour; this task only
  writes the file format those behaviours imply.
- **Not a dependency (deliberately decoupled).** `design.instruments`
  (workflow 15, a sibling design gap, [`tasks/20-design.tji`](../../20-design.tji)
  lines 9–13) will decide the internal shape of an instrument, a tuning and a
  voicing rule. The home book format treats those values as **opaque**: it
  fixes the keys and the envelope, not the instrument schema. So this task does
  **not** wait on `design.instruments`; see Decisions.

## What this task is

Write down the format of the **home book** — the per-user git repository that
holds personal state (DIRECTION §3.2): the shelf list and its labels, the
user's instruments and voicing rules, *my shapes*, the theme, the language,
the notation dialect, which variation is in use per song, and how far each song
is transposed. The repository syncs like any other, but its files are JSON and
they merge **key by key, the later change winning** (workflow 8), so a user's
preferences never reach a conflict (workflow 9 does not apply to it).

The task decides, concretely enough for `storage.home_book` to implement and
test against: the tracked files and their key namespaces; the per-key
timestamped "registered value" envelope; the merge algorithm, including the
tombstone rule for deletions and the deterministic tie-break when two changes
carry the same time; the canonical form (so two converged devices write
byte-identical files); and how per-device state (recents, local-only books) is
namespaced so it never collides across devices.

## Why it needs to be done

DIRECTION §6 lists the home book's format as an open gap: *"JSON with a time on
every key, so that 'the later change wins' can be done; short, but it needs
writing down"* ([`docs/DIRECTION.md`](../../docs/DIRECTION.md) lines 499–500).
Until it is written down, the downstream work cannot land:

- `storage.home_book` ([`tasks/40-storage.tji`](../../40-storage.tji) lines
  40–44) `depends design.home_book_format` and must implement the key-by-key
  merge; its unit tests (*"the key-by-key merge, the later change winning,
  equal times"*) and behavior test (*"settings changed in two working copies
  merged through the local remote, committed automatically"*) need a decided
  format to pin.
- `account.new_device` (workflow 13), `books.shelf`, `music.instruments`,
  `music.transpose` and `shell.layout` all read state from the home book and
  assume its shape.

## Inputs / context

Governing documents (the `.tji` note names workflows 8 and 13; the fuller set
below is what they and DIRECTION settle):

- **DIRECTION §3.2 Personal state** — [`docs/DIRECTION.md`](../../docs/DIRECTION.md)
  lines 130–138. The enumerated contents and the "a repository like any other
  but committed automatically" framing. *"One mechanism then replaces both a
  backup and setting up each new device."*
- **DIRECTION §3.1 Sync** — lines 121–128. Fetch/merge/push; every git request
  through the one server.
- **DIRECTION §2.1** — lines 57–66. *"Besides songs and setlists, a book holds
  a `README.md` and a `.gitattributes`, and nothing else … every push checked
  by the service for all of it (workflow 14). A book is a songbook, not file
  storage."* This is the rule the home book collides with (see Decisions).
- **DIRECTION §3.3** — lines 162–169. No anonymous read, `noindex`, at most
  fifty people per book — the home book is private to its one account.
- **DIRECTION §3.7 The app** — lines 381–400. *"One owner for the data: a Web
  Worker."* The home book's reading, merging and automatic committing live in
  the Worker; the main thread never touches IndexedDB.
- **DIRECTION §6** — lines 483–500. The open-decision bullet this task retires.
- **Workflow 8 §The home book** — [`docs/workflows/08-sync.md`](../../docs/workflows/08-sync.md)
  lines 72–76: *"Its files are JSON, and they merge key by key; where two
  devices changed the same key, the later change wins, by the time each was
  made. The home book never reaches workflow 9."* **The normative merge spec.**
- **Workflow 13** — [`docs/workflows/13-new-device.md`](../../docs/workflows/13-new-device.md):
  lines 31–37 (the home book comes down first, then the shelf; *"Recents are
  kept per device"*); lines 39–43 (*"The home book holds the list of books on
  the shelf: each one's link, and the user's label for it. Access itself is the
  account's, held by the service, so nothing secret is written down."*); lines
  45–50 (local-only books listed by title: *"only on your iPhone"*); lines
  61–62 (a pre-sign-in device's home book *"merges into the account's key by
  key, as two devices' home books do"*).
- **Workflow 1** — [`docs/workflows/01-first-run.md`](../../docs/workflows/01-first-run.md)
  lines 72–103: the home book *"starts local, with no remote, and gains one
  when the user signs in"*; language (lines 80–84) and theme (lines 86–103,
  including *automatic*) are preferences kept in it.
- **Workflow 14 §What a book may hold / What the service checks** —
  [`docs/workflows/14-file-view.md`](../../docs/workflows/14-file-view.md)
  lines 12–22 and 78–107. The push hook's allowed kinds and canonical checks —
  written entirely for songbooks, with no slot for JSON settings.
- **The consumer's seams** — the Worker today owns only the IndexedDB lifecycle
  and schema `meta`: [`app/src/worker/protocol.js`](../../app/src/worker/protocol.js)
  (open `kind` string; later tasks add kinds without reshaping the envelope),
  [`app/src/worker/reducer.js`](../../app/src/worker/reducer.js) (a slice per
  concern), [`app/src/worker/migrations.js`](../../app/src/worker/migrations.js)
  (a reserved slot for `storage.home_book`'s own step). `git.js`,
  `working_copy.js`, `home_book.js` do not exist yet — `storage.home_book`
  builds them.
- **The API's current stance** — [`tasks/refinements/foundation/api_contract.md`](../foundation/api_contract.md)
  lines 132–136: the home book is *"a git repository like any other … all moved
  over git over HTTP, not bespoke endpoints."* The shelf change-check is the
  only home-book-adjacent endpoint ([`api/openapi.yaml`](../../api/openapi.yaml)
  lines 375–381).
- **Precedent for a format document** — the cifra.md specification
  (`/home/ruoso/devel/cifra.md/spec/`) is the house style for a written data
  format: numbered sections, RFC conformance language, a dependencies note, a
  canonical-form chapter, an open-questions close. DIRECTION §3 carries
  data-shape decisions in prose. This document follows that register, not the
  workflow/mockup register.

## Constraints / requirements

- **The merge is the Worker's, not git's.** The home book never surfaces a
  conflict (workflow 8, line 76). The Worker reads base/ours/theirs JSON and
  computes the merged tree itself, then commits — it does not rely on git's
  line-based text merge for settings files. This must hold for `storage.home_book`.
- **Offline first.** The home book starts local with no remote (workflow 1) and
  gains one on sign-in; everything works before any network. The Worker owns
  git, the working copy and the commit; the main thread never touches IndexedDB
  (DIRECTION §3.7).
- **Canonical form over preserving content.** The home book is always written in
  canonical form: two devices that converge to the same state write
  byte-identical files, so the automatic merge commit is reproducible and a
  push carries no spurious diff. A file holding anything non-canonical is never
  written or pushed. (Project standing rule, applied to settings here as §8/§10
  apply it to songs.)
- **No song text — and no preferences — in logs.** The service and hook log
  request metadata only. The home book carries a person's preferences and the
  links/labels of their books; the hook's home-book validation (follow-up, see
  Acceptance) must not log any of it.
- **Private to one account.** The home book is never shared: no invitations, no
  members beyond the one owner, `noindex` like everything (DIRECTION §3.3). The
  fifty-people sharing machinery does not apply to it.
- **No new runtime dependency.** The format is plain JSON and ISO-8601
  timestamps; the merge is a small pure function. No CRDT library, no new
  package (see Decisions on the merge model).
- **Component boundary.** The app and the service share no code (DIRECTION §3.6);
  the home book moves over the same git-over-HTTP as any book
  ([`api/openapi.yaml`](../../api/openapi.yaml)), not a bespoke settings
  endpoint. The service treats it as a repository; only the hook needs to know
  it validates settings rather than songs (follow-up).

## Acceptance criteria

This is a design task — **no code tests** (the `.tji` `Tests:` clause is *"none
— design deliverable"*). Acceptance is what the document decides and the
governing-document deltas that keep the constitution consistent. `storage.home_book`'s
tests pin the format in code; this document must be concrete enough that those
tests are writable.

**1. `docs/home-book-format.md` exists and decides, in the cifra.md spec
register:**

- **The tracked files and their key namespaces.** A small set of JSON files
  split by concern plus `README.md` and `.gitattributes` (Decisions fix the
  split): `preferences.json` (theme, language, notation — singletons),
  `shelf.json` (book id → label, remote link or local title, position),
  `instruments.json` (the user's instruments and voicing rules, as opaque
  values), `shapes.json` (*my shapes*, keyed by instrument + tuning + chord),
  `songs.json` (per song: transposition, variation-in-use per tuning),
  `recents.json` (per device). Every key in the task note
  ([`tasks/20-design.tji`](../../20-design.tji) line 37) is placed.
- **The registered-value envelope.** Each independently-settable value is
  `{ "value": <JSON value, or null for a tombstone>, "at": "<UTC ISO-8601
  millisecond instant>" }`; `at` is the time the change was made on the device
  that made it. The merge granularity ("key by key") is the leaf register,
  recursively into nested maps. Pins: DIRECTION §6, workflow 8 lines 73–75.
- **The merge algorithm.** Per key present on either side: the greater `at`
  wins; on equal `at`, a deterministic, commutative, associative tie-break
  (compare the canonical JSON serialization of the two values; the greater
  serialization wins) so all devices converge regardless of merge order; a
  tombstone (`value: null`) is a register like any other, so a later unset
  removes a key and an earlier unset loses to a later value; tombstones are
  retained. Pins workflow 8 line 75 and the `storage.home_book` unit case
  *"equal times"*.
- **Canonical form.** Sorted keys, stable ordering, fixed timestamp and number
  formatting, UTF-8, LF, trailing newline — so convergence is byte-identical.
  Pins the standing canonical-form rule and `storage.home_book`'s reproducible
  auto-commit.
- **Per-device state.** Recents and local-only-book markers are namespaced by a
  device id so they sync (a lost device's state is recoverable) yet never
  collide and never provide a cross-device "most recently played" — reconciling
  workflow 4 line 69 (*recents in the home book*) with workflow 13 lines 35–37
  (*recents per device*).
- **The home book's own allowed kinds.** The files above, `README.md` and
  `.gitattributes` — the whitelist the hook enforces for a home book (replacing
  the songbook whitelist), with a dependencies/conformance note and an
  open-questions close in the spec register.

**2. Governing-document deltas (same commit, closer's):**

- `docs/DIRECTION.md` §6: the home-book-format bullet (lines 499–500) retired —
  marked decided and pointed at `docs/home-book-format.md`.
- `docs/DIRECTION.md` §2.1 (and a cross-reference in §3.2): the *"and nothing
  else"* rule (line 64) scoped to **songbooks**, with the home book named as a
  settings repository whose allowed kinds are its own (pointer to the format
  document).
- `docs/workflows/14-file-view.md` §What a book may hold (lines 16–22): the same
  scoping — the rule is a songbook's; the home book has its own kinds.

**3. No mockup board.** The home book is invisible (workflow 8 is "mostly
invisible"); it introduces no new on-screen state. Nothing to draw, so no
`docs/mockups/` board and no `canvas.json` entry. (Decision below.) The screens
that *read* home-book state — the account screen's theme/language, the shelf —
are drawn by their own workflows' boards (1, 7, 13), unchanged by this task.

**4. Deferred follow-up named** (see Decisions → *The home book collides with
the songbook rule*): `hook.home_book` — the service recognizes the home book as
its own repository kind and the hook validates it as settings rather than songs.
Deferred to `hook.home_book` (closer registers in WBS, milestone **M3**).

## Decisions

### A format document, not a workflow document or a board

The design-area convention is a workflow document plus a mockup board (README
"Design tasks"). This task deviates: its `.tji` note says *"the format decided
in a document"*, not *"the workflow document and its board"* like its siblings,
and the home book is invisible to the user (workflow 8). **Chosen:** a
standalone `docs/home-book-format.md` in the cifra.md spec register (numbered
sections, conformance language, canonical-form and open-questions sections),
with DIRECTION §6/§2.1 and workflow 14 deltas. **Rejected:** a 15th workflow
document (no user-facing flow to describe — the behaviour is already workflows
1/8/13) and a mockup board (no screen to draw). Precedent for a written data
format is the cifra.md spec and DIRECTION §3's data-shape prose.

### Last-write-wins per key, with tombstones and a deterministic tie-break

DIRECTION §6 and workflow 8 fix the model: "a time on every key", "the later
change wins, by the time each was made". **Chosen:** a per-key LWW register
keyed on a wall-clock UTC instant, with `null` tombstones so deletions
propagate, and an equal-time tie-break on canonical-value comparison so the
merge is commutative and associative and every device converges regardless of
fetch order. This is a few lines of pure code, no dependency. **Rejected:**
hybrid logical clocks or vector clocks — they would survive clock skew between a
user's own devices, but they impose a clock-reconciliation burden and larger
files for no user-visible benefit on a single-user, few-device preferences
store, and they contradict DIRECTION §6's explicit "a time on every key". The
wall-clock skew risk is accepted and recorded in the document's open questions;
the tie-break guarantees convergence even when two devices' clocks read the same
instant.

### Several files, split by concern

**Chosen:** split the settings across a handful of JSON files
(`preferences`, `shelf`, `instruments`, `shapes`, `songs`, `recents`) rather
than one `home.json`. The unbounded collections (per-song transpositions, per-
chord shapes) stay out of the file that holds the singletons, so a theme change
produces a one-line diff and git history stays legible; the per-key merge is
identical either way (the Worker merges each file's keys). **Rejected:** a
single file — simpler to name but noisier in history and larger to re-serialize
on every preference change.

### Instrument/shape/rule values are opaque to this format

**Chosen:** the home book format fixes the *keys and envelope* for instruments,
voicing rules and *my shapes* but treats their *values* as opaque JSON whose
internal schema `design.instruments` (workflow 15) and the music core own. So
this task does not depend on `design.instruments` and does not pre-decide an
instrument's shape. **Rejected:** designing the instrument/voicing schema here —
it belongs to a separate, as-yet-undesigned gap, and coupling would block a 1d
format task on a 2d instrument design.

### The home book collides with the songbook rule → a design delta plus a follow-up

DIRECTION §2.1 and workflow 14 say a book holds *only* `*.cifra.md`,
`*.setlist.md`, `README.md`, `.gitattributes` and *"nothing else"*, and the
pre-receive hook (`hook.contents`, `hook.canonical`, [`tasks/35-hook.tji`](../../35-hook.tji)
lines 20–31) rejects any other path and holds every song to canonical form.
The home book is *"a repository like any other"* (DIRECTION §3.2;
[`api/openapi.yaml`](../../api/openapi.yaml) over the same git-over-HTTP) but its
files are JSON. As written, a home-book push would be refused. No task today
gives the service a repository kind or tells the hook to validate settings
instead of songs.

**Chosen:** resolve the constitution now (this task's deltas: scope "nothing
else" to songbooks; name the home book's own allowed kinds in the format
document), and defer the *enforcement* to a new task. The home book is tagged as
its own kind in the registry and that kind is passed to the hook through the
`ESTANTE_*` env the service already forwards (`service.git_http`); the hook
applies home-book validation (well-formed canonical settings JSON, the home
book's allowed kinds, song files refused there) instead of the songbook checks.
**Rejected:** (a) making the hook sniff a repo's contents to guess it is a home
book — fragile and spoofable; (b) a bespoke non-git settings endpoint —
contradicts "a repository like any other" and the API contract, and would
duplicate sync. The follow-up must land by **M3** ("sync across one person's
devices" — the home book syncing to the service is part of M3), so it is wired
into M3's `depends`.

**Deferred follow-up for the closer to register:**

- **Task:** `hook.home_book` (area `hook`; note does **not** start with
  `cifra.md:`).
- **Effort:** 2d.
- **Description:** The service tags the account's home book as its own
  repository kind and forwards it to the pre-receive hook; the hook validates a
  home-book push as the home book's allowed kinds in canonical settings form
  (refusing song files and malformed/non-canonical settings), bypassing the
  songbook `hook.contents`/`hook.canonical` checks; no settings content logged.
- **Depends:** `design.home_book_format`, `hook.contents`, `hook.canonical`.
- **Tests:** unit (the settings-JSON validation: well-formed and canonical
  accepted, a song file refused, a malformed or non-canonical settings file
  refused); behavior (Go `httptest` against real git: a home-book push accepted,
  a song pushed to a home book refused, a settings file pushed to a songbook
  refused); e2e-api (isomorphic-git pushes a home book through the compose stack,
  a disallowed push refused — harness `foundation.e2e_api`).
- **Milestone:** M3 (`milestones.m3_service`, [`tasks/99-milestones.tji`](../../99-milestones.tji)
  lines 29–33).

## Open questions

(none — all decided.)

The two matters the implementer records in the format document's own
open-questions section are accepted design limitations, not blockers: wall-clock
skew under LWW (bounded by the equal-time tie-break and acceptable for a single
user's own devices), and tombstone pruning (retained for now; a future
compaction is an optimization, not required for correctness). Neither is a WBS
task.

## Status

**Done** — 2026-10-05.

- Created `docs/home-book-format.md`: the decided format in the cifra.md spec
  register — scope and conformance (§1), the eight tracked files and their key
  namespaces (§2–§4), the per-key registered-value envelope (§3), the LWW merge
  with tombstones and equal-time tie-break (§5), canonical form with sorted keys
  and fixed serialisation (§6), per-device namespacing for recents and local
  books (§7), allowed kinds and validation rules for `hook.home_book` (§8), and
  conformance summary with open questions.
- Edited `docs/DIRECTION.md`: §6 home-book-format bullet retired (marked decided,
  pointer to `docs/home-book-format.md`); §2.1 "and nothing else" scoped to
  songbooks; §3.2 names the home book as a settings repository pointing at the
  format doc.
- Edited `docs/workflows/14-file-view.md`: §What a book may hold scoped to
  songbooks, pointing at the home book's own kinds in `docs/home-book-format.md`.
- Tech-debt `hook.home_book` registered in `tasks/35-hook.tji`, wired to M3.
- No cifra.md changes (correctly; the home book is the app's format, not a
  cifra.md format).

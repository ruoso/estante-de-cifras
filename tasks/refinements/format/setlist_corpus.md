# format.setlist_corpus — Setlists in the canonical corpus

## TaskJuggler entry

`task setlist_corpus` in [`tasks/05-format.tji`](../../05-format.tji) (lines
34–39), under `task format`. One line there: *"Setlists in the canonical
corpus."*

## Effort estimate

**1 day** (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), two directories:

- `corpus/` — the new setlist **reading** entries (hand-written
  `input.setlist.md` plus the generated outputs).
- `reference/` — the harness extension in `reference/tools/corpus.py` and
  its pytest in `reference/tests/`, and any fix the new fixtures surface in
  `reference/cifra_md/setlist.py`.

Two completion-time documentation edits land in the **same closer commit**
(§Decisions): the closed gap in **estante-de-cifras**
[`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §6, and the closed clause
in **cifra.md** `spec/10-setlists.md` *Open questions*. These are housekeeping
that record the gap closing, not a design change — no delta is authored ahead
of implementation.

## Inherited dependencies

- **`format.setlists` — settled.** Complete (`complete 100`,
  [`tasks/05-format.tji`](../../05-format.tji) lines 20–26): the reference
  reads and writes setlists (`reference/cifra_md/setlist.py`:
  `parse_setlist` at line 222, `write_setlist` at line 367,
  `canonicalise_setlist` at line 396) against spec chapter 10, and the merge
  corpus already holds setlists. No refinement document was written for
  `format.setlists` (it predates this refinements directory — only
  [`tasks/refinements/README.md`](../README.md) exists here so far), so this
  refinement cites the spec chapter and the reference directly rather than a
  predecessor refinement.

Not a dependency, but a sibling to keep in view: **`format.setlist_schema`**
([`tasks/05-format.tji`](../../05-format.tji) lines 40–45), also
`depends !setlists`, scopes the JSON Schema for the setlist model (§10.6).
The two are independent and may land in either order (§Decisions, *Schema
stays with its own task*).

## What this task is

The reference corpus has two kinds of entry: **reading** entries at the top
of `corpus/`, which pin the reader and the canonical writer, and **merge**
entries under `corpus/merge/`, which pin the merge
([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
lines 1–54). Setlists today appear only in the merge corpus
(`corpus/merge/60`–`68`, and `24`/`25`); there is **no reading entry for a
setlist**. This task adds the missing setlist reading entries — hand-written
`input.setlist.md` fixtures and the four files generated from each — so the
setlist reader and canonical writer (spec §10.6, §10.9) are pinned the way
the song reader and writer already are by `corpus/01`–`34`.

Because the corpus harness is wired for song reading entries only — both
`reference/tools/corpus.py` `entries()` (line 44) and
`reference/tests/test_corpus.py` (line 14) discover a reading entry by the
presence of `input.cifra.md`, and both run the song `parse`/`write` — the
task also extends the harness to discover and generate setlist reading
entries (`input.setlist.md`, parsed with `parse_setlist`, written with
`write_setlist`, canonical text `canonical.setlist.md`), mirroring the
`extension()` seam the merge side already uses (`corpus.py` line 53).

## Why it needs to be done

DIRECTION states the principle: *"Implementations agree because they are
checked, not because they are shared … The corpus holds, for every entry,
the input, its model, the canonical text and the canonical model, and each
implementation must reproduce all four byte for byte, in both directions"*
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6, lines 280–287).
DIRECTION §6 (lines 489–491) names the open gap in plain terms: *"Setlists
in the canonical corpus: the reference reads and writes them and the merge
corpus has setlists, but the canonical corpus has no setlist entries for
implementations to agree on."* `spec/9-conformance.md` (§9.3, lines 136–137)
records the same: *"The corpus has no entries for reading setlists yet."*

The downstream consumers are the JavaScript and Go setlist readers/writers
(`cifra_js.conformance`, `cifra_go.conformance`) and the cross-implementation
comparison (`format.cross_check`, which `depends !setlist_corpus`): all three
implementations are held to this corpus byte for byte, in both directions. A
Setlist reader / Setlist writer profile (`spec/9-conformance.md` §9.1, lines
79–107) has nothing to validate itself against until these entries exist.

## Inputs / context

- [`tasks/05-format.tji`](../../05-format.tji) lines 34–39 — the task, its
  `note`, and the `Tests:` clause (unit + corpus).
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 (lines 280–287) and
  §6 (lines 489–491) — the agreement principle and the named gap.
- `cifra.md/spec/10-setlists.md` (688 lines) — the normative setlist
  definition. The sections this corpus must pin:
  - §10.2 Text (line 52), §10.3 Structure (line 66): title (§10.3.1 line
    102), items (§10.3.2 line 126), entries under an item (§10.3.3 line
    149), notes (§10.3.4 line 163).
  - §10.4 Links (line 183), §10.4.1 the text (line 210); §10.5 Paths (line
    232).
  - **§10.6 The model (line 279; model block lines 285–305)** — what reading
    produces; still prose, no JSON Schema yet.
  - §10.7 Properties of an item (line 312): §10.7.1 the key (line 326),
    §10.7.2 the note (line 356).
  - **§10.9 Canonical form (line 420)** — §10.9.1 the text (line 444),
    §10.9.2 the lines (line 459), §10.9.3 link text not refreshed (line 546),
    §10.9.4 example (line 563).
  - *Open questions* (lines 667–687) — records that the setlist JSON Schema
    and the setlist reading corpus do not exist yet.
- `cifra.md/spec/9-conformance.md` §9.1 (lines 79–107, Setlist reader /
  Setlist writer profiles), §9.3 (lines 127–137, the test corpus).
- [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 7–54 — the four files of a reading entry and the five checks; lines
  45–48 — the sixth (model-level canonicalisation) check and that the
  reference's checks are `reference/tests/test_corpus.py`.
- `reference/tools/corpus.py` — `entries()` (line 44, discovers by
  `input.cifra.md`), `extension()` (line 53, the merge `.setlist.md` seam),
  `generate()` (line 94, hardcodes `input.cifra.md` + song `parse`/`write`),
  `main()` `--write`/`--check` (lines 105–140).
- `reference/tests/test_corpus.py` — the six parametrised checks (lines
  29–61), all over song entries discovered at line 14, schema check at line
  51 against the song `SCHEMA`.
- `reference/cifra_md/setlist.py` — `parse_setlist` (222), `write_setlist`
  (367), `canonicalise_setlist` (396), `song_path`/`write_path` (126/179,
  the §10.5/§10.9.2 path decode and percent-encoding).

## Constraints / requirements

- **The four files, generated not hand-edited.** Each reading entry is a
  directory holding a hand-written `input.setlist.md` and three generated
  files — `input.parsed.json` (the model of the input),
  `canonical.setlist.md` (the canonical text), `parsed.json` (the model of
  the canonical text) — named exactly as the song entries' four files but
  with the `.setlist.md` extension on the texts
  ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 7–14). Generated files are produced by `python -m tools.corpus
  --write` in `reference/` and reviewed before committing, never written by
  hand.
- **Both directions is the point.** The entries must pass checks 1–4
  ([`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 27–34): read `input.setlist.md` → `input.parsed.json`; write that
  model → `canonical.setlist.md`; read `canonical.setlist.md` → `parsed.json`;
  write that model → `canonical.setlist.md`. Checks 3 and 4 together close
  the text→model→text cycle, making the canonical form a fixed point.
- **Canonical form depends on the setlist text alone.** Per spec §10.9 a
  setlist's canonical form is decided from its own text without opening any
  song it links; §10.9.3 is explicit that link text is **not** refreshed to
  a song's current title. So a reading entry needs **no referenced song
  files** — the model and canonical text it pins are a function of
  `input.setlist.md` only. Entries must not depend on resolution (§10.8),
  which is not part of what reading produces (§10.6).
- **Reuse the existing seam.** Extend the harness the way the merge side is
  already written: an extension-aware discovery (`input.setlist.md` →
  `parse_setlist`/`write_setlist`), not a parallel tool. Song reading
  entries' discovery and output must be unchanged.
- **Standing rules that apply.**
  - *Canonical form over preserving content* (cifra.md §8, §10.9): the
    entries pin exactly this — the canonical text keeps what the setlist
    says while fixing only its spelling (numbering, markers, whitespace,
    encoding, order). Fixtures include non-canonical input precisely so the
    difference between `input.parsed.json` and `parsed.json` is the change.
  - *Implementations agree because they are checked, not shared* (DIRECTION
    §3.6): these entries are the check for JavaScript and Go; this task does
    not and must not make one implementation copy another.
  - *Test fixtures use songs written for the purpose* — the link text and
    titles in the fixtures are invented songs, never anyone else's words.
- **Out of scope: schema validation of the setlist model.** The setlist
  model has no JSON Schema (§10.6 is prose; §10 *Open questions*). The
  harness must run checks 1–4 (and the model-level canonicalisation check)
  over setlist entries **without** applying the song schema
  (`schema/cifra.schema.json`, `test_corpus.py` line 51) to a setlist model.
  The setlist schema and its corpus validation are the sibling task
  `format.setlist_schema` (§Decisions).

## Acceptance criteria

**Behaviour delivered.** `corpus/` gains a set of setlist reading entries,
each a directory with `input.setlist.md` and the three generated files, that
pin the setlist reader (§10.6) and canonical writer (§10.9) in both
directions; `python -m tools.corpus --write` generates them and
`python -m tools.corpus --check` is green over them, alongside the existing
song and merge entries. At minimum the entries pin:

1. a minimal setlist — a title and a few song-link items (§10.3, §10.4);
2. the empty setlist — the zero-byte canonical file (§10.9.1);
3. a title-only setlist, and a setlist with no title named by file alone
   (§10.3.1);
4. properties under the title — recognised and unrecognised, key case,
   order kept, a repeated key losing its earlier value (§10.3.1, §10.6,
   §10.9.2);
5. non-canonical items — `)` markers, arbitrary and out-of-order numbers,
   extra leading spaces — renumbered `1.`, `2.`, `3.` (§10.3.2, §10.9.2);
6. unlinked items — plain text, a link with a title, a reference link, an
   image — kept, reported, renumbered, counted (§10.3.2, §10.4);
7. item properties — `key` and `note` and an application-defined key, in
   canonical `key`-then-`note`-then-rest order under the item (§10.7,
   §10.9.2);
8. a song played twice — two items with the same target, each with its own
   entries (§10.8.2);
9. notes blocks splitting item runs, with numbering continuing across runs
   (§10.3.4, §10.9.2);
10. path spelling — percent-encoding of the canonical path set, non-ASCII
    kept raw, dot-segments removed, a relative target (§10.5, §10.9.2);
11. link text preserved and not refreshed, with escapes/special characters
    (§10.4.1, §10.9.3);
12. text-layer quirks in a setlist — CR/CRLF line ends, tabs, a U+FEFF,
    trailing spaces, non-NFC input — normalised in the canonical text
    (§10.2, §10.9.1).

(The exact entry list and numbering — `NN-setlist-…`, continuing after
`34-pushed-words` — is finalised by the implementer after `--write` and
review; the above is the floor of §10 behaviours the corpus must cover.)

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names
unit + corpus; §Testing policy of the brief: format work's
behaviour/conformance level **is** the corpus, so there are no behavior,
e2e-api or e2e-web levels — see §Decisions):

- **corpus** — the setlist reading entries pass `python -m tools.corpus
  --check` in both directions (checks 1–4,
  [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
  lines 27–34). This is the format conformance level; the check runs in
  `scripts/gate`.
- **unit (pytest)** — `reference/tests/test_setlist_corpus.py` (new): the
  reading-corpus checks over every `input.setlist.md` entry — read→input
  model, input model→canonical text, canonical text→canonical model,
  canonical model→canonical text (fixed point), and the model-level
  canonicalisation check (`test_corpus.py` line 56, check 6) — using
  `parse_setlist`/`write_setlist`, and **not** the song schema. Pins §10.6
  and §10.9 against the new entries.
- **unit (pytest)** — any reader or writer fix the new fixtures surface is
  landed with its case in `reference/tests/test_setlists.py` (the §10 unit
  tests). A fixture that reveals a `parse_setlist`/`write_setlist` gap is
  fixed here, in this task — never deferred.

The harness extension in `reference/tools/corpus.py` (setlist reading-entry
discovery and generation) is exercised by `test_setlist_corpus.py` above; its
correctness is observable there and through `--check`.

No follow-up work is deferred by this task.

## Decisions

- **Reading entries, not more merge entries.** The merge corpus already
  covers setlists (`corpus/merge/24`, `25`, `60`–`68`); the gap DIRECTION §6
  and §9.3 name is the *reading* corpus — the reader-and-canonical-writer
  fixed point. This task adds exactly that. *Alternative rejected:* treating
  the existing merge entries as sufficient — they pin the merge, not reading
  and canonicalisation in both directions, which is a different conformance
  surface (Setlist reader / Setlist writer profiles, §9.1).

- **Extend the existing harness by extension, not a new tool.** The merge
  side already branches on `.setlist.md` via `extension()` (`corpus.py` line
  53). The reading side gains the same kind of extension-aware discovery and
  generation (`input.setlist.md` → `parse_setlist`/`write_setlist` →
  `canonical.setlist.md`), and `test_setlist_corpus.py` mirrors
  `test_corpus.py`. *Alternative rejected:* a standalone setlist-corpus tool
  — it would duplicate `--write`/`--check` and drift from the song path;
  reusing the seam is the simpler abstraction the codebase already
  established.

- **Schema stays with its own task.** `format.setlist_schema` owns the
  JSON Schema for the §10.6 model and the validation that wires it into the
  corpus check. This task therefore runs the round-trip and
  model-canonicalisation checks over setlist entries but does **not** apply
  the song schema (`cifra.schema.json`) to a setlist model, and does not
  invent a setlist schema. The two tasks are independent: if `setlist_corpus`
  lands first, the entries exist and no setlist-schema validation runs yet;
  if `setlist_schema` lands first, it has no setlist entries to validate
  until these arrive — either order keeps `scripts/gate` green. *Alternative
  rejected:* folding the schema into this task — it is a separately-estimated
  1d WBS leaf with its own `Tests:` clause; merging them would double the
  scope and leave the WBS shape wrong (the orchestrator/closer own `.tji`).

- **Fixtures carry no referenced song files.** Because §10.9 decides a
  setlist's canonical form from its text alone and §10.9.3 does not refresh
  link text, a reading entry's model and canonical text are a pure function
  of `input.setlist.md`; adding resolvable song files would pin nothing
  reading produces (§10.6/§10.8 separation) and would couple entries to a
  book layout the corpus does not model. *Alternative rejected:* shipping a
  tiny book of songs beside each entry — unnecessary and misleading about
  what the reading corpus checks.

- **The documentation edits ride with the task, authored at
  implementation.** Landing these entries closes the DIRECTION §6 bullet
  (lines 489–491) and the reading-corpus clause of `spec/10-setlists.md`
  *Open questions* (the JSON-schema clause stays, owned by
  `format.setlist_schema`). These are completion-time housekeeping that
  record a closed gap, not a design change creating a new decision, so no
  design delta is authored ahead of implementation; the closer makes the two
  prose edits in the same commit as the entries. *Alternative rejected:*
  pre-editing DIRECTION/spec now — the refinement is written ahead of the
  work, and the constitution should not claim a gap closed before the entries
  exist.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-04.

- cifra.md `a37c2f5`: 13 setlist reading entries `corpus/35-setlist-minimal/` through `corpus/47-setlist-text-layer/`, each with a hand-written `input.setlist.md` and the three generated files (`input.parsed.json`, `canonical.setlist.md`, `parsed.json`), covering the full §10 floor (minimal, empty, title-only, no-title, title properties, renumbering, unlinked items, item properties, song-twice, notes blocks, paths, link text, text-layer quirks).
- cifra.md `a37c2f5`: `reference/tools/corpus.py` extended to discover and generate setlist reading entries via `input.setlist.md`, reusing the `extension()` seam.
- cifra.md `a37c2f5`: `reference/tests/test_setlist_corpus.py` (new) — checks 1–4 plus model-level canonicalisation (check 6) over every `input.setlist.md`, without the song schema.
- cifra.md `a37c2f5`: `corpus/README.md` updated to document setlist reading entries.
- cifra.md `a37c2f5`: `spec/10-setlists.md` Open questions — reading-corpus clause removed; JSON-schema clause remains (owned by `format.setlist_schema`).
- estante-de-cifras: `docs/DIRECTION.md` §6 — "Setlists in the canonical corpus" bullet removed (gap now closed).

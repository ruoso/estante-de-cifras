# format.conflicts_schema — JSON Schema for conflicts.json

## TaskJuggler entry

`task conflicts_schema` in [`tasks/05-format.tji`](../../05-format.tji) (lines
47–52), under `task format`. One line there: *"JSON Schema for
conflicts.json."*

## Effort estimate

**1 day** (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), two directories:

- `schema/` — the new `schema/conflicts.schema.json`, the second schema
  file in the repository (the first, `schema/cifra.schema.json`, is the
  parsed-document model).
- `reference/` — the pytest wiring: the schema loaded in
  `reference/tests/conftest.py` beside the song `SCHEMA`, the corpus-level
  validation added to `reference/tests/test_merge_corpus.py`, and the
  malformed-rejection unit test in a new
  `reference/tests/test_conflicts_schema.py`.

Two completion-time documentation edits land in the **same closer commit**
(§Decisions): the merge-entry schema check in **cifra.md**
[`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md)
(the reading-entry check 5 is song-model only today), and the closed clause
in **cifra.md** `spec/11-merge.md` *Open questions* (lines 2453–2454). These
record the gap closing, not a change to the format — no design delta is
authored ahead of implementation (§Decisions, *The documentation edits ride
with the task*).

## Inherited dependencies

- **`format.merge` — settled.** Complete (`complete 100`,
  [`tasks/05-format.tji`](../../05-format.tji) lines 27–33): the reference
  merges and writes the conflicts as JSON
  (`reference/cifra_md/merge.py`: `MEMBERS` at lines 354–357,
  `conflict_json` at line 360, `conflicts_json` at line 364), and the merge
  corpus already holds 33 `conflicts.json` files across `corpus/merge/`
  against spec chapter 11. No refinement document was written for
  `format.merge` (it predates this refinements directory — the only format
  refinement on disk is [`setlist_corpus.md`](setlist_corpus.md)), so this
  refinement cites the spec chapter and the reference directly rather than a
  predecessor refinement.

Not a dependency, but a sibling to keep in view:
**`format.setlist_schema`** ([`tasks/05-format.tji`](../../05-format.tji)
lines 41–46) scopes the parallel JSON Schema for the setlist *model*
(§10.6). The two are the same kind of work — a second schema file beside
`cifra.schema.json`, wired into pytest validation — and may land in either
order; this refinement sets the house conventions (§Decisions, *Follow the
song-schema conventions*) that `format.setlist_schema` should match.

## What this task is

A merge whose outcome has conflicts writes them as a JSON object —
`conflicts.json` in the merge corpus, `%A`-adjacent output for a driver.
Spec §11.12.5 ("As JSON", `spec/11-merge.md` lines 1078–1110) describes its
shape normatively in prose and a table: a root object with one member
`conflicts`, an array of per-conflict objects, each carrying a fixed,
ordered set of members that varies by the conflict's `kind`. The parsed
document model has a JSON Schema (`schema/cifra.schema.json`);
`conflicts.json` does not, and chapter 11's *Open questions* names the gap:
*"A JSON Schema for `conflicts.json`, as there is for the document model.
Until it exists, §11.12 is the normative description"* (lines 2453–2454).

This task writes that schema — `schema/conflicts.schema.json`, following the
`cifra.schema.json` conventions — formalizing §11.12.5, and wires it into
the reference's test suite so every `conflicts.json` in `corpus/merge/`
validates against it and a malformed one is rejected. `schema/cifra.schema.json`
is untouched; the merge is untouched (it already produces the JSON this
schema describes); only the new schema and its test wiring are added.

## Why it needs to be done

DIRECTION states the principle: *"Implementations agree because they are
checked, not because they are shared … The corpus holds, for every entry,
the input, its model, the canonical text and the canonical model, and each
implementation must reproduce all four byte for byte, in both directions"*
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6, lines 280–287). The
song model gained its schema so that an implementation's parsed JSON is
checked structurally, not only byte-compared; `conflicts.json` — the one
merge output that is a model, not canonical text — has had none, so chapter
11's *Open questions* has carried the gap explicitly since the merge landed.

The downstream consumers are the JavaScript and Go mergers
(`cifra_js.merge`, `cifra_go.merge` / their conformance tasks): each
produces `conflicts.json` and is held to the merge corpus byte for byte; a
published schema gives each implementation an independent structural check
of its merge output and pins §11.12.5 as something testable, not only
readable. Closing the chapter 11 open question is the format reaching its
documented conformance surface for merge output.

## Inputs / context

- [`tasks/05-format.tji`](../../05-format.tji) lines 47–52 — the task, its
  `note`, and the `Tests:` clause (unit + corpus).
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 (lines 280–287) —
  the agreement principle (checked, not shared).
- `cifra.md/spec/11-merge.md` — the normative merge definition. The sections
  this schema formalizes:
  - **§11.12.5 "As JSON" (lines 1078–1110)** — the root shape (one member
    `conflicts`, an array, in region order, a `file` conflict first), the
    member table with its *Present* column (which members each `kind`
    carries), and the serialization (two-space indent, non-ASCII as itself,
    final newline). The clause *"these members, in this order, and no
    others"* (line 1084) is `additionalProperties: false`; *"A `file`
    conflict and an `unresolved` conflict are each the only conflict of
    their merge"* (lines 1082–1083) is the one cross-item constraint.
  - §11.12.1 "The conflict model" (lines 925–976) — the abstract
    `Outcome`/`Conflict` shape and the full `kind` table for songs
    (`file`, `unresolved`, `title`, `property`, `reading`, `heading`,
    `chart`, `sections`, `voicing`, `variation`, `block`, `block-notes`).
  - §11.13 "Setlists" (lines 1112–1219) — the setlist `kind`s (`title`,
    `property`, `item`, `text`, `entry`, `notes`) and their extra members:
    `item` (the reference), `occurrence` (an integer, only when > 1), `after`
    (the item a `notes` block follows, omitted when first), `key` (on
    `entry`). Lines 1212–1219 give the setlist JSON shape.
  - *Open questions* (lines 2453–2454) — the clause this task closes.
- `cifra.md/reference/cifra_md/merge.py` — the producer, authoritative for
  the member set and order: `MEMBERS` tuple (lines 354–357) — `kind`,
  `line`, `deleted`, `unreadable`, `item`, `occurrence`, `after`, `tuning`,
  `variation`, `key`, `changed`, `symbols`, `base`, `ours`, `theirs`;
  `conflict_json` (line 360) emits `{k: c[k] for k in MEMBERS if k in c and
  c[k] is not None}` (members absent/None omitted, MEMBERS order);
  `conflicts_json` (line 364) wraps the array and serializes with
  `indent=2, ensure_ascii=False` plus a final newline.
- `cifra.md/schema/cifra.schema.json` — the house template: `"$schema":
  "https://json-schema.org/draft/2020-12/schema"` (line 2), `"$id":
  "https://github.com/ruoso/cifra.md/schema/cifra.schema.json"` (line 3),
  top-level `title` + `description`, `additionalProperties: false`, `$defs`
  with `$ref: "#/$defs/…"`, and per-field `description` strings citing spec
  sections (e.g. "(§1.4.2)").
- `cifra.md/reference/tests/conftest.py` — `SCHEMA = json.loads((ROOT /
  "schema" / "cifra.schema.json").read_text())` (line 11) and the `schema`
  fixture (lines 14–16): the seam to add a `conflicts_schema` beside it.
- `cifra.md/reference/tests/test_corpus.py` — `import jsonschema` (line 5),
  `test_5_models_are_valid_against_the_schema` (lines 49–52):
  `jsonschema.validate(model(entry, name), SCHEMA)`. The pattern the
  merge-corpus validation mirrors.
- `cifra.md/reference/tests/test_merge_corpus.py` — the merge-corpus pytest:
  `ENTRIES = merge_entries()` (line 15), parametrized checks per entry
  (`test_1`…, lines 37–104), and already a per-entry `conflicts.json` check
  (`test_conflicts_json_is_written_as_the_corpus_writes_json`, lines
  100–104, guarded by `if path.exists()`). The new schema check is its
  sibling.
- [`corpus/README.md`](file:///home/ruoso/devel/cifra.md/corpus/README.md) —
  the reading-entry schema check (check 5) is song-model only; the
  merge-entry section (from line 108) lists `conflicts.json` as "The
  conflicts (§11.12.5), when there are any" with no schema check yet.

## Constraints / requirements

- **Formalize §11.12.5, do not redesign it.** The schema describes exactly
  the shape §11.12.5's table defines: root object with the single required
  member `conflicts` (an array); each conflict an object with `kind`
  required and the members the table allows, `additionalProperties: false`
  at both levels. The member *value types* are pinned (below); the schema is
  a second opinion on existing normative prose, not a new rule.
- **Follow the song-schema conventions.** Draft 2020-12; `"$id":
  "https://github.com/ruoso/cifra.md/schema/conflicts.schema.json"`;
  top-level `title` ("cifra.md merge conflicts") and `description`;
  `additionalProperties: false`; `$defs` with `$ref` for the shared value
  types (the `kind` enum, the side value, the `ours`/`theirs` enum);
  per-member `description` strings citing the §11.12.5 member rows.
- **Pin the member value types, per the table.**
  - `kind` — an enum of the sixteen kinds (§11.12.1 song kinds + §11.13
    setlist kinds): `file`, `unresolved`, `title`, `property`, `reading`,
    `heading`, `chart`, `sections`, `voicing`, `variation`, `block`,
    `block-notes`, `item`, `text`, `entry`, `notes`.
  - `line`, `occurrence` — integers; `line` ≥ 1, `occurrence` ≥ 2 (it is
    present only when the occurrence is more than 1, §11.13).
  - `deleted`, `changed` — the enum `"ours"` | `"theirs"`.
  - `unreadable` — an array of the enum `"base"` | `"ours"` | `"theirs"`.
  - `symbols` — an array of strings.
  - `item`, `after`, `tuning`, `variation`, `key` — strings (`variation`
    allows `""`, the default variant).
  - `base`, `ours`, `theirs` — a string, **or** an array of strings (a run),
    **or** an integer (only for `unresolved`, a 1-based line number).
- **Pin which kind carries which members, as far as a schema statically
  can** (§Decisions, *Pin the kinds, not the side presence*): the schema
  constrains, per `kind`, the members required and the members forbidden,
  and the side value type (scalar string for `title`/`heading`/`property`/
  `reading`/`voicing`/`variation`/`block`/`item`/`text`/`entry`/`notes`; an
  array-of-strings run for `chart`/`sections`/`block-notes`; an integer for
  `unresolved`). It does **not** require `base`/`ours`/`theirs` presence — a
  deleted-against-changed conflict omits the deleted side (§11.12.5, *"each
  when the thing is present on that side"*), so all three sides are optional.
- **The one cross-item constraint, if it encodes cleanly.** §11.12.5: a
  `file` or `unresolved` conflict is the only conflict of its merge. Where
  draft 2020-12 can express it without contortion (an array that `contains`
  a `file`/`unresolved` item has `maxItems: 1`), the schema should; if it
  does not encode cleanly, it is left to §11.12.5 prose and the corpus (which
  holds such single-conflict entries) rather than forced — note the choice
  in the schema.
- **Validation lives in pytest, not the corpus tool.** `reference/tools/corpus.py`
  byte-compares; it does not run schema validation (the song schema is
  validated only in `test_corpus.py`). This task mirrors that: no change to
  `corpus.py`; the schema is loaded in `conftest.py` and validated in the
  test suite. `--write` and `--check` outputs are unchanged.
- **Standing rules that apply.**
  - *Implementations agree because they are checked, not shared* (DIRECTION
    §3.6): the schema is a published artifact the JavaScript and Go mergers
    validate their own output against; this task does not make one
    implementation copy another.
  - *Test fixtures use songs written for the purpose* — the malformed and
    valid hand-written fixtures in the unit test invent any song/setlist
    content, never anyone else's words.
- **Out of scope.** The setlist *model* schema (`format.setlist_schema`) and
  the song schema (unchanged). No change to the merge, the marked text, or
  the serialization — only a schema over the JSON the merge already writes.

## Acceptance criteria

**Behaviour delivered.** `schema/conflicts.schema.json` exists — draft
2020-12, the house conventions, formalizing §11.12.5 — and every
`conflicts.json` in `corpus/merge/` validates against it, while a malformed
`conflicts.json` is rejected. The chapter 11 open question is closed:
§11.12.5 remains the normative prose, and the schema is the published
formalization the corpus and the other implementations check against.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names
unit + corpus; §Testing policy of the brief: format work's
behaviour/conformance level **is** the corpus, so there are no behavior,
e2e-api or e2e-web levels — see §Decisions):

- **corpus** — a new per-entry check in
  `reference/tests/test_merge_corpus.py`
  (`test_conflicts_json_validates_against_the_schema`), parametrized over
  `ENTRIES`, guarded `if (entry / "conflicts.json").exists()`, calling
  `jsonschema.validate(json.loads(path.read_text()), CONFLICTS_SCHEMA)`.
  Every one of the ~33 `conflicts.json` files across `corpus/merge/`
  validates — this is the merge-corpus conformance check the `.tji` names,
  and it runs in `scripts/gate`. It pins §11.12.5 against the real merge
  output, covering every observed shape: `chart`/`sections`/`block-notes`
  runs (arrays, including an empty `[]` side), scalar-side kinds
  (`title`/`heading`/`property`/`voicing`/`variation`/`block`/`reading` and
  the setlist `item`/`text`/`entry`/`notes`), `file`
  (`deleted`/`unreadable`), `unresolved` (integer sides, no `line`), the
  two-conflict entry (`corpus/merge/63`), and `occurrence` > 1
  (`corpus/merge/68`).
- **unit (pytest)** — `reference/tests/test_conflicts_schema.py` (new),
  validating against the schema loaded in `conftest.py` (`CONFLICTS_SCHEMA`,
  beside `SCHEMA`):
  - a positive sanity: a hand-written minimal valid `{"conflicts": […]}`
    validates;
  - a malformed one is rejected (`jsonschema.ValidationError`) for each case
    in this floor — unknown `kind`; missing `kind`; an unknown member (top
    level or in a conflict); `deleted`/`changed` not `"ours"`/`"theirs"`;
    `unreadable` with a bad side; `line`/`occurrence` not a positive integer
    (0, negative, string); a member on the wrong kind (`symbols` on a
    `title`, `line` on a `file`, `tuning` on a `property`); a side of the
    wrong type for its kind (an integer side on a `chart`, a string side on
    an `unresolved`); a root that is not `{conflicts: array}`.
  This pins the §11.12.5 member table structurally.
- **unit (pytest)** — `conftest.py` loads `CONFLICTS_SCHEMA` (and exposes a
  `conflicts_schema` fixture, mirroring `schema`); its correctness is
  exercised by both tests above.

No follow-up work is deferred by this task.

## Decisions

- **Follow the song-schema conventions.** `schema/conflicts.schema.json`
  uses the same dialect and shape as `schema/cifra.schema.json`: draft
  2020-12, a GitHub `$id`, top-level `title`/`description`,
  `additionalProperties: false`, `$defs` + `$ref`, and `description` strings
  citing §11.12.5. *Alternative rejected:* a newer/older draft or a
  bespoke layout — a second schema should read like the first so the two are
  maintained as one family; `format.setlist_schema` inherits the same
  conventions.

- **Pin the kinds, not the side presence.** The schema encodes §11.12.5's
  *Present* column as far as a schema statically can: per `kind`, the members
  required and forbidden, and the value type of `base`/`ours`/`theirs`
  (scalar string, run array, or `unresolved`'s integer). It does **not**
  require the sides to be present, because §11.12.5 omits a side when the
  thing is absent there (a property deleted on one side and changed on the
  other carries only two of base/ours/theirs, e.g. `corpus/merge/48`). A
  discriminated `oneOf` on `kind` or an `allOf` of `if`/`then` branches both
  express this; the implementer chooses the cleaner encoding. *Alternative
  rejected:* a *loose* schema — every member optional and merely typed, no
  per-kind constraints — it is simpler but would accept conflicts §11.12.5
  forbids (a `symbols` on a `title`, a `line` on a `file`), so it would not
  actually pin the table and would miss the reference bug a misplaced member
  is; the open question asked for the formalization, not a type stub.
  *Alternative also rejected:* requiring all three sides per kind — it would
  reject the legitimate deleted-vs-changed entries already in the corpus.

- **The cross-item "sole conflict" rule is best-effort, prose-backed.**
  §11.12.5's *"a `file`/`unresolved` conflict is the only conflict of its
  merge"* is a constraint across array items; the schema expresses it
  (`contains` a `file`/`unresolved` → `maxItems: 1`) only if that encodes
  without contortion. Where it does not, §11.12.5 prose and the merge corpus
  (which holds these single-conflict entries) remain the check — the schema
  is a formalization of the per-object shape, not a merge validator.
  *Alternative rejected:* forcing a convoluted cross-item construct that
  future readers can't maintain — the cost outweighs the single invariant it
  would add over the corpus.

- **Validation stays in pytest; `corpus.py` is untouched.** The song schema
  is validated only in `test_corpus.py` (`jsonschema.validate`), not in the
  `--write`/`--check` tool, which byte-compares. This task mirrors that: the
  schema is loaded in `conftest.py` and validated in `test_merge_corpus.py`
  and `test_conflicts_schema.py`; `corpus.py` does not change. *Alternative
  rejected:* adding schema validation inside `corpus.py --check` — it would
  diverge from the song path and conflate byte-reproduction (what the corpus
  tool checks) with structural validity (what the schema checks); keeping
  them separate matches the established seam.

- **The documentation edits ride with the task, authored at
  implementation.** Landing the schema closes the chapter 11 *Open questions*
  bullet (`spec/11-merge.md` lines 2453–2454): §11.12.5 stays normative and
  the bullet is amended to point at the published schema. `corpus/README.md`
  gains a note that merge entries' `conflicts.json` is validated against
  `schema/conflicts.schema.json` (as reading entries' models are validated
  against `cifra.schema.json`). These are completion-time housekeeping that
  record a closed gap, not a format change creating a new decision, so no
  design delta is authored ahead of implementation; the closer makes the
  prose edits in the same commit as the schema (mirroring
  [`setlist_corpus.md`](setlist_corpus.md) §Decisions). *Alternative
  rejected:* pre-editing the spec now — the refinement is written ahead of
  the work, and the constitution should not claim the question closed before
  the schema exists.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-12.

- cifra.md `444ff82`: `schema/conflicts.schema.json` — draft 2020-12, house conventions, 16-kind discriminated `oneOf`, per-kind member constraints, sides optional, sole-conflict `contains`+`maxItems:1` array rule.
- cifra.md `444ff82`: `reference/tests/conftest.py` — `CONFLICTS_SCHEMA` loaded and `conflicts_schema` fixture added beside `SCHEMA`/`schema`.
- cifra.md `444ff82`: `reference/tests/test_conflicts_schema.py` (new) — 14 valid shapes + 22 malformed-rejection cases covering the full §11.12.5 floor.
- cifra.md `444ff82`: `reference/tests/test_merge_corpus.py` — `test_conflicts_json_validates_against_the_schema` parametrized over all 33 `conflicts.json` files in `corpus/merge/`, covering runs/empty `[]`, scalar-side kinds, `file`, `unresolved`, two-conflict entry (63), `occurrence` > 1 (68).
- cifra.md `444ff82`: `corpus/README.md` — merge-entry schema check added; `spec/11-merge.md` — chapter 11 open question amended to point at `schema/conflicts.schema.json`.

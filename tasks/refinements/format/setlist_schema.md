# format.setlist_schema — JSON Schema for the setlist model

## TaskJuggler entry

`task setlist_schema` in [`tasks/05-format.tji`](../../05-format.tji) (lines
41–46), under `task format`. One line there: *"JSON Schema for the setlist
model."*

## Effort estimate

**1 day** (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), two directories:

- `schema/` — the new `schema/setlist.schema.json`, the third schema file in
  the repository beside `schema/cifra.schema.json` (the parsed-document
  model) and `schema/conflicts.schema.json` (the merge-conflicts model).
- `reference/` — the pytest wiring: the schema loaded in
  `reference/tests/conftest.py` beside `SCHEMA`/`CONFLICTS_SCHEMA`, the
  corpus-level validation added to `reference/tests/test_setlist_corpus.py`,
  and the malformed-rejection unit test in a new
  `reference/tests/test_setlist_schema.py`.

One completion-time documentation edit lands in the **same closer commit**
(§Decisions): the closed clause in **cifra.md** `spec/10-setlists.md` *Open
questions* (lines 685–686). This records the gap closing, not a change to the
format — no design delta is authored ahead of implementation (§Decisions,
*The documentation edit rides with the task*).

## Inherited dependencies

- **`format.setlists` — settled.** Complete (`complete 100`,
  [`tasks/05-format.tji`](../../05-format.tji) lines 20–26): the reference
  reads and writes setlists against spec chapter 10
  (`reference/cifra_md/setlist.py`: `parse_setlist` at line 222,
  `write_setlist` at line 367, `canonicalise_setlist` at line 396; the model
  it emits is documented in the module docstring, lines 6–20, and built at
  the `parse_setlist` return, line 327). No refinement document was written
  for `format.setlists` (it predates this refinements directory — the format
  refinements on disk are [`setlist_corpus.md`](setlist_corpus.md),
  [`conflicts_schema.md`](conflicts_schema.md) and
  [`render_hyphen.md`](render_hyphen.md)), so this refinement cites the spec
  chapter and the reference directly rather than a predecessor refinement.

- **`format.setlist_corpus` — settled, and it drives the corpus-level
  test.** Complete (`complete 100`,
  [`tasks/05-format.tji`](../../05-format.tji) lines 34–39; refinement
  [`setlist_corpus.md`](setlist_corpus.md)): it added the thirteen setlist
  reading entries `corpus/35-setlist-minimal` … `corpus/47-setlist-text-layer`,
  each with `input.parsed.json` and `parsed.json`. The corpus-level test this
  task names validates those models against the schema, so it needs those
  entries to exist — they do. It is **not** a formal `depends` of
  `setlist_schema` (the `.tji` has only `depends !setlists`), and need not be:
  the two are independent (§Decisions, *Either order keeps the gate green*)
  and `setlist_corpus` has already landed, so the test is drivable today. The
  `setlist_corpus` refinement explicitly left this schema and its corpus
  validation to this task ([`setlist_corpus.md`](setlist_corpus.md)
  §Decisions, *Schema stays with its own task*).

Sibling that sets the house conventions: **`format.conflicts_schema`**
([`conflicts_schema.md`](conflicts_schema.md), complete) wrote the second
schema file, `schema/conflicts.schema.json`, and recorded the conventions a
second schema should follow (its §Decisions, *Follow the song-schema
conventions*). This task is the same kind of work for the setlist *model* and
inherits those conventions.

## What this task is

Reading a setlist produces a structured model, exactly as reading a song
does. Spec §10.6 ("The model", `spec/10-setlists.md` lines 279–310) describes
that model's shape **only in prose** — a labelled structure block and a
trailing paragraph for `diagnostics`. The parsed song model has a published
JSON Schema (`schema/cifra.schema.json`) and the merge-conflicts model now
has one too (`schema/conflicts.schema.json`); the setlist model has none, and
chapter 10's *Open questions* names the gap: *"A JSON Schema for the model of
§10.6. Until the schema exists, the prose model above is the normative one"*
(`spec/10-setlists.md` lines 685–686).

This task writes that schema — `schema/setlist.schema.json`, following the
`cifra.schema.json`/`conflicts.schema.json` conventions — formalizing §10.6,
and wires it into the reference's test suite so every setlist model in
`corpus/` validates against it and a malformed one is rejected. The reader
and writer are untouched (they already produce the JSON this schema
describes); `corpus/tools.corpus` is untouched (it byte-compares, it does not
validate); only the new schema and its test wiring are added.

The schema must mirror the JSON the reader **actually emits**, not the
abbreviated §10.6 box. The box omits three things the emitted model carries:
the `type` discriminator on every entry, item and notes block
(`"property"`/`"unrecognised"`, `"song"`/`"unlinked"`, `"notes"`); the
`number` on every item; and the shape of `diagnostics`. The reference
docstring (`reference/cifra_md/setlist.py` lines 6–20) is the concrete field
map and the corpus `*.parsed.json` files are the ground truth
(§Inputs / context).

## Why it needs to be done

DIRECTION states the principle: *"Implementations agree because they are
checked, not because they are shared … The corpus holds, for every entry, the
input, its model, the canonical text and the canonical model, and each
implementation must reproduce all four byte for byte, in both directions"*
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6, lines 280–287). The
song model gained its schema so that an implementation's parsed JSON is
checked structurally, not only byte-compared; the setlist model — the one
reading product that had no schema — has had only prose, so chapter 10's
*Open questions* has carried the gap explicitly since setlists landed.

The downstream consumers are the JavaScript and Go setlist readers
(`cifra_js.conformance`, `cifra_go.conformance`) and the cross-implementation
comparison (`format.cross_check`): each produces a setlist model and is held
to the corpus byte for byte; a published schema gives each implementation an
independent structural check of its setlist model and pins §10.6 as something
testable, not only readable. Closing the chapter 10 open question is the
format reaching its documented structural-conformance surface for setlists,
matching songs (`cifra.schema.json`) and merge output
(`conflicts.schema.json`).

## Inputs / context

- [`tasks/05-format.tji`](../../05-format.tji) lines 41–46 — the task, its
  `note`, and the `Tests:` clause (unit + corpus).
- [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 (lines 280–287) — the
  agreement principle (checked, not shared).
- `cifra.md/spec/10-setlists.md` — the normative setlist definition. The
  sections this schema formalizes:
  - **§10.6 "The model" (lines 279–310)** — the structure block (lines
    285–305) and the trailing `diagnostics` paragraph (lines 307–310): what
    reading produces, still prose, no schema yet. The clause *"a conforming
    reader must be able to produce it, and a canonical writer (§10.9) must be
    able to take it back"* (lines 281–283) is what the schema pins the shape
    of. The paragraph is explicit that resolution (§10.8) is **not** part of
    what reading produces and the canonical form does not depend on it — so
    the schema describes the reading model only, with no resolved-song fields.
  - §10.3.1 "Title and properties" (line 102) — `title` from the level-1
    heading, `null` when none (`#` alone, or empty text); the property list
    under the title, in order.
  - §10.3.2 "Items" (line 125), §10.3.3 "Entries under an item" (line 149),
    §10.3.4 "Notes" (line 163) — items (numbered from 1), the entries under an
    item, notes blocks (`lines[]`, blank lines inside kept).
  - §10.4 "Links" (line 183), §10.5 "Paths" (line 231) — a song item's `text`
    (as written) and `path` (decoded segments joined by `/`); an unlinked
    item's `content` (as written).
  - §10.7 "Properties of an item" (line 312) — the reserved keys `key` and
    `note`, any other key application-defined; keys lowercased (the rule a
    song's properties follow, §1.4.3).
  - §10.8.3 "What is reported" (lines 402–418) — the diagnostics table (each
    a code, a message and a line).
  - *Open questions* (lines 685–686) — the clause this task closes.
- `cifra.md/reference/cifra_md/setlist.py` — the producer, authoritative for
  the model shape. Module docstring field map (lines 6–20):
  ```
  {"title": str | None,
   "properties": [entry, ...],
   "body": [item | notes, ...],
   "diagnostics": [{"code", "message", "line"}, ...]}
  entry:  {"type": "property", "key": str, "value": str}
        | {"type": "unrecognised", "text": str}
  item:   {"type": "song", "number": int, "text": str, "path": str, "entries": [entry]}
        | {"type": "unlinked", "number": int, "content": str, "entries": [entry]}
  notes:  {"type": "notes", "lines": [str]}
  ```
  Built at: top-level dict line 327; `entry_of()` lines 42–47 (key lowercased
  via `_lower`, lines 38–39); song item line 294; unlinked item line 298;
  notes line 264; diagnostic line 228 (order `code`, `message`, `line`; the
  list sorted by line at 326). The parse-time property key pattern is
  `^([A-Za-z0-9_-]+) *:` (line 32), lowercased — so the canonical key pattern
  is `^[a-z0-9_-]+$`, the same pattern the song schema uses
  (`schema/cifra.schema.json` line 19). Diagnostic codes emitted:
  `duplicate-key`, `unrecognised-entry`, `bad-key`, `backslash-in-path`,
  `bad-path`, `unlinked-item`, `unclosed-fence` (lines 209, 213, 219, 295,
  300, 302, 324). **A setlist diagnostic has no `text` field** (the song
  schema's `Diagnostic` carries an optional one; the setlist's does not).
- `cifra.md/schema/cifra.schema.json` — the house template: `"$schema":
  "https://json-schema.org/draft/2020-12/schema"` (line 2), `"$id":
  "https://github.com/ruoso/cifra.md/schema/cifra.schema.json"` (line 3),
  top-level `title` + `description`, `required` + `additionalProperties:
  false` on every object, `$defs` with `$ref: "#/$defs/…"`, `oneOf` for the
  tagged unions (Line kinds, Item types), per-field `description` strings
  citing spec sections. The property key pattern `^[a-z0-9_-]+$` (line 19);
  the `Diagnostic` def `required ["code", "message", "line"]`, `code`/`message`
  strings, `line` integer `minimum: 1` (lines 399–404). The second schema,
  `schema/conflicts.schema.json`, follows the same template.
- `cifra.md/reference/tests/conftest.py` — `SCHEMA` loaded at line 11,
  `CONFLICTS_SCHEMA` at line 12, their `schema`/`conflicts_schema` fixtures at
  lines 15–22: the seam to add a `SETLIST_SCHEMA` and `setlist_schema` fixture
  beside them.
- `cifra.md/reference/tests/test_corpus.py` — `import jsonschema` (line 5);
  `test_5_models_are_valid_against_the_schema` (lines 49–52): parametrized
  over every song entry **and** over both `input.parsed.json` and
  `parsed.json`, body `jsonschema.validate(model(entry, name), SCHEMA)`. The
  pattern the setlist corpus-level check mirrors.
- `cifra.md/reference/tests/test_setlist_corpus.py` — the setlist reading
  corpus pytest: `ENTRIES` discovered by `input.setlist.md` (line 21),
  `model()` helper (lines 32–33), checks 1–4 and 6 (lines 36–69). Its
  docstring (lines 7–9) says it **deliberately** does not apply the song
  schema (check 5) to a setlist model because that schema "has no JSON Schema
  yet (§10 Open questions; it is the sibling task format.setlist_schema)".
  This task adds the check-5 equivalent here against the new setlist schema
  and amends that note.
- `cifra.md/reference/tests/test_conflicts_schema.py` — the sibling's unit
  test: `test_valid_conflicts_validate` (lines 31–33) and
  `test_malformed_conflicts_are_rejected` (lines 64–67), hand-written
  `VALID`/`MALFORMED` dicts with `jsonschema.validate` /
  `pytest.raises(jsonschema.ValidationError)`. The template for
  `test_setlist_schema.py`.
- `cifra.md/reference/tools/corpus.py` — byte-compares only; `generate()`
  (songs) and `generate_setlist()` run parse/write round-trips, no
  `jsonschema` import. Untouched by this task.
- The corpus ground truth for the schema: `corpus/39-setlist-title-properties/parsed.json`
  (top-level `property` + `unrecognised` entries, a diagnostic),
  `corpus/41-setlist-unlinked/parsed.json` (`unlinked` items with `number`
  and `content`, `unlinked-item` diagnostics), `corpus/42-setlist-item-properties/parsed.json`
  (a song item whose `entries[]` holds `key`, `note` and an app-defined
  `singer`), `corpus/44-setlist-notes-blocks/parsed.json` (a `notes` block,
  blank line inside kept), `corpus/36-setlist-empty/parsed.json`
  (`{title:null, properties:[], body:[], diagnostics:[]}`),
  `corpus/37-setlist-title-only/parsed.json` (title, empty arrays).

## Constraints / requirements

- **Formalize §10.6, do not redesign it.** The schema describes exactly the
  shape the reader produces — a root object `{title, properties, body,
  diagnostics}`, the two-variant `Entry`, the two-variant `Item`, the `Notes`
  block, and `Diagnostic` — with `additionalProperties: false` and `required`
  at every object level. It is a second opinion on existing normative prose,
  not a new rule; it adds no field the reader does not emit and forbids none
  it does.
- **Mirror the emitted JSON, not the abbreviated box.** The schema must
  include the `type` discriminator on `Entry`/`Item`/`Notes`, the `number` on
  items, and the `diagnostics` array — all present in the emitted model
  (`setlist.py` docstring lines 6–20; the corpus `*.parsed.json`) though not
  in the §10.6 box. A `description` on each notes the box's abbreviation where
  it differs, citing the §10 sections.
- **Follow the song/conflicts-schema conventions.** Draft 2020-12; `"$id":
  "https://github.com/ruoso/cifra.md/schema/setlist.schema.json"`; top-level
  `title` ("cifra.md setlist") and `description`; `additionalProperties:
  false` and `required` on every object; `$defs` with `$ref` for the shared
  shapes (`Entry`, `Item`, `Notes`, `Diagnostic`); `oneOf` keyed on `type` for
  the `Entry` and `Item`/body unions, matching the song schema's `oneOf`-tagged
  unions; per-field `description` strings citing the §10 sections.
- **Pin the field value types, per the reference and corpus.**
  - `title` — a string (`minLength: 1`) **or** `null` (null when there is no
    title or its text is empty, §10.3.1), mirroring the song schema's `title`.
  - `properties` — an array of `Entry`; order significant (§10.3.1).
  - `body` — an array whose items are each an `Item` (`song`/`unlinked`) or a
    `Notes` block, a `oneOf` on `type` (§10.6, document order).
  - `diagnostics` — an array of `Diagnostic` (§10.6, §10.8.3).
  - `Entry` — a `oneOf` on `type`: `{type:"property", key, value}` with `key`
    a lowercased string matching `^[a-z0-9_-]+$` and `value` a string (may be
    empty); `{type:"unrecognised", text}` with `text` a string. Both
    `additionalProperties: false`.
  - `Item` song — `{type:"song", number, text, path, entries}`: `number` an
    integer `minimum: 1`; `text` and `path` strings; `entries` an array of
    `Entry`. `Item` unlinked — `{type:"unlinked", number, content, entries}`:
    `content` a string, the rest as the song variant.
  - `Notes` — `{type:"notes", lines}`: `lines` an array of strings (may hold
    `""` for blank lines inside the block, §10.3.4).
  - `Diagnostic` — `{code, message, line}`: `code` and `message` strings,
    `line` an integer `minimum: 1`, `additionalProperties: false`, **no**
    `text` field. `code` is left a string, not an enum (mirroring the song
    schema's `Diagnostic`, line 402), with the known codes named in its
    `description`; this keeps the schema a formalization of the model's shape
    rather than a second copy of the diagnostics table, which §10.8.3 owns.
- **Validation lives in pytest, not the corpus tool.** `tools/corpus.py`
  byte-compares; it does not run schema validation (the song schema is
  validated only in `test_corpus.py`). This task mirrors that: no change to
  `corpus.py`; the schema is loaded in `conftest.py` and validated in the test
  suite. `--write` and `--check` outputs are unchanged.
- **Standing rules that apply.**
  - *Implementations agree because they are checked, not shared* (DIRECTION
    §3.6): the schema is a published artifact the JavaScript and Go readers
    validate their own setlist models against; this task does not make one
    implementation copy another.
  - *Test fixtures use songs written for the purpose* — the hand-written valid
    and malformed fixtures in the unit test invent any setlist/song content
    (titles, link text), never anyone else's words. The corpus entries it
    validates were written for the purpose in `format.setlist_corpus`.
- **Out of scope.** The song schema (`cifra.schema.json`) and the conflicts
  schema (`conflicts.schema.json`) are unchanged. The reader, the writer, the
  canonical form and the corpus entries are unchanged — only a schema over the
  JSON the reader already produces, and its test wiring. Resolution (§10.8)
  fields are not modelled: they are not part of what reading produces (§10.6).

## Acceptance criteria

**Behaviour delivered.** `schema/setlist.schema.json` exists — draft 2020-12,
the house conventions, formalizing §10.6 — and every setlist model in
`corpus/` (`input.parsed.json` and `parsed.json` of entries
`corpus/35-setlist-minimal` … `corpus/47-setlist-text-layer`) validates
against it, while a malformed setlist model is rejected. The chapter 10 open
question is closed: §10.6 remains the normative prose, and the schema is the
published formalization the corpus and the other implementations check
against.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names
unit + corpus; §Testing policy of the brief: format work's
behaviour/conformance level **is** the corpus, so there are no behavior,
e2e-api or e2e-web levels — see §Decisions):

- **corpus** — a new per-entry check in
  `reference/tests/test_setlist_corpus.py`
  (`test_5_models_are_valid_against_the_schema`, mirroring `test_corpus.py`
  lines 49–52), parametrized over `ENTRIES` **and** over both
  `input.parsed.json` and `parsed.json`, calling `jsonschema.validate(model(entry,
  name), SETLIST_SCHEMA)`. All thirteen entries' two models each validate —
  this is the setlist-corpus conformance check the `.tji` names, and it runs
  in `scripts/gate`. It pins §10.6 against the real reader output across every
  observed shape: `null` and non-empty `title` (36, 37, 38, 39), top-level
  `property` and `unrecognised` entries (39), `song` and `unlinked` items with
  `number`/`text`/`path`/`content` (35, 41, 45, 46), item `entries[]` with
  `key`/`note`/app-defined keys (42), a repeated song target (43), `notes`
  blocks with blank lines inside (44), and diagnostics of several codes (39,
  41). The docstring note at lines 7–9 (the deliberate omission of the schema
  check) is amended: the setlist schema now exists and is applied here.
- **unit (pytest)** — `reference/tests/test_setlist_schema.py` (new), modelled
  on `test_conflicts_schema.py`, validating against the schema loaded in
  `conftest.py` (`SETLIST_SCHEMA`, beside `SCHEMA`/`CONFLICTS_SCHEMA`):
  - a positive sanity: a hand-written minimal valid setlist model
    (`{title, properties, body, diagnostics}`, including one of each variant —
    a `property` and `unrecognised` entry, a `song` and `unlinked` item with
    an item `entries` property, a `notes` block, a diagnostic) validates;
  - a malformed one is rejected (`jsonschema.ValidationError`) for each case
    in this floor — unknown `type` on an entry/item/body element; missing
    `type`; a missing required member (`title`/`properties`/`body`/`diagnostics`
    at the root; `value` on a property; `number`/`text`/`path` on a song;
    `content` on an unlinked; `lines` on a notes; `code`/`message`/`line` on a
    diagnostic); an unknown member (an extra key at the root, in an entry, in
    an item, in a diagnostic — `additionalProperties`); a property `key` not
    matching `^[a-z0-9_-]+$` (uppercase, spaces); `number`/`line` not a
    positive integer (0, negative, string); `title` neither string nor null; a
    `notes` `lines` holding a non-string; a diagnostic carrying a `text` field.
  This pins the §10.6 model structurally.
- **unit (pytest)** — `reference/tests/conftest.py` loads `SETLIST_SCHEMA`
  (and exposes a `setlist_schema` fixture, mirroring `schema`/`conflicts_schema`);
  its correctness is exercised by both tests above.

No follow-up work is deferred by this task.

## Decisions

- **Follow the song/conflicts-schema conventions.** `schema/setlist.schema.json`
  uses the same dialect and shape as the two schemas already in `schema/`:
  draft 2020-12, a GitHub `$id`, top-level `title`/`description`,
  `additionalProperties: false` + `required` at every level, `$defs` + `$ref`,
  `oneOf` keyed on `type` for the tagged unions, and `description` strings
  citing §10. The conflicts refinement set these as the house conventions a
  second schema should match ([`conflicts_schema.md`](conflicts_schema.md)
  §Decisions); this is the third and follows them. *Alternative rejected:* a
  different draft or a bespoke layout — the three schemas are maintained as one
  family and should read alike.

- **Mirror the emitted JSON, not the §10.6 box.** The schema pins the `type`
  discriminators, the item `number`, and the `diagnostics` array, all of which
  the reader emits (`setlist.py` docstring lines 6–20; the corpus models)
  though the §10.6 structure block abbreviates them away. A schema that
  matched only the box would reject every real model and pin nothing.
  *Alternative rejected:* transcribing the box literally — it is a reading
  aid, not the serialization; the serialization is what implementations must
  agree on.

- **`code` is a string, not an enum.** The `Diagnostic.code` is left a string
  with the known codes listed in its `description`, exactly as the song
  schema's `Diagnostic` does (`cifra.schema.json` line 402). §10.8.3 owns the
  diagnostics table; duplicating it as a schema enum would make the schema a
  second normative source for a list that evolves with the reader, and would
  reject a legitimate new code before §10.8.3 and the corpus caught up. The
  schema pins the *shape* of a diagnostic (`code`/`message`/`line`, no `text`),
  which is the structural fact the model-level schema is for. *Alternative
  rejected:* a seven-value `code` enum — tighter, but it couples the schema to
  the diagnostics table and diverges from the song schema's own `Diagnostic`.

- **Validation stays in pytest; `corpus.py` is untouched.** The song schema is
  validated only in `test_corpus.py` (`jsonschema.validate`), not in the
  `--write`/`--check` tool, which byte-compares; the conflicts schema followed
  the same seam. This task mirrors it: the schema is loaded in `conftest.py`
  and validated in `test_setlist_corpus.py` and `test_setlist_schema.py`;
  `corpus.py` does not change. *Alternative rejected:* adding schema
  validation inside `corpus.py --check` — it would diverge from the song and
  conflicts paths and conflate byte-reproduction (what the corpus tool checks)
  with structural validity (what the schema checks).

- **The corpus check goes in `test_setlist_corpus.py`, not a new corpus
  file.** The setlist reading corpus already has its pytest; the schema check
  is its check 5, added beside checks 1–4 and 6, exactly as `test_corpus.py`
  carries check 5 for songs. The dedicated `test_setlist_schema.py` holds only
  the hand-written positive/malformed unit cases, mirroring
  `test_conflicts_schema.py`. *Alternative rejected:* a standalone
  setlist-corpus-schema file — it would split the corpus checks for one model
  across two files for no gain.

- **Either order keeps the gate green.** `setlist_schema` and
  `setlist_corpus` are independent: `setlist_corpus` (already complete) left
  the schema and its corpus validation to this task, and this task's
  corpus-level check consumes `setlist_corpus`'s entries. Because
  `setlist_corpus` has landed, the check is drivable now; had this task been
  picked first, its corpus check would have had no setlist entries to run over
  and would have waited — so the `.tji` keeps `depends !setlists` only, and
  this refinement records the entry dependency as settled context rather than
  adding a formal `depends` (the orchestrator/closer own the `.tji` shape).
  *Alternative rejected:* editing the `.tji` to `depends !setlist_corpus` — it
  is complete, so nothing is missing to drive the named tests; the brief's
  add-to-`depends` path is only for a prerequisite that does not yet exist.

- **The documentation edit rides with the task, authored at implementation.**
  Landing the schema closes the chapter 10 *Open questions* bullet
  (`spec/10-setlists.md` lines 685–686): §10.6 stays normative and the bullet
  is amended to point at the published `schema/setlist.schema.json` (as the
  conflicts task amended chapter 11's bullet). This is completion-time
  housekeeping that records a closed gap, not a format change creating a new
  decision, so no design delta is authored ahead of implementation; the closer
  makes the prose edit in the same commit as the schema, mirroring
  [`conflicts_schema.md`](conflicts_schema.md) and
  [`setlist_corpus.md`](setlist_corpus.md) §Decisions. `corpus/README.md`
  already documents the reading-entry schema check as model validation; if its
  wording is song-specific, the closer extends it to name the setlist model
  too — a one-line housekeeping edit, not a design change. *Alternative
  rejected:* pre-editing the spec now — the refinement is written ahead of the
  work, and the constitution should not claim the question closed before the
  schema exists.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-12.

- cifra.md `8e8cbcd`: `schema/setlist.schema.json` — new (draft 2020-12, house conventions, formalizing §10.6, the third schema beside `cifra.schema.json` and `conflicts.schema.json`)
- cifra.md `8e8cbcd`: `reference/tests/conftest.py` — `SETLIST_SCHEMA` loaded and `setlist_schema` fixture added beside `schema`/`conflicts_schema`
- cifra.md `8e8cbcd`: `reference/tests/test_setlist_corpus.py` — check 5 (`test_5_models_are_valid_against_the_schema`) added, parametrized over all 13 entries × `input.parsed.json` + `parsed.json`; docstring note amended
- cifra.md `8e8cbcd`: `reference/tests/test_setlist_schema.py` — new unit test: 3 valid + 33 malformed cases covering the full rejection floor (unknown/missing `type`, missing required members, `additionalProperties`, key pattern, non-positive `number`/`line`, `title` type, non-string notes line, diagnostic `text`)
- cifra.md `8e8cbcd`: `spec/10-setlists.md` — chapter 10 *Open questions* bullet closed, pointing at `schema/setlist.schema.json`; §10.6 stays normative
- cifra.md `8e8cbcd`: `corpus/README.md` — setlist entry description updated to name check 5 as applied against `schema/setlist.schema.json`

"""Unit tests for schema/conflicts.schema.json (spec §11.12.5): hand-written
minimal valid conflicts validate, and each malformed shape in the rejection
floor raises jsonschema.ValidationError. This pins the §11.12.5 member table
structurally, beside the corpus check in test_merge_corpus.py. Every fixture
invents song/setlist content written for the purpose."""

import jsonschema
import pytest


# --- positive: a minimal valid object and one of each side-shape family -----

VALID = {
    "minimal-title": {"conflicts": [{"kind": "title", "line": 1, "ours": "Autumn Walk", "theirs": "Autumn Stroll"}]},
    "empty-array": {"conflicts": []},
    "chart-run-empty-side": {"conflicts": [{"kind": "chart", "line": 5, "base": [], "ours": ["| C |"], "theirs": ["| D |"]}]},
    "sections-run": {"conflicts": [{"kind": "sections", "line": 2, "base": ["## A"], "ours": ["## A"], "theirs": ["## B"]}]},
    "block-notes-run": {"conflicts": [{"kind": "block-notes", "line": 9, "tuning": "E A D G B E", "variation": "", "base": ["note"], "ours": ["note one"], "theirs": ["note two"]}]},
    "file-deleted": {"conflicts": [{"kind": "file", "deleted": "ours"}]},
    "file-unreadable": {"conflicts": [{"kind": "file", "unreadable": ["base", "theirs"]}]},
    "unresolved-ints": {"conflicts": [{"kind": "unresolved", "ours": 3, "theirs": 7}]},
    "reading-with-symbols": {"conflicts": [{"kind": "reading", "line": 3, "key": "notation", "changed": "ours", "symbols": ["C"], "base": "C", "theirs": "C7"}]},
    "block-deleted-vs-changed": {"conflicts": [{"kind": "block", "line": 4, "tuning": "E A D G B E", "variation": "", "base": "x 3 2 0 1 0", "theirs": "x 3 2 0 3 3"}]},
    "voicing": {"conflicts": [{"kind": "voicing", "line": 6, "tuning": "E A D G B E", "variation": "", "key": "C", "ours": "x 3 2 0 1 0", "theirs": "x 3 2 0 1 3"}]},
    "setlist-entry-occurrence": {"conflicts": [{"kind": "entry", "line": 2, "item": "songs/one.cifra.md", "occurrence": 2, "key": "key", "base": "C", "ours": "D"}]},
    "setlist-notes-first": {"conflicts": [{"kind": "notes", "line": 1, "ours": "a leading note"}]},
    "two-conflicts": {"conflicts": [{"kind": "text", "line": 2, "item": "songs/one.cifra.md", "base": "One", "ours": "Song One"}, {"kind": "entry", "line": 5, "item": "songs/one.cifra.md", "key": "key", "base": "C", "theirs": "D"}]},
}


@pytest.mark.parametrize("doc", VALID.values(), ids=list(VALID))
def test_valid_conflicts_validate(doc, conflicts_schema):
    jsonschema.validate(doc, conflicts_schema)


# --- negative: the rejection floor named by the refinement -------------------

MALFORMED = {
    "unknown-kind": {"conflicts": [{"kind": "bogus", "line": 1}]},
    "missing-kind": {"conflicts": [{"line": 1, "ours": "x"}]},
    "unknown-top-member": {"conflicts": [], "extra": True},
    "unknown-conflict-member": {"conflicts": [{"kind": "title", "line": 1, "bogus": 1}]},
    "deleted-not-a-side": {"conflicts": [{"kind": "file", "deleted": "base"}]},
    "changed-not-a-side": {"conflicts": [{"kind": "reading", "line": 1, "key": "notation", "changed": "base"}]},
    "unreadable-bad-side": {"conflicts": [{"kind": "file", "unreadable": ["nope"]}]},
    "line-zero": {"conflicts": [{"kind": "title", "line": 0}]},
    "line-negative": {"conflicts": [{"kind": "title", "line": -1}]},
    "line-string": {"conflicts": [{"kind": "title", "line": "1"}]},
    "occurrence-one": {"conflicts": [{"kind": "item", "line": 1, "item": "songs/one.cifra.md", "occurrence": 1, "base": "a", "theirs": "b"}]},
    "occurrence-string": {"conflicts": [{"kind": "item", "line": 1, "item": "songs/one.cifra.md", "occurrence": "2", "base": "a", "theirs": "b"}]},
    "symbols-on-title": {"conflicts": [{"kind": "title", "line": 1, "symbols": ["C"]}]},
    "line-on-file": {"conflicts": [{"kind": "file", "line": 1, "deleted": "ours"}]},
    "tuning-on-property": {"conflicts": [{"kind": "property", "line": 1, "key": "key", "tuning": "E A D G B E"}]},
    "integer-side-on-chart": {"conflicts": [{"kind": "chart", "line": 1, "base": 3, "ours": ["| C |"], "theirs": ["| D |"]}]},
    "string-side-on-unresolved": {"conflicts": [{"kind": "unresolved", "ours": "3"}]},
    "root-missing-conflicts": {},
    "root-conflicts-not-array": {"conflicts": {}},
    "root-is-list": [],
    "file-not-sole": {"conflicts": [{"kind": "file", "deleted": "ours"}, {"kind": "title", "line": 1, "ours": "x"}]},
    "unresolved-not-sole": {"conflicts": [{"kind": "unresolved", "ours": 1}, {"kind": "title", "line": 1, "ours": "x"}]},
}


@pytest.mark.parametrize("doc", MALFORMED.values(), ids=list(MALFORMED))
def test_malformed_conflicts_are_rejected(doc, conflicts_schema):
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(doc, conflicts_schema)

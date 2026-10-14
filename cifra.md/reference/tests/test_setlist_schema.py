"""Unit tests for schema/setlist.schema.json (spec §10.6): a hand-written
minimal valid setlist model validates, and each malformed shape in the
rejection floor raises jsonschema.ValidationError. This pins the §10.6 model
structurally, beside the corpus check in test_setlist_corpus.py. Every fixture
invents setlist/song content written for the purpose."""

import jsonschema
import pytest


# --- positive: a minimal valid model with one of each variant -----------------

VALID = {
    # A title, both entry variants at top level, a song item and an unlinked
    # item (the song with an `entries` property holding both entry variants),
    # a notes block, and a diagnostic.
    "one-of-each": {
        "title": "Friday Set",
        "properties": [
            {"type": "property", "key": "key", "value": "C"},
            {"type": "unrecognised", "text": "play loud"},
        ],
        "body": [
            {
                "type": "song",
                "number": 1,
                "text": "Opening Number",
                "path": "opening-number.cifra.md",
                "entries": [
                    {"type": "property", "key": "note", "value": "capo 2"},
                    {"type": "unrecognised", "text": "not a property"},
                ],
            },
            {"type": "unlinked", "number": 2, "content": "a break", "entries": []},
            {"type": "notes", "lines": ["Second set.", "", "tune down"]},
        ],
        "diagnostics": [
            {"code": "unlinked-item", "message": "an item that is not a song link", "line": 4},
        ],
    },
    # The empty setlist: null title, empty arrays (corpus/36-setlist-empty).
    "empty": {"title": None, "properties": [], "body": [], "diagnostics": []},
    # A property value may be empty.
    "empty-value": {
        "title": "T",
        "properties": [{"type": "property", "key": "note", "value": ""}],
        "body": [],
        "diagnostics": [],
    },
}


@pytest.mark.parametrize("doc", VALID.values(), ids=list(VALID))
def test_valid_setlist_models_validate(doc, setlist_schema):
    jsonschema.validate(doc, setlist_schema)


# --- negative: the rejection floor named by the refinement --------------------

_SONG = {"type": "song", "number": 1, "text": "X", "path": "x.cifra.md", "entries": []}
_BASE = {"title": "T", "properties": [], "body": [], "diagnostics": []}


def _with_body(*elements):
    return {**_BASE, "body": list(elements)}


MALFORMED = {
    # Unknown or missing `type` on an entry, body item, and body element.
    "unknown-entry-type": {**_BASE, "properties": [{"type": "bogus", "key": "k", "value": "v"}]},
    "unknown-item-type": _with_body({"type": "bogus", "number": 1}),
    "missing-entry-type": {**_BASE, "properties": [{"key": "k", "value": "v"}]},
    "missing-item-type": _with_body({"number": 1, "content": "x", "entries": []}),
    # Missing required root member.
    "root-missing-title": {"properties": [], "body": [], "diagnostics": []},
    "root-missing-properties": {"title": None, "body": [], "diagnostics": []},
    "root-missing-body": {"title": None, "properties": [], "diagnostics": []},
    "root-missing-diagnostics": {"title": None, "properties": [], "body": []},
    # Missing required member within a variant.
    "property-missing-value": {**_BASE, "properties": [{"type": "property", "key": "k"}]},
    "song-missing-number": _with_body({"type": "song", "text": "X", "path": "x.cifra.md", "entries": []}),
    "song-missing-text": _with_body({"type": "song", "number": 1, "path": "x.cifra.md", "entries": []}),
    "song-missing-path": _with_body({"type": "song", "number": 1, "text": "X", "entries": []}),
    "unlinked-missing-content": _with_body({"type": "unlinked", "number": 1, "entries": []}),
    "notes-missing-lines": _with_body({"type": "notes"}),
    "diagnostic-missing-code": {**_BASE, "diagnostics": [{"message": "m", "line": 1}]},
    "diagnostic-missing-message": {**_BASE, "diagnostics": [{"code": "c", "line": 1}]},
    "diagnostic-missing-line": {**_BASE, "diagnostics": [{"code": "c", "message": "m"}]},
    # Unknown member (additionalProperties: false) at each level.
    "root-extra-member": {**_BASE, "resolved": True},
    "entry-extra-member": {**_BASE, "properties": [{"type": "property", "key": "k", "value": "v", "bogus": 1}]},
    "item-extra-member": _with_body({**_SONG, "bogus": 1}),
    "diagnostic-extra-member": {**_BASE, "diagnostics": [{"code": "c", "message": "m", "line": 1, "bogus": 1}]},
    # A property key not matching ^[a-z0-9_-]+$.
    "key-uppercase": {**_BASE, "properties": [{"type": "property", "key": "Key", "value": "C"}]},
    "key-with-space": {**_BASE, "properties": [{"type": "property", "key": "a b", "value": "C"}]},
    # `number`/`line` not a positive integer.
    "number-zero": _with_body({**_SONG, "number": 0}),
    "number-negative": _with_body({**_SONG, "number": -1}),
    "number-string": _with_body({**_SONG, "number": "1"}),
    "line-zero": {**_BASE, "diagnostics": [{"code": "c", "message": "m", "line": 0}]},
    "line-negative": {**_BASE, "diagnostics": [{"code": "c", "message": "m", "line": -1}]},
    "line-string": {**_BASE, "diagnostics": [{"code": "c", "message": "m", "line": "1"}]},
    # `title` neither string nor null (empty string fails minLength).
    "title-number": {**_BASE, "title": 1},
    "title-empty-string": {**_BASE, "title": ""},
    # A notes `lines` holding a non-string.
    "notes-line-not-string": _with_body({"type": "notes", "lines": ["ok", 3]}),
    # A diagnostic carrying a text field (a setlist diagnostic has none).
    "diagnostic-with-text": {**_BASE, "diagnostics": [{"code": "c", "message": "m", "line": 1, "text": "t"}]},
}


@pytest.mark.parametrize("doc", MALFORMED.values(), ids=list(MALFORMED))
def test_malformed_setlist_models_are_rejected(doc, setlist_schema):
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(doc, setlist_schema)

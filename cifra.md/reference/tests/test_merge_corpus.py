"""The merge corpus (corpus/README.md, spec §11.16): for every entry in
corpus/merge/, the four checks, and the unchanged sides generated from its
files."""

import json

import jsonschema
import pytest

from cifra_md.merge import canonical_song, merge
from cifra_md.setlist import canonicalise_setlist
from cifra_md.text import marker_lines
from merge_props import mirror_conflict, mirror_text, normal, resolve
from tools.corpus import extension, merge_entries, merge_inputs, merge_outputs

from conftest import CONFLICTS_SCHEMA

ENTRIES = merge_entries()


def ids():
    return [p.name for p in ENTRIES]


def run(entry, swap=False):
    b, o, t = merge_inputs(entry)
    if swap:
        o, t = t, o
    return merge(b, o, t, setlist=extension(entry) == ".setlist.md")


def canon(entry, text):
    return canonicalise_setlist(text) if extension(entry) == ".setlist.md" else canonical_song(text)


def test_there_are_entries():
    assert len(ENTRIES) >= 50


@pytest.mark.parametrize("entry", ENTRIES, ids=ids())
def test_1_merging_gives_the_expected_files(entry):
    files = merge_outputs(run(entry), extension(entry))
    present = {p.name for p in entry.iterdir() if not p.name.startswith(("base.", "ours.", "theirs.", "asymmetric"))}
    assert present == set(files)
    for name, text in files.items():
        assert (entry / name).read_bytes() == text.encode("utf-8"), name
    assert sum(n in present for n in ("result" + extension(entry), "result.deleted", "conflicts.json")) == 1


@pytest.mark.parametrize("entry", ENTRIES, ids=ids())
def test_2_exchanging_the_sides_mirrors_the_outcome(entry):
    if (entry / "asymmetric").exists():
        pytest.skip("numbers variants under the exception of §11.9.5")
    r, r2 = run(entry), run(entry, swap=True)
    assert r.kind == r2.kind
    if r.kind == "result":
        assert r2.result == r.result
    elif r.kind == "conflicts":
        assert [normal(c) for c in r2.conflicts] == [normal(mirror_conflict(c)) for c in r.conflicts]
        assert r2.marked == (None if r.marked is None else mirror_text(r.marked))


@pytest.mark.parametrize("entry", ENTRIES, ids=ids())
def test_3_the_result_is_canonical(entry):
    path = entry / ("result" + extension(entry))
    if path.exists():
        text = path.read_text()
        assert canon(entry, text) == text


@pytest.mark.parametrize("entry", ENTRIES, ids=ids())
@pytest.mark.parametrize("side", ["ours", "theirs"])
def test_4_resolving_by_one_side_gives_a_document(entry, side):
    path = entry / ("marked" + extension(entry))
    if not path.exists():
        pytest.skip("no marked text")
    resolved = resolve(path.read_text(), side)
    assert not marker_lines(resolved)
    text = canon(entry, resolved)
    assert canon(entry, text) == text


@pytest.mark.parametrize("entry", ENTRIES, ids=ids())
def test_unchanged_sides_change_nothing(entry):
    setlist = extension(entry) == ".setlist.md"
    inputs = []
    for x in merge_inputs(entry):
        if x is not None:
            try:
                x = x.decode("utf-8")
            except UnicodeDecodeError:
                continue
            if not marker_lines(x):  # a marked input is never merged (§11.4)
                inputs.append(x)
    for b in inputs:
        for x in inputs:
            want = canon(entry, x)
            for args in ((b, x, x), (b, b, x), (b, x, b)):
                assert merge(*args, setlist=setlist).result == want


@pytest.mark.parametrize("entry", ENTRIES, ids=ids())
def test_conflicts_json_is_written_as_the_corpus_writes_json(entry):
    path = entry / "conflicts.json"
    if path.exists():
        text = path.read_text()
        assert text == json.dumps(json.loads(text), indent=2, ensure_ascii=False) + "\n"


@pytest.mark.parametrize("entry", ENTRIES, ids=ids())
def test_conflicts_json_validates_against_the_schema(entry):
    # Every conflicts.json in corpus/merge/ is a second opinion on §11.12.5:
    # it validates against schema/conflicts.schema.json (the published
    # formalisation that closes chapter 11's open question). This pins the
    # member table against the real merge output — chart/sections/block-notes
    # runs (including an empty []), scalar-side kinds, file (deleted/unreadable),
    # unresolved (integer sides, no line), the two-conflict entry (63) and
    # occurrence > 1 (68).
    path = entry / "conflicts.json"
    if path.exists():
        jsonschema.validate(json.loads(path.read_text()), CONFLICTS_SCHEMA)

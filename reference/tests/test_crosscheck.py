"""Tests for the cross-implementation comparison tool (tools.crosscheck,
DIRECTION §3.6, format.cross_check).

These pin the .tji's named cases: the generator is deterministic (so the gate
never flakes), identical artefacts pass, a planted one-byte disagreement is
reported with the document that caused it, and a tiny real run exercises both
drivers and the subprocess plumbing end to end. The gate's cross-check step is
the corpus/conformance-level run over the fixed default seed and count.
"""

from __future__ import annotations

from tools.crosscheck import (
    DEFAULT_COUNT,
    DEFAULT_SEED,
    IMPLS,
    ROLES,
    compare,
    generate_documents,
    main,
    render_report,
)


def _identical_results(documents):
    """A `results` mapping in which all three implementations agree on every
    artefact — the shape `compare` consumes, built without any subprocess."""
    results = {impl: {} for impl in IMPLS}
    for doc in documents:
        shared = {
            "input.json": f"input-model:{doc.name}".encode("utf-8"),
            "canonical": f"canonical:{doc.name}".encode("utf-8"),
            "canonical.json": f"canonical-model:{doc.name}".encode("utf-8"),
        }
        for impl in IMPLS:
            results[impl][doc.name] = dict(shared)
    return results


# --- the generator is deterministic (pins the no-flaky-gate requirement) ---

def test_generator_is_deterministic():
    """The same seed and count yield the same documents, byte for byte, so a
    given commit passes or fails the gate deterministically."""
    a = generate_documents(DEFAULT_SEED, 20)
    b = generate_documents(DEFAULT_SEED, 20)
    assert [(d.name, d.ext, d.text) for d in a] == [(d.name, d.ext, d.text) for d in b]


def test_a_different_seed_changes_the_documents():
    """Different seeds explore different documents (the --seed override is real)."""
    a = generate_documents(0, 20)
    b = generate_documents(1, 20)
    assert [d.text for d in a] != [d.text for d in b]


def test_generated_documents_are_both_songs_and_setlists():
    """The generator exercises both readers/writers: songs and setlists, named
    by their extension (corpus/README.md)."""
    docs = generate_documents(DEFAULT_SEED, DEFAULT_COUNT)
    exts = {d.ext for d in docs}
    assert exts == {".cifra.md", ".setlist.md"}
    for doc in docs:
        assert doc.filename.endswith(doc.ext)


# --- identical artefacts pass ---

def test_identical_artefacts_report_no_disagreement():
    """Given three implementations whose artefacts agree, the comparison finds
    nothing and the report is empty of disagreements."""
    docs = generate_documents(DEFAULT_SEED, 10)
    disagreements = compare(_identical_results(docs), docs)
    assert disagreements == []
    assert "0 disagreement(s)" in render_report(disagreements, DEFAULT_SEED)


# --- a planted one-byte disagreement is reported with its document ---

def test_a_planted_one_byte_disagreement_is_reported():
    """The .tji's named case: one implementation's bytes differ by a single
    byte on one document's one artefact. The comparison names that document and
    artefact and carries every implementation's bytes."""
    docs = generate_documents(DEFAULT_SEED, 10)
    results = _identical_results(docs)
    target = docs[3]
    role = "canonical.json"

    original = results["go"][target.name][role]
    planted = bytearray(original)
    planted[-1] ^= 0x01  # flip a single byte
    results["go"][target.name][role] = bytes(planted)
    assert len(bytes(planted)) == len(original)  # a one-byte difference, not a length change

    disagreements = compare(results, docs)
    assert len(disagreements) == 1
    d = disagreements[0]
    assert d.doc.name == target.name
    assert d.role == role
    assert d.values["python"] == original
    assert d.values["go"] == bytes(planted)
    assert d.values["python"] != d.values["go"]

    report = render_report(disagreements, 7)
    assert "seed 7" in report
    assert target.filename in report          # the document that caused it
    assert "canonical model" in report        # which artefact differs (the label)
    for impl in IMPLS:
        assert f"[{impl}]" in report           # each implementation's bytes


def test_a_disagreement_on_each_artefact_is_found():
    """A disagreement is caught on any of the three artefacts, not only one."""
    docs = generate_documents(DEFAULT_SEED, 4)
    results = _identical_results(docs)
    for i, role in enumerate(ROLES):
        results["js"][docs[i].name][role] = b"divergent"
    disagreements = compare(results, docs)
    assert {d.role for d in disagreements} == set(ROLES)
    assert len(disagreements) == len(ROLES)


# --- end-to-end over a tiny seed: the real three implementations ---

def test_end_to_end_tiny_seed_agrees():
    """`python -m tools.crosscheck --count 8` runs Python in-process and the
    JavaScript and Go drivers as subprocesses over documents that include both
    songs and setlists, and exits 0 — the drivers and the subprocess plumbing,
    exercised for real (not a fixture)."""
    docs = generate_documents(DEFAULT_SEED, 8)
    assert {d.ext for d in docs} == {".cifra.md", ".setlist.md"}
    assert main(["--count", "8"]) == 0

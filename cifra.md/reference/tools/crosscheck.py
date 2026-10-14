"""Cross-implementation comparison over random documents (DIRECTION §3.6).

    python -m tools.crosscheck                 the gate's fixed seed and count
    python -m tools.crosscheck --seed S        a different seed
    python -m tools.crosscheck --count N        a different number of documents

On top of the corpus, which pins hand-written examples, this runs the same
*random* documents through the Python, JavaScript and Go implementations and
compares the bytes they produce. A disagreement is a bug in one of them or a
gap in the specification (DIRECTION §3.6), and the §9.1 Writer MUST — "the same
bytes as any other conforming writer" — is what it instruments on random input.

A deterministic, seeded generator produces documents no one wrote by hand —
songs and setlists, deliberately NON-canonical so the readers are exercised,
not only the writers — and for each document and each implementation three
artefacts are computed and compared byte for byte:

    input.json          serialise(parse(input))         the input model
    canonical.EXT       write(parse(input))             the canonical text
    canonical.json      serialise(parse(canonical))     the canonical model

with EXT `.cifra.md` for a song and `.setlist.md` for a setlist. Python runs
in-process; JavaScript and Go run through the thin drivers js/tools/crosscheck.mjs
and go/cmd/crosscheck, each a wrapper over the parse/write/serialise their
library already exposes (the same ones the corpus harnesses use). The
serialisation is the corpus one — two-space indent, non-ASCII as itself, one
trailing newline (corpus/README.md) — already identical in all three, so the
comparison is order-preserving byte equality.

On a disagreement the tool prints the seed, the document (its bytes), which
artefact differs and each implementation's bytes, and exits non-zero. The gate
runs a fixed seed and count so a failure is deterministic and reproducible;
--seed/--count widen the search or reproduce a reported failure by hand. This
mirrors the property suite's deterministic enumeration (SEEDS, N), not
randomised fuzzing: stdlib random only, no hypothesis.

Scope is reading and canonicalisation. Merge agreement across the three is
already pinned by the merge corpus and the §11.3 property suites.
"""

from __future__ import annotations

import json
import pathlib
import random
import subprocess
import sys
import tempfile
from dataclasses import dataclass

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from cifra_md import parse, write  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]

# The gate runs these fixed values so CI is reproducible and never flaky.
DEFAULT_SEED = 0
DEFAULT_COUNT = 64

# The implementations compared, and the three artefacts of each document.
IMPLS = ("python", "js", "go")
ROLES = ("input.json", "canonical", "canonical.json")
ROLE_LABELS = {
    "input.json": "input model (parse of the generated text)",
    "canonical": "canonical text (write of the input model)",
    "canonical.json": "canonical model (parse of the canonical text)",
}


def dump(model: dict) -> str:
    """The corpus serialisation: two-space indent, UTF-8, final newline.

    Identical to tools.corpus.dump and to the js/go drivers' dump, so the three
    implementations' artefacts compare byte for byte (corpus/README.md)."""
    return json.dumps(model, indent=2, ensure_ascii=False) + "\n"


# ---------------------------------------------------------------------------
# The seeded generator: NON-canonical, document-shaped UTF-8.
#
# The token pools, titles and shapes are invented for the purpose (as
# reference/tests/merge_gen.py's already are), never anyone else's words. The
# generator emits RAW (pre-canonical) text so the comparison exercises reader
# agreement — uncanonical spacing, mixed conventions, renumbering — and not
# only writer agreement; it never emits a conflict marker (§11.12.2) or
# non-UTF-8, which are not documents a reader produces a model from (§1.3).
# ---------------------------------------------------------------------------

TITLES = [
    "Canção da Estrada", "Morning Light", "O Rio Lento", "Quiet House",
    "Wanderer", "Café Azul", "The Long Way", "Serena", "Noite Clara",
]
SECTIONS = ["Intro", "Verso", "Refrão", "Ponte", "Solo", "Final", "Chorus", "Bridge"]
PROP_KEYS = ["key", "capo", "tempo", "composer", "year", "Key", "Capo"]
PROP_VALUES = ["C", "G", "120", "Alguém", "1998", "D", "Am", "2"]
CHORDS = [
    "C", "G", "Am", "F", "Dm", "G7", "Cm", "Cm[2]", "Cm[3]", "Em",
    "C7+", "%", "N.C.", "A7", "Bb", "F#m", "D", "E",
]
WORDS = ["la", "when", "I", "saw", "você", "oh", "tarde", "é", "Café",
         "the", "road", "sol", "mar", "luz", "canto"]
SHAPES = ["x35543", "x3554x", "320003", "x32010", "133211", "022100"]
UKE = ["0333", "5333", "0003", "2010"]
SYMBOLS = ["C", "G", "Am", "F", "Dm", "G7", "Cm", "Em"]
SONGS = ["corcovado", "wave", "garota", "samba", "aguas", "insensatez", "chega"]

SETLIST_FRACTION = 0.4


def _chord_line(rnd: random.Random) -> str:
    bars = []
    for _ in range(rnd.randint(1, 4)):
        gap = " " * rnd.randint(1, 3)
        bars.append(gap.join(rnd.choice(CHORDS) for _ in range(rnd.randint(1, 2))))
    return rnd.choice([" | ", "  |  ", " |", "| ", " |  "]).join(bars)


def _chart_body(rnd: random.Random) -> list[str]:
    out: list[str] = []
    for _ in range(rnd.randint(1, 4)):
        r = rnd.random()
        if r < 0.15:
            out.append("//" + " " * rnd.randint(0, 2)
                       + " ".join(rnd.choice(WORDS) for _ in range(rnd.randint(1, 3))))
        elif r < 0.55:
            out.append(_chord_line(rnd))
        else:  # a sung line: chords over the words below them
            out.append(_chord_line(rnd))
            out.append(" ".join(rnd.choice(WORDS) for _ in range(rnd.randint(2, 5))))
    return out


def _section(rnd: random.Random) -> list[str]:
    hashes = "#" * rnd.randint(2, 3)
    lines = [hashes + " " * rnd.randint(1, 2) + rnd.choice(SECTIONS)]
    fence = "`" * rnd.randint(3, 5)
    lines.append(fence)
    lines.extend(_chart_body(rnd))
    lines.append(fence)
    return lines


def _voicings(rnd: random.Random) -> list[str]:
    lines = ["## Voicings: E2 A2 D3 G3 B3 E4"]
    for _ in range(rnd.randint(1, 3)):
        gap = " " * rnd.randint(1, 2)
        lines.append("-" + gap + rnd.choice(SYMBOLS) + ":" + gap + rnd.choice(SHAPES))
    if rnd.random() < 0.4:
        lines.append("## Voicings: G4 C4 E4 A4")
        for _ in range(rnd.randint(1, 2)):
            lines.append("- " + rnd.choice(SYMBOLS) + ": " + rnd.choice(UKE))
    return lines


def _song(rnd: random.Random) -> str:
    lines: list[str] = []
    if rnd.random() < 0.85:
        lines.append("#" + " " * rnd.randint(1, 3) + rnd.choice(TITLES))
        lines.append("")
        props = rnd.randint(0, 3)
        for _ in range(props):
            lines.append("- " + rnd.choice(PROP_KEYS) + ":"
                         + " " * rnd.randint(1, 3) + rnd.choice(PROP_VALUES))
        if props:
            lines.append("")
    for _ in range(rnd.randint(1, 3)):
        lines.extend(_section(rnd))
        lines.extend([""] * rnd.randint(1, 2))
    if rnd.random() < 0.4:
        lines.append("---")
        lines.extend(_voicings(rnd))
    return "\n".join(lines)


def _setlist(rnd: random.Random) -> str:
    lines: list[str] = []
    if rnd.random() < 0.8:
        lines.append("#" + " " * rnd.randint(1, 2) + rnd.choice(TITLES))
        lines.append("")
        for _ in range(rnd.randint(0, 2)):
            lines.append("- " + rnd.choice(PROP_KEYS) + ": " + rnd.choice(PROP_VALUES))
        if lines[-1] != "":
            lines.append("")
    num = rnd.randint(1, 3)  # non-canonical starting number; the reader renumbers
    for _ in range(rnd.randint(1, 5)):
        marker = rnd.choice([".", ")"])
        gap = " " * rnd.randint(1, 3)
        r = rnd.random()
        if r < 0.7:
            song = rnd.choice(SONGS)
            lines.append(f"{num}{marker}{gap}[{rnd.choice(TITLES)}]({song}.cifra.md)")
        elif r < 0.85:
            lines.append(f"{num}{marker}{gap}"
                         + " ".join(rnd.choice(WORDS) for _ in range(rnd.randint(1, 3))))
        else:
            lines.append(f"{num}{marker}{gap}[{rnd.choice(TITLES)}][ref]")
        num += rnd.randint(1, 2)
    return "\n".join(lines)


def _text_layer_noise(rnd: random.Random, text: str) -> str:
    """Line-ending, trailing-space, BOM and final-newline noise the text layer
    normalises (spec §1.1, corpus entries 26 and 47) — never a marker line."""
    lines = text.split("\n")
    if rnd.random() < 0.3:
        lines = [ln + " " * rnd.randint(1, 2) if ln and rnd.random() < 0.3 else ln
                 for ln in lines]
    nl = "\r\n" if rnd.random() < 0.25 else "\n"
    text = nl.join(lines)
    if rnd.random() < 0.85:
        text += nl
    if rnd.random() < 0.15:
        text = "﻿" + text
    return text


@dataclass(frozen=True)
class Document:
    name: str   # four-digit index, e.g. "0007"
    ext: str    # ".cifra.md" or ".setlist.md"
    text: str

    @property
    def filename(self) -> str:
        return self.name + self.ext


def generate_documents(seed: int, count: int) -> list[Document]:
    """A deterministic set of `count` non-canonical documents from `seed`.

    A single random.Random(seed) drawn in sequence, as the property suite's
    `cases` does, so the same (seed, count) always yields the same documents."""
    rnd = random.Random(seed)
    docs: list[Document] = []
    for i in range(count):
        if rnd.random() < SETLIST_FRACTION:
            ext, text = ".setlist.md", _setlist(rnd)
        else:
            ext, text = ".cifra.md", _song(rnd)
        docs.append(Document(f"{i:04d}", ext, _text_layer_noise(rnd, text)))
    return docs


# ---------------------------------------------------------------------------
# The three artefacts, per implementation.
# ---------------------------------------------------------------------------


def python_artefacts(doc: Document) -> dict[str, bytes]:
    """The input model, canonical text and canonical model Python produces for a
    document, as corpus bytes — the in-process implementation the drivers mirror."""
    if doc.ext == ".setlist.md":
        from cifra_md.setlist import parse_setlist, write_setlist

        model = parse_setlist(doc.text)
        canonical = write_setlist(model)
        canon_model = parse_setlist(canonical)
    else:
        model = parse(doc.text)
        canonical = write(model)
        canon_model = parse(canonical)
    return {
        "input.json": dump(model).encode("utf-8"),
        "canonical": canonical.encode("utf-8"),
        "canonical.json": dump(canon_model).encode("utf-8"),
    }


def write_inputs(in_dir: pathlib.Path, documents: list[Document]) -> None:
    """Write each generated document once, as the shared input bytes every
    implementation reads (as the corpus inputs are shared)."""
    in_dir.mkdir(parents=True, exist_ok=True)
    for doc in documents:
        (in_dir / doc.filename).write_bytes(doc.text.encode("utf-8"))


def read_artefacts(out_dir: pathlib.Path, documents: list[Document]) -> dict[str, dict[str, bytes]]:
    """Read a driver's three artefacts per document back from its out-dir."""
    result: dict[str, dict[str, bytes]] = {}
    for doc in documents:
        result[doc.name] = {
            "input.json": (out_dir / f"{doc.name}.input.json").read_bytes(),
            "canonical": (out_dir / f"{doc.name}.canonical{doc.ext}").read_bytes(),
            "canonical.json": (out_dir / f"{doc.name}.canonical.json").read_bytes(),
        }
    return result


def run_driver(argv: list[str], cwd: pathlib.Path, in_dir: pathlib.Path,
               out_dir: pathlib.Path, documents: list[Document]) -> dict[str, dict[str, bytes]]:
    """Invoke a subprocess driver once over the whole batch, then read its
    artefacts. The driver reads <in-dir> and writes the three files per
    document into <out-dir>."""
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = argv + [str(in_dir), str(out_dir)]
    proc = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"{argv[0]} driver failed (exit {proc.returncode}):\n{proc.stderr}")
    return read_artefacts(out_dir, documents)


@dataclass(frozen=True)
class Disagreement:
    doc: Document
    role: str
    values: dict[str, bytes]  # implementation -> its bytes for this artefact

    def render(self) -> str:
        out = [f"\n--- disagreement: {self.doc.filename}, {ROLE_LABELS[self.role]} ---\n",
               "document (the generated input bytes):\n", _indent(self.doc.text)]
        for impl in IMPLS:
            out.append(f"  [{impl}] {self.role}:\n")
            out.append(_indent(self.values[impl].decode("utf-8", "backslashreplace")))
        return "".join(out)


def _indent(text: str) -> str:
    body = "".join("    " + line + "\n" for line in text.splitlines())
    return body or "    (empty)\n"


def compare(results: dict[str, dict[str, dict[str, bytes]]],
            documents: list[Document]) -> list[Disagreement]:
    """Every (document, artefact) on which the three implementations' bytes are
    not all identical. A pure function over the gathered artefacts, so the
    comparison is unit-testable without any subprocess."""
    disagreements: list[Disagreement] = []
    for doc in documents:
        for role in ROLES:
            values = {impl: results[impl][doc.name][role] for impl in IMPLS}
            if len(set(values.values())) > 1:
                disagreements.append(Disagreement(doc, role, values))
    return disagreements


def render_report(disagreements: list[Disagreement], seed: int) -> str:
    out = [f"cross-check: {len(disagreements)} disagreement(s) at seed {seed}\n"]
    out.extend(d.render() for d in disagreements)
    return "".join(out)


def cross_check(seed: int, count: int, root: pathlib.Path = ROOT
                ) -> tuple[list[Document], list[Disagreement]]:
    """Generate `count` documents from `seed`, run them through all three
    implementations, and return the documents and any disagreements."""
    documents = generate_documents(seed, count)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = pathlib.Path(tmp)
        in_dir = tmp_path / "in"
        write_inputs(in_dir, documents)
        results = {
            "python": {doc.name: python_artefacts(doc) for doc in documents},
            "js": run_driver(["node", "js/tools/crosscheck.mjs"], root,
                             in_dir, tmp_path / "js", documents),
            "go": run_driver(["go", "run", "./cmd/crosscheck"], root / "go",
                             in_dir, tmp_path / "go", documents),
        }
        return documents, compare(results, documents)


def main(argv: list[str]) -> int:
    seed, count = DEFAULT_SEED, DEFAULT_COUNT
    rest = list(argv)
    while rest:
        arg = rest.pop(0)
        try:
            if arg == "--seed":
                seed = int(rest.pop(0))
            elif arg.startswith("--seed="):
                seed = int(arg.split("=", 1)[1])
            elif arg == "--count":
                count = int(rest.pop(0))
            elif arg.startswith("--count="):
                count = int(arg.split("=", 1)[1])
            else:
                print(__doc__)
                return 2
        except (IndexError, ValueError):
            print(__doc__)
            return 2
    if count < 1:
        print(__doc__)
        return 2

    _documents, disagreements = cross_check(seed, count)
    if disagreements:
        sys.stderr.write(render_report(disagreements, seed))
        return 1
    print(f"ok: {count} documents through python, js and go agree (seed {seed})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

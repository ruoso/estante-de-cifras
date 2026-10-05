# cifra_js.setlists — Setlists

## TaskJuggler entry

`task setlists` in [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) (lines
41–46), under `task cifra_js`, `depends !text_layer, format.setlist_corpus`.
The area file's header states the stream's rule: *"The app's implementation of
the format, held to the corpus byte for byte. Framework-free: the view is the
only layer that knows React"* ([`tasks/10-cifra-js.tji`](../../10-cifra-js.tji)
lines 3–4).

The `.tji` note: *"cifra.md: chapter 10 reader, canonical writer and editing
operations. Tests: unit (chapter 10 reader, writer and each editing
operation); corpus (the setlist entries from format.setlist_corpus, both
directions)."*

## Effort estimate

**2 days** (from the `.tji`).

## Repository

**cifra.md** (`/home/ruoso/devel/cifra.md`), one directory, extended by this
task:

- `js/src/` — the setlist module `setlist.js` (the §10 reader, the §10.9
  canonical writer, the §10.5 path machinery and the §10.10 editing
  operations), and a small shared `markdown.js` holding the two block-level
  primitives §10 borrows from the song chapters — the §1.4.1 title and the
  §1.9 fences — so the setlist reader and, later, `cifra_js.reader` stand on
  one implementation of them (§Decisions). Both are re-exported from
  `js/src/index.js`, flipping the `parseSetlist`/`writeSetlist`/
  `canonicalSetlist` stubs the `package` task put there.
- `js/test/` — the setlist unit suite (`setlist.test.js`, and
  `markdown.test.js` for the shared primitives), ported from the reference's
  `test_setlists.py`, plus the thirteen setlist corpus entries' checks flipped
  from expected-failure to passing in the existing harness.

This task is a **consumer** of the already-committed corpus bytes: the Python
reference generates and checks `corpus/` (the thirteen setlist entries landed
with `format.setlist_corpus`), and this task touches nothing under
`reference/` or `corpus/`. Agreement is by the corpus, not by shared code —
`setlist.js` is a **port** of `reference/cifra_md/setlist.py`, matched to it
and to the corpus, never importing, transpiling or shelling out to Python or
Go (DIRECTION §3.6).

No design delta is authored. Chapter 10 (the reader, the canonical writer, the
path rules and the editing operations) and §9.1 (the Setlist reader and
Setlist writer profiles) are already normative; the new `markdown.js` module
and the setlist unit file are an internal module layout, the implementer's
choice as `package` established — not a new architectural seam, a new runtime
dependency, or a change to designed behaviour (§Decisions).

## Inherited dependencies

- **`cifra_js.text_layer` — settled.** Complete (cifra.md `7c2106c`,
  [`cifra_js/text_layer.md`](./text_layer.md) Status): `js/src/text.js`
  delivers `decode`/`prepare`/`markerLines`/`isMarkerLine`/`NotUtf8Error`,
  re-exported from `js/src/index.js`. §10.2 prepares a setlist's text *"exactly
  as a song's is, by the text layer of §1.3"*
  ([`spec/10-setlists.md`](/home/ruoso/devel/cifra.md/spec/10-setlists.md)
  lines 52–64), so the setlist reader's first act is `prepare(bytes)` — the
  same primitive the song reader uses. `text_layer` also made the
  `<entry>/tl` corpus check born-passing for **all** forty-seven reading
  entries, the thirteen setlists included, so this task inherits a green text
  layer under every setlist entry and need not touch `/tl`.
- **`format.setlist_corpus` — settled** (cifra.md `a37c2f5`,
  [`format/setlist_corpus.md`](../format/setlist_corpus.md) Status): the
  thirteen setlist **reading** entries `corpus/35-setlist-minimal` through
  `corpus/47-setlist-text-layer`, each with the four files
  `input.setlist.md` / `input.parsed.json` / `canonical.setlist.md` /
  `parsed.json`, generated and checked by the reference. These are the bytes
  this task is held to, in both directions. (Setlist **merge** entries —
  `corpus/merge/24`, `25`, `60`–`68` — belong to `cifra_js.merge`, not here.)
- **`cifra_js.package` — settled** (transitively, through `text_layer`):
  cifra.md `552cf37`, [`cifra_js/package.md`](./package.md) — `js/` as a
  framework-free, zero-runtime-dependency ES-module package with the Vitest
  corpus harness and the expected-failure ledger. The harness
  ([`js/test/corpus/harness.js`](/home/ruoso/devel/cifra.md/js/test/corpus/harness.js))
  **already routes setlist entries** to this task's operations:
  `discover` classifies an `input.setlist.md` directory as `kind: "setlist"`
  (lines 52–75), and `readingChecks` runs its checks 1, 2, 3, 4 and 6 through
  `impl.parseSetlist` / `impl.writeSetlist` / `impl.canonicalSetlist` with the
  `.setlist.md` extension (lines 162–255). `js/src/index.js` carries the three
  setlist stubs that throw `NotImplementedError` (lines 56–68), named and
  documented for this task to fill.
- **`cifra_js.chords` — settled** (transitively): cifra.md `fe19a35`,
  [`cifra_js/chords.md`](./chords.md). Not called by the setlist module — a
  setlist holds no music and a setlist reader reads no chart (§10 header lines
  4–5) — but it established the harness conventions this task extends (checks
  are `{ id, run }`; `dump`/`compareBytes`/`compareModelBytes`/`discover`/
  `staleLedgerIds`; the "compare bytes, never deep-equal" rule; born-passing
  checks outside the ledger).
- **`format.canonical_form` — settled** (transitively, through `package`): the
  specification (including chapter 10 and §9.1), the Python reference, and the
  four-file corpus this task is held to.

Downstream: both [`text_layer.md`](./text_layer.md) and
[`chords.md`](./chords.md) name `cifra_js.setlists` as one of the tasks that
turn the stubbed whole-entry corpus checks green — this is the task that does
so for every setlist entry. `cifra_js.merge` (`depends !writer, !setlists,
format.merge`) builds on the setlist model and canonical writer to merge
setlists (§11, setlist merge entries); `cifra_js.conformance` (`depends
!writer, !setlists, !merge`) needs the setlist ledger entries flipped on its
way to an empty, honest ledger. The app's Worker (DIRECTION §3.7) reads,
writes and edits setlists through this module once the storage/sync streams
exist, and the app layer composes its book-wide edits (a song moved across the
book; a setlist moved) from the pure helpers this task exposes (§Decisions).

## What this task is

This task implements the **setlist layer** — the second file type the format
defines, independent of the song reader and writer because a setlist contains
no music. A setlist is an ordered list of song links in Markdown
([`spec/10-setlists.md`](/home/ruoso/devel/cifra.md/spec/10-setlists.md) lines
7–20); chapter 10 defines, more tightly than the song chapters, its model
(§10.6), its canonical form byte for byte (§10.9) and the editing operations
an editor applies to it (§10.10). This module is a port of
`reference/cifra_md/setlist.py`, matched to the reference and the thirteen
setlist corpus entries, not shared with them.

Concretely it adds two modules, re-exported from `js/src/index.js`:

- `js/src/markdown.js` — the two block-level primitives chapter 10 borrows:
  `mdHeading(line) → { level, text } | null` (§1.4.1, the level-1 title) and
  the §1.9 fences `fenceOpen(line) → { char, length, info } | null` and
  `closesFence(line, fence) → boolean`. Ported from
  `reference/cifra_md/parse.py` (`md_heading` line 54, `fence_open` line 62,
  `closes_fence` line 73), where the reference keeps them for both readers to
  import. Pure functions of one line.
- `js/src/setlist.js` — the reader, the writer, the path machinery and the
  editing operations, exporting at least:
  - `parseSetlist(bytes) → model` — the §10 reader (§10.6). Takes bytes
    because the text layer (§10.2) begins by validating UTF-8. Never throws on
    a setlist it does not understand: it reports in `diagnostics` and keeps
    everything (§10.8.3).
  - `writeSetlist(model) → text` — the §10.9 canonical writer.
  - `canonicalSetlist(model) → model` — model-level canonicalisation, defined
    to equal `parseSetlist(writeSetlist(model))` (apart from text-derived
    diagnostics), so it reorders each item's entries into canonical order and
    collapses repeated keys (§Decisions).
  - `songPath(dest) → { path } | { error }` — the §10.5 destination → path
    machinery (unbracket/unescape, not-a-URL, split, percent-decode + NFC,
    dot-segment removal, `.cifra.md` check), reporting which step failed.
  - `writePath(path) → string` — the §10.9.2 segment percent-encoding.
  - The §10.10 **editing operations** as pure model transforms, and the two
    helpers they rest on — `pathFromSetlistToSong(setlistDirSegments,
    songPathSegments)` and `textForSong(title | fileName)` (§What the editing
    operations cover, below).

The four remaining corpus-facing stubs in `index.js` — `parse`, `write`,
`canonical` (the song reader/writer, `cifra_js.reader`/`writer`) and `merge`
(`cifra_js.merge`) — stay stubs: this task builds no song reader and no merger.

### What the editing operations cover

§10.10 defines eight changes an editor makes, *"so that two editors make the
same change"* (lines 597–642). This framework-free core owns every one that is
a pure function of a single setlist model plus its explicit inputs, and the
two helpers all of them rest on:

- **`pathFromSetlistToSong`** — the relative path from the setlist's directory
  to a song, both given as segments from the book root (§10.10 lines 603–608).
  Pure segment arithmetic.
- **`textForSong`** — a link's text from the song's title as read, escaping
  `[`/`]`/trailing `\`, or from the song's file name (without `.cifra.md`)
  when there is no title, escaping ``\ ` * _ [ ] < &`` (§10.10 lines 610–617).
  Pure, given the title or file name — the caller reads the song.
- **Add a song**, **remove an item**, **move an item**, **set a property**,
  **remove a property**, **point an item at a song**, **refresh a link's
  text** (§10.10 lines 619–638) — each a transform of one setlist model given
  an index/position and, where needed, a path and text the caller computed
  with the two helpers. Each returns a model the canonical writer prints with
  renumbering and canonical entry order applied by `writeSetlist`.

The two **book-wide** operations — *"A song is moved or renamed within the
book"* and *"The setlist is moved"* (§10.10 lines 628–636) — resolve every
song item in every setlist of the book against the working copy, which only
the app's Worker has (DIRECTION §3.1–3.2, §3.7: the Worker owns git, the
working copy and the index). The core supplies what they need — `songPath`
(which path an item resolved from), `pathFromSetlistToSong` (the new path) and
a path-only item retarget — and the app composes the book walk and resolution
from them. This is not a new `cifra_js` leaf (§Decisions, §Acceptance
criteria): it is the app's setlist editing, built on this module.

## Why it needs to be done

A setlist is how the app plays a gig, a lesson or a rehearsal in order
(DIRECTION §3; [`spec/10-setlists.md`](/home/ruoso/devel/cifra.md/spec/10-setlists.md)
lines 7–8), and it is a file in the book beside the songs, saved and synced
and merged like any other. Reading it, writing it canonically, and editing it
are the **Setlist reader** and **Setlist writer** profiles of §9.1
([`spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md)
lines 79–110), which are *"independent of the profiles above"* (line 86) — a
program reads setlists without reading a chart. That independence is exactly
why this task `depends !text_layer` and not `!reader` or `!writer`: the only
song-chapter machinery it needs is the text layer (§1.3, have), the title and
fences (§1.4.1, §1.9, this task's `markdown.js`), and, to validate a `key`,
the roots of §5.1.1 (a self-contained regex, §Decisions).

Downstream consumers: `cifra_js.merge` (setlist merge rests on the setlist
model and canonical writer); `cifra_js.conformance` (the setlist ledger
entries must be flipped and no setlist entry left failing); and the app's
Worker and setlist UI, once the storage/sync/app streams exist, which read,
write and edit setlists through this one module and build their book-wide
edits on its helpers (DIRECTION §3.7).

## Inputs / context

- [`tasks/10-cifra-js.tji`](../../10-cifra-js.tji) lines 3–4 (stream header),
  41–46 (`task setlists`, its `depends !text_layer, format.setlist_corpus`,
  the `note` and its `Tests:` clause: unit + corpus).
- [`cifra_js/text_layer.md`](./text_layer.md),
  [`cifra_js/chords.md`](./chords.md) and [`cifra_js/package.md`](./package.md)
  — the predecessors: the harness shape (`readingChecks(entry, impl)`
  returning `{ id, run }`; `discover`/`dump`/`compareBytes`/
  `compareModelBytes`/`staleLedgerIds`), the expected-failure ledger
  convention (listed → asserted to fail, unlisted → asserted to pass, executed
  either way; a stale id fails the harness), the zero-runtime-dependency rule,
  the *"compare bytes, never deep-equal"* rule, the born-passing-check pattern
  (`<entry>/tl`, `<entry>/chords` live outside the ledger), and the
  "corpus-facing operations are stubs until their task" seam.
- [`format/setlist_corpus.md`](../format/setlist_corpus.md) — the corpus this
  task is held to: the thirteen reading entries, their four-file layout, the
  both-directions checks, and the rule that fixtures carry **no** referenced
  song files because a setlist's canonical form is a function of its text
  alone (§10.9, §10.9.3).
- **Specification (normative) —
  [`spec/10-setlists.md`](/home/ruoso/devel/cifra.md/spec/10-setlists.md):**
  - Header lines 1–31 — depends on §0, §1.4 (title, properties), §1.9 (fences),
    §5.1.1 (roots, for `key` only); *"Nothing in a setlist is music, and a
    setlist reader reads no chart"* (lines 4–5); chapter 10 *"defines a
    setlist's canonical form completely, byte for byte"* and a program decides
    canonicality *"from its text alone, without the songs it names"* (lines
    27–31).
  - §10.1 files and books lines 32–51 — `<name>.setlist.md`; *"A reader MUST
    accept a setlist whatever its name"*; a setlist points only at songs in the
    same book, by relative path; the book root is not written in the setlist.
  - §10.2 text lines 52–64 — prepared *"exactly as a song's is, by the text
    layer of §1.3"*; a lone CR ends a line because that is what CommonMark
    reads and *"what a line begins with decides what it is"*.
  - §10.3 structure lines 66–100 — the six-way line classification order
    (fences, title, property lines, item lines, entry lines, notes lines,
    lines 70–84); the **bullet line** and **entry** definitions and the
    property rule — key is `[A-Za-z0-9_-]+`, case-insensitive, held lowercase;
    the space after `:` is required (lines 86–100).
  - §10.3.1 title and properties lines 102–123 — the level-1 heading read as a
    song's title (§1.4.1); *"a title whose text is empty, `#` alone, is no
    title"*; properties are bullet lines right after the title (or first when
    no title), blank lines allowed between; a repeated key keeps its first
    position with the last value and is reported (lines 121–123).
  - §10.3.2 items lines 125–147 — an item line is 0–3 spaces, 1–9 digits, `.`
    or `)`; *"The number written on it is ignored"* — items number 1, 2, 3 by
    position; a **song item** is an item whose content is exactly one song
    link, any other is an **unlinked item** kept, reported and skipped but
    never dropped and still counted; four-or-more leading spaces is not an item.
  - §10.3.3 entries under an item lines 149–161 — a bullet line after an item
    (only blanks and bullets between) is the item's entry whatever its
    indentation; a bullet after a notes line is notes.
  - §10.3.4 notes lines 163–181 — every other non-blank line is notes, kept
    verbatim in place, never interpreted (a link in notes is not a song);
    HTML is not recognised.
  - §10.4 links lines 183–229 — the exact shape of a **song link**; plain vs
    bracketed destination; §10.4.1 lines 210–229 — *"The target decides which
    song an item is; the text does not"*; the text is kept as written; a
    reader shows the song's own title (read from the song), falling back to the
    text only for a missing song or no book.
  - §10.5 paths lines 231–277 — the six-step destination → path: unbracket and
    unescape, not-a-URL (no scheme, no `?`/`#`, no leading `/`), split at `/`
    with no empty segment, percent-decode each segment with UTF-8 validation +
    NFC, remove dot segments (RFC 3986 §5.2.4), last segment ends in
    `.cifra.md`; each failing step named; a `\` that is not an escape is a file
    name character and is reported.
  - §10.6 the model lines 279–310 — `Setlist { title, properties[], body[] }`,
    `Entry` (Property | Unrecognised), `Item` (Song | Unlinked, with
    `entries[]`), `Notes { lines[] }`; the setlist also carries `diagnostics`,
    each with a line; resolution is **not** part of what reading produces and
    the canonical form does not depend on it.
  - §10.7 item properties lines 312–361 — the reserved `key` and `note`, every
    other key application-defined and kept; §10.7.1 lines 326–355 — `key` is a
    target key; the three cases a reader does **not** apply it (song has no/bad
    key; modes differ; the setlist's value is not a key — and that last is
    reported), a `key` not applied is still kept and written back; §10.7.2 the
    note lines 357–361.
  - §10.8 resolving and playing lines 363–418 — §10.8.1 resolution (join to the
    setlist's directory, each leading `..` goes up; above the book root is
    *outside the book*; a reader with no book resolves nothing, which is not an
    error); §10.8.2 playing (same song twice allowed; a missing song kept,
    reported, skipped; an empty setlist is a setlist); §10.8.3 the table of
    what is reported and when (reading vs resolving).
  - §10.9 canonical form lines 420–595 — §10.9 (depends on the text alone; is
    unique; is a fixed point; keeps what was written, the one exception a
    repeated key); §10.9.1 the text (UTF-8, no BOM, NFC, LF, no tab, no
    trailing space, no leading/trailing blank line, one final LF; the empty
    setlist is the zero-byte file); §10.9.2 the lines (parts separated by one
    blank line; metadata part; runs of items and notes blocks; item line
    format; path written by §10.9.2; entry line indentation = marker width;
    item entry order `key`, `note`, then the rest; the NFC-by-construction
    argument lines 539–544); §10.9.3 the link text is **not refreshed** on
    canonicalise (lines 546–561); §10.9.4 the worked example (lines 563–595).
  - §10.10 editing operations lines 597–642 — the path from the setlist to a
    song, the text for a song, and the eight operations (add, remove, move,
    set/remove a property, point at a song, song moved/renamed in the book,
    setlist moved, refresh text); *"An editor MUST NOT, on its own initiative,
    remove a missing, unlinked or outside item, or change what one points at"*
    (lines 640–642).
  - §10.11 Markdown compatibility lines 643–659; §10.12 conformance lines
    661–665 (the setlist profiles are in §9.1 and independent of the song
    profiles); Open questions lines 667–687 (the §10.6 JSON Schema is deferred,
    so check 5 is not run over a setlist model).
- [`spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md)
  lines 79–110 — the **Setlist reader** profile (*"Must meet: §10.1 to
  §10.8"*, the specific MUSTs lines 89–100) and the **Setlist writer** profile
  (*"Must meet: §10.9 and §10.10"*, *"MUST write every setlist in the canonical
  form, which it decides from the setlist's text alone, and MUST NOT change a
  link's text except when the user asks"*); §9.2 universal rules lines 112–127
  (a reader MUST NOT fail on a line it does not understand, MUST NOT alter the
  document, MUST keep unknown properties, MUST report whatever it does not
  keep); §9.3 line 140 — *"The corpus has no entries for reading setlists
  yet"* is now stale (the thirteen entries landed with `format.setlist_corpus`),
  surfaced for format-area review, not edited here (§Decisions).
- **Reference, the behaviour to match** (port, never import —
  `/home/ruoso/devel/cifra.md/reference/`):
  - `reference/cifra_md/setlist.py` — the module docstring (lines 1–20) gives
    the model shape in plain dicts; the regexes `BULLET`, `ITEM`, `PROPERTY`,
    `SCHEME`, `ASCII_PUNCT`, `SAFE` (lines 30–35); `entry_of` (42) and `_lower`
    (38); `_link` (53) and `_unescape` (110); `song_path` (126, the six §10.5
    steps with named reasons) and `write_path` (179, the §10.9.2 encoding incl.
    the "non-ASCII after a percent-encoded character is encoded too" rule);
    `_set_entry` (204, the repeated-key `duplicate-key` and the
    `unrecognised-entry` report) and `_check_key` (217, `bad-key`); the `KEY`
    regex `^[A-G](?:#|b|♯|♭)?m?$` (330); `parse_setlist` (222, the line loop,
    the fence state, the item/entry/notes classification and the diagnostics
    sorted by line, line 326); `entry_line` (340), `ordered_entries` (347, the
    `key`→`note`→rest order), `item_content` (353), `item_lines` (360, the
    marker-width indent), `write_setlist` (367, parts joined by one blank line),
    `canonicalise_setlist` (396, `write_setlist(parse_setlist(text))`). The
    diagnostic codes to match: `backslash-in-path`, `bad-path`,
    `unlinked-item`, `duplicate-key`, `unrecognised-entry`, `bad-key`,
    `unclosed-fence`.
  - `reference/cifra_md/parse.py` — `md_heading` (54), `fence_open` (62),
    `closes_fence` (73), and the helpers they use (`MD_HEADING`, `FENCE`,
    `heading_text`, `ascii_lower`): the §1.4.1/§1.9 primitives `markdown.js`
    ports.
  - `reference/tests/test_setlists.py` (210 lines) — the §10 unit cases to
    port: the §10.9.4 example (`test_the_example_of_10_9_4`), the examples are
    canonical and a fixed point, the empty setlist is the empty file, an empty
    title is no title, properties follow the title with blank lines between and
    with no title, a repeated key keeps its first place and last value, item
    entries are written `key` then `note` then the rest, entry indentation
    follows the number, numbers are positions, four spaces before a number is
    notes, a bullet after notes is notes, a fence in the notes hides items, an
    unclosed fence runs to the end and is reported, the unlinked-items table,
    the paths table and the paths-that-fail table with their step, writing
    paths, link text kept as written, a bad key reported and kept, notes keep
    leading spaces and inner blank lines.
  - `reference/tests/test_setlist_corpus.py` (69 lines) — how the reference
    runs the thirteen entries in both directions; the JS mirror is the harness.
- **Corpus (the thirteen setlist reading entries) —
  `/home/ruoso/devel/cifra.md/corpus/`:** `35-setlist-minimal`,
  `36-setlist-empty`, `37-setlist-title-only`, `38-setlist-no-title`,
  `39-setlist-title-properties`, `40-setlist-renumbering`,
  `41-setlist-unlinked`, `42-setlist-item-properties`, `43-setlist-song-twice`,
  `44-setlist-notes-blocks`, `45-setlist-paths`, `46-setlist-link-text`,
  `47-setlist-text-layer` — each with `input.setlist.md`, `input.parsed.json`,
  `canonical.setlist.md`, `parsed.json`. They pin, respectively: the minimal
  setlist; the empty (zero-byte) setlist; title only; no title; title +
  properties (recognised/unrecognised, case, order, repeated key); renumbering
  (`)` markers, arbitrary/out-of-order numbers → `1. 2. 3.`); unlinked items
  (plain text, link + title, reference link, image); item properties (`key`,
  `note`, app-defined, canonical `key`→`note`→rest order); a song played twice;
  notes blocks splitting item runs with numbering continuing; path spelling
  (percent-encoding, non-ASCII raw, dot segments removed, relative target);
  link text preserved and not refreshed, with escapes; and text-layer quirks
  (CR/CRLF, tabs, U+FEFF, trailing spaces, non-NFC). Several entries carry
  **non-canonical** input, so `input.parsed.json` differs from `parsed.json`
  only in `diagnostics`, except `42-setlist-item-properties`, whose item
  entries are in input order in `input.parsed.json` and in canonical
  `key`→`note`→rest order in `parsed.json` — the model-level change check 6
  pins.
  [`corpus/README.md`](/home/ruoso/devel/cifra.md/corpus/README.md) lines
  19–60 — the six checks and the rule that setlist entries run 1–4 and 6 but
  not 5 (no setlist JSON Schema yet).
- **Harness (what this task extends) —
  `/home/ruoso/devel/cifra.md/js/`:**
  - `js/test/corpus/harness.js` — `discover` (52–75, already classifies
    `kind: "setlist"`); `readingChecks` (162–255, already routes setlists to
    `parseSetlist`/`writeSetlist`/`canonicalSetlist`, ext `.setlist.md`, and
    builds checks `1`/`2`/`3`/`4`/`6` plus the born-passing `tl`); check 6
    strips top-level `diagnostics` and `sungAt` before comparing (`stripModel`,
    115–121). No harness change is needed for setlists to run — only the three
    stubs' real implementations and the ledger pruning.
  - `js/test/corpus.test.js` — loads `expected-failures.json`, guards it with
    `staleLedgerIds`, and asserts each check fail/pass per the ledger.
  - `js/test/corpus/expected-failures.json` — currently lists, for every one of
    the thirteen setlist entries, the five ids `/1 /2 /3 /4 /6` (65 ids). This
    task **removes** those 65 ids (they become passing), and adds none.
  - `js/src/index.js` lines 56–68 — the three setlist stubs this task flips.

## Constraints / requirements

- **The §10 reader, byte for byte against the corpus model.** `parseSetlist`
  produces the §10.6 model — `{ title, properties, body, diagnostics }` — with
  the reference's exact key order and value shapes, because the corpus check
  serialises the produced model with `dump` (`JSON.stringify(…, 2) + "\n"`)
  and compares it to the stored JSON **byte for byte** (the package rule:
  compare bytes, never deep-equal). The pinned shapes:
  - item order of keys — song: `{ type: "song", number, text, path, entries }`;
    unlinked: `{ type: "unlinked", number, content, entries }`; notes:
    `{ type: "notes", lines }`;
  - entry order of keys — property: `{ type: "property", key, value }`;
    unrecognised: `{ type: "unrecognised", text }`;
  - diagnostic order of keys — `{ code, message, line }`, the array sorted by
    `line`;
  - `title` is the heading text or `null` (`#` alone is `null`, §10.3.1);
    `number` is the item's **position** from 1, not the digits written;
    `key` is lowercased; `value` may be empty.
- **The six-way classification, in order, with the fence rule first** (§10.3
  lines 70–84). A fence opened in notes hides items, entries and the title to
  the line that closes it; an unclosed fence runs to the end and is reported
  (`unclosed-fence`). An item line is 0–3 leading spaces (four or more is
  notes), 1–9 digits, `.` or `)`. An entry belongs to the item above only when
  nothing but blanks and bullets separates them, and only before a notes line
  intervenes. The required space after a property `:` is enforced so that
  `- https://example.com/` is an unrecognised entry, not the key `https`.
- **The target is authoritative; the text is a label, kept as written**
  (§10.4.1). `parseSetlist` never rewrites a link's text, never refreshes it
  from a song (it reads no song), and `writeSetlist` copies it verbatim
  (§10.9.3). An item whose content is not exactly one song link — a link with
  a title, a reference link, an image, a link with trailing text, plain text,
  empty — is an unlinked item: content kept, reported (`unlinked-item` or
  `bad-path`), counted in the numbering, never dropped.
- **Paths decoded and written exactly as §10.5/§10.9.2 say.** `songPath` runs
  the six steps and, on failure, reports which step failed (`bad-path` with the
  reason); a `\` that is not an escape is a file-name character and is reported
  (`backslash-in-path`). `writePath` percent-encodes per §10.9.2, including the
  rule that a non-ASCII character immediately after a percent-encoded one is
  itself percent-encoded (so an accent cannot compose with a decoded `%3C`).
  The path is stored as decoded segments joined by `/`.
- **Canonical form constrains every byte** (§10.9). `writeSetlist` emits parts
  separated by exactly one blank line (metadata, then runs of items and notes
  blocks in document order), consecutive items with no blank between them,
  items renumbered 1, 2, 3…, item entries in `key`→`note`→rest order with a
  repeated key at its first position with its last value, entry indentation
  equal to the marker width (3 for items 1–9, 4 for 10–99), and the whole text
  text-layer-clean with one final LF — or the **zero-byte file** for a setlist
  with no title, properties, items or notes. It decides canonicality from the
  model alone and depends on no song.
- **A `key` is validated but never required and never dropped.** `parseSetlist`
  reports `bad-key` when a `key` value is not a root-then-optional-`m` (the
  `KEY` regex, §10.7.1), but keeps it and writes it back. The reader does not
  resolve a `key` against a song (it reads no song) and does not transpose;
  applying or showing-as-a-note a `key` is the app's, with the song in hand.
- **The editing operations are deterministic and canonical** (§10.10). Each
  pure model operation yields a model `writeSetlist` prints in canonical form;
  two editors making the same change produce the same bytes. The core does not,
  on its own initiative, remove a missing/unlinked/outside item or change what
  one points at (§10.10 lines 640–642) — those are explicit operations the
  caller invokes. The two book-wide operations are the app's (need the book);
  the core gives them `songPath`, `pathFromSetlistToSong` and a path-only
  retarget.
- **Framework-free, zero runtime dependencies** (DIRECTION §3.7; stream header;
  [`package.md`](./package.md) §Constraints). `js/src/markdown.js` and
  `js/src/setlist.js` import nothing from Node and add no `dependencies` entry
  — only regular expressions, `String.prototype.normalize` (NFC), the text
  layer and plain objects/arrays. They know nothing of React, storage, the
  network or the filesystem; a setlist reader with no book resolves nothing,
  and resolution against a real book is the Worker's. Node built-ins may appear
  only under `js/test/`.
- **Agreement is by the corpus, not shared code** (DIRECTION §3.6). The modules
  are a **port** of `setlist.py`/`parse.py`; they import, transpile or shell
  out to no Python or Go. The §5.1.1 roots a `key` needs are a self-contained
  `KEY` regex (as the reference's is), not an import of `chord.js`/`pitch.js`
  (§Decisions).
- **Standing rules scoped where they apply:** *Canonical form over preserving
  content* — a setlist is always written in canonical form, the one place
  content is lost is a repeated key's earlier value (§10.9); this module writes
  canonical form only and preserves no non-canonical spelling; a marked text
  (conflict markers) is never produced here (that is `cifra_js.merge`). *Test
  fixtures are purpose-written* — the unit tests use tiny invented setlists and
  the purpose-written corpus entries 35–47, never anyone's copyrighted words or
  real song files. *No song text in logs*, *offline first*, *accessibility* and
  *no book without an account* do not apply: this is a pure format module with
  no UI, network, storage or logging (noted so the omission is deliberate, per
  the brief).

## Acceptance criteria

**Behaviour delivered.** `js/src/setlist.js` implements the §10 reader
(§10.1–§10.8, the model of §10.6 and the diagnostics of §10.8.3), the §10.9
canonical writer, the §10.5/§10.9.2 path machinery, and the §10.10 editing
operations; `js/src/markdown.js` implements the §1.4.1 title and §1.9 fence
primitives; both are re-exported from `js/src/index.js`, flipping the
`parseSetlist`/`writeSetlist`/`canonicalSetlist` stubs. The thirteen setlist
corpus entries pass checks 1, 2, 3, 4 and 6 in both directions. `scripts/gate
cifra.md` runs it all via `npm test` in `js/`, alongside the reference's
unchanged `pytest`. The four remaining `index.js` stubs (`parse`, `write`,
`canonical`, `merge`) stay stubs.

**Tests the task lands with, by level** (the `.tji` `Tests:` clause names
unit + corpus; format work's conformance level **is** the corpus — there are
no behavior, e2e-api or e2e-web levels):

- **unit (Vitest, `js/test/markdown.test.js`)** — the shared primitives on
  purpose-written lines, ported from the reference's `parse.py` behaviour:
  `mdHeading` (a level-1 `# `, leading spaces, `#` alone → no text, a level-2+
  or non-heading → `null`); `fenceOpen` (a backtick/tilde run of length ≥ 3,
  the info string, a backtick in a backtick fence's info → not a fence);
  `closesFence` (same char, length ≥ the opener's, nothing after). Pins §1.4.1
  and §1.9 as chapter 10 uses them.
- **unit (Vitest, `js/test/setlist.test.js`)** — the §10 reader, writer and
  **each editing operation**, ported from `reference/tests/test_setlists.py`
  on purpose-written setlists:
  - *Structure and classification*: the title (level-1 only, `#` alone is no
    title, named by file name when absent); properties after the title with
    blank lines between and with no title; numbers are positions, `)` accepted,
    out-of-order/gap/repeat numbers renumbered; four spaces before a number is
    notes; a bullet after a notes line is notes; a fence in the notes hides
    items; an unclosed fence runs to the end and is reported (pins §10.3,
    §10.3.1–§10.3.4).
  - *Items, links and entries*: a song item vs the unlinked-item table (plain
    text, link + title, reference link, image, trailing text, empty); item
    entries kept in order; a repeated key keeps its first place and last value
    (`duplicate-key`); an unrecognised entry kept (`unrecognised-entry`); the
    required space after `:` (pins §10.3.2–§10.3.3, §10.4, §10.7).
  - *Paths*: the §10.5 success table and the failure table with the step each
    fails at; a non-escape `\` reported (`backslash-in-path`); `writePath` on
    the §10.9.2 cases including a space, `&`, `(`, a non-ASCII segment, and the
    non-ASCII-after-percent rule (pins §10.5, §10.9.2).
  - *The canonical writer*: the §10.9.4 example canonicalises to the stated
    bytes; the canonical form is a fixed point; the empty setlist is the empty
    file; item entries written `key`→`note`→rest; entry indentation follows the
    number; notes keep leading spaces and inner blank lines; a notes block
    splits a run of items with numbering continuing (pins §10.9).
  - *The `key` property*: a value that is not a key reported (`bad-key`) and
    kept and written back; a valid `key` kept (pins §10.7.1).
  - *Each editing operation* (§10.10): `pathFromSetlistToSong` (a song beside
    the setlist → its file name; shared-prefix trimming; one `..` per leftover
    directory segment); `textForSong` (a title with `[`/`]`/trailing `\`
    escaped; no title → the file name with ``\ ` * _ [ ] < &`` escaped); add a
    song (at a position and last, no entries); remove an item (its entries go
    with it, renumbered); move an item; set a property (added or replaced) and
    remove a property; point an item at a song (path and text change, entries
    kept); refresh a link's text (text changes only); each result re-read to
    the expected model and written to the expected canonical bytes. The
    path-only retarget the app's book-wide moves use is exercised here too.
  - *`canonicalSetlist`*: on a non-canonical input model (e.g. item entries out
    of canonical order, a repeated key) it returns the canonical model, equal
    to `parseSetlist(writeSetlist(model))` (pins the §10.9 model-level
    canonicalisation that corpus check 6 also pins).
- **corpus (Vitest, `js/test/corpus.test.js` via `js/test/corpus/harness.js`)**
  — the thirteen setlist entries `35-setlist-minimal`…`47-setlist-text-layer`
  pass checks `1` (read `input.setlist.md` → `input.parsed.json`), `2` (write
  that model → `canonical.setlist.md`), `3` (read `canonical.setlist.md` →
  `parsed.json`), `4` (write that model → `canonical.setlist.md`, the fixed
  point) and `6` (model-level canonicalise `input.parsed.json` → `parsed.json`,
  stripped of diagnostics), each **byte for byte in both directions**. The 65
  ids (`<entry>/1 /2 /3 /4 /6` for the thirteen) are **removed** from
  `js/test/corpus/expected-failures.json`; `checkIds` still finds them (the
  harness already enumerates them), so the ledger stays stale-free
  (`staleLedgerIds`) and `cifra_js.conformance` is that much closer to an empty
  ledger. The born-passing `<entry>/tl` check stays green on all thirteen (no
  `<entry>/chords` check exists for setlists — they hold no chords). This pins
  §10 against the committed corpus bytes `format.setlist_corpus` produced.

The `.tji` `Tests:` clause is sharpened to these files and cases; no level it
names is dropped.

**Deferred work.** None registered by this task. The two **book-wide** §10.10
operations (a song moved or renamed across the book; the setlist moved) are
**not** a new `cifra_js` leaf: they are the app's setlist editing, which
resolves items against the working copy the Worker owns, and they build on the
`songPath`, `pathFromSetlistToSong` and path-only-retarget surface this task
delivers — part of the app's storage/sync/songs streams (DIRECTION §3.1–3.2,
§3.7), not a format task. The setlist JSON Schema (§10.6, §10 Open questions)
is a format-area matter governing corpus check 5, which setlists do not run;
it is not this task's and is not created as a leaf. The two stale prose points
surfaced below are format-area judgements, not WBS tasks (the brief forbids
audit tasks).

## Decisions

- **Two modules: `setlist.js` for chapter 10, `markdown.js` for the two shared
  block primitives.** The §1.4.1 title and the §1.9 fences are document-wide
  primitives chapter 10 borrows and the song reader will borrow again; the
  reference keeps them in `parse.py` and `setlist.py` imports them from there.
  Because `cifra_js.reader` is not built yet (it is a parallel branch, `depends
  !chords`), the setlist reader cannot import them from a song-reader module
  that does not exist. Putting them in a small, neutral `markdown.js` gives one
  implementation the setlist reader uses now and `cifra_js.reader` imports when
  it lands — the standing rule that implementations hold one correct copy of a
  thing (DIRECTION §3.6), satisfied without either reader depending on the
  other's internals. *Rationale:* a shared primitive wants a shared home; a
  born-once module is cheaper than a later de-duplication. *Alternatives
  rejected:* (a) private copies inside `setlist.js` — forces `cifra_js.reader`
  either to duplicate the fence logic (two copies to keep in step) or to import
  a §1.9 primitive from the setlist module, an odd dependency direction; (b)
  creating `js/src/parse.js` now with only these four functions — implies the
  setlists task owns the song reader's module before the reader exists, and
  the reader task may want to lay `parse.js` out differently. `markdown.js` is
  a module-layout choice the implementer may rename; `package` fixed only the
  `index.js` surface, not the private module split.

- **Plain-object model with pinned key order, matching the reference and the
  corpus.** The model is built as plain objects/arrays in the reference's exact
  key order (`title`, `properties`, `body`, `diagnostics`; items and entries as
  above), with `diagnostics` sorted by line. *Rationale:* the corpus check
  serialises the produced model with `dump` and compares byte for byte, so key
  insertion order and array order are part of conformance; the reference uses
  dicts in exactly this order. *Alternative rejected:* classes/factories
  compared by deep-equal — breaks the "compare bytes, never deep-equal" rule
  and risks serialisation drift from the reference.

- **`canonicalSetlist` is model→model, defined as `parseSetlist(writeSetlist)`.**
  The harness's check 6 calls `impl.canonicalSetlist(model)` and expects a
  model, not text (the reference's `canonicalise_setlist` is text→text; the JS
  seam, like the song-side `canonical`, is model-level, `index.js` line 66).
  Defining it as read-after-write — write the model to canonical text, read it
  back — reorders each item's entries into `key`→`note`→rest, collapses a
  repeated key to its first position with its last value, and renumbers, with
  no second code path to keep in step with the writer. It is provably correct
  from checks 2 and 3: `canonicalSetlist(input.parsed.json) =
  parseSetlist(writeSetlist(input.parsed.json)) = parseSetlist(canonical.setlist.md)
  = parsed.json`. *Rationale:* one canonicalisation, defined in terms of the
  two operations the corpus already pins, cannot disagree with them.
  *Alternative rejected:* a separate direct model→model transform — a third
  code path that must be held byte-identical to write-then-read for no gain.

- **The §10.10 pure operations and helpers live in the core; the two book-wide
  operations are the app's.** Every §10.10 operation that is a function of one
  setlist model plus explicit inputs — add, remove, move, set/remove a
  property, point at a song, refresh text — and the two helpers
  (`pathFromSetlistToSong`, `textForSong`) are pure and belong in the
  framework-free core, unit-tested here. *"A song is moved or renamed within
  the book"* and *"The setlist is moved"* resolve every item in every setlist
  against the working copy, which the core (no filesystem) cannot see; the
  Worker owns git and the working copy (DIRECTION §3.1–3.2, §3.7), so the app
  composes those two from the core's `songPath` (what an item resolved from),
  `pathFromSetlistToSong` (the new path) and a path-only retarget. *Rationale:*
  the component boundary — the core is pure, the Worker owns the book — is
  DIRECTION's, and the spec itself frames these two in terms of resolution. The
  `.tji` says *"each editing operation"* lands unit-tested; every operation the
  core can perform purely does, and the book-wide pair's reusable pieces land
  and are tested here, leaving only the app's book walk to the app. *Alternative
  rejected:* a fake-filesystem book model inside the core to run the two
  book-wide ops end to end — invents a seam the core should not own, duplicates
  the Worker's resolution, and is untestable by any corpus entry (the corpus
  carries no referenced song files).

- **A self-contained `KEY` regex, not an import of the chord/pitch modules.**
  §10.7.1's `key` is *"a root as in §5.1.1, then `m` for minor or nothing for
  major"* — a small regex `^[A-G](#|b|♯|♭)?m?$`, which the reference writes
  inline (`setlist.py` line 330) rather than calling `parse_note`. *Rationale:*
  the dependency §10 declares on §5.1.1 is "the roots", a one-line shape, not
  the chord grammar; matching the reference keeps the setlist module
  independent of the chord layer (the Setlist reader profile is independent of
  the chord profiles, §9.1). *Alternative rejected:* importing `isNote` from
  `pitch.js` — pulls the chord layer into a module that reads no music and
  diverges from the reference's own split.

- **Setlists carry no `chords` corpus check.** Unlike the song entries,
  nothing in a setlist is a chord (§10 header line 4), so the harness's
  `collectChordItems` finds none and adds no `<entry>/chords` check — the
  setlist entries' corpus footprint is exactly checks 1–4 and 6 (and the
  born-passing `tl`). *Rationale:* stated so the closer does not expect a
  `chords` id for a setlist entry. *Alternative rejected:* none.

- **No design delta.** Chapter 10, §9.1 and the thirteen corpus entries are
  already normative; `markdown.js` is an internal module split; no runtime
  dependency is added. *Rationale and alternative* mirror
  [`package.md`](./package.md), [`text_layer.md`](./text_layer.md) and
  [`chords.md`](./chords.md): a format task that implements the spec as written
  needs no spec change. (Two stale prose points — §9.3 line 140 *"The corpus
  has no entries for reading setlists yet"*, which `format.setlist_corpus`
  falsified, and the §10.6/§10 Open-questions note that there is no setlist
  JSON Schema, which governs only the un-run check 5 — are surfaced for
  format-area review, not edited from this implementation task and not encoded
  as WBS/audit leaves, per the brief; see §Open questions.)

## Open questions

- **§9.3 line 140 is stale.** It reads *"The corpus has no entries for reading
  setlists yet (§10, Open questions)"*, but `format.setlist_corpus` added the
  thirteen reading entries this task is held to. Correcting the sentence is a
  one-line format-spec cleanup, not code this task lands; it is surfaced for
  format-area review / the parking lot rather than edited from a JS
  implementation task, and does not block this task.

## Status

**Done** — 2026-10-04.

- cifra.md `c72c24e`: `js/src/markdown.js` (new) — `mdHeading` §1.4.1, `fenceOpen`/`closesFence` §1.9 primitives ported from `reference/cifra_md/parse.py`
- cifra.md `c72c24e`: `js/src/setlist.js` (new) — §10 reader (`parseSetlist`), §10.9 canonical writer (`writeSetlist`), model-level canonicaliser (`canonicalSetlist`), §10.5/§10.9.2 path machinery (`songPath`, `writePath`), §10.10 editing operations and helpers (`pathFromSetlistToSong`, `textForSong`, add/remove/move/set/remove-property/point/retarget/refresh)
- cifra.md `c72c24e`: `js/src/index.js` — re-exports full markdown + setlist surface; flips the three `parseSetlist`/`writeSetlist`/`canonicalSetlist` stubs; four remaining stubs (`parse`, `write`, `canonical`, `merge`) stay stubs
- cifra.md `c72c24e`: `js/test/corpus/expected-failures.json` — removes 65 setlist ids (entries 35–47, checks /1 /2 /3 /4 /6); ledger stale-free
- cifra.md `c72c24e`: `js/test/markdown.test.js` (new) — 13 unit tests for §1.4.1/§1.9 primitives
- cifra.md `c72c24e`: `js/test/setlist.test.js` (new) — 82 unit tests: reader structure/classification, items/links/entries, paths, canonical writer, `key` property, each §10.10 editing operation, `canonicalSetlist`
- All thirteen setlist corpus entries 35–47 pass checks 1/2/3/4/6 in both directions; total Vitest suite: 638 passed

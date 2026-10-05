# Refinement — `design.example_book`

## TaskJuggler

- Task: `design.example_book` — "The example book's songs".
- Defined in [`tasks/20-design.tji`](../../20-design.tji) (lines 42–46).
- `note`: *"Songs written for the purpose (no one else's words), voiced for
  guitar, cavaquinho and ukulele, showing sections, words, variations and a
  setlist. Ships with the app. Workflow 1. Tests: none in code — each song and
  the setlist checked canonical with the cifra.md reference before it lands;
  account.first_run's tests pin them in the app."*

## Effort estimate

2d (unchanged from the `.tji`). This is a design task, but one whose
deliverable is **authored content**, not a workflow document and board and not
a format document: a small, curated songbook of purpose-written songs and one
setlist, each voiced for three instruments and each landing in cifra.md
canonical form. The budget covers writing the words and the charts, voicing
every song for guitar, cavaquinho and ukulele, building the setlist, and
running each file through the cifra.md reference until it is canonical and
reads without diagnostics — plus the one gate step that keeps it that way.

## Repository

**estante-de-cifras.** The example book ships with the app, so its files live
in this repository:

- `app/example-book/` — the authored songbook: the `*.cifra.md` songs, one
  `*.setlist.md` setlist, a `README.md` (whose level-1 heading is the book's
  title, DIRECTION §2.1 line 74) and a `.gitattributes` — a well-formed
  songbook and **nothing else** (DIRECTION §2.1 lines 63–66).
- `scripts/check-example-book` — a small script that runs every file in
  `app/example-book/` through the cifra.md reference and fails on any
  non-canonical file or any reader diagnostic; wired into
  [`scripts/gate`](../../scripts/gate) on the estante side (see Acceptance).

No `cifra.md:` work. The `.tji` note does **not** start with `cifra.md:`, and
the example book is an app asset, not part of the format: the songs are
*authored in* the cifra.md format and *checked against* the cifra.md reference
(the Python implementation at `/home/ruoso/devel/cifra.md/reference`, which the
gate already installs and runs), but nothing in `/home/ruoso/devel/cifra.md`
changes — no new spec chapter, no corpus entry, no example in that repo's own
`examples/`. The reference is used here as a tool, not edited.

## Inherited dependencies

The `design` parent task `depends bootstrap.workflows`
([`tasks/20-design.tji`](../../20-design.tji) line 7). `example_book` carries no
further `depends` of its own in the `.tji`.

- **Settled.** `bootstrap.workflows` — the fourteen workflows are decided
  (DIRECTION §7, [`docs/DIRECTION.md`](../../docs/DIRECTION.md) lines 516–546).
  Workflow 1 fixes what the example book *is* and *does* (a bundled, opt-in,
  removable local songbook); this task writes the songs that behaviour needs.
- **Settled (the format).** The cifra.md specification and its reference define
  canonical songs and setlists (spec §1–§10). This task consumes that
  specification; it does not wait on any open format task — the song, voicings
  and setlist chapters it uses are all stable, and the reference checks them.
- **Settled (sibling, already landed).** `design.home_book_format`
  ([`tasks/refinements/design/home_book_format.md`](home_book_format.md),
  complete) established the precedent for a design task that deviates from the
  workflow-document-plus-board convention because its deliverable is a
  different kind of artifact. This task follows that precedent (see Decisions).
- **Not a dependency (deliberately decoupled).** `design.instruments`
  (workflow 15, [`tasks/20-design.tji`](../../20-design.tji) lines 9–13)
  decides the app's instrument/tuning/voicing-rule model. The example book
  does **not** need it: a song's voicings are written in the cifra.md format as
  pitch-list tuning headings (spec §7), independent of how the app models an
  instrument. So this task does not wait on `design.instruments`.

The downstream consumer that cites this refinement is the build task
`account.first_run` ([`tasks/70-account.tji`](../../70-account.tji) lines
8–13), which `depends design.example_book`: it seeds the book onto the shelf
when the user chooses *open the example book*, and its own tests pin the
shipped files in the app (see Acceptance → the handshake).

## What this task is

Write the **example book**: a small, curated set of original songs and one
setlist that ship bundled with the app, so a new user with an empty shelf can
choose *open the example book* and immediately have real music to read, play,
switch instruments on, and page through as a setlist — without an account and
without the network (workflow 1).

Every song is written for the purpose — its own words, no one else's — and
voiced for the three instruments the app leads with: guitar, cavaquinho and
ukulele. Across the set the book demonstrates the four things the `.tji` note
names: **sections**, **words** (a sung cifra, chords over lyrics),
**variations** (more than one voicing of the same song on one tuning), and a
**setlist** that names the songs. Each file lands in cifra.md canonical form,
verified by the cifra.md reference.

The book is content; seeding it onto the shelf, the empty-state screen, and the
in-app tests belong to `account.first_run`. This task's job is to decide and
author the files that `account.first_run` ships.

## Why it needs to be done

Workflow 1 settles that the first screen is an empty shelf offering four ways
in, one of which is *open the example book*
([`docs/workflows/01-first-run.md`](../../docs/workflows/01-first-run.md) lines
22–33). The example book is the one way in that needs no account, no link and
no typing — the fastest path from nothing to a song, and the app's first
demonstration of what it can do (read a chart, show words under chords, switch
to the cavaquinho, play a setlist). Without the authored songs there is nothing
behind that button.

`account.first_run` ([`tasks/70-account.tji`](../../70-account.tji) lines 8–13)
`depends design.example_book` and cannot land without it: its unit test reads
*the example book's songs* and asserts they are canonical under cifra.md for
JavaScript, and its e2e-web test opens the example book on three viewports and
offline after a reload. Both need real, canonical files to exist.

## Inputs / context

Governing documents (the `.tji` note names Workflow 1 and "the cifra.md
reference"; the fuller set below is what they and DIRECTION settle):

- **Workflow 1 §Cold** — [`docs/workflows/01-first-run.md`](../../docs/workflows/01-first-run.md)
  lines 18–33. The empty shelf's four ways in, and the example book among them:
  *"open the example book, songs written for the purpose that ship with the
  app"* (lines 26–27); *"the example book comes with the app instead: open the
  example book puts it on the shelf as a local book, and it is removed like any
  other. Nothing of it is on the shelf until asked for"* (lines 29–33). The
  **normative behaviour**: bundled, opt-in, a plain local book, removable.
- **Workflow 1 §My songs** — lines 35–40. *My songs* is a **separate** local
  book, not the example book; do not conflate them.
- **DIRECTION §2.1 Songs are found by name** — [`docs/DIRECTION.md`](../../docs/DIRECTION.md)
  lines 57–74. A songbook holds `*.cifra.md`, `*.setlist.md`, a `README.md` and
  a `.gitattributes`, *"and nothing else: every song and setlist in canonical
  form"* (lines 63–66); *"A book's title is the level-1 heading of its README,
  or the repository name"* (line 74). The example book obeys this rule exactly.
- **DIRECTION §6 Open decisions** — lines 496–514. The example book is **not**
  listed: it is settled by workflow 1, so this task closes no DIRECTION gap and
  needs no DIRECTION delta (see Decisions).
- **DIRECTION §7 Workflows** — line 525 (workflow 1, *First run*).
- **DIRECTION §3.7 The app** — lines 394–427. The Web Worker owns git and the
  working copy; the example book becomes a local git repository in the Worker
  when opened. The seeding is `account.first_run`'s; this task supplies the
  files it seeds.
- **The mockup board already drawn** — [`docs/mockups/W01-first-run.dc.html`](../../docs/mockups/W01-first-run.dc.html)
  line 20 (the empty shelf, *"the example book among them, shipped with the
  app"*), lines 47 and 168 (the card: *"Open the example book — Songs that come
  with the app, put on your shelf; remove it any time"*). No new board is
  needed (see Decisions). The board's demo song *Valsa da Janela* / book *Choros
  da Ana* belongs to the **invited** door, not the example book.
- **The cifra.md specification** (`/home/ruoso/devel/cifra.md/spec/`) — the
  format the songs are authored in:
  - §1 Document — [`.../spec/1-document.md`](/home/ruoso/devel/cifra.md/spec/1-document.md)
    lines 17–26 (filename `*.cifra.md`), 72–152 (title and properties),
    154–189 (the `---` rule splitting chart from voicings), 191–309 (headings
    and sections), 311–383 (music must sit in fenced code blocks).
  - §2 Chart — [`.../spec/2-chart.md`](/home/ruoso/devel/cifra.md/spec/2-chart.md)
    lines 1–135 (measures, bar lines, chord tokens and footnote markers
    `Cm[2]`).
  - §4 Lyrics — [`.../spec/4-lyrics.md`](/home/ruoso/devel/cifra.md/spec/4-lyrics.md)
    lines 1–187 (a cifra: chords attached to words by column), 83–98 (a forced
    lyric line with `>`).
  - §5 Chord symbols — [`.../spec/5-chord-symbols.md`](/home/ruoso/devel/cifra.md/spec/5-chord-symbols.md)
    lines 237–289 (the four dialect-ambiguous spellings; default notation
    `brazilian`).
  - §6 Tunings — [`.../spec/6-tunings.md`](/home/ruoso/devel/cifra.md/spec/6-tunings.md)
    lines 1–73. A tuning is a pitch list and is the instrument's identity:
    guitar `E2 A2 D3 G3 B3 E4`, ukulele `G4 C4 E4 A4` (lines 10–16). The spec
    gives no cavaquinho tuning; it is supplied here (see Decisions).
  - §7 Voicings — [`.../spec/7-voicings.md`](/home/ruoso/devel/cifra.md/spec/7-voicings.md)
    lines 1–234. One voicing block per tuning+variation (lines 1–19), heading
    `## Voicings: <tuning>` for the default and `## <name>: <tuning>` for a
    variation (lines 34–106); fret strings in tuning order (lines 149–175); a
    block is keyed by **pitch list, never by instrument name** (lines 66–76).
  - §8 Normalisation — [`.../spec/8-normalisation.md`](/home/ruoso/devel/cifra.md/spec/8-normalisation.md)
    lines 8–55. Canonical form is unique, a fixed point, and holds no conflict
    marker; §8.1's fixed-point rule is how a file is checked canonical.
  - §9 Conformance — [`.../spec/9-conformance.md`](/home/ruoso/devel/cifra.md/spec/9-conformance.md)
    lines 60–62 and 127–137 (a document is checked canonical by canonicalising
    and comparing; the corpus is the test suite).
  - §10 Setlists — [`.../spec/10-setlists.md`](/home/ruoso/devel/cifra.md/spec/10-setlists.md)
    lines 1–39 (a setlist is Markdown: a title and a numbered list of song
    links; extension `*.setlist.md`), 232–277 (paths are relative and point at
    songs in the same book), 312–361 (per-item `key` and `note`), 420–562
    (canonical form).
- **The cifra.md reference** (`/home/ruoso/devel/cifra.md/reference`) — the tool
  that checks each file. [`.../reference/README.md`](/home/ruoso/devel/cifra.md/reference/README.md)
  lines 9–17: after `pip install -e ".[test]"`, **`python -m cifra_md check
  FILE`** exits 0 if `FILE` is canonical and 1 if not (songs and setlists both;
  a marked text never is), and `python -m cifra_md parse FILE` /
  `python -m cifra_md write FILE` print reader diagnostics to stderr so the
  author can see what would be dropped or changed.
- **The gate already runs the reference** — [`scripts/gate`](../../scripts/gate)
  lines 376–390 create the reference's `.venv` and run its pytest and corpus
  check; this task adds a step beside them that runs `check` over the example
  book (see Acceptance).
- **Models to author against** — the ready-made canonical examples in the
  cifra.md repo: [`.../examples/two-instruments.cifra.md`](/home/ruoso/devel/cifra.md/examples/two-instruments.cifra.md)
  (two tunings, a footnote-marker occurrence `Cm[2]`),
  [`.../examples/with-words.cifra.md`](/home/ruoso/devel/cifra.md/examples/with-words.cifra.md)
  (chords over words, bracket and label headings, a forced `>` line),
  [`.../examples/variations.cifra.md`](/home/ruoso/devel/cifra.md/examples/variations.cifra.md)
  (two variations for one tuning),
  [`.../examples/gig.setlist.md`](/home/ruoso/devel/cifra.md/examples/gig.setlist.md)
  (a setlist with notes, continued numbering and per-item `key`/`note`). These
  are the house style; the example book's own songs are authored fresh here.

## Constraints / requirements

- **Canonical form over preserving content.** Every file in `app/example-book/`
  is written in cifra.md canonical form (spec §8): `python -m cifra_md check`
  exits 0 on each, and canonicalising again changes nothing. This is the
  project's first standing rule and the central constraint of this task — the
  book is the app's own demonstration that it only ever holds canonical text,
  so it must itself be flawless. No file may hold a conflict marker.
- **Songs written for the purpose — no one else's words.** All lyrics, titles
  and arrangements are original, written for the example book (the project's
  fixtures rule: never someone else's copyrighted words). This satisfies *no
  song text in logs* by construction — there is no copyrighted text to leak —
  and it is why the example book, alone among books, may ship bundled.
- **A well-formed songbook, and nothing else.** `app/example-book/` holds only
  `*.cifra.md`, `*.setlist.md`, `README.md` and `.gitattributes` (DIRECTION
  §2.1 lines 63–66): no cover art, no JSON, no stray files. The `README.md`'s
  level-1 heading is the book's title (line 74). The book reads as a normal
  local book so that *remove it like any other* (workflow 1) just works.
- **Voiced for three instruments.** Each song carries a voicing block for each
  of guitar `E2 A2 D3 G3 B3 E4`, cavaquinho `D4 G4 B4 D5` and ukulele
  `G4 C4 E4 A4` (spec §7), so a user switching instruments finds shapes in
  every song, on every one of the three.
- **Offline first — no remote.** The example book is seeded as a **local** book
  with no remote (workflow 1 lines 29–33); it works before any network and
  before any account. The seeding lives in the Web Worker (DIRECTION §3.7); the
  main thread never touches it. (The seeding itself is `account.first_run`'s;
  this task only guarantees the files are self-contained — the setlist's song
  links are relative paths within the book, spec §10 lines 232–277, so nothing
  resolves off-device.)
- **No book without an account does not constrain this task — it is the reason
  for it.** Every hosted book needs a session and a membership (DIRECTION §3.3);
  the example book sidesteps that by shipping with the app as a local book
  (workflow 1 lines 29–30). The fifty-people / `noindex` / membership machinery
  does not apply to a bundled local book. (Noted so the rule is not mis-scoped
  onto it.)
- **Accessibility applies to the consumer's screens, not this content.** The
  axe/keyboard/React-Aria rules bind the screens that render the book — the
  empty shelf and the reading views, drawn and tested by `account.first_run`
  and the reading workflows — not the authored text. (Noted so the rule is not
  mis-scoped onto a content task.) What this task owes accessibility is correct,
  canonical markup: real section headings and real words-under-chords, so the
  screen reader has a well-formed document to read (shell task
  `shell.a11y_chart`, workflow design `design.screen_reader`).
- **Component boundary.** The app and the service share no code (DIRECTION §3.6);
  this task touches neither. The one cross-repository touch is using the cifra.md
  reference as a checking tool — exactly the project's "implementations agree
  because they are checked" principle: the content is held to the Python
  reference here and to cifra.md for JavaScript in `account.first_run`, two
  independent implementations agreeing on the same bytes.

## Acceptance criteria

This is a design task whose deliverable is **authored content**, and the `.tji`
`Tests:` clause is *"none in code — each song and the setlist checked canonical
with the cifra.md reference before it lands; account.first_run's tests pin them
in the app."* So **no unit, behavior, e2e-api or e2e-web test lands in this
task** (honouring "none in code"); acceptance is the authored book, the
canonical check made into a repeatable gate step, and the named downstream
tests that will pin the content in the app. The files must be concrete and
canonical enough that `account.first_run`'s tests (below) are writable against
them.

**1. `app/example-book/` exists and is a well-formed, canonical songbook**
containing:

- **At least three songs** (`*.cifra.md`), purpose-written, each voiced for
  guitar `E2 A2 D3 G3 B3 E4`, cavaquinho `D4 G4 B4 D5` and ukulele
  `G4 C4 E4 A4`, and together covering the four things the note names:
  - a **sung cifra** — chords over original words, with `##` **sections**
    (intro / verse / chorus), one line of words carried by `>` where the
    layout needs it. Pins *words* and *sections*. (spec §4; §1 headings.)
  - a song with **variations** — two voicing blocks for one tuning (e.g. an
    easy shape set and an up-the-neck set) and at least one footnote-marker
    occurrence (`Cm[2]`) that the blocks give distinct shapes. Pins
    *variations*. (spec §7 lines 82–106; §2 lines 98–135.)
  - a third song with clear **sections** and a stated `key`, so the setlist can
    show a transposition target. Pins *sections* and the setlist's `key`.
- **One setlist** (`*.setlist.md`) naming the songs by relative path (spec §10),
  with one item carrying a `key` and one a `note`, so the book demonstrates a
  **setlist** a user can play through (workflow 12). Pins *a setlist*.
- **`README.md`** whose level-1 heading is the book's title (DIRECTION §2.1 line
  74) and whose body says, in plain words, that these are examples written for
  the app, and **`.gitattributes`** — and nothing else in the directory.
- **Every file canonical:** `python -m cifra_md check <file>` exits 0 for each,
  and `python -m cifra_md parse <file>` emits **no reader diagnostic** (the file
  reads cleanly, nothing dropped). Pins spec §8.1 (fixed point) and §9 lines
  60–62.

**2. The canonical check is a gate step, not a one-time author action.**
`scripts/check-example-book` runs the cifra.md reference (via the `.venv`
[`scripts/gate`](../../scripts/gate) already builds at lines 376–390) over every
file in `app/example-book/`, failing on any non-zero `check` or any reader
diagnostic; a step is wired into `scripts/gate` on the estante side, guarded by
`app/example-book/` existing, so it runs on every gate and the closer sees it in
the gate output. This keeps the book canonical from the moment it lands —
before `account.first_run` exists to test it — and is the task's acceptance
gate. (It is a content-conformance check run through the reference, not a
Vitest/Go/Playwright test; consistent with "none in code".)

**3. No DIRECTION delta, no new workflow document, no new mockup board.** The
example book is already settled (workflow 1; not a DIRECTION §6 gap), is not a
user flow of its own, and introduces no new on-screen state — its screens (the
empty shelf's *open the example book*, and reading the opened book) are drawn by
`W01-first-run` and the reading workflows' boards, unchanged by this task.
Nothing is added to `docs/`, `canvas.json` or `/home/ruoso/devel/cifra.md`.
(Decision below.)

**4. The handshake (tests that land in `account.first_run`, not here).** Named
so the downstream task writes them against this content; naming them here is the
handshake, not a deferral:

- **unit** (app, Vitest): *the example book's songs read without diagnostics and
  are canonical under cifra.md for JavaScript* — cifra.md-JS parses every
  shipped file with no diagnostics and confirms each is canonical
  ([`tasks/70-account.tji`](../../70-account.tji) line 12). Pins the same bytes
  this task's reference check pins, through the second implementation.
- **e2e-web** (Playwright, three viewports, axe): *a first visit on the three
  viewports, the example book opened, offline after a reload*
  ([`tasks/70-account.tji`](../../70-account.tji) line 12) — chooses *open the
  example book*, reads a song, and the book is still there offline after a
  reload. Pins workflow 1 lines 29–33.

**5. No deferred WBS follow-up.** `account.first_run` already exists in the WBS
and `depends design.example_book`; it owns the seeding/loader and the in-app
tests. This task registers no new task and parks no item.

## Decisions

### Authored content, not a workflow document or a board

The design-area convention is a workflow document plus a mockup board (README
"Design tasks"). This task deviates — like its sibling `design.home_book_format`
(which deviated to a format document because the home book is invisible) — but
further: its deliverable is **neither a document nor a drawing but the songs
themselves**. The `.tji` note says *"Songs written for the purpose … Ships with
the app"*, not "the workflow document and its board"; the book's behaviour is
already fully decided by workflow 1, and its screens already drawn by
`W01-first-run`. **Chosen:** author the book as real files in
`app/example-book/` and verify them with the cifra.md reference. **Rejected:** a
17th workflow document (no new user flow — opening and removing a local book is
workflows 1 and 7) and a new mockup board (no new screen — the empty-state
entry and the reading view are already drawn). Precedent: `design.home_book_format`
produced a format document rather than a workflow/board; the design area already
admits "the deliverable the task actually needs."

### The book lives in `app/example-book/`, and `account.first_run` bundles it

**Chosen:** the authored songbook is a committed directory `app/example-book/`
in the app package — a plain directory of `*.cifra.md`, `*.setlist.md`,
`README.md` and `.gitattributes`. `account.first_run` reads it (a Vite raw/glob
import is the expected seam) and the Web Worker seeds it as a local git repo
when the user opens it. Keeping the files as a real songbook directory — rather
than, say, a hand-built JSON blob of pre-parsed songs — means the very files
the app ships are the files the cifra.md reference checks and cifra.md-JS reads,
with no transformation that could drift. **Rejected:** (a) pre-serialising the
songs into a JS/JSON module — it would bypass the "checked canonical" guarantee
and couple the content to a parse format; (b) placing the book under `docs/` —
it is a shipped app asset, not documentation, and must be inside the app build.
The exact import/seeding mechanism is `account.first_run`'s to implement; this
task fixes only the on-disk location and that the files are a well-formed book.

### Cavaquinho is voiced by its pitch list, `D4 G4 B4 D5`

The cifra.md spec gives guitar and ukulele tunings but not the cavaquinho, and
§7 keys a voicing block by **pitch list, never by the instrument's name** (spec
§7 lines 66–76): `## Voicings: cavaquinho` is not valid. **Chosen:** voice the
cavaquinho blocks under the standard Brazilian re-entrant tuning `D4 G4 B4 D5`
(the cast tuning used across the sibling refinements' fixtures), written as the
block heading `## Voicings: D4 G4 B4 D5`. **Rejected:** `D3 G3 B3 D4` (an
octave down) — both are played, but the re-entrant `D4 G4 B4 D5` is the common
default and matches the established fixtures, so the whole project reads one
cavaquinho. The app's instrument model (`design.instruments`) may later present
this tuning under the label "cavaquinho"; that labelling is the app's, not the
file's.

### The canonical check is wired into the gate, through the reference

The `.tji` note requires each file *"checked canonical with the cifra.md
reference before it lands"*, and the closer verifies named checks in the gate's
output. **Chosen:** make the check a gate step — `scripts/check-example-book`
running `python -m cifra_md check` (and a diagnostic check via `parse`) over
every file, through the reference `.venv` the gate already builds
([`scripts/gate`](../../scripts/gate) lines 376–390) — so it is repeatable,
verifiable, and guards the book continuously, not just at authoring time.
**Rejected:** (a) a one-time manual check recorded only in the Status block —
the files would be unguarded between this task and `account.first_run`, and the
closer could not confirm it ran; (b) relying solely on `account.first_run`'s
cifra.md-JS test — that lands later and in a different implementation; the note
explicitly wants the **reference** as the landing gate, and two independent
checks is the project's agreement-by-checking principle, not redundancy.

### No DIRECTION delta

Unlike `design.explorer` and `design.instruments` (which retire a DIRECTION §6
open-decision bullet) and `design.home_book_format` (which resolved a collision
with the songbook rule), this task closes no gap in the constitution. The
example book is settled by workflow 1 and is a plain songbook under the existing
§2.1 rule — it collides with nothing. **Chosen:** no edit to `docs/DIRECTION.md`
or any workflow. **Rejected:** adding an "example book" note to DIRECTION §2 or
§6 — it would restate what workflow 1 already decides, and §6 lists only open
decisions, which this is not.

## Open questions

(none — all decided.)

The book's on-shelf label and any localisation of it (the app has four locales)
are `account.first_run`'s to decide when it seeds the book; the authored
content fixes only the book's title (its README heading) and the songs' own
words, in one language. That is a consumer decision, not an open question for
this task, and not a WBS task.

## Status

**Done** — 2026-10-05.

- `app/example-book/morning-on-the-porch.cifra.md` — sung cifra with Intro/Verse/Chorus sections, chords over original words, one `>` forced line; voiced for guitar, cavaquinho (`D4 G4 B4 D5`) and ukulele.
- `app/example-book/the-ferry-line.cifra.md` — variations: two guitar voicing blocks for `E2 A2 D3 G3 B3 E4` giving `Am` and `Am[2]` distinct shapes; also voiced for cavaquinho and ukulele.
- `app/example-book/walking-to-the-market.cifra.md` — clear sections with stated `key: G`; voiced for all three instruments.
- `app/example-book/a-short-set.setlist.md` — setlist naming all three songs by relative path; item 1 carries a `note`, item 3 a `key`.
- `app/example-book/README.md` — title heading "Example Book"; `app/example-book/.gitattributes` — well-formed songbook directory, nothing else.
- `scripts/check-example-book` — new gate step running `python -m cifra_md check` and `parse` over every file in `app/example-book/` via the reference `.venv`; fails on any non-canonical file or reader diagnostic.
- `scripts/gate` — wired the `check-example-book` step, guarded by the book directory and a cifra.md checkout existing.
- All four files pass `python -m cifra_md check` (canonical) and `python -m cifra_md parse` (no diagnostics). Gate confirmed: `check-example-book: OK (every file canonical, no diagnostics)`.

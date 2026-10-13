# How a screen reader reads a chart

Depends on: DIRECTION §2.2, §3.6–3.7, §5, §6; workflows 9, 16. This document
fixes the order in which a screen reader reads the app's rendered music — a
sung line, a chart line, a chord diagram and a conflicted place — and the
**exact announced text** of each, so the order is decided rather than left to
the incidental nesting of the chart's DOM (DIRECTION §6). It settles the open
decision DIRECTION §6 recorded, and it is the specification `shell.a11y_chart`
implements and tests against.

It is written in the register of the cifra.md specification and of
[`docs/home-book-format.md`](home-book-format.md): numbered sections, RFC 2119
conformance language, worked examples with the literal string a reader hears.

It is **not** a cifra.md format and changes nothing in the cifra.md repository.
The specification defines the document model and the canonical text only, and
it is silent on assistive technology; the reading order is an app concern and
lives on this side of the two repositories (DIRECTION §3.6–3.7: the app and the
format are separate, held together only by the API contract and the format
itself). The chart, the diagram and the conflict are **read** here from the
cifra.md model; nothing about that model is redesigned.

## 1. Scope and conformance

This document governs how the app's **drawn** music is read aloud: the
reading-view chart (DIRECTION §3.7 — chords stacked over the syllables they
belong to, measures ruled off between bar lines, chord diagrams in a strip),
and the conflicted places the reading view marks (workflow 9). It does not
govern the monospace source editor (CodeMirror 6, DIRECTION §3.7), whose text —
including a conflict's git markers — is plain text read verbatim as it is
written (§7.3).

It fixes **what is said** and **in what order**. It does not fix the ARIA
mechanics that say it — a visually-hidden text layer, `aria-label`s, `role`
grouping, the keyboard path — which are `shell.a11y_chart`'s to decide (§8),
bounded by what this document fixes.

### 1.1 Conformance language

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, MAY and OPTIONAL
are to be read as in RFC 2119.

Requirements name three actors:

- a **renderer** — the framework-free music core and chart renderer below the
  view (DIRECTION §3.7, §5). It produces the **spoken forms**: a chord's name
  (§3), a fingering's sentence (§6). Its accessible labels already exist
  (DIRECTION §5 line 482); this document does not add a seam, it fixes the
  order in which the view assembles them.
- a **view** — the React layer (the only layer that knows React, DIRECTION
  §3.7). It applies the spoken forms as ARIA in the order this document fixes.
  The Worker, which owns the data, is not involved: reading a chart aloud is
  pure client rendering of data already held (DIRECTION §3.7), so nothing here
  waits on the network.
- a **reader** — the assistive technology that walks the view's tree and reads
  the spoken tokens in order.

`shell.a11y_chart` is the renderer-and-view behaviour this document specifies;
it pins §2–§7 in its tests (§8).

### 1.2 Terms

- **Spoken token.** One unit the reader announces: a spoken chord name (§3), a
  word-run (§2), a structural phrase (a bar number, *no chord*, a boundary word
  §7). A token is the atom this document orders.
- **Word-run.** The run of words a chord sits over on a sung line — the words
  between one chord's column and the next chord's column (cifra.md §4.4), with
  padding removed (§4). Its spoken text is the words as a person would read
  them.
- **Reading.** The ordered sequence of spoken tokens for a sung line, a chart
  line, a diagram or a conflicted place.
- **Announced text.** When this document shows a reading as a single string,
  its tokens are joined with `", "` — a comma and a space (U+002C U+0020). This
  is the string a `shell.a11y_chart` unit test asserts. The comma is the
  token boundary; how the view realises that boundary (a separate labelled
  element, a list item, a comma in a hidden text layer) is §8's to decide.

### 1.3 Reading convention in this document

In a worked example a **chord token** is written in plain type (`E minor`) and
a **word-run token** in 'single quotes' (`'Quando'`), to show at a glance which
is a chord and which is a lyric. **The single quotes are a documentation device
and are not part of the announced text.** Each worked case also gives an
`Announced text (exact)` line — the literal string, without the quotes — which
is the normative string.

## 2. The sung line

A sung line's meaning is the attachment of each chord to the word character it
lands on by column (cifra.md §4.4): a musician hears *"G on Quando"*, not *"all
the chords, then all the words"*. The reading MUST preserve that attachment.

### 2.1 Interleaved, chord before its word-run, in source order

A reader MUST read a sung line as its segments in **source order**, and within
each segment the **chord first, then the word-run it sits over** (cifra.md
§4.4, §4.8). It MUST NOT read the whole chord line and then the whole lyric
line as two passes, and it MUST NOT drop the chords.

- A **lead-in** before the first chord — words that sit left of the first
  chord's column — is a word-run token with no chord before it; it reads as
  words alone, first.
- A chord over **empty space** — a chord with no word character under it, or
  over trailing padding only — reads as the chord alone, with no word-run
  token.

### 2.2 Worked example

The sung line written (as a musician types it, column-aligned):

```
G           D       Em
Quando eu te vi passar
```

`G` sits over *Quando*, `D` over *eu te vi*, `Em` over *passar*. The reading
is the chord, then the words it attaches to, then the next chord:

> G, 'Quando', D, 'eu te vi', E minor, 'passar'

Announced text (exact):

```
G, Quando, D, eu te vi, E minor, passar
```

(`Em` is spoken *E minor*, never the word "em" — §3. This is the string
`shell.a11y_chart`'s sung-line unit case asserts, and the accessible names its
behavior test reads, DIRECTION §3.7 lines 436–438; cifra.md §4.4, §4.8.)

## 3. The spoken chord name

A chord token MUST be spoken as its **name in words**, never as its glyph
string, so a reader does not read `Em` as the word "em", spell `C#m7` letter by
letter, or read `/` as "slash".

- `Em` → *E minor*
- `C#m7` → *C sharp minor seven*
- `G/B` → *G over B*

The spoken name is the **music core's accessible label** for the chord
(DIRECTION §5 line 482), produced in the user's **notation dialect** — the home
book's `notation` preference (cifra.md §5.6; workflow 16 lines 74–83) — and in
the app language. It is the same preference the visible symbol follows, so the
spoken form and the drawn form always agree; there is no per-chart dialect
control (workflow 16 line 79). The worked strings in this document are the
default (`brazilian`) reading in English; `shell.a11y_chart` fixes the asserted
string in a chosen locale.

A **footnote marker** on a chord (cifra.md §2.4 — `Cm[2]` says *which way* this
occurrence is played) MUST be appended to the spoken name as its reference, so
it stays one chord token:

- `Cm[2]` → *C minor footnote 2*
- `Cm` and `Cm[1]` → *C minor* (index 1 is the bare key, cifra.md §2.4)

## 4. Padding and the centred hyphen are silent

The canonical text's underscore padding (`W_hen`, cifra.md §4.5.2) and the
`.fill` centred-hyphen span the renderer draws where a chord opens room inside
a word (GUIDE §Charts;
[`tasks/refinements/format/render_hyphen.md`](../tasks/refinements/format/render_hyphen.md)
line 208) are **visual only**. A reader MUST NOT speak them: padding carries no
accessible text, and the centred hyphen MUST NOT be read as "hyphen".

A word split across chords MUST read as its **pieces in source order, each
after its chord** — not reassembled whole. The split is the one piece of
information it exists to carry: which chord lands on the second syllable.

Worked example — `W_hen` (canonical underscore padding, cifra.md §4.5.2) under
two chords, `C` over *W* and `G` over *hen*:

> C, 'W', G, 'hen'

Announced text (exact):

```
C, W, G, hen
```

The drawn centred hyphen between *W* and *hen* is absent from the announced
text (cifra.md §4.8; `render_hyphen.md` line 208).

## 5. The chart line

A chord-only line between bar rules (cifra.md §2.2) is read as its **measures
in order**, each measure's chords spoken by name (§3). A reader MUST expose the
measures as an **ordered group**, so the count and each measure's position are
announced; it MUST NOT speak the `|` bar glyph (the glyph is structure, not
content), and it MUST NOT drop the bar boundaries into a flat run (that loses
the metre, which is what a chart line is for).

- A measure carrying a **bar number** (a numbering anchor, cifra.md §2.8) leads
  with its number: *bar 5: …*. A reader MUST NOT number the measures of a sung
  line (cifra.md §2.8).
- The **no-chord mark** `N.C.` (cifra.md §2.6) reads *no chord*.
- A `.run`/**intro** line — chord-only with no bar rules — reads its chords in
  order as a plain sequence, **not** an ordered measure group (there is no
  metre to convey).

Worked example — the chart line `G | D | Em | C`, four measures:

> G, D, E minor, C   (an ordered group of 4 measures)

Announced text (exact):

```
G, D, E minor, C
```

Worked example — a line carrying a numbered bar and a no-chord mark,
`@5 N.C. | C | G7`:

Announced text (exact):

```
bar 5: no chord, C, G7
```

(Pins `shell.a11y_chart`'s chart-line unit case — cifra.md §2.2, §2.3, §2.4,
§2.6, §2.8.)

## 6. The chord diagram

A chord diagram's reading is the music core's **`describeFingering`** sentence,
decided in workflow 16 (lines 67–72), **plus whose shape it is, by word**. A
reader MUST announce the role by a word, never by the fill colour alone (the
standing rule; `docs/mockups/README.md` lines 22–26): announcing it by colour
alone is an axe failure for a colour-blind listener.

- The role word is *your shape* (a saved shape, drawn in the chord colour) or
  *default* (the app's default, drawn hollow), reusing the ChordBox `who`
  label.
- The song's **own** shape is unmarked (drawn in ink) and appends no role word.
- The **starting fret** is already inside the `describeFingering` sentence
  (cifra.md §7.5, §7.5.1), so it is not announced separately.
- The explorer's **difficulty word** (*easy* / *medium* / *hard*, workflow 16
  line 51) is **omitted** here: in the song chart the shape is the chosen one,
  not a ranked candidate, so the bucket word would be noise. (It belongs to the
  explorer's ranked candidates, workflow 16.)

Worked example — a saved A-major shape in the song chart:

Announced text (exact):

```
A major, x02220, open position, fingers 2-1-3, root on the 5th string, your shape
```

The same sentence with no role word is the song's own shape; with *default* it
is the app's default. (Pins `shell.a11y_chart`'s diagram unit case and the
diagram behavior test's accessible name — workflow 16 lines 67–72;
[`tasks/refinements/shell/diagram.md`](../tasks/refinements/shell/diagram.md)
line 94.)

## 7. A conflict

In the reading view a song in conflict shows the **user's own version** with
the conflicted places marked (`mark-conf`, workflow 9 lines 34–36), so someone
who opens it to play mid-lesson gets a song, not a puzzle. The reading
announces the conflict **in musical terms and by a word**, bounding the user's
own version, so a listener hears they have entered and left an unresolved
region.

### 7.1 Bounding the region

A reader MUST announce, at **entry**, that a conflict begins, naming it by the
word *needs you* (matching workflow 8's and workflow 9's "needs you") and
naming **what** conflicts in musical terms — the chart line, a voicing, a
property (workflow 9 lines 13–23) — then read the content as its kind requires
(a chart line by §5, a sung line by §2), then announce the region's **end** at
exit. A reader MUST NOT announce the conflict by the `mark-conf` colour or soft
background alone (the standing rule), and MUST NOT read both sides inline: the
two-sided resolution is the conflict-resolution surface's job (workflow 9),
with its own accessibility, outside this document. The end-of-region
announcement is REQUIRED: without it a listener cannot tell where their own
version resumes being uncontested.

### 7.2 Worked example

A conflicted chart line, the user's own version being `G7 | C7 | F | F`:

> needs you, conflict in the chart line, G7, C7, F, F, end of conflict

Announced text (exact):

```
needs you, conflict in the chart line, G7, C7, F, F, end of conflict
```

(Pins `shell.a11y_chart`'s conflict unit case — workflow 9 lines 13–23, 34–36;
DIRECTION §2.2; cifra.md §11.12.)

### 7.3 The same mechanism for a shown default; and the source editor

A **shown default** (`mark-def`, the reading view showing the app's default
shapes, GUIDE §Charts line 40) uses the same bounding mechanism with the word
*default* at entry and *end of defaults* at exit; conflict is the case the task
names, a shown default the sibling it generalises to.

The raw git markers `<<<<<<<`, `=======` and `>>>>>>>` (cifra.md §11.12.2)
exist **only** in the monospace source editor (DIRECTION §3.7 lines 433–434),
where they are the literal text and are read verbatim like any other source
line. They are **never** spoken in the rendered reading chart, and this
document's conflict reading (§7.1) replaces them there.

## 8. Conformance

- A **renderer** MUST produce every chord's spoken name in the user's notation
  dialect (§3) and the `describeFingering` sentence (§6) as framework-free
  accessible labels (DIRECTION §5), MUST NOT emit padding or the centred hyphen
  as accessible text (§4), and MUST NOT require the network (§1.1).
- A **view** MUST assemble the spoken tokens in the order §2–§7 fix: a sung
  line interleaved chord-before-word-run in source order (§2); a chart line as
  an ordered group of measures, the `|` never spoken (§5); a diagram as its
  `describeFingering` sentence plus a role word (§6); a conflicted place
  bounded by a word at entry and exit, in musical terms, never by colour alone
  (§7). Every chart-bearing screen MUST pass axe at WCAG 2.1 AA (DIRECTION §3.7
  lines 447–449; workflow 16 lines 158–161).

`shell.a11y_chart` (`tasks/50-shell.tji`) is the task that implements and
checks this order. It decides the ARIA mechanics (a visually-hidden text layer,
`aria-label`s, `role` grouping, the keyboard path) that this document leaves to
it, and it pins the **announced text (exact)** strings of §2.2, §4, §5, §6 and
§7.2 in:

- **unit** — the reading-order text of a sung line (§2.2), a chart line (§5), a
  diagram (§6) and a conflict (§7.2), each asserted against the literal string
  this document fixes;
- **behavior** — the accessible names a chart and a diagram expose, Testing
  Library with an axe check;
- **e2e-web** — a chart read through the accessibility tree and by keyboard on
  the phone, tablet and computer viewports.

This document carries no code tests of its own: it is a design deliverable (the
decided reading order, in this document and on
[`docs/mockups/Screen-reader.dc.html`](mockups/Screen-reader.dc.html)), and
`shell.a11y_chart`'s tests pin it.

## Open questions

(none — all decided.)

# Refinement — `songs.shape_words`

## TaskJuggler

[`tasks/60-songs.tji`](../../60-songs.tji) — `task shape_words "The shape
words a teacher understands"` (line 242), under `songs`; in
`milestones.m5_complete` (`tasks/99-milestones.tji:45`).

> Item 6 of design.review_polish: the reading view's shapes caption, its
> no-voicings notice and the first-open instrument prompt in the words the
> refinement pins (reading.shapesCaption, reading.noVoicings,
> reading.instrumentPrompt and its two buttons), in the four locales; the
> per-diagram marks unchanged. Workflows 1, 2. Source: persona exploration
> 2026-10-19. Tests: unit (the locales carry every key); behavior
> (SongReading: the caption with a default and a chosen shape, the notice on
> a song with no voicings, the prompt and its two answers; axe).

## Effort estimate

**0.5d.** Three strings and one button in one component, four locale files,
and the tests that already read the old words moved to the new ones.

## Repository

Not under `cifra.md/` (the note does not start with `cifra.md:`). The work
lands in `app/`:

- `app/src/i18n/locales/en.js`, `pt-BR.js`, `es-419.js`, `it.js` — the
  `reading` strings;
- `app/src/songs/SongReading.jsx` — the instrument prompt's second button;
- `app/src/songs/SongReading.behavior.test.jsx`, `app/src/i18n/i18n.test.js`;
- `e2e/web/tests/first-run.spec.js`, `narrow-fit.spec.js`,
  `explorer.spec.js` — existing journeys that name the old copy, moved to
  the new.

No design delta: `design.review_polish` already wrote the words into
workflow 1 (L97-100) and workflow 2 (L155-163) and drew them on
`W01-first-run.dc.html` (L108-112), `W02-find-and-play.dc.html` (L118, L138)
and `Review-polish.dc.html` (L215).

## Inherited dependencies

- **`design.review_polish`** — settled (`complete 100`, Done 2026-10-20).
  Its item 6 and *The new copy* table
  (`tasks/refinements/design/review_polish.md:253-256, 375-377`) pin the
  English; Decision *The marks keep their word* (L424-431) keeps *your shape*
  and *default*; Decision *English pinned, the builds translate* (L468-473)
  hands this task the three other locales.
- Built on, all complete: `songs.reading` (the reading view, the caption and
  the no-voicings notice), `songs.first_song` (the instrument prompt and
  `MARK_INSTRUMENT_PROMPT_SEEN`), `shell.narrow_fit` (the notices read as
  sentences on a phone).

## What this task is

The reading view explains a song's chord shapes in three places, and a
guitar teacher in the persona exploration read none of them easily. This task
says them in the words the design review chose:

| Key | Today (en) | After |
|---|---|---|
| `reading.shapesCaption` | Hollow: the app's default. Filled in colour: your shape for that chord. | In ink: the song’s own shape. In colour: a shape you chose. In outline, marked default: the app’s suggestion. |
| `reading.noVoicings` | Nobody has chosen shapes for {instrument} in this song yet. These are the easiest shapes for each chord. | This song doesn’t say yet how to play its chords on {instrument}, so each chord shows its easiest shape. |
| `reading.instrumentPrompt` | Playing on guitar — change? | Chord shapes shown for guitar. |
| `reading.instrumentPromptChange` | Change instrument | Change instrument (unchanged) |
| `reading.instrumentPromptDismiss` → `reading.instrumentPromptKeep` | Keep guitar and dismiss (aria-label of a ✕ icon button) | Keep guitar (a visible text button) |

`reading.arrangeFor` (*Arrange for {instrument}*) stays as it is. The marks
on each diagram (*your shape*, *default*) and the arrange view's own caption
(`arrange.shapesCaption`) are not touched.

## Why it needs to be done

Source: persona exploration 2026-10-19, item 6 of `design.review_polish`.
The teacher stumbled on *Hollow* (a drawing word, not a playing one) and on a
caption that named two of the three looks a diagram can take; the
no-voicings notice spoke of "nobody" choosing, as if a person were missing;
and the first-open prompt was a question with an unlabelled ✕ as one of its
answers. Workflows 1 and 2 now carry the new words, so the app disagrees with
its own design until this lands. It closes one of the `m5_complete`
follow-ups of the review.

## Inputs / context

- **Workflow 1 §The instrument**, `docs/workflows/01-first-run.md:97-100`:
  *Chord shapes shown for guitar.* once, with **Change instrument** and
  **Keep guitar**; either answer means it is not asked again.
- **Workflow 2 §Where a chord's shape comes from**,
  `docs/workflows/02-find-and-play.md:140-163`: the three sources; the caption
  "with the mark's own word in it"; the no-voicings sentence with **Arrange
  for cavaquinho**; the marks keep their words.
- **Boards**: `docs/mockups/W01-first-run.dc.html:108-112` (the prompt: a
  sentence, then `btn` *Change instrument*, then `btn quiet` *Keep guitar*);
  `W02-find-and-play.dc.html:118` (the notice), `:138` (the caption, `t-small`
  under the tablet's shapes); `Review-polish.dc.html:215`.
- **`docs/mockups/README.md:26`** — defaults hollow, your shapes in the
  chord colour, the song's own in ink; every badge carries a word.
- **Code**:
  - `app/src/songs/SongReading.jsx:402` — `noVoicings` (written key, a model,
    chords, no variation); `:503-512` — the caption, shown when any shape is
    not the song's and the song is not transposed (the transposed captions
    are untouched); `:672-701` — the instrument prompt, its show condition
    (`instrumentInUse` and `instrumentPromptSeen` both absent) and its two
    controls; `:150-152` — `DismissIcon` and its comment (the icon stays, the
    update notice at `:715-722` still uses it); `:757-765` — the notice.
  - `app/src/i18n/locales/en.js:1644` (`shapesCaption`), `:1665-1667`
    (`noVoicings`, `arrangeFor`), `:1668-1672` (the prompt keys and their
    comment); the same keys in `pt-BR.js` and `it.js` at L1487-1512, and in
    `es-419.js`.
  - `app/src/worker/protocol.js:286` — a comment quoting the old prompt.
  - `app/src/i18n/i18n.test.js:44-70` — every locale has every English key,
    the same placeholders, and translates the bulk; `:73-…` the
    `shell.plain_language` block as the precedent for pinning named strings.
- **Tests that read the old words today** (must move, not go):
  `SongReading.behavior.test.jsx:224-262` (shapes and the notice),
  `:843-930` (the prompt: `promptText = /Playing on guitar/`, the button
  *Keep guitar and dismiss*), `:1375-1384` (the notice for the unlabelled
  standard guitar); `e2e/web/tests/first-run.spec.js:7, 32, 103, 124`;
  `narrow-fit.spec.js:74, 84`; `explorer.spec.js:168`.

## Constraints / requirements

- **Copy only, plus one control.** No change to when the caption, the notice
  or the prompt show, to what the buttons do, or to the Worker. Both prompt
  answers still send `MARK_INSTRUMENT_PROMPT_SEEN`; *Change instrument* still
  opens the instruments overlay.
- **Keep guitar is a visible text button**, a RAC `Button` with class
  `btn quiet` as W01 draws it, after *Change instrument*; its accessible name
  is its text. The ✕ goes from the prompt.
- **English exactly as pinned** above (curly apostrophes as in the workflows:
  `doesn’t`, `song’s`, `app’s`). `{instrument}` is the only placeholder, in
  `noVoicings`; the prompt's *guitar* is fixed text (the prompt only shows on
  the implicit standard guitar, `SongReading.jsx:672-684`).
- **Four locales.** pt-BR, es-419 and it get translations of the new
  sentences in the same spirit (the three looks with the *default* mark's own
  word as that locale renders it on the diagram, a song that doesn't say yet,
  a statement plus two answers). No locale keeps the old *Hollow*/*Vazado*
  wording or the question form.
- **The marks stay**: *your shape* and *default* on the diagrams, in every
  locale, unchanged.
- **Accessibility**: the prompt's two answers reachable and operable by
  keyboard; axe at WCAG 2.1 AA on the reading view with the caption, the
  notice and the prompt; the caption names each look by a word, never colour
  alone (README L26).

## Acceptance criteria

Behavior: the reading view shows the three pinned sentences and the prompt's
two text buttons, in every locale; nothing else changes.

Tests:

- **unit** — `app/src/i18n/i18n.test.js`:
  - the existing *has every key English has, and no others* and *uses the
    same placeholders* cases run green with `instrumentPromptKeep` in every
    locale and `instrumentPromptDismiss` in none (the note's "the locales
    carry every key");
  - new `describe('the shape words (songs.shape_words)')`: English
    `reading.shapesCaption`, `reading.noVoicings`, `reading.instrumentPrompt`,
    `reading.instrumentPromptChange` and `reading.instrumentPromptKeep` equal
    the pinned copy (workflow 1 §The instrument, workflow 2 §Where a chord's
    shape comes from); and in every locale `reading.shapesCaption` contains
    that locale's own `diagram.default` mark word (`en.js:1583`; the caption
    carries the mark's word — design.review_polish *The marks keep their
    word*).
- **behavior** — `app/src/songs/SongReading.behavior.test.jsx`:
  - *the chart and the shapes*: the existing song/yours/default case (L224)
    also asserts the caption *In ink: the song’s own shape. In colour: a shape
    you chose. In outline, marked default: the app’s suggestion.* is shown,
    with the marks *your shape* and *default* unchanged; axe clean (workflow 2
    §Where a chord's shape comes from; the note's "the caption with a default
    and a chosen shape");
  - a new case: a song whose every chord has its own shape shows no caption
    (the caption's show condition unchanged);
  - the no-voicings cases (L254, L1375) read *This song doesn’t say yet how to
    play its chords on Guitar, so each chord shows its easiest shape.* with
    **Arrange for Guitar** (workflow 2 L159-163); axe clean;
  - *the first-open instrument prompt* block (L843-930): `promptText` is
    *Chord shapes shown for guitar.*; the buttons are **Change instrument**
    and **Keep guitar** (text, by role and name); *Keep guitar* sends
    `MARK_INSTRUMENT_PROMPT_SEEN` and the prompt is gone, also on a second
    song; *Change instrument* marks it seen and opens the roster; both are
    keyboard-reachable and Enter operates *Keep guitar*; no button named
    *Keep guitar and dismiss* remains; axe clean (workflow 1 §The instrument,
    W01 L108-112).
- **e2e-web** (existing journeys, moved to the new words; they run in the
  gate and would fail on the old copy):
  - `e2e/web/tests/first-run.spec.js` — the prompt *Chord shapes shown for
    guitar.*, answered with **Keep guitar**, gone on a second song and after a
    reload, on the three viewports, axe on the reading screen with the prompt
    (workflow 1 §The instrument, mockup W01 3);
  - `e2e/web/tests/narrow-fit.spec.js` — *the reading notices read as
    sentences*: the new prompt and the new no-voicings sentence for *My Drop
    D* fit on the phone, **Arrange for My Drop D** visible; axe (W02 phone,
    workflow 2);
  - `e2e/web/tests/explorer.spec.js:168` — the new no-voicings sentence for
    *My Drop D*.

No deferred work.

## Decisions

### Rename the dismiss key to `instrumentPromptKeep`

**Chosen:** `reading.instrumentPromptDismiss` becomes
`reading.instrumentPromptKeep` with *Keep guitar*. **Rejected:** keeping the
old key with new text — it would name a control that no longer dismisses with
a ✕ but answers a statement; the i18n key test catches any locale left
behind, so the rename costs nothing.

### A visible *Keep guitar*, not the ✕

**Chosen:** a text `btn quiet` as W01 draws it. **Rejected:** keeping the
icon button with a new aria-label — the review's point is that the prompt now
states a fact and offers two answers; a ✕ reads as "close", not "keep", and
the sighted user should see the same answer the screen reader hears.

### *guitar* in plain text

**Chosen:** the prompt string as one plain sentence. **Rejected:** a bold
*guitar* as W01 draws it — it needs rich-text interpolation the i18n layer
does not do for any other string, for emphasis the sentence does not need;
the board's bold is its drawing, not a decision of the workflow.

### The caption's show condition unchanged

**Chosen:** shown, as today, when any shape is not the song's (and not
transposed). **Rejected:** showing it always now that it names the song's own
look — on a song fully arranged every diagram is in ink and unmarked, and a
caption explaining looks that are not on the screen is noise.

### No new e2e journey

The note names unit and behavior; the existing journeys that already reach
the prompt and the notice through the real UI are moved to the new words,
which gives the e2e level its user-visible promise without a new spec.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- The reading view's shapes caption, no-voicings notice and first-open instrument prompt carry the design review's wording in en, pt-BR, es-419 and it (app/src/i18n/locales/*.js, app/src/songs/SongReading.jsx).
- `reading.instrumentPromptDismiss` renamed `reading.instrumentPromptKeep`; the prompt's ✕ icon button is now a visible *Keep guitar* text button (`btn quiet`).
- app/src/songs/reading.css: the prompt's sentence keeps at least 65% of the row so the two buttons wrap beneath it on a tablet (found by narrow-fit); app/src/worker/protocol.js comment only.
- Unit: app/src/i18n/i18n.test.js, new `the shape words (songs.shape_words)` describe.
- Behavior: app/src/songs/SongReading.behavior.test.jsx — caption with song/your/default shapes, no caption when every chord has its own shape, both no-voicings cases, the prompt and its two answers; axe.
- e2e-web: e2e/web/tests/first-run.spec.js, narrow-fit.spec.js, explorer.spec.js moved to the new words.
- No tech-debt follow-ups.

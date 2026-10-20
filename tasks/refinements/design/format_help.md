# Refinement — `design.format_help`

## TaskJuggler

[`tasks/20-design.tji`](../../20-design.tji), `task format_help "How the song
format is explained in the editor"` (line 93). The note, in short:

> Decided 2026-10-19: the song editor has no instructions about the format,
> and a person writing bracket chords ([Am]Teste) got a blank preview
> (usability review M1). Decide and draw a format help popup reachable from
> the editor: what it covers (a section as ## Verse, the fenced chart under
> it, chords over lyrics, bars with |, repeats, a voicing), in plain words with
> short examples one can copy, never the spec. And the hint the editor gives
> when what is typed looks like another format (bracket chords, a
> chord-over-lyrics sheet pasted without a fence), pointing to it — the same
> moment songs.unknown_tokens_loud flags. Copy in the four locales. Workflows
> 3 (Writing a new song), 4 (Editing). Tests: none — design deliverable
> (workflow 3 and 4 edits and a board for the popup on a phone, tablet and
> computer).

## Effort estimate

1d as the `.tji` gives it. The workflow text, with every word of the help and
the notice, is written with this refinement (the deltas below), and each
example has been checked against the JavaScript reader (Decision *Every
example is a valid song*). What is left is the drawing: one new board, and the
*Help* button added in place to the W03 and W04 frames that draw the editor's
bar. If it runs over, it is the board.

## Repository

estante-de-cifras, **not** `cifra.md/` (the note does not start with
`cifra.md:`). Files:

- `docs/workflows/03-write-a-new-song.md` — edited (delta, **written with this
  refinement**): §The editor gains a *Help* bullet (L80-83); §Pasting a cifra
  gains the inline-bracket case (L101-102); new §Help with the format
  (L104-230) — where *Help* sits, the surface per device, the eight topics
  with their pinned English copy and examples, Insert and Copy, closing and
  focus, what is and is not translated; new §When it looks like another format
  (L232-260) — the two cases, their notice copy, when a line counts, one at a
  time, dismissal, never a save stop or a rewrite.
- `docs/workflows/04-edit-and-save.md` — edited (delta, **written with this
  refinement**): §Editing (L25-31) — the same help and notice while editing a
  saved song, beside the unknown-word marks and the save's list
  (`songs.unknown_tokens_loud`).
- `docs/DIRECTION.md` — §6 (delta, **written with this refinement**): a new
  *Help with the format* bullet (L649-659). §7 unchanged: no new workflow.
- `docs/mockups/Format-help.dc.html` — **new** board (the implementer).
- `docs/mockups/W03-write-a-new-song.dc.html`,
  `docs/mockups/W04-edit-and-save.dc.html` — the *Help* button added in place
  to the editor bar of the frames that draw it; subjects unchanged (the
  implementer).
- `docs/mockups/canvas.json` — the new board registered (the closer, per the
  refinements' precedent; `docs/mockups/GUIDE.md:14` tells a board writer not
  to edit it).

No code, no `api/` change, no locale file: the build is `songs.format_help`
(`tasks/60-songs.tji:202-207`), which implements this "as design.format_help
decides" and translates the copy into pt-BR, es-419 and it.

## Inherited dependencies

The task has no `depends` in the WBS. What it builds on is settled
(`complete 100`): the song editor and its chrome (`songs.editor`,
`songs.editor_chrome` — `app/src/editor/SongEditor.jsx`,
`app/src/songs/EditorChrome.jsx`), paste-into-fence
(`app/src/editor/fence-paste.js`), *Add section*'s insert point
(`app/src/editor/section-insert.js`), and the reader's `unfenced-music`
report (`cifra.md/js/src/parse.js:725-734`, spec §1.9).

Pending, and not needed by a design task: `songs.unknown_tokens_loud` (the
token marks and the save's list, `tasks/60-songs.tji:196-201`) and
`songs.render_notes` (notes drawn in the preview, `tasks/60-songs.tji:191-195`).
This design fits beside both and decides nothing of theirs (Decision *One
notice, beside unknown_tokens_loud's marks*).

Downstream: `songs.format_help` (depends on this and on `songs.render_notes`),
then milestone M3 (`tasks/99-milestones.tji:32`).

## What this task is

Decide and draw the help the song editor gives about the format: where it is
reached, what it says, how its examples get into the song, how it sits on a
phone, a tablet and a computer, and what is translated. And decide the notice
the editor gives when what was typed looks like another way of writing chords
— which cases, what it says, when it appears and goes, and how it leads to the
help.

## Why it needs to be done

Workflow 3 §The editor (L56-62) keeps the text as the editor and asks more of
a writer than Explore Chords did — fences, `##`, `#` — but nothing in the app
says so. The usability review of 2026-10-19 (M1) watched a writer type
ChordPro-style `[Am]Teste [G]linha` inside the template's fence: the format
read it, without complaint and conformantly (spec §1.7.2, §2.9), as a part
named *Am* holding unknown words, and the preview showed nothing useful. The
format cannot refuse it; the app can explain itself. `songs.format_help`
builds what this decides; `songs.unknown_tokens_loud` points to it.

## Inputs / context

- `docs/workflows/03-write-a-new-song.md` §The editor (L56-83), §Pasting a
  cifra (L91-102) — the helps the editor already gives: the template, *Add
  section*, the preview, fencing what is pasted (with Undo).
- `docs/workflows/04-edit-and-save.md` §Editing (L9-31), §Saving (L33-), the
  save that stops at a line (§Normalising).
- `docs/DIRECTION.md` §3.7 (L473-475: the source editor is CodeMirror 6),
  §4 (L499-522), §6 (L567-659), §7 (unchanged).
- The format, for the examples and the triggers:
  `cifra.md/spec/1-document.md` §1.4 (title, properties, L72-152), §1.7.1
  (`##` heading, L197-224), §1.7.2 (bracket heading, L226-246 — recognised
  only inside a fence, name non-empty and not all digits, no chord check),
  §1.9 (fences, notes, `//` annotations, `~~~`, and the MUST-report for an
  unfenced chart whose notes read as chords, L336-378);
  `cifra.md/spec/2-chart.md` §2.1-2.3 (bars, `%`), §2.9 (unknown tokens:
  kept, no diagnostic, L257-271); `cifra.md/spec/3-repeats.md` §3.2-3.4
  (`|: :|`, `x3`, endings `|1.` `:|2.`, L114-146);
  `cifra.md/spec/4-lyrics.md` §4.2 (a chord line directly above its words);
  `cifra.md/spec/7-voicings.md` §7.2-7.5 (`## Voicings: <tuning>`,
  `- G: 320003`), §7.3 (`Voicings` is the default label — a translated label
  would name a variation). Corpus precedents: `cifra.md/corpus/04-cifra-with-words`,
  `07-repeats`, `29-voicings-part`.
- The app today: `app/src/editor/SongEditor.jsx` — the editor bar
  `.est-editor-bar` with *Text | Preview* on narrow screens and *Add
  section* (L454-485), the paste notice `notice accent` `role="status"` with
  Undo (L487-497), the save-stop `notice conflict` (L535-541);
  `app/src/songs/EditorChrome.jsx` (phone app bar Back · title · Save,
  L56-69; phone bottom bar Add section · Discard, L79-85); editor copy under
  `editor.source.*` in `app/src/i18n/locales/en.js` (L1898-1910); four
  locales `en`, `pt-BR`, `es-419`, `it` (`app/src/i18n/index.js:20-30`). No
  help UI exists anywhere in the app. RAC popover precedent:
  `app/src/songs/SongReading.jsx:413-434` (transpose, `DialogTrigger >
  Popover > Dialog`), surface class `card` (`app/src/files/CreateMenu.jsx:33`).
- `tasks/refinements/songs/editor_chrome.md` — phone/tablet/computer
  breakpoints and what each bar holds (Constraints 3-7, L231-267; Decision 2,
  L493): the phone app bar must keep Back/title/Save fitting, the phone
  editor bar holds only the toggle.
- Boards: `docs/mockups/W03-write-a-new-song.dc.html` (Phone 2 editor bar
  L69, L78-79; Tablet appbar L95-96 and paste notice L103-105; Computer
  Add-section row L149), `docs/mockups/W04-edit-and-save.dc.html` (Phone 1
  L40, L48-49; Tablet L119; Computer L177). `docs/mockups/GUIDE.md` (frames,
  `.scrim`/`.sheet`/`.dialog`, `.notice.accent` with `.act`, `.editor > .ln`
  classes; no popover class — L4-40), `docs/mockups/README.md` "Decisions
  the drawings carry" (only the raw source is monospaced; every badge carries
  a word).
- Sibling design refinements for shape and precedent:
  `tasks/refinements/design/sign_in_two_doors.md`,
  `tasks/refinements/design/book_row_songs.md` (English pinned in the
  workflow, translation the build's; a supplementary board plus in-place
  touches to W-frames whose subjects stay).

## Constraints / requirements

1. **Never the specification.** Plain words, one or two sentences a topic,
   an example each; no MUST, no section numbers, no grammar. The help covers
   what a writer needs to get music on the page, and nothing about
   normalisation, merge or legacy forms.
2. **Every example is a valid song that reads as its topic says**: no
   diagnostic, no unknown token, the sung examples sung, the parts named as
   shown. Checked for the English examples with `cifra.md/js` `parse` while
   writing this refinement; the build pins it in a unit test over every
   locale's examples.
3. **Canonical form wins.** The help and the notice never rewrite the text
   or offer to keep a non-canonical spelling; Insert adds an example the
   writer then owns; the save stays as workflow 4 has it.
4. **Accessibility.** *Help* is a RAC Button with its word beside the icon;
   the help is a RAC Dialog with a heading, its topics headings a screen
   reader can jump between, each example's button naming its topic (*Insert
   the Bars example*); Escape closes; focus returns to *Help*, or to the text
   after Insert. The notice is `role="status"` with its words — never colour
   alone. The board shows status in words and uses only `var(--…)` tokens.
5. **Offline first.** The help is bundled copy; nothing waits on the network.
6. **No new chrome on the phone app bar** (editor_chrome.md Constraint 3):
   *Help* goes in the editor's own bar.
7. **Copy.** English pinned verbatim in workflow 3; the build translates it
   into pt-BR, es-419 and it, translating sentences, part names and sung
   words and never the marks, chord symbols, tuning, or `Voicings` (workflow
   3 §Help with the format, last paragraph).
8. **Test fixtures and drawings use words written for the purpose** — the
   examples' *Moonlit Road* / *The Porch Band* lines are this task's own.

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause: "none —
design deliverable"). Acceptance is what the workflow documents decide, what
the board shows, and the DIRECTION delta — concrete enough that
`songs.format_help`'s named tests (behavior: the popup opens from the editor
and returns focus, examples insert or copy, the hint on bracket chords, axe;
e2e-web: the help opened while writing a new song on the three viewports, axe)
can be written against them.

1. **Workflow 3 decides** (written with this refinement):
   - §The editor (L80-83): *Help* is one of the editor's helps.
   - §Pasting a cifra (L101-102): a pasted cifra with chords inside the words
     is fenced like any other and then meets the notice.
   - §Help with the format (L104-230): *Help* (question-mark icon and the
     word) in the editor bar — beside *Text | Preview* on a phone, beside *Add
     section* on a tablet and computer; in the song editor only, never the
     file view's raw editor. It opens *Writing a song*: a sheet on a phone, a
     panel hanging from *Help* over the preview on a tablet and computer; one
     scrolling page of eight topics in a fixed order with pinned English copy
     and examples; **Insert** on the parts' examples (2-7) — placed where *Add
     section* places a part, help closed, cursor at the end, one undo takes it
     back; **Copy** on the title (1) and voicings (8), confirming *Copied*;
     closes by close button, Escape, outside tap, or Insert, focus back to
     *Help* or the text — pins the build's "opens from the editor and returns
     focus" and "examples insert or copy". What is translated and what is not.
   - §When it looks like another format (L232-260): two cases with their
     pinned copy and the topic each opens — **chords in brackets** (a bracket
     part name that reads as a chord, or in notes a bracketed chord followed
     at once by a letter) → *Chords over words*; **chords outside the music**
     (the reader's unfenced-music report, spec §1.9) → *Parts and the music
     fence*; **Show me how** and a dismiss; one notice at a time, bracket
     first, naming the first line; a line counts once the cursor has left it
     or at once when pasted; gone when the case is gone, dismissed for the
     rest of this editing; never stops a save, never rewrites — pins the
     build's "the hint on bracket chords".
2. **Workflow 4 decides** (§Editing, L25-31): the same help and notice when
   editing a saved song, beside the unknown-word marks and the save's list.
3. **The new board** `docs/mockups/Format-help.dc.html`, drawn to GUIDE.md:
   `.board-head` *Workflows 3 & 4 · Help with the format*, sub-line *Help in
   the editor's bar opens Writing a song; a notice points to it when chords
   look written another way.* It must show:
   - **Phone 1 · the notice, chords in brackets** — a new song's editor
     (app bar Back · title · Save, the *unsaved changes · Kept on this device*
     strip, editor bar *Text | Preview* + *Help*), the text holding
     `[C]Walk the [G]moonlit road` inside the fence (that line marked `.err`
     is *not* drawn — marks are `songs.unknown_tokens_loud`'s; the line is
     plain), and above it the `.notice.accent` *Line 6 looks like chords in
     brackets. Here a chord goes on its own line, above its words.* with
     `.act` **Show me how** and an icon-only dismiss with `aria-label`.
   - **Phone 2 · Writing a song, from Show me how** — `.scrim` + tall `.sheet`
     with `.grip`, the heading *Writing a song*, scrolled to *3. Chords over
     words* with its sentence, the monospaced example and **Insert**, the
     head of topic 4 showing below; a close button.
   - **Tablet · Help opened from the bar, in pt-BR** — editor beside the
     preview, *Help* (*Ajuda*) pressed in the editor bar beside *Add section*,
     the panel (a `card` surface, hanging from the button, over the preview)
     at its top: the title, the intro line and topics 1-2 translated, the
     examples with translated part names and words but untouched marks, *Copy*
     on topic 1 and *Insert* on topic 2. Its frame label says *pt-BR*.
   - **Computer · chords outside the music, and an example inserted** —
     editor | preview, a song whose `## Intro` holds an unfenced `G | % | C |
     D` and a fenced `## Bridge` just inserted from *5. Repeats* (cursor at
     its end, the preview drawing the repeat with its *×3*), and the notice
     *Line 5 looks like chords, but it is outside the music, so it is kept as
     a note. Music goes between two lines of three backticks.* with **Show me
     how**. The panel is closed (Insert closed it); *Help* is visible in the
     bar.

   No colour alone (the notice is words; *Copied* is a word), only `var(--…)`
   tokens, icons inline SVG. Registration: `boards["Format-help.dc.html"] = {
   x: 0, y: 41300, w: 3208, h: 1500, title: "3 & 4. Help with the format" }`,
   appended to `order` — by the closer.
4. **W03 and W04 touched in place**: *Help* added to the editor bar in W03
   Phone 2 (beside *Text | Preview*, L69), Tablet and Computer (beside *Add
   section*, L95-96, L149), and W04 Phone 1 (L40) and Tablet; nothing else in
   those frames changes, their subjects stay (they are e2e `mockup()`
   capture subjects by index).
5. **DIRECTION §6** gains the *Help with the format* bullet (L649-659),
   written with this refinement; §7 unchanged, no new workflow.
6. **No code tests, and none deferred**: the code and its tests are
   `songs.format_help`'s, which already names them in its note; the
   decisions above give each a concrete expectation (where *Help* is, the
   eight topics, Insert vs Copy, focus, the two notice cases and their copy).
7. **No deferred WBS follow-up.**

## Decisions

### Help lives in the editor's own bar, labelled *Help*

**Chosen:** a *Help* button (icon and word) in `.est-editor-bar` — beside
*Text | Preview* on a phone, beside *Add section* on a tablet and computer.
**Rejected:** the app bar (the phone's must keep Back · title · Save fitting,
editor_chrome.md Constraint 3; the tablet/computer one is full); a `?` icon
alone (a word, not an icon, carries meaning); a longer label like *How to
write chords* (does not fit beside the toggle on a 370px phone). *Help* in the
editor's bar is unambiguous: it is the editor's help.

### One page of short topics, not a navigable manual

**Chosen:** one scrolling dialog, eight headed topics in the order a writer
meets them, the notice opening it scrolled to its topic. **Rejected:** a topic
list leading to sub-pages (a second level of navigation inside a popup, more
focus management for eight short paragraphs); a link to the specification
(the note: never the spec).

### A sheet on a phone, a panel hanging from *Help* elsewhere

**Chosen:** the same RAC Dialog presented as a bottom sheet on a phone and as
a `card` popover hanging from *Help* on a tablet and computer, over the
preview — the same presentation split SaveSheet already makes. **Rejected:**
replacing the preview with a help pane on a computer, like the save panel
(the preview is what tells a writer the example worked, and the save panel
already claims that slot); a centred modal on a computer (covers the text the
help is about).

### Insert for the parts, Copy for the title and the voicings

**Chosen:** the parts' examples (2-7) carry *Insert*, placed where *Add
section* puts a part — always a valid place, inside nothing — so an example
never lands inside another fence or after the voicings rule. The title and
the voicings carry *Copy*. **Rejected:** Insert at the cursor (a part's
example dropped inside a fence or the voicings part reads as something else,
or is dropped at save); Insert for the voicings (where it goes depends on the
song's existing voicings part and tuning, which workflow 5's arrange writes
properly); Copy only (the clipboard API can be refused, and on a phone
copy-then-paste is three gestures the help can save).

### Every example is a valid song

**Chosen:** each example, as written in workflow 3, was parsed with
`cifra.md/js` `parse` while writing this refinement: no diagnostics, no
unknown tokens, the two sung examples `sung: true`, the bracket example opening
a part *Chorus*. The same check run on `[Am]Walk the [G]road` in a fence gives
parts *A* and *Am* with unknown tokens `Walk`, `the`, `[G]road`; an unfenced
`G | C | D` gives `unfenced-music` — the notice's two cases, as the reader
sees them. Examples use triads and plain sevenths, written alike in every
notation. **Rejected:** examples copied from the corpus (04 and 07 carry
words not written for this help, and combine more than a topic needs).

### English pinned; the marks never translated

**Chosen:** English copy pinned verbatim in the workflow, translated by the
build, as `design.sign_in_two_doors` and `design.book_row_songs` did; the note's
*copy in the four locales* is met by fixing **what** is translated (sentences,
part names, sung words) and what never is (`#`, `##`, the backticks, `|`, `%`,
`|:`, `:|`, `x3`, endings, `[ ]`, `//`, `---`, chord symbols, the tuning,
`Voicings`), and by drawing the tablet in pt-BR. **Rejected:** pinning four
translations here (the build's locale files are where copy lives and
`i18n.test.js` checks them; a second copy here would drift); translating
`Voicings` (cifra.md §7.3: a different label is a variation).

### One notice, beside unknown_tokens_loud's marks

**Chosen:** a single `notice accent` above the text, like the paste notice,
naming the first line of the case and opening the help; it does not mark
lines. The marks on unknown words and the save's list are
`songs.unknown_tokens_loud`'s; this notice is how that moment points to the
help, and its bracket case is the same check as that task's bracket-heading
flag — whichever build lands second reuses the first's. **Rejected:** a
mark per line with its own tooltip (duplicates the token marks); stopping
the save (§2.9 and unknown_tokens_loud's note: annotations like *fine* are
legitimate, and a part may really be named *A*).

### The notice never converts

**Chosen:** the notice explains; the writer edits. **Rejected:** a one-tap
conversion of inline bracket chords to chords over words, or of an unfenced
chart to a fenced one. The first needs column placement the inline form only
approximates and is migration-like (cifra.md Appendix A treats conversion as
a separate, asked-for operation); the second is already done for pastes
(workflow 3 §Pasting a cifra), and an unfenced chart that remains was made by
deleting the fence by hand.

### A line counts once the cursor leaves it

**Chosen:** the cases are checked on lines the cursor is not on, and on pasted
text at once — so typing `[A` towards `[Am]` does not flash a notice.
**Rejected:** checking every keystroke (noise mid-word); checking only at
save (too late: the point is to teach before the song is written wrongly).

### The help is the song editor's only

**Chosen:** *Help* is in the song editor (new and saved songs), not the file
view's raw editor. **Rejected:** both — workflow 14 §The view says the file
view is for advanced users who know the format.

## Open questions

(none — all decided.)

Surfaced for the parking lot:

- Whether a later version should convert ChordPro-style inline chords on
  paste, as Appendix A treats migration — a product call, not scoped here.

## Status

**Done** — 2026-10-20.

- docs/mockups/Format-help.dc.html: new board — bracket-chords notice and the *Writing a song* sheet on a phone, the help panel in pt-BR on a tablet, the chords-outside-the-music notice with its panel on a computer.
- docs/mockups/W03-write-a-new-song.dc.html: *Help* added to the editor bar (Phone 2, Tablet, Computer).
- docs/mockups/W04-edit-and-save.dc.html: *Help* added (Phone 1, Tablet — before *Discard changes*, as that frame has no *Add section*).
- docs/mockups/canvas.json: Format-help board registered (y 41300, "3 & 4. Help with the format").
- docs/workflows/03-write-a-new-song.md, docs/workflows/04-edit-and-save.md and docs/DIRECTION.md §6: the decisions (help, the notice, the cases).
- Deviation: the Computer frame draws a song with no fence, not an unfenced `## Intro` plus a fenced `## Bridge`, because a song with any fence is not checked for unfenced music (workflow 3, cifra.md §1.9). No frame draws the state after an Insert.
- No tests (design task); the canvas needs republishing (parking lot).

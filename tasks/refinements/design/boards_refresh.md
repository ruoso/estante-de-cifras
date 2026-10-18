# Refinement — `design.boards_refresh`

## TaskJuggler

[`tasks/20-design.tji`](../../20-design.tji) L75-79,
`task boards_refresh "Redraw the boards where the app follows the workflows"`:

> Boards the UI audit found behind their workflows: W01 invited screen (names
> no book or role before sign-in, workflow 1 L49-56); W03 save sheet (no File
> name row, workflow 3 Its file name); W05 the unnamed variation is Default;
> W09 Keep both on a bar conflict and beside Settle in the book panel
> (workflow 9 Settling one); the tablet song view keeps the search rail beside
> the song (decided 2026-10-14: the split stays) on W01, W02 and W12;
> Theme-picker descriptions identical across its frames. Republishing the
> canvas stays a human step (tasks/parking-lot.md). Source: UI audit
> 2026-10-14 (app screens vs rendered boards; e2e/web/lib/mockup.js). Tests:
> none — design deliverable (the boards; audit/render-mockups.mjs renders
> them). Also (pairwise audit): the explorer on a tablet keeps the search
> rail; the source editor shows line numbers.

## Effort estimate

1d (from the `.tji`).

## Repository

**estante-de-cifras**, not `cifra.md/`. Documents only:

- `docs/mockups/W01-first-run.dc.html` — the invited screen (phone 2).
- `docs/mockups/W05-arrange.dc.html`, `docs/mockups/W09-conflicts.dc.html` —
  the unnamed variation reads *Default*.
- `docs/mockups/W09-conflicts.dc.html` — the song-level *Keep both* on the
  bar conflict and in the book panel.
- `docs/mockups/Theme-picker.dc.html` — one set of theme descriptions.
- `docs/mockups/W16-chord-explorer.dc.html` — the tablet explorer keeps the
  search rail.
- The source-editor boards (list under Acceptance 6) — line numbers.
- `docs/workflows/05-arrange-for-an-instrument.md` §Variations — **design
  delta, already written** by this refinement (Decision *Default is named in
  workflow 5*).
- `docs/mockups/canvas.json` — untouched: no board added, none resized.
- W02, W03, W12 and the W01 tablet — untouched (Decisions *The tablet song
  view stays railless* and *W03 already draws the file name*).

## Inherited dependencies

None in the `.tji` (`depends` is empty). What the boards are redrawn to is
shipped and settled:

- **books.invited_presentation** (Done 2026-10-15) — the signed-out invited
  prompt, `app/src/account/InvitedScreen.jsx:118-138`, copy
  `app/src/i18n/locales/en.js:755-767`.
- **songs.first_save_fields** (Done 2026-10-18) — the save sheet's Book and
  File name rows, `app/src/songs/SaveSheet.jsx:184-200`.
- **sync.keep_both**, **sync.conflicts_polish** — `SongConflict.jsx:429-452`,
  `BookConflicts.jsx:86-90`.
- **songs.reading_chrome** (complete, 2026-10-16) — Decision 1,
  `tasks/refinements/songs/reading_chrome.md:324-334`: the tablet reads the
  song on the whole pane, no search rail.
- **music.explorer** — the explorer's wide split, `app/src/music/ChordExplorer.jsx:266-280`.
- **design.theme_picker** — `Theme-picker.dc.html`; copy `en.js:833-843`.

Downstream: `milestones.m5_complete` (`tasks/99-milestones.tji:44`); the
re-run of the UI audit (`tasks/parking-lot.md` L110-132) compares app
captures against these boards.

## What this task is

Bring six boards back in line with the workflows and with the app that
follows them, frame by frame: the invited screen that names no book before
sign-in; *Default* for a song's unnamed variation; the song-level *Keep both*
on W09's bar conflict and in its book panel; one wording for each theme on
the theme picker; the explorer's search rail on a tablet; and line numbers in
every source editor drawn. Two audit items need no redraw, and the task
records why.

## Why it needs to be done

The boards are what the app's look and copy are checked against
(`e2e/web/lib/mockup.js` captures the app per frame,
`audit/render-mockups.mjs` renders the boards; parking lot L110-132 runs the
comparison). Where a board disagrees with its workflow, or draws something
the app was built otherwise for a recorded reason, every audit pass reports
the same false finding, and an implementer reading the board builds the
wrong thing (W01's invited screen draws what workflow 1 L50-56 forbids).

## Inputs / context

- **Workflow 1** `docs/workflows/01-first-run.md:50-56` — until the account
  exists the invited screen names neither the book nor its owner, only that
  it is an invitation to a book on Estante; name and role appear once signed
  in and accepted.
- **W01** `docs/mockups/W01-first-run.dc.html:62-87` (phone 2) — names
  *Choros da Ana* (:72), the chip *as a reader* (:73), the reader line (:75),
  *Then Choros da Ana goes on your shelf…* (:84). Label :26.
- **Shipped invited prompt** (`en.js:755-767`): heading *You’re invited to a
  book on Estante*; body *To open it, sign in, or make an account first — no
  book can be read without one.*; card *An account is a passkey* / *No
  password to choose. Your phone makes it, and it takes seconds.*; buttons
  *Make an account*, *I have an account: sign in*; footer *Then the book goes
  on your shelf, and opens on its songs.*
- **Workflow 3** `docs/workflows/03-write-a-new-song.md:35-48, 97-107` — the
  file name at the first save, shown not editable, with *Named once, from the
  title…*. **W03** computer dialog `W03-write-a-new-song.dc.html:176-197`
  already draws Book, File name (`coracao-de-estrada.cifra.md`, :185) and the
  caption (:186).
- **Workflow 5** §Variations `docs/workflows/05-arrange-for-an-instrument.md:95-105`
  — did not name the unnamed variation (delta below). The app says *Default*
  (`arrange.variationDefault`, `en.js:1665`; also `reading.variationDefault`
  :1585, the editor's :1922). **W05** calls it *Voicings*: :170, :174, :184,
  :202. **W09** :110 says *main variation*.
- **Workflow 9** §Settling one `docs/workflows/09-conflicts.md:47-80` — keep
  both per conflict is offered on a *voicing* conflict (L65-68); **Keep both,
  for a song** (L77-80) splits the song, the other version written beside it
  as `<name>-ana.cifra.md`. Shipped: the conflict screen's actions *Keep
  mine*, *Take theirs*, *Keep both* (voicing only), *Edit*, then the always
  present card *Two songs?* / *Keep yours as it is and save {author}’s
  version beside it, as its own song, for when you have really made two
  songs.* / *Keep both, as two songs* (`SongConflict.jsx:429-452`,
  `en.js:1214-1226`); the book panel row's *Settle* and *Keep both*
  (`BookConflicts.jsx:86-90`, `en.js:1275-1278`, aria-labels *Settle
  {title}*, *Keep both versions of {title} as two songs*).
- **W09** `docs/mockups/W09-conflicts.dc.html` — phone 1 bar conflict
  (*Primeira parte, bar 5*) offers Keep mine / Take theirs / Edit (:76-78), no
  song-level card; phone 2 shape conflict draws Keep both (:125-130); the
  computer book panel row (:222) has the badge *2 conflicts* and *Settle* as
  a `<span class="btn quiet">` inside an `<a class="row">`, no Keep both.
- **Theme picker** `docs/mockups/Theme-picker.dc.html` — phone 1 (:44-60):
  *Follows this device*, *Neutral, ink-blue chords*, *Paper, red-pen chords,
  serif*, *Dark stage, amber, read far* — the shipped copy (`en.js:833-843`).
  Tablet (:210-226) and computer (:329-345): *Follows this device · light →
  Estante, dark → Palco*, *Paper, red-pen chords, serif titles*, *Dark stage,
  amber, built to read far*.
- **Explorer** — W16 tablet (`W16-chord-explorer.dc.html:108-168`) has no
  rail; the app draws `split explorer-split` with the search in `.pane.side`
  whenever the layout is wide (`ChordExplorer.jsx:266-280`; `WIDE_QUERY`
  600px, `app/src/shell/layout-mode.js:22`), the tablet included. The W16
  computer frame (:174-175) is the split to copy.
- **Line numbers** — every source editor in the app carries CodeMirror's
  `lineNumbers()` (`app/src/editor/source-extensions.js:12, 55`), shared by
  `SongEditor.jsx` (the song editor, the new song, the file view's raw editor
  through `RawEditorHost.jsx`) and `MarkedTextEditor.jsx` (editing a marked
  text). The boards: W09 tablet numbers its marker editor in a gutter span
  (:163, data :310, `n: String(i + 1)`) — the model; W04 computer bakes the
  numbers into the text (:271); every other source editor is unnumbered.
- **Tablet song view** — `songs.reading_chrome` Decision 1 (above) and
  `SongReading.jsx:758-779`; W01#3, W02#3 (:104-144) and W12#3 (:106-154)
  draw no rail.
- **GUIDE** `docs/mockups/GUIDE.md` — :19-24 board structure, :25 only the
  source editor is monospaced, :27 real buttons and `aria-label`s, :30 device
  sizes; boards are not rendered or published by the implementer.
- **Republish entry** `tasks/parking-lot.md` L94-102.

## Constraints / requirements

- Draw the workflow, in the app's words: where the app says it, the board
  uses the shipped copy verbatim. No invented features.
- Every edit keeps its board 3208×1500, its frames and their sizes, and the
  GUIDE's rules (holes are dotted lookups computed in `renderVals()`, hint
  attributes on `sc-for`/`sc-if`, `var(--…)` tokens only, tags balanced).
- Status in words, never colour alone; real `<button>`s for what is pressed
  (W09's *Settle* becomes one).
- Frames not named below stay as they are — the e2e `mockup()` frame map
  (`e2e/web/lib/mockup-frames.json`) is keyed on board and frame index; no
  frame is added, removed or reordered.
- Songs and names from the cast; no lyrics.

## Acceptance criteria

A **design task — no code tests** (the `.tji` Tests: clause: "none — design
deliverable"). Acceptance is what each board shows.

1. **W01 phone 2 — the invited screen names no book.** The heading *You’re
   invited to a book on Estante*; no book title, no role chip, no reader
   line; the body *To open it, sign in, or make an account first — no book
   can be read without one.*; the passkey card as drawn; the two buttons as
   drawn; the footer *Then the book goes on your shelf, and opens on its
   songs.* The dev-label (:26) still reads as the cold door then the invited
   one. Pins workflow 1 L50-56.
2. **W05 and W09 — the unnamed variation is *Default*.** W05's prompt, its
   two choices and the selector read *Default* where they read *Voicings*
   (:170 *Default already has shapes chosen in this song…*, :174 *Default
   stays as it is*, :184 *Over Default*, :202 the seg button *Default*);
   W09 :110 *main variation* → *Default*. The **source text** keeps `##
   Voicings: …` (W04:256, W09:299, W14:293, :316) — that is the format's
   heading, not a name. Pins workflow 5 §Variations (delta).
3. **W09 — Keep both, for a song.** Phone 1, under Keep mine / Take theirs /
   Edit (no per-conflict Keep both on a bar conflict — workflow 9 L65-68),
   the card *Two songs?* with *Keep yours as it is and save Ana’s version
   beside it, as its own song, for when you have really made two songs.* and
   the button **Keep both, as two songs** (if phone 1 cannot fit it, the
   card's body is shortened to the title and button, never the actions
   dropped). Computer book panel: the Carinhoso row keeps its badge *2
   conflicts* and draws two real buttons, **Settle** (`aria-label="Settle
   Carinhoso"`) and **Keep both** (`aria-label="Keep both versions of
   Carinhoso as two songs"`); the row is no longer an `<a>` wrapping a
   button. Pins workflow 9 L77-80.
4. **Theme-picker — one wording per theme.** Tablet and computer use the
   phone's (shipped) descriptions: *Follows this device*, *Neutral, ink-blue
   chords*, *Paper, red-pen chords, serif*, *Dark stage, amber, read far*.
   The light → Estante, dark → Palco mapping stays in each frame's footnote
   (the app's `themeNote` says it). Footnotes otherwise as drawn; the
   two-column tablet layout is out of scope (parking lot L146).
5. **W16 tablet — the explorer keeps the search rail.** The tablet becomes a
   `.split` as the computer frame is: `.pane.side` with the search (the field
   holding *C7+*, scope as the computer draws it) and `.pane.main` with the
   explorer's app bar and detail — the Chord field, the reading notice and
   the shape sections, re-flowed to the narrower pane (fewer shapes per row,
   the scroll clipping the rest). The dev-label says the search stays beside
   it. Pins the shipped `ChordExplorer.jsx:266-280`.
6. **Line numbers in every source editor.** Each `.editor` that draws the
   source editor (CodeMirror: writing, editing, the raw editor, a marked
   text) numbers its lines with W09's gutter span (:163) — `{n, cls, text}`
   lines from `renderVals()`, numbers starting at 1. That is: W03 (:70, :108,
   :153); W04 phone and tablet (:41, :113) and the computer (:181, moved from
   baked-in text to the gutter span, :271); W08 (:108, the editor while Ana's
   save came in); W12 computer (:233, the setlist's raw source); W14 raw
   editors (:75, :125); Screen-reader (:187, the conflict in the source
   editor). **Not** numbered: line diffs (W06 :200, W14 :209, :220) — they are
   history views, not the editor. Pins `source-extensions.js:55`.
7. **No other frame touched**; `canvas.json` unchanged.
8. **Republish entry** (`tasks/parking-lot.md` L94) gets an *Updated* line
   naming W01, W04, W05, W08, W09, W12, W14, W16, Screen-reader and
   Theme-picker as redrawn and not rendered — by the closer.
9. **No code tests, none deferred, no follow-up task**: every board change
   draws what the app already does.

## Decisions

### The tablet song view stays railless — the 2026-10-14 call was superseded

**Chosen:** W01#3, W02#3 and W12#3 unchanged. **Rejected:** drawing the
rail beside the song, as the note's "decided 2026-10-14: the split stays"
asks. That call (commit 07a6f92) was made when the app kept the rail; two
days later `songs.reading_chrome` Decision 1 (2026-10-16) took it out —
the rail pushed the 230px shapes card below the chart, and the chip had to
move to the app bar — and the shipped `SongReading.jsx:758-779` reads the
song on the whole tablet pane. The boards already draw that, so redrawing
them would put them behind the app again. The explorer is a different
screen with a different shipped layout (item 5), so its rail is drawn.

### W03 already draws the file name

**Chosen:** W03 untouched. Its computer dialog (:176-197) has Book, the
read-only File name and the workflow's caption — the audit's finding was the
app's gap, which `songs.first_save_fields` closed (2026-10-18). The phone and
tablet frames show the editor before saving, a different moment; adding a
sheet over one would displace the frame the `mockup()` map captures.

### *Default* is named in workflow 5

**Chosen:** a design delta in `docs/workflows/05-arrange-for-an-instrument.md`
§Variations (written with this refinement): the unnamed variation — the
plain *Voicings* block for the tuning — reads *Default* wherever a variation
is named. **Rejected:** keeping *Voicings* on the board (the format's
heading word, which says nothing to a reader choosing between variations
and is what every variation is) or W09's *main* (a third word). The app has
said *Default* in arrange, the reading view and the editor since it shipped;
the workflow was silent, so naming it there is what settles it.

### Keep both on a bar conflict is the song-level one

**Chosen:** phone 1 gains the *Two songs?* card, not a fourth button.
**Rejected:** a per-conflict *Keep both* on a bar — workflow 9 L65-68 offers
that only on a voicing conflict (a bar has no "variation named for them" to
hold the other version), and the app hides it there. The audit's "Keep both
on a bar conflict" is the song-level split, which workflow 9 L77-80 offers on
any conflict and the app shows always.

### One theme wording: the shipped one

**Chosen:** the phone's short descriptions everywhere. **Rejected:** the
tablet/computer wording — the app has one string per theme, and the light/
dark mapping the longer *Automatic* line carried is already the footnote's.

### Line numbers by a gutter span, not baked text

**Chosen:** W09's gutter span with the number in data. **Rejected:** W04's
`padStart` into the text — it makes the number part of the line, which
reads as if it were source text and copies as such; the span keeps the line
text the file's.

## Open questions

(none — all decided.)

## Status

**Done** — 2026-10-18.

- `docs/mockups/W01-first-run.dc.html`: the invited screen (phone 2) uses the app's wording and names no book or role before sign-in.
- `docs/mockups/W05-arrange.dc.html`, `docs/mockups/W09-conflicts.dc.html`: the unnamed variation reads *Default* (the `## Voicings:` heading in the source text is kept); `docs/workflows/05-arrange-for-an-instrument.md` §Variations carries the matching *Default* delta.
- `docs/mockups/W09-conflicts.dc.html`: phone 1 gains the *Two songs?* card with **Keep both, as two songs**; the book panel's Carinhoso row has real **Settle** and **Keep both** buttons with the app's aria-labels.
- `docs/mockups/Theme-picker.dc.html`: one wording per theme across the frames; the tablet footnote carries the light → Estante, dark → Palco mapping.
- `docs/mockups/W16-chord-explorer.dc.html`: the tablet frame is a split with the search rail (*C7+*) and explore row beside the explorer.
- Line numbers in every source editor (W03, W04, W05, W08, W09, W12, W14, W16, Screen-reader), using W09's gutter; W04's computer frame moves the numbers out of the line text; line diffs stay unnumbered. Scope note: W03 got line numbers too (Acceptance 6) although Acceptance 8's republish list omits it, so the parking-lot entry names it.
- `app/src/music/EnterShape.behavior.test.jsx`: fixer gave one axe-heavy test a 20 s per-test timeout (it timed out at 5.5 s under full-suite load). `canvas.json` unchanged; no tests named (design task); boards not rendered or published.

# books.setlist_play_chrome — Playing a setlist shows its key

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task setlist_play_chrome` (L161-166):

> The W12 board's player carries the song's key chip (In A) and the setlist's
> key line; the app's player has neither. The Add to setlist dialog is cramped
> (list, title and buttons with no gaps). Source: UI pairwise audit 2026-10-14
> (e2e mockup() screenshots vs rendered boards, audit/out). Tests: behavior
> (the key chip and line; axe); e2e-web (play a setlist with a key on the
> three viewports, mockup W12#2-3).

Milestone: listed in `tasks/99-milestones.tji` L44 with the other UI-audit polish tasks.

## Effort estimate

0.5d. The work is:

- a small rule change in the player's key display;
- one rule added to the pure `playKeyOffset` (mode mismatch);
- a layout class on the two Add-to-setlist dialogs;
- extensions to the existing unit, behavior and e2e-web tests.

## Repository

The work lands in **estante-de-cifras**, not under `cifra.md/`:

- `app/src/books/setlist-play.js` and `app/src/books/setlist-play.test.js`
- `app/src/books/SetlistPlay.jsx` and `app/src/books/SetlistPlay.behavior.test.jsx`
- `app/src/books/AddToSetlist.jsx`, `app/src/books/setlist.css` and `app/src/books/SetlistView.behavior.test.jsx` (its `AddToSetlist dialog` block)
- `e2e/web/tests/setlist-play.spec.js` and `e2e/web/tests/setlists.spec.js`

There is **no design delta**. The W12 board, workflow 12 §The key and cifra.md §10.7.1 already decide everything here. The task makes the app match them.

## Inherited dependencies

- `books.play`: **settled** (`complete 100`). It delivered `SetlistPlay.jsx`, `setlist-play.js`, the `play.*` copy, and the chip and line for a transposed song (`tasks/refinements/books/play.md`, AC 3).
- Also settled, though not in `depends`:
  - `books.setlists`: delivered `AddToSetlist.jsx` and the `AddToSetlist dialog` behavior tests.
  - `books.setlist_chrome`: the open setlist sits in the phone shell. The player is still a chrome-free early return above it.

## What this task is

The audit put two app screenshots next to the W12 board and found two gaps.

**1. The player's key.** W12 phone #2 (`docs/mockups/W12-setlists.dc.html` L70-100) draws:

- the second song of the set, in the setlist's key;
- an accent chip **"In A"** at the right end of the player's bar (L78);
- the line **"Setlist key A · written in G"** at the top of the body (L81).

The app's player already draws both, but only when the key moves the chart (`SetlistPlay.jsx` L192, L215-217, L232-236). The e2e capture of W12#2 (`setlist-play.spec.js` L93) is taken on *Morning on the Porch*, which has no setlist key. So the screenshot showed neither, and the comparison could not see the keyed state the board draws.

Reading the code against cifra.md §10.7.1 also shows two cases where the key is not shown correctly:

- **The setlist key names the song's own key** (`- key: G` on a song in G, or `Bb` on a song in `A#`). The offset is 0, so no chip is drawn, and the line says "Setlist key G · written in G".
- **The keys differ in mode** (`- key: C` on a song in `Am`). §10.7.1 says the key is not applied and is shown as a note. `playKeyOffset` drops the `m` and transposes anyway, and the chip names a key the band did not agree.

This task makes the player show, for every item that carries a key:

- the key the chart is played in, as the chip in the bar;
- the setlist's key, as the line in the body;
- each exactly as §10.7.1 and workflow 12 §The key decide.

It then captures W12#2 on the keyed song.

**2. The Add-to-setlist dialog.** The `.dialog` box (`app/src/theme/theme.css` L368) lays out its children with `gap: calc(var(--u) * 2)`. In `AddToSetlist.jsx` that rule lands on the RAC `Modal` (L138), whose only child is the RAC `Dialog` (L139). The heading, the setlist list, the copy notice, the explanatory line and the actions inside the `Dialog` are therefore stacked with no gap. W12 tablet #3 (L134-151) draws them spaced by the dialog's gap.

The nested *New setlist* dialog (L255-283) has the same defect, with the gap missing on its `<form>`.

This task gives each inner container the board's column layout and gap. `songs.arrange` already did the same for its dialog (`app/src/songs/arrange.css` L138-143, `.arrange-addvar-dialog`).

## Why it needs to be done

The 2026-10-14 pairwise audit compared the e2e `mockup()` screenshots with the rendered boards. It found W12#2 without its key, and W12#3 cramped.

A player that hides the key when the band's key equals the written one leaves a performer unsure which key they are in. A player that transposes a minor song into a major target goes against §10.7.1.

This is one of the M5 polish leaves in `tasks/99-milestones.tji` L44. No later task depends on it.

## Inputs / context

- **Board W12, `docs/mockups/W12-setlists.dc.html`:**
  - phone #2, the player, L70-100: the bar at L72-79 (Stop at L73, title and *"2 of 5 · screen kept awake"*, `.chip accent` *In A* at L78); the body line `t-small` *Setlist key A · written in G* at L81;
  - tablet #3, Add to setlist, L134-151: `.dialog` (width 580) holding `h2.t-h1`, `.list`, `.notice.accent` (flex column, 6px gap), `p.t-small` and `.actions`, all children of one flex column.
- **Frame numbering:** `e2e/web/lib/mockup-frames.json` L333-354. W12 #2 is the phone, #3 is the tablet. `mockup(page, board, index, { note })` is at `e2e/web/lib/mockup.js:45`.
- **Workflow 12 §The key**, `docs/workflows/12-setlists.md` L44-54. A target key, applied for reading over the user's own transposition while playing from the setlist. Without the song's own `key`, "the setlist's `key` is shown as a note instead".
- **cifra.md §10.7.1**, `cifra.md/spec/10-setlists.md` L326-354:
  - The interval is between pitch classes, so enharmonic spellings are the same key ("a song in `A#` played from `- key: Bb` is not transposed").
  - The key is not applied, and is shown as a note, when the song has no key, when the two keys **differ in mode**, or when the value is not a key.
- **`app/src/books/setlist-play.js`:**
  - `noteOf` at L15-21 strips the trailing `m`.
  - `playKeyOffset` at L33-44 returns 0-11, or `null` when either key is missing or unparseable.
  - Unit tests are in `setlist-play.test.js` L14ff. One of them pins `playKeyOffset('Em', 'F#m') === 2`, at L24.
- **`app/src/books/SetlistPlay.jsx`:**
  - the key derivation at L186-192: `itemKeyOffset`, `noteOnly`, `offset`, and `currentKeyName`, which is non-null only when `offset` is non-zero;
  - the bar at L206-218, with the chip at L215-217;
  - the body lines at L232-239: `play.setlistKey` / `play.setlistKeyNote`.
- **Copy in `app/src/i18n/locales/en.js`:**
  - L452 `play.inKey` *"In {key}"*;
  - L453 `play.setlistKey` *"Setlist key {key} · written in {songKey}"*;
  - L454 `play.setlistKeyNote` *"Setlist key {key}"*.
  - pt-BR has the same keys at L410-412, and es-419 and it have them too. **No new copy is needed.**
- **`app/src/books/AddToSetlist.jsx`:**
  - `Modal.dialog.setlist-dialog` > `Dialog` at L138-139;
  - the children at L142-223 (Heading, `.list`, `.notice.accent.setlist-copy-notice`, `p.t-small`, `.actions`);
  - `NewSetlistDialog` at L244-288: `Modal.dialog` > `Dialog` > a class-less `<form>` holding Heading, `TextField.field` and `.actions`.
- **CSS:**
  - `app/src/books/setlist.css` L168-171: `.setlist-dialog` sets width only. There is no `.setlist-copy-notice` rule.
  - `app/src/theme/theme.css`: L368 `.dialog`; L351 `.notice` is a wrapping row, so the board's column notice needs its own rule.
  - The precedent for the fix is `app/src/songs/arrange.css` L138-143.
- **Existing tests:**
  - `SetlistPlay.behavior.test.jsx`: L133 (transposed), L143 (note-only), L155 (own transposition), L228 (axe on three states).
  - `SetlistView.behavior.test.jsx` L282-350, the `AddToSetlist dialog` block: Add, Copy and add, New setlist.
  - `e2e/web/tests/setlist-play.spec.js` L70-124: it plays *A Short Set*, captures W12#2 at L93 on the first song, and asserts *In A* and the setlist line at L99-100 after Next.
  - `e2e/web/tests/setlists.spec.js`: L134-174 captures W12#3 at L162 on the copy notice; L39-78 goes through the New setlist dialog.
- **Fixture:** `app/example-book/a-short-set.setlist.md`. Item 3, *Walking to the Market*, carries `- key: A`, and the song is written `- key: G` (`walking-to-the-market.cifra.md` L2). In the player it is 2 of 2, because *The Ferry Line* is deleted and skipped. That matches the board's "2 of 5", the second song of the set.

## Constraints / requirements

- **Key display rules.** These apply to the current item, and follow §10.7.1 and workflow 12 §The key.
  - **Item key, song key known, modes agree, different pitch class.** The chart is transposed. The chip reads *In {transposed key}* and the line reads *Setlist key {key} · written in {songKey}*. This is unchanged.
  - **Item key, song key known, modes agree, same pitch class** (offset 0, including an enharmonic respelling). The chart is not transposed. The chip reads *In {songKey}* and the line reads *Setlist key {key}* (`play.setlistKeyNote`), with no "written in", because nothing was moved.
  - **Item key, but the song has no key, either key is not a key, or the modes differ.** The key is not applied. The line reads *Setlist key {key}* and there is **no chip**: the chart is in no key the band agreed, so the bar must not claim one.
  - **No item key.** This is unchanged: the user's own remembered transposition applies, the chip appears only when it moves the chart, and there is no setlist line.
- **The mode rule lives in the pure glue.** `playKeyOffset` returns `null` when the two keys differ in mode (one ends in `m` and the other does not). Same-mode minors keep working (`Em` → `F#m` is 2).
- **View only.** Nothing is written. The setlist's `key` is kept as written, as before (§10.7.1 L353-354).
- **Dialog layout.**
  - The `Dialog` inside `.setlist-dialog` becomes a flex column with the `.dialog` gap (`calc(var(--u) * 2)`) and no focus outline of its own, as `.arrange-addvar-dialog` does.
  - The New-setlist `<form>` gets the same column and gap.
  - `.setlist-copy-notice` is a column with a 6px gap (board L141). Its rule must also neutralise `theme.css` L361's `flex: 1 1 0` on the first span in column direction, so the copy text keeps its height.
  - These are layout rules in `setlist.css`, tokens only, and `theme.css` is not edited (it stays the verbatim visual language).
- **Accessibility.**
  - The chip and line are text, so the key is carried by a word, not colour.
  - The `Dialog` keeps its accessible name, and the controls stay RAC.
  - axe stays clean at WCAG 2.1 AA on every new state.
- **No new copy.** The existing `play.*` keys cover every case, in all four locales.

## Acceptance criteria

### Behavior delivered

1. **The keyed song shows its key, as drawn.** Playing *Walking to the Market* (written in G) from *A Short Set* (`- key: A`):
   - the chart is in A;
   - the bar holds the chip *In A* beside the title and position;
   - the body opens with *Setlist key A · written in G* (W12 L78, L81).
2. **A setlist key equal to the written key is still named.** The chip reads *In {songKey}* and the line *Setlist key {key}*. The chart is not moved, and an enharmonic target counts as the same key (§10.7.1 L335-337).
3. **A mode mismatch is shown as a note.** For a song in `Am` under `- key: C`:
   - the chart is untransposed;
   - the line reads *Setlist key C*;
   - there is no chip (§10.7.1 L342-347).

   A keyless song under an item key behaves the same, as before.
4. **The Add-to-setlist dialog breathes.** The heading, the setlist list, the copy notice, the explanatory line and the actions are spaced by the dialog's gap (16px at the default density). The copy notice stacks its sentence over the path. The New-setlist dialog spaces its heading, field and actions the same way (W12 tablet #3).

### Tests, by level

The note names **behavior** and **e2e-web**. A **unit** case is added for the pure `playKeyOffset` rule (Decision 3). No level is dropped.

- **unit — `app/src/books/setlist-play.test.js`**, extending the `playKeyOffset` describe:
  - *differ in mode → null*: `playKeyOffset('Am', 'C')` and `playKeyOffset('C', 'Am')` are `null`;
  - *same pitch class → 0*: `playKeyOffset('G', 'G')` is `0` and `playKeyOffset('A#', 'Bb')` is `0`;
  - the existing `Em` → `F#m` = 2 case still passes.

  *Pins:* cifra.md §10.7.1 L335-347.
- **behavior — `app/src/books/SetlistPlay.behavior.test.jsx`**, extended with new fixture items. The songs are written for the purpose: one in G under `- key: G`, and one in `Am` under `- key: C`.
  - *the chip sits in the bar*: on the transposed song (the existing L133 case), *In A* is inside the same bar as the **Stop playing** button, and *Setlist key A · written in G* is inside the sheet `region` (W12 L78, L81).
  - *a setlist key equal to the written key is named*: the chip reads *In G*; the text *Setlist key G* is present; nothing matching `/written in/` is present; the chart chords are untransposed.
  - *a mode mismatch is a note*: the line *Setlist key C* is present; there is no `/^In /` chip; the chords are as written.
  - *axe*: the existing L228 case is extended to the equal-key and mode-mismatch states.

  *Pins:* W12 phone #2; workflow 12 §The key; §10.7.1.
- **behavior — `app/src/books/SetlistView.behavior.test.jsx`**, the `AddToSetlist dialog` block:
  - the *Copy and add* case (≈L320) asserts that the dialog (`getByRole('dialog', { name: 'Add to setlist' })`) carries the layout class `setlist-dialog-body`, and holds the heading, the list group, the notice, the line and the actions in the board's order;
  - the *New setlist* case (L335) asserts that its form carries `setlist-name-form`;
  - axe runs on both states.

  jsdom has no layout, so the gap itself is pinned at e2e. *Pins:* W12 tablet #3 L134-151.
- **e2e-web — `e2e/web/tests/setlist-play.spec.js`**, *"plays a setlist through, in the setlist key, skipping a missing song"* (L70), on phone, tablet and computer, through the real UI only:
  - The `mockup(page, 'W12-setlists', 2)` capture moves from the first song (L93) to after **Next song**, on *Walking to the Market*: `mockup(page, 'W12-setlists', 2, { note: 'setlist key' })`. That is the state the board draws.
  - Its assertions are tightened: *In A* is visible **within** the player's bar, the one holding **Stop playing** (`locator('.play-bar')`), and *Setlist key A · written in G* is visible within the sheet region.
  - `checkA11y()` stays on that state (L103).

  *Pins:* W12#2; workflow 12 §The key.
- **e2e-web — `e2e/web/tests/setlists.spec.js`:**
  - *"copy a song from another book into a setlist (Copy and add), saved"* (L134), on all three viewports. Before the W12#3 capture (L162), it reads the bounding boxes of the dialog's heading, list, notice, explanatory line and actions, and asserts each vertical gap is ≥ 12px. The capture then becomes `mockup(page, 'W12-setlists', 3, { note: 'dialog spacing' })`, and `checkA11y()` stays.
  - *"build a setlist from songs, add a second, edit key and note, and save"* (L39). With the New-setlist dialog open, it asserts the heading → field and field → actions gaps are ≥ 12px.

  *Pins:* W12#3.

**Drivability.** Every case is driven by what already exists:

- the bundled example book and its *A Short Set*, whose keyed item plays transposed;
- the journeys `openExampleBook`, `deleteSongInFiles`, `openSetlist`, `enterPlayer`, `addToSetlistFromSearch` and `addToNewSetlist`;
- the existing behavior fixtures, extended with purpose-written songs.

No hosted book, second device or sign-in is needed. The equal-key and mode-mismatch states are pinned at the behavior level only. The bundled book holds neither, and building one through the real UI (writing a song, a setlist key, a save) would only repeat what the behavior tests pin, while the user-visible promise, the keyed song as drawn, is pinned at e2e.

No test is deferred, and there is no deferred WBS leaf.

## Decisions

1. **Capture W12#2 on the keyed song instead of adding key UI.**
   - *Rationale:* The player already renders the chip in the bar and the line in the body, where the board puts them (`books.play` AC 3). The audit saw "neither" because the capture was taken on a keyless song. Moving the capture to the board's state is what makes the pairwise comparison true.
   - *Rejected:* adding a key chip to keyless songs. The board draws none, and workflow 12 gives a keyless item no key to show.
2. **Show the chip whenever a setlist key is in force and known, including offset 0.**
   - *Rationale:* The chip tells the performer the key they are playing in. Hiding it exactly when the band's key equals the written one leaves them guessing. `play.md` also promised "the written key named when they differ", so the line drops "written in" when they don't.
   - *Rejected:* keeping the chip for transposition only. A setlist key would then be visible only sometimes, for no reason the player can see.
   - The chip names the song's written key (the chart's spelling), not the setlist's respelling, so the chip and the chords agree.
3. **Mode mismatch is a `null` from `playKeyOffset`.**
   - *Rationale:* §10.7.1 makes it the same case as a missing song key: not applied, shown as a note. Putting it in the pure helper means the existing `noteOnly` path in `SetlistPlay` handles it with no new branch, and a unit test pins it.
   - *Rejected:* a separate mode check in the component, which would make two places decide applicability.
   - The §10.7.1 duty to *report* a bad setlist key "where the setlist's writer will see it" belongs to the setlist editor, not the player. It is outside this task's note and is not scoped here.
4. **Fix the gap on the inner containers with layout classes in `setlist.css`.**
   - *Rationale:* RAC puts the `Dialog` element between `.dialog` and its content. `songs.arrange` already solved this with a class on the `Dialog` (`arrange.css` L138-143). Doing the same keeps `theme.css` verbatim.
   - *Rejected:* a global `.dialog > [role=dialog]` rule in `theme.css`. It would edit the shared visual language and change every other dialog's layout in a polish task scoped to W12.
5. **Pin the spacing at e2e, by measured gaps.**
   - *Rationale:* jsdom computes no layout, so a behavior test can only see the class. A bounding-box gap through the real UI is the observable promise.
   - *Rejected:* screenshot diffing. The `mockup()` captures are for the human audit, not assertions.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-16.

- `app/src/books/setlist-play.js`: `playKeyOffset` returns `null` when the two keys differ in mode (§10.7.1); same pitch class (enharmonic included) gives 0. Unit cases in `app/src/books/setlist-play.test.js`.
- `app/src/books/SetlistPlay.jsx`: the key chip appears whenever a setlist key is in force, including offset 0 (chip names the written key, line drops "written in"); a mode mismatch is shown as a note with no chip.
- `app/src/books/AddToSetlist.jsx`, `app/src/books/setlist.css`: `setlist-dialog-body` and `setlist-name-form` column-and-gap layouts, and a column `setlist-copy-notice`, as W12 tablet #3 draws; `theme.css` untouched.
- `app/src/books/SetlistPlay.behavior.test.jsx`: chip in the bar, setlist line in the sheet, equal-key and mode-mismatch states, axe (fixture gained two purpose-written songs, "1 of 5").
- `app/src/books/SetlistView.behavior.test.jsx`: the dialog's layout classes and order of parts, axe on both dialogs.
- `e2e/web/tests/setlist-play.spec.js`: chip within `.play-bar`, line within the sheet, W12#2 captured on *Walking to the Market* ("setlist key").
- `e2e/web/tests/setlists.spec.js`: measured gaps of at least 12px in both dialogs; W12#3 captured ("dialog spacing").
- No tech-debt follow-up.

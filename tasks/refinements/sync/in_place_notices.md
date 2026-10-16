# sync.in_place_notices — Full-screen and editor merge notices as drawn

## TaskJuggler entry

[`tasks/45-sync.tji`](../../45-sync.tji), lines 83-88:

> Workflow 8 (A song open while it changes; W08): full-screen reading lacks the
> song title and the footnote that an update is waiting until it is left, and
> its control reads Exit full screen; the editor's merge notice does not say
> the incoming save was merged under the unsaved edits, and the editor shows no
> unsaved mark. Source: UI pairwise audit 2026-10-14 (e2e mockup() screenshots
> vs rendered boards, audit/out). Tests: behavior (the footnote while full
> screen; the merged-under-your-edits notice; axe); e2e-web (mockup W08#3-5).

`depends !read_in_place, songs.edit_in_place` — both `complete 100`.
Milestone: M5 (`tasks/99-milestones.tji:44`).

## Effort estimate

1d (from the `.tji`). The reading half is copy and layout on a branch that
already exists; the editor half adds one field to an existing Worker event
and one to an existing reply, plus the notice and the mark.

## Repository

Not cifra.md. The work lands in `app/`:

- `app/src/songs/SongReading.jsx`, `app/src/songs/reading.css` — the
  full-screen branch.
- `app/src/editor/SongEditor.jsx` — the merge notice, and the unsaved signal
  it reports to its host.
- `app/src/songs/EditSongHost.jsx` — the unsaved mark.
- `app/src/worker/sync-engine.js`, `app/src/worker/protocol.js`, and the
  `OPEN_SOURCE` handler that replies `SOURCE` — the `summary` on `MERGED` and
  the `unsaved` flag on `SOURCE`.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the copy.
- Tests: `app/src/songs/SongReading.behavior.test.jsx`,
  `app/src/editor/SongEditor.behavior.test.jsx`,
  `app/src/songs/EditSongHost.behavior.test.jsx`,
  `app/src/worker/sync-engine.behavior.test.js`, `e2e/web/tests/read-in-place.spec.js`,
  `e2e/web/tests/edit-in-place.spec.js`, `e2e/web/tests/reading.spec.js`.

No design delta: the W08 board and workflow 8 already decide everything
here. The app is being brought into line with them.

## Inherited dependencies

- **sync.read_in_place** (settled, Done 2026-10-08,
  `tasks/refinements/sync/read_in_place.md`). It delivered the in-place
  update, the *Updated by {name} · See what changed* notice, and the
  full-screen deferral. The deferral is a main-thread view gate (Decision 3):
  `pending` holds `{ author, commit }`, a second merge overwrites it, and
  `leaveFullScreen` applies it. That refinement cites the W08 footnote
  (L155) only as an input. It never built it.
- **songs.edit_in_place** (settled, Done 2026-10-08,
  `tasks/refinements/songs/edit_in_place.md`). It delivered the merged
  working text swapped in under the caret, and the notice. Its D6 reused the
  reading copy *Updated by {name}*, and rejected "a distinct editor wording"
  with "no reason to diverge". The W08 board is that reason, and this task
  supersedes D6's copy. Its D5 (no full-screen deferral in the editor)
  stands. Neither refinement decided an unsaved mark for the editor.
- **songs.editor_chrome** (pending, M5, `tasks/60-songs.tji:147-152`). It is
  a sibling, not a dependency. It owns the editor host as W03/W04 draw it:
  the phone strip *unsaved changes · Kept on this device*, the computer's
  unsaved list and save panel, Save moved into the app bar, and the title
  following the heading. This task places the unsaved mark where W08#3 and
  W04#3-4 draw it, in the app bar. It does not take on the rest of
  editor_chrome (Decision 4).

## What this task is

It brings two W08 surfaces into line with the board.

**Full-screen reading** (W08#4). It gets:
- the song's title on the left of a top row;
- the control renamed *Leave full screen*;
- while a merge is held back, a quiet footnote under the chart: *An update
  from Ana is waiting. It will show when you leave full screen.*

Leaving full screen (W08#5) already shows *Updated by Ana · See what
changed*. That stays.

**The editor** (W08#3). When a sync merges a save under unsaved edits, the
notice says what happened:
- *Ana's save came in while you were editing, and was merged under your
  changes. Yours are still here, unsaved, on top.*
- a *Came in* row with the musical summary of what arrived;
- a link, *See what came in*, that opens the song's history at that commit.

The editor's app bar also gets the word mark *unsaved changes* whenever the
working text differs from the last saved version.

## Why it needs to be done

Workflow 8 §A song open while it changes (`docs/workflows/08-sync.md`
L50-56) promises three things. The full-screen song "waits, and updates when
the user leaves it". Being edited, "the editor shows the result, and says
what came in".

The predecessors delivered the mechanics. The 2026-10-14 pairwise audit
(app screenshots from `mockup()` against the rendered boards) found that the
words the board draws are missing:
- A performer in full screen has no sign that something is waiting, and no
  title to confirm which song is up.
- The editor's notice reads the same as a reader's, *Updated by Ana*. It
  never says the user's own unsaved work survived the merge. That
  reassurance is the point of DIRECTION §3.1's merge-under-the-edit.
- Nothing in the editor says the text is unsaved.

M5 ("the first pass, complete") lists this task in its `depends`.

## Inputs / context

**Workflow and direction**
- `docs/workflows/08-sync.md` L50-56. Being read: in place, with the notice.
  Read full screen: "it waits, and updates when the user leaves it. The
  middle of a performance is the worst moment for a song to move." Being
  edited: "merged under them (DIRECTION §3.1); the editor shows the result,
  and says what came in."
- Workflow 4 (`docs/workflows/04-edit-and-save.md`). The editor shows
  *unsaved changes* while the working copy holds unsaved edits.

**The board, `docs/mockups/W08-sync.dc.html`.** Frames are numbered by
`e2e/web/lib/mockup-frames.json` L218-247: #1-2 phone, #3 tablet, #4-5
computer.
- **W08#3** (tablet, L89-116; caption L90: "editing, when Ana's save is
  merged under the unsaved changes"):
  - app bar L93-99: Back, title `Rua do Porto`, `<span class="badge unsaved
    dot">unsaved changes</span>` (L96), Discard, Save;
  - notice `notice accent`, a column (L101-107);
  - L102: `<b>Ana's save came in while you were editing</b>, and was merged
    under your changes. Yours are still here, unsaved, on top.`;
  - L103-105: a key/value row, key `Came in`, value `Voicings for G4 C4 E4
    A4: added Am, C, Dm, F`;
  - L106: link `See what came in`.
- **W08#4** (computer, L120-158; caption "full screen during a performance:
  Ana's update waits"):
  - top row L123-126: title `<span class="t-h2" style="flex: 1">Rua do
    Porto</span>`, then `<button class="btn quiet">Leave full screen</button>`;
  - chart L127-152;
  - footnote L153-156, right-aligned in `--ink-2`: a 16px sync icon, then
    `<span class="t-small">An update from Ana is waiting. It will show when
    you leave full screen.</span>`. No banner, no button.
- **W08#5** (computer, L159-191; caption L159: "after leaving full screen:
  the update in place"). The notice at L177 is `Updated by Ana` / `See what
  changed`, already what the app renders. (`mockup-frames.json` labels #5
  with #4's caption. That is a renderer quirk in `audit/render-mockups.mjs`.
  It is harmless to `mockup()` and out of scope here.)
- W04 (`docs/mockups/W04-edit-and-save.dc.html`) draws the same mark in the
  editor app bar on tablet (L107) and computer (L158), and on the phone in a
  strip under the app bar (L35-37).

**Code**
- `app/src/songs/SongReading.jsx`:
  - L167 `fullScreen`, L182-183 `update`/`pending`, L220-225 `applyUpdate`,
    L231-238 the MERGED handler (`if (fullScreen) setPending(next)`),
    L242-245 `leaveFullScreen`;
  - the full-screen branch L504-525: `.reading-fullscreen`, the exit
    `Button` L507-509 with `t('reading.exitFullScreen')`, and the
    `role="region"` scroll whose `aria-label` is the title, with no visible
    title;
  - the notice L597-620 (`.reading-update-notice`, `role="status"`).
- `app/src/songs/reading.css` L176-212 (`.reading-fullscreen`,
  `.reading-exit-full`).
- `app/src/editor/SongEditor.jsx`:
  - L125-130 `update` and `mergePending`;
  - L324-336 the MERGED handler (sets `{ author, commit }`, re-sends
    `OPEN_SOURCE`);
  - L342-350 adopting the merged text via `minimalChange`;
  - L459-478 the notice (`.est-editor-update-notice`, `role="status"`,
    `t('editor.updatedBy')`, a *See what changed* button calling
    `onOpenHistory({ bookId, path, commit })`, and a dismiss button).
- `app/src/songs/EditSongHost.jsx` L70-80, the app bar: Back, title,
  Discard. It has no unsaved mark. The mark exists in
  `app/src/songs/NewSongHost.jsx` L75 (`<span className="badge unsaved
  dot">`), which is the model to follow.
- `app/src/worker/sync-engine.js`:
  - L423-440 `incomingCommitFor`;
  - L446-470 `announceMerge`, which emits `{ bookId, changed: [{ path,
    author, commit }] }`;
  - `before`/`after` are the pre-merge and merged heads.
- `app/src/worker/protocol.js`:
  - L673-693 the MERGED contract ("path, author name and commit oid only —
    never song text");
  - L707 the precedent: the CONFLICTS event's `incoming` already carries
    `{ path, title, author, summary }`;
  - L586-590 `SOURCE` `{ bookId, path, text }`.
- `app/src/worker/save-preview.js` L87 and `app/src/worker/bring-in.js` L77
  already compute `diff(parse(before), parse(after)).summary` with
  `cifra-md`. The *Came in* summary is that same call.
- i18n: `app/src/i18n/locales/en.js` L1521-1529 (`reading.fullScreen`,
  `reading.exitFullScreen`, `reading.updatedBy`, …) and L1800-1807
  (`editor.updatedBy`, `editor.seeWhatChanged`, `editor.updateDismiss`).
  The same keys are in `pt-BR.js` (e.g. L1368, L1643), `es-419.js` and
  `it.js`.

**Tests already standing**
- `SongReading.behavior.test.jsx`:
  - L509: full screen enters and returns, finding the *Exit full screen*
    button;
  - L693: defers in full screen and applies on leaving, collapsing two
    merges (Ana, then Bruno), clicking *Exit full screen* at L699 and L719.
- `SongEditor.behavior.test.jsx` L440-560, the edit_in_place block. L448
  asserts the *Updated by* status.
- `e2e/web/tests/read-in-place.spec.js` L174-207, the full-screen test:
  `mockup(page, 'W08-sync', 4)` at L196, *Exit full screen* at L200,
  `mockup(page, 'W08-sync', 5)` at L205.
- `e2e/web/tests/edit-in-place.spec.js` L57-110: asserts *Updated by Ana
  Luiza*, then `mockup(page, 'W08-sync', 3)` at L103.
- `e2e/web/tests/reading.spec.js` L48-60: enters and leaves full screen by
  *Exit full screen*.
- Journey helpers:
  - `e2e/web/lib/journeys-sync.js`: `hostedBookWithSongs` (L13),
    `enterFullScreen` (L36);
  - `e2e/web/lib/journeys.js`: `networkBlip` (L182), `openSongInEditor`
    (L261), `typeAtEndOfLine` (L268), `settleEdits` (L279);
  - `e2e/web/lib/git-device.js`: `GitDevice`, the second device, the git CLI
    acting as the same user.

## Constraints / requirements

- **Offline first; the Worker owns the data.** The summary and the unsaved
  flag are computed in the Worker from what it already holds: the two heads'
  blobs, and the working copy against HEAD. The view reads them off events.
  The main thread never touches IndexedDB and never reads git.
- **No song text over the wire beyond what the screen draws.**
  - MERGED gains `summary`, the neutral-English musical summary `diff`
    already produces (chord names, section names, voicings). That is the
    same class of data CONFLICTS' `incoming.summary` already carries.
  - Never lyrics lines, and never logged. Update the L673-693 comment to
    name the new field.
- **The full-screen gate stays where it is** (read_in_place Decision 3).
  - The footnote is driven by the existing `pending` state.
  - Two merges while in full screen still collapse to the most recent. The
    footnote names the most recent author.
  - Nothing moves the chart.
  - The footnote is a static line, not a live region that interrupts
    (Decision 3).
- **Status carried by a word.** The mark reads *unsaved changes* in the
  `badge unsaved dot` style. The footnote is words with a decorative icon
  (`aria-hidden`). Neither relies on colour.
- **React Aria Components** for every control:
  - *Leave full screen* stays a RAC `Button`;
  - *See what came in* is a RAC `Button` styled as the board's `act` link,
    as the reading notice's *See what changed* is.
- **Keyboard.** Nothing new takes focus. The editor notice stays
  `role="status"`, non-modal and dismissible, with the caret where it was
  (edit_in_place D3).
- **axe at WCAG 2.1 AA** on every state touched.
- **All four locales** get every new or changed key.
- **Canonical form is untouched.** No save path changes. The mark reflects
  the working copy and never writes anything.
- **Test fixtures** are the songs the specs already write for the purpose
  (`Lantern on the Pier`, `Harbour Lights`).

## Acceptance criteria

### Behavior delivered

1. **The full-screen top row** (W08#4 L123-126). In full screen, on every
   viewport, a top row shows:
   - the song's title, visible, as the board's `t-h2`, filling the free
     space;
   - then the control *Leave full screen*. Locale key renamed
     `reading.leaveFullScreen`; `reading.exitFullScreen` is removed in all
     four locales.

   The scroll region keeps its title `aria-label`. The visible title is a
   heading-styled span, not a second landmark. The phone layout keeps the
   chart's width: the row is one line, and the title truncates with an
   ellipsis before the control does.
2. **The waiting footnote** (W08#4 L153-156). While `pending` is set in full
   screen:
   - a footnote sits under the chart, at the end of the scroll content,
     right-aligned, `t-small` in `--ink-2`;
   - it reads *An update from {name} is waiting. It will show when you
     leave full screen.* (`reading.updateWaiting`), with the sync icon
     `aria-hidden`;
   - after two merges it names the most recent author;
   - it is absent when nothing is pending;
   - it disappears when the reader leaves, as the update applies and the
     *Updated by {name}* notice shows (W08#5 L177, unchanged).
3. **The editor's merge notice** (W08#3 L101-107). When MERGED names the
   open editor's song, the existing notice (same element, same `role`,
   same dismiss) now reads as a column:
   - *{name}'s save came in while you were editing, and was merged under
     your changes. Yours are still here, unsaved, on top.*
     (`editor.mergedUnder`, with the lead clause in `<b>`; the locale
     carries it as two keys or a rich-text slot, the implementer's choice);
   - a *Came in* row (`editor.cameIn`) with the MERGED entry's `summary`,
     present only when `summary` is non-empty;
   - *See what came in* (`editor.seeWhatCameIn`), which calls
     `onOpenHistory({ bookId, path, commit })` as before.

   `editor.updatedBy` and `editor.seeWhatChanged` are removed, since nothing
   else uses them. The reading view's `reading.updatedBy` /
   `reading.seeWhatChanged` are untouched.
4. **MERGED carries the summary** (`sync-engine.js` `announceMerge`). Each
   `changed` entry gains `summary`: `diff(parse(blob at before),
   parse(blob at after)).summary` for that path. A song new in `after`
   diffs against an empty parse. A blob read or parse fault yields `''`,
   and the event still goes out (offline-first: a fault never breaks the
   pass). The protocol comment is updated.
5. **The editor's unsaved mark** (W08#3 L96; W04 L107, L158).
   - `SOURCE` gains `unsaved: boolean`: the working-copy text differs from
     HEAD's blob for that path, or the path is absent from HEAD. It is
     computed in the `OPEN_SOURCE` handler.
   - `SongEditor` reports `onUnsavedChange(bool)` to its host:
     - true when the last SOURCE said `unsaved`, or the user has changed the
       buffer since that SOURCE;
     - false after a SAVED for its path.
   - A Discard remounts the editor (`reloadKey`), and the fresh SOURCE says
     false.
   - `EditSongHost` renders `<span className="badge unsaved dot">` with
     *unsaved changes* (`editor.unsaved`) between the title and Discard,
     while it is true:
     - in the app bar on tablet and computer;
     - on phone in a strip directly under the app bar (W04 L35-36, the mark
       alone; the strip's *Kept on this device* is editor_chrome's).
   - After a merge under unsaved edits the mark stays. The re-read SOURCE
     says `unsaved: true`, which is what the notice promises.

### Tests, by level

**behavior**
- `app/src/songs/SongReading.behavior.test.jsx`:
  - *"full screen shows the title and Leave full screen (sync.in_place_notices;
    W08#4 L123-126)"*. Extends L509: the title text is visible in full
    screen; the control is named *Leave full screen*; no *Exit full screen*;
    axe.
  - *"while full screen, a waiting update is a footnote naming its author,
    gone on leaving (sync.in_place_notices; W08#4 L153-156, W08#5 L177;
    workflow 8 L53-54)"*. Extends L693:
    - with no merge, no footnote;
    - after Ana then Bruno, the footnote reads *An update from Bruno is
      waiting. It will show when you leave full screen.*, the chart is
      unmoved, and no `role="status"`; axe;
    - after *Leave full screen*, the footnote is gone, *Updated by Bruno*
      shows, and the chart is updated.
- `app/src/editor/SongEditor.behavior.test.jsx`:
  - *"a merge under unsaved edits says it was merged under your changes,
    with what came in (sync.in_place_notices; W08#3 L101-107; workflow 8
    L55-56)"*. Extends L448:
    - MERGED `{ author: 'Ana Luiza', summary: 'Bridge: added' }` (a
      summary written for the test);
    - the status holds *Ana Luiza's save came in while you were editing,
      and was merged under your changes. Yours are still here, unsaved, on
      top.*, a *Came in* row with the summary, and *See what came in*,
      which calls `onOpenHistory` with the commit;
    - caret kept; axe.
  - *"no Came in row when the merge brought no summary"*: MERGED with
    `summary: ''` renders the sentence without the row.
  - *"reports unsaved from SOURCE and from an edit, cleared by SAVED
    (sync.in_place_notices; W08#3 L96)"*: SOURCE `unsaved:false`, then
    false; a typed change, then true; SAVED for the path, then false; SOURCE
    `unsaved:true`, then true.
- `app/src/songs/EditSongHost.behavior.test.jsx`:
  - *"the app bar carries the unsaved changes mark while the text is unsaved
    (sync.in_place_notices; W08#3 L96, W04 L107/L158)"*:
    - absent when opened in step;
    - present as the word *unsaved changes* after a typed change, in the
      app bar for `mode="tablet"`, and in the strip under it for
      `mode="phone"`;
    - absent again after Discard's remount; axe on both modes.
- `app/src/worker/sync-engine.behavior.test.js`:
  - *"MERGED carries each changed song's musical summary of what came in
    (sync.in_place_notices; W08#3 L103-105)"*. Against a local remote, a
    second clone adds a section to a song and pushes; the pass emits MERGED
    whose entry's `summary` equals `diff(parse(before), parse(after)).summary`
    and is non-empty; a song added remotely diffs against empty.
  - *"OPEN_SOURCE replies unsaved for a working text that differs from HEAD"*
    (in the same file if the OPEN_SOURCE handler is tested there, else
    `app/src/worker/working-copy.behavior.test.js`): in step, false; after a
    WRITE, true; after SAVE, false; a new unsaved song, true.

**e2e-web** (phone, tablet and computer projects; axe on every state touched)
- `e2e/web/tests/read-in-place.spec.js`, the full-screen test (L174-207),
  extended:
  - after `enterFullScreen`, the song title is visible in
    `.reading-fullscreen` and the control is *Leave full screen*;
  - after the second device's push and `networkBlip`, the footnote *An
    update from Ana Luiza is waiting. It will show when you leave full
    screen.* is visible, the chart is unmoved, and no notice shows;
  - `mockup(page, 'W08-sync', 4)`, then `checkA11y()`;
  - *Leave full screen*, then *Updated by Ana Luiza*, then
    `mockup(page, 'W08-sync', 5)`, then `checkA11y()`.

  Pins workflow 8 L53-54 and W08#4-5.
- `e2e/web/tests/edit-in-place.spec.js` (L57-110), extended:
  - after the typed edit and `settleEdits`, *unsaved changes* is visible
    (W08#3 L96);
  - after the merge, the notice holds *Ana Luiza's save came in while you
    were editing, and was merged under your changes.*, a *Came in* row whose
    text is non-empty, and *See what came in*;
  - *unsaved changes* is still visible;
  - `mockup(page, 'W08-sync', 3)`, then `checkA11y()`;
  - *See what came in* opens the history row as before.

  Pins workflow 8 L55-56 and W08#3.
- `e2e/web/tests/reading.spec.js` L48-60: the full-screen round trip uses
  *Leave full screen*. A rename follows the copy; no new case.

No test level the note names is dropped; nothing is deferred; no new WBS
leaf. Tech debt: none.

## Decisions

1. **The footnote rides the existing `pending` gate; it is not a new
   event.** read_in_place Decision 3 already holds the waiting merge's
   author in view state. The footnote renders from it.
   - *Rejected:* a Worker-side "waiting" flag. It would duplicate state the
     view already owns.
   - *Rejected:* making the footnote a `role="status"` live region. A
     performer's screen reader announcing mid-song is the interruption
     workflow 8 L54 forbids. The footnote is read in document order, after
     the chart.
2. **The *Came in* summary is computed in the Worker and carried on
   MERGED.**
   - The Worker has both heads' blobs at merge time. `diff(...).summary` is
     the call `save-preview.js` and `bring-in.js` already make. CONFLICTS'
     `incoming.summary` set the precedent for a summary on a sync event.
   - *Rejected:* the editor reading the commit's before/after through
     `COMMIT_DIFF`/`READ_VERSION` and diffing on the main thread. That costs
     a second round-trip per merge, and puts `parse` work on the UI thread
     during typing.
   - *Rejected:* dropping the row because the note doesn't name it. W08#3
     draws it, and workflow 8 L56 says the editor "says what came in". The
     sentence alone names who, not what.
3. **The editor gets its own copy; edit_in_place D6 is superseded.** D6
   reused *Updated by {name}* because nothing then said otherwise. The
   board does, and the reassurance "yours are still here, unsaved, on top"
   only makes sense in the editor. The reading notice keeps its copy (W08#2,
   W08#5).
4. **The unsaved mark lands here, where W08#3 and W04 draw it. The rest of
   the editor host stays songs.editor_chrome's.**
   - The mark goes in the app bar on tablet and computer (W08 L96, W04 L107,
     L158). On phone it goes in a mark-only strip under the app bar (W04
     L35-36).
   - editor_chrome adds *Kept on this device* to the phone strip, and builds
     the computer unsaved list, Save in the app bar, and the title following
     the heading.
   - Both tasks are in M5 with no order between them. The mark is one span
     driven by one prop, so editor_chrome extends it rather than conflicting.
   - *Rejected:* leaving the mark to editor_chrome. This task's note names
     it, and W08#3's notice says "unsaved" with nothing on screen to point
     at.
   - *Rejected:* the mark in the phone app bar. editor_chrome's note already
     records the phone header truncating the title to a letter, and W04
     draws the phone mark in the strip.
5. **The unsaved signal is `SOURCE.unsaved` plus local edits, not the
   index's flag.**
   - The index's `unsaved` is live-only and reconciled on reload (memory:
     reconcile resets unsaved on reload), and reaches the view only through
     search rows.
   - The Worker answering OPEN_SOURCE already reads the working text. It
     can compare it with HEAD's blob in the same call.
   - The editor knows when the user typed since then.
   - *Rejected:* polling BOOK_TREE's per-path status. That is a whole-tree
     walk to light one badge.
6. ***Exit* becomes *Leave* everywhere**, with the key renamed rather than
   re-valued. W08 L125 and the footnote both say "leave full screen". A
   stale key name would invite the old word back.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-16.

- Full-screen reading shows the song title and *Leave full screen* in a top row, plus the waiting footnote driven by the existing `pending` gate: `app/src/songs/SongReading.jsx`, `app/src/songs/reading.css`.
- The editor's merge notice says the save was merged under the user's changes, with a *Came in* row and *See what came in*; it reports `onUnsavedChange`: `app/src/editor/SongEditor.jsx`, `app/src/editor/editor.css`.
- `EditSongHost` shows the *unsaved changes* mark in the app bar (tablet, computer) and in a strip under it (phone): `app/src/songs/EditSongHost.jsx`, `app/src/songs/new-song.css`.
- Worker: MERGED entries carry `summary`, SOURCE carries `unsaved`, and SAVED also carries the saved `paths` (beyond the refinement, so the editor can tell a save was for its song): `app/src/worker/sync-engine.js`, `logic.js`, `protocol.js`, `reducer.js`.
- Copy in all four locales (`reading.leaveFullScreen`, `reading.updateWaiting`, `editor.mergedUnder`, `editor.cameIn`, `editor.seeWhatCameIn`, `editor.unsaved`): `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Behavior tests: `SongReading`, `SongEditor`, `EditSongHost` behavior tests, `sync-engine.behavior.test.js`, `working-copy.behavior.test.js` (the OPEN_SOURCE harness lives there).
- e2e-web: `e2e/web/tests/read-in-place.spec.js` (W08#4-5), `edit-in-place.spec.js` (W08#3), `reading.spec.js` (renamed control).
- Tech debt: none.

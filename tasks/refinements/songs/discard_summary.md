# songs.discard_summary — Discard says what would be lost

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) — `task discard_summary "Discard says what would be lost"` (line 131), area `songs`.

> The discard confirm reads *This would be lost:* and then lists nothing (W04 tablet), where workflow 4 §Discarding shows the same musical summary as the save sheet (the save sheet for the same edit does list it). Source: UI pairwise audit 2026-10-14 (e2e mockup() screenshots vs rendered boards, audit/out). Tests: behavior (the confirm lists the changes from the preview; axe); e2e-web (edit, Discard: the change is listed; mockup W04#3).

## Effort estimate

0.5d.

## Repository

Not under `cifra.md/`. The work lands in `app/`:

- `app/src/editor/SongEditor.jsx` — a host-callable flush of the pending debounced `WRITE`.
- `app/src/songs/EditSongHost.jsx`, `app/src/songs/NewSongHost.jsx`, `app/src/files/RawEditorHost.jsx` + `app/src/files/FileView.jsx`, `app/src/editor/EditorDev.jsx` — flush before opening the discard confirm.
- Tests in `app/src/editor/SongEditor.behavior.test.jsx`, `app/src/songs/EditSongHost.behavior.test.jsx`, `app/src/files/FileView.behavior.test.jsx`, `e2e/web/tests/save-sheet.spec.js`, `e2e/web/tests/edit-and-save.spec.js`.

## Inherited dependencies

- `songs.save_sheet` — **settled** (complete). Built `DiscardConfirm.jsx`, the `PREVIEW_SAVE` → `SAVE_PREVIEW` round trip and the `savePreview` slice, and `DiffRows`. Its refinement scopes the confirm as "the same summary as *what would be lost*" (`tasks/refinements/songs/save_sheet.md:274-278`).
- `songs.edit_in_place` — **settled** (complete). Built `EditSongHost` (the appbar with Back, title and Discard over `SongEditor`) and set the rule that the pre-merge debounced `WRITE` is *cancelled*, not flushed, when a merge is adopted (`tasks/refinements/songs/edit_in_place.md:185-190`). This task leaves that rule alone.

Test prerequisites, all landed: the example book and the editor journeys (`e2e/web/lib/journeys.js`, `journeys-edit.js` `addSection`), the e2e-web harness with `mockup()` and `checkA11y` (`foundation.e2e_web`), the W04 mockup frame #3 (`e2e/web/lib/mockup-frames.json:135-139`, tablet, "discard shows what would be lost, and always asks"). No dependency to add.

## What this task is

Make the discard confirm list what the edit changed. The dialog itself is right: it asks the Worker for the same `PREVIEW_SAVE` the save sheet asks for and renders `previews[0].changes` through `DiffRows` (`app/src/songs/DiscardConfirm.jsx:36-39`, `:53`, `:72`). The bug is upstream of it. `SongEditor` persists typing with a 400 ms debounced `WRITE` (`app/src/editor/SongEditor.jsx:44`, `:160-174`). Its own **Save** button sends any still-pending write before it hands over, so the save sheet's preview sees the text as typed (`SongEditor.jsx:383-401`). The **Discard** button sits in the host's appbar, outside the editor (`app/src/songs/EditSongHost.jsx:69-71`), and opens the confirm without that flush. When Discard is pressed inside the debounce, the confirm's `PREVIEW_SAVE` reaches the Worker before the `WRITE`. It diffs HEAD against a working copy that does not hold the edit yet, so it comes back with no changes and the dialog reads *This would be lost:* above an empty list. That is the W04 tablet frame, where the journey adds a section and taps Discard at once.

The fix is a flush the hosts can call. `SongEditor` factors its existing flush (Save and unmount already have one each) into one function and gives it to the host through a ref. Every host whose Discard sits outside the editor calls it before it opens the confirm.

## Why it needs to be done

Workflow 4 §Discarding (`docs/workflows/04-edit-and-save.md:87-91`) says Discard "shows what would be lost — the same summary as save — and always asks, since it is the one destructive action here". An empty list over a destructive action says *nothing would be lost*, which is wrong in exactly the case that matters: an edit made seconds ago.

There is a second, silent harm, and this fix also closes it. A `WRITE` still pending when the user confirms can land **after** the `DISCARD`. That happens through the debounce timer, or through the unmount flush when `EditSongHost` remounts the editor on `DISCARDED` (`EditSongHost.jsx:99`, `SongEditor.jsx:262-269`). The file is then written back with the text the user just chose to throw away. Once the flush runs before the confirm opens, nothing is pending: the dialog is modal, so no keystroke can land between the flush and the `DISCARD`.

Downstream: the W04 board comparison of the UI pairwise audit (`design.boards_refresh`, the m5 polish milestone `tasks/99-milestones.tji:44`).

## Inputs / context

- **Workflow 4 §Discarding** — `docs/workflows/04-edit-and-save.md:87-91` (normative): same summary as save, always asks.
- **Workflow 4 §Saving / §Save pushes** — the summary the save sheet shows, which the confirm reuses (`docs/workflows/04-edit-and-save.md`).
- **DIRECTION §3.7** — the view is the only React layer; the Worker owns the working copy; commands are handled in order. Ordering `WRITE` before `PREVIEW_SAVE` on the one command channel is enough, and is what Save already relies on (`SongEditor.jsx:389-391`).
- **Mockup** — `docs/mockups/W04-edit-and-save.dc.html`, the tablet discard dialog: *Discard changes to {title}?*, *The song goes back to how it was last saved. This would be lost:*, then the `.diff` rows, *Keep editing* and danger *Discard changes*. The copy is `app/src/i18n/locales/en.js:943-946`; a section-added row reads `{section}` / *section added* (`en.js:964`, `app/src/songs/render-change.js:69-70`).
- **Code seams:**
  - `app/src/editor/SongEditor.jsx` — `WRITE_DEBOUNCE_MS = 400` (`:44`); `writeTimer` / `pendingWrite` refs and `scheduleWrite` (`:155-174`); the unmount flush (`:262-269`); the Save-press flush (`:383-401`); the `editorRef` prop (`:108`, `:260`, `:272`), which hands the host the CodeMirror view.
  - `app/src/songs/DiscardConfirm.jsx:22-87` — the confirm; unchanged by this task.
  - Discard triggers outside the editor: `EditSongHost.jsx:69-71` (appbar), `NewSongHost.jsx:68` (appbar, a never-saved draft), `RawEditorHost.jsx:40` → `FileView.jsx:193-196` (Delete on a never-saved file opens the `DiscardConfirm` at `FileView.jsx:303-307`), `EditorDev.jsx:56` (dev mount).
- **Existing tests this extends:**
  - `app/src/editor/SongEditor.behavior.test.jsx:333-348` — "sends a still-debounced edit before Save hands over", the pattern for the flush case.
  - `app/src/songs/SaveSheet.behavior.test.jsx:270-299` — the confirm rendering an emitted preview (the confirm in isolation; it passes today, which is why the bug went unseen).
  - `app/src/songs/EditSongHost.behavior.test.jsx:74-110` — the host harness (`makeStore`, `SHELF`, `SOURCE`).
  - `e2e/web/tests/save-sheet.spec.js:52-72` — the Discard journey, which takes the W04#3 frame right after `addSection`. It asserts only the *This would be lost* line, never a row.
  - `e2e/web/tests/edit-and-save.spec.js:51-72` — Back (an unmount flush), reopen, Discard; also takes W04#3.

## Constraints / requirements

1. **No change to the confirm, the Worker or the protocol.** `PREVIEW_SAVE` already computes the right summary from the working copy. The fix makes the working copy current before the preview is asked for. No new command, and the preview does not carry buffer text.
2. **One flush, three callers.** The Save press, the unmount cleanup and the host's flush all go through one function in `SongEditor`. It clears the timer, sends the pending text as a `WRITE` if `bookId` and `path` are set, and clears `pendingWrite`. The flush must *clear the timer*: if the host just sent the buffer itself, the timer would still fire later, after the `DISCARD`.
3. **The merge rule is unchanged.** On `MERGED` the pending write is still *cancelled*, not flushed (`songs.edit_in_place` Decision; `SongEditor.jsx` around `:312`).
4. **Every host with an outside Discard flushes first:** `EditSongHost`, `NewSongHost`, `RawEditorHost`/`FileView` (Delete on a never-saved file) and `EditorDev`. A host with no mounted editor gets a ref whose `.current` is null. Calling it is then a no-op (`flushRef.current?.()`).
5. **Accessibility unchanged and re-checked.** The confirm stays a RAC `ModalOverlay`/`Dialog`, with the danger action named in words. axe at WCAG 2.1 AA runs on the dialog with rows in it, in behavior and e2e.
6. **Test songs** are the repository's own fixtures (*Morning on the Porch*, *Tarde Clara*, `# Tide`), never someone else's words.

## Acceptance criteria

Behavior delivered:

1. Pressing **Discard** (appbar) right after an edit, inside the 400 ms debounce, opens a confirm that lists that edit's change rows, the same rows the save sheet shows for the same edit. *Pins workflow 4 §Discarding.*
2. Confirming the discard leaves the song as last saved. No `WRITE` of the discarded text reaches the Worker after the `DISCARD`, neither from the debounce timer nor from the editor's remount on `DISCARDED`. *Pins workflow 4 §Discarding ("puts the song back as last saved").*
3. The same holds for the new-song host's Discard and the file view's Delete of a never-saved file.

Tests, by level:

- **behavior — `app/src/editor/SongEditor.behavior.test.jsx`**, new case *"a host flush sends the still-debounced edit once, and nothing after"*: render with `flushRef`, load `SOURCE`, dispatch an edit, call `flushRef.current()`. Exactly one `WRITE` with the buffer text has been sent. Then advance past `WRITE_DEBOUNCE_MS` and unmount: no second `WRITE`. *Pins Constraint 2 (the timer is cleared, so nothing can follow a DISCARD).* The existing Save-flush case at `:333` keeps passing through the shared function.
- **behavior — `app/src/songs/EditSongHost.behavior.test.jsx`**, new `describe('edit → Discard (workflow 4 §Discarding)')`:
  - *"Discard right after an edit previews the edit"*: an edit through `editorRef`, then a click on the appbar **Discard changes** at once. In `sent`, the `WRITE` with the edited text comes **before** the `PREVIEW_SAVE {bookId, paths:[PATH]}`. Emit `SAVE_PREVIEW` with a change record. The dialog shows *This would be lost* **and** the row (e.g. the section name and *section added*). axe WCAG 2.1 AA on the dialog is clean. *Pins workflow 4 §Discarding, "the same summary as save".*
  - *"a confirmed discard writes nothing back"*: same start, then confirm **Discard changes** and emit `DISCARDED`. The editor remounts, and no `WRITE` follows the `DISCARD` in `sent`, including after the debounce window. *Pins workflow 4 §Discarding, "back as last saved".*
- **behavior — `app/src/files/FileView.behavior.test.jsx`**, new case *"Delete on a never-saved file flushes before the discard confirm previews"*: the command order is `WRITE` then `PREVIEW_SAVE` when Delete is pressed inside the debounce. *Pins Constraint 4 for the file view host.* (`NewSongHost` and `EditorDev` take the same one-line wiring. `NewSongHost`'s Discard is exercised end to end by the existing new-song journeys; it has no behavior file of its own, and this task does not add one for one line.)
- **e2e-web — `e2e/web/tests/save-sheet.spec.js`**, the existing *"Discard shows what would be lost, always asks, and reverts the song; axe-clean"* (`:52`) is sharpened: after `addSection(page, 'ThrowawayCoda')` and an immediate tap on **Discard changes**, the dialog shows a row with `ThrowawayCoda` and *section added* before `mockup(page, 'W04-edit-and-save', 3)` and `checkA11y()`. After confirming, the editor no longer holds `ThrowawayCoda`, and a reopened editor (Back, open from search, Edit) still does not. Runs on phone, tablet and computer. *Pins workflow 4 §Discarding; mockup W04#3.*
- **e2e-web — `e2e/web/tests/edit-and-save.spec.js`**, *"Back from the editor keeps the unsaved edit, and Discard reverts it"* (`:51`) also asserts the confirm lists the typed change. A changed bar reads as its section/bar location (`render-change.js:36`); assert on that row's text. *Pins workflow 4 §Discarding after a flush by unmount.*

All through the real UI; no `#dev/*` mount, no injected state.

## Decisions

1. **Flush in the editor, called by the host — not a WRITE sent by the host.** The hosts already hold the CodeMirror view through `editorRef` (`AppShell.jsx:570` reads the buffer that way), so a host could send `WRITE` with `editorRef.current.state.doc` itself. Rejected: the editor's debounce timer would still be armed and would fire after the `DISCARD`, or the unmount flush would, and write the discarded text back. Only the editor can clear its own timer. *Chosen:* a `flushRef` prop on `SongEditor` (a host-owned ref the editor sets to its flush function in its mount effect and clears on unmount), which mirrors the `editorRef` seam already threaded through every host.
2. **A ref prop, not `useImperativeHandle` on `editorRef`.** `editorRef` is the raw `EditorView`, and `AppShell` and the merge code depend on that shape. Making it an imperative handle would ripple through them. A second, single-purpose ref keeps the seam narrow.
3. **Not: move Discard into the editor's bar.** That would get the flush for free, as Save does, but it contradicts the boards, where Discard sits in the appbar (W04, `songs.editor_chrome`).
4. **Not: make the confirm wait for, or re-request, the preview after the next write.** The Worker handles commands in order, so `WRITE` then `PREVIEW_SAVE` is already correct. Save relies on the same guarantee. A retry or a "settled" handshake would add protocol for a race that ordering already removes.
5. **Not scoped: a stale `savePreview` from an earlier open showing for a moment before the fresh `SAVE_PREVIEW` lands.** The save sheet has the same property, the fresh preview replaces it within one round trip, and the audit finding is the empty list, not a flash. Changing the slice's lifecycle belongs to both dialogs together and is not needed to meet §Discarding.
6. **No design delta.** Workflow 4 §Discarding and the W04 board already say what the confirm shows. This task brings the app in line with them.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-16.

- `app/src/editor/SongEditor.jsx`: one flush (clear the debounce timer, send the pending `WRITE`) now serves Save, the unmount cleanup and a new `flushRef` prop; the merge rule (cancel, not flush) is unchanged.
- Hosts with a Discard or Delete outside the editor call the flush before the confirm opens: `app/src/songs/EditSongHost.jsx`, `app/src/songs/NewSongHost.jsx`, `app/src/files/RawEditorHost.jsx` + `app/src/files/FileView.jsx`, `app/src/editor/EditorDev.jsx`.
- The confirm, the Worker and the protocol are unchanged; `PREVIEW_SAVE` now sees the edit, and no pending `WRITE` can land after the `DISCARD`.
- Behavior tests: `app/src/editor/SongEditor.behavior.test.jsx` (host flush sends once, nothing after), `app/src/songs/EditSongHost.behavior.test.jsx` (new Discard describe, with axe), `app/src/files/FileView.behavior.test.jsx` (Delete on a never-saved file flushes first, with axe).
- e2e-web: `e2e/web/tests/save-sheet.spec.js` (ThrowawayCoda / section added row before W04#3 and axe; reopened editor lacks the section) and `e2e/web/tests/edit-and-save.spec.js` (Intro / Em added row), on phone, tablet and computer.
- WBS: `complete 100` on `songs.discard_summary` in `tasks/60-songs.tji`, note back-linked. No follow-ups, no milestone change (`m5` still has other open dependencies).

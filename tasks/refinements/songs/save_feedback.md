# songs.save_feedback — Saving says what it is doing and why it cannot

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji) — `task save_feedback "Saving says
what it is doing and why it cannot"` (line 169), under `songs`, in milestone
`m3_service` (`tasks/99-milestones.tji:32`).

## Effort estimate

1.5d.

## Repository

Both:

- `app/` — `app/src/songs/SaveSheet.jsx`, its locale strings
  (`app/src/i18n/locales/{en,pt-BR,es-419,it}.js`), the Worker's save path
  (`app/src/worker/working-copy.js`, `app/src/worker/logic.js`,
  `app/src/worker/reducer.js`, `app/src/worker/protocol.js`), and their tests;
  `e2e/web/tests/save-sheet.spec.js`.
- `cifra.md/js/` — `src/diff.js` and `test/diff.test.js` (the semantic diff is
  the JavaScript package's own app-facing layer; no spec chapter, corpus entry,
  Python reference or Go twin defines it — `diff.js:1-7`).
- Docs — the design delta in `docs/workflows/04-edit-and-save.md` (already
  written with this refinement, see Decisions 1, 4, 6), and the matching line
  in `docs/home-book-format.md` §4.1 (the implementer edits it, Constraint 9).

## Inherited dependencies

- `songs.save_sheet` — **settled** (complete). The sheet, `SAVE` /
  `NAME_AND_SAVE` / `SET_IDENTITY_NAME`, `SAVED` / `SAVE_REFUSED`, the
  `PREVIEW_SAVE` round trip.
- Also relied on, all complete: `songs.save_empty_message` (the `failed`
  refusal; Save stays enabled on a blank note), `songs.first_save_fields`
  (the shared `SaveForm`), `songs.editor_chrome` (three presentations, the
  `beforeSave` gate), `account.commit_author` (`resolveAuthor`; views send
  only a typed `name`), `sync.engine` / `sync.states` (the scheduler, the
  after-save trigger, `saves_waiting`), `books.online` (a hosted book for the
  e2e), `foundation.e2e_web`.
- `account.author_name` — **pending, not a dependency.** It adds the Account
  screen's *Your name* row; it shares `SET_IDENTITY_NAME` and the
  `preferences.authorName` register but nothing this task changes.

## What this task is

Three findings from the 2026-10-19 usability review, all about the moment of
saving:

- **H2 — a grey Save with no reason.** On a first save, a blank *Your name*
  (and, for a title-less new song, a blank *Name this song*) disables Save and
  nothing says why. Save stays pressable; pressing it with a field missing
  shows an inline error under that field and puts focus in it. And the
  account's name, promised by the field's help text, takes the field's place
  as soon as it is known — including while the sheet is open.
- **M3 — the save waits on the push.** `SAVED` is posted only after
  `git.push` settles, inside the book lock, so a save takes seconds on a slow
  or unreachable network and Save can be pressed twice. The save posts `SAVED`
  as soon as the local commit is durable, and the push happens in the
  background through the sync scheduler (at once with a network, at the next
  sync without). While the commit is being made, Save reads *Saving…* and
  cannot be pressed again.
- **M5 — `artist added: ;`.** `diffProperties` treats a key present with an
  empty value as present, so a blank `artist:` line in a new song's head
  writes `artist added: ` into the note (the commit message). An empty value
  is treated as absent.

## Why it needs to be done

DIRECTION §1 (L29-31): sync is never something the app waits for; a save that
blocks on `git.push` breaks offline-first exactly where the user is looking,
and the double press makes two commits of one intention. Workflow 4 §Saving
is the only explicit-save surface in the app — its note is the commit
message every member of a shared book reads in history (workflow 6), so a
malformed `artist added: ` line is shared, permanent noise. A disabled button
with no reason fails WCAG 2.1 SC 3.3.1/3.3.3 (error identification and
suggestion) in spirit and is the review's one High finding. All three sit on
the `m3_service` milestone path (Estante online).

## Inputs / context

Governing documents:

- `docs/DIRECTION.md` §1 L29-31 (offline first), §3 L111-113 (explicit save:
  commit, then push), §3.3 L170-179 (the author identity; *the service stores
  no name for an account* — the name is the home book's `authorName`),
  §3.7 L462-469 (the Worker owns git; the UI mirrors it through store
  messages).
- `docs/workflows/04-edit-and-save.md` §Saving (L33-67, now with the pending
  and missing-field paragraph), §Save pushes (L69-76, now saying the push happens
  after the sheet closes), §Who made the change (L108-116, now saying what
  "the account's name" is and when it takes the field's place).
- `docs/workflows/08-sync.md` L18 (sync runs after every save), L31 (*N saves
  waiting to go up*).
- `docs/home-book-format.md` §4.1 L213-217 (`authorName`).
- Board `docs/mockups/W04-edit-and-save.dc.html`: the phone sheet L75-95,
  the computer panel L189-204 with the name field L191-193 and the
  *Not saved* error L180. No pending state is drawn; the error-under-field
  pattern follows the panel's field styling (`.field`, `t-small`).

Code (line numbers as of `b8f2784`):

- `app/src/songs/SaveSheet.jsx` — `SaveForm` L56-260: slices L70-71;
  `SAVED` closes L91-93; `SAVE_REFUSED` L94-96; `storedName` / `needsName`
  L104-107; `nameMissing` / `songNameMissing` / `canConfirm` L124-127;
  `confirm()` L129-155; the name field L168-174 and song-name field L176-182
  (RAC `TextField isRequired`, no `isInvalid`, no error); the refusal notice
  L225-233; Save `isDisabled={!canConfirm}` L241 (panel) and L253
  (sheet/dialog). Hosts: `EditSongHost.jsx:140-153`, `FileView.jsx:453-463`
  (the only `isNew` host), `AppShell.jsx:1248-1256`.
- `app/src/i18n/locales/en.js` `saveSheet` L1074-1106 (`nameLabel` L1096,
  `nameHelp` L1097, `failed` L1106); the same block in `pt-BR.js` (~L989-1007),
  `es-419.js`, `it.js`.
- Existing error-under-field pattern (no RAC `FieldError` is used in the app
  yet): `app/src/songs/SongArrange.jsx:649-656`,
  `app/src/songs/SongWizard.jsx:440-447` (`isInvalid` + a `role="alert"`
  span).
- `app/src/worker/working-copy.js` `save()` ~L137-202 — commit L180,
  `fs.flush()` L186, then the inline `git.push` L193-199 under the book lock;
  `nameAndSave()` L214 onward, same path.
- `app/src/worker/logic.js` — `SAVE` L1703-1790 (`SAVED` posted L1759-1768
  after the push; the after-save `ensureSyncScheduler().trigger()` L1787-1789);
  `NAME_AND_SAVE` L3221-~3305 (`SAVED` L3286-3293; **no** after-save trigger);
  `ensureSyncScheduler()` L841-859; the "post `saves_waiting` then trigger"
  precedent at L2390-2396 (bring-in).
- `app/src/worker/sync-scheduler.js` (coalesced `trigger()`, the
  `saves_waiting` backoff retry L27-33); `app/src/worker/sync-engine.js`
  (`pushWithRetry` L585, the phase facts L570-618).
- `app/src/worker/reducer.js` `SAVED` L220-236 (`save[bookId].pushed`); no
  view reads `pushed`.
- `cifra.md/js/src/diff.js` `diffProperties` L112-141 (added L136-137,
  changed L138-139); `cifra.md/js/test/diff.test.js` `describe("properties")`
  L188. `cifra.md/spec/1-document.md` §1.4.2 L109-111: a property's value may
  be empty.
- e2e helpers: `e2e/web/lib/journeys.js` `putBookOnline` L201, `hostedBook`
  L219, `bookGitUrl` L208, `syncNow` L258, `saveSurface` L340,
  `saveThroughSheet` L349; `e2e/web/lib/git-device.js` (`GitDevice`); the
  offline-saves precedent `e2e/web/tests/sync-states.spec.js`
  `offlineSavesJourney` L80-135; `e2e/web/tests/save-sheet.spec.js` L122 (first
  save asks for a name).

Predecessor decisions carried: `save_sheet` Decision 3 (the note is the diff's
neutral English summary — so M5 is fixed in the diff, not in the view),
Decision 4 (the name lives in the home book's preferences); `save_empty_message`
D1 (Save not disabled on a blank note — the same principle extended here) and
D3 (no new failure event); `commit_author` Constraint 2 (one resolver; the
sheet sends only the typed `name`).

## Constraints / requirements

1. **The save never waits on the network.** `working-copy.save()` and
   `nameAndSave()` no longer push. They return once the commit is made and
   `fs.flush()` has run, still under the one book lock. `SAVE` and
   `NAME_AND_SAVE` post `SAVED` then, re-index as today, and call
   `ensureSyncScheduler().trigger()` — `NAME_AND_SAVE` gains the trigger it
   lacks. The push is the sync engine's (fetch, merge, push, retried —
   DIRECTION §3.1); with no network the pass ends `saves_waiting` and the
   scheduler's backoff retries, so *at the next sync* holds unchanged.
2. **`SAVED` stops claiming a push outcome.** `pushed` is dropped from the
   `SAVED` payload (both handlers), from `reducer.js`'s `save[bookId]` and from
   the `protocol.js` doc of `SAVED`; whether it went up is what the
   `SYNC` facts already say (`in_step` / `saves_waiting` / `offline` /
   `cannot_save`). Existing tests that read `outcome.pushed` or read the remote
   right after `SAVED` (`working-copy.behavior.test.js` ~L240 and any other
   `*.behavior.test.js` that relies on the inline push) wait for the
   after-save pass to move the remote instead.
3. **One tap, one version.** `confirm()` sets a `saving` state synchronously
   before sending; while it is set, Save is a RAC `Button` with `isPending`
   (react-aria-components ^1.21.1) labelled `saveSheet.saving` (*Saving…*),
   and a second press sends nothing. `saving` clears on `SAVE_REFUSED` for
   this book (the sheet stays open, Save pressable again, as
   `save_empty_message` requires) and the sheet closes on `SAVED` as today.
   Cancel stays available while saving; it closes the sheet, the save still
   lands.
4. **Save is never disabled for a missing field.** `isDisabled={!canConfirm}`
   goes from both Save buttons. Pressing Save with the name field (or the
   song-name field) blank or whitespace-only sends nothing, marks that
   field `isInvalid`, shows the error under it inside the `TextField` (RAC
   `FieldError`, or the app's `role="alert"` span pattern — one of the two,
   consistently for both fields), and moves focus into the first missing
   field (name before song name, the visual order). The error clears as soon
   as the field holds non-blank text. The `beforeSave` gate (the editor's) still
   runs after the field check.
5. **The account's name takes the field's place.** `needsName` stays
   `!preferences.authorName.value` — DIRECTION §3.3: the account's name *is*
   the account home book's `authorName`, and the attach that follows sign-in
   surfaces it through `PREFERENCES`. The sheet reads it live: when the
   register arrives while the sheet is open, the name field and its error go,
   and the save carries the stored name (`SET_IDENTITY_NAME` is not sent).
   The help copy `saveSheet.nameHelp` is kept — it is now true as written.
6. **Copy.** New keys in all four locales: `saveSheet.saving` (*Saving…*),
   `saveSheet.nameMissing` (*Enter your name to save.*),
   `saveSheet.songNameMissing` (*Name the song to save.*). English proposed
   here; pt-BR, es-419 and it translated by the implementer and flagged for
   the human in the Status block, as `account.author_name` does. Status in a
   word, never colour alone.
7. **An empty property value is absent to the diff.** In `diffProperties`,
   a property whose value is empty or whitespace-only is not entered in its
   side's map (a duplicate key's last non-empty value still wins — if the
   last value of a key is empty the key is absent). So: absent → empty is no
   change; empty → `X` is `added`; `X` → empty is `removed`; never
   `key added: ` or `key: X → `. Nothing else in `diff.js` changes; the
   canonical writer is untouched (the model still holds the empty property;
   what is written back is the canonical form's business, not the diff's).
8. **Accessibility.** RAC for every interactive part; the error is
   associated with its input (`aria-describedby` via the `TextField`) and
   announced; the pending Save keeps focus (RAC `isPending` does); axe clean
   at WCAG 2.1 AA in every state named below.
9. **Docs agree.** `docs/home-book-format.md` §4.1's last sentence ("after
   sign-in the account's name is offered in its place") is reworded to match
   workflow 4 §Who made the change: the account's home book brings its
   `authorName` to every device signed in to it.
10. Standing rules: no song text or names in logs (none are added); test songs
    written for the purpose; the main thread never touches IndexedDB.

## Acceptance criteria

Behavior delivered:

1. A first save with a blank *Your name*: Save is pressable; pressing it shows
   *Enter your name to save.* under the field, focus lands in the field,
   nothing is sent to the Worker; typing a name clears the error and Save
   works. Same for a title-less new song's *Name this song*.
2. A save on a slow or unreachable network closes the sheet as soon as the
   commit is kept on this device; the book shows *1 save waiting to go up*
   until a sync pass pushes it.
3. Between pressing Save and the sheet closing, Save reads *Saving…* and a
   second press makes no second commit.
4. A sheet open when the account's name arrives stops asking for one and
   saves under it.
5. A new song whose head has a blank `artist:` line saves with a note that
   has no `artist added:` entry.

Tests, by level:

- **unit** — `cifra.md/js/test/diff.test.js`, in `describe("properties")`:
  "an empty value is absent" — absent → `artist:` empty gives no change; empty
  → `Ana` gives one `added` (`artist added: Ana`); `Ana` → empty gives one
  `removed`; empty → empty gives none; the summary never contains
  `added: ` followed by nothing (Constraint 7; spec §1.4.2 L109-111 allows the
  empty value). Run by the cifra.md JS gate.
- **behavior** — `app/src/songs/SaveSheet.behavior.test.jsx`:
  - "a blank name keeps Save pressable and says why" — press Save with no
    name: no command sent, the error text shown and described-by the input,
    focus in the name input; type a name: the error goes, Save sends
    `SET_IDENTITY_NAME` then `SAVE` (workflow 4 §Saving, the missing-field
    paragraph; Constraint 4); axe clean in the error state.
  - "a blank song name says why" — the same for a title-less `isNew` sheet,
    `NAME_AND_SAVE` not sent until named; with both blank, focus goes to the
    name field first.
  - "saving shows Saving… and a second press sends nothing" — press Save twice
    before any `SAVED`: exactly one `SAVE` command; the button's accessible
    name is *Saving…* and it is pending; a `SAVE_REFUSED` for the book makes it
    *Save* and pressable again (Constraint 3); axe clean while pending.
  - "the account's name arriving takes the field's place" — open with no
    `authorName`, dispatch `PREFERENCES` carrying one: the name field is gone,
    Save sends `SAVE` with that name and no `SET_IDENTITY_NAME` (workflow 4
    §Who made the change; Constraint 5).
  - the existing cases that assumed a disabled Save are updated to the new
    behaviour, and run across the three presentations' describe
    (`sheet`/`dialog`/`panel`) for the error case.
- **behavior** — `app/src/worker/working-copy.behavior.test.js`:
  - "SAVED comes before the push" — the remote's receive-pack request is held
    open (the test's `fetch` given to `createGitHttpClient` gates
    `git-receive-pack`): `SAVED` arrives with the commit while the push is
    still pending, the remote's `main` is still the seed; releasing the gate,
    the after-save sync pass moves the remote's `main` to the saved commit
    (Constraint 1; workflow 4 §Save pushes; DIRECTION §1).
  - the existing "save commits canonical text and pushes" case waits for the
    remote head instead of reading `outcome.pushed` (Constraint 2).
- **behavior** — `app/src/worker/new-song.behavior.test.js`: "a first save
  goes up at the after-save sync" — `NAME_AND_SAVE` on a book with a local
  remote posts `SAVED` and the remote then reaches the commit without any
  other trigger (the missing trigger, Constraint 1).
- **e2e-web** — `e2e/web/tests/save-sheet.spec.js` (runs on the phone, tablet
  and computer projects):
  - "a blank name says why and puts the cursor there" — a fresh device edits a
    song, opens the save sheet, presses Save with *Your name* empty: the
    error text is visible, the name input is focused, the sheet is still
    open; types a name and saves; axe at WCAG 2.1 AA on the sheet in the error
    state (workflow 4 §Saving).
  - "a save with the network gone closes at once and goes up at the next
    sync" — `putBookOnline` a book, `context.setOffline(true)`, edit and
    `saveThroughSheet`: the sheet closes and the book shows *1 save waiting to
    go up*; `setOffline(false)` and `syncNow`: the waiting count goes, and a
    `GitDevice` clone of `bookGitUrl` reads the saved line (workflow 4 §Save
    pushes, workflow 8 L18/L31); axe on the Books screen with the waiting
    state. (Through the real UI only; the network is cut with
    `setOffline`, which the e2e lint allows and `sync-states.spec.js` already
    uses — no route mocking.)

Every prerequisite is complete: a hosted book (`books.online`,
`putBookOnline`), a signed-in device (`account.sign_in`, via the journey),
a second reader of the remote (`GitDevice`, the harness), the save sheet
(`songs.save_sheet`).

No tech debt deferred.

## Decisions

1. **The push leaves the save; the sync scheduler owns it.** `save()` /
   `nameAndSave()` commit and return; `SAVED` is posted at once; the existing
   after-save `trigger()` (added to `NAME_AND_SAVE`) does the push.
   *Why:* the scheduler already coalesces passes, retries `saves_waiting` with
   backoff, merges a racing remote and emits the shelf's facts — the inline
   push duplicated a weaker version of it (a non-fast-forward just failed and
   waited for the pass anyway). *Rejected:* posting `SAVED` first and then
   pushing inline in the handler (fire-and-forget) — it still holds the book
   lock across the network unless restructured, and gives two push paths with
   different retry and conflict behaviour; a `pushing` phase on the sheet —
   workflow 4 has the user think about two states, unsaved and saved, and the
   book row is where *waiting to go up* is shown (workflow 8 L31).
2. **`SAVED` drops `pushed`** rather than always carrying `false`. A field
   that is always `false` misleads the next reader; no view reads it, and the
   `SYNC` facts are the one source for push state. *Rejected:* keeping it
   for compatibility — there is no consumer to stay compatible with.
3. **Pending is RAC `isPending` on the same Save button, labelled
   *Saving…*.** It keeps focus on the button, blocks presses and is announced,
   with no new component. *Rejected:* `isDisabled` while saving — a disabled
   button drops focus to the body on some browsers, and loses the
   announcement; a spinner without the word — status in a word, never an icon
   or colour alone.
4. **Missing fields: pressable Save, inline error, focus.** As the task note
   says, and as `save_empty_message` D1 already did for a blank note: the
   button is the place the user asks, so it answers. Applied to the song-name
   field too, since it disabled Save the same way (the same H2 defect, one
   line apart). Recorded in workflow 4 §Saving (design delta, written).
5. **"Offer the account name" is the account home book's `authorName`,
   taking the field's place — not a new name source.** DIRECTION §3.3
   L176-179 is explicit: the service stores no name; a person's name is the
   `authorName` in their home book. After sign-in, the attach brings that
   home book down and `PREFERENCES` carries the name, so `needsName` is
   already right whenever the register is there; the gap the review saw is a
   sheet that does not react when it arrives, and docs that promised an
   "offer" from somewhere else. The behavior test pins the live take-over;
   workflow 4 §Who made the change (written) and home-book-format §4.1
   (Constraint 9) now say what the account's name is. *Rejected:* a name
   field on the account or an API to read one — a design change against
   DIRECTION §3.3 for no user-visible gain; prefilling the field with the
   account's name — when the name is known the sheet does not ask at all
   ("asked once"), so there is nothing to prefill. The help copy stays as it
   is (no retranslation).
6. **M5 is fixed in the diff, not in the note builder.** The note is the
   diff's summary verbatim (`save_sheet` Decision 3) and the same records
   drive the localized rows and history (workflow 6); treating an empty value
   as absent at the source fixes all three. It lands under `cifra.md/js/`
   with its own unit test; there is no spec, corpus or Python/Go twin to move,
   because the diff is the JS package's app-facing layer (`diff.js:1-7`), so
   no spec change is needed. *Rejected:* dropping empty properties from the
   model or the writer — the reader keeps them (§1.4.2) and canonical form is
   the writer's concern, out of this task.
7. **e2e cuts the network with `setOffline`, and the "at once" property is
   pinned at behavior level.** A slow-but-reachable remote cannot be staged
   through the real UI without route mocking, which the e2e lint forbids; the
   behavior test holds the receive-pack request open to prove `SAVED` does
   not wait on it, and the e2e proves the user promise (the sheet closes, the
   save goes up at the next sync).

## Open questions

(none — all decided)

The pt-BR, es-419 and it strings for the three new keys are the implementer's
translations, for the human to confirm (as with `account.author_name`).

## Status

**Done** — 2026-10-20.

- Saving no longer waits on the network: `app/src/worker/working-copy.js` `save()` / `nameAndSave()` commit, flush and return; `app/src/worker/logic.js` posts `SAVED` then and triggers the sync scheduler for both `SAVE` and `NAME_AND_SAVE` (which lacked the trigger). `pushed` is gone from `SAVED` (`logic.js`, `reducer.js`, `protocol.js`).
- `app/src/songs/SaveSheet.jsx`, `app/src/songs/save-sheet.css`: Save is never disabled; a blank name or song name shows an inline error under the field and focuses it; Save shows a pending *Saving…* and ignores a second press; the account's name takes the name field's place when it arrives while the sheet is open. The fixer added an empty live-region announcement at open and a clear on unmount, so React Aria's pending announcement leaves no unnamed `role="img"` behind for axe (it uses the private `react-aria/private/live-announcer/LiveAnnouncer` path, which a library upgrade could move).
- New strings `saveSheet.saving`, `nameMissing`, `songNameMissing` in `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`. The pt-BR, es-419 and it translations are the implementer's and need a human to confirm them.
- `cifra.md/js/src/diff.js`: an empty property value counts as absent, so the note has no `artist added: ` line; `docs/home-book-format.md` §4.1 reworded; the design delta in `docs/workflows/04-edit-and-save.md`.
- Tests — unit: `cifra.md/js/test/diff.test.js` "an empty value is absent". Behavior: `app/src/songs/SaveSheet.behavior.test.jsx`, `app/src/worker/working-copy.behavior.test.js` ("SAVED comes before the push"), `app/src/worker/new-song.behavior.test.js` ("a first save goes up at the after-save sync"); existing worker and view tests changed to drop `pushed` and wait for the after-save push. e2e-web: `e2e/web/tests/save-sheet.spec.js` (blank name; save offline then sync).
- Tech debt: none.

# account.author_name — Changing the name one saves as

## TaskJuggler entry

[`tasks/70-account.tji`](../../70-account.tji), `task account.author_name`
("Changing the name one saves as"). `depends !account_screen`. Milestone
`milestones.m3_service` (`tasks/99-milestones.tji:32`).

Note (verbatim): *"Decided 2026-10-19, no separate design pass: a Your name row
in the Account screen Preferences, signed in or not, whose Change opens a dialog
prefilled with the current name and writes it with SET_IDENTITY_NAME
(logic.js:1810-1830); a blank name is refused in words; the save sheet stops
asking once a name is set, and the next save carries the new one. English copy
proposed 2026-10-19, pending the human (translate into pt-BR, es-419 and it):
the row Your name, its line Shown on the changes you save from now on. Changes
already saved keep the name they were made with., the action Change, and a
blank name refused with Your name can’t be empty. Changing it writes the
register like any preference: saves from then on carry it, past saves keep
theirs (history is not rewritten), and members see the new name once the
service next reads the home book (ownerName,
service/internal/server/books.go:59-63). The row sits in Preferences beside
theme and language, styled as they are; record it in workflow 4 (Who made the
change) and workflow 13 (The account screen) and add the row to the
Theme-picker board. Source: launch smoke test 2026-10-19 (the name could not be
reset). Tests: behavior (the row with and without a name, Change prefilled,
blank refused, focus returned; axe); e2e-web (a name changed on the Account
screen, then a song saved and its history shows the new name while an earlier
save keeps the old, on the three viewports; axe, mockup Theme-picker)."*

(The note's `logic.js:1810-1830` has drifted: the handler is now
`app/src/worker/logic.js:1873-1898`.)

## Effort estimate

0.5d (`allocate team`). The Worker command, the register, the save sheet's
"stop asking" and the commit author's name already exist; the work is one row,
one small dialog, eight copy keys in four locales, a one-line Worker guard, the
board row, and the tests.

## Repository

**estante-de-cifras**, app work only. The note does not start with `cifra.md:`;
nothing changes in `service/`, `api/` or `cifra.md/`. Directories touched:

- `app/src/account/`:
  - `AccountScreen.jsx` — the *Your name* region, last in Preferences;
  - `AuthorNameDialog.jsx` — new, the change dialog;
  - `AccountScreen.behavior.test.jsx` — the row and dialog cases.
- `app/src/worker/logic.js` — `SET_IDENTITY_NAME` trims and refuses a blank
  name (no write); `protocol.js`'s comment says so.
- `app/src/worker/preferences-theme-language.behavior.test.js`,
  `app/src/worker/commit-author.behavior.test.js` — the Worker cases.
- `app/src/songs/SaveSheet.behavior.test.jsx` — one case.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — the `account.*` keys.
- `docs/mockups/Theme-picker.dc.html` — the row on the phone, tablet and
  computer frames, and the board's description sentence.
- `e2e/web/tests/author-name.spec.js` — new; one helper,
  `changeAuthorName`, in `e2e/web/lib/journeys-account.js`.
- Design delta (written with this refinement): `docs/workflows/04-edit-and-save.md:131-137`
  and `docs/workflows/13-new-device.md:246-251, 274`.

## Inherited dependencies

All settled (`complete 100`):

- `account.account_screen` — the Account screen, its Preferences section and
  `PickerRow` / `account-pref` styling (`AccountScreen.jsx:269-285, 550-664`),
  shown in every auth state (wide `:906-916`, narrow `:934-937`).
- Transitively complete and used by the tests: `songs.save_sheet` (the name
  asked at the first save, `SET_IDENTITY_NAME`), `songs.history`,
  `account.commit_author` (`resolveAuthor`, `author.self`), `books.online`,
  `books.share` / `books.add_by_link` (a second person joining by invitation —
  `joinByInvite`, `inviteLink` in `e2e/web/lib/journeys-account.js:173-195`),
  `account.preferences_layout` (the computer's two-column Preferences).

## What this task is

A **Your name** row at the end of the Account screen's Preferences, present
signed in or not, showing the name one's saves carry (or *Not set yet* before
the first save has asked), with the line *Shown on the changes you save from
now on. Changes already saved keep the name they were made with.* and a
**Change** button. Change opens a small modal dialog with one text field
prefilled with the current name; *Save* writes it with the existing
`SET_IDENTITY_NAME` command, *Cancel* (or Escape) closes with no write, and a
blank or whitespace-only name is refused under the field with *Your name can’t
be empty.* Focus returns to Change when the dialog closes. Nothing else about
saving changes: the save sheet already stops asking once the `authorName`
register is set, and the Worker already authors each save with the register's
current value.

## Why it needs to be done

The launch smoke test (2026-10-19) found that the name given at the first save
could not be changed anywhere: a typo, or a name given before sign-in, was
permanent. Workflow 4 §Who made the change asked for the name once and said
nothing about changing it. This closes that gap for M3. Downstream:
`books.owner_name` and the sharing screens show the name the service reads from
the home book (`service/internal/server/books.go:58-92`, `ReadAuthorName`), so a
change made here is what they will show once the home book reaches the
service.

## Inputs / context

- **Workflow 4 §Who made the change** — `docs/workflows/04-edit-and-save.md:121-137`
  (the name asked once, kept in the home book; lines 131-137 are this task's
  delta: changeable on the account screen, saves from then on carry it, history
  not rewritten).
- **Workflow 13 §The account screen** — `docs/workflows/13-new-device.md:234-276`
  (Preferences present and writable signed in or not, order theme, density,
  chord diagrams, language, now *your name* last, lines 246-251; the computer
  layout, line 274, puts it below the two columns across both).
- **DIRECTION §3.3** — `docs/DIRECTION.md:170-183`: the service stores no name;
  `authorName` in the home book (`docs/home-book-format.md` §4.1) is the name.
- **Board** — `docs/mockups/Theme-picker.dc.html`: Preferences blocks at
  `:38-112` (phone), `:205-280` (tablet), `:321-424` (computer); sub-heading
  `t-h3` with the inline override (`:102`), `t-small` note (`:112`); registered
  in `docs/mockups/canvas.json:139-145`; frames in
  `e2e/web/lib/mockup-frames.json:27-50`.
- **Worker** — `app/src/worker/protocol.js:252-257` (`SET_IDENTITY_NAME { name }`);
  `app/src/worker/logic.js:1873-1898` (writes the register through `home.set`,
  re-surfaces `PREFERENCES`, flushes; no validation today); `resolveAuthor`
  `logic.js:843-866` (the commit's name is the payload override, else the
  register). SAVE and NAME_AND_SAVE author through it (`logic.js:1756, 1783,
  3299, 3337`). `reauthor.js:89` rewrites only the email, so a sign-in never
  rewrites a past save's name.
- **View** — the name is read as `useSlice(store,'preferences')?.authorName?.value`
  (`AccountScreen.jsx:385,402`; `SaveSheet.jsx:135-136`; `SongHistory.jsx:250-251`).
  The identity block shows it when signed in (`AccountScreen.jsx:681-701`).
  Dialog pattern: `ConfirmDialog` `AccountScreen.jsx:290-323` (DialogTrigger >
  ModalOverlay.scrim.center > Modal.dialog > Dialog, `Heading slot="title"
  className="t-h2"`, `.actions`); portals land inside `.est` through ThemeRoot's
  `UNSAFE_PortalProvider` (`app/src/theme/ThemeRoot.jsx:14,59`).
- **Save sheet** — `SaveSheet.jsx:135-136` (`needsName = !storedName`, read live),
  `:179-182` (only a missing name is sent with `SET_IDENTITY_NAME`), name field
  `:227-243`.
- **History** — `app/src/songs/history-view.js:43-47, 133`: one's own saves read
  *You* (`author.self`, `app/src/worker/history.js:234-242`); others' saves read
  the commit's author name.
- **i18n** — `app/src/i18n/locales/en.js` (`account` from `:842`), and pt-BR,
  es-419, it (`account` at `:773`). Convention for proposed copy:
  `tasks/refinements/songs/save_feedback.md:191-196`.
- **e2e helpers** — `hostedBookWithSong` (`e2e/web/lib/journeys-share.js:50-57`,
  saves as *Marina Souza*), `openAccount`/`closeAccount`
  (`journeys-account.js:35, 229`), `inviteLink`/`joinByInvite` (`:173-195`),
  `openSaveSheet`/`confirmSheet`/`openSongHistory` (`journeys-edit.js:29, 38, 67`),
  `mockup` (`e2e/web/lib/mockup.js:45`); the pattern of a second person
  reading a book: `e2e/web/tests/conflicts.spec.js:60-90`.
- **Predecessors** — `account_screen.md` Decision 5 (the identity shows
  `authorName` or a neutral *signed in*, no name the contract does not give);
  `commit_author.md` Constraint 2 (one resolver; the sheet's typed name reaches
  the Worker as `name`); `preferences_layout.md` Decision 6 (layout chosen in
  JSX, DOM order kept as workflow 13's).

## Constraints / requirements

1. **One write path.** The dialog sends `SET_IDENTITY_NAME { name }` — no new
   command, no new register. The Worker owns the write; the view never touches
   the home book.
2. **The Worker refuses a blank name.** `SET_IDENTITY_NAME` trims the payload
   and, if nothing is left, writes nothing (as `SET_THEME` refuses an invalid
   value, `preferences-theme-language.behavior.test.js:157`). The dialog refuses
   first, in words; the Worker guard is the boundary.
3. **History is not rewritten.** A change affects only saves made after it.
   Past commits keep their author name; nothing re-authors, amends or rebases.
4. **The save sheet keeps reading live.** No change to `SaveSheet.jsx` is
   needed or wanted: once the register holds a name the field is gone, and the
   next save's commit carries the register's current value.
5. **Offline first.** The write is local (a home-book preference, auto-committed,
   pushed with the home book when there is one); the dialog closes on send, and
   the row updates when `PREFERENCES` re-surfaces.
6. **Accessibility.** React Aria Components throughout: a `Button` for Change,
   `DialogTrigger`/`Modal`/`Dialog` with a `Heading slot="title"`, a
   `TextField` (`autoFocus` on the TextField, not the Input — memory *RAC
   autoFocus goes on TextField*) with its `Label`, `FieldError` for the refusal
   (announced, `validationBehavior="aria"` as the save sheet's name field),
   *Save* and *Cancel* buttons; Enter submits, Escape cancels; focus returns to
   Change. The region is labelled by its *Your name* sub-heading. axe clean at
   WCAG 2.1 AA, the row and the open dialog.
7. **Styled as its neighbours.** `div.account-pref` with a `t-h3 account-subhead`
   heading and a `p.t-small.account-note`, the value in a `row account-row`
   (`grow` > `name`), Change as a `btn` at the row's end. Last in Preferences on
   phone and tablet; on the computer, below the two columns spanning both
   (workflow 13 line 274), DOM order unchanged.
8. **No song text, no name in logs.** The name is the user's words; nothing logs
   it (the existing handler comment, `logic.js:1880`).
9. **Copy** (English proposed 2026-10-19 in the note, plus three strings this
   refinement proposes; all pending the human; the implementer translates into
   pt-BR, es-419 and it and flags them in the Status block):
   - `account.yourName` — *Your name* (sub-heading, dialog title, field label);
   - `account.yourNameNote` — *Shown on the changes you save from now on.
     Changes already saved keep the name they were made with.*;
   - `account.yourNameNotSet` — *Not set yet* (proposed here);
   - `account.yourNameChange` — *Change* (the button's accessible name is
     *Change your name*, proposed here, so it is not one of several bare
     *Change* buttons on a signed-in screen with a confirmed recovery email);
   - `account.yourNameEmpty` — *Your name can’t be empty.*;
   - *Save* / *Cancel*: the existing `account.save` / `account.cancel`
     (or the screen's existing equivalents).

## Acceptance criteria

### Behavior delivered

1. **The row, signed in or not.** Preferences ends with *Your name*: the stored
   name, or *Not set yet*; the note line; *Change*. It updates when a
   `PREFERENCES` event carries a new `authorName`, and the signed-in identity
   block shows the same name.
2. **The dialog.** *Change* opens a modal titled *Your name* with the field
   prefilled with the stored name (empty when none) and focused. *Save* with a
   non-blank name sends `SET_IDENTITY_NAME { name: trimmed }` once and closes; a
   name unchanged after trimming closes with no command. *Save* with a blank or
   whitespace-only field shows *Your name can’t be empty.*, sends nothing, and
   keeps the dialog open. *Cancel* / Escape sends nothing. Focus returns to
   *Change* on every close.
3. **The Worker.** `SET_IDENTITY_NAME` with an existing name replaces the
   register and re-surfaces `PREFERENCES`; a blank or whitespace payload writes
   nothing; the next save's commit carries the new name and an earlier commit
   keeps the old.
4. **The save sheet** does not ask for a name once one is set from the Account
   screen, and its save carries that name.
5. **Docs.** Workflow 4 lines 131-137 and workflow 13 lines 246-251 and 274
   (written with this refinement); the Theme-picker board draws the row on the
   phone, tablet and computer frames (computer: below the two columns, across
   both) and its description sentence mentions it.

### Tests, by level

**behavior**

- `app/src/account/AccountScreen.behavior.test.jsx`, a new `describe('your name
  (account.author_name)')`, pinning workflow 13 §The account screen lines
  246-251:
  - not signed in, no register: the row reads *Not set yet*, the note and
    *Change your name*; axe clean;
  - with a name, signed out and signed in: the row shows it; the signed-in
    identity block shows it too;
  - *Change* opens the dialog with the field prefilled and focused; axe clean
    on the open dialog;
  - a blank and a whitespace-only *Save*: *Your name can’t be empty.* shown
    (as the field's error), no command sent, dialog still open;
  - a new name (with surrounding spaces): `SET_IDENTITY_NAME { name }` sent
    trimmed, once; the dialog closes and focus is on *Change*;
  - an unchanged name: closes, no command;
  - *Cancel* and Escape: no command, focus on *Change*;
  - a `PREFERENCES` event with a new `authorName`: the row shows it.
- `app/src/songs/SaveSheet.behavior.test.jsx`, one case (workflow 4 §Who made
  the change): with the register replaced by a new name (as the Account screen
  leaves it), the sheet shows no name field, sends no `SET_IDENTITY_NAME`, and
  its `SAVE` carries the new name.
- `app/src/worker/preferences-theme-language.behavior.test.js`, two cases
  (Constraint 2): `SET_IDENTITY_NAME` over an existing name replaces the
  register and re-surfaces it, surviving a reload; a blank / whitespace name
  writes nothing (no commit on the home book).
- `app/src/worker/commit-author.behavior.test.js`, one case (Constraint 3;
  workflow 4 lines 131-137): save, change the name, save again — the newer
  commit's author name is the new one and the earlier commit's is unchanged
  (same oid, same name).

**e2e-web** — `e2e/web/tests/author-name.spec.js`, on the phone, tablet and
computer projects (workflow 4 §Who made the change, workflow 13 §The account
screen):

- `hostedBookWithSong` (signed in, a book online with a song saved as *Marina
  Souza*). Open the Account screen: *Your name* reads *Marina Souza*; axe;
  `mockup(page, 'Theme-picker', n)` on the frame of each viewport.
- *Change your name*: the field holds *Marina Souza*; clear it and *Save* —
  *Your name can’t be empty.*; axe on the dialog. Type *Marina Lima*, *Save*:
  the row reads *Marina Lima*. (Helper `changeAuthorName(page, name)` in
  `e2e/web/lib/journeys-account.js`.)
- Edit the song, open the save sheet: no name field; save; wait for the book to
  read up to date. The song's history on this device reads *You* on both saves
  (one's own saves stay *you*, `history-view.js:43-47`).
- A second person joins by invitation (`inviteLink` + `joinByInvite`, as
  `conflicts.spec.js` does) and opens the song's history: the newer save reads
  *Marina Lima*, the earlier *Marina Souza*; axe on that history.

No e2e-api: no endpoint changes. No unit level: no new pure module (the trim
and blank check are two lines inside the dialog and the handler, pinned by the
behavior cases above).

## Decisions

1. **The e2e reads the new and old names through a second person's history.**
   The note asks that "its history shows the new name while an earlier save
   keeps the old". On the author's own device history reads *You* for both saves
   (`author.self`, account.commit_author Decision 7), so the names are only
   visible to someone else. A second person joined through the real Share flow
   sees them in the real UI.
   - *Rejected:* reading `git log --format=%an` through a `GitDevice` clone
     (as `pushedAuthorEmails` does): it pins the bytes but not what a member
     sees. *Rejected:* making one's own history show the name instead of
     *You*: a change to workflow 6 that this task does not need.
2. **A dialog, not an inline field.** The note decides it. It keeps
   Preferences as rows, and gives the refusal and the focus return one clear
   place. *Rejected:* the recovery email's inline `TextField`
   (`RecoveryEmailRegion.jsx:143-157`): that is a three-state flow; this is one
   value.
3. **The Worker also refuses a blank name.** The view refuses first, in words.
   The Worker guard keeps a blank register out from any other caller, at the
   same boundary where `SET_THEME` validates. It writes nothing and sends no
   event: there is no caller to tell, since the view never sends a blank.
   *Rejected:* trusting the view alone. The save sheet's path also relies on a
   view-side check, and a blank register would make the sheet ask again on
   every device.
4. **An unchanged name closes without a write.** This avoids an empty-meaning
   commit on the home book. *Rejected:* always writing, which adds a register
   timestamp change with no effect.
5. **The row sits last in Preferences.** Workflow 13's order (theme, density,
   chord diagrams, language) stays as it is, and the name follows it. On the
   computer it sits below the two columns, spanning both, keeping DOM order.
   *Rejected:* in the signed-in identity block. The row must exist when signed
   out, and the identity block is not shown then.
6. **No name in `ownerName` tests.** The note says members see the new name in
   the service's `ownerName` "once the service next reads the home book". The
   web app does not yet bring its home book online on its own
   (`journeys-share.js:84-87`), so that path is the service's existing
   `ReadAuthorName` behaviour (`books.owner_name`) and is untouched here. The
   commit-author name, which members do see at once, is what this task pins.
7. **Copy beyond the note is proposed here** (*Not set yet*, *Change your name*
   as the accessible name) and flagged with the rest for the human, following
   `save_feedback.md`'s convention.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- The Account screen's Preferences ends with a *Your name* row, signed in or not: the name or *Not set yet*, the note line and *Change your name*; new `app/src/account/AuthorNameDialog.jsx` (prefilled, blank refused in words, trimmed `SET_IDENTITY_NAME`, no command when unchanged, focus back to Change), wired in `app/src/account/AccountScreen.jsx`, styled in `app/src/account/account.css`.
- `app/src/worker/logic.js` trims the name in `SET_IDENTITY_NAME` and writes nothing for a blank one; `app/src/worker/protocol.js` comment says so.
- Eight new copy strings in `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`; English proposed, the three translations are the implementer's — all pending the human's review.
- Behavior tests: `app/src/account/AccountScreen.behavior.test.jsx` (11 cases, axe on the row and the open dialog), `app/src/songs/SaveSheet.behavior.test.jsx` (1), `app/src/worker/preferences-theme-language.behavior.test.js` (2), `app/src/worker/commit-author.behavior.test.js` (1).
- e2e-web: `e2e/web/tests/author-name.spec.js` on phone, tablet and computer (axe, mockup Theme-picker), helper `changeAuthorName` in `e2e/web/lib/journeys-account.js`.
- Docs: `docs/workflows/04-edit-and-save.md`, `docs/workflows/13-new-device.md`, and the row drawn on `docs/mockups/Theme-picker.dc.html` (not rendered; the canvas needs republishing — parking lot).
- Tech-debt follow-up: none.

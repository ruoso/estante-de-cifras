# shell.plain_language — Plain words where git terms leak into everyday screens

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji) lines 140–145, task
`shell.plain_language` ("Plain words where git terms leak into everyday
screens"), under `task shell`. It `depends design.review_polish` and sits in
the polish milestone (`tasks/99-milestones.tji` line 45). The note, verbatim:

> M12, L4, M4: the book detail Download card says A zip of the repository …
> Any git tool opens it (en.js:205-206, as the boards draw it), the upload
> preview names .gitattributes (en.js:86), the setlist raw pane says any git
> host (en.js:520), and the save sheet tells a local book that saving shares
> it with whoever shares the book (SaveSheet.jsx:235). Git terms stay in the
> file view, where workflow 14 shows the book as git sees it. Change the
> strings in all four locales and the boards, as design.review_polish writes
> them. Source: usability review 2026-10-19 (Claude in Chrome on the deployed
> app, findings verified against the code). Tests: unit (the locales carry
> every key); behavior (the local-book save caption differs from a hosted
> one; axe).

The note's line numbers have drifted; the current ones are under Inputs.

## Effort estimate

**0.5 day** (from the `.tji`). Three strings rewritten and one added, in
four locale files; one `useSlice` and a ternary in `SaveSheet`; one new unit
case, one new behavior `describe`, three behavior assertions updated or
added.

## Repository

**estante-de-cifras only**, under `app/`. Not format work (the note does not
start with `cifra.md:`); nothing touches the service, the API or `cifra.md/`.
Files:

- `app/src/i18n/locales/en.js`, `pt-BR.js`, `es-419.js`, `it.js` — the
  strings.
- `app/src/songs/SaveSheet.jsx` — the caption chosen by where the book lives.
- Tests: `app/src/i18n/i18n.test.js`,
  `app/src/songs/SaveSheet.behavior.test.jsx`,
  `app/src/books/UploadPreview.behavior.test.jsx`,
  `app/src/books/BookDetail.behavior.test.jsx`,
  `app/src/books/SetlistView.behavior.test.jsx`.

**No design delta, and no board edit.** `design.review_polish` (complete)
already wrote every word into the workflows (workflow 4 L90-94, workflow 7
L176-180 and L205-210, workflow 12 L33-35) and onto the boards (the new
Download body on W07 L217, Open-a-book, Remove-from-shelf, Leave-book and
Review-polish; the upload *Left out* line on W07 L148). No board draws
`.gitattributes` or *git host* outside the file view (W14). The local-book
save caption is decided in workflow 4 but drawn on no board; see Decision
*No board for the local caption*.

## Inherited dependencies

Settled (all `complete 100`):

- `design.review_polish` — item 2, the copy table *The new copy*
  (`tasks/refinements/design/review_polish.md` L362-381): the English for
  `books.downloadBody`, `books.uploadLeftOutBody`, `setlists.relativeNote` and
  the new local-book save caption; Constraint "Git terms … stay only in the
  file view (workflow 14)" (L182-183); Decision *English pinned, the builds
  translate* — this task writes the pt-BR, es-419 and it strings.
- `songs.save_sheet` — the sheet and its caption (`SaveSheet.jsx:326`).
- `books.shelf` / `books.owner_can_save` — `orderedBooks` and the
  `local`/`shared` entry kind (`app/src/books/book-display.js:161-182`).
- `shell.i18n` — the four locales and the parity tests in `i18n.test.js`.
- `books.upload_ui`, `books.setlists`, `books.online` — the three other
  screens whose strings change.

No pending dependency.

## What this task is

Four lines of copy on everyday screens still speak git: the book detail's
Download card (*A zip of the repository … Any git tool opens it*), the upload
preview's *Left out* line (*… a README and .gitattributes …*), the line under
a setlist's raw pane (*… opens the songs on any git host*), and the save
sheet's caption, which tells someone saving into a book only on this device
that saving shares it *with whoever shares the book*. This task puts in the
plain words `design.review_polish` decided, in all four locales, and makes the
save sheet choose its caption by where the book lives: a book on Estante
keeps today's caption; a book only on this device gets *Saved on this
device. Only you can see it until the book is put online.* The file view
(workflow 14) keeps its git words.

## Why it needs to be done

The usability review of 2026-10-19 (findings M12, L4, M4) found these words
lose a musician who has never heard of git, and the save caption is simply
untrue for a local book — it promises a sharing that does not happen.
DIRECTION and the workflows keep git as the machinery under the app, shown
as git only in the file view; these four strings are where it leaked out.
It is one of the polish milestone's leaves (`tasks/99-milestones.tji` L45);
nothing downstream depends on it.

## Inputs / context

- **Workflow 4 §Save pushes** (`docs/workflows/04-edit-and-save.md` L82-98):
  the caption *chosen by where the book lives* — on Estante: *Saving shares
  this version with whoever shares the book; with no network, at the next
  sync.*; only on this device: *Saved on this device. Only you can see it
  until the book is put online.*
- **Workflow 7 §Downloading a book** (`docs/workflows/07-add-a-book.md`
  L170-180): Download's behaviour is unchanged (the repository zipped, the
  remote removed); its words are *A zip of this book as it is on this device:
  every song and setlist with its whole history, and unsaved changes as they
  are. Upload it to bring the book back.*
- **Workflow 7 §Uploading a book** (L204-211): *A book holds songs, setlists
  and its README, so these stay behind.* — `.gitattributes` not named; the
  file view is where it shows.
- **Workflow 12** (`docs/workflows/12-setlists.md` L33-35): *The links start
  from {folder}, so they keep working wherever the book’s files are copied.*
- **Workflow 14** — the file view, where git terms stay
  (`fileView.holds`, en.js ~L1390, names `.gitattributes` and is untouched).
- **The copy table**: `tasks/refinements/design/review_polish.md` L362-381.
- **Current strings** (en.js; the other three locales at the same keys,
  ~9-30 lines earlier — pt-BR/es-419/it L79-80, L197-198, L507, L1015-1017):
  - `books.uploadLeftOutBody` — `app/src/i18n/locales/en.js:88-89`, used at
    `app/src/books/UploadPreview.jsx:364`.
  - `books.downloadBody` — `en.js:217-218`, used at
    `app/src/books/BookDetail.jsx:641`.
  - `setlists.relativeNote` — `en.js:545` (placeholder `{folder}`), used at
    `app/src/books/SetlistView.jsx:565` (the wide-mode raw pane).
  - `saveSheet.pushCaption` — `en.js:1108-1109`, used unconditionally at
    `app/src/songs/SaveSheet.jsx:326`.
- **SaveSheet**: props at `SaveSheet.jsx:446-461` (`store`, `bookId`, … — no
  notion of where the book lives); it already reads the `savePreview` and
  `preferences` slices with `useSlice` (L76-77). Its hosts: `AppShell.jsx`
  (~L1316), `EditSongHost.jsx` (~L149), `SearchScreen.jsx` (~L841),
  `FileView.jsx` (~L459), `NewSongHost.jsx`, `HistoryDev.jsx`,
  `EditorDev.jsx`.
- **Where a book lives**: `orderedBooks(shelf)` gives each visible entry
  `kind: 'local' | 'shared'` (`book-display.js:161-182`); `BookDetail.jsx:390-393`
  derives `isLocal` from it the same way; `saveTargetFor`
  (`book-display.js:239-245`) is the existing per-book lookup the hosts use
  for `canSave` and the label.
- **Tests to extend**: `app/src/i18n/i18n.test.js:45-73` (per locale: every
  key English has and no others; the same placeholders; translated, not
  copied); `SaveSheet.behavior.test.jsx` (`makeStore`/`emit` L31-37,
  `renderSheet` L66-73, `checkWcag21aa` imported; the shelf is fed by
  `event(EventKind.SHELF, …)` as in `NewSong.behavior.test.jsx:59-91`);
  `UploadPreview.behavior.test.jsx:308` (asserts the **old** *Left out*
  string — it must change); `BookDetail.behavior.test.jsx:61-67` (the
  device-only book shows Download); `SetlistView.behavior.test.jsx` (wide
  mode renders, e.g. L211, L233).

## Constraints / requirements

1. **The English is the copy table's, verbatim** (review_polish L362-381),
   typographic apostrophe in *book’s* included. `setlists.relativeNote`
   keeps its `{folder}` placeholder (the parity test checks it in every
   locale).
2. **Four locales.** pt-BR, es-419 and it say the same thing in their own
   words, with no git term: no *git*, no *repositório / repositorio /
   repository*, no *.gitattributes*, no *host*. They match each locale's
   existing vocabulary for book, song, setlist (*repertório*, *repertorio*,
   *scaletta*) and device.
3. **One new key**, `saveSheet.localCaption`, in all four locales;
   `saveSheet.pushCaption` keeps its key and words (the hosted caption is
   unchanged).
4. **SaveSheet decides the caption itself**, from the `shelf` slice: the
   entry for `bookId` in `orderedBooks(shelf)`; `kind === 'local'` →
   `saveSheet.localCaption`, otherwise `saveSheet.pushCaption`. No book entry
   (the shelf not arrived yet, or an unknown id) → the hosted caption, as
   today (Decision *Unknown reads as hosted*). No new prop, no host changes.
5. **The file view keeps git words**: `fileView.*` strings are untouched; so
   is Download's behaviour (the zip, `DOWNLOAD_BOOK` in the Worker) — only
   its words change.
6. **Accessibility**: the caption stays a plain `<p className="t-small">` in
   the sheet's form, read in order; axe at WCAG 2.1 AA clean on both caption
   states. Nothing else on any screen moves.
7. Test fixtures are purpose-written (the existing *Tarde Clara* preview and
   invented book labels); no one else's words.

## Acceptance criteria

Behaviour:

- The Download card body, the upload preview's *Left out* line and the
  setlist raw pane's line read as the copy table says, in English, and in
  pt-BR, es-419 and it in those languages, with no git term.
- The save sheet on a book only on this device shows *Saved on this device.
  Only you can see it until the book is put online.* and not the sharing
  caption; on a book on Estante it shows today's caption; while the shelf is
  unknown, today's caption.
- The file view's strings are unchanged.

Tests, by level:

- **unit** — `app/src/i18n/i18n.test.js`:
  - the existing per-locale cases — *has every key English has, and no
    others* and *uses the same placeholders as English in every string* —
    run over the new `saveSheet.localCaption` and the changed strings (pins
    the note's "the locales carry every key"; `{folder}` kept in
    `setlists.relativeNote`).
  - new: *says the everyday lines without git's words, in every language
    (shell.plain_language)* — for each locale, `books.downloadBody`,
    `books.uploadLeftOutBody`, `setlists.relativeNote` and
    `saveSheet.localCaption` match none of `/\bgit\b/i`, `/repositor/i`,
    `/\.gitattributes/`, `/\bhost\b/i` (pins workflow 7 §Downloading and
    §Uploading, workflow 12 L33-35; review_polish Constraint "git terms only
    in the file view"); and English's three rewritten strings and
    `saveSheet.localCaption` equal the copy table's text exactly.
- **behavior**:
  - `app/src/songs/SaveSheet.behavior.test.jsx`, new `describe('save sheet —
    the caption says where the save goes (§Save pushes)')`:
    (a) the shelf holds `BOOK` under `local` → the sheet shows *Saved on this
    device. Only you can see it until the book is put online.* and no
    *Saving shares this version …*; axe clean;
    (b) the shelf holds `BOOK` under `books` (a shared book, role `owner`) →
    *Saving shares this version with whoever shares the book; with no
    network, at the next sync.* and not the local caption; axe clean;
    (c) no `SHELF` event → the hosted caption. Pins workflow 4 §Save pushes
    L90-94 and the note's "the local-book save caption differs from a hosted
    one; axe".
  - `app/src/books/UploadPreview.behavior.test.jsx:308` — the assertion
    changes to *A book holds songs, setlists and its README, so these stay
    behind.*, and asserts `.gitattributes` is not in the Left out card's
    text (workflow 7 §Uploading L204-211; the case's axe check stays).
  - `app/src/books/BookDetail.behavior.test.jsx`, the device-only case
    (L61-67) — also asserts the Download body's new words (workflow 7
    §Downloading L176-180).
  - `app/src/books/SetlistView.behavior.test.jsx`, a wide-mode case — the
    raw pane's line reads *The links start from {folder}, so they keep
    working wherever the book’s files are copied.* with the setlist's folder
    (workflow 12 L33-35).

No deferred work.

## Decisions

### SaveSheet reads the shelf; no new prop

**Chosen:** `SaveSheet` takes `useSlice(store, 'shelf')` and finds `bookId`'s
entry with `orderedBooks`, as `BookDetail` does (`BookDetail.jsx:390-393`).
**Rejected:** (a) an `isLocal` prop threaded from each host — seven call
sites (four real, three dev mounts) to change, and a host that forgets it
shows the wrong caption silently; the sheet already holds `store` and reads
two slices. (b) Adding `isLocal` to `saveTargetFor`'s return — four of the
hosts call it, but `FileView` and `NewSongHost` derive `canSave` their own
way, so it still needs threading through a prop. (c) Having the Worker's
`SAVE_PREVIEW` carry the book's kind — a protocol change for a fact the view
already has.

### Unknown reads as hosted

**Chosen:** with no shelf entry for the book, the sheet shows today's
sharing caption. **Rejected:** defaulting to the local caption, as
`BookDetail` defaults its `kind` to `local` — wrongly telling someone that
*only you can see it* on a shared book is the worse mistake: it reassures
about privacy that is not there. In practice the shelf arrives with the
Worker's OPEN, before any sheet opens.

### No board for the local caption

**Chosen:** no board change. W04's sheet (L88) saves into a book on Estante,
whose caption is unchanged; workflow 4 L90-94 decides the local wording, and
the behavior test pins it. **Rejected:** drawing a second W04 sheet for a
local book — one sentence's difference, and boards are `design`-task output;
the note's "and the boards" is already done by `design.review_polish`.

### No e2e-web level

The note names unit and behavior only. This task moves no control and
changes no journey: four strings and a caption choice inside one component,
each pinned by the behavior tests with axe; existing journeys that pass
through these screens still run their axe checks over the new words. No e2e spec asserts the old
strings (`e2e/web/tests/lost-access.spec.js:100` mentions *the repository*
only in a comment, about behaviour, and stays).

### Keep `pushCaption`'s key

**Chosen:** add `saveSheet.localCaption` and leave `saveSheet.pushCaption`
for the hosted case. **Rejected:** renaming it to a pair
(`captionHosted` / `captionLocal`) — churn across four locales for no
reader's benefit.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-20.

- Plain words for the Download card, the upload *Left out* line and the setlist raw-pane line in all four locales: `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`; the file view's git words are unchanged.
- New `saveSheet.localCaption` string, chosen in `app/src/songs/SaveSheet.jsx` when the book lives only on this device; a shared book, or none found yet, keeps the sharing caption.
- Unit: `app/src/i18n/i18n.test.js` — key and placeholder parity cover the new key, plus a no-git-term case per locale and an exact check of the English against the copy table.
- Behavior: `app/src/songs/SaveSheet.behavior.test.jsx` (local, shared-owner and no-shelf captions, axe), `app/src/books/UploadPreview.behavior.test.jsx`, `app/src/books/BookDetail.behavior.test.jsx`, `app/src/books/SetlistView.behavior.test.jsx` (wide-mode editor raw-pane line).
- No e2e, corpus or tech-debt follow-ups; the refinement scopes none.

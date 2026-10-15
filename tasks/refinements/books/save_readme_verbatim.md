# books.save_readme_verbatim — Save README.md and .gitattributes as written

## TaskJuggler entry

`tasks/65-books.tji` — `task save_readme_verbatim "Save README.md and
.gitattributes as written"` (inside `books`), wired into
`milestones.m5_complete` (`tasks/99-milestones.tji:44`).

## Effort estimate

0.5d.

## Repository

Not `cifra.md:`. The work lands in the app:

- `app/src/worker/canonicalise.js` (+ `canonicalise.test.js`);
- `app/src/worker/working-copy.behavior.test.js` (a new case; no change to
  `working-copy.js` itself);
- `app/src/editor/save-blockers.js` (+ `save-blockers.test.js`);
- `app/src/editor/SongEditor.behavior.test.jsx` (a new case).

Design delta: `docs/workflows/14-file-view.md` §Canonical form, the
`README.md` / `.gitattributes` bullets (Decision 6). It is already written
and goes into the closer's commit.

## Inherited dependencies

- `songs.save_gate_dropped_section` — **settled** (complete, 2026-10-15). It
  added `app/src/editor/save-blockers.js`. Its Decision 3 made the
  after-rule codes stop every path except `*.setlist.md`, README.md included.
  The reason was that the Worker ran README through the song writer, so a
  save really would drop those lines. That refinement registered this task to
  change the Worker and narrow the gate
  (`tasks/refinements/songs/save_gate_dropped_section.md:270-284, 309-314`).

## What this task is

Today the Worker sends every path that is not a setlist, README.md and
`.gitattributes` included, through the song writer `write(parse(input))`. In
Markdown a `---` before a `## Heading` is a plain horizontal rule. In a song
the same `---` is the voicings rule. So the song writer drops a README's
headings that come after a `---` and the lines under them, and it collapses
runs of blank lines. This task gives `canonicaliseFile` a third branch:

- `*.cifra.md` goes to the song writer;
- `*.setlist.md` goes to the setlist writer;
- **every other path** is saved as written. The bytes are checked as UTF-8.
  The only changes are the text rules the hook holds README to: no BOM, LF,
  NFC, a tab as one space, exactly one final newline. A marker line is
  refused.

It also narrows the editor's save gate. The codes for content the song
writer drops (the after-rule codes and `bad-voicing`) now stop only
`*.cifra.md` paths and new songs, which have no path yet. A marker line still
stops every file.

## Why it needs to be done

The file view's raw editor opens README.md and `.gitattributes` in
`SongEditor` with their real path (`app/src/files/RawEditorHost.jsx:46-56`).
Saving one sends a SAVE with `paths: ['README.md']`
(`app/src/files/FileView.jsx:131-137`). That runs
`canonicaliseFile('README.md', …)` (`app/src/worker/working-copy.js:144`),
and the song writer's output is written back and committed (`:164-168`).
Two things go wrong:

- A README with a "Usage" section under a horizontal rule loses that
  section.
- Since `songs.save_gate_dropped_section`, the save is stopped with an
  after-rule message about tunings, which means nothing in a README.

The service already holds README.md only to the text rules
(`service/internal/hook/canonical.go:142-163`, `readmeReason`). The app
writes a stricter, lossy form than the server asks for. Workflow 14 says
README "is not a song" (`docs/workflows/14-file-view.md:73`). Nothing
downstream depends on this task; it closes the gap the predecessor left open.

## Inputs / context

- `docs/workflows/14-file-view.md`:
  - L24-28: what a songbook holds (README.md and `.gitattributes` at the
    root);
  - L51-52: "The app canonicalizes every song and setlist when saving";
  - L65-66: the text rules ("UTF-8 with no BOM, LF, exactly one final
    newline, NFC, no tabs");
  - L73-74: README held to the text rules, `.gitattributes` exactly what the
    app writes. This is where the delta goes.
- `docs/workflows/04-edit-and-save.md` §Normalising (L54-70): the save stops
  that exist because the song writer would drop a line. They are about songs.
- `cifra.md/spec/1-document.md:40-60`: the reader's text preparation. Step 5
  replaces a tab with **one** space, and L58-60 gives the reason. Step 6
  (trailing-space trim) is a reading rule, not one of the hook's README
  rules.
- `cifra.md/js/src/index.js:20` exports `decode` (a fatal UTF-8 decode that
  throws `NotUtf8Error`, `text.js:23,33`), `prepare` and `markerLines`.
  `markerLines` accepts a string or bytes and returns 1-based lines
  (`text.js:80`).
- The hook:
  - `service/internal/hook/canonical.go:142-163` `readmeReason`: invalid
    UTF-8, U+FEFF anywhere, any `\r`, any `\t`, not NFC, no final `\n`, ends
    `\n\n`, marker line;
  - `canonical.go:129-132`: every other non-song kind passes this layer;
  - `service/internal/hook/contents.go:74,216`: `.gitattributes` must equal
    `"*.cifra.md merge=cifra\n*.setlist.md merge=cifra\n"`, the same bytes as
    `GITATTRIBUTES_BYTES` (`app/src/worker/books.js:33`);
  - `contents.go:132` `classifyPath`: only these four kinds are allowed at
    all.
- `tasks/refinements/hook/canonical.md:133-145, 493-509`: README is checked
  against the text rules "natively", without a cifra.md parser. The marker
  refusal applies to README too.
- `app/src/worker/canonicalise.js`:
  - `:30-31`: the "anything else is a song" comment and `SETLIST_SUFFIX`;
  - `:42-47`: `firstMarkerRefusal`;
  - `:68-89`: `canonicaliseFile` and its refusal shapes `marked` /
    `unreadable`.
- `app/src/worker/working-copy.js`:
  - `:46-54`: `kindOfPath` already knows `readme` / `gitattributes`;
  - `:123-168`: `save` has two passes (canonicalise every file, then write
    back and commit), and a refusal aborts before anything is written.
- `app/src/worker/upload.js:315-319`: upload already stages a non-song
  working change verbatim ("canonical form governs songs/setlists, not
  prose"). This task brings save into line with that.
- `app/src/editor/save-blockers.js:17-34`: `songWriter = !path ||
  !path.endsWith(SETLIST_SUFFIX)`, plus `EVERY_FILE` / `AFTER_RULE`.
- `app/src/worker/logic.js:1173` passes `refused.reason` through to
  SAVE_REFUSED. `app/src/songs/SaveSheet.jsx:173-181` shows
  `saveSheet.refused` (with the line) for `marked` / `unreadable`. No new
  reason is introduced.
- Tests this task extends:
  - `app/src/worker/canonicalise.test.js` (`:33`, `:77` describes);
  - `app/src/worker/working-copy.behavior.test.js`: the rig `setup` `:128`,
    `gitRemote` `:64`, the model case `:205`, and the refusal model `:449`;
  - `app/src/editor/save-blockers.test.js:87` (the per-path case, changed
    here);
  - `app/src/editor/SongEditor.behavior.test.jsx:245` (the rig: `makeStore`,
    `emit(SOURCE)`, `onSave` spy, axe).

## Constraints / requirements

- **Canonical form over preserving content.** README.md's canonical form *is*
  the text rules (workflow 14 L65-66, L73). The save applies them, so what it
  commits always passes `readmeReason`, and it does nothing more. This is not
  preserving a non-canonical spelling: no song or setlist is saved
  differently.
- **A marked text is never saved** (spec §11.12.3). A README or
  `.gitattributes` holding a marker line is refused with
  `reason: 'marked'` and the line, the same shape the song writer's
  `MarkedTextError` gives. Use the format's `markerLines` primitive
  (`firstMarkerRefusal`). Never write a scan of our own.
- **UTF-8 is checked, not assumed.** When the input is bytes, decode it with
  cifra-md's `decode`. A `NotUtf8Error` becomes `{ ok: false, reason:
  'unreadable' }`, as it does today through the song reader.
- The text rules in order, on the decoded text:
  1. remove every U+FEFF;
  2. CR LF and a lone CR become LF;
  3. NFC (`String.prototype.normalize('NFC')`);
  4. each tab becomes one space;
  5. remove trailing LFs and append exactly one (an empty file becomes
     `"\n"`).

  Nothing else changes: trailing spaces are kept (a Markdown hard break),
  every line and every interior blank line is kept. The function is
  idempotent.
- `canonicaliseFile` stays pure: no I/O, no logs, no file text in any error
  message it builds.
- The dispatch is by suffix. `*.cifra.md` goes to the song writer;
  `*.setlist.md` goes to the setlist writer; any other path gets the text
  rules. The callers that pass only song paths (`nameAndSave` `:210`,
  `upload.js`, `conflicts.js`) are unaffected.
- The editor gate stays a pure function of `(diagnostics, path)`:
  - `marker-line` stops every path;
  - `bad-voicing`, `bad-block-heading`, `notes-outside-block` and
    `item-outside-block` stop only `*.cifra.md` and a missing path (a new
    song).
- Worker owns the data; the main thread never touches IndexedDB. No change
  to the protocol, the reducer, SaveSheet or i18n.

## Acceptance criteria

Behavior delivered:

- A README.md saved from the file view keeps every line, every blank line,
  and a `---` with the headings and text under it. The commit holds those
  bytes, apart from the text rules.
- A `.gitattributes` saved unchanged commits exactly `GITATTRIBUTES_BYTES`.
- A README with a marker line is refused: no write, no commit.
- In the raw editor, a README with `---` / `## Usage` saves with no
  after-rule stop. A song with the same text still stops (the predecessor's
  behavior).

Tests, by level:

- **unit — `app/src/worker/canonicalise.test.js`**, a new
  `describe('canonicaliseFile — README.md and .gitattributes')`, every
  fixture purpose-written:
  - *"keeps a README with a rule and headings under it byte for byte"*: a
    README like `# Livro de Ensaio\n\nNotas do grupo.  \n\n\n---\n\n## Usage\n\nAbra
    uma cifra.\n`, passed as `Uint8Array` bytes, comes back `{ ok: true,
    text }` with `text` identical. That pins the interior blank-line run, the
    trailing double space, and the `---` / `## Usage` lines. *Pins workflow 14
    L73 (delta); the note's unit clause.*
  - *"applies the text rules and nothing else"*: the same README with a
    leading BOM, CRLF and a lone CR, a tab, an NFD `é`, and three final
    newlines comes back with no U+FEFF, no `\r`, no `\t` (one space where it
    was), NFC, and exactly one final `\n`. Running `canonicaliseFile` again on
    the output gives the same text (idempotent). *Pins workflow 14 L65-66;
    spec §1 step 5 (one space); hook `readmeReason`.*
  - *"refuses a README holding a marker line"*: a `<<<<<<< ours` /
    `=======` / `>>>>>>> theirs` README returns `{ ok: false, reason:
    'marked', line, marker: '<<<<<<< ours' }` with the right 1-based line.
    *Pins spec §11.12.3; hook/canonical.md marker Decision.*
  - *"refuses invalid UTF-8 as unreadable"*: bytes `[0x23, 0x20, 0xff, 0x0a]`
    under `README.md` give `reason: 'unreadable'`. *Pins workflow 14 L30-31
    (UTF-8 text).*
  - *"keeps the app's .gitattributes byte for byte"*: `GITATTRIBUTES_BYTES`
    (imported from `./books.js`) as bytes comes back identical.
  - The existing song and setlist cases keep passing. One added assertion in
    the songs describe: the README fixture from the first case, saved under
    `x.cifra.md`, still goes through the song writer, so the output differs
    and lacks `## Usage`. That pins that the dispatch is by suffix.
- **unit — `app/src/editor/save-blockers.test.js`**: the case at `:87` is
  rewritten to *"stops the song-writer codes only on a song or a new song; a
  marker line everywhere (Decision 3)"*.
  - `SECTION_AFTER_RULE` gives `[]` under `README.md`, `.gitattributes` and
    `x.setlist.md`, and `['bad-block-heading']` under `x.cifra.md`, `null`
    and `undefined`.
  - The bad-voicing fixture gives `[]` under `README.md` and `['bad-voicing']`
    under `x.cifra.md`.
  - The marked fixture still stops `README.md` and `x.setlist.md` with only
    `marker-line`.
- **behavior — `app/src/worker/working-copy.behavior.test.js`**, two new
  cases in the existing rig (`setup`, `until`, `gitRemote`):
  - *"SAVEs a README.md as written — the rule and the headings under it
    committed unchanged (workflow 14 L73)"*: WRITE `README.md` with the unit
    test's README text, then SAVE `paths: ['README.md']`. Wait until status
    is `saved`. Then `gitRemote(remote, 'show', 'main:README.md')` equals the
    text exactly, and `ctx.read('README.md')` does too.
  - *"REFUSES a README.md holding a marker line — no commit, no push"*,
    modelled on `:449`: `outcome.reason === 'marked'`, the marker string,
    and the local head and remote ref unchanged.
- **behavior — `app/src/editor/SongEditor.behavior.test.jsx`**, a new case
  *"saves a README with a rule and a heading under it, with no after-rule
  stop (workflow 14 L73)"*: the same rig as `:245`, but `path="README.md"`,
  emitting SOURCE with a README holding `---` and `## Usage`. Press Save:
  `onSave` is called once and there is no `role="alert"`. Axe over
  `container` is clean (`checkWcag21aa`). The existing `:245` case (a
  `*.cifra.md` path) keeps passing, so a song still stops.

No e2e level: the note names none (Decision 5).

No follow-up tasks deferred.

## Decisions

1. **Every non-song, non-setlist path gets the text rules, not the song
   writer.** `canonicaliseFile` dispatches `*.cifra.md` to the song writer,
   `*.setlist.md` to the setlist writer, and everything else to the text
   rules. The only other paths the hook admits are README.md and
   `.gitattributes` (`contents.go:132`). Workflow 14 L73 already says README
   "is not a song". *Rejected: keep "anything else is a song" and special-case
   `README.md` by name. That leaves `.gitattributes` on the song writer and
   keeps the wrong default for whatever the next allowed kind is.*
2. **"As written" means the text rules are applied, not raw bytes.** The
   README's canonical form under workflow 14 is the text rules. Applying
   exactly what `readmeReason` checks (BOM, line endings, NFC, tab, final
   newline) means a README save is always pushable, and nothing that is
   content changes. A tab becomes **one** space, the format's own choice
   (spec §1 step 5), so the app has one tab rule. *Rejected: saving the bytes
   untouched. A pasted tab or a missing final newline would commit a README
   the hook refuses, which strands an unpushable local commit. Rejected:
   running `prepare`. It also trims trailing spaces (a Markdown hard break)
   and works on lines, not on the text. Rejected: a tab as four spaces (a
   Markdown tab stop). That would be a second tab rule in the app.*
3. **`.gitattributes` gets the same branch, with no new refusal.** Saved
   unchanged, it commits `GITATTRIBUTES_BYTES`. One edited away from the
   app's bytes is saved and then refused at push by `hook.contents`
   (`contents.go:216`), on the existing push-refusal path. *Rejected: having
   the save write `GITATTRIBUTES_BYTES` regardless. That throws the user's
   edit away silently. Rejected: a new `not_app_gitattributes` refusal
   reason. It needs a new SaveSheet message and protocol value in a 0.5d
   task, for an edit nobody makes in the normal course; the hook already
   refuses it honestly.*
4. **The editor gate narrows to "the song writer runs here": `*.cifra.md` or
   no path.** This includes `bad-voicing`, not only the three after-rule
   codes. All four describe a line the *song* writer would drop (spec §7.2,
   §7.4, §8.2, §8.3). The setlist writer has no voicings part, and README /
   `.gitattributes` now go through no writer at all, so on those paths none
   of the four describes a drop. `marker-line` stays on every path (a marked
   text is never saved). The predicate still mirrors `canonicaliseFile`'s
   dispatch, as the predecessor's Decision 3 set out. *Rejected: narrowing
   only the after-rule codes (the note's literal wording). `bad-voicing`
   would then still stop a README that happens to hold a `## Voicings: …`
   heading, for a drop that no longer happens. The only other change is that
   a setlist with a song-parser `bad-voicing` diagnostic is no longer stopped.
   That diagnostic never described a drop there either.*
5. **No e2e level.** The note names unit and behavior. The dispatch and the
   text rules are pure (unit). The commit's bytes are pinned against a real
   git remote at the behavior level, and the editor's unstopped save with
   axe in the behavior case. The file view's save journey through the real
   UI already exists, and typing a `---` into CodeMirror on three viewports
   would pin nothing more. The hook side is already covered by
   `hook.canonical`'s README tests.
6. **Design delta: workflow 14 §Canonical form, the README.md and
   `.gitattributes` bullets.** The workflow said README is "held to the text
   rules" but not what the app does when it saves one, and the app's
   behavior here was wrong. The bullets now say: saved as written, every
   line kept, only the text rules tidied (a tab as one space), a marker line
   stops it, and an edited `.gitattributes` is refused by the service at
   push. Already written in `docs/workflows/14-file-view.md`; it goes into
   the closer's commit. No spec change and no workflow 4 change: §Normalising
   is about songs, and it stays true.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-15.

- `app/src/worker/canonicalise.js`: `canonicaliseFile` sends `*.cifra.md` to the song writer and `*.setlist.md` to the setlist writer; every other path (README.md, `.gitattributes`) is UTF-8 checked and saved as written with only the text rules applied (no BOM, LF, NFC, tab as one space, one final newline); a marker line is refused.
- `app/src/editor/save-blockers.js`: `bad-voicing` and the three after-rule codes stop only `*.cifra.md` paths and new songs; `marker-line` still stops every file.
- unit: `app/src/worker/canonicalise.test.js` (new describe for README.md and .gitattributes, plus a suffix-dispatch case) and `app/src/editor/save-blockers.test.js` (per-path case rewritten).
- behavior: `app/src/worker/working-copy.behavior.test.js` (README saved unchanged; README with marker line refused) and `app/src/editor/SongEditor.behavior.test.jsx` (README with rule and heading saves with no after-rule stop; axe).
- Design delta: `docs/workflows/14-file-view.md` (Decision 6).
- No e2e-api, e2e-web or corpus tests (Decision 5); no tech-debt follow-up.

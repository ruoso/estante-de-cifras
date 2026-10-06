# songs.editor — The source editor

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), `task songs.editor` under
`task songs`. Dependencies as declared: `depends storage.working_copy` (the
task's own line), plus the parent `task songs` cascade `depends shell.layout,
shell.chart, foundation.e2e_web`. The one-line note:

> "CodeMirror 6 on the cifra.md text: syntax colour, the template, add
> section, preview beside or a tap away, pasting a cifra into a fence with
> undo, a voicing line it cannot read stopping the save. Workflows 3, 4.
> Tests: unit (syntax colouring, paste into a fence); behavior (CodeMirror
> with Testing Library: the template, add section, paste with undo, an
> unreadable voicing line stopping the save; axe); e2e-web (editing a song
> by keyboard and touch on the three viewports; axe)."

This is the one place a person writes cifra.md text by hand. DIRECTION §3.7
names it: "**The source editor is CodeMirror 6**: the cifra.md text with its
syntax coloured, conflict markers, pasting into a fence, undo. Writing an
editor is not worth it." (`docs/DIRECTION.md:418-420`).

## Effort estimate

**4d** (as scoped in the `.tji`), allocated `team`.

## Repository

**estante-de-cifras** only:

- `app/src/editor/` — the new editor area: the `SongEditor` component (the
  CodeMirror mount, the toolbar, the preview, the paste notice and the
  voicing-stop notice) and two pure helpers (`cifra-syntax.js` line
  classification, `fence-paste.js` the paste transform, `template.js` the
  new-song starting text), with co-located tests. A dedicated area like
  `app/src/chart/` and `app/src/diagram/`, because the file view's raw editor
  (DIRECTION §4, `docs/DIRECTION.md:449-452`) and arrange mode build on this
  CodeMirror seam later.
- `app/src/worker/` — one read-path addition: an `OPEN_SOURCE` command and a
  `SOURCE` event that hand a song's working-copy text to the view, with a
  `source` slice. Extends `protocol.js` / `reducer.js` / `logic.js` the way
  every prior consumer did (`working_copy`, `index`, `search` each added their
  own kinds).
- `app/src/App.jsx` — a hash-gated dev mount (`#dev/editor`) mirroring the
  chart gallery's `#dev/chart` (`App.jsx:14,34`), so the editor is
  exercisable before its real hosts (`songs.reading`, `songs.new_song`, the
  file view) wire its entry points (Decision 6).
- `app/package.json` / `app/package-lock.json` — the CodeMirror 6 packages
  (Decision 1).
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — an `editor` copy section
  in all four catalogues (completeness is a hard build gate).
- `e2e/web/tests/` — the Playwright journey.

**Not a `cifra.md:` task.** It consumes the format's JavaScript library
(`cifra-md`, the local `file:../../cifra.md/js` link in `app/package.json`) —
`parse`, the markdown primitives and the chord parser — and changes nothing
in the spec, reference or corpus. The app and the service share no code
(DIRECTION §3.6, `docs/DIRECTION.md:288-291`); the editor is entirely on the
device, so the service is untouched.

## Inherited dependencies

All **settled** — every dependency is `complete 100`:

- **`storage.working_copy`** — *settled, Done 2026-10-05*
  ([`../storage/working_copy.md`](../storage/working_copy.md)). The Worker
  flow the editor drives:
  - `createWorkingCopy({ fs, git, locks }) → { write, save, discard }`
    (`app/src/worker/working-copy.js`): `write({ bookId, path, text })` (`:80`)
    writes the editor's text straight into the book's working copy under the
    book lock — no commit, no canonicalise — the durability path the editor
    calls on each (debounced) keystroke; `save({ bookId, paths, message,
    author })` (`:94`) canonicalises → commits → pushes; `discard({ bookId,
    paths })` (`:159`).
  - `CommandKind.WRITE` / `SAVE` / `DISCARD` (`protocol.js:31-32`);
    `EventKind.SAVED` / `DISCARDED` / `SAVE_REFUSED` (`protocol.js:94-96`).
    `SAVE_REFUSED` names a `{ path, reason, marker?, line? }` for a **marked
    text** (`reason: 'marked'`, a conflict-marker line) or an unreadable file
    (`reason: 'unreadable'`, a hard reader error — invalid UTF-8, *not* an
    unreadable voicing; see Decision 3).
  - `canonicaliseFile(path, input)` (`app/src/worker/canonicalise.js:68`) — the
    save's per-file step. The cifra.md writer is the single authority on
    canonicality and marker lines; the editor never re-implements it.
  - The book lock is Worker-only; the editor never touches it
    (`../storage/locks.md`). Per-keystroke `WRITE` runs under the lock, so the
    view **debounces** its writes (working_copy Decision 3).
  - working_copy **explicitly deferred the editor UI, the save sheet and the
    "unsaved" badge** to later leaves (this task, `songs.save_sheet`,
    `songs.search`). It built WRITE/SAVE/DISCARD and **no read-back**
    (Decision 4).
- **`shell.chart`** — *settled, Done 2026-10-05*
  ([`../shell/chart.md`](../shell/chart.md)). `Chart` (`app/src/chart/Chart.jsx`,
  default export `{ model, markOf, size, label, className }`) is the editor's
  **preview**: a pure view over a plain-object model prop; it does not import
  `cifra-md` or parse. Fed the model the editor parses from its buffer
  (Decision 2). `chartRows(model)` (`app/src/chart/layout.js:120`) is the pure
  layout. This cascade dependency is **directly used here** (unlike in
  `songs.search`).
- **`shell.layout`** — *settled, Done* ([`../shell/layout.md`](../shell/layout.md)).
  The shell splits at `(min-width: 600px)`: `narrow` (phone) `.screen`/`.scroll`
  + bottom `.tabbar`; `wide` (tablet **and** computer) master-detail `.split`.
  The editor's "preview beside / a tap away" split keys off this same boundary
  (Decision 7). **No router**; the editor is view state, not a route.
- **`shell.portal_provider`** — *settled, Done 2026-10-06*
  ([`../shell/portal_provider.md`](../shell/portal_provider.md)). `ThemeRoot`
  wraps the tree in `UNSAFE_PortalProvider` whose container is the `.est` token
  root (`app/src/theme/ThemeRoot.jsx`), so any editor overlay (the paste
  notice is inline, but a future menu/popover) portals into `.est` and gets
  tokens for free — no per-screen `portalContainer` plumbing.
- **`shell.tokens`** — *settled, Done* (transitive). All colour is token-keyed
  under `.est` (`app/src/theme/theme.css`); the editor authors no colours. "The
  rendered chart is **not** monospaced; only the raw source editor is"
  (`docs/mockups/README.md:24`, `docs/mockups/GUIDE.md:25`). The chart tokens
  the preview uses (`.chart`, `.sung`, `.sec-name`, `mark-def`/`mark-conf`…)
  are the chart's.
- **`shell.i18n`** — *settled, Done* (transitive). Copy goes through
  `t(key, params)` (`app/src/i18n/index.js`); a new `editor` section lands in
  all four catalogues.
- **`storage.preferences_surface`** — *settled, Done* (transitive). The user's
  notation dialect is `store.slice('preferences').notation?.value`, falling
  back to `DEFAULT_DIALECT`; the template writes `notation:` from it
  (workflow 3 §The notation property, Decision 9).
- **`foundation.e2e_web`** — *settled, Done*. The Playwright harness at
  `e2e/web/`; the editor journey lands here.
- **`account.first_run` / `OPEN_EXAMPLE_BOOK`** — *settled, Done* (the bundled
  example book, commit 98ff7ae). `OPEN_EXAMPLE_BOOK` seeds real on-device songs
  (`app/example-book/*.cifra.md`, `app/src/worker/example-book.js:40`) — the
  editor's e2e opens one and edits it (Decision 6; this is the on-device seam
  `songs.search`'s e2e lacked).

**No pending blocking dependencies.** The editor's real entry points are
other tasks and do **not** block it: `songs.reading`'s "edit" affordance
(workflow 4 §Editing: "edit opens the editor on its text"), `songs.new_song`'s
new-song entry and book/naming, and the file view's raw editor. None is a
dependency here, so the editor stands up its own dev mount for test
(Decision 6). `songs.save_sheet` owns the save sheet the editor's clean Save
hands off to (boundary in Decision 10).

## What this task is

The CodeMirror 6 source editor over a song's cifra.md text. It loads the
song's current working-copy text into a CodeMirror buffer, colours it by
cifra.md structure (title and properties, section headings, the fences, the
music inside them, the voicings part, and — standing out — conflict-marker
lines and lines the reader could not read), and persists every edit back to
the working copy through the Worker (a debounced `WRITE`, no commit). A new
song starts from a **template**. **Add section** writes a heading and a fence
and drops the cursor inside. A **preview** of the song as it will be read sits
beside the text on a wide screen and a tap away on a phone, rendered by the
reading chart. **Pasting a cifra** from a chord site — chords over words, no
fences — is wrapped into a fence (and, if the song is still untitled, its first
line becomes the title) in one undoable move, with a notice that offers to
undo. And a **voicing line the reader cannot read**, which canonicalising would
silently drop, **stops the save** instead — the editor points at the line and
keeps it until the user fixes or deletes it.

To load the text the editor also lands one small Worker read-path — an
`OPEN_SOURCE` command returning a `{ bookId, path }`'s working-copy bytes as a
`SOURCE` event — the read-back `storage.working_copy` did not build.

## Why it needs to be done

It is the only hand-authoring surface in the app: without it a person can read
and arrange songs but cannot type or correct the cifra.md text. `songs.new_song`
(`depends !editor`) writes a new song *into this editor*; `songs.save_sheet`
(`depends !editor`) opens its sheet from this editor's Save; `songs.arrange`
builds on the same cifra.md-over-CodeMirror seam; the file view's raw editor
reuses it. It belongs to milestone **M2 (`m2_local`)** — "a songbook on one
device: find, read, write, edit… installed and offline" — transitively through
`songs.new_song` and `songs.save_sheet`, which M2 depends on directly
(`tasks/99-milestones.tji`).

## Inputs / context

### Governing design

- **Workflow 3 — Write a new song** (`docs/workflows/03-write-a-new-song.md`).
  The editor's own design lives here; workflow 4 defers to it ("workflow 3
  describes the editor", `04-edit-and-save.md:10`).
  - **§The editor** (L64-79): "A new song starts from a template: the title,
    the properties it will want, and one empty section with its fence."
    (L64-66). "**Add section** writes a heading and a fence, and puts the
    cursor inside." (L77). "A preview of the song as it will be read sits
    beside the text on a wide screen, and a tap away on a phone." (L78-79).
  - **§The notation property** (L82-85): "a new song therefore always writes
    `notation:` from the user's preference, so that it reads the same to
    someone whose preference differs."
  - **§Pasting a cifra** (L87-95): pasted cifra-site text is "chords over
    words with `[Intro]`-style headings, and no fences. Outside a fence it
    would be read as notes… So when pasted text lands outside any fence, the
    editor puts it inside one, and says so in a message that offers to undo.
    When the song has no title yet, the first line of what was pasted becomes
    the title, under the same message."
- **Workflow 4 — Edit and save** (`docs/workflows/04-edit-and-save.md`).
  - **§Editing** (L9-21): every change writes to the working copy immediately;
    "There is one kind of unsaved change, whatever made it"; leaving/closing/
    power-off loses nothing.
  - **§Normalising** (L48-56) — the voicing-stop, verbatim: "What was typed by
    hand is normalised at save: the voicings put in canonical order, the chart
    untouched. A voicing line the parser could not read is one normalising
    would drop (§8.3). **Rather than lose it, such a line stops the save, with
    a message pointing at it. The user fixes it or deletes it, and saves
    again.**"
  - **§Saving** / **§Discarding** (L24-35, L74-77) — the save sheet and discard
    confirm; `songs.save_sheet` owns both (boundary, Decision 10).
- **The mockups** (what the drawings decide):
  - **`docs/mockups/W03-write-a-new-song.dc.html`** — the template
    (`edTemplate`, L230-239): `# {title}` · `- artist:` · `- notation:
    brazilian` · blank · `## Intro` · an empty ```` ``` ```` fence with the
    cursor on the empty line inside. "Add section" button on every viewport
    (phone bottom bar; tablet appbar; computer context bar). Preview: a
    **Text / Preview** segmented toggle on the phone (`.seg`, "Text" selected),
    a side-by-side **Preview** card on the tablet, a split pane on the computer
    (L69, L107-126, L151-173). The paste notice (`notice accent`, L103-106):
    "The pasted song is now inside a fence, so it reads as music. Its first
    line became the title." + an **Undo** button; the inserted fence lines
    carry the `md add` class (`edPaste`, L240-259).
  - **`docs/mockups/W04-edit-and-save.dc.html`** — the voicing-stop (computer,
    `notice conflict`, L177-180): "**Not saved.** Line 23 is a voicing that
    can't be read, and saving would drop it. Fix it or delete it, then save
    again." The offending line carries the `err` class (L259, a five-fret
    voicing under a six-string tuning header L256); the editor renders a visible
    line-number gutter (`edDesk`, L271) so "Line 23" is actionable. Status is
    carried by **words** ("Not saved.", "can't be read", "would drop it") plus
    an icon, never colour alone (`docs/mockups/README.md:26`).

### The format (cifra.md spec — the behaviour the editor mirrors, not code to translate)

- **Fences** — `spec/1-document.md` §1.9 (L311-385). Music lives in Markdown
  fenced code blocks; a fence's trimmed, lower-cased info string decides what
  it holds: "Empty, or `cifra`, is music. Anything else is **verbatim**"
  (L350-359). "Fences are not recognised in the voicings part." (L370). A chart
  with no fence whose lines would read as chords "is almost always a paste that
  was never fenced" and MUST be reported (L371-375) — the condition the
  paste-into-fence affordance answers.
- **Voicing lines** — `spec/7-voicings.md` §7.4 "Voicing items" (L107-146) and
  §7.5 "Fret strings" (L148-174). A voicing item is `- <key>: <fret string>`.
  "A list item that is not of this form, or whose fret string does not parse or
  has the wrong number of strings (§7.5), is a **problem**. A reader MUST skip
  it, MUST report it with the text of the item, and MUST continue… A writer
  MUST NOT write problems back; see §8." (L132-135). §8.2 confirms
  canonicalising **drops** problem items (`spec/8-normalisation.md:90-92`). So
  an unreadable voicing is *silently dropped by the format* — the stop is an
  app policy over it (Decision 3).
- **Canonical form; marked text** — `spec/8-normalisation.md` §8.1 (L8-54):
  "A writer that saves a document MUST save it in canonical form." (L35-37);
  the fifth property, "It holds no marker line… a text with a line of git's
  conflict markers (§11.12.3)… is never canonical… and a writer refuses to save
  it." (L30-33). `spec/11-merge.md` §11.12.2 "The marked text" (L978-991) and
  §11.12.3 "Marker lines" (L1035-1051): a marked text is "what the *edit* choice
  of an application opens" — i.e. what this editor shows — and "A writer MUST
  NOT save one: it MUST refuse, and point at the first marker line."

### The code seams this extends

- **The `cifra-md` library** (local link `file:../../cifra.md/js`, package
  `cifra-md`, entry `js/src/index.js`):
  - `parse(bytes, dialect = null) → model` (`js/src/parse.js:1105`). Returns
    `{ title, properties, sections, blocks, sung, sungAt, diagnostics }`
    (`:1053-1061`); never throws on malformed music (only `NotUtf8Error`). Each
    diagnostic is `{ code, message, line, text? }` (`:325-329`), sorted by
    line. Codes the editor keys on: **`bad-voicing`** (`:593,604,608`) — the
    unreadable voicing; **`marker-line`** (`:397`) — a conflict marker;
    `unclosed-fence` (`:518`), `unfenced-music` (`:726`), `bad-block-heading`,
    `bad-fingering`.
  - Markdown primitives for line classification: `fenceOpen` (`js/src/markdown.js:64`),
    `closesFence` (`:76`), `mdHeading`, re-exported by `index.js`.
  - Marker-line primitives: `markerLines(text)`, `isMarkerLine(line)`,
    `prepare`, `NotUtf8Error` (`js/src/text.js`, re-exported).
  - Chord recognition for colouring chord lines: `parseChord` / `isChord` /
    `DEFAULT_DIALECT` (re-exported).
  - `write` / `canonical` / `isCanonical` / `MarkedTextError` (`js/src/write.js`)
    — the save-side authority; the **Worker** calls these, not the editor
    (Decision 2 / Decision 3).
- **The store ↔ Worker contract:** `createStore(endpoint)` →
  `store.send(message)` (`app/src/worker/store.js:49`), `store.slice(name)`
  (`:42`), `getAppStore()` (`:79`); `useSlice(store, name)`
  (`app/src/worker/useStore.js:14`); `command(kind, payload)` /
  `CommandKind` / `EventKind` (`app/src/worker/protocol.js`). New kinds are
  added to `protocol.js` / `reducer.js` / `logic.js` the way every prior
  consumer did (`protocol.js:23-27` notes the channel is open to extension).
- **The Worker dispatch:** `logic.js` imports `parse` (`:13`), builds
  `ensureWorkingCopy()` (`:319`) and dispatches `WRITE` (`:559`), `SAVE`
  (`:577`), `DISCARD` (`:624`). It is where the `OPEN_SOURCE` handler lands,
  reading `git.bookDir(bookId)/path` over `fs.promises.readFile`.
- **The shell + dev mount:** `App.jsx:14,34` (`isChartGallery()` + the
  `#dev/chart` branch) — the pattern the `#dev/editor` mount mirrors;
  `SearchScreen`'s `onOpenSong({ bookId, path })` seam is the no-op the real
  hosts will later point at the editor.
- **Accessibility / test support:** `checkWcag21aa(container)`
  (`app/src/a11y/axe.js`); `createLoopbackEndpoint`, `fake-indexeddb`,
  `installWebLocks`, `createFileSystem`, `startGitHttpRemote` (the in-process
  Worker rig, as `working-copy.behavior.test.js`).

## Constraints / requirements

- **The view is the only React layer; the Worker owns the data.** The editor
  reads the song text through the `source` slice (fed by `OPEN_SOURCE`),
  persists edits through `store.send(command(CommandKind.WRITE, …))`, and never
  touches IndexedDB, git or the book lock (DIRECTION §3.7
  `docs/DIRECTION.md:407-409`). *Central.*
- **Canonical form over preserving content, and the save refusal are the
  Worker's.** The editor never canonicalises or commits; it keeps the buffer
  and pre-validates (Decision 3). Canonicalising, the marked-text refusal and
  the commit live in `working-copy.js` via the cifra.md writer; the service's
  hook checks the same on push (DIRECTION §3.6 `:288-291`). A **marked text**
  (conflict markers) is shown but never saved (spec §8.1, §11.12.3). *Central.*
- **Offline first.** Loading, editing, preview, syntax and the voicing-stop all
  run on the device; nothing waits on a network — `WRITE` persists locally and
  a save pushes when there is one (workflow 4 §Editing; DIRECTION §3.4
  `:232-234`). *Central — pinned by the offline e2e behaviour.*
- **Accessibility (every UI task).** Every interactive part is a React Aria
  Component — the toolbar buttons (Add section, Save, the preview toggle), the
  Undo in the paste notice — with full keyboard paths; CodeMirror's own editing
  surface is keyboard-first and screen-reader-labelled; axe at WCAG 2.1 AA on
  every state (Text, Preview, the paste notice, the voicing-stop). **Status is
  a word** — the voicing-stop spells out "Not saved… can't be read… would drop
  it" and names the line number; the `err` highlight never carries the meaning
  alone (`docs/mockups/README.md:26`). *Central.*
- **No song text in logs.** The editor renders and persists song text but logs
  none of it; the Worker logs nothing (`canonicalise.js` header). Fixtures are
  purpose-written songs. *Applies.*
- **No book without an account; `noindex`.** The editor opens only books
  already on the device; it adds no read path beyond the local working copy.
  *Applies trivially.*
- **Component boundaries (DIRECTION §3.6).** No code shared with the service;
  `cifra-md` stays framework-free below the view (`docs/DIRECTION.md:415-417`).
  *Applies.*
- **Dependency hygiene.** CodeMirror 6 is added to `app/package.json` **and
  `app/package-lock.json`** together; a dep added without the lockfile breaks
  `npm ci` and the gate (Decision 1). *Applies.*

## Acceptance criteria

### Behavior delivered

1. **Loads a song's text.** Given `{ bookId, path }`, the editor sends
   `OPEN_SOURCE` and renders the working-copy text in a CodeMirror 6 buffer
   with a visible line-number gutter (W04 `edDesk`). For a new song it starts
   from the template instead (§3 below). The editor mounts inside the `.est`
   token scope.
2. **Syntax colour.** A pure classifier colours each line by cifra.md
   structure: the title and `- property:` lines, `##` section headings, fence
   delimiters, music inside a music fence (chord lines distinct from lyric
   lines), the voicings part, and — standing out — **conflict-marker lines**
   and **lines the reader reported** (`bad-voicing` → the `err` class). Driven
   by `cifra-md`'s own markdown primitives (`fenceOpen`/`closesFence`/
   `mdHeading`), `isMarkerLine`, the chord parser, and `parse().diagnostics`
   — never a re-implemented grammar (Decision 8). *Pins workflow 3 §The editor,
   spec §1.9/§7; mockup line classes.*
3. **The template.** A new song opens on `template(preferences)`:
   `# {placeholder title}`, `- artist:`, `- notation: {dialect}` (from the
   preferences slice, `DEFAULT_DIALECT` when absent), a blank line, one `##`
   section and an empty fence, cursor on the empty line inside. *Pins workflow 3
   §The editor L64-66, §The notation property L82-85; W03 `edTemplate`.*
4. **Add section.** An "Add section" button inserts a `## ` heading and an
   empty fence pair at the end and places the cursor on the empty line between
   them — reachable by pointer and keyboard. *Pins workflow 3 §The editor L77;
   W03.*
5. **Preview, beside or a tap away.** On `wide` (tablet/computer) the preview
   sits beside the editor; on `narrow` (phone) a **Text / Preview** segmented
   toggle swaps to it. The preview is the reading `Chart` fed the model the
   editor parses from its buffer; it updates as the text changes (Decision 2).
   *Pins workflow 3 §The editor L78-79; W03 preview.*
6. **Paste a cifra into a fence, with undo.** When pasted text lands outside
   any fence, the editor wraps it in a new fence in **one undoable
   transaction**; if the song is still untitled the first pasted line becomes
   the `#` title in the **same** transaction; a notice ("…now inside a fence,
   so it reads as music. Its first line became the title.") offers **Undo**,
   which reverts both. A single editor undo also reverts the whole move. *Pins
   workflow 3 §Pasting a cifra L87-95; W03 paste notice.*
7. **A voicing line it cannot read stops the save.** When the buffer's
   `parse().diagnostics` holds a `bad-voicing` (or a `marker-line`), pressing
   Save does **not** proceed: the editor shows a word-carried, line-numbered
   notice ("Not saved. Line N is a voicing that can't be read…") and marks the
   line (`err`). The user fixes or deletes the line; when the diagnostics clear,
   Save proceeds (hands off to the save sheet, Decision 10). *Pins workflow 4
   §Normalising L48-56; W04 voicing-stop; spec §7.4 (the policy over the
   format's silent drop, Decision 3).*
8. **Edits persist immediately.** Each change schedules a **debounced**
   `WRITE { bookId, path, text }`; the buffer is the live working copy
   (workflow 4 §Editing). Closing the tab loses nothing (the Worker has already
   written). *Pins workflow 4 §Editing L9-21; DIRECTION §3 storage.*
9. **The read-back seam.** The Worker gains `CommandKind.OPEN_SOURCE
   { bookId, path }` → reads the working-copy bytes → emits `EventKind.SOURCE
   { bookId, path, text }` → a `source` slice (referentially stable per path).
   *Pins the read-back gap working_copy left (Decision 4).*

Wiring: `app/src/editor/SongEditor.jsx` (the component), `cifra-syntax.js`,
`fence-paste.js`, `template.js`, `editor.css`; `CommandKind.OPEN_SOURCE` +
`EventKind.SOURCE` in `protocol.js`, the `source` slice in `reducer.js`, the
`OPEN_SOURCE` handler in `logic.js`; the `#dev/editor` branch in `App.jsx`; an
`editor` section in the four i18n catalogues; the CodeMirror 6 deps in
`app/package.json` + lockfile.

### Tests the task lands with, by level

Per the `.tji` note: **unit**, **behavior**, **e2e-web**. (I add one Worker
**behavior** test for the read-back seam the task introduces — a level the
task needs, per the testing policy.) Fixtures are purpose-written songs, never
anyone's copyrighted words.

- **unit — `app/src/editor/cifra-syntax.test.js`** (*syntax colouring*):
  `classifyLines(text, dialect)` tags a sample song's lines — title/property,
  heading, fence open/close, a chord line vs a lyric line inside a music fence,
  a voicings-part line, a `bad-voicing` line as `err`, and a conflict-marker
  line as its own class; a `tab`/verbatim fence's lines are **not** coloured as
  music. *Pins spec §1.9 L350-359/§7.4, mockup line classes.*
- **unit — `app/src/editor/fence-paste.test.js`** (*paste into a fence*):
  `fencePaste({ text, pasted, hasTitle })` returns the change set — pasted
  text wrapped in a fence when it lands outside one; the first pasted line
  promoted to the title when `hasTitle` is false; **no** extra fence when the
  paste already lands inside a fence; one reversible transaction. *Pins
  workflow 3 §Pasting a cifra L87-95.*
- **behavior — `app/src/editor/SongEditor.behavior.test.jsx`** (real RAC + i18n,
  a loopback-backed store with a seeded `source`/`preferences` slice, axe over
  `container`):
  - *The template* — a new song renders the template text with the cursor in
    the empty fence; `notation:` reads the preference dialect. *Pins workflow 3
    §The editor/§The notation property.*
  - *Add section* — the button appends a heading + empty fence and moves the
    cursor inside; reachable by keyboard. *Pins workflow 3 L77.*
  - *Paste with undo* — pasting cifra text outside a fence wraps it and
    promotes the title; the notice's **Undo**, and a plain editor undo, each
    revert both. *Pins workflow 3 L87-95.*
  - *An unreadable voicing line stopping the save* — a buffer with a
    `bad-voicing` line blocks Save, shows the line-numbered "Not saved…" notice
    and the `err` mark; deleting the line lets Save fire the `onSave` seam. A
    conflict-marker buffer blocks the same way. *Pins workflow 4 §Normalising,
    spec §7.4/§11.12.3.*
  - *Preview* — on a stubbed `wide` layout the preview chart renders beside the
    text; on `narrow` the Text/Preview toggle swaps to it. *Pins workflow 3
    L78-79.*
  - axe clean on the Text, Preview, paste-notice and voicing-stop states.
- **behavior — `app/src/worker/source-read.behavior.test.js`** (the Worker rig,
  as `working-copy.behavior.test.js`): after a `WRITE`, an `OPEN_SOURCE
  { bookId, path }` emits `SOURCE` with the exact working-copy bytes; a path
  with no working-copy file emits an `ERROR`, not a throw. *Pins the read-back
  seam (Decision 4).*
- **e2e-web — `e2e/web/tests/editor.spec.js`** (compose stack, phone/tablet/
  computer projects, axe WCAG 2.1 AA on the editor each viewport), opening a
  song from the bundled example book via the `#dev/editor` mount:
  - *Editing by keyboard and touch on the three viewports* — type into the
    buffer (keyboard on the computer, touch on phone/tablet) and see the edit
    kept across a reload (persisted by `WRITE`). *Pins workflow 4 §Editing; the
    note's e2e clause.*
  - *Preview beside / a tap away* — the preview sits beside on tablet/computer
    and is a tap away on the phone. *Pins workflow 3 L78-79.*
  - *Paste a cifra, fenced with Undo* — paste cifra text, see the fence and the
    notice, Undo reverts it. *Pins workflow 3 L87-95.*
  - *The voicing-stop* — type an unreadable voicing, press Save, see the
    line-numbered block; fix it and Save proceeds. *Pins workflow 4
    §Normalising.*
  - *Offline* — reload with the network cut; loading, editing, preview and the
    voicing-stop still work. *Pins offline-first; DIRECTION §3.4.*
  - axe at WCAG 2.1 AA on the editor on every viewport.

### Deferred work (closer registers in the WBS; both milestone **M2**)

- **Cross-task entry wiring — not new tasks.** The real routes into the editor
  are owned by tasks that already exist: `songs.reading`'s "edit" affordance
  (workflow 4 §Editing), `songs.new_song`'s new-song entry + book selection +
  first-save naming (workflow 3 §Which book/§Its file name), and the file
  view's raw editor (`books.file_view`, DIRECTION §4). Each points its host at
  this editor through the component's props — no follow-up leaf is created, the
  way `songs.search` left the explorer destination to `music.explorer`.
- **The save sheet, discard, save-all, first-save name** are `songs.save_sheet`
  (already a WBS leaf, `depends !editor`). The editor's clean Save invokes an
  `onSave()` seam that task wires to the sheet (Decision 10) — no new leaf.
- **Conflict resolution UI** (choosing ours/theirs over a marked text) is
  `sync.conflicts` / workflow 9 — out of scope here. This task only **renders**
  marker lines and **blocks** the save on them; resolving them is M4's sync
  work. No follow-up leaf from this task.

## Decisions

1. **CodeMirror 6 is the directed dependency; add it with its lockfile.**
   DIRECTION §3.7 (`docs/DIRECTION.md:418-420`) names CodeMirror 6 as the
   source editor, so adding it is **not** a new architectural decision and needs
   no design delta — it is the constitution's choice, and "writing an editor is
   not worth it." The implementer adds the CodeMirror 6 packages (`@codemirror/state`,
   `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, and a
   lint/diagnostics helper as needed) to `app/package.json` **and
   `app/package-lock.json` in the same change** — a dep without the lockfile
   breaks `npm ci` and the gate. *Rejected: a hand-rolled `textarea` editor —
   DIRECTION forecloses it; it would lose the gutter, undo grouping and the
   decoration API the syntax/`err` layers need.*
2. **The editor parses in the view for syntax, preview and diagnostics; the
   Worker owns durability and the canonical save.** CodeMirror's syntax
   decorations and the `err` marks are synchronous per keystroke, so the editor
   must have `parse()` results in the view — and once it does, it builds the
   preview model from the same parse and feeds it to `Chart`. This matches
   `songs.search`, which already calls the chord parser in the view, and
   DIRECTION's "framework-free below the view" (`:415-417`): `cifra-md` knows no
   React and is usable from the view. Durability stays the Worker's (`WRITE`),
   as does the canonical save and the marked-text refusal. *Rejected: parsing
   the preview in the Worker and shipping the model (as `shell.chart`'s reading
   path does) — it would lag the buffer behind a debounce + round-trip and
   force a second, redundant parse, since the view must parse anyway for the
   decorations; the reading view's worker-parse is right for a committed song,
   not for a live buffer. Noted as a deliberate, documented divergence from
   chart.md, not a DIRECTION deviation, so no design delta.*
3. **The voicing-stop is a view-level pre-save gate, not a Worker save
   refusal.** The format **silently drops** an unreadable voicing: the reader
   reports it as a `bad-voicing` *problem* and the writer omits it (spec §7.4
   L132-135, §8.2 L90-92; the JS `write()` does not throw on it). Workflow 4
   §Normalising chooses instead to **not lose hand-typed work** — a policy that
   applies only to authoring, so it lives in the authoring view: pressing Save
   with a `bad-voicing` (or `marker-line`) diagnostic blocks and points at the
   line; a clean parse proceeds. The Worker's existing `SAVE_REFUSED`
   (`reason: 'marked'`) stays the authoritative backstop for a conflict marker
   reaching `SAVE` by any path. *Rejected: extending `canonicaliseFile`/`save`
   to refuse on `bad-voicing` — a `bad-voicing` is a soft problem the format is
   happy to drop, and the shared save path serves every caller (restoring a
   historical version, saving a setlist, arrange-mode saves that never type a
   voicing by hand); refusing it there would block saves the format permits and
   invert where the "don't drop my typing" policy belongs. The editor already
   holds the diagnostics, so no worker round-trip is needed.*
4. **A new read-back command, `OPEN_SOURCE` → `SOURCE`.** `storage.working_copy`
   built `WRITE`/`SAVE`/`DISCARD` and no way to **read** a song's working-copy
   text into the view; `READ_VERSION` reads a *committed* version (history), not
   the live working copy, and the search/browse slices carry metadata, not
   source. So the editor adds `CommandKind.OPEN_SOURCE { bookId, path }` →
   `EventKind.SOURCE { bookId, path, text }` → a `source` slice, a thin
   `fs.readFile` over `git.bookDir(bookId)/path` in `logic.js` — the way every
   prior consumer added its kinds (`protocol.js:23-27`). *Rejected: overloading
   `OPEN` (the Worker bring-up) — it opens the database, not a per-song file;
   conflating them would muddy the bring-up event. Rejected: reusing
   `READ_VERSION` with a HEAD ref — it reads committed bytes and would miss
   unsaved edits, which is exactly the working copy the editor must show.*
5. **Edits persist through a debounced `WRITE`; open-document and cursor state
   are ephemeral view state.** Each change schedules a debounced
   `WRITE { bookId, path, text }` (working_copy Decision 3: the view debounces;
   the per-keystroke book lock is brief). Which song is open, the CodeMirror
   selection and the Text/Preview toggle are `useState`/editor state, never a
   Worker slice — the same category `songs.search` put its scope filter in
   (search Decision 8). *Rejected: a Worker "open document" slice — the open
   buffer is view state; the Worker only needs the durable bytes (`WRITE`) and
   the one-shot load (`SOURCE`).*
6. **Reached via a hash-gated `#dev/editor` mount in this task.** The editor's
   real entry points belong to other tasks (`songs.reading`'s edit,
   `songs.new_song`'s new, the file view's raw editor) and none is a dependency
   here, so — exactly as `shell.chart` shipped `Chart` behind `#dev/chart`
   before a song screen existed — this task mounts the editor behind
   `#dev/editor` (opening a bundled example-book song, or a blank template) so
   its behaviour and e2e run now. The hosts later render the same component in
   the shell detail region. *Rejected: wiring `SearchScreen.onOpenSong` to the
   editor — opening a song from search opens the **reading** view (workflow 2),
   which then offers edit; pointing search straight at the editor would be the
   wrong destination and couple search to a task that does not depend on it.*
7. **Preview "beside vs a tap away" keys off the shipped 600px layout split.**
   `wide` (tablet and computer) shows the preview beside the editor; `narrow`
   (phone) shows a **Text / Preview** segmented toggle. Reuses
   `shell.layout`'s `useLayoutMode()` boundary rather than inventing one.
   *Rejected: a third breakpoint for the editor — the workflow says "wide
   screen" vs "phone", which is exactly the existing split.*
8. **The syntax layer reuses `cifra-md`'s own primitives, not a new grammar.**
   Line classification is computed from `fenceOpen`/`closesFence`/`mdHeading`
   (markdown.js), `isMarkerLine` (text.js), the chord parser and
   `parse().diagnostics` — so the editor's colouring agrees with the reader
   because it uses the reader's own structure, and the `err`/marker highlights
   are exactly what the reader reports. *Rejected: a hand-written Lezer grammar
   for cifra.md — it would be a second, drifting parser of the format inside the
   app, contradicting "one parser, checked" and risking colour that disagrees
   with what saves.*
9. **The template writes `notation:` from the preferences slice.** A new song's
   `- notation:` is the user's dialect (`preferences.notation?.value ??
   DEFAULT_DIALECT`), so it "reads the same to someone whose preference
   differs" (workflow 3 §The notation property). *Rejected: omitting
   `notation:` — the reader would default it to Brazilian, changing how the song
   reads for a user with a different preference.*
10. **The editor's clean Save hands off to `songs.save_sheet` through an
    `onSave()` seam.** This task owns the Save affordance and the pre-save gate
    (the voicing/marker stop); it does **not** build the save sheet, the
    discard confirm, save-all or first-save naming — those are `songs.save_sheet`
    (`depends !editor`). When the parse is clean, Save invokes `onSave()`, which
    `save_sheet` wires to open the sheet (which then sends `SAVE`). *Rejected:
    building the sheet here — it is a separate WBS leaf with its own semantic
    diff (`cifra_js.diff`) and tests; the callback seam is how `songs.search`
    deferred the explorer and keeps the boundary clean.*

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-06.

- `app/src/editor/SongEditor.jsx` — CodeMirror 6 mount with toolbar (Add section, Save), preview toggle, paste notice and voicing-stop notice
- `app/src/editor/cifra-syntax.js` — pure line classifier using `cifra-md` primitives (`fenceOpen`, `closesFence`, `mdHeading`, `isMarkerLine`, `parseChord`, `parse().diagnostics`)
- `app/src/editor/fence-paste.js` — `fencePaste()` transform: wraps pasted text into a fence and promotes the title in one undoable transaction
- `app/src/editor/template.js` — `template(preferences)` generating the new-song starting text with `notation:` from the preferences slice
- `app/src/editor/editor.css` — editor layout and line-class styles
- `app/src/editor/EditorDev.jsx` — the `#dev/editor` development mount
- `app/src/worker/protocol.js` — `CommandKind.OPEN_SOURCE` and `EventKind.SOURCE` added
- `app/src/worker/reducer.js` — `source` slice added
- `app/src/worker/logic.js` — `OPEN_SOURCE` handler reading the working-copy bytes via `fs.readFile`
- `app/src/worker/fs.js` — `flush()` seam exposed beside `promises` (forces lightning-fs's debounced superblock save)
- `app/src/worker/working-copy.js` — `await fs.flush()` after a working-copy `write`
- `app/src/worker/example-book.js` — `await fs.flush()` after the seed commit
- `app/src/App.jsx` — `#dev/editor` hash-gated mount; `useHashRoute` listener for same-document hash changes
- `app/package.json` + `app/package-lock.json` — `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language` added
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` — `editor.source` section in all four catalogues
- Tests — unit: `cifra-syntax.test.js` (5 tests), `fence-paste.test.js` (4 tests); behavior: `SongEditor.behavior.test.jsx` (6 tests, axe clean), `source-read.behavior.test.js` (2 tests); e2e-web: `editor.spec.js` (5 tests × 3 viewports = 15 runs, all pass)

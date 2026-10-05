# storage.progression_search — Chord-progression search

## TaskJuggler entry

[`tasks/40-storage.tji`](../../40-storage.tji), `task storage.progression_search`
(lines 57–62), under `task storage`. Dependencies as declared:
`depends !index` (line 60). The one-line note (line 61):

> "Chord n-gram field on the MiniSearch index plus a progression-aware query,
> so a query like 'Am F C G' finds songs that contain that chord run.
> App-side extension of the search index; the reader's structured item.chord
> is already available. Workflow 2 (Later, L42). Source of debt:
> tasks/refinements/storage/index.md (storage.index). Tests: unit (n-gram
> extraction and progression match); behavior (a progression query finds a
> song that contains the run, built in the Worker)."

This realises the *Later* line workflow 2 deferred — "searching by
progression, `Am F C G`, as songs that contain it"
(`docs/workflows/02-find-and-play.md:42`) — and the follow-up
[`index.md`](index.md) registered when it shipped the search index
([`index.md:390–399`](index.md)). It is the debt that refinement named,
picked up now as its own leaf.

## Effort estimate

**2d** (as scoped in the `.tji`).

## Repository

**estante-de-cifras**, `app/` — the Web Worker search logic under
`app/src/worker/` and its co-located tests. **Not** a `cifra.md:` task: the
note does not start with `cifra.md:`, and the work changes nothing in the
format's spec, reference or corpus. It *consumes* two things the format
already exports from the `cifra-md` package (the `file:../../cifra.md/js`
link in `app/package.json:19`): the song reader `parse` (which already fills
each chord item's structured `item.chord`) and the standalone chord parser
`parseChord`/`isChord` (`/home/ruoso/devel/cifra.md/js/src/index.js:28`),
reused verbatim so the query grammar is the same grammar that classified the
stored chords. The app and the service share no code (DIRECTION §3.6
L275–278); search is entirely on the device (workflow 2 L152–155).

## Inherited dependencies

- **`storage.index`** — *settled, Done 2026-10-05*
  ([`index.md`](index.md)). This task extends, in place, the module that
  refinement built:
  - `app/src/worker/search-index.js` —
    `createSearchIndex({ fs, git, parse }) → { hydrate, indexDocument,
    reindexPath, removePath, reconcile, search }`, plus the named export
    `extractFields(model, oid)`. The MiniSearch instance
    (`makeMini`, ~`search-index.js:130–140`) is configured with
    `fields = SEARCH_FIELDS` (`['title','properties','sections','words',
    'chords']`, `:35`), `storeFields = ['bookId','path','title','artist']`
    (`:134`), `processTerm = (t) => fold(t) || null` (`:138`), and **no
    custom `tokenize`** (MiniSearch's default whitespace/punctuation
    splitter). Per-query boosts come from `FIELD_BOOST`
    (`{ title:10, properties:4, chords:4, sections:3, words:1 }`, `:36`).
  - **The field-extraction walk** (`search-index.js:67–95`): for each
    section → `body` part of `type:'music'` → `line` → `measure` → `item`,
    it collects `words` and, `if (item?.type === 'chord' && item.symbol)`,
    adds `item.symbol` to a **de-duplicated, order-less `Set`**
    (`:88`, joined at `:104`). This is the exact traversal the ordered
    progression run needs; the new field is added alongside it, reading
    `item.chord` instead of (only) `item.symbol`.
  - **The stored record** `index_docs[oid]` is precisely the `extractFields`
    return object `{ oid, title, artist, properties, sections, words,
    chords }` (`:97–105`); `index_locations[key]` is `{ key, bookId, path,
    oid, unsaved }` (`:203`); `toMiniDoc(location, doc)` (`:143–155`) joins
    them into the MiniSearch document; `hydrate(docs, locations)`
    (`:176–186`) rebuilds the in-memory MiniSearch from the persisted arrays
    with **no re-parse**. The content-addressed parse cache is keyed by git
    blob oid, so an unchanged file is never re-read (`indexDocument`
    `:191–213`; `reconcile` `:275–297`).
  - **`search({ query, scope })`** (`:318–333`) trims the query, returns
    `[]` for empty, else `mini.search(q, { prefix:true, boost:FIELD_BOOST,
    filter: matchesScope })` and maps to
    `[{ bookId, path, title, artist, score }]`. **There is a single point
    to intercept** before the one `mini.search` call; no multi-term query
    layer exists yet.
  - **The protocol seam** already carries search:
    `CommandKind.SEARCH` (payload `{ query, scope? }`) and
    `EventKind.SEARCH_RESULTS` (payload
    `{ query, results:[{bookId,path,title,artist,score}] }`) in
    `app/src/worker/protocol.js`; the referentially-stable `search` slice
    (`{ query, results }`) in `app/src/worker/reducer.js`
    (`SEARCH_RESULTS` at ~`:240–250`); the `SEARCH` dispatch in
    `app/src/worker/logic.js` (`:576–587`): `ensureIndexHydrated()` then
    `ensureSearchIndex().search({ query, scope })` then
    `port.postMessage(event(EventKind.SEARCH_RESULTS, { query, results }))`.
    **Reused unchanged** — see Decision 5.
  - **The re-index dispatch points** in `logic.js` (OPEN → `buildIndexes()`
    `:379–391`; WRITE/SAVE/DISCARD → `reindexPath`/`reindexOrRemove` +
    `persistIndexChanges`, `:440–526`) already re-extract fields through
    `extractFields`, so the new field is re-derived at every mutation for
    free, with no new wiring (Decision 5).
  - **The migration slot**: `storage.index` created the `index_docs` and
    `index_locations` object stores with one appended `MIGRATIONS` step
    (`app/src/worker/migrations.js`, step 2). The parse cache is derived
    data, not user content.

- **`cifra_js.reader`** — *settled, Done 2026-10-05*
  ([`../cifra_js/reader.md`](../cifra_js/reader.md)). `parse(bytes) → model`
  fills, on every `item.type === 'chord'` item, the **structured, dialect-free
  `item.chord`**: `{ root:{letter:'A'..'G', accidental:-2..+2}, quality:
  'major'|'minor'|'dim'|'aug'|'sus2'|'sus4'|'power', extensions:[{degree,
  alter}] (sorted ascending by degree, one per degree, degree ∈ {2,4,5,6,7,
  9,11,13}), bass: null | {letter, accidental} }`
  (`/home/ruoso/devel/cifra.md/js/src/chord.js:411–418`;
  `schema/cifra.schema.json` `$defs/Chord`). For a `type:'chord'` item
  `item.chord` is **always non-null** — an unparseable token becomes a
  separate `type:'unknown'` item, never a chord item with a null chord
  (`parse.js:159–160`). This is the "already-structured `item.chord`" the
  `.tji` note points at.

- **`cifra_js` (the package)** — *settled*. Exports `parseChord(text,
  dialect = DEFAULT_DIALECT)`, `isChord(text, dialect)`, `DIALECTS`,
  `DEFAULT_DIALECT` (`/home/ruoso/devel/cifra.md/js/src/index.js:28`).
  `parseChord` returns `{ chord, ambiguities, errors }` with
  `chord = {root, quality, extensions, bass}` or `null`
  (`chord.js:141`, `:411–419`); `isChord` is `parseChord(...).chord !== null`
  (`:423`). Callable on a bare token (`"Am"`), separate from the song reader.

- **`storage.worker` / `storage.migrations`** — *settled* (transitive via
  `index`). The message/store seam, the sole-IndexedDB-owner `logic.js`, and
  the ordered `MIGRATIONS` list with `latestVersion`/`runMigrations`
  (`migrations.md`): "Each later storage task lands its own step here."

- **`foundation.app_tooling`** — *settled* (transitive). Plain JS/JSX, JSDoc
  typedefs, Vitest in jsdom with co-located `*.test.js` /
  `*.behavior.test.js`, `fake-indexeddb`, and the in-process loopback
  transport, local git-HTTP remote and Web-Locks shim under `app/src/test/`.

No pending dependencies: the one declared dependency (`storage.index`) and
everything transitive are Done.

## What this task is

The search index already finds songs by the chords they *use* — a folded,
de-duplicated bag of chord symbols in its `chords` field, so typing `Am`
surfaces every song containing an Am. This task adds finding songs by the
chords they play **in order**: a query like `Am F C G` returns the songs that
contain that exact chord *run*. It does so by extracting, for each song, the
**ordered sequence of its chords** (reading order across sections, lines and
measures, with consecutive repeats of the same chord collapsed), reducing each
chord to a **canonical, spelling-tolerant token** derived from the reader's
structured `item.chord` (so a song written with `A-` or `Amin` still matches a
query typed `Am`), and indexing all contiguous **n-grams** of that sequence as
a new MiniSearch field. A query that parses as two or more chords is handled as
a **progression query**: its own canonical sequence is turned into the same
n-gram token(s), matched against the field, and the matches are merged into the
ranked result list the existing `SEARCH`/`SEARCH_RESULTS` seam already carries.
Everything stays in the Worker; no new protocol kind, store or screen is
introduced.

## Why it needs to be done

Workflow 2 decided chord-progression search and deferred only its build:
"*Later:* searching by progression, `Am F C G`, as songs that contain it"
(`docs/workflows/02-find-and-play.md:42`). The search-index task
([`index.md`](index.md)) shipped the engine and the chord-*use* field but
explicitly left the progression field and progression-aware query to a named
successor — this one ([`index.md:390–399`](index.md)). Chord-progression
search is a core discovery path for the musician the app is for: finding every
song that moves `Am F C G` is how you build a set around a feel, or find
another song you can already play. It depends on the search index (the engine,
the stored parse cache, the mutation dispatch points) and on the reader's
structured chords (the identity that makes spelling-tolerant matching
possible), both now settled; its user-facing surface — a progression typed
into the one search box, its results labelled and ordered against the explorer
row and text matches — is the job of the still-unbuilt search-screen / chord
explorer UI (`music.explorer`, `tasks/55-music.tji`), which consumes the
results this task makes possible.

## Inputs / context

### Governing design

- **Workflow 2 — Find and play a song**
  (`docs/workflows/02-find-and-play.md`, Status: decided, L3):
  - **The deferred feature** (L42): "*Later:* searching by progression,
    `Am F C G`, as songs that contain it." This task's whole charter.
  - **Chord as a result / one box, two kinds** (L26–42): a single typed
    chord already yields both the explorer row and "the songs that use the
    chord"; "Nothing is hidden by guessing which was meant" (L37). A
    *progression* query (two or more chords) is the multi-chord sibling of
    that single-chord case — it must likewise not suppress plain text
    matches for the same string (Decision 4).
  - **Fields and folding** (L22–24), **A result** (L44–58, the row is
    `{title, artist, book/folder, badges}`; the unit is a location, not a
    title), **Scope** (L60–65), **Offline** (L152–155), **Still building**
    (L159–162) — all inherited unchanged from the index; this task adds no
    new result shape, scope rule or network dependency.
- **DIRECTION §3 — Storage** (`docs/DIRECTION.md` L103–119): the derived
  index "of every song — title, properties, sections, words, chords — keyed
  by blob hash … It covers the working copy too" (L114–117). The progression
  field is one more derived facet of the same per-blob parse, under the same
  content-addressing.
- **DIRECTION §3.7 — the app** (`docs/DIRECTION.md` L394–414): "One owner for
  the data: a Web Worker. It holds git, the working copy and the search index
  … The main thread never touches IndexedDB" (L407–409); components read
  slices through `useSyncExternalStore` (L410–414). The progression query
  runs in the Worker; only `SEARCH_RESULTS` crosses the port.
- **DIRECTION §4 — The interface** (`docs/DIRECTION.md` L428–439): "**Song
  search is the primary interface.** One search across every loaded book:
  title, artist, sections, words, chords" (L430–431). Progression search is
  a facet of that one box.

### The format

- **Chord equality — spec §5.2** (`/home/ruoso/devel/cifra.md/spec/5-chord-symbols.md:68–71`):
  "Two chords are **the same chord** when root, quality, extensions and bass
  are all equal. Roots compare by spelling: `Db` and `C#` are different chords
  that sound alike. A reader MAY additionally offer enharmonic matching." The
  canonical token this task builds *is* this equality rendered as a string
  (Decision 2).
- **Normalisation into the quality — spec §5.2.1**
  (`5-chord-symbols.md:81–95`; implemented `chord.js:389–399`): triad
  alterations are folded into the quality (minor+♭5 → dim, major+♯5 → aug),
  so functionally-equal chords already compare equal in the structured model.
  The task relies on this: it never re-does chord normalisation, it reads the
  model the reader already normalised.
- **Dialects and ambiguous symbols — spec §5.6**: a symbol's reading can
  depend on the user's notation (`DEFAULT_DIALECT` is Brazilian;
  `parse` reads a document's `notation` property). The structured chord is
  dialect-free *after* parsing, so matching is notation-independent; only the
  *query* token's reading is dialect-sensitive, and progression queries
  (`Am F C G`) are unambiguous in practice (Decision 6).
- **Standalone chord parser** — `parseChord` / `isChord`
  (`/home/ruoso/devel/cifra.md/js/src/index.js:28`,
  `chord.js:141`,`:423`). The query side's single source of chord grammar.

### The code seams this extends

- `app/src/worker/search-index.js` — `SEARCH_FIELDS` (`:35`), `FIELD_BOOST`
  (`:36`), `makeMini` (`:130–140`), the extraction walk (`:67–95`),
  `extractFields` (`:62–106`), `toMiniDoc` (`:143–155`), `hydrate`
  (`:176–186`), `search` (`:318–333`).
- `app/src/worker/fold.js` — the accent/case fold used as `processTerm` on
  both index and query terms (NFD, strip combining marks, NFC, lowercase).
- `app/src/worker/logic.js` — `SEARCH` dispatch (`:576–587`),
  `buildIndexes` (`:379–391`), the WRITE/SAVE/DISCARD re-index points
  (`:440–526`), `parse` injection (`:227`, `:326–335`).
- `app/src/worker/migrations.js` — `MIGRATIONS`, `latestVersion`,
  `runMigrations`, `INDEX_DOCS_STORE`, `INDEX_LOCATIONS_STORE`.
- Test support: `app/src/test/loopback.js`, `app/src/test/git-http-remote.js`,
  `app/src/test/web-locks.js`, `app/src/worker/fs.js`,
  `app/src/worker/migrations.test.js` (the per-step unit suite),
  `app/src/worker/search-index.behavior.test.js`.

## Constraints / requirements

- **Worker-only, framework-free.** The new module and the field are plain ESM
  under `app/src/worker/`, never imported by the main thread, never touching
  React or the DOM. The MiniSearch instance and the progression matcher stay
  in the Worker; only `SEARCH_RESULTS` crosses the port (DIRECTION §3.7
  L408–414). *Applies — central.*
- **One source of chord grammar.** Query tokens are parsed with the
  `cifra-md` package's exported `parseChord` — the same grammar whose `parse`
  produced the stored `item.chord`. The app-local `app/src/core/notation/
  parse.js` copy (brought in for the music UI) is **not** used here, and no
  third chord tokenizer is written (Decision 6). *Applies — central.* (This
  is the standing rule read correctly: implementations agree because checked
  against the spec, never by one surface copying another; here the index and
  the query simply read the *one* package the app already depends on.)
- **Keyed by blob hash; covers unsaved work.** The progression field is part
  of the per-oid `index_docs` record, parsed once per distinct blob and
  re-derived at WRITE/SAVE/DISCARD like every other field, so an unsaved edit
  is findable and an unchanged file is never re-parsed (DIRECTION §3
  L114–117). *Applies.*
- **Kept in IndexedDB, under the migration framework.** The added field needs
  no new object store, but existing cached `index_docs` records predate it;
  the parse cache (derived data, not user content) is cleared by one appended
  `MIGRATIONS` step so `reconcile` repopulates it on the next open — never by
  opening the DB at an ad-hoc version (Decision 3). *Applies.*
- **Offline first.** Progression search is entirely local; it adds no network
  call (workflow 2 L152–155). *Applies.*
- **No song text in logs.** The matcher holds chords and song locations; it
  logs none of it — no symbols, titles or paths in any log line (DIRECTION
  §3.5; `logic.js` logs nothing). The persisted records are the user's own
  on-device data, not a log. *Applies.*
- **No book without an account.** The feature searches only books already on
  the device; it opens no new read path and no anonymous surface. *Applies
  trivially.*
- **Canonical form over preserving content.** *Not applicable as a constraint
  here.* The task indexes the working copy as it is (including unsaved,
  uncanonicalised text) and writes no song text back anywhere. It does build
  a *canonical chord token* for matching, but that is an internal,
  non-persisted-as-content identity (§5.2 equality), not a rewrite of the
  user's chord spelling — the song keeps whatever it was written with.
- **Accessibility.** *Not applicable here* — the module renders nothing. The
  search screen's progression-query entry, its result labelling and its
  axe/WCAG checks land with the search-screen / explorer UI task, not this
  one (see Acceptance → Why no e2e-web / axe here).

## Acceptance criteria

### Behavior delivered

1. **Ordered chord run per song.** From a parsed `cifra-md` model, the
   extractor walks chord items in document order (the existing
   `search-index.js:67–95` traversal) and produces the song's **ordered chord
   sequence** — each `item.chord` reduced to a canonical token — with
   **consecutive duplicates collapsed** (a chord held across several bars
   counts once between changes). Items of type other than `chord` (nochord,
   unknown, beat, repeat) do not enter the sequence.
2. **Canonical, spelling-tolerant tokens.** Two chords that are "the same
   chord" by spec §5.2 (equal root, quality, extensions, bass) produce the
   **same** token; chords that differ in any of those produce different
   tokens. So `Am` = `Amin` = `A-`, and `Cmaj7` = `CM7` = `C∆7`, while
   `Am ≠ Am7` and `Db ≠ C#` (roots compare by spelling — no enharmonic
   folding, per §5.2 default; Decision 2).
3. **N-gram field on the index.** A new MiniSearch field `progression` holds
   all contiguous n-grams of the ordered sequence for `n` in `[MIN_N=2,
   MAX_N]` (MAX_N a small constant, Decision 2), each n-gram one token
   (members joined by a reserved delimiter the field's tokenizer keeps whole).
   The field is added to `SEARCH_FIELDS`, given a `FIELD_BOOST`, and emitted
   through `extractFields` → `index_docs` and `toMiniDoc`; a progression-aware
   `tokenize` (branching on field name) splits the field on its token
   separator rather than on chord punctuation (Decision 2).
4. **Progression-aware query.** A query whose whitespace-separated tokens all
   parse as chords via `parseChord` **and number two or more** is treated as a
   progression query: its canonical sequence (consecutive duplicates
   collapsed) is turned into the same n-gram token(s) and matched against the
   `progression` field. For a query of length `L ≤ MAX_N` this is a single
   n-gram token — an exact "contains this contiguous run" match. For `L >
   MAX_N` it is the AND of the query's `MAX_N`-grams for recall, confirmed by
   a direct contiguous-subsequence check against the candidate's stored
   ordered sequence (held in memory via `docsByOid`), so the result truly
   contains the whole run.
5. **Merged, not exclusive.** A progression query **also** runs the existing
   multi-field text search over the raw query string; progression hits and
   text hits are merged by location key (progression contribution boosted),
   deduplicated and returned ranked — so a song literally titled "Am F C G"
   still appears, and a single-chord query (`Am`, one token) is unchanged
   (chord-*use* field + text, no progression path). *Pins workflow 2 L37
   "Nothing is hidden by guessing which was meant."*
6. **Same result shape, same seam.** Results come back through the existing
   `SEARCH` command and `SEARCH_RESULTS` event as
   `[{ bookId, path, title, artist, score }]`; no new protocol kind, store or
   reducer slice is added (Decision 5).
7. **Order and repeats matter correctly.** A song whose chords contain the
   contiguous run `Am F C G` matches; a song that contains the same four
   chords **out of order**, or not contiguously, does **not**. A song that
   plays each chord of the run for several bars (`Am Am F F C C G G`) **does**
   match (consecutive-collapse, Decision 1).
8. **Content-addressing and restart preserved.** The field rides in the
   per-oid parse cache: parsed once per distinct blob, re-derived at
   WRITE/SAVE/DISCARD so an unsaved progression edit is findable, and rebuilt
   by `hydrate` on restart from the stored records without re-parsing an
   unchanged file.
9. **Backfill on upgrade.** On the version introducing the field, the
   migration step clears the derived `index_docs`/`index_locations` cache so
   the next `OPEN` `reconcile` reparses every file once and populates
   `progression`; after that, progression search works across a restart with
   no further reparse (Decision 3).

Wiring (Decisions 1–6): a new pure module `app/src/worker/progression.js` —
the canonical-token builder (from a structured `item.chord`), the
ordered-collapsed-sequence extractor (from a model), the n-gram generator, the
query parser (via `cifra-md` `parseChord`) and the progression matcher; a new
field folded into `search-index.js` (`SEARCH_FIELDS`, `FIELD_BOOST`,
`makeMini`'s `tokenize`, the extraction walk, `extractFields`, `toMiniDoc`,
`hydrate` and `search`); and one appended `MIGRATIONS` step clearing the index
cache. `protocol.js`, `reducer.js` and the `logic.js` dispatch are reused
unchanged.

### Tests the task lands with, by level

Per the `.tji` note's `Tests:` clause — **unit** and **behavior** (sharpened
below; one migration-step unit case added because this task appends a step).
Fixtures are purpose-written songs, never anyone's copyrighted words.

- **unit — `app/src/worker/progression.test.js`:**
  - *Canonical token equality* — `Am`/`Amin`/`A-` map to one token;
    `Cmaj7`/`CM7`/`C∆7` map to one token; `Am` and `Am7` map to different
    tokens; `Db` and `C#` map to different tokens; a slash bass (`C/G`)
    differs from `C`. *Pins spec §5.2 (`5-chord-symbols.md:68–71`), §5.2.1.*
  - *Ordered-sequence extraction* — from a parsed model, chords come out in
    document order; consecutive duplicates collapse; non-chord items are
    excluded. *Pins `.tji` "n-gram extraction"; workflow 2 L42.*
  - *N-gram extraction* — the n-gram set of a sequence is exactly the
    contiguous runs of length `MIN_N..MAX_N` (counts and membership),
    including the single whole-query n-gram for a short query. *Pins `.tji`
    "n-gram extraction".*
  - *Progression match* — a query of two or more chords matches a sequence
    containing the contiguous run; does **not** match the same chords out of
    order or non-contiguous; matches across collapsed repeats; a
    spelling-variant query (`A- F C G`) matches a song written `Am F C G`; a
    one-token query is not treated as a progression. *Pins `.tji`
    "progression match"; workflow 2 L42, L37.*
- **unit — `app/src/worker/migrations.test.js`** (extend): the appended step
  clears `index_docs` and `index_locations` on upgrade and leaves other
  stores intact. *Pins `migrations.md` ("each later storage task lands its own
  step"), Decision 3.*
- **behavior — `app/src/worker/search-index.behavior.test.js`** (extend; real
  Worker logic in-process via `createLoopbackEndpoint`, a fresh
  `new IDBFactory()` per test, `installWebLocks()`, `createFileSystem`, and
  `startGitHttpRemote()` for a seeded book):
  - *Progression found in the Worker* — open a book of purpose-written songs;
    a `SEARCH` for `Am F C G` returns, ranked, the song that contains that run
    with its `bookId`/`path`/title/artist, and a decoy song using the same
    four chords in a different order is **not** returned. *Pins `.tji` "a
    progression query finds a song that contains the run, built in the
    Worker"; DIRECTION §3.7 L408; workflow 2 L42.*
  - *Spelling tolerance end-to-end* — a book song written with `A-`/`Amin`
    spellings is found by the `Am F C G` query. *Pins §5.2, Decision 2.*
  - *Covers unsaved work* — a `WRITE` giving a song the run makes it findable
    by progression **before any save**. *Pins DIRECTION §3 L116–117; `.tji`
    (consistency with the index's unsaved-work guarantee).*
  - *Backfill + restart* — seed a store whose cache predates the field, run
    the migration, reopen `createWorkerLogic` over the **same** `IDBFactory`;
    after `OPEN` reconcile, progression search works, and a subsequent
    restart serves it from the cache without re-parsing an unchanged file.
    *Pins Decision 3, Decision 9; `.tji` restart/keyed-by-blob-hash
    guarantee inherited from the index.*
  - *Merged with text, offline* — a progression query also returns a song
    whose title is that string; the whole suite runs with no network beyond
    the local git remote that seeds the book. *Pins workflow 2 L37, L152–155.*

### Why no e2e-web / e2e-api / axe here

The `.tji` note names only unit and behavior, matching the index it extends:
this is a Worker module with no rendered UI and no HTTP endpoint. The
end-to-end **journey** — typing `Am F C G` into the one box, the progression
results appearing and being labelled against the explorer row and text
matches, on phone/tablet/computer with axe at WCAG 2.1 AA and offline —
belongs to the search-screen / chord-explorer UI task (`music.explorer`,
`tasks/55-music.tji`) that renders the box and the result rows and consumes the
`search` slice. It lands that e2e-web coverage. No level named by the note is
dropped.

### Deferred work

- **No new WBS leaf is created.** This task *is* the debt `storage.index`
  deferred; its own user-facing surface already has a home in the planned,
  unbuilt `music.explorer` task (`tasks/55-music.tji`), which will render
  progression-query entry and labelling and consume these results — that task
  gains no new dependency obligation here beyond the search slice it already
  reads. Setlist indexing and re-index-after-merge remain, as the index
  refinement settled, the responsibility of the setlist surface and the sync
  task respectively, through the seam already exposed; the progression field
  rides that same seam with no extra wiring.
- **Looser / enharmonic matching is a product judgment, not a WBS task.**
  Whether progression matching should ignore extensions (so `Am` matches a
  song's `Am7`) or treat enharmonic roots as equal (`Bb` = `A#`) is a feel
  decision for real musicians, not something an implementer can settle; it is
  surfaced for the parking lot in the return summary, not encoded as a
  task. The chosen default (full §5.2 equality, spelling-exact roots) is the
  spec's own and is the defensible floor (Decision 2).

## Decisions

1. **An ordered, consecutive-collapsed chord sequence from `item.chord`,
   extracted in the existing walk.** The progression is the song's chords in
   document order with runs of the same chord collapsed to one — the musical
   notion of a progression (changes, not beats), so a chord held for four bars
   does not break a query's run. It is collected in the *same* traversal that
   already builds the `words`/`chords` fields (`search-index.js:67–95`),
   reading the structured `item.chord` rather than only `item.symbol`.
   *Rejected: keeping per-occurrence repeats — a query `Am F C G` would then
   miss a song that plays each chord for two bars (`Am Am F F …`), which is
   the same progression. Rejected: segmenting the run per section — the flat
   document-order run matches "contains the run" simply and mirrors the
   existing walk; cross-section spill is rare and harmless for a discovery
   feature, and segmentation can be added later without changing the field's
   shape.*
2. **Canonical token = spec §5.2 chord identity; n-grams over a bounded
   window.** Each chord reduces to a deterministic string built from the
   structured fields — root letter + accidental, quality, the sorted
   `extensions`, and the slash bass — so that two spellings of the same chord
   (§5.2) collapse to one token while genuinely different chords stay distinct;
   roots compare by spelling (no enharmonic folding, the §5.2 default). The
   `progression` field holds every contiguous n-gram for `n ∈ [2, MAX_N]`
   (MAX_N small, e.g. 8 — comfortably longer than a hand-typed progression),
   each n-gram one token with members joined by a reserved delimiter (a
   character absent from the token alphabet and left whole by the field's
   tokenizer and by `fold`). A query of length `L ≤ MAX_N` is then a single
   n-gram token — an exact contiguous match; `L > MAX_N` falls back to an AND
   of `MAX_N`-grams plus a contiguous-subsequence confirmation against the
   stored sequence. *Rejected: matching on `item.symbol` strings — spelling
   would leak into identity (`Am` ≠ `A-`), the opposite of what the
   structured model is for, and it is how `diff.js` compares chords
   deliberately, not how search should. Rejected: a single global n-gram
   length — too short misses longer queries, too long bloats the field and
   can't match short queries; a bounded window with the `>MAX_N` fallback
   covers every length at linear index cost (~`MAX_N × |chords|` tokens per
   song). Rejected: transposition-invariant (relative-degree) n-grams —
   workflow 2 asks for songs that "contain it", i.e. the literal run; relative
   search is a different, unrequested feature.*
3. **One migration step that clears the derived index cache; no new store.**
   The field is an added property on the existing `index_docs` record, so no
   object store is created — but records cached before the field exists lack
   it and, being content-addressed, would never be re-parsed. The appended
   `MIGRATIONS` step clears `index_docs` and `index_locations` (derived data,
   never user content), so the next `OPEN` `reconcile` reparses every file
   once and backfills `progression`; thereafter restart serves from the cache
   with no reparse. *Rejected: persisting a field-schema sentinel and forcing
   a reconcile when it changes — it reinvents, outside the framework, exactly
   what a migration step gives for free; the cache is cheap to rebuild and the
   migrations refinement reserved this slot. Rejected: no migration (let the
   field appear only as files change) — it would leave every already-indexed
   song unfindable by progression until edited, a silent correctness gap for
   real installs.*
4. **A progression query merges with text search, never suppresses it.** A
   query of two or more chord-parsing tokens runs both the progression match
   and the ordinary multi-field text search over the raw string, merged and
   deduplicated by location (progression hits boosted). *Rejected: treating a
   progression query as exclusively a progression search — it would hide a
   song literally titled "Am F C G", contradicting workflow 2's "Nothing is
   hidden by guessing which was meant" (L37); the single-chord case already
   shows both kinds, and the multi-chord case follows the same principle.*
5. **Reuse `SEARCH`/`SEARCH_RESULTS` and every dispatch point unchanged — no
   new protocol kind, slice or seam.** The result row shape
   (`{bookId,path,title,artist,score}`) is unchanged, so the reducer's
   `search` slice and `logic.js`'s `SEARCH` dispatch need no edit; the field
   is re-derived at the existing OPEN/WRITE/SAVE/DISCARD points because they
   already re-run `extractFields`. An optional `dialect` may ride the `SEARCH`
   payload for notation-aware query parsing (the payload is open), defaulting
   to `DEFAULT_DIALECT`. *Rejected: a dedicated `PROGRESSION_SEARCH` command
   and event — the index already fixed `SEARCH` as the one query seam and the
   result shape is identical; a second command would split one interface in
   two for no behavioural gain, and the query's progression-vs-text nature is
   decided inside `search()`, not by the caller.*
6. **Query grammar = the `cifra-md` package's `parseChord`; no new tokenizer.**
   Each whitespace-separated query token is parsed with the package's exported
   `parseChord` (`cifra-md` `index.js:28`) — the same grammar whose `parse`
   classified the stored chords — so the query and the index agree by
   construction; `isChord` on every token (count ≥ 2) decides progression
   intent. A tiny whitespace-split wrapper (the one piece neither repo has) is
   written here. *Rejected: the app-local `app/src/core/notation/parse.js`
   copy — it exists for the music/explorer UI and reusing it would couple the
   Worker index to that core; the Worker already depends on the `cifra-md`
   package and should read chords there. Rejected: a hand-rolled chord
   tokenizer — it would be a third chord grammar in the tree and could drift
   from the one the reader used, breaking the index/query agreement the whole
   feature rests on.*

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- Created `app/src/worker/progression.js`: canonical chord token builder (`canonicalChordToken`, spec §5.2 identity), ordered-collapsed sequence extractor (`chordSequence`), n-gram generator (`ngrams`, `progressionField`), branching MiniSearch tokenizer (`progressionTokenize`), query parser (`parseProgressionQuery` via `cifra-md` `parseChord`/`isChord`), contiguous-match check (`progressionMatch`), and query-token helper (`queryProgressionTokens`).
- Created `app/src/worker/progression.test.js`: unit tests covering canonical-token equality (`Am`/`Amin`/`A-`, `Cmaj7`/`CM7`/`C∆7`, `Am≠Am7`, `Db≠C#`, `C/G≠C`), ordered-sequence extraction (document order, consecutive collapse, non-chord exclusion), n-gram extraction (membership and counts, MIN_N..MAX_N window), progression match (run present/absent/reordered/non-contiguous, spelling-variant query, one-token non-match), window and fallback paths.
- Edited `app/src/worker/search-index.js`: added `progression` to `SEARCH_FIELDS` and `FIELD_BOOST`; injected `progressionTokenize` into `makeMini`; extended the extraction walk to collect `chordSeq` via `chordSequence`; added `chordSeq` to `index_docs` / `extractFields`; extended `toMiniDoc` to build `progressionField(chordSeq)`; updated `hydrate`; made `search` detect a progression query via `parseProgressionQuery`, run it against the `progression` field, and merge the result with the existing text search (boosted, deduped by location key, never suppressing text hits).
- Edited `app/src/worker/migrations.js`: appended step 3 which clears `index_docs` and `index_locations` on upgrade so the next `OPEN` `reconcile` repopulates the `progression` field for every already-indexed song.
- Edited `app/src/worker/migrations.test.js`: step-3 unit cases (clears derived stores on upgrade, leaves other stores intact).
- Edited `app/src/worker/search-index.behavior.test.js`: five new behavior cases (progression found/decoy-not-found, spelling tolerance end-to-end, unsaved-work coverage, backfill+restart, merged-with-text+offline).
- Edited `app/src/worker/migrations.behavior.test.js`, `app/src/worker/fs.behavior.test.js`, `app/src/worker/search-index.test.js`, `app/src/worker/store.test.js`: schema-version and record-shape assertions updated for the appended migration step and the new `chordSeq` field.

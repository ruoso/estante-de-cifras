# reader.engine — The engine: the bundle in goja

## TaskJuggler entry

`tasks/85-reader.tji`, `reader.engine` ("The engine: the bundle in goja"), under
`task reader`. It belongs to milestone `milestones.m7_reader`
(`tasks/99-milestones.tji:58-61`).

## Effort estimate

2d (from the `.tji`). Most of it is in `remarkable/internal/engine`. The rest is
two Go subcommands and a small app-side extension: the choro book, the
fixtures and one counting call.

## Repository

Not under `cifra.md/`. The work lands in:

- `remarkable/internal/engine/`, which is new: the engine package and its tests.
- `remarkable/cmd/estante-reader/`: the `sheet` and `bench` subcommands, in the
  existing `run` dispatch.
- `remarkable/go.mod` and the new `remarkable/go.sum`: the goja dependency.
- `app/src/device/` (entry, build, their tests) and a new fixture book at
  `app/src/device/fixtures/choros/`. This is app code, linted and tested with
  the app (docs/remarkable-reader.md §3.1).
- `.github/workflows/gate.yml`: `remarkable/go.sum` joins the Go cache paths
  (see Constraints).
- `docs/remarkable-reader.md` §4: the host-API table gains `held()` (see
  Decisions 6). This document edit rides in the task's commit.

## Inherited dependencies

- `reader.bundle` — **settled** (complete 100; Status in
  `tasks/refinements/reader/bundle.md`, Done 2026-11-01).
  - Host API 1 is on `globalThis.estante` (`app/src/device/entry.js:206-215`).
  - `npm run build` writes `app/dist/device/bundle.<hash>.js` and
    `manifest.json` (`{version, hostApi, salt, bundle:{path, sha256}}`).
  - It also writes the example book's default-shape fixture at
    `app/dist-test/device/example-book.default-shapes.json`
    (`{salt, entry, table, songs}`; `app/src/device/build.js:46-82`).
  - Its Decision 4 says the memo cannot live in Go, and "reader.engine pins
    the memo through the host calls".
- `reader.module` — **settled** (complete 100; Status in
  `tasks/refinements/reader/module.md`, Done 2026-11-01).
  - `remarkable/` is a Go module, `estantedecifras.app/remarkable`, standard
    library only, with "no go.sum needed until a later task adds goja".
  - `cmd/estante-reader` has one dispatch,
    `run(args, stdout, stderr) int` (`remarkable/cmd/estante-reader/main.go:24-34`).
    Subcommands join that dispatch.
  - The gate runs `go vet` / `go test -p $JOBS` / `go build` on `remarkable/`
    after the app's build, plus three CGO-free cross-builds
    (`scripts/gate:328-347`).
- `reader.key_without_property` (complete) added `key.named` to `sheet`'s
  result on host API 1 (`entry.js:151-155,172`). The engine carries it through.

## What this task is

The Go host for the web app's own music code. `remarkable/internal/engine` does
four things:

- It opens a bundle directory (`manifest.json` and the bundle it names) and
  checks it. The bundle's SHA-256 must match the manifest. The manifest's
  `hostApi` and the evaluated `estante.hostApi` must both equal the one version
  this engine speaks. The manifest's `salt` must equal `estante.salt`.
- It evaluates the bundle in one goja runtime, owned by one goroutine for the
  engine's lifetime.
- It exposes the host API to Go as typed, goroutine-safe methods: `Load`,
  `Sheet`, `Setlist`, `Misses`, `Held`. Values cross as JSON.
- It keeps the runtime and its session alive, so the bundle's memos hold for as
  long as the backend runs. The memos are each song's parsed model and each
  shape rebuilt from the cache. Nothing on the reading path searches.

`estante-reader sheet` prints one song's sheet at a key as JSON, for
development and for the later screens' fixtures. `estante-reader bench`
re-measures the reading path rows of the design's §4.2. That is the goja
spike, kept as a command; the spike's code is not in the repo, so `bench` is
written new.

## Why it needs to be done

Everything the frontend shows is computed by the engine (docs/remarkable-reader.md
§3.2). The following tasks all call it: `reader.song_screen`,
`reader.browse_screens`, `reader.play`, `reader.missed_shapes` (the background
search of `misses()`), `reader.sync` (which loads the instrument and table it
fetched) and `reader.self_update` (which opens a new bundle and keeps the last
good one when the open fails).

This is also the first place the **built** bundle runs in goja, the §9
integration row. Until it lands, nothing pins two things:

- that the bundle runs in goja with only its own polyfills;
- that goja reads songs exactly as Node does.

## Inputs / context

- `tasks/85-reader.tji:26-31`: the note. Its tests are unit (a bundle of
  another hostApi refused; the memo returns the same rebuilt shape) and
  integration (the built bundle loaded in goja: the example book and a book of
  chord-heavy choros at all twelve keys against the build's default-shape
  fixture with no misses; every host call answered; nothing the bundle needs
  missing from the polyfills).
- docs/remarkable-reader.md:
  - §3.2 (L185-199): the engine is one goja runtime owned by one goroutine.
  - §4 (L207-233): no port; the host-API table; the polyfills; "In memory,
    never re-derived".
  - §4.1 (L235-249): the bundle's own salt; the search never runs on the
    reading path.
  - §4.2 (L251-265): the budget `bench` re-measures.
  - §9 (L407-422): the integration row and the gate.
  - §10 (L424-431): no song text in a log.
- `app/src/device/entry.js`:
  - the read-only cache view: L50-60;
  - the parse memo: L67-77;
  - `load`: L89-96;
  - `sheet`: L102-181. The `pending` handling and the miss queue are at
    L131-149.
  - `setlist`: L187-199;
  - `misses`: L202-204.
- `app/src/device/host-api.js`: `HOST_API = 1`. "until a payload is served
  (reader.payload) a new call joins version 1".
- `app/src/device/build.js:46-82` (`buildDevice`) and
  `app/scripts/build-device.js`: where the fixtures are written
  (`dist-test/device/`, gitignored, outside the served `dist/`).
- `app/src/worker/default-shape-fill.js:71` (`fillDefaultShapes`): the
  Worker's fill. It covers all twelve keys (`TRANSPOSITIONS`, L30).
- `app/src/core/voicings.js:204,238-242`: the defaults memo the bundle hands
  in. Its cache `lookup` runs only on a memo miss, which is what makes
  `held().rebuilt` meaningful.
- `app/src/device/entry.test.js:286-309`: the JS-side memo pins (the parse is
  reused). This task adds the goja-side pin.
- `app/src/core/notation/dialects.js:34-67,88-93`: the dialects (`brazilian`
  is the default; `american`, `realbook`) and the `notation:` property.
- `app/example-book/`: three songs and `a-short-set.setlist.md`, written for
  the project.
- `remarkable/cmd/estante-reader/main_test.go`: `TestVersion`, `TestUsage`
  (stderr is exactly `usage+"\n"`), `TestBuiltBinaryAnswersVersion` and
  `TestModuleSharesNoCode`. goja does not trip the last one.
- goja is in the module cache as
  `github.com/dop251/goja v0.0.0-20261031103838-cf2ff0ec0b31`. Its `go.mod`
  says `go 1.26.0`. `remarkable/go.mod` says `go 1.25.0`, and the
  `go1.26.0` toolchain is cached locally.
- DIRECTION §3.6 (`docs/DIRECTION.md:311`) already names goja for the reader.
  It is not a new runtime dependency to DIRECTION.

## Constraints / requirements

- **One goroutine owns the runtime.** A goja `*Runtime` is not goroutine-safe.
  - The engine starts one goroutine in `Open`. It creates the runtime there,
    evaluates the bundle there, and serves every call there from a request
    channel.
  - No `goja.Value` ever leaves that goroutine.
  - Methods are safe from any goroutine and run in arrival order.
- **Values cross as JSON.**
  - Go marshals the arguments.
  - In the runtime: `JSON.parse` the arguments, call `estante.<name>`,
    `JSON.stringify` the result.
  - Go unmarshals into typed structs. Rows and diagram models stay as
    `json.RawMessage` for the protocol to forward untouched.
  - No `ExportTo` mapping.
- **The engine adds nothing to the runtime.** No `console`, no `require`, no
  timers, no Go functions bound into the global object. Only what goja
  provides and what the bundle's own polyfills install. That is what makes
  "nothing missing from the polyfills" checkable: a missing global fails a call
  in the integration test.
- **Refuse what the engine cannot speak.** `Open` returns an error, and the
  engine does not start, when any of these happens:
  - the manifest is absent or not JSON;
  - the bundle file it names is absent;
  - the bundle's SHA-256 differs from the manifest's;
  - the manifest's `hostApi` is not `engine.HostAPI` (1);
  - after evaluation, `globalThis.estante` is missing, or its `hostApi`
    disagrees with the manifest;
  - its `salt` disagrees with the manifest;
  - evaluation throws.

  Each case is a distinct exported sentinel or error type (`errors.Is`-able),
  so `reader.self_update` can keep the last good bundle.
- **Memos survive.**
  - `Load(entry, table)` remembers the digest of the JSON it last loaded. A
    `Load` with the same entry and table is a no-op that returns the previous
    result. `estante.load` clears every memo and the miss queue, so it must
    only run when the instrument or its table really changed.
  - The engine never re-creates the runtime except through a new `Open`.
- **Nothing searches on the reading path.** The engine exposes no search. The
  call that searches a queued miss is `reader.missed_shapes`'s. The bundle's
  read-only view already turns a miss into `pending`.
- **Cancellation.**
  - Every call takes a `context.Context`.
  - If it is done before the call starts, the call is not run.
  - If it is done while the call runs, the owner goroutine calls
    `rt.Interrupt`, then `rt.ClearInterrupt` before the next request, and the
    call returns `ctx.Err()`.
  - `Close` stops the goroutine. Later calls return `ErrClosed`.
- **No song text in an error or a log.**
  - Engine errors name the call and the JavaScript exception's class and
    message, never the arguments.
  - The package logs nothing.
  - `bench` prints timings and counts only, never a title.
  - `sheet`'s stdout *is* the sheet, the requested output and not a log. Its
    stderr carries only usage and error lines without text.
- **CGO-free, three architectures.** goja is pure Go. The gate's existing
  amd64, armv7 and arm64 cross-builds of `./cmd/...` now link the engine, and
  must stay green.
- **The Go version.**
  - goja requires `go 1.26.0`, so `remarkable/go.mod` moves to
    `go 1.26.0`. `service/` and `cifra.md/go/` are untouched.
  - `.github/workflows/gate.yml:46-50` installs Go from `service/go.mod`. The
    implementer checks that CI's `GOTOOLCHAIN` lets `remarkable/` fetch 1.26,
    as it does locally (`GOTOOLCHAIN=auto`). If CI runs with `local`, add a
    `setup-go` step for `remarkable/go.mod`. Either way, add
    `remarkable/go.sum` to `cache-dependency-path`.
  - Adding the dependency needs the module proxy, or
    `GOFLAGS=-mod=mod GOPROXY=off` against the cache if every transitive module
    is cached. This may need a network-enabled run (see the memory on npm deps
    for the same sandbox caveat).
- **No code shared with `service/`.** `TestModuleSharesNoCode` stays green.
  `remarkable/` imports no app source; it loads the bundle's bytes only
  (§3.1).
- **Test fixtures are songs written for the project**, never someone else's
  words. The choro book is new, written for this task, and choro-like only
  (as `reader.key_without_property` did).
- The `go` commands in the gate already carry `-p "$JOBS"`. Nothing here adds a
  build without a bound.

## Acceptance criteria

### Behavior delivered

1. **`remarkable/internal/engine`** exports:
   - `HostAPI = 1`;
   - `Open(dir string) (*Engine, error)`;
   - on `*Engine`:
     - `Manifest() Manifest`
     - `Load(ctx, entry, table json.RawMessage) (Loaded, error)`
     - `Sheet(ctx, text string, offset int, opts SheetOptions) (Sheet, error)`
     - `Setlist(ctx, text, setlistPath string, bookPaths []string) (Setlist, error)`
     - `Misses(ctx) ([]Miss, error)`
     - `Held(ctx) (Held, error)`
     - `Close() error`;
   - the refusal errors of Constraints.

   The field shapes:
   - `SheetOptions` is `{Variation string; Preferences json.RawMessage; TargetKey string}`.
   - `Sheet` carries `title`, `artist`, `key{written,named,status}`, `offset`,
     `transposed`, `rows` (raw), `shapes[]{key,symbol,source,pending,diagram (raw)}`,
     `unvoiced`, `notes`, `keyNote`.
   - An `{error:"unreadable"}` answer becomes `ErrUnreadable`.
2. **The bundle gains `held()`**, an additive call on host API 1 per
   `host-api.js`'s rule. It returns
   `{ songs, shapes, rebuilt, misses }`:
   - `songs` is the size of the parse memo;
   - `shapes` is the size of the defaults memo;
   - `misses` is the size of the miss queue;
   - `rebuilt` counts the read-only view's `lookup` hits since the last `load`.
     A hit happens only on a memo miss, `voicings.js:238-242`.

   docs/remarkable-reader.md §4's table gains its row: "held() — what the
   session keeps: songs parsed, shapes rebuilt, rebuilds so far, misses queued
   (for the host's checks and `bench`)".
3. **The choro book.** `app/src/device/fixtures/choros/` holds four
   `.cifra.md` songs, written for the project, chord-heavy and choro-like:
   - dim and m7(b5) chords;
   - 7(b9), 7(#5) and 7(#11) dominants;
   - 6/9 and 13;
   - slash-bass lines;
   - secondary dominants;
   - a minor A part against major B and C parts;
   - one song with `notation: american` and one with `notation: realbook`, so
     dialects other than the default are read.

   Every song parses with no reader diagnostic.
4. **The fixtures.** `buildDevice` writes one fixture per fixture book into
   `fixtureDir`:
   - `example-book.default-shapes.json`, as today;
   - `choros.default-shapes.json`.

   Each fixture holds:
   - `book`, the app-relative directory, so the Go test reads the texts from it;
   - `salt`, `entry` and `songs` (names);
   - `table`, `fillDefaultShapes` over that book's songs under the standard
     entry;
   - **`expected`**: the output of the **built bundle's own bytes**, evaluated
     in a `node:vm` context. It holds `load`'s answer, `sheet` for every song
     at offsets 0-11 with no options, `held()` after them, and, for the
     example book, `setlist` of `a-short-set.setlist.md` with the book's
     paths.

   That gives the goja run a Node oracle from the same bytes.
5. **`estante-reader sheet --bundle DIR --shapes FILE [--key N] [--variation V] SONG`**
   prints the `Sheet` as indented JSON on stdout and exits 0.
   - `--shapes` takes a file of the fixture's shape (`{entry, table}`); absent,
     the table is null.
   - `--key` is the offset, 0-11, or negative.
   - It exits 1 on an engine or I/O error, with one stderr line naming the
     error, never text.
   - It exits 2 with the usage line on a bad invocation.
6. **`estante-reader bench --bundle DIR --shapes FILE [--rounds N] SONG...`**
   prints one line per §4.2 row, each with its mean:
   - "load bundle" (`Open`);
   - "open song" (the first `Sheet` at offset 0);
   - "change key, first" (each of offsets 1-11, the first time);
   - "change key, again" (the same offsets a second round, memo warm);
   - "heap" (`runtime.MemStats.HeapAlloc` after, in MiB);
   - the `held()` counts.

   Songs appear only as their index. `usage` becomes the three-command usage
   line.
7. `--version` is unchanged (see Decisions 9).

### Tests, by level

**unit (Vitest, `app/`):**

- `app/src/device/entry.test.js`, new `describe('held (§4: what the session keeps)')`:
  - after `load`, every count is 0;
  - a sheet at offset 3 raises `songs` to 1 and `rebuilt` to the number of
    distinct defaulted chords;
  - a second sheet at offset 3 leaves `rebuilt` and `songs` unchanged and
    deep-equals the first;
  - `misses` matches `misses().length` with a null table;
  - `load` resets everything.

  Pins §4 "In memory, never re-derived" on the JS side.
- `app/src/device/build.test.js`, `describe('the fixture (reader.engine)')`
  extended:
  - both fixtures are written, with `book`;
  - each `table` deep-equals `fillDefaultShapes` over its book;
  - each `expected.sheets` holds 12 offsets per song with no `pending` shape
    and `expected.held.misses === 0` (§4.1 "no misses" against the fill);
  - the choro songs parse with no diagnostic;
  - the example fixture's `expected.setlist` lists the set's playable items.

**unit (`go test`, `remarkable/internal/engine/engine_test.go`)**

These use small synthetic bundles the tests write into `t.TempDir()`, each
with a correct manifest unless the case says otherwise:

- `TestOpenRefusesOtherHostAPI`: a manifest with `hostApi: 2` →
  `ErrHostAPI`. A manifest saying 1 over a bundle whose `estante.hostApi` is 2
  → `ErrHostAPI`. (Note: a bundle of another hostApi refused.)
- `TestOpenRefusesBadBundle`: each of these gives its own error:
  - a SHA-256 mismatch;
  - a missing manifest;
  - a missing bundle file;
  - no `globalThis.estante`;
  - a salt mismatch;
  - a bundle that throws on evaluation.
- `TestRuntimeHasNoHostGlobals`: a synthetic bundle reports `typeof` of
  `console`, `require`, `setTimeout`, `fetch` and `process`; all are
  `"undefined"`. Pins the engine adding nothing beyond the bundle's polyfills.
- `TestCallErrorCarriesNoArguments`: a bundle whose `sheet` throws. The error
  names `sheet` and the exception, and does not contain the text passed in, a
  marker string. Pins §10 "no song text".
- `TestCancelInterrupts`: a `sheet` that loops forever, under a 50 ms context,
  returns `context.DeadlineExceeded`. The next call is answered.
- `TestCallsAreSerialised`: 32 goroutines calling a counting bundle all get
  answers, and the bundle saw no overlap (a re-entrancy flag in the JS).
- `TestClose`: after `Close`, calls return `ErrClosed`, and `Close` is
  idempotent.
- `TestLoadSameIsNoop`: with a bundle counting `load` calls, the same entry and
  table twice → one JS `load`; a changed table → a second.

**integration (`go test`, `remarkable/internal/engine/bundle_test.go`, the §9 row)**

These use the **built** `../../../app/dist/device` and
`../../../app/dist-test/device/*.default-shapes.json`. A missing build fails
with "run npm run build in app/". It does not skip, because the gate always
builds first.

- `TestBuiltBundleOpens`:
  - `Open` succeeds;
  - `Manifest()` has hostApi 1 and the fixture's salt;
  - `estante.salt` agrees.
- `TestExampleBookTwelveKeys` and `TestChorosTwelveKeys`, one subtest per song
  × offset:
  - `Load(entry, table)` answers as `expected.load` (`held` equal to the
    table's size);
  - each `Sheet` has no error and `offset == k`;
  - its JSON deep-equals the Node oracle's `expected.sheets` entry (goja reads
    as Node does, the §4 "no port");
  - no shape is `pending`;
  - after all keys, `Misses` is empty and `Held` equals `expected.held`.

  Pins the note's "no misses at all twelve keys" and §4.1.
- `TestEveryHostCall`:
  - `Load`, `Sheet` (with `TargetKey` for a song in C asked in D, offset 2,
    workflow 12 §The key), `Setlist` (the example set; equals
    `expected.setlist`), `Misses` and `Held` each answer;
  - with a null table, every default is `pending`, and `Misses` lists each
    chord once;
  - an unreadable text gives `ErrUnreadable`.

  Pins "every host call answered" and, since the engine adds no globals,
  "nothing missing from the polyfills".
- `TestMemoReturnsSameRebuiltShape`:
  - after `Load`, read a choro at offset 5, then `Held` → `rebuilt` r;
  - read it again at offset 5: diagram models byte-equal, `rebuilt` still r,
    `songs` unchanged;
  - read at offset 6: `rebuilt` grows by at most the chords new to that key;
  - a same-table `Load` keeps `held` (Go-level no-op);
  - a `Load` of a different table (the example book's) resets it.

  Pins the note's unit case "the memo returns the same rebuilt shape" through
  the real bundle. It lives with the integration tests because only the real
  bundle has the memo. That is a sharpening, not a dropped level: the unit
  file pins the Go side of the same promise (`TestLoadSameIsNoop`).

**unit (`go test`, `remarkable/cmd/estante-reader/main_test.go`)**

- `TestUsage` updated to the three-command usage line.
- `TestSheetCommand`: `run(["sheet","--bundle",…,"--shapes",<example fixture>,"--key","2",<the-ferry-line>])`
  exits 0. Its stdout parses as JSON with title "The Ferry Line" and offset 2,
  and stderr is empty.
- `TestSheetCommandErrors`: a missing song file exits 1 with a stderr line not
  containing any song text. Bad flags exit 2.
- `TestBenchCommand`: `--rounds 1` over the example book exits 0. Stdout has
  the six §4.2 labels, and neither stdout nor stderr contains any song's title.

**The gate:** the three cross-builds link the engine (no new step; the existing
`scripts/gate:336-344`).

No behavior/e2e levels: there is no UI and nothing served. The frontend's
harness is `reader.qml_harness`, and the served payload is `reader.payload`'s.

Deferred work: none.

## Decisions

1. **One owner goroutine with a request channel, not a mutex around the
   runtime.**
   - The design says "owned by one goroutine" (§3.2).
   - A mutex would let goja run on whichever goroutine holds it. goja
     tolerates that, but then `Interrupt` and its later `ClearInterrupt`
     interleave with callers.
   - The channel makes cancellation and later priority (`reader.missed_shapes`'s
     low-priority search can add a second, lower queue) local to one loop.
2. **JSON across the boundary, not `ExportTo` / `ToValue`.**
   - The bundle already promises JSON-shaped values (bundle.md Decision on
     plain data).
   - Stringifying in goja and unmarshalling in Go avoids goja's field-name
     mapping, and the protocol forwards rows and diagrams as raw JSON anyway.
   - Measured cost is small next to the parse. `bench` will show it.
3. **`Load` is a no-op for the same entry and table.** `estante.load` clears
   the memos, so a careless re-load on every sync would defeat §4. Keeping the
   digest in Go is the cheapest guard. The alternative, leaving it to callers,
   spreads the rule over `reader.sync` and the screens.
4. **Refusals are sentinels, and `Open` never half-starts.**
   - `reader.self_update` needs to tell "this bundle is not for me" from "this
     bundle is broken", to keep the last good one (§8).
   - A failed `Open` stops its goroutine before returning.
5. **A Node oracle in the fixture, from the built bytes.**
   - The note's integration test needs more than "no error": goja must read as
     the browser's engine does.
   - Evaluating the same built IIFE in `node:vm` at build time and recording
     its answers makes "no port" checkable byte for byte from Go.
   - Alternatives:
     - golden files committed to `remarkable/testdata`: they go stale on every
       music change;
     - running Node from `go test`: it adds a Node dependency to the Go module's
       tests.
   - The oracle is gitignored with the fixture and rebuilt by every
     `npm run build`.
6. **`held()` joins host API 1, rather than timing or a Go-side memo.**
   - The memo lives in the bundle (bundle.md Decision 4).
   - Timing-based checks would be flaky.
   - A second, Go-side sheet memo would duplicate the bundle's, and would have
     to know which shapes were pending.
   - A read-only count call is additive. `host-api.js` allows that until
     `reader.payload` serves a payload, and `bench` reports it too.
7. **The choro book lives in `app/src/device/fixtures/choros/`.**
   - Its table must come from the Worker's own fill, which runs in Node at
     build time, so the texts must sit where `buildDevice` reads them.
   - Under `remarkable/testdata` the app's build would reach into the reader's
     tree.
   - The fixture's `book` field tells the Go test where to read the texts.
8. **The integration test fails, not skips, without a build.** The closer
   refuses skipped tests, and the gate builds the app first
   (`scripts/gate:328-333`). A skip would hide a missing bundle.
9. **`--version` unchanged.** module.md Decision 3 left it to this task. The
   host API is `engine.HostAPI`, a constant `reader.self_update` reads in code.
   Printing it adds nothing a caller needs now.
10. **goja at the cached pseudo-version, with `go 1.26.0`.** It is the version
    the spike-era measurements and the module cache hold. An older goja to stay
    on 1.25 would buy nothing, since 1.26 is already used locally.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-01.

- The engine: `remarkable/internal/engine/engine.go` — one goja runtime owned by one goroutine, `Open` checks the bundle and manifest and refuses with typed errors, JSON across the boundary, `Load` a same-table no-op, cancellation and `Close` interrupt a call in flight; `engine.HostAPI` constant.
- `held()` added to host API 1 in `app/src/device/entry.js` (tests in `entry.test.js`), with `app/src/device/build.js`, `build.test.js` and `app/scripts/build-device.js` updated so the fixture carries it.
- Choro fixtures: `app/src/device/fixtures/choros/` (README + 4 songs) and both default-shape fixtures, with the Node oracle built from the bundle's bytes; goja matches it on all 84 song × key reads.
- CLI: `estante-reader sheet` and `bench` in `remarkable/cmd/estante-reader/main.go` (tests in `main_test.go`); `remarkable/README.md` and `docs/remarkable-reader.md` §4 (`held()` row) updated.
- Tests: `remarkable/internal/engine/engine_test.go` (the named unit tests, `TestSheetUnreadable`, `TestCloseInterruptsACallInFlight`) and `bundle_test.go` (built bundle opens, example book and choros at twelve keys, every host call, memo returns the same rebuilt shape).
- `remarkable/go.mod` moves to go 1.26.0 with goja (`go.sum` added); `.github/workflows/gate.yml` adds a second setup-go step from `remarkable/go.mod` because setup-go exports `GOTOOLCHAIN=local`.
- Found: flat-rooted dim7 chords (`F°`, `Bb°`, `Ab°`, `Db°`) throw `Bad accidental: -3` in the reading view; the choros use `Fdim`/`Bbdim`. Registered as `music.dim7_flat_root_spelling`.

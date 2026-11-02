# reader.module — The reader's Go module, in the gate and in DIRECTION

## TaskJuggler entry

`tasks/85-reader.tji`, `task module` under `task reader` →
`reader.module`. Milestone: `milestones.m7_reader`
(`tasks/99-milestones.tji` L58–61).

## Effort estimate

0.5d.

## Repository

Not under `cifra.md/` (the note does not start with `cifra.md:`). The work
lands in:

- `remarkable/` — new, at the repository root: `go.mod`, `README.md`,
  `cmd/estante-reader/` (`main.go`, `main_test.go`).
- `scripts/gate` — the reader's checks and its three cross-builds.
- `.github/workflows/gate.yml` — `remarkable/go.mod` added to the Go cache's
  `cache-dependency-path` (L48–51).
- `docs/DIRECTION.md` §3.6 — the components table gains the reader (the
  note asks for this; it is the task's own deliverable, not a design delta
  this refinement makes).

## Inherited dependencies

None in the `.tji` (`module` has no `depends`). Settled context:

- `reader.bundle` (complete 100) — `npm run build` in `app/` writes
  `app/dist/device/` (`bundle.<hash>.js`, `manifest.json`, and the
  default-shape fixture). This task only orders the gate so that the app's
  build has run before `remarkable/`'s tests; nothing here reads the bundle
  yet (that is `reader.engine`).
- `reader.key_without_property` (complete 100) — unrelated to this task.

Downstream: `reader.engine`, `reader.protocol`, `reader.store`,
`reader.qml_harness` all `depends !module`; they add packages under
`remarkable/internal/` and subcommands to `cmd/estante-reader`.

## What this task is

Stand up `remarkable/` as its own Go module with one command,
`cmd/estante-reader` — the binary AppLoad will run as the app folder's
`backend/entry` — that for now answers `--version` and refuses anything
else with a usage line. Put the module in the gate: `go vet`, `go test`
and `go build` after the app's checks, then cross-builds for linux/amd64,
linux/arm (GOARM=7, the reMarkable 2) and linux/arm64 (the Paper Pro), all
with `CGO_ENABLED=0`, so a change that breaks an ARM build fails the gate.
Name the reader as a component in DIRECTION §3.6.

## Why it needs to be done

Every other Go part of the reader (engine, protocol, store, sync, the app
folder, the payload) lands inside this module and is only checked if the
gate runs it. The cross-builds are the only guard that the binary keeps
building for the two devices: the tests run on amd64 only, and goja,
go-git and `unixpacket` sockets all have per-architecture code paths that a
dependency bump could break silently. DIRECTION §3.6 is the list of
components and what each is written in; a fourth client-side component
that it does not name contradicts it.

## Inputs / context

- `docs/remarkable-reader.md`
  - §3.1 (L172–183): `remarkable/` is "a Go module (`cmd/estante-reader`,
    `internal/…`) and its QML frontend (`remarkable/qml/`)"; it "shares no
    code with `service/` (DIRECTION §3.6)", agrees with the service through
    `api/openapi.yaml`, and runs the app's code only as the built bundle —
    "bytes it loads, never source it imports".
  - §3.2 (L185–199): the backend's four parts (protocol, sync, store,
    engine) — the `internal/` packages later tasks add.
  - §9 (L407–422): the test table, and "The gate runs `remarkable/`'s
    checks after the app's (whose build makes the bundle), and cross-builds
    the backend for amd64 (the tests' host), armv7 (the rM2) and arm64 (the
    Paper Pro)". The Dockerfile stage it mentions is `reader.payload`'s.
- `docs/DIRECTION.md` §3.6 (L302–319): the components table (L304–312) and
  "The app and the service share no code" (L314).
- `scripts/gate`
  - `go_checks()` (L159–182): `go vet ./...`, `go test -p "$JOBS" ./...`,
    `go build -p "$JOBS"` into `$TMP/bin/`, skipped while a module has no
    packages. Reused as is.
  - the app's checks (L303–307), the example book (L315–324), the API's Go
    checks (L335–339), the service's (L354–358, after the stack comes up).
- `service/go.mod` (`module estantedecifras.app/service`, `go 1.25.0`),
  `api/go.mod` (`estantedecifras.app/api`, `go 1.25`) — the module naming
  and Go version this repository uses; CI's `setup-go` pins Go from
  `service/go.mod` (`.github/workflows/gate.yml` L44–51).
- Sibling refinement `tasks/refinements/reader/bundle.md` — the bundle's
  manifest carries its own `version` (the bundle's short hash, its
  Decisions 6) and `hostApi`; neither is this binary's version.

## Constraints / requirements

- **Its own module**, `module estantedecifras.app/remarkable`, `go 1.25.0`
  (the service's line, so CI's one `setup-go` serves both). No `require`
  of `estantedecifras.app/service` and no `replace` pointing into
  `service/` or `app/` — DIRECTION §3.6, design §3.1. Standard library
  only for this task: no `go.sum` needed until a later task adds goja or
  go-git.
- **CGO-free.** Every build in the gate runs with `CGO_ENABLED=0`; the
  devices have no matching C toolchain and the binary must be static.
- **Bounded parallelism** (the user's standing rule): every `go` command
  the gate adds passes `-p "$JOBS"`; nothing runs unbounded.
- **Binaries never in the tree**: cross-builds go to `$TMP/reader/<arch>/`
  like `go_checks` writes to `$TMP/bin/`.
- **Skip only while absent**: the reader block is guarded by
  `remarkable/go.mod` and says `SKIP … does not exist yet` otherwise, like
  every other block; once present, a failure fails the gate.
- **Order**: the reader block runs after the app's checks (and the example
  book), before the e2e stack is brought up — it needs no stack yet. The
  later "Integration (stack)" tests (design §9) are `reader.sync` /
  `reader.pairing`'s concern and may move or extend this block then.
- **The command's surface** stays small and extensible: `main` calls
  `run(args []string, stdout, stderr io.Writer) int` and exits with its
  result, so later tasks add subcommands (`sheet`, `bench` in
  `reader.engine`; the AppLoad entry in `reader.app_folder`) as cases of
  one dispatch and test them without a process.
- **No song text, no secrets in output** — nothing to print yet beyond the
  version; the rule is stated so the dispatch's usage/error paths start
  that way.

## Acceptance criteria

### Behavior delivered

1. `remarkable/go.mod` as above; `remarkable/README.md` — two short
   paragraphs: what the directory is (the reMarkable reader: the Go backend
   and, to come, its QML), that it shares no code with `service/` and runs
   the app's music code only as the built bundle, and a link to
   `docs/remarkable-reader.md` (`reader.install` later adds the pointer to
   `INSTALL.md`).
2. `remarkable/cmd/estante-reader/main.go`:
   - `var version = "dev"`, overridable at link time with
     `-ldflags "-X main.version=<v>"` (`reader.payload` stamps it).
   - `estante-reader --version` (and `-version`) prints exactly
     `estante-reader <version>\n` to stdout and returns 0.
   - no argument, or any other argument, prints one usage line naming the
     known subcommands (today only `--version`) to stderr and returns 2.
3. `scripts/gate`, after the example-book block:
   ```
   if [[ -f remarkable/go.mod ]]; then
     (cd remarkable; go_checks "estante reader")
     # cross-builds, each CGO_ENABLED=0 GOOS=linux, -p "$JOBS":
     #   amd64; arm with GOARM=7; arm64
     #   go build -o "$TMP/reader/<arch>/" ./cmd/...
   else
     skip "estante reader: remarkable/go.mod does not exist yet"
   fi
   ```
   each cross-build announced with `step "estante reader: cross-build
   linux/<arch>"`, and the file's header comment (L9–29) updated to name
   `remarkable/` among what the gate verifies and where `go test` runs.
4. `.github/workflows/gate.yml`: `estante-de-cifras/remarkable/go.mod`
   added to `cache-dependency-path`.
5. `docs/DIRECTION.md` §3.6: a row after **The admin tool**:
   `| **The reader** | Go, QML | this repository, `remarkable/` | A
   read-only client for a reMarkable, run by AppLoad: a Go backend that
   syncs with go-git and runs the app's built music bundle in goja, and a
   QML frontend that draws (docs/remarkable-reader.md). |`, and the
   sentence after the table extended so it is plain the reader shares no
   code with the service either — it agrees with it through the API
   contract and runs the app's code only as a built bundle.

### Tests it lands with

- **unit** — `remarkable/cmd/estante-reader/main_test.go` (run by the
  gate's `go test` in the reader block):
  - `TestVersion` — `run([]string{"--version"}, …)` writes
    `estante-reader dev\n` to stdout, nothing to stderr, returns 0; same for
    `-version`.
  - `TestUsage` — no argument and an unknown argument (`frobnicate`) each
    return 2, write the usage line to stderr and nothing to stdout.
  - `TestBuiltBinaryAnswersVersion` — the note's "the command builds and
    answers --version": `go build` (found with `exec.LookPath("go")`,
    `CGO_ENABLED=0`, `-ldflags "-X main.version=test"`) into `t.TempDir()`,
    then the binary run with `--version` prints `estante-reader test`;
    pins that the command links and that the link-time version stamp
    `reader.payload` relies on works.
  - `TestModuleSharesNoCode` — reads `../../go.mod` and fails on any
    `require` or `replace` naming `estantedecifras.app/service` or a path
    into `service/` or `app/` (design §3.1, DIRECTION §3.6).
- **the gate's three cross-builds** — `CGO_ENABLED=0 GOOS=linux` with
  `GOARCH=amd64`, `GOARCH=arm GOARM=7`, `GOARCH=arm64`, each of
  `./cmd/...`; a failure fails the gate (design §9). The closer checks the
  three `cross-build linux/…` steps appear in the gate output.

No behavior, e2e-api or e2e-web level: the task delivers a module, a
command with one flag and gate wiring; there is no component with
collaborators and nothing on the stack (Decisions 4).

Deferred work: none.

## Decisions

1. **Module path `estantedecifras.app/remarkable`.** Matches
   `estantedecifras.app/service` and `estantedecifras.app/api`.
   Alternative `github.com/ruoso/estante-de-cifras/remarkable`: no other
   module here uses a forge path, and the reader is never imported from
   outside.
2. **A `run(args, stdout, stderr) int` seam, not a CLI library.** One flag
   today and a handful of subcommands later (`sheet`, `bench`, the AppLoad
   entry whose argv[1] is a socket path, not a flag); `flag`/a switch
   handles that, and a dependency like cobra would add weight to a binary
   that runs on a 1 GB, two-core device. The seam lets each later
   subcommand be unit-tested in process.
3. **`version` stamped at link time, default `dev`.** The bundle's
   `version` is the bundle's hash (bundle.md Decisions 6) and says nothing
   about the backend; `runtime/debug.ReadBuildInfo`'s VCS stamp is absent
   under `go test` and in a Docker build without `.git`. `-X main.version`
   is what `reader.payload`'s Dockerfile stage can set deterministically.
   `--version` does not print the host API: which `hostApi` the backend
   speaks is the engine's constant (`reader.engine`), added to this output
   there if wanted.
4. **No behavior/e2e level.** The note's `Tests:` names unit and the
   cross-builds; there is nothing in-process to integrate and nothing the
   stack serves to the reader yet. The design's "Integration (stack)" row
   belongs to `reader.sync` and `reader.pairing`, which name their e2e-api
   tests.
5. **The reader block before the stack, after the example book.** The note
   asks for "after the app's checks, so the built bundle exists"; putting
   it before `stack_up` keeps a reader failure fast and independent of
   Docker. Alternative: beside the service after the stack — rejected
   until a reader test actually needs the stack.
6. **Cross-build `./cmd/...` only, not `go vet` per architecture.** A
   build compiles every package the command imports, which is everything
   that ships; vetting three times triples the cost for the same
   architecture-independent findings. Test packages are not cross-built
   (they run on amd64 only, design §9).
7. **`GOOS=linux` set explicitly** even on the Linux gate, so the
   cross-builds mean the same thing on a developer's macOS.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-01.

- `remarkable/go.mod` (`estantedecifras.app/remarkable`, go 1.25.0, standard library only) and `remarkable/README.md`.
- `remarkable/cmd/estante-reader/main.go`: `run(args, stdout, stderr) int` seam; `--version`/`-version` prints `estante-reader <version>` (link-time stampable `version`), anything else prints usage and returns 2.
- `remarkable/cmd/estante-reader/main_test.go`: `TestVersion`, `TestUsage`, `TestBuiltBinaryAnswersVersion`, `TestModuleSharesNoCode`.
- `scripts/gate`: reader block after the example book (`go vet`, `go test`, `go build`) plus CGO-free cross-builds for linux/amd64, linux/arm (GOARM=7) and linux/arm64; header comment updated.
- `.github/workflows/gate.yml`: `remarkable/go.mod` added to the Go cache path.
- `docs/DIRECTION.md` §3.6: the reader added to the components table; the no-shared-code sentence extended.
- No behavior, e2e-api or e2e-web tests (Decisions 4). No tech debt.

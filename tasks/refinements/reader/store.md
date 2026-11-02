# reader.store — The reader's store and its own state

## TaskJuggler entry

`reader.store` in [`tasks/85-reader.tji`](../../85-reader.tji) (the `task store`
block inside `task reader`), a dependency of `milestones.m7_reader`
([`tasks/99-milestones.tji`](../../99-milestones.tji) L58–61).

## Effort estimate

1d.

## Repository

Not under `cifra.md/`. The work lands in the reader's Go module:

- `remarkable/internal/store/` — new package: `store.go` (the root, its layout,
  atomic writes), `session.go`, `state.go`, `bundle.go`, and their `_test.go`
  files beside them.

No change to `cmd/estante-reader` (no subcommand needs the store yet), to
`internal/engine` or to `internal/protocol`. No new module dependency: the
standard library only.

## Inherited dependencies

- `reader.module` — **settled** (`complete 100`; see
  `tasks/refinements/reader/module.md` Status): the module
  `estantedecifras.app/remarkable`, `go vet` / `go test -p "$JOBS"` / the three
  CGO-free cross-builds in `scripts/gate` (L328–346, `go_checks` L165–183). A
  new package under `internal/` is picked up by `./...` with no gate change.

Not a dependency but read for continuity (both **settled**, `complete 100`):
`reader.protocol` (the payload types the state mirrors) and `reader.engine`
(`engine.Open(dir)`, which the bundle slots feed).

## What this task is

The reader's one place on disk. A package that owns
`/home/root/.local/share/estante/` and everything under it: the session
the device syncs with (mode 0600), where the home book and each book's clone
live, the current bundle with its manifest and the last good one beside it, and
the reader's own state — the key chosen for a song, the place in a setlist,
whether shapes are shown, and the voicings hidden because they are known. Every
write is atomic, so a crash or power loss mid-write leaves the previous state,
and everything reads back after the backend restarts. It holds no git, no
HTTP and no music: sync, pairing and self-update use its paths and its
writes. It never writes to the account.

## Why it needs to be done

The reader is read-only toward the account (docs/remarkable-reader.md §5.4),
so everything the person does at the stand has to be kept on the device or it
is gone on the next launch — and AppLoad starts and stops the backend often.
Downstream:

- `reader.song_screen` keeps the key chosen, the hidden voicings and
  shapes shown/hidden through it (`key`, `hideShape`, `showShape`,
  `showAllShapes`, `shapesShown` messages, design §6).
- `reader.play` / `reader.browse_screens` keep and read the place in a setlist
  (`place`, and `setlist.at` for Back) and the hidden count for Settings.
- `reader.sync` reads the session and clones into the store's book paths.
- `reader.pairing` writes the session (mode 0600) and, on *Sign out*, clears
  the device.
- `reader.self_update` stages a new bundle, promotes it on attach, and rolls
  back to the last good one.

## Inputs / context

- `docs/remarkable-reader.md`
  - §3.2 (L185–199): the backend's four parts; **store** — "the device's files
    under `/home/root/.local/share/estante/`: the session (mode 0600), the
    clones, the current bundle and its manifest, and the reader's own small
    state (§5.4)".
  - §2.1 step 6 (L136–139): the synced books and state are in that directory,
    "removed by *Sign out* or by hand".
  - §5.1 (L270–288): the session comes from pairing, is the account's, read-only
    by scope, revocable.
  - §5.4 (L310–317): the reader's own state; the device's key overrides the
    saved transposition "until another is chosen, or *As written*".
  - §6 (L319–370): the message table — `key { offset }` with `null` as *As
    written*, `hideShape`/`showShape { tuningId, chord, frets }`,
    `showAllShapes`, `shapesShown { shown }`, `place { bookId, setlist, at }`;
    `state.shapesShown`, `setlist.at`, `settings.hiddenShapes`.
  - §8 (L410–425): the bundle "kept beside the last good one", switched on the
    next frontend attach; one that fails to evaluate dropped, the last good
    kept.
  - §10 (L452–459): session mode 0600 under root's home; no song text, title,
    label or shape in a log.
- `docs/workflows/19-remarkable-reader.md` §A song (L179–285): a key chosen
  "stays on this reMarkable, for this song, until another is chosen or *As
  written*"; what is hidden is "this chord in this voicing on this tuning: the
  frets, not the name"; *Hide shapes* is "kept on this reMarkable for every
  song". §The shelf L150–152: *Sign out* — "Your books are removed from it;
  nothing changes in your account."
- `remarkable/internal/protocol/messages.go`: `Key { Offset *int }` (L94–96),
  `Voicing { TuningID, Chord, Frets string }` (L109–113; `Chord` the engine's
  shape key, already spelling-independent; `Frets` e.g. `"x45320"`),
  `ShapesShown` (L125–127), `Place { BookID, Setlist string; At int }`
  (L130–134).
- `remarkable/internal/engine/engine.go`: `Open(dir string)` (L221) reads
  `manifest.json` (`ManifestFile`, L48) and the bundle it names from one
  directory — so a bundle slot is a directory.
- `api/openapi.yaml` L1069–1072: `Id` is "an opaque, server-assigned
  identifier" (a `bookId` is not guaranteed to be a safe path element).
- Sibling refinements `module.md`, `protocol.md`, `engine.md`: the package logs
  nothing; errors name the call or class, never payload bytes; refusals are
  exported sentinels for `errors.Is`; tests beside the code with `t.TempDir()`.

## Constraints / requirements

- **Standard library only**, CGO-free, cross-builds for amd64, armv7, arm64
  (module.md). Shares no code with `service/` or `app/`.
- **Writes nothing the account holds** and makes no network call (§5.4).
- **Atomic writes.** Every file the store writes goes through one helper:
  write a temporary file in the same directory (`os.CreateTemp`, given the
  final mode before any byte is written), `Sync`, close, `os.Rename` over the
  target, then `Sync` the directory. A failure at any step removes the
  temporary and leaves the previous file untouched. Temporaries left by a
  crash (`.tmp-*`) are ignored by every read and removed by `Open`.
- **Modes.** The root and every directory the store makes are 0700; the
  session file 0600 (§10), checked by the test; the state file 0600 too (it is
  the person's, and costs nothing). The temporary carries the final mode, so
  the secret is never briefly world-readable.
- **No song text, no secret in an error or a log.** The package logs nothing;
  errors name the file's role (`session`, `state`, `bundle`) and the
  operation, never the session token or a stored value.
- **Versioned, tolerant JSON.** Each file is JSON with `"version": 1`; unknown
  fields are ignored on read (as the protocol does), so a newer reader's file
  does not break an older one; a file with a higher `version` reads as absent
  rather than misread.
- **Concurrency.** One `*Store` per process, safe for use from the backend's
  message loop and the sync goroutine: a mutex around the in-memory state, and
  each mutation persists the whole state file before it returns.
- **Book paths are safe.** A `bookId` becomes a directory name only through
  one function that refuses anything that is not a single, local path element
  (`filepath.IsLocal`, no separator, not `.`/`..`) with `ErrBadID`.

## Acceptance criteria

### Behavior delivered

`remarkable/internal/store`:

- `const DefaultRoot = "/home/root/.local/share/estante"`;
  `Open(root string) (*Store, error)` makes the root (0700) when absent,
  removes stray temporaries, reads the session and the state, and recovers the
  bundle slots (below). `Root()` returns it.
- **Layout** under the root:
  ```
  session.json          the session, 0600
  state.json            the reader's own state, 0600
  home/                 the home book's clone
  books/<bookId>/       each book's clone
  bundle/current/       manifest.json + bundle.<hash>.js, as engine.Open reads
  bundle/previous/      the last good one
  bundle/next/          staged, switched on the next attach
  ```
- **Session** (`session.go`): `type Session struct { Origin, Token, Account
  string; PairedAt time.Time }` — `Token` the session cookie's value, opaque;
  `Account` what Settings names. `Session() (Session, bool)`,
  `SetSession(Session) error` (written 0600, atomically), `ClearSession()
  error`. An unreadable or future-version session file reads as not paired.
- **Clones** (`store.go`): `HomeDir() string`, `BookDir(bookID) (string,
  error)`, `BookIDs() ([]string, error)` (the clones present, for sync to drop a
  book no longer shared), `RemoveBook(bookID) error`. The store makes the
  parent directories; sync owns what is inside.
- **Reader state** (`state.go`), each mutation persisted before it returns:
  - the key: `Key(bookID, path) (offset int, ok bool)`,
    `SetKey(bookID, path string, offset *int) error` — `nil` is *As written*
    chosen, which forgets the device's choice (protocol `Key`, design §6);
  - the place: `Place(bookID, setlist) (at int, ok bool)`,
    `SetPlace(bookID, setlist string, at int) error` — one place per setlist;
  - shapes shown: `ShapesShown() bool` (true when never set),
    `SetShapesShown(bool) error`;
  - hidden voicings: `Hidden(Voicing) bool`, `HiddenCount() int`,
    `Hide(Voicing) error` (idempotent), `Show(Voicing) error`,
    `ShowAll() error`, where `type Voicing struct { TuningID, Chord, Frets
    string }` matches by all three exactly — the frets, not the name, and the
    chord as the engine keys it (workflow 19 §A song).
  - An unreadable or future-version state file reads as the defaults (nothing
    chosen, shapes shown, nothing hidden); the next mutation replaces it.
- **Bundle slots** (`bundle.go`): `BundleDir() (string, bool)` — the current
  slot, for `engine.Open`, false when none is installed;
  `StageBundle(files map[string][]byte) error` — writes the files into
  `bundle/next/` by way of a temporary directory renamed into place (files
  named by local paths only, `ErrBadID` otherwise); `PromoteBundle() error` —
  `current → previous` (replacing the older previous), `next → current`;
  `RollbackBundle() error` — drops the current and restores `previous →
  current` (`ErrNoPrevious` when there is none); `DropStaged() error`. The
  store checks no hash and evaluates nothing: the manifest's hashes are
  `engine.Open`'s and `reader.self_update`'s. `Open` recovers an interrupted
  promote or rollback: with no `current` and a `previous`, the previous is
  restored; a half-written staging temporary is removed.
- **Sign out**: `SignOut() error` removes the session, `home/`, `books/` and
  the reader's state (§2.1 step 6: "synced books and state … removed by *Sign
  out*"), and keeps the bundle slots (the app's code, not the account's).

### Tests it lands with

**unit (go test, `remarkable/internal/store/`)** — every case on a
`t.TempDir()` root, "a restart" being the `*Store` dropped and `Open` called
again on the same root:

- `state_test.go`
  - `TestKeyRoundTripsAcrossRestart` — a key chosen for one song survives a
    restart; another song has none; `SetKey(nil)` forgets it, also across a
    restart (workflow 19 §A song "until another is chosen or *As written*";
    design §5.4, §6 `key`).
  - `TestPlaceRoundTripsAcrossRestart` — the place in two setlists, each kept
    (design §6 `place`, `setlist.at`).
  - `TestShapesShownRoundTripsAcrossRestart` — default shown; hidden survives
    a restart (workflow 19 §A song *Hide shapes*).
  - `TestHiddenVoicingsRoundTripAcrossRestart` — hide, count, show one, show
    all, each read back after a restart; hiding twice counts once.
  - `TestHiddenMatchesFretsNotName` — the same chord at other frets, or on
    another tuning, is not hidden (workflow 19 §A song "the frets, not the
    name").
  - `TestUnreadableStateReadsAsDefaults` — a garbage `state.json`, and one of
    `version: 2`, read as the defaults; the next mutation writes a good file.
  - `TestUnknownStateFieldsIgnored` — a file with an extra field reads.
- `store_test.go`
  - `TestTornWriteLeavesPreviousState` — with the write helper failing after
    the temporary is partly written (an injected writer that errors mid-way)
    and again at the rename, the call returns an error, `state.json` and
    `session.json` hold the previous content, and no temporary remains; a
    `.tmp-*` left in the root by a "crash" is ignored by reads and removed by
    `Open` (the task's "a torn write leaves the previous state").
  - `TestOpenMakesRootPrivate` — a fresh root and the directories under it are
    0700.
  - `TestBookDirRefusesUnsafeIDs` — `""`, `.`, `..`, `a/b`, `../x` refused with
    `ErrBadID`; a plain id gives `books/<id>`.
  - `TestBookIDsAndRemoveBook` — the clones present listed; one removed.
  - `TestSignOutClearsTheDevice` — session, `home/`, `books/` and state gone,
    bundle slots kept; a restart reads not paired and defaults (§2.1 step 6;
    workflow 19 §The shelf *Sign out*).
- `session_test.go`
  - `TestSessionFileMode` — `session.json` is 0600 after `SetSession`, and
    after a second `SetSession` over a file made 0644 by hand (design §10).
  - `TestSessionRoundTripsAcrossRestart` — set, restart, read; clear, restart,
    not paired.
  - `TestUnreadableSessionIsNotPaired`.
  - `TestStoreErrorsCarryNoToken` — a failing `SetSession` (root made
    read-only) returns an error whose text does not contain the token
    (design §10, standing rule).
- `bundle_test.go`
  - `TestStagePromoteRollback` — stage A, promote (current A); stage B,
    promote (current B, previous A); rollback (current A); a second rollback
    `ErrNoPrevious`; each read back after a restart (design §8).
  - `TestPromotedBundleOpensInEngine` — a manifest and bundle staged and
    promoted, then `engine.Open(BundleDir())` succeeds — the test writes its own minimal
    `globalThis.estante` host (hostApi 1, a salt) and a manifest carrying its
    SHA-256, as `internal/engine/engine_test.go` L22–66 does (test helpers do
    not cross packages, so it keeps its own copy), so it needs no app build.
  - `TestOpenRecoversInterruptedPromote` — a root with `previous/` and no
    `current/` restores it on `Open`; a stray staging temporary is removed.
  - `TestStageRefusesNonLocalNames` — `../x`, `/abs` refused with `ErrBadID`.

No behavior, e2e-api or e2e-web level: the note names unit only, and the store
is a pure on-disk module with no collaborator but the filesystem; the screens
that drive it test it through their own behavior tests
(`reader.song_screen`, `reader.browse_screens`), and sync's e2e-api uses its
paths (`reader.sync`).

Deferred work: none.

## Decisions

1. **One `state.json` for the reader's own state, a separate `session.json`.**
   The state is small (a key per song touched, a place per setlist, a few
   hundred voicings at most) and rewriting it whole on each change is
   microseconds on the rM2; one file means one atomic rename and no partial
   state across files. The session is apart because it is a secret with its
   own lifecycle (pairing, sign-out) and is read by sync, never by a screen.
   Rejected: a file per piece (more renames, states that can disagree);
   an embedded database (bbolt or SQLite — a dependency, and SQLite breaks
   CGO-free).
2. **Atomicity by temp-file, fsync, rename, directory fsync** — the standard
   POSIX recipe, on the rM2's ext4. The temporary is created with the final
   mode so the session is never readable by others even for a moment. Rejected:
   write-in-place with a backup copy (a torn write is then possible and needs
   recovery logic); a journal (more than this state needs).
3. **The key is kept per `(bookId, path)` as a signed offset, `nil` forgets
   it.** That is exactly the protocol's `key { offset }` and design §5.4's
   "until another is chosen, or *As written*": *As written* is not stored as
   offset 0 but as no choice, so the song opens at the account's saved key
   again (design §5.4: the saved transposition is where a song opens). The
   store does not normalise the offset — the engine owns music. A song moved
   or renamed in its book loses the device's choice; acceptable, as the choice
   is a convenience the account does not hold.
4. **One place per setlist**, not one global "last place": `setlist.at` is
   per setlist (design §6, 106), and Back from a song returns to the setlist
   it was played from.
5. **A hidden voicing is the triple `(tuningId, chord, frets)`, compared
   exactly.** Workflow 19 §A song: "this chord in this voicing on this
   tuning: the frets, not the name". The spelling independence (*C7M* hides
   *Cmaj7*) comes from `chord` being the engine's chord key, not the symbol
   (protocol `Voicing`, messages.go L109–113), so the store needs no music.
6. **Sign out removes the session, the clones and the reader's state, and keeps
   the bundle.** Design §2.1 step 6 says the synced books and state are removed
   by *Sign out*; workflow 19's prompt promises the books are removed. The
   bundle is the site's code, not the account's, and dropping it would leave
   the reader unable to draw until a sync. Alternative — keeping the hidden
   voicings across a sign-out as a device preference — rejected: the design
   says state goes, and a device handed to another person should not carry the
   first one's choices.
7. **Bundle slots are directories `next`, `current`, `previous`, swapped by
   rename.** `engine.Open(dir)` reads one directory (engine.go L221), so a slot
   is one; a rename is atomic per step, and `Open` repairs the one gap a crash
   between the two renames of a promote can leave. The store verifies no hash
   and evaluates nothing — that is `engine.Open`'s (it already checks the
   SHA-256 and `hostApi`) and `reader.self_update`'s choice of when. Only the
   bundle gets slots now: the note scopes "the current and last good bundle";
   the QML's `resources.rcc` lives in the AppLoad folder and its update is
   `reader.self_update`'s to place (it may reuse this slot code for it).
   Rejected: keeping hashes as file names in one directory with a pointer file
   (two writes to agree, and the engine would need a second way in).
8. **Unreadable means absent, never fatal.** A corrupt or future-version
   `state.json` reads as defaults and a bad `session.json` as not paired: the
   reader must open at the stand whatever happened to the disk, and the worst
   case is re-pairing or re-choosing a key. Since writes are atomic this only
   happens through outside damage or a downgrade.
9. **`bookId` used as a directory name only after a local-element check.** The
   API's `Id` is opaque (openapi.yaml L1069–1072); the service makes safe ids
   today, but a store under root's home must not follow a `..` from the
   network. Rejected: hex-encoding every id (safe but makes the clones
   unreadable when debugging by hand over SSH, which §2.1 step 7 invites).
10. **No file lock.** AppLoad runs one backend per app; a second process on the
    same root is not a case the design has. The mutex covers the one
    process's goroutines.
11. **The torn-write test injects the failure** through an unexported seam on
    the write helper (a function value the test replaces), rather than killing
    a process: deterministic, fast, and it exercises the exact cleanup path.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-01.

- remarkable/internal/store/store.go, session.go, state.go, bundle.go: the on-disk store, standard library only, every file written atomically.
- Session kept at mode 0600; home and per-book clone directories, with a local-element check on book ids.
- The reader's state (key, place, shapes shown, hidden voicings by tuning, chord and frets) round-trips across restarts; unreadable state reads as defaults.
- Current/previous/next bundle slots with stage, promote and rollback; Open repairs an interrupted promote; Sign out keeps only the bundle.
- Unit tests (20) in remarkable/internal/store/{store,session,state,bundle}_test.go with helpers_test.go; they ran in the gate's `estante reader: go test`.
- No tech-debt follow-ups.

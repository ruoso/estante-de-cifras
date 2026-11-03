# reader.install — Installing the reader

## TaskJuggler entry

`tasks/85-reader.tji` L163–168, `task install` under `task reader` →
`reader.install`. Milestone: `milestones.m7_reader`
(`tasks/99-milestones.tji` L58–60).

## Effort estimate

1d.

## Repository

Not under `cifra.md/` (the note does not start with `cifra.md:`). The work
lands in `remarkable/`:

- `remarkable/INSTALL.md` — new: the step-by-step guide.
- `remarkable/scripts/install.sh` — new: step 4 over SSH, POSIX `sh`,
  executable.
- `remarkable/scripts/doc.go` and `remarkable/scripts/install_test.go` — new:
  the script's unit tests, a Go package inside the `remarkable` module so the
  gate's `go_checks "estante reader"` (`scripts/gate` L168–186, L337–338) runs
  them with no change to the gate. `doc.go` holds only the package comment
  (what the directory is, and that the tests drive `install.sh`).
- `remarkable/README.md` — a pointer to the guide at the top, and the
  by-hand install paragraph (L116–123) pointing at it.
- `docs/remarkable-reader.md` §2.1 — the design delta below, already edited
  in the working tree; it rides in this task's commit.

## Inherited dependencies

- `reader.payload` (complete 100, settled): the site serves
  `/device/manifest.json` and `/device/estante-armv7.tar.gz`,
  `/device/estante-arm64.tar.gz` under fixed, revalidated names
  (payload.md Decision 3). Each archive is the AppLoad folder rooted at
  `estante/` (`remarkable/tools/payload/payload.go` L240–290), with
  `estante/backend/entry` mode 0755. The manifest is indented JSON
  (`payload.go` L173) with `folder: { armv7: { path, sha256 }, arm64: {…} }`
  (`payload.go` L65–68) — "the manifest's `folder.<arch>.sha256` lets the
  script check what it got" (payload.md Decision 3).
- `reader.app_folder` (complete 100, settled): what the folder holds —
  `manifest.json`, `icon.png`, `resources.rcc`, `backend/entry`
  (`remarkable/README.md` L104–113).
- `reader.pairing`, `reader.pair_web`, `reader.device_pairing` (complete 100,
  settled): what step 5 of the guide describes — *Pair with your account*, the
  code, `estantedecifras.app/pair`, *Pair your reMarkable*, the ten-minute
  code (design §5.1). `pair.DefaultOrigin` is `https://estantedecifras.app`
  (`remarkable/internal/pair/pair.go:32`).
- `reader.self_update` (pending, not a dependency): step 6 of the guide says
  the bundle and the QML update themselves, as design §8 promises. The guide
  describes the design's promise; it does not test it.

## What this task is

A person with a reMarkable 2 fresh out of the box and an Estante account
needs to end up with the reader paired and reading. This task writes the
guide that takes them there, `remarkable/INSTALL.md`, following design §2.1's
seven steps, each with the exact command or the exact place in the tablet's
settings, what it shows when it worked, and what to do when it did not. It
also writes `remarkable/scripts/install.sh`, which does step 4 from a
computer: it asks the tablet its architecture, downloads that folder from the
site, checks it, and swaps it into AppLoad's directory over one SSH
connection, keeping the previous install. `remarkable/README.md` points at the
guide.

## Why it needs to be done

`reader.payload` made the reader downloadable, but nothing tells a person how
to get from the box to a paired reader. xovi, AppLoad, tripletap and the
hashtable are community tools a musician has never heard of. This is the last
leaf before `milestones.m7_reader` ("Reading on a reMarkable") besides
`reader.self_update`. Without it the milestone holds a reader nobody outside
the project can install.

## Inputs / context

- `docs/remarkable-reader.md` §2 (L33–54): the platform. The rM2 is armv7,
  on OS 3.20 or later, with root SSH and no developer mode. The AppLoad
  folder lives at `/home/root/xovi/exthome/appload/<app>/`. AppLoad leaves the
  backend running until `terminate()`. Installing xovi and AppLoad is the
  person's own job.
- `docs/remarkable-reader.md` §2.1 (L56–162): the seven steps, normative. The
  guide is their expansion. "Community tools named here … change between
  releases: the guide links each one's own instructions and says which
  versions it was written against" (L62–64).
- `docs/remarkable-reader.md` §5.1 (pairing), §5.4 (the reader's state in
  `/home/root/.local/share/estante/`), §8 (the payload, and that the backend
  is installed by hand).
- `remarkable/tools/payload/payload.go`: the archive layout (L240–290) and
  the manifest fields (L39–68).
- `remarkable/README.md` L116–123: today's by-hand install paragraph.
- `scripts/gate` L168–186 (`go_checks`: `go vet`, `go test`, `go build` over
  `./...`) and L337–338 (run in `remarkable/`). The gate host has `curl`,
  `tar` and `sha256sum`. `shellcheck` is not installed, so it is not part of
  the gate.
- No QML in the reader calls `terminate()` (`remarkable/qml/`, outside
  `tests/`). An installed reader's backend therefore keeps running, with the
  old binary, until the tablet restarts — unless the script stops it.

## Design delta (this task)

`docs/remarkable-reader.md` §2.1, already edited in the working tree:

- **Step 4, the script**: `aarch64` named for the Paper Pro. The folder is
  checked against the manifest's SHA-256 and copied over one SSH connection.
  The previous install is kept at `/home/root/xovi/exthome/estante.previous/`
  — outside AppLoad's directory, so AppLoad does not list *Estante* twice.
  The previous backend is stopped if it is still running, so the next opening
  starts the new one. The script needs `sh`, `curl` and `tar` on the computer;
  on Windows, use WSL or Git Bash, or install by hand.
- **Step 6, removing it**: the removal command also removes
  `estante.previous`, and going back to the previous install is one `mv`.

## Constraints / requirements

- **The guide is §2.1, expanded — not redesigned.** It has the same seven
  steps in the same order, the same paths, the same copy (*Pair with your
  account*, *Pair your reMarkable*, *Update the reader on your reMarkable*,
  *Sign out*). If writing the guide shows §2.1 is wrong, fix §2.1 in the same
  commit; never let the two disagree.
- **Every step has three parts:** what to do (the exact command in a fenced
  block, or the exact settings path in italics, as §2.1 writes them); what
  it shows when it worked (the prompt, the listing, the screen); and what to
  do when it did not. Step 7 gathers the failures that span steps.
- **Community tools are linked, not re-documented.** For Vellum, xovi,
  AppLoad, qt-resource-rebuilder, xovi-tripletap and the community installer,
  the guide links each project's own page. It gives the commands §2.1 names
  (`vellum add xovi`, `rebuild_hashtable`, the three presses), and states,
  in one place near the top, which version of each it was written against,
  with the date. The guide does not mirror their install scripts and does not
  pipe a remote script into a shell on the person's behalf.
- **The script is POSIX `sh`** (`#!/bin/sh`, `set -eu`), with no bashisms. It
  runs on macOS and Linux, and on Windows under WSL or Git Bash. The test
  runs it with `/bin/sh` (dash on the gate host), which keeps it honest. On
  the computer it needs `ssh`, `scp`, `curl`, `tar`, and `sha256sum` or
  `shasum -a 256`; it fails with a message naming whichever is missing. On
  the tablet it needs only `sh`, `uname`, `mkdir`, `mv`, `rm`, `readlink`,
  `kill` and `/proc` — all present on reMarkable OS. The tablet does no
  `tar`; the folder is unpacked on the computer.
- **Inputs:** `RM_IP` (required; `10.11.99.1` is *not* defaulted silently —
  the error message suggests it for USB). `RM_USER` (default `root`).
  `ESTANTE_ORIGIN` (default `https://estantedecifras.app`, the same default
  as `pair.DefaultOrigin`; set for a local stack, as the reader's `--origin`
  is).
- **One SSH connection.** The first `ssh` opens an OpenSSH control master
  (`-o ControlMaster=auto -o ControlPath=<tmpdir>/cm -o ControlPersist=60`).
  Every later `ssh` and `scp` passes the same `ControlPath`. The script
  closes the master on exit (`ssh -O exit`, from an `EXIT` trap that also
  removes the temporary directory). So the password is asked at most once.
- **What the script does, in order:**
  1. `uname -m` on the tablet: `armv7l` → `armv7`, `aarch64` → `arm64`;
     anything else stops the script, with the machine named and nothing
     downloaded or changed.
  2. It downloads `$ESTANTE_ORIGIN/device/manifest.json` and
     `$ESTANTE_ORIGIN/device/estante-<arch>.tar.gz` with
     `curl --fail --location`. It finds the archive's `sha256` in the
     manifest, without `jq`: the JSON object holding
     `"path": "estante-<arch>.tar.gz"`, whitespace stripped, key order not
     assumed. It refuses a mismatch, or a manifest that does not name the
     archive, with nothing changed on the tablet.
  3. It unpacks the archive on the computer and checks that the result holds
     `estante/manifest.json` and an executable `estante/backend/entry`.
  4. It copies `estante/` with `scp -r` to a staging folder,
     `/home/root/xovi/exthome/estante.new/` — outside `appload/`, so a Reload
     in the middle of the copy never lists a half-copied app.
  5. In one remote `sh` command, it:
     - removes an old `estante.previous`;
     - moves an existing `appload/estante` to `estante.previous`;
     - moves `estante.new` to `appload/estante`;
     - stops (TERM) any process whose `/proc/<pid>/exe` resolves to
       `estante.previous/backend/entry`. Linux rewrites the link when the
       folder is moved, so this finds exactly the old backend and nothing
       else.

     All of these paths are on one filesystem, so each `mv` is a rename.
  6. It prints what it installed (the architecture, the manifest's
     `version`, whether a previous install was kept) and the next step:
     *open AppLoad and press Reload*.
- **No secrets and no song text.** The script prints no password and reads
  nothing of the person's books. It never touches
  `/home/root/.local/share/estante/`: an install or an update keeps the
  pairing and the synced books.
- **No book without an account**: the download is the public payload (the
  reader's code, no books). Everything the reader reads still comes through
  pairing (§5.1).

## Acceptance criteria

### Behavior delivered

- `remarkable/INSTALL.md`: seven numbered sections matching §2.1's steps 1–7,
  each with its commands, what success looks like, and what to do on failure.
  A "written against" list near the top gives the versions and the date. A
  link to `scripts/install.sh` sits in step 4. The by-hand path in step 4 is
  `curl -fLO <origin>/device/estante-armv7.tar.gz`, `tar xzf …`,
  `scp -r estante root@<address>:/home/root/xovi/exthome/appload/`, then
  Reload. Step 4 also covers the Paper Pro (`arm64`, developer mode needed,
  §2 table). Step 6 covers the update, the OS update, going back to the
  previous install, and removal, as the edited §2.1 says. Step 7 covers every
  case §2.1 lists, plus *the script says the download does not match* (try
  again; if it persists, the site is mid-deploy) and *the old version still
  shows in the settings* (close and reopen *Estante*; if it persists, restart
  the tablet and press the power button three times).
- `remarkable/scripts/install.sh` behaves as Constraints says.
- `remarkable/README.md` opens with a line pointing a person who wants to
  install the reader at `INSTALL.md`. The by-hand paragraph names the guide
  as the person's path; the developer's `scp` of a local build stays.

### Tests, by level

**unit** — `remarkable/scripts/install_test.go` (Go, `go test` in the
`remarkable` module, run by the gate's `go_checks "estante reader"`).

The harness:

- It builds the archives with the same layout as `tools/payload`'s
  `archive`: an `estante/` root, a `manifest.json`, an executable
  `backend/entry`, and a marker file whose content names the architecture.
  It serves them from an `httptest.Server` that also serves a
  `manifest.json` naming each with its SHA-256. The test passes that server
  as `ESTANTE_ORIGIN`, and uses the host's real `curl` and `tar`.
- It puts stand-ins for `ssh` and `scp` first on `PATH`: small `sh` scripts
  the test writes into `t.TempDir()`. They append their argv to a log.
  - The ssh stand-in answers `uname -m` with `$FAKE_UNAME`. It runs any other
    remote command with `sh -c`, after rewriting `/home/root` to a fake
    tablet root under `t.TempDir()`. It treats `-O exit` and `-O check` as
    succeeding.
  - The scp stand-in copies to the same rewritten target.
- If `curl`, `tar` or `sh` is missing on the host, the test fails, naming the
  tool; it is never skipped.

The cases:

- `TestInstallArchFromUname` — `armv7l` installs the armv7 folder, and
  `aarch64` the arm64 one (the marker file in
  `<fake>/xovi/exthome/appload/estante/` names the architecture). An unknown
  machine (`x86_64`) exits non-zero, names the machine, makes no request to
  the server, and leaves the fake tablet as it was. Pins design §2.1 step 4
  (`uname -m`) and §2.
- `TestInstallCopiesToAppLoad` — on a fake tablet with no reader,
  `appload/estante/` holds the folder byte for byte, `backend/entry`
  executable, and no `estante.new` is left behind. Pins §2.1 step 4 and §2
  (the AppLoad folder path).
- `TestInstallKeepsPrevious` — on a fake tablet with an older reader (and an
  older `estante.previous`), the older reader is now at
  `<fake>/xovi/exthome/estante.previous/`, the even older one is gone,
  nothing extra appears under `appload/`, and `<fake>/.local/share/estante/`
  is untouched. Pins edited §2.1 step 4 (the previous install kept outside
  AppLoad's directory) and §5.4 (state survives an install).
- `TestInstallStopsPreviousBackend` — the test copies the host's `sleep`
  binary to the fake tablet's `appload/estante/backend/entry` and starts it.
  After the install, that process has exited and the new folder is in place.
  Pins edited §2.1 step 4 (the next opening starts the new backend).
- `TestInstallOneConnection` — every `ssh` and `scp` invocation in the
  stand-ins' log carries the same `ControlPath`. The first carries
  `ControlMaster=auto`, and the last is `-O exit`. Pins the note's "one SSH
  connection reused".
- `TestInstallRefusesBadHash` — the manifest names a different SHA-256, or
  does not name the archive. The script exits non-zero and says the download
  does not match. The fake tablet is unchanged, and the log shows no `scp`.
  Pins payload.md Decision 3 (the manifest lets the script check what it got).
- `TestInstallNeedsAddress` — with no `RM_IP`, the script exits non-zero
  before any `ssh`, and the message names `RM_IP` and `10.11.99.1` (USB).
  `RM_USER` reaches ssh as the login (`<user>@<ip>` in the log).
- `TestGuideAgreesWithScript` — reads `remarkable/INSTALL.md` and
  `install.sh`. The guide has the seven step headings of §2.1 in order, and
  links `scripts/install.sh`. It names the AppLoad path, the
  `estante.previous` path, both archive names and `RM_IP`, each spelled
  exactly as the script spells them. It names `/home/root/.local/share/estante/`
  and `10.11.99.1`. Pins the note's "the guide checked against the script and
  the design's §2.1", as a drift guard on the facts a script change could
  invalidate.

**The guide, step by step** — not a test the gate runs. The closer reads
`INSTALL.md` against `install.sh` and the edited §2.1, step by step, as the
note asks, and records the result in the Status block. Walking it on a real
rM2 is a human's job (see Open questions).

No behavior, e2e-api or e2e-web level. The note names none. The script's
one network peer, the served payload, is already pinned end to end by
`e2e/api/device.test.js` (reader.payload). A device the compose stack cannot
emulate is not something e2e can drive.

## Decisions

1. **The previous install lives at `/home/root/xovi/exthome/estante.previous/`,
   outside `appload/`.** AppLoad lists every folder in its directory. An
   `appload/estante.previous` with its own `manifest.json` would show
   *Estante* twice, and the person could open the old one. The previous
   install sits beside AppLoad's directory, on the same filesystem (so the
   swap is a rename), and survives *Sign out* (which clears
   `.local/share/estante/`). §2.1 is edited to say so.
   - Rejected: under `.local/share/estante/`. *Sign out* removes that, and it
     mixes code with the person's data.
   - Rejected: `/tmp`. It is gone at the first reboot.
2. **The folder is unpacked on the computer and copied with `scp -r`.** The
   tablet then needs nothing beyond the shell's basics, and the copy goes
   through the same command as the guide's by-hand path. The copy lands in a
   staging folder outside `appload/`, then is swapped with renames.
   Rejected: `scp` the `.tar.gz` and `tar xzf` on the tablet. It is one file
   fewer, but it relies on the tablet's `tar` and gzip.
3. **The script checks the archive against the manifest's SHA-256,** found
   with `tr`/`grep`/`sed` over the object that names the archive's path, with
   no key order assumed. payload.md Decision 3 put that hash in the manifest
   for this script. HTTPS covers transport, but not a deploy caught halfway
   between a new manifest and an old cached archive. Rejected: requiring
   `jq` or `python3`. Neither is on a stock macOS or a minimal Linux.
4. **The script stops the old backend by `/proc/<pid>/exe`.** AppLoad keeps a
   backend running until `terminate()`, and no reader screen calls it. So
   without this, a person who updates the backend keeps running the old one
   until a reboot, and §2.1 step 6's "a new backend is installed the same
   way" would silently not take effect. After the rename, the exe link names
   `estante.previous/backend/entry`, which matches exactly the old reader's
   processes.
   - Rejected: `killall entry`. That name is shared by every AppLoad
     backend.
   - Rejected: `pkill -f`. Not guaranteed on the tablet's busybox.
   - Rejected: telling the person to reboot. A reboot means three presses
     and a trip through xovi just to finish an install.
5. **The script's test is Go, in the `remarkable` module, with stand-in
   `ssh`/`scp` and a real `httptest` site.** The gate already runs
   `go test ./...` there, so the test needs no new runner and no gate edit.
   The stand-in ssh runs the script's remote commands for real against a
   fake tablet root, so the test pins what lands on the tablet, not the
   command text.
   - Rejected: bats. It would be a new dependency and a new gate step.
   - Rejected: asserting only the logged argv. That is brittle, and blind to
     a wrong `mv`.
   - Real `curl` against `httptest` covers the download path too (`--fail`,
     the hash check).
6. **`RM_IP` is required, not defaulted to `10.11.99.1`.** A person on Wi-Fi
   who forgets to set it would otherwise get a timeout to the USB address,
   which is confusing. The error message names both the variable and the USB
   address.
7. **The guide's "written against" versions are the upstream releases
   current when it is written,** taken from each project's release page. The
   guide does not promise more than that; §2.1 already says these tools
   change between releases.

## Open questions

(none — all decided)

Surfaced for the human (parking lot, not WBS): the guide can only be checked
here against the script and the design. Walking it on a real reMarkable 2 —
Vellum, xovi, AppLoad, tripletap, the hashtable after an OS update, the
script against the live site — needs a device and a person. The "written
against" versions should be confirmed then.

## Status

**Done** — 2026-11-02.

- remarkable/INSTALL.md: the seven-step guide following docs/remarkable-reader.md §2.1, with versions "written against" taken from GitHub releases on 2026-11-02.
- remarkable/scripts/install.sh: step 4 over one SSH connection (POSIX sh) — asks `uname -m`, checks the SHA-256 against the manifest, stages outside AppLoad's directory, swaps by rename, keeps `estante.previous`, stops the old backend via `/proc/<pid>/exe`; retries once with legacy `scp -O` if SFTP fails.
- remarkable/scripts/install_test.go and doc.go: eight unit tests (arch from uname, copy to AppLoad, previous kept, previous backend stopped, one connection, bad hash refused, address needed, guide agrees with script), run by the gate's `estante reader: go test`.
- remarkable/README.md points at the guide; docs/remarkable-reader.md §2.1 design delta rides in this commit.
- Still for a human: walking the guide on a real reMarkable 2 (parking lot).

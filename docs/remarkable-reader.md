# The reMarkable reader

Status: **design**, 2026-11-01. Decided with the owner the same day: the
three builds (amd64, armv7, arm64), the module at `remarkable/`, a reader that
is **fully read-only**, songs paged rather than scrolled, and the pairing
endpoints of §5.1. Depends on: DIRECTION §3.2, §3.3, §3.6, §3.7;
workflows 2, 7, 12, 13; [`home-book-format.md`](home-book-format.md) §4.6;
[`api/openapi.yaml`](../api/openapi.yaml).

A **read-only Estante client for the reMarkable 2**: the shelf, the books, the
setlists and the songs, read at any key with the shapes of the instrument in
use, kept in sync with the account. It never writes a book or the home book.
It is the third client after the web app and the e2e harnesses, and like them
it speaks only HTTP to the one origin (DIRECTION §3.6).

The printed book (books.print — every song behind a tappable index, saved as a
PDF) is the stopgap this replaces. What a native reader adds is everything the
PDF freezes: a song in another key, the setlist's key, the shapes of the
instrument in use, and a shelf that follows the account without copying files.

## 1. Scope

**In:** pairing the device with an account; the shelf (the account's books, by
the home book's `shelf.json`); a book's songs and setlists; a song's sheet —
its chart, its shapes, its notes — at its saved transposition or any other key,
read at the stand; a setlist played in order, in the setlist's keys
(workflow 12 §The key); syncing in the background.

**Out:** editing, saving, arranging, conflicts, history, sharing, invitations,
forks, account management, the chord explorer. Anything that writes. A reader
that never pushes cannot conflict, cannot lose work and needs no merge.

## 2. The platform

| | |
|---|---|
| Device | reMarkable 2: i.MX7 Dual, 2× Cortex-A7, 1 GB, no swap; **32-bit ARMv7** (`GOARCH=arm GOARM=7`) |
| OS | reMarkable OS 3.20 or later (xovi's floor) |
| Root | SSH as root out of the box; no developer mode on an rM2 |
| App host | **xovi + AppLoad**: an app launcher inside the stock UI (xochitl) |
| Later | Paper Pro and Move are arm64 (`GOARCH=arm64`) and need developer mode; nothing here is rM2-specific beyond the target |

An AppLoad app is a folder in `/home/root/xovi/exthome/appload/<app>/`:
`manifest.json`, `icon.png`, `resources.rcc` (the QML, compiled with `rcc`)
and `backend/entry` (any executable). AppLoad starts the backend when the app
first opens and **leaves it running in the background** until the app calls
`terminate()` — so what the backend holds in memory survives closing and
reopening the screen, and it can keep syncing.

Installing xovi and AppLoad is the person's: Vellum (`vellum add xovi`, then
AppLoad) or a community installer. xovi is started by a triple press of the
power button after a reboot (xovi-tripletap), and an OS update needs its
hashtable rebuilt; both are xovi's, not ours. The reader's own install is
copying one folder.

### 2.1 Installing it, step by step

What a person does, from a reMarkable 2 out of the box to the reader paired and
reading. The task that ships it (`reader.install`) turns this into
`remarkable/INSTALL.md`, with what each step shows when it worked and what to do
when it did not, and `remarkable/scripts/install.sh` for step 4. Community
tools named here (Vellum, xovi, AppLoad, xovi-tripletap) change between
releases: the guide links each one's own instructions and says which versions
it was written against.

**1. What is needed.**

- A reMarkable 2 on reMarkable OS **3.20 or later** (*Settings → General →
  About* shows the version; xovi needs 3.20).
- A computer with `ssh` and `scp` (macOS and Linux have them; Windows 10 and
  later has OpenSSH).
- Either the USB cable, or the tablet and the computer on the same Wi-Fi.
- An Estante account, signed in on a phone or a computer, for pairing.

**2. Reaching the tablet as root.**

1. On the tablet: *Settings → General → Help → About → Copyrights and
   licenses*. At the bottom are the **root password** and the tablet's
   **IP addresses**. An rM2 needs no developer mode.
2. By USB: plug it in; the tablet is at `10.11.99.1`.
   `ssh root@10.11.99.1`, and the password from step 1.
3. By Wi-Fi: the Wi-Fi address from the same page.
   `ssh root@<address>`. (Wi-Fi SSH is on by default on an rM2.)
4. Optional, so the password is asked once: `ssh-copy-id root@<address>`.

**3. Installing xovi and AppLoad.** The reader is an AppLoad app; AppLoad is
an extension of xovi, which hooks into the tablet's own interface.

1. With **Vellum**, the package manager for current reMarkable OS: install
   Vellum as its instructions say, then `vellum add xovi`, and AppLoad with its
   dependency `qt-resource-rebuilder` the same way.
2. Or with a community installer for the rM2 (for example
   remarkable-xovi-installer), as its instructions say.
3. Rebuild xovi's hashtable for this OS version, as the installer says
   (xovi's `rebuild_hashtable`); it is needed again after every OS update.
4. Install **xovi-tripletap**: xovi does not start on its own after a reboot,
   and tripletap starts it with **three presses of the power button**. A plain
   reboot always returns to the tablet's own interface, which is what keeps a
   broken extension from locking the tablet out.
5. Start xovi (three presses). AppLoad's icon appears in the tablet's
   interface.

**4. Installing the reader.**

- By its script, from a computer:
  `RM_IP=<address> ./install.sh`. It asks the tablet its architecture
  (`uname -m`: `armv7l` for the rM2, `aarch64` for the Paper Pro), downloads
  that app folder from `/device/` on the site and checks it against the
  manifest's SHA-256, copies it over one SSH connection, keeps any installed
  reader as the previous one in `/home/root/xovi/exthome/estante.previous/`
  (outside AppLoad's directory, so AppLoad does not list it twice), puts the
  new one at `/home/root/xovi/exthome/appload/estante/`, and stops the
  previous one's backend if it is still running, so the next opening starts
  the new one. It needs `sh`, `curl` and `tar` on the computer (macOS and
  Linux; on Windows, WSL or Git Bash — or install by hand).
- Or by hand: download the app folder for the rM2 (armv7) from the site's
  `/device/estante-armv7.tar.gz`, unpack it (`tar xzf estante-armv7.tar.gz`),
  and
  `scp -r estante root@<address>:/home/root/xovi/exthome/appload/`.

Then, on the tablet, open AppLoad and press **Reload**: *Estante* is listed.

**5. Opening and pairing.**

1. Open *Estante* from AppLoad. It says *Pair with your account*.
2. Press it: it shows a code and an address — *go to www.estantedecifras.app/pair
   and enter KQ7-4TM*.
3. On a phone or a computer signed in to Estante, open that address, enter the
   code and confirm *Pair your reMarkable*.
4. The tablet shows the shelf and syncs the books. From then on the reader
   opens on the shelf, and keeps syncing in the background while it runs.

**6. Updating it, and the tablet's own updates.**

- The reader's music code and screens **update themselves** at sync (§8). A
  new backend, when one comes, is installed as in step 4; its settings say so
  when it is needed (*Update the reader on your reMarkable*).
- **reMarkable OS updates** can stop xovi until its hashtable is rebuilt for the
  new version (step 3.3), and tripletap may need its version step again; the
  reader itself is untouched in `/home/root`. Turning automatic OS updates off
  (*Settings → General → Software*) and updating by hand avoids being caught
  out before a gig.
- **Removing it**: *Sign out* in the reader's settings, then
  `ssh root@<address> rm -r /home/root/xovi/exthome/appload/estante
  /home/root/xovi/exthome/estante.previous` and Reload in AppLoad. Going
  back to the previous install instead is moving `estante.previous` back to
  `appload/estante`. Its synced books and state are in
  `/home/root/.local/share/estante/`, removed by *Sign out* or by hand.

**7. When something goes wrong.**

- *No AppLoad icon*: xovi is not running — three presses of the power button;
  after an OS update, rebuild the hashtable first.
- *Estante not in AppLoad's list*: the folder is not at
  `/home/root/xovi/exthome/appload/estante/` with its `manifest.json` at the
  top — check with `ls`; then Reload.
- *It opens but says nothing*: the backend did not start — the folder for the
  wrong architecture, or `backend/entry` not executable (`chmod +x`).
- *Pairing fails*: the code lasts ten minutes; get a new one. The tablet must
  be on Wi-Fi.
- *Not connected*: the reader shows what it last synced and says when; it syncs
  again when Wi-Fi is back.

## 3. Architecture

```
 reMarkable 2                                                   the one origin
┌───────────────────────────────────────────────────────┐      ┌──────────────┐
│ xochitl + xovi + AppLoad                               │      │ service      │
│ ┌──────────────┐  AppLoad socket   ┌────────────────┐ │HTTPS │  /api/…      │
│ │ QML frontend │ ◄──────────────► │ Go backend      │─┼─────►│  /git/…      │
│ │ (draws rows, │  (type, JSON)     │  protocol       │ │      │  /device/…   │
│ │  diagrams)   │                   │  sync (go-git)  │ │      └──────────────┘
│ └──────────────┘                   │  store (disk)   │ │
│                                    │  engine (goja ──┼─┼── bundle.js: the web
│                                    │   + the bundle) │ │   app's own music code
│                                    └────────────────┘ │
└───────────────────────────────────────────────────────┘
```

### 3.1 Where it lives

| Path | What |
|---|---|
| `app/src/device/` | The bundle's entry (§4) and its polyfills — app code, linted and tested with the app |
| `app/dist/device/` | Built by `npm run build`: `bundle.<hash>.js` and `manifest.json` |
| `remarkable/` | The reader: a Go module (`cmd/estante-reader`, `internal/…`) and its QML frontend (`remarkable/qml/`) |
| `remarkable/qml/Main.qml` | The QML root AppLoad loads: the `AppLoad` endpoint (`applicationID` `estante`), `signal close`, `unloading()` — which leaves the backend running, so it keeps syncing — and `hello` sent on attach |
| `remarkable/tools/appfolder` | Assembles the AppLoad folder for one architecture: `manifest.json` (`id` `estante`, `name` *Estante*, `entry` `/Main.qml`, `loadsBackend`, one frontend, `aspectRatio` 0.75 at `width` 1404 — the rM2's screen, scale 1 there; `original` would mean the Paper Pro's 1620), `icon.png` (100 × 100, one bit), `resources.rcc` (every file under `remarkable/qml/` but its tests, compiled with `rcc --binary`, zlib) and `backend/entry` (the `estante-reader` binary itself, checked to be for that architecture) |

`remarkable/` shares no code with `service/` (DIRECTION §3.6): it is a client,
and agrees with the service through `api/openapi.yaml` like the others. It runs
the app's code only as the built bundle — bytes it loads, never source it
imports.

`backend/entry` is `estante-reader` unrenamed: AppLoad runs it with the socket's
path as its only argument (`/tmp/estante.sock`, the app folder as its working
directory), and a sole absolute path is read as `estante-reader run` against
the store at `/home/root/.local/share/estante/`.

### 3.2 The backend (Go)

One process, four parts:

- **protocol** — the AppLoad socket (§6): `net.Dial("unixpacket", argv[1])`,
  an 8-byte header (`int32 type`, `int32 length`, native order) and a UTF-8
  payload of at most 10 MiB per message. Negative types are AppLoad's own:
  `-1` terminate, `-2` a frontend attached, `-3` it detached.
- **sync** (§5) — the session, the home book and the books, fetched with
  go-git into the store. Never a push.
- **store** — the device's files under `/home/root/.local/share/estante/`:
  the session (mode 0600), the clones, the current bundle and its manifest,
  and the reader's own small state (§5.4).
- **engine** (§4) — one goja runtime, owned by one goroutine, running the
  bundle. All the music the frontend shows is computed here: a song's sheet
  and a setlist's items. The book screen's listing — each song's title and
  artist, each setlist's title and count — is read with cifra.md's Go
  implementation (`cifra.md/go`, the format's, as the service reads it),
  since a parse per song in goja (~80 ms on an rM2) would make a book of
  three hundred songs take half a minute to open.

### 3.3 The frontend (QML)

Declarative screens that draw what the backend sends and send back what was
tapped (§6, §7). It holds no song text it did not receive, computes no music,
and keeps no state the backend would need.

## 4. The engine and the bundle

**No port of the music core.** The reader runs the web app's own code — the
cifra.md reader (`cifra.md/js`), `app/src/core` (transpose, voicings, the
cache port), the chart's row layout and the chord box's diagram model — bundled by
rolldown to ES2017 and evaluated in goja, the pure-Go JavaScript engine. A
change to the app's music reaches the reader by rebuilding the bundle.

**The host API** is the bundle's whole surface, `globalThis.estante`, and has a
version (`hostApi`, an integer in the manifest). It is the contract between the
Go host and the bundle:

| Call | Does |
|---|---|
| `instrument(files, opts)` | From the home book's `instruments.json`, `preferences.json`, `shapes.json` and `shapes-default-cache.json` (as parsed JSON, absent as `{}`), the instrument to read with as the Worker surfaces it — `opts.instrumentId`, the one chosen on the reader, when the account has it, else the account's in use — and the default-shape table §4.1 chooses for it — the bundle's own salt, else another non-decommissioned salt's table whose fingerprint fits — for `load` (reader.sync); and the instruments to choose from, `{ id, name, tuning }` named as the web app's roster names them, with the account's in use (`inUseId`) |
| `load(entry, table)` | The instrument in use, as the Worker surfaces it, and its default-shape table (§4.1) |
| `sheet(text, offset, opts)` | One song at one key: its rows (`chartRows`), its shapes (resolved §7.6 order, through the cache) as diagram models (`diagramModel`) with their frets, its notes, key and title, and the tuning id it was read on. `opts`: the preferences, the song's `songs.json` variations (by tuning; the bundle picks the instrument's — a variation chosen on the reader merged over them), the saved transposition (named as `key.saved`), a setlist's target key, and `chordNames`, the reader's own `written` or `voiced` over the account's preference. Named as voiced, the rows' chords and the shapes' symbols are as the shapes sound them, as the web app's chart names them. It also lists the song's variations for the tuning (`variations`, `''` the unnamed block) and names the one read (`variation`) |
| `setlist(text, …)` | A setlist's playable items and each one's key (workflow 12), and every item in order, each marked missing or not, for the setlist screen |
| `misses()` | Chords the cache did not hold, for the background fill (§4.1) |
| `fill(chord)` | Searches one queued miss (`chord`, its table key) on the instrument in use, as the web app's `defaultVoicing` would, and keeps what it finds — a shape, or none — in the session's cache, never the table it was loaded with; the miss leaves the queue (§4.1) |
| `held()` | What the session keeps: songs parsed, shapes rebuilt, rebuilds so far, misses queued (for the host's checks and `bench`) |

The polyfills goja needs and the spike found: `structuredClone` (as JSON — a
parsed song is plain data), `TextDecoder`/`TextEncoder`, `Intl.PluralRules`.
The bundle carries one locale, not four.

**In memory, never re-derived:** each open song's parsed model, and each
shape rebuilt from the cache (`fingeringFromFrets`), per chord, for as long as
the backend runs. The second read of a key costs neither the parse nor the
rebuild.

### 4.1 Default shapes

From the home book's `shapes-default-cache.json` (format §4.6), filled by the
web app when a song is saved, for the instrument in use, under the **bundle's
own salt** — the bundle is built with the app, so its salt is the one the app
writes. If the device's table is absent (a salt the web app has not filled
yet), it MAY read another non-decommissioned salt's table (§4.6, the slow
reader's allowance). The choice is the bundle's (`instrument(files)`, §4),
beside the core's own salt and decommissioned list, so the Go host keeps no
copy of either: of the other salts' tables, one whose fingerprint fits the
instrument as it is now, the latest written (`at`) first.

**The search never runs on the reading path.** Measured on an rM2 it costs 1–
2.5 s a chord. A miss draws the chart at once and leaves that chord's place in
the shapes strip empty; the backend searches it afterwards, at low priority,
and keeps it in memory. The found shape shows on the next page drawn — never by
redrawing the page on screen (workflow 19, rule 5). It never writes the home
book.

The search is `fill(chord)`, one queued miss at a time in the order they were
queued, on the engine's **lower lane**: it runs only when no reading call is
waiting, and a reading call that arrives while it runs interrupts it — the miss
stays queued and is searched again once the engine is idle — so a page, a key or
a song never waits behind a search. A completed search is never repeated:
found or not, the session's cache holds the answer until the next `load`. When
a search fills a place in the song on screen, the backend sends `108 shapes`
(§6); the frontend keeps the shape for the pages it has yet to draw and redraws
nothing. A chord the search finds no shape for keeps its empty place until the
song is opened again, when it is no longer a shape.

**A chord the song voices is never a miss.** Where the song's own voicing
block, in the variation in use and at the key as written, chooses a shape, the
reader draws that shape or none: cifra.md §7.6 does not fall back from a
choice, so no default could ever fill it. A chosen shape the instrument cannot
make into a hand (`fingeringFromFrets` refuses it) is therefore unvoiced from
the first read — it has no place in the strip, and nothing is queued or
searched for it. Read at another key the song's choices do not apply, and such a
chord takes the default like any other, a miss when the table does not hold it.

### 4.2 The budget, measured

goja-spike v2 on an rM2, the example book, cache filled as a save fills it
(0 misses):

| | |
|---|---|
| Load the bundle | 0.5 s, once per backend start |
| Open a song (parse) | ~80 ms |
| Change key, model kept | ~245 ms, of which rebuilding shapes ~150 ms |
| Change key, shapes rebuilt once (§4) | ~0.1 s, estimated |
| Heap | 8 MB |

The A7 runs goja some 12–25× slower than a laptop. The rules above keep a key
change near a tenth of a second; an e-ink refresh is slower than that.

## 5. Sync

### 5.1 The session: pairing

Passkeys need a browser; the device has none. It is **paired** instead, the
way a television is:

1. The device asks the service for a code — `POST /api/devices/pair/begin` —
   and shows it, with the address to enter it at: *Go to
   www.estantedecifras.app/pair and enter* `KQ7-4TM`.
2. Signed in on a phone or a computer, the person enters the code there
   (`POST /api/devices/pair/approve`), and confirms *Pair your reMarkable*.
3. The device, polling `POST /api/devices/pair/poll` with the token only it
   holds, receives a session and keeps it.

The session is the account's, listed among its signed-in devices as *your
reMarkable* (workflow 13) and signed out from there like any other. It is
**read-only by scope**: the service refuses a git push or any write it makes —
the device would never send one, and a stolen token cannot either. Codes are
short-lived (ten minutes), single-use and rate-limited. This is the one change
the reader needs in the service and the API contract.

**On the device** (reader.pairing). The backend pairs with one origin — its
`--origin`, `https://www.estantedecifras.app` unless a test says otherwise — and
the session it keeps is for that origin alone. The poll token is held in memory
only, never written or logged, and polled every three seconds; a poll the
network does not answer is tried again until the code's ten minutes are over,
and then the code has expired. A code the service will not give (a refusal
rather than no network) is said as an expired code, with *Get a new code*.
Once approved, the session is kept and the first sync runs while the code page
stays still; the reader reports itself paired when that sync ends, so the
shelf that replaces the code is the shelf the account has (or, offline, the
empty one with its sync line). *Paired with* in Settings names the account by
the home book's `authorName` (home book format §4.1), *your account* until it has
one. **Signing out** cancels a sync in flight, asks the service to end the
session (`POST /api/auth/signout`, a few seconds at most — offline, the device
signs out all the same, and the session stays listed in the account until it is
signed out from there), then removes the session, the home book, the books and
the reader's state, keeping the bundle. A session the service **refuses** (401)
is forgotten the same way, except that a book a screen holds open stays on disk
until it is let go (workflow 19 §Pairing).

### 5.2 What comes down

- The **home book**, fetched (never pushed): `shelf.json` for the books and
  their order, `instruments.json` and `preferences.json` for the instrument
  in use, `shapes.json` for my shapes, `songs.json` for each song's saved
  transposition and variation, `shapes-default-cache.json` for the defaults.
  Read with the home book's own rules (format §3–§5) — the reader is one more
  reader of it.
- Each **book on the shelf**, cloned on first sight and fetched when it moved.
- A local-only book (format §7) is never on the reader: there is nothing to
  clone.

### 5.3 When

One change check (`POST /api/shelf/change-check`) for the whole shelf, then a
fetch only of what moved: at backend start, when the frontend attaches, on
*Sync now*, and every fifteen minutes while the backend runs on Wi-Fi. A fetch
never changes the song on screen: the new version shows on the next open, as
full screen holds a merge back in the web app (workflow 8).

### 5.4 The reader's own state

The reader is **fully read-only**: it writes nothing the account holds. What
the person does at the stand stays on the device — a key chosen for a song,
the place in a setlist, the shapes hidden because they are known (by tuning,
chord and frets), whether the shapes are shown at all, a variation chosen for
a song (by tuning), the instrument every song is read with, and how the chart
names its chords — kept in the store. The instrument and the chord names, until
chosen here, are the account's; a variation, the account's (`songs.json`). The saved transposition in
`songs.json` is where a song opens; a key chosen on the device overrides it
there until another is chosen, or *As written* (workflow 19 §A song).

## 6. The messages

**The wire, as rm-appload defines it** (`src/protocol.h`,
`src/management.cpp` at df974a6, 2026-10-06). AppLoad listens on a
`SOCK_SEQPACKET` unix socket and passes its path as the backend's `argv[1]`;
the backend connects. A message is **two records**: an 8-byte header record
(`int type`, `int messageLength`, the machine's own order) and then, when the
length is not zero, one payload record of exactly that many bytes of UTF-8 —
AppLoad sends them with two `send` calls and reads them with two `read`s. A
length above 10 MiB (10 485 760) makes AppLoad end the connection; the backend
does the same with one it receives. A payload of zero bytes is never sent:
AppLoad would read no payload record, and the empty record that follows reads
as the end of the connection. The kernel bounds one record by the sender's
socket buffer, so the backend checks a payload against that bound before it
writes the header, never leaving a header without its payload. AppLoad's own
types: `-1` terminate (payload `close`, then the socket closes), `-2` a
frontend attached and `-3` one detached (payload: the number of frontends now
attached, in decimal).

Over it, each payload JSON. Types are small positive integers, one table for
both directions; the frontend and the backend each ignore a type they do not
know, and a field they do not know.

| Type | Direction | Payload |
|---|---|---|
| 1 `hello` | → backend | `{}` — the frontend attached; the backend answers with `state` |
| 2 `open` | → backend | `{ view: "shelf" }`, `{ view: "book", bookId }`, `{ view: "song", bookId, path, offset?, play? }`, `{ view: "setlist", bookId, path }`, `{ view: "settings" }` — `play` is `{ setlist, at }` when the song is opened playing a setlist (the setlist's path in the book, the item's index) |
| 3 `key` | → backend | `{ offset }` for the open song; `{ offset: null }` forgets the device's choice, so the song opens at the saved key, else as written — *As written* sends it when no key is saved, `{ offset: 0 }` when one is |
| 4 `sync` | → backend | `{}` — *Sync now* |
| 5 `pair` | → backend | `{}` — begin pairing, or *Get a new code* |
| 6 `signOut` | → backend | `{}` |
| 7 `hideShape` | → backend | `{ tuningId, chord, frets }` — hide this voicing in every song (workflow 19 §A song) |
| 8 `showShape` | → backend | `{ tuningId, chord, frets }` — show one hidden voicing again |
| 9 `showAllShapes` | → backend | `{}` — *Show all again* |
| 10 `shapesShown` | → backend | `{ shown }` — *Hide shapes* / *Show shapes*, for every song |
| 11 `place` | → backend | `{ bookId, setlist, at }` — the setlist item being played, kept so Back returns to it; while playing that setlist, an item other than the open song becomes the open song, and its neighbours are sent as `109` |
| 12 `instrument` | → backend | `{ id }` — read every song with this instrument (one `107` listed), on this reader; `null` follows the account's in use again. Answered with `107` |
| 13 `variation` | → backend | `{ variation }` — read the open song with this variation of its tuning (one `105` listed; `""` the unnamed block), on this reader; `null` follows the account's again. Answered with `105` |
| 14 `chordNames` | → backend | `{ value }` — `"written"` or `"voiced"`, how the chart names its chords, on this reader; `null` follows the account's again. Answered with `107` |
| 101 `state` | → frontend | `{ paired, syncing, online, lastSync, shapesShown, error? }` — `lastSync` an RFC 3339 time or `null`; `error` a word code (`offline`, `signedOut`), never a message |
| 102 `pairing` | → frontend | `{ code, url, expiresAt }`, or `{ expired: true }`, or `{ offline: true }` |
| 103 `shelf` | → frontend | the books, in shelf order: `{ books: [{ bookId, title, songs, setlists }] }` — `songs` and `setlists` counts |
| 104 `book` | → frontend | `{ bookId, title, songs: [{ path, title, artist }], setlists: [{ path, title, songs }] }` |
| 105 `sheet` | → frontend | `{ bookId, path, title, artist, key: { written, named, saved, choices }, offset, tuningId, rows, shapes: [{ chord, symbol, frets, model, hidden }], notes, keyNote, play? }` — `model` the diagram model (§7); `saved` the account's key (`songs.json`) when it has one; `choices` the key grid's twelve `{ name, offset }`, ordered by the key's root from C, each named by the music core from the song's as-written key (offsets −5…+6), `[]` for a song with no chords; `tuningId` the tuning the shapes are for, which `hideShape` and `showShape` name; a chord the cache did not hold keeps its place in `shapes` with `model` and `frets` `null`, its place in the strip left empty (§4.1); `play` `{ setlist, at, of, next }`, `next` `{ title, key, note }` or `null`; for a song with two or more variations for the tuning, at every key, `variations` (`""` the unnamed block), `variation` the one read and `variationChosen` when this reader chose it |
| 106 `setlist` | → frontend | `{ bookId, path, title, items: [{ path, title, key, note, missing }], at? }` — every item in order; `path` the song's book-root path (`""` for an unlinked item); `key` the item's own `key` property (`null` when it has none); `at` the item last played, for Back |
| 107 `settings` | → frontend | `{ account, version, hiddenShapes, updateReader, chordNames, chordNamesChosen, accountChordNames, instruments, instrument, accountInstrument, instrumentChosen }` — the account paired with, the reader's version, how many voicings are hidden, whether the site serves a `hostApi` newer than this backend speaks (§8), how the chart names its chords now (and whether chosen here, and the account's own), and — when the account has two or more — the instruments `{ id, name }`, the one read with, the account's in use, and whether it was chosen here |
| 108 `shapes` | → frontend | `{ bookId, path, offset, tuningId, shapes }` — the open song's `shapes`, as its `sheet` would now carry them, sent when a background search (§4.1) has filled a place the last `sheet` left empty; the frontend fills the matching empty places of the sheet on screen and draws them on the next page it draws, never on the page shown (workflow 19 rule 5), and ignores one for another song, key or tuning |
| 109 `ahead` | → frontend | a `105`'s payload, with `play`, for the next or the previous playable item of the setlist being played, read ahead; never shown until a turn reaches it |

`rows` are `chartRows` exactly as the web app's chart receives them —
`section`, `bars`, `run`, `sung` (segments: the chord over its words),
`words`, `notes`, `verbatim`, `gap`, `empty` — so the frontend draws the
same plain data the web app draws, and the layout is decided once. The
frontend lays the pages out, so a sheet carries every shape of the song, each
marked `hidden` or not; the strip of a page, its count of hidden shapes and
*Show hidden* are drawn from that. A tuning, a chord and its frets name a
voicing to hide: the frets, not the spelling (workflow 19 §A song).

**What the backend answers.** Every `open` is answered with its view, read
from the last sync's snapshot: `shelf` and `settings` at once, `book` from the
book at the snapshot's head, `sheet` and `setlist` through the engine. A song
opens at the key chosen on the device for it, else the account's saved
transposition, else as written; played from a setlist, at the setlist's key.
The book of the view on screen is held (its clone kept on disk), and that view
keeps the snapshot it was opened from: a `key`, a `hideShape` or a `showShape`
redraws the open song from the same version, and a setlist being played reads
every song from the version it started with, until an `open` leaves it (Back).
A book the latest snapshot no longer has is read from the held one, so a song
open from it stays readable until Back (workflow 19 §When something has
changed). An `open` that cannot be answered as asked — the book or the file
gone, no bundle loaded — is answered with the nearest view that can be (the
book, else the shelf). `key` answers the redrawn `sheet`; `hideShape`,
`showShape` and `showAllShapes` the redrawn `sheet` when a song is open, else
`settings`; `shapesShown` answers `state`. A song opened playing a setlist is
answered with its `sheet`, then its neighbours read ahead — the next playable
item's sheet, then the previous one's, each as `109 ahead`, read from the
version Play started with at the setlist's key; at either end the missing
neighbour is not sent (workflow 19 §A setlist, rule 9). `place` is kept; while
playing that setlist, a `place` at an item other than the open song makes it
the open song — a later `key`, `hideShape`, `showShape` or `108 shapes` is
its — and answers its neighbours as `109`; otherwise it is answered with
nothing.

## 7. The screens

Decided in [workflow 19](workflows/19-remarkable-reader.md), which designs
them by their redraws: one action, one redraw; nothing moves by itself; paged,
never scrolled; fixed chrome; background news never redraws the screen; one
bit, black on white; the pressed control answers at once; choose, don't step;
the next page prepared ahead; big targets. The screens: pairing, the shelf, a
book (with its letter row), a song (paged chart, a shapes strip per page, the
key grid), a setlist and its Play.

**A diagram is drawn in QML, from its model.** The bundle hands over the chord
box's diagram model (`diagramModel`: strings, frets shown, the start fret, the
nut, each dot's string, row and finger, the open and muted marks) — plain data,
no SVG. The frontend draws it with Qt Quick's own primitives: pixel-aligned
`Rectangle`s for the strings, frets, nut and barre, rounded ones for the dots,
`Text` in the interface face (Atkinson Hyperlegible) for the fingers — white in
the black dot — and the fret number, the start fret beside the first row when
the nut is not shown. Nothing is antialiased into grey. Large and compact are
one component at two sizes.

**The faces travel as the app's files, as TrueType.** `remarkable/qml/fonts/`
holds each of the app's `woff2` files (`app/src/theme/fonts/`) decoded to a
`.ttf` — same family, name and subset; only the container changes, which the
OFL permits — with each family's licence byte for byte, loaded with
`FontLoader`. Not the `woff2` itself: the reMarkable's Qt (6.10 on OS 3.29)
cannot read it, its FreeType being built without Brotli, while the desktop Qt
the tests run on can — so the folder check refuses a `woff2` by name.
`remarkable/tools/fonts/convert.py` makes the `.ttf` files and
`fonts/sources.json`, which names each one's `woff2` by its SHA-256;
`tools/appfolder`'s tests fail when an app font changes until it is run again.
The folder check loads them from `resources.rcc` as AppLoad would. A face
that still fails to load counts as settled (`Faces.failed`): the chart is
laid out in Qt's fallback face rather than never.

Why not the SVG the web app draws: measured with Qt 6.12's SVG renderer, the
chord box as the app emits it draws only its dots — every stroke, the nut and
the fingers' colour live in the web app's stylesheet classes, which an SVG
alone does not carry. With a `<style>` block inlined it draws correctly, but
at 0.34–0.59 ms a diagram on a laptop — perhaps 5–15 ms on the rM2, 80–240 ms
for a page of sixteen — on xochitl's own UI thread, and anti-aliased in 256
greys against the one-bit rule.

**Live first; cache, then stamp, if it is slow.** A page of sixteen shapes is
some 350 primitive items, built on every page drawn. If that proves too slow on
the rM2, the next step is to draw each voicing once and keep it: `grabToImage`
renders the drawn diagram to an image, cached by tuning, frets, fingers and
size — in memory, and on disk across sessions — and pages show one `Image` per
diagram; the grabs are made when a song opens, before its first page, so no
page is drawn twice. If anti-aliased grey then shows on the panel, the last
step is a stamped one-bit bitmap made by the backend from the same model: a
prototype composes a diagram in 0.01 ms and encodes it as PBM — a one-bit
format Qt reads natively — in 0.02 ms, on a laptop. The interface stays the
model in every case.

## 8. Updates

The site serves the device's payload beside the app, from the same image:

```
/device/manifest.json          { version, hostApi, salt, bundle: { path, sha256 },
                                 qml: { path, sha256 },
                                 backend: { armv7: { path, sha256, version, hostApi }, arm64: {…} },
                                 folder:  { armv7: { path, sha256 }, arm64: {…} } }
/device/bundle.<hash>.js
/device/resources.<hash>.rcc
/device/estante-reader-armv7.<hash>
/device/estante-reader-arm64.<hash>
/device/estante-armv7.tar.gz
/device/estante-arm64.tar.gz
```

Every file is named in the manifest with its SHA-256; `<hash>` is the first
eight hex digits of it. The manifest's `version` is the payload's: the first
twelve hex digits of the SHA-256 over its files' `path sha256` lines, sorted,
so it changes exactly when a served byte does. `hostApi` is the bundle's; each
backend's `hostApi` is the one it speaks, and its `version` is the one it
prints and the settings show — a digest of the sources it was built from and
the Go toolchain, stamped at link time. The two `.tar.gz` are the AppLoad
folder for each architecture (`estante/`, as `remarkable/tools/appfolder`
assembles it, carrying the same `resources.rcc` and backend bytes the manifest
names): what a person downloads to install (§2.1) and what `install.sh` fetches,
under a fixed name. The content-hashed files are served as immutable; the
manifest and the two folders are revalidated. A `/device/` path that names no
file is a 404, never the app's shell.

- The **bundle** and the **QML** update themselves: at sync, when the manifest
  names a new one whose `hostApi` this backend speaks, the backend downloads
  it, checks its SHA-256, keeps the last good one, and switches on the next
  frontend attach (the bundle) or the next app launch (the QML). A bundle that
  fails to evaluate is dropped and the last good one kept. They run in goja or
  in QML and can reach nothing the backend does not hand them.
  - **One `hostApi` for both.** The bundle and the QML come from one image, so
    the manifest's `hostApi` stands for the pair: an incompatible change to the
    host calls (§4) or to the messages (§6) bumps it. A backend that does not
    speak the served `hostApi` fetches neither.
  - **Fetched after the shelf, from the session's origin, without the
    session.** `/device/` is the site's public payload, so the manifest and the
    files are fetched with no cookie, after the books of the pass, and an
    update that fails changes nothing the pass reports: the shelf's sync line
    is the books'.
  - **The bundle** is staged in the store's `bundle/next/` with the served
    manifest as it is. On the next attach it is promoted and opened; if it does
    not open, or the instrument in use does not load in it, it is rolled back,
    the backend keeps the bundle it was running, and its SHA-256 is remembered
    as refused so no later sync fetches it again. A reader with no bundle loaded
    at all — just installed — switches to a staged one at the end of the pass,
    since no screen depends on one. At backend start a current bundle that does
    not open is rolled back the same way.
  - **The QML** is placed in the AppLoad folder (the backend's working
    directory, checked to be *Estante*'s) by replacing its `resources.rcc` in
    one rename, the one it replaced kept in the store's `qml/previous/`.
    AppLoad reads the file when it next loads the app, so the screens on view
    are never changed under the person.
  - **Too old.** When the served `hostApi` is newer than the backend's, the
    backend keeps its bundle and QML, remembers the served `hostApi` in the
    store (so the settings say it offline too), and the settings say *Update
    the reader on your reMarkable* until a backend that speaks it is
    installed. A served `hostApi` older than the backend's is fetched by
    neither and said by nothing.
- The **backend** runs as root, so it is not updated blindly. At first it is
  installed by hand; a self-update, when it comes, will verify an Ed25519
  signature over the manifest against a key built into the binary, stage the
  new binary and switch on the next launch. A backend too old for the current
  bundle keeps its last bundle and says *Update the reader on your reMarkable*.
- A backend **built with its self-update off** (`-ldflags "-X
  main.selfUpdate=off"`, what `install.sh`'s `ESTANTE_FROM_SOURCE=1` builds)
  never checks the site: the bundle and the QML the install put in place —
  built from the same checkout, or the site's, checked against its manifest —
  stay until the next install. The install stages the bundle in `bundle/next/`
  as an update would, so the switch on the next attach, and its rollback, are
  the same. `--version` says *(self-update off)*.

## 9. Testing and building

| Level | What | Where |
|---|---|---|
| Unit (JS) | The bundle's entry under Node | `app/`, Vitest |
| Unit (Go) | protocol framing, store, sync logic against fakes | `remarkable/`, `go test` |
| Integration | The **built** bundle loaded in goja: the example book read at all twelve keys, against a cache table the app's own fill produced; every host call; no polyfill missing | `remarkable/`, `go test`, needs `app/dist/device/` |
| Integration (stack) | Pairing, then a sync, against the compose stack the gate already runs | `remarkable/`, `go test` with the stack's URL |
| Frontend | The QML, in Qt Quick's software renderer offscreen, against scripted backend messages | `remarkable/qml/tests`, the gate |

**The gate** runs `remarkable/`'s checks after the app's (whose build makes the
bundle), and cross-builds the backend for **amd64** (the tests' host),
**armv7** (the rM2) and **arm64** (the Paper Pro), so a change that breaks an
ARM build fails the gate; it then assembles the armv7 and arm64 app folders
and loads each folder's `resources.rcc` the way AppLoad does, so a QML file the
folder does not carry, or one that does not compile, fails it too. The **Dockerfile**'s `reader` stage builds the
backend for armv7 and arm64, compiles the QML with the gate's own pinned
`pyside6-rcc` into each app folder (`tools/appfolder`), and lays out the payload
of §8 with `remarkable/tools/payload` — beside the bundle the app's build made —
into `/srv/app/device/`.

## 10. Security and privacy

- The session lives in the store, mode 0600, under root's home; it is
  read-only by scope (§5.1) and revocable from the account.
- HTTPS to the one origin only; the backend never listens on a port.
- No song text, title, label or shape in a log, as everywhere (standing rule).
- The bundle and the QML are checked by hash against a manifest fetched over
  HTTPS; the backend binary is never replaced unsigned (§8).

## 11. Risks and open questions

- **xovi and OS updates.** Each reMarkable OS update can break xovi until it is
  rebuilt; the reader inherits that. Automatic OS updates are best left off.
- **Diagrams drawn live** (§7): about 350 items a page, created on xochitl's UI
  thread on a Cortex-A7, unmeasured. Caching by `grabToImage`, then
  backend-stamped bitmaps, are the steps if it proves slow in use.
- **Drawing speed.** How fast QML lays out a long sung song on the rM2 is
  unmeasured; paging (§7) bounds what is drawn at once.
- **WOFF2 on the device.** The faces are carried as `woff2` (§7), which the
  gate's Qt reads; whether xochitl's Qt build reads it (FreeType with brotli)
  is unchecked on a reMarkable. If not, the faces are carried as the same
  families' TrueType files from their upstream releases, never re-encoded here.
- **AppLoad is GPL-3.** The backend is a separate process speaking a socket
  protocol; the QML imports AppLoad's module at run time. To be read before the
  reader is published.
- **Keys on the device vs. the account** (§5.4): kept on the device. Letting a
  key chosen at the stand reach the account would make the reader write — a
  later decision, not this one.
- **How the panel updates** (workflow 19 §What the screens assume): the
  screens assume region-by-region updates with a fast one-bit waveform; what
  the panel does in use revises workflow 19.

## 12. The order of work

1. **Plumbing.** The bundle's entry and `build:device` in the app; the
   `remarkable/` module with the engine, a `sheet` command, and the
   integration test over the built bundle; the gate step and the three builds.
2. **The frontend, offline.** The AppLoad app — its folder, its QML root
   talking to the backend — then the song screen drawing rows and diagrams
   from a local book, diagrams as live QML primitives from the model (§7); the
   shelf and book screens. Tested in the QML harness, not on a device.
3. **Sync, by hand.** The backend syncs with a session pasted in for
   development: home book, books, change check.
4. **Pairing.** The API, the service, the web app's *Pair a device*, the
   reader's pairing screen; the read-only scope.
5. **Updates.** The manifest, the bundle's and the QML's self-update; the
   Dockerfile stage.
6. **Setlists and polish.** Play through a setlist; the missed-shape fill;
   paging and the stand's keys.

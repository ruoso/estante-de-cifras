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

`remarkable/` shares no code with `service/` (DIRECTION §3.6): it is a client,
and agrees with the service through `api/openapi.yaml` like the others. It runs
the app's code only as the built bundle — bytes it loads, never source it
imports.

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
  bundle. Everything the frontend shows is computed here.

### 3.3 The frontend (QML)

Declarative screens that draw what the backend sends and send back what was
tapped (§6, §7). It holds no song text it did not receive, computes no music,
and keeps no state the backend would need.

## 4. The engine and the bundle

**No port of the music core.** The reader runs the web app's own code — the
cifra.md reader (`cifra.md/js`), `app/src/core` (transpose, voicings, the
cache port), the chart's row layout and the chord-box SVG — bundled by
rolldown to ES2017 and evaluated in goja, the pure-Go JavaScript engine. A
change to the app's music reaches the reader by rebuilding the bundle.

**The host API** is the bundle's whole surface, `globalThis.estante`, and has a
version (`hostApi`, an integer in the manifest). It is the contract between the
Go host and the bundle:

| Call | Does |
|---|---|
| `load(entry, table)` | The instrument in use, as the Worker surfaces it, and its default-shape table (§4.1) |
| `sheet(text, offset, opts)` | One song at one key: its rows (`chartRows`), its shapes (resolved §7.6 order, through the cache) as diagram SVGs, its notes, key and title |
| `setlist(text, …)` | A setlist's playable items and each one's key (workflow 12) |
| `misses()` | Chords the cache did not hold, for the background fill (§4.1) |

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
reader's allowance).

**The search never runs on the reading path.** Measured on an rM2 it costs 1–
2.5 s a chord. A miss draws the chart at once and leaves that chord's place in
the shapes strip empty; the backend searches it afterwards, at low priority,
and keeps it in memory. The found shape shows on the next page drawn — never by
redrawing the page on screen (workflow 19, rule 5). It never writes the home
book.

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
   estantedecifras.app/pair and enter* `KQ7-4TM`.
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
chord and frets), whether the shapes are shown at all — kept in the store. The saved transposition in
`songs.json` is where a song opens; a key chosen on the device overrides it
there until another is chosen, or *As written* (workflow 19 §A song).

## 6. The messages

Over the AppLoad socket, each payload JSON. Types are small positive integers,
one table for both directions; the frontend and the backend each ignore a type
they do not know.

| Type | Direction | Payload |
|---|---|---|
| 1 `hello` | → backend | `{}` — the frontend attached; the backend answers with `state` |
| 2 `open` | → backend | `{ view: "shelf" }`, `{ view: "book", bookId }`, `{ view: "song", bookId, path, offset? }`, `{ view: "setlist", bookId, path, at? }` |
| 3 `key` | → backend | `{ offset }` for the open song |
| 4 `sync` | → backend | `{}` — *Sync now* |
| 5 `pair` | → backend | `{}` — begin pairing |
| 6 `signOut` | → backend | `{}` |
| 101 `state` | → frontend | `{ paired, syncing, lastSync, error? }` |
| 102 `pairing` | → frontend | `{ code, url, expiresAt }` |
| 103 `shelf` | → frontend | the books, in shelf order: `{ books: [{ bookId, title, songs, setlists }] }` |
| 104 `book` | → frontend | `{ bookId, title, songs: [{ path, title, artist }], setlists: [{ path, title }] }` |
| 105 `sheet` | → frontend | `{ bookId, path, title, artist, key, offset, rows, shapes: [{ symbol, svg, source }], notes }` |
| 106 `setlist` | → frontend | `{ bookId, path, title, items: [{ path, title, offset }] }` |

`rows` are `chartRows` exactly as the web app's chart receives them —
`section`, `bars`, `run`, `sung` (segments: the chord over its words),
`words`, `notes`, `verbatim`, `gap`, `empty` — so the frontend draws the
same plain data the web app draws, and the layout is decided once.

## 7. The screens

Decided in [workflow 19](workflows/19-remarkable-reader.md), which designs
them by their redraws: one action, one redraw; nothing moves by itself; paged,
never scrolled; fixed chrome; background news never redraws the screen; one
bit, black on white; the pressed control answers at once; choose, don't step;
the next page prepared ahead; big targets. The screens: pairing, the shelf, a
book (with its letter row), a song (paged chart, a shapes strip per page, the
key grid), a setlist and its Play.

A diagram is the bundle's chord-box SVG shown as an image. The SVG's look
comes from the web app's stylesheet classes; the bundle inlines it for the
device, in one bit, so Qt's SVG renderer draws it without a stylesheet.

## 8. Updates

The site serves the device's payload beside the app, from the same image:

```
/device/manifest.json          { version, hostApi, salt, bundle: { path, sha256 },
                                 qml: { path, sha256 }, backend: { armv7: {…}, arm64: {…} } }
/device/bundle.<hash>.js
/device/resources.<hash>.rcc
/device/estante-reader-armv7-<version>
/device/estante-reader-arm64-<version>
```

- The **bundle** and the **QML** update themselves: at sync, when the manifest
  names a new one whose `hostApi` this backend speaks, the backend downloads
  it, checks its SHA-256, keeps the last good one, and switches on the next
  frontend attach (the bundle) or the next app launch (the QML). A bundle that
  fails to evaluate is dropped and the last good one kept. They run in goja or
  in QML and can reach nothing the backend does not hand them.
- The **backend** runs as root, so it is not updated blindly. At first it is
  installed by hand; a self-update, when it comes, will verify an Ed25519
  signature over the manifest against a key built into the binary, stage the
  new binary and switch on the next launch. A backend too old for the current
  bundle keeps its last bundle and says *Update the reader on your reMarkable*.

## 9. Testing and building

| Level | What | Where |
|---|---|---|
| Unit (JS) | The bundle's entry under Node | `app/`, Vitest |
| Unit (Go) | protocol framing, store, sync logic against fakes | `remarkable/`, `go test` |
| Integration | The **built** bundle loaded in goja: the example book read at all twelve keys, against a cache table the app's own fill produced; every host call; no polyfill missing | `remarkable/`, `go test`, needs `app/dist/device/` |
| Integration (stack) | Pairing, then a sync, against the compose stack the gate already runs | `remarkable/`, `go test` with the stack's URL |
| Frontend | The QML in AppLoad's PC emulator — by hand at first | `remarkable/qml/` |
| Device | The spike's run script, extended: install, open, measure | by hand |

**The gate** runs `remarkable/`'s checks after the app's (whose build makes the
bundle), and cross-builds the backend for **amd64** (the tests' host),
**armv7** (the rM2) and **arm64** (the Paper Pro), so a change that breaks an
ARM build fails the gate. The **Dockerfile** gains a stage that builds the
backend for armv7 and arm64 and compiles the QML (`rcc`), and copies them into
`/srv/app/device/`.

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
- **Qt's SVG renderer** may not draw everything the chord box uses. To check in
  the emulator first; the fallback is drawing the diagram in QML from the
  bundle's diagram model (`diagramModel`) instead of its SVG.
- **Drawing speed.** How fast QML lays out a long sung song on the rM2 is
  unmeasured; paging (§7) bounds what is drawn at once.
- **AppLoad is GPL-3.** The backend is a separate process speaking a socket
  protocol; the QML imports AppLoad's module at run time. To be read before the
  reader is published.
- **Keys on the device vs. the account** (§5.4): kept on the device. Letting a
  key chosen at the stand reach the account would make the reader write — a
  later decision, not this one.
- **How the panel updates** (workflow 19 §What is checked on the device): the
  screens assume region-by-region updates with a fast one-bit waveform; phase 2
  measures it before the screens are built.

## 12. The order of work

1. **Plumbing.** The bundle's entry and `build:device` in the app; the
   `remarkable/` module with the engine, a `sheet` command, and the
   integration test over the built bundle; the gate step and the three builds.
2. **The frontend, offline.** AppLoad hello world on the device; the song
   screen drawing rows and diagrams from a local book; the shelf and book
   screens. Measured on the rM2.
3. **Sync, by hand.** The backend syncs with a session pasted in for
   development: home book, books, change check.
4. **Pairing.** The API, the service, the web app's *Pair a device*, the
   reader's pairing screen; the read-only scope.
5. **Updates.** The manifest, the bundle's and the QML's self-update; the
   Dockerfile stage.
6. **Setlists and polish.** Play through a setlist; the missed-shape fill;
   paging and the stand's keys.

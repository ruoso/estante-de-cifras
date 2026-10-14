# The home book format

Depends on: DIRECTION §3.1, §3.2, §3.3, §3.7; workflows 1, 8, 13. This
document fixes the on-disk shape of the **home book** — the per-user git
repository that holds personal state — and the merge that keeps it conflict-
free. It settles the open decision DIRECTION §6 recorded, and it is the
specification `storage.home_book` implements and tests against and
`hook.home_book` validates against.

It is written in the register of the cifra.md specification: numbered
sections, RFC 2119 conformance language, a canonical-form section and an
open-questions close. It is not a cifra.md format — the home book's files are
the app's personal-state format, owned here, not songs — and nothing in the
cifra.md format (`cifra.md/`) defines or reads them.

## 1. Scope and conformance

The home book is a repository like any other (DIRECTION §3.2): it is cloned,
fetched, merged and pushed over the same git-over-HTTP as a songbook
([`api/openapi.yaml`](../api/openapi.yaml)), it starts local with no remote
and gains one when the user signs in (workflow 1), and it is private to one
account — `noindex`, no invitations, no members beyond the one owner (DIRECTION
§3.3). It differs from a songbook in two ways only: it is **committed
automatically** rather than on an explicit save (DIRECTION §3.2), and its
files are JSON that **merge key by key** so a user's preferences never reach a
conflict (workflow 8; workflow 9 does not apply to it).

The home book is a **settings repository**, not a songbook. The "and nothing
else" rule of DIRECTION §2.1 and workflow 14 is a songbook's; the home book's
allowed kinds are its own, fixed by §8 of this document.

### 1.1 Conformance language

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, MAY and OPTIONAL
are to be read as in RFC 2119.

Throughout, requirements name three actors:

- a **writer** — the code that produces a home-book file. In the app this is
  the Web Worker, the one owner of on-device data (DIRECTION §3.7); the main
  thread never touches it.
- a **merger** — the code that, given two divergent versions of the home book,
  computes the merged tree and commits it. The merger is the Worker's own,
  not git's: the home book never surfaces a git conflict (workflow 8), so the
  Worker reads the two sides' JSON and computes the result itself rather than
  relying on git's line-based text merge.
- a **validator** — the service's pre-receive hook, which checks a home-book
  push holds only well-formed canonical settings in the home book's allowed
  kinds (`hook.home_book`). The validator logs no file content (DIRECTION §3.3).

A writer and a merger are the same program here; the names separate the two
duties a test pins.

### 1.2 Terms

- **Register.** The unit of merge: a JSON object `{ "value": …, "at": … }`
  carrying one independently-settable value and the instant it was last set
  (§3).
- **Tombstone.** A register whose `value` is `null`, meaning the value was
  unset. A tombstone is a register like any other and is retained (§5.3).
- **Map.** A JSON object that is not a register: its members are keys whose
  values are registers or further maps. The merge recurses into maps and stops
  at registers (§5).
- **Opaque value.** A register `value` whose internal shape this format does
  not define — an instrument, a voicing rule, a saved shape (§4). The format
  fixes the key and the envelope; the music core and `design.instruments`
  (workflow 15) own the value. A writer MUST write an opaque value in its own
  canonical form (§6) so convergence stays byte-identical.
- **Device.** One installation of the app, identified by a **device id** (§2.3).
- **Instant.** A UTC ISO-8601 time to the millisecond (§3).

## 2. The repository

### 2.1 The tracked files

A home book holds exactly these, all at the root, and nothing else:

- `preferences.json` — the singleton preferences: theme, language, notation
  dialect (§4.1).
- `shelf.json` — the shelf: the books on it, their labels, links and order
  (§4.2).
- `instruments.json` — the user's instruments and voicing rules, as opaque
  values (§4.3).
- `shapes.json` — *my shapes*, keyed by instrument, tuning and chord (§4.4).
- `songs.json` — per song, the transposition and the variation in use (§4.5).
- `README.md` — titling the repository, exactly as the app writes it (§2.2).
- `.gitattributes` — exactly as the app writes it (§2.2).

There are no folders and no other files. A settings file that is absent is
read as the empty map `{}`: the app creates each lazily, the first time it has
something to put in it, and the merger treats a side that lacks a file as
having an empty one (§5). Each of the five settings files is independent; a
preference change rewrites only `preferences.json`, so the git history of a
home book stays legible and a push carries a one-file diff.

Only regular files, UTF-8, LF — the text rules of §6.3. The validator refuses
anything else (§8).

### 2.2 `README.md` and `.gitattributes`

`README.md` titles the repository (DIRECTION §2.1) and tells a person who
opens the repository in a git tool what it is. It is **exactly** these bytes
(UTF-8, LF, one trailing newline):

```
# Home book

This repository holds one person's Estante de Cifras settings. Its files are
JSON that merge key by key, the later change winning; it is written and merged
by the app, not edited by hand. The format is docs/home-book-format.md in the
estante-de-cifras repository.
```

`.gitattributes` is **exactly** these bytes (UTF-8, LF, one trailing newline):

```
* text=auto eol=lf
*.json merge=binary
```

The merger never relies on git to merge the settings files — it computes the
merge itself (§1.1, §5) and commits the result, so git's merge machinery is
never consulted in the app. `merge=binary` is for a bystander: a git client on
a computer that somehow merges the home book takes one side whole rather than
interleaving two JSON files into a corrupt one. Both files are held to the text
rules of §6.3 and checked by the validator against these exact bytes (§8).

### 2.3 Identifiers

- **Device id.** A writer generates one UUID per installation the first time
  the app runs and keeps it in local storage the Worker owns (the `meta` object
  store, outside the home book), never changing it. It identifies a device and
  so MUST NOT be a shared register — in the home book it appears only as a
  **namespace key**, in `shelf.json`'s local books (§4.2, §7); it is also the
  owner key of the device-local recents the Worker keeps in that `meta` store,
  outside the home book (§4.6). Because a device writes only under its own id,
  two devices' per-device home-book state syncs without ever colliding.
- **Book id.** For a book hosted on the service, the id the service gives the
  repository ([`api/openapi.yaml`](../api/openapi.yaml)); it is stable across
  devices, so every device names a shared book the same way. For a local-only
  book, a UUID the writer generates when the book is created, kept under the
  originating device's namespace (§4.2) so two devices' local books never
  collide.
- **Song ref.** A song is named by its book id and its canonical path within
  that book, joined by a single `/`: `<book-id>/<path>` — for example
  `b7c1…/Chico Buarque/Construção.cifra.md`. The path is the song's path as
  §2.1 of DIRECTION finds it, NFC-normalised (§6.3). A song ref is the key
  under which per-song state (§4.5) is held in the home book, and also the key
  under which the device-local recents list is kept (§4.6) — the latter outside
  the home book.

## 3. The register envelope

Every independently-settable value is held in a **register**:

```json
{ "value": <any JSON value, or null for a tombstone>, "at": "<instant>" }
```

- `value` is the value. It is `null` only to mean the value was unset — a
  **tombstone** (§5.3); no key in this format uses a literal `null` as a
  meaningful setting, so `null` is unambiguous.
- `at` is the **instant the change was made, on the device that made it** — a
  UTC ISO-8601 time to exactly three fractional digits and a literal `Z`,
  matching `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$` (for example
  `2026-10-05T14:30:00.000Z`). A writer MUST write it in this form; a value
  obtained from a wall clock gives its millisecond reading.

A register MUST have exactly the two keys `value` and `at`, and nothing else.
This is also how a merger tells a register from a map without knowing the
schema (§5): **an object is a register if and only if its keys are exactly
`value` and `at`, with `at` a well-formed instant; every other object is a
map.** A writer therefore MUST NOT produce a map whose only keys are `value`
and `at`. The content of a register's `value` — even when it is an opaque
object — is never walked by the merger, so an opaque value that happens to
contain `value`/`at` keys is safe.

The merge granularity ("key by key", DIRECTION §6; workflow 8) is the leaf
register: the merge recurses into nested maps and resolves one register at a
time (§5). Two settings in the same file but under different keys never
interfere.

## 4. The settings files

Each file is a map (§3) at its root. The sections below fix each file's keys
and which values are opaque. Unless a value is called opaque, it is a value
this format defines.

### 4.1 `preferences.json`

A flat map of singleton preferences, each a register:

```json
{
  "theme":      { "value": "palco",   "at": "2026-10-05T14:30:00.000Z" },
  "language":   { "value": "pt-BR",   "at": "2026-10-05T14:29:12.500Z" },
  "notation":   { "value": "<opaque>", "at": "2026-10-05T14:29:12.500Z" },
  "authorName": { "value": "Marina Souza", "at": "2026-10-05T14:29:12.500Z" }
}
```

- `theme` — the chosen theme: `"estante"`, `"caderno"`, `"palco"` or
  `"automatic"` (workflow 1). The register is absent until the user chooses;
  while absent, the app's theme is automatic, following the device's light or
  dark mode (workflow 1), which is a per-device matter and is not written here.
- `language` — the chosen language tag (workflow 1). Absent until chosen; while
  absent the app follows the browser.
- `notation` — the notation dialect. Its value is **opaque** to this format;
  the music core owns the set of dialects.
- `authorName` — the author's display name, as it will appear in a song's
  history (workflow 4 §Who made the change). The first save asks for it once and
  keeps it here; it is the commit author's name, distinct from the no-reply
  address the id forms (§3.2). Absent until the first save; after sign-in the
  account's name is offered in its place.

### 4.2 `shelf.json`

Two maps: the shared books, keyed by book id, and the local-only books,
namespaced by device id (§7).

```json
{
  "books": {
    "<book-id>": {
      "label":    { "value": "Turma de quarta", "at": "…" },
      "link":     { "value": "https://estantedecifras.app/…", "at": "…" },
      "position": { "value": 2, "at": "…" }
    }
  },
  "local": {
    "<device-id>": {
      "<local-book-id>": {
        "title":    { "value": "My songs", "at": "…" },
        "position": { "value": 0, "at": "…" }
      }
    }
  }
}
```

- `books` — books hosted on the service, shared across the account's devices.
  Each entry is a map of three registers: `label`, the user's label for the
  book; `link`, its clone URL; and `position`, its place in the shelf's order.
  **Only the link and the label are written** — access itself is the account's,
  held by the service, so nothing secret is written down (workflow 13).
- `local` — books that were never put online, which have nothing on the service
  to clone (workflow 13). They are namespaced by the device that holds them, so
  a new device can list one as *only on your iPhone* (workflow 13) and two
  devices' local books never merge into one. Each entry is a map with `title`
  and `position`.
- `position` — an integer order key; the shelf is shown in ascending
  `position`, local books interleaved with shared ones by the app's rule. A
  reorder rewrites the positions it moves.

### 4.3 `instruments.json`

The user's instruments and their voicing rules, keyed by instrument id. The
**values are opaque**: this format fixes the keys and the envelope, not the
instrument schema, which `design.instruments` (workflow 15) and the music core
own.

```json
{
  "<instrument-id>": {
    "definition": { "value": <opaque>, "at": "…" },
    "rules":      { "value": <opaque>, "at": "…" }
  }
}
```

Each instrument is a map of two registers so the instrument's definition (its
tunings) and its voicing rules merge independently. A removed instrument is a
tombstone on each register (§5.3).

### 4.4 `shapes.json`

*My shapes* — how the user plays a chord on an instrument, used wherever a song
has chosen none (workflow 2). Keyed by instrument id, then tuning, then chord;
the leaf register's **value is the opaque shape**:

```json
{
  "<instrument-id>": {
    "<tuning>": {
      "<chord>": { "value": <opaque shape>, "at": "…" }
    }
  }
}
```

The chord key is the chord as the music core matches it — by chord, not by
spelling, so a shape saved for `Cmaj7` serves a song that writes `C7M`
(workflow 2). The tuning key and the shape value are opaque to this format.

### 4.5 `songs.json`

Per song, the reading state that is the user's, not the song's: how far it is
transposed, and which variation is in use per tuning (workflow 2). Keyed by
song ref (§2.3):

```json
{
  "<song-ref>": {
    "transposition": { "value": 2, "at": "…" },
    "variation": {
      "<tuning>": { "value": "<variation-id>", "at": "…" }
    }
  }
}
```

- `transposition` — the semitone offset the song is read at, a signed integer;
  `0` or the absent register means the written key (workflow 2). It is
  remembered per song (*transposed to D (+2)*, workflow 2).
- `variation` — a map keyed by tuning, each a register whose value names the
  variation in use for that tuning. The variation id is opaque.

### 4.6 Recents (not a home-book file)

The recently opened songs are **device-local and not synced** (workflow 2
L17-20; DIRECTION §3.2). They are **not** a home-book file: the app keeps them
in the `meta` store the Worker owns (§2.3), keyed by song ref, newest first,
outside the home book. They are never written into the home book, never
committed, never pushed and never merged — a song open would otherwise cost a
home-book commit per open, which the direction rules out. Recents are also not
among what comes down to a new device (workflow 13): "recents are kept per
device, so there is no 'most recently played' to go by", and device-bound state
stays on the device. A device's recents are disposable; they are lost with a
lost device, by design (§7).

## 5. The merge

The merge is a pure binary function over two home-book trees — a side's JSON
and the other's. It is commutative and associative (§5.4), so the merger may
apply it to the two divergent sides in either order and needs no common base:
the registers carry everything the result depends on. A side that lacks a file
(§2.1) is the empty map `{}`.

### 5.1 Merging two registers

Given two registers for the same key:

1. The register with the **greater `at`** wins — "the later change wins, by the
   time each was made" (workflow 8).
2. On **equal `at`**, the tie-break: canonicalise each register's `value`
   (§6) and compare the two as UTF-8 byte sequences; the register whose
   canonical value is **lexicographically greater** wins. If the canonical
   values are equal the registers are equal and either may be taken.

The tie-break is total, commutative and deterministic, so every device
resolves an equal-time clash the same way regardless of merge order (§5.4).

### 5.2 Merging two maps

Given two maps, the result has the union of their keys. For a key on **one**
side only, that side's subtree is taken unchanged. For a key on **both** sides,
recurse: two registers resolve by §5.1, two maps by §5.2. A key that is a
register on one side and a map on the other is a malformed home book (§3); the
merger does not produce one and the validator refuses one (§8).

### 5.3 Tombstones

A tombstone (`value: null`, §3) is a register, so it merges by §5.1 like any
other: a later unset (a tombstone with a greater `at`) removes a key, and an
earlier unset loses to a later value that reinstates it. Tombstones are
**retained**, not dropped, so the deletion keeps winning against an older value
still held on a device that has not yet merged. (Compaction is an open
question, §Open questions — not required for correctness.)

### 5.4 Why it converges

`at` is a total order on instants; the §5.1 tie-break is a total order on
canonical values; their lexicographic combination is a total order on
registers, and "take the greater" (max) over a total order is commutative and
associative. Map merge is union with per-key recursion, itself commutative and
associative. So any number of devices, merging in any order, converge on the
same tree — and, written in canonical form (§6), on the same bytes. The
automatic merge commit is therefore reproducible and carries no spurious diff.

## 6. Canonical form

Every home-book file has exactly one **canonical form**, and a writer and a
merger MUST write it. Canonical form has these properties:

- **It is unique.** Two writers given the same model produce the same bytes, so
  two devices that converge to the same state (§5.4) write byte-identical files
  and the automatic merge commit is reproducible.
- **It is a fixed point.** Canonicalising a canonical file changes nothing,
  which is how the validator checks one: write it back from what was read, and
  if a byte differs it was not canonical.
- **It depends on the content alone.** Nothing in it depends on the device, the
  order keys were added, or the merge path that produced it.
- **It reads back as its own model.**

**Canonical form takes precedence over preserving the bytes.** A file holding
anything non-canonical is never written and never pushed, exactly as a song is
held to its canonical form (workflow 14; DIRECTION §2.1). The validator refuses
a non-canonical settings file (§8).

### 6.1 What canonicalising does

Canonicalising a home-book file:

- **sorts every object's members** by the Unicode code points of the member
  name, ascending, at every depth — including maps keyed by book id, device id,
  instrument, tuning, chord and song ref, and the two keys of a register
  (`at` before `value`);
- **keeps every array's order** — an ordered opaque value is meaningful in
  order and is not sorted;
- **re-emits numbers and strings** in the forms of §6.2;
- **normalises all text to NFC** and emits the bytes of §6.3.

An opaque value (§1.2) is canonicalised by the same rules — sorted object keys,
§6.2 scalars — so the module that owns it MUST produce JSON these rules leave
unchanged.

### 6.2 Numbers and strings

- **Numbers** are finite and written in the shortest decimal that round-trips
  to the same IEEE-754 double (the form JavaScript's `Number.prototype.toString`
  produces): no leading `+`, no leading zeros, no trailing fractional zeros, no
  exponent for the magnitudes this format uses. The numbers this format defines
  are small integers (semitone offsets, order keys); an opaque value SHOULD keep
  to integers and exactly-representable decimals so its canonical form is stable
  across implementations.
- **Strings** escape only what JSON requires — `"`, `\`, and U+0000–U+001F —
  using the short escapes `\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t` where they
  exist and `\u00XX` with lowercase hex otherwise. Every other character,
  including every non-ASCII character, is emitted literally as UTF-8. The
  solidus `/` is never escaped.

### 6.3 The bytes

A canonical home-book file:

- is UTF-8, with no U+FEFF byte-order mark anywhere;
- is NFC-normalised;
- has lines separated by LF, with no CR anywhere;
- is pretty-printed — one member or element per line, two-space indentation per
  level, `": "` between a member name and its value, `", "` collapsed to a
  trailing `,` at each line — so that a one-register change is a one-line diff;
- ends with exactly one LF after its last line.

An empty map is written `{}` followed by one LF.

## 7. Per-device state

The home book's per-device state is the **local-only-book markers** (§4.2),
namespaced by device id (§2.3). This reconciles two settled behaviours:

- A device writes and reads only its **own** namespace, so a local-only book is
  listed as *only on this iPhone* on the device that holds it (workflow 13
  L45-50) and never confused with another device's.
- The namespaces nonetheless **sync**, riding in the home book like every other
  file, so the record of a local-only book a device held is not lost with it —
  it remains under that device's id in the account's home book, where a recovery
  flow can reach it. Two devices **never collide**: because each writes only
  under its own id, the §5 merge unions the namespaces (a map union) and never
  has to reconcile two devices' markers.

**Recents are also per-device, but are not a home-book file** (§4.6). They are
device-local and not synced (workflow 2 L17-20): never written into the home
book, so there is no cross-device "most recently played" to go by (workflow 13)
and nothing to merge. Unlike a local-only-book marker, a device's recents are
disposable — losing them with a lost device is acceptable and matches the
direction (workflow 13 L52-55: device-bound state "stays on the device …
Nothing travels, and nothing pretends to").

A device id is never a shared register and never leaves the namespace-key
position (§2.3), so per-device state cannot leak into the account-wide settings.

## 8. Allowed kinds and validation

The home book's allowed kinds are the seven files of §2.1 at the root, and
nothing else. This is the whitelist the validator (`hook.home_book`) enforces
for a home book, in place of the songbook whitelist of workflow 14. A push to a
home book is refused whole, naming what failed, if it carries:

- any path other than the seven of §2.1, or any folder, symlink, submodule,
  non-regular or executable file;
- a `*.cifra.md` or `*.setlist.md` song or setlist — those belong in a songbook,
  not the home book;
- a settings file that is not well-formed JSON in canonical form (§6), or that
  breaks the envelope of §3 (an object that is neither a register nor a map, a
  register missing `value` or `at`, a malformed `at`, a register/map mismatch
  under one key, §5.2);
- a `README.md` or `.gitattributes` that is not the exact bytes of §2.2;
- a file over the per-file size limit (the **256 KB** of workflow 14 applies;
  a home book is far smaller) or a home book over its account's limits.

The validator checks every blob reachable from a new commit, not only the last
one, and the one-ref, fast-forward-only and no-stowaway guards of workflow 14
apply to the home book as to any repository. It logs request metadata only: no
settings value, no label, no link, no song ref is ever logged (DIRECTION §3.3).

The service recognises the account's home book as its own repository kind and
forwards that kind to the hook through the `ESTANTE_*` environment it already
passes (`service.git_http`); the hook is not left to guess a repository's kind
from its contents. Standing up that recognition and this validation is
`hook.home_book` (§Conformance).

## 9. Conformance

- A **writer** MUST write every settings file in canonical form (§6) with the
  envelope of §3, MUST keep a device id out of every shared register (§2.3), and
  MUST write `README.md` and `.gitattributes` as the exact bytes of §2.2.
- A **merger** MUST implement §5 — register resolution by greater `at` with the
  equal-time tie-break (§5.1), map union with per-key recursion (§5.2), and
  tombstone retention (§5.3) — as a function that is commutative and associative
  (§5.4), MUST compute the merge itself rather than through git (§1.1), and MUST
  write the merged tree in canonical form and commit it automatically
  (DIRECTION §3.2).
- A **validator** MUST enforce §8 and MUST log no file content.

`storage.home_book` is the writer and merger in the app and pins §3, §5 and §6
in its tests: the key-by-key merge, the later change winning, the equal-time
tie-break, and the reproducible canonical auto-commit. `hook.home_book` is the
validator and pins §8. Neither exists yet; this document is what both
implement.

## Open questions

Two matters are accepted design limitations, not blockers, and neither is a
WBS task:

- **Wall-clock skew under last-write-wins.** `at` is a device's wall clock, so
  two of a user's devices with skewed clocks can let an older edit win by its
  later timestamp. This is bounded — a single user's own few devices, whose
  clocks are network-synced in practice — and the equal-time tie-break (§5.1)
  guarantees convergence even when two clocks read the same instant. A hybrid
  logical or vector clock would survive skew but imposes a clock-reconciliation
  burden and larger files for no user-visible benefit on a single-user
  preferences store, and it contradicts DIRECTION §6's "a time on every key".
  Deferred.

- **Tombstone pruning.** Tombstones are retained (§5.3) so a deletion keeps
  winning against a stale value on a not-yet-merged device. Over a long life a
  home book accumulates them. A future compaction — dropping a tombstone once
  every device is known to have merged past it — is an optimisation, not
  required for correctness, and reads harmlessly today (an extra tombstone only
  ever loses to a later value or re-confirms a deletion). Deferred.

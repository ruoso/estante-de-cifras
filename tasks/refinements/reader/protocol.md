# reader.protocol — The AppLoad socket and the reader's messages

## TaskJuggler entry

`tasks/85-reader.tji`, `task protocol` under `task reader` →
`reader.protocol`. Milestone: `milestones.m7_reader`
(`tasks/99-milestones.tji` L58–61).

## Effort estimate

1d.

## Repository

Not under `cifra.md/` (the note does not start with `cifra.md:`). The work
lands in:

- `remarkable/internal/protocol/` — new package: `frame.go` (the AppLoad
  wire), `messages.go` (the reader's message table), `frame_test.go`,
  `messages_test.go`.
- `docs/remarkable-reader.md` §6 — the design delta this refinement makes
  (below); it rides in the task's commit.

Nothing in `cmd/estante-reader` changes: running as `backend/entry` and
answering `hello` is `reader.app_folder`'s.

## Inherited dependencies

- `reader.module` (complete 100) — the `remarkable/` module
  (`estantedecifras.app/remarkable`, go 1.26.0), and `scripts/gate`
  L334–347, which runs `go vet`, `go test -p "$JOBS" ./...` and the three
  CGO-free cross-builds (amd64, arm GOARM=7, arm64). A new package under
  `internal/` is picked up by `./...` with no gate change.
- `reader.engine` (complete 100, not a `depends`) — its exported types
  (`remarkable/internal/engine/engine.go`: `Sheet` L136–146, `Shape` L127,
  `SetlistItem` L150, `Setlist` L160) are what the backend will turn into
  `sheet` and `setlist` messages. This task does not import the engine: the
  message types are the wire's, and the mapping is `reader.app_folder`'s.

Downstream: `reader.app_folder` (`depends !engine, !protocol,
!qml_harness`) runs the backend over this package; `reader.song_screen`,
`reader.browse_screens`, `reader.play`, `reader.sync`, `reader.pairing`
send and answer the messages it defines.

## What this task is

A Go package that speaks AppLoad's backend protocol exactly as rm-appload
implements it — connect to the `SOCK_SEQPACKET` unix socket AppLoad passes
as `argv[1]`, read and write messages of an 8-byte header record and a
payload record, recognise AppLoad's three system messages — and, over it,
the reader's own message table (docs/remarkable-reader.md §6) as typed Go
values encoded as JSON, where a message type or a field the other side does
not know is ignored. It is plumbing with no behaviour of its own: no
dispatch, no state, no logging.

## Why it needs to be done

The backend and the QML frontend share nothing but this socket (design §3,
§3.3: the frontend draws what it is sent and sends back what was tapped).
Every screen task after `reader.app_folder` adds a message or answers one;
fixing the wire and the vocabulary once, with each message round-tripped in
tests, keeps those tasks to their screens. The wire has two traps that only
a reading of AppLoad's source shows (two records per message; an empty
payload record reading as end of connection) and one only the kernel shows
(a record larger than the socket's send buffer is refused) — each would
desynchronise or end the connection on the device, where it is hardest to
see.

## Inputs / context

- `tasks/85-reader.tji` `task protocol` — the note: SOCK_SEQPACKET at
  argv[1] (`net.Dial unixpacket`), 8-byte header (int32 type, int32 length,
  native order), UTF-8 payload ≤ 10 MiB, types −1/−2/−3, the §6 table, JSON
  payloads, an unknown type ignored. Tests: unit.
- `docs/remarkable-reader.md` §3.2 (L185–199) — the backend's four parts;
  protocol is one. §3.3 — the frontend holds no state the backend needs.
  §5.4 — the reader's own state (key, place in a setlist, hidden shapes,
  shapes shown) kept on the device. §6 — the message table (as amended by
  this task, below). §9 — "Unit (Go): protocol framing … `go test`". §10 —
  no song text in a log.
- `docs/workflows/19-remarkable-reader.md` — what the messages must carry:
  §Pairing (L100–121: the code, *This code works until 14:42*, *That code has
  expired.*, the no-Wi-Fi line), §The shelf (L123–152: *32 songs · 4
  setlists*, the sync line in its three wordings, Settings with the account,
  the version, Sign out), §A book (L154–173: setlists with *12 songs*), §A
  song (L175–282: the key button *D (+2)*, the key grid naming *As written*
  and *Your key*, a key chosen kept on the device until *As written*, a
  voicing hidden by tuning, chord and frets, *8 · 11 hidden*, *Show hidden*,
  *Show all again*, *Hide shapes* kept for every song, a keyless song's key
  note), §A setlist (L284–307: each item's key and note, *missing*, Play's
  *3 of 12 · Garota*, *Next: Asa Branca, in G* and its note, Back to the
  playing song's page).
- rm-appload, commit `df974a6d641f37492df04013c53df2e5d6403488`
  (2026-10-06), github.com/asivery/rm-appload — the protocol's definition:
  - `src/protocol.h` — `MESSAGE_SYSTEM_TERMINATE -1`,
    `MESSAGE_SYSTEM_NEW_COORDINATOR -2`, `MESSAGE_SYSTEM_LOST_COORDINATOR
    -3`, `MAX_MESSAGE_LENGTH 10485760`, `struct PacketHeader { int type;
    int messageLength; }`.
  - `src/management.cpp` L37–58 `sendMessageTo`: the header and the payload
    are **two `send` calls** — two records on a SEQPACKET socket; a
    zero-length payload is still sent, as an empty record.
  - L135–201 `_listeningThread`: AppLoad binds and listens, the backend
    connects; it reads the header with one `read`, ends the connection when
    `messageLength > MAX_MESSAGE_LENGTH`, and reads a payload record **only
    when the length is above zero**.
  - L17–35: `-2` is sent when a frontend registers (and at the backend's
    connect if one already has), `-3` when one unregisters, each with the
    number of frontends now attached as a decimal string; L60–79 `terminate`
    sends `-1` with `close`, then closes the socket.
  - `backends/appload-clients/rust-backend/src/lib.rs` — AppLoad's own
    backend client, the same two-record framing (`u32` header fields, the
    same bits).
- Linux: a unix `SOCK_SEQPACKET` record goes through `unix_dgram_sendmsg`,
  which refuses one larger than the sender's `sk_sndbuf − 32` with
  `EMSGSIZE`; `getsockopt(SO_SNDBUF)` returns `sk_sndbuf`. Default
  `wmem_max` here is 212 992. A sheet as `estante-reader sheet` prints it
  for the largest choro fixture (`app/src/device/fixtures/choros/`, key +3)
  is about 62 KB indented — well within it, but not 10 MiB.
- Go: `net.Dial("unixpacket", path)` gives a `*net.UnixConn`;
  `ReadMsgUnix` reports `MSG_TRUNC` in its flags; Go reads a zero-byte read
  on a non-datagram socket (SEQPACKET included) as `io.EOF`.
  `encoding/binary.NativeEndian` is the native order.
- `tasks/refinements/reader/engine.md` — the conventions this package
  follows: the package logs nothing; exported sentinel errors usable with
  `errors.Is`; an error names what failed, never a song's words; JSON in
  camelCase, rows and diagrams kept as `json.RawMessage`; tests named
  `TestXxx` in plain English, each saying what it pins.

## Design delta (this task)

`docs/remarkable-reader.md` §6 is amended, in this task's commit:

1. **The wire** gets its own paragraph, as rm-appload defines it: AppLoad
   listens and the backend connects; a message is two records; a zero-length
   payload is never sent; a length above 10 MiB ends the connection; the
   payload is checked against the socket's send buffer before the header is
   written; the payloads of −1, −2, −3.
2. **The table is completed against workflow 19.** The design's table had no
   way to keep the reader's own state of §5.4 (hide a voicing, show it again,
   show all again, hide or show the shapes, the place in a setlist), no
   settings page, no expired or offline pairing, no online flag for *Not
   connected — showing what was synced at 09:10*, no saved key for *Your
   key*, no `hidden` on a shape, no key, note or *missing* on a setlist
   item, and nothing for Play's *3 of 12* and *Next:* line. Added: types 7
   `hideShape`, 8 `showShape`, 9 `showAllShapes`, 10 `shapesShown`, 11
   `place` to the backend; 107 `settings` to the frontend; `open` gains
   `{ view: "settings" }` and a song's `play`; `key { offset: null }` is *As
   written*; `state`, `pairing`, `book`, `sheet` and `setlist` gain the
   fields the workflow draws. Existing types keep their numbers and names.

## Constraints / requirements

- **CGO-free, the module's three targets.** Only the standard library
  (`net`, `syscall`, `encoding/binary`, `encoding/json`); no new
  dependency. Builds for linux amd64, arm (GOARM=7), arm64 in the gate.
- **The wire, byte for byte as AppLoad's.** Header record exactly 8 bytes,
  `int32 type` then `int32 length`, `binary.NativeEndian`; then one payload
  record of exactly `length` bytes when `length > 0`, none when 0.
- **Receiving.**
  - A header record that is not exactly 8 bytes (short, or `MSG_TRUNC`) is a
    protocol error (`ErrFrame`).
  - A length below 0 or above `MaxPayload` (10 485 760) is a protocol error
    (`ErrTooLarge` for the latter), and the connection is closed, as AppLoad
    does.
  - A payload record whose size differs from the header's length (short, or
    `MSG_TRUNC`) is `ErrFrame`.
  - A header of length 0 yields a message with an empty payload and reads no
    payload record, as AppLoad's reader does.
  - Protocol errors are terminal: the `Conn` is closed and every later call
    returns the same error. End of connection is `io.EOF`.
- **Sending.**
  - An empty payload is refused (`ErrEmpty`) and nothing is written — AppLoad
    would read no payload record, and the reader on the other side would
    take its empty record as end of connection.
  - A payload above `MaxPayload`, or above the socket's send bound
    (`SO_SNDBUF − 32`, read once at connect), is refused (`ErrTooLarge`)
    **before the header is written**, so a refused send leaves the stream
    intact. At connect the `Conn` asks for a send buffer of 4 MiB
    (`SO_SNDBUF`; the kernel caps it at `wmem_max` and the effective value is
    what is read back).
  - Header and payload are written under one mutex, so concurrent senders
    never interleave records.
- **System messages.** −1 decodes to `Terminate`, −2 to `Attached{Frontends}`,
  −3 to `Detached{Frontends}` (the decimal payload; an unparsable count is a
  `PayloadError`, not a protocol error). The backend never sends a negative
  type (`Send` refuses one, `ErrType`).
- **The table.** Every type of the amended §6 is a Go struct with a
  `Type() int32` method and camelCase JSON tags exactly as §6 writes them;
  optional fields are pointers or `omitempty` as §6 marks them (`offset?`,
  `play?`, `error?`, `at?`); `null`-able values (`lastSync`, `key.saved`,
  `keyNote`, `next`, `key`'s `offset`) are pointers. `rows`, `notes` and a
  shape's `model` are `json.RawMessage`, passed through untouched (design
  §6: the frontend draws `chartRows` exactly as the web app receives them).
- **Ignoring what is not known.** `Decode` of a frame whose type is not in
  the table returns `ErrUnknownType`; `Conn.Next` skips such frames and
  returns the next known message. Unknown JSON fields are ignored (no
  `DisallowUnknownFields`). A known type whose payload is not valid JSON for
  it is a `*PayloadError` naming the type, and the connection continues.
- **No song text in errors** (design §10, the standing rule). No error string
  carries a payload's bytes: `PayloadError` names the type and the JSON
  error's class and offset, never the payload. The package logs nothing.
- **No dispatch here.** What the backend answers to `hello`, what `open`
  computes, what the store keeps — those are the screen and sync tasks'.

## Acceptance criteria

### Behavior delivered

1. `protocol.Dial(path string) (*Conn, error)` connects to AppLoad's socket;
   `protocol.NewConn(*net.UnixConn) (*Conn, error)` wraps one already open
   (tests' socketpairs).
2. `(*Conn) Receive() (Frame, error)` and `(*Conn) Send(Frame) error` —
   `Frame{Type int32; Payload []byte}` — move one message each, with every
   rule of §Constraints.
3. `Decode(Frame) (Message, error)`, `Encode(Message) (Frame, error)`,
   `(*Conn) Next() (Message, error)` (skipping unknown types),
   `(*Conn) Write(Message) error`, `(*Conn) Close() error`.
4. One Go type per row of the amended §6 table plus `Terminate`, `Attached`,
   `Detached`; constants `MaxPayload`, `TypeTerminate`, `TypeAttached`,
   `TypeDetached`, and one per message type.
5. Sentinels `ErrFrame`, `ErrTooLarge`, `ErrEmpty`, `ErrType`,
   `ErrUnknownType`, `ErrClosed`; `*PayloadError{Type int32}`.

### Tests, by level

**unit (go test, `remarkable/internal/protocol/frame_test.go`)** — each over
a `syscall.Socketpair(AF_UNIX, SOCK_SEQPACKET)`, one end a `Conn`, the other a
raw peer playing AppLoad's side with `send`/`recv` of separate records:

- `TestReceiveTwoRecords` — the peer sends an 8-byte native-order header and
  then the payload as a second record; `Receive` returns the type and the
  payload. Pins rm-appload `management.cpp` L37–58 (two `send`s) and the
  design §6 wire paragraph.
- `TestSendTwoRecords` — `Send` writes a record of exactly 8 bytes whose
  bytes equal `binary.NativeEndian` of the type and length, then one record
  of exactly the payload. Pins `protocol.h` `PacketHeader` and §3.2 "native
  order".
- `TestDialConnectsToArgvPath` — a `net.ListenUnix("unixpacket", …)` at a
  temporary path plays AppLoad (it listens, the backend connects); `Dial`
  reaches it and a message goes each way. Pins `management.cpp` L135–158.
- `TestReceiveRefusesOverLimit` — a header of length `MaxPayload + 1` gives
  `ErrTooLarge` and the `Conn` is closed; a negative length gives
  `ErrFrame`. Pins `MAX_MESSAGE_LENGTH` and AppLoad ending the connection
  (L188–191).
- `TestReceiveZeroLength` — a header of length 0 followed by a full message:
  the first `Receive` returns an empty payload without reading a record, the
  second returns the next message intact. Pins L192 (payload read only when
  the length is above zero).
- `TestReceiveBadRecords` — a header record of 12 bytes (`MSG_TRUNC` on an
  8-byte read), a header of 4 bytes, and a payload record shorter and longer
  than its header's length each give `ErrFrame`, and every later call
  returns it.
- `TestSendRefusesEmpty` — `Send` of an empty payload returns `ErrEmpty` and
  the peer receives nothing (a following message is the next record it
  reads). Pins the §6 rule that a zero-length payload is never sent.
- `TestSendRefusesOverLimit` — a payload of `MaxPayload + 1` returns
  `ErrTooLarge` with nothing written.
- `TestSendRefusesOverSocketBuffer` — with the `Conn`'s socket buffer set
  small (`SO_SNDBUF` 4096 before `NewConn` reads it back), a 64 KiB payload
  returns `ErrTooLarge` before the header is written, and the next small
  message reaches the peer as header then payload, in step. Pins the §6
  "never a header without its payload".
- `TestSendsDoNotInterleave` — 16 goroutines each send 50 messages whose
  payload names its type; every header the peer reads is followed by its own
  payload. Pins the mutex.
- `TestSystemMessages` — the peer sends −2 `1`, −3 `0`, −1 `close`, then
  closes: `Next` returns `Attached{Frontends: 1}`, `Detached{Frontends: 0}`,
  `Terminate{}`, then `io.EOF`. A −2 with payload `x` is a `*PayloadError`
  and the next message still arrives. Pins `protocol.h` L3–5 and
  `management.cpp` L17–35, L60–79.
- `TestSendRefusesNegativeType` — `Send` of type −1 returns `ErrType`.
- `TestCloseUnblocksReceive` — a `Receive` blocked on an idle peer returns
  `ErrClosed` once `Close` is called from another goroutine.

**unit (go test, `remarkable/internal/protocol/messages_test.go`)**:

- `TestEachMessageRoundTrips` — table-driven over every type of the amended
  §6 (1–11, 101–107) with its fields filled (a song written for the purpose,
  rows and a diagram model as raw JSON): `Write` on one end, `Next` on the
  other, the value equal. Pins design §6, row by row (the note: "each message
  of §6 round-trips").
- `TestWireNames` — for each type, the encoded JSON compared with a golden
  string written from §6's table (`{"view":"song","bookId":"b1","path":"a.cifra.md","offset":2,"play":{"setlist":"gig.setlist.md","at":3}}`,
  `{"offset":null}` for *As written*, `{"tuningId":…,"chord":…,"frets":"x45320"}`,
  a `sheet` with `key.saved`, `shapes[].hidden`, `play.next` null), so a
  field renamed in Go fails here before the QML sees it. Pins §6's field
  names.
- `TestRawPassThrough` — `rows`, `notes` and `model` come out byte-equal to
  what went in (no re-encoding). Pins §6 "`chartRows` exactly as the web
  app's chart receives them".
- `TestUnknownTypeIgnored` — frames of type 42 and 999 between two known
  ones: `Next` returns only the known ones, in order; `Decode` of type 42 is
  `ErrUnknownType`. Pins the note's "a type the other side does not know
  ignored".
- `TestUnknownFieldIgnored` — a `hello` of `{"later":true}` and an `open`
  with an extra field decode as if the field were absent. Pins §6's "and a
  field they do not know".
- `TestMalformedPayloadSaysNoWords` — an `open` whose payload is
  `{"view":` followed by a line of a song written for the purpose: `Next`
  returns a `*PayloadError` for type 2 whose `Error()` contains none of the
  payload's words, and the next message arrives. Pins design §10, no song
  text in a log.

No behavior, e2e-api or e2e-web level: the note names unit only, the package
has no collaborator but the kernel's socket (exercised for real by every test
above), and nothing user-visible runs over it until `reader.app_folder`,
whose own tests drive the backend over a socketpair.

## Decisions

1. **The §6 table is completed now, in this task, as a design delta.**
   Workflow 19 already decides every screen the messages serve; the design's
   table predates those details and has no way to keep §5.4's device state.
   Defining the full vocabulary here, round-tripped in tests, keeps the
   screen tasks from each amending the wire. Rejected: a §6-as-written
   protocol with each later task adding its messages — five tasks editing one
   table, each round-trip test arriving piecemeal, and `reader.app_folder`
   building its root against a table already known to be short.
2. **The frontend lays the strip out, so `sheet` carries every shape with
   `hidden`**, not only the shown ones: the strip's head counts the page's
   hidden shapes and *Show hidden* draws them, and pages are the frontend's
   (design §7, `reader.qml_chart`). Rejected: the backend filtering hidden
   shapes — the frontend could then not count or show them without another
   round trip, against rule 8.
3. **A voicing is named by `{ tuningId, chord, frets }`.** Workflow 19: what
   is hidden is "this chord in this voicing on this tuning: the frets, not the
   name", matched by chord, not spelling. `chord` is the engine's `Shape.key`
   (the chord identity my-shapes match by); `frets` the string the question
   shows (*x45320*). Rejected: the symbol — *C7M* and *Cmaj7* would hide
   apart.
4. **`key { offset: null }` is *As written***, which forgets the device's
   choice (workflow 19: a chosen key stays "until another is chosen or *As
   written*"); `{ offset: 0 }` would keep a choice of the written key and
   override a later saved key. One type, not a second message.
5. **Play rides `open` and `sheet`, with `place` to keep it.** A played song
   is `open { view: "song", …, play: { setlist, at } }` and comes back with
   `play { setlist, at, of, next }`; `place` tells the backend which item is
   playing so Back's `setlist` answer carries `at`. Rejected: a `play` view
   of its own — it is a song screen with three differences (workflow 19 §A
   setlist).
6. **Errors and offline are word codes, never sentences.** `state.error` is
   `offline` or `signedOut`; `pairing` says `{ expired: true }` or
   `{ offline: true }`. The words the person reads are the frontend's (four
   locales live there), and no backend error text can carry a payload.
7. **A send larger than the socket buffer is refused before the header.**
   AppLoad's two-record framing means a refused payload after a sent header
   would make AppLoad read the next header as this payload. Checking
   `SO_SNDBUF − 32` (read back after asking for 4 MiB) first keeps the stream
   intact, and a sheet (tens of KB) never reaches it. Rejected: one record of
   header plus payload — AppLoad reads the header with an 8-byte `read`, which
   on SEQPACKET would discard the rest of the record.
8. **An empty payload is refused on send and accepted on receive.** AppLoad's
   reader reads no record for length 0 but its writer sends an empty one;
   Go reads an empty SEQPACKET record as `io.EOF`. Every reader message is
   JSON (at least `{}`), so the backend never needs to send one; the
   frontend's sender likewise always sends JSON (`reader.app_folder`'s
   root). Receiving length 0 follows AppLoad's own reader.
9. **Protocol errors are terminal, payload errors are not.** A broken frame
   leaves no way to find the next header, so the connection ends, as
   AppLoad's does; a payload that parses badly is one message lost, and the
   next is intact.
10. **No `context.Context` on `Receive`.** The socket read is cancelled by
    `Close` (as `net.Conn` is), which the backend's shutdown already calls;
    the engine's contexts guard JavaScript calls, not I/O.

## Open questions

(none — all decided)

## Status

**Done** — 2026-11-01.

- `remarkable/internal/protocol/frame.go`: AppLoad's SOCK_SEQPACKET wire — `Dial` to the argv path, two records per message (8-byte header, payload), the 10 MiB limit, sends refused before the header when empty, oversized or above the socket's send bound (4 MiB requested by `Dial`), a broken frame ending the connection, and the system types -1, -2, -3.
- `remarkable/internal/protocol/messages.go`: the reader's §6 message table (types 1–11 and 101–107) as typed JSON; unknown types and fields skipped; optional values as pointers; HTML escaping off; `PayloadError` carries no payload text.
- `remarkable/internal/protocol/frame_test.go`: 13 unit tests over real socketpairs (two records both ways, size limits, bad records, no interleaving, system messages, `Close` unblocking `Receive`).
- `remarkable/internal/protocol/messages_test.go`: 6 unit tests (each message round-trips, wire names, raw pass-through, unknown type and field ignored, malformed payload).
- `docs/remarkable-reader.md` §6: the wire paragraph and message table completed against workflow 19.
- Tests are unit only, as scoped; no follow-ups registered.


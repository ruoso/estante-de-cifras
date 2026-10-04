# Estante de Cifras — Direction

Where the app is headed and why. It is not yet a design: it records the
decisions taken so far, the ones still open, and the workflows to be worked
through before anything is built. Each workflow gets a document of its own
under [workflows/](workflows/).

## 1. Why a new app

Estante de Cifras grows out of
[Explore Chords](https://github.com/ruoso/explore-chords), a chord explorer
that grew a songbook. This is the other way round: a shelf of songbooks you
play from, with the chord explorer as one of its features. That is a
different app, so it starts as one, and brings over the code worth keeping.

Explore Chords keeps everything in one browser's storage. That was a
deliberate non-goal ("any server, account, or sync"), and it held up — right
until the songs needed to be somewhere else. Its backup screen exists
because Android leaves a web app's data behind on a new phone, and a shared
song is a snapshot in a link: the person it was sent to never sees it
change.

What this app adds is that songs live beyond one device: on every device of
the person who wrote them, and with the people they share them with — a
teacher and their students, a band.

Two things Explore Chords got right carry over unchanged:

- **Offline first.** The app works in a lesson with no signal. Sync is
  something that happens when there is a network, never something the app
  waits for.
- **The text is the whole state.** A song is a cifra.md document, readable
  and editable anywhere. Nothing about a song is hidden in the app.

## 2. Books

A **book** is a collection of songs, and a book is a **git repository**. The
app holds as many books as the user loads, each a local clone.

Git is chosen because it already is what this needed:

- **A merge base for free.** Every commit is the base for a three-way merge,
  which a sync design would otherwise have to invent.
- **Forks are the teacher–student model.** A student forks the teacher's
  book, adds voicings for their own instrument, and keeps pulling the
  teacher's changes. Voicing blocks are per tuning, so those edits rarely
  touch the same lines, and a cifra-aware merge resolves most that do.
- **History is a feature.** Undo, what changed since last week, restoring an
  old version.
- **Openness.** A book is an ordinary repository, and can be downloaded as
  one: a zip of the repository, history and all, that any git tool opens.
  Nothing about a book is locked in the app or its host (§3.3).

Collaboration is therefore asynchronous: edit, save, sync, merge. Real-time
co-editing is out of scope.

### 2.1 Songs are found by name

A song is any file named `*.cifra.md` (cifra.md §1.2), anywhere in the book.
The app prescribes no layout. Folders are the user's to organise with, and
the app shows a song's folder and can filter by it.

Other `.md` files are not songs, even when they would parse as one, so that
search stays predictable. The file view may offer to rename one that parses.

A book's title is the level-1 heading of its README, or the repository name.

### 2.2 Merging

The cifra.md format makes a semantic merge tractable. Normalisation (cifra.md
§8) keeps the chart verbatim and the voicings part canonical, so:

- the chart merges line by line, as text;
- the voicings merge structurally, by tuning, variation and key;
- what genuinely collides is shown to the user to resolve in the editor,
  never written into the file as conflict markers.

The same merge ships as a git merge driver, so a desktop clone with
`*.cifra.md merge=cifra` in its `.gitattributes` merges songs the way the app
does.

## 3. Storage

Everything is in the browser: each book is a git repository on a filesystem
backed by IndexedDB, operated by isomorphic-git in a Web Worker.

- **A real working copy.** Each book is cloned with a working tree. What the
  user is editing is the working copy, written to storage as they type, so
  closing the tab loses nothing.
- **Explicit save.** Saving is a commit, and then a push (workflow 4).
  Persisting and versioning are separate: the working copy is always safe; a
  save is a version the user chose to keep.
- **A derived index** of every song — title, properties, sections, words,
  chords — keyed by blob hash, so a song is parsed once per distinct text,
  and a pull re-reads only the trees that changed. It covers the working
  copy too, so unsaved work is findable.
- **One lock per book** (Web Locks), since a git operation spans many
  IndexedDB transactions and two tabs must not interleave them.
- **`navigator.storage.persist()`**, and an export, because a book with no
  remote is still one phone away from being lost.

isomorphic-git is a runtime dependency, which Explore Chords avoided: its zip
writer was a hundred lines, but git's pack and delta formats are not, and a
bug in them corrupts data. The exception is deliberate.

### 3.1 Sync

Fetch, merge, push, retried when the push races another. With unsaved work
in the working copy, incoming changes are merged into it — base, theirs, and
the working text — so the user's edits stay unsaved and land on top.

Every git request to a hosted book goes through the app's one server
component (§3.3).

### 3.2 Personal state

Instruments, voicing rules, preferred notation, which variation is in use
and how far a song is transposed, *my shapes* — how the user plays a chord on
an instrument, used wherever a song has chosen none (workflow 2): none of
this belongs to a song. It lives in a **home book**,
a repository like any other but committed automatically — explicit save is
for what the user authors, not for preferences. One mechanism then replaces
both a backup and setting up each new device.

### 3.3 The one server

The app itself is static — a PWA served from a CDN, which scales without
limit and holds nothing. Behind it the project runs **one service**: a small
Node process in a container, with **PostgreSQL** beside it, on Railway.

- **Postgres** holds accounts, sessions and passkeys, and the book registry:
  each book's owner, its members and their roles, and its read link.
- **A volume** holds one bare git repository per book,
  `/data/books/<id>.git`.
- **The service** answers CORS for the app's origin only, signs users in,
  checks every request against the registry, and hands the git requests it
  allows to **`git http-backend`** — git's own HTTP server — over the
  repository on the volume. It also answers *has this book changed?* by
  reading one ref off the disk, so a client spends a fetch only on a book
  that did.

**The git server is git.** Every part of the protocol works — deltas,
negotiation, shallow fetches — so isomorphic-git in the browser and, later,
git on a computer both talk to it with nothing written for either. Two pushes
racing are settled by git's own ref locking. Forks (workflow 11) are copies
on the same volume.

**The browser only ever holds its session with the service.** It speaks git
to the service, never to storage, which is what keeps storage replaceable
(below). The cost is trust: every song passes through the service, which
holds accounts and the registry. That is a service with users' data in it,
which brings terms of service, a privacy policy and a way to handle a
copyright notice — books with words in them are copyrighted text.

**Estante is the only host in the first pass.** A book is on the device
only, or on Estante. What keeps that from being lock-in is that **any book
can be downloaded** as a zip of its git repository, history and all, and
uploaded back (workflow 7): a clone in a file, which any git tool opens and
any host accepts. Other hosts, GitHub first, are a later addition; nothing in
the design depends on there being only one, since every host speaks git.

**Everything runs locally as it runs in production**: the container and
Postgres under docker compose, so end-to-end tests sync against a real
server.

### 3.4 One instance, and what comes after it

A volume belongs to one instance, and the repositories must have one owner:
git coordinates writers with lock files, and a disk shared between machines
is a known way to corrupt a repository. So the service is a **single
instance**. That suits this app better than most:

- the load is small text repositories fetched now and then, and a ref read
  for the change check;
- the app is offline first, so a minute of downtime during a deploy is a
  push retried at the next sync, not an outage anyone sees.

**Durability** is the price of one disk. The volume is backed up, Postgres is
backed up, and a nightly `git bundle` of every book goes to object storage as
a second copy that does not depend on the host.

**When one instance is not enough**, the way on never shares a disk:

1. **Split the stateless part off.** Sign-in, the registry and permission
   checks run as many replicas as needed, and forward git requests to the one
   storage node.
2. **Shard books across storage nodes.** The registry says which node owns
   each book, and the API routes to it; each repository still has exactly one
   machine writing it. This is how the large git hosts scale.
3. **Or hand storage to a managed service** — Cloudflare Artifacts, or
   repositories in object storage with refs in Postgres — and have no disk at
   all.

All of it happens behind the service. The browser never knows where a book
lives.

### 3.5 What was considered

**Cloudflare Artifacts** — git storage driven from code, with repo-scoped,
expiring tokens and server-side forks — was the first choice. It needs a
database beside it anyway, it is in beta and billed per git operation, it
cannot be run locally, and it is not reachable from a browser directly: it
answers a CORS preflight with a 401 and no CORS headers (checked October
2026), so a server would sit in front of it regardless. isomorphic-git was
checked against a local server behaving as it does, and works. It remains the
managed option in §3.4.

**Git objects inside the database** — Postgres, or a Durable Object per book
— would put a book's permissions and refs in one transaction, at the cost of
writing a git server: the server side of the protocol is the code where a
subtle bug corrupts data, which is why the client uses isomorphic-git rather
than its own.

**Forgejo** would bring accounts, collaborators and forks ready-made, but
built for developers, with an interface and an account model the app would
spend its effort working around.

## 4. The interface

**Song search is the primary interface.** One search across every loaded
book: title, artist, sections, words, chords. Accent-insensitive, so
`coracao` finds *coração*. Each result says which book and folder it is in,
and whether it has voicings for the instrument in use, unsaved changes, or a
conflict. Books are a scope on that search; managing them is a screen of its
own.

Search never shows or changes a file name. A song created from search is
named once, from its title, and renaming it afterwards edits its heading,
not its file.

**The file view** is for advanced users, and shows the book as git sees it:
the tree with each file's status, a raw editor for any file, the book's log
with the files each commit touched, and plain line diffs. Renaming, moving
and deleting files happen only here.

Song history, in the song's own view, is the same log seen through the
format: a diff in musical terms ("Verse bar 5: G7 → D♭7; added voicings for
G4 C4 E4 A4"), and a default save message drawn from it. Restoring an old
version writes it into the working copy, to be saved as a new one; history is
never rewritten.

## 5. What comes over from Explore Chords

- **The music core and rendering** (`src/core/` except `song.js`,
  `src/render/`): pitch, chords, notation dialects, fingering search, finger
  assignment, scoring, heuristics, the voicing planner, diagrams. Pure,
  storage-free, and tested. Carried over as is.
- **The song parser is rewritten** as a standalone JS cifra.md library,
  written against the specification and its tests: parser, writer,
  normalisation, merge, semantic diff. Explore Chords' `song.js` diverged
  from the spec in about fifteen ways (Appendix B), several structural; its
  editing operations are the guide to what the library must offer.
- **The state layer and shell are not.** `store.js`, `persist.js`,
  `sheets.js` and `main.js` are built around one local library and have
  nothing to offer books.
- **UI components come piecemeal**: chord input, results, shape and wizard
  dialogs, the instrument form, chart layout, printing.
- **Infrastructure comes too**: i18n and its four languages, the PWA setup,
  the Playwright and axe harness, CI, and writing acceptance criteria before
  each phase.

### 5.1 No migration

Explore Chords has few users, and stays live for them. Nothing is migrated:
a song written there can be pasted into a new song here, and the parser
accepts the legacy forms (cifra.md Appendix A) it would need.

The music core comes over with its history (`git filter-repo` limited to
`src/core/` and `src/render/`), since the commit messages are where many of
its decisions are explained. So do the sections of Explore Chords'
`DESIGN.md` that describe it (§§2.10, 2.11, 4, 5, 6).

## 6. Open decisions

- **Framework.** Explore Chords' single store and one `render()` suited one
  local library. This app has asynchronous state from many directions — sync
  results, merges, a Web Worker's index. Vanilla with a sturdier component
  structure, or a small reactive library?
- **Sharing one song.** Explore Chords' link-in-the-fragment needs no host
  and could stay alongside books.
- **Where the cifra.md JS library lives.** Leaning towards the cifra.md
  repository, beside the Python reference, as the format's own JS
  implementation; the merge driver would ship from there.
- **Setlists.** Probably `*.setlist.md`, a Markdown list of relative links to
  songs, which reads correctly on any git host. Whether a setlist may point
  into another book is open; leaning no.

## 7. Workflows

To be worked through one at a time, in [workflows/](workflows/), each to the
point where its screens and its edge cases are known. Roughly in the order a
user meets them:

1. **First run** — what a new user sees, and how they reach a song.
2. **Find and play a song** — search, open, read, choose an instrument and a
   variation, offline.
3. **Write a new song** — from search, into which book, first save.
4. **Edit and save** — the working copy, unsaved changes, save, discard.
5. **Arrange for an instrument** — voicings for my tuning, variations, the
   wizard, inside a song someone else wrote.
6. **History** — what changed, restoring a version.
7. **Add a book** — create a local one, clone by URL, sign in to a host.
8. **Sync** — when it happens, what it shows, offline, a push that races.
9. **Conflicts** — what the user sees, how they resolve one.
10. **Share** — publish a book, invite a student or a bandmate, read-only
    versus editable, a single song by link.
11. **Fork** — making someone else's book my own, then pulling their updates.
12. **Setlists** — building one, playing through one at a gig.
13. **A new device** — signing in, getting the home book and the books back.
14. **The file view** — what an advanced user does there, and how it relates
    to the song views.

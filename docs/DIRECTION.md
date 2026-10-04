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

A setlist is any file named `*.setlist.md` (workflow 12). Besides songs and
setlists, a book holds a `README.md` and a `.gitattributes`, and nothing else:
every song and setlist in canonical form, and every push checked by the
service for all of it (workflow 14). A book is a songbook, not file storage.

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

Instruments, voicing rules, preferred notation, the theme, which variation
is in use and how far a song is transposed, *my shapes* — how the user plays
a chord on an instrument, used wherever a song has chosen none (workflow 2):
none of this belongs to a song. It lives in a **home book**, a repository
like any other but committed automatically — explicit save is for what the
user authors, not for preferences. One mechanism then replaces
both a backup and setting up each new device.

### 3.3 The one server

Everything runs on Railway at first, in a US region: traffic is expected to
be small, and one place to run is worth more than a CDN. The project runs
**one service**, a small Go program in a container, with **PostgreSQL**
beside it (§3.6). The same service serves the app — a static PWA, which the
browser installs and caches, so serving it costs little — at the root of
its domain, and its API beneath it. **One origin** for both: no CORS, a
session cookie that simply flows, and a passkey for the one domain.
Moving the app to a CDN later is possible but not free, since a shelf
belongs to the app's origin; it would keep the same domain.

- **Postgres** holds accounts, sessions and passkeys, and the book registry:
  each book's owner, its members and their roles, and its read link.
- **A volume** holds one bare git repository per book,
  `/data/books/<id>.git`.
- **A transactional email provider** sends the sign-in links that back up
  passkeys and recover an account (workflow 13). Small, but a dependency,
  and one whose mail has to stay out of spam folders.
- **The service** serves the app, signs users in,
  checks every request against the registry, and runs the git requests it
  allows with **git's own commands**, `git upload-pack` and `git
  receive-pack`, over the repository on the volume (§3.6). It also answers
  *has this book changed?* by reading one ref off the disk, so a client spends
  a fetch only on a book that did. A `pre-receive` hook, a Go program of its
  own, checks every push against what a book may hold, its canonical form, and
  the limits per book and per account (workflow 14).

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
backed up, both with Railway's own backups at first. *Later*, a nightly `git
bundle` of every book goes to object storage outside Railway, as a second
copy that does not depend on the host.

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

### 3.6 Components, and what each is written in

| Component | Written in | Lives in | Does |
|---|---|---|---|
| **The app** | JavaScript, React, a PWA | this repository, `app/` | Everything the user sees (§3.7). Git through isomorphic-git in a Web Worker; the music core from Explore Chords. |
| **cifra.md for JavaScript** | JavaScript | the cifra.md repository, `js/` | Reads and canonicalizes songs and setlists, merges, diffs in musical terms. The app's. |
| **The service** | Go | this repository, `service/` | Sign-in, the registry, sharing, the change check, and git over HTTP. |
| **The hook** | Go | this repository, `service/cmd/pre-receive` | Checks every push (workflow 14). |
| **cifra.md for Go** | Go | the cifra.md repository, `go/` | Reads and canonicalizes songs and setlists. The hook's; also a git merge driver for computers. |
| **The reference** | Python | the cifra.md repository, `reference/` | The specification's second opinion. |

**The app and the service share no code**, only the HTTP API and the format.
The API calls are cleanly separate from the interface, and the service never
needs to understand a song except to check that a push holds canonical
ones, which the Go implementation does in the hook.

**Implementations agree because they are checked, not because they are
shared.** That is what the specification is for. The corpus holds, for every
entry, the input, its model, the canonical text and the canonical model, and
each implementation must reproduce all four byte for byte, in both
directions. On top of the corpus, cifra.md's CI runs the same random
documents through the Python, JavaScript and Go implementations and
compares the bytes. A disagreement is a bug in one of them or a gap in the
specification, and is settled in the specification.

**Versions.** Each implementation says which version of the specification
it conforms to. When the canonical form changes, the service accepts the
previous form as well as the current one for a while (workflow 14), so the
Go hook carries both; the app carries only the current one, and rewrites
its saves not yet pushed when it updates.

**The merge driver for a computer** is built from the Go implementation as
one static binary, `git-merge-cifra`, the easiest thing to install where
there is no runtime to rely on. The app merges with the JavaScript one; both
are held to the same corpus.

**Inside the service**, nothing unusual: `net/http`; `pgx` for Postgres;
`go-webauthn` for passkeys; the email provider's HTTP API. One binary, with
git beside it in the image.

#### Git over HTTP

The service speaks git's smart HTTP protocol itself, the way Gitea, Forgejo
and GitLab do, rather than through `git http-backend` and CGI. Its part is
the HTTP; git does the rest.

- **`GET …/info/refs?service=…`** runs `git upload-pack` or `git
  receive-pack` with `--stateless-rpc --advertise-refs`, and the service
  writes the service header before git's output: `# service=…` as a
  pkt-line, then a flush.
- **`POST …/git-upload-pack`** and **`POST …/git-receive-pack`** run the
  same command with `--stateless-rpc`, the request body piped in and the
  output streamed back.
- The client's `Git-Protocol` header becomes `GIT_PROTOCOL` in the
  command's environment, so protocol v2 fetches work; a request body sent
  with `Content-Encoding: gzip` is decompressed on the way in.

The protocol, the packs, ref locking, the quarantine and running the hook
stay git's own. What the service gains by doing the framing:

- **Authentication and refusals are all its own, before git starts.** A
  request with no access, a book over quota, a book deleted: refused by the
  service with a clear message, git never spawned. What the hook refuses
  still reaches the client through git's own channel.
- **The hook knows who is pushing.** It inherits the environment of the
  `git receive-pack` that runs it, so the service sets `ESTANTE_USER`,
  `ESTANTE_BOOK`, `ESTANTE_ROLE` and what the account has left of its
  limits. The hook checks a push against the account's limits with no
  database connection of its own, and names the user in its messages.
- **Control of each request**: a size cap before git reads a byte, a
  deadline, and the git process killed when the client goes away.
- **Nothing hidden.** No `http-backend` rules about `REMOTE_USER`,
  `http.receivepack`, exports or dumb HTTP; only the two commands the
  service means to run.

The cost is owning about two hundred lines of framing, tested for gzip
bodies, protocol v2, and a client that disconnects mid-push.

#### The API

Written down as a contract, `api/`, and both sides tested against it:

- **Signing in**: registering a passkey and signing in with one; requesting
  and redeeming an emailed link; signing out; the signed-in devices and the
  passkeys, listed and removed (workflow 13).
- **Books**: the user's own, listed; creating one, empty and private;
  deleting one (owner only); forking one (workflows 7, 11).
- **The change check**: one request for a whole shelf, each book with the
  head the device has, answered with the books that moved (workflow 8).
- **Sharing**: the read link turned on, off or reset; members listed,
  their roles changed, removed; invitations made with a role, an expiry and
  a limit, listed with who joined, withdrawn, and accepted (workflow 10).
- **Git**: smart HTTP for each book. Reads for anyone the book is shared
  with, by session or read link; pushes for editors and the owner, and every
  push through the hook.

#### Repositories

```
estante-de-cifras/            cifra.md/
  app/        the PWA           spec/       the specification
  service/    Go                corpus/     the agreed bytes
    cmd/service                 reference/  Python
    cmd/pre-receive             js/         for the app
  api/        the contract      go/         for the hook, and git-merge-cifra
  docs/
  compose.yaml
```

**Locally, everything runs as in production**: `compose.yaml` brings up
Postgres, the service's image with git, the hook and the built app, and a
local mail catcher in place of the email provider, and the end-to-end tests
run against that one origin. While developing the app, its dev server proxies
the API to the service, so it is one origin there too. CI runs the app's
tests, the Go tests and the end-to-end tests here; the corpus and the cross-
implementation comparison run in cifra.md.

### 3.7 The app

**React, with React Aria Components**, chosen for the richest accessible
experience. The app is installed and cached up front, so its weight is not a
constraint; what is expensive to build well is accessible interaction on a
phone, a tablet and a computer alike — sheets, dialogs that hold focus,
menus, the shape picker, comboboxes, segmented controls, drag to reorder a
setlist — and React Aria is the most complete answer to it: keyboard and
screen-reader behaviour, press and touch handling that works on phones, drag
and drop with a keyboard alternative, and formatting by locale for the four
languages. Its components carry no look of their own, so the visual language
(`docs/mockups/theme.css`) applies as drawn.

- **One owner for the data: a Web Worker.** It holds git, the working copy
  and the search index, and does every clone, fetch, merge, save and index
  update. The main thread never touches IndexedDB.
- **The interface mirrors it.** A store on the main thread is fed by the
  Worker's messages, and components read the slices they need through
  `useSyncExternalStore`; the React Compiler keeps re-rendering to what
  changed. A sync finishing, a merge landing, a clone's progress: each is a
  message, and only what shows it moves.
- **Framework-free below the view.** The music core from Explore Chords and
  cifra.md for JavaScript know nothing of React; the view is the only layer
  that does.
- **The source editor is CodeMirror 6**: the cifra.md text with its syntax
  coloured, conflict markers, pasting into a fence, undo. Writing an editor
  is not worth it.
- **Charts are drawn by the app**, in a proportional face, as chords stacked
  over the syllables they belong to, with a centred hyphen where a chord
  opens room inside a word (`docs/mockups/`).
- **Tooling carries over from Explore Chords**: Vite, the PWA plugin, Vitest
  with Testing Library, Playwright, axe at WCAG 2.1 AA, and the i18n set-up
  with its four languages.

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
- **The song parser is rewritten** as the cifra.md library for JavaScript
  (§3.6), written against the specification and its corpus: parser, writer,
  canonical form, merge, semantic diff. Explore Chords' `song.js` diverged
  from the spec in about fifteen ways (Appendix B), several structural; its
  editing operations are the guide to what the library must offer.
- **The state layer and shell are not.** `store.js`, `persist.js`,
  `sheets.js` and `main.js` are built around one local library and have
  nothing to offer books.
- **UI components are rewritten in React** (§3.7), with Explore Chords'
  as the guide to what each must do: chord input, results, shape and wizard
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

- **The domain.** The service and the email both need one: the sign-in
  links are mailed from it, with the records that keep them out of spam
  folders. The app should be served from it too, rather than from GitHub
  Pages. Two reasons: a passkey is bound to the domain it was made for, so
  the app and the service must share one; and IndexedDB belongs to an
  origin, so moving the app later would leave every shelf behind. Something
  like `estantedecifras.app`, the app and its API on the one origin
  (§3.3). Which name, and where it is registered, is open.

## 7. Workflows

Worked through one at a time, in [workflows/](workflows/), each to the point
where its screens and its edge cases are known; all fourteen are decided, and
each is drawn on a phone, a tablet and a computer in [mockups/](mockups/),
with the visual language they share. Roughly in the order a user meets them:

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

## 8. Later

Deferred on purpose, with what is known so far.

- **The app stores.** People look for an app in their phone's store, and
  not finding one there confuses them, though the PWA needs none. Google Play
  takes a PWA as a Trusted Web Activity (Bubblewrap or PWABuilder), which
  loads the live site, so deploys need no review; it asks for a
  `/.well-known/assetlinks.json` at the domain's root (§6). The Microsoft
  Store takes a PWA much the same way. Apple's needs a native shell around a
  web view (Capacitor), a yearly fee and a review that rejects apps that are
  only a website — and would in return give the iOS app storage that is never
  evicted. Play and Microsoft first, when it is wanted; Apple when iPhone
  users ask.

# storage.git — isomorphic-git, the Worker's git transport

## TaskJuggler entry

`tasks/40-storage.tji`, `task storage.git "isomorphic-git"` (lines 22–27):

> Clone, fetch and push with credentials included to the one origin,
> protocol v1, a custom HTTP client; never getRemoteInfo2 for push. Tests:
> behavior (clone, fetch and push against a local git remote over HTTP;
> credentials included by the custom client; protocol v1; push never calls
> getRemoteInfo2).

`depends !fs`.

## Effort estimate

**3d**, as scoped in the `.tji`.

## Repository

estante-de-cifras. All code is app-side, framework-free, below the view:
production modules under `app/src/worker/`, test support under
`app/src/test/`. Not a `cifra.md:` task.

The app and the service share no code — only the API contract (`api/`) and
the format (DIRECTION §3.6 L277+, "Components, and what each is written
in"). This task writes the browser half of git over HTTP; the server half
is a separate task (`tasks/30-service.tji:42`), and the two meet only on the
wire.

## Inherited dependencies

- **storage.worker** — *settled, Done 2026-10-05.* Gives the Worker's
  injection seam `createWorkerLogic(port, options = {})`
  (`app/src/worker/logic.js:111`), the structured-cloneable protocol
  (`app/src/worker/protocol.js`), the loopback transport double
  (`app/src/test/loopback.js`), and — the load-bearing one here — the local
  git remote over HTTP, `startGitHttpRemote()`
  (`app/src/test/git-http-remote.js:145`): a real `git http-backend` behind
  `node:http` serving **smart HTTP protocol v1** (it deliberately does not
  forward `Git-Protocol`, so no v2 upgrade), seeding a bare repo with
  `seedBareRepo` and returning `{ url, root, repoDir, stop() }` with
  `url = http://127.0.0.1:<port>/repo.git`. worker.md Decision 5 built it
  "so storage.git / storage.working_copy / sync can test against it"; this
  task is its first real consumer.
- **storage.fs** — *settled, Done 2026-10-05.* Gives
  `createFileSystem(name, options = {})` (`app/src/worker/fs.js:144`),
  returning a `{ promises }` object that **is** isomorphic-git's documented
  `fs` contract — exactly the eleven methods `readFile, writeFile, unlink,
  readdir, mkdir, rmdir, stat, lstat, readlink, symlink, rename`
  (`fs.js:113–125`), bound onto a bare object so callers cannot reach
  lightning-fs extras. `logic.js:135–138` already memoises one such fs for
  the Worker and its comment notes "Books will become directories within it;
  the layout is storage.git's to settle" (`logic.js:133–134`,
  `fs.md:190–191`) — settled here (Decision 5). lightning-fs lives in its own
  IndexedDB database, outside `estante` (fs.md Decision 3). The test-side
  Web Locks shim `app/src/test/web-locks.js` (`makeLockManager`,
  `installWebLocks`) is needed in jsdom because lightning-fs's mutex touches
  `navigator.locks`.
- **storage.migrations** — *settled, Done 2026-10-05.* The `estante` DB
  migration framework; not touched here (lightning-fs owns its own DB).
- Transitively **foundation.app_tooling** (the Vite + React 19 PWA package,
  Vitest in jsdom via `app/vite.config.js`, `scripts/gate` running `vitest
  run`) and **foundation.api_contract**, whose
  `tasks/refinements/foundation/api_contract.md` pins the three git routes
  (`GET …/git/info/refs`, `POST …/git/git-upload-pack`, `POST
  …/git/git-receive-pack`), the `application/x-git-*` envelope, the
  session-cookie auth model (no CORS, no bearer tokens) and the pre-git
  refusal status codes.

Nothing pending blocks this task: the real Go git endpoint is a separate
leaf, and the client is tested against the local v1 harness here and
exercised end-to-end against the stack by the service task's e2e-api.

## What this task is

Add `isomorphic-git` as the app's second runtime dependency and build the
Worker's git transport: a small git layer that **clones, fetches and
pushes** a book's repository against the one origin, and the **custom HTTP
client** it does so through. The client carries the browser's session cookie
on every request (`credentials: 'include'`), pins **smart HTTP protocol v1**
by never advertising `Git-Protocol: version=2`, and therefore keeps push on
isomorphic-git's v1 receive-pack flow rather than the v2 (`getRemoteInfo2`)
path. The layer runs isomorphic-git over the `createFileSystem` fs from
storage.fs, and settles the on-device repository layout (one non-bare
working directory per book). It is a transport primitive: it moves bytes and
updates `refs/heads/main`; it does not canonicalise, stage, or decide when to
sync — its consumers do.

## Why it needs to be done

Every hosted-book flow rests on it. DIRECTION §3 L105–106: "each book is a
git repository on a filesystem backed by IndexedDB, operated by
isomorphic-git in a Web Worker"; L111: "Saving is a commit, and then a
push." Its consumers are already WBS leaves and all `depends !git`:
`storage.working_copy` (save = canonicalise, commit, push; workflow 4),
`storage.home_book` (auto-commit and key-by-key merge through the remote),
`storage.history`, `storage.download`, and the sync engine; `storage.locks`
serialises the git operations this layer exposes. Without this task none of
them can reach the server.

## Inputs / context

- **DIRECTION §3** (`docs/DIRECTION.md` L103–125): books are git repos on
  IndexedDB operated by isomorphic-git in a Worker; L123–125 — isomorphic-git
  is "a runtime dependency, which Explore Chords avoided … The exception is
  deliberate" (git's pack/delta formats). This sanctions the dependency; no
  design delta is needed to add it.
- **DIRECTION §3.1** (L133–134): "Every git request to a hosted book goes
  through the app's one server component (§3.3)."
- **DIRECTION §3.3** "The one server" (L153–211): **one origin**
  (`estantedecifras.app`) for the PWA and its API — "no CORS, a session
  cookie that simply flows" (L170–173); **no book is reachable without an
  account**, every request needs a session and a membership, `noindex` on
  everything (L175–182); the volume holds "one bare git repository per book,
  `/data/books/<id>.git`" (L186–187); the service runs `git upload-pack` /
  `git receive-pack` over it (L191–198); "**The git server is git.** … every
  part of the protocol works … isomorphic-git in the browser … talk to it
  with nothing written for either" (L200–204); "**The browser only ever holds
  its session with the service.** It speaks git to the service, never to
  storage" (L206–211).
- **DIRECTION §3.6 "Git over HTTP"** (L317–350): the service speaks git's
  smart HTTP itself; routes `GET …/info/refs?service=…`, `POST
  …/git-upload-pack`, `POST …/git-receive-pack`; L330–332 — "The client's
  `Git-Protocol` header becomes `GIT_PROTOCOL` … so **protocol v2** fetches
  work." The server *supports* v2; this client speaks **v1** (the `.tji`
  note), and a v1 client is fully served because v2 is opt-in via that header
  — so staying v1 is simply not sending it, not a conflict.
- **DIRECTION §3.6 "The API"** (L369–371): "**Git**: smart HTTP for each
  book, for its members only, by session. Reads for every member; pushes for
  editors and the owner."
- **DIRECTION §3.7 "The app"** (L394+): the Worker owns git, the working copy
  and the index; the main thread never touches them.
- **Workflow 14** (`docs/workflows/14-file-view.md`): what a push may hold —
  `## What the service checks` L84–113: only `refs/heads/main` may be
  updated, fast-forward only, no tags/notes/branches, no stowaway objects.
  The client's push must match this shape; refusals come back through git's
  own channel. (Canonicalisation and the file whitelist are enforced by
  `storage.working_copy` before commit, not here.)
- **Workflow 13** (`docs/workflows/13-new-device.md`): the home book clones
  first, then each shelf book clones in the background "its songs searchable
  as they arrive" — so the layer threads an `onProgress` callback for
  consumers. `## The shelf is in the home book`: "Access itself is the
  account's, held by the service, so nothing secret is written down" — the
  client stores no credentials.
- **Workflow 10** (`docs/workflows/10-share.md`): a reader may clone/fetch
  but not push; a reader's push is refused by the service; a non-member's
  request is refused. The client surfaces these as errors.
- **Existing code seams** (storage.worker / storage.fs, above):
  `createFileSystem` (`fs.js:144`), `startGitHttpRemote`
  (`app/src/test/git-http-remote.js:145`), `installWebLocks`
  (`app/src/test/web-locks.js`), `fake-indexeddb ^6.2.5` imported per-file
  (never globally). `isomorphic-git` is **not yet installed** — only
  `@isomorphic-git/lightning-fs ^4.10.3` is; this task adds it.

## Constraints / requirements

- **The Worker owns git; the view never does.** The git layer is a
  framework-free module under `app/src/worker/`, plain ESM `.js`. The main
  thread and the view never import it (DIRECTION §3.7). It is handed the
  one Worker fs from `createFileSystem`; it never reaches for lightning-fs or
  IndexedDB directly.
- **isomorphic-git does all I/O through the injected `fs`** (fs.md): the
  layer passes the `createFileSystem` object as isomorphic-git's `fs`; it
  never bypasses it.
- **One origin, protocol v1, a custom HTTP client, credentials included**
  (`.tji`): every request goes through the custom client, carries the session
  cookie, and never negotiates protocol v2; push stays on the v1 receive-pack
  flow (no `getRemoteInfo2`).
- **Push matches the server's shape** (workflow 14): single ref
  `refs/heads/main`, fast-forward; the layer configures `remote: 'origin'`,
  `ref: 'main'`, `singleBranch: true`. It does not force-push.

Standing rules, each weighed:

- **No song text in logs** — *applies.* The HTTP client is the one network
  choke point and logs nothing: not request/response bodies (pack data is
  song blobs), not commit messages, not URLs. Errors surface to callers as
  thrown/rejected values (which the consumers turn into protocol `ERROR`
  events), never to `console`. Mirrors `logic.js:9–11`.
- **Offline first** — *applies.* The git layer is the network layer and runs
  only when there is a network. Nothing the user does locally waits on it:
  `storage.working_copy` writes files and commits without it; clone/fetch/push
  are explicit, and their failure is reported, never blocking local work.
- **No book without an account** — *applies (enforced server-side).* The
  client carries the session cookie so the server can authorize; it holds and
  stores no credentials of its own (workflow 13). A `401` (no session) or
  `404` (not a member — membership is hidden) from the server surfaces as an
  error for the consumer to handle.
- **Canonical form over preserving content** — *not this task.*
  Canonicalisation happens in `storage.working_copy` before commit; a marked
  text is never committed and so never reaches push. This layer only moves
  the bytes it is given.
- **Accessibility (React Aria, axe)** — *not applicable.* No UI; a
  framework-free Worker module renders nothing.

## Acceptance criteria

### Behavior delivered

- `isomorphic-git` added to `app/package.json` as the app's **second**
  runtime dependency (after `@isomorphic-git/lightning-fs`), pinned at the
  current 1.x release and recorded in the lockfile.
- **`app/src/worker/git-http.js`** — `createGitHttpClient({ fetch } = {})`
  returning `{ request }` conforming to isomorphic-git's documented `http`
  plugin interface (`async request({ url, method, headers, body, onProgress,
  signal }) → { url, method, headers, body, statusCode, statusMessage }`,
  bodies as async-iterables of `Uint8Array`). On every request it sets
  `credentials: 'include'`, strips any inbound `Git-Protocol: version=2`
  header (pinning v1), injects `fetch` (`options.fetch ?? globalThis.fetch`)
  so tests can supply one, and logs nothing.
- **`app/src/worker/git.js`** — `createGitLayer({ fs, http })` returning
  `{ clone, fetch, push, bookDir }`. `clone/fetch/push` take
  `{ dir, url, onProgress }` and call isomorphic-git with fixed options
  (`remote: 'origin'`, `ref: 'main'`, `singleBranch: true`, the injected `fs`
  and `http`). `bookDir(bookId)` returns the device path
  `/books/<bookId>` (non-bare working directory) — the on-device repository
  layout storage.fs deferred here. `clone` populates a book's working dir
  from the one origin; `fetch` advances it; `push` sends local commits on
  `refs/heads/main`, fast-forward, through the v1 flow.

### Tests the task lands with, by level

- **unit** — `app/src/worker/git-http.test.js`: the custom client's contract
  — method/headers/body async-iterable mapped both directions, the response
  shape `{ statusCode, statusMessage, headers, body }`, `credentials:
  'include'` present on every call, an inbound `Git-Protocol: version=2`
  stripped, and `console` untouched (spy) — against an injected fake `fetch`.
  Pins `tasks/40-storage.tji:26` ("custom HTTP client", "credentials
  included", "protocol v1") and the no-song-text-in-logs rule. *(Added above
  the `.tji`'s named level: the client is a pure wrapper that merits a direct
  unit pin; it does not drop the behavior level.)*
- **behavior** — `app/src/worker/git.behavior.test.js`: drives the real git
  layer over a fresh `new IDBFactory()` (fake-indexeddb, imported per-file)
  with `installWebLocks()` active and a `createFileSystem` fs, against
  `startGitHttpRemote()` (the v1-only smart-HTTP harness). It (1) **clones**
  a seeded repo into `bookDir(id)` and asserts the working tree, the `.git`
  directory and the seeded commit are present; (2) **fetches** after the
  remote advances (a second commit pushed to the bare repo with the `git`
  CLI via async `spawn` — never sync, since the HTTP server shares the test
  process) and asserts the new commit arrives; (3) commits a local change and
  **pushes**, then asserts the remote's `refs/heads/main` moved (read with the
  `git` CLI); (4) asserts through a `fetch` spy that **every** request carried
  `credentials: 'include'` and **none** carried `Git-Protocol: version=2`,
  and that the push completed against the v1-only backend — the observable
  form of "protocol v1" and "push never calls getRemoteInfo2" (see Decision
  3). Seeded songs are written for the test, never anyone's words. Pins
  `tasks/40-storage.tji:26`, DIRECTION §3.6 "Git over HTTP" (L317–350) and
  §3.3 one-origin / session (L170–211).

### Why no e2e-web / e2e-api / axe here

No UI, so no axe and no e2e-web. The end-to-end integration against the
**real** Go service over the compose stack is pinned by the server
git-endpoint task's e2e-api (`tasks/30-service.tji:42`: "the git CLI and
isomorphic-git clone, fetch and push against the stack; a protocol v2 fetch
from the CLI; a non-member refused") — that test exercises this exact client,
and the real server does not exist within this task's scope. The local v1
harness is the right level for the client primitive.

### Deferred work

None. The flows that orchestrate these primitives are already WBS leaves and
all `depends !git`: `storage.working_copy`, `storage.home_book`,
`storage.history`, `storage.download`, `storage.locks` and the sync engine.
Each adds its own `COMMAND`/`EVENT` kinds and `logic.js` dispatch when it
wires a user-facing flow.

## Decisions

1. **A custom HTTP client wrapping `fetch`, not isomorphic-git's bundled
   `http/web`.** The `.tji` names a custom client, and it earns its keep:
   it sets `credentials` explicitly, is the one place protocol v1 is pinned
   (the inbound v2 header stripped), gives a clean injectable-`fetch` seam
   for tests, and is the single network choke point the no-song-text-in-logs
   rule attaches to — all in a small module.
   *Rejected:* the bundled `http/web` client — it sets no explicit
   `credentials` (relying on `fetch`'s same-origin default, which works today
   but is implicit and would break silently on a cross-origin move), offers
   no seam to pin v1 or guarantee no logging.
2. **`credentials: 'include'` on every request.** The session cookie must
   flow so the server can authorize each git request (DIRECTION §3.3
   L206–211 — the browser holds only its session). `'include'` is correct and
   harmless same-origin today and survives a future cross-origin CDN
   (DIRECTION §3.3 L170–173 keeps the domain, but this is belt-and-suspenders).
   *Rejected:* `'same-origin'` / the `fetch` default — correct only while
   strictly same-origin and silent to any change.
3. **Pin protocol v1; never negotiate v2 on push.** The custom client never
   sends `Git-Protocol: version=2`, so the service — which upgrades only on
   that header (DIRECTION §3.6 L330–332) — stays on v1 for this client, and
   push uses isomorphic-git's v1 receive-pack discovery, not the v2
   (`getRemoteInfo2`) path (`tasks/40-storage.tji:26`). The `.tji`'s "push
   never calls getRemoteInfo2" is read as its observable: the push's
   `info/refs` request carries no v2 header and the v1 flow completes against
   a v1-only remote — which is exactly what the behavior test pins (header
   spy + a green push against the v1-only harness), since a public-export spy
   would not catch isomorphic-git's internal discovery anyway.
   *Rejected:* letting isomorphic-git negotiate v2 — the note forbids it (a
   documented push breakage over v2), and a v2-capable server does not require
   a v2 client (DIRECTION §3.3 L200–204).
4. **Deliver the git layer as a standalone Worker module, not new store
   command/event kinds.** The note's deliverable and test are the transport
   primitive against a remote, not a store round-trip. The user-facing
   commands that trigger clone/push (save, add a book, sync) belong to
   `storage.working_copy`, `storage.home_book` and the sync engine, which add
   their `protocol.js` kinds and `logic.js` dispatch when they wire real
   flows — mirroring fs.md, which shipped `createFileSystem` as a primitive.
   *Rejected:* adding speculative clone/fetch/push commands now — no consumer,
   and it would pre-empt decisions those tasks own.
5. **On-device book repositories are non-bare working dirs at
   `<fsRoot>/books/<bookId>`, via a `bookDir(bookId)` helper.** fs.md
   (`fs.js:133–134`, `fs.md:190–191`) deferred the device layout here;
   download (workflow 7) saves `.git` + working tree, so device repos must be
   non-bare; one helper centralises the convention for working_copy /
   home_book. The book id is treated as an opaque, path-safe segment (the
   create-book API returns it, `foundation/api_contract.md`).
   *Rejected:* bare repos on device (no working tree for the editor), or
   scattering path construction across consumers.
6. **No credentials or tokens stored, and isomorphic-git's `onAuth` is not
   used.** Auth is the browser session cookie carried by the HTTP client;
   "nothing secret is written down" (workflow 13). The server authorizes by
   session + membership (DIRECTION §3.3, workflow 10).
   *Rejected:* git basic-auth via `onAuth` — there are no git credentials to
   supply.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- `isomorphic-git ^1.43.0` added to `app/package.json` as the second runtime dependency; `app/package-lock.json` updated.
- `app/src/worker/git-http.js` (new) — `createGitHttpClient({ fetch })` returning `{ request }` conforming to isomorphic-git's `http` plugin interface; sets `credentials:'include'` on every request, strips `Git-Protocol: version=2`, injects `fetch` for tests, logs nothing.
- `app/src/worker/git.js` (new) — `createGitLayer({ fs, http })` returning `{ clone, fetch, push, bookDir }`; fixed `remote:'origin'`, `ref:'main'`, `singleBranch:true`; `bookDir(bookId)` returns `/books/<bookId>` settling the on-device layout deferred from storage.fs.
- `app/src/test/git-http-remote.js` — enabled `http.receivepack` on the seeded bare repo so the harness serves push (worker.md Decision 5's intent; was returning 403).
- Unit tests: `app/src/worker/git-http.test.js` (10 tests — body/headers/response mapping, `credentials:'include'`, `Git-Protocol: version=2` stripped, console untouched, fetch injection).
- Behavior tests: `app/src/worker/git.behavior.test.js` (clone→push→advance+fetch against the v1 harness over fake-indexeddb + web-locks shim; credentials on every request; no v2 negotiation; receive-pack completed).

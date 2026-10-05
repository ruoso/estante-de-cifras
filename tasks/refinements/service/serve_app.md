# service.serve_app — Serve the app

## TaskJuggler

[`tasks/30-service.tji`](../../30-service.tji), `task service.serve_app`
("Serve the app"). No explicit `depends`; it inherits the parent `service`
task's dependencies (`foundation.service_skeleton`,
`foundation.api_contract`, `foundation.e2e_api`).

## Effort estimate

`1d` (from the `.tji`). A pure Go change: the built PWA already ships into
the service image (the Dockerfile bakes `app/dist` → `/srv/app`); this task
is the Go code that reads it from there and serves it at the origin root,
plus the two origin-wide response policies (`noindex`, cache headers) that
every future route inherits.

## Repository

**estante-de-cifras.** Directories:

- `service/` — the Go changes: a static/app handler mounted at `/` on the
  skeleton's `ServeMux`, two response-header policies as middleware, and one
  new `Config` field for the app-root path.
- `e2e/api/` — one new black-box spec against the compose stack.

Not a cifra.md task (the note does not start with `cifra.md:`). The app and
the service **share no code** (DIRECTION §3.6 line 288): this task serves
the app's *built bytes* from disk, it does not import, build, or understand
the app.

## Inherited dependencies

All three predecessors are **settled** (Done, 2026-10-05):

- **`foundation.service_skeleton`** (settled) — the frame this hangs on. The
  HTTP handler is a standard-library `net/http.ServeMux` behind one
  request-logging middleware, assembled in
  [`service/internal/server/server.go:16-20`](../../../service/internal/server/server.go);
  `GET /healthz` was given its own path precisely because **`/` is reserved
  for the served app (`service.serve_app`)**. Config is a typed `Config`
  built by a pure `Load(lookup)` in
  [`service/internal/config/config.go`](../../../service/internal/config/config.go)
  (`DefaultPort = 8080`, binds `PORT`); its doc comment already anticipates
  "later service tasks extend it." The logging middleware
  ([`service/internal/server/logging.go`](../../../service/internal/server/logging.go))
  logs method, path, status and duration only — never a body, cookie or
  header — which this task must not undermine.
- **`foundation.api_contract`** (settled) — the one-origin namespace.
  [`api/openapi.yaml:30-36`](../../../api/openapi.yaml) fixes it: `servers:
  url: /`; the app at `/`, **this JSON API beneath `/api`**, git's smart
  HTTP under **`/git/{bookId}`**, and the app-facing book link **`…/b/{book}`
  is the app's own routing, not part of the contract**. Session by cookie,
  **no CORS**, no anonymous reads. The `/api` and `/git` route *handlers*
  land in their own later tasks (`service.schema`, `service.books`,
  `service.git_http`, …) — this task owns `/` and the origin-wide policies
  they will sit beneath.
- **`foundation.e2e_api`** (settled) — the harness this task's e2e spec
  lives in. Node + Vitest, plain ESM, spec files `*.test.js` at
  [`e2e/api/`](../../../e2e/api/); `new HttpClient()` resolves paths against
  `ESTANTE_E2E_BASE_URL` (the one origin, app + API) with a cookie jar;
  `scripts/gate` owns the compose stack's lifecycle and runs the spec with
  the stack already healthy. Model:
  [`e2e/api/health.test.js`](../../../e2e/api/health.test.js).

## What this task is

Serve the built PWA at the root of the one origin, with the API (and git)
beneath it, and stamp two origin-wide response policies that everything the
service serves inherits:

1. **The app at `/`.** A handler mounted at `/` on the skeleton's
   `ServeMux` serves the built bundle from `/srv/app` (where the Dockerfile
   placed `app/dist`): `index.html`, the hashed `assets/`, the service
   worker `sw.js`, `workbox-*.js`, and `manifest.webmanifest`. Any
   navigation that is not a real asset — including the app's own
   `…/b/{book}` deep links — falls back to `index.html` so the single-page
   app boots and client-routes.
2. **`noindex` on everything.** DIRECTION §3.3 (line 180): "nothing the
   service serves is indexed by search engines (`noindex`)." An origin-wide
   middleware sets `X-Robots-Tag: noindex` on every response — the app
   shell, static assets, `/healthz`, and every `/api`/`/git` route a later
   task adds — so no route can be shipped without it by accident.
3. **Cache headers for the service worker.** The PWA's update story depends
   on the browser *revalidating* the registration entry (`sw.js`) and the
   shell (`index.html`), while the content-hashed bundle can be cached hard.
   The static handler sets `Cache-Control` accordingly.

## Why it needs to be done

DIRECTION §3.3 (lines 159–160): "The same service serves the app … at the
root of `estantedecifras.app`, and its API beneath it." Until this lands,
the one origin answers only `/healthz`: there is no app to install, and the
`noindex` and cache policies that every API and git route must inherit do
not exist. It is the groundwork the whole service namespace sits on — the
source already names it (`service/internal/server/server.go` package doc;
`Dockerfile` line 46; `compose.yaml` line 72 all cite `service.serve_app`).
It unblocks every app-facing task: once the origin serves the PWA, the
e2e-web harness (`foundation.e2e_web`) and every `app/` workflow run against
a real served app.

## Inputs / context

- **DIRECTION §3.3** ([`docs/DIRECTION.md:153-222`](../../../docs/DIRECTION.md)):
  the app "a static PWA … at the root of `estantedecifras.app`, and its API
  beneath it" (lines 159–160); "**One origin** for both: no CORS, a session
  cookie that simply flows" (lines 170–171); "nothing the service serves is
  indexed by search engines (`noindex`)" (lines 178–180). The `noindex`
  outcome is normative; the *mechanism* (header vs meta tag) is left to this
  refinement.
- **DIRECTION §3.6** (line 288): "**The app and the service share no code**,
  only the HTTP API and the format." Line 315: the service is "**One binary,
  with git beside it in the image.**"
- **DIRECTION §3.7** (lines 394–426): the app is a React PWA, "installed and
  cached up front" (line 397); "the PWA plugin" (Vite, line 425). DIRECTION
  names no HTTP cache-header policy and does not use the terms
  "service worker" or "X-Robots-Tag" — those are this task's mechanism
  choices (see Decisions).
- **The router seam**:
  [`service/internal/server/server.go:16-20`](../../../service/internal/server/server.go)
  — `Handler(logger)` builds `mux := http.NewServeMux()`, registers
  `GET /healthz`, and returns `LogRequests(logger, mux)`. The package doc:
  "Later `service.*` tasks register their own routes on the mux; this
  package is the frame they hang on."
- **The config seam**:
  [`service/internal/config/config.go:22-27`](../../../service/internal/config/config.go)
  — `Config{ Port int }` with `Load(lookup)`; doc comment invites later
  tasks to extend it.
- **The header-setting pattern**:
  [`service/internal/server/health.go:15-19`](../../../service/internal/server/health.go)
  (sets a header, writes 200) and the middleware shape in
  [`service/internal/server/logging.go:41-57`](../../../service/internal/server/logging.go).
- **The built bundle on disk**: the Dockerfile's final stage
  ([`Dockerfile:44-46`](../../../Dockerfile)) runs
  `COPY --from=app /app/dist /srv/app`, commented "The built PWA, bundled
  now; serving it at / stays a pure Go change (service.serve_app), which
  reads it from here." The bundle today is `index.html`,
  `manifest.webmanifest`, `sw.js`, `workbox-9c191d2f.js`, and
  `assets/index-*.js` (Vite, content-hashed).
  [`app/vite.config.js:15-19`](../../../app/vite.config.js): `base: '/'`
  ("served at the root origin by the service … not a project subpath"),
  `outDir: 'dist'`; the VitePWA block (lines 36–69) sets
  `navigateFallback: '/index.html'`, `registerType: 'prompt'`,
  `skipWaiting: false`, and a manifest with `start_url`/`scope`/`id` all
  `'/'`.
- **The namespace**:
  [`api/openapi.yaml:30-36`](../../../api/openapi.yaml) — `/` the app,
  `/api` the JSON API, `/git/{bookId}` git, `…/b/{book}` the app's own
  routing (not the contract). Session cookie `estante_session`.
- **The e2e harness**:
  [`e2e/api/health.test.js`](../../../e2e/api/health.test.js) (the spec
  shape), [`e2e/api/lib/http.js`](../../../e2e/api/lib/http.js)
  (`HttpClient`, `client.get('/')`, `response.headers`),
  [`e2e/api/lib/env.js`](../../../e2e/api/lib/env.js) (`ESTANTE_E2E_BASE_URL`).
- **Compose / gate**: [`compose.yaml:72`](../../../compose.yaml) publishes
  the one origin; [`scripts/gate`](../../../scripts/gate) runs the service's
  Go tests and the e2e-api specs against the stack it brings up once.
- **The behavior-test pattern**:
  [`service/internal/server/health_test.go`](../../../service/internal/server/health_test.go)
  — the real `Handler` through `httptest.NewServer`, asserting the response
  and the one metadata-only log line.

## Constraints / requirements

- **The app at `/`, the API and git beneath; one origin, no CORS.** Mount
  the app handler at `/` on the skeleton's `ServeMux`
  (`service/internal/server/server.go`). `ServeMux`'s longest-prefix match
  means the later `/api/…` and `/git/…` patterns win over `/` once
  registered; everything else falls to the app. No CORS headers (DIRECTION
  §3.3 line 170; same origin for app and API).
- **Serve from disk, stdlib only.** Read the bundle from a configurable
  app-root directory (default `/srv/app`, the Dockerfile's location) via
  `os.DirFS` + the stdlib file server (`http.FileServerFS` /
  `http.ServeFileFS`, Go 1.25). **No new dependency** — `service/go.mod`
  stays stdlib-only, and the app's bytes are never compiled into the Go
  binary (no `go:embed` of `app/dist`), keeping the share-no-code boundary
  (DIRECTION §3.6 line 288).
- **SPA fallback.** A navigation that does not resolve to a real file —
  notably the app's own `…/b/{book}` deep links — serves `index.html` with
  `200`. A request for a missing *asset* (a path under `assets/`, or any
  request that names a file with an extension) must `404`, not return the
  HTML shell, so a broken asset fails loudly rather than being masked as
  HTML.
- **`noindex` origin-wide, as a header.** An `X-Robots-Tag: noindex`
  middleware wraps the whole mux (a sibling of `LogRequests`), set before
  the mux dispatches, so it lands on every response including `404`s and
  every route a later task adds. The header, not a `<meta>` tag: a header
  covers assets, the API and git too (not just HTML), and it does not
  require the service to edit the app's built `index.html` (which would
  breach share-no-code).
- **Cache headers.** The registration entry `sw.js`, the shell
  `index.html` (and the `/`-fallback response), and `manifest.webmanifest`
  are served `Cache-Control: no-cache` (must revalidate) so a deploy's new
  service worker and shell reach clients. The content-hashed bundle —
  `assets/*` and `workbox-*.js` — is served
  `Cache-Control: public, max-age=31536000, immutable`, safe because Vite
  fingerprints those filenames.
- **Correct content types.** `sw.js` and `workbox-*.js` as
  `text/javascript`; `manifest.webmanifest` as `application/manifest+json`
  (Go's mime table may not know `.webmanifest` — set it explicitly).
- **Fail fast on a missing bundle.** At start-up, if the app-root has no
  `index.html`, the service exits with a clear error rather than booting to
  serve `404`s — a misbuilt image dies loudly.
- **No song text in logs; no new logging.** Keep the skeleton's one
  metadata-only log line; serving the app adds no logging. Static responses
  carry no song text regardless (the app bundle is code, not books).
- **Accessibility is the app's, not this task's.** This task serves bytes;
  it renders no UI of its own, so there is no axe surface here. (The app's
  accessibility is pinned by `app/` and e2e-web tasks.)

## Acceptance criteria

**Behavior delivered:** `GET /` returns the app shell; the app's hashed
assets and service worker are served from `/srv/app`; a deep link like
`/b/demo` returns the shell (SPA fallback); every response carries
`X-Robots-Tag: noindex`; `sw.js`/`index.html`/`manifest.webmanifest`
revalidate while hashed assets are immutable; a missing bundle fails
start-up.

**Tests the task lands with, by level.** (The note names behavior and
e2e-api; a small `unit` test is added for the one new pure `Config` field —
see Decisions.)

- **unit** — `service/internal/config/config_test.go` (extended): `Load`
  resolves the app-root from `ESTANTE_APP_ROOT` and defaults to `/srv/app`
  when unset (continues the skeleton's pure-`Load` coverage; pins the one
  new field). *Pins:* DIRECTION §3.3 (the app is served from the image),
  the config seam `config.go:22-27`.
- **behavior** — `service/internal/server/app_test.go` (new), the real
  `Handler` through `httptest` (as `health_test.go` does), pointed at a
  temp app-root fixture standing in for `/srv/app` (a tiny purpose-written
  `index.html`, an `assets/app-<hash>.js`, a `sw.js`, a
  `manifest.webmanifest`). Cases:
  - **the built app at the root** — `GET /` → `200`, body is the fixture
    shell; `GET /b/demo` → `200`, same shell (SPA fallback). *Pins:*
    DIRECTION §3.3 lines 159–160, the `…/b/{book}` routing of
    `api/openapi.yaml:30-36`.
  - **the API beneath** — `GET /api/not-a-route` → `404` (no handler yet)
    but still carrying `X-Robots-Tag: noindex`, and `GET /healthz` still
    `200 ok` beside the app — proving the app handler at `/` does not
    swallow the API namespace and the `noindex` policy is origin-wide, not
    per-handler. *Pins:* DIRECTION §3.3 line 170 (one origin), the
    `/api` namespace of `api/openapi.yaml:30-34`.
  - **cache headers for the service worker** — `GET /sw.js` and `GET /` →
    `Cache-Control: no-cache`; `GET /assets/app-<hash>.js` →
    `public, max-age=31536000, immutable`; `GET /manifest.webmanifest` →
    `no-cache` and `Content-Type: application/manifest+json`. *Pins:* the
    PWA update story (`vite.config.js:36-69`, `sw.js` registration).
  - **noindex on every response** — `X-Robots-Tag: noindex` asserted on
    `/`, `/healthz`, `/assets/app-<hash>.js`, and the `/api/not-a-route`
    `404`. *Pins:* DIRECTION §3.3 line 180.
  - **fail fast** — building the handler/server against an app-root with no
    `index.html` returns an error (not a booting server). *Pins:* the
    missing-bundle requirement.
- **e2e-api** — `e2e/api/app.test.js` (new), against the compose stack via
  `HttpClient` at `ESTANTE_E2E_BASE_URL` (modeled on `health.test.js`):
  - `GET /` → `200`, body contains the real shell's marker (e.g. the
    `<div id="root">`/`manifest.webmanifest` link in the bundled
    `index.html`). *Pins:* DIRECTION §3.3 lines 159–160 against the real
    image.
  - `GET /b/anything` → `200`, the same shell (the app route beside the
    API). *Pins:* `api/openapi.yaml:30-36`.
  - `GET /api/does-not-exist` → `404` with `X-Robots-Tag: noindex`, and
    `GET /` with `X-Robots-Tag: noindex` — **the app at `/` and an API-route
    namespace beside it, `X-Robots-Tag` on both** (the note's clause,
    exercised now before any `/api` handler exists). *Pins:* DIRECTION §3.3
    lines 170, 180.
  - `GET /sw.js` → `200` with `Cache-Control: no-cache`; a hashed asset
    discovered from the served `index.html` → `immutable`. *Pins:* the cache
    policy against the real bundle.

No deferred follow-ups: the `/api` and `/git` route handlers are their own
already-planned WBS tasks (`service.schema`, `service.books`,
`service.git_http`, sign-in), which hang beneath the origin-wide policies
this task lands — that is ordering, not a deferral. No tech debt registered.

## Decisions

- **Serve the bundle from disk (`os.DirFS` + stdlib file server), not
  `go:embed`.** *Chosen* because the Dockerfile already places the bundle at
  `/srv/app` and names this task as "a pure Go change … which reads it from
  here" (`Dockerfile:44-46`), and because reading from disk keeps
  `service/go.mod` stdlib-only and keeps the app's bytes out of the Go
  module — honoring share-no-code (DIRECTION §3.6 line 288). *Rejected:*
  `go:embed app/dist`, which would require the app build to feed the Go
  module build (coupling the two components' builds) for no deployment gain,
  since the image already carries the bundle.
- **App-root path is a `Config` field, default `/srv/app`, env
  `ESTANTE_APP_ROOT`.** *Chosen* so the path is overridable (tests point it
  at a fixture dir; dev can point it at `app/dist`) without hardcoding.
  `ESTANTE_APP_ROOT` follows the skeleton's note that `ESTANTE_*` is for
  future service-owned vars (while the bind port stays plain `PORT`).
  *Rejected:* hardcoding `/srv/app`, which would force behavior tests to
  create that absolute path.
- **`noindex` as an origin-wide `X-Robots-Tag` response header, not a
  `<meta>` tag.** DIRECTION fixes the *outcome* ("nothing the service serves
  is indexed", line 180) but not the mechanism. *Chosen:* a header set by a
  top-level middleware — it covers assets, the API and git (not just HTML),
  it lands on every future route structurally (impossible to forget on a new
  handler), and it never touches the app's built `index.html` (editing which
  would breach share-no-code). *Rejected:* a `<meta name="robots">` in
  `index.html` — it would require the service to rewrite the app's artifact,
  covers only HTML navigations, and leaves API/git responses unmarked. This
  is a mechanism choice within DIRECTION's promise, so **no DIRECTION delta**
  is needed.
- **Cache policy: revalidate the shell and service worker, immutable for
  hashed assets.** *Chosen* because `sw.js` and `index.html` are the
  non-fingerprinted entry points — if the browser caches them hard, a deploy
  never reaches installed clients; the rest of the bundle is content-hashed
  by Vite and safe to cache for a year. *Rejected:* one blanket policy
  (either everything immutable — breaks updates — or everything no-cache —
  throws away the PWA's cheap-to-serve property DIRECTION §3.3 line 159
  relies on). Also a mechanism choice, **no DIRECTION delta**.
- **SPA fallback serves `index.html` for navigations, `404` for missing
  assets.** *Chosen* to make the app's own `…/b/{book}` deep links boot the
  SPA (matching `vite.config.js`'s `navigateFallback: '/index.html'` on the
  client side) while a genuinely missing asset still fails as a `404`.
  *Rejected:* falling back to `index.html` for every unmatched path, which
  would mask a broken asset as a `200 text/html` and hide build regressions.
- **The behavior test "the API beneath" case exercises a `404` under
  `/api`, since no `/api` handler exists at this task's landing.** *Chosen*
  because it is the honest, runnable way to pin the two real guarantees this
  task owns — the `/` handler does not swallow the `/api` namespace, and
  `noindex` is origin-wide rather than per-handler — without depending on a
  later task's routes. The real `/api` handlers, when they land, inherit the
  same middleware and add their own tests.
- **A `unit` level is added for the new `Config` field.** The note names
  behavior and e2e-api; the skeleton pins config loading with a pure unit
  test, and extending `Config` with `AppRoot` without pinning its defaulting
  would leave a gap the skeleton's own pattern already covers. This is a
  sharpening (adding a cheap level the task needs), not a dropped level.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-05.

- New `AppRoot` field in `service/internal/config/config.go` (default `/srv/app`, env `ESTANTE_APP_ROOT`); unit test extended in `service/internal/config/config_test.go`.
- New `service/internal/server/app.go`: disk-served PWA via `os.DirFS`, SPA fallback for navigations, `404` for missing assets, reserved `/api`+`/git` namespaces pass through, cache headers (sw/shell/manifest `no-cache`, hashed assets `immutable`), `manifest.webmanifest` content-type fix, fail-fast on missing `index.html`.
- New `service/internal/server/noindex.go`: origin-wide `X-Robots-Tag: noindex` middleware wrapping the whole mux.
- Updated `service/internal/server/server.go`: app handler mounted at `/`, `NoIndex` middleware wired, `Handler` now returns `(http.Handler, error)`.
- Updated `service/cmd/service/main.go`: adapted to new `Handler` error-returning signature.
- Updated `service/internal/server/health_test.go`: adapted to new `Handler` signature + temp-dir fixture.
- New `service/internal/server/app_test.go`: behavior tests (real `Handler` via `httptest`) — app at `/`, SPA `/b/demo` fallback, `/api` 404 + `/healthz` 200 beside it, cache headers, `noindex` on every response, missing-asset `404`, fail-fast on missing bundle.
- New `e2e/api/app.test.js`: e2e-api spec against compose stack — real shell at `/`, `/b/anything` fallback, `/api` 404 + noindex, sw revalidate, hashed asset immutable.

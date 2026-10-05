# e2e/api

The e2e-api harness: black-box against the compose stack, HTTP calls and real
git clients (the git CLI and isomorphic-git) doing what a user's device would
(DIRECTION §3.6, tasks/refinements/README.md).

A Node/Vitest package in plain JavaScript (ESM), the one place every e2e-api
test in the project is written — it never grows a parallel harness.

## How it runs

The harness is black-box against a **running** compose stack and does not start,
stop or reach inside it. It reads the stack's address from two variables:

- `ESTANTE_E2E_BASE_URL` — the one origin (app + API), where `GET /healthz`,
  the API and git-over-HTTP live.
- `ESTANTE_E2E_MAIL_URL` — the mail catcher's (Mailpit) HTTP API.

`lib/env.js` reads and validates both at import and fails fast with an
actionable message when they are unset.

### Via the gate (normal path)

`scripts/gate` brings the stack up once (built from the working tree, isolated,
on free ports, waited healthy), exports the variables above, and runs this
harness with a bounded worker count:

```
scripts/gate
```

### Against a stack you brought up yourself

Bring the stack up the way the gate does and point the variables at it:

```
cd e2e/api
npm ci
ESTANTE_E2E_BASE_URL=http://127.0.0.1:8080 \
ESTANTE_E2E_MAIL_URL=http://127.0.0.1:8025 \
  npm test -- --maxWorkers=4
```

## Layout

- `lib/env.js` — reads/validates the two `ESTANTE_E2E_*` variables.
- `lib/http.js` — `HttpClient`, a `fetch`-based session client (one cookie jar
  per instance), paths resolved against the one origin.
- `lib/mail.js` — the Mailpit reader: list, fetch, find-latest-by-recipient,
  extract a link, clear, and (to exercise the reader) send.
- `lib/git.js` — `GitCli` (host `git` via argument arrays) and `IsoGit`
  (isomorphic-git with `node:fs` and the package's Node HTTP client), each in
  its own working directory.
- `fixtures/` — purpose-written songs (never copyrighted words).
- `*.test.js` — the smoke tests (`health`, `mail`, `git`).

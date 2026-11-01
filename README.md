# Estante de Cifras

A shelf of songbooks you play from.

Each book is a git repository of songs written in
[cifra.md](https://github.com/ruoso/cifra.md), cloned into the browser and
kept in step with every device and every person it is shared with. Find a
song across all your books, read it on your own instrument, arrange it, save
versions of it, and sync when there is a network — it works without one.

It runs at [www.estantedecifras.app](https://www.estantedecifras.app), in
English, Brazilian Portuguese, Latin American Spanish and Italian.

Successor to [Explore Chords](https://github.com/ruoso/explore-chords), whose
music engine it carries over.

## Status

The first pass is complete: every milestone in
[tasks/99-milestones.tji](tasks/99-milestones.tji) is closed, from the format
in JavaScript (M1), through a songbook on one device (M2), Estante online
(M3), shared books (M4) and the rest of the workflows (M5), to the format in
Go with the `git-merge-cifra` driver (M6). New work lands as tasks in the
same plan (see [Plan](#plan)).

## What is in this repository

| Path | What it is |
|---|---|
| [`app/`](app/) | The PWA — everything the user sees. React with React Aria Components, git through isomorphic-git in a Web Worker, installed and cached so it works offline. Ships the [example book](app/example-book/). |
| [`service/`](service/) | The Go service: sign-in (passkeys and emailed links), the registry, sharing, and git over HTTP — one binary, with git beside it in its image. Also the pre-receive hook (`cmd/pre-receive`) that checks every push, and the operator's `estante-admin` (`cmd/estante-admin`). |
| [`api/`](api/) | The HTTP API contract (`openapi.yaml`) with a validator for each side. The app and the service share no code — only this and the format. |
| [`cifra.md/`](cifra.md/) | The format: specification, corpus, the Python reference, and the JavaScript and Go implementations (see below). |
| [`e2e/`](e2e/) | Black-box end-to-end tests against the compose stack: `api/` (HTTP and real git clients) and `web/` (Playwright on phone, tablet and computer, with axe). |
| [`docs/`](docs/) | The design: [DIRECTION.md](docs/DIRECTION.md), one document per [workflow](docs/workflows/), the [mockups](docs/mockups/), and the specifications for the [home book](docs/home-book-format.md) and [how a screen reader reads a chart](docs/screen-reader.md). |
| [`tasks/`](tasks/), [`project.tjp`](project.tjp) | The plan, in TaskJuggler, with a refinement per task under `tasks/refinements/`. |
| [`orchestrator/`](orchestrator/) | The driver that works through the plan with agent sessions, verified by the gate. |
| [`scripts/`](scripts/) | `gate` (the quality gate), `explore` (exploratory sessions against a local stack), `check-example-book`, `unblocked.py`. |

The cifra.md format lives here as a git subtree, published to
github.com/ruoso/cifra.md with `git subtree push --prefix=cifra.md`. This
repository is its source of truth.

## Running it

The whole system — the service with the built app on one origin, Postgres,
and Mailpit standing in for the email provider:

```sh
docker compose up --build --wait
```

Then open http://localhost:8080; sign-in mail lands in Mailpit at
http://localhost:8025. Ports and credentials come from `ESTANTE_*` variables
with defaults (see [compose.yaml](compose.yaml)).

To work on the app with hot reload, run Vite against that stack — it proxies
`/api` to `ESTANTE_API_ORIGIN` (default `http://localhost:8080`):

```sh
cd app && npm ci && npm run dev
```

Node's version is in [.node-version](.node-version); Go's in
[service/go.mod](service/go.mod).

## Checking it

[`scripts/gate`](scripts/gate) is the single answer to "is the tree green?",
run before every commit and by CI ([.github/workflows/gate.yml](.github/workflows/gate.yml)),
and a merge to main deploys only when it passes. It checks the plan with tj3,
lints, tests and builds the app and the service, brings up an isolated
compose stack for the Go behavior tests and both e2e harnesses, and runs the
cifra.md reference, corpus, JavaScript and Go checks.

```sh
scripts/gate             # everything
scripts/gate estante     # just the app, service, plan and e2e
scripts/gate cifra.md    # just the format
```

It needs Docker with the compose plugin, Playwright's browsers, Node, Go,
Python and `tj3`, and says what is missing. Parallelism is always bounded;
`ESTANTE_E2E_WORKERS` sets the e2e worker count (default `nproc`, at most 4).

## Plan

The work is broken down in [TaskJuggler](https://taskjuggler.org/) format:
[project.tjp](project.tjp) and one file per work stream in [tasks/](tasks/),
with milestones in [tasks/99-milestones.tji](tasks/99-milestones.tji) and
ideas not yet planned in [tasks/parking-lot.md](tasks/parking-lot.md). It is
not a schedule — one placeholder resource, efforts as rough sizes — but tj3
keeps its structure and dependencies valid.

```sh
scripts/unblocked.py            # per milestone, the tasks that can start now
scripts/unblocked.py m2_local   # just one milestone
mkdir -p report && tj3 project.tjp   # the Gantt report in report/
```

Mark a task done by adding `complete 100` to it.

## License

[MIT](LICENSE).

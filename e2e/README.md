# e2e/

The two black-box end-to-end harnesses every later task's e2e tests are
written in. They run against the compose stack (`../compose.yaml`) — the
service's image with git, the hook, Postgres and a mail catcher — on its one
origin.

- `api/` — HTTP calls and real git clients (the git CLI and isomorphic-git)
  doing what a user's device would (e2e-api).
- `web/` — Playwright against the app served by the service, on phone, tablet
  and computer viewports, with axe at WCAG 2.1 AA (e2e-web).

Reserved by `foundation.monorepo`; `api/` is filled by `foundation.e2e_api`
and `web/` by `foundation.e2e_web`. They land before anything needs them.

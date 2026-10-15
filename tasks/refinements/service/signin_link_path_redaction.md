# service.signin_link_path_redaction — Redact the sign-in link token from the logged request path

## TaskJuggler

`service.signin_link_path_redaction` in [`tasks/30-service.tji`](../../30-service.tji)
(task `signin_link_path_redaction`, under `task service`, lines 91-96):

> The app page /sign-in/<token> is still logged with its token in the path;
> service.recovery_email redacted only /recovery-email/<token>. Source:
> tasks/refinements/service/recovery_email.md (commit of
> service.recovery_email); governing document: docs/DIRECTION.md section 3.3
> and workflow 13 (never logged). Tests: unit (the path redaction); behavior
> (a sign-in link opened leaves no token in the captured log).

Milestone: `milestones.m5_complete` (`tasks/99-milestones.tji:44`).

## Effort estimate

0.5d.

## Repository

estante-de-cifras, `service/internal/server/` only: `logging.go` (the
redaction), `logging_test.go` (unit) and `email_links_test.go` (behavior).
No API contract change (`api/openapi.yaml` is untouched — the app page is not
an API route), no migration, no app change. Not cifra.md work — the note does
not start with `cifra.md:`. No design delta: the rule that a secret never
reaches a log is already settled (below); this task closes a gap in how it is
applied.

## Inherited dependencies

Settled (all `complete 100`):

- **`service.recovery_email`** (the declared `depends`) — added
  `redactRecoveryEmailToken` (`service/internal/server/logging.go:82-96`) and
  wired it into `LogRequests` (`logging.go:58`); registered this task as its
  tech debt (`tasks/refinements/service/recovery_email.md:483`).
- **`service.email_links`** — mails `${PUBLIC_BASE_URL}/sign-in/<token>`
  (`service/internal/server/email_links.go:150`); its behavior env
  `newLinksEnv` (`email_links_test.go:93-119`) builds the full `Handler` with
  a captured JSON log (`logBuf`) and the test app root, and `requestTokenFor`
  (`email_links_test.go:278`) mints a real token through the mailer.
- **`service.serve_app`** / **`account.recovery_email`** — the app handler's
  `linkRoutes` allowlist (`service/internal/server/app.go:56-64`,
  `{"sign-in", "recovery-email"}`) and `isLinkRoute` (`app.go:151-158`), which
  boot the shell for any path under those prefixes despite the dot in the
  token.
- **`service.sharing`** — `redactInvitationToken` (`logging.go:65-80`), the
  precedent and the other redaction this one composes with.

Pending: none.

## What this task is

Every request the service answers is logged by `LogRequests` as one line —
method, path, status, duration (`logging.go:34-63`). When someone taps an
emailed sign-in link, their browser asks the service for
`/sign-in/<token>`; the service serves the app shell, and today the log line
records that path verbatim, token and all. This task makes the logged path of
every emailed-link app page carry a placeholder instead of the token —
`/sign-in/{token}` as `/recovery-email/{token}` already does — and closes the
shapes the current recovery-email redaction lets through (a trailing slash, a
non-clean path), so no form of a link's path the service answers can put its
token in a log.

## Why it needs to be done

The sign-in link's token is a bearer credential for fifteen minutes: whoever
holds it can redeem it (`POST /api/auth/email/redeem`) and get a session on
the account (workflow 13, "Signing in on a new device"). A log is read by
operators, shipped to log stores and kept far longer than fifteen minutes; a
token there is a sign-in for whoever reads it before the owner does. The
service already promises that its logs carry request metadata only and never a
token (`logging.go:34-41`, citing DIRECTION §3.3; workflow 13 L39 "never
logged" for the recovery address; `recovery_email.md` Constraint 6 for the
tokens), and pins it for the API calls (`TestNoAddressOrTokenInLogs`,
`email_links_test.go:467`) — but not for the app page the link opens, which is
where the token arrives first. Nothing downstream depends on this; it is the
last open gap in the no-secrets-in-logs rule, required for
`milestones.m5_complete`.

## Inputs / context

- `service/internal/server/logging.go:42-63` — `LogRequests`; `:58` composes
  `redactRecoveryEmailToken(redactInvitationToken(r.URL.Path))`.
- `service/internal/server/logging.go:87-96` — `redactRecoveryEmailToken`:
  returns the path unchanged when the remainder after `/recovery-email/`
  contains a `/`. So `/recovery-email/<token>/` is logged **with** its token
  today, though `isLinkRoute` (`app.go:153`, `HasPrefix(name, route+"/")`)
  serves the shell for it. The app's own parser accepts the trailing slash as
  a link (`app/src/account/sign-in-route.js:15`, `/^\/sign-in\/([^/?#]+)\/?$/`).
- `service/internal/server/app.go:56-64` — `linkRoutes`, the one list of
  emailed-link app routes.
- `service/internal/server/email_links.go:150` — the sign-in link's shape.
- `service/internal/server/email_links_test.go:93-119, 278, 467-490` — the
  behavior env, the token helper, and the existing log test (API calls only).
- `service/internal/server/recovery_email_test.go:423-449` —
  `TestRecoveryEmailNeverLogged`, which opens `/recovery-email/<token>` and
  asserts the token is absent: the pattern the new behavior test follows.
- `service/internal/server/sharing_test.go:113-131` —
  `TestRedactInvitationToken`, the unit-test precedent.
- `service/internal/server/logging_test.go:20` —
  `TestLogRequestsLogsMetadataOnlyNeverBodyOrSecret`, the one-line metadata
  shape.
- `docs/DIRECTION.md` §3.3 (the one server; the emailed sign-in link and its
  limits, L190-L207) — the rule the `LogRequests` comment cites.
- `docs/workflows/13-new-device.md` L39 ("never logged"), L46 (links work
  once and expire in fifteen minutes).
- `tasks/refinements/service/recovery_email.md` Constraint 6 (L165-168:
  "Tokens and the state are never logged") and Status L477, L483.

## Constraints / requirements

1. **No emailed-link token in any log line.** For every path under a
   `linkRoutes` prefix that the service answers — `/sign-in/<token>`,
   `/sign-in/<token>/`, `/recovery-email/<token>`, `/recovery-email/<token>/`,
   or anything further below — the logged `path` holds `{token}` in place of
   everything after the prefix.
2. **Redact on the shape the router sees, not only the raw bytes.** A
   non-clean path (`//sign-in/<token>`, `/./sign-in/<token>`,
   `/x/../sign-in/<token>`) is answered by `ServeMux` with a 301 to the clean
   path — and `LogRequests`, wrapping the mux, logs that 301 with the raw
   path. Matching runs on `path.Clean` of the path, and when a link route
   matches, the logged path is the redacted clean form. (The same applies to
   the invitation accept route — Decision 3.)
3. **One list of link routes.** The redaction is driven by `linkRoutes`
   (`app.go`), not a second hard-coded list, so a future emailed-link route
   added to the shell fallback is redacted by construction.
4. **Every other path is logged unchanged** — byte for byte, raw (not
   cleaned): `/sign-in`, `/sign-in/`, `/signin/x`, `/sign-in-help/x`,
   `/api/auth/email/redeem`, `/b/<book>`, `/assets/x.js`, `/healthz`. The
   metadata stays useful to an operator.
5. **Still metadata only.** No query string, header, or body enters the line
   (`logging.go:34-41` unchanged); exactly one line per request.
6. **Test fixtures** use addresses and data written for the purpose
   (`…@estante.test`), never real people's.

## Acceptance criteria

Behavior delivered: opening an emailed sign-in link — or a recovery-email
link — in any form the service serves leaves only `/sign-in/{token}` (or
`/recovery-email/{token}`) in the request log; all other paths log as before.

Implementation: `redactRecoveryEmailToken` is replaced by
`redactLinkToken(p string) string` in `logging.go`, iterating `linkRoutes`;
`LogRequests` logs `redactLinkToken(redactInvitationToken(r.URL.Path))` with
both functions matching on the cleaned path (Constraint 2). The comments at
`logging.go:51-57`, `app.go:56-63` (that `linkRoutes` also drives the log
redaction) and `recovery_email.go:30-31` are updated to the new name.

Tests, by level:

- **unit** — `service/internal/server/logging_test.go`:
  - `TestRedactLinkToken` — table: `/sign-in/<t>` → `/sign-in/{token}`;
    `/sign-in/<t>/` → `/sign-in/{token}`; `/sign-in/<t>/x` →
    `/sign-in/{token}`; the same three for `/recovery-email/`; `//sign-in/<t>`
    and `/./sign-in/<t>` and `/b/../sign-in/<t>` → `/sign-in/{token}`; and
    unchanged: `/sign-in`, `/sign-in/`, `/signin/<t>`, `/sign-in-help/<t>`,
    `/api/auth/email/redeem`, `/b/abc`, `/healthz`. Every redacted output is
    also asserted not to contain `<t>`. A loop over `linkRoutes` asserts each
    entry is redacted (Constraint 3). *Pins:* workflow 13 "never logged";
    `recovery_email.md` Constraint 6; DIRECTION §3.3 as cited by
    `LogRequests`.
  - `TestLogRequestsRedactsLinkToken` — `LogRequests` around a stub handler,
    a `GET /sign-in/<t>/`: exactly one JSON line whose `path` is
    `/sign-in/{token}` and which does not contain `<t>`. *Pins:* the wiring at
    the HTTP edge (Constraint 1, 5).
  - `TestRedactInvitationToken` (`sharing_test.go:116`) gains the non-clean
    cases `//api/invitations/<t>/accept` and
    `/api/./invitations/<t>/accept` → `/api/invitations/{token}/accept`
    (Decision 3). *Pins:* service.sharing Constraints (token never logged).
- **behavior** — `service/internal/server/email_links_test.go`:
  - `TestSignInLinkPageNeverLogged` — through `newLinksEnv` (real `Handler`,
    real Postgres, the test app root): mint a real link with
    `requestTokenFor`, then `GET /sign-in/<token>` and
    `GET /sign-in/<token>/` (both 200 with the shell) and
    `GET //sign-in/<token>` (301, not followed); the captured log contains
    `/sign-in/{token}` and contains neither the token nor its id or signature
    half (split at the `.`), nor the address. *Pins:* workflow 13 "Signing in
    on a new device" + "never logged"; the `.tji` note's behavior clause.
  - `TestRecoveryEmailNeverLogged` (`recovery_email_test.go:426`) keeps
    passing and additionally opens `/recovery-email/<t>/` (the trailing-slash
    leak found here). *Pins:* `recovery_email.md` Constraint 6.

No e2e-api or e2e-web level: the note names none, and the compose stack's
service log is not something the harness can read; the behavior test drives
the full `Handler` the binary serves, which is where the line is built.

The gate: `go test ./...` in `service/` (with compose Postgres), plus
`go vet` / the service's lint as the repo runs them.

## Decisions

1. **One `redactLinkToken` over `linkRoutes`, not a sibling
   `redactSignInToken`.** A third copy of the prefix-match would leave the
   next emailed link to be forgotten the same way `/sign-in/` was. `linkRoutes`
   already is the list of "app pages an emailed link opens"; making it drive
   both the shell fallback and the redaction makes "served as a link page"
   imply "redacted in the log". *Rejected:* a regex over all paths for
   token-shaped segments (`<b64>.<b64>`) — it would redact by accident and
   miss by accident; the routes are known.
2. **Redact everything after the prefix, not just a single segment.** The
   current rule (leave the path alone if the remainder holds a `/`) leaks the
   token on `/recovery-email/<t>/`, which the shell serves and the app parser
   accepts. Any path under a link route is a link page (`isLinkRoute`), so
   the whole remainder is the secret's neighbourhood; the operator loses
   nothing by seeing `/sign-in/{token}`. *Rejected:* keeping the trailing
   slash in the logged form (`/sign-in/{token}/`) — no diagnostic value, and
   an extra branch to get wrong.
3. **Match on the cleaned path, for the invitation route too.** `LogRequests`
   wraps the mux, so it logs the 301 `ServeMux` returns for a non-clean path
   with the raw path — `//sign-in/<t>` would leak. Cleaning before matching
   costs one `path.Clean` and closes it for both redactions; extending it to
   `redactInvitationToken` is the same one-line change in the same function
   and the same rule (`service.sharing` Constraints), so it rides here rather
   than as a separate task. Unmatched paths are still logged raw
   (Constraint 4), so cleaning never hides what was actually asked for.
   *Rejected:* logging after the mux's own cleaning (e.g. moving
   `LogRequests` inside) — it would change which requests get a line at all.
4. **No design delta.** DIRECTION §3.3 (as `LogRequests` cites it), workflow
   13 and `recovery_email.md` Constraint 6 already say tokens are never
   logged; this task applies the rule where it was missed.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- `service/internal/server/logging.go`: `redactRecoveryEmailToken` replaced by `redactLinkToken`, driven by `linkRoutes`; any path under a link route logs as `/<route>/{token}` (plain, trailing slash, deeper). Matching runs on a segment-by-segment cleaned path (so `/sign-in/<t>/..` is caught); `redactInvitationToken` matches on the cleaned path too; all other paths log unchanged.
- `service/internal/server/app.go`, `service/internal/server/recovery_email.go`: comment updates only.
- unit: `service/internal/server/logging_test.go` — `TestRedactLinkToken` (redacted, unchanged, and a `linkRoutes` loop) and `TestLogRequestsRedactsLinkToken`; `service/internal/server/sharing_test.go` — `TestRedactInvitationToken` gains the non-clean cases.
- behavior: `service/internal/server/email_links_test.go` — `TestSignInLinkPageNeverLogged` (`/sign-in/<t>`, `/sign-in/<t>/`, `//sign-in/<t>`; no token, halves or address in the log); `service/internal/server/recovery_email_test.go` — `TestRecoveryEmailNeverLogged` also opens `/recovery-email/<t>/`.
- No e2e level, as scoped. No tech-debt follow-up.

# api/

The HTTP API contract, written down once and both sides tested against it
(DIRECTION §3.6): signing in, books, the change check, sharing, and git's
smart HTTP for each book. It is the only thing the app and the service share
besides the format — the app and the service share no code.

- **`openapi.yaml`** — the contract: a single OpenAPI 3.1 document. Every
  operation has an `operationId`; every JSON request and response has a named
  schema; book-, share- and git-scoped operations carry the session-cookie
  security requirement. The git routes are pinned at the HTTP envelope only
  (method, path, auth, content types, the `Git-Protocol` pass-through, the
  pre-git refusals as status codes); their bodies stay git's own opaque media
  types, since git owns the pack framing.
- **`validate.js`** — a thin JS validator over the contract, for the app's
  tests: it loads the document and checks a payload against the schema the
  contract names for an operation and direction. An `@estante/api-contract` npm
  package (`npm test`).
- **`validate.go`** (package `apicontract`) — the same, for the service's
  tests, over the embedded contract. A Go module (`go test`).

The app and the service each import their own validator — never each other's
code — and agree by being checked against this one document, the way the
cifra.md implementations agree through the corpus.

Reserved by `foundation.monorepo`; filled by `foundation.api_contract`.

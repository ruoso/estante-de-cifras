# service/

The Go service: sign-in, the registry, sharing, the change check, and git
over HTTP (DIRECTION §3.6). One binary, with git beside it in its image.

Two commands live beneath it:

- `cmd/service` — the one binary.
- `cmd/pre-receive` — the hook that checks every push (workflow 14).

Reserved by `foundation.monorepo`; the Go module and first skeleton land in
`foundation.service_skeleton`, and the hook stream fills `cmd/pre-receive`.
The app and the service share no code (DIRECTION §3.6), only the HTTP API
(`../api/`) and the format (cifra.md).

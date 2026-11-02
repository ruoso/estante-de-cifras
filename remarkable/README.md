# remarkable/ — the reMarkable reader

This directory is the reMarkable reader: a read-only client for the tablet,
run by AppLoad. It holds the reader's Go backend (`cmd/estante-reader` and its
`internal/` packages) and, to come, the QML frontend that draws (`qml/`).

`internal/engine` evaluates the app's built device bundle in goja and answers
its host API (design §4). Its tests read the build, so run `npm run build` in
`app/` first. Two subcommands use it:

```sh
go run ./cmd/estante-reader sheet --bundle ../app/dist/device \
  --shapes ../app/dist-test/device/example-book.default-shapes.json \
  --key 2 ../app/example-book/the-ferry-line.cifra.md
go run ./cmd/estante-reader bench --bundle ../app/dist/device \
  --shapes ../app/dist-test/device/example-book.default-shapes.json \
  ../app/example-book/*.cifra.md
```

`sheet` prints one song's sheet as JSON; `bench` prints the §4.2 reading-path
timings, and nothing of the songs.

`internal/sync` fetches the account's home book and its shelf's books into the
store with go-git, read-only (design §5). Until pairing lands, a session is
pasted in by hand — the token on stdin, never on the command line — and one
pass run:

```sh
printf '%s\n' "$TOKEN" | go run ./cmd/estante-reader session --root /tmp/estante \
  --origin https://estantedecifras.app
go run ./cmd/estante-reader sync --root /tmp/estante --bundle ../app/dist/device
```

`sync` prints what the pass did — ids, statuses and heads, nothing else. Its
behavior tests run real `git http-backend`, so they need `git` on the host.

The module needs Go 1.26 (goja's minimum).

It is its own Go module and shares no code with `service/` (DIRECTION §3.6):
it agrees with the service through the API contract (`api/openapi.yaml`), and
runs the app's music code only as the app's built bundle — bytes it loads,
never source it imports. The design is in
[docs/remarkable-reader.md](../docs/remarkable-reader.md).

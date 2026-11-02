# remarkable/ — the reMarkable reader

This directory is the reMarkable reader: a read-only client for the tablet,
run by AppLoad. It holds the reader's Go backend (`cmd/estante-reader` and,
to come, its `internal/` packages) and, to come, the QML frontend that draws
(`qml/`).

It is its own Go module and shares no code with `service/` (DIRECTION §3.6):
it agrees with the service through the API contract (`api/openapi.yaml`), and
runs the app's music code only as the app's built bundle — bytes it loads,
never source it imports. The design is in
[docs/remarkable-reader.md](../docs/remarkable-reader.md).

# service/cmd/pre-receive

The pre-receive hook: it checks every push, holding each pushed song and
setlist to its canonical form and the account's limits (workflow 14,
DIRECTION §3.6). It inherits the environment the service sets on
`git receive-pack` and keeps no database connection of its own.

`main.go` is a thin entry point: it reads git's pre-receive stdin and the push
environment, hands the parsed ref updates to the checks in
`service/internal/hook`, and maps their result to an exit code and a stderr
message git relays to the client. The first layer (`hook.refs`) holds every
push to one fast-forward update of `refs/heads/main`; the later hook subtasks
each add their check in `internal/hook` for `main` to compose.

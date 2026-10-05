# service/cmd/pre-receive

The pre-receive hook: it checks every push, holding each pushed song and
setlist to its canonical form and the account's limits (workflow 14,
DIRECTION §3.6). It inherits the environment the service sets on
`git receive-pack` and keeps no database connection of its own.

Reserved by `foundation.monorepo`; filled by the hook stream.

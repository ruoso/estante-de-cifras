// Command pre-receive is the git pre-receive hook: git invokes it once per
// push, feeding one "<old> SP <new> SP <ref>" line per ref update on stdin with
// the pushed objects held in quarantine. The binary is a thin entry point — it
// reads stdin and the push environment, hands the parsed updates to the checks
// in internal/hook, and maps their result to an exit code and a stderr message
// (git relays stderr to the client through its own channel, prefixed
// "remote:"; DIRECTION §3.6). It exits 0 to accept the whole push, non-zero to
// refuse it whole; refused objects never leave quarantine (workflow 14). The
// hook keeps no database connection of its own (DIRECTION §3.6).
//
// Today it carries only the refs-and-history layer (hook.refs); the later hook
// subtasks each add one more check in internal/hook for main to compose.
package main

import (
	"fmt"
	"os"

	"estantedecifras.app/service/internal/hook"
)

func main() {
	os.Exit(run())
}

func run() int {
	updates, err := hook.ParseUpdates(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "pre-receive: %v\n", err)
		return 1
	}

	// Ancestry is read with git in the hook's own working directory, which git
	// sets to the bare repository (so "" = inherit it).
	reasons, err := hook.Refs(updates, "")
	if err != nil {
		// A git failure during a check (not a plain refusal) — refuse the push
		// rather than accept something unverified, naming only the structural
		// fault (never object contents; no song text in logs).
		fmt.Fprintf(os.Stderr, "pre-receive: could not verify push history: %v\n", err)
		return 1
	}
	if len(reasons) > 0 {
		for _, reason := range reasons {
			fmt.Fprintln(os.Stderr, "pre-receive: "+reason)
		}
		return 1
	}
	return 0
}

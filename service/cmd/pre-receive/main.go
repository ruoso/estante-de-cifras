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
// Today it composes the refs-and-history layer (hook.refs), then the
// object-reachability layer (hook.stowaways), then — branching on the book's
// kind (ESTANTE_BOOK_KIND, forwarded by the service) — either the songbook's
// "what a book may hold" and canonical-form layers (hook.contents,
// hook.canonical) or the home book's settings validator (hook.home_book), then
// the account-and-book byte-cap layer (hook.limits), each run only if the
// previous accepted; the shared guards (refs, stowaways, limits) run for either
// kind. The later hook subtasks each add one more check in internal/hook for
// main to compose.
package main

import (
	"fmt"
	"io"
	"os"

	"estantedecifras.app/service/internal/hook"
)

func main() {
	os.Exit(run())
}

func run() int {
	updates, err := hook.ParseUpdates(os.Stdin)
	if err != nil {
		// Unparseable stdin — fail closed, naming only the aspect. The raw parse
		// error is never relayed to the client (it could carry a ref id and is of
		// no use to the pusher; hook.messages Decision).
		return refuse([]string{hook.FailClosed("the pushed ref updates")})
	}

	// Ancestry is read with git in the hook's own working directory, which git
	// sets to the bare repository (so "" = inherit it).
	reasons, err := hook.Refs(updates, "")
	if err != nil {
		// A git failure during a check (not a plain refusal) — refuse the push
		// rather than accept something unverified, naming only the aspect and
		// never the raw git error (no path or object id in the client channel;
		// hook.messages Decision).
		return refuse([]string{hook.FailClosed("push history")})
	}
	if len(reasons) > 0 {
		return refuse(reasons)
	}

	// The refs layer accepted: there is a single valid new refs/heads/main head
	// to reach from, so run the object-reachability layer (hook.stowaways) on
	// the quarantine. git marks the quarantine with GIT_QUARANTINE_PATH and also
	// points GIT_OBJECT_DIRECTORY at it; fall back to the latter.
	quarantine := os.Getenv("GIT_QUARANTINE_PATH")
	if quarantine == "" {
		quarantine = os.Getenv("GIT_OBJECT_DIRECTORY")
	}
	reasons, err = hook.Stowaways(updates, "", quarantine)
	if err != nil {
		// A git failure while enumerating or reaching objects — fail closed,
		// naming only the aspect (no raw git error in the client channel).
		return refuse([]string{hook.FailClosed("pushed objects")})
	}
	if len(reasons) > 0 {
		return refuse(reasons)
	}

	// The stowaways layer accepted: the objects reachable from the new head are
	// exactly what the push holds. Now the middle layers that decide "what a book
	// may hold" and "canonical form" — the one place the hook branches on the
	// book's kind, which the service forwarded as ESTANTE_BOOK_KIND (never guessed
	// from the repo's contents; hook.home_book Decision). A home book is a
	// settings repository, so its JSON files are validated as settings
	// (hook.home_book §8) in place of the songbook contents/canonical checks; an
	// absent or unrecognised kind stays on the stricter songbook path (fail
	// closed). The shared guards (refs, stowaways, limits) ran and will run
	// unconditionally for either kind.
	if hook.IsHomeBook(os.LookupEnv) {
		reasons, err = hook.HomeBook(updates, "")
		if err != nil {
			// A git failure while walking or reading the pushed objects — fail
			// closed, naming only the aspect (no raw git error in the client channel).
			return refuse([]string{hook.FailClosed("home-book contents")})
		}
		if len(reasons) > 0 {
			return refuse(reasons)
		}
	} else {
		// The "what a book may hold" layer (hook.contents) over every blob those new
		// commits reach — path, mode, UTF-8, size, the .gitattributes bytes, and the
		// tree/commit size guard.
		reasons, err = hook.Contents(updates, "")
		if err != nil {
			// A git failure while walking or reading the pushed objects — fail closed,
			// naming only the aspect (no raw git error in the client channel).
			return refuse([]string{hook.FailClosed("book contents")})
		}
		if len(reasons) > 0 {
			return refuse(reasons)
		}

		// The contents layer accepted: every blob reachable from the new head is a
		// UTF-8 regular file at an allowed path within the cap. Now the
		// canonical-form layer (hook.canonical): every song and setlist those new
		// commits reach is canonical under an accepted form, and the root README
		// obeys the text rules — decided by cifra.md for Go, no song text in logs.
		reasons, err = hook.Canonical(updates, "")
		if err != nil {
			// A git failure reading the pushed blobs — fail closed, naming only the
			// aspect (no raw git error in the client channel).
			return refuse([]string{hook.FailClosed("canonical form")})
		}
		if len(reasons) > 0 {
			return refuse(reasons)
		}
	}

	// The canonical layer accepted: the push is a clean fast-forward of
	// refs/heads/main carrying only allowed, well-formed, canonical objects.
	// Last, the account-and-book byte caps (hook.limits): the push's net byte
	// growth against the per-book 50 MB cap and the account's remaining quota,
	// read from the ESTANTE_* environment the service set.
	reasons, err = hook.Limits(updates, "")
	if err != nil {
		// A missing/non-numeric byte figure or a git failure measuring the
		// growth — fail closed, naming only the aspect (no raw git error in the
		// client channel).
		return refuse([]string{hook.FailClosed("push limits")})
	}
	if len(reasons) > 0 {
		return refuse(reasons)
	}
	return 0
}

// refuse writes each refusal reason to stderr (git relays it to the client
// prefixed "remote:") and returns the non-zero exit that refuses the whole push.
// It is the single emission point: every refusal — the five checks' faults and
// the fail-closed cases — goes out through here, one "pre-receive: "-prefixed,
// LF-terminated line per reason (hook.messages).
func refuse(reasons []string) int {
	return refuseTo(os.Stderr, reasons)
}

// refuseTo is refuse with the sink injected, so the emission contract (one
// prefixed LF-terminated line per reason, the non-zero exit) is unit-testable
// without capturing os.Stderr.
func refuseTo(w io.Writer, reasons []string) int {
	for _, reason := range reasons {
		fmt.Fprintln(w, "pre-receive: "+reason)
	}
	return 1
}

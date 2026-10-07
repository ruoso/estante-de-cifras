package hook

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// maxBookBytes is the per-book storage cap: 50 MB, history included (workflow 14
// "50 MB per book, with its history", docs/workflows/14-file-view.md:41). It is
// the hook's own semantic limit, deliberately not shared with the service's
// coarse receive.maxInputSize pack guard — a content cap and a denial-of-service
// guard are unrelated numbers (hook.limits Decision).
const maxBookBytes int64 = 50 * 1024 * 1024

// The two byte figures the service sets on the git receive-pack it spawns, which
// the hook inherits (DIRECTION §3.6 lines 342–346; the git_http↔hook contract in
// server.pushEnv): the book's current recorded on-disk size and the owning
// account's remaining quota (already floored at 0 by the service). The hook
// checks a push against the account's limits from these alone, with no database
// connection of its own.
const (
	envBookBytes        = "ESTANTE_BOOK_BYTES"
	envAccountRemaining = "ESTANTE_ACCOUNT_BYTES_REMAINING"
)

// Limits is the account-and-book byte-cap layer the binary composes after
// Contents accepts: for the one accepted, non-deletion refs/heads/main update it
// sums the sizes of the objects the push introduces (the net byte growth) and
// refuses the whole push if that growth would take the book past maxBookBytes or
// past the account's remaining quota. It returns one refusal reason per exceeded
// cap (an empty slice accepts), or an error for a broken contract (a missing or
// non-numeric byte figure) or a real git failure, which main maps to a refusal
// (fail closed — the hook refuses what it cannot verify). repoDir is the bare
// repository the git commands run in (empty = inherit the hook's cwd, which git
// sets to the bare repo, so the quarantine's objects are visible).
func Limits(updates []RefUpdate, repoDir string) (reasons []string, err error) {
	newHead, ok := acceptedMainHead(updates)
	if !ok {
		// No accepted non-deletion refs/heads/main head to measure against. main
		// runs this layer only after the refs, stowaways and contents layers
		// accepted exactly such an update, so this is a defensive no-op
		// (Decision: run after Contents accepts).
		return nil, nil
	}

	bookBytes, accountRemaining, err := readLimitEnv(os.LookupEnv)
	if err != nil {
		// A missing or non-numeric byte figure is a contract violation (the
		// service always sets both), not user input — fail closed.
		return nil, err
	}

	// The push's net byte growth is the sum of the introduced objects' sizes —
	// the bytes the new head reaches that the repository did not already have.
	// Reuse the contents layer's read (git rev-list --objects … --not --all →
	// git cat-file --batch-check); do not walk the quarantine by hand (Constraint:
	// delegate object knowledge to git).
	infos, err := introducedObjects(repoDir, newHead)
	if err != nil {
		return nil, err
	}

	return decideLimits(bookBytes, accountRemaining, netGrowth(infos)), nil
}

// netGrowth sums the byte sizes of the introduced objects: the push's net byte
// growth against both caps.
func netGrowth(infos []objectInfo) int64 {
	var total int64
	for _, info := range infos {
		total += info.Size
	}
	return total
}

// decideLimits refuses a push whose net byte growth would take the book past
// maxBookBytes or past the account's remaining quota, returning one reason per
// exceeded cap (an empty slice accepts). A push landing exactly at a cap is
// accepted — the cap is the greatest allowed value. The summed sizes are git's
// inflated content sizes, so bookBytes+growth over-estimates the true packed
// footprint and the cap errs toward refusing a borderline push — the correct
// bias for an abuse guard on a 50 MB-of-text limit (hook.limits Decision); a
// push is never wrongly accepted. The reason names the limit and the figures,
// never any file content (no song text in logs).
func decideLimits(bookBytes, accountRemaining, growth int64) []string {
	var reasons []string
	if bookBytes+growth > maxBookBytes {
		reasons = append(reasons, fmt.Sprintf(
			"refs/heads/main: this push would take the book to %d bytes, over the %d-byte per-book limit (50 MB, history included); refused",
			bookBytes+growth, maxBookBytes))
	}
	if growth > accountRemaining {
		reasons = append(reasons, fmt.Sprintf(
			"refs/heads/main: this push adds %d bytes, over the %d bytes the account has left of its storage limit; refused",
			growth, accountRemaining))
	}
	return reasons
}

// readLimitEnv reads the book's recorded size and the account's remaining quota
// from the inherited environment (lookup is os.LookupEnv in the binary, a map in
// tests — mirroring config.Load). A missing, empty, non-numeric or negative
// value is an error: the hook refuses what it cannot verify (fail closed), and
// the service always sets both, so a bad value is a broken contract, not user
// input.
func readLimitEnv(lookup func(string) (string, bool)) (bookBytes, accountRemaining int64, err error) {
	bookBytes, err = parseByteEnv(lookup, envBookBytes)
	if err != nil {
		return 0, 0, err
	}
	accountRemaining, err = parseByteEnv(lookup, envAccountRemaining)
	if err != nil {
		return 0, 0, err
	}
	return bookBytes, accountRemaining, nil
}

// parseByteEnv reads a non-negative byte count from the named environment
// variable, erroring (fail closed) on a missing, empty, non-numeric or negative
// value.
func parseByteEnv(lookup func(string) (string, bool), name string) (int64, error) {
	raw, ok := lookup(name)
	if !ok || raw == "" {
		return 0, fmt.Errorf("%s is not set", name)
	}
	n, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%s is not a byte count: %q", name, raw)
	}
	if n < 0 {
		return 0, fmt.Errorf("%s is a negative byte count: %d", name, n)
	}
	return n, nil
}

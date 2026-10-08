// Package hook holds the pre-receive hook's check logic as plain functions, so
// each check is unit-testable without building or running the binary and the
// later hook subtasks (stowaways, contents, canonical, limits) each add their
// own function here for the thin cmd/pre-receive binary to compose (hook.refs
// Decision; DIRECTION §3.6). This file is the refs-and-history layer: it holds
// the whole push to exactly one fast-forward update of refs/heads/main
// (workflow 14 "One ref." and "Fast-forward only.", docs/workflows/14-file-view.md:94-97).
package hook

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strings"
)

// ZeroSHA is git's all-zero object name: as a new value it marks a ref
// deletion, as an old value a ref creation.
const ZeroSHA = "0000000000000000000000000000000000000000"

// MainRef is the one ref a book's bare repository may hold (workflow 14
// "One ref."): refs/heads/main, the book's single line of history.
const MainRef = "refs/heads/main"

// RefUpdate is one line of the pre-receive stdin: the old and new object names
// for a ref and the full ref name git is being asked to move
// (<old> SP <new> SP <ref>).
type RefUpdate struct {
	Old string
	New string
	Ref string
}

// ParseUpdates reads git's pre-receive stdin — one "<old> SP <new> SP <ref>"
// line per ref update — into RefUpdates, consuming all of it (the hook reads
// every line, then evaluates once; hook.refs Constraint "Read all of stdin").
// A line that is not exactly three space-separated non-empty fields is a
// malformed-input error.
func ParseUpdates(r io.Reader) ([]RefUpdate, error) {
	var updates []RefUpdate
	sc := bufio.NewScanner(r)
	// A pack's ref-update list is tiny; the default 64KiB token size is ample
	// and caps a malformed stream.
	for sc.Scan() {
		line := sc.Text()
		fields := strings.Split(line, " ")
		if len(fields) != 3 || fields[0] == "" || fields[1] == "" || fields[2] == "" {
			return nil, fmt.Errorf("malformed ref-update line %q", line)
		}
		updates = append(updates, RefUpdate{Old: fields[0], New: fields[1], Ref: fields[2]})
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("reading pre-receive input: %w", err)
	}
	return updates, nil
}

// CheckStructure applies the ref-and-history rules that need no object access:
// the ref-name allowlist and the no-deletion rule. It returns a refusal reason
// (empty when the update passes these structural rules) and whether a
// fast-forward ancestry check against the pushed objects is still required to
// accept it. It is pure string logic — the ancestry test (IsAncestor) is the
// one part that reads git.
func CheckStructure(u RefUpdate) (reason string, needsAncestry bool) {
	if u.Ref != MainRef {
		// Any other branch, any refs/tags/*, any refs/notes/*, anything else. The
		// offending ref is what failed, so it is the subject (hook.messages: the
		// ref-name rule names the offending ref).
		return refusal(u.Ref, "only refs/heads/main may be updated — no other branch, tag, or note"), false
	}
	if u.New == ZeroSHA {
		return refusal(MainRef, "deleting the branch is not allowed"), false
	}
	if u.Old == ZeroSHA {
		// The initial push that creates main — how a book comes online. No
		// ancestry to check (there is no old history).
		return "", false
	}
	// An update to an existing main: accepted only if it fast-forwards.
	return "", true
}

// IsAncestor reports whether old is an ancestor of new in the repository at
// repoDir (empty = the hook's own working directory, which git sets to the
// bare repo), via `git merge-base --is-ancestor`. The pushed objects are
// visible because git exposes the quarantine to commands the hook runs
// (GIT_QUARANTINE_PATH / the alternate object dir, inherited by this child).
// Do not reimplement ancestry (hook.refs Decision).
func IsAncestor(repoDir, old, new string) (bool, error) {
	cmd := exec.Command("git", "merge-base", "--is-ancestor", old, new)
	if repoDir != "" {
		cmd.Dir = repoDir
	}
	err := cmd.Run()
	if err == nil {
		return true, nil
	}
	// `--is-ancestor` exits 1 for "not an ancestor"; any other code is a real
	// failure (a missing object, a broken repo).
	var exit *exec.ExitError
	if errors.As(err, &exit) && exit.ExitCode() == 1 {
		return false, nil
	}
	return false, fmt.Errorf("git merge-base --is-ancestor %s %s: %w", old, new, err)
}

// Refs is the refs-and-history layer the binary composes: it evaluates every
// ref update and returns one refusal reason per failing update (an empty slice
// accepts the whole push). A single failure refuses the whole push, but each
// failure is named so a push that breaks several rules reports all of them
// (hook.refs Constraint "Read all of stdin"). repoDir is the bare repository
// the ancestry test runs in (empty = inherit the hook's cwd). A git failure
// during the ancestry test (not a plain not-an-ancestor) is returned as an
// error for the caller to map to a refusal.
func Refs(updates []RefUpdate, repoDir string) (reasons []string, err error) {
	for _, u := range updates {
		reason, needsAncestry := CheckStructure(u)
		if reason != "" {
			reasons = append(reasons, reason)
			continue
		}
		if !needsAncestry {
			continue
		}
		ancestor, err := IsAncestor(repoDir, u.Old, u.New)
		if err != nil {
			return nil, err
		}
		if !ancestor {
			reasons = append(reasons, refusal(MainRef, "non-fast-forward update (history rewrite) is not allowed"))
		}
	}
	return reasons, nil
}

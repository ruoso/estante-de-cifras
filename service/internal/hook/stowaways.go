package hook

// stowaways.go is the object-reachability layer the binary composes after the
// refs-and-history layer accepts (hook.stowaways Decision; DIRECTION §3.6). git
// holds a push's objects in a quarantine and runs the hook before migrating
// them in; git's own connectivity check only verifies that everything *needed*
// to reach the new head is present — it says nothing about *extra* objects
// riding along. This layer lists every object physically in the quarantine and
// refuses the whole push if even one is not reachable from the new head (and was
// not already in the repository): "Every object the push brought must be
// reachable from the new commits … One object more, and the push is refused"
// (workflow 14 "No stowaways", docs/workflows/14-file-view.md:98-101).
//
// It delegates all object knowledge to git, execed in the bare repo exactly as
// IsAncestor execs merge-base (refs.go:89-105): reachability with
// `git rev-list --objects`, quarantine enumeration with `git cat-file
// --batch-all-objects`, already-had with `git cat-file -e`. It parses no pack
// files, walks no objects/ directory, and keeps no database connection
// (hook.stowaways Constraints; DIRECTION §3.6 L342-346).

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sort"
	"strings"
)

// envVarQuarantine / envVarObjectDir / envVarAlternates name the git object
// environment the quarantine sets up for the pre-receive hook. git points
// GIT_OBJECT_DIRECTORY at the quarantine, lists the real store in
// GIT_ALTERNATE_OBJECT_DIRECTORIES, and marks the quarantine explicitly with
// GIT_QUARANTINE_PATH (git ≥ 2.13 receive-pack).
const (
	envVarQuarantine = "GIT_QUARANTINE_PATH"
	envVarObjectDir  = "GIT_OBJECT_DIRECTORY"
	envVarAlternates = "GIT_ALTERNATE_OBJECT_DIRECTORIES"
)

// ParseRevListObjects parses `git rev-list --objects` output into a set of
// object names keyed on the first whitespace-separated field: a line is either
// "<sha>" (a commit or an unnamed object) or "<sha> SP <path>" (a tree or blob,
// with the path git would give it); blank lines are ignored. The path is
// discarded — only the object name matters for the comparison.
func ParseRevListObjects(r io.Reader) (map[string]struct{}, error) {
	return parseFirstField(r)
}

// ParseObjectNames parses `git cat-file --batch-all-objects
// --batch-check='%(objectname)'` output — one object name per line — into a
// set. Blank lines are ignored; the first field is the object name.
func ParseObjectNames(r io.Reader) (map[string]struct{}, error) {
	return parseFirstField(r)
}

// parseFirstField reads whitespace-separated lines into a set keyed on each
// line's first field, skipping blank lines. Both the rev-list and the cat-file
// forms are "the object name is the first field", so one parser serves both.
func parseFirstField(r io.Reader) (map[string]struct{}, error) {
	set := make(map[string]struct{})
	sc := bufio.NewScanner(r)
	// Object listings can be large for a big push; raise the token cap well
	// above a single line's worst case so a long path never splits a line.
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		name := line
		if sp := strings.IndexAny(line, " \t"); sp != -1 {
			name = line[:sp]
		}
		if name != "" {
			set[name] = struct{}{}
		}
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("reading object list: %w", err)
	}
	return set, nil
}

// StowawayReason is the pure determination at the heart of the check: given the
// set of objects physically in the quarantine, the set reachable-and-introduced
// from the new head, and the set the repository already had, it returns a
// refusal reason naming the count of surplus objects, or "" when there is no
// surplus. A quarantined object that is neither introduced nor already-had is a
// stowaway; one is enough to refuse (workflow 14 "No stowaways": "One object
// more, and the push is refused"; "excluding what the repository already had").
func StowawayReason(quarantined, introduced, alreadyHad map[string]struct{}) string {
	surplus := surplusObjects(quarantined, introduced, alreadyHad)
	if len(surplus) == 0 {
		return ""
	}
	return fmt.Sprintf(
		"refs/heads/main: push carries %d object(s) unreachable from the new head (stowaways); refused",
		len(surplus),
	)
}

// surplusObjects is quarantined minus introduced minus already-had, sorted for a
// deterministic result (only the count is reported; the ids are content
// SHAs, never song text).
func surplusObjects(quarantined, introduced, alreadyHad map[string]struct{}) []string {
	var surplus []string
	for obj := range quarantined {
		if _, ok := introduced[obj]; ok {
			continue
		}
		if _, ok := alreadyHad[obj]; ok {
			continue
		}
		surplus = append(surplus, obj)
	}
	sort.Strings(surplus)
	return surplus
}

// Stowaways is the object-reachability layer the binary composes: for the one
// accepted, non-deletion refs/heads/main update it reaches from the new head
// and refuses the push if the quarantine carries any object that new head does
// not reach (and the repository did not already have). It returns one refusal
// reason (an empty slice accepts) or an error for a real git failure, which the
// caller maps to a refusal (never accept something it could not verify —
// hook.stowaways Constraint). repoDir is the bare repository the git commands
// run in (empty = inherit the hook's cwd, which git sets to the bare repo);
// quarantinePath is GIT_QUARANTINE_PATH (falling back to GIT_OBJECT_DIRECTORY).
func Stowaways(updates []RefUpdate, repoDir, quarantinePath string) (reasons []string, err error) {
	newHead, ok := acceptedMainHead(updates)
	if !ok {
		// No accepted non-deletion refs/heads/main update to reach from. main
		// runs this layer only after the refs layer accepted exactly such an
		// update, so this is a defensive no-op (Decision: run only after refs
		// accepts).
		return nil, nil
	}
	if quarantinePath == "" {
		// git exposes a quarantine to every receive-pack hook (≥ 2.13). Without
		// it the hook cannot tell pushed objects from existing ones, so it
		// refuses rather than accept unverified (Decision; "a git failure is a
		// refusal").
		return []string{"refs/heads/main: push object quarantine unavailable; cannot verify objects — refused"}, nil
	}

	// The reachable delta: objects reachable from the new head that the
	// repository did not already have (workflow 14's "rev-list --objects from
	// the new head, excluding what the repository already had"). Run with the
	// inherited environment so git sees the quarantine and the real store
	// together.
	introduced, err := revListObjects(repoDir, newHead)
	if err != nil {
		return nil, err
	}

	// Every object physically in the quarantine (loose and packed), read with
	// the object directory pointed at the quarantine and alternates cleared so
	// the main store is excluded.
	quarantined, err := quarantineObjects(repoDir, quarantinePath)
	if err != nil {
		return nil, err
	}

	// A quarantined object outside the introduced set is a candidate stowaway —
	// unless the repository already had it (a redundant re-send of an existing
	// object, which "excluding what the repository already had" permits).
	alreadyHad := make(map[string]struct{})
	for obj := range quarantined {
		if _, ok := introduced[obj]; ok {
			continue
		}
		had, err := objectInMainStore(repoDir, obj)
		if err != nil {
			return nil, err
		}
		if had {
			alreadyHad[obj] = struct{}{}
		}
	}

	if reason := StowawayReason(quarantined, introduced, alreadyHad); reason != "" {
		return []string{reason}, nil
	}
	return nil, nil
}

// acceptedMainHead returns the new object name of the single non-deletion
// refs/heads/main update, and whether one was present.
func acceptedMainHead(updates []RefUpdate) (string, bool) {
	for _, u := range updates {
		if u.Ref == MainRef && u.New != ZeroSHA {
			return u.New, true
		}
	}
	return "", false
}

// revListObjects returns the objects reachable from newHead that the repository
// did not already have, via `git rev-list --objects newHead --not --all`, run
// with the inherited environment (the quarantine and the real store both
// visible, so a thin push's reused bases resolve). Do not reimplement
// reachability (Constraint: delegate object knowledge to git).
func revListObjects(repoDir, newHead string) (map[string]struct{}, error) {
	out, err := runGit(repoDir, nil, "rev-list", "--objects", newHead, "--not", "--all")
	if err != nil {
		return nil, fmt.Errorf("git rev-list --objects %s --not --all: %w", newHead, err)
	}
	return ParseRevListObjects(bytes.NewReader(out))
}

// quarantineObjects enumerates every object physically present in the quarantine
// directory via `git cat-file --batch-all-objects --batch-check='%(objectname)'`
// with GIT_OBJECT_DIRECTORY pointed at the quarantine and the alternates and
// quarantine markers removed, so the main store's objects are not counted
// (Decision: enumerate the quarantine, do not re-walk reachability, and do not
// walk objects/ by hand).
func quarantineObjects(repoDir, quarantinePath string) (map[string]struct{}, error) {
	env := append(
		envWithout(os.Environ(), envVarObjectDir, envVarAlternates, envVarQuarantine),
		envVarObjectDir+"="+quarantinePath,
	)
	out, err := runGit(repoDir, env, "cat-file", "--batch-all-objects", "--batch-check=%(objectname)")
	if err != nil {
		return nil, fmt.Errorf("git cat-file --batch-all-objects over the quarantine: %w", err)
	}
	return ParseObjectNames(bytes.NewReader(out))
}

// objectInMainStore reports whether obj is in the repository's pre-existing
// object store — the realization of "excluding what the repository already had".
// It runs `git cat-file -e obj` with the quarantine and alternate markers
// removed, so git reads only the bare repo's own objects directory. A clean exit
// means present; exit 1 means absent; any other failure is a real git error.
func objectInMainStore(repoDir, obj string) (bool, error) {
	env := envWithout(os.Environ(), envVarObjectDir, envVarAlternates, envVarQuarantine)
	cmd := exec.Command("git", "cat-file", "-e", obj)
	if repoDir != "" {
		cmd.Dir = repoDir
	}
	cmd.Env = env
	err := cmd.Run()
	if err == nil {
		return true, nil
	}
	if exit, ok := err.(*exec.ExitError); ok && exit.ExitCode() == 1 {
		return false, nil
	}
	return false, fmt.Errorf("git cat-file -e: %w", err)
}

// runGit runs a git command in repoDir (empty = inherit cwd), with env (nil =
// inherit the process environment), returning its stdout. A non-zero exit is an
// error carrying git's stderr but never the pushed object contents.
func runGit(repoDir string, env []string, args ...string) ([]byte, error) {
	cmd := exec.Command("git", args...)
	if repoDir != "" {
		cmd.Dir = repoDir
	}
	if env != nil {
		cmd.Env = env
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if stderr.Len() > 0 {
			return nil, fmt.Errorf("%w: %s", err, strings.TrimSpace(stderr.String()))
		}
		return nil, err
	}
	return stdout.Bytes(), nil
}

// envWithout returns base with every entry whose key is in keys removed. git
// reads the first matching environment entry, so to override GIT_OBJECT_DIRECTORY
// (and clear the alternates/quarantine markers) the inherited entries must be
// dropped, not merely followed by a new one.
func envWithout(base []string, keys ...string) []string {
	out := make([]string, 0, len(base))
	for _, e := range base {
		drop := false
		for _, k := range keys {
			if strings.HasPrefix(e, k+"=") {
				drop = true
				break
			}
		}
		if !drop {
			out = append(out, e)
		}
	}
	return out
}

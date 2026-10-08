package main

// Behavior test for the object-reachability layer (hook.stowaways): the real
// pre-receive binary, installed in a real bare repository the way the service
// installs it, run by a real `git receive-pack` over a real quarantine. It
// reuses buildHook/newBook/git/mustGit/writeSong from the refs behavior test
// (refs_test.go, same package). Pins workflow 14 "No stowaways"
// (docs/workflows/14-file-view.md:98-101), both clauses:
//   - a crafted pack carrying an object unreachable from the new head is refused
//     whole, the fault named on git's channel ("One object more …");
//   - a normal fast-forward push, whose quarantine holds only introduced
//     objects, is accepted ("excluding what the repository already had").
//
// A well-behaved client's pack-objects never sends an unreachable object, so the
// stowaway case cannot be produced by `git push`: it builds a pack from an
// explicit object list (the new head's introduced objects plus a purpose-written
// unreachable blob) and frames a receive-pack request by hand so the extra
// object reaches a real quarantine and the real hook — the honest reproduction
// of a misbehaving client (hook.stowaways Decision).

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
	"testing"
)

func TestPreReceiveStowaways(t *testing.T) {
	hooksDir := buildHook(t)

	t.Run("a normal fast-forward push reusing existing objects is accepted", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		// A thin pack whose base objects (the first song's blob and the root
		// tree's unchanged entries) the repo already holds: the quarantine
		// carries only the introduced objects, all reachable from the new head.
		writeSong(t, work, "segundo.cifra.md", "# Segundo\n\n```\n[Am] Mais uma linha\n```\n")
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Add a second song")
		if out, err := git(t, work, "push", "origin", "main"); err != nil {
			t.Fatalf("a clean fast-forward should be accepted: %v\n%s", err, out)
		}
	})

	t.Run("a crafted pack carrying an unreachable object is refused whole", func(t *testing.T) {
		bare, work := newBook(t, hooksDir, true)

		old := strings.TrimSpace(mustGit(t, bare, "rev-parse", "main"))

		// A real fast-forward commit for main (its objects are legitimate).
		writeSong(t, work, "terceiro.cifra.md", "# Terceiro\n\n```cifra\n[G]Linha legitima\n```\n")
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Add a third song")
		newHead := strings.TrimSpace(mustGit(t, work, "rev-parse", "HEAD"))

		// A purpose-written object no commit refers to — the stowaway. Written
		// loose into the work repo's store with hash-object -w, never added to
		// any tree or ref (fixtures rule: purpose-written, never copyrighted).
		writeSong(t, work, "stowaway.txt", "an object riding along that no commit refers to\n")
		stowaway := strings.TrimSpace(mustGit(t, work, "hash-object", "-w", "stowaway.txt"))

		// The honest attack: a pack of the new head's introduced objects PLUS
		// the stowaway, built from an explicit object list.
		objects := revListObjectNames(t, work, newHead, old)
		objects = append(objects, stowaway)
		pack := packObjects(t, work, objects)

		// Frame a receive-pack request by hand: one fast-forward command line
		// for refs/heads/main (report-status so the server reports per-ref
		// status; no side-band, so the hook's stderr reaches receive-pack's own
		// stderr, which we capture), a flush, then the pack.
		var req bytes.Buffer
		req.WriteString(pktLine(fmt.Sprintf("%s %s %s\x00report-status", old, newHead, "refs/heads/main")))
		req.WriteString("0000")
		req.Write(pack)

		stdout, stderr := receivePack(t, bare, req.Bytes())

		// The whole push is refused: the hook's reason reaches the client on
		// git's channel (receive-pack's stderr), naming the stowaway fault…
		if !strings.Contains(stderr, "stowaway") {
			t.Errorf("hook stderr should name the stowaway fault; got:\n%s", stderr)
		}
		// …and receive-pack reports the ref not-OK (declined), not accepted.
		if !strings.Contains(stdout, "ng refs/heads/main") {
			t.Errorf("receive-pack should report refs/heads/main declined (ng); got stdout:\n%q", stdout)
		}
		// And nothing migrated: main still points at the old tip, the crafted
		// objects never reached the repository.
		if got := strings.TrimSpace(mustGit(t, bare, "rev-parse", "main")); got != old {
			t.Errorf("main moved to %s; a refused push must leave it at %s", got, old)
		}
	})
}

// revListObjectNames returns the object names reachable from newHead but not
// from old, via `git rev-list --objects newHead --not old` (the first field of
// each line — the path, if any, is dropped).
func revListObjectNames(t *testing.T, dir, newHead, old string) []string {
	t.Helper()
	out := mustGit(t, dir, "rev-list", "--objects", newHead, "--not", old)
	var names []string
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if sp := strings.IndexAny(line, " \t"); sp != -1 {
			line = line[:sp]
		}
		names = append(names, line)
	}
	return names
}

// packObjects builds a packfile from an explicit object-name list with
// `git pack-objects --stdout -q` (the list on stdin, the binary pack on stdout).
func packObjects(t *testing.T, dir string, objects []string) []byte {
	t.Helper()
	cmd := exec.Command("git", "pack-objects", "--stdout", "-q")
	cmd.Dir = dir
	cmd.Env = gitEnv()
	cmd.Stdin = strings.NewReader(strings.Join(objects, "\n") + "\n")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		t.Fatalf("git pack-objects: %v\n%s", err, stderr.String())
	}
	return stdout.Bytes()
}

// receivePack runs `git receive-pack <bare>` directly with the framed request on
// stdin — the server side of a push, which sets up the quarantine and runs the
// pre-receive hook identically to the smart-HTTP path. It returns receive-pack's
// stdout (the ref advertisement and the report-status) and stderr (where the
// hook's own messages land when side-band is not negotiated).
func receivePack(t *testing.T, bare string, request []byte) (stdout, stderr string) {
	t.Helper()
	cmd := exec.Command("git", "receive-pack", bare)
	cmd.Env = gitEnv()
	cmd.Stdin = bytes.NewReader(request)
	var out, errBuf bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errBuf
	// A pre-receive refusal makes receive-pack exit non-zero on some git
	// versions and zero on others; the result is read from its output, not its
	// exit code, so an error here is not fatal.
	_ = cmd.Run()
	return out.String(), errBuf.String()
}

// pktLine encodes s as a git pkt-line: a 4-hex-digit length prefix counting the
// 4 prefix bytes themselves, then the payload.
func pktLine(s string) string {
	return fmt.Sprintf("%04x%s", len(s)+4, s)
}

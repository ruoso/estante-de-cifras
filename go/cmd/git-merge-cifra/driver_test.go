package main

// Behaviour test of git-merge-cifra as a git merge driver (the .tji note's
// "behavior" level, §11.14): the built binary is configured as the `cifra`
// merge driver in a throwaway repository, and two branches are merged through
// the git CLI — clean, conflicted, setlist, a marked input and a non-UTF-8
// input. It needs only the git CLI and `go build`; no compose stack, no new
// dependency. Fixtures are tiny invented songs and setlists, never a real song.

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	cifra "github.com/ruoso/cifra.md/go"
)

var binPath string

func TestMain(m *testing.M) {
	dir, err := os.MkdirTemp("", "git-merge-cifra-bin")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	binPath = filepath.Join(dir, "git-merge-cifra")
	build := exec.Command("go", "build", "-o", binPath, ".")
	build.Env = append(os.Environ(), "CGO_ENABLED=0") // one static binary (§11.14)
	if out, err := build.CombinedOutput(); err != nil {
		fmt.Fprintf(os.Stderr, "building git-merge-cifra failed: %v\n%s", err, out)
		os.RemoveAll(dir)
		os.Exit(1)
	}
	code := m.Run()
	os.RemoveAll(dir)
	os.Exit(code)
}

// mustGit runs a git command that is expected to succeed (repository setup).
func mustGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
}

// gitMerge runs `git merge` and returns its exit code and combined output (the
// driver's stderr among it).
func gitMerge(t *testing.T, dir, branch string) (int, string) {
	t.Helper()
	cmd := exec.Command("git", "merge", "--no-edit", branch)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err == nil {
		return 0, string(out)
	}
	if ee, ok := err.(*exec.ExitError); ok {
		return ee.ExitCode(), string(out)
	}
	t.Fatalf("git merge: %v\n%s", err, out)
	return -1, ""
}

// scenario sets up a fresh repository with git-merge-cifra as the `cifra` merge
// driver, commits base on main, makes a divergent change on each side, and
// merges `other` into main. It returns the merge's exit code, output and the
// merged working-tree file.
func scenario(t *testing.T, filename string, base, ours, theirs []byte) (int, string, []byte) {
	t.Helper()
	dir := t.TempDir()
	mustGit(t, dir, "init", "-q", "-b", "main")
	mustGit(t, dir, "config", "user.email", "test@example.invalid")
	mustGit(t, dir, "config", "user.name", "Test")
	mustGit(t, dir, "config", "commit.gpgsign", "false")
	mustGit(t, dir, "config", "merge.cifra.name", "cifra three-way merge")
	mustGit(t, dir, "config", "merge.cifra.driver", binPath+" %O %A %B %P")
	writeFile(t, dir, ".gitattributes", []byte("*.cifra.md merge=cifra\n*.setlist.md merge=cifra\n"))
	mustGit(t, dir, "add", ".gitattributes")
	mustGit(t, dir, "commit", "-qm", "attrs")

	writeFile(t, dir, filename, base)
	mustGit(t, dir, "add", filename)
	mustGit(t, dir, "commit", "-qm", "base")

	mustGit(t, dir, "checkout", "-q", "-b", "other")
	writeFile(t, dir, filename, theirs)
	mustGit(t, dir, "commit", "-qam", "theirs")

	mustGit(t, dir, "checkout", "-q", "main")
	writeFile(t, dir, filename, ours)
	mustGit(t, dir, "commit", "-qam", "ours")

	code, out := gitMerge(t, dir, "other")
	data, err := os.ReadFile(filepath.Join(dir, filename))
	if err != nil {
		data = nil
	}
	return code, out, data
}

func writeFile(t *testing.T, dir, name string, data []byte) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
		t.Fatal(err)
	}
}

// Two independent changes (different existing sections) merge cleanly: exit 0,
// the working-tree file is the canonical merged text, no markers left.
func TestCleanSongMerge(t *testing.T) {
	base := []byte("# Song\n\n## Verse\n\nC G\n\n## Chorus\n\nF C\n")
	ours := []byte("# Song\n\n## Verse\n\nC D\n\n## Chorus\n\nF C\n")
	theirs := []byte("# Song\n\n## Verse\n\nC G\n\n## Chorus\n\nF Am\n")
	code, out, worktree := scenario(t, "s.cifra.md", base, ours, theirs)
	if code != 0 {
		t.Fatalf("clean merge should exit 0, got %d\n%s", code, out)
	}
	if bytes.Contains(worktree, []byte("<<<<<<<")) {
		t.Errorf("clean merge left conflict markers:\n%s", worktree)
	}
	exp, err := cifra.Merge(base, ours, theirs, false)
	if err != nil || exp.Result == nil {
		t.Fatalf("library merge gave no result: %v", err)
	}
	if string(worktree) != *exp.Result {
		t.Errorf("worktree not the canonical merge\n got: %q\nwant: %q", worktree, *exp.Result)
	}
}

// Two changes to the same line conflict: non-zero exit, the working-tree file is
// the marked text (markers exactly seven chars), the path is unmerged.
func TestConflictedSongMerge(t *testing.T) {
	base := []byte("# Song\n\n## Verse\n\nC G\n")
	ours := []byte("# Song\n\n## Verse\n\nC D\n")
	theirs := []byte("# Song\n\n## Verse\n\nC E\n")
	code, out, worktree := scenario(t, "s.cifra.md", base, ours, theirs)
	if code == 0 {
		t.Fatalf("conflicted merge should exit non-zero\n%s", out)
	}
	if !bytes.Contains(worktree, []byte("<<<<<<< ours")) ||
		!bytes.Contains(worktree, []byte("=======")) ||
		!bytes.Contains(worktree, []byte(">>>>>>> theirs")) {
		t.Errorf("conflicted merge lacks seven-character markers:\n%s", worktree)
	}
	if bytes.Contains(worktree, []byte("<<<<<<<<")) {
		t.Errorf("markers are longer than seven characters:\n%s", worktree)
	}
	exp, err := cifra.Merge(base, ours, theirs, false)
	if err != nil || exp.Marked == nil {
		t.Fatalf("library merge gave no marked text: %v", err)
	}
	if string(worktree) != *exp.Marked {
		t.Errorf("worktree not the marked text\n got: %q\nwant: %q", worktree, *exp.Marked)
	}
	if !strings.Contains(out, "conflict") {
		t.Errorf("git did not report a conflict:\n%s", out)
	}
}

// The same two cases on a .setlist.md file prove the path-kind dispatch (§11.14
// chooses setlist by %P).
func TestSetlistMerge(t *testing.T) {
	base := []byte("# Set\n\n1. [A](a.cifra.md)\n2. [B](b.cifra.md)\n")
	ours := []byte("# Set\n\n1. [A](a.cifra.md)\n2. [B](b.cifra.md)\n3. [C](c.cifra.md)\n")
	theirs := []byte("# Set\n\n1. [A](a.cifra.md)\n2. [B](b.cifra.md)\n4. [D](d.cifra.md)\n")

	t.Run("clean", func(t *testing.T) {
		code, out, worktree := scenario(t, "l.setlist.md", base, ours, theirs)
		if code != 0 {
			t.Fatalf("clean setlist merge should exit 0, got %d\n%s", code, out)
		}
		exp, err := cifra.Merge(base, ours, theirs, true)
		if err != nil || exp.Result == nil {
			t.Fatalf("library setlist merge gave no result: %v", err)
		}
		if string(worktree) != *exp.Result {
			t.Errorf("worktree not the canonical setlist merge\n got: %q\nwant: %q", worktree, *exp.Result)
		}
	})

	t.Run("conflicted", func(t *testing.T) {
		cbase := []byte("# Set\n\n1. [A](a.cifra.md)\n")
		cours := []byte("# Set\n\n1. [A one](a.cifra.md)\n")
		ctheirs := []byte("# Set\n\n1. [A two](a.cifra.md)\n")
		code, out, worktree := scenario(t, "l.setlist.md", cbase, cours, ctheirs)
		if code == 0 {
			t.Fatalf("conflicted setlist merge should exit non-zero\n%s", out)
		}
		if !bytes.Contains(worktree, []byte("<<<<<<< ours")) {
			t.Errorf("conflicted setlist merge lacks a marked region:\n%s", worktree)
		}
		exp, err := cifra.Merge(cbase, cours, ctheirs, true)
		if err != nil || exp.Marked == nil {
			t.Fatalf("library setlist merge gave no marked text: %v", err)
		}
		if string(worktree) != *exp.Marked {
			t.Errorf("worktree not the setlist marked text\n got: %q\nwant: %q", worktree, *exp.Marked)
		}
	})
}

// A branch whose file holds a marker line leaves the file untouched, exits
// non-zero, and names the inputs that hold marker lines on stderr (no song
// text).
func TestMarkedInputLeftUntouched(t *testing.T) {
	base := []byte("# Song\n\n## Verse\n\nC G\n")
	ours := []byte("# Song\n\n## Verse\n\n<<<<<<< ours\nC D\n=======\nC E\n>>>>>>> theirs\n")
	theirs := []byte("# Song\n\n## Verse\n\nC G\n\n## Chorus\n\nF C\n")
	code, out, worktree := scenario(t, "s.cifra.md", base, ours, theirs)
	if code == 0 {
		t.Fatalf("a marked input should not merge (exit non-zero)\n%s", out)
	}
	if !bytes.Equal(worktree, ours) {
		t.Errorf("a marked ours should be left byte for byte\n got: %q\nwant: %q", worktree, ours)
	}
	if !strings.Contains(out, "conflict markers left") {
		t.Errorf("stderr did not report the marked input:\n%s", out)
	}
}

// A branch whose file is not UTF-8 leaves the file untouched, exits non-zero,
// and says which side is unreadable on stderr.
func TestNonUTF8InputLeftUntouched(t *testing.T) {
	base := []byte("# Song\n\n## Verse\n\nC G\n")
	ours := append([]byte("# Song\n\n## Verse\n\nC G\n"), 0xff, 0xfe)
	theirs := []byte("# Song\n\n## Verse\n\nC G\n\n## Chorus\n\nF C\n")
	code, out, worktree := scenario(t, "s.cifra.md", base, ours, theirs)
	if code == 0 {
		t.Fatalf("a non-UTF-8 input should not merge (exit non-zero)\n%s", out)
	}
	if !bytes.Equal(worktree, ours) {
		t.Errorf("a non-UTF-8 ours should be left untouched\n got: %q\nwant: %q", worktree, ours)
	}
	if !strings.Contains(out, "not UTF-8") {
		t.Errorf("stderr did not report the non-UTF-8 input:\n%s", out)
	}
}

// Wrong argument count prints a usage line and exits 2.
func TestUsage(t *testing.T) {
	cmd := exec.Command(binPath, "only", "two")
	out, err := cmd.CombinedOutput()
	ee, ok := err.(*exec.ExitError)
	if !ok || ee.ExitCode() != 2 {
		t.Fatalf("wrong argument count should exit 2, got %v\n%s", err, out)
	}
	if !strings.Contains(string(out), "usage:") {
		t.Errorf("no usage line:\n%s", out)
	}
}

package main

// Behavior test for the pre-receive hook: build the real binary, install it in
// a bare repository via core.hooksPath exactly as the service does
// (service.git_http), and drive the host `git` CLI as a local push against it.
// git sets up the quarantine and runs the hook identically whether invoked
// locally or over smart HTTP, and the hook's whole contract is stdin + env +
// quarantine, so a local push reproduces all of it with no server and no
// Postgres — the hook has no DB (hook.refs Decision). Pins workflow 14
// "One ref." (docs/workflows/14-file-view.md:94-95) and "Fast-forward only."
// (:96-97).

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// buildHook builds the pre-receive binary into a temp hooks directory and
// returns that directory (the file is named exactly "pre-receive", which git
// requires). Built once and shared read-only across the subtests.
func buildHook(t *testing.T) string {
	t.Helper()
	hooksDir := t.TempDir()
	bin := filepath.Join(hooksDir, "pre-receive")
	cmd := exec.Command("go", "build", "-o", bin, ".")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("go build pre-receive: %v\n%s", err, out)
	}
	return hooksDir
}

// gitEnv is the hardened, host-independent environment every git in this test
// runs with: no system/global config leaking in (signing, hooks), no terminal
// prompt, and a fixed author/committer so commits need no host identity.
func gitEnv() []string {
	return append(os.Environ(),
		"GIT_CONFIG_NOSYSTEM=1",
		"GIT_TERMINAL_PROMPT=0",
		"GIT_AUTHOR_NAME=Estante Hook Test",
		"GIT_AUTHOR_EMAIL=hook@estante.test",
		"GIT_COMMITTER_NAME=Estante Hook Test",
		"GIT_COMMITTER_EMAIL=hook@estante.test",
	)
}

// git runs one git command in dir and returns its combined output and error.
func git(t *testing.T, dir string, args ...string) (string, error) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = gitEnv()
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// mustGit runs git and fails the test on any error.
func mustGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	out, err := git(t, dir, args...)
	if err != nil {
		t.Fatalf("git %s in %s: %v\n%s", strings.Join(args, " "), dir, err, out)
	}
	return out
}

// newBook sets up a bare repository wired to the hook via core.hooksPath and a
// work repository with one commit on main. When pushMain is true the initial
// commit is already pushed (main exists), so update/other-ref cases have a
// base; when false the work repo's main is unpushed (for the creation case).
func newBook(t *testing.T, hooksDir string, pushMain bool) (bare, work string) {
	t.Helper()
	root := t.TempDir()
	bare = filepath.Join(root, "book.git")
	work = filepath.Join(root, "work")

	mustGit(t, root, "init", "--bare", "-b", "main", bare)
	// Install the hook the way the service does: point this repo at the shared
	// hooks directory rather than copying a per-repo hook (hook.refs Decision).
	mustGit(t, bare, "config", "core.hooksPath", hooksDir)

	mustGit(t, root, "init", "-b", "main", work)
	writeSong(t, work, "a-cancao-de-afinacao.cifra.md", "# A Cancao de Afinacao\n\n```cifra\n[C]Uma linha pra testar\n```\n")
	mustGit(t, work, "add", ".")
	mustGit(t, work, "commit", "-m", "Add the tuning song")
	mustGit(t, work, "remote", "add", "origin", bare)

	if pushMain {
		mustGit(t, work, "push", "origin", "main")
	}
	return bare, work
}

func writeSong(t *testing.T, dir, name, content string) {
	t.Helper()
	// A song written for the purpose — never copyrighted words (fixtures rule).
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}

func TestPreReceiveRefs(t *testing.T) {
	hooksDir := buildHook(t)

	t.Run("the initial push that creates main is accepted", func(t *testing.T) {
		_, work := newBook(t, hooksDir, false)
		if out, err := git(t, work, "push", "origin", "main"); err != nil {
			t.Fatalf("initial creation of main should be accepted: %v\n%s", err, out)
		}
	})

	t.Run("a fast-forward update to main is accepted", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		writeSong(t, work, "segundo.cifra.md", "# Segundo\n\n```cifra\n[Am]Outra linha\n```\n")
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Add a second song")
		if out, err := git(t, work, "push", "origin", "main"); err != nil {
			t.Fatalf("fast-forward to main should be accepted: %v\n%s", err, out)
		}
	})

	t.Run("a non-fast-forward (forced) update to main is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		// Rewrite the tip, then force-push: the client sends it, the hook refuses.
		mustGit(t, work, "commit", "--amend", "-m", "Rewritten history")
		out, err := git(t, work, "push", "--force", "origin", "main")
		assertRefused(t, out, err, "non-fast-forward")
	})

	t.Run("deleting main is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		out, err := git(t, work, "push", "origin", "--delete", "main")
		assertRefused(t, out, err, "deleting the branch")
	})

	t.Run("another branch is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		mustGit(t, work, "branch", "draft")
		out, err := git(t, work, "push", "origin", "draft")
		assertRefused(t, out, err, "refs/heads/draft")
	})

	t.Run("a tag is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		mustGit(t, work, "tag", "v1")
		out, err := git(t, work, "push", "origin", "v1")
		assertRefused(t, out, err, "refs/tags/v1")
	})

	t.Run("a note is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		mustGit(t, work, "notes", "add", "-m", "a note", "HEAD")
		out, err := git(t, work, "push", "origin", "refs/notes/commits")
		assertRefused(t, out, err, "refs/notes/commits")
	})
}

// assertRefused fails unless the push failed and git's relayed output names the
// structural fault (git prefixes the hook's stderr with "remote:").
func assertRefused(t *testing.T, out string, err error, wantReason string) {
	t.Helper()
	if err == nil {
		t.Fatalf("push should have been refused, but it succeeded:\n%s", out)
	}
	if !strings.Contains(out, "remote:") {
		t.Errorf("refusal should reach the client on git's channel (a remote: line); got:\n%s", out)
	}
	if !strings.Contains(out, wantReason) {
		t.Errorf("refusal should name %q; got:\n%s", wantReason, out)
	}
}

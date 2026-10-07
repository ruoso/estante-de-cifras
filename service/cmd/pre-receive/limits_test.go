package main

// Behavior test for the account-and-book byte-cap layer (hook.limits) and git's
// own push guards, driven through a real bare repository the way the service
// installs the hook. It reuses buildHook/newBook/git/mustGit/writeSong/
// assertRefused from the refs behavior test (refs_test.go) and
// packObjects/receivePack/pktLine from the stowaways behavior test
// (stowaways_test.go), same package.
//
// Two kinds of guard, two drivers:
//   - the hook's per-book and per-account caps run inside the pre-receive binary
//     on the quarantined objects, reading the ESTANTE_* figures the service
//     sets; a local `git push` carrying those vars in its environment reproduces
//     the contract (workflow 14 "50 MB per book" docs/workflows/14-file-view.md:41
//     and "200 MB per account" :42–43);
//   - git's own guards (receive.maxInputSize, receive.fsckObjects) are enforced
//     by git during index-pack, before the hook runs, so they are set on the
//     bare repository here exactly as the service sets them via -c on the
//     receive-pack spawn (git_test.go's TestReceivePackGuards proves the service
//     sets them); pins workflow 14 "Git's own guards" :109–110.

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
	"testing"
)

const maxBookBytes = 50 * 1024 * 1024

// pushLimits pushes origin/main from work with the ESTANTE_* byte figures the
// service would set carried in the push's environment, so they reach the hook
// through the local receive-pack it spawns. Returns git's combined output and
// the error.
func pushLimits(t *testing.T, work string, bookBytes, accountRemaining int64) (string, error) {
	t.Helper()
	cmd := exec.Command("git", "push", "origin", "main")
	cmd.Dir = work
	cmd.Env = gitEnvLimits(bookBytes, accountRemaining)
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// commitSecondSong adds and commits a purpose-written second song on top of the
// book's main in work (never copyrighted words), leaving it ready to push.
func commitSecondSong(t *testing.T, work string) {
	t.Helper()
	writeSong(t, work, "segundo.cifra.md", "# Segundo\n\n```cifra\n[Am]Uma segunda linha pra crescer o livro\n```\n")
	mustGit(t, work, "add", ".")
	mustGit(t, work, "commit", "-m", "Add a second song")
}

func TestPreReceiveLimits(t *testing.T) {
	hooksDir := buildHook(t)

	t.Run("a push that would take the book over 50 MB is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		commitSecondSong(t, work)
		// The book sits just below the cap; any growth crosses it. The account
		// quota is generous, so only the per-book limit bites.
		out, err := pushLimits(t, work, maxBookBytes-10, 200*1024*1024)
		assertRefused(t, out, err, "per-book limit")
	})

	t.Run("a push over the account's remaining quota is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		commitSecondSong(t, work)
		// The book is empty-sized, so the per-book cap is nowhere near; the
		// account has almost no headroom, so the growth exceeds it.
		out, err := pushLimits(t, work, 0, 10)
		assertRefused(t, out, err, "storage limit")
	})

	t.Run("a push within both caps is accepted", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		commitSecondSong(t, work)
		if out, err := pushLimits(t, work, 0, 200*1024*1024); err != nil {
			t.Fatalf("a normal push within both caps should be accepted: %v\n%s", err, out)
		}
	})

	t.Run("receive.maxInputSize refuses an over-size pack", func(t *testing.T) {
		bare, work := newBook(t, hooksDir, true)
		// The service sets this via -c on the receive-pack spawn; set here on the
		// repo to exercise the same guard. A tiny cap no real pack fits under.
		mustGit(t, bare, "config", "receive.maxInputSize", "512")
		// Purpose-written filler large enough that the pack exceeds the cap.
		var body strings.Builder
		body.WriteString("# Filler\n\n```cifra\n")
		for i := 0; i < 2000; i++ {
			fmt.Fprintf(&body, "[C]linha de preenchimento numero %d pra engordar o pacote\n", i)
		}
		body.WriteString("```\n")
		writeSong(t, work, "filler.cifra.md", body.String())
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Add filler")
		out, err := git(t, work, "push", "origin", "main")
		if err == nil {
			t.Fatalf("an over-size pack should be refused by receive.maxInputSize:\n%s", out)
		}
		if !strings.Contains(out, "remote:") {
			t.Errorf("the refusal should reach the client on git's channel; got:\n%s", out)
		}
		if !strings.Contains(out, "maximum allowed size") {
			t.Errorf("git should name the pack-size limit; got:\n%s", out)
		}
	})

	t.Run("receive.fsckObjects refuses a malformed object", func(t *testing.T) {
		bare, work := newBook(t, hooksDir, true)
		mustGit(t, bare, "config", "receive.fsckObjects", "true")

		old := strings.TrimSpace(mustGit(t, bare, "rev-parse", "main"))
		tree := strings.TrimSpace(mustGit(t, work, "rev-parse", "HEAD^{tree}"))
		// A commit object missing its author line — a known fsck violation
		// (missingAuthor). hash-object --literally writes it despite the fault so
		// it can be packed and offered; receive.fsckObjects is what rejects it
		// during index-pack, before the hook runs.
		malformed := "tree " + tree +
			"\ncommitter Estante Hook Test <hook@estante.test> 1700000000 +0000\n\nmalformed: no author line\n"
		bad := hashObjectLiterally(t, work, "commit", malformed)

		pack := packObjects(t, work, []string{bad})
		var req bytes.Buffer
		req.WriteString(pktLine(fmt.Sprintf("%s %s %s\x00report-status", old, bad, "refs/heads/main")))
		req.WriteString("0000")
		req.Write(pack)

		_, stderr := receivePack(t, bare, req.Bytes())
		if !strings.Contains(stderr, "missingAuthor") && !strings.Contains(stderr, "fsck") {
			t.Errorf("receive.fsckObjects should name the malformed-object fault; got stderr:\n%s", stderr)
		}
		// Nothing migrated: a refused push leaves main at the old tip.
		if got := strings.TrimSpace(mustGit(t, bare, "rev-parse", "main")); got != old {
			t.Errorf("main moved to %s; a refused push must leave it at %s", got, old)
		}
	})
}

// hashObjectLiterally writes content as a loose object of the given type with
// `git hash-object -w --literally`, which stores it even when it would fail
// fsck, and returns its object name — the honest way to mint a malformed object
// a well-behaved client never would.
func hashObjectLiterally(t *testing.T, dir, typ, content string) string {
	t.Helper()
	cmd := exec.Command("git", "hash-object", "-t", typ, "-w", "--stdin", "--literally")
	cmd.Dir = dir
	cmd.Env = gitEnv()
	cmd.Stdin = strings.NewReader(content)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git hash-object --literally: %v\n%s", err, out)
	}
	return strings.TrimSpace(string(out))
}

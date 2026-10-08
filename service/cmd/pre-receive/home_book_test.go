package main

// Behavior test for the home-book dispatch: the REAL built pre-receive binary in
// a bare repo, driven by the host git CLI as a local push, with the push env
// carrying ESTANTE_BOOK_KIND the way the service sets it (gitEnvLimits extended).
// It reuses buildHook/gitEnvLimits/mustGit/git/writeAt/assertRefused from
// refs_test.go / contents_test.go. The hook runs server-side and inherits the
// push process's environment, so ESTANTE_BOOK_KIND on the push command reaches
// it exactly as the ESTANTE_BOOK_BYTES figures do.
//
// Pins the dispatch decision (docs/home-book-format.md §8; DIRECTION §2.1): a
// home book is validated as settings (§8 whitelist, canonical JSON §6), a song
// pushed to it is refused, and — with the kind unset or 'songbook' — a settings
// *.json is refused by the songbook path, so the branch is kind-gated.

import (
	"os/exec"
	"path/filepath"
	"testing"
)

// The exact §2.2 bytes and a canonical §6 preferences.json, re-spelled here in
// package main (the hook package's constants are unexported). A test that drifts
// from docs/home-book-format.md would push non-canonical bytes and fail, which is
// the point — these are held to the document, not shared from the hook package.
const (
	homeReadmeBytes = "# Home book\n" +
		"\n" +
		"This repository holds one person's Estante de Cifras settings. Its files are\n" +
		"JSON that merge key by key, the later change winning; it is written and merged\n" +
		"by the app, not edited by hand. The format is docs/home-book-format.md in the\n" +
		"estante-de-cifras repository.\n"

	homeGitattributesBytes = "* text=auto eol=lf\n" +
		"*.json merge=binary\n"

	canonicalPrefs = "{\n" +
		"  \"theme\": {\n" +
		"    \"at\": \"2026-10-05T14:30:00.000Z\",\n" +
		"    \"value\": \"palco\"\n" +
		"  }\n" +
		"}\n"
)

// homeEnv is the push env a home-book push carries: the hardened, limit-bearing
// env the songbook behavior tests use, plus ESTANTE_BOOK_KIND=home the way the
// service forwards it (server.pushEnv).
func homeEnv() []string {
	return append(gitEnvLimits(0, 200*1024*1024), "ESTANTE_BOOK_KIND=home")
}

// gitWithEnv runs a git command with an explicit environment (the push env that
// reaches the hook), returning git's combined output and error. Setup commands
// keep using mustGit (gitEnv); only the push needs the kind-bearing env.
func gitWithEnv(t *testing.T, dir string, env []string, args ...string) (string, error) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = env
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// newHomeRepo stands up a bare repo with the hook installed and a work tree with
// origin set, but — unlike newBook — seeds no song, so a home-book commit can be
// built from scratch.
func newHomeRepo(t *testing.T, hooksDir string) (bare, work string) {
	t.Helper()
	root := t.TempDir()
	bare = filepath.Join(root, "book.git")
	work = filepath.Join(root, "work")
	mustGit(t, root, "init", "--bare", "-b", "main", bare)
	mustGit(t, bare, "config", "core.hooksPath", hooksDir)
	mustGit(t, root, "init", "-b", "main", work)
	mustGit(t, work, "remote", "add", "origin", bare)
	return bare, work
}

// writeCanonicalHome writes the exact §2.2 README.md/.gitattributes into work, so
// a home-book push differs from a songbook one only in the settings files under
// test.
func writeCanonicalHome(t *testing.T, work string) {
	t.Helper()
	writeAt(t, work, "README.md", []byte(homeReadmeBytes))
	writeAt(t, work, ".gitattributes", []byte(homeGitattributesBytes))
}

func TestPreReceiveHomeBook(t *testing.T) {
	hooksDir := buildHook(t)

	t.Run("a canonical home-book push is accepted", func(t *testing.T) {
		_, work := newHomeRepo(t, hooksDir)
		writeCanonicalHome(t, work)
		writeAt(t, work, "preferences.json", []byte(canonicalPrefs))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Bring the home book online")
		if out, err := gitWithEnv(t, work, homeEnv(), "push", "origin", "main"); err != nil {
			t.Fatalf("a canonical home-book push should be accepted: %v\n%s", err, out)
		}
	})

	t.Run("a song pushed to a home book is refused", func(t *testing.T) {
		_, work := newHomeRepo(t, hooksDir)
		writeCanonicalHome(t, work)
		writeAt(t, work, "a-cancao.cifra.md", []byte("# A Cancao\n\n```\n[C] Uma linha\n```\n"))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "A song in the home book")
		out, err := gitWithEnv(t, work, homeEnv(), "push", "origin", "main")
		assertRefused(t, out, err, "song or setlist")
	})

	t.Run("a non-canonical settings file is refused", func(t *testing.T) {
		_, work := newHomeRepo(t, hooksDir)
		writeCanonicalHome(t, work)
		// value before at — a valid register, but not in canonical key order (§6).
		noncanon := "{\n  \"theme\": {\n    \"value\": \"palco\",\n    \"at\": \"2026-10-05T14:30:00.000Z\"\n  }\n}\n"
		writeAt(t, work, "preferences.json", []byte(noncanon))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "A non-canonical settings file")
		out, err := gitWithEnv(t, work, homeEnv(), "push", "origin", "main")
		assertRefused(t, out, err, "not in canonical form")
	})

	t.Run("a settings file over 256 KB is refused", func(t *testing.T) {
		_, work := newHomeRepo(t, hooksDir)
		writeCanonicalHome(t, work)
		// A canonical-shaped but over-cap settings file: a long opaque string value.
		big := make([]byte, 300*1024)
		for i := range big {
			big[i] = 'a'
		}
		oversize := "{\n  \"theme\": {\n    \"at\": \"2026-10-05T14:30:00.000Z\",\n    \"value\": \"" + string(big) + "\"\n  }\n}\n"
		writeAt(t, work, "preferences.json", []byte(oversize))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "An over-size settings file")
		out, err := gitWithEnv(t, work, homeEnv(), "push", "origin", "main")
		assertRefused(t, out, err, "per-file limit")
	})

	t.Run("the branch is kind-gated: a settings file to a songbook is refused", func(t *testing.T) {
		// With ESTANTE_BOOK_KIND absent (gitEnv), the push is validated as a
		// songbook: a *.json settings file is not an allowed songbook path.
		_, work := newBook(t, hooksDir, false)
		writeAt(t, work, "preferences.json", []byte(canonicalPrefs))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Settings in a songbook")
		out, err := git(t, work, "push", "origin", "main")
		assertRefused(t, out, err, "not an allowed path for a songbook")
	})

	t.Run("an explicit songbook kind still refuses a settings file", func(t *testing.T) {
		_, work := newBook(t, hooksDir, false)
		writeAt(t, work, "preferences.json", []byte(canonicalPrefs))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Settings in an explicit songbook")
		env := append(gitEnvLimits(0, 200*1024*1024), "ESTANTE_BOOK_KIND=songbook")
		out, err := gitWithEnv(t, work, env, "push", "origin", "main")
		assertRefused(t, out, err, "not an allowed path for a songbook")
	})
}

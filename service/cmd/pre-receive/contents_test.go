package main

// Behavior test for the "what a book may hold" layer (hook.contents): the real
// pre-receive binary, installed in a real bare repository the way the service
// installs it, run by a real `git push` over a real quarantine. It reuses
// buildHook/newBook/git/mustGit/writeSong/assertRefused from the refs behavior
// test (refs_test.go, same package). A plain `git push` introduces each case —
// no crafted pack is needed, because a disallowed blob is something a
// (misbehaving or malicious) client can commit and send normally.
//
// Pins workflow 14 §"What a book may hold" (docs/workflows/14-file-view.md:24–32)
// and §"What the service checks" L102–108: a push of only allowed songbook files
// is accepted; a push a new commit of which introduces a disallowed path, a
// non-regular mode, non-UTF-8 bytes, an oversize blob, or a wrong-bytes
// .gitattributes is refused whole, the fault named on git's channel. No Postgres
// (the hook has no DB); no axe (not UI).

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// appGitattributes is the exact songbook .gitattributes the app scaffolds
// (app/src/worker/books.js:33-35 GITATTRIBUTES_BYTES). The behavior test pushes
// these real bytes through the real hook, so the hook's own copy of them
// (internal/hook/contents.go expectedGitattributes) is checked end-to-end — the
// agreement the app and the service hold without sharing code (DIRECTION §3.6).
const appGitattributes = "*.cifra.md merge=cifra\n*.setlist.md merge=cifra\n"

// writeAt writes content (bytes) at a path under dir, creating parent folders.
func writeAt(t *testing.T, dir, name string, content []byte) {
	t.Helper()
	full := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatalf("mkdir for %s: %v", name, err)
	}
	if err := os.WriteFile(full, content, 0o644); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}

func TestPreReceiveContents(t *testing.T) {
	hooksDir := buildHook(t)

	t.Run("a push of only allowed songbook files is accepted", func(t *testing.T) {
		_, work := newBook(t, hooksDir, false)
		// Add, on top of the initial song, the full allowed set: the exact app
		// .gitattributes, a root README.md, a root song, and a setlist in a
		// nested folder — each a 100644 UTF-8 blob under the cap.
		writeAt(t, work, ".gitattributes", []byte(appGitattributes))
		writeAt(t, work, "README.md", []byte("# A Test Songbook\n"))
		writeAt(t, work, "raiz.cifra.md", []byte("# Na Raiz\n\n```\n[C] Uma linha\n```\n"))
		writeAt(t, work, "shows/abertura.setlist.md", []byte("# Abertura\n- raiz.cifra.md\n"))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Scaffold the songbook")
		if out, err := git(t, work, "push", "origin", "main"); err != nil {
			t.Fatalf("a push of only allowed files should be accepted: %v\n%s", err, out)
		}
	})

	t.Run("a disallowed path is refused", func(t *testing.T) {
		cases := []struct {
			name    string
			path    string
			content string
		}{
			{"a LICENSE", "LICENSE", "All rights reserved.\n"},
			{"a plain text file", "notes.txt", "a private note\n"},
			{"a README in a subfolder", "folder/README.md", "# Not the root readme\n"},
			{"a .gitattributes in a subfolder", "folder/.gitattributes", appGitattributes},
		}
		for _, c := range cases {
			t.Run(c.name, func(t *testing.T) {
				_, work := newBook(t, hooksDir, true)
				writeAt(t, work, c.path, []byte(c.content))
				mustGit(t, work, "add", ".")
				mustGit(t, work, "commit", "-m", "Add a disallowed file")
				out, err := git(t, work, "push", "origin", "main")
				assertRefused(t, out, err, c.path)
			})
		}
	})

	t.Run("a symlink is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		// A tracked symlink whose path would otherwise be allowed, so only the
		// mode rule (tree mode 120000) can refuse it.
		if err := os.Symlink("raiz.cifra.md", filepath.Join(work, "atalho.cifra.md")); err != nil {
			t.Fatalf("create symlink: %v", err)
		}
		mustGit(t, work, "add", "atalho.cifra.md")
		mustGit(t, work, "commit", "-m", "Add a symlink")
		out, err := git(t, work, "push", "origin", "main")
		assertRefused(t, out, err, "symlink")
	})

	t.Run("an executable file is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		// An allowed path and valid bytes, but committed with mode 100755, so
		// only the mode rule can refuse it.
		writeAt(t, work, "executavel.cifra.md", []byte("# Executavel\n\n```cifra\n[C]linha\n```\n"))
		mustGit(t, work, "add", "executavel.cifra.md")
		mustGit(t, work, "update-index", "--chmod=+x", "executavel.cifra.md")
		mustGit(t, work, "commit", "-m", "Add an executable song")
		out, err := git(t, work, "push", "origin", "main")
		assertRefused(t, out, err, "executable")
	})

	t.Run("a submodule (gitlink) is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		// A gitlink entry (tree mode 160000) pointing at a commit of the empty
		// tree. The commit is unreachable from the superproject tree, so git
		// never packs or sends it; the hook sees only the 160000 entry and
		// refuses on the mode. (The 160000 classifier is also unit-pinned.)
		empty := strings.TrimSpace(mustGit(t, work, "hash-object", "-w", "-t", "tree", "/dev/null"))
		sub := strings.TrimSpace(mustGit(t, work, "commit-tree", empty, "-m", "sub"))
		mustGit(t, work, "update-index", "--add", "--cacheinfo", "160000,"+sub+",subbook")
		mustGit(t, work, "commit", "-m", "Add a submodule")
		out, err := git(t, work, "push", "origin", "main")
		assertRefused(t, out, err, "submodule")
	})

	t.Run("a non-UTF-8 file is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		// An allowed path, 100644, under the cap, but its bytes are not valid
		// UTF-8 (0xC3 0x28 is an invalid continuation sequence) — purpose-written
		// filler, never copyrighted words.
		writeAt(t, work, "invalida.cifra.md", []byte{'#', ' ', 'X', '\n', 0xc3, 0x28, '\n'})
		mustGit(t, work, "add", "invalida.cifra.md")
		mustGit(t, work, "commit", "-m", "Add a non-UTF-8 file")
		out, err := git(t, work, "push", "origin", "main")
		assertRefused(t, out, err, "UTF-8")
	})

	t.Run("a file over 256 KB is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		// Valid UTF-8 at an allowed path, but padded past the 256 KB cap with
		// purpose-written filler (never copyrighted words).
		big := "# Grande\n\n```cifra\n" + strings.Repeat("[C]uma linha de enchimento\n", 12000) + "```\n"
		writeAt(t, work, "grande.cifra.md", []byte(big))
		mustGit(t, work, "add", "grande.cifra.md")
		mustGit(t, work, "commit", "-m", "Add an oversize file")
		out, err := git(t, work, "push", "origin", "main")
		assertRefused(t, out, err, "256 KB")
	})

	t.Run("the .gitattributes the app writes is accepted", func(t *testing.T) {
		_, work := newBook(t, hooksDir, false)
		writeAt(t, work, ".gitattributes", []byte(appGitattributes))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Add the songbook .gitattributes")
		if out, err := git(t, work, "push", "origin", "main"); err != nil {
			t.Fatalf("the app's exact .gitattributes bytes should be accepted: %v\n%s", err, out)
		}
	})

	t.Run("a byte-different .gitattributes is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, false)
		// The same push, but the .gitattributes bytes differ from the app's (an
		// extra, tampered line).
		writeAt(t, work, ".gitattributes", []byte(appGitattributes+"*.txt merge=binary\n"))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Add a tampered .gitattributes")
		out, err := git(t, work, "push", "origin", "main")
		assertRefused(t, out, err, ".gitattributes")
	})
}

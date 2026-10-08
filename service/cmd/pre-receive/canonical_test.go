package main

// Behavior test for the canonical-form layer (hook.canonical): the real
// pre-receive binary, installed in a real bare repository the way the service
// installs it, run by a real `git push` over a real quarantine. The built binary
// carries the real one-form registry (cifra.md for Go). It reuses
// buildHook/newBook/git/mustGit/gitEnv/writeSong/assertRefused from the refs
// behavior test (refs_test.go) and writeAt from the contents behavior test
// (contents_test.go), same package. A plain `git push` introduces each case — no
// crafted pack is needed.
//
// Pins workflow 14 §"Canonical form" (docs/workflows/14-file-view.md:51-53, 63,
// 64-65, 72, 102); DIRECTION §2.2 L95-97; spec §8.1, §9.1, §10.9, §11.12.3. A
// canonical song, setlist and text-rule-clean README are accepted; a
// non-canonical song or setlist, a file holding a conflict marker, and a README
// breaking a text rule are each refused whole, the fault and path named on git's
// channel. No Postgres (the hook has no DB); no axe (not UI). The single shipped
// form is the positive case here; the current-or-previous rule is pinned at the
// unit level with a synthetic second form (internal/hook/canonical_test.go).

import (
	"testing"

	cifra "github.com/ruoso/cifra.md/go"
)

// canonicalSong returns the canonical bytes of a purpose-written song, produced
// by the Go writer so the fixture is canonical by construction (the fixed point
// §9.1 checks) — never a hand-spelled guess, never copyrighted words.
func canonicalSong(t *testing.T, src string) []byte {
	t.Helper()
	model, err := cifra.Parse([]byte(src))
	if err != nil {
		t.Fatalf("parse song fixture: %v", err)
	}
	out, err := cifra.Write(model)
	if err != nil {
		t.Fatalf("write song fixture: %v", err)
	}
	if _, ok := cifra.FormOf(out); !ok {
		t.Fatalf("song fixture is not canonical after Write(Parse)")
	}
	return out
}

// canonicalSetlist is canonicalSong for a setlist (spec §10.9).
func canonicalSetlist(t *testing.T, src string) []byte {
	t.Helper()
	model, err := cifra.ParseSetlist([]byte(src))
	if err != nil {
		t.Fatalf("parse setlist fixture: %v", err)
	}
	out, err := cifra.WriteSetlist(model)
	if err != nil {
		t.Fatalf("write setlist fixture: %v", err)
	}
	if _, ok := cifra.SetlistFormOf(out); !ok {
		t.Fatalf("setlist fixture is not canonical after WriteSetlist(ParseSetlist)")
	}
	return out
}

func TestPreReceiveCanonical(t *testing.T) {
	hooksDir := buildHook(t)

	t.Run("a push of canonical songs, a setlist and a README is accepted", func(t *testing.T) {
		_, work := newBook(t, hooksDir, false)
		writeAt(t, work, "README.md", []byte("# A Test Songbook\n"))
		writeAt(t, work, "cancao.cifra.md", canonicalSong(t, "# Cancao\n\n## A\n```\nC | G7 | C | F\n```\n"))
		writeAt(t, work, "shows/abertura.setlist.md", canonicalSetlist(t, "# Abertura\n\n1. [Cancao](../cancao.cifra.md)\n"))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Scaffold a canonical songbook")
		if out, err := git(t, work, "push", "origin", "main"); err != nil {
			t.Fatalf("a push of canonical files should be accepted: %v\n%s", err, out)
		}
	})

	t.Run("a non-canonical song is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		// Parses fine, but is not canonical (a ### subsection the writer
		// normalises to ##, and irregular bar spacing) — purpose-written filler.
		writeAt(t, work, "nao-canonica.cifra.md", []byte("# Nao Canonica\n\n### A\n```\n  C  |  G7 | C |F\n```\n"))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Add a non-canonical song")
		out, err := git(t, work, "push", "origin", "main")
		assertRefused(t, out, err, "nao-canonica.cifra.md")
		assertRefused(t, out, err, "not in canonical form")
	})

	t.Run("a non-canonical setlist is refused", func(t *testing.T) {
		_, work := newBook(t, hooksDir, true)
		// Non-canonical numbering (5)/3./2), which the writer renumbers).
		writeAt(t, work, "desordenado.setlist.md", []byte("5) [Primeira](primeira.cifra.md)\n   3. [Segunda](segunda.cifra.md)\n2)    [Terceira](terceira.cifra.md)\n"))
		mustGit(t, work, "add", ".")
		mustGit(t, work, "commit", "-m", "Add a non-canonical setlist")
		out, err := git(t, work, "push", "origin", "main")
		assertRefused(t, out, err, "desordenado.setlist.md")
		assertRefused(t, out, err, "not in canonical form")
	})

	t.Run("a marked file is refused", func(t *testing.T) {
		cases := []struct {
			name    string
			path    string
			content string
		}{
			{"a marked song", "conflito.cifra.md", "# Conflito\n\n## A\n```\nC | G\n```\n<<<<<<< ours\n"},
			{"a marked setlist", "conflito.setlist.md", "# Conflito\n\n1. [A](a.cifra.md)\n<<<<<<< ours\n"},
		}
		for _, c := range cases {
			t.Run(c.name, func(t *testing.T) {
				_, work := newBook(t, hooksDir, true)
				writeAt(t, work, c.path, []byte(c.content))
				mustGit(t, work, "add", ".")
				mustGit(t, work, "commit", "-m", "Add a marked file")
				out, err := git(t, work, "push", "origin", "main")
				assertRefused(t, out, err, c.path)
				assertRefused(t, out, err, "conflict marker")
			})
		}
	})

	t.Run("README is held to the text rules", func(t *testing.T) {
		refused := []struct {
			name    string
			content []byte
			reason  string
		}{
			{"a tab", []byte("# Songbook\twith a tab\n"), "tab"},
			{"a byte-order mark", append([]byte(string(rune(0xFEFF))), "# Songbook\n"...), "byte-order mark"},
			{"a missing final newline", []byte("# Songbook"), "final newline"},
		}
		for _, c := range refused {
			t.Run(c.name, func(t *testing.T) {
				_, work := newBook(t, hooksDir, true)
				writeAt(t, work, "README.md", c.content)
				mustGit(t, work, "add", ".")
				mustGit(t, work, "commit", "-m", "Add a README breaking a text rule")
				out, err := git(t, work, "push", "origin", "main")
				assertRefused(t, out, err, "README.md")
				assertRefused(t, out, err, c.reason)
			})
		}

		t.Run("a clean README is accepted", func(t *testing.T) {
			_, work := newBook(t, hooksDir, true)
			writeAt(t, work, "README.md", []byte("# A Clean Songbook\n"))
			mustGit(t, work, "add", ".")
			mustGit(t, work, "commit", "-m", "Add a clean README")
			if out, err := git(t, work, "push", "origin", "main"); err != nil {
				t.Fatalf("a text-rule-clean README should be accepted: %v\n%s", err, out)
			}
		})
	})
}

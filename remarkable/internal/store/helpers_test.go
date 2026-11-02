package store

// Shared test helpers: every case runs on a t.TempDir() root, and "a restart"
// is the *Store dropped and Open called again on the same root.

import (
	"os"
	"path/filepath"
	"testing"
)

func openStore(t *testing.T, root string) *Store {
	t.Helper()
	s, err := Open(root)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return s
}

func newStore(t *testing.T) (*Store, string) {
	t.Helper()
	root := filepath.Join(t.TempDir(), "estante")
	return openStore(t, root), root
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", filepath.Base(path), err)
	}
	return string(raw)
}

func temporaries(t *testing.T, dir string) []string {
	t.Helper()
	matches, err := filepath.Glob(filepath.Join(dir, tmpPrefix+"*"))
	if err != nil {
		t.Fatal(err)
	}
	return matches
}

func intp(i int) *int { return &i }

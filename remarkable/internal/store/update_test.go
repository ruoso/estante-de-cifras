package store

// unit — the update record (reader.self_update constraint 11;
// docs/remarkable-reader.md §8): the refused bundles and the served hostApi
// survive a restart and a sign out, are kept at sixteen, and the file is
// root's alone.

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

// TestUpdateRecordSurvivesRestartAndSignOut pins constraint 11: the record is
// on disk, read again by a fresh Open, and kept by Sign out as the slots are.
func TestUpdateRecordSurvivesRestartAndSignOut(t *testing.T) {
	s, root := newStore(t)
	if got := s.Refused(); len(got) != 0 {
		t.Errorf("fresh store: refused %v, want none", got)
	}
	if err := s.RefuseBundle("aaaa"); err != nil {
		t.Fatal(err)
	}
	if err := s.RefuseBundle("aaaa"); err != nil { // twice is once
		t.Fatal(err)
	}

	s = openStore(t, root)
	if got := s.Refused(); !slices.Equal(got, []string{"aaaa"}) {
		t.Errorf("after a restart: refused %v, want [aaaa]", got)
	}

	if err := s.SignOut(); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if got := s.Refused(); !slices.Equal(got, []string{"aaaa"}) {
		t.Errorf("after sign out: refused %v, want [aaaa]", got)
	}
}

// TestRefusedKeptAtSixteen pins constraint 11: at most sixteen refused, the
// oldest dropped.
func TestRefusedKeptAtSixteen(t *testing.T) {
	s, root := newStore(t)
	for i := range 20 {
		if err := s.RefuseBundle(fmt.Sprintf("sha-%02d", i)); err != nil {
			t.Fatal(err)
		}
	}
	got := openStore(t, root).Refused()
	if len(got) != 16 || got[0] != "sha-04" || got[15] != "sha-19" {
		t.Errorf("refused %v, want sha-04 … sha-19", got)
	}
}

// TestUpdateRecordMode pins constraint 11: update.json is mode 0600, written
// atomically (no temporary left).
func TestUpdateRecordMode(t *testing.T) {
	s, root := newStore(t)
	if err := s.RefuseBundle("bbbb"); err != nil {
		t.Fatal(err)
	}
	fi, err := os.Stat(filepath.Join(root, bundleDir, updateFile))
	if err != nil {
		t.Fatal(err)
	}
	if mode := fi.Mode().Perm(); mode != 0o600 {
		t.Errorf("update.json mode %o, want 600", mode)
	}
	if tmp := temporaries(t, filepath.Join(root, bundleDir)); len(tmp) != 0 {
		t.Errorf("temporaries left: %v", tmp)
	}
}

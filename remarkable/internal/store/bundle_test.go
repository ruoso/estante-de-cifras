package store

// unit — the bundle slots: staged, promoted, rolled back, recovered after a
// crash, and opened by the engine (reader.store; docs/remarkable-reader.md §8).

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"estantedecifras.app/remarkable/internal/engine"
)

// marker is a one-file bundle whose content names it.
func marker(name string) map[string][]byte {
	return map[string][]byte{"which": []byte(name)}
}

func current(t *testing.T, s *Store) string {
	t.Helper()
	dir, ok := s.BundleDir()
	if !ok {
		t.Fatal("no current bundle")
	}
	return readFile(t, filepath.Join(dir, "which"))
}

func hasPrevious(s *Store) bool { return isDir(s.slot(slotPrevious)) }

// TestStagePromoteRollback pins design §8: the bundle switched on attach,
// kept beside the last good one, rolled back to it.
func TestStagePromoteRollback(t *testing.T) {
	s, root := newStore(t)
	if _, ok := s.BundleDir(); ok {
		t.Fatal("a fresh store has a bundle")
	}
	if err := s.PromoteBundle(); !errors.Is(err, ErrNoStaged) {
		t.Errorf("promote with nothing staged: %v, want ErrNoStaged", err)
	}
	if err := s.StageBundle(marker("A")); err != nil {
		t.Fatal(err)
	}
	if _, ok := s.BundleDir(); ok {
		t.Error("a staged bundle is current before promote")
	}
	if err := s.PromoteBundle(); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if got := current(t, s); got != "A" {
		t.Errorf("current %q, want A", got)
	}
	if hasPrevious(s) {
		t.Error("a previous after the first promote")
	}

	if err := s.StageBundle(marker("B")); err != nil {
		t.Fatal(err)
	}
	if err := s.PromoteBundle(); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if got := current(t, s); got != "B" {
		t.Errorf("current %q, want B", got)
	}
	if got := readFile(t, filepath.Join(s.slot(slotPrevious), "which")); got != "A" {
		t.Errorf("previous %q, want A", got)
	}
	if isDir(s.slot(slotNext)) {
		t.Error("next kept after promote")
	}

	if err := s.RollbackBundle(); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if got := current(t, s); got != "A" {
		t.Errorf("after rollback: current %q, want A", got)
	}
	if err := s.RollbackBundle(); !errors.Is(err, ErrNoPrevious) {
		t.Errorf("second rollback: %v, want ErrNoPrevious", err)
	}
	s = openStore(t, root)
	if got := current(t, s); got != "A" {
		t.Errorf("after a refused rollback: current %q, want A", got)
	}

	// A staged bundle can be dropped, the current kept.
	if err := s.StageBundle(marker("C")); err != nil {
		t.Fatal(err)
	}
	if err := s.DropStaged(); err != nil {
		t.Fatal(err)
	}
	if err := s.DropStaged(); err != nil {
		t.Errorf("DropStaged with nothing staged: %v", err)
	}
	if err := s.PromoteBundle(); !errors.Is(err, ErrNoStaged) {
		t.Errorf("promote after DropStaged: %v, want ErrNoStaged", err)
	}
	if got := current(t, s); got != "A" {
		t.Errorf("after DropStaged: current %q, want A", got)
	}
	if tmps := temporaries(t, filepath.Join(root, bundleDir)); len(tmps) != 0 {
		t.Errorf("temporaries left in bundle/: %v", tmps)
	}
}

const testSalt = "store-test-salt"

// host is a minimal estante (hostApi 1, a salt) — the store's own copy of
// internal/engine/engine_test.go's, as test helpers do not cross packages.
const host = `
globalThis.estante = {
  hostApi: 1,
  salt: "` + testSalt + `",
  load: function (entry, table) { return { fingerprint: null, tuningId: "", held: 0 }; },
  sheet: function (text, offset) {
    return { title: "T", artist: null, key: { written: null, named: null, status: null },
      offset: offset, transposed: offset !== 0, rows: [], shapes: [], unvoiced: [], notes: [], keyNote: null };
  },
  setlist: function () { return { title: null, items: [], missing: 0 }; },
  misses: function () { return []; },
  held: function () { return { songs: 0, shapes: 0, rebuilt: 0, misses: 0 }; },
};
`

// TestPromotedBundleOpensInEngine pins that a promoted slot is what
// engine.Open reads (Decision 7): a manifest and bundle staged and promoted
// open in the engine.
func TestPromotedBundleOpensInEngine(t *testing.T) {
	s, _ := newStore(t)
	sum := sha256.Sum256([]byte(host))
	hash := hex.EncodeToString(sum[:])
	name := "bundle." + hash[:8] + ".js"
	manifest, err := json.Marshal(map[string]any{
		"version": hash[:12],
		"hostApi": 1,
		"salt":    testSalt,
		"bundle":  map[string]any{"path": name, "sha256": hash},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.StageBundle(map[string][]byte{engine.ManifestFile: manifest, name: []byte(host)}); err != nil {
		t.Fatal(err)
	}
	if err := s.PromoteBundle(); err != nil {
		t.Fatal(err)
	}
	dir, ok := s.BundleDir()
	if !ok {
		t.Fatal("no current bundle after promote")
	}
	e, err := engine.Open(dir)
	if err != nil {
		t.Fatalf("engine.Open(BundleDir()): %v", err)
	}
	e.Close()
}

// TestOpenRecoversInterruptedPromote pins Decision 7: a crash between the
// renames of a promote leaves previous and no current, which Open restores; a
// half-written staging temporary is removed.
func TestOpenRecoversInterruptedPromote(t *testing.T) {
	s, root := newStore(t)
	if err := s.StageBundle(marker("A")); err != nil {
		t.Fatal(err)
	}
	if err := s.PromoteBundle(); err != nil {
		t.Fatal(err)
	}
	if err := s.StageBundle(marker("B")); err != nil {
		t.Fatal(err)
	}
	// The crash: current renamed to previous, next not yet renamed.
	if err := os.Rename(s.slot(slotCurrent), s.slot(slotPrevious)); err != nil {
		t.Fatal(err)
	}
	stage := filepath.Join(root, bundleDir, tmpPrefix+"stage-42")
	if err := os.MkdirAll(stage, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stage, "which"), []byte("hal"), 0o600); err != nil {
		t.Fatal(err)
	}

	s = openStore(t, root)
	if got := current(t, s); got != "A" {
		t.Errorf("recovered current %q, want A", got)
	}
	if hasPrevious(s) {
		t.Error("previous kept after it was restored")
	}
	if _, err := os.Stat(stage); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("staging temporary kept: %v", err)
	}
	// The staged bundle is still there to promote on the next attach.
	if err := s.PromoteBundle(); err != nil {
		t.Fatal(err)
	}
	if got := current(t, s); got != "B" {
		t.Errorf("current %q, want B", got)
	}
}

// TestStageRefusesNonLocalNames pins that a bundle file is named by a local
// path only.
func TestStageRefusesNonLocalNames(t *testing.T) {
	s, root := newStore(t)
	for _, name := range []string{"../x", "/abs", "", "a/../../x"} {
		err := s.StageBundle(map[string][]byte{"manifest.json": []byte("{}"), name: []byte("x")})
		if !errors.Is(err, ErrBadID) {
			t.Errorf("StageBundle(%q): %v, want ErrBadID", name, err)
		}
	}
	if isDir(s.slot(slotNext)) {
		t.Error("a refused bundle was staged")
	}
	if _, err := os.Stat(filepath.Join(root, "x")); !errors.Is(err, os.ErrNotExist) {
		t.Error("a refused name was written outside the slot")
	}
}

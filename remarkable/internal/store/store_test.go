package store

// unit — the root, its layout and its atomic writes (reader.store;
// docs/remarkable-reader.md §2.1 step 6, §3.2, §10).

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestTornWriteLeavesPreviousState pins the task's "a torn write leaves the
// previous state" (Decision 2, 11): a write failing mid-way, or at the
// rename, returns an error and leaves the previous files and no temporary; a
// temporary a crash left is ignored by reads and removed by Open.
func TestTornWriteLeavesPreviousState(t *testing.T) {
	s, root := newStore(t)
	if err := s.SetKey("b1", "song", intp(1)); err != nil {
		t.Fatal(err)
	}
	if err := s.SetSession(testSession); err != nil {
		t.Fatal(err)
	}
	stateBefore := readFile(t, filepath.Join(root, stateFile))
	sessionBefore := readFile(t, filepath.Join(root, sessionFile))

	savedWrite, savedRename := writeData, renameFile
	t.Cleanup(func() { writeData, renameFile = savedWrite, savedRename })
	failures := map[string]func(){
		"mid-write": func() {
			writeData = func(f *os.File, b []byte) (int, error) {
				n, _ := f.Write(b[:len(b)/2])
				return n, errors.New("injected: torn write")
			}
		},
		"rename": func() {
			renameFile = func(string, string) error { return errors.New("injected: rename failed") }
		},
	}
	for name, fail := range failures {
		writeData, renameFile = savedWrite, savedRename
		fail()
		changed := testSession
		changed.Account = "someone-else@example.com"
		if err := s.SetKey("b1", "song", intp(5)); err == nil {
			t.Errorf("%s: SetKey succeeded", name)
		}
		if err := s.SetSession(changed); err == nil {
			t.Errorf("%s: SetSession succeeded", name)
		}
		if got := readFile(t, filepath.Join(root, stateFile)); got != stateBefore {
			t.Errorf("%s: state.json changed", name)
		}
		if got := readFile(t, filepath.Join(root, sessionFile)); got != sessionBefore {
			t.Errorf("%s: session.json changed", name)
		}
		if tmps := temporaries(t, root); len(tmps) != 0 {
			t.Errorf("%s: temporaries left: %v", name, tmps)
		}
		if off, _ := s.Key("b1", "song"); off != 1 {
			t.Errorf("%s: in-memory key %d, want the previous 1", name, off)
		}
		if sess, _ := s.Session(); sess.Account != testSession.Account {
			t.Errorf("%s: in-memory session changed", name)
		}
	}
	writeData, renameFile = savedWrite, savedRename

	// A crash left a temporary: reads ignore it, Open removes it.
	stray := filepath.Join(root, tmpPrefix+"123456")
	if err := os.WriteFile(stray, []byte(`{"version":1,"keys":{"b1":{"song":9}}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	if off, _ := s.Key("b1", "song"); off != 1 {
		t.Errorf("after a crash: key %d, want the previous 1", off)
	}
	if _, err := os.Stat(stray); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("Open left the stray temporary: %v", err)
	}
	if ids, err := s.BookIDs(); err != nil || len(ids) != 0 {
		t.Errorf("BookIDs after a crash: %v %v", ids, err)
	}
}

// TestOpenMakesRootPrivate pins design §10: a fresh root and the directories
// the store makes under it are 0700.
func TestOpenMakesRootPrivate(t *testing.T) {
	s, root := newStore(t)
	if s.Root() != root {
		t.Errorf("Root %q, want %q", s.Root(), root)
	}
	if _, err := s.BookDir("b1"); err != nil {
		t.Fatal(err)
	}
	for _, d := range []string{"", homeDir, booksDir, bundleDir} {
		fi, err := os.Stat(filepath.Join(root, d))
		if err != nil {
			t.Fatalf("%q: %v", d, err)
		}
		if !fi.IsDir() || fi.Mode().Perm() != 0o700 {
			t.Errorf("%q: %v, want a 0700 directory", d, fi.Mode())
		}
	}
	if err := s.SetShapesShown(false); err != nil {
		t.Fatal(err)
	}
	if fi, err := os.Stat(filepath.Join(root, stateFile)); err != nil || fi.Mode().Perm() != 0o600 {
		t.Errorf("state.json: %v %v, want 0600", fi.Mode(), err)
	}
	if s.HomeDir() != filepath.Join(root, homeDir) {
		t.Errorf("HomeDir %q", s.HomeDir())
	}
}

// TestBookDirRefusesUnsafeIDs pins Decision 9: a bookId becomes a directory
// only when it is one local path element.
func TestBookDirRefusesUnsafeIDs(t *testing.T) {
	s, root := newStore(t)
	for _, id := range []string{"", ".", "..", "a/b", "../x", "/abs", `a\b`} {
		if _, err := s.BookDir(id); !errors.Is(err, ErrBadID) {
			t.Errorf("BookDir(%q): %v, want ErrBadID", id, err)
		}
		if err := s.RemoveBook(id); !errors.Is(err, ErrBadID) {
			t.Errorf("RemoveBook(%q): %v, want ErrBadID", id, err)
		}
	}
	dir, err := s.BookDir("bk_01HZ")
	if err != nil || dir != filepath.Join(root, booksDir, "bk_01HZ") {
		t.Errorf("BookDir(bk_01HZ): %q %v", dir, err)
	}
}

// TestBookIDsAndRemoveBook: the clones present are listed, and one removed.
func TestBookIDsAndRemoveBook(t *testing.T) {
	s, root := newStore(t)
	for _, id := range []string{"b2", "b1"} {
		dir, err := s.BookDir(id)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(filepath.Join(dir, ".git"), 0o700); err != nil {
			t.Fatal(err)
		}
	}
	// A stray file in books/ is not a clone.
	if err := os.WriteFile(filepath.Join(root, booksDir, "note"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	ids, err := s.BookIDs()
	if err != nil || len(ids) != 2 || ids[0] != "b1" || ids[1] != "b2" {
		t.Fatalf("BookIDs: %v %v, want [b1 b2]", ids, err)
	}
	if err := s.RemoveBook("b1"); err != nil {
		t.Fatal(err)
	}
	if err := s.RemoveBook("absent"); err != nil {
		t.Errorf("RemoveBook of an absent book: %v", err)
	}
	ids, err = openStore(t, root).BookIDs()
	if err != nil || len(ids) != 1 || ids[0] != "b2" {
		t.Errorf("after RemoveBook and a restart: %v %v, want [b2]", ids, err)
	}
}

// TestSignOutClearsTheDevice pins §2.1 step 6 and workflow 19 §The shelf Sign
// out: the session, the clones and the state go; the bundle slots stay.
func TestSignOutClearsTheDevice(t *testing.T) {
	s, root := newStore(t)
	if err := s.SetSession(testSession); err != nil {
		t.Fatal(err)
	}
	if err := s.SetKey("b1", "song", intp(2)); err != nil {
		t.Fatal(err)
	}
	if err := s.Hide(Voicing{TuningID: "t", Chord: "C", Frets: "x32010"}); err != nil {
		t.Fatal(err)
	}
	if err := s.SetShapesShown(false); err != nil {
		t.Fatal(err)
	}
	if err := s.SetLastSync(time.Date(2026, 11, 1, 9, 10, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(s.HomeDir(), "song.cifra.md"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	dir, _ := s.BookDir("b1")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := s.StageBundle(map[string][]byte{"manifest.json": []byte("{}")}); err != nil {
		t.Fatal(err)
	}
	if err := s.PromoteBundle(); err != nil {
		t.Fatal(err)
	}

	if err := s.SignOut(); err != nil {
		t.Fatal(err)
	}
	check := func(when string, s *Store) {
		if _, ok := s.Session(); ok {
			t.Errorf("%s: still paired", when)
		}
		if _, ok := s.Key("b1", "song"); ok || !s.ShapesShown() || s.HiddenCount() != 0 {
			t.Errorf("%s: state kept", when)
		}
		if _, ok := s.LastSync(); ok {
			t.Errorf("%s: last sync kept (reader.sync)", when)
		}
		for _, f := range []string{sessionFile, stateFile} {
			if _, err := os.Stat(filepath.Join(root, f)); !errors.Is(err, os.ErrNotExist) {
				t.Errorf("%s: %s kept: %v", when, f, err)
			}
		}
		if entries, _ := os.ReadDir(s.HomeDir()); len(entries) != 0 {
			t.Errorf("%s: home/ kept %d entries", when, len(entries))
		}
		if ids, _ := s.BookIDs(); len(ids) != 0 {
			t.Errorf("%s: books kept: %v", when, ids)
		}
		if d, ok := s.BundleDir(); !ok {
			t.Errorf("%s: bundle dropped", when)
		} else if _, err := os.Stat(filepath.Join(d, "manifest.json")); err != nil {
			t.Errorf("%s: bundle manifest dropped: %v", when, err)
		}
	}
	check("after SignOut", s)
	check("after a restart", openStore(t, root))
}

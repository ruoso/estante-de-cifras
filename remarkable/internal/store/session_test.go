package store

// unit — the session the device syncs with (reader.store;
// docs/remarkable-reader.md §5.1, §10).

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

var testSession = Session{
	Origin:   "https://estante.example",
	Token:    "secret-session-token-0123456789",
	Account:  "ana@example.com",
	PairedAt: time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC),
}

// TestSessionFileMode pins design §10: session.json is 0600, also when the
// file was widened by hand before the write.
func TestSessionFileMode(t *testing.T) {
	s, root := newStore(t)
	path := filepath.Join(root, sessionFile)
	if err := s.SetSession(testSession); err != nil {
		t.Fatal(err)
	}
	if fi, err := os.Stat(path); err != nil || fi.Mode().Perm() != 0o600 {
		t.Fatalf("mode after SetSession: %v %v, want 0600", fi.Mode().Perm(), err)
	}
	if err := os.Chmod(path, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := s.SetSession(testSession); err != nil {
		t.Fatal(err)
	}
	if fi, err := os.Stat(path); err != nil || fi.Mode().Perm() != 0o600 {
		t.Errorf("mode after a second SetSession: %v %v, want 0600", fi.Mode().Perm(), err)
	}
	if fi, err := os.Stat(filepath.Join(root, stateFile)); err == nil {
		t.Errorf("state.json written by SetSession (%v)", fi.Mode())
	}
}

// TestSessionRoundTripsAcrossRestart: set, restart, read; clear, restart, not
// paired.
func TestSessionRoundTripsAcrossRestart(t *testing.T) {
	s, root := newStore(t)
	if _, ok := s.Session(); ok {
		t.Fatal("a fresh store is paired")
	}
	if err := s.SetSession(testSession); err != nil {
		t.Fatal(err)
	}
	s = openStore(t, root)
	got, ok := s.Session()
	if !ok || got.Origin != testSession.Origin || got.Token != testSession.Token ||
		got.Account != testSession.Account || !got.PairedAt.Equal(testSession.PairedAt) {
		t.Errorf("after restart: %v %v", ok, got.Account)
	}
	if err := s.ClearSession(); err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Session(); ok {
		t.Error("paired after ClearSession")
	}
	s = openStore(t, root)
	if _, ok := s.Session(); ok {
		t.Error("paired after ClearSession and a restart")
	}
	if err := s.ClearSession(); err != nil {
		t.Errorf("ClearSession when not paired: %v", err)
	}
}

// TestUnreadableSessionIsNotPaired pins Decision 8: a garbage, future-version
// or versionless session.json reads as not paired.
func TestUnreadableSessionIsNotPaired(t *testing.T) {
	for name, content := range map[string]string{
		"garbage":     "\x00\x01not json",
		"version 2":   `{"version":2,"origin":"o","token":"t","account":"a"}`,
		"no version":  `{"origin":"o","token":"t","account":"a"}`,
		"wrong shape": `[1,2,3]`,
	} {
		t.Run(name, func(t *testing.T) {
			root := filepath.Join(t.TempDir(), "estante")
			if err := os.MkdirAll(root, 0o700); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(root, sessionFile), []byte(content), 0o600); err != nil {
				t.Fatal(err)
			}
			if _, ok := openStore(t, root).Session(); ok {
				t.Error("paired from an unreadable session file")
			}
		})
	}
}

// TestStoreErrorsCarryNoToken pins design §10 and the standing rule: a failing
// SetSession returns an error that names the role, never the token.
func TestStoreErrorsCarryNoToken(t *testing.T) {
	s, root := newStore(t)
	if os.Geteuid() == 0 {
		// root writes through a read-only directory; fail the write instead.
		saved := writeData
		t.Cleanup(func() { writeData = saved })
		writeData = func(*os.File, []byte) (int, error) { return 0, errors.New("disk full") }
	} else {
		if err := os.Chmod(root, 0o500); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { os.Chmod(root, 0o700) })
	}
	err := s.SetSession(testSession)
	if err == nil {
		t.Fatal("SetSession succeeded on a read-only root")
	}
	if strings.Contains(err.Error(), testSession.Token) {
		t.Errorf("error carries the token: %v", err)
	}
	if !strings.Contains(err.Error(), "session") {
		t.Errorf("error does not name the session: %v", err)
	}
	if _, ok := s.Session(); ok {
		t.Error("paired after a failed SetSession")
	}
}

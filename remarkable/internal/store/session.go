package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"
)

// Session is the session the device syncs with, from pairing (§5.1): the
// account's, read-only by scope, revocable. Kept 0600 (§10).
type Session struct {
	// Origin is the service the device paired with.
	Origin string
	// Token is the session cookie's value, opaque. Never in an error or log.
	Token string
	// Account is what Settings names.
	Account  string
	PairedAt time.Time
}

// sessionVersion is the one version of session.json this reader writes and reads.
const sessionVersion = 1

type sessionJSON struct {
	Version  int       `json:"version"`
	Origin   string    `json:"origin"`
	Token    string    `json:"token"`
	Account  string    `json:"account"`
	PairedAt time.Time `json:"pairedAt"`
}

// readSession reads path; anything unreadable, or of another version, is not
// paired (Decision 8).
func readSession(path string) *Session {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var j sessionJSON
	if json.Unmarshal(raw, &j) != nil || j.Version != sessionVersion {
		return nil
	}
	return &Session{Origin: j.Origin, Token: j.Token, Account: j.Account, PairedAt: j.PairedAt}
}

// Session is the device's session, false when it is not paired.
func (s *Store) Session() (Session, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.session == nil {
		return Session{}, false
	}
	return *s.session, true
}

// SetSession keeps the session, written 0600 and atomically.
func (s *Store) SetSession(sess Session) error {
	raw, err := json.Marshal(sessionJSON{
		Version: sessionVersion, Origin: sess.Origin, Token: sess.Token,
		Account: sess.Account, PairedAt: sess.PairedAt,
	})
	if err != nil {
		return fmt.Errorf("store: encode session: %w", err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := writeAtomic(s.root, sessionFile, raw, fileMode, "session"); err != nil {
		return err
	}
	s.session = &sess
	return nil
}

// ClearSession forgets the session; not paired is not an error.
func (s *Store) ClearSession() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.Remove(filepath.Join(s.root, sessionFile)); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("store: clear session: %w", err)
	}
	s.session = nil
	if err := syncDir(s.root); err != nil {
		return fmt.Errorf("store: clear session: %w", err)
	}
	return nil
}

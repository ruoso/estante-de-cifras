package store

// The update record and the QML's previous slot (reader.self_update;
// docs/remarkable-reader.md §8): what the self-update remembers between
// passes and restarts. Both sit beside the bundle slots and, like them, are
// the app's code and not the account's, so Sign out keeps them.

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
)

const (
	// updateFile is bundle/update.json: {servedHostApi, refused}.
	updateFile = "update.json"
	// qmlDir/qmlPrevSub is where the QML a placement replaced is kept.
	qmlDir     = "qml"
	qmlPrevSub = "previous"
	qmlFile    = "resources.rcc"
	// maxRefused is how many refused bundles are remembered, the oldest
	// dropped first.
	maxRefused = 16
)

// updateRecord is bundle/update.json.
type updateRecord struct {
	ServedHostAPI int      `json:"servedHostApi"`
	Refused       []string `json:"refused"`
}

// readUpdate reads the record; absent or unreadable reads as empty.
func (s *Store) readUpdate() updateRecord {
	var r updateRecord
	raw, err := os.ReadFile(filepath.Join(s.root, bundleDir, updateFile))
	if err != nil || json.Unmarshal(raw, &r) != nil {
		return updateRecord{}
	}
	return r
}

func (s *Store) writeUpdate(r updateRecord) error {
	if r.Refused == nil {
		r.Refused = []string{}
	}
	raw, err := json.Marshal(r)
	if err != nil {
		return fmt.Errorf("store: write update: %w", err)
	}
	return writeAtomic(filepath.Join(s.root, bundleDir), updateFile, raw, fileMode, "update")
}

// RefuseBundle remembers a bundle's SHA-256 as one that did not open, so no
// later check fetches it again. At most 16 are kept, the oldest dropped.
func (s *Store) RefuseBundle(sha string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	r := s.readUpdate()
	if slices.Contains(r.Refused, sha) {
		return nil
	}
	r.Refused = append(r.Refused, sha)
	if n := len(r.Refused); n > maxRefused {
		r.Refused = slices.Clone(r.Refused[n-maxRefused:])
	}
	return s.writeUpdate(r)
}

// Refused is the bundles refused so far, oldest first.
func (s *Store) Refused() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.readUpdate().Refused
}

// SetServedHostAPI remembers the hostApi the site last served; no write when
// it is the one remembered.
func (s *Store) SetServedHostAPI(api int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	r := s.readUpdate()
	if r.ServedHostAPI == api {
		if _, err := os.Stat(filepath.Join(s.root, bundleDir, updateFile)); err == nil {
			return nil
		}
	}
	r.ServedHostAPI = api
	return s.writeUpdate(r)
}

// ServedHostAPI is the hostApi the site last served (0 before any).
func (s *Store) ServedHostAPI() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.readUpdate().ServedHostAPI
}

// StagedBundleDir is the staged bundle's directory; false when none is staged.
func (s *Store) StagedBundleDir() (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	dir := s.slot(slotNext)
	return dir, isDir(dir)
}

// PreviousQML is the path the QML a placement replaced is kept at
// (qml/previous/resources.rcc), present or not.
func (s *Store) PreviousQML() string {
	return filepath.Join(s.root, qmlDir, qmlPrevSub, qmlFile)
}

// KeepPreviousQML keeps data as qml/previous/resources.rcc, replacing what
// was kept.
func (s *Store) KeepPreviousQML(data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	dir := filepath.Dir(s.PreviousQML())
	if err := os.MkdirAll(dir, dirMode); err != nil {
		return fmt.Errorf("store: keep previous qml: %w", err)
	}
	return writeAtomic(dir, qmlFile, data, fileMode, "previous qml")
}

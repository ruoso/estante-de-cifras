package store

// The update record (reader.self_update; docs/remarkable-reader.md §8): the
// bundles refused — a bundle that would not open, or that the instrument
// would not load in — so none is staged again. It sits beside the bundle
// slots and, like them, is the app's code and not the account's, so Sign out
// keeps it.

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
)

const (
	// updateFile is bundle/update.json: {refused}.
	updateFile = "update.json"
	// maxRefused is how many refused bundles are remembered, the oldest
	// dropped first.
	maxRefused = 16
)

// updateRecord is bundle/update.json.
type updateRecord struct {
	Refused []string `json:"refused"`
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

// StagedBundleDir is the staged bundle's directory; false when none is staged.
func (s *Store) StagedBundleDir() (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	dir := s.slot(slotNext)
	return dir, isDir(dir)
}

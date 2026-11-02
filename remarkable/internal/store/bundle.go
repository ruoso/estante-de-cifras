package store

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

// The bundle slots under bundle/ (§8): each a directory engine.Open reads.
const (
	slotCurrent  = "current"
	slotPrevious = "previous"
	slotNext     = "next"
)

func (s *Store) slot(name string) string { return filepath.Join(s.root, bundleDir, name) }

func isDir(path string) bool {
	fi, err := os.Stat(path)
	return err == nil && fi.IsDir()
}

// BundleDir is the current bundle's directory, for engine.Open; false when no
// bundle is installed.
func (s *Store) BundleDir() (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	dir := s.slot(slotCurrent)
	return dir, isDir(dir)
}

// StageBundle writes files (named by local paths) into bundle/next/, by way of
// a temporary directory renamed into place, replacing what was staged. It
// checks no hash and evaluates nothing (Decision 7).
func (s *Store) StageBundle(files map[string][]byte) (err error) {
	for name := range files {
		if name == "" || !filepath.IsLocal(name) {
			return fmt.Errorf("store: stage bundle: %w", ErrBadID)
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	parent := filepath.Join(s.root, bundleDir)
	tmp, err := os.MkdirTemp(parent, tmpPrefix+"stage-*")
	if err != nil {
		return fmt.Errorf("store: stage bundle: %w", err)
	}
	defer func() {
		if err != nil {
			os.RemoveAll(tmp)
		}
	}()
	if err := os.Chmod(tmp, dirMode); err != nil {
		return fmt.Errorf("store: stage bundle: %w", err)
	}
	for name, data := range files {
		dir := filepath.Join(tmp, filepath.Dir(name))
		if err := os.MkdirAll(dir, dirMode); err != nil {
			return fmt.Errorf("store: stage bundle: %w", err)
		}
		if err := writeAtomic(dir, filepath.Base(name), data, fileMode, "bundle"); err != nil {
			return err
		}
	}
	if err := s.discard(slotNext); err != nil {
		return fmt.Errorf("store: stage bundle: %w", err)
	}
	if err := renameFile(tmp, s.slot(slotNext)); err != nil {
		return fmt.Errorf("store: stage bundle: %w", err)
	}
	if err := syncDir(parent); err != nil {
		return fmt.Errorf("store: stage bundle: %w", err)
	}
	return nil
}

// PromoteBundle switches to the staged bundle: current → previous (replacing
// the older previous), next → current.
func (s *Store) PromoteBundle() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !isDir(s.slot(slotNext)) {
		return fmt.Errorf("store: promote bundle: %w", ErrNoStaged)
	}
	if isDir(s.slot(slotCurrent)) {
		if err := s.discard(slotPrevious); err != nil {
			return fmt.Errorf("store: promote bundle: %w", err)
		}
		// A crash between these two renames leaves previous and no current,
		// which Open restores.
		if err := renameFile(s.slot(slotCurrent), s.slot(slotPrevious)); err != nil {
			return fmt.Errorf("store: promote bundle: %w", err)
		}
	}
	if err := renameFile(s.slot(slotNext), s.slot(slotCurrent)); err != nil {
		return fmt.Errorf("store: promote bundle: %w", err)
	}
	if err := syncDir(filepath.Join(s.root, bundleDir)); err != nil {
		return fmt.Errorf("store: promote bundle: %w", err)
	}
	return nil
}

// RollbackBundle drops the current bundle and restores the last good one;
// ErrNoPrevious when there is none.
func (s *Store) RollbackBundle() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !isDir(s.slot(slotPrevious)) {
		return fmt.Errorf("store: rollback bundle: %w", ErrNoPrevious)
	}
	if err := s.discard(slotCurrent); err != nil {
		return fmt.Errorf("store: rollback bundle: %w", err)
	}
	if err := renameFile(s.slot(slotPrevious), s.slot(slotCurrent)); err != nil {
		return fmt.Errorf("store: rollback bundle: %w", err)
	}
	if err := syncDir(filepath.Join(s.root, bundleDir)); err != nil {
		return fmt.Errorf("store: rollback bundle: %w", err)
	}
	return nil
}

// DropStaged removes the staged bundle; none staged is not an error.
func (s *Store) DropStaged() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.discard(slotNext); err != nil {
		return fmt.Errorf("store: drop staged bundle: %w", err)
	}
	return nil
}

// discard removes a slot by first renaming it to a temporary, so the slot is
// gone in one step and a crash mid-removal leaves only a .tmp-* Open removes.
func (s *Store) discard(slot string) error {
	dir := s.slot(slot)
	if _, err := os.Lstat(dir); errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	parent := filepath.Join(s.root, bundleDir)
	tmp, err := os.MkdirTemp(parent, tmpPrefix+"drop-*")
	if err != nil {
		return err
	}
	gone := filepath.Join(tmp, slot)
	if err := renameFile(dir, gone); err != nil {
		os.RemoveAll(tmp)
		return err
	}
	return os.RemoveAll(tmp)
}

// recoverBundle repairs what a crash can leave in bundle/: temporaries are
// removed, and with no current but a previous, the previous is restored — the
// gap between the renames of a promote or a rollback.
func (s *Store) recoverBundle() error {
	parent := filepath.Join(s.root, bundleDir)
	if err := removeTemporaries(parent); err != nil {
		return fmt.Errorf("store: recover bundle: %w", err)
	}
	if !isDir(s.slot(slotCurrent)) && isDir(s.slot(slotPrevious)) {
		if err := os.Rename(s.slot(slotPrevious), s.slot(slotCurrent)); err != nil {
			return fmt.Errorf("store: recover bundle: %w", err)
		}
		if err := syncDir(parent); err != nil {
			return fmt.Errorf("store: recover bundle: %w", err)
		}
	}
	return nil
}

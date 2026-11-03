package update

// The AppLoad folder carries the music code it was built with (design §8):
// bundle/, the app's device bundle — its manifest.json and the bundle that
// names. At backend start the folder's bundle is staged in the store when it
// is not the one read with, so the switch on the next attach, and its
// rollback, are the self-update's own; a store with no bundle at all takes it
// at once. A bundle the store refused is not staged again.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/store"
)

// FolderBundle is the folder's bundle directory, under the AppLoad folder.
const FolderBundle = "bundle"

// AdoptFolderBundle stages the bundle in app's bundle/ when it differs from
// the store's current and staged ones and was not refused, and promotes it
// when the store has none current. It answers whether it staged one. A
// folder with no bundle, or one that does not read, stages nothing.
func AdoptFolderBundle(st *store.Store, app string) (bool, error) {
	if app == "" {
		return false, nil
	}
	dir := filepath.Join(app, FolderBundle)
	raw, err := os.ReadFile(filepath.Join(dir, engine.ManifestFile))
	if err != nil {
		return false, nil
	}
	var m engine.Manifest
	if json.Unmarshal(raw, &m) != nil || !localBundle(m.Bundle.Path) {
		return false, nil
	}
	code, err := os.ReadFile(filepath.Join(dir, m.Bundle.Path))
	if err != nil {
		return false, nil
	}
	sum := sha256.Sum256(code)
	sha := hex.EncodeToString(sum[:])
	if sha != m.Bundle.SHA256 {
		return false, fmt.Errorf("update: folder bundle: checksum: %w", ErrChecksum)
	}
	if current, ok := st.BundleDir(); ok && BundleSHA(current) == sha {
		return false, nil
	}
	if staged, ok := st.StagedBundleDir(); ok && BundleSHA(staged) == sha {
		return false, nil
	}
	if slices.Contains(st.Refused(), sha) {
		return false, nil
	}
	if err := st.StageBundle(map[string][]byte{engine.ManifestFile: raw, m.Bundle.Path: code}); err != nil {
		return false, fmt.Errorf("update: folder bundle: %w", err)
	}
	if _, ok := st.BundleDir(); !ok {
		if err := st.PromoteBundle(); err != nil {
			return true, fmt.Errorf("update: folder bundle: promote: %w", err)
		}
	}
	return true, nil
}

// localBundle reports whether name is a bundle's file name, bundle.<hash>.js,
// with no directory in it.
func localBundle(name string) bool {
	return name != "" && filepath.Base(name) == name &&
		strings.HasPrefix(name, "bundle.") && strings.HasSuffix(name, ".js")
}

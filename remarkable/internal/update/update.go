// Package update is the reader's self-update (docs/remarkable-reader.md §8,
// §10). Everything the reader runs — the backend, the screens' QML, the music
// code — is one AppLoad folder, built and published as a GitHub release of
// this repository (.github/workflows/reader-release.yml), never by the site.
// At the end of a sync pass the backend reads the latest release's
// manifest.json from github.com/ruoso/estante-de-cifras only; a release
// newer than its own is fetched — its folder for this architecture, checked
// against the manifest's SHA-256 — unpacked and staged beside the folder.
// The backend swaps it in once no frontend is attached, keeping the folder
// it replaced, and exits: the next launch runs the new screens, music code
// and backend together. The QML runs inside xochitl as root, unsandboxed, so
// the site — which only pairs and syncs — can never choose it.
//
// The package logs nothing; its errors name the step ("update: folder:
// checksum"), never a payload's bytes.
package update

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"debug/elf"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/store"
)

// ReleasesURL is where the latest release's files are (GitHub's
// releases/latest/download redirects to the latest release's assets).
const ReleasesURL = "https://github.com/ruoso/estante-de-cifras/releases/latest/download"

// The refusals, for errors.Is.
var (
	// ErrManifest: the manifest is not JSON, or names no folder for this
	// architecture, or a folder by a path that is not a local name.
	ErrManifest = errors.New("manifest refused")
	// ErrChecksum: a body whose SHA-256 is not the manifest's.
	ErrChecksum = errors.New("checksum")
	// ErrTooLarge: a body over its limit.
	ErrTooLarge = errors.New("too large")
	// ErrStatus: an answer other than 200.
	ErrStatus = errors.New("not 200")
	// ErrFolder: an archive that is not an Estante AppLoad folder for this
	// architecture.
	ErrFolder = errors.New("not the reader's folder")
)

// appID is the AppLoad folder's id (tools/appfolder).
const appID = "estante"

// The names beside the AppLoad folder, in AppLoad's exthome: the release
// staged, and the folder a swap replaced (install.sh's previous install).
const (
	nextDir     = "estante.next"
	previousDir = "estante.previous"
	// releaseFile, in a staged folder, names its release.
	releaseFile = ".release"
)

// File is a file the manifest names: its name and its SHA-256.
type File struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

// Manifest is what the update reads of a release's manifest.json (tools/
// payload writes it): the release's number, and each architecture's folder.
type Manifest struct {
	Release int             `json:"release"`
	Version string          `json:"version"`
	HostAPI int             `json:"hostApi"`
	Folder  map[string]File `json:"folder"`
}

// Updater checks the releases for one AppLoad folder.
type Updater struct {
	// Store is the reader's store (unused by the release itself; kept so a
	// pass's caller hands one value).
	Store *store.Store
	// AppDir is the AppLoad folder ("" when none is known: nothing is
	// fetched). It is replaced only when its manifest.json has id estante.
	AppDir string
	// Release is this backend's release number (0 for none: every release
	// is newer).
	Release int
	// Arch is the folder's architecture, "armv7" or "arm64".
	Arch string
	// URL is where the latest release's files are (ReleasesURL when "").
	URL string
}

// Result is what a check did: the release it staged (0 for none).
type Result struct {
	Staged int
}

// The limits a body is read through; vars so a test can lower them.
var (
	maxManifest int64 = 64 << 10
	maxFolder   int64 = 64 << 20
	maxFile     int64 = 48 << 20
)

func (u *Updater) url() string {
	if u.URL != "" {
		return strings.TrimRight(u.URL, "/")
	}
	return ReleasesURL
}

// exthome is the directory the AppLoad folder's directory is in (AppLoad's
// exthome/appload/estante → exthome), where the staged and previous folders
// sit, outside AppLoad's list.
func (u *Updater) exthome() string {
	return filepath.Dir(filepath.Dir(u.AppDir))
}

// Check reads the latest release's manifest with client and, when it is
// newer than this backend's and not staged already, fetches, checks and
// stages its folder. origin is the session's, unused: releases are fetched
// from github.com only, without the session.
func (u *Updater) Check(ctx context.Context, client *http.Client, origin any) (Result, error) {
	if !u.ourFolder() {
		return Result{}, nil
	}
	c := releaseClient(client)
	raw, err := get(ctx, c, u.url()+"/manifest.json", "manifest", maxManifest)
	if err != nil {
		return Result{}, err
	}
	var m Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return Result{}, fmt.Errorf("update: manifest: not JSON: %w", ErrManifest)
	}
	if m.Release <= u.Release || m.Release <= u.StagedRelease() {
		return Result{}, nil
	}
	f, ok := m.Folder[u.Arch]
	if !ok || !localName(f.Path) || len(f.SHA256) != 64 {
		return Result{}, fmt.Errorf("update: manifest: no folder for %s: %w", u.Arch, ErrManifest)
	}
	body, err := get(ctx, c, u.url()+"/"+f.Path, "folder", maxFolder)
	if err != nil {
		return Result{}, err
	}
	if hexSum(body) != f.SHA256 {
		return Result{}, fmt.Errorf("update: folder: %w", ErrChecksum)
	}
	if err := u.stage(body, m.Release); err != nil {
		return Result{}, err
	}
	return Result{Staged: m.Release}, nil
}

// ourFolder reports whether AppDir is Estante's AppLoad folder (its
// manifest.json has id estante).
func (u *Updater) ourFolder() bool {
	if u.AppDir == "" {
		return false
	}
	return folderID(u.AppDir) == appID
}

func folderID(dir string) string {
	raw, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		return ""
	}
	var m struct {
		ID string `json:"id"`
	}
	if json.Unmarshal(raw, &m) != nil {
		return ""
	}
	return m.ID
}

// StagedRelease is the release staged beside the folder, 0 for none.
func (u *Updater) StagedRelease() int {
	if u.AppDir == "" {
		return 0
	}
	raw, err := os.ReadFile(filepath.Join(u.exthome(), nextDir, releaseFile))
	if err != nil {
		return 0
	}
	n, err := strconv.Atoi(strings.TrimSpace(string(raw)))
	if err != nil {
		return 0
	}
	return n
}

// Ready reports whether a release is staged, waiting for Swap.
func (u *Updater) Ready() bool { return u.StagedRelease() > u.Release }

// stage unpacks the folder archive into exthome/estante.next by way of a
// temporary directory renamed into place, checked to be Estante's folder for
// this architecture, its release written beside it.
func (u *Updater) stage(archive []byte, release int) (err error) {
	home := u.exthome()
	tmp, err := os.MkdirTemp(home, ".estante-next-")
	if err != nil {
		return fmt.Errorf("update: stage: %w", err)
	}
	defer func() {
		if err != nil {
			os.RemoveAll(tmp)
		}
	}()
	if err := os.Chmod(tmp, 0o755); err != nil {
		return fmt.Errorf("update: stage: %w", err)
	}
	if err := unpack(archive, tmp); err != nil {
		return err
	}
	folder := filepath.Join(tmp, appID)
	if err := u.checkFolder(folder); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(folder, releaseFile), []byte(strconv.Itoa(release)+"\n"), 0o644); err != nil {
		return fmt.Errorf("update: stage: %w", err)
	}
	next := filepath.Join(home, nextDir)
	if err := os.RemoveAll(next); err != nil {
		return fmt.Errorf("update: stage: %w", err)
	}
	if err := os.Rename(folder, next); err != nil {
		return fmt.Errorf("update: stage: %w", err)
	}
	os.RemoveAll(tmp)
	return syncDir(home)
}

// checkFolder refuses a folder that is not Estante's for this architecture:
// its manifest.json's id, an executable backend/entry for the machine, its
// resources.rcc and its bundle.
func (u *Updater) checkFolder(dir string) error {
	if folderID(dir) != appID {
		return fmt.Errorf("update: folder: manifest: %w", ErrFolder)
	}
	for _, name := range []string{"resources.rcc", filepath.Join(FolderBundle, engine.ManifestFile)} {
		if fi, err := os.Stat(filepath.Join(dir, name)); err != nil || !fi.Mode().IsRegular() {
			return fmt.Errorf("update: folder: %s: %w", filepath.ToSlash(name), ErrFolder)
		}
	}
	entry := filepath.Join(dir, "backend", "entry")
	fi, err := os.Stat(entry)
	if err != nil || fi.Mode().Perm()&0o111 == 0 {
		return fmt.Errorf("update: folder: backend/entry: %w", ErrFolder)
	}
	f, err := elf.Open(entry)
	if err != nil {
		return fmt.Errorf("update: folder: backend/entry not ELF: %w", ErrFolder)
	}
	defer f.Close()
	want := map[string]elf.Machine{"armv7": elf.EM_ARM, "arm64": elf.EM_AARCH64}[u.Arch]
	if f.Machine != want {
		return fmt.Errorf("update: folder: backend/entry for another machine: %w", ErrFolder)
	}
	return nil
}

// Swap puts the staged release in the folder's place, the folder it replaces
// kept as estante.previous (the one before that removed). The backend
// running keeps its open binary; the next launch runs the new one.
func (u *Updater) Swap() error {
	if !u.Ready() {
		return nil
	}
	home := u.exthome()
	next, previous := filepath.Join(home, nextDir), filepath.Join(home, previousDir)
	if err := os.Remove(filepath.Join(next, releaseFile)); err != nil {
		return fmt.Errorf("update: swap: %w", err)
	}
	if err := os.RemoveAll(previous); err != nil {
		return fmt.Errorf("update: swap: %w", err)
	}
	if err := os.Rename(u.AppDir, previous); err != nil {
		return fmt.Errorf("update: swap: %w", err)
	}
	if err := os.Rename(next, u.AppDir); err != nil {
		// Put the folder back rather than leave AppLoad none.
		_ = os.Rename(previous, u.AppDir)
		return fmt.Errorf("update: swap: %w", err)
	}
	if err := syncDir(home); err != nil {
		return fmt.Errorf("update: swap: %w", err)
	}
	return syncDir(filepath.Dir(u.AppDir))
}

// unpack writes the .tar.gz archive under dir: directories and regular files
// only, every path under estante/, none escaping it; backend/entry 0755, the
// rest 0644; the whole read through maxFile per file.
func unpack(archive []byte, dir string) error {
	gz, err := gzip.NewReader(bytes.NewReader(archive))
	if err != nil {
		return fmt.Errorf("update: folder: not gzip: %w", ErrFolder)
	}
	tr := tar.NewReader(gz)
	for {
		h, err := tr.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("update: folder: not tar: %w", ErrFolder)
		}
		name := path.Clean(strings.TrimSuffix(h.Name, "/"))
		if name != appID && !strings.HasPrefix(name, appID+"/") || !filepath.IsLocal(filepath.FromSlash(name)) {
			return fmt.Errorf("update: folder: entry outside estante/: %w", ErrFolder)
		}
		target := filepath.Join(dir, filepath.FromSlash(name))
		switch h.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o755); err != nil {
				return fmt.Errorf("update: folder: %w", err)
			}
		case tar.TypeReg:
			if h.Size > maxFile {
				return fmt.Errorf("update: folder: %w", ErrTooLarge)
			}
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return fmt.Errorf("update: folder: %w", err)
			}
			mode := os.FileMode(0o644)
			if name == appID+"/backend/entry" {
				mode = 0o755
			}
			f, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
			if err != nil {
				return fmt.Errorf("update: folder: %w", err)
			}
			_, err = io.Copy(f, io.LimitReader(tr, maxFile))
			if cerr := f.Close(); err == nil {
				err = cerr
			}
			if err != nil {
				return fmt.Errorf("update: folder: %w", err)
			}
		default:
			return fmt.Errorf("update: folder: entry of type %c: %w", h.Typeflag, ErrFolder)
		}
	}
}

// localName reports whether name is a file name with no directory in it.
func localName(name string) bool {
	return name != "" && path.Base(name) == name && name != "." && name != ".."
}

// BundleSHA is the bundle's SHA-256 its directory's manifest names ("" when
// the manifest is unreadable).
func BundleSHA(dir string) string {
	raw, err := os.ReadFile(filepath.Join(dir, engine.ManifestFile))
	if err != nil {
		return ""
	}
	var m engine.Manifest
	if json.Unmarshal(raw, &m) != nil {
		return ""
	}
	return m.Bundle.SHA256
}

// syncDir makes a rename in dir durable.
func syncDir(dir string) error {
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

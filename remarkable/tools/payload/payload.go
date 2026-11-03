package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"estantedecifras.app/remarkable/internal/engine"
)

// archs are the architectures the payload serves, in the manifest's order:
// the reMarkable 2 and the Paper Pro (design §2).
var archs = []string{"armv7", "arm64"}

// folderEntries are what every assembled folder must hold under estante/
// (tools/appfolder; design §3.1): everything the reader runs, the music code
// in bundle/ beside the screens and the backend.
var folderEntries = []string{"manifest.json", "icon.png", "resources.rcc", "backend/entry", "bundle/manifest.json"}

// options are the command's flags.
type options struct {
	Folders        map[string]string // arch → the parent of estante/
	BackendVersion string
	Release        int
	Out            string
}

// file is a published file the manifest names.
type file struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

// backendInfo is a folder's backend: the version it prints and the host API
// it speaks.
type backendInfo struct {
	Version string `json:"version"`
	HostAPI int    `json:"hostApi"`
}

// manifest is the release's manifest.json (design §8), its keys in that
// order: the release's number, the payload's version, the host API and salt
// of the bundle every folder carries, each folder's backend, and each
// folder's archive.
type manifest struct {
	Release int    `json:"release"`
	Version string `json:"version"`
	HostAPI int    `json:"hostApi"`
	Salt    string `json:"salt"`
	Backend struct {
		ARMv7 backendInfo `json:"armv7"`
		ARM64 backendInfo `json:"arm64"`
	} `json:"backend"`
	Folder struct {
		ARMv7 file `json:"armv7"`
		ARM64 file `json:"arm64"`
	} `json:"folder"`
}

// output is one file to write into --out.
type output struct {
	name string
	data []byte
	mode fs.FileMode
}

// build checks every input, then writes the release's files into a temporary
// directory beside opts.Out and renames it into place. Every refusal comes
// before anything is written, so a refused payload leaves --out as it was.
func build(opts options) error {
	for arch := range opts.Folders {
		if !contains(archs, arch) {
			return fmt.Errorf("--folder %s: want armv7 or arm64", arch)
		}
	}
	for _, arch := range archs {
		if opts.Folders[arch] == "" {
			return fmt.Errorf("no --folder %s=DIR", arch)
		}
	}
	if opts.Release <= 0 {
		return fmt.Errorf("--release %d: want the release's number, from 1", opts.Release)
	}
	if err := checkOut(opts.Out); err != nil {
		return err
	}

	// The folders: complete, carrying the same QML and the same bundle, the
	// bundle checked as the reader checks it.
	type folder struct {
		rcc, bundle, archive []byte
		bm                   engine.Manifest
	}
	folders := map[string]folder{}
	for _, arch := range archs {
		root := filepath.Join(opts.Folders[arch], "estante")
		for _, entry := range folderEntries {
			info, err := os.Stat(filepath.Join(root, filepath.FromSlash(entry)))
			if err != nil || !info.Mode().IsRegular() {
				return fmt.Errorf("--folder %s: %s has no estante/%s", arch, opts.Folders[arch], entry)
			}
		}
		var f folder
		var err error
		if f.rcc, err = os.ReadFile(filepath.Join(root, "resources.rcc")); err != nil {
			return err
		}
		raw, err := os.ReadFile(filepath.Join(root, "bundle", engine.ManifestFile))
		if err != nil {
			return err
		}
		if err := json.Unmarshal(raw, &f.bm); err != nil {
			return fmt.Errorf("--folder %s: bundle/%s is not JSON: %w", arch, engine.ManifestFile, err)
		}
		if f.bm.HostAPI != engine.HostAPI {
			return fmt.Errorf("--folder %s: the bundle's hostApi is %d, the backend speaks %d", arch, f.bm.HostAPI, engine.HostAPI)
		}
		if f.bm.Bundle.Path == "" || filepath.Base(f.bm.Bundle.Path) != f.bm.Bundle.Path {
			return fmt.Errorf("--folder %s: the bundle's path %q is not a file name", arch, f.bm.Bundle.Path)
		}
		if f.bundle, err = os.ReadFile(filepath.Join(root, "bundle", f.bm.Bundle.Path)); err != nil {
			return fmt.Errorf("--folder %s: %w", arch, err)
		}
		if sum := hexSum(f.bundle); sum != f.bm.Bundle.SHA256 {
			return fmt.Errorf("--folder %s: %s's sha256 is %s, its manifest says %s", arch, f.bm.Bundle.Path, sum, f.bm.Bundle.SHA256)
		}
		if f.archive, err = archive(root); err != nil {
			return fmt.Errorf("--folder %s: %w", arch, err)
		}
		folders[arch] = f
	}
	if !bytes.Equal(folders["armv7"].rcc, folders["arm64"].rcc) {
		return fmt.Errorf("--folder: the armv7 and arm64 folders' resources.rcc differ")
	}
	if !bytes.Equal(folders["armv7"].bundle, folders["arm64"].bundle) {
		return fmt.Errorf("--folder: the armv7 and arm64 folders' bundles differ")
	}

	var outs []output
	var m manifest
	m.Release = opts.Release
	m.HostAPI = folders["armv7"].bm.HostAPI
	m.Salt = folders["armv7"].bm.Salt
	backends := map[string]*backendInfo{"armv7": &m.Backend.ARMv7, "arm64": &m.Backend.ARM64}
	archives := map[string]*file{"armv7": &m.Folder.ARMv7, "arm64": &m.Folder.ARM64}
	for _, arch := range archs {
		*backends[arch] = backendInfo{Version: opts.BackendVersion, HostAPI: engine.HostAPI}
		name := "estante-" + arch + ".tar.gz"
		outs = append(outs, output{name, folders[arch].archive, 0o644})
		*archives[arch] = file{Path: name, SHA256: hexSum(folders[arch].archive)}
	}
	m.Version = payloadVersion([]file{m.Folder.ARMv7, m.Folder.ARM64})
	text, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	outs = append(outs, output{engine.ManifestFile, append(text, '\n'), 0o644})

	return writeOut(opts.Out, outs)
}

// checkOut refuses an --out that exists and is not an empty directory.
func checkOut(out string) error {
	entries, err := os.ReadDir(out)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("--out %s: %w", out, err)
	}
	if len(entries) != 0 {
		return fmt.Errorf("--out %s exists and is not empty", out)
	}
	return nil
}

// writeOut writes outs into a temporary directory beside out, then renames
// it into place.
func writeOut(out string, outs []output) error {
	parent := filepath.Dir(filepath.Clean(out))
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return err
	}
	tmp, err := os.MkdirTemp(parent, ".payload-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmp)
	// MkdirTemp makes it 0700; the site serves it.
	if err := os.Chmod(tmp, 0o755); err != nil {
		return err
	}
	for _, o := range outs {
		p := filepath.Join(tmp, o.name)
		if err := os.WriteFile(p, o.data, o.mode); err != nil {
			return err
		}
		if err := os.Chmod(p, o.mode); err != nil { // past the umask
			return err
		}
	}
	// An empty --out was allowed; make way for the rename.
	if err := os.Remove(out); err != nil && !os.IsNotExist(err) {
		return err
	}
	return os.Rename(tmp, out)
}

// payloadVersion is the first twelve hex digits of the SHA-256 over the
// files' "path sha256" lines, sorted by path (design §8).
func payloadVersion(files []file) string {
	lines := make([]string, len(files))
	for i, f := range files {
		lines[i] = f.Path + " " + f.SHA256 + "\n"
	}
	sort.Strings(lines)
	return hexSum([]byte(strings.Join(lines, "")))[:12]
}

// archive is the folder at root as a deterministic .tar.gz, rooted at
// estante/: entries sorted, mtime 0, uid/gid 0, no owner names, modes 0755
// for directories and backend/entry and 0644 for the rest; the gzip header
// has no name and no mtime.
func archive(root string) ([]byte, error) {
	var buf bytes.Buffer
	gz, err := gzip.NewWriterLevel(&buf, gzip.BestCompression)
	if err != nil {
		return nil, err
	}
	tw := tar.NewWriter(gz)
	epoch := time.Unix(0, 0)
	// WalkDir visits each directory's entries in lexical order.
	err = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		name := "estante"
		if rel != "." {
			name += "/" + filepath.ToSlash(rel)
		}
		hdr := &tar.Header{Name: name, ModTime: epoch, Format: tar.FormatUSTAR}
		switch {
		case d.IsDir():
			hdr.Typeflag = tar.TypeDir
			hdr.Name += "/"
			hdr.Mode = 0o755
			return tw.WriteHeader(hdr)
		case d.Type().IsRegular():
			data, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			hdr.Typeflag = tar.TypeReg
			hdr.Mode = 0o644
			if name == "estante/backend/entry" {
				hdr.Mode = 0o755
			}
			hdr.Size = int64(len(data))
			if err := tw.WriteHeader(hdr); err != nil {
				return err
			}
			_, err = tw.Write(data)
			return err
		default:
			return fmt.Errorf("%s is neither a file nor a directory", path)
		}
	})
	if err != nil {
		return nil, err
	}
	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gz.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// digest is the backend's version: the first twelve hex digits of a SHA-256
// over every *.go file but tests, and every go.mod and go.sum, under each
// root, with the Go toolchain's version (design §8; refinement Decision 4).
// Each root's files enter sorted by their slash path relative to it, each as
// its path, its length and its bytes. Directories the go tool ignores —
// testdata/ and those named with a leading dot or underscore — are skipped.
func digest(roots []string) (string, error) {
	h := sha256.New()
	for i, root := range roots {
		var files []string
		err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			name := d.Name()
			if d.IsDir() {
				if path != root && (name == "testdata" || strings.HasPrefix(name, ".") || strings.HasPrefix(name, "_")) {
					return filepath.SkipDir
				}
				return nil
			}
			if !d.Type().IsRegular() {
				return nil
			}
			if name == "go.mod" || name == "go.sum" ||
				(strings.HasSuffix(name, ".go") && !strings.HasSuffix(name, "_test.go")) {
				rel, err := filepath.Rel(root, path)
				if err != nil {
					return err
				}
				files = append(files, filepath.ToSlash(rel))
			}
			return nil
		})
		if err != nil {
			return "", err
		}
		if len(files) == 0 {
			return "", fmt.Errorf("digest: %s holds no Go sources", root)
		}
		sort.Strings(files)
		fmt.Fprintf(h, "root %d\n", i)
		for _, rel := range files {
			data, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(rel)))
			if err != nil {
				return "", err
			}
			fmt.Fprintf(h, "%s\x00%d\n", rel, len(data))
			h.Write(data)
		}
	}
	fmt.Fprintf(h, "go %s\n", runtime.Version())
	return hex.EncodeToString(h.Sum(nil))[:12], nil
}

func hexSum(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

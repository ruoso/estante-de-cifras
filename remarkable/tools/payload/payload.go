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
// (tools/appfolder; design §3.1).
var folderEntries = []string{"manifest.json", "icon.png", "resources.rcc", "backend/entry"}

// options are the command's flags.
type options struct {
	Device         string            // the app's dist/device
	Folders        map[string]string // arch → the parent of estante/
	BackendVersion string
	Out            string
}

// file is a served file the manifest names.
type file struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

// backendFile is a served backend: the file, the version it prints, and the
// host API it speaks.
type backendFile struct {
	Path    string `json:"path"`
	SHA256  string `json:"sha256"`
	Version string `json:"version"`
	HostAPI int    `json:"hostApi"`
}

// manifest is /device/manifest.json, its keys in design §8's order. It is a
// superset of engine.Manifest, which engine.Open reads ignoring the rest.
type manifest struct {
	Version string `json:"version"`
	HostAPI int    `json:"hostApi"`
	Salt    string `json:"salt"`
	Bundle  file   `json:"bundle"`
	QML     file   `json:"qml"`
	Backend struct {
		ARMv7 backendFile `json:"armv7"`
		ARM64 backendFile `json:"arm64"`
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

// build checks every input, then writes the payload into a temporary
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
	if err := checkOut(opts.Out); err != nil {
		return err
	}

	// The bundle: the app's build's manifest, checked as the reader checks it.
	raw, err := os.ReadFile(filepath.Join(opts.Device, engine.ManifestFile))
	if err != nil {
		return fmt.Errorf("--device: %w", err)
	}
	var bm engine.Manifest
	if err := json.Unmarshal(raw, &bm); err != nil {
		return fmt.Errorf("--device: %s is not JSON: %w", engine.ManifestFile, err)
	}
	if bm.HostAPI != engine.HostAPI {
		return fmt.Errorf("--device: the bundle's hostApi is %d, the backend speaks %d", bm.HostAPI, engine.HostAPI)
	}
	if bm.Bundle.Path == "" || filepath.Base(bm.Bundle.Path) != bm.Bundle.Path {
		return fmt.Errorf("--device: the manifest's bundle path %q is not a file name", bm.Bundle.Path)
	}
	bundle, err := os.ReadFile(filepath.Join(opts.Device, bm.Bundle.Path))
	if err != nil {
		return fmt.Errorf("--device: %w", err)
	}
	if sum := hexSum(bundle); sum != bm.Bundle.SHA256 {
		return fmt.Errorf("--device: %s's sha256 is %s, its manifest says %s", bm.Bundle.Path, sum, bm.Bundle.SHA256)
	}

	// The folders: complete, and carrying the same QML.
	type folder struct {
		rcc, backend, archive []byte
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
		if f.rcc, err = os.ReadFile(filepath.Join(root, "resources.rcc")); err != nil {
			return err
		}
		if f.backend, err = os.ReadFile(filepath.Join(root, "backend", "entry")); err != nil {
			return err
		}
		if f.archive, err = archive(root); err != nil {
			return fmt.Errorf("--folder %s: %w", arch, err)
		}
		folders[arch] = f
	}
	if !bytes.Equal(folders["armv7"].rcc, folders["arm64"].rcc) {
		return fmt.Errorf("--folder: the armv7 and arm64 folders' resources.rcc differ")
	}

	// The files, each named by its content but the folders.
	var outs []output
	add := func(name string, data []byte, mode fs.FileMode) file {
		outs = append(outs, output{name, data, mode})
		return file{Path: name, SHA256: hexSum(data)}
	}
	hashed := func(prefix, suffix string, data []byte, mode fs.FileMode) file {
		return add(prefix+hexSum(data)[:8]+suffix, data, mode)
	}
	var m manifest
	m.HostAPI = bm.HostAPI
	m.Salt = bm.Salt
	m.Bundle = hashed("bundle.", ".js", bundle, 0o644)
	m.QML = hashed("resources.", ".rcc", folders["armv7"].rcc, 0o644)
	backends := map[string]*backendFile{"armv7": &m.Backend.ARMv7, "arm64": &m.Backend.ARM64}
	archives := map[string]*file{"armv7": &m.Folder.ARMv7, "arm64": &m.Folder.ARM64}
	for _, arch := range archs {
		b := hashed("estante-reader-"+arch+".", "", folders[arch].backend, 0o755)
		*backends[arch] = backendFile{Path: b.Path, SHA256: b.SHA256,
			Version: opts.BackendVersion, HostAPI: engine.HostAPI}
		*archives[arch] = add("estante-"+arch+".tar.gz", folders[arch].archive, 0o644)
	}
	m.Version = payloadVersion([]file{m.Bundle, m.QML,
		{m.Backend.ARMv7.Path, m.Backend.ARMv7.SHA256}, {m.Backend.ARM64.Path, m.Backend.ARM64.SHA256},
		m.Folder.ARMv7, m.Folder.ARM64})
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

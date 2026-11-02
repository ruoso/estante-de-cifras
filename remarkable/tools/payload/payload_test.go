package main

// unit — the device payload's layout (reader.payload; docs/remarkable-reader.md
// §8, §2.1 step 4). The fixtures are written here: a bundle directory (a small
// JS file and its manifest, as the app's build writes them) and two AppLoad
// folders by hand, each with a stand-in ELF header as backend/entry.

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"debug/elf"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"

	"estantedecifras.app/remarkable/internal/engine"
)

func sum(data []byte) string {
	s := sha256.Sum256(data)
	return hex.EncodeToString(s[:])
}

func write(t *testing.T, path string, data []byte, mode os.FileMode) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, mode); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, mode); err != nil {
		t.Fatal(err)
	}
}

// bundleDir writes a device bundle directory: bundle.<8>.js and its manifest
// with hostApi and the bundle's sha256 (or a given wrong one).
func bundleDir(t *testing.T, hostAPI int, wrongSum bool) string {
	t.Helper()
	dir := t.TempDir()
	code := []byte("globalThis.estante = { hostApi: 1 };\n")
	s := sum(code)
	name := "bundle." + s[:8] + ".js"
	write(t, filepath.Join(dir, name), code, 0o644)
	if wrongSum {
		s = strings.Repeat("0", 64)
	}
	m := map[string]any{"version": s[:12], "hostApi": hostAPI, "salt": "test-salt",
		"bundle": map[string]string{"path": name, "sha256": s}}
	raw, _ := json.MarshalIndent(m, "", "  ")
	write(t, filepath.Join(dir, "manifest.json"), append(raw, '\n'), 0o644)
	return dir
}

// elfHeader is a minimal ELF header for class and machine.
func elfHeader(class elf.Class, machine elf.Machine) []byte {
	hdr := make([]byte, 64)
	copy(hdr, elf.ELFMAG)
	hdr[elf.EI_CLASS] = byte(class)
	hdr[elf.EI_DATA] = byte(elf.ELFDATA2LSB)
	hdr[elf.EI_VERSION] = byte(elf.EV_CURRENT)
	binary.LittleEndian.PutUint16(hdr[16:18], uint16(elf.ET_EXEC))
	binary.LittleEndian.PutUint16(hdr[18:20], uint16(machine))
	return hdr
}

var fixtureRCC = []byte("qres\x00\x00\x00\x03 fixture resources")

// folderDir writes an assembled folder (the parent of estante/) for arch.
func folderDir(t *testing.T, arch string, rcc []byte) string {
	t.Helper()
	dir := t.TempDir()
	root := filepath.Join(dir, "estante")
	write(t, filepath.Join(root, "manifest.json"), []byte(`{"id": "estante", "entry": "/Main.qml"}`+"\n"), 0o644)
	write(t, filepath.Join(root, "icon.png"), []byte("\x89PNG fixture icon"), 0o644)
	write(t, filepath.Join(root, "resources.rcc"), rcc, 0o644)
	backend := elfHeader(elf.ELFCLASS32, elf.EM_ARM)
	if arch == "arm64" {
		backend = elfHeader(elf.ELFCLASS64, elf.EM_AARCH64)
	}
	write(t, filepath.Join(root, "backend", "entry"), backend, 0o755)
	return dir
}

type fixture struct {
	device, armv7, arm64 string
}

func newFixture(t *testing.T) fixture {
	return fixture{bundleDir(t, engine.HostAPI, false), folderDir(t, "armv7", fixtureRCC), folderDir(t, "arm64", fixtureRCC)}
}

func (f fixture) args(out string) []string {
	return []string{"--device", f.device, "--folder", "armv7=" + f.armv7, "--folder", "arm64=" + f.arm64,
		"--backend-version", "0123456789ab", "--out", out}
}

// runPayload runs the command and returns its stderr.
func runPayload(t *testing.T, args []string) (int, string) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	code := run(args, &stdout, &stderr)
	return code, stderr.String()
}

func buildPayload(t *testing.T, f fixture) string {
	t.Helper()
	out := filepath.Join(t.TempDir(), "device")
	if code, stderr := runPayload(t, f.args(out)); code != 0 {
		t.Fatalf("payload exited %d: %s", code, stderr)
	}
	return out
}

func readManifest(t *testing.T, out string) manifest {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(out, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	var m manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func namedFiles(m manifest) []file {
	return []file{m.Bundle, m.QML,
		{m.Backend.ARMv7.Path, m.Backend.ARMv7.SHA256}, {m.Backend.ARM64.Path, m.Backend.ARM64.SHA256},
		m.Folder.ARMv7, m.Folder.ARM64}
}

// orderedKeys reads a JSON object's keys in document order, and its nested
// objects' keys as "parent.key".
func orderedKeys(t *testing.T, raw []byte) []string {
	t.Helper()
	dec := json.NewDecoder(bytes.NewReader(raw))
	var keys []string
	var walk func(prefix string)
	walk = func(prefix string) {
		tok, err := dec.Token()
		if err != nil {
			t.Fatal(err)
		}
		if tok != json.Delim('{') {
			return
		}
		for dec.More() {
			k, err := dec.Token()
			if err != nil {
				t.Fatal(err)
			}
			key := prefix + k.(string)
			keys = append(keys, key)
			walk(key + ".")
		}
		if _, err := dec.Token(); err != nil {
			t.Fatal(err)
		}
	}
	walk("")
	return keys
}

// TestManifestNamesEveryFile pins design §8's manifest: exactly its keys, in
// order; every path served in --out with its sha256; each content-hashed
// name carrying its hash's first eight digits.
func TestManifestNamesEveryFile(t *testing.T) {
	out := buildPayload(t, newFixture(t))
	raw, err := os.ReadFile(filepath.Join(out, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"version", "hostApi", "salt",
		"bundle", "bundle.path", "bundle.sha256",
		"qml", "qml.path", "qml.sha256",
		"backend",
		"backend.armv7", "backend.armv7.path", "backend.armv7.sha256", "backend.armv7.version", "backend.armv7.hostApi",
		"backend.arm64", "backend.arm64.path", "backend.arm64.sha256", "backend.arm64.version", "backend.arm64.hostApi",
		"folder",
		"folder.armv7", "folder.armv7.path", "folder.armv7.sha256",
		"folder.arm64", "folder.arm64.path", "folder.arm64.sha256"}
	if got := orderedKeys(t, raw); !reflect.DeepEqual(got, want) {
		t.Errorf("manifest keys = %v\nwant %v", got, want)
	}
	if !bytes.HasSuffix(raw, []byte("}\n")) || !bytes.Contains(raw, []byte("\n  \"hostApi\": 1,\n")) {
		t.Errorf("manifest is not two-space-indented JSON ending in a newline:\n%s", raw)
	}

	m := readManifest(t, out)
	if m.HostAPI != engine.HostAPI || m.Salt != "test-salt" {
		t.Errorf("hostApi, salt = %d, %q; want the bundle's %d, test-salt", m.HostAPI, m.Salt, engine.HostAPI)
	}
	entries, err := os.ReadDir(out)
	if err != nil {
		t.Fatal(err)
	}
	var served []string
	for _, e := range entries {
		served = append(served, e.Name())
	}
	var named []string
	for _, f := range namedFiles(m) {
		named = append(named, f.Path)
		data, err := os.ReadFile(filepath.Join(out, f.Path))
		if err != nil {
			t.Errorf("%s: %v", f.Path, err)
			continue
		}
		if sum(data) != f.SHA256 {
			t.Errorf("%s: sha256 %s, manifest says %s", f.Path, sum(data), f.SHA256)
		}
	}
	named = append(named, "manifest.json")
	sort.Strings(named)
	if !reflect.DeepEqual(served, named) {
		t.Errorf("--out holds %v, want exactly %v", served, named)
	}
	for _, c := range []struct{ got, want string }{
		{m.Bundle.Path, "bundle." + m.Bundle.SHA256[:8] + ".js"},
		{m.QML.Path, "resources." + m.QML.SHA256[:8] + ".rcc"},
		{m.Backend.ARMv7.Path, "estante-reader-armv7." + m.Backend.ARMv7.SHA256[:8]},
		{m.Backend.ARM64.Path, "estante-reader-arm64." + m.Backend.ARM64.SHA256[:8]},
		{m.Folder.ARMv7.Path, "estante-armv7.tar.gz"},
		{m.Folder.ARM64.Path, "estante-arm64.tar.gz"},
	} {
		if c.got != c.want {
			t.Errorf("path %q, want %q", c.got, c.want)
		}
	}
	// The full manifest still opens as a bundle directory's (engine.Manifest).
	var bm engine.Manifest
	if err := json.Unmarshal(raw, &bm); err != nil || bm.Bundle.Path != m.Bundle.Path {
		t.Errorf("engine.Manifest reads bundle %q (%v), want %q", bm.Bundle.Path, err, m.Bundle.Path)
	}
}

// TestVersionCoversEveryFile pins §8's payload version: the digest of the
// sorted "path sha256" lines, changed by one byte of the rcc.
func TestVersionCoversEveryFile(t *testing.T) {
	f := newFixture(t)
	m := readManifest(t, buildPayload(t, f))
	var lines []string
	for _, nf := range namedFiles(m) {
		lines = append(lines, nf.Path+" "+nf.SHA256+"\n")
	}
	sort.Strings(lines)
	if want := sum([]byte(strings.Join(lines, "")))[:12]; m.Version != want {
		t.Errorf("version = %q, want %q", m.Version, want)
	}

	rcc := append([]byte{}, fixtureRCC...)
	rcc[len(rcc)-1] ^= 1
	f.armv7, f.arm64 = folderDir(t, "armv7", rcc), folderDir(t, "arm64", rcc)
	if m2 := readManifest(t, buildPayload(t, f)); m2.Version == m.Version {
		t.Errorf("version %q unchanged by a changed rcc", m.Version)
	}
}

// TestBackendEntries pins each backend's manifest entry (§8): the host API
// it speaks, the flag's version, its folder's backend/entry bytes, mode 0755.
func TestBackendEntries(t *testing.T) {
	f := newFixture(t)
	out := buildPayload(t, f)
	m := readManifest(t, out)
	for arch, b := range map[string]backendFile{"armv7": m.Backend.ARMv7, "arm64": m.Backend.ARM64} {
		if b.HostAPI != engine.HostAPI || b.Version != "0123456789ab" {
			t.Errorf("%s: hostApi %d, version %q; want %d, 0123456789ab", arch, b.HostAPI, b.Version, engine.HostAPI)
		}
		dir := map[string]string{"armv7": f.armv7, "arm64": f.arm64}[arch]
		want, _ := os.ReadFile(filepath.Join(dir, "estante", "backend", "entry"))
		got, err := os.ReadFile(filepath.Join(out, b.Path))
		if err != nil || !bytes.Equal(got, want) {
			t.Errorf("%s: %s is not the folder's backend/entry (%v)", arch, b.Path, err)
		}
		info, err := os.Stat(filepath.Join(out, b.Path))
		if err != nil || info.Mode().Perm() != 0o755 {
			t.Errorf("%s: %s mode %v, want 0755 (%v)", arch, b.Path, info.Mode().Perm(), err)
		}
	}
}

// TestArchiveCarriesFolder pins the folder archives (design §2.1 step 4):
// exactly estante/'s six entries, the folder's bytes, the modes, mtime 0 and
// uid/gid 0.
func TestArchiveCarriesFolder(t *testing.T) {
	f := newFixture(t)
	out := buildPayload(t, f)
	m := readManifest(t, out)
	for arch, a := range map[string]file{"armv7": m.Folder.ARMv7, "arm64": m.Folder.ARM64} {
		dir := map[string]string{"armv7": f.armv7, "arm64": f.arm64}[arch]
		raw, err := os.ReadFile(filepath.Join(out, a.Path))
		if err != nil {
			t.Fatal(err)
		}
		gz, err := gzip.NewReader(bytes.NewReader(raw))
		if err != nil {
			t.Fatal(err)
		}
		if gz.Name != "" || !gz.ModTime.IsZero() {
			t.Errorf("%s: gzip header name %q, mtime %v; want none", arch, gz.Name, gz.ModTime)
		}
		tr := tar.NewReader(gz)
		var names []string
		for {
			hdr, err := tr.Next()
			if err == io.EOF {
				break
			}
			if err != nil {
				t.Fatal(err)
			}
			names = append(names, hdr.Name)
			wantMode := int64(0o644)
			if hdr.Typeflag == tar.TypeDir || hdr.Name == "estante/backend/entry" {
				wantMode = 0o755
			}
			if hdr.Mode != wantMode || hdr.ModTime.Unix() != 0 || hdr.Uid != 0 || hdr.Gid != 0 {
				t.Errorf("%s: %s mode %o mtime %d uid %d gid %d; want %o, 0, 0, 0",
					arch, hdr.Name, hdr.Mode, hdr.ModTime.Unix(), hdr.Uid, hdr.Gid, wantMode)
			}
			if hdr.Typeflag == tar.TypeReg {
				got, _ := io.ReadAll(tr)
				want, _ := os.ReadFile(filepath.Join(dir, filepath.FromSlash(hdr.Name)))
				if !bytes.Equal(got, want) {
					t.Errorf("%s: %s differs from the folder's", arch, hdr.Name)
				}
			}
		}
		want := []string{"estante/", "estante/backend/", "estante/backend/entry",
			"estante/icon.png", "estante/manifest.json", "estante/resources.rcc"}
		sorted := append([]string{}, names...)
		sort.Strings(sorted)
		if !reflect.DeepEqual(sorted, want) {
			t.Errorf("%s: archive holds %v, want %v", arch, names, want)
		}
		if !sort.StringsAreSorted(names) {
			t.Errorf("%s: archive entries %v are not sorted", arch, names)
		}
	}
}

// TestDeterministic pins that identical inputs give byte-identical archives
// and manifests.
func TestDeterministic(t *testing.T) {
	f := newFixture(t)
	a, b := buildPayload(t, f), buildPayload(t, f)
	m := readManifest(t, a)
	for _, name := range []string{"manifest.json", m.Folder.ARMv7.Path, m.Folder.ARM64.Path} {
		x, _ := os.ReadFile(filepath.Join(a, name))
		y, err := os.ReadFile(filepath.Join(b, name))
		if err != nil || !bytes.Equal(x, y) {
			t.Errorf("%s differs between two runs (%v)", name, err)
		}
	}
}

// listing is a directory's tree, names and contents, for "left as it was".
func listing(t *testing.T, dir string) map[string]string {
	t.Helper()
	got := map[string]string{}
	filepath.WalkDir(dir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(dir, p)
		data, _ := os.ReadFile(p)
		got[rel] = string(data)
		return nil
	})
	return got
}

// TestRefusals pins that a payload the reader would refuse is never built
// (refinement Constraints): each fails, names the problem, and leaves --out
// (and its parent) as it was.
func TestRefusals(t *testing.T) {
	for _, c := range []struct {
		name    string
		mutate  func(t *testing.T, f *fixture, out string)
		message string
	}{
		{"bundle sha256", func(t *testing.T, f *fixture, _ string) {
			f.device = bundleDir(t, engine.HostAPI, true)
		}, "sha256"},
		{"bundle hostApi", func(t *testing.T, f *fixture, _ string) {
			f.device = bundleDir(t, 2, false)
		}, "hostApi is 2"},
		{"rcc differs", func(t *testing.T, f *fixture, _ string) {
			f.arm64 = folderDir(t, "arm64", []byte("another rcc"))
		}, "resources.rcc differ"},
		{"folder missing backend/entry", func(t *testing.T, f *fixture, _ string) {
			if err := os.Remove(filepath.Join(f.armv7, "estante", "backend", "entry")); err != nil {
				t.Fatal(err)
			}
		}, "no estante/backend/entry"},
		{"out not empty", func(t *testing.T, _ *fixture, out string) {
			write(t, filepath.Join(out, "keep"), []byte("kept"), 0o644)
		}, "not empty"},
	} {
		t.Run(c.name, func(t *testing.T) {
			f := newFixture(t)
			parent := t.TempDir()
			out := filepath.Join(parent, "device")
			c.mutate(t, &f, out)
			before := listing(t, parent)
			code, stderr := runPayload(t, f.args(out))
			if code == 0 {
				t.Fatal("payload succeeded, want a refusal")
			}
			if !strings.Contains(stderr, c.message) {
				t.Errorf("stderr %q does not name %q", stderr, c.message)
			}
			if after := listing(t, parent); !reflect.DeepEqual(after, before) {
				t.Errorf("--out's parent changed: %v, was %v", after, before)
			}
		})
	}
}

// TestDigest pins the backend's version (design §8; refinement Decision 4):
// stable across calls; changed by a non-test .go file or go.sum; unchanged by
// a _test.go file or anything under testdata/.
func TestDigest(t *testing.T) {
	dir := t.TempDir()
	files := map[string]string{
		"go.mod":            "module example\n",
		"go.sum":            "example v1 h1:x\n",
		"cmd/x/main.go":     "package main\n",
		"cmd/x/x_test.go":   "package main\n",
		"testdata/stuff.go": "package stuff\n",
	}
	for name, content := range files {
		write(t, filepath.Join(dir, filepath.FromSlash(name)), []byte(content), 0o644)
	}
	other := t.TempDir()
	write(t, filepath.Join(other, "go.mod"), []byte("module other\n"), 0o644)

	digestOf := func() string {
		t.Helper()
		var stdout, stderr bytes.Buffer
		if code := run([]string{"digest", dir, other}, &stdout, &stderr); code != 0 {
			t.Fatalf("digest exited %d: %s", code, stderr.String())
		}
		v := strings.TrimSpace(stdout.String())
		if len(v) != 12 {
			t.Fatalf("digest %q is not 12 hex digits", v)
		}
		return v
	}
	base := digestOf()
	if again := digestOf(); again != base {
		t.Fatalf("digest not stable: %q then %q", base, again)
	}
	change := func(name string) {
		t.Helper()
		p := filepath.Join(dir, filepath.FromSlash(name))
		write(t, p, []byte(files[name]+"// changed\n"), 0o644)
	}
	restore := func(name string) {
		write(t, filepath.Join(dir, filepath.FromSlash(name)), []byte(files[name]), 0o644)
	}
	for _, name := range []string{"cmd/x/main.go", "go.sum"} {
		change(name)
		if digestOf() == base {
			t.Errorf("digest unchanged by a change to %s", name)
		}
		restore(name)
	}
	for _, name := range []string{"cmd/x/x_test.go", "testdata/stuff.go"} {
		change(name)
		if got := digestOf(); got != base {
			t.Errorf("digest changed by %s: %q, want %q", name, got, base)
		}
		restore(name)
	}
}

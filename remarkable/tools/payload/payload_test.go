package main

// unit — a release's layout (reader.payload; docs/remarkable-reader.md §8,
// §2.1 step 4). The fixtures are written here: two AppLoad folders by hand,
// each with a stand-in ELF header as backend/entry and a bundle directory (a
// small JS file and its manifest, as the app's build writes them) as bundle/.

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"debug/elf"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
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
	code := []byte(fmt.Sprintf("globalThis.estante = { hostApi: %d };\n", hostAPI))
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

// folderDir writes an assembled folder (the parent of estante/) for arch,
// carrying bundle (a bundleDir) as estante/bundle/.
func folderDir(t *testing.T, arch string, rcc []byte, bundle string) string {
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
	entries, err := os.ReadDir(bundle)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		data, err := os.ReadFile(filepath.Join(bundle, e.Name()))
		if err != nil {
			t.Fatal(err)
		}
		write(t, filepath.Join(root, "bundle", e.Name()), data, 0o644)
	}
	return dir
}

type fixture struct {
	armv7, arm64 string
}

func newFixture(t *testing.T) fixture {
	b := bundleDir(t, engine.HostAPI, false)
	return fixture{folderDir(t, "armv7", fixtureRCC, b), folderDir(t, "arm64", fixtureRCC, b)}
}

func (f fixture) args(out string) []string {
	return []string{"--folder", "armv7=" + f.armv7, "--folder", "arm64=" + f.arm64,
		"--backend-version", "0123456789ab", "--release", "7", "--out", out}
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
	out := filepath.Join(t.TempDir(), "release")
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

// TestManifestNamesEveryFile pins design §8's release manifest: exactly its
// keys, in order; the release's number; each archive in --out with its
// sha256, and nothing else there.
func TestManifestNamesEveryFile(t *testing.T) {
	out := buildPayload(t, newFixture(t))
	raw, err := os.ReadFile(filepath.Join(out, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"release", "version", "hostApi", "salt",
		"backend",
		"backend.armv7", "backend.armv7.version", "backend.armv7.hostApi",
		"backend.arm64", "backend.arm64.version", "backend.arm64.hostApi",
		"folder",
		"folder.armv7", "folder.armv7.path", "folder.armv7.sha256",
		"folder.arm64", "folder.arm64.path", "folder.arm64.sha256"}
	if got := orderedKeys(t, raw); !reflect.DeepEqual(got, want) {
		t.Errorf("manifest keys = %v\nwant %v", got, want)
	}
	if !bytes.HasSuffix(raw, []byte("}\n")) || !bytes.Contains(raw, []byte(fmt.Sprintf("\n  \"hostApi\": %d,\n", engine.HostAPI))) {
		t.Errorf("manifest is not two-space-indented JSON ending in a newline:\n%s", raw)
	}
	m := readManifest(t, out)
	if m.Release != 7 || m.Salt != "test-salt" || m.HostAPI != engine.HostAPI {
		t.Errorf("release %d salt %q hostApi %d", m.Release, m.Salt, m.HostAPI)
	}
	for _, b := range []backendInfo{m.Backend.ARMv7, m.Backend.ARM64} {
		if b.Version != "0123456789ab" || b.HostAPI != engine.HostAPI {
			t.Errorf("backend %+v", b)
		}
	}
	names := []string{"manifest.json"}
	for _, f := range []file{m.Folder.ARMv7, m.Folder.ARM64} {
		data, err := os.ReadFile(filepath.Join(out, f.Path))
		if err != nil {
			t.Fatalf("%s not in --out: %v", f.Path, err)
		}
		if sum(data) != f.SHA256 {
			t.Errorf("%s: sha256 %s, manifest says %s", f.Path, sum(data), f.SHA256)
		}
		names = append(names, f.Path)
	}
	entries, _ := os.ReadDir(out)
	if len(entries) != len(names) {
		t.Errorf("--out holds %d files, want %v", len(entries), names)
	}
	if m.Folder.ARMv7.Path != "estante-armv7.tar.gz" || m.Folder.ARM64.Path != "estante-arm64.tar.gz" {
		t.Errorf("archives %s, %s", m.Folder.ARMv7.Path, m.Folder.ARM64.Path)
	}
	if len(m.Version) != 12 {
		t.Errorf("version %q is not twelve hex digits", m.Version)
	}
}

// TestArchiveCarriesFolder pins design §2.1 step 4: each archive is its
// folder, rooted at estante/ — its bundle/ among it — deterministic: sorted
// entries, mtime 0, no owner, modes 0755 for directories and backend/entry,
// 0644 for the rest.
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
		if !sort.StringsAreSorted(names) {
			t.Errorf("%s: archive entries %v are not sorted", arch, names)
		}
		for _, want := range []string{"estante/backend/entry", "estante/bundle/manifest.json", "estante/resources.rcc", "estante/manifest.json"} {
			found := false
			for _, n := range names {
				found = found || n == want
			}
			if !found {
				t.Errorf("%s: archive lacks %s (%v)", arch, want, names)
			}
		}
	}
}

// TestDeterministic pins that identical inputs give byte-identical archives
// and manifests.
func TestDeterministic(t *testing.T) {
	f := newFixture(t)
	a, b := buildPayload(t, f), buildPayload(t, f)
	for _, name := range []string{"manifest.json", "estante-armv7.tar.gz", "estante-arm64.tar.gz"} {
		x, _ := os.ReadFile(filepath.Join(a, name))
		y, _ := os.ReadFile(filepath.Join(b, name))
		if !bytes.Equal(x, y) {
			t.Errorf("%s differs between two builds of the same folders", name)
		}
	}
}

// TestRefusals pins every refusal, each leaving --out unwritten.
func TestRefusals(t *testing.T) {
	for _, tc := range []struct {
		name string
		edit func(t *testing.T, f *fixture, args *[]string)
		want string
	}{
		{"a bundle of another hostApi", func(t *testing.T, f *fixture, _ *[]string) {
			b := bundleDir(t, engine.HostAPI+1, false)
			f.armv7, f.arm64 = folderDir(t, "armv7", fixtureRCC, b), folderDir(t, "arm64", fixtureRCC, b)
		}, fmt.Sprintf("hostApi is %d", engine.HostAPI+1)},
		{"a bundle not its manifest's", func(t *testing.T, f *fixture, _ *[]string) {
			b := bundleDir(t, engine.HostAPI, true)
			f.armv7, f.arm64 = folderDir(t, "armv7", fixtureRCC, b), folderDir(t, "arm64", fixtureRCC, b)
		}, "its manifest says"},
		{"rcc differs", func(t *testing.T, f *fixture, _ *[]string) {
			f.arm64 = folderDir(t, "arm64", []byte("another rcc"), bundleDir(t, engine.HostAPI, false))
		}, "resources.rcc differ"},
		{"bundles differ", func(t *testing.T, f *fixture, _ *[]string) {
			other := bundleDir(t, engine.HostAPI, false)
			write(t, filepath.Join(other, "extra"), []byte("x"), 0o644)
			code := []byte("globalThis.estante = { hostApi: 2, other: 1 };\n")
			name := "bundle." + sum(code)[:8] + ".js"
			write(t, filepath.Join(other, name), code, 0o644)
			m, _ := json.Marshal(map[string]any{"version": "x", "hostApi": engine.HostAPI, "salt": "test-salt",
				"bundle": map[string]string{"path": name, "sha256": sum(code)}})
			write(t, filepath.Join(other, "manifest.json"), m, 0o644)
			f.arm64 = folderDir(t, "arm64", fixtureRCC, other)
		}, "bundles differ"},
		{"folder missing backend/entry", func(t *testing.T, f *fixture, _ *[]string) {
			os.Remove(filepath.Join(f.armv7, "estante", "backend", "entry"))
		}, "estante/backend/entry"},
		{"folder missing its bundle", func(t *testing.T, f *fixture, _ *[]string) {
			os.RemoveAll(filepath.Join(f.arm64, "estante", "bundle"))
		}, "estante/bundle/manifest.json"},
		{"no release", func(t *testing.T, f *fixture, args *[]string) {
			for i, a := range *args {
				if a == "--release" {
					(*args)[i+1] = "0"
				}
			}
		}, "usage"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			out := filepath.Join(t.TempDir(), "release")
			args := f.args(out)
			tc.edit(t, &f, &args)
			if tc.name != "no release" {
				args = f.args(out)
			}
			code, stderr := runPayload(t, args)
			if code == 0 {
				t.Fatalf("payload succeeded, want a refusal")
			}
			if !strings.Contains(stderr, tc.want) {
				t.Errorf("stderr %q, want it to say %q", stderr, tc.want)
			}
			if _, err := os.Stat(out); !os.IsNotExist(err) {
				t.Errorf("--out was written after a refusal")
			}
		})
	}
}

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

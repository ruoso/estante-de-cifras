package main

// unit — the AppLoad folder builder (reader.app_folder; docs/remarkable-reader.md
// §2, §2.1 step 7, §3.1; rm-appload README §Applications' format). rcc is
// injected: the fake copies the generated .qrc into resources.rcc, so a test
// reads what would have been compiled. Backends are minimal ELF headers
// written by the test, or the test binary itself.

import (
	"bytes"
	"crypto/sha256"
	"debug/elf"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
)

// fakeRCC "compiles" the qrc by copying it.
func fakeRCC(tool, qrc, out string) error {
	raw, err := os.ReadFile(qrc)
	if err != nil {
		return err
	}
	return os.WriteFile(out, raw, 0o644)
}

// elfHeader writes a minimal ELF header for class and machine.
func elfHeader(t *testing.T, class elf.Class, machine elf.Machine) string {
	t.Helper()
	hdr := make([]byte, 64)
	copy(hdr, elf.ELFMAG)
	hdr[elf.EI_CLASS] = byte(class)
	hdr[elf.EI_DATA] = byte(elf.ELFDATA2LSB)
	hdr[elf.EI_VERSION] = byte(elf.EV_CURRENT)
	binary.LittleEndian.PutUint16(hdr[16:18], uint16(elf.ET_EXEC))
	binary.LittleEndian.PutUint16(hdr[18:20], uint16(machine))
	path := filepath.Join(t.TempDir(), "estante-reader")
	if err := os.WriteFile(path, hdr, 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func backendFor(t *testing.T, arch string) string {
	m := machines[arch]
	return elfHeader(t, m.class, m.machine)
}

// qmlTree writes files (slash paths) under a temporary --qml directory.
func qmlTree(t *testing.T, files ...string) string {
	t.Helper()
	dir := t.TempDir()
	for _, f := range files {
		p := filepath.Join(dir, filepath.FromSlash(f))
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte("// "+f+"\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func buildFolder(t *testing.T, arch, backend, qml string) (string, error) {
	t.Helper()
	out := t.TempDir()
	err := build(options{Arch: arch, Backend: backend, QML: qml, RCC: "rcc", Out: out}, fakeRCC)
	return filepath.Join(out, appID), err
}

// TestManifest pins manifest.json's fields (rm-appload README §Applications'
// format; design §3.1; refinement Decision 8).
func TestManifest(t *testing.T) {
	dir, err := buildFolder(t, "armv7", backendFor(t, "armv7"), qmlTree(t, "Main.qml"))
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	want := map[string]any{
		"id": "estante", "name": "Estante", "entry": "/Main.qml",
		"loadsBackend": true, "canHaveMultipleFrontends": false,
		"supportsScaling": false, "aspectRatio": 0.75, "width": float64(1404),
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("manifest = %v, want %v", got, want)
	}
}

// TestLayoutPerArch pins the folder's four entries and an executable entry
// (design §2; §2.1 step 7, "backend/entry not executable"), and that a
// second build replaces the folder whole.
func TestLayoutPerArch(t *testing.T) {
	for _, arch := range []string{"armv7", "arm64"} {
		t.Run(arch, func(t *testing.T) {
			out := t.TempDir()
			stale := filepath.Join(out, appID, "stale.qml")
			if err := os.MkdirAll(filepath.Dir(stale), 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(stale, nil, 0o644); err != nil {
				t.Fatal(err)
			}
			opts := options{Arch: arch, Backend: backendFor(t, arch), QML: qmlTree(t, "Main.qml"), RCC: "rcc", Out: out}
			if err := build(opts, fakeRCC); err != nil {
				t.Fatal(err)
			}
			var got []string
			root := filepath.Join(out, appID)
			filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
				if err == nil && !d.IsDir() {
					rel, _ := filepath.Rel(root, p)
					got = append(got, filepath.ToSlash(rel))
				}
				return err
			})
			sort.Strings(got)
			want := []string{"backend/entry", "icon.png", "manifest.json", "resources.rcc"}
			if !reflect.DeepEqual(got, want) {
				t.Errorf("folder = %v, want %v", got, want)
			}
			fi, err := os.Stat(filepath.Join(root, "backend", "entry"))
			if err != nil {
				t.Fatal(err)
			}
			if fi.Mode().Perm() != 0o755 {
				t.Errorf("entry mode = %v, want 0755", fi.Mode().Perm())
			}
			if fi, err := os.Stat(root); err != nil {
				t.Error(err)
			} else if fi.Mode().Perm() != 0o755 {
				t.Errorf("estante/ mode = %v, want 0755", fi.Mode().Perm())
			}
			left, _ := os.ReadDir(out)
			if len(left) != 1 {
				t.Errorf("--out holds %d entries, want only estante/", len(left))
			}
		})
	}
}

// TestRefusesBackendOfAnotherArch: the folder for the wrong architecture is
// never made (design §2.1 step 7).
func TestRefusesBackendOfAnotherArch(t *testing.T) {
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	qml := qmlTree(t, "Main.qml")
	for _, arch := range []string{"armv7", "arm64"} {
		if _, err := buildFolder(t, arch, self, qml); err == nil {
			t.Errorf("%s: the test binary (the host's) was accepted", arch)
		}
	}
	if _, err := buildFolder(t, "armv7", backendFor(t, "arm64"), qml); err == nil {
		t.Error("armv7: an arm64 backend was accepted")
	}
	if _, err := buildFolder(t, "arm64", elfHeader(t, elf.ELFCLASS32, elf.EM_ARM), qml); err == nil {
		t.Error("arm64: an armv7 backend was accepted")
	}
	if _, err := buildFolder(t, "x86", backendFor(t, "arm64"), qml); err == nil {
		t.Error("an unknown --arch was accepted")
	}
}

type qrcDoc struct {
	Resources []struct {
		Prefix string `xml:"prefix,attr"`
		Files  []struct {
			Alias string `xml:"alias,attr"`
			Path  string `xml:",chardata"`
		} `xml:"file"`
	} `xml:"qresource"`
}

// TestQrcCarriesAppQMLOnly: the resources carry the app's QML and nothing of
// its tests, the AppLoad stand-in or the harness (qml_harness.md L174–176:
// the stand-in never ships), nor a dotfile.
func TestQrcCarriesAppQMLOnly(t *testing.T) {
	qml := qmlTree(t, "Main.qml", "status.js", "tests/tst_x.qml",
		"tests/appload/net/asivery/AppLoad/AppLoad.qml", "tests/appload/net/asivery/AppLoad/qmldir",
		"harness/must-fail/tst_must_fail.qml", ".hidden.qml", "tests/.venv/x.py")
	dir, err := buildFolder(t, "arm64", backendFor(t, "arm64"), qml)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "resources.rcc"))
	if err != nil {
		t.Fatal(err)
	}
	var doc qrcDoc
	if err := xml.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("qrc: %v\n%s", err, raw)
	}
	if len(doc.Resources) != 1 || doc.Resources[0].Prefix != "/" {
		t.Fatalf("qrc resources = %+v, want one at prefix /", doc.Resources)
	}
	var aliases []string
	for _, f := range doc.Resources[0].Files {
		aliases = append(aliases, f.Alias)
		if want := filepath.Join(qml, filepath.FromSlash(f.Alias)); f.Path != want {
			t.Errorf("%s read from %q, want %q", f.Alias, f.Path, want)
		}
	}
	if want := []string{"Main.qml", "status.js"}; !reflect.DeepEqual(aliases, want) {
		t.Errorf("qrc lists %v, want %v", aliases, want)
	}
}

// TestQrcCarriesFaces: built from the real qml/, the resources carry the
// reader's three faces and each family's licence (reader.qml_chart; workflow
// 19 §The screen, as amended): each face as TrueType, decoded from the app's
// woff2 by tools/fonts/convert.py — the reMarkable's Qt cannot read woff2 —
// whose sources.json names the woff2 by its SHA-256, so a changed app font
// fails here until the faces are converted again; each LICENSE byte for byte
// the app's (app/src/theme/fonts/README.md). No woff2 is carried.
func TestQrcCarriesFaces(t *testing.T) {
	const qml = "../../qml"
	const appFonts = "../../../app/src/theme/fonts"
	dir, err := buildFolder(t, "armv7", backendFor(t, "armv7"), qml)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "resources.rcc"))
	if err != nil {
		t.Fatal(err)
	}
	var doc qrcDoc
	if err := xml.Unmarshal(raw, &doc); err != nil || len(doc.Resources) != 1 {
		t.Fatalf("qrc: %v\n%s", err, raw)
	}
	carried := map[string]string{}
	for _, f := range doc.Resources[0].Files {
		carried[f.Alias] = f.Path
	}
	families := map[string][]string{
		"figtree": {"figtree-latin-wght-normal", "figtree-latin-ext-wght-normal"},
		"atkinson-hyperlegible": {
			"atkinson-hyperlegible-latin-400-normal", "atkinson-hyperlegible-latin-ext-400-normal",
			"atkinson-hyperlegible-latin-700-normal", "atkinson-hyperlegible-latin-ext-700-normal",
		},
		"atkinson-hyperlegible-mono": {
			"atkinson-hyperlegible-mono-latin-wght-normal", "atkinson-hyperlegible-mono-latin-ext-wght-normal",
		},
	}
	var sources map[string]struct {
		From   string `json:"from"`
		SHA256 string `json:"sha256"`
	}
	sraw, err := os.ReadFile(filepath.Join(qml, "fonts", "sources.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(sraw, &sources); err != nil {
		t.Fatalf("fonts/sources.json: %v", err)
	}
	read := func(path string) []byte {
		t.Helper()
		b, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		return b
	}
	for family, names := range families {
		lic, ok := carried["fonts/"+family+"/LICENSE"]
		if !ok {
			t.Errorf("the qrc does not carry fonts/%s/LICENSE", family)
		} else if !bytes.Equal(read(lic), read(filepath.Join(appFonts, family, "LICENSE"))) {
			t.Errorf("fonts/%s/LICENSE differs from the app's", family)
		}
		for _, name := range names {
			rel := family + "/" + name + ".ttf"
			path, ok := carried["fonts/"+rel]
			if !ok {
				t.Errorf("the qrc does not carry fonts/%s", rel)
				continue
			}
			if head := read(path); len(head) < 4 || !bytes.Equal(head[:4], []byte{0, 1, 0, 0}) {
				t.Errorf("fonts/%s is not TrueType", rel)
			}
			src, ok := sources[rel]
			if !ok {
				t.Errorf("fonts/sources.json does not name fonts/%s", rel)
				continue
			}
			woff2 := filepath.Join(appFonts, family, name+".woff2")
			if want := "app/src/theme/fonts/" + family + "/" + name + ".woff2"; src.From != want {
				t.Errorf("fonts/%s comes from %s, want %s", rel, src.From, want)
			}
			sum := sha256.Sum256(read(woff2))
			if got := hex.EncodeToString(sum[:]); got != src.SHA256 {
				t.Errorf("app/src/theme/fonts/%s/%s.woff2 changed since fonts/%s was made: run python3 tools/fonts/convert.py in remarkable/", family, name, rel)
			}
		}
	}
	// Nothing else under fonts/ but sources.json: no family the reader does
	// not load, and no woff2 the device cannot read.
	for alias := range carried {
		if !strings.HasPrefix(alias, "fonts/") || alias == "fonts/sources.json" {
			continue
		}
		parts := strings.Split(alias, "/")
		if len(parts) != 3 {
			t.Errorf("unexpected font file %s", alias)
			continue
		}
		if _, ok := families[parts[1]]; !ok {
			t.Errorf("the qrc carries %s, a family the reader does not load", alias)
		}
		if strings.HasSuffix(alias, ".woff2") || strings.HasSuffix(alias, ".woff") {
			t.Errorf("the qrc carries %s, which the reMarkable's Qt cannot read", alias)
		}
	}
	for _, chart := range []string{"chart/SheetView.qml", "chart/Faces.qml", "chart/ChordDiagram.qml"} {
		if _, ok := carried[chart]; !ok {
			t.Errorf("the qrc does not carry %s", chart)
		}
	}
}

// TestRefusesMissingMain: no root, no folder.
func TestRefusesMissingMain(t *testing.T) {
	out := t.TempDir()
	opts := options{Arch: "armv7", Backend: backendFor(t, "armv7"), QML: qmlTree(t, "status.js", "tests/Main.qml"), RCC: "rcc", Out: out}
	err := build(opts, fakeRCC)
	if err == nil || !strings.Contains(err.Error(), "Main.qml") {
		t.Errorf("build = %v, want an error naming Main.qml", err)
	}
	if _, err := os.Stat(filepath.Join(out, appID)); !os.IsNotExist(err) {
		t.Errorf("estante/ was made: %v", err)
	}
}

// TestIconIsOneBit: 100 × 100 (AppLoad's example icon), every pixel pure
// black or pure white (workflow 19, the refresh budget's rule 6).
func TestIconIsOneBit(t *testing.T) {
	img, err := png.Decode(bytes.NewReader(icon))
	if err != nil {
		t.Fatal(err)
	}
	if got := img.Bounds(); got != image.Rect(0, 0, 100, 100) {
		t.Fatalf("icon bounds = %v, want 100 × 100", got)
	}
	var black, white int
	for y := 0; y < 100; y++ {
		for x := 0; x < 100; x++ {
			r, g, b, a := img.At(x, y).RGBA()
			switch {
			case a != 0xffff:
				t.Fatalf("pixel (%d, %d) not opaque", x, y)
			case r == 0 && g == 0 && b == 0:
				black++
			case r == 0xffff && g == 0xffff && b == 0xffff:
				white++
			default:
				t.Fatalf("pixel (%d, %d) = %d %d %d, not black or white", x, y, r, g, b)
			}
		}
	}
	if black == 0 || white == 0 {
		t.Errorf("icon is blank: %d black, %d white", black, white)
	}
}

// TestUsage: a missing flag prints the usage line and exits 2.
func TestUsage(t *testing.T) {
	var stderr bytes.Buffer
	if code := run([]string{"--arch", "armv7"}, &stderr, fakeRCC); code != 2 {
		t.Errorf("exit %d, want 2", code)
	}
	if stderr.String() != usage+"\n" {
		t.Errorf("stderr %q, want the usage line", stderr.String())
	}
}

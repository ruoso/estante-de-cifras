package main

import (
	"bytes"
	"crypto/sha256"
	"debug/elf"
	_ "embed"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// appID is the app's AppLoad identifier: the folder's name, the manifest's
// id, the QML endpoint's applicationID and the socket's /tmp/estante.sock.
const appID = "estante"

//go:embed icon.png
var icon []byte

// manifest is the folder's manifest.json (rm-appload README §Applications'
// format; design §3.1; refinement Decision 8): one frontend, sized to the
// device's own screen. aspectRatio and width "auto" make AppLoad's box the
// device's screen (rm-appload library.cpp parseAspectRatioAndWidth: ratio 0
// and width 0, "as is current device") — 1404 × 1872 on the rM2, 1620 × 2160
// on the Paper Pro — at scale 1 fullscreen, the root given that size, which
// the QML lays its screens out for (chart/metrics.js configure). Scaling is
// left off: AppLoad honours disablesWindowedMode for external apps only, so a
// QML app opened as a window would be handed a third of the screen to lay
// out in; unscaled, a window shows the full-size page scaled down.
// "original" meant the Paper Pro's 1620 on every device.
type manifest struct {
	ID                       string `json:"id"`
	Name                     string `json:"name"`
	Entry                    string `json:"entry"`
	LoadsBackend             bool   `json:"loadsBackend"`
	CanHaveMultipleFrontends bool   `json:"canHaveMultipleFrontends"`
	SupportsScaling          bool   `json:"supportsScaling"`
	AspectRatio              string `json:"aspectRatio"`
	Width                    string `json:"width"`
	// Screens is the screens' build stamp, the one compiled into their
	// build.js: the backend reports it, and the screens reload when theirs
	// differs (a stale cache of xochitl's). AppLoad ignores it.
	Screens string `json:"screens"`
}

// buildStamp is the QML's build stamp: the first twelve hex digits of a
// SHA-256 over each file's path and bytes, in order, but build.js's own.
func buildStamp(dir string, files []string) (string, error) {
	h := sha256.New()
	for _, rel := range files {
		if rel == "build.js" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(rel)))
		if err != nil {
			return "", err
		}
		fmt.Fprintf(h, "%s\x00%d\x00", rel, len(data))
		h.Write(data)
	}
	return hex.EncodeToString(h.Sum(nil))[:12], nil
}

func theManifest() manifest {
	return manifest{
		ID:                       appID,
		Name:                     "Estante",
		Entry:                    "/Main.qml",
		LoadsBackend:             true,
		CanHaveMultipleFrontends: false,
		SupportsScaling:          false,
		AspectRatio:              "auto",
		Width:                    "auto",
	}
}

// machines is each architecture's ELF class and machine: the rM2 is 32-bit
// ARM, the Paper Pro 64-bit.
var machines = map[string]struct {
	class   elf.Class
	machine elf.Machine
}{
	"armv7": {elf.ELFCLASS32, elf.EM_ARM},
	"arm64": {elf.ELFCLASS64, elf.EM_AARCH64},
}

// rccFunc compiles qrc into out, a binary resource file, with the rcc at
// tool. The command runs it; a test replaces it.
type rccFunc func(tool, qrc, out string) error

// options are the command's flags.
type options struct {
	Arch    string
	Backend string
	QML     string
	RCC     string
	Bundle  string
	Out     string
}

// BundleDir is the folder's music code: the app's device bundle, its
// manifest.json and the bundle that manifest names (design §8), which the
// backend stages in its store when it differs from the one it reads with.
const BundleDir = "bundle"

// build writes opts.Out/estante/ — manifest.json, icon.png, resources.rcc,
// backend/entry, bundle/ — replacing an existing one whole. It assembles the folder
// beside it and renames it into place, so a failure leaves the old folder.
func build(opts options, rcc rccFunc) error {
	want, ok := machines[opts.Arch]
	if !ok {
		return fmt.Errorf("--arch %q: want armv7 or arm64", opts.Arch)
	}
	if err := checkELF(opts.Backend, want.class, want.machine); err != nil {
		return err
	}
	files, err := qmlFiles(opts.QML)
	if err != nil {
		return err
	}
	bundleName, err := bundleNamed(opts.Bundle)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(opts.Out, 0o755); err != nil {
		return err
	}
	tmp, err := os.MkdirTemp(opts.Out, ".estante-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmp)
	// MkdirTemp makes it 0700; the folder is AppLoad's to read.
	if err := os.Chmod(tmp, 0o755); err != nil {
		return err
	}

	stamp, err := buildStamp(opts.QML, files)
	if err != nil {
		return err
	}
	m := theManifest()
	m.Screens = stamp
	raw, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(tmp, "manifest.json"), append(raw, '\n'), 0o644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(tmp, "icon.png"), icon, 0o644); err != nil {
		return err
	}
	if err := os.Mkdir(filepath.Join(tmp, "backend"), 0o755); err != nil {
		return err
	}
	if err := copyFile(opts.Backend, filepath.Join(tmp, "backend", "entry"), 0o755); err != nil {
		return err
	}
	if err := os.Mkdir(filepath.Join(tmp, BundleDir), 0o755); err != nil {
		return err
	}
	for _, name := range []string{"manifest.json", bundleName} {
		if err := copyFile(filepath.Join(opts.Bundle, name), filepath.Join(tmp, BundleDir, name), 0o644); err != nil {
			return err
		}
	}

	// The qrc lives outside the folder, so it never ships.
	work, err := os.MkdirTemp("", "appfolder-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(work)
	qrc := filepath.Join(work, "estante.qrc")
	// The stamp, in place of the source's build.js.
	stampJS := filepath.Join(work, "build.js")
	if err := os.WriteFile(stampJS, []byte(".pragma library\n// The screens' build stamp, written by tools/appfolder.\nvar screens = \""+stamp+"\";\n"), 0o644); err != nil {
		return err
	}
	text, err := qrcText(opts.QML, files, map[string]string{"build.js": stampJS})
	if err != nil {
		return err
	}
	if err := os.WriteFile(qrc, text, 0o644); err != nil {
		return err
	}
	if err := rcc(opts.RCC, qrc, filepath.Join(tmp, "resources.rcc")); err != nil {
		return fmt.Errorf("rcc: %w", err)
	}

	dest := filepath.Join(opts.Out, appID)
	if err := os.RemoveAll(dest); err != nil {
		return err
	}
	return os.Rename(tmp, dest)
}

// bundleNamed is the bundle the device build's manifest in dir names
// (bundle.<hash>.js): only it is carried, never an earlier build's beside it.
func bundleNamed(dir string) (string, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		return "", fmt.Errorf("--bundle: %w", err)
	}
	var m struct {
		Bundle struct {
			Path string `json:"path"`
		} `json:"bundle"`
	}
	if json.Unmarshal(raw, &m) != nil || m.Bundle.Path == "" || filepath.Base(m.Bundle.Path) != m.Bundle.Path ||
		!strings.HasPrefix(m.Bundle.Path, "bundle.") || !strings.HasSuffix(m.Bundle.Path, ".js") {
		return "", fmt.Errorf("--bundle %s: its manifest.json names no bundle", dir)
	}
	return m.Bundle.Path, nil
}

// checkELF refuses a backend that is not an ELF executable for class and
// machine (design §2.1 step 7: the folder for the wrong architecture).
func checkELF(path string, class elf.Class, machine elf.Machine) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	var hdr [20]byte
	if _, err := io.ReadFull(f, hdr[:]); err != nil || !bytes.Equal(hdr[:4], []byte(elf.ELFMAG)) {
		return fmt.Errorf("--backend %s: not an ELF file", path)
	}
	gotClass := elf.Class(hdr[elf.EI_CLASS])
	var order binary.ByteOrder
	switch elf.Data(hdr[elf.EI_DATA]) {
	case elf.ELFDATA2LSB:
		order = binary.LittleEndian
	case elf.ELFDATA2MSB:
		order = binary.BigEndian
	default:
		return fmt.Errorf("--backend %s: not an ELF file", path)
	}
	gotMachine := elf.Machine(order.Uint16(hdr[18:20]))
	if gotClass != class || gotMachine != machine {
		return fmt.Errorf("--backend %s: built for %s %s, want %s %s",
			path, gotClass, gotMachine, class, machine)
	}
	return nil
}

// qmlFiles lists the files under dir the app ships, by their slash paths
// relative to dir, sorted: every file but those under the top-level tests/
// and harness/ (the AppLoad stand-in and the tests never ship;
// qml_harness.md) and dotfiles (a venv, an editor's). Main.qml must be one.
func qmlFiles(dir string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		rel = filepath.ToSlash(rel)
		if strings.HasPrefix(d.Name(), ".") || rel == "tests" || rel == "harness" {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if d.Type().IsRegular() {
			files = append(files, rel)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(files)
	if i := sort.SearchStrings(files, "Main.qml"); i == len(files) || files[i] != "Main.qml" {
		return nil, errors.New("--qml: no Main.qml, the root AppLoad loads")
	}
	return files, nil
}

// qrcText is the resource collection: each file at its relative path under
// the root prefix (AppLoad registers it under /estante and loads
// qrc:/estante/Main.qml), read from its absolute path.
func qrcText(dir string, files []string, override map[string]string) ([]byte, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return nil, err
	}
	var b bytes.Buffer
	b.WriteString("<!DOCTYPE RCC>\n<RCC version=\"1.0\">\n<qresource prefix=\"/\">\n")
	for _, rel := range files {
		b.WriteString("  <file alias=\"")
		if err := xml.EscapeText(&b, []byte(rel)); err != nil {
			return nil, err
		}
		b.WriteString("\">")
		src := filepath.Join(abs, filepath.FromSlash(rel))
		if o, ok := override[rel]; ok {
			src = o
		}
		if err := xml.EscapeText(&b, []byte(src)); err != nil {
			return nil, err
		}
		b.WriteString("</file>\n")
	}
	b.WriteString("</qresource>\n</RCC>\n")
	return b.Bytes(), nil
}

func copyFile(src, dst string, mode fs.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	if err := out.Close(); err != nil {
		return err
	}
	return os.Chmod(dst, mode) // past the umask
}

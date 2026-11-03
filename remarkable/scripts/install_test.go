package scripts

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"debug/elf"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// The stand-in ssh logs its argv (each argument ended by \037, the
// invocation by \036), answers `uname -m` with $FAKE_UNAME, succeeds at
// -O exit / -O check, and runs any other remote command with sh -c after
// rewriting /home/root to the fake tablet root.
const fakeSSH = `#!/bin/sh
printf 'ssh\037' >>"$FAKE_LOG"
for a in "$@"; do printf '%s\037' "$a" >>"$FAKE_LOG"; done
printf '\036' >>"$FAKE_LOG"
op=
while [ $# -gt 0 ]; do
	case "$1" in
	-O) op=$2; shift 2 ;;
	-o|-p|-i|-l|-F) shift 2 ;;
	-*) shift ;;
	*) shift; break ;;
	esac
done
case "$op" in
exit|check) exit 0 ;;
'') ;;
*) exit 255 ;;
esac
cmd="$*"
if [ "$cmd" = "uname -m" ]; then
	printf '%s\n' "$FAKE_UNAME"
	exit 0
fi
cmd=$(printf '%s\n' "$cmd" | sed "s#/home/root#$FAKE_ROOT#g")
exec sh -c "$cmd"
`

// The stand-in scp logs its argv as ssh's does and copies to the rewritten
// target with cp -R, which, like scp -r, makes the target when it is absent.
const fakeSCP = `#!/bin/sh
printf 'scp\037' >>"$FAKE_LOG"
for a in "$@"; do printf '%s\037' "$a" >>"$FAKE_LOG"; done
printf '\036' >>"$FAKE_LOG"
src=
dst=
while [ $# -gt 0 ]; do
	case "$1" in
	-o|-P|-i|-F) shift 2 ;;
	-*) shift ;;
	*) if [ -z "$src" ]; then src=$1; else dst=$1; fi; shift ;;
	esac
done
path=$(printf '%s\n' "${dst#*:}" | sed "s#^/home/root#$FAKE_ROOT#")
exec cp -R "$src" "$path"
`

var archs = []string{"armv7", "arm64"}

// folderFiles is one architecture's app folder, as tools/payload's archive
// lays it out under estante/; arch.txt is the marker naming the architecture.
func folderFiles(arch, release string) map[string]string {
	return map[string]string{
		"manifest.json": `{"name":"Estante","entry":"/qml/Main.qml"}` + "\n",
		"icon.png":      "icon " + release + "\n",
		"resources.rcc": "rcc " + release + "\n",
		"backend/entry": "#!/bin/sh\necho " + arch + " " + release + "\n",
		"arch.txt":      arch + " " + release + "\n",
	}
}

// buildArchive is folderFiles as a .tar.gz rooted at estante/, directories
// and backend/entry 0755, the rest 0644 (tools/payload's archive).
func buildArchive(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for _, d := range []string{"estante/", "estante/backend/"} {
		if err := tw.WriteHeader(&tar.Header{Name: d, Typeflag: tar.TypeDir, Mode: 0o755}); err != nil {
			t.Fatal(err)
		}
	}
	for name, data := range files {
		mode := int64(0o644)
		if name == "backend/entry" {
			mode = 0o755
		}
		hdr := &tar.Header{Name: "estante/" + name, Typeflag: tar.TypeReg, Mode: mode, Size: int64(len(data))}
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(data)); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func hexSum(b []byte) string {
	s := sha256.Sum256(b)
	return hex.EncodeToString(s[:])
}

// site is the stand-in for the site's /device/.
type site struct {
	srv      *httptest.Server
	requests atomic.Int64
	archives map[string][]byte
	manifest []byte
	bundle   string // the bundle's name under /device/
}

// siteBundle is the site's bundle body.
const siteBundle = "globalThis.site = 1;\n"

// newSite serves both archives and a manifest naming each; edit, when not
// nil, changes the manifest's folder entries before it is written.
func newSite(t *testing.T, edit func(folder map[string]map[string]string)) *site {
	t.Helper()
	s := &site{archives: map[string][]byte{}}
	folder := map[string]map[string]string{}
	for _, arch := range archs {
		name := "estante-" + arch + ".tar.gz"
		data := buildArchive(t, folderFiles(arch, "new"))
		s.archives[name] = data
		folder[arch] = map[string]string{"path": name, "sha256": hexSum(data)}
	}
	if edit != nil {
		edit(folder)
	}
	bsum := hexSum([]byte(siteBundle))
	s.bundle = "bundle." + bsum[:8] + ".js"
	s.archives[s.bundle] = []byte(siteBundle)
	m := map[string]any{
		"version": "0a1b2c3d4e5f",
		"hostApi": 1,
		"bundle":  map[string]any{"path": s.bundle, "sha256": bsum},
		"backend": map[string]any{
			"armv7": map[string]any{"path": "estante-reader-armv7.123", "sha256": strings.Repeat("1", 64), "version": "dev"},
			"arm64": map[string]any{"path": "estante-reader-arm64.456", "sha256": strings.Repeat("2", 64), "version": "dev"},
		},
		"folder": folder,
	}
	text, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	s.manifest = append(text, '\n')
	s.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.requests.Add(1)
		name, ok := strings.CutPrefix(r.URL.Path, "/device/")
		switch {
		case ok && name == "manifest.json":
			w.Write(s.manifest)
		case ok && s.archives[name] != nil:
			w.Write(s.archives[name])
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(s.srv.Close)
	return s
}

// rig is one run's world: the stand-ins, the log and the fake tablet.
type rig struct {
	t      *testing.T
	bin    string
	log    string
	tablet string // stands for /home/root
	tmp    string
	site   *site
	env    map[string]string
	script string // install.sh unless a test runs a copy
}

func needHostTools(t *testing.T) {
	t.Helper()
	for _, tool := range []string{"sh", "curl", "tar", "sed", "cp"} {
		if _, err := exec.LookPath(tool); err != nil {
			t.Fatalf("the install test needs %s on the host: %v", tool, err)
		}
	}
	if _, err := os.Stat("/bin/sh"); err != nil {
		t.Fatalf("the install test runs install.sh with /bin/sh: %v", err)
	}
	_, e1 := exec.LookPath("sha256sum")
	_, e2 := exec.LookPath("shasum")
	if e1 != nil && e2 != nil {
		t.Fatalf("the install test needs sha256sum or shasum on the host")
	}
}

func newRig(t *testing.T, s *site) *rig {
	t.Helper()
	needHostTools(t)
	r := &rig{t: t, bin: t.TempDir(), tablet: t.TempDir(), tmp: t.TempDir(), site: s}
	r.log = filepath.Join(t.TempDir(), "calls.log")
	for name, text := range map[string]string{"ssh": fakeSSH, "scp": fakeSCP} {
		if err := os.WriteFile(filepath.Join(r.bin, name), []byte(text), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	// A tablet with xovi and AppLoad (step 3), a reader's state from a pairing.
	write(t, filepath.Join(r.tablet, "xovi/exthome/appload/other-app/manifest.json"), "other\n", 0o644)
	write(t, filepath.Join(r.tablet, "xovi/extensions.d/appload.so"), "so\n", 0o644)
	write(t, filepath.Join(r.tablet, ".local/share/estante/session.json"), "{}\n", 0o600)
	write(t, filepath.Join(r.tablet, ".local/share/estante/books/home/notes.txt"), "kept\n", 0o644)
	r.env = map[string]string{
		"PATH":           r.bin + string(os.PathListSeparator) + os.Getenv("PATH"),
		"HOME":           t.TempDir(),
		"TMPDIR":         r.tmp,
		"LC_ALL":         "C",
		"FAKE_LOG":       r.log,
		"FAKE_ROOT":      r.tablet,
		"FAKE_UNAME":     "armv7l",
		"RM_IP":          "192.0.2.7",
		"ESTANTE_ORIGIN": s.srv.URL,
	}
	return r
}

func write(t *testing.T, path, data string, mode fs.FileMode) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(data), mode); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, mode); err != nil {
		t.Fatal(err)
	}
}

// putFolder writes an installed reader folder at dir.
func putFolder(t *testing.T, dir string, files map[string]string) {
	t.Helper()
	for name, data := range files {
		mode := fs.FileMode(0o644)
		if name == "backend/entry" {
			mode = 0o755
		}
		write(t, filepath.Join(dir, name), data, mode)
	}
}

// run runs install.sh with /bin/sh; it returns the combined output and
// whether it exited zero.
func (r *rig) run() (string, bool) {
	r.t.Helper()
	script := r.script
	if script == "" {
		script = "install.sh"
	}
	cmd := exec.Command("/bin/sh", script)
	for k, v := range r.env {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		if _, ok := err.(*exec.ExitError); !ok {
			r.t.Fatalf("running install.sh: %v", err)
		}
	}
	return string(out), err == nil
}

// calls is the stand-ins' log, one argv per invocation.
func (r *rig) calls() [][]string {
	r.t.Helper()
	data, err := os.ReadFile(r.log)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		r.t.Fatal(err)
	}
	var calls [][]string
	for _, rec := range strings.Split(string(data), "\036") {
		if rec == "" {
			continue
		}
		calls = append(calls, strings.Split(strings.TrimSuffix(rec, "\037"), "\037"))
	}
	return calls
}

// snapshot is every path under root with its mode and content.
func snapshot(t *testing.T, root string) map[string]string {
	t.Helper()
	snap := map[string]string{}
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(root, path)
		info, err := d.Info()
		if err != nil {
			return err
		}
		v := info.Mode().String()
		if d.Type().IsRegular() {
			b, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			v += " " + string(b)
		}
		snap[rel] = v
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return snap
}

func sameSnapshot(t *testing.T, what string, before, after map[string]string) {
	t.Helper()
	for k, v := range before {
		if after[k] != v {
			t.Errorf("%s: %s changed: %q → %q", what, k, v, after[k])
		}
	}
	for k := range after {
		if _, ok := before[k]; !ok {
			t.Errorf("%s: %s appeared", what, k)
		}
	}
}

func (r *rig) appload() string  { return filepath.Join(r.tablet, "xovi/exthome/appload/estante") }
func (r *rig) previous() string { return filepath.Join(r.tablet, "xovi/exthome/estante.previous") }

// checkFolder pins dir to hold files byte for byte, backend/entry executable.
func checkFolder(t *testing.T, dir string, files map[string]string) {
	t.Helper()
	got := map[string]string{}
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(dir, path)
		b, err := os.ReadFile(path)
		got[filepath.ToSlash(rel)] = string(b)
		return err
	})
	if err != nil {
		t.Fatalf("%s: %v", dir, err)
	}
	if len(got) != len(files) {
		t.Errorf("%s holds %d files, want %d: %v", dir, len(got), len(files), got)
	}
	for name, want := range files {
		if got[name] != want {
			t.Errorf("%s/%s = %q, want %q", dir, name, got[name], want)
		}
	}
	info, err := os.Stat(filepath.Join(dir, "backend/entry"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm()&0o111 == 0 {
		t.Errorf("%s/backend/entry is %v, not executable", dir, info.Mode())
	}
}

// Design §2.1 step 4 (`uname -m`: armv7l for the rM2, aarch64 for the Paper
// Pro) and §2 (the platform table).
func TestInstallArchFromUname(t *testing.T) {
	for _, tc := range []struct{ uname, arch string }{{"armv7l", "armv7"}, {"aarch64", "arm64"}} {
		t.Run(tc.uname, func(t *testing.T) {
			r := newRig(t, newSite(t, nil))
			r.env["FAKE_UNAME"] = tc.uname
			out, ok := r.run()
			if !ok {
				t.Fatalf("install.sh failed:\n%s", out)
			}
			marker, err := os.ReadFile(filepath.Join(r.appload(), "arch.txt"))
			if err != nil {
				t.Fatal(err)
			}
			if string(marker) != tc.arch+" new\n" {
				t.Errorf("installed marker %q, want the %s folder", marker, tc.arch)
			}
			if !strings.Contains(out, tc.arch) || !strings.Contains(out, "0a1b2c3d4e5f") {
				t.Errorf("output does not name the architecture and the version:\n%s", out)
			}
			if !strings.Contains(out, "Reload") {
				t.Errorf("output does not name the next step (Reload):\n%s", out)
			}
		})
	}
	t.Run("x86_64", func(t *testing.T) {
		s := newSite(t, nil)
		r := newRig(t, s)
		r.env["FAKE_UNAME"] = "x86_64"
		before := snapshot(t, r.tablet)
		out, ok := r.run()
		if ok {
			t.Fatalf("install.sh succeeded on an x86_64 tablet:\n%s", out)
		}
		if !strings.Contains(out, "x86_64") {
			t.Errorf("the refusal does not name the machine:\n%s", out)
		}
		if n := s.requests.Load(); n != 0 {
			t.Errorf("%d requests to the site, want none", n)
		}
		sameSnapshot(t, "tablet", before, snapshot(t, r.tablet))
	})
}

// Design §2.1 step 4 and §2 (the AppLoad folder is
// /home/root/xovi/exthome/appload/<app>/).
func TestInstallCopiesToAppLoad(t *testing.T) {
	r := newRig(t, newSite(t, nil))
	out, ok := r.run()
	if !ok {
		t.Fatalf("install.sh failed:\n%s", out)
	}
	checkFolder(t, r.appload(), folderFiles("armv7", "new"))
	if _, err := os.Stat(filepath.Join(r.tablet, "xovi/exthome/estante.new")); !os.IsNotExist(err) {
		t.Errorf("estante.new is left behind (%v)", err)
	}
	if _, err := os.Stat(r.previous()); !os.IsNotExist(err) {
		t.Errorf("estante.previous exists with no previous install (%v)", err)
	}
	if !strings.Contains(out, "no previous install") {
		t.Errorf("output does not say there was no previous install:\n%s", out)
	}
	entries, err := os.ReadDir(r.tmp)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Errorf("the script left its temporary directory behind: %v", entries)
	}
}

// Edited design §2.1 step 4 (the previous install kept at
// /home/root/xovi/exthome/estante.previous/, outside AppLoad's directory) and
// §5.4 (the reader's state survives an install).
func TestInstallKeepsPrevious(t *testing.T) {
	r := newRig(t, newSite(t, nil))
	older := folderFiles("armv7", "older")
	putFolder(t, r.appload(), older)
	putFolder(t, r.previous(), folderFiles("armv7", "oldest"))
	state := snapshot(t, filepath.Join(r.tablet, ".local/share/estante"))

	out, ok := r.run()
	if !ok {
		t.Fatalf("install.sh failed:\n%s", out)
	}
	checkFolder(t, r.appload(), folderFiles("armv7", "new"))
	checkFolder(t, r.previous(), older) // and so the oldest is gone
	entries, err := os.ReadDir(filepath.Join(r.tablet, "xovi/exthome/appload"))
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, e := range entries {
		names = append(names, e.Name())
	}
	if strings.Join(names, " ") != "estante other-app" {
		t.Errorf("AppLoad's directory holds %v, want [estante other-app]", names)
	}
	sameSnapshot(t, ".local/share/estante", state, snapshot(t, filepath.Join(r.tablet, ".local/share/estante")))
	if !strings.Contains(out, "estante.previous") {
		t.Errorf("output does not say the previous install was kept:\n%s", out)
	}
}

// Edited design §2.1 step 4: the previous backend is stopped, so the next
// opening starts the new one.
func TestInstallStopsPreviousBackend(t *testing.T) {
	r := newRig(t, newSite(t, nil))
	putFolder(t, r.appload(), folderFiles("armv7", "older"))
	sleep, err := exec.LookPath("sleep")
	if err != nil {
		t.Fatalf("the test needs sleep on the host: %v", err)
	}
	sleep, err = filepath.EvalSymlinks(sleep)
	if err != nil {
		t.Fatal(err)
	}
	bin, err := os.ReadFile(sleep)
	if err != nil {
		t.Fatal(err)
	}
	entry := filepath.Join(r.appload(), "backend/entry")
	write(t, entry, string(bin), 0o755)
	backend := exec.Command(entry, "600")
	if err := backend.Start(); err != nil {
		t.Fatal(err)
	}
	exited := make(chan error, 1)
	go func() { exited <- backend.Wait() }()
	t.Cleanup(func() { backend.Process.Kill() })

	out, ok := r.run()
	if !ok {
		t.Fatalf("install.sh failed:\n%s", out)
	}
	select {
	case <-exited:
	case <-time.After(10 * time.Second):
		t.Fatalf("the previous backend (pid %d) is still running after the install", backend.Process.Pid)
	}
	checkFolder(t, r.appload(), folderFiles("armv7", "new"))
	if _, err := os.Stat(filepath.Join(r.previous(), "backend/entry")); err != nil {
		t.Errorf("the previous backend is not in estante.previous: %v", err)
	}
}

var controlPath = regexp.MustCompile(`^ControlPath=(.+)$`)

// The note's "one SSH connection reused": every ssh and scp shares one
// ControlPath, the first opens the master, the last closes it.
func TestInstallOneConnection(t *testing.T) {
	r := newRig(t, newSite(t, nil))
	putFolder(t, r.appload(), folderFiles("armv7", "older"))
	out, ok := r.run()
	if !ok {
		t.Fatalf("install.sh failed:\n%s", out)
	}
	calls := r.calls()
	if len(calls) < 3 {
		t.Fatalf("%d calls, want at least ssh, scp and ssh -O exit: %q", len(calls), calls)
	}
	var path string
	for i, c := range calls {
		var paths []string
		for j, a := range c {
			if j > 0 && c[j-1] == "-o" {
				if m := controlPath.FindStringSubmatch(a); m != nil {
					paths = append(paths, m[1])
				}
			}
		}
		if len(paths) != 1 {
			t.Errorf("call %d %q carries %d ControlPaths, want 1", i, c, len(paths))
			continue
		}
		if path == "" {
			path = paths[0]
		} else if paths[0] != path {
			t.Errorf("call %d uses ControlPath %s, want %s", i, paths[0], path)
		}
	}
	first := strings.Join(calls[0], " ")
	if calls[0][0] != "ssh" || !strings.Contains(first, "ControlMaster=auto") {
		t.Errorf("the first call %q does not open the master (ControlMaster=auto)", first)
	}
	last := strings.Join(calls[len(calls)-1], " ")
	if calls[len(calls)-1][0] != "ssh" || !strings.Contains(last, "-O exit") {
		t.Errorf("the last call %q does not close the master (-O exit)", last)
	}
	scps := 0
	for _, c := range calls {
		if c[0] == "scp" {
			scps++
		}
	}
	if scps != 1 {
		t.Errorf("%d scp calls, want 1", scps)
	}
}

// AppLoad reads its xovi extension directory but never makes it (xovi's
// getExtensionDirectory only names it), and Vellum's appload package leaves it
// absent: the script makes it. With AppLoad not installed yet (no appload.so
// in extensions.d) it still installs, and says AppLoad is missing.
func TestInstallAppLoadDirectory(t *testing.T) {
	for _, tc := range []struct {
		name    string
		appload bool
	}{
		{"AppLoad installed, its directory absent", true},
		{"AppLoad not installed yet", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := newRig(t, newSite(t, nil))
			if err := os.RemoveAll(filepath.Join(r.tablet, "xovi/exthome/appload")); err != nil {
				t.Fatal(err)
			}
			if !tc.appload {
				if err := os.Remove(filepath.Join(r.tablet, "xovi/extensions.d/appload.so")); err != nil {
					t.Fatal(err)
				}
			}
			out, ok := r.run()
			if !ok {
				t.Fatalf("install.sh failed:\n%s", out)
			}
			checkFolder(t, r.appload(), folderFiles("armv7", "new"))
			warned := strings.Contains(out, "AppLoad is not installed") && strings.Contains(out, "INSTALL.md step 3")
			if warned == tc.appload {
				t.Errorf("AppLoad installed %v, but the warning shown is %v:\n%s", tc.appload, warned, out)
			}
		})
	}
}

// goEnv passes the host's Go caches and toolchain choice to a rig whose HOME
// is its own, so a build reuses what the host (or the gate) already built and
// downloaded instead of starting cold.
func (r *rig) goEnv() {
	r.t.Helper()
	out, err := exec.Command("go", "env", "-json", "GOCACHE", "GOMODCACHE", "GOPATH", "GOTOOLCHAIN", "GOPROXY", "GOFLAGS").Output()
	if err != nil {
		r.t.Fatalf("go env: %v", err)
	}
	var env map[string]string
	if err := json.Unmarshal(out, &env); err != nil {
		r.t.Fatal(err)
	}
	for k, v := range env {
		if v != "" {
			r.env[k] = v
		}
	}
}

// checkBuiltEntry pins backend/entry in dir to be the backend built here: an
// ELF for machine, executable, linked with its version and self-update off.
func checkBuiltEntry(t *testing.T, dir string, machine elf.Machine, version string) {
	t.Helper()
	entry := filepath.Join(dir, "backend/entry")
	f, err := elf.Open(entry)
	if err != nil {
		t.Fatalf("backend/entry is not the built ELF: %v", err)
	}
	defer f.Close()
	if f.Machine != machine {
		t.Errorf("backend/entry is for %v, want %v", f.Machine, machine)
	}
	for name, want := range map[string]string{"main.version": version, "main.selfUpdate": "off"} {
		if got := elfString(t, f, name); got != want {
			t.Errorf("backend/entry's %s = %q, want %q", name, got, want)
		}
	}
	st, err := os.Stat(entry)
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm()&0o111 == 0 {
		t.Errorf("backend/entry is %v, not executable", st.Mode())
	}
}

// elfString reads the Go string variable sym of a linked binary — what
// -ldflags -X set it to — from its symbol table and data: a string header
// (pointer, length; words of the binary's class) pointing at the bytes.
func elfString(t *testing.T, f *elf.File, sym string) string {
	t.Helper()
	syms, err := f.Symbols()
	if err != nil {
		t.Fatalf("no symbols: %v", err)
	}
	word := 8
	if f.Class == elf.ELFCLASS32 {
		word = 4
	}
	read := func(addr uint64, n int) []byte {
		for _, sec := range f.Sections {
			if sec.Addr <= addr && addr+uint64(n) <= sec.Addr+sec.Size && sec.Type != elf.SHT_NOBITS {
				b := make([]byte, n)
				if _, err := sec.ReadAt(b, int64(addr-sec.Addr)); err != nil {
					t.Fatalf("read %s: %v", sym, err)
				}
				return b
			}
		}
		t.Fatalf("%s: address %#x is in no section", sym, addr)
		return nil
	}
	uword := func(b []byte) uint64 {
		if word == 4 {
			return uint64(f.ByteOrder.Uint32(b))
		}
		return f.ByteOrder.Uint64(b)
	}
	for _, s := range syms {
		if s.Name == sym {
			hdr := read(s.Value, 2*word)
			ptr, n := uword(hdr[:word]), uword(hdr[word:])
			if n == 0 {
				return ""
			}
			return string(read(ptr, int(n)))
		}
	}
	t.Fatalf("backend/entry has no symbol %s", sym)
	return ""
}

// builtVersion is the backend version install.sh says it built.
func builtVersion(t *testing.T, out string) string {
	t.Helper()
	m := regexp.MustCompile(`Built backend version (\S+), its self-update off\.`).FindStringSubmatch(out)
	if m == nil {
		t.Fatalf("the output does not say which backend version was built:\n%s", out)
	}
	return m[1]
}

// stagedBundle is what the store's bundle/next/ holds on the fake tablet.
func (r *rig) stagedBundle() map[string]string {
	r.t.Helper()
	dir := filepath.Join(r.tablet, ".local/share/estante/bundle/next")
	entries, err := os.ReadDir(dir)
	if err != nil {
		r.t.Fatalf("no bundle staged: %v", err)
	}
	got := map[string]string{}
	for _, e := range entries {
		b, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			r.t.Fatal(err)
		}
		got[e.Name()] = string(b)
	}
	return got
}

// ESTANTE_FROM_SOURCE=1 with ESTANTE_SOURCE_QML=0 and ESTANTE_SOURCE_BUNDLE=0
// builds only the backend, with the real Go, in the site's folder; the
// site's bundle, checked against its manifest, is staged in the store, as
// the backend built here never fetches one.
func TestInstallFromSource(t *testing.T) {
	if _, err := exec.LookPath("go"); err != nil {
		t.Fatal("the install test needs go on the host")
	}
	for _, tc := range []struct {
		uname, arch string
		machine     elf.Machine
	}{
		{"armv7l", "armv7", elf.EM_ARM},
		{"aarch64", "arm64", elf.EM_AARCH64},
	} {
		t.Run(tc.arch, func(t *testing.T) {
			r := newRig(t, newSite(t, nil))
			r.goEnv()
			r.env["FAKE_UNAME"] = tc.uname
			r.env["ESTANTE_FROM_SOURCE"] = "1"
			r.env["ESTANTE_SOURCE_QML"] = "0"
			r.env["ESTANTE_SOURCE_BUNDLE"] = "0"
			out, ok := r.run()
			if !ok {
				t.Fatalf("install.sh failed:\n%s", out)
			}
			checkBuiltEntry(t, r.appload(), tc.machine, builtVersion(t, out))
			site := folderFiles(tc.arch, "new")
			for _, name := range []string{"manifest.json", "icon.png", "resources.rcc", "arch.txt"} {
				b, err := os.ReadFile(filepath.Join(r.appload(), name))
				if err != nil || string(b) != site[name] {
					t.Errorf("%s = %q (%v), want the site's %q", name, b, err, site[name])
				}
			}
			want := map[string]string{"manifest.json": string(r.site.manifest), r.site.bundle: siteBundle}
			if got := r.stagedBundle(); fmt.Sprint(got) != fmt.Sprint(want) {
				t.Errorf("bundle/next holds %v, want the site's manifest and bundle %v", got, want)
			}
			if _, err := os.Stat(filepath.Join(r.appload(), ".bundle-next")); !os.IsNotExist(err) {
				t.Errorf("the bundle was left in the app folder (%v)", err)
			}
		})
	}
}

// fakeRCC stands in for pyside6-rcc as tools/appfolder runs it
// (--binary --compress-algo zlib -o OUT QRC): it writes a fixed OUT.
const fakeRCC = `#!/bin/sh
while [ $# -gt 0 ]; do
	case "$1" in
	-o) out=$2; shift 2 ;;
	*) shift ;;
	esac
done
printf 'rcc built here\n' >"$out"
`

// fakeNPM logs its working directory and argv, and builds nothing: the
// bundle it would build is the checkout's app/dist/device, which the gate
// (and engine's tests) build first.
const fakeNPM = `#!/bin/sh
printf '%s %s\n' "$(pwd)" "$*" >>"$FAKE_NPM_LOG"
`

// ESTANTE_FROM_SOURCE=1 alone builds all three: the folder assembled by
// tools/appfolder with the screens compiled by ESTANTE_RCC and the backend
// built here, and the bundle by npm in app/, staged in the store.
func TestInstallFromSourceAll(t *testing.T) {
	dist := filepath.Join("..", "..", "app", "dist", "device")
	built, _ := filepath.Glob(filepath.Join(dist, "bundle.*.js"))
	if len(built) != 1 {
		t.Fatalf("this test reads the app's device bundle: run npm run build in app/ first (found %v)", built)
	}
	r := newRig(t, newSite(t, nil))
	r.goEnv()
	r.env["ESTANTE_FROM_SOURCE"] = "1"
	rcc := filepath.Join(t.TempDir(), "rcc")
	write(t, rcc, fakeRCC, 0o755)
	r.env["ESTANTE_RCC"] = rcc
	write(t, filepath.Join(r.bin, "npm"), fakeNPM, 0o755)
	npmLog := filepath.Join(t.TempDir(), "npm.log")
	r.env["FAKE_NPM_LOG"] = npmLog
	out, ok := r.run()
	if !ok {
		t.Fatalf("install.sh failed:\n%s", out)
	}
	checkBuiltEntry(t, r.appload(), elf.EM_ARM, builtVersion(t, out))
	if got := readFile(t, filepath.Join(r.appload(), "resources.rcc")); got != "rcc built here\n" {
		t.Errorf("resources.rcc = %q, want the one compiled here", got)
	}
	repoIcon, err := os.ReadFile(filepath.Join("..", "tools", "appfolder", "icon.png"))
	if err == nil && readFile(t, filepath.Join(r.appload(), "icon.png")) != string(repoIcon) {
		t.Error("icon.png is not the checkout's")
	}
	if _, err := os.Stat(filepath.Join(r.appload(), "arch.txt")); !os.IsNotExist(err) {
		t.Errorf("the site's folder is still there (arch.txt: %v)", err)
	}
	want := map[string]string{
		"manifest.json":         readFile(t, filepath.Join(dist, "manifest.json")),
		filepath.Base(built[0]): readFile(t, built[0]),
	}
	if got := r.stagedBundle(); fmt.Sprint(got) != fmt.Sprint(want) {
		t.Errorf("bundle/next does not hold app/dist/device's manifest and bundle")
	}
	app, _ := filepath.Abs(filepath.Join("..", "..", "app"))
	if log := readFile(t, npmLog); !strings.Contains(log, app+" run --silent build:device") {
		t.Errorf("npm was not run as build:device in app/:\n%s", log)
	}
	if !strings.Contains(out, "built here (the backend, the screens, the bundle;") {
		t.Errorf("the output does not say what was built here:\n%s", out)
	}
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// With ESTANTE_SOURCE_BUNDLE=0, a site bundle that does not match its
// manifest is refused before the tablet is touched.
func TestInstallFromSourceRefusesBadBundle(t *testing.T) {
	s := newSite(t, nil)
	s.archives[s.bundle] = []byte("globalThis.tampered = 1;\n")
	r := newRig(t, s)
	r.goEnv()
	r.env["ESTANTE_FROM_SOURCE"] = "1"
	r.env["ESTANTE_SOURCE_QML"] = "0"
	r.env["ESTANTE_SOURCE_BUNDLE"] = "0"
	before := snapshot(t, r.tablet)
	out, ok := r.run()
	if ok || !strings.Contains(out, "does not match") {
		t.Fatalf("install.sh did not refuse the tampered bundle (ok %v):\n%s", ok, out)
	}
	sameSnapshot(t, "tablet", before, snapshot(t, r.tablet))
}

// ESTANTE_FROM_SOURCE refuses, before touching the tablet, with no Go here or
// when the script is not in a checkout.
func TestInstallFromSourceRefuses(t *testing.T) {
	t.Run("no go", func(t *testing.T) {
		r := newRig(t, newSite(t, nil))
		r.env["ESTANTE_FROM_SOURCE"] = "1"
		// A PATH with the stand-ins and the host tools the script runs, no go.
		for _, tool := range []string{"curl", "tar", "sha256sum", "shasum", "cut", "mktemp", "rm", "cat", "tr",
			"grep", "sed", "head", "mkdir", "cp", "chmod", "dirname", "sh"} {
			if p, err := exec.LookPath(tool); err == nil {
				if err := os.Symlink(p, filepath.Join(r.bin, tool)); err != nil {
					t.Fatal(err)
				}
			}
		}
		r.env["PATH"] = r.bin
		before := snapshot(t, r.tablet)
		out, ok := r.run()
		if ok || !strings.Contains(out, "needs Go") {
			t.Errorf("install.sh did not refuse for want of Go (ok %v):\n%s", ok, out)
		}
		sameSnapshot(t, "tablet", before, snapshot(t, r.tablet))
		if calls := r.calls(); len(calls) != 0 {
			t.Errorf("ssh or scp ran: %q", calls)
		}
	})
	t.Run("no npm for the bundle", func(t *testing.T) {
		r := newRig(t, newSite(t, nil))
		r.env["ESTANTE_FROM_SOURCE"] = "1"
		for _, tool := range []string{"go", "curl", "tar", "sha256sum", "shasum", "cut", "mktemp", "rm", "cat", "tr",
			"grep", "sed", "head", "mkdir", "cp", "chmod", "dirname", "sh", "python3"} {
			if p, err := exec.LookPath(tool); err == nil {
				if err := os.Symlink(p, filepath.Join(r.bin, tool)); err != nil {
					t.Fatal(err)
				}
			}
		}
		r.env["PATH"] = r.bin
		out, ok := r.run()
		if ok || !strings.Contains(out, "ESTANTE_SOURCE_BUNDLE=0") {
			t.Errorf("install.sh did not refuse for want of npm (ok %v):\n%s", ok, out)
		}
		if calls := r.calls(); len(calls) != 0 {
			t.Errorf("ssh or scp ran: %q", calls)
		}
	})
	t.Run("ESTANTE_RCC not an executable", func(t *testing.T) {
		r := newRig(t, newSite(t, nil))
		r.env["ESTANTE_FROM_SOURCE"] = "1"
		r.env["ESTANTE_SOURCE_BUNDLE"] = "0"
		r.env["ESTANTE_RCC"] = filepath.Join(t.TempDir(), "no-rcc")
		out, ok := r.run()
		if ok || !strings.Contains(out, "ESTANTE_RCC") {
			t.Errorf("install.sh did not refuse the missing rcc (ok %v):\n%s", ok, out)
		}
		if calls := r.calls(); len(calls) != 0 {
			t.Errorf("ssh or scp ran: %q", calls)
		}
	})
	t.Run("not in a checkout", func(t *testing.T) {
		r := newRig(t, newSite(t, nil))
		r.env["ESTANTE_FROM_SOURCE"] = "1"
		script, err := os.ReadFile("install.sh")
		if err != nil {
			t.Fatal(err)
		}
		r.script = filepath.Join(t.TempDir(), "install.sh")
		write(t, r.script, string(script), 0o755)
		before := snapshot(t, r.tablet)
		out, ok := r.run()
		if ok || !strings.Contains(out, "clone https://github.com/ruoso/estante-de-cifras") {
			t.Errorf("install.sh did not refuse outside a checkout (ok %v):\n%s", ok, out)
		}
		sameSnapshot(t, "tablet", before, snapshot(t, r.tablet))
		if calls := r.calls(); len(calls) != 0 {
			t.Errorf("ssh or scp ran: %q", calls)
		}
	})
}

// payload.md Decision 3: the manifest's folder.<arch>.sha256 lets the script
// check what it got.
func TestInstallRefusesBadHash(t *testing.T) {
	for _, tc := range []struct {
		name string
		edit func(folder map[string]map[string]string)
	}{
		{"wrong sha256", func(f map[string]map[string]string) { f["armv7"]["sha256"] = strings.Repeat("0", 64) }},
		{"archive not named", func(f map[string]map[string]string) { f["armv7"]["path"] = "estante-armv7-old.tar.gz" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := newRig(t, newSite(t, tc.edit))
			putFolder(t, r.appload(), folderFiles("armv7", "older"))
			before := snapshot(t, r.tablet)
			out, ok := r.run()
			if ok {
				t.Fatalf("install.sh accepted the download:\n%s", out)
			}
			if !strings.Contains(out, "does not match") {
				t.Errorf("the refusal does not say the download does not match:\n%s", out)
			}
			sameSnapshot(t, "tablet", before, snapshot(t, r.tablet))
			for _, c := range r.calls() {
				if c[0] == "scp" {
					t.Errorf("scp ran after a refused download: %q", c)
				}
			}
		})
	}
}

// RM_IP is required (Decision 6); RM_USER is the login.
func TestInstallNeedsAddress(t *testing.T) {
	t.Run("no RM_IP", func(t *testing.T) {
		r := newRig(t, newSite(t, nil))
		delete(r.env, "RM_IP")
		out, ok := r.run()
		if ok {
			t.Fatalf("install.sh ran with no RM_IP:\n%s", out)
		}
		if !strings.Contains(out, "RM_IP") || !strings.Contains(out, "10.11.99.1") {
			t.Errorf("the refusal does not name RM_IP and 10.11.99.1 (USB):\n%s", out)
		}
		if calls := r.calls(); len(calls) != 0 {
			t.Errorf("ssh or scp ran with no RM_IP: %q", calls)
		}
	})
	t.Run("RM_USER", func(t *testing.T) {
		r := newRig(t, newSite(t, nil))
		r.env["RM_USER"] = "pianist"
		out, ok := r.run()
		if !ok {
			t.Fatalf("install.sh failed:\n%s", out)
		}
		for _, c := range r.calls() {
			joined := strings.Join(c, " ")
			if !strings.Contains(joined, "pianist@192.0.2.7") {
				t.Errorf("call %q does not log in as pianist@192.0.2.7", joined)
			}
		}
	})
}

// The note's "the guide checked against the script and the design's §2.1":
// the facts a change to the script could invalidate, spelled as it spells
// them.
func TestGuideAgreesWithScript(t *testing.T) {
	guideBytes, err := os.ReadFile("../INSTALL.md")
	if err != nil {
		t.Fatal(err)
	}
	scriptBytes, err := os.ReadFile("install.sh")
	if err != nil {
		t.Fatal(err)
	}
	guide, script := string(guideBytes), string(scriptBytes)

	steps := []string{
		"1. What is needed",
		"2. Reaching the tablet as root",
		"3. Installing xovi and AppLoad",
		"4. Installing the reader",
		"5. Opening and pairing",
		"6. Updating it, and the tablet's own updates",
		"7. When something goes wrong",
	}
	var headings []string
	for _, m := range regexp.MustCompile(`(?m)^## ([0-9]\. .*)$`).FindAllStringSubmatch(guide, -1) {
		headings = append(headings, strings.TrimSpace(m[1]))
	}
	if fmt.Sprint(headings) != fmt.Sprint(steps) {
		t.Errorf("the guide's step headings are\n%q\nwant §2.1's\n%q", headings, steps)
	}
	if !strings.Contains(guide, "](scripts/install.sh)") {
		t.Error("the guide does not link scripts/install.sh")
	}

	for _, v := range []string{"APPLOAD_DIR", "PREVIOUS_DIR"} {
		m := regexp.MustCompile(`(?m)^` + v + `=(\S+)$`).FindStringSubmatch(script)
		if m == nil {
			t.Errorf("install.sh does not set %s", v)
			continue
		}
		if !strings.Contains(guide, m[1]) {
			t.Errorf("the guide does not name %s as the script spells it: %s", v, m[1])
		}
	}
	tmpl := regexp.MustCompile(`ARCHIVE="(estante-\$\{ARCH\}\.tar\.gz)"`).FindStringSubmatch(script)
	if tmpl == nil {
		t.Fatal(`install.sh does not name its archive as ARCHIVE="estante-${ARCH}.tar.gz"`)
	}
	arms := regexp.MustCompile(`(?m)^\s*(armv7l|aarch64)\) ARCH=(\w+) ;;`).FindAllStringSubmatch(script, -1)
	if len(arms) != 2 {
		t.Fatalf("install.sh maps %d machines to an architecture, want armv7l and aarch64", len(arms))
	}
	for _, a := range arms {
		name := strings.Replace(tmpl[1], "${ARCH}", a[2], 1)
		if !strings.Contains(guide, name) {
			t.Errorf("the guide does not name %s (%s)", name, a[1])
		}
		if !strings.Contains(guide, a[1]) {
			t.Errorf("the guide does not name the machine %s", a[1])
		}
	}
	for _, s := range []string{"RM_IP", "10.11.99.1"} {
		if !strings.Contains(script, s) {
			t.Errorf("install.sh does not name %s", s)
		}
	}
	for _, s := range []string{"RM_IP", "RM_USER", "ESTANTE_ORIGIN", "/home/root/.local/share/estante/", "10.11.99.1"} {
		if !strings.Contains(guide, s) {
			t.Errorf("the guide does not name %s", s)
		}
	}
}

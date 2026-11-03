package scripts

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
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
}

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
	m := map[string]any{
		"version": "0a1b2c3d4e5f",
		"hostApi": 1,
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
	cmd := exec.Command("/bin/sh", "install.sh")
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

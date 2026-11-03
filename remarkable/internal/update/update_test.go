package update

// behavior — the self-update from a release (docs/remarkable-reader.md §8):
// an httptest TLS server stands in for GitHub's releases/latest/download (let
// through releaseHost for the test), an AppLoad folder in an exthome under
// t.TempDir(), and the store for the folder's bundle.

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"debug/elf"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	gosync "sync"
	"testing"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/store"
)

// elfFor is a minimal ELF header for arch's machine, which debug/elf opens.
func elfFor(arch string) []byte {
	class, machine := elf.ELFCLASS32, elf.EM_ARM
	if arch == "arm64" {
		class, machine = elf.ELFCLASS64, elf.EM_AARCH64
	}
	hdr := make([]byte, 64)
	copy(hdr, elf.ELFMAG)
	hdr[elf.EI_CLASS] = byte(class)
	hdr[elf.EI_DATA] = byte(elf.ELFDATA2LSB)
	hdr[elf.EI_VERSION] = byte(elf.EV_CURRENT)
	binary.LittleEndian.PutUint16(hdr[16:], uint16(elf.ET_EXEC))
	binary.LittleEndian.PutUint16(hdr[18:], uint16(machine))
	binary.LittleEndian.PutUint32(hdr[20:], uint32(elf.EV_CURRENT))
	if class == elf.ELFCLASS32 {
		binary.LittleEndian.PutUint16(hdr[40:], 52)
	} else {
		binary.LittleEndian.PutUint16(hdr[52:], 64)
	}
	return hdr
}

// folderFiles is an Estante folder of one release: its files under estante/.
func folderFiles(arch, release string) map[string][]byte {
	return map[string][]byte{
		"manifest.json":        []byte(`{"id":"estante","name":"Estante","entry":"/Main.qml"}` + "\n"),
		"icon.png":             []byte("icon"),
		"resources.rcc":        []byte("rcc " + release),
		"backend/entry":        elfFor(arch),
		"bundle/manifest.json": []byte(`{"bundle":{"path":"bundle.00000000.js","sha256":"x"}}`),
	}
}

// archive is files as a .tar.gz rooted at estante/ (tools/payload's), and
// extra entries as given (name → typeflag).
func archive(t *testing.T, files map[string][]byte, extra map[string]byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for _, d := range []string{"estante/", "estante/backend/", "estante/bundle/"} {
		if err := tw.WriteHeader(&tar.Header{Name: d, Typeflag: tar.TypeDir, Mode: 0o755}); err != nil {
			t.Fatal(err)
		}
	}
	for name, data := range files {
		if err := tw.WriteHeader(&tar.Header{Name: "estante/" + name, Typeflag: tar.TypeReg, Mode: 0o644, Size: int64(len(data))}); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	for name, flag := range extra {
		h := &tar.Header{Name: name, Typeflag: flag, Mode: 0o644, Linkname: "/etc/passwd"}
		if err := tw.WriteHeader(h); err != nil {
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

// releases is the stand-in: a manifest and the files it names, and the paths
// asked for.
type releases struct {
	srv   *httptest.Server
	mu    gosync.Mutex
	files map[string][]byte
	asked []string
}

func newReleases(t *testing.T) *releases {
	t.Helper()
	r := &releases{files: map[string][]byte{}}
	r.srv = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		r.mu.Lock()
		r.asked = append(r.asked, req.URL.Path)
		body, ok := r.files[req.URL.Path]
		r.mu.Unlock()
		if req.URL.Path == "/redirect-away" {
			http.Redirect(w, req, "https://example.com/estante-armv7.tar.gz", http.StatusFound)
			return
		}
		if !ok {
			http.NotFound(w, req)
			return
		}
		w.Write(body)
	}))
	t.Cleanup(r.srv.Close)
	host, _ := url.Parse(r.srv.URL)
	saved := releaseHost
	releaseHost = func(u *url.URL) bool { return u.Scheme == "https" && u.Host == host.Host || saved(u) }
	t.Cleanup(func() { releaseHost = saved })
	return r
}

// publish serves release n: its manifest naming arch's folder archive.
func (r *releases) publish(t *testing.T, n int, arch string, folder []byte, sha string) {
	t.Helper()
	if sha == "" {
		sha = hexSum(folder)
	}
	m := Manifest{Release: n, Version: "abc", HostAPI: engine.HostAPI,
		Folder: map[string]File{arch: {Path: "estante-" + arch + ".tar.gz", SHA256: sha}}}
	raw, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.files["/manifest.json"] = raw
	r.files["/estante-"+arch+".tar.gz"] = folder
	r.asked = nil
}

func (r *releases) paths() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.asked...)
}

// installed is an exthome with release "1"'s folder for armv7 installed in
// appload/estante.
func installed(t *testing.T) (app string) {
	t.Helper()
	home := t.TempDir()
	app = filepath.Join(home, "appload", "estante")
	for name, data := range folderFiles("armv7", "1") {
		p := filepath.Join(app, name)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, data, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	return app
}

func (r *releases) updater(app string, own int) *Updater {
	return &Updater{AppDir: app, Release: own, Arch: "armv7", URL: r.srv.URL}
}

func (r *releases) check(t *testing.T, u *Updater) (Result, error) {
	t.Helper()
	return u.Check(context.Background(), r.srv.Client(), nil)
}

func readOr(path string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return "<absent>"
	}
	return string(b)
}

// TestNewerReleaseStagedThenSwapped pins design §8: a release newer than the
// backend's is fetched, checked, staged beside the folder — the folder
// untouched — and swapped in, the folder it replaced kept as previous.
func TestNewerReleaseStagedThenSwapped(t *testing.T) {
	r := newReleases(t)
	app := installed(t)
	r.publish(t, 5, "armv7", archive(t, folderFiles("armv7", "5"), nil), "")
	u := r.updater(app, 1)
	res, err := r.check(t, u)
	if err != nil || res.Staged != 5 {
		t.Fatalf("check: %+v %v, want release 5 staged", res, err)
	}
	if got := readOr(filepath.Join(app, "resources.rcc")); got != "rcc 1" {
		t.Errorf("the folder was changed before the swap: %q", got)
	}
	if !u.Ready() || u.StagedRelease() != 5 {
		t.Errorf("ready %v, staged %d; want release 5 ready", u.Ready(), u.StagedRelease())
	}
	// Staged once: a second check asks for the manifest only.
	r.mu.Lock()
	r.asked = nil
	r.mu.Unlock()
	if res, err := r.check(t, u); err != nil || res.Staged != 0 {
		t.Errorf("second check: %+v %v", res, err)
	}
	if got := r.paths(); len(got) != 1 || got[0] != "/manifest.json" {
		t.Errorf("second check asked for %v, want the manifest only", got)
	}

	if err := u.Swap(); err != nil {
		t.Fatal(err)
	}
	if got := readOr(filepath.Join(app, "resources.rcc")); got != "rcc 5" {
		t.Errorf("after the swap the folder holds %q, want release 5's", got)
	}
	previous := filepath.Join(filepath.Dir(filepath.Dir(app)), "estante.previous")
	if got := readOr(filepath.Join(previous, "resources.rcc")); got != "rcc 1" {
		t.Errorf("the previous folder holds %q, want release 1's", got)
	}
	if fi, err := os.Stat(filepath.Join(app, "backend", "entry")); err != nil || fi.Mode().Perm()&0o111 == 0 {
		t.Errorf("backend/entry after the swap: %v %v, want executable", fi, err)
	}
	if _, err := os.Stat(filepath.Join(app, ".release")); !os.IsNotExist(err) {
		t.Error("the release marker went into the folder")
	}
	if u.Ready() {
		t.Error("still ready after the swap")
	}
}

// TestNotNewerFetchesNothing pins that a release not newer than the
// backend's own is never fetched.
func TestNotNewerFetchesNothing(t *testing.T) {
	for _, own := range []int{5, 6} {
		r := newReleases(t)
		app := installed(t)
		r.publish(t, 5, "armv7", archive(t, folderFiles("armv7", "5"), nil), "")
		u := r.updater(app, own)
		if res, err := r.check(t, u); err != nil || res.Staged != 0 {
			t.Errorf("own %d: %+v %v, want nothing", own, res, err)
		}
		if got := r.paths(); len(got) != 1 {
			t.Errorf("own %d: asked for %v, want the manifest only", own, got)
		}
		if u.Ready() {
			t.Errorf("own %d: ready", own)
		}
	}
}

// TestRefusals pins that nothing is staged from a folder whose SHA-256 is not
// the manifest's, an archive with an entry outside estante/ or a link, a
// backend for another machine, a folder that is not Estante's, or a
// manifest naming no folder for this architecture.
func TestRefusals(t *testing.T) {
	other := folderFiles("armv7", "5")
	other["manifest.json"] = []byte(`{"id":"someone-else"}`)
	for _, tc := range []struct {
		name    string
		arch    string
		archive func(t *testing.T) []byte
		sha     string
		want    error
	}{
		{"a bad hash", "armv7", func(t *testing.T) []byte { return archive(t, folderFiles("armv7", "5"), nil) }, "0000000000000000000000000000000000000000000000000000000000000000", ErrChecksum},
		{"an entry outside", "armv7", func(t *testing.T) []byte {
			return archive(t, folderFiles("armv7", "5"), map[string]byte{"estante/../../escape": tar.TypeReg})
		}, "", ErrFolder},
		{"a link", "armv7", func(t *testing.T) []byte {
			return archive(t, folderFiles("armv7", "5"), map[string]byte{"estante/link": tar.TypeSymlink})
		}, "", ErrFolder},
		{"another machine", "armv7", func(t *testing.T) []byte { return archive(t, folderFiles("arm64", "5"), nil) }, "", ErrFolder},
		{"not Estante's", "armv7", func(t *testing.T) []byte { return archive(t, other, nil) }, "", ErrFolder},
		{"no folder for armv7", "arm64", func(t *testing.T) []byte { return archive(t, folderFiles("arm64", "5"), nil) }, "", ErrManifest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := newReleases(t)
			app := installed(t)
			r.publish(t, 5, tc.arch, tc.archive(t), tc.sha)
			u := r.updater(app, 1)
			_, err := r.check(t, u)
			if !errors.Is(err, tc.want) {
				t.Errorf("check: %v, want %v", err, tc.want)
			}
			if u.Ready() {
				t.Error("staged anyway")
			}
			if _, err := os.Stat(filepath.Join(filepath.Dir(filepath.Dir(app)), "escape")); !os.IsNotExist(err) {
				t.Error("an entry was written outside the folder")
			}
		})
	}
}

// TestNotEstantesFolderNeverChecked pins that an AppLoad folder that is not
// Estante's is never replaced: nothing is even asked for.
func TestNotEstantesFolderNeverChecked(t *testing.T) {
	r := newReleases(t)
	app := installed(t)
	if err := os.WriteFile(filepath.Join(app, "manifest.json"), []byte(`{"id":"someone-else"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	r.publish(t, 5, "armv7", archive(t, folderFiles("armv7", "5"), nil), "")
	if res, err := r.check(t, r.updater(app, 1)); err != nil || res.Staged != 0 {
		t.Errorf("%+v %v", res, err)
	}
	if got := r.paths(); len(got) != 0 {
		t.Errorf("asked for %v, want nothing", got)
	}
}

// TestOffGitHubRefused pins §10: a release is fetched from GitHub only — a
// URL elsewhere is refused, and a redirect off GitHub is not followed.
func TestOffGitHubRefused(t *testing.T) {
	r := newReleases(t)
	app := installed(t)
	u := &Updater{AppDir: app, Release: 1, Arch: "armv7", URL: "https://example.com/releases"}
	if _, err := u.Check(context.Background(), r.srv.Client(), nil); err == nil {
		t.Error("a release URL off GitHub was fetched")
	}
	r.mu.Lock()
	r.files["/manifest.json"], _ = json.Marshal(Manifest{Release: 5,
		Folder: map[string]File{"armv7": {Path: "redirect-away", SHA256: hexSum([]byte("x"))}}})
	r.mu.Unlock()
	if _, err := r.check(t, r.updater(app, 1)); err == nil {
		t.Error("a redirect off GitHub was followed")
	}
}

// TestReleaseHost pins the hosts a release may come from: GitHub's, https.
func TestReleaseHost(t *testing.T) {
	for raw, want := range map[string]bool{
		"https://github.com/ruoso/estante-de-cifras/releases/latest/download/manifest.json": true,
		"https://release-assets.githubusercontent.com/x":                                    true,
		"https://objects.githubusercontent.com/x":                                           true,
		"http://github.com/x":                 false,
		"https://github.com.evil.example/x":   false,
		"https://evilgithubusercontent.com/x": false,
		"https://user@github.com/x":           false,
	} {
		u, err := url.Parse(raw)
		if err != nil {
			t.Fatal(err)
		}
		if got := releaseHost(u); got != want {
			t.Errorf("releaseHost(%s) = %v, want %v", raw, got, want)
		}
	}
}

// --- the folder's bundle (design §8) ---

func newStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return st
}

// bundleFolder is an AppLoad folder whose bundle/ holds code under its hash.
func bundleFolder(t *testing.T, code string) (app, sha string) {
	t.Helper()
	sha = hexSum([]byte(code))
	name := "bundle." + sha[:8] + ".js"
	app = filepath.Join(t.TempDir(), "estante")
	dir := filepath.Join(app, FolderBundle)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	m, _ := json.Marshal(map[string]any{"hostApi": engine.HostAPI, "bundle": map[string]string{"path": name, "sha256": sha}})
	if err := os.WriteFile(filepath.Join(dir, engine.ManifestFile), m, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, name), []byte(code), 0o644); err != nil {
		t.Fatal(err)
	}
	return app, sha
}

// TestAdoptFolderBundle pins design §8: the folder's bundle becomes current at
// once in a store with none; another folder's is staged beside it; the same
// one, or one refused, is not staged again; a folder whose bundle is not its
// manifest's is refused.
func TestAdoptFolderBundle(t *testing.T) {
	st := newStore(t)
	app, sha := bundleFolder(t, "globalThis.a = 1;\n")
	if staged, err := AdoptFolderBundle(st, app); err != nil || !staged {
		t.Fatalf("first: %v %v", staged, err)
	}
	if dir, ok := st.BundleDir(); !ok || BundleSHA(dir) != sha {
		t.Fatalf("current %v %v, want the folder's at once", dir, ok)
	}
	if staged, _ := AdoptFolderBundle(st, app); staged {
		t.Error("the current one was staged again")
	}
	appB, shaB := bundleFolder(t, "globalThis.b = 1;\n")
	if staged, err := AdoptFolderBundle(st, appB); err != nil || !staged {
		t.Fatalf("another: %v %v", staged, err)
	}
	if dir, ok := st.StagedBundleDir(); !ok || BundleSHA(dir) != shaB {
		t.Errorf("staged %v %v, want B", dir, ok)
	}
	if dir, _ := st.BundleDir(); BundleSHA(dir) != sha {
		t.Error("B became current before a switch")
	}
	if staged, _ := AdoptFolderBundle(st, appB); staged {
		t.Error("the staged one was staged again")
	}
	appC, shaC := bundleFolder(t, "globalThis.c = 1;\n")
	if err := st.RefuseBundle(shaC); err != nil {
		t.Fatal(err)
	}
	if staged, _ := AdoptFolderBundle(st, appC); staged {
		t.Error("a refused bundle was staged")
	}
	if err := os.WriteFile(filepath.Join(appC, FolderBundle, "bundle."+shaC[:8]+".js"), []byte("tampered"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := AdoptFolderBundle(newStore(t), appC); !errors.Is(err, ErrChecksum) {
		t.Errorf("a tampered folder bundle: %v, want ErrChecksum", err)
	}
	if staged, err := AdoptFolderBundle(st, t.TempDir()); err != nil || staged {
		t.Errorf("a folder with no bundle: %v %v", staged, err)
	}
}

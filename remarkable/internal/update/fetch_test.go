package update

// unit — fetching from /device/ (reader.self_update constraints 4–6): against
// an httptest site, a body is refused by its hash, its size or its status, a
// manifest that is not JSON is refused, no request carries the session
// cookie, and no redirect is followed off the origin.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	gosync "sync"
	"testing"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/store"
)

// --- the stand-in site ---

type siteRequest struct {
	Path   string
	Cookie bool
}

// site serves /device/<name> from files, records every request, and answers
// a name in redirect with a 302 to its value.
type site struct {
	srv      *httptest.Server
	mu       gosync.Mutex
	files    map[string][]byte
	redirect map[string]string
	requests []siteRequest
}

func newSite(t *testing.T) *site {
	t.Helper()
	s := &site{files: map[string][]byte{}, redirect: map[string]string{}}
	s.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := r.Cookie("estante_session")
		s.mu.Lock()
		s.requests = append(s.requests, siteRequest{Path: r.URL.Path, Cookie: err == nil || r.Header.Get("Cookie") != ""})
		name := strings.TrimPrefix(r.URL.Path, "/device/")
		body, ok := s.files[name]
		to, moved := s.redirect[name]
		s.mu.Unlock()
		switch {
		case moved:
			http.Redirect(w, r, to, http.StatusFound)
		case !strings.HasPrefix(r.URL.Path, "/device/") || !ok:
			http.NotFound(w, r)
		default:
			w.Write(body)
		}
	}))
	t.Cleanup(s.srv.Close)
	return s
}

func (s *site) origin(t *testing.T) *url.URL {
	t.Helper()
	u, err := url.Parse(s.srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	return u
}

func (s *site) paths() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []string
	for _, r := range s.requests {
		out = append(out, r.Path)
	}
	return out
}

func (s *site) reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.requests = nil
}

func hexOf(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// served is a payload: the bundle and the rcc, named by their hashes, and the
// manifest naming them as the site's does (with the parts never fetched).
type served struct {
	manifest []byte
	bundle   File
	qml      File
}

// serve puts a payload of bundle and rcc on the site under hostApi.
func (s *site) serve(t *testing.T, hostAPI int, bundle, rcc []byte) served {
	t.Helper()
	p := served{
		bundle: File{Path: "bundle." + hexOf(bundle)[:8] + ".js", SHA256: hexOf(bundle)},
		qml:    File{Path: "resources." + hexOf(rcc)[:8] + ".rcc", SHA256: hexOf(rcc)},
	}
	raw, err := json.Marshal(map[string]any{
		"version": "test", "hostApi": hostAPI, "salt": "defaults-1",
		"bundle": p.bundle, "qml": p.qml,
		"backend": map[string]any{}, "folder": map[string]any{},
	})
	if err != nil {
		t.Fatal(err)
	}
	p.manifest = raw
	s.mu.Lock()
	defer s.mu.Unlock()
	s.files["manifest.json"] = raw
	s.files[p.bundle.Path] = bundle
	s.files[p.qml.Path] = rcc
	return p
}

// setFile replaces what the site answers for name.
func (s *site) setFile(name string, body []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.files[name] = body
}

func (s *site) remove(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.files, name)
}

// --- the reader's side ---

func newTestStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "estante"))
	if err != nil {
		t.Fatal(err)
	}
	return st
}

// appFolder is an AppLoad folder stand-in: manifest.json with id, and an old
// resources.rcc.
func appFolder(t *testing.T, id string) string {
	t.Helper()
	dir := t.TempDir()
	raw, _ := json.Marshal(map[string]any{"id": id, "name": "Estante", "entry": "/Main.qml", "loadsBackend": true})
	if err := os.WriteFile(filepath.Join(dir, "manifest.json"), raw, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "resources.rcc"), []byte("old rcc"), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

func readOr(path string) string {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "<absent>"
	}
	return string(raw)
}

func staged(st *store.Store) bool {
	_, ok := st.StagedBundleDir()
	return ok
}

// fixture is a site serving a payload, a store and an Estante folder.
type fixture struct {
	site *site
	p    served
	st   *store.Store
	app  string
	u    *Updater
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	f := &fixture{site: newSite(t), st: newTestStore(t), app: appFolder(t, "estante")}
	f.p = f.site.serve(t, engine.HostAPI, []byte("globalThis.x = 1;\n"), []byte("new rcc"))
	f.u = &Updater{Store: f.st, AppDir: f.app}
	return f
}

func (f *fixture) check(t *testing.T) (Result, error) {
	t.Helper()
	return f.u.Check(context.Background(), f.site.srv.Client(), f.site.origin(t))
}

// untouched fails unless nothing was staged and the folder is as it was.
func (f *fixture) untouched(t *testing.T) {
	t.Helper()
	if staged(f.st) {
		t.Error("bundle/next was staged")
	}
	if got := readOr(filepath.Join(f.app, "resources.rcc")); got != "old rcc" {
		t.Errorf("the folder's resources.rcc is %q, want the old one", got)
	}
	if got := readOr(f.st.PreviousQML()); got != "<absent>" {
		t.Errorf("qml/previous holds %q, want nothing", got)
	}
}

// --- the tests ---

// TestBadHashRefused pins constraint 5: a body one byte off is ErrChecksum,
// and bundle/next and the folder are untouched; a bad hash is not refused for
// good — the next check fetches it again.
func TestBadHashRefused(t *testing.T) {
	f := newFixture(t)
	f.site.setFile(f.p.bundle.Path, []byte("globalThis.x = 2;\n"))
	f.site.setFile(f.p.qml.Path, []byte("new rcd"))
	_, err := f.check(t)
	if !errors.Is(err, ErrChecksum) {
		t.Fatalf("check: %v, want ErrChecksum", err)
	}
	if strings.Contains(err.Error(), f.site.srv.URL) {
		t.Errorf("error %q names the origin", err)
	}
	f.untouched(t)
	if got := f.st.Refused(); len(got) != 0 {
		t.Errorf("a bad hash refused %v for good", got)
	}
	f.site.reset()
	f.check(t)
	if got := f.site.paths(); len(got) != 3 {
		t.Errorf("the next check requested %v, want the manifest and both files again", got)
	}
}

// TestOverTheLimitRefused pins constraint 4: a body over its limit is refused.
func TestOverTheLimitRefused(t *testing.T) {
	saved := maxFile
	maxFile = 4
	t.Cleanup(func() { maxFile = saved })
	f := newFixture(t)
	if _, err := f.check(t); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("check: %v, want ErrTooLarge", err)
	}
	f.untouched(t)
}

// TestManifestOverTheLimitRefused pins constraint 4: the manifest at most
// 64 KiB.
func TestManifestOverTheLimitRefused(t *testing.T) {
	f := newFixture(t)
	f.site.setFile("manifest.json", []byte(`{"pad":"`+strings.Repeat("x", 64<<10)+`"}`))
	if _, err := f.check(t); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("check: %v, want ErrTooLarge", err)
	}
	f.untouched(t)
}

// TestNotFoundRefused pins constraint 4: only a 200 is accepted.
func TestNotFoundRefused(t *testing.T) {
	f := newFixture(t)
	f.site.remove(f.p.bundle.Path)
	f.site.remove(f.p.qml.Path)
	if _, err := f.check(t); !errors.Is(err, ErrStatus) {
		t.Fatalf("check: %v, want ErrStatus", err)
	}
	f.untouched(t)

	f.site.remove("manifest.json")
	if _, err := f.check(t); !errors.Is(err, ErrStatus) {
		t.Fatalf("check without a manifest: %v, want ErrStatus", err)
	}
}

// TestManifestNotJSONRefused pins constraint 4: a manifest that is not JSON
// is ErrManifest, and nothing else is requested.
func TestManifestNotJSONRefused(t *testing.T) {
	f := newFixture(t)
	f.site.setFile("manifest.json", []byte("<html>the shell</html>"))
	if _, err := f.check(t); !errors.Is(err, ErrManifest) {
		t.Fatalf("check: %v, want ErrManifest", err)
	}
	f.untouched(t)
	if got := f.site.paths(); len(got) != 1 {
		t.Errorf("requested %v, want the manifest only", got)
	}
}

// TestNoSessionCookie pins constraint 6 (design §10): /device/ is public, so
// no request carries the session cookie — not even from a client whose jar
// holds it for the origin.
func TestNoSessionCookie(t *testing.T) {
	f := newFixture(t)
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	origin := f.site.origin(t)
	jar.SetCookies(origin, []*http.Cookie{{Name: "estante_session", Value: "tok-secret", Path: "/"}})
	client := f.site.srv.Client()
	client.Jar = jar
	if _, err := f.u.Check(context.Background(), client, origin); err != nil {
		t.Fatal(err)
	}
	if len(f.site.requests) != 3 {
		t.Errorf("requests %v, want the manifest and both files", f.site.paths())
	}
	for _, r := range f.site.requests {
		if !strings.HasPrefix(r.Path, "/device/") {
			t.Errorf("a request off /device/: %s", r.Path)
		}
		if r.Cookie {
			t.Errorf("%s carried the session cookie", r.Path)
		}
	}
	if client.Jar != jar {
		t.Error("the caller's client was changed")
	}
}

// TestRedirectOffOriginNotFollowed pins constraint 6: a redirect to another
// host is not followed, and nothing is kept.
func TestRedirectOffOriginNotFollowed(t *testing.T) {
	f := newFixture(t)
	other := newSite(t)
	other.serve(t, engine.HostAPI, []byte("globalThis.x = 1;\n"), []byte("new rcc"))
	f.site.mu.Lock()
	f.site.redirect["manifest.json"] = other.srv.URL + "/device/manifest.json"
	f.site.mu.Unlock()
	if _, err := f.check(t); err == nil {
		t.Fatal("a redirect off the origin was followed")
	}
	if got := other.paths(); len(got) != 0 {
		t.Errorf("the other host was asked %v", got)
	}
	f.untouched(t)
}

package backend

// behavior — switching to a staged bundle (reader.self_update constraint 9,
// Decisions 3 and 5; docs/remarkable-reader.md §8; workflow 19 rule 5),
// through the socket peer with the built bundle (app/dist/device; a missing
// build fails, never skips — engine.md Decision 8). Bundle A is the built
// one; B is A with a trailing comment and its SHA-256 recomputed; the broken
// one is `throw new Error("broken")`; the one whose instrument does not load
// is A with an estante whose load throws.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	gosync "sync"
	"testing"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/protocol"
	"estantedecifras.app/remarkable/internal/store"
	"estantedecifras.app/remarkable/internal/sync"
	"estantedecifras.app/remarkable/internal/update"
)

// testBundle is a bundle directory's files and the manifest's bytes and
// bundle SHA-256.
type testBundle struct {
	files    map[string][]byte
	manifest []byte
	sha      string
}

// makeBundle names code by its hash under the built bundle's hostApi and salt.
func makeBundle(t *testing.T, code []byte) testBundle {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(bundleDir, engine.ManifestFile))
	if err != nil {
		t.Fatalf("%v — run npm run build in app/", err)
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(code)
	sha := hex.EncodeToString(sum[:])
	name := "bundle." + sha[:8] + ".js"
	m["bundle"] = map[string]any{"path": name, "sha256": sha}
	mraw, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	return testBundle{files: map[string][]byte{engine.ManifestFile: mraw, name: code}, manifest: mraw, sha: sha}
}

// builtCode is the built bundle's code.
func builtCode(t *testing.T) []byte {
	t.Helper()
	var m engine.Manifest
	raw, err := os.ReadFile(filepath.Join(bundleDir, engine.ManifestFile))
	if err != nil {
		t.Fatalf("%v — run npm run build in app/", err)
	}
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	code, err := os.ReadFile(filepath.Join(bundleDir, m.Bundle.Path))
	if err != nil {
		t.Fatalf("%v — run npm run build in app/", err)
	}
	return code
}

func bundleA(t *testing.T) testBundle { return makeBundle(t, builtCode(t)) }
func bundleB(t *testing.T) testBundle {
	return makeBundle(t, append(builtCode(t), []byte("\n// bundle B\n")...))
}
func brokenBundle(t *testing.T) testBundle {
	return makeBundle(t, []byte(`throw new Error("broken");`))
}

// noLoadBundle evaluates, but the instrument cannot load in it.
func noLoadBundle(t *testing.T) testBundle {
	return makeBundle(t, append(builtCode(t), []byte(
		"\nglobalThis.estante = Object.assign({}, globalThis.estante, "+
			"{ load() { throw new Error(\"no load\"); } });\n")...))
}

func stage(t *testing.T, st *store.Store, b testBundle) {
	t.Helper()
	if err := st.StageBundle(b.files); err != nil {
		t.Fatal(err)
	}
}

// installed stages b and promotes it, and opens it with the example book's
// instrument loaded — the bundle the backend runs.
func installed(t *testing.T, st *store.Store, b testBundle) *engine.Engine {
	t.Helper()
	stage(t, st, b)
	if err := st.PromoteBundle(); err != nil {
		t.Fatal(err)
	}
	dir, _ := st.BundleDir()
	e, err := engine.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { e.Close() })
	raw, err := os.ReadFile(fixtureFile)
	if err != nil {
		t.Fatalf("%v — run npm run build in app/", err)
	}
	var fx struct {
		Entry json.RawMessage `json:"entry"`
		Table json.RawMessage `json:"table"`
	}
	if err := json.Unmarshal(raw, &fx); err != nil {
		t.Fatal(err)
	}
	if _, err := e.Load(context.Background(), fx.Entry, fx.Table); err != nil {
		t.Fatal(err)
	}
	return e
}

func currentSHA(t *testing.T, st *store.Store) string {
	t.Helper()
	dir, ok := st.BundleDir()
	if !ok {
		return ""
	}
	return update.BundleSHA(dir)
}

// attachThenHello sends −2 and a hello, and fails unless the very next
// message is the state answering the hello: the switch sends nothing, so the
// sheet on screen is not redrawn by it (workflow 19 rule 5).
func (s *viewsServe) attachThenHello(t *testing.T) {
	t.Helper()
	s.peer.send(protocol.TypeAttached, "1")
	s.peer.send(protocol.TypeHello, "{}")
	s.peer.state()
}

// TestSwitchedOnAttach pins constraint 9 and design §8: with A current and B
// staged, a song opens on A; after −2, bundle/current is B, the song opens on
// B, A is closed, and nothing was sent between −2 and the hello's state.
func TestSwitchedOnAttach(t *testing.T) {
	f := newViewsFixture(t)
	a, b := bundleA(t), bundleB(t)
	engA := installed(t, f.st, a)
	stage(t, f.st, b)
	s := f.serve(t, engA)
	s.openSong(t, ferry, nil)

	s.attachThenHello(t)
	if got := currentSHA(t, f.st); got != b.sha {
		t.Errorf("current %s, want B %s", got, b.sha)
	}
	if _, staged := f.st.StagedBundleDir(); staged {
		t.Error("B is still staged")
	}
	sheet := s.openSong(t, ferry, nil)
	if sheet.Path != ferry {
		t.Errorf("sheet for %q", sheet.Path)
	}
	s.syncer.mu.Lock()
	uses, adopted := s.syncer.useEngines, s.syncer.engine
	s.syncer.mu.Unlock()
	if uses != 1 || adopted == nil {
		t.Errorf("the syncer was handed %d engines (%v), want B once", uses, adopted)
	}
	if _, err := engA.Held(context.Background()); !errors.Is(err, engine.ErrClosed) {
		t.Errorf("A after the switch: %v, want closed", err)
	}
	if got := f.st.Refused(); len(got) != 0 {
		t.Errorf("refused %v after a good switch", got)
	}
}

// rolledBack runs the switch on attach with A current and bad staged, and
// checks the reader went on with A, a song opening, bad refused.
func rolledBack(t *testing.T, bad testBundle) *viewsFixture {
	t.Helper()
	f := newViewsFixture(t)
	a := bundleA(t)
	engA := installed(t, f.st, a)
	stage(t, f.st, bad)
	s := f.serve(t, engA)
	s.openSong(t, ferry, nil)

	s.attachThenHello(t)
	if got := currentSHA(t, f.st); got != a.sha {
		t.Errorf("current %s, want A %s again", got, a.sha)
	}
	if _, staged := f.st.StagedBundleDir(); staged {
		t.Error("the bad bundle is still staged")
	}
	if !slices.Contains(f.st.Refused(), bad.sha) {
		t.Errorf("refused %v, want the bad %s", f.st.Refused(), bad.sha)
	}
	if sheet := s.openSong(t, ferry, nil); sheet.Path != ferry {
		t.Errorf("sheet for %q", sheet.Path)
	}
	if _, err := engA.Held(context.Background()); err != nil {
		t.Errorf("A after the rollback: %v, want it running", err)
	}
	return f
}

// deviceSite is a stand-in site serving b on /device/, recording the paths
// asked for.
func deviceSite(t *testing.T, b testBundle) (*httptest.Server, func() []string) {
	t.Helper()
	var mu gosync.Mutex
	var paths []string
	var bundlePath string
	for name := range b.files {
		if name != engine.ManifestFile {
			bundlePath = name
		}
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		paths = append(paths, r.URL.Path)
		mu.Unlock()
		switch r.URL.Path {
		case "/device/manifest.json":
			w.Write(b.manifest)
		case "/device/" + bundlePath:
			w.Write(b.files[bundlePath])
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv, func() []string {
		mu.Lock()
		defer mu.Unlock()
		return slices.Clone(paths)
	}
}

// TestBrokenBundleRolledBack pins constraint 9 and Decision 4: a bundle that
// throws on evaluation is rolled back to the last good one, and the next
// check does not fetch it again.
func TestBrokenBundleRolledBack(t *testing.T) {
	broken := brokenBundle(t)
	f := rolledBack(t, broken)

	srv, paths := deviceSite(t, broken)
	origin, _ := url.Parse(srv.URL)
	u := &update.Updater{Store: f.st}
	// The stand-in serves no QML, which the check refuses by its name; the
	// bundle is what is asked about.
	u.Check(context.Background(), srv.Client(), origin)
	if got := paths(); !slices.Contains(got, "/device/manifest.json") {
		t.Errorf("the check asked for %v, want the manifest", got)
	}
	for _, p := range paths() {
		if strings.HasPrefix(p, "/device/bundle.") {
			t.Errorf("the refused bundle was fetched again: %s", p)
		}
	}
	if _, staged := f.st.StagedBundleDir(); staged {
		t.Error("the refused bundle was staged again")
	}
}

// TestInstrumentNotLoadingRolledBack pins Decision 3: a bundle in which the
// instrument does not load cannot draw a song, and is rolled back the same
// way.
func TestInstrumentNotLoadingRolledBack(t *testing.T) {
	rolledBack(t, noLoadBundle(t))
}

// TestFirstBundleSwitchedAtPassEnd pins Decision 5: with no bundle loaded, a
// staged one is switched at the end of the pass, without an attach.
func TestFirstBundleSwitchedAtPassEnd(t *testing.T) {
	f := newViewsFixture(t)
	a := bundleA(t)
	s := f.serve(t, nil)
	stage(t, f.st, a)

	s.relay.StatusFunc()(sync.Status{Online: true})
	s.peer.state() // the pass's end, as the shelf's line
	waitUntil(t, "the switch", func() bool {
		s.syncer.mu.Lock()
		defer s.syncer.mu.Unlock()
		return s.syncer.engine != nil
	})
	if got := currentSHA(t, f.st); got != a.sha {
		t.Errorf("current %s, want A %s", got, a.sha)
	}
	if sheet := s.openSong(t, ferry, nil); sheet.Path != ferry {
		t.Errorf("sheet for %q", sheet.Path)
	}
}

// TestNoSwitchAtPassEndWithAnEngine pins constraint 1: with an engine
// loaded, the end of a pass switches nothing — only an attach does.
func TestNoSwitchAtPassEndWithAnEngine(t *testing.T) {
	f := newViewsFixture(t)
	a, b := bundleA(t), bundleB(t)
	engA := installed(t, f.st, a)
	stage(t, f.st, b)
	s := f.serve(t, engA)

	s.relay.StatusFunc()(sync.Status{Online: true})
	s.peer.state()
	s.openSong(t, ferry, nil) // the loop has read the pass's end by now
	if got := currentSHA(t, f.st); got != a.sha {
		t.Errorf("current %s, want A until an attach", got)
	}
	if _, staged := f.st.StagedBundleDir(); !staged {
		t.Error("B is no longer staged")
	}
}

// TestSettingsUpdateReader pins design §6 107 and §8 *Too old*: updateReader
// is true when the site served a hostApi newer than the backend's, false
// otherwise.
func TestSettingsUpdateReader(t *testing.T) {
	for _, tc := range []struct {
		served int
		want   bool
	}{{0, false}, {engine.HostAPI - 1, false}, {engine.HostAPI, false}, {engine.HostAPI + 1, true}} {
		f := newViewsFixture(t)
		if tc.served != 0 {
			must(t, f.st.SetServedHostAPI(tc.served))
		}
		s := f.serve(t, builtEngine(t))
		s.send(t, protocol.TypeOpen, map[string]any{"view": "settings"})
		var got protocol.Settings
		s.expect(t, protocol.TypeSettings, &got)
		if got.UpdateReader != tc.want {
			t.Errorf("served hostApi %d: updateReader %v, want %v", tc.served, got.UpdateReader, tc.want)
		}
		s.stop()
	}
}

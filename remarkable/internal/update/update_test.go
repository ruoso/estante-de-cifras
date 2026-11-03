package update

// behavior — the check a pass ends with (reader.self_update;
// docs/remarkable-reader.md §8): an httptest site serving
// /device/manifest.json and its files, the store under t.TempDir(), and an
// AppLoad folder stand-in.

import (
	"os"
	"path/filepath"
	"slices"
	"testing"

	"estantedecifras.app/remarkable/internal/engine"
)

// TestUpdateFetched pins design §8's bundle and QML bullets: the bundle staged
// beside the served manifest as it was served, the rcc placed in the folder
// with the old one kept in qml/previous/; a second check asks for the manifest
// only.
func TestUpdateFetched(t *testing.T) {
	f := newFixture(t)
	res, err := f.check(t)
	if err != nil {
		t.Fatal(err)
	}
	if res.Bundle != f.p.bundle.SHA256 || res.QML != f.p.qml.SHA256 || res.TooOld {
		t.Errorf("result %+v", res)
	}
	dir, ok := f.st.StagedBundleDir()
	if !ok {
		t.Fatal("nothing staged")
	}
	if got := readOr(filepath.Join(dir, engine.ManifestFile)); got != string(f.p.manifest) {
		t.Errorf("staged manifest %q, want the served bytes %q", got, f.p.manifest)
	}
	if got := readOr(filepath.Join(dir, f.p.bundle.Path)); got != "globalThis.x = 1;\n" {
		t.Errorf("staged bundle %q", got)
	}
	if got := readOr(filepath.Join(f.app, "resources.rcc")); got != "new rcc" {
		t.Errorf("the folder's resources.rcc %q, want the served one", got)
	}
	if got := readOr(f.st.PreviousQML()); got != "old rcc" {
		t.Errorf("qml/previous %q, want the old one", got)
	}
	if got := readOr(filepath.Join(f.app, "manifest.json")); got == "<absent>" {
		t.Error("the folder's manifest.json went")
	}
	entries, _ := os.ReadDir(f.app)
	if len(entries) != 2 {
		t.Errorf("the folder holds %d entries, want manifest.json and resources.rcc", len(entries))
	}
	if got := f.st.ServedHostAPI(); got != engine.HostAPI {
		t.Errorf("served hostApi %d, want %d", got, engine.HostAPI)
	}

	f.site.reset()
	if _, err := f.check(t); err != nil {
		t.Fatal(err)
	}
	if got := f.site.paths(); !slices.Equal(got, []string{"/device/manifest.json"}) {
		t.Errorf("a second check requested %v, want the manifest only", got)
	}
}

// TestNotEstantesFolderNeverWritten pins Decision 7: a folder whose
// manifest.json is not Estante's is never written; the bundle still comes.
func TestNotEstantesFolderNeverWritten(t *testing.T) {
	f := newFixture(t)
	f.app = appFolder(t, "someone-else")
	f.u.AppDir = f.app
	if _, err := f.check(t); err != nil {
		t.Fatal(err)
	}
	if got := readOr(filepath.Join(f.app, "resources.rcc")); got != "old rcc" {
		t.Errorf("another app's resources.rcc became %q", got)
	}
	if got := readOr(f.st.PreviousQML()); got != "<absent>" {
		t.Errorf("qml/previous holds %q", got)
	}
	if !staged(f.st) {
		t.Error("the bundle was not staged")
	}
	for _, p := range f.site.paths() {
		if p == "/device/"+f.p.qml.Path {
			t.Error("the qml was fetched for a folder that is not Estante's")
		}
	}
}

// TestTooNew pins design §8 *Too old*: a served hostApi newer than the
// backend's stages and places nothing, and is remembered for the settings.
func TestTooNew(t *testing.T) {
	f := newFixture(t)
	f.site.serve(t, engine.HostAPI+1, []byte("globalThis.x = 3;\n"), []byte("newer rcc"))
	res, err := f.check(t)
	if err != nil {
		t.Fatal(err)
	}
	if !res.TooOld || res.Bundle != "" || res.QML != "" {
		t.Errorf("result %+v, want too old and nothing fetched", res)
	}
	f.untouched(t)
	if got := f.st.ServedHostAPI(); got != engine.HostAPI+1 {
		t.Errorf("served hostApi %d, want %d", got, engine.HostAPI+1)
	}
	if got := f.site.paths(); len(got) != 1 {
		t.Errorf("requested %v, want the manifest only", got)
	}
}

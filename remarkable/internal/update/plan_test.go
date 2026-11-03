package update

// unit — what to fetch (reader.self_update constraints 2–4;
// docs/remarkable-reader.md §8): a pure choice over the served manifest and
// what the reader has.

import (
	"errors"
	"strings"
	"testing"

	"estantedecifras.app/remarkable/internal/engine"
)

func sha(c byte) string { return strings.Repeat(string(c), 64) }

func bundleFile(c byte) File { return File{Path: "bundle." + sha(c)[:8] + ".js", SHA256: sha(c)} }
func qmlFile(c byte) File    { return File{Path: "resources." + sha(c)[:8] + ".rcc", SHA256: sha(c)} }

// TestPlan pins constraint 3 and design §8's one hostApi gate.
func TestPlan(t *testing.T) {
	served := Manifest{HostAPI: engine.HostAPI, Bundle: bundleFile('b'), QML: qmlFile('c')}
	with := func(f func(*Manifest)) Manifest { m := served; f(&m); return m }
	base := Have{HostAPI: engine.HostAPI, Current: sha('a'), AppFolder: true, QML: sha('d')}
	have := func(f func(*Have)) Have { h := base; f(&h); return h }

	for _, tc := range []struct {
		name        string
		m           Manifest
		have        Have
		bundle, qml bool
		tooOld      bool
		manifestErr bool
	}{
		{name: "a new bundle under the same hostApi is fetched", m: served, have: base, bundle: true, qml: true},
		{name: "a bundle equal to current is not", m: served,
			have: have(func(h *Have) { h.Current = sha('b') }), qml: true},
		{name: "a bundle equal to staged is not", m: served,
			have: have(func(h *Have) { h.Staged = sha('b') }), qml: true},
		{name: "a refused bundle is not", m: served,
			have: have(func(h *Have) { h.Refused = []string{sha('e'), sha('b')} }), qml: true},
		{name: "a new qml is fetched, not when equal to the folder's", m: served,
			have: have(func(h *Have) { h.QML = sha('c') }), bundle: true},
		{name: "no qml without an app folder", m: served,
			have: have(func(h *Have) { h.AppFolder = false; h.QML = "" }), bundle: true},
		{name: "a qml into an app folder that has none", m: served,
			have: have(func(h *Have) { h.QML = "" }), bundle: true, qml: true},
		{name: "a hostApi too new refused",
			m: with(func(m *Manifest) { m.HostAPI = engine.HostAPI + 1 }), have: base, tooOld: true},
		{name: "an older hostApi fetches neither and says nothing",
			m: with(func(m *Manifest) { m.HostAPI = engine.HostAPI - 1 }), have: base},
		{name: "a bundle path not local", have: base, qml: true, manifestErr: true,
			m: with(func(m *Manifest) { m.Bundle.Path = "../bundle." + sha('b')[:8] + ".js" })},
		{name: "a bundle path with a separator", have: base, qml: true, manifestErr: true,
			m: with(func(m *Manifest) { m.Bundle.Path = "x/bundle." + sha('b')[:8] + ".js" })},
		{name: "a bundle path not of the hashed form", have: base, qml: true, manifestErr: true,
			m: with(func(m *Manifest) { m.Bundle.Path = "bundle.js" })},
		{name: "a bundle path whose digits disagree with its sha256", have: base, qml: true, manifestErr: true,
			m: with(func(m *Manifest) { m.Bundle.Path = "bundle.ffffffff.js" })},
		{name: "a qml path not of the hashed form", have: base, bundle: true, manifestErr: true,
			m: with(func(m *Manifest) { m.QML.Path = "resources.rcc" })},
		{name: "a qml path whose digits disagree with its sha256", have: base, bundle: true, manifestErr: true,
			m: with(func(m *Manifest) { m.QML.Path = "resources." + sha('b')[:8] + ".rcc" })},
		{name: "a sha256 that is no digest", have: base, qml: true, manifestErr: true,
			m: with(func(m *Manifest) { m.Bundle.SHA256 = "BBBB" })},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := Plan(tc.m, tc.have)
			if (p.Bundle != nil) != tc.bundle {
				t.Errorf("bundle %v, want fetched %v", p.Bundle, tc.bundle)
			}
			if p.Bundle != nil && *p.Bundle != tc.m.Bundle {
				t.Errorf("bundle %+v, want the served %+v", *p.Bundle, tc.m.Bundle)
			}
			if (p.QML != nil) != tc.qml {
				t.Errorf("qml %v, want fetched %v", p.QML, tc.qml)
			}
			if p.TooOld != tc.tooOld {
				t.Errorf("tooOld %v, want %v", p.TooOld, tc.tooOld)
			}
			if got := errors.Is(p.Err, ErrManifest); got != tc.manifestErr {
				t.Errorf("err %v, want ErrManifest %v", p.Err, tc.manifestErr)
			}
		})
	}
}

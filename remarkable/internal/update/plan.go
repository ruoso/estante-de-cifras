// Package update is the reader's self-update (reader.self_update;
// docs/remarkable-reader.md §8, §10): at the end of a sync pass it reads the
// site's /device/manifest.json, chooses what to fetch (Plan, a pure choice),
// fetches it from the session's origin without the session, checks its
// SHA-256, and keeps it — the bundle staged in the store's bundle/next/, the
// QML (resources.rcc) placed in the AppLoad folder by one rename. Switching
// to a staged bundle, and rolling back one that does not open, is Switch's
// and OpenCurrent's, which the backend calls.
//
// One hostApi gates both: a served hostApi the backend does not speak fetches
// neither, and a newer one is remembered so the settings can say *Update the
// reader on your reMarkable*. The backend binary and the folder's
// manifest.json are never written.
//
// The package logs nothing; its errors name the role and the step
// ("update: bundle: checksum"), never the origin's token.
package update

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

// The refusals, for errors.Is.
var (
	// ErrManifest: the manifest is not JSON, or names a file by a path that
	// is not the hashed local name its sha256 says.
	ErrManifest = errors.New("manifest refused")
	// ErrChecksum: a body whose SHA-256 is not the manifest's.
	ErrChecksum = errors.New("checksum")
	// ErrTooLarge: a body over its limit.
	ErrTooLarge = errors.New("too large")
	// ErrStatus: an answer other than 200.
	ErrStatus = errors.New("not 200")
)

// File is a file the manifest names: its name under /device/ and its SHA-256.
type File struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

// Manifest is what the update reads of /device/manifest.json (the site's is a
// superset: the backend and the folders, which are never fetched here).
type Manifest struct {
	Version string `json:"version"`
	HostAPI int    `json:"hostApi"`
	Salt    string `json:"salt"`
	Bundle  File   `json:"bundle"`
	QML     File   `json:"qml"`
}

// Have is what the reader has: the hostApi its backend speaks, the SHA-256 of
// the current and the staged bundle ("" for none), whether an app folder is
// known and the SHA-256 of its resources.rcc ("" when absent), and the
// bundles refused.
type Have struct {
	HostAPI   int
	Current   string
	Staged    string
	AppFolder bool
	QML       string
	Refused   []string
}

// Choice is Plan's answer (a type cannot share the function's name): what to
// fetch — the bundle and the QML (nil for not), whether the
// served hostApi is newer than the backend's, and why a file was refused
// (wrapping ErrManifest; nil when none was).
type Choice struct {
	Bundle *File
	QML    *File
	TooOld bool
	Err    error
}

var (
	sha256Hex = regexp.MustCompile(`^[0-9a-f]{64}$`)
	bundleRe  = regexp.MustCompile(`^bundle\.([0-9a-f]{8})\.js$`)
	qmlRe     = regexp.MustCompile(`^resources\.([0-9a-f]{8})\.rcc$`)
)

// checkName refuses a file whose path is not a local name of the hashed form
// whose eight hex digits begin its sha256 (constraint 4).
func checkName(role string, f File, re *regexp.Regexp) error {
	if !sha256Hex.MatchString(f.SHA256) {
		return fmt.Errorf("update: %s: sha256: %w", role, ErrManifest)
	}
	if !filepath.IsLocal(f.Path) || strings.ContainsAny(f.Path, `/\`) {
		return fmt.Errorf("update: %s: path not local: %w", role, ErrManifest)
	}
	m := re.FindStringSubmatch(f.Path)
	if m == nil {
		return fmt.Errorf("update: %s: path not hashed: %w", role, ErrManifest)
	}
	if m[1] != f.SHA256[:8] {
		return fmt.Errorf("update: %s: path disagrees with sha256: %w", role, ErrManifest)
	}
	return nil
}

// Plan chooses what to fetch (constraint 3; design §8). Only a manifest whose
// hostApi is the backend's fetches anything; a newer one is TooOld. A bundle
// is fetched when its SHA-256 is none of current, staged and refused; a QML
// when an app folder is known and its SHA-256 differs from the folder's.
func Plan(m Manifest, have Have) Choice {
	var p Choice
	switch {
	case m.HostAPI > have.HostAPI:
		p.TooOld = true
		return p
	case m.HostAPI < have.HostAPI:
		return p
	}
	var errs []error
	if err := checkName("bundle", m.Bundle, bundleRe); err != nil {
		errs = append(errs, err)
	} else if m.Bundle.SHA256 != have.Current && m.Bundle.SHA256 != have.Staged &&
		!slices.Contains(have.Refused, m.Bundle.SHA256) {
		b := m.Bundle
		p.Bundle = &b
	}
	if err := checkName("qml", m.QML, qmlRe); err != nil {
		errs = append(errs, err)
	} else if have.AppFolder && m.QML.SHA256 != have.QML {
		q := m.QML
		p.QML = &q
	}
	p.Err = errors.Join(errs...)
	return p
}

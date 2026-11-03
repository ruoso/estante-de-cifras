package update

// The check a sync pass ends with (Decision 1): read the manifest, record the
// served hostApi, plan, fetch, check, and keep — the bundle staged, the QML
// placed.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/store"
)

// appID is the AppLoad folder's id the backend writes into (tools/appfolder).
const appID = "estante"

// The AppLoad folder's files (reader.app_folder).
const (
	folderManifest = "manifest.json"
	folderQML      = "resources.rcc"
)

// Updater checks the site for a bundle and a QML for one store and, when
// AppDir is Estante's AppLoad folder, places the QML there.
type Updater struct {
	// Store keeps the staged bundle, the update record and the QML replaced.
	Store *store.Store
	// AppDir is the AppLoad folder ("" when none is known: then no QML is
	// placed). It is written only when its manifest.json has id estante.
	AppDir string
	// HostAPI is the hostApi the backend speaks (engine.HostAPI when 0).
	HostAPI int
}

// Result is what a check did: the SHA-256 of the bundle it staged and of the
// QML it placed ("" for none), and whether the served hostApi is newer than
// the backend's.
type Result struct {
	Bundle string
	QML    string
	TooOld bool
}

func (u *Updater) hostAPI() int {
	if u.HostAPI != 0 {
		return u.HostAPI
	}
	return engine.HostAPI
}

// Check reads origin's /device/manifest.json with client and fetches what the
// plan names. A file refused (by its name, its size, its status or its hash)
// keeps nothing of it; the other file is still fetched. The error joins every
// refusal.
func (u *Updater) Check(ctx context.Context, client *http.Client, origin *url.URL) (Result, error) {
	c := deviceClient(client, origin)
	raw, err := get(ctx, c, origin, "manifest", "manifest.json", maxManifest)
	if err != nil {
		return Result{}, err
	}
	var m Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return Result{}, fmt.Errorf("update: manifest: not JSON: %w", ErrManifest)
	}
	if err := u.Store.SetServedHostAPI(m.HostAPI); err != nil {
		return Result{}, fmt.Errorf("update: record: %w", err)
	}
	app := u.appFolder()
	p := Plan(m, u.have(app))
	res := Result{TooOld: p.TooOld}
	errs := []error{p.Err}
	if p.Bundle != nil {
		if err := u.stage(ctx, c, origin, raw, *p.Bundle); err != nil {
			errs = append(errs, err)
		} else {
			res.Bundle = p.Bundle.SHA256
		}
	}
	if p.QML != nil {
		if err := u.place(ctx, c, origin, app, *p.QML); err != nil {
			errs = append(errs, err)
		} else {
			res.QML = p.QML.SHA256
		}
	}
	return res, errors.Join(errs...)
}

// stage fetches the bundle and stages it beside the served manifest, kept as
// it was served (constraint 8).
func (u *Updater) stage(ctx context.Context, c *http.Client, origin *url.URL, manifest []byte, f File) error {
	body, err := getChecked(ctx, c, origin, "bundle", f)
	if err != nil {
		return err
	}
	if err := u.Store.StageBundle(map[string][]byte{engine.ManifestFile: manifest, f.Path: body}); err != nil {
		return fmt.Errorf("update: bundle: stage: %w", err)
	}
	return nil
}

// place fetches the QML and puts it in the folder (constraint 12): the
// folder's resources.rcc kept in the store's qml/previous/, the new bytes
// written to a temporary in the folder and renamed over it, the folder
// synced. A frontend running keeps the file it registered.
func (u *Updater) place(ctx context.Context, c *http.Client, origin *url.URL, dir string, f File) (err error) {
	body, err := getChecked(ctx, c, origin, "qml", f)
	if err != nil {
		return err
	}
	target := filepath.Join(dir, folderQML)
	mode := fs.FileMode(0o644)
	old, rerr := os.ReadFile(target)
	switch {
	case rerr == nil:
		if fi, err := os.Stat(target); err == nil {
			mode = fi.Mode().Perm()
		}
		if err := u.Store.KeepPreviousQML(old); err != nil {
			return fmt.Errorf("update: qml: keep previous: %w", err)
		}
	case !errors.Is(rerr, fs.ErrNotExist):
		return fmt.Errorf("update: qml: read current: %w", rerr)
	}
	tmp, err := os.CreateTemp(dir, ".tmp-"+folderQML+"-*")
	if err != nil {
		return fmt.Errorf("update: qml: place: %w", err)
	}
	defer func() {
		if err != nil {
			tmp.Close()
			os.Remove(tmp.Name())
		}
	}()
	if err := tmp.Chmod(mode); err != nil {
		return fmt.Errorf("update: qml: place: %w", err)
	}
	if _, err := tmp.Write(body); err != nil {
		return fmt.Errorf("update: qml: place: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		return fmt.Errorf("update: qml: place: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("update: qml: place: %w", err)
	}
	if err := os.Rename(tmp.Name(), target); err != nil {
		return fmt.Errorf("update: qml: place: %w", err)
	}
	if err := syncDir(dir); err != nil {
		return fmt.Errorf("update: qml: place: %w", err)
	}
	return nil
}

// appFolder is AppDir when it is Estante's AppLoad folder (its manifest.json
// has id estante), "" otherwise (Decision 7).
func (u *Updater) appFolder() string {
	if u.AppDir == "" {
		return ""
	}
	raw, err := os.ReadFile(filepath.Join(u.AppDir, folderManifest))
	if err != nil {
		return ""
	}
	var m struct {
		ID string `json:"id"`
	}
	if json.Unmarshal(raw, &m) != nil || m.ID != appID {
		return ""
	}
	return u.AppDir
}

// have reads what the reader has (Plan's Have).
func (u *Updater) have(app string) Have {
	h := Have{HostAPI: u.hostAPI(), Refused: u.Store.Refused()}
	if dir, ok := u.Store.BundleDir(); ok {
		h.Current = BundleSHA(dir)
	}
	if dir, ok := u.Store.StagedBundleDir(); ok {
		h.Staged = BundleSHA(dir)
	}
	if app != "" {
		h.AppFolder = true
		if raw, err := os.ReadFile(filepath.Join(app, folderQML)); err == nil {
			h.QML = hexSum(raw)
		}
	}
	return h
}

// BundleSHA is the bundle's SHA-256 its directory's manifest names ("" when
// the manifest is unreadable).
func BundleSHA(dir string) string {
	raw, err := os.ReadFile(filepath.Join(dir, engine.ManifestFile))
	if err != nil {
		return ""
	}
	var m engine.Manifest
	if json.Unmarshal(raw, &m) != nil {
		return ""
	}
	return m.Bundle.SHA256
}

// syncDir makes a rename in dir durable.
func syncDir(dir string) error {
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

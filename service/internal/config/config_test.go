package config

import (
	"strings"
	"testing"
)

// envFrom turns a map into a lookup func of the shape Load takes, so tests
// never touch the real process environment.
func envFrom(vars map[string]string) func(string) (string, bool) {
	return func(key string) (string, bool) {
		v, ok := vars[key]
		return v, ok
	}
}

// TestLoadDefaultsPortWhenUnset pins the config-from-the-environment half of
// the .tji note: the default listen port when PORT is unset (DIRECTION §3.3's
// container/Railway deployment model).
func TestLoadDefaultsPortWhenUnset(t *testing.T) {
	cfg, err := Load(envFrom(nil))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.Port != DefaultPort {
		t.Errorf("Port = %d, want default %d", cfg.Port, DefaultPort)
	}
}

// TestLoadDefaultsAppRootWhenUnset pins that the app-root defaults to
// DefaultAppRoot (the image's /srv/app, where the Dockerfile placed app/dist)
// when ESTANTE_APP_ROOT is unset — so the deployed image needs no app-path
// configuration (DIRECTION §3.3; service.serve_app, the config seam).
func TestLoadDefaultsAppRootWhenUnset(t *testing.T) {
	cfg, err := Load(envFrom(nil))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.AppRoot != DefaultAppRoot {
		t.Errorf("AppRoot = %q, want default %q", cfg.AppRoot, DefaultAppRoot)
	}
}

// TestLoadHonoursAppRoot pins that an explicit ESTANTE_APP_ROOT overrides the
// default, so tests can point it at a fixture and dev at app/dist.
func TestLoadHonoursAppRoot(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{"ESTANTE_APP_ROOT": "/tmp/app-dist"}))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.AppRoot != "/tmp/app-dist" {
		t.Errorf("AppRoot = %q, want /tmp/app-dist", cfg.AppRoot)
	}
}

// TestLoadTreatsEmptyAppRootAsUnset pins that an empty ESTANTE_APP_ROOT (an
// unset-but-present variable) falls back to the default rather than serving
// from an empty path.
func TestLoadTreatsEmptyAppRootAsUnset(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{"ESTANTE_APP_ROOT": ""}))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.AppRoot != DefaultAppRoot {
		t.Errorf("AppRoot = %q, want default %q", cfg.AppRoot, DefaultAppRoot)
	}
}

// TestLoadReadsDatabaseURL pins that ESTANTE_DATABASE_URL is read into
// Config.DatabaseURL verbatim (the DSN config seam, config.go:24-27; the pgx
// Postgres client, DIRECTION §3.6 line 313). The value is carried, never
// parsed or defaulted here — the pool rejects a bad DSN at start-up.
func TestLoadReadsDatabaseURL(t *testing.T) {
	const dsn = "postgres://estante:estante@127.0.0.1:5432/estante?sslmode=disable"
	cfg, err := Load(envFrom(map[string]string{"ESTANTE_DATABASE_URL": dsn}))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.DatabaseURL != dsn {
		t.Errorf("DatabaseURL = %q, want %q", cfg.DatabaseURL, dsn)
	}
}

// TestLoadDefaultsDatabaseURLEmptyWhenUnset pins that an unset
// ESTANTE_DATABASE_URL leaves DatabaseURL empty — there is no sensible default
// for a database connection, and compose/scripts/gate always provide it — so an
// empty value is left for the pool to reject, handled like the other vars.
func TestLoadDefaultsDatabaseURLEmptyWhenUnset(t *testing.T) {
	cfg, err := Load(envFrom(nil))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.DatabaseURL != "" {
		t.Errorf("DatabaseURL = %q, want empty when unset", cfg.DatabaseURL)
	}
}

// TestLoadHonoursPort pins that an explicit PORT overrides the default.
func TestLoadHonoursPort(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{"PORT": "3000"}))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.Port != 3000 {
		t.Errorf("Port = %d, want 3000", cfg.Port)
	}
}

// TestLoadTreatsEmptyPortAsUnset pins that an empty PORT (an unset-but-present
// variable, as a shell can leave it) falls back to the default rather than
// erroring on an empty number.
func TestLoadTreatsEmptyPortAsUnset(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{"PORT": ""}))
	if err != nil {
		t.Fatalf("Load: unexpected error: %v", err)
	}
	if cfg.Port != DefaultPort {
		t.Errorf("Port = %d, want default %d", cfg.Port, DefaultPort)
	}
}

// TestLoadRejectsUnparseablePort pins the fail-fast rule: an unparseable PORT
// is a start-up error that names the variable, not a silent fallback.
func TestLoadRejectsUnparseablePort(t *testing.T) {
	_, err := Load(envFrom(map[string]string{"PORT": "eighty"}))
	if err == nil {
		t.Fatal("Load: want error for unparseable PORT, got nil")
	}
	if !strings.Contains(err.Error(), "PORT") {
		t.Errorf("error %q does not name PORT", err)
	}
}

// TestLoadRejectsOutOfRangePort pins that a numeric but impossible port is
// rejected rather than bound.
func TestLoadRejectsOutOfRangePort(t *testing.T) {
	if _, err := Load(envFrom(map[string]string{"PORT": "70000"})); err == nil {
		t.Fatal("Load: want error for out-of-range PORT, got nil")
	}
	if _, err := Load(envFrom(map[string]string{"PORT": "0"})); err == nil {
		t.Fatal("Load: want error for port 0, got nil")
	}
}
